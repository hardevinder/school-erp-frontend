import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";

// ---------------- Role helpers ----------------
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

const Houses = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [houses, setHouses] = useState([]);
  const [newHouse, setNewHouse] = useState({
    house_name: "",
    house_code: "",
    color: "#3498db",
    description: "",
  });
  const [editingHouse, setEditingHouse] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  // ---------------- Fetch Houses ----------------
  const fetchHouses = async () => {
    try {
      const { data } = await api.get("/houses");
      setHouses(data);
    } catch (error) {
      console.error("Error fetching houses:", error);
      Swal.fire("Error", "Failed to fetch houses.", "error");
    }
  };

  useEffect(() => {
    fetchHouses();
  }, []);

  // ---------------- Save (Add / Edit) ----------------
  const saveHouse = async () => {
    const { house_name, house_code } = newHouse;
    if (!house_name.trim()) {
      Swal.fire("Error", "House name is required.", "error");
      return;
    }

    try {
      if (editingHouse) {
        await api.put(`/houses/edit/${editingHouse.id}`, newHouse);
        Swal.fire("Updated!", "House updated successfully.", "success");
      } else {
        await api.post("/houses/add", newHouse);
        Swal.fire("Added!", "House added successfully.", "success");
      }

      setNewHouse({ house_name: "", house_code: "", color: "#3498db", description: "" });
      setEditingHouse(null);
      setShowModal(false);
      fetchHouses();
    } catch (error) {
      console.error("Error saving house:", error);
      Swal.fire("Error", "Failed to save house.", "error");
    }
  };

  // ---------------- Delete ----------------
  const deleteHouse = async (id) => {
    if (!isSuperadmin) {
      Swal.fire("Forbidden", "Only Superadmin can delete.", "warning");
      return;
    }

    Swal.fire({
      title: "Are you sure?",
      text: "You won’t be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/houses/delete/${id}`);
          Swal.fire("Deleted!", "House deleted successfully.", "success");
          fetchHouses();
        } catch (error) {
          console.error("Error deleting house:", error);
          Swal.fire("Error", "Failed to delete house.", "error");
        }
      }
    });
  };

  // ---------------- Search Filter ----------------
  const filtered = search
    ? houses.filter(
        (h) =>
          h.house_name.toLowerCase().includes(search.toLowerCase()) ||
          (h.house_code || "").toLowerCase().includes(search.toLowerCase())
      )
    : houses;

  return (
    <div className="container mt-4">
      <h1 className="mb-4">🏠 Houses Management</h1>

      {/* Header Buttons */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <input
          type="text"
          className="form-control w-50"
          placeholder="Search Houses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {canEdit && (
          <button
            className="btn btn-success"
            onClick={() => {
              setEditingHouse(null);
              setNewHouse({ house_name: "", house_code: "", color: "#3498db", description: "" });
              setShowModal(true);
            }}
          >
            + Add House
          </button>
        )}
      </div>

      {/* Table */}
      <table className="table table-hover align-middle">
        <thead className="table-light">
          <tr>
            <th>#</th>
            <th>House Name</th>
            <th>Code</th>
            <th>Color</th>
            <th>Description</th>
            <th>Total Students</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((house, index) => (
            <tr key={house.id}>
              <td>{index + 1}</td>
              <td>{house.house_name}</td>
              <td>{house.house_code || "-"}</td>
              <td>
                <div
                  style={{
                    backgroundColor: house.color || "#ccc",
                    width: "40px",
                    height: "20px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                    display: "inline-block",
                  }}
                  title={house.color}
                ></div>
              </td>
              <td>{house.description || "-"}</td>
              <td>{house.total_students ?? 0}</td>
              {canEdit && (
                <td>
                  <button
                    className="btn btn-sm btn-primary me-2"
                    onClick={() => {
                      setEditingHouse(house);
                      setNewHouse({
                        house_name: house.house_name,
                        house_code: house.house_code || "",
                        color: house.color || "#3498db",
                        description: house.description || "",
                      });
                      setShowModal(true);
                    }}
                  >
                    Edit
                  </button>
                  {isSuperadmin && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteHouse(house.id)}
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
              <td colSpan={canEdit ? 7 : 6} className="text-center text-muted">
                No houses found
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
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  {editingHouse ? "Edit House" : "Add House"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">House Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter house name"
                    value={newHouse.house_name}
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, house_name: e.target.value })
                    }
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">House Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Short code (e.g., RED, TAG)"
                    value={newHouse.house_code}
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, house_code: e.target.value })
                    }
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Color</label>
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={newHouse.color}
                    title="Choose color"
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, color: e.target.value })
                    }
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Optional description..."
                    value={newHouse.description}
                    onChange={(e) =>
                      setNewHouse({ ...newHouse, description: e.target.value })
                    }
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveHouse}>
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

export default Houses;
