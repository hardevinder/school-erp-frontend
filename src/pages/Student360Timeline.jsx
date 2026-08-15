import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { getStudent360Timeline } from "../services/student360TimelineApi";
import "./Student360Timeline.css";

const RANGE_OPTIONS = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
];

const apiBase = (() => {
  const b = api?.defaults?.baseURL;
  return b ? b.replace(/\/+$/, "") : window.location.origin;
})();

const photoUrl = (name) => name ? `${apiBase}/uploads/photoes/students/${encodeURIComponent(name)}` : "";
const fmtDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const monthLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "";
const startDateFor = (days) => {
  if (!days) return "";
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

function SeverityBadge({ value }) {
  if (!value) return null;
  const map = { success: "success", warning: "warning", danger: "danger", info: "secondary" };
  return <span className={`badge text-bg-${map[value] || "secondary"}`}>{value}</span>;
}

export default function Student360Timeline() {
  const { studentId } = useParams();
  const [range, setRange] = useState("365");
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [includeRoutine, setIncludeRoutine] = useState(false);
  const [data, setData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const selectedRange = RANGE_OPTIONS.find((x) => x.key === range) || RANGE_OPTIONS[2];
  const paramsBase = useMemo(() => ({
    from: startDateFor(selectedRange.days) || undefined,
    categories: categories.length ? categories.join(",") : undefined,
    q: q || undefined,
    include_routine: includeRoutine ? 1 : undefined,
    limit: 60,
  }), [selectedRange.days, categories, q, includeRoutine]);

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getStudent360Timeline(studentId, { ...paramsBase, offset: 0 })
      .then((res) => {
        if (!alive) return;
        setData(res);
        setEvents(res.events || []);
      })
      .catch((e) => alive && setError(e.response?.data?.message || "Unable to load Student 360 timeline"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [studentId, paramsBase]);

  const toggleCategory = (key) => {
    setCategories((current) => current.includes(key) ? current.filter((x) => x !== key) : [...current, key]);
  };

  const loadMore = async () => {
    if (!data?.pagination?.has_more || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getStudent360Timeline(studentId, { ...paramsBase, offset: events.length });
      setEvents((current) => [...current, ...(res.events || [])]);
      setData((current) => ({ ...current, pagination: res.pagination, stats: res.stats, availability: res.availability }));
    } catch (e) {
      setError(e.response?.data?.message || "Unable to load more timeline events");
    } finally {
      setLoadingMore(false);
    }
  };

  const grouped = useMemo(() => {
    const groups = [];
    events.forEach((item) => {
      const label = monthLabel(item.date);
      let group = groups[groups.length - 1];
      if (!group || group.label !== label) {
        group = { label, items: [] };
        groups.push(group);
      }
      group.items.push(item);
    });
    return groups;
  }, [events]);

  const student = data?.student;
  const meta = data?.category_meta || {};
  const unavailable = Object.entries(data?.availability || {}).filter(([, ok]) => !ok).map(([key]) => key.replaceAll("_", " "));

  if (loading && !data) return <div className="s360-loading"><div className="spinner-border text-primary"/><span>Building the student's 360° journey…</span></div>;

  return <div className="s360-page">
    {error && <div className="alert alert-danger">{error}</div>}

    <section className="s360-hero">
      <div className="s360-student">
        <div className="s360-photo-wrap">
          {student?.photo ? <img src={photoUrl(student.photo)} alt={student?.name || "Student"} /> : <div className="s360-photo-placeholder"><i className="bi bi-person"/></div>}
        </div>
        <div>
          <div className="s360-kicker">Global Student 360° Timeline</div>
          <h2>{student?.name || "Student Journey"}</h2>
          <div className="s360-subline">
            {student?.admission_number && <span>Adm. {student.admission_number}</span>}
            {student?.roll_number && <span>Roll {student.roll_number}</span>}
            {(student?.class?.name || student?.section?.name) && <span>{[student?.class?.name, student?.section?.name].filter(Boolean).join(" - ")}</span>}
          </div>
        </div>
      </div>
      <div className="s360-hero-stats">
        <div><b>{data?.stats?.total_events || 0}</b><span>Events</span></div>
        <div><b>{data?.stats?.attention_events || 0}</b><span>Needs attention</span></div>
        <div><b>{Object.values(data?.stats?.category_counts || {}).filter((v) => Number(v) > 0).length}</b><span>Active areas</span></div>
      </div>
    </section>

    <section className="s360-toolbar card border-0 shadow-sm">
      <div className="s360-ranges">
        {RANGE_OPTIONS.map((opt) => <button key={opt.key} className={`btn btn-sm ${range === opt.key ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setRange(opt.key)}>{opt.label}</button>)}
      </div>
      <div className="s360-search input-group input-group-sm">
        <span className="input-group-text"><i className="bi bi-search"/></span>
        <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests, observations, documents…" />
      </div>
      <label className="s360-routine form-check form-switch mb-0">
        <input className="form-check-input" type="checkbox" checked={includeRoutine} onChange={(e) => setIncludeRoutine(e.target.checked)} />
        <span className="form-check-label">Show routine daily records</span>
      </label>
      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => window.print()}><i className="bi bi-printer me-1"/>Print / Save PDF</button>
    </section>

    <section className="s360-category-strip">
      {Object.entries(meta).map(([key, item]) => {
        const count = data?.stats?.category_counts?.[key] || 0;
        const active = categories.includes(key);
        return <button type="button" key={key} className={`s360-category ${active ? "active" : ""}`} onClick={() => toggleCategory(key)}>
          <i className={`bi ${item.icon || "bi-circle"}`}/><span>{item.label || key}</span><b>{count}</b>
        </button>;
      })}
      {categories.length > 0 && <button className="btn btn-sm btn-link text-decoration-none" onClick={() => setCategories([])}>Clear filters</button>}
    </section>

    {unavailable.length > 0 && <div className="alert alert-light border s360-unavailable"><i className="bi bi-info-circle me-2"/>Some newer modules are not migrated/available yet: <strong>{unavailable.join(", ")}</strong>. The rest of the timeline is still shown.</div>}

    {loading && data && <div className="progress s360-progress"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: "100%" }}/></div>}

    {!loading && events.length === 0 ? <div className="s360-empty card border-0 shadow-sm"><i className="bi bi-clock-history"/><h4>No matching timeline events</h4><p>Try a wider date range, clear filters, or enable routine daily records.</p></div> : null}

    <div className="s360-timeline">
      {grouped.map((group) => <section key={group.label} className="s360-month">
        <div className="s360-month-label"><span>{group.label}</span></div>
        <div className="s360-events">
          {group.items.map((item) => <article key={item.id} className={`s360-event sev-${item.severity || "info"}`}>
            <div className="s360-icon"><i className={`bi ${item.icon || "bi-circle"}`}/></div>
            <div className="s360-event-body">
              <div className="s360-event-top">
                <div>
                  <span className="s360-cat">{item.category_label}</span>
                  <h5>{item.title}</h5>
                </div>
                <div className="s360-date">{fmtDate(item.date)}<SeverityBadge value={item.severity}/></div>
              </div>
              {item.subtitle && <div className="s360-subtitle">{item.subtitle}</div>}
              {item.detail && <p>{item.detail}</p>}
              {item.meta?.follow_up && <div className="s360-followup"><i className="bi bi-arrow-return-right me-1"/><strong>Follow-up:</strong> {item.meta.follow_up}{item.meta.follow_up_due_at ? ` • Due ${fmtDate(item.meta.follow_up_due_at)}` : ""}</div>}
              <div className="s360-source">Source: {String(item.source || "ERP").replaceAll("_", " ")}{item.status ? ` • ${String(item.status).replaceAll("_", " ")}` : ""}</div>
            </div>
          </article>)}
        </div>
      </section>)}
    </div>

    {data?.pagination?.has_more && <div className="text-center py-3"><button className="btn btn-outline-primary" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Loading…" : "Load more history"}</button></div>}
  </div>;
}
