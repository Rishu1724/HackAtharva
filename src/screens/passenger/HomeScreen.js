import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  Vibration,
} from 'react-native';
import { Text, Card, Button, Portal, Modal, ProgressBar, List } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import SOSService from '../../services/SOSService';

export default function HomeScreen({ navigation }) {
  const [userName, setUserName] = useState('');
  const [nearbyVehicles, setNearbyVehicles] = useState([]);
  const [sosCountdown, setSosCountdown] = useState(10);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [sosModalVisible, setSosModalVisible] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchNearbyVehicles();
  }, []);

  useEffect(() => {
    let timer;
    if (isCountingDown && sosCountdown > 0) {
      timer = setInterval(() => {
        setSosCountdown((prev) => prev - 1);
        Vibration.vibrate(100);
      }, 1000);
    } else if (sosCountdown === 0) {
      triggerSOS();
    }
    return () => clearInterval(timer);
  }, [isCountingDown, sosCountdown]);

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

  const fetchNearbyVehicles = async () => {
    try {
      const vehiclesQuery = query(collection(db, 'vehicles'), where('status', '==', 'active'));
      const snapshot = await getDocs(vehiclesQuery);
      setNearbyVehicles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const handleSOSPress = () => {
    setIsCountingDown(true);
    setSosCountdown(10);
    setSosModalVisible(true);
    Vibration.vibrate(500);
  };

  const cancelSOS = () => {
    setIsCountingDown(false);
    setSosModalVisible(false);
    setSosCountdown(10);
  };

  const triggerSOS = async () => {
    setIsCountingDown(false);
    setSosModalVisible(false);
    try {
      await SOSService.triggerSOS();
      Alert.alert('Alert Sent', 'Your emergency contacts have been notified with your location.');
    } catch (error) {
      Alert.alert('Error', 'Failed to send SOS. Please call emergency services.');
    }
  };

  const handleEmergencyCall = () => {
    Alert.alert('Emergency Call', 'Call 112 (Emergency)?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => Linking.openURL('tel:112') },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Card style={styles.welcomeCard}>
          <Card.Content>
            <Text variant="headlineSmall">Welcome, {userName || 'User'}!</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>Stay safe on your journey</Text>
          </Card.Content>
        </Card>

        {/* SOS Button Area */}
        <View style={styles.sosContainer}>
          <TouchableOpacity style={styles.sosLargeButton} onPress={handleSOSPress}>
            <MaterialCommunityIcons name="alert-decagram" size={80} color="#fff" />
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.grid}>
          <Card style={styles.gridCard} onPress={() => navigation.navigate('Trip')}>
            <Card.Content style={styles.centerContent}>
              <MaterialCommunityIcons name="map-marker-path" size={32} color="#6200ee" />
              <Text variant="labelLarge">Start Trip</Text>
            </Card.Content>
          </Card>
          <Card style={styles.gridCard} onPress={handleEmergencyCall}>
            <Card.Content style={styles.centerContent}>
              <MaterialCommunityIcons name="phone-alert" size={32} color="#6200ee" />
              <Text variant="labelLarge">Emergency</Text>
            </Card.Content>
          </Card>
          <Card style={styles.gridCard} onPress={() => navigation.navigate('Behavior')}>
            <Card.Content style={styles.centerContent}>
              <MaterialCommunityIcons name="account-search" size={32} color="#6200ee" />
              <Text variant="labelLarge">Driver Behavior</Text>
            </Card.Content>
          </Card>
          <Card style={styles.gridCard} onPress={() => navigation.navigate('CCTV')}>
            <Card.Content style={styles.centerContent}>
              <MaterialCommunityIcons name="cctv" size={32} color="#6200ee" />
              <Text variant="labelLarge">Driver CCTV</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Nearby Vehicles */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Nearby Safe Vehicles</Text>
            {nearbyVehicles.length > 0 ? (
              nearbyVehicles.slice(0, 3).map(v => (
                <List.Item key={v.id} title={v.number} description={v.route} left={p => <List.Icon {...p} icon="bus" />} />
              ))
            ) : (
              <Text style={styles.emptyText}>No vehicles nearby.</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      {/* SOS Countdown Modal */}
      <Portal>
        <Modal visible={sosModalVisible} onDismiss={cancelSOS} contentContainerStyle={styles.modal}>
          <Text variant="headlineMedium" style={styles.modalTitle}>SENDING SOS ALERT</Text>
          <Text variant="displayLarge" style={styles.countdownText}>{sosCountdown}</Text>
          <ProgressBar progress={sosCountdown / 10} color="#f44336" style={styles.progress} />
          <Text style={styles.modalSub}>Emergency contacts will be notified in {sosCountdown} seconds.</Text>
          <Button mode="contained" onPress={cancelSOS} style={styles.cancelBtn} buttonColor="#000">
            CANCEL ALERT
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView: { flex: 1 },
  welcomeCard: { margin: 16, elevation: 0, backgroundColor: 'transparent' },
  subtitle: { color: '#666' },
  sosContainer: { alignItems: 'center', marginVertical: 20 },
  sosLargeButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#f44336',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  sosText: { color: '#fff', fontSize: 32, fontWeight: 'black', marginTop: 5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, justifyContent: 'space-between' },
  gridCard: { width: '46%', margin: '2%', elevation: 2 },
  centerContent: { alignItems: 'center', gap: 10 },
  card: { margin: 16, elevation: 2 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 10 },
  emptyText: { textAlign: 'center', color: '#999', padding: 20 },
  modal: { backgroundColor: 'white', padding: 30, margin: 20, borderRadius: 20, alignItems: 'center' },
  modalTitle: { color: '#f44336', fontWeight: 'bold', textAlign: 'center' },
  countdownText: { marginVertical: 20, fontWeight: 'bold', color: '#f44336' },
  progress: { width: '100%', height: 10, borderRadius: 5, marginBottom: 20 },
  modalSub: { textAlign: 'center', marginBottom: 30, color: '#666' },
  cancelBtn: { width: '100%', paddingVertical: 10 },
});
