import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Alert } from 'react-native';
import { Card, Text, Button, Chip, TextInput } from 'react-native-paper';
import { CameraView, Camera } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { auth, db, rtdb } from '../../config/firebase';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { onValue, ref } from 'firebase/database';
import NotificationService from '../../services/NotificationService';
import { getBackendUrl } from '../../utils/backendUrl';

export default function DriverCctvScreen() {
  const [hasPermission, setHasPermission] = useState(null);
  const [status, setStatus] = useState('NORMAL');
  const [score, setScore] = useState(100);
  const [framesAnalyzed, setFramesAnalyzed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverId, setDriverId] = useState(null);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [accel, setAccel] = useState(0);
  const [lastAction, setLastAction] = useState('Monitoring idle');
  const cameraRef = useRef(null);
  const driverIdRef = useRef(null);
  const intervalRef = useRef(null);
  const isBusyRef = useRef(false);
  const lastAlertRef = useRef(0);
  const badStreakRef = useRef(0);
  const lastSpeedRef = useRef(0);
  const lastSpeedTimeRef = useRef(0);
  const speedAlertRef = useRef(0);
  const brakeAlertRef = useRef(0);
  const locationUnsubRef = useRef(null);

  useEffect(() => {
    requestPermission();
    return () => stopCapture();
  }, []);

  const requestPermission = async () => {
    try {
      const { status: camStatus } = await Camera.requestCameraPermissionsAsync();
      const granted = camStatus === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (error) {
      console.error('Camera permission error:', error);
      setHasPermission(false);
      return false;
    }
  };

  const startCapture = async () => {
    if (isRunning) return;

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission Required', 'Allow camera permission to start CCTV.');
        return;
      }
    }

    const resolvedDriverId = driverId || (await resolveDriverId());
    if (!resolvedDriverId) {
      Alert.alert('Missing Vehicle', 'Enter a valid active vehicle number.');
      return;
    }

    driverIdRef.current = resolvedDriverId;
    setDriverId(resolvedDriverId);
    startDriverLocationStream(resolvedDriverId);
    setIsRunning(true);
    intervalRef.current = setInterval(captureFrame, 1000);
  };

  const stopCapture = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (locationUnsubRef.current) {
      locationUnsubRef.current();
      locationUnsubRef.current = null;
    }
    driverIdRef.current = null;
    setIsRunning(false);
  };

  const resolveDriverId = async () => {
    if (!vehicleNumber.trim()) return null;
    try {
      const normalized = vehicleNumber.trim().toUpperCase();
      const candidates = [normalized, vehicleNumber.trim(), vehicleNumber.trim().toLowerCase()];

      for (const candidate of candidates) {
        const activeQuery = query(
          collection(db, 'vehicles'),
          where('number', '==', candidate),
          where('status', '==', 'active')
        );
        const activeSnap = await getDocs(activeQuery);
        if (!activeSnap.empty) {
          const vehicleDoc = activeSnap.docs[0];
          const data = vehicleDoc.data();
          return data.driverId || vehicleDoc.id;
        }
      }

      for (const candidate of candidates) {
        const anyStatusQuery = query(collection(db, 'vehicles'), where('number', '==', candidate));
        const anyStatusSnap = await getDocs(anyStatusQuery);
        if (!anyStatusSnap.empty) {
          const vehicleDoc = anyStatusSnap.docs[0];
          const data = vehicleDoc.data();
          return data.driverId || vehicleDoc.id;
        }
      }

      return null;
    } catch (error) {
      console.error('Vehicle lookup failed:', error);
      return null;
    }
  };

  const startDriverLocationStream = (id) => {
    if (!id) return;
    if (locationUnsubRef.current) {
      locationUnsubRef.current();
    }

    const locationRef = ref(rtdb, `drivers/${id}/location`);
    locationUnsubRef.current = onValue(locationRef, (snap) => {
      const data = snap.val();
      if (!data || typeof data.speed !== 'number') return;

      const now = Date.now();
      const speed = data.speed;
      setSpeedKmh(speed);

      if (lastSpeedTimeRef.current) {
        const deltaSeconds = (now - lastSpeedTimeRef.current) / 1000;
        if (deltaSeconds > 0) {
          const accelValue = (speed - lastSpeedRef.current) / deltaSeconds;
          setAccel(accelValue);
          checkDrivingEvents(speed, accelValue);
        }
      }

      lastSpeedRef.current = speed;
      lastSpeedTimeRef.current = now;
    });
  };

  const captureFrame = async () => {
    if (!cameraRef.current || isBusyRef.current) return;

    const backendUrl = getBackendUrl();
    if (!backendUrl) return;

    try {
      isBusyRef.current = true;
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.2,
        skipProcessing: true,
      });

      if (!photo?.base64) {
        isBusyRef.current = false;
        return;
      }

      const driverKey = driverIdRef.current || driverId || auth.currentUser?.uid || 'cctv-device';
      const imagePayload = photo.base64.startsWith('data:image/')
        ? photo.base64
        : `data:image/jpg;base64,${photo.base64}`;
      const response = await fetch(`${backendUrl}/ai/analyze-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: driverKey,
          imageBase64: photo.base64,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Analyze failed: ${response.status}`);
      }

      const data = await response.json();
      const nextStatus = data?.flag || 'NORMAL';
      const actionMessage = data?.action || 'Continue normal monitoring';
      const severityLevel = data?.severity || 'LOW';
      setStatus(nextStatus);
      setLastAction(actionMessage);
      setFramesAnalyzed((prev) => prev + 1);

      // Store only the latest frame in Firestore to avoid large history.
      if (driverKey) {
        await setDoc(
          doc(db, 'driverFrames', driverKey),
          {
            driverId: driverKey,
            vehicleNumber: vehicleNumber.trim(),
            imageBase64: imagePayload,
            flag: nextStatus,
            action: actionMessage,
            severity: severityLevel,
            capturedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      if (nextStatus === 'DROWSY') {
        badStreakRef.current += 1;
        setScore((prev) => Math.max(0, prev - 8));
      } else if (nextStatus === 'DISTRACTED') {
        badStreakRef.current += 1;
        setScore((prev) => Math.max(0, prev - 5));
      } else {
        badStreakRef.current = 0;
        setScore((prev) => Math.min(100, prev + 2));
      }

      await maybeSendAlert(nextStatus, actionMessage, severityLevel, driverKey);
    } catch (error) {
      console.error('Frame capture error:', error);
    } finally {
      isBusyRef.current = false;
    }
  };

  const maybeSendAlert = async (flag, actionMessage, severityLevel, driverKey) => {
    if (flag === 'NORMAL' || !driverKey) return;

    const now = Date.now();
    const throttleWindow = severityLevel === 'HIGH' ? 4000 : 10000;
    if (now - lastAlertRef.current < throttleWindow) return;
    lastAlertRef.current = now;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: severityLevel === 'HIGH' ? '🚨 Driver Emergency' : '⚠️ Driver Alert',
        body: actionMessage,
        sound: true,
      },
      trigger: null,
    });

    try {
      await NotificationService.recordDriverIncident(
        driverKey,
        vehicleNumber.trim(),
        flag,
        actionMessage,
        severityLevel
      );
    } catch (notifyError) {
      console.error('Failed to record driver incident:', notifyError);
    }
  };

  const checkDrivingEvents = async (speed, accelValue) => {
    const now = Date.now();

    if (speed > 80 && now - speedAlertRef.current > 15000) {
      speedAlertRef.current = now;
      if (driverIdRef.current || driverId) {
        await NotificationService.notifyPassengersForDriver(
          driverIdRef.current || driverId,
          '⚠️ Over Speed Alert',
          `Driver speed is ${Math.round(speed)} km/h.`
        );
      }
    }

    if (accelValue < -8 && now - brakeAlertRef.current > 15000) {
      brakeAlertRef.current = now;
      if (driverIdRef.current || driverId) {
        await NotificationService.notifyPassengersForDriver(
          driverIdRef.current || driverId,
          '⚠️ Sudden Brake Alert',
          'Driver applied sudden braking. Please stay alert.'
        );
      }
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.centered}>
        <Text>Live CCTV is available on Android/iOS only.</Text>
      </View>
    );
  }

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Text>Camera permission denied.</Text>
        <Button mode="contained" onPress={requestPermission} style={styles.button}>
          Retry Permission
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="front" />

      <View style={styles.overlay}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium">Driver CCTV Monitoring</Text>
            <TextInput
              label="Vehicle Number"
              value={vehicleNumber}
              onChangeText={(value) => setVehicleNumber(value.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />
            <Text style={styles.detail}>Driver ID: {driverId || '—'}</Text>
            <Text style={styles.detail}>Status: {status}</Text>
            <Text style={styles.detail}>Score: {score}</Text>
            <Text style={styles.detail}>Frames: {framesAnalyzed}</Text>
            <Text style={styles.detail}>Speed: {Math.round(speedKmh)} km/h</Text>
            <Text style={styles.detail}>Accel: {accel.toFixed(1)} km/h/s</Text>
            <Text style={styles.detail}>Action: {lastAction}</Text>
            <View style={styles.chips}>
              <Chip icon={isRunning ? 'pause' : 'play'}>
                {isRunning ? 'Streaming' : 'Stopped'}
              </Chip>
            </View>
            <View style={styles.actions}>
              <Button mode="contained" onPress={startCapture} disabled={isRunning}>
                Start CCTV
              </Button>
              <Button mode="outlined" onPress={stopCapture} disabled={!isRunning}>
                Stop
              </Button>
            </View>
          </Card.Content>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  detail: {
    marginTop: 6,
  },
  chips: {
    marginTop: 12,
    flexDirection: 'row',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  input: {
    marginTop: 12,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  button: {
    marginTop: 16,
  },
});
