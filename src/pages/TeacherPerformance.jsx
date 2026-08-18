import React, { useCallback, useEffect, useMemo, useState } from "react";
import teacherPerformanceApi from "../services/teacherPerformanceApi";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";

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

function componentCalculation(c) {
  const m = c?.metrics || {};
  if (c?.details?.calculation) return c.details.calculation;
  if (c?.score == null) return c?.reasons?.[0] || "This component is not applicable for the selected period.";

  switch (c?.code) {
    case "ATTENDANCE":
      return `Attendance score is the average attendance credit across ${Number(m.scorable_days || 0)} scorable day(s). Approved leave/excluded days are removed from the denominator. Final score: ${Number(c.score).toFixed(1)}%.`;
    case "DIARY":
      return `${Number(m.matched_diary_entries || 0)} matched diary teaching-day(s) ÷ ${Number(m.expected_class_subject_days || 0)} expected teaching-day(s) × 100 = ${Number(c.score).toFixed(1)}%.`;
    case "LESSON_PLAN":
      return `${Number(m.credited_plans || 0).toFixed(1)} credited plan(s) ÷ ${Number(m.expected_weekly_class_subject_plans || 0)} expected weekly class-subject plan(s) × 100 = ${Number(c.score).toFixed(1)}%.`;
    case "SYLLABUS":
      return `${Number(m.completed_due_items || 0)} completed due syllabus item(s) ÷ ${Number(m.due_items || 0)} due item(s) × 100 = ${Number(c.score).toFixed(1)}%.`;
    case "ASSESSMENT":
      return `${Number(m.evaluated_or_published || 0)} completed assessment credit(s) ÷ ${Number(m.effective_expected || 0)} expected credit(s) × 100 = ${Number(c.score).toFixed(1)}%.`;
    case "STUDENT_PROGRESS":
      return `Teaching Result ${Number(c.score).toFixed(1)}/100 is based on comparable same-class/section/subject student growth. Within each comparable group: learning growth 45%, proficiency/pass improvement 20%, weak-student recovery 20% when applicable, consistency 10%, and evidence coverage 5%.`;
    case "SUBSTITUTION":
      return `${Number(m.inferred_completed || 0).toFixed(1)} inferred completion credit(s) ÷ ${Number(m.scorable || 0)} scorable substitution(s) × 100 = ${Number(c.score).toFixed(1)}%.`;
    case "DUTY":
    case "ACHIEVEMENT":
      return `Score is the average of ${Number(m.rated_entries || 0)} approved rated entr${Number(m.rated_entries || 0) === 1 ? "y" : "ies"} = ${Number(c.score).toFixed(1)}%.`;
    default:
      return `Rule-based score for this component = ${Number(c.score).toFixed(1)}%.`;
  }
}

function metricLabel(key) {
  return String(key || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function metricValue(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : Number(value).toFixed(2).replace(/\.?0+$/, "");
  return String(value);
}

function ComponentDetailsModal({ component: c, onClose }) {
  if (!c) return null;
  const score = c?.score == null ? null : Number(c.score);
  const metrics = Object.entries(c?.metrics || {});
  const assessmentRows = c?.details?.assessments || [];

  return <>
    <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} onClick={onClose} />
    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ zIndex: 1055 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1">{c.label}</h5>
              <div className="small text-muted">How this score was calculated • Weight {Number(c.weight || 0).toFixed(0)}%</div>
            </div>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>

          <div className="modal-body">
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <div className="border rounded p-3 h-100 bg-light">
                  <div className="small text-muted text-uppercase fw-semibold">Component Score</div>
                  <div className={`display-6 fw-bold ${score == null ? "text-secondary" : score >= 85 ? "text-success" : score >= 70 ? "text-primary" : score >= 55 ? "text-warning" : "text-danger"}`}>
                    {score == null ? "N/A" : score.toFixed(1)}
                  </div>
                  <div className="small text-muted">{score == null ? "Not applicable in this period" : "out of 100"}</div>
                </div>
              </div>
              <div className="col-md-9">
                <div className="border rounded p-3 h-100">
                  <div className="small text-muted text-uppercase fw-semibold mb-1">Calculation</div>
                  <div className="fw-semibold">{componentCalculation(c)}</div>
                  {c?.details?.target_note && <div className="small text-muted mt-2">{c.details.target_note}</div>}
                  <div className="small text-muted mt-2">
                    If a component is N/A, it is excluded from the applicable-weight denominator rather than being treated as zero.
                  </div>
                </div>
              </div>
            </div>

            {!!metrics.length && <>
              <h6 className="mb-2">Key figures</h6>
              <div className="row g-2 mb-4">
                {metrics.map(([k, v]) => <div className="col-6 col-md-4 col-xl-3" key={k}>
                  <div className="border rounded p-2 h-100">
                    <div className="small text-muted">{metricLabel(k)}</div>
                    <div className="fw-semibold">{metricValue(v)}</div>
                  </div>
                </div>)}
              </div>
            </>}

            {!!c?.reasons?.length && <>
              <h6 className="mb-2">Why the system gave this score</h6>
              <ul className="mb-4">
                {c.reasons.map((r, i) => <li key={`${i}-${r}`} className="mb-1">{r}</li>)}
              </ul>
            </>}

            {c?.code === "ASSESSMENT" && <>
              <div className="d-flex justify-content-between align-items-end gap-2 flex-wrap mb-2">
                <div>
                  <h6 className="mb-1">Assessment-wise completion evidence</h6>
                  <div className="small text-muted">This is the exact evidence behind Assessments & Results.</div>
                </div>
                <span className="badge text-bg-light border">{assessmentRows.length} assessment record(s)</span>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle">
                  <thead className="table-light">
                    <tr><th>Date</th><th>Assessment</th><th>Type</th><th>Mode</th><th>Status</th><th>Due?</th><th>Credit</th></tr>
                  </thead>
                  <tbody>
                    {assessmentRows.map((r) => <tr key={r.id}>
                      <td>{r.date}</td>
                      <td className="fw-semibold">{r.assessment}</td>
                      <td>{r.type}</td>
                      <td>{r.mode}</td>
                      <td><span className={`badge ${["EVALUATED","RESULT_PUBLISHED"].includes(r.status) ? "text-bg-success" : r.status === "DRAFT" ? "text-bg-secondary" : "text-bg-warning"}`}>{String(r.status || "-").replaceAll("_", " ")}</span></td>
                      <td>{r.due}</td>
                      <td className="fw-semibold">{r.credit}</td>
                    </tr>)}
                    {!assessmentRows.length && <tr><td colSpan="7" className="text-center text-muted py-4">No assessment records found for this period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  </>;
}

function ComponentCard({ c, onOpen }) {
  const score = c?.score == null ? null : Number(c.score);
  const tone = score == null ? "secondary" : score >= 85 ? "success" : score >= 70 ? "primary" : score >= 55 ? "warning" : "danger";
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body d-flex flex-column">
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
        <button type="button" className="btn btn-sm btn-link px-0 mt-auto pt-3 text-decoration-none text-start" onClick={() => onOpen?.(c)}>
          View details / How calculated →
        </button>
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


function MetricTile({ label, value, note, tone = "primary" }) {
  return <div className="col-6 col-xl-3"><div className="card border-0 shadow-sm h-100"><div className="card-body">
    <div className="small text-muted text-uppercase fw-semibold">{label}</div>
    <div className={`h3 mb-1 text-${tone}`}>{value}</div>
    {note && <div className="small text-muted">{note}</div>}
  </div></div></div>;
}

function TeachingResultAnalytics({ analytics }) {
  const groups = useMemo(() => analytics?.groups || [], [analytics]);
  const [selectedKey, setSelectedKey] = useState(groups?.[0]?.key || "");
  useEffect(() => {
    if (!groups.length) { setSelectedKey(""); return; }
    if (!groups.some((g) => g.key === selectedKey)) setSelectedKey(groups[0].key);
  }, [analytics, groups, selectedKey]);
  if (!analytics?.applicable || !groups.length) {
    return <div className="card border-0 shadow-sm mb-4"><div className="card-body">
      <div className="d-flex gap-3 align-items-center"><span className="fs-2">📈</span><div><h5 className="mb-1">Teaching Result & Student Growth</h5><div className="text-muted">Graphs will appear after at least two comparable result points exist for the same class, section and subject. Smart Assessments and formal exam results are both supported.</div></div></div>
    </div></div>;
  }
  const summary = analytics.summary || {};
  const selected = groups.find((g) => g.key === selectedKey) || groups[0];
  const groupChart = groups.map((g) => ({
    name: `${g.class_name}${g.section_name ? `-${g.section_name}` : ""} ${g.subject_name}`,
    growth: Number(g.growth_points || 0),
    score: Number(g.teaching_score || 0),
    pass: Number(g.latest_pass_percent || 0),
  }));
  const distribution = [
    { name: "Improved", value: Number(selected?.improved_students || 0), fill: "#198754" },
    { name: "Stable", value: Number(selected?.stable_students || 0), fill: "#0d6efd" },
    { name: "Needs support", value: Number(selected?.declined_students || 0), fill: "#fd7e14" },
  ].filter((x) => x.value > 0);
  const growth = Number(summary.growth_points || 0);
  const passGrowth = Number(summary.pass_growth_points || 0);

  return <div className="mb-4">
    <div className="d-flex justify-content-between align-items-end gap-3 flex-wrap mb-3">
      <div><h4 className="mb-1">Teaching Result & Student Growth</h4><div className="text-muted">Same-cohort learning growth from formal examinations + Smart Assessments. Raw marks from unrelated classes are never compared.</div></div>
      <span className="badge text-bg-light border fs-6">{Number(summary.formal_exam_events || 0)} exam • {Number(summary.smart_assessment_events || 0)} assessment evidence points</span>
    </div>
    <div className="row g-3 mb-3">
      <MetricTile label="Teaching Result" value={`${Number(analytics.teaching_score || 0).toFixed(1)}/100`} note={`${Number(summary.comparable_groups || 0)} comparable teaching group(s)`} tone={Number(analytics.teaching_score || 0) >= 70 ? "success" : "warning"} />
      <MetricTile label="Learning Growth" value={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)} pts`} note="Weighted same-student improvement" tone={growth >= 0 ? "success" : "danger"} />
      <MetricTile label="Latest Pass Rate" value={`${Number(summary.latest_pass_percent || 0).toFixed(1)}%`} note={`${passGrowth >= 0 ? "+" : ""}${passGrowth.toFixed(1)} pts vs baseline`} tone="primary" />
      <MetricTile label="Students Improved" value={Number(summary.improved_students || 0)} note={`${Number(summary.recovered_students || 0)} weak student record(s) recovered`} tone="success" />
    </div>

    <div className="card border-0 shadow-sm mb-3"><div className="card-body">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div><h5 className="mb-0">Learning Growth Trend</h5><div className="small text-muted">Assessment / exam progression for the selected class-subject.</div></div>
        <select className="form-select" style={{maxWidth: 360}} value={selected?.key || ""} onChange={(e)=>setSelectedKey(e.target.value)}>
          {groups.map((g)=><option key={g.key} value={g.key}>{g.class_name}{g.section_name ? `-${g.section_name}` : ""} • {g.subject_name}</option>)}
        </select>
      </div>
      <div style={{height: 310}}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={selected?.timeline || []} margin={{ top: 8, right: 20, left: 0, bottom: 35 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" angle={-18} textAnchor="end" height={70} interval={0} tick={{fontSize: 11}} />
            <YAxis domain={[0, 100]} unit="%" />
            <Tooltip formatter={(v, n)=>[`${Number(v).toFixed(1)}%`, n === 'average' ? 'Class Average' : 'Pass Rate']} labelFormatter={(label, payload)=>`${label}${payload?.[0]?.payload?.date ? ` • ${payload[0].payload.date}` : ''}`} />
            <Legend />
            <Line type="monotone" dataKey="average" name="Class Average" stroke="#0d6efd" strokeWidth={3} dot={{r: 5}} activeDot={{r: 7}} />
            <Line type="monotone" dataKey="pass_percent" name="Pass Rate" stroke="#198754" strokeWidth={2} strokeDasharray="5 4" dot={{r: 4}} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="small text-muted mt-2">Baseline: <b>{selected?.baseline?.label}</b> ({selected?.baseline?.date}) → Latest: <b>{selected?.latest?.label}</b> ({selected?.latest?.date}) • Growth <b className={Number(selected?.growth_points || 0) >= 0 ? 'text-success' : 'text-danger'}>{Number(selected?.growth_points || 0) >= 0 ? '+' : ''}{Number(selected?.growth_points || 0).toFixed(1)} pts</b></div>
    </div></div>

    <div className="row g-3 mb-3">
      <div className="col-xl-7"><div className="card border-0 shadow-sm h-100"><div className="card-body"><h5>Class / Subject Comparison</h5><div className="small text-muted mb-2">Growth points and teaching-result score across assigned groups.</div><div style={{height: 280}}><ResponsiveContainer width="100%" height="100%"><BarChart data={groupChart} margin={{top: 10,right: 20,left: 0,bottom: 60}}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-20} textAnchor="end" height={80} interval={0} tick={{fontSize: 10}} /><YAxis /><Tooltip /><Legend /><Bar dataKey="growth" name="Growth points" fill="#20c997" radius={[5,5,0,0]} /><Bar dataKey="score" name="Teaching score" fill="#6f42c1" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></div></div></div>
      <div className="col-xl-5"><div className="card border-0 shadow-sm h-100"><div className="card-body"><h5>Student Progress Mix</h5><div className="small text-muted mb-2">{selected?.class_name}{selected?.section_name ? `-${selected.section_name}` : ''} • {selected?.subject_name}</div><div style={{height: 240}}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} label={({name,value})=>`${name}: ${value}`}>{distribution.map((entry)=><Cell key={entry.name} fill={entry.fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="small text-muted text-center">Evidence coverage {Number(selected?.evidence_coverage || 0).toFixed(1)}% • {Number(selected?.matched_students || 0)} matched students</div></div></div></div>
    </div>

    <div className="card border-0 shadow-sm"><div className="card-body"><div className="d-flex justify-content-between align-items-center mb-2"><div><h5 className="mb-0">Student-wise Learning Impact</h5><div className="small text-muted">Private teacher/management view — not shown as a teacher score to parents or students.</div></div><span className="badge text-bg-light border">Pass benchmark {Number(analytics?.pass_benchmark ?? 40).toFixed(0)}%</span></div>
      <div className="table-responsive" style={{maxHeight: 420}}><table className="table table-sm align-middle"><thead className="table-light sticky-top"><tr><th>Student</th><th>Previous</th><th>Latest</th><th>Growth</th><th>Status</th></tr></thead><tbody>{(selected?.students || []).map((r)=><tr key={r.student_id}><td><b>{r.student_name}</b><div className="small text-muted">{r.admission_number ? `Adm ${r.admission_number}` : r.roll_number ? `Roll ${r.roll_number}` : `ID ${r.student_id}`}</div></td><td>{Number(r.baseline_percent || 0).toFixed(1)}%</td><td>{Number(r.latest_percent || 0).toFixed(1)}%</td><td className={Number(r.growth_points || 0) >= 2 ? 'text-success fw-semibold' : Number(r.growth_points || 0) <= -2 ? 'text-danger fw-semibold' : ''}>{Number(r.growth_points || 0) > 0 ? '+' : ''}{Number(r.growth_points || 0).toFixed(1)}</td><td><span className={`badge ${r.status==='IMPROVED'?'text-bg-success':r.status==='DECLINED'?'text-bg-warning':'text-bg-primary'}`}>{r.status==='DECLINED'?'NEEDS SUPPORT':r.status}</span></td></tr>)}</tbody></table></div>
    </div></div>
  </div>;
}

export default function TeacherPerformance() {
  const [cap, setCap] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [dashboard, setDashboard] = useState(null);
  const [detailComponent, setDetailComponent] = useState(null);
  const [trend, setTrend] = useState([]);
  const [team, setTeam] = useState([]);
  const [weights, setWeights] = useState([]);
  const [weightHistory, setWeightHistory] = useState([]);
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [overrides, setOverrides] = useState([]);
  const [manualEntries, setManualEntries] = useState([]);
  const [manualAdjustmentSummary, setManualAdjustmentSummary] = useState({ limit: 10, raw_total: 0, applied_total: 0, remaining_positive: 10, remaining_negative: 10, approved_count: 0 });
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
    setDetailComponent(null);
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
    setManualAdjustmentSummary(m.data?.adjustment_summary || { limit: Number(cap?.manual_adjustment_limit || 10), raw_total: 0, applied_total: 0, remaining_positive: Number(cap?.manual_adjustment_limit || 10), remaining_negative: Number(cap?.manual_adjustment_limit || 10), approved_count: 0 });
  }, [isManager, month, selectedTeacherId, cap?.manual_adjustment_limit]);

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
          if (list.length) {
            const requestedTeacher = new URLSearchParams(window.location.search).get("teacher_user_id");
            const initial = requestedTeacher && list.some((t) => String(t.id) === String(requestedTeacher)) ? requestedTeacher : String(list[0].id);
            setTeacherId(String(initial));
          }
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
    const isAdjustment = manualForm.entry_type === "ADJUSTMENT";
    if (!manualForm.title.trim()) return setError("Title/category is required.");
    if (isAdjustment && Math.abs(Number(manualForm.score_delta || 0)) <= 0) return setError("Manual score adjustment cannot be 0.");
    if (isAdjustment && manualForm.description.trim().length < 5) return setError("Please enter a clear reason for the manual score adjustment.");
    setBusy(true); setError(""); setMessage("");
    try {
      const payload = { teacher_user_id: Number(selectedTeacherId), ...manualForm, rating: isAdjustment ? null : Number(manualForm.rating), score_delta: isAdjustment ? Number(manualForm.score_delta) : null };
      await teacherPerformanceApi.createManualEntry(payload);
      setMessage(isAdjustment ? "Manual score adjustment added. Score refreshed and full audit retained." : "Manual performance evidence added with audit trail.");
      setManualForm((p) => ({ ...p, title: "", score_delta: 0, description: "", evidence_url: "" }));
      await loadManagerData(selectedTeacherId); await loadDashboard(selectedTeacherId);
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  };

  const revokeManual = async (entry) => {
    if (!entry?.id || String(entry.status || "").toUpperCase() === "REVOKED") return;
    const reason = window.prompt(`Reason for revoking "${entry.title}"?`);
    if (reason == null) return;
    if (reason.trim().length < 5) return setError("Please enter a clear revocation reason.");
    setBusy(true); setError(""); setMessage("");
    try {
      await teacherPerformanceApi.revokeManualEntry(entry.id, reason.trim());
      setMessage("Entry revoked. It no longer affects the score, and its audit history is preserved.");
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
        {[['dashboard','Performance'],['team','Team Overview'],['weights','Weightage'],['overrides','Teacher Day Overrides'],['manual','Duties / Achievements / Manual Score']].map(([k,l]) => <li className="nav-item" key={k}><button className={`nav-link ${tab===k?'active':''}`} onClick={() => { setTab(k); if(k==='team' && !team.length) loadTeam(); }}>{l}</button></li>)}
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
        <TeachingResultAnalytics analytics={dashboard.teaching_result} />
        <div className="row g-3 mb-4">{(dashboard.components || []).map((c) => <div className="col-md-6 col-xxl-4" key={c.code}><ComponentCard c={c} onOpen={setDetailComponent} /></div>)}</div>
        <div className="row g-3">
          <div className="col-xl-7"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Score Movement</h5><span className="small text-muted">Snapshots for {month}</span></div><TrendStrip rows={trend} /></div></div></div>
          <div className="col-xl-5"><div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="d-flex justify-content-between gap-2"><h5>AI Growth Insight</h5><button className="btn btn-sm btn-outline-primary" onClick={generateInsight} disabled={busy}>Generate</button></div>{aiInsight ? <><div style={{ whiteSpace: "pre-wrap" }}>{aiInsight}</div><div className="small text-muted mt-3">{aiSource === "openai" ? "AI explanation from ERP evidence" : "Smart fallback insight"} • score itself is rule-based</div></> : <div className="text-muted">Generate a short evidence-based explanation, strengths and next actions. AI cannot change the score.</div>}</div></div></div>
        </div>
      </>}

      {isManager && tab === "team" && <div className="card border-0 shadow-sm"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3"><div><h5 className="mb-0">Management Overview</h5><div className="small text-muted">For support and appraisal review — not a public teacher leaderboard.</div></div><button className="btn btn-outline-primary" onClick={loadTeam}>Recalculate Team</button></div>
        <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Teacher</th><th>Professional Score</th><th>Teaching Result</th><th>Growth</th><th>Pass %</th><th>Coverage</th><th>Support Opportunity</th></tr></thead><tbody>{team.map((r) => <tr key={r.teacher?.id}><td><b>{r.teacher?.name}</b><div className="small text-muted">{r.teacher?.designation}</div></td><td>{r.error ? <span className="text-danger">Error</span> : <span className="fw-bold">{Number(r.overall_score).toFixed(1)}</span>}</td><td>{r.teaching_result ? <b>{Number(r.teaching_result.teaching_score || 0).toFixed(1)}</b> : <span className="text-muted">Building</span>}</td><td className={Number(r.teaching_result?.growth_points || 0) >= 0 ? 'text-success' : 'text-danger'}>{r.teaching_result?.growth_points == null ? '-' : `${Number(r.teaching_result.growth_points) >= 0 ? '+' : ''}${Number(r.teaching_result.growth_points).toFixed(1)}`}</td><td>{r.teaching_result?.latest_pass_percent == null ? '-' : `${Number(r.teaching_result.latest_pass_percent).toFixed(1)}%`}</td><td>{r.error ? "-" : `${Number(r.coverage_percent || 0).toFixed(1)}%`}</td><td>{r.weakest_component?.label || (r.error ? r.error : "Evidence building")}</td></tr>)}</tbody></table></div>
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

      {isManager && tab === "manual" && <>
        <div className="row g-3 mb-3">
          <div className="col-xl-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
            <div className="small text-muted text-uppercase">Automatic ERP Base Score</div>
            <div className="display-6 fw-bold">{Number(dashboard?.base_score || 0).toFixed(1)}</div>
            <div className="small text-muted">Calculated only from configured evidence and weightage.</div>
          </div></div></div>
          <div className="col-xl-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
            <div className="small text-muted text-uppercase">Manual Effect This Month</div>
            <div className={`display-6 fw-bold ${Number(manualAdjustmentSummary.applied_total || 0) > 0 ? 'text-success' : Number(manualAdjustmentSummary.applied_total || 0) < 0 ? 'text-danger' : ''}`}>
              {Number(manualAdjustmentSummary.applied_total || 0) > 0 ? '+' : ''}{Number(manualAdjustmentSummary.applied_total || 0).toFixed(1)}
            </div>
            <div className="small text-muted">Protected cap ±{Number(manualAdjustmentSummary.limit || 10).toFixed(0)} points/month • {manualAdjustmentSummary.approved_count || 0} approved adjustment(s).</div>
          </div></div></div>
          <div className="col-xl-4"><div className="card border-0 shadow-sm h-100"><div className="card-body">
            <div className="small text-muted text-uppercase">Final Professional Score</div>
            <div className="display-6 fw-bold">{Number(dashboard?.overall_score || 0).toFixed(1)}</div>
            <div className="small text-muted">No one can directly overwrite this number. Adjustment must carry reason + audit.</div>
          </div></div></div>
        </div>

        <div className="row g-3">
          <div className="col-lg-5"><div className="card border-0 shadow-sm"><div className="card-body"><h5>Add Duty / Achievement / Manual Score</h5>
            <div className="alert alert-info small">HR, Coordinator, Admin and SuperAdmin can add verified positive/negative score adjustments. The adjustment is separate from automatic ERP evidence and is always visible in the audit trail.</div>
            <div className="mb-3"><label className="form-label">Type</label><select className="form-select" value={manualForm.entry_type} onChange={(e)=>setManualForm({...manualForm,entry_type:e.target.value})}><option value="DUTY">Other Duty</option><option value="ACHIEVEMENT">Achievement / Contribution</option><option value="ADJUSTMENT">Manual Score Adjustment (+ / −)</option></select></div>
            <div className="mb-3"><label className="form-label">Title / Category *</label><input className="form-control" value={manualForm.title} onChange={(e)=>setManualForm({...manualForm,title:e.target.value})} placeholder={manualForm.entry_type === 'ADJUSTMENT' ? 'e.g. Special contribution / delayed assigned work' : 'e.g. Annual Function Coordinator'} /></div>
            <div className="mb-3"><label className="form-label">Date</label><input type="date" className="form-control" value={manualForm.entry_date} onChange={(e)=>setManualForm({...manualForm,entry_date:e.target.value})} /></div>
            {manualForm.entry_type === 'ADJUSTMENT' ? <>
              <div className="mb-2"><label className="form-label">Score Adjustment</label><div className="input-group"><span className="input-group-text">±</span><input type="number" min={-Number(manualAdjustmentSummary.limit || 10)} max={Number(manualAdjustmentSummary.limit || 10)} step="0.5" className="form-control" value={manualForm.score_delta} onChange={(e)=>setManualForm({...manualForm,score_delta:e.target.value})} /><span className="input-group-text">points</span></div></div>
              <div className="small text-muted mb-3">Current manual effect: <b>{Number(manualAdjustmentSummary.applied_total || 0) > 0 ? '+' : ''}{Number(manualAdjustmentSummary.applied_total || 0).toFixed(1)}</b>. Remaining upward room: +{Number(manualAdjustmentSummary.remaining_positive || 0).toFixed(1)}; downward room: −{Number(manualAdjustmentSummary.remaining_negative || 0).toFixed(1)}.</div>
            </> : <div className="mb-3"><label className="form-label">Evidence Rating (0-100)</label><input type="number" min="0" max="100" className="form-control" value={manualForm.rating} onChange={(e)=>setManualForm({...manualForm,rating:e.target.value})} /></div>}
            <div className="mb-3"><label className="form-label">{manualForm.entry_type === 'ADJUSTMENT' ? 'Reason *' : 'Details'}</label><textarea className="form-control" rows="3" value={manualForm.description} onChange={(e)=>setManualForm({...manualForm,description:e.target.value})} placeholder={manualForm.entry_type === 'ADJUSTMENT' ? 'Why is this score being increased or decreased? This becomes part of the audit trail.' : 'Optional details / contribution notes'} /></div>
            <div className="mb-3"><label className="form-label">Evidence URL (optional)</label><input className="form-control" value={manualForm.evidence_url} onChange={(e)=>setManualForm({...manualForm,evidence_url:e.target.value})} placeholder="Document / order / certificate link" /></div>
            <button className="btn btn-primary" onClick={saveManual} disabled={busy}>Save with Audit</button>
          </div></div></div>

          <div className="col-lg-7"><div className="card border-0 shadow-sm"><div className="card-body"><h5>{month} Manual Evidence & Score History</h5>
            {manualEntries.map((e)=>{
              const revoked = String(e.status || '').toUpperCase() === 'REVOKED';
              const delta = Number(e.score_delta || 0);
              return <div className={`border rounded p-3 mb-2 ${revoked ? 'bg-light opacity-75' : ''}`} key={e.id}>
                <div className="d-flex justify-content-between gap-2 align-items-start"><div>
                  <span className={`badge me-2 ${e.entry_type === 'ADJUSTMENT' ? (delta >= 0 ? 'text-bg-success' : 'text-bg-danger') : 'text-bg-secondary'}`}>{e.entry_type}</span>
                  {revoked && <span className="badge text-bg-dark me-2">REVOKED</span>}
                  <b>{e.title}</b>
                  <div className="small text-muted">{e.entry_date} • Added by {e.createdBy?.name || e.createdBy?.username || 'Management'}</div>
                </div>{!revoked && <button className="btn btn-sm btn-outline-danger" onClick={()=>revokeManual(e)} disabled={busy}>Revoke</button>}</div>
                <div className="mt-2 small">{e.entry_type === 'ADJUSTMENT' ? <><b className={delta >= 0 ? 'text-success' : 'text-danger'}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} points</b>{e.description ? ` • ${e.description}` : ''}</> : <>Rating: <b>{e.rating}/100</b>{e.description ? ` • ${e.description}` : ''}</>}</div>
                {e.evidence_url && <div className="small mt-1"><a href={e.evidence_url} target="_blank" rel="noreferrer">Open evidence</a></div>}
                {revoked && e.revocation?.reason && <div className="alert alert-secondary py-2 px-3 mt-2 mb-0 small"><b>Revocation reason:</b> {e.revocation.reason}{e.revocation.revoked_by?.name ? ` • by ${e.revocation.revoked_by.name}` : ''}</div>}
              </div>;
            })}
            {!manualEntries.length && <div className="text-muted">No manual duties, achievements or score adjustments this month.</div>}
          </div></div></div>
        </div>
      </>}
      <ComponentDetailsModal component={detailComponent} onClose={() => setDetailComponent(null)} />
    </div>
  );
}
