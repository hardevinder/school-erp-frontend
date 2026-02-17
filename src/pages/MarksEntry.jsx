// src/pages/MarksEntry.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const MarksEntry = () => {
  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
    exam_id: "",
    subject_id: "",
  });

  const [classExamSubjects, setClassExamSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [components, setComponents] = useState([]);
  const [marks, setMarks] = useState({});
  const [attendance, setAttendance] = useState({});
  const [examScheduleId, setExamScheduleId] = useState(null);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const inputRefs = useRef({});

  // ✅ simple stats modal (no charts)
  const [showStats, setShowStats] = useState(false);

  const resetMarksData = () => {
    setStudents([]);
    setComponents([]);
    setMarks({});
    setAttendance({});
    setExamScheduleId(null);
    setActiveStudentId(null);
  };

  useEffect(() => {
    loadClassExamSubjects();
    loadSections();
  }, []);

  useEffect(() => {
    const { class_id, section_id, exam_id, subject_id } = filters;
    if (class_id && section_id && exam_id && subject_id) {
      fetchMarksEntryData();
    } else {
      resetMarksData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadClassExamSubjects = async () => {
    try {
      const res = await api.get("/exams/class-exam-subjects");
      setClassExamSubjects(res.data || []);
    } catch (err) {
      Swal.fire("Error", "Failed to load class-exam-subject data", "error");
    }
  };

  const loadSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(res.data || []);
    } catch (err) {
      Swal.fire("Error", "Failed to load sections", "error");
    }
  };

  const handleClassChange = (e) => {
    const class_id = e.target.value;
    setFilters({ class_id, section_id: "", exam_id: "", subject_id: "" });

    const selectedClass = classExamSubjects.find(
      (c) => c.class_id === parseInt(class_id)
    );
    setExams(selectedClass ? selectedClass.exams : []);
    setSubjects([]);
    resetMarksData();
  };

  const handleExamChange = (e) => {
    const exam_id = e.target.value;
    setFilters((prev) => ({ ...prev, exam_id, subject_id: "" }));

    const selectedClass = classExamSubjects.find(
      (c) => c.class_id === parseInt(filters.class_id)
    );
    const selectedExam = selectedClass?.exams.find(
      (ex) => ex.exam_id === parseInt(exam_id)
    );
    setSubjects(selectedExam ? selectedExam.subjects : []);
    resetMarksData();
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    resetMarksData();
  };

  const fetchMarksEntryData = async () => {
    const { class_id, section_id, exam_id, subject_id } = filters;
    try {
      const res = await api.get("/marks-entry", {
        params: { class_id, section_id, exam_id, subject_id },
      });

      setStudents(res.data.students || []);
      setComponents(res.data.components || []);
      setExamScheduleId(res.data.exam_schedule_id || null);

      const prefill = {};
      const preAttendance = {};
      const resultMap = res.data.resultMap || {};

      Object.entries(resultMap).forEach(([key, val]) => {
        const m = val.marks ?? val.marks_obtained ?? val.marksObtained ?? null;
        prefill[key] = m === null || m === undefined ? "" : m;
        preAttendance[key] = val.attendance || "P";
      });

      setMarks(prefill);
      setAttendance(preAttendance);
    } catch (err) {
      console.error("Error loading marks entry:", err);
      Swal.fire("Error", "Failed to load marks entry data", "error");
    }
  };

  const handleAttendanceChange = (student_id, component_id, value) => {
    const key = `${student_id}_${component_id}`;
    setAttendance((prev) => ({ ...prev, [key]: value }));
    if (value !== "P") {
      setMarks((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const handleMarksChange = (student_id, component_id, value) => {
    const key = `${student_id}_${component_id}`;
    const num = parseFloat(value);
    const max =
      components.find((c) => c.component_id === component_id)?.max_marks || 100;

    if (!isNaN(num) && num > max) {
      Swal.fire(
        "Invalid Marks",
        `Marks cannot exceed maximum of ${max}`,
        "warning"
      );
      return;
    }

    setMarks((prev) => ({
      ...prev,
      [key]: value === "" || isNaN(num) ? "" : num,
    }));
  };

  const handleSaveMarks = async () => {
    if (!examScheduleId)
      return Swal.fire("Error", "Exam Schedule ID not found", "error");

    const marksData = [];
    students.forEach((student) => {
      components.forEach((comp) => {
        const key = `${student.id}_${comp.component_id}`;
        const hasKey = Object.prototype.hasOwnProperty.call(marks, key);
        const rawVal = hasKey ? marks[key] : "";
        const att = attendance[key] || "P";

        marksData.push({
          student_id: student.id,
          component_id: comp.component_id,
          marks_obtained:
            rawVal === "" || rawVal === null || rawVal === undefined
              ? null
              : parseFloat(rawVal),
          attendance: att,
        });
      });
    });

    try {
      await api.post("/marks-entry/save", {
        exam_schedule_id: examScheduleId,
        marksData,
      });
      Swal.fire("Success", "Marks saved successfully", "success");
      fetchMarksEntryData();
    } catch (err) {
      console.error("Save marks error:", err);
      Swal.fire("Error", "Failed to save marks", "error");
    }
  };

  const handleExportExcel = async () => {
    const { class_id, section_id, exam_id, subject_id } = filters;
    try {
      const response = await api.get("/marks-entry/export", {
        params: { class_id, section_id, exam_id, subject_id },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `marks-entry-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export Excel error:", err);
      Swal.fire("Error", "Failed to export Excel", "error");
    }
  };

  const handleExportPDF = async () => {
    const { class_id, section_id, exam_id, subject_id } = filters;
    try {
      const response = await api.get("/marks-entry/export-pdf", {
        params: { class_id, section_id, exam_id, subject_id },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `marks-entry-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => window.URL.revokeObjectURL(url), 1500);
    } catch (err) {
      console.error("Export PDF error:", err);
      Swal.fire("Error", "Failed to export PDF", "error");
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file || !examScheduleId)
      return Swal.fire(
        "Error",
        "Please select a file and valid schedule",
        "error"
      );

    const formData = new FormData();
    formData.append("file", file);
    formData.append("exam_schedule_id", examScheduleId);

    try {
      const res = await api.post("/marks-entry/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire(
        "Success",
        `Marks imported successfully${
          res.data?.rowsProcessed
            ? ` (rows processed: ${res.data.rowsProcessed})`
            : ""
        }`,
        "success"
      );
      fetchMarksEntryData();
      e.target.value = null;
    } catch (err) {
      console.error("Import Excel error:", err);
      Swal.fire("Error", "Failed to import marks", "error");
    }
  };

  const handleLockComponent = async (exam_scheme_id) => {
    const confirm = await Swal.fire({
      title: "Lock Marks Entry?",
      text: "You won't be able to edit this component unless unlocked by Exam Head.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Lock it!",
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.patch(`/exam-schemes/${exam_scheme_id}/lock`, {
        is_locked: true,
      });

      Swal.fire("Locked!", "This component is now locked.", "success");
      fetchMarksEntryData();
    } catch (err) {
      console.error("Lock component error:", err);
      Swal.fire("Error", "Failed to lock component", "error");
    }
  };

  const selectedClass = classExamSubjects.find(
    (c) => c.class_id === parseInt(filters.class_id)
  );
  const selectedSection = sections.find(
    (s) => s.id === parseInt(filters.section_id)
  );
  const selectedExam = exams.find(
    (e) => e.exam_id === parseInt(filters.exam_id)
  );
  const isExamLocked = selectedExam?.is_locked;
  const selectedSubject = subjects.find(
    (s) => s.id === parseInt(filters.subject_id)
  );

  // ✅ UPDATED: percentage based on max marks (per student, only PRESENT components counted)
  const stats = useMemo(() => {
    const buckets = { "90+": 0, "80-89": 0, "70-79": 0, "60-69": 0, "<60": 0 };
    let absentAny = 0;

    if (!students.length || !components.length) {
      return {
        buckets,
        absentAny,
        total: 0,
        classAvgPct: 0,
        details: [],
      };
    }

    let totalPctSum = 0;
    let totalPctCount = 0;

    const details = students.map((st) => {
      let obtained = 0;
      let maxEligible = 0;
      let anyAbsent = false;

      components.forEach((comp) => {
        const key = `${st.id}_${comp.component_id}`;
        const att = attendance[key] || "P";
        const compMax = Number(comp.max_marks || 0);

        if (att !== "P") {
          anyAbsent = true;
          return; // ✅ do not count this component in denominator
        }

        maxEligible += compMax;

        const n = Number(marks[key]);
        obtained += Number.isFinite(n) ? n : 0;
      });

      if (anyAbsent) absentAny += 1;

      const pct = maxEligible > 0 ? (obtained / maxEligible) * 100 : 0;

      if (pct >= 90) buckets["90+"] += 1;
      else if (pct >= 80) buckets["80-89"] += 1;
      else if (pct >= 70) buckets["70-79"] += 1;
      else if (pct >= 60) buckets["60-69"] += 1;
      else buckets["<60"] += 1;

      totalPctSum += pct;
      totalPctCount += 1;

      return {
        student_id: st.id,
        name: st.name,
        roll_number: st.roll_number,
        obtained,
        maxEligible,
        pct,
        anyAbsent,
      };
    });

    const classAvgPct = totalPctCount > 0 ? totalPctSum / totalPctCount : 0;

    return {
      buckets,
      absentAny,
      total: students.length,
      classAvgPct,
      details,
    };
  }, [students, components, marks, attendance]);

  return (
    <div className="container mt-4">
      <h2>📝 Marks Entry</h2>

      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter</h5>
          <div className="row">
            <div className="col-md-3 mb-3">
              <label>Class</label>
              <select
                className="form-control"
                value={filters.class_id}
                onChange={handleClassChange}
              >
                <option value="">Select Class</option>
                {classExamSubjects.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 mb-3">
              <label>Section</label>
              <select
                className="form-control"
                name="section_id"
                value={filters.section_id}
                onChange={handleFilterChange}
              >
                <option value="">Select Section</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.section_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 mb-3">
              <label>Exam</label>
              <select
                className="form-control"
                value={filters.exam_id}
                onChange={handleExamChange}
              >
                <option value="">Select Exam</option>
                {exams.map((e) => (
                  <option key={e.exam_id} value={e.exam_id}>
                    {e.exam_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 mb-3">
              <label>Subject</label>
              <select
                className="form-control"
                name="subject_id"
                value={filters.subject_id}
                onChange={handleFilterChange}
              >
                <option value="">Select Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {selectedClass && selectedSection && selectedExam && selectedSubject && (
        <div className="alert alert-info">
          <strong>Selected Details:</strong>
          <br />
          Class: <strong>{selectedClass.class_name}</strong> &nbsp;|&nbsp;
          Section: <strong>{selectedSection.section_name}</strong> &nbsp;|&nbsp;
          Exam: <strong>{selectedExam.exam_name}</strong> &nbsp;|&nbsp;
          Subject: <strong>{selectedSubject.name}</strong>
        </div>
      )}

      {isExamLocked && (
        <div className="alert alert-danger">
          <strong>This exam is locked.</strong> You cannot enter or modify marks.
        </div>
      )}

      {components.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Marks Entry Table</h5>

            <div className="d-flex gap-3 mb-3 flex-wrap">
              <button
                className="btn btn-success"
                onClick={handleSaveMarks}
                disabled={
                  isExamLocked || students.length === 0 || components.length === 0
                }
              >
                💾 Save Marks
              </button>

              <button
                className="btn btn-outline-primary"
                onClick={handleExportExcel}
                disabled={isExamLocked}
              >
                ⬇️ Export Excel
              </button>

              <button
                className="btn btn-outline-dark"
                onClick={handleExportPDF}
                disabled={isExamLocked}
              >
                🖨️ Export PDF
              </button>

              <label className="btn btn-outline-secondary mb-0">
                ⬆️ Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  style={{ display: "none" }}
                  disabled={isExamLocked}
                />
              </label>

              <button
                className="btn btn-outline-info"
                onClick={() => setShowStats(true)}
                disabled={students.length === 0 || components.length === 0}
              >
                📊 Statistics
              </button>
            </div>

            <div
              className="table-responsive"
              style={{ maxHeight: "500px", overflowY: "auto" }}
            >
              <table className="table table-bordered table-striped">
                <thead
                  className="table-light"
                  style={{ position: "sticky", top: 0, zIndex: 1 }}
                >
                  <tr>
                    <th rowSpan="2">Roll No</th>
                    <th rowSpan="2">Name</th>
                    {components.map((comp) => (
                      <th
                        key={comp.component_id}
                        colSpan="2"
                        className="text-center"
                      >
                        <div>{comp.abbreviation || comp.name}</div>
                        <div>
                          {comp.is_locked ? (
                            <span className="text-danger small">🔒 Locked</span>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-warning mt-1"
                              onClick={() =>
                                handleLockComponent(comp.exam_scheme_id)
                              }
                            >
                              🔐 Lock
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {components.map((comp) => (
                      <React.Fragment key={comp.component_id}>
                        <th>Attd.</th>
                        <th>Marks</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2 + components.length * 2}
                        className="text-center text-muted"
                      >
                        No students found for this selection.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr
                        key={student.id}
                        className={
                          activeStudentId === student.id ? "table-primary" : ""
                        }
                      >
                        <td>{student.roll_number}</td>
                        <td>{student.name}</td>

                        {components.map((comp) => {
                          const key = `${student.id}_${comp.component_id}`;

                          const hasKey = Object.prototype.hasOwnProperty.call(
                            marks,
                            key
                          );
                          const value =
                            hasKey &&
                            marks[key] !== null &&
                            marks[key] !== undefined
                              ? marks[key]
                              : "";

                          const att = attendance[key] || "P";
                          const isInvalid =
                            value !== "" &&
                            !isNaN(parseFloat(value)) &&
                            parseFloat(value) > comp.max_marks;

                          return (
                            <React.Fragment key={key}>
                              <td
                                className={
                                  comp.is_locked ? "bg-light text-muted" : ""
                                }
                              >
                                <select
                                  className="form-select"
                                  value={att}
                                  disabled={comp.is_locked}
                                  onChange={(e) =>
                                    handleAttendanceChange(
                                      student.id,
                                      comp.component_id,
                                      e.target.value
                                    )
                                  }
                                >
                                  {["P", "A", "L", "ACT", "LA", "ML", "X"].map(
                                    (opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    )
                                  )}
                                </select>
                              </td>

                              <td
                                className={
                                  comp.is_locked ? "bg-light text-muted" : ""
                                }
                              >
                                <input
                                  type="number"
                                  autoComplete="off"
                                  className={`form-control ${
                                    isInvalid ? "is-invalid" : ""
                                  }`}
                                  value={value}
                                  onChange={(e) =>
                                    handleMarksChange(
                                      student.id,
                                      comp.component_id,
                                      e.target.value
                                    )
                                  }
                                  disabled={att !== "P" || comp.is_locked}
                                  min="0"
                                  max={comp.max_marks}
                                  ref={(el) => {
                                    if (el) inputRefs.current[key] = el;
                                  }}
                                  onFocus={(e) => {
                                    setActiveStudentId(student.id);
                                    e.target.select();
                                  }}
                                  onKeyDown={(e) => {
                                    const currentStudentIndex = students.findIndex(
                                      (s) => s.id === student.id
                                    );
                                    const currentCompIndex = components.findIndex(
                                      (c) => c.component_id === comp.component_id
                                    );

                                    let nextKey = null;

                                    if (e.key === "Enter" || e.key === "ArrowDown") {
                                      e.preventDefault();
                                      const nextStudent = students[currentStudentIndex + 1];
                                      if (nextStudent)
                                        nextKey = `${nextStudent.id}_${comp.component_id}`;
                                      else
                                        Swal.fire("Info", "Reached last student", "info");
                                    }

                                    if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      const prevStudent = students[currentStudentIndex - 1];
                                      if (prevStudent)
                                        nextKey = `${prevStudent.id}_${comp.component_id}`;
                                    }

                                    if (e.key === "ArrowRight") {
                                      e.preventDefault();
                                      const nextComp = components[currentCompIndex + 1];
                                      if (nextComp)
                                        nextKey = `${student.id}_${nextComp.component_id}`;
                                    }

                                    if (e.key === "ArrowLeft") {
                                      e.preventDefault();
                                      const prevComp = components[currentCompIndex - 1];
                                      if (prevComp)
                                        nextKey = `${student.id}_${prevComp.component_id}`;
                                    }

                                    if (nextKey && inputRefs.current[nextKey]) {
                                      inputRefs.current[nextKey].focus();
                                    }
                                  }}
                                />

                                {isInvalid && (
                                  <div className="invalid-feedback">
                                    Max: {comp.max_marks}
                                  </div>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ✅ Stats Modal */}
            {showStats && (
              <div
                className="position-fixed top-0 start-0 w-100 h-100"
                style={{ background: "rgba(0,0,0,0.5)", zIndex: 9999 }}
                onClick={() => setShowStats(false)}
              >
                <div
                  className="bg-white rounded shadow p-3 p-md-4"
                  style={{
                    width: "min(800px, 95vw)",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    margin: "5vh auto",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div>
                      <h4 className="mb-0">📊 Marks Statistics</h4>
                      <div className="text-muted small">
                        Percentage is calculated per-student using only <b>Present (P)</b>{" "}
                        components’ max marks.
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setShowStats(false)}
                    >
                      ✖ Close
                    </button>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-6 col-md-3">
                      <div className="card">
                        <div className="card-body">
                          <div className="text-muted small">Total Students</div>
                          <div className="h4 mb-0">{stats.total}</div>
                        </div>
                      </div>
                    </div>

                    <div className="col-6 col-md-3">
                      <div className="card">
                        <div className="card-body">
                          <div className="text-muted small">Class Avg %</div>
                          <div className="h4 mb-0">{stats.classAvgPct.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="col-6 col-md-3">
                      <div className="card">
                        <div className="card-body">
                          <div className="text-muted small">90+</div>
                          <div className="h4 mb-0">{stats.buckets["90+"]}</div>
                        </div>
                      </div>
                    </div>

                    <div className="col-6 col-md-3">
                      <div className="card">
                        <div className="card-body">
                          <div className="text-muted small">Absent (any)</div>
                          <div className="h4 mb-0">{stats.absentAny}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <table className="table table-sm table-bordered mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>Range</th>
                        <th>Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["90+", "80-89", "70-79", "60-69", "<60"].map((k) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td>{stats.buckets[k]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="text-muted small mb-2">
                    * If student is absent in any component, that component is <b>excluded</b> from denominator.
                  </div>

                  {/* Optional: Top/Bottom quick view */}
                  {stats.details?.length ? (
                    <div className="mt-3">
                      <h6 className="mb-2">Quick % List (Top 10)</h6>
                      <div className="table-responsive">
                        <table className="table table-sm table-striped table-bordered">
                          <thead className="table-light">
                            <tr>
                              <th>Roll</th>
                              <th>Name</th>
                              <th>Obtained</th>
                              <th>Max Eligible</th>
                              <th>%</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...stats.details]
                              .sort((a, b) => (b.pct || 0) - (a.pct || 0))
                              .slice(0, 10)
                              .map((d) => (
                                <tr key={d.student_id}>
                                  <td>{d.roll_number}</td>
                                  <td>{d.name}</td>
                                  <td>{d.obtained}</td>
                                  <td>{d.maxEligible}</td>
                                  <td>{Number(d.pct || 0).toFixed(2)}%</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarksEntry;
