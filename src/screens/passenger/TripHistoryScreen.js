import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Text, Card, List, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';

export default function TripHistoryScreen() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTripHistory();
  }, []);

  const fetchTripHistory = async () => {
    try {
      // Simplified query to avoid composite index requirement
      const q = query(
        collection(db, 'trips'),
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const tripList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort manually in JS to avoid index requirement
      tripList.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
        return (timeB || 0) - (timeA || 0);
      });

      setTrips(tripList);
    } catch (error) {
      console.error('Error fetching trip history:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderTripItem = ({ item }) => {
    const date = item.timestamp?.toDate ? item.timestamp.toDate().toLocaleDateString() : 'Recent';
    const safetyScore = item.safetyScore || 100;

    return (
      <Card style={styles.tripCard}>
        <Card.Content>
          <View style={styles.tripHeader}>
            <View>
              <Text variant="titleMedium">{item.vehicleNumber || 'Unknown Vehicle'}</Text>
              <Text variant="labelSmall" style={styles.date}>{date}</Text>
            </View>
            <Chip 
              icon="shield-check" 
              style={{ backgroundColor: safetyScore > 80 ? '#E8F5E9' : safetyScore > 50 ? '#FFF3E0' : '#FFEBEE' }}
              textStyle={{ color: safetyScore > 80 ? '#2E7D32' : safetyScore > 50 ? '#F57C00' : '#C62828' }}
            >
              Safety: {safetyScore}%
            </Chip>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.routeInfo}>
            <List.Item
              title={item.source || 'Current Location'}
              left={props => <List.Icon {...props} icon="map-marker-outline" color="#4CAF50" />}
              titleStyle={styles.routeText}
            />
            <View style={styles.routeLine} />
            <List.Item
              title={item.destination || 'Destination'}
              left={props => <List.Icon {...props} icon="map-marker" color="#f44336" />}
              titleStyle={styles.routeText}
            />
          </View>

          {item.behaviorSummary && (
            <View style={styles.behaviorBox}>
              <Text variant="labelSmall" style={styles.behaviorTitle}>DRIVER BEHAVIOR LOG</Text>
              <View style={styles.behaviorMetrics}>
                {item.behaviorSummary.sleeping > 0 && (
                  <Chip compact style={styles.behaviorChip} icon="sleep">Drowsy: {item.behaviorSummary.sleeping}</Chip>
                )}
                {item.behaviorSummary.distracted > 0 && (
                  <Chip compact style={styles.behaviorChip} icon="eye-off">Distracted: {item.behaviorSummary.distracted}</Chip>
                )}
                {item.behaviorSummary.normal > 0 && (
                  <Chip compact style={styles.behaviorChip} icon="check-circle">Focused: {item.behaviorSummary.normal}</Chip>
                )}
              </View>
            </View>
          )}
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={{ marginTop: 10 }}>Loading your trips...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={trips}
        renderItem={renderTripItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="history" size={64} color="#ccc" />
            <Text variant="titleMedium" style={{ color: '#999', marginTop: 16 }}>No trips found yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  tripCard: {
    marginBottom: 16,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    color: '#666',
  },
  divider: {
    marginVertical: 12,
  },
  routeInfo: {
    paddingLeft: 8,
  },
  routeText: {
    fontSize: 14,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#eee',
    marginLeft: 22,
  },
  behaviorBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  behaviorTitle: {
    color: '#999',
    marginBottom: 8,
    letterSpacing: 1,
  },
  behaviorMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  behaviorChip: {
    backgroundColor: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 100,
  }
});
