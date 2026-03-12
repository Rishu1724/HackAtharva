import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import type { DriverFlag } from './useCameraStream';

type CameraOverlayProps = {
  flag: DriverFlag;
  isStreaming: boolean;
  error?: string | null;
};

const flagColorMap: Record<DriverFlag, string> = {
  NORMAL: '#2E7D32',
  DROWSY: '#F57C00',
  DISTRACTED: '#C62828',
};

export default function CameraOverlay({ flag, isStreaming, error }: CameraOverlayProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      <Chip
        icon={isStreaming ? 'video' : 'video-off'}
        style={[styles.statusChip, { backgroundColor: flagColorMap[flag] }]}
        textStyle={styles.statusText}
      >
        {flag}
      </Chip>
      {!!error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontWeight: '700',
  },
  errorText: {
    marginTop: 8,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
