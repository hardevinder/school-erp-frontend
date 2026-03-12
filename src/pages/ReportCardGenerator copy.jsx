// src/pages/FinalResultSummary.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button, ProgressBar } from "react-bootstrap";

/* ============================================================
 * ✅ CONFIG
 * ============================================================ */
const PDF_ENDPOINT = "/report-card/generate-pdf/report-card";

/* ============================================================
 * ✅ Student photo helpers
 * ============================================================ */
const apiBase = (() => {
  const b = api?.defaults?.baseURL;
  return b ? b.replace(/\/+$/, "") : window.location.origin;
})();

const buildStudentPhotoURL = (fileName) =>
  fileName ? `${apiBase}/uploads/photoes/students/${encodeURIComponent(fileName)}` : "";

const NO_PHOTO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="140">
       <defs>
         <linearGradient id="g" x1="0" x2="1">
           <stop offset="0" stop-color="#e0f2fe"/>
           <stop offset="1" stop-color="#eef2ff"/>
         </linearGradient>
       </defs>
       <rect width="100%" height="100%" fill="url(#g)"/>
       <circle cx="60" cy="48" r="24" fill="#cbd5e1"/>
       <rect x="20" y="82" width="80" height="26" rx="12" fill="#cbd5e1"/>
     </svg>`
  );

/* ============================================================
 * ✅ Date helpers
 * ============================================================ */
const pad2 = (n) => String(n).padStart(2, "0");

const formatDOB = (raw) => {
  if (!raw) return "-";
  const s = String(raw).trim();
  if (!s) return "-";

  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${pad2(m1[1])}-${pad2(m1[2])}-${m1[3]}`;

  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2) return `${pad2(m2[3])}-${pad2(m2[2])}-${m2[1]}`;

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  return s;
};

/* ============================================================
 * ✅ Attendance helpers
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

const buildAttendancePercent = (att) => {
  const p = safeInt(att?.present_days);
  const t = safeInt(att?.total_days);
  if (p == null || t == null || t <= 0) return null;
  return Number(((p / t) * 100).toFixed(2));
};

/* ============================================================
 * ✅ MARKS / GRADE helpers
 * ============================================================ */
const isNumeric = (v) => v != null && v !== "" && Number.isFinite(Number(v));

const sumMarksOnly = (arr = []) =>
  (arr || []).reduce((a, x) => a + (isNumeric(x?.marks) ? Number(x.marks) : 0), 0);

const hasAnyMarks = (arr = []) => (arr || []).some((x) => isNumeric(x?.marks));

const pickGrade = (arr = []) => {
  const hit = (arr || []).find((x) => x?.grade != null && String(x.grade).trim() !== "");
  return hit?.grade || "-";
};

const sumWeightedOnly = (arr = []) =>
  (arr || []).reduce(
    (a, x) => a + (isNumeric(x?.weighted_marks) ? Number(x.weighted_marks) : 0),
    0
  );

const sumMaxWeight = (arr = []) =>
  (arr || []).reduce(
    (a, x) => a + (isNumeric(x?.weightage_percent) ? Number(x.weightage_percent) : 0),
    0
  );

const hasDisplayRank = (rank) => {
  if (rank == null) return false;
  const s = String(rank).trim();
  return s !== "" && s !== "-" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined";
};

/* ============================================================
 * ✅ Grade from schema
 * ============================================================ */
const gradeFromSchema = (percent, gradeSchema = []) => {
  if (percent == null || !Number.isFinite(Number(percent))) return "-";
  const p = Number(percent);
  for (const g of gradeSchema || []) {
    const min = Number(g?.min_percent);
    const max = Number(g?.max_percent);
    if (Number.isFinite(min) && Number.isFinite(max) && p >= min && p <= max) {
      return g?.grade ?? "-";
    }
  }
  return "-";
};

/* ============================================================
 * ✅ Header HTML cleanup
 * ============================================================ */
const sanitizeHeaderHtml = (raw) => {
  if (!raw) return "";

  let html = String(raw);

  html = html.replace(/<[^>]*>\s*Excellence\s*\/\s*Discipline\s*<\/[^>]*>/gi, "");
  html = html.replace(/Excellence\s*\/\s*Discipline/gi, "");

  html = html.replace(
    /(ACADEMIC SESSION[^<]*)(\s*)(Annual Report Card)/gi,
    `<div style="display:block;">$1</div><div style="display:block;">$3</div>`
  );

  html = html.replace(
    /(Academic Session[^<]*)(\s*)(Annual Report Card)/gi,
    `<div style="display:block;">$1</div><div style="display:block;">$3</div>`
  );

  return html;
};

/* ============================================================
 * ✅ Subject helpers
 * ============================================================ */
const isDrawingSubject = (name = "") => {
  const s = String(name || "").trim().toLowerCase();
  return ["drawing", "art", "arts", "drawing / art", "art & craft", "craft"].includes(s);
};

const getNonDrawingSubjects = (student) =>
  Array.from(new Set((student?.components || []).map((c) => c.subject_name))).filter(
    (name) => !isDrawingSubject(name)
  );

const getDrawingGradeForTerm = (student, termId, exams, gradeSchema) => {
  if (!termId) return "-";

  const items = (student?.components || []).filter((c) => {
    const exTerm = exams.find((e) => e.id === c.exam_id)?.term_id;
    return isDrawingSubject(c.subject_name) && Number(exTerm) === Number(termId);
  });

  if (!items.length) return "-";

  const directGrade = pickGrade(items);
  if (directGrade && directGrade !== "-") return directGrade;

  const wTotal = sumWeightedOnly(items);
  const wMax = sumMaxWeight(items);
  const percent = wMax > 0 ? (wTotal / wMax) * 100 : null;

  return percent != null ? gradeFromSchema(percent, gradeSchema) : "-";
};

const buildGradeRangeFooterText = (gradeSchema = []) => {
  if (!gradeSchema?.length) return "";

  return (gradeSchema || [])
    .map((g) => {
      const min = g?.min_percent;
      const max = g?.max_percent;
      const grade = g?.grade;
      if (min == null || max == null || !grade) return "";
      return `${min}-${max} = ${grade}`;
    })
    .filter(Boolean)
    .join(", ");
};

const FinalResultSummary = () => {
  const [classList, setClassList] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [showTotals, setShowTotals] = useState(true);

  const [studentInfoMap, setStudentInfoMap] = useState({});
  const [coScholasticByTerm, setCoScholasticByTerm] = useState({});
  const [remarksByTerm, setRemarksByTerm] = useState({});
  const [attendanceByTerm, setAttendanceByTerm] = useState({});
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

  const [numberFormat] = useState({
    decimalPoints: 2,
    rounding: "none",
  });

  const [pdfProgressVisible, setPdfProgressVisible] = useState(false);
  const [pdfPercent, setPdfPercent] = useState(0);
  const [pdfMessage, setPdfMessage] = useState("Preparing…");
  const abortGenRef = useRef(null);

  const [pdfMode, setPdfMode] = useState("all");
  const [pdfSingleId, setPdfSingleId] = useState("");
  const [pdfFrom, setPdfFrom] = useState("");
  const [pdfTo, setPdfTo] = useState("");

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
          const { availableComponents, selected_components } = await loadSubjectComponentsAuto(
            class_id,
            s.id
          );
          return { subject_id: String(s.id), availableComponents, selected_components };
        } catch (e) {
          console.error("Failed to load components for subject:", s?.id, e);
          return { subject_id: String(s.id), availableComponents: [], selected_components: {} };
        }
      })
    );

    return rows.length
      ? rows
      : [{ subject_id: "", selected_components: {}, availableComponents: [] }];
  };

  const handleClassChange = async (e) => {
    const class_id = e.target.value;

    setFilters({
      class_id,
      section_id: "",
      exam_ids: [],
      subjectComponents: [{ subject_id: "", selected_components: {}, availableComponents: [] }],
    });

    setSubjects([]);
    setReportData([]);
    setStudentInfoMap({});
    setCoScholasticByTerm({});
    setRemarksByTerm({});
    setAttendanceByTerm({});

    setPdfMode("all");
    setPdfSingleId("");
    setPdfFrom("");
    setPdfTo("");

    if (!class_id) {
      setReportFormat(null);
      return;
    }

    try {
      const subjectList = await loadSubjects(class_id);
      const subjectComponents = await preselectAllSubjectsAndComponents(class_id, subjectList);

      setFilters((prev) => ({ ...prev, class_id, subjectComponents }));

      try {
        const res = await api.get("/report-card/format-by-class", { params: { class_id } });
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
        updated[index] = { subject_id, availableComponents, selected_components };
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
      if (checked) {
        if (!selected[t].includes(compId)) selected[t] = [...selected[t], compId];
      } else {
        selected[t] = selected[t].filter((id) => id !== compId);
      }

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

  const getSelectedTermIds = () => {
    const ids = (filters.exam_ids || [])
      .map((exId) => exams.find((e) => e.id === exId)?.term_id)
      .filter(Boolean)
      .map((x) => Number(x));

    const unique = Array.from(new Set(ids)).sort((a, b) => a - b);
    return unique.slice(0, 2);
  };

  const termIds = useMemo(() => getSelectedTermIds(), [filters.exam_ids, exams]);
  const term1Id = termIds[0] ?? null;
  const term2Id = termIds[1] ?? null;

  const termLabel = (tid) => (tid ? `Term-${tid}` : "Term");

  const fetchAttendanceSummary = async ({ class_id, section_id, term_id }) => {
    const endpoints = [
      "/report-card/attendance-summary",
      "/attendance-entry/summary",
      "/student-term-attendances/summary",
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
          for (const a of res.data) attendanceMap[a.student_id] = a;
        }

        return attendanceMap;
      } catch (e) {
        lastErr = e;
        const status = e?.response?.status;
        if (status !== 404) break;
      }
    }

    throw lastErr || new Error("Attendance summary API failed");
  };

  const getUniqueComponentsByTerm = (termId) => {
    if (!termId) return [];
    const compMap = new Map();

    (filters.subjectComponents || []).forEach((sc) => {
      const selectedIds = sc.selected_components?.[String(termId)] || [];
      const comps = (sc.availableComponents || []).filter(
        (c) => Number(c.term_id) === Number(termId) && selectedIds.includes(c.component_id)
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

  const term1Components = useMemo(
    () => getUniqueComponentsByTerm(term1Id),
    [term1Id, filters.subjectComponents]
  );
  const term2Components = useMemo(
    () => getUniqueComponentsByTerm(term2Id),
    [term2Id, filters.subjectComponents]
  );

  const isCompInTerm = (c, termId) => {
    if (!termId) return false;
    const exTerm = exams.find((e) => e.id === c.exam_id)?.term_id;
    return Number(exTerm) === Number(termId);
  };

  const getSubjectTermCompDisplay = (student, subjectName, termId, componentId) => {
    const items = (student.components || []).filter(
      (c) =>
        c.subject_name === subjectName &&
        isCompInTerm(c, termId) &&
        Number(c.component_id) === Number(componentId)
    );

    if (!items.length) return "-";

    if (items.some((x) => isNumeric(x?.marks))) {
      return items.reduce((a, x) => a + (isNumeric(x?.marks) ? Number(x.marks) : 0), 0);
    }

    const g = items.find((x) => x?.grade != null && String(x.grade).trim() !== "");
    return g?.grade || "-";
  };

  const getSubjectTermStats = (student, subjectName, termId) => {
    const items = (student.components || []).filter(
      (c) => c.subject_name === subjectName && isCompInTerm(c, termId)
    );

    const marksTotal = hasAnyMarks(items) ? sumMarksOnly(items) : null;

    const wTotal = sumWeightedOnly(items);
    const wMax = sumMaxWeight(items);
    const percent = wMax > 0 ? (wTotal / wMax) * 100 : null;
    const grade = percent != null ? gradeFromSchema(percent, gradeSchema) : pickGrade(items);

    return { marksTotal, percent, grade };
  };

  const getStudentTermOverall = (student, termId) => {
    const items = (student.components || []).filter((c) => isCompInTerm(c, termId));
    const wTotal = sumWeightedOnly(items);
    const wMax = sumMaxWeight(items);
    const percent = wMax > 0 ? (wTotal / wMax) * 100 : null;
    const grade = percent != null ? gradeFromSchema(percent, gradeSchema) : "-";
    return { total_weighted: wTotal, percent, grade };
  };

  const fetchReport = async () => {
    const { class_id, section_id, exam_ids } = filters;
    if (!class_id || !section_id || !exam_ids.length) {
      return Swal.fire("Missing Field", "Select class, section & exam(s)", "warning");
    }

    setLoading(true);

    const subjectComponentsPayload = (filters.subjectComponents || [])
      .filter((sc) => sc.subject_id)
      .map((sc) => ({
        subject_id: Number(sc.subject_id),
        selected_components: sc.selected_components || {},
      }))
      .filter((x) => x.subject_id);

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
      const res = await api.post("/report-card/detailed-summary", payload);
      const reportStudents = res.data.students || [];

      if (!reportStudents.length) {
        Swal.fire("No Data", "No students found for the selected filters", "info");
        setReportData([]);
        setStudentInfoMap({});
        setCoScholasticByTerm({});
        setRemarksByTerm({});
        setAttendanceByTerm({});
        setLoading(false);
        return;
      }

      setReportData(reportStudents);

      setPdfMode("all");
      setPdfSingleId("");
      setPdfFrom("");
      setPdfTo("");

      const studentIds = reportStudents.map((s) => s.id);

      const infoRes = await api.get("/report-card/students", {
        params: { student_ids: studentIds },
      });
      const studentMap = {};
      for (const s of infoRes.data.students || []) studentMap[s.id] = s;
      setStudentInfoMap(studentMap);

      const termIdsLocal = getSelectedTermIds();

      const coByTerm = {};
      for (const tid of termIdsLocal.slice(0, 2)) {
        try {
          const coRes = await api.get("/report-card/coscholastic-summary", {
            params: { class_id, section_id, term_id: tid },
          });
          coByTerm[String(tid)] = coRes.data || [];
        } catch (e) {
          console.warn("Co-scholastic failed for term", tid, e);
          coByTerm[String(tid)] = [];
        }
      }
      setCoScholasticByTerm(coByTerm);

      const remarksTermMap = {};
      for (const tid of termIdsLocal.slice(0, 2)) {
        try {
          const remarksRes = await api.get("/report-card/remarks-summary", {
            params: { class_id, section_id, term_id: tid },
          });

          const rm = {};
          for (const r of remarksRes.data.remarks || []) {
            const sid = r.student_id ?? r.studentId ?? r?.student?.id;
            const val = r.remark ?? r.remarks ?? r.text ?? r.comment ?? "";
            if (sid) rm[Number(sid)] = (val || "").trim() || "-";
          }
          remarksTermMap[String(tid)] = rm;
        } catch (e) {
          console.warn("Remarks failed for term", tid, e);
          remarksTermMap[String(tid)] = {};
        }
      }
      setRemarksByTerm(remarksTermMap);

      const attTermMap = {};
      for (const tid of termIdsLocal.slice(0, 2)) {
        try {
          const attendanceMap = await fetchAttendanceSummary({
            class_id,
            section_id,
            term_id: tid,
          });
          attTermMap[String(tid)] = attendanceMap || {};
        } catch (e) {
          console.warn("Attendance failed for term", tid, e);
          attTermMap[String(tid)] = {};
        }
      }
      setAttendanceByTerm(attTermMap);
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

  const formatPercent = (p) => (p != null ? `${formatNumber(p)}%` : "-");

  const buildScholasticHeaderHtml_TermWise = () => {
    const t1Cols = (term1Components?.length || 0) + (showTotals ? 2 : 0);
    const t2Cols = (term2Components?.length || 0) + (showTotals ? 2 : 0);
    const gCols = showTotals ? 2 : 0;

    const top = `
      <tr>
        <th rowspan="2" class="th-subject">Subject</th>
        <th colspan="${t1Cols}" class="th-term">${term1Id ? termLabel(term1Id) : "Term-I"}</th>
        <th colspan="${t2Cols}" class="th-term">${term2Id ? termLabel(term2Id) : "Term-II"}</th>
        ${showTotals ? `<th colspan="${gCols}" class="th-grand">Grand Total</th>` : ""}
      </tr>
    `;

    const bottom = `
      <tr>
        ${term1Components.map((c) => `<th class="th-comp">${c.label}</th>`).join("")}
        ${
          showTotals
            ? `<th class="th-comp strong">Total</th><th class="th-comp strong">Grade</th>`
            : ""
        }

        ${term2Components.map((c) => `<th class="th-comp">${c.label}</th>`).join("")}
        ${
          showTotals
            ? `<th class="th-comp strong">Total</th><th class="th-comp strong">Grade</th>`
            : ""
        }

        ${
          showTotals
            ? `<th class="th-comp strong">Total</th><th class="th-comp strong">Grade</th>`
            : ""
        }
      </tr>
    `;

    return top + bottom;
  };

  const buildScholasticBodyRowHtml_TermWise = (student, subjectName) => {
    const s1 = term1Id ? getSubjectTermStats(student, subjectName, term1Id) : null;
    const s2 = term2Id ? getSubjectTermStats(student, subjectName, term2Id) : null;

    const allSubj = (student.components || []).filter((c) => c.subject_name === subjectName);
    const grandMarks = hasAnyMarks(allSubj) ? sumMarksOnly(allSubj) : null;

    const gW = sumWeightedOnly(allSubj);
    const gMax = sumMaxWeight(allSubj);
    const gPct = gMax > 0 ? (gW / gMax) * 100 : null;
    const grandGrade = gPct != null ? gradeFromSchema(gPct, gradeSchema) : pickGrade(allSubj);

    let row = `<tr><td class="td-subject">${subjectName}</td>`;

    for (const c of term1Components) {
      const val = term1Id
        ? getSubjectTermCompDisplay(student, subjectName, term1Id, c.component_id)
        : "-";
      row += `<td>${val}</td>`;
    }
    if (showTotals) {
      row += `<td class="td-strong">${s1?.marksTotal != null ? s1.marksTotal : "-"}</td>`;
      row += `<td class="td-strong">${s1?.grade || "-"}</td>`;
    }

    for (const c of term2Components) {
      const val = term2Id
        ? getSubjectTermCompDisplay(student, subjectName, term2Id, c.component_id)
        : "-";
      row += `<td>${val}</td>`;
    }
    if (showTotals) {
      row += `<td class="td-strong">${s2?.marksTotal != null ? s2.marksTotal : "-"}</td>`;
      row += `<td class="td-strong">${s2?.grade || "-"}</td>`;
    }

    if (showTotals) {
      row += `<td class="td-strong">${grandMarks != null ? grandMarks : "-"}</td>`;
      row += `<td class="td-strong">${grandGrade || "-"}</td>`;
    }

    row += `</tr>`;
    return row;
  };

  const getScholasticColumnCount = () => {
    return (
      1 +
      term1Components.length +
      (showTotals ? 2 : 0) +
      term2Components.length +
      (showTotals ? 2 : 0) +
      (showTotals ? 2 : 0)
    );
  };

  const buildTotalsFooterRowHtml = (student) => {
    if (!showTotals) return "";

    const t1 = term1Id ? getStudentTermOverall(student, term1Id) : null;
    const t2 = term2Id ? getStudentTermOverall(student, term2Id) : null;

    const grandTotal = student?.total_weighted;
    const grandPct = student?.grand_percent_weighted;

    const computedGrandGradeRaw =
      student?.total_grade_weighted ||
      (grandPct != null ? gradeFromSchema(grandPct, gradeSchema) : null);

    const computedGrandGrade =
      computedGrandGradeRaw && String(computedGrandGradeRaw).trim() !== "-"
        ? String(computedGrandGradeRaw).trim()
        : null;

    const blank1 = term1Components.map(() => `<td></td>`).join("");
    const blank2 = term2Components.map(() => `<td></td>`).join("");

    const rankRow = hasDisplayRank(student?.rank)
      ? `
        <tr>
          <td class="td-rank-label">Rank</td>
          <td colspan="${getScholasticColumnCount() - 1}" class="td-rank-value">
            <span class="rank-highlight">${student.rank}</span>
          </td>
        </tr>
      `
      : "";

    const grandGradeCell = `
      ${computedGrandGrade ? `<div class="grand-grade-big">${computedGrandGrade}</div>` : ``}
      <div class="grand-percent-highlight">
        ${grandPct != null ? `${formatNumber(grandPct)}%` : "-"}
      </div>
    `;

    const term1PctCell = `<div style="font-weight:900">${formatPercent(t1?.percent)}</div>`;
    const term2PctCell = `<div style="font-weight:900">${formatPercent(t2?.percent)}</div>`;

    return `
      <tr>
        <td class="td-total-label">TOTAL</td>

        ${blank1}
        <td class="td-total"><div class="grand-total-small">${t1 ? formatNumber(t1.total_weighted) : "-"}</div></td>
        <td class="td-total">${term1PctCell}</td>

        ${blank2}
        <td class="td-total"><div class="grand-total-small">${t2 ? formatNumber(t2.total_weighted) : "-"}</div></td>
        <td class="td-total">${term2PctCell}</td>

        <td class="td-grand"><div class="grand-total-small">${formatNumber(grandTotal)}</div></td>
        <td class="td-grand">${grandGradeCell}</td>
      </tr>
      ${rankRow}
    `;
  };

  const buildCoScholasticPdfHtml_TwoTerms = (student) => {
    const studentId = student?.id;
    const t1 = term1Id ? coScholasticByTerm[String(term1Id)] || [] : [];
    const t2 = term2Id ? coScholasticByTerm[String(term2Id)] || [] : [];

    const s1 = t1.find((x) => x.id === studentId) || { grades: [] };
    const s2 = t2.find((x) => x.id === studentId) || { grades: [] };

    const areasMap = new Map();
    (s1.grades || []).forEach((g) =>
      areasMap.set(g.area_id, { area_name: g.area_name, t1: g, t2: null })
    );
    (s2.grades || []).forEach((g) => {
      const prev = areasMap.get(g.area_id);
      if (prev) areasMap.set(g.area_id, { ...prev, t2: g });
      else areasMap.set(g.area_id, { area_name: g.area_name, t1: null, t2: g });
    });

    const drawingT1 = getDrawingGradeForTerm(student, term1Id, exams, gradeSchema);
    const drawingT2 = getDrawingGradeForTerm(student, term2Id, exams, gradeSchema);

    if (drawingT1 !== "-" || drawingT2 !== "-") {
      areasMap.set("__drawing__", {
        area_name: "Drawing",
        t1: { grade: drawingT1 },
        t2: { grade: drawingT2 },
      });
    }

    const rows = Array.from(areasMap.values());

    return `
      <div class="section-title">
        <div class="section-title-left">
          <div class="section-pill">Co-Scholastic</div>
          <h5 style="margin:0;color:#0b1b3a;font-size:15px">Co-Scholastic Area</h5>
        </div>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th class="th-subject" style="text-align:left">Area</th>
            <th class="th-term">${term1Id ? termLabel(term1Id) : "Term-I"} Grade</th>
            <th class="th-term">${term2Id ? termLabel(term2Id) : "Term-II"} Grade</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (r) => `
                      <tr>
                        <td style="text-align:left;font-weight:700">${r.area_name || "-"}</td>
                        <td>${r.t1?.grade || "-"}</td>
                        <td>${r.t2?.grade || "-"}</td>
                      </tr>
                    `
                  )
                  .join("")
              : `<tr><td colspan="3" class="text-center">No co-scholastic data available</td></tr>`
          }
        </tbody>
      </table>
    `;
  };

  const buildAttendancePdfHtml_TermWise = (studentId) => {
    const a1 = term1Id ? attendanceByTerm[String(term1Id)]?.[studentId] : null;
    const a2 = term2Id ? attendanceByTerm[String(term2Id)]?.[studentId] : null;

    const t1Text = buildPresentTotalText(a1);
    const t2Text = buildPresentTotalText(a2);

    const t1Pct = buildAttendancePercent(a1);
    const t2Pct = buildAttendancePercent(a2);

    return `
      <div class="section-title">
        <div class="section-title-left">
          <div class="section-pill">Attendance</div>
          <h5 style="margin:0;color:#0b1b3a;font-size:15px">Attendance</h5>
        </div>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th class="th-term">${term1Id ? termLabel(term1Id) : "Term-I"}</th>
            <th class="th-term">${term2Id ? termLabel(term2Id) : "Term-II"}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div style="font-weight:900">${t1Text}</div>
              <div class="muted" style="margin-top:1px;font-size:11px">${
                t1Pct != null ? `${formatNumber(t1Pct)}%` : "-"
              }</div>
            </td>
            <td>
              <div style="font-weight:900">${t2Text}</div>
              <div class="muted" style="margin-top:1px;font-size:11px">${
                t2Pct != null ? `${formatNumber(t2Pct)}%` : "-"
              }</div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  };

  const buildTeacherRemarksPdfHtml_TermWise = (studentId) => {
    const r2 = term2Id ? remarksByTerm[String(term2Id)]?.[studentId] : null;

    return `
      <div class="section-title">
        <div class="section-title-left">
          <div class="section-pill">Remarks</div>
          <h5 style="margin:0;color:#0b1b3a;font-size:15px">Teacher's Remarks</h5>
        </div>
      </div>

      <div class="remarks-card">
        <div class="remarks-body">${(r2 || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </div>
    `;
  };

  const getStudentsForPdf = () => {
    if (!reportData?.length) return [];

    if (pdfMode === "single") {
      const sid = Number(pdfSingleId);
      return sid ? reportData.filter((s) => Number(s.id) === sid) : [];
    }

    if (pdfMode === "range") {
      const a = Number(pdfFrom);
      const b = Number(pdfTo);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return [];

      const minV = Math.min(a, b);
      const maxV = Math.max(a, b);

      return reportData.filter((stu) => {
        const info = studentInfoMap[stu.id] || {};
        const roll = Number(info?.roll_number);
        return Number.isFinite(roll) && roll >= minV && roll <= maxV;
      });
    }

    return reportData;
  };

  const buildCardsHtml = (studentsForPdf = reportData || []) => {
    const styles = `
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: "Helvetica", Arial, sans-serif;
          font-size: 13px;
          color: #0f172a;
          background:
            radial-gradient(1100px 600px at 12% 0%, rgba(59,130,246,0.18), transparent 60%),
            radial-gradient(1000px 520px at 88% 8%, rgba(16,185,129,0.16), transparent 60%),
            radial-gradient(900px 520px at 50% 90%, rgba(168,85,247,0.10), transparent 60%),
            linear-gradient(180deg, #eef5ff 0%, #fbfdff 100%);
        }

        @page { margin: 12px 10px; }

        section { page-break-after: always; }
        section:last-child { page-break-after: auto; }

        .card { margin-bottom: 0px; }

        .panel {
          border: 1px solid rgba(199,210,254,0.85);
          border-radius: 14px;
          padding: 9px;
          background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,251,255,0.96) 100%);
          box-shadow: 0 8px 18px rgba(10, 30, 80, 0.09);
          position: relative;
          overflow: hidden;
        }

        .header-flex {
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
        }

        .header-logo {
          height: 100px;
          width: auto;
          object-fit: contain;
        }

        .student-photo {
          width: 104px;
          height: 126px;
          border-radius: 12px;
          object-fit: cover;
          border: 2px solid rgba(191,219,254,1);
          box-shadow: 0 6px 14px rgba(0,0,0,0.14);
          background:#fff;
        }

        .grid-info{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px 8px;
          font-size: 13px;
          margin-top: 2px;
        }

        .kv{
          padding: 6px 8px;
          border-radius: 10px;
          background: rgba(255,255,255,0.8);
          border:1px solid rgba(226,232,240,0.9);
          line-height: 1.25;
        }

        .kv b{ color:#0b1b3a; }

        .section-title{
          display:flex;
          align-items:center;
          justify-content:space-between;
          margin-top: 8px;
          margin-bottom: 4px;
        }

        .section-title-left{ display:flex; align-items:center; gap:8px; }

        .section-pill{
          font-size: 9px;
          font-weight: 900;
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.22);
          color:#0b1b3a;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }

        .tbl { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.90); }

        .tbl th, .tbl td {
          border: 1px solid rgba(148,163,184,0.9);
          padding: 4px 5px;
          text-align: center;
          vertical-align: middle;
          line-height: 1.15;
          font-size: 12px;
          white-space: nowrap;
        }

        .tbl td:first-child,
        .tbl th:first-child {
          text-align: left !important;
          white-space: normal !important;
        }

        .tbl tbody tr:nth-child(odd) td { background: rgba(255,255,255,0.92); }
        .tbl tbody tr:nth-child(even) td { background: rgba(241,245,255,0.72); }

        .th-subject{
          background: linear-gradient(180deg,#e6f7ff,#dbeafe);
          color:#08335a;
          text-align:left;
          font-size: 12px;
        }

        .th-term{
          background: linear-gradient(180deg,#dbeafe,#bfdbfe);
          color:#08335a;
          font-size: 12px;
        }

        .th-grand{
          background: linear-gradient(180deg,#c7d2fe,#a5b4fc);
          color:#08335a;
          font-size: 12px;
        }

        .th-comp{ background:#eef6ff; font-weight:700; font-size:12px; }
        .th-comp.strong{ font-weight:900; }

        .td-subject{
          background: rgba(230,247,255,0.90);
          font-weight: 900;
          text-align:left;
          white-space: normal;
          font-size: 12px;
        }

        .td-strong{ font-weight: 900; }

        .td-total-label,
        .td-rank-label{
          background: linear-gradient(180deg,#c7d2fe,#a5b4fc);
          font-weight: 900;
          text-align:left;
          color:#0b1b3a;
          font-size: 12px;
        }

        .td-total{ background:#f2f7ff; font-weight:900; }
        .td-grand{ background:#e0f2fe; font-weight:900; }

        .td-rank-value{
          background: rgba(255,255,255,0.92);
          font-weight: 900;
          text-align: right !important;
          padding-right: 10px !important;
          color:#0b1b3a;
          font-size: 12px;
        }

        .grand-total-small{
          font-weight: 900;
          font-size: 11px;
          letter-spacing: 0.1px;
        }

        .grand-grade-big{
          font-weight: 900;
          font-size: 12px;
        }

        .grand-percent-highlight{
          margin-top: 1px;
          font-size: 11px;
          font-weight: 900;
          display: inline-block;
          padding: 1px 7px;
          border-radius: 8px;
          background: rgba(255, 243, 199, 0.95);
          border: 1px solid rgba(251, 191, 36, 0.55);
          color: #0b1b3a;
        }

        .rank-highlight{
          display: inline-block;
          padding: 1px 7px;
          border-radius: 8px;
          background: rgba(255, 243, 199, 0.95);
          border: 1px solid rgba(251, 191, 36, 0.55);
          color: #0b1b3a;
          font-size: 11px;
          font-weight: 900;
          line-height: 1.1;
        }

        .muted{ color:#475569; }

        .remarks-card{
          border:1px solid rgba(226,232,240,0.9);
          border-radius: 12px;
          background: rgba(255,255,255,0.86);
          overflow:hidden;
        }

        .remarks-body{
          padding: 7px 9px;
          min-height: 32px;
          line-height: 1.35;
          font-size: 13px;
        }

        .two-col{
          display:grid;
          grid-template-columns: 1.35fr 0.65fr;
          gap: 8px;
          margin-top: 6px;
        }

        .grade-footer-note{
          margin-top: 6px;
          margin-bottom: 6px;
          font-size: 11px;
          color: #334155;
          border-top: 1px dashed rgba(148,163,184,0.7);
          padding-top: 5px;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
    `;

    const gradeFooterText = buildGradeRangeFooterText(gradeSchema);

    const blocks = (studentsForPdf || []).map((student) => {
      const info = studentInfoMap[student.id] || {};
      const studentPhotoSrc = info?.photo ? buildStudentPhotoURL(info.photo) : NO_PHOTO_SVG;

      const subjectsForStudent = getNonDrawingSubjects(student);

      const scholasticTable = `
        <div class="section-title">
          <div class="section-title-left">
            <div class="section-pill">Scholastic</div>
            <h5 style="margin:0;color:#0b1b3a;font-size:15px">Scholastic Areas (Term-wise)</h5>
          </div>
        </div>
        <table class="tbl">
          <thead>${buildScholasticHeaderHtml_TermWise()}</thead>
          <tbody>
            ${subjectsForStudent.map((sub) => buildScholasticBodyRowHtml_TermWise(student, sub)).join("")}
            ${buildTotalsFooterRowHtml(student)}
          </tbody>
        </table>
      `;

      const coScholasticTable = buildCoScholasticPdfHtml_TwoTerms(student);
      const attendanceTable = buildAttendancePdfHtml_TermWise(student.id);
      const remarksBlock = buildTeacherRemarksPdfHtml_TermWise(student.id);

      const cleanHeaderHtml = sanitizeHeaderHtml(reportFormat?.header_html || "");

      const headerHtml = cleanHeaderHtml
        ? `
          <div style="margin-bottom:6px">
            <div class="header-flex">
              ${
                reportFormat.school_logo_url
                  ? `<img src="${reportFormat.school_logo_url}" alt="School Logo" class="header-logo" />`
                  : `<span style="width:90px"></span>`
              }
              <div style="text-align:center;flex:1;font-size:14px;line-height:1.32">${cleanHeaderHtml}</div>
              <img src="${studentPhotoSrc}" alt="Student Photo" class="student-photo" />
            </div>
          </div>
        `
        : "";

      const footerHtml = reportFormat?.footer_html
        ? `<div style="margin-top:6px;text-align:center;font-size:11px">${reportFormat.footer_html}</div>`
        : "";

      const dobValRaw = info?.Date_Of_Birth || info?.date_of_birth || info?.dob || "";
      const dobVal = formatDOB(dobValRaw);
      const fatherVal = info?.father_name || "-";
      const motherVal = info?.mother_name || "-";

      const studentInfoBlock = `
        <div class="panel" style="margin-bottom:8px">
          <div class="grid-info">
            <div class="kv"><b>Student Name:</b> ${info?.name || "-"}</div>
            <div class="kv"><b>Admission No.:</b> ${info?.admission_number || "-"}</div>
            <div class="kv"><b>Class / Section:</b> ${(info?.Class?.class_name || "-")} - ${(info?.Section?.section_name || "-")}</div>

            <div class="kv"><b>Date of Birth:</b> ${dobVal}</div>
            <div class="kv"><b>Mother's Name:</b> ${motherVal}</div>
            <div class="kv"><b>Father's Name:</b> ${fatherVal}</div>
          </div>
        </div>
      `;

      return `
        <section class="card">
          ${headerHtml}
          ${studentInfoBlock}
          ${scholasticTable}

          ${
            gradeFooterText
              ? `<div class="grade-footer-note"><b>Grade Scale:</b> ${gradeFooterText}</div>`
              : ""
          }

          <div class="two-col">
            <div>
              ${coScholasticTable}
            </div>
            <div>${attendanceTable}</div>
          </div>

          ${remarksBlock}
          ${footerHtml}
        </section>
      `;
    });

    return `<!doctype html><html><head><meta charset="utf-8" />${styles}</head><body>${blocks.join(
      ""
    )}</body></html>`;
  };

  const openAndDownloadPdfBlob = (blob, fileNameWithPdf) => {
    const url = window.URL.createObjectURL(blob);

    const newTab = window.open(url, "_blank");
    if (!newTab) console.warn("Popup blocked, downloading instead.");

    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameWithPdf;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  };

  const downloadPDF = async () => {
    if (!reportData.length) {
      return Swal.fire("No Data", "Please generate the report first", "info");
    }

    const selected = getStudentsForPdf();

    if (!selected.length) {
      return Swal.fire(
        "No Students Selected",
        pdfMode === "range"
          ? "Range is invalid or roll numbers not found."
          : "Please select a student.",
        "warning"
      );
    }

    const html = buildCardsHtml(selected);

    const suffix =
      pdfMode === "single"
        ? `Student_${pdfSingleId || "X"}`
        : pdfMode === "range"
        ? `Roll_${pdfFrom || "X"}-${pdfTo || "X"}`
        : "All";

    const fileName = `FinalResult_TermWise_${filters.class_id || "X"}_${filters.section_id || "X"}_${suffix}.pdf`;

    setPdfPercent(2);
    setPdfMessage("Queuing render…");
    setPdfProgressVisible(true);

    const controller = new AbortController();
    abortGenRef.current = controller;

    try {
      const res = await api.post(
        PDF_ENDPOINT,
        {
          html,
          fileName,
          orientation: "portrait",
          class_id: Number(filters.class_id),
          school_logo_url: reportFormat?.school_logo_url || null,
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
      openAndDownloadPdfBlob(blob, fileName);
    } catch (error) {
      if (controller.signal.aborted) {
        Swal.fire("Cancelled", "PDF generation was cancelled.", "info");
      } else {
        console.error(error);
        Swal.fire("Error", "Failed to generate PDF", "error");
      }
    } finally {
      setPdfProgressVisible(false);
      abortGenRef.current = null;
    }
  };

  const renderCoScholasticTwoTermsTable = (student) => {
    const studentId = student?.id;
    const t1 = term1Id ? coScholasticByTerm[String(term1Id)] || [] : [];
    const t2 = term2Id ? coScholasticByTerm[String(term2Id)] || [] : [];

    const s1 = t1.find((x) => x.id === studentId) || { grades: [] };
    const s2 = t2.find((x) => x.id === studentId) || { grades: [] };

    const areasMap = new Map();
    (s1.grades || []).forEach((g) =>
      areasMap.set(g.area_id, { area_name: g.area_name, t1: g, t2: null })
    );
    (s2.grades || []).forEach((g) => {
      const prev = areasMap.get(g.area_id);
      if (prev) areasMap.set(g.area_id, { ...prev, t2: g });
      else areasMap.set(g.area_id, { area_name: g.area_name, t1: null, t2: g });
    });

    const drawingT1 = getDrawingGradeForTerm(student, term1Id, exams, gradeSchema);
    const drawingT2 = getDrawingGradeForTerm(student, term2Id, exams, gradeSchema);

    if (drawingT1 !== "-" || drawingT2 !== "-") {
      areasMap.set("__drawing__", {
        area_name: "Drawing",
        t1: { grade: drawingT1 },
        t2: { grade: drawingT2 },
      });
    }

    const rows = Array.from(areasMap.values());

    return (
      <div className="table-responsive">
        <table className="table table-bordered text-center small">
          <thead>
            <tr>
              <th
                style={{
                  background: "linear-gradient(180deg,#e6f7ff,#dbeafe)",
                  color: "#08335a",
                  textAlign: "left",
                  fontSize: "14px",
                }}
              >
                Area
              </th>
              <th
                style={{
                  background: "linear-gradient(180deg,#dbeafe,#bfdbfe)",
                  color: "#08335a",
                  fontSize: "14px",
                }}
              >
                {term1Id ? termLabel(term1Id) : "Term-I"} Grade
              </th>
              <th
                style={{
                  background: "linear-gradient(180deg,#dbeafe,#bfdbfe)",
                  color: "#08335a",
                  fontSize: "14px",
                }}
              >
                {term2Id ? termLabel(term2Id) : "Term-II"} Grade
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: "left", fontWeight: "bold", fontSize: "14px" }}>
                  {r.area_name || "-"}
                </td>
                <td style={{ fontSize: "14px" }}>{r.t1?.grade || "-"}</td>
                <td style={{ fontSize: "14px" }}>{r.t2?.grade || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center">
                  No co-scholastic data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderAttendanceTermWise = (studentId) => {
    const a1 = term1Id ? attendanceByTerm[String(term1Id)]?.[studentId] : null;
    const a2 = term2Id ? attendanceByTerm[String(term2Id)]?.[studentId] : null;

    const t1Text = buildPresentTotalText(a1);
    const t2Text = buildPresentTotalText(a2);

    const t1Pct = buildAttendancePercent(a1);
    const t2Pct = buildAttendancePercent(a2);

    return (
      <div className="table-responsive">
        <table className="table table-bordered text-center small">
          <thead>
            <tr>
              <th
                style={{
                  background: "linear-gradient(180deg,#e6f7ff,#dbeafe)",
                  color: "#08335a",
                  fontSize: "14px",
                }}
              >
                {term1Id ? termLabel(term1Id) : "Term-I"}
              </th>
              <th
                style={{
                  background: "linear-gradient(180deg,#e6f7ff,#dbeafe)",
                  color: "#08335a",
                  fontSize: "14px",
                }}
              >
                {term2Id ? termLabel(term2Id) : "Term-II"}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 900, fontSize: "14px" }}>
                <div>{t1Text}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {t1Pct != null ? `${formatNumber(t1Pct)}%` : "-"}
                </div>
              </td>
              <td style={{ fontWeight: 900, fontSize: "14px" }}>
                <div>{t2Text}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  {t2Pct != null ? `${formatNumber(t2Pct)}%` : "-"}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderTeacherRemarksTermWise = (studentId) => {
    const r2 = term2Id ? remarksByTerm[String(term2Id)]?.[studentId] : null;

    return (
      <div className="panel small">
        <div style={{ fontSize: "14px", lineHeight: 1.45 }}>{(r2 || "-").trim() || "-"}</div>
      </div>
    );
  };

  const gradeFooterText = buildGradeRangeFooterText(gradeSchema);

  return (
    <div className="container mt-4">
      <style>{`
        body {
          background:
            radial-gradient(1200px 600px at 10% 0%, rgba(59,130,246,0.20), transparent 60%),
            radial-gradient(1000px 500px at 90% 10%, rgba(16,185,129,0.18), transparent 60%),
            radial-gradient(900px 520px at 50% 92%, rgba(168,85,247,0.12), transparent 60%),
            linear-gradient(180deg, #eef5ff 0%, #fbfdff 100%);
        }
        .page-bg {
          background:
            radial-gradient(1200px 600px at 10% 0%, rgba(59,130,246,0.18), transparent 60%),
            radial-gradient(1000px 500px at 90% 10%, rgba(16,185,129,0.16), transparent 60%),
            radial-gradient(900px 520px at 50% 92%, rgba(168,85,247,0.10), transparent 60%),
            linear-gradient(180deg, rgba(238,245,255,0.92) 0%, rgba(251,253,255,0.95) 100%);
          border-radius: 18px;
          padding: 16px;
          border: 1px solid rgba(199,210,254,0.7);
          box-shadow: 0 12px 26px rgba(10, 30, 80, 0.10);
        }
        .report-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,251,255,0.96) 100%);
          border-radius: 16px;
          border: 1px solid rgba(199,210,254,0.75);
          box-shadow: 0 12px 26px rgba(10, 30, 80, 0.12);
          position: relative;
          overflow: hidden;
        }
        .panel {
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(199,210,254,0.75);
          border-radius: 16px;
          padding: 10px;
          box-shadow: 0 8px 18px rgba(10, 30, 80, 0.08);
        }
        .report-card .table-responsive {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .report-card .table>:not(caption)>*>*{
          padding: 0.4rem 0.46rem !important;
          line-height: 1.12;
        }
        .report-card th, .report-card td {
          white-space: nowrap;
          font-size: 14px;
          vertical-align: middle;
        }
        .report-card tbody tr:nth-child(odd) td { background: rgba(255,255,255,0.92); }
        .report-card tbody tr:nth-child(even) td { background: rgba(241,245,255,0.75); }
        .report-card td:first-child, .report-card th:first-child {
          white-space: normal;
          min-width: 180px;
        }
        .sticky-first-col {
          position: sticky;
          left: 0;
          z-index: 2;
          background: linear-gradient(180deg,#e6f7ff,#dbeafe);
          text-align: left;
          font-size: 14px;
        }
        .sticky-first-col-td {
          position: sticky;
          left: 0;
          z-index: 1;
          background: rgba(230,247,255,0.92);
          text-align: left;
          font-size: 14px;
          font-weight: 900;
        }
        .section-pill {
          font-size: 10px;
          font-weight: 900;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.22);
          color:#0b1b3a;
          letter-spacing: 0.3px;
          text-transform: uppercase;
        }
        .grand-total-small {
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.1px;
        }
        .grand-grade-big {
          font-weight: 900;
          font-size: 13px;
        }
        .grand-percent-highlight{
          margin-top: 2px;
          font-size: 12px;
          font-weight: 900;
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(255, 243, 199, 0.95);
          border: 1px solid rgba(251, 191, 36, 0.55);
          color: #0b1b3a;
        }
        .rank-highlight{
          display: inline-block;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(255, 243, 199, 0.95);
          border: 1px solid rgba(251, 191, 36, 0.55);
          color: #0b1b3a;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.1;
        }
        .student-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px 10px;
        }
        .student-info-item {
          font-size: 14px;
          line-height: 1.3;
        }
        .rank-row-label {
          background: linear-gradient(180deg,#c7d2fe,#a5b4fc) !important;
          color: #0b1b3a;
          font-weight: 900;
          text-align: left;
          font-size: 14px;
        }
        .rank-row-value {
          font-weight: 900;
          text-align: right;
          padding-right: 16px !important;
          background: rgba(255,255,255,0.92);
          color:#0b1b3a;
          font-size: 14px;
        }
        .grade-footer-note{
          margin-top: 8px;
          margin-bottom: 8px;
          font-size: 13px;
          color: #334155;
          border-top: 1px dashed rgba(148,163,184,0.7);
          padding-top: 6px;
          line-height: 1.2;
          white-space: nowrap;
          overflow-x: auto;
        }
      `}</style>

      <div className="page-bg">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h2 className="mb-0">📘 Final Result Summary (Term-I & Term-II)</h2>
            <div className="text-muted small mt-1">
              Professional print-ready report cards • compact layout • better single-page fit
            </div>
          </div>
          <div className="section-pill">Print Ready</div>
        </div>

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
            <select multiple className="form-select" value={filters.exam_ids} onChange={handleExamChange}>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <div className="text-muted small mt-1">Hold Ctrl / Cmd • Select exams from both terms</div>
          </div>
        </div>

        <div className="mt-4">
          <h5 className="mb-2">Subjects & Components</h5>
          <div className="d-flex flex-wrap gap-3">
            {filters.subjectComponents.map((sc, i) => (
              <div key={i} className="panel" style={{ minWidth: 260 }}>
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
                  <div key={term} className="mb-2">
                    <small className="fw-bold">Term {term}</small>
                    <div className="d-flex flex-wrap">
                      {comps.map((c) => (
                        <div key={c.component_id} className="form-check me-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`c-${term}-${i}-${c.component_id}`}
                            checked={(sc.selected_components?.[String(term)] || []).includes(c.component_id)}
                            onChange={(e) =>
                              handleComponentToggle(+term, c.component_id, i, e.target.checked)
                            }
                          />
                          <label className="form-check-label" htmlFor={`c-${term}-${i}-${c.component_id}`}>
                            {c.abbreviation || c.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
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
            Show Total + Grade Columns
          </label>
        </div>

        {!loading && reportData.length > 0 && (
          <div className="mt-4">
            <div className="panel mb-3">
              <div className="row g-2 align-items-end">
                <div className="col-md-3">
                  <label className="form-label fw-bold">Print Mode</label>
                  <select
                    className="form-select"
                    value={pdfMode}
                    onChange={(e) => setPdfMode(e.target.value)}
                  >
                    <option value="all">All (Loaded Students)</option>
                    <option value="single">Single Student</option>
                    <option value="range">Range (Roll No.)</option>
                  </select>
                  <div className="text-muted small mt-1">Faster PDF for printing</div>
                </div>

                {pdfMode === "single" && (
                  <div className="col-md-5">
                    <label className="form-label fw-bold">Select Student</label>
                    <select
                      className="form-select"
                      value={pdfSingleId}
                      onChange={(e) => setPdfSingleId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {(reportData || []).map((s) => {
                        const info = studentInfoMap[s.id] || {};
                        return (
                          <option key={s.id} value={s.id}>
                            {info?.name || `Student #${s.id}`}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {pdfMode === "range" && (
                  <>
                    <div className="col-md-2">
                      <label className="form-label fw-bold">From Roll</label>
                      <input
                        className="form-control"
                        value={pdfFrom}
                        onChange={(e) => setPdfFrom(e.target.value)}
                        placeholder="e.g. 1"
                      />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label fw-bold">To Roll</label>
                      <input
                        className="form-control"
                        value={pdfTo}
                        onChange={(e) => setPdfTo(e.target.value)}
                        placeholder="e.g. 20"
                      />
                    </div>
                  </>
                )}

                <div className="col-md-2">
                  <button
                    className="btn btn-outline-dark w-100"
                    onClick={downloadPDF}
                    disabled={pdfProgressVisible}
                  >
                    📄 Download PDF
                  </button>
                </div>
              </div>
              <div className="small text-muted mt-2">
                Showing <b>{reportData.length}</b> students (Top 10)
              </div>
            </div>

            {reportData.map((student) => {
              const info = studentInfoMap[student.id] || {};
              const studentPhotoSrc = info?.photo ? buildStudentPhotoURL(info.photo) : NO_PHOTO_SVG;

              const subjectsForStudent = getNonDrawingSubjects(student);

              const t1 = term1Id ? getStudentTermOverall(student, term1Id) : null;
              const t2 = term2Id ? getStudentTermOverall(student, term2Id) : null;

              const dobValRaw = info?.Date_Of_Birth || info?.date_of_birth || info?.dob || "";
              const dobVal = formatDOB(dobValRaw);
              const fatherVal = info?.father_name || "-";
              const motherVal = info?.mother_name || "-";

              const cleanHeaderHtml = sanitizeHeaderHtml(reportFormat?.header_html || "");

              return (
                <div key={student.id} className="mb-5 p-3 report-card">
                  {cleanHeaderHtml && (
                    <div className="report-header mb-2">
                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        {reportFormat.school_logo_url ? (
                          <img
                            src={reportFormat.school_logo_url}
                            alt="School Logo"
                            style={{ height: "100px", width: "auto", objectFit: "contain" }}
                          />
                        ) : (
                          <div style={{ width: "100px" }} />
                        )}

                        <div
                          className="flex-grow-1 text-center"
                          style={{ fontSize: "15px", lineHeight: 1.32 }}
                          dangerouslySetInnerHTML={{ __html: cleanHeaderHtml }}
                        />

                        <img
                          src={studentPhotoSrc}
                          alt="Student Photo"
                          style={{
                            height: "126px",
                            width: "104px",
                            borderRadius: "12px",
                            objectFit: "cover",
                            border: "2px solid #bfdbfe",
                            boxShadow: "0 6px 14px rgba(0,0,0,0.14)",
                            background: "#fff",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="panel mb-2">
                    <div className="student-info-grid">
                      <div className="student-info-item">
                        <strong>Student Name:</strong> {info?.name || "-"}
                      </div>
                      <div className="student-info-item">
                        <strong>Admission No.:</strong> {info?.admission_number || "-"}
                      </div>
                      <div className="student-info-item">
                        <strong>Class / Section:</strong> {info?.Class?.class_name || "-"} -{" "}
                        {info?.Section?.section_name || "-"}
                      </div>

                      <div className="student-info-item">
                        <strong>Date of Birth:</strong> {dobVal}
                      </div>
                      <div className="student-info-item">
                        <strong>Mother's Name:</strong> {motherVal}
                      </div>
                      <div className="student-info-item">
                        <strong>Father's Name:</strong> {fatherVal}
                      </div>
                    </div>
                  </div>

                  <h5 style={{ fontSize: "18px" }}>Scholastic Areas (Term-wise)</h5>

                  <div className="table-responsive">
                    <table className="table table-bordered text-center small">
                      <thead>
                        <tr>
                          <th
                            rowSpan={2}
                            className="sticky-first-col"
                            style={{
                              background: "linear-gradient(180deg,#e6f7ff,#dbeafe)",
                              color: "#08335a",
                              textAlign: "left",
                            }}
                          >
                            Subject
                          </th>

                          <th
                            colSpan={term1Components.length + (showTotals ? 2 : 0)}
                            style={{
                              background: "linear-gradient(180deg,#dbeafe,#bfdbfe)",
                              color: "#08335a",
                            }}
                          >
                            {term1Id ? termLabel(term1Id) : "Term-I"}
                          </th>

                          <th
                            colSpan={term2Components.length + (showTotals ? 2 : 0)}
                            style={{
                              background: "linear-gradient(180deg,#dbeafe,#bfdbfe)",
                              color: "#08335a",
                            }}
                          >
                            {term2Id ? termLabel(term2Id) : "Term-II"}
                          </th>

                          {showTotals && (
                            <th
                              colSpan={2}
                              style={{
                                background: "linear-gradient(180deg,#c7d2fe,#a5b4fc)",
                                color: "#08335a",
                              }}
                            >
                              Grand Total
                            </th>
                          )}
                        </tr>

                        <tr>
                          {term1Components.map((c) => (
                            <th key={`t1-${c.component_id}`} style={{ backgroundColor: "#eef6ff" }}>
                              {c.label}
                            </th>
                          ))}
                          {showTotals && (
                            <>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Total</th>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Grade</th>
                            </>
                          )}

                          {term2Components.map((c) => (
                            <th key={`t2-${c.component_id}`} style={{ backgroundColor: "#eef6ff" }}>
                              {c.label}
                            </th>
                          ))}
                          {showTotals && (
                            <>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Total</th>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Grade</th>
                            </>
                          )}

                          {showTotals && (
                            <>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Total</th>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Grade</th>
                            </>
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {subjectsForStudent.map((sub, si) => {
                          const s1 = term1Id ? getSubjectTermStats(student, sub, term1Id) : null;
                          const s2 = term2Id ? getSubjectTermStats(student, sub, term2Id) : null;

                          const allSubj = (student.components || []).filter((c) => c.subject_name === sub);
                          const gMarks = hasAnyMarks(allSubj) ? sumMarksOnly(allSubj) : null;

                          const gW = sumWeightedOnly(allSubj);
                          const gMax = sumMaxWeight(allSubj);
                          const gPct = gMax > 0 ? (gW / gMax) * 100 : null;
                          const gGrade = gPct != null ? gradeFromSchema(gPct, gradeSchema) : pickGrade(allSubj);

                          return (
                            <tr key={si}>
                              <td
                                className="sticky-first-col-td"
                                style={{
                                  backgroundColor: "rgba(230,247,255,0.92)",
                                  fontWeight: 900,
                                  textAlign: "left",
                                }}
                              >
                                {sub}
                              </td>

                              {term1Components.map((c) => (
                                <td key={`r1-${si}-${c.component_id}`}>
                                  {term1Id
                                    ? getSubjectTermCompDisplay(student, sub, term1Id, c.component_id)
                                    : "-"}
                                </td>
                              ))}
                              {showTotals && (
                                <>
                                  <td style={{ fontWeight: 900 }}>{s1?.marksTotal != null ? s1.marksTotal : "-"}</td>
                                  <td style={{ fontWeight: 900 }}>{s1?.grade || "-"}</td>
                                </>
                              )}

                              {term2Components.map((c) => (
                                <td key={`r2-${si}-${c.component_id}`}>
                                  {term2Id
                                    ? getSubjectTermCompDisplay(student, sub, term2Id, c.component_id)
                                    : "-"}
                                </td>
                              ))}
                              {showTotals && (
                                <>
                                  <td style={{ fontWeight: 900 }}>{s2?.marksTotal != null ? s2.marksTotal : "-"}</td>
                                  <td style={{ fontWeight: 900 }}>{s2?.grade || "-"}</td>
                                </>
                              )}

                              {showTotals && (
                                <>
                                  <td style={{ fontWeight: 900 }}>
                                    <div className="grand-total-small">{gMarks != null ? gMarks : "-"}</div>
                                  </td>
                                  <td style={{ fontWeight: 900 }}>{gGrade || "-"}</td>
                                </>
                              )}
                            </tr>
                          );
                        })}

                        {showTotals && (
                          <>
                            <tr>
                              <td
                                className="sticky-first-col-td"
                                style={{
                                  background: "linear-gradient(180deg,#c7d2fe,#a5b4fc)",
                                  fontWeight: 900,
                                  textAlign: "left",
                                  color: "#0b1b3a",
                                }}
                              >
                                TOTAL
                              </td>

                              {term1Components.map((_, idx) => (
                                <td key={`b1-${idx}`}></td>
                              ))}
                              <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                <div className="grand-total-small">{t1 ? formatNumber(t1.total_weighted) : "-"}</div>
                              </td>
                              <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                {formatPercent(t1?.percent)}
                              </td>

                              {term2Components.map((_, idx) => (
                                <td key={`b2-${idx}`}></td>
                              ))}
                              <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                <div className="grand-total-small">{t2 ? formatNumber(t2.total_weighted) : "-"}</div>
                              </td>
                              <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                {formatPercent(t2?.percent)}
                              </td>

                              <td style={{ backgroundColor: "#e0f2fe" }}>
                                <div className="grand-total-small">{formatNumber(student.total_weighted)}</div>
                              </td>

                              <td style={{ backgroundColor: "#e0f2fe" }}>
                                {(() => {
                                  const gp = student?.grand_percent_weighted;
                                  const gGrade =
                                    student?.total_grade_weighted ||
                                    (gp != null ? gradeFromSchema(gp, gradeSchema) : null);

                                  return (
                                    <>
                                      {gGrade && gGrade !== "-" ? (
                                        <div className="grand-grade-big">{gGrade}</div>
                                      ) : null}

                                      <div className="grand-percent-highlight">
                                        {gp != null ? `${formatNumber(gp)}%` : "-"}
                                      </div>
                                    </>
                                  );
                                })()}
                              </td>
                            </tr>

                            {hasDisplayRank(student?.rank) && (
                              <tr>
                                <td className="rank-row-label">Rank</td>
                                <td colSpan={getScholasticColumnCount() - 1} className="rank-row-value">
                                  <span className="rank-highlight">{student.rank}</span>
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {gradeFooterText ? (
                    <div className="grade-footer-note">
                      <strong>Grade Scale:</strong> {gradeFooterText}
                    </div>
                  ) : null}

                  <div className="d-flex align-items-center justify-content-between mt-3">
                    <h5 className="mb-0" style={{ fontSize: "18px" }}>Co-Scholastic Area</h5>
                    <div className="section-pill">Co-Scholastic</div>
                  </div>
                  <div className="mt-2">{renderCoScholasticTwoTermsTable(student)}</div>

                  <div className="d-flex align-items-center justify-content-between mt-3">
                    <h5 className="mb-0" style={{ fontSize: "18px" }}>Attendance</h5>
                    <div className="section-pill">Attendance</div>
                  </div>
                  <div className="mt-2">{renderAttendanceTermWise(student.id)}</div>

                  <div className="d-flex align-items-center justify-content-between mt-3">
                    <h5 className="mb-0" style={{ fontSize: "18px" }}>Teacher's Remarks</h5>
                    <div className="section-pill">Remarks</div>
                  </div>
                  <div className="mt-2">{renderTeacherRemarksTermWise(student.id)}</div>

                  {reportFormat?.footer_html && (
                    <div
                      className="report-footer mt-3 text-center small"
                      dangerouslySetInnerHTML={{ __html: reportFormat.footer_html }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

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
    </div>
  );
};

export default FinalResultSummary;