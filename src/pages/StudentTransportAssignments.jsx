// src/pages/StudentTransportAssignments.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [pickupBusId, setPickupBusId] = useState("");
  const [dropBusId, setDropBusId] = useState("");
  const [pickupRouteId, setPickupRouteId] = useState("");
  const [dropRouteId, setDropRouteId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [loading, setLoading] = useState(false);

  // Optional: show current assignment in form header
  const [activeAssignment, setActiveAssignment] = useState(null);

  const studentSelectRef = useRef(null);

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
  const fetchActiveAssignment = async (studentId) => {
    if (!studentId) {
      setActiveAssignment(null);
      return;
    }
    try {
      const res = await api.get(
        `/student-transport-assignments/student/${studentId}/active`,
        { params: { date: effectiveFrom } }
      );
      setActiveAssignment(res.data || null);
    } catch (e) {
      setActiveAssignment(null);
    }
  };

  useEffect(() => {
    if (selectedStudentId) fetchActiveAssignment(selectedStudentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, effectiveFrom]);

  // ✅ If route filter changes and selected student is not in filtered list, reset selection
  useEffect(() => {
    if (!selectedStudentId) return;
    const stillVisible = students.some((s) => {
      if (!selectedRouteFilterId)
        return String(s.id) === String(selectedStudentId);
      return (
        String(s.id) === String(selectedStudentId) &&
        String(s?.route_id || "") === String(selectedRouteFilterId)
      );
    });
    if (!stillVisible) {
      setSelectedStudentId("");
      setActiveAssignment(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouteFilterId]);

  // -------------------- Assign action --------------------
  const handleAssign = async () => {
    if (!selectedStudentId) {
      return Swal.fire("Validation", "Please select a student.", "warning");
    }
    if (!effectiveFrom) {
      return Swal.fire(
        "Validation",
        "Please select Effective From date.",
        "warning"
      );
    }

    const payload = {
      student_id: Number(selectedStudentId),
      pickup_bus_id: pickupBusId ? Number(pickupBusId) : null,
      drop_bus_id: dropBusId ? Number(dropBusId) : null,
      pickup_route_id: pickupRouteId ? Number(pickupRouteId) : null,
      drop_route_id: dropRouteId ? Number(dropRouteId) : null,
      effective_from: effectiveFrom,
    };

    const ok = await Swal.fire({
      title: "Assign Transport?",
      html: `
        <div style="text-align:left">
          <p><b>Student ID:</b> ${payload.student_id}</p>
          <p><b>Pickup Bus:</b> ${payload.pickup_bus_id ?? "—"}</p>
          <p><b>Drop Bus:</b> ${payload.drop_bus_id ?? "—"}</p>
          <p><b>Effective From:</b> ${payload.effective_from}</p>
          <small>This will close existing active assignment (if any) and create a new one.</small>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Assign",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!ok.isConfirmed) return;

    setLoading(true);
    try {
      const res = await api.post(
        "/student-transport-assignments/assign",
        payload
      );
      Swal.fire(
        "Assigned!",
        res?.data?.message || "Transport assigned successfully.",
        "success"
      );
      await fetchActiveAssignment(selectedStudentId);
    } catch (e) {
      console.error("Assign error:", e);
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.response?.data?.details ||
        "Failed to assign transport.";
      Swal.fire("Error", msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Search helpers --------------------
  // ✅ Search + Route Filter together
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

  const findBusNo = (id) => {
    const b = buses.find((x) => String(x.id) === String(id));
    return b ? safeStr(b.bus_no) : "—";
  };

  const findRouteName = (id) => {
    const r = routes.find((x) => String(x.id) === String(id));
    return r
      ? safeStr(r.RouteName || r.Villages || r.village || r.villages)
      : "—";
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
    // ✅ Prefer API-provided route_name/route_cost if present
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

  // ✅ helper: class/section display (your API returns class_name & section_name directly)
  const getClassName = (s) =>
    safeStr(s?.class_name || s?.Class?.class_name || s?.ClassName || "") || "—";

  const getSectionName = (s) =>
    safeStr(
      s?.section_name || s?.Section?.section_name || s?.SectionName || ""
    ) || "—";

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
              Swal.fire("Refreshed", "Dropdown data refreshed.", "success");
            } catch (e) {
              Swal.fire("Error", "Failed to refresh data.", "error");
            }
          }}
        >
          Refresh
        </button>
      </div>

      {/* Search + Route Filter + Select student */}
      <div className="row g-3 mb-3">
        <div className="col-md-4">
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

        <div className="col-md-4">
          <label className="form-label">Search Student (Name / Admission No)</label>
          <input
            className="form-control"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <small className="text-muted">Tip: Filter route first, then search.</small>
        </div>

        <div className="col-md-4">
          <label className="form-label">Select Student</label>
          <select
            ref={studentSelectRef}
            className="form-select"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
          >
            <option value="">-- Select --</option>
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {safeStr(s?.name)}{" "}
                {s?.admission_number ? `(${s.admission_number})` : ""}
              </option>
            ))}
          </select>
          {!!selectedRouteFilterId && (
            <small className="text-muted">Showing students of selected route only.</small>
          )}
        </div>
      </div>

      {/* Current active assignment preview */}
      {selectedStudentId && (
        <div className="alert alert-info">
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <div>
              <b>Current Active Assignment:</b>{" "}
              {activeAssignment ? (
                <>
                  Pickup: <b>{findBusNo(activeAssignment.pickup_bus_id)}</b> | Drop:{" "}
                  <b>{findBusNo(activeAssignment.drop_bus_id)}</b> | From:{" "}
                  <b>{safeStr(activeAssignment.effective_from)}</b>
                  {activeAssignment.pickup_route_id || activeAssignment.drop_route_id ? (
                    <>
                      {" "}
                      | Routes: Pickup <b>{findRouteName(activeAssignment.pickup_route_id)}</b>, Drop{" "}
                      <b>{findRouteName(activeAssignment.drop_route_id)}</b>
                    </>
                  ) : null}
                </>
              ) : (
                <span>No active assignment found.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assignment Form */}
      <div className="card p-3 mb-3">
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label">Pickup Bus</label>
            <select
              className="form-select"
              value={pickupBusId}
              onChange={(e) => setPickupBusId(e.target.value)}
            >
              <option value="">-- Select --</option>
              {buses
                .filter((b) => b.active !== false)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {safeStr(b.bus_no)} {b.reg_no ? `(${b.reg_no})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Drop Bus</label>
            <select
              className="form-select"
              value={dropBusId}
              onChange={(e) => setDropBusId(e.target.value)}
            >
              <option value="">-- Select --</option>
              {buses
                .filter((b) => b.active !== false)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {safeStr(b.bus_no)} {b.reg_no ? `(${b.reg_no})` : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Pickup Route (optional)</label>
            <select
              className="form-select"
              value={pickupRouteId}
              onChange={(e) => setPickupRouteId(e.target.value)}
            >
              <option value="">-- Select --</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {safeStr(r.RouteName || r.Villages || r.village || r.villages)}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Drop Route (optional)</label>
            <select
              className="form-select"
              value={dropRouteId}
              onChange={(e) => setDropRouteId(e.target.value)}
            >
              <option value="">-- Select --</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {safeStr(r.RouteName || r.Villages || r.village || r.villages)}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label">Effective From</label>
            <input
              type="date"
              className="form-control"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>

          <div className="col-md-9 d-flex align-items-end justify-content-end gap-2">
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                setPickupBusId("");
                setDropBusId("");
                setPickupRouteId("");
                setDropRouteId("");
              }}
              disabled={loading}
            >
              Clear
            </button>

            <button className="btn btn-success" onClick={handleAssign} disabled={loading}>
              {loading ? "Assigning..." : "Assign Transport"}
            </button>
          </div>
        </div>
      </div>

      {/* Optional: quick table view of students filtered */}
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
                <th>Quick Assign</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.slice(0, 30).map((s, idx) => (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td>{safeStr(s?.name)}</td>
                  <td>{safeStr(s?.admission_number) || "—"}</td>

                  {/* ✅ FIXED: class_name/section_name are direct fields in API */}
                  <td>{getClassName(s)}</td>
                  <td>{getSectionName(s)}</td>

                  {/* ✅ FIXED: prefer route_name/route_cost from API */}
                  <td>{formatStudentRoute(s)}</td>

                  <td>
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        setSelectedStudentId(String(s.id));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Select
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
