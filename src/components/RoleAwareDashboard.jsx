import React from "react";
import { Navigate } from "react-router-dom";
import { useRoles } from "../hooks/useRoles";

import Dashboard from "./Dashboard";
import FrontOfficeDashboard from "./FrontOfficeDashboard";
import AdmissionDashboard from "./AdmissionDashboard";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";
import AcademicCoordinatorDashboard from "./AcademicCoordinatorDashboard";
import HRDashboard from "./HRDashboard";

import LibraryDashboard from "./LibraryDashboard";

// ✅ NEW: Transport Dashboard
import TransportDashboard from "./TransportDashboard";

export default function RoleAwareDashboard() {
  const { activeRole } = useRoles();
  const role = (activeRole || "").toLowerCase();

  switch (role) {
    case "frontoffice":
      return <FrontOfficeDashboard />;

    case "admission":
      return <AdmissionDashboard />;

    // ✅ NEW: Transport role
    case "transport":
      return <TransportDashboard />;

    // ✅ Library
    case "librarian":
    case "library":
    case "libraryadmin":
      return <LibraryDashboard />;

    case "teacher":
      return <TeacherDashboard />;

    case "student":
      return <StudentDashboard />;

    case "academic_coordinator":
      return <AcademicCoordinatorDashboard />;

    case "hr":
      return <HRDashboard />;

    case "accounts":
      return <Navigate to="/accounts-dashboard" replace />;

    case "admin":
    case "superadmin":
    default:
      return <Dashboard />;
  }
}
