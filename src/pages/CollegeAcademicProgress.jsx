import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import { useBranch } from "../branch/BranchContext";
import "./CollegeAcademicProgress.css";

const STAFF = new Set(["examination", "department_hod", "principal", "academic_coordinator", "coordinator", "admin", "superadmin", "super_admin"]);
const getRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole") || localStorage.getItem("role");
    return (many.length ? many : [one]).filter(Boolean).map((r) => String(r).toLowerCase());
  } catch (_) {
    return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean);
  }
};
const rowsFrom = (data, key) => Array.isArray(data) ? data : (Array.isArray(data?.[key]) ? data[key] : []);
const n = (v) => Number(v || 0);
const fmt = (v) => Number(v || 0).toFixed(2);
const fmtCredits = (v) => Number(v || 0).toFixed(Number(v || 0) % 1 ? 1 : 0);

function Metric({ label, value, note, tone = "primary", icon = "bi-stars" }) {
  return <div className="col-6 col-xl-3"><div className={`cap-metric cap-metric-${tone}`}><i className={`bi ${icon}`} /><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></div></div>;
}

function StudentProgressView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: result } = await api.get("/college-academic-progress/my-summary");
      setData(result);
    } catch (error) {
      Swal.fire("Unable to load", error?.response?.data?.message || error.message, "error");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  if (loading) return <div className="cap-loading"><div className="spinner-border text-primary" /> Loading academic progress…</div>;

  const current = data?.current_semester;
  const semesters = data?.semesters || [];
  return <>
    <div className="row g-3 mb-4">
      <Metric label="Current SGPA" value={current ? fmt(current.sgpa) : "—"} note={current?.program_semester || "No published semester result"} tone="primary" icon="bi-bar-chart-fill" />
      <Metric label="Overall CGPA" value={semesters.length ? fmt(data?.cgpa) : "—"} note={`${semesters.length} semester result${semesters.length === 1 ? "" : "s"}`} tone="success" icon="bi-award-fill" />
      <Metric label="Credits Earned" value={fmtCredits(data?.earned_credits)} note={`of ${fmtCredits(data?.attempted_credits)} attempted`} tone="info" icon="bi-mortarboard-fill" />
      <Metric label="Credit Points" value={fmt(data?.credit_points)} note="Weighted by subject credits" tone="warning" icon="bi-calculator-fill" />
    </div>

    {!semesters.length ? <div className="alert alert-info rounded-4">Your SGPA / CGPA will appear here after the college publishes semester grades.</div> : semesters.map((semester) => <section className="cap-card mb-3" key={`${semester.session_id}-${semester.class_id}`}>
      <div className="cap-card-head">
        <div><span className="cap-kicker">{semester.session_name}</span><h2>{semester.program_semester}</h2><p>{fmtCredits(semester.earned_credits)} earned / {fmtCredits(semester.attempted_credits)} attempted credits</p></div>
        <div className="cap-sgpa"><span>SGPA</span><strong>{fmt(semester.sgpa)}</strong></div>
      </div>
      <div className="table-responsive"><table className="table align-middle mb-0 cap-table"><thead><tr><th>Paper / Subject</th><th>Credits</th><th>%</th><th>Grade</th><th>GP</th><th>Credit Points</th><th>Status</th></tr></thead><tbody>
        {semester.subjects.map((row) => <tr key={row.id}><td className="fw-semibold">{row.subject_name}</td><td>{fmtCredits(row.credits)}</td><td>{row.percentage == null ? "—" : fmt(row.percentage)}</td><td><span className="cap-grade-pill">{row.letter_grade || "—"}</span></td><td>{fmt(row.grade_point)}</td><td>{fmt(row.credit_points)}</td><td><span className={`badge ${row.result_status === "passed" ? "text-bg-success" : row.result_status === "incomplete" ? "text-bg-secondary" : "text-bg-danger"}`}>{String(row.result_status || "").replace("_", " ")}</span></td></tr>)}
      </tbody></table></div>
    </section>)}
  </>;
}

function StaffProgressView() {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [offerings, setOfferings] = useState([]);
  const [scale, setScale] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);

  useEffect(() => {
    Promise.all([api.get("/sessions"), api.get("/classes?withSections=true"), api.get("/sections"), api.get("/college-academic-progress/grade-scale")])
      .then(([s, c, sec, gradeScale]) => {
        const sessionRows = rowsFrom(s.data, "sessions");
        setSessions(sessionRows);
        setClasses(rowsFrom(c.data, "classes"));
        setSections(rowsFrom(sec.data, "sections"));
        setScale(gradeScale.data?.scale || []);
        const active = sessionRows.find((row) => row.is_active);
        if (active) setSessionId(String(active.id));
      })
      .catch((error) => Swal.fire("Unable to load academic masters", error?.response?.data?.message || error.message, "error"));
  }, []);

  const filteredSections = useMemo(() => sections.filter((row) => Number(row.class_id) === Number(classId)), [sections, classId]);

  const loadBase = useCallback(async () => {
    if (!sessionId || !classId) { setOfferings([]); setStudents([]); setSummary([]); return; }
    setLoading(true);
    try {
      const [setup, classSummary] = await Promise.all([
        api.get("/college-academic-progress/setup", { params: { session_id: sessionId, class_id: classId } }),
        api.get("/college-academic-progress/summary/class", { params: { session_id: sessionId, class_id: classId, section_id: sectionId || undefined } }),
      ]);
      setOfferings(setup.data?.offerings || []);
      setScale(setup.data?.scale || []);
      setSummary(classSummary.data?.students || []);
      if (subjectId && !(setup.data?.offerings || []).some((o) => Number(o.subject_id) === Number(subjectId))) setSubjectId("");
    } catch (error) {
      Swal.fire("Unable to load", error?.response?.data?.message || error.message, "error");
    } finally { setLoading(false); }
  }, [sessionId, classId, sectionId, subjectId]);

  useEffect(() => { loadBase(); }, [loadBase]);

  const loadRows = useCallback(async () => {
    if (!sessionId || !classId || !subjectId) { setStudents([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/college-academic-progress/setup", { params: { session_id: sessionId, class_id: classId, section_id: sectionId || undefined, subject_id: subjectId } });
      setScale(data?.scale || []);
      setStudents((data?.students || []).map((student) => ({
        ...student,
        percentage: student.grade?.percentage ?? "",
        result_status: student.grade?.result_status || "",
        remarks: student.grade?.remarks || "",
        published: Boolean(student.grade?.published),
      })));
    } catch (error) {
      Swal.fire("Unable to load grade rows", error?.response?.data?.message || error.message, "error");
    } finally { setLoading(false); }
  }, [sessionId, classId, sectionId, subjectId]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const preview = (row) => {
    if (row.result_status === "absent") return { grade: "F", gp: 0, status: "absent" };
    if (row.result_status === "incomplete" || row.percentage === "") return { grade: "I", gp: 0, status: "incomplete" };
    const p = Number(row.percentage);
    const match = scale.find((g) => p >= Number(g.min_percent) && p <= Number(g.max_percent));
    return match ? { grade: match.letter_grade, gp: Number(match.grade_point), status: match.is_pass ? "passed" : "failed" } : { grade: "—", gp: 0, status: "incomplete" };
  };

  const updateStudent = (id, patch) => setStudents((rows) => rows.map((row) => Number(row.id) === Number(id) ? { ...row, ...patch } : row));

  const save = async (publish) => {
    if (!subjectId || !students.length) return Swal.fire("Nothing to save", "Select a paper with eligible students first.", "info");
    setSaving(true);
    try {
      const { data } = await api.post("/college-academic-progress/grades/bulk", {
        session_id: Number(sessionId), class_id: Number(classId), section_id: sectionId ? Number(sectionId) : null, subject_id: Number(subjectId), publish,
        rows: students.map((row) => ({ student_id: row.id, percentage: row.percentage === "" ? null : Number(row.percentage), result_status: row.result_status || undefined, remarks: row.remarks || "" })),
      });
      await Swal.fire(publish ? "Published" : "Saved", data?.message || "Grades saved.", "success");
      await Promise.all([loadRows(), loadBase()]);
    } catch (error) {
      Swal.fire("Unable to save", error?.response?.data?.message || error.message, "error");
    } finally { setSaving(false); }
  };

  const saveScale = async () => {
    try {
      const { data } = await api.put("/college-academic-progress/grade-scale", { scale });
      setScale(data?.scale || []);
      Swal.fire("Saved", "Grade scale updated. New grade entries will use this scale.", "success");
    } catch (error) { Swal.fire("Unable to save", error?.response?.data?.message || error.message, "error"); }
  };

  const currentOffering = offerings.find((o) => Number(o.subject_id) === Number(subjectId));

  return <>
    <section className="cap-card mb-3">
      <div className="cap-filter-grid">
        <div><label>Academic Year</label><select className="form-select" value={sessionId} onChange={(e) => { setSessionId(e.target.value); setSubjectId(""); }}><option value="">Select</option>{sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
        <div><label>Program / Semester</label><select className="form-select" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); setSubjectId(""); }}><option value="">Select</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.class_name}</option>)}</select></div>
        <div><label>Batch / Section</label><select className="form-select" value={sectionId} onChange={(e) => setSectionId(e.target.value)}><option value="">All Sections</option>{filteredSections.map((row) => <option key={row.id} value={row.id}>{row.section_name}</option>)}</select></div>
        <div><label>Paper / Subject</label><select className="form-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">Select paper</option>{offerings.map((row) => <option key={row.id} value={row.subject_id}>{row.subject?.name || row.subject_id} · {fmtCredits(row.credits)} cr</option>)}</select></div>
      </div>
    </section>

    <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
      <div>{currentOffering && <span className="badge rounded-pill text-bg-primary fs-6">{currentOffering.subject?.name} · {fmtCredits(currentOffering.credits)} Credits</span>}</div>
      <button className="btn btn-outline-secondary btn-sm" onClick={() => setScaleOpen((v) => !v)}><i className="bi bi-sliders me-1" /> Grade Scale</button>
    </div>

    {scaleOpen && <section className="cap-card mb-3">
      <div className="cap-card-head"><div><span className="cap-kicker">Institution Settings</span><h2>Grade Scale</h2><p>Editable starter scale — align it with the college / university rules before publishing results.</p></div></div>
      <div className="table-responsive"><table className="table align-middle cap-table"><thead><tr><th>Min %</th><th>Max %</th><th>Grade</th><th>Grade Point</th><th>Pass?</th><th>Description</th><th /></tr></thead><tbody>{scale.map((row, index) => <tr key={row.id || index}>
        <td><input className="form-control form-control-sm" type="number" step="0.01" value={row.min_percent} onChange={(e) => setScale((s) => s.map((x, i) => i === index ? { ...x, min_percent: e.target.value } : x))} /></td>
        <td><input className="form-control form-control-sm" type="number" step="0.01" value={row.max_percent} onChange={(e) => setScale((s) => s.map((x, i) => i === index ? { ...x, max_percent: e.target.value } : x))} /></td>
        <td><input className="form-control form-control-sm" value={row.letter_grade} onChange={(e) => setScale((s) => s.map((x, i) => i === index ? { ...x, letter_grade: e.target.value } : x))} /></td>
        <td><input className="form-control form-control-sm" type="number" step="0.01" value={row.grade_point} onChange={(e) => setScale((s) => s.map((x, i) => i === index ? { ...x, grade_point: e.target.value } : x))} /></td>
        <td><input className="form-check-input" type="checkbox" checked={Boolean(row.is_pass)} onChange={(e) => setScale((s) => s.map((x, i) => i === index ? { ...x, is_pass: e.target.checked } : x))} /></td>
        <td><input className="form-control form-control-sm" value={row.description || ""} onChange={(e) => setScale((s) => s.map((x, i) => i === index ? { ...x, description: e.target.value } : x))} /></td>
        <td><button className="btn btn-sm btn-outline-danger" disabled={scale.length <= 1} onClick={() => setScale((rows) => rows.filter((_, i) => i !== index))}><i className="bi bi-trash" /></button></td>
      </tr>)}</tbody></table></div>
      <div className="d-flex flex-wrap gap-2 justify-content-between">
        <button className="btn btn-outline-secondary" onClick={() => setScale((rows) => [...rows, { min_percent: 0, max_percent: 0, letter_grade: "", grade_point: 0, is_pass: true, description: "" }])}><i className="bi bi-plus-lg me-1" /> Add Grade Row</button>
        <button className="btn btn-primary" onClick={saveScale}>Save Grade Scale</button>
      </div>
    </section>}

    <section className="cap-card mb-4">
      <div className="cap-card-head"><div><span className="cap-kicker">Grade Entry</span><h2>Paper-wise Credits & Grade Points</h2><p>Enter final percentage now. Internal + external exam integration can feed this automatically in the next module.</p></div>{loading && <div className="spinner-border spinner-border-sm text-primary" />}</div>
      {!subjectId ? <div className="cap-empty">Select a paper to enter final grades.</div> : !students.length ? <div className="cap-empty">No eligible students found for this paper / section.</div> : <>
        <div className="table-responsive"><table className="table align-middle cap-table"><thead><tr><th>Student</th><th style={{ minWidth: 120 }}>Final %</th><th style={{ minWidth: 135 }}>Special Status</th><th>Grade</th><th>GP</th><th>Credit Points</th><th style={{ minWidth: 180 }}>Remarks</th><th>Published</th></tr></thead><tbody>
          {students.map((row) => { const p = preview(row); const cp = p.status === "incomplete" ? 0 : n(currentOffering?.credits) * p.gp; return <tr key={row.id}><td><strong>{row.name}</strong><small className="d-block text-muted">{row.admission_number}</small></td><td><input className="form-control form-control-sm" type="number" min="0" max="100" step="0.01" value={row.percentage} disabled={["absent", "incomplete"].includes(row.result_status)} onChange={(e) => updateStudent(row.id, { percentage: e.target.value, result_status: "" })} /></td><td><select className="form-select form-select-sm" value={row.result_status === "absent" || row.result_status === "incomplete" ? row.result_status : ""} onChange={(e) => updateStudent(row.id, { result_status: e.target.value, ...(e.target.value ? { percentage: e.target.value === "absent" ? 0 : "" } : {}) })}><option value="">Auto from %</option><option value="absent">Absent</option><option value="incomplete">Incomplete</option></select></td><td><span className="cap-grade-pill">{p.grade}</span></td><td>{fmt(p.gp)}</td><td>{fmt(cp)}</td><td><input className="form-control form-control-sm" value={row.remarks} onChange={(e) => updateStudent(row.id, { remarks: e.target.value })} /></td><td>{row.published ? <span className="badge text-bg-success">Yes</span> : <span className="badge text-bg-secondary">Draft</span>}</td></tr>; })}
        </tbody></table></div>
        <div className="cap-savebar"><div><strong>{students.length} students</strong><small>SGPA = Σ(Credit × Grade Point) ÷ Σ Credits</small></div><div className="d-flex gap-2"><button className="btn btn-light border" disabled={saving} onClick={() => save(false)}>Save Draft</button><button className="btn btn-primary" disabled={saving} onClick={() => save(true)}>{saving ? "Saving…" : "Publish & Recalculate"}</button></div></div>
      </>}
    </section>

    <section className="cap-card">
      <div className="cap-card-head"><div><span className="cap-kicker">Semester Overview</span><h2>Student SGPA / CGPA</h2><p>Published grades only. CGPA combines all published semester credit points.</p></div></div>
      <div className="table-responsive"><table className="table align-middle cap-table"><thead><tr><th>Student</th><th>Current SGPA</th><th>Overall CGPA</th><th>Earned Credits</th><th>Attempted Credits</th></tr></thead><tbody>{summary.map((row) => <tr key={row.id}><td><strong>{row.name}</strong><small className="d-block text-muted">{row.admission_number}</small></td><td><strong>{fmt(row.sgpa)}</strong></td><td><span className="badge rounded-pill text-bg-primary fs-6">{fmt(row.cgpa)}</span></td><td>{fmtCredits(row.earned_credits)}</td><td>{fmtCredits(row.attempted_credits)}</td></tr>)}</tbody></table>{!summary.length && <div className="cap-empty">Select a program / semester to view the summary.</div>}</div>
    </section>
  </>;
}

export default function CollegeAcademicProgress() {
  const { isCollege } = useInstitution();
  const { allBranches } = useBranch();
  const roles = useMemo(getRoles, []);
  const isStudent = roles.includes("student");
  const isStaff = roles.some((role) => STAFF.has(role));

  if (!isCollege) return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">Credits, SGPA and CGPA are available in <strong>College mode</strong>.</div></div>;
  if (!isStudent && !isStaff) return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4">Your role does not have access to College Academic Progress.</div></div>;
  if (allBranches && isStaff) return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4"><strong>Select a Branch / Campus</strong> before entering or publishing grades.</div></div>;

  return <main className="cap-page container-fluid py-4 px-3 px-md-4">
    <div className="cap-hero mb-4"><div><span className="cap-kicker">College Academics</span><h1>Credits · SGPA · CGPA</h1><p>{isStudent ? "Your semester credits, grades, SGPA and cumulative academic performance." : "Configure grade points, publish credit-based grades and calculate SGPA / CGPA automatically."}</p></div><div className="cap-hero-icon"><i className="bi bi-award-fill" /></div></div>
    {isStudent ? <StudentProgressView /> : <StaffProgressView />}
  </main>;
}
