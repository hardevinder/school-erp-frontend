import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import actionInboxApi from "../services/actionInboxApi";
import "./UnifiedActionInbox.css";

const CATEGORY_TABS = [
  ["all", "All"],
  ["approval", "Approvals"],
  ["review", "Reviews"],
  ["task", "My Tasks"],
  ["follow_up", "Follow-ups"],
];

const PRIORITY_LABEL = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

const SOURCE_ICONS = {
  department_task: "bi-list-task",
  employee_leave: "bi-calendar2-check",
  syllabus_approval: "bi-journal-check",
  document_verification: "bi-shield-check",
  official_document_approval: "bi-envelope-check",
  parent_consent_scan: "bi-pen",
  lost_found_claim: "bi-search",
  student_recognition: "bi-trophy",
  assessment_review: "bi-clipboard2-check",
  exam_recheck: "bi-arrow-repeat",
  discipline_review: "bi-exclamation-octagon",
  health_followup: "bi-heart-pulse",
};

function number(value) {
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function displayDate(value) {
  if (!value) return "";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function SummaryCard({ icon, label, value, tone }) {
  return <div className={`uai-summary uai-${tone}`}>
    <span className="uai-summary-icon"><i className={`bi ${icon}`} /></span>
    <div><strong>{number(value)}</strong><span>{label}</span></div>
  </div>;
}

function PriorityPill({ priority }) {
  return <span className={`uai-priority ${priority || "normal"}`}><span />{PRIORITY_LABEL[priority] || "Normal"}</span>;
}

function ActionCard({ item, onOpen }) {
  return <article className={`uai-item priority-${item.priority || "normal"}`}>
    <div className="uai-item-icon"><i className={`bi ${SOURCE_ICONS[item.source] || "bi-inbox"}`} /></div>
    <div className="uai-item-body">
      <div className="uai-item-top">
        <div className="uai-item-tags">
          <span className="uai-source">{item.source_label}</span>
          <PriorityPill priority={item.priority} />
          <span className="uai-status">{item.status_label}</span>
        </div>
        {item.due_at && <span className={`uai-due ${item.due_at < new Date().toISOString().slice(0, 10) ? "overdue" : ""}`}>
          <i className="bi bi-clock me-1" />Due {displayDate(item.due_at)}
        </span>}
      </div>
      <h5>{item.title}</h5>
      {item.subtitle && <div className="uai-subtitle">{item.subtitle}</div>}
      {item.description && <p>{item.description}</p>}
      <div className="uai-item-footer">
        <div>
          {item.subject?.name && <span className="uai-person"><i className="bi bi-person-circle" />{item.subject.name}{item.subject.meta ? ` • ${item.subject.meta}` : ""}</span>}
          {item.created_at && <span className="uai-created"><i className="bi bi-calendar3" />{new Date(item.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => onOpen(item.route)}>{item.action_label || "Open"}<i className="bi bi-arrow-right ms-2" /></button>
      </div>
    </div>
  </article>;
}

export default function UnifiedActionInbox() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await actionInboxApi.list({ category, source, priority, search, limit: 250 });
      setData(response.data || null);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Unable to load Action & Approval Inbox.");
    } finally { setLoading(false); }
  }, [category, source, priority, search]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const activeSources = useMemo(() => (data?.sources || []).filter((x) => Number(x.count || 0) > 0), [data?.sources]);
  const unavailable = useMemo(() => Object.entries(data?.availability || {}).filter(([, ready]) => ready === false).length, [data?.availability]);

  const submitSearch = (e) => { e.preventDefault(); setSearch(searchDraft.trim()); };
  const clearFilters = () => { setCategory("all"); setSource("all"); setPriority("all"); setSearch(""); setSearchDraft(""); };

  return <div className="uai-page">
    <section className="uai-hero">
      <div>
        <div className="uai-kicker"><i className="bi bi-inboxes-fill" />Unified Workflow</div>
        <h1>My Actions & Approvals</h1>
        <p>One inbox for approvals, reviews, assigned tasks and follow-ups across the ERP.</p>
      </div>
      <div className="d-flex gap-2">
        <button className="btn btn-light" onClick={load} disabled={loading}><i className={`bi ${loading ? "bi-arrow-repeat uai-spin" : "bi-arrow-clockwise"} me-2`} />Refresh</button>
      </div>
    </section>

    {error && <div className="alert alert-danger d-flex justify-content-between align-items-center"><span>{error}</span><button className="btn btn-outline-danger btn-sm" onClick={load}>Retry</button></div>}

    <section className="uai-summary-grid">
      <SummaryCard icon="bi-inbox-fill" label="Pending Actions" value={summary.total} tone="blue" />
      <SummaryCard icon="bi-check2-square" label="Approvals" value={summary.approvals} tone="violet" />
      <SummaryCard icon="bi-exclamation-triangle-fill" label="High Priority" value={summary.high_priority} tone="orange" />
      <SummaryCard icon="bi-clock-history" label="Overdue" value={summary.overdue} tone="rose" />
      <SummaryCard icon="bi-list-task" label="My Assigned Tasks" value={summary.my_tasks} tone="green" />
    </section>

    <section className="uai-toolbar card border-0 shadow-sm">
      <div className="uai-tabs">
        {CATEGORY_TABS.map(([value, label]) => <button key={value} type="button" className={category === value ? "active" : ""} onClick={() => setCategory(value)}>{label}{value !== "all" && summary.category_counts?.[value] ? <span>{summary.category_counts[value]}</span> : null}</button>)}
      </div>
      <div className="uai-filters">
        <select className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All modules</option>
          {activeSources.map((x) => <option key={x.value} value={x.value}>{x.label} ({x.count})</option>)}
        </select>
        <select className="form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
        </select>
        <form className="uai-search" onSubmit={submitSearch}><i className="bi bi-search" /><input value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search action, student, teacher…" /><button type="submit">Search</button></form>
        {(category !== "all" || source !== "all" || priority !== "all" || search) && <button className="btn btn-outline-secondary" onClick={clearFilters}>Clear</button>}
      </div>
    </section>

    <section className="uai-content">
      <div className="uai-content-head">
        <div><strong>{number(data?.filtered_total)}</strong> action{Number(data?.filtered_total) === 1 ? "" : "s"} shown</div>
        <div className="text-muted small"><i className="bi bi-shield-check me-1" />Role-aware • live ERP data{unavailable ? ` • ${unavailable} source${unavailable === 1 ? "" : "s"} not ready` : ""}</div>
      </div>
      {loading && !data ? <div className="uai-loading"><div className="spinner-border" /><span>Collecting pending actions across modules…</span></div> : (data?.actions || []).length ? <div className="uai-list">{data.actions.map((item) => <ActionCard key={item.id} item={item} onOpen={navigate} />)}</div> : <div className="uai-empty"><span><i className="bi bi-check2-circle" /></span><h3>Inbox clear</h3><p>No actions match the current filters.</p>{(category !== "all" || source !== "all" || priority !== "all" || search) && <button className="btn btn-outline-primary" onClick={clearFilters}>Clear filters</button>}</div>}
    </section>
  </div>;
}
