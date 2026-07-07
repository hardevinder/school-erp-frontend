import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const GradeSchemeManagement = () => {
  const [grades, setGrades] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    min_percent: "",
    max_percent: "",
    grade: "",
    description: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      const res = await api.get("/grade-schemes");
      setGrades(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (error) {
      console.error("Fetch Error:", error);
      Swal.fire("Error", "Failed to load grade schemes.", "error");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (grade) => {
    setFormData({ ...grade });
    setIsEditing(true);
  };

  const handleResetForm = () => {
    setFormData({
      id: null,
      min_percent: "",
      max_percent: "",
      grade: "",
      description: ""
    });
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    const { min_percent, max_percent, grade } = formData;
    if (!min_percent || !max_percent || !grade) {
      Swal.fire("Warning", "Min, Max Percent and Grade are required.", "warning");
      return;
    }
    try {
      if (isEditing) {
        await api.put(`/grade-schemes/${formData.id}`, formData);
        Swal.fire("Updated", "Grade updated successfully.", "success");
      } else {
        await api.post("/grade-schemes", formData);
        Swal.fire("Created", "Grade scheme added successfully.", "success");
      }
      handleResetForm();
      fetchGrades();
    } catch (error) {
      console.error("Save Error:", error);
      Swal.fire("Error", "Failed to save grade scheme.", "error");
    }
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({
      title: "Confirm Deletion",
      text: "This will permanently delete the grade scheme.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete"
    });
    if (res.isConfirmed) {
      try {
        await api.delete(`/grade-schemes/${id}`);
        Swal.fire("Deleted", "Grade scheme removed.", "success");
        fetchGrades();
      } catch (error) {
        console.error("Delete Error:", error);
        Swal.fire("Error", "Failed to delete grade scheme.", "error");
      }
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get("/grade-schemes/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "GradeSchemes.xlsx");
      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error("Export Error:", error);
      Swal.fire("Error", "Failed to export grade schemes.", "error");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post("/grade-schemes/import", formData);
      Swal.fire("Success", "Imported successfully", "success");
      fetchGrades();
    } catch (error) {
      console.error("Import Error:", error);
      Swal.fire("Error", "Failed to import file.", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h2>📊 Grade Scheme Management</h2>

      {/* Buttons */}
      <div className="mb-3 d-flex justify-content-end gap-2">
        <button className="btn btn-outline-success" onClick={handleExport}>
          ⬇️ Export to Excel
        </button>
        <button className="btn btn-outline-primary" onClick={handleImportClick}>
          ⬆️ Import from Excel
        </button>
        <input
          type="file"
          accept=".xlsx"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleImportFile}
        />
      </div>

      {/* Form */}
      <div className="card my-4">
        <div className="card-body">
          <h5 className="card-title">{isEditing ? "✏️ Edit Grade" : "➕ Add Grade"}</h5>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label>Min %</label>
              <input
                type="number"
                name="min_percent"
                value={formData.min_percent}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="col-md-3 mb-3">
              <label>Max %</label>
              <input
                type="number"
                name="max_percent"
                value={formData.max_percent}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="col-md-3 mb-3">
              <label>Grade</label>
              <input
                type="text"
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="col-md-3 mb-3">
              <label>Description</label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="col-md-12">
              <button className="btn btn-success me-2" onClick={handleSubmit}>
                {isEditing ? "Update Grade" : "Add Grade"}
              </button>
              {isEditing && (
                <button className="btn btn-secondary" onClick={handleResetForm}>
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
          <h5 className="card-title">📋 Grade List</h5>
          <table className="table table-bordered table-striped">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Min %</th>
                <th>Max %</th>
                <th>Grade</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g, index) => (
                <tr key={g.id}>
                  <td>{index + 1}</td>
                  <td>{g.min_percent}</td>
                  <td>{g.max_percent}</td>
                  <td>{g.grade}</td>
                  <td>{g.description}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => handleEdit(g)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(g.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {grades.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center text-muted">
                    No grade schemes found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GradeSchemeManagement;
