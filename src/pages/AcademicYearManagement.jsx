import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const AcademicYearManagement = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    start_date: "",
    end_date: "",
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  const fetchAcademicYears = async () => {
    try {
      const res = await api.get("/academic-years");
      setAcademicYears(Array.isArray(res.data) ? res.data : []);
    } catch {
      Swal.fire("Error", "Unable to load academic years.", "error");
    }
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEdit = (year) => {
    setFormData({
      id: year.id,
      name: year.name,
      start_date: year.start_date,
      end_date: year.end_date,
    });
    setIsEditing(true);
  };

  const handleReset = () => {
    setFormData({ id: null, name: "", start_date: "", end_date: "" });
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      Swal.fire("Warning", "All fields are required", "warning");
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/academic-years/${formData.id}`, formData);
        Swal.fire("Success", "Academic year updated.", "success");
      } else {
        await api.post("/academic-years", formData);
        Swal.fire("Success", "Academic year created.", "success");
      }
      handleReset();
      fetchAcademicYears();
    } catch {
      Swal.fire("Error", "Failed to save academic year.", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the academic year.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/academic-years/${id}`);
        Swal.fire("Deleted", "Academic year deleted.", "success");
        fetchAcademicYears();
      } catch {
        Swal.fire("Error", "Failed to delete.", "error");
      }
    }
  };

  return (
    <div className="container mt-4">
      <h2>📚 Academic Year Management</h2>

      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">
            {isEditing ? "✏️ Edit Academic Year" : "➕ Add Academic Year"}
          </h5>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-control"
                placeholder="e.g. 2024-25"
              />
            </div>
            <div className="col-md-4 mb-3">
              <label>Start Date</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="col-md-4 mb-3">
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

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Academic Year List</h5>
          {academicYears.length > 0 ? (
            <table className="table table-bordered table-striped">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {academicYears.map((year, index) => (
                  <tr key={year.id}>
                    <td>{index + 1}</td>
                    <td>{year.name}</td>
                    <td>{year.start_date}</td>
                    <td>{year.end_date}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning me-2"
                        onClick={() => handleEdit(year)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(year.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No academic years available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcademicYearManagement;
