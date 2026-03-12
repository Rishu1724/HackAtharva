import React, { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, Text, Chip } from 'react-native-paper';
import Constants from 'expo-constants';
import { auth } from '../../config/firebase';
import CameraOverlay from '../../modules/CameraModule/CameraOverlay';
import { useCameraStream } from '../../modules/CameraModule/useCameraStream';
import DriverLocationMap from '../../modules/GPSModule/DriverLocationMap';
import { useDriverLocation } from '../../modules/GPSModule/useDriverLocation';

const BACKEND_URL =
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) ??
  'http://10.0.2.2:8000';

export default function DriverMonitoringScreen() {
  const [facing, setFacing] = useState<CameraType>('front');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

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
    intervalMs: 1000,
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

  const monitoringOn = isStreaming && isTracking;

  const handleMonitoringToggle = async () => {
    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert('Permission Required', 'Camera permission is required for monitoring.');
          return;
        }
      }

      if (monitoringOn) {
        await toggleStream();
        await toggleTracking();
      } else {
        if (!isStreaming) {
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

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <Chip icon={monitoringOn ? 'check-circle' : 'close-circle'}>
          {monitoringOn ? 'Tracking ON' : 'Tracking OFF'}
        </Chip>
        <Chip icon="car-speed-limiter">Speed: {Math.round(currentLocation?.speedKmh ?? 0)} km/h</Chip>
        <Chip icon="shield-account">Flag: {flag}</Chip>
      </View>

      <Card style={styles.topCard}>
        <Card.Title title="Driver Camera" subtitle="Frame sent every 1 second" />
        <View style={styles.cameraWrapper}>
          {cameraPermission?.granted ? (
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
          )}
          <CameraOverlay flag={flag} isStreaming={isStreaming} error={cameraError} />
        </View>
        <Card.Actions style={styles.actionRow}>
          <Button mode="outlined" onPress={() => setFacing((p) => (p === 'front' ? 'back' : 'front'))}>
            Toggle Camera
          </Button>
        </Card.Actions>
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
});
