import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

export default function CollegeStudent360Widget() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let active = true;
    api.get("/college-student-360/my").then(({ data: d }) => active && setData(d)).catch(() => {});
    return () => { active = false; };
  }, []);
  const s = data?.summary;
  return <div className="card border-0 shadow-sm rounded-4 mb-3">
    <div className="card-body p-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
      <div>
        <div className="small text-primary fw-bold text-uppercase">Complete Academic Journey</div>
        <h2 className="h5 mb-1">360° Student Profile</h2>
        <div className="text-muted small">{s ? `CGPA ${Number(s.cgpa || 0).toFixed(2)} · Attendance ${Number(s.attendance_percentage || 0).toFixed(1)}% · ${s.pending_backlogs || 0} pending backlog(s)` : "Enrollment, subjects, attendance, grades, documents and placement in one view"}</div>
      </div>
      <Link to="/college-student-360" className="btn btn-primary btn-sm rounded-pill px-3"><i className="bi bi-person-lines-fill me-1" />Open 360° Profile</Link>
    </div>
  </div>;
}
