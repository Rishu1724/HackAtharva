import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Chip, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function DriverHomeScreen({ navigation }) {
  const [driverData, setDriverData] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [todayStats, setTodayStats] = useState({
    trips: 0,
    passengers: 0,
    distance: 0,
    rating: 5.0,
  });

  useEffect(() => {
    fetchDriverData();
    fetchTodayStats();
  }, []);

  const fetchDriverData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setDriverData(userDoc.data());
      }

      // Fetch or create vehicle data
      const vehicleDoc = await getDoc(doc(db, 'vehicles', auth.currentUser.uid));
      if (vehicleDoc.exists()) {
        setVehicleData(vehicleDoc.data());
        setIsOnline(vehicleDoc.data().status === 'active');
      } else {
        // Create default vehicle
        const defaultVehicle = {
          driverId: auth.currentUser.uid,
          number: 'MH-01-AB-1234',
          type: 'Bus',
          capacity: 40,
          route: 'Route 1',
          status: 'inactive',
        };
        await setDoc(doc(db, 'vehicles', auth.currentUser.uid), defaultVehicle);
        setVehicleData(defaultVehicle);
      }
    } catch (error) {
      console.error('Error fetching driver data:', error);
    }
  };

  const fetchTodayStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tripsQuery = query(
        collection(db, 'trips'),
        where('driverId', '==', auth.currentUser.uid),
        where('startTime', '>=', today.toISOString())
      );

      const tripsSnapshot = await getDocs(tripsQuery);
      
      let totalDistance = 0;
      tripsSnapshot.docs.forEach((doc) => {
        const trip = doc.data();
        if (trip.route && trip.route.length > 0) {
          totalDistance += trip.route.length * 0.01; // Approximate distance
        }
      });

      setTodayStats({
        trips: tripsSnapshot.size,
        passengers: tripsSnapshot.size * 2, // Approximate
        distance: Math.round(totalDistance),
        rating: 4.8,
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
                  {todayStats.rating}
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
              <Text variant="bodyMedium">{vehicleData?.type || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Capacity:
              </Text>
              <Text variant="bodyMedium">
                {vehicleData?.capacity || 0} passengers
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.infoLabel}>
                Route:
              </Text>
              <Text variant="bodyMedium">{vehicleData?.route || 'N/A'}</Text>
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
