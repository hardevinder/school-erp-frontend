import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const AssessmentComponentManagement = () => {
  const [components, setComponents] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    abbreviation: "",
    max_marks: "",
    is_internal: false,
    is_practical: false,
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    try {
      const res = await api.get("/assessment-components");
      setComponents(Array.isArray(res.data) ? res.data : []);
    } catch {
      Swal.fire("Error", "Failed to fetch components", "error");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleEdit = (comp) => {
    setFormData({
      id: comp.id,
      name: comp.name,
      abbreviation: comp.abbreviation || "",
      max_marks: comp.max_marks || "",
      is_internal: comp.is_internal || false,
      is_practical: comp.is_practical || false,
    });
    setIsEditing(true);
  };

  const handleReset = () => {
    setFormData({
      id: null,
      name: "",
      abbreviation: "",
      max_marks: "",
      is_internal: false,
      is_practical: false,
    });
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.abbreviation.trim() || !formData.max_marks) {
      Swal.fire("Warning", "All required fields must be filled", "warning");
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/assessment-components/${formData.id}`, formData);
        Swal.fire("Success", "Component updated", "success");
      } else {
        await api.post("/assessment-components", formData);
        Swal.fire("Success", "Component created", "success");
      }
      handleReset();
      fetchComponents();
    } catch {
      Swal.fire("Error", "Failed to save component", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Delete this component?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/assessment-components/${id}`);
        Swal.fire("Deleted", "Component removed", "success");
        fetchComponents();
      } catch {
        Swal.fire("Error", "Failed to delete", "error");
      }
    }
  };

  return (
    <div className="container mt-4">
      <h2>🧮 Assessment Components</h2>

      {/* Form */}
      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">{isEditing ? "✏️ Edit Component" : "➕ Add Component"}</h5>

          <div className="row">
            <div className="col-md-4 mb-3">
              <label>Name *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Periodic Test"
                className="form-control"
              />
            </div>
            <div className="col-md-2 mb-3">
              <label>Abbreviation *</label>
              <input
                name="abbreviation"
                value={formData.abbreviation}
                onChange={handleChange}
                placeholder="e.g. PT"
                className="form-control"
              />
            </div>
            <div className="col-md-2 mb-3">
              <label>Max Marks *</label>
              <input
                type="number"
                name="max_marks"
                value={formData.max_marks}
                onChange={handleChange}
                placeholder="e.g. 20"
                className="form-control"
              />
            </div>
            <div className="col-md-2 mb-3 form-check mt-4">
              <input
                type="checkbox"
                name="is_internal"
                checked={formData.is_internal}
                onChange={handleChange}
                className="form-check-input"
                id="internalCheck"
              />
              <label htmlFor="internalCheck" className="form-check-label">Internal</label>
            </div>
            <div className="col-md-2 mb-3 form-check mt-4">
              <input
                type="checkbox"
                name="is_practical"
                checked={formData.is_practical}
                onChange={handleChange}
                className="form-check-input"
                id="practicalCheck"
              />
              <label htmlFor="practicalCheck" className="form-check-label">Practical</label>
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
          <h5 className="card-title">Component List</h5>
          {components.length > 0 ? (
            <table className="table table-striped table-bordered">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Abbr.</th>
                  <th>Max Marks</th>
                  <th>Internal</th>
                  <th>Practical</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp, index) => (
                  <tr key={comp.id}>
                    <td>{index + 1}</td>
                    <td>{comp.name}</td>
                    <td>{comp.abbreviation}</td>
                    <td>{comp.max_marks}</td>
                    <td>{comp.is_internal ? "Yes" : "No"}</td>
                    <td>{comp.is_practical ? "Yes" : "No"}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning me-2"
                        onClick={() => handleEdit(comp)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(comp.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No components found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentComponentManagement;
    