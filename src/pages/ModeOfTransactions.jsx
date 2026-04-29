// File: src/pages/ModeOfTransactions.jsx
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
  return d.rows || d.items || d.data || d.modes || d.mode_of_transactions || [];
};
const badge = (txt, kind = "secondary") => (
  <span className={`badge text-bg-${kind} rounded-pill`}>{txt}</span>
);

const modalCss = `
  <style>
    .swal2-popup.modeModal { padding: 14px 14px 12px; }
    .swal2-popup.modeModal .swal2-title { font-size: 18px; margin: 6px 0 10px; }
    .swal2-popup.modeModal .swal2-html-container { margin: 0; }
    .modeModal .mode-grid{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
      text-align:left;
    }
    .modeModal .mode-grid .full{ grid-column: 1 / -1; }
    .modeModal .mode-label{ font-size:12px; opacity:.75; margin:0 0 4px; }
    .modeModal .mode-field{
      width:100%;
      padding:10px 10px;
      border:1px solid rgba(0,0,0,.15);
      border-radius:10px;
      outline:none;
    }
    .modeModal .mode-field:focus{
      border-color: rgba(13,110,253,.55);
      box-shadow: 0 0 0 .2rem rgba(13,110,253,.15);
    }
    .modeModal .mode-box{
      max-height: 70vh;
      overflow:auto;
      padding-right:4px;
    }
    .modeModal .mode-checks{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
      margin-top:4px;
    }
    .modeModal .mode-check{
      display:flex;
      align-items:center;
      gap:8px;
      border:1px solid rgba(0,0,0,.08);
      padding:10px 12px;
      border-radius:10px;
      background:#fff;
    }
    @media (max-width: 576px){
      .modeModal .mode-grid{ grid-template-columns: 1fr; }
      .modeModal .mode-checks{ grid-template-columns: 1fr; }
      .swal2-popup.modeModal{ width: 95% !important; }
    }
  </style>
`;

const renderRequirementBadges = (mode) => {
  const chips = [];
  if (mode?.requires_bank) chips.push(badge("Bank", "primary"));
  if (mode?.requires_reference_no) chips.push(badge("Reference No", "info"));
  if (mode?.requires_cheque_no) chips.push(badge("Cheque No", "warning"));
  if (mode?.requires_cheque_date) chips.push(badge("Cheque Date", "dark"));

  return chips.length ? (
    <div className="d-flex flex-wrap gap-2">{chips}</div>
  ) : (
    <span className="text-muted">—</span>
  );
};

const ModeOfTransactions = () => {
  const { isSuperadmin, isAdmin, isAccounts } = useMemo(getRoleFlags, []);
  const canManage = isSuperadmin || isAdmin || isAccounts;

  const [modes, setModes] = useState([]);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchModes = async () => {
    setLoading(true);
    try {
      const res = await api.get("/mode-of-transactions");
      const list = asArray(res.data);
      setModes(Array.isArray(list) ? list : []);
      setError("");
    } catch (e) {
      console.error("Error fetching modes of transaction:", e);
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Failed to fetch modes of transaction."
      );
      Swal.fire("Error", "Failed to fetch modes of transaction.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModes();
  }, []);

  const handleDelete = async (id, name) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: `Delete mode (${safeStr(name)})?`,
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/mode-of-transactions/${id}`);
      Swal.fire("Deleted!", "Mode of transaction has been deleted.", "success");
      fetchModes();
    } catch (error) {
      console.error("Error deleting mode of transaction:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to delete the mode of transaction.";
      Swal.fire("Error", msg, "error");
    }
  };

  const openModeModal = async ({ mode, row }) => {
    if (!canManage) return Swal.fire("Forbidden", "Access denied.", "warning");

    const isEdit = mode === "edit";

    const name = safeStr(row?.name);
    const code = safeStr(row?.code);
    const description = safeStr(row?.description);
    const sort_order = row?.sort_order ?? 0;
    const active = row?.active !== false;

    const requires_bank = !!row?.requires_bank;
    const requires_reference_no = !!row?.requires_reference_no;
    const requires_cheque_no = !!row?.requires_cheque_no;
    const requires_cheque_date = !!row?.requires_cheque_date;

    const html = `
      ${modalCss}
      <div class="mode-box">
        <div class="mode-grid">

          <div class="full">
            <div class="mode-label">*Name</div>
            <input type="text" id="name" class="mode-field" placeholder="Cash / UPI / Cheque / Card" value="${name}" />
          </div>

          <div>
            <div class="mode-label">Code</div>
            <input type="text" id="code" class="mode-field" placeholder="CASH / UPI / CHEQUE" value="${code}" />
          </div>

          <div>
            <div class="mode-label">Sort Order</div>
            <input type="number" id="sort_order" class="mode-field" placeholder="0" value="${sort_order}" />
          </div>

          <div class="full">
            <div class="mode-label">Description</div>
            <input type="text" id="description" class="mode-field" placeholder="Optional description" value="${description}" />
          </div>

          <div class="full">
            <div class="mode-label">Required Fields</div>
            <div class="mode-checks">
              <label class="mode-check">
                <input type="checkbox" id="requires_bank" ${requires_bank ? "checked" : ""} />
                <span>Requires Bank</span>
              </label>

              <label class="mode-check">
                <input type="checkbox" id="requires_reference_no" ${requires_reference_no ? "checked" : ""} />
                <span>Requires Reference No</span>
              </label>

              <label class="mode-check">
                <input type="checkbox" id="requires_cheque_no" ${requires_cheque_no ? "checked" : ""} />
                <span>Requires Cheque No</span>
              </label>

              <label class="mode-check">
                <input type="checkbox" id="requires_cheque_date" ${requires_cheque_date ? "checked" : ""} />
                <span>Requires Cheque Date</span>
              </label>
            </div>
          </div>

          <div class="full d-flex align-items-center gap-2" style="margin-top:2px;">
            <input type="checkbox" id="active" ${active ? "checked" : ""} />
            <label for="active" style="margin:0;">Active</label>
          </div>

        </div>
      </div>
    `;

    const result = await Swal.fire({
      title: isEdit ? "Edit Mode of Transaction" : "Add New Mode of Transaction",
      width: 650,
      customClass: { popup: "modeModal" },
      allowOutsideClick: false,
      allowEscapeKey: false,
      html,
      showCancelButton: true,
      confirmButtonText: isEdit ? "Save" : "Add",
      preConfirm: () => {
        const name = safeStr(document.getElementById("name")?.value);
        if (!name) {
          Swal.showValidationMessage("Name is required.");
          return false;
        }

        const code = toNull(document.getElementById("code")?.value);
        const description = toNull(document.getElementById("description")?.value);

        const sortOrderRaw = document.getElementById("sort_order")?.value;
        const sortOrderNum =
          sortOrderRaw === "" || sortOrderRaw === null ? 0 : Number(sortOrderRaw);
        const sort_order = Number.isFinite(sortOrderNum) ? sortOrderNum : 0;

        const requires_bank = !!document.getElementById("requires_bank")?.checked;
        const requires_reference_no = !!document.getElementById("requires_reference_no")?.checked;
        const requires_cheque_no = !!document.getElementById("requires_cheque_no")?.checked;
        const requires_cheque_date = !!document.getElementById("requires_cheque_date")?.checked;
        const active = !!document.getElementById("active")?.checked;

        return {
          name,
          code,
          description,
          requires_bank,
          requires_reference_no,
          requires_cheque_no,
          requires_cheque_date,
          sort_order,
          active,
        };
      },
    });

    if (!result.isConfirmed) return;

    try {
      if (isEdit) {
        await api.put(`/mode-of-transactions/${row.id}`, result.value);
        Swal.fire("Updated!", "Mode of transaction has been updated successfully.", "success");
      } else {
        await api.post("/mode-of-transactions", result.value);
        Swal.fire("Added!", "Mode of transaction has been added successfully.", "success");
      }
      fetchModes();
    } catch (error) {
      console.error(isEdit ? "Update mode error:" : "Add mode error:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Request failed.";
      Swal.fire("Error", msg, "error");
    }
  };

  const handleAdd = () => openModeModal({ mode: "add" });
  const handleEdit = (row) => openModeModal({ mode: "edit", row });

  const filtered = useMemo(() => {
    const s = lower(search);

    const list = (modes || []).filter((m) => {
      if (!s) return true;

      const name = lower(m?.name);
      const code = lower(m?.code);
      const desc = lower(m?.description);

      const flags = [
        m?.requires_bank ? "bank" : "",
        m?.requires_reference_no ? "reference" : "",
        m?.requires_cheque_no ? "cheque" : "",
        m?.requires_cheque_date ? "date" : "",
      ].join(" ");

      return name.includes(s) || code.includes(s) || desc.includes(s) || lower(flags).includes(s);
    });

    return activeOnly ? list.filter((m) => m?.active !== false) : list;
  }, [modes, search, activeOnly]);

  const stats = useMemo(() => {
    const total = modes.length;
    const active = modes.filter((m) => m?.active !== false).length;
    const bankRequired = modes.filter((m) => m?.requires_bank).length;
    const refRequired = modes.filter((m) => m?.requires_reference_no).length;
    return { total, active, bankRequired, refRequired };
  }, [modes]);

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
        <div>
          <h1 className="m-0">Mode of Transaction</h1>
          <div className="text-muted" style={{ marginTop: 4 }}>
            Manage dynamic payment modes for fee collection.
          </div>

          <div className="d-flex flex-wrap gap-2 mt-2">
            {badge(`Total: ${stats.total}`, "dark")}
            {badge(`Active: ${stats.active}`, "success")}
            {badge(`Bank Required: ${stats.bankRequired}`, "primary")}
            {badge(`Ref Required: ${stats.refRequired}`, "info")}
            {loading ? badge("Updating…", "info") : badge("Live", "success")}
          </div>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-secondary" onClick={fetchModes} disabled={loading}>
            Refresh
          </button>

          <button className="btn btn-success" onClick={handleAdd} disabled={!canManage}>
            Add Mode
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
          <button className="btn btn-sm btn-light border" onClick={fetchModes}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 420 }}
          placeholder="Search name, code, description, requirement…"
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
              <th>Name</th>
              <th>Code</th>
              <th>Description</th>
              <th style={{ minWidth: 240 }}>Required Fields</th>
              <th>Sort</th>
              <th>Active</th>
              <th style={{ minWidth: 170 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan="8" className="text-center py-4 text-muted">
                  Loading…
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((row, index) => (
                <tr key={row.id}>
                  <td className="text-muted">{index + 1}</td>

                  <td>
                    <div className="fw-semibold">{safeStr(row.name) || "—"}</div>
                    <div className="small text-muted">ID: {row.id}</div>
                  </td>

                  <td>{safeStr(row.code) || "—"}</td>
                  <td>{safeStr(row.description) || "—"}</td>
                  <td>{renderRequirementBadges(row)}</td>
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

                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(row.id, row.name)}
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
                <td colSpan="8" className="text-center">
                  No modes of transaction found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css" />
    </div>
  );
};

export default ModeOfTransactions;