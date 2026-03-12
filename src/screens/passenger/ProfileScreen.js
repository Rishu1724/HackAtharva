import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, List, Divider, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [settings, setSettings] = useState({
    locationSharing: true,
    autoSOS: false,
    soundAlerts: true,
    vibrationAlerts: true,
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserData(data);
        if (data.settings) {
          setSettings({ ...settings, ...data.settings });
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        settings: newSettings,
      });
    } catch (error) {
      console.error('Error updating settings:', error);
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
      {/* Profile Info */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.profileHeader}>
            <MaterialCommunityIcons name="account-circle" size={80} color="#6200ee" />
            <View style={styles.profileInfo}>
              <Text variant="headlineSmall">{userData?.name || 'User'}</Text>
              <Text variant="bodyMedium" style={styles.email}>
                {userData?.email}
              </Text>
              <Text variant="bodySmall" style={styles.phone}>
                {userData?.phone}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Safety Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Safety Settings
          </Text>
          
          <List.Item
            title="Location Sharing"
            description="Share location with trusted contacts during trips"
            left={(props) => <List.Icon {...props} icon="map-marker" />}
            right={() => (
              <Switch
                value={settings.locationSharing}
                onValueChange={(value) => updateSetting('locationSharing', value)}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Auto SOS Detection"
            description="Automatically trigger SOS on unusual activity"
            left={(props) => <List.Icon {...props} icon="alert-circle" />}
            right={() => (
              <Switch
                value={settings.autoSOS}
                onValueChange={(value) => updateSetting('autoSOS', value)}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Sound Alerts"
            description="Play sound for safety alerts"
            left={(props) => <List.Icon {...props} icon="volume-high" />}
            right={() => (
              <Switch
                value={settings.soundAlerts}
                onValueChange={(value) => updateSetting('soundAlerts', value)}
              />
            )}
          />
          <Divider />
          
          <List.Item
            title="Vibration Alerts"
            description="Vibrate for safety alerts"
            left={(props) => <List.Icon {...props} icon="vibrate" />}
            right={() => (
              <Switch
                value={settings.vibrationAlerts}
                onValueChange={(value) => updateSetting('vibrationAlerts', value)}
              />
            )}
          />
        </Card.Content>
      </Card>

      {/* Trip Statistics */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Trip Statistics
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {userData?.tripStats?.total || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Total Trips
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {userData?.tripStats?.safe || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                Safe Trips
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {userData?.tripStats?.sos || 0}
              </Text>
              <Text variant="bodySmall" style={styles.statLabel}>
                SOS Alerts
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Emergency Contacts */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Emergency Numbers
          </Text>
          <List.Item
            title="Police"
            description="100"
            left={(props) => <List.Icon {...props} icon="police-badge" />}
          />
          <List.Item
            title="Ambulance"
            description="102"
            left={(props) => <List.Icon {...props} icon="ambulance" />}
          />
          <List.Item
            title="Women Helpline"
            description="1091"
            left={(props) => <List.Icon {...props} icon="phone-alert" />}
          />
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
            View Trip History
          </Button>
          <Button
            mode="outlined"
            icon="shield-check"
            style={styles.actionButton}
          >
            Safety Report
          </Button>
          <Button
            mode="outlined"
            icon="help-circle"
            style={styles.actionButton}
          >
            Help & Support
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
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: '#6200ee',
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  actionButton: {
    marginBottom: 12,
  },
  logoutButton: {
    margin: 16,
    marginBottom: 32,
  },
});
