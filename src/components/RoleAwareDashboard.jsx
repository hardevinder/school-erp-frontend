import React from "react";
import { Navigate } from "react-router-dom";
import { useRoles } from "../hooks/useRoles";

import Dashboard from "./Dashboard";                                // Admin / Superadmin
import FrontOfficeDashboard from "./FrontOfficeDashboard";         // ✅ Front Office
import TeacherDashboard from "./TeacherDashboard";                 // Teacher
import StudentDashboard from "./StudentDashboard";                 // Student
import AcademicCoordinatorDashboard from "./AcademicCoordinatorDashboard"; // Coordinator
import HRDashboard from "./HRDashboard";                           // HR
// (Accounts handled via redirect only)

export default function RoleAwareDashboard() {
  const { activeRole } = useRoles();
  const role = (activeRole || "").toLowerCase();

  switch (role) {
    case "frontoffice":
      return <FrontOfficeDashboard />;   // ✅ NEW

    case "teacher":
      return <TeacherDashboard />;

    case "student":
      return <StudentDashboard />;

    case "academic_coordinator":
      return <AcademicCoordinatorDashboard />;

    case "hr":
      return <HRDashboard />;

    case "accounts":
      // Single source of truth
      return <Navigate to="/accounts-dashboard" replace />;

    case "admin":
    case "superadmin":
    default:
      return <Dashboard />;
  }
}
