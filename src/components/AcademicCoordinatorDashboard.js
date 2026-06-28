// File: src/components/Dashboard.jsx
// ✅ Polished Academic Coordinator / Admin Dashboard
// ✅ Adds Digital Diary Monitor quick card
// ✅ Organizes coordinator tools into a cleaner quick-access area
// ✅ Keeps attendance dashboard logic intact

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import { useNavigate } from "react-router-dom";

// Charts
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// ---- role helpers ----------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = (multiRoles.length ? multiRoles : [singleRole].filter(Boolean)).map((r) =>
    String(r || "").toLowerCase()
  );

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isAcademicCoordinator:
      roles.includes("academic_coordinator") || roles.includes("coordinator"),
    isPrincipal: roles.includes("principal"),
  };
};

const formatDateInput = (date = new Date()) => date.toISOString().split("T")[0];

export default function Dashboard() {
  const navigate = useNavigate();

  const { roles, isAdmin, isSuperadmin, isAcademicCoordinator, isPrincipal } = useMemo(
    getRoleFlags,
    []
  );

  const canSeeAcademicCards =
    isAdmin || isSuperadmin || isAcademicCoordinator || isPrincipal;

  const displayName =
    localStorage.getItem("name") || localStorage.getItem("username") || "User";

  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(formatDateInput());
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // ✅ reliable retry/refresh
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ Academic calendar mini summary
  const [calMini, setCalMini] = useState(null);
  const [calErr, setCalErr] = useState(null);

  // ✅ Syllabus approvals mini count
  const [syllPendingCount, setSyllPendingCount] = useState(null);
  const [syllPendingErr, setSyllPendingErr] = useState(null);
  const [loadingSyllPending, setLoadingSyllPending] = useState(false);

  const formatTime = (ts) =>
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(ts);

  const goToday = () => setSelectedDate(formatDateInput());

  const shiftDay = (delta) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(formatDateInput(d));
  };

  const hardRefresh = () => setRefreshKey((k) => k + 1);

  // ---- navigation helpers ---------------------------------------------------
  const openAcademicCalendar = () => navigate("/academic-calendar");
  const openDigitalDiaryMonitor = () => navigate("/coordinator-digital-diaries");
  const openMessages = () => navigate("/messages");
  const openSyllabusTeacherAssignment = () => navigate("/syllabus-teacher-assignment");
  const openTeacherAssignment = () => navigate("/teacher-assignment");
  const openSyllabusApproval = () => navigate("/syllabus-approval");
  const openAdmissionSyllabusAssignee = () => navigate("/admission-syllabus-assignee");

  // Fetch attendance summary
  useEffect(() => {
    let mounted = true;

    async function fetchAttendanceSummary() {
      setLoading(true);
      setError(null);

      try {
        const res = await api.get(`/attendance/summary/${selectedDate}`);
        if (mounted) {
          setAttendanceSummary(res.data);
          setLastRefreshed(Date.now());
        }
      } catch (err) {
        if (mounted) {
          setError(err?.response?.data?.message || err.message || "Failed to load");
        }
        console.error("Error fetching attendance summary:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchAttendanceSummary();

    return () => {
      mounted = false;
    };
  }, [selectedDate, refreshKey]);

  // Derived attendance numbers
  const { total, absent, leaves, present } = useMemo(() => {
    let t = 0;
    let a = 0;
    let l = 0;

    if (attendanceSummary?.summary?.length) {
      for (const c of attendanceSummary.summary) {
        t += Number(c.total || 0);
        a += Number(c.absent || 0);
        l += Number(c.leave || 0);
      }
    }

    return {
      total: t,
      absent: a,
      leaves: l,
      present: Math.max(t - a - l, 0),
    };
  }, [attendanceSummary]);

  const overallPresentPct = total ? Math.round((present / total) * 100) : 0;
  const overallAbsentPct = total ? Math.round((absent / total) * 100) : 0;
  const overallLeavePct = total ? Math.round((leaves / total) * 100) : 0;

  const pieData = useMemo(
    () => ({
      labels: ["Present", "Absent", "Leaves"],
      datasets: [
        {
          data: [present, absent, leaves],
          backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
          borderWidth: 0,
          hoverOffset: 8,
        },
      ],
    }),
    [present, absent, leaves]
  );

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { usePointStyle: true, padding: 16 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed || 0;
              const pct = total ? ((v / total) * 100).toFixed(1) : 0;
              return `${ctx.label}: ${v} (${pct}%)`;
            },
          },
        },
      },
      cutout: "60%",
    }),
    [total]
  );

  // ✅ Mini Academic Calendar info
  const fetchCalendarMini = useCallback(async () => {
    if (!canSeeAcademicCards) return;

    setLoadingCalendar(true);
    setCalErr(null);

    try {
      const res = await api
        .get("/academic-calendars/summary-by-month")
        .catch(() => ({ data: null }));

      const cal = res?.data?.calendar;
      const summary = Array.isArray(res?.data?.summary) ? res.data.summary : [];

      if (!cal) {
        setCalMini(null);
        return;
      }

      const totals = summary.reduce(
        (acc, m) => {
          acc.working_days += Number(m.working_days || 0);
          acc.holidays += Number(m.holidays || 0);
          acc.vacations += Number(m.vacations || 0);
          acc.exams += Number(m.exams || 0);
          acc.ptm += Number(m.ptm || 0);
          acc.activities += Number(m.activities || 0);
          acc.events += Number(m.events || 0);
          acc.others += Number(m.others || 0);
          return acc;
        },
        {
          working_days: 0,
          holidays: 0,
          vacations: 0,
          exams: 0,
          ptm: 0,
          activities: 0,
          events: 0,
          others: 0,
        }
      );

      setCalMini({
        ...cal,
        ...totals,
        months: summary.length,
      });
    } catch (e) {
      console.error("Calendar mini error:", e);
      setCalErr(e?.response?.data?.error || e?.message || "Failed to load calendar");
      setCalMini(null);
    } finally {
      setLoadingCalendar(false);
    }
  }, [canSeeAcademicCards]);

  // ✅ Syllabus pending count
  const fetchSyllabusPendingMini = useCallback(async () => {
    if (!canSeeAcademicCards) return;

    setLoadingSyllPending(true);
    setSyllPendingErr(null);

    try {
      const res = await api.get("/syllabus-breakdowns/pending").catch(() => ({ data: null }));
      const data = res?.data?.data || res?.data || [];
      const arr = Array.isArray(data) ? data : [];
      setSyllPendingCount(arr.length);
    } catch (e) {
      console.error("Syllabus pending mini error:", e);
      setSyllPendingErr(e?.response?.data?.message || e?.message || "Failed to load pending");
      setSyllPendingCount(null);
    } finally {
      setLoadingSyllPending(false);
    }
  }, [canSeeAcademicCards]);

  useEffect(() => {
    fetchCalendarMini();
    fetchSyllabusPendingMini();
  }, [fetchCalendarMini, fetchSyllabusPendingMini, refreshKey]);

  const initials = useMemo(() => {
    const parts = String(displayName || "User")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = (parts[0] || "U")[0] || "U";
    const b = (parts[1] || "")[0] || "";
    return (a + b).toUpperCase();
  }, [displayName]);

  return (
    <div className="container-fluid px-3 py-3 dashboard-pro">
      {/* HERO HEADER */}
      <section className="hero-pro mb-4">
        <div className="hero-overlay p-3 p-md-4 rounded-4 shadow-sm">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
            <div className="d-flex align-items-start gap-3">
              <div className="hero-avatar">{initials}</div>

              <div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <h4 className="mb-0 text-white fw-semibold">
                    Welcome back, {displayName}
                  </h4>
                  <span className="badge bg-light text-dark border">{selectedDate}</span>
                  <span className="badge bg-light text-dark border">
                    Updated: {formatTime(lastRefreshed)}
                  </span>
                </div>

                <div className="text-white-50 small mt-1 hero-subtitle">
                  Academic operations dashboard with attendance overview, digital diary
                  monitoring, approvals, syllabus tools, and coordinator quick access.
                </div>

                <div className="d-flex flex-wrap gap-2 mt-2">
                  {roles.map((role) => (
                    <span
                      key={role}
                      className="badge border border-white border-opacity-25 bg-dark bg-opacity-25 text-white"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="hero-actions d-flex gap-2 align-items-end flex-wrap">
              <div>
                <label htmlFor="summaryDate" className="form-label mb-1 small text-white-50">
                  Attendance Date
                </label>
                <input
                  id="summaryDate"
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="d-flex gap-2 pb-1 flex-wrap">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => shiftDay(-1)}
                  title="Previous day"
                >
                  ◀
                </button>
                <button className="btn btn-warning" type="button" onClick={goToday}>
                  Today
                </button>
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => shiftDay(1)}
                  title="Next day"
                >
                  ▶
                </button>
                <button
                  className="btn btn-outline-light"
                  type="button"
                  onClick={hardRefresh}
                  title="Refresh"
                >
                  ⟳ Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      {canSeeAcademicCards && (
        <section className="mb-4">
          <div className="section-heading d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
            <div>
              <h5 className="mb-1 fw-semibold">Coordinator Quick Access</h5>
              <div className="text-muted small">
                Important academic tools arranged in one clean place.
              </div>
            </div>
            <span className="badge bg-primary-subtle text-primary border px-3 py-2 rounded-pill">
              {roles.includes("academic_coordinator") || roles.includes("coordinator")
                ? "Coordinator View"
                : "Admin View"}
            </span>
          </div>

          <div className="row g-3">
            <QuickActionCard
              accent="blue"
              icon="bi-calendar3"
              eyebrow="Academic Planning"
              title={loadingCalendar ? "Loading Calendar..." : calMini?.title || "Academic Calendar"}
              description={
                loadingCalendar
                  ? "Fetching latest calendar details..."
                  : calMini
                  ? `Session: ${calMini.academic_session || "-"}`
                  : calErr || "Create and manage academic calendar."
              }
              badges={
                calMini
                  ? [
                      `Status: ${calMini.status || "-"}`,
                      `Working: ${calMini.working_days || 0}`,
                      `Holidays: ${calMini.holidays || 0}`,
                    ]
                  : ["Calendar", "Holidays", "Events"]
              }
              buttonText="Open Calendar"
              buttonClass="btn-primary"
              onClick={openAcademicCalendar}
              secondaryText={loadingCalendar ? "…" : "⟳"}
              secondaryTitle="Reload calendar"
              secondaryDisabled={loadingCalendar}
              onSecondaryClick={fetchCalendarMini}
            />

            <QuickActionCard
              accent="sky"
              icon="bi-journal-text"
              eyebrow="Digital Diary Monitor"
              title="All Classes Diaries"
              description="Check which teacher sent diary to which class, section, and subject."
              badges={["Teacher Wise", "Class Wise", "Attachments"]}
              buttonText="Open Monitor"
              buttonClass="btn-info text-white"
              onClick={openDigitalDiaryMonitor}
              featured
            />

            <QuickActionCard
              accent="indigo"
              icon="bi-chat-dots"
              eyebrow="Communication"
              title="Messages"
              description="Open student/parent messages, fee reminders, and replies from one place."
              badges={["Fee Reminders", "Replies"]}
              buttonText="Open Messages"
              buttonClass="btn-primary"
              onClick={openMessages}
            />

            <QuickActionCard
              accent="amber"
              icon="bi-diagram-3"
              eyebrow="Syllabus Module"
              title="Assign Syllabus Teacher"
              description="Assign Class + Subject to teacher for syllabus work."
              badges={["Class+Subject", "Replace Allowed"]}
              buttonText="Open Assignment"
              buttonClass="btn-warning"
              onClick={openSyllabusTeacherAssignment}
              secondaryText="Map"
              secondaryTitle="Open teacher assignment"
              onSecondaryClick={openTeacherAssignment}
            />

            <QuickActionCard
              accent="green"
              icon="bi-check2-square"
              eyebrow="Syllabus Workflow"
              title="Syllabus Approvals"
              description="Review submissions and approve or return with remarks."
              badges={[
                `Pending: ${loadingSyllPending ? "…" : syllPendingCount != null ? syllPendingCount : "—"}`,
                "PDF Preview",
              ]}
              error={syllPendingErr}
              buttonText="Open Approvals"
              buttonClass="btn-success"
              onClick={openSyllabusApproval}
              secondaryText={loadingSyllPending ? "…" : "⟳"}
              secondaryTitle="Reload pending count"
              secondaryDisabled={loadingSyllPending}
              onSecondaryClick={fetchSyllabusPendingMini}
            />

            <QuickActionCard
              accent="purple"
              icon="bi-person-check"
              eyebrow="Admission Workflow"
              title="Admission Syllabus Assignee"
              description="Assign applying class and subject to user for admission syllabus work."
              badges={["Admission Class", "Status + Remarks"]}
              buttonText="Open Assignee"
              buttonClass="btn-primary"
              onClick={openAdmissionSyllabusAssignee}
            />
          </div>
        </section>
      )}

      {/* STATES */}
      {loading && (
        <div className="mb-4">
          <div className="placeholder-glow">
            <div className="row g-3">
              {[...Array(4)].map((_, i) => (
                <div className="col-md-6" key={i}>
                  <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-body">
                      <div className="placeholder col-6 mb-2" />
                      <div className="placeholder col-4" style={{ height: 32 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger d-flex align-items-center rounded-4" role="alert">
          <span className="me-2">⚠️</span>
          <div>
            Failed to load attendance for <strong>{selectedDate}</strong>. {error}
          </div>
          <button className="btn btn-sm btn-light ms-auto" onClick={hardRefresh}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !attendanceSummary && (
        <EmptyState
          icon="bi-clipboard2-data"
          title="No attendance summary available"
          message={`No summary available for ${selectedDate}.`}
        />
      )}

      {!loading && !error && attendanceSummary && (
        <>
          {/* KPI + Chart */}
          <section className="mb-4">
            <div className="section-heading d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
              <div>
                <h5 className="mb-1 fw-semibold">Attendance Overview</h5>
                <div className="text-muted small">
                  Live summary for selected date with present, absent, and leave counts.
                </div>
              </div>
              <span className="badge bg-light text-dark border px-3 py-2 rounded-pill">
                {attendanceSummary.date || selectedDate}
              </span>
            </div>

            <div className="row g-3">
              <div className="col-xl-8">
                <div className="row g-3">
                  <MetricCard
                    title="Total Students"
                    value={total}
                    sub="All students counted"
                    variant="secondary"
                    icon="bi-people"
                  />
                  <MetricCard
                    title="Present"
                    value={present}
                    sub={`${overallPresentPct}% of total`}
                    variant="success"
                    icon="bi-check-circle"
                  />
                  <MetricCard
                    title="Absent"
                    value={absent}
                    sub={`${overallAbsentPct}% of total`}
                    variant="danger"
                    icon="bi-x-circle"
                  />
                  <MetricCard
                    title="Leaves"
                    value={leaves}
                    sub={`${overallLeavePct}% of total`}
                    variant="warning"
                    icon="bi-calendar-minus"
                  />
                </div>
              </div>

              <div className="col-xl-4 d-flex">
                <div className="card shadow-sm rounded-4 flex-fill border-0 chart-card">
                  <div className="card-header bg-white border-0 fw-semibold rounded-top-4 d-flex justify-content-between align-items-center">
                    <span>Overall Attendance</span>
                    <span className="badge bg-primary-subtle text-primary border rounded-pill">
                      {overallPresentPct}% Present
                    </span>
                  </div>
                  <div className="card-body" style={{ height: 340 }}>
                    <Pie data={pieData} options={pieOptions} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Breakdown header */}
          <section>
            <div className="section-heading d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
              <div>
                <h5 className="mb-1 fw-semibold">Class & Section Breakdown</h5>
                <div className="text-muted small">
                  Detailed attendance progress for each class-section.
                </div>
              </div>
              <span className="badge bg-light text-dark border px-3 py-2 rounded-pill">
                {attendanceSummary.summary?.length || 0} sections
              </span>
            </div>

            {/* Breakdown cards */}
            <div className="row g-3">
              {attendanceSummary.summary.map((item) => {
                const pres =
                  Number(item.total || 0) -
                  (Number(item.absent || 0) + Number(item.leave || 0));

                const pPres = item.total ? Math.round((pres / item.total) * 100) : 0;
                const pAbs = item.total ? Math.round((item.absent / item.total) * 100) : 0;
                const pLev = item.total ? Math.round((item.leave / item.total) * 100) : 0;

                return (
                  <div
                    className="col-12 col-md-6 col-xl-4"
                    key={`${item.class_id}-${item.section_id}`}
                  >
                    <div className="card h-100 shadow-sm rounded-4 border-0 breakdown-card">
                      <div className="card-header bg-white border-0 rounded-top-4">
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <div className="fw-semibold fs-6">
                              Class {item.class_name} — Section {item.section_name}
                            </div>
                            <div className="small text-muted">Total Students: {item.total}</div>
                          </div>

                          <span className="badge bg-primary-subtle text-primary border rounded-pill">
                            {pPres}% Present
                          </span>
                        </div>
                      </div>

                      <div className="card-body pt-2">
                        <ProgressStat
                          label="Present"
                          value={pres}
                          percent={pPres}
                          barClass="bg-success"
                        />
                        <ProgressStat
                          label="Absent"
                          value={item.absent}
                          percent={pAbs}
                          barClass="bg-danger"
                        />
                        <ProgressStat
                          label="Leaves"
                          value={item.leave}
                          percent={pLev}
                          barClass="bg-warning"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      <style>{`
        .dashboard-pro{
          --soft-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
          --lift-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
          background:
            radial-gradient(700px 260px at 0% 0%, rgba(59,130,246,.08), transparent 55%),
            radial-gradient(700px 260px at 100% 0%, rgba(124,58,237,.07), transparent 55%);
          min-height: 100%;
        }

        .hero-pro{
          background:
            radial-gradient(1000px 400px at 10% 10%, rgba(255,255,255,.18), transparent 60%),
            linear-gradient(135deg, #1e3a8a, #2563eb, #7c3aed);
          border-radius: 1.25rem;
        }

        .hero-overlay{
          border: 1px solid rgba(255,255,255,.16);
          backdrop-filter: blur(8px);
        }

        .hero-avatar{
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: rgba(255,255,255,.18);
          color: #fff;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight: 800;
          font-size: 1.05rem;
          border: 1px solid rgba(255,255,255,.24);
          box-shadow: 0 10px 24px rgba(0,0,0,.14);
          flex: 0 0 auto;
        }

        .hero-subtitle{
          max-width: 820px;
        }

        .section-heading h5{
          color: #0f172a;
        }

        .quick-action-card,
        .metric-card,
        .breakdown-card,
        .chart-card{
          transition: transform .18s ease, box-shadow .18s ease;
        }

        .quick-action-card:hover,
        .metric-card:hover,
        .breakdown-card:hover,
        .chart-card:hover{
          transform: translateY(-3px);
          box-shadow: var(--lift-shadow) !important;
        }

        .quick-card-body{
          position: relative;
          min-height: 255px;
          display: flex;
          flex-direction: column;
        }

        .quick-action-card.featured-card{
          border-width: 2px !important;
        }

        .featured-ribbon{
          position: absolute;
          top: 14px;
          right: 14px;
          font-size: .7rem;
          letter-spacing: .02em;
        }

        .quick-icon{
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size: 1.15rem;
          margin-bottom: 0.9rem;
          box-shadow: var(--soft-shadow);
        }

        .quick-blue{
          background: linear-gradient(135deg, #dbeafe, #bfdbfe);
          color: #1d4ed8;
        }

        .quick-sky{
          background: linear-gradient(135deg, #cffafe, #bae6fd);
          color: #0369a1;
        }

        .quick-amber{
          background: linear-gradient(135deg, #fef3c7, #fde68a);
          color: #b45309;
        }

        .quick-green{
          background: linear-gradient(135deg, #d1fae5, #99f6e4);
          color: #047857;
        }

        .quick-purple{
          background: linear-gradient(135deg, #ede9fe, #ddd6fe);
          color: #6d28d9;
        }

        .quick-indigo{
          background: linear-gradient(135deg, #dbeafe, #ddd6fe);
          color: #4f46e5;
        }

        .metric-icon{
          width: 50px;
          height: 50px;
          border-radius: 16px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size: 1.2rem;
          flex: 0 0 auto;
        }

        @media (max-width: 575.98px){
          .hero-actions,
          .hero-actions > div{
            width: 100%;
          }
          .hero-actions .form-control,
          .hero-actions .btn{
            width: 100%;
          }
          .quick-card-body{
            min-height: auto;
          }
        }
      `}</style>
    </div>
  );
}

/* ----------------------------- Small Components ----------------------------- */

function QuickActionCard({
  accent = "blue",
  icon = "bi-grid",
  eyebrow,
  title,
  description,
  badges = [],
  error,
  buttonText = "Open",
  buttonClass = "btn-primary",
  onClick,
  secondaryText,
  secondaryTitle,
  secondaryDisabled = false,
  onSecondaryClick,
  featured = false,
}) {
  const bgMap = {
    blue: "linear-gradient(135deg, #ffffff, #eef2ff)",
    sky: "linear-gradient(135deg, #ecfeff, #f0f9ff)",
    indigo: "linear-gradient(135deg, #eff6ff, #f5f3ff)",
    amber: "linear-gradient(135deg, #fff7ed, #fffbeb)",
    green: "linear-gradient(135deg, #ecfeff, #f0fdfa)",
    purple: "linear-gradient(135deg, #f5f3ff, #eef2ff)",
  };

  const borderMap = {
    blue: "#dbe4ff",
    sky: "#bae6fd",
    indigo: "#bfdbfe",
    amber: "#fde68a",
    green: "#99f6e4",
    purple: "#c4b5fd",
  };

  return (
    <div className="col-12 col-md-6 col-xl-4">
      <div
        className={`card border-0 shadow-sm rounded-4 h-100 overflow-hidden quick-action-card ${
          featured ? "featured-card" : ""
        }`}
        style={{
          background: bgMap[accent] || bgMap.blue,
          border: `1px solid ${borderMap[accent] || borderMap.blue}`,
        }}
      >
        <div className="card-body quick-card-body">
          {featured && (
            <span className="badge rounded-pill bg-info-subtle text-info border featured-ribbon">
              New
            </span>
          )}

          <div className={`quick-icon quick-${accent}`}>
            <i className={`bi ${icon}`} />
          </div>

          <div className="text-uppercase small text-muted mb-1">{eyebrow}</div>
          <div className="fw-semibold fs-5 lh-sm">{title}</div>

          <div className="text-muted small mt-2 flex-grow-1">{description}</div>

          {!!badges.length && (
            <div className="d-flex gap-2 flex-wrap mt-3">
              {badges.map((badge) => (
                <span key={badge} className="badge bg-light text-dark border">
                  {badge}
                </span>
              ))}
            </div>
          )}

          {error && <div className="text-danger small mt-2">{error}</div>}

          <div className="d-flex gap-2 mt-3">
            <button className={`btn ${buttonClass} w-100`} onClick={onClick} type="button">
              {buttonText}
            </button>

            {secondaryText && (
              <button
                className="btn btn-outline-secondary"
                onClick={onSecondaryClick}
                disabled={secondaryDisabled}
                title={secondaryTitle}
                type="button"
              >
                {secondaryText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, variant = "secondary", icon = "bi-grid" }) {
  const theme =
    {
      secondary: {
        wrap: "bg-secondary bg-opacity-10",
        icon: "bg-secondary-subtle text-secondary",
      },
      success: {
        wrap: "bg-success bg-opacity-10",
        icon: "bg-success-subtle text-success",
      },
      danger: {
        wrap: "bg-danger bg-opacity-10",
        icon: "bg-danger-subtle text-danger",
      },
      warning: {
        wrap: "bg-warning bg-opacity-10",
        icon: "bg-warning-subtle text-warning",
      },
    }[variant] || {
      wrap: "bg-light",
      icon: "bg-light text-dark",
    };

  return (
    <div className="col-12 col-md-6">
      <div className={`card border-0 shadow-sm rounded-4 h-100 metric-card ${theme.wrap}`}>
        <div className="card-body d-flex align-items-center">
          <div className={`metric-icon ${theme.icon}`}>
            <i className={`bi ${icon}`} />
          </div>
          <div className="ms-3">
            <div className="text-uppercase small text-muted mb-1">{title}</div>
            <div className="display-6 fw-semibold mb-1">{value}</div>
            <div className="small text-muted">{sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressStat({ label, value, percent, barClass }) {
  return (
    <div className="mb-3">
      <div className="mb-2 d-flex justify-content-between small">
        <span>{label}</span>
        <span className="fw-semibold">
          {value} <span className="text-muted">({percent}%)</span>
        </span>
      </div>
      <div className="progress" style={{ height: 9 }}>
        <div
          className={`progress-bar ${barClass}`}
          style={{ width: `${percent}%` }}
          aria-label={label}
        />
      </div>
    </div>
  );
}

function EmptyState({ icon = "bi-inbox", title, message }) {
  return (
    <div className="card border-0 shadow-sm rounded-4 mb-4">
      <div className="card-body text-center py-5">
        <i className={`bi ${icon} display-5 text-primary d-block mb-3`} />
        <h5 className="fw-semibold mb-1">{title}</h5>
        <div className="text-muted">{message}</div>
      </div>
    </div>
  );
}