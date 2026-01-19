// File: src/components/AdmissionDashboard.jsx
// ✅ Admission Dashboard (Enquiries + Registrations + Quick Links)
// ✅ Role-safe (admission/frontoffice/admin/superadmin can view; others see warning)
// ✅ Recent Enquiries + Recent Registrations
// ✅ IMPORTANT: Uses React Router navigation (Link / useNavigate) so NO FULL PAGE RELOAD
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
    isAdmission: roles.includes("admission"),
  };
};

/* ---------------- Small utils ---------------- */
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  return d.rows || d.items || d.results || d.data || [];
};

const initials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => (p[0] || "").toUpperCase()).join("") || "?";
};

const safe = (v, fb = "—") => (v === null || v === undefined || v === "" ? fb : String(v));

const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN");
};

const badgeClassForFee = (st) => {
  const s = String(st || "").toLowerCase();
  if (s === "paid") return "bg-success";
  if (s === "unpaid") return "bg-warning text-dark";
  return "bg-secondary";
};

const badgeClassForRegStatus = (st) => {
  const s = String(st || "").toLowerCase();
  if (s === "admitted") return "bg-success";
  if (s === "selected") return "bg-primary";
  if (s === "rejected") return "bg-danger";
  if (s === "registered") return "bg-secondary";
  return "bg-dark";
};

/* ---------------- Component ---------------- */
export default function AdmissionDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperadmin, isFrontoffice, isAdmission } = useMemo(getRoleFlags, []);
  const canUse = isAdmission || isFrontoffice || isAdmin || isSuperadmin;

  // State
  const [recentEnquiries, setRecentEnquiries] = useState([]);
  const [recentRegistrations, setRecentRegistrations] = useState([]);

  const [loading, setLoading] = useState({
    enquiries: false,
    registrations: false,
  });

  const [error, setError] = useState("");

  // auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timersRef = useRef({});

  const POLLING_INTERVAL = 25000; // 25s

  // API base paths (change if your backend uses /api/...)
  const ENQ_BASE = "/enquiries";
  const REG_BASE = "/registrations";

  /* ---------------- Fetchers ---------------- */
  const fetchRecentEnquiries = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, enquiries: true }));
    try {
      const res = await api.get(ENQ_BASE);
      const list = asArray(res.data);
      setRecentEnquiries(Array.isArray(list) ? list.slice(0, 10) : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchRecentEnquiries error:", e);
      setError(e?.response?.data?.message || "Failed to load enquiries.");
    } finally {
      setLoading((s) => ({ ...s, enquiries: false }));
    }
  }, [canUse]);

  const fetchRecentRegistrations = useCallback(async () => {
    if (!canUse) return;
    setLoading((s) => ({ ...s, registrations: true }));
    try {
      const res = await api.get(REG_BASE);
      const list = asArray(res.data);
      setRecentRegistrations(Array.isArray(list) ? list.slice(0, 10) : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("fetchRecentRegistrations error:", e);
      setError(e?.response?.data?.message || "Failed to load registrations.");
    } finally {
      setLoading((s) => ({ ...s, registrations: false }));
    }
  }, [canUse]);

  const refreshAll = useCallback(() => {
    fetchRecentEnquiries();
    fetchRecentRegistrations();
  }, [fetchRecentEnquiries, fetchRecentRegistrations]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Auto refresh
  useEffect(() => {
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};

    if (!autoRefresh || !canUse) return;

    timersRef.current.enq = setInterval(fetchRecentEnquiries, POLLING_INTERVAL);
    timersRef.current.reg = setInterval(fetchRecentRegistrations, POLLING_INTERVAL);

    return () => Object.values(timersRef.current || {}).forEach(clearInterval);
  }, [autoRefresh, canUse, fetchRecentEnquiries, fetchRecentRegistrations]);

  /* ---------------- Derived KPI ---------------- */
  const enqKpis = useMemo(() => {
    const total = recentEnquiries.length;
    const withPhone = recentEnquiries.filter((e) => !!e.phone).length;
    return { total, withPhone };
  }, [recentEnquiries]);

  const regKpis = useMemo(() => {
    const total = recentRegistrations.length;
    const paid = recentRegistrations.filter((r) => String(r.fee_status || "").toLowerCase() === "paid").length;
    const admitted = recentRegistrations.filter((r) => String(r.status || "").toLowerCase() === "admitted").length;
    return { total, paid, admitted };
  }, [recentRegistrations]);

  // ✅ NEW: Projection report link (same as App.js)
  const PROJECTION_HREF = "/reports/student-strength-projection";

  // ✅ UPDATED: Added Projection Report quick-link
  const quickLinks = useMemo(
    () => [
      {
        label: "Enquiries",
        icon: "bi-chat-dots",
        href: "/enquiries",
        gradient: "linear-gradient(135deg, #0ea5e9, #0369a1)",
      },
      {
        label: "Registrations",
        icon: "bi-person-plus",
        href: "/registrations",
        gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
      },
      {
        label: "Projection Report",
        icon: "bi-graph-up-arrow",
        href: PROJECTION_HREF,
        gradient: "linear-gradient(135deg, #f97316, #ea580c)",
      },
      {
        label: "Academic Calendar",
        icon: "bi-calendar3",
        href: "/academic-calendar-view",
        gradient: "linear-gradient(135deg, #6366f1, #4338ca)",
      },
    ],
    []
  );

  // ✅ UPDATED: Added KPI tile "Projection Report"
  const kpiTiles = useMemo(
    () => [
      { title: "Recent Enquiries", value: enqKpis.total, variant: "info" },
      { title: "Enquiries w/ Phone", value: enqKpis.withPhone, variant: "secondary" },
      { title: "Recent Registrations", value: regKpis.total, variant: "success" },
      { title: "Paid (Recent)", value: regKpis.paid, variant: "primary" },
      { title: "Admitted (Recent)", value: regKpis.admitted, variant: "warning" },
      { title: "Projection Report", value: "Open", variant: "dark", isLink: true, href: PROJECTION_HREF },
    ],
    [enqKpis, regKpis]
  );

  if (!canUse) {
    return (
      <div className="container mt-4">
        <h1 className="h3 mb-2">Admission Dashboard</h1>
        <div className="alert alert-warning">You don’t have access to Admission dashboard.</div>
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
            <h4 className="mb-1 fw-semibold">Admission Dashboard</h4>
            <div className="text-muted small">
              Enquiries · Registrations · Quick Links{" · "}
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
                title={k.isLink ? "Open module" : undefined}
              >
                <div className="card-body">
                  <div className="text-uppercase small text-muted mb-1">{k.title}</div>
                  <div className="display-6 fw-semibold">{k.value}</div>
                  <div className="small text-muted">
                    {k.isLink ? "Open module" : loading.enquiries || loading.registrations ? "Updating…" : "Live snapshot"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tables */}
        <div className="row g-4">
          {/* Recent Enquiries */}
          <div className="col-12 col-xxl-6">
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
                            background: "#e0f2fe",
                            color: "#075985",
                            fontWeight: 700,
                          }}
                        >
                          {initials(enq.student_name)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">{safe(enq.student_name)}</div>
                          <div className="small text-muted">Class: {safe(enq.class_interested)}</div>
                          {enq.phone ? <div className="small text-muted">📞 {enq.phone}</div> : null}
                        </div>
                        <div className="text-end">
                          <span className="badge text-bg-light">{fmtDate(enq.enquiry_date)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Recent Registrations */}
          <div className="col-12 col-xxl-6">
            <div className="card shadow-sm rounded-4 h-100">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Recent Registrations</div>
                <Link className="btn btn-sm btn-outline-primary" to="/registrations">
                  Open module
                </Link>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th>Reg No</th>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Status</th>
                      <th>Fee</th>
                      <th>Fee Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading.registrations && (
                      <tr>
                        <td colSpan={8} className="text-center py-4 text-muted">
                          Loading…
                        </td>
                      </tr>
                    )}

                    {!loading.registrations &&
                      recentRegistrations.map((r, idx) => (
                        <tr key={r.id || idx}>
                          <td className="text-muted">{idx + 1}</td>
                          <td className="fw-semibold">{safe(r.registration_no)}</td>
                          <td style={{ maxWidth: 200 }} className="text-truncate" title={safe(r.student_name, "")}>
                            {safe(r.student_name)}
                          </td>
                          <td>{safe(r.class_applied)}</td>
                          <td>
                            <span className={`badge ${badgeClassForRegStatus(r.status)}`}>{safe(r.status)}</span>
                          </td>
                          <td className="text-muted">{safe(r.registration_fee)}</td>
                          <td>
                            <span className={`badge ${badgeClassForFee(r.fee_status)}`}>{safe(r.fee_status)}</span>
                          </td>
                          <td className="text-muted">{fmtDate(r.registration_date)}</td>
                        </tr>
                      ))}

                    {!loading.registrations && recentRegistrations.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-4 text-muted">
                          No registrations found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="card-footer bg-white border-0 small text-muted">
                Tip: Use <strong>Status</strong> & <strong>Fee</strong> buttons inside Registrations module for updates.
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
