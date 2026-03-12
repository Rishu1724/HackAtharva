import { collection, addDoc, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '../config/firebase';
import * as Notifications from 'expo-notifications';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  async initializeNotifications(userId) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return null;
      }

      // Get push token
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push token:', token);

      if (userId) {
        await setDoc(
          doc(db, 'users', userId),
          { expoPushToken: token },
          { merge: true }
        );
      }

      return token;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return null;
    }
  }

  async sendPushToToken(token, title, body, data = {}) {
    const backendUrl = Constants.expoConfig?.extra?.backendUrl || '';
    if (!backendUrl) {
      console.warn('backendUrl missing in app.json extra');
      return;
    }

    try {
      await fetch(`${backendUrl}/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, title, body, data }),
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  async notifyTripStart(userId, tripId) {
    try {
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();

      if (!userData.trustedContacts || userData.trustedContacts.length === 0) {
        return;
      }

      // Create notification records
      const notifications = userData.trustedContacts.map((contact) => ({
        recipientName: contact.name,
        recipientPhone: contact.phone,
        recipientEmail: contact.email,
        message: `${userData.name} has started a trip. You can now track their location in real-time.`,
        type: 'trip_start',
        tripId: tripId,
        timestamp: new Date().toISOString(),
        status: 'sent',
      }));

      // Save to Firestore
      for (const notification of notifications) {
        await addDoc(collection(db, 'notifications'), notification);
      }

      // Send push notification to the user
      if (userData.expoPushToken) {
        await this.sendPushToToken(
          userData.expoPushToken,
          'Trip Started',
          'Your trusted contacts have been notified and can track your journey.',
          { tripId: tripId }
        );
      }
    } catch (error) {
      console.error('Error notifying trip start:', error);
    }
  }

  async notifyRouteDeviation(tripId, location) {
    try {
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      const tripData = tripDoc.data();

      if (!tripData) return;

      const userDoc = await getDoc(doc(db, 'users', tripData.userId));
      const userData = userDoc.data();

      // Notify the passenger
      if (userData.expoPushToken) {
        await this.sendPushToToken(
          userData.expoPushToken,
          '⚠️ Route Deviation Detected',
          'The vehicle has deviated from the expected route. Your contacts have been notified.',
          { tripId: tripId, type: 'route_deviation' }
        );
      }

      // Notify trusted contacts
      if (userData.trustedContacts) {
        const notifications = userData.trustedContacts.map((contact) => ({
          recipientName: contact.name,
          recipientPhone: contact.phone,
          message: `⚠️ ALERT: ${userData.name}'s vehicle has deviated from the route. Location: ${location.latitude}, ${location.longitude}`,
          type: 'route_deviation',
          tripId: tripId,
          timestamp: new Date().toISOString(),
          status: 'sent',
        }));

        for (const notification of notifications) {
          await addDoc(collection(db, 'notifications'), notification);
        }
      }
    } catch (error) {
      console.error('Error notifying route deviation:', error);
    }
  }

  async notifySpeedViolation(tripId, speed) {
    try {
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      const tripData = tripDoc.data();
      if (!tripData) return;

      const userDoc = await getDoc(doc(db, 'users', tripData.userId));
      const userData = userDoc.data();

      if (userData?.expoPushToken) {
        await this.sendPushToToken(
          userData.expoPushToken,
          '⚠️ Speed Alert',
          `Vehicle speed is ${speed} km/h. Please ask the driver to slow down.`,
          { tripId: tripId, type: 'speed_violation', speed: speed }
        );
      }
    } catch (error) {
      console.error('Error notifying speed violation:', error);
    }
  }

  async notifyLongStop(tripId, duration) {
    try {
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      const tripData = tripDoc.data();

      if (!tripData) return;

      const userDoc = await getDoc(doc(db, 'users', tripData.userId));
      const userData = userDoc.data();

      // Notify the passenger
      if (userData.expoPushToken) {
        await this.sendPushToToken(
          userData.expoPushToken,
          '⚠️ Unusual Stop Detected',
          `Vehicle has been stopped for ${duration} minutes. Are you okay?`,
          { tripId: tripId, type: 'long_stop' }
        );
      }

      // Notify trusted contacts
      if (userData.trustedContacts) {
        const notifications = userData.trustedContacts.map((contact) => ({
          recipientName: contact.name,
          recipientPhone: contact.phone,
          message: `⚠️ ${userData.name}'s vehicle has been stopped for ${duration} minutes at an unusual location.`,
          type: 'long_stop',
          tripId: tripId,
          timestamp: new Date().toISOString(),
          status: 'sent',
        }));

        for (const notification of notifications) {
          await addDoc(collection(db, 'notifications'), notification);
        }
      }
    } catch (error) {
      console.error('Error notifying long stop:', error);
    }
  }

  async notifyTripEnd(tripId) {
    try {
      const tripDoc = await getDoc(doc(db, 'trips', tripId));
      const tripData = tripDoc.data();

      if (!tripData) return;

      const userDoc = await getDoc(doc(db, 'users', tripData.userId));
      const userData = userDoc.data();

      // Notify the passenger
      if (userData.expoPushToken) {
        await this.sendPushToToken(
          userData.expoPushToken,
          'Trip Completed',
          'Your trip has ended safely. Thank you for using Smart Transport Safety.',
          { tripId: tripId }
        );
      }

      // Notify trusted contacts
      if (userData.trustedContacts) {
        const notifications = userData.trustedContacts.map((contact) => ({
          recipientName: contact.name,
          recipientPhone: contact.phone,
          message: `${userData.name} has completed their trip safely.`,
          type: 'trip_end',
          tripId: tripId,
          timestamp: new Date().toISOString(),
          status: 'sent',
        }));

        for (const notification of notifications) {
          await addDoc(collection(db, 'notifications'), notification);
        }
      }
    } catch (error) {
      console.error('Error notifying trip end:', error);
    }
  }
}

export default new NotificationService();
