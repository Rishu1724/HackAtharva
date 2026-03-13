import { collection, addDoc, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import Constants from 'expo-constants';
import { db } from '../config/firebase';
import * as Notifications from 'expo-notifications';
import { getBackendUrl } from '../utils/backendUrl';

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

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.expoConfig?.extra?.projectId;

      // Get push token
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
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
      console.warn(
        'Notifications not ready. Configure FCM credentials for Android push.',
        error
      );
      return null;
    }
  }

  async sendPushToToken(token, title, body, data = {}) {
    const backendUrl = getBackendUrl();
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
          '⚠️ Route Alert',
          'Driver is off the planned route. Please check with the driver immediately.',
          { tripId: tripId, type: 'route_deviation' }
        );
      }

      // Notify trusted contacts
      if (userData.trustedContacts) {
        const notifications = userData.trustedContacts.map((contact) => ({
          recipientName: contact.name,
          recipientPhone: contact.phone,
          message: `⚠️ Route alert for ${userData.name}. Driver is off the planned route. Location: ${location.latitude}, ${location.longitude}.`,
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
          `Driver speed is ${speed} km/h. Please ask the driver to slow down.`,
          { tripId: tripId, type: 'speed_violation', speed: speed }
        );
      }
    } catch (error) {
      console.error('Error notifying speed violation:', error);
    }
  }

  async notifyDriverAlert(driverId, flag) {
    try {
      const passengersSnapshot = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'passenger'))
      );

      const tokens = passengersSnapshot.docs
        .map((doc) => doc.data().expoPushToken)
        .filter(Boolean);

      const title = flag === 'DROWSY' ? '⚠️ Driver Drowsiness Alert' : '⚠️ Driver Distraction Alert';
      const body =
        flag === 'DROWSY'
          ? 'Driver appears drowsy. Stay alert and be ready to use SOS.'
          : 'Driver appears distracted. Stay alert and be ready to use SOS.';

      await Promise.all(
        tokens.map((token) =>
          this.sendPushToToken(token, title, body, { driverId, type: 'driver_alert', flag })
        )
      );
    } catch (error) {
      console.error('Error notifying driver alert:', error);
    }
  }

  async notifyRouteDeviationBroadcast(driverId, location, distanceMeters) {
    try {
      const passengersSnapshot = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'passenger'))
      );

      const tokens = passengersSnapshot.docs
        .map((doc) => doc.data().expoPushToken)
        .filter(Boolean);

      const title = '⚠️ Route Change Alert';
      const body = `Driver is off the planned route by ${distanceMeters}m. Please stay alert.`;

      await Promise.all(
        tokens.map((token) =>
          this.sendPushToToken(token, title, body, {
            driverId,
            type: 'route_deviation',
            location,
            distance: distanceMeters,
          })
        )
      );
    } catch (error) {
      console.error('Error broadcasting route deviation:', error);
    }
  }

  async notifyPassengersForDriver(driverId, title, body, data = {}) {
    try {
      const tripsSnapshot = await getDocs(
        query(
          collection(db, 'trips'),
          where('driverId', '==', driverId),
          where('status', '==', 'active')
        )
      );

      if (tripsSnapshot.empty) return;

      const userIds = tripsSnapshot.docs
        .map((doc) => doc.data().userId)
        .filter(Boolean);

      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();
        if (userData?.expoPushToken) {
          await this.sendPushToToken(userData.expoPushToken, title, body, {
            driverId,
            ...data,
          });
        }
      }
    } catch (error) {
      console.error('Error notifying passengers for driver:', error);
    }
  }

  async recordDriverIncident(driverId, vehicleNumber, flag, action, severity) {
    try {
      const alertDoc = {
        driverId,
        vehicleNumber: vehicleNumber || null,
        flag,
        action,
        severity,
        timestamp: new Date().toISOString(),
      };

      await addDoc(collection(db, 'driverAlerts'), alertDoc);

      const title = severity === 'HIGH' ? '🚨 Critical Driver Alert' : '⚠️ Driver Alert';
      const body = action ||
        (flag === 'DROWSY'
          ? 'Driver appears drowsy. Please stay alert.'
          : 'Driver appears distracted. Please stay alert.');

      await this.notifyPassengersForDriver(driverId, title, body, {
        type: 'driver_behavior',
        flag,
        severity,
        action,
        vehicleNumber,
      });
    } catch (error) {
      console.error('Error recording driver incident:', error);
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
          `Vehicle has been stopped for ${duration} minutes at an unexpected location. Are you okay?`,
          { tripId: tripId, type: 'long_stop' }
        );
      }

      // Notify trusted contacts
      if (userData.trustedContacts) {
        const notifications = userData.trustedContacts.map((contact) => ({
          recipientName: contact.name,
          recipientPhone: contact.phone,
          message: `⚠️ Unusual stop alert for ${userData.name}. Vehicle stopped for ${duration} minutes at an unexpected location.`,
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
