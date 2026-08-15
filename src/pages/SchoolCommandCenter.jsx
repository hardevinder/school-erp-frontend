import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import commandCenterApi from "../services/commandCenterApi";
import "./SchoolCommandCenter.css";

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

export default function SchoolCommandCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");

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

  const student = data?.attendance?.students || {};
  const staff = data?.attendance?.staff || {};
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
    <div className="cc-page">
      <section className="cc-hero">
        <div>
          <div className="cc-kicker"><i className="bi bi-command me-2" />{profileLabel}</div>
          <h1>School Command Center</h1>
          <p>One screen for today's attendance, academics, staff, transport, student wellbeing and actions needing attention.</p>
          <div className="cc-badges">
            <span><i className="bi bi-calendar-event" /> {data?.date}</span>
            <span><i className="bi bi-sun" /> {dayLabel}</span>
            <span><i className="bi bi-arrow-repeat" /> Live ERP data</span>
          </div>
        </div>
        <div className="cc-hero-actions">
          <button className="btn btn-warning" onClick={() => navigate("/school-ai")}><i className="bi bi-stars me-2" />Ask School AI</button> {/* SCHOOL_AI_COMMAND_CTA_V12 */}
          <input type="date" className="form-control" value={date || ""} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-light" onClick={() => load(date)} disabled={loading}>
            <i className={`bi ${loading ? "bi-arrow-repeat cc-spin" : "bi-arrow-clockwise"} me-2`} />Refresh
          </button>
        </div>
      </section>

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
          meta={`${fmt(data?.teacher_performance?.snapshots)} current-month snapshots • watch below ${fmt(data?.teacher_performance?.threshold)}`}
          onClick={() => navigate("/teacher-performance")}
          tone="rose"
        />
      </section>

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
          <div className="cc-card-head"><div><span className="cc-eyebrow">Teacher Pulse</span><h3>Performance Watch</h3></div><button className="btn btn-sm btn-outline-primary" onClick={() => navigate("/teacher-performance")}>Open</button></div>
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
