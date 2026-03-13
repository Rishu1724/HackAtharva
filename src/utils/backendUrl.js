import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getBackendUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv) {
    return fromEnv;
  }

  const fromConfig = Constants.expoConfig?.extra?.backendUrl || '';
  if (fromConfig) {
    return fromConfig;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}
