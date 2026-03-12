import React, { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Button, Card, Text } from 'react-native-paper';
import CameraOverlay from './CameraOverlay';
import { useCameraStream } from './useCameraStream';

type CameraScreenProps = {
  backendUrl: string;
  driverId: string;
};

export default function CameraScreen({ backendUrl, driverId }: CameraScreenProps) {
  const [facing, setFacing] = useState<CameraType>('front');
  const [permission, requestPermission] = useCameraPermissions();

  const {
    cameraRef,
    flag,
    isStreaming,
    error,
    toggleStream,
    lastSentAt,
  } = useCameraStream({ backendUrl, driverId, intervalMs: 1000 });

  const permissionState = useMemo(() => {
    if (!permission) return 'loading';
    return permission.granted ? 'granted' : 'denied';
  }, [permission]);

  if (permissionState === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (permissionState === 'denied') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>Camera permission is required for monitoring.</Text>
        <Button mode="contained" onPress={requestPermission}>Grant Camera Access</Button>
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.cameraContainer}>
        <CameraView ref={(ref) => { cameraRef.current = ref; }} style={styles.camera} facing={facing} />
        <CameraOverlay flag={flag} isStreaming={isStreaming} error={error} />
      </View>

      <Card.Content style={styles.controls}>
        <Text variant="bodySmall">Last frame: {lastSentAt ? new Date(lastSentAt).toLocaleTimeString() : 'Not sent yet'}</Text>
        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            icon="camera-flip"
            onPress={() => setFacing((prev) => (prev === 'front' ? 'back' : 'front'))}
          >
            Toggle Camera
          </Button>
          <Button
            mode="contained"
            icon={isStreaming ? 'stop' : 'play'}
            onPress={async () => {
              try {
                await toggleStream();
              } catch (err) {
                Alert.alert('Camera Error', err instanceof Error ? err.message : 'Failed to start stream');
              }
            }}
          >
            {isStreaming ? 'Stop' : 'Start'}
          </Button>
        </View>
        {Platform.OS === 'web' && (
          <Text style={styles.webText}>Web camera permissions may require HTTPS in production.</Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  cameraContainer: {
    height: 260,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  controls: {
    gap: 10,
    paddingTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  webText: {
    color: '#666',
    fontSize: 12,
  },
});
