// File: src/pages/SchoolBankAccounts.jsx
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
    isAccounts: roles.includes("accounts"),
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
  return (
    d.rows ||
    d.items ||
    d.data ||
    d.bankAccounts ||
    d.school_bank_accounts ||
    []
  );
};
const badge = (txt, kind = "secondary") => (
  <span className={`badge text-bg-${kind} rounded-pill`}>{txt}</span>
);
const formatBankLabel = (row) =>
  [safeStr(row?.bank_name), safeStr(row?.account_name)].filter(Boolean).join(" - ") || "—";

const accountTypeOptions = ["CURRENT", "SAVINGS", "COLLECTION", "OTHER"];

const modalCss = `
  <style>
    .bankModal.swal2-popup { padding: 14px 14px 12px; }
    .bankModal .swal2-title { font-size: 18px; margin: 6px 0 10px; }
    .bankModal .swal2-html-container { margin: 0; }
    .bankModal .bank-grid{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
      text-align:left;
    }
    .bankModal .bank-grid .full{ grid-column: 1 / -1; }
    .bankModal .bank-label{ font-size:12px; opacity:.75; margin:0 0 4px; }
    .bankModal .bank-field{
      width:100%;
      padding:10px 10px;
      border:1px solid rgba(0,0,0,.15);
      border-radius:10px;
      outline:none;
      background:#fff;
    }
    .bankModal .bank-field:focus{
      border-color: rgba(13,110,253,.55);
      box-shadow: 0 0 0 .2rem rgba(13,110,253,.15);
    }
    .bankModal .bank-box{
      max-height: 72vh;
      overflow:auto;
      padding-right:4px;
    }
    .bankModal .bank-check{
      display:flex;
      align-items:center;
      gap:8px;
      border:1px solid rgba(0,0,0,.08);
      padding:10px 12px;
      border-radius:10px;
      background:#fff;
      margin-top:4px;
    }
    @media (max-width: 576px){
      .bankModal .bank-grid{ grid-template-columns: 1fr; }
      .swal2-popup.bankModal{ width: 95% !important; }
    }
  </style>
`;

const SchoolBankAccounts = () => {
  const { isSuperadmin, isAdmin, isAccounts } = useMemo(getRoleFlags, []);
  const canManage = isSuperadmin || isAdmin || isAccounts;

  const [bankAccounts, setBankAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchBankAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/school-bank-accounts");
      const list = asArray(res.data);
      setBankAccounts(Array.isArray(list) ? list : []);
      setError("");
    } catch (e) {
      console.error("Error fetching school bank accounts:", e);
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Failed to fetch school bank accounts."
      );
      Swal.fire("Error", "Failed to fetch school bank accounts.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const handleDelete = async (id, name) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: `Delete bank account (${safeStr(name)})?`,
      text: "If this account is already used, backend may deactivate it instead of deleting.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      const res = await api.delete(`/school-bank-accounts/${id}`);
      Swal.fire(
        res?.data?.deactivated ? "Deactivated!" : "Deleted!",
        res?.data?.message || "Bank account action completed successfully.",
        "success"
      );
      fetchBankAccounts();
    } catch (error) {
      console.error("Error deleting school bank account:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to delete the school bank account.";
      Swal.fire("Error", msg, "error");
    }
  };

  const handleToggleStatus = async (row) => {
    if (!canManage) {
      return Swal.fire("Forbidden", "Access denied.", "warning");
    }

    try {
      await api.patch(`/school-bank-accounts/${row.id}/toggle-status`);
      Swal.fire(
        "Updated!",
        `Bank account ${row?.active === false ? "activated" : "deactivated"} successfully.`,
        "success"
      );
      fetchBankAccounts();
    } catch (error) {
      console.error("Error toggling school bank account status:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to update status.";
      Swal.fire("Error", msg, "error");
    }
  };

  const openBankModal = async ({ mode, row }) => {
    if (!canManage) return Swal.fire("Forbidden", "Access denied.", "warning");

    const isEdit = mode === "edit";

    const bank_name = safeStr(row?.bank_name);
    const account_name = safeStr(row?.account_name);
    const account_number = safeStr(row?.account_number);
    const ifsc_code = safeStr(row?.ifsc_code);
    const branch_name = safeStr(row?.branch_name);
    const upi_id = safeStr(row?.upi_id);
    const account_type = safeStr(row?.account_type) || "CURRENT";
    const description = safeStr(row?.description);
    const sort_order = row?.sort_order ?? 0;
    const active = row?.active !== false;

    const html = `
      ${modalCss}
      <div class="bank-box">
        <div class="bank-grid">

          <div>
            <div class="bank-label">*Bank Name</div>
            <input type="text" id="bank_name" class="bank-field" placeholder="HDFC Bank / J&K Bank" value="${bank_name}" />
          </div>

          <div>
            <div class="bank-label">*Account Name</div>
            <input type="text" id="account_name" class="bank-field" placeholder="School Main Account" value="${account_name}" />
          </div>

          <div>
            <div class="bank-label">Account Number</div>
            <input type="text" id="account_number" class="bank-field" placeholder="Optional" value="${account_number}" />
          </div>

          <div>
            <div class="bank-label">IFSC Code</div>
            <input type="text" id="ifsc_code" class="bank-field" placeholder="Optional" value="${ifsc_code}" />
          </div>

          <div>
            <div class="bank-label">Branch Name</div>
            <input type="text" id="branch_name" class="bank-field" placeholder="Optional" value="${branch_name}" />
          </div>

          <div>
            <div class="bank-label">UPI ID</div>
            <input type="text" id="upi_id" class="bank-field" placeholder="Optional" value="${upi_id}" />
          </div>

          <div>
            <div class="bank-label">Account Type</div>
            <select id="account_type" class="bank-field">
              ${accountTypeOptions
                .map(
                  (opt) =>
                    `<option value="${opt}" ${opt === account_type ? "selected" : ""}>${opt}</option>`
                )
                .join("")}
            </select>
          </div>

          <div>
            <div class="bank-label">Sort Order</div>
            <input type="number" id="sort_order" class="bank-field" placeholder="0" value="${sort_order}" />
          </div>

          <div class="full">
            <div class="bank-label">Description</div>
            <input type="text" id="description" class="bank-field" placeholder="Optional description" value="${description}" />
          </div>

          <div class="full">
            <label class="bank-check">
              <input type="checkbox" id="active" ${active ? "checked" : ""} />
              <span>Active</span>
            </label>
          </div>

        </div>
      </div>
    `;

    const result = await Swal.fire({
      title: isEdit ? "Edit School Bank Account" : "Add School Bank Account",
      width: 700,
      customClass: { popup: "bankModal" },
      allowOutsideClick: false,
      allowEscapeKey: false,
      html,
      showCancelButton: true,
      confirmButtonText: isEdit ? "Save" : "Add",
      preConfirm: () => {
        const bank_name = safeStr(document.getElementById("bank_name")?.value);
        const account_name = safeStr(document.getElementById("account_name")?.value);

        if (!bank_name) {
          Swal.showValidationMessage("Bank name is required.");
          return false;
        }
        if (!account_name) {
          Swal.showValidationMessage("Account name is required.");
          return false;
        }

        const account_number = toNull(document.getElementById("account_number")?.value);
        const ifsc_code = toNull(document.getElementById("ifsc_code")?.value)?.toUpperCase() || null;
        const branch_name = toNull(document.getElementById("branch_name")?.value);
        const upi_id = toNull(document.getElementById("upi_id")?.value)?.toLowerCase() || null;
        const account_type = safeStr(document.getElementById("account_type")?.value) || "CURRENT";
        const description = toNull(document.getElementById("description")?.value);

        const sortOrderRaw = document.getElementById("sort_order")?.value;
        const sortOrderNum = sortOrderRaw === "" || sortOrderRaw === null ? 0 : Number(sortOrderRaw);
        const sort_order = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;

        const active = !!document.getElementById("active")?.checked;

        return {
          bank_name,
          account_name,
          account_number,
          ifsc_code,
          branch_name,
          upi_id,
          account_type,
          description,
          sort_order,
          active,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      if (isEdit) {
        await api.put(`/school-bank-accounts/${row.id}`, result.value);
        Swal.fire("Updated!", "School bank account updated successfully.", "success");
      } else {
        await api.post("/school-bank-accounts", result.value);
        Swal.fire("Added!", "School bank account added successfully.", "success");
      }
      fetchBankAccounts();
    } catch (error) {
      console.error(isEdit ? "Update bank account error:" : "Add bank account error:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Request failed.";
      Swal.fire("Error", msg, "error");
    }
  };

  const handleAdd = () => openBankModal({ mode: "add" });
  const handleEdit = (row) => openBankModal({ mode: "edit", row });

  const filtered = useMemo(() => {
    const s = lower(search);

    const list = (bankAccounts || []).filter((row) => {
      if (!s) return true;
      return [
        row?.bank_name,
        row?.account_name,
        row?.account_number,
        row?.ifsc_code,
        row?.branch_name,
        row?.upi_id,
        row?.account_type,
        row?.description,
      ].some((v) => lower(v).includes(s));
    });

    return activeOnly ? list.filter((row) => row?.active !== false) : list;
  }, [bankAccounts, search, activeOnly]);

  const stats = useMemo(() => {
    const total = bankAccounts.length;
    const active = bankAccounts.filter((row) => row?.active !== false).length;
    const withUpi = bankAccounts.filter((row) => safeStr(row?.upi_id)).length;
    const withIfsc = bankAccounts.filter((row) => safeStr(row?.ifsc_code)).length;
    return { total, active, withUpi, withIfsc };
  }, [bankAccounts]);

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h1 className="m-0">School Bank Accounts</h1>
          <div className="text-muted" style={{ marginTop: 4 }}>
            Manage receiving bank accounts for fee collection.
          </div>

          <div className="d-flex flex-wrap gap-2 mt-2">
            {badge(`Total: ${stats.total}`, "dark")}
            {badge(`Active: ${stats.active}`, "success")}
            {badge(`With UPI: ${stats.withUpi}`, "primary")}
            {badge(`With IFSC: ${stats.withIfsc}`, "info")}
            {loading ? badge("Updating…", "info") : badge("Live", "success")}
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary" onClick={fetchBankAccounts} disabled={loading}>
            Refresh
          </button>

          <button className="btn btn-success" onClick={handleAdd} disabled={!canManage}>
            Add Bank Account
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
          <button className="btn btn-sm btn-light border" onClick={fetchBankAccounts}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 420 }}
          placeholder="Search bank, account, IFSC, branch, UPI…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <label className="d-flex align-items-center gap-2 ms-1" style={{ userSelect: "none" }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          <span>Active only</span>
        </label>
      </div>

      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Bank</th>
              <th>Account No</th>
              <th>IFSC</th>
              <th>Branch</th>
              <th>UPI ID</th>
              <th>Type</th>
              <th>Sort</th>
              <th>Active</th>
              <th style={{ minWidth: 240 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="10" className="text-center py-4 text-muted">
                  Loading…
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((row, index) => (
                <tr key={row.id}>
                  <td className="text-muted">{index + 1}</td>

                  <td>
                    <div className="fw-semibold">{formatBankLabel(row)}</div>
                    <div className="small text-muted">ID: {row.id}</div>
                    {safeStr(row.description) ? (
                      <div className="small text-muted">{safeStr(row.description)}</div>
                    ) : null}
                  </td>

                  <td>{safeStr(row.account_number) || "—"}</td>
                  <td>{safeStr(row.ifsc_code) || "—"}</td>
                  <td>{safeStr(row.branch_name) || "—"}</td>
                  <td>{safeStr(row.upi_id) || "—"}</td>
                  <td>{safeStr(row.account_type) || "—"}</td>
                  <td>{row.sort_order ?? 0}</td>
                  <td>{row.active === false ? badge("No", "secondary") : badge("Yes", "success")}</td>

                  <td>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => handleEdit(row)}
                      disabled={!canManage}
                    >
                      Edit
                    </button>

                    <button
                      className={`btn btn-sm me-2 ${row?.active === false ? "btn-success" : "btn-outline-warning"}`}
                      onClick={() => handleToggleStatus(row)}
                      disabled={!canManage || loading}
                    >
                      {row?.active === false ? "Activate" : "Deactivate"}
                    </button>

                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(row.id, formatBankLabel(row))}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan="10" className="text-center">
                  No school bank accounts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
      />
    </div>
  );
};

export default SchoolBankAccounts;