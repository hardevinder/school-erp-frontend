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
const validId = (value) => Number.isFinite(Number(value)) && Number(value) > 0;
const uniqueOptions = (rows, id, label) => [...new Map(rows.filter((r) => validId(r[id])).map((r) => [Number(r[id]), { id: Number(r[id]), label: r[label] || `#${r[id]}` }])).values()];

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
  const pageTitle = assignmentOnly ? "Assignments" : "Assessments & Tests";
  const pageSubtitle = assignmentOnly
    ? "Create, publish, collect scanned work, evaluate and publish assignment results."
    : isManagementViewer
      ? "School-wide assessment intelligence, student results, scanned papers and AI review visibility."
      : "Online quizzes, scanned answer sheets, AI papers and published results.";
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
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div><h2 className="mb-1">{pageTitle}</h2><div className="text-muted">{pageSubtitle}</div></div>
      <div className="d-flex gap-2">
        {(query.get("online_class_id") || assessmentTypeFilter) && <button className="btn btn-outline-secondary" onClick={() => navigate("/assessments")}>Show all</button>}
        {!assignmentOnly && <button className="btn btn-outline-primary" onClick={() => navigate("/assessments?assessment_type=assignment")}><i className="bi bi-journal-check me-2" />Assignments</button>}
        {canCreate && <button className="btn btn-primary" onClick={() => setBuilder({ mode: "create", data: newAssessmentData() })}><i className="bi bi-plus-lg me-2" />{assignmentOnly ? "Create Assignment" : "Create Assessment"}</button>}
      </div>
    </div>
    {notice && <div className={`alert alert-${notice.type} alert-dismissible`}>{notice.text}<button className="btn-close" onClick={() => setNotice(null)} /></div>}
    {builder && <AssessmentBuilder options={options} state={builder} onClose={() => setBuilder(null)} onSaved={async (message) => { setBuilder(null); flash("success", message); await load(); }} onError={(m) => flash("danger", m)} />}
    {isManagementViewer && <div className="assessment-management-banner mb-4"><div><i className="bi bi-bar-chart-line-fill" /><div><strong>Management Assessment View</strong><span>View school-wide tests, student pictures, scores, AI findings and scanned answer sheets. Teacher marks remain read-only unless your role has assessment management permission.</span></div></div></div>}
    <div className="assessment-summary-grid mb-4">
      <Summary icon="bi-files" label="Total" value={rows.length} />
      <Summary icon="bi-broadcast" label="Published" value={rows.filter((r) => r.status === "published").length} />
      <Summary icon="bi-laptop" label="Online" value={rows.filter((r) => r.mode === "online").length} />
      <Summary icon="bi-file-earmark-arrow-up" label="Offline" value={rows.filter((r) => r.mode === "offline").length} />
      {!assignmentOnly && <Summary icon="bi-journal-check" label="Assignments" value={rows.filter((r) => r.assessment_type === "assignment").length} />}
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
          {isStudent && row.status === "published" && row.mode === "online" && !["submitted", "evaluated"].includes(row.enrollment?.status) && <button className="btn btn-sm btn-primary" onClick={() => startAttempt(row)}>{row.assessment_type === "assignment" ? "Open Assignment" : "Attempt Test"}</button>}
          {isStudent && row.status === "published" && row.mode === "offline" && !["submitted", "evaluated"].includes(row.enrollment?.status) && <button className="btn btn-sm btn-primary" onClick={() => setOffline(row)}><i className="bi bi-camera me-1" />{row.assessment_type === "assignment" ? "Upload Work" : "Upload Answer Sheets"}</button>}
          {(row.files || []).filter((f) => ["question_paper", "supporting_material"].includes(f.kind)).map((file) => <button key={file.id} className="btn btn-sm btn-outline-secondary" onClick={() => openBlob(`/api/assessments/${row.id}/files/${file.id}`, file.original_name)}><i className="bi bi-download me-1" />{file.original_name}</button>)}
        </div></div>
      </article></div>)}</div>}

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

function AssessmentBuilder({ options = [], state, onClose, onSaved, onError }) {
  const initial = state?.data || emptyForm;
  const [form, setForm] = useState({
    ...initial,
    breakdown_id: initial.breakdown_id || "",
    breakdown_item_id: initial.breakdown_item_id || "",
    syllabus_topics: Array.isArray(initial?.settings?.syllabus_topics) ? initial.settings.syllabus_topics : [],
  });
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [syllabusRows, setSyllabusRows] = useState([]);
  const [syllabusBusy, setSyllabusBusy] = useState(false);
  const [syllabusError, setSyllabusError] = useState("");
  const questionImportRef = useRef(null);

  const classRows = options.filter((o) => !form.class_id || Number(o.class_id) === Number(form.class_id));
  const sectionRows = classRows.filter((o) => !form.section_id || Number(o.section_id) === Number(form.section_id));
  const classes = uniqueOptions(options, "class_id", "class_name");
  const sections = uniqueOptions(classRows, "section_id", "section_name");
  const subjects = uniqueOptions(sectionRows, "subject_id", "subject_name");
  const selectedUnit = syllabusRows.find((row) => Number(row.id) === Number(form.breakdown_item_id)) || null;
  const unitTopics = selectedUnit ? [...new Set([...(selectedUnit.topics || []), ...(selectedUnit.subtopics || [])].map((v) => String(v || "").trim()).filter(Boolean))] : [];

  useEffect(() => {
    let cancelled = false;
    const classId = Number(form.class_id);
    const subjectId = Number(form.subject_id);
    const rawSectionId = form.section_id;
    const sectionId = rawSectionId === undefined || rawSectionId === null || rawSectionId === "" ? null : Number(rawSectionId);
    if (!Number.isFinite(classId) || classId <= 0 || !Number.isFinite(subjectId) || subjectId <= 0) {
      setSyllabusRows([]);
      setSyllabusError("");
      return undefined;
    }
    if (sectionId !== null && (!Number.isFinite(sectionId) || sectionId <= 0)) {
      setSyllabusRows([]);
      setSyllabusError("Please select a valid section.");
      return undefined;
    }
    setSyllabusBusy(true); setSyllabusError("");
    api.get("/api/assessments/syllabus-options", { params: { class_id: classId, section_id: sectionId || undefined, subject_id: subjectId } })
      .then((response) => { if (!cancelled) setSyllabusRows(asList(unwrap(response))); })
      .catch((error) => { if (!cancelled) { setSyllabusRows([]); setSyllabusError(error.response?.data?.message || "Could not load syllabus units."); } })
      .finally(() => { if (!cancelled) setSyllabusBusy(false); });
    return () => { cancelled = true; };
  }, [form.class_id, form.section_id, form.subject_id]);

  const chooseClass = (id) => setForm((f) => ({ ...f, class_id: id, section_id: "", subject_id: "", breakdown_id: "", breakdown_item_id: "", syllabus_topics: [] }));
  const chooseSection = (id) => setForm((f) => ({ ...f, section_id: id, subject_id: "", breakdown_id: "", breakdown_item_id: "", syllabus_topics: [] }));
  const chooseSubject = (id) => setForm((f) => ({ ...f, subject_id: id, breakdown_id: "", breakdown_item_id: "", syllabus_topics: [] }));
  const chooseUnit = (row) => setForm((f) => ({ ...f, breakdown_id: row.breakdown_id || "", breakdown_item_id: row.id, syllabus_topics: [] }));
  const toggleTopic = (topic) => setForm((f) => ({ ...f, syllabus_topics: f.syllabus_topics.includes(topic) ? f.syllabus_topics.filter((t) => t !== topic) : [...f.syllabus_topics, topic] }));
  const updateQuestion = (index, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => i === index ? { ...q, ...patch } : q) }));
  const addQuestion = () => setForm((f) => ({ ...f, questions: [...f.questions, emptyQuestion(f.questions.length)] }));
  const removeQuestion = (index) => setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, sort_order: i })) }));

  const nextFromBasics = () => {
    if (!validId(form.class_id) || !validId(form.subject_id) || !String(form.title || "").trim()) return onError("Select class, subject and enter a title first.");
    if (form.section_id && !validId(form.section_id)) return onError("Select a valid section.");
    setStep(2);
  };

  const generateAi = async () => {
    if (!form.class_id || !form.subject_id || !form.title) return onError("Select class, subject and enter a title before AI generation.");
    setAiBusy(true);
    try {
      const topicText = form.syllabus_topics.length ? form.syllabus_topics.join(", ") : (selectedUnit?.unit_title || form.description || "");
      const result = unwrap(await api.post("/api/assessments/ai/generate", {
        class_id: form.class_id, section_id: form.section_id || null, subject_id: form.subject_id,
        breakdown_id: form.breakdown_id || null, breakdown_item_id: form.breakdown_item_id || null,
        syllabus_topics: form.syllabus_topics, title: form.title, topic: topicText,
        total_marks: Number(form.total_marks), duration_minutes: Number(form.duration_minutes),
        question_count: Math.max(1, form.questions.length || 10), question_types: ["mcq", "true_false", "fill_blank", "short", "long"], language: "English",
      }));
      setForm((f) => ({ ...f, title: result.title || f.title, description: result.description || f.description, instructions: result.instructions || f.instructions, questions: result.questions || f.questions, ai_meta: result.ai_meta }));
    } catch (error) { onError(error.response?.data?.message || "AI could not generate the assessment."); }
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
      fd.append("assessment_document", file); fd.append("class_id", form.class_id);
      if (form.section_id) fd.append("section_id", form.section_id);
      fd.append("subject_id", form.subject_id); if (form.title) fd.append("title", form.title);
      if (form.breakdown_item_id) fd.append("breakdown_item_id", form.breakdown_item_id);
      if (form.syllabus_topics.length) fd.append("syllabus_topics", JSON.stringify(form.syllabus_topics));
      if (form.description) fd.append("topic", form.description);
      const result = unwrap(await api.post("/api/assessments/ai/import-document", fd));
      const imported = Array.isArray(result.questions) ? result.questions : [];
      if (!imported.length) throw new Error("No readable questions were detected.");
      setForm((current) => {
        const existing = (current.questions || []).filter((q) => String(q.question_text || "").trim());
        return { ...current, title: current.title || result.document?.title || "", instructions: current.instructions || result.document?.instructions || "", total_marks: Number(result.total_marks) > 0 ? result.total_marks : current.total_marks, questions: [...existing, ...imported].map((q, i) => ({ ...q, sort_order: i })), ai_meta: { ...(current.ai_meta || {}), document_import: true, teacher_review_required: true } };
      });
      setImportNotice(`${imported.length} question(s) extracted${result.review_count ? ` · ${result.review_count} need review` : ""}. Review before saving.`);
    } catch (error) { onError(error.response?.data?.message || error.message || "AI could not read this question document."); }
    finally { setImportBusy(false); if (questionImportRef.current) questionImportRef.current.value = ""; }
  };

  const submit = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const fd = new FormData();
      const data = {
        ...form,
        syllabus_topics: form.syllabus_topics,
        settings: { ...(form.settings || {}), syllabus_topics: form.syllabus_topics },
        questions: form.mode === "online" ? form.questions : form.questions.filter((q) => q.question_text?.trim()),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : "",
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : "",
        publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : "",
      };
      delete data.question_paper; delete data.supporting_files;
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) continue;
        if (["questions", "ai_meta", "settings", "syllabus_topics"].includes(key)) fd.append(key, JSON.stringify(value || (key === "questions" || key === "syllabus_topics" ? [] : {})));
        else fd.append(key, typeof value === "boolean" ? String(value) : value);
      }
      if (form.question_paper) fd.append("question_paper", form.question_paper);
      for (const file of form.supporting_files || []) fd.append("supporting_files", file);
      if (state.mode === "edit") await api.patch(`/api/assessments/${state.id}`, fd); else await api.post("/api/assessments", fd);
      onSaved(state.mode === "edit" ? "Assessment updated." : "Assessment created.");
    } catch (error) { onError(error.response?.data?.errors?.join(". ") || error.response?.data?.message || "Could not save assessment."); }
    finally { setBusy(false); }
  };

  const stepNames = ["Basic Details", "Unit & Topics", "Settings", "Questions & Review"];
  const typeOptions = [
    { id: "assessment", label: "Assessment", icon: "bi-clipboard-check" },
    { id: "worksheet", label: "Worksheet", icon: "bi-file-earmark-text" },
    { id: "quiz", label: "Quiz", icon: "bi-ui-checks" },
    { id: "test", label: "Test", icon: "bi-journal-text" },
    { id: "practice", label: "Practice", icon: "bi-lightning-charge" },
  ];
  const buttonSet = (rows, selected, onPick, emptyText) => <div className="d-flex flex-wrap gap-2">{rows.length ? rows.map((row) => <button key={row.id} type="button" className={`btn btn-sm ${String(selected) === String(row.id) ? "btn-primary" : "btn-outline-primary"}`} onClick={() => onPick(row.id)}>{row.label}</button>) : <span className="text-muted small">{emptyText}</span>}</div>;

  return <form onSubmit={submit} className="card border-0 shadow-sm mb-4 assessment-inline-builder">
    <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
      <div><h5 className="mb-1">{state.mode === "edit" ? "Edit" : "Create"} Assessment</h5><small className="text-muted">Choose academic context first, then syllabus coverage and paper settings.</small></div>
      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}><i className="bi bi-x-lg me-1" />Close</button>
    </div>
    <div className="card-body">
      <div className="d-flex flex-wrap gap-2 mb-4">{stepNames.map((name, index) => <button key={name} type="button" className={`btn btn-sm ${step === index + 1 ? "btn-primary" : step > index + 1 ? "btn-outline-primary" : "btn-outline-secondary"}`} onClick={() => { if (index + 1 < step) setStep(index + 1); }}>{index + 1}. {name}</button>)}</div>

      {step === 1 && <div>
        <h6 className="mb-3">Class, Section & Subject</h6>
        <div className="mb-3"><label className="form-label fw-semibold">Class <span className="text-danger">*</span></label>{buttonSet(classes, form.class_id, chooseClass, "No assigned classes found.")}</div>
        <div className="mb-3"><label className="form-label fw-semibold">Section</label>{buttonSet(sections, form.section_id, chooseSection, form.class_id ? "No sections found for this class." : "Select a class first.")}</div>
        <div className="mb-3"><label className="form-label fw-semibold">Subject <span className="text-danger">*</span></label>{buttonSet(subjects, form.subject_id, chooseSubject, form.class_id ? "Select section if required, then choose subject." : "Select a class first.")}</div>
        <div className="row g-3">
          <Input label="Title" required value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Input label="Linked Online Class ID" value={form.online_class_id} onChange={(v) => setForm({ ...form, online_class_id: v })} placeholder="Optional" />
        </div>
        <div className="mt-3"><label className="form-label fw-semibold">Type</label><div className="d-flex flex-wrap gap-2">{typeOptions.map((item) => <button key={item.id} type="button" className={`btn ${form.assessment_type === item.id ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setForm({ ...form, assessment_type: item.id })}><i className={`bi ${item.icon} me-2`} />{item.label}</button>)}</div></div>
        <div className="d-flex justify-content-end mt-4"><button type="button" className="btn btn-primary" onClick={nextFromBasics}>Next: Unit & Topics <i className="bi bi-arrow-right ms-1" /></button></div>
      </div>}

      {step === 2 && <div>
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><h6 className="mb-1">Unit & Topics</h6><small className="text-muted">Loaded from the selected subject's Syllabus Breakup.</small></div>{form.breakdown_item_id && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm((f) => ({ ...f, breakdown_id: "", breakdown_item_id: "", syllabus_topics: [] }))}>Clear selection</button>}</div>
        {syllabusBusy ? <div className="text-muted py-3"><span className="spinner-border spinner-border-sm me-2" />Loading syllabus…</div> : syllabusError ? <div className="alert alert-warning">{syllabusError}</div> : !syllabusRows.length ? <div className="alert alert-light border"><strong>No syllabus breakup found.</strong><div className="small text-muted mt-1">You can continue and create the assessment without a syllabus link.</div></div> : <>
          <label className="form-label fw-semibold">Select Unit</label>
          <div className="d-flex flex-wrap gap-2 mb-4">{syllabusRows.map((row) => <button key={`${row.breakdown_id}-${row.id}`} type="button" className={`btn ${Number(form.breakdown_item_id) === Number(row.id) ? "btn-primary" : "btn-outline-primary"}`} onClick={() => chooseUnit(row)}>{row.unit_number ? `Unit ${row.unit_number}: ` : ""}{row.unit_title}</button>)}</div>
          {selectedUnit && <div className="border rounded p-3">
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-3"><div><strong>{selectedUnit.unit_number ? `Unit ${selectedUnit.unit_number}: ` : ""}{selectedUnit.unit_title}</strong>{(selectedUnit.term || selectedUnit.academic_session) && <div className="text-muted small">{[selectedUnit.term, selectedUnit.academic_session].filter(Boolean).join(" · ")}</div>}</div>{unitTopics.length > 0 && <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setForm((f) => ({ ...f, syllabus_topics: f.syllabus_topics.length === unitTopics.length ? [] : unitTopics }))}>{form.syllabus_topics.length === unitTopics.length ? "Clear topics" : "Select all topics"}</button>}</div>
            {unitTopics.length ? <div className="d-flex flex-wrap gap-2">{unitTopics.map((topic) => <button key={topic} type="button" className={`btn btn-sm ${form.syllabus_topics.includes(topic) ? "btn-primary" : "btn-outline-primary"}`} onClick={() => toggleTopic(topic)}><i className={`bi ${form.syllabus_topics.includes(topic) ? "bi-check-circle-fill" : "bi-circle"} me-1`} />{topic}</button>)}</div> : <div className="text-muted small">No individual topics are stored for this unit. The whole unit will be used.</div>}
          </div>}
        </>}
        <div className="d-flex justify-content-between mt-4"><button type="button" className="btn btn-outline-secondary" onClick={() => setStep(1)}><i className="bi bi-arrow-left me-1" />Back</button><button type="button" className="btn btn-primary" onClick={() => setStep(3)}>Next: Settings <i className="bi bi-arrow-right ms-1" /></button></div>
      </div>}

      {step === 3 && <div>
        <div className="row g-3">
          <SelectField label="Mode" value={form.mode} options={[{ id: "online", label: "Online attempt" }, { id: "offline", label: "Written / scanned upload" }]} onChange={(v) => setForm({ ...form, mode: v })} />
          <Input label="Total Marks" type="number" min="0" step="0.5" value={form.total_marks} onChange={(v) => setForm({ ...form, total_marks: v })} />
          <Input label="Duration (minutes)" type="number" min="1" value={form.duration_minutes} onChange={(v) => setForm({ ...form, duration_minutes: v })} />
          <Input label="Maximum Attempts" type="number" min="1" max="10" value={form.max_attempts} onChange={(v) => setForm({ ...form, max_attempts: v })} />
          <Input label="Available From" type="datetime-local" value={form.starts_at} onChange={(v) => setForm({ ...form, starts_at: v })} />
          <Input label="Deadline" type="datetime-local" value={form.ends_at} onChange={(v) => setForm({ ...form, ends_at: v })} />
          <SelectField label="Publish" value={form.publish_trigger} options={[{ id: "manual", label: "Save as draft" }, { id: "immediate", label: "Publish immediately" }, { id: "scheduled", label: "At scheduled time" }, { id: "after_class", label: "When linked Zoom class ends" }]} onChange={(v) => setForm({ ...form, publish_trigger: v })} />
          {form.publish_trigger === "scheduled" && <Input label="Publish At" required type="datetime-local" value={form.publish_at} onChange={(v) => setForm({ ...form, publish_at: v })} />}
          <SelectField label="Result Release" value={form.result_release} options={[{ id: "manual", label: "Teacher publishes results" }, { id: "immediate", label: "Immediately for auto-checked tests" }]} onChange={(v) => setForm({ ...form, result_release: v })} />
          <div className="col-12"><label className="form-label">Description / additional coverage</label><textarea className="form-control" rows="2" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="col-12"><label className="form-label">Instructions</label><textarea className="form-control" rows="2" value={form.instructions || ""} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          <div className="col-12 d-flex flex-wrap gap-4"><Check label="Randomize questions" checked={form.randomize_questions} onChange={(v) => setForm({ ...form, randomize_questions: v })} /><Check label="Randomize options" checked={form.randomize_options} onChange={(v) => setForm({ ...form, randomize_options: v })} /></div>
        </div>
        {form.mode === "offline" && <div className="assessment-upload-box mt-4"><h6><i className="bi bi-file-earmark-pdf me-2" />Offline Question Paper</h6><p className="text-muted small">Upload PDF/Word/image, or keep questions below to generate a branded PDF.</p><input className="form-control" type="file" accept=".pdf,.doc,.docx,image/*" onChange={(e) => setForm({ ...form, question_paper: e.target.files?.[0] || null })} /></div>}
        <div className="d-flex justify-content-between mt-4"><button type="button" className="btn btn-outline-secondary" onClick={() => setStep(2)}><i className="bi bi-arrow-left me-1" />Back</button><button type="button" className="btn btn-primary" onClick={() => setStep(4)}>Next: Questions <i className="bi bi-arrow-right ms-1" /></button></div>
      </div>}

      {step === 4 && <div>
        <div className="alert alert-light border d-flex flex-wrap gap-3 align-items-center"><strong>{form.title || "Untitled assessment"}</strong><span>{classes.find((x) => String(x.id) === String(form.class_id))?.label || "Class"}</span><span>{subjects.find((x) => String(x.id) === String(form.subject_id))?.label || "Subject"}</span>{selectedUnit && <span>{selectedUnit.unit_number ? `Unit ${selectedUnit.unit_number}: ` : ""}{selectedUnit.unit_title}</span>}{form.syllabus_topics.length > 0 && <span>{form.syllabus_topics.length} topic(s)</span>}</div>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2"><div><h5 className="mb-0">Questions</h5><small className="text-muted">AI uses the selected Unit & Topics as context. Teacher review is required.</small></div><div className="d-flex flex-wrap gap-2"><button type="button" className="btn btn-outline-primary" disabled={aiBusy || importBusy} onClick={generateAi}><i className="bi bi-stars me-1" />{aiBusy ? "Generating…" : "AI Generate"}</button><button type="button" className="btn btn-primary" disabled={importBusy || aiBusy} onClick={() => questionImportRef.current?.click()}><i className="bi bi-file-earmark-scan me-1" />{importBusy ? "Reading…" : "AI Import Questions"}</button><input ref={questionImportRef} hidden type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => importQuestionDocument(e.target.files?.[0])} /><button type="button" className="btn btn-outline-secondary" onClick={addQuestion}>Add Question</button></div></div>
        {importNotice && <div className="alert alert-info py-2">{importNotice}</div>}
        {(form.questions || []).map((q, i) => <QuestionEditor key={i} index={i} value={q} onChange={(patch) => updateQuestion(i, patch)} onRemove={() => removeQuestion(i)} />)}
        <div className="assessment-upload-box mt-3"><label className="form-label fw-semibold">Supporting materials</label><input className="form-control" type="file" multiple onChange={(e) => setForm({ ...form, supporting_files: Array.from(e.target.files || []) })} /></div>
        <div className="d-flex flex-wrap justify-content-between gap-2 mt-4"><button type="button" className="btn btn-outline-secondary" onClick={() => setStep(3)}><i className="bi bi-arrow-left me-1" />Back</button><div className="d-flex gap-2"><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : state.mode === "edit" ? "Update Assessment" : "Create Assessment"}</button></div></div>
      </div>}
    </div>
  </form>;
}

function QuestionEditor({ index, value, onChange, onRemove }) {
  const [editing, setEditing] = useState(() => !String(value.question_text || "").trim());
  const objective = ["mcq", "true_false"].includes(value.question_type);
  const options = value.question_type === "true_false" ? ["True", "False"] : (value.options || ["", "", "", ""]);
  const typeLabel = ({ mcq: "MCQ", true_false: "True / False", fill_blank: "Fill in the blank", short: "Short answer", long: "Long answer" })[value.question_type] || "Question";
  const answerText = Array.isArray(value.correct_answer) ? value.correct_answer.join(", ") : String(value.correct_answer ?? "");

  if (!editing) {
    return <article className="question-textbook mt-3">
      <div className="question-textbook-head">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="question-number">Q{index + 1}.</span>
          <span className="question-meta-pill">{typeLabel}</span>
          <span className="question-meta-pill">{value.marks || 0} mark{Number(value.marks) === 1 ? "" : "s"}</span>
          {value.difficulty && <span className="question-meta-pill text-capitalize">{value.difficulty}</span>}
          {value.topic && <span className="question-meta-pill"><i className="bi bi-bookmark me-1" />{value.topic}</span>}
          {value.source_number ? <span className="question-source">Source {value.source_number}</span> : null}
        </div>
        <div className="d-flex gap-1">
          <button type="button" className="btn btn-sm btn-link question-edit-btn" onClick={() => setEditing(true)} title="Edit question"><i className="bi bi-pencil-square" /> <span className="d-none d-sm-inline">Edit</span></button>
          <button type="button" className="btn btn-sm btn-link text-danger" onClick={onRemove} title="Remove question"><i className="bi bi-trash3" /></button>
        </div>
      </div>

      {value.needs_review && <div className="alert alert-warning py-2 small mb-3">{Array.isArray(value.warnings) && value.warnings.length ? value.warnings.join(" · ") : "Please verify this scanned question."}</div>}

      <div className="question-textbook-body">
        <div className="question-printed-text">{value.question_text || <span className="text-muted">Question text not added.</span>}</div>

        {objective && <div className="question-printed-options">
          {options.map((option, oi) => {
            const correct = value.correct_answer != null && Number(value.correct_answer) === oi;
            return <div className={`question-printed-option ${correct ? "is-correct" : ""}`} key={oi}>
              <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
              <span className="option-text">{option || <span className="text-muted">Option {oi + 1}</span>}</span>
              {correct && <span className="correct-answer-mark"><i className="bi bi-check-circle-fill me-1" />Answer</span>}
            </div>;
          })}
        </div>}

        {value.question_type === "fill_blank" && <div className="question-answer-key"><span className="answer-key-label">Accepted answer{Array.isArray(value.correct_answer) && value.correct_answer.length > 1 ? "s" : ""}</span><div>{answerText || <span className="text-muted">Not added</span>}</div></div>}

        {["short", "long"].includes(value.question_type) && <div className="question-answer-key"><span className="answer-key-label">Answer Key / Marking Guidance</span><div className="answer-key-text">{value.explanation || <span className="text-muted">No answer key added.</span>}</div></div>}
      </div>
    </article>;
  }

  return <article className="question-textbook question-textbook-edit mt-3">
    <div className="question-textbook-head">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <span className="question-number">Q{index + 1}.</span>
        <span className="question-editing-label"><i className="bi bi-pencil me-1" />Editing</span>
        {value.source_number ? <span className="question-source">Source {value.source_number}</span> : null}
      </div>
      <div className="d-flex gap-1 align-items-center">
        <button type="button" className="btn btn-sm btn-primary px-3" onClick={() => setEditing(false)} disabled={!String(value.question_text || "").trim()}><i className="bi bi-check2 me-1" />Done</button>
        <button type="button" className="btn btn-sm btn-link text-danger" onClick={onRemove}><i className="bi bi-trash3" /> <span className="d-none d-sm-inline">Remove</span></button>
      </div>
    </div>

    {value.needs_review && <div className="alert alert-warning py-2 small m-3 mb-0">{Array.isArray(value.warnings) && value.warnings.length ? value.warnings.join(" · ") : "Please verify this scanned question."}</div>}

    <div className="question-textbook-body question-edit-sheet">
      <div className="question-edit-meta">
        <label className="book-meta-field">
          <span>Type</span>
          <select className="book-inline-select" value={value.question_type} onChange={(e) => { const v = e.target.value; onChange({ question_type: v, options: v === "true_false" ? ["True", "False"] : v === "mcq" ? (value.options?.length ? value.options : ["", "", "", ""]) : [] }); }}>
            <option value="mcq">MCQ</option><option value="true_false">True / False</option><option value="fill_blank">Fill in the blank</option><option value="short">Short answer</option><option value="long">Long answer</option>
          </select>
        </label>
        <label className="book-meta-field book-meta-small"><span>Marks</span><input className="book-inline-input" type="number" min="0.5" step="0.5" value={value.marks} onChange={(e) => onChange({ marks: e.target.value })} /></label>
        <label className="book-meta-field"><span>Difficulty</span><select className="book-inline-select" value={value.difficulty || "medium"} onChange={(e) => onChange({ difficulty: e.target.value })}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
        <label className="book-meta-field book-meta-topic"><span>Topic</span><input className="book-inline-input" value={value.topic || ""} placeholder="Optional topic" onChange={(e) => onChange({ topic: e.target.value })} /></label>
      </div>

      <div className="book-question-edit-row">
        <span className="book-question-prefix">Q.</span>
        <textarea className="book-textarea book-question-textarea" rows="2" required value={value.question_text} placeholder="Type the question here…" onChange={(e) => onChange({ question_text: e.target.value })} />
      </div>

      {objective && <div className="book-options-edit">
        <div className="book-section-caption">Options <span>select the correct answer</span></div>
        {options.map((option, oi) => {
          const correct = value.correct_answer != null && Number(value.correct_answer) === oi;
          return <label className={`book-option-edit ${correct ? "is-correct" : ""}`} key={oi}>
            <input type="radio" name={`correct-${index}`} checked={correct} onChange={() => onChange({ correct_answer: oi })} />
            <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
            <input className="book-option-input" required value={option} disabled={value.question_type === "true_false"} placeholder={`Option ${String.fromCharCode(65 + oi)}`} onChange={(e) => { const next = [...options]; next[oi] = e.target.value; onChange({ options: next }); }} />
            {correct && <span className="correct-answer-mark"><i className="bi bi-check-circle-fill me-1" />Answer</span>}
          </label>;
        })}
      </div>}

      {value.question_type === "fill_blank" && <label className="book-answer-edit"><span className="answer-key-label">Accepted answer(s)</span><input className="book-answer-input" value={Array.isArray(value.correct_answer) ? value.correct_answer.join(", ") : value.correct_answer || ""} placeholder="Separate multiple answers with commas" onChange={(e) => onChange({ correct_answer: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} /></label>}

      {["short", "long"].includes(value.question_type) && <label className="book-answer-edit"><span className="answer-key-label">Answer Key / Marking Guidance</span><textarea className="book-textarea book-answer-textarea" rows={value.question_type === "long" ? 4 : 2} value={value.explanation || ""} placeholder="Type answer key or marking guidance…" onChange={(e) => onChange({ explanation: e.target.value })} /></label>}
    </div>
  </article>;
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
  return <Modal title={assessment.title} large onClose={onClose}><div className="attempt-header"><span>{assessment.total_marks} marks</span><span>{assessment.questions?.length || 0} questions</span>{remaining != null && <strong className={remaining < 60 ? "text-danger" : ""}><i className="bi bi-stopwatch me-1" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</strong>}</div><div className="attempt-body">
    {(assessment.questions || []).map((q, index) => <div className="attempt-question" key={q.id}><div className="d-flex justify-content-between"><strong>Q{index + 1}. {q.question_text}</strong><span>{q.marks} marks</span></div>
      {["mcq", "true_false"].includes(q.question_type) ? <div className="mt-2">{(q.options || []).map((option, oi) => <label className="answer-option" key={oi}><input type="radio" name={`q-${q.id}`} checked={Number(answers[q.id]?.answer_value) === oi} onChange={() => setAnswer(q, { answer_value: oi, answer_text: "" })} /><span>{option}</span></label>)}</div> : <textarea className="form-control mt-2" rows={q.question_type === "long" ? 6 : 3} value={answers[q.id]?.answer_text || ""} onChange={(e) => setAnswer(q, { answer_text: e.target.value, answer_value: q.question_type === "fill_blank" ? e.target.value : null })} />}
    </div>)}
  </div><div className="modal-action-bar"><button className="btn btn-light" onClick={save}>Save Progress</button><button className="btn btn-primary" disabled={busy} onClick={() => submit(false)}>{busy ? "Submitting…" : "Submit Test"}</button></div></Modal>;
}

function OfflineSubmit({ assessment, onClose, onSubmitted, onError }) {
  const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); if (!files.length) return onError("Select at least one scanned answer-sheet file."); setBusy(true); try { const fd = new FormData(); files.forEach((f) => fd.append("submission_files", f)); fd.append("client_meta", JSON.stringify({ source: "web_upload" })); await api.post(`/api/assessments/${assessment.id}/submit`, fd); onSubmitted(); } catch (error) { onError(error.response?.data?.message || "Could not upload answer sheets."); } finally { setBusy(false); } };
  return <Modal title="Upload Answer Sheets" onClose={onClose}><form onSubmit={submit}><div className="p-4"><h5>{assessment.title}</h5><p className="text-muted">Scan clearly, keep pages in order and upload PDF/JPG/PNG files.</p><input className="form-control" required type="file" accept="application/pdf,image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />{files.length > 0 && <div className="mt-3 small">{files.map((f, i) => <div key={`${f.name}-${i}`}><i className="bi bi-file-earmark me-1" />{f.name}</div>)}</div>}</div><div className="modal-action-bar"><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Submit Answer Sheets"}</button></div></form></Modal>;
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
  return <Modal title={`${readOnly ? "Student Results" : "Submissions"} — ${state.assessment.title}`} large onClose={onClose}>
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
  </Modal>;
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

function Modal({ title, children, onClose, large = false }) { return <div className="assessment-modal-backdrop"><div className={`assessment-modal card shadow-lg ${large ? "assessment-modal-lg" : ""}`} role="dialog" aria-modal="true"><div className="card-header d-flex align-items-center justify-content-between"><h5 className="mb-0">{title}</h5><button className="btn-close" onClick={onClose} /></div>{children}</div></div>; }
function Input({ label, onChange, ...props }) { return <div className="col-md-6"><label className="form-label">{label}</label><input className="form-control" onChange={(e) => onChange(e.target.value)} {...props} /></div>; }
function SelectField({ label, options, onChange, empty = "Select", ...props }) { return <div className="col-md-6"><label className="form-label">{label}</label><select className="form-select" onChange={(e) => onChange(e.target.value)} {...props}><option value="">{empty}</option>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>; }
function Check({ label, checked, onChange }) { return <label className="form-check"><input className="form-check-input" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span className="form-check-label">{label}</span></label>; }
