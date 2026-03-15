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
import { Text, Button, Card, FAB, Portal, Modal, Chip, TextInput, ActivityIndicator } from 'react-native-paper';
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
import { getBackendUrl } from '../../utils/backendUrl';

const BACKEND_URL = getBackendUrl();

// Common places for quick selection
const COMMON_PLACES = [
  { description: 'Majestic Bus Stand, Bangalore', lat: '12.9767', lon: '77.5713' },
  { description: 'Indiranagar, Bangalore', lat: '12.9719', lon: '77.6412' },
  { description: 'Koramangala, Bangalore', lat: '12.9352', lon: '77.6245' },
  { description: 'MG Road, Bangalore', lat: '12.9738', lon: '77.6119' },
  { description: 'Kempegowda Int. Airport', lat: '13.1986', lon: '77.7066' },
];

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
  const [sourceCoords, setSourceCoords] = useState(null);
  const [destCoordsSelected, setDestCoordsSelected] = useState(null);
  const [sourceSuggestions, setSourceSuggestions] = useState([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [showCommonSource, setShowCommonSource] = useState(false);
  const [showCommonDest, setShowCommonDest] = useState(false);
  const [searchingSource, setSearchingSource] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);
  const [driverId, setDriverId] = useState(null);
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [cctvFrame, setCctvFrame] = useState(null);
  const [cctvStatus, setCctvStatus] = useState('');
  const [safetyScore, setSafetyScore] = useState(100);
  const [severity, setSeverity] = useState('LOW');
  const [behaviorCounts, setBehaviorCounts] = useState({ sleeping: 0, distracted: 0, normal: 0, yawning: 0 });
  const [driverHistoricalStats, setDriverHistoricalStats] = useState(null);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [fetchingStats, setFetchingStats] = useState(false);
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
    if (!tripActive || !vehicleNumber) return;

    let interval;
    let lastErrorTime = 0;

  const fetchCctvFrame = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/ai/latest-frame/${vehicleNumber.trim().toUpperCase()}`);
        if (response.ok) {
          const data = await response.json();
          setCctvFrame(data.imageBase64 || null);
          setCctvStatus(data.flag || '');
          setSeverity(data.severity || 'LOW');
          
          // Update behavior counts for summary
          setBehaviorCounts(prev => ({
            ...prev,
            sleeping: prev.sleeping + (data.flag === 'SLEEPING' ? 1 : 0),
            distracted: prev.distracted + (data.flag === 'DISTRACTED' ? 1 : 0),
            abusive: (prev.abusive || 0) + (data.flag === 'ABUSIVE_GESTURE' ? 1 : 0),
            normal: prev.normal + (data.flag === 'NORMAL' ? 1 : 0),
            yawning: prev.yawning + (data.metrics?.isYawning ? 1 : 0),
          }));

          // Calculate safety score
          let score = 100;
          if (data.flag === 'SLEEPING') score -= 70;
          if (data.flag === 'DISTRACTED') score -= 30;
          if (data.flag === 'ABUSIVE_GESTURE') score -= 50;
          if (data.metrics?.isYawning) score -= 15;
          setSafetyScore(Math.max(0, score));

          // Vibrate if dangerous
          if (data.flag === 'SLEEPING' || data.flag === 'DISTRACTED' || data.flag === 'ABUSIVE_GESTURE') {
            Vibration.vibrate([0, 500, 200, 500]);
          }
        } else if (response.status === 404) {
          // Vehicle not found - silent fail
          console.log('Vehicle not found on backend');
        }
      } catch (err) {
        // Network error - silent fail to avoid spam
        // Only log once every 30 seconds
        const now = Date.now();
        if (!lastErrorTime || now - lastErrorTime > 30000) {
          console.warn('Backend unavailable:', err.message);
          lastErrorTime = now;
        }
      }
    };

    fetchCctvFrame();
    interval = setInterval(fetchCctvFrame, 1000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [tripActive, vehicleNumber]);

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

    if (!vehicleNumber.trim() || !destinationText.trim()) {
      Alert.alert('Missing Details', 'Enter vehicle number and destination to start.');
      return;
    }

    const finalSource = sourceText.trim() || `${location.latitude},${location.longitude}`;

    try {
      const normalizedVehicleNumber = vehicleNumber.trim().toUpperCase();
      const vehicleQuery = query(
        collection(db, 'vehicles'),
        where('number', '==', normalizedVehicleNumber),
        where('status', '==', 'active')
      );
      let vehicleSnapshot = await getDocs(vehicleQuery);
      if (vehicleSnapshot.empty) {
        Alert.alert('Not Found', 'No active vehicle found with that number.');
        return;
      }

      const vehicleDoc = vehicleSnapshot.docs[0];
      const vehicleData = vehicleDoc.data();
      const matchedDriverId = vehicleData.driverId || vehicleDoc.id;

      let routeResult = await fetchPlannedRoute(finalSource, destinationText);
      
      // Fallback: If Google API fails (Billing error), use a mock route for demo
      if (!routeResult.routes.length) {
        console.warn('Using Mock Route due to API failure');
        routeResult = {
          routes: [[
            { latitude: location.latitude, longitude: location.longitude },
            { latitude: location.latitude + 0.005, longitude: location.longitude + 0.005 },
            { latitude: location.latitude + 0.01, longitude: location.longitude + 0.01 }
          ]],
          shortestIndex: 0
        };
        Alert.alert('Demo Mode', 'Google Maps API is restricted. Starting trip in Demo Mode with a placeholder route.');
      }

      const expected = routeResult.routes[routeResult.shortestIndex];
      
      // Set destination coordinates for marker
      if (expected && expected.length > 0) {
        setDestinationCoords(expected[expected.length - 1]);
      }

      // Create trip document
      const tripRef = await addDoc(collection(db, 'trips'), {
        userId: auth.currentUser.uid,
        driverId: matchedDriverId,
        vehicleId: vehicleDoc.id,
        vehicleNumber: normalizedVehicleNumber,
        source: sourceText.trim() || 'Current Location',
        destination: destinationText.trim(),
        expectedRoute: expected,
        // Remove nested arrays for Firestore compatibility
        routeOptions: [], 
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
    if (!vehicleLoc || !activeRoute || !activeRoute.length) return;

    let minDistance = Infinity;
    activeRoute.forEach((point) => {
      const distance = getDistance(
        { latitude: vehicleLoc.latitude, longitude: vehicleLoc.longitude },
        { latitude: point.latitude, longitude: point.longitude }
      );
      if (distance < minDistance) minDistance = distance;
    });

    if (!Number.isFinite(minDistance)) return;

    // Threshold for deviation: 200 meters
    if (minDistance > 200) {
      const now = Date.now();
      // Throttling to prevent alert spamming (every 30 seconds)
      if (now - lastDeviationAlertRef.current > 30000) {
        lastDeviationAlertRef.current = now;
        
        // Immediate UI Alert
        Alert.alert(
          '🚨 Route Deviation Alert!',
          `The vehicle has deviated ${Math.round(minDistance)}m from the planned route. Please check your safety.`,
          [{ text: 'I am safe' }, { text: 'Trigger SOS', onPress: handleSOS, style: 'destructive' }]
        );

        // Haptic Feedback
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);

        // Background logic / Notification
        if (tripId.current) {
          addAlert('deviation', `Route change detected. Deviation: ${Math.round(minDistance)}m`);
          const NotificationService = require('../../services/NotificationService').default;
          NotificationService.notifyRouteDeviation(tripId.current, vehicleLoc);
        }
      }
    }
  };

  const fetchPlaceSuggestions = async (input, setResults, setLoading) => {
    // LocationIQ Personal Access Token from screenshot
    const LIQ_TOKEN = 'pk.add7d2a4a5a98cb697d10c8450c2c4fc'; 
    if (!input.trim() || input.length < 3) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Using LocationIQ Autocomplete (Free, no credit card required)
      const url = `https://api.locationiq.com/v1/autocomplete.php?key=${LIQ_TOKEN}&q=${encodeURIComponent(input)}&format=json&limit=5&dedupe=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        setResults(data.map((item) => ({
          description: item.display_name,
          lat: item.lat,
          lon: item.lon
        })));
      } else {
        setResults([]);
      }
    } catch (error) {
      console.error('Error fetching place suggestions:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlannedRoute = async (source, destination) => {
    const LIQ_TOKEN = 'pk.add7d2a4a5a98cb697d10c8450c2c4fc';
    const HEADERS = { 'User-Agent': 'HackAtharva-SmartTransport/1.0' };
    try {
      let startCoords, endCoords;

      if (sourceCoords) {
        startCoords = `${sourceCoords.longitude},${sourceCoords.latitude}`;
      } else if (typeof source === 'string' && source.includes(',')) {
        const [lat, lon] = source.split(',');
        startCoords = `${lon.trim()},${lat.trim()}`;
      } else {
        const sUrl = `https://us1.locationiq.com/v1/search.php?key=${LIQ_TOKEN}&q=${encodeURIComponent(source)}&format=json&limit=1`;
        const sRes = await fetch(sUrl, { headers: HEADERS });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData[0]) startCoords = `${sData[0].lon},${sData[0].lat}`;
        }
      }

      if (destCoordsSelected) {
        endCoords = `${destCoordsSelected.longitude},${destCoordsSelected.latitude}`;
      } else {
        const dUrl = `https://us1.locationiq.com/v1/search.php?key=${LIQ_TOKEN}&q=${encodeURIComponent(destination)}&format=json&limit=1`;
        const dRes = await fetch(dUrl, { headers: HEADERS });
        if (dRes.ok) {
          const dData = await dRes.json();
          if (dData[0]) endCoords = `${dData[0].lon},${dData[0].lat}`;
        }
      }

      if (!startCoords || !endCoords) return { routes: [], shortestIndex: 0 };

      // 3. Get Route from LocationIQ (OSRM-compatible, more stable than public OSRM)
      const routeUrl = `https://us1.locationiq.com/v1/directions/driving/${startCoords};${endCoords}?key=${LIQ_TOKEN}&overview=full&geometries=geojson`;
      const rRes = await fetch(routeUrl);
      
      if (!rRes.ok) {
        const text = await rRes.text();
        console.warn('Routing API Error:', rRes.status, text);
        // Fallback to public OSRM if LocationIQ fails
        const fallbackUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords};${endCoords}?overview=full&geometries=geojson`;
        const fRes = await fetch(fallbackUrl, { headers: HEADERS });
        if (!fRes.ok) return { routes: [], shortestIndex: 0 };
        const fData = await fRes.json();
        if (fData.code === 'Ok' && fData.routes?.length > 0) {
          const points = fData.routes[0].geometry.coordinates.map(coord => ({
            latitude: coord[1],
            longitude: coord[0]
          }));
          return { routes: [points], shortestIndex: 0 };
        }
        return { routes: [], shortestIndex: 0 };
      }

      const rData = await rRes.json();
      if (rData.code === 'Ok' && rData.routes?.length > 0) {
        const points = rData.routes[0].geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
        return { routes: [points], shortestIndex: 0 };
      }

      return { routes: [], shortestIndex: 0 };
    } catch (error) {
      console.error('Error fetching route:', error);
      return { routes: [], shortestIndex: 0 };
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
                  safetyScore: safetyScore,
                  behaviorSummary: behaviorCounts
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
              setSourceCoords(null);
              setDestCoordsSelected(null);
              setDestinationCoords(null);
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

  const fetchDriverHistoricalStats = async () => {
    if (!driverId) return;
    
    setFetchingStats(true);
    try {
      const reportsQuery = query(
        collection(db, 'safetyReports'),
        where('driverId', '==', driverId)
      );
      const snapshot = await getDocs(reportsQuery);
      
      const counts = {
        sleeping: 0,
        distracted: 0,
        abusive: 0,
        total: snapshot.size
      };

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.type === 'SLEEPING') counts.sleeping++;
        else if (data.type === 'DISTRACTED') counts.distracted++;
        else if (data.type === 'ABUSIVE_GESTURE') counts.abusive++;
      });

      setDriverHistoricalStats(counts);
      setSafetyModalVisible(true);
    } catch (error) {
      console.error('Error fetching driver historical stats:', error);
      Alert.alert('Error', 'Failed to fetch driver safety record.');
    } finally {
      setFetchingStats(false);
    }
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
        destinationCoords={destinationCoords}
      />

      {/* Trip info overlay */}
      <View style={styles.overlay}>
        <Card style={[
          styles.infoCard,
          (cctvStatus === 'SLEEPING' || cctvStatus === 'ABUSIVE_GESTURE') && { backgroundColor: '#FFEBEE', borderColor: '#D32F2F', borderWidth: 2 }
        ]}>
          <Card.Content>
            {tripActive ? (
              <View>
                <View style={styles.tripInfo}>
                  <MaterialCommunityIcons name="checkbox-marked-circle" size={20} color="#4CAF50" />
                  <Text variant="titleSmall" style={styles.tripStatusText}>
                    Trip Active
                  </Text>
                </View>
                <View style={styles.tripMetrics}>
                  <View style={styles.metricItem}>
                    <Text variant="labelSmall">SPEED</Text>
                    <Text variant="titleMedium">{Math.round((speed || 0) * 3.6)} km/h</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text variant="labelSmall">SAFETY SCORE</Text>
                    <Text 
                      variant="titleMedium" 
                      style={{ color: safetyScore > 80 ? '#2E7D32' : safetyScore > 50 ? '#F57C00' : '#C62828' }}
                    >
                      {safetyScore}%
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.reportButton} 
                    onPress={fetchDriverHistoricalStats}
                    disabled={fetchingStats}
                  >
                    <MaterialCommunityIcons name="shield-account" size={24} color="#6200ee" />
                    <Text variant="labelSmall" style={{ color: '#6200ee' }}>DRIVER RECORD</Text>
                    {fetchingStats && <ActivityIndicator size="small" color="#6200ee" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                </View>

                <View style={[
                  styles.cctvPreview,
                  (cctvStatus === 'SLEEPING' || cctvStatus === 'ABUSIVE_GESTURE') && { borderColor: '#D32F2F', borderWidth: 4 }
                ]}>
                  <View style={styles.cctvHeader}>
                    <Text variant="labelSmall" style={{ color: '#fff' }}>DRIVER STATUS</Text>
                    <Chip 
                      icon={cctvStatus === 'NORMAL' ? 'check-circle' : 'alert-circle'}
                      style={{ 
                        backgroundColor: cctvStatus === 'NORMAL' ? '#E8F5E9' : (cctvStatus === 'ABUSIVE_GESTURE' || cctvStatus === 'SLEEPING' ? '#FFEBEE' : '#FFF3E0') 
                      }}
                      textStyle={{ 
                        color: cctvStatus === 'NORMAL' ? '#2E7D32' : (cctvStatus === 'ABUSIVE_GESTURE' || cctvStatus === 'SLEEPING' ? '#C62828' : '#F57C00'), 
                        fontSize: 10 
                      }}
                    >
                      {cctvStatus === 'SLEEPING' ? '🚨 SLEEPING' : (cctvStatus === 'ABUSIVE_GESTURE' ? '🚨 ABUSIVE' : (cctvStatus || 'OFFLINE'))}
                    </Chip>
                  </View>
                  {cctvFrame ? (
                    <View style={styles.fullWidth}>
                      <Image source={{ uri: cctvFrame }} style={styles.cctvImage} />
                      {/* RED ALERT OVERLAY OVER IMAGE */}
                      {(cctvStatus === 'SLEEPING' || cctvStatus === 'ABUSIVE_GESTURE') && (
                        <View style={styles.cctvRedOverlay}>
                          <MaterialCommunityIcons 
                            name={cctvStatus === 'SLEEPING' ? 'alert-octagon' : 'hand-back-left'} 
                            size={40} 
                            color="#fff" 
                          />
                          <Text style={styles.overlayAlertText}>
                            {cctvStatus === 'SLEEPING' ? 'DRIVER SLEEPING' : 'ABUSIVE BEHAVIOR'}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.cctvPlaceholderContainer}>
                      <MaterialCommunityIcons name="video-off" size={24} color="#999" />
                      <Text variant="labelSmall" style={{ color: '#999' }}>No Feed</Text>
                    </View>
                  )}
                </View>

                {/* HIGH VISIBILITY ALERTS */}
                {(cctvStatus === 'SLEEPING' || cctvStatus === 'DISTRACTED' || cctvStatus === 'ABUSIVE_GESTURE') && (
                  <Card style={[styles.alertBanner, { backgroundColor: cctvStatus === 'SLEEPING' || cctvStatus === 'ABUSIVE_GESTURE' ? '#D32F2F' : '#F57C00', marginTop: 12 }]}>
                    <Card.Content style={styles.alertBannerContent}>
                      <MaterialCommunityIcons 
                        name={cctvStatus === 'SLEEPING' ? 'alert-octagon' : (cctvStatus === 'ABUSIVE_GESTURE' ? 'hand-back-left' : 'eye-off')} 
                        size={28} 
                        color="#fff" 
                      />
                      <View style={styles.alertTextContainer}>
                        <Text style={styles.alertTitle}>
                          {cctvStatus === 'SLEEPING' ? 'CRITICAL: DRIVER SLEEPING' : (cctvStatus === 'ABUSIVE_GESTURE' ? 'CRITICAL: ABUSIVE GESTURE' : 'WARNING: DRIVER DISTRACTED')}
                        </Text>
                        <Text style={styles.alertSubtitle}>
                          {cctvStatus === 'SLEEPING' 
                            ? 'Please alert the driver or press SOS immediately!' 
                            : (cctvStatus === 'ABUSIVE_GESTURE' ? 'Driver is behaving offensively. Incident recorded.' : 'The driver is not focused on the road.')}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                )}
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
                  onFocus={() => setShowCommonSource(true)}
                  onChangeText={(text) => {
                    setSourceText(text);
                    fetchPlaceSuggestions(text, setSourceSuggestions, setSearchingSource);
                    if (text.length > 0) setShowCommonSource(false);
                  }}
                  autoCorrect={false}
                  style={styles.input}
                  right={searchingSource ? <TextInput.Icon icon={() => <ActivityIndicator size="small" color="#6200ee" />} /> : null}
                />
                {(showCommonSource || !!sourceSuggestions.length) && (
                  <View style={styles.suggestionList}>
                    {showCommonSource && (
                      <Chip
                        icon="crosshairs-gps"
                        onPress={() => {
                          setSourceText('Current Location');
                          setSourceCoords({ latitude: location.latitude, longitude: location.longitude });
                          setShowCommonSource(false);
                        }}
                        style={[styles.suggestionChip, { backgroundColor: '#E8EAF6' }]}
                        textStyle={[styles.suggestionText, { fontWeight: 'bold', color: '#3F51B5' }]}
                      >
                        Use Current Location
                      </Chip>
                    )}
                    {(showCommonSource ? COMMON_PLACES : sourceSuggestions).map((item, idx) => (
                      <Chip
                        key={`${item.description}-${idx}`}
                        onPress={() => {
                          setSourceText(item.description);
                          setSourceCoords({ latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) });
                          setSourceSuggestions([]);
                          setShowCommonSource(false);
                        }}
                        style={styles.suggestionChip}
                        textStyle={styles.suggestionText}
                      >
                        {item.description.split(',')[0]}
                      </Chip>
                    ))}
                  </View>
                )}
                <TextInput
                  label="Destination"
                  value={destinationText}
                  onFocus={() => setShowCommonDest(true)}
                  onChangeText={(text) => {
                    setDestinationText(text);
                    fetchPlaceSuggestions(text, setDestinationSuggestions, setSearchingDest);
                    if (text.length > 0) setShowCommonDest(false);
                  }}
                  autoCorrect={false}
                  style={styles.input}
                  right={searchingDest ? <TextInput.Icon icon={() => <ActivityIndicator size="small" color="#6200ee" />} /> : null}
                />
                {(showCommonDest || !!destinationSuggestions.length) && (
                  <View style={styles.suggestionList}>
                    {(showCommonDest ? COMMON_PLACES : destinationSuggestions).map((item, idx) => (
                      <Chip
                        key={`${item.description}-${idx}`}
                        onPress={() => {
                          setDestinationText(item.description);
                          setDestCoordsSelected({ latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) });
                          setDestinationSuggestions([]);
                          setShowCommonDest(false);
                        }}
                        style={styles.suggestionChip}
                        textStyle={styles.suggestionText}
                      >
                        {item.description.split(',')[0]}
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

      {/* Driver Safety Report Modal */}
      <Portal>
        <Modal
          visible={safetyModalVisible}
          onDismiss={() => setSafetyModalVisible(false)}
          contentContainerStyle={styles.safetyModalContainer}
        >
          <View style={styles.modalHeader}>
            <MaterialCommunityIcons name="shield-check" size={32} color="#4CAF50" />
            <Text variant="headlineSmall" style={styles.modalTitle}>Driver Safety Report</Text>
            <TouchableOpacity onPress={() => setSafetyModalVisible(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {driverHistoricalStats ? (
            <View>
              <Text variant="bodyMedium" style={styles.modalSubtitle}>
                Historical behavior data from our AI monitoring system.
              </Text>
              
              <View style={styles.safetyScoreCircle}>
                <Text variant="displaySmall" style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                  {Math.max(0, 100 - (driverHistoricalStats.total * 5))}%
                </Text>
                <Text variant="labelMedium">SAFETY SCORE</Text>
              </View>

              <View style={styles.statsGrid}>
                <View style={[styles.statItem, { borderLeftColor: '#C62828' }]}>
                  <Text variant="labelSmall">SLEEPING</Text>
                  <Text variant="headlineSmall" style={{ color: '#C62828' }}>{driverHistoricalStats.sleeping}</Text>
                  <Text variant="bodySmall">Times</Text>
                </View>
                <View style={[styles.statItem, { borderLeftColor: '#f44336' }]}>
                  <Text variant="labelSmall">ABUSIVE</Text>
                  <Text variant="headlineSmall" style={{ color: '#f44336' }}>{driverHistoricalStats.abusive}</Text>
                  <Text variant="bodySmall">Times</Text>
                </View>
                <View style={[styles.statItem, { borderLeftColor: '#FF9800' }]}>
                  <Text variant="labelSmall">DISTRACTED</Text>
                  <Text variant="headlineSmall" style={{ color: '#FF9800' }}>{driverHistoricalStats.distracted}</Text>
                  <Text variant="bodySmall">Times</Text>
                </View>
              </View>

              <Text variant="bodySmall" style={styles.disclaimer}>
                * This data is calculated from all previous trips monitored by our AI system.
              </Text>

              <Button 
                mode="contained" 
                onPress={() => setSafetyModalVisible(false)}
                style={styles.closeButton}
              >
                Close Report
              </Button>
            </View>
          ) : (
            <ActivityIndicator size="large" color="#6200ee" style={{ marginVertical: 40 }} />
          )}
        </Modal>
      </Portal>
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
  tripMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
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
    marginTop: 16,
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cctvImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 2,
  },
  suggestionText: {
    fontSize: 12,
    color: '#333',
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
  cctvHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    top: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cctvPlaceholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBanner: {
    borderRadius: 8,
    elevation: 4,
  },
  alertBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  alertTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  alertTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  alertSubtitle: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CE93D8',
    flex: 1.2,
  },
  safetyModalContainer: {
    backgroundColor: '#fff',
    padding: 24,
    margin: 20,
    borderRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
  },
  modalSubtitle: {
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  safetyScoreCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 100,
    width: 150,
    height: 150,
    alignSelf: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    paddingLeft: 8,
    borderLeftWidth: 3,
    marginRight: 4,
  },
  disclaimer: {
    fontStyle: 'italic',
    color: '#999',
    marginBottom: 24,
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: '#6200ee',
    borderRadius: 8,
  },
  cctvRedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(211, 47, 47, 0.75)', // Strong red with transparency
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  overlayAlertText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 18,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  fullWidth: {
    width: '100%',
    height: '100%',
  },
});
