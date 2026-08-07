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
const getComponentMaximum = (component) => {
  const value = Number(component?.max_marks ?? component?.effective_max_marks);
  return Number.isFinite(value) && value > 0 ? value : null;
};
const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const attendanceOptions = ["P", "A", "L", "ACT", "LA", "ML", "X"];
const defaultGradeOptions = ["G", "B", "Y", "R"];

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
  const [accessibleSchedules, setAccessibleSchedules] = useState([]);
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
    loadMarksScope();
  }, []);

  useEffect(() => {
    const sessionRows = accessibleSchedules.filter(
      (row) => !filters.session_id || Number(row.session_id) === Number(filters.session_id)
    );
    const classMap = new Map();
    sessionRows.forEach((row) => {
      if (!classMap.has(Number(row.class_id))) {
        classMap.set(Number(row.class_id), {
          class_id: row.class_id,
          class_name: row.class_name,
        });
      }
    });
    setClassExamSubjects([...classMap.values()]);

    const sectionMap = new Map();
    sessionRows
      .filter((row) => !filters.class_id || Number(row.class_id) === Number(filters.class_id))
      .forEach((row) => {
        if (!sectionMap.has(Number(row.section_id))) {
          sectionMap.set(Number(row.section_id), {
            id: row.section_id,
            section_name: row.section_name,
          });
        }
      });
    setSections([...sectionMap.values()]);

    const examMap = new Map();
    sessionRows
      .filter(
        (row) =>
          Number(row.class_id) === Number(filters.class_id) &&
          (!filters.section_id || Number(row.section_id) === Number(filters.section_id))
      )
      .forEach((row) => {
        if (!examMap.has(Number(row.exam_id))) {
          examMap.set(Number(row.exam_id), { exam_id: row.exam_id, exam_name: row.exam_name });
        }
      });
    setExams([...examMap.values()]);

    const subjectMap = new Map();
    sessionRows
      .filter(
        (row) =>
          Number(row.class_id) === Number(filters.class_id) &&
          Number(row.section_id) === Number(filters.section_id) &&
          Number(row.exam_id) === Number(filters.exam_id)
      )
      .forEach((row) => {
        if (!subjectMap.has(Number(row.subject_id))) {
          subjectMap.set(Number(row.subject_id), {
            subject_id: row.subject_id,
            subject_name: row.subject_name,
          });
        }
      });
    setSubjects([...subjectMap.values()]);
  }, [accessibleSchedules, filters.session_id, filters.class_id, filters.section_id, filters.exam_id]);

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

  const loadMarksScope = async () => {
    try {
      const res = await api.get("/marks-access/my-scope");
      setAccessibleSchedules(asArray(res?.data?.schedules));
    } catch (err) {
      showApiError("Error", err, "Failed to load your marks access");
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

    setExams([]);
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

    setSubjects([]);
    resetMarksData();
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "section_id" ? { exam_id: "", subject_id: "" } : {}),
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

            const g = val?.grade ?? "";
            preGrades[key] = g || "";
            preGradeAtt[key] = val?.attendance || "P";
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

  const getMarksValidationMessage = (value, component) => {
    if (value === "" || value === null || value === undefined) return "";

    const numeric = Number(value);
    const maximum = getComponentMaximum(component);

    if (!Number.isFinite(numeric) || numeric < 0) {
      return "Marks must be a valid non-negative number.";
    }
    if (maximum !== null && numeric > maximum) {
      return `Marks cannot exceed ${maximum}.`;
    }

    return "";
  };

  const handleMarksKeyDown = async (event, studentIndex, component) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    const currentInput = event.currentTarget;
    const validationMessage = getMarksValidationMessage(
      currentInput.value,
      component
    );

    if (validationMessage) {
      await Swal.fire({
        icon: "warning",
        title: "Invalid marks",
        text: validationMessage,
      });
      currentInput.focus();
      currentInput.select();
      return;
    }

    for (let index = studentIndex + 1; index < students.length; index += 1) {
      const nextKey = `${students[index].id}_${component.component_id}`;
      const nextInput = inputRefs.current[nextKey];
      if (nextInput && !nextInput.disabled) {
        nextInput.focus();
        nextInput.select();
        break;
      }
    }
  };

  const handleAttendanceChange = (studentId, componentId, value) => {
    const key = `${studentId}_${componentId}`;
    setAttendance((prev) => ({ ...prev, [key]: value }));
  };

  const handleGradeChange = (studentId, componentId, value) => {
    const key = `${studentId}_${componentId}`;
    setGradeValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleGradeAttendanceChange = (studentId, componentId, value) => {
    const key = `${studentId}_${componentId}`;
    setGradeAttendance((prev) => ({ ...prev, [key]: value }));
  };

  const saveMarksEntry = async () => {
    if (!examScheduleId) {
      Swal.fire("Error", "Exam schedule not found.", "error");
      return;
    }

    const editableComponents = components.filter(
      (component) => !component.is_locked
    );
    if (!editableComponents.length) {
      Swal.fire(
        "Locked",
        "All components are locked. Unlock the assessment scheme before editing marks.",
        "warning"
      );
      return;
    }

    if (evaluationMode !== "GRADE") {
      const errors = [];
      students.forEach((student) => {
        editableComponents.forEach((component) => {
          const key = `${student.id}_${component.component_id}`;
          const att = attendance[key] || "P";
          const raw = marks[key];
          if (att !== "P" || raw === "" || raw === null || raw === undefined) {
            return;
          }

          const numeric = Number(raw);
          const maximum = getComponentMaximum(component);
          if (!Number.isFinite(numeric) || numeric < 0) {
            errors.push(
              `${student.name}: ${component.abbreviation || component.name} must be a valid non-negative number.`
            );
          } else if (maximum !== null && numeric > maximum) {
            errors.push(
              `${student.name}: ${component.abbreviation || component.name} ${numeric} cannot exceed ${maximum}.`
            );
          }
        });
      });

      if (errors.length) {
        Swal.fire({
          icon: "warning",
          title: "Please correct marks",
          html: `<div style="text-align:left;max-height:260px;overflow:auto">${errors
            .slice(0, 20)
            .map((message) => `<div>• ${escapeHtml(message)}</div>`)
            .join("")}${errors.length > 20 ? `<div>...and ${errors.length - 20} more</div>` : ""}</div>`,
        });
        return;
      }
    }

    try {
      let marksData = [];

      if (evaluationMode === "GRADE") {
        marksData = students.flatMap((student) =>
          editableComponents.map((component) => {
            const key = `${student.id}_${component.component_id}`;
            return {
              student_id: student.id,
              component_id: component.component_id,
              grade: gradeValues[key] || "",
              attendance: gradeAttendance[key] || "P",
            };
          })
        );
      } else {
        marksData = students.flatMap((student) =>
          editableComponents.map((component) => {
            const key = `${student.id}_${component.component_id}`;
            const att = attendance[key] || "P";
            return {
              student_id: student.id,
              component_id: component.component_id,
              marks_obtained:
                att === "P" && marks[key] !== "" && marks[key] != null
                  ? marks[key]
                  : null,
              attendance: att,
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

  const gradeOptionLabels = useMemo(() => {
    const labels = gradeOptions.map((g) => getGradeLabel(g)).filter(Boolean);
    return labels.length > 0 ? labels : defaultGradeOptions;
  }, [gradeOptions]);

  const hasLockedComponents = useMemo(
    () => components.some((component) => component.is_locked),
    [components]
  );

  const allComponentsLocked = useMemo(
    () => components.length > 0 && components.every((component) => component.is_locked),
    [components]
  );

  const invalidGroups = useMemo(
    () =>
      components.filter(
        (component) =>
          component.result_group_code &&
          component.group_validation &&
          !component.group_validation.is_valid
      ),
    [components]
  );

  const renderComponentHeader = (component) => {
    const abbr = component?.abbreviation || "";
    const name = component?.name || "";
    const maximum = getComponentMaximum(component);
    const weightage = Number(component?.final_weightage ?? component?.weightage_percent);

    return (
      <div className="text-center">
        {abbr && <div className="fw-bold">{abbr}</div>}
        {name && (
          <div className="small text-muted" style={{ whiteSpace: "normal" }}>
            {name}
          </div>
        )}
        {evaluationMode !== "GRADE" && (
          <div className="small">
            Entry: {maximum ?? "-"} • Final: {Number.isFinite(weightage) ? weightage : "-"}
          </div>
        )}
        {component?.result_group_code && (
          <div className="small text-primary">
            Group: {component.result_group_label || component.result_group_code}
          </div>
        )}
        {component?.is_locked && (
          <span className="badge bg-danger mt-1">🔒 Locked</span>
        )}
      </div>
    );
  };

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
              disabled={!examScheduleId || loading || allComponentsLocked}
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
                disabled={!examScheduleId || loading || hasLockedComponents}
              />
            </label>
          </div>

          {hasLockedComponents && (
            <div className="alert alert-warning py-2">
              <strong>Locked components are read-only.</strong>{" "}
              Save ignores them, and Excel import is disabled until they are unlocked.
            </div>
          )}

          {invalidGroups.length > 0 && (
            <div className="alert alert-danger py-2">
              <strong>Result group configuration is incomplete.</strong>{" "}
              Open Exam Scheme and correct the group before locking or printing the report card.
            </div>
          )}

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
                        {renderComponentHeader(component)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {components.map((component) => (
                      <React.Fragment key={component.component_id}>
                        <th style={{ minWidth: 110 }}>Attendance</th>
                        <th style={{ minWidth: 150 }}>Grade</th>
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
                        const att = gradeAttendance[key] || "P";

                        return (
                          <React.Fragment key={key}>
                            <td>
                              <select
                                className="form-select"
                                value={att}
                                disabled={component.is_locked}
                                onChange={(e) =>
                                  handleGradeAttendanceChange(
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
                              <select
                                className="form-select"
                                value={gradeValues[key] || ""}
                                onChange={(e) =>
                                  handleGradeChange(
                                    student.id,
                                    component.component_id,
                                    e.target.value
                                  )
                                }
                                disabled={component.is_locked || att !== "P"}
                              >
                                <option value="">Select Grade</option>
                                {gradeOptionLabels.map((label, idx) => (
                                  <option key={idx} value={label}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </React.Fragment>
                        );
                      })}
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
                        {renderComponentHeader(component)}
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
                  {students.map((student, studentIndex) => (
                    <tr key={student.id}>
                      <td>{student.roll_number || "-"}</td>
                      <td>{student.name}</td>

                      {components.map((component) => {
                        const key = `${student.id}_${component.component_id}`;
                        const att = attendance[key] || "P";
                        const validationMessage = getMarksValidationMessage(
                          marks[key],
                          component
                        );

                        return (
                          <React.Fragment key={key}>
                            <td>
                              <select
                                className="form-select"
                                value={att}
                                disabled={component.is_locked}
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
                                className={`form-control${
                                  validationMessage ? " is-invalid" : ""
                                }`}
                                value={marks[key] ?? ""}
                                min="0"
                                step="0.01"
                                max={getComponentMaximum(component) ?? undefined}
                                disabled={component.is_locked || att !== "P"}
                                onFocus={() => setActiveStudentId(student.id)}
                                onChange={(e) =>
                                  handleMarksChange(
                                    student.id,
                                    component.component_id,
                                    e.target.value
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleMarksKeyDown(e, studentIndex, component)
                                }
                                aria-invalid={Boolean(validationMessage)}
                                title={validationMessage || undefined}
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
