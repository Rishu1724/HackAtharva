import { collection, addDoc, doc, getDoc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import NotificationService from './NotificationService';
import { getBackendUrl } from '../utils/backendUrl';

class SOSService {
  async triggerSOS(location, tripId = null) {
    try {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) {
        throw new Error('User not authenticated');
      }

      const normalizedLocation = location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
          }
        : null;

      // Create SOS alert in Firestore
      const sosRef = await addDoc(collection(db, 'sosAlerts'), {
        userId: currentUserId,
        location: normalizedLocation,
        timestamp: new Date().toISOString(),
        status: 'active',
        tripId: tripId,
        type: 'manual',
      });

      // Get user data including trusted contacts
      const userDoc = await getDoc(doc(db, 'users', currentUserId));
      const userData = userDoc.data() || {};
      const safeUserName = userData.name || userData.email || userData.phone || 'Passenger';

      // Send notifications to trusted contacts
      if (Array.isArray(userData.trustedContacts) && userData.trustedContacts.length > 0) {
        await this.notifyTrustedContacts(
          userData.trustedContacts,
          safeUserName,
          normalizedLocation,
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

  async notifyTrustedContacts(contacts, userName, location, sosId) {
    try {
      // In a real app, this would send SMS/Email/Push notifications
      // For demo, we'll create notification records in Firestore

      const mapUrl = location
        ? `https://maps.google.com/?q=${location.latitude},${location.longitude}`
        : null;
      const safeUserName = userName || 'Passenger';
      const cleanContacts = (contacts || []).filter(
        (contact) => contact && (contact.name || contact.phone || contact.email)
      );
      
      const notifications = cleanContacts.map((contact) => ({
        recipientName: contact.name || 'Trusted Contact',
        recipientPhone: contact.phone || null,
        recipientEmail: contact.email || null,
        message: mapUrl
          ? `🚨 SOS ALERT: ${safeUserName} needs help now. Location: ${location.latitude}, ${location.longitude}. Map: ${mapUrl}`
          : `🚨 SOS ALERT: ${safeUserName} needs help now. Location unavailable. Please contact immediately.`,
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
      await this.sendPushNotifications(cleanContacts, safeUserName, location, mapUrl);

      // Email contacts when addresses are available
      await this.sendEmailNotifications(cleanContacts, safeUserName, location, mapUrl);
    } catch (error) {
      console.error('Error notifying trusted contacts:', error);
    }
  }

  async sendEmailNotifications(contacts, userName, location, mapUrl) {
    try {
      const backendUrl = getBackendUrl();
      if (!backendUrl) {
        console.warn('Backend URL missing. Skipping SOS email notifications.');
        return;
      }

      const contactsWithEmail = (contacts || []).filter((contact) => contact?.email);
      if (contactsWithEmail.length === 0) {
        return;
      }

      const locationLines = location
        ? [
            'Live coordinates attached below:',
            `Latitude: ${location.latitude}`,
            `Longitude: ${location.longitude}`,
            mapUrl ? `Map: ${mapUrl}` : null,
          ].filter(Boolean)
        : [
            'GPS is unavailable right now. Please call or message immediately to confirm safety.',
            'Share their last known location if you have it.',
          ];

      await Promise.all(
        contactsWithEmail.map(async (contact) => {
          const response = await fetch(`${backendUrl}/alerts/email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toEmail: contact.email,
              subject: `🚨 SOS Alert for ${userName}`,
              body: [
                `${userName} has triggered an SOS alert and needs immediate help.`,
                ...locationLines,
                'Please respond right away.',
              ].join('\n'),
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Failed to send SOS email to ${contact.email}:`, errorText);
          }
        })
      );
    } catch (error) {
      console.error('Error sending SOS email notifications:', error);
    }
  }

  async sendPushNotifications(contacts, userName, location, mapUrl) {
    try {
      for (const contact of contacts) {
        const tokens = await this.resolveContactTokens(contact);
        for (const token of tokens) {
          await NotificationService.sendPushToToken(
            token,
            '🚨 SOS ALERT',
            mapUrl
              ? `${userName} needs help now. Tap to view location.`
              : `${userName} needs help now. Location unavailable, contact immediately.`,
            { type: 'sos', location, userName, mapUrl }
          );
        }
      }
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }

  async resolveContactTokens(contact) {
    const tokens = new Set();

    try {
      if (contact.phone) {
        const phoneSnap = await getDocs(
          query(collection(db, 'users'), where('phone', '==', contact.phone))
        );
        phoneSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.expoPushToken) tokens.add(data.expoPushToken);
        });
      }

      if (contact.email) {
        const emailSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', contact.email))
        );
        emailSnap.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.expoPushToken) tokens.add(data.expoPushToken);
        });
      }
    } catch (error) {
      console.error('Error resolving contact tokens:', error);
    }

    return Array.from(tokens);
  }

  async notifyAuthorities(userData, location) {
    try {
      const currentUserId = auth.currentUser?.uid;
      if (!currentUserId) return;

      const safeUserName = userData?.name || userData?.email || userData?.phone || 'Passenger';
      const normalizedLocation = location
        ? {
            latitude: location.latitude ?? location.lat ?? null,
            longitude: location.longitude ?? location.lng ?? null,
          }
        : null;

      // Create authority notification record
      await addDoc(collection(db, 'authorityAlerts'), {
        userId: currentUserId,
        userName: safeUserName,
        userPhone: userData?.phone || null,
        location: normalizedLocation,
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
      const userData = userDoc.data() || {};
      const safeUserName = userData.name || userData.email || userData.phone || 'Passenger';

      if (Array.isArray(userData.trustedContacts) && userData.trustedContacts.length > 0) {
        await this.notifyTrustedContacts(
          userData.trustedContacts,
          safeUserName,
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
