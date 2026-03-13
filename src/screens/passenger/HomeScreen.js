import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { Text, Card, FAB, Button, Portal, Modal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('');
  const [location, setLocation] = useState(null);
  const [nearbyVehicles, setNearbyVehicles] = useState([]);
  const [sosModalVisible, setSosModalVisible] = useState(false);

  useEffect(() => {
    fetchUserData();
    requestLocationPermission();
    fetchNearbyVehicles();
  }, []);

  const fetchUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        setUserName(userDoc.data().name);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation.coords);
      }
    } catch (error) {
      console.error('Error requesting location:', error);
    }
  };

  const fetchNearbyVehicles = async () => {
    try {
      // Fetch active vehicles from Firestore
      const vehiclesQuery = query(
        collection(db, 'vehicles'),
        where('status', '==', 'active')
      );
      const vehiclesSnapshot = await getDocs(vehiclesQuery);
      const vehicles = vehiclesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNearbyVehicles(vehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const getBestEffortLocation = async () => {
    if (location) {
      return location;
    }

    try {
      const permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        return null;
      }

      const latest = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (latest?.coords) {
        setLocation(latest.coords);
        return latest.coords;
      }
    } catch (error) {
      console.error('Error getting fallback location:', error);
    }

    return null;
  };

  const handleSOS = () => {
    setSosModalVisible(true);
  };

  const shareSOSDetails = async (coords) => {
    try {
      const mapUrl = coords
        ? `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`
        : null;

      const locationLines = coords
        ? [
            'My live location is attached below:',
            `Latitude: ${coords.latitude.toFixed(5)}`,
            `Longitude: ${coords.longitude.toFixed(5)}`,
            mapUrl ? `Map: ${mapUrl}` : null,
          ]
            .filter(Boolean)
        : [
            'GPS is unavailable right now. Please stay on call/text with me until I confirm I am safe.',
            'Treat this as urgent and share my last known location if you have it.',
          ];

      const message = [
        '🚨 SOS ALERT',
        'I need immediate help and have triggered the in-app SOS alarm.',
        ...locationLines,
      ].join('\n');

      await Share.share({
        message,
        title: 'SOS Alert',
      });
    } catch (error) {
      console.error('Error sharing SOS message:', error);
    }
  };

  const confirmSOS = async () => {
    setSosModalVisible(false);

    try {
      const SOSService = require('../../services/SOSService').default;
      const activeLocation = await getBestEffortLocation();

      await SOSService.triggerSOS(activeLocation);
      await shareSOSDetails(activeLocation);

      Alert.alert(
        'SOS Activated',
        activeLocation
          ? 'Help alerts have been sent with your live location. Share sheet remained open if you want to forward manually.'
          : 'Help alerts have been sent, but GPS was unavailable. Share the fallback message so trusted contacts call you immediately.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error during SOS trigger:', error);
      Alert.alert('Error', 'Failed to send SOS alert. Please retry or place an emergency call.');
    }
  };

  const handleEmergencyCall = () => {
    Alert.alert(
      'Emergency Call',
      'Call emergency services?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Call 100 (Police)', 
          onPress: () => Linking.openURL('tel:100')
        },
        { 
          text: 'Call 112 (Emergency)', 
          onPress: () => Linking.openURL('tel:112')
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.welcomeCard}>
          <Card.Content>
            <Text variant="headlineSmall">Welcome, {userName}!</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Stay safe on your journey
            </Text>
          </Card.Content>
        </Card>

        {/* Safety Status */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statusHeader}>
              <MaterialCommunityIcons name="shield-check" size={24} color="#4CAF50" />
              <Text variant="titleMedium" style={styles.statusTitle}>
                Safety Status: Active
              </Text>
            </View>
            <Text variant="bodySmall" style={styles.statusText}>
              Your location is being monitored. Trusted contacts can track your trip.
            </Text>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quick Actions
            </Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={[styles.actionButton, styles.sosButton]}
                onPress={handleSOS}
              >
                <MaterialCommunityIcons name="alert-circle" size={32} color="#fff" />
                <Text style={styles.actionButtonText}>SOS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Trip')}
              >
                <MaterialCommunityIcons name="map-marker-path" size={32} color="#6200ee" />
                <Text style={styles.actionButtonTextNormal}>Start Trip</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleEmergencyCall}
              >
                <MaterialCommunityIcons name="phone-alert" size={32} color="#6200ee" />
                <Text style={styles.actionButtonTextNormal}>Emergency Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('Contacts')}
              >
                <MaterialCommunityIcons name="account-multiple" size={32} color="#6200ee" />
                <Text style={styles.actionButtonTextNormal}>Trusted Contacts</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Nearby Vehicles */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Nearby Safe Vehicles
            </Text>
            {nearbyVehicles.length > 0 ? (
              nearbyVehicles.slice(0, 3).map((vehicle) => (
                <View key={vehicle.id} style={styles.vehicleItem}>
                  <MaterialCommunityIcons name="bus" size={24} color="#6200ee" />
                  <View style={styles.vehicleInfo}>
                    <Text variant="bodyMedium">{vehicle.number}</Text>
                    <Text variant="bodySmall" style={styles.vehicleRoute}>
                      {vehicle.route}
                    </Text>
                  </View>
                  <Text variant="bodySmall" style={styles.vehicleDistance}>
                    {vehicle.distance || '500m'}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="bodySmall" style={styles.emptyText}>
                No vehicles nearby. Refresh to check again.
              </Text>
            )}
            <Button
              mode="outlined"
              onPress={fetchNearbyVehicles}
              style={styles.refreshButton}
            >
              Refresh
            </Button>
          </Card.Content>
        </Card>

        {/* Safety Tips */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Safety Tips
            </Text>
            <View style={styles.tipItem}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.tipText}>
                Always share your trip with trusted contacts
              </Text>
            </View>
            <View style={styles.tipItem}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.tipText}>
                Keep SOS button easily accessible
              </Text>
            </View>
            <View style={styles.tipItem}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
              <Text variant="bodySmall" style={styles.tipText}>
                Verify driver and vehicle details before boarding
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* SOS Confirmation Modal */}
      <Portal>
        <Modal
          visible={sosModalVisible}
          onDismiss={() => setSosModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <MaterialCommunityIcons
            name="alert-circle"
            size={64}
            color="#f44336"
            style={styles.modalIcon}
          />
          <Text variant="headlineSmall" style={styles.modalTitle}>
            Activate SOS?
          </Text>
          <Text variant="bodyMedium" style={styles.modalText}>
            This will immediately alert your trusted contacts and authorities with your location.
          </Text>
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setSosModalVisible(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={confirmSOS}
              buttonColor="#f44336"
              style={styles.modalButton}
            >
              Activate SOS
            </Button>
          </View>
        </Modal>
      </Portal>
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
  welcomeCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  subtitle: {
    marginTop: 4,
    color: '#666',
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#666',
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#6200ee',
  },
  sosButton: {
    backgroundColor: '#f44336',
    borderColor: '#f44336',
  },
  actionButtonText: {
    marginTop: 8,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionButtonTextNormal: {
    marginTop: 8,
    color: '#6200ee',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vehicleRoute: {
    color: '#666',
    marginTop: 2,
  },
  vehicleDistance: {
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    paddingVertical: 16,
  },
  refreshButton: {
    marginTop: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    marginLeft: 8,
    color: '#666',
    flex: 1,
  },
  modal: {
    backgroundColor: 'white',
    padding: 24,
    margin: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 6,
  },
});
