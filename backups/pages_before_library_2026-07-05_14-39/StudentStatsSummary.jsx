
import React, { useEffect, useMemo, useCallback, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button, Form, Row, Col, Badge } from "react-bootstrap";
import "./FeeStructure.css";

// -------------------------------------------------------------
// Role helper: reads roles from localStorage (single or multiple)
// -------------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  const has = (r) => roles.includes(r);

  return {
    roles,
    isAdmin: has("admin"),
    isSuperadmin: has("superadmin"),
    isAccounts: has("accounts"),
    isAcademicCoordinator: has("academic_coordinator"),
    isTeacher: has("teacher"),
  };
};

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const textColorForBg = (hex) => {
  if (!hex || typeof hex !== "string") return "#111827";
  const c = hex.replace("#", "").trim();
  if (c.length !== 6) return "#111827";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#111827" : "#ffffff";
};

const getHouseKey = (houseId) => String(houseId ?? "null");
const getClassKey = (classId, className) =>
  `${String(classId ?? "null")}__${String(className || "Unknown")}`;

const DEFAULT_EXPORT_COLUMNS = [
  "admission_number",
  "name",
  "father_name",
  "father_phone",
  "class_name",
  "section_name",
  "house_name",
  "session_name",
  "status",
];

const EXCEL_ENDPOINT_CANDIDATES = [
  "/students/export-excel",
  "/students/export/excel",
];

const PDF_ENDPOINT_CANDIDATES = [
  "/students/export-pdf",
  "/students/export/pdf",
];

const buildHouseFilterValue = (house) => {
  if (!house) return 0;
  return house.is_no_house ? 0 : house.house_id;
};

const extractFileNameFromDisposition = (disposition, fallbackName) => {
  const raw = String(disposition || "");
  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);

  const basicMatch = raw.match(/filename="?([^"]+)"?/i);
  if (basicMatch?.[1]) return basicMatch[1];

  return fallbackName;
};

const triggerBlobDownload = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000);
};

const readBlobErrorMessage = async (blob) => {
  if (!(blob instanceof Blob)) return "";
  try {
    const text = await blob.text();
    if (!text) return "";
    try {
      const json = JSON.parse(text);
      return json?.message || json?.error || json?.details || text;
    } catch {
      return text;
    }
  } catch {
    return "";
  }
};

const performExportDownload = async ({ format, payload }) => {
  const isExcel = format === "excel";
  const candidates = isExcel
    ? EXCEL_ENDPOINT_CANDIDATES
    : PDF_ENDPOINT_CANDIDATES;

  let lastError = null;

  for (const endpoint of candidates) {
    try {
      const response = await api.post(endpoint, payload, {
        responseType: "blob",
      });

      const contentType = String(
        response?.headers?.["content-type"] || ""
      ).toLowerCase();

      if (contentType.includes("application/json")) {
        const msg =
          (await readBlobErrorMessage(response.data)) ||
          `Export failed at ${endpoint}`;
        throw new Error(msg);
      }

      const fileName = extractFileNameFromDisposition(
        response?.headers?.["content-disposition"],
        `students-export.${isExcel ? "xlsx" : "pdf"}`
      );

      triggerBlobDownload(response.data, fileName);
      return;
    } catch (error) {
      const status = error?.response?.status;
      const responseBlob = error?.response?.data;

      if (status === 404) {
        lastError = error;
        continue;
      }

      const blobMessage = await readBlobErrorMessage(responseBlob);
      if (blobMessage) {
        throw new Error(blobMessage);
      }

      lastError = error;
      break;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Export endpoint not found.");
};

const StudentStatsSummary = () => {
  const role = useMemo(getRoleFlags, []);
  const canView =
    role.isAdmin ||
    role.isSuperadmin ||
    role.isAccounts ||
    role.isAcademicCoordinator ||
    role.isTeacher;

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [activeTab, setActiveTab] = useState("graphics");
  const [classSearch, setClassSearch] = useState("");

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState("excel");
  const [exportContext, setExportContext] = useState({
    scope: "range", // range | class | house | cell
    title: "Export Students",
    class_id: "",
    class_name: "",
    house_id: "",
    house_name: "",
    class_from_id: "",
    class_to_id: "",
  });

  const [payload, setPayload] = useState({
    totals: null,
    classHouse: [],
    houseWise: [],
    classWise: [],
  });

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await api.get("/sessions");
      const list = Array.isArray(data) ? data : [];
      setSessions(list);

      if (!selectedSessionId) {
        const active = list.find((s) => s.is_active) || list[0];
        if (active?.id) setSelectedSessionId(active.id);
      }
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to fetch sessions.", "error");
    }
  }, [selectedSessionId]);

  const normalize = useCallback((res) => {
    const root = res?.data && typeof res.data === "object" ? res.data : res || {};
    return {
      totals: root.totals || null,
      classHouse: Array.isArray(root.classHouse) ? root.classHouse : [],
      houseWise: Array.isArray(root.houseWise) ? root.houseWise : [],
      classWise: Array.isArray(root.classWise) ? root.classWise : [],
    };
  }, []);

  const fetchStats = useCallback(async () => {
    if (!canView) {
      Swal.fire("Forbidden", "You don’t have access to view this report.", "warning");
      return;
    }
    if (!selectedSessionId) return;

    setLoading(true);
    try {
      const url = `/students/stats/summary?session_id=${encodeURIComponent(
        selectedSessionId
      )}&include_class_house=1&include_class_gender=0&include_house_gender=0&include_class_section=0`;

      const { data } = await api.get(url);
      setPayload(normalize(data));
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to fetch class-house stats.", "error");
    } finally {
      setLoading(false);
    }
  }, [canView, selectedSessionId, normalize]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSessionId) fetchStats();
  }, [selectedSessionId, fetchStats]);

  const sessionName = useMemo(() => {
    return (
      sessions.find((s) => String(s.id) === String(selectedSessionId))?.name || "-"
    );
  }, [sessions, selectedSessionId]);

  const apiTotalStudents = useMemo(() => {
    const t = payload.totals;
    if (!t) return 0;
    return toNum(t.students ?? t.total ?? t.count ?? 0);
  }, [payload.totals]);

  const matrix = useMemo(() => {
    const rows = Array.isArray(payload.classHouse) ? payload.classHouse : [];

    const houseMap = new Map();
    for (const r of rows) {
      const hid = r.house_id ?? null;
      const key = getHouseKey(hid);
      if (!houseMap.has(key)) {
        const isNoHouse =
          hid === null ||
          hid === undefined ||
          hid === 0 ||
          String(hid).trim() === "";

        houseMap.set(key, {
          house_id: hid,
          house_name: r.house_name || (isNoHouse ? "No House" : "—"),
          house_code: r.house_code || null,
          color: r.color || (isNoHouse ? "#94a3b8" : null),
          is_no_house: isNoHouse,
        });
      }
    }

    const houses = Array.from(houseMap.values()).sort((a, b) => {
      if (a.is_no_house && !b.is_no_house) return 1;
      if (!a.is_no_house && b.is_no_house) return -1;
      return String(a.house_name || "").localeCompare(String(b.house_name || ""));
    });

    const classMap = new Map();
    for (const r of rows) {
      const cid = r.class_id ?? null;
      const cname = r.class_name || (cid ? "—" : "No Class");
      const key = getClassKey(cid, cname);
      if (!classMap.has(key)) {
        classMap.set(key, { class_id: cid, class_name: cname });
      }
    }

    let classes = Array.from(classMap.values()).sort((a, b) => {
      const ai = a.class_id == null ? 1e9 : Number(a.class_id);
      const bi = b.class_id == null ? 1e9 : Number(b.class_id);
      if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
      return String(a.class_name || "").localeCompare(String(b.class_name || ""));
    });

    const q = classSearch.trim().toLowerCase();
    if (q) {
      classes = classes.filter((c) =>
        String(c.class_name || "").toLowerCase().includes(q)
      );
    }

    const val = new Map();
    for (const r of rows) {
      const cid = r.class_id ?? null;
      const cname = r.class_name || (cid ? "—" : "No Class");
      const classKey = getClassKey(cid, cname);
      const houseKey = getHouseKey(r.house_id ?? null);
      val.set(`${classKey}||${houseKey}`, toNum(r.count ?? 0));
    }

    const colTotals = new Map();
    houses.forEach((h) => colTotals.set(getHouseKey(h.house_id), 0));

    const rowTotals = new Map();
    const perClassSegments = [];

    for (const c of classes) {
      const classKey = getClassKey(c.class_id, c.class_name);
      let sum = 0;

      const segments = houses.map((h) => {
        const houseKey = getHouseKey(h.house_id);
        const count = toNum(val.get(`${classKey}||${houseKey}`) ?? 0);
        sum += count;
        colTotals.set(houseKey, toNum(colTotals.get(houseKey)) + count);
        return { ...h, count };
      });

      rowTotals.set(classKey, sum);

      perClassSegments.push({
        class_key: classKey,
        class_id: c.class_id ?? null,
        class_name: c.class_name,
        total: sum,
        segments,
      });
    }

    const grandTotal = Array.from(colTotals.values()).reduce(
      (a, b) => a + toNum(b),
      0
    );

    return { houses, classes, val, rowTotals, colTotals, grandTotal, perClassSegments };
  }, [payload.classHouse, classSearch]);

  const displayTotalStudents = useMemo(() => {
    return matrix.grandTotal > 0 ? matrix.grandTotal : apiTotalStudents;
  }, [matrix.grandTotal, apiTotalStudents]);

  const totalClassesWithData = useMemo(() => matrix.classes.length, [matrix.classes]);
  const totalHousesWithData = useMemo(() => matrix.houses.length, [matrix.houses]);

  const houseSummary = useMemo(() => {
    const out = (matrix.houses || []).map((h) => {
      const count = toNum(matrix.colTotals.get(getHouseKey(h.house_id)) ?? 0);
      const pct = matrix.grandTotal ? (count / matrix.grandTotal) * 100 : 0;
      return { ...h, count, pct };
    });
    out.sort((a, b) => (b.count || 0) - (a.count || 0));
    return out;
  }, [matrix]);

  const noHouseSummary = useMemo(() => {
    return houseSummary.find((h) => h.is_no_house) || null;
  }, [houseSummary]);

  const totalAssignedStudents = useMemo(() => {
    return houseSummary
      .filter((h) => !h.is_no_house)
      .reduce((sum, h) => sum + toNum(h.count), 0);
  }, [houseSummary]);

  const filteredClassesCount = useMemo(() => {
    return matrix.perClassSegments.filter((c) => toNum(c.total) > 0).length;
  }, [matrix.perClassSegments]);

  const topClasses = useMemo(() => {
    return [...matrix.perClassSegments]
      .sort((a, b) => toNum(b.total) - toNum(a.total))
      .slice(0, 5);
  }, [matrix.perClassSegments]);

  const totalsMismatch =
    displayTotalStudents !== apiTotalStudents && apiTotalStudents > 0;

  const exportableClasses = useMemo(() => {
    return matrix.classes.filter((c) => c.class_id !== null && c.class_id !== undefined);
  }, [matrix.classes]);

  const exportHint = useMemo(() => {
    return "Click class cards, house cards, matrix headers, or matrix cells to download student lists in Excel or PDF.";
  }, []);

  useEffect(() => {
    if (!loading && payload.classHouse?.length) {
      const apiTotal = toNum(
        payload?.totals?.students ?? payload?.totals?.total ?? payload?.totals?.count ?? 0
      );
      if (apiTotal !== matrix.grandTotal) {
        console.warn("Student summary mismatch", {
          apiTotal,
          matrixGrandTotal: matrix.grandTotal,
          classHouse: payload.classHouse,
          totals: payload.totals,
        });
      }
    }
  }, [loading, payload, matrix.grandTotal]);

  const closeExportModal = useCallback(() => {
    if (exportBusy) return;
    setShowExportModal(false);
  }, [exportBusy]);

  const openRangeExportModal = useCallback(() => {
    const firstClassId = exportableClasses[0]?.class_id ?? "";
    const lastClassId =
      exportableClasses[exportableClasses.length - 1]?.class_id ?? firstClassId;

    setExportContext({
      scope: "range",
      title: "Export Students by Class Range",
      class_id: "",
      class_name: "",
      house_id: "",
      house_name: "",
      class_from_id: firstClassId,
      class_to_id: lastClassId,
    });
    setExportFormat("excel");
    setShowExportModal(true);
  }, [exportableClasses]);

  const openClassExportModal = useCallback((classRow) => {
    if (!classRow?.class_id) return;
    setExportContext({
      scope: "class",
      title: `Export ${classRow.class_name}`,
      class_id: classRow.class_id,
      class_name: classRow.class_name || "",
      house_id: "",
      house_name: "",
      class_from_id: classRow.class_id,
      class_to_id: classRow.class_id,
    });
    setExportFormat("excel");
    setShowExportModal(true);
  }, []);

  const openHouseExportModal = useCallback((houseRow) => {
    if (!houseRow) return;
    setExportContext({
      scope: "house",
      title: `Export ${houseRow.house_name}`,
      class_id: "",
      class_name: "",
      house_id: buildHouseFilterValue(houseRow),
      house_name: houseRow.house_name || "",
      class_from_id: "",
      class_to_id: "",
    });
    setExportFormat("excel");
    setShowExportModal(true);
  }, []);

  const openCellExportModal = useCallback((classRow, houseRow) => {
    if (!classRow?.class_id || !houseRow) return;
    setExportContext({
      scope: "cell",
      title: `Export ${classRow.class_name} • ${houseRow.house_name}`,
      class_id: classRow.class_id,
      class_name: classRow.class_name || "",
      house_id: buildHouseFilterValue(houseRow),
      house_name: houseRow.house_name || "",
      class_from_id: classRow.class_id,
      class_to_id: classRow.class_id,
    });
    setExportFormat("excel");
    setShowExportModal(true);
  }, []);

  const handleExportNow = useCallback(async () => {
    if (!selectedSessionId) {
      Swal.fire("Select session", "Please select a session first.", "warning");
      return;
    }

    const payloadForExport = {
      session_id: selectedSessionId,
      status: "enabled",
      columns: DEFAULT_EXPORT_COLUMNS,
      include_siblings_details: false,
    };

    if (exportContext.scope === "range") {
      if (!exportContext.class_from_id || !exportContext.class_to_id) {
        Swal.fire(
          "Select class range",
          "Please choose both From Class and To Class.",
          "warning"
        );
        return;
      }

      payloadForExport.class_from_id = exportContext.class_from_id;
      payloadForExport.class_to_id = exportContext.class_to_id;
    }

    if (exportContext.scope === "class") {
      payloadForExport.class_id = exportContext.class_id;
    }

    if (exportContext.scope === "house") {
      payloadForExport.house_id = exportContext.house_id;
    }

    if (exportContext.scope === "cell") {
      payloadForExport.class_id = exportContext.class_id;
      payloadForExport.house_id = exportContext.house_id;
    }

    try {
      setExportBusy(true);
      await performExportDownload({
        format: exportFormat,
        payload: payloadForExport,
      });

      setShowExportModal(false);
      Swal.fire(
        "Downloaded",
        `Student list has been downloaded in ${exportFormat.toUpperCase()} format.`,
        "success"
      );
    } catch (error) {
      console.error("Student export failed:", error);
      Swal.fire(
        "Export failed",
        error?.message || "Unable to download student export.",
        "error"
      );
    } finally {
      setExportBusy(false);
    }
  }, [selectedSessionId, exportContext, exportFormat]);

  if (!canView) {
    return (
      <div className="container mt-3">
        <div className="alert alert-warning">
          Forbidden: You don’t have access to view Student Stats Summary.
        </div>
      </div>
    );
  }

  const hasData = (payload.classHouse || []).length > 0;

  return (
    <div className="container-fluid mt-2">
      <style>{`
        .ss-page {
          color: #111827;
        }
        .ss-card {
          border: 1px solid rgba(15, 23, 42, 0.07);
          border-radius: 20px;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 12px 35px rgba(15, 23, 42, 0.06);
        }
        .ss-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 18px;
          padding: 14px 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
        }
        .ss-hero {
          background: linear-gradient(135deg, #eff6ff 0%, #ffffff 45%, #f5f3ff 100%);
          border: 1px solid rgba(99, 102, 241, 0.08);
          border-radius: 18px;
          padding: 14px 16px;
        }
        .ss-title {
          font-weight: 900;
          font-size: 20px;
          margin: 0;
          letter-spacing: 0.2px;
          color: #111827;
        }
        .ss-sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }
        .ss-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(15, 23, 42, 0.08);
          font-size: 11px;
          font-weight: 800;
          color: #374151;
        }
        .ss-tabbtn {
          border: 1px solid rgba(15, 23, 42, 0.10);
          background: #fff;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s ease;
          color: #374151;
        }
        .ss-tabbtn.active {
          background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
          border-color: rgba(99,102,241,0.45);
          color: #3730a3;
          box-shadow: 0 6px 18px rgba(99,102,241,0.16);
        }
        .ss-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid rgba(0,0,0,0.08);
          white-space: nowrap;
        }
        .ss-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.12);
          flex: 0 0 auto;
        }
        .ss-stat {
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.07);
          background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
          padding: 14px 14px 12px;
          min-height: 96px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }
        .ss-stat.clickable,
        .ss-row.clickable,
        .ss-table td.clickable,
        .ss-table th.clickable {
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
        }
        .ss-stat.clickable:hover,
        .ss-row.clickable:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
          border-color: rgba(79, 70, 229, 0.22);
        }
        .ss-table td.clickable:hover,
        .ss-table th.clickable:hover {
          background: #eef2ff !important;
        }
        .ss-stat .num {
          font-size: 24px;
          font-weight: 900;
          line-height: 1.1;
          color: #0f172a;
        }
        .ss-stat .lbl {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
          font-weight: 700;
        }
        .ss-stat .subtxt {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 4px;
        }
        .ss-sectionTitle {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.2px;
          color: #6b7280;
          text-transform: uppercase;
        }
        .ss-stacked {
          height: 18px;
          border-radius: 999px;
          background: #f3f4f6;
          overflow: hidden;
          border: 1px solid rgba(15, 23, 42, 0.06);
        }
        .ss-seg {
          height: 100%;
          display: inline-block;
        }
        .ss-row {
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 18px;
          padding: 14px;
          background: #fff;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.035);
        }
        .ss-matrixWrap {
          max-height: 72vh;
          border-radius: 18px;
          overflow: auto;
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
        }
        .ss-note {
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: linear-gradient(90deg, rgba(255, 251, 235, 0.98), rgba(255,255,255,0.98));
          color: #92400e;
          border-radius: 14px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 700;
        }
        .ss-empty {
          min-height: 280px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #6b7280;
          padding: 24px;
        }
        .ss-empty h6 {
          font-size: 16px;
          font-weight: 900;
          color: #374151;
          margin-bottom: 6px;
        }
        .ss-mutedSmall {
          font-size: 11px;
          color: #94a3b8;
        }
        .ss-table thead th {
          background: linear-gradient(90deg, #eef2ff 0%, #f8fafc 100%);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          color: #0f172a;
        }
        .ss-table tbody td {
          border-color: rgba(15, 23, 42, 0.06);
        }
        .ss-searchWrap {
          min-width: 250px;
        }
        .ss-exportTag {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.2px;
          color: #4f46e5;
          text-transform: uppercase;
        }
        @media (max-width: 768px) {
          .ss-searchWrap {
            min-width: 100%;
          }
          .ss-title {
            font-size: 18px;
          }
        }
      `}</style>

      <div className="ss-page">
        <div className="ss-topbar mb-3">
          <div className="ss-hero">
            <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
              <div>
                <div className="ss-title">Student Strength Summary</div>
                <div className="ss-sub">
                  Class-wise house distribution report for the selected academic session.
                </div>

                <div className="d-flex flex-wrap gap-2 mt-3">
                  <span className="ss-pill">Session: <b>{sessionName}</b></span>
                  <span className="ss-pill">Visible Strength: <b>{displayTotalStudents}</b></span>
                  <span className="ss-pill">Classes: <b>{totalClassesWithData}</b></span>
                  <span className="ss-pill">Houses: <b>{totalHousesWithData}</b></span>
                </div>
              </div>

              <div className="d-flex gap-2 flex-wrap align-items-center">
                <button
                  className={`ss-tabbtn ${activeTab === "graphics" ? "active" : ""}`}
                  onClick={() => setActiveTab("graphics")}
                  type="button"
                >
                  📊 Graphics
                </button>

                <button
                  className={`ss-tabbtn ${activeTab === "matrix" ? "active" : ""}`}
                  onClick={() => setActiveTab("matrix")}
                  type="button"
                >
                  🧾 Matrix
                </button>

                <select
                  className="form-select form-select-sm"
                  style={{ minWidth: 200 }}
                  value={selectedSessionId ?? ""}
                  onChange={(e) => setSelectedSessionId(Number(e.target.value) || null)}
                >
                  <option value="">Select session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_active ? "(Active)" : ""}
                    </option>
                  ))}
                </select>

                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={openRangeExportModal}
                  disabled={!selectedSessionId || !hasData}
                  type="button"
                >
                  Export Range
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={fetchStats}
                  disabled={!selectedSessionId || loading}
                  type="button"
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {totalsMismatch ? (
          <div className="ss-note mb-3">
            Displayed strength is based on the rendered class-house report ({displayTotalStudents})
            because API totals returned {apiTotalStudents}. This keeps the header aligned with the
            report on screen.
          </div>
        ) : null}

        <div className="ss-note mb-3" style={{ borderColor: "rgba(79,70,229,0.18)", color: "#4338ca", background: "linear-gradient(90deg, rgba(238,242,255,0.96), rgba(255,255,255,0.96))" }}>
          {exportHint}
        </div>

        <div className="card ss-card">
          <div className="card-body p-3">
            {loading ? (
              <div className="ss-empty">
                <div>
                  <h6>Loading student summary...</h6>
                  <div>Please wait while class-house distribution is being prepared.</div>
                </div>
              </div>
            ) : !hasData ? (
              <div className="ss-empty">
                <div>
                  <h6>No student summary found</h6>
                  <div>The API did not return any classHouse records for this session.</div>
                </div>
              </div>
            ) : (
              <>
                <div className="row g-3 mb-3">
                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="ss-stat h-100">
                      <div className="num">{displayTotalStudents}</div>
                      <div className="lbl">Students in Report</div>
                      <div className="subtxt">Calculated from class-house rows</div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="ss-stat h-100">
                      <div className="num">{totalAssignedStudents}</div>
                      <div className="lbl">Assigned to House</div>
                      <div className="subtxt">
                        {displayTotalStudents
                          ? `${((totalAssignedStudents / displayTotalStudents) * 100).toFixed(1)}% of visible strength`
                          : "0% of visible strength"}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div
                      className="ss-stat h-100 clickable"
                      onClick={() => noHouseSummary && openHouseExportModal(noHouseSummary)}
                      title="Click to export students without house"
                    >
                      <div className="d-flex align-items-start justify-content-between gap-2">
                        <div>
                          <div className="num">{toNum(noHouseSummary?.count ?? 0)}</div>
                          <div className="lbl">No House Assigned</div>
                        </div>
                        <Badge bg="light" text="dark">Export</Badge>
                      </div>
                      <div className="subtxt">
                        {displayTotalStudents
                          ? `${((toNum(noHouseSummary?.count ?? 0) / displayTotalStudents) * 100).toFixed(1)}% of visible strength`
                          : "0% of visible strength"}
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-md-6 col-lg-3">
                    <div className="ss-stat h-100">
                      <div className="num">{filteredClassesCount}</div>
                      <div className="lbl">Classes in View</div>
                      <div className="subtxt">Filtered by current search</div>
                    </div>
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
                  <div>
                    <div className="ss-sectionTitle mb-2">House Legend</div>
                    <div className="d-flex flex-wrap gap-2">
                      {matrix.houses.map((h) => (
                        <span
                          key={`legend-${getHouseKey(h.house_id)}`}
                          className="ss-chip"
                          style={{
                            background: h.color || "#e5e7eb",
                            color: textColorForBg(h.color),
                          }}
                          title={h.house_name}
                        >
                          <span className="ss-dot" style={{ background: h.color || "#9ca3af" }} />
                          {h.house_code || h.house_name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="ss-searchWrap">
                    <label className="form-label fw-bold text-muted small mb-1">
                      Search Class
                    </label>
                    <div className="d-flex gap-2">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Type class name..."
                        value={classSearch}
                        onChange={(e) => setClassSearch(e.target.value)}
                      />
                      {classSearch ? (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setClassSearch("")}
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {activeTab === "graphics" ? (
                  <>
                    <div className="row g-3 mb-3">
                      <div className="col-12 col-xl-7">
                        <div className="ss-row h-100">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                            <div className="ss-sectionTitle">Overall House Share</div>
                            <div className="ss-mutedSmall">Click a house card to export that list</div>
                          </div>

                          <div className="d-grid gap-3">
                            {houseSummary.map((h) => (
                              <div
                                key={`hs-${getHouseKey(h.house_id)}`}
                                className="ss-row clickable"
                                style={{ padding: 12 }}
                                onClick={() => openHouseExportModal(h)}
                                title={`Click to export ${h.house_name}`}
                              >
                                <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                  <div className="fw-bold" style={{ fontSize: 14 }}>
                                    <span
                                      className="ss-dot me-2"
                                      style={{ background: h.color || "#9ca3af", display: "inline-block" }}
                                    />
                                    {h.house_name}
                                  </div>
                                  <div className="text-end">
                                    <div className="fw-bold">{h.count}</div>
                                    <div className="ss-mutedSmall">{h.pct.toFixed(1)}%</div>
                                  </div>
                                </div>

                                <div className="ss-stacked" title={`${h.house_name}: ${h.count}`}>
                                  <span
                                    className="ss-seg"
                                    style={{
                                      width: `${Math.max(0, Math.min(100, h.pct))}%`,
                                      background: h.color || "#9ca3af",
                                    }}
                                  />
                                </div>
                                <div className="ss-exportTag mt-2">Click to export</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-xl-5">
                        <div className="ss-row h-100">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                            <div className="ss-sectionTitle">Top Classes by Strength</div>
                            <div className="ss-mutedSmall">Click a class to export</div>
                          </div>

                          <div className="d-grid gap-3">
                            {topClasses.map((c, index) => {
                              const total = toNum(c.total);
                              const pct = displayTotalStudents
                                ? (total / displayTotalStudents) * 100
                                : 0;

                              return (
                                <div
                                  key={`top-${c.class_key}`}
                                  className="ss-row clickable"
                                  style={{ padding: 12 }}
                                  onClick={() => openClassExportModal(c)}
                                  title={`Click to export ${c.class_name}`}
                                >
                                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                                    <div className="fw-bold" style={{ fontSize: 14 }}>
                                      {index + 1}. {c.class_name}
                                    </div>
                                    <div className="text-end">
                                      <div className="fw-bold">{total}</div>
                                      <div className="ss-mutedSmall">{pct.toFixed(1)}% of total</div>
                                    </div>
                                  </div>

                                  <div className="ss-stacked" title={`${c.class_name}: ${total}`}>
                                    <span
                                      className="ss-seg"
                                      style={{
                                        width: `${Math.max(0, Math.min(100, pct))}%`,
                                        background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                                      }}
                                    />
                                  </div>
                                  <div className="ss-exportTag mt-2">Click to export</div>
                                </div>
                              );
                            })}

                            {!topClasses.length ? (
                              <div className="text-muted">No class data available.</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ss-row">
                      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                        <div className="ss-sectionTitle">Class-wise Distribution</div>
                        <div className="ss-mutedSmall">
                          Click any class block to export its student list.
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        {matrix.perClassSegments.map((c) => {
                          const total = toNum(c.total);
                          const safeTotal = total || 1;

                          return (
                            <div
                              key={`bar-${c.class_key}`}
                              className="border rounded-4 p-3 clickable"
                              style={{ borderColor: "rgba(15, 23, 42, 0.08)" }}
                              onClick={() => openClassExportModal(c)}
                              title={`Click to export ${c.class_name}`}
                            >
                              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                <div>
                                  <div style={{ fontWeight: 900, fontSize: 14 }}>{c.class_name}</div>
                                  <div className="ss-mutedSmall">
                                    {c.segments.filter((s) => toNum(s.count) > 0).length} houses represented
                                  </div>
                                </div>
                                <div className="text-end">
                                  <div style={{ fontWeight: 900, fontSize: 18 }}>{total}</div>
                                  <div className="ss-mutedSmall">students</div>
                                </div>
                              </div>

                              <div className="ss-stacked mt-3" title={`${c.class_name} total ${total}`}>
                                {c.segments.map((s) => {
                                  const count = toNum(s.count);
                                  if (!count) return null;

                                  const pct = (count / safeTotal) * 100;

                                  return (
                                    <span
                                      key={`seg-${c.class_key}-${getHouseKey(s.house_id)}`}
                                      className="ss-seg"
                                      style={{
                                        width: `${pct}%`,
                                        background: s.color || "#9ca3af",
                                      }}
                                      title={`${s.house_name}: ${count}`}
                                    />
                                  );
                                })}
                              </div>

                              <div
                                className="mt-3"
                                style={{ fontSize: 11, display: "flex", flexWrap: "wrap", gap: 12 }}
                              >
                                {c.segments
                                  .filter((s) => toNum(s.count) > 0)
                                  .sort((a, b) => toNum(b.count) - toNum(a.count))
                                  .map((s) => (
                                    <span key={`mini-${c.class_key}-${getHouseKey(s.house_id)}`}>
                                      <span
                                        className="ss-dot me-1"
                                        style={{
                                          background: s.color || "#9ca3af",
                                          display: "inline-block",
                                          verticalAlign: "middle",
                                        }}
                                      />
                                      {s.house_code || s.house_name}: <b>{toNum(s.count)}</b>
                                    </span>
                                  ))}
                              </div>

                              <div className="ss-exportTag mt-2">Click to export class list</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="ss-row">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                      <div className="ss-sectionTitle">Class × House Matrix</div>
                      <div className="ss-mutedSmall">
                        Click class header, house header, or any matrix cell to export.
                      </div>
                    </div>

                    <div className="ss-matrixWrap">
                      <table className="table table-sm table-bordered mb-0 ss-table" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th
                              className="sticky-top"
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 5,
                                minWidth: 150,
                                fontWeight: 900,
                              }}
                            >
                              Class
                            </th>

                            {matrix.houses.map((h) => (
                              <th
                                key={`h-${getHouseKey(h.house_id)}`}
                                className="sticky-top text-center clickable"
                                style={{
                                  minWidth: 100,
                                  fontWeight: 900,
                                }}
                                title={`Click to export ${h.house_name}`}
                                onClick={() => openHouseExportModal(h)}
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                  <span className="ss-dot" style={{ background: h.color || "#9ca3af" }} />
                                  <span style={{ whiteSpace: "nowrap" }}>{h.house_code || h.house_name}</span>
                                </div>
                              </th>
                            ))}

                            <th
                              className="sticky-top text-center"
                              style={{
                                minWidth: 100,
                                fontWeight: 900,
                              }}
                            >
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {matrix.classes.map((c) => {
                            const classKey = getClassKey(c.class_id, c.class_name);
                            const rowTotal = toNum(matrix.rowTotals.get(classKey) ?? 0);

                            return (
                              <tr key={`c-${classKey}`}>
                                <td
                                  className="clickable"
                                  style={{
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 4,
                                    background: "#ffffff",
                                    fontWeight: 900,
                                    minWidth: 150,
                                  }}
                                  title={`Click to export ${c.class_name}`}
                                  onClick={() => openClassExportModal(c)}
                                >
                                  {c.class_name || "-"}
                                </td>

                                {matrix.houses.map((h) => {
                                  const houseKey = getHouseKey(h.house_id);
                                  const count = toNum(matrix.val.get(`${classKey}||${houseKey}`) ?? 0);
                                  const isZero = count === 0;

                                  return (
                                    <td
                                      key={`cell-${classKey}-${houseKey}`}
                                      className={`text-center ${count ? "clickable" : ""}`}
                                      style={{
                                        background: isZero ? "#fafafa" : "#ffffff",
                                        fontWeight: count ? 900 : 500,
                                      }}
                                      title={
                                        count
                                          ? `${c.class_name} → ${h.house_name}: ${count} (click to export)`
                                          : `${c.class_name} → ${h.house_name}: ${count}`
                                      }
                                      onClick={() =>
                                        count ? openCellExportModal(c, h) : undefined
                                      }
                                    >
                                      {count || ""}
                                    </td>
                                  );
                                })}

                                <td
                                  className="text-center clickable"
                                  style={{ fontWeight: 900, background: "#f8fafc" }}
                                  title={`Click to export ${c.class_name}`}
                                  onClick={() => openClassExportModal(c)}
                                >
                                  {rowTotal}
                                </td>
                              </tr>
                            );
                          })}

                          <tr>
                            <td
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 4,
                                background: "#f1f5f9",
                                fontWeight: 900,
                              }}
                            >
                              Total
                            </td>

                            {matrix.houses.map((h) => {
                              const colTotal = toNum(
                                matrix.colTotals.get(getHouseKey(h.house_id)) ?? 0
                              );
                              return (
                                <td
                                  key={`coltot-${getHouseKey(h.house_id)}`}
                                  className="text-center clickable"
                                  style={{ fontWeight: 900, background: "#f1f5f9" }}
                                  title={`Click to export ${h.house_name}`}
                                  onClick={() => openHouseExportModal(h)}
                                >
                                  {colTotal}
                                </td>
                              );
                            })}

                            <td
                              className="text-center"
                              style={{ fontWeight: 900, background: "#e2e8f0" }}
                            >
                              {matrix.grandTotal}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <Modal show={showExportModal} onHide={closeExportModal} centered backdrop="static">
          <Modal.Header closeButton={!exportBusy}>
            <Modal.Title>{exportContext.title}</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Row className="g-3">
              <Col md={12}>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div className="fw-bold mb-1">Export details</div>
                  {exportContext.scope === "range" ? (
                    <div className="text-muted small">
                      Choose a class range and file type to download enabled students only.
                    </div>
                  ) : (
                    <div className="text-muted small">
                      {exportContext.class_name ? (
                        <div><b>Class:</b> {exportContext.class_name}</div>
                      ) : null}
                      {exportContext.house_name ? (
                        <div><b>House:</b> {exportContext.house_name}</div>
                      ) : null}
                      <div className="mt-1">
                        Export will include <b>enabled students only</b> for session <b>{sessionName}</b>.
                      </div>
                    </div>
                  )}
                </div>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label>Format</Form.Label>
                  <Form.Select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    disabled={exportBusy}
                  >
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="pdf">PDF (.pdf)</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              {exportContext.scope === "range" ? (
                <>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>From Class</Form.Label>
                      <Form.Select
                        value={exportContext.class_from_id || ""}
                        onChange={(e) =>
                          setExportContext((prev) => ({
                            ...prev,
                            class_from_id: Number(e.target.value) || "",
                          }))
                        }
                        disabled={exportBusy}
                      >
                        <option value="">Select class</option>
                        {exportableClasses.map((c) => (
                          <option key={`from-${c.class_id}`} value={c.class_id}>
                            {c.class_name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>To Class</Form.Label>
                      <Form.Select
                        value={exportContext.class_to_id || ""}
                        onChange={(e) =>
                          setExportContext((prev) => ({
                            ...prev,
                            class_to_id: Number(e.target.value) || "",
                          }))
                        }
                        disabled={exportBusy}
                      >
                        <option value="">Select class</option>
                        {exportableClasses.map((c) => (
                          <option key={`to-${c.class_id}`} value={c.class_id}>
                            {c.class_name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </>
              ) : null}
            </Row>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={closeExportModal} disabled={exportBusy}>
              Close
            </Button>
            <Button variant="primary" onClick={handleExportNow} disabled={exportBusy}>
              {exportBusy ? "Preparing..." : `Download ${exportFormat.toUpperCase()}`}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </div>
  );
};

export default StudentStatsSummary;