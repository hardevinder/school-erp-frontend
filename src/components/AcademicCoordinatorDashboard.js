// src/components/Dashboard.jsx — polished & more attractive (FULL FILE)
// ✅ Adds "Assign Syllabus Teacher" quick card for coordinators
// ✅ Adds "Syllabus Approval" quick card (NEW)
// ✅ Adds Academic Calendar quick card (already there) + extra Academic tools card
// ✅ Keeps attendance dashboard logic intact

import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";

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
  const { isAdmin, isSuperadmin, isAcademicCoordinator, isPrincipal } = useMemo(getRoleFlags, []);
  const canSeeAcademicCards = isAdmin || isSuperadmin || isAcademicCoordinator || isPrincipal;

  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // ✅ reliable retry/refresh
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ Academic calendar mini summary card (optional)
  const [calMini, setCalMini] = useState(null);
  const [calErr, setCalErr] = useState(null);

  // ✅ NEW: Syllabus approvals mini count (optional)
  const [syllPendingCount, setSyllPendingCount] = useState(null);
  const [syllPendingErr, setSyllPendingErr] = useState(null);
  const [loadingSyllPending, setLoadingSyllPending] = useState(false);

  const formatTime = (ts) =>
    new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(ts);

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
        if (mounted) setError(err?.response?.data?.message || err.message || "Failed to load");
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
    return { total: t, absent: a, leaves: l, present: Math.max(t - a - l, 0) };
  }, [attendanceSummary]);

  const pieData = useMemo(
    () => ({
      labels: ["Present", "Absent", "Leaves"],
      datasets: [
        {
          data: [present, absent, leaves],
          backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
          borderWidth: 0,
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
        legend: { position: "bottom", labels: { usePointStyle: true } },
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
      cutout: "55%",
    }),
    [total]
  );

  // ✅ Mini Academic Calendar info (best effort; won’t break dashboard if API differs)
  const fetchCalendarMini = useCallback(async () => {
    if (!canSeeAcademicCards) return;

    setLoadingCalendar(true);
    setCalErr(null);
    try {
      const res = await api.get("/academic-calendars/summary-by-month").catch(() => ({ data: null }));

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

  // ✅ NEW: Syllabus pending count (best effort)
  const fetchSyllabusPendingMini = useCallback(async () => {
    if (!canSeeAcademicCards) return;

    setLoadingSyllPending(true);
    setSyllPendingErr(null);
    try {
      // expects GET /syllabus-breakdowns/pending
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

  // ---- quick navigation helpers --------------------------------------------
  const openAcademicCalendar = () => {
    window.location.href = "/academic-calendar";
  };

  const openSyllabusTeacherAssignment = () => {
    window.location.href = "/syllabus-teacher-assignment";
  };

  const openTeacherAssignment = () => {
    window.location.href = "/teacher-assignment";
  };

  // ✅ NEW route opener
  const openSyllabusApproval = () => {
    window.location.href = "/syllabus-approval";
  };

  const CardShell = ({ style, children }) => (
    <div
      className="card border-0 shadow-sm rounded-4 h-100"
      style={{
        transition: "transform .18s ease, box-shadow .18s ease",
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.10)";
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
    <div className="container-fluid px-3 py-2">
      {/* HERO HEADER */}
      <div
        className="mb-3 rounded-4 p-3 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #eef2ff, #f8fafc, #ecfeff)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h4 className="mb-0 fw-semibold">Attendance Dashboard</h4>
              <span className="badge bg-light text-dark border">Date: {selectedDate}</span>
              <span className="badge bg-light text-dark border">Updated: {formatTime(lastRefreshed)}</span>
            </div>
            <div className="text-muted small mt-1">Quick view of daily attendance + section-wise breakdown.</div>
          </div>

          <div className="d-flex gap-2 align-items-end flex-wrap">
            <div>
              <label htmlFor="summaryDate" className="form-label mb-1 small text-muted">
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

            <div className="d-flex gap-2 pb-1">
              <button className="btn btn-outline-secondary" type="button" onClick={() => shiftDay(-1)} title="Previous day">
                ◀
              </button>
              <button className="btn btn-outline-primary" type="button" onClick={goToday}>
                Today
              </button>
              <button className="btn btn-outline-secondary" type="button" onClick={() => shiftDay(1)} title="Next day">
                ▶
              </button>
              <button className="btn btn-outline-dark" type="button" onClick={hardRefresh} title="Refresh">
                ⟳ Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ QUICK ACTIONS */}
      {canSeeAcademicCards && (
        <div className="row g-3 mb-3">
          {/* Academic Calendar */}
          <div className="col-lg-4">
            <CardShell
              style={{
                background: "linear-gradient(135deg, #ffffff, #f1f5ff)",
                border: "1px solid #e5e7ff",
              }}
            >
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <div className="text-uppercase small text-muted mb-1">Academic Calendar</div>
                    <div className="fw-semibold" style={{ fontSize: 18 }}>
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
                        <span className="badge bg-light text-dark border">Working: {calMini.working_days}</span>
                        <span className="badge bg-light text-dark border">Holidays: {calMini.holidays}</span>
                        <span className="badge bg-light text-dark border">Vacations: {calMini.vacations}</span>
                      </div>
                    )}
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <button className="btn btn-primary" type="button" onClick={openAcademicCalendar}>
                      Open
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={fetchCalendarMini}
                      disabled={loadingCalendar}
                    >
                      {loadingCalendar ? "…" : "Reload"}
                    </button>
                  </div>
                </div>

                <div className="small text-muted mt-3">Tip: Coordinators can create events and export PDF.</div>
              </div>
            </CardShell>
          </div>

          {/* ✅ Syllabus Teacher Assignment */}
          <div className="col-lg-4">
            <CardShell
              style={{
                background: "linear-gradient(135deg, #fff7ed, #fffbeb)",
                border: "1px solid #fde68a",
              }}
            >
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <div className="text-uppercase small text-muted mb-1">Syllabus Module</div>
                    <div className="fw-semibold" style={{ fontSize: 18 }}>
                      Assign Syllabus Teacher
                    </div>
                    <div className="text-muted small mt-1">
                      Assign <strong>Class + Subject</strong> to a teacher for syllabus creation.
                    </div>

                    <div className="d-flex gap-2 flex-wrap mt-2">
                      <span className="badge bg-light text-dark border">One teacher per Class+Subject</span>
                      <span className="badge bg-light text-dark border">Replace allowed</span>
                    </div>
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <button className="btn btn-warning" type="button" onClick={openSyllabusTeacherAssignment}>
                      Open
                    </button>
                    <button className="btn btn-outline-secondary" type="button" onClick={openTeacherAssignment}>
                      Teacher Map
                    </button>
                  </div>
                </div>

                <div className="small text-muted mt-3">Next: syllabus breakdown → lesson plans → progress tracking.</div>
              </div>
            </CardShell>
          </div>

          {/* ✅ NEW: Syllabus Approval */}
          <div className="col-lg-4">
            <CardShell
              style={{
                background: "linear-gradient(135deg, #ecfeff, #f0fdfa)",
                border: "1px solid #a7f3d0",
              }}
            >
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <div className="text-uppercase small text-muted mb-1">Syllabus Workflow</div>
                    <div className="fw-semibold" style={{ fontSize: 18 }}>
                      Syllabus Approvals
                    </div>
                    <div className="text-muted small mt-1">
                      Review teacher submissions and <strong>Approve / Return</strong> with reason.
                    </div>

                    <div className="d-flex gap-2 flex-wrap mt-2">
                      <span className="badge bg-light text-dark border">
                        Pending:{" "}
                        {loadingSyllPending ? "…" : syllPendingCount != null ? syllPendingCount : "—"}
                      </span>
                      <span className="badge bg-light text-dark border">PDF Preview</span>
                      <span className="badge bg-light text-dark border">Publish option</span>
                    </div>

                    {syllPendingErr && (
                      <div className="text-danger small mt-2">{syllPendingErr}</div>
                    )}
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <button className="btn btn-success" type="button" onClick={openSyllabusApproval}>
                      Open
                    </button>
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={fetchSyllabusPendingMini}
                      disabled={loadingSyllPending}
                    >
                      {loadingSyllPending ? "…" : "Reload"}
                    </button>
                  </div>
                </div>

                <div className="small text-muted mt-3">
                  Tip: Return with clear reason so teacher can re-submit quickly.
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
        <div className="alert alert-danger d-flex align-items-center" role="alert">
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
        <div className="alert alert-info">No summary available for {selectedDate}.</div>
      )}

      {!loading && !error && attendanceSummary && (
        <>
          {/* KPIs + Chart */}
          <div className="row g-3 mb-4">
            <div className="col-lg-8">
              <div className="row g-3">
                {[
                  { title: "Total", value: total, sub: "All students", variant: "secondary" },
                  {
                    title: "Present",
                    value: present,
                    sub: `${total ? Math.round((present / total) * 100) : 0}% of total`,
                    variant: "success",
                  },
                  {
                    title: "Absent",
                    value: absent,
                    sub: `${total ? Math.round((absent / total) * 100) : 0}% of total`,
                    variant: "danger",
                  },
                  {
                    title: "Leaves",
                    value: leaves,
                    sub: `${total ? Math.round((leaves / total) * 100) : 0}% of total`,
                    variant: "warning",
                  },
                ].map((m, i) => (
                  <div className="col-md-6" key={i}>
                    <div
                      className={"card border-0 shadow-sm rounded-4 h-100 " + "bg-" + m.variant + " bg-opacity-10"}
                      style={{ transition: "transform .2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                    >
                      <div className="card-body">
                        <div className="text-uppercase small text-muted mb-1">{m.title}</div>
                        <div className="display-6 fw-semibold">{m.value}</div>
                        <div className="mt-2 small text-muted">{m.sub}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-lg-4 d-flex">
              <div className="card shadow-sm rounded-4 flex-fill">
                <div className="card-header bg-white border-0 fw-semibold">Overall — {attendanceSummary.date}</div>
                <div className="card-body" style={{ height: 320 }}>
                  <Pie data={pieData} options={pieOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="mb-0">Class & Section Breakdown</h6>
            <span className="text-muted small">{attendanceSummary.summary?.length || 0} sections</span>
          </div>

          <div className="row g-3">
            {attendanceSummary.summary.map((item) => {
              const pres = Number(item.total || 0) - (Number(item.absent || 0) + Number(item.leave || 0));
              const pPres = item.total ? Math.round((pres / item.total) * 100) : 0;
              const pAbs = item.total ? Math.round((item.absent / item.total) * 100) : 0;
              const pLev = item.total ? Math.round((item.leave / item.total) * 100) : 0;

              return (
                <div className="col-md-4" key={`${item.class_id}-${item.section_id}`}>
                  <div className="card h-100 shadow-sm rounded-4 border-0">
                    <div className="card-header bg-white border-0">
                      <div className="fw-semibold">
                        Class {item.class_name} — Section {item.section_name}
                      </div>
                      <div className="small text-muted">Total: {item.total}</div>
                    </div>

                    <div className="card-body pt-0">
                      <div className="mb-2 d-flex justify-content-between small">
                        <span>Present</span>
                        <span className="fw-semibold">{pres}</span>
                      </div>
                      <div className="progress mb-3" style={{ height: 8 }}>
                        <div className="progress-bar bg-success" style={{ width: `${pPres}%` }} aria-label="present"></div>
                      </div>

                      <div className="mb-2 d-flex justify-content-between small">
                        <span>Absent</span>
                        <span className="fw-semibold">{item.absent}</span>
                      </div>
                      <div className="progress mb-3" style={{ height: 8 }}>
                        <div className="progress-bar bg-danger" style={{ width: `${pAbs}%` }} aria-label="absent"></div>
                      </div>

                      <div className="mb-2 d-flex justify-content-between small">
                        <span>Leaves</span>
                        <span className="fw-semibold">{item.leave}</span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div className="progress-bar bg-warning" style={{ width: `${pLev}%` }} aria-label="leaves"></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}