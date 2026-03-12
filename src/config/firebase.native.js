// Native (Android/iOS) Firebase initialization
import { initializeApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCx_IivZJolhIaiqJQPPcJUnnCjV3FBAwQ",
  authDomain: "hackatharva-9798c.firebaseapp.com",
  databaseURL: "https://hackatharva-9798c-default-rtdb.firebaseio.com",
  projectId: "hackatharva-9798c",
  storageBucket: "hackatharva-9798c.firebasestorage.app",
  messagingSenderId: "352203554039",
  appId: "1:352203554039:web:b96d320fc61fb34b4d67f2"
};

const app = initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export default app;
