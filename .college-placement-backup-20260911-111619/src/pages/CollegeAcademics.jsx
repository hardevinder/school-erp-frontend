import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import "./CollegeAcademics.css";

const cards = [
  {
    title: "Programs & Semesters",
    text: "Use the existing Classes engine for program + semester combinations, e.g. BCA - Semester 1.",
    path: "/classes",
    icon: "bi-mortarboard",
    action: "Manage programs / semesters",
  },
  {
    title: "Batches & Sections",
    text: "Use existing Sections for college batches or sections. All attendance, fees and timetable links continue to work.",
    path: "/sections",
    icon: "bi-collection",
    action: "Manage batches / sections",
  },
  {
    title: "Papers & Subjects",
    text: "Use the same Subjects master for theory, practical and elective papers without duplicating academic data.",
    path: "/subjects",
    icon: "bi-journal-bookmark",
    action: "Manage papers / subjects",
  },
  {
    title: "Subject Registration",
    text: "Configure core, elective and optional papers, credits, choice rules and student subject selection.",
    path: "/college-subject-registration",
    icon: "bi-ui-checks-grid",
    action: "Configure subject registration",
  },
];

export default function CollegeAcademics() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/schools/current/profile")
      .then(({ data }) => {
        if (!active) return;
        setProfile(data?.institution || data || null);
        const type = String(data?.institution?.institution_type || data?.institution_type || "school").toLowerCase();
        localStorage.setItem("institutionType", type);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const type = String(profile?.institution_type || localStorage.getItem("institutionType") || "school").toLowerCase();

  return (
    <div className="container py-4 college-academics-page">
      <div className="college-academics-hero mb-4">
        <div>
          <span className="college-academics-kicker">EduBridge ERP</span>
          <h1 className="h3 mb-2">College Academics</h1>
          <p className="mb-0 text-muted">
            One academic setup layer for programs, semesters, batches and papers while keeping the same ERP/LMS engine.
          </p>
        </div>
        <span className={`badge rounded-pill ${type === "college" ? "text-bg-primary" : "text-bg-secondary"}`}>
          {loading ? "Checking institution…" : type === "college" ? "College Mode" : "School Mode"}
        </span>
      </div>

      {type !== "college" && !loading && (
        <div className="alert alert-info border-0 shadow-sm">
          This institution is currently configured as <strong>School</strong>. Super Admin can change it from Institutions Management.
        </div>
      )}

      <div className="row g-3">
        {cards.map((card) => (
          <div className="col-12 col-lg-4" key={card.path}>
            <div className="card h-100 border-0 shadow-sm college-academics-card">
              <div className="card-body p-4">
                <div className="college-academics-icon mb-3"><i className={`bi ${card.icon}`} /></div>
                <h2 className="h5">{card.title}</h2>
                <p className="text-muted">{card.text}</p>
                <Link className="btn btn-outline-primary btn-sm" to={card.path}>{card.action}</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-body p-4">
          <h2 className="h5 mb-3">What stays shared with School ERP</h2>
          <div className="row g-2 small">
            {["Admissions", "Students", "Fees", "Attendance", "HR & Payroll", "Library", "Inventory", "Transport", "Departments", "Examinations", "LMS", "Learning Resources", "Online Classes", "Reports"].map((item) => (
              <div className="col-6 col-md-4 col-xl-3" key={item}>
                <div className="college-shared-item"><i className="bi bi-check-circle-fill me-2" />{item}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="alert alert-light border mt-4 mb-0">
        <strong>Recommended data convention:</strong> create class records as <code>BCA - Semester 1</code>, <code>BCA - Semester 2</code>, etc. This keeps your existing fee, attendance, timetable, exam and LMS workflows compatible immediately.
      </div>
    </div>
  );
}
