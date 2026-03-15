import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function DriverProfileScreen() {
  const [driverData, setDriverData] = useState(null);
  const [vehicleData, setVehicleData] = useState(null);
  const [safetyReports, setSafetyReports] = useState([]);
  const [behaviorStats, setBehaviorStats] = useState({
    sleeping: 0,
    distracted: 0,
    abusive: 0,
    totalViolations: 0,
  });
  const [loading, setLoading] = useState(true);
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

      // Fetch recent safety reports for list
      const recentReportsQuery = query(
        collection(db, 'safetyReports'),
        where('driverId', '==', auth.currentUser.uid),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const recentSnapshot = await getDocs(recentReportsQuery);
      const recent = recentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSafetyReports(recent);

      // Fetch ALL safety reports for stats aggregation
      const allReportsQuery = query(
        collection(db, 'safetyReports'),
        where('driverId', '==', auth.currentUser.uid)
      );
      const allSnapshot = await getDocs(allReportsQuery);
      
      const counts = {
        sleeping: 0,
        distracted: 0,
        abusive: 0,
        total: allSnapshot.size
      };

      allSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'SLEEPING') counts.sleeping++;
        else if (data.type === 'DISTRACTED') counts.distracted++;
        else if (data.type === 'ABUSIVE_GESTURE') counts.abusive++;
      });

      setBehaviorStats({
        sleeping: counts.sleeping,
        distracted: counts.distracted,
        abusive: counts.abusive,
        totalViolations: counts.total
      });
      
      // Calculate safety score based on total violations
      const score = Math.max(0, 100 - (counts.total * 5));
      setStats(prev => ({ ...prev, safetyScore: score }));

    } catch (error) {
      console.error('Error fetching driver data:', error);
    } finally {
      setLoading(false);
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

      {/* Driver Behavior Detailed Stats */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Driver Behavior (Historical)
          </Text>
          <View style={styles.behaviorStatsGrid}>
            <View style={[styles.behaviorStatItem, { borderLeftColor: '#C62828' }]}>
              <Text variant="labelSmall" style={styles.behaviorStatLabel}>SLEEPING DETECTED</Text>
              <Text variant="headlineSmall" style={[styles.behaviorStatValue, { color: '#C62828' }]}>
                {behaviorStats.sleeping}
              </Text>
              <Text variant="bodySmall" style={styles.behaviorStatUnit}>Times</Text>
            </View>
            
            <View style={[styles.behaviorStatItem, { borderLeftColor: '#f44336' }]}>
              <Text variant="labelSmall" style={styles.behaviorStatLabel}>ABUSIVE GESTURES</Text>
              <Text variant="headlineSmall" style={[styles.behaviorStatValue, { color: '#f44336' }]}>
                {behaviorStats.abusive}
              </Text>
              <Text variant="bodySmall" style={styles.behaviorStatUnit}>Times</Text>
            </View>
            
            <View style={[styles.behaviorStatItem, { borderLeftColor: '#FF9800' }]}>
              <Text variant="labelSmall" style={styles.behaviorStatLabel}>DISTRACTED DRIVING</Text>
              <Text variant="headlineSmall" style={[styles.behaviorStatValue, { color: '#FF9800' }]}>
                {behaviorStats.distracted}
              </Text>
              <Text variant="bodySmall" style={styles.behaviorStatUnit}>Times</Text>
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
            <MaterialCommunityIcons 
              name={stats.safetyScore > 80 ? "shield-check" : "shield-alert"} 
              size={64} 
              color={stats.safetyScore > 80 ? "#4CAF50" : "#f44336"} 
            />
            <View style={styles.safetyInfo}>
              <Text variant="displaySmall" style={[styles.scoreValue, { color: stats.safetyScore > 80 ? "#4CAF50" : "#f44336" }]}>
                {stats.safetyScore}%
              </Text>
              <Text variant="bodyMedium" style={styles.scoreLabel}>
                Safety Score
              </Text>
              <Text variant="bodySmall" style={styles.scoreDesc}>
                {stats.safetyScore > 80 ? 'Excellent driving behavior!' : 'Needs improvement in behavior.'}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Safety Reports */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Recent Safety Reports
          </Text>
          {safetyReports.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-decagram" size={48} color="#4CAF50" />
              <Text variant="bodyMedium">No safety violations recorded!</Text>
            </View>
          ) : (
            safetyReports.map((report) => (
              <View key={report.id} style={styles.reportItem}>
                <View style={styles.reportHeader}>
                  <Chip 
                    style={{ backgroundColor: report.type === 'ABUSIVE_GESTURE' ? '#f44336' : '#FF9800' }}
                    textStyle={{ color: '#fff' }}
                  >
                    {report.type}
                  </Chip>
                  <Text variant="bodySmall" style={styles.reportTime}>
                    {new Date(report.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.reportDetail}>
                  {report.detail}
                </Text>
                <Text variant="bodySmall" style={styles.reportVehicle}>
                  Vehicle: {report.vehicleNumber}
                </Text>
                
                {/* Granular AI Metrics */}
                {report.metrics && (
                  <View style={styles.metricsContainer}>
                    {report.metrics.eyeAspectRatio !== undefined && (
                      <Text variant="labelSmall" style={styles.metricText}>
                        EAR: {report.metrics.eyeAspectRatio} (Th: {report.metrics.eyeThreshold})
                      </Text>
                    )}
                    {report.metrics.isYawning && (
                      <Text variant="labelSmall" style={[styles.metricText, { color: '#FF9800' }]}>
                        Yawning Detected
                      </Text>
                    )}
                    {report.metrics.hasMiddleFinger && (
                      <Text variant="labelSmall" style={[styles.metricText, { color: '#f44336' }]}>
                        Abusive Gesture
                      </Text>
                    )}
                    {report.metrics.isHeadTurned && (
                      <Text variant="labelSmall" style={[styles.metricText, { color: '#F57C00' }]}>
                        Head Turned
                      </Text>
                    )}
                  </View>
                )}
                
                <Divider style={styles.reportDivider} />
              </View>
            ))
          )}
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
  behaviorStatsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  behaviorStatItem: {
    flex: 1,
    paddingLeft: 12,
    borderLeftWidth: 4,
    marginRight: 8,
  },
  behaviorStatLabel: {
    fontSize: 9,
    color: '#666',
    fontWeight: 'bold',
  },
  behaviorStatValue: {
    fontWeight: 'bold',
    marginVertical: 2,
  },
  behaviorStatUnit: {
    fontSize: 10,
    color: '#999',
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
    marginTop: 8,
    marginBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
    opacity: 0.6,
  },
  reportItem: {
    marginTop: 12,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTime: {
    color: '#666',
  },
  reportDetail: {
    color: '#333',
    marginBottom: 4,
  },
  reportVehicle: {
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reportDivider: {
    marginTop: 8,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  metricText: {
    color: '#666',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#ddd',
  },
});
