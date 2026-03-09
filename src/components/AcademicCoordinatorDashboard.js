// File: src/components/Dashboard.jsx
// ✅ Polished Academic Coordinator / Admin Dashboard
// ✅ Adds "Assign Syllabus Teacher" quick card
// ✅ Adds "Syllabus Approval" quick card
// ✅ Adds "Admission Syllabus Assignee" quick card
// ✅ Adds Academic Calendar quick card
// ✅ Keeps attendance dashboard logic intact

import React, { useEffect, useMemo, useState, useCallback } from "react";
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
    isAcademicCoordinator: roles.includes("academic_coordinator") || roles.includes("coordinator"),
    isPrincipal: roles.includes("principal"),
  };
};

export default function Dashboard() {
  const navigate = useNavigate();

  const { roles, isAdmin, isSuperadmin, isAcademicCoordinator, isPrincipal } = useMemo(
    getRoleFlags,
    []
  );

  const canSeeAcademicCards =
    isAdmin || isSuperadmin || isAcademicCoordinator || isPrincipal;

  const displayName =
    localStorage.getItem("name") ||
    localStorage.getItem("username") ||
    "User";

  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
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

  const goToday = () => setSelectedDate(new Date().toISOString().split("T")[0]);

  const shiftDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const hardRefresh = () => setRefreshKey((k) => k + 1);

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

  // Derived numbers
  const { total, absent, leaves, present } = useMemo(() => {
    let t = 0,
      a = 0,
      l = 0;

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
      const res = await api
        .get("/syllabus-breakdowns/pending")
        .catch(() => ({ data: null }));

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

  // ---- navigation helpers ---------------------------------------------------
  const openAcademicCalendar = () => navigate("/academic-calendar");
  const openSyllabusTeacherAssignment = () => navigate("/syllabus-teacher-assignment");
  const openTeacherAssignment = () => navigate("/teacher-assignment");
  const openSyllabusApproval = () => navigate("/syllabus-approval");
  const openAdmissionSyllabusAssignee = () => navigate("/admission-syllabus-assignee");

  const initials = useMemo(() => {
    const parts = String(displayName || "User")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = (parts[0] || "U")[0] || "U";
    const b = (parts[1] || "")[0] || "";
    return (a + b).toUpperCase();
  }, [displayName]);

  const CardShell = ({ style, children }) => (
    <div
      className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden"
      style={{
        transition: "transform .18s ease, box-shadow .18s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 18px 34px rgba(0,0,0,0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      {children}
    </div>
  );

  return (
    <div className="container-fluid px-3 py-3 dashboard-pro">
      {/* HERO HEADER */}
      <div className="hero-pro mb-4">
        <div className="hero-overlay p-3 p-md-4 rounded-4 shadow-sm">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
            <div className="d-flex align-items-start gap-3">
              <div className="hero-avatar">{initials}</div>

              <div>
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <h4 className="mb-0 text-white fw-semibold">
                    Welcome back, {displayName}
                  </h4>
                  <span className="badge bg-light text-dark border">
                    {selectedDate}
                  </span>
                  <span className="badge bg-light text-dark border">
                    Updated: {formatTime(lastRefreshed)}
                  </span>
                </div>

                <div className="text-white-50 small mt-1">
                  Academic operations dashboard with attendance overview, approvals,
                  syllabus tools, and coordinator quick access.
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

            <div className="d-flex gap-2 align-items-end flex-wrap">
              <div>
                <label htmlFor="summaryDate" className="form-label mb-1 small text-white-50">
                  Date
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
      </div>

      {/* QUICK ACTIONS */}
      {canSeeAcademicCards && (
        <div className="row g-3 mb-4">
          {/* Academic Calendar */}
          <div className="col-12 col-md-6 col-xl-3">
            <CardShell
              style={{
                background: "linear-gradient(135deg, #ffffff, #eef2ff)",
                border: "1px solid #dbe4ff",
              }}
            >
              <div className="card-body quick-card-body">
                <div className="quick-icon quick-blue">
                  <i className="bi bi-calendar3" />
                </div>

                <div className="text-uppercase small text-muted mb-1">Academic Calendar</div>
                <div className="fw-semibold fs-5">
                  {loadingCalendar ? "Loading..." : calMini?.title || "Academic Calendar"}
                </div>

                <div className="text-muted small mt-1">
                  {loadingCalendar ? (
                    "Fetching latest published calendar…"
                  ) : calMini ? (
                    <>
                      Session: <strong>{calMini.academic_session || "-"}</strong> •{" "}
                      <span
                        className={
                          "badge " +
                          (calMini.status === "PUBLISHED"
                            ? "bg-success"
                            : calMini.status === "DRAFT"
                            ? "bg-secondary"
                            : "bg-dark")
                        }
                      >
                        {calMini.status}
                      </span>
                    </>
                  ) : calErr ? (
                    <span className="text-danger">{calErr}</span>
                  ) : (
                    "No calendar found yet."
                  )}
                </div>

                {calMini && (
                  <div className="d-flex gap-2 flex-wrap mt-2">
                    <span className="badge bg-light text-dark border">
                      Working: {calMini.working_days}
                    </span>
                    <span className="badge bg-light text-dark border">
                      Holidays: {calMini.holidays}
                    </span>
                    <span className="badge bg-light text-dark border">
                      Vacations: {calMini.vacations}
                    </span>
                  </div>
                )}

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-primary w-100" onClick={openAcademicCalendar}>
                    Open
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={fetchCalendarMini}
                    disabled={loadingCalendar}
                    title="Reload"
                  >
                    {loadingCalendar ? "…" : "⟳"}
                  </button>
                </div>
              </div>
            </CardShell>
          </div>

          {/* Assign Syllabus Teacher */}
          <div className="col-12 col-md-6 col-xl-3">
            <CardShell
              style={{
                background: "linear-gradient(135deg, #fff7ed, #fffbeb)",
                border: "1px solid #fde68a",
              }}
            >
              <div className="card-body quick-card-body">
                <div className="quick-icon quick-amber">
                  <i className="bi bi-diagram-3" />
                </div>

                <div className="text-uppercase small text-muted mb-1">Syllabus Module</div>
                <div className="fw-semibold fs-5">Assign Syllabus Teacher</div>

                <div className="text-muted small mt-1">
                  Assign <strong>Class + Subject</strong> to teacher for syllabus work.
                </div>

                <div className="d-flex gap-2 flex-wrap mt-2">
                  <span className="badge bg-light text-dark border">
                    One teacher per Class+Subject
                  </span>
                  <span className="badge bg-light text-dark border">
                    Replace allowed
                  </span>
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-warning w-100" onClick={openSyllabusTeacherAssignment}>
                    Open
                  </button>
                  <button className="btn btn-outline-secondary" onClick={openTeacherAssignment}>
                    Map
                  </button>
                </div>
              </div>
            </CardShell>
          </div>

          {/* Syllabus Approval */}
          <div className="col-12 col-md-6 col-xl-3">
            <CardShell
              style={{
                background: "linear-gradient(135deg, #ecfeff, #f0fdfa)",
                border: "1px solid #99f6e4",
              }}
            >
              <div className="card-body quick-card-body">
                <div className="quick-icon quick-green">
                  <i className="bi bi-check2-square" />
                </div>

                <div className="text-uppercase small text-muted mb-1">Syllabus Workflow</div>
                <div className="fw-semibold fs-5">Syllabus Approvals</div>

                <div className="text-muted small mt-1">
                  Review submissions and <strong>Approve / Return</strong> with remarks.
                </div>

                <div className="d-flex gap-2 flex-wrap mt-2">
                  <span className="badge bg-light text-dark border">
                    Pending:{" "}
                    {loadingSyllPending ? "…" : syllPendingCount != null ? syllPendingCount : "—"}
                  </span>
                  <span className="badge bg-light text-dark border">PDF Preview</span>
                </div>

                {syllPendingErr && (
                  <div className="text-danger small mt-2">{syllPendingErr}</div>
                )}

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-success w-100" onClick={openSyllabusApproval}>
                    Open
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={fetchSyllabusPendingMini}
                    disabled={loadingSyllPending}
                    title="Reload"
                  >
                    {loadingSyllPending ? "…" : "⟳"}
                  </button>
                </div>
              </div>
            </CardShell>
          </div>

          {/* Admission Syllabus Assignee */}
          <div className="col-12 col-md-6 col-xl-3">
            <CardShell
              style={{
                background: "linear-gradient(135deg, #f5f3ff, #eef2ff)",
                border: "1px solid #c4b5fd",
              }}
            >
              <div className="card-body quick-card-body">
                <div className="quick-icon quick-purple">
                  <i className="bi bi-person-check" />
                </div>

                <div className="text-uppercase small text-muted mb-1">Admission Workflow</div>
                <div className="fw-semibold fs-5">Admission Syllabus Assignee</div>

                <div className="text-muted small mt-1">
                  Assign <strong>Applying Class + Subject</strong> to user for admission syllabus work.
                </div>

                <div className="d-flex gap-2 flex-wrap mt-2">
                  <span className="badge bg-light text-dark border">Admission Class Based</span>
                  <span className="badge bg-light text-dark border">Status + Remarks</span>
                </div>

                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-primary w-100" onClick={openAdmissionSyllabusAssignee}>
                    Open
                  </button>
                </div>
              </div>
            </CardShell>
          </div>
        </div>
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
                      <div className="placeholder col-6 mb-2"></div>
                      <div className="placeholder col-4" style={{ height: 32 }}></div>
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
        <div className="alert alert-info rounded-4">
          No summary available for {selectedDate}.
        </div>
      )}

      {!loading && !error && attendanceSummary && (
        <>
          {/* KPI + Chart */}
          <div className="row g-3 mb-4">
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
              <div className="card shadow-sm rounded-4 flex-fill border-0">
                <div className="card-header bg-white border-0 fw-semibold rounded-top-4">
                  Overall Attendance — {attendanceSummary.date}
                </div>
                <div className="card-body" style={{ height: 340 }}>
                  <Pie data={pieData} options={pieOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown header */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div>
              <h5 className="mb-0 fw-semibold">Class & Section Breakdown</h5>
              <div className="text-muted small">
                Detailed attendance progress for each class-section
              </div>
            </div>
            <span className="badge bg-light text-dark border px-3 py-2">
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
                <div className="col-12 col-md-6 col-xl-4" key={`${item.class_id}-${item.section_id}`}>
                  <div className="card h-100 shadow-sm rounded-4 border-0 breakdown-card">
                    <div className="card-header bg-white border-0 rounded-top-4">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="fw-semibold fs-6">
                            Class {item.class_name} — Section {item.section_name}
                          </div>
                          <div className="small text-muted">Total Students: {item.total}</div>
                        </div>

                        <span className="badge bg-primary-subtle text-primary border">
                          {pPres}% Present
                        </span>
                      </div>
                    </div>

                    <div className="card-body pt-2">
                      <ProgressStat label="Present" value={pres} percent={pPres} barClass="bg-success" />
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
        </>
      )}

      <style>{`
        .dashboard-pro{
          --soft-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
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

        .quick-card-body{
          position: relative;
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

        .metric-card{
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .metric-card:hover{
          transform: translateY(-2px);
          box-shadow: 0 16px 28px rgba(0,0,0,0.08);
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

        .breakdown-card{
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .breakdown-card:hover{
          transform: translateY(-2px);
          box-shadow: 0 16px 28px rgba(0,0,0,0.08);
        }
      `}</style>
    </div>
  );
}

/* ----------------------------- Small Components ----------------------------- */

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