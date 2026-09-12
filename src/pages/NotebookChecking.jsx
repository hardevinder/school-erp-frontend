import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./NotebookChecking.css";

const ROLE_SET = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole") || localStorage.getItem("role");
    return [...new Set([...(Array.isArray(many) ? many : []), one].filter(Boolean).map((r) => String(r).toLowerCase()))];
  } catch (_) {
    return [localStorage.getItem("userRole") || localStorage.getItem("role")].filter(Boolean).map((r) => String(r).toLowerCase());
  }
};

const LEADERSHIP = new Set(["department_hod", "principal", "academic_coordinator", "coordinator", "admin", "superadmin", "super_admin"]);
const STATUS_OPTIONS = [
  ["checked", "Checked"],
  ["not_submitted", "Not Submitted"],
  ["incomplete", "Incomplete"],
  ["correction_required", "Correction Required"],
  ["recheck_required", "Recheck Required"],
];
const ISSUE_STATUSES = new Set(["not_submitted", "incomplete", "correction_required", "recheck_required"]);
const today = () => new Date().toISOString().slice(0, 10);
const rowsFrom = (data, key) => Array.isArray(data?.[key]) ? data[key] : Array.isArray(data) ? data : [];
const human = (value = "") => String(value).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const emptyForm = () => ({
  id: null,
  class_id: "",
  section_id: "",
  subject_id: "",
  lesson_plan_id: "",
  syllabus_item_id: "",
  chapter_unit: "",
  topic: "",
  work_type: "Notebook",
  check_date: today(),
  general_remarks: "",
});

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="nc-stat-card h-100">
        <span className="nc-stat-icon"><i className={`bi ${icon}`} /></span>
        <div><div className="nc-stat-label">{label}</div><div className="nc-stat-value">{value ?? 0}</div>{sub ? <div className="nc-stat-sub">{sub}</div> : null}</div>
      </div>
    </div>
  );
}

export default function NotebookChecking() {
  const roles = useMemo(ROLE_SET, []);
  const isLeadership = roles.some((r) => LEADERSHIP.has(r));
  const { isCollege, terms } = useInstitution();
  const [tab, setTab] = useState("checking");
  const [meta, setMeta] = useState({ classes: [], sections: [], subjects: [], lessons: [], syllabusItems: [] });
  const [form, setForm] = useState(emptyForm);
  const [entries, setEntries] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [pendingSessions, setPendingSessions] = useState([]);
  const [report, setReport] = useState({ summary: {}, teacherSummary: [] });
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const classes = rowsFrom(meta, "classes");
  const sections = rowsFrom(meta, "sections");
  const subjects = rowsFrom(meta, "subjects");
  const lessons = rowsFrom(meta, "lessons");
  const syllabusItems = rowsFrom(meta, "syllabusItems");
  const filteredSections = useMemo(() => sections.filter((s) => Number(s.class_id) === Number(form.class_id)), [sections, form.class_id]);

  const loadMeta = async (classId = form.class_id, subjectId = form.subject_id) => {
    try {
      const { data } = await api.get("/notebook-checking/meta", { params: { class_id: classId || undefined, subject_id: subjectId || undefined } });
      setMeta(data || {});
    } catch (error) {
      console.warn("Notebook checking metadata error", error);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const [all, pending, summary] = await Promise.all([
        api.get("/notebook-checking/sessions"),
        api.get("/notebook-checking/sessions", { params: { pending_only: true } }),
        api.get("/notebook-checking/reports/summary"),
      ]);
      setSessions(rowsFrom(all.data, "sessions"));
      setPendingSessions(rowsFrom(pending.data, "sessions"));
      setReport(summary.data || { summary: {}, teacherSummary: [] });
    } catch (error) {
      console.error(error);
      Swal.fire("Unable to load", error?.response?.data?.message || "Notebook checking records could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMeta("", ""); loadSessions(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (form.class_id && form.subject_id) loadMeta(form.class_id, form.subject_id); /* eslint-disable-next-line */ }, [form.class_id, form.subject_id]);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "class_id") { next.section_id = ""; next.lesson_plan_id = ""; next.syllabus_item_id = ""; }
      if (key === "subject_id") { next.lesson_plan_id = ""; next.syllabus_item_id = ""; }
      return next;
    });
  };

  const chooseLesson = (value) => {
    const lesson = lessons.find((l) => Number(l.id) === Number(value));
    setForm((prev) => ({
      ...prev,
      lesson_plan_id: value,
      topic: lesson ? [lesson.topic, lesson.subtopic].filter(Boolean).join(" — ") : prev.topic,
    }));
  };

  const chooseSyllabus = (value) => {
    const item = syllabusItems.find((i) => Number(i.id) === Number(value));
    setForm((prev) => ({
      ...prev,
      syllabus_item_id: value,
      chapter_unit: item ? [item.unitNumber, item.unitTitle].filter(Boolean).join(" - ") : prev.chapter_unit,
      topic: item?.topics || prev.topic,
    }));
  };

  const loadStudents = async () => {
    if (!form.class_id || !form.section_id) return Swal.fire("Select class & section", `Select ${terms.classLower} and ${terms.sectionLower} first.`, "warning");
    try {
      setStudentsLoading(true);
      const { data } = await api.get("/notebook-checking/students", { params: { class_id: form.class_id, section_id: form.section_id } });
      const students = rowsFrom(data, "students");
      setEntries(students.map((student) => ({ student_id: student.id, student, status: "checked", remarks: "" })));
      if (!students.length) Swal.fire("No students", "No enabled students were found for this class/section.", "info");
    } catch (error) {
      Swal.fire("Unable to load students", error?.response?.data?.message || "Please try again.", "error");
    } finally { setStudentsLoading(false); }
  };

  const updateEntry = (studentId, key, value) => setEntries((prev) => prev.map((e) => Number(e.student_id) === Number(studentId) ? { ...e, [key]: value } : e));
  const bulkChecked = () => setEntries((prev) => prev.map((e) => ({ ...e, status: "checked" })));

  const reset = () => { setForm(emptyForm()); setEntries([]); };

  const save = async (status) => {
    if (!form.class_id || !form.section_id || !form.subject_id) return Swal.fire("Missing details", `Select ${terms.classLower}, ${terms.sectionLower} and ${terms.subjectLower}.`, "warning");
    if (!form.topic.trim() && !form.chapter_unit.trim()) return Swal.fire("Lesson / topic required", "Select a lesson/syllabus unit or enter the lesson/topic checked.", "warning");
    if (!entries.length) return Swal.fire("Students required", "Load the student list first.", "warning");
    const payload = {
      ...form,
      status,
      entries: entries.map((e) => ({ student_id: e.student_id, status: e.status, remarks: e.remarks })),
    };
    try {
      setSaving(true);
      const { data } = form.id
        ? await api.put(`/notebook-checking/sessions/${form.id}`, payload)
        : await api.post("/notebook-checking/sessions", payload);
      await loadSessions();
      if (status === "completed") { reset(); setTab("history"); }
      else setForm((prev) => ({ ...prev, id: data?.session?.id || prev.id }));
      Swal.fire("Saved", data?.message || "Notebook checking saved.", "success");
    } catch (error) {
      Swal.fire("Unable to save", error?.response?.data?.message || "Notebook checking could not be saved.", "error");
    } finally { setSaving(false); }
  };

  const editSession = async (row) => {
    try {
      const { data } = await api.get(`/notebook-checking/sessions/${row.id}`);
      const s = data?.session;
      if (!s) return;
      setForm({
        id: s.id,
        class_id: String(s.class_id || ""),
        section_id: String(s.section_id || ""),
        subject_id: String(s.subject_id || ""),
        lesson_plan_id: String(s.lesson_plan_id || ""),
        syllabus_item_id: String(s.syllabus_item_id || ""),
        chapter_unit: s.chapter_unit || "",
        topic: s.topic || "",
        work_type: s.work_type || "Notebook",
        check_date: s.check_date || today(),
        general_remarks: s.general_remarks || "",
      });
      setEntries((s.entries || []).map((e) => ({ student_id: e.student_id, student: e.student, status: e.status, remarks: e.remarks || "" })));
      setTab("checking");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { Swal.fire("Error", error?.response?.data?.message || "Unable to open record.", "error"); }
  };

  const removeSession = async (row) => {
    const result = await Swal.fire({ title: "Delete this checking record?", text: "Student copy-checking statuses in this record will be removed.", icon: "warning", showCancelButton: true, confirmButtonColor: "#dc3545", confirmButtonText: "Delete" });
    if (!result.isConfirmed) return;
    try { await api.delete(`/notebook-checking/sessions/${row.id}`); await loadSessions(); Swal.fire("Deleted", "Notebook checking record removed.", "success"); }
    catch (error) { Swal.fire("Error", error?.response?.data?.message || "Unable to delete.", "error"); }
  };

  const verify = async (row) => {
    const result = await Swal.fire({
      title: "HOD / Coordinator Verification",
      html: `<select id="nc-verification" class="swal2-select" style="width:85%"><option value="satisfactory">Satisfactory</option><option value="improvement_required">Improvement Required</option><option value="recheck">Recheck</option></select><textarea id="nc-remarks" class="swal2-textarea" placeholder="Verification remarks"></textarea>`,
      showCancelButton: true,
      confirmButtonText: "Save Verification",
      preConfirm: () => ({ verification_status: document.getElementById("nc-verification")?.value, verification_remarks: document.getElementById("nc-remarks")?.value || "" }),
    });
    if (!result.isConfirmed) return;
    try { await api.post(`/notebook-checking/sessions/${row.id}/verify`, result.value); await loadSessions(); Swal.fire("Verified", "Verification saved.", "success"); }
    catch (error) { Swal.fire("Error", error?.response?.data?.message || "Unable to verify.", "error"); }
  };

  const issueCount = (row) => (row.entries || []).filter((e) => ISSUE_STATUSES.has(e.status)).length;
  const checkedCount = (row) => (row.entries || []).filter((e) => e.status === "checked").length;
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => `${s.class?.class_name || ""} ${s.section?.section_name || ""} ${s.subject?.name || ""} ${s.topic || ""} ${s.chapter_unit || ""} ${s.checker?.name || ""}`.toLowerCase().includes(q));
  }, [sessions, historySearch]);

  if (isCollege) {
    return <div className="container-fluid py-4"><div className="alert alert-info rounded-4 shadow-sm"><h5 className="mb-1"><i className="bi bi-journal-check me-2" />Notebook / Copy Checking</h5><div>This module is designed for School mode. College LMS can continue using Assignments, Assessments and Learning Resources.</div></div></div>;
  }

  const summary = report?.summary || {};
  return (
    <div className="container-fluid py-4 notebook-checking-page">
      <section className="nc-hero mb-4">
        <div><div className="nc-eyebrow"><i className="bi bi-journal-check" /> EduBridge Academic Monitoring</div><h1>Notebook / Copy Checking</h1><p>Track copy checking down to class, subject, lesson, chapter and topic — with pending corrections and HOD verification.</p></div>
        <div className="nc-hero-mark"><i className="bi bi-pencil-square" /></div>
      </section>

      <div className="row g-3 mb-4">
        <StatCard icon="bi-journals" label="Checking Sessions" value={summary.sessions} sub={`${summary.completed_sessions || 0} completed`} />
        <StatCard icon="bi-check2-circle" label="Copies Checked" value={summary.checked} sub={`${summary.total_students || 0} student records`} />
        <StatCard icon="bi-exclamation-circle" label="Pending / Corrections" value={(summary.not_submitted || 0) + (summary.incomplete || 0) + (summary.correction_required || 0) + (summary.recheck_required || 0)} sub={`${summary.recheck_required || 0} recheck`} />
        <StatCard icon="bi-patch-check" label="Pending Verification" value={summary.pending_verification} sub={`${summary.satisfactory || 0} satisfactory`} />
      </div>

      <div className="nc-tabs mb-4">
        <button className={tab === "checking" ? "active" : ""} onClick={() => setTab("checking")}><i className="bi bi-pencil-square" /> Daily Checking</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><i className="bi bi-clock-history" /> History</button>
        <button className={tab === "pending" ? "active" : ""} onClick={() => setTab("pending")}><i className="bi bi-arrow-repeat" /> Pending / Recheck <span className="badge text-bg-danger">{pendingSessions.length}</span></button>
        {isLeadership && <button className={tab === "verification" ? "active" : ""} onClick={() => setTab("verification")}><i className="bi bi-patch-check" /> HOD Verification</button>}
        <button className={tab === "reports" ? "active" : ""} onClick={() => setTab("reports")}><i className="bi bi-bar-chart" /> Reports</button>
      </div>

      {tab === "checking" && (
        <div className="row g-4">
          <div className="col-12 col-xl-4">
            <div className="nc-panel sticky-xl-top" style={{ top: 76 }}>
              <div className="nc-panel-title"><div><small>{form.id ? `Editing #${form.id}` : "New checking"}</small><h5>Lesson / Topic Details</h5></div>{form.id && <button className="btn btn-sm btn-outline-secondary" onClick={reset}>New</button>}</div>
              <div className="row g-3">
                <div className="col-12"><label className="form-label">Date</label><input type="date" className="form-control" value={form.check_date} onChange={(e) => setField("check_date", e.target.value)} /></div>
                <div className="col-md-6 col-xl-12"><label className="form-label">Class</label><select className="form-select" value={form.class_id} onChange={(e) => setField("class_id", e.target.value)}><option value="">Select class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}</select></div>
                <div className="col-md-6 col-xl-12"><label className="form-label">Section</label><select className="form-select" value={form.section_id} onChange={(e) => setField("section_id", e.target.value)}><option value="">Select section</option>{filteredSections.map((s) => <option key={s.id} value={s.id}>{s.section_name}</option>)}</select></div>
                <div className="col-12"><label className="form-label">Subject</label><select className="form-select" value={form.subject_id} onChange={(e) => setField("subject_id", e.target.value)}><option value="">Select subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div className="col-12"><label className="form-label">Lesson Plan <span className="text-muted">(optional)</span></label><select className="form-select" value={form.lesson_plan_id} onChange={(e) => chooseLesson(e.target.value)}><option value="">Select lesson plan</option>{lessons.map((l) => <option key={l.id} value={l.id}>{[l.topic, l.subtopic].filter(Boolean).join(" — ")}</option>)}</select></div>
                <div className="col-12"><label className="form-label">Syllabus Chapter / Unit <span className="text-muted">(optional)</span></label><select className="form-select" value={form.syllabus_item_id} onChange={(e) => chooseSyllabus(e.target.value)}><option value="">Select syllabus unit</option>{syllabusItems.map((i) => <option key={i.id} value={i.id}>{[i.unitNumber, i.unitTitle].filter(Boolean).join(" - ")}{i.topics ? ` — ${i.topics}` : ""}</option>)}</select></div>
                <div className="col-12"><label className="form-label">Chapter / Unit</label><input className="form-control" value={form.chapter_unit} onChange={(e) => setField("chapter_unit", e.target.value)} placeholder="e.g. Chapter 4 - Materials" /></div>
                <div className="col-12"><label className="form-label">Lesson / Topic *</label><textarea className="form-control" rows="2" value={form.topic} onChange={(e) => setField("topic", e.target.value)} placeholder="e.g. Soluble & Insoluble Substances" /></div>
                <div className="col-12"><label className="form-label">Work Type</label><select className="form-select" value={form.work_type} onChange={(e) => setField("work_type", e.target.value)}><option>Notebook</option><option>Classwork</option><option>Homework</option><option>Worksheet</option><option>Practical File</option><option>Project Work</option></select></div>
                <div className="col-12"><label className="form-label">General Remarks</label><textarea className="form-control" rows="2" value={form.general_remarks} onChange={(e) => setField("general_remarks", e.target.value)} placeholder="Optional class-level note" /></div>
                <div className="col-12 d-grid"><button className="btn btn-primary" onClick={loadStudents} disabled={studentsLoading}>{studentsLoading ? <><span className="spinner-border spinner-border-sm me-2" />Loading...</> : <><i className="bi bi-people me-2" />Load Students</>}</button></div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-8">
            <div className="nc-panel">
              <div className="nc-panel-title flex-wrap gap-2"><div><small>Student-wise status</small><h5>{entries.length ? `${entries.length} Students` : "Load a class to start"}</h5></div>{entries.length > 0 && <button className="btn btn-sm btn-outline-success" onClick={bulkChecked}><i className="bi bi-check2-all me-1" />Mark All Checked</button>}</div>
              {!entries.length ? <div className="nc-empty"><i className="bi bi-journal-text" /><h5>No student list loaded</h5><p>Select class, section, subject and lesson/topic, then load students.</p></div> : (
                <div className="table-responsive"><table className="table align-middle nc-table"><thead><tr><th>#</th><th>Student</th><th style={{ minWidth: 190 }}>Status</th><th style={{ minWidth: 240 }}>Remarks</th></tr></thead><tbody>{entries.map((entry, idx) => <tr key={entry.student_id} className={ISSUE_STATUSES.has(entry.status) ? "nc-issue-row" : ""}><td>{entry.student?.roll_number || idx + 1}</td><td><strong>{entry.student?.name || `Student ${entry.student_id}`}</strong><div className="small text-muted">{entry.student?.admission_number || ""}</div></td><td><select className={`form-select form-select-sm nc-status nc-status-${entry.status}`} value={entry.status} onChange={(e) => updateEntry(entry.student_id, "status", e.target.value)}>{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td><td><input className="form-control form-control-sm" value={entry.remarks || ""} onChange={(e) => updateEntry(entry.student_id, "remarks", e.target.value)} placeholder={entry.status === "checked" ? "Optional remark" : "Reason / correction needed"} /></td></tr>)}</tbody></table></div>
              )}
              {entries.length > 0 && <div className="d-flex flex-wrap justify-content-end gap-2 pt-3 border-top"><button className="btn btn-outline-primary" disabled={saving} onClick={() => save("draft")}><i className="bi bi-save me-1" />Save Draft</button><button className="btn btn-success" disabled={saving} onClick={() => save("completed")}>{saving ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check2-circle me-1" />}Complete Checking</button></div>}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && <SessionTable title="Checking History" rows={filteredHistory} loading={loading} search={historySearch} setSearch={setHistorySearch} issueCount={issueCount} checkedCount={checkedCount} onEdit={editSession} onDelete={removeSession} canVerify={false} />}
      {tab === "pending" && <SessionTable title="Pending / Recheck Copies" rows={pendingSessions} loading={loading} issueCount={issueCount} checkedCount={checkedCount} onEdit={editSession} onDelete={removeSession} canVerify={false} />}
      {tab === "verification" && isLeadership && <SessionTable title="HOD / Coordinator Verification" rows={sessions.filter((s) => s.status === "completed")} loading={loading} issueCount={issueCount} checkedCount={checkedCount} onEdit={editSession} onDelete={removeSession} canVerify onVerify={verify} />}
      {tab === "reports" && (
        <div className="row g-4">
          <div className="col-12 col-xl-7"><div className="nc-panel"><div className="nc-panel-title"><div><small>Teacher-wise monitoring</small><h5>Copy Checking Summary</h5></div></div><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Teacher</th><th>Sessions</th><th>Student Copies</th><th>Issues</th><th>Completion</th></tr></thead><tbody>{(report.teacherSummary || []).map((t) => <tr key={t.teacher_id}><td><strong>{t.teacher_name}</strong></td><td>{t.sessions}</td><td>{t.students}</td><td><span className={`badge ${t.issues ? "text-bg-warning" : "text-bg-success"}`}>{t.issues}</span></td><td>{t.students ? `${Math.round(((t.students - t.issues) / t.students) * 100)}%` : "—"}</td></tr>)}{!(report.teacherSummary || []).length && <tr><td colSpan="5" className="text-center text-muted py-4">No checking data yet.</td></tr>}</tbody></table></div></div></div>
          <div className="col-12 col-xl-5"><div className="nc-panel h-100"><div className="nc-panel-title"><div><small>Quality snapshot</small><h5>Current Status Mix</h5></div></div>{STATUS_OPTIONS.map(([key, label]) => { const value = summary[key] || 0; const total = summary.total_students || 0; const pct = total ? Math.round((value / total) * 100) : 0; return <div className="mb-3" key={key}><div className="d-flex justify-content-between mb-1"><span>{label}</span><strong>{value} <small className="text-muted">({pct}%)</small></strong></div><div className="progress" style={{ height: 8 }}><div className="progress-bar" style={{ width: `${pct}%` }} /></div></div>; })}</div></div>
        </div>
      )}
    </div>
  );
}

function SessionTable({ title, rows = [], loading, search, setSearch, issueCount, checkedCount, onEdit, onDelete, canVerify, onVerify }) {
  return <div className="nc-panel"><div className="nc-panel-title flex-wrap gap-2"><div><small>Academic monitoring</small><h5>{title}</h5></div>{setSearch && <div className="input-group input-group-sm nc-search"><span className="input-group-text"><i className="bi bi-search" /></span><input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class, subject, topic, teacher..." /></div>}</div>{loading ? <div className="text-center py-5"><span className="spinner-border" /></div> : !rows.length ? <div className="nc-empty"><i className="bi bi-inbox" /><h5>No records found</h5><p>Notebook checking records will appear here.</p></div> : <div className="table-responsive"><table className="table align-middle nc-table"><thead><tr><th>Date</th><th>Class / Subject</th><th>Lesson / Topic</th><th>Teacher</th><th>Copies</th><th>Verification</th><th className="text-end">Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.check_date}</strong><div className="small text-muted">{row.work_type}</div></td><td><strong>{row.class?.class_name || `Class ${row.class_id}`}-{row.section?.section_name || ""}</strong><div className="small text-muted">{row.subject?.name || `Subject ${row.subject_id}`}</div></td><td><div className="fw-semibold">{row.chapter_unit || "—"}</div><div className="small text-muted nc-topic-cell">{row.topic || "—"}</div></td><td>{row.checker?.name || "—"}</td><td><span className="badge text-bg-success me-1">{checkedCount(row)} checked</span>{issueCount(row) > 0 && <span className="badge text-bg-warning">{issueCount(row)} pending</span>}</td><td><span className={`badge nc-verify-${row.verification_status}`}>{human(row.verification_status || "pending")}</span>{row.verifier?.name && <div className="small text-muted mt-1">{row.verifier.name}</div>}</td><td className="text-end text-nowrap"><button className="btn btn-sm btn-outline-primary me-1" onClick={() => onEdit(row)}><i className="bi bi-pencil" /></button>{canVerify && <button className="btn btn-sm btn-outline-success me-1" onClick={() => onVerify(row)}><i className="bi bi-patch-check" /></button>}<button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(row)}><i className="bi bi-trash" /></button></td></tr>)}</tbody></table></div>}</div>;
}
