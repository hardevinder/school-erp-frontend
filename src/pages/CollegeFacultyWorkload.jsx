import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import "./CollegeFacultyWorkload.css";

const fmt = (v) => Number(v || 0).toFixed(2).replace(/\.00$/, "");
const statusLabel = (s) => ({ balanced: "Balanced", underloaded: "Underloaded", overloaded: "Overloaded" }[s] || s || "—");
const statusTone = (s) => ({ balanced: "success", underloaded: "warning", overloaded: "danger" }[s] || "secondary");
const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function Metric({ icon, label, value, hint, tone = "primary" }) {
  return <div className="col-6 col-xl">
    <div className="cfw-metric card border-0 shadow-sm h-100">
      <div className={`cfw-metric-icon text-bg-${tone}`}><i className={`bi ${icon}`} /></div>
      <div><div className="cfw-metric-label">{label}</div><div className="cfw-metric-value">{value}</div>{hint && <div className="cfw-metric-hint">{hint}</div>}</div>
    </div>
  </div>;
}

function FacultyDetail({ id, canManage, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ target_weekly_hours: 18, minimum_weekly_hours: 14, maximum_weekly_hours: 22, notes: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: res } = await api.get(`/college-faculty-workload/faculty/${id}`);
      setData(res);
      const f = res?.faculty || {};
      setForm({
        target_weekly_hours: f.target_weekly_hours ?? 18,
        minimum_weekly_hours: f.minimum_weekly_hours ?? 14,
        maximum_weekly_hours: f.maximum_weekly_hours ?? 22,
        notes: f.notes || "",
      });
    } catch (e) { setError(e.response?.data?.message || "Unable to load faculty workload detail."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      await api.put(`/college-faculty-workload/faculty/${id}/settings`, form);
      setEditing(false); await load(); onSaved?.();
    } catch (e2) { setError(e2.response?.data?.message || "Unable to save workload target."); }
    finally { setSaving(false); }
  };

  const grouped = useMemo(() => {
    const map = new Map(dayOrder.map((d) => [d, []]));
    (data?.assignments || []).forEach((a) => {
      const key = dayOrder.find((d) => d.toLowerCase() === String(a.day || "").toLowerCase()) || a.day || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map.entries()].filter(([, rows]) => rows.length);
  }, [data]);

  return <div className="cfw-detail card border-0 shadow-sm mt-4">
    <div className="card-header bg-white border-0 d-flex align-items-start justify-content-between gap-3 p-4">
      <div><div className="cfw-kicker">Faculty workload detail</div><h2 className="h4 mb-1">{data?.faculty?.name || "Faculty"}</h2><div className="text-muted small">{data?.faculty?.designation || "Faculty"}{data?.faculty?.department_name ? ` · ${data.faculty.department_name}` : ""}</div></div>
      <div className="d-flex gap-2">{canManage && !loading && <button className="btn btn-outline-primary btn-sm" onClick={() => setEditing((v) => !v)}><i className="bi bi-sliders me-1" />Targets</button>}<button className="btn btn-light btn-sm" onClick={onClose}><i className="bi bi-x-lg" /></button></div>
    </div>
    <div className="card-body p-4 pt-0">
      {error && <div className="alert alert-danger">{error}</div>}
      {loading ? <div className="cfw-loading"><div className="spinner-border text-primary" /><span>Loading workload…</span></div> : <>
        <div className="row g-3 mb-4">
          <Metric icon="bi-clock-history" label="Contact Hours" value={fmt(data?.faculty?.weekly_contact_hours)} hint={`${data?.faculty?.weekly_periods || 0} periods / week`} />
          <Metric icon="bi-easel2" label="Lecture" value={fmt(data?.faculty?.lecture_hours)} tone="info" />
          <Metric icon="bi-pc-display" label="Practical / Lab" value={fmt(data?.faculty?.practical_hours)} tone="success" />
          <Metric icon="bi-people" label="Tutorial" value={fmt(data?.faculty?.tutorial_hours)} tone="warning" />
          <Metric icon="bi-arrow-repeat" label="Extra This Week" value={data?.faculty?.extra_periods_this_week || 0} hint={`${fmt(data?.faculty?.extra_hours_this_week)} hrs`} tone="secondary" />
        </div>

        {editing && canManage && <form onSubmit={save} className="cfw-target-form mb-4">
          <div className="row g-3 align-items-end">
            <div className="col-md-2"><label className="form-label">Target hrs/week</label><input className="form-control" type="number" min="0" max="80" step="0.25" value={form.target_weekly_hours} onChange={(e) => setForm({ ...form, target_weekly_hours: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Minimum</label><input className="form-control" type="number" min="0" max="80" step="0.25" value={form.minimum_weekly_hours} onChange={(e) => setForm({ ...form, minimum_weekly_hours: e.target.value })} /></div>
            <div className="col-md-2"><label className="form-label">Maximum</label><input className="form-control" type="number" min="0" max="80" step="0.25" value={form.maximum_weekly_hours} onChange={(e) => setForm({ ...form, maximum_weekly_hours: e.target.value })} /></div>
            <div className="col-md"><label className="form-label">Notes</label><input className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional workload note" /></div>
            <div className="col-md-auto"><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save Targets"}</button></div>
          </div>
        </form>}

        <div className="cfw-threshold mb-4"><span>Recommended target</span><strong>{fmt(data?.faculty?.target_weekly_hours)} hrs</strong><span>Balanced range</span><strong>{fmt(data?.faculty?.minimum_weekly_hours)}–{fmt(data?.faculty?.maximum_weekly_hours)} hrs</strong><span className={`badge text-bg-${statusTone(data?.faculty?.workload_status)}`}>{statusLabel(data?.faculty?.workload_status)}</span></div>

        <h3 className="h6 mb-3">Weekly timetable load</h3>
        {!grouped.length ? <div className="cfw-empty">No timetable assignment found for this faculty member.</div> : <div className="cfw-day-grid">{grouped.map(([day, rows]) => <div className="cfw-day" key={day}><div className="cfw-day-head"><strong>{day}</strong><span>{fmt(rows.reduce((s, r) => s + Number(r.hours || 0), 0))} hrs</span></div>{rows.map((a, idx) => <div className="cfw-slot" key={`${a.source_id}-${a.slot_no}-${idx}`}><div><strong>{a.subject_name}</strong><small>{a.program_semester} · {a.batch_section}</small></div><div className="text-end"><span>{a.period_name}</span><small>{a.start_time || ""}{a.end_time ? ` – ${a.end_time}` : ""}</small></div><span className={`cfw-type cfw-type-${a.type}`}>{a.type}</span></div>)}</div>)}</div>}
      </>}
    </div>
  </div>;
}

export default function CollegeFacultyWorkload() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [meta, setMeta] = useState({ departments: [] });
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ q: "", department_id: "", status: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
      const [{ data }, { data: metaData }] = await Promise.all([
        api.get("/college-faculty-workload/overview", { params }),
        api.get("/college-faculty-workload/meta"),
      ]);
      setRows(data?.faculty || []); setSummary(data?.summary || {}); setCanManage(!!data?.can_manage); setMeta(metaData || { departments: [] });
    } catch (e) { setError(e.response?.data?.message || "Unable to load faculty workload."); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { const t = setTimeout(load, 220); return () => clearTimeout(t); }, [load]);

  return <div className="container-fluid py-4 cfw-page">
    <section className="cfw-hero mb-4"><div><div className="cfw-kicker">College Academics · Faculty Planning</div><h1>Faculty Workload</h1><p>Automatic weekly teaching load from the published timetable, with department filters, workload targets and overload alerts.</p></div><div className="cfw-hero-icon"><i className="bi bi-person-workspace" /></div></section>

    {error && <div className="alert alert-danger">{error}</div>}

    <div className="row g-3 mb-4">
      <Metric icon="bi-people-fill" label="Faculty" value={summary.faculty || 0} hint={`${summary.weekly_periods || 0} scheduled periods`} />
      <Metric icon="bi-check-circle-fill" label="Balanced" value={summary.balanced || 0} tone="success" />
      <Metric icon="bi-arrow-down-circle-fill" label="Underloaded" value={summary.underloaded || 0} tone="warning" />
      <Metric icon="bi-exclamation-triangle-fill" label="Overloaded" value={summary.overloaded || 0} tone="danger" />
      <Metric icon="bi-clock-fill" label="Contact Hours" value={fmt(summary.weekly_contact_hours)} hint={`${summary.extra_periods_this_week || 0} extra periods this week`} tone="info" />
    </div>

    <section className="card border-0 shadow-sm cfw-table-card">
      <div className="cfw-toolbar">
        <div><h2 className="h5 mb-1">Weekly Faculty Load</h2><p className="mb-0">Lecture, lab and tutorial hours are derived from timetable assignments.</p></div>
        <div className="cfw-filters">
          <div className="input-group input-group-sm"><span className="input-group-text"><i className="bi bi-search" /></span><input className="form-control" value={filters.q} placeholder="Search faculty…" onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></div>
          <select className="form-select form-select-sm" value={filters.department_id} onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}><option value="">All departments</option>{(meta.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          <select className="form-select form-select-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All loads</option><option value="balanced">Balanced</option><option value="underloaded">Underloaded</option><option value="overloaded">Overloaded</option></select>
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setFilters({ q: "", department_id: "", status: "" })}>Clear</button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table align-middle mb-0 cfw-table">
          <thead><tr><th>Faculty</th><th>Department</th><th className="text-center">Papers</th><th className="text-center">Periods</th><th>Weekly Hours</th><th>Load Mix</th><th>Target Range</th><th>Status</th><th className="text-end">Action</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="9"><div className="cfw-loading"><div className="spinner-border spinner-border-sm text-primary" /><span>Calculating timetable workload…</span></div></td></tr> : rows.length ? rows.map((f) => <tr key={f.id}>
              <td><div className="cfw-faculty"><div className="cfw-avatar">{String(f.name || "F").split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}</div><div><strong>{f.name}</strong><small>{f.designation || f.employee_id || "Faculty"}</small></div></div></td>
              <td><strong className="fw-semibold">{f.department_name || "—"}</strong><small className="d-block text-muted">{f.programs_count || 0} programs · {f.batches_count || 0} batches</small></td>
              <td className="text-center">{f.papers_count || 0}</td><td className="text-center">{f.weekly_periods || 0}</td>
              <td><strong>{fmt(f.weekly_contact_hours)} hrs</strong>{f.extra_periods_this_week > 0 && <small className="d-block text-primary">+ {f.extra_periods_this_week} extra this week</small>}</td>
              <td><div className="cfw-mix"><span title="Lecture"><i className="bi bi-easel2" /> {fmt(f.lecture_hours)}</span><span title="Practical / Lab"><i className="bi bi-pc-display" /> {fmt(f.practical_hours)}</span><span title="Tutorial"><i className="bi bi-people" /> {fmt(f.tutorial_hours)}</span></div></td>
              <td><strong>{fmt(f.minimum_weekly_hours)}–{fmt(f.maximum_weekly_hours)}</strong><small className="d-block text-muted">Target {fmt(f.target_weekly_hours)}</small></td>
              <td><span className={`badge rounded-pill text-bg-${statusTone(f.workload_status)}`}>{statusLabel(f.workload_status)}</span></td>
              <td className="text-end"><button className="btn btn-outline-primary btn-sm" onClick={() => { setSelected(f.id); setTimeout(() => document.getElementById("faculty-workload-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>View</button></td>
            </tr>) : <tr><td colSpan="9"><div className="cfw-empty">No faculty matched the selected filters.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>

    <div id="faculty-workload-detail">{selected && <FacultyDetail id={selected} canManage={canManage} onClose={() => setSelected(null)} onSaved={load} />}</div>
  </div>;
}
