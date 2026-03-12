import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { PaperProvider } from 'react-native-paper';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './src/config/firebase';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RoleSelectionScreen from './src/screens/RoleSelectionScreen';
import PassengerMainScreen from './src/screens/passenger/PassengerMainScreen';
import DriverMainScreen from './src/screens/driver/DriverMainScreen';
import AdminDashboard from './src/screens/admin/AdminDashboard';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
              <Stack.Screen name="PassengerMain" component={PassengerMainScreen} />
              <Stack.Screen name="DriverMain" component={DriverMainScreen} />
              {Platform.OS === 'web' && (
                <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
              )}
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
