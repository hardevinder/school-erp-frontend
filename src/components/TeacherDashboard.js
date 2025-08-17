// src/components/TeacherDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { firestore } from "../firebase/firebaseConfig.js";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import socket from "../socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Teacher overview widgets
import LatestTeacherCirculars from "../pages/LatestTeacherCirculars";
import LatestTeacherSubstitutions from "../pages/LatestTeacherSubstitutions";

// Chat component (same one you use in App.js)
import Chat from "../components/Chat";

// NEW: inline Student Remarks Entry in the dashboard
import StudentRemarksEntry from "../pages/StudentRemarksEntry";

export default function TeacherDashboard() {
  const [showChat, setShowChat] = useState(false);
  const [activeChatName, setActiveChatName] = useState("");
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [groupedContacts, setGroupedContacts] = useState({});
  const [contacts, setContacts] = useState([]);

  // NEW: toggle for Remarks section
  const [showRemarks, setShowRemarks] = useState(true);

  // roles (kept if you need conditional UI later)
  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  const currentUserId = localStorage.getItem("userId") || "teacher_123";

  // Load saved notifications on mount
  useEffect(() => {
    const stored = localStorage.getItem("notifications");
    if (stored) setNotifications(JSON.parse(stored));
  }, []);

  const removeNotification = (id) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    localStorage.setItem("notifications", JSON.stringify(updated));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
  };

  // (Placeholder) fetch contacts depending on role
  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL;
    if (!userRoles.length) return;

    if (userRoles.includes("teacher")) {
      // TODO: fetch and process student contacts…
    } else {
      // TODO: fetch and process non-teacher contacts…
    }
  }, [currentUserId, userRoles]);

  // Global unread count from chats
  useEffect(() => {
    const q = query(
      collection(firestore, "chats"),
      where("participants", "array-contains", currentUserId)
    );
    const unsub = onSnapshot(q, (snap) => {
      let count = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (data.unreadCounts?.[currentUserId]) {
          count += data.unreadCounts[currentUserId];
        }
      });
      setGlobalUnreadCount(count);
    });
    return unsub;
  }, [currentUserId]);

  // Socket listeners for leave requests
  useEffect(() => {
    socket.on("newLeaveRequest", (data) => {
      toast.info(`New leave request from ${data.student.name} for ${data.date}`);
    });
    socket.on("leaveStatusUpdated", (data) => {
      toast.info(`Leave request updated: ${data.message}`);
    });
    return () => {
      socket.off("newLeaveRequest");
      socket.off("leaveStatusUpdated");
    };
  }, []);

  return (
    <div className="container-fluid px-3">
      {/* Page header (NOT a .navbar) */}
      <div className="dashboard-header bg-light px-3 py-2 mb-3 rounded d-flex align-items-center">
        <h5 className="mb-0">
          {activeChatName ? `Chatting with ${activeChatName}` : "Teacher Dashboard"}
        </h5>

        <button
          type="button"
          className="btn btn-outline-secondary ms-auto position-relative me-2"
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

        {/* NEW: toggle remarks visibility */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowRemarks((s) => !s)}
          title="Toggle Student Remarks"
        >
          {showRemarks ? "Hide" : "Show"} Remarks Entry
        </button>
      </div>

      {/* Overview sections */}
      <section className="mb-5">
        <h6 className="mb-3">Latest Circulars</h6>
        <LatestTeacherCirculars />
      </section>

      <section className="mb-4">
        <h6 className="mb-3">Latest Substitutions</h6>
        <LatestTeacherSubstitutions />
      </section>

      {/* NEW: Inline Student Remarks Entry */}
      {showRemarks && (
        <section className="mb-5">
          <div className="card shadow-sm">
            <div className="card-header d-flex align-items-center">
              <h6 className="mb-0">📝 Student Remarks Entry</h6>
              <button
                className="btn btn-sm btn-outline-secondary ms-auto"
                onClick={() => setShowRemarks(false)}
                title="Collapse"
              >
                ×
              </button>
            </div>
            <div className="card-body">
              {/* Render the full page component inline */}
              <StudentRemarksEntry />
            </div>
          </div>
        </section>
      )}

      <ToastContainer />

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

            {/* TODO: Render your notifications list component here */}
            {/* Example:
            <StudentNotifications
              notifications={notifications}
              onRemove={removeNotification}
            />
            */}

            <button
              onClick={clearAllNotifications}
              className="btn btn-primary mt-3"
            >
              Clear All Notifications
            </button>
          </div>
        </div>
      )}

      {/* Floating Chat Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            border: "none",
            borderRadius: "50%",
            width: 60,
            height: 60,
            zIndex: 1200,
            cursor: "pointer",
            background: "#fff",
            boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          aria-label="Open chat"
          title="Open chat"
        >
          Chat
          {globalUnreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -10,
                background: "red",
                color: "#fff",
                borderRadius: "50%",
                padding: "2px 6px",
                fontSize: "0.7rem",
              }}
              aria-label={`${globalUnreadCount} unread messages`}
            >
              {globalUnreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Popup Window */}
      {showChat && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            width: 360,
            height: 520,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            zIndex: 1300,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          role="dialog"
          aria-label="Chat window"
        >
          {/* Header */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #eee",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 14 }}>Chat</strong>
            <div className="ms-auto d-flex align-items-center" style={{ gap: 8 }}>
              {/* You can show activeChatName here if you wire selection */}
              <button
                onClick={() => setShowChat(false)}
                style={{
                  background: "none",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  padding: "2px 8px",
                  lineHeight: 1.2,
                  cursor: "pointer",
                }}
                aria-label="Close chat"
                title="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body: actual Chat */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {/* Use same props you already use in App.js */}
            <Chat chatId="chat_room_1" currentUserId={currentUserId} />
          </div>
        </div>
      )}
    </div>
  );
}
