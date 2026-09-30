import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import "./Assessments.css";

const unwrap = (response) => response?.data?.data ?? response?.data ?? [];
const asList = (value) => Array.isArray(value) ? value : value?.rows || [];
const readJson = (key, fallback = []) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; } };
const roleSet = () => new Set([...readJson("roles"), localStorage.getItem("role")].filter(Boolean).map((v) => String(v).toLowerCase()));
const createRoles = new Set(["teacher", "admin", "superadmin", "super_admin"]);
const managementViewRoles = new Set(["principal", "academic_coordinator", "coordinator"]);
const permissionSet = () => new Set(readJson("permissions").map((v) => String(v).toLowerCase()));
const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3000").replace(/\/+$/, "");
const studentPhotoSrc = (student) => {
  const raw = student?.photo_url || student?.photo;
  if (!raw) return "";
  const value = String(raw).replace(/\\/g, "/");
  if (/^(https?:|data:)/i.test(value)) return value;
  if (value.startsWith("/")) return `${API_BASE}${value}`;
  if (value.startsWith("uploads/")) return `${API_BASE}/${value}`;
  return `${API_BASE}/uploads/photoes/students/${encodeURIComponent(value)}`;
};
const emptyQuestion = (index = 0) => ({ question_type: "mcq", question_text: "", options: ["", "", "", ""], correct_answer: 0, marks: 1, difficulty: "medium", explanation: "", topic: "", sort_order: index });
const emptyForm = {
  online_class_id: "", class_id: "", section_id: "", subject_id: "", title: "", description: "", instructions: "Attempt all questions.",
  assessment_type: "test", mode: "online", total_marks: 20, duration_minutes: 30, starts_at: "", ends_at: "", publish_trigger: "manual", publish_at: "",
  max_attempts: 1, result_release: "manual", randomize_questions: false, randomize_options: false, questions: [emptyQuestion(0)], question_paper: null, supporting_files: [],
};
const fmt = (value) => value ? new Date(value).toLocaleString() : "—";
const toLocalInput = (value) => { if (!value) return ""; const d = new Date(value); const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };
const uniqueOptions = (rows, id, label) => [...new Map(rows.filter((r) => r[id] != null).map((r) => [Number(r[id]), { id: Number(r[id]), label: r[label] || `#${r[id]}` }])).values()];

async function openBlob(url, filename) {
  const response = await api.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; anchor.download = filename || "download"; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

export default function Assessments() {
  const roles = useMemo(roleSet, []); const permissions = useMemo(permissionSet, []); const location = useLocation(); const navigate = useNavigate();
  const canCreate = [...roles].some((r) => createRoles.has(r)) || permissions.has("assessment.manage_all");
  const isManagementViewer = [...roles].some((r) => managementViewRoles.has(r));
  const isStudent = roles.has("student");
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const assessmentTypeFilter = query.get("assessment_type") || "";
  const assignmentOnly = assessmentTypeFilter === "assignment";
  const worksheetOnly = assessmentTypeFilter === "worksheet";
  const focusedLearningMaterial = assignmentOnly || worksheetOnly;
  const pageTitle = assignmentOnly ? "Assignments" : worksheetOnly ? "Worksheets" : "Assessments & Tests";
  const pageSubtitle = assignmentOnly
    ? "Write and publish assignments in a clean teacher notebook, then collect and evaluate student work."
    : worksheetOnly
      ? "Create classroom worksheets in a notebook-style workspace, publish them and review student work."
      : isManagementViewer
        ? "School-wide assessment intelligence, student results, scanned papers and AI review visibility."
        : "Online quizzes, worksheets, scanned answer sheets, AI papers and published results.";
  const newAssessmentData = useCallback(() => ({
    ...emptyForm,
    assessment_type: assessmentTypeFilter || "test",
    online_class_id: query.get("online_class_id") || "",
  }), [assessmentTypeFilter, query]);
  const [rows, setRows] = useState([]); const [options, setOptions] = useState([]); const [loading, setLoading] = useState(true); const [notice, setNotice] = useState(null);
  const [builder, setBuilder] = useState(null); const [attempt, setAttempt] = useState(null); const [offline, setOffline] = useState(null); const [submissions, setSubmissions] = useState(null);
  const flash = useCallback((type, text) => { setNotice({ type, text }); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {}; if (query.get("online_class_id")) params.online_class_id = query.get("online_class_id"); if (assessmentTypeFilter) params.assessment_type = assessmentTypeFilter;
      const calls = [api.get("/api/assessments", { params })]; if (canCreate) calls.push(api.get("/api/assessments/options"));
      const result = await Promise.all(calls); setRows(asList(unwrap(result[0]))); if (canCreate) setOptions(asList(unwrap(result[1])));
    } catch (error) { flash("danger", error.response?.data?.message || "Could not load assessments."); }
    finally { setLoading(false); }
  }, [assessmentTypeFilter, canCreate, flash, query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!canCreate || query.get("create") !== "1") return;
    setBuilder({ mode: "create", data: newAssessmentData() });
    const clean = new URLSearchParams(query); clean.delete("create"); navigate({ pathname: location.pathname, search: clean.toString() ? `?${clean}` : "" }, { replace: true });
  }, [canCreate, location.pathname, navigate, newAssessmentData, query]);

  const refreshDetail = async (id) => unwrap(await api.get(`/api/assessments/${id}`));
  const editAssessment = async (row) => {
    try {
      const full = await refreshDetail(row.id);
      setBuilder({ mode: "edit", id: row.id, data: {
        ...emptyForm, ...full, online_class_id: full.online_class_id || "", section_id: full.section_id || "", duration_minutes: full.duration_minutes || 30,
        starts_at: toLocalInput(full.starts_at), ends_at: toLocalInput(full.ends_at), publish_at: toLocalInput(full.publish_at),
        questions: (full.questions || []).length ? full.questions.map((q, i) => ({ ...q, options: Array.isArray(q.options) ? q.options : [], sort_order: i })) : [emptyQuestion(0)], question_paper: null, supporting_files: [],
      } });
    } catch (error) { flash("danger", error.response?.data?.message || "Could not open assessment."); }
  };
  const mutate = async (row, action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try { await api.post(`/api/assessments/${row.id}/${action}`); flash("success", action === "results/publish" ? "Results published." : `Assessment ${action === "publish" ? "published" : "closed"}.`); await load(); }
    catch (error) { flash("danger", error.response?.data?.message || "Action failed."); }
  };
  const cancel = async (row) => {
    if (!window.confirm(`Cancel “${row.title}”?`)) return;
    try { await api.delete(`/api/assessments/${row.id}`); flash("success", "Assessment cancelled."); await load(); }
    catch (error) { flash("danger", error.response?.data?.message || "Could not cancel assessment."); }
  };
  const startAttempt = async (row) => {
    try { const result = unwrap(await api.post(`/api/assessments/${row.id}/attempts/start`, { client_meta: { source: "web" } })); setAttempt(result); }
    catch (error) { flash("danger", error.response?.data?.message || "Could not start assessment."); }
  };
  const openSubmissions = async (row) => {
    try { const data = asList(unwrap(await api.get(`/api/assessments/${row.id}/submissions`))); setSubmissions({ assessment: row, rows: data }); }
    catch (error) { flash("danger", error.response?.data?.message || "Could not load submissions."); }
  };
  const resultVisible = (row) => Boolean(row.enrollment?.result_published_at);

  return <div className="assessment-page container-fluid py-3">
    {!(builder || attempt || offline || submissions) && <>
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div><h2 className="mb-1">{pageTitle}</h2><div className="text-muted">{pageSubtitle}</div></div>
      <div className="d-flex flex-wrap gap-2 assessment-page-switcher">
        {(query.get("online_class_id") || assessmentTypeFilter) && <button className="btn btn-outline-secondary" onClick={() => navigate("/assessments")}>Show all</button>}
        {!assignmentOnly && <button className="btn btn-outline-primary" onClick={() => navigate("/assessments?assessment_type=assignment")}><i className="bi bi-journal-check me-2" />Assignments</button>}
        {!worksheetOnly && <button className="btn btn-outline-primary" onClick={() => navigate("/assessments?assessment_type=worksheet")}><i className="bi bi-file-earmark-text me-2" />Worksheets</button>}
        {canCreate && <button className="btn btn-primary" onClick={() => setBuilder({ mode: "create", data: newAssessmentData() })}><i className="bi bi-plus-lg me-2" />{assignmentOnly ? "Create Assignment" : worksheetOnly ? "Create Worksheet" : "Create Assessment"}</button>}
      </div>
    </div>
    {notice && <div className={`alert alert-${notice.type} alert-dismissible`}>{notice.text}<button className="btn-close" onClick={() => setNotice(null)} /></div>}
    {isManagementViewer && <div className="assessment-management-banner mb-4"><div><i className="bi bi-bar-chart-line-fill" /><div><strong>Management Assessment View</strong><span>View school-wide tests, student pictures, scores, AI findings and scanned answer sheets. Teacher marks remain read-only unless your role has assessment management permission.</span></div></div></div>}
    <div className="assessment-summary-grid mb-4">
      <Summary icon="bi-files" label="Total" value={rows.length} />
      <Summary icon="bi-broadcast" label="Published" value={rows.filter((r) => r.status === "published").length} />
      <Summary icon="bi-laptop" label="Online" value={rows.filter((r) => r.mode === "online").length} />
      <Summary icon="bi-file-earmark-arrow-up" label="Offline" value={rows.filter((r) => r.mode === "offline").length} />
      {!focusedLearningMaterial && <Summary icon="bi-journal-check" label="Assignments" value={rows.filter((r) => r.assessment_type === "assignment").length} />}
      {!focusedLearningMaterial && <Summary icon="bi-file-earmark-text" label="Worksheets" value={rows.filter((r) => r.assessment_type === "worksheet").length} />}
    </div>

    {loading ? <div className="card border-0 shadow-sm p-5 text-center">Loading assessments…</div> : rows.length === 0 ? <div className="assessment-empty card border-0 shadow-sm p-5 text-center"><i className="bi bi-clipboard2-check" /><h4>No assessments yet</h4><p className="text-muted mb-0">Teachers can create an online quiz or publish an offline written paper.</p></div> :
      <div className="row g-3">{rows.map((row) => <div className="col-xl-4 col-lg-6" key={row.id}><article className="assessment-card card border-0 shadow-sm h-100">
        <div className="card-body">
          <div className="d-flex justify-content-between gap-2"><div><span className={`assessment-mode mode-${row.mode}`}><i className={`bi ${row.mode === "online" ? "bi-laptop" : "bi-file-earmark-text"}`} /> {row.mode}</span><span className="assessment-type"><i className="bi bi-tag me-1" />{String(row.assessment_type || "test").replaceAll("_", " ")}</span><span className={`assessment-status status-${row.status}`}>{row.status.replaceAll("_", " ")}</span></div><span className="fw-semibold">{row.total_marks} marks</span></div>
          <h5 className="mt-3 mb-1">{row.title}</h5><div className="text-muted small">{row.class?.class_name}{row.section?.section_name ? ` – ${row.section.section_name}` : ""} · {row.subject?.name}</div>
          {row.onlineClass && <div className="linked-class mt-2"><i className="bi bi-camera-video me-1" />{row.onlineClass.title}</div>}
          <div className="assessment-meta mt-3"><span><i className="bi bi-calendar-event" /> Opens {fmt(row.starts_at || row.published_at)}</span><span><i className="bi bi-hourglass-split" /> {row.duration_minutes ? `${row.duration_minutes} min` : "Written submission"}</span><span><i className="bi bi-clock-history" /> Deadline {fmt(row.ends_at)}</span></div>
          {!row.can_manage && row.enrollment && <ResultStrip enrollment={row.enrollment} total={row.total_marks} visible={resultVisible(row)} />}
        </div>
        <div className="card-footer bg-white border-0 pt-0"><div className="d-flex flex-wrap gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => openBlob(`/api/assessments/${row.id}/pdf`, `${row.title}.pdf`)}><i className="bi bi-file-pdf me-1" />Paper</button>
          {row.can_view_submissions && <button className="btn btn-sm btn-outline-dark" onClick={() => openBlob(`/api/assessments/${row.id}/pdf?answer_key=1`, `${row.title}-answer-key.pdf`)}>Answer Key</button>}
          {row.can_manage && ["draft", "scheduled"].includes(row.status) && <button className="btn btn-sm btn-outline-primary" onClick={() => editAssessment(row)}>Edit</button>}
          {row.can_manage && ["draft", "scheduled"].includes(row.status) && <button className="btn btn-sm btn-primary" onClick={() => mutate(row, "publish", `Publish “${row.title}” now?`)}>Publish</button>}
          {row.can_manage && row.status === "published" && <button className="btn btn-sm btn-outline-danger" onClick={() => mutate(row, "close", "Close submissions for this assessment?")}>Close</button>}
          {row.can_view_submissions && !["draft", "scheduled", "cancelled"].includes(row.status) && <button className="btn btn-sm btn-outline-success" onClick={() => openSubmissions(row)}><i className="bi bi-people me-1" />{row.can_manage ? "Submissions" : "Student Results"}</button>}
          {row.can_manage && ["closed", "evaluated", "result_published"].includes(row.status) && <button className="btn btn-sm btn-success" onClick={() => mutate(row, "results/publish", "Publish all evaluated results to students and parents?")}>Publish Results</button>}
          {row.can_manage && !["cancelled", "result_published"].includes(row.status) && <button className="btn btn-sm btn-link text-danger" onClick={() => cancel(row)}>Cancel</button>}
          {isStudent && row.status === "published" && row.mode === "online" && !["submitted", "evaluated"].includes(row.enrollment?.status) && <button className="btn btn-sm btn-primary" onClick={() => startAttempt(row)}>{row.assessment_type === "assignment" ? "Open Assignment" : row.assessment_type === "worksheet" ? "Open Worksheet" : "Attempt Test"}</button>}
          {isStudent && row.status === "published" && row.mode === "offline" && !["submitted", "evaluated"].includes(row.enrollment?.status) && <button className="btn btn-sm btn-primary" onClick={() => setOffline(row)}><i className="bi bi-camera me-1" />{["assignment", "worksheet"].includes(row.assessment_type) ? "Upload Work" : "Upload Answer Sheets"}</button>}
          {(row.files || []).filter((f) => ["question_paper", "supporting_material"].includes(f.kind)).map((file) => <button key={file.id} className="btn btn-sm btn-outline-secondary" onClick={() => openBlob(`/api/assessments/${row.id}/files/${file.id}`, file.original_name)}><i className="bi bi-download me-1" />{file.original_name}</button>)}
        </div></div>
      </article></div>)}</div>}

    </>}
    {(builder || attempt || offline || submissions) && notice && <div role="alert" className={`alert alert-${notice.type}`}>{notice.text}</div>}
    {builder && <AssessmentBuilder options={options} state={builder} onClose={() => setBuilder(null)} onSaved={async (message) => { setBuilder(null); flash("success", message); await load(); }} onError={(m) => flash("danger", m)} />}
    {attempt && <AttemptModal payload={attempt} onClose={() => setAttempt(null)} onSubmitted={async () => { setAttempt(null); flash("success", "Assessment submitted successfully."); await load(); }} onError={(m) => flash("danger", m)} />}
    {offline && <OfflineSubmit assessment={offline} onClose={() => setOffline(null)} onSubmitted={async () => { setOffline(null); flash("success", "Scanned answer sheets submitted."); await load(); }} onError={(m) => flash("danger", m)} />}
    {submissions && <SubmissionsModal state={submissions} onClose={() => setSubmissions(null)} onChanged={async () => { await openSubmissions(submissions.assessment); await load(); }} onError={(m) => flash("danger", m)} />}
  </div>;
}

function Summary({ icon, label, value }) { return <div className="assessment-summary card border-0 shadow-sm"><i className={`bi ${icon}`} /><div><div className="text-muted small">{label}</div><strong>{value}</strong></div></div>; }
function ResultStrip({ enrollment, total, visible }) {
  if (!visible) return <div className="student-result mt-3"><span>Status</span><strong>{String(enrollment.status || "assigned").replaceAll("_", " ")}</strong></div>;
  return <div className="student-result published mt-3"><span>Result</span><strong>{enrollment.obtained_marks ?? 0}/{total} · {enrollment.grade || "—"}</strong>{enrollment.teacher_feedback && <small>{enrollment.teacher_feedback}</small>}</div>;
}

function AssessmentBuilder({ options, state, onClose, onSaved, onError }) {
  const [form, setForm] = useState(state.data); const [busy, setBusy] = useState(false); const [aiBusy, setAiBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false); const [importNotice, setImportNotice] = useState("");
  const questionImportRef = useRef(null);
  const [step, setStep] = useState(0);
  const [validation, setValidation] = useState("");
  const headingRef = useRef(null);
  const steps = ["Class & topic", "Write questions", "Delivery", "Review & save"];
  const working = busy || aiBusy || importBusy;
  useEffect(() => { headingRef.current?.focus(); headingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [step]);
  const validateStep = (current) => {
    if (current === 0 && (!form.class_id || !form.subject_id || !form.title.trim())) return "Choose a class and subject, then write a title.";
    if (current === 1) {
      if (form.mode === "online" && !form.questions.length) return "Add at least one question for an online worksheet.";
      for (const [i, q] of form.questions.entries()) {
        if (form.mode === "offline" && !q.question_text?.trim()) continue;
        if (!q.question_text?.trim()) return `Write question ${i + 1}, or remove the empty question.`;
        if (!(Number(q.marks) > 0)) return `Choose marks greater than zero for question ${i + 1}.`;
        if (["mcq", "true_false"].includes(q.question_type) && (!(q.options?.length >= 2) || q.options.some((o) => !String(o).trim()) || q.correct_answer == null || !Number.isInteger(Number(q.correct_answer)) || Number(q.correct_answer) < 0 || Number(q.correct_answer) >= q.options.length)) return `Complete the options and select a correct answer for question ${i + 1}.`;
      }
    }
    if (current === 2) {
      if (!(Number(form.total_marks) > 0)) return "Total marks must be greater than zero.";
      if (form.mode === "online" && (!(Number(form.duration_minutes) >= 1) || !Number.isInteger(Number(form.max_attempts)) || Number(form.max_attempts) < 1 || Number(form.max_attempts) > 10)) return "Set a duration of at least one minute and between 1 and 10 attempts.";
      if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) return "The deadline must be after the available-from date.";
      if (form.publish_trigger === "scheduled" && (!form.publish_at || new Date(form.publish_at) <= new Date())) return "Choose a future publishing date and time.";
      if (form.publish_trigger === "after_class" && !form.online_class_id) return "Enter a linked online class for publishing after class.";
      if (form.mode === "online" && !form.questions.length) return "Online work needs questions. Return to Write questions to add one.";
    }
    return "";
  };
  const goToStep = (next) => {
    if (working) return;
    for (let i = 0; i < next; i++) {
      const error = validateStep(i);
      if (error) { setValidation(error); setStep(i); return; }
    }
    setValidation(""); setStep(next);
  };
  const classRows = options.filter((o) => !form.class_id || Number(o.class_id) === Number(form.class_id));
  const sectionRows = classRows.filter((o) => !form.section_id || Number(o.section_id) === Number(form.section_id));
  const classes = uniqueOptions(options, "class_id", "class_name"); const sections = uniqueOptions(classRows, "section_id", "section_name"); const subjects = uniqueOptions(sectionRows, "subject_id", "subject_name");
  const updateQuestion = (index, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));
  const addQuestion = () => setForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion(f.questions.length)] }));
  const removeQuestion = (index) => setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, sort_order: i })) }));
  const materialName = form.assessment_type === "worksheet" ? "Worksheet" : form.assessment_type === "assignment" ? "Assignment" : "Assessment";
  const generateAi = async () => {
    if (!form.class_id || !form.subject_id || !form.title) return onError("Select class, subject and enter a title before AI generation.");
    setAiBusy(true);
    try {
      const result = unwrap(await api.post("/api/assessments/ai/generate", { class_id: form.class_id, section_id: form.section_id || null, subject_id: form.subject_id, title: form.title, topic: form.description, total_marks: Number(form.total_marks), duration_minutes: Number(form.duration_minutes), question_count: Math.max(1, form.questions.length || 10), question_types: ["mcq", "true_false", "fill_blank", "short", "long"], language: "English", assessment_type: form.assessment_type }));
      setForm((f) => ({ ...f, title: result.title || f.title, description: result.description || f.description, instructions: result.instructions || f.instructions, questions: result.questions || f.questions, ai_meta: result.ai_meta }));
    } catch (error) { onError(error.response?.data?.message || `AI could not generate the ${materialName.toLowerCase()}.`); }
    finally { setAiBusy(false); }
  };
  const importQuestionDocument = async (file) => {
    if (!file) return;
    if (!form.class_id || !form.subject_id) {
      if (questionImportRef.current) questionImportRef.current.value = "";
      return onError("Select class and subject before importing questions.");
    }
    setImportBusy(true); setImportNotice("");
    try {
      const fd = new FormData();
      fd.append("assessment_document", file);
      fd.append("class_id", form.class_id);
      if (form.section_id) fd.append("section_id", form.section_id);
      fd.append("subject_id", form.subject_id);
      fd.append("assessment_type", form.assessment_type);
      if (form.title) fd.append("title", form.title);
      if (form.description) fd.append("topic", form.description);
      const result = unwrap(await api.post("/api/assessments/ai/import-document", fd));
      const imported = Array.isArray(result.questions) ? result.questions : [];
      if (!imported.length) throw new Error("No readable questions were detected.");
      setForm((current) => {
        const existing = (current.questions || []).filter((q) => String(q.question_text || "").trim());
        const questions = [...existing, ...imported].map((q, i) => ({ ...q, sort_order: i }));
        return {
          ...current,
          title: current.title || result.document?.title || "",
          instructions: current.instructions || result.document?.instructions || "",
          total_marks: Number(result.total_marks) > 0 ? result.total_marks : current.total_marks,
          questions,
          ai_meta: { ...(current.ai_meta || {}), document_import: true, teacher_review_required: true },
        };
      });
      setImportNotice(`${imported.length} question(s) extracted${result.review_count ? ` · ${result.review_count} need review` : ""}. Review before saving.`);
    } catch (error) {
      onError(error.response?.data?.message || error.message || "AI could not read this question document.");
    } finally {
      setImportBusy(false);
      if (questionImportRef.current) questionImportRef.current.value = "";
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (working) return;
    if (step < 3) { goToStep(step + 1); return; }
    for (let i = 0; i < 3; i++) {
      const error = validateStep(i);
      if (error) { setValidation(error); setStep(i); return; }
    }
    setBusy(true);
    try {
      const fd = new FormData();
      const data = { ...form, questions: form.mode === "online" ? form.questions : form.questions.filter((q) => q.question_text?.trim()), starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "", ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : "", publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : "" };
      delete data.question_paper; delete data.supporting_files;
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        if (["questions", "ai_meta", "settings"].includes(key)) fd.append(key, JSON.stringify(value || (key === "questions" ? [] : {})));
        else fd.append(key, typeof value === "boolean" ? String(value) : value);
      }
      if (form.question_paper) fd.append("question_paper", form.question_paper);
      for (const file of form.supporting_files || []) fd.append("supporting_files", file);
      if (state.mode === "edit") await api.patch(`/api/assessments/${state.id}`, fd); else await api.post("/api/assessments", fd);
      onSaved(state.mode === "edit" ? `${materialName} updated.` : `${materialName} created.`);
    } catch (error) { onError(error.response?.data?.errors?.join(". ") || error.response?.data?.message || `Could not save ${materialName.toLowerCase()}.`); }
    finally { setBusy(false); }
  };
  return <WorkspacePage title={`${state.mode === "edit" ? "Edit" : "Create"} ${materialName}`} onClose={working ? undefined : onClose}><form onSubmit={submit} noValidate>
    <nav className="worksheet-steps" aria-label="Worksheet creation steps">{steps.map((label, i) => <button type="button" key={label} disabled={working} aria-current={step === i ? "step" : undefined} className={step === i ? "active" : ""} onClick={() => goToStep(i)}><span>{i + 1}</span>{label}</button>)}</nav>
    <div className="worksheet-step-heading"><p>Step {step + 1} of {steps.length}</p><h2 ref={headingRef} tabIndex={-1}>{steps[step]}</h2><span>{["Choose your learners and give this work a clear purpose.", "Write on the notebook below, generate questions, or import a paper.", "Choose how students will complete the work and when to share it.", "Read through the worksheet before saving or publishing."][step]}</span></div>
    {validation && <div role="alert" className="alert alert-warning mx-3">{validation}</div>}
    <div className="assessment-builder-body assessment-notebook-builder">
      {step === 0 && <>
      <section className="assessment-notebook-sheet">
        <div className="assessment-notebook-kicker"><i className="bi bi-journal-text" /> Choose where this work belongs</div>
        <ChoiceField label="Class" required value={form.class_id} options={classes} onChange={(v) => setForm({ ...form, class_id: v, section_id: "", subject_id: "" })} />
        <ChoiceField label="Section" value={form.section_id} options={sections} onChange={(v) => setForm({ ...form, section_id: v, subject_id: "" })} allowEmpty empty="All sections" />
        <ChoiceField label="Subject" required value={form.subject_id} options={subjects} onChange={(v) => setForm({ ...form, subject_id: v })} />
      </section>

      <section className="assessment-notebook-sheet mt-3">
        <div className="assessment-notebook-kicker"><i className="bi bi-pencil-square" /> Write the learning work</div>
        <ChoiceField label="Type" value={form.assessment_type} options={[{ id: "assignment", label: "Assignment" }, { id: "worksheet", label: "Worksheet" }, { id: "quiz", label: "Quiz" }, { id: "test", label: "Test" }, { id: "practice", label: "Practice" }]} onChange={(v) => setForm({ ...form, assessment_type: v })} />
        <NotebookLine label="Title" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder={form.assessment_type === "worksheet" ? "e.g. Fractions Practice Worksheet" : "e.g. Chapter 4 Home Assignment"} />
        <NotebookArea label="Chapter / Topic / What students should work on" value={form.description || ""} onChange={(v) => setForm({ ...form, description: v })} placeholder="Write the chapter, topic, learning focus or task in your own words…" />
        <NotebookArea label="Teacher Instructions" value={form.instructions || ""} onChange={(v) => setForm({ ...form, instructions: v })} placeholder="Write clear instructions for students…" compact />
      </section>

      </>}
      {step === 2 && <section className="assessment-notebook-sheet mt-3">
        <div className="assessment-notebook-kicker"><i className="bi bi-sliders" /> Delivery & planning</div>
        <ChoiceField label="Mode" value={form.mode} options={[{ id: "offline", label: "Written / scanned upload" }, { id: "online", label: "Online attempt" }]} onChange={(v) => setForm({ ...form, mode: v })} />
        <div className="assessment-planning-grid">
          <CompactField label="Total Marks" type="number" min="0" step="0.5" value={form.total_marks} onChange={(v) => setForm({ ...form, total_marks: v })} />
          <CompactField label="Duration (minutes)" type="number" min="1" value={form.duration_minutes} onChange={(v) => setForm({ ...form, duration_minutes: v })} />
          <ChoiceField compact label="Maximum Attempts" value={form.max_attempts} options={Array.from({ length: 10 }, (_, i) => ({ id: i + 1, label: String(i + 1) }))} onChange={(v) => setForm({ ...form, max_attempts: v })} />
          <CompactField label="Available From" type="datetime-local" value={form.starts_at} onChange={(v) => setForm({ ...form, starts_at: v })} />
          <CompactField label="Deadline" type="datetime-local" value={form.ends_at} onChange={(v) => setForm({ ...form, ends_at: v })} />

        </div>
        <ChoiceField label="Publish" value={form.publish_trigger} options={[{ id: "manual", label: "Save as draft" }, { id: "immediate", label: "Publish now" }, { id: "scheduled", label: "Scheduled" }, { id: "after_class", label: "After linked class" }]} onChange={(v) => setForm({ ...form, publish_trigger: v })} />
        {form.publish_trigger === "scheduled" && <div className="assessment-planning-grid"><CompactField label="Publish At" required type="datetime-local" value={form.publish_at} onChange={(v) => setForm({ ...form, publish_at: v })} /></div>}
        <details className="worksheet-advanced"><summary>More settings · results, random order & linked class</summary>
        <CompactField label="Linked Online Class ID" value={form.online_class_id} onChange={(v) => setForm({ ...form, online_class_id: v })} placeholder="Optional" />
        <ChoiceField label="Result Release" value={form.result_release} options={[{ id: "manual", label: "Teacher publishes results" }, { id: "immediate", label: "Immediate when auto-checked" }]} onChange={(v) => setForm({ ...form, result_release: v })} />
        <div className="assessment-inline-checks"><Check label="Randomize questions" checked={form.randomize_questions} onChange={(v) => setForm({ ...form, randomize_questions: v })} /><Check label="Randomize options" checked={form.randomize_options} onChange={(v) => setForm({ ...form, randomize_options: v })} /></div>
        </details>
      </section>}

      {step === 1 && <>
      <ChoiceField label="How will students complete this work?" value={form.mode} options={[{ id: "online", label: "Answer online" }, { id: "offline", label: "Write on paper / upload" }]} onChange={(v) => setForm({ ...form, mode: v })} />
      {form.mode === "offline" && <div className="assessment-upload-box mt-3"><h6><i className="bi bi-file-earmark-pdf me-2" />Question Paper / Printable Work</h6><p className="text-muted small">Upload PDF/Word/image, or keep the questions below to generate the branded PDF.</p><input className="form-control" type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setForm({ ...form, question_paper: e.target.files?.[0] || null })} />{form.question_paper && <p className="mt-2 mb-0">Selected: {form.question_paper.name}</p>}</div>}

      <div className="assessment-question-heading mt-4 mb-2"><div><h5 className="mb-0">Questions / Tasks</h5><small className="text-muted">Write naturally like a worksheet notebook. Long text areas expand while you type.</small></div><div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-outline-primary" disabled={aiBusy || importBusy} onClick={generateAi}><i className="bi bi-stars me-1" />{aiBusy ? "Generating…" : "AI Generate"}</button><button type="button" className="btn btn-primary" disabled={importBusy || aiBusy} onClick={() => questionImportRef.current?.click()}><i className="bi bi-file-earmark-scan me-1" />{importBusy ? "Reading…" : "AI Import Questions"}</button><input ref={questionImportRef} hidden type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => importQuestionDocument(e.target.files?.[0])} /><button type="button" className="btn btn-outline-secondary" onClick={addQuestion}><i className="bi bi-plus-lg me-1" />Add Question</button></div></div>
      {importNotice && <div className="alert alert-info py-2 small"><i className="bi bi-check2-circle me-1" />{importNotice}</div>}
      {form.questions.map((q, index) => <QuestionEditor key={`${q.id || "new"}-${index}`} index={index} value={q} onChange={(patch) => updateQuestion(index, patch)} onRemove={() => removeQuestion(index)} />)}
      <div className="assessment-upload-box mt-3"><label className="form-label fw-semibold">Supporting materials</label><input className="form-control" type="file" multiple onChange={(e) => setForm({ ...form, supporting_files: Array.from(e.target.files || []) })} />{(form.supporting_files || []).map((file, i) => <p className="mt-2 mb-0" key={i}>{file.name}</p>)}</div>
      </>}
      {step === 3 && <section className="assessment-notebook-sheet worksheet-preview">
        <div className="assessment-notebook-kicker"><i className="bi bi-journal-check" /> {materialName} preview</div>
        <h2>{form.title}</h2>
        <p className="text-muted">{classes.find((o) => String(o.id) === String(form.class_id))?.label} · {sections.find((o) => String(o.id) === String(form.section_id))?.label || "All sections"} · {subjects.find((o) => String(o.id) === String(form.subject_id))?.label}</p>
        <p>{form.total_marks} marks · {form.mode === "online" ? `Online · ${form.duration_minutes} minutes` : "Written / scanned upload"}</p>
        <p className="worksheet-preserve-lines">{form.description}</p><p className="worksheet-preserve-lines">{form.instructions}</p>
        {form.questions.map((q, i) => <article className="worksheet-preview-question" key={q.id || i}><div><strong>{i + 1}. {q.question_text}</strong><span>{q.marks} marks · {q.difficulty}</span></div>{["mcq", "true_false"].includes(q.question_type) ? <ol type="A">{(q.options || []).map((o, j) => <li key={j}>{o}</li>)}</ol> : <div className="worksheet-answer-lines" />}<details><summary>Teacher answer key</summary><p>{["mcq", "true_false"].includes(q.question_type) ? q.options?.[Number(q.correct_answer)] : q.question_type === "fill_blank" ? (Array.isArray(q.correct_answer) ? q.correct_answer.join(", ") : q.correct_answer) : q.explanation || "No marking guidance added."}</p></details></article>)}
        {form.question_paper && <p>Question paper: {form.question_paper.name}</p>}
        {(form.supporting_files || []).map((file, i) => <p key={i}>Supporting material: {file.name}</p>)}
        <div className="worksheet-review-delivery"><strong>{form.publish_trigger === "immediate" ? "Ready to publish now" : form.publish_trigger === "scheduled" ? `Scheduled for ${fmt(form.publish_at)}` : form.publish_trigger === "after_class" ? "Publish after the linked class" : "Save as draft"}</strong><p className="mb-0">Available: {fmt(form.starts_at)} · Deadline: {fmt(form.ends_at)}</p></div>
      </section>}
    </div>
    <div className="modal-action-bar worksheet-actions"><span>{form.questions.length} questions · {form.questions.reduce((sum, q) => sum + Number(q.marks || 0), 0)} question marks</span><button type="button" className="btn btn-outline-secondary" disabled={working} onClick={() => step ? goToStep(step - 1) : onClose()}>{step ? "Back" : "Cancel"}</button><button className="btn btn-primary" disabled={working}>{busy ? "Saving…" : step < 3 ? "Continue" : form.publish_trigger === "immediate" ? `Publish ${materialName}` : form.publish_trigger === "scheduled" ? `Schedule ${materialName}` : `Save ${materialName}`}</button></div>
  </form></WorkspacePage>;
}

function QuestionEditor({ index, value, onChange, onRemove }) {
  const objective = ["mcq", "true_false"].includes(value.question_type); const options = value.question_type === "true_false" ? ["True", "False"] : (value.options || ["", "", "", ""]);
  return <section className="assessment-question-sheet mt-3">
    <div className="assessment-question-sheet-head"><div><span>Question {index + 1}</span>{value.source_number ? <small>Source {value.source_number}</small> : null}</div><button type="button" className="btn btn-sm btn-link text-danger" onClick={onRemove}>Remove</button></div>
    {value.needs_review && <div className="alert alert-warning py-2 small mb-2">{Array.isArray(value.warnings) && value.warnings.length ? value.warnings.join(" · ") : "Please verify this scanned question."}</div>}
    <ChoiceField compact label="Question Type" value={value.question_type} options={[{ id: "mcq", label: "MCQ" }, { id: "true_false", label: "True / False" }, { id: "fill_blank", label: "Fill Blank" }, { id: "short", label: "Short" }, { id: "long", label: "Long" }]} onChange={(v) => onChange({ question_type: v, correct_answer: ["mcq", "true_false"].includes(v) ? 0 : "", options: v === "true_false" ? ["True", "False"] : v === "mcq" ? (value.options?.length ? value.options : ["", "", "", ""]) : [] })} />
    <div className="assessment-planning-grid assessment-question-meta">
      <CompactField label="Marks" type="number" min="0.5" step="0.5" value={value.marks} onChange={(v) => onChange({ marks: v })} />
      <CompactField label="Topic" value={value.topic || ""} onChange={(v) => onChange({ topic: v })} />
    </div>
    <DifficultySlider value={value.difficulty || "medium"} onChange={(difficulty) => onChange({ difficulty })} />
    <NotebookArea label="Question / Task" required value={value.question_text} onChange={(v) => onChange({ question_text: v })} placeholder="Write the question or task here…" compact />
    {objective && <div className="assessment-options-block"><label>Options and correct answer</label><div className="assessment-options-grid">{options.map((option, oi) => <div className={`assessment-option-line ${value.correct_answer != null && Number(value.correct_answer) === oi ? "is-correct" : ""}`} key={oi}><input type="radio" aria-label={`Correct answer: option ${oi + 1}`} name={`correct-${index}`} checked={value.correct_answer != null && Number(value.correct_answer) === oi} onChange={() => onChange({ correct_answer: oi })} /><input required aria-label={`Option ${oi + 1}`} value={option} disabled={value.question_type === "true_false"} placeholder={`Option ${oi + 1}`} onChange={(e) => { const next = [...options]; next[oi] = e.target.value; onChange({ options: next }); }} /></div>)}</div></div>}
    {value.question_type === "fill_blank" && <NotebookLine label="Accepted answer(s), comma separated" value={Array.isArray(value.correct_answer) ? value.correct_answer.join(", ") : value.correct_answer || ""} onChange={(v) => onChange({ correct_answer: v.split(",").map((x) => x.trim()).filter(Boolean) })} />}
    {["short", "long"].includes(value.question_type) && <NotebookArea label="Answer key / marking guidance" value={value.explanation || ""} onChange={(v) => onChange({ explanation: v })} placeholder="Write the expected answer or marking guidance…" compact />}
  </section>;
}

function DifficultySlider({ value, onChange }) {
  const levels = ["easy", "medium", "hard"];
  return <div className="worksheet-difficulty"><label><span>Difficulty · <strong>{value}</strong></span><input type="range" min="0" max="2" step="1" value={Math.max(0, levels.indexOf(value))} aria-label="Question difficulty" aria-valuetext={value} onChange={(e) => onChange(levels[Number(e.target.value)])} /></label><div>{levels.map((level) => <button type="button" key={level} aria-pressed={level === value} onClick={() => onChange(level)}>{level}</button>)}</div></div>;
}

function ChoiceField({ label, options = [], value, onChange, allowEmpty = false, empty = "All", required = false, compact = false }) {
  return <div className={`assessment-choice-field ${compact ? "is-compact" : ""}`}><div className="assessment-choice-label">{label}{required ? <span>*</span> : null}</div><div className="assessment-choice-list">{allowEmpty && <button type="button" aria-pressed={String(value || "") === ""} className={`assessment-choice ${String(value || "") === "" ? "active" : ""}`} onClick={() => onChange("")}>{empty}</button>}{options.map((option) => <button type="button" key={option.id} aria-pressed={String(value) === String(option.id)} className={`assessment-choice ${String(value) === String(option.id) ? "active" : ""}`} onClick={() => onChange(String(option.id))}>{option.label}</button>)}{!options.length && !allowEmpty && <span className="assessment-choice-empty">Choose the previous option first</span>}</div></div>;
}

function NotebookLine({ label, value, onChange, required = false, placeholder = "" }) {
  return <label className="assessment-notebook-line"><span>{label}{required ? <b>*</b> : null}</span><input required={required} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

function NotebookArea({ label, value, onChange, required = false, placeholder = "", compact = false }) {
  const ref = useRef(null);
  const resize = useCallback(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.max(compact ? 78 : 112, el.scrollHeight)}px`; }, [compact]);
  useEffect(() => { resize(); }, [resize, value]);
  return <label className={`assessment-notebook-area ${compact ? "is-compact" : ""}`}><span>{label}{required ? <b>*</b> : null}</span><textarea ref={ref} required={required} value={value ?? ""} placeholder={placeholder} onChange={(e) => { onChange(e.target.value); requestAnimationFrame(resize); }} /></label>;
}

function CompactField({ label, onChange, ...props }) {
  return <label className="assessment-compact-field"><span>{label}</span><input onChange={(e) => onChange(e.target.value)} {...props} /></label>;
}

function AttemptModal({ payload, onClose, onSubmitted, onError }) {
  const { attempt, assessment } = payload; const [answers, setAnswers] = useState(() => Object.fromEntries((assessment.questions || []).map((q) => [q.id, { question_id: q.id, answer_value: null, answer_text: "" }]))); const [remaining, setRemaining] = useState(null); const [busy, setBusy] = useState(false); const latest = useRef(answers); latest.current = answers;
  const normalizedAnswers = useCallback(() => Object.values(latest.current), []);
  const save = useCallback(async () => { try { await api.put(`/api/assessments/${assessment.id}/attempts/${attempt.id}/answers`, { answers: normalizedAnswers() }); } catch (_) {} }, [assessment.id, attempt.id, normalizedAnswers]);
  const submit = useCallback(async (auto = false) => {
    if (!auto && !window.confirm("Submit this assessment? You may not be able to change answers afterward.")) return;
    setBusy(true); try { await api.post(`/api/assessments/${assessment.id}/submit`, { attempt_id: attempt.id, answers: normalizedAnswers() }); onSubmitted(); } catch (error) { onError(error.response?.data?.message || "Could not submit assessment."); } finally { setBusy(false); }
  }, [assessment.id, attempt.id, normalizedAnswers, onError, onSubmitted]);
  useEffect(() => { const timer = setInterval(save, 20000); return () => clearInterval(timer); }, [save]);
  useEffect(() => {
    if (!assessment.duration_minutes) return undefined;
    const end = new Date(attempt.started_at).getTime() + Number(assessment.duration_minutes) * 60000;
    const tick = () => { const seconds = Math.max(0, Math.floor((end - Date.now()) / 1000)); setRemaining(seconds); if (seconds === 0) submit(true); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [assessment.duration_minutes, attempt.started_at, submit]);
  const setAnswer = (question, patch) => setAnswers((old) => ({ ...old, [question.id]: { ...old[question.id], ...patch } }));
  return <WorkspacePage title={assessment.title} onClose={onClose}><div className="attempt-header"><span>{assessment.total_marks} marks</span><span>{assessment.questions?.length || 0} questions</span>{remaining != null && <strong className={remaining < 60 ? "text-danger" : ""}><i className="bi bi-stopwatch me-1" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong>}</div><div className="attempt-body">
    {(assessment.questions || []).map((q, index) => <div className="attempt-question" key={q.id}><div className="d-flex justify-content-between"><strong>Q{index + 1}. {q.question_text}</strong><span>{q.marks} marks</span></div>
      {["mcq", "true_false"].includes(q.question_type) ? <div className="mt-2">{(q.options || []).map((option, oi) => <label className="answer-option" key={oi}><input type="radio" name={`q-${q.id}`} checked={Number(answers[q.id]?.answer_value) === oi} onChange={() => setAnswer(q, { answer_value: oi, answer_text: "" })} /><span>{option}</span></label>)}</div> : <textarea className="form-control mt-2" rows={q.question_type === "long" ? 6 : 3} value={answers[q.id]?.answer_text || ""} onChange={(e) => setAnswer(q, { answer_text: e.target.value, answer_value: q.question_type === "fill_blank" ? e.target.value : null })} />}
    </div>)}
  </div><div className="modal-action-bar"><button className="btn btn-light" onClick={save}>Save Progress</button><button className="btn btn-primary" disabled={busy} onClick={() => submit(false)}>{busy ? "Submitting…" : "Submit Test"}</button></div></WorkspacePage>;
}

function OfflineSubmit({ assessment, onClose, onSubmitted, onError }) {
  const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); if (!files.length) return onError("Select at least one scanned answer-sheet file."); setBusy(true); try { const fd = new FormData(); files.forEach((f) => fd.append("submission_files", f)); fd.append("client_meta", JSON.stringify({ source: "web_upload" })); await api.post(`/api/assessments/${assessment.id}/submit`, fd); onSubmitted(); } catch (error) { onError(error.response?.data?.message || "Could not upload answer sheets."); } finally { setBusy(false); } };
  return <WorkspacePage title="Upload Answer Sheets" onClose={onClose}><form onSubmit={submit}><div className="p-4"><h5>{assessment.title}</h5><p className="text-muted">Scan clearly, keep pages in order and upload PDF/JPG/PNG files.</p><input className="form-control" required type="file" accept="application/pdf,image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />{files.length > 0 && <div className="mt-3 small">{files.map((f, i) => <div key={`${f.name}-${i}`}><i className="bi bi-file-earmark me-1" />{f.name}</div>)}</div>}</div><div className="modal-action-bar"><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Submit Answer Sheets"}</button></div></form></WorkspacePage>;
}

function TeacherScanButton({ assessment, row, onDone, onError }) {
  const [busy, setBusy] = useState(false);
  const upload = async (event) => {
    const files = Array.from(event.target.files || []); event.target.value = ""; if (!files.length) return;
    setBusy(true);
    try {
      const fd = new FormData(); files.forEach((f) => fd.append("submission_files", f)); fd.append("run_ai", "true");
      const response = await api.post(`/api/assessments/${assessment.id}/submissions/${row.student_id}/teacher-scan`, fd);
      if (response.data?.ai_error) onError(`Scan saved. AI needs retry: ${response.data.ai_error}`);
      await onDone();
    } catch (error) { onError(error.response?.data?.message || "Could not upload scanned paper."); }
    finally { setBusy(false); }
  };
  return <label className={`btn btn-sm btn-outline-secondary mb-0 ${busy ? "disabled" : ""}`}>
    <i className="bi bi-file-earmark-arrow-up me-1" />{busy ? "Analysing…" : "Scan/PDF"}
    <input hidden type="file" accept="application/pdf,image/*" multiple onChange={upload} disabled={busy} />
  </label>;
}

function StudentAvatar({ student, size = 42 }) {
  const src = studentPhotoSrc(student);
  const initials = String(student?.name || "?").trim().slice(0, 1).toUpperCase() || "?";
  return <div className="assessment-student-avatar" style={{ width: size, height: size }}>
    {src ? <img src={src} alt={student?.name || "Student"} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling.style.display = "grid"; }} /> : null}
    <span style={{ display: src ? "none" : "grid" }}>{initials}</span>
  </div>;
}

function SubmissionsModal({ state, onClose, onChanged, onError }) {
  const [selected, setSelected] = useState(null);
  const readOnly = !state.assessment.can_manage;
  const total = Number(state.assessment.total_marks || 0);
  const percentages = state.rows.map((row) => row.percentage != null ? Number(row.percentage) : (row.obtained_marks != null && total > 0 ? Number(row.obtained_marks) / total * 100 : null)).filter((v) => Number.isFinite(v));
  const submitted = state.rows.filter((row) => ["submitted", "evaluated"].includes(row.status)).length;
  const evaluated = state.rows.filter((row) => row.obtained_marks != null || row.status === "evaluated").length;
  const aiReview = state.rows.filter((row) => row.latestAttempt?.teacher_review_required).length;
  const below50 = percentages.filter((v) => v < 50).length;
  const average = percentages.length ? percentages.reduce((a, b) => a + b, 0) / percentages.length : null;
  return <WorkspacePage title={`${readOnly ? "Student Results" : "Submissions"} — ${state.assessment.title}`} onClose={onClose}>
    <div className="assessment-submission-dashboard p-3 pb-0">
      <div className="assessment-result-metrics">
        <MiniMetric label="Students" value={state.rows.length} icon="bi-people" />
        <MiniMetric label="Submitted" value={submitted} icon="bi-send-check" />
        <MiniMetric label="Evaluated" value={evaluated} icon="bi-patch-check" />
        <MiniMetric label="Class Average" value={average == null ? "—" : `${average.toFixed(1)}%`} icon="bi-graph-up" />
        <MiniMetric label="Below 50%" value={below50} icon="bi-exclamation-circle" />
        <MiniMetric label="AI Review Pending" value={aiReview} icon="bi-stars" />
      </div>
      {readOnly && <div className="small text-muted mt-2"><i className="bi bi-eye me-1" />Read-only management view. Open any student to see the scanned paper, AI reasoning, marks, remarks and remedials.</div>}
    </div>
    <div className="table-responsive p-3"><table className="table align-middle"><thead><tr><th>Student</th><th>Status</th><th>AI</th><th>Submitted</th><th>Marks</th><th>Score</th><th /></tr></thead><tbody>{state.rows.map((row) => {
      const pct = row.percentage != null ? Number(row.percentage) : (row.obtained_marks != null && total > 0 ? Number(row.obtained_marks) / total * 100 : null);
      return <tr key={row.id}><td><div className="d-flex align-items-center gap-2"><StudentAvatar student={row.student} /><div><strong>{row.student?.name}</strong><small className="d-block text-muted">{row.student?.admission_number || ""}</small></div></div></td><td><span className={`assessment-status status-${row.status}`}>{row.status}</span></td><td>{row.latestAttempt?.ai_evaluation_status && row.latestAttempt.ai_evaluation_status !== "not_started" ? <span className="badge text-bg-light">{row.latestAttempt.ai_evaluation_status.replaceAll("_", " ")}</span> : "—"}</td><td>{fmt(row.submitted_at)}</td><td>{row.obtained_marks == null ? "—" : `${row.obtained_marks}/${state.assessment.total_marks}`}</td><td>{pct == null ? "—" : <strong>{pct.toFixed(1)}%</strong>}</td><td className="text-end"><div className="d-flex justify-content-end gap-2">{!readOnly && <TeacherScanButton assessment={state.assessment} row={row} onDone={onChanged} onError={onError} />}<button className="btn btn-sm btn-outline-primary" disabled={!row.latestAttempt} onClick={() => setSelected(row)}>{readOnly ? "View Result" : "Review"}</button></div></td></tr>;
    })}</tbody></table></div>
    {selected && <GradePanel assessment={state.assessment} enrollment={selected} readOnly={readOnly} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await onChanged(); }} onError={onError} />}
  </WorkspacePage>;
}

function MiniMetric({ label, value, icon }) { return <div className="assessment-mini-metric"><i className={`bi ${icon}`} /><div><span>{label}</span><strong>{value}</strong></div></div>; }

function GradePanel({ assessment, enrollment, readOnly = false, onClose, onSaved, onError }) {
  const attempt = enrollment.latestAttempt;
  const [answerGrades, setAnswerGrades] = useState(() => (attempt?.answers || []).map((a) => ({ answer_id: a.id, awarded_marks: a.awarded_marks ?? a.ai_awarded_marks ?? 0, teacher_remark: a.teacher_remark || a.ai_remark || "" })));
  const suggestedTotal = answerGrades.reduce((sum, a) => sum + Number(a.awarded_marks || 0), 0);
  const [marks, setMarks] = useState(enrollment.obtained_marks ?? attempt?.obtained_marks ?? suggestedTotal);
  const [feedback, setFeedback] = useState(enrollment.teacher_feedback || attempt?.teacher_feedback || attempt?.ai_summary?.summary || "");
  const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false); const [aiBusy, setAiBusy] = useState(false);
  const updateAnswer = (id, patch) => setAnswerGrades((rows) => rows.map((r) => r.answer_id === id ? { ...r, ...patch } : r));
  useEffect(() => { if (!readOnly && (attempt?.answers || []).length) setMarks(answerGrades.reduce((sum, a) => sum + Number(a.awarded_marks || 0), 0)); }, [answerGrades, attempt?.answers, readOnly]);
  const rerunAi = async () => { setAiBusy(true); try { await api.post(`/api/assessments/${assessment.id}/submissions/${enrollment.student_id}/ai-evaluate`, {}); await onSaved(); } catch (error) { onError(error.response?.data?.message || "Could not re-run AI evaluation."); } finally { setAiBusy(false); } };
  const submit = async () => { setBusy(true); try { const fd = new FormData(); fd.append("obtained_marks", marks); fd.append("teacher_feedback", feedback); fd.append("answer_grades", JSON.stringify(answerGrades)); files.forEach((f) => fd.append("corrected_files", f)); await api.patch(`/api/assessments/${assessment.id}/submissions/${enrollment.student_id}/grade`, fd); onSaved(); } catch (error) { onError(error.response?.data?.message || "Could not save marks."); } finally { setBusy(false); } };
  const pct = Number(assessment.total_marks) > 0 ? Math.max(0, Math.min(100, Number(marks || 0) / Number(assessment.total_marks) * 100)) : 0;
  return <div className="grade-panel"><div className="d-flex justify-content-between align-items-center"><div className="d-flex align-items-center gap-3"><StudentAvatar student={enrollment.student} size={56} /><div><h5 className="mb-0">{readOnly ? "Student Result" : "Review"} — {enrollment.student?.name}</h5><small className="text-muted">{enrollment.student?.admission_number}{enrollment.student?.father_name ? ` · Father: ${enrollment.student.father_name}` : ""}</small></div></div><button className="btn-close" onClick={onClose} /></div>
    <div className="smart-result-hero mt-3"><div className="smart-score-ring" style={{"--score": `${pct * 3.6}deg`}}><div><strong>{Math.round(pct)}%</strong><small>{marks}/{assessment.total_marks}</small></div></div><div className="flex-grow-1"><h6 className="mb-1">AI-assisted {readOnly ? "result insight" : "review"}</h6><div className="small text-muted">Status: {(attempt?.ai_evaluation_status || "not_started").replaceAll("_", " ")}{attempt?.ai_confidence != null ? ` · ${Number(attempt.ai_confidence).toFixed(0)}% confidence` : ""}</div>{attempt?.teacher_review_required && <div className="text-warning small mt-1"><i className="bi bi-exclamation-triangle me-1" />Teacher approval required</div>}<p className="mb-0 mt-2">{attempt?.ai_summary?.summary || "Review the scanned paper and confirmed marks."}</p></div></div>
    {(attempt?.files || []).map((file) => <button key={file.id} className="btn btn-sm btn-outline-secondary mt-3 me-2" onClick={() => openBlob(`/api/assessments/${assessment.id}/files/${file.id}`, file.original_name)}><i className="bi bi-eye me-1" />{file.original_name}</button>)}
    {(attempt?.answers || []).map((answer, index) => { const grade = answerGrades.find((g) => g.answer_id === answer.id) || {}; return <div className={`answer-grade mt-3 ${answer.ai_review_required ? "ai-review-needed" : ""}`} key={answer.id}><div className="d-flex justify-content-between gap-2"><strong>Q{index + 1}. {answer.question?.question_text}</strong>{answer.ai_review_required && <span className="badge text-bg-warning">Manual review</span>}</div>{answer.ai_detected_text && <p className="mb-1 mt-2"><span className="text-muted">AI read:</span> {answer.ai_detected_text}</p>}{answer.ai_remark && <p className="mb-2 small text-muted"><strong>Why:</strong> {answer.ai_remark}{answer.ai_confidence != null ? ` · confidence ${Number(answer.ai_confidence).toFixed(0)}%` : ""}</p>}{readOnly ? <div className="assessment-readonly-answer"><span><strong>Marks:</strong> {grade.awarded_marks ?? 0}/{answer.question?.marks ?? "—"}</span><span><strong>Teacher remark:</strong> {grade.teacher_remark || "—"}</span></div> : <div className="row g-2"><Input label={`Marks / ${answer.question?.marks}`} type="number" min="0" max={answer.question?.marks} step="0.5" value={grade.awarded_marks} onChange={(v) => updateAnswer(answer.id, { awarded_marks: v })} /><Input label="Teacher remark / why marks cut" value={grade.teacher_remark} onChange={(v) => updateAnswer(answer.id, { teacher_remark: v })} /></div>}</div>; })}
    {Array.isArray(attempt?.remedials) && attempt.remedials.length > 0 && <div className="smart-remedials mt-3"><h6><i className="bi bi-stars me-1" />Small remedials</h6>{attempt.remedials.map((r, i) => <div key={i}><strong>{r.topic || "Practice"}:</strong> {r.action}</div>)}</div>}
    {readOnly ? <div className="assessment-readonly-final mt-3"><div><span>Final Marks</span><strong>{marks}/{assessment.total_marks}</strong></div><div><span>Overall Feedback</span><strong>{feedback || "—"}</strong></div></div> : <div className="row g-3 mt-2"><Input label={`Final Marks / ${assessment.total_marks}`} type="number" min="0" max={assessment.total_marks} step="0.5" value={marks} onChange={setMarks} /><div className="col-12"><label className="form-label">Overall feedback</label><textarea className="form-control" rows="3" value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div><div className="col-12"><label className="form-label">Corrected sheet / feedback file</label><input className="form-control" type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></div></div>}
    <div className={`d-flex mt-3 ${readOnly ? "justify-content-end" : "justify-content-between"}`}>{readOnly ? <button className="btn btn-primary" onClick={onClose}>Close</button> : <><button className="btn btn-outline-primary" disabled={aiBusy || attempt?.submission_source === "online"} onClick={rerunAi}><i className="bi bi-stars me-1" />{aiBusy ? "Analysing…" : "Re-run AI"}</button><div><button className="btn btn-light me-2" onClick={onClose}>Cancel</button><button className="btn btn-success" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Approve & Save"}</button></div></>}</div>
  </div>;
}

function WorkspacePage({ title, children, onClose }) {
  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  return <section className="assessment-workspace"><header className="assessment-workspace-header"><button type="button" className="btn btn-outline-secondary" disabled={!onClose} onClick={onClose}><i className="bi bi-arrow-left me-2" />Back to list</button><h1>{title}</h1></header>{children}</section>;
}
function Input({ label, onChange, ...props }) { return <div className="col-md-6"><label className="form-label">{label}</label><input className="form-control" onChange={(e) => onChange(e.target.value)} {...props} /></div>; }
function SelectField({ label, options, onChange, empty = "Select", ...props }) { return <div className="col-md-6"><label className="form-label">{label}</label><select className="form-select" onChange={(e) => onChange(e.target.value)} {...props}><option value="">{empty}</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>; }
function Check({ label, checked, onChange }) { return <label className="form-check"><input className="form-check-input" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="form-check-label">{label}</span></label>; }
