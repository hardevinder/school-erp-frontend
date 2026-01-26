// src/pages/TransportStaff.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Transportation.css"; // reuse same css (or create TransportStaff.css)

/* ---------------- role helpers ---------------- */
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
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
const safeLower = (v) => safeStr(v).toLowerCase();
const toNull = (v) => {
  const s = safeStr(v);
  return s ? s : null;
};

const TransportStaff = () => {
  const { isSuperadmin, isAdmin, isTransport } = useMemo(getRoleFlags, []);
  const canManage = isSuperadmin || isAdmin || isTransport;

  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(""); // driver|conductor|""
  const [userStatusFilter, setUserStatusFilter] = useState(""); // active|disabled|""
  const [staffStatusFilter, setStaffStatusFilter] = useState(""); // active|inactive|""

  const fetchStaff = async () => {
    try {
      const params = {};
      if (safeStr(search)) params.search = safeStr(search);
      if (typeFilter) params.staff_type = typeFilter;
      if (userStatusFilter) params.status = userStatusFilter; // User.status
      if (staffStatusFilter) params.staff_status = staffStatusFilter; // TransportStaff.status

      const res = await api.get("/transport-staff", { params });
      const rows = res?.data?.staff || res?.data || [];
      setStaff(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("Fetch transport staff error:", err);
      Swal.fire("Error", "Failed to fetch transport staff.", "error");
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = () => fetchStaff();

  /* ---------------- delete ---------------- */
  const handleDelete = async (row) => {
    if (!canManage) {
      return Swal.fire("Forbidden", "Access denied.", "warning");
    }

    const userName = safeStr(row?.user?.name) || safeStr(row?.user?.username) || "Staff";
    const staffType = safeStr(row?.staff_type) || "staff";

    const result = await Swal.fire({
      title: `Delete ${staffType} (${userName})?`,
      text: "You can delete only profile, or profile + user account.",
      icon: "warning",
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: "Delete Profile Only",
      denyButtonText: "Delete Profile + User",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    try {
      if (result.isConfirmed) {
        await api.delete(`/transport-staff/${row.id}`);
        Swal.fire("Deleted!", "Transport staff profile deleted.", "success");
        fetchStaff();
      } else if (result.isDenied) {
        if (!isSuperadmin) {
          return Swal.fire("Forbidden", "Only Super Admin can delete user account.", "warning");
        }
        await api.delete(`/transport-staff/${row.id}?deleteUser=true`);
        Swal.fire("Deleted!", "Profile + user account deleted.", "success");
        fetchStaff();
      }
    } catch (err) {
      console.error("Delete transport staff error:", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to delete.";
      Swal.fire("Error", msg, "error");
    }
  };

  /* =========================================================
     ✅ SWEETALERT COMPACT STYLES (3 columns + scroll body)
     - Smaller width for laptops
     - Body scrolls, buttons always visible
  ========================================================== */
  const injectSwalCompactStyles = () => {
    if (document.getElementById("swal-transport-compact-style")) return;

    const style = document.createElement("style");
    style.id = "swal-transport-compact-style";
    style.innerHTML = `
      .swal-transport-compact-popup{
        width: min(880px, 96vw) !important;
        padding: 12px !important;
      }
      .swal-transport-compact-title{
        font-size: 18px !important;
        margin: 0 0 6px 0 !important;
      }
      .swal-transport-compact-html{
        padding: 0 !important;
        margin: 0 !important;
      }
      /* Scrollable body inside modal */
      .ts-modal-body{
        max-height: min(62vh, 520px);
        overflow: auto;
        padding: 10px 6px 4px 6px;
      }
      .ts-grid{
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 980px){
        .ts-grid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 620px){
        .ts-grid{ grid-template-columns: 1fr; }
      }

      .ts-field label{
        display:block;
        font-size: 11px;
        opacity: .8;
        margin-bottom: 4px;
      }
      .ts-input, .ts-select{
        width: 100%;
        height: 36px;
        padding: 7px 10px;
        border: 1px solid rgba(0,0,0,.15);
        border-radius: 10px;
        outline: none;
        font-size: 13px;
      }
      .ts-input:focus, .ts-select:focus{
        border-color: rgba(0,0,0,.35);
        box-shadow: 0 0 0 3px rgba(0,0,0,.06);
      }
      .ts-full{
        grid-column: 1 / -1;
      }
      .ts-note{
        font-size: 12px;
        opacity: .8;
        margin-top: 6px;
      }
      .ts-divider{
        grid-column: 1 / -1;
        height: 1px;
        background: rgba(0,0,0,.10);
        margin: 2px 0;
      }

      /* Footer button area compact */
      .swal2-actions{
        margin-top: 10px !important;
      }
      .swal2-confirm, .swal2-cancel{
        padding: 8px 16px !important;
        border-radius: 10px !important;
      }
    `;
    document.head.appendChild(style);
  };

  /* ---------------- add (3 columns, compact height) ---------------- */
  const handleAdd = async () => {
    if (!canManage) return Swal.fire("Forbidden", "Access denied.", "warning");

    injectSwalCompactStyles();

    Swal.fire({
      title: "Add Driver / Conductor",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCancelButton: true,
      confirmButtonText: "Add",
      customClass: {
        popup: "swal-transport-compact-popup",
        title: "swal-transport-compact-title",
        htmlContainer: "swal-transport-compact-html",
      },
      html: `
        <div class="ts-modal-body">
          <div class="ts-grid">

            <div class="ts-field">
              <label>*Staff Type</label>
              <select id="staff_type" class="ts-select">
                <option value="">Select type</option>
                <option value="driver">Driver</option>
                <option value="conductor">Conductor</option>
              </select>
            </div>

            <div class="ts-field">
              <label>User Status</label>
              <select id="user_status" class="ts-select">
                <option value="active" selected>Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <div class="ts-field">
              <label>Staff Status</label>
              <select id="staff_status" class="ts-select">
                <option value="active" selected>Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div class="ts-divider"></div>

            <div class="ts-field">
              <label>*Username</label>
              <input id="username" class="ts-input" placeholder="driver01 / cond01" />
            </div>

            <div class="ts-field">
              <label>*Name</label>
              <input id="name" class="ts-input" placeholder="Full name" />
            </div>

            <div class="ts-field">
              <label>Email</label>
              <input id="email" type="email" class="ts-input" placeholder="email@example.com" />
            </div>

            <div class="ts-field">
              <label>Password</label>
              <input id="password" type="text" class="ts-input" placeholder="Optional" />
            </div>

            <div class="ts-field">
              <label>Phone</label>
              <input id="phone" class="ts-input" placeholder="10 digit" />
            </div>

            <div class="ts-field">
              <label>Aadhaar No</label>
              <input id="aadhaar_no" class="ts-input" placeholder="XXXX-XXXX-XXXX" />
            </div>

            <div class="ts-field ts-full">
              <label>Address</label>
              <input id="address" class="ts-input" placeholder="Optional" />
            </div>

            <div class="ts-field">
              <label>License No (Driver)</label>
              <input id="license_no" class="ts-input" placeholder="DL..." />
            </div>

            <div class="ts-field">
              <label>License Expiry</label>
              <input id="license_expiry" type="date" class="ts-input" />
            </div>

            <div class="ts-field">
              <label>&nbsp;</label>
              <div class="ts-note">
                Role auto-assign: <b>driver</b> / <b>conductor</b>
              </div>
            </div>

          </div>
        </div>
      `,
      preConfirm: async () => {
        const staff_type = document.getElementById("staff_type").value;
        const username = document.getElementById("username").value;
        const name = document.getElementById("name").value;

        if (!safeStr(staff_type) || !safeStr(username) || !safeStr(name)) {
          Swal.showValidationMessage("Staff Type, Username and Name are required.");
          return false;
        }

        const payload = {
          staff_type: safeStr(staff_type),
          status: document.getElementById("user_status").value,
          staff_status: document.getElementById("staff_status").value,
          username: safeStr(username),
          name: safeStr(name),
          email: toNull(document.getElementById("email").value),
          password: toNull(document.getElementById("password").value),
          phone: toNull(document.getElementById("phone").value),
          aadhaar_no: toNull(document.getElementById("aadhaar_no").value),
          address: toNull(document.getElementById("address").value),
          license_no: toNull(document.getElementById("license_no").value),
          license_expiry: document.getElementById("license_expiry").value || null,
        };

        if (payload.staff_type === "driver" && !payload.license_no) {
          const ask = await Swal.fire({
            title: "License missing",
            text: "Driver without license no. Continue?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Continue",
            cancelButtonText: "Go Back",
            allowOutsideClick: false,
          });
          if (!ask.isConfirmed) return false;
        }

        return payload;
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await api.post("/transport-staff", result.value);
        Swal.fire("Added!", "Driver/Conductor created successfully.", "success");
        fetchStaff();
      } catch (err) {
        console.error("Create transport staff error:", err);
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to create.";
        Swal.fire("Error", msg, "error");
      }
    });
  };

  /* ---------------- edit (3 columns, compact height) ---------------- */
  const handleEdit = async (row) => {
    if (!canManage) return Swal.fire("Forbidden", "Access denied.", "warning");

    injectSwalCompactStyles();

    const u = row?.user || {};
    const expiry = row?.license_expiry ? String(row.license_expiry).slice(0, 10) : "";

    Swal.fire({
      title: "Edit Driver / Conductor",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCancelButton: true,
      confirmButtonText: "Save",
      customClass: {
        popup: "swal-transport-compact-popup",
        title: "swal-transport-compact-title",
        htmlContainer: "swal-transport-compact-html",
      },
      html: `
        <div class="ts-modal-body">
          <div class="ts-grid">

            <div class="ts-field">
              <label>Staff Type</label>
              <select id="staff_type" class="ts-select">
                <option value="driver" ${row.staff_type === "driver" ? "selected" : ""}>Driver</option>
                <option value="conductor" ${row.staff_type === "conductor" ? "selected" : ""}>Conductor</option>
              </select>
            </div>

            <div class="ts-field">
              <label>User Status</label>
              <select id="user_status" class="ts-select">
                <option value="active" ${u.status === "active" ? "selected" : ""}>Active</option>
                <option value="disabled" ${u.status === "disabled" ? "selected" : ""}>Disabled</option>
              </select>
            </div>

            <div class="ts-field">
              <label>Staff Status</label>
              <select id="staff_status" class="ts-select">
                <option value="active" ${row.status === "active" ? "selected" : ""}>Active</option>
                <option value="inactive" ${row.status === "inactive" ? "selected" : ""}>Inactive</option>
              </select>
            </div>

            <div class="ts-divider"></div>

            <div class="ts-field">
              <label>Username</label>
              <input class="ts-input" value="${safeStr(u.username)}" disabled />
            </div>

            <div class="ts-field">
              <label>*Name</label>
              <input id="name" class="ts-input" value="${safeStr(u.name)}" />
            </div>

            <div class="ts-field">
              <label>Email</label>
              <input id="email" type="email" class="ts-input" value="${safeStr(u.email)}" />
            </div>

            <div class="ts-field">
              <label>Phone</label>
              <input id="phone" class="ts-input" value="${safeStr(row.phone)}" />
            </div>

            <div class="ts-field">
              <label>Aadhaar No</label>
              <input id="aadhaar_no" class="ts-input" value="${safeStr(row.aadhaar_no)}" />
            </div>

            <div class="ts-field ts-full">
              <label>Address</label>
              <input id="address" class="ts-input" value="${safeStr(row.address)}" />
            </div>

            <div class="ts-field">
              <label>License No</label>
              <input id="license_no" class="ts-input" value="${safeStr(row.license_no)}" />
            </div>

            <div class="ts-field">
              <label>License Expiry</label>
              <input id="license_expiry" type="date" class="ts-input" value="${expiry}" />
            </div>

            <div class="ts-field">
              <label>&nbsp;</label>
              <div class="ts-note">
                ${isSuperadmin ? "If disabling, you can add reason below." : "Role stays unchanged."}
              </div>
            </div>

            ${
              isSuperadmin
                ? `
                  <div class="ts-field ts-full">
                    <label>Disable Reason (optional)</label>
                    <input id="disableReason" class="ts-input" placeholder="Reason..." />
                  </div>
                `
                : ""
            }

          </div>
        </div>
      `,
      preConfirm: () => {
        const staff_type = document.getElementById("staff_type").value;
        const name = document.getElementById("name").value;

        if (!safeStr(staff_type) || !safeStr(name)) {
          Swal.showValidationMessage("Staff Type and Name are required.");
          return false;
        }

        const payload = {
          staff_type: safeStr(staff_type),
          name: safeStr(name),
          email: toNull(document.getElementById("email").value),
          phone: toNull(document.getElementById("phone").value),
          aadhaar_no: toNull(document.getElementById("aadhaar_no").value),
          address: toNull(document.getElementById("address").value),
          license_no: toNull(document.getElementById("license_no").value),
          license_expiry: document.getElementById("license_expiry").value || null,
          status: document.getElementById("user_status").value,
          staff_status: document.getElementById("staff_status").value,
        };

        if (isSuperadmin && payload.status === "disabled") {
          const r = document.getElementById("disableReason")?.value;
          if (safeStr(r)) payload.disableReason = safeStr(r);
        }

        return payload;
      },
    }).then(async (result) => {
      if (!result.isConfirmed) return;

      try {
        await api.put(`/transport-staff/${row.id}`, result.value);
        Swal.fire("Updated!", "Transport staff updated successfully.", "success");
        fetchStaff();
      } catch (err) {
        console.error("Update transport staff error:", err);
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to update.";
        Swal.fire("Error", msg, "error");
      }
    });
  };

  /* ---------------- local filter (fallback) ---------------- */
  const filtered = useMemo(() => {
    const s = safeLower(search);
    if (!s) return staff;

    return staff.filter((r) => {
      const u = r?.user || {};
      const hay = [
        r?.staff_type,
        r?.phone,
        r?.aadhaar_no,
        r?.license_no,
        u?.name,
        u?.username,
        u?.email,
      ]
        .map(safeLower)
        .join(" | ");

      return hay.includes(s);
    });
  }, [staff, search]);

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h1 className="m-0">Driver / Conductor Management</h1>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Manage transport staff accounts, status, and basic documents.
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary" onClick={handleRefresh}>
            Refresh
          </button>
          <button className="btn btn-success" onClick={handleAdd} disabled={!canManage}>
            Add Staff
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 360 }}
          placeholder="Search by name, username, phone, license..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="driver">Driver</option>
          <option value="conductor">Conductor</option>
        </select>

        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={staffStatusFilter}
          onChange={(e) => setStaffStatusFilter(e.target.value)}
        >
          <option value="">All Staff Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={userStatusFilter}
          onChange={(e) => setUserStatusFilter(e.target.value)}
        >
          <option value="">All User Status</option>
          <option value="active">User Active</option>
          <option value="disabled">User Disabled</option>
        </select>

        <button className="btn btn-primary" onClick={fetchStaff} disabled={!canManage}>
          Apply
        </button>
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th>Name</th>
            <th>Username</th>
            <th>Phone</th>
            <th>License</th>
            <th>Staff Status</th>
            <th>User Status</th>
            <th style={{ minWidth: 160 }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((r, idx) => {
            const u = r?.user || {};
            const isUserDisabled = u?.status === "disabled";
            return (
              <tr key={r.id}>
                <td>{idx + 1}</td>
                <td style={{ textTransform: "capitalize" }}>{safeStr(r.staff_type) || "—"}</td>
                <td>{safeStr(u.name) || "—"}</td>
                <td>{safeStr(u.username) || "—"}</td>
                <td>{safeStr(r.phone) || "—"}</td>
                <td>
                  {safeStr(r.license_no) || "—"}
                  {r.license_expiry ? (
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      Exp: {String(r.license_expiry).slice(0, 10)}
                    </div>
                  ) : null}
                </td>
                <td>{r.status === "inactive" ? "Inactive" : "Active"}</td>
                <td>{isUserDisabled ? "Disabled" : "Active"}</td>
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => handleEdit(r)}
                    disabled={!canManage}
                  >
                    Edit
                  </button>

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(r)}
                    disabled={!canManage}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}

          {filtered.length === 0 && (
            <tr>
              <td colSpan="9" className="text-center">
                No staff found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Footer hint */}
      <div style={{ opacity: 0.75, fontSize: 12 }}>
        Note: This page uses the API <b>/transport-staff</b>. Make sure the backend route is mounted and
        Roles table contains <b>driver</b> and <b>conductor</b>.
      </div>
    </div>
  );
};

export default TransportStaff;
