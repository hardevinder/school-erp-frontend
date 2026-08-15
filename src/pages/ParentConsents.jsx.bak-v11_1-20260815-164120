import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import parentConsentApi from "../services/parentConsentApi";

const CATEGORIES = ["Trip / Excursion", "Medical", "Activity / Event", "Photo / Media", "Counselling", "Undertaking / Declaration", "Academic", "General"];
const MODES = [
  ["digital", "Digital consent / acknowledgement"],
  ["signed_scan", "Signed paper must be scanned & uploaded"],
  ["digital_or_scan", "Digital response OR signed scan"],
  ["digital_and_scan", "Digital response AND signed scan"],
];

const msg = (e) => e?.response?.data?.message || e?.message || "Something went wrong.";
const today = () => new Date().toISOString().slice(0, 10);

function StatusBadge({ status }) {
  const map = {
    draft: ["Draft", "secondary"], issued: ["Issued", "primary"], closed: ["Closed", "dark"], cancelled: ["Cancelled", "danger"],
    complete: ["Complete", "success"], declined: ["Declined", "danger"], pending: ["Pending", "secondary"], viewed: ["Viewed", "info"],
    awaiting_scan: ["Awaiting signed scan", "warning"], scan_review: ["Signed scan to verify", "warning"], scan_rejected: ["Scan rejected", "danger"], digital_pending: ["Digital response pending", "warning"],
  };
  const [label, tone] = map[status] || [String(status || "Pending").replaceAll("_", " "), "secondary"];
  return <span className={`badge text-bg-${tone}`}>{label}</span>;
}

function SummaryCards({ summary = {} }) {
  const cards = [
    ["Consent Requests", summary.requests || 0, "bi-send-check", "primary"],
    ["Students Targeted", summary.recipients || 0, "bi-people", "info"],
    ["Completed", summary.complete || 0, "bi-check2-circle", "success"],
    ["Declined", summary.declined || 0, "bi-x-circle", "danger"],
    ["Signed Scans to Verify", summary.scan_review || 0, "bi-file-earmark-check", "warning"],
  ];
  return <div className="row g-3 mb-4">{cards.map(([label, value, icon, tone]) => <div className="col-6 col-xl" key={label}><div className="card border-0 shadow-sm h-100"><div className="card-body"><i className={`bi ${icon} text-${tone} fs-4`} /><div className="fs-4 fw-bold mt-2">{value}</div><div className="small text-muted">{label}</div></div></div></div>)}</div>;
}

function CreatePanel({ catalog, onCreated }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [form, setForm] = useState({
    title: "", category: "General", subject: "", description: "", acknowledgement_text: "I confirm that I have read and understood the above information.",
    issue_date: today(), due_date: "", response_mode: "digital", allow_decline: true, confidential: false, class_id: "", section_id: "", form_file: null,
  });

  const sections = useMemo(() => (catalog.sections || []).filter((s) => !form.class_id || String(s.class_id) === String(form.class_id)), [catalog.sections, form.class_id]);

  const loadStudents = useCallback(async () => {
    if (!form.class_id) { setStudents([]); setSelected(new Set()); return; }
    setLoadingStudents(true); setError("");
    try {
      const data = await parentConsentApi.students({ class_id: form.class_id, ...(form.section_id ? { section_id: form.section_id } : {}) });
      setStudents(data.students || []);
      setSelected(new Set());
    } catch (e) { setError(msg(e)); }
    finally { setLoadingStudents(false); }
  }, [form.class_id, form.section_id]);

  useEffect(() => { if (open) loadStudents(); }, [open, loadStudents]);

  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const toggle = (id) => setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const allSelected = students.length > 0 && selected.size === students.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)));

  const submit = async (issueNow) => {
    if (!form.title.trim()) return setError("Title is required.");
    if (!selected.size) return setError("Select at least one student.");
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === "form_file") return;
      if (typeof v === "boolean") fd.append(k, v ? "true" : "false");
      else if (v !== "" && v != null) fd.append(k, v);
    });
    fd.append("student_ids", JSON.stringify([...selected]));
    fd.append("issue_now", issueNow ? "true" : "false");
    if (form.form_file) fd.append("form_file", form.form_file);
    setBusy(true); setError("");
    try {
      await parentConsentApi.create(fd);
      setOpen(false);
      setStudents([]); setSelected(new Set());
      setForm((p) => ({ ...p, title: "", subject: "", description: "", due_date: "", form_file: null }));
      onCreated?.();
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  };

  if (!open) return <div className="mb-4"><button className="btn btn-primary" onClick={() => setOpen(true)}><i className="bi bi-plus-circle me-2" />Create Parent Consent</button></div>;

  return <div className="card shadow-sm border-0 mb-4"><div className="card-header bg-white d-flex justify-content-between align-items-center"><div><h5 className="mb-0">Create Parent Consent / Acknowledgement</h5><div className="small text-muted">Digital response, signed paper scan, or both.</div></div><button className="btn-close" onClick={() => setOpen(false)} disabled={busy} /></div>
    <div className="card-body">
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="row g-3">
        <div className="col-md-8"><label className="form-label fw-semibold">Title *</label><input className="form-control" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Educational Trip Consent – Chandigarh" /></div>
        <div className="col-md-4"><label className="form-label">Category</label><select className="form-select" value={form.category} onChange={(e) => set("category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="col-12"><label className="form-label">Subject</label><input className="form-control" value={form.subject} onChange={(e) => set("subject", e.target.value)} /></div>
        <div className="col-12"><label className="form-label fw-semibold">Message / Details</label><textarea rows="5" className="form-control" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Explain the activity, permission needed, dates, instructions, etc." /></div>
        <div className="col-12"><label className="form-label">Acknowledgement / Declaration text</label><textarea rows="2" className="form-control" value={form.acknowledgement_text} onChange={(e) => set("acknowledgement_text", e.target.value)} /></div>
        <div className="col-md-4"><label className="form-label">Response method</label><select className="form-select" value={form.response_mode} onChange={(e) => set("response_mode", e.target.value)}>{MODES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Issue date</label><input type="date" className="form-control" value={form.issue_date} onChange={(e) => set("issue_date", e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">Due date</label><input type="date" className="form-control" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} /></div>
        <div className="col-md-4"><label className="form-label">School form / PDF (optional)</label><input type="file" className="form-control" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => set("form_file", e.target.files?.[0] || null)} /></div>
        <div className="col-md-6"><div className="form-check mt-2"><input id="allow-decline" className="form-check-input" type="checkbox" checked={form.allow_decline} onChange={(e) => set("allow_decline", e.target.checked)} /><label htmlFor="allow-decline" className="form-check-label">Allow parent to decline</label></div></div>
        <div className="col-md-6"><div className="form-check mt-2"><input id="confidential" className="form-check-input" type="checkbox" checked={form.confidential} onChange={(e) => set("confidential", e.target.checked)} /><label htmlFor="confidential" className="form-check-label">Confidential / restricted request</label></div></div>
      </div>

      <hr className="my-4" />
      <div className="row g-3 align-items-end">
        <div className="col-md-4"><label className="form-label fw-semibold">Class *</label><select className="form-select" value={form.class_id} onChange={(e) => { set("class_id", e.target.value); set("section_id", ""); }}><option value="">Select class</option>{(catalog.classes || []).map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label">Section</label><select className="form-select" value={form.section_id} onChange={(e) => set("section_id", e.target.value)}><option value="">All sections</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.section_name}</option>)}</select></div>
        <div className="col-md-4"><button type="button" className="btn btn-outline-primary w-100" onClick={loadStudents} disabled={!form.class_id || loadingStudents}>{loadingStudents ? "Loading..." : "Load Students"}</button></div>
      </div>

      {students.length > 0 && <div className="border rounded mt-3" style={{ maxHeight: 330, overflow: "auto" }}><div className="sticky-top bg-light border-bottom p-2 d-flex justify-content-between"><label className="form-check mb-0"><input className="form-check-input me-2" type="checkbox" checked={allSelected} onChange={toggleAll} />Select all {students.length}</label><span className="small text-muted">Selected: {selected.size}</span></div>{students.map((s) => <label key={s.id} className="d-flex gap-3 align-items-center border-bottom p-2 mb-0"><input className="form-check-input" type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /><div className="flex-grow-1"><div className="fw-semibold">{s.name}</div><div className="small text-muted">{s.admission_number || `Student #${s.id}`} • {[s.Class?.class_name, s.Section?.section_name].filter(Boolean).join(" - ")}</div></div></label>)}</div>}
    </div>
    <div className="card-footer bg-white d-flex gap-2 justify-content-end"><button className="btn btn-light" onClick={() => setOpen(false)} disabled={busy}>Cancel</button><button className="btn btn-outline-primary" onClick={() => submit(false)} disabled={busy}>{busy ? "Saving..." : "Save Draft"}</button><button className="btn btn-primary" onClick={() => submit(true)} disabled={busy}>{busy ? "Processing..." : <><i className="bi bi-send me-2" />Issue & Notify Parents</>}</button></div>
  </div>;
}

function DetailModal({ requestId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => { try { setError(""); const d = await parentConsentApi.request(requestId); setData(d.request); } catch (e) { setError(msg(e)); } }, [requestId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const requestedId = Number(searchParams.get("requestId") || 0);
    if (requestedId > 0) setDetailId(requestedId);
  }, [searchParams]);

  const act = async (key, fn) => { setBusy(key); setError(""); try { await fn(); await load(); onChanged?.(); } catch (e) { setError(msg(e)); } finally { setBusy(""); } };
  if (!requestId) return null;
  return <div className="modal d-block" tabIndex="-1" style={{ background: "rgba(15,23,42,.6)", zIndex: 5000 }}><div className="modal-dialog modal-xl modal-dialog-scrollable"><div className="modal-content border-0 shadow"><div className="modal-header"><div><h5 className="modal-title">{data?.title || "Consent Request"}</h5>{data && <div className="small text-muted">{data.category} • {data.issue_date}{data.due_date ? ` • Due ${data.due_date}` : ""}</div>}</div><button className="btn-close" onClick={onClose} /></div><div className="modal-body">
    {error && <div className="alert alert-danger py-2">{error}</div>}
    {!data ? <div className="text-center py-5"><div className="spinner-border" /></div> : <>
      <div className="d-flex gap-2 flex-wrap mb-3"><StatusBadge status={data.status} /><span className="badge text-bg-light border text-dark">{MODES.find(([v]) => v === data.response_mode)?.[1] || data.response_mode}</span><span className="badge text-bg-success">{data.summary?.complete || 0}/{data.summary?.total || 0} complete</span>{data.summary?.scan_review > 0 && <span className="badge text-bg-warning">{data.summary.scan_review} scans to verify</span>}</div>
      {data.description && <div className="alert alert-light border"><div className="fw-semibold mb-1">Details</div>{data.description}</div>}
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Student</th><th>Digital Response</th><th>Signed Scan</th><th>Overall</th><th>Responded</th><th className="text-end">Actions</th></tr></thead><tbody>{(data.recipients || []).map((r) => <tr key={r.id}><td><div className="fw-semibold">{r.student?.name || `Student #${r.student_id}`}</div><div className="small text-muted">{r.student?.admission_number || ""} {[r.student?.Class?.class_name, r.student?.Section?.section_name].filter(Boolean).join(" • ")}</div></td><td><StatusBadge status={r.digital_response === "accepted" ? "complete" : r.digital_response} />{r.response_note && <div className="small text-muted mt-1">{r.response_note}</div>}</td><td><StatusBadge status={r.scan_status === "verified" ? "complete" : r.scan_status === "submitted" ? "scan_review" : r.scan_status === "rejected" ? "scan_rejected" : r.scan_status} />{r.scan_rejection_reason && <div className="small text-danger mt-1">{r.scan_rejection_reason}</div>}</td><td><StatusBadge status={r.overall_status} /></td><td className="small text-muted">{r.responded_at ? new Date(r.responded_at).toLocaleString() : "—"}</td><td><div className="d-flex justify-content-end gap-1 flex-wrap"><button className="btn btn-sm btn-outline-secondary" onClick={() => parentConsentApi.openForm(r.id)}>Form</button>{r.signed_scan_file_path && <button className="btn btn-sm btn-outline-primary" onClick={() => parentConsentApi.openSignedScan(r.id)}>Signed Scan</button>}{r.scan_status === "submitted" && <><button className="btn btn-sm btn-success" disabled={!!busy} onClick={() => act(`v${r.id}`, () => parentConsentApi.verifyScan(r.id))}>Verify</button><button className="btn btn-sm btn-outline-danger" disabled={!!busy} onClick={() => { const reason = window.prompt("Reason for rejecting this signed scan:"); if (reason?.trim()) act(`r${r.id}`, () => parentConsentApi.rejectScan(r.id, reason.trim())); }}>Reject</button></>}</div></td></tr>)}</tbody></table></div>
    </>}
  </div><div className="modal-footer"><button className="btn btn-light" onClick={onClose}>Close</button></div></div></div></div>;
}

export default function ParentConsents() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState({});
  const [requests, setRequests] = useState([]);
  const [catalog, setCatalog] = useState({ classes: [], sections: [] });
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [r, c] = await Promise.all([parentConsentApi.requests(), parentConsentApi.catalog()]);
      setSummary(r.summary || {}); setRequests(r.requests || []); setCatalog(c || { classes: [], sections: [] });
    } catch (e) { setError(msg(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const action = async (fn) => { try { await fn(); await load(); } catch (e) { setError(msg(e)); } };

  return <div className="container-fluid py-3">
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-3"><div><h3 className="mb-1"><i className="bi bi-pen me-2 text-primary" />Parent Consent & Digital Acknowledgement</h3><div className="text-muted">Send consent requests, collect digital responses, and verify scanned parent-signed forms.</div></div><button className="btn btn-outline-secondary" onClick={load}><i className="bi bi-arrow-clockwise me-2" />Refresh</button></div>
    {error && <div className="alert alert-danger">{error}</div>}
    <SummaryCards summary={summary} />
    <CreatePanel catalog={catalog} onCreated={load} />
    <div className="card border-0 shadow-sm"><div className="card-header bg-white"><h5 className="mb-0">Consent Requests</h5></div><div className="card-body p-0">
      {loading ? <div className="text-center py-5"><div className="spinner-border" /></div> : requests.length === 0 ? <div className="text-center text-muted py-5">No parent consent requests yet.</div> : <div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead className="table-light"><tr><th>Request</th><th>Status</th><th>Response Method</th><th>Progress</th><th>Due</th><th className="text-end">Actions</th></tr></thead><tbody>{requests.map((r) => <tr key={r.id}><td><div className="fw-semibold">{r.title}</div><div className="small text-muted">{r.category} • Issued {r.issue_date}</div></td><td><StatusBadge status={r.status} /></td><td className="small">{MODES.find(([v]) => v === r.response_mode)?.[1] || r.response_mode}</td><td><div className="fw-semibold">{r.summary?.complete || 0}/{r.summary?.total || 0}</div><div className="small text-muted">{r.summary?.completed_percent || 0}% complete{r.summary?.scan_review ? ` • ${r.summary.scan_review} scans to verify` : ""}</div></td><td>{r.due_date || "—"}</td><td><div className="d-flex justify-content-end gap-1 flex-wrap"><button className="btn btn-sm btn-outline-primary" onClick={() => setDetailId(r.id)}>Open</button>{r.status === "draft" && <button className="btn btn-sm btn-primary" onClick={() => action(() => parentConsentApi.issue(r.id))}>Issue</button>}{r.status === "issued" && <><button className="btn btn-sm btn-outline-warning" onClick={() => action(() => parentConsentApi.remind(r.id))}><i className="bi bi-bell me-1" />Remind</button><button className="btn btn-sm btn-outline-dark" onClick={() => window.confirm("Close this consent request?") && action(() => parentConsentApi.close(r.id))}>Close</button></>}</div></td></tr>)}</tbody></table></div>}
    </div></div>
    {detailId && <DetailModal requestId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
  </div>;
}
