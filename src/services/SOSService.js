import { collection, addDoc, doc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import * as Notifications from 'expo-notifications';

class SOSService {
  async triggerSOS(location, tripId = null) {
    try {
      // Create SOS alert in Firestore
      const sosRef = await addDoc(collection(db, 'sosAlerts'), {
        userId: auth.currentUser.uid,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        timestamp: new Date().toISOString(),
        status: 'active',
        tripId: tripId,
        type: 'manual',
      });

      // Get user data including trusted contacts
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();

      // Send notifications to trusted contacts
      if (userData.trustedContacts && userData.trustedContacts.length > 0) {
        await this.notifyTrustedContacts(
          userData.trustedContacts,
          userData.name,
          location,
          sosRef.id
        );
      }

      // Notify authorities (in real app, this would integrate with emergency services)
      await this.notifyAuthorities(userData, location);

      // Update trip if exists
      if (tripId) {
        await updateDoc(doc(db, 'trips', tripId), {
          sosAlert: {
            id: sosRef.id,
            timestamp: new Date().toISOString(),
            location: location,
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

  async notifyTrustedContacts(contacts, userName, location, sosId) {
    try {
      // In a real app, this would send SMS/Email/Push notifications
      // For demo, we'll create notification records in Firestore
      
      const notifications = contacts.map((contact) => ({
        recipientName: contact.name,
        recipientPhone: contact.phone,
        recipientEmail: contact.email,
        message: `🚨 EMERGENCY ALERT: ${userName} has triggered an SOS alert. Location: ${location.latitude}, ${location.longitude}. Track them immediately!`,
        type: 'sos',
        sosId: sosId,
        timestamp: new Date().toISOString(),
        status: 'sent',
      }));

      // Save notifications to Firestore
      for (const notification of notifications) {
        await addDoc(collection(db, 'notifications'), notification);
      }

      // Send push notifications (if tokens available)
      await this.sendPushNotifications(contacts, userName, location);
    } catch (error) {
      console.error('Error notifying trusted contacts:', error);
    }
  }

  async sendPushNotifications(contacts, userName, location) {
    try {
      // In a real app, you would:
      // 1. Get push tokens for each contact from Firestore
      // 2. Use Firebase Cloud Messaging or Expo Push Notifications
      // 3. Send immediate push notifications
      
      const message = {
        title: '🚨 EMERGENCY SOS ALERT',
        body: `${userName} needs immediate help! Tap to view location.`,
        data: {
          type: 'sos',
          location: location,
          userName: userName,
        },
      };

      // For demo purposes, log the notification
      console.log('Push notification sent:', message);
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }

  async notifyAuthorities(userData, location) {
    try {
      // Create authority notification record
      await addDoc(collection(db, 'authorityAlerts'), {
        userId: auth.currentUser.uid,
        userName: userData.name,
        userPhone: userData.phone,
        location: location,
        timestamp: new Date().toISOString(),
        type: 'sos',
        status: 'pending',
      });

      // In a real implementation, this would:
      // 1. Send to police control room API
      // 2. Trigger emergency dispatch system
      // 3. Send SMS to local police station
      
      console.log('Authorities notified');
    } catch (error) {
      console.error('Error notifying authorities:', error);
    }
  }

  async autoTriggerSOS(userId, reason, location, tripId) {
    try {
      // Automatic SOS triggered by AI/sensors
      const sosRef = await addDoc(collection(db, 'sosAlerts'), {
        userId: userId,
        location: location,
        timestamp: new Date().toISOString(),
        status: 'active',
        tripId: tripId,
        type: 'automatic',
        reason: reason, // e.g., "route_deviation", "speed_violation", "long_stop"
      });

      // Get user data and notify
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();

      if (userData.trustedContacts) {
        await this.notifyTrustedContacts(
          userData.trustedContacts,
          userData.name,
          location,
          sosRef.id
        );
      }

      return sosRef.id;
    } catch (error) {
      console.error('Error auto-triggering SOS:', error);
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
