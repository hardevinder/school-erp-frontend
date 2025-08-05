// src/pages/Concessions.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
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

const Concessions = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [concessions, setConcessions] = useState([]);
  const [newConcession, setNewConcession] = useState({
    concession_name: "",
    concession_percentage: "",
    concession_remarks: "",
  });
  const [editingConcession, setEditingConcession] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Fetch all concessions
  const fetchConcessions = async () => {
    try {
      const { data } = await api.get("/concessions");
      setConcessions(data);
    } catch (error) {
      console.error("Error fetching concessions:", error);
      Swal.fire("Error", "Failed to fetch concessions.", "error");
    }
  };

  // Add or Update
  const saveConcession = async () => {
    try {
      const payload = {
        concession_name: newConcession.concession_name.trim(),
        concession_percentage: newConcession.concession_percentage,
        concession_remarks: newConcession.concession_remarks.trim(),
      };

      if (!payload.concession_name || payload.concession_percentage === "") {
        Swal.fire("Error", "Name and Percentage are required.", "error");
        return;
      }

      if (editingConcession) {
        await api.put(`/concessions/${editingConcession.id}`, payload);
        Swal.fire("Updated!", "Concession has been updated successfully.", "success");
      } else {
        await api.post("/concessions", payload);
        Swal.fire("Added!", "Concession has been added successfully.", "success");
      }

      setEditingConcession(null);
      setNewConcession({ concession_name: "", concession_percentage: "", concession_remarks: "" });
      setShowModal(false);
      fetchConcessions();
    } catch (error) {
      console.error("Error saving concession:", error);
      Swal.fire("Error", "Failed to save concession.", "error");
    }
  };

  // Delete (Superadmin only)
  const deleteConcession = async (id) => {
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
          await api.delete(`/concessions/${id}`);
          Swal.fire("Deleted!", "Concession has been deleted.", "success");
          fetchConcessions();
        } catch (error) {
          console.error("Error deleting concession:", error);
          Swal.fire("Error", "Failed to delete concession.", "error");
        }
      }
    });
  };

  // Search filter
  const filteredConcessions = search
    ? concessions.filter((c) =>
        c.concession_name.toLowerCase().includes(search.toLowerCase())
      )
    : concessions;

  // Mount
  useEffect(() => {
    fetchConcessions();
  }, []);

  return (
    <div className="container mt-4">
      <h1>Concession Management</h1>

      {/* Add Button (Admin / Superadmin) */}
      {canEdit && (
        <button
          className="btn btn-success mb-3"
          onClick={() => {
            setEditingConcession(null);
            setNewConcession({
              concession_name: "",
              concession_percentage: "",
              concession_remarks: "",
            });
            setShowModal(true);
          }}
        >
          Add Concession
        </button>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search Concessions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Concession Name</th>
            <th>Percentage</th>
            <th>Remarks</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filteredConcessions.map((con, index) => (
            <tr key={con.id}>
              <td>{index + 1}</td>
              <td>{con.concession_name}</td>
              <td>{con.concession_percentage}%</td>
              <td>{con.concession_remarks}</td>
              {canEdit && (
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => {
                      setEditingConcession(con);
                      setNewConcession({
                        concession_name: con.concession_name,
                        concession_percentage: con.concession_percentage,
                        concession_remarks: con.concession_remarks,
                      });
                      setShowModal(true);
                    }}
                  >
                    Edit
                  </button>
                  {isSuperadmin && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteConcession(con.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
          {filteredConcessions.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 5 : 4} className="text-center">
                No concessions found
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
                  {editingConcession ? "Edit Concession" : "Add Concession"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Concession Name</label>
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Concession Name"
                  value={newConcession.concession_name}
                  onChange={(e) =>
                    setNewConcession({
                      ...newConcession,
                      concession_name: e.target.value,
                    })
                  }
                />

                <label className="form-label">Concession Percentage (%)</label>
                <input
                  type="number"
                  className="form-control mb-3"
                  placeholder="Percentage"
                  value={newConcession.concession_percentage}
                  onChange={(e) =>
                    setNewConcession({
                      ...newConcession,
                      concession_percentage: e.target.value,
                    })
                  }
                />

                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control mb-3"
                  placeholder="Remarks"
                  value={newConcession.concession_remarks}
                  onChange={(e) =>
                    setNewConcession({
                      ...newConcession,
                      concession_remarks: e.target.value,
                    })
                  }
                ></textarea>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveConcession}>
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

export default Concessions;
