import React, { useCallback, useEffect, useMemo, useState } from "react";
import anecdotalApi from "../services/anecdotalApi";

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3000").replace(/\/$/, "");
const msg = (e) => e?.response?.data?.message || e?.message || "Something went wrong.";
const asset = (u) => !u ? "" : (/^https?:\/\//i.test(u) ? u : `${API_BASE}${String(u).startsWith("/") ? "" : "/"}${u}`);
const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${today().slice(0, 8)}01`;

function StudentAvatar({ student, size = 52 }) {
  const src = asset(student?.photo_url || student?.photo);
  if (src) return <img src={src} alt="" className="rounded-circle border" style={{ width: size, height: size, objectFit: "cover" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />;
  return <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-secondary" style={{ width: size, height: size }}>{String(student?.name || "S").slice(0,1).toUpperCase()}</div>;
}

function RatingStars({ value }) {
  if (value == null) return <span className="text-muted">Not rated</span>;
  return <span className="fw-semibold">{Number(value).toFixed(2)} / 5</span>;
}

function ObservationCard({ row }) {
  const toneClass = { positive: "success", neutral: "secondary", developmental: "warning", concern: "danger" }[row?.tone] || "secondary";
  return (
    <div className="card border-0 shadow-sm mb-3">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
          <div>
            <span className={`badge text-bg-${toneClass} me-2`}>{row?.tone || "neutral"}</span>
            <span className="fw-semibold">{row?.category || "Observation"}</span>
          </div>
          <div className="small text-muted">{new Date(row?.observed_at).toLocaleString()} • {row?.observer?.name || "Teacher"}</div>
        </div>
        {row?.student && <div className="small fw-semibold mb-2">{row.student.name} • Roll {row.student.roll_number || "-"}</div>}
        <div style={{ whiteSpace: "pre-wrap" }}>{row?.observation_text}</div>
        {row?.context_text && <div className="small text-muted mt-2"><strong>Context:</strong> {row.context_text}</div>}
        {row?.follow_up_text && <div className="small mt-2"><strong>Follow-up:</strong> {row.follow_up_text}</div>}
        {!!row?.ratings?.length && (
          <div className="d-flex flex-wrap gap-2 mt-3">
            {row.ratings.map((r) => <span key={r.id || r.dimension_id} className="badge rounded-pill text-bg-light border text-dark">{r.dimension?.name || "Rating"}: {r.rating}/5</span>)}
          </div>
        )}
        <div className="small text-muted mt-2">{row?.visible_to_student_parent ? "Visible to student/parent" : "Internal staff note"}{row?.recognition_eligible === false ? " • Not used for recognition" : ""}</div>
      </div>
    </div>
  );
}

function MyGrowthRecord({ data, loading }) {
  if (loading) return <div className="text-center p-5"><div className="spinner-border" /></div>;
  return (
    <>
      <div className="alert alert-info border-0 shadow-sm"><i className="bi bi-shield-check me-2" />Only observations specifically shared with the student/parent are shown here. Internal counselling/concern notes stay restricted to authorized staff.</div>
      {!!data?.recognitions?.length && <div className="mb-4"><h5 className="mb-3">Recognition</h5><div className="row g-3">{data.recognitions.map((r) => <div className="col-md-6 col-xl-4" key={r.id}><div className="card h-100 border-0 shadow-sm"><div className="card-body"><div className="fs-2 mb-2">🏆</div><h6 className="mb-1">{String(r.recognition_type || "recognition").replaceAll("_", " ")}</h6><div className="small text-muted">{r.period_month ? `${r.period_month}/` : ""}{r.period_year}</div>{r.citation_text && <div className="mt-2">{r.citation_text}</div>}</div></div></div>)}</div></div>}
      <h5 className="mb-3">Shared Observations</h5>
      {data?.observations?.length ? data.observations.map((o) => <ObservationCard key={o.id} row={o} />) : <div className="card border-0 shadow-sm"><div className="card-body text-muted">No shared observations yet.</div></div>}
    </>
  );
}

export default function AnecdotalRecords() {
  const [cap, setCap] = useState(null);
  const [dimensions, setDimensions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [pairKey, setPairKey] = useState("");
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [observations, setObservations] = useState([]);
  const [myData, setMyData] = useState(null);
  const [tab, setTab] = useState("record");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [classSummary, setClassSummary] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [period, setPeriod] = useState("month");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [recognitionScope, setRecognitionScope] = useState("class");

  const [form, setForm] = useState({
    category: "Academic Progress", tone: "positive", observed_at: new Date().toISOString().slice(0,16),
    observation_text: "", context_text: "", follow_up_text: "", follow_up_due_at: "",
    visible_to_student_parent: false, recognition_eligible: true, ratings: {},
  });

  const selectedPair = useMemo(() => classes.find((p) => `${p.class_id}:${p.section_id}` === pairKey) || null, [classes, pairKey]);
  const selectedStudent = useMemo(() => students.find((s) => String(s.id) === String(studentId)) || null, [students, studentId]);

  const bootstrap = useCallback(async () => {
    setError("");
    try {
      const [c, d] = await Promise.all([anecdotalApi.capabilities(), anecdotalApi.dimensions()]);
      const capabilities = c.data;
      setCap(capabilities);
      setDimensions(d.data?.dimensions || []);
      if (capabilities?.is_student_or_parent) {
        setTab("mine");
        const mine = await anecdotalApi.myRecord();
        setMyData(mine.data);
      } else {
        const cl = await anecdotalApi.classes();
        const pairs = cl.data?.classes || [];
        setClasses(pairs);
        if (pairs.length) setPairKey(`${pairs[0].class_id}:${pairs[0].section_id}`);
      }
    } catch (e) { setError(msg(e)); }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  useEffect(() => {
    if (!selectedPair || cap?.is_student_or_parent) return;
    (async () => {
      try {
        const r = await anecdotalApi.students({ class_id: selectedPair.class_id, section_id: selectedPair.section_id });
        const rows = r.data?.students || [];
        setStudents(rows);
        setStudentId(rows[0]?.id ? String(rows[0].id) : "");
      } catch (e) { setError(msg(e)); }
    })();
  }, [selectedPair, cap?.is_student_or_parent]);

  const loadObservations = useCallback(async () => {
    if (!selectedPair) return;
    try {
      const r = await anecdotalApi.observations({ class_id: selectedPair.class_id, section_id: selectedPair.section_id, ...(studentId ? { student_id: studentId } : {}), from, to, limit: 150 });
      setObservations(r.data?.observations || []);
    } catch (e) { setError(msg(e)); }
  }, [selectedPair, studentId, from, to]);

  useEffect(() => { if (tab === "record" || tab === "timeline") loadObservations(); }, [tab, loadObservations]);

  const submitObservation = async (e) => {
    e.preventDefault();
    if (!studentId || !form.observation_text.trim()) return;
    const ratings = Object.entries(form.ratings).filter(([,v]) => v).map(([dimension_id, rating]) => ({ dimension_id: Number(dimension_id), rating: Number(rating) }));
    setBusy(true); setError(""); setSuccess("");
    try {
      await anecdotalApi.createObservation({ ...form, student_id: Number(studentId), ratings });
      setSuccess("Observation saved successfully.");
      setForm((f) => ({ ...f, observation_text: "", context_text: "", follow_up_text: "", follow_up_due_at: "", ratings: {}, observed_at: new Date().toISOString().slice(0,16) }));
      await loadObservations();
    } catch (e2) { setError(msg(e2)); } finally { setBusy(false); }
  };

  const loadClassSummary = async () => {
    if (!selectedPair) return;
    setBusy(true); setError("");
    try { const r = await anecdotalApi.classSummary({ class_id: selectedPair.class_id, section_id: selectedPair.section_id, from, to }); setClassSummary(r.data?.students || []); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    if (!selectedPair) return;
    setBusy(true); setError("");
    try { await anecdotalApi.downloadClassPdf({ class_id: selectedPair.class_id, section_id: selectedPair.section_id, from, to }); }
    catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  const loadLeaderboard = async () => {
    setBusy(true); setError("");
    try {
      const params = { period, year: periodYear, ...(period === "month" ? { month: periodMonth } : {}), scope: recognitionScope };
      if (recognitionScope === "class") Object.assign(params, { class_id: selectedPair?.class_id, section_id: selectedPair?.section_id });
      const r = await anecdotalApi.leaderboard(params);
      setLeaderboard(r.data?.leaderboard || []);
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  const publishRecognition = async (row) => {
    const citation = window.prompt("Short citation / reason for recognition (optional):", "Consistent positive effort, responsibility and contribution.");
    if (citation === null) return;
    setBusy(true); setError("");
    try {
      await anecdotalApi.saveRecognition({
        student_id: row.student.id,
        recognition_type: period === "year" ? "student_of_year" : "student_of_month",
        scope: recognitionScope,
        period_year: Number(periodYear),
        period_month: period === "month" ? Number(periodMonth) : null,
        citation_text: citation,
        status: "published",
      });
      setSuccess("Recognition published to the student record.");
    } catch (e) { setError(msg(e)); } finally { setBusy(false); }
  };

  if (!cap) return <div className="container-fluid py-4"><div className="text-center p-5"><div className="spinner-border" /></div>{error && <div className="alert alert-danger">{error}</div>}</div>;

  if (cap.is_student_or_parent) return <div className="container-fluid py-4"><div className="d-flex align-items-center gap-3 mb-4"><div className="rounded-3 bg-primary-subtle text-primary p-3"><i className="bi bi-stars fs-3" /></div><div><h3 className="mb-1">My Growth & Recognition</h3><div className="text-muted">Shared teacher observations and school recognition</div></div></div><MyGrowthRecord data={myData} loading={!myData} /></div>;

  const canClassTools = !!selectedPair?.incharge || !!cap.can_view_all;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div className="d-flex align-items-center gap-3"><div className="rounded-3 bg-primary-subtle text-primary p-3"><i className="bi bi-journal-check fs-3" /></div><div><h3 className="mb-1">Anecdotal Records</h3><div className="text-muted">Teacher observations • ratings • class PDF • Student of the Month / Year</div></div></div>
        <div className="small text-muted text-end">Rating = 1–5<br/>Recognition remains human-approved</div>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {success && <div className="alert alert-success py-2">{success}</div>}

      <div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-3 align-items-end">
        <div className="col-md-5"><label className="form-label fw-semibold">Class / Section</label><select className="form-select" value={pairKey} onChange={(e) => setPairKey(e.target.value)}>{classes.map((p) => <option key={`${p.class_id}:${p.section_id}`} value={`${p.class_id}:${p.section_id}`}>{p.class_name} - {p.section_name}{p.incharge ? " (Incharge)" : ""}</option>)}</select></div>
        <div className="col-md-4"><label className="form-label fw-semibold">Student</label><select className="form-select" value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">All students</option>{students.map((s) => <option key={s.id} value={s.id}>{s.roll_number ? `${s.roll_number}. ` : ""}{s.name} ({s.admission_number || "-"})</option>)}</select></div>
        <div className="col-md-3"><div className="small text-muted">Teachers can access only assigned students. Class incharge receives full class report/recognition tools.</div></div>
      </div></div></div>

      <ul className="nav nav-pills gap-2 mb-4">
        <li className="nav-item"><button className={`nav-link ${tab === "record" ? "active" : ""}`} onClick={() => setTab("record")}><i className="bi bi-pencil-square me-2"/>Record Observation</button></li>
        <li className="nav-item"><button className={`nav-link ${tab === "timeline" ? "active" : ""}`} onClick={() => setTab("timeline")}><i className="bi bi-clock-history me-2"/>Timeline</button></li>
        {canClassTools && <li className="nav-item"><button className={`nav-link ${tab === "class" ? "active" : ""}`} onClick={() => { setTab("class"); loadClassSummary(); }}><i className="bi bi-file-earmark-pdf me-2"/>Class Report</button></li>}
        {canClassTools && cap.can_class_recognition && <li className="nav-item"><button className={`nav-link ${tab === "recognition" ? "active" : ""}`} onClick={() => setTab("recognition")}><i className="bi bi-trophy me-2"/>Recognition</button></li>}
      </ul>

      {tab === "record" && (
        <div className="row g-4">
          <div className="col-xl-7">
            <form className="card border-0 shadow-sm" onSubmit={submitObservation}><div className="card-body p-4">
              <div className="d-flex align-items-center gap-3 mb-4"><StudentAvatar student={selectedStudent}/><div><h5 className="mb-1">{selectedStudent?.name || "Select a student"}</h5><div className="small text-muted">Record a specific, factual observation and rate only dimensions you actually observed.</div></div></div>
              <div className="row g-3">
                <div className="col-md-5"><label className="form-label">Category *</label><select className="form-select" value={form.category} onChange={(e) => setForm({...form, category:e.target.value})}>{(cap.categories || []).map((x) => <option key={x}>{x}</option>)}</select></div>
                <div className="col-md-3"><label className="form-label">Type *</label><select className="form-select" value={form.tone} onChange={(e) => setForm({...form, tone:e.target.value})}><option value="positive">Positive</option><option value="neutral">Neutral</option><option value="developmental">Developmental</option><option value="concern">Concern</option></select></div>
                <div className="col-md-4"><label className="form-label">Observed at</label><input type="datetime-local" className="form-control" value={form.observed_at} onChange={(e) => setForm({...form, observed_at:e.target.value})}/></div>
                <div className="col-12"><label className="form-label">Observation *</label><textarea className="form-control" rows="4" required value={form.observation_text} onChange={(e) => setForm({...form, observation_text:e.target.value})} placeholder="What exactly was seen/heard? Keep it factual and specific."/></div>
                <div className="col-md-6"><label className="form-label">Context</label><input className="form-control" value={form.context_text} onChange={(e) => setForm({...form, context_text:e.target.value})} placeholder="e.g. Science group activity / morning assembly"/></div>
                <div className="col-md-6"><label className="form-label">Follow-up due</label><input type="date" className="form-control" value={form.follow_up_due_at} onChange={(e) => setForm({...form, follow_up_due_at:e.target.value})}/></div>
                <div className="col-12"><label className="form-label">Follow-up / support note</label><textarea className="form-control" rows="2" value={form.follow_up_text} onChange={(e) => setForm({...form, follow_up_text:e.target.value})}/></div>
              </div>
              <hr className="my-4"/><h6>Observation Ratings <span className="text-muted fw-normal">(optional per dimension)</span></h6><div className="row g-3">{dimensions.map((d) => <div className="col-md-6" key={d.id}><div className="border rounded-3 p-3 h-100"><div className="fw-semibold mb-1">{d.name}</div><div className="small text-muted mb-2">{d.description}</div><select className="form-select form-select-sm" value={form.ratings[d.id] || ""} onChange={(e) => setForm({...form, ratings:{...form.ratings,[d.id]:e.target.value}})}><option value="">Not rated</option><option value="1">1 - Needs significant support</option><option value="2">2 - Developing</option><option value="3">3 - Consistent / expected</option><option value="4">4 - Strong</option><option value="5">5 - Outstanding</option></select></div></div>)}</div>
              <div className="d-flex flex-wrap gap-4 mt-4"><div className="form-check"><input className="form-check-input" type="checkbox" checked={form.visible_to_student_parent} onChange={(e) => setForm({...form, visible_to_student_parent:e.target.checked})}/><label className="form-check-label">Share this observation with student/parent</label></div><div className="form-check"><input className="form-check-input" type="checkbox" checked={form.recognition_eligible} onChange={(e) => setForm({...form, recognition_eligible:e.target.checked})}/><label className="form-check-label">Eligible for recognition score</label></div></div>
            </div><div className="card-footer bg-white border-0 p-4 pt-0 text-end"><button className="btn btn-primary px-4" disabled={busy || !selectedStudent}>{busy ? "Saving..." : <><i className="bi bi-check2-circle me-2"/>Save Observation</>}</button></div></form>
          </div>
          <div className="col-xl-5"><h6 className="mb-3">Recent observations {selectedStudent ? `— ${selectedStudent.name}` : ""}</h6>{observations.slice(0,8).map((o) => <ObservationCard key={o.id} row={o}/>)}{!observations.length && <div className="text-muted">No records in selected period.</div>}</div>
        </div>
      )}

      {tab === "timeline" && <><div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-3 align-items-end"><div className="col-md-4"><label className="form-label">From</label><input type="date" className="form-control" value={from} onChange={(e)=>setFrom(e.target.value)}/></div><div className="col-md-4"><label className="form-label">To</label><input type="date" className="form-control" value={to} onChange={(e)=>setTo(e.target.value)}/></div><div className="col-md-4"><button className="btn btn-outline-primary w-100" onClick={loadObservations}>Refresh Timeline</button></div></div></div></div>{observations.map((o)=><ObservationCard key={o.id} row={o}/>)}{!observations.length && <div className="text-muted">No observations found.</div>}</>}

      {tab === "class" && <><div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-3 align-items-end"><div className="col-md-3"><label className="form-label">From</label><input type="date" className="form-control" value={from} onChange={(e)=>setFrom(e.target.value)}/></div><div className="col-md-3"><label className="form-label">To</label><input type="date" className="form-control" value={to} onChange={(e)=>setTo(e.target.value)}/></div><div className="col-md-3"><button className="btn btn-outline-primary w-100" onClick={loadClassSummary}>Load Full Class</button></div><div className="col-md-3"><button className="btn btn-danger w-100" onClick={downloadPdf} disabled={busy}><i className="bi bi-file-earmark-pdf me-2"/>Download Branded PDF</button></div></div></div></div><div className="row g-3">{classSummary.map((r)=><div className="col-lg-6" key={r.student.id}><div className="card h-100 border-0 shadow-sm"><div className="card-body"><div className="d-flex gap-3"><StudentAvatar student={r.student} size={64}/><div className="flex-grow-1"><h6 className="mb-1">{r.student.name}</h6><div className="small text-muted">Roll {r.student.roll_number || "-"} • {r.observation_count} observations • {r.observer_count} teachers</div><div className="mt-2"><RatingStars value={r.rating_average}/></div></div></div>{!!r.dimension_scores?.length && <div className="d-flex flex-wrap gap-1 mt-3">{r.dimension_scores.map((d)=><span className="badge text-bg-light border text-dark" key={d.dimension_id}>{d.name}: {Number(d.score).toFixed(1)}</span>)}</div>}</div></div></div>)}</div></>}

      {tab === "recognition" && <><div className="alert alert-warning border-0 shadow-sm"><strong>Fairness guard:</strong> the score averages each teacher first so repeated entries by one teacher do not dominate. Minimum independent teacher observations are required. The system only recommends; an authorized class incharge/coordinator/admin makes the final selection.</div><div className="card border-0 shadow-sm mb-4"><div className="card-body"><div className="row g-3 align-items-end"><div className="col-md-2"><label className="form-label">Period</label><select className="form-select" value={period} onChange={(e)=>setPeriod(e.target.value)}><option value="month">Month</option><option value="year">Year</option></select></div><div className="col-md-2"><label className="form-label">Year</label><input type="number" className="form-control" value={periodYear} onChange={(e)=>setPeriodYear(e.target.value)}/></div>{period === "month" && <div className="col-md-2"><label className="form-label">Month</label><select className="form-select" value={periodMonth} onChange={(e)=>setPeriodMonth(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(2000,i,1).toLocaleString(undefined,{month:"long"})}</option>)}</select></div>}<div className="col-md-3"><label className="form-label">Scope</label><select className="form-select" value={recognitionScope} onChange={(e)=>setRecognitionScope(e.target.value)}><option value="class">Current Class</option>{cap.can_school_recognition && <option value="school">Whole School</option>}</select></div><div className="col-md-3"><button className="btn btn-primary w-100" onClick={loadLeaderboard} disabled={busy}><i className="bi bi-calculator me-2"/>Calculate Ranking</button></div></div></div></div><div className="card border-0 shadow-sm"><div className="table-responsive"><table className="table align-middle mb-0"><thead className="table-light"><tr><th>#</th><th>Student</th><th>Score</th><th>Evidence</th><th>Status</th><th></th></tr></thead><tbody>{leaderboard.map((r,i)=><tr key={r.student.id}><td className="fw-bold">{i+1}</td><td><div className="d-flex align-items-center gap-2"><StudentAvatar student={r.student} size={38}/><div><div className="fw-semibold">{r.student.name}</div><div className="small text-muted">Roll {r.student.roll_number || "-"}</div></div></div></td><td><RatingStars value={r.score}/></td><td className="small">{r.observation_count} observations<br/>{r.observer_count} teachers</td><td>{r.eligible ? <span className="badge text-bg-success">Eligible</span> : <span className="badge text-bg-secondary" title={(r.eligibility_reasons||[]).join("; ")}>Need more evidence</span>}</td><td className="text-end"><button className="btn btn-sm btn-outline-success" disabled={!r.eligible || busy} onClick={()=>publishRecognition(r)}><i className="bi bi-trophy me-1"/>Select & Publish</button></td></tr>)}</tbody></table></div>{!leaderboard.length && <div className="card-body text-muted">Choose the period and calculate the ranking.</div>}</div></>}
    </div>
  );
}
