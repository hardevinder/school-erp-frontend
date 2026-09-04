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

const GROUP_ORDER = {
  Main: 1,
  "Daily Work": 2,
  Operations: 3,
  Management: 4,
  Academic: 5,
  Examination: 6,
  "Exam Settings": 7,
  Admissions: 8,
  "Fee Collection": 9,
  "Fee Setup": 10,
  Inventory: 11,
  Transport: 12,
  Library: 13,
  "Front Office": 14,
  "HR Management": 15,
  "Health & Wellness": 15.5,
  Certificates: 16,
  Reports: 17,
  "Fee Reports": 18,
  "School Info": 19,
  Leave: 20,
  "Leave Management": 21,
  Disciplinary: 22,
  Quick: 23,
  Support: 23.5,
  Utilities: 24,
  Student: 25,
};

const MY_LIBRARY_ROLES = [
  "superadmin",
  "admin",
  "principal",
  "academic_coordinator",
  "teacher",
  "department_hod",
  "student",
  "hr",
  "accounts",
  "account",
  "frontoffice",
  "admission",
  "examination",
  "transport",
  "transporter",
  "librarian",
  "library",
  "libraryadmin",
  "inventoryadmin",
  "storeincharge",
  "labincharge",
];

function cleanGroups(groups = []) {
  return groups
    .map((g) => ({
      ...g,
      items: Array.isArray(g.items) ? g.items.filter(Boolean) : [],
    }))
    .filter((g) => g.items.length > 0);
}

function sortGroups(groups = []) {
  return [...groups].sort((a, b) => {
    const ao = GROUP_ORDER[a.heading] ?? 999;
    const bo = GROUP_ORDER[b.heading] ?? 999;
    if (ao !== bo) return ao - bo;
    return (a.heading || "").localeCompare(b.heading || "");
  });
}

export default function Sidebar({ headerHeight = 56 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRole } = useRoles();
  const isMobile = useIsMobile();

  const initialExpanded = (() => {
    const saved = localStorage.getItem("sidebarExpanded");
    return saved === null ? false : saved === "true";
  })();

  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  useLayoutEffect(() => {
    document.body.classList.toggle("sb-expanded", isExpanded);
    document.body.classList.toggle("sb-collapsed", !isExpanded);
  }, [isExpanded]);

  useEffect(() => {
    localStorage.setItem("sidebarExpanded", String(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    if (isMobile) setIsExpanded(false);
  }, [location.pathname, isMobile]);

  const roleLower = (activeRole || "").toLowerCase();
  const isSuperAdmin = roleLower === "superadmin" || roleLower === "super_admin";
  const isAdmin = isSuperAdmin || roleLower === "admin";
  const isPrincipal = roleLower === "principal";
  const isAcademic = roleLower === "academic_coordinator" || roleLower === "coordinator";
  const isDepartmentHod = roleLower === "department_hod";
  const isTeacher = roleLower === "teacher" || isDepartmentHod;
  const isStudent = roleLower === "student";
  const isHR = roleLower === "hr";
  const isHealthStaff = ["health_staff", "doctor", "nurse", "medical_officer"].includes(roleLower);
  const isAccounts = roleLower === "accounts" || roleLower === "account" || roleLower === "accountant";
  const isFrontoffice = roleLower === "frontoffice";
  const isAdmission = roleLower === "admission";
  const isLibrarian =
    roleLower === "librarian" || roleLower === "library" || roleLower === "libraryadmin";
  const isTransport = roleLower === "transport" || roleLower === "transporter";
  const isExamination = roleLower === "examination";

  const isInventoryAdmin = roleLower === "inventoryadmin";
  const isStoreIncharge = roleLower === "storeincharge";
  const isLabIncharge = roleLower === "labincharge";

  const isInventoryRole =
    isInventoryAdmin || isStoreIncharge || isLabIncharge;

  const inventoryViewRoles = [
    "superadmin",
    "admin",
    "principal",
    "accounts",
    "account",
    "inventoryadmin",
    "storeincharge",
    "labincharge",
  ];

  const inventoryManageRoles = [
    "superadmin",
    "admin",
    "inventoryadmin",
    "storeincharge",
  ];

  const hasAccess = (item) => {
    if (!item?.roles || item.roles.length === 0) return true;
    if (isSuperAdmin) return true;
    return item.roles.map((r) => (r || "").toLowerCase()).includes(roleLower);
  };

  const [q, setQ] = useState("");

  const [activeMenuGroup, setActiveMenuGroup] = useState("");
  const [submenuQuery, setSubmenuQuery] = useState("");

  const menuGroups = useMemo(() => {
    const groups = [];

    // ====== INVENTORY ONLY ROLES ======
    if (isInventoryRole && !isAdmin && !isAccounts) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "inventory-dashboard-main",
            label: "Inventory Dashboard",
            icon: "bi-box-seam",
            path: "/inventory",
            roles: ["principal", "inventoryadmin", "storeincharge", "labincharge"],
          },
        ],
      });

      groups.push({
        heading: "Inventory",
        items: [
          {
            key: "inventory-dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            path: "/inventory",
            roles: ["principal", "inventoryadmin", "storeincharge", "labincharge"],
          },
          {
            key: "inventory-categories",
            label: "Categories",
            icon: "bi-tags",
            path: "/inventory/categories",
            roles: ["principal", "inventoryadmin", "storeincharge", "labincharge"],
          },
          {
            key: "inventory-items",
            label: "Items",
            icon: "bi-box2",
            path: "/inventory/items",
            roles: ["principal", "inventoryadmin", "storeincharge", "labincharge"],
          },
          {
            key: "inventory-locations",
            label: "Locations",
            icon: "bi-geo-alt",
            path: "/inventory/locations",
            roles: ["principal", "inventoryadmin", "storeincharge", "labincharge"],
          },
          {
            key: "inventory-opening-stock",
            label: "Opening Stock",
            icon: "bi-archive",
            path: "/inventory/opening-stock",
            roles: ["inventoryadmin", "storeincharge"],
          },
          {
            key: "inventory-receive-stock",
            label: "Receive Stock",
            icon: "bi-box-arrow-in-down",
            path: "/inventory/receive-stock",
            roles: ["inventoryadmin", "storeincharge"],
          },
          {
            key: "inventory-issue-stock",
            label: "Issue Stock",
            icon: "bi-box-arrow-up",
            path: "/inventory/issue-stock",
            roles: ["inventoryadmin", "storeincharge"],
          },
          {
            key: "inventory-transfer-stock",
            label: "Transfer Stock",
            icon: "bi-arrow-left-right",
            path: "/inventory/transfer-stock",
            roles: ["inventoryadmin", "storeincharge"],
          },
          {
            key: "inventory-adjust-stock",
            label: "Adjust Stock",
            icon: "bi-sliders",
            path: "/inventory/adjust-stock",
            roles: ["inventoryadmin", "storeincharge"],
          },
          {
            key: "inventory-transactions",
            label: "Transactions",
            icon: "bi-journal-text",
            path: "/inventory/transactions",
            roles: ["principal", "inventoryadmin", "storeincharge", "labincharge"],
          },
          {
            key: "inventory-stock-report",
            label: "Stock Report",
            icon: "bi-bar-chart-line",
            path: "/inventory/stock-report",
            roles: ["principal", "inventoryadmin", "storeincharge", "labincharge"],
          },
        ],
      });
    }


    // ====== PRINCIPAL / SCHOOL COMMAND CENTER ======
    if (isPrincipal) {
      groups.push({
        heading: "Main",
        items: [
          { key: "command-center", label: "School Command Center", icon: "bi-command", path: "/command-center" },
          { key: "school-ai-principal", label: "Ask School AI", icon: "bi-stars", path: "/school-ai" }, // SCHOOL_AI_SIDEBAR_V12
          { key: "principal-action-inbox", label: "My Actions & Approvals", icon: "bi-inboxes-fill", path: "/action-inbox" },
          { key: "principal-parent-consents", label: "Parent Consent & Acknowledgement", icon: "bi-pen", path: "/parent-consents" },
          { key: "principal-calendar", label: "Academic Calendar", icon: "bi-calendar-event", path: "/academic-calendar" },
          { key: "principal-circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });

      groups.push({
        heading: "Management",
        items: [
          { key: "principal-students", label: "Students", icon: "bi-people", path: "/students" },
          { key: "principal-student-leadership", label: "Student Leadership & Council", icon: "bi-award", path: "/student-leadership" }, // STUDENT_LEADERSHIP_V13
          { key: "principal-staff-leadership", label: "Staff Leadership & Activities", icon: "bi-people-fill", path: "/staff-leadership" }, // STAFF_LEADERSHIP_V14
          { key: "principal-house-duty", label: "House Duty, Assembly & Co-Curricular", icon: "bi-flag-fill", path: "/house-duty" }, // HOUSE_DUTY_V15
          { key: "principal-teacher-performance", label: "Teacher Performance Intelligence", icon: "bi-graph-up-arrow", path: "/teacher-performance" },
          { key: "principal-departments", label: "Department Management", icon: "bi-building-gear", path: "/department-management" },
          { key: "principal-documents", label: "Document Vault", icon: "bi-shield-lock", path: "/document-vault" },
          { key: "principal-anecdotal", label: "Anecdotal Records", icon: "bi-journal-check", path: "/anecdotal-records" },
          { key: "principal-health", label: "Student Health & Growth", icon: "bi-heart-pulse", path: "/student-health" },
          { key: "principal-readiness", label: "Daily Readiness & Hygiene", icon: "bi-clipboard2-check", path: "/daily-readiness" },
          { key: "principal-lost-found", label: "Lost & Found", icon: "bi-search", path: "/lost-found" },
          { key: "principal-discipline", label: "Disciplinary Actions", icon: "bi-exclamation-octagon", path: "/disciplinary-actions" },
        ],
      });

      groups.push({
        heading: "Academic",
        items: [
          { key: "principal-assessments", label: "Assessments & Tests", icon: "bi-clipboard2-check", path: "/assessments" },
          { key: "principal-online-classes", label: "Online Classes", icon: "bi-camera-video", path: "/online-classes" },
          { key: "principal-diary-monitor", label: "Digital Diary Monitor", icon: "bi-journal-richtext", path: "/coordinator-digital-diaries" },
          { key: "principal-ptm", label: "PTM Management", icon: "bi-people-fill", path: "/ptm-management" },
          { key: "principal-syllabus", label: "Syllabus Progress", icon: "bi-list-check", path: "/syllabus-breakdown" },
          { key: "principal-syllabus-approval", label: "Syllabus Approval", icon: "bi-check2-square", path: "/syllabus-approval" },
        ],
      });

      groups.push({
        heading: "Examination",
        items: [
          { key: "principal-exam-dashboard", label: "Examination Dashboard", icon: "bi-ui-checks-grid", path: "/exam-dashboard" },
          { key: "principal-exam-schedules", label: "Exam Schedule", icon: "bi-calendar2-check", path: "/exam-schedules" },
          { key: "principal-exam-seating", label: "Seating & Invigilation", icon: "bi-grid-3x3-gap", path: "/exam-seating" },
          { key: "principal-answer-scripts", label: "Answer Script Management", icon: "bi-journal-check", path: "/answer-script-management" },
        ],
      });

      groups.push({
        heading: "Transport",
        items: [
          { key: "principal-live-bus", label: "Live Bus Tracking", icon: "bi-geo-alt-fill", path: "/live-bus-tracking" },
          { key: "principal-transport-dashboard", label: "Transport Dashboard", icon: "bi-bus-front", path: "/transport-dashboard" },
        ],
      });

      groups.push({
        heading: "Inventory",
        items: [
          { key: "principal-inventory", label: "Inventory Dashboard", icon: "bi-box-seam", path: "/inventory" },
          { key: "principal-inventory-items", label: "Inventory Items", icon: "bi-box2", path: "/inventory/items" },
          { key: "principal-inventory-report", label: "Stock Report", icon: "bi-bar-chart-line", path: "/inventory/stock-report" },
        ],
      });
    }

    // ====== EXAMINATION ======
    if (isExamination) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "exam-dashboard",
            label: "Examination Dashboard",
            icon: "bi-speedometer2",
            path: "/dashboard",
            roles: ["examination"],
          },
          {
            key: "circulars",
            label: "Circulars",
            icon: "bi-megaphone",
            path: "/combined-circulars",
            roles: ["examination"],
          },
          {
            key: "examination-expenses",
            label: "Examination Expenses",
            icon: "bi-wallet2",
            path: "/examination-expenses",
            roles: ["examination", "admin", "superadmin"],
          },
        ],
      });

      groups.push({
        heading: "Examination",
        items: [
          { key: "subjects", label: "Subjects", icon: "bi-book", path: "/subjects", roles: ["examination"] },
          { key: "exams", label: "Exams", icon: "bi-journal-bookmark", path: "/exams", roles: ["examination"] },
          { key: "exam-schemes", label: "Exam Schemes", icon: "bi-card-checklist", path: "/exam-schemes", roles: ["examination"] },
          { key: "exam-schedules", label: "Exam Schedule", icon: "bi-calendar2-check", path: "/exam-schedules", roles: ["examination"] },
          { key: "exam-seating", label: "Seating Plan & Duties", icon: "bi-grid-3x3-gap-fill", path: "/exam-seating", roles: ["examination"] },
          { key: "answer-script-management", label: "Answer Scripts & Bundles", icon: "bi-box-seam-fill", path: "/answer-script-management", roles: ["examination"] },
          { key: "assessment-components", label: "Assessment Components", icon: "bi-diagram-3", path: "/assessment-components", roles: ["examination"] },
          { key: "term-management", label: "Terms", icon: "bi-calendar3-range", path: "/term-management", roles: ["examination"] },
          { key: "grade-schemes", label: "Grade Schemes", icon: "bi-ui-checks", path: "/grade-schemes", roles: ["examination"] },
          { key: "incharge-assignment", label: "Incharge Assignment", icon: "bi-person-badge", path: "/incharge-assignment", roles: ["examination"] },
          { key: "co-scholastic-areas", label: "Co-Scholastic Areas", icon: "bi-easel3", path: "/co-scholastic-areas", roles: ["examination"] },
          { key: "co-scholastic-grades", label: "Co-Scholastic Grades", icon: "bi-star", path: "/co-scholastic-grades", roles: ["examination"] },
          { key: "class-co-scholastic-mapping", label: "Class Co-Scholastic Mapping", icon: "bi-grid-3x3-gap", path: "/class-co-scholastic-mapping", roles: ["examination"] },
          { key: "co-scholastic-entry", label: "Co-Scholastic Entry", icon: "bi-stars", path: "/co-scholastic-entry", roles: ["examination"] },
          { key: "roll-numbers", label: "Roll Numbers", icon: "bi-list-ol", path: "/roll-numbers", roles: ["examination"] },
          { key: "marks-entry", label: "Marks Entry", icon: "bi-pencil-square", path: "/marks-entry", roles: ["examination"] },
          { key: "marks-access-management", label: "Marks Access & Tracking", icon: "bi-person-check", path: "/marks-access-management", roles: ["examination"] },
          { key: "classwise-result-summary", label: "Class Result", icon: "bi-bar-chart", path: "/reports/classwise-result-summary", roles: ["examination"] },
          { key: "final-result-summary", label: "Final Result Summary", icon: "bi-bar-chart-line", path: "/reports/final-result-summary", roles: ["examination"] },
          { key: "report-card-formats", label: "Report Card Formats", icon: "bi-file-earmark-font", path: "/report-card-formats", roles: ["examination"] },
          { key: "assign-report-card-format", label: "Assign Report Format", icon: "bi-link", path: "/assign-report-card-format", roles: ["examination"] },
          { key: "student-remarks-entry", label: "Student Remarks Entry", icon: "bi-chat-square-text", path: "/student-remarks-entry", roles: ["examination"] },
          { key: "report-card-generator", label: "Print Report Cards", icon: "bi-printer", path: "/report-card-generator", roles: ["examination"] },
        ],
      });

      groups.push({
        heading: "Quick",
        items: [
          { key: "chat", label: "Chat", icon: "bi-chat-dots", path: "/chat", roles: ["examination"] },
          { key: "academic-calendar-view", label: "Academic Calendar", icon: "bi-calendar3", path: "/academic-calendar-view", roles: ["examination"] },
        ],
      });
    }

    // ====== TRANSPORT ======
    if (isTransport) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "transport-dashboard",
            label: "Dashboard",
            icon: "bi-speedometer2",
            path: "/dashboard",
            roles: ["transport", "transporter"],
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
            roles: ["transport", "transporter"],
          },

          {
            key: "live-bus-tracking",
            label: "Live Bus Tracking",
            icon: "bi-geo-alt-fill",
            path: "/live-bus-tracking",
            roles: ["transport"],
          },
          {
            key: "transportations",
            label: "Transport Routes",
            icon: "bi-signpost-split",
            path: "/transportations",
            roles: ["transport", "transporter"],
          },
          {
            key: "buses",
            label: "Buses",
            icon: "bi-bus-front-fill",
            path: "/buses",
            roles: ["transport", "transporter"],
          },
          {
            key: "actual-routes",
            label: "Actual Routes",
            icon: "bi-map",
            path: "/actual-routes",
            roles: ["transport", "transporter"],
          },
          {
            key: "student-transport-assignments",
            label: "Assign Bus to Students",
            icon: "bi-person-check-fill",
            path: "/student-transport-assignments",
            roles: ["transport", "transporter"],
          },
          {
            key: "employee-transport-assignments",
            label: "Assign Bus to Employees",
            icon: "bi-person-badge-fill",
            path: "/employee-transport-assignments",
            roles: ["transport", "transporter"],
          },
          {
            key: "document-vault-transport",
            label: "Driver Document Vault",
            icon: "bi-shield-check",
            path: "/document-vault",
            roles: ["transport", "transporter"],
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
            roles: ["transport", "transporter"],
          },
          {
            key: "chat",
            label: "Chat",
            icon: "bi-chat-dots",
            path: "/chat",
            roles: ["transport", "transporter"],
          },
        ],
      });
    }

    // ====== LIBRARY ======
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

    // ====== FRONT OFFICE ======
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
          {
            key: "lost-found-frontoffice",
            label: "Lost & Found",
            icon: "bi-search",
            path: "/lost-found",
            roles: ["frontoffice"],
          },
        ],
      });
    }

    // ====== ADMISSION ======
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
          {
            key: "student-strength-projection",
            label: "Next Session Projection",
            icon: "bi-bar-chart-steps",
            path: "/reports/student-strength-projection",
            roles: ["admission"],
          },
        ],
      });
    }

    // ====== ACCOUNTS ======
    if (isAccounts) {
      groups.push({
        heading: "Main",
        items: [
          {
            key: "accounts-dashboard",
            label: "Accounts Dashboard",
            icon: "bi-speedometer2",
            path: "/accounts-dashboard",
            roles: ["accounts", "account"],
          },
          {
            key: "combined-circulars",
            label: "Circulars",
            icon: "bi-megaphone",
            path: "/combined-circulars",
            roles: ["accounts", "account"],
          },
          {
            key: "document-vault-accounts",
            label: "Official Letters & Documents",
            icon: "bi-file-earmark-lock2",
            path: "/document-vault",
            roles: ["accounts", "account", "accountant"],
          },
        ],
      });

      groups.push({
        heading: "Daily Work",
        items: [
          {
            key: "transactions",
            label: "Collect Fee",
            icon: "bi-receipt",
            path: "/transactions",
            roles: ["accounts", "account"],
          },
          {
            key: "cancelledTransactions",
            label: "Cancelled Transactions",
            icon: "bi-trash3",
            path: "/cancelled-transactions",
            roles: ["accounts", "account"],
          },
          {
            key: "expense-management-accounts",
            label: "Expense Management",
            icon: "bi-wallet2",
            path: "/expense-management",
            roles: ["accounts", "account", "admin", "superadmin"],
          },
          {
            key: "opening-balances",
            label: "Opening Balances",
            icon: "bi-clipboard-data",
            path: "/opening-balances",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "bulk-promotion",
            label: "Bulk Promotion",
            icon: "bi-arrow-up-square",
            path: "/students/bulk-promotion",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "promotion-history",
            label: "Promotion History",
            icon: "bi-clock-history",
            path: "/students/promotion-history",
            roles: ["accounts", "admin", "superadmin"],
          },
        ],
      });

      groups.push({
        heading: "Fee Setup",
        items: [
          {
            key: "feeStructure",
            label: "Class Fee Structure",
            icon: "bi-cash-coin",
            path: "/fee-structure",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "studentFeeStructure",
            label: "Student Fee Structure",
            icon: "bi-person-vcard",
            path: "/student-fee-structure",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "feeHeadings",
            label: "Fee Headings",
            icon: "bi-bookmark",
            path: "/fee-headings",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "mode-of-transactions",
            label: "Mode of Transactions",
            icon: "bi-credit-card-2-front",
            path: "/mode-of-transactions",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "school-bank-accounts",
            label: "School Bank Accounts",
            icon: "bi-bank",
            path: "/school-bank-accounts",
            roles: ["accounts", "account", "admin", "superadmin"],
          },
          {
            key: "payment-gateway-settings-accounts",
            label: "Payment Gateway",
            icon: "bi-credit-card-2-front",
            path: "/payment-gateway-settings",
            roles: ["accounts", "account", "admin", "superadmin"],
          },
          {
            key: "whatsapp-api-settings-accounts",
            label: "WhatsApp API",
            icon: "bi-whatsapp",
            path: "/whatsapp-api-settings",
            roles: ["accounts", "account", "admin", "superadmin"],
          },
          {
            key: "feeCategory",
            label: "Fee Category",
            icon: "bi-tags",
            path: "/fee-category",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "concessions",
            label: "Concessions",
            icon: "bi-percent",
            path: "/concessions",
            roles: ["accounts", "admin", "superadmin"],
          },
        ],
      });

      groups.push({
        heading: "Inventory",
        items: [
          {
            key: "inventory-dashboard-accounts",
            label: "Inventory Dashboard",
            icon: "bi-box-seam",
            path: "/inventory",
            roles: inventoryViewRoles,
          },
          {
            key: "inventory-categories-accounts",
            label: "Categories",
            icon: "bi-tags",
            path: "/inventory/categories",
            roles: inventoryViewRoles,
          },
          {
            key: "inventory-items-accounts",
            label: "Items",
            icon: "bi-box2",
            path: "/inventory/items",
            roles: inventoryViewRoles,
          },
          {
            key: "inventory-locations-accounts",
            label: "Locations",
            icon: "bi-geo-alt",
            path: "/inventory/locations",
            roles: inventoryViewRoles,
          },
          {
            key: "inventory-transactions-accounts",
            label: "Inventory Transactions",
            icon: "bi-journal-text",
            path: "/inventory/transactions",
            roles: inventoryViewRoles,
          },
          {
            key: "inventory-stock-report-accounts",
            label: "Stock Report",
            icon: "bi-bar-chart-line",
            path: "/inventory/stock-report",
            roles: inventoryViewRoles,
          },
        ],
      });

      groups.push({
        heading: "Reports",
        items: [
          {
            key: "studentDue",
            label: "Fee Due Report",
            icon: "bi-file-earmark-text",
            path: "/student-due",
            roles: ["accounts", "account"],
          },
          {
            key: "student-total-due",
            label: "Total Due Report",
            icon: "bi-cash-stack",
            path: "/reports/student-total-due",
            roles: ["accounts", "admin", "superadmin"],
          },
          {
            key: "dayWiseReport",
            label: "Day Wise Report",
            icon: "bi-calendar",
            path: "/reports/day-wise",
            roles: ["accounts", "account"],
          },
          {
            key: "dayWiseCategoryReports",
            label: "Category-wise Daily Report",
            icon: "bi-calendar-check",
            path: "/reports/day-wise-category",
            roles: ["accounts", "account"],
          },
          {
            key: "schoolFeeSummary",
            label: "Session Summary",
            icon: "bi-graph-up",
            path: "/reports/school-fee-summary",
            roles: ["accounts", "account"],
          },
          {
            key: "concessionReport",
            label: "Concession Report",
            icon: "bi-journal-check",
            path: "/reports/concession",
            roles: ["accounts", "account"],
          },
          {
            key: "vanFeeDetailedReport",
            label: "Van Fee Report",
            icon: "bi-truck-front",
            path: "/reports/van-fee",
            roles: ["accounts", "account"],
          },
          {
            key: "transportSummary",
            label: "Transport Summary",
            icon: "bi-truck-front",
            path: "/reports/transport-summary",
            roles: ["accounts", "account"],
          },
        ],
      });

      groups.push({
        heading: "Transport",
        items: [
          {
            key: "transportations",
            label: "Transport Routes",
            icon: "bi-signpost-split",
            path: "/transportations",
            roles: ["accounts", "admin", "superadmin", "transport", "account"],
          },
          {
            key: "buses",
            label: "Buses",
            icon: "bi-bus-front",
            path: "/buses",
            roles: ["accounts", "admin", "superadmin", "transport", "account"],
          },
          {
            key: "actual-routes",
            label: "Actual Routes",
            icon: "bi-map",
            path: "/actual-routes",
            roles: ["accounts", "admin", "superadmin", "transport", "account"],
          },
          {
            key: "student-transport-assignments",
            label: "Bus Assignments",
            icon: "bi-person-check",
            path: "/student-transport-assignments",
            roles: ["accounts", "admin", "superadmin", "transport", "account"],
          },
        ],
      });
    }

    // ====== ADMIN / SUPERADMIN ======
    if (isAdmin) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "command-center-admin", label: "School Command Center", icon: "bi-command", path: "/command-center" },
          { key: "school-ai-admin", label: "Ask School AI", icon: "bi-stars", path: "/school-ai", roles: ["admin", "superadmin"] },
          { key: "action-inbox-admin", label: "My Actions & Approvals", icon: "bi-inboxes-fill", path: "/action-inbox", roles: ["admin", "superadmin"] },
          { key: "parent-consents-admin", label: "Parent Consent & Acknowledgement", icon: "bi-pen", path: "/parent-consents", roles: ["admin", "superadmin"] },
          { key: "combined-circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });

      groups.push({
        heading: "Management",
        items: [
          { key: "users", label: "Users", icon: "bi-person", path: "/users", roles: ["superadmin"] },
          { key: "users-tracking", label: "User Tracking", icon: "bi-activity", path: "/users-tracking", roles: ["admin", "superadmin"] },
          { key: "document-vault-admin", label: "Document Vault", icon: "bi-shield-lock", path: "/document-vault", roles: ["admin", "superadmin"] },
          { key: "student-health-admin", label: "Student Health & Growth", icon: "bi-heart-pulse", path: "/student-health", roles: ["admin", "superadmin"] },
          { key: "anecdotal-records-admin", label: "Anecdotal Records", icon: "bi-journal-check", path: "/anecdotal-records", roles: ["admin", "superadmin"] },
          { key: "daily-readiness-admin", label: "Daily Readiness & Hygiene", icon: "bi-clipboard2-check", path: "/daily-readiness", roles: ["admin", "superadmin"] },
          { key: "lost-found-admin", label: "Lost & Found", icon: "bi-search", path: "/lost-found", roles: ["admin", "superadmin"] },
          { key: "teacher-performance-admin", label: "Teacher Performance Intelligence", icon: "bi-graph-up-arrow", path: "/teacher-performance", roles: ["admin", "superadmin"] },
          { key: "expense-management", label: "Expense Management", icon: "bi-wallet2", path: "/expense-management", roles: ["admin", "superadmin"] },
          { key: "examination-expenses-admin", label: "Examination Expenses", icon: "bi-journal-text", path: "/examination-expenses", roles: ["admin", "superadmin"] },
          { key: "classes", label: "Classes", icon: "bi-list-task", path: "/classes" },
          { key: "sections", label: "Sections", icon: "bi-grid", path: "/sections" },
          { key: "sessions", label: "Sessions", icon: "bi-calendar4-week", path: "/sessions" },
          { key: "students", label: "Students", icon: "bi-people", path: "/students" },
          { key: "student-leadership-admin", label: "Student Leadership & Council", icon: "bi-award", path: "/student-leadership", roles: ["admin", "superadmin"] }, // STUDENT_LEADERSHIP_V13
          { key: "staff-leadership-admin", label: "Staff Leadership & Activities", icon: "bi-people-fill", path: "/staff-leadership", roles: ["admin", "superadmin"] }, // STAFF_LEADERSHIP_V14
          { key: "house-duty-admin", label: "House Duty, Assembly & Co-Curricular", icon: "bi-flag-fill", path: "/house-duty", roles: ["admin", "superadmin"] }, // HOUSE_DUTY_V15
          { key: "monthly-attendance-register", label: "Monthly Attendance", icon: "bi-calendar2-check", path: "/monthly-attendance-register" },
          { key: "department-management", label: "Department Management", icon: "bi-building-gear", path: "/department-management", roles: ["admin", "superadmin"] },
          { key: "ptm-management-admin", label: "PTM Management", icon: "bi-people-fill", path: "/ptm-management", roles: ["admin", "superadmin"] },
          { key: "online-classes-admin", label: "Online Classes", icon: "bi-camera-video", path: "/online-classes" },
          { key: "assessments-admin", label: "Assessments & Tests", icon: "bi-clipboard2-check", path: "/assessments" },
          { key: "lms-assignments-admin", label: "LMS Assignments", icon: "bi-journal-check", path: "/assessments?assessment_type=assignment" },
          { key: "bulk-promotion", label: "Bulk Promotion", icon: "bi-arrow-up-square", path: "/students/bulk-promotion", roles: ["admin", "superadmin", "accounts"] },
          { key: "promotion-history", label: "Promotion History", icon: "bi-clock-history", path: "/students/promotion-history", roles: ["admin", "superadmin", "accounts"] },
        ],
      });

      groups.push({
        heading: "Fee Collection",
        items: [
          { key: "transactions", label: "Collect Fee", icon: "bi-receipt", path: "/transactions" },
          { key: "cancelledTransactions", label: "Cancelled Transactions", icon: "bi-trash3", path: "/cancelled-transactions" },
          { key: "studentDue", label: "Fee Due Report", icon: "bi-file-earmark-text", path: "/student-due" },
          { key: "opening-balances", label: "Opening Balances", icon: "bi-clipboard-data", path: "/opening-balances", roles: ["admin", "superadmin"] },
          { key: "student-total-due", label: "Total Due Report", icon: "bi-cash-stack", path: "/reports/student-total-due", roles: ["accounts", "admin", "superadmin"] },
        ],
      });

      groups.push({
        heading: "Fee Setup",
        items: [
          { key: "feeStructure", label: "Class Fee Structure", icon: "bi-cash-coin", path: "/fee-structure" },
          { key: "studentFeeStructure", label: "Student Fee Structure", icon: "bi-person-vcard", path: "/student-fee-structure", roles: ["accounts", "admin", "superadmin"] },
          { key: "feeHeadings", label: "Fee Headings", icon: "bi-bookmark", path: "/fee-headings" },
          { key: "mode-of-transactions", label: "Mode of Transactions", icon: "bi-credit-card-2-front", path: "/mode-of-transactions", roles: ["accounts", "admin", "superadmin"] },
          { key: "school-bank-accounts", label: "School Bank Accounts", icon: "bi-bank", path: "/school-bank-accounts", roles: ["accounts", "account", "admin", "superadmin"] },
          { key: "payment-gateway-settings-admin", label: "Payment Gateway", icon: "bi-credit-card-2-front", path: "/payment-gateway-settings", roles: ["accounts", "account", "admin", "superadmin"] },
          { key: "whatsapp-api-settings-admin", label: "WhatsApp API", icon: "bi-whatsapp", path: "/whatsapp-api-settings", roles: ["accounts", "account", "admin", "superadmin"] },
          { key: "ai-settings-admin", label: "AI Settings", icon: "bi-cpu", path: "/ai-settings", roles: ["admin", "superadmin"] },
          { key: "feeCategory", label: "Fee Category", icon: "bi-tags", path: "/fee-category" },
          { key: "concessions", label: "Concessions", icon: "bi-percent", path: "/concessions" },
        ],
      });

      groups.push({
        heading: "Inventory",
        items: [
          { key: "inventory-dashboard-admin", label: "Inventory Dashboard", icon: "bi-box-seam", path: "/inventory", roles: inventoryViewRoles },
          { key: "inventory-categories-admin", label: "Categories", icon: "bi-tags", path: "/inventory/categories", roles: inventoryViewRoles },
          { key: "inventory-items-admin", label: "Items", icon: "bi-box2", path: "/inventory/items", roles: inventoryViewRoles },
          { key: "inventory-locations-admin", label: "Locations", icon: "bi-geo-alt", path: "/inventory/locations", roles: inventoryViewRoles },
          { key: "inventory-opening-stock-admin", label: "Opening Stock", icon: "bi-archive", path: "/inventory/opening-stock", roles: inventoryManageRoles },
          { key: "inventory-receive-stock-admin", label: "Receive Stock", icon: "bi-box-arrow-in-down", path: "/inventory/receive-stock", roles: inventoryManageRoles },
          { key: "inventory-issue-stock-admin", label: "Issue Stock", icon: "bi-box-arrow-up", path: "/inventory/issue-stock", roles: inventoryManageRoles },
          { key: "inventory-transfer-stock-admin", label: "Transfer Stock", icon: "bi-arrow-left-right", path: "/inventory/transfer-stock", roles: inventoryManageRoles },
          { key: "inventory-adjust-stock-admin", label: "Adjust Stock", icon: "bi-sliders", path: "/inventory/adjust-stock", roles: inventoryManageRoles },
          { key: "inventory-transactions-admin", label: "Inventory Transactions", icon: "bi-journal-text", path: "/inventory/transactions", roles: inventoryViewRoles },
          { key: "inventory-stock-report-admin", label: "Stock Report", icon: "bi-bar-chart-line", path: "/inventory/stock-report", roles: inventoryViewRoles },
        ],
      });

      groups.push({
        heading: "Admissions",
        items: [
          {
            key: "admission-types",
            label: "Admission Types",
            icon: "bi-ui-checks-grid",
            path: "/admission-types",
            roles: ["admin", "superadmin"],
          },
          {
            key: "enquiries",
            label: "Enquiries",
            icon: "bi-person-lines-fill",
            path: "/enquiries",
            roles: ["admin", "superadmin"],
          },
        ],
      });

      groups.push({
        heading: "Certificates",
        items: [
          { key: "transfer-certificates", label: "Transfer Certificates", icon: "bi-award", path: "/transfer-certificates", roles: ["admin", "superadmin"] },
          { key: "bonafide-certificates", label: "Bonafide Certificates", icon: "bi-patch-check", path: "/bonafide-certificates", roles: ["admin", "superadmin"] },
          { key: "fee-certificates", label: "Fee Certificates", icon: "bi-file-earmark-check", path: "/fee-certificates", roles: ["admin", "superadmin"] },
        ],
      });

      groups.push({
        heading: "Transport",
        items: [
                    { key: "live-bus-tracking-admin", label: "Live Bus Tracking", icon: "bi-geo-alt-fill", path: "/live-bus-tracking", roles: ["admin", "superadmin"] },
{ key: "transportations", label: "Transport Routes", icon: "bi-truck", path: "/transportations" },
          { key: "buses", label: "Buses", icon: "bi-bus-front", path: "/buses" },
          { key: "actual-routes", label: "Actual Routes", icon: "bi-map", path: "/actual-routes" },
          { key: "student-transport-assignments", label: "Transport Assignments", icon: "bi-person-check", path: "/student-transport-assignments" },
          { key: "employee-transport-assignments", label: "Employee Bus Assignments", icon: "bi-person-badge", path: "/employee-transport-assignments" },
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
        heading: "Reports",
        items: [
          { key: "dayWiseReport", label: "Day Wise Fee Report", icon: "bi-calendar", path: "/reports/day-wise" },
          { key: "dayWiseCategoryReports", label: "Category-wise Daily Report", icon: "bi-calendar-check", path: "/reports/day-wise-category" },
          { key: "schoolFeeSummary", label: "Fee Summary", icon: "bi-graph-up", path: "/reports/school-fee-summary" },
          { key: "transportSummary", label: "Transport Summary", icon: "bi-truck-front", path: "/reports/transport-summary" },
          { key: "concessionReport", label: "Concession Report", icon: "bi-journal-check", path: "/reports/concession" },
          { key: "vanFeeDetailedReport", label: "Van Fee Report", icon: "bi-truck-front", path: "/reports/van-fee" },
          { key: "caste-gender-report", label: "Caste / Gender Report", icon: "bi-people-fill", path: "/reports/caste-gender" },
        ],
      });

      groups.push({
        heading: "Leave",
        items: [
          { key: "employee-leave-request", label: "Leave Request", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" },
        ],
      });

      groups.push({
        heading: "Disciplinary",
        items: [
          {
            key: "disciplinary-actions",
            label: "Disciplinary Actions",
            icon: "bi-exclamation-octagon",
            path: "/disciplinary-actions",
            roles: ["admin", "superadmin", "academic_coordinator"],
          },
        ],
      });
    }

    // ====== ACADEMIC COORDINATOR ======
    if (isAcademic) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "command-center-academic", label: "School Command Center", icon: "bi-command", path: "/command-center" },
          { key: "school-ai-academic", label: "Ask School AI", icon: "bi-stars", path: "/school-ai", roles: ["academic_coordinator", "coordinator"] },
          { key: "action-inbox-academic", label: "My Actions & Approvals", icon: "bi-inboxes-fill", path: "/action-inbox", roles: ["academic_coordinator", "coordinator"] },
          { key: "parent-consents-academic", label: "Parent Consent & Acknowledgement", icon: "bi-pen", path: "/parent-consents", roles: ["academic_coordinator", "coordinator"] },
          { key: "circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });

      groups.push({
        heading: "Academic",
        items: [
          { key: "subjects", label: "Subjects", icon: "bi-book", path: "/subjects" },
          { key: "students", label: "Students", icon: "bi-people", path: "/students" },
          { key: "monthly-attendance-register", label: "Monthly Attendance", icon: "bi-calendar2-check", path: "/monthly-attendance-register" },
          { key: "teacherAssignment", label: "Teacher Assignment", icon: "bi-person-check", path: "/teacher-assignment" },
          { key: "inchargeAssignment", label: "Incharge Assignment", icon: "bi-person-badge", path: "/incharge-assignment" },
          { key: "student-leadership-academic", label: "Student Leadership & Council", icon: "bi-award", path: "/student-leadership", roles: ["academic_coordinator", "coordinator"] }, // STUDENT_LEADERSHIP_V13
          { key: "staff-leadership-academic", label: "Staff Leadership & Activities", icon: "bi-people-fill", path: "/staff-leadership", roles: ["academic_coordinator", "coordinator"] }, // STAFF_LEADERSHIP_V14
          { key: "house-duty-academic", label: "House Duty, Assembly & Co-Curricular", icon: "bi-flag-fill", path: "/house-duty", roles: ["academic_coordinator", "coordinator"] }, // HOUSE_DUTY_V15
          { key: "department-management", label: "Department Management", icon: "bi-building-gear", path: "/department-management", roles: ["academic_coordinator"] },
          { key: "document-vault-coordinator", label: "Document Vault", icon: "bi-shield-check", path: "/document-vault", roles: ["academic_coordinator"] },
          { key: "anecdotal-records-coordinator", label: "Anecdotal Records", icon: "bi-journal-check", path: "/anecdotal-records", roles: ["academic_coordinator"] },
          { key: "daily-readiness-coordinator", label: "Daily Readiness & Hygiene", icon: "bi-clipboard2-check", path: "/daily-readiness", roles: ["academic_coordinator"] },
          { key: "lost-found-coordinator", label: "Lost & Found", icon: "bi-search", path: "/lost-found", roles: ["academic_coordinator", "coordinator"] },
          { key: "teacher-performance-coordinator", label: "Teacher Performance Intelligence", icon: "bi-graph-up-arrow", path: "/teacher-performance", roles: ["academic_coordinator", "coordinator"] },
          { key: "ptm-management-coordinator", label: "PTM Management", icon: "bi-people-fill", path: "/ptm-management" },
          { key: "online-classes-coordinator", label: "Online Classes", icon: "bi-camera-video", path: "/online-classes" },
          { key: "assessments-coordinator", label: "Assessments & Tests", icon: "bi-clipboard2-check", path: "/assessments" },
          { key: "lms-assignments-coordinator", label: "LMS Assignments", icon: "bi-journal-check", path: "/assessments?assessment_type=assignment" },
          { key: "holidayMarking", label: "Holiday Marking", icon: "bi-calendar3", path: "/holiday-marking" },
          { key: "periods", label: "Periods", icon: "bi-clock", path: "/periods" },
          { key: "combined-timetable", label: "Timetable", icon: "bi-table", path: "/combined-timetable" },
          { key: "substitution", label: "Substitutions", icon: "bi-arrow-repeat", path: "/substitution" },
          { key: "substitutionListing", label: "Substitution Listing", icon: "bi-list-ul", path: "/substitution-listing" },
          { key: "studentUserAccounts", label: "Create Student Login", icon: "bi-person-plus", path: "/student-user-accounts" },
          { key: "sessions", label: "Sessions", icon: "bi-calendar4-week", path: "/sessions" },
          { key: "caste-gender-report", label: "Caste / Gender Report", icon: "bi-people-fill", path: "/reports/caste-gender" },
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
        items: [
          { key: "employee-leave-request", label: "Leave Request", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" },
        ],
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

    // ====== HR ======
    if (isHR) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "command-center-hr", label: "School Command Center", icon: "bi-command", path: "/command-center" },
          { key: "school-ai-hr", label: "Ask School AI", icon: "bi-stars", path: "/school-ai", roles: ["hr"] },
          { key: "action-inbox-hr", label: "My Actions & Approvals", icon: "bi-inboxes-fill", path: "/action-inbox", roles: ["hr"] },
          { key: "parent-consents-hr", label: "Parent Consent & Acknowledgement", icon: "bi-pen", path: "/parent-consents", roles: ["hr"] },
          { key: "combined-circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });

      groups.push({
        heading: "HR Management",
        items: [
          { key: "departments", label: "Departments", icon: "bi-diagram-3", path: "/departments" },
          { key: "department-management", label: "Department Management", icon: "bi-building-gear", path: "/department-management", roles: ["hr"] },
          { key: "document-vault-hr", label: "Staff Document Vault", icon: "bi-shield-check", path: "/document-vault", roles: ["hr"] },
          { key: "teacher-performance-hr", label: "Teacher Performance Intelligence", icon: "bi-graph-up-arrow", path: "/teacher-performance", roles: ["hr"] },
          { key: "staff-leadership-hr", label: "Staff Leadership & Activities", icon: "bi-people-fill", path: "/staff-leadership", roles: ["hr"] }, // STAFF_LEADERSHIP_V14
          { key: "house-duty-hr", label: "House Duty & Activities", icon: "bi-flag-fill", path: "/house-duty", roles: ["hr"] }, // HOUSE_DUTY_V15
          { key: "academic-calendar-hr", label: "Academic Calendar / Teaching Days", icon: "bi-calendar-week", path: "/academic-calendar", roles: ["hr"] },
          { key: "employees", label: "Employees", icon: "bi-person-badge", path: "/employees" },
          { key: "employee-user-accounts", label: "Employee Login Accounts", icon: "bi-person-plus", path: "/employee-user-accounts" },
          { key: "leave-types", label: "Leave Types", icon: "bi-journals", path: "/leave-types" },
          { key: "employee-leave-balances", label: "Employee Leave Balances", icon: "bi-calendar-check", path: "/employee-leave-balances" },
          { key: "employee-leave-request", label: "Leave Request", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" },
          { key: "hr-leave-requests", label: "Review Leave Requests", icon: "bi-clipboard-check", path: "/hr-leave-requests" },
          { key: "employee-attendance", label: "Employee Attendance", icon: "bi-person-check-fill", path: "/employee-attendance" },
          { key: "my-attendance-calendar", label: "My Attendance", icon: "bi-calendar2-week", path: "/my-attendance-calendar" },
          { key: "employee-attendance-summary", label: "Employee Attendance Summary", icon: "bi-calendar-range", path: "/employee-attendance-summary" },
          { key: "payroll", label: "Payroll", icon: "bi-cash-coin", path: "/payroll" },
          { key: "my-payslips", label: "My Payslips", icon: "bi-receipt-cutoff", path: "/my-payslips" },
        ],
      });
    }

    // ====== TEACHER ======
    if (isTeacher) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "action-inbox-teacher", label: "My Actions", icon: "bi-inboxes-fill", path: "/action-inbox", roles: ["teacher", "department_hod"] },
          { key: "view-circulars", label: "Circulars", icon: "bi-megaphone", path: "/view-circulars" },
        ],
      });

      groups.push({
        heading: "Daily Work",
        items: [
          { key: "mark-attendance", label: "Mark Attendance", icon: "bi-check2-square", path: "/mark-attendance" },
          { key: "attendance-calendar", label: "Attendance Calendar", icon: "bi-calendar2-check", path: "/attendance-calendar" },
          { key: "ptm-management-teacher", label: "PTM Feedback", icon: "bi-clipboard2-check", path: "/ptm-management" },
          { key: "assignments", label: "Legacy Assignments", icon: "bi-clipboard", path: "/assignments" },
          { key: "assignment-marking", label: "Assignment Marking", icon: "bi-pencil-square", path: "/assignment-marking" },
          { key: "teacher-timetable-display", label: "Timetable", icon: "bi-table", path: "/teacher-timetable-display" },
          { key: "combined-teacher-substitution", label: "My Substitutions", icon: "bi-arrow-repeat", path: "/combined-teacher-substitution" },
          { key: "lesson-plan", label: "Lesson Plan", icon: "bi-journal-text", path: "/lesson-plan" },
          { key: "department-management", label: "Department Management", icon: "bi-building-gear", path: "/department-management", roles: ["teacher", "department_hod"] },
          { key: "document-vault-teacher", label: "My Documents", icon: "bi-person-vcard", path: "/document-vault", roles: ["teacher", "department_hod"] },
          { key: "anecdotal-records-teacher", label: "Anecdotal Records", icon: "bi-journal-check", path: "/anecdotal-records", roles: ["teacher", "department_hod"] },
          { key: "daily-readiness-teacher", label: "Daily Readiness & Hygiene", icon: "bi-clipboard2-check", path: "/daily-readiness", roles: ["teacher", "department_hod"] },
          { key: "lost-found-teacher", label: "Lost & Found", icon: "bi-search", path: "/lost-found", roles: ["teacher", "department_hod"] },
          { key: "teacher-performance-teacher", label: "My Professional Growth", icon: "bi-speedometer2", path: "/teacher-performance", roles: ["teacher", "department_hod"] },
          { key: "my-staff-leadership-teacher", label: "My Leadership & Responsibilities", icon: "bi-person-workspace", path: "/staff-leadership", roles: ["teacher", "department_hod"] }, // STAFF_LEADERSHIP_V14
          { key: "my-house-duty-teacher", label: "My House Duties & Assembly", icon: "bi-flag", path: "/house-duty", roles: ["teacher", "department_hod"] }, // HOUSE_DUTY_V15
          { key: "online-classes", label: "Online Classes", icon: "bi-camera-video", path: "/online-classes" },
          { key: "assessments", label: "Assessments & Tests", icon: "bi-clipboard2-check", path: "/assessments" },
          { key: "lms-assignments", label: "LMS Assignments", icon: "bi-journal-check", path: "/assessments?assessment_type=assignment" },
          { key: "my-visitors", label: "My Visitors", icon: "bi-person-badge", path: "/my-visitors" },
        ],
      });

      groups.push({
        heading: "Academic",
        items: [
          { key: "classes", label: "Classes", icon: "bi-list-task", path: "/classes" },
          { key: "subjects", label: "Subjects", icon: "bi-book", path: "/subjects" },
        ],
      });

      groups.push({
        heading: "Examination",
        items: [
          { key: "roll-numbers", label: "Roll Numbers", icon: "bi-list-ol", path: "/roll-numbers" },
          { key: "marks-entry", label: "Marks Entry", icon: "bi-pencil-square", path: "/marks-entry" },
          { key: "classwise-result-summary", label: "Class Result", icon: "bi-bar-chart", path: "/reports/classwise-result-summary" },
          { key: "final-result-summary", label: "Final Result Summary", icon: "bi-bar-chart-line", path: "/reports/final-result-summary" },
          { key: "coscholastic-entry", label: "Co-Scholastic Entry", icon: "bi-stars", path: "/co-scholastic-entry" },
          { key: "student-remarks-entry", label: "Student Remarks Entry", icon: "bi-chat-square-text", path: "/student-remarks-entry" },
          { key: "report-card-generator", label: "Print Report Cards", icon: "bi-printer", path: "/report-card-generator" },
        ],
      });

      groups.push({
        heading: "Leave Management",
        items: [
          { key: "employee-leave-request", label: "Request Leave", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" },
          { key: "leave-requests", label: "Leave Requests", icon: "bi-envelope", path: "/leave-requests" },
          { key: "my-attendance-calendar", label: "My Attendance", icon: "bi-calendar2-week", path: "/my-attendance-calendar" },
          { key: "my-payslips", label: "My Payslips", icon: "bi-receipt-cutoff", path: "/my-payslips" },
        ],
      });
    }

    // ====== HEALTH STAFF / DOCTOR / NURSE ======
    if (isHealthStaff) {
      groups.push({
        heading: "Health & Wellness",
        items: [
          { key: "student-health", label: "Student Health & Growth", icon: "bi-heart-pulse", path: "/student-health", roles: ["health_staff", "doctor", "nurse", "medical_officer"] },
        ],
      });
    }

    // ====== STUDENT ======
    if (isStudent) {
      groups.push({
        heading: "Student",
        items: [
          { key: "student-home", label: "Home", icon: "bi-house", path: "/dashboard", roles: ["student"] },
          { key: "student-attendance", label: "Attendance", icon: "bi-calendar2-check", path: "/student-attendance", roles: ["student"] },
          { key: "lms-my-assignments", label: "Assignments & Submissions", icon: "bi-journal-check", path: "/assessments?assessment_type=assignment", roles: ["student"] },
          { key: "my-assignments", label: "Legacy Assignments", icon: "bi-archive", path: "/my-assignments", roles: ["student"] },
          { key: "student-diary", label: "Diary", icon: "bi-journal-text", path: "/student-diary", roles: ["student"] },
          { key: "student-circulars", label: "Circulars", icon: "bi-megaphone", path: "/student-circulars", roles: ["student"] },
          { key: "student-activities-achievements", label: "Activities & Achievements", icon: "bi-trophy", path: "/student/activities-achievements", roles: ["student"] },
          { key: "document-vault-student", label: "My Documents", icon: "bi-person-vcard", path: "/document-vault", roles: ["student"] },
          { key: "anecdotal-records-student", label: "My Growth & Recognition", icon: "bi-stars", path: "/anecdotal-records", roles: ["student"] },
          { key: "daily-readiness-student", label: "My Daily Readiness", icon: "bi-check2-circle", path: "/daily-readiness", roles: ["student"] },
          { key: "lost-found-student", label: "Lost & Found", icon: "bi-search", path: "/lost-found", roles: ["student"] },
          { key: "student-timetable-display", label: "Timetable", icon: "bi-clock-history", path: "/student-timetable-display", roles: ["student"] },
          { key: "student-online-classes", label: "Online Classes", icon: "bi-camera-video", path: "/online-classes", roles: ["student"] },
          { key: "student-assessments", label: "Tests & Results", icon: "bi-clipboard2-check", path: "/assessments", roles: ["student"] },
          { key: "student-fee", label: "Fees", icon: "bi-cash-coin", path: "/student-fee", roles: ["student"] },
          { key: "my-library", label: "My Library", icon: "bi-journal-bookmark", path: "/my-library", roles: MY_LIBRARY_ROLES },
          { key: "chat", label: "Chat", icon: "bi-chat-dots", path: "/chat", roles: ["student"] },
        ],
      });
    }

    if (!isStudent) {
      groups.push({
        heading: "Quick",
        items: [
          {
            key: "my-library",
            label: "My Library",
            icon: "bi-journal-bookmark",
            path: "/my-library",
            roles: MY_LIBRARY_ROLES,
          },
        ],
      });
    }

    // EDUBRIDGE_SUPPORT_SIDEBAR_V1 — visible to every authenticated role.
    groups.push({
      heading: "Support",
      items: [
        { key: "edubridge-support", label: "Help & Support", icon: "bi-life-preserver", path: "/support" },
      ],
    });

    for (const g of groups) {
      g.items = g.items.filter(hasAccess);
    }

    // SCHOOL_CHAT_V16_SIDEBAR — preserve existing Codex grouping and append chat to a suitable group.
    if (["student","teacher","principal","superadmin","super_admin","admin","academic_coordinator","coordinator","hr","accounts","accountant"].includes(roleLower)) {
      const chatItem = { key: "secure-school-chat", label: "Secure School Chat", icon: "bi-chat-dots-fill", path: "/school-chat" };
      const targetGroup = groups.find((g) => g.heading === "Daily Work") || groups.find((g) => g.heading === "Main");
      if (targetGroup) {
        if (!targetGroup.items.some((i) => i?.path === "/school-chat")) targetGroup.items.push(chatItem);
      } else {
        groups.push({ heading: "Daily Work", items: [chatItem] });
      }
    }

    return sortGroups(cleanGroups(groups));
  }, [
    isAdmin,
    isAcademic,
    isTeacher,
    isStudent,
    isHR,
    isHealthStaff,
    isSuperAdmin,
    isAccounts,
    isFrontoffice,
    isAdmission,
    isLibrarian,
    isTransport,
    isExamination,
    isPrincipal,
    isInventoryRole,
    roleLower,
  ]);

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

  // Route changes may also come from dashboard cards or quick-access links.
  // Keep the secondary panel closed unless a sidebar category is clicked explicitly.
  useEffect(() => {
    setActiveMenuGroup("");
  }, [location.pathname]);

  useEffect(() => {
    setSubmenuQuery("");
  }, [activeMenuGroup]);

  const selectedGroup =
    filteredGroups.find((group) => group.heading === activeMenuGroup) || null;

  const selectedSubmenuItems = useMemo(() => {
    if (!selectedGroup) return [];
    const search = submenuQuery.trim().toLowerCase();
    if (!search) return selectedGroup.items;
    return selectedGroup.items.filter((item) =>
      `${item.label || ""} ${item.path || ""}`.toLowerCase().includes(search)
    );
  }, [selectedGroup, submenuQuery]);

  const handleMenuClick = (item) => {
    navigate(item.path);
  };

  const asideStyle = {
    top: `${headerHeight}px`,
    height: `calc(100vh - ${headerHeight}px)`,
    "--header-h": `${headerHeight}px`,
  };

  const flattenMenu = (groups) =>
    groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.heading })));

  const allItems = useMemo(() => flattenMenu(menuGroups), [menuGroups]);

  const PRIMARY_BY_ROLE = {
    admin: ["dashboard", "transactions", "studentDue", "inventory-dashboard-admin", "opening-balances"],
    academic_coordinator: ["dashboard", "monthly-attendance-register", "combined-timetable", "students", "exam-schemes"],
    teacher: ["dashboard", "mark-attendance", "teacher-timetable-display", "my-library"],
    department_hod: ["department-management", "dashboard", "lesson-plan", "teacher-timetable-display"],
    student: ["student-home", "student-activities-achievements", "student-diary", "student-attendance", "my-library"],
    hr: ["dashboard", "employees", "employee-attendance", "payroll"],
    superadmin: ["dashboard", "users", "transactions", "inventory-dashboard-admin", "opening-balances"],
    accounts: ["accounts-dashboard", "transactions", "inventory-dashboard-accounts", "studentDue", "dayWiseReport"],
    account: ["accounts-dashboard", "transactions", "inventory-dashboard-accounts", "studentDue", "dayWiseReport"],
    frontoffice: ["frontoffice-dashboard", "gate-pass", "visitors", "enquiries", "students"],
    admission: ["admission-dashboard", "enquiries", "student-strength-projection", "students"],
    examination: ["exam-dashboard", "exams", "exam-schemes", "marks-entry", "report-card-generator"],
    transport: ["transport-dashboard-direct", "live-bus-tracking", "transportations", "buses", "actual-routes", "student-transport-assignments"],
    transporter: ["transport-dashboard-direct", "transportations", "buses", "actual-routes", "student-transport-assignments"],
    librarian: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    library: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    libraryadmin: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    principal: ["command-center", "principal-teacher-performance", "principal-exam-dashboard", "principal-live-bus", "principal-students"],
    inventoryadmin: ["inventory-dashboard-main", "inventory-items", "inventory-receive-stock", "inventory-transactions"],
    storeincharge: ["inventory-dashboard-main", "inventory-items", "inventory-receive-stock", "inventory-issue-stock"],
    labincharge: ["inventory-dashboard-main", "inventory-items", "inventory-transactions", "inventory-stock-report"],
  };

  const primaryKeys = PRIMARY_BY_ROLE[roleLower] || allItems.slice(0, 4).map((i) => i.key);
  const primaryItems = allItems.filter((i) => primaryKeys.includes(i.key)).slice(0, 5);
  const moreItems = allItems.filter((i) => !primaryKeys.includes(i.key));
  const dashboardItem =
    primaryKeys.map((key) => allItems.find((item) => item.key === key)).find(Boolean) ||
    allItems.find((item) => /dashboard|home|command-center/.test(item.key || "")) ||
    allItems[0];

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

        <div className="sidebar-search-wrap">
          <div className={`sidebar-search ${q ? "has-value" : ""}`}>
            <i className="bi bi-search sidebar-search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder="Find a menu"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActiveMenuGroup("");
              }}
              aria-label="Search sidebar menu"
            />
            {q && (
              <button
                type="button"
                className="sidebar-search-clear"
                onClick={() => setQ("")}
                aria-label="Clear menu search"
                title="Clear search"
              >
                <i className="bi bi-x" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <nav className="sidebar-category-nav mt-1" aria-label="Menu categories">
          {dashboardItem && (
            <button
              type="button"
              className={`sidebar-category sidebar-dashboard-link ${
                isPathActive(dashboardItem.path) ? "route-active selected" : ""
              }`}
              onClick={() => {
                setActiveMenuGroup("");
                handleMenuClick(dashboardItem);
              }}
              title={!isExpanded ? "Dashboard" : undefined}
            >
              <span
                className="sidebar-category-icon"
                style={{ backgroundImage: sidebarGradients[0] }}
              >
                <i className="bi bi-speedometer2" aria-hidden="true" />
              </span>
              <span className="sidebar-category-label">Dashboard</span>
              <span className="sidebar-category-direct">Direct</span>
              <i className="bi bi-arrow-up-right sidebar-category-arrow" aria-hidden="true" />
            </button>
          )}

          {filteredGroups.map((group, gi) => {
            const containsActiveRoute = group.items.some((item) => isPathActive(item.path));
            const selected = selectedGroup?.heading === group.heading;
            const groupIcon = group.items[0]?.icon || "bi-grid";

            return (
              <button
                key={group.heading}
                type="button"
                className={`sidebar-category ${selected ? "selected" : ""} ${
                  containsActiveRoute ? "route-active" : ""
                }`}
                onClick={() =>
                  setActiveMenuGroup((current) =>
                    current === group.heading ? "" : group.heading
                  )
                }
                aria-expanded={selected}
                aria-controls="sidebar-submenu-panel"
                title={!isExpanded ? group.heading : undefined}
              >
                <span
                  className="sidebar-category-icon"
                  style={{ backgroundImage: sidebarGradients[gi % sidebarGradients.length] }}
                >
                  <i className={`bi ${groupIcon}`} aria-hidden="true" />
                </span>
                <span className="sidebar-category-label">{group.heading}</span>
                <span className="sidebar-category-count">{group.items.length}</span>
                <i className="bi bi-chevron-right sidebar-category-arrow" aria-hidden="true" />
              </button>
            );
          })}

          {filteredGroups.length === 0 && (
            <div className="px-3 py-2 text-muted small">No menu items match “{q}”.</div>
          )}
        </nav>
      </aside>

      {selectedGroup && (
        <section
          id="sidebar-submenu-panel"
          className="sidebar-submenu-panel"
          style={asideStyle}
          aria-label={`${selectedGroup.heading} menu`}
        >
          <div className="sidebar-submenu-header">
            <div>
              <div className="sidebar-submenu-eyebrow">Navigation</div>
              <h2>{selectedGroup.heading}</h2>
              <p>
                {selectedSubmenuItems.length} of {selectedGroup.items.length} available options
              </p>
            </div>
            <button
              type="button"
              className="sidebar-submenu-close"
              onClick={() => setActiveMenuGroup("")}
              aria-label="Close submenu"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>

          <div className="sidebar-submenu-search-wrap">
            <div className={`sidebar-submenu-search ${submenuQuery ? "has-value" : ""}`}>
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={submenuQuery}
                onChange={(event) => setSubmenuQuery(event.target.value)}
                placeholder={`Search ${selectedGroup.heading}`}
                aria-label={`Search ${selectedGroup.heading} submenu`}
                autoFocus
              />
              {submenuQuery && (
                <button
                  type="button"
                  onClick={() => setSubmenuQuery("")}
                  aria-label="Clear submenu search"
                >
                  <i className="bi bi-x-lg" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div className="sidebar-submenu-list">
            {selectedSubmenuItems.map((item, ii) => {
              const active = isPathActive(item.path);
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar-submenu-item ${active ? "active" : ""}`}
                  onClick={() => handleMenuClick(item)}
                >
                  <span
                    className="sidebar-submenu-icon"
                    style={{ color: palette[ii % palette.length] }}
                  >
                    <i className={`bi ${item.icon}`} aria-hidden="true" />
                  </span>
                  <span className="sidebar-submenu-copy">
                    <span className="sidebar-submenu-label">{item.label}</span>
                    <span className="sidebar-submenu-path">{item.path}</span>
                  </span>
                  <i className="bi bi-arrow-right-short sidebar-submenu-arrow" aria-hidden="true" />
                </button>
              );
            })}
            {selectedSubmenuItems.length === 0 && (
              <div className="sidebar-submenu-empty">
                No options match “{submenuQuery}”.
              </div>
            )}
          </div>
        </section>
      )}

      <div
        className={`sidebar-scrim ${selectedGroup ? "submenu-open" : ""}`}
        onClick={() => setActiveMenuGroup("")}
        aria-hidden="true"
      />
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
      (i) =>
        i.label.toLowerCase().includes(s) ||
        i.group?.toLowerCase().includes(s) ||
        i.path?.toLowerCase().includes(s)
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
