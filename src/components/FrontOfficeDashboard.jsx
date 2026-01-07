// File: src/components/FrontOfficeDashboard.jsx
// ✅ Front Office Dashboard (Gate Pass + Visitors + Enquiries + Academic Calendar + Quick Links)
// ✅ Role-safe (frontoffice/admin/superadmin can view; others see warning)
// ✅ Recent Gate Passes + Recent Visitors + Recent Enquiries
// ✅ Academic Calendar shortcut added
// ✅ IMPORTANT FIX: Uses React Router navigation (Link / useNavigate) so NO FULL PAGE RELOAD
// ✅ Uses same api instance: import api from "../api"

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
    isFrontoffice: roles.includes("frontoffice"),
  };
};

/* ---------------- Small utils ---------------- */
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  return d.rows || d.items || d.results || d.data || d.employees || [];
};

const badgeClassForStatus = (st) => {
  const s = String(st || "").toUpperCase();
  if (s === "IN") return "bg-success";
  if (s === "OUT") return "bg-warning text-dark";
  if (s === "CANCELLED") return "bg-danger";
  if (s === "ISSUED") return "bg-primary";
  return "bg-secondary";
};

const badgeClassForVisitorStatus = (st) => {
  const s = String(st || "").toUpperCase();
  if (s === "CHECKED_OUT") return "bg-success";
  if (s === "INSIDE") return "bg-warning text-dark";
  if (s === "CHECKED_IN") return "bg-primary";
  if (s === "CANCELLED") return "bg-danger";
  if (s === "BLACKLISTED") return "bg-dark";
  return "bg-secondary";
};

const fmtDT = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-IN");
};

const initials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("") || "?";
};

const safe = (v, fb = "—") => (v === null || v === undefined || v === "" ? fb : String(v));

/* ---------------- Component ---------------- */
export default function FrontOfficeDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperadmin, isFrontoffice } = useMemo(getRoleFlags, []);
  const canUse = isFrontoffice || isAdmin || isSuperadmin;

  // State
  const [recentGatePasses, setRecentGatePasses] = useState([]);
  const [recentVisitors, setRecentVisitors] = useState([]);
  const [recentEnquiries, setRecentEnquiries] = useState([]);

  const [loading, setLoading] = useState({
    gatepass: false,
    visitors: false,
    enquiries: false,
  });

  const [error, setError] = useState("");

  // auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timersRef = useRef({});

  const POLLING_INTERVAL = 20000; // 20s

  /* ---------------- Fetchers ---------------- */
  const fetchRecentGatePasses = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, gatepass: true }));
    try {
      const res = await api.get("/gate-pass", { params: { limit: 10, offset: 0 } });
      const list = asArray(res.data);
      const top = Array.isArray(list) ? list.slice(0, 10) : [];
      setRecentGatePasses(top);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchRecentGatePasses error:", e);
      setError(e?.response?.data?.error || "Failed to load gate passes.");
    } finally {
      setLoading((s) => ({ ...s, gatepass: false }));
    }
  }, [canUse]);

  const fetchRecentVisitors = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, visitors: true }));
    try {
      // Expected route from your visitor module: GET /visitors?limit=&offset=
      const res = await api.get("/visitors", { params: { limit: 8, offset: 0 } });
      const list = asArray(res.data);
      setRecentVisitors(Array.isArray(list) ? list.slice(0, 8) : []);
    } catch (e) {
      console.error("fetchRecentVisitors error:", e);
      // don't hard-fail dashboard if visitors route isn't mounted yet
    } finally {
      setLoading((s) => ({ ...s, visitors: false }));
    }
  }, [canUse]);

  const fetchRecentEnquiries = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, enquiries: true }));
    try {
      const res = await api.get("/enquiries");
      const list = asArray(res.data);
      setRecentEnquiries(Array.isArray(list) ? list.slice(0, 8) : []);
    } catch (e) {
      console.error("fetchRecentEnquiries error:", e);
      // don't hard-fail dashboard if enquiries route isn't present
    } finally {
      setLoading((s) => ({ ...s, enquiries: false }));
    }
  }, [canUse]);

  const refreshAll = useCallback(() => {
    fetchRecentGatePasses();
    fetchRecentVisitors();
    fetchRecentEnquiries();
  }, [fetchRecentGatePasses, fetchRecentVisitors, fetchRecentEnquiries]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto refresh
  useEffect(() => {
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};

    if (!autoRefresh || !canUse) return;

    timersRef.current.gp = setInterval(fetchRecentGatePasses, POLLING_INTERVAL);
    timersRef.current.vst = setInterval(fetchRecentVisitors, POLLING_INTERVAL);
    timersRef.current.enq = setInterval(fetchRecentEnquiries, POLLING_INTERVAL * 2);

    return () => Object.values(timersRef.current || {}).forEach(clearInterval);
  }, [autoRefresh, canUse, fetchRecentGatePasses, fetchRecentVisitors, fetchRecentEnquiries]);

  /* ---------------- Derived KPI ---------------- */
  const gpKpis = useMemo(() => {
    const total = recentGatePasses.length;
    const issued = recentGatePasses.filter((g) => String(g.status).toUpperCase() === "ISSUED").length;
    const out = recentGatePasses.filter((g) => String(g.status).toUpperCase() === "OUT").length;
    const inCount = recentGatePasses.filter((g) => String(g.status).toUpperCase() === "IN").length;
    const cancelled = recentGatePasses.filter((g) => String(g.status).toUpperCase() === "CANCELLED").length;
    return { total, issued, out, in: inCount, cancelled };
  }, [recentGatePasses]);

  const visitorKpis = useMemo(() => {
    const total = recentVisitors.length;
    const checkedIn = recentVisitors.filter((v) => String(v.status).toUpperCase() === "CHECKED_IN").length;
    const inside = recentVisitors.filter((v) => String(v.status).toUpperCase() === "INSIDE").length;
    const checkedOut = recentVisitors.filter((v) => String(v.status).toUpperCase() === "CHECKED_OUT").length;
    return { total, checkedIn, inside, checkedOut };
  }, [recentVisitors]);

  const quickLinks = useMemo(
    () => [
      {
        label: "Gate Pass",
        icon: "bi-door-open",
        href: "/gate-pass",
        gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
      },
      {
        label: "Visitors",
        icon: "bi-person-vcard",
        href: "/visitors",
        gradient: "linear-gradient(135deg, #f97316, #ea580c)",
      },
      {
        label: "Enquiries",
        icon: "bi-chat-dots",
        href: "/enquiries",
        gradient: "linear-gradient(135deg, #0ea5e9, #0369a1)",
      },
      // ✅ NEW: Academic Calendar view page (everyone can view)
      {
        label: "Academic Calendar",
        icon: "bi-calendar3",
        href: "/academic-calendar-view",
        gradient: "linear-gradient(135deg, #6366f1, #4338ca)",
      },
      {
        label: "Students",
        icon: "bi-people",
        href: "/students",
        gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
      },
      {
        label: "Collect Fee",
        icon: "bi-cash-stack",
        href: "/transactions",
        gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
      },
    ],
    []
  );

  const kpiTiles = useMemo(
    () => [
      { title: "Recent Gate Passes", value: gpKpis.total, variant: "secondary" },
      { title: "Issued", value: gpKpis.issued, variant: "primary" },
      { title: "Out", value: gpKpis.out, variant: "warning" },
      { title: "In", value: gpKpis.in, variant: "success" },

      { title: "Recent Visitors", value: visitorKpis.total, variant: "secondary" },
      { title: "Checked In", value: visitorKpis.checkedIn, variant: "primary" },
      { title: "Inside", value: visitorKpis.inside, variant: "warning" },
      { title: "Checked Out", value: visitorKpis.checkedOut, variant: "success" },

      // ✅ NEW tile: Calendar
      { title: "Academic Calendar", value: "Open", variant: "info", isLink: true, href: "/academic-calendar-view" },
    ],
    [gpKpis, visitorKpis]
  );

  if (!canUse) {
    return (
      <div className="container mt-4">
        <h1 className="h3 mb-2">Front Office Dashboard</h1>
        <div className="alert alert-warning">You don’t have access to Front Office dashboard.</div>
      </div>
    );
  }

  return (
    <div
      className="fo-bg"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(34, 197, 94, 0.12), rgba(245, 158, 11, 0.10))",
        minHeight: "100vh",
      }}
    >
      <div className="container-fluid px-4 py-3">
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 rounded-4 p-3 shadow-sm bg-white">
          <div>
            <h4 className="mb-1 fw-semibold">Front Office Dashboard</h4>
            <div className="text-muted small">
              Quick actions · Gate Pass · Visitors · Enquiries · Academic Calendar{" · "}
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

        {/* Quick Links (✅ Link => no reload) */}
        <div className="row g-3 mb-4">
          {quickLinks.map((q) => (
            <div key={q.label} className="col-12 col-sm-6 col-lg-3">
              <Link
                to={q.href}
                className="btn w-100 text-white shadow-sm rounded-4 p-3 d-flex align-items-center gap-3 fo-link"
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

        {/* KPIs (✅ navigate => no reload) */}
        <div className="row g-3 mb-4">
          {kpiTiles.map((k, i) => (
            <div key={i} className="col-12 col-sm-6 col-lg-3">
              <div
                className={`card border-0 shadow-sm rounded-4 h-100 bg-${k.variant} bg-opacity-10`}
                style={{ cursor: k.isLink ? "pointer" : "default" }}
                onClick={k.isLink ? () => navigate(k.href) : undefined}
                title={k.isLink ? "Open Academic Calendar" : undefined}
              >
                <div className="card-body">
                  <div className="text-uppercase small text-muted mb-1">{k.title}</div>
                  <div className="display-6 fw-semibold">{k.value}</div>
                  <div className="small text-muted">
                    {k.isLink ? "View calendar" : loading.gatepass || loading.visitors ? "Updating…" : "Live snapshot"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tables */}
        <div className="row g-4">
          {/* Recent Gate Passes */}
          <div className="col-12 col-xxl-6">
            <div className="card shadow-sm rounded-4">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Recent Gate Passes</div>
                <div className="d-flex gap-2">
                  <Link className="btn btn-sm btn-outline-primary" to="/gate-pass">
                    Open Gate Pass
                  </Link>
                  <button className="btn btn-sm btn-outline-secondary" onClick={fetchRecentGatePasses}>
                    Refresh
                  </button>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>Pass No</th>
                      <th>Type</th>
                      <th>Person</th>
                      <th>Status</th>
                      <th>Issued At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading.gatepass && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          Loading…
                        </td>
                      </tr>
                    )}

                    {!loading.gatepass &&
                      recentGatePasses.map((gp, idx) => {
                        const person =
                          gp.type === "STUDENT"
                            ? gp.student?.name
                              ? `${gp.student.name} (${gp.student.admission_number || "N/A"})`
                              : `Student ID: ${gp.student_id || "N/A"}`
                            : gp.type === "EMPLOYEE"
                            ? gp.employee?.name
                              ? `${gp.employee.name}${gp.employee?.phone ? ` (${gp.employee.phone})` : ""}`
                              : `Employee ID: ${gp.employee_id || "N/A"}`
                            : gp.visitor_name
                            ? `${gp.visitor_name}${gp.visitor_phone ? ` (${gp.visitor_phone})` : ""}`
                            : "Visitor";

                        return (
                          <tr key={gp.id || idx}>
                            <td className="text-muted">{idx + 1}</td>
                            <td className="fw-semibold">{gp.pass_no || "—"}</td>
                            <td>{gp.type || "—"}</td>
                            <td style={{ maxWidth: 260 }} className="text-truncate" title={person}>
                              {person}
                            </td>
                            <td>
                              <span className={`badge ${badgeClassForStatus(gp.status)}`}>
                                {gp.status || "—"}
                              </span>
                            </td>
                            <td className="text-muted">{fmtDT(gp.issued_at)}</td>
                          </tr>
                        );
                      })}

                    {!loading.gatepass && recentGatePasses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          No gate passes found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Visitors */}
          <div className="col-12 col-xxl-6">
            <div className="card shadow-sm rounded-4">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Recent Visitors</div>
                <div className="d-flex gap-2">
                  <Link className="btn btn-sm btn-outline-primary" to="/visitors">
                    Open Visitors
                  </Link>
                  <button className="btn btn-sm btn-outline-secondary" onClick={fetchRecentVisitors}>
                    Refresh
                  </button>
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>Visitor No</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Check-In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading.visitors && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          Loading…
                        </td>
                      </tr>
                    )}

                    {!loading.visitors &&
                      recentVisitors.map((v, idx) => (
                        <tr key={v.id || idx}>
                          <td className="text-muted">{idx + 1}</td>
                          <td className="fw-semibold">{safe(v.visitor_no)}</td>
                          <td style={{ maxWidth: 240 }} className="text-truncate" title={safe(v.name, "")}>
                            {safe(v.name)}
                          </td>
                          <td className="text-muted">{safe(v.phone)}</td>
                          <td>
                            <span className={`badge ${badgeClassForVisitorStatus(v.status)}`}>
                              {safe(v.status)}
                            </span>
                          </td>
                          <td className="text-muted">{fmtDT(v.check_in_at)}</td>
                        </tr>
                      ))}

                    {!loading.visitors && recentVisitors.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-muted">
                          No visitors found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="card-footer bg-white border-0 small text-muted">
                Note: Visitors list will show once backend route <code>/visitors</code> is mounted.
              </div>
            </div>
          </div>

          {/* Recent Enquiries */}
          <div className="col-12">
            <div className="card shadow-sm rounded-4 h-100">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Recent Enquiries</div>
                <Link className="btn btn-sm btn-outline-primary" to="/enquiries">
                  View all
                </Link>
              </div>

              <div className="card-body p-0">
                {loading.enquiries && <div className="p-3 text-muted">Loading…</div>}

                {!loading.enquiries && recentEnquiries.length === 0 ? (
                  <div className="p-3 text-muted">No enquiries yet.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {recentEnquiries.map((enq) => (
                      <li key={enq.id} className="list-group-item d-flex align-items-start gap-3">
                        <div
                          className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                          style={{
                            width: 40,
                            height: 40,
                            background: "#eef2ff",
                            color: "#3730a3",
                            fontWeight: 700,
                          }}
                        >
                          {initials(enq.student_name)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">{enq.student_name || "—"}</div>
                          <div className="small text-muted">Class: {enq.class_interested || "—"}</div>
                          {enq.phone ? <div className="small text-muted">📞 {enq.phone}</div> : null}
                        </div>
                        <div className="text-end">
                          <span className="badge text-bg-light">
                            {enq.enquiry_date ? new Date(enq.enquiry_date).toLocaleDateString("en-IN") : ""}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* ✅ Academic Calendar highlight card (✅ Link => no reload) */}
          <div className="col-12">
            <div className="card shadow-sm rounded-4 border-0">
              <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <div className="fw-semibold">Academic Calendar</div>
                  <div className="text-muted small">
                    Students, teachers & staff can view the published academic calendar anytime.
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Link className="btn btn-outline-primary" to="/academic-calendar-view">
                    View Calendar
                  </Link>
                  <Link className="btn btn-outline-secondary" to="/academic-calendar">
                    Manage (Coordinator)
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Styles */}
        <style>{`
          .fo-link { transition: transform .2s ease, box-shadow .2s ease; }
          .fo-link:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0,0,0,.12); }
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
