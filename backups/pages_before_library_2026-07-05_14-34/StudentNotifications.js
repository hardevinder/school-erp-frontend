import React from "react";

const StudentNotifications = ({ notifications, removeNotification }) => {
  return (
    <div className="student-notifications">
      <h3>Notifications</h3>
      {notifications && notifications.length > 0 ? (
        notifications.map((notif) => (
          <div
            key={notif.id}
            className="card mb-2"
            style={{ position: "relative" }}
          >
            <span
              style={{
                position: "absolute",
                top: "5px",
                right: "10px",
                cursor: "pointer",
                fontWeight: "bold",
                color: "#888",
                fontSize: "1.2rem",
              }}
              onClick={() => removeNotification(notif.id)}
            >
              ×
            </span>
            <div className="card-body">
              <h5 className="card-title">{notif.title}</h5>
              <p className="card-text">{notif.message}</p>
            </div>
          </div>
        ))
      ) : (
        <p>No notifications available.</p>
      )}
    </div>
  );
};

export default StudentNotifications;
