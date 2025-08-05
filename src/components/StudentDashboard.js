// src/components/StudentDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import moment from "moment";
import axios from "axios";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Subjects from "../pages/Subjects";
import StudentFees from "../pages/StudentFeePage";
import StudentAttendance from "../pages/StudentAttendance";
import StudentSideAssignment from "../pages/StudentSideAssignment";
import StudentTimeTableDisplay from "../pages/StudentTimeTableDisplay";
import StudentCirculars from "../pages/StudentCirculars";
import StudentNotifications from "../pages/StudentNotifications";
import ChatContainer from "../components/ChatContainer";
import LatestStudentCirculars from "../pages/LatestStudentCirculars";
import LatestStudentAssignments from "../pages/LatestStudentAssignments";
import StudentFeeSummary from "../pages/StudentFeeSummary";
import { firestore } from "../firebase/firebaseConfig.js";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import socket from "../socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

const classNames = {
  8: "V",
  9: "VI",
  // ...
};

const AttendanceSummaryCards = ({ attendanceRecords = [], currentMonth }) => {
  const monthly = attendanceRecords.filter(r =>
    moment(r.date).isSame(currentMonth, "month")
  );
  const total = monthly.length;
  const present = monthly.filter(r => r.status.toLowerCase() === "present").length;
  const absent = monthly.filter(r => r.status.toLowerCase() === "absent").length;
  const leave = monthly.filter(r => r.status.toLowerCase() === "leave").length;
  const pct = total ? ((present / total) * 100).toFixed(2) : 0;

  if (!total) {
    return (
      <div className="alert alert-warning text-center">
        No attendance marked for {currentMonth.format("MMMM YYYY")}.
      </div>
    );
  }

  const metrics = [
    { label: "Total Marked", value: total },
    { label: "Present", value: present },
    { label: "Absent", value: absent },
    { label: "Leave", value: leave },
    { label: "% Presence", value: `${pct}%` },
  ];

  return (
    <div className="row">
      {metrics.map((m, i) => (
        <div key={i} className="col-md-4 mb-3">
          <div className="card border-primary shadow-sm h-100">
            <div className="card-body text-center">
              <h6 className="card-title">{m.label}</h6>
              <p className="card-text display-6">{m.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const AttendanceSummaryChart = ({ attendanceRecords, currentMonth }) => {
  const monthly = attendanceRecords.filter(r =>
    moment(r.date).isSame(currentMonth, "month")
  );
  const present = monthly.filter(r => r.status.toLowerCase() === "present").length;
  const absent  = monthly.filter(r => r.status.toLowerCase() === "absent").length;
  const leave   = monthly.filter(r => r.status.toLowerCase() === "leave").length;

  const data = {
    labels: ["Present", "Absent", "Leave"],
    datasets: [{
      data: [present, absent, leave],
      backgroundColor: ["#28a745", "#dc3545", "#ffc107"],
    }],
  };

  return (
    <div style={{ height: "350px" }}>
      <Doughnut data={data} />
    </div>
  );
};

const StudentDashboard = () => {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(moment());

  // sync activeSection with URL
  useEffect(() => {
    const slug = location.pathname.replace(/^\//, "");
    setActiveSection(slug || "dashboard");
  }, [location.pathname]);

  const token = localStorage.getItem("token");
  const API_URL = process.env.REACT_APP_API_URL;
  const currentUserId = localStorage.getItem("userId") || "student_123";

  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  // load notifications
  useEffect(() => {
    const stored = localStorage.getItem("notifications");
    if (stored) setNotifications(JSON.parse(stored));
  }, []);

  // chat unread count
  useEffect(() => {
    const q = query(
      collection(firestore, "chats"),
      where("participants", "array-contains", currentUserId)
    );
    const unsub = onSnapshot(q, snap => {
      let tot = 0;
      snap.forEach(d => {
        tot += d.data().unreadCounts?.[currentUserId] || 0;
      });
      setGlobalUnreadCount(tot);
    });
    return () => unsub();
  }, [currentUserId]);

  // socket notifications
  useEffect(() => {
    const evts = [
      "fee-notification",
      "payment-notification",
      "general-notification",
      "assignmentAssigned",
      "assignmentUpdated",
      "assignmentDeleted",
      "gradeUpdated",
      "statusUpdated",
      "attendanceCreated",
      "attendanceUpdated",
      "leaveStatusUpdated",
    ];
    evts.forEach(evt =>
      socket.on(evt, data => {
        let msg = data.message || "";
        if (evt === "assignmentAssigned" || evt === "assignmentUpdated") {
          msg = `Assignment: ${data.title}`;
        } else if (evt === "assignmentDeleted") {
          msg = `Assignment Deleted: ${data.message}`;
        }
        const note = { id: Date.now(), message: msg };
        setNotifications(prev => {
          const updated = [note, ...prev];
          localStorage.setItem("notifications", JSON.stringify(updated));
          toast.info(msg);
          return updated;
        });
      })
    );
    return () => evts.forEach(evt => socket.off(evt));
  }, []);

  const removeNotification = id => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem("notifications", JSON.stringify(updated));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
  };

  // fetch attendance
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/attendance/student/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(res => setAttendanceRecords(res.data))
      .catch(err => console.error(err));
  }, [token, API_URL]);

  const knownSections = [
    "dashboard",
    "subjects",
    "student-fee",
    "student-attendance",
    "my-assignments",
    "student-timetable-display",
    "student-circulars",
  ];

  return (
    <div className="App">
      <Navbar
        notificationsCount={notifications.length}
        onBellClick={() => setShowNotifications(true)}
      />

      <div className="d-flex">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isExpanded={isSidebarExpanded}
          setIsExpanded={setIsSidebarExpanded}
          userRoles={userRoles}
        />

        <div
          className="content container-fluid px-0"
          style={{
            marginTop: "70px",
            marginLeft: isSidebarExpanded ? "250px" : "60px",
            transition: "margin-left 0.3s ease",
          }}
        >
          {/* Dashboard overview */}
          {activeSection === "dashboard" && userRoles.includes("student") && (
            <>
              <div
                style={{
                  background: "linear-gradient(to right, #4e54c8, #8f94fb)",
                  color: "#fff",
                  padding: "2rem",
                  borderRadius: "8px",
                  marginBottom: "2rem",
                  textAlign: "center",
                }}
              >
                <h1>Welcome to Your Dashboard</h1>
                <p>Stay updated with circulars, assignments, fee, and attendance information.</p>
              </div>

              <div className="row mb-4">
                <div className="col-lg-6">
                  <div className="card shadow-sm">
                    <div className="card-header bg-secondary text-white">
                      Attendance Summary
                    </div>
                    <div className="card-body">
                      <AttendanceSummaryCards
                        attendanceRecords={attendanceRecords}
                        currentMonth={currentMonth}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="card shadow-sm">
                    <div className="card-header bg-secondary text-white">
                      Attendance Chart
                    </div>
                    <div className="card-body">
                      <AttendanceSummaryChart
                        attendanceRecords={attendanceRecords}
                        currentMonth={currentMonth}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-lg-6 mb-4">
                  <div className="card shadow-sm">
                    <div className="card-body">
                      <h3 className="card-title">Latest Circulars</h3>
                      <LatestStudentCirculars />
                    </div>
                  </div>
                </div>
                <div className="col-lg-6 mb-4">
                  <div className="card shadow-sm">
                    <div className="card-body">
                      <h3 className="card-title">Latest Assignments</h3>
                      <LatestStudentAssignments />
                    </div>
                  </div>
                </div>
              </div>

              <StudentFeeSummary />
            </>
          )}

          {/* Other sections */}
          {activeSection === "subjects" && <Subjects />}
          {activeSection === "student-fee" && <StudentFees />}
          {activeSection === "student-attendance" && <StudentAttendance />}
          {activeSection === "my-assignments" && <StudentSideAssignment />}
          {activeSection === "student-timetable-display" && (
            <StudentTimeTableDisplay />
          )}
          {activeSection === "student-circulars" && <StudentCirculars />}

          {/* Fallback */}
          {!knownSections.includes(activeSection) && (
            <div>
              <h1>Page Not Found</h1>
              <p>The selected section does not exist.</p>
            </div>
          )}
        </div>
      </div>

      <ToastContainer />

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
            >
              ×
            </button>
            <StudentNotifications
              notifications={notifications}
              removeNotification={removeNotification}
            />
            <button onClick={clearAllNotifications} className="btn btn-primary mt-3">
              Clear All Notifications
            </button>
          </div>
        </div>
      )}

      {!showChat && (
        <button onClick={() => setShowChat(true)} style={{ /* ... */ }}>
          Chat {globalUnreadCount > 0 && <span>{globalUnreadCount}</span>}
        </button>
      )}

      {showChat && (
        <div style={{ /* ... */ }}>
          <ChatContainer currentUserId={currentUserId} hideHeader />
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
