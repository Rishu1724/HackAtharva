import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, ScrollView, Dimensions, Vibration } from 'react-native';
import { Card, Text, TextInput, Button, IconButton, ActivityIndicator, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { getBackendUrl } from '../../utils/backendUrl';
import { Alert } from 'react-native';

const { width } = Dimensions.get('window');

export default function DriverCctvScreen() {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [isWatching, setIsWatching] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [latestFrame, setLatestFrame] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showActivateBtn, setShowActivateBtn] = useState(false);
  const [rating, setRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const lastAlertTimeRef = React.useRef(0);

  const backendUrl = getBackendUrl();

  const submitPassengerRating = async (val) => {
    setRating(val);
    setSubmittingRating(true);
    try {
      const normalized = vehicleNumber.trim().toUpperCase();
      await addDoc(collection(db, 'passengerFeedback'), {
        vehicleNumber: normalized,
        rating: val,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser?.uid,
        driverState: latestFrame?.flag || 'UNKNOWN'
      });
      Alert.alert('Thank You!', 'Your safety feedback has been recorded.');
    } catch (err) {
      console.error('Rating error:', err);
    } finally {
      setSubmittingRating(false);
    }
  };

  const activateVehicle = async () => {
    setLoading(true);
    try {
      const normalized = vehicleNumber.trim().toUpperCase();
      await addDoc(collection(db, 'vehicles'), {
        number: normalized,
        status: 'active',
        name: `Demo Bus ${normalized}`,
        route: 'Main City Route'
      });
      setShowActivateBtn(false);
      handleStartWatching();
    } catch (err) {
      console.error('Activate vehicle error:', err);
      setError('Failed to activate vehicle in database.');
    } finally {
      setLoading(false);
    }
  };

  const getSafetyScore = () => {
    if (!latestFrame) return 100;
    let score = 100;
    if (latestFrame.flag === 'SLEEPING') score -= 70;
    if (latestFrame.flag === 'DISTRACTED') score -= 30;
    if (latestFrame.metrics?.isYawning) score -= 15;
    return Math.max(0, score);
  };
  const sendLocalAlert = async (flag, detail) => {
    const now = Date.now();
    // Throttle notifications to every 10 seconds to avoid spamming
    if (now - lastAlertTimeRef.current < 10000) return;
    lastAlertTimeRef.current = now;

    Vibration.vibrate([0, 500, 200, 500]); // Dangerous pattern

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Driver Alert: ${flag}`,
        body: detail || `The driver of ${vehicleNumber} needs attention!`,
        sound: true,
        priority: Notifications.AndroidImportance.MAX,
      },
      trigger: null,
    });
  };

  // We use a polling mechanism for the frame as it's more reliable across all platforms
  // than a raw MJPEG stream in a native Image component.
  useEffect(() => {
    let interval;
    let lastErrorTime = 0;
    if (isWatching && vehicleNumber) {
      const fetchFrame = async () => {
        try {
          const url = `${backendUrl}/ai/latest-frame/${vehicleNumber.trim().toUpperCase()}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            setLatestFrame(data);
            setError(null);

            // Trigger notification if status is dangerous
            if (data.flag === 'SLEEPING' || data.flag === 'DISTRACTED') {
              sendLocalAlert(data.flag, data.detail);
            }
          } else if (response.status === 404) {
            setError('Vehicle offline. Start streaming from bus_camera_streamer.html');
          } else {
            setError(`Error: ${response.status}`);
          }
        } catch (err) {
          // Network error - silent fail to avoid spam
          const now = Date.now();
          if (!lastErrorTime || now - lastErrorTime > 30000) {
            console.warn('Backend unavailable:', err.message);
            lastErrorTime = now;
          }
        }
      };

      fetchFrame();
      interval = setInterval(fetchFrame, 1000); // 1 FPS for passenger view
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isWatching, vehicleNumber, backendUrl]);

  const handleStartWatching = async () => {
    if (!vehicleNumber.trim()) {
      setError('Please enter a vehicle number.');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Check Firestore for ACTIVE vehicle status
      const normalized = vehicleNumber.trim().toUpperCase();
      const q = query(
        collection(db, 'vehicles'),
        where('number', '==', normalized),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError(`Vehicle ${normalized} is not registered as ACTIVE in the database.`);
        setShowActivateBtn(true);
        setIsWatching(false);
      } else {
        setShowActivateBtn(false);
        setIsWatching(true);
      }
    } catch (err) {
      console.error('Firestore check error:', err);
      setError('Failed to verify vehicle status.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopWatching = () => {
    setIsWatching(false);
    setLatestFrame(null);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.headerCard}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>Driver CCTV</Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Enter the bus or cab number to view the live driver safety feed.
          </Text>
          
          <TextInput
            label="Enter Bus/Cab Number"
            value={vehicleNumber}
            onChangeText={(text) => {
              setVehicleNumber(text.toUpperCase());
              if (isWatching) setIsWatching(false);
            }}
            placeholder="e.g. BUS-123"
            mode="outlined"
            style={styles.input}
            autoCapitalize="characters"
            left={<TextInput.Icon icon="bus" />}
          />

          {!isWatching ? (
            <Button 
              mode="contained" 
              onPress={handleStartWatching}
              style={styles.button}
              icon="video"
              loading={loading}
              disabled={loading}
            >
              Watch Live Feed
            </Button>
          ) : (
            <Button 
              mode="outlined" 
              onPress={handleStopWatching}
              style={styles.button}
              textColor="#C62828"
              icon="video-off"
            >
              Stop Watching
            </Button>
          )}
        </Card.Content>
      </Card>

      {error && (
        <Card style={styles.errorCard}>
          <Card.Content>
            <Text style={styles.errorText}>{error}</Text>
            {showActivateBtn && (
              <Button 
                mode="outlined" 
                onPress={activateVehicle} 
                style={{marginTop: 10}}
                loading={loading}
              >
                Register & Activate {vehicleNumber.toUpperCase()}
              </Button>
            )}
          </Card.Content>
        </Card>
      )}

      {isWatching && !error && (
        <Card style={styles.videoCard}>
          <Card.Title 
            title={`Live Feed: ${vehicleNumber.toUpperCase()}`}
            right={(props) => (
              <IconButton {...props} icon="refresh" onPress={() => {}} />
            )}
          />
          <Card.Content>
            <View style={styles.videoContainer}>
              {latestFrame?.imageBase64 ? (
                <Image 
                  source={{ uri: latestFrame.imageBase64 }} 
                  style={styles.videoFrame}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.placeholder}>
                  <ActivityIndicator animating={true} color="#6200ee" />
                  <Text style={styles.placeholderText}>Connecting to camera...</Text>
                </View>
              )}
            </View>

            {latestFrame && (
              <View style={styles.behaviorContainer}>
                <View style={styles.scoreHeader}>
                  <Text variant="titleMedium" style={styles.scoreTitle}>Driver Safety Score</Text>
                  <Text 
                    variant="headlineMedium" 
                    style={[styles.scoreValue, { color: getSafetyScore() > 80 ? '#2E7D32' : getSafetyScore() > 50 ? '#F57C00' : '#C62828' }]}
                  >
                    {getSafetyScore()}%
                  </Text>
                </View>
                <ProgressBar 
                  progress={getSafetyScore() / 100} 
                  color={getSafetyScore() > 80 ? '#2E7D32' : getSafetyScore() > 50 ? '#F57C00' : '#C62828'} 
                  style={styles.scoreBar} 
                />
                
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons name="eye-outline" size={24} color="#666" />
                    <Text variant="labelSmall">Eyes (EAR)</Text>
                    <Text variant="titleSmall">{latestFrame.metrics?.eyeAspectRatio || '0.0'}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons name="face-recognition" size={24} color="#666" />
                    <Text variant="labelSmall">Mouth (MAR)</Text>
                    <Text variant="titleSmall">{latestFrame.metrics?.mouthAspectRatio || '0.0'}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <MaterialCommunityIcons name="alarm-light-outline" size={24} color="#666" />
                    <Text variant="labelSmall">Risk Level</Text>
                    <Text variant="titleSmall">{latestFrame.severity || 'LOW'}</Text>
                  </View>
                </View>

                <View style={styles.ratingSection}>
                  <Text variant="labelMedium" style={styles.ratingTitle}>Rate your safety experience:</Text>
                  <View style={styles.starsContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <IconButton
                        key={star}
                        icon={rating >= star ? 'star' : 'star-outline'}
                        iconColor={rating >= star ? '#FFD600' : '#666'}
                        size={30}
                        onPress={() => submitPassengerRating(star)}
                        disabled={submittingRating}
                      />
                    ))}
                  </View>
                  {rating > 0 && <Text style={styles.thankYouText}>Feedback recorded! Thank you.</Text>}
                </View>
              </View>
            )}

            {latestFrame && (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text variant="labelSmall">DRIVER STATUS</Text>
                  <Text 
                    variant="titleMedium" 
                    style={[
                      styles.statusValue, 
                      { color: latestFrame.flag === 'NORMAL' ? '#2E7D32' : '#C62828' }
                    ]}
                  >
                    {latestFrame.flag === 'SLEEPING' ? '🚨 SLEEPING' : latestFrame.flag || 'UNKNOWN'}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="labelSmall">SEVERITY</Text>
                  <Text variant="titleMedium">{latestFrame.severity || 'LOW'}</Text>
                </View>
              </View>
            )}
            
            {latestFrame?.detail && (
              <Text style={styles.detailText}>
                Note: {latestFrame.detail}
              </Text>
            )}
          </Card.Content>
        </Card>
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
  headerCard: {
    marginBottom: 16,
    elevation: 2,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#666',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  button: {
    borderRadius: 8,
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    color: '#C62828',
    textAlign: 'center',
  },
  videoCard: {
    marginBottom: 32,
    elevation: 4,
    overflow: 'hidden',
  },
  videoContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#000',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoFrame: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    marginTop: 8,
  },
  behaviorContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreTitle: {
    color: '#666',
  },
  scoreValue: {
    fontWeight: 'bold',
  },
  scoreBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  ratingSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    alignItems: 'center',
  },
  ratingTitle: {
    color: '#666',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  thankYouText: {
    color: '#2E7D32',
    fontSize: 12,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  statItem: {
    flex: 1,
  },
  statusValue: {
    fontWeight: 'bold',
  },
  detailText: {
    marginTop: 12,
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
  }
});
