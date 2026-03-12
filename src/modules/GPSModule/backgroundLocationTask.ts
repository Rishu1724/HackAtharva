import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, set } from 'firebase/database';
import { rtdb } from '../../config/firebase';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';
const STORAGE_DRIVER_ID = '@driver_monitoring_driver_id';
const STORAGE_BACKEND_URL = '@driver_monitoring_backend_url';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }

  const taskData = data as { locations?: Location.LocationObject[] } | undefined;
  if (!taskData?.locations?.length) {
    return;
  }

  try {
    const [driverId, backendUrl] = await Promise.all([
      AsyncStorage.getItem(STORAGE_DRIVER_ID),
      AsyncStorage.getItem(STORAGE_BACKEND_URL),
    ]);

    if (!driverId || !backendUrl) {
      return;
    }

    await Promise.all(
      taskData.locations.map((loc) => {
        return fetch(`${backendUrl}/gps/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driverId,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            speed: loc.coords.speed ?? 0,
            timestamp: new Date().toISOString(),
            source: 'background',
          }),
        }).then(() =>
          set(ref(rtdb, `drivers/${driverId}/location`), {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            speed: loc.coords.speed ?? 0,
            source: 'background',
            updatedAt: new Date().toISOString(),
          })
        );
      })
    );
  } catch (err) {
    console.error('Failed to push background location:', err);
  }
});

export async function configureBackgroundTaskContext(driverId: string, backendUrl: string) {
  await Promise.all([
    AsyncStorage.setItem(STORAGE_DRIVER_ID, driverId),
    AsyncStorage.setItem(STORAGE_BACKEND_URL, backendUrl),
  ]);
}

export async function startBackgroundLocationTask() {
  if (Platform.OS === 'web') {
    return;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) {
    return;
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 2000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Driver GPS Tracking Active',
      notificationBody: 'Monitoring route in background',
    },
  });
}

export async function stopBackgroundLocationTask() {
  if (Platform.OS === 'web') {
    return;
  }

  const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
