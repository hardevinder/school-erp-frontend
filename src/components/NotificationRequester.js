// src/components/NotificationRequester.js
import React, { useEffect } from "react";
import { getToken } from "firebase/messaging";
import { messaging } from "../firebase/firebaseConfig";
import axios from "axios";

const NotificationRequester = () => {
  const requestNotificationPermission = async () => {
    try {
      // Request user permission for notifications
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        // Use your complete VAPID public key from Firebase Cloud Messaging
        const vapidKey = "BKj1clSXkQ77KiTQ23n_I_JE10Kr6ip-Itc-3oR6d6j_au4tnetaAd1c6-CUiprf0uV6pu4Z-KzWJ0DWuqh8Zmk";
        
        // Get FCM token
        const currentToken = await getToken(messaging, { vapidKey });
        console.log("FCM Token:", currentToken);

        if (currentToken) {
          // Retrieve the username from localStorage (or update as needed)
          const username = localStorage.getItem('userName') || "default_username";
          // Send the token to your backend to save it with the user's record
          await axios.post(`${process.env.REACT_APP_API_URL}/users/save-token`, {
            username, 
            token: currentToken,
          });
        }
      } else {
        console.log("Notification permission not granted");
      }
    } catch (error) {
      console.error("Error retrieving token:", error);
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  return <div>Requesting Notification Permission...</div>;
};

export default NotificationRequester;
