// File: src/pages/Buses.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    isAccounts: roles.includes("accounts"),
    isTransport: roles.includes("transport") || roles.includes("transport_admin"),
  };
};

/* ---------------- helpers ---------------- */
const safeStr = (v) => String(v ?? "").trim();
const lower = (v) => safeStr(v).toLowerCase();
const toNull = (v) => {
  const s = safeStr(v);
  return s ? s : null;
};
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  return d.rows || d.items || d.data || d.buses || d.staff || [];
};
const badge = (txt, kind = "secondary") => (
  <span className={`badge text-bg-${kind} rounded-pill`}>{txt}</span>
);

const modalCss = `
  <style>
    .swal2-popup.busModal { padding: 14px 14px 12px; }
    .swal2-popup.busModal .swal2-title { font-size: 18px; margin: 6px 0 10px; }
    .swal2-popup.busModal .swal2-html-container { margin: 0; }
    .busModal .bus-grid{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
      text-align:left;
    }
    .busModal .bus-grid .full{ grid-column: 1 / -1; }
    .busModal .bus-label{ font-size:12px; opacity:.75; margin:0 0 4px; }
    .busModal .bus-field{
      width:100%;
      padding:10px 10px;
      border:1px solid rgba(0,0,0,.15);
      border-radius:10px;
      outline:none;
    }
    .busModal .bus-field:focus{ border-color: rgba(13,110,253,.55); box-shadow: 0 0 0 .2rem rgba(13,110,253,.15); }
    .busModal .bus-box{
      max-height: 70vh;
      overflow:auto;
      padding-right:4px;
    }
    @media (max-width: 576px){
      .busModal .bus-grid{ grid-template-columns: 1fr; }
      .swal2-popup.busModal{ width: 95% !important; }
    }
  </style>
`;

const Buses = () => {
  const navigate = useNavigate();
  const { isSuperadmin, isAdmin, isTransport } = useMemo(getRoleFlags, []);
  const canManage = isSuperadmin || isAdmin || isTransport;

  const [buses, setBuses] = useState([]);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const fileRef = useRef(null);

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState({ buses: false, staff: false });
  const [error, setError] = useState("");

  const fetchBuses = async () => {
    setLoading((s) => ({ ...s, buses: true }));
    try {
      const res = await api.get("/buses");
      const list = asArray(res.data);
      setBuses(Array.isArray(list) ? list : []);
      setError("");
    } catch (e) {
      console.error("Error fetching buses:", e);
      setError(e?.response?.data?.message || e?.response?.data?.error || "Failed to fetch buses.");
      Swal.fire("Error", "Failed to fetch buses.", "error");
    } finally {
      setLoading((s) => ({ ...s, buses: false }));
    }
  };

  const fetchStaff = async () => {
    setLoading((s) => ({ ...s, staff: true }));
    try {
      const res = await api.get("/transport-staff");
      const rows = res?.data?.staff ?? asArray(res.data);
      setStaff(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("Error fetching transport staff:", e);
      setStaff([]);
    } finally {
      setLoading((s) => ({ ...s, staff: false }));
    }
  };

  useEffect(() => {
    fetchBuses();
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Map user_id => {name, username, status, staff_type, staff_status, staff_id}
  const staffByUserId = useMemo(() => {
    const map = new Map();
    for (const r of staff || []) {
      const uid = Number(r?.user?.id ?? r?.user_id);
      if (!uid) continue;
      map.set(uid, {
        user_id: uid,
        staff_id: r?.id,
        staff_type: lower(r?.staff_type),
        staff_status: lower(r?.status) || "active",
        name: safeStr(r?.user?.name) || safeStr(r?.user?.username) || `User ${uid}`,
        username: safeStr(r?.user?.username) || "",
        user_status: lower(r?.user?.status) || "active",
      });
    }
    return map;
  }, [staff]);

  const staffOptions = useMemo(() => {
    const drivers = [];
    const conductors = [];

    for (const r of staff || []) {
      const t = lower(r?.staff_type);
      const uid = r?.user?.id ?? r?.user_id;
      if (!uid) continue;

      const userName = safeStr(r?.user?.name) || safeStr(r?.user?.username) || `User ${uid}`;
      const userStatus = lower(r?.user?.status) || "active";
      const staffStatus = lower(r?.status) || "active";

      const label = `${userName} (ID: ${uid})${userStatus === "disabled" ? " • Disabled" : ""}${
        staffStatus === "inactive" ? " • Inactive" : ""
      }`;

      const opt = { value: Number(uid), label, userStatus, staffStatus };

      if (t === "driver") drivers.push(opt);
      if (t === "conductor") conductors.push(opt);
    }

    drivers.sort((a, b) => a.label.localeCompare(b.label));
    conductors.sort((a, b) => a.label.localeCompare(b.label));
    return { drivers, conductors };
  }, [staff]);

  const handleDelete = async (id, busNo) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: `Delete bus (${safeStr(busNo)})?`,
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/buses/${id}`);
      Swal.fire("Deleted!", "Bus has been deleted.", "success");
      fetchBuses();
    } catch (error) {
      console.error("Error deleting bus:", error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || "Failed to delete the bus.";
      Swal.fire("Error", msg, "error");
    }
  };

  // ✅ allow focusing driver or conductor section inside modal
  const openBusModal = async ({ mode, bus, focus = "none" }) => {
    if (!canManage) return Swal.fire("Forbidden", "Access denied.", "warning");

    const isEdit = mode === "edit";
    const busNo = safeStr(bus?.bus_no);
    const regNo = safeStr(bus?.reg_no);
    const capacity = bus?.capacity ?? "";
    const driverUserId = bus?.driver_user_id ?? "";
    const conductorUserId = bus?.conductor_user_id ?? "";
    const active = bus?.active !== false;

    const staffNote =
      staffOptions.drivers.length || staffOptions.conductors.length
        ? ""
        : `<div class="full" style="opacity:.75;font-size:12px;">
             Tip: Add Drivers/Conductors from <b>Transport Staff</b> page to use dropdowns.
           </div>`;

    const html = `
      ${modalCss}
      <div class="bus-box">
        <div class="bus-grid">

          <div class="full">
            <div class="bus-label">*Bus No</div>
            <input type="text" id="bus_no" class="bus-field" placeholder="BUS-1 / VAN-A" value="${busNo}" />
          </div>

          <div>
            <div class="bus-label">Reg No</div>
            <input type="text" id="reg_no" class="bus-field" placeholder="PB10AB1234" value="${regNo}" />
          </div>

          <div>
            <div class="bus-label">Capacity</div>
            <input type="number" id="capacity" class="bus-field" placeholder="e.g. 35" value="${capacity}" />
          </div>

          <div class="full" id="driver_block">
            <div class="d-flex align-items-center justify-content-between">
              <div class="bus-label">Driver</div>
              <small style="opacity:.7;">(from Transport Staff)</small>
            </div>
            <select id="driver_user_id" class="bus-field">
              <option value="">— Select Driver (optional) —</option>
              ${staffOptions.drivers
                .map(
                  (o) =>
                    `<option value="${o.value}" ${Number(driverUserId) === Number(o.value) ? "selected" : ""}>${o.label}</option>`
                )
                .join("")}
            </select>
            <small style="display:block;margin-top:6px;opacity:.75;">
              If dropdown is empty, you can still type user id manually below.
            </small>
            <input type="number" id="driver_user_id_manual" class="bus-field" style="margin-top:8px;" placeholder="Manual Driver User ID (optional)" value="${
              driverUserId && !staffOptions.drivers.find((x) => Number(x.value) === Number(driverUserId))
                ? driverUserId
                : ""
            }" />
          </div>

          <div class="full" id="conductor_block">
            <div class="d-flex align-items-center justify-content-between">
              <div class="bus-label">Conductor</div>
              <small style="opacity:.7;">(from Transport Staff)</small>
            </div>
            <select id="conductor_user_id" class="bus-field">
              <option value="">— Select Conductor (optional) —</option>
              ${staffOptions.conductors
                .map(
                  (o) =>
                    `<option value="${o.value}" ${
                      Number(conductorUserId) === Number(o.value) ? "selected" : ""
                    }>${o.label}</option>`
                )
                .join("")}
            </select>
            <small style="display:block;margin-top:6px;opacity:.75;">
              If dropdown is empty, you can still type user id manually below.
            </small>
            <input type="number" id="conductor_user_id_manual" class="bus-field" style="margin-top:8px;" placeholder="Manual Conductor User ID (optional)" value="${
              conductorUserId && !staffOptions.conductors.find((x) => Number(x.value) === Number(conductorUserId))
                ? conductorUserId
                : ""
            }" />
          </div>

          <div class="full d-flex align-items-center gap-2" style="margin-top:2px;">
            <input type="checkbox" id="active" ${active ? "checked" : ""} />
            <label for="active" style="margin:0;">Active</label>
          </div>

          ${staffNote}

        </div>
      </div>
    `;

    const result = await Swal.fire({
      title: isEdit ? "Edit Bus" : "Add New Bus",
      width: 620,
      customClass: { popup: "busModal" },
      allowOutsideClick: false,
      allowEscapeKey: false,
      html,
      didOpen: () => {
        if (focus === "driver") {
          document.getElementById("driver_block")?.scrollIntoView({ behavior: "smooth", block: "center" });
          document.getElementById("driver_user_id")?.focus();
        }
        if (focus === "conductor") {
          document.getElementById("conductor_block")?.scrollIntoView({ behavior: "smooth", block: "center" });
          document.getElementById("conductor_user_id")?.focus();
        }
      },
      showCancelButton: true,
      confirmButtonText: isEdit ? "Save" : "Add",
      preConfirm: () => {
        const bus_no = safeStr(document.getElementById("bus_no")?.value);
        if (!bus_no) {
          Swal.showValidationMessage("Bus No is required.");
          return false;
        }

        const reg_no = toNull(document.getElementById("reg_no")?.value);

        const capacityRaw = document.getElementById("capacity")?.value;
        const capacityNum = capacityRaw === "" || capacityRaw === null ? null : Number(capacityRaw);
        const capacity = Number.isFinite(capacityNum) ? capacityNum : null;

        const driverSelect = document.getElementById("driver_user_id")?.value || "";
        const driverManual = document.getElementById("driver_user_id_manual")?.value || "";
        const driver_user_id = driverSelect || driverManual || null;

        const conductorSelect = document.getElementById("conductor_user_id")?.value || "";
        const conductorManual = document.getElementById("conductor_user_id_manual")?.value || "";
        const conductor_user_id = conductorSelect || conductorManual || null;

        const active = !!document.getElementById("active")?.checked;

        return {
          bus_no,
          reg_no,
          capacity,
          driver_user_id: driver_user_id === "" ? null : Number(driver_user_id),
          conductor_user_id: conductor_user_id === "" ? null : Number(conductor_user_id),
          active,
        };
      },
    });

    if (!result.isConfirmed) return;

    const payload = result.value;
    if (payload.driver_user_id !== null && !Number.isFinite(payload.driver_user_id)) payload.driver_user_id = null;
    if (payload.conductor_user_id !== null && !Number.isFinite(payload.conductor_user_id))
      payload.conductor_user_id = null;

    try {
      if (isEdit) {
        await api.put(`/buses/${bus.id}`, payload);
        Swal.fire("Updated!", "Bus has been updated successfully.", "success");
      } else {
        await api.post("/buses", payload);
        Swal.fire("Added!", "Bus has been added successfully.", "success");
      }
      fetchBuses();
    } catch (error) {
      console.error(isEdit ? "Update bus error:" : "Add bus error:", error);
      const msg = error?.response?.data?.error || error?.response?.data?.message || "Request failed.";
      Swal.fire("Error", msg, "error");
    }
  };

  const handleAdd = () => openBusModal({ mode: "add" });
  const handleEdit = (bus) => openBusModal({ mode: "edit", bus });

  const filtered = useMemo(() => {
    const s = lower(search);
    const list = (buses || []).filter((b) => {
      if (!s) return true;
      const bn = lower(b?.bus_no);
      const rn = lower(b?.reg_no);
      const dr = String(b?.driver_user_id ?? "").toLowerCase();
      const co = String(b?.conductor_user_id ?? "").toLowerCase();

      const drName = staffByUserId.get(Number(b?.driver_user_id))?.name || "";
      const coName = staffByUserId.get(Number(b?.conductor_user_id))?.name || "";

      return (
        bn.includes(s) ||
        rn.includes(s) ||
        dr.includes(s) ||
        co.includes(s) ||
        lower(drName).includes(s) ||
        lower(coName).includes(s)
      );
    });

    return activeOnly ? list.filter((b) => b?.active !== false) : list;
  }, [buses, search, activeOnly, staffByUserId]);

  const stats = useMemo(() => {
    const total = buses.length;
    const active = buses.filter((b) => b?.active !== false).length;
    const withDriver = buses.filter((b) => b?.driver_user_id).length;
    const withConductor = buses.filter((b) => b?.conductor_user_id).length;
    return { total, active, withDriver, withConductor };
  }, [buses]);

  const busy = loading.buses || loading.staff;

  // ✅ CLEAN: no buttons under name (as you asked)
  const renderStaffCell = (userId, type) => {
    if (!userId) return <span className="text-muted">—</span>;

    const info = staffByUserId.get(Number(userId));
    const name = info?.name || `User ${userId}`;

    const chipKind = type === "driver" ? "primary" : "warning";

    return (
      <div className="d-flex flex-column gap-1">
        <div className="fw-semibold">{name}</div>

        <div className="d-flex flex-wrap gap-2 align-items-center">
          {badge(`ID: ${userId}`, chipKind)}
          {info?.user_status === "disabled" ? badge("User Disabled", "danger") : null}
          {info?.staff_status === "inactive" ? badge("Staff Inactive", "secondary") : null}
        </div>
      </div>
    );
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h1 className="m-0">Bus Management</h1>
          <div className="text-muted" style={{ marginTop: 4 }}>
            Manage fleet + assign driver/conductor.
          </div>

          <div className="d-flex flex-wrap gap-2 mt-2">
            {badge(`Total: ${stats.total}`, "dark")}
            {badge(`Active: ${stats.active}`, "success")}
            {badge(`With Driver: ${stats.withDriver}`, "primary")}
            {badge(`With Conductor: ${stats.withConductor}`, "warning")}
            {busy ? badge("Updating…", "info") : badge("Live", "success")}
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              fetchBuses();
              fetchStaff();
            }}
            disabled={busy}
          >
            Refresh
          </button>

          <button className="btn btn-success" onClick={handleAdd} disabled={!canManage}>
            Add Bus
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
          <button className="btn btn-sm btn-light border" onClick={fetchBuses}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 420 }}
          placeholder="Search bus no, reg no, driver name/id, conductor name/id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label className="d-flex align-items-center gap-2 ms-1" style={{ userSelect: "none" }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          <span>Active only</span>
        </label>

        <div className="ms-auto text-muted small">
          Staff loaded:{" "}
          <b>
            {staffOptions.drivers.length} drivers · {staffOptions.conductors.length} conductors
          </b>
          <span className="ms-2">
            <button className="btn btn-sm btn-outline-dark" onClick={() => navigate("/transport-staff")}>
              Open Staff
            </button>
          </span>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Bus</th>
              <th>Reg No</th>
              <th>Capacity</th>
              <th style={{ minWidth: 240 }}>Driver</th>
              <th style={{ minWidth: 240 }}>Conductor</th>
              <th>Active</th>
              <th style={{ minWidth: 170 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {busy && (
              <tr>
                <td colSpan="8" className="text-center py-4 text-muted">
                  Loading…
                </td>
              </tr>
            )}

            {!busy &&
              filtered.map((bus, index) => (
                <tr key={bus.id}>
                  <td className="text-muted">{index + 1}</td>

                  <td>
                    <div className="fw-semibold">{safeStr(bus.bus_no) || "—"}</div>
                    <div className="small text-muted">ID: {bus.id}</div>
                  </td>

                  <td>{safeStr(bus.reg_no) || "—"}</td>
                  <td>{bus.capacity ?? "—"}</td>

                  <td>{renderStaffCell(bus.driver_user_id, "driver")}</td>
                  <td>{renderStaffCell(bus.conductor_user_id, "conductor")}</td>

                  <td>{bus.active === false ? badge("No", "secondary") : badge("Yes", "success")}</td>

                  <td>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => handleEdit(bus)}
                      disabled={!canManage}
                    >
                      Edit Bus
                    </button>

                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(bus.id, bus.bus_no)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}

            {!busy && filtered.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center">
                  No buses found
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

export default Buses;
