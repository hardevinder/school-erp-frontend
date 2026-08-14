import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import studentHealthApi from "../services/studentHealthApi";

const today = new Date().toISOString().slice(0, 10);
const statusLabel = (s) => ({ not_checked: "Not checked", normal: "Normal", review_advised: "Review advised" }[s] || s || "-");

export default function StudentHealthGrowth() {
  const [meta, setMeta] = useState({ classes: [], sections: [] });
  const [filters, setFilters] = useState({ class_id: "", section_id: "", search: "" });
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [record, setRecord] = useState(null);
  const [dash, setDash] = useState({});
  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [measurement, setMeasurement] = useState({ measurement_date: today, height_cm: "", weight_kg: "", notes: "" });
  const [screening, setScreening] = useState({ screening_date: today, screening_type: "General Health Screening", dental_status: "not_checked", vision_status: "not_checked", hearing_status: "not_checked", general_status: "not_checked", vision_right: "", vision_left: "", uses_glasses: false, followup_recommended: false, followup_notes: "", general_notes: "" });
  const [profile, setProfile] = useState({});

  const sections = useMemo(() => meta.sections.filter((s) => !filters.class_id || String(s.class_id) === String(filters.class_id)), [meta.sections, filters.class_id]);

  const loadMeta = async () => {
    const [m, d] = await Promise.all([studentHealthApi.classes(), studentHealthApi.dashboard()]);
    setMeta({ classes: m.classes || [], sections: m.sections || [] }); setDash(d || {});
  };
  const loadStudents = async () => {
    const d = await studentHealthApi.students(filters); setStudents(d.students || []);
    if (!selectedId && d.students?.length) setSelectedId(d.students[0].id);
  };
  const loadRecord = async (id) => {
    if (!id) return; const d = await studentHealthApi.student(id); setRecord(d); setProfile(d.profile || {});
  };
  useEffect(() => { loadMeta().catch((e) => setMessage(e.message)); }, []);
  useEffect(() => { loadStudents().catch((e) => setMessage(e.message)); }, [filters.class_id, filters.section_id]);
  useEffect(() => { if (selectedId) loadRecord(selectedId).catch((e) => setMessage(e.message)); }, [selectedId]);

  const saveProfile = async () => { setBusy(true); try { await studentHealthApi.updateProfile(selectedId, profile); await loadRecord(selectedId); setMessage("Health profile saved."); } finally { setBusy(false); } };
  const verifyProfile = async () => { setBusy(true); try { await studentHealthApi.verifyProfile(selectedId); await loadRecord(selectedId); setMessage("Profile verified."); } finally { setBusy(false); } };
  const saveMeasurement = async () => { setBusy(true); try { await studentHealthApi.addMeasurement(selectedId, measurement); setMeasurement({ measurement_date: today, height_cm: "", weight_kg: "", notes: "" }); await loadRecord(selectedId); await loadMeta(); setMessage("Measurement saved."); } finally { setBusy(false); } };
  const saveScreening = async () => { setBusy(true); try { await studentHealthApi.addScreening(selectedId, screening); await loadRecord(selectedId); await loadMeta(); setMessage("Health screening saved."); } finally { setBusy(false); } };

  const chartData = (record?.measurements || []).map((m) => ({ date: String(m.measurement_date || "").slice(5), height: Number(m.height_cm) || null, weight: Number(m.weight_kg) || null, bmi: Number(m.bmi) || null }));
  const s = record?.student || {};
  const latest = record?.measurements?.[record.measurements.length - 1] || {};

  return <div className="container-fluid py-3">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div><h3 className="mb-0">Student Health & Growth</h3><small className="text-muted">Quarterly growth + half-yearly screening • private health record</small></div>
      {selectedId && <button className="btn btn-outline-primary" onClick={() => studentHealthApi.downloadHealthCard(selectedId)}>Download Branded Health Card PDF</button>}
    </div>
    {message && <div className="alert alert-info py-2">{message}</div>}
    <div className="row g-2 mb-3">
      {[["Students", dash.total_students], ["Measured this quarter", dash.measured_this_period], ["Measurement pending", dash.measurement_pending], ["Screening pending", dash.screening_pending], ["Follow-ups", dash.followups_pending]].map(([k,v]) => <div className="col-6 col-md" key={k}><div className="card shadow-sm h-100"><div className="card-body py-3"><div className="text-muted small">{k}</div><div className="fs-4 fw-bold">{v ?? 0}</div></div></div></div>)}
    </div>
    <div className="card shadow-sm mb-3"><div className="card-body"><div className="row g-2">
      <div className="col-md-3"><select className="form-select" value={filters.class_id} onChange={(e)=>setFilters({...filters,class_id:e.target.value,section_id:""})}><option value="">All classes</option>{meta.classes.map(c=><option key={c.id} value={c.id}>{c.class_name}</option>)}</select></div>
      <div className="col-md-3"><select className="form-select" value={filters.section_id} onChange={(e)=>setFilters({...filters,section_id:e.target.value})}><option value="">All sections</option>{sections.map(x=><option key={x.id} value={x.id}>{x.section_name}</option>)}</select></div>
      <div className="col-md-4"><input className="form-control" placeholder="Search student / admission no." value={filters.search} onChange={(e)=>setFilters({...filters,search:e.target.value})} onKeyDown={(e)=>e.key==="Enter"&&loadStudents()}/></div>
      <div className="col-md-2"><button className="btn btn-primary w-100" onClick={loadStudents}>Search</button></div>
    </div></div></div>
    <div className="row g-3">
      <div className="col-lg-3"><div className="card shadow-sm" style={{maxHeight:"72vh",overflow:"auto"}}><div className="list-group list-group-flush">{students.map(st=><button key={st.id} className={`list-group-item list-group-item-action ${selectedId===st.id?"active":""}`} onClick={()=>setSelectedId(st.id)}><div className="fw-semibold">{st.name}</div><small>{st.class_name || ""} {st.section_name || ""} • {st.admission_number}</small></button>)}</div></div></div>
      <div className="col-lg-9">{!record ? <div className="card"><div className="card-body">Select a student.</div></div> : <>
        <div className="card shadow-sm mb-3"><div className="card-body d-flex flex-wrap align-items-center gap-3"><div className="flex-grow-1"><h4 className="mb-1">{s.name}</h4><div className="text-muted">{s.class_name} {s.section_name} • Adm. {s.admission_number}</div></div><div className="text-center"><div className="small text-muted">Height</div><b>{latest.height_cm ? `${latest.height_cm} cm` : "-"}</b></div><div className="text-center"><div className="small text-muted">Weight</div><b>{latest.weight_kg ? `${latest.weight_kg} kg` : "-"}</b></div><div className="text-center"><div className="small text-muted">BMI</div><b>{latest.bmi || "-"}</b></div></div></div>
        <ul className="nav nav-tabs mb-3">{["overview","profile","measurement","screening"].map(t=><li className="nav-item" key={t}><button className={`nav-link ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button></li>)}</ul>
        {tab==="overview" && <div className="row g-3"><div className="col-md-6"><div className="card shadow-sm"><div className="card-body"><h6>Height Growth</h6><div style={{height:240}}><ResponsiveContainer><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis domain={["dataMin - 2","dataMax + 2"]}/><Tooltip/><Line type="monotone" dataKey="height" stroke="#2563eb" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div></div></div><div className="col-md-6"><div className="card shadow-sm"><div className="card-body"><h6>Weight Trend</h6><div style={{height:240}}><ResponsiveContainer><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis domain={["dataMin - 2","dataMax + 2"]}/><Tooltip/><Line type="monotone" dataKey="weight" stroke="#16a34a" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div></div></div><div className="col-12"><div className="alert alert-light border small mb-0">{record.bmi_note}</div></div><div className="col-12"><div className="card shadow-sm"><div className="card-body"><h6>Screening History</h6>{(record.screenings||[]).length===0?<span className="text-muted">No screening yet.</span>:(record.screenings||[]).map(x=><div className="border rounded p-2 mb-2" key={x.id}><b>{x.screening_date} • {x.screening_type}</b><div className="small">Dental: {statusLabel(x.dental_status)} • Vision: {statusLabel(x.vision_status)} • Hearing: {statusLabel(x.hearing_status)} • General: {statusLabel(x.general_status)}</div>{x.followup_recommended&&<div className="text-warning-emphasis small fw-semibold">Follow-up recommended: {x.followup_notes || "Please review."}</div>}</div>)}</div></div></div></div>}
        {tab==="profile" && <div className="card shadow-sm"><div className="card-body"><div className="row g-2">{[["blood_group","Blood Group"],["food_allergies","Food allergies"],["medication_allergies","Medication allergies"],["medical_conditions","Medical conditions"],["emergency_medication_instructions","Emergency medication / instructions"],["emergency_contact_name","Emergency contact name"],["emergency_contact_phone","Emergency contact phone"],["vaccination_notes","Vaccination notes"],["family_notes","Family notes"],["school_health_notes","School health notes"]].map(([k,l])=><div className="col-md-6" key={k}><label className="form-label small fw-semibold">{l}</label>{k.includes("notes")||k.includes("allerg")||k.includes("conditions")||k.includes("instructions")?<textarea className="form-control" rows="2" value={profile[k]||""} onChange={e=>setProfile({...profile,[k]:e.target.value})}/>:<input className="form-control" value={profile[k]||""} onChange={e=>setProfile({...profile,[k]:e.target.value})}/>}</div>)}</div><div className="d-flex gap-2 mt-3"><button disabled={busy} className="btn btn-primary" onClick={saveProfile}>Save Profile</button><button disabled={busy} className="btn btn-outline-success" onClick={verifyProfile}>Verify Profile</button><span className="align-self-center small text-muted">{profile.verified?"School Verified":"Family reported / verification pending"}</span></div></div></div>}
        {tab==="measurement" && <div className="card shadow-sm"><div className="card-body"><h6>Add Height / Weight</h6><div className="row g-2"><div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" value={measurement.measurement_date} onChange={e=>setMeasurement({...measurement,measurement_date:e.target.value})}/></div><div className="col-md-3"><label className="form-label">Height (cm)</label><input type="number" step="0.1" className="form-control" value={measurement.height_cm} onChange={e=>setMeasurement({...measurement,height_cm:e.target.value})}/></div><div className="col-md-3"><label className="form-label">Weight (kg)</label><input type="number" step="0.1" className="form-control" value={measurement.weight_kg} onChange={e=>setMeasurement({...measurement,weight_kg:e.target.value})}/></div><div className="col-md-3 d-flex align-items-end"><button disabled={busy} className="btn btn-primary w-100" onClick={saveMeasurement}>Save Measurement</button></div></div></div></div>}
        {tab==="screening" && <div className="card shadow-sm"><div className="card-body"><h6>Health Screening</h6><div className="row g-2"><div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" value={screening.screening_date} onChange={e=>setScreening({...screening,screening_date:e.target.value})}/></div>{["dental_status","vision_status","hearing_status","general_status"].map(k=><div className="col-md-2" key={k}><label className="form-label">{k.replace("_status","")}</label><select className="form-select" value={screening[k]} onChange={e=>setScreening({...screening,[k]:e.target.value})}><option value="not_checked">Not checked</option><option value="normal">Normal</option><option value="review_advised">Review advised</option></select></div>)}<div className="col-12"><label className="form-label">General / follow-up notes</label><textarea className="form-control" rows="3" value={screening.general_notes} onChange={e=>setScreening({...screening,general_notes:e.target.value})}/></div><div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" checked={screening.followup_recommended} onChange={e=>setScreening({...screening,followup_recommended:e.target.checked})}/><label className="form-check-label">Professional follow-up recommended</label></div><div className="col-12"><button disabled={busy} className="btn btn-primary" onClick={saveScreening}>Save Screening</button></div></div></div></div>}
      </>}</div>
    </div>
  </div>;
}
