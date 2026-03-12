import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Vibration,
  Platform,
} from 'react-native';
import { Text, Button, Card, FAB, Portal, Modal, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { doc, setDoc, updateDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import CameraModal from '../../components/CameraModal';
import PassengerTripMap from '../../components/maps/PassengerTripMap';
import { getDistance } from 'geolib';

export default function TripScreen() {
  const navigation = useNavigation();
  const [tripActive, setTripActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [vehicleLocation, setVehicleLocation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const locationSubscription = useRef(null);
  const tripId = useRef(null);
  const lastSpeedAlertRef = useRef(0);
  const lastDeviationAlertRef = useRef(0);

  useEffect(() => {
    requestLocationPermissions();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (tripActive && tripId.current) {
      // Listen for vehicle updates
      const unsubscribe = onSnapshot(
        doc(db, 'trips', tripId.current),
        (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            if (data.vehicleLocation) {
              setVehicleLocation(data.vehicleLocation);
              checkRouteDeviation(data.vehicleLocation);
            }
          }
        }
      );

      return () => unsubscribe();
    }
  }, [tripActive]);

  const requestLocationPermissions = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus === 'granted') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      Alert.alert('Permission Error', 'Location permissions are required for trip tracking.');
    }
  };

  const startTrip = async () => {
    if (!location) {
      Alert.alert('Error', 'Unable to get your location. Please try again.');
      return;
    }

    try {
      // Create trip document
      const tripRef = await addDoc(collection(db, 'trips'), {
        userId: auth.currentUser.uid,
        startTime: new Date().toISOString(),
        startLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        status: 'active',
        route: [],
        alerts: [],
      });

      tripId.current = tripRef.id;
      setTripActive(true);
      setRoutePath([{
        latitude: location.latitude,
        longitude: location.longitude,
      }]);

      // Start location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000, // Update every 3 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (newLocation) => {
          handleLocationUpdate(newLocation);
        }
      );

      // Notify trusted contacts
      await notifyTrustedContacts(tripRef.id);

      Alert.alert('Trip Started', 'Your trusted contacts have been notified and are tracking your journey.');
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip tracking.');
    }
  };

  const handleLocationUpdate = async (newLocation) => {
    const coords = {
      latitude: newLocation.coords.latitude,
      longitude: newLocation.coords.longitude,
    };

    setLocation({
      ...coords,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });

    setSpeed(newLocation.coords.speed || 0);

    // Add to route path
    setRoutePath((prev) => [...prev, coords]);

    // Update trip in Firestore
    if (tripId.current) {
      try {
        await updateDoc(doc(db, 'trips', tripId.current), {
          currentLocation: coords,
          route: routePath,
          lastUpdated: new Date().toISOString(),
          speed: newLocation.coords.speed || 0,
        });
      } catch (error) {
        console.error('Error updating trip:', error);
      }
    }

    // Check for speed violations
    checkSpeedViolation(newLocation.coords.speed);
  };

  const checkSpeedViolation = (currentSpeed) => {
    const speedKmh = (currentSpeed || 0) * 3.6; // Convert m/s to km/h
    
    if (speedKmh > 80) { // Alert if speed exceeds 80 km/h
      addAlert('speed', `High speed detected: ${Math.round(speedKmh)} km/h`);
      const now = Date.now();
      if (now - lastSpeedAlertRef.current > 20000 && tripId.current) {
        lastSpeedAlertRef.current = now;
        const NotificationService = require('../../services/NotificationService').default;
        NotificationService.notifySpeedViolation(tripId.current, Math.round(speedKmh));
      }
    }
  };

  const checkRouteDeviation = (vehicleLoc) => {
    if (!location || !vehicleLoc) return;

    const distance = getDistance(
      { latitude: location.latitude, longitude: location.longitude },
      { latitude: vehicleLoc.latitude, longitude: vehicleLoc.longitude }
    );

    // If distance between passenger and vehicle > 500m, alert
    if (distance > 500) {
      addAlert('deviation', `Possible route deviation detected. Distance from vehicle: ${Math.round(distance)}m`);
      Vibration.vibrate([0, 500, 200, 500]);
      const now = Date.now();
      if (now - lastDeviationAlertRef.current > 20000 && tripId.current) {
        lastDeviationAlertRef.current = now;
        const NotificationService = require('../../services/NotificationService').default;
        NotificationService.notifyRouteDeviation(tripId.current, vehicleLoc);
      }
    }
  };

  const addAlert = async (type, message) => {
    const newAlert = {
      type,
      message,
      timestamp: new Date().toISOString(),
    };

    setAlerts((prev) => [...prev, newAlert]);

    if (tripId.current) {
      try {
        await updateDoc(doc(db, 'trips', tripId.current), {
          alerts: [...alerts, newAlert],
        });
      } catch (error) {
        console.error('Error adding alert:', error);
      }
    }
  };

  const notifyTrustedContacts = async (tripId) => {
    // This would send notifications to trusted contacts
    // Implementation depends on your notification service
    try {
      const NotificationService = require('../../services/NotificationService').default;
      await NotificationService.notifyTripStart(auth.currentUser.uid, tripId);
    } catch (error) {
      console.error('Error notifying contacts:', error);
    }
  };

  const endTrip = async () => {
    Alert.alert(
      'End Trip',
      'Are you sure you want to end this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Trip',
          onPress: async () => {
            try {
              if (locationSubscription.current) {
                locationSubscription.current.remove();
              }

              if (tripId.current) {
                await updateDoc(doc(db, 'trips', tripId.current), {
                  endTime: new Date().toISOString(),
                  endLocation: location,
                  status: 'completed',
                });
              }

              setTripActive(false);
              setRoutePath([]);
              setAlerts([]);
              tripId.current = null;

              Alert.alert('Trip Ended', 'Your trip has been ended successfully.');
            } catch (error) {
              console.error('Error ending trip:', error);
              Alert.alert('Error', 'Failed to end trip properly.');
            }
          },
        },
      ]
    );
  };

  const handleSOS = async () => {
    try {
      const SOSService = require('../../services/SOSService').default;
      await SOSService.triggerSOS(location, tripId.current);
      
      // Start camera recording
      setCameraVisible(true);
      
      Alert.alert(
        'SOS Activated',
        'Emergency services and your trusted contacts have been notified!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send SOS alert');
    }
  };

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="map-marker" size={64} color="#6200ee" />
        <Text variant="titleMedium" style={styles.loadingText}>
          Getting your location...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PassengerTripMap
        location={location}
        vehicleLocation={vehicleLocation}
        routePath={routePath}
        tripActive={tripActive}
      />

      {/* Trip info overlay */}
      <View style={styles.overlay}>
        <Card style={styles.infoCard}>
          <Card.Content>
            {tripActive ? (
              <View>
                <View style={styles.tripInfo}>
                  <MaterialCommunityIcons name="checkbox-marked-circle" size={20} color="#4CAF50" />
                  <Text variant="titleSmall" style={styles.tripStatusText}>
                    Trip Active
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles.tripDetail}>
                  Speed: {Math.round((speed || 0) * 3.6)} km/h
                </Text>
                <Text variant="bodySmall" style={styles.tripDetail}>
                  Distance: {Math.round(routePath.length * 0.01)} km
                </Text>
              </View>
            ) : (
              <View>
                <Text variant="titleSmall">Ready to start your trip</Text>
                <Text variant="bodySmall" style={styles.tripDetail}>
                  Your location will be shared with trusted contacts
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Alerts */}
        {alerts.length > 0 && (
          <View style={styles.alertsContainer}>
            {alerts.slice(-2).map((alert, index) => (
              <Chip
                key={index}
                icon="alert"
                style={[
                  styles.alertChip,
                  alert.type === 'speed' && styles.speedAlert,
                  alert.type === 'deviation' && styles.deviationAlert,
                ]}
                textStyle={styles.alertText}
              >
                {alert.message}
              </Chip>
            ))}
          </View>
        )}
      </View>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        {!tripActive ? (
          <FAB
            icon="play"
            label="Start Trip"
            onPress={startTrip}
            style={styles.startButton}
          />
        ) : (
          <>
            <FAB
              icon="alert-circle"
              style={styles.sosButton}
              onPress={handleSOS}
              color="#fff"
            />
            {Platform.OS !== 'web' && (
              <FAB
                icon="camera"
                style={styles.cameraButton}
                onPress={() => setCameraVisible(true)}
              />
            )}
            <FAB
              icon="stop"
              label="End Trip"
              onPress={endTrip}
              style={styles.endButton}
            />
          </>
        )}
      </View>

      {/* Camera Modal */}
      {Platform.OS !== 'web' && (
        <CameraModal
          visible={cameraVisible}
          onClose={() => setCameraVisible(false)}
          tripId={tripId.current}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
  },
  overlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
  },
  infoCard: {
    elevation: 4,
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripStatusText: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  tripDetail: {
    color: '#666',
    marginTop: 4,
  },
  alertsContainer: {
    marginTop: 12,
  },
  alertChip: {
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  speedAlert: {
    backgroundColor: '#FFF3E0',
  },
  deviationAlert: {
    backgroundColor: '#FFEBEE',
  },
  alertText: {
    fontSize: 12,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    left: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
  },
  sosButton: {
    backgroundColor: '#f44336',
  },
  cameraButton: {
    backgroundColor: '#6200ee',
    marginHorizontal: 8,
  },
  endButton: {
    backgroundColor: '#FF9800',
  },
});
