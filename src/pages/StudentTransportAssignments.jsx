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

const StudentTransportAssignments = () => {
  useMemo(getRoleFlags, []); // keeps same pattern; not used directly right now

  const [students, setStudents] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [search, setSearch] = useState("");

  // ✅ Route filter to show only students of that route
  const [selectedRouteFilterId, setSelectedRouteFilterId] = useState("");

  const [loading, setLoading] = useState(false);

  // used for dialog current assignment preview
  const [activeAssignment, setActiveAssignment] = useState(null);

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

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([fetchStudents(), fetchBuses(), fetchRoutes()]);
      } catch (e) {
        console.error("Load dropdowns error:", e);
        Swal.fire("Error", "Failed to load Students/Buses/Routes.", "error");
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
    return b ? safeStr(b.bus_no) : "—";
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
    const routeObj = routes.find(
      (r) => String(r.id) === String(s?.route_id || "")
    );
    return routeObj ? formatRouteLabel(routeObj) : "—";
  };

  // class/section display
  const getClassName = (s) =>
    safeStr(s?.class_name || s?.Class?.class_name || s?.ClassName || "") || "—";

  const getSectionName = (s) =>
    safeStr(
      s?.section_name || s?.Section?.section_name || s?.SectionName || ""
    ) || "—";

  // -------------------- PROFESSIONAL DIALOG (SweetAlert2) --------------------
  const openAssignDialog = async (studentId) => {
    if (!studentId) {
      return Swal.fire("Validation", "Please select a student.", "warning");
    }

    const defaultEff = new Date().toISOString().slice(0, 10);

    // fetch current active assignment for preview + defaults
    const current = await fetchActiveAssignment(studentId, defaultEff);

    const curPickupBus = current?.pickup_bus_id ? String(current.pickup_bus_id) : "";
    const curDropBus = current?.drop_bus_id ? String(current.drop_bus_id) : "";
    const curPickupRoute = current?.pickup_route_id ? String(current.pickup_route_id) : "";
    const curDropRoute = current?.drop_route_id ? String(current.drop_route_id) : "";

    const busOptionsHtml = buses
      .filter((b) => b.active !== false)
      .map((b) => {
        const label = `${safeStr(b.bus_no)}${b.reg_no ? ` (${b.reg_no})` : ""}`;
        return `<option value="${b.id}">${label}</option>`;
      })
      .join("");

    const routeOptionsHtml = routes
      .map((r) => {
        const label = safeStr(
          r.RouteName || r.Villages || r.village || r.villages
        );
        return `<option value="${r.id}">${label}</option>`;
      })
      .join("");

    const result = await Swal.fire({
      title: "Transport Assignment",
      icon: "info",

      position: "center",
      focusConfirm: false,
      scrollbarPadding: false,

      showCancelButton: true,
      confirmButtonText: "Save Assignment",
      cancelButtonText: "Cancel",

      allowOutsideClick: false,
      allowEscapeKey: false,
      width: 760,

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
          .swal-transport-card{
            padding: 16px 16px 14px 16px !important;
            border-radius: 14px !important;
          }
          .swal-title-compact{
            font-size: 18px !important;
            margin: 6px 0 10px 0 !important;
          }
          .swal-actions-row{
            gap: 10px !important;
          }
          .ta-head{
            display:flex;
            justify-content:space-between;
            align-items:flex-start;
            gap:12px;
            padding: 10px 12px;
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 12px;
            background: rgba(0,0,0,0.03);
            margin-bottom: 12px;
            text-align:left;
          }
          .ta-student{
            font-weight: 700;
            font-size: 14px;
          }
          .ta-sub{
            font-size: 12px;
            opacity: 0.85;
            margin-top: 4px;
            line-height: 1.35;
          }
          .ta-grid{
            display:grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            text-align:left;
          }
          .ta-field label{
            display:block;
            font-size: 12px;
            font-weight: 700;
            margin: 0 0 6px 0;
          }
          .ta-field select, .ta-field input{
            width: 100%;
            height: 40px;
            border-radius: 10px;
            border: 1px solid rgba(0,0,0,0.14);
            padding: 8px 10px;
            outline: none;
          }
          .ta-field select:focus, .ta-field input:focus{
            border-color: rgba(0,0,0,0.35);
          }
          .ta-full{
            grid-column: 1 / span 2;
          }
          .ta-note{
            margin-top: 8px;
            font-size: 12px;
            opacity: 0.85;
            padding: 10px 12px;
            border-left: 4px solid rgba(25,135,84,0.55);
            background: rgba(25,135,84,0.06);
            border-radius: 10px;
          }
          .ta-pill{
            display:inline-block;
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 11px;
            background: rgba(0,0,0,0.06);
            border: 1px solid rgba(0,0,0,0.10);
            margin-left: 6px;
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
              Current assignment:
              <span class="ta-pill">Pickup: <b>${findBusNo(
                current?.pickup_bus_id
              )}</b></span>
              <span class="ta-pill">Drop: <b>${findBusNo(
                current?.drop_bus_id
              )}</b></span>
              <span class="ta-pill">From: <b>${safeStr(
                current?.effective_from || "—"
              )}</b></span>
            </div>
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
            <label>Pickup Route (optional)</label>
            <select id="sw_pickupRoute">
              <option value="">-- Select --</option>
              ${routeOptionsHtml}
            </select>
          </div>

          <div class="ta-field">
            <label>Drop Route (optional)</label>
            <select id="sw_dropRoute">
              <option value="">-- Select --</option>
              ${routeOptionsHtml}
            </select>
          </div>

          <div class="ta-field ta-full">
            <label>Effective From</label>
            <input id="sw_eff" type="date" value="${defaultEff}" />
            <div class="ta-note">
              Saving will close any existing active assignment for this student and create a new one.
            </div>
          </div>
        </div>
      `,

      didOpen: () => {
        const pb = document.getElementById("sw_pickupBus");
        const db = document.getElementById("sw_dropBus");
        const pr = document.getElementById("sw_pickupRoute");
        const dr = document.getElementById("sw_dropRoute");
        const popup = Swal.getPopup();

        // defaults from current assignment
        if (pb) pb.value = curPickupBus || "";
        if (db) db.value = curDropBus || "";
        if (pr) pr.value = curPickupRoute || "";
        if (dr) dr.value = curDropRoute || "";

        if (popup) popup.scrollTop = 0;
      },

      preConfirm: () => {
        const pb = document.getElementById("sw_pickupBus")?.value || "";
        const db = document.getElementById("sw_dropBus")?.value || "";
        const pr = document.getElementById("sw_pickupRoute")?.value || "";
        const dr = document.getElementById("sw_dropRoute")?.value || "";
        const eff = document.getElementById("sw_eff")?.value || "";

        if (!eff) {
          Swal.showValidationMessage("Please select Effective From date.");
          return false;
        }

        if (!pb && !db) {
          Swal.showValidationMessage(
            "Please select at least Pickup Bus or Drop Bus."
          );
          return false;
        }

        return { pb, db, pr, dr, eff };
      },
    });

    if (!result.isConfirmed) return;

    const { pb, db, pr, dr, eff } = result.value || {};

    const payload = {
      student_id: Number(studentId),
      pickup_bus_id: pb ? Number(pb) : null,
      drop_bus_id: db ? Number(db) : null,
      pickup_route_id: pr ? Number(pr) : null,
      drop_route_id: dr ? Number(dr) : null,
      effective_from: eff,
    };

    setLoading(true);
    try {
      const res = await api.post(
        "/student-transport-assignments/assign",
        payload
      );
      Swal.fire(
        "Saved",
        res?.data?.message || "Transport assignment saved successfully.",
        "success"
      );

      // refresh current assignment preview state
      await fetchActiveAssignment(studentId, eff);
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
  const filteredStudents = students.filter((s) => {
    const q = safeStr(search).toLowerCase();
    const name = safeStr(s?.name).toLowerCase();
    const adm = safeStr(s?.admission_number).toLowerCase();

    const textOk = !q || name.includes(q) || adm.includes(q);

    const routeOk =
      !selectedRouteFilterId ||
      String(s?.route_id || "") === String(selectedRouteFilterId);

    return textOk && routeOk;
  });

  // -------------------- UI --------------------
  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="m-0">Assign Bus to Students</h1>

        <button
          className="btn btn-outline-secondary"
          onClick={async () => {
            try {
              await Promise.all([fetchStudents(), fetchBuses(), fetchRoutes()]);
              Swal.fire("Refreshed", "Data refreshed.", "success");
            } catch (e) {
              Swal.fire("Error", "Failed to refresh data.", "error");
            }
          }}
        >
          Refresh
        </button>
      </div>

      {/* ✅ Keep only Route Filter + Search */}
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label">Filter by Route (Village — Cost)</label>
          <select
            className="form-select"
            value={selectedRouteFilterId}
            onChange={(e) => setSelectedRouteFilterId(e.target.value)}
          >
            <option value="">All Routes</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {formatRouteLabel(r)}
              </option>
            ))}
          </select>
          <small className="text-muted">
            Select route to show only students of that route.
          </small>
        </div>

        <div className="col-md-6">
          <label className="form-label">
            Search Student (Name / Admission No)
          </label>
          <input
            className="form-control"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Students table */}
      <div className="card p-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h5 className="m-0">Students (Filtered)</h5>
          <small className="text-muted">
            Showing: <b>{filteredStudents.length}</b> / {students.length}
          </small>
        </div>

        <div className="table-responsive">
          <table className="table table-striped m-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Admission No</th>
                <th>Class</th>
                <th>Section</th>
                <th>Route</th>
                <th>Assign</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.slice(0, 30).map((s, idx) => (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td>{safeStr(s?.name)}</td>
                  <td>{safeStr(s?.admission_number) || "—"}</td>
                  <td>{getClassName(s)}</td>
                  <td>{getSectionName(s)}</td>
                  <td>{formatStudentRoute(s)}</td>

                  <td>
                    <button
                      className="btn btn-sm btn-primary"
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
                  <td colSpan="7" className="text-center">
                    No students found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredStudents.length > 30 && (
          <div className="text-muted mt-2">
            Showing first 30 results. Use search or route filter to narrow down.
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentTransportAssignments;
