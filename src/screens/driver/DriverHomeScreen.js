import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Chip, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { onValue, ref } from 'firebase/database';
import { auth, db, rtdb } from '../../config/firebase';

export default function DriverHomeScreen({ navigation }) {
  const [driverData, setDriverData] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [todayStats, setTodayStats] = useState({
    trips: 0,
    passengers: 0,
    distance: 0,
  });

  useEffect(() => {
    let cleanup = () => {};

    (async () => {
      const result = await fetchDriverData();
      if (typeof result === 'function') {
        cleanup = result;
      }
      await fetchTodayStats();
    })();

    return () => cleanup();
  }, []);

  const fetchDriverData = async () => {
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const vehicleRef = doc(db, 'vehicles', auth.currentUser.uid);

      const userUnsub = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          setDriverData(snap.data());
        }
      });

      const vehicleUnsub = onSnapshot(vehicleRef, async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setVehicleData(data);
          setIsOnline(data.status === 'active');
          return;
        }

        await setDoc(vehicleRef, {
          driverId: auth.currentUser.uid,
          number: '',
          type: 'bus',
          route: '',
          capacity: null,
          status: 'inactive',
          occupancy: 0,
          schedule: '',
          stops: [],
          cabQueue: 0,
          earningsToday: 0,
          ratingAvg: null,
          safetyScore: null,
          createdAt: new Date().toISOString(),
        });
      });

      const locationRef = ref(rtdb, `drivers/${auth.currentUser.uid}/location`);
      const locationUnsub = onValue(locationRef, (snap) => {
        const data = snap.val();
        if (data?.lat && data?.lng) {
          setLiveLocation(data);
        }
      });

      const alertsQuery = query(
        collection(db, 'geofenceAlerts'),
        where('driverId', '==', auth.currentUser.uid)
      );
      const alertsUnsub = onSnapshot(alertsQuery, (snap) => {
        setAlertsCount(snap.size);
      });

      return () => {
        userUnsub();
        vehicleUnsub();
        locationUnsub();
        alertsUnsub();
      };
    } catch (error) {
      console.error('Error fetching driver data:', error);
    }
  };

  const fetchTodayStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tripsQuery = query(
        collection(db, 'driverTrips'),
        where('driverId', '==', auth.currentUser.uid),
        where('startTime', '>=', today.toISOString())
      );

      const tripsSnapshot = await getDocs(tripsQuery);

      let totalDistance = 0;
      let totalPassengers = 0;
      tripsSnapshot.docs.forEach((docSnap) => {
        const trip = docSnap.data();
        totalDistance += Number(trip.totalDistance || 0);
        totalPassengers += Number(trip.passengers || 0);
      });

      setTodayStats({
        trips: tripsSnapshot.size,
        passengers: totalPassengers,
        distance: Math.round(totalDistance),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleOnlineStatus = async () => {
    try {
      const newStatus = isOnline ? 'inactive' : 'active';
      
      await setDoc(
        doc(db, 'vehicles', auth.currentUser.uid),
        { status: newStatus },
        { merge: true }
      );

      setIsOnline(!isOnline);
      
      Alert.alert(
        'Status Updated',
        `You are now ${newStatus === 'active' ? 'ONLINE' : 'OFFLINE'}`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const vehicleType = vehicleData?.type || 'bus';
  const ratingText =
    typeof vehicleData?.ratingAvg === 'number'
      ? vehicleData.ratingAvg.toFixed(1)
      : '—';
  const safetyText =
    typeof vehicleData?.safetyScore === 'number'
      ? `${Math.round(vehicleData.safetyScore)}%`
      : '—';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.header}>
              <View>
                <Text variant="headlineSmall">
                  {driverData?.name || 'Driver'}
                </Text>
                <Text variant="bodyMedium" style={styles.vehicleNumber}>
                  {vehicleData?.number || 'Vehicle'}
                </Text>
              </View>
              <Chip
                icon="circle"
                style={[
                  styles.statusChip,
                  isOnline ? styles.onlineChip : styles.offlineChip,
                ]}
                textStyle={styles.statusText}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Stats */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Today's Performance
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="road-variant" size={32} color="#6200ee" />
                <Text variant="headlineSmall" style={styles.statValue}>
                  {todayStats.trips}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Trips
                </Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="account-group" size={32} color="#6200ee" />
                <Text variant="headlineSmall" style={styles.statValue}>
                  {todayStats.passengers}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Passengers
                </Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="map-marker-distance" size={32} color="#6200ee" />
                <Text variant="headlineSmall" style={styles.statValue}>
                  {todayStats.distance}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Km
                </Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="star" size={32} color="#FFD700" />
                <Text variant="headlineSmall" style={styles.statValue}>
                  {ratingText}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Rating
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Vehicle Info */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Vehicle Information
            </Text>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Type:
              </Text>
              <Text variant="bodyMedium">{vehicleType}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Capacity:
              </Text>
              <Text variant="bodyMedium">
                {vehicleData?.capacity ?? '—'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Route:
              </Text>
              <Text variant="bodyMedium">{vehicleData?.route || '—'}</Text>
            </View>
          </Card.Content>
        </Card>

        {vehicleType === 'bus' ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Bus Operations
              </Text>
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.infoLabel}>
                  Occupancy:
                </Text>
                <Text variant="bodyMedium">{vehicleData?.occupancy ?? '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.infoLabel}>
                  Schedule:
                </Text>
                <Text variant="bodyMedium">{vehicleData?.schedule || '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.infoLabel}>
                  Stops:
                </Text>
                <Text variant="bodyMedium">
                  {Array.isArray(vehicleData?.stops) && vehicleData.stops.length
                    ? vehicleData.stops.join(', ')
                    : '—'}
                </Text>
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Cab Operations
              </Text>
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.infoLabel}>
                  Trip Queue:
                </Text>
                <Text variant="bodyMedium">{vehicleData?.cabQueue ?? '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.infoLabel}>
                  Earnings (Today):
                </Text>
                <Text variant="bodyMedium">{vehicleData?.earningsToday ?? '—'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text variant="bodyMedium" style={styles.infoLabel}>
                  Rating:
                </Text>
                <Text variant="bodyMedium">{ratingText}</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Safety & Live Status
            </Text>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Safety Score:
              </Text>
              <Text variant="bodyMedium">{safetyText}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Alerts:
              </Text>
              <Text variant="bodyMedium">{alertsCount}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Live Location:
              </Text>
              <Text variant="bodyMedium">
                {liveLocation?.lat && liveLocation?.lng
                  ? `${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)}`
                  : '—'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Speed:
              </Text>
              <Text variant="bodyMedium">
                {typeof liveLocation?.speed === 'number'
                  ? `${Math.round(liveLocation.speed)} km/h`
                  : '—'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Safety Features */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Safety Features Active
            </Text>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="map-marker-check" size={24} color="#4CAF50" />
              <Text variant="bodyMedium" style={styles.featureText}>
                Live GPS Tracking
              </Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="speedometer" size={24} color="#4CAF50" />
              <Text variant="bodyMedium" style={styles.featureText}>
                Speed Monitoring
              </Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="shield-check" size={24} color="#4CAF50" />
              <Text variant="bodyMedium" style={styles.featureText}>
                Behavior Analysis
              </Text>
            </View>
            <View style={styles.featureItem}>
              <MaterialCommunityIcons name="cctv" size={24} color="#4CAF50" />
              <Text variant="bodyMedium" style={styles.featureText}>
                Emergency Recording
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quick Actions
            </Text>
            <Button
              mode="outlined"
              icon="map-marker-path"
              onPress={() => navigation.navigate('DriverTrip')}
              style={styles.actionButton}
            >
              Start Trip
            </Button>
            <Button
              mode="outlined"
              icon="history"
              style={styles.actionButton}
            >
              View Trip History
            </Button>
            <Button
              mode="outlined"
              icon="chart-bar"
              style={styles.actionButton}
            >
              Performance Report
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Toggle Online/Offline FAB */}
      <FAB
        icon={isOnline ? 'pause' : 'play'}
        label={isOnline ? 'Go Offline' : 'Go Online'}
        onPress={toggleOnlineStatus}
        style={[
          styles.fab,
          isOnline ? styles.fabOnline : styles.fabOffline,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleNumber: {
    color: '#666',
    marginTop: 4,
  },
  statusChip: {
    height: 32,
  },
  onlineChip: {
    backgroundColor: '#E8F5E9',
  },
  offlineChip: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontWeight: 'bold',
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
  },
  statValue: {
    color: '#6200ee',
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontWeight: 'bold',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureText: {
    marginLeft: 12,
  },
  actionButton: {
    marginBottom: 12,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  fabOnline: {
    backgroundColor: '#FF9800',
  },
  fabOffline: {
    backgroundColor: '#4CAF50',
  },
});
