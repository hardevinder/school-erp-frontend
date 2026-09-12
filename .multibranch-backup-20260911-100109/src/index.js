// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import 'bootstrap/dist/css/bootstrap.min.css';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";
import "bootstrap-icons/font/bootstrap-icons.css";


// Your Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// Initialize Firebase only if it hasn't been initialized already
let firebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp();
}

const messaging = getMessaging(firebaseApp);

// Register the Firebase Messaging service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then((registration) => {
      console.log('Service Worker registered with scope:', registration.scope);

      // Request notification permission after registration
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted.');
          // Retrieve the FCM token using your provided public VAPID key
          getToken(messaging, { vapidKey: 'BKj1clSXkQ77KiTQ23n_I_JE10Kr6ip-Itc-3oR6d6j_au4tnetaAd1c6-CUiprf0uV6pu4Z-KzWJ0DWuqh8Zmk' })
            .then((currentToken) => {
              if (currentToken) {
                console.log('FCM Token:', currentToken);
                // Optionally, send this token to your backend for future notifications.
              } else {
                console.log('No registration token available. Request permission to generate one.');
              }
            })
            .catch((err) => {
              console.error('An error occurred while retrieving token.', err);
            });
        } else {
          console.log('Notification permission not granted.');
        }
      });
    })
    .catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
