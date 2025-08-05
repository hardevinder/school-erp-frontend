import React, { useMemo } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { useRoles } from "../hooks/useRoles";

export default function Sidebar({
  activeSection,
  setActiveSection,
  isExpanded = true,
  setIsExpanded = () => {},
}) {
  const { activeRole } = useRoles();
  const navigate = useNavigate();
  const toggleSidebar = () => setIsExpanded(prev => !prev);
    const roleLower = (activeRole || "").toLowerCase();

    const isSuperAdmin =
      roleLower === "superadmin" || roleLower === "super_admin";
    const isAdmin =
      isSuperAdmin || roleLower === "admin";
    const isAcademic =
      roleLower === "academic_coordinator";
    const isTeacher =
      roleLower === "teacher";
    const isStudent =
      roleLower === "student";
    const isHR =
      roleLower === "hr";


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
          {
            key: "cancelledTransactions",
            label: "Cancelled Transactions",
            icon: "bi-trash3",
            path: "/cancelled-transactions",
          },
          { key: "dayWiseReport", label: "Fee Report", icon: "bi-calendar", path: "/reports/day-wise" },
          {
            key: "dayWiseCategoryReports",
            label: "Fee Report (New)",
            icon: "bi-calendar-check",
            path: "/reports/day-wise-category",
          },
          {
            key: "studentDue",
            label: "Fee Due Report",
            icon: "bi-file-earmark-text",
            path: "/student-due",
          },
          {
            key: "schoolFeeSummary",
            label: "Fee Summary(New)",
            icon: "bi-graph-up",
            path: "/reports/school-fee-summary",
          },
          {
            key: "concessionReport",
            label: "Concession Report",
            icon: "bi-journal-check",
            path: "/reports/concession",
          },
          {
            key: "vanFeeDetailedReport",
            label: "Van Fee Report",
            icon: "bi-truck-front",
            path: "/reports/van-fee",
          },
          { key: "feeStructure", label: "Fee Structure", icon: "bi-cash-coin", path: "/fee-structure" },
          {
            key: "transportation",
            label: "Transportation Cost",
            icon: "bi-truck",
            path: "/transportation",
          },
          
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
        items: [
          {
            key: "employee-leave-request",
            label: "Leave Request",
            icon: "bi-box-arrow-in-down-left",
            path: "/employee-leave-request",
          },
        ],
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
            {
              key: "teacherAssignment",
              label: "Teacher Assignment",
              icon: "bi-person-check",
              path: "/teacher-assignment",
            },
            {
              key: "inchargeAssignment",
              label: "Incharge Assignment",
              icon: "bi-person-badge",
              path: "/incharge-assignment",
            },
            {
              key: "holidayMarking",
              label: "Holiday Marking",
              icon: "bi-calendar3",
              path: "/holiday-marking",
            },
            { key: "periods", label: "Periods", icon: "bi-clock", path: "/periods" },
            {
              key: "combined-timetable",
              label: "Timetable",
              icon: "bi-table",
              path: "/combined-timetable",
            },
            {
              key: "substitution",
              label: "Substitutions",
              icon: "bi-arrow-repeat",
              path: "/substitution",
            },
            {
              key: "substitutionListing",
              label: "Substitution Listing",
              icon: "bi-list-ul",
              path: "/substitution-listing",
            },
            {
              key: "studentUserAccounts",
              label: "Create Student Login",
              icon: "bi-person-plus",
              path: "/student-user-accounts",
            },
          ],
        });

        groups.push({
          heading: "Exam Settings",
          items: [
            {
              key: "academic-years",
              label: "Academic Years",
              icon: "bi-calendar2-week",
              path: "/academic-years",
            },
            {
              key: "exams", // ✅ NEW
              label: "Exams",
              icon: "bi-journal-bookmark",
              path: "/exams",
            },
            {
              key: "exam-schemes",
              label: "Exam Scheme",
              icon: "bi-card-checklist",
              path: "/exam-schemes",
            },
            {
                key: "combined-exam-schemes", // ✅ NEW
                label: "Combined Scheme",
                icon: "bi-diagram-3-fill",
                path: "/combined-exam-schemes",
            },
            {
              key: "grade-schemes", // ✅ NEW ITEM
              label: "Grade Scheme",
              icon: "bi-ui-checks",
              path: "/grade-schemes",
            },
            {
              key: "term-management",
              label: "Terms",
              icon: "bi-calendar3-range",
              path: "/term-management",
            },
            {
              key: "assessment-components",
              label: "Assessment Components",
              icon: "bi-diagram-3",
              path: "/assessment-components",
            },
            {
               key: "exam-schedules",
               label: "Exam Schedule",
               icon: "bi-calendar2-check",
               path: "/exam-schedules",
            },
          ],
        });

      groups.push({
        heading: "Leave",
        items: [
          {
            key: "employee-leave-request",
            label: "Leave Request",
            icon: "bi-box-arrow-in-down-left",
            path: "/employee-leave-request",
          },
        ],
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
      {
        key: "departments",
        label: "Departments",
        icon: "bi-diagram-3",
        path: "/departments",
      },
      {
        key: "employees",
        label: "Employees",
        icon: "bi-person-badge",
        path: "/employees",
      },
      {
        key: "employee-user-accounts",
        label: "Employee Login Accounts",
        icon: "bi-person-plus",
        path: "/employee-user-accounts",
      },
      {
        key: "leave-types",
        label: "Leave Types",
        icon: "bi-journals",
        path: "/leave-types",
      },
      {
        key: "employee-leave-balances",
        label: "Employee Leave Balances",
        icon: "bi-calendar-check",
        path: "/employee-leave-balances",
      },
      {
        key: "employee-leave-request",
        label: "Leave Request",
        icon: "bi-box-arrow-in-down-left",
        path: "/employee-leave-request",
      },
      {
        key: "hr-leave-requests",
        label: "Review Leave Requests",
        icon: "bi-clipboard-check",
        path: "/hr-leave-requests",
      },
      {
        key: "employee-attendance",
        label: "Employee Attendance",
        icon: "bi-person-check-fill",
        path: "/employee-attendance",
      },
      {
        key: "my-attendance-calendar",
        label: "My Attendance",
        icon: "bi-calendar2-week",
        path: "/my-attendance-calendar",
      },

      {
        key: "employee-attendance-summary",
        label: "Employee Attendance Summary",
        icon: "bi-calendar-range",
        path: "/employee-attendance-summary",
      },


    ],
  });
}




    // src/components/Sidebar.jsx
if (isTeacher) {
  groups.push({
    heading: "Main",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
      { key: "view-circulars", label: "Circulars", icon: "bi-megaphone", path: "/view-circulars" },
      {
        key: "mark-attendance",
        label: "Mark Attendance",
        icon: "bi-check2-square",
        path: "/mark-attendance",
      },
      {
        key: "attendance-calendar",
        label: "Attendance Calendar",
        icon: "bi-calendar2-check",
        path: "/attendance-calendar",
      },
      {
        key: "assignments",
        label: "Assignments",
        icon: "bi-clipboard",
        path: "/assignments",
      },
      {
        key: "assignment-marking",
        label: "Assignment Marking",
        icon: "bi-pencil-square",
        path: "/assignment-marking",
      },
      {
        key: "teacher-timetable-display",
        label: "Time Table",
        icon: "bi-table",
        path: "/teacher-timetable-display",
      },
      {
        key: "combined-teacher-substitution",
        label: "My Substitutions",
        icon: "bi-arrow-repeat",
        path: "/combined-teacher-substitution",
      },
      {
        key: "lesson-plan",
        label: "Lesson Plan",
        icon: "bi-journal-text",
        path: "/lesson-plan",
      },
      {
        key: "employee-leave-request",
        label: "Request Leave",
        icon: "bi-box-arrow-in-down-left",
        path: "/employee-leave-request",
      },
      {
        key: "my-attendance-calendar",
        label: "My Attendance",
        icon: "bi-calendar2-week",
        path: "/my-attendance-calendar",
      },

    ],
  });

  groups.push({
    heading: "Leave Management",
    items: [
      {
        key: "leave-requests",
        label: "Leave Requests",
        icon: "bi-envelope",
        path: "/leave-requests",
      },      
    ],
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
      {
        key: "roll-numbers",
        label: "Roll Numbers",
        icon: "bi-list-ol",
        path: "/roll-numbers",
      },
      {
        key: "marks-entry", // ✅ NEW
        label: "Marks Entry",
        icon: "bi-pencil-square",
        path: "/marks-entry",
      },
      {
        key: "classwise-result-summary",
        label: "Result Summary",
        icon: "bi-bar-chart",
        path: "/classwise-result-summary",
      },

        {
            key: "final-result-summary", // ✅ NEW
            label: "Final Result Summary",
            icon: "bi-bar-chart-line",
            path: "/final-result-summary",
          },

    ],
    
  });
}

    if (isStudent) {
      groups.push({
        heading: "Main",
        items: [
          { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" },
          {
            key: "student-circulars",
            label: "Circulars",
            icon: "bi-megaphone",
            path: "/student-circulars",
          },
          // { key: "subjects", label: "Subjects", icon: "bi-book", path: "/subjects" },
          { key: "student-fee", label: "Fees", icon: "bi-cash-coin", path: "/student-fee" },
          {
            key: "student-attendance",
            label: "Attendance",
            icon: "bi-calendar2-check",
            path: "/student-attendance",
          },
          {
            key: "my-assignments",
            label: "My Assignments",
            icon: "bi-clipboard",
            path: "/my-assignments",
          },
          {
            key: "student-timetable-display",
            label: "Time Table",
            icon: "bi-table",
            path: "/student-timetable-display",
          },
        ],
      });
    }

    if (isSuperAdmin) {
      groups.splice(1, 0, {
        heading: "User Management",
        items: [{ key: "users", label: "Users", icon: "bi-person", path: "/users" }],
      });
    }

    // Fallback if no roles
    if (!groups.length) {
      groups.push({
        heading: "Main",
        items: [{ key: "dashboard", label: "Dashboard", icon: "bi-speedometer2", path: "/dashboard" }],
      });
    }

    return groups;
  }, [isAdmin, isAcademic, isTeacher, isStudent, isHR, isSuperAdmin]);

  const handleMenuClick = (item) => {
    setActiveSection(item.key); // Update active section for styling
    navigate(item.path); // Navigate to the route
  };

  return (
    <aside
      className="d-flex flex-column bg-dark text-white"
      style={{
        position: "fixed",
        top: "40px",
        left: 0,
        height: "calc(100vh - 60px)",
        width: isExpanded ? "250px" : "60px",
        transition: "width 0.3s ease",
        overflowY: "auto",
        overflowX: "hidden",
        zIndex: 1000,
      }}
    >
      <button
        className="btn border-0"
        onClick={toggleSidebar}
        style={{
          background: "transparent",
          fontSize: "1.6rem",
          color: "#fff",
          width: "100%",
          textAlign: isExpanded ? "right" : "center",
        }}
        aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      >
        {isExpanded ? <i className="bi bi-arrow-left" /> : <i className="bi bi-list" />}
      </button>

      <nav className="mt-2">
        {menuGroups.map((group, gi) => (
          <div key={gi}>
            {isExpanded && (
              <h6
                className="text-uppercase px-3 mt-3 mb-1"
                style={{ fontSize: "0.75rem", color: "#adb5bd" }}
              >
                {group.heading}
              </h6>
            )}
            <ul className="nav flex-column">
              {group.items.map((item) => {
                const isActive = activeSection === item.key;
                return (
                  <li
                    key={item.key}
                    className={`nav-item ${isActive ? "active" : ""}`}
                    onClick={() => handleMenuClick(item)} // Use handleMenuClick
                    style={{
                      cursor: "pointer",
                      padding: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: isExpanded ? "10px" : "0",
                      backgroundColor: isActive ? "#495057" : "transparent",
                    }}
                  >
                    <i className={`bi ${item.icon}`} style={{ fontSize: "1.2rem" }} />
                    {isExpanded && <span>{item.label}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}