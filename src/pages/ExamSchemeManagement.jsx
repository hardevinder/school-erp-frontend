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

/* =========================================
 * Helpers
 * ========================================= */
const strId = (v) => (v === null || v === undefined ? "" : String(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const safeMode = (m) => {
  const s = String(m || "").toUpperCase().trim();
  return s === "GRADE" ? "GRADE" : "MARKS";
};

// Sortable row component
function SortableRow({
  scheme,
  onEdit,
  onDelete,
  onToggleLock,
  onDuplicate,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: scheme.id.toString(),
    });

  const style = { transform: CSS.Transform.toString(transform), transition };

  // Grade/Marks now comes from AssessmentComponent.component_type
  const mode = safeMode(scheme.component?.component_type);
  const maxMarks = scheme.component?.max_marks ?? 0;

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

      <td>{scheme.session?.name || "-"}</td>
      <td>{scheme.class?.class_name || "-"}</td>
      <td>{scheme.subject?.name || "-"}</td>
      <td>{scheme.term?.name || "-"}</td>

      <td>
        {scheme.component?.abbreviation
          ? `${scheme.component.abbreviation} - ${scheme.component.name}`
          : scheme.component?.name || "-"}
      </td>

      <td style={{ width: 120 }}>
        <span
          className={`badge ${
            mode === "GRADE" ? "bg-info text-dark" : "bg-primary"
          }`}
        >
          {mode}
        </span>
      </td>

      <td>{mode === "GRADE" ? "-" : maxMarks}</td>

      <td>{scheme.weightage_percent ?? 0}%</td>

      <td>
        {scheme.is_locked ? (
          <span className="badge bg-danger">🔒 Locked</span>
        ) : (
          <span className="badge bg-success">🔓 Unlocked</span>
        )}
      </td>

      <td>
        <button
          className="btn btn-sm btn-outline-info me-2"
          onClick={() => onDuplicate(scheme)}
          title="Duplicate Scheme"
        >
          📄
        </button>

        <button
          className="btn btn-sm btn-warning me-2"
          onClick={() => onEdit(scheme)}
          title="Edit Scheme"
        >
          Edit
        </button>

        <button
          className="btn btn-sm btn-danger me-2"
          onClick={() => onDelete(scheme.id)}
          title="Delete Scheme"
        >
          Delete
        </button>

        <button
          className={`btn btn-sm ${
            scheme.is_locked ? "btn-secondary" : "btn-outline-secondary"
          }`}
          onClick={() => onToggleLock(scheme)}
          title={scheme.is_locked ? "Unlock marks entry" : "Lock marks entry"}
        >
          {scheme.is_locked ? "Unlock" : "Lock"}
        </button>
      </td>
    </tr>
  );
}

const ExamSchemeManagement = () => {
  const [schemes, setSchemes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms] = useState([]);
  const [components, setComponents] = useState([]);

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    subject_id: "",
  });

  const [formData, setFormData] = useState({
    id: null,
    session_id: "",
    class_id: "",
    subject_id: "",
    term_id: "",
    component_id: "",
    weightage_percent: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Bulk Copy Subject Modal
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyData, setCopyData] = useState({
    session_id: "",
    class_id: "",
    from_subject_id: "",
    to_subject_ids: [],
    overwrite: false,
  });

  // Copy Full Class Schema Modal
  const [showClassCopyModal, setShowClassCopyModal] = useState(false);
  const [classCopyData, setClassCopyData] = useState({
    from_session_id: "",
    from_class_id: "",
    to_session_id: "",
    to_class_ids: [],
    overwrite: false,
  });

  // Copy Full Term Schema Modal
  const [showTermCopyModal, setShowTermCopyModal] = useState(false);
  const [termCopyData, setTermCopyData] = useState({
    session_id: "",
    class_id: "",
    from_term_id: "",
    to_term_id: "",
    overwrite: false,
  });

  const sessionById = useMemo(() => {
    const map = new Map();
    (sessions || []).forEach((s) => map.set(String(s.id), s));
    return map;
  }, [sessions]);

  const subjectById = useMemo(() => {
    const map = new Map();
    (subjects || []).forEach((s) => map.set(String(s.id), s));
    return map;
  }, [subjects]);

  const classById = useMemo(() => {
    const map = new Map();
    (classes || []).forEach((c) => map.set(String(c.id), c));
    return map;
  }, [classes]);

  const termById = useMemo(() => {
    const map = new Map();
    (terms || []).forEach((t) => map.set(String(t.id), t));
    return map;
  }, [terms]);

  useEffect(() => {
    fetchDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSchemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [sessRes, cRes, sRes, tRes, compRes] = await Promise.all([
        api.get("/sessions"),
        api.get("/classes"),
        api.get("/subjects"),
        api.get("/terms"),
        api.get("/assessment-components"),
      ]);

      setSessions(sessRes.data || []);
      setClasses(cRes.data || []);
      setSubjects(sRes.data?.subjects || sRes.data || []);
      setTerms(tRes.data || []);
      setComponents(compRes.data || []);
    } catch (err) {
      Swal.fire("Error", "Unable to load dropdown data.", "error");
    }
  };

  const fetchSchemes = async () => {
    try {
      const params = {};
      if (filters.session_id) params.session_id = filters.session_id;
      if (filters.class_id) params.class_id = filters.class_id;
      if (filters.subject_id) params.subject_id = filters.subject_id;

      const res = await api.get("/exam-schemes", { params });
      setSchemes(res.data || []);
    } catch (err) {
      Swal.fire("Error", "Unable to load exam schemes.", "error");
    }
  };

  const handleFilterChange = (e) =>
    setFilters({ ...filters, [e.target.name]: e.target.value });

  const applyFilters = () => fetchSchemes();

  const handleDeleteAllSchemes = async () => {
    const sessionId = filters.session_id ? String(filters.session_id) : "";
    const classId = filters.class_id ? String(filters.class_id) : "";
    const subjectId = filters.subject_id ? String(filters.subject_id) : "";
    const isFilteredLocal = !!(sessionId || classId || subjectId);

    if (!isFilteredLocal) {
      return Swal.fire(
        "Select Filter",
        "Please select at least one filter before deleting schemes.",
        "warning"
      );
    }

    const sessionName =
      sessionId && sessionById.get(sessionId)
        ? sessionById.get(sessionId).name
        : "All Sessions";
    const className =
      classId && classById.get(classId)
        ? classById.get(classId).class_name
        : "All Classes";
    const subjectName =
      subjectId && subjectById.get(subjectId)
        ? subjectById.get(subjectId).name
        : "All Subjects";

    const scopeHtml = `
      <div style="text-align:left">
        <div><b>This will delete schemes matching current filters:</b></div>
        <div><b>Session:</b> ${sessionName}</div>
        <div><b>Class:</b> ${className}</div>
        <div><b>Subject:</b> ${subjectName}</div>
        <hr/>
        <div style="font-size:13px;color:#666">
          Locked schemes will be skipped by the backend.
        </div>
      </div>
    `;

    const c1 = await Swal.fire({
      title: "⚠️ Confirm Delete Filtered Schemes",
      html: scopeHtml,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Continue",
      confirmButtonColor: "#d33",
    });
    if (!c1.isConfirmed) return;

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
          session_id: sessionId || undefined,
          class_id: classId || undefined,
          subject_id: subjectId || undefined,
        },
      });

      const deleted = res?.data?.deleted ?? 0;

      await Swal.fire(
        "Deleted ✅",
        `${deleted} unlocked scheme(s) removed successfully.`,
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
        session_id: strId(scheme.session_id),
        class_id: strId(scheme.class_id),
        subject_id: strId(scheme.subject_id),
        term_id: strId(scheme.term_id),
        component_id: strId(scheme.component_id),
        weightage_percent: strId(scheme.weightage_percent),
      });
      setIsEditing(true);
    } else {
      setFormData({
        id: null,
        session_id: filters.session_id ? String(filters.session_id) : "",
        class_id: filters.class_id ? String(filters.class_id) : "",
        subject_id: filters.subject_id ? String(filters.subject_id) : "",
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
      id: null,
      session_id: strId(scheme.session_id),
      class_id: strId(scheme.class_id),
      subject_id: strId(scheme.subject_id),
      term_id: strId(scheme.term_id),
      component_id: strId(scheme.component_id),
      weightage_percent: strId(scheme.weightage_percent),
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
      session_id: String(formData.session_id || ""),
      class_id: String(formData.class_id || ""),
      subject_id: String(formData.subject_id || ""),
      term_id: String(formData.term_id || ""),
      component_id: String(formData.component_id || ""),
      weightage_percent: String(formData.weightage_percent || ""),
    };

    const {
      session_id,
      class_id,
      subject_id,
      term_id,
      component_id,
      weightage_percent,
    } = payload;

    if (!session_id || !class_id || !subject_id || !term_id || !component_id) {
      return Swal.fire("Warning", "Please fill all fields.", "warning");
    }

    if (weightage_percent === "" || weightage_percent === null) {
      return Swal.fire("Warning", "Please enter weightage.", "warning");
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
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to save.";
      Swal.fire("Error", msg, "error");
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
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to delete.";
      Swal.fire("Error", msg, "error");
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
    } catch (e) {
      const msg = e?.response?.data?.message || "Failed to toggle lock status.";
      Swal.fire("Error", msg, "error");
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
    } catch (e) {
      Swal.fire("Error", "Failed to update order.", "error");
      fetchSchemes();
    }
  };

  const openCopyModal = () => {
    setCopyData({
      session_id: filters.session_id ? String(filters.session_id) : "",
      class_id: filters.class_id ? String(filters.class_id) : "",
      from_subject_id: filters.subject_id ? String(filters.subject_id) : "",
      to_subject_ids: [],
      overwrite: false,
    });
    setShowCopyModal(true);
  };

  const closeCopyModal = () => setShowCopyModal(false);

  const handleCopySubmit = async () => {
    const { session_id, class_id, from_subject_id, to_subject_ids, overwrite } =
      copyData;

    if (!session_id) {
      return Swal.fire("Warning", "Please select Session.", "warning");
    }
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

    const sessionName = sessionById.get(String(session_id))?.name || session_id;
    const fromName = subjectById.get(String(from_subject_id))?.name || "Selected";
    const toNames = cleanedTargets
      .map((id) => subjectById.get(String(id))?.name || id)
      .join(", ");

    setShowCopyModal(false);
    await sleep(150);

    const confirm = await Swal.fire({
      title: "Confirm Subject Bulk Copy",
      html: `
        <div style="text-align:left">
          <div><b>Session:</b> ${sessionName}</div>
          <div><b>From:</b> ${fromName}</div>
          <div><b>To:</b> ${toNames}</div>
          <div><b>Class:</b> ${
            class_id
              ? classById.get(String(class_id))?.class_name || class_id
              : "All Classes"
          }</div>
          <div><b>Overwrite:</b> ${overwrite ? "Yes" : "No (skip duplicates)"}</div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Copy",
    });

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
        session_id: Number(session_id),
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
          Subject copy completed ✅<br/>
          <b>Total created:</b> ${created}<br/>
          ${
            perLines
              ? `<hr/><div style="text-align:left">${perLines}</div>`
              : ""
          }
        `,
        "success"
      );

      fetchSchemes();
    } catch (e) {
      const msg = e?.response?.data?.message || "Bulk copy failed.";
      Swal.fire("Error", msg, "error");
    }
  };

  const openClassCopyModal = () => {
    setClassCopyData({
      from_session_id: filters.session_id ? String(filters.session_id) : "",
      from_class_id: filters.class_id ? String(filters.class_id) : "",
      to_session_id: filters.session_id ? String(filters.session_id) : "",
      to_class_ids: [],
      overwrite: false,
    });
    setShowClassCopyModal(true);
  };

  const closeClassCopyModal = () => setShowClassCopyModal(false);

  const handleClassCopySubmit = async () => {
    const { from_session_id, from_class_id, to_session_id, to_class_ids, overwrite } =
      classCopyData;

    if (!from_session_id) {
      return Swal.fire("Warning", "Please select From Session.", "warning");
    }
    if (!from_class_id) {
      return Swal.fire("Warning", "Please select From Class.", "warning");
    }
    if (!to_session_id) {
      return Swal.fire("Warning", "Please select To Session.", "warning");
    }
    if (!to_class_ids || !to_class_ids.length) {
      return Swal.fire(
        "Warning",
        "Please select at least one To Class.",
        "warning"
      );
    }

    const cleanedTargets = to_class_ids
      .map(String)
      .filter((id) => {
        if (String(from_session_id) === String(to_session_id)) {
          return id !== String(from_class_id);
        }
        return true;
      });

    if (!cleanedTargets.length) {
      return Swal.fire(
        "Warning",
        "To Class(es) cannot include the same From Class when session is same.",
        "warning"
      );
    }

    const fromSessionName =
      sessionById.get(String(from_session_id))?.name || from_session_id;
    const toSessionName =
      sessionById.get(String(to_session_id))?.name || to_session_id;
    const fromName =
      classById.get(String(from_class_id))?.class_name || "Selected";
    const toNames = cleanedTargets
      .map((id) => classById.get(String(id))?.class_name || id)
      .join(", ");

    setShowClassCopyModal(false);
    await sleep(150);

    const confirm = await Swal.fire({
      title: "Confirm FULL Class Schema Copy",
      html: `
        <div style="text-align:left">
          <div><b>From Session:</b> ${fromSessionName}</div>
          <div><b>From Class:</b> ${fromName}</div>
          <div><b>To Session:</b> ${toSessionName}</div>
          <div><b>To Class(es):</b> ${toNames}</div>
          <div style="margin-top:6px"><b>Overwrite:</b> ${
            overwrite ? "Yes (delete target first)" : "No (skip duplicates)"
          }</div>
          <hr/>
          <div style="font-size:13px;color:#666">
            This will copy <b>ALL subjects</b> (terms + components) schema from the selected class.
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Copy Full Class",
    });

    if (!confirm.isConfirmed) {
      setShowClassCopyModal(true);
      return;
    }

    try {
      Swal.fire({
        title: "Copying class schema...",
        text: "Please wait",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post("/exam-schemes/copy-class", {
        from_session_id: Number(from_session_id),
        from_class_id: Number(from_class_id),
        to_session_id: Number(to_session_id),
        to_class_ids: cleanedTargets.map(Number),
        overwrite: !!overwrite,
      });

      const created = res?.data?.created ?? 0;
      const per = res?.data?.per_target_created || {};

      const perLines = Object.entries(per)
        .map(([cid, cnt]) => {
          const nm = classById.get(String(cid))?.class_name || cid;
          return `${nm}: ${cnt}`;
        })
        .join("<br/>");

      await Swal.fire(
        "Success",
        `
          Class schema copy completed ✅<br/>
          <b>Total created:</b> ${created}<br/>
          ${
            perLines
              ? `<hr/><div style="text-align:left">${perLines}</div>`
              : ""
          }
        `,
        "success"
      );

      fetchSchemes();
    } catch (e) {
      const msg = e?.response?.data?.message || "Class copy failed.";
      Swal.fire("Error", msg, "error");
    }
  };

  const openTermCopyModal = () => {
    setTermCopyData({
      session_id: filters.session_id ? String(filters.session_id) : "",
      class_id: filters.class_id ? String(filters.class_id) : "",
      from_term_id: "",
      to_term_id: "",
      overwrite: false,
    });
    setShowTermCopyModal(true);
  };

  const closeTermCopyModal = () => setShowTermCopyModal(false);

  const handleTermCopySubmit = async () => {
    const { session_id, class_id, from_term_id, to_term_id, overwrite } =
      termCopyData;

    if (!session_id) {
      return Swal.fire("Warning", "Please select Session.", "warning");
    }
    if (!from_term_id) {
      return Swal.fire("Warning", "Please select From Term.", "warning");
    }
    if (!to_term_id) {
      return Swal.fire("Warning", "Please select To Term.", "warning");
    }
    if (String(from_term_id) === String(to_term_id)) {
      return Swal.fire(
        "Warning",
        "From Term and To Term must be different.",
        "warning"
      );
    }

    const sessionName = sessionById.get(String(session_id))?.name || session_id;
    const fromName = termById.get(String(from_term_id))?.name || "Selected";
    const toName = termById.get(String(to_term_id))?.name || "Selected";

    setShowTermCopyModal(false);
    await sleep(150);

    const confirm = await Swal.fire({
      title: "Confirm Term Schema Copy",
      html: `
        <div style="text-align:left">
          <div><b>Session:</b> ${sessionName}</div>
          <div><b>From Term:</b> ${fromName}</div>
          <div><b>To Term:</b> ${toName}</div>
          <div><b>Class:</b> ${
            class_id
              ? classById.get(String(class_id))?.class_name || class_id
              : "All Classes"
          }</div>
          <div><b>Overwrite:</b> ${
            overwrite ? "Yes (delete target first)" : "No (skip duplicates)"
          }</div>
          <hr/>
          <div style="font-size:13px;color:#666">
            This will copy <b>ALL subjects</b> schema from one term into another term.
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Copy Term",
    });

    if (!confirm.isConfirmed) {
      setShowTermCopyModal(true);
      return;
    }

    try {
      Swal.fire({
        title: "Copying term schema...",
        text: "Please wait",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post("/exam-schemes/copy-term", {
        session_id: Number(session_id),
        from_term_id: Number(from_term_id),
        to_term_id: Number(to_term_id),
        class_id: class_id ? Number(class_id) : null,
        overwrite: !!overwrite,
      });

      const created = res?.data?.created ?? 0;
      const per = res?.data?.per_class_created || {};

      const perLines = Object.entries(per)
        .map(([cid, cnt]) => {
          const nm = classById.get(String(cid))?.class_name || cid;
          return `${nm}: ${cnt}`;
        })
        .join("<br/>");

      await Swal.fire(
        "Success",
        `
          Term schema copy completed ✅<br/>
          <b>Total created:</b> ${created}<br/>
          ${
            perLines
              ? `<hr/><div style="text-align:left">${perLines}</div>`
              : ""
          }
        `,
        "success"
      );

      fetchSchemes();
    } catch (e) {
      const msg = e?.response?.data?.message || "Term copy failed.";
      Swal.fire("Error", msg, "error");
    }
  };

  const isFiltered = !!(
    filters.session_id ||
    filters.class_id ||
    filters.subject_id
  );

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <h2 className="m-0">📘 Exam Scheme Management</h2>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-primary" onClick={openClassCopyModal}>
            🏫 Copy Class Schema
          </Button>

          <Button variant="outline-warning" onClick={openTermCopyModal}>
            🗓️ Copy Term Schema
          </Button>

          <Button variant="outline-info" onClick={openCopyModal}>
            📚 Copy Subject Scheme
          </Button>

          <Button
            variant="outline-danger"
            onClick={handleDeleteAllSchemes}
            disabled={!isFiltered}
          >
            🧨 Delete Filtered Schemes
          </Button>

          <Button variant="success" onClick={() => openModal()}>
            ➕ Add Scheme
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="d-flex justify-content-between align-items-end mb-3 flex-wrap gap-2">
        <div className="d-flex gap-2 flex-wrap">
          <select
            name="session_id"
            value={filters.session_id}
            onChange={handleFilterChange}
            className="form-control"
          >
            <option value="">All Sessions</option>
            {sessions.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            name="class_id"
            value={filters.class_id}
            onChange={handleFilterChange}
            className="form-control"
          >
            <option value="">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
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
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>

          <Button variant="primary" onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>

        <div className="text-muted" style={{ fontSize: 13 }}>
          Tip: Grade/Marks type is controlled from the <b>Assessment Components</b> page.
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
              <table className="table table-bordered table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Session</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Term</th>
                    <th>Component</th>
                    <th style={{ width: 120 }}>Type</th>
                    <th>Max Marks</th>
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

                  {!schemes.length && (
                    <tr>
                      <td colSpan={11} className="text-center text-muted py-4">
                        No schemes found for selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Add/Edit/Duplicate Modal */}
      <Modal show={showModal} onHide={closeModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? "✏️ Edit Scheme" : "➕ Add / Duplicate Scheme"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label>Session</label>
              <select
                name="session_id"
                value={formData.session_id}
                onChange={handleChange}
                className="form-control"
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

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
                    {` (${c.component_type || "MARKS"}${
                      c.component_type === "MARKS" ? `, ${c.max_marks ?? 0} marks` : ""
                    })`}
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
              <small className="text-muted">
                Weightage is allowed even for grade-mode subjects.
              </small>
            </div>

            <div className="col-12">
              <div className="alert alert-light border mb-0 mt-2">
                <b>Tip:</b> To change a component between MARKS and GRADE, open the{" "}
                <b>Assessment Components</b> page and edit that component.
              </div>
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

      {/* Copy Subject Scheme Modal */}
      <Modal show={showCopyModal} onHide={closeCopyModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>📚 Copy Subject Scheme (Bulk)</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label>Session</label>
              <select
                className="form-control"
                value={copyData.session_id}
                onChange={(e) =>
                  setCopyData({ ...copyData, session_id: e.target.value })
                }
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

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
            </div>

            <div className="col-12 col-md-6">
              <label>From Subject</label>
              <select
                className="form-control"
                value={copyData.from_subject_id}
                onChange={(e) =>
                  setCopyData({
                    ...copyData,
                    from_subject_id: e.target.value,
                  })
                }
              >
                <option value="">Select</option>
                {subjects.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
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

      {/* Copy Full Class Schema Modal */}
      <Modal
        show={showClassCopyModal}
        onHide={closeClassCopyModal}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>🏫 Copy FULL Class Schema</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label>From Session</label>
              <select
                className="form-control"
                value={classCopyData.from_session_id}
                onChange={(e) =>
                  setClassCopyData({
                    ...classCopyData,
                    from_session_id: e.target.value,
                  })
                }
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label>From Class</label>
              <select
                className="form-control"
                value={classCopyData.from_class_id}
                onChange={(e) =>
                  setClassCopyData({
                    ...classCopyData,
                    from_class_id: e.target.value,
                  })
                }
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
              <label>To Session</label>
              <select
                className="form-control"
                value={classCopyData.to_session_id}
                onChange={(e) =>
                  setClassCopyData({
                    ...classCopyData,
                    to_session_id: e.target.value,
                  })
                }
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label>To Class(es)</label>
              <select
                multiple
                className="form-control"
                value={classCopyData.to_class_ids}
                onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions).map(
                    (o) => o.value
                  );
                  const cleaned = vals.filter((x) => {
                    if (
                      String(classCopyData.from_session_id) ===
                      String(classCopyData.to_session_id)
                    ) {
                      return x !== String(classCopyData.from_class_id);
                    }
                    return true;
                  });
                  setClassCopyData({ ...classCopyData, to_class_ids: cleaned });
                }}
                style={{ minHeight: 160 }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <div className="form-check mt-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={classCopyData.overwrite}
                  onChange={(e) =>
                    setClassCopyData({
                      ...classCopyData,
                      overwrite: e.target.checked,
                    })
                  }
                  id="overwriteClassChk"
                />
                <label className="form-check-label" htmlFor="overwriteClassChk">
                  Overwrite target class schemes (delete target first)
                </label>
              </div>
            </div>

            <div className="col-12">
              <div className="alert alert-info mb-0 mt-2">
                <b>What will be copied?</b> All subjects (term + component rows)
                of the selected class from one session to another session/class.
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeClassCopyModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleClassCopySubmit}>
            Copy Full Class
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Copy Full Term Schema Modal */}
      <Modal
        show={showTermCopyModal}
        onHide={closeTermCopyModal}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>🗓️ Copy FULL Term Schema</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label>Session</label>
              <select
                className="form-control"
                value={termCopyData.session_id}
                onChange={(e) =>
                  setTermCopyData({
                    ...termCopyData,
                    session_id: e.target.value,
                  })
                }
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label>Class (optional)</label>
              <select
                className="form-control"
                value={termCopyData.class_id}
                onChange={(e) =>
                  setTermCopyData({ ...termCopyData, class_id: e.target.value })
                }
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label>From Term</label>
              <select
                className="form-control"
                value={termCopyData.from_term_id}
                onChange={(e) =>
                  setTermCopyData({
                    ...termCopyData,
                    from_term_id: e.target.value,
                  })
                }
              >
                <option value="">Select</option>
                {terms.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label>To Term</label>
              <select
                className="form-control"
                value={termCopyData.to_term_id}
                onChange={(e) =>
                  setTermCopyData({
                    ...termCopyData,
                    to_term_id: e.target.value,
                  })
                }
              >
                <option value="">Select</option>
                {terms.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <div className="form-check mt-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={termCopyData.overwrite}
                  onChange={(e) =>
                    setTermCopyData({
                      ...termCopyData,
                      overwrite: e.target.checked,
                    })
                  }
                  id="overwriteTermChk"
                />
                <label className="form-check-label" htmlFor="overwriteTermChk">
                  Overwrite target term schemes (delete target first)
                </label>
              </div>
            </div>

            <div className="col-12">
              <div className="alert alert-warning mb-0 mt-2">
                <b>What will be copied?</b> ALL subjects (components + weightage)
                from one term to another term in the selected session.
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeTermCopyModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleTermCopySubmit}>
            Copy Term
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamSchemeManagement;