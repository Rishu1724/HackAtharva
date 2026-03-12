import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Chip, Button, Divider, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';

export default function AdminDashboard({ navigation }) {
  const [stats, setStats] = useState({
    activeTrips: 0,
    activeVehicles: 0,
    sosAlerts: 0,
    totalPassengers: 0,
  });
  const [activeTrips, setActiveTrips] = useState([]);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    
    // Real-time listener for SOS alerts
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'sosAlerts'),
        where('status', '==', 'active'),
        orderBy('timestamp', 'desc')
      ),
      (snapshot) => {
        const alerts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSosAlerts(alerts);
      }
    );

    return () => unsubscribe();
  }, []);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      // Fetch active trips
      const tripsQuery = query(
        collection(db, 'trips'),
        where('status', '==', 'active'),
        orderBy('startTime', 'desc'),
        limit(10)
      );
      const tripsSnapshot = await getDocs(tripsQuery);
      const trips = tripsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setActiveTrips(trips);

      // Fetch active vehicles
      const vehiclesQuery = query(
        collection(db, 'vehicles'),
        where('status', '==', 'active')
      );
      const vehiclesSnapshot = await getDocs(vehiclesQuery);

      // Fetch SOS alerts
      const sosQuery = query(
        collection(db, 'sosAlerts'),
        where('status', '==', 'active'),
        orderBy('timestamp', 'desc')
      );
      const sosSnapshot = await getDocs(sosQuery);
      const sosList = sosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSosAlerts(sosList);

      // Fetch recent alerts (all types)
      const alertsQuery = query(
        collection(db, 'notifications'),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const alertsSnapshot = await getDocs(alertsQuery);
      const alerts = alertsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecentAlerts(alerts);

      // Update stats
      setStats({
        activeTrips: trips.length,
        activeVehicles: vehiclesSnapshot.size,
        sosAlerts: sosList.length,
        totalPassengers: trips.length,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchDashboardData} />
        }
      >
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.header}>
              <View>
                <Text variant="headlineSmall">Admin Dashboard</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>
                  Real-time Safety Monitoring
                </Text>
              </View>
              <MaterialCommunityIcons name="shield-account" size={48} color="#6200ee" />
            </View>
          </Card.Content>
        </Card>

        {/* Stats Overview */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Live Statistics
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <MaterialCommunityIcons name="map-marker-path" size={32} color="#6200ee" />
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.activeTrips}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Active Trips
                </Text>
              </View>
              <View style={styles.statBox}>
                <MaterialCommunityIcons name="bus" size={32} color="#6200ee" />
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.activeVehicles}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Active Vehicles
                </Text>
              </View>
              <View style={[styles.statBox, styles.sosBox]}>
                <MaterialCommunityIcons name="alert-circle" size={32} color="#f44336" />
                <Text variant="headlineMedium" style={[styles.statValue, styles.sosValue]}>
                  {stats.sosAlerts}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  SOS Alerts
                </Text>
              </View>
              <View style={styles.statBox}>
                <MaterialCommunityIcons name="account-group" size={32} color="#6200ee" />
                <Text variant="headlineMedium" style={styles.statValue}>
                  {stats.totalPassengers}
                </Text>
                <Text variant="bodySmall" style={styles.statLabel}>
                  Passengers
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* SOS Alerts (Critical) */}
        {sosAlerts.length > 0 && (
          <Card style={[styles.card, styles.sosCard]}>
            <Card.Content>
              <View style={styles.sosHeader}>
                <MaterialCommunityIcons name="alert" size={24} color="#f44336" />
                <Text variant="titleMedium" style={styles.sosSectionTitle}>
                  🚨 ACTIVE SOS ALERTS
                </Text>
              </View>
              {sosAlerts.map((alert) => (
                <View key={alert.id} style={styles.sosAlertItem}>
                  <View style={styles.alertInfo}>
                    <Text variant="titleSmall" style={styles.alertTitle}>
                      Emergency Alert
                    </Text>
                    <Text variant="bodySmall" style={styles.alertDetail}>
                      Type: {alert.type} • {new Date(alert.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text variant="bodySmall" style={styles.alertDetail}>
                      Location: {alert.location?.latitude.toFixed(4)}, {alert.location?.longitude.toFixed(4)}
                    </Text>
                  </View>
                  <Button mode="contained" buttonColor="#f44336" compact>
                    Respond
                  </Button>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Active Trips */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Active Trips ({activeTrips.length})
            </Text>
            {activeTrips.length > 0 ? (
              activeTrips.map((trip) => (
                <View key={trip.id} style={styles.tripItem}>
                  <MaterialCommunityIcons name="map-marker" size={24} color="#6200ee" />
                  <View style={styles.tripInfo}>
                    <Text variant="bodyMedium">
                      Trip #{trip.id.substring(0, 8)}
                    </Text>
                    <Text variant="bodySmall" style={styles.tripDetail}>
                      Started: {new Date(trip.startTime).toLocaleTimeString()}
                    </Text>
                  </View>
                  <Chip style={styles.activeChip}>Active</Chip>
                </View>
              ))
            ) : (
              <Text variant="bodySmall" style={styles.emptyText}>
                No active trips at the moment
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Recent Alerts */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent Alerts & Notifications
            </Text>
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert) => (
                <View key={alert.id} style={styles.alertItem}>
                  <MaterialCommunityIcons
                    name={
                      alert.type === 'sos'
                        ? 'alert-circle'
                        : alert.type === 'route_deviation'
                        ? 'map-marker-alert'
                        : alert.type === 'speed'
                        ? 'speedometer-slow'
                        : 'information'
                    }
                    size={20}
                    color={alert.type === 'sos' ? '#f44336' : '#FF9800'}
                  />
                  <View style={styles.alertContent}>
                    <Text variant="bodySmall">{alert.message}</Text>
                    <Text variant="bodySmall" style={styles.alertTime}>
                      {new Date(alert.timestamp).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text variant="bodySmall" style={styles.emptyText}>
                No recent alerts
              </Text>
            )}
          </Card.Content>
        </Card>

        {/* Management Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Management
            </Text>
            <Button
              mode="outlined"
              icon="car-multiple"
              style={styles.actionButton}
            >
              Manage Vehicles
            </Button>
            <Button
              mode="outlined"
              icon="account-multiple"
              style={styles.actionButton}
            >
              Manage Drivers
            </Button>
            <Button
              mode="outlined"
              icon="map-marker-path"
              style={styles.actionButton}
            >
              Route Management
            </Button>
            <Button
              mode="outlined"
              icon="chart-box"
              style={styles.actionButton}
            >
              Analytics & Reports
            </Button>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          icon="logout"
          onPress={handleLogout}
          style={styles.logoutButton}
          buttonColor="#6200ee"
        >
          Logout
        </Button>
      </ScrollView>

      <FAB
        icon="refresh"
        style={styles.fab}
        onPress={fetchDashboardData}
        label="Refresh"
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
  subtitle: {
    color: '#666',
    marginTop: 4,
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  sosCard: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  sosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  sosSectionTitle: {
    marginLeft: 8,
    fontWeight: 'bold',
    color: '#f44336',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  sosBox: {
    backgroundColor: '#FFEBEE',
  },
  statValue: {
    color: '#6200ee',
    fontWeight: 'bold',
    marginTop: 8,
  },
  sosValue: {
    color: '#f44336',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  sosAlertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  alertDetail: {
    color: '#666',
    marginTop: 2,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tripInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tripDetail: {
    color: '#666',
    marginTop: 2,
  },
  activeChip: {
    backgroundColor: '#E8F5E9',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 16,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertTime: {
    color: '#999',
    marginTop: 4,
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    margin: 16,
    marginBottom: 80,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee',
  },
});
