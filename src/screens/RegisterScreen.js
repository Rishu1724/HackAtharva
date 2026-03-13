import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { TextInput, Button, Text, Card, RadioButton } from 'react-native-paper';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('passenger');
  const [driverType, setDriverType] = useState('bus');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleRoute, setVehicleRoute] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleRegister = async () => {
    if (!name || !email || !password || !phone) {
      Alert.alert(t('errors.generic'), t('errors.fillAll'));
      return;
    }

    if (role === 'driver' && !vehicleNumber.trim()) {
      Alert.alert(t('errors.generic'), t('errors.driverVehicleMissing'));
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name,
        email,
        phone,
        role,
        createdAt: new Date().toISOString(),
        trustedContacts: [],
      });

      if (role === 'driver') {
        const capacityValue = Number(vehicleCapacity);
        await setDoc(doc(db, 'vehicles', user.uid), {
          driverId: user.uid,
          number: vehicleNumber.trim(),
          type: driverType,
          route: vehicleRoute.trim(),
          capacity: Number.isFinite(capacityValue) ? capacityValue : null,
          status: 'inactive',
          occupancy: 0,
          schedule: '',
          stops: [],
          cabQueue: 0,
          earningsToday: 0,
          ratingAvg: null,
          safetyScore: null,
          createdAt: new Date().toISOString(),
        });
      }

      Alert.alert(t('register.successTitle'), t('register.successMessage'));
    } catch (error) {
      Alert.alert(t('errors.registrationFailed'), error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Content>
            <LanguageSwitcher />

            <Text variant="headlineMedium" style={styles.title}>
              {t('register.title')}
            </Text>

            <TextInput
              label={t('auth.fullName')}
              value={name}
              onChangeText={setName}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label={t('auth.email')}
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />

            <TextInput
              label={t('auth.phone')}
              value={phone}
              onChangeText={setPhone}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />

            <TextInput
              label={t('auth.password')}
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />

            <Text variant="titleSmall" style={styles.roleTitle}>
              {t('auth.iam')}
            </Text>
            <RadioButton.Group onValueChange={setRole} value={role}>
              <View style={styles.radioOption}>
                <RadioButton value="passenger" />
                <Text>{t('roles.passenger')}</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="driver" />
                <Text>{t('roles.driver')}</Text>
              </View>
            </RadioButton.Group>

            {role === 'driver' && (
              <>
                <Text variant="titleSmall" style={styles.roleTitle}>
                  {t('auth.driverType')}
                </Text>
                <RadioButton.Group onValueChange={setDriverType} value={driverType}>
                  <View style={styles.radioOption}>
                    <RadioButton value="bus" />
                    <Text>{t('auth.driverBus')}</Text>
                  </View>
                  <View style={styles.radioOption}>
                    <RadioButton value="cab" />
                    <Text>{t('auth.driverCab')}</Text>
                  </View>
                </RadioButton.Group>

                <TextInput
                  label={t('auth.vehicleNumber')}
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  mode="outlined"
                  autoCapitalize="characters"
                  style={styles.input}
                />

                {driverType === 'bus' && (
                  <>
                    <TextInput
                      label={t('auth.routeName')}
                      value={vehicleRoute}
                      onChangeText={setVehicleRoute}
                      mode="outlined"
                      style={styles.input}
                    />
                    <TextInput
                      label={t('auth.capacity')}
                      value={vehicleCapacity}
                      onChangeText={setVehicleCapacity}
                      mode="outlined"
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                  </>
                )}
              </>
            )}

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              {t('auth.registerButton')}
            </Button>

            <Button
              mode="text"
              onPress={() => navigation.navigate('Login')}
              style={styles.linkButton}
            >
              {t('auth.haveAccount')}
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
  },
  roleTitle: {
    marginTop: 8,
    marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    paddingVertical: 6,
  },
  linkButton: {
    marginTop: 8,
  },
});
