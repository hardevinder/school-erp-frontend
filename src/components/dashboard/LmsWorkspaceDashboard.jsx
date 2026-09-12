import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import DashboardInsights from "./DashboardInsights";
import { useInstitution } from "../../institution/InstitutionContext";
import "./LmsWorkspaceDashboard.css";

const ACTIONS = [
  { key: "assessments", label: "Assessments & Tests", description: "Create, evaluate and publish assessments", icon: "bi-clipboard2-check", path: "/assessments", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "examination", "student"] },
  { key: "classes", label: "Online Classes", description: "Schedule, start or join live classes", icon: "bi-camera-video", path: "/online-classes", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "student"] },
  { key: "lesson", label: "Lesson Plans", description: "Plan lessons and track classroom delivery", icon: "bi-journal-richtext", path: "/lesson-plan", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
  { key: "syllabus", label: "Syllabus Progress", description: "Break up syllabus and monitor completion", icon: "bi-list-check", path: "/syllabus-breakdown", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
  { key: "diary", label: "Digital Diary", description: "Classwork, homework and teacher diary", icon: "bi-journal-text", path: "/digital-diary", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
  { key: "student-diary", label: "My Diary", description: "View classwork, homework and school updates", icon: "bi-journal-bookmark", path: "/student-diary", roles: ["student"] },
  { key: "student-lessons", label: "Learning Plans", description: "View lesson plans shared for your classes", icon: "bi-book", path: "/student-lesson-plans", roles: ["student"] },
  { key: "marks", label: "Marks & Evaluation", description: "Enter marks and manage evaluation workflow", icon: "bi-ui-checks-grid", path: "/marks-entry", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "examination"] },
  { key: "reports", label: "Report Cards", description: "Generate and publish academic report cards", icon: "bi-file-earmark-bar-graph", path: "/report-card-generator", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "examination"] },
  { key: "library", label: "Learning Resources", description: "Bulk notes, PDFs, study material and video links", icon: "bi-collection-play", path: "/learning-resources", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "student"] },
  { key: "college-subject-registration", label: "Subject Registration", description: "Choose electives / optional papers and manage semester subject choices", icon: "bi-ui-checks-grid", path: "/college-subject-registration", collegeOnly: true, roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "department_hod", "student"] },
  { key: "notebook-checking", label: "Notebook / Copy Checking", description: "Lesson/topic-wise notebook checking, corrections and HOD verification", icon: "bi-journal-check", path: "/notebook-checking", schoolOnly: true, roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
];

const roleLabels = {
  academic_coordinator: "Academic Coordinator",
  department_hod: "Department HOD",
  superadmin: "Super Admin",
  examination: "Examination",
};

export default function LmsWorkspaceDashboard({ role = "" }) {
  const normalizedRole = String(role || "").toLowerCase();
  const { isCollege } = useInstitution();
  const actions = useMemo(() => {
    return ACTIONS.filter((item) => item.roles.includes(normalizedRole) && !(item.schoolOnly && isCollege) && !(item.collegeOnly && !isCollege));
  }, [normalizedRole, isCollege]);

  const roleLabel = roleLabels[normalizedRole] ||
    (normalizedRole ? normalizedRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "School");

  return (
    <main className="lms-workspace dashboard-surface">
      <div className="container-fluid px-3 px-md-4 py-3 py-md-4">
        <section className="lms-hero mb-4">
          <div className="lms-hero-copy">
            <div className="lms-eyebrow"><i className="bi bi-mortarboard-fill" /> EduBridge LMS</div>
            <h1>Learning Management Dashboard</h1>
            <p>Teaching, learning, assessments and academic progress in one focused workspace.</p>
            <div className="lms-meta-row">
              <span><i className="bi bi-person-badge" /> {roleLabel}</span>
              <span><i className="bi bi-lightning-charge-fill" /> LMS Workspace</span>
            </div>
          </div>
          <div className="lms-hero-mark" aria-hidden="true"><i className="bi bi-mortarboard" /></div>
        </section>

        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
          <div>
            <div className="lms-section-kicker">Quick access</div>
            <h2 className="h5 mb-1 fw-bold">Learning tools</h2>
            <p className="text-muted small mb-0">Only LMS modules are shown in this workspace.</p>
          </div>
          <span className="badge rounded-pill text-bg-light border px-3 py-2">{actions.length} modules</span>
        </div>

        {actions.length ? (
          <div className="row g-3 mb-4">
            {actions.map((item) => (
              <div key={item.key} className="col-12 col-sm-6 col-xl-4 col-xxl-3">
                <Link to={item.path} className="lms-action-card text-decoration-none">
                  <span className="lms-action-icon"><i className={`bi ${item.icon}`} /></span>
                  <span className="lms-action-content">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <i className="bi bi-arrow-right lms-action-arrow" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-light border rounded-4 shadow-sm mb-4 d-flex align-items-center gap-3">
            <span className="lms-action-icon"><i className="bi bi-shield-lock" /></span>
            <div><strong>No LMS modules are assigned to this role.</strong><div className="small text-muted">An administrator can grant learning-module access when required.</div></div>
          </div>
        )}

        <DashboardInsights role={normalizedRole} workspace="LMS" />
      </div>
    </main>
  );
}
