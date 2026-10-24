import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import { getExternalExamComparisons } from "../components/StudentExamComparison";
import "./StudentPerformanceAnalytics.css";
import { printStudentLandscapePDF, printAllStudentsLandscapePDF } from "./StudentLandscapePDF";

const EXAMS = ["PT-1", "PT-2", "HY"];
const COLORS = { "PT-1": "#3987f5", "PT-2": "#29b486", HY: "#ff9748" };
const fmt = n => Number.isInteger(n) ? String(n) : Number(n).toFixed(1);
const first = (obj, fields, fallback = "—") => fields.map(k => obj?.[k]).find(v => v !== undefined && v !== null && String(v).trim() !== "") ?? fallback;
const listFrom = (data, name) => Array.isArray(data) ? data : Array.isArray(data?.[name]) ? data[name] : [];
const scoreChange = s => {
  const found = EXAMS.filter(k => Number.isFinite(s.scores[k]?.percent));
  if (found.length < 2) return null;
  return { from: found[0], to: found[found.length - 1], delta: s.scores[found[found.length - 1]].percent - s.scores[found[0]].percent };
};
const photoCandidate = s => first(s, ["photo_url", "photoUrl", "student_photo_url", "studentPhotoUrl", "photo", "Photo", "student_photo", "profile_photo", "image", "photo_path"], "");
const photoUrl = student => {
  const raw = String(photoCandidate(student) || "").trim();
  if (!raw || /^(null|undefined|n\/a)$/i.test(raw)) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  const origin = String(api.defaults?.baseURL || window.location.origin).replace(/\/api\/?$/i, "").replace(/\/$/, "");
  const path = raw.replace(/^\/+/, "");
  return `${origin}/${path.startsWith("uploads/") ? "" : "uploads/photoes/students/"}${path}`;
};
function Portrait({ student, large = false }) {
  const [bad, setBad] = useState(false);
  const src = photoUrl(student);
  useEffect(() => setBad(false), [src]);
  return src && !bad ? <img className={`spa-portrait ${large ? "spa-portrait-lg" : ""}`} src={src} alt={`${student?.name || "Student"} portrait`} onError={() => setBad(true)} /> : <div aria-label="Student photo unavailable" className={`spa-portrait spa-portrait-empty ${large ? "spa-portrait-lg" : ""}`}>👤</div>;
}
function MiniChart({ subject }) {
  const keys = EXAMS.filter(k => subject.scores[k]);
  const change = scoreChange(subject);
  return <article className="spa-subject-card">
    <h3>{subject.name}</h3>
    <div className="spa-chart">
      {keys.map(k => {const s = subject.scores[k]; const pct = s?.percent; return <div className="spa-bar-col" key={k}>
        <span className="spa-mark-label">{pct == null ? "N/A" : `${fmt(s.marks)}/${fmt(s.max)}`}</span>
        <div className="spa-bar-track"><div className="spa-bar" style={{height:`${pct == null ? 0 : Math.min(100,Math.max(0,pct))}%`,background:COLORS[k]}} title={`${k}: ${pct == null ? "Not entered" : `${fmt(pct)}%`}`}/></div>
        <span className="spa-bar-name">{k}</span><strong>{pct == null ? "—" : `${fmt(pct)}%`}</strong>
      </div>})}
    </div>
    <p className={`spa-delta ${change?.delta > 0 ? "up" : change?.delta < 0 ? "down" : "neutral"}`}>{!change ? "Not enough assessments to compare" : `${change.delta > 0 ? "▲ +" : change.delta < 0 ? "▼ " : "="}${fmt(change.delta)} pp · ${change.from} → ${change.to}`}</p>
  </article>;
}
function StudentDetail({ student, meta, close }) {
  const subjects = useMemo(() => getExternalExamComparisons(student), [student]);
  const changes = subjects.map(scoreChange).filter(Boolean).map(c => c.delta);
  const avg = changes.length ? changes.reduce((a,b) => a+b,0)/changes.length : null;
  const improved = changes.filter(n => n > 0).length;
  const declined = changes.filter(n => n < 0).length;
  const columns = EXAMS.filter(k => subjects.some(s => s.scores[k]));
  useEffect(() => {const key = e => {if (e.key === "Escape") close()}; window.addEventListener("keydown", key); const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => {window.removeEventListener("keydown",key); document.body.style.overflow = overflow};}, [close]);
  return <div className="spa-overlay" role="presentation" onMouseDown={e => {if(e.target === e.currentTarget)close()}}>
    <section className="spa-dialog" role="dialog" aria-modal="true" aria-label={`${student.name} performance`}>
      <button className="spa-close" onClick={close} aria-label="Close student performance">✕</button>
      <div className="spa-pdf-toolbar"><span className="spa-pdf-toolbar-title">Student Performance Report <small>· A4 Landscape</small></span><button type="button" className="spa-pdf-download" onClick={() => printStudentLandscapePDF(student, meta, api.defaults?.baseURL)} aria-label="Print or save student report as A4 landscape PDF">🖨 Print / Save A4 PDF</button></div>
      <div className="spa-student-header"><Portrait student={student} large/><div className="spa-student-text">
        <h2>{student.name}</h2><p>Roll No: <strong>{first(student,["roll_number","roll_no"])}</strong> · Class: <strong>{meta.className}</strong> · Section: <strong>{meta.sectionName}</strong></p>
        <p>Admission No: {first(student,["admission_number","admission_no","admissionNumber"])}</p>
        <p>Father's Name: {first(student,["father_name","fatherName","fathers_name"])}</p>
      </div><div className="spa-metrics"><div className="spa-metric spa-blue"><span>Average change</span><strong>{avg == null ? "N/A" : `${avg > 0 ? "+" : ""}${fmt(avg)} pp`}</strong></div><div className="spa-metric spa-green"><span>Subjects improved</span><strong>{improved} / {changes.length}</strong></div><div className="spa-metric spa-red"><span>Subjects declined</span><strong>{declined} / {changes.length}</strong></div></div></div>
      <div className="spa-body"><div className="spa-detail-title"><h2>Subject-wise Performance Comparison <small>(External Marks Only)</small></h2><div className="spa-legend">{columns.map(k => <span key={k}><i style={{background:COLORS[k]}}/>{k}</span>)}</div></div>
      <p className="spa-hint">Marks are compared as percentages of each exam's actual maximum. Grouped PT-1 and PT-2 are shown separately. Unavailable assessments are hidden for each subject.</p>
      {subjects.length ? <><div className="spa-subject-grid">{subjects.map(s => <MiniChart key={s.id} subject={s}/>)}</div><div className="spa-table-wrap"><table className="spa-table"><thead><tr><th>Subject</th>{columns.map(k => <th key={k}>{k} (marks / %)</th>)}<th>Change</th></tr></thead><tbody>{subjects.map(s => { const c = scoreChange(s); return <tr key={s.id}><th>{s.name}</th>{columns.map(k => {const v = s.scores[k];return <td key={k}>{v?.percent == null ? "—" : `${fmt(v.marks)}/${fmt(v.max)} · ${fmt(v.percent)}%`}</td>})}<td className={c?.delta > 0 ? "up" : c?.delta < 0 ? "down" : ""}>{c ? `${c.delta > 0 ? "+" : ""}${fmt(c.delta)} pp` : "—"}</td></tr>})}</tbody></table></div></> : <div className="spa-empty">No external PT/HY marks found for this student in the selected exam(s).</div>}
      </div>
    </section>
  </div>;
}
export default function StudentPerformanceAnalytics() {
  const [sessions,setSessions] = useState([]), [classes,setClasses] = useState([]), [sections,setSections] = useState([]), [exams,setExams] = useState([]);
  const [reportScope,setReportScope] = useState({global_access:false,assignments:[]});
  const [filters,setFilters] = useState({session_id:"",class_id:"",section_id:"",exam_ids:[]});
  const [students,setStudents] = useState([]), [focused,setFocused] = useState(null), [query,setQuery] = useState(""), [loading,setLoading] = useState(false), [error,setError] = useState("");
  useEffect(() => {let alive=true; Promise.all([api.get("/sessions"),api.get("/report-card/scope")]).then(([sr,sc])=>{if(!alive)return;const ss=listFrom(sr.data,"sessions");setSessions(ss);setClasses(sc.data?.classes||[]);setSections(sc.data?.sections||[]);setReportScope({global_access:sc.data?.global_access===true,assignments:sc.data?.assignments||[]});setFilters(f=>({...f,session_id:String(ss.find(s=>s.is_active)?.id||ss[0]?.id||"")}));}).catch(()=>{if(alive)setError("Unable to load authorized classes and sessions.")});return()=>{alive=false}},[]);
  useEffect(()=>{if(!filters.session_id){setExams([]);return};let alive=true;api.get("/exams",{params:{session_id:Number(filters.session_id)}}).then(r=>{if(alive)setExams(listFrom(r.data,"exams"))}).catch(()=>{if(alive)setExams([])});return()=>{alive=false}},[filters.session_id]);
  // /report-card/scope returns sections as {id, section_name}, without class_id.
  // Match the existing ReportCardGenerator scope/assignment filtering.
  const scopedSections = !filters.class_id ? [] : sections.filter(s =>
    reportScope.global_access || reportScope.assignments.some(a =>
      String(a.classId ?? a.class_id) === String(filters.class_id) &&
      String(a.sectionId ?? a.section_id) === String(s.id)
    )
  );
  const activeExams = exams.filter(e=>filters.exam_ids.includes(Number(e.id)));
  const meta = {className:first(classes.find(c=>String(c.id)===filters.class_id),["name","class_name"],"—"),sectionName:first(sections.find(c=>String(c.id)===filters.section_id),["name","section_name"],"—")};
  const load = async () => {
    if(!filters.session_id||!filters.class_id||!filters.section_id||!filters.exam_ids.length){setError("Select session, class, section and at least one examination.");return;}
    setLoading(true);setError("");setStudents([]);setFocused(null);
    try {
      // Build the payload from the same class subjects used by Report Card Generator.
      // IMPORTANT: detailed-summary requires nonempty subjectComponents or subject_ids.
      const payload = {
        session_id: Number(filters.session_id),
        class_id: Number(filters.class_id),
        section_id: Number(filters.section_id),
        exam_ids: filters.exam_ids.map(Number).filter(Number.isFinite),
        sum: true,
        showSubjectTotals: true,
        includeGrades: true,
      };
      const subjectsResponse = await api.get("/subjects", {
        params: { class_id: payload.class_id, session_id: payload.session_id },
      });
      const subjectPayload = subjectsResponse.data;
      const availableSubjects = Array.isArray(subjectPayload?.subjects) ? subjectPayload.subjects
        : Array.isArray(subjectPayload?.data?.subjects) ? subjectPayload.data.subjects
        : Array.isArray(subjectPayload?.data) ? subjectPayload.data
        : Array.isArray(subjectPayload) ? subjectPayload : [];
      const subjectIds = [...new Set(availableSubjects
        .map(subject => Number(subject?.id ?? subject?.subject_id ?? subject?.subjectId))
        .filter(id => Number.isInteger(id) && id > 0))];
      if (!subjectIds.length) {
        console.error("[SMCIS Analytics] Unexpected /subjects response:", subjectPayload);
        throw new Error("No class subjects found from /subjects. Check browser console for the API response.");
      }
      // Class ID 0 is valid; validate the numeric ID instead of its truthiness.
      if (!Number.isInteger(payload.class_id) || payload.class_id < 0 || !payload.section_id || !payload.exam_ids.length) {
        throw new Error("Select a valid class, section, and examination.");
      }
      payload.subject_ids = subjectIds;
      // Explicit form is also supported by the backend and mirrors Report Card Generator.
      payload.subjectComponents = subjectIds.map(subject_id => ({ subject_id }));
      console.info("[SMCIS Analytics] detailed-summary request:", {
        class_id: payload.class_id, section_id: payload.section_id,
        exam_ids: payload.exam_ids, subject_ids: payload.subject_ids,
      });
      const {data} = await api.post("/report-card/detailed-summary", payload);
      const rows=data?.students||[];
      let info=[];try {const r=await api.get("/report-card/students",{params:{session_id:payload.session_id,class_id:payload.class_id,section_id:payload.section_id,student_ids:rows.map(s=>s.id)}});info=r.data?.students||[]}catch(e){console.warn("Student profile details unavailable",e)}
      // Additional photo fallback used by the existing report-card workflow.
      let fallback=[];try{const r=await api.get("/students/searchByClassAndSection",{params:{session_id:payload.session_id,class_id:payload.class_id,section_id:payload.section_id}});fallback=Array.isArray(r.data)?r.data:r.data?.students||r.data?.data?.students||[]}catch(e){console.warn("Student photo fallback unavailable",e)}
      const byId=new Map(info.map(s=>[String(s.id),s]));const photos=new Map(fallback.map(s=>[String(s.id),s]));
      setStudents(rows.map(s=>({...photos.get(String(s.id)),...byId.get(String(s.id)),...s,components:s.components||[],photo_url:photoCandidate(byId.get(String(s.id)))||photoCandidate(photos.get(String(s.id)))||photoCandidate(s),father_name:first(byId.get(String(s.id)),["father_name","fatherName"],first(photos.get(String(s.id)),["father_name","fatherName"],s.father_name||""))})).sort((a,b)=>Number(a.roll_number||99999)-Number(b.roll_number||99999)));
    }catch(e){setError(e?.response?.data?.message||e?.message||"Could not load performance data. Check exam selection and access permissions.")}
    finally{setLoading(false)};
  };
  const visible=students.filter(s=>`${s.name||""} ${s.roll_number||""} ${s.admission_number||""}`.toLowerCase().includes(query.toLowerCase()));
  const dismiss=useCallback(()=>setFocused(null),[]);
  return <main className="spa-page"><div className="spa-heading"><span className="spa-eyebrow">SMCIS · Academic intelligence</span><h1>Student Performance Analytics</h1><p>Class-wise student directory with individual PT-1, PT-2 & Half-Yearly performance reports.</p></div>
    <div className="spa-filter-card"><div className="spa-filter-grid"><label>Session<select value={filters.session_id} onChange={e=>{setFilters({...filters,session_id:e.target.value,exam_ids:[]});setStudents([])}}><option value="">Select</option>{sessions.map(s=><option key={s.id} value={s.id}>{first(s,["name","session_name","academic_year"])}</option>)}</select></label>
      <label>Class<select value={filters.class_id} onChange={e=>{setFilters({...filters,class_id:e.target.value,section_id:""});setStudents([])}}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{first(c,["name","class_name"])}</option>)}</select></label>
      <label>Section<select value={filters.section_id} onChange={e=>{setFilters({...filters,section_id:e.target.value});setStudents([])}}><option value="">Select section</option>{scopedSections.map(s=><option key={s.id} value={s.id}>{first(s,["name","section_name"])}</option>)}</select></label>
      <label>Examination(s)<select multiple size={Math.min(4,Math.max(2,exams.length))} value={filters.exam_ids.map(String)} onChange={e=>{setFilters({...filters,exam_ids:Array.from(e.target.selectedOptions).map(o=>Number(o.value))});setStudents([])}}>{exams.map(e=><option key={e.id} value={e.id}>{first(e,["name","exam_name"])}</option>)}</select><small>Ctrl/⌘ + click to select multiple</small></label>
      <button className="spa-load" disabled={loading} onClick={load}>{loading?"Loading…":"View students →"}</button></div>{error&&<div className="spa-error" role="alert">{error}</div>}</div>
    <div className="spa-bulk-actions"><span>One A4 landscape page per student · Complete selected class</span><button type="button" className="spa-bulk-pdf" disabled={loading || !students.length} onClick={() => printAllStudentsLandscapePDF(students, meta, api.defaults?.baseURL)}>🖨 Print / Save All Students PDF ({students.length})</button></div>
    <div className="spa-directory-heading"><div><h2>Class Students <span>{students.length}</span></h2><p>{activeExams.map(e=>first(e,["name","exam_name"])).join(" · ")||"Select exams and load students"}</p></div><input aria-label="Search students" placeholder="Search name, roll or admission number…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
    {!students.length ? <div className="spa-empty">{loading?"Loading student performance…":"Select filters and click View students to open the class directory."}</div> : <div className="spa-directory">{visible.map(s=>{const subs=getExternalExamComparisons(s);const deltas=subs.map(scoreChange).filter(Boolean).map(c=>c.delta);const mean=deltas.length?deltas.reduce((a,b)=>a+b,0)/deltas.length:null;return <button className="spa-student-card" key={s.id} onClick={()=>setFocused(s)}><Portrait student={s}/><div className="spa-student-info"><strong>{s.name}</strong><span>Roll #{first(s,["roll_number","roll_no"])} · Adm. {first(s,["admission_number","admission_no"])}</span><small>{subs.length} subjects · {deltas.filter(n=>n>0).length} improved</small></div><span className={`spa-chip ${mean > 0?"up":mean < 0?"down":""}`}>{mean==null?"View":`${mean>0?"+":""}${fmt(mean)} pp`}</span><span className="spa-arrow">›</span></button>})}{!visible.length&&<div className="spa-empty">No students match your search.</div>}</div>}
    {focused&&<StudentDetail student={focused} meta={meta} close={dismiss}/>}
  </main>;
}
