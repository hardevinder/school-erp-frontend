import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./CollegeUniversityEnrollment.css";

const STAFF = new Set([
  "admission", "admissions", "frontoffice", "front_office", "department_hod", "principal",
  "academic_coordinator", "coordinator", "examination", "admin", "superadmin", "super_admin",
]);

const getRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole") || localStorage.getItem("role");
    return (many.length ? many : [one]).filter(Boolean).map((r) => String(r).toLowerCase());
  } catch {
    return [];
  }
};

const EMPTY = {
  university_name: "",
  affiliated_university: "",
  university_registration_number: "",
  university_roll_number: "",
  enrollment_number: "",
  admission_year: "",
  admission_batch: "",
  registration_date: "",
  abc_id: "",
  apaar_id: "",
  category_quota: "",
  migration_certificate_number: "",
  migration_certificate_date: "",
  previous_qualification: "",
  previous_institution: "",
  previous_board_university: "",
  previous_registration_number: "",
  verification_status: "draft",
  remarks: "",
};

const labelStatus = (s) => ({ draft: "Draft", verified: "Verified", needs_review: "Needs Review" }[s] || "Not Added");
const statusClass = (s) => ({ draft: "warning", verified: "success", needs_review: "danger" }[s] || "secondary");
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");

export default function CollegeUniversityEnrollment() {
  const { isCollege } = useInstitution();
  const roles = useMemo(getRoles, []);
  const isStudent = roles.includes("student");
  const canManage = roles.some((r) => STAFF.has(r));

  if (!isCollege) {
    return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">University Registration / Enrollment is available in <strong>College mode</strong>.</div></div>;
  }
  if (isStudent) return <StudentEnrollment />;
  if (canManage) return <StaffEnrollment />;
  return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4">Your role does not have access to University Enrollment.</div></div>;
}

function StudentEnrollment() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/college-enrollment/my")
      .then(({ data: d }) => setData(d || {}))
      .catch((e) => Swal.fire("Unable to load", e?.response?.data?.message || e.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container-fluid py-4 text-muted">Loading university enrollment…</div>;
  const s = data?.student || {};
  const x = data?.identity || {};
  const complete = data?.completeness || {};

  return <main className="cue-page container-fluid py-4 px-3 px-md-4">
    <Hero subtitle="Your university registration, enrollment and academic identity details." />
    <div className="cue-student-head mb-4">
      <div><h2>{s.name || "Student"}</h2><p>{s.admission_number || "—"} · {s.program_semester || "Program / Semester"}{s.batch_section ? ` · ${s.batch_section}` : ""}</p></div>
      <div className="text-end"><span className={`badge text-bg-${statusClass(x.verification_status)} rounded-pill px-3 py-2`}>{labelStatus(x.verification_status)}</span><small className="d-block mt-2 text-muted">Profile completion {complete.percent || 0}%</small></div>
    </div>
    {!data?.identity && <div className="alert alert-warning rounded-4">University enrollment details have not been added yet. Please contact the College Office / Academic Section.</div>}
    <div className="row g-3">
      <IdentityCard title="University Identity" icon="bi-bank" rows={[
        ["University / Institution", x.university_name], ["Affiliated University", x.affiliated_university],
        ["University Registration No.", x.university_registration_number], ["University Roll No.", x.university_roll_number],
        ["Enrollment No.", x.enrollment_number], ["Registration Date", dateOnly(x.registration_date)],
      ]} />
      <IdentityCard title="Admission & Academic IDs" icon="bi-person-vcard" rows={[
        ["Admission Year", x.admission_year], ["Admission Batch", x.admission_batch], ["ABC ID", x.abc_id],
        ["APAAR ID", x.apaar_id], ["Category / Quota", x.category_quota], ["Academic Year", s.academic_year],
      ]} />
      <IdentityCard title="Previous / Migration Details" icon="bi-arrow-left-right" rows={[
        ["Migration Certificate No.", x.migration_certificate_number], ["Migration Date", dateOnly(x.migration_certificate_date)],
        ["Previous Qualification", x.previous_qualification], ["Previous Institution", x.previous_institution],
        ["Previous Board / University", x.previous_board_university], ["Previous Registration No.", x.previous_registration_number],
      ]} />
    </div>
    <div className="cue-document-note mt-4"><div><i className="bi bi-shield-lock-fill"/><span><strong>Registration documents</strong><small>Registration card, migration certificate, admit card and other files are kept in the secure Document Vault.</small></span></div><Link className="btn btn-outline-primary" to="/document-vault">Open My Documents</Link></div>
  </main>;
}

function IdentityCard({ title, icon, rows }) {
  return <div className="col-12 col-xl-4"><section className="cue-card h-100"><div className="cue-card-title"><i className={`bi ${icon}`}/><h3>{title}</h3></div>{rows.map(([k, v]) => <div className="cue-field" key={k}><span>{k}</span><strong>{v || "—"}</strong></div>)}</section></div>;
}

function StaffEnrollment() {
  const [data, setData] = useState({ rows: [], sessions: [], classes: [], sections: [], summary: {} });
  const [filters, setFilters] = useState({ session_id: "", class_id: "", section_id: "", search: "", verification_status: "" });
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get("/college-enrollment/setup", { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "")) });
      setData(d || { rows: [], sessions: [], classes: [], sections: [], summary: {} });
    } catch (e) {
      Swal.fire("Unable to load", e?.response?.data?.message || e.message, "error");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const openEdit = (row) => {
    const x = row.identity || {};
    setEditing(row);
    setForm({ ...EMPTY, ...x, registration_date: dateOnly(x.registration_date), migration_certificate_date: dateOnly(x.migration_certificate_date) });
  };
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/college-enrollment/students/${editing.id}`, form);
      await Swal.fire("Saved", "University enrollment details updated.", "success");
      setEditing(null); await load();
    } catch (e) { Swal.fire("Unable to save", e?.response?.data?.message || e.message, "error"); }
    finally { setSaving(false); }
  };

  const sections = (data.sections || []).filter((s) => !filters.class_id || Number(s.class_id) === Number(filters.class_id));
  const sum = data.summary || {};

  return <main className="cue-page container-fluid py-4 px-3 px-md-4">
    <Hero subtitle="Manage university registration numbers, enrollment IDs, admission batch, ABC/APAAR and migration details." />
    <div className="row g-3 mb-4">
      <Summary label="Students" value={sum.total || 0} icon="bi-people" />
      <Summary label="Verified" value={sum.verified || 0} icon="bi-patch-check" />
      <Summary label="Complete Profiles" value={sum.complete || 0} icon="bi-check2-circle" />
      <Summary label="Not Added" value={sum.missing || 0} icon="bi-exclamation-circle" />
    </div>
    <section className="cue-filter mb-3">
      <div><label>Academic Year</label><select className="form-select" value={filters.session_id} onChange={(e)=>setFilters(p=>({...p,session_id:e.target.value}))}><option value="">All</option>{(data.sessions||[]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div><label>Program / Semester</label><select className="form-select" value={filters.class_id} onChange={(e)=>setFilters(p=>({...p,class_id:e.target.value,section_id:""}))}><option value="">All</option>{(data.classes||[]).map(x=><option key={x.id} value={x.id}>{x.class_name}</option>)}</select></div>
      <div><label>Batch / Section</label><select className="form-select" value={filters.section_id} onChange={(e)=>setFilters(p=>({...p,section_id:e.target.value}))}><option value="">All</option>{sections.map(x=><option key={x.id} value={x.id}>{x.section_name}</option>)}</select></div>
      <div><label>Status</label><select className="form-select" value={filters.verification_status} onChange={(e)=>setFilters(p=>({...p,verification_status:e.target.value}))}><option value="">All</option><option value="draft">Draft</option><option value="verified">Verified</option><option value="needs_review">Needs Review</option></select></div>
      <div className="cue-search"><label>Search Student</label><input className="form-control" placeholder="Name / admission no." value={filters.search} onChange={(e)=>setFilters(p=>({...p,search:e.target.value}))}/></div>
      <button className="btn btn-outline-primary align-self-end" onClick={load} disabled={loading}><i className="bi bi-arrow-repeat me-1"/>Refresh</button>
    </section>
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden"><div className="table-responsive"><table className="table align-middle mb-0 cue-table"><thead><tr><th>Student</th><th>Program / Semester</th><th>University Reg.</th><th>Enrollment No.</th><th>University Roll</th><th>Profile</th><th>Status</th><th></th></tr></thead><tbody>
      {(data.rows||[]).map(row=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.admission_number || "—"}</small></td><td>{row.program_semester || "—"}<small>{row.batch_section || ""}</small></td><td>{row.identity?.university_registration_number || "—"}</td><td>{row.identity?.enrollment_number || "—"}</td><td>{row.identity?.university_roll_number || "—"}</td><td><div className="cue-progress"><div style={{width:`${row.completeness?.percent||0}%`}}/></div><small>{row.completeness?.percent||0}% complete</small></td><td><span className={`badge text-bg-${statusClass(row.identity?.verification_status)} rounded-pill`}>{labelStatus(row.identity?.verification_status)}</span></td><td className="text-end"><button className="btn btn-sm btn-primary" onClick={()=>openEdit(row)}>{row.identity ? "Edit" : "Add Details"}</button></td></tr>)}
    </tbody></table></div>{loading&&<div className="p-3 text-muted">Loading…</div>}{!loading&&!(data.rows||[]).length&&<div className="p-5 text-center text-muted">No students found for the selected filters.</div>}</div>
    <div className="cue-document-note mt-3"><div><i className="bi bi-shield-lock-fill"/><span><strong>Student documents stay in Document Vault</strong><small>Use the existing secure vault for registration card, migration certificate, university admit card and related files.</small></span></div><Link className="btn btn-outline-primary" to="/document-vault">Open Document Vault</Link></div>
    {editing && <EnrollmentModal row={editing} form={form} set={set} save={save} saving={saving} close={()=>setEditing(null)} />}
  </main>;
}

function Hero({ subtitle }) { return <div className="cue-hero mb-4"><div><span>College Academics</span><h1>University Registration · Enrollment</h1><p>{subtitle}</p></div><i className="bi bi-person-vcard-fill"/></div>; }
function Summary({ label, value, icon }) { return <div className="col-6 col-xl-3"><div className="cue-summary"><i className={`bi ${icon}`}/><div><strong>{value}</strong><span>{label}</span></div></div></div>; }

function EnrollmentModal({ row, form, set, save, saving, close }) {
  return <div className="cue-modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)close();}}><div className="cue-modal"><div className="cue-modal-head"><div><small>{row.program_semester || "Program / Semester"}</small><h2>{row.name}</h2><p>{row.admission_number || "—"}</p></div><button className="btn-close" onClick={close}/></div><div className="cue-modal-body">
    <FormSection title="University Identity">
      <Field label="University / Institution Name" value={form.university_name} onChange={v=>set("university_name",v)} />
      <Field label="Affiliated University" value={form.affiliated_university} onChange={v=>set("affiliated_university",v)} />
      <Field label="University Registration No." value={form.university_registration_number} onChange={v=>set("university_registration_number",v)} />
      <Field label="University Roll No." value={form.university_roll_number} onChange={v=>set("university_roll_number",v)} />
      <Field label="Enrollment No." value={form.enrollment_number} onChange={v=>set("enrollment_number",v)} />
      <Field label="Registration Date" type="date" value={form.registration_date} onChange={v=>set("registration_date",v)} />
    </FormSection>
    <FormSection title="Admission & Academic IDs">
      <Field label="Admission Year" type="number" value={form.admission_year} onChange={v=>set("admission_year",v)} />
      <Field label="Admission Batch" value={form.admission_batch} onChange={v=>set("admission_batch",v)} placeholder="e.g. 2026-29" />
      <Field label="ABC ID" value={form.abc_id} onChange={v=>set("abc_id",v)} />
      <Field label="APAAR ID" value={form.apaar_id} onChange={v=>set("apaar_id",v)} />
      <Field label="Category / Quota" value={form.category_quota} onChange={v=>set("category_quota",v)} />
      <div className="cue-field-input"><label>Verification</label><select className="form-select" value={form.verification_status} onChange={e=>set("verification_status",e.target.value)}><option value="draft">Draft</option><option value="verified">Verified</option><option value="needs_review">Needs Review</option></select></div>
    </FormSection>
    <FormSection title="Migration / Previous Qualification">
      <Field label="Migration Certificate No." value={form.migration_certificate_number} onChange={v=>set("migration_certificate_number",v)} />
      <Field label="Migration Certificate Date" type="date" value={form.migration_certificate_date} onChange={v=>set("migration_certificate_date",v)} />
      <Field label="Previous Qualification" value={form.previous_qualification} onChange={v=>set("previous_qualification",v)} placeholder="e.g. 10+2 / Diploma" />
      <Field label="Previous Institution" value={form.previous_institution} onChange={v=>set("previous_institution",v)} />
      <Field label="Previous Board / University" value={form.previous_board_university} onChange={v=>set("previous_board_university",v)} />
      <Field label="Previous Registration No." value={form.previous_registration_number} onChange={v=>set("previous_registration_number",v)} />
    </FormSection>
    <div className="cue-field-input full"><label>Remarks</label><textarea className="form-control" rows="3" value={form.remarks||""} onChange={e=>set("remarks",e.target.value)} placeholder="Optional academic office note"/></div>
  </div><div className="cue-modal-foot"><button className="btn btn-light" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Enrollment Details"}</button></div></div></div>;
}
function FormSection({ title, children }) { return <section className="cue-form-section"><h3>{title}</h3><div className="cue-form-grid">{children}</div></section>; }
function Field({ label, value, onChange, type="text", placeholder="" }) { return <div className="cue-field-input"><label>{label}</label><input className="form-control" type={type} value={value ?? ""} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></div>; }
