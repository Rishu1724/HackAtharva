import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import DriverLocationMap from './DriverLocationMap';
import { useDriverLocation } from './useDriverLocation';

type DriverLocationScreenProps = {
  backendUrl: string;
  driverId: string;
};

export default function DriverLocationScreen({ backendUrl, driverId }: DriverLocationScreenProps) {
  const {
    currentLocation,
    expectedRoute,
    geofenceState,
    statusText,
    isTracking,
    isLoadingPermission,
    permissionError,
    error,
    toggleTracking,
    refreshPermissions,
  } = useDriverLocation({ backendUrl, driverId });

  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">Driver GPS Monitoring</Text>
        <Text style={styles.label}>Current: {statusText}</Text>
        {currentLocation ? (
          <>
            <Text style={styles.label}>Speed: {Math.round(currentLocation.speedKmh)} km/h</Text>
            <Text style={styles.label}>Route Deviation: {Math.round(geofenceState.distance)} m</Text>
          </>
        ) : null}

        {currentLocation ? (
          <DriverLocationMap
            latitude={currentLocation.lat}
            longitude={currentLocation.lng}
            route={expectedRoute}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text>Waiting for GPS signal...</Text>
          </View>
        )}

        {!!permissionError && (
          <Text style={styles.errorText}>{permissionError}</Text>
        )}
        {!!error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        <View style={styles.actions}>
          <Button mode="outlined" onPress={refreshPermissions} loading={isLoadingPermission}>
            Retry Permission
          </Button>
          <Button mode="contained" onPress={toggleTracking}>
            {isTracking ? 'Stop GPS' : 'Start GPS'}
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  label: {
    marginTop: 6,
    marginBottom: 2,
  },
  placeholder: {
    marginTop: 12,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#f4f4f4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#C62828',
    marginTop: 8,
  },
});
