import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function DriverProfileScreen() {
  const [driverData, setDriverData] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalDistance: 0,
    totalPassengers: 0,
    rating: 4.8,
    safetyScore: 95,
  });

  useEffect(() => {
    fetchDriverData();
  }, []);

  const fetchDriverData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setDriverData(userDoc.data());
      }

      const vehicleDoc = await getDoc(doc(db, 'vehicles', auth.currentUser.uid));
      if (vehicleDoc.exists()) {
        setVehicleData(vehicleDoc.data());
      }
    } catch (error) {
      console.error('Error fetching driver data:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.profileHeader}>
            <MaterialCommunityIcons name="account-circle" size={80} color="#6200ee" />
            <View style={styles.profileInfo}>
              <Text variant="headlineSmall">{driverData?.name || 'Driver'}</Text>
              <Text variant="bodyMedium" style={styles.email}>
                {driverData?.email}
              </Text>
              <Text variant="bodySmall" style={styles.phone}>
                {driverData?.phone}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Vehicle Details */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Vehicle Details
          </Text>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="bus" size={24} color="#6200ee" />
            <View style={styles.detailContent}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Vehicle Number
              </Text>
              <Text variant="titleSmall">{vehicleData?.number || 'N/A'}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="car-info" size={24} color="#6200ee" />
            <View style={styles.detailContent}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Type & Capacity
              </Text>
              <Text variant="titleSmall">
                {vehicleData?.type || 'N/A'} • {vehicleData?.capacity || 0} passengers
              </Text>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="map-marker-path" size={24} color="#6200ee" />
            <View style={styles.detailContent}>
              <Text variant="bodyMedium" style={styles.detailLabel}>
                Route
              </Text>
              <Text variant="titleSmall">{vehicleData?.route || 'N/A'}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Performance Stats */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Overall Performance
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="road-variant" size={32} color="#6200ee" />
              <Text variant="headlineSmall" style={styles.statValue}>
                {stats.totalTrips}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Total Trips
              </Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="map-marker-distance" size={32} color="#6200ee" />
              <Text variant="headlineSmall" style={styles.statValue}>
                {stats.totalDistance}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Distance (km)
              </Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="account-group" size={32} color="#6200ee" />
              <Text variant="headlineSmall" style={styles.statValue}>
                {stats.totalPassengers}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Passengers
              </Text>
            </View>
            <View style={styles.statBox}>
              <MaterialCommunityIcons name="star" size={32} color="#FFD700" />
              <Text variant="headlineSmall" style={styles.statValue}>
                {stats.rating}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Rating
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Safety Score */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Safety Performance
          </Text>
          <View style={styles.safetyScore}>
            <MaterialCommunityIcons name="shield-check" size={64} color="#4CAF50" />
            <View style={styles.safetyInfo}>
              <Text variant="displaySmall" style={styles.scoreValue}>
                {stats.safetyScore}
              </Text>
              <Text variant="bodyMedium" style={styles.scoreLabel}>
                Safety Score
              </Text>
              <Text variant="bodySmall" style={styles.scoreDesc}>
                Excellent driving behavior!
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Button
            mode="outlined"
            icon="history"
            style={styles.actionButton}
          >
            Trip History
          </Button>
          <Button
            mode="outlined"
            icon="chart-line"
            style={styles.actionButton}
          >
            Performance Analytics
          </Button>
          <Button
            mode="outlined"
            icon="cog"
            style={styles.actionButton}
          >
            Settings
          </Button>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="logout"
        onPress={handleLogout}
        style={styles.logoutButton}
        buttonColor="#f44336"
      >
        Logout
      </Button>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  email: {
    color: '#666',
    marginTop: 4,
  },
  phone: {
    color: '#666',
    marginTop: 2,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    color: '#666',
    marginBottom: 4,
  },
  divider: {
    marginVertical: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
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
    textAlign: 'center',
  },
  safetyScore: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  safetyInfo: {
    flex: 1,
    marginLeft: 16,
    alignItems: 'center',
  },
  scoreValue: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  scoreLabel: {
    color: '#666',
    marginTop: 4,
  },
  scoreDesc: {
    color: '#666',
    marginTop: 4,
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    margin: 16,
    marginBottom: 32,
  },
});
