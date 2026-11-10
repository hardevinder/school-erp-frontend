import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRoles } from "../hooks/useRoles";
import commandCenterApi from "../services/commandCenterApi";
import PrincipalClassroomMonitor from "./PrincipalClassroomMonitor";
import UpcomingCalendarEvents from "../components/dashboard/UpcomingCalendarEvents";
import "./SchoolCommandCenter.css";
import "./SchoolCommandCenterAcademicCards.css";
import "./SchoolCommandCenterAcademicVisuals.css";

const fmt = (value) => new Intl.NumberFormat("en-IN").format(Number(value || 0));
const pct = (value) => `${Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0)}%`;

function MetricCard({ icon, label, value, meta, progress, onClick, tone = "primary" }) {
  return (
    <button type="button" className={`cc-metric cc-tone-${tone}`} onClick={onClick}>
      <div className="cc-metric-top">
        <span className="cc-metric-icon"><i className={`bi ${icon}`} /></span>
        <span className="cc-metric-arrow"><i className="bi bi-arrow-up-right" /></span>
      </div>
      <div className="cc-metric-value">{value}</div>
      <div className="cc-metric-label">{label}</div>
      {progress !== undefined && progress !== null && (
        <div className="cc-progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(progress || 0)))}%` }} /></div>
      )}
      <div className="cc-metric-meta">{meta}</div>
    </button>
  );
}

function AlertRow({ alert, onOpen }) {
  return (
    <button type="button" className="cc-alert" onClick={() => onOpen(alert.route)}>
      <span className={`cc-alert-dot ${alert.severity || "info"}`} />
      <span className="cc-alert-body">
        <strong>{alert.title}</strong>
        <small>{alert.description}</small>
      </span>
      <span className="cc-alert-count">{fmt(alert.count)}</span>
      <i className="bi bi-chevron-right text-muted" />
    </button>
  );
}

function PulseItem({ label, value, note, route, navigate, available = true }) {
  return (
    <button type="button" className="cc-pulse-item" onClick={() => route && navigate(route)} disabled={!available}>
      <span>
        <strong>{label}</strong>
        <small>{available ? note : "Module data not ready"}</small>
      </span>
      <b>{available ? fmt(value) : "—"}</b>
    </button>
  );
}

// Leadership overview: metrics below come only from the live Command Center response.
// Missing examination/class analytics are explicitly labelled unavailable.
const hasNumber = (value) => value !== null && value !== undefined && Number.isFinite(Number(value));

function AcademicInsightCard({ icon, title, value, detail, footnote, tone, active, onClick, children }) {
  return (
    <button type="button" className={`cc-insight cc-insight-${tone}${active ? " is-active" : ""}`} onClick={onClick} aria-expanded={active}>
      <span className="cc-insight-heading"><i className={`bi ${icon}`} /><strong>{title}</strong></span>
      <span className="cc-insight-value">{value}</span>
      <span className="cc-insight-detail">{detail}</span>
      <span className="cc-insight-footnote">{footnote}</span>
      {children}
      <span className="cc-insight-link">{active ? "Hide details" : "View details"} <i className={`bi bi-arrow-${active ? "up" : "right"}`} /></span>
    </button>
  );
}

function AcademicBarList({ items, valueKey, labelKey, suffix = "%" }) {
  return <div className="cc-academic-bars">
    {items.map((row, index) => {
      const value = Math.max(0, Math.min(100, Number(row[valueKey] || 0)));
      return <div className="cc-academic-bar-row" key={row.student_id || row.teacher_user_id || index}>
        <div className="cc-academic-bar-label"><span>{row[labelKey] || "Unknown"}</span><b>{value.toFixed(1)}{suffix}</b></div>
        <div className="cc-academic-track"><span style={{ width: `${value}%` }} /></div>
      </div>;
    })}
  </div>;
}

// Compact visualizations use only recorded data from the selected examination.
function ExamGauge({ value }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const v = Math.max(0, Math.min(100, n));
  return <span className="cc-visual-gauge" role="img" aria-label={`Recorded marks average ${v.toFixed(1)} percent`}
    style={{ background: `conic-gradient(#7057e8 ${v}%, #e9eafa ${v}% 100%)` }}>
    <span>{v.toFixed(0)}%</span>
  </span>;
}

function ClassMiniBars({ items }) {
  const rows = (items || []).filter((row) => Number.isFinite(Number(row.average_percentage))).slice(0, 6);
  if (!rows.length) return null;
  return <span className="cc-visual-mini-bars" aria-label="Top class averages">
    {rows.map((row) => <span className="cc-visual-mini-column" key={`${row.class_id}-${row.section_id}`}
      title={`${row.label}: ${Number(row.average_percentage).toFixed(1)}%`}>
      <span style={{ height: `${Math.max(3, Math.min(100, Number(row.average_percentage)))}%` }} />
    </span>)}
  </span>;
}

export default function SchoolCommandCenter() {
  const navigate = useNavigate();
  const { activeRole } = useRoles();
  const isPrincipal = String(activeRole || "").toLowerCase() === "principal";
  const [aiQuestion, setAiQuestion] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [expandedAcademic, setExpandedAcademic] = useState(null);
  const [termOne, setTermOne] = useState(null);
  const [termOneLoading, setTermOneLoading] = useState(true);
  const [selectedAcademicTerm, setSelectedAcademicTerm] = useState("");
  const [selectedAcademicExam, setSelectedAcademicExam] = useState("");

  const load = useCallback(async (selectedDate = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await commandCenterApi.summary(selectedDate ? { date: selectedDate } : {});
      setData(response.data || null);
      if (!selectedDate && response.data?.date) setDate(response.data.date);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to load School Command Center.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isPrincipal) { setTermOneLoading(false); return; }
    let live = true;
    setTermOneLoading(true);
    commandCenterApi.termOneSummary({
      ...(selectedAcademicTerm ? { term_id: selectedAcademicTerm } : {}),
      ...(selectedAcademicExam ? { exam_id: selectedAcademicExam } : {}),
    }).then((response) => {
      if (live) setTermOne(response.data || null);
    }).catch(() => {
      if (live) setTermOne((previous) => ({ ...previous, available: false, reason: "Unable to load examination statistics" }));
    }).finally(() => { if (live) setTermOneLoading(false); });
    return () => { live = false; };
  }, [isPrincipal, selectedAcademicTerm, selectedAcademicExam]);

  const student = data?.attendance?.students || {};
  const staff = data?.attendance?.staff || {};
  const studentPerformance = data?.student_performance || {};
  const teacherPerformance = data?.teacher_performance || {};
  const teachingResult = teacherPerformance.teaching_result || {};
  const academicInsightsAvailable = data?.profile !== "hr";
  const studentEvidence = data?.availability?.student_performance !== false && Number(studentPerformance.evaluated_attempts || 0) > 0;
  const teacherEvidence = data?.availability?.teacher_performance !== false && Number(teacherPerformance.snapshots || 0) > 0;
  const studentAverage = studentEvidence && hasNumber(studentPerformance.average_score_percent) ? pct(studentPerformance.average_score_percent) : "—";
  const teacherSnapshots = Math.max(0, Number(teacherPerformance.snapshots || 0));
  const toggleAcademic = (key) => setExpandedAcademic((current) => current === key ? null : key);

  const profileLabel = useMemo(() => {
    if (data?.profile === "academic") return "Academic Command View";
    if (data?.profile === "hr") return "HR Command View";
    return "School Leadership View";
  }, [data?.profile]);

  if (loading && !data) {
    return <div className="cc-loading"><div className="spinner-border" /><div>Building today's school picture…</div></div>;
  }

  if (error && !data) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span><button className="btn btn-outline-danger btn-sm" onClick={() => load(date)}>Retry</button>
        </div>
      </div>
    );
  }

  const dayLabel = String(data?.day_context || "NORMAL_DAY").replaceAll("_", " ");
  const showStudents = data?.profile !== "hr";
  const showStaff = data?.profile !== "academic";
  const showWellbeing = data?.profile !== "hr";
  const showCompliance = data?.profile !== "academic";


  return (
    <div className="cc-page dashboard-surface">
      <section className="cc-hero">
        <div>
          <div className="cc-kicker"><i className="bi bi-command me-2" />{profileLabel}</div>
          <h1>{isPrincipal ? "Principal Command Center" : "School Command Center"}</h1>
          <p>Live academic intelligence, attendance, operations and actions needing attention.</p>
          <div className="cc-badges">
            <span><i className="bi bi-calendar-event" /> {data?.date}</span>
            <span><i className="bi bi-sun" /> {dayLabel}</span>
            <span><i className="bi bi-arrow-repeat" /> Live ERP data</span>
          </div>
        </div>
        <div className="cc-hero-actions">
          {isPrincipal && <button className="btn btn-warning" onClick={() => navigate("/school-ai")}><i className="bi bi-stars me-2" />Ask EduBridge</button>} {/* PRINCIPAL_LIVE_AI */}
          <input type="date" className="form-control" value={date || ""} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-light" onClick={() => load(date)} disabled={loading}>
            <i className={`bi ${loading ? "bi-arrow-repeat cc-spin" : "bi-arrow-clockwise"} me-2`} />Refresh
          </button>
        </div>
      </section>

      {isPrincipal && (
        <section className="cc-ai-command">
          <div className="cc-ai-command-icon"><i className="bi bi-stars" /></div>
          <div className="cc-ai-command-copy">
            <span>ASK EDUBRIDGE · PRINCIPAL LIVE DATA</span>
            <strong>Ask the ERP instead of opening reports.</strong>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const q = aiQuestion.trim(); if (q) navigate(`/school-ai?q=${encodeURIComponent(q)}`); }}>
            <input value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder="e.g. How many students are present in Class VII today?" maxLength={1500} />
            <button type="submit" disabled={!aiQuestion.trim()}><i className="bi bi-arrow-up-right" /> Ask</button>
          </form>
          <div className="cc-ai-examples">
            <button type="button" onClick={() => navigate(`/school-ai?q=${encodeURIComponent("Which teachers are unavailable today?")}`)}>Teacher availability</button>
            <button type="button" onClick={() => navigate(`/school-ai?q=${encodeURIComponent("Show upcoming calendar events for the next 7 days")}`)}>Upcoming events</button>
            <button type="button" onClick={() => navigate(`/school-ai?q=${encodeURIComponent("What is the current session pending fee position?")}`)}>Fee position</button>
          </div>
        </section>
      )}

      {error && <div className="alert alert-warning py-2">Showing last loaded data. Refresh issue: {error}</div>}

      <section className="cc-metric-grid">
        {showStudents && (
          <MetricCard
            icon="bi-people-fill"
            label="Student Attendance"
            value={student.marked ? pct(student.present_of_marked_percent) : "Not marked"}
            meta={`${fmt(student.marked)} of ${fmt(student.total_active)} marked • ${fmt(student.absent)} absent`}
            progress={student.marking_coverage_percent}
            onClick={() => navigate("/monthly-attendance-register")}
            tone="blue"
          />
        )}
        {showStaff && (
          <MetricCard
            icon="bi-person-badge-fill"
            label="Staff Attendance"
            value={staff.marked ? pct(staff.present_of_marked_percent) : "Not marked"}
            meta={`${fmt(staff.marked)} of ${fmt(staff.total_active)} marked • ${fmt(staff.absent)} absent`}
            progress={staff.marking_coverage_percent}
            onClick={() => navigate("/employee-attendance-summary")}
            tone="violet"
          />
        )}
        {data?.profile !== "hr" && (
          <MetricCard
            icon="bi-bus-front-fill"
            label="Transport Live"
            value={`${fmt(data?.transport?.trips_live)} live`}
            meta={`${fmt(data?.transport?.buses_active)} active buses • ${fmt(data?.transport?.trips_completed_today)} trips completed`}
            onClick={() => navigate("/live-bus-tracking")}
            tone="green"
          />
        )}
        <MetricCard
          icon="bi-exclamation-diamond-fill"
          label="Needs Attention"
          value={fmt(data?.headline?.attention_categories)}
          meta={`${fmt(data?.headline?.actionable_items)} total items across active alerts`}
          onClick={() => document.getElementById("cc-attention")?.scrollIntoView({ behavior: "smooth" })}
          tone="orange"
        />
        {data?.profile !== "hr" && (
          <MetricCard
            icon="bi-journal-check"
            label="Upcoming Exam Schedules"
            value={fmt(data?.academic?.upcoming_exam_schedules)}
            meta={`${fmt(data?.academic?.exams_today)} scheduled today • next 7 days`}
            onClick={() => navigate("/exam-dashboard")}
            tone="cyan"
          />
        )}
        <MetricCard
          icon="bi-graph-up-arrow"
          label="Teacher Performance Watch"
          value={fmt(data?.teacher_performance?.below_threshold)}
          meta={`${fmt(data?.teacher_performance?.snapshots)} snapshots • avg learning growth ${data?.teacher_performance?.teaching_result?.average_growth_points == null ? "building" : `${Number(data.teacher_performance.teaching_result.average_growth_points) >= 0 ? "+" : ""}${Number(data.teacher_performance.teaching_result.average_growth_points).toFixed(1)} pts`}`}
          onClick={() => navigate("/teacher-performance")}
          tone="rose"
        />
      </section>

      {isPrincipal && <PrincipalClassroomMonitor date={date} navigate={navigate} />}

      {academicInsightsAvailable && (
        <section className="cc-academic-section" aria-labelledby="cc-academic-title">
          <header className="cc-academic-section-head">
            <span className="cc-academic-section-icon"><i className="bi bi-mortarboard-fill" /></span>
            <div>
              <span className="cc-eyebrow">ACADEMIC EXCELLENCE</span>
              <h2 id="cc-academic-title">Academic Performance Intelligence</h2>
              <p>Live examination statistics from your configured terms, examinations and assessment components.</p>
            </div>
          </header>
          {isPrincipal && <div className="cc-academic-filters" style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "0 0 14px", alignItems: "center" }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Term
              <select aria-label="Academic term" className="form-select form-select-sm" value={selectedAcademicTerm || String(termOne?.selected_term_id || "")}
                onChange={(e) => { setSelectedAcademicTerm(e.target.value); setSelectedAcademicExam(""); }}>
                {(termOne?.terms || []).length === 0 && <option value="">No configured terms</option>}
                {(termOne?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Examination
              <select aria-label="Examination" className="form-select form-select-sm" value={selectedAcademicExam}
                onChange={(e) => setSelectedAcademicExam(e.target.value)}>
                <option value="">All examinations</option>
                {(termOne?.exams || []).map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
              </select>
            </label>
            {termOne?.session && <small style={{ alignSelf: "flex-end", paddingBottom: 8, opacity: 0.7 }}>Session: {termOne.session}</small>}
          </div>}
          <div className="cc-insight-grid">
            <AcademicInsightCard tone="violet" icon="bi-clipboard-data" title="Examination Performance"
              value={termOneLoading ? "Loading…" : termOne?.available ? pct(termOne.average_percentage) : "—"}
              detail={termOne?.available ? `${fmt(termOne.students_assessed)} students assessed · ${termOne.exam || termOne.term}` : (termOne?.reason || "Examination results unavailable")}
              footnote={termOne?.available ? `Recorded marks · ${termOne.session}` : "Result analysis opens in Examination Dashboard"}
              active={expandedAcademic === "exam"} onClick={() => toggleAcademic("exam")}>
              {termOne?.available && <ExamGauge value={termOne.average_percentage} />}
            </AcademicInsightCard>
            <AcademicInsightCard tone="green" icon="bi-people-fill" title="Student Performance"
              value={termOneLoading ? "Loading…" : termOne?.available ? fmt(termOne.students_assessed) : "—"}
              detail={termOne?.available ? "Students with recorded marks" : (termOne?.reason || "Examination data unavailable")}
              footnote="Recorded scholastic marks"
              active={expandedAcademic === "student"} onClick={() => toggleAcademic("student")} />
            <AcademicInsightCard tone="amber" icon="bi-building" title="Class Performance"
              value={termOneLoading ? "Loading…" : termOne?.available ? `${fmt(termOne.class_count)} classes` : "—"}
              detail={termOne?.available && termOne.class_performance?.length ? `Top: ${termOne.class_performance[0].label} · ${pct(termOne.class_performance[0].average_percentage)}` : "Class averages unavailable"}
              footnote="Click to compare class averages"
              active={expandedAcademic === "class"} onClick={() => toggleAcademic("class")}>
              {termOne?.available && <ClassMiniBars items={termOne.class_performance} />}
            </AcademicInsightCard>
            <AcademicInsightCard tone="blue" icon="bi-person-workspace" title="Teacher Performance"
              value={teacherEvidence ? `${fmt(teacherSnapshots)} snapshots` : "—"}
              detail={teacherEvidence ? `${fmt(teacherPerformance.below_threshold)} below watch threshold · Monthly monitoring` : "No monthly performance snapshots"}
              footnote={Number(teachingResult.teachers) > 0 && hasNumber(teachingResult.average_growth_points) ? `Learning growth: ${Number(teachingResult.average_growth_points).toFixed(1)} points` : "Exam-specific teacher averages: open report"}
              active={expandedAcademic === "teacher"} onClick={() => toggleAcademic("teacher")} />
          </div>
          {expandedAcademic && <div className="cc-academic-detail" id="cc-academic-details">
            <div className="cc-academic-detail-top">
              <div><span className="cc-eyebrow">DRILL-DOWN</span><h3>{({ exam: "Examination Performance", student: "Student Performance", class: "Class Performance", teacher: "Teacher Performance" })[expandedAcademic]}</h3></div>
              <button type="button" className="cc-detail-close" onClick={() => setExpandedAcademic(null)} aria-label="Close academic details"><i className="bi bi-x-lg" /></button>
            </div>
            {expandedAcademic === "exam" && <div className="cc-detail-content">
              {termOne?.available ? <>
                <div className="cc-detail-stat"><span>Term-1 average (recorded marks)</span><strong>{pct(termOne.average_percentage)}</strong></div>
                <div className="cc-detail-stat"><span>Students assessed</span><strong>{fmt(termOne.students_assessed)}</strong></div>
                <p>{termOne.measurement}</p>
              </> : <p>{termOne?.reason || "Term-1 statistics unavailable"}</p>}
              <button className="cc-detail-action" onClick={() => navigate("/exam-dashboard")}>Open Examination Dashboard <i className="bi bi-arrow-right" /></button>
            </div>}
            {expandedAcademic === "class" && <div className="cc-detail-content">
              {termOne?.available ? <>
                <p>{termOne.measurement}</p>
                <AcademicBarList items={termOne.class_performance || []} valueKey="average_percentage" labelKey="label" />
              </> : <p>{termOne?.reason || "No class results available"}</p>}
              <button className="cc-detail-action" onClick={() => navigate("/exam-dashboard")}>Explore Class Results <i className="bi bi-arrow-right" /></button>
            </div>}
            {expandedAcademic === "student" && <div className="cc-detail-content">
              {termOne?.available ? <>
                <div className="cc-detail-stat"><span>Students with recorded Term-1 marks</span><strong>{fmt(termOne.students_assessed)}</strong></div>
                <div className="cc-detail-stat"><span>Average recorded-marks percentage</span><strong>{pct(termOne.average_percentage)}</strong></div>
                <p>{termOne.measurement}</p>
              </> : <p>{termOne?.reason || "Term-1 student statistics unavailable"}</p>}
              <button className="cc-detail-action" onClick={() => navigate("/exam-dashboard")}>Open Examination Reports <i className="bi bi-arrow-right" /></button>
            </div>}
            {expandedAcademic === "teacher" && <div className="cc-detail-content">
              <div className="cc-detail-stat"><span>Monthly teacher snapshots</span><strong>{fmt(teacherPerformance.snapshots)}</strong></div>
              <div className="cc-detail-stat"><span>Below performance threshold</span><strong>{fmt(teacherPerformance.below_threshold)}</strong></div>
              <p>This monthly monitoring score is separate from examination marks. Open Teacher Performance for class-wise exam charts.</p>
              {teacherEvidence && (teacherPerformance.lowest || []).length > 0 ? <><h4>Teachers requiring a closer review</h4><AcademicBarList items={teacherPerformance.lowest} valueKey="score" labelKey="teacher_name" suffix="" /></> : <p>No teacher performance snapshots are currently available.</p>}
              <button className="cc-detail-action" onClick={() => navigate("/teacher-performance")}>Open Teacher Performance <i className="bi bi-arrow-right" /></button>
            </div>}
          </div>}
        </section>
      )}

      <UpcomingCalendarEvents
        openPath="/academic-calendar-view"
        managePath="/academic-calendar"
        maxItems={6}
        title="Upcoming Calendar Events"
        subtitle="Next Academic Calendar events for quick leadership visibility."
      />

      <div className="cc-columns">
        <section className="cc-card" id="cc-attention">
          <div className="cc-card-head">
            <div><span className="cc-eyebrow">Action Inbox</span><h3>Needs Attention</h3></div>
            <div className="d-flex align-items-center gap-2"><button className="btn btn-sm btn-primary" onClick={() => navigate("/action-inbox")}><i className="bi bi-inboxes-fill me-1" />Open Unified Inbox</button><span className="cc-count-pill">{fmt(data?.alerts?.length)} categories</span></div>
          </div>
          <div className="cc-alert-list">
            {(data?.alerts || []).length ? (data.alerts || []).slice(0, 12).map((alert) => (
              <AlertRow key={alert.id} alert={alert} onOpen={navigate} />
            )) : (
              <div className="cc-empty"><i className="bi bi-check-circle-fill" /><strong>No active attention alerts</strong><span>Everything currently tracked by the Command Center looks clear.</span></div>
            )}
          </div>
        </section>

        <section className="cc-card">
          <div className="cc-card-head"><div><span className="cc-eyebrow">Today</span><h3>Academic Calendar</h3></div><button className="btn btn-sm btn-outline-primary" onClick={() => navigate("/academic-calendar")}>Open Calendar</button></div>
          <div className="cc-timeline">
            {(data?.calendar_events || []).length ? data.calendar_events.map((event) => (
              <div className="cc-event" key={event.id}>
                <span className="cc-event-icon"><i className="bi bi-calendar2-event" /></span>
                <div><strong>{event.title}</strong><small>{event.type || event.day_type || "School Event"}{event.start_time ? ` • ${event.start_time}${event.end_time ? `–${event.end_time}` : ""}` : ""}</small></div>
              </div>
            )) : <div className="cc-empty compact"><i className="bi bi-calendar-check" /><strong>No special event today</strong><span>Normal school day according to the academic calendar.</span></div>}
          </div>
        </section>
      </div>

      <div className="cc-columns three">
        {data?.profile !== "hr" && (
          <section className="cc-card">
            <div className="cc-card-head"><div><span className="cc-eyebrow">Academic Pulse</span><h3>Teaching & Assessment</h3></div></div>
            <PulseItem label="Assessment reviews pending" value={data?.academic?.assessment_reviews_pending} note="Submitted/AI-flagged attempts" route="/assessments" navigate={navigate} available={data?.availability?.academic !== false} />
            <PulseItem label="Lesson plans overdue" value={data?.academic?.lesson_plans_overdue} note="Past planned end date" route="/lesson-plan" navigate={navigate} available={data?.availability?.academic !== false} />
            <PulseItem label="Exam schedules next 7 days" value={data?.academic?.upcoming_exam_schedules} note="Preparation window" route="/exam-dashboard" navigate={navigate} available={data?.availability?.academic !== false} />
          </section>
        )}

        <section className="cc-card">
          <div className="cc-card-head"><div><span className="cc-eyebrow">Teacher Pulse</span><h3>Performance & Learning Growth</h3><small>{data?.teacher_performance?.teaching_result?.teachers ? `${fmt(data.teacher_performance.teaching_result.positive_growth_teachers)}/${fmt(data.teacher_performance.teaching_result.teachers)} teachers showing positive learning growth` : "Teaching-result evidence builds automatically from assessments and exams."}</small></div><button className="btn btn-sm btn-outline-primary" onClick={() => navigate("/teacher-performance")}>Open</button></div>
          {(data?.teacher_performance?.lowest || []).length ? (
            <div className="cc-teacher-list">
              {data.teacher_performance.lowest.map((teacher) => (
                <button key={teacher.teacher_user_id} onClick={() => navigate(`/teacher-performance?teacher_user_id=${teacher.teacher_user_id}`)}>
                  <span className="cc-avatar">{String(teacher.teacher_name || "T").trim().charAt(0).toUpperCase()}</span>
                  <span><strong>{teacher.teacher_name}</strong><small>Evidence coverage {pct(teacher.coverage_percent)}</small></span>
                  <b>{Number(teacher.score || 0).toFixed(1)}</b>
                </button>
              ))}
            </div>
          ) : <div className="cc-empty compact"><i className="bi bi-graph-up" /><strong>No current snapshots</strong><span>Teacher Performance monthly snapshots will appear here.</span></div>}
        </section>

        {showWellbeing && (
          <section className="cc-card">
            <div className="cc-card-head"><div><span className="cc-eyebrow">Student Wellbeing</span><h3>Follow-up Pulse</h3></div></div>
            <PulseItem label="Health follow-ups" value={data?.wellbeing?.health_followups} note="Recent screenings" route="/student-health" navigate={navigate} available={data?.availability?.health !== false} />
            <PulseItem label="Readiness concerns today" value={data?.wellbeing?.readiness_concerns} note="Class-incharge checks" route="/daily-readiness" navigate={navigate} available={data?.availability?.daily_readiness !== false} />
            <PulseItem label="Anecdotal follow-ups due" value={data?.wellbeing?.anecdotal_followups_due} note="Developmental/concern follow-ups" route="/anecdotal-records" navigate={navigate} available={data?.availability?.anecdotal !== false} />
            <PulseItem label="Disciplinary cases open" value={data?.wellbeing?.disciplinary_open} note="Not closed or cancelled" route="/disciplinary-actions" navigate={navigate} available={data?.availability?.discipline !== false} />
          </section>
        )}
      </div>

      {showCompliance && (
        <div className="cc-columns two-bottom">
          <section className="cc-card">
            <div className="cc-card-head"><div><span className="cc-eyebrow">Compliance</span><h3>Documents & Acknowledgements</h3></div><button className="btn btn-sm btn-outline-primary" onClick={() => navigate("/document-vault")}>Open Vault</button></div>
            <div className="cc-stat-strip">
              <div><b>{fmt(data?.compliance?.documents_pending_verification)}</b><span>Pending verification</span></div>
              <div><b>{fmt(data?.compliance?.documents_expiring_30_days)}</b><span>Expiring in 30 days</span></div>
              <div><b>{fmt(data?.compliance?.official_ack_pending)}</b><span>Awaiting acknowledgement</span></div>
              <div><b>{fmt(data?.compliance?.parent_consent_pending)}</b><span>Parent consent pending</span></div>
            </div>
          </section>
          <section className="cc-card">
            <div className="cc-card-head"><div><span className="cc-eyebrow">Operations</span><h3>School Operations</h3></div></div>
            <div className="cc-stat-strip two">
              <button onClick={() => navigate("/lost-found")}><b>{fmt(data?.operations?.lost_found_claims_pending)}</b><span>Lost & Found claims</span></button>
              <button onClick={() => navigate("/department-management")}><b>{fmt(data?.operations?.department_tasks_overdue)}</b><span>Department tasks overdue</span></button>
            </div>
          </section>
        </div>
      )}

      <section className="cc-card cc-quick-card">
        <div className="cc-card-head"><div><span className="cc-eyebrow">One Tap</span><h3>Quick Actions</h3></div></div>
        <div className="cc-quick-grid">
          {(data?.quick_actions || []).map((item) => (
            <button key={item.route} onClick={() => navigate(item.route)}><i className={`bi ${item.icon}`} /><span>{item.label}</span><i className="bi bi-arrow-right-short" /></button>
          ))}
        </div>
      </section>

      {(data?.module_notes || []).length > 0 && (
        <details className="cc-module-notes"><summary>Module readiness notes ({data.module_notes.length})</summary>{data.module_notes.map((note, idx) => <div key={idx}>{note}</div>)}</details>
      )}
    </div>
  );
}
