// src/pages/Sessions.jsx
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

const Sessions = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [sessions, setSessions] = useState([]);
  const [newSession, setNewSession] = useState({
    name: "",
    start_date: "",
    end_date: "",
    is_active: false,
    description: "",
    visible: true,
  });
  const [editingSession, setEditingSession] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch all sessions
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/sessions");
      setSessions(data);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      Swal.fire("Error", "Failed to fetch sessions.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Add or Update
  const saveSession = async () => {
    try {
      if (!newSession.name.trim()) {
        Swal.fire("Error", "Session name is required.", "error");
        return;
      }

      const payload = {
        name: newSession.name,
        start_date: newSession.start_date || null,
        end_date: newSession.end_date || null,
        is_active: !!newSession.is_active,
        description: newSession.description || null,
        visible: newSession.visible !== undefined ? !!newSession.visible : true,
      };

      if (editingSession) {
        await api.put(`/sessions/${editingSession.id}`, payload);
        Swal.fire("Updated!", "Session has been updated successfully.", "success");
      } else {
        await api.post("/sessions", payload);
        Swal.fire("Added!", "Session has been added successfully.", "success");
      }

      setEditingSession(null);
      setNewSession({
        name: "",
        start_date: "",
        end_date: "",
        is_active: false,
        description: "",
        visible: true,
      });
      setShowModal(false);
      fetchSessions();
    } catch (error) {
      console.error("Error saving session:", error);
      const msg = error?.response?.data?.error || "Failed to save session.";
      Swal.fire("Error", msg, "error");
    }
  };

  // Delete (Superadmin only)
  const deleteSession = async (id) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    Swal.fire({
      title: "Are you sure?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/sessions/${id}`);
          Swal.fire("Deleted!", "Session has been deleted.", "success");
          fetchSessions();
        } catch (error) {
          console.error("Error deleting session:", error);
          const msg = error?.response?.data?.error || "Failed to delete session.";
          Swal.fire("Error", msg, "error");
        }
      }
    });
  };

  // Set active session (Admin & Superadmin)
  const setActive = async (id) => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "Only Admins can set active session.", "warning");
    }
    try {
      await api.post(`/sessions/${id}/set-active`);
      Swal.fire("Success", "Active session updated.", "success");
      fetchSessions();
    } catch (error) {
      console.error("Error setting active session:", error);
      const msg = error?.response?.data?.error || "Failed to set active session.";
      Swal.fire("Error", msg, "error");
    }
  };

  // Search
  const filtered = search
    ? sessions.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  // helper to open modal for add
  const openAddModal = () => {
    setEditingSession(null);
    setNewSession({
      name: "",
      start_date: "",
      end_date: "",
      is_active: false,
      description: "",
      visible: true,
    });
    setShowModal(true);
  };

  // helper to open modal for edit
  const openEditModal = (s) => {
    setEditingSession(s);
    setNewSession({
      name: s.name || "",
      start_date: s.start_date || "",
      end_date: s.end_date || "",
      is_active: !!s.is_active,
      description: s.description || "",
      visible: s.visible !== undefined ? !!s.visible : true,
    });
    setShowModal(true);
  };

  return (
    <div className="container mt-4">
      <h1>Sessions Management</h1>

      {/* Add Button (Admin/Superadmin) */}
      {canEdit && (
        <button className="btn btn-success mb-3" onClick={openAddModal}>
          Add Session
        </button>
      )}

      {/* Search */}
      <div className="mb-3 d-flex align-items-center">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search Sessions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="ms-3">
          <button className="btn btn-outline-secondary" onClick={() => fetchSessions()}>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Start</th>
            <th>End</th>
            <th>Active</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={canEdit ? 6 : 5} className="text-center">
                Loading...
              </td>
            </tr>
          )}

          {!loading &&
            filtered.map((s, index) => (
              <tr key={s.id}>
                <td>{index + 1}</td>
                <td>{s.name}</td>
                <td>{s.start_date || "-"}</td>
                <td>{s.end_date || "-"}</td>
                <td>{s.is_active ? "Yes" : "No"}</td>
                {canEdit && (
                  <td>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => openEditModal(s)}
                    >
                      Edit
                    </button>

                    <button
                      className="btn btn-outline-success btn-sm me-2"
                      onClick={() => setActive(s.id)}
                    >
                      Set Active
                    </button>

                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteSession(s.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}

          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 6 : 5} className="text-center">
                No sessions found
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
                  {editingSession ? "Edit Session" : "Add Session"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>

              <div className="modal-body">
                <label className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="e.g. 2025-26"
                  value={newSession.name}
                  onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                />

                <div className="row">
                  <div className="col">
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-control mb-2"
                      value={newSession.start_date || ""}
                      onChange={(e) =>
                        setNewSession({ ...newSession, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div className="col">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-control mb-2"
                      value={newSession.end_date || ""}
                      onChange={(e) =>
                        setNewSession({ ...newSession, end_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <label className="form-label mt-2">Description</label>
                <textarea
                  className="form-control mb-2"
                  rows={3}
                  placeholder="Optional description"
                  value={newSession.description}
                  onChange={(e) =>
                    setNewSession({ ...newSession, description: e.target.value })
                  }
                />

                <div className="form-check form-switch mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="sessionActive"
                    checked={!!newSession.is_active}
                    onChange={(e) =>
                      setNewSession({ ...newSession, is_active: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="sessionActive">
                    Is Active
                  </label>
                </div>

                <div className="form-check form-switch mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="sessionVisible"
                    checked={!!newSession.visible}
                    onChange={(e) =>
                      setNewSession({ ...newSession, visible: e.target.checked })
                    }
                  />
                  <label className="form-check-label" htmlFor="sessionVisible">
                    Visible
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveSession}>
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

export default Sessions;
