// src/pages/ExamSchemeManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable row component
function SortableRow({ scheme, onEdit, onDelete, onToggleLock, onDuplicate }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
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
    weightage_percent: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // ✅ Bulk Copy Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyData, setCopyData] = useState({
    class_id: "",
    from_subject_id: "",
    to_subject_ids: [],
    overwrite: false,
  });

  // helpers
  const subjectById = useMemo(() => {
    const map = new Map();
    (subjects || []).forEach((s) => map.set(String(s.id), s));
    return map;
  }, [subjects]);

  useEffect(() => {
    fetchDropdowns();
    fetchSchemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ==============================
  // ✅ NEW: Bulk Delete (All / Filtered)
  // ==============================
  const handleDeleteAllSchemes = async () => {
    const classId = filters.class_id ? String(filters.class_id) : "";
    const subjectId = filters.subject_id ? String(filters.subject_id) : "";

    const isFiltered = !!(classId || subjectId);

    const scopeHtml = isFiltered
      ? `
        <div style="text-align:left">
          <div><b>This will delete schemes matching current filters:</b></div>
          <div><b>Class:</b> ${classId || "All Classes"}</div>
          <div><b>Subject:</b> ${subjectId || "All Subjects"}</div>
        </div>
      `
      : `
        <div style="text-align:left">
          <div><b style="color:#d33">This will delete ALL exam schemes from the system.</b></div>
          <div>Filters are not selected.</div>
        </div>
      `;

    // 1st confirm
    const c1 = await Swal.fire({
      title: isFiltered ? "⚠️ Confirm Delete Filtered Schemes" : "🧨 Confirm Delete ALL Schemes",
      html: scopeHtml,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Continue",
      confirmButtonColor: "#d33",
    });
    if (!c1.isConfirmed) return;

    // 2nd confirm: type DELETE
    const c2 = await Swal.fire({
      title: "Type DELETE to confirm",
      input: "text",
      inputPlaceholder: "DELETE",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete Now",
      confirmButtonColor: "#d33",
      preConfirm: (val) => {
        if ((val || "").trim().toUpperCase() !== "DELETE") {
          Swal.showValidationMessage("Please type DELETE exactly.");
        }
        return val;
      },
    });
    if (!c2.isConfirmed) return;

    try {
      Swal.fire({
        title: "Deleting...",
        text: "Please wait",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.delete("/exam-schemes", {
        params: {
          class_id: classId || undefined,
          subject_id: subjectId || undefined,
        },
      });

      const deleted = res?.data?.deleted ?? 0;

      await Swal.fire(
        "Deleted ✅",
        `${deleted} scheme(s) removed successfully.`,
        "success"
      );

      fetchSchemes();
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to delete schemes.";
      Swal.fire("Error", msg, "error");
    }
  };

  const openModal = (scheme) => {
    if (scheme) {
      setFormData({
        id: scheme.id,
        class_id: String(scheme.class_id ?? ""),
        subject_id: String(scheme.subject_id ?? ""),
        term_id: String(scheme.term_id ?? ""),
        component_id: String(scheme.component_id ?? ""),
        weightage_percent: String(scheme.weightage_percent ?? ""),
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

  // ✅ Single-row Duplicate modal
  const openDuplicateModal = (scheme) => {
    setFormData({
      id: null,
      class_id: String(scheme.class_id ?? ""),
      subject_id: String(scheme.subject_id ?? ""),
      term_id: String(scheme.term_id ?? ""),
      component_id: String(scheme.component_id ?? ""),
      weightage_percent: String(scheme.weightage_percent ?? ""),
    });
    setIsEditing(false);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async () => {
    const payload = {
      ...formData,
      class_id: String(formData.class_id || ""),
      subject_id: String(formData.subject_id || ""),
      term_id: String(formData.term_id || ""),
      component_id: String(formData.component_id || ""),
      weightage_percent: String(formData.weightage_percent || ""),
    };

    const { class_id, subject_id, term_id, component_id, weightage_percent } =
      payload;

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
        await api.put(`/exam-schemes/${payload.id}`, payload);
      } else {
        await api.post("/exam-schemes", payload);
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

  // ==============================
  // ✅ Bulk Copy handlers
  // ==============================
  const openCopyModal = () => {
    setCopyData({
      class_id: filters.class_id ? String(filters.class_id) : "",
      from_subject_id: filters.subject_id ? String(filters.subject_id) : "",
      to_subject_ids: [],
      overwrite: false,
    });
    setShowCopyModal(true);
  };

  const closeCopyModal = () => setShowCopyModal(false);

  const handleCopySubmit = async () => {
    const { class_id, from_subject_id, to_subject_ids, overwrite } = copyData;

    if (!from_subject_id) {
      return Swal.fire("Warning", "Please select From Subject.", "warning");
    }
    if (!to_subject_ids || !to_subject_ids.length) {
      return Swal.fire(
        "Warning",
        "Please select at least one To Subject.",
        "warning"
      );
    }

    const cleanedTargets = to_subject_ids
      .map(String)
      .filter((id) => id !== String(from_subject_id));

    if (!cleanedTargets.length) {
      return Swal.fire(
        "Warning",
        "To Subject(s) cannot include From Subject.",
        "warning"
      );
    }

    const fromName =
      subjectById.get(String(from_subject_id))?.name || "Selected";
    const toNames = cleanedTargets
      .map((id) => subjectById.get(String(id))?.name || id)
      .join(", ");

    // ✅ CLOSE MODAL FIRST (fix overlap)
    setShowCopyModal(false);
    await new Promise((r) => setTimeout(r, 150));

    const confirm = await Swal.fire({
      title: "Confirm Bulk Copy",
      html: `
        <div style="text-align:left">
          <div><b>From:</b> ${fromName}</div>
          <div><b>To:</b> ${toNames}</div>
          <div><b>Class:</b> ${class_id ? class_id : "All Classes"}</div>
          <div><b>Overwrite:</b> ${overwrite ? "Yes" : "No (skip duplicates)"}</div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Copy",
    });

    // If cancelled, reopen modal (nice UX)
    if (!confirm.isConfirmed) {
      setShowCopyModal(true);
      return;
    }

    try {
      Swal.fire({
        title: "Copying...",
        text: "Please wait",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post("/exam-schemes/bulk-duplicate", {
        from_subject_id: Number(from_subject_id),
        to_subject_ids: cleanedTargets.map(Number),
        class_id: class_id ? Number(class_id) : null,
        overwrite: !!overwrite,
      });

      const created = res?.data?.created ?? 0;
      const per = res?.data?.per_target_created || {};

      const perLines = Object.entries(per)
        .map(([sid, cnt]) => {
          const nm = subjectById.get(String(sid))?.name || sid;
          return `${nm}: ${cnt}`;
        })
        .join("<br/>");

      await Swal.fire(
        "Success",
        `
          Bulk copy completed ✅<br/>
          <b>Total created:</b> ${created}<br/>
          ${perLines ? `<hr/><div style="text-align:left">${perLines}</div>` : ""}
        `,
        "success"
      );

      fetchSchemes();
    } catch (e) {
      const msg = e?.response?.data?.message || "Bulk copy failed.";
      Swal.fire("Error", msg, "error");
    }
  };

  const isFiltered = !!(filters.class_id || filters.subject_id);

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <h2 className="m-0">📘 Exam Scheme Management</h2>

        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-info" onClick={openCopyModal}>
            📚 Copy Subject Scheme
          </Button>

          {/* ✅ NEW: Delete All / Filtered */}
          <Button variant="outline-danger" onClick={handleDeleteAllSchemes}>
            🧨 Delete {isFiltered ? "Filtered" : "All"} Schemes
          </Button>

          <Button variant="success" onClick={() => openModal()}>
            ➕ Add Scheme
          </Button>
        </div>
      </div>

      {/* Filters */}
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
      </div>

      {/* Table */}
      <div className="card mb-3">
        <div className="card-body">
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
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
                    <th style={{ width: 260 }}>Actions</th>
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

      {/* Add/Edit/Duplicate (single row) Modal */}
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
                  <option key={c.id} value={String(c.id)}>
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
                  <option key={s.id} value={String(s.id)}>
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
                  <option key={t.id} value={String(t.id)}>
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
                  <option key={c.id} value={String(c.id)}>
                    {c.abbreviation ? `${c.abbreviation} - ${c.name}` : c.name}
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

      {/* Bulk Copy Modal */}
      <Modal show={showCopyModal} onHide={closeCopyModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>📚 Copy Subject Scheme (Bulk)</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label>Class (optional)</label>
              <select
                className="form-control"
                value={copyData.class_id}
                onChange={(e) =>
                  setCopyData({ ...copyData, class_id: e.target.value })
                }
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.class_name}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                If you select class, only that class schemes will be copied.
              </small>
            </div>

            <div className="col-12 col-md-6">
              <label>From Subject</label>
              <select
                className="form-control"
                value={copyData.from_subject_id}
                onChange={(e) =>
                  setCopyData({ ...copyData, from_subject_id: e.target.value })
                }
              >
                <option value="">Select</option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Example: English (PT scheme already made)
              </small>
            </div>

            <div className="col-12">
              <label>To Subject(s)</label>
              <select
                multiple
                className="form-control"
                value={copyData.to_subject_ids}
                onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions).map(
                    (o) => o.value
                  );
                  setCopyData({ ...copyData, to_subject_ids: vals });
                }}
                style={{ minHeight: 160 }}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Ctrl/Command hold karke multiple select karo. (OA, Punjabi, etc.)
              </small>
            </div>

            <div className="col-12">
              <div className="form-check mt-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={copyData.overwrite}
                  onChange={(e) =>
                    setCopyData({ ...copyData, overwrite: e.target.checked })
                  }
                  id="overwriteChk"
                />
                <label className="form-check-label" htmlFor="overwriteChk">
                  Overwrite target schemes (delete first)
                </label>
              </div>
              <small className="text-muted">
                If unchecked, it will safely skip duplicates.
              </small>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={closeCopyModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCopySubmit}>
            Copy Now
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamSchemeManagement;
