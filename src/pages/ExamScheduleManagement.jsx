// src/pages/ExamScheduleManagement.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button, Form } from "react-bootstrap";

const ExamScheduleManagement = () => {
  const [schedules, setSchedules] = useState([]);
  const [draftRows, setDraftRows] = useState([]);
  const [dirtyIds, setDirtyIds] = useState(new Set());
  const [publishing, setPublishing] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms] = useState([]);

  const [filters, setFilters] = useState({
    session_id: "",
    term_id: "",
    exam_id: "",
    class_id: "",
    section_id: "",
  });

  const [formData, setFormData] = useState({
    id: null,
    session_id: "",
    term_id: "",
    exam_id: "",
    class_id: "",
    section_id: "",
    subject_id: "",
    exam_date: "",
    start_time: "",
    end_time: "",
  });

  const [showModal, setShowModal] = useState(false);
  const [copySourceClassId, setCopySourceClassId] = useState(null);
  const [showClassCopyModal, setShowClassCopyModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSubjectSearch, setBulkSubjectSearch] = useState("");
  const [schemeSubjectsByClass, setSchemeSubjectsByClass] = useState({});
  const [bulkData, setBulkData] = useState({
    session_id: "",
    term_id: "",
    exam_id: "",
    exam_date: "",
    start_time: "",
    end_time: "",
    class_ids: [],
    section_ids: [],
    subject_keys: [],
  });
  const [classCopyData, setClassCopyData] = useState({
    from_session_id: "",
    from_class_id: "",
    to_session_id: "",
    to_class_id: "",
    overwrite: false,
  });
  const fileInputRef = useRef(null);

  const examById = useMemo(() => {
    const m = new Map();
    (exams || []).forEach((e) => m.set(String(e.id), e));
    return m;
  }, [exams]);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchDropdowns = async () => {
    try {
      const [sessionRes, examRes, classRes, sectionRes, subjectRes, termRes] =
        await Promise.all([
          api.get("/sessions"),
          api.get("/exams"),
          api.get("/classes"),
          api.get("/sections"),
          api.get("/subjects"),
          api.get("/terms"),
        ]);

      setSessions(sessionRes.data || []);
      setExams(examRes.data || []);
      setClasses(classRes.data || []);
      setSections(sectionRes.data || []);
      setSubjects(subjectRes.data?.subjects || subjectRes.data || []);
      setTerms(termRes.data || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load dropdowns", "error");
    }
  };

  const fetchSchedules = async () => {
    try {
      const cleanedFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, v]) => v !== "" && v !== null && v !== undefined)
      );

      const res = await api.get("/exam-schedules", { params: cleanedFilters });
      const rows = res.data || [];
      setSchedules(rows);

      setDraftRows(
        rows.map((s) => ({
          id: s.id,
          exam_date: s.exam_date || "",
          start_time: s.start_time || "",
          end_time: s.end_time || "",
        }))
      );
      setDirtyIds(new Set());
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch schedules", "error");
    }
  };

  const handleFilterChange = (e) => {
    setFilters((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    const loadSchemeSubjects = async () => {
      if (!bulkData.session_id || !bulkData.term_id || !bulkData.class_ids.length) {
        setSchemeSubjectsByClass({});
        return;
      }
      try {
        const results = await Promise.all(
          bulkData.class_ids.map(async (classId) => {
            const response = await api.get("/exam-schemes", {
              params: {
                session_id: bulkData.session_id,
                term_id: bulkData.term_id,
                class_id: classId,
              },
            });
            const unique = new Map();
            (response.data || []).forEach((row) => {
              const subject = row.subject || subjects.find((item) => String(item.id) === String(row.subject_id));
              if (subject?.id !== undefined) unique.set(String(subject.id), subject);
            });
            return [String(classId), [...unique.values()]];
          })
        );
        setSchemeSubjectsByClass(Object.fromEntries(results));
      } catch (error) {
        console.error(error);
        setSchemeSubjectsByClass({});
        Swal.fire("Error", "Could not load subjects from the selected exam schemes.", "error");
      }
    };
    loadSchemeSubjects();
  }, [bulkData.session_id, bulkData.term_id, bulkData.class_ids, subjects]);

  const openBulkModal = () => {
    setBulkSubjectSearch("");
    setBulkData({
      session_id: filters.session_id || "",
      term_id: filters.term_id || "",
      exam_id: filters.exam_id || "",
      exam_date: "",
      start_time: "",
      end_time: "",
      class_ids: filters.class_id !== "" ? [String(filters.class_id)] : [],
      section_ids: filters.section_id !== "" ? [String(filters.section_id)] : [],
      subject_keys: [],
    });
    setShowBulkModal(true);
  };

  const toggleBulkClass = (classId) => {
    const id = String(classId);
    setBulkData((previous) => {
      const selected = previous.class_ids.includes(id);
      const classSectionIds = sections
        .filter((section) => String(section.class_id) === id)
        .map((section) => String(section.id));
      return {
        ...previous,
        class_ids: selected
          ? previous.class_ids.filter((value) => value !== id)
          : [...previous.class_ids, id],
        section_ids: selected
          ? previous.section_ids.filter((value) => !classSectionIds.includes(value))
          : [...new Set([...previous.section_ids, ...classSectionIds])],
        subject_keys: selected
          ? previous.subject_keys.filter((key) => !key.startsWith(`${id}:`))
          : previous.subject_keys,
      };
    });
  };

  const toggleBulkValue = (field, value) => {
    const id = String(value);
    setBulkData((previous) => ({
      ...previous,
      [field]: previous[field].includes(id)
        ? previous[field].filter((item) => item !== id)
        : [...previous[field], id],
    }));
  };

  const bulkItems = useMemo(() => {
    const items = [];
    bulkData.class_ids.forEach((classId) => {
      const classSections = sections.filter(
        (section) =>
          String(section.class_id) === String(classId) &&
          bulkData.section_ids.includes(String(section.id))
      );
      const subjectIds = bulkData.subject_keys
        .filter((key) => key.startsWith(`${classId}:`))
        .map((key) => key.split(":")[1]);
      if (!classSections.length) {
        subjectIds.forEach((subjectId) => items.push({
          class_id: Number(classId),
          section_id: null,
          subject_id: Number(subjectId),
        }));
        return;
      }
      classSections.forEach((section) => {
        subjectIds.forEach((subjectId) => items.push({
          class_id: Number(classId),
          section_id: Number(section.id),
          subject_id: Number(subjectId),
        }));
      });
    });
    return items;
  }, [bulkData.class_ids, bulkData.section_ids, bulkData.subject_keys, sections]);

  const handleBulkSubmit = async () => {
    const required = ["session_id", "term_id", "exam_id", "exam_date", "start_time", "end_time"];
    if (required.some((field) => !bulkData[field]) || !bulkItems.length) {
      return Swal.fire("Required", "Select session, term, exam, date/time and at least one class and subject.", "warning");
    }
    if (bulkData.start_time >= bulkData.end_time) {
      return Swal.fire("Invalid Time", "End time must be after start time.", "warning");
    }
    try {
      setBulkSaving(true);
      const response = await api.post("/exam-schedules/bulk", {
        session_id: Number(bulkData.session_id),
        term_id: Number(bulkData.term_id),
        exam_id: Number(bulkData.exam_id),
        exam_date: bulkData.exam_date,
        start_time: bulkData.start_time,
        end_time: bulkData.end_time,
        items: bulkItems,
      });
      setShowBulkModal(false);
      await fetchSchedules();
      await Swal.fire(
        "Schedules Saved",
        `${response.data.created || 0} created; ${response.data.updated || 0} existing row(s) updated.`,
        "success"
      );
    } catch (error) {
      Swal.fire("Error", error.response?.data?.error || "Failed to create schedules", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleGenerateFromScheme = async () => {
    const { session_id, term_id, exam_id, class_id, section_id } = filters;

    if (!session_id || !term_id || !exam_id || !class_id || !section_id) {
      return Swal.fire(
        "Required",
        "Please select Session, Term, Exam, Class, Section first (in Filters).",
        "warning"
      );
    }

    const ex = examById.get(String(exam_id));
    if (ex?.term_id && String(ex.term_id) !== String(term_id)) {
      const c = await Swal.fire({
        title: "Term mismatch",
        text: "Selected Exam seems linked with a different term. Continue anyway?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Continue",
      });
      if (!c.isConfirmed) return;
    }

    try {
      Swal.fire({
        title: "Generating...",
        text: "Creating missing rows from Exam Scheme",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post("/exam-schedules/generate-from-scheme", {
        session_id: Number(session_id),
        term_id: Number(term_id),
        exam_id: Number(exam_id),
        class_id: Number(class_id),
        section_id: Number(section_id),
      });

      const created = res?.data?.created ?? 0;
      const total = res?.data?.totalSubjectsInScheme ?? 0;

      await Swal.fire(
        "Done ✅",
        `Generated successfully.\nCreated: ${created}\nSubjects in Scheme: ${total}\n\nNow fill Date/Start/End in table and click "Save All".`,
        "success"
      );

      fetchSchedules();
    } catch (e) {
      console.error(e);
      Swal.fire(
        "Error",
        e?.response?.data?.message || "Failed to generate from scheme",
        "error"
      );
    }
  };

  const openClassCopyModal = () => {
    const selectedClass =
      filters.class_id === "" || filters.class_id === null || filters.class_id === undefined
        ? ""
        : String(filters.class_id);
    setClassCopyData({
      from_session_id: filters.session_id ? String(filters.session_id) : "",
      from_class_id: selectedClass,
      to_session_id: filters.session_id ? String(filters.session_id) : "",
      to_class_id: "",
      overwrite: false,
    });
    setShowClassCopyModal(true);
  };

  const handleClassCopySubmit = async () => {
    const data = classCopyData;
    const missingClass = (value) =>
      value === "" || value === null || value === undefined;
    if (!data.from_session_id || missingClass(data.from_class_id) ||
        !data.to_session_id || missingClass(data.to_class_id)) {
      return Swal.fire("Required", "Select From/To Session and Class.", "warning");
    }
    if (String(data.from_session_id) === String(data.to_session_id) &&
        String(data.from_class_id) === String(data.to_class_id)) {
      return Swal.fire("Invalid Target", "Source and target cannot be the same.", "warning");
    }

    const sourceName = classes.find((c) => String(c.id) === String(data.from_class_id))?.class_name;
    const targetName = classes.find((c) => String(c.id) === String(data.to_class_id))?.class_name;
    const confirm = await Swal.fire({
      title: "Copy Full Class Schedule?",
      html: `<b>${sourceName || data.from_class_id}</b> → <b>${targetName || data.to_class_id}</b><br/><br/>
        All sections, exams, subjects, dates and times will be copied.${
          data.overwrite ? "<br/><b>Existing target-class schedules will be deleted first.</b>" : "<br/>Existing duplicates will be skipped."
        }`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Copy Full Schedule",
    });
    if (!confirm.isConfirmed) return;

    setShowClassCopyModal(false);
    try {
      Swal.fire({ title: "Copying full class schedule...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const response = await api.post("/exam-schedules/copy-class", {
        from_session_id: Number(data.from_session_id),
        from_class_id: Number(data.from_class_id),
        to_session_id: Number(data.to_session_id),
        to_class_id: Number(data.to_class_id),
        overwrite: data.overwrite,
      });
      await Swal.fire("Copied", `${response.data.created || 0} created; ${response.data.skipped || 0} skipped.`, "success");
      fetchSchedules();
    } catch (err) {
      Swal.fire("Error", err?.response?.data?.message || "Failed to copy full class schedule", "error");
      setShowClassCopyModal(true);
    }
  };

  const markDirty = (id) => {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.add(String(id));
      return next;
    });
  };

  const updateDraftCell = (rowIndex, key, value) => {
    setDraftRows((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [key]: value };
      return next;
    });
    const sid = schedules[rowIndex]?.id;
    if (sid) markDirty(sid);
  };

  const handleSaveAllDateTimes = async () => {
    const updates = draftRows
      .filter((r) => dirtyIds.has(String(r.id)))
      .map((r) => ({
        id: r.id,
        exam_date: r.exam_date || null,
        start_time: r.start_time || null,
        end_time: r.end_time || null,
      }));

    if (!updates.length) {
      return Swal.fire("No Changes", "Nothing to save.", "info");
    }

    const bad = updates.find((u) => !u.exam_date || !u.start_time || !u.end_time);
    if (bad) {
      return Swal.fire(
        "Validation",
        "Please fill Date + Start + End for all edited rows (cannot save partial).",
        "warning"
      );
    }

    try {
      Swal.fire({
        title: "Saving...",
        text: "Updating Date/Start/End",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.put("/exam-schedules/bulk-datetime", { updates });
      const updated = res?.data?.updated ?? 0;

      await Swal.fire("Saved ✅", `${updated} row(s) updated successfully.`, "success");
      fetchSchedules();
    } catch (e) {
      console.error(e);
      Swal.fire(
        "Error",
        e?.response?.data?.message || "Failed to save",
        "error"
      );
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const closeModal = () => setShowModal(false);

  const openAddModal = () => {
    setCopySourceClassId(null);
    setFormData({
      id: null,
      session_id: filters.session_id || "",
      term_id: filters.term_id || "",
      exam_id: filters.exam_id || "",
      class_id: filters.class_id || "",
      section_id: filters.section_id || "",
      subject_id: "",
      exam_date: "",
      start_time: "",
      end_time: "",
    });
    setShowModal(true);
  };

  const handleEdit = (schedule) => {
    setCopySourceClassId(null);
    setFormData({
      id: schedule.id,
      session_id: schedule.session_id || schedule.session?.id || "",
      term_id: schedule.term_id || schedule.term?.id || "",
      exam_id: schedule.exam_id || schedule.exam?.id || "",
      class_id: schedule.class_id || schedule.class?.id || "",
      section_id: schedule.section_id || schedule.section?.id || "",
      subject_id: schedule.subject_id || schedule.subject?.id || "",
      exam_date: schedule.exam_date || "",
      start_time: schedule.start_time || "",
      end_time: schedule.end_time || "",
    });
    setShowModal(true);
  };

  const handleDuplicate = (schedule) => {
    const sourceClassId =
      schedule.class_id ?? schedule.class?.id ?? "";
    setCopySourceClassId(String(sourceClassId));
    setFormData({
      id: null,
      session_id: schedule.session_id ?? schedule.session?.id ?? "",
      term_id: schedule.term_id ?? schedule.term?.id ?? "",
      exam_id: schedule.exam_id ?? schedule.exam?.id ?? "",
      class_id: "",
      section_id: schedule.section_id ?? schedule.section?.id ?? "",
      subject_id: schedule.subject_id ?? schedule.subject?.id ?? "",
      exam_date: schedule.exam_date || "",
      start_time: schedule.start_time || "",
      end_time: schedule.end_time || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    const {
      id,
      session_id,
      term_id,
      exam_id,
      class_id,
      section_id,
      subject_id,
      exam_date,
      start_time,
      end_time,
    } = formData;

    if (
      !session_id ||
      !term_id ||
      !exam_id ||
      !class_id ||
      !subject_id ||
      !exam_date ||
      !start_time ||
      !end_time
    ) {
      return Swal.fire(
        "Validation Error",
        "Please fill all required fields",
        "warning"
      );
    }

    const payload = {
      ...formData,
      session_id: Number(session_id),
      term_id: Number(term_id),
      exam_id: Number(exam_id),
      class_id: Number(class_id),
      section_id: section_id === "" ? null : Number(section_id),
      subject_id: Number(subject_id),
    };

    try {
      if (id) {
        await api.put(`/exam-schedules/${id}`, payload);
        Swal.fire("Updated", "Schedule updated successfully", "success");
      } else {
        await api.post("/exam-schedules", payload);
        Swal.fire("Success", "Schedule created successfully", "success");
      }
      closeModal();
      fetchSchedules();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.error || "Failed to save schedule", "error");
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the schedule.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/exam-schedules/${id}`);
        Swal.fire("Deleted", "Schedule deleted.", "success");
        fetchSchedules();
      } catch (err) {
        console.error(err);
        Swal.fire("Error", "Failed to delete schedule", "error");
      }
    }
  };

  const handleDeleteAllDisplayed = async () => {
    const displayedIds = schedules
      .map((schedule) => Number(schedule.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!displayedIds.length) {
      return Swal.fire("Nothing to Delete", "No schedules are displayed.", "info");
    }

    const confirm = await Swal.fire({
      title: `Delete all ${displayedIds.length} displayed schedules?`,
      html: `<div style="text-align:left">
        This permanently deletes only the rows in the current displayed list.
        ${dirtyIds.size ? `<br/><br/><b>${dirtyIds.size} unsaved edited row(s) will also be deleted.</b>` : ""}
      </div>`,
      icon: "warning",
      input: "text",
      inputPlaceholder: "Type DELETE ALL",
      showCancelButton: true,
      confirmButtonText: "Delete All Displayed",
      confirmButtonColor: "#d33",
      preConfirm: (value) => {
        if ((value || "").trim().toUpperCase() !== "DELETE ALL") {
          Swal.showValidationMessage("Please type DELETE ALL exactly.");
          return false;
        }
        return true;
      },
    });

    if (!confirm.isConfirmed) return;

    try {
      Swal.fire({
        title: "Deleting displayed schedules...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const response = await api.delete("/exam-schedules/displayed", {
        data: { ids: displayedIds },
      });
      const deleted = response?.data?.deleted ?? 0;

      await Swal.fire(
        "Deleted",
        `${deleted} displayed schedule(s) deleted successfully.`,
        "success"
      );
      fetchSchedules();
    } catch (err) {
      console.error(err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to delete displayed schedules",
        "error"
      );
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get("/exam-schedules/export", {
        params: filters,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "ExamSchedules.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed:", error);
      Swal.fire("Error", "Failed to export Excel", "error");
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    if (filters.session_id) form.append("session_id", filters.session_id);
    if (filters.term_id) form.append("term_id", filters.term_id);
    if (filters.exam_id) form.append("exam_id", filters.exam_id);
    if (filters.class_id) form.append("class_id", filters.class_id);
    if (filters.section_id) form.append("section_id", filters.section_id);

    try {
      await api.post("/exam-schedules/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire("Success", "Import completed", "success");
      fetchSchedules();
    } catch (err) {
      console.error(err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to import file",
        "error"
      );
    } finally {
      e.target.value = "";
    }
  };

  const hasSelection = (value) =>
    value !== "" && value !== null && value !== undefined;
  const canGenerate =
    hasSelection(filters.session_id) &&
    hasSelection(filters.term_id) &&
    hasSelection(filters.exam_id) &&
    hasSelection(filters.class_id) &&
    (hasSelection(filters.section_id) || !sections.length);

  const canPublish = canGenerate && schedules.length > 0 && !dirtyIds.size;
  const isPublished = schedules.length > 0 && schedules.every((row) => row.is_published);
  const publishDisabledReason = !canGenerate
    ? `Select Session, Term, Exam, Class${sections.length ? " and Section" : ""}`
    : !schedules.length
      ? "No schedule rows are available for this selection"
      : dirtyIds.size
        ? "Save all date/time changes first"
        : "";

  const handlePublication = async (publish) => {
    if (!canPublish) return;
    const action = publish ? "Publish" : "Unpublish";
    const confirmation = await Swal.fire({
      title: `${action} date sheet?`,
      text: publish
        ? `Students in this ${sections.length ? "class-section" : "class"} will see it immediately and receive a notification.`
        : "It will be removed from the student app immediately.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: action,
    });
    if (!confirmation.isConfirmed) return;

    try {
      setPublishing(true);
      const response = await api.put("/exam-schedules/publication", {
        ...filters,
        publish,
      });
      await fetchSchedules();
      const sent = Number(response.data?.notifications_sent || 0);
      Swal.fire(
        "Done",
        publish ? `Date sheet published. ${sent} notification(s) sent.` : "Date sheet unpublished.",
        "success"
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || `Failed to ${action.toLowerCase()} date sheet`,
        "error"
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="m-0">📘 Exam Schedule Management</h2>

        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-primary" onClick={openClassCopyModal}>
            🏫 Copy Full Class Schedule
          </Button>
          <Button
            variant="outline-info"
            onClick={handleGenerateFromScheme}
            disabled={!canGenerate}
            title={
              canGenerate
                ? "Create missing schedule rows from Exam Scheme"
                : "Select Session, Term, Exam, Class, Section first"
            }
          >
            ⚡ Generate from Scheme
          </Button>

          <Button
            variant="success"
            onClick={handleSaveAllDateTimes}
            disabled={!dirtyIds.size}
            title={dirtyIds.size ? "Save all changed date/time rows" : "No changes"}
          >
            💾 Save All Dates/Times {dirtyIds.size ? `(${dirtyIds.size})` : ""}
          </Button>
          <Button
            variant={isPublished ? "outline-danger" : "dark"}
            onClick={() => handlePublication(!isPublished)}
            disabled={!canPublish || publishing}
            title={publishDisabledReason}
          >
            {publishing ? "Please wait…" : isPublished ? "🔒 Unpublish Date Sheet" : "📣 Publish Date Sheet"}
          </Button>
          {publishDisabledReason && (
            <span className="small text-muted align-self-center">
              {publishDisabledReason}
            </span>
          )}
        </div>
      </div>

      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter</h5>
          <div className="row g-2">
            <div className="col-md-3">
              <label>Session</label>
              <Form.Select
                name="session_id"
                value={filters.session_id}
                onChange={handleFilterChange}
              >
                <option value="">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="col-md-3">
              <label>Term</label>
              <Form.Select
                name="term_id"
                value={filters.term_id}
                onChange={handleFilterChange}
              >
                <option value="">All Terms</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="col-md-3">
              <label>Exam</label>
              <Form.Select
                name="exam_id"
                value={filters.exam_id}
                onChange={handleFilterChange}
              >
                <option value="">All Exams</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="col-md-3">
              <label>Class</label>
              <Form.Select
                name="class_id"
                value={filters.class_id}
                onChange={handleFilterChange}
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="col-md-3">
              <label>Section</label>
              <Form.Select
                name="section_id"
                value={filters.section_id}
                onChange={handleFilterChange}
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="col-12 d-flex justify-content-between align-items-center mt-2">
              <div className="text-muted">
                Tip: Session + Filter select karo → <b>Generate from Scheme</b> → table me
                dates/times fill karke <b>Save All</b>.
              </div>

              <div className="d-flex gap-2">
                <Button variant="success" onClick={openBulkModal}>
                  🗓️ Create Multiple Schedules
                </Button>
                <Button variant="primary" onClick={openAddModal} title="Manual Add (optional)">
                  ➕ Add Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex gap-2 flex-wrap">
          <Button
            variant="outline-danger"
            onClick={handleDeleteAllDisplayed}
            disabled={!schedules.length}
            title={schedules.length ? "Delete every row in the displayed list" : "No rows displayed"}
          >
            🗑️ Delete All Displayed
          </Button>
          <Button variant="outline-success" onClick={handleExport}>
            ⬇️ Export Excel
          </Button>
          <Button variant="outline-primary" onClick={handleImportClick}>
            ⬆️ Import Excel
          </Button>

          <Form.Control
            type="file"
            accept=".xlsx"
            ref={fileInputRef}
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </div>

        <div className="text-muted">
          Rows: <b>{schedules.length}</b> {dirtyIds.size ? ` | Edited: ${dirtyIds.size}` : ""}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Scheduled Exams</h5>

          {schedules.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Session</th>
                    <th>Term</th>
                    <th>Exam</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Subject</th>
                    <th style={{ width: 160 }}>Date</th>
                    <th style={{ width: 130 }}>Start</th>
                    <th style={{ width: 130 }}>End</th>
                    <th style={{ width: 105 }}>Status</th>
                    <th style={{ width: 190 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s, i) => {
                    const d = draftRows[i] || { exam_date: "", start_time: "", end_time: "" };
                    const isDirty = dirtyIds.has(String(s.id));

                    return (
                      <tr key={s.id} className={isDirty ? "table-warning" : ""}>
                        <td>{i + 1}</td>
                        <td>{s.session?.name || s.session_name || s.session_id || "-"}</td>
                        <td>{s.term?.name || "-"}</td>
                        <td>{s.exam?.name || "-"}</td>
                        <td>{s.class?.class_name || "-"}</td>
                        <td>{s.section?.section_name || "-"}</td>
                        <td>{s.subject?.name || "-"}</td>

                        <td>
                          <Form.Control
                            type="date"
                            value={d.exam_date}
                            onChange={(e) => updateDraftCell(i, "exam_date", e.target.value)}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="time"
                            value={d.start_time}
                            onChange={(e) => updateDraftCell(i, "start_time", e.target.value)}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="time"
                            value={d.end_time}
                            onChange={(e) => updateDraftCell(i, "end_time", e.target.value)}
                          />
                        </td>

                        <td>
                          <span className={`badge ${s.is_published ? "bg-success" : "bg-secondary"}`}>
                            {s.is_published ? "Published" : "Draft"}
                          </span>
                        </td>

                        <td>
                          <Button
                            variant="outline-info"
                            size="sm"
                            className="me-2"
                            onClick={() => handleDuplicate(s)}
                            title="Duplicate Schedule"
                          >
                            📄
                          </Button>

                          <Button
                            variant="warning"
                            size="sm"
                            className="me-2"
                            onClick={() => handleEdit(s)}
                          >
                            Edit
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(s.id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted m-0">No schedules found.</p>
          )}
        </div>
      </div>

      <Modal show={showBulkModal} onHide={() => !bulkSaving && setShowBulkModal(false)} size="xl" centered scrollable>
        <Modal.Header closeButton={!bulkSaving}>
          <Modal.Title>🗓️ Bulk Schedule Builder</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="alert alert-light border py-2">
            Choose one date and time, then select classes, their sections, and the subjects to schedule.
          </div>

          <div className="row g-3">
            {[
              ["session_id", "Session", sessions, "name"],
              ["term_id", "Term", terms, "name"],
              ["exam_id", "Exam", exams, "name"],
            ].map(([field, label, options, labelKey]) => (
              <div className="col-12 col-md-4" key={field}>
                <Form.Label>{label} *</Form.Label>
                <Form.Select
                  value={bulkData[field]}
                  onChange={(event) => setBulkData((previous) => ({
                    ...previous,
                    [field]: event.target.value,
                    ...(field === "session_id" || field === "term_id" ? { subject_keys: [] } : {}),
                  }))}
                >
                  <option value="">Select {label}</option>
                  {options.map((option) => (
                    <option key={option.id} value={String(option.id)}>{option[labelKey]}</option>
                  ))}
                </Form.Select>
              </div>
            ))}

            <div className="col-12 col-md-4">
              <Form.Label>Exam Date *</Form.Label>
              <Form.Control type="date" value={bulkData.exam_date} onChange={(event) => setBulkData((previous) => ({ ...previous, exam_date: event.target.value }))} />
            </div>
            <div className="col-6 col-md-4">
              <Form.Label>Start Time *</Form.Label>
              <Form.Control type="time" value={bulkData.start_time} onChange={(event) => setBulkData((previous) => ({ ...previous, start_time: event.target.value }))} />
            </div>
            <div className="col-6 col-md-4">
              <Form.Label>End Time *</Form.Label>
              <Form.Control type="time" value={bulkData.end_time} onChange={(event) => setBulkData((previous) => ({ ...previous, end_time: event.target.value }))} />
            </div>

            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Label className="m-0 fw-semibold">1. Classes *</Form.Label>
                <span className="badge bg-primary">{bulkData.class_ids.length} selected</span>
              </div>
              <div className="d-flex flex-wrap gap-2 border rounded p-3">
                {classes.map((item) => (
                  <Button
                    type="button"
                    size="sm"
                    key={item.id}
                    variant={bulkData.class_ids.includes(String(item.id)) ? "primary" : "outline-secondary"}
                    onClick={() => toggleBulkClass(item.id)}
                  >
                    {bulkData.class_ids.includes(String(item.id)) ? "✓ " : ""}{item.class_name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Label className="m-0 fw-semibold">2. Sections *</Form.Label>
                <span className="badge bg-primary">{bulkData.section_ids.length} selected</span>
              </div>
              <div className="row g-2 border rounded p-2">
                {bulkData.class_ids.length ? bulkData.class_ids.map((classId) => {
                  const selectedClass = classes.find((item) => String(item.id) === classId);
                  const classSections = sections.filter((item) => String(item.class_id) === classId);
                  return (
                    <div className="col-12 col-md-6 col-lg-4" key={classId}>
                      <div className="fw-semibold mb-1">{selectedClass?.class_name}</div>
                      <div className="d-flex flex-wrap gap-3">
                        {classSections.map((section) => (
                          <Form.Check
                            key={section.id}
                            type="checkbox"
                            label={section.section_name}
                            checked={bulkData.section_ids.includes(String(section.id))}
                            onChange={() => toggleBulkValue("section_ids", section.id)}
                          />
                        ))}
                        {!classSections.length && (
                          <span className="small text-success">
                            No sections configured — a class-level schedule will be created.
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }) : <div className="text-muted">Select classes first.</div>}
              </div>
            </div>

            <div className="col-12">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <Form.Label className="m-0 fw-semibold">3. Subjects from Exam Scheme *</Form.Label>
                <Form.Control
                  type="search"
                  placeholder="Filter subjects..."
                  value={bulkSubjectSearch}
                  onChange={(event) => setBulkSubjectSearch(event.target.value)}
                  style={{ maxWidth: 280 }}
                />
              </div>
              <div className="row g-3 border rounded p-2" style={{ maxHeight: 300, overflowY: "auto" }}>
                {bulkData.class_ids.length ? bulkData.class_ids.map((classId) => {
                  const selectedClass = classes.find((item) => String(item.id) === classId);
                  const availableSubjects = (schemeSubjectsByClass[classId] || []).filter((subject) =>
                    subject.name?.toLowerCase().includes(bulkSubjectSearch.trim().toLowerCase())
                  );
                  return (
                    <div className="col-12 col-md-6" key={classId}>
                      <div className="d-flex justify-content-between mb-2">
                        <span className="fw-semibold">{selectedClass?.class_name}</span>
                        {!!availableSubjects.length && (
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0"
                            onClick={() => setBulkData((previous) => {
                              const visibleKeys = availableSubjects.map((subject) => `${classId}:${subject.id}`);
                              const allSelected = visibleKeys.every((key) => previous.subject_keys.includes(key));
                              return {
                                ...previous,
                                subject_keys: allSelected
                                  ? previous.subject_keys.filter((key) => !visibleKeys.includes(key))
                                  : [...new Set([...previous.subject_keys, ...visibleKeys])],
                              };
                            })}
                          >
                            Select/Clear all
                          </button>
                        )}
                      </div>
                      {availableSubjects.map((subject) => {
                        const key = `${classId}:${subject.id}`;
                        return <Form.Check key={key} className="mb-1" type="checkbox" label={subject.name} checked={bulkData.subject_keys.includes(key)} onChange={() => toggleBulkValue("subject_keys", key)} />;
                      })}
                      {!availableSubjects.length && (
                        <div className="small text-muted">
                          {bulkData.session_id && bulkData.term_id ? "No matching subjects in the exam scheme." : "Select session and term to load subjects."}
                        </div>
                      )}
                    </div>
                  );
                }) : <div className="text-muted">Select classes first.</div>}
              </div>
            </div>
          </div>

          <div className={`alert mt-3 mb-0 ${bulkItems.length ? "alert-success" : "alert-warning"}`}>
            <b>{bulkItems.length}</b> schedule row(s) will be saved. Existing matching rows will be updated safely.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" disabled={bulkSaving} onClick={() => setShowBulkModal(false)}>Cancel</Button>
          <Button variant="success" disabled={bulkSaving || !bulkItems.length} onClick={handleBulkSubmit}>
            {bulkSaving ? "Creating…" : `Create ${bulkItems.length} Schedule(s)`}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showModal} onHide={closeModal} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <Modal.Title>
            {formData.id
              ? "✏️ Edit Schedule"
              : copySourceClassId !== null
                ? "📄 Copy Schedule to Class"
                : "➕ Add Schedule"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ paddingBottom: "0.5rem" }}>
          <Form>
            <div className="row g-2">
              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Session</Form.Label>
                  <Form.Select
                    name="session_id"
                    value={formData.session_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id}
                  >
                    <option value="">Select Session</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Term</Form.Label>
                  <Form.Select
                    name="term_id"
                    value={formData.term_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id}
                  >
                    <option value="">Select Term</option>
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Exam</Form.Label>
                  <Form.Select
                    name="exam_id"
                    value={formData.exam_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id}
                  >
                    <option value="">Select Exam</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              {copySourceClassId !== null && (
                <div className="col-12 col-md-6 col-lg-4">
                  <Form.Group className="mb-2">
                    <Form.Label>From Class</Form.Label>
                    <Form.Control
                      value={
                        classes.find((c) => String(c.id) === copySourceClassId)
                          ?.class_name || copySourceClassId
                      }
                      disabled
                      readOnly
                    />
                  </Form.Group>
                </div>
              )}

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>
                    {copySourceClassId !== null ? "Copy To Class" : "Class"}
                  </Form.Label>
                  <Form.Select
                    name="class_id"
                    value={formData.class_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id}
                  >
                    <option value="">
                      {copySourceClassId !== null ? "Select Target Class" : "Select Class"}
                    </option>
                    {classes.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        disabled={
                          copySourceClassId !== null &&
                          String(c.id) === copySourceClassId
                        }
                      >
                        {c.class_name}
                        {copySourceClassId !== null && String(c.id) === copySourceClassId
                          ? " (Source)"
                          : ""}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Section</Form.Label>
                  <Form.Select
                    name="section_id"
                    value={formData.section_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id}
                  >
                    <option value="">
                      {sections.length ? "Select Section (optional)" : "No Section (class-level)"}
                    </option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.section_name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Subject</Form.Label>
                  <Form.Select
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Exam Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="exam_date"
                    value={formData.exam_date}
                    onChange={handleFormChange}
                  />
                </Form.Group>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Start Time</Form.Label>
                  <Form.Control
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleFormChange}
                  />
                </Form.Group>
              </div>

              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>End Time</Form.Label>
                  <Form.Control
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleFormChange}
                  />
                </Form.Group>
              </div>
            </div>

            <div className="mt-2 text-muted">
              Note: In auto mode, schedules are created from Scheme; you only update date/time.
            </div>
          </Form>
        </Modal.Body>

        <Modal.Footer style={{ paddingTop: "0.25rem" }}>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {formData.id
              ? "Update"
              : copySourceClassId !== null
                ? "Copy Schedule"
                : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showClassCopyModal} onHide={() => setShowClassCopyModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🏫 Copy Full Class Schedule</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-3">
            {[
              ["from_session_id", "From Session", sessions, "name"],
              ["from_class_id", "From Class", classes, "class_name"],
              ["to_session_id", "To Session", sessions, "name"],
              ["to_class_id", "To Class", classes, "class_name"],
            ].map(([name, label, options, labelKey]) => (
              <div className="col-12 col-md-6" key={name}>
                <Form.Label>{label}</Form.Label>
                <Form.Select
                  value={classCopyData[name]}
                  onChange={(e) => setClassCopyData((previous) => ({ ...previous, [name]: e.target.value }))}
                >
                  <option value="">Select {label}</option>
                  {options.map((option) => (
                    <option key={option.id} value={String(option.id)}>{option[labelKey]}</option>
                  ))}
                </Form.Select>
              </div>
            ))}
            <div className="col-12">
              <Form.Check
                type="checkbox"
                label="Overwrite target class schedule (delete target first)"
                checked={classCopyData.overwrite}
                onChange={(e) => setClassCopyData((previous) => ({ ...previous, overwrite: e.target.checked }))}
              />
              <div className="text-muted mt-2">
                Sections, exams, subjects, dates and times are preserved from the source class.
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowClassCopyModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleClassCopySubmit}>Copy Full Schedule</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamScheduleManagement;
