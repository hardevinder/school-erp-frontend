import React from "react";
import { useRoles } from "../hooks/useRoles";
import { Outlet } from "react-router-dom";

import Dashboard from "./Dashboard";                                // Admin / Superadmin layout
import TeacherDashboard from "./TeacherDashboard";                 // Teacher layout
import StudentDashboard from "./StudentDashboard";                 // Student layout
import AcademicCoordinatorDashboard from "./AcademicCoordinatorDashboard"; // Coordinator layout
import HRDashboard from "./HRDashboard";                           // ✅ HR layout (new)

export default function RoleAwareDashboard() {
  const { activeRole } = useRoles();

  let LayoutComponent;

  switch (activeRole) {
    case "teacher":
      LayoutComponent = TeacherDashboard;
      break;
    case "student":
      LayoutComponent = StudentDashboard;
      break;
    case "academic_coordinator":
      LayoutComponent = AcademicCoordinatorDashboard;
      break;
    case "hr":
      LayoutComponent = HRDashboard; // ✅ HR-specific layout here
      break;
    case "admin":
    case "superadmin":
    default:
      LayoutComponent = Dashboard;
  }

  return (
    <LayoutComponent>
      <Outlet />
    </LayoutComponent>
  );
}
