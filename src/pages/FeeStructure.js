// src/pages/FeeStructure.jsx
// Superadmin-only Delete button, 2‑column SweetAlert forms, and no outside-click close

import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./FeeStructure.css";

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

  const [searchClass, setSearchClass] = useState("");
  const [searchFeeHead, setSearchFeeHead] = useState("");

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
            <label>Fee Heading:</label>
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
            <label>Fee Heading:</label>
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

  // --------------------------- Filters ---------------------------
  const filteredFeeStructures = useMemo(
    () =>
      feeStructures.filter((fee) => {
        const className = fee.Class?.class_name?.toLowerCase() || "";
        const feeHeading = fee.FeeHeading?.fee_heading?.toLowerCase() || "";
        return (
          className.includes(searchClass.toLowerCase()) &&
          feeHeading.includes(searchFeeHead.toLowerCase())
        );
      }),
    [feeStructures, searchClass, searchFeeHead]
  );

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

      {/* Search Inputs */}
      <div className="row mb-3">
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Class"
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Fee Heading"
            value={searchFeeHead}
            onChange={(e) => setSearchFeeHead(e.target.value)}
          />
        </div>
      </div>

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
            <th>Fee Heading</th>
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
                    ? fee.finePercentage || "0"
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
*/
