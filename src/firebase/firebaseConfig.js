// src/firebase/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Firestore
import { getMessaging } from "firebase/messaging";  // Firebase Cloud Messaging

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDhLPCQeeFkI2yD5p1m3srmGCoUY-HirR4",
  authDomain: "schoolerp-143ea.firebaseapp.com",
  projectId: "schoolerp-143ea",
  storageBucket: "schoolerp-143ea.firebasestorage.app",
  messagingSenderId: "667315534601",
  appId: "1:667315534601:web:88374444bfed568d7ab1d8",
  measurementId: "G-BKD8C7X90K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Authentication, Firestore, and Messaging
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);
const messaging = getMessaging(app);

// Export the services for use in your app
export { auth, provider, signInWithPopup, signOut, firestore, messaging };
