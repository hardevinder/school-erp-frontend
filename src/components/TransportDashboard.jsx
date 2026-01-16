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
    isTransport: roles.includes("transport"),
  };
};

/* ---------------- Small utils ---------------- */
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  return d.rows || d.items || d.results || d.data || [];
};

const safe = (v, fb = "—") => (v === null || v === undefined || v === "" ? fb : String(v));

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

/* ---------------- Component ---------------- */
export default function TransportDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperadmin, isAccounts, isTransport } = useMemo(getRoleFlags, []);
  const canUse = isTransport || isAdmin || isSuperadmin || isAccounts;

  // State
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);

  const [loading, setLoading] = useState({
    routes: false,
    buses: false,
    assignments: false,
    students: false,
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

  /* ---------------- Fetchers ---------------- */
  const fetchRoutes = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, routes: true }));
    try {
      const res = await api.get(ROUTES_BASE);
      const list = asArray(res.data);
      setRoutes(Array.isArray(list) ? list : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchRoutes error:", e);
      setError(e?.response?.data?.message || "Failed to load transport routes.");
    } finally {
      setLoading((s) => ({ ...s, routes: false }));
    }
  }, [canUse]);

  const fetchBuses = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, buses: true }));
    try {
      const res = await api.get(BUSES_BASE);
      const list = asArray(res.data);
      setBuses(Array.isArray(list) ? list : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchBuses error:", e);
      setError(e?.response?.data?.message || "Failed to load buses.");
    } finally {
      setLoading((s) => ({ ...s, buses: false }));
    }
  }, [canUse]);

  const fetchRecentAssignments = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, assignments: true }));
    try {
      const res = await api.get(ASSIGN_BASE, { params: { active: true } });
      const list = asArray(res.data);
      const arr = Array.isArray(list) ? list : [];
      setRecentAssignments(arr.slice(0, 10));
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchRecentAssignments error:", e);
      // Not fatal; show empty
      setRecentAssignments([]);
    } finally {
      setLoading((s) => ({ ...s, assignments: false }));
    }
  }, [canUse]);

  // For KPI: Students with transport (fallback)
  const [studentsWithTransportCount, setStudentsWithTransportCount] = useState(0);

  const fetchStudentsWithTransport = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, students: true }));
    try {
      // Try using active assignments count first (more accurate)
      const resA = await api.get(ASSIGN_BASE, { params: { active: true } });
      const listA = asArray(resA.data);
      if (Array.isArray(listA) && listA.length) {
        // distinct student ids
        const uniq = new Set(listA.map((x) => x.student_id).filter(Boolean));
        setStudentsWithTransportCount(uniq.size);
        setLastUpdated(new Date());
        return;
      }

      // Fallback: count from students list (bus_service is '1' / true)
      const resS = await api.get(STUDENTS_BASE);
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
  }, [canUse]);

  const refreshAll = useCallback(() => {
    fetchRoutes();
    fetchBuses();
    fetchRecentAssignments();
    fetchStudentsWithTransport();
  }, [fetchRoutes, fetchBuses, fetchRecentAssignments, fetchStudentsWithTransport]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto refresh
  useEffect(() => {
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};

    if (!autoRefresh || !canUse) return;

    timersRef.current.routes = setInterval(fetchRoutes, POLLING_INTERVAL);
    timersRef.current.buses = setInterval(fetchBuses, POLLING_INTERVAL);
    timersRef.current.assign = setInterval(fetchRecentAssignments, POLLING_INTERVAL);
    timersRef.current.students = setInterval(fetchStudentsWithTransport, POLLING_INTERVAL);

    return () => Object.values(timersRef.current || {}).forEach(clearInterval);
  }, [autoRefresh, canUse, fetchRoutes, fetchBuses, fetchRecentAssignments, fetchStudentsWithTransport]);

  /* ---------------- Derived KPI ---------------- */
  const busKpis = useMemo(() => {
    const total = buses.length;
    const active = buses.filter((b) => b.active !== false).length;
    return { total, active };
  }, [buses]);

  const routeKpis = useMemo(() => {
    const total = routes.length;
    return { total };
  }, [routes]);

  const quickLinks = useMemo(
    () => [
      {
        label: "Transport Routes",
        icon: "bi-signpost-split",
        href: "/transportations",
        gradient: "linear-gradient(135deg, #0ea5e9, #0369a1)",
      },
      {
        label: "Buses",
        icon: "bi-bus-front",
        href: "/buses",
        gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
      },
      {
        label: "Assign Students",
        icon: "bi-person-check",
        href: "/student-transport-assignments",
        gradient: "linear-gradient(135deg, #6366f1, #4338ca)",
      },
      {
        label: "Bus Attendance",
        icon: "bi-check2-square",
        href: "/transport-attendance", // create later
        gradient: "linear-gradient(135deg, #f59e0b, #b45309)",
      },
    ],
    []
  );

  const kpiTiles = useMemo(
    () => [
      { title: "Total Routes", value: routeKpis.total, variant: "info" },
      { title: "Total Buses", value: busKpis.total, variant: "success" },
      { title: "Active Buses", value: busKpis.active, variant: "primary" },
      { title: "Students w/ Transport", value: studentsWithTransportCount, variant: "warning" },
      { title: "Recent Assignments", value: recentAssignments.length, variant: "secondary" },
      {
        title: "Open Assign Module",
        value: "Go",
        variant: "dark",
        isLink: true,
        href: "/student-transport-assignments",
      },
    ],
    [routeKpis, busKpis, studentsWithTransportCount, recentAssignments]
  );

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
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 rounded-4 p-3 shadow-sm bg-white">
          <div>
            <h4 className="mb-1 fw-semibold">Transport Dashboard</h4>
            <div className="text-muted small">
              Routes · Buses · Assignments{" · "}
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString("en-IN")}` : "—"}
            </div>
          </div>

          <div className="d-flex gap-2">
            <button
              className={`btn btn-outline-${autoRefresh ? "secondary" : "success"} shadow-sm`}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              {autoRefresh ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
            </button>
            <button className="btn btn-primary shadow-sm" onClick={refreshAll}>
              <i className="bi bi-arrow-clockwise me-1" /> Refresh
            </button>
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
                  <div className="small opacity-75">Open</div>
                </div>
                <div className="ms-auto">
                  <i className="bi bi-arrow-right fs-5 opacity-75" />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* KPIs */}
        <div className="row g-3 mb-4">
          {kpiTiles.map((k, i) => (
            <div key={i} className="col-12 col-sm-6 col-lg-3">
              <div
                className={`card border-0 shadow-sm rounded-4 h-100 bg-${k.variant} bg-opacity-10`}
                style={{ cursor: k.isLink ? "pointer" : "default" }}
                onClick={k.isLink ? () => navigate(k.href) : undefined}
                title={k.isLink ? "Open Transport Assignments" : undefined}
              >
                <div className="card-body">
                  <div className="text-uppercase small text-muted mb-1">{k.title}</div>
                  <div className="display-6 fw-semibold">{k.value}</div>
                  <div className="small text-muted">
                    {loading.routes || loading.buses || loading.assignments || loading.students
                      ? "Updating…"
                      : "Live snapshot"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Assignments */}
        <div className="row g-4">
          <div className="col-12">
            <div className="card shadow-sm rounded-4">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Recent Student Transport Assignments</div>
                <Link className="btn btn-sm btn-outline-primary" to="/student-transport-assignments">
                  Open module
                </Link>
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

              <div className="card-footer bg-white border-0 small text-muted">
                Tip: Use <strong>Assign Students</strong> module to set Pickup/Drop buses with effective dates.
              </div>
            </div>
          </div>
        </div>

        {/* Styles */}
        <style>{`
          .card { animation: fadeInUp .5s ease-out; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px);} to { opacity: 1; transform: translateY(0);} }
          code { background: rgba(0,0,0,.04); padding: 2px 6px; border-radius: 8px; }
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
