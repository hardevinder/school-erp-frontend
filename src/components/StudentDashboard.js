// File: src/components/StudentDashboard.jsx
// Dashboard-only. Chat moved to ChatContainer (same as TeacherDashboard)

import React, { useMemo, useState, useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// NEW: the separated chat container
import ChatContainer from "./chat/ChatContainer";

export default function StudentDashboard() {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  // Load saved notifications
  useEffect(() => {
    const stored = localStorage.getItem("notifications");
    if (stored) setNotifications(JSON.parse(stored));
  }, []);

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
  };

  return (
    <div className="container-fluid px-3">
      {/* Page header */}
      <div className="dashboard-header bg-light px-3 py-2 mb-3 rounded d-flex align-items-center">
        <h5 className="mb-0">Student Dashboard</h5>

        <button
          type="button"
          className="btn btn-outline-secondary ms-auto me-2 position-relative"
          onClick={() => setShowNotifications(true)}
          title="Notifications"
        >
          Notifications
          {notifications.length > 0 && (
            <span
              className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
              style={{ fontSize: "0.7rem" }}
            >
              {notifications.length}
            </span>
          )}
        </button>
      </div>

      {/* TODO: Add student widgets/sections like in TeacherDashboard */}

      {/* Notifications Overlay */}
      {showNotifications && (
        <div
          style={{
            position: "fixed",
            top: 70,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1200,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          aria-modal="true"
          role="dialog"
        >
          <div
            style={{
              background: "#fff",
              width: "90%",
              maxWidth: "600px",
              maxHeight: "80%",
              overflowY: "auto",
              borderRadius: "8px",
              padding: "16px",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowNotifications(false)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                fontSize: "1.5rem",
                border: "none",
                background: "none",
              }}
              aria-label="Close notifications"
            >
              ×
            </button>

            {/* TODO: Render notifications list here */}

            <button onClick={clearAllNotifications} className="btn btn-primary mt-3">
              Clear All Notifications
            </button>
          </div>
        </div>
      )}

      <ToastContainer />

      {/* 👇 Floating chat container (same as TeacherDashboard) */}
      <ChatContainer />
    </div>
  );
}
