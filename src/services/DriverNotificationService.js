import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class DriverNotificationService {
  async initializeDriverNotifications(driverId) {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await setDoc(
        doc(db, 'users', driverId),
        { expoPushToken: token },
        { merge: true }
      );

      return token;
    } catch (error) {
      console.error('Driver notifications init failed:', error);
      return null;
    }
  }

  async notifyLocal(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: null,
      });
    } catch (error) {
      console.error('Local notification failed:', error);
    }
  }
}

export default new DriverNotificationService();
