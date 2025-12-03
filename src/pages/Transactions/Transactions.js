// src/pages/Transactions/Transactions.js
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { pdf } from "@react-pdf/renderer";
import PdfReceiptDocument from "./PdfReceiptDocument"; // Use the shared PDF document component
import api from "../../api";
import Swal from "sweetalert2";
import {
  Modal,
  Button,
  Tabs,
  Tab,
  Form,
  Row,
  Col,
  Card,
  OverlayTrigger,
  Tooltip,
  Badge,
  Alert,
} from "react-bootstrap";
import ReceiptModal from "./ReceiptModal"; // For the pop-up view
import "bootstrap/dist/css/bootstrap.min.css";
/* ---------------- Helpers ---------------- */
/// --- normalize helpers (robust) ---
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (d == null) return [];
  const keys = [
    "data",
    "rows",
    "results",
    "items",
    "list",
    "records",
    "classes",
    "sections",
    "students",
  ];
  for (const k of keys) {
    if (Array.isArray(d?.[k])) return d[k];
    if (Array.isArray(d?.data?.[k])) return d.data[k];
  }
  if (typeof d === "string") {
    try {
      const p = JSON.parse(d);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  if (typeof d === "object") {
    const stack = [d];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      for (const v of Object.values(cur)) {
        if (Array.isArray(v)) return v;
        if (v && typeof v === "object") stack.push(v);
      }
    }
  }
  return [];
};
const firstNonEmpty = (...vals) => {
  for (const v of vals) {
    const s = (v ?? "").toString().trim();
    if (s && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s;
  }
  return "";
};
const normalizeClassRow = (x) => {
  const id = Number(
    x?.id ?? x?.class_id ?? x?.Class_ID ?? x?.classId ?? x?.Class?.id ?? 0
  );
  const name = firstNonEmpty(
    x?.class_name,
    x?.Class_Name,
    x?.name,
    x?.class,
    x?.title,
    x?.label,
    x?.Class?.class_name,
    x?.Class?.name,
    x?.ClassTitle,
    x?.classTitle
  );
  return {
    id,
    class_name: name || (id ? `Class ${id}` : "—"),
  };
};
const normalizeSectionRow = (x) => {
  const id = Number(
    x?.id ??
      x?.section_id ??
      x?.Section_ID ??
      x?.sectionId ??
      x?.Section?.id ??
      0
  );
  const name =
    firstNonEmpty(
      x?.section_name,
      x?.Section_Name,
      x?.SectionName,
      x?.sectionname,
      x?.name,
      x?.label,
      x?.title,
      x?.section,
      x?.Section,
      x?.Section?.section_name,
      x?.Section?.Section_Name,
      x?.Section?.SectionName,
      x?.Section?.name,
      x?.Section?.label,
      x?.Section?.title
    ) || "";
  return { id, section_name: name || "" };
};
const normalizeStudentRow = (s) => {
  const id = Number(s?.id ?? s?.student_id ?? s?.Student_ID ?? 0);
  const name =
    String(s?.name ?? s?.student_name ?? s?.Student_Name ?? "") || "—";
  const admission_number =
    String(
      s?.admission_number ??
        s?.AdmissionNumber ??
        s?.adm_no ??
        ""
    ) || "—";
  const Class = s?.Class
    ? {
        id: Number(s.Class.id ?? s.class_id ?? 0),
        class_name: s.Class.class_name ?? s.class_name ?? "—",
      }
    : { id: Number(s?.class_id ?? 0), class_name: s?.class_name ?? "—" };
  const section_name =
    firstNonEmpty(
      s?.Section?.section_name,
      s?.Section?.Section_Name,
      s?.section_name,
      s?.Section_Name,
      s?.section,
      s?.Section?.name
    ) || "—";
  const Section = s?.Section
    ? { id: Number(s.Section.id ?? s.section_id ?? 0), section_name }
    : { id: Number(s?.section_id ?? 0), section_name };
  return { ...s, id, name, admission_number, Class, Section };
};
const formatINR = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const pickNum = (...vals) => {
  for (const v of vals) {
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
};
/**
 * Convert an image URL to a base64 data URL usable by @react-pdf/renderer.
 * Returns the original URL on failure (so caller can fallback).
 */
async function fetchImageAsDataURL(url) {
  if (!url) return url;
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) {
      return url;
    }
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read blob as data URL"));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("fetchImageAsDataURL failed for", url, err?.message || err);
    return url;
  }
}
/* ----- Print Receipt (robust for new /schools shape) ----- */
const handlePrintReceipt = async (slipId) => {
  try {
    Swal.fire({
      title: "Preparing receipt PDF…",
      didOpen: () => Swal.showLoading(),
      allowOutsideClick: false,
      showConfirmButton: false,
    });
    const [schoolResp, receiptResp] = await Promise.allSettled([
      api.get("/schools"),
      api.get(`/transactions/slip/${slipId}`),
    ]);
    let receipt = null;
    if (receiptResp.status === "fulfilled") {
      const r = receiptResp.value?.data;
      if (r && Array.isArray(r.data)) receipt = r.data;
      else if (Array.isArray(r)) receipt = r;
      else if (r && typeof r === "object") {
        if (r.data && Array.isArray(r.data)) receipt = r.data;
        else if (r.data && typeof r.data === "object") receipt = [r.data];
        else if (r.receipt && Array.isArray(r.receipt)) receipt = r.receipt;
        else receipt = [r];
      } else {
        receipt = receiptResp.value?.data ?? null;
        if (receipt && !Array.isArray(receipt)) receipt = [receipt];
      }
    }
    if (!receipt || receipt.length === 0) {
      Swal.close();
      Swal.fire("No receipt", "Server returned no receipt data.", "error");
      return;
    }
    let school = null;
    if (schoolResp.status === "fulfilled") {
      const d = schoolResp.value?.data;
      if (d && Array.isArray(d.schools) && d.schools.length) school = d.schools[0];
      else if (Array.isArray(d)) school = d[0];
      else if (d && Array.isArray(d.data) && d.data.length) school = d.data[0];
      else if (d && d.school) school = d.school;
      else if (d && typeof d === "object" && Object.keys(d).length) school = d;
    }
    if (!school && receipt[0]) {
      const item = receipt[0];
      if (item.School || item.school) school = item.School || item.school;
      else if (item.schoolName || item.institute_name) {
        school = {
          name: item.schoolName || item.institute_name,
          address: item.schoolAddress || item.address || "",
          logo: item.logo || null,
        };
      }
    }
    if (!school) {
      school = { name: "Your School", address: "", logo: null, phone: "", email: "" };
    }
    const isNeg = (v) => typeof v === "number" && !Number.isNaN(v) && v < 0;
    const stripNeg = (v) => (isNeg(v) ? undefined : v);
    const fieldsToClean = [
      "feeBalance",
      "vanFeeBalance",
      "FinalDue",
      "finalDue",
      "Remaining",
      "remaining",
      "RemainingBeforeFine",
      "remainingBeforeFine",
    ];
    const cleanedReceipt = receipt.map((row) => {
      const out = { ...row };
      fieldsToClean.forEach((k) => {
        if (k in out) out[k] = stripNeg(Number(out[k]));
      });
      if (out.Student && typeof out.Student === "object") {
        fieldsToClean.forEach((k) => {
          if (k in out.Student) out.Student[k] = stripNeg(Number(out.Student[k]));
        });
      }
      if (out.Transport || out.Transportation) {
        const T = out.Transport || out.Transportation;
        fieldsToClean.forEach((k) => {
          if (k in T) T[k] = stripNeg(Number(T[k]));
        });
        out.Transport = T;
      }
      return out;
    });
    const payload = {
      receipt: cleanedReceipt,
      school,
      fileName: `Receipt-${slipId}`,
      options: { hideNegativeBalances: true },
    };
    const res = await api.post("/receipt-pdf/receipt/generate-pdf", payload, {
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000);
    Swal.close();
  } catch (err) {
    Swal.close();
    console.error("Error preparing receipt PDF:", err);
    Swal.fire("Error", err?.message || "Failed to prepare receipt PDF", "error");
  }
};
const Transactions = () => {
  const [userRole, setUserRole] = useState(localStorage.getItem("activeRole") || "");
  useEffect(() => {
    const handler = () => setUserRole(localStorage.getItem("activeRole") || "");
    window.addEventListener("role-changed", handler);
    return () => window.removeEventListener("role-changed", handler);
  }, []);
  const isCancelled = (txn) => txn.status === "cancelled";
  const canCancel = () => {
    const role = (userRole || "").toLowerCase();
    return ["admin", "superadmin", "account", "accounts", "accountant"].includes(
      role
    );
  };
  const canDelete = (txn) => {
    const role = (userRole || "").toLowerCase();
    return role === "superadmin" && isCancelled(txn);
  };
  const [transactions, setTransactions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null);
  const [newTransactionDetails, setNewTransactionDetails] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("admissionNumber");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [transactionID, setTransactionID] = useState("");
  const [remarks, setRemarks] = useState("");
  const [daySummary, setDaySummary] = useState({ data: [], grandTotal: 0 });
  const [searchAdmissionNumber, setSearchAdmissionNumber] = useState("");
  const [selectedAdmissionStudent, setSelectedAdmissionStudent] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState(null);
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [quickAmount, setQuickAmount] = useState("");
  const [selectedHeads, setSelectedHeads] = useState(new Set());
  const [prevBalanceHeadId, setPrevBalanceHeadId] = useState(null);
  const [openingBalanceDue, setOpeningBalanceDue] = useState(0);
  const [sbQuery, setSbQuery] = useState("");
  const [sbResults, setSbResults] = useState([]);
  const [sbOpen, setSbOpen] = useState(false);
  const [sbActive, setSbActive] = useState(-1);
  const sbWrapRef = useRef(null);
  const debounceRef = useRef(null);
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  const debounce = (fn, ms = 250) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  };
  const asStudentsArray = (data) =>
    Array.isArray(data)
      ? data
      : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.data)
      ? data.data
      : [];
  const fetchStudentsInline = async (term) => {
    if (!term || term.trim().length < 1) {
      setSbResults([]);
      setSbOpen(false);
      return;
    }
    try {
      const params = { q: term.trim(), limit: 25 };
      if (selectedSession) params.session_id = selectedSession;
      const { data } = await api.get("/students/search", { params });
      const list = asStudentsArray(data)
        .map(normalizeStudentRow)
        .filter((s) => s.id);
      setSbResults(list);
      setSbOpen(true);
      setSbActive(list.length ? 0 : -1);
    } catch (e) {
      console.error("students search failed", e);
      setSbResults([]);
      setSbOpen(false);
    }
  };
  const handlePickStudent = (s) => {
    if (!s) return;
    setSelectedClass((prev) => prev || s.class_id || s.Class?.id || "");
    setSelectedSection((prev) => prev || s.section_id || s.Section?.id || "");
    setSelectedAdmissionStudent(s);
    setSelectedStudentInfo(s);
    setSbQuery(`${s.name} (${s.admission_number || "—"})`);
    setSbOpen(false);
    if (!selectedSession) {
      setModalError("Please select an academic session before loading fee details.");
      return;
    }
    fetchFeeHeadsForStudent(s.class_id, s.id, s);
  };
  useEffect(() => {
    const onDocClick = (e) => {
      if (!sbWrapRef.current) return;
      if (!sbWrapRef.current.contains(e.target)) setSbOpen(false);
    };
    document.addEventListener("click", onDocClick, { capture: true });
    return () => document.removeEventListener("click", onDocClick);
  }, []);
  const dueIncludingVanForRow = (row) => {
    const academicNetDue = Math.max(
      0,
      (row.Fee_Due || 0) - (row.Fee_Recieved || 0) - (row.Concession || 0)
    );
    const fineDue = row.isFineApplicable
      ? Math.max(0, (row.fineAmount || 0) - (row.Fine_Amount || 0))
      : 0;
    const vanOutstanding = row.ShowVanFeeInput
      ? Math.max(0, (row.Van_Fee_Due || 0) - (row.VanFee || 0))
      : 0;
    return academicNetDue + fineDue + vanOutstanding;
  };
  const selectedDueTotal = useMemo(() => {
    if (!newTransactionDetails?.length || selectedHeads.size === 0) return 0;
    return newTransactionDetails.reduce((sum, row) => {
      return selectedHeads.has(String(row.Fee_Head))
        ? sum + dueIncludingVanForRow(row)
        : sum;
    }, 0);
  }, [newTransactionDetails, selectedHeads]);
  useEffect(() => {
    setSelectedHeads(new Set());
  }, [showModal, feeHeads]);
  const POLLING_INTERVAL = 5000;
  const viewReceipt = (slipId) => {
    setSelectedSlipId(slipId);
    setShowReceiptModal(true);
  };
  const totalFeeReceived = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.Fee_Recieved || 0), 0),
    [newTransactionDetails]
  );
  const totalVanFee = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.VanFee || 0), 0),
    [newTransactionDetails]
  );
  const totalAcademicConcession = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.Concession || 0), 0),
    [newTransactionDetails]
  );
  const totalVanConcession = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.Van_Fee_Concession || 0), 0),
    [newTransactionDetails]
  );
  const totalConcessions = useMemo(
    () => totalAcademicConcession + totalVanConcession,
    [totalAcademicConcession, totalVanConcession]
  );
  const totalFine = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.Fine_Amount || 0), 0),
    [newTransactionDetails]
  );
  const grandTotal = useMemo(
    () => totalFeeReceived + totalVanFee + totalFine,
    [totalFeeReceived, totalVanFee, totalFine]
  );
  const fetchFineEligibility = async (studentId) => {
    try {
      const res = await api.get(`/transactions/fine-eligibility/${studentId}`);
      return res.data?.data || {};
    } catch (e) {
      console.error("Error fetching fine eligibility:", e);
      return {};
    }
  };
  const fetchTransportRoutes = async () => {
    try {
      const response = await api.get("/transportations");
      setTransportRoutes(response.data || []);
    } catch (error) {
      console.error("Error fetching transport routes:", error);
    }
  };
  const fetchSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const sessionList = res.data || [];
      setSessions(sessionList);
      if (!selectedSession) {
        let active = sessionList.find((s) => s.is_active === true);
        if (!active && sessionList.length > 0) {
          active = sessionList[0];
        }
        if (active) {
          setSelectedSession(Number(active.id));
        }
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
    }
  };
  const fetchTransactions = async () => {
    try {
      const response = await api.get(
        selectedSession ? `/transactions?session_id=${selectedSession}` : "/transactions"
      );
      setTransactions(response.data.data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };
  const fetchDaySummary = async () => {
    try {
      const response = await api.get(
        selectedSession
          ? `/transactions/summary/day-summary?session_id=${selectedSession}`
          : "/transactions/summary/day-summary"
      );
      setDaySummary(response.data || { data: [], grandTotal: 0 });
    } catch (error) {
      console.error("Error fetching day summary:", error);
    }
  };
  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      const raw = asArray(response.data);
      setClasses(raw.map(normalizeClassRow).filter((c) => c.id));
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };
  const fetchSections = async (classId = "") => {
    try {
      const url = classId ? `/sections?class_id=${classId}` : `/sections`;
      const res = await api.get(url);
      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data?.sections)
        ? res.data.sections
        : [];
      const list = raw.map(normalizeSectionRow).filter((s) => s.id);
      setSections(list);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setSections([]);
    }
  };
  const fetchStudentsByClassAndSection = useCallback(async () => {
    if (!selectedClass || !selectedSection) {
      setStudents([]);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.append("class_id", selectedClass);
      params.append("section_id", selectedSection);
      if (selectedSession) params.append("session_id", selectedSession);
      const url = `/students/searchByClassAndSection?${params.toString()}`;
      const res = await api.get(url);
      const raw = asArray(res.data);
      setStudents(raw.map(normalizeStudentRow).filter((s) => s.id));
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
    }
  }, [selectedClass, selectedSection, selectedSession]);
  const ensurePrevBalanceHeadId = async () => {
    if (prevBalanceHeadId) return prevBalanceHeadId;
    try {
      const res = await api.get("/fee-headings");
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      const hit = list.find(
        (h) => String(h.fee_heading).toLowerCase() === "previous balance"
      );
      if (hit) {
        setPrevBalanceHeadId(hit.id);
        return hit.id;
      }
    } catch (e) {
      console.warn("fee-headings fetch failed:", e?.message || e);
    }
    return null;
  };
  const fetchOpeningBalanceOutstanding = async (studentId, sessionId) => {
    try {
      const try1 = await api.get(`/opening-balances/outstanding`, {
        params: { student_id: studentId, session_id: sessionId },
      });
      const val1 = Number(
        try1?.data?.outstanding ??
          try1?.data?.data?.outstanding ??
          try1?.data?.totalOutstanding
      );
      if (!Number.isNaN(val1) && val1 > 0) return val1;
    } catch (_) {}
    try {
      const res = await api.get(`/opening-balances`, {
        params: { student_id: studentId, session_id: sessionId },
      });
      const rows = Array.isArray(res.data?.rows)
        ? res.data.rows
        : Array.isArray(res.data)
        ? res.data
        : [];
      if (!rows.length) return 0;
      const providedTotal = Number(
        res.data?.outstanding ||
          res.data?.totalOutstanding ||
          res.data?.totals?.outstanding
      );
      if (!Number.isNaN(providedTotal)) return Math.max(0, providedTotal);
      const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      return Math.max(0, total);
    } catch (e) {
      console.warn("opening balance fetch failed:", e?.message || e);
      return 0;
    }
  };
  const fetchFeeHeadsForStudent = async (
    _classId,
    studentId,
    baseStudentFromAdmission = null
  ) => {
    try {
      setModalError(null);
      if (!selectedSession) {
        setModalError("Please select an academic session before loading fee details.");
        return;
      }
      const feeResponse = await api.get(
        `/students/${studentId}/fee-details?session_id=${selectedSession}`
      );
      const feeDetailsData = feeResponse.data.feeDetails || [];
      const baseStudent =
        feeResponse?.data?.student || baseStudentFromAdmission || {};
      const studentRouteFromFeeDetails = baseStudent?.route || null;
      const [
        receivedVanFeeResponse,
        lastRouteResponse,
        routeDetailsResponse,
        fineEligibilityMap,
      ] = await Promise.all([
        api.get(
          `/transactions/vanfee/${studentId}?session_id=${selectedSession}`
        ),
        api.get(
          `/transactions/last-route/${studentId}?session_id=${selectedSession}`
        ),
        api.get(`/transportations`),
        fetchFineEligibility(studentId),
      ]);
      let transportDueMap = {};
      let firstTransportItem = null;
      try {
        const dueResp = await api.get(
          `/student-transport/due/${studentId}?session_id=${selectedSession}`
        );
        const dueData = dueResp.data?.data || {};
        const items = Array.isArray(dueData.items) ? dueData.items : [];
        items.forEach((it) => {
          if (it.Fee_Head !== undefined && it.Fee_Head !== null) {
            transportDueMap[String(it.Fee_Head)] = it;
          }
        });
        firstTransportItem = items.length ? items[0] : null;
      } catch (err) {
        console.warn(
          "student-transport/due endpoint not available or failed:",
          err?.message || err
        );
      }
      let serverTransportCostGlobal = null;
      const serverTransportCostByHead = {};
      const receivedVanData =
        receivedVanFeeResponse.data && receivedVanFeeResponse.data.data
          ? receivedVanFeeResponse.data.data
          : Array.isArray(receivedVanFeeResponse.data)
          ? receivedVanFeeResponse.data
          : [];
      if (Array.isArray(receivedVanData)) {
        if (
          receivedVanData.length > 0 &&
          typeof receivedVanData[0].TransportCost !== "undefined"
        ) {
          serverTransportCostGlobal =
            Number(receivedVanData[0].TransportCost) || null;
        }
        receivedVanData.forEach((it) => {
          if (it.Fee_Head !== undefined && it.TransportCost !== undefined) {
            serverTransportCostByHead[String(it.Fee_Head)] =
              Number(it.TransportCost) || 0;
          }
        });
      }
      const receivedVanFeeMap = {};
      const vanFeeConcessionMap = {};
      (receivedVanData || []).forEach((item) => {
        receivedVanFeeMap[item.Fee_Head] =
          parseFloat(item.TotalVanFeeReceived) || 0;
        vanFeeConcessionMap[item.Fee_Head] =
          parseFloat(item.TotalVanFeeConcession) || 0;
      });
      const lastRouteMap = {};
      (lastRouteResponse.data.data || []).forEach((item) => {
        lastRouteMap[item.Fee_Head] = item.Route_Number || "";
      });
      const transportRoutesData = Array.isArray(routeDetailsResponse.data)
        ? routeDetailsResponse.data
        : Array.isArray(routeDetailsResponse.data?.data)
        ? routeDetailsResponse.data.data
        : [];
      const today = new Date();
      const studentAssignedRouteId =
        baseStudent?.transport_id ??
        baseStudent?.route_id ??
        baseStudent?.Route_Number ??
        baseStudent?.Transportation?.id ??
        studentRouteFromFeeDetails?.route_id ??
        null;
      const hasExistingTxnForStudent =
        Array.isArray(receivedVanData) && receivedVanData.length > 0;
      const feeDetails = feeDetailsData.map((detail) => {
        const headId = detail.fee_heading_id;
        const transportApplicable =
          /^(yes|true|1)$/i.test(
            String(detail.transportApplicable ?? "")
          ) ||
          /transport|van/i.test(
            String(detail.fee_heading || detail.Fee_Heading_Name || "")
          );
        const baseFeeDue = detail.feeDue || 0;
        const extraConcession = 0;
        const academicDue = Math.max(0, baseFeeDue - extraConcession);
        const key = String(headId);
        let eligible;
        if (
          fineEligibilityMap &&
          Object.prototype.hasOwnProperty.call(fineEligibilityMap, key)
        ) {
          const val = fineEligibilityMap[key];
          eligible =
            val === true || val === "true" || val === 1 || val === "1";
        } else {
          eligible = true;
        }
        const originalFine = eligible ? detail.fineAmount || 0 : 0;
        const transportItem = transportDueMap[String(headId)] ?? null;
        const serverCostPerHead = serverTransportCostByHead[String(headId)];
        const serverCost =
          typeof serverCostPerHead !== "undefined" &&
          serverCostPerHead !== null
            ? serverCostPerHead
            : serverTransportCostGlobal !== null
            ? serverTransportCostGlobal
            : null;
        const rawStudentAssignedRouteId =
          baseStudent?.transport_id ??
          baseStudent?.route_id ??
          baseStudent?.Route_Number ??
          baseStudent?.Transportation?.id ??
          studentRouteFromFeeDetails?.route_id ??
          null;
        const normalizeRouteId = (maybeId) => {
          if (
            maybeId === undefined ||
            maybeId === null ||
            String(maybeId).trim() === ""
          )
            return null;
          const routes = Array.isArray(transportRoutesData)
            ? transportRoutesData
            : [];
          const hit = routes.find(
            (r) =>
              String(r?.id ?? "") === String(maybeId) ||
              String(r?.Route_Number ?? "") === String(maybeId) ||
              String(r?.route_id ?? "") === String(maybeId)
          );
          return hit ? String(hit.id) : null;
        };
        const inferredRouteIdForHead = (hid) =>
          normalizeRouteId(lastRouteMap[hid]) ??
          normalizeRouteId(rawStudentAssignedRouteId) ??
          null;
        const feeDetailCost = pickNum(
          detail.transportCost,
          detail.TransportCost,
          detail.routeFee,
          detail.route_fee,
          detail.route_cost,
          detail.monthly_fee,
          detail.van_fee,
          detail.vanFee,
          detail.transport_amount,
          detail.amount,
          detail.price,
          detail.fare
        );
        const routeId = inferredRouteIdForHead(headId);
        const selectedRouteObj = routeId
          ? (Array.isArray(transportRoutesData)
              ? transportRoutesData
              : []
            ).find(
              (r) => String(r?.id ?? "") === String(routeId)
            ) || null
          : null;
        const routeObjCost = selectedRouteObj
          ? pickNum(
              selectedRouteObj.Cost,
              selectedRouteObj.cost,
              selectedRouteObj.TransportCost,
              selectedRouteObj.transport_cost,
              selectedRouteObj.route_cost,
              selectedRouteObj.monthly_fee,
              selectedRouteObj.per_month,
              selectedRouteObj.perMonth,
              selectedRouteObj.fare,
              selectedRouteObj.Fare,
              selectedRouteObj.amount,
              selectedRouteObj.price,
              selectedRouteObj.rate,
              selectedRouteObj.Rate
            )
          : 0;
        const transportItemCost = transportItem
          ? pickNum(
              transportItem.transportCost,
              transportItem.TransportCost,
              transportItem.cost,
              transportItem.Cost,
              transportItem.routeCost,
              transportItem.monthly_fee,
              transportItem.MonthlyFee,
              transportItem.per_month,
              transportItem.perMonth,
              transportItem.amount,
              transportItem.price,
              transportItem.fare
            )
          : 0;
        const studentTransportCost = Number(
          baseStudent?.Transportation?.Cost ??
            baseStudent?.transport_cost ??
            baseStudent?.TransportCost ??
            studentRouteFromFeeDetails?.route_cost ??
            0
        );
        const serverCostVal = pickNum(serverCostPerHead, serverTransportCostGlobal);
        const selectedRouteFee = pickNum(
          transportItemCost,
          serverCostVal,
          feeDetailCost,
          routeObjCost,
          studentTransportCost,
          studentRouteFromFeeDetails?.route_cost
        );
        const receivedVanFeeFromMap = receivedVanFeeMap[headId] || 0;
        const vanFeeConcessionFromMap = vanFeeConcessionMap[headId] || 0;
        const receivedFromServer =
          transportItem &&
          (transportItem.received !== undefined ||
            transportItem.TotalVanFeeReceived !== undefined)
            ? Number(
                transportItem.received !== undefined
                  ? transportItem.received
                  : transportItem.TotalVanFeeReceived || 0
              )
            : receivedVanFeeFromMap;
        const concessionFromServer =
          transportItem &&
          (transportItem.concession !== undefined ||
            transportItem.TotalVanFeeConcession !== undefined)
            ? Number(
                transportItem.concession !== undefined
                  ? transportItem.concession
                  : transportItem.TotalVanFeeConcession || 0
              )
            : vanFeeConcessionFromMap;
        const remainingBeforeFineFromServer =
          transportItem &&
          (transportItem.remainingBeforeFine !== undefined ||
            transportItem.RemainingBeforeFine !== undefined)
            ? Number(
                transportItem.remainingBeforeFine !== undefined
                  ? transportItem.remainingBeforeFine
                  : transportItem.RemainingBeforeFine || 0
              )
            : Math.max(
                0,
                selectedRouteFee - (receivedFromServer || 0) - (concessionFromServer || 0)
              );
        const vanFineFromServer = Number(
          transportItem?.vanFine ??
            transportItem?.vanFineAmount ??
            transportItem?.VanFineAmount ??
            0
        );
        const finalDue =
          transportItem &&
          (transportItem.due !== undefined ||
            transportItem.FinalDue !== undefined)
            ? Number(transportItem.due ?? transportItem.FinalDue ?? 0)
            : Math.max(0, remainingBeforeFineFromServer + vanFineFromServer);
        let showVan;
        if (hasExistingTxnForStudent) {
          showVan = Boolean(transportApplicable);
        } else {
          const rid = inferredRouteIdForHead(headId);
          showVan = Boolean(
            transportApplicable &&
              (transportItem ||
                selectedRouteFee > 0 ||
                rid ||
                studentAssignedRouteId)
          );
        }
        const vanFields = showVan
          ? {
              VanFee: 0,
              Van_Fee_Concession: concessionFromServer,
              _vanFeeConcession: concessionFromServer,
              _routeFee: selectedRouteFee,
              _receivedVanFee: receivedFromServer,
              Van_Fee_Remaining: remainingBeforeFineFromServer,
              Van_Fee_Due: finalDue,
              Van_Fine_Amount: vanFineFromServer,
              SelectedRoute: inferredRouteIdForHead(headId),
            }
          : {
              VanFee: 0,
              Van_Fee_Concession: 0,
              _vanFeeConcession: 0,
              _routeFee: 0,
              _receivedVanFee: 0,
              Van_Fee_Remaining: 0,
              Van_Fee_Due: 0,
              Van_Fine_Amount: 0,
              SelectedRoute: null,
            };
        const baseRow = {
          Fee_Head: headId,
          Fee_Heading_Name: detail.fee_heading,
          Fee_Due: academicDue,
          Original_Fee_Due: detail.original_fee_due,
          fineAmount: originalFine,
          isFineApplicable: eligible && originalFine > 0,
          Fine_Amount: 0,
          defaultConcessionAmount: detail.concession_applied
            ? detail.concession_amount
            : 0,
          Fee_Recieved: 0,
          Concession: extraConcession,
          ShowVanFeeInput: showVan,
          ...vanFields,
        };
        if (!hasExistingTxnForStudent && transportApplicable) {
          const hasGlobalCostSignal =
            Number(baseRow._routeFee) > 0 ||
            serverTransportCostGlobal !== null ||
            typeof serverCostPerHead !== "undefined" ||
            Number(routeObjCost) > 0 ||
            Number(feeDetailCost) > 0 ||
            Number(studentTransportCost) > 0 ||
            Number(studentRouteFromFeeDetails?.route_cost || 0) > 0;
          const hasHeadSpecificItem = Boolean(transportDueMap[String(headId)]);
          if (hasGlobalCostSignal && !hasHeadSpecificItem) {
            const fallbackCost = pickNum(
              baseRow._routeFee,
              studentTransportCost,
              routeObjCost,
              feeDetailCost,
              selectedRouteFee
            );
            const inferredConcession = Number(baseRow.Van_Fee_Concession || 0) || 0;
            const remaining = Math.max(
              0,
              Number(fallbackCost || 0) - inferredConcession
            );
            const vanFine = baseRow.Van_Fine_Amount || 0;
            return {
              ...baseRow,
              ShowVanFeeInput: true,
              _routeFee: Number(fallbackCost || 0),
              _receivedVanFee: 0,
              _vanFeeConcession: inferredConcession,
              Van_Fee_Remaining: remaining,
              Van_Fine_Amount: vanFine,
              Van_Fee_Due: Math.max(0, remaining + vanFine),
            };
          }
        }
        return baseRow;
      });
      try {
        const headId = await ensurePrevBalanceHeadId();
        if (headId && baseStudent?.id && selectedSession) {
          const obDue = await fetchOpeningBalanceOutstanding(
            baseStudent.id,
            selectedSession
          );
          setOpeningBalanceDue(obDue || 0);
          if (obDue > 0) {
            const openingRow = {
              isOpeningBalance: true,
              Fee_Head: headId,
              Fee_Heading_Name: "Previous Balance",
              Original_Fee_Due: obDue,
              Fee_Due: obDue,
              Fee_Recieved: 0,
              Concession: 0,
              fineAmount: 0,
              isFineApplicable: false,
              Fine_Amount: 0,
              ShowVanFeeInput: false,
              VanFee: 0,
              Van_Fee_Due: 0,
              Van_Fee_Remaining: 0,
              Van_Fine_Amount: 0,
              Van_Fee_Concession: 0,
              _vanFeeConcession: 0,
              _routeFee: 0,
              _receivedVanFee: 0,
              SelectedRoute: null,
              defaultConcessionAmount: 0,
            };
            feeDetails.unshift(openingRow);
          }
        } else {
          setOpeningBalanceDue(0);
        }
      } catch (e) {
        console.warn("OB injection failed:", e?.message || e);
        setOpeningBalanceDue(0);
      }
      setFeeHeads(feeDetails);
      setNewTransactionDetails(feeDetails);
      if (feeResponse.data.student) {
        setSelectedStudentInfo(feeResponse.data.student);
      }
    } catch (error) {
      console.error("Error fetching fee details:", error);
      setModalError("Unable to load fee details. Please try again or contact support.");
      setFeeHeads([]);
      setNewTransactionDetails([]);
    }
  };
  const fetchStudentAndFeeByAdmissionNumber = async () => {
    if (!searchAdmissionNumber) return;
    try {
      setModalError(null);
      const response = await api.get(
        `/students/admission/${searchAdmissionNumber}`
      );
      const raw = response.data;
      if (raw) {
        const student = normalizeStudentRow(raw);
        if (!selectedAdmissionStudent || selectedAdmissionStudent.id !== student.id) {
          setSelectedAdmissionStudent(student);
          setSelectedStudentInfo(student);
          if (!selectedSession) {
            setModalError(
              "Please select an academic session before loading fee details."
            );
            return;
          }
          fetchFeeHeadsForStudent(student.class_id, student.id, student);
        }
      } else {
        setModalError("No student found with this admission number.");
        setSelectedAdmissionStudent(null);
        setSelectedStudentInfo(null);
        setFeeHeads([]);
      }
    } catch (error) {
      console.error("Error fetching student:", error);
      setModalError(
        error.response?.data?.message ||
          "An error occurred while searching for the student."
      );
    }
  };
  const getAcademicRemaining = (row) =>
    Math.max(
      0,
      (row.Fee_Due || 0) - (row.Fee_Recieved || 0) - (row.Concession || 0)
    );
  const getFineRemaining = (row) =>
    row.isFineApplicable
      ? Math.max(0, (row.fineAmount || 0) - (row.Fine_Amount || 0))
      : 0;
  const getVanRemaining = (row) => {
    if (!row.ShowVanFeeInput) return 0;
    const alreadyEntered = Number(row.VanFee || 0);
    const remaining = Math.max(0, (row.Van_Fee_Due || 0) - alreadyEntered);
    return remaining;
  };
  const sortTuitionFirst = (rows) => {
    const withIdx = rows.map((r, i) => ({ r, i }));
    withIdx.sort((a, b) => {
      const at = /tuition/i.test(a.r.Fee_Heading_Name) ? 1 : 0;
      const bt = /tuition/i.test(b.r.Fee_Heading_Name) ? 1 : 0;
      if (bt !== at) return bt - at;
      return a.i - b.i;
    });
    return withIdx.map((x) => x.i);
  };
  const autoAllocateQuickAmount = () => {
    const amt = parseInt(quickAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      Swal.fire("Enter amount", "Please enter a positive amount to auto-fill.", "info");
      return;
    }
    if (!newTransactionDetails.length) {
      setModalError("Pick a student and load fee details first to auto-allocate.");
      return;
    }
    let remaining = amt;
    const updated = newTransactionDetails.map((d) => ({ ...d }));
    const order = sortTuitionFirst(updated);
    for (const idx of order) {
      if (remaining <= 0) break;
      const row = updated[idx];
      const acadNeed = getAcademicRemaining(row);
      if (acadNeed > 0 && remaining > 0) {
        const take = Math.min(remaining, acadNeed);
        row.Fee_Recieved = (row.Fee_Recieved || 0) + take;
        remaining -= take;
      }
      const fineNeed = getFineRemaining(row);
      if (!row.isFineEdited && fineNeed > 0 && remaining > 0) {
        const takeFine = Math.min(remaining, fineNeed);
        row.Fine_Amount = (row.Fine_Amount || 0) + takeFine;
        remaining -= takeFine;
      }
      const vanNeed = getVanRemaining(row);
      if (vanNeed > 0 && remaining > 0) {
        const takeVan = Math.min(remaining, vanNeed);
        row.VanFee = (row.VanFee || 0) + takeVan;
        remaining -= takeVan;
      }
      // keep Van_Fee_Remaining in sync
      if (row.ShowVanFeeInput) {
        const baseDueNoFine = Math.max(
          0,
          (row.Van_Fee_Due || 0) - (row.Van_Fine_Amount || 0)
        );
        row.Van_Fee_Remaining = Math.max(0, baseDueNoFine - (row.VanFee || 0));
      }
    }
    setNewTransactionDetails(updated);
    if (remaining > 0) {
      Swal.fire(
        "Amount left",
        `₹${remaining.toLocaleString(
          "en-IN"
        )} could not be allocated (no remaining dues/fines/van fees).`,
        "info"
      );
    }
  };
  const clearQuickAllocations = () => {
    if (!newTransactionDetails.length) return;
    const cleared = newTransactionDetails.map((d) => ({
      ...d,
      Fee_Recieved: 0,
      Fine_Amount: 0,
      VanFee: 0,
    }));
    setNewTransactionDetails(cleared);
  };
  const saveTransaction = async () => {
    try {
      setModalError(null);
      if (editingTransaction) {
        const updatedTransaction = {
          Fee_Recieved: editingTransaction.Fee_Recieved,
          Concession: editingTransaction.Concession,
          VanFee: editingTransaction.VanFee,
          Fine_Amount: editingTransaction.Fine_Amount || 0,
          Van_Fee_Concession: editingTransaction.Van_Fee_Concession,
          PaymentMode: editingTransaction.PaymentMode,
          Transaction_ID:
            editingTransaction.PaymentMode === "Online"
              ? editingTransaction.Transaction_ID
              : null,
          session_id: editingTransaction.session_id ?? null,
          Remarks: editingTransaction.Remarks || null,
        };
        const response = await api.put(
          `/transactions/${editingTransaction.Serial}`,
          updatedTransaction
        );
        if (response.data.success) {
          Swal.fire("Updated!", "Transaction has been updated successfully.", "success");
          fetchTransactions();
          fetchDaySummary();
          setShowModal(false);
          setEditingTransaction(null);
        } else {
          setModalError(
            response.data.message || "Unable to update transaction."
          );
        }
      } else {
        if (!selectedStudentInfo || newTransactionDetails.length === 0) {
          setModalError("Please select a student and fill in the fee details.");
          return;
        }
        if (!paymentMode) {
          setModalError("Please select a payment mode.");
          return;
        }
        if (!selectedSession) {
          setModalError("Please select an academic session before collecting.");
          return;
        }
        const transactionsPayload = newTransactionDetails.map((details) => ({
          AdmissionNumber: selectedStudentInfo.admission_number,
          Student_ID: selectedStudentInfo.id,
          Class_ID: selectedStudentInfo.class_id,
          Section_ID: selectedStudentInfo.section_id,
          DateOfTransaction: new Date().toISOString(),
          Fee_Head: details.Fee_Head,
          Fee_Recieved: details.Fee_Recieved,
          Concession: details.isOpeningBalance ? 0 : details.Concession,
          VanFee:
            details.ShowVanFeeInput && !details.isOpeningBalance
              ? details.VanFee || 0
              : null,
          Van_Fee_Concession:
            details.ShowVanFeeInput && !details.isOpeningBalance
              ? details.Van_Fee_Concession || 0
              : null,
          Route_ID:
            details.ShowVanFeeInput &&
            details.SelectedRoute &&
            !details.isOpeningBalance
              ? Number(details.SelectedRoute)
              : null,
          PaymentMode: paymentMode,
          Transaction_ID: paymentMode === "Online" ? transactionID : null,
          Fine_Amount:
            details.isFineApplicable && !details.isOpeningBalance
              ? details.Fine_Amount || 0
              : 0,
          session_id: selectedSession,
          Remarks: remarks || null,
        }));
        const response = await api.post("/transactions/bulk", {
          transactions: transactionsPayload,
        });
        if (response.data.success) {
          Swal.fire({
            title: "Added!",
            text: `Transactions added with Slip ID: ${response.data.slipId}. Print receipt?`,
            icon: "success",
            showCancelButton: true,
            confirmButtonText: "Print Receipt",
            cancelButtonText: "Close",
            allowOutsideClick: false,
          }).then((result) => {
            if (result.isConfirmed) handlePrintReceipt(response.data.slipId);
          });
          resetForm();
          fetchTransactions();
          fetchDaySummary();
        } else {
          setModalError(response.data.message || "Failed to create transactions.");
        }
        await fetchFeeHeadsForStudent(
          selectedStudentInfo.class_id,
          selectedStudentInfo.id
        );
      }
    } catch (error) {
      console.error("Error saving transactions:", error);
      const serverMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message;
      setModalError(
        serverMsg || "An error occurred while saving the transaction."
      );
    }
  };
  const resetForm = () => {
    setFeeHeads([]);
    setNewTransactionDetails([]);
    setSelectedStudentInfo(null);
    setSelectedClass("");
    setSelectedSection("");
    setStudents([]);
    setShowModal(false);
    setPaymentMode("Cash");
    setTransactionID("");
    setQuickAmount("");
    setModalError(null);
    setRemarks("");
  };
  const cancelTransaction = async (id) => {
    try {
      await api.post(`/transactions/${id}/cancel`);
      Swal.fire("Cancelled!", "Transaction has been cancelled.", "success");
      fetchTransactions();
      fetchDaySummary();
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      Swal.fire(
        "Error!",
        error.response?.data?.message || "Unable to cancel.",
        "error"
      );
    }
  };
  const deleteTransaction = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      Swal.fire("Deleted!", "Transaction permanently deleted.", "success");
      fetchTransactions();
      fetchDaySummary();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      Swal.fire(
        "Error!",
        error.response?.data?.message || "Unable to delete.",
        "error"
      );
    }
  };
  useEffect(() => {
    fetchTransportRoutes();
    fetchClasses();
    fetchSections();
    fetchSessions();
  }, []);
  useEffect(() => {
    if (showModal) {
      setSearchAdmissionNumber("");
      setSelectedAdmissionStudent(null);
      setSelectedStudentInfo(null);
      setFeeHeads([]);
      setNewTransactionDetails([]);
      setPaymentMode("Cash");
      setTransactionID("");
      setQuickAmount("");
      setModalError(null);
    }
  }, [showModal]);
  useEffect(() => {
    fetchSections(selectedClass);
    fetchStudentsByClassAndSection();
  }, [selectedClass, selectedSection]);
  useEffect(() => {
    fetchTransactions();
    fetchDaySummary();
    const intervalId = setInterval(() => {
      fetchTransactions();
      fetchDaySummary();
    }, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);
  const cashCollection = useMemo(() => {
    return (daySummary.paymentSummary || [])
      .filter((p) => p.PaymentMode === "Cash")
      .reduce(
        (acc, p) => acc + parseFloat(p.TotalAmountCollected || 0),
        0
      );
  }, [daySummary.paymentSummary]);
  const totalVanConcessionDay = useMemo(() => 
    transactions.reduce((sum, t) => sum + (t.Van_Fee_Concession || 0), 0),
    [transactions]
  );
  return (
    <div className="container-fluid mt-4">
      <h2 className="mb-3 text-center">Transactions Management</h2>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold text-primary">Transaction Summary for Today</h4>
        <span className="text-muted fs-6">{new Date().toLocaleDateString()}</span>
      </div>
      {daySummary && daySummary.data ? (
        <Row className="mb-4 g-3">
          <Col md={3}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">
                  Total Collection
                </div>
                <div className="fs-3 fw-bold">
                  {formatINR(daySummary.grandTotal || 0)}
                </div>
                <Badge bg="success" className="mt-2">
                  Cash: {formatINR(cashCollection)}
                </Badge>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">
                  Fee Received
                </div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalFeeReceived || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">
                  Van Fee
                </div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalVanFee || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">
                  Concession
                </div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalConcession || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">
                  Van Fee Cons.
                </div>
                <div className="fs-4 fw-bold">
                  {formatINR(totalVanConcessionDay)}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={1}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">Fine</div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalFine || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : (
        <p className="text-center text-muted">
          Loading transaction summary...
        </p>
      )}
      <Row className="mb-4 g-3">
        {(daySummary.paymentSummary || []).map((p) => (
          <Col md={3} key={p.PaymentMode}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">
                  {p.PaymentMode === "Cash"
                    ? "Cash Collection"
                    : "Online Collection"}
                </div>
                <div className="fs-4 fw-bold">
                  {formatINR(parseFloat(p.TotalAmountCollected || 0))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <Form.Group className="mb-0" style={{ minWidth: 280 }}>
            <Form.Label className="mb-0" style={{ fontSize: 12 }}>
              Academic Session
            </Form.Label>
            <Form.Select
              value={selectedSession ?? ""}
              onChange={(e) =>
                setSelectedSession(
                  e.target.value ? Number(e.target.value) : null
                )
              }
            >
              <option value="">Select Session</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ||
                    s.label ||
                    `${s.start_date || ""} - ${s.end_date || ""}`}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <div
            className="form-text ms-2"
            style={{ fontSize: 12, color: "#6c757d" }}
          >
            Pick session once — applies to collections.
          </div>
        </div>
        <div>
          <Button
            variant="success"
            className="btn-collect"
            onClick={() => {
              if (!selectedSession) {
                Swal.fire(
                  "Session required",
                  "Please select an academic session before collecting fees.",
                  "warning"
                );
                return;
              }
              setEditingTransaction(null);
              resetForm();
              fetchClasses();
              fetchSections();
              fetchStudentsByClassAndSection();
              setShowModal(true);
            }}
          >
            + Collect Fee
          </Button>
        </div>
      </div>
      <div className="table-responsive">
        <table className="table table-striped table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Slip ID</th>
              <th>Adm. No.</th>
              <th>Class</th>
              <th>Date & Time</th>
              <th>Head</th>
              <th>Concession</th>
              <th>Fee Received</th>
              <th>Van Fee</th>
              <th>Van Fee Cons.</th>
              <th>Fine</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>Actions</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const grouped = new Map();
              const activeTxns = (transactions || []).filter(
                (t) => t.status !== "cancelled"
              );
              activeTxns.forEach((t) => {
                if (!grouped.has(t.Slip_ID)) grouped.set(t.Slip_ID, []);
                grouped.get(t.Slip_ID).push(t);
              });
              const rows = Array.from(grouped.entries()).flatMap(
                ([slipID, group]) =>
                  group.map((t, index) => {
                    const isMiddleRow = index === Math.floor(group.length / 2);
                    return (
                      <tr key={t.Serial}>
                        <td>
                          {activeTxns.length - activeTxns.indexOf(t)}
                        </td>
                        <td>{t.Student?.name || "—"}</td>
                        <td>{t.Slip_ID}</td>
                        <td>{t.AdmissionNumber}</td>
                        <td>{t.Class?.class_name || "—"}</td>
                        <td>
                          {new Date(
                            t.DateOfTransaction
                          ).toLocaleString()}
                        </td>
                        <td>{t.FeeHeading?.fee_heading || "—"}</td>
                        <td>{formatINR(t.Concession)}</td>
                        <td>{formatINR(t.Fee_Recieved)}</td>
                        <td>{formatINR(t.VanFee)}</td>
                        <td>{formatINR(t.Van_Fee_Concession || 0)}</td>
                        <td
                          className={
                            t.Fine_Amount > 0 ? "text-danger fw-bold" : ""
                          }
                        >
                          {formatINR(t.Fine_Amount || 0)}
                        </td>
                        <td>{t.PaymentMode}</td>
                        <td>
                          <Badge bg="success">Active</Badge>
                        </td>
                        <td>{t.Remarks || "—"}</td>
                        <td className="text-nowrap">
                          <Button
                            variant="primary"
                            size="sm"
                            className="me-1"
                            onClick={() => {
                              setEditingTransaction({
                                Serial: t.Serial,
                                Fee_Recieved: t.Fee_Recieved,
                                Concession: t.Concession,
                                VanFee: t.VanFee,
                                Fine_Amount: t.Fine_Amount || 0,
                                Van_Fee_Concession: t.Van_Fee_Concession || 0,
                                PaymentMode: t.PaymentMode,
                                Transaction_ID: t.Transaction_ID || "",
                                FeeHeadingName:
                                  t.FeeHeading?.fee_heading || "—",
                                StudentName: t.Student?.name || "—",
                                AdmissionNumber: t.AdmissionNumber,
                                ClassName: t.Class?.class_name || "—",
                                DateOfTransaction: t.DateOfTransaction,
                                session_id: t.session_id ?? null,
                                Remarks: t.Remarks || "",
                              });
                              setSelectedSession(
                                t.session_id ?? selectedSession ?? null
                              );
                              setShowModal(true);
                            }}
                          >
                            Edit
                          </Button>
                          {canCancel() && (
                            <Button
                              variant="warning"
                              size="sm"
                              className="me-1"
                              onClick={() =>
                                Swal.fire({
                                  title: "Cancel this transaction?",
                                  text: "Status will become cancelled.",
                                  icon: "warning",
                                  showCancelButton: true,
                                  confirmButtonText: "Yes, cancel",
                                }).then((r) => {
                                  if (r.isConfirmed)
                                    cancelTransaction(t.Serial);
                                })
                              }
                            >
                              Cancel
                            </Button>
                          )}
                          {canDelete(t) && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                Swal.fire({
                                  title: "Delete permanently?",
                                  text: "This cannot be undone.",
                                  icon: "error",
                                  showCancelButton: true,
                                  confirmButtonText: "Yes, delete",
                                }).then((r) => {
                                  if (r.isConfirmed)
                                    deleteTransaction(t.Serial);
                                })
                              }
                            >
                              Delete
                            </Button>
                          )}
                        </td>
                        {isMiddleRow && (
                          <td className="align-middle text-center border-start border-0">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => viewReceipt(t.Slip_ID)}
                              className="me-2"
                            >
                              View
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                handlePrintReceipt(t.Slip_ID)
                              }
                            >
                              Print
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })
              );
              if (rows.length === 0) {
                return (
                  <tr key="no-data">
                    <td colSpan={17} className="text-center py-5 text-muted">
                      No transactions to display.
                    </td>
                  </tr>
                );
              }
              return rows;
            })()}
          </tbody>
        </table>
        {showReceiptModal && (
          <ReceiptModal
            show={showReceiptModal}
            onClose={() => setShowReceiptModal(false)}
            slipId={selectedSlipId}
          />
        )}
      </div>
      {/* Collect / Edit Modal */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        centered={false}
        size="lg"
        fullscreen="md-down"
        dialogClassName="collection-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingTransaction ? "Edit Transaction" : "Add Transaction"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && (
            <Alert
              variant="danger"
              onClose={() => setModalError(null)}
              dismissible
            >
              {modalError}
            </Alert>
          )}
          {!editingTransaction ? (
            <>
              <Tabs
                activeKey={activeTab}
                onSelect={(tab) => {
                  setActiveTab(tab);
                  setModalError(null);
                  if (tab === "admissionNumber") {
                    setSearchAdmissionNumber("");
                    setSelectedAdmissionStudent(null);
                    setFeeHeads([]);
                    setNewTransactionDetails([]);
                  } else if (tab === "searchByName") {
                    setSelectedStudentInfo(null);
                    setSelectedAdmissionStudent(null);
                    setFeeHeads([]);
                    setNewTransactionDetails([]);
                  }
                }}
                className="mb-3"
              >
                <Tab eventKey="admissionNumber" title="Search Student">
                  <style>{`
                    .sb-autocomplete { position: relative; }
                    .sb-menu {
                      position: absolute; top: 100%; left: 0; right: 0;
                      max-height: 280px; overflow: auto; z-index: 1056;
                      background: #fff; border: 1px solid rgba(0,0,0,.125);
                      border-radius: .375rem; margin-top: 4px;
                      box-shadow: 0 4px 16px rgba(0,0,0,.12);
                    }
                    .sb-item { padding: .5rem .75rem; cursor: pointer; display: flex; flex-direction: column; gap: 2px; }
                    .sb-item:hover, .sb-item.active { background: #f6f7f9; }
                    .primary-line { font-weight: 600; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .secondary-line { font-size: 12px; color: #6c757d; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .pill { font-weight: 500; font-size: 12px; color: #495057; background: #eef1f5; border-radius: 999px; padding: 1px 8px; margin-left: 6px; }
                  `}</style>
                  <Form.Group className="mb-3">
                    <Form.Label>Search (name / admission no.)</Form.Label>
                    <div className="sb-autocomplete" ref={sbWrapRef}>
                      <Form.Control
                        type="text"
                        value={sbQuery}
                        placeholder="Type name or admission no."
                        onChange={(e) => {
                          setSbQuery(e.target.value);
                          setModalError(null);
                          debounce(
                            () => fetchStudentsInline(e.target.value),
                            300
                          );
                        }}
                        onFocus={() => {
                          if (sbResults.length) setSbOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (!sbOpen || !sbResults.length) return;
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setSbActive(
                              (idx) => (idx + 1) % sbResults.length
                            );
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setSbActive(
                              (idx) =>
                                (idx - 1 + sbResults.length) % sbResults.length
                            );
                          } else if (e.key === "Enter") {
                            e.preventDefault();
                            const s = sbResults[sbActive] || sbResults[0];
                            if (s) handlePickStudent(s);
                          } else if (e.key === "Escape") {
                            setSbOpen(false);
                          }
                        }}
                        autoComplete="off"
                      />
                      {sbOpen && (
                        <div className="sb-menu">
                          {sbResults.length === 0 ? (
                            <div className="sb-item text-muted">
                              No students found
                            </div>
                          ) : (
                            sbResults.map((s, idx) => {
                              const className =
                                s?.Class?.class_name ||
                                s?.class_name ||
                                s?.class?.class_name ||
                                s?.className ||
                                "—";
                              const adm = s.admission_number || "—";
                              return (
                                <div
                                  key={s.id}
                                  className={`sb-item ${
                                    idx === sbActive ? "active" : ""
                                  }`}
                                  onMouseEnter={() => setSbActive(idx)}
                                  onClick={() => handlePickStudent(s)}
                                >
                                  <div className="primary-line">
                                    {escapeHtml(s.name)}
                                    <span className="pill">
                                      {escapeHtml(adm)}
                                    </span>
                                  </div>
                                  <div className="secondary-line">
                                    Class: {escapeHtml(className)}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                    <div className="form-text mt-1">
                      Uses current session for better matches
                      {selectedSession
                        ? ` (${
                            sessions.find((x) => x.id === selectedSession)
                              ?.name || ""
                          })`
                        : "" }
                      .
                    </div>
                  </Form.Group>
                  {selectedAdmissionStudent && (
                    <div className="student-brief-inline mb-3">
                      <span>
                        <strong>Name:</strong>{" "}
                        {selectedAdmissionStudent?.name || "—"}
                      </span>
                      <span>
                        | <strong>Class:</strong>{" "}
                        {selectedAdmissionStudent?.Class?.class_name ||
                          selectedAdmissionStudent?.class_name ||
                          "—"}
                      </span>
                      <span>
                        | <strong>Section:</strong>{" "}
                        {selectedAdmissionStudent?.Section?.section_name ||
                          selectedAdmissionStudent?.section_name ||
                          "—"}
                      </span>
                      <span>
                        | <strong>Father:</strong>{" "}
                        {selectedAdmissionStudent?.father_name || "—"}
                      </span>
                      <span>
                        | <strong>Adm No:</strong>{" "}
                        {selectedAdmissionStudent?.admission_number || "—"}
                      </span>
                    </div>
                  )}
                </Tab>
                <Tab eventKey="searchByName" title="Search by Class">
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    <Form.Group style={{ minWidth: 200 }}>
                      <Form.Label>Class</Form.Label>
                      <Form.Select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                      >
                        <option value="">Select Class</option>
                        {(Array.isArray(classes) ? classes : []).map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.class_name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Form.Group style={{ minWidth: 200 }}>
                      <Form.Label>Section</Form.Label>
                      <Form.Select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                      >
                        <option value="">Select Section</option>
                        {(Array.isArray(sections) ? sections : []).map(
                          (sec) => (
                            <option key={sec.id} value={sec.id}>
                              {sec.section_name}
                            </option>
                          )
                        )}
                      </Form.Select>
                    </Form.Group>
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label>Student</Form.Label>
                    <Form.Select
                      onChange={(e) => {
                        const student = students.find(
                          (s) => s.id === parseInt(e.target.value, 10)
                        );
                        setSelectedStudentInfo(student);
                        if (student) {
                          if (!selectedSession) {
                            setModalError(
                              "Please select an academic session before loading fee details."
                            );
                            return;
                          }
                          fetchFeeHeadsForStudent(student.class_id, student.id);
                        }
                      }}
                      disabled={!students.length}
                    >
                      <option value="">Select Student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} - {s.admission_number}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  {selectedStudentInfo && (
                    <div className="student-brief-inline mb-2">
                      <div>
                        <strong>Name:</strong>{" "}
                        {selectedStudentInfo?.name || "—"}
                      </div>
                      <div>
                        | <strong>Class:</strong>{" "}
                        {selectedStudentInfo?.Class?.class_name ||
                          selectedStudentInfo?.class_name ||
                          "—"}
                      </div>
                      <div>
                        | <strong>Section:</strong>{" "}
                        {selectedStudentInfo?.Section?.section_name ||
                          selectedStudentInfo?.section_name ||
                          "—"}
                      </div>
                      <div>
                        | <strong>Father:</strong>{" "}
                        {selectedStudentInfo?.father_name || "—"}
                      </div>
                      <div>
                        | <strong>Adm No:</strong>{" "}
                        {selectedStudentInfo?.admission_number || "—"}
                      </div>
                    </div>
                  )}
                </Tab>
              </Tabs>
              {feeHeads.length > 0 && (
                <Card className="mb-3 shadow-sm">
                  <Card.Body
                    className="d-flex flex-wrap align-items-center justify-content-between gap-3"
                    style={{ padding: "0.75rem 1rem" }}
                  >
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      <div className="fw-semibold text-secondary">
                        Total Due:{" "}
                        <span className="text-danger">
                          {formatINR(
                            newTransactionDetails.reduce(
                              (sum, row) => sum + dueIncludingVanForRow(row),
                              0
                            )
                          )}
                        </span>
                      </div>
                      <div className="fw-semibold text-secondary">
                        | Selected Due:{" "}
                        <span className="text-success">
                          {formatINR(selectedDueTotal || 0)}
                        </span>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <Form.Control
                        type="number"
                        placeholder="Quick Fill ₹"
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                        style={{
                          width: 120,
                          textAlign: "right",
                          fontWeight: "500",
                          fontSize: "0.9rem",
                        }}
                      />
                      <Button
                        variant="success"
                        size="sm"
                        onClick={autoAllocateQuickAmount}
                      >
                        Apply
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={clearQuickAllocations}
                      >
                        Clear
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              )}
              {feeHeads.length > 0 && (
                <>
                  <h5 className="mb-2">Fee Details</h5>
                  <div className="collection-table-wrap">
                    <table className="table table-bordered mb-0">
                      <thead className="table-light sticky-top">
                        <tr style={{ fontSize: "0.85rem" }}>
                          <th style={{ width: 45, textAlign: "center" }}>
                            <Form.Check
                              type="checkbox"
                              aria-label="Select all fee heads"
                              checked={
                                newTransactionDetails.length > 0 &&
                                newTransactionDetails.every((row) =>
                                  selectedHeads.has(String(row.Fee_Head))
                                )
                              }
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedHeads(() => {
                                  if (!checked) return new Set();
                                  const all = new Set();
                                  newTransactionDetails.forEach((row) =>
                                    all.add(String(row.Fee_Head))
                                  );
                                  return all;
                                });
                              }}
                            />
                          </th>
                          <th style={{ minWidth: 140 }}>Fee</th>
                          <th style={{ minWidth: 100 }}>Due</th>
                          <th style={{ minWidth: 100 }}>Cons</th>
                          <th style={{ minWidth: 100 }}>Recv</th>
                          <th style={{ minWidth: 110 }}>Van Recv</th>
                          <th style={{ minWidth: 110 }}>Van Fee Cons.</th>
                          <th style={{ minWidth: 100 }}>Van Fee</th>
                          <th style={{ minWidth: 90 }}>Fine</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newTransactionDetails.map((feeDetail, index) => (
                          <tr
                            key={`${feeDetail.Fee_Head}-${index}`}
                            className={
                              feeDetail.isOpeningBalance ? "table-warning" : ""
                            }
                          >
                            <td style={{ textAlign: "center" }}>
                              <Form.Check
                                type="checkbox"
                                aria-label={`Select ${feeDetail.Fee_Heading_Name}`}
                                checked={selectedHeads.has(
                                  String(feeDetail.Fee_Head)
                                )}
                                onChange={() => {
                                  setSelectedHeads((prev) => {
                                    const next = new Set(prev);
                                    const key = String(feeDetail.Fee_Head);
                                    if (next.has(key)) next.delete(key);
                                    else next.add(key);
                                    return next;
                                  });
                                }}
                              />
                            </td>
                            <td>{feeDetail.Fee_Heading_Name}</td>
                            <td>
                              <OverlayTrigger
                                placement="top"
                                overlay={
                                  <Tooltip
                                    id={`tooltip-fee-${feeDetail.Fee_Head}`}
                                  >
                                    <div
                                      style={{
                                        textAlign: "left",
                                        padding: 8,
                                      }}
                                    >
                                      <div>
                                        <strong className="text-primary">
                                          Original Fee:
                                        </strong>
                                        <span className="ms-1">
                                          {formatINR(
                                            feeDetail.Original_Fee_Due || 0
                                          )}
                                        </span>
                                      </div>
                                      {feeDetail.defaultConcessionAmount > 0 &&
                                        selectedStudentInfo?.concession && (
                                          <div>
                                            <strong className="text-success">
                                              {
                                                selectedStudentInfo.concession
                                                  .concession_name
                                              }
                                              :
                                            </strong>
                                            <span className="ms-1">
                                              {formatINR(
                                                feeDetail.defaultConcessionAmount
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      {feeDetail.Concession > 0 && (
                                        <div>
                                          <strong className="text-success">
                                            Extra Concession:
                                          </strong>
                                          <span className="ms-1">
                                            {formatINR(feeDetail.Concession)}
                                          </span>
                                        </div>
                                      )}
                                      {feeDetail.fineAmount > 0 && (
                                        <div>
                                          <strong className="text-danger">
                                            Fine Applied:
                                          </strong>
                                          <span className="ms-1">
                                            {formatINR(feeDetail.fineAmount)}
                                          </span>
                                        </div>
                                      )}
                                      {feeDetail.ShowVanFeeInput && (
                                        <>
                                          <hr />
                                          <div>
                                            <strong>Route Fee:</strong>
                                            <span className="ms-1">
                                              {formatINR(
                                                feeDetail._routeFee || 0
                                              )}
                                            </span>
                                          </div>
                                          <div>
                                            <strong>Van Received:</strong>
                                            <span className="ms-1">
                                              {formatINR(
                                                feeDetail._receivedVanFee
                                              )}
                                            </span>
                                          </div>
                                          <div>
                                            <strong>Concession:</strong>
                                            <span className="ms-1">
                                              {formatINR(
                                                feeDetail._vanFeeConcession ||
                                                  0
                                              )}
                                            </span>
                                          </div>
                                          <div>
                                            <strong>
                                              Remaining (before fine):
                                            </strong>
                                            <span className="ms-1">
                                              {formatINR(
                                                feeDetail.Van_Fee_Remaining
                                              )}
                                            </span>
                                          </div>
                                          <div>
                                            <strong>Van Fine:</strong>
                                            <span className="ms-1">
                                              {formatINR(
                                                feeDetail.Van_Fine_Amount
                                              )}
                                            </span>
                                          </div>
                                          <div>
                                            <strong>
                                              Total Van Due (after fine):
                                              {/* live based on Van_Fee_Due */}
                                            </strong>
                                            <span className="ms-1">
                                              {formatINR(feeDetail.Van_Fee_Due)}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </Tooltip>
                                }
                              >
                                <div className="fw-bold text-dark">
                                  {(() => {
                                    const netDue = Math.max(
                                      0,
                                      (feeDetail.Fee_Due || 0) -
                                        (feeDetail.Fee_Recieved || 0) -
                                        (feeDetail.Concession || 0)
                                    );
                                    const originalFine =
                                      feeDetail.fineAmount || 0;
                                    const fineReceived =
                                      feeDetail.Fine_Amount || 0;
                                    const fineDue = Math.max(
                                      0,
                                      originalFine - fineReceived
                                    );
                                    return (
                                      <>
                                        {formatINR(netDue)}
                                        {feeDetail.isFineApplicable &&
                                          fineDue > 0 && (
                                            <>
                                              {" + "}
                                              <span className="text-danger">
                                                {formatINR(fineDue)} (fine)
                                              </span>
                                            </>
                                          )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </OverlayTrigger>
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                value={feeDetail.Concession || ""}
                                onChange={(e) => {
                                  const updated = [...newTransactionDetails];
                                  const row = { ...updated[index] };
                                  row.Concession =
                                    parseInt(e.target.value, 10) || 0;
                                  updated[index] = row;
                                  setNewTransactionDetails(updated);
                                }}
                                disabled={
                                  feeDetail.isOpeningBalance ||
                                  (feeDetail.Fee_Due || 0) -
                                    (feeDetail.Fee_Recieved || 0) <=
                                    0
                                }
                              />
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                value={feeDetail.Fee_Recieved || ""}
                                onChange={(e) => {
                                  const updated = [...newTransactionDetails];
                                  const row = { ...updated[index] };
                                  const val = parseInt(e.target.value, 10) || 0;
                                  const maxAllowed = Math.max(
                                    0,
                                    (row.Fee_Due || 0) -
                                      (row.Concession || 0)
                                  );
                                  row.Fee_Recieved = Math.min(val, maxAllowed);
                                  updated[index] = row;
                                  setNewTransactionDetails(updated);
                                }}
                                disabled={(feeDetail.Fee_Due || 0) <= 0}
                              />
                            </td>
                            {/* Van Recv */}
                            <td>
                              {feeDetail.ShowVanFeeInput ? (
                                <div>
                                  {(() => {
                                    const totalDue = Number(
                                      feeDetail.Van_Fee_Due || 0
                                    );
                                    const alreadyRec = Number(
                                      feeDetail._receivedVanFee || 0
                                    );
                                    const enteredNow = Number(
                                      feeDetail.VanFee || 0
                                    );
                                    const remainingNow = Math.max(
                                      0,
                                      totalDue - enteredNow
                                    );
                                    return (
                                      <>
                                        <div className="fw-semibold">
                                          {formatINR(remainingNow)}
                                        </div>
                                        <div className="small text-muted">
                                          Rec: {formatINR(alreadyRec)}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            {/* Van Fee Cons. */}
                            <td>
                              {feeDetail.ShowVanFeeInput ? (
                                <Form.Control
                                  type="number"
                                  value={
                                    feeDetail.Van_Fee_Concession === 0
                                      ? ""
                                      : feeDetail.Van_Fee_Concession
                                  }
                                  onChange={(e) => {
                                    const updated = [
                                      ...newTransactionDetails,
                                    ];
                                    const row = { ...updated[index] };
                                    const cons =
                                      parseInt(e.target.value, 10) || 0;
                                    row.Van_Fee_Concession = cons;
                                    row._vanFeeConcession = cons;
                                    const routeFee = Number(
                                      row._routeFee || 0
                                    );
                                    const prevRec = Number(
                                      row._receivedVanFee || 0
                                    );
                                    const fine = Number(
                                      row.Van_Fine_Amount || 0
                                    );
                                    const baseWithoutFine = Math.max(
                                      0,
                                      routeFee - prevRec - cons
                                    );
                                    const maxNowPayable =
                                      baseWithoutFine + fine;
                                    // adjust already typed VanFee if it exceeds
                                    if ((row.VanFee || 0) > maxNowPayable) {
                                      row.VanFee = maxNowPayable;
                                    }
                                    row.Van_Fee_Remaining = Math.max(
                                      0,
                                      baseWithoutFine - (row.VanFee || 0)
                                    );
                                    row.Van_Fee_Due = Math.max(
                                      0,
                                      baseWithoutFine + fine
                                    );
                                    updated[index] = row;
                                    setNewTransactionDetails(updated);
                                  }}
                                  disabled={(feeDetail.Van_Fee_Due || 0) <= 0}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            {/* Van Fee (amount received now) */}
                            <td>
                              {feeDetail.ShowVanFeeInput ? (
                                <Form.Control
                                  type="number"
                                  value={
                                    feeDetail.VanFee === 0
                                      ? ""
                                      : feeDetail.VanFee
                                  }
                                  onChange={(e) => {
                                    const updated = [
                                      ...newTransactionDetails,
                                    ];
                                    const row = { ...updated[index] };
                                    const raw =
                                      parseInt(e.target.value, 10) || 0;
                                    const routeFee = Number(
                                      row._routeFee || 0
                                    );
                                    const prevRec = Number(
                                      row._receivedVanFee || 0
                                    );
                                    const cons = Number(
                                      row.Van_Fee_Concession || 0
                                    );
                                    const fine = Number(
                                      row.Van_Fine_Amount || 0
                                    );
                                    const baseWithoutFine = Math.max(
                                      0,
                                      routeFee - prevRec - cons
                                    );
                                    const maxNowPayable =
                                      baseWithoutFine + fine;
                                    row.VanFee = Math.max(
                                      0,
                                      Math.min(raw, maxNowPayable)
                                    );
                                    row.Van_Fee_Remaining = Math.max(
                                      0,
                                      baseWithoutFine - (row.VanFee || 0)
                                    );
                                    row.Van_Fee_Due = Math.max(
                                      0,
                                      baseWithoutFine + fine
                                    );
                                    updated[index] = row;
                                    setNewTransactionDetails(updated);
                                  }}
                                  disabled={(feeDetail.Van_Fee_Due || 0) <= 0}
                                />
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              <Form.Control
                                type="number"
                                value={
                                  feeDetail.Fine_Amount === 0 &&
                                  !feeDetail.isFineEdited
                                    ? ""
                                    : feeDetail.Fine_Amount
                                }
                                onChange={(e) => {
                                  const updated = [...newTransactionDetails];
                                  const row = { ...updated[index] };
                                  const value = parseInt(e.target.value, 10);
                                  row.Fine_Amount = isNaN(value)
                                    ? 0
                                    : Math.max(
                                        0,
                                        Math.min(
                                          value,
                                          row.fineAmount || 0
                                        )
                                      );
                                  row.isFineEdited = true;
                                  updated[index] = row;
                                  setNewTransactionDetails(updated);
                                }}
                                disabled={
                                  !feeDetail.isFineApplicable ||
                                  feeDetail.isOpeningBalance
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <h5 className="mb-3">Edit Transaction</h5>
              <table className="table table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th>Class</th>
                    <th>Date</th>
                    <th>Fee Head</th>
                    <th>Fee Received</th>
                    <th>Concession</th>
                    <th>Van Fee</th>
                    <th>Van Fee Cons.</th>
                    <th>Fine</th>
                    <th>Payment Mode</th>
                    <th>Session</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{editingTransaction?.StudentName}</td>
                    <td>{editingTransaction?.AdmissionNumber}</td>
                    <td>{editingTransaction?.ClassName}</td>
                    <td>
                      {editingTransaction?.DateOfTransaction
                        ? new Date(
                            editingTransaction.DateOfTransaction
                          ).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{editingTransaction?.FeeHeadingName}</td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.Fee_Recieved ?? 0}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Fee_Recieved: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.Concession ?? 0}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Concession: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.VanFee ?? 0}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            VanFee: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.Van_Fee_Concession ?? 0}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Van_Fee_Concession: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.Fine_Amount || ""}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Fine_Amount: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      <Form.Select
                        value={editingTransaction?.PaymentMode || "Cash"}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            PaymentMode: e.target.value,
                            Transaction_ID:
                              e.target.value === "Online"
                                ? prev.Transaction_ID
                                : "",
                          }))
                        }
                      >
                        <option value="Cash">Cash</option>
                        <option value="Online">Online</option>
                      </Form.Select>
                    </td>
                    <td style={{ minWidth: 160 }}>
                      <Form.Select
                        value={editingTransaction?.session_id ?? ""}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            session_id: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }))
                        }
                      >
                        <option value="">Select Session</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name ||
                              s.label ||
                              `${s.start_date || ""} - ${s.end_date || ""}`}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    <td style={{ minWidth: 200 }}>
                      <Form.Control
                        type="text"
                        placeholder="Enter remarks"
                        value={editingTransaction?.Remarks || ""}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Remarks: e.target.value,
                          }))
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              {editingTransaction?.PaymentMode === "Online" && (
                <Form.Group className="mt-3" style={{ maxWidth: 360 }}>
                  <Form.Label>Transaction ID</Form.Label>
                  <Form.Control
                    type="text"
                    name="Transaction_ID"
                    placeholder="Enter Transaction ID"
                    value={editingTransaction?.Transaction_ID || ""}
                    onChange={(e) =>
                      setEditingTransaction((prev) => ({
                        ...prev,
                        Transaction_ID: e.target.value,
                      }))
                    }
                  />
                </Form.Group>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer
          className="py-2 px-3"
          style={{
            background: "#f8f9fa",
            borderTop: "1px solid #dee2e6",
            overflow: "hidden",
          }}
        >
          <div
            className="w-100 d-flex flex-wrap align-items-center justify-content-between gap-2"
            style={{ rowGap: "0.5rem" }}
          >
            <div
              className="d-flex flex-wrap align-items-center gap-2 flex-grow-1"
              style={{ minWidth: 0 }}
            >
              <Form.Group className="m-0" style={{ width: 180, flexShrink: 0 }}>
                <Form.Label
                  className="m-0 small text-muted fw-semibold"
                  style={{ fontSize: "0.75rem" }}
                >
                  Academic Year
                </Form.Label>
                <Form.Select
                  value={selectedSession ?? ""}
                  onChange={(e) =>
                    setSelectedSession(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  size="sm"
                >
                  <option value="">Select</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ||
                        s.label ||
                        `${s.start_date || ""} - ${s.end_date || ""}`}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group className="m-0" style={{ width: 150, flexShrink: 0 }}>
                <Form.Label
                  className="m-0 small text-muted fw-semibold"
                  style={{ fontSize: "0.75rem" }}
                >
                  Payment Mode
                </Form.Label>
                <Form.Select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  size="sm"
                >
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="m-0 flex-grow-1" style={{ minWidth: 220 }}>
                <Form.Label
                  className="m-0 small text-muted fw-semibold"
                  style={{ fontSize: "0.75rem" }}
                >
                  Remarks
                </Form.Label>
                <Form.Control
                  type="text"
                  size="sm"
                  placeholder="Enter remarks (optional)"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </Form.Group>
              {paymentMode === "Online" && (
                <Form.Group className="m-0" style={{ width: 180 }}>
                  <Form.Label
                    className="m-0 small text-muted fw-semibold"
                    style={{ fontSize: "0.75rem" }}
                  >
                    Transaction ID
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Enter ID"
                    value={transactionID}
                    onChange={(e) => setTransactionID(e.target.value)}
                  />
                </Form.Group>
              )}
            </div>
            <div
              className="d-flex flex-wrap align-items-center justify-content-center text-center gap-2 px-2"
              style={{
                background: "#fff",
                borderRadius: "6px",
                border: "1px solid #dee2e6",
                padding: "4px 8px",
                minWidth: 320,
                flexShrink: 0,
              }}
            >
               <div className="small text-success fw-bold">
                <strong>Total:</strong> {formatINR(grandTotal)}
              </div>
              <div className="small">
                <strong>Acad:</strong> {formatINR(totalFeeReceived)}
              </div>
              <div className="small">
                <strong>Van:</strong> {formatINR(totalVanFee)}
              </div>
              <div className="small text-danger">
                <strong>Fine:</strong> {formatINR(totalFine)}
              </div>
              <div className="small text-secondary">
                <strong>Acad Cons:</strong> {formatINR(totalAcademicConcession)}
              </div>
              <div className="small text-secondary">
                <strong>Van Cons:</strong> {formatINR(totalVanConcession)}
              </div>
             
            </div>
            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                Close
              </Button>
              {selectedStudentInfo?.admission_number && (
                <Button
                  variant="info"
                  size="sm"
                  onClick={() =>
                    window.open(
                      `/reports/student/${selectedStudentInfo.admission_number}`,
                      "_blank"
                    )
                  }
                >
                  View Full Report
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={saveTransaction}>
                Save
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
export default Transactions;