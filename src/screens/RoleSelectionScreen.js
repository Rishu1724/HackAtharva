import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Card, Button, Text, ActivityIndicator } from 'react-native-paper';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function RoleSelectionScreen({ navigation }) {
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    fetchUserRole();
  }, []);

  const fetchUserRole = async () => {
    try {
      if (!auth.currentUser?.uid) {
        Alert.alert(t('errors.generic'), t('errors.sessionExpired'));
        navigation.replace('Login');
        return;
      }

      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      let role = 'passenger';

      if (userDoc.exists()) {
        const incomingRole = userDoc.data().role;
        if (incomingRole === 'driver' || incomingRole === 'passenger') {
          role = incomingRole;
        }
      } else {
        // Backfill minimal profile for older accounts that don't have a users doc.
        await setDoc(userRef, {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email ?? '',
          role: 'passenger',
          createdAt: new Date().toISOString(),
          trustedContacts: [],
        });
      }

      setUserRole(role);

      // Auto-navigate based on role
      setTimeout(() => {
        navigateToRole(role);
      }, 1000);
    } catch (error) {
      Alert.alert(t('errors.generic'), t('errors.fetchUserFailed'));
    } finally {
      setLoading(false);
    }
  };

  const navigateToRole = (role) => {
    switch (role) {
      case 'passenger':
        navigation.replace('PassengerMain');
        break;
      case 'driver':
        navigation.replace('DriverMain');
        break;
      default:
        navigation.replace('PassengerMain');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{t('roleSelection.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <LanguageSwitcher />
          <Text variant="headlineMedium" style={styles.title}>
            {t('roleSelection.welcome')}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {t('roleSelection.registeredAs')} {userRole || t('roles.passenger')}
          </Text>

          <Button
            mode="contained"
            onPress={() => navigateToRole(userRole || 'passenger')}
            style={styles.button}
          >
            {t('roleSelection.continue')}
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    width: '100%',
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  button: {
    paddingVertical: 6,
  },
  loadingText: {
    marginTop: 16,
  },
});
