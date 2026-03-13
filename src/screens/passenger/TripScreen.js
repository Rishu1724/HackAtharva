import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Vibration,
  Platform,
  Image,
} from 'react-native';
import { Text, Button, Card, FAB, Portal, Modal, Chip, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import CameraModal from '../../components/CameraModal';
import PassengerTripMap from '../../components/maps/PassengerTripMap';
import { getDistance } from 'geolib';
import NotificationService from '../../services/NotificationService';

export default function TripScreen() {
  const navigation = useNavigation();
  const [tripActive, setTripActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [plannedRoutes, setPlannedRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [expectedRoute, setExpectedRoute] = useState([]);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [vehicleLocation, setVehicleLocation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [destinationText, setDestinationText] = useState('');
  const [sourceSuggestions, setSourceSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [driverId, setDriverId] = useState(null);
  const [cctvFrame, setCctvFrame] = useState(null);
  const [cctvStatus, setCctvStatus] = useState('');
  const locationSubscription = useRef(null);
  const tripId = useRef(null);
  const routePathRef = useRef([]);
  const lastSpeedAlertRef = useRef(0);
  const lastDeviationAlertRef = useRef(0);
  const vehicleSubscription = useRef(null);

  useEffect(() => {
    requestLocationPermissions();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (vehicleSubscription.current) {
        vehicleSubscription.current();
        vehicleSubscription.current = null;
      }
    };
  }, [tripActive]);

  useEffect(() => {
    if (!tripActive || !driverId) return;

    const frameRef = doc(db, 'driverFrames', driverId);
    const unsubscribe = onSnapshot(frameRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setCctvFrame(data.imageBase64 || null);
      setCctvStatus(data.flag || '');
    });

    return () => unsubscribe();
  }, [tripActive, driverId]);

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

    if (!vehicleNumber.trim() || !sourceText.trim() || !destinationText.trim()) {
      Alert.alert('Missing Details', 'Enter vehicle number, source, and destination to start.');
      return;
    }

    try {
      const normalizedVehicleNumber = vehicleNumber.trim().toUpperCase();
      const vehicleQuery = query(
        collection(db, 'vehicles'),
        where('number', '==', normalizedVehicleNumber),
        where('status', '==', 'active')
      );
      let vehicleSnapshot = await getDocs(vehicleQuery);
      if (vehicleSnapshot.empty) {
        const fallbackQuery = query(
          collection(db, 'vehicles'),
          where('number', '==', vehicleNumber.trim()),
          where('status', '==', 'active')
        );
        vehicleSnapshot = await getDocs(fallbackQuery);
      }
      if (vehicleSnapshot.empty) {
        Alert.alert('Not Found', 'No active vehicle found with that number.');
        return;
      }

      const vehicleDoc = vehicleSnapshot.docs[0];
      const vehicleData = vehicleDoc.data();
      const matchedDriverId = vehicleData.driverId || vehicleDoc.id;

      const routeResult = await fetchPlannedRoute(sourceText, destinationText);
      if (!routeResult.routes.length) {
        Alert.alert('Route Error', 'Unable to build a route. Check source and destination.');
        return;
      }
      const expected = routeResult.routes[routeResult.shortestIndex];

      // Create trip document
      const tripRef = await addDoc(collection(db, 'trips'), {
        userId: auth.currentUser.uid,
        driverId: matchedDriverId,
        vehicleId: vehicleDoc.id,
        vehicleNumber: normalizedVehicleNumber,
        source: sourceText.trim(),
        destination: destinationText.trim(),
        expectedRoute: expected,
        routeOptions: routeResult.routes,
        selectedRouteIndex: routeResult.shortestIndex,
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
      setDriverId(matchedDriverId);
      setPlannedRoutes(routeResult.routes);
      setSelectedRouteIndex(routeResult.shortestIndex);
      setExpectedRoute(expected);
      const initialRoute = [{
        latitude: location.latitude,
        longitude: location.longitude,
      }];
      routePathRef.current = initialRoute;
      setRoutePath(initialRoute);

      if (vehicleSubscription.current) {
        vehicleSubscription.current();
      }

      vehicleSubscription.current = onSnapshot(
        doc(db, 'vehicles', matchedDriverId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (data?.location) {
            setVehicleLocation(data.location);
            checkRouteDeviation(data.location, expected);
          }
        }
      );

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
    const nextRoutePath = [...routePathRef.current, coords];
    routePathRef.current = nextRoutePath;
    setRoutePath(nextRoutePath);

    // Update trip in Firestore
    if (tripId.current) {
      try {
        await updateDoc(doc(db, 'trips', tripId.current), {
          currentLocation: coords,
          route: nextRoutePath,
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

  const checkRouteDeviation = (vehicleLoc, routeOverride = null) => {
    const activeRoute = routeOverride || expectedRoute;
    if (!vehicleLoc || !activeRoute.length) return;

    let minDistance = Infinity;
    activeRoute.forEach((point) => {
      const distance = getDistance(vehicleLoc, point);
      if (distance < minDistance) minDistance = distance;
    });

    if (!Number.isFinite(minDistance)) return;

    if (minDistance > 200) {
      addAlert('deviation', `Route change detected. Deviation: ${Math.round(minDistance)}m`);
      Vibration.vibrate([0, 500, 200, 500]);
      const now = Date.now();
      if (now - lastDeviationAlertRef.current > 20000 && tripId.current) {
        lastDeviationAlertRef.current = now;
        NotificationService.notifyRouteDeviation(tripId.current, vehicleLoc);
      }
    }
  };

  const fetchPlannedRoute = async (source, destination) => {
    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || '';
    if (!apiKey) return { routes: [], shortestIndex: 0 };

    const parseRouteResponse = (data) => {
      if (!data?.routes?.length) return { routes: [], shortestIndex: 0 };

      const routes = data.routes
        .map((route) => {
          const polyline = route.overview_polyline?.points;
          const distance = route.legs?.reduce(
            (sum, leg) => sum + (leg.distance?.value || 0),
            0
          );
          return {
            distance,
            points: polyline ? decodePolyline(polyline) : [],
          };
        })
        .filter((route) => route.points.length > 0);

      if (!routes.length) return { routes: [], shortestIndex: 0 };

      let shortestIndex = 0;
      routes.forEach((route, index) => {
        if (route.distance < routes[shortestIndex].distance) {
          shortestIndex = index;
        }
      });

      return { routes: routes.map((route) => route.points), shortestIndex };
    };

    const fetchDirections = async (origin, destinationValue, alternatives) => {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        origin
      )}&destination=${encodeURIComponent(destinationValue)}&alternatives=${alternatives ? 'true' : 'false'}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      return parseRouteResponse(data);
    };

    try {
      // First attempt: typed source and destination with alternatives.
      let result = await fetchDirections(source, destination, true);
      if (result.routes.length) return result;

      // Second attempt: no alternatives can be more stable on some routes.
      result = await fetchDirections(source, destination, false);
      if (result.routes.length) return result;

      // Third attempt: use current GPS position as origin if text source fails.
      if (location?.latitude && location?.longitude) {
        const originFromGps = `${location.latitude},${location.longitude}`;
        result = await fetchDirections(originFromGps, destination, true);
        if (result.routes.length) return result;

        result = await fetchDirections(originFromGps, destination, false);
        if (result.routes.length) return result;
      }

      return { routes: [], shortestIndex: 0 };
    } catch (error) {
      console.error('Error fetching route:', error);
      return { routes: [], shortestIndex: 0 };
    }
  };

  const fetchPlaceSuggestions = async (input, setResults) => {
    const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey || '';
    if (!apiKey || !input.trim()) {
      setResults([]);
      return;
    }

    try {
      const locationBias = location
        ? `&location=${location.latitude},${location.longitude}&radius=30000&strictbounds=true`
        : '';
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&types=geocode${locationBias}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();
      const predictions = data.predictions || [];
      setResults(predictions.map((item) => item.description).slice(0, 5));
    } catch (error) {
      console.error('Error fetching place suggestions:', error);
    }
  };

  const decodePolyline = (encoded) => {
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;
    const coordinates = [];

    while (index < len) {
      let result = 0;
      let shift = 0;
      let byte = null;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      result = 0;
      shift = 0;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }

    return coordinates;
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

              if (vehicleSubscription.current) {
                vehicleSubscription.current();
                vehicleSubscription.current = null;
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
              routePathRef.current = [];
              setPlannedRoutes([]);
              setExpectedRoute([]);
              setSelectedRouteIndex(0);
              setAlerts([]);
              setVehicleLocation(null);
              setDriverId(null);
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
        routeOptions={plannedRoutes}
        selectedRouteIndex={selectedRouteIndex}
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
                <Text variant="bodySmall" style={styles.tripDetail}>
                  CCTV Status: {cctvStatus || 'Waiting for feed'}
                </Text>
                <View style={styles.cctvPreview}>
                  {cctvFrame ? (
                    <Image source={{ uri: cctvFrame }} style={styles.cctvImage} />
                  ) : (
                    <Text variant="bodySmall" style={styles.cctvPlaceholder}>
                      No CCTV video yet. Start CCTV on the 3rd phone.
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View>
                <Text variant="titleSmall">Ready to start your trip</Text>
                <Text variant="bodySmall" style={styles.tripDetail}>
                  Your location will be shared with trusted contacts
                </Text>
                <TextInput
                  label="Vehicle Number"
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.input}
                />
                <TextInput
                  label="Source"
                  value={sourceText}
                  onChangeText={(text) => {
                    setSourceText(text);
                    fetchPlaceSuggestions(text, setSourceSuggestions);
                  }}
                  autoCorrect={false}
                  style={styles.input}
                />
                {!!sourceSuggestions.length && (
                  <View style={styles.suggestionList}>
                    {sourceSuggestions.map((item) => (
                      <Chip
                        key={item}
                        onPress={() => {
                          setSourceText(item);
                          setSourceSuggestions([]);
                        }}
                        style={styles.suggestionChip}
                      >
                        {item}
                      </Chip>
                    ))}
                  </View>
                )}
                <TextInput
                  label="Destination"
                  value={destinationText}
                  onChangeText={(text) => {
                    setDestinationText(text);
                    fetchPlaceSuggestions(text, setDestinationSuggestions);
                  }}
                  autoCorrect={false}
                  style={styles.input}
                />
                {!!destinationSuggestions.length && (
                  <View style={styles.suggestionList}>
                    {destinationSuggestions.map((item) => (
                      <Chip
                        key={item}
                        onPress={() => {
                          setDestinationText(item);
                          setDestinationSuggestions([]);
                        }}
                        style={styles.suggestionChip}
                      >
                        {item}
                      </Chip>
                    ))}
                  </View>
                )}
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
  input: {
    marginTop: 12,
    backgroundColor: '#fff',
  },
  cctvPreview: {
    marginTop: 12,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cctvImage: {
    width: '100%',
    height: '100%',
  },
  cctvPlaceholder: {
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  suggestionList: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#F3F4F6',
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
