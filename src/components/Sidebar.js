import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useLocation, useNavigate } from "react-router-dom";
import { useRoles } from "../hooks/useRoles";
import "./Sidebar.css";

export default function Sidebar({ headerHeight = 56 }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeRole } = useRoles();

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

  const toggleSidebar = () => setIsExpanded((prev) => !prev);

  // roles
  const roleLower = (activeRole || "").toLowerCase();
  const isSuperAdmin = roleLower === "superadmin" || roleLower === "super_admin";
  const isAdmin = isSuperAdmin || roleLower === "admin";
  const isAcademic = roleLower === "academic_coordinator";
  const isTeacher = roleLower === "teacher";
  const isStudent = roleLower === "student";
  const isHR = roleLower === "hr";

  const hasAccess = (item) => {
    if (!item?.roles || item.roles.length === 0) return true;
    if (isSuperAdmin) return true;
    return item.roles.map((r) => (r || "").toLowerCase()).includes(roleLower);
  };

  // ===== MENU GROUPS =====
  const menuGroups = useMemo(() => {
    const groups = [];

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
          { key: "concessionReport", label: "Concession Report", icon: "bi-journal-check", path: "/reports/concession" },
          { key: "vanFeeDetailedReport", label: "Van Fee Report", icon: "bi-truck-front", path: "/reports/van-fee" },
          { key: "feeStructure", label: "Fee Structure", icon: "bi-cash-coin", path: "/fee-structure" },
          { key: "transportation", label: "Transportation Cost", icon: "bi-truck", path: "/transportation" },
          { key: "feeHeadings", label: "Fee Headings", icon: "bi-bookmark", path: "/fee-headings" },
          { key: "feeCategory", label: "Fee Category", icon: "bi-tags", path: "/fee-category" },
          { key: "concessions", label: "Concessions", icon: "bi-percent", path: "/concessions" },
        ],
      });
      groups.push({
        heading: "Admissions",
        items: [
          { key: "students", label: "Admissions", icon: "bi-people", path: "/students" },
          { key: "classes", label: "Classes", icon: "bi-list-task", path: "/classes" },
          { key: "sections", label: "Sections", icon: "bi-grid", path: "/sections" },
        ],
      });
      groups.push({
        heading: "School Info",
        items: [{ key: "schools", label: "Schools", icon: "bi-building", path: "/schools" }],
      });
      groups.push({
        heading: "Leave",
        items: [{ key: "employee-leave-request", label: "Leave Request", icon: "bi-box-arrow-in-down-left", path: "/employee-leave-request" }],
      });
    }

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
          {
            key: "class-co-scholastic-mapping",
            label: "Class Co-Scholastic Mapping",
            icon: "bi-easel3",
            path: "/class-co-scholastic-mapping",
            roles: ["academic_coordinator", "superadmin"],
          },
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
    }

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
          { key: "students", label: "Students", icon: "bi-people", path: "/students" },
        ],
      });
      groups.push({
        heading: "Exam",
        items: [
          { key: "roll-numbers", label: "Roll Numbers", icon: "bi-list-ol", path: "/roll-numbers" },
          { key: "marks-entry", label: "Marks Entry", icon: "bi-pencil-square", path: "/marks-entry" },
          { key: "classwise-result-summary", label: "Result Summary", icon: "bi-bar-chart", path: "/reports/classwise-result-summary" },
          { key: "final-result-summary", label: "Final Result Summary", icon: "bi-bar-chart-line", path: "/reports/final-result-summary" },
          { key: "coscholastic-entry", label: "Co-Scholastic Entry", icon: "bi-stars", path: "/co-scholastic-areas" },
          { key: "student-remarks-entry", label: "Student Remarks Entry", icon: "bi-chat-square-text", path: "/student-remarks-entry" },
          { key: "report-card-generator", label: "Print Report Cards", icon: "bi-printer", path: "/report-card-generator" },
        ],
      });
    }

    if (isStudent) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          { key: "student-circulars", label: "Circulars", icon: "bi-megaphone", path: "/student-circulars" },
          { key: "student-fee", label: "Fees", icon: "bi-cash-coin", path: "/student-fee" },
          { key: "student-attendance", label: "Attendance", icon: "bi-calendar2-check", path: "/student-attendance" },
          { key: "my-assignments", label: "My Assignments", icon: "bi-clipboard", path: "/my-assignments" },
          { key: "student-timetable-display", label: "Time Table", icon: "bi-table", path: "/student-timetable-display" },
        ],
      });
    }

    if (isSuperAdmin) {
      groups.splice(1, 0, {
        heading: "User Management",
        items: [{ key: "users", label: "Users", icon: "bi-person", path: "/users" }],
      });
    }

    for (const g of groups) g.items = g.items.filter(hasAccess);
    return groups;
  }, [isAdmin, isAcademic, isTeacher, isStudent, isHR, isSuperAdmin, roleLower]);

  const isPathActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const handleMenuClick = (item) => {
    navigate(item.path);
  };

  const asideStyle = {
    top: `${headerHeight}px`,
    height: `calc(100vh - ${headerHeight}px)`,
    // @ts-ignore
    "--header-h": `${headerHeight}px`,
  };

  return (
    <>
      <aside className="app-sidebar" style={asideStyle} aria-label="Sidebar navigation">
        {/* Top row: ONLY the toggle (brand/logo removed) */}
        <div className="sidebar-top d-flex align-items-center">
          <button
            className="btn toggle-btn ms-auto"
            onClick={toggleSidebar}
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <i className="bi bi-chevron-left" /> : <i className="bi bi-list" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="mt-2">
          {menuGroups.map((group, gi) => (
            <div key={gi}>
              {isExpanded && (
                <h6 className="group-heading text-uppercase px-3 mt-3 mb-1">{group.heading}</h6>
              )}
              <ul className="nav flex-column">
                {group.items.map((item) => {
                  const active = isPathActive(item.path);
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
                    >
                      <span className="active-indicator" />
                      <div className={`item-content ${isExpanded ? "expanded" : "collapsed"}`}>
                        <i className={`bi ${item.icon} item-icon`} aria-hidden="true" />
                        <span className="item-label">{item.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Scrim only shows on phones via CSS */}
      <div
        className={`sidebar-scrim ${isExpanded ? "show" : ""}`}
        onClick={() => setIsExpanded(false)}
        aria-hidden="true"
      />
    </>
  );
}
