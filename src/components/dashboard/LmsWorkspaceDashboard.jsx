import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import { useInstitution } from "../../institution/InstitutionContext";
import "./LmsWorkspaceDashboard.css";

const ACTIONS = [
  { key: "assessments", label: "Assessments & Tests", description: "Create, evaluate and publish assessments", icon: "bi-clipboard2-check", path: "/assessments", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "examination", "student"] },
  { key: "classes", label: "Online Classes", description: "Schedule, start or join live classes", icon: "bi-camera-video", path: "/online-classes", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "student"] },
  { key: "lesson", label: "Lesson Plans", description: "Plan lessons and track classroom delivery", icon: "bi-journal-richtext", path: "/lesson-plan", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
  { key: "syllabus", label: "Syllabus Progress", description: "Break up syllabus and monitor completion", icon: "bi-list-check", path: "/syllabus-breakdown", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
  { key: "diary", label: "Digital Diary", description: "Classwork, homework and teacher diary", icon: "bi-journal-text", path: "/digital-diary", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
  { key: "student-diary", label: "My Diary", description: "View classwork, homework and school updates", icon: "bi-journal-bookmark", path: "/student-diary", roles: ["student"] },
  { key: "student-lessons", label: "Learning Plans", description: "View lesson plans shared for your classes", icon: "bi-book", path: "/student-lesson-plans", roles: ["student"] },
  { key: "marks", label: "Marks & Evaluation", description: "Enter marks and manage evaluation workflow", icon: "bi-ui-checks-grid", path: "/marks-entry", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "examination"] },
  { key: "reports", label: "Report Cards", description: "Generate and publish academic report cards", icon: "bi-file-earmark-bar-graph", path: "/report-card-generator", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "examination"] },
  { key: "library", label: "Learning Resources", description: "Notes, PDFs, study material and video links", icon: "bi-collection-play", path: "/learning-resources", roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod", "student"] },
  { key: "college-subject-registration", label: "Subject Registration", description: "Choose electives and semester subject choices", icon: "bi-ui-checks-grid", path: "/college-subject-registration", collegeOnly: true, roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "department_hod", "student"] },
  { key: "notebook-checking", label: "Notebook / Copy Checking", description: "Topic-wise checking, corrections and HOD verification", icon: "bi-journal-check", path: "/notebook-checking", schoolOnly: true, roles: ["admin", "superadmin", "principal", "academic_coordinator", "coordinator", "teacher", "department_hod"] },
];

const roleLabels = {
  academic_coordinator: "Academic Coordinator",
  department_hod: "Department HOD",
  superadmin: "Super Admin",
  examination: "Examination",
};

const LEADERSHIP_ROLES = new Set([
  "superadmin",
  "super_admin",
  "admin",
  "principal",
  "academic_coordinator",
  "coordinator",
]);

const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const scoreLabel = (value, suffix = "%") => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}${suffix}` : "—";
};

const shortDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { day: "2-digit", month: "short" });
};

const normalizeRows = (payload) => {
  const candidates = [
    payload?.data?.rows,
    payload?.data?.data,
    payload?.data,
    payload?.rows,
    payload?.items,
    payload,
  ];
  return candidates.find(Array.isArray) || [];
};

const totalFromPayload = (payload, rows) =>
  Number(
    payload?.pagination?.total ??
      payload?.data?.pagination?.total ??
      payload?.total ??
      payload?.data?.total ??
      rows.length
  );

const classStart = (row) => row?.start_time || row?.startTime || row?.scheduled_at || row?.scheduledAt || row?.date_time || null;
const classDuration = (row) => Number(row?.duration_minutes || row?.duration || 0);

const isUpcomingClass = (row, now = Date.now()) => {
  const raw = classStart(row);
  if (!raw) return false;
  const start = new Date(raw).getTime();
  if (!Number.isFinite(start)) return false;
  const duration = classDuration(row);
  const end = start + Math.max(duration, 1) * 60000;
  const status = String(row?.status || "").toLowerCase();
  return !["cancelled", "ended", "completed"].includes(status) && end >= now;
};

const isLiveClass = (row, now = Date.now()) => {
  const status = String(row?.status || "").toLowerCase();
  if (["live", "ongoing", "in_progress", "started"].includes(status)) return true;
  const raw = classStart(row);
  if (!raw) return false;
  const start = new Date(raw).getTime();
  if (!Number.isFinite(start)) return false;
  const end = start + Math.max(classDuration(row), 1) * 60000;
  return start <= now && end >= now;
};

const formatClassDate = (row) => {
  const raw = classStart(row);
  if (!raw) return "Schedule available inside Online Classes";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Schedule available inside Online Classes";
  return date.toLocaleString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const prettifyStatus = (value) =>
  String(value || "Unspecified")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function LmsWorkspaceDashboard({ role = "" }) {
  const normalizedRole = String(role || "").toLowerCase();
  const { isCollege } = useInstitution();
  const isLeadershipRole = LEADERSHIP_ROLES.has(normalizedRole);
  const [clock, setClock] = useState(() => new Date());
  const [pulse, setPulse] = useState({ loading: true, assessments: [], classes: [], assessmentTotal: 0, errors: {} });
  const [leadership, setLeadership] = useState({ loading: false, command: null, teachers: [], errors: {} });
  const [refreshKey, setRefreshKey] = useState(0);

  const actions = useMemo(() => {
    return ACTIONS.filter((item) => item.roles.includes(normalizedRole) && !(item.schoolOnly && isCollege) && !(item.collegeOnly && !isCollege));
  }, [normalizedRole, isCollege]);

  const roleLabel = roleLabels[normalizedRole] ||
    (normalizedRole ? normalizedRole.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "School");

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const load = async () => {
      setPulse((previous) => ({ ...previous, loading: true }));
      const [assessmentsResult, classesResult] = await Promise.allSettled([
        api.get("/api/assessments", { signal: controller.signal }),
        api.get("/api/online-classes", { signal: controller.signal }),
      ]);

      if (!mounted || controller.signal.aborted) return;

      const next = { loading: false, assessments: [], classes: [], assessmentTotal: 0, errors: {} };
      if (assessmentsResult.status === "fulfilled") {
        const payload = assessmentsResult.value?.data;
        next.assessments = normalizeRows(payload);
        next.assessmentTotal = totalFromPayload(payload, next.assessments);
      } else {
        next.errors.assessments = true;
      }

      if (classesResult.status === "fulfilled") {
        next.classes = normalizeRows(classesResult.value?.data);
      } else {
        next.errors.classes = true;
      }

      setPulse(next);
    };

    load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!isLeadershipRole) {
      setLeadership({ loading: false, command: null, teachers: [], errors: {} });
      return undefined;
    }

    const controller = new AbortController();
    let mounted = true;
    const month = new Date().toISOString().slice(0, 7);

    const loadLeadership = async () => {
      setLeadership((previous) => ({ ...previous, loading: true }));
      const [commandResult, teacherResult] = await Promise.allSettled([
        api.get("/command-center/summary", { signal: controller.signal }),
        api.get("/teacher-performance/team-summary", {
          params: { month, limit: 80 },
          signal: controller.signal,
        }),
      ]);

      if (!mounted || controller.signal.aborted) return;

      const next = { loading: false, command: null, teachers: [], errors: {} };
      if (commandResult.status === "fulfilled") {
        next.command = commandResult.value?.data || null;
      } else {
        next.errors.command = true;
      }
      if (teacherResult.status === "fulfilled") {
        next.teachers = Array.isArray(teacherResult.value?.data?.teachers)
          ? teacherResult.value.data.teachers.filter((row) => !row?.error)
          : [];
      } else {
        next.errors.teachers = true;
      }
      setLeadership(next);
    };

    loadLeadership();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isLeadershipRole, refreshKey]);

  const now = clock.getTime();
  const upcoming = useMemo(
    () => pulse.classes.filter((row) => isUpcomingClass(row, now)).sort((a, b) => new Date(classStart(a)) - new Date(classStart(b))),
    [pulse.classes, now]
  );
  const liveCount = useMemo(() => pulse.classes.filter((row) => isLiveClass(row, now)).length, [pulse.classes, now]);
  const nextClass = upcoming[0] || null;

  const assessmentStatuses = useMemo(() => {
    const counts = new Map();
    pulse.assessments.forEach((row) => {
      const status = prettifyStatus(row?.status);
      counts.set(status, (counts.get(status) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [pulse.assessments]);

  const statValue = (error, value) => (error ? "—" : pulse.loading ? "…" : value);

  const command = leadership.command || {};
  const commandTeachers = Array.isArray(command?.teacher_performance?.top) ? command.teacher_performance.top : [];
  const liveTeachers = leadership.teachers.length ? leadership.teachers : commandTeachers;
  const topTeachers = liveTeachers.slice(0, 3);
  const topTeacher = topTeachers[0] || null;
  const topTeacherName = topTeacher?.teacher?.name || topTeacher?.teacher_name || "No performance snapshot yet";
  const topTeacherScore = topTeacher?.overall_score ?? topTeacher?.score;
  const teacherGrowth = topTeacher?.teaching_result?.growth_points;

  const studentPerformance = command?.student_performance || {};
  const topStudents = Array.isArray(studentPerformance?.top) ? studentPerformance.top.slice(0, 3) : [];
  const topStudent = topStudents[0] || null;
  const lessonPlanSummary = command?.academic?.lesson_plans || {};
  const recentLessonScores = Array.isArray(command?.academic?.recent_lesson_plan_results)
    ? command.academic.recent_lesson_plan_results.slice(0, 3)
    : [];
  const recentPlans = Array.isArray(command?.academic?.recent_lesson_plans)
    ? command.academic.recent_lesson_plans.slice(0, 3)
    : [];

  return (
    <main className="lms-workspace dashboard-surface">
      <div className="container-fluid px-3 px-md-4 py-3">
        <section className="lms-command-bar mb-3" aria-label="LMS dashboard heading">
          <div className="lms-command-copy">
            <div className="lms-eyebrow"><i className="bi bi-mortarboard-fill" /> {isLeadershipRole ? "Academic Leadership" : "EduBridge LMS"}</div>
            <h1>{isLeadershipRole ? "Academic Leadership Dashboard" : "Learning Management Dashboard"}</h1>
            <p>{isLeadershipRole ? "Teacher performance, student outcomes, lesson planning and academic execution — live at a glance." : "Teaching, learning, assessments and academic progress in one focused workspace."}</p>
            <div className="lms-meta-row">
              <span><i className="bi bi-person-badge" /> {roleLabel}</span>
              <span className="is-live"><i className="bi bi-broadcast-pin" /> Live · {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span><i className="bi bi-grid-3x3-gap" /> {actions.length} learning tools</span>
            </div>
          </div>
          <button type="button" className="lms-refresh-btn lms-command-refresh" onClick={() => setRefreshKey((value) => value + 1)} disabled={pulse.loading || leadership.loading}>
            <i className={`bi ${pulse.loading || leadership.loading ? "bi-arrow-repeat lms-spin" : "bi-arrow-clockwise"}`} /> {pulse.loading || leadership.loading ? "Syncing" : "Refresh live data"}
          </button>
        </section>

        {isLeadershipRole && (
          <section className="lms-leadership-panel mb-3" aria-label="Academic leadership intelligence">
            <div className="lms-leadership-head">
              <div>
                <div className="lms-section-kicker"><i className="bi bi-speedometer2" /> Principal / Super Admin view</div>
                <h2>Academic Leadership Intelligence</h2>
                <p>Live ERP + LMS indicators for teacher performance, student progress and academic execution.</p>
              </div>
              <span className="lms-leadership-sync">
                <span className={`lms-live-dot ${leadership.loading ? "is-syncing" : ""}`} />
                {leadership.loading ? "Refreshing live data" : "Live data"}
              </span>
            </div>

            <div className="lms-leadership-kpis">
              <Link to="/teacher-performance" className="lms-leadership-kpi text-decoration-none">
                <span className="lms-leadership-kpi-icon"><i className="bi bi-award" /></span>
                <span className="lms-leadership-kpi-copy">
                  <small>Top teacher performer</small>
                  <strong>{leadership.loading && !topTeacher ? "Loading…" : topTeacherName}</strong>
                  <span>{topTeacher ? `${scoreLabel(topTeacherScore, "/100")}${Number.isFinite(Number(teacherGrowth)) ? ` · ${Number(teacherGrowth) >= 0 ? "+" : ""}${Number(teacherGrowth).toFixed(1)} growth` : ""}` : "Monthly ERP evidence score"}</span>
                </span>
              </Link>

              <Link to="/assessments" className="lms-leadership-kpi text-decoration-none">
                <span className="lms-leadership-kpi-icon"><i className="bi bi-trophy" /></span>
                <span className="lms-leadership-kpi-copy">
                  <small>Top student performance</small>
                  <strong>{leadership.loading && !topStudent ? "Loading…" : topStudent?.student_name || "No evaluated attempts yet"}</strong>
                  <span>{topStudent ? `${scoreLabel(topStudent.average_score_percent)} · ${topStudent.attempts || 0} evaluated test${Number(topStudent.attempts) === 1 ? "" : "s"}${topStudent.class_name ? ` · ${topStudent.class_name}` : ""}` : "Based on LMS assessments · last 30 days"}</span>
                </span>
              </Link>

              <Link to="/lesson-plan" className="lms-leadership-kpi text-decoration-none">
                <span className="lms-leadership-kpi-icon"><i className="bi bi-journal-check" /></span>
                <span className="lms-leadership-kpi-copy">
                  <small>Lesson plan completion</small>
                  <strong>{leadership.loading && !command?.academic ? "Loading…" : scoreLabel(lessonPlanSummary.completion_percent)}</strong>
                  <span>{safeNumber(lessonPlanSummary.completed)} completed · {safeNumber(lessonPlanSummary.in_progress)} in progress · {safeNumber(lessonPlanSummary.pending)} pending</span>
                </span>
              </Link>

              <Link to="/assessments" className="lms-leadership-kpi text-decoration-none">
                <span className="lms-leadership-kpi-icon"><i className="bi bi-bar-chart-line" /></span>
                <span className="lms-leadership-kpi-copy">
                  <small>LMS assessment average</small>
                  <strong>{leadership.loading && !command?.student_performance ? "Loading…" : scoreLabel(studentPerformance.average_score_percent)}</strong>
                  <span>{safeNumber(studentPerformance.students_tracked)} students · {safeNumber(studentPerformance.evaluated_attempts)} evaluated attempts</span>
                </span>
              </Link>
            </div>

            <div className="lms-leadership-grid">
              <article className="lms-ranking-card">
                <div className="lms-ranking-card-head">
                  <div><small>Teacher performance</small><strong>Top performers</strong></div>
                  <Link to="/teacher-performance">View all <i className="bi bi-arrow-right" /></Link>
                </div>
                <div className="lms-ranking-list">
                  {topTeachers.length ? topTeachers.map((row, index) => {
                    const name = row?.teacher?.name || row?.teacher_name || `Teacher ${index + 1}`;
                    const score = safeNumber(row?.overall_score ?? row?.score);
                    const coverage = safeNumber(row?.coverage_percent);
                    return (
                      <div className="lms-rank-row" key={row?.teacher?.id || row?.teacher_user_id || `${name}-${index}`}>
                        <span className="lms-rank-no">{index + 1}</span>
                        <span className="lms-rank-person"><strong>{name}</strong><small>{coverage ? `${coverage.toFixed(0)}% evidence coverage` : "ERP performance evidence"}</small></span>
                        <span className="lms-rank-score">{scoreLabel(score, "")}</span>
                        <span className="lms-rank-track"><span style={{ width: `${Math.max(3, Math.min(100, score))}%` }} /></span>
                      </div>
                    );
                  }) : <div className="lms-empty-intel">Teacher performance will appear after current-month evidence is available.</div>}
                </div>
              </article>

              <article className="lms-ranking-card">
                <div className="lms-ranking-card-head">
                  <div><small>Student performance</small><strong>Assessment leaders</strong></div>
                  <Link to="/assessments">Assessments <i className="bi bi-arrow-right" /></Link>
                </div>
                <div className="lms-ranking-list">
                  {topStudents.length ? topStudents.map((row, index) => {
                    const score = safeNumber(row.average_score_percent);
                    return (
                      <div className="lms-rank-row" key={row.student_id || `${row.student_name}-${index}`}>
                        <span className="lms-rank-no">{index + 1}</span>
                        <span className="lms-rank-person"><strong>{row.student_name || `Student ${index + 1}`}</strong><small>{[row.class_name, row.admission_number ? `Adm. ${row.admission_number}` : null, `${row.attempts || 0} tests`].filter(Boolean).join(" · ")}</small></span>
                        <span className="lms-rank-score">{scoreLabel(score, "")}</span>
                        <span className="lms-rank-track"><span style={{ width: `${Math.max(3, Math.min(100, score))}%` }} /></span>
                      </div>
                    );
                  }) : <div className="lms-empty-intel">Evaluated LMS assessment results from the last 30 days will appear here.</div>}
                </div>
              </article>

              <article className="lms-lesson-score-card">
                <div className="lms-ranking-card-head">
                  <div><small>Recent lesson planning</small><strong>Lesson plan scores</strong></div>
                  <Link to="/lesson-plan">Lesson plans <i className="bi bi-arrow-right" /></Link>
                </div>
                <div className="lms-lesson-score-list">
                  {recentLessonScores.length ? recentLessonScores.map((row) => (
                    <div className="lms-lesson-score-row" key={row.evaluation_id}>
                      <span className="lms-lesson-score-main"><strong>{row.topic || row.title || "Lesson plan evaluation"}</strong><small>{[row.teacher_name, row.class_name, row.subject_name].filter(Boolean).join(" · ")}</small></span>
                      <span className="lms-lesson-score-meta"><b>{scoreLabel(row.average_score_percent)}</b><small>{row.students_evaluated || 0} students{row.updated_at ? ` · ${shortDate(row.updated_at)}` : ""}</small></span>
                    </div>
                  )) : recentPlans.length ? recentPlans.map((row) => (
                    <div className="lms-lesson-score-row" key={row.id}>
                      <span className="lms-lesson-score-main"><strong>{row.topic || "Lesson Plan"}</strong><small>{[row.teacher_name, row.class_name, row.subject_name].filter(Boolean).join(" · ")}</small></span>
                      <span className="lms-lesson-score-meta"><b className="is-status">{row.status || "Planned"}</b><small>{row.updated_at ? `Updated ${shortDate(row.updated_at)}` : "Recent plan"}</small></span>
                    </div>
                  )) : <div className="lms-empty-intel">Recent lesson-plan evaluation scores will appear after results are published.</div>}
                </div>
              </article>

              <article className="lms-attention-card">
                <div className="lms-ranking-card-head">
                  <div><small>Management attention</small><strong>Needs follow-up</strong></div>
                  <span className="lms-attention-live"><i className="bi bi-broadcast" /> Live</span>
                </div>
                <div className="lms-attention-list">
                  <Link to="/assessments"><span><i className="bi bi-clipboard2-check" /> Assessment reviews pending</span><b>{safeNumber(command?.academic?.assessment_reviews_pending)}</b></Link>
                  <Link to="/lesson-plan"><span><i className="bi bi-journal-x" /> Overdue lesson plans</span><b>{safeNumber(command?.academic?.lesson_plans_overdue)}</b></Link>
                  <Link to="/teacher-performance"><span><i className="bi bi-person-exclamation" /> Teachers below watch score</span><b>{safeNumber(command?.teacher_performance?.below_threshold)}</b></Link>
                  <Link to="/online-classes"><span><i className="bi bi-camera-video" /> Live classes now</span><b>{liveCount}</b></Link>
                </div>
              </article>
            </div>
          </section>
        )}

        <section className="lms-live-panel mb-3" aria-label="Live LMS overview">
          <div className="lms-live-head">
            <div>
              <div className="lms-section-kicker"><span className="lms-live-dot" /> Live learning pulse</div>
              <h2>Today in LMS</h2>
              <p>Current learning activity pulled from assessments and online classes.</p>
            </div>
          </div>

          <div className="lms-live-stats">
            <div className="lms-live-stat"><span className="lms-live-stat-icon"><i className="bi bi-grid-1x2" /></span><div><strong>{actions.length}</strong><span>Available tools</span></div></div>
            <div className="lms-live-stat"><span className="lms-live-stat-icon"><i className="bi bi-clipboard2-check" /></span><div><strong>{statValue(pulse.errors.assessments, pulse.assessmentTotal)}</strong><span>Assessments</span></div></div>
            <div className="lms-live-stat"><span className="lms-live-stat-icon"><i className="bi bi-calendar2-week" /></span><div><strong>{statValue(pulse.errors.classes, upcoming.length)}</strong><span>Upcoming classes</span></div></div>
            <div className={`lms-live-stat ${liveCount ? "has-live-class" : ""}`}><span className="lms-live-stat-icon"><i className="bi bi-camera-video" /></span><div><strong>{statValue(pulse.errors.classes, liveCount)}</strong><span>Live now</span></div></div>
          </div>

          <div className="lms-live-detail-grid">
            <Link to="/online-classes" className="lms-live-detail-card lms-next-class text-decoration-none">
              <span className="lms-detail-icon"><i className="bi bi-camera-video-fill" /></span>
              <span className="lms-detail-copy"><small>Next online class</small><strong>{pulse.errors.classes ? "Schedule unavailable" : nextClass?.title || nextClass?.topic || "No upcoming class scheduled"}</strong><span>{pulse.errors.classes ? "Open Online Classes to retry" : nextClass ? formatClassDate(nextClass) : "Your next scheduled class will appear here automatically."}</span></span>
              <i className="bi bi-arrow-right" />
            </Link>
            <Link to="/assessments" className="lms-live-detail-card text-decoration-none">
              <span className="lms-detail-icon"><i className="bi bi-bar-chart-line-fill" /></span>
              <span className="lms-detail-copy"><small>Assessment activity</small><strong>{pulse.errors.assessments ? "Assessment summary unavailable" : pulse.loading ? "Loading activity…" : `${pulse.assessmentTotal} assessments in view`}</strong><span className="lms-status-row">{!pulse.errors.assessments && !pulse.loading && assessmentStatuses.length ? assessmentStatuses.map(([status, count]) => <span key={status}>{status} <b>{count}</b></span>) : <span>{pulse.errors.assessments ? "Open assessments to retry" : "Status summary will appear here"}</span>}</span></span>
              <i className="bi bi-arrow-right" />
            </Link>
          </div>
        </section>

        <div className="lms-tools-head">
          <div><div className="lms-section-kicker">Quick access</div><h2>Learning tools</h2><p>Direct access to every LMS module available for this role.</p></div>
          <span className="lms-tools-count">{actions.length} modules</span>
        </div>

        {actions.length ? (
          <div className="lms-tools-grid mb-4">
            {actions.map((item) => (
              <Link key={item.key} to={item.path} className="lms-action-card text-decoration-none">
                <span className="lms-action-icon"><i className={`bi ${item.icon}`} /></span>
                <span className="lms-action-content"><strong>{item.label}</strong><small>{item.description}</small></span>
                <i className="bi bi-arrow-right lms-action-arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="alert alert-light border rounded-4 shadow-sm mb-4 d-flex align-items-center gap-3">
            <span className="lms-action-icon"><i className="bi bi-shield-lock" /></span>
            <div><strong>No LMS modules are assigned to this role.</strong><div className="small text-muted">An administrator can grant learning-module access when required.</div></div>
          </div>
        )}
      </div>
    </main>
  );
}
