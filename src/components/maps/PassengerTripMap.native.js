import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, Circle } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PassengerTripMap({
  location,
  vehicleLocation,
  routePath,
  routeOptions,
  selectedRouteIndex,
  tripActive,
}) {
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
          title="You"
          description="Your current location"
        >
          <MaterialCommunityIcons name="account-circle" size={40} color="#6200ee" />
        </Marker>
      )}

      {vehicleLocation && (
        <Marker
          coordinate={vehicleLocation}
          title="Vehicle"
          description="Current vehicle location"
        >
          <MaterialCommunityIcons name="bus" size={40} color="#f44336" />
        </Marker>
      )}

      {routeOptions?.length
        ? routeOptions.map((route, index) => (
            <Polyline
              key={`route-${index}`}
              coordinates={route}
              strokeColor={index === selectedRouteIndex ? '#1E88E5' : '#B0BEC5'}
              strokeWidth={index === selectedRouteIndex ? 5 : 3}
            />
          ))
        : routePath.length > 1 && (
            <Polyline
              coordinates={routePath}
              strokeColor="#6200ee"
              strokeWidth={4}
            />
          )}

      {tripActive && location && (
        <Circle
          center={location}
          radius={500}
          strokeColor="rgba(98, 0, 238, 0.5)"
          fillColor="rgba(98, 0, 238, 0.1)"
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
