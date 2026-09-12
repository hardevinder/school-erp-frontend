import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./CollegeExamination.css";

const STAFF = new Set(["examination","department_hod","principal","academic_coordinator","coordinator","admin","superadmin","super_admin"]);
const roles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const one = localStorage.getItem("userRole") || localStorage.getItem("role");
    return (many.length ? many : [one]).filter(Boolean).map((x) => String(x).toLowerCase());
  } catch (_) { return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean); }
};
const rowsFrom = (data, key) => Array.isArray(data) ? data : (Array.isArray(data?.[key]) ? data[key] : []);
const n = (v) => Number(v || 0);
const f2 = (v) => Number(v || 0).toFixed(2);
const DEFAULT_COMPONENTS = [
  { name: "Internal Assessment", component_type: "internal", max_marks: 30, weightage_percent: 30, minimum_pass_marks: 12, must_pass: false },
  { name: "External / University Exam", component_type: "external", max_marks: 70, weightage_percent: 70, minimum_pass_marks: 28, must_pass: true },
];

function StudentResults() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/college-examinations/my-results").then((r) => setData(r.data)).catch((e) => Swal.fire("Unable to load", e?.response?.data?.message || e.message, "error")).finally(() => setLoading(false));
  }, []);
  if (loading) return <div className="ce-loading"><div className="spinner-border text-primary" /> Loading examination result…</div>;
  const results = data?.results || [];
  if (!results.length) return <div className="alert alert-info rounded-4">Your internal / external examination result will appear here after the college publishes it.</div>;
  return <div className="row g-3">
    {results.map((r) => <div className="col-12" key={r.structure.id}><section className="ce-card">
      <div className="ce-result-head">
        <div><span className="ce-kicker">{r.structure.session?.name || "Academic Year"}</span><h2>{r.structure.subject?.name || "Paper / Subject"}</h2><p>{r.structure.programSemester?.class_name || "Program / Semester"} · {r.structure.result_name}</p></div>
        <div className="ce-grade"><span>Final</span><strong>{r.final_percentage == null ? "—" : `${f2(r.final_percentage)}%`}</strong><small>{r.letter_grade || String(r.result_status || "").toUpperCase()}</small></div>
      </div>
      <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Component</th><th>Marks</th><th>Weight</th><th>Status</th></tr></thead><tbody>
        {r.components.map((c) => <tr key={c.id}><td><strong>{c.name}</strong><div className="text-muted small text-capitalize">{String(c.component_type || "").replaceAll("_", " ")}</div></td><td>{c.attendance_status === "absent" ? <span className="badge text-bg-danger">Absent</span> : `${c.marks_obtained ?? "—"} / ${c.max_marks}`}</td><td>{c.weightage_percent}%</td><td>{r.result_status === "passed" ? <span className="badge text-bg-success">Passed</span> : <span className="badge text-bg-danger">{String(r.result_status || "").replaceAll("_", " ")}</span>}</td></tr>)}
      </tbody></table></div>
    </section></div>)}
  </div>;
}

function StaffExamination() {
  const [sessions, setSessions] = useState([]); const [classes, setClasses] = useState([]); const [sections, setSections] = useState([]);
  const [sessionId, setSessionId] = useState(""); const [classId, setClassId] = useState(""); const [sectionId, setSectionId] = useState(""); const [subjectId, setSubjectId] = useState("");
  const [offerings, setOfferings] = useState([]); const [structure, setStructure] = useState(null); const [students, setStudents] = useState([]); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false); const [resultName, setResultName] = useState("Semester Result"); const [passPercent, setPassPercent] = useState(40); const [components, setComponents] = useState(DEFAULT_COMPONENTS);
  const [markState, setMarkState] = useState({});

  useEffect(() => {
    Promise.all([api.get("/sessions"), api.get("/classes?withSections=true"), api.get("/sections")]).then(([s,c,sec]) => {
      const ss = rowsFrom(s.data, "sessions"); setSessions(ss); setClasses(rowsFrom(c.data, "classes")); setSections(rowsFrom(sec.data, "sections"));
      const active = ss.find((x) => x.is_active); if (active) setSessionId(String(active.id));
    }).catch(() => {});
  }, []);

  const loadSetup = useCallback(async (sid = sessionId, cid = classId, subid = subjectId) => {
    if (!sid || !cid) { setOfferings([]); setStudents([]); setStructure(null); return; }
    setLoading(true);
    try {
      const params = { session_id: sid, class_id: cid, ...(sectionId ? { section_id: sectionId } : {}), ...(subid ? { subject_id: subid } : {}) };
      const { data } = await api.get("/college-examinations/setup", { params });
      setOfferings(data.offerings || []); setStructure(data.structure || null); setStudents(data.students || []);
      if (data.structure) {
        setResultName(data.structure.result_name || "Semester Result"); setPassPercent(n(data.structure.minimum_overall_percent) || 40);
        setComponents((data.structure.components || []).map((x) => ({ id: x.id, name: x.name, component_type: x.component_type, max_marks: n(x.max_marks), weightage_percent: n(x.weightage_percent), minimum_pass_marks: x.minimum_pass_marks == null ? "" : n(x.minimum_pass_marks), must_pass: !!x.must_pass })));
        const next = {};
        (data.students || []).forEach((student) => { next[student.id] = {}; (student.marks || []).forEach((m) => { next[student.id][m.component_id] = { marks_obtained: m.marks_obtained ?? "", attendance_status: m.attendance_status || "present" }; }); });
        setMarkState(next);
      } else {
        setComponents(DEFAULT_COMPONENTS); setResultName("Semester Result"); setPassPercent(40); setMarkState({});
      }
    } catch (e) { Swal.fire("Unable to load", e?.response?.data?.message || e.message, "error"); }
    finally { setLoading(false); }
  }, [sessionId, classId, sectionId, subjectId]);

  useEffect(() => { if (sessionId && classId) loadSetup(sessionId, classId, ""); }, [sessionId, classId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sessionId && classId && subjectId) loadSetup(); }, [subjectId, sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredSections = useMemo(() => sections.filter((x) => n(x.class_id ?? x.classId) === n(classId)), [sections, classId]);
  const totalWeight = components.reduce((sum, x) => sum + n(x.weightage_percent), 0);
  const setComponent = (index, key, value) => setComponents((current) => current.map((x,i) => i === index ? { ...x, [key]: value } : x));
  const addComponent = () => setComponents((x) => [...x, { name: "", component_type: "other", max_marks: 20, weightage_percent: 20, minimum_pass_marks: "", must_pass: false }]);
  const removeComponent = (index) => setComponents((x) => x.filter((_,i) => i !== index));

  const saveStructure = async () => {
    setSaving(true);
    try {
      await api.put("/college-examinations/structure", { session_id: n(sessionId), class_id: n(classId), subject_id: n(subjectId), result_name: resultName, minimum_overall_percent: n(passPercent), components });
      await Swal.fire("Saved", "Internal / external examination structure saved.", "success"); setConfigOpen(false); await loadSetup();
    } catch (e) { Swal.fire("Unable to save", e?.response?.data?.message || e.message, "error"); }
    finally { setSaving(false); }
  };

  const setMark = (studentId, componentId, key, value) => setMarkState((current) => ({ ...current, [studentId]: { ...(current[studentId] || {}), [componentId]: { ...(current[studentId]?.[componentId] || { attendance_status: "present", marks_obtained: "" }), [key]: value } } }));
  const preview = (studentId) => {
    let percent = 0; let complete = true; let failed = false; let absent = false;
    components.forEach((c) => { const m = markState[studentId]?.[c.id] || {}; const isAbsent = m.attendance_status === "absent"; const val = isAbsent ? 0 : (m.marks_obtained === "" || m.marks_obtained == null ? null : n(m.marks_obtained)); if (val == null && !isAbsent) complete = false; if (c.must_pass && isAbsent) absent = true; if (c.must_pass && c.minimum_pass_marks !== "" && val != null && val < n(c.minimum_pass_marks)) failed = true; if (val != null && n(c.max_marks) > 0) percent += (val / n(c.max_marks)) * n(c.weightage_percent); });
    if (!complete) return { text: "Incomplete", cls: "secondary" }; if (absent) return { text: "Absent", cls: "danger" }; if (failed || percent < n(passPercent)) return { text: `${f2(percent)}% · Fail`, cls: "danger" }; return { text: `${f2(percent)}% · Pass`, cls: "success" };
  };

  const saveMarks = async (publish) => {
    if (!structure) return Swal.fire("Configure first", "Save the examination structure before entering marks.", "info");
    setSaving(true);
    try {
      const rows = students.map((student) => ({ student_id: student.id, marks: (structure.components || []).map((c) => ({ component_id: c.id, marks_obtained: markState[student.id]?.[c.id]?.marks_obtained ?? "", attendance_status: markState[student.id]?.[c.id]?.attendance_status || "present" })) }));
      const { data } = await api.post("/college-examinations/marks/bulk", { structure_id: structure.id, section_id: sectionId ? n(sectionId) : null, publish, rows });
      await Swal.fire(publish ? "Published" : "Saved", data.message, "success"); await loadSetup();
    } catch (e) { Swal.fire("Unable to save", e?.response?.data?.message || e.message, "error"); }
    finally { setSaving(false); }
  };

  return <>
    <section className="ce-filter-card mb-3"><div className="row g-3 align-items-end">
      <div className="col-md-3"><label>Academic Year</label><select className="form-select" value={sessionId} onChange={(e) => { setSessionId(e.target.value); setSubjectId(""); }}><option value="">Select</option>{sessions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div className="col-md-3"><label>Program / Semester</label><select className="form-select" value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(""); setSubjectId(""); }}><option value="">Select</option>{classes.map((x) => <option key={x.id} value={x.id}>{x.class_name || x.name}</option>)}</select></div>
      <div className="col-md-2"><label>Batch / Section</label><select className="form-select" value={sectionId} onChange={(e) => setSectionId(e.target.value)}><option value="">All / Class level</option>{filteredSections.map((x) => <option key={x.id} value={x.id}>{x.section_name || x.name}</option>)}</select></div>
      <div className="col-md-3"><label>Paper / Subject</label><select className="form-select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}><option value="">Select</option>{offerings.map((x) => <option key={x.id} value={x.subject_id}>{x.subject?.name || `Subject ${x.subject_id}`}</option>)}</select></div>
      <div className="col-md-1 d-grid"><button className="btn btn-outline-primary" disabled={!subjectId} onClick={() => setConfigOpen(true)} title="Configure"><i className="bi bi-sliders" /></button></div>
    </div></section>

    {configOpen && <section className="ce-card mb-3"><div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><span className="ce-kicker">Result Structure</span><h2>Internal + External Components</h2><p>Raw marks can be scaled to any final weightage. Total weightage must equal 100%.</p></div><button className="btn-close" onClick={() => setConfigOpen(false)} /></div>
      <div className="row g-3 mb-3"><div className="col-md-6"><label>Result Name</label><input className="form-control" value={resultName} onChange={(e) => setResultName(e.target.value)} /></div><div className="col-md-3"><label>Overall Pass %</label><input type="number" className="form-control" value={passPercent} onChange={(e) => setPassPercent(e.target.value)} /></div><div className="col-md-3"><label>Total Weightage</label><div className={`ce-weight ${Math.abs(totalWeight - 100) < .01 ? "ok" : "bad"}`}>{f2(totalWeight)}%</div></div></div>
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Component</th><th>Type</th><th>Max Marks</th><th>Weight %</th><th>Min Pass</th><th>Must Pass</th><th /></tr></thead><tbody>{components.map((c,i) => <tr key={c.id || i}><td><input className="form-control" value={c.name} onChange={(e) => setComponent(i,"name",e.target.value)} /></td><td><select className="form-select" value={c.component_type} onChange={(e) => setComponent(i,"component_type",e.target.value)}><option value="internal">Internal</option><option value="external">External / University</option><option value="practical">Practical / Lab</option><option value="viva">Viva</option><option value="assignment">Assignment</option><option value="project">Project</option><option value="attendance">Attendance</option><option value="other">Other</option></select></td><td><input type="number" className="form-control" value={c.max_marks} onChange={(e) => setComponent(i,"max_marks",e.target.value)} /></td><td><input type="number" className="form-control" value={c.weightage_percent} onChange={(e) => setComponent(i,"weightage_percent",e.target.value)} /></td><td><input type="number" className="form-control" value={c.minimum_pass_marks} onChange={(e) => setComponent(i,"minimum_pass_marks",e.target.value)} /></td><td className="text-center"><input type="checkbox" className="form-check-input" checked={!!c.must_pass} onChange={(e) => setComponent(i,"must_pass",e.target.checked)} /></td><td><button className="btn btn-sm btn-outline-danger" onClick={() => removeComponent(i)}><i className="bi bi-trash" /></button></td></tr>)}</tbody></table></div>
      <div className="d-flex justify-content-between"><button className="btn btn-outline-primary" onClick={addComponent}><i className="bi bi-plus-lg me-1" />Add Component</button><button className="btn btn-primary" disabled={saving || !subjectId || Math.abs(totalWeight - 100) > .01} onClick={saveStructure}>{saving ? "Saving…" : "Save Structure"}</button></div>
    </section>}

    {loading && <div className="ce-loading"><div className="spinner-border text-primary" /> Loading…</div>}
    {!loading && subjectId && !structure && <div className="alert alert-warning rounded-4">This paper has no examination structure yet. Click the settings button and configure Internal / External components.</div>}
    {!loading && structure && <section className="ce-card"><div className="ce-card-title"><div><span className="ce-kicker">Marks Entry</span><h2>{structure.result_name}</h2><p>{structure.components?.map((x) => `${x.name} ${n(x.weightage_percent)}%`).join(" · ")}</p></div><span className="badge text-bg-light border">Pass: {n(structure.minimum_overall_percent)}%</span></div>
      <div className="table-responsive"><table className="table table-hover align-middle ce-marks-table"><thead><tr><th>Student</th>{(structure.components || []).map((c) => <th key={c.id}>{c.name}<small>{n(c.max_marks)} marks · {n(c.weightage_percent)}%</small></th>)}<th>Preview</th></tr></thead><tbody>{students.map((student) => { const pv = preview(student.id); return <tr key={student.id}><td className="ce-student"><strong>{student.name}</strong><small>{student.admission_number}{student.roll_number ? ` · Roll ${student.roll_number}` : ""}</small></td>{(structure.components || []).map((c) => { const m = markState[student.id]?.[c.id] || { marks_obtained: "", attendance_status: "present" }; return <td key={c.id}><div className="ce-mark-input"><input type="number" min="0" max={n(c.max_marks)} className="form-control form-control-sm" disabled={m.attendance_status === "absent"} value={m.marks_obtained} onChange={(e) => setMark(student.id,c.id,"marks_obtained",e.target.value)} /><select className="form-select form-select-sm" value={m.attendance_status} onChange={(e) => setMark(student.id,c.id,"attendance_status",e.target.value)}><option value="present">P</option><option value="absent">A</option></select></div></td>})}<td><span className={`badge text-bg-${pv.cls}`}>{pv.text}</span></td></tr>; })}</tbody></table></div>
      <div className="ce-actions"><div className="text-muted small">Publish updates the final grade and recalculates Credits / SGPA / CGPA automatically.</div><div className="d-flex gap-2"><button className="btn btn-outline-primary" disabled={saving || !students.length} onClick={() => saveMarks(false)}>Save Draft</button><button className="btn btn-success" disabled={saving || !students.length} onClick={() => saveMarks(true)}><i className="bi bi-check2-circle me-1" />Publish Result</button></div></div>
    </section>}
  </>;
}

export default function CollegeExamination() {
  const { isCollege } = useInstitution();
  const userRoles = roles(); const staff = userRoles.some((x) => STAFF.has(x)); const student = userRoles.includes("student");
  if (!isCollege) return <div className="alert alert-info">Internal / External Examination is available in College mode.</div>;
  return <div className="container-fluid py-3 ce-page"><div className="ce-page-head"><div><span className="ce-kicker">College Academics</span><h1>Internal + External Examination</h1><p>Configure assessment components, enter marks and publish final grades directly into SGPA / CGPA.</p></div><div className="ce-head-icon"><i className="bi bi-journal-check" /></div></div>{student && !staff ? <StudentResults /> : <StaffExamination />}</div>;
}
