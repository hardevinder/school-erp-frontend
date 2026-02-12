// src/pages/Registrations.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");

  // ✅ safer parse for roles
  const raw = localStorage.getItem("roles");
  let multiRoles = [];
  try {
    const parsed = JSON.parse(raw || "[]");
    multiRoles = Array.isArray(parsed) ? parsed : [];
  } catch {
    multiRoles = [];
  }

  const roles = (multiRoles.length ? multiRoles : [singleRole].filter(Boolean)).map((r) =>
    String(r || "").toLowerCase().trim()
  );

  const isAdmin = roles.includes("admin");
  const isSuperadmin = roles.includes("superadmin");

  const isAdmission = roles.includes("admission") || roles.includes("frontoffice");
  const isAccounts = roles.includes("accounts");
  const isCoordinator = roles.includes("academic_coordinator");

  // View allowed
  const canView =
    isAdmin ||
    isSuperadmin ||
    isAdmission ||
    isAccounts ||
    isCoordinator ||
    roles.includes("hr") ||
    roles.includes("teacher");

  // Full CRUD details
  const canEditDetails =
    isAdmin ||
    isSuperadmin ||
    isAdmission ||
    isCoordinator ||
    roles.includes("hr") ||
    roles.includes("teacher");

  // Fee update only
  const canUpdateFee = isAccounts || isAdmin || isSuperadmin;

  // Status update
  const canUpdateStatus = isAdmission || isCoordinator || isAdmin || isSuperadmin;

  // Delete only
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

// ✅ helper: robust time getter for "recent first"
const getRegTime = (r) => {
  const val =
    r?.registration_date ||
    r?.createdAt ||
    r?.created_at ||
    r?.updatedAt ||
    r?.updated_at;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const Registrations = () => {
  const flags = useMemo(getRoleFlags, []);
  const { canView, canEditDetails, canUpdateFee, canUpdateStatus, canDelete, isSuperadmin } =
    flags;

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

  // ✅ export/import/next-no states
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [printingId, setPrintingId] = useState(null);

  const [regNoSuggestion, setRegNoSuggestion] = useState("");

  // ---- API base path ------------------------------------------------------
  const BASE = "/registrations";

  const fetchRegistrations = async () => {
    try {
      const { data } = await api.get(BASE);
      const arr = Array.isArray(data) ? data : [];

      // ✅ force recent first (top to bottom)
      arr.sort((a, b) => getRegTime(b) - getRegTime(a));

      setRows(arr);
    } catch (error) {
      console.error("Error fetching registrations:", error);
      Swal.fire("Error", "Failed to fetch registrations.", "error");
    }
  };

  // ✅ get next registration no (optional helper)
  const fetchNextRegNo = async (sessionValue) => {
    try {
      const session = String(sessionValue || "").trim();
      if (!session) {
        setRegNoSuggestion("");
        return;
      }
      setSuggesting(true);

      const { data } = await api.get(`${BASE}/next-no`, {
        params: { academic_session: session },
      });

      const suggestion = data?.suggestion || "";
      setRegNoSuggestion(suggestion);
    } catch (err) {
      console.error("next-no failed:", err);
      setRegNoSuggestion("");
    } finally {
      setSuggesting(false);
    }
  };

  const openCreate = () => {
    setEditingRow(null);
    setForm({ ...emptyForm });
    setRegNoSuggestion("");
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditingRow(row);
    setRegNoSuggestion("");

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
      if (
        !form.student_name.trim() ||
        !form.phone.trim() ||
        !form.class_applied.trim() ||
        !form.academic_session.trim()
      ) {
        Swal.fire(
          "Error",
          "Student name, phone, class applied, and academic session are required.",
          "error"
        );
        return;
      }

      const payload = {
        ...form,
        student_name: form.student_name.trim(),
        phone: form.phone.trim(),
        class_applied: form.class_applied.trim(),
        academic_session: form.academic_session.trim(),
        email: form.email?.trim() ? form.email.trim() : null,

        registration_no: form.registration_no?.trim()
          ? form.registration_no.trim()
          : undefined, // backend auto if undefined/empty

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
      setRegNoSuggestion("");
      setShowModal(false);
      fetchRegistrations();
    } catch (error) {
      console.error("Error saving registration:", error);
      const msg =
        error?.response?.data?.message || "Failed to save registration. Please check inputs.";
      Swal.fire("Error", msg, "error");
    }
  };

  const deleteRegistration = async (id) => {
    if (!canDelete) {
      return Swal.fire("Forbidden", "Only Admin/Superadmin can delete.", "warning");
    }

    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.delete(`${BASE}/${id}`);
      Swal.fire("Deleted!", "Registration deleted.", "success");
      fetchRegistrations();
    } catch (error) {
      console.error("Error deleting registration:", error);
      Swal.fire("Error", "Failed to delete registration.", "error");
    }
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

  // ✅ Export Excel (download)
  const exportExcel = async () => {
    try {
      setDownloading(true);

      const resp = await api.get(`${BASE}/export`, { responseType: "blob" });
      const blob = new Blob([resp.data], {
        type:
          resp.headers?.["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const cd = resp.headers?.["content-disposition"] || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      a.download = match?.[1] || "Registrations.xlsx";

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("export failed:", err);
      Swal.fire("Error", "Failed to export Excel.", "error");
    } finally {
      setDownloading(false);
    }
  };

  // ✅ Import Excel
  const importExcel = async (file) => {
    if (!file) return;

    const ok =
      file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");

    if (!ok) {
      Swal.fire("Invalid", "Please upload .xlsx or .xls file.", "warning");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const confirm = await Swal.fire({
      title: "Import Registrations?",
      text: "This will add new registrations from the Excel file.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, import",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!confirm.isConfirmed) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    try {
      setImporting(true);

      const fd = new FormData();
      fd.append("file", file);

      const { data } = await api.post(`${BASE}/import`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const imported = data?.message || "Import completed.";

      const dupCount = Array.isArray(data?.duplicates) ? data.duplicates.length : 0;
      const invalidCount = Array.isArray(data?.invalid) ? data.invalid.length : 0;

      let html = `<div style="text-align:left">
        <div><b>${imported}</b></div>
        <div style="margin-top:8px">Duplicates skipped: <b>${dupCount}</b></div>
        <div>Invalid rows skipped: <b>${invalidCount}</b></div>
      </div>`;

      // show small preview of issues (first 5 each)
      if (dupCount > 0 || invalidCount > 0) {
        const dPrev = (data.duplicates || []).slice(0, 5);
        const iPrev = (data.invalid || []).slice(0, 5);

        const listHtml = (arr, title) => {
          if (!arr.length) return "";
          const items = arr
            .map(
              (x) =>
                `<li>${x?.error || "Issue"}${
                  x?.registration_no ? ` (RegNo: ${x.registration_no})` : ""
                }</li>`
            )
            .join("");
          return `<div style="margin-top:10px"><b>${title} (showing up to 5)</b><ul>${items}</ul></div>`;
        };

        html += listHtml(dPrev, "Duplicates");
        html += listHtml(iPrev, "Invalid");
      }

      await Swal.fire({
        title: "Import Result",
        html,
        icon: "success",
        allowOutsideClick: false,
        allowEscapeKey: false,
      });

      fetchRegistrations();
    } catch (err) {
      console.error("import failed:", err);
      const msg = err?.response?.data?.message || "Failed to import Excel.";
      Swal.fire("Error", msg, "error");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ✅ NEW: Print Registration Form PDF
  const printForm = async (row) => {
    try {
      if (!row?.id) return;
      setPrintingId(row.id);

      const resp = await api.get(`${BASE}/${row.id}/print`, { responseType: "blob" });

      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      window.open(url, "_blank", "noopener,noreferrer");

      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (_) {}
      }, 60_000);
    } catch (err) {
      console.error("print failed:", err);
      Swal.fire("Error", "Failed to open print form (PDF).", "error");
    } finally {
      setPrintingId(null);
    }
  };

  // Search filter (✅ keeps newest-first too)
  const filtered = useMemo(() => {
    const base = !search
      ? [...rows]
      : rows.filter((r) => {
          const q = search.toLowerCase();
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

    // ✅ always recent top to bottom
    base.sort((a, b) => getRegTime(b) - getRegTime(a));
    return base;
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
        <div className="alert alert-warning">You don&apos;t have permission to view registrations.</div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h1>Registrations Management</h1>

      {/* Top actions */}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        {canEditDetails && (
          <button className="btn btn-success" onClick={openCreate}>
            Add Registration
          </button>
        )}

        {/* Export */}
        <button
          className="btn btn-outline-primary"
          onClick={exportExcel}
          disabled={downloading}
          title="Export registrations to Excel"
        >
          {downloading ? "Exporting..." : "Export Excel"}
        </button>

        {/* Import */}
        {(flags.isAdmin || flags.isSuperadmin || flags.isAdmission || flags.isAccounts) && (
          <div className="d-flex align-items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="form-control"
              style={{ maxWidth: 260 }}
              disabled={importing}
              onChange={(e) => importExcel(e.target.files?.[0])}
            />
            <button
              className="btn btn-outline-success"
              disabled={importing}
              onClick={() => {
                if (!fileRef.current?.files?.[0]) {
                  Swal.fire("Choose file", "Please select an Excel file first.", "info");
                  return;
                }
                importExcel(fileRef.current.files[0]);
              }}
            >
              {importing ? "Importing..." : "Import Excel"}
            </button>
          </div>
        )}
      </div>

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
            {(canEditDetails || canUpdateFee || canUpdateStatus || canDelete) && <th>Actions</th>}
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
                {r.registration_fee !== null && r.registration_fee !== undefined ? r.registration_fee : "-"}
              </td>
              <td>{r.fee_status || "-"}</td>
              <td>{r.registration_date ? new Date(r.registration_date).toLocaleDateString() : "-"}</td>

              {(canEditDetails || canUpdateFee || canUpdateStatus || canDelete) && (
                <td className="d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => printForm(r)}
                    disabled={printingId === r.id}
                    title="Open Registration Form PDF"
                  >
                    {printingId === r.id ? "Opening..." : "Print"}
                  </button>

                  {canEditDetails && (
                    <button className="btn btn-primary btn-sm" onClick={() => openEdit(r)}>
                      Edit
                    </button>
                  )}

                  {canUpdateStatus && (
                    <button className="btn btn-warning btn-sm" onClick={() => openStatusModal(r)}>
                      Status
                    </button>
                  )}

                  {canUpdateFee && (
                    <button className="btn btn-info btn-sm" onClick={() => openFeeModal(r)}>
                      Fee
                    </button>
                  )}

                  {isSuperadmin && canDelete && (
                    <button className="btn btn-danger btn-sm" onClick={() => deleteRegistration(r.id)}>
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
                colSpan={canEditDetails || canUpdateFee || canUpdateStatus || canDelete ? 11 : 10}
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
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingRow ? "Edit Registration" : "Add Registration"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>

              <div className="modal-body">
                {/* Row 1 */}
                <div className="row">
                  <div className="col-md-4">
                    <label className="form-label">Registration No (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Auto if empty"
                      value={form.registration_no || ""}
                      onChange={(e) => setForm({ ...form, registration_no: e.target.value })}
                    />
                    {!editingRow && !form.registration_no?.trim() && (
                      <div className="form-text">
                        {suggesting ? (
                          <span>Checking next reg no...</span>
                        ) : regNoSuggestion ? (
                          <span>
                            Suggested: <b>{regNoSuggestion}</b>
                            <button
                              type="button"
                              className="btn btn-link btn-sm ms-2 p-0"
                              onClick={() => setForm((p) => ({ ...p, registration_no: regNoSuggestion }))}
                            >
                              Use
                            </button>
                          </span>
                        ) : (
                          <span>Leave blank to auto-generate.</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Academic Session *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 2025-26"
                      value={form.academic_session || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm({ ...form, academic_session: v });

                        if (!editingRow) {
                          if (String(v).trim().length >= 4) fetchNextRegNo(v);
                          else setRegNoSuggestion("");
                        }
                      }}
                      onBlur={() => {
                        if (!editingRow) fetchNextRegNo(form.academic_session);
                      }}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Class Applied *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Nursery"
                      value={form.class_applied || ""}
                      onChange={(e) => setForm({ ...form, class_applied: e.target.value })}
                    />
                  </div>
                </div>

                <hr />

                {/* Row 2 */}
                <div className="row">
                  <div className="col-md-4">
                    <label className="form-label">Student Name *</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={form.student_name || ""}
                      onChange={(e) => setForm({ ...form, student_name: e.target.value })}
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
                      onChange={(e) => setForm({ ...form, father_name: e.target.value })}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Mother Name</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={form.mother_name || ""}
                      onChange={(e) => setForm({ ...form, mother_name: e.target.value })}
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
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Registration Date (optional)</label>
                    <input
                      type="datetime-local"
                      className="form-control mb-3"
                      value={form.registration_date || ""}
                      onChange={(e) => setForm({ ...form, registration_date: e.target.value })}
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
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Fee</h5>
                <button type="button" className="btn-close" onClick={() => setFeeModalOpen(false)}></button>
              </div>

              <div className="modal-body">
                <label className="form-label">Registration Fee</label>
                <input
                  type="number"
                  className="form-control mb-3"
                  value={feeForm.registration_fee}
                  onChange={(e) => setFeeForm({ ...feeForm, registration_fee: e.target.value })}
                />

                <label className="form-label">Fee Status</label>
                <select
                  className="form-control mb-3"
                  value={feeForm.fee_status}
                  onChange={(e) => setFeeForm({ ...feeForm, fee_status: e.target.value })}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>

                <label className="form-label">Payment Ref</label>
                <input
                  type="text"
                  className="form-control mb-3"
                  value={feeForm.payment_ref}
                  onChange={(e) => setFeeForm({ ...feeForm, payment_ref: e.target.value })}
                />

                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={feeForm.remarks}
                  onChange={(e) => setFeeForm({ ...feeForm, remarks: e.target.value })}
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
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Update Status</h5>
                <button type="button" className="btn-close" onClick={() => setStatusModalOpen(false)}></button>
              </div>

              <div className="modal-body">
                <label className="form-label">Status</label>
                <select
                  className="form-control mb-3"
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}
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
                  onChange={(e) => setStatusForm({ ...statusForm, remarks: e.target.value })}
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
