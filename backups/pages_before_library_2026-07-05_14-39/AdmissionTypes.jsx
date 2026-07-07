import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./AdmissionTypes.css";

// ---------- helpers: roles ----------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
  };
};

// safely handle array or { admissionTypes: [...] } or { data: [...] }
const extractAdmissionTypes = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.admissionTypes)) return data.admissionTypes;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const esc = (v = "") => String(v ?? "").replace(/"/g, "&quot;");

const makeCodeFromName = (value = "") => {
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
};

const boolValue = (value) => {
  return value === true || value === 1 || value === "1" || value === "true";
};

const AdmissionTypes = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [admissionTypes, setAdmissionTypes] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  // ---------------- Fetch ----------------
  const fetchAdmissionTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get("/admission-types");
      setAdmissionTypes(extractAdmissionTypes(response.data));
    } catch (error) {
      console.error("fetchAdmissionTypes error:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to fetch admission types.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmissionTypes();
  }, []);

  // ---------------- Stats ----------------
  const stats = useMemo(() => {
    const total = admissionTypes.length;
    const active = admissionTypes.filter((t) => boolValue(t.is_active)).length;
    const inactive = admissionTypes.filter((t) => !boolValue(t.is_active)).length;
    const defaultType = admissionTypes.find((t) => boolValue(t.is_default));

    return {
      total,
      active,
      inactive,
      defaultName: defaultType?.name || "Not set",
    };
  }, [admissionTypes]);

  // ---------------- Modal HTML ----------------
  const getModalHtml = (type = {}) => `
    <style>
      .at-modal-wrap {
        text-align: left;
      }

      .at-modal-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .at-modal-grid .full {
        grid-column: 1 / -1;
      }

      .at-label {
        display: block;
        font-weight: 700;
        font-size: 13px;
        color: #111827;
        margin-bottom: 6px;
      }

      .at-field {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        font-size: 14px;
        outline: none;
        transition: 0.2s ease;
      }

      .at-field:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }

      .at-textarea {
        min-height: 88px;
        resize: vertical;
      }

      .at-hint {
        margin-top: 5px;
        font-size: 12px;
        color: #6b7280;
      }

      .at-check-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #f9fafb;
      }

      .at-check {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: #374151;
      }

      .at-check input {
        width: 16px;
        height: 16px;
      }

      @media (max-width: 768px) {
        .at-modal-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>

    <div class="at-modal-wrap">
      <div class="at-modal-grid">
        <div>
          <label for="swal-name" class="at-label">Admission Type Name *</label>
          <input
            id="swal-name"
            class="at-field"
            placeholder="e.g. New, Late Admission, Transfer"
            value="${esc(type.name)}"
          />
          <div class="at-hint">This name will be shown in dropdowns and reports.</div>
        </div>

        <div>
          <label for="swal-code" class="at-label">Code *</label>
          <input
            id="swal-code"
            class="at-field"
            placeholder="e.g. NEW, LATE_ADMISSION"
            value="${esc(type.code)}"
          />
          <div class="at-hint">Used internally. Auto generated from name if empty.</div>
        </div>

        <div>
          <label for="swal-sort-order" class="at-label">Sort Order</label>
          <input
            id="swal-sort-order"
            type="number"
            class="at-field"
            placeholder="0"
            value="${esc(type.sort_order ?? 0)}"
          />
        </div>

        <div class="at-check-row">
          <label class="at-check">
            <input
              type="checkbox"
              id="swal-is-active"
              ${type.id ? (boolValue(type.is_active) ? "checked" : "") : "checked"}
            />
            Active
          </label>

          <label class="at-check">
            <input
              type="checkbox"
              id="swal-is-default"
              ${boolValue(type.is_default) ? "checked" : ""}
            />
            Default
          </label>
        </div>

        <div class="full">
          <label for="swal-description" class="at-label">Description</label>
          <textarea
            id="swal-description"
            class="at-field at-textarea"
            placeholder="Short description for staff understanding..."
          >${esc(type.description)}</textarea>
        </div>
      </div>
    </div>
  `;

  const readModalValues = () => {
    const popup = Swal.getPopup();

    const name = popup.querySelector("#swal-name").value.trim();
    let code = popup.querySelector("#swal-code").value.trim();
    const description = popup.querySelector("#swal-description").value.trim();
    const sort_order = popup.querySelector("#swal-sort-order").value;
    const is_active = popup.querySelector("#swal-is-active").checked;
    const is_default = popup.querySelector("#swal-is-default").checked;

    if (!name) {
      Swal.showValidationMessage("Admission type name is required");
      return false;
    }

    if (!code) {
      code = makeCodeFromName(name);
    }

    if (!code) {
      Swal.showValidationMessage("Admission type code is required");
      return false;
    }

    return {
      name,
      code,
      description,
      sort_order: sort_order === "" ? 0 : Number(sort_order),
      is_active,
      is_default,
    };
  };

  const attachAutoCode = () => {
    const popup = Swal.getPopup();
    const nameInput = popup.querySelector("#swal-name");
    const codeInput = popup.querySelector("#swal-code");

    if (!nameInput || !codeInput) return;

    let codeTouched = !!codeInput.value;

    codeInput.addEventListener("input", () => {
      codeTouched = true;
      codeInput.value = makeCodeFromName(codeInput.value);
    });

    nameInput.addEventListener("input", () => {
      if (!codeTouched) {
        codeInput.value = makeCodeFromName(nameInput.value);
      }
    });
  };

  // ---------------- Add ----------------
  const handleAdd = async () => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "You do not have permission.", "warning");
    }

    const result = await Swal.fire({
      title: "Add Admission Type",
      width: "780px",
      html: getModalHtml(),
      showCancelButton: true,
      confirmButtonText: "Save Admission Type",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
      customClass: {
        popup: "at-swal-popup",
        confirmButton: "at-swal-confirm",
      },
      didOpen: attachAutoCode,
      preConfirm: readModalValues,
    });

    if (!result.isConfirmed) return;

    try {
      await api.post("/admission-types", result.value);

      Swal.fire("Added!", "Admission type has been added successfully.", "success");
      fetchAdmissionTypes();
    } catch (err) {
      console.error("Add admission type error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to add admission type.",
        "error"
      );
    }
  };

  // ---------------- Edit ----------------
  const handleEdit = async (type) => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "You do not have permission.", "warning");
    }

    const result = await Swal.fire({
      title: "Edit Admission Type",
      width: "780px",
      html: getModalHtml(type),
      showCancelButton: true,
      confirmButtonText: "Update Admission Type",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
      customClass: {
        popup: "at-swal-popup",
        confirmButton: "at-swal-confirm",
      },
      didOpen: attachAutoCode,
      preConfirm: readModalValues,
    });

    if (!result.isConfirmed) return;

    try {
      await api.put(`/admission-types/${type.id}`, result.value);

      Swal.fire("Updated!", "Admission type has been updated successfully.", "success");
      fetchAdmissionTypes();
    } catch (err) {
      console.error("Update admission type error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to update admission type.",
        "error"
      );
    }
  };

  // ---------------- Deactivate ----------------
  const handleDeactivate = async (type) => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "You do not have permission.", "warning");
    }

    const result = await Swal.fire({
      title: "Deactivate admission type?",
      text: `"${type.name}" will be hidden from dropdowns but old student records will remain safe.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, deactivate",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/admission-types/${type.id}`);

      Swal.fire("Deactivated!", "Admission type has been deactivated.", "success");
      fetchAdmissionTypes();
    } catch (err) {
      console.error("Deactivate admission type error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to deactivate admission type.",
        "error"
      );
    }
  };

  // ---------------- Restore ----------------
  const handleRestore = async (type) => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "You do not have permission.", "warning");
    }

    try {
      await api.patch(`/admission-types/restore/${type.id}`);

      Swal.fire("Activated!", "Admission type has been activated.", "success");
      fetchAdmissionTypes();
    } catch (err) {
      console.error("Restore admission type error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to activate admission type.",
        "error"
      );
    }
  };

  // ---------------- Make Default ----------------
  const handleMakeDefault = async (type) => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "You do not have permission.", "warning");
    }

    const result = await Swal.fire({
      title: "Set as default?",
      text: `"${type.name}" will become the default admission type.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, set default",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await api.put(`/admission-types/${type.id}`, {
        is_default: true,
      });

      Swal.fire("Updated!", "Default admission type has been updated.", "success");
      fetchAdmissionTypes();
    } catch (err) {
      console.error("Make default error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to set default admission type.",
        "error"
      );
    }
  };

  // ---------------- Filter ----------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return admissionTypes.filter((type) => {
      const isActive = boolValue(type.is_active);

      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;

      if (!q) return true;

      return (
        String(type.name || "").toLowerCase().includes(q) ||
        String(type.code || "").toLowerCase().includes(q) ||
        String(type.description || "").toLowerCase().includes(q) ||
        String(type.sort_order || "").toLowerCase().includes(q)
      );
    });
  }, [admissionTypes, search, statusFilter]);

  return (
    <div className="admission-types-page">
      <div className="at-header-card">
        <div>
          <p className="at-eyebrow">Master Settings</p>
          <h1>Admission Types</h1>
          <p className="at-subtitle">
            Manage New, Old, Late Admission, Transfer, Re-admission and other
            admission categories dynamically.
          </p>
        </div>

        {canEdit && (
          <button className="at-primary-btn" onClick={handleAdd}>
            + Add Admission Type
          </button>
        )}
      </div>

      <div className="at-stats-grid">
        <div className="at-stat-card">
          <span>Total Types</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="at-stat-card">
          <span>Active</span>
          <strong>{stats.active}</strong>
        </div>

        <div className="at-stat-card">
          <span>Inactive</span>
          <strong>{stats.inactive}</strong>
        </div>

        <div className="at-stat-card at-stat-wide">
          <span>Default Type</span>
          <strong>{stats.defaultName}</strong>
        </div>
      </div>

      <div className="at-toolbar">
        <div className="at-search-wrap">
          <span>Search</span>
          <input
            type="text"
            placeholder="Search by name, code, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="at-filter-wrap">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <button className="at-refresh-btn" onClick={fetchAdmissionTypes}>
          Refresh
        </button>
      </div>

      <div className="at-table-card">
        <div className="at-table-top">
          <div>
            <h2>Admission Type List</h2>
            <p>
              Showing {filtered.length} of {admissionTypes.length} records
            </p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table at-table align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Admission Type</th>
                <th>Code</th>
                <th>Description</th>
                <th>Sort</th>
                <th>Status</th>
                <th>Default</th>
                {canEdit && <th className="text-end">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="at-empty">
                    Loading admission types...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="at-empty">
                    No admission types found.
                  </td>
                </tr>
              ) : (
                filtered.map((type, index) => {
                  const isActive = boolValue(type.is_active);
                  const isDefault = boolValue(type.is_default);

                  return (
                    <tr key={type.id}>
                      <td>{index + 1}</td>

                      <td>
                        <div className="at-type-title">{type.name}</div>
                        <div className="at-type-id">ID: {type.id}</div>
                      </td>

                      <td>
                        <span className="at-code-badge">{type.code || "—"}</span>
                      </td>

                      <td className="at-description">
                        {type.description || "—"}
                      </td>

                      <td>{type.sort_order ?? 0}</td>

                      <td>
                        <span
                          className={
                            isActive
                              ? "at-status-badge active"
                              : "at-status-badge inactive"
                          }
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td>
                        {isDefault ? (
                          <span className="at-default-badge">Default</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {canEdit && (
                        <td>
                          <div className="at-actions">
                            <button
                              className="at-action-btn edit"
                              onClick={() => handleEdit(type)}
                            >
                              Edit
                            </button>

                            {!isDefault && isActive && (
                              <button
                                className="at-action-btn default"
                                onClick={() => handleMakeDefault(type)}
                              >
                                Make Default
                              </button>
                            )}

                            {isActive ? (
                              <button
                                className="at-action-btn deactivate"
                                onClick={() => handleDeactivate(type)}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                className="at-action-btn restore"
                                onClick={() => handleRestore(type)}
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdmissionTypes;