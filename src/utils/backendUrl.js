import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getBackendUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (fromEnv) {
    return fromEnv;
  }

  // 1. Prioritize auto-detect based on the bundler's host (works best in Expo Go)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8000`;
  }

  // 2. Fallback to hardcoded config if provided
  const fromConfig = Constants.expoConfig?.extra?.backendUrl || '';
  if (fromConfig) {
    return fromConfig;
  }

  // 3. Last resort for emulators/local development
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000'; // Standard Android emulator localhost
  }

  return 'http://localhost:8000';
}
