import React, { useState, useEffect } from "react";
import api from "../api"; // Import custom Axios instance
import Swal from "sweetalert2";

const Subjects = () => {
  const [subjects, setSubjects] = useState([]); // To store all subjects
  const [newSubject, setNewSubject] = useState({ name: "", description: "" }); // For adding/updating subjects
  const [editingSubject, setEditingSubject] = useState(null); // Track editing mode
  const [search, setSearch] = useState(""); // For searching subjects
  const [showModal, setShowModal] = useState(false); // Modal visibility
  const [loading, setLoading] = useState(true); // Loading state

  // ✅ Fetch all subjects from the API
  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const response = await api.get("/subjects"); // Use custom Axios instance
      setSubjects(response.data.subjects || response.data || []); // Handle different API responses
    } catch (error) {
      console.error("Error fetching subjects:", error);
      Swal.fire("Error", "Failed to fetch subjects. Try again later.", "error");
    }
    setLoading(false);
  };

  // ✅ Add or update a subject
  const saveSubject = async () => {
    try {
      if (!newSubject.name.trim()) {
        return Swal.fire("Validation Error", "Subject name is required.", "warning");
      }

      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, newSubject);
        Swal.fire("Updated!", "Subject has been updated successfully.", "success");
      } else {
        await api.post("/subjects", newSubject);
        Swal.fire("Added!", "Subject has been added successfully.", "success");
      }

      setEditingSubject(null);
      setNewSubject({ name: "", description: "" });
      setShowModal(false);
      fetchSubjects(); // ✅ Refresh subject list
    } catch (error) {
      console.error("Error saving subject:", error);
      Swal.fire("Error", "Failed to save subject. Please try again.", "error");
    }
  };

  // ✅ Confirm before deleting a subject
  const deleteSubject = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the subject!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/subjects/${id}`);
          Swal.fire("Deleted!", "Subject has been removed.", "success");
          fetchSubjects(); // ✅ Refresh list after deletion
        } catch (error) {
          console.error("Error deleting subject:", error);
          Swal.fire("Error", "Failed to delete subject.", "error");
        }
      }
    });
  };

  // ✅ Handle search filtering
  const handleSearch = () => {
    if (search) {
      return subjects.filter((subj) =>
        subj.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return subjects;
  };

  // ✅ Fetch subjects on component mount
  useEffect(() => {
    fetchSubjects();
  }, []);

  return (
    <div className="container mt-4">
      <h1>Subjects Management</h1>

      {/* ✅ Add Subject Button */}
      <button
        className="btn btn-success mb-3"
        onClick={() => {
          setEditingSubject(null);
          setNewSubject({ name: "", description: "" });
          setShowModal(true);
        }}
      >
        Add Subject
      </button>

      {/* ✅ Search Input */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search Subjects"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ✅ Subjects Table */}
      {loading ? (
        <p>Loading subjects...</p>
      ) : subjects.length === 0 ? (
        <p>No subjects available.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>#</th>
              <th>Subject Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {handleSearch().map((subj, index) => (
              <tr key={subj.id}>
                <td>{index + 1}</td>
                <td>{subj.name}</td>
                <td>{subj.description}</td>
                <td>
                  <button
                    className="btn btn-primary btn-sm me-2"
                    onClick={() => {
                      setEditingSubject(subj);
                      setNewSubject({
                        name: subj.name,
                        description: subj.description,
                      });
                      setShowModal(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteSubject(subj.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ✅ Modal for Adding/Editing Subjects */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingSubject ? "Edit Subject" : "Add Subject"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Subject Name"
                  value={newSubject.name}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, name: e.target.value })
                  }
                />
                <textarea
                  className="form-control"
                  placeholder="Description"
                  value={newSubject.description}
                  onChange={(e) =>
                    setNewSubject({ ...newSubject, description: e.target.value })
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
                <button className="btn btn-primary" onClick={saveSubject}>
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

export default Subjects;
