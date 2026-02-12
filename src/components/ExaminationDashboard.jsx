import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";

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
    isExamination: roles.includes("examination"),
  };
};

const fmtTime = (ts) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(ts);

export default function ExaminationDashboard() {
  const { isAdmin, isSuperadmin, isAcademicCoordinator, isPrincipal, isExamination } = useMemo(
    getRoleFlags,
    []
  );

  // Who can see this dashboard?
  const canSeeExamDashboard =
    isAdmin || isSuperadmin || isAcademicCoordinator || isPrincipal || isExamination;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // Stats (best effort)
  const [stats, setStats] = useState({
    totalExams: null,
    lockedExams: null,
    totalSchemes: null,
    totalFormats: null,
    pendingMarks: null,
  });

  // Upcoming exams (optional)
  const [upcoming, setUpcoming] = useState([]);

  const hardRefresh = () => setRefreshKey((k) => k + 1);

  const safeCount = (arr) => (Array.isArray(arr) ? arr.length : null);

  const fetchAll = useCallback(async () => {
    if (!canSeeExamDashboard) return;

    setLoading(true);
    setError(null);

    try {
      // 1) Exams
      const examsRes = await api.get("/exams").catch(() => null);
      const exams = examsRes?.data?.exams || examsRes?.data || [];
      const totalExams = safeCount(exams);

      // Locked count (tries common fields: is_locked / locked / status === 'LOCKED')
      let lockedExams = null;
      if (Array.isArray(exams)) {
        lockedExams = exams.filter((e) => {
          const v =
            e?.is_locked ??
            e?.locked ??
            (typeof e?.status === "string" && e.status.toUpperCase() === "LOCKED");
          return Boolean(v);
        }).length;
      }

      // 2) Exam schemes / structure (optional)
      // If you have something like /exam-schemes or /exam-schemes/list
      const schemesRes = await api.get("/exam-schemes").catch(() => null);
      const schemes = schemesRes?.data?.schemes || schemesRes?.data || [];
      const totalSchemes = safeCount(schemes);

      // 3) Report card formats
      const formatsRes = await api.get("/report-card-formats").catch(() => null);
      const formats = formatsRes?.data?.formats || formatsRes?.data || [];
      const totalFormats = safeCount(formats);

      // 4) Pending marks (optional endpoint)
      // If you later implement: GET /marks/pending-summary => { pending: 123 }
      const pendingRes = await api.get("/marks/pending-summary").catch(() => null);
      const pendingMarks =
        pendingRes?.data?.pending ?? pendingRes?.data?.count ?? pendingRes?.data ?? null;

      // 5) Upcoming exams (optional; if your exams have dates)
      let upcomingList = [];
      if (Array.isArray(exams)) {
        const today = new Date();
        upcomingList = exams
          .map((e) => {
            const dt = e?.date || e?.exam_date || e?.start_date || null;
            const d = dt ? new Date(dt) : null;
            return { ...e, _dateObj: d };
          })
          .filter((e) => e._dateObj && e._dateObj >= today)
          .sort((a, b) => a._dateObj - b._dateObj)
          .slice(0, 6);
      }

      setStats({
        totalExams,
        lockedExams,
        totalSchemes,
        totalFormats,
        pendingMarks,
      });

      setUpcoming(upcomingList);
      setLastRefreshed(Date.now());
    } catch (e) {
      console.error("Examination dashboard fetch error:", e);
      setError(e?.response?.data?.message || e?.message || "Failed to load examination dashboard");
    } finally {
      setLoading(false);
    }
  }, [canSeeExamDashboard]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll, refreshKey]);

  const open = (path) => {
    window.location.href = path;
  };

  if (!canSeeExamDashboard) {
    return (
      <div className="container-fluid px-3 py-2">
        <div className="alert alert-warning rounded-4">
          You don’t have access to the Examination Dashboard.
        </div>
      </div>
    );
  }

  const cards = [
    { title: "Total Exams", value: stats.totalExams, sub: "All created exams", variant: "primary" },
    { title: "Locked Exams", value: stats.lockedExams, sub: "Locked / frozen", variant: "dark" },
    { title: "Exam Schemes", value: stats.totalSchemes, sub: "Class → Exam → Subjects", variant: "secondary" },
    { title: "Report Card Formats", value: stats.totalFormats, sub: "Templates", variant: "success" },
    { title: "Pending Marks", value: stats.pendingMarks, sub: "Best-effort (optional)", variant: "warning" },
  ];

  return (
    <div className="container-fluid px-3 py-2">
      {/* Header */}
      <div
        className="d-flex flex-wrap align-items-center justify-content-between mb-3 rounded-4 p-3 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div>
          <h4 className="mb-1 fw-semibold">Examination Dashboard</h4>
          <div className="text-muted small">Last updated at {fmtTime(lastRefreshed)}</div>
        </div>

        <div className="d-flex gap-2 align-items-end flex-wrap">
          <button className="btn btn-outline-dark" type="button" onClick={hardRefresh} title="Refresh">
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <div className="text-uppercase small text-muted mb-1">Quick Actions</div>
              <div className="fw-semibold" style={{ fontSize: 18 }}>
                Examination Modules
              </div>

              <div className="d-flex gap-2 flex-wrap mt-3">
                <button className="btn btn-primary" onClick={() => open("/exams")}>
                  Manage Exams
                </button>

                <button className="btn btn-outline-primary" onClick={() => open("/exam-schemes")}>
                  Exam Schemes
                </button>

                <button className="btn btn-outline-primary" onClick={() => open("/report-card-formats")}>
                  Report Card Formats
                </button>

                <button className="btn btn-outline-secondary" onClick={() => open("/co-scholastic")}>
                  Co-Scholastic
                </button>
              </div>

              <div className="small text-muted mt-3">
                Tip: Lock exams after marks finalization to freeze results and prevent edits.
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body">
              <div className="text-uppercase small text-muted mb-1">Access</div>
              <div className="fw-semibold" style={{ fontSize: 18 }}>
                Roles enabled
              </div>

              <div className="d-flex gap-2 flex-wrap mt-3">
                {[
                  isExamination && "Examination",
                  isAcademicCoordinator && "Academic Coordinator",
                  isPrincipal && "Principal",
                  isAdmin && "Admin",
                  isSuperadmin && "Superadmin",
                ]
                  .filter(Boolean)
                  .map((r) => (
                    <span key={r} className="badge bg-light text-dark border">
                      {r}
                    </span>
                  ))}
              </div>

              <div className="small text-muted mt-3">
                Your RBAC now matches: Exams, Schemes, Co-Scholastic, Report Card formats.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading */}
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

      {/* Error */}
      {!loading && error && (
        <div className="alert alert-danger d-flex align-items-center" role="alert">
          <span className="me-2">⚠️</span>
          <div>{error}</div>
          <button className="btn btn-sm btn-light ms-auto" onClick={hardRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {!loading && !error && (
        <>
          <div className="row g-3 mb-4">
            {cards.map((m, i) => (
              <div className="col-md-6 col-lg-4" key={i}>
                <div
                  className={"card border-0 shadow-sm rounded-4 h-100 " + "bg-" + m.variant + " bg-opacity-10"}
                  style={{ transition: "transform .2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  <div className="card-body">
                    <div className="text-uppercase small text-muted mb-1">{m.title}</div>
                    <div className="display-6 fw-semibold">{m.value ?? "—"}</div>
                    <div className="mt-2 small text-muted">{m.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming Exams */}
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>Upcoming Exams</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => open("/exams")}>
                View All
              </button>
            </div>

            <div className="card-body">
              {!upcoming?.length ? (
                <div className="text-muted small">No upcoming exams found (or exam dates not stored).</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Exam</th>
                        <th>Status</th>
                        <th className="text-end">Lock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((e) => {
                        const dateStr = e?._dateObj
                          ? e._dateObj.toLocaleDateString()
                          : (e.date || e.exam_date || "-");
                        const locked =
                          e?.is_locked ??
                          e?.locked ??
                          (typeof e?.status === "string" && e.status.toUpperCase() === "LOCKED");

                        return (
                          <tr key={e.id || e.exam_id || `${e.name}-${dateStr}`}>
                            <td style={{ whiteSpace: "nowrap" }}>{dateStr}</td>
                            <td>{e.name || e.title || e.exam_name || "—"}</td>
                            <td>
                              <span className={"badge " + (locked ? "bg-dark" : "bg-success")}>
                                {locked ? "LOCKED" : "OPEN"}
                              </span>
                            </td>
                            <td className="text-end">
                              <span className="text-muted small">{locked ? "Frozen" : "Editable"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="small text-muted mt-3">
                Note: If you want “Pending Marks” accurate, add an endpoint like <code>/marks/pending-summary</code>.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
