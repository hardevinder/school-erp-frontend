// src/pages/MarksEntry.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
    "sessions",
  ];
  for (const k of keys) {
    if (Array.isArray(d?.[k])) return d[k];
  }
  return [];
};

const upper = (v) => String(v || "").trim().toUpperCase();
const safeMode = (m) => (upper(m) === "GRADE" ? "GRADE" : "MARKS");

const attendanceOptions = ["P", "A", "L", "ACT", "LA", "ML", "X"];

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
    return serverMsg || "Unauthorized (401). Please login again and try.";
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

const getGradeLabel = (g) => {
  if (typeof g === "string") return g;
  if (g && typeof g === "object") {
    return g.grade ?? g.name ?? g.label ?? g.title ?? "";
  }
  return "";
};

const MarksEntry = () => {
  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    exam_id: "",
    subject_id: "",
  });

  const [sessions, setSessions] = useState([]);
  const [classExamSubjects, setClassExamSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);

  const [students, setStudents] = useState([]);
  const [components, setComponents] = useState([]);

  const [marks, setMarks] = useState({});
  const [attendance, setAttendance] = useState({});

  const [evaluationMode, setEvaluationMode] = useState("MARKS");
  const [gradeOptions, setGradeOptions] = useState([]);
  const [gradeValues, setGradeValues] = useState({});
  const [gradeAttendance, setGradeAttendance] = useState({});

  const [examScheduleId, setExamScheduleId] = useState(null);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef({});

  const resetMarksData = () => {
    setStudents([]);
    setComponents([]);
    setMarks({});
    setAttendance({});
    setExamScheduleId(null);
    setActiveStudentId(null);

    setEvaluationMode("MARKS");
    setGradeOptions([]);
    setGradeValues({});
    setGradeAttendance({});
  };

  useEffect(() => {
    loadSessions();
    loadClassExamSubjects();
    loadSections();
  }, []);

  useEffect(() => {
    const { session_id, class_id, section_id, exam_id, subject_id } = filters;
    if (session_id && class_id && section_id && exam_id && subject_id) {
      fetchMarksEntryData();
    } else {
      resetMarksData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const rows = asArray(res.data);
      setSessions(rows);

      if (rows.length > 0) {
        const active =
          rows.find(
            (s) =>
              s?.is_current === true ||
              s?.isCurrent === true ||
              s?.current === true ||
              s?.status === "active"
          ) || rows[0];

        const defaultSessionId = String(
          active?.id ?? active?.session_id ?? active?.Session_ID ?? ""
        );

        if (defaultSessionId) {
          setFilters((prev) => ({
            ...prev,
            session_id: prev.session_id || defaultSessionId,
          }));
        }
      }
    } catch (err) {
      showApiError("Error", err, "Failed to load sessions");
    }
  };

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

  const handleSessionChange = (e) => {
    const session_id = e.target.value;
    setFilters({
      session_id,
      class_id: "",
      section_id: "",
      exam_id: "",
      subject_id: "",
    });
    setExams([]);
    setSubjects([]);
    resetMarksData();
  };

  const handleClassChange = (e) => {
    const class_id = e.target.value;

    setFilters((prev) => ({
      ...prev,
      class_id,
      section_id: "",
      exam_id: "",
      subject_id: "",
    }));

    const selectedClass = asArray(classExamSubjects).find(
      (c) => Number(c.class_id) === Number(class_id)
    );

    setExams(asArray(selectedClass?.exams));
    setSubjects([]);
    resetMarksData();
  };

  const handleExamChange = (e) => {
    const exam_id = e.target.value;

    setFilters((prev) => ({
      ...prev,
      exam_id,
      subject_id: "",
    }));

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

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));

    resetMarksData();
  };

  const fetchMarksEntryData = async () => {
    const { session_id, class_id, section_id, exam_id, subject_id } = filters;

    try {
      setLoading(true);

      const res = await api.get("/marks-entry", {
        params: { session_id, class_id, section_id, exam_id, subject_id },
      });

      const modeRaw =
        res?.data?.evaluation_mode ??
        res?.data?.mode ??
        res?.data?.subject_mode;
      const mode = safeMode(modeRaw);
      setEvaluationMode(mode);

      const fetchedStudents = asArray(res?.data?.students);
      const fetchedComponents = asArray(res?.data?.components);

      setStudents(fetchedStudents);
      setComponents(fetchedComponents);
      setExamScheduleId(
        res?.data?.exam_schedule_id || res?.data?.examScheduleId || null
      );

      const opts =
        asArray(res?.data?.grade_options).length > 0
          ? asArray(res?.data?.grade_options)
          : asArray(res?.data?.gradeOptions).length > 0
          ? asArray(res?.data?.gradeOptions)
          : asArray(res?.data?.grades).length > 0
          ? asArray(res?.data?.grades)
          : asArray(res?.data?.allowedGrades);

      setGradeOptions(opts);

      const resultMap = res?.data?.resultMap || {};

      const prefillMarks = {};
      const preAttendance = {};
      const preGrades = {};
      const preGradeAtt = {};

      Object.entries(resultMap).forEach(([key, val]) => {
        const parts = String(key).split("_");
        if (parts.length >= 2) {
          const sid = String(parts[0] || "");
          const cid = String(parts[1] || "");

          if (sid && cid) {
            const m =
              val?.marks ??
              val?.marks_obtained ??
              val?.marksObtained ??
              null;

            prefillMarks[key] = m === null || m === undefined ? "" : m;
            preAttendance[key] = val?.attendance || "P";

            if (preGrades[sid] == null) {
              const g = val?.grade ?? "";
              preGrades[sid] = g || "";
            }

            if (preGradeAtt[sid] == null) {
              preGradeAtt[sid] = val?.attendance || "P";
            }
          }
        }
      });

      setMarks(prefillMarks);
      setAttendance(preAttendance);
      setGradeValues(preGrades);
      setGradeAttendance(preGradeAtt);
    } catch (err) {
      showApiError("Error", err, "Failed to fetch marks entry data");
      resetMarksData();
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (studentId, componentId, value) => {
    const key = `${studentId}_${componentId}`;
    setMarks((prev) => ({ ...prev, [key]: value }));
  };

  const handleAttendanceChange = (studentId, componentId, value) => {
    const key = `${studentId}_${componentId}`;
    setAttendance((prev) => ({ ...prev, [key]: value }));
  };

  const handleGradeChange = (studentId, value) => {
    setGradeValues((prev) => ({ ...prev, [studentId]: value }));
  };

  const handleGradeAttendanceChange = (studentId, value) => {
    setGradeAttendance((prev) => ({ ...prev, [studentId]: value }));
  };

 const saveMarksEntry = async () => {
  if (!examScheduleId) {
    Swal.fire("Error", "Exam schedule not found.", "error");
    return;
  }

  try {
    let marksData = [];

    if (evaluationMode === "GRADE") {
      marksData = students.flatMap((student) =>
        components.map((component) => ({
          student_id: student.id,
          component_id: component.component_id,
          grade: gradeValues[student.id] || "",
          attendance: gradeAttendance[student.id] || "P",
        }))
      );
    } else {
      marksData = students.flatMap((student) =>
        components.map((component) => {
          const key = `${student.id}_${component.component_id}`;
          return {
            student_id: student.id,
            component_id: component.component_id,
            marks_obtained:
              attendance[key] === "P" ? marks[key] || "" : null,
            attendance: attendance[key] || "P",
          };
        })
      );
    }

    await api.post("/marks-entry/save", {
      exam_schedule_id: examScheduleId,
      marksData,
    });

    Swal.fire(
      "Success",
      evaluationMode === "GRADE"
        ? "Grades saved successfully"
        : "Marks saved successfully",
      "success"
    );

    fetchMarksEntryData();
  } catch (err) {
    showApiError("Error", err, "Failed to save entry");
  }
};
  const downloadExcelTemplate = async () => {
    const { session_id, class_id, section_id, exam_id, subject_id } = filters;

    try {
      const response = await api.get("/marks-entry/export", {
        params: {
          session_id,
          class_id,
          section_id,
          exam_id,
          subject_id,
          mode: evaluationMode,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        evaluationMode === "GRADE"
          ? "grade-entry-template.xlsx"
          : "marks-entry-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showApiError("Error", err, "Failed to export Excel");
    }
  };

  const downloadPDF = async () => {
    const { session_id, class_id, section_id, exam_id, subject_id } = filters;

    try {
      const response = await api.get("/marks-entry/export-pdf", {
        params: {
          session_id,
          class_id,
          section_id,
          exam_id,
          subject_id,
          mode: evaluationMode,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        evaluationMode === "GRADE" ? "grade-entry.pdf" : "marks-entry.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showApiError("Error", err, "Failed to export PDF");
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!examScheduleId) {
      Swal.fire("Error", "Please select valid filters first.", "error");
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("exam_schedule_id", examScheduleId);
    formData.append("session_id", filters.session_id);

    try {
      await api.post("/marks-entry/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire(
        "Success",
        evaluationMode === "GRADE"
          ? "Grades imported successfully"
          : "Marks imported successfully",
        "success"
      );

      fetchMarksEntryData();
    } catch (err) {
      showApiError("Error", err, "Failed to import Excel");
    } finally {
      e.target.value = "";
    }
  };

  const gradeOptionLabels = useMemo(
    () => gradeOptions.map((g) => getGradeLabel(g)).filter(Boolean),
    [gradeOptions]
  );

  return (
    <div className="container-fluid py-3">
      <div className="card shadow-sm border-0">
        <div className="card-header bg-primary text-white">
          <h4 className="mb-0">
            {evaluationMode === "GRADE" ? "Grade Entry" : "Marks Entry"}
          </h4>
        </div>

        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-2">
              <label className="form-label fw-semibold">Session</label>
              <select
                className="form-select"
                value={filters.session_id}
                onChange={handleSessionChange}
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option
                    key={s.id || s.session_id}
                    value={s.id || s.session_id}
                  >
                    {s.name ||
                      s.session_name ||
                      s.title ||
                      `Session ${s.id || s.session_id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label fw-semibold">Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={handleClassChange}
              >
                <option value="">Select Class</option>
                {classExamSubjects.map((c, idx) => (
                  <option key={idx} value={c.class_id}>
                    {c.class_name || c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                name="section_id"
                value={filters.section_id}
                onChange={handleFilterChange}
              >
                <option value="">Select Section</option>
                {sections.map((s, idx) => (
                  <option key={idx} value={s.id || s.section_id}>
                    {s.section_name || s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Exam</label>
              <select
                className="form-select"
                value={filters.exam_id}
                onChange={handleExamChange}
                disabled={!filters.class_id}
              >
                <option value="">Select Exam</option>
                {exams.map((ex, idx) => (
                  <option key={idx} value={ex.exam_id}>
                    {ex.exam_name || ex.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Subject</label>
              <select
                className="form-select"
                name="subject_id"
                value={filters.subject_id}
                onChange={handleFilterChange}
                disabled={!filters.exam_id}
              >
                <option value="">Select Subject</option>
                {subjects.map((sub, idx) => (
                  <option key={idx} value={sub.subject_id || sub.id}>
                    {sub.subject_name || sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3">
            <button
              className="btn btn-success"
              onClick={saveMarksEntry}
              disabled={!examScheduleId || loading}
            >
              Save
            </button>

            <button
              className="btn btn-outline-primary"
              onClick={downloadExcelTemplate}
              disabled={!examScheduleId || loading}
            >
              Export Excel
            </button>

            <button
              className="btn btn-outline-danger"
              onClick={downloadPDF}
              disabled={!examScheduleId || loading}
            >
              Export PDF
            </button>

            <label className="btn btn-outline-secondary mb-0">
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={handleImportExcel}
                disabled={!examScheduleId || loading}
              />
            </label>
          </div>

          {evaluationMode === "GRADE" && gradeOptionLabels.length > 0 && (
            <div className="alert alert-info py-2">
              <strong>Allowed Grades:</strong> {gradeOptionLabels.join(", ")}
            </div>
          )}

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : students.length === 0 ? (
            <div className="alert alert-light border text-center mb-0">
              Select Session, Class, Section, Exam and Subject to load data.
            </div>
          ) : evaluationMode === "GRADE" ? (
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 80 }}>Roll No</th>
                    <th style={{ minWidth: 220 }}>Student Name</th>
                    <th style={{ minWidth: 110 }}>Attendance</th>
                    <th style={{ minWidth: 150 }}>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.roll_number || "-"}</td>
                      <td>{student.name}</td>
                      <td>
                        <select
                          className="form-select"
                          value={gradeAttendance[student.id] || "P"}
                          onChange={(e) =>
                            handleGradeAttendanceChange(student.id, e.target.value)
                          }
                        >
                          {attendanceOptions.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={gradeValues[student.id] || ""}
                          onChange={(e) =>
                            handleGradeChange(student.id, e.target.value)
                          }
                          disabled={(gradeAttendance[student.id] || "P") !== "P"}
                        >
                          <option value="">Select Grade</option>
                          {gradeOptions.map((g, idx) => {
                            const label = getGradeLabel(g);
                            return (
                              <option key={idx} value={label}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th rowSpan="2" style={{ minWidth: 80 }}>
                      Roll No
                    </th>
                    <th rowSpan="2" style={{ minWidth: 220 }}>
                      Student Name
                    </th>
                    {components.map((component) => (
                      <th
                        key={component.component_id}
                        colSpan="2"
                        className="text-center"
                      >
                        {component.abbreviation || component.name}
                        {component.max_marks != null
                          ? ` (${component.max_marks})`
                          : ""}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {components.map((component) => (
                      <React.Fragment key={component.component_id}>
                        <th style={{ minWidth: 110 }}>Attendance</th>
                        <th style={{ minWidth: 120 }}>Marks</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.roll_number || "-"}</td>
                      <td>{student.name}</td>

                      {components.map((component) => {
                        const key = `${student.id}_${component.component_id}`;
                        const att = attendance[key] || "P";

                        return (
                          <React.Fragment key={key}>
                            <td>
                              <select
                                className="form-select"
                                value={att}
                                onChange={(e) =>
                                  handleAttendanceChange(
                                    student.id,
                                    component.component_id,
                                    e.target.value
                                  )
                                }
                              >
                                {attendanceOptions.map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td>
                              <input
                                ref={(el) => {
                                  inputRefs.current[key] = el;
                                }}
                                type="number"
                                className="form-control"
                                value={marks[key] ?? ""}
                                min="0"
                                max={component.max_marks ?? undefined}
                                disabled={att !== "P"}
                                onFocus={() => setActiveStudentId(student.id)}
                                onChange={(e) =>
                                  handleMarksChange(
                                    student.id,
                                    component.component_id,
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarksEntry;