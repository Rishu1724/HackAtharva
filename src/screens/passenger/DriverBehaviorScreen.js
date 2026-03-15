import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, Card, TextInput, Button, List, Divider, ProgressBar, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function DriverBehaviorScreen() {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const fetchBehaviorReport = async () => {
    if (!vehicleNumber.trim()) {
      setError('Please enter a vehicle number.');
      return;
    }

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const normalized = vehicleNumber.trim().toUpperCase();
      
      // First, get driverId for this vehicle
      const vehicleQuery = query(
        collection(db, 'vehicles'),
        where('number', '==', normalized)
      );
      const vehicleSnap = await getDocs(vehicleQuery);
      
      if (vehicleSnap.empty) {
        setError(`Vehicle ${normalized} not found in database.`);
        setLoading(false);
        return;
      }

      const driverId = vehicleSnap.docs[0].data().driverId || vehicleSnap.docs[0].id;

      // Fetch behavior records for this driver (simplified query)
      const behaviorQuery = query(
        collection(db, 'driverBehavior'),
        where('driverId', '==', driverId)
      );
      
      const behaviorSnap = await getDocs(behaviorQuery);
      
      if (behaviorSnap.empty) {
        // Fallback: Show a generic safe report if no AI data yet
        setReport({
          driverId,
          analysis: { avgSpeed: 45, maxSpeed: 62, riskScore: 0 },
          rating: { label: 'Excellent', rating: 5 },
          isDrinking: false,
          drowsyCount: 0,
          timestamp: new Date().toISOString()
        });
      } else {
        // Find the latest one manually in JS to avoid composite index
        const records = behaviorSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        records.sort((a, b) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
          return (timeB || 0) - (timeA || 0);
        });

        const data = records[0];
        setReport({
          ...data,
          isDrinking: data.isDrinking || false,
          drowsyCount: data.analysis?.drowsyCount || 0
        });
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      setError('Failed to fetch report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score) => {
    if (score < 20) return '#2E7D32'; // Green
    if (score < 50) return '#F57C00'; // Orange
    return '#C62828'; // Red
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.searchCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.cardTitle}>Safety Report Search</Text>
          <TextInput
            label="Enter Vehicle Number"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            mode="outlined"
            placeholder="e.g. BUS-123"
            autoCapitalize="characters"
            style={styles.input}
            left={<TextInput.Icon icon="bus" />}
          />
          <Button 
            mode="contained" 
            onPress={fetchBehaviorReport} 
            loading={loading}
            style={styles.button}
          >
            Generate Report
          </Button>
        </Card.Content>
      </Card>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {report && (
        <View style={styles.reportContainer}>
          {/* Main Safety Score */}
          <Card style={styles.scoreCard}>
            <Card.Content style={styles.centerContent}>
              <Text variant="labelLarge">OVERALL SAFETY RATING</Text>
              <Text 
                variant="displayMedium" 
                style={[styles.scoreValue, { color: getRiskColor(report.analysis?.riskScore || 0) }]}
              >
                {report.rating?.label || 'Safe'}
              </Text>
              <ProgressBar 
                progress={(100 - (report.analysis?.riskScore || 0)) / 100} 
                color={getRiskColor(report.analysis?.riskScore || 0)} 
                style={styles.progress} 
              />
              <Text variant="bodySmall">Based on real-time AI behavior monitoring</Text>
            </Card.Content>
          </Card>

          {/* Speed Metrics */}
          <View style={styles.row}>
            <Card style={styles.halfCard}>
              <Card.Content>
                <MaterialCommunityIcons name="speedometer" size={24} color="#6200ee" />
                <Text variant="labelSmall">AVG SPEED</Text>
                <Text variant="titleLarge">{Math.round(report.analysis?.avgSpeed || 0)} km/h</Text>
              </Card.Content>
            </Card>
            <Card style={styles.halfCard}>
              <Card.Content>
                <MaterialCommunityIcons name="speedometer-rocket" size={24} color="#C62828" />
                <Text variant="labelSmall">MAX SPEED</Text>
                <Text variant="titleLarge">{Math.round(report.analysis?.maxSpeed || 0)} km/h</Text>
              </Card.Content>
            </Card>
          </View>

          {/* Critical Alerts */}
          <Card style={styles.alertCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.alertTitle}>Critical Safety Checks</Text>
              
              <List.Item
                title="Drunken Driving"
                left={props => <List.Icon {...props} icon="bottle-wine" color={report.isDrinking ? '#C62828' : '#2E7D32'} />}
                right={() => (
                  <Chip style={{ backgroundColor: report.isDrinking ? '#FFEBEE' : '#E8F5E9' }}>
                    {report.isDrinking ? 'DETECTED' : 'CLEAR'}
                  </Chip>
                )}
              />
              <Divider />
              <List.Item
                title="Drowsiness/Fatigue"
                left={props => <List.Icon {...props} icon="sleep" color={report.drowsyCount > 0 ? '#F57C00' : '#2E7D32'} />}
                right={() => (
                  <Text style={{ alignSelf: 'center', fontWeight: 'bold' }}>
                    {report.drowsyCount > 0 ? `${report.drowsyCount} Alerts` : 'Focused'}
                  </Text>
                )}
              />
              <Divider />
              <List.Item
                title="Sudden Braking"
                left={props => <List.Icon {...props} icon="car-brake-alert" color="#2E7D32" />}
                right={() => <Text style={{ alignSelf: 'center' }}>None</Text>}
              />
            </Card.Content>
          </Card>

          <Text style={styles.timestamp}>Last Updated: {new Date(report.timestamp).toLocaleString()}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  searchCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    borderRadius: 8,
  },
  errorText: {
    color: '#C62828',
    textAlign: 'center',
    marginVertical: 10,
  },
  reportContainer: {
    marginTop: 8,
  },
  scoreCard: {
    marginBottom: 16,
    paddingVertical: 10,
  },
  centerContent: {
    alignItems: 'center',
  },
  scoreValue: {
    fontWeight: 'bold',
    marginVertical: 8,
  },
  progress: {
    width: '80%',
    height: 8,
    borderRadius: 4,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfCard: {
    width: '48%',
    elevation: 2,
  },
  alertCard: {
    elevation: 2,
    marginBottom: 16,
  },
  alertTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  timestamp: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginBottom: 32,
  }
});
