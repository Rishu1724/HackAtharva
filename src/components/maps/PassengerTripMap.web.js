import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PassengerTripMap() {
  return (
    <View style={styles.mapFallback}>
      <MaterialCommunityIcons name="map" size={44} color="#6200ee" />
      <Text variant="titleSmall" style={styles.title}>
        Map preview is available on Android/iOS
      </Text>
      <Text variant="bodySmall" style={styles.text}>
        Live tracking still works on web. Use Expo Go for full map, geofence, and marker view.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mapFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#F4F1FF',
  },
  title: {
    marginTop: 12,
    fontWeight: '600',
  },
  text: {
    marginTop: 8,
    textAlign: 'center',
    color: '#555',
  },
});
