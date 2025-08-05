import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const CoScholasticAreaManagement = () => {
  const [areas, setAreas] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    description: "",
    is_active: true,
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const res = await api.get("/co-scholastic-areas");
      setAreas(Array.isArray(res.data) ? res.data : []);
    } catch {
      Swal.fire("Error", "Failed to fetch areas", "error");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleEdit = (area) => {
    setFormData({
      id: area.id,
      name: area.name,
      description: area.description || "",
      is_active: area.is_active,
    });
    setIsEditing(true);
  };

  const handleReset = () => {
    setFormData({
      id: null,
      name: "",
      description: "",
      is_active: true,
    });
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Swal.fire("Warning", "Area name is required", "warning");
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/co-scholastic-areas/${formData.id}`, formData);
        Swal.fire("Success", "Area updated", "success");
      } else {
        await api.post("/co-scholastic-areas", formData);
        Swal.fire("Success", "Area created", "success");
      }
      handleReset();
      fetchAreas();
    } catch {
      Swal.fire("Error", "Failed to save area", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Delete this area?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/co-scholastic-areas/${id}`);
        Swal.fire("Deleted", "Area removed", "success");
        fetchAreas();
      } catch {
        Swal.fire("Error", "Failed to delete", "error");
      }
    }
  };

  return (
    <div className="container mt-4">
      <h2>🎨 Co-Scholastic Areas</h2>

      {/* Form */}
      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">
            {isEditing ? "✏️ Edit Area" : "➕ Add Area"}
          </h5>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label>Name *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Work Education"
                className="form-control"
              />
            </div>

            <div className="col-md-6 mb-3">
              <label>Description</label>
              <input
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Optional"
                className="form-control"
              />
            </div>

            <div className="col-md-2 mb-3 form-check mt-4">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="form-check-input"
                id="activeCheck"
              />
              <label htmlFor="activeCheck" className="form-check-label">
                Active
              </label>
            </div>

            <div className="col-md-12 d-flex gap-2 mt-2">
              <button className="btn btn-success" onClick={handleSubmit}>
                {isEditing ? "Update" : "Create"}
              </button>
              {isEditing && (
                <button className="btn btn-secondary" onClick={handleReset}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Area List</h5>
          {areas.length > 0 ? (
            <table className="table table-striped table-bordered">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area, index) => (
                  <tr key={area.id}>
                    <td>{index + 1}</td>
                    <td>{area.name}</td>
                    <td>{area.description}</td>
                    <td>{area.is_active ? "Yes" : "No"}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning me-2"
                        onClick={() => handleEdit(area)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(area.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No areas found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoScholasticAreaManagement;
