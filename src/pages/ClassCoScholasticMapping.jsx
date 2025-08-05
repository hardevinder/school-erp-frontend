import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button } from "react-bootstrap";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableRow({ mapping, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: mapping.id.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td {...attributes} {...listeners} style={{ cursor: "grab" }}>☰</td>
      <td>{mapping.class?.class_name}</td>
      <td>{mapping.area?.name}</td>
      <td>{mapping.grade?.grade || "-"}</td>
      <td>{mapping.term?.name || "-"}</td>
      <td>
        <button className="btn btn-sm btn-warning me-2" onClick={() => onEdit(mapping)}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(mapping.id)}>Delete</button>
      </td>
    </tr>
  );
}

const ClassCoScholasticMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [areas, setAreas] = useState([]);
  const [grades, setGrades] = useState([]);
  const [terms, setTerms] = useState([]);

  const [formData, setFormData] = useState({
    id: null,
    class_id: "",
    area_id: "",
    grade_id: "",
    term_id: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadDropdowns();
    fetchMappings();
  }, []);

  const loadDropdowns = async () => {
    try {
      const [cRes, aRes, gRes, tRes] = await Promise.all([
        api.get("/classes"),
        api.get("/co-scholastic-areas"),
        api.get("/co-scholastic-grades"),
        api.get("/terms"),
      ]);
      setClasses(cRes.data);
      setAreas(aRes.data);
      setGrades(gRes.data);
      setTerms(tRes.data);
    } catch {
      Swal.fire("Error", "Failed to load dropdowns.", "error");
    }
  };

  const fetchMappings = async () => {
    try {
      const res = await api.get("/class-co-scholastic-areas");
      setMappings(res.data);
    } catch {
      Swal.fire("Error", "Failed to fetch mappings.", "error");
    }
  };

  const openModal = (mapping = null) => {
    if (mapping) {
      setFormData({
        id: mapping.id,
        class_id: mapping.class_id,
        area_id: mapping.area_id,
        grade_id: mapping.grade_id || "",
        term_id: mapping.term_id || "",
      });
      setIsEditing(true);
    } else {
      setFormData({
        id: null,
        class_id: "",
        area_id: "",
        grade_id: "",
        term_id: "",
      });
      setIsEditing(false);
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const { class_id, area_id, term_id } = formData;
    if (!class_id || !area_id || !term_id) {
      return Swal.fire("Warning", "Please select Class, Area, and Term.", "warning");
    }
    try {
      if (isEditing) {
        await api.put(`/class-co-scholastic-areas/${formData.id}`, formData);
      } else {
        await api.post("/class-co-scholastic-areas", formData);
      }
      Swal.fire("Success", "Saved successfully.", "success");
      closeModal();
      fetchMappings();
    } catch {
      Swal.fire("Error", "Failed to save.", "error");
    }
  };

  const handleDelete = async (id) => {
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
    } catch {
      Swal.fire("Error", "Failed to delete.", "error");
    }
  };

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = mappings.findIndex((m) => m.id.toString() === active.id);
    const newIndex = mappings.findIndex((m) => m.id.toString() === over.id);
    const reordered = arrayMove(mappings, oldIndex, newIndex);
    setMappings(reordered);
    try {
      await api.post("/class-co-scholastic-areas/reorder", {
        mappings: reordered.map((m, idx) => ({ id: m.id, serial_order: idx + 1 })),
      });
    } catch {
      Swal.fire("Error", "Failed to reorder.", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h2>🎯 Class Co-Scholastic Area Mapping</h2>
      <div className="d-flex justify-content-end mb-3">
        <Button variant="success" onClick={() => openModal()}>➕ Add Mapping</Button>
      </div>
      <div className="card">
        <div className="card-body">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={mappings.map((m) => m.id.toString())} strategy={verticalListSortingStrategy}>
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th>#</th><th>Class</th><th>Area</th><th>Grade</th><th>Term</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <SortableRow
                      key={m.id}
                      mapping={m}
                      onEdit={openModal}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? "✏️ Edit Mapping" : "➕ Add Mapping"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-6">
              <label>Class</label>
              <select name="class_id" value={formData.class_id} onChange={handleChange} className="form-control">
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label>Co-Scholastic Area</label>
              <select name="area_id" value={formData.area_id} onChange={handleChange} className="form-control">
                <option value="">Select Area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label>Default Grade</label>
              <select name="grade_id" value={formData.grade_id} onChange={handleChange} className="form-control">
                <option value="">Optional</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>{g.grade}</option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label>Term</label>
              <select name="term_id" value={formData.term_id} onChange={handleChange} className="form-control">
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>
            {isEditing ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClassCoScholasticMapping;
