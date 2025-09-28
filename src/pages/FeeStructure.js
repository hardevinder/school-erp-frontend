import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./FeeStructure.css";
import { MultiSelect } from "react-multi-select-component";

// -------------------------------------------------------------
// Role helper: reads roles from localStorage (single or multiple)
// -------------------------------------------------------------
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

const safeDateOrNull = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toString() === "Invalid Date" ? null : dateStr;
};

const swalBaseOpts = {
  width: "700px",
  allowOutsideClick: false,
  allowEscapeKey: false,
  focusConfirm: false,
  showCancelButton: true,
};

const FeeStructure = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [feeStructures, setFeeStructures] = useState([]);
  const [classes, setClasses] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Selected session (single). default to active session if available
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Excel-style multi-select dropdown state (arrays of {label, value})
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedFeeHeadings, setSelectedFeeHeadings] = useState([]);

  // Quick search text (client-side filter)
  const [searchText, setSearchText] = useState("");

  // Bulk fill form state
  const [bulkValues, setBulkValues] = useState({
    feeDue: "",
    fineType: "percentage",
    finePercentage: "",
    fineAmountPerSlab: "",
    fineSlabDuration: "",
    fineStartDate: "",
    admissionType: "",
    concessionApplicable: "",
    transportApplicable: "",
  });
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  // unified fetch hook that will fetch fee structures based on session and refresh
  const fetchFeeStructures = useCallback(
    async ({ sessionId = selectedSessionId } = {}) => {
      try {
        const params = {};
        if (sessionId) params.session_id = sessionId;
        const query = new URLSearchParams(params).toString();
        const url = query ? `/fee-structures?${query}` : "/fee-structures";
        const { data } = await api.get(url);
        setFeeStructures(data.fees || []);
      } catch (err) {
        console.error("fetchFeeStructures error", err);
        Swal.fire("Error", "Failed to fetch fee structures.", "error");
      }
    },
    [selectedSessionId]
  );

  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(data);
      return data;
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch classes.", "error");
      return [];
    }
  };

  const fetchFeeHeadings = async () => {
    try {
      const { data } = await api.get("/fee-headings");
      setFeeHeadings(data);
      return data;
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch fee headings.", "error");
      return [];
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await api.get("/sessions");
      setSessions(data || []);

      // if no selected session, default to active session or first session
      if (!selectedSessionId) {
        const active = (data || []).find((s) => s.is_active) || (data && data[0]);
        if (active) setSelectedSessionId(active.id);
      }

      return data;
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch sessions.", "error");
      return [];
    }
  };

  // ---------------------------- CRUD ----------------------------
  const handleDelete = async (fee) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: "Are you sure you want to delete this fee structure?",
      text: `Class: ${fee.Class?.class_name || "Unknown"} - Fee Heading: ${fee.FeeHeading?.fee_heading || "Unknown"}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/fee-structures/${fee.id}`);
        Swal.fire("Deleted!", "Fee structure has been deleted.", "success");
        fetchFeeStructures({ sessionId: selectedSessionId });
      } catch (error) {
        Swal.fire("Error", "Failed to delete the fee structure.", "error");
      }
    }
  };

  const openAddOrEditModal = async (existing = null) => {
    // ensure dropdown data is loaded
    const classesData = classes.length ? classes : await fetchClasses();
    const feeHeadingsData = feeHeadings.length ? feeHeadings : await fetchFeeHeadings();
    const sessionData = sessions.length ? sessions : await fetchSessions();

    const classOptions = classesData
      .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
      .join("");
    const feeHeadingOptions = feeHeadingsData
      .map((fh) => `<option value="${fh.id}">${fh.fee_heading}</option>`)
      .join("");
    const sessionOptions = (sessionData || [])
      .map((s) => `<option value="${s.id}">${s.name}${s.is_active ? " (Active)" : ""}</option>`)
      .join("");

    const isEdit = Boolean(existing);
    const fineStartDateFormatted = existing && existing.fineStartDate
      ? new Date(existing.fineStartDate).toISOString().split("T")[0]
      : "";
    const originalFineType = existing?.fineType || "percentage";

    const html = `
      <div class="two-col-grid">
        <div class="full-row">
          <label>Session:</label>
          <select id="sessionId" class="form-field form-select">${sessionOptions}</select>
        </div>

        <div class="full-row">
          <label>Class:</label>
          <select id="classId" class="form-field form-select">${classOptions}</select>
        </div>

        <div class="full-row">
          <label>Fee Heading (Category):</label>
          <select id="feeHeadingId" class="form-field form-select">${feeHeadingOptions}</select>
        </div>

        <div>
          <label>Fee Due:</label>
          <input type="number" id="feeDue" class="form-field form-control" placeholder="Enter Fee Due" value="${existing?.feeDue ?? ""}">
        </div>

        <div>
          <label>Fine Type:</label>
          <select id="fineType" class="form-field form-select">
            <option value="percentage">Percentage</option>
            <option value="slab">Slab</option>
          </select>
        </div>

        <div id="finePercentageFields" class="full-row" style="display:${originalFineType === "percentage" ? "block" : "none"};">
          <label>Fine Percentage (%):</label>
          <input type="number" id="finePercentage" class="form-field form-control" value="${existing?.finePercentage ?? ""}">
        </div>

        <div id="fineSlabFields" class="full-row" style="display:${originalFineType === "slab" ? "block" : "none"};">
          <label>Fine Amount Per Slab:</label>
          <input type="number" id="fineAmountPerSlab" class="form-field form-control" value="${existing?.fineAmountPerSlab ?? ""}">
          <label class="mt-2">Fine Slab Duration (days):</label>
          <input type="number" id="fineSlabDuration" class="form-field form-control" value="${existing?.fineSlabDuration ?? ""}">
        </div>

        <div>
          <label>Fine Start Date:</label>
          <input type="date" id="fineStartDate" class="form-field form-control" value="${fineStartDateFormatted}">
        </div>

        <div>
          <label>Admission Type:</label>
          <select id="admissionType" class="form-field form-select">
            <option value="New">New</option>
            <option value="Old">Old</option>
            <option value="All">All</option>
          </select>
        </div>

        <div>
          <label>Concession Applicable:</label>
          <select id="concessionApplicable" class="form-field form-select">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div>
          <label>Transport Applicable:</label>
          <select id="transportApplicable" class="form-field form-select">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>
    `;

    return Swal.fire({
      ...swalBaseOpts,
      title: isEdit ? "Edit Fee Structure" : "Add New Fee Structure",
      html,
      didOpen: () => {
        // set current values if edit
        if (existing) {
          document.getElementById("sessionId").value = existing.Session?.id ?? selectedSessionId ?? "";
          document.getElementById("classId").value = existing.Class?.id ?? "";
          document.getElementById("feeHeadingId").value = existing.FeeHeading?.id ?? "";
          document.getElementById("admissionType").value = existing.admissionType ?? "";
          document.getElementById("concessionApplicable").value = existing.concessionApplicable ?? "No";
          document.getElementById("transportApplicable").value = existing.transportApplicable ?? "No";
          document.getElementById("fineType").value = existing.fineType ?? "percentage";
        } else {
          // default session select to currently selectedSessionId
          if (selectedSessionId) document.getElementById("sessionId").value = selectedSessionId;
        }

        const fineTypeSelect = document.getElementById("fineType");
        const pctBox = document.getElementById("finePercentageFields");
        const slabBox = document.getElementById("fineSlabFields");
        fineTypeSelect.addEventListener("change", () => {
          const isPct = fineTypeSelect.value === "percentage";
          pctBox.style.display = isPct ? "block" : "none";
          slabBox.style.display = isPct ? "none" : "block";
          if (isPct) {
            document.getElementById("fineAmountPerSlab").value = "";
            document.getElementById("fineSlabDuration").value = "";
          } else {
            document.getElementById("finePercentage").value = "";
          }
        });
      },
      preConfirm: () => {
        const fineType = document.getElementById("fineType").value;
        const sessionId = document.getElementById("sessionId").value;
        const admissionType = document.getElementById("admissionType").value;
        if (!sessionId) {
          Swal.showValidationMessage("Session is required");
          return false;
        }
        if (!admissionType) {
          Swal.showValidationMessage("Admission Type is required");
          return false;
        }

        return {
          session_id: sessionId,
          class_id: document.getElementById("classId").value,
          fee_heading_id: document.getElementById("feeHeadingId").value,
          feeDue: document.getElementById("feeDue").value,
          fineType,
          finePercentage: fineType === "percentage" ? document.getElementById("finePercentage").value : null,
          fineAmountPerSlab: fineType === "slab" ? document.getElementById("fineAmountPerSlab").value : null,
          fineSlabDuration: fineType === "slab" ? document.getElementById("fineSlabDuration").value : null,
          fineStartDate: safeDateOrNull(document.getElementById("fineStartDate").value),
          admissionType,
          concessionApplicable: document.getElementById("concessionApplicable").value,
          transportApplicable: document.getElementById("transportApplicable").value,
        };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          if (isEdit) {
            await api.put(`/fee-structures/${existing.id}`, res.value);
            Swal.fire("Updated!", "Fee structure has been updated successfully.", "success");
          } else {
            await api.post(`/fee-structures`, res.value);
            Swal.fire("Added!", "Fee structure has been added successfully.", "success");
          }
          // refresh with the session that was used/selected
          setSelectedSessionId(Number(res.value.session_id));
          fetchFeeStructures({ sessionId: Number(res.value.session_id) });
        } catch (e) {
          console.error(e);
          Swal.fire("Error", `Failed to ${isEdit ? "update" : "add"} the fee structure.`, "error");
        }
      }
    });
  };

  const handleAdd = () => openAddOrEditModal(null);
  const handleEdit = (fee) => openAddOrEditModal(fee);

  // ---------------------- Options & Filters ----------------------
  const classOptions = useMemo(
    () => classes.map((c) => ({ label: c.class_name, value: String(c.id) })),
    [classes]
  );
  const headingOptions = useMemo(
    () => feeHeadings.map((fh) => ({ label: fh.fee_heading, value: String(fh.id) })),
    [feeHeadings]
  );

  const filteredFeeStructures = useMemo(() => {
    const classSet = new Set(selectedClasses.map((s) => s.value));
    const headSet = new Set(selectedFeeHeadings.map((s) => s.value));
    const text = searchText.trim().toLowerCase();

    return feeStructures.filter((fee) => {
      const classId = String(fee.Class?.id ?? "");
      const headId = String(fee.FeeHeading?.id ?? "");
      const classMatch = classSet.size ? classSet.has(classId) : true;
      const headMatch = headSet.size ? headSet.has(headId) : true;

      const textMatch = !text || [fee.Class?.class_name, fee.FeeHeading?.fee_heading, (fee.feeDue||"")] 
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(text);

      return classMatch && headMatch && textMatch;
    });
  }, [feeStructures, selectedClasses, selectedFeeHeadings, searchText]);

  // ------------------------ Bulk Apply ---------------------------
  const buildBulkPayload = () => {
    const {
      feeDue,
      fineType,
      finePercentage,
      fineAmountPerSlab,
      fineSlabDuration,
      fineStartDate,
      admissionType,
      concessionApplicable,
      transportApplicable,
    } = bulkValues;

    const payload = {};
    if (feeDue !== "") payload.feeDue = Number(feeDue);
    if (fineType) payload.fineType = fineType;

    if (fineType === "percentage") {
      if (finePercentage !== "") payload.finePercentage = Number(finePercentage);
      payload.fineAmountPerSlab = null;
      payload.fineSlabDuration = null;
    } else if (fineType === "slab") {
      if (fineAmountPerSlab !== "") payload.fineAmountPerSlab = Number(fineAmountPerSlab);
      if (fineSlabDuration !== "") payload.fineSlabDuration = Number(fineSlabDuration);
      payload.finePercentage = null;
    }

    if (fineStartDate !== "") payload.fineStartDate = safeDateOrNull(fineStartDate);

    if (admissionType !== "") payload.admissionType = admissionType;
    if (concessionApplicable !== "") payload.concessionApplicable = concessionApplicable;
    if (transportApplicable !== "") payload.transportApplicable = transportApplicable;

    return payload;
  };

  const handleBulkApply = async () => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "Only Admin/Super Admin can perform bulk update.", "warning");
    }
    if (filteredFeeStructures.length === 0) {
      return Swal.fire("No Records", "There are no filtered fee structures to update.", "info");
    }

    const payload = buildBulkPayload();
    if (Object.keys(payload).length === 0) {
      return Swal.fire("Nothing to Update", "Please enter at least one field to apply.", "info");
    }

    const { value: confirmed } = await Swal.fire({
      title: "Apply to all filtered?",
      html: `
        <div style="text-align:left">
          This will update <b>${filteredFeeStructures.length}</b> fee structure(s) currently shown by your filters.<br/><br/>
          <b>Fields to set:</b>
          <pre style="white-space:pre-wrap;border:1px solid #eee;padding:8px;border-radius:6px;background:#fafafa;">${JSON.stringify(
            payload,
            null,
            2
          )}</pre>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, update all",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!confirmed) return;

    setIsBulkApplying(true);
    try {
      const results = await Promise.allSettled(
        filteredFeeStructures.map((fee) => api.put(`/fee-structures/${fee.id}`, payload))
      );

      const success = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - success;

      Swal.fire(
        "Bulk Update Complete",
        `Updated: ${success}\nFailed: ${failed}`,
        failed ? "warning" : "success"
      );
      fetchFeeStructures({ sessionId: selectedSessionId });
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Bulk update failed due to an unexpected error.", "error");
    } finally {
      setIsBulkApplying(false);
    }
  };

  // ---------------------------- Mount ----------------------------
  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchClasses(), fetchFeeHeadings()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selectedSessionId changes, fetch fees for that session
  useEffect(() => {
    fetchFeeStructures({ sessionId: selectedSessionId });
  }, [selectedSessionId, fetchFeeStructures]);

  // optional polling (keeps UI updated) - 5s
  useEffect(() => {
    const polling = setInterval(() => fetchFeeStructures({ sessionId: selectedSessionId }), 5000);
    return () => clearInterval(polling);
  }, [selectedSessionId, fetchFeeStructures]);

  // ---------------------------- Render ---------------------------
  return (
    <div className="container mt-4">
      <h1>Fee Structure Management</h1>

      {/* Session selector + Refresh + Search */}
      <div className="row g-3 mb-3 align-items-end">
        <div className="col-md-4">
          <label className="form-label">Session</label>
          <select
            className="form-select"
            value={selectedSessionId ?? ""}
            onChange={(e) => setSelectedSessionId(Number(e.target.value) || null)}
          >
            <option value="">(All sessions)</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.is_active ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-3">
          <label className="form-label">Quick Search</label>
          <input
            className="form-control"
            placeholder="Search by class, category or fee"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="col-md-2">
          <button className="btn btn-outline-secondary" onClick={() => fetchFeeStructures({ sessionId: selectedSessionId })}>
            Refresh
          </button>
        </div>

        <div className="col-md-3 text-end">
          {canEdit && (
            <button className="btn btn-success" onClick={handleAdd}>
              Add Fee Structure
            </button>
          )}
        </div>
      </div>

      {/* Excel-style Multi-select Filters */}
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <label className="form-label">Class</label>
          <MultiSelect
            options={classOptions}
            value={selectedClasses}
            onChange={setSelectedClasses}
            labelledBy="Select Classes"
            hasSelectAll={true}
            disableSearch={false}
            ClearSelectedIcon={null}
          />
          <small className="text-muted d-block mt-1">If none selected, all classes are included.</small>
        </div>
        <div className="col-md-6">
          <label className="form-label">Category (Fee Heading)</label>
          <MultiSelect
            options={headingOptions}
            value={selectedFeeHeadings}
            onChange={setSelectedFeeHeadings}
            labelledBy="Select Categories"
            hasSelectAll={true}
            disableSearch={false}
            ClearSelectedIcon={null}
          />
          <small className="text-muted d-block mt-1">If none selected, all categories are included.</small>
        </div>
      </div>

      {/* Bulk Fill Panel */}
      {canEdit && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <h5 className="card-title mb-3">Bulk Fill for Filtered</h5>
            <div className="row g-3">
              <div className="col-md-2">
                <label className="form-label">Fee Due</label>
                <input
                  type="number"
                  className="form-control"
                  value={bulkValues.feeDue}
                  onChange={(e) => setBulkValues((s) => ({ ...s, feeDue: e.target.value }))}
                  placeholder="e.g. 1500"
                />
              </div>

              <div className="col-md-2">
                <label className="form-label">Fine Type</label>
                <select
                  className="form-select"
                  value={bulkValues.fineType}
                  onChange={(e) => setBulkValues((s) => ({ ...s, fineType: e.target.value }))}
                >
                  <option value="percentage">Percentage</option>
                  <option value="slab">Slab</option>
                </select>
              </div>

              {bulkValues.fineType === "percentage" ? (
                <div className="col-md-2">
                  <label className="form-label">Fine %</label>
                  <input
                    type="number"
                    className="form-control"
                    value={bulkValues.finePercentage}
                    onChange={(e) => setBulkValues((s) => ({ ...s, finePercentage: e.target.value }))}
                    placeholder="%"
                  />
                </div>
              ) : (
                <>
                  <div className="col-md-2">
                    <label className="form-label">Amt/Slab</label>
                    <input
                      type="number"
                      className="form-control"
                      value={bulkValues.fineAmountPerSlab}
                      onChange={(e) => setBulkValues((s) => ({ ...s, fineAmountPerSlab: e.target.value }))}
                      placeholder="₹"
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Slab Days</label>
                    <input
                      type="number"
                      className="form-control"
                      value={bulkValues.fineSlabDuration}
                      onChange={(e) => setBulkValues((s) => ({ ...s, fineSlabDuration: e.target.value }))}
                      placeholder="days"
                    />
                  </div>
                </>
              )}

              <div className="col-md-2">
                <label className="form-label">Fine Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={bulkValues.fineStartDate}
                  onChange={(e) => setBulkValues((s) => ({ ...s, fineStartDate: e.target.value }))}
                />
              </div>

              <div className="w-100" />

              <div className="col-md-2">
                <label className="form-label">Admission Type</label>
                <select
                  className="form-select"
                  value={bulkValues.admissionType}
                  onChange={(e) => setBulkValues((s) => ({ ...s, admissionType: e.target.value }))}
                >
                  <option value="">(No change)</option>
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                  <option value="All">All</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">Concession</label>
                <select
                  className="form-select"
                  value={bulkValues.concessionApplicable}
                  onChange={(e) => setBulkValues((s) => ({ ...s, concessionApplicable: e.target.value }))}
                >
                  <option value="">(No change)</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">Transport</label>
                <select
                  className="form-select"
                  value={bulkValues.transportApplicable}
                  onChange={(e) => setBulkValues((s) => ({ ...s, transportApplicable: e.target.value }))}
                >
                  <option value="">(No change)</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div className="col-md-4 d-flex align-items-end justify-content-end">
                <button
                  className="btn btn-primary"
                  onClick={handleBulkApply}
                  disabled={isBulkApplying}
                  title={filteredFeeStructures.length ? `Apply to ${filteredFeeStructures.length} filtered item(s)` : "No filtered items"}
                >
                  {isBulkApplying ? "Applying..." : `Fill All Filtered (${filteredFeeStructures.length})`}
                </button>
              </div>
            </div>
            <small className="text-muted d-block mt-2">Only fields you enter/select are updated. Leave a field blank to keep existing values.</small>
          </div>
        </div>
      )}

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Session</th>
            <th>Class</th>
            <th>Category (Fee Heading)</th>
            <th>Fee Due</th>
            <th>Fine Type</th>
            <th>Fine (% or Slab)</th>
            <th>Fine Start Date</th>
            <th>Admission Type</th>
            <th>Concession Applicable</th>
            <th>Transport Applicable</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filteredFeeStructures.length > 0 ? (
            filteredFeeStructures.map((fee, index) => (
              <tr key={fee.id}>
                <td>{index + 1}</td>
                <td>{fee.Session?.name || "-"}</td>
                <td>{fee.Class?.class_name || "Unknown"}</td>
                <td>{fee.FeeHeading?.fee_heading || "Unknown"}</td>
                <td>{fee.feeDue}</td>
                <td>{fee.fineType}</td>
                <td>{fee.fineType === "percentage" ? (fee.finePercentage ?? "0") + "%" : `₹${fee.fineAmountPerSlab || "0"} / ${fee.fineSlabDuration || "0"} days`}</td>
                <td>{fee.fineStartDate || "N/A"}</td>
                <td>{fee.admissionType}</td>
                <td>{fee.concessionApplicable}</td>
                <td>{fee.transportApplicable}</td>
                {canEdit && (
                  <td>
                    <button className="btn btn-primary btn-sm me-2" onClick={() => handleEdit(fee)}>Edit</button>
                    {isSuperadmin && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(fee)}>Delete</button>}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={canEdit ? 12 : 11} className="text-center">No Fee Structures Found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FeeStructure;