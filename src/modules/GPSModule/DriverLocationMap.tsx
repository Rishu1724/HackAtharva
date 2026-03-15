import React from 'react';
import { Platform } from 'react-native';
import NativeMap from './DriverLocationMap.native';
import WebMap from './DriverLocationMap.web';

export default function DriverLocationMap(props: any) {
  if (Platform.OS === 'web') {
    return <WebMap {...props} />;
  }
  return <NativeMap {...props} />;
}
