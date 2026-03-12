// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCx_IivZJolhIaiqJQPPcJUnnCjV3FBAwQ",
  authDomain: "hackatharva-9798c.firebaseapp.com",
  databaseURL: "https://hackatharva-9798c-default-rtdb.firebaseio.com",
  projectId: "hackatharva-9798c",
  storageBucket: "hackatharva-9798c.firebasestorage.app",
  messagingSenderId: "352203554039",
  appId: "1:352203554039:web:b96d320fc61fb34b4d67f2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services (web)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);

// Initialize messaging for web (optional, for push notifications)
let messaging = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

export { messaging };
export default app;
