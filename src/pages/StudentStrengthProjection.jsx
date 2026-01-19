// src/pages/StudentStrengthProjection.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

/* ---------------- Roles helper ---------------- */
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  const norm = roles.map((r) => String(r || "").toLowerCase());
  return {
    roles: norm,
    isAdmin: norm.includes("admin"),
    isSuperadmin: norm.includes("superadmin"),
    isAccounts: norm.includes("accounts"),
    isTeacher: norm.includes("teacher"),
    isAdmission: norm.includes("admission"),
    isFrontoffice: norm.includes("frontoffice"),
    isAcademicCoordinator: norm.includes("academic_coordinator"),
  };
};

/* ---------------- Helpers ---------------- */
const safeArr = (d) => (Array.isArray(d) ? d : d?.rows || d?.data || d?.items || d?.results || []);
const nInt = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fb;
};
const clampNonNeg = (v) => Math.max(0, nInt(v, 0));
const fmtInt = (n) => String(Math.round(Number(n || 0)));

const pickFirstById = (arr) => arr.slice().sort((a, b) => nInt(a.id) - nInt(b.id))[0];
const pickLatestById = (arr) => arr.slice().sort((a, b) => nInt(a.id) - nInt(b.id))[arr.length - 1];
const pickNextAfter = (sortedAsc, id) => {
  const idx = sortedAsc.findIndex((x) => String(x.id) === String(id));
  return idx >= 0 ? sortedAsc[idx + 1] || sortedAsc[idx] : sortedAsc[sortedAsc.length - 1];
};

/* ---- Download helper: create file from blob ---- */
const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

const StudentStrengthProjection = () => {
  const flags = useMemo(getRoleFlags, []);
  const canView =
    flags.isAdmin ||
    flags.isSuperadmin ||
    flags.isAccounts ||
    flags.isTeacher ||
    flags.isAdmission ||
    flags.isFrontoffice ||
    flags.isAcademicCoordinator;

  const [loading, setLoading] = useState(false);

  // dropdown data
  const [schools, setSchools] = useState([]);
  const [sessions, setSessions] = useState([]);

  // selected
  const [schoolId, setSchoolId] = useState("");
  const [fromSessionId, setFromSessionId] = useState("");
  const [toSessionId, setToSessionId] = useState("");

  // report
  const [report, setReport] = useState(null);
  const [newAdmissions, setNewAdmissions] = useState({});

  // UI
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  // auto preview
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [didAutoPreview, setDidAutoPreview] = useState(false);

  const prettySession = (id) => sessions.find((s) => String(s.id) === String(id))?.name || (id ? String(id) : "-");
  const prettySchool = (id) => schools.find((s) => String(s.id) === String(id))?.name || (id ? String(id) : "-");

  /* ---------------- Query params (FIX: backend expects new_admissions) ---------------- */
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (schoolId) params.set("school_id", schoolId);
    if (fromSessionId) params.set("from_session_id", fromSessionId);
    if (toSessionId) params.set("to_session_id", toSessionId);

    if (newAdmissions && Object.keys(newAdmissions).length) {
      params.set("new_admissions", JSON.stringify(newAdmissions));
    }
    return params.toString();
  };

  /* ---------------- Fetch dropdowns ---------------- */
  const fetchSchools = async () => {
    const { data } = await api.get("/schools");
    const arr = safeArr(data).length ? safeArr(data) : Array.isArray(data) ? data : [];
    return arr;
  };

  const fetchSessions = async () => {
    const { data } = await api.get("/sessions");
    const arr = safeArr(data).length ? safeArr(data) : Array.isArray(data) ? data : [];
    return arr;
  };

  useEffect(() => {
    if (!canView) return;

    (async () => {
      try {
        setLoading(true);
        const [sch, ses] = await Promise.all([fetchSchools(), fetchSessions()]);
        setSchools(sch);
        setSessions(ses);

        // ✅ School preselect first id
        if (sch?.length) {
          const first = pickFirstById(sch);
          if (first?.id != null) setSchoolId(String(first.id));
        }

        // ✅ Session preselect: From = latest, To = next after latest (if exists) else same
        if (ses?.length) {
          const sorted = ses.slice().sort((a, b) => nInt(a.id) - nInt(b.id));
          const latest = pickLatestById(sorted);
          const next = pickNextAfter(sorted, latest.id);

          setFromSessionId(latest?.id != null ? String(latest.id) : "");
          setToSessionId(next?.id != null ? String(next.id) : "");
        }

        setDefaultsReady(true);
      } catch (e) {
        console.error("init fetch", e);
        Swal.fire("Error", e?.response?.data?.message || "Failed to load dropdowns.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [canView]);

  /* ---------------- Preview (axios includes token) ---------------- */
  const fetchPreview = async () => {
    if (!fromSessionId || !toSessionId) {
      return Swal.fire("Required", "Please select From Session and To Session.", "warning");
    }
    try {
      setLoading(true);
      const qs = buildQueryParams();

      // If your api baseURL already includes /api, don't double it
      const base = String(api?.defaults?.baseURL || "");
      const path = base.includes("/api")
        ? `/student-strength/preview?${qs}`
        : `/api/student-strength/preview?${qs}`;

      const { data } = await api.get(path);
      setReport(data);
    } catch (e) {
      console.error("fetchPreview", e);
      Swal.fire("Error", e?.response?.data?.message || "Failed to load projection.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Auto preview when defaults are ready
  useEffect(() => {
    if (!defaultsReady) return;
    if (didAutoPreview) return;
    if (!fromSessionId || !toSessionId) return;
    setDidAutoPreview(true);
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsReady, didAutoPreview, fromSessionId, toSessionId]);

  /* ---------------- Downloads (TOKEN SAFE) ---------------- */
  const downloadFile = async (type) => {
    if (!fromSessionId || !toSessionId) {
      return Swal.fire("Required", "Please select From Session and To Session.", "warning");
    }
    try {
      setLoading(true);
      const qs = buildQueryParams();

      const base = String(api?.defaults?.baseURL || "");
      const pathRoot = base.includes("/api") ? "" : "/api";

      const url =
        type === "pdf"
          ? `${pathRoot}/student-strength/pdf?${qs}`
          : `${pathRoot}/student-strength/excel?${qs}`;

      const resp = await api.get(url, { responseType: "blob" });

      const filename =
        type === "pdf"
          ? `Student_Strength_Projection_${Date.now()}.pdf`
          : `Student_Strength_Projection_${Date.now()}.xlsx`;

      downloadBlob(resp.data, filename);
    } catch (e) {
      console.error("downloadFile", e);
      const msg =
        e?.response?.data?.message ||
        (e?.response?.status === 401 ? "Unauthorized (token missing/expired). Please login again." : "Download failed.");
      Swal.fire("Error", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Admission edit ---------------- */
  const setAdmissionForClass = (className, value) => {
    setNewAdmissions((prev) => ({
      ...prev,
      [className]: clampNonNeg(value),
    }));
  };
  const resetAdmissions = () => setNewAdmissions({});

  /* ---------------- Derived rows ---------------- */
  const rows = useMemo(() => {
    const r = report?.rows || report?.data?.rows || [];
    if (!Array.isArray(r)) return [];
    if (!search) return r;

    const q = search.toLowerCase();
    return r.filter((x) => {
      const c = String(x.class_name || x.class || "").toLowerCase();
      const b = String(x.basis || "").toLowerCase();
      return c.includes(q) || b.includes(q);
    });
  }, [report, search]);

  if (!canView) {
    return (
      <div className="container mt-4">
        <div className="card shadow-sm">
          <div className="card-body">
            <h3 className="mb-1">Next Session Projection Report</h3>
            <div className="alert alert-warning mt-3 mb-0">You don&apos;t have permission to view this report.</div>
          </div>
        </div>
      </div>
    );
  }

  const totals = report?.totals || report?.summary || {};
  const meta = report?.meta || {};

  const admissionsTotal = rows.reduce((sum, r) => {
    const className = r.class_name || r.class || "";
    const v = newAdmissions[className] ?? Number(r.new_admissions ?? 0);
    return sum + Number(v || 0);
  }, 0);

  const recomputedNextTotal = rows.reduce((sum, r) => {
    const className = r.class_name || r.class || "";
    const serverNext = Number(r.next_total ?? 0);
    const serverNew = Number(r.new_admissions ?? 0);
    const add = Number(newAdmissions[className] ?? serverNew ?? 0);
    const adjusted = serverNext - serverNew + add;
    return sum + (Number.isFinite(adjusted) ? adjusted : serverNext);
  }, 0);

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h2 className="mb-0">Next Session Projection Report</h2>
            <span className="badge bg-light text-dark border">
              School: <b>{prettySchool(schoolId)}</b>
            </span>
          </div>
          <div className="text-muted mt-1" style={{ fontSize: 13 }}>
            Current: <b>{prettySession(fromSessionId)}</b> → Next: <b>{prettySession(toSessionId)}</b>
            {!!meta?.school?.name && (
              <>
                {" "}
                | Report School: <b>{meta.school.name}</b>
              </>
            )}
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary" onClick={() => setCollapsed((s) => !s)}>
            {collapsed ? "Show Filters" : "Hide Filters"}
          </button>
          <button className="btn btn-primary" onClick={fetchPreview} disabled={loading}>
            {loading ? "Loading..." : "Preview"}
          </button>
          <button className="btn btn-outline-dark" onClick={() => downloadFile("pdf")} disabled={loading}>
            Download PDF
          </button>
          <button className="btn btn-outline-success" onClick={() => downloadFile("excel")} disabled={loading}>
            Download Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      {!collapsed && (
        <div className="card mb-3 shadow-sm">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">School</label>
                <select className="form-select" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                  {schools
                    .slice()
                    .sort((a, b) => nInt(a.id) - nInt(b.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Preselected: first school id
                </div>
              </div>

              <div className="col-md-4">
                <label className="form-label">From Session *</label>
                <select className="form-select" value={fromSessionId} onChange={(e) => setFromSessionId(e.target.value)}>
                  <option value="">Select</option>
                  {sessions
                    .slice()
                    .sort((a, b) => nInt(a.id) - nInt(b.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">To Session *</label>
                <select className="form-select" value={toSessionId} onChange={(e) => setToSessionId(e.target.value)}>
                  <option value="">Select</option>
                  {sessions
                    .slice()
                    .sort((a, b) => nInt(a.id) - nInt(b.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label">Search in report</label>
                <input
                  className="form-control"
                  placeholder="Search class / basis..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-md-6 d-flex align-items-end justify-content-end gap-2">
                <button className="btn btn-outline-secondary" onClick={resetAdmissions} disabled={loading}>
                  Clear New Admissions
                </button>
              </div>
            </div>

            {meta?.note && (
              <div className="alert alert-info mt-3 mb-0">
                <b>Note:</b> {meta.note}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="row g-3 mb-3">
        <div className="col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted" style={{ fontSize: 12 }}>
                Current Total
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtInt(totals.current_total)}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                Session: {prettySession(fromSessionId)}
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted" style={{ fontSize: 12 }}>
                Pass-out (Last Class)
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtInt(totals.pass_out)}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                Not carried forward
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm h-100 border">
            <div className="card-body">
              <div className="text-muted" style={{ fontSize: 12 }}>
                New Admissions (edited)
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{fmtInt(admissionsTotal)}</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                Used in client-side totals
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm h-100 border border-success">
            <div className="card-body">
              <div className="text-muted" style={{ fontSize: 12 }}>
                Next Session Total
              </div>
              <div style={{ fontSize: 26, fontWeight: 900 }}>
                {fmtInt(recomputedNextTotal || totals.next_total)}
              </div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                Session: {prettySession(toSessionId)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <b>Class-wise Projection</b>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Promotion logic + optional new admissions (editable)
            </div>
          </div>
          <button className="btn btn-sm btn-outline-primary" onClick={fetchPreview} disabled={loading}>
            Refresh Preview
          </button>
        </div>

        <div className="table-responsive">
          <table className="table table-striped table-hover mb-0">
            <thead>
              <tr>
                <th style={{ width: 70 }}>#</th>
                <th>Class</th>
                <th className="text-end">Current</th>
                <th className="text-end" style={{ width: 170 }}>
                  New Admissions
                </th>
                <th className="text-end">Next</th>
                <th>Basis</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                rows.map((r, idx) => {
                  const className = r.class_name || r.class || `Row ${idx + 1}`;
                  const cur = Number(r.current_total ?? r.current ?? 0);
                  const serverNext = Number(r.next_total ?? 0);
                  const serverNew = Number(r.new_admissions ?? 0);
                  const editedNew = newAdmissions[className] ?? serverNew;
                  const adjustedNext = serverNext - serverNew + Number(editedNew || 0);

                  return (
                    <tr key={`${className}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 700 }}>{className}</td>
                      <td className="text-end">{fmtInt(cur)}</td>

                      <td className="text-end">
                        <input
                          type="number"
                          min={0}
                          className="form-control form-control-sm text-end"
                          value={String(editedNew ?? 0)}
                          onChange={(e) => setAdmissionForClass(className, e.target.value)}
                          style={{ maxWidth: 140, marginLeft: "auto" }}
                        />
                      </td>

                      <td className="text-end" style={{ fontWeight: 900 }}>
                        {fmtInt(adjustedNext)}
                      </td>

                      <td className="text-muted" style={{ fontSize: 12 }}>
                        {r.basis || r.note || "—"}
                      </td>
                    </tr>
                  );
                })}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    <div style={{ fontWeight: 700 }}>No data yet</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      Defaults are selected — click <b>Preview</b> if needed.
                    </div>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan="6" className="text-center py-4">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>

            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="2" className="text-end">
                    <b>Total</b>
                  </td>
                  <td className="text-end">
                    <b>{fmtInt(totals.current_total)}</b>
                  </td>
                  <td className="text-end">
                    <b>{fmtInt(admissionsTotal)}</b>
                  </td>
                  <td className="text-end">
                    <b>{fmtInt(recomputedNextTotal || totals.next_total)}</b>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="text-muted mt-2" style={{ fontSize: 12 }}>
        Tip: If you want PDF/Excel to include edited admissions, click <b>Preview</b> once, then download.
      </div>
    </div>
  );
};

export default StudentStrengthProjection;
