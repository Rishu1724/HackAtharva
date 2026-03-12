# Driver Monitoring Module (Camera + GPS)

This module adds real-time driver monitoring for both phone and web:
- Camera streaming every 1 second to `POST /ai/analyze-frame`
- GPS streaming every 2 seconds to `POST /gps/update`
- Geofence deviation alerts to `POST /geofence/alert`
- Background location updates (native mobile)
- Admin access disabled on phone, kept for web only

## Mobile + Web Notes
- Camera AI streaming works on Android/iOS and web (browser permissions required).
- Full map is native-only (`react-native-maps`). Web shows a safe fallback with live coordinates.
- Background GPS is native mobile only.

## Files Added

### Camera
- `src/modules/CameraModule/CameraScreen.tsx`
- `src/modules/CameraModule/useCameraStream.ts`
- `src/modules/CameraModule/CameraOverlay.tsx`

### GPS
- `src/modules/GPSModule/DriverLocationScreen.tsx`
- `src/modules/GPSModule/useDriverLocation.ts`
- `src/modules/GPSModule/useGeofence.ts`
- `src/modules/GPSModule/backgroundLocationTask.ts`
- `src/modules/GPSModule/DriverLocationMap.native.tsx`
- `src/modules/GPSModule/DriverLocationMap.web.tsx`

### Combined Driver Screen
- `src/screens/driver/DriverMonitoringScreen.tsx`
- Added as `Monitoring` tab in driver app.

### Backend
- `backend/main.py`
- `backend/requirements.txt`

## Run Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Backend Endpoints
- `POST /ai/analyze-frame`
- `POST /gps/update`
- `POST /geofence/alert`
- `GET /gps/route/{driverId}`

## Run App

```bash
npx expo start --tunnel --clear
```

## Important Config
Update backend URL in `src/screens/driver/DriverMonitoringScreen.tsx`:
```ts
const BACKEND_URL = 'http://10.0.2.2:8000';
```

Use correct value:
- Android emulator: `http://10.0.2.2:8000`
- iOS simulator: `http://localhost:8000`
- Physical phone: `http://<YOUR_LAPTOP_LAN_IP>:8000`

## Quick Test Plan
1. Open app as Driver -> `Monitoring` tab.
2. Tap `Start Monitoring`.
3. Verify camera flag updates (`NORMAL`, `DROWSY`, `DISTRACTED`).
4. Move with phone (or mock location) and verify GPS updates.
5. Check backend logs for `/gps/update` hits every ~2s.
6. Simulate route deviation; verify `/geofence/alert` called.
7. Minimize app on phone; ensure background updates continue (native).

## Permissions
Camera + location permissions are requested in-app. For production, ensure release build includes background location review notes for app stores.
