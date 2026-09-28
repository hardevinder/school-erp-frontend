import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Form, Button, Table, Modal, Row, Col, Badge, Card } from "react-bootstrap";
import SyllabusAiImportModal from "../components/syllabus/SyllabusAiImportModal";
import "./SyllabusBreakdownCRUD.css";

/* ---------------- Helpers ---------------- */

const termOptions = [
  { value: "FULL_YEAR", label: "Full Year" },
  { value: "TERM1", label: "Term 1" },
  { value: "TERM2", label: "Term 2" },
];

const statusBadge = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "DRAFT":
      return "secondary";
    case "SUBMITTED":
      return "warning";
    case "APPROVED":
      return "success";
    case "RETURNED":
      return "danger";
    default:
      return "dark";
  }
};

const safeStr = (v) => (v == null ? "" : String(v));
const safeArr = (v) => (Array.isArray(v) ? v : []);

function pickArrayFromApi(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.assignments)) return data.assignments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}

const toUpperStatus = (s) => String(s || "").trim().toUpperCase();

const growNotebookTextarea = (event) => {
  const el = event.currentTarget;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

/* ---------------- Component ---------------- */

const SyllabusBreakdownCRUD = () => {
  /* ---------------- State ---------------- */
  const [assignments, setAssignments] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // filters
  const [searchClassId, setSearchClassId] = useState("");
  const [searchSubjectId, setSearchSubjectId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchStatus, setSearchStatus] = useState("");

  // selection panel
  const [selected, setSelected] = useState(null);

  // quick workspace: class -> subject -> term (same spirit as Teacher Assignment)
  const [workspaceClassId, setWorkspaceClassId] = useState("");
  const [workspaceTerm, setWorkspaceTerm] = useState("FULL_YEAR");
  const [workspaceSubjectSearch, setWorkspaceSubjectSearch] = useState("");

  // modal
  const [showModal, setShowModal] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [pendingAiOpen, setPendingAiOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // form (snake_case for UI)
  const [formData, setFormData] = useState({
    academic_session: "",
    class_id: "",
    subject_id: "",
    term: "FULL_YEAR",
    book_ref: "",
    objectives: "",
    items: [],
  });

  /* ---------------- Normalize assignment shapes ---------------- */
  const normalizedAssignments = useMemo(() => {
    return safeArr(assignments).map((a) => {
      const ClassObj = a.class || a.Class || a.ClassObj || a.cls || a?.classObj || null;
      const SubjectObj = a.subject || a.Subject || a.SubjectObj || a?.subjectObj || null;

      const class_id = a.class_id ?? a.classId ?? ClassObj?.id ?? null;
      const subject_id = a.subject_id ?? a.subjectId ?? SubjectObj?.id ?? null;

      return { ...a, ClassObj, SubjectObj, class_id, subject_id };
    });
  }, [assignments]);

  /* ---------------- Derived: unique classes ---------------- */
  const classes = useMemo(() => {
    const map = new Map();
    normalizedAssignments.forEach((a) => {
      const c = a.ClassObj;
      if (c?.id && !map.has(String(c.id))) map.set(String(c.id), c);
    });
    return Array.from(map.values());
  }, [normalizedAssignments]);

  const workspaceSubjects = useMemo(() => {
    if (!workspaceClassId) return [];
    const map = new Map();
    normalizedAssignments.forEach((a) => {
      if (String(a.class_id) !== String(workspaceClassId)) return;
      const subject = a.SubjectObj;
      if (subject?.id && !map.has(String(subject.id))) map.set(String(subject.id), subject);
    });

    const query = workspaceSubjectSearch.trim().toLowerCase();
    return Array.from(map.values())
      .filter((subject) => !query || String(subject.name || "").toLowerCase().includes(query))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" }));
  }, [normalizedAssignments, workspaceClassId, workspaceSubjectSearch]);

  useEffect(() => {
    if (!classes.length) return;
    if (!workspaceClassId || !classes.some((c) => String(c.id) === String(workspaceClassId))) {
      setWorkspaceClassId(String(classes[0].id));
    }
  }, [classes, workspaceClassId]);

  /* ---------------- Subjects for selected class ---------------- */
  const subjectsForSelectedClass = useMemo(() => {
    if (!formData.class_id) return [];
    const map = new Map();
    normalizedAssignments.forEach((a) => {
      if (String(a.class_id) !== String(formData.class_id)) return;
      const s = a.SubjectObj;
      if (s?.id && !map.has(String(s.id))) map.set(String(s.id), s);
    });
    return Array.from(map.values());
  }, [normalizedAssignments, formData.class_id]);

  /* ---------------- Filter subjects ---------------- */
  const subjectsForFilterClass = useMemo(() => {
    const map = new Map();
    normalizedAssignments.forEach((a) => {
      if (searchClassId && String(a.class_id) !== String(searchClassId)) return;
      const s = a.SubjectObj;
      if (s?.id && !map.has(String(s.id))) map.set(String(s.id), s);
    });
    return Array.from(map.values());
  }, [normalizedAssignments, searchClassId]);

  /* ---------------- Filtered breakdowns ---------------- */
  const filteredBreakdowns = useMemo(() => {
    return safeArr(breakdowns).filter((b) => {
      const classId = b.class_id || b.classId || b.Class?.id;
      const subjectId = b.subject_id || b.subjectId || b.Subject?.id;

      const okClass = searchClassId ? String(classId) === String(searchClassId) : true;
      const okSubject = searchSubjectId ? String(subjectId) === String(searchSubjectId) : true;
      const okTerm = searchTerm ? String(b.term) === String(searchTerm) : true;

      const bStatus = toUpperStatus(b.status);
      const okStatus = searchStatus ? bStatus === toUpperStatus(searchStatus) : true;

      return okClass && okSubject && okTerm && okStatus;
    });
  }, [breakdowns, searchClassId, searchSubjectId, searchTerm, searchStatus]);

  /* ---------------- API Calls ---------------- */

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const res = await api.get("/class-subject-syllabus-teachers/teacher/syllabus-assignments");
      setAssignments(pickArrayFromApi(res.data));
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch assigned class-subjects", "error");
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchMyBreakdowns = async () => {
    setLoading(true);
    try {
      const res = await api.get("/syllabus-breakdowns/my");
      setBreakdowns(pickArrayFromApi(res.data));
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch syllabus breakdowns", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ fetch single breakdown with full fields (includes returnReason)
  const fetchOne = async (id) => {
    const res = await api.get(`/syllabus-breakdowns/${id}`);
    return res.data?.data || res.data;
  };

  // ✅ View = fetch full, then setSelected (so returnReason is available)
  const handleView = async (b) => {
    try {
      if (!b?.id) return;
      const full = await fetchOne(b.id);
      setSelected(full);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to load breakdown details", "error");
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchMyBreakdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Form Helpers ---------------- */

  const resetForm = () => {
    setFormData({
      academic_session: "",
      class_id: "",
      subject_id: "",
      term: "FULL_YEAR",
      book_ref: "",
      objectives: "",
      items: [],
    });
    setEditing(false);
    setEditId(null);
  };

  const addItemRow = () => {
    const nextSeq = (formData.items?.length || 0) + 1;
    setFormData((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          seq_no: nextSeq,
          unit_no: "",
          unit_title: "",
          topics: "",
          subtopics: "",
          periods: "",
          planned_from: "",
          planned_to: "",
          planned_month: "",
          remarks: "",
        },
      ],
    }));
  };

  const removeItemRow = (idx) => {
    const items = [...(formData.items || [])];
    items.splice(idx, 1);
    const resequenced = items.map((it, i) => ({ ...it, seq_no: i + 1 }));
    setFormData((prev) => ({ ...prev, items: resequenced }));
  };

  const updateItem = (idx, key, value) => {
    const items = [...(formData.items || [])];
    items[idx] = { ...items[idx], [key]: value };
    setFormData((prev) => ({ ...prev, items }));
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;

    if (name === "class_id") {
      const nextClassId = value;
      const allowedSubjects = normalizedAssignments
        .filter((a) => String(a.class_id) === String(nextClassId))
        .map((a) => a.SubjectObj)
        .filter((s) => s?.id);

      const unique = new Map();
      allowedSubjects.forEach((s) => unique.set(String(s.id), s));
      const subjectList = Array.from(unique.values());

      setFormData((prev) => ({
        ...prev,
        class_id: nextClassId,
        subject_id: subjectList.length === 1 ? String(subjectList[0].id) : "",
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    resetForm();

    if (selected?.class_id && selected?.subject_id) {
      setFormData((prev) => ({
        ...prev,
        class_id: String(selected.class_id),
        subject_id: String(selected.subject_id),
      }));
    }

    setTimeout(() => {
      setFormData((prev) => {
        if (prev.items?.length) return prev;
        return {
          ...prev,
          items: [
            {
              seq_no: 1,
              unit_no: "",
              unit_title: "",
              topics: "",
              subtopics: "",
              periods: "",
              planned_from: "",
              planned_to: "",
              planned_month: "",
              remarks: "",
            },
          ],
        };
      });
    }, 0);

    setShowModal(true);
  };

  const openAiImport = () => {
    if (!formData.class_id || !formData.subject_id) {
      return Swal.fire(
        "Select Class & Subject",
        "Please select the assigned Class and Subject first, then upload the syllabus.",
        "info"
      );
    }
    // Never stack two Bootstrap-style modals. Close the syllabus form first;
    // onExited opens the AI importer after the parent has fully left the DOM.
    setPendingAiOpen(true);
    setShowModal(false);
  };

  const closeAiImport = () => {
    setShowAiImport(false);
    setShowModal(true);
  };

  const handleUseAiDraft = async (draft) => {
    const currentHasContent = (formData.items || []).some((it) =>
      [it.unit_no, it.unit_title, it.topics, it.subtopics, it.periods, it.planned_month, it.remarks]
        .some((value) => String(value ?? "").trim())
    );

    if (currentHasContent) {
      const confirm = await Swal.fire({
        title: "Replace current unit rows?",
        text: "The AI draft will replace the unit/chapter rows currently in this form. Class, Subject, Session and Term will stay unchanged.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Use AI draft",
        customClass: { container: "sb-ai-swal" },
      });
      if (!confirm.isConfirmed) return;
    }

    const items = safeArr(draft?.units).map((it, idx) => ({
      seq_no: idx + 1,
      unit_no: safeStr(it.unit_no),
      unit_title: safeStr(it.unit_title),
      topics: safeStr(it.topics),
      subtopics: safeStr(it.subtopics),
      periods: it.periods ?? "",
      planned_from: "",
      planned_to: "",
      planned_month: safeStr(it.planned_month),
      remarks: safeStr(it.remarks),
    }));

    setFormData((prev) => ({
      ...prev,
      book_ref: safeStr(draft?.book_reference) || prev.book_ref,
      objectives: safeStr(draft?.objectives) || prev.objectives,
      items: items.length ? items : prev.items,
    }));
    setShowAiImport(false);
    setShowModal(true);

    await Swal.fire({
      icon: "success",
      title: "AI draft added",
      text: `${items.length} unit/chapter row${items.length === 1 ? "" : "s"} added to the form. Please review them, then click Save.`,
      timer: 2200,
      showConfirmButton: false,
    });
  };

  const openEditModal = async (row) => {
    try {
      setEditing(true);
      setEditId(row.id);

      const res = await api.get(`/syllabus-breakdowns/${row.id}`);
      const b = res.data?.data || res.data;

      // ✅ backend may return Items[] with camelCase keys
      const rawItems = b.Items || b.items || b.SyllabusBreakdownItems || b.syllabus_breakdown_items || [];

      const items = safeArr(rawItems).map((it, idx) => ({
        id: it.id,
        seq_no: it.seq_no ?? it.sequence ?? idx + 1,
        unit_no: safeStr(it.unit_no ?? it.unitNumber),
        unit_title: safeStr(it.unit_title ?? it.unitTitle),
        topics: safeStr(it.topics),
        subtopics: safeStr(it.subtopics),
        periods: it.periods ?? "",
        planned_from: it.planned_from
          ? String(it.planned_from).slice(0, 10)
          : it.plannedFrom
          ? String(it.plannedFrom).slice(0, 10)
          : "",
        planned_to: it.planned_to
          ? String(it.planned_to).slice(0, 10)
          : it.plannedTo
          ? String(it.plannedTo).slice(0, 10)
          : "",
        planned_month: safeStr(it.planned_month ?? it.plannedMonth),
        remarks: safeStr(it.remarks),
      }));

      setFormData({
        academic_session: safeStr(b.academic_session ?? b.academicSession),
        class_id: String(b.class_id ?? b.classId ?? ""),
        subject_id: String(b.subject_id ?? b.subjectId ?? ""),
        term: b.term || "FULL_YEAR",
        book_ref: safeStr(b.book_ref ?? b.bookReference),
        objectives: safeStr(b.objectives),
        items: items.length ? items : [],
      });

      if (!items.length) addItemRow();
      setShowModal(true);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load breakdown details", "error");
    }
  };

  /* ---------------- Submit / Save ---------------- */

  const validateForm = () => {
    if (!formData.class_id) return "Please select Class";
    if (!formData.subject_id) return "Please select Subject";
    if (!formData.term) return "Please select Term";

    const allowed = normalizedAssignments.some(
      (a) => String(a.class_id) === String(formData.class_id) && String(a.subject_id) === String(formData.subject_id)
    );
    if (!allowed) return "This Class/Subject is not assigned to you. Please select only assigned subjects.";

    if (!formData.items || formData.items.length === 0) return "Please add at least 1 unit row";
    const hasEmptyTitle = formData.items.some((it) => !String(it.unit_title || "").trim());
    if (hasEmptyTitle) return "Unit Title is required in all rows";
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errMsg = validateForm();
    if (errMsg) return Swal.fire("Error", errMsg, "error");

    try {
      // ✅ SEND CAMELCASE FOR BACKEND CONTROLLER
      const payload = {
        classId: Number(formData.class_id),
        subjectId: Number(formData.subject_id),
        academicSession: safeStr(formData.academic_session) || null,
        term: formData.term || "FULL_YEAR",
        bookReference: safeStr(formData.book_ref) || null,
        objectives: safeStr(formData.objectives) || null,
        items: (formData.items || []).map((it, idx) => ({
          id: it.id,
          sequence: idx + 1,
          unitNumber: it.unit_no || null,
          unitTitle: it.unit_title,
          topics: it.topics || null,
          subtopics: it.subtopics || null,
          periods: it.periods === "" ? null : Number(it.periods),
          plannedFrom: it.planned_from || null,
          plannedTo: it.planned_to || null,
          plannedMonth: it.planned_month || null,
          remarks: it.remarks || null,
        })),
      };

      await api.post("/syllabus-breakdowns", payload);

      Swal.fire("Success", editing ? "Breakdown updated" : "Breakdown created", "success");
      setShowModal(false);
      resetForm();
      fetchMyBreakdowns();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to save breakdown", "error");
    }
  };

  const handleSubmitForApproval = async (id) => {
    const ok = await Swal.fire({
      title: "Submit for Approval?",
      text: "After submission, you should not edit unless returned.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Submit",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.post(`/syllabus-breakdowns/${id}/submit`);
      Swal.fire("Submitted", "Breakdown submitted successfully", "success");
      fetchMyBreakdowns();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Submit failed", "error");
    }
  };

  const handleDownloadPdf = async (id) => {
    try {
      const res = await api.get(`/syllabus-breakdowns/${id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `syllabus_breakdown_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to download PDF", "error");
    }
  };

  /* ---------------- UI helpers ---------------- */

  const getClassName = (b) => {
    const id = b.class_id ?? b.classId ?? b.Class?.id;
    return b.Class?.class_name || b.class_name || classes.find((c) => String(c.id) === String(id))?.class_name || "—";
  };

  const getSubjectName = (b) => {
    const id = b.subject_id ?? b.subjectId ?? b.Subject?.id;

    const allSubjects = (() => {
      const map = new Map();
      normalizedAssignments.forEach((a) => {
        const s = a.SubjectObj;
        if (s?.id) map.set(String(s.id), s);
      });
      return Array.from(map.values());
    })();

    return (
      b.Subject?.subject_name ||
      b.Subject?.name ||
      b.subject_name ||
      allSubjects.find((s) => String(s.id) === String(id))?.name ||
      "—"
    );
  };

  const isLocked = (status) => {
    const s = toUpperStatus(status);
    return s === "SUBMITTED" || s === "APPROVED";
  };

  const findWorkspaceBreakdown = (subjectId) =>
    safeArr(breakdowns).find((b) => {
      const classId = b.class_id ?? b.classId ?? b.Class?.id;
      const subject = b.subject_id ?? b.subjectId ?? b.Subject?.id;
      return (
        String(classId) === String(workspaceClassId) &&
        String(subject) === String(subjectId) &&
        String(b.term || "FULL_YEAR") === String(workspaceTerm)
      );
    }) || null;

  const workspaceStatusCount = useMemo(() => {
    const result = { total: 0, started: 0, approved: 0 };
    const subjectIds = new Set(workspaceSubjects.map((s) => String(s.id)));
    result.total = subjectIds.size;
    safeArr(breakdowns).forEach((b) => {
      const classId = b.class_id ?? b.classId ?? b.Class?.id;
      const subjectId = b.subject_id ?? b.subjectId ?? b.Subject?.id;
      if (String(classId) !== String(workspaceClassId)) return;
      if (!subjectIds.has(String(subjectId))) return;
      if (String(b.term || "FULL_YEAR") !== String(workspaceTerm)) return;
      result.started += 1;
      if (toUpperStatus(b.status) === "APPROVED") result.approved += 1;
    });
    return result;
  }, [breakdowns, workspaceClassId, workspaceSubjects, workspaceTerm]);

  const openWorkspaceSubject = async (subjectId) => {
    const existing = findWorkspaceBreakdown(subjectId);

    if (existing) {
      if (isLocked(existing.status)) {
        await handleView(existing);
        setTimeout(() => document.getElementById("sb-details-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        return;
      }
      await openEditModal(existing);
      return;
    }

    setEditing(false);
    setEditId(null);
    setFormData({
      academic_session: "",
      class_id: String(workspaceClassId),
      subject_id: String(subjectId),
      term: workspaceTerm,
      book_ref: "",
      objectives: "",
      items: [
        {
          seq_no: 1,
          unit_no: "",
          unit_title: "",
          topics: "",
          subtopics: "",
          periods: "",
          planned_from: "",
          planned_to: "",
          planned_month: "",
          remarks: "",
        },
      ],
    });
    setShowModal(true);
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="container-fluid py-3 syllabus-breakdown-page">
      <div className="sb-wrap">
        <section className="sb-workspace-hero">
          <div>
            <div className="sb-workspace-eyebrow">ACADEMIC WORKSPACE</div>
            <h3 className="mb-1">Syllabus Breakdown</h3>
            <p className="mb-0">Pick an assigned class and subject, then start or continue the breakup. No repeated dropdown selection.</p>
          </div>
          <div className="sb-workspace-summary">
            <div><strong>{workspaceStatusCount.started}</strong><span>Started</span></div>
            <div><strong>{workspaceStatusCount.approved}</strong><span>Approved</span></div>
            <div><strong>{workspaceStatusCount.total}</strong><span>Subjects</span></div>
          </div>
        </section>

        {loadingAssignments && (
          <div className="sb-loading-line">
            <span className="spinner-border spinner-border-sm" /> Loading assigned classes and subjects…
          </div>
        )}

        <section className="sb-workspace-card mt-3">
          <div className="sb-step-head">
            <span className="sb-step-number">1</span>
            <div><strong>Select Class</strong><small>Only classes assigned to you are shown.</small></div>
          </div>
          <div className="sb-class-strip">
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`sb-choice-pill ${String(workspaceClassId) === String(c.id) ? "active" : ""}`}
                onClick={() => {
                  setWorkspaceClassId(String(c.id));
                  setWorkspaceSubjectSearch("");
                }}
              >
                {c.class_name}
              </button>
            ))}
            {!loadingAssignments && classes.length === 0 && (
              <div className="sb-empty-note">No syllabus classes are assigned to you yet.</div>
            )}
          </div>
        </section>

        <section className="sb-workspace-card mt-3">
          <div className="sb-step-row">
            <div className="sb-step-head">
              <span className="sb-step-number">2</span>
              <div><strong>Choose Term & Subject</strong><small>Click a subject card to create, continue or view its breakdown.</small></div>
            </div>
            <div className="sb-term-switch">
              {termOptions.map((term) => (
                <button
                  key={term.value}
                  type="button"
                  className={workspaceTerm === term.value ? "active" : ""}
                  onClick={() => setWorkspaceTerm(term.value)}
                >
                  {term.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sb-subject-tools">
            <div className="sb-search-box">
              <i className="bi bi-search" />
              <input
                value={workspaceSubjectSearch}
                onChange={(e) => setWorkspaceSubjectSearch(e.target.value)}
                placeholder="Search subject…"
              />
            </div>
            <span>{workspaceSubjects.length} subject{workspaceSubjects.length === 1 ? "" : "s"}</span>
          </div>

          <div className="sb-subject-grid">
            {workspaceSubjects.map((subject) => {
              const existing = findWorkspaceBreakdown(subject.id);
              const status = existing ? toUpperStatus(existing.status) : "NOT STARTED";
              const locked = existing ? isLocked(existing.status) : false;
              return (
                <button
                  type="button"
                  key={subject.id}
                  className={`sb-subject-card ${existing ? "has-breakdown" : ""} ${status.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => openWorkspaceSubject(subject.id)}
                >
                  <span className="sb-subject-icon"><i className="bi bi-journal-text" /></span>
                  <span className="sb-subject-copy">
                    <strong>{subject.name}</strong>
                    <small>{existing ? (locked ? "Click to view details" : "Click to continue editing") : "Click to start breakdown"}</small>
                  </span>
                  <span className={`sb-status-chip ${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
                  <i className={`bi ${locked ? "bi-eye" : existing ? "bi-pencil-square" : "bi-plus-circle"} sb-card-action-icon`} />
                </button>
              );
            })}
            {!loadingAssignments && workspaceClassId && workspaceSubjects.length === 0 && (
              <div className="sb-empty-note sb-grid-empty">No assigned subjects found for this class.</div>
            )}
          </div>
        </section>

        <details className="sb-record-tools mt-3">
          <summary>All Breakdown Records & Filters</summary>
          <Card className="mt-2 shadow-sm sb-filter-card">
            <Card.Body>
              <Row className="g-2">
                <Col xs={12} sm={6} lg={3}>
                  <Form.Label className="small text-muted mb-1">Class</Form.Label>
                  <Form.Select value={searchClassId} onChange={(e) => { setSearchClassId(e.target.value); setSearchSubjectId(""); }}>
                    <option value="">All</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.class_name}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Form.Label className="small text-muted mb-1">Subject</Form.Label>
                  <Form.Select value={searchSubjectId} onChange={(e) => setSearchSubjectId(e.target.value)} disabled={!!searchClassId && subjectsForFilterClass.length === 0}>
                    <option value="">All</option>
                    {subjectsForFilterClass.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Form.Label className="small text-muted mb-1">Term</Form.Label>
                  <Form.Select value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}>
                    <option value="">All</option>
                    {termOptions.map((term) => <option key={term.value} value={term.value}>{term.label}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={12} sm={6} lg={3}>
                  <Form.Label className="small text-muted mb-1">Status</Form.Label>
                  <Form.Select value={searchStatus} onChange={(e) => setSearchStatus(e.target.value)}>
                    <option value="">All</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="SUBMITTED">SUBMITTED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="RETURNED">RETURNED</option>
                  </Form.Select>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </details>

        <Row className="mt-3 g-3">
          {/* Left: List */}
          <Col xs={12} lg={8}>
            <Card className="shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">My Breakdowns</div>
                <div className="small text-muted">{loading ? "Loading..." : `${filteredBreakdowns.length} items`}</div>
              </Card.Header>

              {/* Desktop table */}
              <div className="d-none d-lg-block table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Term</th>
                      <th>Status</th>
                      <th style={{ width: 280 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBreakdowns.map((b) => (
                      <tr key={b.id}>
                        <td>{b.id}</td>
                        <td>{getClassName(b)}</td>
                        <td>{getSubjectName(b)}</td>
                        <td>{termOptions.find((t) => t.value === b.term)?.label || b.term}</td>
                        <td>
                          <Badge bg={statusBadge(toUpperStatus(b.status))}>{toUpperStatus(b.status)}</Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline-info" onClick={() => handleView(b)}>
                              View
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openEditModal(b)}
                              disabled={isLocked(b.status)}
                            >
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => handleSubmitForApproval(b.id)}
                              disabled={toUpperStatus(b.status) !== "DRAFT" && toUpperStatus(b.status) !== "RETURNED"}
                            >
                              Submit
                            </Button>

                            <Button size="sm" variant="success" onClick={() => handleDownloadPdf(b.id)}>
                              PDF
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!loading && filteredBreakdowns.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No breakdowns found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="d-lg-none">
                <Card.Body className="d-flex flex-column gap-2">
                  {filteredBreakdowns.map((b) => (
                    <Card
                      key={b.id}
                      className={`shadow-sm ${selected?.id === b.id ? "border-primary" : ""}`}
                      role="button"
                      onClick={() => handleView(b)}
                    >
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">
                              #{b.id} • {getClassName(b)}
                            </div>
                            <div className="text-muted small">{getSubjectName(b)}</div>
                            <div className="small mt-1">
                              <span className="text-muted">Term: </span>
                              {termOptions.find((t) => t.value === b.term)?.label || b.term}
                            </div>
                          </div>
                          <Badge bg={statusBadge(toUpperStatus(b.status))}>{toUpperStatus(b.status)}</Badge>
                        </div>

                        <div className="d-flex gap-2 flex-wrap mt-3">
                          <Button
                            size="sm"
                            variant="outline-info"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(b);
                            }}
                          >
                            View
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(b);
                            }}
                            disabled={isLocked(b.status)}
                          >
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubmitForApproval(b.id);
                            }}
                            disabled={toUpperStatus(b.status) !== "DRAFT" && toUpperStatus(b.status) !== "RETURNED"}
                          >
                            Submit
                          </Button>

                          <Button
                            size="sm"
                            variant="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(b.id);
                            }}
                          >
                            PDF
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}

                  {!loading && filteredBreakdowns.length === 0 && (
                    <div className="text-center text-muted py-4">No breakdowns found.</div>
                  )}
                </Card.Body>
              </div>
            </Card>
          </Col>

          {/* Right: Detail Panel */}
          <Col xs={12} lg={4} id="sb-details-panel">
            <Card className="shadow-sm sb-details-card">
              <Card.Header className="fw-semibold">Details</Card.Header>
              <Card.Body>
                {selected ? (
                  <>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="fw-semibold">Breakdown #{selected.id}</div>
                      <Badge bg={statusBadge(toUpperStatus(selected.status))}>{toUpperStatus(selected.status)}</Badge>
                    </div>

                    <hr />

                    <div className="mb-2">
                      <div className="small text-muted">Class</div>
                      <div className="fw-semibold">{getClassName(selected)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Subject</div>
                      <div className="fw-semibold">{getSubjectName(selected)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Term</div>
                      <div>{termOptions.find((t) => t.value === selected.term)?.label || selected.term}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Academic Session</div>
                      <div>{selected.academic_session || selected.academicSession || "—"}</div>
                    </div>

                    {/* ✅ SHOW RETURN REASON TO TEACHER */}
                    {toUpperStatus(selected.status) === "RETURNED" && (
                      <div className="mt-3 p-2 border rounded bg-light">
                        <div className="small text-muted mb-1">Return Reason (Coordinator)</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {selected.returnReason || selected.return_reason || "—"}
                        </div>
                      </div>
                    )}

                    <div className="d-grid gap-2 mt-3">
                      <Button variant="success" onClick={() => handleDownloadPdf(selected.id)}>
                        Download PDF
                      </Button>

                      <Button
                        variant="warning"
                        onClick={() => handleSubmitForApproval(selected.id)}
                        disabled={
                          toUpperStatus(selected.status) !== "DRAFT" &&
                          toUpperStatus(selected.status) !== "RETURNED"
                        }
                      >
                        Submit for Approval
                      </Button>

                      <Button variant="outline-primary" onClick={() => openEditModal(selected)} disabled={isLocked(selected.status)}>
                        Edit
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-muted">Select an item to view details.</div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Modal: Create/Edit - Notebook editor */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          onExited={() => {
            if (pendingAiOpen) {
              setPendingAiOpen(false);
              setShowAiImport(true);
            }
          }}
          size="xl"
          centered
          fullscreen="sm-down"
          dialogClassName="modal-fullscreen-sm-down syllabus-breakdown-modal-dialog sb-notebook-modal-dialog"
          contentClassName="syllabus-breakdown-modal-content sb-notebook-modal-content"
        >
          <Modal.Header closeButton className="sb-notebook-modal-header">
            <div>
              <div className="sb-notebook-kicker">TEACHER SYLLABUS NOTEBOOK</div>
              <Modal.Title>{editing ? "Edit Syllabus Breakdown" : "Create Syllabus Breakdown"}</Modal.Title>
              <div className="sb-notebook-modal-subtitle">
                Write naturally like a notebook. Long text expands while you type.
              </div>
            </div>
          </Modal.Header>

          <Modal.Body className="syllabus-breakdown-modal-body sb-notebook-modal-body">
            <Form onSubmit={handleSave}>
              <div className="sb-notebook-paper">
                <div className="sb-notebook-margin-line" />

                <div className="sb-notebook-header-grid">
                  <label className="sb-notebook-inline-field">
                    <span>Academic Session</span>
                    <input
                      name="academic_session"
                      value={formData.academic_session}
                      onChange={handleHeaderChange}
                      placeholder="2025-26"
                    />
                  </label>

                  <label className="sb-notebook-inline-field">
                    <span>Class</span>
                    <select
                      name="class_id"
                      value={formData.class_id}
                      onChange={handleHeaderChange}
                      required
                    >
                      <option value="">Select class</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.class_name}
                        </option>
                      ))}
                    </select>
                    <small>Assigned classes only</small>
                  </label>

                  <label className="sb-notebook-inline-field">
                    <span>Subject</span>
                    <select
                      name="subject_id"
                      value={formData.subject_id}
                      onChange={handleHeaderChange}
                      required
                      disabled={!formData.class_id}
                    >
                      <option value="">
                        {!formData.class_id ? "Select class first" : "Select subject"}
                      </option>
                      {subjectsForSelectedClass.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <small>Filtered by selected class</small>
                  </label>

                  <label className="sb-notebook-inline-field">
                    <span>Term</span>
                    <select name="term" value={formData.term} onChange={handleHeaderChange}>
                      {termOptions.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="sb-notebook-ai-strip">
                  <div className="sb-notebook-ai-copy">
                    <div className="sb-notebook-ai-icon"><i className="bi bi-stars" /></div>
                    <div>
                      <strong>Have a PDF, scan or handwritten syllabus?</strong>
                      <span>Let AI prepare the first draft, then continue editing here like a notebook.</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={openAiImport}
                    disabled={!formData.class_id || !formData.subject_id}
                    className="text-nowrap"
                  >
                    <i className="bi bi-cloud-arrow-up me-2" />
                    AI Import
                  </Button>
                </div>

                <div className="sb-notebook-overview">
                  <label className="sb-notebook-writing-block sb-notebook-book-ref">
                    <span className="sb-notebook-section-label">Book / Reference</span>
                    <input
                      name="book_ref"
                      value={formData.book_ref}
                      onChange={handleHeaderChange}
                      placeholder="Write book name, publisher, edition or reference..."
                    />
                  </label>

                  <label className="sb-notebook-writing-block">
                    <span className="sb-notebook-section-label">Overall Objectives</span>
                    <textarea
                      name="objectives"
                      value={formData.objectives}
                      onChange={handleHeaderChange}
                      placeholder="Write the overall learning objectives here..."
                      rows={3}
                      className="sb-auto-grow"
                      onInput={growNotebookTextarea}
                      onFocus={growNotebookTextarea}
                    />
                  </label>
                </div>

                <div className="sb-notebook-chapters-head">
                  <div>
                    <div className="sb-notebook-section-label">Units / Chapters</div>
                    <div className="sb-notebook-help">
                      Keep writing continuously. Topics and subtopics expand automatically.
                    </div>
                  </div>
                  <Button
                    variant="outline-primary"
                    onClick={addItemRow}
                    type="button"
                    className="sb-notebook-add-btn"
                  >
                    <i className="bi bi-plus-lg me-1" />
                    Add Chapter
                  </Button>
                </div>

                <div className="sb-notebook-units">
                  {(formData.items || []).map((it, idx) => (
                    <section className="sb-notebook-unit" key={idx}>
                      <div className="sb-notebook-unit-number">{idx + 1}</div>

                      <div className="sb-notebook-unit-content">
                        <div className="sb-notebook-unit-title-row">
                          <label className="sb-notebook-unit-no">
                            <span>Unit</span>
                            <input
                              value={it.unit_no}
                              onChange={(e) => updateItem(idx, "unit_no", e.target.value)}
                              placeholder={`${idx + 1}`}
                            />
                          </label>

                          <label className="sb-notebook-unit-title">
                            <span>Chapter / Unit Title *</span>
                            <textarea
                              rows={1}
                              value={it.unit_title}
                              onChange={(e) => updateItem(idx, "unit_title", e.target.value)}
                              placeholder="Write chapter or unit title..."
                              required
                              className="sb-auto-grow"
                              onInput={growNotebookTextarea}
                              onFocus={growNotebookTextarea}
                            />
                          </label>

                          <button
                            className="sb-notebook-remove"
                            onClick={() => removeItemRow(idx)}
                            disabled={(formData.items || []).length === 1}
                            type="button"
                            title="Remove chapter"
                            aria-label={`Remove chapter ${idx + 1}`}
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>

                        <label className="sb-notebook-writing-block">
                          <span className="sb-notebook-section-label">Topics</span>
                          <textarea
                            rows={3}
                            value={it.topics}
                            onChange={(e) => updateItem(idx, "topics", e.target.value)}
                            placeholder="Write topics covered in this chapter..."
                            className="sb-auto-grow"
                            onInput={growNotebookTextarea}
                            onFocus={growNotebookTextarea}
                          />
                        </label>

                        <label className="sb-notebook-writing-block">
                          <span className="sb-notebook-section-label">Subtopics / Teaching Points</span>
                          <textarea
                            rows={3}
                            value={it.subtopics}
                            onChange={(e) => updateItem(idx, "subtopics", e.target.value)}
                            placeholder="Write subtopics, teaching points or sequence..."
                            className="sb-auto-grow"
                            onInput={growNotebookTextarea}
                            onFocus={growNotebookTextarea}
                          />
                        </label>

                        <div className="sb-notebook-plan-strip">
                          <label>
                            <span>Periods</span>
                            <input
                              type="number"
                              value={it.periods}
                              onChange={(e) => updateItem(idx, "periods", e.target.value)}
                              placeholder="8"
                            />
                          </label>

                          <label>
                            <span>Planned From</span>
                            <input
                              type="date"
                              value={it.planned_from}
                              onChange={(e) => updateItem(idx, "planned_from", e.target.value)}
                            />
                          </label>

                          <label>
                            <span>Planned To</span>
                            <input
                              type="date"
                              value={it.planned_to}
                              onChange={(e) => updateItem(idx, "planned_to", e.target.value)}
                            />
                          </label>

                          <label>
                            <span>Month</span>
                            <input
                              value={it.planned_month}
                              maxLength={20}
                              onChange={(e) =>
                                updateItem(idx, "planned_month", e.target.value.slice(0, 20))
                              }
                              placeholder="April / Q1"
                            />
                          </label>
                        </div>

                        <label className="sb-notebook-writing-block sb-notebook-remarks">
                          <span className="sb-notebook-section-label">Teacher Notes / Remarks</span>
                          <textarea
                            rows={2}
                            value={it.remarks}
                            onChange={(e) => updateItem(idx, "remarks", e.target.value)}
                            placeholder="Optional notes, resources, activities or reminders..."
                            className="sb-auto-grow"
                            onInput={growNotebookTextarea}
                            onFocus={growNotebookTextarea}
                          />
                        </label>
                      </div>
                    </section>
                  ))}

                  {(formData.items || []).length === 0 && (
                    <div className="sb-notebook-empty">
                      No chapter added yet.
                      <Button variant="link" type="button" onClick={addItemRow}>
                        Add your first chapter
                      </Button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="sb-notebook-add-page"
                  onClick={addItemRow}
                >
                  <i className="bi bi-plus-circle me-2" />
                  Continue with another chapter
                </button>
              </div>

              <div className="sb-sticky-actions sb-notebook-actions">
                <div className="sb-notebook-action-note">
                  <i className="bi bi-journal-check" />
                  <span>Your writing stays visible while you type.</span>
                </div>
                <div className="d-flex gap-2">
                  <Button variant="secondary" onClick={() => setShowModal(false)} type="button">
                    Close
                  </Button>
                  <Button variant="primary" type="submit">
                    {editing ? "Update Draft" : "Save Draft"}
                  </Button>
                </div>
              </div>
            </Form>
          </Modal.Body>
        </Modal>

        {showAiImport && (
          <SyllabusAiImportModal
            context={{
              classId: formData.class_id,
              className: classes.find((c) => String(c.id) === String(formData.class_id))?.class_name || "",
              subjectId: formData.subject_id,
              subjectName: subjectsForSelectedClass.find((s) => String(s.id) === String(formData.subject_id))?.name || "",
              academicSession: formData.academic_session,
              term: formData.term,
            }}
            onClose={closeAiImport}
            onUseDraft={handleUseAiDraft}
          />
        )}
      </div>
    </div>
  );
};

export default SyllabusBreakdownCRUD;
