import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";

const EMPTY_SUBJECT_ROW = {
  subject_id: "",
  selected_components: {},
  availableComponents: [],
  no_components: false,
};

const FinalResultSummary = () => {
  // --- Core state ---
  const [sessions, setSessions] = useState([]);
  const [classList, setClassList] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    subjectComponents: [{ ...EMPTY_SUBJECT_ROW }],
  });

  const [reportData, setReportData] = useState([]);
  const headerMax = reportData[0]?.subjects || [];

  // --- Loading states ---
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // --- PDF and pagination ---
  const [pdfOrientation, setPdfOrientation] = useState("portrait");
  const [studentsPerPage, setStudentsPerPage] = useState(20);

  // --- Number formatting ---
  const [numberFormat, setNumberFormat] = useState({
    // ✅ Default 0 to match backend Excel export and avoid .00 in downloads
    decimalPoints: 0,
    rounding: "none", // "none" | "floor" | "ceiling"
  });

  const [headerHTML, setHeaderHTML] = useState("");
  const [footerHTML, setFooterHTML] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const reportRef = useRef();

  useEffect(() => {
    const load = async () => {
      setLoadingInitial(true);
      await Promise.all([loadSessions(), loadClasses(), loadSections()]);
      setLoadingInitial(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normaliseList = (data, key) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];
    return [];
  };

  const getNameById = (list, id, key = "name") => {
    const item = (list || []).find((x) => String(x.id) === String(id));
    return item?.[key] || "";
  };

  const selectedSessionName = useMemo(
    () => getNameById(sessions, filters.session_id, "name"),
    [sessions, filters.session_id]
  );

  const selectedClassName = useMemo(
    () => getNameById(classList, filters.class_id, "class_name"),
    [classList, filters.class_id]
  );

  const selectedSectionName = useMemo(
    () => getNameById(sections, filters.section_id, "section_name"),
    [sections, filters.section_id]
  );

  const loadSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const list = normaliseList(res.data, "sessions");

      setSessions(list);

      const active =
        list.find((x) => x?.is_active === true || x?.is_active === 1) ||
        list.find((x) => x?.active === true || x?.active === 1);

      if (active?.id) {
        setFilters((prev) => ({
          ...prev,
          session_id: prev.session_id || String(active.id),
        }));
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to load sessions", "error");
    }
  };

  const loadClasses = async () => {
    try {
      const res = await api.get("/classes");
      setClassList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to load classes", "error");
    }
  };

  const loadSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to load sections", "error");
    }
  };

  const loadSubjects = async (class_id, session_id) => {
    try {
      const params = { class_id };
      if (session_id) params.session_id = Number(session_id);

      const res = await api.get("/subjects", { params });
      const list = Array.isArray(res.data?.subjects) ? res.data.subjects : [];
      setSubjects(list);
      return list;
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to load subjects", "error");
      setSubjects([]);
      return [];
    }
  };

  const selectAllComponentsTermWise = (availableComponents = []) => {
    const selected = {};

    for (const c of availableComponents || []) {
      const termId = String(c.term_id);
      const compId = Number(c.component_id);

      if (!termId || !Number.isFinite(compId)) continue;

      if (!selected[termId]) selected[termId] = [];
      if (!selected[termId].includes(compId)) selected[termId].push(compId);
    }

    return selected;
  };

  const hasSelectedComponent = (selected = {}) =>
    Object.values(selected || {}).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );

  const getSelectedComponentCount = (selected = {}) =>
    Object.values(selected || {}).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0
    );

  const loadSubjectComponentsAuto = async (class_id, subject_id, session_id) => {
    const params = { class_id, subject_id };
    if (session_id) params.session_id = Number(session_id);

    const res = await api.get("/exam-schemes/components/term-wise", {
      params,
    });

    const availableComponents = Array.isArray(res.data) ? res.data : [];
    const selected_components = selectAllComponentsTermWise(availableComponents);

    return {
      availableComponents,
      selected_components,
      no_components: availableComponents.length === 0,
    };
  };

  /**
   * Auto-load all subjects and keep only subjects having at least one component.
   * All available components are active by default.
   */
  const preselectAllSubjectsAndComponents = async (
    class_id,
    session_id,
    subjectList
  ) => {
    const rowsRaw = await Promise.all(
      (subjectList || []).map(async (subject) => {
        try {
          const { availableComponents, selected_components, no_components } =
            await loadSubjectComponentsAuto(class_id, subject.id, session_id);

          return {
            subject_id: String(subject.id),
            availableComponents,
            selected_components,
            no_components,
          };
        } catch (error) {
          console.error("Failed to load components for subject:", subject?.id, error);

          return {
            subject_id: String(subject.id),
            availableComponents: [],
            selected_components: {},
            no_components: true,
          };
        }
      })
    );

    const rows = rowsRaw.filter((row) => row.availableComponents?.length > 0);
    return rows.length ? rows : [{ ...EMPTY_SUBJECT_ROW }];
  };

  const handleSessionChange = (e) => {
    const session_id = e.target.value;

    setFilters({
      session_id,
      class_id: "",
      section_id: "",
      subjectComponents: [{ ...EMPTY_SUBJECT_ROW }],
    });

    setSubjects([]);
    setReportData([]);
  };

  const handleClassChange = async (e) => {
    const class_id = e.target.value;

    setReportData([]);
    setSubjects([]);

    setFilters((prev) => ({
      ...prev,
      class_id,
      section_id: "",
      subjectComponents: [{ ...EMPTY_SUBJECT_ROW }],
    }));

    if (!class_id) return;

    if (!filters.session_id) {
      Swal.fire("Select Session", "Please select session first.", "warning");
      return;
    }

    try {
      setLoadingSubjects(true);
      setLoadingComponents(true);

      const subjectList = await loadSubjects(class_id, filters.session_id);
      const subjectComponents = await preselectAllSubjectsAndComponents(
        class_id,
        filters.session_id,
        subjectList
      );

      setFilters((prev) => ({
        ...prev,
        class_id,
        subjectComponents,
      }));

      const validCount = subjectComponents.filter((x) => x.subject_id).length;
      const skippedCount = Math.max(0, subjectList.length - validCount);

      if (subjectList.length > 0 && skippedCount > 0) {
        console.log(`Skipped ${skippedCount} subjects because no components were found.`);
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to prepare subjects and components", "error");
    } finally {
      setLoadingSubjects(false);
      setLoadingComponents(false);
    }
  };

  const handleSubjectChange = async (e, index) => {
    const subject_id = e.target.value;

    if (!filters.session_id) {
      Swal.fire("Select Session", "Please select session first.", "warning");
      return;
    }

    if (!filters.class_id) {
      Swal.fire("Select Class", "Please select class first.", "warning");
      return;
    }

    if (!subject_id) {
      setFilters((prev) => {
        const updated = [...prev.subjectComponents];
        updated[index] = { ...EMPTY_SUBJECT_ROW };
        return { ...prev, subjectComponents: updated };
      });
      return;
    }

    try {
      const { availableComponents, selected_components, no_components } =
        await loadSubjectComponentsAuto(
          filters.class_id,
          subject_id,
          filters.session_id
        );

      setFilters((prev) => {
        const updated = [...prev.subjectComponents];

        updated[index] = {
          ...updated[index],
          subject_id,
          availableComponents,
          selected_components, // all active by default
          no_components,
        };

        return { ...prev, subjectComponents: updated };
      });

      if (no_components) {
        Swal.fire(
          "No Components",
          "No components found for this subject. It will be skipped while generating report.",
          "info"
        );
      }
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to load components", "error");
    }
  };

  const handleComponentToggle = (term_id, compId, index, checked) => {
    setFilters((prev) => {
      const updated = [...prev.subjectComponents];
      const selected = { ...(updated[index].selected_components || {}) };
      const termKey = String(term_id);

      if (!selected[termKey]) selected[termKey] = [];

      if (checked) {
        if (!selected[termKey].includes(compId)) {
          selected[termKey] = [...selected[termKey], compId];
        }
      } else {
        selected[termKey] = selected[termKey].filter((id) => id !== compId);
      }

      updated[index] = {
        ...updated[index],
        selected_components: selected,
      };

      return { ...prev, subjectComponents: updated };
    });
  };

  const selectAllForSubject = (index) => {
    setFilters((prev) => {
      const updated = [...prev.subjectComponents];
      const row = updated[index];

      updated[index] = {
        ...row,
        selected_components: selectAllComponentsTermWise(row.availableComponents || []),
      };

      return { ...prev, subjectComponents: updated };
    });
  };

  const clearAllForSubject = (index) => {
    setFilters((prev) => {
      const updated = [...prev.subjectComponents];
      const row = updated[index];

      updated[index] = {
        ...row,
        selected_components: {},
      };

      return { ...prev, subjectComponents: updated };
    });
  };

  const addSubject = () => {
    setFilters((prev) => ({
      ...prev,
      subjectComponents: [...prev.subjectComponents, { ...EMPTY_SUBJECT_ROW }],
    }));
  };

  const removeSubject = (index) => {
    setFilters((prev) => {
      const updated = [...prev.subjectComponents];
      updated.splice(index, 1);

      return {
        ...prev,
        subjectComponents: updated.length ? updated : [{ ...EMPTY_SUBJECT_ROW }],
      };
    });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setReportData([]);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Only send subjects where at least one component is selected.
   * Empty/no-component subjects are skipped instead of blocking.
   */
  const buildSubjectComponentsPayload = () =>
    (filters.subjectComponents || [])
      .filter((sc) => sc.subject_id)
      .filter((sc) => (sc.availableComponents || []).length > 0)
      .filter((sc) => hasSelectedComponent(sc.selected_components || {}))
      .map((sc) => ({
        subject_id: parseInt(sc.subject_id, 10),
        term_component_map: sc.selected_components || {},
      }))
      .filter((sc) => Number.isFinite(sc.subject_id));

  const activeSubjectsForTable = useMemo(
    () => buildSubjectComponentsPayload(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters.subjectComponents]
  );

  const selectedComponentSubjectCount = activeSubjectsForTable.length;
  const visibleSubjectCount = (filters.subjectComponents || []).filter(
    (x) => x.subject_id
  ).length;
  const totalComponentCount = (filters.subjectComponents || []).reduce(
    (sum, row) => sum + getSelectedComponentCount(row.selected_components),
    0
  );

  const fetchReport = async () => {
    const { session_id, class_id, section_id } = filters;
    const subjectComponents = buildSubjectComponentsPayload();

    if (!session_id || !class_id || !section_id) {
      return Swal.fire(
        "Missing Fields",
        "Please select session, class and section.",
        "warning"
      );
    }

    if (subjectComponents.length === 0) {
      return Swal.fire(
        "No Components Found",
        "No subject components were found for selected class/session. Please check exam schemes.",
        "warning"
      );
    }

    try {
      setLoadingReport(true);

      const payload = {
        session_id: Number(session_id),
        class_id: Number(class_id),
        section_id: Number(section_id),
        includeGrades: true,
        subject_components: subjectComponents,
      };

      const res = await api.post("/final-report/final-summary", payload);
      setReportData(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to fetch report", "error");
    } finally {
      setLoadingReport(false);
    }
  };

  // --- Number formatting helper ---
  const formatNumber = (value) => {
    if (value == null || value === "" || isNaN(value)) return value ?? "-";

    let num = parseFloat(value);
    const decimalPoints = Math.max(
      0,
      Math.min(3, parseInt(numberFormat.decimalPoints, 10) || 0)
    );
    const pow = Math.pow(10, decimalPoints);

    if (numberFormat.rounding === "floor") num = Math.floor(num * pow) / pow;
    if (numberFormat.rounding === "ceiling") num = Math.ceil(num * pow) / pow;

    return num.toFixed(decimalPoints);
  };

  const formatPercent = (value) => {
    const formatted = formatNumber(value);
    return formatted === "-" ? "-" : `${formatted}%`;
  };

  const getSubjectMeta = (subjectId) =>
    (headerMax || []).find((s) => Number(s.subject_id) === Number(subjectId)) || {};

  const getSubjectTermIds = (subjectConfig) => {
    const map = subjectConfig?.term_component_map || {};

    const ids = Object.keys(map)
      .map((x) => Number(x))
      .filter((x) => Number.isFinite(x) && x > 0)
      .sort((a, b) => a - b);

    return ids.length ? ids : [1, 2];
  };

  const getSubjectColumnCount = (subjectConfig) =>
    getSubjectTermIds(subjectConfig).length + 3; // terms + Comb + %age + Grade

  const reportTableColSpan =
    3 +
    activeSubjectsForTable.reduce(
      (sum, sc) => sum + getSubjectColumnCount(sc),
      0
    ) +
    3;

  const getSubjectName = (subjectId) =>
    subjects.find((s) => Number(s.id) === Number(subjectId))?.name || "–";

  const getTermMaxWeightage = (subjectMeta, termId) => {
    const raw = subjectMeta?.[`term${termId}_max_weightage`] ?? 0;
    return Math.round(parseFloat(raw || 0));
  };

  const getDefaultHeader = () => {
    const parts = [
      "Final Result Summary",
      selectedSessionName ? `Session: ${selectedSessionName}` : "",
      selectedClassName ? `Class: ${selectedClassName}` : "",
      selectedSectionName ? `Section: ${selectedSectionName}` : "",
    ].filter(Boolean);

    return parts.join(" | ");
  };

  const getFileNameFromDisposition = (disposition, fallback) => {
    if (!disposition) return fallback;

    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);

    const normalMatch = disposition.match(/filename="?([^"]+)"?/i);
    if (normalMatch?.[1]) return normalMatch[1];

    return fallback;
  };

  const downloadBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  };

  const validateExportFilters = () => {
    const subjectComponents = buildSubjectComponentsPayload();

    if (!filters.session_id || !filters.class_id || !filters.section_id) {
      Swal.fire(
        "Missing Fields",
        "Please select session, class and section.",
        "warning"
      );
      return null;
    }

    if (!subjectComponents.length) {
      Swal.fire(
        "No Components",
        "No valid subject components found.",
        "warning"
      );
      return null;
    }

    return subjectComponents;
  };

  const handleExportExcel = async () => {
    const subjectComponents = validateExportFilters();
    if (!subjectComponents) return;

    try {
      setDownloadingExcel(true);

      const payload = {
        session_id: Number(filters.session_id),
        class_id: Number(filters.class_id),
        section_id: Number(filters.section_id),
        includeGrades: true,
        subject_components: subjectComponents,

        // ✅ Backend Excel reads these and formats both sheets accordingly
        decimalPoints: Number(numberFormat.decimalPoints),
        rounding: numberFormat.rounding,
      };

      const res = await api.post("/final-report/final-summary-excel", payload, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const fileName = getFileNameFromDisposition(
        res.headers?.["content-disposition"],
        "Final_Result_Summary.xlsx"
      );

      downloadBlob(blob, fileName);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to download Excel", "error");
    } finally {
      setDownloadingExcel(false);
    }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) {
      return Swal.fire("No Data", "Please generate report first.", "info");
    }

    const subjectComponents = validateExportFilters();
    if (!subjectComponents) return;

    const header = (headerHTML || getDefaultHeader()).replace(/\n/g, "<br/>");
    const footer = (
      footerHTML || "Generated by Edubridge ERP"
    ).replace(/\n/g, "<br/>");

    const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        font-size: 12px;
        padding: 20px;
        color: #111827;
      }
      h3 {
        margin: 0;
        padding: 10px;
        text-align: center;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      th, td {
        border: 1px solid #000;
        padding: 5px;
        text-align: center;
        font-size: 11px;
      }
      th {
        background-color: #f0f0f0;
      }
      .text-start {
        text-align: left;
      }
      .footer {
        margin-top: 20px;
        text-align: right;
        font-size: 11px;
      }
      .page-break {
        page-break-after: always;
      }
    </style>
  </head>
  <body>
    <h3>${header}</h3>
    ${reportRef.current.innerHTML}
    <div class="footer">${footer}</div>
  </body>
</html>
`;

    const payload = {
      html,
      filters: {
        session_id: Number(filters.session_id),
        class_id: Number(filters.class_id),
        section_id: Number(filters.section_id),
        includeGrades: true,
        subject_components: subjectComponents,
      },
      fileName: "FinalResultSummary",
      orientation: pdfOrientation,
    };

    try {
      setDownloadingPdf(true);

      const res = await api.post("/final-report/final-summary-pdf", payload, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to generate PDF", "error");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const topRankedStudents = useMemo(() => {
    return [...reportData].sort((a, b) => {
      const grandDiff = Number(b.grand_total || 0) - Number(a.grand_total || 0);
      if (grandDiff !== 0) return grandDiff;

      const percentDiff = Number(b.percentage || 0) - Number(a.percentage || 0);
      if (percentDiff !== 0) return percentDiff;

      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [reportData]);

  const topStudent = topRankedStudents[0] || null;

  const topPercentage = useMemo(() => {
    if (!reportData.length) return "-";

    const values = reportData
      .map((s) => Number(s.percentage))
      .filter((x) => Number.isFinite(x));

    if (!values.length) return "-";

    return formatPercent(Math.max(...values));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, numberFormat.decimalPoints, numberFormat.rounding]);

  const classAverage = useMemo(() => {
    if (!reportData.length) return "-";

    const values = reportData
      .map((s) => Number(s.percentage))
      .filter((x) => Number.isFinite(x));

    if (!values.length) return "-";

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return formatPercent(avg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportData, numberFormat.decimalPoints, numberFormat.rounding]);

  return (
    <div className="container-fluid py-4 px-3 px-lg-4 bg-light min-vh-100">
      <style>{`
        .frs-hero {
          background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #2563eb 100%);
          border-radius: 22px;
          color: white;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
        }
        .frs-card {
          border: 0;
          border-radius: 18px;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
        }
        .frs-stat {
          border-radius: 16px;
          background: white;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
          border: 1px solid rgba(148, 163, 184, 0.18);
        }
        .frs-subject-card {
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          transition: 0.2s ease;
        }
        .frs-subject-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.09);
        }
        .frs-table th {
          background: #eef4ff !important;
          color: #0f172a;
          vertical-align: middle;
          font-size: 12px;
          white-space: nowrap;
        }
        .frs-table td {
          font-size: 12px;
          vertical-align: middle;
        }
        .frs-sticky-table thead th {
          position: sticky;
          top: 0;
          z-index: 5;
        }
        .frs-pill {
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
        }
        .frs-topper-card {
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
        }
        .frs-rank-badge {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          background: #eff6ff;
          color: #1d4ed8;
        }
      `}</style>

      {/* Hero */}
      <div className="frs-hero p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <div className="badge bg-white text-primary mb-2 px-3 py-2">
              Session-wise Result Analytics
            </div>
            <h2 className="mb-1 fw-bold">📘 Final Result Summary</h2>
            <div className="text-white-50">
              Auto-select subjects/components, generate summary, download premium Excel, and export PDF.
            </div>
          </div>

          <div className="text-end">
            <div className="fw-bold">
              {selectedSessionName || "Select Session"}
            </div>
            <div className="small text-white-50">
              {selectedClassName || "Class"} {selectedSectionName ? `- ${selectedSectionName}` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="frs-stat p-3">
            <div className="text-muted small">Students</div>
            <div className="fs-4 fw-bold">{reportData.length || "-"}</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="frs-stat p-3">
            <div className="text-muted small">Active Subjects</div>
            <div className="fs-4 fw-bold">{selectedComponentSubjectCount || "-"}</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="frs-stat p-3">
            <div className="text-muted small">Class Average</div>
            <div className="fs-4 fw-bold">{classAverage}</div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="frs-stat p-3">
            <div className="text-muted small">Topper</div>
            <div className="fs-6 fw-bold text-truncate">
              {topStudent?.name || "-"}
            </div>
            <div className="small text-muted">
              {topStudent
                ? `${formatNumber(topStudent.grand_total)} marks | ${topPercentage}`
                : "Generate report"}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card frs-card mb-4">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h5 className="mb-1 fw-bold">Filters</h5>
              <div className="text-muted small">
                Select session, class and section. Subjects/components will load automatically.
              </div>
            </div>

            {loadingInitial && <span className="badge bg-info">Loading master data…</span>}
          </div>

          <div className="row g-3">
            <div className="col-lg-4">
              <label className="form-label fw-bold">Session</label>
              <select
                className="form-select"
                name="session_id"
                value={filters.session_id}
                onChange={handleSessionChange}
              >
                <option value="">Select Session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                    {session.is_active ? " (Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-4">
              <label className="form-label fw-bold">Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={handleClassChange}
                disabled={!filters.session_id}
              >
                <option value="">Select Class</option>
                {classList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-4">
              <label className="form-label fw-bold">Section</label>
              <select
                className="form-select"
                name="section_id"
                value={filters.section_id}
                onChange={handleFilterChange}
                disabled={!filters.class_id}
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(loadingSubjects || loadingComponents) && (
            <div className="alert alert-info py-2 mt-3 mb-0">
              Loading subjects and selecting all available components automatically…
            </div>
          )}
        </div>
      </div>

      {/* Subjects */}
      <div className="card frs-card mb-4">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h5 className="mb-1 fw-bold">Subjects & Components</h5>
              <div className="text-muted small">
                Valid subjects are auto-selected. Subjects without components are skipped safely.
              </div>

              {filters.class_id && (
                <div className="small mt-2 d-flex flex-wrap gap-2">
                  <span className="badge bg-primary">
                    Active Subjects: {selectedComponentSubjectCount}
                  </span>
                  <span className="badge bg-secondary">
                    Visible Cards: {visibleSubjectCount}
                  </span>
                  <span className="badge bg-success">
                    Selected Components: {totalComponentCount}
                  </span>
                </div>
              )}
            </div>

            <div className="d-flex flex-wrap gap-2">
              <button className="btn btn-outline-primary" onClick={addSubject}>
                ➕ Add Subject
              </button>

              <button
                className="btn btn-primary"
                onClick={fetchReport}
                disabled={loadingReport || loadingComponents}
              >
                {loadingReport ? "Generating…" : "🔍 Generate Report"}
              </button>
            </div>
          </div>

          <div className="row g-3 mt-2">
            {filters.subjectComponents.map((sc, idx) => {
              const groupedComponents = (sc.availableComponents || []).reduce((acc, c) => {
                const termId = String(c.term_id);
                if (!acc[termId]) acc[termId] = [];
                acc[termId].push(c);
                return acc;
              }, {});

              const hasComponents = (sc.availableComponents || []).length > 0;
              const subjectName =
                subjects.find((s) => String(s.id) === String(sc.subject_id))?.name ||
                `Subject ${idx + 1}`;

              return (
                <div key={idx} className="col-xl-4 col-lg-6">
                  <div className="frs-subject-card p-3 h-100">
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                      <div>
                        <div className="fw-bold">{subjectName}</div>
                        <div className="text-muted small">
                          {hasComponents
                            ? `${getSelectedComponentCount(sc.selected_components)} components selected`
                            : "No components"}
                        </div>
                      </div>

                      {filters.subjectComponents.length > 1 && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removeSubject(idx)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <select
                      className="form-select mb-3"
                      value={sc.subject_id}
                      onChange={(e) => handleSubjectChange(e, idx)}
                      disabled={!filters.class_id}
                    >
                      <option value="">Select Subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>

                    {sc.subject_id && hasComponents && (
                      <div className="d-flex gap-2 mb-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => selectAllForSubject(idx)}
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => clearAllForSubject(idx)}
                        >
                          Clear
                        </button>
                      </div>
                    )}

                    {sc.subject_id && !hasComponents && (
                      <div className="alert alert-warning py-2 small mb-0">
                        No components found. This subject will be skipped.
                      </div>
                    )}

                    {Object.entries(groupedComponents).map(([term_id, comps]) => (
                      <div key={term_id} className="mt-3">
                        <div className="fw-bold small mb-2">Term {term_id}</div>

                        <div className="d-flex flex-wrap gap-2">
                          {comps.map((c) => {
                            const termKey = String(term_id);
                            const checked = (
                              sc.selected_components?.[termKey] || []
                            ).includes(c.component_id);

                            return (
                              <label
                                key={c.component_id}
                                className={`frs-pill border ${
                                  checked
                                    ? "bg-primary text-white border-primary"
                                    : "bg-light text-muted"
                                }`}
                                htmlFor={`t${term_id}-${idx}-${c.component_id}`}
                                style={{ cursor: "pointer" }}
                              >
                                <input
                                  type="checkbox"
                                  className="form-check-input me-2"
                                  id={`t${term_id}-${idx}-${c.component_id}`}
                                  checked={checked}
                                  onChange={(e) =>
                                    handleComponentToggle(
                                      term_id,
                                      c.component_id,
                                      idx,
                                      e.target.checked
                                    )
                                  }
                                />
                                {c.abbreviation || c.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Options */}
          <div className="border-top mt-4 pt-3">
            <div className="row g-3 align-items-end">
              <div className="col-md-3">
                <label className="fw-bold small mb-1">PDF Orientation</label>
                <select
                  className="form-select form-select-sm"
                  value={pdfOrientation}
                  onChange={(e) => setPdfOrientation(e.target.value)}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="col-md-3">
                <label className="fw-bold small mb-1">Students/Page</label>
                <select
                  className="form-select form-select-sm"
                  value={studentsPerPage}
                  onChange={(e) => setStudentsPerPage(parseInt(e.target.value, 10))}
                >
                  {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="fw-bold small mb-1">Decimal Points</label>
                <select
                  className="form-select form-select-sm"
                  value={numberFormat.decimalPoints}
                  onChange={(e) =>
                    setNumberFormat({
                      ...numberFormat,
                      decimalPoints: parseInt(e.target.value, 10),
                    })
                  }
                >
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="fw-bold small mb-1">Rounding</label>
                <select
                  className="form-select form-select-sm"
                  value={numberFormat.rounding}
                  onChange={(e) =>
                    setNumberFormat({ ...numberFormat, rounding: e.target.value })
                  }
                >
                  <option value="none">None</option>
                  <option value="floor">Floor</option>
                  <option value="ceiling">Ceiling</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      {reportData.length > 0 && (
        <div className="card frs-card">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <div>
                <h5 className="fw-bold mb-1">Generated Result Summary</h5>
                <div className="text-muted small">
                  Total Students: <b>{reportData.length}</b>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-success"
                  onClick={handleExportExcel}
                  disabled={downloadingExcel}
                >
                  {downloadingExcel ? "Downloading…" : "📥 Download Excel"}
                </button>

                <button
                  className="btn btn-danger"
                  onClick={() => setShowPdfModal(true)}
                  disabled={downloadingPdf}
                >
                  {downloadingPdf ? "Generating…" : "🖨️ Export PDF"}
                </button>
              </div>
            </div>

            {topRankedStudents.length > 0 && (
              <div className="frs-topper-card p-3 mb-3">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div>
                    <div className="fw-bold">🏆 Toppers Preview</div>
                    <div className="small text-muted">
                      Excel download will also include a separate Toppers Ranking sheet sorted by Grand Total.
                    </div>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-sm table-bordered align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th className="text-center">Rank</th>
                        <th>Roll No</th>
                        <th>Admission No.</th>
                        <th>Name</th>
                        <th className="text-center">Grand Total</th>
                        <th className="text-center">%age</th>
                        <th className="text-center">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topRankedStudents.slice(0, 5).map((stu, index) => (
                        <tr key={`topper-${stu.student_id || index}`}>
                          <td className="text-center">
                            <span className="frs-rank-badge">{index + 1}</span>
                          </td>
                          <td>{stu.roll_number || "-"}</td>
                          <td>{stu.admission_number || "-"}</td>
                          <td className="fw-semibold">{stu.name || "-"}</td>
                          <td className="text-center fw-bold">
                            {formatNumber(stu.grand_total)}
                          </td>
                          <td className="text-center">
                            {formatNumber(stu.percentage)}
                          </td>
                          <td className="text-center fw-bold">
                            {stu.grand_grade || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div ref={reportRef} className="table-responsive frs-sticky-table">
              <table className="table table-bordered text-center align-middle frs-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Roll No</th>
                    <th rowSpan="2">Name</th>
                    <th rowSpan="2">Class</th>

                    {activeSubjectsForTable.map((sc, idx) => {
                      const subjectMeta = getSubjectMeta(sc.subject_id);
                      const totalMax = subjectMeta?.total_max_weightage ?? "0";
                      const totalMaxInt = Math.round(parseFloat(totalMax || 0));

                      return (
                        <th
                          key={`subject-head-${idx}`}
                          colSpan={getSubjectColumnCount(sc)}
                          style={{ minWidth: "180px" }}
                        >
                          {getSubjectName(sc.subject_id)} (Max {totalMaxInt})
                        </th>
                      );
                    })}

                    <th colSpan="3">Grand Total</th>
                  </tr>

                  <tr>
                    {activeSubjectsForTable.flatMap((sc, idx) => {
                      const subjectMeta = getSubjectMeta(sc.subject_id);
                      const terms = getSubjectTermIds(sc);
                      const totalMax = subjectMeta?.total_max_weightage ?? "0";
                      const totalMaxInt = Math.round(parseFloat(totalMax || 0));

                      return [
                        ...terms.map((termId) => (
                          <th key={`term-${idx}-${termId}`}>
                            T{termId}
                            <br />
                            {getTermMaxWeightage(subjectMeta, termId)}
                          </th>
                        )),
                        <th key={`comb-${idx}`}>
                          Comb
                          <br />
                          {totalMaxInt}
                        </th>,
                        <th key={`percent-${idx}`}>%age</th>,
                        <th key={`grade-${idx}`}>Grade</th>,
                      ];
                    })}

                    <th>Marks</th>
                    <th>%age</th>
                    <th>Grade</th>
                  </tr>
                </thead>

                <tbody>
                  {reportData.map((stu, i) => (
                    <React.Fragment key={stu.student_id}>
                      <tr>
                        <td>{stu.roll_number || "-"}</td>
                        <td className="text-start fw-semibold">{stu.name}</td>
                        <td>{stu.report_class_name || stu.class || "-"}</td>

                        {activeSubjectsForTable.map((sc, index) => {
                          const subj =
                            stu.subjects?.find(
                              (x) => Number(x.subject_id) === Number(sc.subject_id)
                            ) || {};
                          const terms = getSubjectTermIds(sc);

                          return (
                            <React.Fragment key={index}>
                              {terms.map((termId) => (
                                <td key={`student-${stu.student_id}-term-${termId}`}>
                                  {formatNumber(subj[`term${termId}_weighted`])}
                                </td>
                              ))}
                              <td className="fw-semibold">
                                {formatNumber(subj.final_total)}
                              </td>
                              <td>{formatNumber(subj.percentage)}</td>
                              <td>{subj.grade || "-"}</td>
                            </React.Fragment>
                          );
                        })}

                        <td className="fw-bold">{formatNumber(stu.grand_total)}</td>
                        <td className="fw-bold">{formatNumber(stu.percentage)}</td>
                        <td className="fw-bold">{stu.grand_grade || "-"}</td>
                      </tr>

                      {(i + 1) % studentsPerPage === 0 && (
                        <tr className="page-break">
                          <td colSpan={reportTableColSpan}></td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!reportData.length && !loadingReport && (
        <div className="card frs-card">
          <div className="card-body text-center p-5">
            <div className="display-6 mb-2">📊</div>
            <h5 className="fw-bold">No report generated yet</h5>
            <div className="text-muted">
              Select filters and click Generate Report to view summary.
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      <Modal show={showPdfModal} onHide={() => setShowPdfModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Customize PDF</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="alert alert-light border">
            Default header will be used if you leave header empty:
            <br />
            <b>{getDefaultHeader()}</b>
          </div>

          <label className="fw-bold">Header HTML</label>
          <textarea
            className="form-control mb-3"
            rows={3}
            value={headerHTML}
            placeholder={getDefaultHeader()}
            onChange={(e) => setHeaderHTML(e.target.value)}
          />

          <label className="fw-bold">Footer HTML</label>
          <textarea
            className="form-control"
            rows={3}
            value={footerHTML}
            placeholder="Generated by Edubridge ERP"
            onChange={(e) => setFooterHTML(e.target.value)}
          />
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPdfModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={downloadingPdf}
            onClick={() => {
              setShowPdfModal(false);
              handleExportPDF();
            }}
          >
            {downloadingPdf ? "Generating…" : "Generate PDF"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FinalResultSummary;