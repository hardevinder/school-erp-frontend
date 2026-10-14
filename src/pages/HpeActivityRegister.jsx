import HpeStudentReportPanel from "./HpeStudentReportPanel";
import HpeReadinessPanel from "./HpeReadinessPanel";
import HpeAssessmentPanel from "./HpeAssessmentPanel";
import HpeSportsPanel from "./HpeSportsPanel";
import HpeFitnessPanel from "./HpeFitnessPanel";
import React, { useEffect, useState } from "react";
import api from "../api";
const list = d => Array.isArray(d) ? d : d?.data || d?.classes || d?.sections || d?.sessions || [];
// Human-readable labels for previously saved activity records.
const displayEntityName = (item, kind) => {
  if (!item) return "";
  const keys = kind === "class"
    ? ["name", "class_name", "className", "ClassName", "title"]
    : ["name", "section_name", "sectionName", "SectionName", "title"];
  return keys.map(key => item[key]).find(value => value != null && String(value).trim()) || "";
};
const formatHpeDate = value => {
  const matched = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!matched) return value || "—";
  const [, y, m, d] = matched;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
};
const HPE_CATEGORIES = { games_sports: "Games & Sports", yoga: "Yoga", fitness: "Fitness", health_awareness: "Health Awareness", other: "Other" };
const categoryLabel = value => HPE_CATEGORIES[value] || String(value || "—").replace(/[_-]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
const today = (()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`})();
export default function HpeActivityRegister() {
  const [sessions,setSessions] = useState([]), [classes,setClasses]=useState([]), [sections,setSections]=useState([]);
  const [selection,setSelection] = useState({session_id:"",class_id:"",section_id:"",activity_date:today,category:"games_sports",title:"",description:""});
  const [activities,setActivities]=useState([]), [active,setActive]=useState(null), [roster,setRoster]=useState([]);
  const [dash,setDash]=useState({}),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=> { Promise.all([api.get('/sessions'),api.get('/classes'),api.get('/sections')]).then(([a,b,c])=>{
    setSessions(list(a.data));setClasses(list(b.data));setSections(list(c.data));
  }).catch(e=>setMessage(e.response?.data?.message||'Unable to load class filters')); },[]);
  const load = async()=>{ setBusy(true);setMessage('');try {
    const [a,d] = await Promise.all([api.get('/hpe/activities',{params:{session_id:selection.session_id||undefined,class_id:selection.class_id||undefined,section_id:selection.section_id||undefined}}),api.get('/hpe/dashboard',{params:{session_id:selection.session_id||undefined,class_id:selection.class_id||undefined,section_id:selection.section_id||undefined}})]);
    setActivities(a.data.activities||[]);setDash(d.data);
  }catch(e){setMessage(e.response?.data?.message||'Unable to load activities');}finally{setBusy(false)} };
  const create=async e=>{e.preventDefault();setBusy(true);setMessage('');try{
    await api.post('/hpe/activities',selection);setSelection(v=>({...v,title:'',description:''}));await load();setMessage('Activity created successfully');
  }catch(e){setMessage(e.response?.data?.message||'Unable to create activity')}finally{setBusy(false)} };
  const open=async a=>{setBusy(true);setMessage('');try{
    const r=await api.get(`/hpe/activities/${a.id}/roster`);const byId=new Map((r.data.entries||[]).map(x=>[Number(x.student_id),x]));
    setRoster((r.data.students||[]).map(s=>({student_id:s.id,name:s.name,status:byId.get(Number(s.id))?.status||'',observation:byId.get(Number(s.id))?.observation||''})));
    setActive(a);
  }catch(e){setMessage(e.response?.data?.message||'Unable to load students')}finally{setBusy(false)} };
  const save=async()=>{setBusy(true);setMessage('');try{
    await api.put(`/hpe/activities/${active.id}/participants`,{entries:roster.filter(s=>s.status).map(({student_id,status,observation})=>({student_id,status,observation}))});
    setMessage('Participation saved');await load();
  }catch(e){setMessage(e.response?.data?.message||'Unable to save')}finally{setBusy(false)} };
  const update=(id,key,value)=>setRoster(v=>v.map(s=>s.student_id===id?{...s,[key]:value}:s));
  const classSectionLabel = activity => {
    const cls = classes.find(item => Number(item.id) === Number(activity.class_id));
    const sec = sections.find(item => Number(item.id) === Number(activity.section_id));
    const classLabel = displayEntityName(cls, "class") || `Class #${activity.class_id}`;
    const sectionLabel = displayEntityName(sec, "section") || `Section #${activity.section_id}`;
    return `${classLabel} - ${sectionLabel}`;
  };

  return <div className="container-fluid py-4" style={{maxWidth:1450}}>
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h2 className="mb-1">HPE & Sports Activity Register</h2><p className="text-muted mb-0">Physical Education · Student participation records</p></div><button className="btn btn-outline-primary" onClick={load} disabled={busy}>Refresh Dashboard</button></div>
    {message&&<div role="status" className="alert alert-info">{message}</div>}
    <HpeFitnessPanel />
    <HpeSportsPanel sessions={sessions} classes={classes} sections={sections} />
    <HpeAssessmentPanel sessions={sessions} classes={classes} sections={sections} />
    <HpeReadinessPanel sessions={sessions} classes={classes} sections={sections} />
    <HpeStudentReportPanel sessions={sessions} classes={classes} sections={sections} />
    <div className="row g-3 mb-4"><div className="col-sm-6"><div className="card p-3"><div className="text-muted">Activities</div><h3>{dash.activity_count??'—'}</h3></div></div><div className="col-sm-6"><div className="card p-3"><div className="text-muted">Participation entries</div><h3>{dash.participation_entries??'—'}</h3></div></div></div>
    <form onSubmit={create} className="card p-3 mb-4"><h5>New Activity</h5><div className="row g-3">
      {[['session_id','Session',sessions],['class_id','Class',classes],['section_id','Section',sections.filter(s=>!selection.class_id || !s.class_id || Number(s.class_id)===Number(selection.class_id))]].map(([k,label,items])=><div className="col-md-4" key={k}><label className="form-label">{label}</label><select required className="form-select" value={selection[k]} onChange={e=>setSelection(v=>({...v,[k]:e.target.value,...(k==='class_id'?{section_id:''}:{})}))}><option value="">Select {label}</option>{items.map(x=><option key={x.id} value={x.id}>{x.name||x.class_name||x.session_name||x.session||x.academic_year||x.year||x.section_name}</option>)}</select></div>)}
      <div className="col-md-4"><label className="form-label">Activity date</label><input required type="date" className="form-control" value={selection.activity_date} onChange={e=>setSelection(v=>({...v,activity_date:e.target.value}))}/></div>
      <div className="col-md-4"><label className="form-label">Activity category</label><select className="form-select" value={selection.category} onChange={e=>setSelection(v=>({...v,category:e.target.value}))}>{[['games_sports','Games & Sports'],['yoga','Yoga'],['fitness','Fitness'],['health_awareness','Health Awareness'],['other','Other']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></div>
      <div className="col-md-4"><label className="form-label">Activity title</label><input required maxLength={180} className="form-control" value={selection.title} onChange={e=>setSelection(v=>({...v,title:e.target.value}))} placeholder="e.g. Inter-house Kabaddi"/></div>
      <div className="col-12"><label className="form-label">Description (optional)</label><textarea maxLength={3000} className="form-control" rows="2" value={selection.description} onChange={e=>setSelection(v=>({...v,description:e.target.value}))}/></div>
      <div className="col-12"><button disabled={busy} className="btn btn-primary">Create Activity</button></div></div></form>
    <div className="card p-3 mb-4"><div className="d-flex justify-content-between"><h5>Activity Register</h5><button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={busy}>Load Activities</button></div><div className="table-responsive"><table className="table table-hover"><thead><tr><th>Date</th><th>Activity</th><th>Category</th><th>Class / Section</th><th></th></tr></thead><tbody>{activities.map(a=><tr key={a.id}><td>{formatHpeDate(a.activity_date)}</td><td>{a.title}</td><td>{categoryLabel(a.category)}</td><td>{classSectionLabel(a)}</td><td><button className="btn btn-sm btn-outline-primary" onClick={()=>open(a)}>Record Participation</button></td></tr>)}</tbody></table></div></div>
    {active&&<div className="card p-3"><div className="d-flex justify-content-between flex-wrap"><h5>{active.title} — Student Participation</h5><button className="btn btn-outline-secondary btn-sm" onClick={()=>setActive(null)}>Close</button></div><p className="text-muted">Unrecorded students remain blank. Choose a verified status before saving each student.</p><div className="table-responsive"><table className="table table-striped"><thead><tr><th>Student</th><th>Status</th><th>Observation</th></tr></thead><tbody>{roster.map(s=><tr key={s.student_id}><td>{s.name}</td><td><select className="form-select" value={s.status} onChange={e=>update(s.student_id,'status',e.target.value)}><option value="">Not recorded</option>{[['participated','Participated'],['not_participated','Not Participated'],['excused','Excused']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></td><td><input maxLength="500" className="form-control" value={s.observation} onChange={e=>update(s.student_id,'observation',e.target.value)}/></td></tr>)}</tbody></table></div><button disabled={busy||!roster.length} className="btn btn-primary align-self-start" onClick={save}>Save Participation</button></div>}
  </div>;
}
