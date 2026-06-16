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
 * Handles all cases:
 * 1) photo = only filename
 * 2) photo = /uploads/... path
 * 3) photo = full https URL
 * 4) photo_url accidentally built as /uploads/photoes/students/https%3A...
 * ============================================================ */
const normalizeBaseURL = (value) => {
  const raw = String(value || "").trim().replace(/\\/g, "/");
  if (!raw) return window.location.origin;
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  if (raw.startsWith("//")) return `${window.location.protocol}${raw}`.replace(/\/+$/, "");
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`.replace(/\/+$/, "");
  return `${window.location.origin}/${raw}`.replace(/\/+$/, "");
};

const envApiBase = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || "";
const apiBase = normalizeBaseURL(api?.defaults?.baseURL || envApiBase || window.location.origin);

// Static uploads are served from API host root, not from /api.
const assetBase = apiBase.replace(/\/api$/i, "");

const safeDecodeURIComponent = (value) => {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
};

const encodeAssetSegment = (segment) => {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
};

const encodeAssetPath = (path) =>
  String(path || "")
    .split("/")
    .filter(Boolean)
    .map(encodeAssetSegment)
    .join("/");

const isEmptyPhotoValue = (value) => {
  const s = String(value || "").trim();
  return !s || s === "-" || ["null", "undefined", "none", "na", "n/a"].includes(s.toLowerCase());
};

// If backend receives photo as a full URL but still wraps it like:
// https://api.../uploads/photoes/students/https%3A%2F%2Fapi...%2Fuploads%2Fphotoes%2Fstudents%2Ffile.jpeg
// this function extracts the real URL back.
const unwrapWrappedStudentPhotoURL = (value) => {
  const raw = String(value || "").trim().replace(/\\/g, "/");
  if (!raw) return "";

  const patterns = [
    /\/uploads\/photoes\/students\/(.+)$/i,
    /\/uploads\/photos\/students\/(.+)$/i,
    /\/photoes\/students\/(.+)$/i,
    /\/photos\/students\/(.+)$/i,
  ];

  for (const p of patterns) {
    const match = raw.match(p);
    if (!match?.[1]) continue;

    const decoded = safeDecodeURIComponent(match[1]).trim();
    if (/^https?:\/\//i.test(decoded)) return decoded;

    // Sometimes only encoded upload path is inside last segment.
    if (decoded.startsWith("/uploads/") || decoded.startsWith("uploads/")) {
      return buildStudentPhotoURL(decoded);
    }
  }

  return raw;
};

const buildStudentPhotoURL = (value) => {
  if (isEmptyPhotoValue(value)) return "";

  const unwrapped = unwrapWrappedStudentPhotoURL(value);
  const raw = String(unwrapped || "").trim().replace(/\\/g, "/");
  if (isEmptyPhotoValue(raw)) return "";

  if (/^(data:|blob:|https?:\/\/)/i.test(raw)) return raw;
  if (raw.startsWith("//")) return `${window.location.protocol}${raw}`;

  const clean = raw.replace(/^\/+/, "");

  if (clean.startsWith("uploads/")) return `${assetBase}/${encodeAssetPath(clean)}`;
  if (clean.startsWith("photoes/") || clean.startsWith("photos/")) {
    return `${assetBase}/uploads/${encodeAssetPath(clean)}`;
  }

  // If API sends path like photoes/students/file.jpeg or students/file.jpeg.
  if (clean.includes("/")) return `${assetBase}/${encodeAssetPath(clean)}`;

  // Only filename saved in DB.
  return `${assetBase}/uploads/photoes/students/${encodeAssetSegment(clean)}`;
};


const extractFirstImgSrcFromHtml = (html = "") => {
  const raw = String(html || "");
  if (!raw || !/<img\b/i.test(raw)) return "";

  const match = raw.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  return match?.[1] ? String(match[1]).trim() : "";
};

const splitUrlPreservingQuery = (value = "") => {
  const raw = String(value || "").trim();
  const hashIndex = raw.indexOf("#");
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const queryIndex = withoutHash.indexOf("?");
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  const pathOnly = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  return { pathOnly, query, hash };
};

const normalizeUploadAssetURL = (value) => {
  let raw = String(value || "").trim().replace(/\\/g, "/");
  if (isEmptyPhotoValue(raw)) return "";

  // Sometimes DB/header_html may contain a full <img ... src="..."> tag.
  const extractedSrc = extractFirstImgSrcFromHtml(raw);
  if (extractedSrc) raw = extractedSrc;

  // Decode once so encoded upload paths / wrapped URLs can be repaired.
  const decoded = safeDecodeURIComponent(raw).trim().replace(/\\/g, "/");

  if (/^data:image\//i.test(decoded) || /^blob:/i.test(decoded)) return decoded;
  if (decoded.startsWith("//")) return `${window.location.protocol}${decoded}`;

  // If an old saved URL points to localhost / another host but contains /uploads/,
  // rebuild it with the current API asset host. This is important for PDF rendering.
  const uploadMatch = decoded.match(/\/uploads\/(.+)$/i);
  if (uploadMatch?.[1]) {
    const { pathOnly, query, hash } = splitUrlPreservingQuery(uploadMatch[1]);
    return `${assetBase}/uploads/${encodeAssetPath(pathOnly)}${query}${hash}`;
  }

  if (/^https?:\/\//i.test(decoded)) return decoded;

  const clean = decoded.replace(/^\/+/, "");
  if (!clean) return "";

  if (clean.startsWith("uploads/")) {
    const rest = clean.replace(/^uploads\/+/, "");
    const { pathOnly, query, hash } = splitUrlPreservingQuery(rest);
    return `${assetBase}/uploads/${encodeAssetPath(pathOnly)}${query}${hash}`;
  }

  const { pathOnly, query, hash } = splitUrlPreservingQuery(clean);
  return `${assetBase}/${encodeAssetPath(pathOnly)}${query}${hash}`;
};

const buildPublicAssetURL = (value) => normalizeUploadAssetURL(value);

const getStudentPhotoCandidates = (info = {}) => [
  info?.photo,
  info?.Photo,
  info?.student_photo,
  info?.studentPhoto,
  info?.Student_Photo,
  info?.profile_photo,
  info?.profilePhoto,
  info?.image,
  info?.photo_path,
  info?.photoPath,
  info?.photo_url,
  info?.photoUrl,
  info?.student_photo_url,
  info?.studentPhotoUrl,
].filter((x) => !isEmptyPhotoValue(x));

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

const getStudentPhotoURL = (info = {}) => {
  const candidates = getStudentPhotoCandidates(info);

  for (const candidate of candidates) {
    const url = buildStudentPhotoURL(candidate);
    if (url) return url;
  }

  return NO_PHOTO_SVG;
};

const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const imageUrlToDataURL = async (url) => {
  if (!url || url === NO_PHOTO_SVG || /^data:/i.test(url)) return url;

  try {
    // Browser <img> can display cross-origin images without CORS, but JS fetch
    // needs CORS before we can convert the image to base64 for the backend PDF renderer.
    // Server.js must send CORS headers for /uploads.
    const fetchUrl = /^https?:\/\//i.test(url)
      ? `${url}${url.includes("?") ? "&" : "?"}_pdf_img=${Date.now()}`
      : url;

    const res = await fetch(fetchUrl, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);

    const blob = await res.blob();
    if (!blob?.type?.startsWith("image/")) throw new Error("Fetched file is not an image");

    return await blobToDataURL(blob);
  } catch (error) {
    // Keep the original URL as fallback. If server-side PDF browser can access it,
    // it will still print. For guaranteed data URLs, ensure /uploads has CORS headers.
    console.warn("Image could not be embedded as data URL. Add CORS headers on /uploads in server.js:", url, error?.message || error);
    return url;
  }
};

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

const formatDisplayDate = (raw) => {
  if (!raw) return "-";
  const s = String(raw).trim();
  if (!s) return "-";

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

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
 * ✅ Report Card Health helpers
 * Pulls data from /report-card-health and merges it into studentInfoMap.
 * Health details are saved exam-wise, so for final report cards we try:
 * 1) all selected exams, and
 * 2) all loaded exams for the selected session/class as fallback.
 * This prevents health details from missing if the user selected Term/Final
 * exams differently while generating report cards.
 * ============================================================ */
const getHealthExamIds = (selectedExamIds = [], allExams = []) => {
  const ids = [];

  for (const id of Array.isArray(selectedExamIds) ? selectedExamIds : []) {
    const n = Number(id);
    if (Number.isFinite(n) && n > 0 && !ids.includes(n)) ids.push(n);
  }

  for (const exam of Array.isArray(allExams) ? allExams : []) {
    const n = Number(exam?.id || exam?.exam_id);
    if (Number.isFinite(n) && n > 0 && !ids.includes(n)) ids.push(n);
  }

  return ids;
};

const normalizeHealthRowsPayload = (payload) => {
  const candidate = payload?.rows || payload?.data?.rows || payload?.data || payload;
  return Array.isArray(candidate) ? candidate : [];
};

const mergeHealthRowIntoStudentInfo = (info = {}, health = {}) => {
  if (!health || typeof health !== "object") return info;

  return {
    ...info,
    health_detail_id: health.health_detail_id || health.id || info.health_detail_id || null,
    height: health.height ?? info.height ?? "",
    weight: health.weight ?? info.weight ?? "",
    dental_checkup: health.dental_checkup ?? health.dental ?? info.dental_checkup ?? info.dental ?? "",
    dental: health.dental_checkup ?? health.dental ?? info.dental ?? "",
    vision: health.vision ?? info.vision ?? "",
    blood_group_snapshot:
      health.blood_group_snapshot ??
      health.blood_group ??
      health.profile_blood_group ??
      info.blood_group_snapshot ??
      info.blood_group ??
      "",
    blood_group:
      health.blood_group_snapshot ??
      health.blood_group ??
      health.profile_blood_group ??
      info.blood_group ??
      "",
    assessment_date: health.assessment_date ?? info.assessment_date ?? "",
    health_present_days: health.present_days ?? info.health_present_days ?? null,
    health_working_days: health.working_days ?? info.health_working_days ?? null,
  };
};

const getPrimaryHealthInfo = (info = {}) => {
  const present = info?.health_present_days ?? info?.present_days ?? null;
  const working = info?.health_working_days ?? info?.working_days ?? null;

  return {
    height: info?.height || "-",
    weight: info?.weight || "-",
    dental: info?.dental_checkup || info?.dental || "-",
    vision: info?.vision || "-",
    blood_group: info?.blood_group_snapshot || info?.blood_group || info?.b_group || "-",
    assessment_date: info?.assessment_date || "",
    present_days: present !== null && present !== undefined && present !== "" ? present : "-",
    working_days: working !== null && working !== undefined && working !== "" ? working : "-",
  };
};

const parseDateForAge = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  let d = null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!d && dmy) d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));

  if (!d) d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const buildAgeAtAssessmentText = (dobRaw, assessmentRaw) => {
  const dob = parseDateForAge(dobRaw);
  const onDate = parseDateForAge(assessmentRaw);

  if (!dob || !onDate || onDate < dob) return "-";

  let years = onDate.getFullYear() - dob.getFullYear();
  let months = onDate.getMonth() - dob.getMonth();

  if (onDate.getDate() < dob.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return `${years} Yrs ${months} Mths`;
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

const hasValidComponentRecord = (component = {}) => {
  if (!component || typeof component !== "object") return false;

  const subjectName = String(component.subject_name || "").trim();
  if (!subjectName) return false;

  const componentId = component.component_id ?? component.componentId;
  const componentName =
    component.component_name ||
    component.componentName ||
    component.name ||
    component.full_name ||
    component.abbreviation ||
    component.abbr ||
    component.code;

  return (
    componentId !== undefined &&
    componentId !== null &&
    String(componentId).trim() !== ""
  ) || String(componentName || "").trim() !== "";
};

const getNonDrawingSubjects = (student) =>
  Array.from(
    new Set(
      (student?.components || [])
        .filter(hasValidComponentRecord)
        .map((c) => c.subject_name)
        .filter(Boolean)
    )
  ).filter((name) => !isDrawingSubject(name));

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
  const [sessions, setSessions] = useState([]);
  const [classList, setClassList] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [showTotals, setShowTotals] = useState(true);

  const [studentInfoMap, setStudentInfoMap] = useState({});
  const [coScholasticByTerm, setCoScholasticByTerm] = useState({});
  const [remarksByTerm, setRemarksByTerm] = useState({});
  const [attendanceByTerm, setAttendanceByTerm] = useState({});
  const [promotionDecisionByTerm, setPromotionDecisionByTerm] = useState({});
  const [gradeSchema, setGradeSchema] = useState([]);

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    exam_ids: [],
    subjectComponents: [{ subject_id: "", selected_components: {}, availableComponents: [] }],
  });

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportFormat, setReportFormatState] = useState(null);
  const reportFormatRef = useRef(null);

  const setReportFormat = (format) => {
    reportFormatRef.current = format;
    setReportFormatState(format);
  };

  // ✅ Backend report-card template selection
  const [reportTemplates, setReportTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

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

  const selectedReportTemplate = useMemo(() => {
    return (reportTemplates || []).find((t) => String(t.id) === String(selectedTemplateId)) || null;
  }, [reportTemplates, selectedTemplateId]);

  // ✅ Header/footer/logo priority: class-wise ReportCardFormat first, then template fallback.
  // This makes the format configured from ReportCardFormats print at the top of the report card.
  const getReportCardFormatValue = (field) => {
    const activeReportFormat = reportFormatRef.current || reportFormat;
    const classFormatValue = activeReportFormat?.[field];
    if (classFormatValue !== undefined && classFormatValue !== null && String(classFormatValue).trim() !== "") {
      return classFormatValue;
    }

    const templateValue = selectedReportTemplate?.[field];
    if (templateValue !== undefined && templateValue !== null && String(templateValue).trim() !== "") {
      return templateValue;
    }

    return "";
  };

  const getReportCardHeaderHtml = () => getReportCardFormatValue("header_html");
  const getReportCardFooterHtml = () => getReportCardFormatValue("footer_html");

  const getSchoolLogoCandidateUrls = (formatAssets = {}) => {
    const activeReportFormat = reportFormatRef.current || reportFormat || {};

    const rawCandidates = [
      formatAssets.school_logo_url,
      activeReportFormat.school_logo_url,
      activeReportFormat.schoolLogoUrl,
      activeReportFormat.logo_url,
      activeReportFormat.logoUrl,
      activeReportFormat.logo,
      selectedReportTemplate?.school_logo_url,
      selectedReportTemplate?.schoolLogoUrl,
      selectedReportTemplate?.logo_url,
      extractFirstImgSrcFromHtml(activeReportFormat.header_html),
      extractFirstImgSrcFromHtml(selectedReportTemplate?.header_html),
    ];

    const seen = new Set();
    return rawCandidates
      .map((value) => buildPublicAssetURL(value))
      .filter((url) => {
        if (isEmptyPhotoValue(url)) return false;
        const key = String(url).trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const getReportCardSchoolLogoUrl = (formatAssets = {}) => {
    const candidates = getSchoolLogoCandidateUrls(formatAssets);
    return candidates[0] || "";
  };

  // Board logo intentionally hidden in report card print.
  const getReportCardBoardLogoUrl = () => "";

  const prepareReportFormatAssetsForPdf = async () => {
    const schoolLogoCandidates = getSchoolLogoCandidateUrls();

    for (const schoolLogoUrl of schoolLogoCandidates) {
      const schoolLogoDataUrl = await imageUrlToDataURL(schoolLogoUrl);
      if (/^data:image\//i.test(String(schoolLogoDataUrl || ""))) {
        console.log("✅ SCHOOL LOGO EMBEDDED FOR PDF:", schoolLogoUrl);
        return {
          school_logo_url: schoolLogoDataUrl,
          board_logo_url: "",
        };
      }
    }

    // Last fallback: keep a URL only if it exists. The <img> also has onerror to hide broken icon.
    return {
      school_logo_url: schoolLogoCandidates[0] || "",
      board_logo_url: "",
    };
  };

  const normalizeReportFormatResponse = (payload) => {
    const candidate =
      payload?.format ||
      payload?.reportFormat ||
      payload?.report_card_format ||
      payload?.data?.format ||
      payload?.data?.reportFormat ||
      payload?.data?.report_card_format ||
      payload?.data ||
      payload;

    const item = Array.isArray(candidate) ? candidate[0] : candidate;

    if (
      item &&
      typeof item === "object" &&
      (item.header_html ||
        item.footer_html ||
        item.school_logo_url ||
        item.board_logo_url ||
        item.title)
    ) {
      return item;
    }

    return null;
  };

  const loadReportFormatForClass = async (class_id, session_id) => {
    const isMissingId = (value) =>
      value === undefined || value === null || String(value).trim() === "";

    if (isMissingId(class_id)) {
      setReportFormat(null);
      return null;
    }

    const params = { class_id: Number(class_id) };
    if (!isMissingId(session_id)) params.session_id = Number(session_id);

    // ✅ Current backend route is /by-class.
    // ✅ Keep /format-by-class as fallback for older deployments.
    const endpoints = [
      "/report-card-formats/by-class",
      "/report-card-formats/format-by-class",
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint, { params });
        const format = normalizeReportFormatResponse(res.data);

        console.log("✅ REPORT FORMAT RAW RESPONSE:", endpoint, res.data);
        console.log("✅ NORMALIZED REPORT FORMAT:", format);

        setReportFormat(format);
        return format;
      } catch (error) {
        lastError = error;
        console.warn(
          `Report card format API failed for ${endpoint}:`,
          error?.response?.status || error?.message || error
        );
      }
    }

    console.warn("Report card format not found. Using selected template instead:", lastError);
    setReportFormat(null);
    return null;
  };

  const normalizeStudentListPayload = (payload) => {
    const candidate =
      payload?.students ||
      payload?.data?.students ||
      payload?.data ||
      payload;

    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") return [candidate];
    return [];
  };

  const buildStudentFallbackLookup = (rows = []) => {
    const byId = {};
    const byAdmission = {};

    (rows || []).forEach((row) => {
      if (!row || typeof row !== "object") return;

      const id = row.id ?? row.student_id ?? row.studentId;
      if (id !== undefined && id !== null) byId[String(id)] = row;

      const admission = row.admission_number ?? row.AdmissionNumber ?? row.admissionNo;
      if (admission !== undefined && admission !== null && String(admission).trim() !== "") {
        byAdmission[String(admission).trim()] = row;
      }
    });

    return { byId, byAdmission };
  };

  const fetchStudentFallbackLookupForClass = async ({ session_id, class_id, section_id }) => {
    const attempts = [
      {
        url: "/students/searchByClassAndSection",
        params: {
          class_id: Number(class_id),
          section_id: Number(section_id),
          session_id: session_id ? Number(session_id) : undefined,
        },
      },
      {
        url: "/students/by-session",
        params: {
          class_id: Number(class_id),
          section_id: Number(section_id),
          session_id: session_id ? Number(session_id) : undefined,
        },
      },
    ];

    for (const attempt of attempts) {
      try {
        const res = await api.get(attempt.url, { params: attempt.params });
        const rows = normalizeStudentListPayload(res.data);
        if (rows.length) {
          console.log(`✅ Student photo fallback loaded from ${attempt.url}:`, rows[0]);
          return buildStudentFallbackLookup(rows);
        }
      } catch (error) {
        console.warn(`Student fallback API failed: ${attempt.url}`, error?.response?.status || error?.message || error);
      }
    }

    return { byId: {}, byAdmission: {} };
  };

  const fetchStudentInfoByAdmissionNumber = async (admissionNumber) => {
    const admission = String(admissionNumber || "").trim();
    if (!admission) return null;

    try {
      const res = await api.get(`/students/admission/${encodeURIComponent(admission)}`);
      const rows = normalizeStudentListPayload(res.data);
      return rows[0] || null;
    } catch (error) {
      console.warn("Student photo admission fallback failed:", admission, error?.response?.status || error?.message || error);
      return null;
    }
  };

  const hasStudentPhotoCandidate = (info = {}) => getStudentPhotoCandidates(info).length > 0;

  const mergeStudentInfoWithFallback = (student = {}, reportInfo = {}, fallbackLookup = null) => {
    const idKey = String(student?.id ?? reportInfo?.id ?? reportInfo?.student_id ?? "");
    const admission = String(
      reportInfo?.admission_number ||
        reportInfo?.AdmissionNumber ||
        student?.admission_number ||
        student?.AdmissionNumber ||
        ""
    ).trim();

    const fallback =
      fallbackLookup?.byId?.[idKey] ||
      (admission ? fallbackLookup?.byAdmission?.[admission] : null) ||
      {};

    // fallback first, then report-card info, so report-card fields keep priority,
    // but photo/photo_url from fallback fills missing values.
    return {
      ...fallback,
      ...reportInfo,
      photo: reportInfo?.photo || reportInfo?.Photo || fallback?.photo || fallback?.Photo || null,
      photo_url:
        reportInfo?.photo_url ||
        reportInfo?.photoUrl ||
        reportInfo?.student_photo_url ||
        fallback?.photo_url ||
        fallback?.photoUrl ||
        fallback?.student_photo_url ||
        null,
      photoUrl:
        reportInfo?.photoUrl ||
        reportInfo?.photo_url ||
        fallback?.photoUrl ||
        fallback?.photo_url ||
        null,
    };
  };

  const prepareStudentPhotoDataUrlsForPdf = async (studentsForPdf = []) => {
    let fallbackLookup = { byId: {}, byAdmission: {} };

    try {
      fallbackLookup = await fetchStudentFallbackLookupForClass({
        session_id: filters.session_id,
        class_id: filters.class_id,
        section_id: filters.section_id,
      });
    } catch {
      fallbackLookup = { byId: {}, byAdmission: {} };
    }

    const nextInfoMap = { ...(studentInfoMap || {}) };

    await Promise.all(
      (studentsForPdf || []).map(async (student) => {
        const currentInfo = nextInfoMap[student.id] || {};
        let mergedInfo = mergeStudentInfoWithFallback(student, currentInfo, fallbackLookup);

        if (!hasStudentPhotoCandidate(mergedInfo)) {
          const admission = mergedInfo?.admission_number || student?.admission_number;
          const admissionInfo = await fetchStudentInfoByAdmissionNumber(admission);
          if (admissionInfo) mergedInfo = mergeStudentInfoWithFallback(student, mergedInfo, buildStudentFallbackLookup([admissionInfo]));
        }

        const photoUrl = getStudentPhotoURL(mergedInfo);
        const embeddedPhotoSrc = await imageUrlToDataURL(photoUrl);

        nextInfoMap[student.id] = {
          ...currentInfo,
          ...mergedInfo,
          __pdfPhotoSrc: embeddedPhotoSrc || photoUrl || NO_PHOTO_SVG,
        };

        console.log("✅ REPORT CARD PHOTO DEBUG:", {
          student_id: student.id,
          admission_number: mergedInfo?.admission_number,
          photo: mergedInfo?.photo,
          photo_url: mergedInfo?.photo_url || mergedInfo?.photoUrl,
          final_src_preview: String(nextInfoMap[student.id].__pdfPhotoSrc || "").slice(0, 120),
        });
      })
    );

    return nextInfoMap;
  };

  useEffect(() => {
    loadSessions();
    loadClasses();
    loadSections();
    loadGradeSchema();
  }, []);

  useEffect(() => {
    loadExams(filters.session_id || undefined);
  }, [filters.session_id]);

  const loadSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.sessions)
        ? res.data.sessions
        : [];

      setSessions(list);

      const active = list.find((x) => x?.is_active);
      if (active?.id) {
        setFilters((prev) => ({
          ...prev,
          session_id: prev.session_id || String(active.id),
        }));
      }
    } catch {
      Swal.fire("Error", "Failed to load sessions", "error");
    }
  };

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

  const loadExams = async (sessionId) => {
    try {
      const params = {};
      if (sessionId) params.session_id = Number(sessionId);
      const res = await api.get("/exams", { params });
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

  const loadSubjects = async (class_id, session_id) => {
    try {
      const params = { class_id };
      if (session_id) params.session_id = Number(session_id);
      const res = await api.get("/subjects", { params });
      const list = Array.isArray(res.data.subjects) ? res.data.subjects : [];
      setSubjects(list);
      return list;
    } catch {
      Swal.fire("Error", "Failed to load subjects", "error");
      setSubjects([]);
      return [];
    }
  };

  const loadReportCardTemplates = async (class_id, session_id) => {
    try {
      setLoadingTemplates(true);

      const res = await api.get("/report-card/templates", {
        params: {
          class_id: Number(class_id),
          session_id: session_id ? Number(session_id) : undefined,
        },
      });

      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.templates)
        ? res.data.templates
        : [];

      setReportTemplates(list);

      // ✅ For PLAY GROUP to UKG, prefer class-specific Primary Section template.
      // Otherwise the global Default Report Card can get selected first.
      const isPrimaryClass = ["0", "1", "2", "3"].includes(String(class_id));

      const primaryClassTemplate = list.find(
        (x) =>
          isPrimaryClass &&
          String(x.class_id) === String(class_id) &&
          x.template_key === "primary_section_report_card"
      );

      const exactClassDefaultTemplate = list.find(
        (x) =>
          String(x.class_id) === String(class_id) &&
          (x.is_default === true || Number(x.is_default) === 1)
      );

      const globalDefaultTemplate = list.find(
        (x) =>
          (x.class_id === null || x.class_id === undefined) &&
          (x.is_default === true || Number(x.is_default) === 1)
      );

      const defaultTemplate =
        primaryClassTemplate || exactClassDefaultTemplate || globalDefaultTemplate || list[0];

      setSelectedTemplateId(defaultTemplate?.id ? String(defaultTemplate.id) : "");
    } catch (error) {
      console.error("Failed to load report card templates:", error);
      setReportTemplates([]);
      setSelectedTemplateId("");
      Swal.fire("Error", "Failed to load report card templates", "error");
    } finally {
      setLoadingTemplates(false);
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

  const hasAnySelectedComponent = (row = {}) => {
    return (row.availableComponents || []).some((c) => {
      const selectedIds = row.selected_components?.[String(c.term_id)] || [];
      return selectedIds.includes(c.component_id);
    });
  };

  const componentRowHasVisibleConfig = (row = {}) =>
    !row?.subject_id || hasAnySelectedComponent(row);

  const loadSubjectComponentsAuto = async (class_id, subject_id, session_id) => {
    const params = { class_id, subject_id };
    if (session_id) params.session_id = Number(session_id);

    const res = await api.get("/exam-schemes/components/term-wise", {
      params,
    });
    const availableComponents = res.data || [];
    const selected_components = selectAllComponentsTermWise(availableComponents);
    return { availableComponents, selected_components };
  };

  const preselectAllSubjectsAndComponents = async (class_id, session_id, subjectsList) => {
    const rows = await Promise.all(
      (subjectsList || []).map(async (s) => {
        try {
          const { availableComponents, selected_components } = await loadSubjectComponentsAuto(
            class_id,
            s.id,
            session_id
          );
          return { subject_id: String(s.id), availableComponents, selected_components };
        } catch (e) {
          console.error("Failed to load components for subject:", s?.id, e);
          return { subject_id: String(s.id), availableComponents: [], selected_components: {} };
        }
      })
    );

    const rowsWithComponents = rows.filter(hasAnySelectedComponent);

    return rowsWithComponents.length
      ? rowsWithComponents
      : [{ subject_id: "", selected_components: {}, availableComponents: [] }];
  };

  const handleSessionChange = async (e) => {
    const session_id = e.target.value;

    setFilters({
      session_id,
      class_id: "",
      section_id: "",
      exam_ids: [],
      subjectComponents: [{ subject_id: "", selected_components: {}, availableComponents: [] }],
    });

    setStudentInfoMap({});
    setCoScholasticByTerm({});
    setRemarksByTerm({});
    setAttendanceByTerm({});
    setPromotionDecisionByTerm({});
    setReportFormat(null);
    setReportTemplates([]);
    setSelectedTemplateId("");

    setPdfMode("all");
    setPdfSingleId("");
    setPdfFrom("");
    setPdfTo("");
  };

  const handleClassChange = async (e) => {
    const class_id = e.target.value;

    setFilters((prev) => ({
      session_id: prev.session_id,
      class_id,
      section_id: "",
      exam_ids: [],
      subjectComponents: [{ subject_id: "", selected_components: {}, availableComponents: [] }],
    }));

    setSubjects([]);
    setReportData([]);
    setStudentInfoMap({});
    setCoScholasticByTerm({});
    setRemarksByTerm({});
    setAttendanceByTerm({});
    setPromotionDecisionByTerm({});
    setReportTemplates([]);
    setSelectedTemplateId("");

    setPdfMode("all");
    setPdfSingleId("");
    setPdfFrom("");
    setPdfTo("");

    if (!class_id) {
      setReportFormat(null);
      return;
    }

    try {
      const sessionId = filters.session_id || undefined;
      const subjectList = await loadSubjects(class_id, sessionId);
      const subjectComponents = await preselectAllSubjectsAndComponents(class_id, sessionId, subjectList);

      setFilters((prev) => ({ ...prev, class_id, subjectComponents }));

      await loadReportFormatForClass(class_id, sessionId);
      await loadReportCardTemplates(class_id, sessionId);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to prepare subject/components", "error");
    }
  };

  const handleSubjectChange = async (e, index) => {
    const subject_id = e.target.value;

    if (!filters.session_id) {
      Swal.fire("Select Session", "Please select session first", "warning");
      return;
    }

    if (!filters.class_id) {
      Swal.fire("Select Class", "Please select class first", "warning");
      return;
    }

    try {
      const { availableComponents, selected_components } = await loadSubjectComponentsAuto(
        filters.class_id,
        subject_id,
        filters.session_id
      );

      if (!availableComponents.length) {
        Swal.fire(
          "No Components",
          "This subject has no exam components, so it will not be shown on the report card.",
          "info"
        );

        setFilters((prev) => {
          const updated = [...prev.subjectComponents];
          updated[index] = { subject_id: "", availableComponents: [], selected_components: {} };
          return { ...prev, subjectComponents: updated };
        });
        return;
      }

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

  const fetchAttendanceSummary = async ({ session_id, class_id, section_id, term_id }) => {
    const endpoints = [
      "/report-card/attendance-summary",
      "/attendance-entry/summary",
      "/student-term-attendances/summary",
      "/student-term-attendance/summary",
    ];

    let lastErr = null;

    for (const url of endpoints) {
      try {
        const params = { class_id, section_id, term_id };
        if (session_id) params.session_id = Number(session_id);
        const res = await api.get(url, { params });

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
            label: c.name || c.component_name || c.componentName || c.abbreviation || "-",
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

  const hasTerm1ComponentColumns = term1Id && term1Components.length > 0;
  const hasTerm2ComponentColumns = term2Id && term2Components.length > 0;
  const hasAnyScholasticComponentColumns = hasTerm1ComponentColumns || hasTerm2ComponentColumns;

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

  const hasAbsent = items.some((x) => {
    const att = String(x?.attendance || "").trim().toUpperCase();
    return ["A", "AB", "ABSENT"].includes(att);
  });

  if (hasAbsent) return "AB";

  if (items.some((x) => isNumeric(x?.marks))) {
    return items.reduce((a, x) => a + (isNumeric(x?.marks) ? Number(x.marks) : 0), 0);
  }

  const g = items.find((x) => x?.grade != null && String(x.grade).trim() !== "");
  return g?.grade || "-";
};

  const hasSubjectTermComponent = (student, subjectName, termId, componentId) => {
    if (!termId) return false;

    return (student?.components || []).some(
      (c) =>
        c.subject_name === subjectName &&
        isCompInTerm(c, termId) &&
        Number(c.component_id) === Number(componentId)
    );
  };

  const getDisplaySubjectsForStudent = (student) =>
    getNonDrawingSubjects(student).filter((subjectName) => {
      if (!hasAnyScholasticComponentColumns) return false;

      const hasTerm1 =
        hasTerm1ComponentColumns &&
        term1Components.some((c) =>
          hasSubjectTermComponent(student, subjectName, term1Id, c.component_id)
        );

      const hasTerm2 =
        hasTerm2ComponentColumns &&
        term2Components.some((c) =>
          hasSubjectTermComponent(student, subjectName, term2Id, c.component_id)
        );

      return hasTerm1 || hasTerm2;
    });

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
    const { session_id, class_id, section_id, exam_ids } = filters;
    if (!session_id || !class_id || !section_id || !exam_ids.length) {
      return Swal.fire("Missing Field", "Select session, class, section & exam(s)", "warning");
    }

    setLoading(true);

    const subjectComponentsPayload = (filters.subjectComponents || [])
      .filter((sc) => sc.subject_id && hasAnySelectedComponent(sc))
      .map((sc) => ({
        subject_id: Number(sc.subject_id),
        selected_components: sc.selected_components || {},
      }))
      .filter((x) => x.subject_id);

    const payload = {
      session_id: +session_id,
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
        setPromotionDecisionByTerm({});
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
        params: {
          session_id: Number(session_id),
          class_id: Number(class_id),
          section_id: Number(section_id),
          student_ids: studentIds,
        },
      });
      const studentMap = {};
      for (const s of infoRes.data.students || []) studentMap[s.id] = s;

      // ✅ /report-card/students sometimes does not include photo/photo_url.
      // Pull student rows from /students/searchByClassAndSection and merge only missing photo fields.
      try {
        const fallbackLookup = await fetchStudentFallbackLookupForClass({
          session_id,
          class_id,
          section_id,
        });

        for (const stu of reportStudents) {
          studentMap[stu.id] = mergeStudentInfoWithFallback(stu, studentMap[stu.id] || {}, fallbackLookup);
        }
      } catch (photoMergeError) {
        console.warn("Student photo fallback merge skipped:", photoMergeError);
      }

      // ✅ Report Card Health details for junior/primary + classes 1 to 8.
      // Health is saved exam-wise, so try selected exams first and loaded exams as fallback.
      try {
        const healthExamIds = getHealthExamIds(exam_ids, exams);
        const mergedHealthStudentIds = new Set();

        for (const healthExamId of healthExamIds) {
          const healthRes = await api.get("/report-card-health", {
            params: {
              session_id: Number(session_id),
              class_id: Number(class_id),
              section_id: Number(section_id),
              exam_id: Number(healthExamId),
            },
          });

          const healthRows = normalizeHealthRowsPayload(healthRes.data);
          console.log("✅ REPORT CARD HEALTH ROWS:", {
            exam_id: healthExamId,
            count: healthRows.length,
          });

          for (const h of healthRows) {
            const sid = Number(h.student_id || h.studentId || h.id);
            if (!sid) continue;

            // Do not overwrite a student once health details are found from a selected exam.
            // The first matching exam in healthExamIds wins.
            if (mergedHealthStudentIds.has(sid)) continue;

            studentMap[sid] = mergeHealthRowIntoStudentInfo(studentMap[sid] || {}, h);
            mergedHealthStudentIds.add(sid);
          }
        }
      } catch (healthError) {
        // Do not block report card generation if health details are not entered yet
        // or the current user is not allowed to access this optional module.
        console.warn(
          "Report card health details skipped:",
          healthError?.response?.status || healthError?.message || healthError
        );
      }

      console.log("✅ REPORT CARD STUDENT SAMPLE:", Object.values(studentMap)[0]);
      setStudentInfoMap(studentMap);

      const termIdsLocal = getSelectedTermIds();

   const coByTerm = {};
      for (const tid of termIdsLocal.slice(0, 2)) {
        try {
          console.log("CoScholastic request", {
            session_id,
            class_id,
            section_id,
            term_id: tid,
          });

          const coRes = await api.get("/report-card/coscholastic-summary", {
            params: {
              session_id: Number(session_id),
              class_id: Number(class_id),
              section_id: Number(section_id),
              term_id: Number(tid),
            },
          });

          console.log("CoScholastic response", coRes.data);

        coByTerm[String(tid)] =
          coRes?.data && typeof coRes.data === "object" ? coRes.data : {};
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
            params: { session_id, class_id, section_id, term_id: tid },
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
            const promotionTermMap = {};
      for (const tid of termIdsLocal.slice(0, 2)) {
        try {
          const promoRes = await api.get("/student-promotion-decisions", {
            params: {
              session_id: Number(session_id),
              class_id: Number(class_id),
              section_id: Number(section_id),
              term_id: Number(tid),
            },
          });

          const pm = {};
        for (const r of promoRes.data.existingDecisions || []) {
          const sid = r.student_id ?? r.studentId ?? r?.student?.id;
          if (sid) {
            pm[Number(sid)] = {
              promotion_status: r.promotion_status || "",
              promoted_to_class_id: r.promoted_to_class_id ?? null,
              promoted_to_class_name:
                r.promotedToClass?.class_name ||
                r.promoted_to_class_name ||
                "",
              current_class_id: r.class_id ?? null,
              promotion_date: r.promotion_date || null,
            };
          }
        }
          promotionTermMap[String(tid)] = pm;
        } catch (e) {
          console.warn("Promotion decision failed for term", tid, e);
          promotionTermMap[String(tid)] = {};
        }
      }
      setPromotionDecisionByTerm(promotionTermMap);

      const attTermMap = {};
      for (const tid of termIdsLocal.slice(0, 2)) {
        try {
          const attendanceMap = await fetchAttendanceSummary({
            session_id,
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
    const showT1 = Boolean(hasTerm1ComponentColumns);
    const showT2 = Boolean(hasTerm2ComponentColumns);
    const showGrand = showTotals && (showT1 || showT2);

    if (!showT1 && !showT2 && !showGrand) {
      return `<tr><th class="th-subject">Subject</th></tr>`;
    }

    const t1Cols = showT1 ? term1Components.length + (showTotals ? 2 : 0) : 0;
    const t2Cols = showT2 ? term2Components.length + (showTotals ? 2 : 0) : 0;
    const gCols = showGrand ? 2 : 0;

    const top = `
      <tr>
        <th rowspan="2" class="th-subject">Subject</th>
        ${showT1 ? `<th colspan="${t1Cols}" class="th-term">${termLabel(term1Id)}</th>` : ""}
        ${showT2 ? `<th colspan="${t2Cols}" class="th-term">${termLabel(term2Id)}</th>` : ""}
        ${showGrand ? `<th colspan="${gCols}" class="th-grand">Grand Total</th>` : ""}
      </tr>
    `;

    const bottom = `
      <tr>
        ${showT1 ? term1Components.map((c) => `<th class="th-comp">${c.label}</th>`).join("") : ""}
        ${
          showT1 && showTotals
            ? `<th class="th-comp strong">Total</th><th class="th-comp strong">Grade</th>`
            : ""
        }

        ${showT2 ? term2Components.map((c) => `<th class="th-comp">${c.label}</th>`).join("") : ""}
        ${
          showT2 && showTotals
            ? `<th class="th-comp strong">Total</th><th class="th-comp strong">Grade</th>`
            : ""
        }

        ${
          showGrand
            ? `<th class="th-comp strong">Total</th><th class="th-comp strong">Grade</th>`
            : ""
        }
      </tr>
    `;

    return top + bottom;
  };

  const buildScholasticBodyRowHtml_TermWise = (student, subjectName) => {
    const showT1 = Boolean(hasTerm1ComponentColumns);
    const showT2 = Boolean(hasTerm2ComponentColumns);
    const showGrand = showTotals && (showT1 || showT2);

    const s1 = showT1 ? getSubjectTermStats(student, subjectName, term1Id) : null;
    const s2 = showT2 ? getSubjectTermStats(student, subjectName, term2Id) : null;

    const allSubj = (student.components || []).filter((c) => c.subject_name === subjectName);
    const grandMarks = hasAnyMarks(allSubj) ? sumMarksOnly(allSubj) : null;

    const gW = sumWeightedOnly(allSubj);
    const gMax = sumMaxWeight(allSubj);
    const gPct = gMax > 0 ? (gW / gMax) * 100 : null;
    const grandGrade = gPct != null ? gradeFromSchema(gPct, gradeSchema) : pickGrade(allSubj);

    let row = `<tr><td class="td-subject">${subjectName}</td>`;

    if (showT1) {
      for (const c of term1Components) {
        const val = getSubjectTermCompDisplay(student, subjectName, term1Id, c.component_id);
        row += `<td>${val}</td>`;
      }

      if (showTotals) {
        row += `<td class="td-strong">${s1?.marksTotal != null ? s1.marksTotal : "-"}</td>`;
        row += `<td class="td-strong">${s1?.grade || "-"}</td>`;
      }
    }

    if (showT2) {
      for (const c of term2Components) {
        const val = getSubjectTermCompDisplay(student, subjectName, term2Id, c.component_id);
        row += `<td>${val}</td>`;
      }

      if (showTotals) {
        row += `<td class="td-strong">${s2?.marksTotal != null ? s2.marksTotal : "-"}</td>`;
        row += `<td class="td-strong">${s2?.grade || "-"}</td>`;
      }
    }

    if (showGrand) {
      row += `<td class="td-strong">${grandMarks != null ? grandMarks : "-"}</td>`;
      row += `<td class="td-strong">${grandGrade || "-"}</td>`;
    }

    row += `</tr>`;
    return row;
  };

  const getScholasticColumnCount = () => {
    const showT1 = Boolean(hasTerm1ComponentColumns);
    const showT2 = Boolean(hasTerm2ComponentColumns);
    const showGrand = showTotals && (showT1 || showT2);

    return (
      1 +
      (showT1 ? term1Components.length + (showTotals ? 2 : 0) : 0) +
      (showT2 ? term2Components.length + (showTotals ? 2 : 0) : 0) +
      (showGrand ? 2 : 0)
    );
  };

  const buildTotalsFooterRowHtml = (student) => {
    const showT1 = Boolean(hasTerm1ComponentColumns);
    const showT2 = Boolean(hasTerm2ComponentColumns);
    const showGrand = showTotals && (showT1 || showT2);

    if (!showTotals || (!showT1 && !showT2)) return "";

    const t1 = showT1 ? getStudentTermOverall(student, term1Id) : null;
    const t2 = showT2 ? getStudentTermOverall(student, term2Id) : null;

    const grandTotal = student?.total_weighted;
    const grandPct = student?.grand_percent_weighted;

    const computedGrandGradeRaw =
      student?.total_grade_weighted ||
      (grandPct != null ? gradeFromSchema(grandPct, gradeSchema) : null);

    const computedGrandGrade =
      computedGrandGradeRaw && String(computedGrandGradeRaw).trim() !== "-"
        ? String(computedGrandGradeRaw).trim()
        : null;

    const blank1 = showT1
      ? `<td colspan="${term1Components.length}" style="color:#0b1b3a !important;"></td>`
      : "";

    const blank2 = showT2
      ? `<td colspan="${term2Components.length}" style="color:#0b1b3a !important;"></td>`
      : "";

    const rankRow = hasDisplayRank(student?.rank)
      ? `
      <tr>
        <td
          class="td-rank-label"
          style="background:linear-gradient(180deg,#1e3a8a,#1e40af);color:#ffffff !important;font-weight:900;text-align:left;"
        >
          Rank
        </td>
        <td
          colspan="${getScholasticColumnCount() - 1}"
          class="td-rank-value"
          style="background:#fff7cc !important;color:#0b1b3a !important;font-weight:900;text-align:right !important;padding-right:12px !important;"
        >
          <span
            class="rank-highlight"
            style="display:inline-block;padding:1px 7px;border-radius:8px;background:rgba(255,243,199,0.95);border:1px solid rgba(251,191,36,0.55);color:#0b1b3a !important;font-size:11px;font-weight:900;line-height:1.1;"
          >
            ${student.rank}
          </span>
        </td>
      </tr>
    `
      : "";

    const grandGradeCell = `
    ${computedGrandGrade
      ? `<div style="font-weight:900;font-size:12px;color:#0b1b3a !important;">${computedGrandGrade}</div>`
      : ``}
    <div
      style="margin-top:1px;font-size:11px;font-weight:900;display:inline-block;padding:1px 7px;border-radius:8px;background:rgba(255,243,199,0.95);border:1px solid rgba(251,191,36,0.55);color:#0b1b3a !important;"
    >
      ${grandPct != null ? `${formatNumber(grandPct)}%` : "-"}
    </div>
  `;

    const term1Cells = showT1
      ? `
      ${blank1}
      <td class="td-total" style="background:#ffe066 !important;color:#0b1b3a !important;font-weight:900;">
        <div style="font-weight:900;font-size:11px;letter-spacing:0.1px;color:#0b1b3a !important;">
          ${formatNumber(t1?.total_weighted)}
        </div>
      </td>
      <td class="td-total" style="background:#ffe066 !important;color:#0b1b3a !important;font-weight:900;">
        <div style="font-weight:900;color:#0b1b3a !important;">${formatPercent(t1?.percent)}</div>
      </td>
    `
      : "";

    const term2Cells = showT2
      ? `
      ${blank2}
      <td class="td-total" style="background:#ffe066 !important;color:#0b1b3a !important;font-weight:900;">
        <div style="font-weight:900;font-size:11px;letter-spacing:0.1px;color:#0b1b3a !important;">
          ${formatNumber(t2?.total_weighted)}
        </div>
      </td>
      <td class="td-total" style="background:#ffe066 !important;color:#0b1b3a !important;font-weight:900;">
        <div style="font-weight:900;color:#0b1b3a !important;">${formatPercent(t2?.percent)}</div>
      </td>
    `
      : "";

    const grandCells = showGrand
      ? `
      <td class="td-grand" style="background:#ffd43b !important;color:#0b1b3a !important;font-weight:900;">
        <div style="font-weight:900;font-size:11px;letter-spacing:0.1px;color:#0b1b3a !important;">
          ${formatNumber(grandTotal)}
        </div>
      </td>
      <td class="td-grand" style="background:#ffd43b !important;color:#0b1b3a !important;font-weight:900;">
        ${grandGradeCell}
      </td>
    `
      : "";

    return `
    <tr>
      <td class="td-total-label" style="background:linear-gradient(180deg,#1e3a8a,#1e40af);color:#ffffff !important;font-weight:900;text-align:left;">
        TOTAL
      </td>
      ${term1Cells}
      ${term2Cells}
      ${grandCells}
    </tr>
    ${rankRow}
  `;
  };

  const buildCoScholasticPdfHtml_TwoTerms = (student) => {
  const studentId = student?.id;
  const t1 = term1Id ? coScholasticByTerm[String(term1Id)] || {} : {};
  const t2 = term2Id ? coScholasticByTerm[String(term2Id)] || {} : {};

  const s1 = Object.values(t1[String(studentId)] || {});
  const s2 = Object.values(t2[String(studentId)] || {});

    const areasMap = new Map();
    s1.forEach((g) =>
      areasMap.set(g.area_id, { area_name: g.area_name, t1: g, t2: null })
    );

    s2.forEach((g) => {
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
  const promotion = term2Id
    ? promotionDecisionByTerm[String(term2Id)]?.[studentId]
    : null;

  const showPromotionFields =
    promotion &&
    promotion.promotion_status === "PROMOTED" &&
    promotion.promoted_to_class_id &&
    Number(promotion.promoted_to_class_id) !== Number(promotion.current_class_id);

  return `
    <div class="section-title">
      <div class="section-title-left">
        <div class="section-pill">Remarks</div>
        <h5 style="margin:0;color:#0b1b3a;font-size:15px">Teacher's Remarks</h5>
      </div>
    </div>

    <div class="remarks-grid" style="display:grid;grid-template-columns:1fr;gap:8px;">
      <div class="remarks-card">
        <div class="remarks-body">         
          <div>${(r2 || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      </div>

      ${
  showPromotionFields
    ? `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
    <div class="remarks-card">
      <div class="remarks-body" style="font-size:13px;line-height:1.45;color:#0b1b3a;">
        <span style="font-weight:800;color:#475569;">Promoted To Class:</span>
        <span style="font-weight:700;"> ${promotion.promoted_to_class_name || "-"}</span>
      </div>
    </div>

    <div class="remarks-card">
      <div class="remarks-body" style="font-size:13px;line-height:1.45;color:#0b1b3a;">
        <span style="font-weight:800;color:#475569;">Promotion Date:</span>
        <span style="font-weight:700;">
          ${promotion.promotion_date ? formatDisplayDate(promotion.promotion_date) : "-"}
        </span>
      </div>
    </div>
  </div>
`
    : ""
}
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

  const isPrimarySectionTemplateActive = () => {
    const isPrimaryClass = ["0", "1", "2", "3"].includes(String(filters.class_id));
    const selectedIsPrimary = selectedReportTemplate?.template_key === "primary_section_report_card";
    const classHasPrimaryTemplate = (reportTemplates || []).some(
      (t) =>
        t.template_key === "primary_section_report_card" &&
        String(t.class_id) === String(filters.class_id)
    );

    return selectedIsPrimary || (isPrimaryClass && classHasPrimaryTemplate);
  };

  const escapePrimaryHtml = (value) =>
    String(value ?? "-")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const primaryComponentFallbackNames = {
    english_communication_language_literacy: {
      OA: "Oral Assessment",
      ROP: "Recognition of Pictures",
      SCON: "Sentence Construction",
      VOC: "Vocabulary",
      REC: "Recitation",
      FI: "Fluency and Interaction",
    },
    cognitive_mathematical_development: {
      OA: "Oral Assessment",
      SMO: "Sorting, Matching and Ordering",
      SER: "Seriation",
      UQ: "Understanding Quantity",
      REC: "Recognition",
      MA: "Mental Ability",
    },
    social_development_self_help: {
      WT: "Working Together",
      SF: "Self Feeding",
      PD: "Personal Development",
      FCR: "Follows Classroom Rules",
      TCB: "Takes Care of Belongings",
      IW: "Independent Work",
      CHF: "Cleanliness and Hygiene",
      CONF: "Confidence",
      OBD: "Obedience",
      PUNC: "Punctuality",
    },
    understanding_of_environment: {
      OA: "Oral Assessment",
      STN: "Sense of Nature",
      ASI: "Awareness of Surroundings",
      FH: "Family and Home",
      AHH: "Animals, Homes and Habitats",
      IA: "Identification Activity",
    },
    physical_mobility_stamina: {
      PMS: "Physical Mobility and Stamina",
      NC: "Neuro-Muscular Coordination",
    },
    creative_development: {
      RTR: "Rhymes, Tunes and Rhythm",
      SIT: "Singing in Tune",
      HMI: "Hand-Muscle Integration",
      CR: "Creativity",
      DC: "Drawing and Colouring",
      HOWK: "Handwork",
    },
    default: {
      OA: "Oral Assessment",
      ROP: "Recognition of Pictures",
      SCON: "Sentence Construction",
      VOC: "Vocabulary",
      REC: "Recognition",
      FI: "Fluency and Interaction",
      SMO: "Sorting, Matching and Ordering",
      SER: "Seriation",
      UQ: "Understanding Quantity",
      MA: "Mental Ability",
      WT: "Working Together",
      SF: "Self Feeding",
      PD: "Personal Development",
      FCR: "Follows Classroom Rules",
      TCB: "Takes Care of Belongings",
      IW: "Independent Work",
      CHF: "Cleanliness and Hygiene",
      CONF: "Confidence",
      OBD: "Obedience",
      PUNC: "Punctuality",
      STN: "Sense of Nature",
      ASI: "Awareness of Surroundings",
      FH: "Family and Home",
      AHH: "Animals, Homes and Habitats",
      IA: "Identification Activity",
      PMS: "Physical Mobility and Stamina",
      NC: "Neuro-Muscular Coordination",
      RTR: "Rhymes, Tunes and Rhythm",
      SIT: "Singing in Tune",
      HMI: "Hand-Muscle Integration",
      CR: "Creativity",
      DC: "Drawing and Colouring",
      HOWK: "Handwork",
    },
  };

  const normalizePrimaryKey = (value = "") =>
    String(value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const getNestedPrimaryValue = (obj, keys = []) => {
    for (const key of keys) {
      const value = key.split(".").reduce((acc, part) => acc?.[part], obj);
      if (value != null && String(value).trim() !== "") return String(value).trim();
    }
    return "";
  };

  const getPrimaryComponentName = (component) =>
    getNestedPrimaryValue(component, [
      "full_name",
      "fullName",
      "component_full_name",
      "componentFullName",
      "display_name",
      "displayName",
      "component_display_name",
      "componentDisplayName",
      "AssessmentComponent.full_name",
      "AssessmentComponent.fullName",
      "AssessmentComponent.display_name",
      "AssessmentComponent.displayName",
      "AssessmentComponent.component_full_name",
      "AssessmentComponent.componentFullName",
      "component.full_name",
      "component.fullName",
      "component.display_name",
      "component.displayName",
      "component_name",
      "componentName",
      "name",
      "AssessmentComponent.name",
      "component.name",
      "abbreviation",
    ]) || "Assessment";

  const getPrimaryComponentAbbreviation = (component, rawName = "") => {
    const explicit = getNestedPrimaryValue(component, [
      "abbreviation",
      "abbr",
      "short_name",
      "shortName",
      "code",
      "component_code",
      "componentCode",
      "AssessmentComponent.abbreviation",
      "AssessmentComponent.abbr",
      "AssessmentComponent.short_name",
      "AssessmentComponent.shortName",
      "AssessmentComponent.code",
      "component.abbreviation",
      "component.abbr",
      "component.short_name",
      "component.shortName",
      "component.code",
    ]);

    if (explicit) return explicit.toUpperCase();

    const s = String(rawName || "").trim();
    const firstToken = s.match(/^([A-Z]{1,8})(?=\s|\(|-|$)/);
    if (firstToken) return firstToken[1].toUpperCase();

    return "";
  };

  const getPrimaryFallbackComponentFullName = (abbr, subjectName) => {
    const code = String(abbr || "").trim().toUpperCase();
    if (!code) return "";

    const subjectKey = normalizePrimaryKey(subjectName);
    const subjectMap = primaryComponentFallbackNames[subjectKey] || {};
    return subjectMap[code] || primaryComponentFallbackNames.default[code] || "";
  };

  const getPrimaryComponentDisplayName = (component, subjectName) => {
    const rawName = getPrimaryComponentName(component);
    const abbr = getPrimaryComponentAbbreviation(component, rawName);
    const cleanedName = cleanPrimaryComponentName(rawName, subjectName);
    const isOnlyAbbreviation =
      abbr && cleanedName.toUpperCase() === abbr.toUpperCase();

    const fallbackFullName = getPrimaryFallbackComponentFullName(abbr, subjectName);
    const fullName = isOnlyAbbreviation ? fallbackFullName || cleanedName : cleanedName;

    if (!abbr || fullName.toUpperCase() === abbr.toUpperCase()) return fullName || "Assessment";
    if (new RegExp(`\\(${escapeRegExp(abbr)}\\)`, "i").test(fullName)) return fullName;

    return `${fullName} (${abbr})`;
  };

  const getAllSubjectsForPrimary = (student) =>
    Array.from(
      new Set(
        (student?.components || [])
          .filter(hasValidComponentRecord)
          .map((c) => c.subject_name)
          .filter(Boolean)
      )
    ).filter((subjectName) => getPrimarySubjectComponents(student, subjectName).length > 0);

  const escapeRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const cleanPrimaryComponentName = (name, subjectName) => {
    let label = String(name || "Assessment").trim();
    const subject = String(subjectName || "").trim();

    if (subject) {
      label = label.replace(new RegExp(`\\s*\\(${escapeRegExp(subject)}\\)\\s*$`, "i"), "");
    }

    return label.replace(/\s{2,}/g, " ").trim() || "Assessment";
  };

  const getPrimarySubjectComponents = (student, subjectName) => {
    const compMap = new Map();

    (student?.components || [])
      .filter((c) => c.subject_name === subjectName && hasValidComponentRecord(c))
      .forEach((c) => {
        const key = Number(c.component_id) || getPrimaryComponentName(c);
        if (!compMap.has(key)) {
          compMap.set(key, {
            component_id: c.component_id,
            name: getPrimaryComponentDisplayName(c, subjectName),
          });
        }
      });

    return Array.from(compMap.values());
  };

  const hasPrimaryComponentInTerm = (student, subjectName, termId, componentId) => {
    if (!termId) return false;

    return (student?.components || []).some(
      (c) =>
        c.subject_name === subjectName &&
        isCompInTerm(c, termId) &&
        Number(c.component_id) === Number(componentId)
    );
  };

  const buildPrimarySubjectTableHtml = (student, subjectName) => {
    const components = getPrimarySubjectComponents(student, subjectName);
    if (!components.length) return "";

    const showT1 =
      term1Id &&
      components.some((component) =>
        hasPrimaryComponentInTerm(student, subjectName, term1Id, component.component_id)
      );

    const showT2 =
      term2Id &&
      components.some((component) =>
        hasPrimaryComponentInTerm(student, subjectName, term2Id, component.component_id)
      );

    if (!showT1 && !showT2) return "";

    const s1 = showT1 ? getSubjectTermStats(student, subjectName, term1Id) : null;
    const s2 = showT2 ? getSubjectTermStats(student, subjectName, term2Id) : null;
    const totalCols = 1 + (showT1 ? 1 : 0) + (showT2 ? 1 : 0);

    return `
      <table class="primary-subject-table">
        <thead>
          <tr>
            <th colspan="${totalCols}" class="primary-subject-title">${escapePrimaryHtml(subjectName)}</th>
          </tr>
          <tr>
            <th class="skill-name-col">Assessment / Component</th>
            ${showT1 ? `<th>${termLabel(term1Id)}</th>` : ""}
            ${showT2 ? `<th>${termLabel(term2Id)}</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${components
            .filter(
              (component) =>
                (showT1 && hasPrimaryComponentInTerm(student, subjectName, term1Id, component.component_id)) ||
                (showT2 && hasPrimaryComponentInTerm(student, subjectName, term2Id, component.component_id))
            )
            .map((component) => {
              const t1 = showT1
                ? getSubjectTermCompDisplay(student, subjectName, term1Id, component.component_id)
                : "-";
              const t2 = showT2
                ? getSubjectTermCompDisplay(student, subjectName, term2Id, component.component_id)
                : "-";

              return `
                <tr>
                  <td class="skill-name">${escapePrimaryHtml(component.name)}</td>
                  ${showT1 ? `<td>${escapePrimaryHtml(t1)}</td>` : ""}
                  ${showT2 ? `<td>${escapePrimaryHtml(t2)}</td>` : ""}
                </tr>
              `;
            })
            .join("")}
          <tr class="primary-overall-row">
            <td>Overall Grade</td>
            ${showT1 ? `<td>${escapePrimaryHtml(s1?.grade || "-")}</td>` : ""}
            ${showT2 ? `<td>${escapePrimaryHtml(s2?.grade || "-")}</td>` : ""}
          </tr>
        </tbody>
      </table>
    `;
  };

  const buildPrimaryCoScholasticRowsHtml = (student) => {
    const studentId = student?.id;
    const t1 = term1Id ? coScholasticByTerm[String(term1Id)] || {} : {};
    const t2 = term2Id ? coScholasticByTerm[String(term2Id)] || {} : {};

    const s1 = Object.values(t1[String(studentId)] || {});
    const s2 = Object.values(t2[String(studentId)] || {});

    const map = new Map();
    s1.forEach((g) => map.set(g.area_id, { area_name: g.area_name, t1: g, t2: null }));
    s2.forEach((g) => {
      const prev = map.get(g.area_id);
      if (prev) map.set(g.area_id, { ...prev, t2: g });
      else map.set(g.area_id, { area_name: g.area_name, t1: null, t2: g });
    });

    const rows = Array.from(map.values());

    return rows.length
      ? rows
          .map(
            (r) => `
              <tr>
                <td class="skill-name">${escapePrimaryHtml(r.area_name || "-")}</td>
                <td>${escapePrimaryHtml(r.t1?.grade || "-")}</td>
                <td>${escapePrimaryHtml(r.t2?.grade || "-")}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td colspan="3">No co-scholastic data available</td></tr>`;
  };

  const buildPrimarySectionCardsHtml = (studentsForPdf = reportData || [], infoMapOverride = studentInfoMap, formatAssets = {}) => {
    const styles = `
      <style>
        * { box-sizing: border-box; }
        @page { size: A4 landscape; margin: 5mm; }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 8.2px;
          color: #0f172a;
          background: #fff7ed;
        }
        section.primary-card {
          position: relative;
          page-break-after: always;
          page-break-inside: avoid;
          break-inside: avoid;
          border: 2px solid #7c3aed;
          border-radius: 14px;
          padding: 5px;
          height: 200mm;
          max-height: 200mm;
          overflow: hidden;
          background:
            radial-gradient(520px 180px at 8% 0%, rgba(251,191,36,0.28), transparent 62%),
            radial-gradient(520px 180px at 92% 0%, rgba(56,189,248,0.22), transparent 62%),
            radial-gradient(460px 160px at 50% 100%, rgba(244,114,182,0.18), transparent 66%),
            linear-gradient(180deg, #ffffff 0%, #fffaf0 100%);
        }
        section.primary-card:last-child { page-break-after: auto; }
        section.primary-card::before,
        section.primary-card::after {
          content: '';
          position: absolute;
          width: 90px;
          height: 90px;
          border-radius: 999px;
          opacity: 0.16;
          pointer-events: none;
        }
        section.primary-card::before { right: -38px; top: -38px; background: #22c55e; }
        section.primary-card::after { left: -42px; bottom: -42px; background: #fb7185; }
        .primary-header {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 90px 1fr 86px;
          gap: 4px;
          align-items: center;
          border: 1.6px solid #a78bfa;
          border-radius: 12px;
          padding: 3px 4px;
          margin-bottom: 3px;
          background: linear-gradient(90deg, #eef2ff 0%, #ecfeff 50%, #fff7ed 100%);
        }
        .primary-logo {
          width: 82px;
          height: 82px;
          object-fit: contain;
        }
        .primary-photo {
          width: 78px;
          height: 90px;
          object-fit: cover;
          border: 2px solid #38bdf8;
          border-radius: 10px;
          justify-self: end;
          background: #fff;
        }
        .primary-school {
          text-align: center;
          line-height: 1.22;
          font-size: 9.4px;
          color: #0f172a;
        }
        .primary-school h1 {
          margin: 0 0 3px 0;
          font-size: 15px;
          color: #4c1d95;
          text-transform: uppercase;
          letter-spacing: .25px;
        }
        .primary-title {
          display: inline-block;
          margin-top: 3px;
          padding: 2px 14px;
          border: 1px solid #7c3aed;
          border-radius: 999px;
          background: linear-gradient(90deg, #fde68a, #fbcfe8);
          color: #581c87;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 9.4px;
        }
        .student-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 3px;
          margin-bottom: 3px;
        }
        .student-cell {
          border: 1px solid #bae6fd;
          border-radius: 9px;
          padding: 1.8px 5px;
          min-height: 15px;
          line-height: 1.08;
          background: rgba(255,255,255,0.86);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.56);
        }
        .label { font-weight: 900; color: #7c2d12; }
        .subject-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 3px;
          align-items: stretch;
        }
        .primary-subject-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          page-break-inside: avoid;
          break-inside: avoid;
          margin-bottom: 2px;
          height: 100%;
          overflow: hidden;
          border: 1px solid #c4b5fd;
          border-radius: 10px;
          background: #fff;
        }
        .primary-subject-table th,
        .primary-subject-table td {
          border-right: 1px solid #ddd6fe;
          border-bottom: 1px solid #ddd6fe;
          padding: 1.6px 3px;
          text-align: center;
          vertical-align: middle;
          line-height: 1.03;
        }
        .primary-subject-table tr:last-child td { border-bottom: 0; }
        .primary-subject-table th:last-child,
        .primary-subject-table td:last-child { border-right: 0; }
        .primary-subject-table th {
          background: #e0f2fe;
          color: #075985;
          font-weight: 900;
        }
        .primary-subject-title {
          background: linear-gradient(90deg, #7c3aed, #0ea5e9) !important;
          color: #ffffff !important;
          text-transform: uppercase;
          font-size: 8.3px;
          letter-spacing: .18px;
        }
        .skill-name-col { width: 72%; }
        .skill-name {
          text-align: left !important;
          font-weight: 700;
          color: #1e293b;
          white-space: normal;
          word-break: normal;
        }
        .primary-overall-row td {
          background: #fef3c7;
          color: #7c2d12;
          font-weight: 900;
        }
        .bottom-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 0.9fr 1.35fr 1fr;
          gap: 3px;
          margin-top: 3px;
        }
        .small-box {
          border: 1px solid #c4b5fd;
          border-radius: 11px;
          min-height: 38px;
          overflow: hidden;
          background: rgba(255,255,255,0.92);
        }
        .box-title {
          border-bottom: 1px solid rgba(255,255,255,0.45);
          text-align: center;
          font-weight: 900;
          padding: 3px 5px;
          text-transform: uppercase;
          color: #ffffff;
          letter-spacing: .18px;
        }
        .small-box:nth-child(1) .box-title { background: linear-gradient(90deg, #06b6d4, #3b82f6); }
        .small-box:nth-child(2) .box-title { background: linear-gradient(90deg, #22c55e, #84cc16); }
        .small-box:nth-child(3) .box-title { background: linear-gradient(90deg, #f97316, #ec4899); }
        .box-body { padding: 3px 5px; line-height: 1.12; }
        .health-chip-row { display:flex; flex-wrap:wrap; gap:3px; }
        .health-chip {
          display:inline-block;
          padding: 2px 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, #f0fdf4, #ecfeff);
          border: 1px solid #86efac;
          font-weight: 800;
          margin: 1px 2px 1px 0;
          color:#0f172a;
        }
        .health-chip:nth-child(2n) { background: linear-gradient(90deg, #eff6ff, #f5f3ff); border-color:#bfdbfe; }
        .health-chip:nth-child(3n) { background: linear-gradient(90deg, #fff7ed, #fef3c7); border-color:#fed7aa; }
        .health-chip b { color:#166534; }
        .sign-row {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 5px;
          text-align: center;
          font-weight: 900;
          color: #1e293b;
        }
        .signature-space {
          height: 16px;
          border-bottom: 1.4px dashed #7c3aed;
          margin-bottom: 3px;
        }
        .sign-line { padding-top: 0; line-height: 1.05; }
        .grade-key {
          position: relative;
          z-index: 1;
          margin-top: 3px;
          border: 1px solid #f9a8d4;
          border-radius: 999px;
          overflow: hidden;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1.7fr;
          background: #fff;
        }
        .grade-key div {
          border-right: 1px solid #fbcfe8;
          padding: 2px 4px;
          text-align: center;
          font-weight: 700;
        }
        .grade-key div:nth-child(1) { background:#dcfce7; }
        .grade-key div:nth-child(2) { background:#dbeafe; }
        .grade-key div:nth-child(3) { background:#fef3c7; }
        .grade-key div:nth-child(4) { background:#fce7f3; }
        .grade-key div:last-child { border-right: 0; }
      </style>
    `;

    const cards = (studentsForPdf || []).map((student) => {
      const info = infoMapOverride[student.id] || studentInfoMap[student.id] || {};
      const mergedInfoForPhoto = { ...student, ...info };
      const studentPhotoSrc = info?.__pdfPhotoSrc || getStudentPhotoURL(mergedInfoForPhoto);
      const allSubjects = getAllSubjectsForPrimary(student);

      const effectiveHeaderHtml = getReportCardHeaderHtml();
      const effectiveSchoolLogoUrl = getReportCardSchoolLogoUrl(formatAssets);
      const cleanHeaderHtml = sanitizeHeaderHtml(effectiveHeaderHtml);

      const dobValRaw = info?.Date_Of_Birth || info?.date_of_birth || info?.dob || "";
      const dobVal = formatDOB(dobValRaw);

      const a1 = term1Id ? attendanceByTerm[String(term1Id)]?.[student.id] : null;
      const a2 = term2Id ? attendanceByTerm[String(term2Id)]?.[student.id] : null;
      const r2 = term2Id ? remarksByTerm[String(term2Id)]?.[student.id] : null;

      const health = getPrimaryHealthInfo(info);
      const ageAtAssessment = buildAgeAtAssessmentText(dobValRaw, health.assessment_date);
      const healthAttendanceText =
        health.present_days !== "-" || health.working_days !== "-"
          ? `${health.present_days} / ${health.working_days}`
          : "-";
      const healthAssessmentDateText = health.assessment_date
        ? formatDisplayDate(health.assessment_date)
        : "-";

      return `
        <section class="primary-card">
          <div class="primary-header">
            <div>
              ${
                effectiveSchoolLogoUrl
                  ? `<img src="${escapePrimaryHtml(effectiveSchoolLogoUrl)}" class="primary-logo" onerror="this.style.display='none';" />`
                  : `<div style="font-weight:800;text-align:center;">School<br/>Logo</div>`
              }
            </div>
            <div class="primary-school">
              ${
                cleanHeaderHtml
                  ? cleanHeaderHtml
                  : `<h1>School Name</h1><div>Primary Section</div><div class="primary-title">Report Card</div>`
              }
            </div>
            <img src="${escapePrimaryHtml(studentPhotoSrc)}" alt="Student Photo" class="primary-photo" onerror="this.onerror=null;this.src='${NO_PHOTO_SVG}';" />
          </div>

          <div class="student-grid">
            <div class="student-cell"><span class="label">Student Name:</span> ${escapePrimaryHtml(info?.name)}</div>
            <div class="student-cell"><span class="label">Admission No.:</span> ${escapePrimaryHtml(info?.admission_number)}</div>
            <div class="student-cell"><span class="label">Class / Section:</span> ${escapePrimaryHtml(info?.Class?.class_name)} - ${escapePrimaryHtml(info?.Section?.section_name)}</div>
            <div class="student-cell"><span class="label">Roll No.:</span> ${escapePrimaryHtml(info?.roll_number)}</div>
            <div class="student-cell"><span class="label">Date of Birth:</span> ${escapePrimaryHtml(dobVal)}</div>
            <div class="student-cell"><span class="label">Age at Assessment:</span> ${escapePrimaryHtml(ageAtAssessment)}</div>
            <div class="student-cell"><span class="label">Mother's Name:</span> ${escapePrimaryHtml(info?.mother_name)}</div>
            <div class="student-cell"><span class="label">Father's Name:</span> ${escapePrimaryHtml(info?.father_name)}</div>
            <div class="student-cell"><span class="label">Session:</span> ${escapePrimaryHtml(sessions.find((x) => String(x.id) === String(filters.session_id))?.name || "-")}</div>
            <div class="student-cell"><span class="label">Assessment Date:</span> ${escapePrimaryHtml(healthAssessmentDateText)}</div>
            <div class="student-cell"><span class="label">Class Teacher:</span> ${escapePrimaryHtml(info?.class_teacher_name || "-")}</div>
            <div class="student-cell"><span class="label">Blood Group:</span> ${escapePrimaryHtml(health.blood_group)}</div>
          </div>

          <div class="subject-grid">
            ${
              allSubjects.length
                ? allSubjects.map((subjectName) => buildPrimarySubjectTableHtml(student, subjectName)).join("")
                : `<table class="primary-subject-table"><tr><td>No scholastic data available</td></tr></table>`
            }
          </div>

          <div class="bottom-grid">
            <div class="small-box">
              <div class="box-title">Attendance</div>
              <div class="box-body">
                <div><b>${term1Id ? termLabel(term1Id) : "Term-I"}:</b> ${escapePrimaryHtml(buildPresentTotalText(a1))}</div>
                <div><b>${term2Id ? termLabel(term2Id) : "Term-II"}:</b> ${escapePrimaryHtml(buildPresentTotalText(a2))}</div>
                <div><b>Health Entry:</b> ${escapePrimaryHtml(healthAttendanceText)}</div>
              </div>
            </div>
            <div class="small-box">
              <div class="box-title">Health Details</div>
              <div class="box-body health-chip-row">
                <span class="health-chip"><b>Height:</b> ${escapePrimaryHtml(health.height)}</span>
                <span class="health-chip"><b>Weight:</b> ${escapePrimaryHtml(health.weight)}</span>
                <span class="health-chip"><b>Dental Check-up:</b> ${escapePrimaryHtml(health.dental)}</span>
                <span class="health-chip"><b>Vision:</b> ${escapePrimaryHtml(health.vision)}</span>
                <span class="health-chip"><b>Blood Group:</b> ${escapePrimaryHtml(health.blood_group)}</span>
                <span class="health-chip"><b>Age at Assessment:</b> ${escapePrimaryHtml(ageAtAssessment)}</span>
              </div>
            </div>
            <div class="small-box">
              <div class="box-title">Class Teacher's Remark</div>
              <div class="box-body">${escapePrimaryHtml(r2 || "-")}</div>
            </div>
          </div>

          <div class="sign-row">
            <div class="sign-line"><div class="signature-space"></div>Class Teacher's Sign.</div>
            <div class="sign-line"><div class="signature-space"></div>Headmistress Sign.</div>
            <div class="sign-line"><div class="signature-space"></div>Principal's Sign.</div>
          </div>

          <div class="grade-key">
            <div><b>G</b> Excellent</div>
            <div><b>B</b> Very Good</div>
            <div><b>Y</b> Good</div>
            <div><b>R</b> Is learning with guidance but still needs encouragement</div>
          </div>
        </section>
      `;
    });

    return `<!doctype html><html><head><meta charset="utf-8" />${styles}</head><body>${cards.join("")}</body></html>`;
  };

  const buildCardsHtml = (studentsForPdf = reportData || [], infoMapOverride = studentInfoMap, formatAssets = {}) => {
    if (isPrimarySectionTemplateActive()) {
      return buildPrimarySectionCardsHtml(studentsForPdf, infoMapOverride, formatAssets);
    }

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
        padding: 8px;
        background: linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,251,255,0.96) 100%);
        box-shadow: 0 8px 18px rgba(10, 30, 80, 0.09);
        position: relative;
        overflow: hidden;
      }

      .header-flex {
        display: grid;
        grid-template-columns: 132px 1fr 132px;
        align-items: center;
        gap: 10px;
      }

      .header-left {
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;
        padding-top: 18px;
        padding-left: 8px;
      }

      .header-center {
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 132px;
        padding: 0 8px;
        font-size: 14px;
        line-height: 1.15;
        color: #0b1b3a;
      }

      .header-center .rc-header {
        text-align: center;
        padding: 10px 8px 8px;
        line-height: 1.15;
        background: transparent;
      }

      .header-center .school-address {
        margin: 2px 0 0 !important;
      }

      .header-center .rc-session {
        margin-top: 6px !important;
        font-size: 17px !important;
        line-height: 1.1 !important;
        letter-spacing: 0.6px !important;
      }

      .header-center .rc-title {
        margin-top: 2px !important;
      }

      .header-right {
        display: flex;
        justify-content: flex-end;
        align-items: flex-start;
        gap: 8px;
      }

      .header-logo {
        height: 108px;
        width: auto;
        object-fit: contain;
        display: block;
        flex-shrink: 0;
        margin-left: 8px;
      }

      .student-photo {
        width: 112px;
        height: 134px;
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
        margin-top: 6px;
        margin-bottom: 3px;
      }

      .section-title-left{
        display:flex;
        align-items:center;
        gap:8px;
      }

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

      .tbl {
        width: 100%;
        border-collapse: collapse;
        background: rgba(255,255,255,0.95);
      }

      .tbl th,
      .tbl td {
        border: 1px solid rgba(148,163,184,0.9);
        padding: 7px 9px;
        text-align: center;
        vertical-align: middle;
        line-height: 1.25;
        font-size: 9.4px;
        white-space: nowrap;
      }

      .tbl td:first-child,
      .tbl th:first-child {
        text-align: left !important;
        white-space: normal !important;
      }

      .tbl thead th{
        background: linear-gradient(180deg,#1e3a8a,#1e40af);
        color: #ffffff;
        font-weight: 800;
      }

      .tbl tbody td{
        background: #fff7cc;
        color: #0f172a;
      }

      .tbl tbody tr:nth-child(even) td{
        background: #fff2a8;
        color: #0f172a;
      }

      .th-subject{
        background: linear-gradient(180deg,#1e3a8a,#1e40af);
        color:#ffffff;
        text-align:left;
        font-size: 9.4px;
      }

      .th-term{
        background: linear-gradient(180deg,#1e3a8a,#1e40af);
        color:#ffffff;
        font-size: 9.4px;
      }

      .th-grand{
        background: linear-gradient(180deg,#172554,#1e3a8a);
        color:#ffffff;
        font-size: 9.4px;
      }

      .th-comp{
        background: linear-gradient(180deg,#1e40af,#2563eb);
        color:#ffffff;
        font-weight:700;
        font-size:12px;
      }

      .th-comp.strong{
        font-weight:900;
      }

      .td-subject{
        background: #ffe68a !important;
        color: #0b1b3a !important;
        font-weight: 900;
        text-align:left;
        white-space: normal;
        font-size: 9.4px;
      }

      .td-strong{
        font-weight: 900;
        color:#0b1b3a !important;
      }

      .td-total-label,
      .td-rank-label{
        background: linear-gradient(180deg,#1e3a8a,#1e40af);
        font-weight: 900;
        text-align:left;
        color:#ffffff !important;
        font-size: 9.4px;
      }

      .td-total{
        background:#ffe066 !important;
        font-weight:900;
        color:#0b1b3a !important;
      }

      .td-grand{
        background:#ffd43b !important;
        font-weight:900;
        color:#0b1b3a !important;
      }

      .td-rank-value{
        background: #fff7cc !important;
        font-weight: 900;
        text-align: right !important;
        padding-right: 12px !important;
        color:#0b1b3a !important;
        font-size: 9.4px;
      }

      .grand-total-small{
        font-weight: 900;
        font-size: 11px;
        letter-spacing: 0.1px;
        color:#0b1b3a !important;
      }

      .grand-grade-big{
        font-weight: 900;
        font-size: 9.4px;
        color:#0b1b3a !important;
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
        color: #0b1b3a !important;
      }

      .rank-highlight{
        display: inline-block;
        padding: 1px 7px;
        border-radius: 8px;
        background: rgba(255, 243, 199, 0.95);
        border: 1px solid rgba(251, 191, 36, 0.55);
        color: #0b1b3a !important;
        font-size: 11px;
        font-weight: 900;
        line-height: 1.1;
      }

      .muted{
        color:#475569;
      }

      .health-panel{
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        margin-top: 4px;
      }

      .health-metric{
        border:1px solid rgba(191,219,254,0.95);
        border-radius: 12px;
        padding: 6px 8px;
        background: linear-gradient(135deg, rgba(239,246,255,0.98), rgba(240,253,250,0.98));
        line-height: 1.18;
        min-height: 38px;
      }

      .health-metric:nth-child(2n){
        background: linear-gradient(135deg, rgba(250,245,255,0.98), rgba(253,242,248,0.98));
        border-color: rgba(216,180,254,0.9);
      }

      .health-metric:nth-child(3n){
        background: linear-gradient(135deg, rgba(255,251,235,0.98), rgba(255,247,237,0.98));
        border-color: rgba(253,186,116,0.9);
      }

      .health-label{
        display:block;
        font-size: 9px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: .22px;
        color:#0f766e;
      }

      .health-value{
        display:block;
        margin-top: 2px;
        font-size: 12px;
        font-weight: 900;
        color:#0f172a;
      }

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
        color:#0f172a;
      }

      .two-col{
        display:grid;
        grid-template-columns: 1fr;
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
      const info = infoMapOverride[student.id] || studentInfoMap[student.id] || {};
      const mergedInfoForPhoto = { ...student, ...info };
      const studentPhotoSrc = info?.__pdfPhotoSrc || getStudentPhotoURL(mergedInfoForPhoto);

      const subjectsForStudent = getDisplaySubjectsForStudent(student);

      const scholasticTable = subjectsForStudent.length && hasAnyScholasticComponentColumns
        ? `
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
    `
        : "";

      const attendanceTable = buildAttendancePdfHtml_TermWise(student.id);
      const remarksBlock = buildTeacherRemarksPdfHtml_TermWise(student.id);

      const effectiveHeaderHtml = getReportCardHeaderHtml();
      const effectiveFooterHtml = getReportCardFooterHtml();
      const effectiveSchoolLogoUrl = getReportCardSchoolLogoUrl(formatAssets);

      const cleanHeaderHtml = sanitizeHeaderHtml(effectiveHeaderHtml);

      const headerHtml = cleanHeaderHtml
        ? `
        <div style="margin-bottom:8px">
          <div class="header-flex">
            <div class="header-left">
              ${
                effectiveSchoolLogoUrl
                  ? `<img src="${effectiveSchoolLogoUrl}" alt="School Logo" class="header-logo" onerror="this.style.display='none';" />`
                  : `<span style="width:95px;display:block;"></span>`
              }
            </div>

            <div class="header-center">
              <div>${cleanHeaderHtml}</div>
            </div>

            <div class="header-right">
              <img src="${escapePrimaryHtml(studentPhotoSrc)}" alt="Student Photo" class="student-photo" onerror="this.onerror=null;this.src='${NO_PHOTO_SVG}';" />
            </div>
          </div>
        </div>
      `
        : "";

      const footerHtml = effectiveFooterHtml
        ? `<div style="margin-top:6px;text-align:center;font-size:11px;color:#334155">${effectiveFooterHtml}</div>`
        : "";

      const dobValRaw = info?.Date_Of_Birth || info?.date_of_birth || info?.dob || "";
      const dobVal = formatDOB(dobValRaw);
      const fatherVal = info?.father_name || "-";
      const motherVal = info?.mother_name || "-";

      const health = getPrimaryHealthInfo(info);
      const ageAtAssessment = buildAgeAtAssessmentText(dobValRaw, health.assessment_date);
      const healthAttendanceText =
        health.present_days !== "-" || health.working_days !== "-"
          ? `${health.present_days} / ${health.working_days}`
          : "-";

      const studentInfoBlock = `
      <div class="panel" style="margin-bottom:8px">
        <div class="grid-info">
          <div class="kv"><b>Student Name:</b> ${info?.name || "-"}</div>
          <div class="kv"><b>Admission No.:</b> ${info?.admission_number || "-"}</div>
          <div class="kv"><b>Class / Section:</b> ${(info?.Class?.class_name || "-")} - ${(info?.Section?.section_name || "-")}</div>

          <div class="kv"><b>Date of Birth:</b> ${dobVal}</div>
          <div class="kv"><b>Age at Assessment:</b> ${escapePrimaryHtml(ageAtAssessment)}</div>
          <div class="kv"><b>Blood Group:</b> ${escapePrimaryHtml(health.blood_group)}</div>

          <div class="kv"><b>Mother's Name:</b> ${motherVal}</div>
          <div class="kv"><b>Father's Name:</b> ${fatherVal}</div>
          <div class="kv"><b>Assessment Date:</b> ${escapePrimaryHtml(health.assessment_date ? formatDisplayDate(health.assessment_date) : "-")}</div>
        </div>
      </div>
    `;

      const healthDetailsBlock = `
      <div class="section-title">
        <div class="section-title-left">
          <div class="section-pill">Health</div>
          <h5 style="margin:0;color:#0b1b3a;font-size:15px">Health & Extra Details</h5>
        </div>
      </div>
      <div class="health-panel">
        <div class="health-metric"><span class="health-label">Attendance</span><span class="health-value">${escapePrimaryHtml(healthAttendanceText)}</span></div>
        <div class="health-metric"><span class="health-label">Height</span><span class="health-value">${escapePrimaryHtml(health.height)}</span></div>
        <div class="health-metric"><span class="health-label">Weight</span><span class="health-value">${escapePrimaryHtml(health.weight)}</span></div>
        <div class="health-metric"><span class="health-label">Dental Check-up</span><span class="health-value">${escapePrimaryHtml(health.dental)}</span></div>
        <div class="health-metric"><span class="health-label">Vision</span><span class="health-value">${escapePrimaryHtml(health.vision)}</span></div>
        <div class="health-metric"><span class="health-label">Blood Group</span><span class="health-value">${escapePrimaryHtml(health.blood_group)}</span></div>
        <div class="health-metric"><span class="health-label">Age at the Time of Assessment</span><span class="health-value">${escapePrimaryHtml(ageAtAssessment)}</span></div>
        <div class="health-metric"><span class="health-label">Assessment Date</span><span class="health-value">${escapePrimaryHtml(health.assessment_date ? formatDisplayDate(health.assessment_date) : "-")}</span></div>
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
          <div>${attendanceTable}</div>
        </div>

        ${healthDetailsBlock}

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

    if (!selectedTemplateId) {
      return Swal.fire(
        "Select Template",
        "Please select a report card template before generating PDF.",
        "warning"
      );
    }

    const suffix =
      pdfMode === "single"
        ? `Student_${pdfSingleId || "X"}`
        : pdfMode === "range"
        ? `Roll_${pdfFrom || "X"}-${pdfTo || "X"}`
        : "All";

    const fileName = `FinalResult_TermWise_${filters.session_id || "X"}_${filters.class_id || "X"}_${filters.section_id || "X"}_${suffix}.pdf`;

    setPdfPercent(1);
    setPdfMessage("Preparing student photos…");
    setPdfProgressVisible(true);

    const controller = new AbortController();
    abortGenRef.current = controller;

    try {
      setPdfMessage("Refreshing report format…");
      await loadReportFormatForClass(filters.class_id, filters.session_id);

      const [pdfInfoMap, pdfFormatAssets] = await Promise.all([
        prepareStudentPhotoDataUrlsForPdf(selected),
        prepareReportFormatAssetsForPdf(),
      ]);
      const html = buildCardsHtml(selected, pdfInfoMap, pdfFormatAssets);

      setPdfPercent(2);
      setPdfMessage("Queuing render…");

      const res = await api.post(
        PDF_ENDPOINT,
        {
          html,
          fileName,
          orientation: isPrimarySectionTemplateActive() ? "landscape" : selectedReportTemplate?.orientation || "portrait",
          session_id: Number(filters.session_id),
          class_id: Number(filters.class_id),
          template_id: Number(selectedTemplateId),
          template_key: selectedReportTemplate?.template_key || null,
          selected_template: selectedReportTemplate || null,
          school_logo_url: getReportCardFormatValue("school_logo_url") || null,
          asset_base_url: assetBase,
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
    const t1 = term1Id ? coScholasticByTerm[String(term1Id)] || {} : {};
    const t2 = term2Id ? coScholasticByTerm[String(term2Id)] || {} : {};

    const s1 = Object.values(t1[String(studentId)] || {});
    const s2 = Object.values(t2[String(studentId)] || {});

    const areasMap = new Map();
    s1.forEach((g) =>
      areasMap.set(g.area_id, { area_name: g.area_name, t1: g, t2: null })
    );

    s2.forEach((g) => {
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
  const promotion = term2Id
    ? promotionDecisionByTerm[String(term2Id)]?.[studentId]
    : null;

  const showPromotionFields =
    promotion &&
    promotion.promotion_status === "PROMOTED" &&
    promotion.promoted_to_class_id &&
    Number(promotion.promoted_to_class_id) !== Number(promotion.current_class_id);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: "8px",
      }}
    >
      <div className="panel small">
     
        <div style={{ fontSize: "14px", lineHeight: 1.45 }}>
          {(r2 || "-").trim() || "-"}
        </div>
      </div>

      {showPromotionFields && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
          }}
        >
          <div className="panel small">
            <div
              style={{
                fontSize: "13px",
                lineHeight: 1.45,
                color: "#0b1b3a",
              }}
            >
              <span style={{ fontWeight: 800, color: "#475569" }}>
                Promoted To Class:
              </span>{" "}
              <span style={{ fontWeight: 700 }}>
                {promotion.promoted_to_class_name || "-"}
              </span>
            </div>
          </div>

          <div className="panel small">
            <div
              style={{
                fontSize: "13px",
                lineHeight: 1.45,
                color: "#0b1b3a",
              }}
            >
              <span style={{ fontWeight: 800, color: "#475569" }}>
                Promotion Date:
              </span>{" "}
              <span style={{ fontWeight: 700 }}>
                {promotion.promotion_date
                  ? formatDisplayDate(promotion.promotion_date)
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      )}
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
          font-size: 9.4px;
          letter-spacing: 0.1px;
        }
        .grand-grade-big {
          font-weight: 900;
          font-size: 13px;
        }
        .grand-percent-highlight{
          margin-top: 2px;
          font-size: 9.4px;
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
          font-size: 9.4px;
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
          <div className="col-md-3">
            <label>Session</label>
            <select className="form-select" value={filters.session_id} onChange={handleSessionChange}>
              <option value="">Select Session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                  {session.is_active ? " (Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
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

          <div className="col-md-3">
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

          <div className="col-md-3">
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
            {filters.subjectComponents
              .map((sc, i) => ({ sc, i }))
              .filter(({ sc }) => componentRowHasVisibleConfig(sc))
              .map(({ sc, i }) => (
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
                            {c.name || c.component_name || c.componentName || c.abbreviation}
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

                <div className="col-md-3">
                  <label className="form-label fw-bold">Report Card Template</label>
                  <select
                    className="form-select"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={loadingTemplates || !filters.class_id}
                  >
                    <option value="">
                      {loadingTemplates ? "Loading templates…" : "Select Template"}
                    </option>
                    {reportTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.is_default ? " (Default)" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="text-muted small mt-1">Selected template will be sent to backend</div>
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
              const studentPhotoSrc = getStudentPhotoURL(info);

              const subjectsForStudent = getDisplaySubjectsForStudent(student);

              const t1 = term1Id ? getStudentTermOverall(student, term1Id) : null;
              const t2 = term2Id ? getStudentTermOverall(student, term2Id) : null;

              const dobValRaw = info?.Date_Of_Birth || info?.date_of_birth || info?.dob || "";
              const dobVal = formatDOB(dobValRaw);
              const fatherVal = info?.father_name || "-";
              const motherVal = info?.mother_name || "-";

              const effectiveHeaderHtml = getReportCardHeaderHtml();
              const effectiveFooterHtml = getReportCardFooterHtml();
              const effectiveSchoolLogoUrl = getReportCardSchoolLogoUrl();
              const cleanHeaderHtml = sanitizeHeaderHtml(effectiveHeaderHtml);

              return (
                <div key={student.id} className="mb-5 p-3 report-card">
                  {cleanHeaderHtml && (
                    <div className="report-header mb-2">
                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        {effectiveSchoolLogoUrl ? (
                          <img
                            src={effectiveSchoolLogoUrl}
                            alt="School Logo"
                            style={{
                              height: "100px",
                              width: "auto",
                              objectFit: "contain",
                              marginTop: "12px",
                              display: "block",
                              flexShrink: 0,
                            }}
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
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = NO_PHOTO_SVG;
                          }}
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

                  {subjectsForStudent.length && hasAnyScholasticComponentColumns ? (
                    <>
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

                          {hasTerm1ComponentColumns && (
                            <th
                              colSpan={term1Components.length + (showTotals ? 2 : 0)}
                              style={{
                                background: "linear-gradient(180deg,#dbeafe,#bfdbfe)",
                                color: "#08335a",
                              }}
                            >
                              {termLabel(term1Id)}
                            </th>
                          )}

                          {hasTerm2ComponentColumns && (
                            <th
                              colSpan={term2Components.length + (showTotals ? 2 : 0)}
                              style={{
                                background: "linear-gradient(180deg,#dbeafe,#bfdbfe)",
                                color: "#08335a",
                              }}
                            >
                              {termLabel(term2Id)}
                            </th>
                          )}

                          {showTotals && hasAnyScholasticComponentColumns && (
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
                          {hasTerm1ComponentColumns &&
                            term1Components.map((c) => (
                              <th key={`t1-${c.component_id}`} style={{ backgroundColor: "#eef6ff" }}>
                                {c.label}
                              </th>
                            ))}
                          {hasTerm1ComponentColumns && showTotals && (
                            <>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Total</th>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Grade</th>
                            </>
                          )}

                          {hasTerm2ComponentColumns &&
                            term2Components.map((c) => (
                              <th key={`t2-${c.component_id}`} style={{ backgroundColor: "#eef6ff" }}>
                                {c.label}
                              </th>
                            ))}
                          {hasTerm2ComponentColumns && showTotals && (
                            <>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Total</th>
                              <th style={{ backgroundColor: "#eef6ff", fontWeight: "bold" }}>Grade</th>
                            </>
                          )}

                          {showTotals && hasAnyScholasticComponentColumns && (
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

                              {hasTerm1ComponentColumns &&
                                term1Components.map((c) => (
                                  <td key={`r1-${si}-${c.component_id}`}>
                                    {getSubjectTermCompDisplay(student, sub, term1Id, c.component_id)}
                                  </td>
                                ))}
                              {hasTerm1ComponentColumns && showTotals && (
                                <>
                                  <td style={{ fontWeight: 900 }}>{s1?.marksTotal != null ? s1.marksTotal : "-"}</td>
                                  <td style={{ fontWeight: 900 }}>{s1?.grade || "-"}</td>
                                </>
                              )}

                              {hasTerm2ComponentColumns &&
                                term2Components.map((c) => (
                                  <td key={`r2-${si}-${c.component_id}`}>
                                    {getSubjectTermCompDisplay(student, sub, term2Id, c.component_id)}
                                  </td>
                                ))}
                              {hasTerm2ComponentColumns && showTotals && (
                                <>
                                  <td style={{ fontWeight: 900 }}>{s2?.marksTotal != null ? s2.marksTotal : "-"}</td>
                                  <td style={{ fontWeight: 900 }}>{s2?.grade || "-"}</td>
                                </>
                              )}

                              {showTotals && hasAnyScholasticComponentColumns && (
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

                        {showTotals && hasAnyScholasticComponentColumns && (
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

                              {hasTerm1ComponentColumns && (
                                <>
                                  {term1Components.map((_, idx) => (
                                    <td key={`b1-${idx}`}></td>
                                  ))}
                                  <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                    <div className="grand-total-small">{t1 ? formatNumber(t1.total_weighted) : "-"}</div>
                                  </td>
                                  <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                    {formatPercent(t1?.percent)}
                                  </td>
                                </>
                              )}

                              {hasTerm2ComponentColumns && (
                                <>
                                  {term2Components.map((_, idx) => (
                                    <td key={`b2-${idx}`}></td>
                                  ))}
                                  <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                    <div className="grand-total-small">{t2 ? formatNumber(t2.total_weighted) : "-"}</div>
                                  </td>
                                  <td style={{ backgroundColor: "#f2f7ff", fontWeight: 900 }}>
                                    {formatPercent(t2?.percent)}
                                  </td>
                                </>
                              )}

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
                    </>
                  ) : null}

                  {gradeFooterText && subjectsForStudent.length && hasAnyScholasticComponentColumns ? (
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

                  {effectiveFooterHtml && (
                    <div
                      className="report-footer mt-3 text-center small"
                      dangerouslySetInnerHTML={{ __html: effectiveFooterHtml }}
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