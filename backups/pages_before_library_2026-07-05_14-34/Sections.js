// src/pages/Sections.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import "./Sections.css";

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

const Sections = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [sections, setSections] = useState([]);
  const [search, setSearch] = useState("");

  // Fetch all sections
  const fetchSections = async () => {
    try {
      const { data } = await api.get("/sections");
      setSections(data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      Swal.fire("Error", "Failed to fetch sections.", "error");
    }
  };

  // Delete (Superadmin only)
  const handleDelete = async (sectionId, sectionName) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: `Delete ${sectionName}?`,
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/sections/${sectionId}`);
        Swal.fire("Deleted!", "Section has been deleted.", "success");
        fetchSections();
      } catch (error) {
        console.error("Error deleting section:", error);
        Swal.fire("Error", "Failed to delete the section.", "error");
      }
    }
  };

  // Add Section
  const handleAdd = async () => {
    Swal.fire({
      title: "Add New Section",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <label for="sec-name">Section Name *</label>
          <input id="sec-name" class="form-field" placeholder="Enter section name">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Add",
      preConfirm: () => {
        const name = document.getElementById("sec-name").value.trim();
        if (!name) {
          Swal.showValidationMessage("Section name cannot be empty.");
          return false;
        }
        return { section_name: name };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          await api.post("/sections", res.value);
          Swal.fire("Added!", "Section has been added successfully.", "success");
          fetchSections();
        } catch (error) {
          Swal.fire("Error", "Failed to add the section.", "error");
        }
      }
    });
  };

  // Edit Section
  const handleEdit = async (section) => {
    Swal.fire({
      title: "Edit Section",
      width: "500px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <div class="form-container">
          <label for="sec-name">Section Name *</label>
          <input id="sec-name" class="form-field" value="${section.section_name}" placeholder="Enter section name">
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: () => {
        const name = document.getElementById("sec-name").value.trim();
        if (!name) {
          Swal.showValidationMessage("Section name cannot be empty.");
          return false;
        }
        return { section_name: name };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          await api.put(`/sections/${section.id}`, res.value);
          Swal.fire("Updated!", "Section has been updated successfully.", "success");
          fetchSections();
        } catch (error) {
          Swal.fire("Error", "Failed to update the section.", "error");
        }
      }
    });
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const filtered = sections.filter((s) =>
    s.section_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Sections Management</h1>
        {canEdit && (
          <button className="btn btn-success" onClick={handleAdd}>
            Add Section
          </button>
        )}
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50"
          placeholder="Search Sections"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Section Name</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((section, index) => (
            <tr key={section.id}>
              <td>{index + 1}</td>
              <td>{section.section_name}</td>
              {canEdit && (
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => handleEdit(section)}
                  >
                    Edit
                  </button>
                  {isSuperadmin && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() =>
                        handleDelete(section.id, section.section_name)
                      }
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
              <td colSpan={canEdit ? 3 : 2} className="text-center">
                No sections found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Sections;
