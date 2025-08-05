import React, { useEffect, useState } from 'react';
import socket from '../socket'; // Adjust the path as needed

const NotificationComponent = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleNotification = (eventName, data) => {
      console.log(`${eventName} received:`, data);
      // You could optionally build a custom message here as well.
      setNotifications((prev) => [...prev, { ...data, event: eventName, id: Date.now() }]);
      window.alert(`${data.title}: ${data.message}`);
    };

    const notificationEvents = [
      "fee-notification",
      "payment-notification",
      "general-notification",
      "assignmentAssigned",
      "assignmentUpdated",
      "assignmentDeleted",
    ];
    notificationEvents.forEach((eventName) => {
      socket.on(eventName, (data) => {
        handleNotification(eventName, data);
      });
    });
    return () => {
      notificationEvents.forEach((eventName) => {
        socket.off(eventName);
      });
    };
  }, []);

  return (
    <div>
      <h3>Notifications</h3>
      {notifications.length > 0 ? (
        <ul>
          {notifications.map((notif, index) => (
            <li key={index}>
              {notif.assignmentId ? (
                <div>
                  <strong>{notif.title}</strong>
                  <p>
                    Subject: {notif.subject || "N/A"} | Teacher: {notif.teacher || "N/A"}
                  </p>
                  <p>
                    Due:{" "}
                    {notif.dueDate
                      ? new Date(notif.dueDate).toLocaleDateString()
                      : "N/A"}
                  </p>
                  <p>Remarks: {notif.remarks || "None"}</p>
                </div>
              ) : (
                <div>
                  <strong>{notif.title || "Notification"}</strong>: {notif.message}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No notifications yet.</p>
      )}
    </div>
  );
};

export default NotificationComponent;
