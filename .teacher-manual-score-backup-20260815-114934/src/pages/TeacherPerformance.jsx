import React, { useCallback, useEffect, useMemo, useState } from "react";
import teacherPerformanceApi from "../services/teacherPerformanceApi";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
const errMsg = (e) => e?.response?.data?.message || e?.message || "Something went wrong.";

const DAY_TYPE_LABELS = {
  TEACHING: "Teaching Day",
  NON_TEACHING: "Non-Teaching Working Day",
  HOLIDAY: "Holiday",
  EXAM: "Exam / No Regular Teaching",
  ACTIVITY: "Activity / Event",
  PTM: "PTM",
  TRAINING: "Training",
  OFFICIAL_DUTY: "Official Duty",
  LEAVE: "Leave",
  EXEMPT: "Exempt",
  OTHER: "Other",
};

function ScoreRing({ score = 0, delta = 0, provisional = false }) {
  const s = Number(score || 0);
  const tone = s >= 85 ? "success" : s >= 70 ? "primary" : s >= 55 ? "warning" : "danger";
  return (
    <div className={`card border-${tone} shadow-sm h-100`}>
      <div className="card-body text-center d-flex flex-column justify-content-center">
        <div className="text-muted small text-uppercase fw-semibold">Professional Growth Score</div>
        <div className={`display-3 fw-bold text-${tone}`}>{s.toFixed(1)}</div>
        <div className="fw-semibold">/ 100</div>
        <div className={`mt-2 ${Number(delta) > 0 ? "text-success" : Number(delta) < 0 ? "text-danger" : "text-muted"}`}>
          {Number(delta) > 0 ? "▲" : Number(delta) < 0 ? "▼" : "•"} {Math.abs(Number(delta || 0)).toFixed(1)} from previous snapshot
        </div>
        {provisional && <span className="badge text-bg-warning mt-2 align-self-center">Provisional • evidence still building</span>}
      </div>
    </div>
  );
}

function ComponentCard({ c }) {
  const score = c?.score == null ? null : Number(c.score);
  const tone = score == null ? "secondary" : score >= 85 ? "success" : score >= 70 ? "primary" : score >= 55 ? "warning" : "danger";
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between gap-2">
          <div>
            <div className="fw-semibold">{c.label}</div>
            <div className="small text-muted">Weight {Number(c.weight || 0).toFixed(0)}%</div>
          </div>
          <span className={`badge text-bg-${tone} align-self-start`}>{score == null ? "N/A" : score.toFixed(1)}</span>
        </div>
        <div className="progress mt-3" style={{ height: 8 }}>
          <div className={`progress-bar bg-${tone}`} style={{ width: `${score == null ? 0 : Math.max(0, Math.min(100, score))}%` }} />
        </div>
        {!!c?.reasons?.length && <div className="small text-muted mt-3">{c.reasons[0]}</div>}
        {!!c?.metrics && <div className="small mt-2 text-secondary">{Object.entries(c.metrics).slice(0, 3).map(([k, v]) => <span className="me-3" key={k}><b>{String(k).replaceAll("_", " ")}:</b> {String(v)}</span>)}</div>}
      </div>
    </div>
  );
}

function TrendStrip({ rows = [] }) {
  if (!rows.length) return <div className="text-muted small">Trend will build as daily snapshots are saved.</div>;
  const min = Math.min(...rows.map((r) => Number(r.overall_score || 0)), 50);
  const max = 100;
  return (
    <div className="d-flex align-items-end gap-1" style={{ minHeight: 110, overflowX: "auto" }}>
      {rows.map((r) => {
        const value = Number(r.overall_score || 0);
        const h = 18 + ((value - min) / Math.max(1, max - min)) * 75;
        return <div key={`${r.snapshot_date}-${r.id}`} title={`${r.snapshot_date}: ${value.toFixed(1)}`} className="text-center" style={{ minWidth: 24 }}>
          <div className="bg-primary rounded-top mx-auto" style={{ width: 14, height: Math.max(8, h) }} />
          <div className="text-muted" style={{ fontSize: 9, transform: "rotate(-45deg)", marginTop: 10 }}>{String(r.snapshot_date).slice(5)}</div>
        </div>;
      })}
    </div>
  );
}

export default function TeacherPerformance() {
  const [cap, setCap] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [dashboard, setDashboard] = useState(null);
  const [trend, setTrend] = useState([]);
  const [team, setTeam] = useState([]);
  const [weights, setWeights] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [overrides, setOverrides] = useState([]);
  const [manualEntries, setManualEntries] = useState([]);
  const [aiInsight, setAiInsight] = useState("");
  const [aiSource, setAiSource] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [overrideForm, setOverrideForm] = useState({ override_date: today(), day_type: "NON_TEACHING", teaching_expected: false, attendance_expected: true, reason: "", evidence_url: "" });
  const [manualForm, setManualForm] = useState({ entry_type: "DUTY", title: "", entry_date: today(), rating: 100, score_delta: 0, description: "", evidence_url: "" });

  const isManager = cap?.is_manager === true;
  const selectedTeacherId = useMemo(() => isManager ? (teacherId || teachers?.[0]?.id || "") : cap?.user_id || "", [isManager, teacherId, teachers, cap]);
  const selectedTeacher = useMemo(() => teachers.find((t) => String(t.id) === String(selectedTeacherId)) || dashboard?.teacher || null, [teachers, selectedTeacherId, dashboard]);
  const weightTotal = useMemo(() => weights.reduce((s, w) => s + (w.enabled === false ? 0 : Number(w.weight_percent || 0)), 0), [weights]);

  const loadDashboard = useCallback(async (tid = selectedTeacherId) => {
    if (!tid) return;
    const params = { month };
    if (isManager) params.teacher_user_id = tid;
    const [d, t] = await Promise.all([
      isManager ? teacherPerformanceApi.dashboard(params) : teacherPerformanceApi.myDashboard(params),
      teacherPerformanceApi.trend({ ...params, period_key: month, limit: 40 }),
    ]);
    setDashboard(d.data?.data || null);
    setTrend(t.data?.snapshots || []);
    setAiInsight("");
    setAiSource("");
  }, [isManager, month, selectedTeacherId]);

  const loadManagerData = useCallback(async (tid = selectedTeacherId) => {
    if (!isManager) return;
    const [w, o, m] = await Promise.all([
      teacherPerformanceApi.weights({ date: `${month}-28` }),
      tid ? teacherPerformanceApi.overrides({ teacher_user_id: tid, month }) : Promise.resolve({ data: { overrides: [] } }),
      tid ? teacherPerformanceApi.manualEntries({ teacher_user_id: tid, month }) : Promise.resolve({ data: { entries: [] } }),
    ]);
    setWeights((w.data?.active?.weights || []).map((x) => ({ ...x })));
    setWeightHistory(w.data?.history || []);
    setEffectiveFrom(today());
    setOverrides(o.data?.overrides || []);
    setManualEntries(m.data?.entries || []);
  }, [isManager, month, selectedTeacherId]);

  useEffect(() => {
    (async () => {
      setBusy(true); setError("");
      try {
        const c = await teacherPerformanceApi.capabilities();
        const capData = c.data || {};
        setCap(capData);
        if (capData.is_manager) {
          const tr = await teacherPerformanceApi.teachers();
          const list = tr.data?.teachers || [];
          setTeachers(list);
          if (list.length) setTeacherId(String(list[0].id));
        }
      } catch (e) { setError(errMsg(e)); }
      finally { setBusy(false); }
    })();
  }, []);

  useEffect(() => {
    if (!cap?.user_id || !selectedTeacherId) return;
    (async () => {
      setBusy(true); setError("");
      try { await loadDashboard(selectedTeacherId); await loadManagerData(selectedTeacherId); }
      catch (e) { setError(errMsg(e)); }
      finally { setBusy(false); }
    })();
  }, [cap?.user_id, selectedTeacherId, month, loadDashboard, loadManagerData]);

  const loadTeam = async () => {
    if (!isManager) return;
    setBusy(true); setError("");
    try { const r = await teacherPerformanceApi.teamSummary({ month }); setTeam(r.data?.teachers || []); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };

  const saveWeights = async () => {
    setMessage(""); setError("");
    if (Math.abs(weightTotal - 100) > 0.01) return setError(`Weightage must total exactly 100%. Current total: ${weightTotal.toFixed(2)}%`);
    setBusy(true);
    try {
      await teacherPerformanceApi.saveWeights({ effective_from: effectiveFrom, weights });
      setMessage("New weightage version saved. Historical periods keep their effective version.");
      await loadManagerData(selectedTeacherId);
      await loadDashboard(selectedTeacherId);
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };

  const setOverrideType = (type) => {
    const offsite = ["HOLIDAY", "EXAM", "ACTIVITY", "PTM", "TRAINING", "OFFICIAL_DUTY", "LEAVE", "EXEMPT"].includes(type);
    setOverrideForm((p) => ({ ...p, day_type: type, teaching_expected: type === "TEACHING", attendance_expected: type === "TEACHING" || type === "NON_TEACHING" || type === "OTHER" ? true : !offsite }));
  };

  const saveOverride = async () => {
    if (!selectedTeacherId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await teacherPerformanceApi.saveOverride({ teacher_user_id: Number(selectedTeacherId), ...overrideForm });
      setMessage("Teacher-specific day rule saved. It takes priority over Academic Calendar for that teacher.");
      setOverrideForm((p) => ({ ...p, reason: "", evidence_url: "" }));
      await loadManagerData(selectedTeacherId); await loadDashboard(selectedTeacherId);
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };

  const saveManual = async () => {
    if (!selectedTeacherId) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { teacher_user_id: Number(selectedTeacherId), ...manualForm, rating: manualForm.entry_type === "ADJUSTMENT" ? null : Number(manualForm.rating), score_delta: manualForm.entry_type === "ADJUSTMENT" ? Number(manualForm.score_delta) : null };
      await teacherPerformanceApi.createManualEntry(payload);
      setMessage("Manual performance evidence added with audit trail.");
      setManualForm((p) => ({ ...p, title: "", description: "", evidence_url: "" }));
      await loadManagerData(selectedTeacherId); await loadDashboard(selectedTeacherId);
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };

  const generateInsight = async () => {
    setBusy(true); setError("");
    try {
      const payload = { month };
      if (isManager) payload.teacher_user_id = Number(selectedTeacherId);
      const r = await teacherPerformanceApi.aiInsight(payload);
      setAiInsight(r.data?.insight?.text || "No insight generated.");
      setAiSource(r.data?.insight?.source || "");
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    const params = { month };
    if (isManager) params.teacher_user_id = selectedTeacherId;
    await teacherPerformanceApi.downloadPdf(params);
  };

  if (busy && !cap?.user_id) return <div className="container py-5 text-center"><div className="spinner-border" /></div>;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 className="mb-1">Teacher Performance Intelligence</h2>
          <div className="text-muted">Evidence-based professional growth score • automatic ERP checks • transparent reasons • AI explanation</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 170 }} />
          {isManager && <select className="form-select" value={selectedTeacherId} onChange={(e) => setTeacherId(e.target.value)} style={{ minWidth: 260 }}>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} {t.designation ? `• ${t.designation}` : ""}</option>)}
          </select>}
          <button className="btn btn-outline-dark" onClick={downloadPdf} disabled={!dashboard}>PDF</button>
          <button className="btn btn-primary" onClick={() => loadDashboard(selectedTeacherId)} disabled={busy}>Refresh Score</button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {isManager && <ul className="nav nav-tabs mb-4">
        {[['dashboard','Performance'],['team','Team Overview'],['weights','Weightage'],['overrides','Teacher Day Overrides'],['manual','Duties & Achievements']].map(([k,l]) => <li className="nav-item" key={k}><button className={`nav-link ${tab===k?'active':''}`} onClick={() => { setTab(k); if(k==='team' && !team.length) loadTeam(); }}>{l}</button></li>)}
      </ul>}

      {(!isManager || tab === "dashboard") && dashboard && <>
        <div className="row g-3 mb-4">
          <div className="col-xl-3"><ScoreRing score={dashboard.overall_score} delta={dashboard.delta_from_previous_snapshot} provisional={dashboard.provisional} /></div>
          <div className="col-xl-9">
            <div className="card border-0 shadow-sm h-100"><div className="card-body">
              <div className="d-flex justify-content-between flex-wrap gap-2"><div><h5 className="mb-1">{selectedTeacher?.name || dashboard.teacher?.name}</h5><div className="text-muted">{selectedTeacher?.designation || dashboard.teacher?.designation} • {dashboard.period?.start} to {dashboard.period?.end}</div></div><div className="text-end"><div className="small text-muted">Evidence coverage</div><div className="h5">{Number(dashboard.coverage_percent || 0).toFixed(1)}%</div></div></div>
              <hr />
              <div className="row g-2 small">
                <div className="col-md-3"><b>Teaching records expected:</b><br />{dashboard.context?.teaching_records_expected ?? 0}</div>
                <div className="col-md-3"><b>Timetable assignments:</b><br />{dashboard.context?.timetable_assignments ?? 0}</div>
                <div className="col-md-3"><b>Teacher-specific exceptions:</b><br />{dashboard.context?.teacher_day_overrides ?? 0}</div>
                <div className="col-md-3"><b>Calendar non-teaching days:</b><br />{dashboard.context?.school_or_calendar_non_teaching_days ?? 0}</div>
              </div>
              <div className="alert alert-light border mt-3 mb-0 small"><b>Fairness rule:</b> Academic Calendar day type is checked first for each class, then teacher-specific override takes priority. Approved leave / configured non-teaching days do not create false Diary, Lesson Plan or Test expectations.</div>
            </div></div>
          </div>
        </div>
        <div className="row g-3 mb-4">{(dashboard.components || []).map((c) => <div className="col-md-6 col-xxl-4" key={c.code}><ComponentCard c={c} /></div>)}</div>
        <div className="row g-3">
          <div className="col-xl-7"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Score Movement</h5><span className="small text-muted">Snapshots for {month}</span></div><TrendStrip rows={trend} /></div></div></div>
          <div className="col-xl-5"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="d-flex justify-content-between gap-2"><h5>AI Growth Insight</h5><button className="btn btn-sm btn-outline-primary" onClick={generateInsight} disabled={busy}>Generate</button></div>{aiInsight ? <><div style={{ whiteSpace: "pre-wrap" }}>{aiInsight}</div><div className="small text-muted mt-3">{aiSource === "openai" ? "AI explanation from ERP evidence" : "Smart fallback insight"} • score itself is rule-based</div></> : <div className="text-muted">Generate a short evidence-based explanation, strengths and next actions. AI cannot change the score.</div>}</div></div></div>
        </div>
      </>}

      {isManager && tab === "team" && <div className="card border-0 shadow-sm"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3"><div><h5 className="mb-0">Management Overview</h5><div className="small text-muted">For support and appraisal review — not a public teacher leaderboard.</div></div><button className="btn btn-outline-primary" onClick={loadTeam}>Recalculate Team</button></div>
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Teacher</th><th>Score</th><th>Coverage</th><th>Support Opportunity</th></tr></thead><tbody>{team.map((r) => <tr key={r.teacher?.id}><td><b>{r.teacher?.name}</b><div className="small text-muted">{r.teacher?.designation}</div></td><td>{r.error ? <span className="text-danger">Error</span> : <span className="fw-bold">{Number(r.overall_score).toFixed(1)}</span>}</td><td>{r.error ? "-" : `${Number(r.coverage_percent || 0).toFixed(1)}%`}</td><td>{r.weakest_component?.label || (r.error ? r.error : "Evidence building")}</td></tr>)}</tbody></table></div>
      </div></div>}

      {isManager && tab === "weights" && <div className="row g-3">
        <div className="col-xl-8"><div className="card border-0 shadow-sm"><div className="card-body"><div className="d-flex justify-content-between align-items-center mb-3"><div><h5 className="mb-0">Dynamic Weightage</h5><div className="small text-muted">HR, Coordinator, Admin & SuperAdmin • new versions never rewrite historical snapshots.</div></div><span className={`badge ${Math.abs(weightTotal-100)<0.01?'text-bg-success':'text-bg-danger'}`}>Total {weightTotal.toFixed(2)}%</span></div>
          <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Component</th><th style={{width:130}}>Enabled</th><th style={{width:170}}>Weight %</th><th style={{width:180}}>Target</th></tr></thead><tbody>{weights.map((w, i) => <tr key={w.component_code}><td><b>{String(w.component_code).replaceAll('_',' ')}</b><div className="small text-muted">{w.target_unit || "Automatic from ERP evidence"}</div></td><td><input type="checkbox" checked={w.enabled !== false} onChange={(e) => setWeights((old) => old.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))} /></td><td><input type="number" step="0.5" min="0" max="100" className="form-control" value={w.weight_percent} disabled={w.enabled===false} onChange={(e)=>setWeights((old)=>old.map((x,j)=>j===i?{...x,weight_percent:e.target.value}:x))} /></td><td>{w.component_code === 'ASSESSMENT' ? <input type="number" className="form-control" min="0" step="1" value={w.target_value ?? 1} onChange={(e)=>setWeights((old)=>old.map((x,j)=>j===i?{...x,target_value:e.target.value}:x))} title="Monthly assessment target per teacher" /> : <span className="text-muted small">Automatic</span>}</td></tr>)}</tbody></table></div>
          <div className="d-flex gap-2 align-items-end flex-wrap"><div><label className="form-label">Effective From</label><input type="date" className="form-control" value={effectiveFrom} onChange={(e)=>setEffectiveFrom(e.target.value)} /></div><button className="btn btn-primary" onClick={saveWeights} disabled={busy || Math.abs(weightTotal-100)>0.01}>Save New Version</button></div>
        </div></div></div>
        <div className="col-xl-4"><div className="card border-0 shadow-sm"><div className="card-body"><h5>Recent Versions</h5>{weightHistory.length ? weightHistory.map((h)=><div className="border-bottom py-2" key={`${h.school_id}-${h.version_no}-${h.effective_from}`}><b>Version {h.version_no}</b><div className="small text-muted">Effective {h.effective_from} • Total {h.total}% • {h.school_id ? 'School-specific' : 'Global default'}</div></div>) : <div className="text-muted">No history yet.</div>}</div></div></div>
      </div>}

      {isManager && tab === "overrides" && <div className="row g-3">
        <div className="col-lg-5"><div className="card border-0 shadow-sm"><div className="card-body"><h5>Teacher-Specific Day Override</h5><div className="alert alert-info small">Priority: <b>Teacher override → Class Academic Calendar → School Calendar → Timetable.</b> Use this for training, official duty, leave or a one-off non-teaching day.</div>
          <div className="mb-3"><label className="form-label">Date</label><input type="date" className="form-control" value={overrideForm.override_date} onChange={(e)=>setOverrideForm({...overrideForm,override_date:e.target.value})} /></div>
          <div className="mb-3"><label className="form-label">Day Type</label><select className="form-select" value={overrideForm.day_type} onChange={(e)=>setOverrideType(e.target.value)}>{(cap.day_types || Object.keys(DAY_TYPE_LABELS)).map((t)=><option key={t} value={t}>{DAY_TYPE_LABELS[t] || t}</option>)}</select></div>
          <div className="row g-2 mb-3"><div className="col-6"><label className="form-label">Teaching Expected?</label><select className="form-select" value={overrideForm.teaching_expected?'1':'0'} onChange={(e)=>setOverrideForm({...overrideForm,teaching_expected:e.target.value==='1'})}><option value="0">No</option><option value="1">Yes</option></select></div><div className="col-6"><label className="form-label">Attendance Expected?</label><select className="form-select" value={overrideForm.attendance_expected?'1':'0'} onChange={(e)=>setOverrideForm({...overrideForm,attendance_expected:e.target.value==='1'})}><option value="0">No</option><option value="1">Yes</option></select></div></div>
          <div className="mb-3"><label className="form-label">Reason *</label><textarea className="form-control" rows="3" value={overrideForm.reason} onChange={(e)=>setOverrideForm({...overrideForm,reason:e.target.value})} placeholder="e.g. CBSE training / official exam duty / approved non-teaching assignment" /></div>
          <div className="mb-3"><label className="form-label">Evidence URL (optional)</label><input className="form-control" value={overrideForm.evidence_url} onChange={(e)=>setOverrideForm({...overrideForm,evidence_url:e.target.value})} /></div>
          <button className="btn btn-primary" onClick={saveOverride}>Save Override</button>
        </div></div></div>
        <div className="col-lg-7"><div className="card border-0 shadow-sm"><div className="card-body"><h5>{month} Overrides</h5><div className="table-responsive"><table className="table"><thead><tr><th>Date</th><th>Type</th><th>Expectations</th><th>Reason</th><th /></tr></thead><tbody>{overrides.map((o)=><tr key={o.id}><td>{o.override_date}</td><td>{DAY_TYPE_LABELS[o.day_type] || o.day_type}</td><td><span className="small">Teaching {o.teaching_expected?'✓':'—'} • Attendance {o.attendance_expected?'✓':'—'}</span></td><td>{o.reason}</td><td><button className="btn btn-sm btn-outline-danger" onClick={async()=>{await teacherPerformanceApi.deleteOverride(o.id); await loadManagerData(selectedTeacherId); await loadDashboard(selectedTeacherId);}}>Delete</button></td></tr>)}{!overrides.length && <tr><td colSpan="5" className="text-muted text-center">No overrides in this month.</td></tr>}</tbody></table></div></div></div></div>
      </div>}

      {isManager && tab === "manual" && <div className="row g-3">
        <div className="col-lg-5"><div className="card border-0 shadow-sm"><div className="card-body"><h5>Add Duty / Achievement / Adjustment</h5>
          <div className="mb-3"><label className="form-label">Type</label><select className="form-select" value={manualForm.entry_type} onChange={(e)=>setManualForm({...manualForm,entry_type:e.target.value})}><option value="DUTY">Other Duty</option><option value="ACHIEVEMENT">Achievement / Contribution</option><option value="ADJUSTMENT">Manual Score Adjustment</option></select></div>
          <div className="mb-3"><label className="form-label">Title *</label><input className="form-control" value={manualForm.title} onChange={(e)=>setManualForm({...manualForm,title:e.target.value})} placeholder="e.g. Annual Function Coordinator" /></div>
          <div className="mb-3"><label className="form-label">Date</label><input type="date" className="form-control" value={manualForm.entry_date} onChange={(e)=>setManualForm({...manualForm,entry_date:e.target.value})} /></div>
          {manualForm.entry_type === 'ADJUSTMENT' ? <div className="mb-3"><label className="form-label">Score Adjustment (-10 to +10)</label><input type="number" min="-10" max="10" step="0.5" className="form-control" value={manualForm.score_delta} onChange={(e)=>setManualForm({...manualForm,score_delta:e.target.value})} /></div> : <div className="mb-3"><label className="form-label">Evidence Rating (0-100)</label><input type="number" min="0" max="100" className="form-control" value={manualForm.rating} onChange={(e)=>setManualForm({...manualForm,rating:e.target.value})} /></div>}
          <div className="mb-3"><label className="form-label">Details</label><textarea className="form-control" rows="3" value={manualForm.description} onChange={(e)=>setManualForm({...manualForm,description:e.target.value})} /></div>
          <div className="mb-3"><label className="form-label">Evidence URL (optional)</label><input className="form-control" value={manualForm.evidence_url} onChange={(e)=>setManualForm({...manualForm,evidence_url:e.target.value})} /></div>
          <button className="btn btn-primary" onClick={saveManual}>Add Evidence</button>
        </div></div></div>
        <div className="col-lg-7"><div className="card border-0 shadow-sm"><div className="card-body"><h5>{month} Manual Evidence</h5>{manualEntries.map((e)=><div className="border rounded p-3 mb-2" key={e.id}><div className="d-flex justify-content-between gap-2"><div><span className="badge text-bg-secondary me-2">{e.entry_type}</span><b>{e.title}</b><div className="small text-muted">{e.entry_date} • Added by {e.createdBy?.name || e.createdBy?.username || 'Management'}</div></div><button className="btn btn-sm btn-outline-danger" onClick={async()=>{await teacherPerformanceApi.deleteManualEntry(e.id); await loadManagerData(selectedTeacherId); await loadDashboard(selectedTeacherId);}}>Delete</button></div><div className="mt-2 small">{e.entry_type === 'ADJUSTMENT' ? `Adjustment: ${Number(e.score_delta || 0) >= 0 ? '+' : ''}${e.score_delta}` : `Rating: ${e.rating}/100`}{e.description ? ` • ${e.description}` : ''}</div></div>)}{!manualEntries.length && <div className="text-muted">No manual evidence this month.</div>}</div></div></div>
      </div>}
    </div>
  );
}
