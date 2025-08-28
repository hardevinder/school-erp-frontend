// src/pages/FeeStructure.jsx
// Superadmin-only Delete button, 2-column SweetAlert forms, no outside-click close
// Now with Excel-style multi-select dropdowns (checkboxes) for Class & Category and bulk "Fill All Filtered".

import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./FeeStructure.css";

// If your install name is different, switch this to:
//   import { MultiSelect } from "multi-select-component";
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

// Helper: if date invalid/empty -> null so backend can store NULL
const safeDateOrNull = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toString() === "Invalid Date" ? null : dateStr;
};

// Common SweetAlert options
const swalBaseOpts = {
  width: "650px",
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

  // Excel-style multi-select dropdown state (arrays of {label, value})
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedFeeHeadings, setSelectedFeeHeadings] = useState([]);

  // Bulk fill form state
  const [bulkValues, setBulkValues] = useState({
    feeDue: "",
    fineType: "percentage",
    finePercentage: "",
    fineAmountPerSlab: "",
    fineSlabDuration: "",
    fineStartDate: "",
    admissionType: "", // "", "New", "Old", "All"
    concessionApplicable: "", // "", "Yes", "No"
    transportApplicable: "", // "", "Yes", "No"
  });
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  // -------------------------- Fetchers --------------------------
  const fetchFeeStructures = async () => {
    try {
      const { data } = await api.get("/fee-structures");
      setFeeStructures(data.fees);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch fee structures.", "error");
    }
  };

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

  // ---------------------------- CRUD ----------------------------
  const handleDelete = async (fee) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: "Are you sure you want to delete this fee structure?",
      text: `Class: ${fee.Class?.class_name || "Unknown"} - Fee Heading: ${
        fee.FeeHeading?.fee_heading || "Unknown"
      }`,
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
        fetchFeeStructures();
      } catch (error) {
        Swal.fire("Error", "Failed to delete the fee structure.", "error");
      }
    }
  };

  const handleAdd = async () => {
    let classesData = classes.length ? classes : await fetchClasses();
    let feeHeadingsData = feeHeadings.length ? feeHeadings : await fetchFeeHeadings();

    const classOptions = classesData
      .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
      .join("");
    const feeHeadingOptions = feeHeadingsData
      .map((fh) => `<option value="${fh.id}">${fh.fee_heading}</option>`)
      .join("");

    Swal.fire({
      ...swalBaseOpts,
      title: "Add New Fee Structure",
      html: `
        <div class="two-col-grid">
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
            <input type="number" id="feeDue" class="form-field form-control" placeholder="Enter Fee Due">
          </div>

          <div>
            <label>Fine Type:</label>
            <select id="fineType" class="form-field form-select">
              <option value="percentage">Percentage</option>
              <option value="slab">Slab</option>
            </select>
          </div>

          <div id="finePercentageFields" class="full-row">
            <label>Fine Percentage (%):</label>
            <input type="number" id="finePercentage" class="form-field form-control" placeholder="Enter Fine %">
          </div>

          <div id="fineSlabFields" class="full-row" style="display:none;">
            <label>Fine Amount Per Slab:</label>
            <input type="number" id="fineAmountPerSlab" class="form-field form-control" placeholder="Amount/Slab">
            <label class="mt-2">Fine Slab Duration (days):</label>
            <input type="number" id="fineSlabDuration" class="form-field form-control" placeholder="Days/Slab">
          </div>

          <div>
            <label>Fine Start Date:</label>
            <input type="date" id="fineStartDate" class="form-field form-control">
          </div>

          <div>
            <label>Admission Type:</label>
            <select id="admissionType" class="form-field form-select">
              <option value="" disabled selected>Select</option>
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
      `,
      didOpen: () => {
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
        const admissionType = document.getElementById("admissionType").value;
        if (!admissionType) {
          Swal.showValidationMessage("Admission Type is required");
          return false;
        }
        return {
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
          await api.post("/fee-structures", res.value);
          Swal.fire("Added!", "Fee structure has been added successfully.", "success");
          fetchFeeStructures();
        } catch (e) {
          console.error(e);
          Swal.fire("Error", "Failed to add the fee structure.", "error");
        }
      }
    });
  };

  const handleEdit = async (fee) => {
    await fetchClasses();
    await fetchFeeHeadings();

    const fineStartDateFormatted = fee.fineStartDate
      ? new Date(fee.fineStartDate).toISOString().split("T")[0]
      : "";
    const originalFineType = fee.fineType || "percentage";

    const classOptions = classes
      .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
      .join("");
    const feeHeadingOptions = feeHeadings
      .map((fh) => `<option value="${fh.id}">${fh.fee_heading}</option>`)
      .join("");

    Swal.fire({
      ...swalBaseOpts,
      title: "Edit Fee Structure",
      html: `
        <div class="two-col-grid">
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
            <input type="number" id="feeDue" class="form-field form-control" value="${fee.feeDue}">
          </div>

          <div>
            <label>Fine Type:</label>
            <select id="fineType" class="form-field form-select">
              <option value="percentage">Percentage</option>
              <option value="slab">Slab</option>
            </select>
          </div>

          <div id="finePercentageFields" class="full-row" style="display:${
            originalFineType === "percentage" ? "block" : "none"
          };">
            <label>Fine Percentage (%):</label>
            <input type="number" id="finePercentage" class="form-field form-control" value="${
              fee.finePercentage || ""
            }">
          </div>

          <div id="fineSlabFields" class="full-row" style="display:${
            originalFineType === "slab" ? "block" : "none"
          };">
            <label>Fine Amount Per Slab:</label>
            <input type="number" id="fineAmountPerSlab" class="form-field form-control" value="${
              fee.fineAmountPerSlab || ""
            }">
            <label class="mt-2">Fine Slab Duration (days):</label>
            <input type="number" id="fineSlabDuration" class="form-field form-control" value="${
              fee.fineSlabDuration || ""
            }">
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
      `,
      didOpen: () => {
        document.getElementById("classId").value = fee.Class?.id ?? "";
        document.getElementById("feeHeadingId").value = fee.FeeHeading?.id ?? "";
        document.getElementById("admissionType").value = fee.admissionType ?? "";
        document.getElementById("concessionApplicable").value = fee.concessionApplicable ?? "No";
        document.getElementById("transportApplicable").value = fee.transportApplicable ?? "No";
        document.getElementById("fineType").value = originalFineType;

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
        return {
          class_id: document.getElementById("classId").value,
          fee_heading_id: document.getElementById("feeHeadingId").value,
          feeDue: document.getElementById("feeDue").value,
          fineType,
          finePercentage: fineType === "percentage" ? document.getElementById("finePercentage").value : null,
          fineAmountPerSlab: fineType === "slab" ? document.getElementById("fineAmountPerSlab").value : null,
          fineSlabDuration: fineType === "slab" ? document.getElementById("fineSlabDuration").value : null,
          fineStartDate: safeDateOrNull(document.getElementById("fineStartDate").value),
          admissionType: document.getElementById("admissionType").value,
          concessionApplicable: document.getElementById("concessionApplicable").value,
          transportApplicable: document.getElementById("transportApplicable").value,
        };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          await api.put(`/fee-structures/${fee.id}`, res.value);
          Swal.fire("Updated!", "Fee structure has been updated successfully.", "success");
          fetchFeeStructures();
        } catch (e) {
          Swal.fire("Error", "Failed to update the fee structure.", "error");
        }
      }
    });
  };

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
    return feeStructures.filter((fee) => {
      const classId = String(fee.Class?.id ?? "");
      const headId = String(fee.FeeHeading?.id ?? "");
      const classMatch = classSet.size ? classSet.has(classId) : true;
      const headMatch = headSet.size ? headSet.has(headId) : true;
      return classMatch && headMatch;
    });
  }, [feeStructures, selectedClasses, selectedFeeHeadings]);

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
      fetchFeeStructures();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Bulk update failed due to an unexpected error.", "error");
    } finally {
      setIsBulkApplying(false);
    }
  };

  // ---------------------------- Mount ----------------------------
  useEffect(() => {
    fetchFeeStructures();
    fetchClasses();
    fetchFeeHeadings();
    const pollingInterval = setInterval(fetchFeeStructures, 5000);
    return () => clearInterval(pollingInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------- Render ---------------------------
  return (
    <div className="container mt-4">
      <h1>Fee Structure Management</h1>

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
          <small className="text-muted d-block mt-1">
            If none selected, all classes are included.
          </small>
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
          <small className="text-muted d-block mt-1">
            If none selected, all categories are included.
          </small>
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
                      onChange={(e) =>
                        setBulkValues((s) => ({ ...s, fineAmountPerSlab: e.target.value }))
                      }
                      placeholder="₹"
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Slab Days</label>
                    <input
                      type="number"
                      className="form-control"
                      value={bulkValues.fineSlabDuration}
                      onChange={(e) =>
                        setBulkValues((s) => ({ ...s, fineSlabDuration: e.target.value }))
                      }
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
                  onChange={(e) =>
                    setBulkValues((s) => ({ ...s, concessionApplicable: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setBulkValues((s) => ({ ...s, transportApplicable: e.target.value }))
                  }
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
                  title={
                    filteredFeeStructures.length
                      ? `Apply to ${filteredFeeStructures.length} filtered item(s)`
                      : "No filtered items"
                  }
                >
                  {isBulkApplying ? "Applying..." : `Fill All Filtered (${filteredFeeStructures.length})`}
                </button>
              </div>
            </div>
            <small className="text-muted d-block mt-2">
              Only fields you enter/select are updated. Leave a field blank to keep existing values.
            </small>
          </div>
        </div>
      )}

      {/* Add Fee Structure Button */}
      {canEdit && (
        <button className="btn btn-success mb-3" onClick={handleAdd}>
          Add Fee Structure
        </button>
      )}

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
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
                <td>{fee.Class?.class_name || "Unknown"}</td>
                <td>{fee.FeeHeading?.fee_heading || "Unknown"}</td>
                <td>{fee.feeDue}</td>
                <td>{fee.fineType}</td>
                <td>
                  {fee.fineType === "percentage"
                    ? (fee.finePercentage ?? "0") + "%"
                    : `₹${fee.fineAmountPerSlab || "0"} / ${fee.fineSlabDuration || "0"} days`}
                </td>
                <td>{fee.fineStartDate || "N/A"}</td>
                <td>{fee.admissionType}</td>
                <td>{fee.concessionApplicable}</td>
                <td>{fee.transportApplicable}</td>
                {canEdit && (
                  <td>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => handleEdit(fee)}
                    >
                      Edit
                    </button>
                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(fee)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={canEdit ? 11 : 10} className="text-center">
                No Fee Structures Found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FeeStructure;

/* --------------------------------------------------------------
Add this to FeeStructure.css (or any global CSS loaded by the page):

.swal2-html-container .two-col-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}
.swal2-html-container .two-col-grid label {
  font-weight: 600;
  margin-bottom: 2px;
}
.swal2-html-container .two-col-grid .full-row {
  grid-column: 1 / 3;
}

/* Optional UI polish */
// .card .card-title {
//   font-weight: 600;
// }

/* Ensure the MultiSelect dropdown overlays within modals/containers nicely */
// .rmsc { --rmsc-radius: 8px; }
// .rmsc .dropdown-container { z-index: 10; }           /* local stacking */
// .rmsc .items, .rmsc .select-panel { z-index: 1056; }  /* above Bootstrap card/table; below SweetAlert (1060+) */
// */
