// File: src/pages/TransportAttendanceReport.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Transportation.css";

/* ---------------- role helpers ---------------- */
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
    isTransport: roles.includes("transport") || roles.includes("transport_admin"),
    canView:
      roles.includes("admin") ||
      roles.includes("superadmin") ||
      roles.includes("transport") ||
      roles.includes("transport_admin"),
  };
};

/* ---------------- helpers ---------------- */
const safeStr = (v) => String(v ?? "").trim();
const lower = (v) => safeStr(v).toLowerCase();

const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  return d.rows || d.items || d.data || d.buses || [];
};

const badge = (txt, kind = "secondary") => (
  <span className={`badge text-bg-${kind} rounded-pill`}>{txt}</span>
);

const fmtDate = (d) => safeStr(d);

const todayYYYYMMDD = () => {
  const dt = new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

const modalCss = `
  <style>
    .swal2-popup.attModal { padding: 12px 12px 10px; }
    .swal2-popup.attModal .swal2-title { font-size: 18px; margin: 6px 0 10px; }
    .swal2-popup.attModal .swal2-html-container { margin: 0; }
    .attModal .box { max-height: 75vh; overflow:auto; padding-right:4px; text-align:left; }
    .attModal .topRow{
      display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;
      margin-bottom:10px;
    }
    .attModal .meta{
      display:flex; flex-wrap:wrap; gap:8px; align-items:center;
      font-size:12px; opacity:.85;
    }
    .attModal .table { margin:0; }
    .attModal .smallMuted{ font-size:12px; opacity:.75; }
    .attModal .chip{
      display:inline-flex; align-items:center; gap:6px;
      padding:4px 10px; border-radius:999px; border:1px solid rgba(0,0,0,.12);
      font-size:12px;
    }
    .attModal .grid2{
      display:grid; grid-template-columns: 1fr 1fr; gap:10px;
      margin:10px 0;
    }
    .attModal .grid2 .full{ grid-column:1/-1; }
    @media (max-width: 576px){
      .attModal .grid2{ grid-template-columns: 1fr; }
      .swal2-popup.attModal{ width: 96% !important; }
    }
  </style>
`;

const statusToBadgeHtml = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "present") return `<span class="badge text-bg-success rounded-pill">Present</span>`;
  if (v === "absent") return `<span class="badge text-bg-danger rounded-pill">Absent</span>`;
  if (v === "leave") return `<span class="badge text-bg-warning rounded-pill">Leave</span>`;
  return `<span class="badge text-bg-secondary rounded-pill">${safeStr(s) || "—"}</span>`;
};

const TransportAttendanceReport = () => {
  const { canView } = useMemo(getRoleFlags, []);
  const [loading, setLoading] = useState({ list: false, details: false });
  const [error, setError] = useState("");

  // Filters
  const [from, setFrom] = useState(todayYYYYMMDD());
  const [to, setTo] = useState(todayYYYYMMDD());
  const [tripType, setTripType] = useState(""); // "" | pickup | drop
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState([]); // summary-all rows

  const normalizedRange = () => {
    const f = safeStr(from);
    const t = safeStr(to);
    if (!f || !t) return { from: f, to: t };
    if (f <= t) return { from: f, to: t };
    return { from: t, to: f }; // swap if inverted
  };

  const fetchSummary = async () => {
    if (!canView) return Swal.fire("Forbidden", "Access denied.", "warning");

    const range = normalizedRange();

    setLoading((s) => ({ ...s, list: true }));
    try {
      const params = { from: range.from, to: range.to };
      if (tripType) params.trip_type = tripType;

      const res = await api.get("/transport-attendance/bus-summary-all", { params });
      const list = asArray(res.data?.data ?? res.data);
      setRows(Array.isArray(list) ? list : []);
      setError("");
    } catch (e) {
      console.error("fetchSummary error:", e);
      setRows([]);
      setError(e?.response?.data?.message || e?.response?.data?.error || "Failed to load bus summary.");
      Swal.fire("Error", "Failed to load bus summary.", "error");
    } finally {
      setLoading((s) => ({ ...s, list: false }));
    }
  };

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = lower(search);
    const list = Array.isArray(rows) ? rows : [];

    const out = list.filter((r) => {
      if (!s) return true;
      const b = r?.bus || {};
      const busNo = lower(b?.bus_no);
      const regNo = lower(b?.reg_no);
      const idStr = String(r?.bus_id ?? "");

      // backend now returns: bus.driver, bus.conductor (from Bus model associations)
      const dr = lower(b?.driver?.name || b?.driver?.username || "");
      const co = lower(b?.conductor?.name || b?.conductor?.username || "");

      return busNo.includes(s) || regNo.includes(s) || idStr.includes(s) || dr.includes(s) || co.includes(s);
    });

    out.sort((a, b) => (Number(a?.bus_id) || 0) - (Number(b?.bus_id) || 0));
    return out;
  }, [rows, search]);

  const stats = useMemo(() => {
    const total = rows.length;
    const totalMarked = rows.reduce((sum, r) => sum + Number(r?.marked_total || 0), 0);
    const totalPresent = rows.reduce((sum, r) => sum + Number(r?.present_count || 0), 0);
    const totalAbsent = rows.reduce((sum, r) => sum + Number(r?.absent_count || 0), 0);
    const totalLeave = rows.reduce((sum, r) => sum + Number(r?.leave_count || 0), 0);
    return { total, totalMarked, totalPresent, totalAbsent, totalLeave };
  }, [rows]);

  const busy = loading.list || loading.details;

  const staffLine = (u) => {
    if (!u) return <span className="text-muted">—</span>;
    const name = safeStr(u?.name) || safeStr(u?.username) || `User ${u?.id}`;
    return (
      <div className="d-flex flex-column gap-1">
        <div className="fw-semibold">{name}</div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {badge(`ID: ${u?.id}`, "dark")}
          {u?.status ? badge(`Status: ${u.status}`, "secondary") : null}
        </div>
      </div>
    );
  };

  const tripLabel = (t) => {
    const v = lower(t);
    if (v === "pickup") return badge("Pickup", "primary");
    if (v === "drop") return badge("Drop", "warning");
    return badge("All", "secondary");
  };
const openDetailsModal = async ({ bus_id, bus }) => {
  if (!canView) return Swal.fire("Forbidden", "Access denied.", "warning");

  const range = normalizedRange();
  const title = `${safeStr(bus?.bus_no) || "Bus"} — Attendance Details`;

  Swal.fire({
    title,
    width: 980,
    customClass: { popup: "attModal" },
    html: `
      ${modalCss}
      <div class="box">
        <div class="smallMuted">Loading details…</div>
      </div>
    `,
    showCloseButton: true,
    showConfirmButton: false,
    allowOutsideClick: true,
    allowEscapeKey: true,
  });

  setLoading((s) => ({ ...s, details: true }));

  const statusToBadgeHtml = (s) => {
    const v = String(s || "").toLowerCase();
    if (v === "present") return `<span class="badge text-bg-success rounded-pill">Present</span>`;
    if (v === "absent") return `<span class="badge text-bg-danger rounded-pill">Absent</span>`;
    if (v === "leave") return `<span class="badge text-bg-warning rounded-pill">Leave</span>`;
    return `<span class="badge text-bg-secondary rounded-pill">${safeStr(s) || "—"}</span>`;
  };

  try {
    // 1) Get bus + staff + summary (your current API)
    const detailsRes = await api.get("/transport-attendance/bus-details", {
      params: {
        bus_id,
        from: range.from,
        to: range.to,
        ...(tripType ? { trip_type: tripType } : {}),
      },
    });
    const details = detailsRes?.data || {};
    const busInfo = details?.bus || bus || {};
    const summary = Array.isArray(details?.summary) ? details.summary : [];

    // 2) Get student-wise rows from bus-summary
    const summaryRes = await api.get("/transport-attendance/bus-summary", {
      params: {
        bus_id,
        from: range.from,
        to: range.to,
        ...(tripType ? { trip_type: tripType } : {}),
      },
    });
    const listPayload = summaryRes?.data || {};
    const data = Array.isArray(listPayload?.data) ? listPayload.data : [];

    const renderRowsHtml = (rowsList) =>
      rowsList
        .map((r, idx) => {
          const st = r?.student || {};
          const cls = st?.Class?.class_name || "";
          const sec = st?.Section?.section_name || "";
          const classText = [cls, sec].filter(Boolean).join(" - ");

          const markedBy =
            safeStr(r?.markedBy?.name) ||
            safeStr(r?.markedBy?.username) ||
            safeStr(r?.marked_by_user_id) ||
            "";

          const markedAt = r?.marked_at ? safeStr(r?.marked_at) : "";

          return `
            <tr>
              <td class="text-muted">${idx + 1}</td>
              <td>
                <div style="font-weight:600;">${safeStr(st?.name) || "—"}</div>
                <div class="smallMuted">Adm: ${safeStr(st?.admission_number) || "—"} · ID: ${st?.id ?? "—"}</div>
                ${classText ? `<div class="smallMuted">${classText}</div>` : ""}
              </td>
              <td>${safeStr(r?.trip_type) || "—"}</td>
              <td>${safeStr(r?.attendance_date) || "—"}</td>
              <td>${safeStr(r?.notes) || "—"}</td>
              <td>${markedBy ? `<div style="font-weight:600;">${markedBy}</div>` : "—"}${
            markedAt ? `<div class="smallMuted">${markedAt}</div>` : ""
          }</td>
              <td>${statusToBadgeHtml(r?.status)}</td>
            </tr>
          `;
        })
        .join("");

    const busNo = safeStr(busInfo?.bus_no) || "—";
    const regNo = safeStr(busInfo?.reg_no) || "";

    // ⚠️ Your busDetails uses aliases: driver, conductor
    const driver = busInfo?.driver || null;
    const conductor = busInfo?.conductor || null;

    const driverName = driver ? safeStr(driver?.name) || safeStr(driver?.username) || `User ${driver?.id}` : "—";
    const conductorName =
      conductor ? safeStr(conductor?.name) || safeStr(conductor?.username) || `User ${conductor?.id}` : "—";

    const summaryHtml =
      summary.length > 0
        ? summary
            .map(
              (s) => `
              <div class="d-flex flex-wrap gap-2 align-items-center">
                <span class="badge text-bg-dark rounded-pill">${safeStr(s.trip_type || details?.trip_type || "trip")}</span>
                <span class="badge text-bg-info rounded-pill">Marked: ${Number(s.marked_total || 0)}</span>
                <span class="badge text-bg-success rounded-pill">Present: ${Number(s.present_count || 0)}</span>
                <span class="badge text-bg-danger rounded-pill">Absent: ${Number(s.absent_count || 0)}</span>
                <span class="badge text-bg-warning rounded-pill">Leave: ${Number(s.leave_count || 0)}</span>
              </div>
            `
            )
            .join("")
        : `<div class="text-muted smallMuted">No summary found for selected filter.</div>`;

    const html = `
      ${modalCss}
      <div class="box">
        <div class="topRow">
          <div>
            <div style="font-weight:700;font-size:14px;">${busNo}${regNo ? ` · ${regNo}` : ""}</div>
            <div class="meta">
              <span class="chip"><b>From:</b> ${fmtDate(range.from)}</span>
              <span class="chip"><b>To:</b> ${fmtDate(range.to)}</span>
              <span class="chip"><b>Trip:</b> ${tripType ? safeStr(tripType) : "All"}</span>
            </div>
          </div>
        </div>

        <div class="grid2">
          <div class="full"><div class="smallMuted">Current Bus Staff (from Bus table)</div></div>

          <div>
            <div style="font-weight:600;">Driver</div>
            <div class="smallMuted">${driverName}${driver?.id ? ` (ID: ${driver.id})` : ""}</div>
          </div>

          <div>
            <div style="font-weight:600;">Conductor</div>
            <div class="smallMuted">${conductorName}${conductor?.id ? ` (ID: ${conductor.id})` : ""}</div>
          </div>

          <div class="full">${summaryHtml}</div>
        </div>

        <div class="d-flex align-items-center gap-2 mb-2">
          <div class="smallMuted">Filter:</div>
          <select id="modal_status" class="form-select form-select-sm" style="max-width:220px;">
            <option value="">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="leave">Leave</option>
          </select>
          <input id="modal_search" class="form-control form-control-sm" style="max-width:320px;" placeholder="Search student name / admission…" />
        </div>

        <div class="table-responsive">
          <table class="table table-striped align-middle">
            <thead>
              <tr>
                <th style="width:60px;">#</th>
                <th style="min-width:260px;">Student</th>
                <th>Trip</th>
                <th>Date</th>
                <th style="min-width:180px;">Notes</th>
                <th style="min-width:180px;">Marked By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="modal_tbody">
              ${
                data.length
                  ? renderRowsHtml(data)
                  : `<tr><td colspan="7" class="text-center text-muted py-4">No records</td></tr>`
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    Swal.update({ html });

    // filter in modal
    setTimeout(() => {
      const statusEl = document.getElementById("modal_status");
      const searchEl = document.getElementById("modal_search");
      const bodyEl = document.getElementById("modal_tbody");
      if (!statusEl || !searchEl || !bodyEl) return;

      const apply = () => {
        const st = lower(statusEl.value);
        const q = lower(searchEl.value);

        const filteredRows = data.filter((r) => {
          if (st && lower(r?.status) !== st) return false;
          if (!q) return true;
          const stu = r?.student || {};
          return lower(stu?.name).includes(q) || lower(stu?.admission_number).includes(q);
        });

        bodyEl.innerHTML = filteredRows.length
          ? renderRowsHtml(filteredRows)
          : `<tr><td colspan="7" class="text-center text-muted py-4">No match</td></tr>`;
      };

      statusEl.addEventListener("change", apply);
      searchEl.addEventListener("input", apply);
    }, 50);
  } catch (e) {
    console.error("openDetailsModal error:", e);
    Swal.update({
      html: `
        ${modalCss}
        <div class="box">
          <div class="alert alert-danger">Failed to load details.</div>
        </div>
      `,
    });
  } finally {
    setLoading((s) => ({ ...s, details: false }));
  }
};


  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h1 className="m-0">Transport Attendance Report</h1>
          <div className="text-muted" style={{ marginTop: 4 }}>
            Bus-wise summary + details (present/absent/leave) with driver/conductor.
          </div>

          <div className="d-flex flex-wrap gap-2 mt-2">
            {badge(`Rows: ${stats.total}`, "dark")}
            {badge(`Marked: ${stats.totalMarked}`, "info")}
            {badge(`Present: ${stats.totalPresent}`, "success")}
            {badge(`Absent: ${stats.totalAbsent}`, "danger")}
            {badge(`Leave: ${stats.totalLeave}`, "warning")}
            {tripLabel(tripType)}
            {busy ? badge("Updating…", "info") : badge("Live", "success")}
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary" onClick={fetchSummary} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-octagon-fill fs-5"></i>
          <div className="flex-grow-1">
            <div className="fw-semibold">Something went wrong</div>
            <div className="small">{error}</div>
          </div>
          <button className="btn btn-sm btn-light border" onClick={fetchSummary}>
            Try again
          </button>
        </div>
      ) : null}

      {/* Filters row */}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <label className="small text-muted">From</label>
          <input
            type="date"
            className="form-control"
            style={{ maxWidth: 180 }}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        <div className="d-flex align-items-center gap-2">
          <label className="small text-muted">To</label>
          <input
            type="date"
            className="form-control"
            style={{ maxWidth: 180 }}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={tripType}
          onChange={(e) => setTripType(e.target.value)}
        >
          <option value="">All Trips</option>
          <option value="pickup">Pickup</option>
          <option value="drop">Drop</option>
        </select>

        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 360 }}
          placeholder="Search bus no/reg, driver, conductor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button className="btn btn-primary ms-auto" onClick={fetchSummary} disabled={busy || !canView}>
          Apply
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th style={{ minWidth: 220 }}>Bus</th>
              <th style={{ minWidth: 240 }}>Driver</th>
              <th style={{ minWidth: 240 }}>Conductor</th>
              <th>Marked</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Leave</th>
              <th style={{ minWidth: 140 }}>Trip</th>
              <th style={{ minWidth: 140 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading.list && (
              <tr>
                <td colSpan="10" className="text-center py-4 text-muted">
                  Loading…
                </td>
              </tr>
            )}

            {!loading.list &&
              filtered.map((r, idx) => {
                const b = r?.bus || {};
                const busNo = safeStr(b?.bus_no) || "—";
                const regNo = safeStr(b?.reg_no);

                return (
                  <tr key={`${r.bus_id}-${r.trip_type || "all"}`}>
                    <td className="text-muted">{idx + 1}</td>

                    <td>
                      <div className="fw-semibold">
                        {busNo} {regNo ? <span className="text-muted">· {regNo}</span> : null}
                      </div>
                      <div className="small text-muted">Bus ID: {r?.bus_id ?? "—"}</div>
                    </td>

                    <td>{staffLine(b?.driver)}</td>
                    <td>{staffLine(b?.conductor)}</td>

                    <td>{badge(Number(r?.marked_total || 0), "info")}</td>
                    <td>{badge(Number(r?.present_count || 0), "success")}</td>
                    <td>{badge(Number(r?.absent_count || 0), "danger")}</td>
                    <td>{badge(Number(r?.leave_count || 0), "warning")}</td>

                    <td>{tripLabel(r?.trip_type)}</td>

                    <td>
                      <button
                        className="btn btn-outline-primary btn-sm"
                        disabled={!canView || busy}
                        onClick={() => openDetailsModal({ bus_id: r.bus_id, bus: b })}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}

            {!loading.list && filtered.length === 0 && (
              <tr>
                <td colSpan="10" className="text-center text-muted py-4">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bootstrap Icons */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" />
    </div>
  );
};

export default TransportAttendanceReport;
