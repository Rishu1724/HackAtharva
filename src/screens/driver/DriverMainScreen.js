import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/LanguageSwitcher';

// Driver screens
import DriverHomeScreen from './DriverHomeScreen';
import DriverTripScreen from './DriverTripScreen';
import DriverProfileScreen from './DriverProfileScreen';
import DriverMonitoringScreen from './DriverMonitoringScreen';
import DriverRealtimeScreen from './DriverRealtimeScreen';

const Tab = createBottomTabNavigator();

export default function DriverMainScreen() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <LanguageSwitcher compact />,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'DriverHome') {
            iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
          } else if (route.name === 'DriverTrip') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'DriverMonitor') {
            iconName = focused ? 'shield-car' : 'shield-car-outline';
          } else if (route.name === 'DriverRealtime') {
            iconName = focused ? 'map-marker-radius' : 'map-marker-radius-outline';
          } else if (route.name === 'DriverProfile') {
            iconName = focused ? 'account' : 'account-outline';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="DriverHome" 
        component={DriverHomeScreen} 
        options={{ title: t('tabs.driverHome'), tabBarLabel: t('tabs.driverHome') }} 
      />
      <Tab.Screen 
        name="DriverTrip" 
        component={DriverTripScreen} 
        options={{ title: t('tabs.driverTrip'), tabBarLabel: t('tabs.driverTrip') }} 
      />
      <Tab.Screen
        name="DriverRealtime"
        component={DriverRealtimeScreen}
        options={{ title: t('tabs.driverRealtime'), tabBarLabel: t('tabs.driverRealtime') }}
      />
      <Tab.Screen
        name="DriverMonitor"
        component={DriverMonitoringScreen}
        options={{ title: t('tabs.driverMonitor'), tabBarLabel: t('tabs.driverMonitor') }}
      />
      <Tab.Screen 
        name="DriverProfile" 
        component={DriverProfileScreen} 
        options={{ title: t('tabs.driverProfile'), tabBarLabel: t('tabs.driverProfile') }} 
      />
    </Tab.Navigator>
  );
}
