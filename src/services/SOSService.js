import { Linking, Platform, Vibration } from 'react-native';
import * as Location from 'expo-location';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

class SOSService {
  async triggerSOS(location = null, tripId = null) {
    try {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }

      // Vibrate the phone when SOS is activated
      Vibration.vibrate([500, 500, 500]);

      // 1. Get current GPS location if not provided
      let currentLoc = location;
      if (!currentLoc) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          currentLoc = pos.coords;
        }
      }

      const normalizedLocation = currentLoc
        ? {
            latitude: currentLoc.latitude,
            longitude: currentLoc.longitude,
          }
        : null;

      const mapUrl = normalizedLocation
        ? `https://maps.google.com/?q=${normalizedLocation.latitude},${normalizedLocation.longitude}`
        : null;

      // 2. Store SOS alert in Firestore
      const sosRef = await addDoc(collection(db, 'sosAlerts'), {
        userId: currentUserId,
        location: normalizedLocation,
        timestamp: new Date().toISOString(),
        status: 'active',
        tripId: tripId,
        type: 'manual',
      });

      // 3. Get emergency contacts from Firestore
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data() || {};
      const contacts = userData.trustedContacts || [];
      const safeUserName = userData.name || 'A Passenger';

      // 4. Send SMS to all emergency contacts
      if (contacts.length > 0) {
        const phoneNumbers = contacts.map(c => c.phone).filter(Boolean);
        const message = `🚨 SOS Alert! I need help.\nMy current location:\n${mapUrl || 'Location unavailable'}`;

        if (phoneNumbers.length > 0) {
          try {
            // Dynamic require to prevent crash on app load if native module is missing
            const SMS = require('expo-sms');
            
            if (SMS && typeof SMS.isAvailableAsync === 'function') {
              const isAvailable = await SMS.isAvailableAsync();
              if (isAvailable) {
                await SMS.sendSMSAsync(phoneNumbers, message);
              } else {
                throw new Error('SMS not available');
              }
            } else {
              throw new Error('ExpoSMS module not found');
            }
          } catch (smsError) {
            console.warn('ExpoSMS fallback:', smsError.message);
            // Universal fallback using Linking (works on all platforms/emulators)
            const url = `sms:${phoneNumbers.join(',')}?body=${encodeURIComponent(message)}`;
            Linking.openURL(url);
          }
        }

        // 5. Automatically start a phone call to the first emergency contact
        if (contacts[0]?.phone) {
          setTimeout(() => {
            Linking.openURL(`tel:${contacts[0].phone}`);
          }, 2000); // Small delay to allow SMS processing
        }
      }

      // Update trip if exists
      if (tripId) {
        await updateDoc(doc(db, 'trips', tripId), {
          sosAlert: {
            id: sosRef.id,
            timestamp: new Date().toISOString(),
            location: normalizedLocation,
          },
          status: 'emergency',
        });
      }

      return sosRef.id;
    } catch (error) {
      console.error('Error triggering SOS:', error);
      throw error;
    }
  }

  async resolveSOS(sosId) {
    try {
      await updateDoc(doc(db, 'sosAlerts', sosId), {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error resolving SOS:', error);
      throw error;
    }
  }
}

export default new SOSService();
