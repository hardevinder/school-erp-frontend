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

const safeStr = (v) => (v == null ? "" : String(v));

const parseSectionsInput = (text) => {
  // "A, B ,C" -> ["A","B","C"] unique
  const parts = safeStr(text)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return [...new Set(parts)];
};

const sectionsToInput = (sectionsArr) => {
  if (!Array.isArray(sectionsArr)) return "";
  // sections may be [{section_name}] OR ["A","B"]
  const names = sectionsArr
    .map((s) => (typeof s === "string" ? s : s?.section_name))
    .filter(Boolean);
  return names.join(", ");
};

const Classes = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ class_name: "", sectionsText: "" });
  const [editingClass, setEditingClass] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch all classes (with sections)
  const fetchClasses = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/classes?withSections=true");
      setClasses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching classes:", error);
      Swal.fire("Error", "Failed to fetch classes.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Add or Update
  const saveClass = async () => {
    try {
      const class_name = safeStr(form.class_name).trim();
      if (!class_name) {
        Swal.fire("Error", "Class name is required.", "error");
        return;
      }

      const sections = parseSectionsInput(form.sectionsText);

      const payload = {
        class_name,
        // send sections only if user typed something; keeps backward compatible
        ...(sections.length ? { sections } : {}),
      };

      if (editingClass) {
        await api.put(`/classes/${editingClass.id}`, payload);
        Swal.fire("Updated!", "Class has been updated successfully.", "success");
      } else {
        await api.post("/classes", payload);
        Swal.fire("Added!", "Class has been added successfully.", "success");
      }

      setEditingClass(null);
      setForm({ class_name: "", sectionsText: "" });
      setShowModal(false);
      fetchClasses();
    } catch (error) {
      console.error("Error saving class:", error);

      // Friendly messages for common errors
      const msg =
        error?.response?.data?.message ||
        (error?.response?.status === 409
          ? "Duplicate section name in same class is not allowed."
          : "Failed to save class.");

      Swal.fire("Error", msg, "error");
    }
  };

  // Delete (Superadmin only)
  const deleteClass = async (id) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    Swal.fire({
      title: "Are you sure?",
      text: "This will delete the class and its sections.",
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

  // Search (class name + sections)
  const filtered = useMemo(() => {
    const q = safeStr(search).trim().toLowerCase();
    if (!q) return classes;

    return classes.filter((c) => {
      const nameMatch = safeStr(c?.class_name).toLowerCase().includes(q);

      const sectionNames = Array.isArray(c?.Sections)
        ? c.Sections.map((s) => safeStr(s?.section_name).toLowerCase()).join(" ")
        : "";

      const sectionMatch = sectionNames.includes(q);

      return nameMatch || sectionMatch;
    });
  }, [classes, search]);

  useEffect(() => {
    fetchClasses();
  }, []);

  const openAdd = () => {
    setEditingClass(null);
    setForm({ class_name: "", sectionsText: "" });
    setShowModal(true);
  };

  const openEdit = (cls) => {
    setEditingClass(cls);
    setForm({
      class_name: safeStr(cls?.class_name),
      sectionsText: sectionsToInput(cls?.Sections),
    });
    setShowModal(true);
  };

  return (
    <div className="container mt-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h3 className="mb-0">Classes Management</h3>
          <small className="text-muted">
            Add class and manage sections (A, B, C...)
          </small>
        </div>

        {canEdit && (
          <button className="btn btn-success" onClick={openAdd}>
            + Add Class
          </button>
        )}
      </div>

      {/* Search */}
      <div className="row g-2 mb-3">
        <div className="col-12 col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by class or section (e.g., 7, A)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="col-12 col-md-6 text-md-end">
          <button
            className="btn btn-outline-secondary"
            onClick={fetchClasses}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th style={{ width: 70 }}>#</th>
              <th>Class Name</th>
              <th>Sections</th>
              {canEdit && <th style={{ width: 200 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((cls, index) => (
              <tr key={cls.id}>
                <td>{index + 1}</td>
                <td className="fw-semibold">{cls.class_name}</td>

                <td>
                  {Array.isArray(cls?.Sections) && cls.Sections.length ? (
                    <div className="d-flex flex-wrap gap-1">
                      {cls.Sections.map((s) => (
                        <span
                          key={s.id}
                          className="badge text-bg-secondary"
                          title={`Section ID: ${s.id}`}
                        >
                          {s.section_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                {canEdit && (
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openEdit(cls)}
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
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 4 : 3} className="text-center py-4">
                  {loading ? "Loading..." : "No classes found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
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
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Class Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g., 6, 7, 8, UKG"
                      value={form.class_name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, class_name: e.target.value }))
                      }
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label">Sections</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Comma separated: A, B, C"
                      value={form.sectionsText}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, sectionsText: e.target.value }))
                      }
                    />
                    <small className="text-muted">
                      Example: <code>A, B, C</code> (same class)
                    </small>
                  </div>

                  {/* preview chips */}
                  <div className="col-12">
                    <div className="d-flex flex-wrap gap-1">
                      {parseSectionsInput(form.sectionsText).map((name) => (
                        <span key={name} className="badge text-bg-light border">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
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