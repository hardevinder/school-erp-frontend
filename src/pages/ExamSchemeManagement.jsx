// src/pages/ExamSchemeManagement.jsx
import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";

// DnD Kit imports
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable row component
function SortableRow({ scheme, onEdit, onDelete, onToggleLock, onDuplicate }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: scheme.id.toString(),
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <tr ref={setNodeRef} style={style}>
      <td
        {...attributes}
        {...listeners}
        style={{ cursor: "grab", width: 40 }}
        title="Drag to reorder"
      >
        ☰
      </td>
      <td>{scheme.class?.class_name}</td>
      <td>{scheme.subject?.name}</td>
      <td>{scheme.term?.name}</td>
      <td>
        {scheme.component?.abbreviation
          ? `${scheme.component.abbreviation} - ${scheme.component.name}`
          : scheme.component?.name}
      </td>
      <td>{scheme.weightage_percent}%</td>
      <td>
        {scheme.is_locked ? (
          <span className="badge bg-danger">🔒 Locked</span>
        ) : (
          <span className="badge bg-success">🔓 Unlocked</span>
        )}
      </td>
      <td>
        {/* 📄 Copy / Duplicate icon */}
        <button
          className="btn btn-sm btn-outline-info me-2"
          onClick={() => onDuplicate(scheme)}
          title="Duplicate Scheme"
        >
          📄
        </button>

        {/* ✏️ Edit */}
        <button
          className="btn btn-sm btn-warning me-2"
          onClick={() => onEdit(scheme)}
          title="Edit Scheme"
        >
          Edit
        </button>

        {/* 🗑️ Delete */}
        <button
          className="btn btn-sm btn-danger me-2"
          onClick={() => onDelete(scheme.id)}
          title="Delete Scheme"
        >
          Delete
        </button>

        {/* 🔒 Lock / Unlock */}
        <button
          className={`btn btn-sm ${
            scheme.is_locked ? "btn-secondary" : "btn-outline-secondary"
          }`}
          onClick={() => onToggleLock(scheme)}
          title={scheme.is_locked ? "Unlock Marks Entry" : "Lock Marks Entry"}
        >
          {scheme.is_locked ? "Unlock" : "Lock"}
        </button>
      </td>
    </tr>
  );
}

const ExamSchemeManagement = () => {
  const [schemes, setSchemes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms] = useState([]);
  const [components, setComponents] = useState([]);

  const [filters, setFilters] = useState({ class_id: "", subject_id: "" });
  const [formData, setFormData] = useState({
    id: null,
    class_id: "",
    subject_id: "",
    term_id: "",
    component_id: "",
    weightage_percent: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchDropdowns();
    fetchSchemes();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [cRes, sRes, tRes, compRes] = await Promise.all([
        api.get("/classes"),
        api.get("/subjects"),
        api.get("/terms"),
        api.get("/assessment-components"),
      ]);
      setClasses(cRes.data);
      setSubjects(sRes.data.subjects || sRes.data);
      setTerms(tRes.data);
      setComponents(compRes.data);
    } catch (err) {
      Swal.fire("Error", "Unable to load dropdown data.", "error");
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await api.get("/exam-schemes", { params: filters });
      setSchemes(res.data);
    } catch (err) {
      Swal.fire("Error", "Unable to load exam schemes.", "error");
    }
  };

  const handleFilterChange = (e) =>
    setFilters({ ...filters, [e.target.name]: e.target.value });
  const applyFilters = () => fetchSchemes();

  const openModal = (scheme) => {
    if (scheme) {
      setFormData({
        id: scheme.id,
        class_id: scheme.class_id,
        subject_id: scheme.subject_id,
        term_id: scheme.term_id,
        component_id: scheme.component_id,
        weightage_percent: scheme.weightage_percent.toString(),
      });
      setIsEditing(true);
    } else {
      setFormData({
        id: null,
        class_id: "",
        subject_id: "",
        term_id: "",
        component_id: "",
        weightage_percent: "",
      });
      setIsEditing(false);
    }
    setShowModal(true);
  };

  const openDuplicateModal = (scheme) => {
    setFormData({
      id: null, // new copy record
      class_id: scheme.class_id,
      subject_id: scheme.subject_id,
      term_id: scheme.term_id,
      component_id: scheme.component_id,
      weightage_percent: scheme.weightage_percent.toString(),
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    const { class_id, subject_id, term_id, component_id, weightage_percent } =
      formData;
    if (
      !class_id ||
      !subject_id ||
      !term_id ||
      !component_id ||
      !weightage_percent
    ) {
      return Swal.fire("Warning", "Please fill all fields.", "warning");
    }
    try {
      if (isEditing) {
        await api.put(`/exam-schemes/${formData.id}`, formData);
      } else {
        await api.post("/exam-schemes", formData);
      }
      Swal.fire("Success", "Saved successfully.", "success");
      closeModal();
      fetchSchemes();
    } catch {
      Swal.fire("Error", "Failed to save.", "error");
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Confirm Deletion",
      text: "This will delete the scheme.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/exam-schemes/${id}`);
      Swal.fire("Deleted", "Scheme removed.", "success");
      fetchSchemes();
    } catch {
      Swal.fire("Error", "Failed to delete.", "error");
    }
  };

  const handleToggleLock = async (scheme) => {
    const action = scheme.is_locked ? "unlock" : "lock";
    const result = await Swal.fire({
      title: `Confirm to ${action}`,
      text: `Are you sure you want to ${action}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Yes, ${action}`,
    });
    if (!result.isConfirmed) return;
    try {
      await api.patch(`/exam-schemes/${scheme.id}/lock`, {
        is_locked: !scheme.is_locked,
      });
      Swal.fire(
        "Success",
        `Component ${!scheme.is_locked ? "locked" : "unlocked"} successfully.`,
        "success"
      );
      fetchSchemes();
    } catch {
      Swal.fire("Error", "Failed to toggle lock status.", "error");
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = schemes.findIndex((s) => s.id.toString() === active.id);
    const newIndex = schemes.findIndex((s) => s.id.toString() === over.id);
    const reordered = arrayMove(schemes, oldIndex, newIndex);
    setSchemes(reordered);
    try {
      await api.post("/exam-schemes/reorder", {
        schemes: reordered.map((item, idx) => ({
          id: item.id,
          serial_order: idx + 1,
        })),
      });
    } catch {
      Swal.fire("Error", "Failed to update order.", "error");
      fetchSchemes();
    }
  };

  return (
    <div className="container mt-4">
      <h2>📘 Exam Scheme Management</h2>

      {/* Filters & Add */}
      <div className="d-flex justify-content-between align-items-end mb-3">
        <div className="d-flex gap-2 flex-wrap">
          <select
            name="class_id"
            value={filters.class_id}
            onChange={handleFilterChange}
            className="form-control"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.class_name}
              </option>
            ))}
          </select>
          <select
            name="subject_id"
            value={filters.subject_id}
            onChange={handleFilterChange}
            className="form-control"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button variant="primary" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
        <Button variant="success" onClick={() => openModal()}>
          ➕ Add Scheme
        </Button>
      </div>

      {/* Table */}
      <div className="card mb-3">
        <div className="card-body">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={schemes.map((s) => s.id.toString())}
              strategy={verticalListSortingStrategy}
            >
              <table className="table table-bordered table-striped">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Term</th>
                    <th>Component</th>
                    <th>Weightage (%)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schemes.map((s) => (
                    <SortableRow
                      key={s.id}
                      scheme={s}
                      onEdit={openModal}
                      onDelete={handleDelete}
                      onToggleLock={handleToggleLock}
                      onDuplicate={openDuplicateModal}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={closeModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? "✏️ Edit Scheme" : "➕ Add / Duplicate Scheme"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label>Class</label>
              <select
                name="class_id"
                value={formData.class_id}
                onChange={handleChange}
                className="form-control"
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
              <label>Subject</label>
              <select
                name="subject_id"
                value={formData.subject_id}
                onChange={handleChange}
                className="form-control"
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label>Term</label>
              <select
                name="term_id"
                value={formData.term_id}
                onChange={handleChange}
                className="form-control"
              >
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label>Component</label>
              <select
                name="component_id"
                value={formData.component_id}
                onChange={handleChange}
                className="form-control"
              >
                <option value="">Select Component</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.abbreviation} - {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label>Weightage (%)</label>
              <input
                type="number"
                name="weightage_percent"
                value={formData.weightage_percent}
                onChange={handleChange}
                className="form-control"
                placeholder="%"
              />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {isEditing ? "Update" : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamSchemeManagement;
