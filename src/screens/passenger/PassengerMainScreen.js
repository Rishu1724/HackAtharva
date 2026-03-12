import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import NotificationService from '../../services/NotificationService';

// Passenger screens
import HomeScreen from './HomeScreen';
import TripScreen from './TripScreen';
import ContactsScreen from './ContactsScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

export default function PassengerMainScreen() {
  useEffect(() => {
    if (auth.currentUser?.uid) {
      NotificationService.initializeNotifications(auth.currentUser.uid);
    }
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Trip') {
            iconName = focused ? 'map-marker' : 'map-marker-outline';
          } else if (route.name === 'Contacts') {
            iconName = focused ? 'account-group' : 'account-group-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account' : 'account-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="Trip" component={TripScreen} options={{ title: 'Active Trip' }} />
      <Tab.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Trusted Contacts' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
