import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import StudentDashboard from "../components/StudentDashboard";
import StudentFeePage from "./StudentFeePage";
import StudentAttendance from "./StudentAttendance";
import StudentSideAssignment from "./StudentSideAssignment";
import StudentCirculars from "./StudentCirculars";
import StudentTimetableDisplay from "./StudentTimeTableDisplay";
import StudentDiary from "./StudentDiary";
import LibraryManagement from "./LibraryManagement";
import { clearStudent360Session } from "../utils/student360Session";

const tabs = [["overview", "Overview"], ["fees", "Fees"], ["attendance", "Attendance"], ["assignments", "Assignments"], ["diary", "Diary"], ["circulars", "Circulars"], ["timetable", "Timetable"], ["library", "Library"]];

export default function Student360Portal() {
  const { studentId } = useParams();
  const [active, setActive] = useState("overview");
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const previousAdmission = localStorage.getItem("activeStudentAdmission");
    clearStudent360Session();
    api.post(`/users/student-view/${studentId}/session`)
      .then(({ data }) => {
        if (!alive) return;
        sessionStorage.setItem("student360Token", data.token);
        sessionStorage.setItem("student360Student", JSON.stringify(data.student));
        localStorage.setItem("activeStudentAdmission", data.student.admission_number);
        setStudent(data.student);
      })
      .catch((e) => setError(e.response?.data?.message || "Unable to open student portal"))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
      clearStudent360Session();
      if (previousAdmission) localStorage.setItem("activeStudentAdmission", previousAdmission);
      else localStorage.removeItem("activeStudentAdmission");
    };
  }, [studentId]);

  if (loading) return <div className="container py-5 text-center">Opening student portal…</div>;
  if (error) return <div className="container py-4"><div className="alert alert-danger">{error}</div></div>;

  const views = { overview: <StudentDashboard />, fees: <StudentFeePage />, attendance: <StudentAttendance />, assignments: <StudentSideAssignment />, diary: <StudentDiary />, circulars: <StudentCirculars />, timetable: <StudentTimetableDisplay />, library: <LibraryManagement studentView /> };
  const routeToTab = { "/student-fee": "fees", "/student-attendance": "attendance", "/my-assignments": "assignments", "/student-diary": "diary", "/student-circulars": "circulars", "/student-timetable-display": "timetable", "/my-library": "library" };
  const handleNavigation = (event) => {
    const anchor = event.target.closest("a[href]");
    const tab = anchor && routeToTab[anchor.getAttribute("href")];
    if (tab) { event.preventDefault(); setActive(tab); }
  };

  return <div className="container-fluid py-3" onClick={handleNavigation}>
    <div className="sticky-top bg-white shadow-sm rounded border p-2 mb-3" style={{ zIndex: 1010 }}>
    <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
      <div><strong>360° Student View:</strong> {student?.name} ({student?.admission_number}) <span className="badge bg-secondary ms-2">Read only</span></div>
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setActive("overview")} disabled={active === "overview"}>
          <i className="bi bi-house me-1"></i> Student Dashboard
        </button>
        <Link to="/students" className="btn btn-sm btn-outline-dark">
          <i className="bi bi-arrow-left me-1"></i> Back to Students
        </Link>
      </div>
    </div>
    <ul className="nav nav-pills gap-1">{tabs.map(([key, label]) => <li className="nav-item" key={key}><button type="button" className={`nav-link ${active === key ? "active" : ""}`} onClick={() => setActive(key)}>{label}</button></li>)}</ul>
    </div>
    {views[active]}
  </div>;
}
