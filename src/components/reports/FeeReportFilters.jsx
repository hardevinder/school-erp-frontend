import React, { useEffect, useState } from "react";
import api from "../../api";
import "./FeeReports.css";

import { reportDate } from "../../utils/feeReport";
export { reportDate, sessionOf, receiptKey, downloadReport } from "../../utils/feeReport";

export function useFeeReportFilters() {
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState("all");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [applied, setApplied] = useState(null);
  useEffect(() => {
    let active = true;
    api.get("/sessions").then(({ data }) => {
      if (!active) return;
      const rows = Array.isArray(data) ? data : data?.sessions || data?.data || [];
      setSessions(rows);
      const current = rows.find((s) => s.is_active === true || s.is_active === 1 || s.isActive === true);
      setSessionId(current ? String(current.id) : "all");
    }).catch(() => { if (active) setSessionError("Could not load sessions. Refresh the page to retry; All sessions is still available."); })
      .finally(() => { if (active) setSessionLoading(false); });
    return () => { active = false; };
  }, []);
  const sessionLabel = sessionId === "all" ? "All sessions" : sessions.find((s) => String(s.id) === sessionId)?.name || `Session ${sessionId}`;
  const params = { startDate: reportDate(startDate), endDate: reportDate(endDate), session_id: sessionId };
  const dirty = !applied || Object.keys(params).some((key) => params[key] !== applied[key]);
  const valid = Boolean(startDate && endDate && params.startDate <= params.endDate);
  const snapshot = () => ({ ...params, sessionLabel });
  const fileTag = (applied?.sessionLabel || sessionLabel).replace(/[^a-zA-Z0-9_-]/g, "_");
  return { startDate, setStartDate, endDate, setEndDate, sessions, sessionId, setSessionId, sessionLoading, sessionError, sessionLabel, params, dirty, valid, applied, setApplied, snapshot, fileTag };
}

export default function FeeReportFilters({ filters, loading, onGenerate }) {
  const { startDate, setStartDate, endDate, setEndDate, sessions, sessionId, setSessionId, sessionLoading, sessionError, applied, dirty } = filters;
  const quickRange = (month) => {
    const today = new Date(); setEndDate(today);
    setStartDate(month ? new Date(today.getFullYear(), today.getMonth(), 1) : today);
  };
  return <section className="fee-report-filters" aria-label="Fee report filters">
    <fieldset disabled={loading || sessionLoading}>
      <div className="fee-report-filter-grid">
        <label><span>Academic session</span><select className="form-select" value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="all">All sessions</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " · Current" : ""}</option>)}</select></label>
        <label><span>From date</span><input className="form-control" type="date" value={reportDate(startDate)} onChange={(e) => setStartDate(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)} /></label>
        <label><span>To date</span><input className="form-control" type="date" min={reportDate(startDate)} value={reportDate(endDate)} onChange={(e) => setEndDate(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null)} /></label>
        <button type="button" className="btn btn-primary" onClick={onGenerate} disabled={!filters.valid}>{loading ? "Generating…" : sessionLoading ? "Loading sessions…" : "Generate report"}</button>
      </div>
      <div className="fee-report-shortcuts"><span>Quick dates</span><button type="button" onClick={() => quickRange(false)}>Today</button><button type="button" onClick={() => quickRange(true)}>This month</button><small>Dates use the payment transaction date. Session uses the fee transaction’s academic session.</small></div>
    </fieldset>
    {sessionError && <p className="text-danger mt-2 mb-0" role="alert">{sessionError}</p>}
    {!filters.valid && <p className="text-danger mt-2 mb-0" role="alert">Choose both dates, with the end date on or after the start date.</p>}
    <div className="fee-report-scope" role="status">{applied ? <><strong>{applied.sessionLabel}</strong><span>{applied.startDate} — {applied.endDate}</span>{dirty && <b>Filters changed — generate the report to update data and exports.</b>}</> : "Choose a session and date range, then generate your report."}</div>
  </section>;
}
