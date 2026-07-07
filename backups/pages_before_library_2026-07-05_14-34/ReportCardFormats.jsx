import React, { useEffect, useState } from "react";
import { Modal, Button, Table, Form } from "react-bootstrap";
import api from "../api";
import Swal from "sweetalert2";

const ReportCardFormats = () => {
  const [formats, setFormats] = useState([]);
  const [classList, setClassList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);

  const [newFormat, setNewFormat] = useState({
    title: "",
    header_html: "",
    footer_html: "",
    school_logo_url: "",
    board_logo_url: "",
    class_ids: [],
  });

  const fetchClasses = async () => {
    try {
      const res = await api.get("/report-card-formats/assigned-classes");
      setClassList(res.data || []);
    } catch (error) {
      console.error("Error fetching classes", error);
    }
  };

  const fetchFormats = async () => {
    try {
      const res = await api.get("/report-card-formats");
      setFormats(res.data || []);
    } catch (error) {
      console.error("Error fetching formats", error);
    }
  };

  const handleCreateOrUpdate = async () => {
    const { title, header_html, footer_html, class_ids } = newFormat;
    if (!title || !header_html || !footer_html || class_ids.length === 0) {
      Swal.fire("All fields including classes are required", "", "warning");
      return;
    }

    try {
      if (editMode) {
        await api.put(`/report-card-formats/${currentId}`, newFormat);
        Swal.fire("Format updated", "", "success");
      } else {
        await api.post("/report-card-formats", newFormat);
        Swal.fire("Format created", "", "success");
      }
      setShowModal(false);
      setEditMode(false);
      setCurrentId(null);
      resetForm();
      fetchFormats();
    } catch (error) {
      console.error("Error saving format", error);
      Swal.fire("Error", error.response?.data?.message || "Failed to save format", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Delete this format?",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      icon: "warning",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/report-card-formats/${id}`);
        Swal.fire("Deleted", "", "success");
        fetchFormats();
      } catch (error) {
        console.error("Delete error", error);
        Swal.fire("Error", "Failed to delete format", "error");
      }
    }
  };

  const resetForm = () => {
    setNewFormat({
      title: "",
      header_html: "",
      footer_html: "",
      school_logo_url: "",
      board_logo_url: "",
      class_ids: [],
    });
  };

  const handleEdit = (format) => {
    setNewFormat({
      title: format.title,
      header_html: format.header_html,
      footer_html: format.footer_html,
      school_logo_url: format.school_logo_url,
      board_logo_url: format.board_logo_url,
      class_ids: format.classes.map((c) => c.id),
    });
    setCurrentId(format.id);
    setEditMode(true);
    setShowModal(true);
  };

  const handleLogoUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/report-card-formats/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { url } = res.data;
      setNewFormat((prev) => ({ ...prev, [field]: url }));
    } catch (error) {
      console.error("Logo upload failed", error);
      Swal.fire("Upload failed", "Try again with a valid file", "error");
    }
  };

  useEffect(() => {
    fetchFormats();
    fetchClasses();
  }, []);

  return (
    <div className="container mt-4">
      <h4>📋 Report Card Formats</h4>
      <Button className="mb-3" onClick={() => { resetForm(); setEditMode(false); setShowModal(true); }}>➕ Create New Format</Button>

      <Table bordered striped responsive>
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Header</th>
            <th>Footer</th>
            <th>School Logo</th>
            <th>Board Logo</th>
            <th>Classes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {formats.length === 0 ? (
            <tr><td colSpan="8" className="text-center">No formats available.</td></tr>
          ) : (
            formats.map((f, i) => (
              <tr key={f.id}>
                <td>{i + 1}</td>
                <td>{f.title}</td>
                <td dangerouslySetInnerHTML={{ __html: f.header_html }}></td>
                <td dangerouslySetInnerHTML={{ __html: f.footer_html }}></td>
                <td>
                  {f.school_logo_url ? (
                    <img src={f.school_logo_url} alt="School Logo" height={40} />
                  ) : (
                    <span className="text-muted">No logo</span>
                  )}
                </td>
                <td>
                  {f.board_logo_url ? (
                    <img src={f.board_logo_url} alt="Board Logo" height={40} />
                  ) : (
                    <span className="text-muted">No logo</span>
                  )}
                </td>
                <td>{f.classes?.map((c) => c.class_name).join(", ") || "—"}</td>
                <td>
                  <Button size="sm" onClick={() => handleEdit(f)}>Edit</Button>{" "}
                  <Button size="sm" variant="danger" onClick={() => handleDelete(f.id)}>Delete</Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editMode ? "Edit Format" : "Create Format"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Format Title</Form.Label>
              <Form.Control
                type="text"
                value={newFormat.title}
                onChange={(e) => setNewFormat({ ...newFormat, title: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Header HTML</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={newFormat.header_html}
                onChange={(e) => setNewFormat({ ...newFormat, header_html: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Footer HTML</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={newFormat.footer_html}
                onChange={(e) => setNewFormat({ ...newFormat, footer_html: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Upload School Logo</Form.Label>
              <Form.Control type="file" onChange={(e) => handleLogoUpload(e, "school_logo_url")} />
              {newFormat.school_logo_url && (
                <img
                  src={newFormat.school_logo_url}
                  alt="School Logo"
                  height={40}
                  className="mt-2"
                />
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Upload Board Logo</Form.Label>
              <Form.Control type="file" onChange={(e) => handleLogoUpload(e, "board_logo_url")} />
              {newFormat.board_logo_url && (
                <img
                  src={newFormat.board_logo_url}
                  alt="Board Logo"
                  height={40}
                  className="mt-2"
                />
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Assign Classes</Form.Label>
              <div className="row" style={{ maxHeight: "250px", overflowY: "auto" }}>
                {classList.map((c) => (
                  <div key={c.class_id} className="col-md-3">
                    <Form.Check
                      type="checkbox"
                      label={c.label || c.class_name}
                      value={c.class_id}
                      checked={newFormat.class_ids.includes(c.class_id)}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        const checked = e.target.checked;
                        setNewFormat((prev) => ({
                          ...prev,
                          class_ids: checked
                            ? [...prev.class_ids, id]
                            : prev.class_ids.filter((cid) => cid !== id),
                        }));
                      }}
                    />
                  </div>
                ))}
              </div>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreateOrUpdate}>
            {editMode ? "Update" : "Save Format"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ReportCardFormats;
