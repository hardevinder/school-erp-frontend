// File: src/pages/ExaminationDashboard.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));

const fmtDate = (ts) =>
  new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(
    new Date(ts)
  );

const safeCount = (arr) => (Array.isArray(arr) ? arr.length : null);

const resolveArray = (res) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.exams)) return d.exams;
  if (Array.isArray(d?.schemes)) return d.schemes;
  if (Array.isArray(d?.formats)) return d.formats;
  return [];
};

const isLockedExam = (e) => {
  const v =
    e?.is_locked ??
    e?.locked ??
    (typeof e?.status === "string" && e.status.toUpperCase() === "LOCKED");
  return Boolean(v);
};

export default function ExaminationDashboard() {
  const navigate = useNavigate();

  const { isAdmin, isSuperadmin, isAcademicCoordinator, isPrincipal, isExamination } = useMemo(
    getRoleFlags,
    []
  );

  // Who can see this dashboard?
  const canSeeExamDashboard =
    isAdmin || isSuperadmin || isAcademicCoordinator || isPrincipal || isExamination;

  // ✅ Hooks must be BEFORE any return
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());

  // Stats kept only for logic (not shown as KPI cards)
  const [stats, setStats] = useState({
    totalExams: null,
    lockedExams: null,
    totalSchemes: null,
    totalFormats: null,
    pendingMarks: null,
  });

  // Upcoming exams (optional)
  const [upcoming, setUpcoming] = useState([]);

  // Search actions
  const [actionSearch, setActionSearch] = useState("");

  // ✅ moved here (no conditional hook)
  const initials = useMemo(() => {
    const name =
      localStorage.getItem("name") ||
      localStorage.getItem("username") ||
      localStorage.getItem("email") ||
      "Exam";
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    const a = (parts[0] || "E")[0] || "E";
    const b = (parts[1] || "")[0] || "";
    return (a + b).toUpperCase();
  }, []);

  const hardRefresh = () => setRefreshKey((k) => k + 1);

  // ✅ SPA navigation (NO reload)
  const open = useCallback(
    (path) => {
      if (!path) return;
      navigate(path);
    },
    [navigate]
  );

  const fetchAll = useCallback(async () => {
    if (!canSeeExamDashboard) return;

    setLoading(true);
    setError(null);

    try {
      // 1) Exams
      const examsRes = await api.get("/exams").catch(() => null);
      const exams = resolveArray(examsRes);
      const totalExams = safeCount(exams);

      // Locked count
      let lockedExams = null;
      if (Array.isArray(exams)) lockedExams = exams.filter(isLockedExam).length;

      // 2) Exam schemes (optional)
      const schemesRes = await api.get("/exam-schemes").catch(() => null);
      const schemes = resolveArray(schemesRes);
      const totalSchemes = safeCount(schemes);

      // 3) Report card formats (optional)
      const formatsRes = await api.get("/report-card-formats").catch(() => null);
      const formats = resolveArray(formatsRes);
      const totalFormats = safeCount(formats);

      // 4) Pending marks (optional)
      const pendingRes = await api.get("/marks/pending-summary").catch(() => null);
      const pendingMarks =
        pendingRes?.data?.pending ?? pendingRes?.data?.count ?? pendingRes?.data ?? null;

      // 5) Upcoming exams (best effort)
      let upcomingList = [];
      if (Array.isArray(exams)) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        upcomingList = exams
          .map((e) => {
            const dt = e?.date || e?.exam_date || e?.start_date || e?.examDate || null;
            const d = dt ? new Date(dt) : null;
            return { ...e, _dateObj: d && !isNaN(d.getTime()) ? d : null };
          })
          .filter((e) => e._dateObj && e._dateObj >= today)
          .sort((a, b) => a._dateObj - b._dateObj)
          .slice(0, 8);
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

  // ✅ Early return AFTER hooks ✅
  if (!canSeeExamDashboard) {
    return (
      <div className="container-fluid px-3 py-2">
        <div className="alert alert-warning rounded-4">
          You don’t have access to the Examination Dashboard.
        </div>
      </div>
    );
  }

  // ---- UI: Tiles (Entries vs Manage) ---------------------------------------
  const entryTiles = [
    {
      title: "Marks Entry",
      sub: "Enter / update marks",
      icon: "bi-pencil-square",
      badge: "ENTRY",
      onClick: () => open("/marks-entry"),
      color: "var(--qa-lime)",
    },
    {
      title: "Co-Scholastic Entry",
      sub: "Enter co-scholastic grades",
      icon: "bi-puzzle",
      badge: "ENTRY",
      onClick: () => open("/co-scholastic-entry"),
      color: "var(--qa-green)",
    },
    {
      title: "Remarks Entry",
      sub: "Student remarks / comments",
      icon: "bi-chat-left-text",
      badge: "ENTRY",
      onClick: () => open("/student-remarks-entry"),
      color: "var(--qa-amber)",
    },
    {
      title: "Report Card Generator",
      sub: "Generate report cards (PDF)",
      icon: "bi-printer",
      badge: "ENTRY",
      onClick: () => open("/report-card-generator"),
      color: "var(--qa-slate)",
    },
  ];

  const manageTiles = [
    {
      title: "Manage Exams",
      sub: "Create, edit, lock exams",
      icon: "bi-journal-text",
      onClick: () => open("/exams"),
      color: "var(--qa-blue)",
    },
    {
      title: "Exam Schemes",
      sub: "Components + weightage",
      icon: "bi-diagram-3",
      onClick: () => open("/exam-schemes"),
      color: "var(--qa-purple)",
    },
    {
      title: "Report Card Formats",
      sub: "Design templates",
      icon: "bi-layout-text-window-reverse",
      onClick: () => open("/report-card-formats"),
      color: "var(--qa-indigo)",
    },
    {
      title: "Co-Scholastic Setup",
      sub: "Areas + grading setup",
      icon: "bi-palette",
      onClick: () => open("/co-scholastic"),
      color: "var(--qa-teal)",
    },
  ];

  const q = (actionSearch || "").trim().toLowerCase();
  const filterTiles = (arr) =>
    !q ? arr : arr.filter((t) => (t.title || "").toLowerCase().includes(q));

  const filteredManage = filterTiles(manageTiles);
  const filteredEntry = filterTiles(entryTiles);

  const SectionHeader = ({ title, sub, right }) => (
    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
      <div>
        <div className="fw-semibold" style={{ fontSize: 16 }}>
          {title}
        </div>
        {sub ? <div className="text-muted small">{sub}</div> : null}
      </div>
      {right ? <div className="d-flex gap-2 flex-wrap">{right}</div> : null}
    </div>
  );

  const Tile = (a) => (
    <button
      key={a.title}
      type="button"
      className="qa-tile"
      onClick={a.onClick}
      style={{ background: a.color }}
      title={a.sub}
    >
      <div className="qa-icon">
        <i className={`bi ${a.icon}`} />
      </div>
      {a.badge ? <span className="qa-badge">{a.badge}</span> : null}
      <div className="qa-label">{a.title}</div>
      <div className="qa-sub">{a.sub}</div>
    </button>
  );

  return (
    <div className="container-fluid px-3 py-2 exam-dash">
      {/* Header (TeacherDashboard feel) */}
      <div className="dash-hero mb-3 rounded-4 shadow-sm">
        <div className="dash-hero-inner p-3 p-md-4">
          <div className="d-flex align-items-start gap-3">
            <div className="avatar-soft" aria-hidden="true">
              <span>{initials}</span>
            </div>

            <div className="flex-grow-1">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <h5 className="mb-0 text-white">
                  Examination <span className="fw-semibold">Dashboard</span>
                </h5>
                <span className="badge bg-light text-dark border">
                  Updated {fmtDate(lastRefreshed)} • {fmtTime(lastRefreshed)}
                </span>
              </div>

              <div className="text-white-50 small mt-1">
                Manage exams & setup first, then do daily entries.
              </div>

              {/* Search */}
              <div className="dash-search mt-3">
                <i className="bi bi-search" />
                <input
                  value={actionSearch}
                  onChange={(e) => setActionSearch(e.target.value)}
                  placeholder="Search actions… (exams, marks, formats, schemes)"
                  className="form-control form-control-sm"
                  aria-label="Search dashboard actions"
                />
              </div>
            </div>

            <div className="d-flex flex-column gap-2 align-items-end">
              <button className="btn btn-light btn-sm" type="button" onClick={hardRefresh}>
                ⟳ Refresh
              </button>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm"
                  onClick={() => open("/marks-entry")}
                >
                  <i className="bi bi-pencil-square me-1" />
                  Marks Entry
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => open("/report-card-generator")}
                >
                  <i className="bi bi-printer me-1" />
                  Report Cards
                </button>
              </div>
            </div>
          </div>

          {/* Small strip */}
          <div className="dash-strip mt-3">
            <button className="btn btn-dark btn-sm" onClick={() => open("/exams")}>
              <i className="bi bi-journal-text me-1" />
              Manage Exams
            </button>
            <button className="btn btn-outline-light btn-sm" onClick={() => open("/exam-schemes")}>
              <i className="bi bi-diagram-3 me-1" />
              Schemes
            </button>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => open("/report-card-formats")}
            >
              <i className="bi bi-layout-text-window-reverse me-1" />
              Formats
            </button>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={() => open("/co-scholastic-entry")}
            >
              <i className="bi bi-puzzle me-1" />
              Co-Scholastic Entry
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mb-4">
          <div className="placeholder-glow">
            <div className="row g-3">
              {[...Array(6)].map((_, i) => (
                <div className="col-md-6 col-lg-4" key={i}>
                  <div className="card border-0 shadow-sm rounded-4">
                    <div className="card-body">
                      <div className="placeholder col-7 mb-2"></div>
                      <div className="placeholder col-4" style={{ height: 34 }}></div>
                      <div className="placeholder col-9 mt-3"></div>
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
        <div className="alert alert-danger d-flex align-items-center rounded-4" role="alert">
          <span className="me-2">⚠️</span>
          <div>{error}</div>
          <button className="btn btn-sm btn-light ms-auto" onClick={hardRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <>
          {/* ✅ Manage FIRST */}
          <div className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
            <div className="card-body">
              <SectionHeader
                title="Manage"
                sub="Setup and configuration: exams, schemes, formats and grading"
                right={
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => open("/exams")}
                  >
                    View Exams
                  </button>
                }
              />
              {filteredManage.length === 0 ? (
                <div className="p-3 text-center text-muted">No manage actions match your search.</div>
              ) : (
                <div className="qa-grid">{filteredManage.map(Tile)}</div>
              )}
            </div>
          </div>

          {/* ✅ Entries SECOND */}
          <div className="card border-0 shadow-sm rounded-4 mb-3 overflow-hidden">
            <div className="card-body">
              <SectionHeader
                title="Quick Entries"
                sub="Daily work: marks, co-scholastic, remarks, report cards"
                right={
                  <>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => open("/marks-entry")}
                    >
                      Marks
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => open("/report-card-generator")}
                    >
                      Report Cards
                    </button>
                  </>
                }
              />
              {filteredEntry.length === 0 ? (
                <div className="p-3 text-center text-muted">No entry actions match your search.</div>
              ) : (
                <div className="qa-grid">{filteredEntry.map(Tile)}</div>
              )}
            </div>
          </div>

          {/* Upcoming Exams (kept) */}
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>Upcoming Exams</span>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => open("/exams")}>
                  View All
                </button>
                <button className="btn btn-sm btn-outline-dark" onClick={() => open("/marks-entry")}>
                  ✍️ Marks Entry
                </button>
              </div>
            </div>

            <div className="card-body">
              {!upcoming?.length ? (
                <div className="text-muted small">
                  No upcoming exams found (or exam dates are not stored).
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th style={{ width: 130 }}>Date</th>
                        <th>Exam</th>
                        <th style={{ width: 110 }}>Status</th>
                        <th className="text-end" style={{ width: 120 }}>
                          Lock
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((e) => {
                        const dateStr = e?._dateObj
                          ? e._dateObj.toLocaleDateString()
                          : e.date || e.exam_date || "-";
                        const locked = isLockedExam(e);

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
                Note: To make <b>Pending Marks</b> accurate, keep/implement{" "}
                <code>/marks/pending-summary</code>.
              </div>
            </div>
          </div>
        </>
      )}

      {/* Styles (TeacherDashboard-style tiles) */}
      <style>{`
        .exam-dash{
          --shadow-soft: 0 12px 30px rgba(0,0,0,.08);
        }

        .dash-hero{
          background: radial-gradient(1000px 420px at 10% 10%, rgba(255,255,255,.22), transparent 60%),
                      linear-gradient(135deg, #0f172a, #2563eb);
          border: 1px solid rgba(255,255,255,.14);
        }
        .dash-hero-inner{
          backdrop-filter: blur(8px);
        }

        .avatar-soft{
          width:52px;height:52px;border-radius:16px;
          background: rgba(255,255,255,.16);
          border: 1px solid rgba(255,255,255,.22);
          display:flex;align-items:center;justify-content:center;
          color:#fff;font-weight:800;
          box-shadow: 0 10px 26px rgba(0,0,0,.18);
          flex: 0 0 auto;
        }

        .dash-strip{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          align-items:center;
        }

        :root{
          --qa-blue: linear-gradient(135deg,#6ea8fe,#1f6feb);
          --qa-purple: linear-gradient(135deg,#c0b6f2,#845ef7);
          --qa-teal: linear-gradient(135deg,#63e6be,#12b886);
          --qa-green: linear-gradient(135deg,#8ce99a,#2f9e44);
          --qa-amber: linear-gradient(135deg,#ffe066,#fab005);
          --qa-indigo: linear-gradient(135deg,#91a7ff,#5c7cfa);
          --qa-lime: linear-gradient(135deg,#a9e34b,#74b816);
          --qa-slate: linear-gradient(135deg,#ced4da,#495057);
        }

        .dash-search{
          position:relative;
          width: min(420px, 92vw);
        }
        .dash-search i{
          position:absolute;
          left:10px;
          top:50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,.65);
          font-size: 14px;
          pointer-events:none;
          z-index: 2;
        }
        .dash-search input{
          padding-left: 28px;
          border-radius: 12px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.22);
          color: #fff;
        }
        .dash-search input::placeholder{ color: rgba(255,255,255,.70); }
        .dash-search input:focus{
          background: rgba(255,255,255,.14);
          border-color: rgba(255,255,255,.32);
          box-shadow: 0 0 0 .2rem rgba(13,110,253,.25);
          color: #fff;
        }

        .qa-grid{
          display:grid;
          grid-template-columns: repeat(2, 1fr);
          gap:12px;
          padding: 4px;
        }
        @media(min-width:480px){ .qa-grid{ grid-template-columns: repeat(3, 1fr);} }
        @media(min-width:992px){ .qa-grid{ grid-template-columns: repeat(4, 1fr);} }

        .qa-tile{
          position:relative;
          border:0;
          border-radius:16px;
          color:#fff;
          padding:16px 12px;
          text-align:left;
          min-height:112px;
          box-shadow: var(--shadow-soft);
          transition: transform .16s ease, box-shadow .16s ease, filter .16s ease;
          display:flex;
          flex-direction:column;
          justify-content:flex-end;
          cursor:pointer;
          outline:none;
          overflow:hidden;
          width: 100%;
        }
        .qa-tile::before{
          content:'';
          position:absolute;
          inset:-40px -40px auto auto;
          width:140px;height:140px;
          background: rgba(255,255,255,.18);
          border-radius: 44px;
          transform: rotate(25deg);
        }
        .qa-tile:hover{ box-shadow: 0 16px 40px rgba(0,0,0,.18); transform: translateY(-1px); }
        .qa-tile:active{ transform:scale(.98); filter:brightness(.95); }

        .qa-icon{
          position:absolute; top:10px; right:10px;
          background: rgba(255,255,255,.18);
          width:40px; height:40px; border-radius:12px;
          display:flex; align-items:center; justify-content:center;
          font-size:18px;
          z-index: 1;
        }

        .qa-label{
          font-weight:800;
          font-size:14px;
          line-height:1.2;
          position: relative;
          z-index: 1;
        }
        .qa-sub{
          font-size:12px;
          opacity:.92;
          margin-top:6px;
          position: relative;
          z-index: 1;
        }

        .qa-badge{
          position:absolute;
          top:10px; left:10px;
          background: rgba(0,0,0,.28);
          border: 1px solid rgba(255,255,255,.22);
          color:#fff;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 999px;
          z-index: 2;
        }
      `}</style>
    </div>
  );
}