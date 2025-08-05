import React, { useState, useEffect, useRef } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";

const Circulars = () => {
  const [circulars, setCirculars] = useState([]);
  const [newCircular, setNewCircular] = useState({ title: "", content: "", audience: "both" });
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCircular, setEditingCircular] = useState(null);
  const hiddenFileInput = useRef(null);

  const fetchCirculars = async () => {
    try {
      const { data } = await api.get("/circulars");
      setCirculars(data.circulars);
    } catch (err) {
      console.error("Error fetching circulars:", err);
    }
  };

  useEffect(() => {
    fetchCirculars();
  }, []);

  const handleAddFileClick = () => hiddenFileInput.current?.click();

  const handleFileChange = (e) => {
    if (e.target.files.length) {
      setFile(e.target.files[0]);
      setRemoveFile(false);
    }
  };

  const saveCircular = async () => {
    const formData = new FormData();
    formData.append("title", newCircular.title);
    formData.append("content", newCircular.content);
    formData.append("audience", newCircular.audience);
    if (file) formData.append("file", file);
    if (editingCircular && removeFile) formData.append("removeFile", "true");

    try {
      if (editingCircular) {
        await api.put(`/circulars/${editingCircular.id}`, formData);
        Swal.fire("Updated!", "Circular updated successfully.", "success");
      } else {
        await api.post("/circulars", formData);
        Swal.fire("Added!", "Circular created successfully.", "success");
      }
      setNewCircular({ title: "", content: "", audience: "both" });
      setFile(null);
      setRemoveFile(false);
      setEditingCircular(null);
      setShowModal(false);
      fetchCirculars();
    } catch (err) {
      console.error("Error saving circular:", err);
      Swal.fire("Error", "Failed to save circular", "error");
    }
  };

  const deleteCircular = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This circular will be deleted permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    });
    if (result.isConfirmed) {
      try {
        await api.delete(`/circulars/${id}`);
        Swal.fire("Deleted!", "Circular deleted successfully.", "success");
        fetchCirculars();
      } catch (err) {
        console.error("Error deleting circular:", err);
        Swal.fire("Error", "Failed to delete circular", "error");
      }
    }
  };

  const handleEdit = (c) => {
    setEditingCircular(c);
    setNewCircular({ title: c.title, content: c.description, audience: c.audience });
    setFile(null);
    setRemoveFile(false);
    setShowModal(true);
  };

  const handleViewFile = (url) => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <div className="container mt-4">
      <h1>Circular Management</h1>
      <button
        className="btn btn-success mb-3"
        onClick={() => {
          setEditingCircular(null);
          setNewCircular({ title: "", content: "", audience: "both" });
          setFile(null);
          setRemoveFile(false);
          setShowModal(true);
        }}
      >
        Add Circular
      </button>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th><th>Title</th><th>Content</th><th>Audience</th><th>File</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {circulars.map((c, i) => (
            <tr key={c.id}>
              <td>{i + 1}</td>
              <td>{c.title}</td>
              <td>{c.description}</td>
              <td>{c.audience}</td>
              <td>
                {c.fileUrl ? (
                  <button
                    className="btn btn-outline-info btn-sm"
                    onClick={() => handleViewFile(c.fileUrl)}
                  >
                    View
                  </button>
                ) : (
                  "No File"
                )}
              </td>
              <td>
                <button className="btn btn-primary btn-sm me-2" onClick={() => handleEdit(c)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteCircular(c.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingCircular ? "Edit Circular" : "Add Circular"}</h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                <input
                  className="form-control mb-3"
                  placeholder="Title"
                  value={newCircular.title}
                  onChange={e => setNewCircular({ ...newCircular, title: e.target.value })}
                />
                <textarea
                  className="form-control mb-3"
                  placeholder="Content"
                  value={newCircular.content}
                  onChange={e => setNewCircular({ ...newCircular, content: e.target.value })}
                />
                <select
                  className="form-select mb-3"
                  value={newCircular.audience}
                  onChange={e => setNewCircular({ ...newCircular, audience: e.target.value })}
                >
                  <option value="both">Both</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                </select>

                <div className="mb-3 d-flex align-items-center">
                  <button className="btn btn-outline-secondary btn-sm" onClick={handleAddFileClick}>
                    {file || (editingCircular?.fileUrl && !removeFile) ? "Replace File" : "Upload File"}
                  </button>

                  {file ? (
                    <span className="ms-3">{file.name}</span>
                  ) : (
                    editingCircular?.fileUrl && !removeFile && (
                      <>
                        <button
                          className="btn btn-outline-info btn-sm ms-3"
                          onClick={() => handleViewFile(editingCircular.fileUrl)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-outline-danger btn-sm ms-2"
                          onClick={() => setRemoveFile(true)}
                        >
                          &times;
                        </button>
                      </>
                    )
                  )}

                  <input type="file" style={{ display: "none" }} ref={hiddenFileInput} onChange={handleFileChange} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                <button className="btn btn-primary" onClick={saveCircular}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Circulars;
