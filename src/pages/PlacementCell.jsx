import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./PlacementCell.css";

const roles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const single = localStorage.getItem("userRole");
    return (many.length ? many : [single]).filter(Boolean).map((r) => String(r).toLowerCase());
  } catch (_) {
    return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean);
  }
};

const MANAGE = new Set(["placement_officer", "department_hod", "principal", "academic_coordinator", "coordinator", "admin", "superadmin", "super_admin"]);
const human = (v) => String(v || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const fmtDate = (v) => v ? new Date(v).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtDateOnly = (v) => v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" }) : "—";
const n = (v) => Number(v || 0);
const statusClass = (status) => ({ open: "success", completed: "primary", cancelled: "danger", closed: "secondary", draft: "warning", applied: "info", shortlisted: "primary", in_process: "warning", selected: "success", offered: "success", joined: "success", rejected: "danger", withdrawn: "secondary" }[status] || "secondary");

const EMPTY_DRIVE = {
  company_id: "", title: "", job_role: "", job_type: "full_time", work_mode: "not_specified",
  location: "", package_text: "", min_cgpa: "", max_backlogs: "", min_attendance_percent: "",
  eligibility_notes: "", description: "", registration_deadline: "", drive_date: "", venue: "",
  external_registration_url: "", status: "draft", notify_students: true, institution_wide: true, program_ids: [],
};

export default function PlacementCell() {
  const { isCollege } = useInstitution();
  const roleList = roles();
  const isStudent = roleList.includes("student");
  const canManage = roleList.some((r) => MANAGE.has(r));

  if (!isCollege) {
    return <div className="container-fluid py-4"><div className="alert alert-info rounded-4 shadow-sm"><h5 className="mb-1"><i className="bi bi-briefcase me-2" />Placement & Career Cell</h5><div>This module is designed for College mode.</div></div></div>;
  }
  if (isStudent) return <StudentPlacement />;
  if (canManage) return <StaffPlacement />;
  return <div className="container-fluid py-4"><div className="alert alert-warning">Your role does not have Placement Cell access.</div></div>;
}

function StaffPlacement() {
  const [tab, setTab] = useState("drives");
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({});
  const [meta, setMeta] = useState({ programs: [], companies: [] });
  const [drives, setDrives] = useState([]);
  const [applications, setApplications] = useState([]);
  const [showDriveForm, setShowDriveForm] = useState(false);
  const [editingDrive, setEditingDrive] = useState(null);
  const [driveForm, setDriveForm] = useState(EMPTY_DRIVE);
  const [saving, setSaving] = useState(false);
  const [appDriveFilter, setAppDriveFilter] = useState("");
  const [roundDriveId, setRoundDriveId] = useState("");
  const [selectedRoundId, setSelectedRoundId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, metaRes, driveRes, appRes] = await Promise.all([
        api.get("/college-placement/dashboard"),
        api.get("/college-placement/meta"),
        api.get("/college-placement/drives"),
        api.get("/college-placement/applications"),
      ]);
      setDashboard(dashRes.data || {});
      setMeta(metaRes.data || { programs: [], companies: [] });
      setDrives(driveRes.data?.drives || []);
      setApplications(appRes.data?.applications || []);
    } catch (error) {
      Swal.fire("Unable to load", error?.response?.data?.message || error.message, "error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNewDrive = () => { setEditingDrive(null); setDriveForm({ ...EMPTY_DRIVE }); setShowDriveForm(true); };
  const editDrive = (row) => {
    setEditingDrive(row);
    setDriveForm({
      ...EMPTY_DRIVE,
      ...row,
      company_id: row.company_id || row.company?.id || "",
      program_ids: (row.programs || []).map((p) => n(p.class_id)),
      registration_deadline: row.registration_deadline ? String(row.registration_deadline).slice(0, 16) : "",
      drive_date: row.drive_date ? String(row.drive_date).slice(0, 16) : "",
      institution_wide: !row.branch_id,
    });
    setShowDriveForm(true);
  };

  const setDrive = (key, value) => setDriveForm((f) => ({ ...f, [key]: value }));
  const toggleProgram = (id) => setDriveForm((f) => ({ ...f, program_ids: f.program_ids.includes(n(id)) ? f.program_ids.filter((x) => x !== n(id)) : [...f.program_ids, n(id)] }));

  const saveDrive = async () => {
    if (!driveForm.company_id || !driveForm.title.trim()) return Swal.fire("Required", "Select a company and enter a drive title.", "warning");
    setSaving(true);
    try {
      const payload = { ...driveForm, company_id: n(driveForm.company_id) };
      const { data } = editingDrive
        ? await api.put(`/college-placement/drives/${editingDrive.id}`, payload)
        : await api.post("/college-placement/drives", payload);
      await Swal.fire("Saved", data?.message || "Placement drive saved.", "success");
      setShowDriveForm(false); setEditingDrive(null); setDriveForm({ ...EMPTY_DRIVE }); await load();
    } catch (error) { Swal.fire("Unable to save", error?.response?.data?.message || error.message, "error"); }
    finally { setSaving(false); }
  };

  const deleteDrive = async (row) => {
    const ask = await Swal.fire({ title: "Delete this drive?", text: "Drives with applications cannot be deleted.", icon: "warning", showCancelButton: true, confirmButtonText: "Delete" });
    if (!ask.isConfirmed) return;
    try { await api.delete(`/college-placement/drives/${row.id}`); await load(); }
    catch (error) { Swal.fire("Cannot delete", error?.response?.data?.message || error.message, "error"); }
  };

  const addCompany = async () => {
    const { value: values } = await Swal.fire({
      title: "Add Company",
      html: `<input id="pc-company" class="swal2-input" placeholder="Company name"><input id="pc-industry" class="swal2-input" placeholder="Industry"><input id="pc-location" class="swal2-input" placeholder="Location"><input id="pc-website" class="swal2-input" placeholder="Website (optional)">`,
      focusConfirm: false, showCancelButton: true,
      preConfirm: () => ({ name: document.getElementById("pc-company")?.value, industry: document.getElementById("pc-industry")?.value, location: document.getElementById("pc-location")?.value, website: document.getElementById("pc-website")?.value, institution_wide: true }),
    });
    if (!values) return;
    try { await api.post("/college-placement/companies", values); await load(); }
    catch (error) { Swal.fire("Unable to add company", error?.response?.data?.message || error.message, "error"); }
  };

  const updateApplication = async (app, changes) => {
    try { await api.put(`/college-placement/applications/${app.id}`, changes); await load(); }
    catch (error) { Swal.fire("Unable to update", error?.response?.data?.message || error.message, "error"); }
  };

  const createOffer = async (app) => {
    const { value: values } = await Swal.fire({
      title: `Offer · ${app.student?.name || "Student"}`,
      html: `<input id="pc-designation" class="swal2-input" placeholder="Designation" value="${String(app.drive?.job_role || "").replace(/"/g, "&quot;")}"><input id="pc-package" class="swal2-input" placeholder="Package / CTC"><input id="pc-offer-location" class="swal2-input" placeholder="Location"><input id="pc-joining" type="date" class="swal2-input"><input id="pc-offer-url" class="swal2-input" placeholder="Offer letter URL (optional)">`,
      showCancelButton: true, focusConfirm: false,
      preConfirm: () => ({ designation: document.getElementById("pc-designation")?.value, package_text: document.getElementById("pc-package")?.value, location: document.getElementById("pc-offer-location")?.value, joining_date: document.getElementById("pc-joining")?.value || null, offer_letter_url: document.getElementById("pc-offer-url")?.value, status: "offered" }),
    });
    if (!values) return;
    try { await api.put(`/college-placement/applications/${app.id}/offer`, values); await Swal.fire("Offer saved", "Student has been notified.", "success"); await load(); }
    catch (error) { Swal.fire("Unable to create offer", error?.response?.data?.message || error.message, "error"); }
  };

  const selectedRoundDrive = drives.find((d) => n(d.id) === n(roundDriveId));
  const roundRows = [...(selectedRoundDrive?.rounds || [])].sort((a, b) => n(a.round_order) - n(b.round_order));
  const roundApps = applications.filter((a) => n(a.drive_id) === n(roundDriveId));

  const createRound = async () => {
    if (!roundDriveId) return Swal.fire("Select drive", "Select a placement drive first.", "info");
    const { value: values } = await Swal.fire({
      title: "Add Selection Round",
      html: `<input id="pc-round-name" class="swal2-input" placeholder="e.g. Technical Interview"><select id="pc-round-type" class="swal2-select"><option value="screening">Screening</option><option value="aptitude">Aptitude</option><option value="technical">Technical</option><option value="group_discussion">Group Discussion</option><option value="interview" selected>Interview</option><option value="hr">HR</option><option value="other">Other</option></select><input id="pc-round-date" type="datetime-local" class="swal2-input"><input id="pc-round-venue" class="swal2-input" placeholder="Venue / meeting location">`,
      showCancelButton: true, focusConfirm: false,
      preConfirm: () => ({ name: document.getElementById("pc-round-name")?.value, round_type: document.getElementById("pc-round-type")?.value, scheduled_at: document.getElementById("pc-round-date")?.value || null, venue: document.getElementById("pc-round-venue")?.value }),
    });
    if (!values?.name) return;
    try { await api.post(`/college-placement/drives/${roundDriveId}/rounds`, values); await load(); }
    catch (error) { Swal.fire("Unable to add round", error?.response?.data?.message || error.message, "error"); }
  };

  const updateRoundResult = async (app, result) => {
    if (!selectedRoundId) return;
    try { await api.put(`/college-placement/rounds/${selectedRoundId}/results/${app.id}`, { result }); await load(); }
    catch (error) { Swal.fire("Unable to save result", error?.response?.data?.message || error.message, "error"); }
  };

  const filteredApplications = useMemo(() => appDriveFilter ? applications.filter((a) => n(a.drive_id) === n(appDriveFilter)) : applications, [applications, appDriveFilter]);

  return <div className="container-fluid py-4 pc-page">
    <div className="pc-hero mb-4">
      <div><div className="pc-kicker">EduBridge College ERP</div><h1>Placement & Career Cell</h1><p>Manage companies, drives, student applications, selection rounds and offers from one place.</p></div>
      <button className="btn btn-light" onClick={openNewDrive}><i className="bi bi-plus-lg me-2" />New Placement Drive</button>
    </div>

    <div className="pc-stat-grid mb-4">
      <Stat icon="bi-buildings" label="Companies" value={dashboard.companies} />
      <Stat icon="bi-megaphone" label="Open Drives" value={dashboard.open_drives} />
      <Stat icon="bi-person-lines-fill" label="Applications" value={dashboard.applications} />
      <Stat icon="bi-person-check" label="Shortlisted" value={dashboard.shortlisted} />
      <Stat icon="bi-trophy" label="Selected / Offered" value={dashboard.selected} />
      <Stat icon="bi-briefcase-fill" label="Joined" value={dashboard.joined} />
    </div>

    <div className="pc-tabs mb-3">
      {[['drives','Placement Drives','bi-megaphone'],['applications','Applications','bi-people'],['rounds','Selection Rounds','bi-diagram-3'],['companies','Companies','bi-buildings']].map(([k,l,i]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}><i className={`bi ${i}`} />{l}</button>)}
    </div>

    {loading ? <div className="pc-loading"><span className="spinner-border text-primary" /> Loading Placement Cell…</div> : null}

    {!loading && tab === "drives" && <div className="row g-3">
      {!drives.length && <Empty text="No placement drives yet. Create the first company drive." />}
      {drives.map((drive) => <div className="col-12 col-xl-6" key={drive.id}><div className="pc-drive-card">
        <div className="d-flex justify-content-between gap-3"><div><div className="pc-company-name">{drive.company?.name || "Company"}</div><h3>{drive.title}</h3><div className="text-muted">{drive.job_role || "Role not specified"} · {human(drive.job_type)}</div></div><span className={`badge text-bg-${statusClass(drive.status)} align-self-start`}>{human(drive.status)}</span></div>
        <div className="pc-drive-meta"><span><i className="bi bi-geo-alt" />{drive.location || drive.venue || "Location TBA"}</span><span><i className="bi bi-cash-stack" />{drive.package_text || "Package TBA"}</span><span><i className="bi bi-calendar-event" />Drive: {fmtDate(drive.drive_date)}</span><span><i className="bi bi-hourglass-split" />Deadline: {fmtDate(drive.registration_deadline)}</span></div>
        <div className="pc-programs">{(drive.programs || []).length ? drive.programs.map((p) => <span key={p.id}>{p.program?.class_name || `Program ${p.class_id}`}</span>) : <span>All programs</span>}</div>
        <div className="d-flex justify-content-between align-items-center mt-3"><strong>{drive.applications_count || 0} applications</strong><div className="btn-group btn-group-sm"><button className="btn btn-outline-primary" onClick={() => editDrive(drive)}>Edit</button><button className="btn btn-outline-danger" onClick={() => deleteDrive(drive)}>Delete</button></div></div>
      </div></div>)}
    </div>}

    {!loading && tab === "applications" && <div className="pc-panel">
      <div className="pc-panel-head"><div><small>Student pipeline</small><h2>Placement Applications</h2></div><select className="form-select form-select-sm" value={appDriveFilter} onChange={(e) => setAppDriveFilter(e.target.value)}><option value="">All drives</option>{drives.map((d) => <option key={d.id} value={d.id}>{d.company?.name} · {d.title}</option>)}</select></div>
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Student</th><th>Drive</th><th>Eligibility</th><th>Application Status</th><th>Offer</th></tr></thead><tbody>
        {!filteredApplications.length && <tr><td colSpan="5" className="text-center text-muted py-5">No applications found.</td></tr>}
        {filteredApplications.map((app) => <tr key={app.id}><td><strong>{app.student?.name || "Student"}</strong><div className="small text-muted">{app.student?.admission_number} · {app.student?.Class?.class_name || ""} {app.student?.Section?.section_name || ""}</div></td><td><strong>{app.drive?.company?.name || ""}</strong><div className="small text-muted">{app.drive?.title || ""}</div></td><td><select className="form-select form-select-sm" value={app.eligibility_status} onChange={(e) => updateApplication(app, { eligibility_status: e.target.value })}><option value="pending">Pending Review</option><option value="eligible">Eligible</option><option value="not_eligible">Not Eligible</option><option value="waived">Waived</option></select></td><td><select className="form-select form-select-sm" value={app.status} onChange={(e) => updateApplication(app, { status: e.target.value })}>{['applied','shortlisted','in_process','rejected','selected','withdrawn','offered','joined'].map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></td><td>{app.offer ? <div><span className={`badge text-bg-${app.offer.status === 'joined' ? 'success' : 'primary'}`}>{human(app.offer.status)}</span><div className="small text-muted mt-1">{app.offer.package_text || app.offer.designation}</div></div> : <button className="btn btn-sm btn-success" disabled={!['selected','offered'].includes(app.status)} onClick={() => createOffer(app)}>Create Offer</button>}</td></tr>)}
      </tbody></table></div>
    </div>}

    {!loading && tab === "rounds" && <div className="pc-panel">
      <div className="pc-panel-head flex-wrap gap-2"><div><small>Selection workflow</small><h2>Rounds & Results</h2></div><div className="d-flex gap-2"><select className="form-select form-select-sm" value={roundDriveId} onChange={(e) => { setRoundDriveId(e.target.value); setSelectedRoundId(""); }}><option value="">Select drive</option>{drives.map((d) => <option key={d.id} value={d.id}>{d.company?.name} · {d.title}</option>)}</select><button className="btn btn-sm btn-primary text-nowrap" onClick={createRound}>+ Add Round</button></div></div>
      {roundDriveId && <><div className="pc-round-strip">{!roundRows.length && <span className="text-muted">No rounds added yet.</span>}{roundRows.map((r) => <button key={r.id} className={n(selectedRoundId) === n(r.id) ? "active" : ""} onClick={() => setSelectedRoundId(r.id)}><strong>{r.round_order}. {r.name}</strong><small>{human(r.round_type)} · {fmtDate(r.scheduled_at)}</small></button>)}</div>
      {selectedRoundId && <div className="table-responsive mt-3"><table className="table align-middle"><thead><tr><th>Student</th><th>Current Status</th><th>Round Result</th></tr></thead><tbody>{roundApps.map((app) => { const result = (app.round_results || []).find((x) => n(x.round_id) === n(selectedRoundId)); return <tr key={app.id}><td><strong>{app.student?.name}</strong><div className="small text-muted">{app.student?.admission_number}</div></td><td>{human(app.status)}</td><td><select className="form-select form-select-sm" value={result?.result || "pending"} onChange={(e) => updateRoundResult(app, e.target.value)}><option value="pending">Pending</option><option value="cleared">Cleared</option><option value="not_cleared">Not Cleared</option><option value="absent">Absent</option><option value="on_hold">On Hold</option></select></td></tr>; })}</tbody></table></div>}</>}
    </div>}

    {!loading && tab === "companies" && <div className="pc-panel"><div className="pc-panel-head"><div><small>Recruiter directory</small><h2>Companies</h2></div><button className="btn btn-sm btn-primary" onClick={addCompany}>+ Add Company</button></div><div className="row g-3">{(meta.companies || []).map((c) => <div className="col-12 col-md-6 col-xl-4" key={c.id}><div className="pc-company-card"><div className="pc-company-icon"><i className="bi bi-building" /></div><div><h3>{c.name}</h3><p>{c.industry || "Industry not specified"}</p><small>{c.location || c.contact_email || ""}</small></div></div></div>)}</div></div>}

    {showDriveForm && <div className="pc-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowDriveForm(false)}><div className="pc-modal"><div className="pc-modal-head"><div><small>Placement Cell</small><h2>{editingDrive ? "Edit Placement Drive" : "New Placement Drive"}</h2></div><button className="btn-close" onClick={() => setShowDriveForm(false)} /></div><div className="pc-modal-body"><div className="row g-3">
      <Field label="Company *" col="col-12 col-md-6"><div className="input-group"><select className="form-select" value={driveForm.company_id} onChange={(e) => setDrive("company_id", e.target.value)}><option value="">Select company</option>{(meta.companies || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn btn-outline-secondary" onClick={addCompany} type="button">+</button></div></Field>
      <Field label="Drive Title *" col="col-12 col-md-6"><input className="form-control" value={driveForm.title} onChange={(e) => setDrive("title", e.target.value)} placeholder="Campus Recruitment Drive" /></Field>
      <Field label="Job Role" col="col-12 col-md-6"><input className="form-control" value={driveForm.job_role || ""} onChange={(e) => setDrive("job_role", e.target.value)} placeholder="Software Engineer" /></Field>
      <Field label="Package / CTC" col="col-12 col-md-3"><input className="form-control" value={driveForm.package_text || ""} onChange={(e) => setDrive("package_text", e.target.value)} placeholder="₹5–7 LPA" /></Field>
      <Field label="Location" col="col-12 col-md-3"><input className="form-control" value={driveForm.location || ""} onChange={(e) => setDrive("location", e.target.value)} /></Field>
      <Field label="Job Type" col="col-6 col-md-3"><select className="form-select" value={driveForm.job_type} onChange={(e) => setDrive("job_type", e.target.value)}><option value="full_time">Full Time</option><option value="internship">Internship</option><option value="apprenticeship">Apprenticeship</option><option value="contract">Contract</option><option value="other">Other</option></select></Field>
      <Field label="Work Mode" col="col-6 col-md-3"><select className="form-select" value={driveForm.work_mode} onChange={(e) => setDrive("work_mode", e.target.value)}><option value="not_specified">Not Specified</option><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></Field>
      <Field label="Registration Deadline" col="col-12 col-md-3"><input type="datetime-local" className="form-control" value={driveForm.registration_deadline || ""} onChange={(e) => setDrive("registration_deadline", e.target.value)} /></Field>
      <Field label="Drive Date" col="col-12 col-md-3"><input type="datetime-local" className="form-control" value={driveForm.drive_date || ""} onChange={(e) => setDrive("drive_date", e.target.value)} /></Field>
      <Field label="Venue" col="col-12 col-md-6"><input className="form-control" value={driveForm.venue || ""} onChange={(e) => setDrive("venue", e.target.value)} placeholder="Seminar Hall / Online" /></Field>
      <div className="col-12"><label className="form-label">Eligible Programs / Semesters</label><div className="pc-program-picker"><label className={!driveForm.program_ids.length ? "selected" : ""}><span>All Programs</span><small>Leave all unchecked to make the drive available to every program.</small></label>{(meta.programs || []).map((p) => <label key={p.id} className={driveForm.program_ids.includes(n(p.id)) ? "selected" : ""}><input type="checkbox" checked={driveForm.program_ids.includes(n(p.id))} onChange={() => toggleProgram(p.id)} />{p.class_name}</label>)}</div></div>
      <Field label="Minimum CGPA" col="col-6 col-md-2"><input type="number" step="0.01" className="form-control" value={driveForm.min_cgpa ?? ""} onChange={(e) => setDrive("min_cgpa", e.target.value)} /></Field>
      <Field label="Max Backlogs" col="col-6 col-md-2"><input type="number" className="form-control" value={driveForm.max_backlogs ?? ""} onChange={(e) => setDrive("max_backlogs", e.target.value)} /></Field>
      <Field label="Min Attendance %" col="col-6 col-md-2"><input type="number" step="0.01" className="form-control" value={driveForm.min_attendance_percent ?? ""} onChange={(e) => setDrive("min_attendance_percent", e.target.value)} /></Field>
      <Field label="External Registration URL" col="col-12 col-md-6"><input className="form-control" value={driveForm.external_registration_url || ""} onChange={(e) => setDrive("external_registration_url", e.target.value)} placeholder="https://company.com/apply" /></Field>
      <Field label="Eligibility Notes" col="col-12"><textarea className="form-control" rows="2" value={driveForm.eligibility_notes || ""} onChange={(e) => setDrive("eligibility_notes", e.target.value)} placeholder="Eligible branches, passing year, skills, etc." /></Field>
      <Field label="Drive Description" col="col-12"><textarea className="form-control" rows="3" value={driveForm.description || ""} onChange={(e) => setDrive("description", e.target.value)} /></Field>
      <Field label="Status" col="col-6 col-md-3"><select className="form-select" value={driveForm.status} onChange={(e) => setDrive("status", e.target.value)}><option value="draft">Draft</option><option value="open">Open / Publish</option><option value="closed">Closed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></Field>
      <div className="col-12 col-md-9 d-flex flex-wrap align-items-end gap-4 pb-1"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={!!driveForm.notify_students} onChange={(e) => setDrive("notify_students", e.target.checked)} /><label className="form-check-label">Notify eligible students when published</label></div><div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={!!driveForm.institution_wide} onChange={(e) => setDrive("institution_wide", e.target.checked)} /><label className="form-check-label">Institution-wide drive</label></div></div>
    </div></div><div className="pc-modal-footer"><button className="btn btn-light" onClick={() => setShowDriveForm(false)}>Cancel</button><button className="btn btn-primary px-4" disabled={saving} onClick={saveDrive}>{saving ? "Saving…" : editingDrive ? "Update Drive" : "Save Drive"}</button></div></div></div>}
  </div>;
}

function StudentPlacement() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ drives: [], applications: [], student: null });
  const load = useCallback(async () => { setLoading(true); try { const { data: response } = await api.get("/college-placement/student/me"); setData(response || {}); } catch (error) { Swal.fire("Unable to load", error?.response?.data?.message || error.message, "error"); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);

  const apply = async (drive) => {
    const { value: values } = await Swal.fire({
      title: `Apply · ${drive.company?.name || "Placement Drive"}`,
      html: `<input id="pc-resume" class="swal2-input" placeholder="Resume URL (Google Drive/portfolio)"><input id="pc-email" class="swal2-input" placeholder="Email"><input id="pc-phone" class="swal2-input" placeholder="Phone"><textarea id="pc-note" class="swal2-textarea" placeholder="Short note (optional)"></textarea>`,
      showCancelButton: true, confirmButtonText: "Submit Application", focusConfirm: false,
      preConfirm: () => ({ resume_url: document.getElementById("pc-resume")?.value, student_email: document.getElementById("pc-email")?.value, student_phone: document.getElementById("pc-phone")?.value, note: document.getElementById("pc-note")?.value }),
    });
    if (!values) return;
    try { const { data: response } = await api.post(`/college-placement/student/drives/${drive.id}/apply`, values); await Swal.fire("Applied", response?.message || "Application submitted.", "success"); await load(); }
    catch (error) { Swal.fire("Unable to apply", error?.response?.data?.message || error.message, "error"); }
  };

  const withdraw = async (app) => { const ask = await Swal.fire({ title: "Withdraw application?", icon: "warning", showCancelButton: true, confirmButtonText: "Withdraw" }); if (!ask.isConfirmed) return; try { await api.post(`/college-placement/student/applications/${app.id}/withdraw`); await load(); } catch (error) { Swal.fire("Unable to withdraw", error?.response?.data?.message || error.message, "error"); } };
  const offerResponse = async (app, response) => { try { const { data: result } = await api.post(`/college-placement/student/applications/${app.id}/offer-response`, { response }); await Swal.fire(response === "accepted" ? "Congratulations!" : "Updated", result?.message, response === "accepted" ? "success" : "info"); await load(); } catch (error) { Swal.fire("Unable to update", error?.response?.data?.message || error.message, "error"); } };

  const activeApps = data.applications || [];
  const offers = activeApps.filter((a) => a.offer);
  return <div className="container-fluid py-4 pc-page">
    <div className="pc-hero student mb-4"><div><div className="pc-kicker">My College Career</div><h1>Placement & Career Cell</h1><p>Discover eligible placement drives, track applications and manage job offers.</p></div><div className="pc-student-chip"><i className="bi bi-mortarboard-fill" /><span>{data.student?.name || "Student"}<small>{data.student?.admission_number}</small></span></div></div>
    {loading ? <div className="pc-loading"><span className="spinner-border text-primary" /> Loading opportunities…</div> : <>
      {!!offers.length && <section className="pc-section"><div className="pc-section-title"><div><small>Great news</small><h2>My Offers</h2></div></div><div className="row g-3">{offers.map((app) => <div className="col-12 col-lg-6" key={app.id}><div className="pc-offer-card"><div><span className="badge text-bg-success mb-2">{human(app.offer.status)}</span><h3>{app.drive?.company?.name}</h3><p>{app.offer.designation || app.drive?.job_role}</p><div className="pc-offer-meta"><span>{app.offer.package_text || "Package TBA"}</span><span>{app.offer.location || app.drive?.location || "Location TBA"}</span><span>Joining: {fmtDateOnly(app.offer.joining_date)}</span></div></div>{app.offer.status === "offered" && <div className="d-flex gap-2"><button className="btn btn-success btn-sm" onClick={() => offerResponse(app, "accepted")}>Accept</button><button className="btn btn-outline-secondary btn-sm" onClick={() => offerResponse(app, "declined")}>Decline</button></div>}</div></div>)}</div></section>}
      <section className="pc-section"><div className="pc-section-title"><div><small>Eligible for your program</small><h2>Open Placement Drives</h2></div></div><div className="row g-3">{!(data.drives || []).length && <Empty text="No open placement drives for your program right now." />}{(data.drives || []).map((drive) => <div className="col-12 col-lg-6 col-xxl-4" key={drive.id}><div className="pc-student-drive"><div className="d-flex justify-content-between gap-2"><div><div className="pc-company-name">{drive.company?.name}</div><h3>{drive.job_role || drive.title}</h3></div><span className="badge text-bg-success align-self-start">Open</span></div><p>{drive.description || drive.title}</p><div className="pc-drive-meta"><span><i className="bi bi-cash-stack" />{drive.package_text || "Package TBA"}</span><span><i className="bi bi-geo-alt" />{drive.location || "Location TBA"}</span><span><i className="bi bi-hourglass-split" />Apply by {fmtDate(drive.registration_deadline)}</span></div>{drive.eligibility_notes && <div className="pc-eligibility"><strong>Eligibility:</strong> {drive.eligibility_notes}</div>}<div className="d-flex gap-2 mt-3">{drive.application ? <><span className={`badge text-bg-${statusClass(drive.application.status)} align-self-center`}>{human(drive.application.status)}</span>{!["selected","offered","joined"].includes(drive.application.status) && <button className="btn btn-outline-danger btn-sm ms-auto" onClick={() => withdraw(drive.application)}>Withdraw</button>}</> : <button className="btn btn-primary flex-grow-1" onClick={() => apply(drive)}>Apply Now</button>}{drive.external_registration_url && <button className="btn btn-outline-primary" onClick={() => window.open(drive.external_registration_url, "_blank", "noopener,noreferrer")}><i className="bi bi-box-arrow-up-right" /></button>}</div></div></div>)}</div></section>
      <section className="pc-section"><div className="pc-section-title"><div><small>Progress tracker</small><h2>My Applications</h2></div></div><div className="pc-panel p-0"><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Company / Role</th><th>Applied</th><th>Eligibility</th><th>Status</th><th>Offer</th></tr></thead><tbody>{!activeApps.length && <tr><td colSpan="5" className="text-center text-muted py-5">You have not applied to a placement drive yet.</td></tr>}{activeApps.map((app) => <tr key={app.id}><td><strong>{app.drive?.company?.name}</strong><div className="small text-muted">{app.drive?.job_role || app.drive?.title}</div></td><td>{fmtDate(app.applied_at)}</td><td>{human(app.eligibility_status)}</td><td><span className={`badge text-bg-${statusClass(app.status)}`}>{human(app.status)}</span></td><td>{app.offer ? <span className="badge text-bg-success">{human(app.offer.status)}</span> : "—"}</td></tr>)}</tbody></table></div></div></section>
    </>}
  </div>;
}

function Stat({ icon, label, value }) { return <div className="pc-stat"><div className="pc-stat-icon"><i className={`bi ${icon}`} /></div><div><span>{label}</span><strong>{Number(value || 0)}</strong></div></div>; }
function Field({ label, col = "col-12", children }) { return <div className={col}><label className="form-label">{label}</label>{children}</div>; }
function Empty({ text }) { return <div className="col-12"><div className="pc-empty"><i className="bi bi-inbox" /><h3>Nothing here yet</h3><p>{text}</p></div></div>; }
