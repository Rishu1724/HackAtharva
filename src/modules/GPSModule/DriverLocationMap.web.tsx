import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type DriverLocationMapProps = {
  latitude: number;
  longitude: number;
};

export default function DriverLocationMap({ latitude, longitude }: DriverLocationMapProps) {
  return (
    <View style={styles.container}>
      <Text variant="titleSmall">Live GPS Coordinates</Text>
      <Text style={styles.coords}>lat: {latitude.toFixed(6)}</Text>
      <Text style={styles.coords}>lng: {longitude.toFixed(6)}</Text>
      <Text style={styles.note}>Map rendering is native-only. Use phone for full map view.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 220,
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  coords: {
    marginTop: 4,
  },
  note: {
    marginTop: 12,
    color: '#555',
    textAlign: 'center',
  },
});
