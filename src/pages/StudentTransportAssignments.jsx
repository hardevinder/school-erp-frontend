// src/pages/StudentTransportAssignments.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Transportation.css";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isAccounts: roles.includes("accounts"),
    isTransport: roles.includes("transport"),
  };
};

const safeStr = (v) => String(v ?? "").trim();

const fmtYYYYMMDD = (d = new Date()) => {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const StudentTransportAssignments = () => {
  useMemo(getRoleFlags, []); // keep pattern

  const [students, setStudents] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedRouteFilterId, setSelectedRouteFilterId] = useState("");

  const [loading, setLoading] = useState(false);

  // used for dialog current assignment preview
  const [activeAssignment, setActiveAssignment] = useState(null);

  // compact paging
  const [visibleCount, setVisibleCount] = useState(40);

  // -------------------- Load dropdown data --------------------
  const fetchStudents = async () => {
    const res = await api.get("/students");
    const list = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.students)
      ? res.data.students
      : [];
    setStudents(list);
  };

  const fetchBuses = async () => {
    const res = await api.get("/buses");
    setBuses(Array.isArray(res.data) ? res.data : []);
  };

  const fetchRoutes = async () => {
    const res = await api.get("/transportations");
    setRoutes(Array.isArray(res.data) ? res.data : []);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStudents(), fetchBuses(), fetchRoutes()]);
      Swal.fire("Refreshed", "Data refreshed.", "success");
    } catch (e) {
      console.error("Refresh error:", e);
      Swal.fire("Error", "Failed to refresh data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchStudents(), fetchBuses(), fetchRoutes()]);
      } catch (e) {
        console.error("Load dropdowns error:", e);
        Swal.fire("Error", "Failed to load Students/Buses/Routes.", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // -------------------- Active assignment fetch --------------------
  const fetchActiveAssignment = async (studentId, dateStr) => {
    if (!studentId) {
      setActiveAssignment(null);
      return null;
    }
    try {
      const res = await api.get(
        `/student-transport-assignments/student/${studentId}/active`,
        { params: { date: dateStr } }
      );
      const data = res.data || null;
      setActiveAssignment(data);
      return data;
    } catch (e) {
      setActiveAssignment(null);
      return null;
    }
  };

  // -------------------- helpers: names/labels --------------------
  const findBusNo = (id) => {
    const b = buses.find((x) => String(x.id) === String(id));
    if (!b) return "—";
    const label = `${safeStr(b.bus_no)}${b.reg_no ? ` (${safeStr(b.reg_no)})` : ""}`;
    return label || "—";
  };

  const getStudentLabel = (studentId) => {
    const s = students.find((x) => String(x.id) === String(studentId));
    if (!s) return `ID: ${safeStr(studentId) || "—"}`;
    const nm = safeStr(s?.name) || "—";
    const adm = safeStr(s?.admission_number);
    return `${nm}${adm ? ` (${adm})` : ""}`;
  };

  const formatRouteLabel = (r) => {
    if (!r) return "—";
    const name = safeStr(r.Villages || r.RouteName || r.village || r.villages);
    const cost = r.Cost ?? r.cost;
    if (name && cost != null && String(cost).trim() !== "")
      return `${name} — ₹${cost}`;
    if (name) return name;
    if (cost != null && String(cost).trim() !== "") return `₹${cost}`;
    return "—";
  };

  const formatStudentRoute = (s) => {
    // Prefer API-provided route_name/route_cost if present
    if (s?.route_name) {
      return `${safeStr(s.route_name)}${
        s.route_cost != null && String(s.route_cost).trim() !== ""
          ? ` — ₹${s.route_cost}`
          : ""
      }`;
    }
    // fallback to lookup by route_id
    const routeObj = routes.find((r) => String(r.id) === String(s?.route_id || ""));
    return routeObj ? formatRouteLabel(routeObj) : "—";
  };

  const getClassName = (s) =>
    safeStr(s?.class_name || s?.Class?.class_name || s?.ClassName || "") || "—";

  const getSectionName = (s) =>
    safeStr(s?.section_name || s?.Section?.section_name || s?.SectionName || "") ||
    "—";

  // -------------------- Assignment modal (SweetAlert2) --------------------
  const openAssignDialog = async (studentId) => {
    if (!studentId) {
      return Swal.fire("Validation", "Please select a student.", "warning");
    }

    const defaultDate = fmtYYYYMMDD(new Date());

    // fetch current active assignment for preview + defaults
    const current = await fetchActiveAssignment(studentId, defaultDate);

    const curPickupBus = current?.pickup_bus_id ? String(current.pickup_bus_id) : "";
    const curDropBus = current?.drop_bus_id ? String(current.drop_bus_id) : "";

    const busOptionsHtml = buses
      .filter((b) => b.active !== false)
      .map((b) => {
        const label = `${safeStr(b.bus_no)}${b.reg_no ? ` (${safeStr(b.reg_no)})` : ""}`;
        return `<option value="${b.id}">${label}</option>`;
      })
      .join("");

    const result = await Swal.fire({
      title: "Assign Pickup / Drop Bus",
      icon: "info",
      position: "center",
      focusConfirm: false,
      scrollbarPadding: false,
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
      width: 820,

      willOpen: () => {
        document.body.style.overflow = "hidden";
      },
      willClose: () => {
        document.body.style.overflow = "";
      },

      customClass: {
        title: "swal-title-compact",
        popup: "swal-transport-card",
        confirmButton: "btn btn-success",
        cancelButton: "btn btn-outline-secondary",
        actions: "swal-actions-row",
      },
      buttonsStyling: false,

      html: `
        <style>
          .swal-transport-card{ padding: 14px 14px 12px 14px !important; border-radius: 16px !important; }
          .swal-title-compact{ font-size: 18px !important; margin: 6px 0 10px 0 !important; }
          .swal-actions-row{ gap: 10px !important; }
          .ta-head{
            display:flex; justify-content:space-between; align-items:flex-start; gap:12px;
            padding: 10px 12px; border: 1px solid rgba(0,0,0,0.08);
            border-radius: 14px; background: rgba(0,0,0,0.03); margin-bottom: 12px; text-align:left;
          }
          .ta-student{ font-weight: 800; font-size: 14px; }
          .ta-sub{ font-size: 12px; opacity: 0.85; margin-top: 4px; line-height: 1.35; }
          .ta-pill{
            display:inline-flex; align-items:center; gap:6px;
            padding: 4px 10px; border-radius: 999px; font-size: 11px;
            background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.10);
            margin-right: 6px; margin-top: 6px;
          }
          .ta-grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 12px; text-align:left; }
          .ta-field label{ display:block; font-size: 12px; font-weight: 800; margin: 0 0 6px 0; }
          .ta-field select, .ta-field input{
            width: 100%; height: 40px; border-radius: 12px;
            border: 1px solid rgba(0,0,0,0.14); padding: 8px 10px; outline: none;
          }
          .ta-field select:focus, .ta-field input:focus{ border-color: rgba(0,0,0,0.35); }
          .ta-full{ grid-column: 1 / span 2; }
          .ta-note{
            margin-top: 8px; font-size: 12px; opacity: 0.9;
            padding: 10px 12px; border-left: 4px solid rgba(25,135,84,0.55);
            background: rgba(25,135,84,0.06); border-radius: 12px;
          }
          .ta-mini{
            font-size: 12px; opacity: 0.85; margin-top: 4px;
          }
          @media (max-width: 620px){
            .ta-grid{ grid-template-columns: 1fr; }
            .ta-full{ grid-column: auto; }
          }
        </style>

        <div class="ta-head">
          <div>
            <div class="ta-student">${safeStr(getStudentLabel(studentId))}</div>
            <div class="ta-sub">
              <span class="ta-pill">Pickup: <b>${findBusNo(current?.pickup_bus_id)}</b></span>
              <span class="ta-pill">Drop: <b>${findBusNo(current?.drop_bus_id)}</b></span>
              <span class="ta-pill">Start: <b>${safeStr(current?.start_date || "—")}</b></span>
              <span class="ta-pill">Status: <b>${safeStr(current?.status || "—")}</b></span>
            </div>
            <div class="ta-mini">Saving will close existing active assignment and create a new one.</div>
          </div>
        </div>

        <div class="ta-grid">
          <div class="ta-field">
            <label>Pickup Bus</label>
            <select id="sw_pickupBus">
              <option value="">-- Select --</option>
              ${busOptionsHtml}
            </select>
          </div>

          <div class="ta-field">
            <label>Drop Bus</label>
            <select id="sw_dropBus">
              <option value="">-- Select --</option>
              ${busOptionsHtml}
            </select>
          </div>

          <div class="ta-field">
            <label>Pickup Stop (optional)</label>
            <input id="sw_pickupStop" type="text" placeholder="e.g. Main Gate" />
          </div>

          <div class="ta-field">
            <label>Drop Stop (optional)</label>
            <input id="sw_dropStop" type="text" placeholder="e.g. Bus Stand" />
          </div>

          <div class="ta-field ta-full">
            <label>Start Date</label>
            <input id="sw_start" type="date" value="${defaultDate}" />
            <div class="ta-note">
              Tip: If student changes bus from a date, choose that date. System will auto-close previous record.
            </div>
          </div>
        </div>
      `,

      didOpen: () => {
        const pb = document.getElementById("sw_pickupBus");
        const db = document.getElementById("sw_dropBus");
        const ps = document.getElementById("sw_pickupStop");
        const ds = document.getElementById("sw_dropStop");

        // defaults from current assignment
        if (pb) pb.value = curPickupBus || "";
        if (db) db.value = curDropBus || "";

        // show current stops if present
        if (ps && current?.pickup_stop) ps.value = safeStr(current.pickup_stop);
        if (ds && current?.drop_stop) ds.value = safeStr(current.drop_stop);

        const popup = Swal.getPopup();
        if (popup) popup.scrollTop = 0;
      },

      preConfirm: () => {
        const pb = document.getElementById("sw_pickupBus")?.value || "";
        const db = document.getElementById("sw_dropBus")?.value || "";
        const ps = document.getElementById("sw_pickupStop")?.value || "";
        const ds = document.getElementById("sw_dropStop")?.value || "";
        const start = document.getElementById("sw_start")?.value || "";

        if (!start) {
          Swal.showValidationMessage("Please select Start Date.");
          return false;
        }

        if (!pb && !db) {
          Swal.showValidationMessage("Please select at least Pickup Bus or Drop Bus.");
          return false;
        }

        return { pb, db, ps, ds, start };
      },
    });

    if (!result.isConfirmed) return;

    const { pb, db, ps, ds, start } = result.value || {};

    // ✅ NEW controller expects start_date (or assign_date)
    const payload = {
      student_id: Number(studentId),
      pickup_bus_id: pb ? Number(pb) : null,
      drop_bus_id: db ? Number(db) : null,
      pickup_stop: safeStr(ps) || null,
      drop_stop: safeStr(ds) || null,
      start_date: start,
    };

    setLoading(true);
    try {
      const res = await api.post("/student-transport-assignments/assign", payload);
      Swal.fire("Saved", res?.data?.message || "Bus assigned successfully.", "success");

      // refresh current assignment preview state
      await fetchActiveAssignment(studentId, start);
    } catch (e) {
      console.error("Assign error:", e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.response?.data?.details ||
        "Failed to save transport assignment.";
      Swal.fire("Error", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Search helpers --------------------
  const filteredStudents = useMemo(() => {
    const q = safeStr(search).toLowerCase();

    return students.filter((s) => {
      const name = safeStr(s?.name).toLowerCase();
      const adm = safeStr(s?.admission_number).toLowerCase();

      const textOk = !q || name.includes(q) || adm.includes(q);

      const routeOk =
        !selectedRouteFilterId ||
        String(s?.route_id || "") === String(selectedRouteFilterId);

      return textOk && routeOk;
    });
  }, [students, search, selectedRouteFilterId]);

  const visibleStudents = filteredStudents.slice(0, visibleCount);

  // -------------------- UI --------------------
  return (
    <div className="container-fluid mt-3">
      <style>{`
        /* Compact, modern table feel (Excel-like) */
        .sta-toolbar{
          position: sticky;
          top: 0;
          z-index: 5;
          background: #fff;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          padding: 10px 0;
          margin-bottom: 12px;
        }
        .sta-title{
          font-weight: 800;
          letter-spacing: 0.2px;
        }
        .sta-subtitle{
          font-size: 12px;
          opacity: 0.75;
          margin-top: 2px;
        }
        .sta-card{
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.04);
        }
        .sta-filter label{
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .sta-filter .form-select,
        .sta-filter .form-control{
          height: 38px;
          border-radius: 12px;
        }
        .sta-table thead th{
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .sta-table tbody td{
          font-size: 13px;
          padding-top: 8px;
          padding-bottom: 8px;
          vertical-align: middle;
        }
        .sta-row:hover{
          background: rgba(0,0,0,0.03);
        }
        .sta-pill{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding: 2px 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.12);
          background: rgba(0,0,0,0.04);
          font-size: 12px;
          white-space: nowrap;
        }
        .sta-btn{
          border-radius: 10px;
          padding: 6px 10px;
          font-weight: 700;
          font-size: 12px;
        }
        .sta-loading{
          position: fixed;
          inset: 0;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .sta-loading .box{
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.10);
          font-weight: 800;
        }
      `}</style>

      {loading && (
        <div className="sta-loading">
          <div className="box">Loading…</div>
        </div>
      )}

      {/* Sticky header / toolbar */}
      <div className="sta-toolbar">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <div className="sta-title h4 m-0">Assign Bus to Students</div>
            <div className="sta-subtitle">
              Quick assign pickup/drop bus. Previous active record auto-closes.
            </div>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary sta-btn" onClick={refreshAll} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="row g-2 mt-2 sta-filter">
          <div className="col-md-6">
            <label className="form-label">Filter by Route (Village — Cost)</label>
            <select
              className="form-select"
              value={selectedRouteFilterId}
              onChange={(e) => {
                setSelectedRouteFilterId(e.target.value);
                setVisibleCount(40);
              }}
            >
              <option value="">All Routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatRouteLabel(r)}
                </option>
              ))}
            </select>
            <div className="text-muted" style={{ fontSize: 12 }}>
              Select route to show only students of that route.
            </div>
          </div>

          <div className="col-md-6">
            <label className="form-label">Search Student (Name / Admission No)</label>
            <input
              className="form-control"
              placeholder="Type name or admission no..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisibleCount(40);
              }}
            />
          </div>
        </div>
      </div>

      {/* Students table */}
      <div className="sta-card p-2 p-md-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <div className="h6 m-0" style={{ fontWeight: 800 }}>
              Students
            </div>
            <span className="sta-pill">
              Showing <b>{visibleStudents.length}</b> / {filteredStudents.length}
              <span style={{ opacity: 0.7 }}>/ {students.length}</span>
            </span>
          </div>

          {filteredStudents.length > visibleCount && (
            <button
              className="btn btn-outline-primary sta-btn"
              onClick={() => setVisibleCount((v) => v + 40)}
              disabled={loading}
            >
              Show more
            </button>
          )}
        </div>

        <div className="table-responsive">
          <table className="table table-striped m-0 sta-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Name</th>
                <th style={{ width: 150 }}>Admission</th>
                <th style={{ width: 120 }}>Class</th>
                <th style={{ width: 90 }}>Sec</th>
                <th>Route</th>
                <th style={{ width: 120 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((s, idx) => (
                <tr key={s.id} className="sta-row">
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 700 }}>{safeStr(s?.name)}</td>
                  <td>{safeStr(s?.admission_number) || "—"}</td>
                  <td>{getClassName(s)}</td>
                  <td>{getSectionName(s)}</td>
                  <td style={{ minWidth: 220 }}>{formatStudentRoute(s)}</td>
                  <td>
                    <button
                      className="btn btn-primary sta-btn"
                      disabled={loading}
                      onClick={() => openAssignDialog(String(s.id))}
                    >
                      Assign
                    </button>
                  </td>
                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan="7" className="text-center text-muted" style={{ padding: 20 }}>
                    No students found. Try clearing search / route filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredStudents.length > visibleCount && (
          <div className="text-muted mt-2" style={{ fontSize: 12 }}>
            Showing {visibleCount} results. Click <b>Show more</b> to load next.
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentTransportAssignments;
