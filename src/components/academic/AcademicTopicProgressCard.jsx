import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./AcademicTopicProgressCard.css";

const LABELS = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  AWAITING_WORKSHEET: "Worksheet Needed",
  AWAITING_ASSESSMENT: "Assessment Needed",
  AWAITING_EVALUATION: "Evaluation Pending",
  NEEDS_REINFORCEMENT: "Needs Reinforcement",
  COMPLETED: "Completed",
};

const iconFor = (status) => ({
  NOT_STARTED: "bi-circle",
  IN_PROGRESS: "bi-hourglass-split",
  AWAITING_WORKSHEET: "bi-file-earmark-richtext",
  AWAITING_ASSESSMENT: "bi-ui-checks-grid",
  AWAITING_EVALUATION: "bi-search",
  NEEDS_REINFORCEMENT: "bi-arrow-repeat",
  COMPLETED: "bi-check-circle-fill",
}[status] || "bi-circle");

export default function AcademicTopicProgressCard({ itemId, compact = false }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!itemId) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/syllabus-breakdowns/topic-progress/${itemId}`);
      setData(response?.data?.data || response?.data || null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load topic progress.");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => { load(); }, [load]);
  if (!itemId) return null;

  if (loading && !data) return <div className="academic-topic-progress is-loading"><span className="spinner-border spinner-border-sm" /> Checking topic progress…</div>;
  if (error && !data) return <div className="academic-topic-progress"><span className="text-muted">{error}</span><button className="btn btn-sm btn-link" onClick={load}>Retry</button></div>;
  if (!data) return null;

  const status = data.completionStatus || "IN_PROGRESS";
  const ctx = data.context || {};
  const topic = data.item?.topics || data.item?.unitTitle || "Syllabus Topic";
  const evidence = data.evidence || {};
  const performance = data.performance || {};

  const goCreate = (type, intent) => {
    const q = new URLSearchParams({
      assessment_type: type,
      class_id: String(ctx.classId || ""),
      subject_id: String(ctx.subjectId || ""),
      breakdown_id: String(data.item?.breakdownId || ""),
      breakdown_item_id: String(data.item?.id || itemId),
      intent,
    });
    navigate(`/assessments?${q.toString()}`);
  };

  return <section className={`academic-topic-progress ${compact ? "is-compact" : ""}`}>
    <div className="atp-head">
      <div>
        <div className="atp-kicker">Topic Progress</div>
        <strong>{topic}</strong>
        <small>{ctx.className} · {ctx.subjectName}</small>
      </div>
      <div className={`atp-status status-${String(status).toLowerCase()}`}><i className={`bi ${iconFor(status)}`} />{LABELS[status] || status.replaceAll("_", " ")}</div>
    </div>

    <div className="atp-evidence">
      <Evidence label="Lesson" value={`${evidence.completedLessonPlanCount || 0}/${evidence.lessonPlanCount || 0}`} ok={(evidence.completedLessonPlanCount || 0) > 0} />
      <Evidence label="Worksheet" value={evidence.worksheetCount || 0} ok={(evidence.worksheetCount || 0) > 0} />
      <Evidence label="Assessment" value={evidence.assessmentCount || 0} ok={(evidence.assessmentCount || 0) > 0} />
      <Evidence label="Evaluated" value={evidence.evaluatedStudentCount || 0} ok={(evidence.evaluatedStudentCount || 0) > 0} />
    </div>

    <div className="atp-performance">
      <div><span>Class Average</span><strong>{performance.averagePerformance == null ? "—" : `${Number(performance.averagePerformance).toFixed(1)}%`}</strong></div>
      <div><span>Mastery Target</span><strong>{data.masteryThreshold}%</strong></div>
      <div><span>Need Support</span><strong>{data.supportStudentCount || 0}</strong></div>
    </div>

    {!!data.weakConcepts?.length && <div className="atp-weak"><span>Weak concepts</span><div>{data.weakConcepts.map((row) => <em key={row.label}>{row.label}</em>)}</div></div>}

    <div className="atp-actions">
      {status === "AWAITING_WORKSHEET" && <button className="btn btn-sm btn-outline-primary" onClick={() => goCreate("worksheet", "topic-practice")}><i className="bi bi-stars me-1" />Create Worksheet</button>}
      {status === "AWAITING_ASSESSMENT" && <button className="btn btn-sm btn-outline-primary" onClick={() => goCreate("test", "topic-assessment")}><i className="bi bi-stars me-1" />Create Assessment</button>}
      {status === "NEEDS_REINFORCEMENT" && <><button className="btn btn-sm btn-outline-primary" onClick={() => goCreate("worksheet", "remedial")}><i className="bi bi-stars me-1" />Remedial Worksheet</button><button className="btn btn-sm btn-primary" onClick={() => goCreate("test", "reassessment")}><i className="bi bi-arrow-repeat me-1" />Re-assessment</button></>}
      <button className="btn btn-sm btn-link ms-auto" disabled={loading} onClick={load}><i className="bi bi-arrow-clockwise me-1" />Refresh</button>
    </div>
  </section>;
}

function Evidence({ label, value, ok }) {
  return <div className={ok ? "is-ready" : ""}><i className={`bi ${ok ? "bi-check-circle-fill" : "bi-circle"}`} /><span>{label}</span><strong>{value}</strong></div>;
}
