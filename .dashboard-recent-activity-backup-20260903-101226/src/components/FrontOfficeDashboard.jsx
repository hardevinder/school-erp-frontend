// File: src/components/FrontOfficeDashboard.jsx
// Front Office Dashboard
// - Professional refreshed layout
// - Collect Fee quick link removed
// - Role-safe for frontoffice / admin / superadmin
// - Uses React Router navigation (Link / useNavigate) so no full page reload
// - Uses same api instance: import api from "../api"

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

const fmtDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN");
};

const initials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("") || "?";
};

const safe = (v, fb = "—") => (v === null || v === undefined || v === "" ? fb : String(v));

const getGatePassPerson = (gp) => {
  if (!gp) return "—";

  if (gp.type === "STUDENT") {
    if (gp.student?.name) {
      return `${gp.student.name}${gp.student?.admission_number ? ` (${gp.student.admission_number})` : ""}`;
    }
    return gp.student_id ? `Student ID: ${gp.student_id}` : "Student";
  }

  if (gp.type === "EMPLOYEE") {
    if (gp.employee?.name) {
      return `${gp.employee.name}${gp.employee?.phone ? ` (${gp.employee.phone})` : ""}`;
    }
    return gp.employee_id ? `Employee ID: ${gp.employee_id}` : "Employee";
  }

  if (gp.visitor_name) {
    return `${gp.visitor_name}${gp.visitor_phone ? ` (${gp.visitor_phone})` : ""}`;
  }

  return "Visitor";
};

/* ---------------- Small UI helpers ---------------- */
const EmptyState = ({ icon, title, message }) => (
  <div className="text-center py-5 px-3 text-muted">
    <div className="fo-empty-icon mx-auto mb-3">
      <i className={`bi ${icon}`} />
    </div>
    <div className="fw-semibold text-dark mb-1">{title}</div>
    <div className="small">{message}</div>
  </div>
);

const SectionHeader = ({ icon, title, subtitle, action }) => (
  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
    <div>
      <div className="d-flex align-items-center gap-2 mb-1">
        <span className="fo-section-icon">
          <i className={`bi ${icon}`} />
        </span>
        <h5 className="mb-0 fw-semibold">{title}</h5>
      </div>
      {subtitle ? <div className="text-muted small">{subtitle}</div> : null}
    </div>
    {action ? <div>{action}</div> : null}
  </div>
);

const SummaryCard = ({ icon, title, value, tone = "primary", subtext, onClick, href }) => {
  const content = (
    <div
      className={`card border-0 shadow-sm rounded-4 h-100 fo-summary-card fo-tone-${tone}`}
      style={{ cursor: onClick || href ? "pointer" : "default" }}
      onClick={onClick}
      title={typeof value === "string" ? `${title}: ${value}` : title}
    >
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div className="text-uppercase fo-mini-label mb-2">{title}</div>
            <div className="fo-summary-value">{value}</div>
            <div className="small text-muted mt-1">{subtext}</div>
          </div>
          <div className="fo-summary-icon">
            <i className={`bi ${icon}`} />
          </div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} style={{ textDecoration: "none" }}>
        {content}
      </Link>
    );
  }

  return content;
};

/* ---------------- Component ---------------- */
export default function FrontOfficeDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperadmin, isFrontoffice } = useMemo(getRoleFlags, []);
  const canUse = isFrontoffice || isAdmin || isSuperadmin;
  const canManageCalendar = isAdmin || isSuperadmin;

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
      const res = await api.get("/visitors", { params: { limit: 8, offset: 0 } });
      const list = asArray(res.data);
      setRecentVisitors(Array.isArray(list) ? list.slice(0, 8) : []);
    } catch (e) {
      console.error("fetchRecentVisitors error:", e);
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
    return { total, issued, out, in: inCount };
  }, [recentGatePasses]);

  const visitorKpis = useMemo(() => {
    const total = recentVisitors.length;
    const checkedIn = recentVisitors.filter((v) => String(v.status).toUpperCase() === "CHECKED_IN").length;
    const inside = recentVisitors.filter((v) => String(v.status).toUpperCase() === "INSIDE").length;
    const checkedOut = recentVisitors.filter((v) => String(v.status).toUpperCase() === "CHECKED_OUT").length;
    return { total, checkedIn, inside, checkedOut };
  }, [recentVisitors]);

  const enquiryKpi = useMemo(() => recentEnquiries.length, [recentEnquiries]);

  const dashboardBusy = loading.gatepass || loading.visitors || loading.enquiries;

  const quickLinks = useMemo(
    () => [
      {
        label: "Gate Pass",
        description: "Issue and track passes",
        icon: "bi-door-open",
        href: "/gate-pass",
        gradient: "linear-gradient(135deg, #2563eb, #1d4ed8)",
      },
      {
        label: "Visitors",
        description: "Manage visitor log",
        icon: "bi-person-vcard",
        href: "/visitors",
        gradient: "linear-gradient(135deg, #f97316, #ea580c)",
      },
      {
        label: "Enquiries",
        description: "Handle admissions enquiries",
        icon: "bi-chat-dots",
        href: "/enquiries",
        gradient: "linear-gradient(135deg, #0ea5e9, #0369a1)",
      },
      {
        label: "Academic Calendar",
        description: "Open published calendar",
        icon: "bi-calendar3",
        href: "/academic-calendar-view",
        gradient: "linear-gradient(135deg, #6366f1, #4338ca)",
      },
      {
        label: "Students",
        description: "View student records",
        icon: "bi-people",
        href: "/students",
        gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
      },
    ],
    []
  );

  const summaryCards = useMemo(
    () => [
      {
        title: "Gate Passes",
        value: gpKpis.total,
        tone: "slate",
        icon: "bi-door-open",
        subtext: "Recent entries",
      },
      {
        title: "Issued",
        value: gpKpis.issued,
        tone: "blue",
        icon: "bi-patch-check",
        subtext: "Ready / issued",
      },
      {
        title: "Out",
        value: gpKpis.out,
        tone: "amber",
        icon: "bi-box-arrow-right",
        subtext: "Currently out",
      },
      {
        title: "In",
        value: gpKpis.in,
        tone: "green",
        icon: "bi-box-arrow-in-left",
        subtext: "Returned / inside",
      },
      {
        title: "Visitors",
        value: visitorKpis.total,
        tone: "slate",
        icon: "bi-person-badge",
        subtext: "Recent records",
      },
      {
        title: "Inside",
        value: visitorKpis.inside,
        tone: "amber",
        icon: "bi-person-workspace",
        subtext: "Visitors in campus",
      },
      {
        title: "Checked Out",
        value: visitorKpis.checkedOut,
        tone: "green",
        icon: "bi-person-check",
        subtext: "Completed visits",
      },
      {
        title: "Enquiries",
        value: enquiryKpi,
        tone: "blue",
        icon: "bi-megaphone",
        subtext: "Recent admission leads",
      },
      {
        title: "Academic Calendar",
        value: "Open",
        tone: "violet",
        icon: "bi-calendar-event",
        subtext: "View published calendar",
        href: "/academic-calendar-view",
      },
    ],
    [gpKpis, visitorKpis, enquiryKpi]
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
          "radial-gradient(circle at top left, rgba(37, 99, 235, 0.15), transparent 30%), radial-gradient(circle at top right, rgba(168, 85, 247, 0.12), transparent 24%), linear-gradient(180deg, #f8fbff 0%, #f8fafc 100%)",
        minHeight: "100vh",
      }}
    >
      <div className="container-fluid px-4 py-4">
        {/* Hero Header */}
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
          <div className="card-body p-0">
            <div className="row g-0">
              <div className="col-12 col-xl-8">
                <div className="p-4 p-lg-5 h-100 fo-hero-main">
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <span className="badge text-bg-primary-subtle text-primary-emphasis border border-primary-subtle rounded-pill px-3 py-2">
                      <i className="bi bi-grid-1x2-fill me-1" />
                      Front Office
                    </span>
                    <span className="badge text-bg-light border rounded-pill px-3 py-2">
                      <span className={`fo-live-dot ${autoRefresh ? "active" : ""}`} />
                      {autoRefresh ? "Auto-refresh on" : "Auto-refresh paused"}
                    </span>
                    <span className="badge text-bg-light border rounded-pill px-3 py-2">
                      <i className="bi bi-clock-history me-1" />
                      {lastUpdated ? `Updated ${lastUpdated.toLocaleString("en-IN")}` : "Not synced yet"}
                    </span>
                  </div>

                  <h2 className="fw-bold mb-2">Front Office Dashboard</h2>
                  <p className="text-muted mb-4 fo-hero-text">
                    Monitor gate passes, visitors and enquiries from one place with faster access to the most-used front office tools.
                  </p>

                  <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-primary shadow-sm" onClick={refreshAll}>
                      <i className="bi bi-arrow-clockwise me-1" />
                      Refresh Dashboard
                    </button>
                    <button
                      className={`btn ${autoRefresh ? "btn-outline-secondary" : "btn-outline-success"} shadow-sm`}
                      onClick={() => setAutoRefresh((v) => !v)}
                    >
                      <i className={`bi ${autoRefresh ? "bi-pause-circle" : "bi-play-circle"} me-1`} />
                      {autoRefresh ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
                    </button>
                    <Link className="btn btn-outline-primary shadow-sm" to="/students">
                      <i className="bi bi-people me-1" />
                      Open Students
                    </Link>
                  </div>
                </div>
              </div>

              <div className="col-12 col-xl-4">
                <div className="h-100 p-4 p-lg-5 fo-hero-side">
                  <div className="text-uppercase fo-mini-label mb-3">Today at a glance</div>

                  <div className="fo-mini-stat mb-3">
                    <div className="fo-mini-stat-icon text-primary">
                      <i className="bi bi-door-open" />
                    </div>
                    <div>
                      <div className="fw-semibold">{gpKpis.total} recent gate passes</div>
                      <div className="small text-muted">
                        {gpKpis.issued} issued · {gpKpis.out} out · {gpKpis.in} in
                      </div>
                    </div>
                  </div>

                  <div className="fo-mini-stat mb-3">
                    <div className="fo-mini-stat-icon text-warning">
                      <i className="bi bi-person-badge" />
                    </div>
                    <div>
                      <div className="fw-semibold">{visitorKpis.total} recent visitors</div>
                      <div className="small text-muted">
                        {visitorKpis.checkedIn} checked in · {visitorKpis.inside} inside · {visitorKpis.checkedOut} checked out
                      </div>
                    </div>
                  </div>

                  <div className="fo-mini-stat">
                    <div className="fo-mini-stat-icon text-info">
                      <i className="bi bi-chat-dots" />
                    </div>
                    <div>
                      <div className="fw-semibold">{enquiryKpi} recent enquiries</div>
                      <div className="small text-muted">
                        {dashboardBusy ? "Refreshing live data…" : "Snapshot refreshed from recent records"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger d-flex align-items-start gap-2 shadow-sm rounded-4 border-0" role="alert">
            <i className="bi bi-exclamation-octagon-fill fs-5"></i>
            <div className="flex-grow-1">
              <div className="fw-semibold">Unable to load dashboard data</div>
              <div className="small">{error}</div>
            </div>
            <button className="btn btn-sm btn-light border shadow-sm" onClick={refreshAll}>
              Try Again
            </button>
          </div>
        ) : null}

        {/* Quick Links */}
        <SectionHeader
          icon="bi-lightning-charge-fill"
          title="Quick Actions"
          subtitle="Fast access to the most common front office modules."
        />

        <div className="row g-3 mb-4">
          {quickLinks.map((q) => (
            <div key={q.label} className="col-12 col-sm-6 col-xl-4 col-xxl-3">
              <Link
                to={q.href}
                className="btn w-100 text-white shadow-sm rounded-4 p-3 d-flex align-items-center gap-3 fo-link text-decoration-none"
                style={{ backgroundImage: q.gradient }}
              >
                <span
                  className="d-inline-grid place-items-center rounded-circle"
                  style={{
                    width: 48,
                    height: 48,
                    background: "rgba(255,255,255,0.20)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    flexShrink: 0,
                  }}
                >
                  <i className={`bi ${q.icon} fs-4`} />
                </span>
                <div className="text-start">
                  <div className="fw-semibold">{q.label}</div>
                  <div className="small opacity-75">{q.description}</div>
                </div>
                <div className="ms-auto">
                  <i className="bi bi-arrow-right fs-5 opacity-75" />
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Summary */}
        <SectionHeader
          icon="bi-bar-chart-fill"
          title="Operations Snapshot"
          subtitle="Live summary of recent front office activity."
          action={
            <span className="small text-muted">
              {dashboardBusy ? "Updating dashboard…" : "Live snapshot"}
            </span>
          }
        />

        <div className="row g-3 mb-4">
          {summaryCards.map((card) => (
            <div key={card.title} className="col-12 col-sm-6 col-xl-4 col-xxl-3">
              <SummaryCard
                icon={card.icon}
                title={card.title}
                value={card.value}
                tone={card.tone}
                subtext={card.subtext}
                href={card.href}
                onClick={card.onClick}
              />
            </div>
          ))}
        </div>

        {/* Tables */}
        <div className="row g-4">
          {/* Recent Gate Passes */}
          <div className="col-12 col-xxl-6">
            <div className="card shadow-sm rounded-4 border-0 h-100">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center flex-wrap gap-2 pt-4 px-4">
                <div>
                  <div className="fw-semibold">Recent Gate Passes</div>
                  <div className="small text-muted">Latest issued and movement records</div>
                </div>
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
                        <td colSpan={6}>
                          <EmptyState
                            icon="bi-arrow-repeat"
                            title="Loading gate passes"
                            message="Please wait while recent gate pass records are being fetched."
                          />
                        </td>
                      </tr>
                    )}

                    {!loading.gatepass &&
                      recentGatePasses.map((gp, idx) => {
                        const person = getGatePassPerson(gp);

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
                        <td colSpan={6}>
                          <EmptyState
                            icon="bi-door-closed"
                            title="No gate passes found"
                            message="Recent gate pass records will appear here once they are created."
                          />
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
            <div className="card shadow-sm rounded-4 border-0 h-100">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center flex-wrap gap-2 pt-4 px-4">
                <div>
                  <div className="fw-semibold">Recent Visitors</div>
                  <div className="small text-muted">Track visitor check-in and check-out activity</div>
                </div>
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
                        <td colSpan={6}>
                          <EmptyState
                            icon="bi-arrow-repeat"
                            title="Loading visitors"
                            message="Please wait while visitor entries are being fetched."
                          />
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
                        <td colSpan={6}>
                          <EmptyState
                            icon="bi-person-vcard"
                            title="No visitors found"
                            message="Visitor entries will appear here once the visitor register is used."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent Enquiries */}
          <div className="col-12">
            <div className="card shadow-sm rounded-4 border-0 h-100">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center flex-wrap gap-2 pt-4 px-4">
                <div>
                  <div className="fw-semibold">Recent Enquiries</div>
                  <div className="small text-muted">Latest admission enquiries received by front office</div>
                </div>
                <Link className="btn btn-sm btn-outline-primary" to="/enquiries">
                  View All
                </Link>
              </div>

              <div className="card-body p-0">
                {loading.enquiries ? (
                  <EmptyState
                    icon="bi-arrow-repeat"
                    title="Loading enquiries"
                    message="Please wait while recent enquiry records are being fetched."
                  />
                ) : recentEnquiries.length === 0 ? (
                  <EmptyState
                    icon="bi-chat-square-text"
                    title="No enquiries yet"
                    message="Recent enquiries will be listed here once they are added."
                  />
                ) : (
                  <ul className="list-group list-group-flush">
                    {recentEnquiries.map((enq) => (
                      <li key={enq.id} className="list-group-item border-0 border-top d-flex align-items-start gap-3 px-4 py-3">
                        <div
                          className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                          style={{
                            width: 42,
                            height: 42,
                            background: "#eef2ff",
                            color: "#3730a3",
                            fontWeight: 700,
                          }}
                        >
                          {initials(enq.student_name)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">{enq.student_name || "—"}</div>
                          <div className="small text-muted">Class interested: {enq.class_interested || "—"}</div>
                          {enq.phone ? <div className="small text-muted">Phone: {enq.phone}</div> : null}
                        </div>
                        <div className="text-end">
                          <span className="badge text-bg-light border">{fmtDate(enq.enquiry_date)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Academic Calendar */}
          <div className="col-12">
            <div className="card shadow-sm rounded-4 border-0 overflow-hidden">
              <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3 fo-calendar-card">
                <div>
                  <div className="fw-semibold fs-5 mb-1">Academic Calendar</div>
                  <div className="text-muted small">
                    Students, teachers and staff can view the published academic calendar anytime from the dashboard.
                  </div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <Link className="btn btn-primary" to="/academic-calendar-view">
                    View Calendar
                  </Link>
                  {canManageCalendar ? (
                    <Link className="btn btn-outline-secondary" to="/academic-calendar">
                      Manage Calendar
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Styles */}
        <style>{`
          .fo-link {
            transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
          }
          .fo-link:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(15, 23, 42, 0.14);
            filter: saturate(1.05);
          }

          .fo-hero-main {
            background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(239,246,255,0.96) 100%);
          }
          .fo-hero-side {
            background: linear-gradient(135deg, rgba(248,250,252,0.98) 0%, rgba(241,245,249,0.98) 100%);
            border-left: 1px solid rgba(148,163,184,0.18);
          }
          .fo-hero-text {
            max-width: 760px;
          }

          .fo-live-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #9ca3af;
            margin-right: 8px;
          }
          .fo-live-dot.active {
            background: #16a34a;
            box-shadow: 0 0 0 4px rgba(22,163,74,0.15);
          }

          .fo-mini-label {
            font-size: 11px;
            letter-spacing: .08em;
            font-weight: 700;
            color: #64748b;
          }

          .fo-mini-stat {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 14px;
            border-radius: 16px;
            background: rgba(255,255,255,0.72);
            border: 1px solid rgba(148,163,184,0.16);
          }
          .fo-mini-stat-icon {
            width: 42px;
            height: 42px;
            border-radius: 14px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.9);
            font-size: 1.1rem;
            box-shadow: inset 0 0 0 1px rgba(148,163,184,0.14);
            flex-shrink: 0;
          }

          .fo-section-icon {
            width: 30px;
            height: 30px;
            border-radius: 10px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #e8f0ff;
            color: #1d4ed8;
          }

          .fo-summary-card {
            transition: transform .18s ease, box-shadow .18s ease;
          }
          .fo-summary-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(15, 23, 42, 0.10) !important;
          }
          .fo-summary-value {
            font-size: 1.9rem;
            line-height: 1;
            font-weight: 800;
            color: #0f172a;
          }
          .fo-summary-icon {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
            flex-shrink: 0;
          }

          .fo-tone-slate { background: linear-gradient(180deg, rgba(248,250,252,0.95), rgba(255,255,255,1)); }
          .fo-tone-slate .fo-summary-icon { background: rgba(100,116,139,0.12); color: #475569; }

          .fo-tone-blue { background: linear-gradient(180deg, rgba(239,246,255,0.95), rgba(255,255,255,1)); }
          .fo-tone-blue .fo-summary-icon { background: rgba(37,99,235,0.12); color: #1d4ed8; }

          .fo-tone-green { background: linear-gradient(180deg, rgba(240,253,244,0.95), rgba(255,255,255,1)); }
          .fo-tone-green .fo-summary-icon { background: rgba(22,163,74,0.12); color: #15803d; }

          .fo-tone-amber { background: linear-gradient(180deg, rgba(255,251,235,0.98), rgba(255,255,255,1)); }
          .fo-tone-amber .fo-summary-icon { background: rgba(245,158,11,0.14); color: #b45309; }

          .fo-tone-violet { background: linear-gradient(180deg, rgba(245,243,255,0.98), rgba(255,255,255,1)); }
          .fo-tone-violet .fo-summary-icon { background: rgba(124,58,237,0.12); color: #6d28d9; }

          .fo-empty-icon {
            width: 58px;
            height: 58px;
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
            color: #64748b;
            font-size: 1.35rem;
            border: 1px solid #e2e8f0;
          }

          .fo-calendar-card {
            background: linear-gradient(135deg, rgba(239,246,255,0.85), rgba(250,245,255,0.85));
          }

          .card {
            animation: fadeInUp .45s ease-out;
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (max-width: 1199px) {
            .fo-hero-side {
              border-left: 0;
              border-top: 1px solid rgba(148,163,184,0.18);
            }
          }

          @media (max-width: 767px) {
            .fo-summary-value {
              font-size: 1.65rem;
            }
          }
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