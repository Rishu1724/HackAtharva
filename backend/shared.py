# Shared in-memory stores for demo/hackathon use.
# This prevents circular imports between main.py and video_stream.py.

LATEST_FRAME: dict[str, dict] = {}
VEHICLE_TO_DRIVER: dict[str, str] = {} # Mapping bus/cab number to driverId
