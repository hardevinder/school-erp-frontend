// src/pages/FeeCategory.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./FeeCategory.css";

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

const FeeCategory = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [feeCategories, setFeeCategories] = useState([]);
  const [searchText, setSearchText] = useState("");

  // ============================= Fetch =============================
  const fetchFeeCategories = async () => {
    try {
      const { data } = await api.get("/fee_categories");
      setFeeCategories(data);
    } catch (error) {
      console.error("Error fetching fee categories:", error);
      Swal.fire("Error", "Failed to fetch fee categories.", "error");
    }
  };

  // ============================= CRUD ==============================
  const handleDelete = async (category) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Delete fee category: ${category.name}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/fee_categories/${category.id}`);
        Swal.fire("Deleted!", "Fee category has been deleted.", "success");
        fetchFeeCategories();
      } catch (error) {
        console.error("Error deleting fee category:", error);
        Swal.fire("Error", "Failed to delete fee category.", "error");
      }
    }
  };

  const handleAdd = async () => {
    const { value: formValues } = await Swal.fire({
      title: "Add New Fee Category",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <label for="fc-name">Name</label>
          <input id="fc-name" class="form-field" placeholder="Name">
          <label for="fc-desc" class="mt-2">Description</label>
          <input id="fc-desc" class="form-field" placeholder="Description">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Add",
      preConfirm: () => {
        const name = document.getElementById("fc-name").value.trim();
        const description = document.getElementById("fc-desc").value.trim();
        if (!name) {
          Swal.showValidationMessage("Name is required");
          return false;
        }
        return { name, description };
      },
    });

    if (formValues) {
      try {
        await api.post("/fee_categories", formValues);
        Swal.fire("Added!", "Fee category has been added.", "success");
        fetchFeeCategories();
      } catch (error) {
        console.error("Error adding fee category:", error);
        Swal.fire("Error", "Failed to add fee category.", "error");
      }
    }
  };

  const handleEdit = async (category) => {
    const { value: formValues } = await Swal.fire({
      title: "Edit Fee Category",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <label for="fc-name">Name</label>
          <input id="fc-name" class="form-field" value="${category.name}" placeholder="Name">
          <label for="fc-desc" class="mt-2">Description</label>
          <input id="fc-desc" class="form-field" value="${category.description || ""}" placeholder="Description">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: () => {
        const name = document.getElementById("fc-name").value.trim();
        const description = document.getElementById("fc-desc").value.trim();
        if (!name) {
          Swal.showValidationMessage("Name is required");
          return false;
        }
        return { name, description };
      },
    });

    if (formValues) {
      try {
        await api.put(`/fee_categories/${category.id}`, formValues);
        Swal.fire("Updated!", "Fee category has been updated.", "success");
        fetchFeeCategories();
      } catch (error) {
        console.error("Error updating fee category:", error);
        Swal.fire("Error", "Failed to update fee category.", "error");
      }
    }
  };

  // ============================= Filter ============================
  const filteredCategories = feeCategories.filter((cat) =>
    cat.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // ============================= Mount =============================
  useEffect(() => {
    fetchFeeCategories();
  }, []);

  // ============================= Render ============================
  return (
    <div className="container mt-4">
      <h1>Fee Category Management</h1>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search fee categories..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {/* Add Button */}
      {canEdit && (
        <button className="btn btn-success mb-3" onClick={handleAdd}>
          Add Fee Category
        </button>
      )}

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Description</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filteredCategories.length > 0 ? (
            filteredCategories.map((category, index) => (
              <tr key={category.id}>
                <td>{index + 1}</td>
                <td>{category.name}</td>
                <td>{category.description}</td>
                {canEdit && (
                  <td>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => handleEdit(category)}
                    >
                      Edit
                    </button>
                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(category)}
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
              <td colSpan={canEdit ? 4 : 3} className="text-center">
                No fee categories found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FeeCategory;
