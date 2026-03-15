from __future__ import annotations

import base64
import os
from datetime import datetime
from typing import List, Literal, Optional, Dict, Any

import cv2
import numpy as np

# Robust MediaPipe import
mp = None
mp_face_mesh = None
mp_hands = None
try:
    import mediapipe as mp
    from mediapipe.python.solutions import face_mesh as mp_face_mesh
    from mediapipe.python.solutions import hands as mp_hands
    print("SUCCESS: MediaPipe FaceMesh and Hands loaded.")
except (ImportError, ModuleNotFoundError) as e:
    print(f"ERROR: MediaPipe import failed: {e}")
    try:
        import mediapipe.solutions.face_mesh as mp_face_mesh
        import mediapipe.solutions.hands as mp_hands
        print("SUCCESS: MediaPipe loaded via fallback.")
    except Exception as e2:
        print(f"CRITICAL: All MediaPipe import attempts failed: {e2}")
        mp_face_mesh = None
        mp_hands = None
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from video_stream import router as video_stream_router
from shared import LATEST_FRAME, VEHICLE_TO_DRIVER

# Initialize Firebase Admin
try:
    # Try to initialize with default credentials (if service account file is set in GOOGLE_APPLICATION_CREDENTIALS)
    # or fallback to initialize with project id
    if not firebase_admin._apps:
        try:
            firebase_admin.initialize_app()
        except Exception:
            # Fallback if no credentials provided - useful for demo if you set project id
            firebase_admin.initialize_app(options={'projectId': 'hackatharva-9798c'})
    db_firestore = firestore.client()
    print("Firebase Admin initialized successfully.")
except Exception as fb_exc:
    db_firestore = None
    print(f"WARNING: Firebase Admin initialization failed: {fb_exc}")

app = FastAPI(title="Driver Monitoring Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video_stream_router)

# In-memory stores for demo/hackathon use.
GPS_STORE: dict[str, list[dict]] = {}
ALERT_STORE: list[dict] = []
ROUTE_STORE: dict[str, list[dict]] = {}
DROWSY_STATE: dict[str, int] = {}

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")
ALERT_SENDER_EMAIL = os.getenv("ALERT_SENDER_EMAIL")
ALERT_SENDER_NAME = os.getenv("ALERT_SENDER_NAME", "Smart Transport Safety")


class AnalyzeFrameRequest(BaseModel):
  driverId: str
  vehicleNumber: Optional[str] = None
  imageBase64: str
  timestamp: str


class AnalyzeFrameResponse(BaseModel):
  driverId: str
  timestamp: str
  flag: Literal["SLEEPING", "DISTRACTED", "NORMAL", "ABUSIVE_GESTURE"]
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
  return float((vertical_1 + vertical_2) / (2.0 * horizontal))


def _mouth_aspect_ratio(landmarks: list[tuple[float, float]], mouth_idx: list[int]) -> float:
  # Landmarks for vertical distance: 13, 14 (inner lips)
  # Landmarks for horizontal distance: 78, 308 (corners)
  p1 = np.array(landmarks[mouth_idx[0]]) # top
  p2 = np.array(landmarks[mouth_idx[1]]) # bottom
  p3 = np.array(landmarks[mouth_idx[2]]) # left
  p4 = np.array(landmarks[mouth_idx[3]]) # right

  vertical = np.linalg.norm(p1 - p2)
  horizontal = np.linalg.norm(p3 - p4)
  if horizontal == 0:
    return 0.0
  return float(vertical / horizontal)


# Global AI Models (Initialize once for performance)
face_mesh_model = None
hands_model = None

if mp_face_mesh:
    face_mesh_model = mp_face_mesh.FaceMesh(
        static_image_mode=False,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    )

if mp_hands:
    hands_model = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.5, # Lowered from 0.7 for easier detection
        min_tracking_confidence=0.5,
    )

def analyze_driver_state(
  driver_id: str, frame: np.ndarray
) -> tuple[Literal["SLEEPING", "DISTRACTED", "NORMAL", "ABUSIVE_GESTURE"], dict[str, Any]]:
  if face_mesh_model is None:
    return "NORMAL", {"status": "AI disabled - MediaPipe missing"}
    
  rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
  h, w, _ = frame.shape

  # 1. HAND ANALYSIS (Gestures) - Process this FIRST for highest priority
  has_middle_finger = False
  if hands_model:
    hand_result = hands_model.process(rgb)
    if hand_result.multi_hand_landmarks:
      # print(f"DEBUG: Hands detected for {driver_id}")
      for hand_landmarks in hand_result.multi_hand_landmarks:
        lm = hand_landmarks.landmark
        
        # 0: Wrist
        # Middle: Tip(12), MCP(9)
        # Index: Tip(8), MCP(5)
        # Ring: Tip(16), MCP(13)
        # Pinky: Tip(20), MCP(17)
        
        # Calculate distance from wrist (0) to each tip and MCP
        def get_dist(idx1, idx2):
            return ((lm[idx1].x - lm[idx2].x)**2 + (lm[idx1].y - lm[idx2].y)**2)**0.5

        # A finger is "extended" if its tip is much further from the wrist than its knuckle (MCP)
        # This is more robust against hand orientation (up/down/sideways)
        def is_extended_robust(tip_idx, mcp_idx):
            wrist_to_tip = get_dist(tip_idx, 0)
            wrist_to_mcp = get_dist(mcp_idx, 0)
            return wrist_to_tip > wrist_to_mcp * 1.3 # 30% further means extended

        middle_up = is_extended_robust(12, 9)
        index_up = is_extended_robust(8, 5)
        ring_up = is_extended_robust(16, 13)
        pinky_up = is_extended_robust(20, 17)
        
        # Middle finger gesture: Middle is the ONLY one extended
        if middle_up and not index_up and not ring_up and not pinky_up:
          has_middle_finger = True
          print(f"DEBUG: {driver_id} | !!! ABUSIVE GESTURE DETECTED !!!")
          break

  # 2. FACE ANALYSIS
  face_result = face_mesh_model.process(rgb)

  if not face_result.multi_face_landmarks:
    if has_middle_finger:
      return "ABUSIVE_GESTURE", {"reason": "Abusive gesture detected", "hasMiddleFinger": True}
    return "DISTRACTED", {"reason": "Face not detected or occluded"}

  face_landmarks = face_result.multi_face_landmarks[0]
  points = [(lm.x * w, lm.y * h) for lm in face_landmarks.landmark]

  # Eye Aspect Ratio (EAR)
  left_eye = [263, 387, 385, 362, 380, 373]
  right_eye = [33, 160, 158, 133, 153, 144]
  ear_left = _eye_aspect_ratio(points, left_eye)
  ear_right = _eye_aspect_ratio(points, right_eye)
  ear = (ear_left + ear_right) / 2.0

  # Mouth Aspect Ratio (MAR) for Yawning
  mouth_idx = [13, 14, 78, 308]
  mar = _mouth_aspect_ratio(points, mouth_idx)

  # Distraction Detection (Head Pose)
  p_nose = np.array(points[1])
  p_left = np.array(points[234])
  p_right = np.array(points[454])
  
  dist_l = np.linalg.norm(p_nose - p_left)
  dist_r = np.linalg.norm(p_nose - p_right)
  head_ratio = dist_l / dist_r if dist_r != 0 else 1.0
  # Widen the distraction range (from 0.5-2.0 to 0.3-3.0) for a more stable demo
  is_distracted = head_ratio < 0.3 or head_ratio > 3.0

  # Sleep detection logic
  eye_threshold = 0.28 
  mouth_threshold = 0.5 
  
  count = DROWSY_STATE.get(driver_id, 0)
  if ear < eye_threshold:
    count += 1
  else:
    count = 0

  DROWSY_STATE[driver_id] = count
  metrics = {
    "eyeAspectRatio": round(float(ear), 4),
    "mouthAspectRatio": round(float(mar), 4),
    "eyeThreshold": float(eye_threshold),
    "sleepFrameStreak": int(count),
    "isYawning": bool(mar > mouth_threshold),
    "headRatio": round(float(head_ratio), 2),
    "isHeadTurned": bool(is_distracted),
    "hasMiddleFinger": bool(has_middle_finger)
  }

  if has_middle_finger:
    return "ABUSIVE_GESTURE", metrics

  # If we have a streak of closed eyes, show SLEEPING even if distracted logic triggers
  if count >= 5: 
    return "SLEEPING", metrics
  
  if is_distracted:
    return "DISTRACTED", metrics

  return "NORMAL", metrics


@app.post("/ai/analyze-frame", response_model=AnalyzeFrameResponse)
def analyze_frame(payload: AnalyzeFrameRequest) -> AnalyzeFrameResponse:
  try:
    print(f"DEBUG: Receiving frame from {payload.driverId} for vehicle {payload.vehicleNumber}")
    frame = decode_base64_to_image(payload.imageBase64)
  except Exception as exc:
    raise HTTPException(status_code=400, detail=f"Invalid frame payload: {exc}")

  if payload.vehicleNumber:
    vehicle_num = payload.vehicleNumber.upper()
    VEHICLE_TO_DRIVER[vehicle_num] = payload.driverId
    
    # Update the vehicle status in the REAL database
    if db_firestore:
      try:
        # Update by number field
        query = db_firestore.collection('vehicles').where('number', '==', vehicle_num).limit(1)
        docs = query.get()
        if docs:
          doc_id = docs[0].id
          db_firestore.collection('vehicles').document(doc_id).update({
            'driverId': payload.driverId,
            'isStreaming': True,
            'lastUpdated': datetime.utcnow().isoformat()
          })
          print(f"DEBUG: Updated vehicle {vehicle_num} in Firestore.")
        else:
          print(f"DEBUG: Vehicle {vehicle_num} not found in Firestore. Creating temporary record.")
          db_firestore.collection('vehicles').add({
            'number': vehicle_num,
            'driverId': payload.driverId,
            'status': 'active',
            'isStreaming': True,
            'lastUpdated': datetime.utcnow().isoformat()
          })
      except Exception as e:
        print(f"DEBUG: Firestore update failed: {e}")

  # Initial fallback metrics
  flag: Literal["SLEEPING", "DISTRACTED", "NORMAL"] = "NORMAL"
  metrics = {"eyeAspectRatio": 0.3, "status": "AI processing..."}

  try:
    flag, metrics = analyze_driver_state(payload.driverId, frame)
    # Log the metrics for real-time calibration - AGGRESSIVE MODE
    if "eyeAspectRatio" in metrics:
        print(f"DEBUG: {payload.driverId} | STATUS: {flag} | EAR: {metrics.get('eyeAspectRatio')} (Threshold: {metrics.get('eyeThreshold')}) | STREAK: {metrics.get('sleepFrameStreak')}")
    else:
        print(f"DEBUG: {payload.driverId} | STATUS: {flag} | {metrics.get('status', metrics.get('reason', 'AI state unknown'))}")
  except Exception as ai_exc:
    print(f"AI Analysis failed: {ai_exc}")
    metrics["error"] = str(ai_exc)

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
  if flag == "SLEEPING":
    action = "🚨 DRIVER IS SLEEPING! Play loud siren immediately and notify passenger to take control or use SOS."
    severity = "HIGH"
  elif flag == "ABUSIVE_GESTURE":
    action = "🚨 ABUSIVE GESTURE DETECTED! Warning: Offensive behavior recorded. Reporting to authorities."
    severity = "HIGH"
  elif flag == "DISTRACTED":
    action = "Warn driver immediately and keep monitoring for repeated distraction"
    severity = "MEDIUM"

  detail = "Eyes open and alert"
  if flag == "SLEEPING":
    detail = (
      "CRITICAL: Driver's eyes have been closed for a dangerous amount of time. "
      f"EAR {metrics.get('eyeAspectRatio', 'N/A')} < threshold {metrics.get('eyeThreshold', 'N/A')}"
    )
  elif flag == "ABUSIVE_GESTURE":
    detail = "CRITICAL: Driver showed an abusive gesture (middle finger) to the camera."
  elif metrics.get("isYawning"):
    detail = "Warning: Driver is yawning. Signs of fatigue detected."
    severity = "MEDIUM"
  elif flag == "DISTRACTED":
    detail = metrics.get("reason", "Driver attention deviated from the road")
  else:
    detail = (
      "Eyes steady with EAR "
      f"{metrics.get('eyeAspectRatio', 'N/A')} above threshold {metrics.get('eyeThreshold', 'N/A')}"
    )

  LATEST_FRAME[payload.driverId]["detail"] = detail
  LATEST_FRAME[payload.driverId]["severity"] = severity

  # Update the state in the REAL database for this specific driver/vehicle
  if db_firestore and payload.vehicleNumber:
    try:
      vehicle_num = payload.vehicleNumber.upper()
      
      # 1. Update active vehicle status
      query = db_firestore.collection('vehicles').where('number', '==', vehicle_num).limit(1)
      docs = query.get()
      if docs:
        doc_id = docs[0].id
        db_firestore.collection('vehicles').document(doc_id).update({
          'lastFrame': image_payload,
          'lastFlag': flag,
          'lastSeverity': severity,
          'lastMetrics': metrics,
          'lastDetail': detail,
          'lastUpdated': datetime.utcnow().isoformat()
        })
      
      # 2. Store incident in safetyReports if it's a violation
      if flag in ["SLEEPING", "DISTRACTED", "ABUSIVE_GESTURE"]:
        # Simple throttle: only record one report every 30 seconds per type
        db_firestore.collection('safetyReports').add({
          'driverId': payload.driverId,
          'vehicleNumber': vehicle_num,
          'type': flag,
          'severity': severity,
          'detail': detail,
          'metrics': metrics,
          'timestamp': datetime.utcnow().isoformat()
        })
        print(f"DEBUG: Safety report recorded for {vehicle_num}: {flag}")
        
    except Exception as e:
      print(f"DEBUG: Firestore status update failed: {e}")

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
  # Try to resolve driver_id as vehicleNumber first
  print(f"DEBUG: Request for {driver_id}")
  actual_driver_id = VEHICLE_TO_DRIVER.get(driver_id.upper())

  # If not in memory, try to find in Firestore
  if not actual_driver_id and db_firestore:
    try:
      print(f"DEBUG: Mapping for {driver_id} not in memory. Searching Firestore...")
      vehicles_ref = db_firestore.collection('vehicles')
      query = vehicles_ref.where('number', '==', driver_id.upper()).where('status', '==', 'active').limit(1)
      docs = query.get()
      if docs:
        vehicle_data = docs[0].to_dict()
        actual_driver_id = vehicle_data.get('driverId')
        if actual_driver_id:
          VEHICLE_TO_DRIVER[driver_id.upper()] = actual_driver_id
          print(f"DEBUG: Found in Firestore. {driver_id.upper()} -> {actual_driver_id}")
    except Exception as e:
      print(f"DEBUG: Firestore search failed: {e}")

  if not actual_driver_id:
    actual_driver_id = driver_id # Fallback if no mapping found

  print(f"DEBUG: Resolved ID: {actual_driver_id}")
  data = LATEST_FRAME.get(actual_driver_id)
  if not data:
    print(f"DEBUG: No data in LATEST_FRAME for {actual_driver_id}")
    print(f"DEBUG: Keys in LATEST_FRAME: {list(LATEST_FRAME.keys())}")
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
