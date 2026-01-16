// File: src/components/Sidebar.jsx
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useLocation, useNavigate } from "react-router-dom";
import { useRoles } from "../hooks/useRoles";
import "./Sidebar.css";

const DESKTOP_BP = 992; // Bootstrap lg

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < DESKTOP_BP);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${DESKTOP_BP - 0.02}px)`);
    const onChange = () => setMobile(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);
  return mobile;
}

// Enhanced colorful palette
const palette = [
  "#ff3b30",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#14b8a6",
  "#84cc16",
  "#ec4899",
  "#10b981",
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
];

const sidebarGradients = [
  "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)",
  "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
  "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
  "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
  "linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%)",
];

export default function Sidebar({ headerHeight = 56 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRole } = useRoles();
  const isMobile = useIsMobile();

  // Read once from localStorage; default to collapsed (false) if no saved value
  const initialExpanded = (() => {
    const saved = localStorage.getItem("sidebarExpanded");
    return saved === null ? false : saved === "true";
  })();
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // Apply body classes before first paint to avoid flicker
  useLayoutEffect(() => {
    document.body.classList.toggle("sb-expanded", isExpanded);
    document.body.classList.toggle("sb-collapsed", !isExpanded);
  }, [isExpanded]);

  // Persist preference
  useEffect(() => {
    localStorage.setItem("sidebarExpanded", String(isExpanded));
  }, [isExpanded]);

  // Close bottom sheet/drawer after navigation on mobile
  useEffect(() => {
    if (isMobile) setIsExpanded(false);
  }, [location.pathname, isMobile]);

  // roles
  const roleLower = (activeRole || "").toLowerCase();
  const isSuperAdmin = roleLower === "superadmin" || roleLower === "super_admin";
  const isAdmin = isSuperAdmin || roleLower === "admin";
  const isAcademic = roleLower === "academic_coordinator";
  const isTeacher = roleLower === "teacher";
  const isStudent = roleLower === "student";
  const isHR = roleLower === "hr";
  const isAccounts = roleLower === "accounts" || roleLower === "account";
  const isFrontoffice = roleLower === "frontoffice";

  // ✅ NEW: Admission role flags
  const isAdmission = roleLower === "admission";

  // ✅ NEW: Librarian role flags
  const isLibrarian =
    roleLower === "librarian" || roleLower === "library" || roleLower === "libraryadmin";

  // ✅ NEW: Transport role flags
  const isTransport = roleLower === "transport" || roleLower === "transporter";

  const hasAccess = (item) => {
    if (!item?.roles || item.roles.length === 0) return true;
    if (isSuperAdmin) return true;
    return item.roles.map((r) => (r || "").toLowerCase()).includes(roleLower);
  };

  // search state (desktop)
  const [q, setQ] = useState("");

  // ===== MENU GROUPS =====
  const menuGroups = useMemo(() => {
    const groups = [];

    // ✅ TRANSPORT MENU (NEW ROLE)
    if (isTransport) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "transport-dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            path: "/dashboard",
            roles: ["transport"],
          },
        ],
      });

      groups.push({
        heading: "Transport",
        items: [
          {
            key: "transport-dashboard-direct",
            label: "Transport Dashboard",
            icon: "bi-truck-front-fill",
            path: "/transport-dashboard",
            roles: ["transport"],
          },
          {
            key: "transportations",
            label: "Routes / Cost",
            icon: "bi-signpost-split",
            path: "/transportations",
            roles: ["transport"],
          },
          {
            key: "buses",
            label: "Buses",
            icon: "bi-bus-front-fill",
            path: "/buses",
            roles: ["transport"],
          },
          {
            key: "student-transport-assignments",
            label: "Assign Bus to Students",
            icon: "bi-person-check-fill",
            path: "/student-transport-assignments",
            roles: ["transport"],
          },
        ],
      });

      groups.push({
        heading: "Quick",
        items: [
          {
            key: "combined-circulars",
            label: "Circulars",
            icon: "bi-megaphone",
            path: "/combined-circulars",
            roles: ["transport"],
          },
          {
            key: "chat",
            label: "Chat",
            icon: "bi-chat-dots",
            path: "/chat",
            roles: ["transport"],
          },
        ],
      });
    }

    // ✅ LIBRARY MENU (Librarian)
    if (isLibrarian) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "library-dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            path: "/dashboard",
            roles: ["librarian", "library", "libraryadmin"],
          },
        ],
      });

      groups.push({
        heading: "Library",
        items: [
          {
            key: "library-home",
            label: "Library Dashboard",
            icon: "bi-journal-bookmark-fill",
            path: "/library-dashboard",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "library-books",
            label: "Books Catalog",
            icon: "bi-book",
            path: "/library/books",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "library-members",
            label: "Members",
            icon: "bi-people",
            path: "/library/members",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "library-issue-return",
            label: "Issue / Return",
            icon: "bi-arrow-left-right",
            path: "/library/issue-return",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "library-reservations",
            label: "Reservations",
            icon: "bi-bookmark-star",
            path: "/library/reservations",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "library-fines",
            label: "Fines & Dues",
            icon: "bi-cash-coin",
            path: "/library/fines",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "library-reports",
            label: "Reports",
            icon: "bi-graph-up",
            path: "/library/reports",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "library-settings",
            label: "Library Settings",
            icon: "bi-gear",
            path: "/library/settings",
            roles: ["librarian", "library", "libraryadmin"],
          },
        ],
      });

      groups.push({
        heading: "Quick",
        items: [
          {
            key: "combined-circulars",
            label: "Circulars",
            icon: "bi-megaphone",
            path: "/combined-circulars",
            roles: ["librarian", "library", "libraryadmin"],
          },
          {
            key: "chat",
            label: "Chat",
            icon: "bi-chat-dots",
            path: "/chat",
            roles: ["librarian", "library", "libraryadmin"],
          },
        ],
      });
    }

    // ✅ FRONT OFFICE MENU
    if (isFrontoffice) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "frontoffice-dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            path: "/dashboard",
            roles: ["frontoffice"],
          },
        ],
      });

      groups.push({
        heading: "Front Office",
        items: [
          {
            key: "gate-pass",
            label: "Gate Pass",
            icon: "bi-box-arrow-right",
            path: "/gate-pass",
            roles: ["frontoffice"],
          },
          {
            key: "visitors",
            label: "Visitors",
            icon: "bi-person-bounding-box",
            path: "/visitors",
            roles: ["frontoffice"],
          },
          {
            key: "students",
            label: "Students",
            icon: "bi-people",
            path: "/students",
            roles: ["frontoffice"],
          },
          {
            key: "enquiries",
            label: "Enquiries",
            icon: "bi-person-lines-fill",
            path: "/enquiries",
            roles: ["frontoffice"],
          },
          {
            key: "transfer-certificates",
            label: "Transfer Certificates",
            icon: "bi-award",
            path: "/transfer-certificates",
            roles: ["frontoffice"],
          },
        ],
      });
    }

    // ✅ ADMISSION MENU (NEW ROLE)
    if (isAdmission) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "admission-dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            path: "/dashboard",
            roles: ["admission"],
          },
        ],
      });

      groups.push({
        heading: "Admissions",
        items: [
          {
            key: "enquiries",
            label: "Enquiries",
            icon: "bi-chat-dots",
            path: "/enquiries",
            roles: ["admission"],
          },
          {
            key: "registrations",
            label: "Registrations",
            icon: "bi-person-plus",
            path: "/registrations",
            roles: ["admission"],
          },
          {
            key: "students",
            label: "Students",
            icon: "bi-people",
            path: "/students",
            roles: ["admission"],
          },
          {
            key: "academic-calendar-view",
            label: "Academic Calendar",
            icon: "bi-calendar3",
            path: "/academic-calendar-view",
            roles: ["admission"],
          },
        ],
      });
    }

    // ====== ACCOUNTS-ONLY MENU (Fee focus) ======
    if (isAccounts) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "accounts-dashboard",
            label: "Accounts Dashboard",
            icon: "bi-speedometer2",
            path: "/accounts-dashboard",
            roles: ["accounts"],
          },
          {
            key: "combined-circulars",
            label: "Circulars",
            icon: "bi-megaphone",
            path: "/combined-circulars",
            roles: ["accounts"],
          },
        ],
      });
      groups.push({
        heading: "Fee Management",
        items: [
          {
            key: "transactions",
            label: "Collect Fee",
            icon: "bi-receipt",
            path: "/transactions",
            roles: ["accounts"],
          },
          {
            key: "cancelledTransactions",
            label: "Cancelled Transactions",
            icon: "bi-trash3",
            path: "/cancelled-transactions",
            roles: ["accounts"],
          },
          {
            key: "dayWiseReport",
            label: "Day Wise Report",
            icon: "bi-calendar",
            path: "/reports/day-wise",
            roles: ["accounts"],
          },
          {
            key: "dayWiseCategoryReports",
            label: "Day Wise (By Category)",
            icon: "bi-calendar-check",
            path: "/reports/day-wise-category",
            roles: ["accounts"],
          },
          {
            key: "studentDue",
            label: "Fee Due Report",
            icon: "bi-file-earmark-text",
            path: "/student-due",
            roles: ["accounts"],
          },
          {
            key: "schoolFeeSummary",
            label: "Session Summary",
            icon: "bi-graph-up",
            path: "/reports/school-fee-summary",
            roles: ["accounts"],
          },
          {
            key: "transportSummary",
            label: "Transport Summary",
            icon: "bi-truck-front",
            path: "/reports/transport-summary",
            roles: ["accounts"],
          },
          {
            key: "vanFeeDetailedReport",
            label: "Van Fee Report",
            icon: "bi-truck-front",
            path: "/reports/van-fee",
            roles: ["accounts"],
          },
          {
            key: "concessionReport",
            label: "Concession Report",
            icon: "bi-journal-check",
            path: "/reports/concession",
            roles: ["accounts"],
          },

          // ✅ Transport modules (accounts may view/manage)
          {
            key: "transportations",
            label: "Transport Routes / Cost",
            icon: "bi-signpost-split",
            path: "/transportations",
            roles: ["accounts", "admin", "superadmin", "transport"],
          },
          {
            key: "buses",
            label: "Buses",
            icon: "bi-bus-front",
            path: "/buses",
            roles: ["accounts", "admin", "superadmin", "transport"],
          },
          {
            key: "student-transport-assignments",
            label: "Bus Assignments",
            icon: "bi-person-check",
            path: "/student-transport-assignments",
            roles: ["accounts", "admin", "superadmin", "transport"],
          },

          {
            key: "feeHeadings",
            label: "Fee Headings",
            icon: "bi-bookmark",
            path: "/fee-headings",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "feeCategory",
            label: "Fee Category",
            icon: "bi-tags",
            path: "/fee-category",
            roles: ["accounts", "admin", "superadmin"],
          },
        ],
      });
    }

    // ====== ADMIN MENU ======
    if (isAdmin) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "combined-circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });

      groups.push({
        heading: "Fee Management",
        items: [
          { key: "transactions", label: "Collect Fee", icon: "bi-receipt", path: "/transactions" },
          { key: "cancelledTransactions", label: "Cancelled Transactions", icon: "bi-trash3", path: "/cancelled-transactions" },
          { key: "dayWiseReport", label: "Fee Report", icon: "bi-calendar", path: "/reports/day-wise" },
          { key: "dayWiseCategoryReports", label: "Fee Report (New)", icon: "bi-calendar-check", path: "/reports/day-wise-category" },
          { key: "studentDue", label: "Fee Due Report", icon: "bi-file-earmark-text", path: "/student-due" },
          { key: "schoolFeeSummary", label: "Fee Summary(New)", icon: "bi-graph-up", path: "/reports/school-fee-summary" },
          { key: "transportSummary", label: "Transport Summary", icon: "bi-truck-front", path: "/reports/transport-summary" },
          { key: "concessionReport", label: "Concession Report", icon: "bi-journal-check", path: "/reports/concession" },
          { key: "vanFeeDetailedReport", label: "Van Fee Report", icon: "bi-truck-front", path: "/reports/van-fee" },
          { key: "feeStructure", label: "Fee Structure", icon: "bi-cash-coin", path: "/fee-structure" },

          // ✅ UPDATED: transport paths
          { key: "transportations", label: "Transportation Cost", icon: "bi-truck", path: "/transportations" },
          { key: "buses", label: "Buses", icon: "bi-bus-front", path: "/buses" },
          { key: "student-transport-assignments", label: "Transport Assignments", icon: "bi-person-check", path: "/student-transport-assignments" },

          { key: "feeHeadings", label: "Fee Headings", icon: "bi-bookmark", path: "/fee-headings" },
          { key: "feeCategory", label: "Fee Category", icon: "bi-tags", path: "/fee-category" },
          { key: "concessions", label: "Concessions", icon: "bi-percent", path: "/concessions" },
          { key: "opening-balances", label: "Opening Balances", icon: "bi-clipboard-data", path: "/opening-balances", roles: ["admin", "superadmin"] },
          { key: "caste-gender-report", label: "Caste/Gender Report", icon: "bi-people-fill", path: "/reports/caste-gender" },
        ],
      });

      groups.push({
        heading: "Admissions",
        items: [
          { key: "enquiries", label: "Enquiries", icon: "bi-person-lines-fill", path: "/enquiries", roles: ["admin", "superadmin"] },
          { key: "classes", label: "Classes", icon: "bi-list-task", path: "/classes" },
          { key: "sections", label: "Sections", icon: "bi-grid", path: "/sections" },
          { key: "sessions", label: "Sessions", icon: "bi-calendar4-week", path: "/sessions" },
        ],
      });

      groups.push({
        heading: "Certificates",
        items: [
          { key: "transfer-certificates", label: "Transfer Certificates", icon: "bi-award", path: "/transfer-certificates", roles: ["admin", "superadmin"] },
          { key: "bonafide-certificates", label: "Bonafide Certificates", icon: "bi-patch-check", path: "/bonafide-certificates", roles: ["admin", "superadmin"] },
          { key: "disciplinary-actions", label: "Disciplinary Actions", icon: "bi-exclamation-octagon", path: "/disciplinary-actions", roles: ["admin", "superadmin", "academic_coordinator"] },
        ],
      });

      groups.push({
        heading: "School Info",
        items: [
          { key: "schools", label: "Schools", icon: "bi-building", path: "/schools" },
          { key: "houses", label: "Houses", icon: "bi-house-door", path: "/houses", roles: ["admin", "superadmin"] },
        ],
      });

      groups.push({
        heading: "Leave",
        items: [{ key: "employee-leave-request", label: "Leave Request", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" }],
      });
    }

    // ====== ACADEMIC COORDINATOR MENU ======
    if (isAcademic) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });

      groups.push({
        heading: "Academic",
        items: [
          { key: "subjects", label: "Subjects", icon: "bi-book", path: "/subjects" },
          { key: "students", label: "Students", icon: "bi-people", path: "/students" },
          { key: "teacherAssignment", label: "Teacher Assignment", icon: "bi-person-check", path: "/teacher-assignment" },
          { key: "inchargeAssignment", label: "Incharge Assignment", icon: "bi-person-badge", path: "/incharge-assignment" },
          { key: "holidayMarking", label: "Holiday Marking", icon: "bi-calendar3", path: "/holiday-marking" },
          { key: "periods", label: "Periods", icon: "bi-clock", path: "/periods" },
          { key: "combined-timetable", label: "Timetable", icon: "bi-table", path: "/combined-timetable" },
          { key: "substitution", label: "Substitutions", icon: "bi-arrow-repeat", path: "/substitution" },
          { key: "substitutionListing", label: "Substitution Listing", icon: "bi-list-ul", path: "/substitution-listing" },
          { key: "studentUserAccounts", label: "Create Student Login", icon: "bi-person-plus", path: "/student-user-accounts" },
          { key: "sessions", label: "Sessions", icon: "bi-calendar4-week", path: "/sessions" },

          // (Keep old module if still used)
          { key: "student-transport", label: "Transport (Old)", icon: "bi-truck", path: "/student-transport" },

          { key: "caste-gender-report", label: "Caste/Gender Report", icon: "bi-people-fill", path: "/reports/caste-gender" },
        ],
      });

      groups.push({
        heading: "Exam Settings",
        items: [
          { key: "academic-years", label: "Academic Years", icon: "bi-calendar2-week", path: "/academic-years" },
          { key: "exams", label: "Exams", icon: "bi-journal-bookmark", path: "/exams" },
          { key: "exam-schemes", label: "Exam Scheme", icon: "bi-card-checklist", path: "/exam-schemes" },
          { key: "co-scholastic-areas", label: "Co-Scholastic Areas", icon: "bi-easel3", path: "/co-scholastic-areas" },
          { key: "co-scholastic-grades", label: "Co-Scholastic Grades", icon: "bi-star", path: "/co-scholastic-grades" },
          { key: "class-co-scholastic-mapping", label: "Class Co-Scholastic Mapping", icon: "bi-easel3", path: "/class-co-scholastic-mapping", roles: ["academic_coordinator", "superadmin"] },
          { key: "grade-schemes", label: "Grade Scheme", icon: "bi-ui-checks", path: "/grade-schemes" },
          { key: "term-management", label: "Terms", icon: "bi-calendar3-range", path: "/term-management" },
          { key: "assessment-components", label: "Assessment Components", icon: "bi-diagram-3", path: "/assessment-components" },
          { key: "exam-schedules", label: "Exam Schedule", icon: "bi-calendar2-check", path: "/exam-schedules" },
          { key: "report-card-formats", label: "Report Card Format", icon: "bi-file-earmark-font", path: "/report-card-formats" },
          { key: "assign-report-card-format", label: "Assign Report Format", icon: "bi-link", path: "/assign-report-card-format" },
        ],
      });

      groups.push({
        heading: "Leave",
        items: [{ key: "employee-leave-request", label: "Leave Request", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" }],
      });

      groups.push({
        heading: "Disciplinary",
        items: [
          {
            key: "disciplinary-actions",
            label: "Disciplinary Actions",
            icon: "bi-exclamation-octagon",
            path: "/disciplinary-actions",
            roles: ["academic_coordinator", "admin", "superadmin"],
          },
        ],
      });
    }

    // ====== HR MENU ======
    if (isHR) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "combined-circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });
      groups.push({
        heading: "HR Management",
        items: [
          { key: "departments", label: "Departments", icon: "bi-diagram-3", path: "/departments" },
          { key: "employees", label: "Employees", icon: "bi-person-badge", path: "/employees" },
          { key: "employee-user-accounts", label: "Employee Login Accounts", icon: "bi-person-plus", path: "/employee-user-accounts" },
          { key: "leave-types", label: "Leave Types", icon: "bi-journals", path: "/leave-types" },
          { key: "employee-leave-balances", label: "Employee Leave Balances", icon: "bi-calendar-check", path: "/employee-leave-balances" },
          { key: "employee-leave-request", label: "Leave Request", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" },
          { key: "hr-leave-requests", label: "Review Leave Requests", icon: "bi-clipboard-check", path: "/hr-leave-requests" },
          { key: "employee-attendance", label: "Employee Attendance", icon: "bi-person-check-fill", path: "/employee-attendance" },
          { key: "my-attendance-calendar", label: "My Attendance", icon: "bi-calendar2-week", path: "/my-attendance-calendar" },
          { key: "employee-attendance-summary", label: "Employee Attendance Summary", icon: "bi-calendar-range", path: "/employee-attendance-summary" },
        ],
      });
    }

    // ====== TEACHER MENU ======
    if (isTeacher) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "view-circulars", label: "Circulars", icon: "bi-megaphone", path: "/view-circulars" },
          { key: "mark-attendance", label: "Mark Attendance", icon: "bi-check2-square", path: "/mark-attendance" },
          { key: "attendance-calendar", label: "Attendance Calendar", icon: "bi-calendar2-check", path: "/attendance-calendar" },
          { key: "assignments", label: "Assignments", icon: "bi-clipboard", path: "/assignments" },
          { key: "assignment-marking", label: "Assignment Marking", icon: "bi-pencil-square", path: "/assignment-marking" },
          { key: "teacher-timetable-display", label: "Time Table", icon: "bi-table", path: "/teacher-timetable-display" },
          { key: "combined-teacher-substitution", label: "My Substitutions", icon: "bi-arrow-repeat", path: "/combined-teacher-substitution" },
          { key: "lesson-plan", label: "Lesson Plan", icon: "bi-journal-text", path: "/lesson-plan" },
          { key: "employee-leave-request", label: "Request Leave", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" },
          { key: "my-attendance-calendar", label: "My Attendance", icon: "bi-calendar2-week", path: "/my-attendance-calendar" },
        ],
      });

      groups.push({
        heading: "Leave Management",
        items: [{ key: "leave-requests", label: "Leave Requests", icon: "bi-envelope", path: "/leave-requests" }],
      });

      groups.push({
        heading: "Academic",
        items: [
          { key: "classes", label: "Classes", icon: "bi-list-task", path: "/classes" },
          { key: "subjects", label: "Subjects", icon: "bi-book", path: "/subjects" },
        ],
      });

      groups.push({
        heading: "Exam",
        items: [
          { key: "roll-numbers", label: "Roll Numbers", icon: "bi-list-ol", path: "/roll-numbers" },
          { key: "marks-entry", label: "Marks Entry", icon: "bi-pencil-square", path: "/marks-entry" },
          { key: "classwise-result-summary", label: "Result Summary", icon: "bi-bar-chart", path: "/reports/classwise-result-summary" },
          { key: "final-result-summary", label: "Final Result Summary", icon: "bi-bar-chart-line", path: "/reports/final-result-summary" },
          { key: "coscholastic-entry", label: "Co-Scholastic Entry", icon: "bi-stars", path: "/co-scholastic-entry" },
          { key: "student-remarks-entry", label: "Student Remarks Entry", icon: "bi-chat-square-text", path: "/student-remarks-entry" },
          { key: "report-card-generator", label: "Print Report Cards", icon: "bi-printer", path: "/report-card-generator" },
        ],
      });
    }

    // ====== STUDENT MENU ======
    if (isStudent) {
      groups.push({
        heading: "Student",
        items: [
          { key: "student-home", label: "Home", icon: "bi-house", path: "/dashboard", roles: ["student"] },
          { key: "student-attendance", label: "Attendance", icon: "bi-calendar2-check", path: "/student-attendance", roles: ["student"] },
          { key: "my-assignments", label: "Assignments", icon: "bi-journal-check", path: "/my-assignments", roles: ["student"] },
          { key: "student-diary", label: "Diary", icon: "bi-journal-text", path: "/student-diary", roles: ["student"] },
          { key: "student-circulars", label: "Circulars", icon: "bi-megaphone", path: "/student-circulars", roles: ["student"] },
          { key: "student-timetable-display", label: "Timetable", icon: "bi-clock-history", path: "/student-timetable-display", roles: ["student"] },
          { key: "student-fee", label: "Fees", icon: "bi-cash-coin", path: "/student-fee", roles: ["student"] },
          { key: "chat", label: "Chat", icon: "bi-chat-dots", path: "/chat", roles: ["student"] },
        ],
      });
    }

    // Admin inserts User Management group
    if (isAdmin) {
      groups.splice(1, 0, {
        heading: "User Management",
        items: [
          { key: "users", label: "Users", icon: "bi-person", path: "/users", roles: ["superadmin"] },
          { key: "users-tracking", label: "User Tracking", icon: "bi-activity", path: "/users-tracking", roles: ["admin", "superadmin"] },
        ],
      });
    }

    for (const g of groups) g.items = g.items.filter(hasAccess);
    return groups;
  }, [
    isAdmin,
    isAcademic,
    isTeacher,
    isStudent,
    isHR,
    isSuperAdmin,
    isAccounts,
    isFrontoffice,
    isAdmission,
    isLibrarian,
    isTransport,
    roleLower,
  ]);

  // filter groups by desktop search query (q)
  const filteredGroups = useMemo(() => {
    const s = (q || "").trim().toLowerCase();
    if (!s) return menuGroups;
    const out = [];
    for (const g of menuGroups) {
      const matchedItems = g.items.filter((it) => {
        const label = (it.label || "").toLowerCase();
        const path = (it.path || "").toLowerCase();
        const group = (g.heading || "").toLowerCase();
        return label.includes(s) || path.includes(s) || group.includes(s);
      });
      if (matchedItems.length) out.push({ ...g, items: matchedItems });
    }
    return out;
  }, [q, menuGroups]);

  const isPathActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const handleMenuClick = (item) => {
    navigate(item.path);
  };

  const asideStyle = {
    top: `${headerHeight}px`,
    height: `calc(100vh - ${headerHeight}px)`,
    "--header-h": `${headerHeight}px`,
  };

  // --------- Mobile bottom bar helpers ----------
  const flattenMenu = (groups) =>
    groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.heading })));

  const allItems = useMemo(() => flattenMenu(menuGroups), [menuGroups]);

  const PRIMARY_BY_ROLE = {
    admin: ["dashboard", "transactions", "studentDue", "opening-balances"],
    academic_coordinator: ["dashboard", "combined-timetable", "students", "exam-schemes"],
    teacher: ["dashboard", "mark-attendance", "teacher-timetable-display", "marks-entry"],
    student: ["student-home", "student-diary", "student-attendance", "student-timetable-display"],
    hr: ["dashboard", "employees", "employee-attendance", "hr-leave-requests"],
    superadmin: ["dashboard", "users", "reports/day-wise", "transactions", "opening-balances"],
    accounts: ["accounts-dashboard", "transactions", "studentDue", "dayWiseReport"],
    frontoffice: ["frontoffice-dashboard", "gate-pass", "visitors", "enquiries", "students"],
    admission: ["admission-dashboard", "enquiries", "registrations", "students"],

    // ✅ NEW: Transport bottom-nav priorities
    transport: ["transport-dashboard-direct", "transportations", "buses", "student-transport-assignments"],
    transporter: ["transport-dashboard-direct", "transportations", "buses", "student-transport-assignments"],

    // ✅ Librarian bottom-nav priorities
    librarian: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    library: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    libraryadmin: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
  };

  const primaryKeys =
    PRIMARY_BY_ROLE[roleLower] || allItems.slice(0, 4).map((i) => i.key);
  const primaryItems = allItems
    .filter((i) => primaryKeys.includes(i.key))
    .slice(0, 5);
  const moreItems = allItems.filter((i) => !primaryKeys.includes(i.key));

  // Mobile: bottom nav
  if (isMobile) {
    return (
      <BottomNav
        items={primaryItems}
        moreItems={moreItems}
        isActive={isPathActive}
        onClick={handleMenuClick}
      />
    );
  }

  // Desktop: sidebar
  return (
    <>
      <aside className="app-sidebar" style={asideStyle} aria-label="Sidebar navigation">
        <div className="sidebar-top d-flex align-items-center px-2">
          <button
            className="btn toggle-btn ms-auto"
            onClick={() => setIsExpanded((p) => !p)}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <i className="bi bi-chevron-left" /> : <i className="bi bi-list" />}
          </button>
        </div>

        <div className="px-3 py-2">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search menu..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search menu"
          />
        </div>

        <nav className="mt-1">
          {filteredGroups.map((group, gi) => (
            <div key={gi}>
              {isExpanded && (
                <h6 className="group-heading text-uppercase px-3 mt-3 mb-1">
                  {group.heading}
                </h6>
              )}
              <ul className="nav flex-column">
                {group.items.map((item, ii) => {
                  const active = isPathActive(item.path);
                  const gradient = sidebarGradients[ii % sidebarGradients.length];
                  return (
                    <li
                      key={item.key}
                      className={`nav-item sidebar-item ${active ? "active" : ""}`}
                      onClick={() => handleMenuClick(item)}
                      title={!isExpanded ? item.label : undefined}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && handleMenuClick(item)
                      }
                      style={{ "--item-gradient": gradient }}
                    >
                      <span className="active-indicator" />
                      <div className={`item-content ${isExpanded ? "expanded" : "collapsed"}`}>
                        <i
                          className={`bi ${item.icon} item-icon`}
                          aria-hidden="true"
                          style={{ color: palette[ii % palette.length] }}
                        />
                        <span className="item-label">{item.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {filteredGroups.length === 0 && (
            <div className="px-3 py-2 text-muted small">No menu items match “{q}”.</div>
          )}
        </nav>
      </aside>
      <div className="sidebar-scrim" aria-hidden="true" />
    </>
  );
}

/* ------- BottomNav Component ------- */
function BottomNav({ items, moreItems, isActive, onClick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return moreItems;
    return moreItems.filter(
      (i) => i.label.toLowerCase().includes(s) || i.group?.toLowerCase().includes(s)
    );
  }, [q, moreItems]);

  return (
    <>
      <nav className="bottom-nav" role="navigation" aria-label="Primary mobile navigation">
        {items.map((it, i) => (
          <button
            key={it.key}
            className={`bn-item ${isActive(it.path) ? "active" : ""}`}
            onClick={() => onClick(it)}
            aria-label={it.label}
            title={it.label}
            style={{
              backgroundImage: sidebarGradients[i % sidebarGradients.length],
              color: palette[i % palette.length],
            }}
          >
            <i className={`bi ${it.icon}`} />
            <span>{it.label}</span>
          </button>
        ))}

        <button
          className={`bn-item ${open ? "active" : ""}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="More"
          title="More"
          style={{ backgroundImage: sidebarGradients[6] }}
        >
          <i className="bi bi-three-dots" />
          <span>More</span>
        </button>
      </nav>

      {open && (
        <>
          <div className="bn-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="bn-sheet" role="dialog" aria-modal="true" aria-label="All menu options">
            <div className="bn-sheet-handle" />
            <div className="bn-sheet-header">
              <input
                className="form-control bn-search"
                placeholder="Search menu…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button className="btn btn-sm btn-light" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className="bn-list">
              {filtered.map((it, i) => (
                <button
                  key={it.key}
                  className="bn-list-item"
                  onClick={() => {
                    onClick(it);
                    setOpen(false);
                  }}
                  style={{ "--item-gradient": sidebarGradients[i % sidebarGradients.length] }}
                >
                  <i className={`bi ${it.icon}`} style={{ color: palette[i % palette.length] }} />
                  <div className="bn-li-text">
                    <div className="bn-li-title">{it.label}</div>
                    {it.group && <div className="bn-li-sub">{it.group}</div>}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-muted small px-3 py-2">No items match that search.</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
