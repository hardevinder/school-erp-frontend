import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./SyllabusTracker.css";

const fmtPct = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—";
const statusClass = (status) => {
  const key = String(status || "").toUpperCase();
  if (key === "COMPLETED") return "is-completed";
  if (key === "IN_PROGRESS") return "is-progress";
  if (key === "AWAITING_EVIDENCE") return "is-awaiting";
  return "is-not-started";
};

export default function SyllabusTracker() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [classSummary, setClassSummary] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState("");
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (term) params.term = term;
      if (workflowStatus) params.status = workflowStatus;
      const response = await api.get("/syllabus-breakdowns/tracker", { params });
      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      setClassSummary(Array.isArray(response.data?.classSummary) ? response.data.classSummary : []);
      setSummary(response.data?.summary || {});
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load syllabus tracker.");
    } finally { setLoading(false); }
  }, [term, workflowStatus]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [
      row.class?.name,
      row.subject?.name,
      row.teacher?.name,
      row.academicSession,
      row.term,
    ].some((value) => String(value || "").toLowerCase().includes(q)));
  }, [rows, search]);

  return <div className="container-fluid py-3 syllabus-tracker-page">
    <div className="syllabus-tracker-hero mb-4">
      <div>
        <div className="tracker-eyebrow">ACADEMIC PROGRESS</div>
        <h3 className="mb-1">Syllabus Completion Tracker</h3>
        <p className="mb-0">Class-wise and chapter-wise visibility of teaching completion, linked worksheets/tests and student performance.</p>
      </div>
      <div className="d-flex flex-wrap gap-2">
        <button className="btn btn-light" onClick={() => navigate("/syllabus-approval")}><i className="bi bi-check2-square me-2" />Approvals</button>
        <button className="btn btn-light" onClick={load}><i className="bi bi-arrow-clockwise me-2" />Refresh</button>
      </div>
    </div>

    {error && <div className="alert alert-danger">{error}</div>}

    <div className="tracker-metrics mb-4">
      <Metric icon="bi-mortarboard" label="Classes" value={summary.classes ?? 0} />
      <Metric icon="bi-journal-text" label="Syllabus Items" value={summary.totalItems ?? 0} />
      <Metric icon="bi-check-circle" label="Completed" value={summary.completedItems ?? 0} />
      <Metric icon="bi-graph-up" label="Completion" value={fmtPct(summary.completionPercent)} />
      <Metric icon="bi-file-earmark-text" label="Worksheets" value={summary.worksheets ?? 0} />
      <Metric icon="bi-clipboard2-check" label="Tests" value={summary.tests ?? 0} />
      <Metric icon="bi-speedometer2" label="Avg Performance" value={fmtPct(summary.averagePerformance)} />
    </div>

    {classSummary.length > 0 && <div className="tracker-class-strip mb-4">
      {classSummary.map((item) => <div className="tracker-class-card" key={item.class?.id || item.class?.name}>
        <div className="d-flex justify-content-between gap-3 align-items-center"><strong>{item.class?.name}</strong><span>{fmtPct(item.completionPercent)}</span></div>
        <div className="progress mt-2"><div className="progress-bar" style={{ width: `${Math.max(0, Math.min(100, Number(item.completionPercent) || 0))}%` }} /></div>
        <small>{item.completedItems}/{item.totalItems} chapters · {item.subjects} subject{item.subjects === 1 ? "" : "s"}</small>
      </div>)}
    </div>}

    <div className="card border-0 shadow-sm tracker-filter-card mb-3">
      <div className="card-body row g-3 align-items-end">
        <div className="col-lg-6"><label className="form-label">Search class / subject / teacher</label><input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Example: Class 8, Mathematics, teacher name" /></div>
        <div className="col-md-3"><label className="form-label">Term</label><select className="form-select" value={term} onChange={(e) => setTerm(e.target.value)}><option value="">All terms</option><option value="TERM1">Term 1</option><option value="TERM2">Term 2</option><option value="FULL_YEAR">Full year</option></select></div>
        <div className="col-md-3"><label className="form-label">Breakup Workflow</label><select className="form-select" value={workflowStatus} onChange={(e) => setWorkflowStatus(e.target.value)}><option value="">All statuses</option><option value="Draft">Draft</option><option value="Submitted">Submitted</option><option value="Approved">Approved</option><option value="Returned">Returned</option></select></div>
      </div>
    </div>

    {loading ? <div className="card border-0 shadow-sm p-5 text-center">Loading syllabus progress…</div> : filtered.length === 0 ? <div className="card border-0 shadow-sm p-5 text-center"><i className="bi bi-journal-x fs-1 text-muted" /><h5 className="mt-2">No syllabus progress found</h5></div> : <div className="tracker-breakdowns">
      {filtered.map((row) => {
        const open = expanded === row.id;
        return <div className="card border-0 shadow-sm tracker-breakdown-card" key={row.id}>
          <button type="button" className="tracker-breakdown-head" onClick={() => setExpanded(open ? null : row.id)}>
            <div className="tracker-title-block">
              <div className="d-flex flex-wrap gap-2 align-items-center"><h5 className="mb-0">{row.class?.name} · {row.subject?.name}</h5><span className={`badge ${row.workflowStatus === "APPROVED" ? "text-bg-success" : "text-bg-secondary"}`}>{String(row.workflowStatus || "").replaceAll("_", " ")}</span></div>
              <div className="text-muted small mt-1">{row.teacher?.name || "Teacher not available"} · {row.academicSession || "Session not set"} · {String(row.term || "FULL_YEAR").replaceAll("_", " ")}</div>
            </div>
            <div className="tracker-row-stats">
              <Stat label="Completed" value={`${row.completedItems}/${row.totalItems}`} />
              <Stat label="Worksheets" value={row.worksheetCount} />
              <Stat label="Tests" value={row.testCount} />
              <Stat label="Performance" value={fmtPct(row.averagePerformance)} />
              <div className="tracker-progress-circle"><strong>{Math.round(Number(row.completionPercent) || 0)}%</strong><span>Syllabus</span></div>
              <i className={`bi ${open ? "bi-chevron-up" : "bi-chevron-down"}`} />
            </div>
          </button>
          <div className="progress tracker-main-progress"><div className="progress-bar" style={{ width: `${Math.max(0, Math.min(100, Number(row.completionPercent) || 0))}%` }} /></div>

          {open && <div className="table-responsive tracker-items-wrap"><table className="table align-middle mb-0">
            <thead><tr><th>#</th><th>Unit / Chapter</th><th>Planned</th><th>Teaching</th><th>Worksheet</th><th>Test</th><th>Class Performance</th><th>Evidence</th></tr></thead>
            <tbody>{(row.items || []).map((item, index) => <tr key={item.id}>
              <td>{item.sequence || index + 1}</td>
              <td><strong>{item.unitNumber ? `${item.unitNumber}. ` : ""}{item.unitTitle}</strong>{item.topics && <small className="d-block text-muted tracker-topic-text">{item.topics}</small>}</td>
              <td>{item.plannedMonth || "—"}</td>
              <td><span className={`tracker-status ${statusClass(item.completionStatus)}`}>{String(item.completionStatus || "").replaceAll("_", " ")}</span><small className="d-block text-muted mt-1">{item.completedLessonPlanCount}/{item.lessonPlanCount} lesson plan complete{item.completionStatus === "AWAITING_EVIDENCE" ? " · link/publish a test or worksheet" : ""}</small></td>
              <td><strong>{item.worksheetCount}</strong></td>
              <td><strong>{item.testCount}</strong></td>
              <td>{fmtPct(item.averagePerformance)}</td>
              <td><div className="tracker-evidence-list">{(item.assessments || []).slice(0, 3).map((assessment) => <span key={assessment.id} title={assessment.title}>{assessment.type === "worksheet" ? "Worksheet" : "Test"}: {assessment.title}</span>)}{!(item.assessments || []).length && <span className="text-muted">No linked assessment</span>}</div></td>
            </tr>)}</tbody>
          </table></div>}
        </div>;
      })}
    </div>}
  </div>;
}

function Metric({ icon, label, value }) {
  return <div className="tracker-metric"><i className={`bi ${icon}`} /><div><span>{label}</span><strong>{value}</strong></div></div>;
}
function Stat({ label, value }) { return <div className="tracker-stat"><span>{label}</span><strong>{value ?? "—"}</strong></div>; }
