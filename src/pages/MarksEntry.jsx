// src/pages/MarksEntry.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

/* =========================
 * Helpers
 * ========================= */
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];
  const keys = [
    "data",
    "rows",
    "results",
    "items",
    "list",
    "records",
    "students",
    "components",
    "grades",
    "grade_options",
    "gradeOptions",
    "allowedGrades",
  ];
  for (const k of keys) {
    if (Array.isArray(d?.[k])) return d[k];
  }
  return [];
};

const upper = (v) => String(v || "").trim().toUpperCase();
const safeMode = (m) => (upper(m) === "GRADE" ? "GRADE" : "MARKS");

const attendanceOptions = ["P", "A", "L", "ACT", "LA", "ML", "X"];

// ✅ Better error message extractor (shows unauthorized clearly)
const getApiErrorMessage = (err, fallback = "Something went wrong") => {
  const status = err?.response?.status;
  const data = err?.response?.data;

  const serverMsg =
    data?.message ||
    data?.error ||
    data?.details ||
    (typeof data === "string" ? data : "") ||
    err?.message;

  if (status === 401) {
    return (
      serverMsg ||
      "Unauthorized (401). Please login again and try."
    );
  }
  if (status === 403) {
    return (
      serverMsg ||
      "Forbidden (403). You do not have permission for this class/section."
    );
  }

  return serverMsg || fallback;
};

const showApiError = (title, err, fallback) => {
  const status = err?.response?.status;
  const msg = getApiErrorMessage(err, fallback);

  Swal.fire({
    icon: "error",
    title: title || "Error",
    html: `
      <div style="text-align:left">
        <div style="font-weight:600;margin-bottom:6px;">${msg}</div>
        ${
          status
            ? `<div style="opacity:0.8;font-size:12px;">Status: <b>${status}</b></div>`
            : ""
        }
      </div>
    `,
  });
};

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

  // MARKS mode
  const [marks, setMarks] = useState({});
  const [attendance, setAttendance] = useState({});

  // ✅ evaluation mode + grade mode
  const [evaluationMode, setEvaluationMode] = useState("MARKS"); // MARKS | GRADE
  const [gradeOptions, setGradeOptions] = useState([]); // can be string[] OR object[]
  const [gradeValues, setGradeValues] = useState({}); // { [student_id]: grade_string }
  const [gradeAttendance, setGradeAttendance] = useState({}); // { [student_id]: "P"|"A"|... }

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

    // grade mode
    setEvaluationMode("MARKS");
    setGradeOptions([]);
    setGradeValues({});
    setGradeAttendance({});
  };

  useEffect(() => {
    loadClassExamSubjects();
    loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setClassExamSubjects(asArray(res.data));
    } catch (err) {
      showApiError("Error", err, "Failed to load class-exam-subject data");
    }
  };

  const loadSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(asArray(res.data));
    } catch (err) {
      showApiError("Error", err, "Failed to load sections");
    }
  };

  const handleClassChange = (e) => {
    const class_id = e.target.value;
    setFilters({ class_id, section_id: "", exam_id: "", subject_id: "" });

    const selectedClass = asArray(classExamSubjects).find(
      (c) => Number(c.class_id) === Number(class_id)
    );
    setExams(asArray(selectedClass?.exams));
    setSubjects([]);
    resetMarksData();
  };

  const handleExamChange = (e) => {
    const exam_id = e.target.value;
    setFilters((prev) => ({ ...prev, exam_id, subject_id: "" }));

    const selectedClass = asArray(classExamSubjects).find(
      (c) => Number(c.class_id) === Number(filters.class_id)
    );
    const selectedExam = asArray(selectedClass?.exams).find(
      (ex) => Number(ex.exam_id) === Number(exam_id)
    );
    setSubjects(asArray(selectedExam?.subjects));
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

      const modeRaw =
        res?.data?.evaluation_mode ?? res?.data?.mode ?? res?.data?.subject_mode;
      const mode = safeMode(modeRaw);
      setEvaluationMode(mode);

      const fetchedStudents = asArray(res?.data?.students);
      const fetchedComponents = asArray(res?.data?.components);

      setStudents(fetchedStudents);
      setComponents(fetchedComponents);
      setExamScheduleId(
        res?.data?.exam_schedule_id || res?.data?.examScheduleId || null
      );

      // grade options: backend can return string[] (allowedGrades) or object[]
      const opts =
        asArray(res?.data?.grade_options) ||
        asArray(res?.data?.gradeOptions) ||
        asArray(res?.data?.grades) ||
        asArray(res?.data?.allowedGrades);

      setGradeOptions(asArray(opts));

      const resultMap = res?.data?.resultMap || {};

      // Prefill marks/attendance
      const prefillMarks = {};
      const preAttendance = {};

      // Prefill grades + grade attendance (per student)
      // ✅ After backend change, grade results come as student_component keys.
      // We'll take the first grade/attendance seen per student.
      const preGrades = {};
      const preGradeAtt = {};

      Object.entries(resultMap).forEach(([key, val]) => {
        const parts = String(key).split("_");
        if (parts.length >= 2) {
          const sid = String(parts[0] || "");
          const cid = String(parts[1] || "");

          // MARKS map (sid_component)
          if (sid && cid && cid !== "G") {
            const m = val?.marks ?? val?.marks_obtained ?? val?.marksObtained ?? null;
            prefillMarks[key] = m === null || m === undefined ? "" : m;
            preAttendance[key] = val?.attendance || "P";
          }

          // GRADE: pick first found per student (grade saved per component in backend)
          if (sid) {
            if (preGrades[sid] == null) {
              const g =
                val?.grade ??
                val?.grade_name ??
                val?.gradeName ??
                val?.grade_label ??
                "";
              if (g !== "" && g != null) preGrades[sid] = String(g).trim().toUpperCase();
              else if (val?.grade_id || val?.gradeId) {
                preGrades[sid] = String(val.grade_id ?? val.gradeId);
              }
            }
            if (preGradeAtt[sid] == null && val?.attendance) {
              preGradeAtt[sid] = upper(val.attendance) || "P";
            }
          }
          return;
        }

        // If backend ever sends { [studentId]: { grade, attendance } } (older)
        const sidOnly = String(key || "");
        if (sidOnly) {
          const g =
            val?.grade ??
            val?.grade_name ??
            val?.gradeName ??
            val?.grade_label ??
            "";
          if (g !== "" && g != null) preGrades[sidOnly] = String(g).trim().toUpperCase();
          else if (val?.grade_id || val?.gradeId) {
            preGrades[sidOnly] = String(val.grade_id ?? val.gradeId);
          }
          if (val?.attendance) preGradeAtt[sidOnly] = upper(val.attendance) || "P";
        }
      });

      setMarks(prefillMarks);
      setAttendance(preAttendance);

      setGradeValues(preGrades);
      setGradeAttendance(preGradeAtt);
    } catch (err) {
      console.error("Error loading marks entry:", err);
      showApiError("Error", err, "Failed to load marks/grade entry data");
    }
  };

  /* =========================
   * MARKS mode handlers
   * ========================= */
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
      components.find((c) => Number(c.component_id) === Number(component_id))
        ?.max_marks || 100;

    if (!isNaN(num) && num > Number(max)) {
      Swal.fire("Invalid Marks", `Marks cannot exceed maximum of ${max}`, "warning");
      return;
    }

    setMarks((prev) => ({
      ...prev,
      [key]: value === "" || isNaN(num) ? "" : num,
    }));
  };

  /* =========================
   * GRADE mode handlers
   * ========================= */
  const handleGradeChange = (student_id, value) => {
    setGradeValues((prev) => ({ ...prev, [String(student_id)]: value }));
  };

  const handleGradeAttendanceChange = (student_id, value) => {
    setGradeAttendance((prev) => ({ ...prev, [String(student_id)]: value }));
  };

  /* =========================
   * Save (MARKS or GRADE)
   * ========================= */
  const handleSave = async () => {
    if (!examScheduleId) {
      return Swal.fire("Error", "Exam Schedule ID not found", "error");
    }

    try {
      if (evaluationMode === "GRADE") {
        // ✅ IMPORTANT: Backend stores grade PER COMPONENT (StudentExamResult)
        // So we repeat same grade/attendance for each component in scheme.
        const marksData = [];

        students.forEach((st) => {
          const sid = String(st.id);
          const g = gradeValues[sid] ?? "";
          const att = gradeAttendance[sid] ?? "P";

          components.forEach((comp) => {
            marksData.push({
              student_id: st.id,
              component_id: comp.component_id, // ✅ REQUIRED
              grade: g ? String(g).trim().toUpperCase() : null,
              attendance: upper(att) || "P",
              marks_obtained: null, // optional
            });
          });
        });

        await api.post("/marks-entry/save", {
          exam_schedule_id: examScheduleId,
          marksData,
        });

        Swal.fire("Success", "Grades saved successfully", "success");
        fetchMarksEntryData();
        return;
      }

      // MARKS mode
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

      await api.post("/marks-entry/save", {
        exam_schedule_id: examScheduleId,
        marksData,
      });

      Swal.fire("Success", "Marks saved successfully", "success");
      fetchMarksEntryData();
    } catch (err) {
      console.error("Save error:", err);
      showApiError(
        "Error",
        err,
        `Failed to save ${evaluationMode === "GRADE" ? "grades" : "marks"}`
      );
    }
  };

  /* =========================
   * Export / Import
   * ========================= */
  const handleExportExcel = async () => {
    const { class_id, section_id, exam_id, subject_id } = filters;
    try {
      const response = await api.get("/marks-entry/export", {
        params: { class_id, section_id, exam_id, subject_id, mode: evaluationMode },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `marks-entry-${evaluationMode.toLowerCase()}-${Date.now()}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export Excel error:", err);
      showApiError("Error", err, "Failed to export Excel");
    }
  };

  const handleExportPDF = async () => {
    const { class_id, section_id, exam_id, subject_id } = filters;
    try {
      const response = await api.get("/marks-entry/export-pdf", {
        params: { class_id, section_id, exam_id, subject_id, mode: evaluationMode },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `marks-entry-${evaluationMode.toLowerCase()}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => window.URL.revokeObjectURL(url), 1500);
    } catch (err) {
      console.error("Export PDF error:", err);
      showApiError("Error", err, "Failed to export PDF");
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file || !examScheduleId) {
      return Swal.fire("Error", "Please select a file and valid schedule", "error");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("exam_schedule_id", examScheduleId);
    formData.append("mode", evaluationMode); // backend can ignore; safe

    try {
      const res = await api.post("/marks-entry/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire(
        "Success",
        `Imported successfully${
          res.data?.rowsProcessed ? ` (rows processed: ${res.data.rowsProcessed})` : ""
        }`,
        "success"
      );
      fetchMarksEntryData();
      e.target.value = null;
    } catch (err) {
      console.error("Import Excel error:", err);
      showApiError("Error", err, "Failed to import Excel");
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
      showApiError("Error", err, "Failed to lock component");
    }
  };

  /* =========================
   * Selected helpers
   * ========================= */
  const selectedClass = asArray(classExamSubjects).find(
    (c) => Number(c.class_id) === Number(filters.class_id)
  );
  const selectedSection = asArray(sections).find(
    (s) => Number(s.id) === Number(filters.section_id)
  );
  const selectedExam = asArray(exams).find(
    (e) => Number(e.exam_id) === Number(filters.exam_id)
  );
  const isExamLocked = selectedExam?.is_locked;
  const selectedSubject = asArray(subjects).find(
    (s) => Number(s.id) === Number(filters.subject_id)
  );

  const showSelectedBanner =
    selectedClass && selectedSection && selectedExam && selectedSubject;

  /* =========================
   * Grade options normalized
   * ========================= */
  const gradeOptionsNormalized = useMemo(() => {
    const arr = asArray(gradeOptions);

    // If backend returns string[] like ["A1","A2",...]
    if (arr.length && typeof arr[0] === "string") {
      return arr
        .map((g) => String(g).trim().toUpperCase())
        .filter(Boolean)
        .map((g) => ({ value: g, label: g }));
    }

    // If backend returns objects
    return arr
      .map((g) => {
        const grade = (g.grade || g.abbreviation || g.name || "").toString().trim();
        const label =
          g.abbreviation && g.name ? `${g.abbreviation} - ${g.name}` : grade || g.name || "";
        const value = grade ? grade.toUpperCase() : "";
        return value ? { value, label: label || value } : null;
      })
      .filter(Boolean);
  }, [gradeOptions]);

  /* =========================
   * Stats (MARKS only)
   * ========================= */
  const stats = useMemo(() => {
    const buckets = { "90+": 0, "80-89": 0, "70-79": 0, "60-69": 0, "<60": 0 };
    let absentAny = 0;

    if (evaluationMode === "GRADE" || !students.length || !components.length) {
      return { buckets, absentAny, total: students.length || 0, classAvgPct: 0, details: [] };
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
          return;
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
  }, [evaluationMode, students, components, marks, attendance]);

  return (
    <div className="container mt-4">
      <h2>📝 Marks / Grade Entry</h2>

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
                {asArray(classExamSubjects).map((c) => (
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
                {asArray(sections).map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.section_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 mb-3">
              <label>Exam</label>
              <select className="form-control" value={filters.exam_id} onChange={handleExamChange}>
                <option value="">Select Exam</option>
                {asArray(exams).map((e) => (
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
                {asArray(subjects).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {showSelectedBanner && (
        <div className={`alert ${evaluationMode === "GRADE" ? "alert-warning" : "alert-info"}`}>
          <strong>Selected Details:</strong>
          <br />
          Class: <strong>{selectedClass.class_name}</strong> &nbsp;|&nbsp;
          Section: <strong>{selectedSection.section_name}</strong> &nbsp;|&nbsp;
          Exam: <strong>{selectedExam.exam_name}</strong> &nbsp;|&nbsp;
          Subject: <strong>{selectedSubject.name}</strong>
          <br />
          Mode: <strong>{evaluationMode === "GRADE" ? "GRADE ONLY" : "MARKS"}</strong>
        </div>
      )}

      {isExamLocked && (
        <div className="alert alert-danger">
          <strong>This exam is locked.</strong> You cannot enter or modify data.
        </div>
      )}

      {/* =========================
          Action Bar
         ========================= */}
      {showSelectedBanner && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="d-flex gap-3 flex-wrap align-items-center">
              <button
                className="btn btn-success"
                onClick={handleSave}
                disabled={isExamLocked || students.length === 0}
              >
                💾 Save {evaluationMode === "GRADE" ? "Grades" : "Marks"}
              </button>

              <button
                className="btn btn-outline-primary"
                onClick={handleExportExcel}
                disabled={isExamLocked || students.length === 0}
                title="Exports will include the current mode"
              >
                ⬇️ Export Excel
              </button>

              <button
                className="btn btn-outline-dark"
                onClick={handleExportPDF}
                disabled={isExamLocked || students.length === 0}
                title="Exports will include the current mode"
              >
                🖨️ Export PDF
              </button>

              <label className={`btn btn-outline-secondary mb-0 ${isExamLocked ? "disabled" : ""}`}>
                ⬆️ Import Excel
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImportExcel}
                  style={{ display: "none" }}
                  disabled={isExamLocked}
                />
              </label>

              {evaluationMode !== "GRADE" && (
                <button
                  className="btn btn-outline-info"
                  onClick={() => setShowStats(true)}
                  disabled={students.length === 0 || components.length === 0}
                >
                  📊 Statistics
                </button>
              )}
            </div>

            {evaluationMode === "GRADE" && (
              <div className="text-muted small mt-2">
                * This subject is configured as <b>GRADE-only</b>. Marks components are not applicable.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================
          GRADE MODE UI
         ========================= */}
      {evaluationMode === "GRADE" && students.length > 0 && showSelectedBanner && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Grade Entry</h5>

            {(!gradeOptionsNormalized || gradeOptionsNormalized.length === 0) && (
              <div className="alert alert-danger">
                <b>Grade options not found.</b> Backend should return{" "}
                <code>allowedGrades</code> (string array) OR <code>grade_options</code>.
              </div>
            )}

            <div className="table-responsive" style={{ maxHeight: "520px", overflowY: "auto" }}>
              <table className="table table-bordered table-striped">
                <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ width: 110 }}>Roll No</th>
                    <th>Name</th>
                    <th style={{ width: 120 }}>Attd.</th>
                    <th style={{ width: 220 }}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st) => {
                    const sid = String(st.id);
                    const currentGrade = gradeValues[sid] ?? "";
                    const currentAtt = gradeAttendance[sid] ?? "P";

                    return (
                      <tr key={st.id}>
                        <td>{st.roll_number}</td>
                        <td>{st.name}</td>

                        <td>
                          <select
                            className="form-select"
                            value={currentAtt}
                            onChange={(e) => handleGradeAttendanceChange(st.id, e.target.value)}
                            disabled={isExamLocked}
                          >
                            {attendanceOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <select
                            className="form-select"
                            value={String(currentGrade)}
                            onChange={(e) => handleGradeChange(st.id, e.target.value)}
                            disabled={isExamLocked}
                          >
                            <option value="">Select Grade</option>
                            {gradeOptionsNormalized.map((g) => (
                              <option key={g.value} value={g.value}>
                                {g.label}
                              </option>
                            ))}
                          </select>
                          <div className="text-muted small mt-1">
                            Saved as <b>grade string</b> (A1/A2/B1…)
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-muted small mt-2">
              Note: Grade is saved per component in backend (same grade repeated across all scheme components).
            </div>
          </div>
        </div>
      )}

      {/* =========================
          MARKS MODE UI
         ========================= */}
      {evaluationMode !== "GRADE" && components.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">Marks Entry Table</h5>

            <div className="table-responsive" style={{ maxHeight: "520px", overflowY: "auto" }}>
              <table className="table table-bordered table-striped">
                <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th rowSpan="2">Roll No</th>
                    <th rowSpan="2">Name</th>
                    {components.map((comp) => (
                      <th key={comp.component_id} colSpan="2" className="text-center">
                        <div>{comp.abbreviation || comp.name}</div>
                        <div className="small text-muted">Max: {comp.max_marks}</div>
                        <div>
                          {comp.is_locked ? (
                            <span className="text-danger small">🔒 Locked</span>
                          ) : (
                            <button
                              className="btn btn-sm btn-outline-warning mt-1"
                              onClick={() => handleLockComponent(comp.exam_scheme_id)}
                              disabled={isExamLocked}
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
                      <td colSpan={2 + components.length * 2} className="text-center text-muted">
                        No students found for this selection.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr
                        key={student.id}
                        className={activeStudentId === student.id ? "table-primary" : ""}
                      >
                        <td>{student.roll_number}</td>
                        <td>{student.name}</td>

                        {components.map((comp) => {
                          const key = `${student.id}_${comp.component_id}`;

                          const hasKey = Object.prototype.hasOwnProperty.call(marks, key);
                          const value =
                            hasKey && marks[key] !== null && marks[key] !== undefined
                              ? marks[key]
                              : "";

                          const att = attendance[key] || "P";
                          const isInvalid =
                            value !== "" &&
                            !isNaN(parseFloat(value)) &&
                            parseFloat(value) > Number(comp.max_marks);

                          return (
                            <React.Fragment key={key}>
                              <td className={comp.is_locked ? "bg-light text-muted" : ""}>
                                <select
                                  className="form-select"
                                  value={att}
                                  disabled={comp.is_locked || isExamLocked}
                                  onChange={(e) =>
                                    handleAttendanceChange(
                                      student.id,
                                      comp.component_id,
                                      e.target.value
                                    )
                                  }
                                >
                                  {attendanceOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className={comp.is_locked ? "bg-light text-muted" : ""}>
                                <input
                                  type="number"
                                  autoComplete="off"
                                  className={`form-control ${isInvalid ? "is-invalid" : ""}`}
                                  value={value}
                                  onChange={(e) =>
                                    handleMarksChange(student.id, comp.component_id, e.target.value)
                                  }
                                  disabled={att !== "P" || comp.is_locked || isExamLocked}
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
                                      if (nextStudent) nextKey = `${nextStudent.id}_${comp.component_id}`;
                                      else Swal.fire("Info", "Reached last student", "info");
                                    }

                                    if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      const prevStudent = students[currentStudentIndex - 1];
                                      if (prevStudent) nextKey = `${prevStudent.id}_${comp.component_id}`;
                                    }

                                    if (e.key === "ArrowRight") {
                                      e.preventDefault();
                                      const nextComp = components[currentCompIndex + 1];
                                      if (nextComp) nextKey = `${student.id}_${nextComp.component_id}`;
                                    }

                                    if (e.key === "ArrowLeft") {
                                      e.preventDefault();
                                      const prevComp = components[currentCompIndex - 1];
                                      if (prevComp) nextKey = `${student.id}_${prevComp.component_id}`;
                                    }

                                    if (nextKey && inputRefs.current[nextKey]) {
                                      inputRefs.current[nextKey].focus();
                                    }
                                  }}
                                />

                                {isInvalid && (
                                  <div className="invalid-feedback">Max: {comp.max_marks}</div>
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

            {/* ✅ Stats Modal (MARKS only) */}
            {showStats && evaluationMode !== "GRADE" && (
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

      {/* If subject selected but no components and not grade -> show hint */}
      {showSelectedBanner && evaluationMode !== "GRADE" && components.length === 0 && (
        <div className="alert alert-warning">
          <b>No components found</b> for this selection. Please check Exam Scheme for this subject/term.
        </div>
      )}
    </div>
  );
};

export default MarksEntry;