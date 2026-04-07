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
  Certificates: 16,
  Reports: 17,
  "Fee Reports": 18,
  "School Info": 19,
  Leave: 20,
  "Leave Management": 21,
  Disciplinary: 22,
  Quick: 23,
  Utilities: 24,
  Student: 25,
};

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
  const isAcademic = roleLower === "academic_coordinator";
  const isTeacher = roleLower === "teacher";
  const isStudent = roleLower === "student";
  const isHR = roleLower === "hr";
  const isAccounts = roleLower === "accounts" || roleLower === "account";
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
    isInventoryAdmin || isStoreIncharge || isLabIncharge || isPrincipal;

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

  const [openGroups, setOpenGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(`sidebarOpenGroups:${roleLower || "default"}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        `sidebarOpenGroups:${roleLower || "default"}`,
        JSON.stringify(openGroups)
      );
    } catch {}
  }, [openGroups, roleLower]);

  const toggleGroup = (heading) => {
    setOpenGroups((prev) => ({
      ...prev,
      [heading]: !(prev[heading] ?? true),
    }));
  };

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
        ],
      });

      groups.push({
        heading: "Examination",
        items: [
          { key: "subjects", label: "Subjects", icon: "bi-book", path: "/subjects", roles: ["examination"] },
          { key: "exams", label: "Exams", icon: "bi-journal-bookmark", path: "/exams", roles: ["examination"] },
          { key: "exam-schemes", label: "Exam Schemes", icon: "bi-card-checklist", path: "/exam-schemes", roles: ["examination"] },
          { key: "exam-schedules", label: "Exam Schedule", icon: "bi-calendar2-check", path: "/exam-schedules", roles: ["examination"] },
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
          { key: "classwise-result-summary", label: "Result Summary", icon: "bi-bar-chart", path: "/reports/classwise-result-summary", roles: ["examination"] },
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
            key: "student-transport-assignments",
            label: "Assign Bus to Students",
            icon: "bi-person-check-fill",
            path: "/student-transport-assignments",
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
          { key: "combined-circulars", label: "Circulars", icon: "bi-megaphone", path: "/combined-circulars" },
        ],
      });

      groups.push({
        heading: "Management",
        items: [
          { key: "users", label: "Users", icon: "bi-person", path: "/users", roles: ["superadmin"] },
          { key: "users-tracking", label: "User Tracking", icon: "bi-activity", path: "/users-tracking", roles: ["admin", "superadmin"] },
          { key: "classes", label: "Classes", icon: "bi-list-task", path: "/classes" },
          { key: "sections", label: "Sections", icon: "bi-grid", path: "/sections" },
          { key: "sessions", label: "Sessions", icon: "bi-calendar4-week", path: "/sessions" },
          { key: "students", label: "Students", icon: "bi-people", path: "/students" },
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
          { key: "enquiries", label: "Enquiries", icon: "bi-person-lines-fill", path: "/enquiries", roles: ["admin", "superadmin"] },
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
          { key: "transportations", label: "Transport Routes", icon: "bi-truck", path: "/transportations" },
          { key: "buses", label: "Buses", icon: "bi-bus-front", path: "/buses" },
          { key: "student-transport-assignments", label: "Transport Assignments", icon: "bi-person-check", path: "/student-transport-assignments" },
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

    // ====== TEACHER ======
    if (isTeacher) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "view-circulars", label: "Circulars", icon: "bi-megaphone", path: "/view-circulars" },
        ],
      });

      groups.push({
        heading: "Daily Work",
        items: [
          { key: "mark-attendance", label: "Mark Attendance", icon: "bi-check2-square", path: "/mark-attendance" },
          { key: "attendance-calendar", label: "Attendance Calendar", icon: "bi-calendar2-check", path: "/attendance-calendar" },
          { key: "assignments", label: "Assignments", icon: "bi-clipboard", path: "/assignments" },
          { key: "assignment-marking", label: "Assignment Marking", icon: "bi-pencil-square", path: "/assignment-marking" },
          { key: "teacher-timetable-display", label: "Timetable", icon: "bi-table", path: "/teacher-timetable-display" },
          { key: "combined-teacher-substitution", label: "My Substitutions", icon: "bi-arrow-repeat", path: "/combined-teacher-substitution" },
          { key: "lesson-plan", label: "Lesson Plan", icon: "bi-journal-text", path: "/lesson-plan" },
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
          { key: "classwise-result-summary", label: "Result Summary", icon: "bi-bar-chart", path: "/reports/classwise-result-summary" },
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
          { key: "my-assignments", label: "Assignments", icon: "bi-journal-check", path: "/my-assignments", roles: ["student"] },
          { key: "student-diary", label: "Diary", icon: "bi-journal-text", path: "/student-diary", roles: ["student"] },
          { key: "student-circulars", label: "Circulars", icon: "bi-megaphone", path: "/student-circulars", roles: ["student"] },
          { key: "student-timetable-display", label: "Timetable", icon: "bi-clock-history", path: "/student-timetable-display", roles: ["student"] },
          { key: "student-fee", label: "Fees", icon: "bi-cash-coin", path: "/student-fee", roles: ["student"] },
          { key: "chat", label: "Chat", icon: "bi-chat-dots", path: "/chat", roles: ["student"] },
        ],
      });
    }

    for (const g of groups) {
      g.items = g.items.filter(hasAccess);
    }

    return sortGroups(cleanGroups(groups));
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
    academic_coordinator: ["dashboard", "combined-timetable", "students", "exam-schemes"],
    teacher: ["dashboard", "mark-attendance", "teacher-timetable-display", "marks-entry"],
    student: ["student-home", "student-diary", "student-attendance", "student-timetable-display"],
    hr: ["dashboard", "employees", "employee-attendance", "hr-leave-requests"],
    superadmin: ["dashboard", "users", "transactions", "inventory-dashboard-admin", "opening-balances"],
    accounts: ["accounts-dashboard", "transactions", "inventory-dashboard-accounts", "studentDue", "dayWiseReport"],
    account: ["accounts-dashboard", "transactions", "inventory-dashboard-accounts", "studentDue", "dayWiseReport"],
    frontoffice: ["frontoffice-dashboard", "gate-pass", "visitors", "enquiries", "students"],
    admission: ["admission-dashboard", "enquiries", "student-strength-projection", "students"],
    examination: ["exam-dashboard", "exams", "exam-schemes", "marks-entry", "report-card-generator"],
    transport: ["transport-dashboard-direct", "transportations", "buses", "student-transport-assignments"],
    transporter: ["transport-dashboard-direct", "transportations", "buses", "student-transport-assignments"],
    librarian: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    library: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    libraryadmin: ["library-dashboard", "library-books", "library-issue-return", "library-members"],
    principal: ["inventory-dashboard-main", "inventory-items", "inventory-transactions", "inventory-stock-report"],
    inventoryadmin: ["inventory-dashboard-main", "inventory-items", "inventory-receive-stock", "inventory-transactions"],
    storeincharge: ["inventory-dashboard-main", "inventory-items", "inventory-receive-stock", "inventory-issue-stock"],
    labincharge: ["inventory-dashboard-main", "inventory-items", "inventory-transactions", "inventory-stock-report"],
  };

  const primaryKeys = PRIMARY_BY_ROLE[roleLower] || allItems.slice(0, 4).map((i) => i.key);
  const primaryItems = allItems.filter((i) => primaryKeys.includes(i.key)).slice(0, 5);
  const moreItems = allItems.filter((i) => !primaryKeys.includes(i.key));

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
          {filteredGroups.map((group, gi) => {
            const isOpen = openGroups[group.heading] ?? true;

            return (
              <div key={gi} className="sidebar-group">
                {isExpanded ? (
                  <button
                    type="button"
                    className="group-toggle w-100 d-flex align-items-center justify-content-between px-3 mt-3 mb-1"
                    onClick={() => toggleGroup(group.heading)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "inherit",
                    }}
                  >
                    <span className="group-heading text-uppercase mb-0">{group.heading}</span>
                    <i className={`bi ${isOpen ? "bi-chevron-down" : "bi-chevron-right"}`} />
                  </button>
                ) : (
                  <div className="group-divider my-2" />
                )}

                {(!isExpanded || isOpen) && (
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
                )}
              </div>
            );
          })}

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