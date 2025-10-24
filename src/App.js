// src/App.js
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import axios from "axios";
import { onMessage } from "firebase/messaging";
import { messaging } from "./firebase/firebaseConfig";

import AppLayout from "./layouts/AppLayout";

// Auth / common
import Login from "./components/Login";
import RoleAwareDashboard from "./components/RoleAwareDashboard";
import EditProfile from "./components/EditProfile";
import Chat from "./components/Chat";
import ChatContainer from "./components/chat/ChatContainer";

// Pages
import Classes from "./pages/Classes";
import Sessions from "./pages/Sessions";
import Subjects from "./pages/Subjects";
import Student from "./pages/Students";
import FeeStructure from "./pages/FeeStructure";
import FeeHeadings from "./pages/FeeHeadings";
import Sections from "./pages/Sections";
import Transportation from "./pages/Transportation";
import Transactions from "./pages/Transactions/Transactions";
import CancelledTransactions from "./pages/Transactions/CancelledTransactions";
import Schools from "./pages/Schools";
import Concessions from "./pages/Concessions";
import StudentDueTable from "./pages/StudentDueTable";
import FeeCategory from "./pages/FeeCategory";
import DayWiseReport from "./pages/DayWiseReport";
import DayWiseCategoryReports from "./pages/DayWiseCategoryReports";
import SchoolFeeSummary from "./pages/SchoolFeeSummary";
import ConcessionReport from "./pages/ConcessionReport";
import VanFeeDetailedReport from "./pages/VanFeeDetailedReport";
import UserManagement from "./pages/UserManagement";
import TeacherAssignment from "./pages/TeacherAssignment";
import InchargeAssignment from "./pages/InchargeAssignment";
import HolidayMarking from "./pages/HolidayMarking";
import Period from "./pages/Period";
import Timetable from "./pages/Timetable";
import CombinedTimetableAssignment from "./pages/CombinedTimetableAssignment";
import TeacherTimetableDisplay from "./pages/TeacherTimetableDisplay";
import StudentTimetableDisplay from "./pages/StudentTimeTableDisplay";
import Substitution from "./pages/substitution";
import SubstitutionList from "./pages/SubstituitionListing";
import TeacherSubstitutionListing from "./pages/TeacherSubstitutionListing";
import TeacherSubstitutedListing from "./pages/TeacherSubstitutedListing";
import TeacherCombinedSubstitutionPage from "./pages/TeacherCombinedSubstitutionPage";
import LessonPlan from "./pages/LessonPlan";
import MarkAttendance from "./pages/MarkAttendance";
import AttendanceCalendar from "./pages/AttendanceCalendar";
import TeacherTimetableAssignment from "./pages/TeacherTimetableAssignment";
import Assignments from "./pages/Assignments";
import StudentAssignments from "./pages/StudentAssignments";
import AssignmentMarking from "./pages/AssignmentMarking";
import StudentSideAssignment from "./pages/StudentSideAssignment";
import StudentFeePage from "./pages/StudentFeePage";
import StudentAttendance from "./pages/StudentAttendance";
import TeacherLeaveRequests from "./pages/TeacherLeaveRequests";
import AttendanceSummary from "./pages/AttendanceSummary";
import ReceiptPrint from "./pages/Transactions/ReceiptPage";
import CombinedCirculars from "./pages/CombinedCirculars";
import ViewCirculars from "./pages/ViewCirculars";
import StudentCirculars from "./pages/StudentCirculars";
import StudentUserAccounts from "./pages/StudentUserAccounts";
import Departments from "./pages/Departments";
import EmployeeManagement from "./pages/EmployeeManagement";
import EmployeeUserAccounts from "./pages/EmployeeUserAccounts";
import LeaveTypeManagement from "./pages/LeaveTypeManagement";
import EmployeeLeaveBalance from "./pages/EmployeeLeaveBalance";
import EmployeeLeaveRequestForm from "./pages/EmployeeLeaveRequestForm";
import HRLeaveRequests from "./pages/HRLeaveRequests";
import EmployeeAttendance from "./pages/EmployeeAttendance";
import EmployeeAttendanceCalendar from "./pages/EmployeeAttendanceCalendar";
import EmployeeAttendanceSummary from "./pages/EmployeeAttendanceSummary";
import ExamSchemeManagement from "./pages/ExamSchemeManagement";
import TermManagement from "./pages/TermManagement";
import AssessmentComponentManagement from "./pages/AssessmentComponentManagement";
import AcademicYearManagement from "./pages/AcademicYearManagement";
import ExamScheduleManagement from "./pages/ExamScheduleManagement";
import ExamManagement from "./pages/ExamManagement";
import RollNumberManagement from "./pages/RollNumberManagement";
import MarksEntry from "./pages/MarksEntry";
import ReportBuilder from "./pages/ReportBuilder";
import ClasswiseResultSummary from "./pages/ClasswiseResultSummary";
import ResultReportDesigner from "./pages/ResultReportDesigner";
import GradeSchemeManagement from "./pages/GradeSchemeManagement";
import CombinedExamSchemeManagement from "./pages/CombinedExamSchemeManagement";
import FinalResultSummary from "./pages/FinalResultSummary";
import CoScholasticAreaManagement from "./pages/CoScholasticAreaManagement";
import CoScholasticGradeManagement from "./pages/CoScholasticGradeManagement";
import ClassCoScholasticMapping from "./pages/ClassCoScholasticMapping";
import CoScholasticEntry from "./pages/CoScholasticEntry";
import ReportCardFormats from "./pages/ReportCardFormats";
import AssignReportCardFormat from "./pages/AssignReportCardFormat";
import ReportCardGenerator from "./pages/ReportCardGenerator";
import StudentRemarksEntry from "./pages/StudentRemarksEntry";
import StudentTransport from "./pages/StudentTransport";
import OpeningBalances from "./pages/OpeningBalances";
import CasteGenderReport from "./pages/CasteGenderReport";
import DigitalDiary from "./pages/DigitalDiary";
import StudentDiary from "./pages/StudentDiary";
import DiaryDetail from "./pages/DiaryDetail";
import AccountsDashboard from "./components/AccountsDashboard";
import TransportSummary from "./pages/TransportSummary";
import UserTracking from "./pages/UserTracking";
import Houses from "./pages/Houses";


// ✅ admission-aware hook for remount key
import useActiveStudent from "./hooks/useActiveStudent";

// ---------- auth guard ----------
const RequireRole = ({ roles = [], children }) => {
  const stored = JSON.parse(localStorage.getItem("roles") || "[]");
  const userRoles = stored.map((r) => (r || "").toLowerCase());
  const allowed =
    roles.length === 0 || roles.some((r) => userRoles.includes(r.toLowerCase()));
  return allowed ? children : <Navigate to="/dashboard" replace />;
};

// ---------- install global API shims (axios + fetch) ----------
function installGlobalApiShims() {
  const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

  const getActiveAdmission = () =>
    localStorage.getItem("activeStudentAdmission") ||
    localStorage.getItem("username") ||
    "";

  // ---------- URL Rewriter ----------
  const rewriteUrlString = (urlString) => {
    const admission = getActiveAdmission();
    if (!admission) return urlString;

    let urlObj;
    try {
      // absolute
      urlObj = new URL(urlString);
    } catch {
      try {
        // relative
        const base = API_BASE || window.location.origin;
        urlObj = new URL(urlString.replace(/^\//, ""), base + "/");
      } catch {
        return urlString;
      }
    }

    // only touch your API URLs
    if (API_BASE && !urlObj.href.startsWith(API_BASE)) {
      return urlString;
    }

    // 1️⃣ Replace any `/admission/<something>` with `/admission/<activeAdmission>`
    urlObj.pathname = urlObj.pathname.replace(
      /\/admission\/[^/]+/i,
      `/admission/${encodeURIComponent(admission)}`
    );

    // 2️⃣ Add or override admission parameter
    if (!urlObj.searchParams.has("admission")) {
      urlObj.searchParams.set("admission", admission);
    }

    // 3️⃣ Override username/admission_number params if they exist
    urlObj.searchParams.set("username", admission);
    urlObj.searchParams.set("admission_number", admission);

    return urlObj.href;
  };

  // ---------- Axios interceptor ----------
  axios.interceptors.request.use((config) => {
    const t = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (t && !config.headers?.Authorization) {
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${t}` };
    }

    const admission = getActiveAdmission();
    if (admission) {
      config.headers = { ...(config.headers || {}), "X-Active-Student": admission };
    }

    if (config.url) {
      config.url = rewriteUrlString(config.url);
    }

    return config;
  });

  // ---------- Fetch wrapper ----------
  if (!window.__FETCH_STUDENT_SHIM_INSTALLED__) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const headers = new Headers(init.headers || {});
      const t = localStorage.getItem("token") || sessionStorage.getItem("token");
      const admission = getActiveAdmission();

      // Normalize URL string
      let urlString = typeof input === "string" ? input : input?.url || "";
      urlString = rewriteUrlString(urlString);

      if (t && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${t}`);
      }
      if (admission && !headers.has("X-Active-Student")) {
        headers.set("X-Active-Student", admission);
      }

      if (input instanceof Request) {
        return originalFetch(new Request(urlString, { ...init, headers }), init);
      }
      return originalFetch(urlString, { ...init, headers });
    };
    window.__FETCH_STUDENT_SHIM_INSTALLED__ = true;
  }
}


function App() {
  // ✅ run once: install API shims
  useEffect(() => {
    installGlobalApiShims();
  }, []);

  // ✅ Firebase foreground notifications (unchanged)
  useEffect(() => {
    const unsubscribe = onMessage(messaging, (payload) => {
      if (payload.notification) {
        const { title = "Notification", body = "" } = payload.notification;
        alert(`${title}: ${body}`);
      }
    });
    return () => unsubscribe();
  }, []);

  // ✅ force protected app to remount when student changes
  const activeAdmission = useActiveStudent();

  const currentUserId = localStorage.getItem("userId");

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* Protected App: header + sidebar + content push */}
        {/* The key={activeAdmission} is the trick: it remounts the whole app shell on switch */}
        <Route element={<AppLayout key={activeAdmission} />}>
          {/* Dashboard landing */}
          <Route path="/dashboard" element={<RoleAwareDashboard />} />

          {/* Profile & Chat */}
          <Route path="/edit-profile" element={<EditProfile />} />

          {/* legacy small chat component */}
          <Route
            path="/chat"
            element={<Chat chatId="chat_room_1" currentUserId={currentUserId} />}
          />

          {/* full-page ChatContainer */}
          <Route
            path="/chat-page"
            element={<ChatContainer fullPage currentUserId={currentUserId} />}
          />
          <Route
            path="/chat-page/:contactId"
            element={<ChatContainer fullPage currentUserId={currentUserId} />}
          />

          {/* Core / Admissions */}
          <Route path="/classes" element={<Classes />} />
          <Route path="/houses" element={<Houses />} /> {/* ✅ NEW */}
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/students" element={<Student />} />
          <Route path="/sections" element={<Sections />} />
          <Route path="/schools" element={<Schools />} />

          {/* Fee & Reports */}
          <Route path="/fee-structure" element={<FeeStructure />} />
          <Route path="/fee-headings" element={<FeeHeadings />} />
          <Route path="/fee-category" element={<FeeCategory />} />
          <Route path="/concessions" element={<Concessions />} />
          <Route path="/student-due" element={<StudentDueTable />} />
          <Route path="/opening-balances" element={<OpeningBalances />} />
          <Route path="/reports/day-wise" element={<DayWiseReport />} />
          <Route path="/reports/day-wise-category" element={<DayWiseCategoryReports />} />
          <Route path="/reports/school-fee-summary" element={<SchoolFeeSummary />} />
          <Route path="/reports/concession" element={<ConcessionReport />} />
          <Route path="/reports/van-fee" element={<VanFeeDetailedReport />} />
          <Route path="/reports/transport-summary" element={<TransportSummary />} />

          {/* Transactions */}
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/cancelled-transactions" element={<CancelledTransactions />} />
          <Route path="/receipt/:slipId" element={<ReceiptPrint />} />

          {/* Transport & Settings */}
          <Route path="/transportation" element={<Transportation />} />

          {/* Circulars */}
          <Route path="/combined-circulars" element={<CombinedCirculars />} />
          <Route path="/view-circulars" element={<ViewCirculars />} />
          <Route path="/student-circulars" element={<StudentCirculars />} />

          {/* Users */}
          <Route path="/users" element={<UserManagement />} />
          <Route path="/student-user-accounts" element={<StudentUserAccounts />} />

          {/* Departments / Employees */}
          <Route path="/departments" element={<Departments />} />
          <Route path="/employees" element={<EmployeeManagement />} />
          <Route path="/employee-user-accounts" element={<EmployeeUserAccounts />} />

          {/* Leave */}
          <Route path="/leave-types" element={<LeaveTypeManagement />} />
          <Route path="/employee-leave-balances" element={<EmployeeLeaveBalance />} />
          <Route path="/employee-leave-request" element={<EmployeeLeaveRequestForm />} />
          <Route path="/hr-leave-requests" element={<HRLeaveRequests />} />

          {/* HR Attendance */}
          <Route path="/employee-attendance" element={<EmployeeAttendance />} />
          <Route path="/my-attendance-calendar" element={<EmployeeAttendanceCalendar />} />
          <Route path="/employee-attendance-summary" element={<EmployeeAttendanceSummary />} />

          {/* Academic */}
          <Route path="/teacher-assignment" element={<TeacherAssignment />} />
          <Route path="/incharge-assignment" element={<InchargeAssignment />} />
          <Route path="/holiday-marking" element={<HolidayMarking />} />
          <Route path="/periods" element={<Period />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/combined-timetable" element={<CombinedTimetableAssignment />} />
          <Route path="/teacher-timetable-display" element={<TeacherTimetableDisplay />} />
          <Route path="/student-timetable-display" element={<StudentTimetableDisplay />} />
          <Route path="/substitution" element={<Substitution />} />
          <Route path="/substitution-listing" element={<SubstitutionList />} />
          <Route path="/teacher-substitution-listing" element={<TeacherSubstitutionListing />} />
          <Route path="/teacher-substituted-listing" element={<TeacherSubstitutedListing />} />
          <Route
            path="/combined-teacher-substitution"
            element={<TeacherCombinedSubstitutionPage />}
          />
          <Route path="/lesson-plan" element={<LessonPlan />} />
          <Route path="/mark-attendance" element={<MarkAttendance />} />
          <Route path="/attendance-calendar" element={<AttendanceCalendar />} />
          <Route path="/leave-requests" element={<TeacherLeaveRequests />} />
          <Route path="/attendance-summary" element={<AttendanceSummary />} />

          {/* Assignments */}
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/student-assignments" element={<StudentAssignments />} />
          <Route path="/assignment-marking" element={<AssignmentMarking />} />
          <Route path="/my-assignments" element={<StudentSideAssignment />} />

          {/* Student self-service */}
          <Route path="/student-fee" element={<StudentFeePage />} />
          <Route path="/student-attendance" element={<StudentAttendance />} />

          {/* Exam / Results */}
          <Route path="/exam-schemes" element={<ExamSchemeManagement />} />
          <Route path="/exams" element={<ExamManagement />} />
          <Route path="/exam-schedules" element={<ExamScheduleManagement />} />
          <Route path="/roll-numbers" element={<RollNumberManagement />} />
          <Route path="/marks-entry" element={<MarksEntry />} />
          <Route path="/report-builder" element={<ReportBuilder />} />
          <Route path="/student-remarks-entry" element={<StudentRemarksEntry />} />
          <Route
            path="/reports/classwise-result-summary"
            element={<ClasswiseResultSummary />}
          />
          <Route
            path="/reports/result-report-designer"
            element={<ResultReportDesigner />}
          />
          <Route path="/grade-schemes" element={<GradeSchemeManagement />} />
          <Route
            path="/combined-exam-schemes"
            element={<CombinedExamSchemeManagement />}
          />
          <Route path="/term-management" element={<TermManagement />} />
          <Route path="/assessment-components" element={<AssessmentComponentManagement />} />
          <Route
            path="/reports/final-result-summary"
            element={<FinalResultSummary />}
          />

          {/* Co-Scholastic */}
          <Route path="/co-scholastic-areas" element={<CoScholasticAreaManagement />} />
          <Route path="/co-scholastic-grades" element={<CoScholasticGradeManagement />} />
          <Route path="/co-scholastic-entry" element={<CoScholasticEntry />} />
          <Route
            path="/class-co-scholastic-mapping"
            element={<ClassCoScholasticMapping />}
          />

          {/* Report Cards */}
          <Route path="/report-card-formats" element={<ReportCardFormats />} />
          <Route path="/assign-report-card-format" element={<AssignReportCardFormat />} />
          <Route path="/report-card-generator" element={<ReportCardGenerator />} />
          <Route path="/academic-years" element={<AcademicYearManagement />} />

          {/* Transport */}
          <Route path="/student-transport" element={<StudentTransport />} />

          {/* Reports */}
          <Route path="/reports/caste-gender" element={<CasteGenderReport />} />

          {/* Digital Diary */}
          <Route path="/digital-diary" element={<DigitalDiary />} />
          <Route path="/diary-feed" element={<DigitalDiary />} />
          <Route path="/student-diary" element={<StudentDiary />} />
          <Route path="/diary/:id" element={<DiaryDetail />} />

          {/* Accounts Dashboard */}
          <Route
            path="/accounts-dashboard"
            element={
              <RequireRole roles={["accounts", "admin", "superadmin"]}>
                <AccountsDashboard />
              </RequireRole>
            }
          />

          {/* Users tracking */}
          <Route
            path="/users-tracking"
            element={
              <RequireRole roles={["admin", "superadmin"]}>
                <UserTracking />
              </RequireRole>
            }
          />

          {/* Catch-all (inside app) */}
          <Route path="*" element={<h1 className="container py-4">404: Page Not Found</h1>} />
        </Route>

        {/* Any other URL → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
