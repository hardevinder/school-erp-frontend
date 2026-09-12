import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./LectureAttendance.css";

const statusClass = (status) => ({
  present: "text-bg-success",
  absent: "text-bg-danger",
  late: "text-bg-warning",
  leave: "text-bg-info",
  on_duty: "text-bg-primary",
}[status] || "text-bg-secondary");
const label = (s) => String(s || "—").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

export default function StudentLectureAttendance() {
  const { isCollege, terms } = useInstitution();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let alive = true;
    if (!isCollege) { setLoading(false); return () => {}; }
    setLoading(true);
    api.get("/lecture-attendance/student/me/summary")
      .then(({ data: result }) => { if (alive) { setData(result); setError(""); } })
      .catch((e) => { if (alive) setError(e?.response?.data?.message || e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isCollege]);

  useEffect(() => {
    if (!isCollege) return;
    let alive = true;
    api.get("/lecture-attendance/student/me/history", { params: subjectId ? { subject_id: subjectId } : {} })
      .then(({ data: result }) => { if (alive) setHistory(Array.isArray(result?.rows) ? result.rows : []); })
      .catch(() => { if (alive) setHistory([]); });
    return () => { alive = false; };
  }, [isCollege, subjectId]);

  const selectedSubject = useMemo(() => data?.subjects?.find((s) => String(s.subject_id) === String(subjectId)) || null, [data, subjectId]);

  if (!isCollege) return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">Lecture attendance is available in College mode.</div></div>;
  if (loading) return <div className="container-fluid py-5 text-center"><div className="spinner-border" /></div>;
  if (error) return <div className="container-fluid py-4"><div className="alert alert-danger rounded-4">{error}</div></div>;

  const overall = data?.overall || {};
  return (
    <div className="container-fluid py-3 lecture-attendance-page">
      <div className="lecture-hero rounded-4 p-3 p-lg-4 mb-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div><div className="text-primary text-uppercase small fw-semibold">My College Attendance</div><h2 className="h4 mb-1">Lecture Attendance</h2><div className="text-muted small">Subject-wise attendance based on lectures actually conducted.</div></div>
          <div className="ms-lg-auto text-lg-end"><div className={`display-6 fw-bold ${overall.shortage ? "text-danger" : "text-success"}`}>{overall.percentage || 0}%</div><div className="small text-muted">Required: {data?.threshold || 75}%</div></div>
        </div>
      </div>

      {overall.shortage && (
        <div className="alert alert-warning rounded-4 shadow-sm"><i className="bi bi-exclamation-triangle me-2" /><strong>Attendance shortage:</strong> Attend the next <strong>{overall.lectures_needed}</strong> lecture{overall.lectures_needed === 1 ? "" : "s"} continuously to reach approximately {data?.threshold || 75}% overall.</div>
      )}

      <div className="row g-3 mb-3">
        {[
          ["Lectures Attended", `${overall.attended || 0} / ${overall.total || 0}`, "bi-check-circle", "text-success"],
          ["Present", overall.present || 0, "bi-person-check", "text-success"],
          ["Absent", overall.absent || 0, "bi-person-x", "text-danger"],
          ["Late / OD", `${overall.late || 0} / ${overall.on_duty || 0}`, "bi-clock-history", "text-primary"],
        ].map(([title, value, icon, cls]) => <div className="col-6 col-xl-3" key={title}><div className="card attendance-kpi border-0 shadow-sm rounded-4 h-100"><div className="card-body"><i className={`bi ${icon} ${cls} fs-4`} /><div className="small text-muted mt-2">{title}</div><div className="h4 mb-0 fw-bold">{value}</div></div></div></div>)}
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 p-lg-4"><h5 className="mb-3">{terms.subject}-wise Attendance</h5>
          {!data?.subjects?.length ? <div className="text-muted">No lecture attendance has been recorded yet.</div> : <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>{terms.subject}</th><th>Attended</th><th>Total</th><th>Attendance</th><th>Status</th></tr></thead><tbody>{data.subjects.map((s) => <tr key={s.subject_id}><td className="fw-semibold">{s.subject_name}</td><td>{s.attended}</td><td>{s.total}</td><td style={{ minWidth: 180 }}><div className="d-flex justify-content-between small mb-1"><span>{s.percentage}%</span><span>{s.shortage ? `${s.lectures_needed} needed` : "Safe"}</span></div><div className="progress subject-progress"><div className={`progress-bar ${s.shortage ? "bg-danger" : "bg-success"}`} style={{ width: `${Math.min(100, s.percentage)}%` }} /></div></td><td>{s.shortage ? <span className="badge text-bg-danger">Short</span> : <span className="badge text-bg-success">Safe</span>}</td></tr>)}</tbody></table></div>}
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-3 p-lg-4">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3"><div><h5 className="mb-1">Lecture History</h5><div className="small text-muted">Every recorded lecture with topic, faculty and status.</div></div><select className="form-select" style={{ maxWidth: 260 }} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">All {terms.subjects}</option>{(data?.subjects || []).map((s) => <option key={s.subject_id} value={s.subject_id}>{s.subject_name}</option>)}</select></div>
          {selectedSubject?.shortage && <div className="alert alert-warning py-2">For <strong>{selectedSubject.subject_name}</strong>, attend the next <strong>{selectedSubject.lectures_needed}</strong> lectures continuously to reach approximately {data.threshold}%.</div>}
          <div className="table-responsive"><table className="table table-hover align-middle"><thead><tr><th>Date</th><th>{terms.subject}</th><th>Period</th><th>Topic</th><th>Faculty</th><th>Status</th></tr></thead><tbody>{history.length ? history.map((row) => <tr key={row.session_id}><td>{row.date}</td><td className="fw-semibold">{row.subject_name}</td><td>{row.period_name}<div className="small text-muted">{row.time}</div></td><td>{row.topic || "—"}</td><td>{row.faculty_name || "—"}</td><td><span className={`badge status-pill ${statusClass(row.status)}`}>{label(row.status)}</span></td></tr>) : <tr><td colSpan="6" className="text-center text-muted py-4">No lecture attendance records found.</td></tr>}</tbody></table></div>
        </div>
      </div>
    </div>
  );
}
