// src/pages/Schools.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./Schools.css";

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

const Schools = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState("");

  // ---------------- Fetch ----------------
  const fetchSchools = async () => {
    try {
      const response = await api.get("/schools");
      // controller returns { success: true, schools: [...] }
      setSchools(response.data?.schools || []);
    } catch (error) {
      console.error("fetchSchools error:", error);
      Swal.fire("Error", "Failed to fetch schools.", "error");
    }
  };

  // ---------------- Modal HTML ----------------
  const getModalHtml = (school = {}) => `
    <div class="form-container">
      <label for="swal-name">School Name *</label>
      <input id="swal-name" class="form-field" placeholder="School Name" value="${(school.name || "").replace(/"/g, "&quot;")}">
      
      <label for="swal-description">Description</label>
      <input id="swal-description" class="form-field" placeholder="Description" value="${(school.description || "").replace(/"/g, "&quot;")}">
      
      <label for="swal-phone">Phone Number</label>
      <input id="swal-phone" class="form-field" placeholder="Phone Number" value="${(school.phone || "").replace(/"/g, "&quot;")}">
      
      <label for="swal-email">Email</label>
      <input id="swal-email" class="form-field" placeholder="Email" value="${(school.email || "").replace(/"/g, "&quot;")}">
      
      <label for="swal-logo">Logo</label>
      <input type="file" id="swal-logo" class="form-field">
      
      <div id="swal-logo-preview" style="margin-top:10px;">
        ${
          school.logo
            ? `<img src="${school.logo}" style="width:100px;height:100px;object-fit:cover;border-radius:5px;" alt="Logo Preview">`
            : ""
        }
      </div>
    </div>
  `;

  // ---------------- Add ----------------
  const handleAdd = async () => {
    let file = null;

    Swal.fire({
      title: "Add New School",
      width: "750px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: getModalHtml(),
      showCancelButton: true,
      confirmButtonText: "Add",
      didOpen: () => {
        const popup = Swal.getPopup();
        const fileInput = popup.querySelector("#swal-logo");
        fileInput.addEventListener("change", (e) => {
          file = e.target.files[0];
          if (file) {
            const previewUrl = URL.createObjectURL(file);
            popup.querySelector(
              "#swal-logo-preview"
            ).innerHTML = `<img src="${previewUrl}" style="width:100px;height:100px;object-fit:cover;border-radius:5px;" alt="Logo Preview">`;
          }
        });
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const name = popup.querySelector("#swal-name").value.trim();
        if (!name) {
          Swal.showValidationMessage("School Name is required");
          return false;
        }
        return {
          name,
          description: popup.querySelector("#swal-description").value.trim(),
          phone: popup.querySelector("#swal-phone").value.trim(),
          email: popup.querySelector("#swal-email").value.trim(),
        };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const values = res.value;
          const formData = new FormData();
          formData.append("name", values.name);
          formData.append("description", values.description || "");
          formData.append("phone", values.phone || "");
          formData.append("email", values.email || "");
          if (file) formData.append("logo", file);

          await api.post("/schools", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          Swal.fire("Added!", "School has been added successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Add school error:", err);
          Swal.fire("Error", "Failed to add the school.", "error");
        }
      }
    });
  };

  // ---------------- Edit ----------------
  const handleEdit = async (school) => {
    let file = null;

    Swal.fire({
      title: "Edit School",
      width: "750px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: getModalHtml(school),
      showCancelButton: true,
      confirmButtonText: "Update",
      didOpen: () => {
        const popup = Swal.getPopup();
        const fileInput = popup.querySelector("#swal-logo");
        fileInput.addEventListener("change", (e) => {
          file = e.target.files[0];
          if (file) {
            const previewUrl = URL.createObjectURL(file);
            popup.querySelector(
              "#swal-logo-preview"
            ).innerHTML = `<img src="${previewUrl}" style="width:100px;height:100px;object-fit:cover;border-radius:5px;" alt="Logo Preview">`;
          }
        });
      },
      preConfirm: () => {
        const popup = Swal.getPopup();
        const name = popup.querySelector("#swal-name").value.trim();
        if (!name) {
          Swal.showValidationMessage("School Name is required");
          return false;
        }
        return {
          name,
          description: popup.querySelector("#swal-description").value.trim(),
          phone: popup.querySelector("#swal-phone").value.trim(),
          email: popup.querySelector("#swal-email").value.trim(),
        };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const values = res.value;
          const formData = new FormData();
          formData.append("name", values.name);
          formData.append("description", values.description || "");
          formData.append("phone", values.phone || "");
          formData.append("email", values.email || "");
          // append file only if a new file was selected
          if (file) formData.append("logo", file);

          await api.put(`/schools/${school.id}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          Swal.fire("Updated!", "School has been updated successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Update school error:", err);
          Swal.fire("Error", "Failed to update the school.", "error");
        }
      }
    });
  };

  // ---------------- Delete (Superadmin only) ----------------
  const handleDelete = async (school) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete "${school.name}". This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          await api.delete(`/schools/${school.id}`);
          Swal.fire("Deleted!", "School has been deleted successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Delete school error:", err);
          Swal.fire("Error", "Failed to delete the school.", "error");
        }
      }
    });
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const filtered = schools.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Schools Management</h1>
        {canEdit && (
          <button className="btn btn-success" onClick={handleAdd}>
            Add School
          </button>
        )}
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50"
          placeholder="Search Schools"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table table-striped table-bordered">
        <thead className="table-dark">
          <tr>
            <th>#</th>
            <th>Logo</th>
            <th>Name</th>
            <th>Description</th>
            <th>Phone</th>
            <th>Email</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((school, index) => (
            <tr key={school.id}>
              <td>{index + 1}</td>
              <td>
                {school.logo ? (
                  <img
                    src={school.logo}
                    alt="School Logo"
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "5px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "No Logo"
                )}
              </td>
              <td>{school.name}</td>
              <td>{school.description}</td>
              <td>{school.phone}</td>
              <td>{school.email}</td>
              {canEdit && (
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => handleEdit(school)}
                  >
                    Edit
                  </button>
                  {isSuperadmin && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(school)}
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
              <td colSpan={canEdit ? 7 : 6} className="text-center">
                No schools found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Schools;
