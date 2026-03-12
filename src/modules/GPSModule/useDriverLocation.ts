import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as Location from 'expo-location';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db, rtdb } from '../../config/firebase';
import { ref, set } from 'firebase/database';
import { RoutePoint, useGeofence } from './useGeofence';
import './backgroundLocationTask';
import {
  configureBackgroundTaskContext,
  startBackgroundLocationTask,
  stopBackgroundLocationTask,
} from './backgroundLocationTask';

type DriverLocation = {
  lat: number;
  lng: number;
  speedKmh: number;
  timestamp: string;
};

type UseDriverLocationParams = {
  backendUrl: string;
  driverId: string;
};

type RouteApiResponse = {
  route?: RoutePoint[];
};

export function useDriverLocation({ backendUrl, driverId }: UseDriverLocationParams) {
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastAlertRef = useRef<number>(0);

  const [isTracking, setIsTracking] = useState(false);
  const [isLoadingPermission, setIsLoadingPermission] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<DriverLocation | null>(null);
  const [expectedRoute, setExpectedRoute] = useState<RoutePoint[]>([]);

  const { evaluateGeofence, geofenceState } = useGeofence({
    expectedRoute,
    maxDeviationMeters: 200,
  });

  const statusText = useMemo(() => {
    if (!currentLocation) {
      return 'No GPS fix';
    }

    return `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`;
  }, [currentLocation]);

  const requestPermissions = useCallback(async () => {
    setIsLoadingPermission(true);
    setPermissionError(null);

    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        throw new Error('Foreground location permission denied');
      }

      if (Platform.OS !== 'web') {
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status !== 'granted') {
          throw new Error('Background location permission denied');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request location permission';
      setPermissionError(message);
    } finally {
      setIsLoadingPermission(false);
    }
  }, []);

  const postLocation = useCallback(
    async (loc: DriverLocation, source: 'foreground' | 'background' = 'foreground') => {
      const response = await fetch(`${backendUrl}/gps/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speedKmh,
          timestamp: loc.timestamp,
          source,
        }),
      });

      if (!response.ok) {
        throw new Error(`GPS update failed: ${response.status}`);
      }

      await set(ref(rtdb, `drivers/${driverId}/location`), {
        lat: loc.lat,
        lng: loc.lng,
        speed: loc.speedKmh,
        source,
        updatedAt: loc.timestamp,
      });
    },
    [backendUrl, driverId]
  );

  const pushGeofenceAlert = useCallback(
    async (distance: number, loc: DriverLocation) => {
      await fetch(`${backendUrl}/geofence/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          lat: loc.lat,
          lng: loc.lng,
          distance,
          threshold: 200,
          timestamp: loc.timestamp,
        }),
      });

      await addDoc(collection(db, 'geofenceAlerts'), {
        driverId,
        userId: auth.currentUser?.uid ?? null,
        distance,
        location: { lat: loc.lat, lng: loc.lng },
        createdAt: loc.timestamp,
        severity: 'high',
      });
    },
    [backendUrl, driverId]
  );

  const loadExpectedRoute = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/gps/route/${driverId}`);
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as RouteApiResponse | RoutePoint[];
      const route = Array.isArray(data) ? data : data.route ?? [];
      setExpectedRoute(route.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)));
    } catch {
      // Route is optional; tracking continues without geofence route.
    }
  }, [backendUrl, driverId]);

  const stopTracking = useCallback(async () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }

    await stopBackgroundLocationTask();
    setIsTracking(false);
  }, []);

  const startTracking = useCallback(async () => {
    if (permissionError) {
      Alert.alert('Permission Required', permissionError);
      return;
    }

    await loadExpectedRoute();

    const firstLoc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const initial: DriverLocation = {
      lat: firstLoc.coords.latitude,
      lng: firstLoc.coords.longitude,
      speedKmh: Math.max(0, (firstLoc.coords.speed ?? 0) * 3.6),
      timestamp: new Date().toISOString(),
    };

    setCurrentLocation(initial);
    await postLocation(initial);

    await configureBackgroundTaskContext(driverId, backendUrl);
    await startBackgroundLocationTask();

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 0,
      },
      async (locationUpdate) => {
        try {
          const nextLoc: DriverLocation = {
            lat: locationUpdate.coords.latitude,
            lng: locationUpdate.coords.longitude,
            speedKmh: Math.max(0, (locationUpdate.coords.speed ?? 0) * 3.6),
            timestamp: new Date().toISOString(),
          };

          setCurrentLocation(nextLoc);
          setError(null);
          await postLocation(nextLoc);

          const geoResult = evaluateGeofence({ lat: nextLoc.lat, lng: nextLoc.lng });
          if (geoResult.deviated) {
            const now = Date.now();
            if (now - lastAlertRef.current > 15000) {
              lastAlertRef.current = now;
              await pushGeofenceAlert(geoResult.distance, nextLoc);
              Alert.alert('Route Deviation', `Driver is ${Math.round(geoResult.distance)}m away from expected route.`);
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to update driver location');
        }
      }
    );

    setIsTracking(true);
  }, [
    backendUrl,
    driverId,
    evaluateGeofence,
    loadExpectedRoute,
    permissionError,
    postLocation,
    pushGeofenceAlert,
  ]);

  const toggleTracking = useCallback(async () => {
    if (isTracking) {
      await stopTracking();
    } else {
      await startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  useEffect(() => {
    requestPermissions();

    return () => {
      stopTracking();
    };
  }, [requestPermissions, stopTracking]);

  return {
    currentLocation,
    expectedRoute,
    geofenceState,
    statusText,
    isTracking,
    isLoadingPermission,
    permissionError,
    error,
    startTracking,
    stopTracking,
    toggleTracking,
    refreshPermissions: requestPermissions,
  };
}
