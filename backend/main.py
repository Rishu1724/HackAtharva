from __future__ import annotations

import base64
import random
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


class AnalyzeFrameRequest(BaseModel):
  driverId: str
  imageBase64: str
  timestamp: str


class AnalyzeFrameResponse(BaseModel):
  flag: Literal["DROWSY", "DISTRACTED", "NORMAL"]


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


def decode_base64_to_image(image_base64: str) -> np.ndarray:
  if "," in image_base64:
    image_base64 = image_base64.split(",", 1)[1]

  image_bytes = base64.b64decode(image_base64)
  np_data = np.frombuffer(image_bytes, dtype=np.uint8)
  image = cv2.imdecode(np_data, cv2.IMREAD_COLOR)
  if image is None:
    raise ValueError("Invalid image data")
  return image


def analyze_driver_state(frame: np.ndarray) -> Literal["DROWSY", "DISTRACTED", "NORMAL"]:
  # Placeholder hybrid logic for hackathon demo:
  # You can replace this with eye-aspect-ratio + head pose from MediaPipe FaceMesh.
  rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
  mp_face_detection = mp.solutions.face_detection

  with mp_face_detection.FaceDetection(model_selection=0, min_detection_confidence=0.5) as detector:
    result = detector.process(rgb)

  if not result.detections:
    return "DISTRACTED"

  # Randomized fallback for demo variability.
  r = random.random()
  if r < 0.08:
    return "DROWSY"
  if r < 0.20:
    return "DISTRACTED"
  return "NORMAL"


@app.post("/ai/analyze-frame", response_model=AnalyzeFrameResponse)
def analyze_frame(payload: AnalyzeFrameRequest) -> AnalyzeFrameResponse:
  try:
    frame = decode_base64_to_image(payload.imageBase64)
  except Exception as exc:
    raise HTTPException(status_code=400, detail=f"Invalid frame payload: {exc}")

  flag = analyze_driver_state(frame)
  return AnalyzeFrameResponse(flag=flag)


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
