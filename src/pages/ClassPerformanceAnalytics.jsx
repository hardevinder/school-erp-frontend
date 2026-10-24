import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { getExternalExamComparisons } from '../components/StudentExamComparison';
import './ClassPerformanceAnalytics.css';

const PERIODS = ['PT-1','PT-2','HY'];
const COLORS = {'PT-1':'#3987f5','PT-2':'#26b58a',HY:'#ff9748'};
const nameOf=(o, keys)=>keys.map(k=>o?.[k]).find(v=>v!==undefined&&v!==null&&String(v).trim())||'';
const arr=(x,key)=>Array.isArray(x)?x:Array.isArray(x?.[key])?x[key]:[];
const nice=n=>Number.isFinite(n)?`${Number(n.toFixed(1))}%`:'—';
const avg=xs=>xs.length?xs.reduce((s,n)=>s+n,0)/xs.length:null;
const values=(o)=>PERIODS.filter(k=>Number.isFinite(o?.[k]?.percent));
const delta=o=>{const k=values(o);return k.length>1?o[k[k.length-1]].percent-o[k[0]].percent:null};
const details=s=>getExternalExamComparisons(s);
const scoreForStudent=s=>{const subs=details(s);const out={};PERIODS.forEach(k=>{const scores=subs.map(x=>x.scores[k]?.percent).filter(Number.isFinite);if(scores.length)out[k]={percent:avg(scores)}});return out};
function MiniBars({scores}) {const ks=values(scores);return <div className="cpa-bars">{ks.map(k=><div key={k} className="cpa-bar-item"><strong>{nice(scores[k].percent)}</strong><div className="cpa-bar-track"><div style={{height:`${Math.min(100,Math.max(0,scores[k].percent))}%`,background:COLORS[k]}} /></div><span>{k}</span></div>)}</div>}
function Chart({subjects}){const ks=PERIODS.filter(k=>subjects.some(s=>s.scores[k]));return <div className="cpa-chart"><div className="cpa-legend">{ks.map(k=><span key={k}><i style={{background:COLORS[k]}} />{k}</span>)}</div><div className="cpa-chart-scroll"><div className="cpa-subject-bars">{subjects.map(s=><div className="cpa-subject-col" key={s.id}><MiniBars scores={s.scores}/><b title={s.name}>{s.name}</b></div>)}</div></div></div>}
// Uses the same student-upload convention as ReportCardGenerator.
function assetURL(value, type = 'student') {
  if (!value || typeof value !== 'string') return '';
  let raw = value.trim().replace(/\\/g, '/');
  if (!raw || /^(null|undefined|none|na)$/i.test(raw)) return '';
  if (/^(data:|blob:)/i.test(raw)) return raw;
  const base = String(api.defaults?.baseURL || window.location.origin)
    .replace(/\/api\/?$/, '').replace(/\/$/, '');
  const matched = raw.match(/\/uploads\/(.+)$/i);
  if (matched) raw = 'uploads/' + matched[1];
  else if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replace(/^\/+/, '');
  const path = clean.startsWith('uploads/') ? clean
    : /^(photoes|photos)\//i.test(clean) ? `uploads/${clean}`
    : clean.includes('/') ? clean
    : type === 'student' ? `uploads/photoes/students/${clean}` : `uploads/${clean}`;
  return `${base}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
const studentPhoto = s => assetURL([
  'photo','Photo','student_photo','studentPhoto','Student_Photo',
  'profile_photo','profilePhoto','image','photo_path','photoPath',
  'photo_url','photoUrl','student_photo_url','studentPhotoUrl'
].map(k=>s?.[k]).find(v=>typeof v==='string'&&v.trim()),'student');
function Photo({s}) {
 const [failed,setFailed]=useState(false);const url=studentPhoto(s);
 useEffect(()=>setFailed(false),[url]);
 return url&&!failed?<img className="cpa-avatar" src={url} alt={`${s?.name||'Student'} photograph`} onError={()=>setFailed(true)}/>:<span className="cpa-avatar cpa-avatar-empty">👤</span>;
}
const unwrapList=data=>Array.isArray(data)?data:Array.isArray(data?.data)?data.data:Array.isArray(data?.assignments)?data.assignments:[];
function teacherName(a){return a?.Teacher?.name||a?.teacher?.name||a?.teacher_name||'Not assigned'}
function teacherPhoto(a){
 const t=a?.Teacher||a?.teacher||{};
 const employee=t?.employee||t?.Employee||t?.employeeProfile||{};
 return assetURL(employee.photo_url||t.profilePhoto||t.photo_url||t.photo||a?.teacher_photo,'teacher');
}
function TeacherPhoto({assignment}){
 const [bad,setBad]=useState(false);const src=teacherPhoto(assignment);
 useEffect(()=>setBad(false),[src]);
 return src&&!bad?<img className="cpa-avatar" src={src} alt="Teacher photograph" onError={()=>setBad(true)}/>:<span className="cpa-avatar cpa-avatar-empty">👩‍🏫</span>;
}
function TeachersTable({subjects,assignments,classId,sectionId}){
 const relevant=assignments.filter(a=>String(a.class_id??a.classId??a.Class?.id)===String(classId)&&String(a.section_id??a.sectionId??a.Section?.id)===String(sectionId));
 return <section className="cpa-panel"><h2>Subject-wise Assigned Teachers</h2><p className="cpa-note">Assignments from Class–Subject–Teacher mapping. Academic scores describe the class, not teacher ratings.</p><div className="cpa-table-wrap"><table className="cpa-table"><thead><tr><th>Subject</th><th>Teacher</th>{PERIODS.map(k=><th key={k}>{k} Avg.</th>)}<th>Change</th></tr></thead><tbody>{subjects.map(s=>{
  const a=relevant.find(t=>String(t.subject_id??t.subjectId??t.Subject?.id)===String(s.id))||relevant.find(t=>String(t.Subject?.name||'').trim().toLowerCase()===String(s.name).trim().toLowerCase());
  const d=delta(s.scores);return <tr key={s.id}><td><strong>{s.name}</strong></td><td><div className="cpa-student-cell"><TeacherPhoto assignment={a}/><span><strong>{a?teacherName(a):'Not assigned'}</strong></span></div></td>{PERIODS.map(k=><td key={k}>{nice(s.scores[k]?.percent)}</td>)}<td className={d>0?'cpa-up':d<0?'cpa-down':''}>{d==null?'—':`${d>0?'+':''}${d.toFixed(1)} pp`}</td></tr>})}</tbody></table></div></section>
}
function StudentPopup({student,onClose}) {const subjects=details(student);useEffect(()=>{const h=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)},[onClose]);return <div className="cpa-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="cpa-modal" role="dialog" aria-modal="true" aria-label="Individual student performance"><button className="cpa-close" onClick={onClose}>✕ Close</button><div className="cpa-modal-head"><Photo s={student}/><div><h2>{student.name}</h2><p>Roll #{student.roll_number||'—'} · Admission {student.admission_number||student.admission_no||'—'}</p><p>Father: {student.father_name||'—'}</p></div></div><h3>Subject-wise performance · External marks only</h3><div className="cpa-detail-grid">{subjects.map(s=><div className="cpa-detail-card" key={s.id}><h4>{s.name}</h4><MiniBars scores={s.scores}/><p>Change: {delta(s.scores)==null?'N/A':`${delta(s.scores)>0?'+':''}${delta(s.scores).toFixed(1)} pp`}</p></div>)}</div></div></div>}
export default function ClassPerformanceAnalytics(){
 const [sessions,setSessions]=useState([]),[classes,setClasses]=useState([]),[sections,setSections]=useState([]),[exams,setExams]=useState([]);
 const [teacherAssignments,setTeacherAssignments]=useState([]),[assignmentMessage,setAssignmentMessage]=useState('');
 const [f,setF]=useState({session_id:'',class_id:'',section_id:'',exam_ids:[]});const [rows,setRows]=useState([]),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[selected,setSelected]=useState(null);
 useEffect(()=>{let live=true;Promise.all([api.get('/sessions'),api.get('/report-card/scope')]).then(([a,b])=>{if(!live)return;const ses=arr(a.data,'sessions');setSessions(ses);setClasses(b.data?.classes||[]);setSections(b.data?.sections||[]);setF(x=>({...x,session_id:String(ses.find(v=>v.is_active)?.id||ses[0]?.id||'')}))}).catch(()=>{if(live)setErr('Cannot load session/class permissions.')});return()=>{live=false}},[]);
 useEffect(()=>{if(!f.session_id)return;let live=true;api.get('/exams',{params:{session_id:Number(f.session_id)}}).then(r=>{if(live)setExams(arr(r.data,'exams'))}).catch(()=>{if(live)setExams([])});return()=>{live=false}},[f.session_id]);
 const sectionOptions=sections.filter(s=>!s.class_id&&!s.classId||String(s.class_id||s.classId)===String(f.class_id));
 async function load(){if(!f.session_id||!f.class_id||!f.section_id||!f.exam_ids.length){setErr('Select session, class, section and at least one examination.');return}setBusy(true);setErr('');setRows([]);try{
 const p={session_id:Number(f.session_id),class_id:Number(f.class_id),section_id:Number(f.section_id),exam_ids:f.exam_ids.map(Number),sum:true,showSubjectTotals:true,includeGrades:true};
 const sr=await api.get('/subjects',{params:{class_id:p.class_id,session_id:p.session_id}});const d=sr.data;const subjects=Array.isArray(d?.subjects)?d.subjects:Array.isArray(d?.data?.subjects)?d.data.subjects:Array.isArray(d?.data)?d.data:Array.isArray(d)?d:[];
 const subjectIds=[...new Set(subjects.map(s=>Number(s.id??s.subject_id??s.subjectId)).filter(id=>Number.isInteger(id)&&id>0))];if(!subjectIds.length)throw new Error('No subjects found for selected class.');
 p.subject_ids=subjectIds;p.subjectComponents=subjectIds.map(subject_id=>({subject_id}));const {data}=await api.post('/report-card/detailed-summary',p);let rr=data?.students||[];
 try{const r=await api.get('/report-card/students',{params:{session_id:p.session_id,class_id:p.class_id,section_id:p.section_id,student_ids:rr.map(s=>s.id)}});const m=new Map((r.data?.students||[]).map(s=>[String(s.id),s]));rr=rr.map(s=>{const profile=m.get(String(s.id))||{};const merged={...profile,...s,components:s.components||[]};for(const k of ['photo','Photo','student_photo','studentPhoto','profilePhoto','photo_url','photoUrl','student_photo_url','father_name','admission_number']){if((merged[k]===null||merged[k]===undefined||merged[k]==='')&&profile[k])merged[k]=profile[k]}return merged})}catch(e){console.warn('Optional profile lookup unavailable',e)}setRows(rr);
 // Class–Subject–Teacher assignment endpoint may be restricted to admins.
 try {const ar=await api.get('/class-subject-teachers');setTeacherAssignments(unwrapList(ar.data));setAssignmentMessage('')}
 catch(te){setTeacherAssignments([]);setAssignmentMessage('Teacher assignment data unavailable for this account (check class-subject-teachers permissions).')}
 
 }catch(e){setErr(e?.response?.data?.message||e?.message||'Could not load class results')}finally{setBusy(false)}}
 const analytics=useMemo(()=>{const map=new Map();const all=rows.map(s=>({student:s,scores:scoreForStudent(s)}));for(const s of rows){for(const sub of details(s)){const k=String(sub.id||sub.name);if(!map.has(k))map.set(k,{id:k,name:sub.name,scores:{},entries:{'PT-1':[],'PT-2':[],HY:[]}});const dst=map.get(k);for(const period of PERIODS){const v=sub.scores[period]?.percent;if(Number.isFinite(v))dst.entries[period].push(v)}}}const subjects=[...map.values()].map(s=>({...s,scores:Object.fromEntries(PERIODS.filter(k=>s.entries[k].length).map(k=>[k,{percent:avg(s.entries[k])}]))}));const deltas=all.map(v=>delta(v.scores)).filter(Number.isFinite);const overall=avg(all.map(v=>{const keys=values(v.scores);return keys.length?v.scores[keys[keys.length-1]].percent:null}).filter(Number.isFinite));const ranked=all.map(x=>({...x,latest:values(x.scores).length?x.scores[values(x.scores).at(-1)].percent:null,change:delta(x.scores)})).filter(x=>x.latest!==null).sort((a,b)=>b.latest-a.latest);const dist=[0,0,0,0,0];ranked.forEach(x=>{const n=x.latest;dist[n>=90?0:n>=75?1:n>=60?2:n>=40?3:4]++});return{subjects,all,deltas,overall,ranked,dist}},[rows]);
 const rankedFiltered=analytics.ranked.filter(x=>`${x.student.name||''} ${x.student.roll_number||''}`.toLowerCase().includes(search.toLowerCase()));const comparable=analytics.subjects.filter(s=>values(s.scores).length>1);const best=[...comparable].sort((a,b)=>(delta(b.scores)||0)-(delta(a.scores)||0))[0];const low=[...analytics.subjects].sort((a,b)=>{const last=s=>{const v=values(s.scores);return v.length?s.scores[v.at(-1)].percent:Infinity};return last(a)-last(b)})[0];
 const sessionName=nameOf(sessions.find(s=>String(s.id)===f.session_id),['name','session_name']);const className=nameOf(classes.find(s=>String(s.id)===f.class_id),['name','class_name']);const secName=nameOf(sections.find(s=>String(s.id)===f.section_id),['name','section_name']);
 function downloadCSV(){const header=['Roll No','Student','PT-1 %','PT-2 %','HY %','Change pp'];const vals=analytics.all.map(({student,scores})=>[student.roll_number,student.name,...PERIODS.map(k=>Number.isFinite(scores[k]?.percent)?scores[k].percent.toFixed(1):''),delta(scores)?.toFixed(1)||'']);const csv=[header,...vals].map(line=>line.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=u;a.download=`SMCIS_Class_Analytics_${className}_${secName}.csv`;a.click();URL.revokeObjectURL(u)}
 return <main className="cpa-page"><div className="cpa-heading"><div><small>EXAMINATION · ACADEMIC ANALYTICS</small><h1>Class Performance Analytics</h1><p>Class averages, student progress and subject-wise external exam comparison.</p></div><div className="cpa-actions"><button disabled={!rows.length} onClick={()=>window.print()}>🖨 Print / Save PDF</button><button disabled={!rows.length} onClick={downloadCSV}>⬇ Export CSV</button></div></div>
 <div className="cpa-filter"><label>Session<select value={f.session_id} onChange={e=>{setF({...f,session_id:e.target.value,exam_ids:[]});setRows([])}}><option value="">Select</option>{sessions.map(s=><option key={s.id} value={s.id}>{nameOf(s,['name','session_name','academic_year'])}</option>)}</select></label><label>Class<select value={f.class_id} onChange={e=>{setF({...f,class_id:e.target.value,section_id:''});setRows([])}}><option value="">Select</option>{classes.map(s=><option key={s.id} value={s.id}>{nameOf(s,['name','class_name'])}</option>)}</select></label><label>Section<select value={f.section_id} onChange={e=>{setF({...f,section_id:e.target.value});setRows([])}}><option value="">Select</option>{sectionOptions.map(s=><option key={s.id} value={s.id}>{nameOf(s,['name','section_name'])}</option>)}</select></label><label>Examination(s)<select multiple size={Math.min(3,Math.max(2,exams.length))} value={f.exam_ids.map(String)} onChange={e=>{setF({...f,exam_ids:[...e.target.selectedOptions].map(o=>Number(o.value))});setRows([])}}>{exams.map(s=><option key={s.id} value={s.id}>{nameOf(s,['name','exam_name'])}</option>)}</select><small>Ctrl + click for multiple</small></label><button className="cpa-primary" disabled={busy} onClick={load}>{busy?'Loading…':'View Analytics →'}</button></div>
 {err&&<p className="cpa-error" role="alert">{err}</p>}{!rows.length&&!busy&&!err&&<div className="cpa-empty">Select filters and click View Analytics to load class performance.</div>}{rows.length>0&&<><div className="cpa-stats"><div><span>👥 Total Students</span><strong>{rows.length}</strong><small>{className} · {secName} · {sessionName}</small></div><div><span>📊 Class Average</span><strong>{nice(analytics.overall)}</strong><small>Latest available external assessment</small></div><div><span>📈 Improved Students</span><strong className="cpa-up">{analytics.deltas.filter(n=>n>0).length}</strong><small>Among {analytics.deltas.length} comparable students</small></div><div><span>📉 Declined Students</span><strong className="cpa-down">{analytics.deltas.filter(n=>n<0).length}</strong><small>Across earliest to latest assessment</small></div><div><span>🏅 Highest Growth</span><strong>{best?.name||'—'}</strong><small>{best?`${delta(best.scores).toFixed(1)} pp`:'Insufficient assessments'}</small></div><div><span>⚑ Lowest Average Subject</span><strong>{low?.name||'—'}</strong><small>Latest available exam</small></div></div>
 <div className="cpa-chart-grid"><section className="cpa-panel"><h2>Subject-wise Class Average</h2><Chart subjects={analytics.subjects}/></section><section className="cpa-panel"><h2>Performance Distribution</h2><p className="cpa-note">Latest available assessment · {analytics.ranked.length} students</p><div className="cpa-bands">{['90–100%','75–89%','60–74%','40–59%','Below 40%'].map((label,i)=><div key={label}><span>{label}</span><div><i style={{width:`${analytics.ranked.length?analytics.dist[i]/analytics.ranked.length*100:0}%`,background:['#25b586','#3987f5','#e9b925','#ff9748','#ec5767'][i]}} /></div><strong>{analytics.dist[i]}</strong></div>)}</div></section></div>
 <div className="cpa-chart-grid"><section className="cpa-panel"><h2>🏆 Top 5 Students</h2><StudentsTable entries={analytics.ranked.slice(0,5)} onPick={setSelected}/></section><section className="cpa-panel"><h2>📘 Students Requiring Support</h2><StudentsTable entries={[...analytics.ranked].reverse().slice(0,5)} onPick={setSelected}/></section></div>
 <section className="cpa-panel"><div className="cpa-panel-head"><h2>Complete Class Student List</h2><input placeholder="Search student or roll number" value={search} onChange={e=>setSearch(e.target.value)}/></div><StudentsTable entries={rankedFiltered} onPick={setSelected}/></section><TeachersTable subjects={analytics.subjects} assignments={teacherAssignments} classId={f.class_id} sectionId={f.section_id}/>{assignmentMessage&&<p className="cpa-note">{assignmentMessage}</p>}<section className="cpa-panel"><h2>Subject Comparison Summary</h2><div className="cpa-table-wrap"><table className="cpa-table"><thead><tr><th>Subject</th>{PERIODS.map(k=><th key={k}>{k} Average</th>)}<th>Change</th><th>Students Assessed</th></tr></thead><tbody>{analytics.subjects.map(s=><tr key={s.id}><td><strong>{s.name}</strong></td>{PERIODS.map(k=><td key={k}>{nice(s.scores[k]?.percent)}</td>)}<td className={(delta(s.scores)||0)>=0?'cpa-up':'cpa-down'}>{delta(s.scores)==null?'—':`${delta(s.scores)>0?'+':''}${delta(s.scores).toFixed(1)} pp`}</td><td>{Math.max(...PERIODS.map(k=>s.entries[k].length))}</td></tr>)}</tbody></table></div></section><p className="cpa-note">Changes are percentage-point differences. Only entered external MARKS assessments are compared. Missing assessments are excluded, not treated as zero. This report does not evaluate teacher quality.</p></>}
 {selected&&<StudentPopup student={selected} onClose={()=>setSelected(null)}/>}</main>}
function StudentsTable({entries,onPick}){return <div className="cpa-table-wrap"><table className="cpa-table"><thead><tr><th>Student</th>{PERIODS.map(k=><th key={k}>{k}</th>)}<th>Change</th></tr></thead><tbody>{entries.length?entries.map(({student,scores,change})=><tr key={student.id} className="cpa-click" onClick={()=>onPick(student)}><td><div className="cpa-student-cell"><Photo s={student}/><span><strong>{student.name}</strong><small>Roll #{student.roll_number||'—'}</small></span></div></td>{PERIODS.map(k=><td key={k}>{nice(scores[k]?.percent)}</td>)}<td className={change>0?'cpa-up':change<0?'cpa-down':''}>{change==null?'—':`${change>0?'+':''}${change.toFixed(1)} pp`}</td></tr>):<tr><td colSpan="5">No comparable student records.</td></tr>}</tbody></table></div>}
