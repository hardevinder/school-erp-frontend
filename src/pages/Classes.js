// src/pages/Classes.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
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

const Classes = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [classes, setClasses] = useState([]);
  const [newClass, setNewClass] = useState({ class_name: "" });
  const [editingClass, setEditingClass] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Fetch all classes
  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      Swal.fire("Error", "Failed to fetch classes.", "error");
    }
  };

  // Add or Update
  const saveClass = async () => {
    try {
      if (!newClass.class_name.trim()) {
        Swal.fire("Error", "Class name is required.", "error");
        return;
      }

      if (editingClass) {
        await api.put(`/classes/${editingClass.id}`, newClass);
        Swal.fire("Updated!", "Class has been updated successfully.", "success");
      } else {
        await api.post("/classes", newClass);
        Swal.fire("Added!", "Class has been added successfully.", "success");
      }

      setEditingClass(null);
      setNewClass({ class_name: "" });
      setShowModal(false);
      fetchClasses();
    } catch (error) {
      console.error("Error saving class:", error);
      Swal.fire("Error", "Failed to save class.", "error");
    }
  };

  // Delete (Superadmin only)
  const deleteClass = async (id) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/classes/${id}`);
          Swal.fire("Deleted!", "Class has been deleted.", "success");
          fetchClasses();
        } catch (error) {
          console.error("Error deleting class:", error);
          Swal.fire("Error", "Failed to delete class.", "error");
        }
      }
    });
  };

  // Search
  const filtered = search
    ? classes.filter((c) =>
        c.class_name.toLowerCase().includes(search.toLowerCase())
      )
    : classes;

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <div className="container mt-4">
      <h1>Classes Management</h1>

      {/* Add Button (Admin/Superadmin) */}
      {canEdit && (
        <button
          className="btn btn-success mb-3"
          onClick={() => {
            setEditingClass(null);
            setNewClass({ class_name: "" });
            setShowModal(true);
          }}
        >
          Add Class
        </button>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search Classes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Class Name</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((cls, index) => (
            <tr key={cls.id}>
              <td>{index + 1}</td>
              <td>{cls.class_name}</td>
              {canEdit && (
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => {
                      setEditingClass(cls);
                      setNewClass({ class_name: cls.class_name });
                      setShowModal(true);
                    }}
                  >
                    Edit
                  </button>
                  {isSuperadmin && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteClass(cls.id)}
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
                No classes found
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Modal */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingClass ? "Edit Class" : "Add Class"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Class Name</label>
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Class Name"
                  value={newClass.class_name}
                  onChange={(e) =>
                    setNewClass({ ...newClass, class_name: e.target.value })
                  }
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveClass}>
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

export default Classes;
