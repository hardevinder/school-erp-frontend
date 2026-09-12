import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./StudentMentoringSupport.css";

const roles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole");
    return (many.length ? many : [one]).filter(Boolean).map((x) => String(x).toLowerCase());
  } catch (_) { return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean); }
};
const MANAGERS = new Set(["department_hod", "principal", "academic_coordinator", "coordinator", "admin", "superadmin", "super_admin"]);
const human = (v) => String(v || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const dateText = (v) => v ? new Date(String(v).length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString([], { dateStyle: "medium" }) : "—";
const tone = (v) => ({ high: "danger", medium: "warning", low: "info", resolved: "success", in_progress: "primary", open: "warning" }[v] || "secondary");

export default function StudentMentoringSupport() {
  const r = roles();
  const student = r.includes("student");
  const manager = r.some((x) => MANAGERS.has(x));
  if (student) return <StudentView />;
  return <StaffView manager={manager} />;
}

function StudentView() {
  const { isCollege } = useInstitution();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data: d } = await api.get("/student-mentoring/me"); setData(d); }
    catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Loading />;
  const a = data?.assignment;
  const risk = data?.risk || {};
  return <div className="container-fluid py-4 sms-page">
    <Hero isCollege={isCollege} student />
    {!a ? <div className="card border-0 shadow-sm"><div className="card-body text-center py-5"><i className="bi bi-person-heart fs-1 text-primary"/><h2 className="h5 mt-3">Mentor assignment pending</h2><p className="text-muted mb-0">Your institution can assign a mentor/advisor here for academic support and regular follow-up.</p></div></div> : <>
      <div className="row g-3 mb-4">
        <Metric icon="bi-person-badge" label={isCollege ? "Faculty Mentor" : "Student Mentor"} value={a.mentorEmployee?.name || a.mentorUser?.name || "Assigned"} />
        <Metric icon="bi-calendar-check" label="Since" value={dateText(a.start_date)} />
        <Metric icon="bi-exclamation-triangle" label="Active Support Items" value={(a.concerns || []).filter((x) => x.status !== "resolved").length} tone="warning" />
        <Metric icon="bi-chat-square-heart" label="Visible Updates" value={(a.interactions || []).length} tone="success" />
      </div>
      <div className="row g-4">
        <div className="col-xl-4"><MentorCard assignment={a} isCollege={isCollege}/><RiskCard risk={risk}/></div>
        <div className="col-xl-8"><StudentTimeline assignment={a}/></div>
      </div>
    </>}
  </div>;
}

function StaffView({ manager }) {
  const { isCollege } = useInstitution();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ mentors: [], classes: [], sections: [], sessions: [] });
  const [dash, setDash] = useState({ counts: {}, assignments: [] });
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [risk, setRisk] = useState({});
  const [showAssign, setShowAssign] = useState(false);
  const [filter, setFilter] = useState({ class_id: "", section_id: "", mentor_user_id: "", q: "" });
  const [assignForm, setAssignForm] = useState({ mentor_user_id: "", class_id: "", section_id: "", session_id: "", notes: "", student_ids: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, d, a] = await Promise.all([api.get("/student-mentoring/meta"), api.get("/student-mentoring/dashboard"), api.get("/student-mentoring/assignments")]);
      setMeta(m.data || {}); setDash(d.data || { counts: {} }); setAssignments(a.data?.assignments || []);
      if (manager) { const s = await api.get("/student-mentoring/students"); setStudents(s.data?.students || []); }
    } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, [manager]);
  useEffect(() => { load(); }, [load]);

  const open = async (id) => {
    try { const { data } = await api.get(`/student-mentoring/assignments/${id}`); setSelected(data.assignment); setRisk(data.risk || {}); }
    catch (e) { Swal.fire("Unable to open", e.response?.data?.message || e.message, "error"); }
  };

  const filtered = useMemo(() => assignments.filter((a) => {
    if (filter.class_id && String(a.class_id) !== filter.class_id) return false;
    if (filter.section_id && String(a.section_id) !== filter.section_id) return false;
    if (filter.mentor_user_id && String(a.mentor_user_id) !== filter.mentor_user_id) return false;
    const q = filter.q.trim().toLowerCase();
    return !q || `${a.student?.name || ""} ${a.student?.admission_number || ""} ${a.mentorEmployee?.name || a.mentorUser?.name || ""}`.toLowerCase().includes(q);
  }), [assignments, filter]);

  const submitAssign = async () => {
    if (!assignForm.mentor_user_id || !assignForm.student_ids.length) return Swal.fire("Select students", "Choose a mentor and at least one student.", "warning");
    try {
      const { data } = await api.post("/student-mentoring/assignments/bulk", assignForm);
      Swal.fire("Assigned", data.message || "Mentor assigned.", "success"); setShowAssign(false); setAssignForm({ mentor_user_id: "", class_id: "", section_id: "", session_id: "", notes: "", student_ids: [] }); await load();
    } catch (e) { Swal.fire("Unable to assign", e.response?.data?.message || e.message, "error"); }
  };

  if (loading) return <Loading />;
  return <div className="container-fluid py-4 sms-page">
    <Hero isCollege={isCollege} />
    <div className="row g-3 mb-4">
      <Metric icon="bi-people" label="Active Mentees" value={dash.counts?.mentees || 0}/>
      <Metric icon="bi-exclamation-circle" label="Open Concerns" value={dash.counts?.open_concerns || 0} tone="warning"/>
      <Metric icon="bi-fire" label="High Priority" value={dash.counts?.high_priority || 0} tone="danger"/>
      <Metric icon="bi-calendar2-check" label="Follow-ups Due" value={dash.counts?.followups_due || 0} tone="info"/>
    </div>
    {manager && <div className="d-flex justify-content-end mb-3"><button className="btn btn-primary" onClick={() => setShowAssign((v) => !v)}><i className="bi bi-person-plus me-2"/>Assign Mentor</button></div>}
    {manager && showAssign && <AssignPanel meta={meta} students={students} form={assignForm} setForm={setAssignForm} onSubmit={submitAssign} isCollege={isCollege}/>}    
    <div className="card border-0 shadow-sm sms-card">
      <div className="card-body p-3 p-lg-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 className="h5 mb-1">{manager ? "Student Mentoring Overview" : "My Mentees"}</h2><div className="text-muted small">Track meetings, concerns, actions and follow-ups.</div></div></div>
        <Filters meta={meta} filter={filter} setFilter={setFilter} manager={manager}/>
        {filtered.length ? <div className="table-responsive"><table className="table align-middle sms-table"><thead><tr><th>Student</th><th>{isCollege ? "Program / Semester" : "Class"}</th><th>Mentor</th><th>Open Concerns</th><th>Last Update</th><th></th></tr></thead><tbody>{filtered.map((a) => <tr key={a.id}><td><strong>{a.student?.name || "Student"}</strong><small>{a.student?.admission_number || "—"}</small></td><td>{a.class?.class_name || "—"}<small>{a.section?.section_name || ""}</small></td><td>{a.mentorEmployee?.name || a.mentorUser?.name || "—"}<small>{a.mentorEmployee?.designation || ""}</small></td><td><span className="badge rounded-pill text-bg-warning">{(a.concerns || []).filter((x) => x.status !== "resolved").length}</span></td><td>{dateText(a.updatedAt)}</td><td className="text-end"><button className="btn btn-sm btn-outline-primary" onClick={() => open(a.id)}>Open</button></td></tr>)}</tbody></table></div> : <Empty text="No mentoring assignments match the current filters."/>}
      </div>
    </div>
    {selected && <AssignmentModal assignment={selected} risk={risk} isCollege={isCollege} onClose={() => setSelected(null)} onRefresh={async () => { await open(selected.id); await load(); }}/>}    
  </div>;
}

function AssignPanel({ meta, students, form, setForm, onSubmit, isCollege }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sections = (meta.sections || []).filter((s) => !form.class_id || String(s.class_id) === String(form.class_id));
  const candidates = students.filter((s) => (!form.class_id || String(s.class_id) === String(form.class_id)) && (!form.section_id || String(s.section_id) === String(form.section_id)));
  const allSelected = candidates.length > 0 && candidates.every((s) => form.student_ids.includes(s.id));
  const toggleAll = () => set("student_ids", allSelected ? form.student_ids.filter((id) => !candidates.some((s) => s.id === id)) : [...new Set([...form.student_ids, ...candidates.map((s) => s.id)])]);
  return <div className="card border-0 shadow-sm sms-card mb-4"><div className="card-body p-4"><div className="row g-3"><div className="col-md-4"><label className="form-label">Mentor / Advisor</label><select className="form-select" value={form.mentor_user_id} onChange={(e) => set("mentor_user_id", e.target.value)}><option value="">Select mentor</option>{(meta.mentors || []).map((m) => <option key={m.id} value={m.user_id}>{m.name}{m.designation ? ` · ${m.designation}` : ""}</option>)}</select></div><div className="col-md-3"><label className="form-label">{isCollege ? "Program / Semester" : "Class"}</label><select className="form-select" value={form.class_id} onChange={(e) => setForm((f) => ({ ...f, class_id: e.target.value, section_id: "", student_ids: [] }))}><option value="">All</option>{(meta.classes || []).map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></div><div className="col-md-3"><label className="form-label">{isCollege ? "Batch / Section" : "Section"}</label><select className="form-select" value={form.section_id} onChange={(e) => setForm((f) => ({ ...f, section_id: e.target.value, student_ids: [] }))}><option value="">All</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.section_name}</option>)}</select></div><div className="col-md-2 d-flex align-items-end"><button className="btn btn-outline-secondary w-100" onClick={toggleAll}>{allSelected ? "Clear" : "Select All"}</button></div><div className="col-12"><label className="form-label">Students <span className="text-muted">({form.student_ids.length} selected)</span></label><div className="sms-student-picker">{candidates.map((s) => <label key={s.id} className={form.student_ids.includes(s.id) ? "selected" : ""}><input type="checkbox" checked={form.student_ids.includes(s.id)} onChange={() => set("student_ids", form.student_ids.includes(s.id) ? form.student_ids.filter((id) => id !== s.id) : [...form.student_ids, s.id])}/><span><strong>{s.name}</strong><small>{s.admission_number}{s.mentor_assignment ? ` · Current: ${s.mentor_assignment.mentorEmployee?.name || s.mentor_assignment.mentorUser?.name || "Mentor"}` : ""}</small></span></label>)}</div></div><div className="col-12"><label className="form-label">Assignment Note <span className="text-muted">(optional)</span></label><textarea className="form-control" rows="2" value={form.notes} onChange={(e) => set("notes", e.target.value)} /></div></div><div className="d-flex justify-content-end mt-3"><button className="btn btn-primary px-4" onClick={onSubmit}>Assign Selected Students</button></div></div></div>;
}

function Filters({ meta, filter, setFilter, manager }) {
  const sections = (meta.sections || []).filter((s) => !filter.class_id || String(s.class_id) === String(filter.class_id));
  return <div className="row g-2 mb-3"><div className="col-md-4"><input className="form-control" placeholder="Search student / mentor..." value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}/></div><div className="col-md-3"><select className="form-select" value={filter.class_id} onChange={(e) => setFilter((f) => ({ ...f, class_id: e.target.value, section_id: "" }))}><option value="">All classes / programs</option>{(meta.classes || []).map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></div><div className="col-md-2"><select className="form-select" value={filter.section_id} onChange={(e) => setFilter((f) => ({ ...f, section_id: e.target.value }))}><option value="">All sections</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.section_name}</option>)}</select></div>{manager && <div className="col-md-3"><select className="form-select" value={filter.mentor_user_id} onChange={(e) => setFilter((f) => ({ ...f, mentor_user_id: e.target.value }))}><option value="">All mentors</option>{(meta.mentors || []).map((m) => <option key={m.id} value={m.user_id}>{m.name}</option>)}</select></div>}</div>;
}

function AssignmentModal({ assignment, risk, isCollege, onClose, onRefresh }) {
  const [interaction, setInteraction] = useState({ interaction_type: "meeting", summary: "", action_taken: "", follow_up_date: "", student_visible: false });
  const [concern, setConcern] = useState({ category: "academic", severity: "medium", title: "", details: "", action_plan: "", next_follow_up: "", student_visible: false });
  const addInteraction = async () => { if (!interaction.summary.trim()) return Swal.fire("Required", "Add a short meeting / interaction summary.", "warning"); try { await api.post(`/student-mentoring/assignments/${assignment.id}/interactions`, interaction); setInteraction({ interaction_type: "meeting", summary: "", action_taken: "", follow_up_date: "", student_visible: false }); await onRefresh(); } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); } };
  const addConcern = async () => { if (!concern.title.trim()) return Swal.fire("Required", "Concern title is required.", "warning"); try { await api.post(`/student-mentoring/assignments/${assignment.id}/concerns`, concern); setConcern({ category: "academic", severity: "medium", title: "", details: "", action_plan: "", next_follow_up: "", student_visible: false }); await onRefresh(); } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); } };
  const resolveConcern = async (c, status) => { try { await api.patch(`/student-mentoring/concerns/${c.id}`, { status }); await onRefresh(); } catch (e) { Swal.fire("Unable to update", e.response?.data?.message || e.message, "error"); } };
  return <div className="sms-backdrop"><div className="sms-modal"><div className="d-flex justify-content-between align-items-start mb-3"><div><span className="sms-kicker">{isCollege ? "Faculty Mentoring" : "Student Support"}</span><h2 className="h4 mb-1">{assignment.student?.name}</h2><div className="text-muted">{assignment.student?.admission_number} · {assignment.class?.class_name || ""} {assignment.section?.section_name || ""}</div></div><button className="btn-close" onClick={onClose}/></div><div className="row g-3"><div className="col-lg-4"><MentorCard assignment={assignment} isCollege={isCollege}/><RiskCard risk={risk}/></div><div className="col-lg-8"><div className="sms-tabs-card mb-3"><h3 className="h6">Open Concerns / Support Plans</h3>{(assignment.concerns || []).length ? assignment.concerns.map((c) => <div className="sms-concern" key={c.id}><div className="d-flex justify-content-between gap-2"><div><span className={`badge text-bg-${tone(c.severity)} me-2`}>{human(c.severity)}</span><strong>{c.title}</strong><small>{human(c.category)} · Follow-up {dateText(c.next_follow_up)}</small></div><span className={`badge text-bg-${tone(c.status)}`}>{human(c.status)}</span></div>{c.details && <p>{c.details}</p>}{c.action_plan && <div className="sms-action"><strong>Action:</strong> {c.action_plan}</div>}{c.status !== "resolved" && <div className="mt-2 d-flex gap-2"><button className="btn btn-sm btn-outline-primary" onClick={() => resolveConcern(c, "in_progress")}>In Progress</button><button className="btn btn-sm btn-outline-success" onClick={() => resolveConcern(c, "resolved")}>Resolve</button></div>}</div>) : <Empty text="No concerns recorded."/>}</div><div className="sms-tabs-card mb-3"><h3 className="h6">Add Concern / Support Plan</h3><div className="row g-2"><div className="col-md-4"><select className="form-select" value={concern.category} onChange={(e) => setConcern((f) => ({ ...f, category: e.target.value }))}>{["academic","attendance","homework_notebook","behaviour","career","financial","personal_general","backlog","internship_placement","other"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></div><div className="col-md-3"><select className="form-select" value={concern.severity} onChange={(e) => setConcern((f) => ({ ...f, severity: e.target.value }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div><div className="col-md-5"><input className="form-control" placeholder="Concern title" value={concern.title} onChange={(e) => setConcern((f) => ({ ...f, title: e.target.value }))}/></div><div className="col-12"><textarea className="form-control" rows="2" placeholder="Observation / concern details" value={concern.details} onChange={(e) => setConcern((f) => ({ ...f, details: e.target.value }))}/></div><div className="col-md-8"><input className="form-control" placeholder="Action plan" value={concern.action_plan} onChange={(e) => setConcern((f) => ({ ...f, action_plan: e.target.value }))}/></div><div className="col-md-4"><input type="date" className="form-control" value={concern.next_follow_up} onChange={(e) => setConcern((f) => ({ ...f, next_follow_up: e.target.value }))}/></div><div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" checked={concern.student_visible} onChange={(e) => setConcern((f) => ({ ...f, student_visible: e.target.checked }))}/><label className="form-check-label">Visible to student</label></div></div><button className="btn btn-primary btn-sm mt-2" onClick={addConcern}>Add Concern</button></div><div className="sms-tabs-card"><h3 className="h6">Meeting / Follow-up Log</h3>{(assignment.interactions || []).slice().sort((a,b) => String(b.interaction_date).localeCompare(String(a.interaction_date))).map((x) => <div className="sms-interaction" key={x.id}><i className="bi bi-chat-square-heart"/><div><strong>{human(x.interaction_type)}</strong><small>{dateText(x.interaction_date)}{x.follow_up_date ? ` · Next ${dateText(x.follow_up_date)}` : ""}</small><p>{x.summary || "—"}</p>{x.action_taken && <div className="sms-action"><strong>Action:</strong> {x.action_taken}</div>}</div></div>)}<div className="row g-2 mt-2"><div className="col-md-4"><select className="form-select" value={interaction.interaction_type} onChange={(e) => setInteraction((f) => ({ ...f, interaction_type: e.target.value }))}>{["meeting","counselling","parent_contact","phone_call","career_guidance","academic_review","other"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></div><div className="col-md-4"><input type="date" className="form-control" value={interaction.follow_up_date} onChange={(e) => setInteraction((f) => ({ ...f, follow_up_date: e.target.value }))}/></div><div className="col-md-4 d-flex align-items-center"><label className="form-check"><input className="form-check-input" type="checkbox" checked={interaction.student_visible} onChange={(e) => setInteraction((f) => ({ ...f, student_visible: e.target.checked }))}/><span className="form-check-label ms-1">Student visible</span></label></div><div className="col-12"><textarea className="form-control" rows="2" placeholder="Discussion summary" value={interaction.summary} onChange={(e) => setInteraction((f) => ({ ...f, summary: e.target.value }))}/></div><div className="col-12"><textarea className="form-control" rows="2" placeholder="Action taken / next steps" value={interaction.action_taken} onChange={(e) => setInteraction((f) => ({ ...f, action_taken: e.target.value }))}/></div></div><button className="btn btn-outline-primary btn-sm mt-2" onClick={addInteraction}>Save Meeting / Follow-up</button></div></div></div></div></div>;
}

function MentorCard({ assignment, isCollege }) { const m = assignment.mentorEmployee || {}; return <div className="card border-0 shadow-sm sms-card mb-3"><div className="card-body"><span className="sms-kicker">{isCollege ? "Faculty Mentor" : "Student Mentor"}</span><div className="d-flex align-items-center gap-3 mt-2"><div className="sms-avatar">{(m.name || assignment.mentorUser?.name || "M").slice(0,1).toUpperCase()}</div><div><h3 className="h6 mb-1">{m.name || assignment.mentorUser?.name || "Assigned Mentor"}</h3><div className="text-muted small">{m.designation || (isCollege ? "Faculty Advisor" : "Mentor")}</div>{m.department?.name && <div className="text-muted small">{m.department.name}</div>}</div></div>{assignment.notes && <div className="sms-note mt-3">{assignment.notes}</div>}</div></div>; }
function RiskCard({ risk }) { return <div className="card border-0 shadow-sm sms-card"><div className="card-body"><h3 className="h6 mb-3"><i className="bi bi-activity me-2 text-primary"/>Academic Signals</h3>{risk.attendance?.percentage != null && <div className="sms-risk-line"><span>Attendance</span><strong>{risk.attendance.percentage}%</strong></div>}{risk.cgpa != null && <div className="sms-risk-line"><span>CGPA</span><strong>{risk.cgpa}</strong></div>}{risk.pending_backlogs != null && <div className="sms-risk-line"><span>Pending Backlogs</span><strong>{risk.pending_backlogs}</strong></div>}{risk.notebook_issues != null && <div className="sms-risk-line"><span>Notebook Issues</span><strong>{risk.notebook_issues}</strong></div>}{(risk.alerts || []).length ? <div className="mt-3">{risk.alerts.map((a, i) => <div className={`alert alert-${tone(a.severity)} py-2 px-3 small mb-2`} key={i}>{a.text}</div>)}</div> : <div className="text-muted small mt-2">No automatic risk alerts at present.</div>}</div></div>; }
function StudentTimeline({ assignment }) { const interactions = (assignment.interactions || []).slice().sort((a,b) => String(b.interaction_date).localeCompare(String(a.interaction_date))); const concerns = assignment.concerns || []; return <div className="card border-0 shadow-sm sms-card"><div className="card-body p-4"><h2 className="h5">My Mentor Updates</h2><p className="text-muted">Only updates your mentor has chosen to share with you are shown here.</p>{concerns.map((c) => <div className="sms-concern" key={c.id}><span className={`badge text-bg-${tone(c.status)} me-2`}>{human(c.status)}</span><strong>{c.title}</strong>{c.action_plan && <p className="mt-2 mb-0">{c.action_plan}</p>}{c.next_follow_up && <small>Next follow-up: {dateText(c.next_follow_up)}</small>}</div>)}{interactions.map((x) => <div className="sms-interaction" key={x.id}><i className="bi bi-chat-square-heart"/><div><strong>{human(x.interaction_type)}</strong><small>{dateText(x.interaction_date)}</small><p>{x.summary}</p>{x.action_taken && <div className="sms-action"><strong>Next step:</strong> {x.action_taken}</div>}</div></div>)}{!concerns.length && !interactions.length && <Empty text="No student-visible mentor updates yet."/>}</div></div>; }
function Hero({ isCollege, student = false }) { return <div className="sms-hero mb-4"><div><span>{isCollege ? "College Student Success" : "School Student Support"}</span><h1>{student ? "My Mentor & Support" : "Student Mentoring & Support"}</h1><p>{isCollege ? "Connect academic performance, attendance, backlogs, career and follow-ups with faculty mentoring." : "Track attendance, academics, notebook/homework concerns, parent follow-ups and student support in one place."}</p></div><i className="bi bi-person-heart"/></div>; }
function Metric({ icon, label, value, tone: t = "primary" }) { return <div className="col-6 col-lg-3"><div className={`sms-metric sms-${t}`}><i className={`bi ${icon}`}/><div><strong>{value}</strong><small>{label}</small></div></div></div>; }
function Empty({ text }) { return <div className="text-center text-muted py-4"><i className="bi bi-inbox d-block fs-3 mb-2"/>{text}</div>; }
function Loading() { return <div className="container-fluid py-5 text-center"><span className="spinner-border spinner-border-sm me-2"/>Loading mentoring workspace…</div>; }
