import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./StudentGrievanceSafety.css";

const roles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole");
    return (many.length ? many : [one]).filter(Boolean).map((x) => String(x).toLowerCase());
  } catch (_) { return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean); }
};
const human = (v) => String(v || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const dateText = (v) => v ? new Date(String(v).length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString([], { dateStyle: "medium" }) : "—";
const statusTone = (v) => ({ submitted: "secondary", under_review: "info", assigned: "primary", action_in_progress: "warning", resolved: "success", closed: "dark" }[v] || "secondary");
const priorityTone = (v) => ({ low: "info", medium: "secondary", high: "warning", critical: "danger" }[v] || "secondary");
const categoryLabel = (v) => ({ ragging: "Ragging / Initiation", bullying: "Bullying", harassment: "Harassment", discrimination: "Discrimination", hostel_issue: "Hostel Issue", student_safety: "Student Safety", cyber_safety: "Cyber Safety", transport_safety: "Transport Safety", general_grievance: "General Grievance", other: "Other" }[v] || human(v));

export default function StudentGrievanceSafety() {
  const r = roles();
  return r.includes("student") ? <StudentView /> : <StaffView />;
}

function PageHero({ isCollege, student = false, onNew }) {
  return <div className="sgs-hero mb-4">
    <div>
      <div className="sgs-kicker"><i className="bi bi-shield-lock me-2"/>Confidential Student Support</div>
      <h1>{student ? "Report & Support" : (isCollege ? "Grievance & Anti-Ragging" : "Student Safety & Grievances")}</h1>
      <p>{student ? "Raise a concern securely, attach supporting evidence and follow the case status." : "Confidential case management, follow-ups, controlled visibility and complete audit trail."}</p>
    </div>
    {student && <button className="btn btn-light fw-semibold" onClick={onNew}><i className="bi bi-plus-circle me-2"/>Report a concern</button>}
  </div>;
}

function StudentView() {
  const { isCollege } = useInstitution();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ categories: [] });
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ category: "", title: "", description: "", incident_date: "", incident_location: "", priority: "medium", confidential: true, anonymous_to_handlers: false });
  const [updateText, setUpdateText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([api.get("/student-grievances/meta"), api.get("/student-grievances/student/me")]);
      setMeta(m.data || {}); setCases(c.data?.cases || []);
      if (selected) {
        const fresh = (c.data?.cases || []).find((x) => Number(x.id) === Number(selected.id));
        if (fresh) setSelected(fresh);
      }
    } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, [selected?.id]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/student-grievances", form);
      const row = data.case;
      for (const file of files) {
        const fd = new FormData(); fd.append("file", file); fd.append("title", file.name);
        await api.post(`/student-grievances/${row.id}/evidence`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      setShowForm(false); setFiles([]); setForm({ category: "", title: "", description: "", incident_date: "", incident_location: "", priority: "medium", confidential: true, anonymous_to_handlers: false });
      await Swal.fire("Submitted securely", "Your concern has been recorded. You can follow updates from this page.", "success");
      await load();
    } catch (e2) { Swal.fire("Unable to submit", e2.response?.data?.message || e2.message, "error"); }
  };

  const addUpdate = async () => {
    if (!updateText.trim() || !selected) return;
    try { await api.post(`/student-grievances/${selected.id}/student-update`, { note: updateText }); setUpdateText(""); await refreshDetail(selected.id); }
    catch (e) { Swal.fire("Unable to add update", e.response?.data?.message || e.message, "error"); }
  };
  const refreshDetail = async (id) => { const { data } = await api.get(`/student-grievances/${id}`); setSelected(data.case); await load(); };
  const uploadEvidence = async (fileList) => {
    if (!selected) return;
    try {
      for (const file of Array.from(fileList || [])) { const fd = new FormData(); fd.append("file", file); fd.append("title", file.name); await api.post(`/student-grievances/${selected.id}/evidence`, fd, { headers: { "Content-Type": "multipart/form-data" } }); }
      await refreshDetail(selected.id);
    } catch (e) { Swal.fire("Upload failed", e.response?.data?.message || e.message, "error"); }
  };

  if (loading && !cases.length) return <Loading />;
  return <div className="container-fluid py-4 sgs-page">
    <PageHero isCollege={isCollege} student onNew={() => setShowForm((v) => !v)} />
    <div className="alert alert-light border sgs-privacy"><i className="bi bi-lock-fill text-primary me-2"/><strong>Privacy:</strong> confidential cases are restricted to authorized handlers. “Anonymous to handlers” hides your identity from case handlers while keeping the case linked to your login so you can receive updates.</div>
    {showForm && <div className="card border-0 shadow-sm mb-4"><div className="card-body p-4"><h2 className="h5 mb-3">Report a concern</h2><form onSubmit={submit} className="row g-3">
      <Field label="Category" className="col-md-4"><select className="form-select" required value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}><option value="">Select</option>{(meta.categories||[]).map((x)=><option key={x} value={x}>{categoryLabel(x)}</option>)}</select></Field>
      <Field label="Priority" className="col-md-4"><select className="form-select" value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Urgent / Critical</option></select></Field>
      <Field label="Incident Date (optional)" className="col-md-4"><input type="date" className="form-control" value={form.incident_date} onChange={(e)=>setForm({...form,incident_date:e.target.value})}/></Field>
      <Field label="Short Title" className="col-12"><input className="form-control" maxLength={255} required value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Briefly describe the concern"/></Field>
      <Field label="What happened?" className="col-12"><textarea className="form-control" rows={5} required value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} placeholder="Share the details needed to understand and respond to the concern."/></Field>
      <Field label="Location (optional)" className="col-md-6"><input className="form-control" value={form.incident_location} onChange={(e)=>setForm({...form,incident_location:e.target.value})} placeholder={isCollege ? "Campus / hostel / classroom" : "Classroom / bus / playground"}/></Field>
      <Field label="Supporting files (optional)" className="col-md-6"><input type="file" className="form-control" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e)=>setFiles(Array.from(e.target.files||[]))}/><div className="form-text">PDF, Word or images · up to 15 MB each</div></Field>
      <div className="col-md-6"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={form.confidential} onChange={(e)=>setForm({...form,confidential:e.target.checked})}/><label className="form-check-label">Treat as confidential</label></div></div>
      <div className="col-md-6"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={form.anonymous_to_handlers} onChange={(e)=>setForm({...form,anonymous_to_handlers:e.target.checked})}/><label className="form-check-label">Anonymous to case handlers</label></div></div>
      <div className="col-12 d-flex gap-2 justify-content-end"><button type="button" className="btn btn-outline-secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="btn btn-primary"><i className="bi bi-shield-check me-2"/>Submit securely</button></div>
    </form></div></div>}

    <div className="row g-4">
      <div className="col-xl-5"><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white border-0 pt-4 px-4"><h2 className="h5 mb-1">My cases</h2><p className="text-muted small mb-0">Only your own cases are shown here.</p></div><div className="card-body p-3">
        {!cases.length ? <Empty icon="bi-shield-heart" title="No concerns reported" text="Use Report a concern whenever you need confidential support."/> : cases.map((c)=><button key={c.id} className={`sgs-case-card ${selected?.id===c.id?"active":""}`} onClick={()=>setSelected(c)}><div className="d-flex justify-content-between gap-2"><strong>{c.title}</strong><span className={`badge text-bg-${priorityTone(c.priority)}`}>{human(c.priority)}</span></div><div className="small text-muted mt-1">{c.case_number} · {categoryLabel(c.category)}</div><div className="d-flex justify-content-between align-items-center mt-2"><span className={`badge text-bg-${statusTone(c.status)}`}>{human(c.status)}</span><span className="small text-muted">{dateText(c.createdAt)}</span></div></button>)}
      </div></div></div>
      <div className="col-xl-7">{selected ? <CaseDetail row={selected} student onRefresh={()=>refreshDetail(selected.id)} updateText={updateText} setUpdateText={setUpdateText} onAddUpdate={addUpdate} onUpload={uploadEvidence}/> : <div className="card border-0 shadow-sm h-100"><div className="card-body d-flex align-items-center justify-content-center"><Empty icon="bi-card-text" title="Select a case" text="Choose a case to view status, updates and supporting files."/></div></div>}</div>
    </div>
  </div>;
}

function StaffView() {
  const { isCollege } = useInstitution();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ categories: [], handlers: [], can_manage_all: false });
  const [dash, setDash] = useState({ counts: {} });
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState({ status: "", priority: "", category: "", q: "" });
  const [edit, setEdit] = useState({ status: "", priority: "", assigned_to_user_id: "", assigned_to_employee_id: "", committee_name: "", next_follow_up: "", resolution_summary: "", note: "", student_visible: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filter).filter(([,v])=>v));
      const [m,d,c] = await Promise.all([api.get("/student-grievances/meta"), api.get("/student-grievances/dashboard"), api.get("/student-grievances/cases", { params })]);
      setMeta(m.data||{}); setDash(d.data||{counts:{}}); setCases(c.data?.cases||[]);
    } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, [filter.status, filter.priority, filter.category, filter.q]);
  useEffect(()=>{ const t=setTimeout(load, filter.q?250:0); return()=>clearTimeout(t); },[load]);

  const openCase = async (row) => {
    try { const { data } = await api.get(`/student-grievances/${row.id}`); setSelected(data.case); const c=data.case; setEdit({ status:c.status||"", priority:c.priority||"medium", assigned_to_user_id:c.assigned_to_user_id||"", assigned_to_employee_id:c.assigned_to_employee_id||"", committee_name:c.committee_name||"", next_follow_up:c.next_follow_up||"", resolution_summary:c.resolution_summary||"", note:"", student_visible:false }); }
    catch (e) { Swal.fire("Unable to open case", e.response?.data?.message || e.message, "error"); }
  };
  const save = async () => {
    if (!selected) return;
    try { await api.patch(`/student-grievances/${selected.id}`, edit); await Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Case updated", showConfirmButton:false, timer:1600 }); await load(); await openCase(selected); }
    catch (e) { Swal.fire("Unable to update", e.response?.data?.message || e.message, "error"); }
  };
  const pickHandler = (userId) => {
    const h=(meta.handlers||[]).find((x)=>Number(x.user_id)===Number(userId)); setEdit({...edit,assigned_to_user_id:userId,assigned_to_employee_id:h?.id||""});
  };
  const uploadEvidence = async (fileList) => {
    if (!selected) return;
    try { for (const file of Array.from(fileList||[])) { const fd=new FormData(); fd.append("file",file); fd.append("title",file.name); fd.append("student_visible",String(edit.student_visible)); await api.post(`/student-grievances/${selected.id}/evidence`,fd,{headers:{"Content-Type":"multipart/form-data"}}); } await openCase(selected); }
    catch(e){ Swal.fire("Upload failed",e.response?.data?.message||e.message,"error"); }
  };

  const c = dash.counts || {};
  return <div className="container-fluid py-4 sgs-page">
    <PageHero isCollege={isCollege}/>
    <div className="row g-3 mb-4"><Metric label="Open Cases" value={c.open||0} icon="bi-folder2-open"/><Metric label="Critical" value={c.critical||0} icon="bi-exclamation-octagon" tone="danger"/><Metric label="Follow-ups Due" value={c.followups_due||0} icon="bi-calendar2-check" tone="warning"/><Metric label="Resolved This Month" value={c.resolved_this_month||0} icon="bi-shield-check" tone="success"/></div>
    <div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-2"><div className="col-lg-4"><input className="form-control" placeholder="Search case number, title, location..." value={filter.q} onChange={(e)=>setFilter({...filter,q:e.target.value})}/></div><div className="col-md-3 col-lg-2"><select className="form-select" value={filter.status} onChange={(e)=>setFilter({...filter,status:e.target.value})}><option value="">All statuses</option>{["submitted","under_review","assigned","action_in_progress","resolved","closed"].map(x=><option key={x} value={x}>{human(x)}</option>)}</select></div><div className="col-md-3 col-lg-2"><select className="form-select" value={filter.priority} onChange={(e)=>setFilter({...filter,priority:e.target.value})}><option value="">All priorities</option>{["low","medium","high","critical"].map(x=><option key={x} value={x}>{human(x)}</option>)}</select></div><div className="col-md-4"><select className="form-select" value={filter.category} onChange={(e)=>setFilter({...filter,category:e.target.value})}><option value="">All categories</option>{(meta.categories||[]).map(x=><option key={x} value={x}>{categoryLabel(x)}</option>)}</select></div></div></div></div>
    <div className="row g-4">
      <div className="col-xl-5"><div className="card border-0 shadow-sm"><div className="card-header bg-white border-0 pt-4 px-4"><div className="d-flex justify-content-between"><div><h2 className="h5 mb-1">Confidential Cases</h2><p className="small text-muted mb-0">{meta.can_manage_all ? "Authorized overview" : "Only cases assigned to you"}</p></div><span className="badge text-bg-light align-self-start">{cases.length}</span></div></div><div className="card-body p-0"><div className="table-responsive"><table className="table align-middle mb-0 sgs-table"><thead><tr><th>Case</th><th>Status</th><th>Priority</th></tr></thead><tbody>{cases.map((row)=><tr key={row.id} className={selected?.id===row.id?"table-active":""} onClick={()=>openCase(row)}><td><strong>{row.case_number}</strong><div>{row.title}</div><small className="text-muted">{row.reporter_label} · {categoryLabel(row.category)}</small></td><td><span className={`badge text-bg-${statusTone(row.status)}`}>{human(row.status)}</span></td><td><span className={`badge text-bg-${priorityTone(row.priority)}`}>{human(row.priority)}</span></td></tr>)}</tbody></table>{!cases.length&&!loading&&<Empty icon="bi-inbox" title="No matching cases" text="There are no cases matching these filters."/>}</div></div></div></div>
      <div className="col-xl-7">{selected ? <div className="card border-0 shadow-sm"><div className="card-body p-4"><CaseHeader row={selected}/><div className="sgs-sensitive-note mb-3"><i className="bi bi-eye-slash me-2"/>{selected.anonymous_to_handlers ? "Reporter identity is hidden from case handlers." : "This case contains confidential student information."}</div><div className="row g-3">
        <Field label="Status" className="col-md-6"><select className="form-select" value={edit.status} onChange={(e)=>setEdit({...edit,status:e.target.value})}>{["submitted","under_review","assigned","action_in_progress","resolved","closed"].map(x=><option key={x} value={x}>{human(x)}</option>)}</select></Field>
        <Field label="Priority" className="col-md-6"><select className="form-select" value={edit.priority} onChange={(e)=>setEdit({...edit,priority:e.target.value})}>{["low","medium","high","critical"].map(x=><option key={x} value={x}>{human(x)}</option>)}</select></Field>
        {meta.can_manage_all && <Field label="Assign Handler" className="col-md-6"><select className="form-select" value={edit.assigned_to_user_id} onChange={(e)=>pickHandler(e.target.value)}><option value="">Unassigned</option>{(meta.handlers||[]).map(h=><option key={h.user_id} value={h.user_id}>{h.name}{h.designation?` · ${h.designation}`:""}</option>)}</select></Field>}
        <Field label="Committee / Team" className="col-md-6"><input className="form-control" value={edit.committee_name} onChange={(e)=>setEdit({...edit,committee_name:e.target.value})} placeholder={isCollege?"Anti-Ragging / Grievance Committee":"Student Safety Committee"}/></Field>
        <Field label="Next Follow-up" className="col-md-6"><input type="date" className="form-control" value={edit.next_follow_up} onChange={(e)=>setEdit({...edit,next_follow_up:e.target.value})}/></Field>
        <Field label="Resolution Summary" className="col-12"><textarea className="form-control" rows={3} value={edit.resolution_summary} onChange={(e)=>setEdit({...edit,resolution_summary:e.target.value})} placeholder="Add when the case reaches resolution."/></Field>
        <Field label="Case Note / Action Taken" className="col-12"><textarea className="form-control" rows={3} value={edit.note} onChange={(e)=>setEdit({...edit,note:e.target.value})} placeholder="Internal investigation note, action taken or student-facing update."/></Field>
        <div className="col-md-6"><div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={edit.student_visible} onChange={(e)=>setEdit({...edit,student_visible:e.target.checked})}/><label className="form-check-label">Show this note/update to student</label></div></div>
        <Field label="Add Evidence / Document" className="col-md-6"><input type="file" multiple className="form-control" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e)=>uploadEvidence(e.target.files)}/></Field>
        <div className="col-12 text-end"><button className="btn btn-primary" onClick={save}><i className="bi bi-check2-circle me-2"/>Save Case Update</button></div>
      </div><hr className="my-4"/><CaseDetail row={selected} staff onRefresh={()=>openCase(selected)}/></div></div> : <div className="card border-0 shadow-sm h-100"><div className="card-body d-flex justify-content-center align-items-center"><Empty icon="bi-shield-lock" title="Select a confidential case" text="Open a case to review the audit trail and manage follow-up."/></div></div>}</div>
    </div>
  </div>;
}

function CaseDetail({ row, student, onRefresh, updateText, setUpdateText, onAddUpdate, onUpload }) {
  const download = async (ev) => {
    try { const res=await api.get(`/student-grievances/${row.id}/evidence/${ev.id}/download`,{responseType:"blob"}); const url=URL.createObjectURL(res.data); window.open(url,"_blank","noopener,noreferrer"); setTimeout(()=>URL.revokeObjectURL(url),60000); }
    catch(e){ Swal.fire("Unable to open file",e.response?.data?.message||e.message,"error"); }
  };
  return <div className={student?"card border-0 shadow-sm":""}><div className={student?"card-body p-4":""}><CaseHeader row={row}/><div className="row g-3 mb-4"><Info label="Incident Date" value={dateText(row.incident_date)}/><Info label="Location" value={row.incident_location||"Not provided"}/><Info label="Confidential" value={row.confidential?"Yes":"No"}/><Info label="Anonymous to handlers" value={row.anonymous_to_handlers?"Yes":"No"}/></div><div className="sgs-description mb-4">{row.description}</div>
    {(row.evidence||[]).length>0&&<><h3 className="h6">Supporting files</h3><div className="d-flex flex-wrap gap-2 mb-4">{row.evidence.map((e)=><button key={e.id} onClick={()=>download(e)} className="btn btn-sm btn-outline-secondary"><i className="bi bi-paperclip me-1"/>{e.title||e.original_name}</button>)}</div></>}
    {student&&<div className="row g-2 mb-4"><div className="col"><textarea className="form-control" rows={2} value={updateText||""} onChange={(e)=>setUpdateText(e.target.value)} placeholder="Add more information or reply to an update..."/></div><div className="col-auto"><button className="btn btn-outline-primary h-100" onClick={onAddUpdate}>Add Update</button></div><div className="col-12"><label className="btn btn-sm btn-outline-secondary"><i className="bi bi-paperclip me-1"/>Add supporting file<input type="file" multiple hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={(e)=>onUpload(e.target.files)}/></label></div></div>}
    <h3 className="h6 mb-3">Case Timeline</h3><div className="sgs-timeline">{(row.events||[]).map((e)=><div className="sgs-event" key={e.id}><div className="sgs-event-dot"/><div><div className="d-flex flex-wrap gap-2 align-items-center"><strong>{human(e.event_type)}</strong>{e.to_status&&<span className={`badge text-bg-${statusTone(e.to_status)}`}>{human(e.to_status)}</span>}{!e.student_visible&&!student&&<span className="badge text-bg-dark">Internal</span>}</div>{e.note&&<p className="mb-1 mt-1">{e.note}</p>}<small className="text-muted">{dateText(e.createdAt)}</small></div></div>)}</div>
  </div></div>;
}

function CaseHeader({ row }) { return <div className="d-flex justify-content-between gap-3 flex-wrap mb-3"><div><div className="small text-muted mb-1">{row.case_number} · {categoryLabel(row.category)}</div><h2 className="h4 mb-1">{row.title}</h2><div className="small text-muted">Reporter: {row.reporter_label || row.student?.name || "Student"}</div></div><div className="d-flex gap-2 align-items-start"><span className={`badge text-bg-${priorityTone(row.priority)}`}>{human(row.priority)}</span><span className={`badge text-bg-${statusTone(row.status)}`}>{human(row.status)}</span></div></div>; }
function Field({ label, className="col-12", children }) { return <div className={className}><label className="form-label fw-semibold small">{label}</label>{children}</div>; }
function Info({ label, value }) { return <div className="col-6"><div className="sgs-info"><span>{label}</span><strong>{value}</strong></div></div>; }
function Metric({ label, value, icon, tone="primary" }) { return <div className="col-6 col-xl-3"><div className="sgs-metric"><div className={`sgs-metric-icon text-${tone}`}><i className={`bi ${icon}`}/></div><div><span>{label}</span><strong>{value}</strong></div></div></div>; }
function Empty({ icon, title, text }) { return <div className="text-center py-5 px-3 text-muted"><i className={`bi ${icon} fs-1`}/><h3 className="h6 mt-3 text-dark">{title}</h3><p className="small mb-0">{text}</p></div>; }
function Loading(){ return <div className="container py-5 text-center"><div className="spinner-border text-primary"/><div className="mt-2 text-muted">Loading secure case workspace…</div></div>; }
