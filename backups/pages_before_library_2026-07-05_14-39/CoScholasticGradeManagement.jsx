import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const CoScholasticGradeManagement = () => {
  const [grades, setGrades] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    grade: "",
    description: "",
    order: 0,
    is_active: true,
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      const res = await api.get("/co-scholastic-grades");
      setGrades(Array.isArray(res.data) ? res.data : []);
    } catch {
      Swal.fire("Error", "Failed to fetch grades", "error");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const val = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleEdit = (grade) => {
    setFormData({
      id: grade.id,
      grade: grade.grade,
      description: grade.description || "",
      order: grade.order || 0,
      is_active: grade.is_active,
    });
    setIsEditing(true);
  };

  const handleReset = () => {
    setFormData({
      id: null,
      grade: "",
      description: "",
      order: 0,
      is_active: true,
    });
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    if (!formData.grade.trim()) {
      Swal.fire("Warning", "Grade is required", "warning");
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/co-scholastic-grades/${formData.id}`, formData);
        Swal.fire("Success", "Grade updated", "success");
      } else {
        await api.post("/co-scholastic-grades", formData);
        Swal.fire("Success", "Grade created", "success");
      }
      handleReset();
      fetchGrades();
    } catch {
      Swal.fire("Error", "Failed to save grade", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Delete this grade?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/co-scholastic-grades/${id}`);
        Swal.fire("Deleted", "Grade removed", "success");
        fetchGrades();
      } catch {
        Swal.fire("Error", "Failed to delete", "error");
      }
    }
  };

  return (
    <div className="container mt-4">
      <h2>📘 Co-Scholastic Grades</h2>

      {/* Form */}
      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">
            {isEditing ? "✏️ Edit Grade" : "➕ Add Grade"}
          </h5>

          <div className="row">
            <div className="col-md-3 mb-3">
              <label>Grade *</label>
              <input
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                placeholder="e.g. A+"
                className="form-control"
              />
            </div>

            <div className="col-md-5 mb-3">
              <label>Description</label>
              <input
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="e.g. Excellent"
                className="form-control"
              />
            </div>

            <div className="col-md-2 mb-3">
              <label>Order</label>
              <input
                type="number"
                name="order"
                value={formData.order}
                onChange={handleChange}
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
          <h5 className="card-title">Grade List</h5>
          {grades.length > 0 ? (
            <table className="table table-striped table-bordered">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Grade</th>
                  <th>Description</th>
                  <th>Order</th>
                  <th>Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {grades.map((grade, index) => (
                  <tr key={grade.id}>
                    <td>{index + 1}</td>
                    <td>{grade.grade}</td>
                    <td>{grade.description}</td>
                    <td>{grade.order}</td>
                    <td>{grade.is_active ? "Yes" : "No"}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning me-2"
                        onClick={() => handleEdit(grade)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(grade.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No grades found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoScholasticGradeManagement;
