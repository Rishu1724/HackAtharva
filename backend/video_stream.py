import cv2
from fastapi import APIRouter, Response
from starlette.responses import StreamingResponse
from shared import LATEST_FRAME, VEHICLE_TO_DRIVER
import threading
import time

router = APIRouter()

# This is a simple in-memory frame store for demo. In production, use a proper video stream.
def generate_mjpeg(driver_id: str):
    while True:
        frame_data = LATEST_FRAME.get(driver_id)
        if frame_data and 'imageBase64' in frame_data:
            import base64
            import io
            from PIL import Image
            import numpy as np
            # Remove data:image/...;base64, prefix if present
            img_b64 = frame_data['imageBase64']
            if ',' in img_b64:
                img_b64 = img_b64.split(',', 1)[1]
            img_bytes = base64.b64decode(img_b64)
            img_np = np.frombuffer(img_bytes, dtype=np.uint8)
            img = cv2.imdecode(img_np, cv2.IMREAD_COLOR)
            if img is not None:
                ret, jpeg = cv2.imencode('.jpg', img)
                if ret:
                    yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
        time.sleep(0.1)  # 10 fps

@router.get("/video/stream/{identifier}")
def video_stream(identifier: str):
    # Try to resolve identifier as vehicleNumber first
    driver_id = VEHICLE_TO_DRIVER.get(identifier.upper(), identifier)
    return StreamingResponse(generate_mjpeg(driver_id), media_type="multipart/x-mixed-replace; boundary=frame")
