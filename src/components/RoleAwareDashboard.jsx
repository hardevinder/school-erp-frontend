// src/components/RoleAwareDashboard.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useRoles } from "../hooks/useRoles";
import { defaultWorkspaceForRole, useWorkspace } from "../hooks/useWorkspace";

import Dashboard from "./Dashboard";
import FrontOfficeDashboard from "./FrontOfficeDashboard";
import AdmissionDashboard from "./AdmissionDashboard";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";
import AcademicCoordinatorDashboard from "./AcademicCoordinatorDashboard";
import HRDashboard from "./HRDashboard";
import LibraryDashboard from "./LibraryDashboard";
import TransportDashboard from "./TransportDashboard";
import TransportAttendanceMobile from "../pages/TransportAttendanceMobile";
import ExaminationDashboard from "./ExaminationDashboard";
import LmsWorkspaceDashboard from "./dashboard/LmsWorkspaceDashboard";
import PremiumWorkspaceHero from "./dashboard/PremiumWorkspaceHero";
import "./dashboard/DashboardPolish.css";

export default function RoleAwareDashboard() {
  const { activeRole } = useRoles();
  const role = (activeRole || "").toLowerCase();
  const { workspace, setWorkspace } = useWorkspace(defaultWorkspaceForRole(role));

  if (workspace === "LMS") {
    return (
      <div className="classic-workspace-shell">
        <PremiumWorkspaceHero
          workspace={workspace}
          onSelectWorkspace={setWorkspace}
          role={role}
        />
        <LmsWorkspaceDashboard role={role} />
      </div>
    );
  }

  let dashboard;
  switch (role) {
    case "frontoffice":
      dashboard = <FrontOfficeDashboard />;
      break;
    case "admission":
      dashboard = <AdmissionDashboard />;
      break;
    case "transport":
    case "transport_admin":
      dashboard = <TransportDashboard />;
      break;
    case "driver":
    case "conductor":
      return <TransportAttendanceMobile />;
    case "examination":
      dashboard = <ExaminationDashboard />;
      break;
    case "librarian":
    case "library":
    case "libraryadmin":
      dashboard = <LibraryDashboard />;
      break;
    case "teacher":
    case "department_hod":
      dashboard = <TeacherDashboard />;
      break;
    case "student":
      dashboard = <StudentDashboard />;
      break;
    case "academic_coordinator":
    case "coordinator":
      dashboard = <AcademicCoordinatorDashboard />;
      break;
    case "hr":
      dashboard = <HRDashboard />;
      break;
    case "accounts":
    case "account":
    case "accountant":
      return <Navigate to="/accounts-dashboard" replace />;
    case "principal":
      return <Navigate to="/command-center" replace />;
    case "inventoryadmin":
    case "storeincharge":
    case "labincharge":
      return <Navigate to="/inventory" replace />;
    case "admin":
    case "superadmin":
    case "super_admin":
    default:
      dashboard = <Dashboard />;
      break;
  }

  return (
    <div className="workspace-dashboard-host classic-workspace-shell">
      <PremiumWorkspaceHero
        workspace={workspace}
        onSelectWorkspace={setWorkspace}
        role={role}
      />
      {dashboard}
    </div>
  );
}
