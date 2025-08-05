// src/components/TeacherDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "./Sidebar";
import Classes from "../pages/Classes";
import Subjects from "../pages/Subjects";
import Students from "../pages/Students";
import MarkAttendance from "../pages/MarkAttendance";
import AttendanceCalendar from "../pages/AttendanceCalendar";
import TeacherLeaveRequests from "../pages/TeacherLeaveRequests";
import Assignments from "../pages/Assignments";
import AssignmentMarking from "../pages/AssignmentMarking";
import TeacherTimeTableDisplay from "../pages/TeacherTimetableDisplay";
import TeacherCombinedSubstitutionPage from "../pages/TeacherCombinedSubstitutionPage";
import LessonPlan from "../pages/LessonPlan";
import LatestTeacherCirculars from "../pages/LatestTeacherCirculars";
import EmployeeLeaveRequestForm from "../pages/EmployeeLeaveRequestForm";
import LatestTeacherSubstitutions from "../pages/LatestTeacherSubstitutions";
import { firestore } from "../firebase/firebaseConfig.js";
import EmployeeAttendanceCalendar from "../pages/EmployeeAttendanceCalendar";
import RollNumberManagement from "../pages/RollNumberManagement"; // adjust if path differs
import MarksEntry from "../pages/MarksEntry"; // ✅ Add this import
import ClasswiseResultSummary from "../pages/ClasswiseResultSummary";
import ResultReportDesigner from "../pages/ResultReportDesigner"; // ✅ Add this
import FinalResultSummary from "../pages/FinalResultSummary"; // ✅ Add this
import CoScholasticEntry from "../pages/CoScholasticEntry"; // ✅ NEW
import StudentRemarksEntry from "../pages/StudentRemarksEntry"; // ✅ NEW









import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import socket from "../socket";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const TeacherDashboard = () => {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeChatName, setActiveChatName] = useState("");
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [groupedContacts, setGroupedContacts] = useState({});
  const [contacts, setContacts] = useState([]);

  // Sync activeSection with URL slug (dash‑case)
  useEffect(() => {
    const slug = location.pathname.replace(/^\//, "");
    setActiveSection(slug || "dashboard");
  }, [location.pathname]);

  // Multi-role array from localStorage
  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  const currentUserId = localStorage.getItem("userId") || "teacher_123";

  // Load saved notifications
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

  // Fetch contacts for teacher or others...
  useEffect(() => {
    const API_URL = process.env.REACT_APP_API_URL;
    if (!userRoles.length) return;

    if (userRoles.includes("teacher")) {
      // ...fetch and process student contacts...
    } else {
      // ...fetch and process non-teacher contacts...
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
    <div className="App">
      <Navbar
        notificationsCount={notifications.length}
        onBellClick={() => setShowNotifications(true)}
      />

      <div className="d-flex" style={{ marginTop: "70px" }}>
        {/* Sidebar */}
        <div style={{ marginTop: "20px" }}>
          <Sidebar
            activeSection={activeSection}
            setActiveSection={setActiveSection}
            isExpanded={isSidebarExpanded}
            setIsExpanded={setIsSidebarExpanded}
            userRoles={userRoles}
          />
        </div>

        {/* Main content */}
        <main
          className="content container"
          style={{ flex: 1, marginLeft: isSidebarExpanded ? "250px" : "60px" }}
        >
          <h1>
            {activeChatName
              ? `Chatting with ${activeChatName}`
              : "Teacher Dashboard"}
          </h1>

          {/* Dashboard overview */}
          {activeSection === "dashboard" && (
            <>
              <section className="mb-5">
                <h2 className="mb-3">Latest Circulars</h2>
                <LatestTeacherCirculars />
              </section>
              <section>
                <h2 className="mb-3">Latest Substitutions</h2>
                <LatestTeacherSubstitutions />
              </section>
            </>
          )}

          {/* Teacher routes */}
          {activeSection === "view-circulars" && <LatestTeacherCirculars />}
          {activeSection === "mark-attendance" && <MarkAttendance />}
          {activeSection === "attendance-calendar" && (
            <AttendanceCalendar />
          )}
          {activeSection === "leave-requests" && <TeacherLeaveRequests />}
          {activeSection === "assignments" && <Assignments />}
          {activeSection === "assignment-marking" && (
            <AssignmentMarking />
          )}
          {activeSection === "teacher-timetable-display" && (
            <TeacherTimeTableDisplay />
          )}
          {activeSection === "combined-teacher-substitution" && (
            <TeacherCombinedSubstitutionPage />
          )}
          {activeSection === "lesson-plan" && <LessonPlan />}
          {activeSection === "employee-leave-request" && <EmployeeLeaveRequestForm />}
          {activeSection === "my-attendance-calendar" && <EmployeeAttendanceCalendar />}



          {/* Academic support pages */}
          {activeSection === "subjects" && <Subjects />}
          {activeSection === "classes" && <Classes />}
          {activeSection === "students" && <Students />}

          {activeSection === "roll-numbers" && <RollNumberManagement />}

          {activeSection === "marks-entry" && <MarksEntry />}
          {activeSection === "classwise-result-summary" && <ClasswiseResultSummary />}
          {activeSection === "result-report-designer" && <ResultReportDesigner />} // ✅ NEW

          {activeSection === "final-result-summary" && <FinalResultSummary />} // ✅ NEW

          {activeSection === "coscholastic-entry" && <CoScholasticEntry />} // ✅ NEW

          {activeSection === "student-remarks-entry" && <StudentRemarksEntry />} // ✅ NEW








          {/* 404 fallback */}
          {![
            "dashboard",
            "view-circulars",
            "mark-attendance",
            "attendance-calendar",
            "leave-requests",
            "assignments",
            "assignment-marking",
            "teacher-timetable-display",
            "combined-teacher-substitution",
            "lesson-plan",
            "subjects",
            "classes",
            "students",
             "employee-leave-request", // ✅ add this
             "leave-requests", // ✅ ADD THIS TOO
             "my-attendance-calendar",
             "roll-numbers",
              "marks-entry", // ✅ Add here
              "classwise-result-summary",
              "result-report-designer", // ✅ NEW
              "final-result-summary", // ✅ add this here
              "coscholastic-entry", // ✅ add this here
              "student-remarks-entry", // ✅ add here

          ].includes(activeSection) && (
            <div>
              <h1>Page Not Found</h1>
              <p>The selected section does not exist.</p>
            </div>
          )}
        </main>
      </div>

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
            {/* Your StudentNotifications component */}
            {/* ... */}
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
            >
              {globalUnreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default TeacherDashboard;
