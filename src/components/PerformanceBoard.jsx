import React, { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import api from "../api";

const color = score => score >= 85 ? "#129b81" : score >= 70 ? "#5875dc" : score >= 55 ? "#bd7a19" : "#cf596a";

function TeacherPhoto({ teacher }) {
  const [failed, setFailed] = useState(null);
  const raw = teacher?.photo_url;
  const base = String(api.defaults.baseURL || window.location.origin).replace(/\/api\/?$/, "").replace(/\/$/, "");
  const path = String(raw || "").replace(/^\/+/, "");
  const src = !raw ? null : /^https?:\/\//i.test(raw) ? raw : `${base}/${path.startsWith("uploads/") ? path : `uploads/${path}`}`;
  return <div className="pb-avatar">{src && failed !== src ? <img src={src} alt={teacher?.name || "Teacher"} onError={() => setFailed(src)} /> : <span aria-label="Teacher initials">{(teacher?.name || "Teacher").split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("")}</span>}</div>;
}

export default function PerformanceBoard({ dashboard, teacher, trend, autoRefresh, onToggleRefresh, lastUpdated, refreshError, onComponent }) {
  const components = dashboard.components || [];
  const scored = components.filter(c => c.score != null && Number.isFinite(Number(c.score)));
  const strongest = [...scored].sort((a, b) => Number(b.score) - Number(a.score))[0];
  const opportunity = [...scored].sort((a, b) => Number(a.score) - Number(b.score))[0];
  const score = dashboard.overall_score == null ? null : Number(dashboard.overall_score);
  const delta = dashboard.previous_snapshot_score == null ? null : Number(dashboard.delta_from_previous_snapshot || 0);
  const history = [...trend].filter(r => r.overall_score != null).sort((a, b) => String(a.snapshot_date).localeCompare(String(b.snapshot_date))).map(r => ({ date: r.snapshot_date, score: Number(r.overall_score) }));
  return <section className="performance-board mb-4" aria-label="Teacher performance board">
    <div className="pb-hero">
      <div className="pb-profile"><TeacherPhoto teacher={teacher || dashboard.teacher} /><div><div className="pb-kicker">PROFESSIONAL GROWTH</div><h3>{teacher?.name || dashboard.teacher?.name || "Teacher"}</h3><p>{teacher?.designation || dashboard.teacher?.designation || "Teacher"}{teacher?.employee_id ? ` · ${teacher.employee_id}` : ""}</p><span className="pb-period">{dashboard.period?.start} — {dashboard.period?.end}</span></div></div>
      <div className="pb-score" style={{ "--score-color": color(score), "--score-angle": `${Math.max(0, Math.min(100, score || 0)) * 3.6}deg` }}><div><strong>{score == null ? "—" : score.toFixed(1)}</strong><span>OUT OF 100</span></div></div>
      <div className="pb-summary"><div className="pb-kicker">PROFESSIONAL GROWTH SCORE</div><h4>{dashboard.provisional ? "Evidence is building" : "Your progress, at a glance"}</h4><p>{delta == null ? "Your first snapshot sets the baseline." : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} points from previous snapshot`}</p><span className="pb-period">{dashboard.provisional ? "Provisional score" : "Evidence-based score"}</span></div>
    </div>
    <div className="pb-status"><span role="status"><i className={`pb-dot ${refreshError || !autoRefresh ? "paused" : ""}`} />{refreshError ? "Update delayed" : autoRefresh ? "Auto-refresh · every 60 seconds" : "Auto-refresh paused"}{lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}</span><button type="button" onClick={onToggleRefresh} aria-pressed={autoRefresh}>{autoRefresh ? "Pause updates" : "Resume updates"}</button></div>
    {refreshError && <div className="alert alert-warning m-3" role="alert">{refreshError}</div>}
    <div className="pb-stats">
      <div><i className="bi bi-shield-check" aria-hidden="true" /><span>Evidence coverage<strong>{Number(dashboard.coverage_percent || 0).toFixed(1)}<small>%</small></strong></span></div>
      <div><i className="bi bi-grid" aria-hidden="true" /><span>Scored components<strong>{scored.length}<small> / {components.length}</small></strong></span></div>
      <div><i className="bi bi-stars" aria-hidden="true" /><span>Strongest area<strong className="pb-stat-label">{strongest?.label || "Awaiting evidence"}</strong></span></div>
      <div><i className="bi bi-compass" aria-hidden="true" /><span>Growth opportunity<strong className="pb-stat-label">{opportunity?.label || "Awaiting evidence"}</strong></span></div>
    </div>
    <div className="pb-charts">
      <div className="pb-chart"><div className="pb-chart-title"><div><h5>Performance across areas</h5><p>Select an area to explore its calculation.</p></div><span>/ 100</span></div><div className="pb-bars">{components.map(c => <button type="button" key={c.code} onClick={() => onComponent(c)} className="pb-bar-row" aria-label={`${c.label}: ${c.score == null ? "Not applicable" : Number(c.score).toFixed(1)}. View calculation`}><span>{c.label}</span><span className="pb-track"><span style={{ width: `${Math.max(0, Math.min(100, Number(c.score || 0)))}%`, background: color(Number(c.score)) }} /></span><b>{c.score == null ? "N/A" : Number(c.score).toFixed(1)}</b></button>)}</div>{!components.length && <p className="pb-empty">Component evidence will appear here when available.</p>}</div>
      <div className="pb-chart"><div className="pb-chart-title"><div><h5>Growth over time</h5><p>Saved score snapshots for the selected period.</p></div><i className="bi bi-graph-up-arrow" aria-hidden="true" /></div>{history.length ? <><div className="pb-history" role="img" aria-label={`Score history: ${history.map(r => `${r.date}: ${r.score.toFixed(1)}`).join(", ")}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={history} margin={{ top: 15, right: 15, bottom: 5, left: -20 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e3e8ef" /><XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} tick={{ fontSize: 11 }} minTickGap={25} axisLine={false} tickLine={false} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={value => [Number(value).toFixed(1), "Score"]} /><Area type="linear" dataKey="score" stroke="#5875dc" fill="#5875dc" fillOpacity={0.12} strokeWidth={3} dot={{ r: 4, fill: "#5875dc", stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div><p className="pb-chart-note">{history.length === 1 ? "First snapshot recorded. Future snapshots will show your progress." : `${history.length} snapshots · scores out of 100`}</p></> : <div className="pb-empty"><i className="bi bi-graph-up" /><h6>Your growth story starts here</h6><p>Saved snapshots will appear as they become available.</p></div>}</div>
    </div>
  </section>;
}
