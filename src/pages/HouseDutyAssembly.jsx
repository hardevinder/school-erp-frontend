import React, { useEffect, useMemo, useState } from "react";
import {
  addHouseAssemblyItem,
  addHousePoints,
  configureHouseCompetition,
  createHouseAssembly,
  createHouseCompetition,
  createHouseDutyAssignment,
  createHouseDutyWeek,
  getHouseAssemblies,
  getHouseCompetitions,
  getHouseDutyAssignments,
  getHouseDutyBootstrap,
  getHouseDutyWeeks,
  getHouseLeaderboard,
  getMyHouseDuties,
  markHouseDutyAttendance,
  openHouseAssemblyPdf,
  openHouseCompetitionPdf,
  openHouseDutyWeekPdf,
  openHouseLeaderboardPdf,
  publishHouseCompetition,
  rateHouseDutyAssignment,
  searchHouseDutyPeople,
  scoreHouseCompetition,
  updateHouseAssembly,
  updateHouseAssemblyItem,
  updateHouseDutyAssignment,
  updateHouseDutyWeek,
} from "../services/houseDutyApi";
import "./HouseDutyAssembly.css";

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (date, days) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const pretty = (v) => String(v || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
const getId = (v) => (v === "" || v == null ? null : Number(v));

function Alert({ error, message }) {
  return <>{error && <div className="alert alert-danger py-2">{error}</div>}{message && <div className="alert alert-success py-2">{message}</div>}</>;
}

function PersonSearch({ type, houseId, onSelect, selected }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (q.trim().length < 2) { setRows([]); return undefined; }
    const t = window.setTimeout(() => {
      searchHouseDutyPeople({ type, q: q.trim(), house_id: type === "student" ? houseId : undefined })
        .then((r) => setRows(r.people || []))
        .catch(() => setRows([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, type, houseId]);
  return (
    <div className="position-relative">
      {selected ? (
        <div className="selected-person">
          <b>{selected.name}</b><span>{selected.admission_number || selected.employee_id || selected.designation || ""}</span>
          <button type="button" onClick={() => onSelect(null)}>×</button>
        </div>
      ) : (
        <>
          <input className="form-control" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${type}...`} />
          {rows.length > 0 && <div className="people-results">{rows.map((p) => (
            <button type="button" key={p.id} onClick={() => { onSelect(p); setQ(""); setRows([]); }}>
              <b>{p.name}</b><small>{p.admission_number || p.employee_id || p.designation || ""}</small>
            </button>
          ))}</div>}
        </>
      )}
    </div>
  );
}

function RatingEditor({ assignment, keys, onSave, busy }) {
  const [rating, setRating] = useState(() => assignment.rating_json || {});
  const [remark, setRemark] = useState(assignment.performance_remark || "");
  return (
    <div className="rating-box">
      <div className="rating-grid">
        {keys.map((k) => <label key={k}>{pretty(k)}
          <select value={rating[k] || ""} onChange={(e) => setRating({ ...rating, [k]: Number(e.target.value) })}>
            <option value="">—</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>)}
      </div>
      <textarea className="form-control mt-2" rows="2" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Performance remark (optional)" />
      <button className="btn btn-sm btn-primary mt-2" disabled={busy} onClick={() => onSave(rating, remark)}>Save Rating</button>
    </div>
  );
}

function DutyCard({ a, meta, run, reload }) {
  const [showRating, setShowRating] = useState(false);
  const ratingKeys = a.assignee_type === "employee" ? meta.staff_rating_keys || [] : meta.student_rating_keys || [];
  return (
    <div className="duty-card">
      <div className="d-flex justify-content-between gap-2 align-items-start">
        <div>
          <div className="duty-title">{a.title}</div>
          <div className="mini">{a.duty_date} • <b>{pretty(a.time_slot || "custom")}</b> • {a.position?.name || a.dutyType?.name} • {a.location || "No location"}{a.start_time ? ` • ${String(a.start_time).slice(0,5)}${a.end_time ? `–${String(a.end_time).slice(0,5)}` : ""}` : ""}</div>
          <div className="mt-1"><b>{a.student?.name || a.employee?.name}</b>{a.supervisor?.name ? <span className="mini"> • Supervisor: {a.supervisor.name}</span> : null}</div>
        </div>
        <span className={`pill ${a.attendance_status}`}>{pretty(a.attendance_status)}</span>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-3">
        {["present","absent","excused"].map((s) => <button key={s} className="btn btn-sm btn-outline-secondary" onClick={() => run(async () => { await markHouseDutyAttendance(a.id, { attendance_status: s }); await reload(); })}>{pretty(s)}</button>)}
        <button className="btn btn-sm btn-outline-primary" onClick={() => setShowRating(!showRating)}>{a.overall_rating ? `Rating ${a.overall_rating}/5` : "Rate Performance"}</button>
        {a.status !== "completed" && <button className="btn btn-sm btn-outline-success" onClick={() => run(async () => { await updateHouseDutyAssignment(a.id, { status: "completed" }); await reload(); })}>Complete</button>}
      </div>
      {showRating && <RatingEditor assignment={a} keys={ratingKeys} busy={false} onSave={(rating, performance_remark) => run(async () => { await rateHouseDutyAssignment(a.id, { rating, performance_remark }); setShowRating(false); await reload(); })} />}
      {a.performance_remark && <div className="mini mt-2"><b>Remark:</b> {a.performance_remark}</div>}
    </div>
  );
}

function AssemblyItemRow({ item, meta, run, reload }) {
  const [showRating, setShowRating] = useState(false);
  const isRateable = !!(item.student_id || item.employee_id);
  const ratingKeys = item.employee_id ? meta.staff_rating_keys || [] : meta.student_rating_keys || [];
  const participant = item.student?.name || item.employee?.name || item.participant_name || (item.participant_type === "group" ? "Group / House" : "—");
  return (
    <div className="assembly-item-row">
      <div className="d-flex justify-content-between gap-2 align-items-start">
        <div><b>{item.sequence_no}. {item.label}</b><div className="mini">{participant}{item.content_summary ? ` • ${item.content_summary}` : ""}</div></div>
        <div className="d-flex gap-1 flex-wrap justify-content-end">
          {["present","absent","excused"].map((st) => <button key={st} className="btn btn-sm btn-outline-secondary" onClick={() => run(async () => { await updateHouseAssemblyItem(item.id, { attendance_status: st }); await reload(); })}>{pretty(st)}</button>)}
          {isRateable && <button className="btn btn-sm btn-outline-primary" onClick={() => setShowRating(!showRating)}>{item.performance_rating ? `${item.performance_rating}/5` : "Rate"}</button>}
        </div>
      </div>
      {showRating && <RatingEditor assignment={{ rating_json: item.rating_json, performance_remark: item.performance_remark }} keys={ratingKeys} busy={false} onSave={(rating, performance_remark) => run(async () => { await updateHouseAssemblyItem(item.id, { rating, performance_remark }); setShowRating(false); await reload(); })} />}
      {item.performance_remark && <div className="mini mt-1"><b>Remark:</b> {item.performance_remark}</div>}
    </div>
  );
}

export default function HouseDutyAssembly() {
  const [meta, setMeta] = useState({ sessions: [], houses: [], wings: [], duty_types: [], positions: [], time_slots: [], leadership_scopes: [] });
  const [tab, setTab] = useState("weekly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [weeks, setWeeks] = useState([]);
  const [weekId, setWeekId] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [competitions, setCompetitions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myData, setMyData] = useState(null);

  const [weekForm, setWeekForm] = useState({ house_id: "", wing_id: "", start_date: today(), end_date: plusDays(today(), 5), title: "", notes: "" });
  const [assigneeType, setAssigneeType] = useState("student");
  const [assignee, setAssignee] = useState(null);
  const [supervisor, setSupervisor] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState({ duty_type_id: "", position_id: "", duty_date: today(), time_slot: "arrival", title: "", location: "", start_time: "", end_time: "", description: "" });
  const [assemblyForm, setAssemblyForm] = useState({ house_id: "", wing_id: "", week_id: "", assembly_date: today(), theme: "", special_note: "" });
  const [assemblyItem, setAssemblyItem] = useState({ program_id: "", label: "Thought of the Day", item_type: "thought", participant_type: "student", sequence_no: 1, content_summary: "" });
  const [assemblyParticipant, setAssemblyParticipant] = useState(null);
  const [competitionForm, setCompetitionForm] = useState({ title: "", category: "", competition_date: today(), wing_id: "", venue: "", winner_points: 10, runner_up_points: 7, third_points: 5 });
  const [competitionSetup, setCompetitionSetup] = useState({ competition_id: "", criteria_text: "Content:20\nPresentation:20\nConfidence:10", houses: [] });
  const [competitionJudge, setCompetitionJudge] = useState(null);
  const [competitionJudges, setCompetitionJudges] = useState([]);
  const [scoreDraft, setScoreDraft] = useState({});
  const [pointsForm, setPointsForm] = useState({ house_id: "", points: "", reason: "", source_type: "manual" });

  const run = async (fn) => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); } catch (e) { setError(e?.response?.data?.message || e.message || "Something went wrong"); }
    finally { setBusy(false); }
  };

  const activeSession = useMemo(() => meta.sessions?.find((s) => String(s.id) === String(sessionId)), [meta.sessions, sessionId]);
  const currentWeek = useMemo(() => weeks.find((w) => String(w.id) === String(weekId)), [weeks, weekId]);
  const selectedCompetition = useMemo(() => competitions.find((c) => String(c.id) === String(competitionSetup.competition_id)), [competitions, competitionSetup.competition_id]);

  const loadMeta = async () => {
    const r = await getHouseDutyBootstrap(); setMeta(r);
    const s = r.sessions?.find((x) => x.is_active) || r.sessions?.[0]; if (!sessionId && s) setSessionId(String(s.id));
    if (!r.can_manage_any) setMyData(await getMyHouseDuties());
  };
  const loadWeeks = async () => { if (!sessionId) return; const r = await getHouseDutyWeeks({ session_id: sessionId }); setWeeks(r.weeks || []); if (!weekId && r.weeks?.[0]) setWeekId(String(r.weeks[0].id)); };
  const loadAssignments = async () => { if (!weekId) { setAssignments([]); return; } const r = await getHouseDutyAssignments({ week_id: weekId }); setAssignments(r.assignments || []); };
  const loadAssemblies = async () => { if (!sessionId) return; const r = await getHouseAssemblies({ session_id: sessionId }); setAssemblies(r.assemblies || []); };
  const loadCompetitions = async () => { if (!sessionId) return; const r = await getHouseCompetitions({ session_id: sessionId }); setCompetitions(r.competitions || []); };
  const loadLeaderboard = async () => { if (!sessionId) return; const r = await getHouseLeaderboard({ session_id: sessionId }); setLeaderboard(r.leaderboard || []); };
  const reloadCore = async () => Promise.all([loadWeeks(), loadAssemblies(), loadCompetitions(), loadLeaderboard()]);

  useEffect(() => { run(loadMeta); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sessionId) run(reloadCore); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (weekId) run(loadAssignments); }, [weekId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (meta.can_manage_any === false && myData) {
    return <div className="container-fluid py-3">
      <div className="house-hero"><h2>🏠 My House Duties & Assembly</h2><p>Your assigned duties, attendance and performance feedback.</p></div>
      <Alert error={error} message={message} />
      <div className="summary-strip"><span>Total Duties <b>{myData.summary?.total || 0}</b></span><span>Rated <b>{myData.summary?.rated || 0}</b></span><span>Average <b>{myData.summary?.average_rating ? `${myData.summary.average_rating}/5` : "—"}</b></span></div>
      <div className="duty-grid">{(myData.duties || []).map((a) => <DutyCard key={a.id} a={a} meta={meta} run={run} reload={async () => setMyData(await getMyHouseDuties())} />)}</div>
    </div>;
  }

  const createWeek = () => run(async () => {
    const r = await createHouseDutyWeek({ ...weekForm, session_id: Number(sessionId), house_id: getId(weekForm.house_id), wing_id: getId(weekForm.wing_id) });
    setMessage("House Duty Week created."); await loadWeeks(); if (r.week?.id) setWeekId(String(r.week.id));
  });
  const createAssignment = () => run(async () => {
    if (!weekId || !assignee) throw new Error("Select duty week and assignee");
    await createHouseDutyAssignment({ ...assignmentForm, week_id: Number(weekId), duty_type_id: getId(assignmentForm.duty_type_id), position_id: getId(assignmentForm.position_id), assignee_type: assigneeType, student_id: assigneeType === "student" ? assignee.id : null, employee_id: assigneeType === "employee" ? assignee.id : null, supervisor_employee_id: supervisor?.id || null });
    setAssignee(null); setMessage("Duty assigned."); await loadAssignments();
  });
  const createAssemblyPlan = () => run(async () => { await createHouseAssembly({ ...assemblyForm, session_id: Number(sessionId), house_id: getId(assemblyForm.house_id), wing_id: getId(assemblyForm.wing_id), week_id: getId(assemblyForm.week_id) }); setMessage("Assembly plan created."); await loadAssemblies(); });
  const addAssemblyLine = () => run(async () => {
    if (!assemblyItem.program_id) throw new Error("Select an assembly");
    await addHouseAssemblyItem(assemblyItem.program_id, { ...assemblyItem, student_id: assemblyItem.participant_type === "student" ? assemblyParticipant?.id : null, employee_id: assemblyItem.participant_type === "employee" ? assemblyParticipant?.id : null, participant_name: assemblyParticipant?.name || null });
    setAssemblyParticipant(null); setMessage("Assembly item added."); await loadAssemblies();
  });
  const createCompetition = () => run(async () => { const r = await createHouseCompetition({ ...competitionForm, session_id: Number(sessionId), wing_id: getId(competitionForm.wing_id) }); setMessage("Competition created."); await loadCompetitions(); if (r.competition?.id) setCompetitionSetup({ ...competitionSetup, competition_id: String(r.competition.id) }); });
  const configureCompetition = () => run(async () => {
    const criteria = competitionSetup.criteria_text.split("\n").map((line) => { const [name, marks] = line.split(":"); return { name: name?.trim(), max_marks: Number(marks) || 10 }; }).filter((c) => c.name);
    const entries = (competitionSetup.houses.length ? competitionSetup.houses : meta.houses.map((h) => h.id)).map((house_id) => ({ house_id: Number(house_id) }));
    await configureHouseCompetition(competitionSetup.competition_id, { criteria, entries, judge_employee_ids: competitionJudges.map((j) => j.id), status: "scoring" }); setMessage("Competition scoring setup saved."); await loadCompetitions();
  });

  return <div className="container-fluid py-3 house-duty-page">
    <div className="house-hero">
      <div><h2>🏠 House Duty, Assembly & Co-Curricular Management</h2><p>Weekly House duty, assembly participation, discipline positions, duty attendance, performance ratings, competitions and House Championship.</p></div>
      <div className="hero-badge">Session: {activeSession?.name || "—"}</div>
    </div>
    <Alert error={error} message={message} />

    <div className="toolbar-card mb-3">
      <label>Session<select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>{meta.sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " (Active)" : ""}</option>)}</select></label>
      <div className="nav nav-pills gap-1">{[
        ["weekly","Weekly Duty"],["attendance","Attendance & Ratings"],["assembly","Assembly"],["competition","Competitions"],["championship","House Championship"],["setup","Setup Guide"]
      ].map(([k,l]) => <button key={k} className={`nav-link ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</button>)}</div>
    </div>

    {tab === "weekly" && <div className="row g-3">
      <div className="col-xl-4"><div className="panel"><h5>Create / Publish Duty Week</h5>
        <label>House<select value={weekForm.house_id} onChange={(e) => setWeekForm({ ...weekForm, house_id: e.target.value })}><option value="">Select House</option>{meta.houses.map((h) => <option key={h.id} value={h.id}>{h.house_name}</option>)}</select></label>
        <label>Wing (optional)<select value={weekForm.wing_id} onChange={(e) => setWeekForm({ ...weekForm, wing_id: e.target.value })}><option value="">Whole House</option>{meta.wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <div className="row g-2"><div className="col"><label>From<input type="date" value={weekForm.start_date} onChange={(e) => setWeekForm({ ...weekForm, start_date: e.target.value })} /></label></div><div className="col"><label>To<input type="date" value={weekForm.end_date} onChange={(e) => setWeekForm({ ...weekForm, end_date: e.target.value })} /></label></div></div>
        <label>Title<input value={weekForm.title} onChange={(e) => setWeekForm({ ...weekForm, title: e.target.value })} placeholder="Blue House Duty Week" /></label>
        <button className="btn btn-primary mt-2" disabled={busy || !weekForm.house_id} onClick={createWeek}>Create Week</button>
      </div></div>
      <div className="col-xl-8"><div className="panel"><div className="d-flex justify-content-between align-items-center"><h5>Duty Weeks</h5>{currentWeek && <button className="btn btn-sm btn-outline-primary" onClick={() => run(() => openHouseDutyWeekPdf(currentWeek.id))}>Print Branded Duty Chart</button>}</div>
        <div className="week-list">{weeks.map((w) => <button key={w.id} className={String(w.id) === String(weekId) ? "active" : ""} onClick={() => setWeekId(String(w.id))}><b>{w.house?.house_name}</b><span>{w.wing?.name || "Whole House"} • {w.start_date} → {w.end_date}</span><small>{pretty(w.status)}</small></button>)}</div>
        {currentWeek && <div className="mt-3 d-flex gap-2"><button className="btn btn-sm btn-success" onClick={() => run(async () => { await updateHouseDutyWeek(currentWeek.id, { status: "published" }); await loadWeeks(); })}>Publish Week</button><button className="btn btn-sm btn-outline-secondary" onClick={() => run(async () => { await updateHouseDutyWeek(currentWeek.id, { status: "completed" }); await loadWeeks(); })}>Complete Week</button></div>}
      </div></div>
      <div className="col-12"><div className="panel"><h5>Assign Duty / Discipline Position</h5>
        {!currentWeek ? <div className="text-muted">Select a duty week first.</div> : <div className="assignment-form-grid">
          <label>Assignee Type<select value={assigneeType} onChange={(e) => { setAssigneeType(e.target.value); setAssignee(null); }}><option value="student">Student</option><option value="employee">Teacher / Staff</option></select></label>
          <div><span className="field-label">Assignee</span><PersonSearch type={assigneeType} houseId={currentWeek.house_id} selected={assignee} onSelect={setAssignee} /></div>
          <div><span className="field-label">Supervising Teacher</span><PersonSearch type="employee" selected={supervisor} onSelect={setSupervisor} /></div>
          <label>Duty Type<select value={assignmentForm.duty_type_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, duty_type_id: e.target.value })}><option value="">Select</option>{meta.duty_types.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>Duty Position<select value={assignmentForm.position_id} onChange={(e) => { const p = meta.positions.find((x) => String(x.id) === e.target.value); setAssignmentForm({ ...assignmentForm, position_id: e.target.value, title: p?.name || assignmentForm.title, location: p?.location || assignmentForm.location, time_slot: p?.default_time_slot || assignmentForm.time_slot, start_time: p?.default_start_time?.slice(0,5) || assignmentForm.start_time, end_time: p?.default_end_time?.slice(0,5) || assignmentForm.end_time }); }}><option value="">Custom / General</option>{meta.positions.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label>Date<input type="date" min={currentWeek.start_date} max={currentWeek.end_date} value={assignmentForm.duty_date} onChange={(e) => setAssignmentForm({ ...assignmentForm, duty_date: e.target.value })} /></label>
          <label>Time Slot<select value={assignmentForm.time_slot} onChange={(e) => setAssignmentForm({ ...assignmentForm, time_slot: e.target.value })}>{(meta.time_slots || []).map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}</select></label>
          <label>Duty Title<input value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} /></label>
          <label>Location<input value={assignmentForm.location} onChange={(e) => setAssignmentForm({ ...assignmentForm, location: e.target.value })} /></label>
          <label>Start<input type="time" value={assignmentForm.start_time} onChange={(e) => setAssignmentForm({ ...assignmentForm, start_time: e.target.value })} /></label>
          <label>End<input type="time" value={assignmentForm.end_time} onChange={(e) => setAssignmentForm({ ...assignmentForm, end_time: e.target.value })} /></label>
          <div className="align-self-end"><button className="btn btn-primary w-100" disabled={busy || !assignee || !assignmentForm.duty_type_id} onClick={createAssignment}>Assign Duty</button></div>
        </div>}
      </div></div>
    </div>}

    {tab === "attendance" && <div className="panel"><div className="d-flex justify-content-between"><h5>Duty Attendance & Performance Ratings</h5><select className="form-select form-select-sm week-select" value={weekId} onChange={(e) => setWeekId(e.target.value)}><option value="">Select Week</option>{weeks.map((w) => <option key={w.id} value={w.id}>{w.house?.house_name} • {w.start_date}</option>)}</select></div>
      <div className="rating-note">Student ratings: punctuality, preparation, responsibility, communication, teamwork, discipline and initiative. Teacher ratings: planning, coordination, student engagement, execution, duty completion and reporting. Teacher duty ratings automatically feed the existing Teacher Performance <b>DUTY</b> component. Student ratings sync into Anecdotal/Student Growth evidence when that module is installed. Duties can be planned specifically for <b>Arrival, Assembly, Break, Dispersal</b> or custom activity time.</div>
      <div className="duty-grid mt-3">{assignments.map((a) => <DutyCard key={a.id} a={a} meta={meta} run={run} reload={loadAssignments} />)}</div>
    </div>}

    {tab === "assembly" && <div className="row g-3">
      <div className="col-lg-4"><div className="panel"><h5>Create Morning Assembly</h5>
        <label>House<select value={assemblyForm.house_id} onChange={(e) => setAssemblyForm({ ...assemblyForm, house_id: e.target.value })}><option value="">Select</option>{meta.houses.map((h) => <option key={h.id} value={h.id}>{h.house_name}</option>)}</select></label>
        <label>Wing<select value={assemblyForm.wing_id} onChange={(e) => setAssemblyForm({ ...assemblyForm, wing_id: e.target.value })}><option value="">Whole School / House</option>{meta.wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>Duty Week<select value={assemblyForm.week_id} onChange={(e) => setAssemblyForm({ ...assemblyForm, week_id: e.target.value })}><option value="">Optional</option>{weeks.map((w) => <option key={w.id} value={w.id}>{w.house?.house_name} • {w.start_date}</option>)}</select></label>
        <label>Date<input type="date" value={assemblyForm.assembly_date} onChange={(e) => setAssemblyForm({ ...assemblyForm, assembly_date: e.target.value })} /></label>
        <label>Theme<input value={assemblyForm.theme} onChange={(e) => setAssemblyForm({ ...assemblyForm, theme: e.target.value })} placeholder="Environment / Values / National Day..." /></label>
        <button className="btn btn-primary mt-2" disabled={busy || !assemblyForm.house_id} onClick={createAssemblyPlan}>Create Assembly</button>
      </div></div>
      <div className="col-lg-8"><div className="panel"><h5>Assembly Program — Prayer, Thought, News, Teacher Talk & More</h5>
        <div className="assembly-items-form">
          <label>Assembly<select value={assemblyItem.program_id} onChange={(e) => setAssemblyItem({ ...assemblyItem, program_id: e.target.value })}><option value="">Select</option>{assemblies.map((a) => <option key={a.id} value={a.id}>{a.assembly_date} • {a.house?.house_name} • {a.theme || "Assembly"}</option>)}</select></label>
          <label>Item<select value={assemblyItem.item_type} onChange={(e) => { const map = { prayer:"Prayer",thought:"Thought of the Day",news:"News",speech:"Speech",quiz:"Quiz / GK",teacher_talk:"Teacher Talk",pledge:"Pledge",anthem:"National Anthem",anchoring:"Anchoring",custom:"Custom" }; setAssemblyItem({ ...assemblyItem, item_type: e.target.value, label: map[e.target.value] }); }}><option value="prayer">Prayer</option><option value="thought">Thought</option><option value="news">News</option><option value="speech">Speech</option><option value="quiz">Quiz / GK</option><option value="teacher_talk">Teacher Talk</option><option value="pledge">Pledge</option><option value="anthem">National Anthem</option><option value="anchoring">Anchoring</option><option value="custom">Custom</option></select></label>
          <label>Label<input value={assemblyItem.label} onChange={(e) => setAssemblyItem({ ...assemblyItem, label: e.target.value })} /></label>
          <label>Participant Type<select value={assemblyItem.participant_type} onChange={(e) => { setAssemblyItem({ ...assemblyItem, participant_type: e.target.value }); setAssemblyParticipant(null); }}><option value="student">Student</option><option value="employee">Teacher</option><option value="group">Group / House</option><option value="none">None</option></select></label>
          {!["group","none"].includes(assemblyItem.participant_type) && <div><span className="field-label">Participant</span><PersonSearch type={assemblyItem.participant_type === "employee" ? "employee" : "student"} selected={assemblyParticipant} onSelect={setAssemblyParticipant} /></div>}
          <label>Sequence<input type="number" min="1" value={assemblyItem.sequence_no} onChange={(e) => setAssemblyItem({ ...assemblyItem, sequence_no: e.target.value })} /></label>
          <label className="wide">Content / Topic<textarea rows="2" value={assemblyItem.content_summary} onChange={(e) => setAssemblyItem({ ...assemblyItem, content_summary: e.target.value })} /></label>
          <div className="align-self-end"><button className="btn btn-primary" disabled={busy || !assemblyItem.program_id} onClick={addAssemblyLine}>Add Item</button></div>
        </div>
        <div className="assembly-list mt-3">{assemblies.map((a) => <div className="assembly-card" key={a.id}><div className="d-flex justify-content-between"><div><b>{a.assembly_date} • {a.house?.house_name}</b><div className="mini">{a.theme || "Morning Assembly"} • {pretty(a.status)}</div></div><div className="d-flex gap-1"><button className="btn btn-sm btn-outline-primary" onClick={() => run(() => openHouseAssemblyPdf(a.id))}>Print</button><button className="btn btn-sm btn-outline-success" onClick={() => run(async () => { await updateHouseAssembly(a.id, { status: "conducted" }); await loadAssemblies(); })}>Conducted</button></div></div>
          <div className="mt-2">{(a.items || []).sort((x,y)=>x.sequence_no-y.sequence_no).map((i) => <AssemblyItemRow key={i.id} item={i} meta={meta} run={run} reload={loadAssemblies} />)}</div></div>)}</div>
      </div></div>
    </div>}

    {tab === "competition" && <div className="row g-3">
      <div className="col-lg-4"><div className="panel"><h5>Create Inter-House Competition</h5>
        <label>Title<input value={competitionForm.title} onChange={(e) => setCompetitionForm({ ...competitionForm, title: e.target.value })} placeholder="Inter-House Debate" /></label>
        <label>Category<input value={competitionForm.category} onChange={(e) => setCompetitionForm({ ...competitionForm, category: e.target.value })} placeholder="Debate / Sports / Cultural / Quiz" /></label>
        <label>Date<input type="date" value={competitionForm.competition_date} onChange={(e) => setCompetitionForm({ ...competitionForm, competition_date: e.target.value })} /></label>
        <label>Wing<select value={competitionForm.wing_id} onChange={(e) => setCompetitionForm({ ...competitionForm, wing_id: e.target.value })}><option value="">All / School</option>{meta.wings.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label>Venue<input value={competitionForm.venue} onChange={(e) => setCompetitionForm({ ...competitionForm, venue: e.target.value })} /></label>
        <div className="row g-2"><div className="col"><label>1st Pts<input type="number" value={competitionForm.winner_points} onChange={(e) => setCompetitionForm({ ...competitionForm, winner_points: e.target.value })} /></label></div><div className="col"><label>2nd<input type="number" value={competitionForm.runner_up_points} onChange={(e) => setCompetitionForm({ ...competitionForm, runner_up_points: e.target.value })} /></label></div><div className="col"><label>3rd<input type="number" value={competitionForm.third_points} onChange={(e) => setCompetitionForm({ ...competitionForm, third_points: e.target.value })} /></label></div></div>
        <button className="btn btn-primary mt-2" disabled={busy || !competitionForm.title} onClick={createCompetition}>Create Competition</button>
      </div></div>
      <div className="col-lg-8"><div className="panel"><h5>Scoring Setup & Results</h5>
        <label>Competition<select value={competitionSetup.competition_id} onChange={(e) => { const id=e.target.value; const c=competitions.find((x)=>String(x.id)===String(id)); setCompetitionSetup({ ...competitionSetup, competition_id: id }); setCompetitionJudges((c?.judges||[]).map((j)=>j.employee).filter(Boolean)); setScoreDraft({}); }}><option value="">Select</option>{competitions.map((c) => <option key={c.id} value={c.id}>{c.competition_date} • {c.title}</option>)}</select></label>
        <label>Criteria (one per line: Name:Max Marks)<textarea rows="4" value={competitionSetup.criteria_text} onChange={(e) => setCompetitionSetup({ ...competitionSetup, criteria_text: e.target.value })} /></label>
        <div className="mb-2"><span className="field-label">Judges</span><PersonSearch type="employee" selected={competitionJudge} onSelect={setCompetitionJudge} />{competitionJudge && <button className="btn btn-sm btn-outline-secondary mt-1" onClick={() => { setCompetitionJudges((rows) => rows.some((j)=>j.id===competitionJudge.id)?rows:[...rows,competitionJudge]); setCompetitionJudge(null); }}>Add Judge</button>}<div className="d-flex flex-wrap gap-1 mt-1">{competitionJudges.map((j)=><span className="badge text-bg-light" key={j.id}>{j.name}<button type="button" className="btn btn-sm p-0 ms-1" onClick={()=>setCompetitionJudges((rows)=>rows.filter((x)=>x.id!==j.id))}>×</button></span>)}</div></div>
        <div className="house-checks"><span className="field-label">Participating Houses</span>{meta.houses.map((h) => <label key={h.id}><input type="checkbox" checked={competitionSetup.houses.includes(h.id)} onChange={(e) => setCompetitionSetup({ ...competitionSetup, houses: e.target.checked ? [...competitionSetup.houses, h.id] : competitionSetup.houses.filter((x) => x !== h.id) })} /> {h.house_name}</label>)}</div>
        <button className="btn btn-outline-primary mt-2" disabled={!competitionSetup.competition_id} onClick={configureCompetition}>Save Scoring Setup</button>
        {selectedCompetition && (selectedCompetition.criteria||[]).length>0 && (selectedCompetition.entries||[]).length>0 && <div className="score-matrix mt-3"><h6>Judge Scoring {meta.actor_employee?.name ? `— ${meta.actor_employee.name}` : ""}</h6>{!meta.actor_employee ? <div className="alert alert-warning py-2">Scoring requires the logged-in account to be linked with an employee/teacher profile.</div> : <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>House</th>{selectedCompetition.criteria.map((c)=><th key={c.id}>{c.name}<div className="mini">/{c.max_marks}</div></th>)}</tr></thead><tbody>{selectedCompetition.entries.map((e)=><tr key={e.id}><td><b>{e.house?.house_name||e.entry_name||`Entry ${e.id}`}</b></td>{selectedCompetition.criteria.map((c)=>{const existing=(e.scores||[]).find((sc)=>Number(sc.criterion_id)===Number(c.id)&&Number(sc.judge_employee_id)===Number(meta.actor_employee?.id));const key=`${e.id}:${c.id}`;return <td key={c.id}><div className="d-flex gap-1"><input className="form-control form-control-sm score-input" type="number" min="0" max={c.max_marks} step="0.5" value={scoreDraft[key] ?? existing?.marks ?? ""} onChange={(ev)=>setScoreDraft({...scoreDraft,[key]:ev.target.value})}/><button className="btn btn-sm btn-outline-success" disabled={scoreDraft[key]==null||scoreDraft[key]===""} onClick={()=>run(async()=>{await scoreHouseCompetition(selectedCompetition.id,{entry_id:e.id,criterion_id:c.id,marks:Number(scoreDraft[key])});await loadCompetitions();setMessage("Score saved.");})}>Save</button></div></td>})}</tr>)}</tbody></table></div>}</div>}
        <div className="competition-list mt-3">{competitions.map((c) => <div className="competition-card" key={c.id}><div className="d-flex justify-content-between gap-2"><div><b>{c.title}</b><div className="mini">{c.competition_date} • {c.category || "Competition"} • {pretty(c.status)}</div></div><div className="d-flex gap-1"><button className="btn btn-sm btn-outline-success" onClick={() => run(async () => { await publishHouseCompetition(c.id); await Promise.all([loadCompetitions(), loadLeaderboard()]); })}>Publish Result</button><button className="btn btn-sm btn-outline-primary" onClick={() => run(() => openHouseCompetitionPdf(c.id))}>Print Result</button></div></div>
          {(c.entries || []).length > 0 && <table className="table table-sm mt-2 mb-0"><thead><tr><th>House</th><th>Score</th><th>Rank</th><th>Points</th></tr></thead><tbody>{[...(c.entries || [])].sort((a,b)=>(a.rank||99)-(b.rank||99)).map((e) => <tr key={e.id}><td>{e.house?.house_name}</td><td>{e.total_score ?? "—"}</td><td>{e.rank ?? "—"}</td><td>{e.house_points_awarded ?? "—"}</td></tr>)}</tbody></table>}</div>)}</div>
        <div className="rating-note mt-3"><b>Fair judging:</b> assign one or more judges. Each judge enters criteria-wise marks; the server averages judges per criterion, ranks Houses and posts published points into the House Championship ledger. House Incharges do not need to score their own House.</div>
      </div></div>
    </div>}

    {tab === "championship" && <div className="row g-3"><div className="col-lg-8"><div className="panel"><div className="d-flex justify-content-between"><h5>🏆 House Championship</h5><button className="btn btn-sm btn-outline-primary" onClick={() => run(() => openHouseLeaderboardPdf(sessionId))}>Print Branded Leaderboard</button></div><div className="leaderboard">{leaderboard.map((h) => <div key={h.id} className={`leader-row rank-${h.rank}`}><span className="rank">#{h.rank}</span><span className="house-dot" style={{ background: h.color || "#64748b" }} /><b>{h.house_name}</b><strong>{h.points} pts</strong>{h.rank === 1 && <span>🏆</span>}</div>)}</div></div></div>
      <div className="col-lg-4"><div className="panel"><h5>Add / Adjust House Points</h5><label>House<select value={pointsForm.house_id} onChange={(e) => setPointsForm({ ...pointsForm, house_id: e.target.value })}><option value="">Select</option>{meta.houses.map((h) => <option key={h.id} value={h.id}>{h.house_name}</option>)}</select></label><label>Points<input type="number" step="0.5" value={pointsForm.points} onChange={(e) => setPointsForm({ ...pointsForm, points: e.target.value })} /></label><label>Reason<textarea rows="3" value={pointsForm.reason} onChange={(e) => setPointsForm({ ...pointsForm, reason: e.target.value })} /></label><button className="btn btn-primary mt-2" disabled={!pointsForm.house_id || !pointsForm.points || !pointsForm.reason} onClick={() => run(async () => { await addHousePoints({ ...pointsForm, session_id: Number(sessionId), house_id: Number(pointsForm.house_id), points: Number(pointsForm.points) }); setPointsForm({ house_id: "", points: "", reason: "", source_type: "manual" }); await loadLeaderboard(); setMessage("House points updated."); })}>Add Points</button></div></div>
    </div>}

    {tab === "setup" && <div className="panel"><h5>How this module works</h5><div className="setup-grid"><div><b>1. Weekly House Rotation</b><p>Overall Activity Incharge / Coordinator sets Blue, Red, Green etc. House duty weeks. House/Wing Incharges can manage only their authorized scope.</p></div><div><b>2. Time-slot Duties</b><p>Duty can be assigned specifically for Arrival Time, Assembly Time, Break Time, Dispersal Time, Activity/Event Time or a custom time. Main Gate, Assembly Ground, Corridors, Lunch Area and Bus Dispersal are pre-seeded.</p></div><div><b>3. Duty Attendance</b><p>Supervising teacher or authorized House leadership marks Present / Absent / Excused / Replaced.</p></div><div><b>4. Fair Ratings</b><p>Students are rated by supervisor/House leadership. Staff cannot rate themselves; teacher duty rating requires higher House/Activity leadership or management.</p></div><div><b>5. Teacher Performance</b><p>Teacher duty rating (1–5) is normalized to 20–100 and synced into existing Teacher Performance DUTY evidence, without directly overwriting overall score.</p></div><div><b>6. Student Growth</b><p>Every student duty keeps attendance + criteria-wise performance rating. When Anecdotal Records is installed, ratings also create/update leadership-duty growth evidence for recognition and Student 360.</p></div><div><b>7. Assembly</b><p>Prayer, thought, news, speech, quiz, teacher talk, pledge, anthem, anchoring and custom items with participant attendance/performance.</p></div><div><b>8. House Competitions</b><p>Criteria-wise judge scoring, ranks, House points and annual House Championship leaderboard.</p></div></div></div>}
  </div>;
}
