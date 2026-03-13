import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth } from '../../config/firebase';
import NotificationService from '../../services/NotificationService';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';

// Passenger screens
import HomeScreen from './HomeScreen';
import TripScreen from './TripScreen';
import ContactsScreen from './ContactsScreen';
import ProfileScreen from './ProfileScreen';
import DriverCctvScreen from './DriverCctvScreen';

const Tab = createBottomTabNavigator();

export default function PassengerMainScreen() {
  const { t } = useTranslation();

  useEffect(() => {
    if (auth.currentUser?.uid) {
      NotificationService.initializeNotifications(auth.currentUser.uid);
    }
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <LanguageSwitcher compact />,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Trip') {
            iconName = focused ? 'map-marker' : 'map-marker-outline';
          } else if (route.name === 'Contacts') {
            iconName = focused ? 'account-group' : 'account-group-outline';
          } else if (route.name === 'CCTV') {
            iconName = focused ? 'cctv' : 'cctv';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'account' : 'account-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('tabs.passengerHome'), tabBarLabel: t('tabs.passengerHome') }}
      />
      <Tab.Screen
        name="Trip"
        component={TripScreen}
        options={{ title: t('tabs.passengerTrip'), tabBarLabel: t('tabs.passengerTrip') }}
      />
      <Tab.Screen
        name="CCTV"
        component={DriverCctvScreen}
        options={{ title: t('tabs.passengerCctv'), tabBarLabel: t('tabs.passengerCctv') }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ title: t('tabs.passengerContacts'), tabBarLabel: t('tabs.passengerContacts') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('tabs.passengerProfile'), tabBarLabel: t('tabs.passengerProfile') }}
      />
    </Tab.Navigator>
  );
}
