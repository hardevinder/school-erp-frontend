// src/pages/FinalResultSummary.jsx
import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button, ProgressBar } from "react-bootstrap";

/* ============================================================
 * ✅ Student photo helpers (same style as Students.js)
 * ============================================================ */
const apiBase = (() => {
  const b = api?.defaults?.baseURL;
  return b ? b.replace(/\/+$/, "") : window.location.origin;
})();

const buildStudentPhotoURL = (fileName) =>
  fileName ? `${apiBase}/uploads/photoes/students/${encodeURIComponent(fileName)}` : "";

// Neutral "no photo" SVG placeholder (works in browser + PDF HTML)
const NO_PHOTO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
       <rect width="100%" height="100%" fill="#f8f9fa"/>
       <circle cx="48" cy="36" r="18" fill="#e9ecef"/>
       <rect x="18" y="62" width="60" height="18" rx="9" fill="#e9ecef"/>
     </svg>`
  );

/* ============================================================
 * ✅ Attendance helpers (Present / Total only)
 * ============================================================ */
const safeInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const buildPresentTotalText = (att) => {
  const p = safeInt(att?.present_days);
  const t = safeInt(att?.total_days);

  if (p == null && t == null) return "-";
  return `${p ?? 0} / ${t ?? 0}`;
};

const FinalResultSummary = () => {
  const [classList, setClassList] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [showTotals, setShowTotals] = useState(true);
  const [studentInfoMap, setStudentInfoMap] = useState({});
  const [coScholasticData, setCoScholasticData] = useState([]);
  const [remarksData, setRemarksData] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [gradeSchema, setGradeSchema] = useState([]);
  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
    exam_ids: [],
    subjectComponents: [{ subject_id: "", selected_components: {}, availableComponents: [] }],
  });
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportFormat, setReportFormat] = useState(null);
  const [numberFormat, setNumberFormat] = useState({
    decimalPoints: 2,
    rounding: "none",
  });

  // PDF generation progress UI
  const [pdfProgressVisible, setPdfProgressVisible] = useState(false);
  const [pdfPercent, setPdfPercent] = useState(0);
  const [pdfMessage, setPdfMessage] = useState("Preparing…");
  const abortGenRef = useRef(null);

  useEffect(() => {
    loadClasses();
    loadSections();
    loadExams();
    loadGradeSchema();
  }, []);

  const loadClasses = async () => {
    try {
      const res = await api.get("/classes");
      setClassList(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to load classes", "error");
    }
  };

  const loadSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to load sections", "error");
    }
  };

  const loadExams = async () => {
    try {
      const res = await api.get("/exams");
      setExams(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to load exams", "error");
    }
  };

  const loadGradeSchema = async () => {
    try {
      const res = await api.get("/grade-schemes");
      setGradeSchema(res.data.data || []);
    } catch {
      Swal.fire("Error", "Failed to load grade schema", "error");
    }
  };

  const handleExamChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map((opt) =>
      parseInt(opt.value, 10)
    );
    setFilters((prev) => ({ ...prev, exam_ids: selectedOptions }));
  };

  const loadSubjects = async (class_id) => {
    try {
      const res = await api.get("/subjects", { params: { class_id } });
      const list = Array.isArray(res.data.subjects) ? res.data.subjects : [];
      setSubjects(list);
      return list;
    } catch {
      Swal.fire("Error", "Failed to load subjects", "error");
      setSubjects([]);
      return [];
    }
  };

  /* ============================================================
   * ✅ Preselect all subjects + all components (term-wise)
   * ============================================================ */
  const selectAllComponentsTermWise = (availableComponents = []) => {
    const selected = {};
    for (const c of availableComponents) {
      const t = String(c.term_id);
      if (!selected[t]) selected[t] = [];
      if (!selected[t].includes(c.component_id)) selected[t].push(c.component_id);
    }
    return selected;
  };

  const loadSubjectComponentsAuto = async (class_id, subject_id) => {
    const res = await api.get("/exam-schemes/components/term-wise", {
      params: { class_id, subject_id },
    });
    const availableComponents = res.data || [];
    const selected_components = selectAllComponentsTermWise(availableComponents);
    return { availableComponents, selected_components };
  };

  const preselectAllSubjectsAndComponents = async (class_id, subjectsList) => {
    const rows = await Promise.all(
      (subjectsList || []).map(async (s) => {
        try {
          const { availableComponents, selected_components } =
            await loadSubjectComponentsAuto(class_id, s.id);
          return {
            subject_id: String(s.id),
            availableComponents,
            selected_components,
          };
        } catch (e) {
          console.error("Failed to load components for subject:", s?.id, e);
          return {
            subject_id: String(s.id),
            availableComponents: [],
            selected_components: {},
          };
        }
      })
    );

    return rows.length
      ? rows
      : [{ subject_id: "", selected_components: {}, availableComponents: [] }];
  };

  const handleClassChange = async (e) => {
    const class_id = e.target.value;

    // reset first
    setFilters({
      class_id,
      section_id: "",
      exam_ids: [],
      subjectComponents: [{ subject_id: "", selected_components: {}, availableComponents: [] }],
    });

    setSubjects([]);
    setReportData([]);
    setStudentInfoMap({});
    setCoScholasticData([]);
    setRemarksData({});
    setAttendanceData({});

    if (!class_id) {
      setReportFormat(null);
      return;
    }

    try {
      const subjectList = await loadSubjects(class_id);
      const subjectComponents = await preselectAllSubjectsAndComponents(class_id, subjectList);

      setFilters((prev) => ({
        ...prev,
        class_id,
        subjectComponents,
      }));

      // report format
      try {
        const res = await api.get("/report-card/format-by-class", {
          params: { class_id },
        });
        setReportFormat(res.data?.format || null);
      } catch {
        setReportFormat(null);
        Swal.fire("Error", "Failed to load report card format", "error");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to prepare subject/components", "error");
    }
  };

  const handleSubjectChange = async (e, index) => {
    const subject_id = e.target.value;

    if (!filters.class_id) {
      Swal.fire("Select Class", "Please select class first", "warning");
      return;
    }

    try {
      const { availableComponents, selected_components } = await loadSubjectComponentsAuto(
        filters.class_id,
        subject_id
      );

      setFilters((prev) => {
        const updated = [...prev.subjectComponents];
        updated[index] = {
          subject_id,
          availableComponents,
          selected_components,
        };
        return { ...prev, subjectComponents: updated };
      });
    } catch {
      Swal.fire("Error", "Failed to load components", "error");
    }
  };

  const handleComponentToggle = (term_id, compId, index, checked) => {
    setFilters((prev) => {
      const updated = [...prev.subjectComponents];
      const selected = { ...(updated[index].selected_components || {}) };
      const t = String(term_id);

      if (!selected[t]) selected[t] = [];
      if (checked) selected[t] = [...selected[t], compId];
      else selected[t] = selected[t].filter((id) => id !== compId);

      updated[index].selected_components = selected;
      return { ...prev, subjectComponents: updated };
    });
  };

  const addSubject = () =>
    setFilters((prev) => ({
      ...prev,
      subjectComponents: [
        ...prev.subjectComponents,
        { subject_id: "", selected_components: {}, availableComponents: [] },
      ],
    }));

  const removeSubject = (index) =>
    setFilters((prev) => {
      const next = prev.subjectComponents.filter((_, i) => i !== index);
      return {
        ...prev,
        subjectComponents: next.length
          ? next
          : [{ subject_id: "", selected_components: {}, availableComponents: [] }],
      };
    });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  /* ============================================================
   * ✅ Term resolver for attendance/co-scholastic/remarks
   * - Uses first selected exam's term_id
   * - Fallback: "1"
   * ============================================================ */
  const resolveTermId = () => {
    const firstExamId = (filters.exam_ids || [])[0];
    const termId = exams.find((e) => e.id === firstExamId)?.term_id;
    return termId ? String(termId) : "1";
  };

  /* ============================================================
   * ✅ Attendance fetcher
   * - Reads from StudentTermAttendance summary endpoint
   * - Supports both response shapes:
   *   (A) { attendance: [...] }
   *   (B) { attendanceMap: { [student_id]: {...} } }
   * - Tries multiple endpoint paths to avoid 404 mismatch
   * ============================================================ */
  const fetchAttendanceSummary = async ({ class_id, section_id, term_id }) => {
    const endpoints = [
      "/attendance-entry/summary", // ✅ if mounted at /api/attendance-entry
      "/student-term-attendances/summary", // ✅ if mounted at /api/student-term-attendances
      "/student-term-attendance/summary",
      "/student-term-attendance/summary",
    ];

    let lastErr = null;

    for (const url of endpoints) {
      try {
        const res = await api.get(url, { params: { class_id, section_id, term_id } });
        const attendanceMap = {};

        if (res?.data?.attendanceMap && typeof res.data.attendanceMap === "object") {
          Object.entries(res.data.attendanceMap).forEach(([sid, obj]) => {
            attendanceMap[Number(sid)] = { student_id: Number(sid), ...(obj || {}) };
          });
        } else if (Array.isArray(res?.data?.attendance)) {
          for (const a of res.data.attendance) attendanceMap[a.student_id] = a;
        } else if (Array.isArray(res?.data)) {
          // in case API returns array directly
          for (const a of res.data) attendanceMap[a.student_id] = a;
        } else {
          // unknown shape
          console.warn("Attendance summary: unknown response shape from", url, res?.data);
        }

        return attendanceMap;
      } catch (e) {
        lastErr = e;
        const status = e?.response?.status;
        // only ignore if route missing
        if (status !== 404) break;
      }
    }

    throw lastErr || new Error("Attendance summary API failed");
  };

  const fetchReport = async () => {
    const { class_id, section_id, exam_ids } = filters;
    if (!class_id || !section_id || !exam_ids.length) {
      return Swal.fire("Missing Field", "Select class, section & exam(s)", "warning");
    }

    setLoading(true);

    const subjectComponentsPayload = (filters.subjectComponents || [])
      .filter((sc) => sc.subject_id)
      .map((sc) => {
        const all = Object.values(sc.selected_components || {}).flat();
        const unique = Array.from(new Set((all || []).map(Number).filter(Boolean)));
        return { subject_id: Number(sc.subject_id), component_ids: unique };
      })
      .filter((x) => x.subject_id && x.component_ids.length);

    const payload = {
      class_id: +class_id,
      section_id: +section_id,
      exam_ids,
      subjectComponents: subjectComponentsPayload,
      sum: true,
      showSubjectTotals: true,
      includeGrades: true,
    };

    try {
      const term_id = resolveTermId();

      const res = await api.post("/report-card/detailed-summary", payload);
      const reportStudents = res.data.students || [];
      if (!reportStudents.length) {
        Swal.fire("No Data", "No students found for the selected filters", "info");
        setReportData([]);
        setStudentInfoMap({});
        setCoScholasticData([]);
        setRemarksData({});
        setAttendanceData({});
        setLoading(false);
        return;
      }

      setReportData(reportStudents);

      const studentIds = reportStudents.map((s) => s.id);
      const infoRes = await api.get("/report-card/students", {
        params: { student_ids: studentIds },
      });
      const studentMap = {};
      for (const s of infoRes.data.students || []) studentMap[s.id] = s;
      setStudentInfoMap(studentMap);

      const coScholasticRes = await api.get("/report-card/coscholastic-summary", {
        params: { class_id, section_id, term_id },
      });
      setCoScholasticData(coScholasticRes.data || []);

      const remarksRes = await api.get("/report-card/remarks-summary", {
        params: { class_id, section_id, term_id },
      });
      const remarksMap = {};
      for (const r of remarksRes.data.remarks || []) remarksMap[r.student_id] = r.remark;
      setRemarksData(remarksMap);

      // ✅ Attendance summary (Present/Total only) — from StudentTermAttendance
      const attendanceMap = await fetchAttendanceSummary({ class_id, section_id, term_id });
      setAttendanceData(attendanceMap);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch report data", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value) => {
    if (value == null || isNaN(value)) return "-";
    let num = +value;
    const pow = 10 ** numberFormat.decimalPoints;
    if (numberFormat.rounding === "floor") num = Math.floor(num * pow) / pow;
    if (numberFormat.rounding === "ceiling") num = Math.ceil(num * pow) / pow;
    return num.toFixed(numberFormat.decimalPoints);
  };

  const getUniqueComponentsByExam = (examId) => {
    const termId = exams.find((e) => e.id === examId)?.term_id;
    const compMap = new Map();

    filters.subjectComponents.forEach((sc) => {
      const comps = (sc.availableComponents || []).filter(
        (c) =>
          filters.exam_ids.includes(examId) &&
          (sc.selected_components?.[String(termId)] || []).includes(c.component_id)
      );

      comps.forEach((c) => {
        if (!compMap.has(c.component_id)) {
          compMap.set(c.component_id, {
            component_id: c.component_id,
            label: c.abbreviation || c.name,
          });
        }
      });
    });

    return Array.from(compMap.values());
  };

  /* ============================================================
   * ✅ Grade Schema inline
   * ============================================================ */
  const buildGradeSchemaInlineText = () => {
    if (!gradeSchema || !gradeSchema.length) return "";
    return gradeSchema
      .map((g) => {
        const range =
          g?.min_percent != null && g?.max_percent != null
            ? `${g.min_percent}-${g.max_percent}`
            : "";
        const grade = g?.grade ?? "";
        if (!range && !grade) return "";
        return `${range}: ${grade}`.trim();
      })
      .filter(Boolean)
      .join(", ");
  };

  const buildGradeSchemaInlineHtml = () => {
    const line = buildGradeSchemaInlineText();
    if (!line) return "";
    return `
      <div class="mt-4">
        <h5 style="margin-bottom:6px">Grade Schema</h5>
        <div class="grade-inline">${line}</div>
      </div>
    `;
  };

  const renderGradeSchemaInline = () => {
    const line = buildGradeSchemaInlineText();
    if (!line) return null;

    return (
      <div className="mt-4">
        <h5 className="mb-2">Grade Schema</h5>
        <div className="border rounded p-2 small" style={{ background: "#fff", lineHeight: 1.4 }}>
          {line}
        </div>
      </div>
    );
  };

  /** -------- Build PDF HTML that mirrors the on-screen report-card layout -------- */
  const buildScholasticHeaderHtml = () => {
    let theadTop = `<tr><th rowspan="2" style="background:#dff0ff;color:#003366;text-align:left">Subject</th>`;
    let theadBottom = `<tr>`;
    filters.exam_ids.forEach((exId) => {
      const comps = getUniqueComponentsByExam(exId);
      theadTop += `<th colspan="${comps.length + (showTotals ? 2 : 0)}" style="background:#dff0ff;color:#003366">${
        exams.find((e) => e.id === exId)?.name || ""
      }</th>`;
      comps.forEach((c) => {
        theadBottom += `<th style="background:#e6f4ff">${c.label}</th>`;
      });
      if (showTotals) {
        theadBottom += `<th style="background:#e6f4ff;font-weight:bold">Marks</th><th style="background:#e6f4ff;font-weight:bold">Grade</th>`;
      }
    });
    if (showTotals) {
      theadTop += `<th colspan="2" style="background:#dff0ff;color:#003366">Total</th>`;
      theadBottom += `<th style="background:#e6f4ff;font-weight:bold">Marks</th><th style="background:#e6f4ff;font-weight:bold">Grade</th>`;
    }
    theadTop += `</tr>`;
    theadBottom += `</tr>`;
    return theadTop + theadBottom;
  };

  const buildScholasticBodyRowHtml = (student, subjectName) => {
    const subjComps = student.components.filter((c) => c.subject_name === subjectName);
    let row = `<tr><td style="background:#dff0ff;font-weight:bold;text-align:left">${subjectName}</td>`;
    filters.exam_ids.forEach((exId) => {
      const ecs = subjComps.filter((c) => c.exam_id === exId);
      const comps = getUniqueComponentsByExam(exId);
      comps.forEach((comp) => {
        const cc = subjComps.find(
          (c) => c.exam_id === exId && c.component_id === comp.component_id
        );
        row += `<td>${cc?.marks ?? "-"}</td>`;
      });
      if (showTotals) {
        const totalMarks = ecs.reduce((a, x) => a + (x.marks || 0), 0);
        const grade = ecs[0]?.grade || "-";
        row += `<td style="font-weight:bold">${totalMarks}</td><td style="font-weight:bold">${grade}</td>`;
      }
    });
    if (showTotals) {
      const total = subjComps.reduce((a, x) => a + (x.marks || 0), 0);
      const grade = student.subject_grades?.[subjComps[0]?.subject_id] || "-";
      row += `<td style="font-weight:bold">${total}</td><td style="font-weight:bold">${grade}</td>`;
    }
    row += `</tr>`;
    return row;
  };

  const buildCardsHtml = () => {
    const styles = `
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; }
        .card { margin-bottom: 28px; }
        .border { border: 1px solid #ccc; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #333; padding: 4px; text-align: center; }
        h4, h5 { margin: 10px 0; }
        .header-flex { display:flex; align-items:center; justify-content:space-between; }
        .mb-3 { margin-bottom: 12px; }
        .mb-2 { margin-bottom: 8px; }
        .p-8 { padding: 8px; }
        .text-center { text-align:center; }

        .student-photo {
          width: 80px;
          height: 80px;
          border-radius: 10px;
          object-fit: cover;
          border: 2px solid #ddd;
          box-shadow: 0 1px 2px rgba(0,0,0,0.08);
        }

        .grade-inline {
          border: 1px solid #ccc;
          padding: 8px 10px;
          border-radius: 8px;
          background: #fff;
          line-height: 1.4;
        }

        @page { margin: 40px 20px; }
        section { page-break-after: always; }
        section:last-child { page-break-after: auto; }
      </style>
    `;

    const blocks = reportData.map((student) => {
      const info = studentInfoMap[student.id] || {};
      const co =
        (coScholasticData.find((s) => s.id === student.id) || { grades: [] }).grades;

      const att = attendanceData[student.id] || null;
      const presentTotal = buildPresentTotalText(att);

      const remark = remarksData[student.id] || "-";

      const subjectsForStudent = Array.from(
        new Set(student.components.map((c) => c.subject_name))
      );

      const scholasticTable = `
        <h5>Scholastic Areas</h5>
        <table>
          <thead>${buildScholasticHeaderHtml()}</thead>
          <tbody>
            ${subjectsForStudent.map((sub) => buildScholasticBodyRowHtml(student, sub)).join("")}
          </tbody>
        </table>
      `;

      const coScholasticTable = `
        <h5 class="mt-4">Co-Scholastic Areas</h5>
        <table>
          <thead>
            <tr>
              <th style="background:#dff0ff;color:#003366;text-align:left">Area</th>
              <th style="background:#dff0ff;color:#003366">Grade</th>
              <th style="background:#dff0ff;color:#003366">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${
              co.length
                ? co
                    .map(
                      (g) => `
                <tr>
                  <td style="text-align:left;font-weight:bold">${g.area_name}</td>
                  <td>${g.grade || "-"}</td>
                  <td>${g.remarks || "-"}</td>
                </tr>`
                    )
                    .join("")
                : `<tr><td colspan="3" class="text-center">No co-scholastic data available</td></tr>`
            }
          </tbody>
        </table>
      `;

      // ✅ Attendance (Present/Total only)
      const attendanceTable = `
        <h5 class="mt-4">Attendance</h5>
        <table>
          <thead>
            <tr>
              <th style="background:#dff0ff;color:#003366">Present / Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight:bold">${presentTotal}</td>
            </tr>
          </tbody>
        </table>
      `;

      const studentPhotoSrc = info?.photo ? buildStudentPhotoURL(info.photo) : NO_PHOTO_SVG;

      const headerHtml = reportFormat?.header_html
        ? `
          <div class="mb-3">
            <div class="header-flex">
              ${
                reportFormat.school_logo_url
                  ? `<img src="${reportFormat.school_logo_url}" alt="School Logo" style="height:80px;margin-right:10px" />`
                  : `<span style="width:80px"></span>`
              }
              <div class="text-center" style="flex:1">${reportFormat.header_html}</div>
              <img src="${studentPhotoSrc}" alt="Student Photo" class="student-photo" style="margin-left:10px" />
            </div>
          </div>
        `
        : "";

      const footerHtml = reportFormat?.footer_html
        ? `<div class="mt-3 text-center" style="font-size:12px">${reportFormat.footer_html}</div>`
        : "";

      const studentInfoBlock = `
        <div class="row g-3 small border p-8 mb-3" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
          <div><strong>Name:</strong> ${info?.name || "-"}</div>
          <div><strong>Admission No.:</strong> ${info?.admission_number || "-"}</div>
          <div><strong>Roll No.:</strong> ${info?.roll_number || "-"}</div>
          <div><strong>Class & Section:</strong> ${(info?.Class?.class_name || "-")} - ${(info?.Section?.section_name || "-")}</div>
          <div><strong>Father's Name:</strong> ${info?.father_name || "-"}</div>
          <div><strong>Mother's Name:</strong> ${info?.mother_name || "-"}</div>
          <div><strong>Phone:</strong> ${info?.father_phone || info?.mother_phone || "-"}</div>
          <div><strong>Aadhaar No.:</strong> ${info?.aadhaar_number || "-"}</div>
        </div>
      `;

      const remarksBlock = `
        <h5 class="mt-4">Remarks</h5>
        <div class="border p-8 small">
          <p>${remark || "No remarks provided"}</p>
        </div>
      `;

      const gradeSchemaBlock = buildGradeSchemaInlineHtml();

      return `
        <section class="card">
          ${headerHtml}
          ${studentInfoBlock}
          <h4 style="font-weight:bold">${info?.name || "-"} (Roll: ${info?.roll_number || "-"})</h4>
          ${scholasticTable}
          ${coScholasticTable}
          ${attendanceTable}
          ${remarksBlock}
          ${footerHtml}
          ${gradeSchemaBlock}
        </section>
      `;
    });

    return `<!doctype html><html><head><meta charset="utf-8" />${styles}</head><body>${blocks.join(
      ""
    )}</body></html>`;
  };

  const downloadPDF = async () => {
    if (!reportData.length) {
      return Swal.fire("No Data", "Please generate the report first", "info");
    }

    let subject_components = (filters.subjectComponents || [])
      .filter((sc) => sc.subject_id)
      .map((sc) => {
        const term_component_map = {};
        Object.entries(sc.selected_components || {}).forEach(([termId, compIds]) => {
          const arr = (compIds || []).map(Number).filter(Boolean);
          if (arr.length) term_component_map[Number(termId)] = Array.from(new Set(arr));
        });
        return { subject_id: Number(sc.subject_id), term_component_map };
      })
      .filter((item) => Object.keys(item.term_component_map).length > 0);

    if (!subject_components.length) {
      const examIdToTermId = new Map(exams.map((e) => [e.id, e.term_id]));
      const mapBySubject = new Map();
      for (const student of reportData) {
        for (const c of student.components || []) {
          const subject_id = Number(c.subject_id);
          const term_id = Number(examIdToTermId.get(c.exam_id));
          const component_id = Number(c.component_id);
          if (!subject_id || !term_id || !component_id) continue;

          if (!mapBySubject.has(subject_id)) {
            mapBySubject.set(subject_id, { subject_id, term_component_map: {} });
          }
          const entry = mapBySubject.get(subject_id);
          if (!entry.term_component_map[term_id]) entry.term_component_map[term_id] = [];
          if (!entry.term_component_map[term_id].includes(component_id)) {
            entry.term_component_map[term_id].push(component_id);
          }
        }
      }
      subject_components = Array.from(mapBySubject.values()).filter(
        (item) => Object.keys(item.term_component_map).length > 0
      );
    }

    if (!subject_components.length) {
      return Swal.fire(
        "Missing Components",
        "No assessment components found. Select components or generate the report again.",
        "warning"
      );
    }

    const filtersPayload = {
      class_id: Number(filters.class_id),
      section_id: Number(filters.section_id),
      subject_components,
      includeGrades: true,
    };

    const html = buildCardsHtml();

    const newTab = window.open("", "_blank");
    if (!newTab) {
      Swal.fire("Popup blocked", "Please allow popups for this site.", "warning");
      return;
    }
    try {
      newTab.document.write(
        '<!doctype html><title>Preparing PDF…</title><p style="font-family:sans-serif;padding:16px">Preparing PDF…</p>'
      );
    } catch {}

    setPdfPercent(2);
    setPdfMessage("Queuing render…");
    setPdfProgressVisible(true);

    const controller = new AbortController();
    abortGenRef.current = controller;

    try {
      const res = await api.post(
        "/report-card/generate-pdf/report-card",
        {
          html,
          filters: filtersPayload,
          fileName: "FinalWeightedReport",
          orientation: "portrait",
        },
        {
          responseType: "blob",
          signal: controller.signal,
          onDownloadProgress: (e) => {
            if (e.total) {
              const pct = Math.min(98, Math.round((e.loaded / e.total) * 100));
              setPdfPercent(pct);
              setPdfMessage(pct < 90 ? "Rendering PDF…" : "Finalizing…");
            } else {
              setPdfPercent((p) => (p < 80 ? p + 1 : p));
              setPdfMessage("Rendering PDF…");
            }
          },
        }
      );

      setPdfPercent(100);
      setPdfMessage("Opening…");

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      newTab.location.href = url;

      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (controller.signal.aborted) {
        newTab.close();
        Swal.fire("Cancelled", "PDF generation was cancelled.", "info");
      } else {
        console.error(error);
        newTab.close();
        Swal.fire("Error", "Failed to generate PDF", "error");
      }
    } finally {
      setPdfProgressVisible(false);
      abortGenRef.current = null;
    }
  };

  return (
    <div className="container mt-4">
      <h2>📘 Final Result Summary</h2>

      <div className="row g-3 mt-3">
        <div className="col-md-4">
          <label>Class</label>
          <select className="form-select" value={filters.class_id} onChange={handleClassChange}>
            <option value="">Select Class</option>
            {classList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.class_name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-4">
          <label>Section</label>
          <select
            name="section_id"
            className="form-select"
            value={filters.section_id}
            onChange={handleFilterChange}
          >
            <option value="">Select Section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section_name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-4">
          <label>Exam(s)</label>
          <select
            multiple
            className="form-select"
            value={filters.exam_ids}
            onChange={handleExamChange}
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <div className="text-muted small mt-1">Hold Ctrl / Cmd to select multiple exams</div>
        </div>
      </div>

      <div className="mt-4">
        <h5>Subjects & Components</h5>
        <div className="d-flex flex-wrap gap-3">
          {filters.subjectComponents.map((sc, i) => (
            <div key={i} className="border p-3 rounded" style={{ minWidth: 260 }}>
              <div className="d-flex gap-2">
                <select
                  className="form-select mb-2"
                  value={sc.subject_id}
                  onChange={(e) => handleSubjectChange(e, i)}
                >
                  <option value="">Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <button className="btn btn-sm btn-danger mb-2" onClick={() => removeSubject(i)}>
                  Remove
                </button>
              </div>

              {Object.entries(
                (sc.availableComponents || []).reduce((a, c) => {
                  (a[c.term_id] || (a[c.term_id] = [])).push(c);
                  return a;
                }, {})
              ).map(([term, comps]) => (
                <div key={term}>
                  <small className="fw-bold">Term {term}</small>
                  <div className="d-flex flex-wrap">
                    {comps.map((c) => (
                      <div key={c.component_id} className="form-check me-2">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`c-${term}-${i}-${c.component_id}`}
                          checked={(sc.selected_components?.[String(term)] || []).includes(
                            c.component_id
                          )}
                          onChange={(e) =>
                            handleComponentToggle(+term, c.component_id, i, e.target.checked)
                          }
                        />
                        <label
                          className="form-check-label"
                          htmlFor={`c-${term}-${i}-${c.component_id}`}
                        >
                          {c.abbreviation || c.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {!sc.availableComponents?.length && sc.subject_id ? (
                <div className="text-muted small">No components found for this subject.</div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-3">
          <button className="btn btn-success me-2" onClick={addSubject}>
            Add Subject
          </button>
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>
            {loading ? "Loading…" : "Generate Report"}
          </button>
        </div>
      </div>

      <div className="form-check form-switch my-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="toggleTotals"
          checked={showTotals}
          onChange={() => setShowTotals((prev) => !prev)}
        />
        <label className="form-check-label" htmlFor="toggleTotals">
          Show Total and Grade Columns
        </label>
      </div>

      {loading && (
        <div className="text-center my-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      {!loading && reportData.length === 0 && (
        <div className="text-center my-5">
          No report data available. Please select filters and generate the report.
        </div>
      )}

      {!loading && reportData.length > 0 && (
        <div className="mt-5">
          <div className="d-flex justify-content-end">
            <button
              className="btn btn-outline-dark mb-3"
              onClick={downloadPDF}
              disabled={pdfProgressVisible}
            >
              📄 Download Report Cards as PDF
            </button>
          </div>

          {reportData.map((student) => {
            const info = studentInfoMap[student.id] || {};
            const studentPhotoSrc = info?.photo ? buildStudentPhotoURL(info.photo) : NO_PHOTO_SVG;

            const coScholastic =
              coScholasticData.find((s) => s.id === student.id) || { grades: [] };

            const remark = remarksData[student.id] || "-";
            const att = attendanceData[student.id] || null;
            const presentTotal = buildPresentTotalText(att);

            return (
              <div key={student.id} className="mb-5">
                {reportFormat?.header_html && (
                  <div className="report-header mb-3">
                    <div className="d-flex align-items-center justify-content-between">
                      {reportFormat.school_logo_url ? (
                        <img
                          src={reportFormat.school_logo_url}
                          alt="School Logo"
                          style={{ height: "80px", marginRight: "10px" }}
                        />
                      ) : (
                        <div style={{ width: "80px" }} />
                      )}

                      <div
                        className="flex-grow-1 text-center"
                        dangerouslySetInnerHTML={{ __html: reportFormat.header_html }}
                      />

                      <img
                        src={studentPhotoSrc}
                        alt="Student Photo"
                        style={{
                          height: "90px",
                          width: "75px",
                          borderRadius: "10px",
                          objectFit: "cover",
                          border: "2px solid #dee2e6",
                          marginLeft: "10px",
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="row g-3 small border p-3 mb-3">
                  <div className="col-md-6">
                    <strong>Name:</strong> {info?.name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Admission No.:</strong> {info?.admission_number || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Roll No.:</strong> {info?.roll_number || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Class & Section:</strong> {info?.Class?.class_name || "-"} -{" "}
                    {info?.Section?.section_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Father's Name:</strong> {info?.father_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Mother's Name:</strong> {info?.mother_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Phone:</strong> {info?.father_phone || info?.mother_phone || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Aadhaar No.:</strong> {info?.aadhaar_number || "-"}
                  </div>
                </div>

                <h4 className="fw-bold">
                  {info?.name} (Roll: {info?.roll_number})
                </h4>

                <h5>Scholastic Areas</h5>
                <table className="table table-bordered text-center small">
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        style={{
                          backgroundColor: "#dff0ff",
                          color: "#003366",
                          textAlign: "left",
                        }}
                      >
                        Subject
                      </th>
                      {filters.exam_ids.map((exId) => {
                        const uniqueComps = getUniqueComponentsByExam(exId);
                        return (
                          <th
                            key={exId}
                            colSpan={uniqueComps.length + (showTotals ? 2 : 0)}
                            style={{ backgroundColor: "#dff0ff", color: "#003366" }}
                          >
                            {exams.find((e) => e.id === exId)?.name}
                          </th>
                        );
                      })}
                      {showTotals && (
                        <th colSpan={2} style={{ backgroundColor: "#dff0ff", color: "#003366" }}>
                          Total
                        </th>
                      )}
                    </tr>

                    <tr>
                      {filters.exam_ids.map((exId) => (
                        <React.Fragment key={exId}>
                          {getUniqueComponentsByExam(exId).map((comp) => (
                            <th
                              key={`c-${exId}-${comp.component_id}`}
                              style={{ backgroundColor: "#e6f4ff" }}
                            >
                              {comp.label}
                            </th>
                          ))}
                          {showTotals && (
                            <>
                              <th style={{ backgroundColor: "#e6f4ff", fontWeight: "bold" }}>
                                Marks
                              </th>
                              <th style={{ backgroundColor: "#e6f4ff", fontWeight: "bold" }}>
                                Grade
                              </th>
                            </>
                          )}
                        </React.Fragment>
                      ))}
                      {showTotals && (
                        <>
                          <th style={{ backgroundColor: "#e6f4ff", fontWeight: "bold" }}>Marks</th>
                          <th style={{ backgroundColor: "#e6f4ff", fontWeight: "bold" }}>Grade</th>
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {[...new Set(student.components.map((c) => c.subject_name))].map((sub, si) => {
                      const subjComps = student.components.filter((c) => c.subject_name === sub);
                      return (
                        <tr key={si}>
                          <td
                            style={{
                              backgroundColor: "#dff0ff",
                              fontWeight: "bold",
                              textAlign: "left",
                            }}
                          >
                            {sub}
                          </td>

                          {filters.exam_ids.map((exId) => {
                            const ecs = subjComps.filter((c) => c.exam_id === exId);
                            return (
                              <React.Fragment key={exId}>
                                {getUniqueComponentsByExam(exId).map((comp) => {
                                  const cc = subjComps.find(
                                    (c) =>
                                      c.exam_id === exId && c.component_id === comp.component_id
                                  );
                                  return (
                                    <td key={`m-${exId}-${comp.component_id}`}>
                                      {cc?.marks ?? "-"}
                                    </td>
                                  );
                                })}

                                {showTotals && (
                                  <>
                                    <td style={{ fontWeight: "bold" }}>
                                      {ecs.reduce((a, x) => a + (x.marks || 0), 0)}
                                    </td>
                                    <td style={{ fontWeight: "bold" }}>{ecs[0]?.grade || "-"}</td>
                                  </>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {showTotals && (
                            <>
                              <td style={{ fontWeight: "bold" }}>
                                {subjComps.reduce((a, x) => a + (x.marks || 0), 0)}
                              </td>
                              <td style={{ fontWeight: "bold" }}>
                                {student.subject_grades?.[subjComps[0]?.subject_id] || "-"}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <h5 className="mt-4">Co-Scholastic Areas</h5>
                <table className="table table-bordered text-center small">
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#dff0ff", color: "#003366", textAlign: "left" }}>
                        Area
                      </th>
                      <th style={{ backgroundColor: "#dff0ff", color: "#003366" }}>Grade</th>
                      <th style={{ backgroundColor: "#dff0ff", color: "#003366" }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coScholastic.grades.map((grade, index) => (
                      <tr key={index}>
                        <td style={{ textAlign: "left", fontWeight: "bold" }}>{grade.area_name}</td>
                        <td>{grade.grade || "-"}</td>
                        <td>{grade.remarks || "-"}</td>
                      </tr>
                    ))}
                    {coScholastic.grades.length === 0 && (
                      <tr>
                        <td colSpan={3} className="text-center">
                          No co-scholastic data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* ✅ Attendance (Present/Total only) */}
                <h5 className="mt-4">Attendance</h5>
                <table className="table table-bordered text-center small">
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#dff0ff", color: "#003366" }}>
                        Present / Total Days
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold" }}>{presentTotal}</td>
                    </tr>
                  </tbody>
                </table>

                <h5 className="mt-4">Remarks</h5>
                <div className="border p-3 small">
                  <p>{remark || "No remarks provided"}</p>
                </div>

                {reportFormat?.footer_html && (
                  <div
                    className="report-footer mt-3 text-center small"
                    dangerouslySetInnerHTML={{ __html: reportFormat.footer_html }}
                  />
                )}

                {renderGradeSchemaInline()}
              </div>
            );
          })}
        </div>
      )}

      {/* Progress Modal */}
      <Modal show={pdfProgressVisible} centered backdrop="static" keyboard={false}>
        <Modal.Header>
          <Modal.Title>Generating PDF</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-2">{pdfMessage}</div>
          <ProgressBar now={pdfPercent} label={`${pdfPercent}%`} animated />
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              if (abortGenRef.current) abortGenRef.current.abort();
            }}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FinalResultSummary;
