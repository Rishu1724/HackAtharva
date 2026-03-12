import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { RoutePoint } from './useGeofence';

type DriverLocationMapProps = {
  latitude: number;
  longitude: number;
  route: RoutePoint[];
};

export default function DriverLocationMap({ latitude, longitude, route }: DriverLocationMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      followsUserLocation
      showsMyLocationButton
      showsUserLocation
    >
      <Marker coordinate={{ latitude, longitude }} title="Driver" />
      {route.length > 1 && (
        <Polyline
          coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
          strokeColor="#1B5E20"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
