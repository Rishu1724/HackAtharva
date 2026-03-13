import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function DriverTripMap({ location, routePath, tripActive }) {
  const region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: location.latitudeDelta ?? 0.01,
        longitudeDelta: location.longitudeDelta ?? 0.01,
      }
    : null;

  if (!region) {
    return null;
  }

  return (
    <MapView
      style={styles.map}
      region={region}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton
      followsUserLocation={tripActive}
    >
      {location && (
        <Marker
          coordinate={location}
          title="Your Vehicle"
          description="Current location"
        >
          <MaterialCommunityIcons name="bus" size={40} color="#6200ee" />
        </Marker>
      )}

      {routePath.length > 1 && (
        <Polyline
          coordinates={routePath}
          strokeColor="#6200ee"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
