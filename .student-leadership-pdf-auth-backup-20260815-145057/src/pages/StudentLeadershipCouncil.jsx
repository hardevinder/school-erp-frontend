import React, { useEffect, useMemo, useState } from "react";
import {
  addLeadershipDuty,
  councilPdfUrl,
  createLeadershipAppointment,
  createLeadershipPosition,
  createLeadershipWing,
  endLeadershipAppointment,
  getLeadershipAppointments,
  getLeadershipBootstrap,
  leadershipCertificatePdfUrl,
  searchLeadershipStudents,
  updateLeadershipDuty,
  updateLeadershipPosition,
  updateLeadershipWing,
} from "../services/studentLeadershipApi";
import "./StudentLeadershipCouncil.css";

const today = () => new Date().toISOString().slice(0, 10);
const getErr = (e) => e?.response?.data?.message || e?.message || "Something went wrong";
const photoUrl = (p) => {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = (process.env.REACT_APP_API_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/${String(p).replace(/^\/+/, "")}`;
};

export default function StudentLeadershipCouncil() {
  const [meta, setMeta] = useState({ sessions: [], houses: [], classes: [], wings: [], positions: [], can_manage: false });
  const [appointments, setAppointments] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [tab, setTab] = useState("board");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [appointmentForm, setAppointmentForm] = useState({ position_id: "", wing_id: "", house_id: "", start_date: today(), end_date: "", selection_method: "direct", appointment_note: "" });

  const [wingForm, setWingForm] = useState({ name: "", code: "", description: "", eligible_class_ids: [] });
  const [positionForm, setPositionForm] = useState({ name: "", code: "", scope_type: "school", gender_restriction: "any", max_holders_per_scope: 1, eligible_class_ids: [] });
  const [dutyForm, setDutyForm] = useState({ appointment_id: "", title: "", due_date: "", description: "" });

  const activeSession = meta.sessions.find((s) => String(s.id) === String(sessionId));
  const position = meta.positions.find((p) => String(p.id) === String(appointmentForm.position_id));
  const needsWing = ["wing", "house_wing"].includes(position?.scope_type);
  const needsHouse = ["house", "house_wing"].includes(position?.scope_type);

  async function reloadMeta() {
    const data = await getLeadershipBootstrap();
    setMeta(data);
    const preferred = sessionId || data.sessions.find((s) => s.is_active)?.id || data.sessions[0]?.id || "";
    setSessionId(String(preferred || ""));
  }
  async function reloadAppointments(sid = sessionId) {
    if (!sid) return setAppointments([]);
    const data = await getLeadershipAppointments({ session_id: sid });
    setAppointments(data.appointments || []);
  }

  useEffect(() => { reloadMeta().catch((e) => setError(getErr(e))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sessionId) reloadAppointments(sessionId).catch((e) => setError(getErr(e))); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length < 2 || !meta.can_manage) return setStudents([]);
      searchLeadershipStudents({ q: query.trim(), session_id: sessionId, limit: 40 }).then((d) => setStudents(d.students || [])).catch(() => setStudents([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, sessionId, meta.can_manage]);

  const activeAppointments = useMemo(() => appointments.filter((a) => a.status === "active"), [appointments]);
  const grouped = useMemo(() => {
    const school = activeAppointments.filter((a) => a.position?.scope_type === "school");
    const wing = {};
    const house = {};
    activeAppointments.filter((a) => ["wing", "house_wing"].includes(a.position?.scope_type)).forEach((a) => { const k = a.wing?.name || "Wing Leadership"; if (!wing[k]) wing[k] = []; wing[k].push(a); });
    activeAppointments.filter((a) => ["house", "house_wing"].includes(a.position?.scope_type)).forEach((a) => { const k = [a.leadershipHouse?.house_name || "House", a.wing?.name].filter(Boolean).join(" • "); if (!house[k]) house[k] = []; house[k].push(a); });
    return { school, wing, house };
  }, [activeAppointments]);

  async function run(action) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (e) { setError(getErr(e)); } finally { setBusy(false); }
  }

  async function appoint() {
    if (!selectedStudent) return setError("Please select a student");
    await run(async () => {
      await createLeadershipAppointment({ ...appointmentForm, student_id: selectedStudent.id, session_id: Number(sessionId), position_id: Number(appointmentForm.position_id), wing_id: needsWing ? Number(appointmentForm.wing_id) : null, house_id: needsHouse ? Number(appointmentForm.house_id) : null });
      setMessage("Leadership position appointed successfully.");
      setSelectedStudent(null); setQuery(""); setStudents([]);
      setAppointmentForm((f) => ({ ...f, wing_id: "", house_id: "", appointment_note: "" }));
      await reloadAppointments();
      setTab("board");
    });
  }

  function ClassChips({ value, onChange }) {
    const ids = new Set((value || []).map(Number));
    return <div className="class-checks">{meta.classes.map((c) => <button type="button" key={c.id} className={`class-chip ${ids.has(Number(c.id)) ? "on" : ""}`} onClick={() => onChange(ids.has(Number(c.id)) ? [...ids].filter((x) => x !== Number(c.id)) : [...ids, Number(c.id)])}>{c.class_name}</button>)}</div>;
  }

  function LeaderCard({ a }) {
    return <div className="leadership-card"><div className="leader-profile">{photoUrl(a.student?.photo) ? <img className="leader-photo" src={photoUrl(a.student.photo)} alt="" /> : <div className="leader-photo d-flex align-items-center justify-content-center fw-bold">{a.student?.name?.[0] || "S"}</div>}<div><div className="leader-position">{a.position?.name}</div><div className="leader-name">{a.student?.name}</div><div className="leader-meta">{[a.student?.Class?.class_name, a.student?.Section?.section_name, a.leadershipHouse?.house_name, a.wing?.name].filter(Boolean).join(" • ")}</div><div className="leader-meta">{a.selection_method} • from {a.start_date}</div></div></div><div className="mt-2 d-flex gap-2 flex-wrap">{meta.can_manage && <button className="btn-lead soft" onClick={() => window.open(leadershipCertificatePdfUrl(a.id), "_blank")}>Print Appointment</button>}{meta.can_manage && <button className="btn-lead warn" onClick={() => { const reason = window.prompt("Reason (optional for completion, required for revoke/replacement):") || ""; run(async () => { await endLeadershipAppointment(a.id, { status: "completed", reason }); await reloadAppointments(); }); }}>Complete Tenure</button>}</div>{(a.duties || []).slice(0, 3).map((d) => <div key={d.id} className="duty-row mini-note">{d.title} • {d.status}</div>)}</div>;
  }

  return <div className="leadership-page">
    <div className="leadership-hero"><h2>🏅 Student Leadership & Council Management</h2><p>School, wing and house leadership — appointments, responsibilities, history and branded council printing.</p></div>
    <div className="leadership-toolbar"><select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>{meta.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " (Active)" : ""}</option>)}</select><button className="btn-lead primary" disabled={!sessionId} onClick={() => window.open(councilPdfUrl(sessionId), "_blank")}>🖨 Full Branded Council PDF</button><span className="mini-note">{activeAppointments.length} active leadership appointment(s) • {activeSession?.name || "Session"}</span></div>
    {error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}
    <div className="leadership-tabs">{[["board","Council Board"],["appoint","Appoint Student"],["duties","Duties"],["setup","Council Setup"]].map(([k,l]) => <button key={k} className={`leadership-tab ${tab===k?"active":""}`} onClick={() => setTab(k)}>{l}</button>)}</div>

    {tab === "board" && <>
      <div className="leadership-section-title">School Leadership</div><div className="leadership-grid">{grouped.school.map((a) => <LeaderCard key={a.id} a={a} />)}{!grouped.school.length && <div className="empty-lead leadership-card">No school-level appointments yet.</div>}</div>
      {Object.entries(grouped.wing).map(([name,list]) => <React.Fragment key={name}><div className="leadership-section-title">{name}</div><div className="leadership-grid">{list.map((a) => <LeaderCard key={a.id} a={a} />)}</div></React.Fragment>)}
      {Object.entries(grouped.house).map(([name,list]) => <React.Fragment key={name}><div className="leadership-section-title">{name}</div><div className="leadership-grid">{list.map((a) => <LeaderCard key={a.id} a={a} />)}</div></React.Fragment>)}
    </>}

    {tab === "appoint" && <div className="leadership-form">
      {!meta.can_manage ? <div className="empty-lead">You have view-only access.</div> : <><div className="leadership-form-grid"><label>Search Student<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or admission number" /></label><label>Position<select value={appointmentForm.position_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, position_id: e.target.value, wing_id: "", house_id: "" })}><option value="">Select position</option>{meta.positions.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.scope_type})</option>)}</select></label>{needsWing && <label>Wing<select value={appointmentForm.wing_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, wing_id: e.target.value })}><option value="">Select wing</option>{meta.wings.filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}{needsHouse && <label>House<select value={appointmentForm.house_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, house_id: e.target.value })}><option value="">Select house</option>{meta.houses.map((h) => <option key={h.id} value={h.id}>{h.house_name}</option>)}</select></label>}<label>Start Date<input type="date" value={appointmentForm.start_date} onChange={(e) => setAppointmentForm({ ...appointmentForm, start_date: e.target.value })} /></label><label>End Date (optional)<input type="date" value={appointmentForm.end_date} onChange={(e) => setAppointmentForm({ ...appointmentForm, end_date: e.target.value })} /></label><label>Selection Method<select value={appointmentForm.selection_method} onChange={(e) => setAppointmentForm({ ...appointmentForm, selection_method: e.target.value })}>{["direct","nomination","interview","election","other"].map((x) => <option key={x}>{x}</option>)}</select></label></div>
      {students.length > 0 && <div className="student-results mt-3">{students.map((s) => <div key={s.id} className={`student-result ${selectedStudent?.id===s.id?"selected":""}`} onClick={() => { setSelectedStudent(s); if (needsHouse && s.house_id) setAppointmentForm((f) => ({ ...f, house_id: String(s.house_id) })); }}><div><b>{s.name}</b><div className="mini-note">{s.admission_number} • {[s.Class?.class_name,s.Section?.section_name].filter(Boolean).join("-")} • {s.House?.house_name || "No House"}</div></div><span>{selectedStudent?.id===s.id?"✓ Selected":"Select"}</span></div>)}</div>}
      {selectedStudent && <div className="success-box mt-3">Selected: <b>{selectedStudent.name}</b> • {selectedStudent.House?.house_name || "No house assigned"}</div>}
      <label className="mt-3">Appointment Note<textarea rows="3" value={appointmentForm.appointment_note} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_note: e.target.value })} placeholder="Optional leadership note / appointment remarks" /></label><button disabled={busy || !selectedStudent || !appointmentForm.position_id || (needsWing&&!appointmentForm.wing_id) || (needsHouse&&!appointmentForm.house_id)} className="btn-lead primary mt-3" onClick={appoint}>{busy ? "Saving..." : "Appoint Leadership Position"}</button></>}
    </div>}

    {tab === "duties" && <div className="leadership-form"><div className="leadership-form-grid"><label>Leadership Holder<select value={dutyForm.appointment_id} onChange={(e) => setDutyForm({ ...dutyForm, appointment_id: e.target.value })}><option value="">Select student / position</option>{activeAppointments.map((a) => <option key={a.id} value={a.id}>{a.student?.name} — {a.position?.name}</option>)}</select></label><label>Duty / Responsibility<input value={dutyForm.title} onChange={(e) => setDutyForm({ ...dutyForm, title: e.target.value })} /></label><label>Due Date<input type="date" value={dutyForm.due_date} onChange={(e) => setDutyForm({ ...dutyForm, due_date: e.target.value })} /></label></div><label className="mt-2">Description<textarea rows="2" value={dutyForm.description} onChange={(e) => setDutyForm({ ...dutyForm, description: e.target.value })} /></label><button className="btn-lead primary mt-3" disabled={!meta.can_manage || !dutyForm.appointment_id || !dutyForm.title || busy} onClick={() => run(async () => { await addLeadershipDuty(dutyForm.appointment_id, dutyForm); setDutyForm({ appointment_id:"",title:"",due_date:"",description:"" }); await reloadAppointments(); setMessage("Duty assigned."); })}>Assign Duty</button><div className="leadership-table-wrap mt-4"><table className="leadership-table"><thead><tr><th>Student</th><th>Position</th><th>Duty</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{activeAppointments.flatMap((a) => (a.duties||[]).map((d) => <tr key={d.id}><td>{a.student?.name}</td><td>{a.position?.name}</td><td>{d.title}<div className="mini-note">{d.description}</div></td><td>{d.due_date||"-"}</td><td><span className={`status-pill ${d.status}`}>{d.status}</span></td><td>{d.status!=="completed" && d.status!=="cancelled" && <button className="btn-lead soft" onClick={() => run(async()=>{await updateLeadershipDuty(d.id,{status:"completed"});await reloadAppointments();})}>Mark Complete</button>}</td></tr>))}</tbody></table></div></div>}

    {tab === "setup" && <div className="leadership-grid">
      <div className="leadership-form"><h5>Wing Setup</h5><div className="leadership-form-grid"><label>Name<input value={wingForm.name} onChange={(e)=>setWingForm({...wingForm,name:e.target.value})}/></label><label>Code<input value={wingForm.code} onChange={(e)=>setWingForm({...wingForm,code:e.target.value})} placeholder="senior"/></label></div><div className="mini-note mt-2">Eligible classes (leave empty to allow all classes)</div><ClassChips value={wingForm.eligible_class_ids} onChange={(ids)=>setWingForm({...wingForm,eligible_class_ids:ids})}/><button className="btn-lead primary mt-3" disabled={!meta.can_manage || !wingForm.name || busy} onClick={()=>run(async()=>{await createLeadershipWing(wingForm);setWingForm({name:"",code:"",description:"",eligible_class_ids:[]});await reloadMeta();setMessage("Wing created.");})}>Add Wing</button><div className="mt-3">{meta.wings.map((w)=><div key={w.id} className="duty-row"><b>{w.name}</b> <span className="mini-note">{w.code} • {w.active?"Active":"Inactive"}</span>{meta.can_manage&&<button className="btn btn-sm btn-link" onClick={()=>run(async()=>{await updateLeadershipWing(w.id,{active:!w.active});await reloadMeta();})}>{w.active?"Deactivate":"Activate"}</button>}</div>)}</div></div>
      <div className="leadership-form"><h5>Position Setup</h5><div className="leadership-form-grid"><label>Name<input value={positionForm.name} onChange={(e)=>setPositionForm({...positionForm,name:e.target.value})}/></label><label>Code<input value={positionForm.code} onChange={(e)=>setPositionForm({...positionForm,code:e.target.value})}/></label><label>Scope<select value={positionForm.scope_type} onChange={(e)=>setPositionForm({...positionForm,scope_type:e.target.value})}><option value="school">School</option><option value="wing">Wing</option><option value="house">House</option><option value="house_wing">House + Wing</option></select></label><label>Gender restriction<select value={positionForm.gender_restriction} onChange={(e)=>setPositionForm({...positionForm,gender_restriction:e.target.value})}><option value="any">Any</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label><label>Max holders per scope<input type="number" min="1" value={positionForm.max_holders_per_scope} onChange={(e)=>setPositionForm({...positionForm,max_holders_per_scope:e.target.value})}/></label></div><div className="mini-note mt-2">Eligible classes (leave empty to allow all classes)</div><ClassChips value={positionForm.eligible_class_ids} onChange={(ids)=>setPositionForm({...positionForm,eligible_class_ids:ids})}/><button className="btn-lead primary mt-3" disabled={!meta.can_manage || !positionForm.name || busy} onClick={()=>run(async()=>{await createLeadershipPosition(positionForm);setPositionForm({name:"",code:"",scope_type:"school",gender_restriction:"any",max_holders_per_scope:1,eligible_class_ids:[]});await reloadMeta();setMessage("Position created.");})}>Add Position</button><div className="mt-3">{meta.positions.map((p)=><div key={p.id} className="duty-row"><b>{p.name}</b> <span className="mini-note">{p.scope_type} • max {p.max_holders_per_scope} • {p.active?"Active":"Inactive"}</span>{meta.can_manage&&<button className="btn btn-sm btn-link" onClick={()=>run(async()=>{await updateLeadershipPosition(p.id,{active:!p.active});await reloadMeta();})}>{p.active?"Deactivate":"Activate"}</button>}</div>)}</div></div>
    </div>}
  </div>;
}
