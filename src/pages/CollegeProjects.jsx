import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./CollegeProjects.css";

const readRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole");
    return (many.length ? many : [one]).filter(Boolean).map((r) => String(r).toLowerCase());
  } catch (_) {
    return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean);
  }
};
const human = (v) => String(v || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const n = (v) => Number(v || 0);
const fmtDate = (v) => v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString([], { dateStyle: "medium" }) : "—";
const statusColor = (s) => ({ completed: "success", ready_for_viva: "primary", in_progress: "info", approved: "primary", pending_approval: "warning", rejected: "danger", on_hold: "secondary", draft: "secondary", submitted: "info", revision_required: "warning", overdue: "danger", pending: "secondary" }[s] || "secondary");
const MANAGER = new Set(["department_hod", "principal", "academic_coordinator", "coordinator", "examination", "admin", "superadmin", "super_admin"]);
const STAFF = new Set(["teacher", ...MANAGER]);
const EMPTY = { title: "", project_code: "", project_type: "major_project", session_id: "", class_id: "", section_id: "", subject_id: "", guide_user_id: "", co_guide_user_id: "", start_date: "", target_completion_date: "", abstract: "", repository_url: "", live_url: "", status: "draft", remarks: "", member_ids: [] };
const DEFAULT_MILESTONES = ["Topic Approval", "Synopsis / Proposal", "Literature Review", "Design / Development", "Mid Review", "Final Report", "Viva / Presentation"];

export default function CollegeProjects() {
  const { isCollege } = useInstitution();
  const roles = readRoles();
  const isStudent = roles.includes("student");
  const isStaff = roles.some((r) => STAFF.has(r));
  if (!isCollege) return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">Project / Dissertation Management is available in College mode.</div></div>;
  if (isStudent) return <StudentProjects />;
  if (isStaff) return <StaffProjects roles={roles} />;
  return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4">Your role does not have Project / Dissertation access.</div></div>;
}

function StaffProjects({ roles }) {
  const canManageAll = roles.some((r) => MANAGER.has(r));
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({ counts: {} });
  const [meta, setMeta] = useState({ programs: [], sections: [], subjects: [], sessions: [], faculty: [] });
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState({ status: "", class_id: "", q: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, m, p] = await Promise.all([api.get("/college-projects/dashboard"), api.get("/college-projects/meta"), api.get("/college-projects")]);
      setDashboard(d.data || { counts: {} }); setMeta(m.data || {}); setProjects(p.data?.projects || []);
    } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadStudents = useCallback(async (classId, sectionId) => {
    if (!classId) { setStudents([]); return; }
    try { const { data } = await api.get("/college-projects/students", { params: { class_id: classId, section_id: sectionId || undefined } }); setStudents(data?.students || []); }
    catch (_) { setStudents([]); }
  }, []);
  useEffect(() => { if (formOpen) loadStudents(form.class_id, form.section_id); }, [form.class_id, form.section_id, formOpen, loadStudents]);

  const filtered = useMemo(() => projects.filter((p) => {
    if (filter.status && p.status !== filter.status) return false;
    if (filter.class_id && n(p.class_id) !== n(filter.class_id)) return false;
    const q = filter.q.trim().toLowerCase();
    if (q && !`${p.title} ${p.project_code || ""} ${(p.members || []).map((m) => m.student?.name).join(" ")} ${p.guide?.name || ""}`.toLowerCase().includes(q)) return false;
    return true;
  }), [projects, filter]);

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY, session_id: meta.sessions?.[0]?.id || "" }); setStudents([]); setFormOpen(true); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...EMPTY, ...p, session_id: p.session_id || "", class_id: p.class_id || "", section_id: p.section_id || "", subject_id: p.subject_id || "", guide_user_id: p.guide_user_id || "", co_guide_user_id: p.co_guide_user_id || "", member_ids: (p.members || []).map((m) => n(m.student_id)), start_date: p.start_date ? String(p.start_date).slice(0, 10) : "", target_completion_date: p.target_completion_date ? String(p.target_completion_date).slice(0, 10) : "" });
    setFormOpen(true);
  };
  const save = async () => {
    if (!form.title.trim() || !form.class_id) return Swal.fire("Required", "Project title and Program / Semester are required.", "warning");
    try {
      const payload = { ...form, member_ids: form.member_ids.map(n) };
      let project;
      if (editing) {
        const { data } = await api.put(`/college-projects/${editing.id}`, payload); project = data.project;
        await api.put(`/college-projects/${editing.id}/members`, { member_ids: payload.member_ids });
      } else {
        payload.milestones = DEFAULT_MILESTONES.map((title, i) => ({ title, sort_order: i + 1 }));
        const { data } = await api.post("/college-projects", payload); project = data.project;
      }
      setFormOpen(false); setEditing(null); await load();
      if (project) setSelected(project);
      Swal.fire("Saved", editing ? "Project updated." : "Project created with default milestones.", "success");
    } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); }
  };
  const refreshDetail = async (id) => { const { data } = await api.get(`/college-projects/${id}`); setSelected(data.project); await load(); };

  const addMilestone = async () => {
    if (!selected) return;
    const { value } = await Swal.fire({ title: "Add Milestone", html: `<input id="cp-m-title" class="swal2-input" placeholder="Milestone title"><input id="cp-m-due" type="date" class="swal2-input"><input id="cp-m-weight" type="number" class="swal2-input" placeholder="Weightage % (optional)"><textarea id="cp-m-desc" class="swal2-textarea" placeholder="Description"></textarea>`, showCancelButton: true, focusConfirm: false, preConfirm: () => ({ title: document.getElementById("cp-m-title")?.value, due_date: document.getElementById("cp-m-due")?.value || null, weightage: document.getElementById("cp-m-weight")?.value || 0, description: document.getElementById("cp-m-desc")?.value }) });
    if (!value?.title) return;
    try { await api.post(`/college-projects/${selected.id}/milestones`, value); await refreshDetail(selected.id); } catch (e) { Swal.fire("Unable to add", e.response?.data?.message || e.message, "error"); }
  };
  const reviewMilestone = async (m, status) => {
    const { value: remarks } = await Swal.fire({ title: status === "approved" ? "Approve Milestone" : "Request Revision", input: "textarea", inputLabel: "Guide remarks", inputValue: m.guide_remarks || "", showCancelButton: true, confirmButtonText: status === "approved" ? "Approve" : "Send for Revision" });
    if (remarks === undefined) return;
    try { await api.post(`/college-projects/${selected.id}/milestones/${m.id}/review`, { status, guide_remarks: remarks }); await refreshDetail(selected.id); } catch (e) { Swal.fire("Unable to review", e.response?.data?.message || e.message, "error"); }
  };
  const addEvaluation = async () => {
    if (!selected) return;
    const { value } = await Swal.fire({ title: "Add Project Evaluation", html: `<select id="cp-e-type" class="swal2-select"><option value="proposal">Proposal</option><option value="mid_review">Mid Review</option><option value="pre_viva">Pre-Viva</option><option value="final_viva">Final Viva</option><option value="final_evaluation">Final Evaluation</option></select><input id="cp-e-title" class="swal2-input" placeholder="Evaluation title"><input id="cp-e-max" type="number" class="swal2-input" value="100" placeholder="Max marks"><input id="cp-e-marks" type="number" class="swal2-input" placeholder="Marks obtained"><textarea id="cp-e-remarks" class="swal2-textarea" placeholder="Remarks"></textarea>`, showCancelButton: true, focusConfirm: false, preConfirm: () => ({ evaluation_type: document.getElementById("cp-e-type")?.value, title: document.getElementById("cp-e-title")?.value, max_marks: document.getElementById("cp-e-max")?.value || 100, marks_obtained: document.getElementById("cp-e-marks")?.value, remarks: document.getElementById("cp-e-remarks")?.value }) });
    if (!value) return;
    try { await api.post(`/college-projects/${selected.id}/evaluations`, value); await refreshDetail(selected.id); } catch (e) { Swal.fire("Unable to save", e.response?.data?.message || e.message, "error"); }
  };
  const updateStatus = async (status) => { try { await api.put(`/college-projects/${selected.id}`, { status }); await refreshDetail(selected.id); } catch (e) { Swal.fire("Unable to update", e.response?.data?.message || e.message, "error"); } };

  return <div className="container-fluid py-4 cp-page">
    <Hero title="Project / Dissertation Management" subtitle="Track student projects from topic approval and milestones to final report, viva and completion." icon="bi-kanban-fill" />
    <div className="cp-stats mb-4">
      <Stat label="Total Projects" value={dashboard.counts?.total} icon="bi-folder2-open" />
      <Stat label="In Progress" value={dashboard.counts?.in_progress} icon="bi-hourglass-split" />
      <Stat label="Ready for Viva" value={dashboard.counts?.ready_for_viva} icon="bi-mic-fill" />
      <Stat label="Completed" value={dashboard.counts?.completed} icon="bi-check-circle-fill" />
      <Stat label="Delayed" value={dashboard.counts?.delayed} icon="bi-exclamation-triangle-fill" danger />
    </div>
    <div className="cp-panel mb-4">
      <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3"><div><h2 className="h5 mb-1">Projects</h2><div className="text-muted small">{canManageAll ? "Institution-wide project monitoring" : "Projects assigned to you as guide / co-guide"}</div></div><button className="btn btn-primary" onClick={openCreate}><i className="bi bi-plus-lg me-2" />New Project</button></div>
      <div className="row g-2 mb-3"><div className="col-12 col-md-5"><input className="form-control" placeholder="Search title, student, code or guide…" value={filter.q} onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))} /></div><div className="col-6 col-md-3"><select className="form-select" value={filter.class_id} onChange={(e) => setFilter((f) => ({ ...f, class_id: e.target.value }))}><option value="">All programs</option>{(meta.programs || []).map((p) => <option key={p.id} value={p.id}>{p.class_name}</option>)}</select></div><div className="col-6 col-md-3"><select className="form-select" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}><option value="">All statuses</option>{["draft","pending_approval","approved","in_progress","ready_for_viva","completed","on_hold","rejected"].map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div></div>
      {loading ? <Loading /> : <div className="row g-3">{!filtered.length && <Empty text="No projects match the selected filters." />}{filtered.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => setSelected(p)} onEdit={() => openEdit(p)} />)}</div>}
    </div>
    {formOpen && <ProjectForm meta={meta} students={students} form={form} setForm={setForm} editing={editing} onClose={() => setFormOpen(false)} onSave={save} />}
    {selected && <Detail project={selected} staff onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} onAddMilestone={addMilestone} onReview={reviewMilestone} onAddEvaluation={addEvaluation} onStatus={updateStatus} onRefresh={() => refreshDetail(selected.id)} />}
  </div>;
}

function StudentProjects() {
  const [loading, setLoading] = useState(true); const [data, setData] = useState({ projects: [], student: null }); const [selected, setSelected] = useState(null);
  const load = useCallback(async () => { setLoading(true); try { const { data: d } = await api.get("/college-projects/student/me"); setData(d || {}); } catch (e) { Swal.fire("Unable to load", e.response?.data?.message || e.message, "error"); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const refresh = async (id) => { const { data: d } = await api.get(`/college-projects/${id}`); setSelected(d.project); await load(); };
  return <div className="container-fluid py-4 cp-page"><Hero title="My Project / Dissertation" subtitle="Follow milestones, submit reports and track guide feedback from one place." icon="bi-mortarboard-fill" />
    <div className="cp-student-welcome mb-4"><i className="bi bi-person-circle" /><div><strong>{data.student?.name || "Student"}</strong><span>{data.student?.admission_number || ""}</span></div></div>
    {loading ? <Loading /> : <div className="row g-3">{!(data.projects || []).length && <Empty text="No project or dissertation has been assigned to you yet." />}{(data.projects || []).map((p) => <ProjectCard key={p.id} project={p} onOpen={() => setSelected(p)} />)}</div>}
    {selected && <Detail project={selected} onClose={() => setSelected(null)} onRefresh={() => refresh(selected.id)} />}
  </div>;
}

function ProjectCard({ project, onOpen, onEdit }) {
  const approved = (project.milestones || []).filter((m) => m.status === "approved").length;
  return <div className="col-12 col-lg-6 col-xxl-4"><div className="cp-project-card h-100"><div className="d-flex justify-content-between gap-2"><div><span className="cp-type">{human(project.project_type)}</span><h3>{project.title}</h3></div><span className={`badge text-bg-${statusColor(project.status)} align-self-start`}>{human(project.status)}</span></div><div className="cp-project-meta"><span><i className="bi bi-mortarboard" />{project.programSemester?.class_name || "Program / Semester"}</span><span><i className="bi bi-person-badge" />{project.guide?.name || "Guide not assigned"}</span><span><i className="bi bi-people" />{(project.members || []).length} student{(project.members || []).length === 1 ? "" : "s"}</span></div><div className="d-flex justify-content-between small mb-1"><span>Progress</span><strong>{n(project.progress_percentage).toFixed(0)}%</strong></div><div className="progress cp-progress"><div className="progress-bar" style={{ width: `${Math.min(100, n(project.progress_percentage))}%` }} /></div><div className="small text-muted mt-2">{approved}/{(project.milestones || []).length} milestones approved · Target {fmtDate(project.target_completion_date)}</div><div className="d-flex gap-2 mt-3"><button className="btn btn-primary btn-sm flex-grow-1" onClick={onOpen}>Open Project</button>{onEdit && <button className="btn btn-outline-secondary btn-sm" onClick={onEdit}><i className="bi bi-pencil" /></button>}</div></div></div>;
}

function ProjectForm({ meta, students, form, setForm, editing, onClose, onSave }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sections = (meta.sections || []).filter((s) => !form.class_id || n(s.class_id) === n(form.class_id));
  const toggleStudent = (id) => set("member_ids", form.member_ids.includes(n(id)) ? form.member_ids.filter((x) => x !== n(id)) : [...form.member_ids, n(id)]);
  return <div className="cp-modal-backdrop"><div className="cp-modal"><div className="cp-modal-head"><div><small>College Academics</small><h2>{editing ? "Edit Project" : "Create Project / Dissertation"}</h2></div><button className="btn-close" onClick={onClose} /></div><div className="cp-modal-body"><div className="row g-3">
    <Field label="Project Title *" col="col-12 col-lg-8"><input className="form-control" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. AI Based Student Performance Analytics" /></Field><Field label="Project Code" col="col-12 col-lg-4"><input className="form-control" value={form.project_code || ""} onChange={(e) => set("project_code", e.target.value)} /></Field>
    <Field label="Project Type" col="col-6 col-lg-3"><select className="form-select" value={form.project_type} onChange={(e) => set("project_type", e.target.value)}>{["mini_project","major_project","dissertation","research","capstone","other"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field><Field label="Academic Year" col="col-6 col-lg-3"><select className="form-select" value={form.session_id || ""} onChange={(e) => set("session_id", e.target.value)}><option value="">Select</option>{(meta.sessions || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Program / Semester *" col="col-6 col-lg-3"><select className="form-select" value={form.class_id || ""} onChange={(e) => { set("class_id", e.target.value); set("section_id", ""); set("member_ids", []); }}><option value="">Select</option>{(meta.programs || []).map((x) => <option key={x.id} value={x.id}>{x.class_name}</option>)}</select></Field><Field label="Batch / Section" col="col-6 col-lg-3"><select className="form-select" value={form.section_id || ""} onChange={(e) => { set("section_id", e.target.value); set("member_ids", []); }}><option value="">All / Select</option>{sections.map((x) => <option key={x.id} value={x.id}>{x.section_name}</option>)}</select></Field>
    <Field label="Paper / Subject" col="col-12 col-lg-4"><select className="form-select" value={form.subject_id || ""} onChange={(e) => set("subject_id", e.target.value)}><option value="">Not linked to a paper</option>{(meta.subjects || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Guide / Supervisor" col="col-12 col-lg-4"><select className="form-select" value={form.guide_user_id || ""} onChange={(e) => set("guide_user_id", e.target.value)}><option value="">Select faculty</option>{(meta.faculty || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Co-Guide" col="col-12 col-lg-4"><select className="form-select" value={form.co_guide_user_id || ""} onChange={(e) => set("co_guide_user_id", e.target.value)}><option value="">Optional</option>{(meta.faculty || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Start Date" col="col-6 col-lg-3"><input type="date" className="form-control" value={form.start_date || ""} onChange={(e) => set("start_date", e.target.value)} /></Field><Field label="Target Completion" col="col-6 col-lg-3"><input type="date" className="form-control" value={form.target_completion_date || ""} onChange={(e) => set("target_completion_date", e.target.value)} /></Field><Field label="Status" col="col-12 col-lg-3"><select className="form-select" value={form.status || "draft"} onChange={(e) => set("status", e.target.value)}>{["draft","pending_approval","approved","in_progress","ready_for_viva","completed","on_hold","rejected"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></Field>
    <Field label="Repository URL" col="col-12 col-lg-6"><input className="form-control" value={form.repository_url || ""} onChange={(e) => set("repository_url", e.target.value)} placeholder="GitHub / GitLab / Drive link" /></Field><Field label="Live / Demo URL" col="col-12 col-lg-6"><input className="form-control" value={form.live_url || ""} onChange={(e) => set("live_url", e.target.value)} /></Field><Field label="Abstract / Project Description" col="col-12"><textarea className="form-control" rows="4" value={form.abstract || ""} onChange={(e) => set("abstract", e.target.value)} /></Field>
    <div className="col-12"><label className="form-label">Student / Group Members</label><div className="cp-student-picker">{!form.class_id ? <span className="text-muted">Select Program / Semester first.</span> : !students.length ? <span className="text-muted">No enabled students found for this program/batch.</span> : students.map((s) => <label key={s.id} className={`cp-student-option ${form.member_ids.includes(n(s.id)) ? "selected" : ""}`}><input type="checkbox" checked={form.member_ids.includes(n(s.id))} onChange={() => toggleStudent(s.id)} /><span><strong>{s.name}</strong><small>{s.admission_number}</small></span></label>)}</div><div className="form-text">First selected student becomes group lead. You can update members later.</div></div>
  </div></div><div className="cp-modal-foot"><button className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary px-4" onClick={onSave}>{editing ? "Update Project" : "Create Project"}</button></div></div></div>;
}

function Detail({ project, staff = false, onClose, onEdit, onAddMilestone, onReview, onAddEvaluation, onStatus, onRefresh }) {
  const [tab, setTab] = useState("milestones");
  const submit = async (m) => {
    const inputId = `cp-file-${m.id}`;
    const { value } = await Swal.fire({ title: `Submit · ${m.title}`, html: `<textarea id="cp-sub-notes" class="swal2-textarea" placeholder="Submission notes"></textarea><input id="cp-sub-url" class="swal2-input" placeholder="Drive / GitHub / resource URL (optional)"><input id="${inputId}" type="file" class="swal2-file">`, showCancelButton: true, confirmButtonText: "Submit", focusConfirm: false, preConfirm: () => ({ notes: document.getElementById("cp-sub-notes")?.value, url: document.getElementById("cp-sub-url")?.value, file: document.getElementById(inputId)?.files?.[0] || null }) });
    if (!value) return;
    const fd = new FormData(); fd.append("submission_notes", value.notes || ""); fd.append("submission_url", value.url || ""); if (value.file) fd.append("file", value.file);
    try { await api.post(`/college-projects/${project.id}/milestones/${m.id}/submit`, fd); await onRefresh(); Swal.fire("Submitted", "Milestone sent to the guide for review.", "success"); } catch (e) { Swal.fire("Unable to submit", e.response?.data?.message || e.message, "error"); }
  };
  const download = async (m) => { try { const r = await api.get(`/college-projects/${project.id}/milestones/${m.id}/download`, { responseType: "blob" }); const url = URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = m.attachment_original_name || "project-file"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); } catch (e) { Swal.fire("Unable to download", e.response?.data?.message || "File unavailable.", "error"); } };
  return <div className="cp-modal-backdrop"><div className="cp-modal cp-detail-modal"><div className="cp-modal-head"><div><small>{human(project.project_type)}</small><h2>{project.title}</h2><div className="d-flex flex-wrap gap-2 mt-2"><span className={`badge text-bg-${statusColor(project.status)}`}>{human(project.status)}</span><span className="badge text-bg-light border">{n(project.progress_percentage).toFixed(0)}% complete</span></div></div><button className="btn-close" onClick={onClose} /></div><div className="cp-detail-summary"><div><span>Program / Semester</span><strong>{project.programSemester?.class_name || "—"}</strong></div><div><span>Guide</span><strong>{project.guide?.name || "—"}</strong></div><div><span>Target Date</span><strong>{fmtDate(project.target_completion_date)}</strong></div><div><span>Group</span><strong>{(project.members || []).length} student(s)</strong></div></div><div className="cp-tabs"><button className={tab === "milestones" ? "active" : ""} onClick={() => setTab("milestones")}>Milestones</button><button className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>Team & Details</button><button className={tab === "evaluation" ? "active" : ""} onClick={() => setTab("evaluation")}>Evaluation / Viva</button></div><div className="cp-modal-body">
    {tab === "milestones" && <><div className="d-flex justify-content-between align-items-center mb-3"><div><h3 className="h5 mb-1">Project Milestones</h3><div className="small text-muted">Students submit work; guides approve or request revisions.</div></div>{staff && <button className="btn btn-outline-primary btn-sm" onClick={onAddMilestone}><i className="bi bi-plus-lg me-1" />Add Milestone</button>}</div><div className="cp-timeline">{!(project.milestones || []).length && <div className="text-muted py-3">No milestones added yet.</div>}{(project.milestones || []).map((m, i) => <div className={`cp-milestone ${m.status}`} key={m.id}><div className="cp-m-index">{i + 1}</div><div className="cp-m-body"><div className="d-flex flex-wrap justify-content-between gap-2"><div><h4>{m.title}</h4><div className="small text-muted">Due {fmtDate(m.due_date)}{n(m.weightage) ? ` · ${n(m.weightage)}% weightage` : ""}</div></div><span className={`badge text-bg-${statusColor(m.status)} align-self-start`}>{human(m.status)}</span></div>{m.description && <p>{m.description}</p>}{m.submission_notes && <div className="cp-submission-note"><strong>Submission:</strong> {m.submission_notes}</div>}{m.guide_remarks && <div className="cp-guide-note"><strong>Guide:</strong> {m.guide_remarks}</div>}<div className="d-flex flex-wrap gap-2 mt-2">{m.submission_url && <button className="btn btn-outline-secondary btn-sm" onClick={() => window.open(m.submission_url, "_blank", "noopener,noreferrer")}><i className="bi bi-link-45deg me-1" />Open Link</button>}{m.attachment_path && <button className="btn btn-outline-secondary btn-sm" onClick={() => download(m)}><i className="bi bi-download me-1" />{m.attachment_original_name || "Download"}</button>}{!staff && m.status !== "approved" && <button className="btn btn-primary btn-sm" onClick={() => submit(m)}><i className="bi bi-cloud-arrow-up me-1" />Submit / Resubmit</button>}{staff && ["submitted", "revision_required"].includes(m.status) && <><button className="btn btn-success btn-sm" onClick={() => onReview(m, "approved")}>Approve</button><button className="btn btn-outline-warning btn-sm" onClick={() => onReview(m, "revision_required")}>Request Revision</button></>}</div></div></div>)}</div></>}
    {tab === "team" && <div className="row g-3"><div className="col-12 col-lg-6"><div className="cp-subpanel"><h3>Student Team</h3>{!(project.members || []).length ? <div className="text-muted">No members assigned.</div> : (project.members || []).map((m) => <div className="cp-member" key={m.id}><i className="bi bi-person-circle" /><div><strong>{m.student?.name || `Student ${m.student_id}`}</strong><span>{m.student?.admission_number || ""} · {human(m.member_role)}</span></div></div>)}</div></div><div className="col-12 col-lg-6"><div className="cp-subpanel"><h3>Project Details</h3><Info label="Guide" value={project.guide?.name} /><Info label="Co-Guide" value={project.coGuide?.name} /><Info label="Paper / Subject" value={project.subject?.name} /><Info label="Start Date" value={fmtDate(project.start_date)} /><Info label="Target Completion" value={fmtDate(project.target_completion_date)} />{project.repository_url && <Info label="Repository" value={<a href={project.repository_url} target="_blank" rel="noreferrer">Open Repository</a>} />}{project.live_url && <Info label="Demo" value={<a href={project.live_url} target="_blank" rel="noreferrer">Open Demo</a>} />}</div></div>{project.abstract && <div className="col-12"><div className="cp-subpanel"><h3>Abstract / Description</h3><p className="mb-0">{project.abstract}</p></div></div>}</div>}
    {tab === "evaluation" && <><div className="d-flex justify-content-between align-items-center mb-3"><div><h3 className="h5 mb-1">Reviews, Viva & Final Evaluation</h3><div className="small text-muted">Maintain evaluation history without overwriting earlier reviews.</div></div>{staff && <button className="btn btn-outline-primary btn-sm" onClick={onAddEvaluation}>Add Evaluation</button>}</div><div className="row g-3">{!(project.evaluations || []).length && <Empty text="No evaluation or viva result recorded yet." />}{(project.evaluations || []).map((e) => <div className="col-12 col-lg-6" key={e.id}><div className="cp-eval"><div className="d-flex justify-content-between"><div><small>{human(e.evaluation_type)}</small><h4>{e.title || human(e.evaluation_type)}</h4></div>{e.marks_obtained != null && <strong className="cp-score">{n(e.marks_obtained)}/{n(e.max_marks)}</strong>}</div><p>{e.remarks || "No remarks."}</p><div className="small text-muted">Evaluator: {e.evaluator?.name || "Faculty"}</div></div></div>)}</div></>}
  </div>{staff && <div className="cp-modal-foot justify-content-between"><div className="d-flex gap-2">{onEdit && <button className="btn btn-outline-secondary" onClick={onEdit}>Edit Setup</button>}</div><div className="d-flex gap-2"><select className="form-select form-select-sm" value={project.status} onChange={(e) => onStatus(e.target.value)}>{["draft","pending_approval","approved","in_progress","ready_for_viva","completed","on_hold","rejected"].map((x) => <option key={x} value={x}>{human(x)}</option>)}</select></div></div>}</div></div>;
}

function Hero({ title, subtitle, icon }) { return <div className="cp-hero mb-4"><div><span>College Academics · Project Lifecycle</span><h1>{title}</h1><p>{subtitle}</p></div><div className="cp-hero-icon"><i className={`bi ${icon}`} /></div></div>; }
function Stat({ label, value, icon, danger }) { return <div className={`cp-stat ${danger ? "danger" : ""}`}><i className={`bi ${icon}`} /><div><span>{label}</span><strong>{n(value)}</strong></div></div>; }
function Field({ label, col = "col-12", children }) { return <div className={col}><label className="form-label">{label}</label>{children}</div>; }
function Info({ label, value }) { return <div className="cp-info"><span>{label}</span><strong>{value || "—"}</strong></div>; }
function Loading() { return <div className="text-center py-5"><span className="spinner-border text-primary" /><div className="mt-2 text-muted">Loading project data…</div></div>; }
function Empty({ text }) { return <div className="col-12"><div className="cp-empty"><i className="bi bi-folder2-open" /><h3>Nothing here yet</h3><p>{text}</p></div></div>; }
