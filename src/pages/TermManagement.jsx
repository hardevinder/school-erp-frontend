import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const TermManagement = () => {
  const [terms, setTerms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);

  const [formData, setFormData] = useState({
    id: null,
    academic_year_id: "",
    name: "",
    start_date: "",
    end_date: "",
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchTerms();
    fetchAcademicYears();
  }, []);

  const fetchTerms = async () => {
    try {
      const res = await api.get("/terms");
      setTerms(Array.isArray(res.data) ? res.data : []);
    } catch {
      Swal.fire("Error", "Unable to load terms.", "error");
    }
  };

  const fetchAcademicYears = async () => {
    try {
      const res = await api.get("/academic-years");
      setAcademicYears(res.data || []);
    } catch {
      Swal.fire("Error", "Unable to load academic years.", "error");
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEdit = (term) => {
    setFormData({
      id: term.id,
      academic_year_id: term.academic_year_id || "",
      name: term.name,
      start_date: term.start_date || "",
      end_date: term.end_date || "",
    });
    setIsEditing(true);
  };

  const handleReset = () => {
    setFormData({ id: null, academic_year_id: "", name: "", start_date: "", end_date: "" });
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    if (!formData.academic_year_id) {
      Swal.fire("Warning", "Academic Year is required", "warning");
      return;
    }
    if (!formData.name.trim()) {
      Swal.fire("Warning", "Term Name is required", "warning");
      return;
    }
    if (!formData.start_date) {
      Swal.fire("Warning", "Start Date is required", "warning");
      return;
    }
    if (!formData.end_date) {
      Swal.fire("Warning", "End Date is required", "warning");
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/terms/${formData.id}`, formData);
        Swal.fire("Success", "Term updated successfully.", "success");
      } else {
        await api.post("/terms", formData);
        Swal.fire("Success", "Term created successfully.", "success");
      }
      handleReset();
      fetchTerms();
    } catch {
      Swal.fire("Error", "Failed to save term.", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the term.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/terms/${id}`);
        Swal.fire("Deleted", "Term deleted.", "success");
        fetchTerms();
      } catch {
        Swal.fire("Error", "Failed to delete term.", "error");
      }
    }
  };

  const getAcademicYearName = (id) => {
    const year = academicYears.find((y) => y.id === id);
    return year ? year.name : "-";
  };

  return (
    <div className="container mt-4">
      <h2>📘 Term Management</h2>

      {/* Form */}
      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">{isEditing ? "✏️ Edit Term" : "➕ Add Term"}</h5>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label>Academic Year</label>
              <select
                name="academic_year_id"
                value={formData.academic_year_id}
                onChange={handleChange}
                className="form-control"
              >
                <option value="">Select Academic Year</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 mb-3">
              <label>Term Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g. Term 1"
              />
            </div>
            <div className="col-md-3 mb-3">
              <label>Start Date</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="col-md-3 mb-3">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="col-md-12 d-flex gap-2">
              <button className="btn btn-success" onClick={handleSubmit}>
                {isEditing ? "Update Term" : "Create Term"}
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
          <h5 className="card-title">Term List</h5>
          {terms.length > 0 ? (
            <table className="table table-bordered table-striped">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Academic Year</th>
                  <th>Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term, index) => (
                  <tr key={term.id}>
                    <td>{index + 1}</td>
                    <td>{getAcademicYearName(term.academic_year_id)}</td>
                    <td>{term.name}</td>
                    <td>{term.start_date || "-"}</td>
                    <td>{term.end_date || "-"}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning me-2"
                        onClick={() => handleEdit(term)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(term.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No terms available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TermManagement;
