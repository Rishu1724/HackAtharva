from __future__ import annotations

import base64
import os
from datetime import datetime
from typing import List, Literal, Optional, Dict, Any

import cv2
import mediapipe as mp
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests

app = FastAPI(title="Driver Monitoring Backend", version="1.0.0")

# In-memory stores for demo/hackathon use.
GPS_STORE: dict[str, list[dict]] = {}
ALERT_STORE: list[dict] = []
ROUTE_STORE: dict[str, list[dict]] = {}
DROWSY_STATE: dict[str, int] = {}
LATEST_FRAME: dict[str, dict] = {}

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
ALERT_SENDER_EMAIL = os.getenv("ALERT_SENDER_EMAIL")
ALERT_SENDER_NAME = os.getenv("ALERT_SENDER_NAME", "Smart Transport Safety")


class AnalyzeFrameRequest(BaseModel):
  driverId: str
  imageBase64: str
  timestamp: str


class AnalyzeFrameResponse(BaseModel):
  driverId: str
  timestamp: str
  flag: Literal["DROWSY", "DISTRACTED", "NORMAL"]
  action: str
  severity: Literal["LOW", "MEDIUM", "HIGH"]
  detail: str
  metrics: Dict[str, Any]


class GPSUpdateRequest(BaseModel):
  driverId: str
  lat: float
  lng: float
  speed: float = 0.0
  timestamp: str
  source: Optional[str] = "foreground"


class GeofenceAlertRequest(BaseModel):
  driverId: str
  lat: float
  lng: float
  distance: float
  threshold: float = 200
  timestamp: str


class RouteResponse(BaseModel):
  route: List[dict]


class PushRequest(BaseModel):
  token: str
  title: str
  body: str
  data: Optional[Dict[str, Any]] = None


class EmailRequest(BaseModel):
  toEmail: str
  subject: str
  body: str


def deliver_email_via_sendgrid(to_email: str, subject: str, body: str) -> dict[str, str]:
  if not to_email:
    raise ValueError("Recipient email is required")

  if not SENDGRID_API_KEY or not ALERT_SENDER_EMAIL:
    print("SendGrid credentials missing. Skipping email delivery.")
    return {"status": "skipped", "reason": "Email service not configured"}

  payload = {
    "personalizations": [{"to": [{"email": to_email}]}],
    "from": {"email": ALERT_SENDER_EMAIL, "name": ALERT_SENDER_NAME},
    "subject": subject,
    "content": [
      {
        "type": "text/plain",
        "value": body,
      }
    ],
  }

  headers = {
    "Authorization": f"Bearer {SENDGRID_API_KEY}",
    "Content-Type": "application/json",
  }

  response = requests.post(
    "https://api.sendgrid.com/v3/mail/send",
    json=payload,
    headers=headers,
    timeout=10,
  )

  if response.status_code not in (200, 202):
    detail = response.text or response.reason
    raise HTTPException(status_code=500, detail=f"Email send failed: {detail}")

  return {"status": "sent"}


def decode_base64_to_image(image_base64: str) -> np.ndarray:
  if "," in image_base64:
    image_base64 = image_base64.split(",", 1)[1]

  image_bytes = base64.b64decode(image_base64)
  np_data = np.frombuffer(image_bytes, dtype=np.uint8)
  image = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
  if image is None:
    raise ValueError("Invalid image data")
  return image


def _eye_aspect_ratio(landmarks: list[tuple[float, float]], eye_idx: list[int]) -> float:
  p1 = np.array(landmarks[eye_idx[0]])
  p2 = np.array(landmarks[eye_idx[1]])
  p3 = np.array(landmarks[eye_idx[2]])
  p4 = np.array(landmarks[eye_idx[3]])
  p5 = np.array(landmarks[eye_idx[4]])
  p6 = np.array(landmarks[eye_idx[5]])

  vertical_1 = np.linalg.norm(p2 - p6)
  vertical_2 = np.linalg.norm(p3 - p5)
  horizontal = np.linalg.norm(p1 - p4)
  if horizontal == 0:
    return 0.0
  return (vertical_1 + vertical_2) / (2.0 * horizontal)


def analyze_driver_state(
  driver_id: str, frame: np.ndarray
) -> tuple[Literal["DROWSY", "DISTRACTED", "NORMAL"], dict[str, Any]]:
  rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
  mp_face_mesh = mp.solutions.face_mesh

  with mp_face_mesh.FaceMesh(
    static_image_mode=False,
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
  ) as face_mesh:
    result = face_mesh.process(rgb)

  if not result.multi_face_landmarks:
    return "DISTRACTED", {"reason": "Face not detected or occluded"}

  h, w, _ = frame.shape
  face_landmarks = result.multi_face_landmarks[0]
  points = [(lm.x * w, lm.y * h) for lm in face_landmarks.landmark]

  left_eye = [263, 387, 385, 362, 380, 373]
  right_eye = [33, 160, 158, 133, 153, 144]
  ear_left = _eye_aspect_ratio(points, left_eye)
  ear_right = _eye_aspect_ratio(points, right_eye)
  ear = (ear_left + ear_right) / 2.0

  # Simple drowsiness detection based on eye aspect ratio.
  threshold = 0.20
  count = DROWSY_STATE.get(driver_id, 0)
  if ear < threshold:
    count += 1
  else:
    count = 0

  DROWSY_STATE[driver_id] = count
  metrics = {
    "eyeAspectRatio": round(float(ear), 4),
    "threshold": threshold,
    "drowsyFrameStreak": count,
  }

  if count >= 3:
    return "DROWSY", metrics

  return "NORMAL", metrics


@app.post("/ai/analyze-frame", response_model=AnalyzeFrameResponse)
def analyze_frame(payload: AnalyzeFrameRequest) -> AnalyzeFrameResponse:
  try:
    frame = decode_base64_to_image(payload.imageBase64)
  except Exception as exc:
    raise HTTPException(status_code=400, detail=f"Invalid frame payload: {exc}")

  flag, metrics = analyze_driver_state(payload.driverId, frame)
  # Store latest frame for passenger preview.
  image_payload = payload.imageBase64
  if not image_payload.startswith("data:image/"):
    image_payload = f"data:image/jpg;base64,{image_payload}"
  LATEST_FRAME[payload.driverId] = {
    "imageBase64": image_payload,
    "timestamp": payload.timestamp,
    "flag": flag,
    "metrics": metrics,
  }
  action = "Continue normal monitoring"
  severity: Literal["LOW", "MEDIUM", "HIGH"] = "LOW"
  if flag == "DROWSY":
    action = "Play loud alert immediately and advise passenger to use SOS if driver does not respond"
    severity = "HIGH"
  elif flag == "DISTRACTED":
    action = "Warn driver immediately and keep monitoring for repeated distraction"
    severity = "MEDIUM"

  detail = "Eyes open and alert"
  if flag == "DROWSY":
    detail = (
      "Eyes remained closed across multiple frames. EAR "
      f"{metrics.get('eyeAspectRatio', 'N/A')} fell below threshold {metrics.get('threshold', 'N/A')}"
    )
  elif flag == "DISTRACTED":
    detail = metrics.get("reason", "Driver attention deviated from the road")
  else:
    detail = (
      "Eyes steady with EAR "
      f"{metrics.get('eyeAspectRatio', 'N/A')} above threshold {metrics.get('threshold', 'N/A')}"
    )

  LATEST_FRAME[payload.driverId]["detail"] = detail
  LATEST_FRAME[payload.driverId]["severity"] = severity

  return AnalyzeFrameResponse(
    driverId=payload.driverId,
    timestamp=payload.timestamp,
    flag=flag,
    action=action,
    severity=severity,
    detail=detail,
    metrics=metrics,
  )


@app.get("/ai/latest-frame/{driver_id}")
def get_latest_frame(driver_id: str):
  data = LATEST_FRAME.get(driver_id)
  if not data:
    raise HTTPException(status_code=404, detail="No frame available")
  return data


@app.post("/gps/update")
def gps_update(payload: GPSUpdateRequest):
  GPS_STORE.setdefault(payload.driverId, []).append(
    {
      "lat": payload.lat,
      "lng": payload.lng,
      "speed": payload.speed,
      "source": payload.source,
      "timestamp": payload.timestamp,
      "receivedAt": datetime.utcnow().isoformat(),
    }
  )

  # Keep latest 500 points per driver in memory.
  GPS_STORE[payload.driverId] = GPS_STORE[payload.driverId][-500:]
  return {"ok": True}


@app.post("/geofence/alert")
def geofence_alert(payload: GeofenceAlertRequest):
  ALERT_STORE.append(
    {
      "driverId": payload.driverId,
      "lat": payload.lat,
      "lng": payload.lng,
      "distance": payload.distance,
      "threshold": payload.threshold,
      "timestamp": payload.timestamp,
      "receivedAt": datetime.utcnow().isoformat(),
    }
  )
  return {"ok": True}


@app.get("/gps/route/{driver_id}", response_model=RouteResponse)
def get_expected_route(driver_id: str):
  # If no route seeded, return a short sample route around a known point.
  if driver_id not in ROUTE_STORE:
    ROUTE_STORE[driver_id] = [
      {"lat": 12.9716, "lng": 77.5946},
      {"lat": 12.9721, "lng": 77.5958},
      {"lat": 12.9728, "lng": 77.5970},
      {"lat": 12.9736, "lng": 77.5981},
    ]

  return RouteResponse(route=ROUTE_STORE[driver_id])


@app.post("/push/send")
def send_push(payload: PushRequest):
  message = {
    "to": payload.token,
    "title": payload.title,
    "body": payload.body,
    "data": payload.data or {},
  }

  response = requests.post(
    "https://exp.host/--/api/v2/push/send",
    json=message,
    timeout=10,
  )

  if response.status_code >= 400:
    raise HTTPException(status_code=500, detail="Push send failed")

  return {"ok": True}


@app.post("/alerts/email")
def send_alert_email(payload: EmailRequest):
  try:
    result = deliver_email_via_sendgrid(payload.toEmail, payload.subject, payload.body)
  except HTTPException:
    # Re-raise HTTP errors so FastAPI returns proper response
    raise
  except Exception as exc:
    raise HTTPException(status_code=500, detail=f"Email send failed: {exc}") from exc

  return {"ok": True, **result}
