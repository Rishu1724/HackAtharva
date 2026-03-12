import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import * as Location from 'expo-location';
import { auth, db, rtdb } from '../../config/firebase';
import { ref, onValue, set } from 'firebase/database';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import DriverNotificationService from '../../services/DriverNotificationService';

export default function DriverRealtimeScreen() {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [stats, setStats] = useState({ trips: 0, passengers: 0, alerts: 0 });
  const lastTripStatusRef = useRef({});
  const lastAlertIdRef = useRef(null);
  const lastSpeedAlertRef = useRef(0);
  const locationSubRef = useRef(null);

  useEffect(() => {
    let unsubVehicle = () => {};
    let unsubTrips = () => {};
    let unsubAlerts = () => {};

    const driverId = auth.currentUser?.uid;
    if (!driverId) return;

    DriverNotificationService.initializeDriverNotifications(driverId);

    const rtdbVehicleRef = ref(rtdb, `vehicles/${driverId}/number`);
    const rtdbLocationRef = ref(rtdb, `drivers/${driverId}/location`);

    const unsubVehicleRtdb = onValue(rtdbVehicleRef, (snap) => {
      const value = snap.val() || '';
      setVehicleNumber(value);
    });

    const unsubLocationRtdb = onValue(rtdbLocationRef, (snap) => {
      const data = snap.val();
      if (data?.lat && data?.lng) {
        setCurrentLocation({
          lat: data.lat,
          lng: data.lng,
          speed: data.speed ?? 0,
        });
      }
    });

    (async () => {
      const vehicleSnap = await getDoc(doc(db, 'vehicles', driverId));
      if (vehicleSnap.exists()) {
        const data = vehicleSnap.data();
        if (data?.number) {
          set(rtdbVehicleRef, data.number);
        }
      }
    })();

    const tripsQuery = query(
      collection(db, 'driverTrips'),
      where('driverId', '==', driverId)
    );
    unsubTrips = onSnapshot(tripsQuery, (snap) => {
      const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const activeTrips = trips.filter((t) => t.status === 'active');
      const passengers = activeTrips.reduce(
        (sum, t) => sum + (t.passengers || 0),
        0
      );

      setStats((prev) => ({
        ...prev,
        trips: activeTrips.length,
        passengers,
      }));

      trips.forEach((trip) => {
        const prevStatus = lastTripStatusRef.current[trip.id];
        if (prevStatus && prevStatus !== trip.status) {
          if (trip.status === 'active') {
            DriverNotificationService.notifyLocal(
              'Trip Started',
              `Trip ${trip.id} is now active.`
            );
          }
          if (trip.status === 'completed') {
            DriverNotificationService.notifyLocal(
              'Trip Completed',
              `Trip ${trip.id} ended successfully.`
            );
          }
        }
        lastTripStatusRef.current[trip.id] = trip.status;
      });
    });

    const alertsQuery = query(
      collection(db, 'geofenceAlerts'),
      where('driverId', '==', driverId)
    );
    unsubAlerts = onSnapshot(alertsQuery, (snap) => {
      setStats((prev) => ({ ...prev, alerts: snap.size }));
      const latest = snap.docs[snap.docs.length - 1];
      if (latest && latest.id !== lastAlertIdRef.current) {
        lastAlertIdRef.current = latest.id;
        const data = latest.data();
        DriverNotificationService.notifyLocal(
          'Route Deviation',
          `Deviation ${Math.round(data.distance || 0)}m from expected route.`
        );
      }
    });

    return () => {
      unsubVehicle();
      unsubVehicleRtdb();
      unsubLocationRtdb();
      unsubTrips();
      unsubAlerts();
    };
  }, []);

  useEffect(() => {
    if (!currentLocation?.speed) return;
    if (currentLocation.speed < 80) return;

    const now = Date.now();
    if (now - lastSpeedAlertRef.current < 20000) return;

    lastSpeedAlertRef.current = now;
    DriverNotificationService.notifyLocal(
      'Speed Alert',
      `Current speed is ${Math.round(currentLocation.speed)} km/h. Please slow down.`
    );
  }, [currentLocation]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is required.');
        return;
      }

      locationSubRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 0,
        },
        (loc) => {
          const live = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            speed: (loc.coords.speed || 0) * 3.6,
          };
          setCurrentLocation(live);
          const driverId = auth.currentUser?.uid;
          if (driverId) {
            set(ref(rtdb, `drivers/${driverId}/location`), {
              ...live,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      );
    })();

    return () => {
      if (locationSubRef.current) {
        locationSubRef.current.remove();
      }
    };
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Driver Device Location</Text>
          <Text style={styles.subText}>
            Vehicle Number: {vehicleNumber || 'Not set'}
          </Text>
          <Text style={styles.subText}>
            Lat: {currentLocation?.lat?.toFixed(6) || '—'}
          </Text>
          <Text style={styles.subText}>
            Lng: {currentLocation?.lng?.toFixed(6) || '—'}
          </Text>
          <Text style={styles.subText}>
            Speed: {Math.round(currentLocation?.speed || 0)} km/h
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Realtime Stats</Text>
          <View style={styles.chipRow}>
            <Chip icon="car">Active Trips: {stats.trips}</Chip>
            <Chip icon="account-group">Passengers: {stats.passengers}</Chip>
            <Chip icon="alert">Alerts: {stats.alerts}</Chip>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  subText: {
    marginTop: 6,
  },
  chipRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
