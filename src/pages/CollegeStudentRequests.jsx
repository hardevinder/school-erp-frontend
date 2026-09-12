import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./CollegeStudentRequests.css";

const getRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole");
    return (many.length ? many : [one]).filter(Boolean).map((x) => String(x).toLowerCase());
  } catch (_) { return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean); }
};
const MANAGERS = new Set(["department_hod", "principal", "academic_coordinator", "coordinator", "examination", "admission", "admissions", "frontoffice", "front_office", "accounts", "account", "accountant", "admin", "superadmin", "super_admin"]);
const human = (v) => String(v || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const dateOnly = (v) => v ? new Date(`${String(v).slice(0,10)}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" }) : "—";
const money = (v) => v == null || v === "" ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(v));
const statusTone = (s) => ({ issued: "success", approved: "primary", under_review: "info", submitted: "warning", rejected: "danger", cancelled: "secondary" }[s] || "secondary");

async function downloadBlob(url, filename) {
  const { data, headers } = await api.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  const a = document.createElement("a"); a.href = objectUrl; a.download = filename || "document"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(objectUrl);
  return headers;
}

export default function CollegeStudentRequests() {
  const { isCollege } = useInstitution();
  const roles = getRoles();
  const student = roles.includes("student");
  const manager = roles.some((r) => MANAGERS.has(r));
  if (!isCollege) return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">Student Requests are available in College mode.</div></div>;
  if (student) return <StudentRequests />;
  if (manager) return <StaffRequests />;
  return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4">Your role does not have access to College Student Requests.</div></div>;
}

function StudentRequests() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [types, setTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ request_type: "bonafide", custom_title: "", purpose: "", required_by: "", priority: "normal", student_note: "" });
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [home, typeRes] = await Promise.all([api.get("/college-student-requests/student/me"), api.get("/college-student-requests/types")]);
      setRows(home.data?.requests || []); setCounts(home.data?.counts || {}); setTypes(typeRes.data?.types || []);
    } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.request_type) return Swal.fire("Required", "Select a request type.", "warning");
    if (form.request_type === "custom" && !form.custom_title.trim()) return Swal.fire("Required", "Enter the custom request title.", "warning");
    try {
      const { data } = await api.post("/college-student-requests", form);
      if (file) { const fd = new FormData(); fd.append("file", file); fd.append("title", file.name); await api.post(`/college-student-requests/${data.request.id}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } }); }
      setFormOpen(false); setFile(null); setForm({ request_type: "bonafide", custom_title: "", purpose: "", required_by: "", priority: "normal", student_note: "" }); await load();
      Swal.fire("Submitted", "Your request has been submitted to the college office.", "success");
    } catch (e) { Swal.fire("Unable to submit", e.response?.data?.message || e.message, "error"); }
  };
  const openDetail = async (id) => { try { const { data } = await api.get(`/college-student-requests/${id}`); setSelected(data.request); } catch (e) { Swal.fire("Unable to open", e.response?.data?.message || e.message, "error"); } };
  const cancel = async (row) => { const r = await Swal.fire({ title: "Cancel request?", text: row.request_type_label, icon: "warning", showCancelButton: true, confirmButtonText: "Cancel request" }); if (!r.isConfirmed) return; try { await api.post(`/college-student-requests/${row.id}/cancel`, { reason: "Cancelled by student" }); setSelected(null); await load(); } catch (e) { Swal.fire("Unable to cancel", e.response?.data?.message || e.message, "error"); } };

  return <div className="container-fluid py-4 csr-page">
    <Hero title="My Certificates & Requests" subtitle="Request bonafide, NOC, provisional, migration and other official college documents without visiting the office." />
    <div className="row g-3 mb-4"><Metric icon="bi-files" label="Total Requests" value={counts.total || 0} /><Metric icon="bi-hourglass-split" label="In Process" value={counts.pending || 0} tone="warning" /><Metric icon="bi-patch-check" label="Issued" value={counts.issued || 0} tone="success" /><div className="col-12 col-md-3 d-grid"><button className="btn btn-primary csr-new-btn" onClick={() => setFormOpen(true)}><i className="bi bi-plus-circle me-2" />New Request</button></div></div>
    <div className="card border-0 shadow-sm"><div className="card-body p-0">{loading ? <Loading /> : rows.length ? <div className="table-responsive"><table className="table align-middle mb-0 csr-table"><thead><tr><th>Request</th><th>Submitted</th><th>Required By</th><th>Fee</th><th>Status</th><th></th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><strong>{r.request_type_label}</strong><small>{r.request_number || "Processing request number"}</small></td><td>{dateOnly(r.createdAt)}</td><td>{dateOnly(r.required_by)}</td><td>{r.processing_fee ? `${money(r.processing_fee)} · ${human(r.fee_status)}` : "—"}</td><td><Status value={r.status} /></td><td className="text-end"><button className="btn btn-sm btn-outline-primary" onClick={() => openDetail(r.id)}>View</button>{r.can_download_certificate && <button className="btn btn-sm btn-success ms-2" onClick={() => downloadBlob(`/college-student-requests/${r.id}/certificate`, `${r.certificate_number || "certificate"}.pdf`)}><i className="bi bi-download" /></button>}</td></tr>)}</tbody></table></div> : <Empty text="No document requests yet." />}</div></div>
    {formOpen && <RequestForm types={types} form={form} setForm={setForm} file={file} setFile={setFile} onClose={() => setFormOpen(false)} onSubmit={submit} />}
    {selected && <DetailModal row={selected} student onClose={() => setSelected(null)} onRefresh={() => openDetail(selected.id)} onCancel={() => cancel(selected)} />}
  </div>;
}

function StaffRequests() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [dashboard, setDashboard] = useState({ counts: {} });
  const [types, setTypes] = useState([]);
  const [filter, setFilter] = useState({ status: "", request_type: "", q: "" });
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, dash, typeRes] = await Promise.all([api.get("/college-student-requests"), api.get("/college-student-requests/dashboard"), api.get("/college-student-requests/types")]);
      setRows(list.data?.requests || []); setDashboard(dash.data || { counts: {} }); setTypes(typeRes.data?.types || []);
    } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => rows.filter((r) => { if (filter.status && r.status !== filter.status) return false; if (filter.request_type && r.request_type !== filter.request_type) return false; const q = filter.q.trim().toLowerCase(); return !q || `${r.request_number || ""} ${r.student?.name || ""} ${r.student?.admission_number || ""} ${r.request_type_label || ""}`.toLowerCase().includes(q); }), [rows, filter]);
  const openDetail = async (id) => { try { const { data } = await api.get(`/college-student-requests/${id}`); setSelected(data.request); } catch (e) { Swal.fire("Unable to open", e.response?.data?.message || e.message, "error"); } };
  const saveStatus = async (row, status) => {
    let rejection_reason = row.rejection_reason || "";
    if (status === "rejected") { const r = await Swal.fire({ title: "Reject request", input: "textarea", inputLabel: "Reason", inputValue: rejection_reason, showCancelButton: true, inputValidator: (v) => !v?.trim() && "Rejection reason is required." }); if (!r.isConfirmed) return; rejection_reason = r.value; }
    try { const { data } = await api.patch(`/college-student-requests/${row.id}/status`, { status, rejection_reason, staff_remarks: row.staff_remarks, processing_fee: row.processing_fee, fee_status: row.fee_status }); setSelected(data.request); await load(); }
    catch (e) { Swal.fire("Unable to update", e.response?.data?.message || e.message, "error"); }
  };
  const saveMeta = async (row) => { try { const { data } = await api.patch(`/college-student-requests/${row.id}/status`, { staff_remarks: row.staff_remarks, processing_fee: row.processing_fee, fee_status: row.fee_status }); setSelected(data.request); await load(); Swal.fire("Saved", "Request details updated.", "success"); } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); } };
  const issue = async (row) => { const confirm = await Swal.fire({ title: "Issue this document?", text: "A system-generated PDF and verification code will be created.", icon: "question", showCancelButton: true, confirmButtonText: "Issue Document" }); if (!confirm.isConfirmed) return; try { const { data } = await api.post(`/college-student-requests/${row.id}/issue`, { staff_remarks: row.staff_remarks }); setSelected(data.request); await load(); Swal.fire("Issued", "The student can now download the document.", "success"); } catch (e) { Swal.fire("Unable to issue", e.response?.data?.message || e.message, "error"); } };

  const c = dashboard.counts || {};
  return <div className="container-fluid py-4 csr-page">
    <Hero title="Certificates & Student Requests" subtitle="Review student requests, manage processing fees, approve/issue documents and keep a complete digital status trail." />
    <div className="row g-3 mb-4"><Metric icon="bi-files" label="Total" value={c.total || 0} /><Metric icon="bi-inbox" label="New" value={c.submitted || 0} tone="warning" /><Metric icon="bi-search" label="Under Review" value={c.under_review || 0} tone="info" /><Metric icon="bi-patch-check" label="Issued" value={c.issued || 0} tone="success" /><Metric icon="bi-exclamation-triangle" label="Overdue" value={c.overdue || 0} tone="danger" /></div>
    <div className="card border-0 shadow-sm mb-4"><div className="card-body p-3"><div className="row g-2"><div className="col-md-3"><select className="form-select" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}><option value="">All Statuses</option>{["submitted","under_review","approved","issued","rejected","cancelled"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></div><div className="col-md-3"><select className="form-select" value={filter.request_type} onChange={(e) => setFilter((f) => ({ ...f, request_type: e.target.value }))}><option value="">All Request Types</option>{types.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div><div className="col-md-6"><input className="form-control" placeholder="Search student, admission no., request no..." value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} /></div></div></div></div>
    <div className="card border-0 shadow-sm"><div className="card-body p-0">{loading ? <Loading /> : filtered.length ? <div className="table-responsive"><table className="table align-middle mb-0 csr-table"><thead><tr><th>Student</th><th>Request</th><th>Required</th><th>Fee</th><th>Status</th><th></th></tr></thead><tbody>{filtered.map((r) => <tr key={r.id}><td><strong>{r.student?.name || "Student"}</strong><small>{r.student?.admission_number || "—"} · {r.programSemester?.class_name || ""}</small></td><td><strong>{r.request_type_label}</strong><small>{r.request_number}</small></td><td>{dateOnly(r.required_by)}</td><td>{r.processing_fee ? `${money(r.processing_fee)} · ${human(r.fee_status)}` : "—"}</td><td><Status value={r.status} /></td><td className="text-end"><button className="btn btn-sm btn-outline-primary" onClick={() => openDetail(r.id)}>Process</button></td></tr>)}</tbody></table></div> : <Empty text="No requests match the current filters." />}</div></div>
    {selected && <DetailModal row={selected} onClose={() => setSelected(null)} onRefresh={() => openDetail(selected.id)} onChange={setSelected} onStatus={(s) => saveStatus(selected, s)} onSave={() => saveMeta(selected)} onIssue={() => issue(selected)} />}
  </div>;
}

function RequestForm({ types, form, setForm, file, setFile, onClose, onSubmit }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return <div className="csr-backdrop"><div className="csr-modal"><div className="d-flex align-items-center justify-content-between mb-3"><div><span className="csr-kicker">Student Self Service</span><h2 className="h4 mb-0">New Document Request</h2></div><button className="btn-close" onClick={onClose} /></div><div className="row g-3"><div className="col-md-6"><label className="form-label">Request Type</label><select className="form-select" value={form.request_type} onChange={(e) => set("request_type", e.target.value)}>{types.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>{form.request_type === "custom" && <div className="col-md-6"><label className="form-label">Request Title</label><input className="form-control" value={form.custom_title} onChange={(e) => set("custom_title", e.target.value)} /></div>}<div className="col-md-6"><label className="form-label">Required By</label><input type="date" className="form-control" value={form.required_by} onChange={(e) => set("required_by", e.target.value)} /></div><div className="col-md-6"><label className="form-label">Priority</label><select className="form-select" value={form.priority} onChange={(e) => set("priority", e.target.value)}><option value="normal">Normal</option><option value="urgent">Urgent</option></select></div><div className="col-12"><label className="form-label">Purpose / Reason</label><textarea className="form-control" rows="3" placeholder="e.g. Scholarship application, bank requirement, internship..." value={form.purpose} onChange={(e) => set("purpose", e.target.value)} /></div><div className="col-12"><label className="form-label">Additional Note</label><textarea className="form-control" rows="2" value={form.student_note} onChange={(e) => set("student_note", e.target.value)} /></div><div className="col-12"><label className="form-label">Supporting Document <span className="text-muted">(optional)</span></label><input type="file" className="form-control" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />{file && <small className="text-muted">Selected: {file.name}</small>}</div></div><div className="d-flex justify-content-end gap-2 mt-4"><button className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary px-4" onClick={onSubmit}>Submit Request</button></div></div></div>;
}

function DetailModal({ row, student = false, onClose, onRefresh, onChange, onCancel, onStatus, onSave, onIssue }) {
  const docs = row.documents || [], events = row.events || [];
  const set = (k, v) => onChange?.({ ...row, [k]: v });
  const upload = async () => { const { value: file } = await Swal.fire({ title: "Upload supporting document", input: "file", inputAttributes: { accept: ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" }, showCancelButton: true }); if (!file) return; try { const fd = new FormData(); fd.append("file", file); await api.post(`/college-student-requests/${row.id}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } }); await onRefresh(); } catch (e) { Swal.fire("Unable to upload", e.response?.data?.message || e.message, "error"); } };
  return <div className="csr-backdrop"><div className="csr-modal csr-modal-wide"><div className="d-flex justify-content-between align-items-start gap-3 mb-4"><div><span className="csr-kicker">{row.request_number}</span><h2 className="h4 mb-1">{row.request_type_label}</h2><div className="text-muted">{student ? "Track your request" : `${row.student?.name || "Student"} · ${row.student?.admission_number || ""}`}</div></div><div className="d-flex align-items-center gap-2"><Status value={row.status} /><button className="btn-close" onClick={onClose} /></div></div><div className="row g-3 mb-4"><Info label="Program / Semester" value={row.programSemester?.class_name} /><Info label="Batch / Section" value={row.batchSection?.section_name} /><Info label="Submitted" value={dateOnly(row.createdAt)} /><Info label="Required By" value={dateOnly(row.required_by)} /><Info label="Processing Fee" value={row.processing_fee ? money(row.processing_fee) : "Not set"} /><Info label="Fee Status" value={human(row.fee_status)} /></div>{row.purpose && <div className="csr-note mb-3"><small>Purpose</small><p>{row.purpose}</p></div>}{row.rejection_reason && <div className="alert alert-danger"><strong>Rejection Reason:</strong> {row.rejection_reason}</div>}{!student && <div className="card bg-light border-0 mb-4"><div className="card-body"><div className="row g-3"><div className="col-md-4"><label className="form-label">Processing Fee</label><input type="number" step="0.01" className="form-control" value={row.processing_fee ?? ""} onChange={(e) => set("processing_fee", e.target.value)} /></div><div className="col-md-4"><label className="form-label">Fee Status</label><select className="form-select" value={row.fee_status || "not_applicable"} onChange={(e) => set("fee_status", e.target.value)}>{["not_applicable","pending","paid","waived"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></div><div className="col-12"><label className="form-label">Office Remarks</label><textarea className="form-control" rows="2" value={row.staff_remarks || ""} onChange={(e) => set("staff_remarks", e.target.value)} /></div></div><div className="d-flex flex-wrap gap-2 mt-3"><button className="btn btn-outline-secondary btn-sm" onClick={onSave}>Save Details</button>{row.status === "submitted" && <button className="btn btn-info btn-sm" onClick={() => onStatus("under_review")}>Start Review</button>}{["submitted","under_review"].includes(row.status) && <button className="btn btn-primary btn-sm" onClick={() => onStatus("approved")}>Approve</button>}{!["issued","rejected","cancelled"].includes(row.status) && <button className="btn btn-outline-danger btn-sm" onClick={() => onStatus("rejected")}>Reject</button>}{row.status === "approved" && <button className="btn btn-success btn-sm" onClick={onIssue}><i className="bi bi-file-earmark-check me-1" />Issue PDF</button>}</div></div></div>}
    {row.status === "issued" && <div className="csr-issued mb-4"><div><i className="bi bi-patch-check-fill" /><span><strong>Document Issued</strong><small>{row.certificate_number} · Verification {row.verification_code}</small></span></div><button className="btn btn-success" onClick={() => downloadBlob(`/college-student-requests/${row.id}/certificate`, `${row.certificate_number || "certificate"}.pdf`)}><i className="bi bi-download me-2" />Download PDF</button></div>}
    <div className="row g-4"><div className="col-lg-6"><div className="d-flex justify-content-between align-items-center mb-2"><h3 className="h6 mb-0">Supporting Documents</h3>{(!student || ["submitted","under_review"].includes(row.status)) && <button className="btn btn-sm btn-outline-primary" onClick={upload}>Upload</button>}</div>{docs.length ? docs.map((d) => <button className="csr-doc" key={d.id} onClick={() => downloadBlob(`/college-student-requests/${row.id}/documents/${d.id}/download`, d.original_name)}><i className="bi bi-file-earmark-text" /><span><strong>{d.title || d.original_name}</strong><small>{dateOnly(d.createdAt)}</small></span><i className="bi bi-download ms-auto" /></button>) : <div className="text-muted small">No supporting documents.</div>}</div><div className="col-lg-6"><h3 className="h6 mb-2">Status Timeline</h3><div className="csr-timeline">{events.length ? events.map((e) => <div className="csr-event" key={e.id}><i className="bi bi-circle-fill" /><div><strong>{human(e.event_type)}</strong><small>{dateOnly(e.createdAt)}{e.actor?.name ? ` · ${e.actor.name}` : ""}</small>{e.remarks && <p>{e.remarks}</p>}</div></div>) : <div className="text-muted small">No timeline events.</div>}</div></div></div>
    {student && ["submitted","under_review"].includes(row.status) && <div className="d-flex justify-content-end mt-4"><button className="btn btn-outline-danger" onClick={onCancel}>Cancel Request</button></div>}
  </div></div>;
}

function Hero({ title, subtitle }) { return <div className="csr-hero mb-4"><div><span>College Student Services</span><h1>{title}</h1><p>{subtitle}</p></div><i className="bi bi-file-earmark-check-fill" /></div>; }
function Metric({ icon, label, value, tone = "primary" }) { return <div className="col-6 col-md"><div className={`csr-metric csr-${tone}`}><i className={`bi ${icon}`} /><div><strong>{value}</strong><small>{label}</small></div></div></div>; }
function Status({ value }) { return <span className={`badge rounded-pill text-bg-${statusTone(value)}`}>{human(value || "unknown")}</span>; }
function Info({ label, value }) { return <div className="col-6 col-md-4"><div className="csr-info"><small>{label}</small><strong>{value || "—"}</strong></div></div>; }
function Empty({ text }) { return <div className="text-center py-5 text-muted"><i className="bi bi-inbox fs-2 d-block mb-2" />{text}</div>; }
function Loading() { return <div className="text-center py-5"><span className="spinner-border spinner-border-sm me-2" />Loading…</div>; }
