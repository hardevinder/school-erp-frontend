// File: src/components/StudentDashboard.jsx
// ✅ FULL UPDATED FILE
// ✅ FIX: No page reload on dashboard links (uses react-router Link instead of <a href>)
// ✅ NEW: Academic Calendar card/link added
// ✅ NEW: Entrance Exam card/link added
// ✅ NEW: Student Lesson Plans card/link added (student-safe)
// ✅ Chat + Notifications unchanged
// ✅ FIX: Stable card hover (no shaking / wrong link click)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import socket from "../socket";
import { Link } from "react-router-dom";
import DashboardInsights, { SummaryChart } from "./dashboard/DashboardInsights";
import { workspaceForPath } from "./dashboard/dashboardModel";
import { getAuthToken } from "../utils/student360Session";
import { useInstitution } from "../institution/InstitutionContext";
import CollegeLectureAttendanceWidget from "./CollegeLectureAttendanceWidget"; // COLLEGE_LECTURE_ATTENDANCE_DASHBOARD_V1
import CollegeCgpaWidget from "./CollegeCgpaWidget"; // COLLEGE_CREDITS_SGPA_CGPA_DASHBOARD_V1
import CollegeBacklogWidget from "./CollegeBacklogWidget"; // COLLEGE_BACKLOG_REAPPEAR_DASHBOARD_V1
import CollegeEnrollmentWidget from "./CollegeEnrollmentWidget"; // COLLEGE_UNIVERSITY_ENROLLMENT_DASHBOARD_V1
import CollegeGradeCardWidget from "./CollegeGradeCardWidget"; // COLLEGE_GRADECARD_TRANSCRIPT_DASHBOARD_V1
import CollegeStudent360Widget from "./CollegeStudent360Widget"; // COLLEGE_STUDENT_360_DASHBOARD_V1

const API_URL = process.env.REACT_APP_API_URL || "";
const token = getAuthToken;

const readActiveAdmission = () =>
  localStorage.getItem("activeStudentAdmission") ||
  localStorage.getItem("username") ||
  "";

const fmtINR = (v) =>
  isNaN(v)
    ? v ?? "-"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(Number(v || 0));

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const isOverdue = (due) => {
  if (!due) return false;
  const t = new Date(due);
  t.setHours(23, 59, 59, 999);
  return Date.now() > t.getTime();
};

export default function StudentDashboard() {
  const [loading, setLoading] = useState(true);
  const workspace = "ERP";
  const { isCollege, terms } = useInstitution();
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [summaryErrors, setSummaryErrors] = useState({});
  const [err, setErr] = useState(null);

  const [studentInfo, setStudentInfo] = useState(null);

  const [attendance, setAttendance] = useState({
    present: 0,
    absent: 0,
    leave: 0,
    total: 0,
  });

  const [lectureAttendance, setLectureAttendance] = useState({
    threshold: 75,
    overall: { total: 0, attended: 0, present: 0, absent: 0, late: 0, leave: 0, on_duty: 0, percentage: 0, shortage: false, lectures_needed: 0 },
    subjects: [],
    today: [],
    recent: [],
  });

  const [assignSummary, setAssignSummary] = useState({
    total: 0,
    submitted: 0,
    graded: 0,
    overdue: 0,
    next3: [],
  });

  const [feeSummary, setFeeSummary] = useState({
    totalDue: 0,
    totalRecv: 0,
    totalConcession: 0,
    vanDue: 0,
    vanRecv: 0,
  });

  const [todaySchedule, setTodaySchedule] = useState({ items: [], nextUp: null });
  const [recentCirculars, setRecentCirculars] = useState([]);

  const [diarySummary, setDiarySummary] = useState({
    total: 0,
    unack: 0,
    latest: [],
  });

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const abortRef = useRef(null);

  const [admission, setAdmission] = useState(readActiveAdmission());

  const userRoles = useMemo(() => {
    try {
      const roles = JSON.parse(localStorage.getItem("roles"));
      const fallback = localStorage.getItem("userRole") || localStorage.getItem("role");
      return (Array.isArray(roles) && roles.length ? roles : fallback ? [fallback] : []).map((role) => String(role).toLowerCase());
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  const canView =
    userRoles.includes("student") ||
    userRoles.includes("admin") ||
    userRoles.includes("superadmin") ||
    userRoles.includes("parent");

  useEffect(() => {
    const onStudentSwitched = (e) => {
      const next =
        e?.detail?.admissionNumber ||
        localStorage.getItem("activeStudentAdmission") ||
        "";
      if (next && next !== admission) setAdmission(next);
    };

    const onRoleChanged = () => {
      const next = readActiveAdmission();
      if (next !== admission) setAdmission(next);
    };

    window.addEventListener("student-switched", onStudentSwitched);
    window.addEventListener("role-changed", onRoleChanged);
    return () => {
      window.removeEventListener("student-switched", onStudentSwitched);
      window.removeEventListener("role-changed", onRoleChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admission]);

  useEffect(() => {
    const stored = localStorage.getItem("notifications");
    if (stored) setNotifications(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (!API_URL || !token() || !canView) {
      setErr(!canView ? "Access Denied" : "Not configured / not logged in");
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const headers = { Authorization: `Bearer ${token()}` };

    const fetchAttendance = async () => {
      try {
        let rows = [];
        const ownAdmission = localStorage.getItem("username") || "";
        const isStudentAccount = userRoles.includes("student");
        if (isStudentAccount && admission && admission !== ownAdmission) throw new Error("Attendance is only available for the signed-in student");
        const attendanceUrl = isStudentAccount
          ? `${API_URL}/attendance/student/me`
          : `${API_URL}/attendance/by-admission/${encodeURIComponent(admission)}`;
        try {
          const res = await fetch(
            attendanceUrl,
            { headers, signal: ac.signal }
          );
          if (!res.ok) throw new Error("Could not load attendance");
          rows = (await res.json()) || [];
        } catch (error) { if (admission) throw error; }
        if (!admission && (!rows || rows.length === 0)) {
          const res = await fetch(`${API_URL}/attendance/student/me`, {
            headers,
            signal: ac.signal,
          });
          rows = (await res.json()) || [];
        }

        const now = new Date();
        const m = now.getMonth(),
          y = now.getFullYear();
        const monthRows = rows.filter((r) => {
          const d = new Date(r.date);
          return d.getMonth() === m && d.getFullYear() === y;
        });

        const present = monthRows.filter((r) => (r.status || "").toLowerCase() === "present").length;
        const absent = monthRows.filter((r) => (r.status || "").toLowerCase() === "absent").length;
        const leave = monthRows.filter((r) => (r.status || "").toLowerCase() === "leave").length;

        if (!ac.signal.aborted) setAttendance({ present, absent, leave, total: monthRows.length });
      } catch { if (!ac.signal.aborted) setSummaryErrors((previous) => ({ ...previous, attendance: true })); }
    };

    const fetchLectureAttendance = async () => {
      if (!isCollege) return;
      if (!userRoles.includes("student")) {
        await fetchAttendance();
        return;
      }
      try {
        const res = await fetch(`${API_URL}/lecture-attendance/student/me/summary`, {
          headers,
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Could not load lecture attendance");
        const result = await res.json();
        if (!ac.signal.aborted) setLectureAttendance(result || {});
      } catch {
        if (!ac.signal.aborted) setSummaryErrors((previous) => ({ ...previous, lectureAttendance: true }));
      }
    };

    const fetchAssignments = async () => {
      try {
        if (admission && admission !== localStorage.getItem("username")) throw new Error("Assignments are only available for the signed-in student");
        let data;
        try {
          const res = await fetch(
            `${API_URL}/student-assignments/student?admission=${encodeURIComponent(admission)}`,
            { headers, signal: ac.signal }
          );
          if (!res.ok) throw new Error("Could not load assignments");
          data = await res.json();
        } catch (error) { if (admission) throw error; }
        if (!data) {
          const res = await fetch(`${API_URL}/student-assignments/student`, {
            headers,
            signal: ac.signal,
          });
          data = await res.json();
        }

        const list = data?.assignments || [];
        let submitted = 0,
          graded = 0,
          overdue = 0;

        list.forEach((a) => {
          const sa = a?.StudentAssignments?.[0] || {};
          const status = (sa?.status || "").toLowerCase();
          if (status === "submitted") submitted += 1;
          if (status === "graded") graded += 1;
          if (!["submitted", "graded"].includes(status) && isOverdue(sa?.dueDate)) overdue += 1;
        });

        const next3 = [];
        list
          .filter((a) => {
            const sa = a?.StudentAssignments?.[0] || {};
            const st = (sa?.status || "").toLowerCase();
            return !["submitted", "graded"].includes(st) && !!sa?.dueDate && !isOverdue(sa?.dueDate);
          })
          .sort(
            (a, b) =>
              new Date(a.StudentAssignments?.[0]?.dueDate || 0) -
              new Date(b.StudentAssignments?.[0]?.dueDate || 0)
          )
          .slice(0, 3)
          .forEach((a) =>
            next3.push({
              id: a.id,
              title: a.title || "Untitled",
              due: a.StudentAssignments?.[0]?.dueDate || null,
            })
          );

        if (!ac.signal.aborted) setAssignSummary({ total: list.length, submitted, graded, overdue, next3 });
      } catch { if (!ac.signal.aborted) setSummaryErrors((previous) => ({ ...previous, assignments: true })); }
    };

    const fetchCirculars = async () => {
      try {
        const res = await fetch(`${API_URL}/circulars`, { headers, signal: ac.signal });
        const data = await res.json();
        const filtered = (data?.circulars || [])
          .filter((c) => c.audience === "student" || c.audience === "both")
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
        if (!ac.signal.aborted) setRecentCirculars(filtered);
      } catch {}
    };

    const fetchFees = async () => {
      try {
        const res = await fetch(
          `${API_URL}/StudentsApp/admission/${encodeURIComponent(admission)}/fees`,
          { headers, signal: ac.signal }
        );
        if (!res.ok) throw new Error("Could not load fees");
        const data = await res.json();
        if (!ac.signal.aborted) setStudentInfo(data || null);
        const fees = data?.feeDetails || [];
        const totalDue = fees.reduce((s, f) => s + Number(f.finalAmountDue || 0), 0);
        const totalRecv = fees.reduce((s, f) => s + Number(f.totalFeeReceived || 0), 0);
        const totalConcession = fees.reduce((s, f) => s + Number(f.totalConcessionReceived || 0), 0);

        const vanObj = data?.vanFee || {};
        const vanCost = Number(vanObj.perHeadTotalDue || vanObj.transportCost || 0);
        const vanRecv = Number(vanObj.totalVanFeeReceived || 0);
        const vanCon = Number(vanObj.totalVanFeeConcession || 0);
        const vanDue = Math.max(vanCost - (vanRecv + vanCon), 0);

        if (!ac.signal.aborted) setFeeSummary({ totalDue, totalRecv, totalConcession, vanDue, vanRecv });
      } catch {}
    };

    const fetchDiarySummary = async () => {
      try {
        const withAdmission = (base) =>
          `${base}${base.includes("?") ? "&" : "?"}admission=${encodeURIComponent(admission)}`;

        let latestRes = await fetch(
          withAdmission(`${API_URL}/diaries/student/feed/list?page=1&pageSize=5&order=date:DESC`),
          { headers, signal: ac.signal }
        );
        if (!latestRes.ok) {
          latestRes = await fetch(`${API_URL}/diaries/student/feed/list?page=1&pageSize=5&order=date:DESC`, {
            headers,
            signal: ac.signal,
          });
        }

        const latestJson = await latestRes.json();
        const latestItems = Array.isArray(latestJson?.data) ? latestJson.data : [];
        const total = Number(latestJson?.pagination?.total || latestItems.length || 0);

        let unackRes = await fetch(
          withAdmission(
            `${API_URL}/diaries/student/feed/list?page=1&pageSize=1&order=date:DESC&onlyUnacknowledged=true`
          ),
          { headers, signal: ac.signal }
        );
        if (!unackRes.ok) {
          unackRes = await fetch(
            `${API_URL}/diaries/student/feed/list?page=1&pageSize=1&order=date:DESC&onlyUnacknowledged=true`,
            { headers, signal: ac.signal }
          );
        }

        const unackJson = await unackRes.json();
        const unack = Number(unackJson?.pagination?.total || 0);

        const latest = latestItems.map((d) => ({
          id: d.id,
          title: d.title || "Untitled",
          date: d.date,
          type: d.type,
        }));

        if (!ac.signal.aborted) setDiarySummary({ total, unack, latest });
      } catch {}
    };

    const fetchTodaySchedule = async () => {
      try {
        let tRes = await fetch(
          `${API_URL}/period-class-teacher-subject/student/timetable?admission=${encodeURIComponent(admission)}`,
          { headers, signal: ac.signal }
        );
        if (!tRes.ok) {
          tRes = await fetch(`${API_URL}/period-class-teacher-subject/student/timetable`, {
            headers,
            signal: ac.signal,
          });
        }
        const ttbRaw = await tRes.json();
        const ttb = Array.isArray(ttbRaw) ? ttbRaw : ttbRaw?.timetable || [];

        const pRes = await fetch(`${API_URL}/periods`, { headers, signal: ac.signal });
        const periods = (await pRes.json()) || [];

        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const todayName = days[new Date().getDay()];

        const mapByPeriod = new Map();
        ttb.filter((r) => r.day === todayName).forEach((r) => mapByPeriod.set(r.periodId, r));

        const items = periods
          .map((p) => {
            const r = mapByPeriod.get(p.id);
            return r
              ? {
                  period: p.period_name,
                  time: p.start_time && p.end_time ? `${p.start_time}–${p.end_time}` : "",
                  subject: r.Subject?.name || r.subjectId || "—",
                  teacher: r.Teacher?.name || "—",
                  startHM: p.start_time || "",
                }
              : null;
          })
          .filter(Boolean);

        let nextUp = null;
        const toMins = (hhmm) => {
          const [h, m] = (hhmm || "00:00").split(":").map(Number);
          return h * 60 + m;
        };
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        items.forEach((it) => {
          const mins = toMins(String(it.startHM));
          if (mins >= nowMin && (!nextUp || mins < toMins(nextUp.startHM))) nextUp = it;
        });

        if (!ac.signal.aborted) setTodaySchedule({ items, nextUp });
      } catch {}
    };

    (async () => {
      setLoading(true);
      setSummaryErrors({});
      setAttendance({ present: 0, absent: 0, leave: 0, total: 0 });
      setLectureAttendance({ threshold: 75, overall: { total: 0, attended: 0, present: 0, absent: 0, late: 0, leave: 0, on_duty: 0, percentage: 0, shortage: false, lectures_needed: 0 }, subjects: [], today: [], recent: [] });
      setAssignSummary({ total: 0, submitted: 0, graded: 0, overdue: 0, next3: [] });
      setStudentInfo(null);
      setFeeSummary({ totalDue: 0, totalRecv: 0, totalConcession: 0, vanDue: 0, vanRecv: 0 });
      setTodaySchedule({ items: [], nextUp: null });
      setDiarySummary({ total: 0, unack: 0, latest: [] });
      await Promise.all([
        isCollege ? fetchLectureAttendance() : fetchAttendance(),
        fetchAssignments(),
        fetchCirculars(),
        fetchFees(),
        fetchTodaySchedule(),
        fetchDiarySummary(),
      ]);
      if (!ac.signal.aborted) setLoading(false);
    })().catch(() => { if (!ac.signal.aborted) setLoading(false); });

    const onDiaryChanged = () => fetchDiarySummary();
    socket.on("diaryChanged", onDiaryChanged);

    return () => {
      ac.abort();
      socket.off("diaryChanged", onDiaryChanged);
    };
  }, [canView, admission, userRoles, dashboardRefresh, isCollege]);

  const presencePct =
    attendance.total > 0 ? Math.round((attendance.present / Math.max(attendance.total, 1)) * 100) : 0;
  const lecturePct = Number(lectureAttendance?.overall?.percentage || 0);
  const dashboardAttendancePct = isCollege ? lecturePct : presencePct;

  const Skeleton = () => (
    <div className="placeholder-glow p-3">
      <span className="placeholder col-12 mb-2"></span>
      <span className="placeholder col-8 mb-2"></span>
      <span className="placeholder col-10"></span>
    </div>
  );

  const StatCard = ({ title, value, sub, pillClass = "text-bg-primary", icon }) => (
    <div className="col-6 col-md-3">
      <div className="card border-0 shadow-lg rounded-4 h-100 fade-in-up">
        <div className="card-body text-center p-4">
          <div className={`badge ${pillClass} mb-3 d-inline-flex align-items-center gap-2`}>
            {icon && <i className={`bi ${icon} fs-6`}></i>} {title}
          </div>
          <div className="h3 fw-bold text-primary mb-2">{value}</div>
          {sub && <div className="small text-muted">{sub}</div>}
        </div>
      </div>
    </div>
  );

  const QuickLink = ({ to, icon, label, desc, badge }) => workspace !== "All" && workspaceForPath(to) !== workspace ? null : (
    <div className="col-6 col-md-4 col-lg-3">
      <Link to={to} className="student-quick-link text-decoration-none d-block h-100">
        <div className="card h-100 border-0 shadow-lg rounded-4 hover-rise glow-on-hover">
          <div className="card-body d-flex flex-column p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="icon-badge fs-5">{icon}</div>
              {badge && <div className="ms-auto">{badge}</div>}
            </div>
            <h6 className="fw-bold text-dark mb-1">{label}</h6>
            <p className="text-muted small flex-grow-1 mb-0">{desc}</p>
          </div>
        </div>
      </Link>
    </div>
  );

  const clearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
  };

  if (!canView) {
    return (
      <div className="container py-5 text-center">
        <h4>Access Denied</h4>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-sm-3 pb-5 dashboard-surface">
      {/* Top hero */}
      <div className="hero rounded-4 p-3 p-sm-4 my-3 position-relative overflow-hidden">
        <div className="hero-bg"></div>
        <div className="d-flex align-items-start gap-3 position-relative z-2">
          <div className="avatar-circle animate-pulse">
            {(studentInfo?.name || "S").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-grow-1">
            <h2 className="h4 text-white mb-1 fw-bold">
              Welcome{studentInfo?.name ? `, ${studentInfo.name}` : ""}
            </h2>
            <div className="d-flex flex-wrap gap-2 mt-1">
              <span className="chip chip-glass animate-slide-in">
                <i className="bi bi-person-badge me-1"></i>
                Adm No:{" "}
                <strong className="ms-1">{studentInfo?.admissionNumber || admission || "—"}</strong>
              </span>
              {studentInfo?.class_name && (
                <span className="chip chip-glass animate-slide-in" style={{ animationDelay: "0.1s" }}>
                  <i className="bi bi-mortarboard me-1"></i>
                  {terms.class}: <strong className="ms-1">{studentInfo.class_name}</strong>
                </span>
              )}
              {studentInfo?.section_name && (
                <span className="chip chip-glass animate-slide-in" style={{ animationDelay: "0.2s" }}>
                  <i className="bi bi-book me-1"></i>
                  {terms.section}: <strong className="ms-1">{studentInfo.section_name}</strong>
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-light btn-sm ms-auto position-relative rounded-pill px-3 animate-bounce"
            onClick={() => setShowNotifications(true)}
            title="Notifications"
          >
            <i className="bi bi-bell"></i>
            {notifications.length > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger pulse">
                {notifications.length}
              </span>
            )}
          </button>
        </div>

        {/* KPI strip */}
        <div className="row g-2 mt-3 position-relative z-2">
          <StatCard
            title={isCollege ? "Lecture Attendance" : "Attendance"}
            value={`${dashboardAttendancePct}%`}
            sub={isCollege ? `${lectureAttendance?.overall?.attended || 0}/${lectureAttendance?.overall?.total || 0} lectures attended` : `${attendance.present}/${attendance.total} present`}
            pillClass={isCollege && lectureAttendance?.overall?.shortage ? "text-bg-danger" : "text-bg-success"}
            icon="bi-check-circle"
          />
          <StatCard
            title="Assignments"
            value={`${assignSummary.total}`}
            sub={`Overdue: ${assignSummary.overdue} • Submitted: ${assignSummary.submitted}`}
            pillClass="text-bg-primary"
            icon="bi-journal-check"
          />
          <StatCard
            title="Fees Due"
            value={fmtINR(feeSummary.totalDue)}
            sub={`Van Due: ${fmtINR(feeSummary.vanDue)}`}
            pillClass="text-bg-danger"
            icon="bi-cash-coin"
          />
          <StatCard
            title="Diary"
            value={`${diarySummary.total}`}
            sub={`Pending ack: ${diarySummary.unack}`}
            pillClass="text-bg-info"
            icon="bi-journal-text"
          />
        </div>
      </div>

      {err && <div className="alert alert-warning rounded-4 shadow-sm">{String(err)}</div>}

      <div className="d-flex justify-content-end mb-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setDashboardRefresh((v) => v + 1)} disabled={loading}>Refresh dashboard</button></div>
      <div className="dashboard-insights dashboard-insight-grid">
        <SummaryChart
          title={isCollege ? "ERP · Lecture attendance" : "ERP · Attendance this month"}
          subtitle={isCollege ? "Recorded lecture attendance" : "Recorded attendance days"}
          loading={loading}
          error={isCollege ? summaryErrors.lectureAttendance : summaryErrors.attendance}
          data={isCollege
            ? [
                { name: "Present", value: lectureAttendance?.overall?.present || 0 },
                { name: "Absent", value: lectureAttendance?.overall?.absent || 0 },
                { name: "Late", value: lectureAttendance?.overall?.late || 0 },
                { name: "OD", value: lectureAttendance?.overall?.on_duty || 0 },
              ]
            : [
                { name: "Present", value: attendance.present },
                { name: "Absent", value: attendance.absent },
                { name: "Leave", value: attendance.leave },
              ]}
        />
      </div>
      <DashboardInsights role="student" admission={admission} workspace="ERP" />
      {isCollege && <CollegeLectureAttendanceWidget data={lectureAttendance} loading={loading} error={summaryErrors.lectureAttendance} />} 
      {/* COLLEGE_CREDITS_SGPA_CGPA_WIDGET_V1 */}
      {isCollege && userRoles.includes("student") && <CollegeCgpaWidget />} 
      {isCollege && userRoles.includes("student") && <CollegeBacklogWidget />} 
      {isCollege && userRoles.includes("student") && <CollegeEnrollmentWidget />} 
      {isCollege && userRoles.includes("student") && <CollegeGradeCardWidget />} 
      {isCollege && userRoles.includes("student") && <CollegeStudent360Widget />} 
      <h2 className="h5 mt-4">ERP · Quick access</h2>
      <p className="text-muted small">School services and administration. Use the LMS tab for lessons, assignments and assessments.</p>
      {/* Quick actions grid */}
      <div className="row g-3 mb-3">
        <QuickLink to="/assessments?assessment_type=assignment" icon={<i className="bi bi-journal-check text-primary" />} label="LMS Assignments" desc="Assignments, submissions and feedback" />
        <QuickLink to="/assessments" icon={<i className="bi bi-clipboard2-check text-primary" />} label="Tests & Results" desc="Assessments and published results" />
        <QuickLink to="/online-classes" icon={<i className="bi bi-camera-video text-primary" />} label="Online Classes" desc="View sessions and join classes" />
        <QuickLink to="/messages" icon={<i className="bi bi-envelope text-primary" />} label="Messages" desc="Conversations with your school" />
        {/* STUDENT_GRIEVANCE_SAFETY_DASHBOARD_V1 */}
        <QuickLink
          to="/student-grievances"
          icon={<i className="bi bi-shield-lock-fill text-primary" />}
          label="Report & Support"
          desc={isCollege ? "Confidential grievance, anti-ragging and student safety support" : "Confidential student safety, bullying and grievance support"}
        />
        {/* STUDENT_MENTORING_SUPPORT_DASHBOARD_V1 */}
        <QuickLink
          to="/student-mentoring"
          icon={<i className="bi bi-person-heart text-primary" />}
          label="My Mentor & Support"
          desc={isCollege ? "Faculty mentor, academic follow-ups and student success support" : "Mentor updates, academic support and follow-ups"}
        />
        {/* COLLEGE_STUDENT_REQUESTS_DASHBOARD_V1 */}
        {isCollege && (
          <QuickLink
            to="/college-student-requests"
            icon={<i className="bi bi-file-earmark-check-fill text-primary"></i>}
            label="Certificates & Requests"
            desc="Request official documents and track approval / issue status"
            badge={<span className="badge rounded-pill text-bg-primary fs-6">Open</span>}
          />
        )}
        {/* COLLEGE_INTERNSHIP_MANAGEMENT_DASHBOARD_V1 */}
        {isCollege && (
          <QuickLink
            to="/college-internships"
            icon={<i className="bi bi-building-check text-primary"></i>}
            label="My Internship"
            desc="Company, logbook, reports, mentor feedback and evaluation"
            badge={<span className="badge rounded-pill text-bg-primary fs-6">Open</span>}
          />
        )}
        {/* COLLEGE_PROJECT_DISSERTATION_DASHBOARD_V1 */}
        {isCollege && (
          <QuickLink
            to="/college-projects"
            icon={<i className="bi bi-kanban-fill text-primary"></i>}
            label="My Project / Dissertation"
            desc="Milestones, submissions, guide feedback and viva"
            badge={<span className="badge rounded-pill text-bg-primary fs-6">Open</span>}
          />
        )}
        {/* COLLEGE_HOSTEL_MANAGEMENT_DASHBOARD_V1 */}
        {isCollege && (
          <QuickLink
            to="/college-hostel"
            icon={<i className="bi bi-building-fill-gear text-primary"></i>}
            label="My Hostel"
            desc="Room and bed, outings, complaints and hostel charges"
            badge={<span className="badge rounded-pill text-bg-primary fs-6">Open</span>}
          />
        )}
        {/* COLLEGE_STUDENT_LEAVE_OD_DASHBOARD_V1 */}
        {isCollege && (
          <QuickLink
            to="/college-student-leave"
            icon={<i className="bi bi-calendar2-check-fill text-primary"></i>}
            label="My Leave & On-Duty"
            desc="Request leave or official OD and track approval status"
            badge={<span className="badge rounded-pill text-bg-primary fs-6">Open</span>}
          />
        )}
        {isCollege ? (
          <QuickLink
            to="/student-lecture-attendance"
            icon={<i className="bi bi-person-check text-success"></i>}
            label="Lecture Attendance"
            desc="Subject-wise lecture attendance, shortage and history"
            badge={<span className={`badge rounded-pill fs-6 ${lectureAttendance?.overall?.shortage ? "text-bg-danger" : "text-bg-success"}`}>{lecturePct}%</span>}
          />
        ) : (
          <QuickLink
            to="/student-attendance"
            icon={<i className="bi bi-calendar2-check text-success"></i>}
            label="Attendance"
            desc="View monthly attendance & holidays"
            badge={<span className="badge rounded-pill text-bg-success fs-6">{presencePct}%</span>}
          />
        )}
        <QuickLink
          to="/my-assignments"
          icon={<i className="bi bi-journal-check text-primary"></i>}
          label="Legacy Assignments"
          desc="Earlier tasks, due dates & grades"
          badge={<span className="badge rounded-pill text-bg-danger fs-6">{assignSummary.overdue} overdue</span>}
        />
        <QuickLink
          to="/student-diary"
          icon={<i className="bi bi-journal-text text-info"></i>}
          label="Diary"
          desc="Class notes & announcements"
          badge={<span className="badge rounded-pill text-bg-info fs-6">{diarySummary.unack} pending</span>}
        />
        <QuickLink
          to="/student-lesson-plans"
          icon={<i className="bi bi-journal-bookmark text-primary"></i>}
          label="Student Lesson Plans"
          desc="View published lesson plans, homework and evaluations"
          badge={<span className="badge rounded-pill text-bg-primary fs-6">Open</span>}
        />
        <QuickLink
          to="/student-circulars"
          icon={<i className="bi bi-megaphone text-info"></i>}
          label="Circulars"
          desc="Latest announcements"
          badge={<span className="badge rounded-pill text-bg-primary fs-6">{recentCirculars.length} new</span>}
        />
        <QuickLink
          to="/student-timetable-display"
          icon={<i className="bi bi-clock-history text-secondary"></i>}
          label="Timetable"
          desc="Today’s periods & substitutions"
          badge={<span className="badge rounded-pill text-bg-secondary fs-6">{todaySchedule.items.length || 0} periods</span>}
        />
        <QuickLink
          to="/student-fee"
          icon={<i className="bi bi-cash-coin text-warning"></i>}
          label="Fees"
          desc="Dues, concessions & payments"
          badge={<span className="badge rounded-pill text-bg-warning text-dark fs-6">{fmtINR(feeSummary.vanDue)} van due</span>}
        />
        <QuickLink
          to="/my-library"
          icon={<i className="bi bi-journal-bookmark text-success"></i>}
          label="My Library"
          desc="Issued books, due dates & fines"
          badge={<span className="badge rounded-pill text-bg-success fs-6">Open</span>}
        />
        <QuickLink
          to="/academic-calendar-view"
          icon={<i className="bi bi-calendar3 text-primary"></i>}
          label="Academic Calendar"
          desc="Holidays, events & exams"
          badge={<span className="badge rounded-pill text-bg-primary fs-6">Open</span>}
        />
        <QuickLink
          to="/entrance-exam"
          icon={<i className="bi bi-ui-checks-grid text-danger"></i>}
          label="Entrance Exam"
          desc="Start or continue your entrance exam"
          badge={<span className="badge rounded-pill text-bg-danger fs-6">Open</span>}
        />
        <QuickLink
          to="/chat"
          icon={<i className="bi bi-chat-dots text-dark"></i>}
          label="Chat"
          desc="Ask & get help instantly"
          badge={<span className="badge rounded-pill text-bg-dark fs-6">Live</span>}
        />
      </div>

      {/* The rest UI kept same (Upcoming Assignments + Circulars + Timetable) */}
      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-lg rounded-4 h-100 fade-in-up" style={{ animationDelay: "0.1s" }}>
            <div className="card-header bg-gradient-primary text-white rounded-top-4 d-flex align-items-center gap-2">
              <i className="bi bi-clipboard-check fs-5"></i>
              Upcoming Assignments
            </div>
            <div className="card-body p-0">
              {loading ? (
                <Skeleton />
              ) : assignSummary.next3.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-check-circle display-4 mb-2 opacity-25"></i>
                  <div>No upcoming assignments.</div>
                </div>
              ) : (
                <ul className="list-group list-group-flush rounded-bottom-4">
                  {assignSummary.next3.map((a) => (
                    <li
                      key={a.id}
                      className="list-group-item px-4 py-3 d-flex justify-content-between align-items-center border-0 hover-light"
                    >
                      <div className="me-2">
                        <div className="fw-bold text-truncate" style={{ maxWidth: 220 }}>
                          {a.title}
                        </div>
                        <div className="small text-muted mt-1">
                          <i className="bi bi-calendar-event me-1"></i>Due: {fmtDate(a.due)}
                        </div>
                      </div>
                      <Link className="btn btn-sm btn-outline-primary rounded-pill px-3" to="/my-assignments">
                        <i className="bi bi-box-arrow-up-right"></i> Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card border-0 shadow-lg rounded-4 h-100 fade-in-up" style={{ animationDelay: "0.2s" }}>
            <div className="card-header bg-gradient-info text-white rounded-top-4 d-flex align-items-center gap-2">
              <i className="bi bi-newspaper fs-5"></i>
              Recent Circulars
            </div>
            <div className="card-body p-0">
              {loading ? (
                <Skeleton />
              ) : recentCirculars.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  <i className="bi bi-bell display-4 mb-2 opacity-25"></i>
                  <div>No recent circulars.</div>
                </div>
              ) : (
                <ul className="list-group list-group-flush rounded-bottom-4">
                  {recentCirculars.map((c) => (
                    <li
                      key={c.id}
                      className="list-group-item px-4 py-3 d-flex justify-content-between align-items-start border-0 hover-light"
                    >
                      <div className="me-2 flex-grow-1">
                        <div className="fw-bold text-truncate" style={{ maxWidth: 260 }}>
                          {c.title || "Untitled"}
                        </div>
                        <div className="small text-muted mt-1">
                          <i className="bi bi-clock-history me-1"></i>
                          {fmtDate(c.createdAt)}
                        </div>
                      </div>
                      <Link className="btn btn-sm btn-outline-info rounded-pill px-3 ms-2" to="/student-circulars">
                        <i className="bi bi-eye"></i> View
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-lg rounded-4 mt-3 fade-in-up" style={{ animationDelay: "0.3s" }}>
        <div className="card-header bg-gradient-secondary text-white rounded-top-4 d-flex align-items-center gap-2">
          <i className="bi bi-table fs-5"></i>
          Today’s Timetable
        </div>
        <div className="card-body">
          {loading ? (
            <Skeleton />
          ) : todaySchedule.items.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <i className="bi bi-calendar-x display-4 mb-2 opacity-25"></i>
              <div>No periods scheduled today.</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-dark">
                  <tr>
                    <th scope="col">
                      <i className="bi bi-hash me-1"></i>Period
                    </th>
                    <th scope="col">
                      <i className="bi bi-clock me-1"></i>Time
                    </th>
                    <th scope="col">
                      <i className="bi bi-book me-1"></i>Subject
                    </th>
                    <th scope="col">
                      <i className="bi bi-person me-1"></i>Teacher
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {todaySchedule.items.map((it, idx) => (
                    <tr
                      key={idx}
                      className={`hover-row ${todaySchedule.nextUp?.period === it.period ? "table-info" : ""}`}
                    >
                      <td className="fw-semibold">
                        <i className="bi bi-circle-fill text-primary me-2 opacity-75" style={{ fontSize: "0.6em" }} />
                        {it.period}
                      </td>
                      <td>
                        <span className="badge bg-light text-dark rounded-pill px-2 py-1">{it.time}</span>
                      </td>
                      <td className="fw-medium">{it.subject}</td>
                      <td className="text-muted small">{it.teacher}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-end mt-3 pt-2 border-top">
            <Link className="btn btn-outline-secondary btn-sm rounded-pill px-4" to="/student-timetable-display">
              <i className="bi bi-arrow-right me-1"></i>Full Timetable
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications Overlay */}
      {showNotifications && (
        <div
          className="overlay"
          aria-modal="true"
          role="dialog"
          onClick={(e) => {
            if (e.target.classList.contains("overlay")) setShowNotifications(false);
          }}
        >
          <div className="sheet fade-in">
            <button
              className="btn-close position-absolute top-0 end-0 m-3"
              onClick={() => setShowNotifications(false)}
              aria-label="Close"
            ></button>
            <h5 className="mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-bell"></i>Notifications
            </h5>
            {notifications.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="bi bi-bell-slash display-4 mb-2 opacity-50"></i>
                <div className="fs-6">No notifications.</div>
              </div>
            ) : (
              <ul className="list-group list-group-flush rounded-3">
                {notifications.map((n, i) => (
                  <li key={i} className="list-group-item border-0 px-0 py-3">
                    <div className="d-flex align-items-start gap-3">
                      <div
                        className="bg-primary rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: "40px", height: "40px" }}
                      >
                        <i className="bi bi-info-circle text-white fs-6"></i>
                      </div>
                      <div className="flex-grow-1">
                        <p className="mb-1 fw-medium">{n}</p>
                        <small className="text-muted">Just now</small>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAllNotifications} className="btn btn-primary mt-3 rounded-pill w-100">
                <i className="bi bi-trash me-2"></i>Clear All
              </button>
            )}
          </div>
        </div>
      )}

      <ToastContainer />
      <style>{`
        :root{
          --grad-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          --grad-info: linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%);
          --grad-secondary: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
        }
        .hero{
          background: var(--grad-primary);
          color: #eaf2ff;
          border: 1px solid rgba(255,255,255,.25);
          box-shadow: 0 20px 40px rgba(102, 126, 234, .3);
          overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,.1) 0%, transparent 70%);
          animation: float 6s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(10px, -10px) rotate(1deg); }
        }
        .hero-bg {
          position: absolute; inset: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.05"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.05"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.03"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.5;
        }
        .avatar-circle{
          width: 48px; height: 48px; border-radius: 50%;
          background: rgba(255,255,255,.25);
          display:flex; align-items:center; justify-content:center;
          font-weight: 900; color: #fff; font-size: 1.2rem;
          border:2px solid rgba(255,255,255,.5);
          box-shadow: 0 4px 12px rgba(0,0,0,.2);
        }
        .chip{
          background: rgba(255,255,255,.2);
          border:1px solid rgba(255,255,255,.4);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          color:#fff;
          padding: 8px 12px;
          font-size: .875rem;
          transition: all .2s ease;
        }
        .chip:hover { background: rgba(255,255,255,.3); }
        .icon-badge{
          width: 44px; height: 44px; border-radius: 12px;
          display:flex; align-items:center; justify-content:center;
          background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
          border:1px solid rgba(59, 130, 246, .2);
          color: #2563eb;
          transition: all .2s ease;
        }
        /* ✅ Stable quick cards
           Earlier hover was using transform: translateY(-2px).
           That can move the card under the cursor and cause hover flicker / wrong link clicks.
        */
        .student-quick-link {
          border-radius: 1rem;
          position: relative;
          z-index: 1;
          outline: none;
        }
        .student-quick-link:focus-visible .card {
          box-shadow: 0 0 0 .2rem rgba(13,110,253,.25), 0 12px 24px rgba(0,0,0,.10) !important;
        }
        .student-quick-link .card {
          position: relative;
          transform: none !important;
          transition: box-shadow .18s ease, border-color .18s ease, background-color .18s ease;
          will-change: auto;
        }
        @media (hover: hover) and (pointer: fine) {
          .student-quick-link:hover {
            z-index: 5;
          }
          .hover-rise:hover{
            transform: none !important;
            border: 1px solid rgba(13,110,253,.22) !important;
            box-shadow: 0 14px 28px rgba(0,0,0,.12) !important;
          }
        }
        .glow-on-hover{ position:relative; overflow:hidden; }
        .glow-on-hover::before{
          content:'';
          position:absolute; top:0; left:-100%; width:100%; height:100%;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
          transition: left .45s ease;
        }
        .glow-on-hover:hover::before{ left:100%; }

        @keyframes fade-in-up { from { opacity:0; transform: translateY(20px);} to { opacity:1; transform: translateY(0);} }
        .fade-in-up { animation: fade-in-up .6s ease-out forwards; }
        .animate-pulse { animation: pulse2 2s infinite; }
        @keyframes pulse2 { 0%,100%{ transform:scale(1);} 50%{ transform:scale(1.05);} }
        .animate-bounce { animation: bounce2 2s infinite; }
        @keyframes bounce2 {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-5px); }
          60% { transform: translateY(-3px); }
        }
        .pulse{ animation: pulse 2s infinite; background: linear-gradient(45deg, #ff0000, #ff4444); }
        @keyframes pulse { 0%{ box-shadow:0 0 0 0 rgba(255,0,0,.7);} 70%{ box-shadow:0 0 0 10px rgba(255,0,0,0);} 100%{ box-shadow:0 0 0 0 rgba(255,0,0,0);} }

        .overlay{
          position: fixed; inset: 0; z-index: 1200;
          background: rgba(0,0,0,.5);
          display:flex; align-items:flex-start; justify-content:center;
          padding:16px; backdrop-filter: blur(4px);
        }
        .sheet{
          background:#fff; width:100%; max-width:600px; max-height:85vh;
          overflow:auto; border-radius:20px; padding:24px; position:relative;
          box-shadow:0 20px 60px rgba(0,0,0,.3);
          margin-top:64px;
        }

        .bg-gradient-primary { background: var(--grad-primary); }
        .bg-gradient-info { background: var(--grad-info); }
        .bg-gradient-secondary { background: var(--grad-secondary); }

        .hover-light:hover { background-color: rgba(0,0,0,.02) !important; }
        .hover-row:hover { background-color: rgba(0,0,0,.03); }

        @media (max-width: 575.98px){
          .icon-badge{ width: 40px; height: 40px; font-size: 1rem; }
          .chip{ font-size: .8rem; padding: 6px 10px; }
          .hero { margin: 0 -1rem 1.5rem; border-radius: 0; }
          .hero::before,
          .animate-pulse,
          .animate-bounce,
          .pulse {
            animation: none !important;
          }
          .glow-on-hover::before {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
