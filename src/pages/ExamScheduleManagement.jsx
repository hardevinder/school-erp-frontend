// src/pages/ExamScheduleManagement.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button, Form } from "react-bootstrap";

const ExamScheduleManagement = () => {
  const [schedules, setSchedules] = useState([]);
  const [draftRows, setDraftRows] = useState([]); // ✅ inline editable date/time
  const [dirtyIds, setDirtyIds] = useState(new Set()); // ✅ track changed rows

  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [terms, setTerms] = useState([]);

  const [filters, setFilters] = useState({
    term_id: "",
    exam_id: "",
    class_id: "",
    section_id: "",
  });

  const [formData, setFormData] = useState({
    id: null,
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
  const fileInputRef = useRef(null);

  // 🔎 quick lookup maps
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
      const [examRes, classRes, sectionRes, subjectRes, termRes] =
        await Promise.all([
          api.get("/exams"),
          api.get("/classes"),
          api.get("/sections"),
          api.get("/subjects"),
          api.get("/terms"),
        ]);

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
      const res = await api.get("/exam-schedules", { params: filters });
      const rows = res.data || [];
      setSchedules(rows);

      // ✅ reset inline editor whenever we refetch
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

  // ==============================
  // ✅ Generate from Scheme
  // ==============================
  const handleGenerateFromScheme = async () => {
    const { term_id, exam_id, class_id, section_id } = filters;

    if (!term_id || !exam_id || !class_id || !section_id) {
      return Swal.fire(
        "Required",
        "Please select Term, Exam, Class, Section first (in Filters).",
        "warning"
      );
    }

    // optional: validate exam.term_id matches filter term_id
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

  // ==============================
  // ✅ Inline edit helpers
  // ==============================
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

    // basic validation for dirty rows
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

  // ==============================
  // ✅ Modal (Add / Edit / Duplicate)
  // NOTE: For "auto-only" flow, you can hide Add button.
  // ==============================
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const closeModal = () => setShowModal(false);

  const openAddModal = () => {
    setFormData({
      id: null,
      term_id: "",
      exam_id: "",
      class_id: "",
      section_id: "",
      subject_id: "",
      exam_date: "",
      start_time: "",
      end_time: "",
    });
    setShowModal(true);
  };

  const handleEdit = (schedule) => {
    setFormData({
      id: schedule.id,
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
    setFormData({
      id: null,
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

  const handleSubmit = async () => {
    const {
      id,
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
      !term_id ||
      !exam_id ||
      !class_id ||
      !section_id ||
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

    try {
      if (id) {
        await api.put(`/exam-schedules/${id}`, formData);
        Swal.fire("Updated", "Schedule updated successfully", "success");
      } else {
        await api.post("/exam-schedules", formData);
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

  // ==============================
  // Export / Import
  // ==============================
  const handleExport = async () => {
    try {
      const response = await api.get("/exam-schedules/export", {
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

    try {
      await api.post("/exam-schedules/import", form);
      Swal.fire("Success", "Import completed", "success");
      fetchSchedules();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to import file", "error");
    } finally {
      // reset input so same file can be selected again
      e.target.value = "";
    }
  };

  // ==============================
  // UI
  // ==============================
  const canGenerate =
    !!filters.term_id && !!filters.exam_id && !!filters.class_id && !!filters.section_id;

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="m-0">📘 Exam Schedule Management</h2>

        <div className="d-flex gap-2 flex-wrap">
          <Button
            variant="outline-info"
            onClick={handleGenerateFromScheme}
            disabled={!canGenerate}
            title={
              canGenerate
                ? "Create missing schedule rows from Exam Scheme"
                : "Select Term, Exam, Class, Section first"
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
        </div>
      </div>

      {/* Filter Card */}
      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter</h5>
          <div className="row g-2">
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
                Tip: Filter select karo → <b>Generate from Scheme</b> → table me dates/times fill karke{" "}
                <b>Save All</b>.
              </div>

              <div className="d-flex gap-2">
                <Button variant="primary" onClick={openAddModal} title="Manual Add (optional)">
                  ➕ Add Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Import Export Actions */}
      <div className="d-flex justify-content-between mb-3 flex-wrap gap-2">
        <div className="d-flex gap-2 flex-wrap">
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

      {/* Table */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Scheduled Exams</h5>

          {schedules.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 50 }}>#</th>
                    <th>Term</th>
                    <th>Exam</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Subject</th>
                    <th style={{ width: 160 }}>Date</th>
                    <th style={{ width: 130 }}>Start</th>
                    <th style={{ width: 130 }}>End</th>
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
                        <td>{s.term?.name || "-"}</td>
                        <td>{s.exam?.name || "-"}</td>
                        <td>{s.class?.class_name || "-"}</td>
                        <td>{s.section?.section_name || "-"}</td>
                        <td>{s.subject?.name || "-"}</td>

                        {/* ✅ Inline editable Date/Start/End */}
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
                          {/* 📄 Duplicate */}
                          <Button
                            variant="outline-info"
                            size="sm"
                            className="me-2"
                            onClick={() => handleDuplicate(s)}
                            title="Duplicate Schedule"
                          >
                            📄
                          </Button>

                          {/* Edit (modal) */}
                          <Button
                            variant="warning"
                            size="sm"
                            className="me-2"
                            onClick={() => handleEdit(s)}
                          >
                            Edit
                          </Button>

                          {/* Delete */}
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

      {/* Modal (Manual Add/Edit/Duplicate) */}
      <Modal
        show={showModal}
        onHide={closeModal}
        size="lg"
        centered
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {formData.id ? "✏️ Edit Schedule" : "➕ Add / Duplicate Schedule"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ paddingBottom: "0.5rem" }}>
          <Form>
            <div className="row g-2">
              {/* Term */}
              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Term</Form.Label>
                  <Form.Select
                    name="term_id"
                    value={formData.term_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id} // ✅ lock on edit
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

              {/* Exam */}
              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Exam</Form.Label>
                  <Form.Select
                    name="exam_id"
                    value={formData.exam_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id} // ✅ lock on edit
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

              {/* Class */}
              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Class</Form.Label>
                  <Form.Select
                    name="class_id"
                    value={formData.class_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id} // ✅ lock on edit
                  >
                    <option value="">Select Class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              {/* Section */}
              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Section</Form.Label>
                  <Form.Select
                    name="section_id"
                    value={formData.section_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id} // ✅ lock on edit
                  >
                    <option value="">Select Section</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.section_name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>

              {/* Subject */}
              <div className="col-12 col-md-6 col-lg-4">
                <Form.Group className="mb-2">
                  <Form.Label>Subject</Form.Label>
                  <Form.Select
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleFormChange}
                    disabled={!!formData.id} // ✅ lock on edit
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

              {/* Exam Date */}
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

              {/* Start Time */}
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

              {/* End Time */}
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
            {formData.id ? "Update" : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamScheduleManagement;
