import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Card, FAB, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { doc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import DriverBehaviorService from '../../services/DriverBehaviorService';
import DriverTripMap from '../../components/maps/DriverTripMap';
import NotificationService from '../../services/NotificationService';
import { getBackendUrl } from '../../utils/backendUrl';

export default function DriverTripScreen() {
  const [tripActive, setTripActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [expectedRoute, setExpectedRoute] = useState([]);
  const [speed, setSpeed] = useState(0);
  const [passengers, setPassengers] = useState(0);
  const [driverScore, setDriverScore] = useState(100);
  const locationSubscription = useRef(null);
  const tripId = useRef(null);
  const previousSpeed = useRef(0);
  const previousTime = useRef(Date.now());
  const lastDeviationAlertRef = useRef(0);

  useEffect(() => {
    requestLocationPermissions();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  const requestLocationPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        await Location.requestBackgroundPermissionsAsync();
        
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
    }
  };

  const loadExpectedRoute = async () => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) return;

    try {
      const response = await fetch(`${backendUrl}/gps/route/${auth.currentUser.uid}`);
      if (!response.ok) return;
      const data = await response.json();
      const route = Array.isArray(data) ? data : data.route || [];
      const cleaned = route
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        .map((p) => ({ latitude: p.lat, longitude: p.lng }));
      setExpectedRoute(cleaned);
    } catch (error) {
      console.error('Error loading expected route:', error);
    }
  };

  const getRouteDeviationMeters = (coords) => {
    if (!expectedRoute.length) return null;
    let minDistance = Infinity;
    expectedRoute.forEach((point) => {
      const distance = getDistance(coords, point);
      if (distance < minDistance) minDistance = distance;
    });
    return Number.isFinite(minDistance) ? minDistance : null;
  };

  const startTrip = async () => {
    if (!location) {
      Alert.alert('Error', 'Unable to get your location. Please try again.');
      return;
    }

    try {
      await loadExpectedRoute();

      // Create trip document
      const tripRef = await addDoc(collection(db, 'driverTrips'), {
        driverId: auth.currentUser.uid,
        vehicleId: auth.currentUser.uid,
        startTime: new Date().toISOString(),
        startLocation: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        status: 'active',
        route: [],
        passengers: 0,
      });

      tripId.current = tripRef.id;
      setTripActive(true);
      setRoutePath([{
        latitude: location.latitude,
        longitude: location.longitude,
      }]);

      // Reset driver behavior service
      DriverBehaviorService.reset();

      // Update vehicle status
      await updateDoc(doc(db, 'vehicles', auth.currentUser.uid), {
        status: 'active',
        currentTrip: tripRef.id,
        location: location,
      });

      // Start location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 10,
        },
        (newLocation) => {
          handleLocationUpdate(newLocation);
        }
      );

      Alert.alert('Trip Started', 'You are now live and passengers can track you!');
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip.');
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

    const currentSpeed = newLocation.coords.speed || 0;
    setSpeed(currentSpeed);

    // Add to route path
    setRoutePath((prev) => [...prev, coords]);

    // Analyze driver behavior
    const speedKmh = currentSpeed * 3.6;
    const behaviorAnalysis = DriverBehaviorService.analyzeSpeedPattern(
      speedKmh,
      new Date().toISOString()
    );

    // Analyze acceleration
    const now = Date.now();
    const timeDelta = (now - previousTime.current) / 1000; // in seconds
    
    if (timeDelta > 0) {
      const accelerationAnalysis = DriverBehaviorService.analyzeAcceleration(
        currentSpeed,
        previousSpeed.current,
        timeDelta
      );
    }

    previousSpeed.current = currentSpeed;
    previousTime.current = now;

    // Update driver score
    setDriverScore(100 - behaviorAnalysis.riskScore);

    const deviationMeters = getRouteDeviationMeters(coords);
    if (deviationMeters !== null && deviationMeters > 200) {
      const now = Date.now();
      if (now - lastDeviationAlertRef.current > 20000) {
        lastDeviationAlertRef.current = now;
        NotificationService.notifyRouteDeviationBroadcast(
          auth.currentUser.uid,
          coords,
          Math.round(deviationMeters)
        );
        await addDoc(collection(db, 'geofenceAlerts'), {
          driverId: auth.currentUser.uid,
          distance: deviationMeters,
          location: coords,
          createdAt: new Date().toISOString(),
          severity: 'high',
        });
      }
    }

    // Update vehicle location in Firestore
    if (tripId.current) {
      try {
        await updateDoc(doc(db, 'vehicles', auth.currentUser.uid), {
          location: coords,
          speed: currentSpeed,
          lastUpdated: new Date().toISOString(),
        });

        await updateDoc(doc(db, 'driverTrips', tripId.current), {
          currentLocation: coords,
          route: routePath,
          speed: currentSpeed,
          driverScore: 100 - behaviorAnalysis.riskScore,
          lastUpdated: new Date().toISOString(),
        });

        // Save behavior analysis periodically
        if (routePath.length % 20 === 0) {
          await DriverBehaviorService.saveBehaviorAnalysis(
            auth.currentUser.uid,
            tripId.current,
            behaviorAnalysis
          );
        }
      } catch (error) {
        console.error('Error updating location:', error);
      }
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
                const finalAnalysis = DriverBehaviorService.analyzeSpeedPattern(
                  speed * 3.6,
                  new Date().toISOString()
                );

                await updateDoc(doc(db, 'driverTrips', tripId.current), {
                  endTime: new Date().toISOString(),
                  endLocation: location,
                  status: 'completed',
                  totalDistance: routePath.length * 0.01,
                  finalScore: 100 - finalAnalysis.riskScore,
                });

                await DriverBehaviorService.saveBehaviorAnalysis(
                  auth.currentUser.uid,
                  tripId.current,
                  finalAnalysis
                );
              }

              // Update vehicle status
              await updateDoc(doc(db, 'vehicles', auth.currentUser.uid), {
                status: 'active',
                currentTrip: null,
              });

              setTripActive(false);
              setRoutePath([]);
              tripId.current = null;
              DriverBehaviorService.reset();

              Alert.alert('Trip Ended', 'Trip completed successfully!');
            } catch (error) {
              console.error('Error ending trip:', error);
              Alert.alert('Error', 'Failed to end trip properly.');
            }
          },
        },
      ]
    );
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
      <DriverTripMap
        location={location}
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
                    Trip Active - Broadcasting Location
                  </Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>Speed</Text>
                    <Text variant="titleMedium">{Math.round((speed || 0) * 3.6)} km/h</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>Distance</Text>
                    <Text variant="titleMedium">{Math.round(routePath.length * 0.01)} km</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text variant="bodySmall" style={styles.statLabel}>Passengers</Text>
                    <Text variant="titleMedium">{passengers}</Text>
                  </View>
                </View>
                <View style={styles.scoreRow}>
                  <Text variant="bodySmall">Driver Safety Score:</Text>
                  <Chip
                    style={[
                      styles.scoreChip,
                      driverScore >= 80 && styles.goodScore,
                      driverScore < 80 && driverScore >= 60 && styles.avgScore,
                      driverScore < 60 && styles.poorScore,
                    ]}
                  >
                    {driverScore}/100
                  </Chip>
                </View>
              </View>
            ) : (
              <View>
                <Text variant="titleSmall">Ready to start your trip</Text>
                <Text variant="bodySmall" style={styles.tripDetail}>
                  Your location will be shared with passengers
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>
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
          <FAB
            icon="stop"
            label="End Trip"
            onPress={endTrip}
            style={styles.endButton}
          />
        )}
      </View>
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
    marginBottom: 12,
  },
  tripStatusText: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  scoreChip: {
    height: 28,
  },
  goodScore: {
    backgroundColor: '#E8F5E9',
  },
  avgScore: {
    backgroundColor: '#FFF3E0',
  },
  poorScore: {
    backgroundColor: '#FFEBEE',
  },
  tripDetail: {
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  endButton: {
    backgroundColor: '#FF9800',
  },
});
