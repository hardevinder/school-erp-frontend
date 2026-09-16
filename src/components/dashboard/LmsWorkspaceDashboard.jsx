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
  const [clock, setClock] = useState(() => new Date());
  const [pulse, setPulse] = useState({ loading: true, assessments: [], classes: [], assessmentTotal: 0, errors: {} });
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

  return (
    <main className="lms-workspace dashboard-surface">
      <div className="container-fluid px-3 px-md-4 py-3 py-md-4">
        <section className="lms-hero mb-3">
          <div className="lms-hero-copy">
            <div className="lms-eyebrow"><i className="bi bi-mortarboard-fill" /> EduBridge LMS</div>
            <h1>Learning Management Dashboard</h1>
            <p>Teaching, learning, assessments and academic progress in one focused workspace.</p>
            <div className="lms-meta-row">
              <span><i className="bi bi-person-badge" /> {roleLabel}</span>
              <span className="is-live"><i className="bi bi-broadcast-pin" /> Live · {clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span><i className="bi bi-grid-3x3-gap" /> {actions.length} learning tools</span>
            </div>
          </div>
          <div className="lms-hero-mark" aria-hidden="true"><i className="bi bi-mortarboard" /></div>
        </section>

        <section className="lms-live-panel mb-3" aria-label="Live LMS overview">
          <div className="lms-live-head">
            <div>
              <div className="lms-section-kicker"><span className="lms-live-dot" /> Live learning pulse</div>
              <h2>Today in LMS</h2>
              <p>Current learning activity pulled from assessments and online classes.</p>
            </div>
            <button type="button" className="lms-refresh-btn" onClick={() => setRefreshKey((value) => value + 1)} disabled={pulse.loading}>
              <i className={`bi ${pulse.loading ? "bi-arrow-repeat lms-spin" : "bi-arrow-clockwise"}`} /> {pulse.loading ? "Syncing" : "Refresh"}
            </button>
          </div>

          <div className="lms-live-stats">
            <div className="lms-live-stat">
              <span className="lms-live-stat-icon"><i className="bi bi-grid-1x2" /></span>
              <div><strong>{actions.length}</strong><span>Available tools</span></div>
            </div>
            <div className="lms-live-stat">
              <span className="lms-live-stat-icon"><i className="bi bi-clipboard2-check" /></span>
              <div><strong>{statValue(pulse.errors.assessments, pulse.assessmentTotal)}</strong><span>Assessments</span></div>
            </div>
            <div className="lms-live-stat">
              <span className="lms-live-stat-icon"><i className="bi bi-calendar2-week" /></span>
              <div><strong>{statValue(pulse.errors.classes, upcoming.length)}</strong><span>Upcoming classes</span></div>
            </div>
            <div className={`lms-live-stat ${liveCount ? "has-live-class" : ""}`}>
              <span className="lms-live-stat-icon"><i className="bi bi-camera-video" /></span>
              <div><strong>{statValue(pulse.errors.classes, liveCount)}</strong><span>Live now</span></div>
            </div>
          </div>

          <div className="lms-live-detail-grid">
            <Link to="/online-classes" className="lms-live-detail-card lms-next-class text-decoration-none">
              <span className="lms-detail-icon"><i className="bi bi-camera-video-fill" /></span>
              <span className="lms-detail-copy">
                <small>Next online class</small>
                <strong>{pulse.errors.classes ? "Schedule unavailable" : nextClass?.title || nextClass?.topic || "No upcoming class scheduled"}</strong>
                <span>{pulse.errors.classes ? "Open Online Classes to retry" : nextClass ? formatClassDate(nextClass) : "Your next scheduled class will appear here automatically."}</span>
              </span>
              <i className="bi bi-arrow-right" />
            </Link>

            <Link to="/assessments" className="lms-live-detail-card text-decoration-none">
              <span className="lms-detail-icon"><i className="bi bi-bar-chart-line-fill" /></span>
              <span className="lms-detail-copy">
                <small>Assessment activity</small>
                <strong>{pulse.errors.assessments ? "Assessment summary unavailable" : pulse.loading ? "Loading activity…" : `${pulse.assessmentTotal} assessments in view`}</strong>
                <span className="lms-status-row">
                  {!pulse.errors.assessments && !pulse.loading && assessmentStatuses.length ? assessmentStatuses.map(([status, count]) => (
                    <span key={status}>{status} <b>{count}</b></span>
                  )) : <span>{pulse.errors.assessments ? "Open assessments to retry" : "Status summary will appear here"}</span>}
                </span>
              </span>
              <i className="bi bi-arrow-right" />
            </Link>
          </div>
        </section>

        <div className="lms-tools-head">
          <div>
            <div className="lms-section-kicker">Quick access</div>
            <h2>Learning tools</h2>
            <p>Direct access to every LMS module available for this role.</p>
          </div>
          <span className="lms-tools-count">{actions.length} modules</span>
        </div>

        {actions.length ? (
          <div className="lms-tools-grid mb-4">
            {actions.map((item) => (
              <Link key={item.key} to={item.path} className="lms-action-card text-decoration-none">
                <span className="lms-action-icon"><i className={`bi ${item.icon}`} /></span>
                <span className="lms-action-content">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
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
