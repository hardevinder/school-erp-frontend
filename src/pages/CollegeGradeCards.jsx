import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import { useBranch } from "../branch/BranchContext";
import "./CollegeGradeCards.css";

const STAFF = new Set(["examination", "department_hod", "principal", "academic_coordinator", "coordinator", "admin", "superadmin", "super_admin"]);
const roles = () => { try { const a=JSON.parse(localStorage.getItem("roles")||"[]"); const one=localStorage.getItem("userRole")||localStorage.getItem("role"); return (a.length?a:[one]).filter(Boolean).map(x=>String(x).toLowerCase()); } catch { return []; } };
const fmt = (v) => Number(v || 0).toFixed(2);
const credits = (v) => Number(v || 0).toFixed(Number(v || 0) % 1 ? 1 : 0);
const rowsFrom = (data, key) => Array.isArray(data) ? data : (Array.isArray(data?.[key]) ? data[key] : []);

async function downloadBlob(url, params, fallbackName) {
  const response = await api.get(url, { params, responseType: "blob" });
  const cd = response.headers?.["content-disposition"] || "";
  const match = cd.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i);
  const name = match ? decodeURIComponent(match[1].replace(/\"/g, "")) : fallbackName;
  const link = document.createElement("a"); link.href = URL.createObjectURL(response.data); link.download = name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

function Status({ value }) { const s=String(value||"").toUpperCase(); const cls=s==="PASS"?"success":s==="REAPPEAR"?"warning":"secondary"; return <span className={`badge text-bg-${cls}`}>{s||"—"}</span>; }

function StudentHeader({ data }) {
  const s=data?.student||{}; const i=s.identity||{};
  return <div className="cgc-student-grid">
    <div><span>Student</span><strong>{s.name||"—"}</strong></div><div><span>Admission No.</span><strong>{s.admission_number||"—"}</strong></div>
    <div><span>University Roll No.</span><strong>{i.university_roll_number||s.roll_number||"—"}</strong></div><div><span>Enrollment No.</span><strong>{i.enrollment_number||"—"}</strong></div>
    <div><span>University Reg. No.</span><strong>{i.university_registration_number||"—"}</strong></div><div><span>Batch / Section</span><strong>{s.section_name||"—"}</strong></div>
  </div>;
}

function GradeCardPreview({ data }) {
  const g=data?.grade_card; if(!g) return null;
  const componentNames=[]; (g.subjects||[]).forEach(s=>(s.components||[]).forEach(c=>{if(!componentNames.includes(c.name))componentNames.push(c.name)}));
  return <section className="cgc-sheet">
    <div className="cgc-sheet-head"><div><small>{data?.institution?.name}</small><h2>{g.result_name||"Semester Grade Card"}</h2><p>{g.program_semester} · {g.academic_year}</p></div><Status value={g.result_status}/></div>
    <StudentHeader data={data}/>
    <div className="table-responsive"><table className="table cgc-table align-middle"><thead><tr><th>Paper / Subject</th><th>Cr.</th>{componentNames.map(n=><th key={n}>{n}</th>)}<th>%</th><th>Grade</th><th>GP</th><th>Credit Pts</th><th>Status</th></tr></thead><tbody>
      {(g.subjects||[]).map(s=>{const map=new Map((s.components||[]).map(c=>[c.name,c]));return <tr key={s.id}><td><strong>{s.subject?.name||s.subject_name||`Subject ${s.subject_id}`}</strong></td><td>{credits(s.credits)}</td>{componentNames.map(n=>{const c=map.get(n);return <td key={n}>{c?(c.attendance_status==="absent"?"AB":`${c.marks_obtained??"—"}/${c.max_marks??"—"}`):"—"}</td>})}<td>{s.percentage==null?"—":fmt(s.percentage)}</td><td><span className="cgc-grade">{s.letter_grade||"—"}</span></td><td>{fmt(s.grade_point)}</td><td>{fmt(s.credit_points)}</td><td className="text-capitalize">{String(s.result_status||"").replaceAll("_"," ")}</td></tr>})}
    </tbody></table></div>
    <div className="cgc-summary"><div><span>Credits Earned</span><strong>{credits(g.earned_credits)}</strong></div><div><span>Attempted</span><strong>{credits(g.attempted_credits)}</strong></div><div><span>SGPA</span><strong>{fmt(g.sgpa)}</strong></div><div><span>Result</span><Status value={g.result_status}/></div></div>
    <div className="cgc-ref">Document Ref: <strong>{data.document_ref}</strong></div>
  </section>;
}

function TranscriptPreview({ data }) {
  const t=data?.transcript; if(!t) return null;
  return <section className="cgc-sheet">
    <div className="cgc-sheet-head"><div><small>{data?.institution?.name}</small><h2>Consolidated Academic Transcript</h2><p>Complete published semester record</p></div><Status value={t.overall_result}/></div>
    <StudentHeader data={data}/>
    {(t.semesters||[]).map(sem=><div className="cgc-semester" key={`${sem.session_id}-${sem.class_id}`}><div className="d-flex justify-content-between align-items-center gap-2 mb-2"><div><h3>{sem.program_semester}</h3><small>{sem.academic_year}</small></div><div className="text-end"><b>SGPA {fmt(sem.sgpa)}</b><br/><Status value={sem.result_status}/></div></div><div className="table-responsive"><table className="table cgc-table"><thead><tr><th>Paper / Subject</th><th>Credits</th><th>%</th><th>Grade</th><th>GP</th><th>Credit Points</th><th>Status</th></tr></thead><tbody>{(sem.subjects||[]).map(s=><tr key={s.id}><td>{s.subject_name}</td><td>{credits(s.credits)}</td><td>{s.percentage==null?"—":fmt(s.percentage)}</td><td>{s.letter_grade||"—"}</td><td>{fmt(s.grade_point)}</td><td>{fmt(s.credit_points)}</td><td className="text-capitalize">{s.result_status}</td></tr>)}</tbody></table></div></div>)}
    <div className="cgc-summary"><div><span>Attempted Credits</span><strong>{credits(t.attempted_credits)}</strong></div><div><span>Earned Credits</span><strong>{credits(t.earned_credits)}</strong></div><div><span>CGPA</span><strong>{fmt(t.cgpa)}</strong></div><div><span>Overall</span><Status value={t.overall_result}/></div></div>
    <div className="cgc-ref">Document Ref: <strong>{data.document_ref}</strong></div>
  </section>;
}

function StudentView() {
  const [transcript,setTranscript]=useState(null); const [grade,setGrade]=useState(null); const [selected,setSelected]=useState(""); const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{setLoading(true);try{const {data}=await api.get("/college-grade-cards/my-transcript");setTranscript(data);const sems=data?.transcript?.semesters||[];if(sems.length)setSelected(`${sems[sems.length-1].session_id}:${sems[sems.length-1].class_id}`)}catch(e){Swal.fire("Unable to load",e?.response?.data?.message||e.message,"error")}finally{setLoading(false)}},[]);
  useEffect(()=>{load()},[load]);
  const openSemester=async()=>{if(!selected)return;const [session_id,class_id]=selected.split(":");setBusy(true);try{const {data}=await api.get("/college-grade-cards/my",{params:{session_id,class_id}});setGrade(data)}catch(e){Swal.fire("Unable to load grade card",e?.response?.data?.message||e.message,"error")}finally{setBusy(false)}};
  useEffect(()=>{if(selected)openSemester()},[selected]); // eslint-disable-line react-hooks/exhaustive-deps
  if(loading)return <div className="p-5 text-center"><span className="spinner-border spinner-border-sm me-2"/>Loading academic documents…</div>;
  const sems=transcript?.transcript?.semesters||[];
  return <><div className="cgc-toolbar"><div className="flex-grow-1"><label>Semester Grade Card</label><select className="form-select" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select semester</option>{sems.map(s=><option key={`${s.session_id}:${s.class_id}`} value={`${s.session_id}:${s.class_id}`}>{s.program_semester} · {s.academic_year}</option>)}</select></div><button className="btn btn-outline-primary" disabled={!selected||busy} onClick={async()=>{const [session_id,class_id]=selected.split(":");await downloadBlob("/college-grade-cards/my-pdf",{type:"gradecard",session_id,class_id},"Grade-Card.pdf")}}><i className="bi bi-file-earmark-pdf me-1"/>Download Grade Card</button><button className="btn btn-primary" onClick={()=>downloadBlob("/college-grade-cards/my-pdf",{type:"transcript"},"Transcript.pdf")}><i className="bi bi-download me-1"/>Download Transcript</button></div>{grade&&<GradeCardPreview data={grade}/>}<div className="mt-4"><TranscriptPreview data={transcript}/></div>{!sems.length&&<div className="alert alert-info">Grade cards will appear after semester results are published.</div>}</>;
}

function StaffView() {
  const [setup,setSetup]=useState({sessions:[],classes:[],sections:[],students:[]}); const [sessionId,setSessionId]=useState(""); const [classId,setClassId]=useState(""); const [sectionId,setSectionId]=useState(""); const [studentId,setStudentId]=useState(""); const [data,setData]=useState(null); const [mode,setMode]=useState("gradecard"); const [loading,setLoading]=useState(false);
  const loadSetup=useCallback(async()=>{try{const {data:d}=await api.get("/college-grade-cards/setup",{params:{session_id:sessionId||undefined,class_id:classId||undefined,section_id:sectionId||undefined}});setSetup(d||{});if(!sessionId){const a=(d.sessions||[]).find(x=>x.is_active);if(a)setSessionId(String(a.id))}}catch(e){Swal.fire("Unable to load",e?.response?.data?.message||e.message,"error")}},[sessionId,classId,sectionId]); useEffect(()=>{loadSetup()},[loadSetup]);
  const sections=useMemo(()=>rowsFrom(setup,"sections").filter(s=>!classId||Number(s.class_id)===Number(classId)),[setup,classId]);
  const students=rowsFrom(setup,"students");
  const preview=async(type=mode)=>{if(!studentId)return Swal.fire("Select student","Choose a student first.","info");if(type==="gradecard"&&(!sessionId||!classId))return Swal.fire("Select semester","Academic Year and Program / Semester are required.","info");setLoading(true);try{const url=type==="transcript"?`/college-grade-cards/student/${studentId}/transcript`:`/college-grade-cards/student/${studentId}`;const {data:d}=await api.get(url,{params:type==="gradecard"?{session_id:sessionId,class_id:classId}:{}});setData(d);setMode(type)}catch(e){Swal.fire("Unable to load document",e?.response?.data?.message||e.message,"error")}finally{setLoading(false)}};
  const download=async(type)=>{if(!studentId)return;const params=type==="transcript"?{type}:{type,session_id:sessionId,class_id:classId};await downloadBlob(`/college-grade-cards/student/${studentId}/pdf`,params,type==="transcript"?"Transcript.pdf":"Grade-Card.pdf")};
  return <><div className="cgc-filter card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-3"><div className="col-md-3"><label>Academic Year</label><select className="form-select" value={sessionId} onChange={e=>{setSessionId(e.target.value);setStudentId("");setData(null)}}><option value="">Select</option>{rowsFrom(setup,"sessions").map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div><div className="col-md-3"><label>Program / Semester</label><select className="form-select" value={classId} onChange={e=>{setClassId(e.target.value);setSectionId("");setStudentId("");setData(null)}}><option value="">Select</option>{rowsFrom(setup,"classes").map(x=><option key={x.id} value={x.id}>{x.class_name}</option>)}</select></div><div className="col-md-2"><label>Batch / Section</label><select className="form-select" value={sectionId} onChange={e=>{setSectionId(e.target.value);setStudentId("");setData(null)}}><option value="">All</option>{sections.map(x=><option key={x.id} value={x.id}>{x.section_name}</option>)}</select></div><div className="col-md-4"><label>Student</label><select className="form-select" value={studentId} onChange={e=>{setStudentId(e.target.value);setData(null)}}><option value="">Select student</option>{students.map(x=><option key={x.id} value={x.id}>{x.name} · {x.admission_number}</option>)}</select></div></div><div className="d-flex flex-wrap gap-2 mt-3"><button className="btn btn-primary" disabled={loading} onClick={()=>preview("gradecard")}><i className="bi bi-card-checklist me-1"/>Preview Grade Card</button><button className="btn btn-outline-primary" disabled={loading} onClick={()=>preview("transcript")}><i className="bi bi-journal-text me-1"/>Preview Transcript</button>{data&&<button className="btn btn-outline-danger ms-md-auto" onClick={()=>download(mode)}><i className="bi bi-file-earmark-pdf me-1"/>Download PDF</button>}</div></div></div>{loading&&<div className="p-4 text-center"><span className="spinner-border spinner-border-sm me-2"/>Preparing document…</div>}{data&&(mode==="transcript"?<TranscriptPreview data={data}/>:<GradeCardPreview data={data}/>)}</>;
}

export default function CollegeGradeCards(){const {isCollege}=useInstitution();const {allBranches}=useBranch();const r=useMemo(roles,[]);const student=r.includes("student");const staff=r.some(x=>STAFF.has(x));if(!isCollege)return <div className="container-fluid py-4"><div className="alert alert-info">Grade Card / Transcript is available in College mode.</div></div>;if(!student&&!staff)return <div className="container-fluid py-4"><div className="alert alert-warning">You do not have access.</div></div>;return <main className="cgc-page container-fluid py-4 px-3 px-md-4"><div className="cgc-hero mb-4"><div><span>College Academics</span><h1>Grade Card · Transcript</h1><p>Official semester grade cards and consolidated academic transcript from published results, credits and SGPA/CGPA.</p></div><i className="bi bi-file-earmark-bar-graph-fill"/></div>{allBranches&&staff&&<div className="alert alert-info">All Branches view is allowed for document lookup. Select a campus if students share duplicate admission numbering across campuses.</div>}{student?<StudentView/>:<StaffView/>}</main>}
