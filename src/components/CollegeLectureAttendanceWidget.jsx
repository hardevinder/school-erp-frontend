import React from "react";
import { Link } from "react-router-dom";

export default function CollegeLectureAttendanceWidget({ data, loading, error }) {
  if (loading) return <div className="card border-0 shadow-sm rounded-4 mb-3"><div className="card-body text-center py-4"><div className="spinner-border spinner-border-sm" /><span className="ms-2 text-muted">Loading lecture attendance…</span></div></div>;
  if (error) return <div className="alert alert-warning rounded-4">Lecture attendance summary is temporarily unavailable.</div>;
  const overall = data?.overall || {};
  const subjects = Array.isArray(data?.subjects) ? data.subjects : [];
  return (
    <div className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
      <div className="card-body p-3 p-lg-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div><div className="text-primary text-uppercase small fw-semibold">College Attendance</div><h5 className="mb-1">Lecture-level Attendance</h5><div className="small text-muted">Subject-wise attendance from conducted lectures.</div></div>
          <Link to="/student-lecture-attendance" className="btn btn-sm btn-outline-primary">View full attendance <i className="bi bi-arrow-right ms-1" /></Link>
        </div>
        {overall.total ? <>
          <div className="row g-2 mb-3">
            <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-light"><div className="small text-muted">Overall</div><div className={`h4 mb-0 ${overall.shortage ? "text-danger" : "text-success"}`}>{overall.percentage}%</div></div></div>
            <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-light"><div className="small text-muted">Attended</div><div className="h4 mb-0">{overall.attended}/{overall.total}</div></div></div>
            <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-light"><div className="small text-muted">Absent</div><div className="h4 mb-0 text-danger">{overall.absent || 0}</div></div></div>
            <div className="col-6 col-md-3"><div className="p-3 rounded-4 bg-light"><div className="small text-muted">Required</div><div className="h4 mb-0">{data?.threshold || 75}%</div></div></div>
          </div>
          <div className="row g-2">{subjects.slice(0, 4).map((s) => <div className="col-12 col-md-6" key={s.subject_id}><div className="border rounded-3 p-2"><div className="d-flex justify-content-between gap-2"><span className="fw-semibold text-truncate">{s.subject_name}</span><span className={s.shortage ? "text-danger fw-bold" : "text-success fw-bold"}>{s.percentage}%</span></div><div className="progress mt-2" style={{ height: 5 }}><div className={`progress-bar ${s.shortage ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.min(100, s.percentage)}%` }} /></div>{s.shortage && <div className="small text-danger mt-1">Attend next {s.lectures_needed} to reach {data?.threshold || 75}%</div>}</div></div>)}</div>
        </> : <div className="text-muted py-2">No lecture attendance has been recorded yet.</div>}
      </div>
    </div>
  );
}
