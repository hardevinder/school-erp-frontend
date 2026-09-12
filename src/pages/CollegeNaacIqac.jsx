import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./CollegeNaacIqac.css";

const getRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole");
    return (many.length ? many : [one]).filter(Boolean).map((x) => String(x).toLowerCase());
  } catch (_) { return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean); }
};
const MANAGERS = new Set(["principal", "admin", "superadmin", "super_admin", "academic_coordinator", "coordinator", "iqac_coordinator", "naac_coordinator"]);
const human = (v) => String(v || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const dateOnly = (v) => v ? new Date(`${String(v).slice(0,10)}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" }) : "—";
const tone = (s) => ({ verified: "success", evidence_uploaded: "primary", under_verification: "info", in_progress: "warning", needs_revision: "danger", pending: "secondary", not_applicable: "dark", completed: "success", closed: "success", planned: "secondary", ongoing: "primary", submitted: "warning", rejected: "danger" }[s] || "secondary");

async function downloadBlob(url, filename) {
  const { data } = await api.get(url, { responseType: "blob" });
  const u = URL.createObjectURL(data); const a = document.createElement("a"); a.href = u; a.download = filename || "evidence"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
}

const EMPTY_CYCLE = { title: "NAAC Accreditation Cycle", accreditation_type: "NAAC", cycle_number: "", academic_year_from: "", academic_year_to: "", target_submission_date: "", notes: "", seed_starter_framework: true };
const EMPTY_METRIC = { code: "", title: "", description: "", metric_type: "qualitative", data_source: "manual", auto_source: "", department_id: "", owner_user_id: "", target_date: "", current_value: "", narrative: "" };
const EMPTY_IQAC = { activity_type: "meeting", title: "", activity_date: "", description: "", action_taken: "", owner_user_id: "", status: "planned", next_review_date: "", evidence_url: "" };

export default function CollegeNaacIqac() {
  const { isCollege } = useInstitution();
  const roles = getRoles();
  const manager = roles.some((r) => MANAGERS.has(r));
  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState([]);
  const [cycleId, setCycleId] = useState("");
  const [cycle, setCycle] = useState(null);
  const [dashboard, setDashboard] = useState({ counts: {}, criteria: [], evidence: {}, iqac: {}, readiness_percent: 0 });
  const [meta, setMeta] = useState({ departments: [], users: [], auto_sources: [] });
  const [iqac, setIqac] = useState([]);
  const [tab, setTab] = useState("overview");
  const [cycleModal, setCycleModal] = useState(false);
  const [cycleForm, setCycleForm] = useState(EMPTY_CYCLE);
  const [metricTarget, setMetricTarget] = useState(null);
  const [metricForm, setMetricForm] = useState(EMPTY_METRIC);
  const [evidenceMetric, setEvidenceMetric] = useState(null);
  const [iqacModal, setIqacModal] = useState(false);
  const [iqacForm, setIqacForm] = useState(EMPTY_IQAC);

  const loadCycle = useCallback(async (id) => {
    if (!id) { setCycle(null); return; }
    const [{ data: detail }, { data: dash }, { data: iq }] = await Promise.all([
      api.get(`/naac-iqac/cycles/${id}`),
      api.get("/naac-iqac/dashboard", { params: { cycle_id: id } }),
      api.get("/naac-iqac/iqac", { params: { cycle_id: id } }),
    ]);
    setCycle(detail?.cycle || null); setDashboard(dash || {}); setIqac(iq?.activities || []);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: c }, { data: m }] = await Promise.all([api.get("/naac-iqac/cycles"), api.get("/naac-iqac/meta")]);
      const list = c?.cycles || []; setCycles(list); setMeta(m || {});
      const selected = cycleId || (list[0]?.id ? String(list[0].id) : "");
      if (selected) { setCycleId(selected); await loadCycle(selected); }
      else { const { data: dash } = await api.get("/naac-iqac/dashboard"); setDashboard(dash || {}); setCycle(null); setIqac([]); }
    } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, [cycleId, loadCycle]);

  useEffect(() => { if (isCollege) load(); }, [isCollege]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cycleId && cycles.length) loadCycle(cycleId).catch(() => {}); }, [cycleId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isCollege) return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">NAAC / IQAC & Accreditation is available in College mode.</div></div>;

  const createCycle = async () => {
    if (!cycleForm.title.trim()) return Swal.fire("Required", "Cycle title is required.", "warning");
    try {
      const { data } = await api.post("/naac-iqac/cycles", cycleForm);
      setCycleModal(false); setCycleForm(EMPTY_CYCLE); await load();
      if (data?.cycle?.id) setCycleId(String(data.cycle.id));
      Swal.fire("Created", "Accreditation cycle and editable starter workspace created.", "success");
    } catch (e) { Swal.fire("Unable to create", e.response?.data?.message || e.message, "error"); }
  };

  const addCriterion = async () => {
    const { value } = await Swal.fire({ title: "Add Criterion / Area", html: '<input id="n-code" class="swal2-input" placeholder="Code, e.g. 8"><input id="n-title" class="swal2-input" placeholder="Criterion / area title"><textarea id="n-desc" class="swal2-textarea" placeholder="Description (optional)"></textarea>', showCancelButton: true, preConfirm: () => ({ code: document.getElementById("n-code").value, title: document.getElementById("n-title").value, description: document.getElementById("n-desc").value }) });
    if (!value) return; if (!value.code?.trim() || !value.title?.trim()) return Swal.fire("Required", "Code and title are required.", "warning");
    try { await api.post(`/naac-iqac/cycles/${cycle.id}/criteria`, value); await loadCycle(cycle.id); } catch (e) { Swal.fire("Unable to add", e.response?.data?.message || e.message, "error"); }
  };

  const openMetric = (criterion, metric = null) => {
    setMetricTarget({ criterion, metric });
    setMetricForm(metric ? {
      code: metric.code || "", title: metric.title || "", description: metric.description || "", metric_type: metric.metric_type || "qualitative", data_source: metric.data_source || "manual", auto_source: metric.auto_source || "", department_id: metric.department_id || "", owner_user_id: metric.owner_user_id || "", target_date: metric.target_date || "", current_value: metric.current_value || "", narrative: metric.narrative || "",
    } : EMPTY_METRIC);
  };
  const saveMetric = async () => {
    if (!metricForm.code.trim() || !metricForm.title.trim()) return Swal.fire("Required", "Metric code and title are required.", "warning");
    try {
      if (metricTarget.metric) await api.put(`/naac-iqac/metrics/${metricTarget.metric.id}`, metricForm);
      else await api.post(`/naac-iqac/criteria/${metricTarget.criterion.id}/metrics`, metricForm);
      setMetricTarget(null); await loadCycle(cycle.id);
    } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); }
  };
  const quickMetricStatus = async (metric, status) => {
    try { await api.put(`/naac-iqac/metrics/${metric.id}`, { status }); await loadCycle(cycle.id); } catch (e) { Swal.fire("Unable to update", e.response?.data?.message || e.message, "error"); }
  };
  const refreshAuto = async (metric) => {
    try { const { data } = await api.post(`/naac-iqac/metrics/${metric.id}/refresh-auto`); await loadCycle(cycle.id); Swal.fire("ERP snapshot refreshed", `${data?.snapshot?.value ?? "—"}\n${data?.snapshot?.detail || ""}`, "success"); } catch (e) { Swal.fire("Unable to refresh", e.response?.data?.message || e.message, "error"); }
  };
  const saveNarrative = async (metric) => {
    const { value } = await Swal.fire({ title: `${metric.code} · Working Note`, input: "textarea", inputValue: metric.narrative || "", inputPlaceholder: "Narrative / analysis / readiness note…", inputAttributes: { style: "min-height:180px" }, showCancelButton: true });
    if (value === undefined) return;
    try { await api.put(`/naac-iqac/metrics/${metric.id}`, { narrative: value, status: metric.status === "pending" ? "in_progress" : metric.status }); await loadCycle(cycle.id); } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); }
  };
  const reviewEvidence = async (evidence, status) => {
    const { value: remarks } = await Swal.fire({ title: status === "verified" ? "Verify evidence" : "Reject / request replacement", input: "textarea", inputValue: evidence.remarks || "", inputPlaceholder: "Verification note (optional)", showCancelButton: true });
    if (remarks === undefined) return;
    try { await api.put(`/naac-iqac/evidence/${evidence.id}/review`, { status, remarks }); await loadCycle(cycle.id); } catch (e) { Swal.fire("Unable to review", e.response?.data?.message || e.message, "error"); }
  };
  const saveIqac = async () => {
    if (!iqacForm.title.trim()) return Swal.fire("Required", "Activity title is required.", "warning");
    try { await api.post("/naac-iqac/iqac", { ...iqacForm, cycle_id: cycle?.id || null }); setIqacModal(false); setIqacForm(EMPTY_IQAC); if (cycle) await loadCycle(cycle.id); } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); }
  };
  const updateIqacStatus = async (row, status) => {
    try { await api.put(`/naac-iqac/iqac/${row.id}`, { status }); await loadCycle(cycle.id); } catch (e) { Swal.fire("Unable to update", e.response?.data?.message || e.message, "error"); }
  };

  return <div className="container-fluid py-4 ni-page">
    <section className="ni-hero mb-4">
      <div><span className="ni-kicker">College Quality · Accreditation Workspace</span><h1>NAAC / IQAC & Accreditation</h1><p>Collect evidence, assign responsibility, verify readiness and reuse live ERP data from one configurable accreditation workspace.</p><div className="ni-note"><i className="bi bi-info-circle" /> Starter criteria and ERP snapshots are editable—configure them to the framework applicable to your institution and cycle.</div></div>
      <div className="ni-readiness"><div className="ni-ring" style={{ "--p": `${dashboard.readiness_percent || 0}%` }}><strong>{dashboard.readiness_percent || 0}%</strong><span>Verified</span></div></div>
    </section>

    <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-4">
      <div className="d-flex gap-2 align-items-center flex-wrap"><label className="small text-muted fw-semibold">Accreditation Cycle</label><select className="form-select ni-cycle-select" value={cycleId} onChange={(e) => setCycleId(e.target.value)}><option value="">No cycle selected</option>{cycles.map((c) => <option key={c.id} value={c.id}>{c.title}{c.cycle_number ? ` · ${c.cycle_number}` : ""}</option>)}</select></div>
      {manager && <button className="btn btn-primary" onClick={() => setCycleModal(true)}><i className="bi bi-plus-circle me-2" />New Cycle</button>}
    </div>

    {!cycle && !loading ? <Empty icon="bi-award" title="Create your accreditation cycle" text="Start with an editable framework, assign metrics and begin collecting evidence." action={manager ? () => setCycleModal(true) : null} /> : <>
      <div className="row g-3 mb-4">
        <Metric icon="bi-list-check" label="Metrics" value={dashboard.counts?.total_metrics || 0} />
        <Metric icon="bi-patch-check-fill" label="Verified" value={dashboard.counts?.verified || 0} tone="success" />
        <Metric icon="bi-clock-history" label="In Progress" value={(dashboard.counts?.in_progress || 0) + (dashboard.counts?.evidence_uploaded || 0) + (dashboard.counts?.under_verification || 0)} tone="primary" />
        <Metric icon="bi-exclamation-triangle-fill" label="Overdue" value={dashboard.counts?.overdue || 0} tone="danger" />
        <Metric icon="bi-files" label="Verified Evidence" value={dashboard.evidence?.verified || 0} tone="info" />
        <Metric icon="bi-calendar2-check" label="IQAC Follow-ups" value={dashboard.iqac?.due || 0} tone="warning" />
      </div>

      <div className="ni-tabs mb-4">{[["overview","Readiness Dashboard","bi-speedometer2"],["metrics","Criteria & Metrics","bi-ui-checks-grid"],["iqac","IQAC Activities","bi-people-fill"]].map(([k,l,i]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}><i className={`bi ${i}`} />{l}</button>)}</div>

      {tab === "overview" && <Overview cycle={cycle} dashboard={dashboard} />}
      {tab === "metrics" && <div className="d-grid gap-3">
        <div className="d-flex justify-content-between align-items-center"><div><h2 className="h5 mb-1">Criteria & Metrics</h2><div className="text-muted small">Assign owners, collect evidence, refresh ERP snapshots and verify each metric.</div></div>{manager && <button className="btn btn-outline-primary btn-sm" onClick={addCriterion}><i className="bi bi-plus-lg me-1" />Criterion / Area</button>}</div>
        {(cycle.criteria || []).slice().sort((a,b) => Number(a.sort_order||0)-Number(b.sort_order||0)).map((criterion) => <Criterion key={criterion.id} criterion={criterion} manager={manager} meta={meta} onAdd={() => openMetric(criterion)} onEdit={(m) => openMetric(criterion,m)} onRefresh={refreshAuto} onNarrative={saveNarrative} onEvidence={setEvidenceMetric} onStatus={quickMetricStatus} onReviewEvidence={reviewEvidence} />)}
      </div>}
      {tab === "iqac" && <IqacPanel rows={iqac} manager={manager} onNew={() => setIqacModal(true)} onStatus={updateIqacStatus} />}
    </>}

    {cycleModal && <CycleModal form={cycleForm} setForm={setCycleForm} onClose={() => setCycleModal(false)} onSave={createCycle} />}
    {metricTarget && <MetricModal target={metricTarget} form={metricForm} setForm={setMetricForm} meta={meta} manager={manager} onClose={() => setMetricTarget(null)} onSave={saveMetric} />}
    {evidenceMetric && <EvidenceModal metric={evidenceMetric} onClose={() => setEvidenceMetric(null)} onSaved={async () => { setEvidenceMetric(null); await loadCycle(cycle.id); }} />}
    {iqacModal && <IqacModal form={iqacForm} setForm={setIqacForm} meta={meta} onClose={() => setIqacModal(false)} onSave={saveIqac} />}
  </div>;
}

function Metric({ icon, label, value, tone: c = "primary" }) { return <div className="col-6 col-md-4 col-xl-2"><div className="ni-metric card border-0 shadow-sm h-100"><div className={`ni-metric-icon text-bg-${c}`}><i className={`bi ${icon}`} /></div><div><span>{label}</span><strong>{value}</strong></div></div></div>; }
function Empty({ icon, title, text, action }) { return <div className="ni-empty card border-0 shadow-sm"><i className={`bi ${icon}`} /><h2 className="h5">{title}</h2><p>{text}</p>{action && <button className="btn btn-primary btn-sm" onClick={action}>Create Cycle</button>}</div>; }

function Overview({ cycle, dashboard }) {
  return <div className="row g-4"><div className="col-xl-8"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><div className="d-flex justify-content-between align-items-start mb-4"><div><span className="ni-kicker">Criterion readiness</span><h2 className="h5 mb-0">Progress by area</h2></div><span className={`badge text-bg-${tone(cycle.status)}`}>{human(cycle.status)}</span></div><div className="d-grid gap-3">{(dashboard.criteria || []).map((c) => <div className="ni-progress-row" key={c.id}><div className="d-flex justify-content-between gap-3"><div><strong>{c.code}. {c.title}</strong><small>{c.verified}/{c.metrics} verified</small></div><b>{c.progress}%</b></div><div className="progress"><div className="progress-bar" style={{ width: `${c.progress}%` }} /></div></div>)}{!(dashboard.criteria || []).length && <div className="text-muted">No criteria configured yet.</div>}</div></div></div></div><div className="col-xl-4"><div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><span className="ni-kicker">Cycle details</span><h2 className="h5">{cycle.title}</h2><dl className="ni-dl"><div><dt>Type</dt><dd>{cycle.accreditation_type || "NAAC"}</dd></div><div><dt>Cycle</dt><dd>{cycle.cycle_number || "—"}</dd></div><div><dt>Period</dt><dd>{[cycle.academic_year_from, cycle.academic_year_to].filter(Boolean).join(" – ") || "—"}</dd></div><div><dt>Target</dt><dd>{dateOnly(cycle.target_submission_date)}</dd></div></dl></div></div><div className="card border-0 shadow-sm"><div className="card-body p-4"><span className="ni-kicker">Evidence health</span><div className="ni-evidence-grid"><div><strong>{dashboard.evidence?.submitted || 0}</strong><span>Awaiting review</span></div><div><strong>{dashboard.evidence?.verified || 0}</strong><span>Verified</span></div><div><strong>{dashboard.evidence?.rejected || 0}</strong><span>Needs replacement</span></div></div></div></div></div></div>;
}

function Criterion({ criterion, manager, onAdd, onEdit, onRefresh, onNarrative, onEvidence, onStatus, onReviewEvidence }) {
  const [open, setOpen] = useState(true);
  const metrics = criterion.metrics || [];
  const verified = metrics.filter((m) => m.status === "verified").length;
  return <div className="card border-0 shadow-sm ni-criterion"><button className="ni-criterion-head" onClick={() => setOpen(!open)}><div><span className="ni-criterion-code">Criterion {criterion.code}</span><h3>{criterion.title}</h3><small>{verified}/{metrics.length} metrics verified</small></div><div className="d-flex gap-2 align-items-center">{manager && <span role="button" className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); onAdd(); }}><i className="bi bi-plus-lg" /> Metric</span>}<i className={`bi bi-chevron-${open ? "up" : "down"}`} /></div></button>{open && <div className="card-body p-3 p-md-4 pt-0"><div className="d-grid gap-3">{metrics.length ? metrics.map((m) => <MetricRow key={m.id} metric={m} manager={manager} onEdit={() => onEdit(m)} onRefresh={() => onRefresh(m)} onNarrative={() => onNarrative(m)} onEvidence={() => onEvidence(m)} onStatus={(s) => onStatus(m,s)} onReviewEvidence={onReviewEvidence} />) : <div className="ni-empty-inline">No metrics yet. Add a metric or evidence requirement for this criterion.</div>}</div></div>}</div>;
}
function MetricRow({ metric, manager, onEdit, onRefresh, onNarrative, onEvidence, onStatus, onReviewEvidence }) {
  const ev = metric.evidence || [];
  return <div className="ni-metric-row"><div className="ni-metric-main"><div className="d-flex flex-wrap gap-2 align-items-center mb-2"><span className="ni-code">{metric.code}</span><span className={`badge text-bg-${tone(metric.status)}`}>{human(metric.status)}</span>{metric.data_source !== "manual" && <span className="badge text-bg-light border"><i className="bi bi-database-check me-1" />ERP {human(metric.data_source)}</span>}</div><h4>{metric.title}</h4>{metric.description && <p>{metric.description}</p>}<div className="ni-meta-line">{metric.department?.name && <span><i className="bi bi-diagram-3" />{metric.department.name}</span>}{metric.owner?.name && <span><i className="bi bi-person" />{metric.owner.name}</span>}{metric.target_date && <span><i className="bi bi-calendar-event" />Due {dateOnly(metric.target_date)}</span>}</div>{metric.current_value && <div className="ni-current-value"><span>Current value</span><strong>{metric.current_value}</strong>{metric.last_auto_refresh_at && <small>ERP snapshot refreshed {new Date(metric.last_auto_refresh_at).toLocaleString()}</small>}</div>}{metric.narrative && <div className="ni-narrative"><strong>Working narrative</strong><p>{metric.narrative}</p></div>}</div><div className="ni-actions"><button className="btn btn-sm btn-outline-secondary" onClick={onNarrative}><i className="bi bi-pencil-square" /> Notes</button>{metric.auto_source && <button className="btn btn-sm btn-outline-info" onClick={onRefresh}><i className="bi bi-arrow-repeat" /> ERP Refresh</button>}<button className="btn btn-sm btn-outline-primary" onClick={onEvidence}><i className="bi bi-paperclip" /> Evidence</button>{manager && <button className="btn btn-sm btn-outline-secondary" onClick={onEdit}><i className="bi bi-sliders" /> Configure</button>}{manager && metric.status !== "verified" && <button className="btn btn-sm btn-success" onClick={() => onStatus("verified")}><i className="bi bi-patch-check" /> Verify</button>}{manager && metric.status === "verified" && <button className="btn btn-sm btn-outline-warning" onClick={() => onStatus("needs_revision")}>Reopen</button>}</div>{ev.length > 0 && <div className="ni-evidence-list"><div className="ni-evidence-title"><strong>Evidence</strong><span>{ev.length} item{ev.length === 1 ? "" : "s"}</span></div>{ev.map((x) => <div className="ni-evidence-item" key={x.id}><div><i className={`bi ${x.file_path ? "bi-file-earmark-pdf" : "bi-link-45deg"}`} /><div><strong>{x.title}</strong><small>{x.academic_year || "No academic year"} · {human(x.evidence_type)} · <span className={`text-${tone(x.status)}`}>{human(x.status)}</span></small></div></div><div className="d-flex gap-1">{x.file_path && <button className="btn btn-light btn-sm" onClick={() => downloadBlob(`/naac-iqac/evidence/${x.id}/download`, x.original_name || x.title)}><i className="bi bi-download" /></button>}{x.external_url && <a className="btn btn-light btn-sm" href={x.external_url} target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right" /></a>}{manager && x.status !== "verified" && <button className="btn btn-outline-success btn-sm" onClick={() => onReviewEvidence(x,"verified")}><i className="bi bi-check-lg" /></button>}{manager && x.status !== "rejected" && <button className="btn btn-outline-danger btn-sm" onClick={() => onReviewEvidence(x,"rejected")}><i className="bi bi-x-lg" /></button>}</div></div>)}</div>}</div>;
}

function IqacPanel({ rows, manager, onNew, onStatus }) { return <div><div className="d-flex justify-content-between align-items-start mb-3"><div><h2 className="h5 mb-1">IQAC Activities & Quality Initiatives</h2><div className="text-muted small">Meetings, audits, quality initiatives, action-taken reports and follow-up reviews.</div></div><button className="btn btn-primary btn-sm" onClick={onNew}><i className="bi bi-plus-lg me-1" />Activity</button></div><div className="row g-3">{rows.length ? rows.map((r) => <div className="col-md-6 col-xl-4" key={r.id}><div className="card border-0 shadow-sm h-100 ni-iqac-card"><div className="card-body"><div className="d-flex justify-content-between gap-2"><span className="ni-code">{human(r.activity_type)}</span><span className={`badge text-bg-${tone(r.status)}`}>{human(r.status)}</span></div><h3 className="h6 mt-3">{r.title}</h3><p>{r.description || "No description."}</p><div className="ni-meta-line"><span><i className="bi bi-calendar" />{dateOnly(r.activity_date)}</span>{r.owner?.name && <span><i className="bi bi-person" />{r.owner.name}</span>}</div>{r.action_taken && <div className="ni-action-taken"><strong>Action taken</strong><p>{r.action_taken}</p></div>}{r.next_review_date && <div className="small mt-2"><strong>Next review:</strong> {dateOnly(r.next_review_date)}</div>}{r.evidence_url && <a href={r.evidence_url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary mt-3">Open evidence link</a>}{manager && !["completed","closed"].includes(r.status) && <button className="btn btn-sm btn-outline-success mt-3 ms-2" onClick={() => onStatus(r,"completed")}>Mark Completed</button>}</div></div></div>) : <div className="col-12"><Empty icon="bi-people" title="No IQAC activities yet" text="Record IQAC meetings, quality initiatives, audits and action-taken reviews." action={onNew} /></div>}</div></div>; }

function CycleModal({ form, setForm, onClose, onSave }) { return <Modal title="New Accreditation Cycle" subtitle="Create an editable accreditation workspace. The starter framework is not locked and can be changed for your applicable cycle." onClose={onClose}><div className="row g-3"><Field label="Cycle Title" col="col-12"><input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="Accreditation Type" col="col-md-4"><input className="form-control" value={form.accreditation_type} onChange={(e) => setForm({ ...form, accreditation_type: e.target.value })} /></Field><Field label="Cycle Number" col="col-md-4"><input className="form-control" value={form.cycle_number} onChange={(e) => setForm({ ...form, cycle_number: e.target.value })} placeholder="Cycle 1 / Cycle 2" /></Field><Field label="Target Submission" col="col-md-4"><input type="date" className="form-control" value={form.target_submission_date} onChange={(e) => setForm({ ...form, target_submission_date: e.target.value })} /></Field><Field label="Academic Year From" col="col-md-6"><input className="form-control" value={form.academic_year_from} onChange={(e) => setForm({ ...form, academic_year_from: e.target.value })} placeholder="2022-23" /></Field><Field label="Academic Year To" col="col-md-6"><input className="form-control" value={form.academic_year_to} onChange={(e) => setForm({ ...form, academic_year_to: e.target.value })} placeholder="2026-27" /></Field><Field label="Notes" col="col-12"><textarea className="form-control" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field><div className="col-12"><label className="form-check"><input className="form-check-input" type="checkbox" checked={form.seed_starter_framework} onChange={(e) => setForm({ ...form, seed_starter_framework: e.target.checked })} /><span className="form-check-label ms-1">Create editable starter criteria + ERP snapshot metrics</span></label></div></div><Footer onClose={onClose} onSave={onSave} save="Create Cycle" /></Modal>; }
function MetricModal({ target, form, setForm, meta, manager, onClose, onSave }) { return <Modal title={target.metric ? "Configure Metric" : "Add Metric"} subtitle={target.criterion.title} onClose={onClose}><div className="row g-3"><Field label="Metric Code" col="col-md-4"><input className="form-control" disabled={!manager} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field><Field label="Title" col="col-md-8"><input className="form-control" disabled={!manager} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="Metric Type" col="col-md-4"><select className="form-select" disabled={!manager} value={form.metric_type} onChange={(e) => setForm({ ...form, metric_type: e.target.value })}><option value="qualitative">Qualitative</option><option value="quantitative">Quantitative</option><option value="mixed">Mixed</option></select></Field><Field label="Data Source" col="col-md-4"><select className="form-select" disabled={!manager} value={form.data_source} onChange={(e) => setForm({ ...form, data_source: e.target.value })}><option value="manual">Manual</option><option value="erp_auto">ERP Auto</option><option value="hybrid">Hybrid</option></select></Field><Field label="ERP Auto Source" col="col-md-4"><select className="form-select" disabled={!manager} value={form.auto_source} onChange={(e) => setForm({ ...form, auto_source: e.target.value })}><option value="">None</option>{(meta.auto_sources || []).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></Field><Field label="Department" col="col-md-4"><select className="form-select" disabled={!manager} value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">Institution-wide</option>{(meta.departments || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Responsible Person" col="col-md-4"><select className="form-select" disabled={!manager} value={form.owner_user_id} onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })}><option value="">Unassigned</option>{(meta.users || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Target Date" col="col-md-4"><input type="date" className="form-control" disabled={!manager} value={form.target_date || ""} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></Field><Field label="Current / Reported Value" col="col-12"><input className="form-control" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} /></Field><Field label="Description / Requirement" col="col-12"><textarea className="form-control" rows="3" disabled={!manager} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field><Field label="Working Narrative" col="col-12"><textarea className="form-control" rows="4" value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} /></Field></div><Footer onClose={onClose} onSave={onSave} save="Save Metric" /></Modal>; }
function EvidenceModal({ metric, onClose, onSaved }) { const [form,setForm]=useState({ title:"",academic_year:"",evidence_type:"document",external_url:"",remarks:""}); const [file,setFile]=useState(null); const save=async()=>{ if(!file && !form.external_url.trim()) return Swal.fire("Required","Choose a file or provide an evidence link.","warning"); try{ const fd=new FormData(); Object.entries(form).forEach(([k,v])=>v&&fd.append(k,v)); if(file) fd.append("file",file); await api.post(`/naac-iqac/metrics/${metric.id}/evidence`,fd,{headers:{"Content-Type":"multipart/form-data"}}); await onSaved(); }catch(e){ Swal.fire("Unable to upload",e.response?.data?.message||e.message,"error"); }}; return <Modal title="Add Evidence" subtitle={`${metric.code} · ${metric.title}`} onClose={onClose}><div className="row g-3"><Field label="Evidence Title" col="col-md-8"><input className="form-control" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="e.g. Student strength report 2025-26" /></Field><Field label="Academic Year" col="col-md-4"><input className="form-control" value={form.academic_year} onChange={(e)=>setForm({...form,academic_year:e.target.value})} placeholder="2025-26" /></Field><Field label="Evidence Type" col="col-md-4"><select className="form-select" value={form.evidence_type} onChange={(e)=>setForm({...form,evidence_type:e.target.value})}><option value="document">Document</option><option value="data_sheet">Data Sheet</option><option value="minutes">Minutes / ATR</option><option value="certificate">Certificate</option><option value="photo">Photo / Image</option><option value="link">External Link</option><option value="other">Other</option></select></Field><Field label="File (max 50 MB)" col="col-md-8"><input type="file" className="form-control" onChange={(e)=>setFile(e.target.files?.[0]||null)} /></Field><Field label="External Evidence Link (optional)" col="col-12"><input className="form-control" value={form.external_url} onChange={(e)=>setForm({...form,external_url:e.target.value})} placeholder="https://..." /></Field><Field label="Remarks" col="col-12"><textarea className="form-control" rows="3" value={form.remarks} onChange={(e)=>setForm({...form,remarks:e.target.value})} /></Field></div><Footer onClose={onClose} onSave={save} save="Add Evidence" /></Modal>; }
function IqacModal({ form,setForm,meta,onClose,onSave }) { return <Modal title="New IQAC Activity" subtitle="Record meetings, audits, quality initiatives and action-taken follow-ups." onClose={onClose}><div className="row g-3"><Field label="Type" col="col-md-4"><select className="form-select" value={form.activity_type} onChange={(e)=>setForm({...form,activity_type:e.target.value})}>{["meeting","quality_initiative","academic_audit","training","feedback_review","action_taken","best_practice","other"].map((x)=><option key={x} value={x}>{human(x)}</option>)}</select></Field><Field label="Activity Date" col="col-md-4"><input type="date" className="form-control" value={form.activity_date} onChange={(e)=>setForm({...form,activity_date:e.target.value})} /></Field><Field label="Next Review" col="col-md-4"><input type="date" className="form-control" value={form.next_review_date} onChange={(e)=>setForm({...form,next_review_date:e.target.value})} /></Field><Field label="Title" col="col-12"><input className="form-control" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} /></Field><Field label="Owner" col="col-md-6"><select className="form-select" value={form.owner_user_id} onChange={(e)=>setForm({...form,owner_user_id:e.target.value})}><option value="">Current user</option>{(meta.users||[]).map((x)=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Status" col="col-md-6"><select className="form-select" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="planned">Planned</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="closed">Closed</option></select></Field><Field label="Description / Minutes" col="col-12"><textarea className="form-control" rows="3" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} /></Field><Field label="Action Taken" col="col-12"><textarea className="form-control" rows="3" value={form.action_taken} onChange={(e)=>setForm({...form,action_taken:e.target.value})} /></Field><Field label="Evidence / Minutes Link" col="col-12"><input className="form-control" value={form.evidence_url} onChange={(e)=>setForm({...form,evidence_url:e.target.value})} placeholder="https://..." /></Field></div><Footer onClose={onClose} onSave={onSave} save="Save Activity" /></Modal>; }
function Modal({ title,subtitle,onClose,children }) { return <div className="ni-backdrop"><div className="ni-modal"><div className="ni-modal-head"><div><span className="ni-kicker">NAAC / IQAC</span><h2 className="h4 mb-1">{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="btn-close" onClick={onClose} /></div><div className="ni-modal-body">{children}</div></div></div>; }
function Field({ label,col="col-12",children }) { return <div className={col}><label className="form-label">{label}</label>{children}</div>; }
function Footer({ onClose,onSave,save }) { return <div className="d-flex justify-content-end gap-2 mt-4"><button className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={onSave}>{save}</button></div>; }
