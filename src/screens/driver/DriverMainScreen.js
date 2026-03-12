import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Driver screens
import DriverHomeScreen from './DriverHomeScreen';
import DriverTripScreen from './DriverTripScreen';
import DriverProfileScreen from './DriverProfileScreen';
import DriverMonitoringScreen from './DriverMonitoringScreen';
import DriverRealtimeScreen from './DriverRealtimeScreen';

const Tab = createBottomTabNavigator();

export default function DriverMainScreen() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
        options={{ title: 'Dashboard' }} 
      />
      <Tab.Screen 
        name="DriverTrip" 
        component={DriverTripScreen} 
        options={{ title: 'Active Trip' }} 
      />
      <Tab.Screen
        name="DriverRealtime"
        component={DriverRealtimeScreen}
        options={{ title: 'Realtime' }}
      />
      <Tab.Screen
        name="DriverMonitor"
        component={DriverMonitoringScreen}
        options={{ title: 'Monitoring' }}
      />
      <Tab.Screen 
        name="DriverProfile" 
        component={DriverProfileScreen} 
        options={{ title: 'Profile' }} 
      />
    </Tab.Navigator>
  );
}
