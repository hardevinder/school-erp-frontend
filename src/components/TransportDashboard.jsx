// File: src/components/TransportDashboard.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

/* ---------------- Roles helper ---------------- */
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
    isAccounts: roles.includes("accounts"),
    isTransport: roles.includes("transport") || roles.includes("transport_admin"),
    isDriver: roles.includes("driver"),
    isConductor: roles.includes("conductor"),
  };
};

/* ---------------- Small utils ---------------- */
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  return (
    d.staff ||
    d.routes ||
    d.buses ||
    d.assignments ||
    d.students ||
    d.employees ||
    d.rows ||
    d.items ||
    d.results ||
    d.data ||
    []
  );
};

const safe = (v, fb = "—") => (v === null || v === undefined || v === "" ? fb : String(v));
const safeStr = (v) => String(v ?? "").trim();
const lower = (v) => safeStr(v).toLowerCase();

const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN");
};

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN");
};

// Session guess (FY-style, April-March)
const guessCurrentSession = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1..12
  const startYear = m >= 4 ? y : y - 1;
  const endYear2 = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYear2}`; // e.g. 2025-26
};

const parseSession = (s) => {
  const m = safeStr(s).match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  return { start: Number(m[1]), end2: Number(m[2]) };
};

const shiftSession = (s, delta) => {
  const p = parseSession(s);
  if (!p) return guessCurrentSession();
  const nextStart = p.start + delta;
  const endYear2 = String((nextStart + 1) % 100).padStart(2, "0");
  return `${nextStart}-${endYear2}`;
};

const uniqCount = (arr, keyGetter) => {
  const set = new Set();
  for (const x of arr || []) {
    const k = keyGetter(x);
    if (k !== null && k !== undefined && k !== "") set.add(String(k));
  }
  return set.size;
};

const todayYYYYMMDD = () => {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/* ---------------- UI helpers ---------------- */
const StatPill = ({ label, value, tone = "secondary", to }) => {
  const content = (
    <span
      className={`badge rounded-pill text-bg-${tone} bg-opacity-75`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        border: "1px solid rgba(0,0,0,.06)",
      }}
      title={label}
    >
      <span style={{ opacity: 0.9 }}>{label}</span>
      <span className="fw-semibold">{value}</span>
      <i className="bi bi-arrow-right-short" style={{ opacity: 0.9 }} />
    </span>
  );

  if (!to) return content;

  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
};

const Tile = ({ title, value, variant = "secondary", hint, to, onClick }) => {
  const body = (
    <div
      className={`card border-0 shadow-sm rounded-4 h-100 bg-${variant} bg-opacity-10`}
      style={{
        cursor: to || onClick ? "pointer" : "default",
        transition: "transform .12s ease, box-shadow .12s ease",
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="card-body">
        <div className="d-flex justify-content-between gap-2">
          <div className="text-uppercase small text-muted mb-1">{title}</div>
          {to ? (
            <span className="badge text-bg-light border" style={{ height: "fit-content" }}>
              Open <i className="bi bi-box-arrow-up-right ms-1" />
            </span>
          ) : null}
        </div>

        <div className="display-6 fw-semibold" style={{ lineHeight: 1.1 }}>
          {value}
        </div>

        <div className="small text-muted mt-1">{hint || "Live snapshot"}</div>

        {(to || onClick) ? (
          <div className="mt-3">
            <span className={`btn btn-sm btn-outline-${variant === "dark" ? "dark" : "secondary"}`}>
              View details
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
        {body}
      </Link>
    );
  }
  return body;
};

/* ---------------- Component ---------------- */
export default function TransportDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperadmin, isAccounts, isTransport, isDriver, isConductor } = useMemo(getRoleFlags, []);

  // who can use transport dashboard page
  const canUse = isTransport || isAdmin || isSuperadmin || isAccounts || isDriver || isConductor;

  // who can see report page
  const canSeeReport = isTransport || isAdmin || isSuperadmin || isAccounts;

  // who can see mobile marking page
  const canMarkMobile = isDriver || isConductor || isTransport || isAdmin || isSuperadmin;

  // Session (shared with Transportation page)
  const [session, setSession] = useState(() => {
    const saved = safeStr(localStorage.getItem("academic_session"));
    return saved || guessCurrentSession();
  });

  // State
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);

  // Staff counts
  const [staffCounts, setStaffCounts] = useState({
    total: 0,
    drivers: 0,
    conductors: 0,
    activeStaff: 0,
    inactiveStaff: 0,
    userDisabled: 0,
  });

  const [loading, setLoading] = useState({
    routes: false,
    buses: false,
    assignments: false,
    students: false,
    staff: false,
  });

  const [error, setError] = useState("");

  // auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timersRef = useRef({});

  const POLLING_INTERVAL = 25000; // 25s

  // API base paths (as per your mounts)
  const ROUTES_BASE = "/transportations";
  const BUSES_BASE = "/buses";
  const ASSIGN_BASE = "/student-transport-assignments";
  const STUDENTS_BASE = "/students";
  const STAFF_BASE = "/transport-staff";

  // centralized api config for session
  const sessionCfg = useMemo(
    () => ({
      params: { session },
      headers: { "x-session": session },
    }),
    [session]
  );

  /* ---------------- Fetchers ---------------- */
  const fetchRoutes = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, routes: true }));
    try {
      const res = await api.get(ROUTES_BASE, sessionCfg);
      const list = asArray(res.data);
      setRoutes(Array.isArray(list) ? list : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchRoutes error:", e);
      setError(e?.response?.data?.message || e?.response?.data?.error || "Failed to load transport routes.");
    } finally {
      setLoading((s) => ({ ...s, routes: false }));
    }
  }, [canUse, sessionCfg]);

  const fetchBuses = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, buses: true }));
    try {
      const res = await api.get(BUSES_BASE, sessionCfg);
      const list = asArray(res.data);
      setBuses(Array.isArray(list) ? list : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchBuses error:", e);
      setError(e?.response?.data?.message || e?.response?.data?.error || "Failed to load buses.");
    } finally {
      setLoading((s) => ({ ...s, buses: false }));
    }
  }, [canUse, sessionCfg]);

  const fetchRecentAssignments = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, assignments: true }));
    try {
      const res = await api.get(ASSIGN_BASE, {
        ...sessionCfg,
        params: { ...sessionCfg.params, active: true },
      });
      const list = asArray(res.data);
      const arr = Array.isArray(list) ? list : [];
      arr.sort((a, b) => {
        const da = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
        const db = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
        return db - da;
      });
      setRecentAssignments(arr.slice(0, 10));
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchRecentAssignments error:", e);
      setRecentAssignments([]);
    } finally {
      setLoading((s) => ({ ...s, assignments: false }));
    }
  }, [canUse, sessionCfg]);

  // KPI: Students with transport (fallback)
  const [studentsWithTransportCount, setStudentsWithTransportCount] = useState(0);

  const fetchStudentsWithTransport = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, students: true }));
    try {
      // Prefer assignments
      const resA = await api.get(ASSIGN_BASE, {
        ...sessionCfg,
        params: { ...sessionCfg.params, active: true },
      });
      const listA = asArray(resA.data);
      if (Array.isArray(listA) && listA.length) {
        const uniq = new Set(listA.map((x) => x.student_id).filter(Boolean));
        setStudentsWithTransportCount(uniq.size);
        setLastUpdated(new Date());
        return;
      }

      // fallback: students flag
      const resS = await api.get(STUDENTS_BASE, sessionCfg);
      const listS = asArray(resS.data);
      const arr = Array.isArray(listS) ? listS : [];
      const count = arr.filter((s) => {
        const bs = String(s?.bus_service ?? "").toLowerCase();
        return bs === "1" || bs === "true" || bs === "yes";
      }).length;

      setStudentsWithTransportCount(count);
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchStudentsWithTransport error:", e);
      setStudentsWithTransportCount(0);
    } finally {
      setLoading((s) => ({ ...s, students: false }));
    }
  }, [canUse, sessionCfg]);

  // Staff counts
  const fetchStaffCounts = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, staff: true }));
    try {
      const res = await api.get(STAFF_BASE, sessionCfg);
      const list = res?.data?.staff || asArray(res.data);
      const arr = Array.isArray(list) ? list : [];

      let drivers = 0;
      let conductors = 0;
      let activeStaff = 0;
      let inactiveStaff = 0;
      let userDisabled = 0;

      for (const r of arr) {
        const t = lower(r?.staff_type);
        if (t === "driver") drivers++;
        if (t === "conductor") conductors++;

        const staffStatus = lower(r?.status);
        if (staffStatus === "inactive") inactiveStaff++;
        else activeStaff++;

        const userStatus = lower(r?.user?.status);
        if (userStatus === "disabled") userDisabled++;
      }

      setStaffCounts({
        total: arr.length,
        drivers,
        conductors,
        activeStaff,
        inactiveStaff,
        userDisabled,
      });

      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchStaffCounts error:", e);
      setStaffCounts({
        total: 0,
        drivers: 0,
        conductors: 0,
        activeStaff: 0,
        inactiveStaff: 0,
        userDisabled: 0,
      });
    } finally {
      setLoading((s) => ({ ...s, staff: false }));
    }
  }, [canUse, sessionCfg]);

  const refreshAll = useCallback(() => {
    fetchRoutes();
    fetchBuses();
    fetchRecentAssignments();
    fetchStudentsWithTransport();
    fetchStaffCounts();
  }, [fetchRoutes, fetchBuses, fetchRecentAssignments, fetchStudentsWithTransport, fetchStaffCounts]);

  useEffect(() => {
    if (!canUse) return;
    localStorage.setItem("academic_session", session);
    refreshAll();
  }, [refreshAll, session, canUse]);

  // Auto refresh
  useEffect(() => {
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};

    if (!autoRefresh || !canUse) return;

    timersRef.current.routes = setInterval(fetchRoutes, POLLING_INTERVAL);
    timersRef.current.buses = setInterval(fetchBuses, POLLING_INTERVAL);
    timersRef.current.assign = setInterval(fetchRecentAssignments, POLLING_INTERVAL);
    timersRef.current.students = setInterval(fetchStudentsWithTransport, POLLING_INTERVAL);
    timersRef.current.staff = setInterval(fetchStaffCounts, POLLING_INTERVAL);

    return () => Object.values(timersRef.current || {}).forEach(clearInterval);
  }, [autoRefresh, canUse, fetchRoutes, fetchBuses, fetchRecentAssignments, fetchStudentsWithTransport, fetchStaffCounts]);

  /* ---------------- Derived KPI ---------------- */
  const busKpis = useMemo(() => {
    const total = buses.length;
    const active = buses.filter((b) => b.active !== false).length;
    const withDriver = buses.filter((b) => !!b?.driver_user_id).length;
    const withConductor = buses.filter((b) => !!b?.conductor_user_id).length;
    return { total, active, withDriver, withConductor };
  }, [buses]);

  const routeKpis = useMemo(() => {
    const total = routes.length;
    const withFine = routes.filter((r) => Number(r?.finePercentage || 0) > 0 || !!r?.fineStartDate).length;
    const uniqVillages = uniqCount(routes, (r) => safeStr(r?.Villages).toLowerCase());
    return { total, withFine, uniqVillages };
  }, [routes]);

  const busy = loading.routes || loading.buses || loading.assignments || loading.students || loading.staff;

  /* ---------------- Quick Links (UPDATED) ---------------- */
  const quickLinks = useMemo(() => {
    const links = [
      {
        label: "Transport Routes",
        icon: "bi-signpost-split",
        href: "/transportations",
        gradient: "linear-gradient(135deg, #0ea5e9, #0369a1)",
        desc: `Routes: ${routeKpis.total} · Fine: ${routeKpis.withFine}`,
        show: isTransport || isAdmin || isSuperadmin || isAccounts,
      },
      {
        label: "Buses",
        icon: "bi-bus-front",
        href: "/buses",
        gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
        desc: `Total: ${busKpis.total} · Active: ${busKpis.active}`,
        show: isTransport || isAdmin || isSuperadmin || isAccounts,
      },
      {
        label: "Assign Students",
        icon: "bi-person-check",
        href: "/student-transport-assignments",
        gradient: "linear-gradient(135deg, #6366f1, #4338ca)",
        desc: `Live: ${studentsWithTransportCount} students`,
        show: isTransport || isAdmin || isSuperadmin || isAccounts,
      },
      {
        label: "Drivers / Conductors",
        icon: "bi-person-badge",
        href: "/transport-staff",
        gradient: "linear-gradient(135deg, #ef4444, #b91c1c)",
        desc: `Drivers: ${staffCounts.drivers} · Conductors: ${staffCounts.conductors}`,
        show: isTransport || isAdmin || isSuperadmin || isAccounts,
      },

      // ✅ NEW: Attendance Mobile
      {
        label: "Mark Attendance (Mobile)",
        icon: "bi-check2-square",
        href: "/transport-attendance",
        gradient: "linear-gradient(135deg, #f59e0b, #b45309)",
        desc: "Pickup/Drop marking (Driver/Conductor)",
        show: canMarkMobile,
      },

      // ✅ NEW: Attendance Report
      {
        label: "Attendance Report",
        icon: "bi-clipboard-data",
        href: "/transport-attendance-report",
        gradient: "linear-gradient(135deg, #14b8a6, #0f766e)",
        desc: `Bus-wise present/absent · ${todayYYYYMMDD()}`,
        show: canSeeReport,
      },
    ];

    return links.filter((x) => x.show);
  }, [
    routeKpis.total,
    routeKpis.withFine,
    busKpis.total,
    busKpis.active,
    studentsWithTransportCount,
    staffCounts,
    isTransport,
    isAdmin,
    isSuperadmin,
    isAccounts,
    canMarkMobile,
    canSeeReport,
  ]);

  /* ---------------- Tiles (UPDATED) ---------------- */
  const tiles = useMemo(() => {
    const t = [
      { title: "Routes (Session)", value: routeKpis.total, variant: "info", to: "/transportations", show: canSeeReport || isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "Routes with Fine", value: routeKpis.withFine, variant: "warning", to: "/transportations", show: canSeeReport || isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "Unique Villages", value: routeKpis.uniqVillages, variant: "secondary", to: "/transportations", show: canSeeReport || isTransport || isAdmin || isSuperadmin || isAccounts },

      { title: "Total Buses", value: busKpis.total, variant: "success", to: "/buses", show: isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "Active Buses", value: busKpis.active, variant: "primary", to: "/buses", show: isTransport || isAdmin || isSuperadmin || isAccounts },

      { title: "Buses w/ Driver", value: busKpis.withDriver, variant: "dark", to: "/buses", show: isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "Buses w/ Conductor", value: busKpis.withConductor, variant: "dark", to: "/buses", show: isTransport || isAdmin || isSuperadmin || isAccounts },

      { title: "Students w/ Transport", value: studentsWithTransportCount, variant: "dark", to: "/student-transport-assignments", show: isTransport || isAdmin || isSuperadmin || isAccounts },

      { title: "Drivers", value: staffCounts.drivers, variant: "danger", to: "/transport-staff", show: isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "Conductors", value: staffCounts.conductors, variant: "danger", to: "/transport-staff", show: isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "Staff Total", value: staffCounts.total, variant: "secondary", to: "/transport-staff", show: isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "Staff Inactive", value: staffCounts.inactiveStaff, variant: "warning", to: "/transport-staff", show: isTransport || isAdmin || isSuperadmin || isAccounts },
      { title: "User Disabled", value: staffCounts.userDisabled, variant: "warning", to: "/transport-staff", show: isTransport || isAdmin || isSuperadmin || isAccounts },

      // ✅ NEW: Attendance
      {
        title: "Mark Attendance",
        value: "Open",
        variant: "warning",
        to: "/transport-attendance",
        show: canMarkMobile,
      },
      {
        title: "Attendance Report",
        value: "Open",
        variant: "info",
        to: "/transport-attendance-report",
        show: canSeeReport,
      },

      { title: "Recent Assignments", value: recentAssignments.length, variant: "secondary", to: "/student-transport-assignments", show: isTransport || isAdmin || isSuperadmin || isAccounts },
    ];

    return t.filter((x) => x.show);
  }, [
    routeKpis,
    busKpis,
    studentsWithTransportCount,
    staffCounts,
    recentAssignments.length,
    isTransport,
    isAdmin,
    isSuperadmin,
    isAccounts,
    canMarkMobile,
    canSeeReport,
  ]);

  if (!canUse) {
    return (
      <div className="container mt-4">
        <h1 className="h3 mb-2">Transport Dashboard</h1>
        <div className="alert alert-warning">You don’t have access to Transport dashboard.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(14,165,233,0.10), rgba(34,197,94,0.10), rgba(99,102,241,0.10))",
        minHeight: "100vh",
      }}
    >
      <div className="container-fluid px-4 py-3">
        {/* Header */}
        <div className="rounded-4 p-3 shadow-sm bg-white mb-3">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <h4 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                  <i className="bi bi-bus-front-fill" style={{ opacity: 0.85 }} />
                  Transport Dashboard
                </h4>

                <span className="badge text-bg-light border" title="Selected session">
                  Session: {session}
                </span>

                {busy ? (
                  <span className="badge text-bg-warning" title="Refreshing">
                    Updating…
                  </span>
                ) : (
                  <span className="badge text-bg-success" title="Up to date">
                    Live
                  </span>
                )}
              </div>

              <div className="text-muted small mt-1">
                Routes · Buses · Assignments · Staff · Attendance{" · "}
                {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString("en-IN")}` : "—"}
              </div>

              {/* Tiny summary pills */}
              <div className="d-flex flex-wrap gap-2 mt-3">
                <StatPill label="Drivers" value={staffCounts.drivers} tone="danger" to="/transport-staff" />
                <StatPill label="Conductors" value={staffCounts.conductors} tone="danger" to="/transport-staff" />
                <StatPill label="Buses Active" value={busKpis.active} tone="primary" to="/buses" />
                <StatPill label="Routes" value={routeKpis.total} tone="info" to="/transportations" />

                {canMarkMobile ? (
                  <StatPill label="Mark Attendance" value="Open" tone="warning" to="/transport-attendance" />
                ) : null}

                {canSeeReport ? (
                  <StatPill label="Attendance Report" value="Open" tone="info" to="/transport-attendance-report" />
                ) : null}
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 align-items-center">
              {/* Session control */}
              <div className="d-flex align-items-center gap-2">
                <button
                  className="btn btn-outline-secondary shadow-sm"
                  title="Previous session"
                  onClick={() => setSession((s) => shiftSession(s, -1))}
                >
                  ◀
                </button>
                <input
                  className="form-control shadow-sm"
                  style={{ width: 140 }}
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  placeholder="2025-26"
                />
                <button
                  className="btn btn-outline-secondary shadow-sm"
                  title="Next session"
                  onClick={() => setSession((s) => shiftSession(s, +1))}
                >
                  ▶
                </button>
              </div>

              <button
                className={`btn btn-outline-${autoRefresh ? "secondary" : "success"} shadow-sm`}
                onClick={() => setAutoRefresh((v) => !v)}
              >
                {autoRefresh ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
              </button>

              <button className="btn btn-primary shadow-sm" onClick={refreshAll} disabled={busy}>
                <i className="bi bi-arrow-clockwise me-1" /> Refresh
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger d-flex align-items-start gap-2 shadow-sm" role="alert">
            <i className="bi bi-exclamation-octagon-fill fs-5"></i>
            <div className="flex-grow-1">
              <div className="fw-semibold">Something went wrong</div>
              <div className="small">{error}</div>
            </div>
            <button className="btn btn-sm btn-light border shadow-sm" onClick={refreshAll}>
              Try again
            </button>
          </div>
        ) : null}

        {/* Quick Links */}
        <div className="row g-3 mb-4">
          {quickLinks.map((q) => (
            <div key={q.label} className="col-12 col-sm-6 col-lg-3">
              <Link
                to={q.href}
                className="btn w-100 text-white shadow-sm rounded-4 p-3 d-flex align-items-center gap-3"
                style={{ backgroundImage: q.gradient, textDecoration: "none" }}
                state={{ session }}
              >
                <span
                  className="d-inline-grid place-items-center rounded-circle"
                  style={{
                    width: 44,
                    height: 44,
                    background: "rgba(255,255,255,0.22)",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  <i className={`bi ${q.icon} fs-4`} />
                </span>
                <div className="text-start">
                  <div className="fw-semibold">{q.label}</div>
                  <div className="small opacity-75">{q.desc}</div>
                </div>
                <div className="ms-auto">
                  <i className="bi bi-arrow-right fs-5 opacity-75" />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* KPI tiles */}
        <div className="row g-3 mb-4">
          {tiles.map((t, i) => (
            <div key={i} className="col-12 col-sm-6 col-lg-3">
              <Tile
                title={t.title}
                value={t.value}
                variant={t.variant}
                hint={busy ? "Updating…" : "Click to open"}
                to={t.to}
              />
            </div>
          ))}
        </div>

        {/* Recent Assignments */}
        {(isTransport || isAdmin || isSuperadmin || isAccounts) ? (
          <div className="row g-4">
            <div className="col-12">
              <div className="card shadow-sm rounded-4 overflow-hidden">
                <div className="card-header bg-white border-0 d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="fw-semibold d-flex align-items-center gap-2">
                    Recent Student Transport Assignments
                    <span className="badge text-bg-light border">Session: {session}</span>
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => navigate("/transportations")}
                      title="Open Routes"
                    >
                      Routes
                    </button>
                    <Link className="btn btn-sm btn-outline-primary" to="/student-transport-assignments">
                      Assignments
                    </Link>
                    <Link className="btn btn-sm btn-outline-success" to="/buses">
                      Buses
                    </Link>
                    <Link className="btn btn-sm btn-outline-danger" to="/transport-staff">
                      Staff
                    </Link>
                    {canSeeReport ? (
                      <Link className="btn btn-sm btn-outline-info" to="/transport-attendance-report">
                        Attendance Report
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 60 }}>#</th>
                        <th>Student ID</th>
                        <th>Pickup Bus</th>
                        <th>Drop Bus</th>
                        <th>Pickup Route</th>
                        <th>Drop Route</th>
                        <th>Effective From</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading.assignments && (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-muted">
                            Loading…
                          </td>
                        </tr>
                      )}

                      {!loading.assignments &&
                        recentAssignments.map((a, idx) => (
                          <tr key={a.id || idx}>
                            <td className="text-muted">{idx + 1}</td>
                            <td className="fw-semibold">{safe(a.student_id)}</td>
                            <td>{safe(a.pickup_bus_id)}</td>
                            <td>{safe(a.drop_bus_id)}</td>
                            <td>{safe(a.pickup_route_id)}</td>
                            <td>{safe(a.drop_route_id)}</td>
                            <td className="text-muted">{fmtDate(a.effective_from)}</td>
                            <td className="text-muted">{fmtDateTime(a.createdAt)}</td>
                          </tr>
                        ))}

                      {!loading.assignments && recentAssignments.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-muted">
                            No assignments found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="card-footer bg-white border-0 small text-muted d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    Tip: Use <strong>Assignments</strong> to set Pickup/Drop buses with effective dates.
                  </div>
                  <div>
                    Auto-refresh: <strong>{autoRefresh ? "On" : "Off"}</strong> · Polling:{" "}
                    <code>{POLLING_INTERVAL / 1000}s</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Styles */}
        <style>{`
          .card { animation: fadeInUp .45s ease-out; }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          code { background: rgba(0,0,0,.04); padding: 2px 6px; border-radius: 8px; }
          .place-items-center { display: grid; place-items: center; }
          a:hover .card { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,.10); }
        `}</style>

        {/* Bootstrap Icons */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
        />
      </div>
    </div>
  );
}
