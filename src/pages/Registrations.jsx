// src/pages/Registrations.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  const isAdmin = roles.includes("admin");
  const isSuperadmin = roles.includes("superadmin");

  const isAdmission = roles.includes("admission") || roles.includes("frontoffice");
  const isAccounts = roles.includes("accounts");
  const isCoordinator = roles.includes("academic_coordinator");

  // View allowed: admin, superadmin, admission/frontoffice, accounts, coordinator, hr, teacher (as per backend route file)
  const canView =
    isAdmin ||
    isSuperadmin ||
    isAdmission ||
    isAccounts ||
    isCoordinator ||
    roles.includes("hr") ||
    roles.includes("teacher");

  // Full CRUD (create/edit details): admin/superadmin/admission/frontoffice (and others you allowed in CRUD_ROLES)
  const canEditDetails =
    isAdmin ||
    isSuperadmin ||
    isAdmission ||
    isCoordinator ||
    roles.includes("hr") ||
    roles.includes("teacher"); // matches your CRUD_ROLES; remove if you don't want teacher/hr edits

  // Fee update only: accounts + admin-like
  const canUpdateFee = isAccounts || isAdmin || isSuperadmin;

  // Status update: admission/frontoffice/coordinator/admin-like
  const canUpdateStatus = isAdmission || isCoordinator || isAdmin || isSuperadmin;

  // Delete only: admin-like (backend restricts to admin/superadmin)
  const canDelete = isAdmin || isSuperadmin;

  return {
    roles,
    isAdmin,
    isSuperadmin,
    isAdmission,
    isAccounts,
    canView,
    canEditDetails,
    canUpdateFee,
    canUpdateStatus,
    canDelete,
  };
};

// ---- defaults -------------------------------------------------------------
const emptyForm = {
  registration_no: "", // optional (backend auto-generates if empty)
  student_name: "",
  father_name: "",
  mother_name: "",
  phone: "",
  email: "",
  dob: "",
  gender: "",
  address: "",
  class_applied: "",
  academic_session: "",
  registration_date: "", // optional
  registration_fee: "",
  fee_status: "unpaid",
  payment_ref: "",
  status: "registered",
  remarks: "",
};

const Registrations = () => {
  const flags = useMemo(getRoleFlags, []);
  const {
    canView,
    canEditDetails,
    canUpdateFee,
    canUpdateStatus,
    canDelete,
    isSuperadmin,
  } = flags;

  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingRow, setEditingRow] = useState(null);

  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [feeForm, setFeeForm] = useState({
    registration_fee: "",
    fee_status: "unpaid",
    payment_ref: "",
    remarks: "",
  });
  const [statusForm, setStatusForm] = useState({
    status: "registered",
    remarks: "",
  });

  // ---- API base path ------------------------------------------------------
  // If you mounted as app.use("/registrations", ...) then keep "/registrations"
  // If you mounted as app.use("/api/registrations", ...) then change to "/api/registrations"
  const BASE = "/registrations";

  const fetchRegistrations = async () => {
    try {
      const { data } = await api.get(BASE);
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching registrations:", error);
      Swal.fire("Error", "Failed to fetch registrations.", "error");
    }
  };

  const openCreate = () => {
    setEditingRow(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);

    // Map row → form (keep safe)
    setForm({
      ...emptyForm,
      ...row,
      dob: row?.dob ? String(row.dob).slice(0, 10) : "",
      registration_date: row?.registration_date
        ? new Date(row.registration_date).toISOString().slice(0, 16)
        : "",
      registration_fee:
        row?.registration_fee !== null && row?.registration_fee !== undefined
          ? String(row.registration_fee)
          : "",
    });

    setShowModal(true);
  };

  const saveRegistration = async () => {
    try {
      if (!form.student_name.trim() || !form.phone.trim() || !form.class_applied.trim() || !form.academic_session.trim()) {
        Swal.fire("Error", "Student name, phone, class applied, and academic session are required.", "error");
        return;
      }

      const payload = {
        ...form,
        student_name: form.student_name.trim(),
        phone: form.phone.trim(),
        class_applied: form.class_applied.trim(),
        academic_session: form.academic_session.trim(),
        email: form.email?.trim() ? form.email.trim() : null,
        registration_no: form.registration_no?.trim() ? form.registration_no.trim() : undefined,
        registration_fee: form.registration_fee === "" ? null : Number(form.registration_fee),
      };

      // avoid sending empty strings as dates
      if (!payload.dob) delete payload.dob;
      if (!payload.registration_date) delete payload.registration_date;

      if (editingRow) {
        await api.put(`${BASE}/${editingRow.id}`, payload);
        Swal.fire("Updated!", "Registration updated successfully.", "success");
      } else {
        await api.post(BASE, payload);
        Swal.fire("Added!", "Registration created successfully.", "success");
      }

      setEditingRow(null);
      setForm({ ...emptyForm });
      setShowModal(false);
      fetchRegistrations();
    } catch (error) {
      console.error("Error saving registration:", error);
      const msg =
        error?.response?.data?.message ||
        "Failed to save registration. Please check inputs.";
      Swal.fire("Error", msg, "error");
    }
  };

  const deleteRegistration = async (id) => {
    if (!canDelete) {
      return Swal.fire("Forbidden", "Only Admin/Superadmin can delete.", "warning");
    }

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`${BASE}/${id}`);
          Swal.fire("Deleted!", "Registration deleted.", "success");
          fetchRegistrations();
        } catch (error) {
          console.error("Error deleting registration:", error);
          Swal.fire("Error", "Failed to delete registration.", "error");
        }
      }
    });
  };

  const openFeeModal = (row) => {
    setEditingRow(row);
    setFeeForm({
      registration_fee:
        row?.registration_fee !== null && row?.registration_fee !== undefined
          ? String(row.registration_fee)
          : "",
      fee_status: row?.fee_status || "unpaid",
      payment_ref: row?.payment_ref || "",
      remarks: row?.remarks || "",
    });
    setFeeModalOpen(true);
  };

  const saveFee = async () => {
    try {
      if (!editingRow) return;

      const payload = {
        registration_fee: feeForm.registration_fee === "" ? null : Number(feeForm.registration_fee),
        fee_status: feeForm.fee_status,
        payment_ref: feeForm.payment_ref?.trim() ? feeForm.payment_ref.trim() : null,
        remarks: feeForm.remarks,
      };

      await api.patch(`${BASE}/${editingRow.id}/fee`, payload);

      Swal.fire("Saved!", "Fee updated successfully.", "success");
      setFeeModalOpen(false);
      fetchRegistrations();
    } catch (error) {
      console.error("Error updating fee:", error);
      const msg = error?.response?.data?.message || "Failed to update fee.";
      Swal.fire("Error", msg, "error");
    }
  };

  const openStatusModal = (row) => {
    setEditingRow(row);
    setStatusForm({
      status: row?.status || "registered",
      remarks: row?.remarks || "",
    });
    setStatusModalOpen(true);
  };

  const saveStatus = async () => {
    try {
      if (!editingRow) return;

      const payload = {
        status: statusForm.status,
        remarks: statusForm.remarks,
      };

      await api.patch(`${BASE}/${editingRow.id}/status`, payload);

      Swal.fire("Saved!", "Status updated successfully.", "success");
      setStatusModalOpen(false);
      fetchRegistrations();
    } catch (error) {
      console.error("Error updating status:", error);
      const msg = error?.response?.data?.message || "Failed to update status.";
      Swal.fire("Error", msg, "error");
    }
  };

  // Search filter
  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const hay = [
        r.registration_no,
        r.student_name,
        r.phone,
        r.class_applied,
        r.academic_session,
        r.status,
        r.fee_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  useEffect(() => {
    if (!canView) return;
    fetchRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!canView) {
    return (
      <div className="container mt-4">
        <h1>Registrations</h1>
        <div className="alert alert-warning">
          You don&apos;t have permission to view registrations.
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h1>Registrations Management</h1>

      {/* Add Button */}
      {canEditDetails && (
        <button className="btn btn-success mb-3" onClick={openCreate}>
          Add Registration
        </button>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search by Reg No / Name / Phone / Class / Session / Status"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Reg No</th>
            <th>Student</th>
            <th>Phone</th>
            <th>Class</th>
            <th>Session</th>
            <th>Status</th>
            <th>Fee</th>
            <th>Fee Status</th>
            <th>Date</th>
            {(canEditDetails || canUpdateFee || canUpdateStatus || canDelete) && (
              <th>Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, index) => (
            <tr key={r.id}>
              <td>{index + 1}</td>
              <td>{r.registration_no || "-"}</td>
              <td>{r.student_name || "-"}</td>
              <td>{r.phone || "-"}</td>
              <td>{r.class_applied || "-"}</td>
              <td>{r.academic_session || "-"}</td>
              <td>{r.status || "-"}</td>
              <td>
                {r.registration_fee !== null && r.registration_fee !== undefined
                  ? r.registration_fee
                  : "-"}
              </td>
              <td>{r.fee_status || "-"}</td>
              <td>
                {r.registration_date
                  ? new Date(r.registration_date).toLocaleDateString()
                  : "-"}
              </td>
              {(canEditDetails || canUpdateFee || canUpdateStatus || canDelete) && (
                <td>
                  {canEditDetails && (
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => openEdit(r)}
                    >
                      Edit
                    </button>
                  )}

                  {canUpdateStatus && (
                    <button
                      className="btn btn-warning btn-sm me-2"
                      onClick={() => openStatusModal(r)}
                    >
                      Status
                    </button>
                  )}

                  {canUpdateFee && (
                    <button
                      className="btn btn-info btn-sm me-2"
                      onClick={() => openFeeModal(r)}
                    >
                      Fee
                    </button>
                  )}

                  {isSuperadmin && canDelete && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteRegistration(r.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}

          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={
                  (canEditDetails || canUpdateFee || canUpdateStatus || canDelete)
                    ? 11
                    : 10
                }
                className="text-center"
              >
                No registrations found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* MAIN MODAL (Create / Edit) */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingRow ? "Edit Registration" : "Add Registration"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>

              <div className="modal-body">
                {/* Row 1 */}
                <div className="row">
                  <div className="col-md-4">
                    <label className="form-label">Registration No (optional)</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder="Auto if empty"
                      value={form.registration_no || ""}
                      onChange={(e) =>
                        setForm({ ...form, registration_no: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Academic Session *</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder="e.g. 2025-26"
                      value={form.academic_session || ""}
                      onChange={(e) =>
                        setForm({ ...form, academic_session: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Class Applied *</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder="e.g. Nursery"
                      value={form.class_applied || ""}
                      onChange={(e) =>
                        setForm({ ...form, class_applied: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Row 2 */}
                <div className="row">
                  <div className="col-md-4">
                    <label className="form-label">Student Name *</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={form.student_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, student_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Phone *</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={form.phone || ""}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control mb-3"
                      value={form.email || ""}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 3 */}
                <div className="row">
                  <div className="col-md-4">
                    <label className="form-label">Father Name</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={form.father_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, father_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Mother Name</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={form.mother_name || ""}
                      onChange={(e) =>
                        setForm({ ...form, mother_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">DOB</label>
                    <input
                      type="date"
                      className="form-control mb-3"
                      value={form.dob || ""}
                      onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    />
                  </div>
                </div>

                {/* Row 4 */}
                <div className="row">
                  <div className="col-md-4">
                    <label className="form-label">Gender</label>
                    <select
                      className="form-control mb-3"
                      value={form.gender || ""}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Registration Date (optional)</label>
                    <input
                      type="datetime-local"
                      className="form-control mb-3"
                      value={form.registration_date || ""}
                      onChange={(e) =>
                        setForm({ ...form, registration_date: e.target.value })
                      }
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Status</label>
                    <select
                      className="form-control mb-3"
                      value={form.status || "registered"}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option value="registered">Registered</option>
                      <option value="selected">Selected</option>
                      <option value="rejected">Rejected</option>
                      <option value="admitted">Admitted</option>
                    </select>
                  </div>
                </div>

                {/* Address + Remarks */}
                <label className="form-label">Address</label>
                <textarea
                  className="form-control mb-3"
                  rows={2}
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />

                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.remarks || ""}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                />
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveRegistration}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEE MODAL */}
      {feeModalOpen && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Fee</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setFeeModalOpen(false)}
                ></button>
              </div>

              <div className="modal-body">
                <label className="form-label">Registration Fee</label>
                <input
                  type="number"
                  className="form-control mb-3"
                  value={feeForm.registration_fee}
                  onChange={(e) =>
                    setFeeForm({ ...feeForm, registration_fee: e.target.value })
                  }
                />

                <label className="form-label">Fee Status</label>
                <select
                  className="form-control mb-3"
                  value={feeForm.fee_status}
                  onChange={(e) =>
                    setFeeForm({ ...feeForm, fee_status: e.target.value })
                  }
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>

                <label className="form-label">Payment Ref</label>
                <input
                  type="text"
                  className="form-control mb-3"
                  value={feeForm.payment_ref}
                  onChange={(e) =>
                    setFeeForm({ ...feeForm, payment_ref: e.target.value })
                  }
                />

                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={feeForm.remarks}
                  onChange={(e) =>
                    setFeeForm({ ...feeForm, remarks: e.target.value })
                  }
                />
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setFeeModalOpen(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveFee}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS MODAL */}
      {statusModalOpen && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Status</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setStatusModalOpen(false)}
                ></button>
              </div>

              <div className="modal-body">
                <label className="form-label">Status</label>
                <select
                  className="form-control mb-3"
                  value={statusForm.status}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, status: e.target.value })
                  }
                >
                  <option value="registered">Registered</option>
                  <option value="selected">Selected</option>
                  <option value="rejected">Rejected</option>
                  <option value="admitted">Admitted</option>
                </select>

                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={statusForm.remarks}
                  onChange={(e) =>
                    setStatusForm({ ...statusForm, remarks: e.target.value })
                  }
                />
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setStatusModalOpen(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveStatus}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Registrations;
