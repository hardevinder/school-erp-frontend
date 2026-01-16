// src/pages/Buses.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Transportation.css"; // reuse same CSS (or create Buses.css)

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

// ---- helpers --------------------------------------------------------------
const safeStr = (v) => String(v ?? "").trim();
const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
};

const Buses = () => {
  const { isSuperadmin } = useMemo(getRoleFlags, []);
  const [buses, setBuses] = useState([]);
  const [search, setSearch] = useState("");

  // If later you add bus excel import/export, keep this ref
  const fileRef = useRef(null);

  const fetchBuses = async () => {
    try {
      const res = await api.get("/buses");
      setBuses(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching buses:", error);
      Swal.fire("Error", "Failed to fetch buses.", "error");
    }
  };

  useEffect(() => {
    fetchBuses();
  }, []);

  // Delete bus (Superadmin only - same pattern as Transportation)
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
      Swal.fire("Error", "Failed to delete the bus.", "error");
    }
  };

  // Add Bus Modal
  const handleAdd = () => {
    Swal.fire({
      title: "Add New Bus",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <input type="text" id="bus_no" class="form-field" placeholder="Bus No (e.g. BUS-1)" />
          <input type="text" id="reg_no" class="form-field" placeholder="Registration No (optional)" />
          <input type="number" id="capacity" class="form-field" placeholder="Capacity (optional)" />
          <input type="number" id="driver_user_id" class="form-field" placeholder="Driver User ID (optional)" />
          <input type="number" id="conductor_user_id" class="form-field" placeholder="Conductor User ID (optional)" />
          <label class="d-flex align-items-center gap-2 mt-1">
            <input type="checkbox" id="active" checked />
            <span>Active</span>
          </label>
          <small style="display:block;margin-top:6px;opacity:0.8">
            Note: Driver/Conductor dropdown can be added later. For now, you can enter user IDs.
          </small>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Add",
      preConfirm: () => {
        return {
          bus_no: document.getElementById("bus_no").value,
          reg_no: document.getElementById("reg_no").value || null,
          capacity: document.getElementById("capacity").value || null,
          driver_user_id: document.getElementById("driver_user_id").value || null,
          conductor_user_id: document.getElementById("conductor_user_id").value || null,
          active: document.getElementById("active").checked,
        };
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      const payload = {
        ...result.value,
        bus_no: safeStr(result.value.bus_no),
        reg_no: safeStr(result.value.reg_no) || null,
        capacity:
          result.value.capacity === null || result.value.capacity === ""
            ? null
            : Number(result.value.capacity),
        driver_user_id:
          result.value.driver_user_id === null || result.value.driver_user_id === ""
            ? null
            : Number(result.value.driver_user_id),
        conductor_user_id:
          result.value.conductor_user_id === null || result.value.conductor_user_id === ""
            ? null
            : Number(result.value.conductor_user_id),
      };

      if (!payload.bus_no) {
        return Swal.fire("Validation", "Bus No is required.", "warning");
      }

      try {
        await api.post("/buses", payload);
        Swal.fire("Added!", "Bus has been added successfully.", "success");
        fetchBuses();
      } catch (error) {
        console.error("Add bus error:", error);
        const msg =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Failed to add the bus.";
        Swal.fire("Error", msg, "error");
      }
    });
  };

  // Edit Bus Modal
  const handleEdit = (bus) => {
    const busNo = safeStr(bus?.bus_no);
    const regNo = safeStr(bus?.reg_no);
    const capacity = bus?.capacity ?? "";
    const driverId = bus?.driver_user_id ?? "";
    const conductorId = bus?.conductor_user_id ?? "";
    const active = bus?.active !== false;

    Swal.fire({
      title: "Edit Bus",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <input type="text" id="bus_no" class="form-field" value="${busNo}" placeholder="Bus No" />
          <input type="text" id="reg_no" class="form-field" value="${regNo}" placeholder="Registration No (optional)" />
          <input type="number" id="capacity" class="form-field" value="${capacity}" placeholder="Capacity (optional)" />
          <input type="number" id="driver_user_id" class="form-field" value="${driverId}" placeholder="Driver User ID (optional)" />
          <input type="number" id="conductor_user_id" class="form-field" value="${conductorId}" placeholder="Conductor User ID (optional)" />
          <label class="d-flex align-items-center gap-2 mt-1">
            <input type="checkbox" id="active" ${active ? "checked" : ""} />
            <span>Active</span>
          </label>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: () => {
        return {
          bus_no: document.getElementById("bus_no").value,
          reg_no: document.getElementById("reg_no").value || null,
          capacity: document.getElementById("capacity").value || null,
          driver_user_id: document.getElementById("driver_user_id").value || null,
          conductor_user_id: document.getElementById("conductor_user_id").value || null,
          active: document.getElementById("active").checked,
        };
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      const payload = {
        ...result.value,
        bus_no: safeStr(result.value.bus_no),
        reg_no: safeStr(result.value.reg_no) || null,
        capacity:
          result.value.capacity === null || result.value.capacity === ""
            ? null
            : Number(result.value.capacity),
        driver_user_id:
          result.value.driver_user_id === null || result.value.driver_user_id === ""
            ? null
            : Number(result.value.driver_user_id),
        conductor_user_id:
          result.value.conductor_user_id === null || result.value.conductor_user_id === ""
            ? null
            : Number(result.value.conductor_user_id),
        active: !!result.value.active,
      };

      if (!payload.bus_no) {
        return Swal.fire("Validation", "Bus No is required.", "warning");
      }

      try {
        await api.put(`/buses/${bus.id}`, payload);
        Swal.fire("Updated!", "Bus has been updated successfully.", "success");
        fetchBuses();
      } catch (error) {
        console.error("Update bus error:", error);
        const msg =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Failed to update the bus.";
        Swal.fire("Error", msg, "error");
      }
    });
  };

  const filtered = buses.filter((b) => {
    const bn = safeStr(b?.bus_no).toLowerCase();
    const rn = safeStr(b?.reg_no).toLowerCase();
    const s = safeStr(search).toLowerCase();
    return bn.includes(s) || rn.includes(s);
  });

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="m-0">Bus Management</h1>

        <div className="d-flex gap-2 flex-wrap">
          {/* If you later add Excel export/import for buses, you can enable these:
          <button className="btn btn-outline-primary" onClick={handleExport}>Export Excel</button>
          <label className="btn btn-outline-secondary m-0">
            Import Excel
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: "none" }}
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </label>
          */}
          <button className="btn btn-success" onClick={handleAdd}>
            Add Bus
          </button>
        </div>
      </div>

      <div className="mb-3 d-flex">
        <input
          type="text"
          className="form-control w-50 me-2"
          placeholder="Search Buses"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Bus No</th>
            <th>Reg No</th>
            <th>Capacity</th>
            <th>Driver User ID</th>
            <th>Conductor User ID</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((bus, index) => (
            <tr key={bus.id}>
              <td>{index + 1}</td>
              <td>{safeStr(bus.bus_no)}</td>
              <td>{safeStr(bus.reg_no) || "—"}</td>
              <td>{bus.capacity ?? "—"}</td>
              <td>{bus.driver_user_id ?? "—"}</td>
              <td>{bus.conductor_user_id ?? "—"}</td>
              <td>{bus.active === false ? "No" : "Yes"}</td>
              <td>
                <button className="btn btn-primary btn-sm me-2" onClick={() => handleEdit(bus)}>
                  Edit
                </button>

                {isSuperadmin && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(bus.id, bus.bus_no)}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}

          {filtered.length === 0 && (
            <tr>
              <td colSpan="8" className="text-center">
                No buses found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Buses;
