// File: src/components/TeacherDashboard.jsx
// Dashboard-only. Chat moved to ChatContainer.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Inline pages (keep real if you already have them)
import StudentRemarksEntry from "../pages/StudentRemarksEntry";
import CoScholasticEntry from "../pages/CoScholasticEntry";

// Socket (to mirror fee notifications into the drawer)
import socket from "../socket";

// The separated chat container (REAL, not dummy)
import ChatContainer from "./chat/ChatContainer";

/* ----------------------------- DUMMY WIDGETS ----------------------------- */
/** KPIs row - purely dummy values; replace with props/state later */
function DummyKpisRow() {
  const kpis = [
    { label: "Today's Classes", value: 3, icon: "📅" },
    { label: "Pending Evaluations", value: 5, icon: "📝" },
    { label: "Avg. Attendance", value: "85%", icon: "🧮" },
    { label: "Upcoming Exam", value: "Maths • 26 Apr", icon: "🧪" },
  ];
  return (
    <div className="row g-3 mb-4">
      {kpis.map((k) => (
        <div className="col-12 col-sm-6 col-lg-3" key={k.label}>
          <div className="card shadow-sm h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div style={{ fontSize: 28 }}>{k.icon}</div>
              <div>
                <div className="text-muted small">{k.label}</div>
                <div className="fw-semibold fs-5">{k.value}</div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dummy schedule for today */
function DummySchedule() {
  const items = [
    { time: "09:00 – 10:00", subject: "English", class: "5B", room: "A-104" },
    { time: "11:00 – 12:00", subject: "History", class: "6A", room: "B-201" },
    { time: "12:30 – 01:30", subject: "Geography", class: "7C", room: "Lab-2" },
  ];
  return (
    <div className="card shadow-sm h-100">
      <div className="card-header">
        <strong>My Schedule (Dummy)</strong>
      </div>
      <div className="card-body">
        <ul className="list-group list-group-flush">
          {items.map((it, idx) => (
            <li className="list-group-item d-flex justify-content-between" key={idx}>
              <div>
                <div className="fw-semibold">{it.time}</div>
                <div className="text-muted small">{it.subject}</div>
              </div>
              <div className="text-end">
                <div className="badge text-bg-primary me-2">Class {it.class}</div>
                <span className="text-muted small">{it.room}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Dummy performance “bars” without chart libs */
function DummyPerformance() {
  const bars = [
    { label: "Eng", val: 65 },
    { label: "Math", val: 78 },
    { label: "Sci", val: 72 },
    { label: "Hist", val: 90 },
    { label: "Geo", val: 58 },
  ];
  return (
    <div className="card shadow-sm h-100">
      <div className="card-header">
        <strong>Student Performance (Dummy)</strong>
      </div>
      <div className="card-body">
        {bars.map((b) => (
          <div className="mb-3" key={b.label}>
            <div className="d-flex justify-content-between">
              <span className="small text-muted">{b.label}</span>
              <span className="small">{b.val}%</span>
            </div>
            <div className="progress" style={{ height: 8 }}>
              <div
                className="progress-bar"
                role="progressbar"
                style={{ width: `${b.val}%` }}
                aria-valuenow={b.val}
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>
          </div>
        ))}
        <div className="text-muted small">* Demo data — replace with real analytics.</div>
      </div>
    </div>
  );
}

/** Dummy circulars list */
function DummyLatestTeacherCirculars() {
  const data = [
    { id: 1, title: "Inter-house Debate", date: "30 Apr", note: "Hall A • 10 AM" },
    { id: 2, title: "PTM Window", date: "02 May", note: "Slots open till 5 PM" },
    { id: 3, title: "Lab Maintenance", date: "04 May", note: "Science lab closed" },
  ];
  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex align-items-center">
        <h6 className="mb-0">Latest Circulars (Dummy)</h6>
      </div>
      <div className="card-body">
        <ul className="list-group list-group-flush">
          {data.map((c) => (
            <li key={c.id} className="list-group-item d-flex align-items-start">
              <div className="me-2">📢</div>
              <div className="flex-grow-1">
                <div className="fw-semibold">{c.title}</div>
                <div className="small text-muted">{c.note}</div>
              </div>
              <span className="badge text-bg-light">{c.date}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Dummy substitutions table */
function DummyLatestTeacherSubstitutions() {
  const rows = [
    { period: 2, cls: "8A", subj: "Math", by: "Mr. Rao" },
    { period: 5, cls: "9C", subj: "Chemistry", by: "Ms. Lata" },
    { period: 7, cls: "7B", subj: "English", by: "Ms. Priya" },
  ];
  return (
    <div className="card shadow-sm">
      <div className="card-header d-flex align-items-center">
        <h6 className="mb-0">Latest Substitutions (Dummy)</h6>
      </div>
      <div className="card-body table-responsive">
        <table className="table align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Period</th>
              <th>Class</th>
              <th>Subject</th>
              <th>Substituted By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.period}</td>
                <td>{r.cls}</td>
                <td>{r.subj}</td>
                <td>{r.by}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-muted small mt-2">* Demo data — plug into your API later.</div>
      </div>
    </div>
  );
}
/* --------------------------- END DUMMY WIDGETS --------------------------- */

export default function TeacherDashboard() {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // — NEW: chat UI state & last message snapshot —
  const [chatUnread, setChatUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const lastTitleRef = useRef(document?.title || "Dashboard");
  const audioRef = useRef(null);

  // Hysteresis/persistence helpers to avoid badge flicker
  const lastNonZeroUnreadRef = useRef(0);
  const zeroTimerRef = useRef(null);

  // Toggles
  const [showRemarks, setShowRemarks] = useState(true);
  const [showCoScholastic, setShowCoScholastic] = useState(false);

  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  // Load saved notifications on mount
  useEffect(() => {
    const stored = localStorage.getItem("notifications");
    if (stored) {
      try {
        setNotifications(JSON.parse(stored) || []);
      } catch {
        setNotifications([]);
      }
    }
  }, []);

  // Restore last unread on mount (prevents blink after reload)
  useEffect(() => {
    const cached = Number(sessionStorage.getItem("chatUnread") || "0");
    if (Number.isFinite(cached) && cached > 0) {
      setChatUnread(cached);
      lastNonZeroUnreadRef.current = cached;
    }
  }, []);

  // Persist unread to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("chatUnread", String(chatUnread));
  }, [chatUnread]);

  // ——— Browser Notification permission (ask once) ———
  useEffect(() => {
    const asked = localStorage.getItem("notifPermAsked");
    if (!asked && "Notification" in window) {
      const t = setTimeout(() => {
        Notification.requestPermission().finally(() => {
          localStorage.setItem("notifPermAsked", "1");
        });
      }, 1200);
      return () => clearTimeout(t);
    }
  }, []);

  // ——— Tiny ping sound (non-blocking) ———
  useEffect(() => {
    // Replace with your own asset if you like: new Audio('/sounds/chat-ping.mp3')
    audioRef.current = new Audio(
      "data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQAA..."
    );
  }, []);

  // ——— Title badge when unread > 0 ———
  useEffect(() => {
    if (!document) return;
    if (chatUnread > 0) {
      document.title = `• (${chatUnread}) ${lastTitleRef.current}`;
    } else {
      document.title = lastTitleRef.current;
    }
    return () => {
      document.title = lastTitleRef.current;
    };
  }, [chatUnread]);

  // Mirror socket fee-notification events into the drawer (no extra alerts here)
  useEffect(() => {
    if (!socket?.on) return;
    const onFee = (data) => {
      pushMainNotification({
        id: data?.id,
        title: data?.title || "Notification",
        message: data?.message || "",
        createdAt: data?.createdAt,
        tag: "fee",
      });
    };
    socket.on("fee-notification", onFee);
    return () => socket.off("fee-notification", onFee);
  }, []);

  // ——— Helper to push into main notification drawer ———
  const pushMainNotification = (payload) => {
    setNotifications((prev) => {
      const item = {
        id: payload?.id || `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        title: payload?.title || "Notification",
        message: payload?.message || "",
        createdAt: payload?.createdAt || new Date().toISOString(),
        tag: payload?.tag || "general",
      };
      const next = [item, ...prev];
      localStorage.setItem("notifications", JSON.stringify(next));
      return next;
    });
  };

  // ——— Show toast + system notification + add to drawer on chat ping ———
  const handleIncomingChatWhenClosed = async (detail) => {
    const { last } = detail || {};
    const from = last?.fromName || last?.from || "New message";
    const body = last?.text || last?.message || "You have a new message";

    // 1) Toast with action
    toast.info(
      <div className="d-flex align-items-start">
        <div className="me-2">💬</div>
        <div className="flex-grow-1">
          <div className="fw-semibold">{from}</div>
          <div className="small text-muted">{body}</div>
          <button
            className="btn btn-sm btn-primary mt-2"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("chat:open-request"));
              toast.dismiss();
            }}
          >
            Open chat
          </button>
        </div>
      </div>,
      { autoClose: 6000 }
    );

    // 2) Desktop notification (ask now if still "default")
    if ("Notification" in window) {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
        if (Notification.permission === "granted") {
          const n = new Notification(from, {
            body,
            tag: `chat-${Date.now()}`, // prevents collapsing
            icon: "/icons/chat-128.png", // optional
            badge: "/icons/badge-72.png", // optional
            silent: true, // we play our own gentle sound
          });
          n.onclick = () => {
            window.focus?.();
            window.dispatchEvent(new CustomEvent("chat:open-request"));
            n.close?.();
          };
        }
      } catch {
        // ignore
      }
    }

    // 3) Soft chime
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      }
    } catch {
      // autoplay may be blocked until user interacts with the page—safe to ignore
    }

    // 4) Log in main drawer
    pushMainNotification({
      title: "New chat message",
      message: `${from}: ${body}`,
      tag: "chat",
    });
  };

  // Stable setter with hysteresis for unread (prevents flicker)
  const setUnreadStably = (next, { force = false } = {}) => {
    if (next > 0) {
      if (zeroTimerRef.current) {
        clearTimeout(zeroTimerRef.current);
        zeroTimerRef.current = null;
      }
      lastNonZeroUnreadRef.current = next;
      setChatUnread(next);
      return;
    }

    // Going to zero
    if (force) {
      if (zeroTimerRef.current) {
        clearTimeout(zeroTimerRef.current);
        zeroTimerRef.current = null;
      }
      lastNonZeroUnreadRef.current = 0;
      setChatUnread(0);
      return;
    }

    // Soft zero: debounce in case it's transient (API hiccup / mid-refresh)
    if (!zeroTimerRef.current) {
      zeroTimerRef.current = setTimeout(() => {
        lastNonZeroUnreadRef.current = 0;
        setChatUnread(0);
        zeroTimerRef.current = null;
      }, 4500);
    }
  };

  // ——— Listen for ChatContainer events ———
  useEffect(() => {
    const onUnread = (e) => {
      const { count = 0, last } = e.detail || {};

      // When chat is open, trust zeros immediately.
      // When closed, apply hysteresis to avoid flicker.
      setUnreadStably(count, { force: chatOpen });

      // Notify whenever a meaningful "last" payload arrives and chat is not open
      if (!chatOpen && last) {
        handleIncomingChatWhenClosed({ last });
      }
    };
    const onOpened = () => {
      setChatOpen(true);
      if (zeroTimerRef.current) {
        clearTimeout(zeroTimerRef.current);
        zeroTimerRef.current = null;
      }
    };
    const onClosed = () => {
      setChatOpen(false);
      if (lastNonZeroUnreadRef.current > 0) {
        setChatUnread(lastNonZeroUnreadRef.current);
      }
    };
    const openRequest = () => setChatOpen(true); // local optimism

    window.addEventListener("chat:unread", onUnread);
    window.addEventListener("chat:opened", onOpened);
    window.addEventListener("chat:closed", onClosed);
    window.addEventListener("chat:open-request", openRequest);

    return () => {
      window.removeEventListener("chat:unread", onUnread);
      window.removeEventListener("chat:opened", onOpened);
      window.removeEventListener("chat:closed", onClosed);
      window.removeEventListener("chat:open-request", openRequest);
      if (zeroTimerRef.current) clearTimeout(zeroTimerRef.current);
    };
  }, [chatOpen]);

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
    toast.success("All notifications cleared.");
  };

  const removeNotification = (id) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      localStorage.setItem("notifications", JSON.stringify(next));
      return next;
    });
  };

  // ——— Pretty Floating Chat Button (FAB) ———
  const ChatFAB = () => {
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("chat:open-request"))}
        title={chatOpen ? "Chat open" : "Open chat"}
        aria-label="Open chat"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 1300,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          outline: "none",
          background: chatUnread > 0 ? "linear-gradient(135deg,#6a11cb,#2575fc)" : "#0d6efd",
          color: "#fff",
          boxShadow: "0 10px 25px rgba(13,110,253,.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          overflow: "visible",
          isolation: "isolate",
        }}
        className={chatUnread > 0 ? "chat-fab-pulse" : ""}
      >
        {/* Icon (layer 1) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ position: "relative", zIndex: 1 }}
        >
          <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        </svg>

        {/* Unread badge (layer 2 — above icon and pulse) */}
        {chatUnread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 20,
              height: 20,
              padding: "0 6px",
              borderRadius: 10,
              background: "#dc3545",
              color: "#fff",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px #fff",
              zIndex: 2,
            }}
          >
            {chatUnread > 99 ? "99+" : chatUnread}
          </span>
        )}
      </button>
    );
  };

  // ——— FAB pulse animation (once on page) ———
  useEffect(() => {
    const id = "chat-fab-pulse-style";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .chat-fab-pulse{ position:relative; }
      .chat-fab-pulse::after{
        content:'';
        position:absolute;
        inset:0;
        border-radius:50%;
        box-shadow:0 0 0 0 rgba(37,117,252,0.6);
        animation:chatPulse 1.6s infinite;
        z-index:0;
        pointer-events:none;
      }
      @keyframes chatPulse{
        0%{ box-shadow:0 0 0 0 rgba(37,117,252,0.6); }
        70%{ box-shadow:0 0 0 18px rgba(37,117,252,0); }
        100%{ box-shadow:0 0 0 0 rgba(37,117,252,0); }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div className="container-fluid px-3">
      {/* Page header */}
      <div className="dashboard-header bg-light px-3 py-2 mb-3 rounded d-flex align-items-center gap-2">
        <h5 className="mb-0">Teacher Dashboard</h5>

        {/* Roles (if any) */}
        <div className="d-none d-md-flex align-items-center gap-1 ms-3">
          {userRoles.map((r) => (
            <span key={r} className="badge text-bg-secondary">{r}</span>
          ))}
        </div>

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

        <button
          type="button"
          className="btn btn-outline-primary me-2"
          onClick={() => setShowCoScholastic((s) => !s)}
          title="Toggle Co-Scholastic Entry"
        >
          {showCoScholastic ? "Hide" : "Show"} Co-Scholastic Entry
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowRemarks((s) => !s)}
          title="Toggle Student Remarks"
        >
          {showRemarks ? "Hide" : "Show"} Remarks Entry
        </button>
      </div>

      {/* Top KPIs (dummy) */}
      <DummyKpisRow />

      {/* Two-column cards: Schedule + Performance */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6">
          <DummySchedule />
        </div>
        <div className="col-12 col-lg-6">
          <DummyPerformance />
        </div>
      </div>

      {/* Dummy Latest Circulars */}
      <section className="mb-4">
        <DummyLatestTeacherCirculars />
      </section>

      {/* Dummy Latest Substitutions */}
      <section className="mb-5">
        <DummyLatestTeacherSubstitutions />
      </section>

      {/* Inline Co-Scholastic Entry (REAL page if exists) */}
      {showCoScholastic && (
        <section className="mb-5">
          <div className="card shadow-sm">
            <div className="card-header d-flex align-items-center">
              <h6 className="mb-0">🧩 Co-Scholastic Entry</h6>
              <button
                className="btn btn-sm btn-outline-secondary ms-auto"
                onClick={() => setShowCoScholastic(false)}
                title="Collapse"
              >
                ×
              </button>
            </div>
            <div className="card-body">
              <CoScholasticEntry />
            </div>
          </div>
        </section>
      )}

      {/* Inline Student Remarks Entry (REAL page if exists) */}
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
              <StudentRemarksEntry />
            </div>
          </div>
        </section>
      )}

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
              title="Close"
            >
              ×
            </button>

            <h6 className="mb-3">Notifications</h6>

            {notifications.length === 0 ? (
              <div className="text-muted">No notifications yet.</div>
            ) : (
              <ul className="list-group">
                {notifications.map((n) => (
                  <li key={n.id} className="list-group-item d-flex align-items-start">
                    <div className="me-2">{n.tag === "chat" ? "💬" : "🔔"}</div>
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{n.title}</div>
                      <div className="small text-muted">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                      {n.message && <div className="mt-1">{n.message}</div>}
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary ms-2"
                      onClick={() => removeNotification(n.id)}
                      title="Dismiss"
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button onClick={clearAllNotifications} className="btn btn-primary mt-3">
              Clear All Notifications
            </button>
          </div>
        </div>
      )}

      {/* Toasts for dashboard actions */}
      <ToastContainer />

      {/* Floating chat button with badge/pulse */}
      <ChatFAB />

      {/* 👇 The floating chat lives outside dashboard layout, fixed to screen */}
      <ChatContainer />
    </div>
  );
}
