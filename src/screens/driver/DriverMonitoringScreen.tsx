import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, View, Image } from 'react-native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, Text, Chip, TextInput, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import CameraOverlay from '../../modules/CameraModule/CameraOverlay';
import { useCameraStream } from '../../modules/CameraModule/useCameraStream';
import DriverLocationMap from '../../modules/GPSModule';
import { useDriverLocation } from '../../modules/GPSModule/useDriverLocation';
import NotificationService from '../../services/NotificationService';
import { getBackendUrl } from '../../utils/backendUrl';

const BACKEND_URL = getBackendUrl();

export default function DriverMonitoringScreen() {
  const [facing, setFacing] = useState<CameraType>('front');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [useExternalCamera, setUseExternalCamera] = useState(false);
  const [externalFrame, setExternalFrame] = useState<any>(null);
  const lastAlertAtRef = useRef(0);

  const driverId = useMemo(() => auth.currentUser?.uid ?? 'demo-driver', []);

  const {
    cameraRef,
    flag,
    isStreaming,
    error: cameraError,
    toggleStream,
  } = useCameraStream({
    backendUrl: BACKEND_URL,
    driverId,
    vehicleNumber,
    intervalMs: 500,
  });

  const {
    currentLocation,
    expectedRoute,
    isTracking,
    isLoadingPermission,
    permissionError,
    error: gpsError,
    toggleTracking,
  } = useDriverLocation({
    backendUrl: BACKEND_URL,
    driverId,
  });

  const monitoringOn = (isStreaming || useExternalCamera) && isTracking;

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (useExternalCamera && monitoringOn && vehicleNumber) {
      const fetchFrame = async () => {
        try {
          const response = await fetch(`${BACKEND_URL}/ai/latest-frame/${vehicleNumber.trim().toUpperCase()}`);
          if (response.ok) {
            const data = await response.json();
            setExternalFrame(data);
          }
        } catch (err) {
          console.error('Fetch external frame error:', err);
        }
      };
      fetchFrame();
      interval = setInterval(fetchFrame, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [useExternalCamera, monitoringOn, vehicleNumber]);

  useEffect(() => {
    if (flag === 'NORMAL') {
      return;
    }

    const now = Date.now();
    if (now - lastAlertAtRef.current < 60000) {
      return;
    }

    lastAlertAtRef.current = now;
    NotificationService.notifyDriverAlert(driverId, flag);
  }, [driverId, flag]);

  const handleMonitoringToggle = async () => {
    try {
      if (!useExternalCamera && !cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission is required for monitoring.');
          return;
        }
      }

      if (monitoringOn) {
        if (isStreaming) await toggleStream();
        await toggleTracking();
      } else {
        if (!vehicleNumber.trim()) {
          Alert.alert('Vehicle Number Required', 'Please enter your Bus/Cab number before starting.');
          return;
        }
        if (!useExternalCamera && !isStreaming) {
          await toggleStream();
        }
        if (!isTracking) {
          await toggleTracking();
        }
      }
    } catch (err) {
      Alert.alert('Monitoring Error', err instanceof Error ? err.message : 'Unable to toggle monitoring');
    }
  };

  const currentFlag = useExternalCamera ? (externalFrame?.flag || 'NORMAL') : flag;

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Chip icon={monitoringOn ? 'check-circle' : 'close-circle'}>
          {monitoringOn ? 'Tracking ON' : 'Tracking OFF'}
        </Chip>
        <Chip icon="car-speed-limiter">Speed: {Math.round(currentLocation?.speedKmh ?? 0)} km/h</Chip>
        <Chip icon="shield-account">Flag: {currentFlag}</Chip>
      </View>

      <Card style={styles.vehicleCard}>
        <Card.Content>
          <TextInput
            label="Bus/Cab Number"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholder="e.g. KA-01-AB-1234"
            disabled={monitoringOn}
            style={styles.input}
          />
          <View style={styles.switchRow}>
            <Text>Use External Web Camera</Text>
            <Switch 
              value={useExternalCamera} 
              onValueChange={setUseExternalCamera}
              disabled={monitoringOn}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.topCard}>
        <Card.Title 
          title={useExternalCamera ? "External Bus Camera" : "Driver Camera"} 
          subtitle={useExternalCamera ? "Live feed from website" : "Frame sent every 1 second"} 
        />
        <View style={styles.cameraWrapper}>
          {useExternalCamera ? (
            externalFrame?.imageBase64 ? (
              <Image 
                source={{ uri: externalFrame.imageBase64 }} 
                style={styles.camera} 
                resizeMode="cover"
              />
            ) : (
              <View style={styles.permissionFallback}>
                <Text>Waiting for web stream from {vehicleNumber || '—'}</Text>
              </View>
            )
          ) : (
            cameraPermission?.granted ? (
              <CameraView
                ref={(ref) => {
                  cameraRef.current = ref;
                }}
                style={styles.camera}
                facing={facing}
              />
            ) : (
              <View style={styles.permissionFallback}>
                <Text>Camera permission is required.</Text>
                <Button mode="outlined" onPress={requestCameraPermission}>Grant Camera</Button>
              </View>
            )
          )}
          <CameraOverlay 
            flag={currentFlag} 
            isStreaming={monitoringOn} 
            error={cameraError} 
          />
        </View>

        {/* HIGH VISIBILITY DRIVER WARNING */}
        {(currentFlag === 'SLEEPING' || currentFlag === 'DISTRACTED' || currentFlag === 'ABUSIVE_GESTURE') && (
          <View style={[styles.driverWarningOverlay, { backgroundColor: currentFlag === 'SLEEPING' || currentFlag === 'ABUSIVE_GESTURE' ? '#D32F2F' : '#F57C00' }]}>
            <MaterialCommunityIcons 
              name={currentFlag === 'SLEEPING' ? 'alert-octagon' : (currentFlag === 'ABUSIVE_GESTURE' ? 'hand-back-left' : 'eye-off')} 
              size={48} 
              color="#fff" 
            />
            <Text style={styles.driverWarningTitle}>
              {currentFlag === 'SLEEPING' ? 'WAKE UP!' : (currentFlag === 'ABUSIVE_GESTURE' ? 'ABUSIVE BEHAVIOR!' : 'FOCUS ON ROAD!')}
            </Text>
            <Text style={styles.driverWarningSubtitle}>
              {currentFlag === 'SLEEPING' ? 'Drowsiness detected. Please pull over safely.' : (currentFlag === 'ABUSIVE_GESTURE' ? 'Offensive gesture detected and recorded.' : 'Eyes not on the road.')}
            </Text>
          </View>
        )}

        {!useExternalCamera && (
          <Card.Actions style={styles.actionRow}>
            <Button mode="outlined" onPress={() => setFacing((p) => (p === 'front' ? 'back' : 'front'))}>
              Toggle Camera
            </Button>
          </Card.Actions>
        )}
      </Card>

      <Card style={styles.bottomCard}>
        <Card.Title title="Driver GPS" subtitle="Live location updates every 2 seconds" />
        <Card.Content>
          {currentLocation ? (
            <DriverLocationMap
              latitude={currentLocation.lat}
              longitude={currentLocation.lng}
              route={expectedRoute}
            />
          ) : (
            <View style={styles.permissionFallback}>
              <Text>{isLoadingPermission ? 'Requesting location permission...' : 'Waiting for GPS signal...'}</Text>
            </View>
          )}
          {!!permissionError && <Text style={styles.errorText}>{permissionError}</Text>}
          {!!gpsError && <Text style={styles.errorText}>{gpsError}</Text>}
          {Platform.OS === 'web' && (
            <Text style={styles.webNote}>Web has limited background location support. Use phone for full tracking.</Text>
          )}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon={monitoringOn ? 'stop-circle' : 'play-circle'}
        onPress={handleMonitoringToggle}
        style={styles.monitorButton}
      >
        {monitoringOn ? 'Stop Monitoring' : 'Start Monitoring'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    gap: 10,
    backgroundColor: '#F7F8FC',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  vehicleCard: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  topCard: {
    flex: 1,
    minHeight: 280,
  },
  bottomCard: {
    flex: 1,
    minHeight: 280,
  },
  cameraWrapper: {
    height: 220,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  actionRow: {
    justifyContent: 'flex-end',
  },
  permissionFallback: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  monitorButton: {
    paddingVertical: 6,
  },
  errorText: {
    color: '#C62828',
    marginTop: 8,
  },
  webNote: {
    marginTop: 8,
    color: '#555',
    fontSize: 12,
  },
  driverWarningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
  },
  driverWarningTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
    textAlign: 'center',
  },
  driverWarningSubtitle: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
});
