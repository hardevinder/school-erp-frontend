// src/components/RoleAwareDashboard.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useRoles } from "../hooks/useRoles";

import Dashboard from "./Dashboard";                                // Admin / Superadmin
import TeacherDashboard from "./TeacherDashboard";                 // Teacher
import StudentDashboard from "./StudentDashboard";                 // Student
import AcademicCoordinatorDashboard from "./AcademicCoordinatorDashboard"; // Coordinator
import HRDashboard from "./HRDashboard";                           // HR
// (No need to import AccountsDashboard here if we redirect)

export default function RoleAwareDashboard() {
  const { activeRole } = useRoles();
  const role = (activeRole || "").toLowerCase();

  switch (role) {
    case "teacher":
      return <TeacherDashboard />;

    case "student":
      return <StudentDashboard />;

    case "academic_coordinator":
      return <AcademicCoordinatorDashboard />;

    case "hr":
      return <HRDashboard />;

    case "accounts":
      // Keep a single source of truth for Accounts at /accounts-dashboard
      return <Navigate to="/accounts-dashboard" replace />;

    case "admin":
    case "superadmin":
    default:
      return <Dashboard />;
  }
}
