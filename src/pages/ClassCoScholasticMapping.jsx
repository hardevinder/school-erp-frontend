import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button } from "react-bootstrap";

/** 👇 Backend ke hisaab se list endpoint (NO /list) */
const LIST_ENDPOINT = "/class-co-scholastic-areas";

const ClassCoScholasticMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [areas, setAreas] = useState([]);
  const [terms, setTerms] = useState([]);

  const [formData, setFormData] = useState({
    id: null,
    class_id: "",
    area_id: "",
    term_id: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadDropdowns();
    fetchMappings();
  }, []);

  // 🔽 Load dropdown values
  async function loadDropdowns() {
    try {
      const [cRes, aRes, tRes] = await Promise.all([
        api.get("/classes"),
        api.get("/co-scholastic-areas"),
        api.get("/terms"),
      ]);
      setClasses(cRes.data || []);
      setAreas(aRes.data || []);
      setTerms(tRes.data || []);
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to load dropdowns.", "error");
    }
  }

  // 📋 Fetch existing mappings
  async function fetchMappings() {
    try {
      const res = await api.get(LIST_ENDPOINT);
      setMappings(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "";
      Swal.fire("Error", msg || "Failed to fetch mappings.", "error");
      setMappings([]);
    }
  }

  function openModal(mapping = null) {
    if (mapping) {
      setFormData({
        id: mapping.id,
        class_id: String(
          mapping.class_id ||
            mapping.class?.id ||
            mapping.Class?.id ||
            ""
        ),
        area_id: String(
          mapping.area_id ||
            mapping.area?.id ||
            mapping.Area?.id ||
            ""
        ),
        term_id: String(
          mapping.term_id ||
            mapping.term?.id ||
            mapping.Term?.id ||
            ""
        ),
      });
      setIsEditing(true);
    } else {
      setFormData({
        id: null,
        class_id: "",
        area_id: "",
        term_id: "",
      });
      setIsEditing(false);
    }
    setShowModal(true);
  }

  const closeModal = () => setShowModal(false);

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  // 💾 Create / Update mapping
  async function handleSubmit() {
    const { class_id, area_id, term_id } = formData;
    if (!class_id || !area_id || !term_id) {
      return Swal.fire(
        "Warning",
        "Please select Class, Area, and Term.",
        "warning"
      );
    }

    try {
      if (isEditing && formData.id != null) {
        await api.put(
          `/class-co-scholastic-areas/${formData.id}`,
          formData
        );
      } else {
        await api.post("/class-co-scholastic-areas", formData);
      }
      Swal.fire("Success", "Saved successfully.", "success");
      closeModal();
      fetchMappings();
    } catch (e) {
      Swal.fire(
        "Error",
        e?.response?.data?.message || "Failed to save.",
        "error"
      );
    }
  }

  // ❌ Delete mapping
  async function handleDelete(id) {
    const result = await Swal.fire({
      title: "Confirm Delete",
      text: "This will remove the mapping.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/class-co-scholastic-areas/${id}`);
      fetchMappings();
    } catch (e) {
      Swal.fire(
        "Error",
        e?.response?.data?.message || "Failed to delete.",
        "error"
      );
    }
  }

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 className="m-0">🎯 Class Co-Scholastic Area Mapping</h2>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={fetchMappings}>
            Refresh
          </Button>
          <Button variant="success" onClick={() => openModal()}>
            ➕ Add Mapping
          </Button>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 60, textAlign: "center" }}>#</th>
                  <th>Class</th>
                  <th>Co-Scholastic Area</th>
                  <th>Term</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No mappings found.
                    </td>
                  </tr>
                ) : (
                  mappings.map((m, idx) => (
                    <tr key={m.id}>
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td>{m.class?.class_name || m.Class?.class_name || "-"}</td>
                      <td>{m.area?.name || m.Area?.name || "-"}</td>
                      <td>{m.term?.name || m.Term?.name || "-"}</td>
                      <td className="text-nowrap">
                        <button
                          className="btn btn-sm btn-warning me-2"
                          onClick={() => openModal(m)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(m.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? "✏️ Edit Mapping" : "➕ Add Mapping"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Class</label>
              <select
                name="class_id"
                value={formData.class_id}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Co-Scholastic Area</label>
              <select
                name="area_id"
                value={formData.area_id}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select Area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Term</label>
              <select
                name="term_id"
                value={formData.term_id}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-between">
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {isEditing ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClassCoScholasticMapping;
