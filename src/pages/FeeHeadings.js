// src/pages/FeeHeadings.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Import custom Axios instance
import Swal from "sweetalert2";

// ---- role helpers ---------------------------------------------------------
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

const FeeHeadings = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [feeHeadings, setFeeHeadings] = useState([]);
  const [feeCategories, setFeeCategories] = useState([]);
  const [newFeeHeading, setNewFeeHeading] = useState("");
  const [newFeeCategoryId, setNewFeeCategoryId] = useState("");
  const [editingFeeHeading, setEditingFeeHeading] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Fetch all fee headings
  const fetchFeeHeadings = async () => {
    try {
      const response = await api.get("/fee-headings");
      setFeeHeadings(response.data);
    } catch (error) {
      console.error("Error fetching fee headings:", error);
      Swal.fire("Error", "Failed to fetch fee headings.", "error");
    }
  };

  // Fetch fee categories
  const fetchFeeCategories = async () => {
    try {
      const response = await api.get("/fee_categories");
      setFeeCategories(response.data);
    } catch (error) {
      console.error("Error fetching fee categories:", error);
      Swal.fire("Error", "Failed to fetch fee categories.", "error");
    }
  };

  // Add or Update a fee heading
  const saveFeeHeading = async () => {
    try {
      if (!newFeeHeading.trim() || !newFeeCategoryId) {
        Swal.fire("Error", "Both Fee Heading and Fee Category are required.", "error");
        return;
      }

      if (editingFeeHeading) {
        await api.put(`/fee-headings/${editingFeeHeading.id}`, {
          fee_heading: newFeeHeading,
          fee_category_id: newFeeCategoryId,
        });
        Swal.fire("Updated!", "Fee heading has been updated successfully.", "success");
      } else {
        await api.post("/fee-headings", {
          fee_heading: newFeeHeading,
          fee_category_id: newFeeCategoryId,
        });
        Swal.fire("Added!", "Fee heading has been added successfully.", "success");
      }

      // reset
      setEditingFeeHeading(null);
      setNewFeeHeading("");
      setNewFeeCategoryId("");
      setShowModal(false);
      fetchFeeHeadings();
    } catch (error) {
      console.error("Error saving fee heading:", error);
      Swal.fire("Error", "Failed to save fee heading.", "error");
    }
  };

  // Delete (Superadmin only)
  const deleteFeeHeading = async (id) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/fee-headings/${id}`);
          Swal.fire("Deleted!", "Fee heading has been deleted.", "success");
          fetchFeeHeadings();
        } catch (error) {
          console.error("Error deleting fee heading:", error);
          Swal.fire("Error", "Failed to delete fee heading.", "error");
        }
      }
    });
  };

  // Filtered data
  const filteredHeadings = search
    ? feeHeadings.filter((fh) =>
        fh.fee_heading.toLowerCase().includes(search.toLowerCase())
      )
    : feeHeadings;

  useEffect(() => {
    fetchFeeHeadings();
    fetchFeeCategories();
  }, []);

  return (
    <div className="container mt-4">
      <h1>Fee Headings Management</h1>

      {/* Add Button (allow Admin/SuperAdmin only) */}
      {canEdit && (
        <button
          className="btn btn-success mb-3"
          onClick={() => {
            setEditingFeeHeading(null);
            setNewFeeHeading("");
            setNewFeeCategoryId("");
            setShowModal(true);
          }}
        >
          Add Fee Heading
        </button>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search Fee Headings"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Fee Heading</th>
            <th>Fee Category</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filteredHeadings.map((fh, index) => (
            <tr key={fh.id}>
              <td>{index + 1}</td>
              <td>{fh.fee_heading}</td>
              <td>{fh.FeeCategory ? fh.FeeCategory.name : "N/A"}</td>
              {canEdit && (
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => {
                      setEditingFeeHeading(fh);
                      setNewFeeHeading(fh.fee_heading);
                      setNewFeeCategoryId(fh.fee_category_id);
                      setShowModal(true);
                    }}
                  >
                    Edit
                  </button>
                  {isSuperadmin && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteFeeHeading(fh.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {filteredHeadings.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className="text-center">
                No fee headings found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modal Add/Edit */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingFeeHeading ? "Edit Fee Heading" : "Add Fee Heading"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Fee Heading"
                  value={newFeeHeading}
                  onChange={(e) => setNewFeeHeading(e.target.value)}
                />
                <select
                  className="form-control"
                  value={newFeeCategoryId}
                  onChange={(e) => setNewFeeCategoryId(e.target.value)}
                >
                  <option value="">Select Fee Category</option>
                  {feeCategories.map((fc) => (
                    <option key={fc.id} value={fc.id}>
                      {fc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveFeeHeading}>
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

export default FeeHeadings;
