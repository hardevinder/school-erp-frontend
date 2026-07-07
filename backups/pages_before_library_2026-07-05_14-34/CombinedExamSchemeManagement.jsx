import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

// DnD Kit
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 🔁 Sortable Row Component
function SortableRow({ scheme, index, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: scheme.id.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td {...attributes} {...listeners} style={{ cursor: "grab" }}>☰</td>
      <td>{scheme.class?.class_name}</td>
      <td>{scheme.subject?.name}</td>
      <td>{scheme.exam?.name}</td>
      <td>{scheme.weightage_percent}%</td>
      <td>
        <button className="btn btn-sm btn-warning me-2" onClick={() => onEdit(scheme)}>
          Edit
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => onDelete(scheme.id)}>
          Delete
        </button>
      </td>
    </tr>
  );
}

const CombinedExamSchemeManagement = () => {
  const [schemes, setSchemes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [filters, setFilters] = useState({ class_id: "", subject_id: "" });
  const [formData, setFormData] = useState({
    id: null,
    class_id: "",
    subject_id: "",
    exam_id: "",
    weightage_percent: ""
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchDropdowns();
    fetchSchemes();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [classRes, subjRes, examRes] = await Promise.all([
        api.get("/classes"),
        api.get("/subjects"),
        api.get("/exams")
      ]);
      setClasses(classRes.data);
      setSubjects(subjRes.data.subjects || subjRes.data);
      setExams(examRes.data);
    } catch (error) {
      console.error("Dropdown error:", error);
      Swal.fire("Error", "Failed to load dropdowns", "error");
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await api.get("/combined-exam-schemes", { params: filters });
      setSchemes(res.data || []);
    } catch (error) {
      console.error("Fetch error:", error);
      Swal.fire("Error", "Failed to load combined exam schemes", "error");
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleFilterChange = (e) => setFilters({ ...filters, [e.target.name]: e.target.value });

  const applyFilters = () => fetchSchemes();

  const handleSubmit = async () => {
    const { class_id, subject_id, exam_id, weightage_percent } = formData;
    if (!class_id || !subject_id || !exam_id || !weightage_percent) {
      Swal.fire("Warning", "All fields are required", "warning");
      return;
    }

    try {
      if (isEditing) {
        await api.put(`/combined-exam-schemes/${formData.id}`, { weightage_percent });
      } else {
        await api.post("/combined-exam-schemes", formData);
      }
      Swal.fire("Success", "Saved successfully", "success");
      resetForm();
      fetchSchemes();
    } catch (error) {
      console.error("Save error:", error);
      Swal.fire("Error", "Failed to save scheme", "error");
    }
  };

  const handleEdit = (scheme) => {
    setFormData({
      id: scheme.id,
      class_id: scheme.class_id,
      subject_id: scheme.subject_id,
      exam_id: scheme.exam_id,
      weightage_percent: scheme.weightage_percent
    });
    setIsEditing(true);
  };

  const resetForm = () => {
    setFormData({ id: null, class_id: "", subject_id: "", exam_id: "", weightage_percent: "" });
    setIsEditing(false);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete?",
      text: "This will remove the exam weightage.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete"
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/combined-exam-schemes/${id}`);
      Swal.fire("Deleted", "Scheme removed", "success");
      fetchSchemes();
    } catch (error) {
      console.error("Delete error:", error);
      Swal.fire("Error", "Failed to delete", "error");
    }
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = schemes.findIndex(s => s.id.toString() === active.id);
    const newIndex = schemes.findIndex(s => s.id.toString() === over.id);
    const reordered = arrayMove(schemes, oldIndex, newIndex);
    setSchemes(reordered);
    // No backend reorder needed here unless serial_order is added later
  };

  return (
    <div className="container mt-4">
      <h2>🧮 Combined Exam Scheme Management</h2>

      {/* Filter */}
      <div className="card mt-4 mb-4"><div className="card-body">
        <h5>Filter</h5>
        <div className="row">
          <div className="col-md-4 mb-2">
            <label>Class</label>
            <select name="class_id" value={filters.class_id} onChange={handleFilterChange} className="form-control">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>
          <div className="col-md-4 mb-2">
            <label>Subject</label>
            <select name="subject_id" value={filters.subject_id} onChange={handleFilterChange} className="form-control">
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-4 d-flex align-items-end mb-2">
            <button className="btn btn-primary w-100" onClick={applyFilters}>Apply Filters</button>
          </div>
        </div>
      </div></div>

      {/* Form */}
      <div className="card mb-4"><div className="card-body">
        <h5>{isEditing ? "✏️ Edit Scheme" : "➕ Add Scheme"}</h5>
        <div className="row">
          <div className="col-md-3 mb-3"><label>Class</label>
            <select name="class_id" value={formData.class_id} onChange={handleChange} className="form-control">
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
            </select>
          </div>
          <div className="col-md-3 mb-3"><label>Subject</label>
            <select name="subject_id" value={formData.subject_id} onChange={handleChange} className="form-control">
              <option value="">Select Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-3 mb-3"><label>Exam</label>
            <select name="exam_id" value={formData.exam_id} onChange={handleChange} className="form-control">
              <option value="">Select Exam</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="col-md-3 mb-3"><label>Weightage (%)</label>
            <input type="number" name="weightage_percent" value={formData.weightage_percent} onChange={handleChange} className="form-control" placeholder="%" />
          </div>
          <div className="col-md-12 d-flex justify-content-start">
            <button className="btn btn-success me-2" onClick={handleSubmit}>{isEditing ? "Update" : "Create"}</button>
            {isEditing && <button className="btn btn-secondary" onClick={resetForm}>Cancel</button>}
          </div>
        </div>
      </div></div>

      {/* Table */}
      <div className="card"><div className="card-body">
        <h5>Combined Exam Schemes</h5>
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={schemes.map(s => s.id.toString())} strategy={verticalListSortingStrategy}>
            <table className="table table-bordered table-striped">
              <thead className="table-light">
                <tr>
                  <th>#</th><th>Class</th><th>Subject</th><th>Exam</th><th>Weightage (%)</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schemes.map((s, i) => (
                  <SortableRow key={s.id} scheme={s} index={i} onEdit={handleEdit} onDelete={handleDelete} />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div></div>
    </div>
  );
};

export default CombinedExamSchemeManagement;
