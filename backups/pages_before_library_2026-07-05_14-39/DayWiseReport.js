import React, { useState, useEffect, useMemo } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Table,
  Alert,
  Pagination,
  InputGroup,
  Card,
  Badge,
  Spinner,
  Modal,
} from "react-bootstrap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import api from "../api";
import Swal from "sweetalert2";

import { pdf } from "@react-pdf/renderer";
import PdfReports from "./PdfReport";
import PdfReceiptDocument from "./Transactions/PdfReceiptDocument";
import ReceiptModal from "./Transactions/ReceiptModal";

/* ======================================================
   Helpers
====================================================== */

// Backend/API: yyyy-MM-dd
const formatDate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// UI: dd/MM/yyyy hh:mm AM/PM
const formatToDisplayDateTime = (date) => {
  if (!date) return "—";

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours || 12;

  return `${day}/${month}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
};

const toDateTimeLocalInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toTransactionDatePayload = (value) => {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

const toNum = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getTxnSerial = (item) => {
  const raw = item?.Serial ?? item?.serial ?? item?.serial_no ?? item?.serialNo ?? null;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  return null;
};

// ₹ formatter
const formatTotalValue = (value) => {
  const n = Number(value) || 0;
  return n === 0 ? "0" : `₹${n.toLocaleString("en-IN")}`;
};

// Normalize payment mode (HDFC/UPI/Card/Net Banking treated as Online for summaries)
const normMode = (m) =>
  String(m ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isCash = (m) => normMode(m) === "cash";
const isOnline = (m) => {
  const key = normMode(m);
  return (
    key === "online" ||
    key === "hdfc" ||
    key === "smart_hdfc" ||
    key === "smartgateway" ||
    key === "upi" ||
    key.includes("upi") ||
    key === "card" ||
    key.includes("card") ||
    key === "netbanking" ||
    key === "net_banking" ||
    key.includes("net") ||
    key.includes("bank_transfer")
  );
};
const isCancelled = (item) => normMode(item?.status) === "cancelled";

const firstNonEmpty = (...vals) => {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (
      s &&
      s !== "—" &&
      s !== "-" &&
      s.toLowerCase() !== "null" &&
      s.toLowerCase() !== "undefined"
    ) {
      return s;
    }
  }
  return "";
};

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];

  const keys = ["data", "rows", "results", "items", "list", "records", "modes", "bankAccounts"];
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }

  return [];
};

const DEFAULT_TRANSACTION_MODES = [
  { id: "cash", name: "Cash", code: "CASH", requires_bank: false, requires_reference_no: false, requires_cheque_no: false, requires_cheque_date: false, sort_order: 1, active: true },
  { id: "upi", name: "UPI", code: "UPI", requires_bank: true, requires_reference_no: true, requires_cheque_no: false, requires_cheque_date: false, sort_order: 2, active: true },
  { id: "cheque", name: "Cheque", code: "CHEQUE", requires_bank: true, requires_reference_no: false, requires_cheque_no: true, requires_cheque_date: true, sort_order: 3, active: true },
  { id: "card", name: "Card", code: "CARD", requires_bank: true, requires_reference_no: true, requires_cheque_no: false, requires_cheque_date: false, sort_order: 4, active: true },
  { id: "netbanking", name: "Net Banking", code: "NETBANKING", requires_bank: true, requires_reference_no: true, requires_cheque_no: false, requires_cheque_date: false, sort_order: 5, active: true },
  { id: "online", name: "Online", code: "ONLINE", requires_bank: false, requires_reference_no: true, requires_cheque_no: false, requires_cheque_date: false, sort_order: 6, active: true },
];

const normalizeModeRow = (row, index = 0) => ({
  id: row?.id ?? row?.code ?? row?.name ?? `mode-${index}`,
  name: firstNonEmpty(row?.name, row?.label, row?.title, row?.code) || `Mode ${index + 1}`,
  code: firstNonEmpty(row?.code, row?.short_code, row?.slug),
  description: firstNonEmpty(row?.description),
  requires_bank: Boolean(row?.requires_bank),
  requires_reference_no: Boolean(row?.requires_reference_no),
  requires_cheque_no: Boolean(row?.requires_cheque_no),
  requires_cheque_date: Boolean(row?.requires_cheque_date),
  sort_order: Number(row?.sort_order ?? index + 1) || 0,
  active: row?.active !== false,
});

const sortTransactionModes = (rows = []) =>
  [...rows].sort(
    (a, b) =>
      Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0) ||
      String(a?.name || "").localeCompare(String(b?.name || ""))
  );

const getActiveTransactionModes = (rows = []) => {
  const source = Array.isArray(rows) && rows.length ? rows : DEFAULT_TRANSACTION_MODES;
  const active = source.filter((row) => row?.active !== false);
  return sortTransactionModes(active.length ? active : source);
};

const findModeByValue = (value, rows = []) => {
  const source = Array.isArray(rows) && rows.length ? rows : DEFAULT_TRANSACTION_MODES;
  const raw = String(value || "").trim();
  const needle = raw.toLowerCase();
  if (!needle) return null;

  const exact = source.find(
    (row) =>
      String(row?.name || "").trim().toLowerCase() === needle ||
      String(row?.code || "").trim().toLowerCase() === needle ||
      String(row?.id || "").trim().toLowerCase() === needle
  );
  if (exact) return exact;

  const aliasMap = {
    cash: ["cash"],
    cheque: ["cheque", "check"],
    upi: ["upi"],
    card: ["card"],
    netbanking: ["netbanking", "net_banking", "net banking"],
    online: ["online", "hdfc", "smart_hdfc", "smartgateway"],
  };

  for (const [canonical, values] of Object.entries(aliasMap)) {
    if (!values.includes(needle)) continue;
    const aliased = source.find(
      (row) =>
        String(row?.name || "").trim().toLowerCase() === canonical ||
        String(row?.code || "").trim().toLowerCase() === canonical ||
        String(row?.id || "").trim().toLowerCase() === canonical
    );
    if (aliased) return aliased;
  }

  return null;
};

const getDefaultPaymentModeName = (rows = []) => {
  const source = getActiveTransactionModes(rows);
  const cash = findModeByValue("cash", source);
  return cash?.name || source[0]?.name || "Cash";
};

const normalizeBankAccountRow = (row, index = 0) => ({
  id: Number(row?.id ?? row?.bank_account_id ?? row?.bankAccountId ?? 0) || 0,
  bank_name: firstNonEmpty(row?.bank_name, row?.bankName, row?.name),
  account_name: firstNonEmpty(row?.account_name, row?.accountName, row?.title, row?.label),
  account_number: firstNonEmpty(row?.account_number, row?.accountNumber),
  ifsc_code: firstNonEmpty(row?.ifsc_code, row?.ifscCode),
  upi_id: firstNonEmpty(row?.upi_id, row?.upiId),
  active: row?.active !== false,
  sort_order: Number(row?.sort_order ?? index + 1) || 0,
});

const formatBankAccountLabel = (row) => {
  if (!row) return "";
  const left = firstNonEmpty(row.bank_name);
  const right = firstNonEmpty(row.account_name);
  const last4 = firstNonEmpty(row.account_number) ? ` • ${String(row.account_number).slice(-4)}` : "";
  return [left, right].filter(Boolean).join(" - ") + last4;
};

const sortBankAccounts = (rows = []) =>
  [...rows].sort(
    (a, b) =>
      Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0) ||
      String(formatBankAccountLabel(a) || "").localeCompare(String(formatBankAccountLabel(b) || ""))
  );

const normalizeDateInput = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return "";
};

const modeNeedsBank = (mode) => Boolean(mode?.requires_bank);
const modeNeedsReference = (mode) => Boolean(mode?.requires_reference_no);
const modeNeedsChequeNo = (mode) => Boolean(mode?.requires_cheque_no);
const modeNeedsChequeDate = (mode) => Boolean(mode?.requires_cheque_date);
const modeNeedsChequeFields = (mode) => modeNeedsChequeNo(mode) || modeNeedsChequeDate(mode);

const validatePaymentDetails = (details, mode) => {
  if (modeNeedsBank(mode) && !String(details?.bank_account_id || "").trim()) {
    return "Receiving bank account is required for this payment mode.";
  }
  if (modeNeedsReference(mode) && !String(details?.reference_no || details?.Transaction_ID || "").trim()) {
    return "Reference / Transaction ID is required for this payment mode.";
  }
  if (modeNeedsChequeNo(mode) && !String(details?.cheque_no || details?.ChequeNumber || "").trim()) {
    return "Cheque number is required for cheque payment.";
  }
  if (modeNeedsChequeDate(mode) && !String(details?.cheque_date || details?.ChequeDate || "").trim()) {
    return "Cheque date is required for cheque payment.";
  }
  return null;
};

const getFileNameFromDisposition = (disposition) => {
  if (!disposition) return null;

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);

  const asciiMatch = disposition.match(/filename="?([^"]+)"?/i);
  if (asciiMatch?.[1]) return asciiMatch[1];

  return null;
};

// Group report data by fee heading.
const groupByFeeHeading = (data) => {
  return data.reduce((groups, item) => {
    const feeHeading = item.feeHeadingName || "—";
    if (!groups[feeHeading]) groups[feeHeading] = [];
    groups[feeHeading].push(item);
    return groups;
  }, {});
};

// Calculate fee heading summary with payment mode breakdown
const calculateFeeHeadingSummary = (data) => {
  const groups = groupByFeeHeading(data);

  return Object.keys(groups).map((feeHeading) => {
    const items = groups[feeHeading];

    const cashTotals = items.reduce(
      (acc, item) => {
        if (isCash(item.PaymentMode)) {
          acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
          acc.totalConcession += Number(item.totalConcession) || 0;
          acc.totalVanFee += Number(item.totalVanFee) || 0;
          acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
          acc.totalFine += Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;
        }
        return acc;
      },
      {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalFine: 0,
      }
    );

    cashTotals.totalReceived =
      cashTotals.totalFeeReceived + cashTotals.totalVanFee + cashTotals.totalFine;

    const onlineTotals = items.reduce(
      (acc, item) => {
        if (isOnline(item.PaymentMode)) {
          acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
          acc.totalConcession += Number(item.totalConcession) || 0;
          acc.totalVanFee += Number(item.totalVanFee) || 0;
          acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
          acc.totalFine += Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;
        }
        return acc;
      },
      {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalFine: 0,
      }
    );

    onlineTotals.totalReceived =
      onlineTotals.totalFeeReceived + onlineTotals.totalVanFee + onlineTotals.totalFine;

    const overall = {
      totalFeeReceived: cashTotals.totalFeeReceived + onlineTotals.totalFeeReceived,
      totalConcession: cashTotals.totalConcession + onlineTotals.totalConcession,
      totalVanFee: cashTotals.totalVanFee + onlineTotals.totalVanFee,
      totalVanFeeConcession:
        cashTotals.totalVanFeeConcession + onlineTotals.totalVanFeeConcession,
      totalFine: cashTotals.totalFine + onlineTotals.totalFine,
      totalReceived: cashTotals.totalReceived + onlineTotals.totalReceived,
    };

    return { feeHeading, cash: cashTotals, online: onlineTotals, overall };
  });
};

/* ======================================================
   Component
====================================================== */

const DayWiseReport = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [school, setSchool] = useState(null);

  const [loading, setLoading] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 500;

  const [userRole, setUserRole] = useState(localStorage.getItem("activeRole") || "");

  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState(null);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    Serial: null,
    Slip_ID: "",
    PaymentMode: "Cash",
    mode_of_transaction_id: "",
    bank_account_id: "",
    reference_no: "",
    bank_name: "",
    cheque_no: "",
    cheque_date: "",
    Transaction_ID: "",
    BankName: "",
    ChequeNumber: "",
    ChequeDate: "",
    DateOfTransaction: "",
    Fee_Recieved: 0,
    Concession: 0,
    VanFee: 0,
    Fine_Amount: 0,
    Remarks: "",
    status: "",
  });

  const [transactionModes, setTransactionModes] = useState(DEFAULT_TRANSACTION_MODES);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingPaymentMasters, setLoadingPaymentMasters] = useState(false);

  const canManage = useMemo(() => {
    const role = (userRole || "").toLowerCase();
    return ["admin", "superadmin", "account", "accounts", "accountant"].includes(role);
  }, [userRole]);

  const canDelete = useMemo(() => {
    return (userRole || "").toLowerCase() === "superadmin";
  }, [userRole]);

  const activeTransactionModes = useMemo(
    () => getActiveTransactionModes(transactionModes),
    [transactionModes]
  );

  const selectedEditModeMeta = useMemo(() => {
    return (
      findModeByValue(editForm.mode_of_transaction_id, activeTransactionModes) ||
      findModeByValue(editForm.PaymentMode, activeTransactionModes) ||
      findModeByValue(getDefaultPaymentModeName(activeTransactionModes), activeTransactionModes)
    );
  }, [editForm.mode_of_transaction_id, editForm.PaymentMode, activeTransactionModes]);

  const selectedEditBankAccount = useMemo(() => {
    const id = Number(editForm.bank_account_id || 0);
    if (!id) return null;
    return bankAccounts.find((row) => Number(row.id) === id) || null;
  }, [editForm.bank_account_id, bankAccounts]);

  useEffect(() => {
    const handler = () => setUserRole(localStorage.getItem("activeRole") || "");
    window.addEventListener("role-changed", handler);
    return () => window.removeEventListener("role-changed", handler);
  }, []);

  const fetchSchoolDetails = async () => {
    try {
      const response = await api.get("/schools");
      const data = response.data;

      if (Array.isArray(data) && data.length > 0) setSchool(data[0]);
      else if (data && Array.isArray(data.schools) && data.schools.length) setSchool(data.schools[0]);
      else if (data && data.school) setSchool(data.school);
      else if (data && typeof data === "object" && Object.keys(data).length) setSchool(data);
      else setSchool(null);
    } catch (err) {
      console.error("Error fetching school details:", err);
      setSchool(null);
    }
  };

  useEffect(() => {
    fetchSchoolDetails();
  }, []);

  const fetchPaymentMasters = async () => {
    setLoadingPaymentMasters(true);
    try {
      const [modesResp, banksResp] = await Promise.allSettled([
        api.get("/mode-of-transactions"),
        api.get("/school-bank-accounts", { params: { active_only: true } }),
      ]);

      if (modesResp.status === "fulfilled") {
        const rows = asArray(modesResp.value?.data)
          .map(normalizeModeRow)
          .filter((row) => row?.name);
        setTransactionModes(rows.length ? sortTransactionModes(rows) : DEFAULT_TRANSACTION_MODES);
      } else {
        console.warn("Mode of transaction master failed:", modesResp.reason?.message || modesResp.reason);
        setTransactionModes(DEFAULT_TRANSACTION_MODES);
      }

      if (banksResp.status === "fulfilled") {
        const rows = asArray(banksResp.value?.data)
          .map(normalizeBankAccountRow)
          .filter((row) => row?.id && row?.active !== false);
        setBankAccounts(sortBankAccounts(rows));
      } else {
        console.warn("School bank account master failed:", banksResp.reason?.message || banksResp.reason);
        setBankAccounts([]);
      }
    } catch (err) {
      console.error("Error loading payment masters:", err);
      setTransactionModes(DEFAULT_TRANSACTION_MODES);
      setBankAccounts([]);
    } finally {
      setLoadingPaymentMasters(false);
    }
  };

  useEffect(() => {
    fetchPaymentMasters();
  }, []);

  // Search filtering
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredData(reportData);
      setCurrentPage(1);
      return;
    }

    const filtered = reportData.filter((item) => {
      const studentName = (item.Student?.name || "").toLowerCase();
      const adm = (item.Student?.admission_number || "").toLowerCase();
      const slip = (item.Slip_ID?.toString() || "").toLowerCase();
      const feeHeading = (item.feeHeadingName || "").toLowerCase();
      const pm = (item.PaymentMode || "").toLowerCase();
      const txnDate = String(item.DateOfTransaction || "").toLowerCase();
      const status = String(item.status || "").toLowerCase();
      const reference = String(item.reference_no || item.Transaction_ID || "").toLowerCase();
      const bank = String(item.bank_name || item.BankName || item.bankAccount?.bank_name || "").toLowerCase();
      const cheque = String(item.cheque_no || item.ChequeNumber || "").toLowerCase();

      return (
        studentName.includes(q) ||
        adm.includes(q) ||
        slip.includes(q) ||
        feeHeading.includes(q) ||
        pm.includes(q) ||
        txnDate.includes(q) ||
        status.includes(q) ||
        reference.includes(q) ||
        bank.includes(q) ||
        cheque.includes(q)
      );
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchQuery, reportData]);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      Swal.fire("Missing dates", "Please select both start and end dates.", "warning");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      const response = await api.get(`/reports/day-wise?startDate=${start}&endDate=${end}&includeCancelled=true`);

      const rows = response.data || [];
      setReportData(rows);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        Swal.fire({
          title: "Session Expired",
          text: "Your session has expired. Please log in again.",
          icon: "warning",
          confirmButtonText: "OK",
        });
      } else {
        setError("Error fetching report data. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!startDate || !endDate) {
      Swal.fire("Missing dates", "Please select both start and end dates.", "warning");
      return;
    }

    setDownloadingExcel(true);

    try {
      const start = formatDate(startDate);
      const end = formatDate(endDate);

      const response = await api.get(
        `/reports/day-wise?startDate=${start}&endDate=${end}&format=excel&includeCancelled=true`,
        {
          responseType: "blob",
        }
      );

      const contentType =
        response.headers?.["content-type"] ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

      const disposition = response.headers?.["content-disposition"];
      const fileName =
        getFileNameFromDisposition(disposition) ||
        `DayWiseReport_${start}_to_${end}.xlsx`;

      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000);
    } catch (err) {
      console.error("Excel download error:", err);

      if (err?.response?.status === 401) {
        Swal.fire({
          title: "Session Expired",
          text: "Your session has expired. Please log in again.",
          icon: "warning",
          confirmButtonText: "OK",
        });
      } else {
        Swal.fire("Error", "Failed to download Excel report.", "error");
      }
    } finally {
      setDownloadingExcel(false);
    }
  };

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

      let schoolData = null;
      if (schoolResp.status === "fulfilled") {
        const d = schoolResp.value?.data;
        if (d && Array.isArray(d.schools) && d.schools.length) schoolData = d.schools[0];
        else if (Array.isArray(d)) schoolData = d[0];
        else if (d && Array.isArray(d.data) && d.data.length) schoolData = d.data[0];
        else if (d && d.school) schoolData = d.school;
        else if (d && typeof d === "object" && Object.keys(d).length) schoolData = d;
      }

      if (!schoolData && receipt[0]) {
        const item = receipt[0];
        if (item.School || item.school) schoolData = item.School || item.school;
        else if (item.schoolName || item.institute_name) {
          schoolData = {
            name: item.schoolName || item.institute_name,
            address: item.schoolAddress || item.address || "",
            logo: item.logo || null,
          };
        }
      }

      if (!schoolData) {
        schoolData = { name: "Your School", address: "", logo: null, phone: "", email: "" };
      }

      try {
        const payload = { receipt, school: schoolData, fileName: `Receipt-${slipId}` };
        const res = await api.post("/receipt-pdf/receipt/generate-pdf", payload, {
          responseType: "blob",
        });
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000);
        Swal.close();
        return;
      } catch (err) {
        console.warn("Server-side PDF generation failed, falling back to client-side PDF.", err?.message || err);
      }

      try {
        const student = receipt[0].Student || receipt[0].student || null;
        const blob = await pdf(
          <PdfReceiptDocument school={schoolData} receipt={receipt} student={student} />
        ).toBlob();

        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000);
        Swal.close();
      } catch (err) {
        Swal.close();
        console.error("Error generating PDF blob:", err);
        Swal.fire("Error", "Failed to generate receipt PDF.", "error");
      }
    } catch (err) {
      Swal.close();
      console.error("Unexpected error preparing receipt:", err);
      Swal.fire("Error", err?.message || "Failed to prepare receipt PDF", "error");
    }
  };

  const openEditModal = (item) => {
    const serial = getTxnSerial(item);
    if (!serial) {
      Swal.fire(
        "Serial missing",
        "This report response row does not include the real transaction Serial. View/Print works with Slip_ID, but Edit/Cancel/Delete need Serial from backend.",
        "warning"
      );
      return;
    }

    const modeMeta =
      findModeByValue(item?.mode_of_transaction_id, activeTransactionModes) ||
      findModeByValue(item?.PaymentMode, activeTransactionModes) ||
      findModeByValue("Cash", activeTransactionModes);

    const bankId = item?.bank_account_id ? String(item.bank_account_id) : "";
    const referenceNo = firstNonEmpty(item?.reference_no, item?.Transaction_ID);
    const chequeNo = firstNonEmpty(item?.cheque_no, item?.ChequeNumber);
    const chequeDate = normalizeDateInput(item?.cheque_date || item?.ChequeDate);
    const bankName = firstNonEmpty(item?.bank_name, item?.BankName, item?.bankAccount?.bank_name);

    setEditForm({
      Serial: serial,
      Slip_ID: item?.Slip_ID || "",
      PaymentMode: modeMeta?.name || item?.PaymentMode || "Cash",
      mode_of_transaction_id: modeMeta?.id ? String(modeMeta.id) : "",
      bank_account_id: bankId,
      reference_no: referenceNo,
      bank_name: bankName,
      cheque_no: chequeNo,
      cheque_date: chequeDate,
      Transaction_ID: referenceNo,
      BankName: bankName,
      ChequeNumber: chequeNo,
      ChequeDate: chequeDate,
      DateOfTransaction: toDateTimeLocalInput(item?.DateOfTransaction || item?.createdAt),
      Fee_Recieved: toNum(item?.Fee_Recieved ?? item?.totalFeeReceived),
      Concession: toNum(item?.Concession ?? item?.totalConcession),
      VanFee: toNum(item?.VanFee ?? item?.totalVanFee),
      Fine_Amount: toNum(item?.Fine_Amount ?? item?.totalFine),
      Remarks: item?.Remarks || "",
      status: item?.status || "",
    });
    setShowEditModal(true);
  };

  const handleEditInput = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditModeChange = (value) => {
    const mode = findModeByValue(value, activeTransactionModes);
    setEditForm((prev) => ({
      ...prev,
      PaymentMode: mode?.name || value || "Cash",
      mode_of_transaction_id: mode?.id ? String(mode.id) : "",
      bank_account_id: modeNeedsBank(mode) ? prev.bank_account_id || "" : "",
      reference_no: modeNeedsReference(mode) ? prev.reference_no || prev.Transaction_ID || "" : "",
      Transaction_ID: modeNeedsReference(mode) ? prev.Transaction_ID || prev.reference_no || "" : "",
      bank_name: modeNeedsBank(mode) || modeNeedsChequeFields(mode) ? prev.bank_name || prev.BankName || "" : "",
      BankName: modeNeedsBank(mode) || modeNeedsChequeFields(mode) ? prev.BankName || prev.bank_name || "" : "",
      cheque_no: modeNeedsChequeNo(mode) ? prev.cheque_no || prev.ChequeNumber || "" : "",
      ChequeNumber: modeNeedsChequeNo(mode) ? prev.ChequeNumber || prev.cheque_no || "" : "",
      cheque_date: modeNeedsChequeDate(mode) ? normalizeDateInput(prev.cheque_date || prev.ChequeDate) : "",
      ChequeDate: modeNeedsChequeDate(mode) ? normalizeDateInput(prev.ChequeDate || prev.cheque_date) : "",
    }));
  };

  const handleEditBankChange = (bankAccountId) => {
    const bank = bankAccounts.find((row) => Number(row.id) === Number(bankAccountId));
    const bankLabel = bank ? formatBankAccountLabel(bank) : "";

    setEditForm((prev) => ({
      ...prev,
      bank_account_id: bankAccountId,
      bank_name: bank?.bank_name || prev.bank_name || "",
      BankName: bank?.bank_name || prev.BankName || "",
      _bankDisplayLabel: bankLabel,
    }));
  };

  const saveEditedTransaction = async () => {
    if (!editForm?.Serial) {
      Swal.fire("Serial missing", "Transaction Serial not found.", "warning");
      return;
    }

    const validationMessage = validatePaymentDetails(editForm, selectedEditModeMeta);
    if (validationMessage) {
      Swal.fire("Incomplete payment details", validationMessage, "warning");
      return;
    }

    setSavingEdit(true);
    try {
      const referenceNo = firstNonEmpty(editForm.reference_no, editForm.Transaction_ID);
      const chequeNo = firstNonEmpty(editForm.cheque_no, editForm.ChequeNumber);
      const chequeDate = normalizeDateInput(editForm.cheque_date || editForm.ChequeDate);
      const bankName = firstNonEmpty(editForm.bank_name, editForm.BankName, selectedEditBankAccount?.bank_name);

      const updatedTransaction = {
        Fee_Recieved: toNum(editForm.Fee_Recieved),
        Concession: toNum(editForm.Concession),
        VanFee: toNum(editForm.VanFee),
        Fine_Amount: toNum(editForm.Fine_Amount),
        PaymentMode: editForm.PaymentMode || selectedEditModeMeta?.name || "Cash",
        mode_of_transaction_id: editForm.mode_of_transaction_id || null,
        bank_account_id: modeNeedsBank(selectedEditModeMeta) ? editForm.bank_account_id || null : null,
        reference_no: modeNeedsReference(selectedEditModeMeta) ? referenceNo || null : null,
        Transaction_ID: modeNeedsReference(selectedEditModeMeta) ? referenceNo || null : null,
        bank_name: modeNeedsBank(selectedEditModeMeta) || modeNeedsChequeFields(selectedEditModeMeta) ? bankName || null : null,
        BankName: modeNeedsBank(selectedEditModeMeta) || modeNeedsChequeFields(selectedEditModeMeta) ? bankName || null : null,
        cheque_no: modeNeedsChequeNo(selectedEditModeMeta) ? chequeNo || null : null,
        ChequeNumber: modeNeedsChequeNo(selectedEditModeMeta) ? chequeNo || null : null,
        cheque_date: modeNeedsChequeDate(selectedEditModeMeta) ? chequeDate || null : null,
        ChequeDate: modeNeedsChequeDate(selectedEditModeMeta) ? chequeDate || null : null,
        DateOfTransaction: toTransactionDatePayload(editForm.DateOfTransaction),
        Remarks: editForm.Remarks || null,
      };

      const response = await api.put(`/transactions/${editForm.Serial}`, updatedTransaction);

      if (response?.data?.success === false) {
        Swal.fire("Error", response.data.message || "Unable to update transaction.", "error");
        return;
      }

      Swal.fire("Updated!", "Transaction has been updated successfully.", "success");
      setShowEditModal(false);
      if (startDate && endDate) await handleGenerateReport();
    } catch (error) {
      console.error("Error updating transaction:", error);
      Swal.fire(
        "Error!",
        error.response?.data?.message || "Unable to update transaction.",
        "error"
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const cancelTransaction = async (item) => {
    const serial = getTxnSerial(item);
    if (!serial) {
      Swal.fire(
        "Serial missing",
        "This report response row does not include the real transaction Serial. View/Print works with Slip_ID, but Cancel needs Serial from backend.",
        "warning"
      );
      return;
    }

    try {
      await api.post(`/transactions/${serial}/cancel`);
      Swal.fire("Cancelled!", "Transaction has been cancelled.", "success");
      if (startDate && endDate) await handleGenerateReport();
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      Swal.fire("Error!", error.response?.data?.message || "Unable to cancel.", "error");
    }
  };

  const deleteTransaction = async (item) => {
    const serial = getTxnSerial(item);
    if (!serial) {
      Swal.fire(
        "Serial missing",
        "This report response row does not include the real transaction Serial. View/Print works with Slip_ID, but Delete needs Serial from backend.",
        "warning"
      );
      return;
    }

    try {
      await api.delete(`/transactions/${serial}`);
      Swal.fire("Deleted!", "Transaction permanently deleted.", "success");
      if (startDate && endDate) await handleGenerateReport();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      Swal.fire("Error!", error.response?.data?.message || "Unable to delete.", "error");
    }
  };

  // Pagination
  const studentData = filteredData;

  const totalPages = Math.max(1, Math.ceil(studentData.length / recordsPerPage));
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = studentData.slice(indexOfFirstRecord, indexOfLastRecord);

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  const pageItems = useMemo(() => {
    const items = [];
    if (totalPages <= 1) return items;

    const maxButtons = 7;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }

    if (start > 1) {
      items.push(
        <Pagination.Item key={1} active={currentPage === 1} onClick={() => handlePageChange(1)}>
          1
        </Pagination.Item>
      );
      if (start > 2) items.push(<Pagination.Ellipsis key="s-ell" disabled />);
    }

    for (let p = start; p <= end; p++) {
      items.push(
        <Pagination.Item key={p} active={p === currentPage} onClick={() => handlePageChange(p)}>
          {p}
        </Pagination.Item>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push(<Pagination.Ellipsis key="e-ell" disabled />);
      items.push(
        <Pagination.Item
          key={totalPages}
          active={currentPage === totalPages}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    return items;
  }, [currentPage, totalPages]);

  // Totals
  const totalSummary = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => {
        const fee = Number(item.totalFeeReceived) || 0;
        const con = Number(item.totalConcession) || 0;
        const van = Number(item.totalVanFee) || 0;
        const vanCon = Number(item.totalVanFeeConcession) || 0;
        const fine = Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;

        acc.totalFeeReceived += fee;
        acc.totalConcession += con;
        acc.totalVanFee += van;
        acc.totalVanFeeConcession += vanCon;
        acc.totalFine += fine;
        acc.totalReceived += fee + van + fine;
        return acc;
      },
      {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalFine: 0,
        totalReceived: 0,
      }
    );
  }, [filteredData]);

  const paymentModeSummary = useMemo(() => {
    return filteredData.reduce((acc, item) => {
      const key = isOnline(item.PaymentMode)
        ? "Online"
        : isCash(item.PaymentMode)
        ? "Cash"
        : (item.PaymentMode || "Other");

      if (!acc[key]) {
        acc[key] = {
          totalFeeReceived: 0,
          totalConcession: 0,
          totalVanFee: 0,
          totalVanFeeConcession: 0,
          totalFine: 0,
          totalReceived: 0,
          count: 0,
        };
      }

      const fee = Number(item.totalFeeReceived) || 0;
      const con = Number(item.totalConcession) || 0;
      const van = Number(item.totalVanFee) || 0;
      const vanCon = Number(item.totalVanFeeConcession) || 0;
      const fine = Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;

      acc[key].totalFeeReceived += fee;
      acc[key].totalConcession += con;
      acc[key].totalVanFee += van;
      acc[key].totalVanFeeConcession += vanCon;
      acc[key].totalFine += fine;
      acc[key].totalReceived += fee + van + fine;
      acc[key].count += 1;

      return acc;
    }, {});
  }, [filteredData]);

  const feeHeadingSummary = useMemo(() => {
    return filteredData.length ? calculateFeeHeadingSummary(filteredData) : [];
  }, [filteredData]);

  const totalFeeHeadingSummary = useMemo(() => {
    return feeHeadingSummary.reduce(
      (acc, cat) => {
        acc.totalFeeReceived.cash += cat.cash.totalFeeReceived;
        acc.totalFeeReceived.online += cat.online.totalFeeReceived;

        acc.totalConcession.cash += cat.cash.totalConcession;
        acc.totalConcession.online += cat.online.totalConcession;

        acc.totalVanFee.cash += cat.cash.totalVanFee;
        acc.totalVanFee.online += cat.online.totalVanFee;

        acc.totalVanFeeConcession.cash += cat.cash.totalVanFeeConcession;
        acc.totalVanFeeConcession.online += cat.online.totalVanFeeConcession;

        acc.totalFine.cash += cat.cash.totalFine || 0;
        acc.totalFine.online += cat.online.totalFine || 0;

        acc.totalReceived.cash += cat.cash.totalReceived;
        acc.totalReceived.online += cat.online.totalReceived;

        return acc;
      },
      {
        totalFeeReceived: { cash: 0, online: 0 },
        totalConcession: { cash: 0, online: 0 },
        totalVanFee: { cash: 0, online: 0 },
        totalVanFeeConcession: { cash: 0, online: 0 },
        totalFine: { cash: 0, online: 0 },
        totalReceived: { cash: 0, online: 0 },
      }
    );
  }, [feeHeadingSummary]);

  const viewReceipt = (slipId) => {
    setSelectedSlipId(slipId);
    setShowReceiptModal(true);
  };

  const openPdfInNewTab = async () => {
    if (!school) {
      Swal.fire("School missing", "School details not available.", "warning");
      return;
    }
    if (!startDate || !endDate) {
      Swal.fire("Missing dates", "Please select both start and end dates.", "warning");
      return;
    }

    const pdfRows = filteredData.map((item) => ({
      ...item,
      createdAt: item.DateOfTransaction || item.createdAt || null,
    }));

    const doc = (
      <PdfReports
        school={school}
        startDate={formatDate(startDate)}
        endDate={formatDate(endDate)}
        aggregatedData={pdfRows}
        feeCategories={[]}
        categorySummary={calculateFeeHeadingSummary(filteredData)}
        totalSummary={{
          totalFeeReceived: totalSummary.totalFeeReceived,
          totalConcession: totalSummary.totalConcession,
          totalVanFee: totalSummary.totalVanFee,
          totalVanFeeConcession: totalSummary.totalVanFeeConcession,
          totalFine: totalSummary.totalFine,
          totalReceived: totalSummary.totalReceived,
        }}
      />
    );

    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  };

  const hasData = reportData.length > 0;

  return (
    <Container className="mt-4">
      <Row className="align-items-center mb-3">
        <Col>
          <h2 className="mb-0">Day Wise Report</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Select date range → generate report → search, view receipts, print PDFs, download Excel
          </div>
        </Col>
        <Col className="d-flex justify-content-end gap-2">
          {hasData ? (
            <Button
              variant="outline-success"
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
            >
              {downloadingExcel ? "Downloading Excel..." : "Download Excel"}
            </Button>
          ) : (
            <Button variant="outline-success" disabled>
              Download Excel
            </Button>
          )}

          {hasData && school ? (
            <Button variant="outline-secondary" onClick={openPdfInNewTab}>
              Print Report PDF
            </Button>
          ) : (
            <Button variant="outline-secondary" disabled>
              Print Report PDF
            </Button>
          )}
        </Col>
      </Row>

      <Card className="shadow-sm border-0 mb-3">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group controlId="startDate">
                <Form.Label className="fw-semibold">Start Date</Form.Label>
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="form-control"
                  placeholderText="Select Start Date"
                  showMonthDropdown
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={15}
                  required
                />
              </Form.Group>
            </Col>

            <Col md={3}>
              <Form.Group controlId="endDate">
                <Form.Label className="fw-semibold">End Date</Form.Label>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  dateFormat="dd/MM/yyyy"
                  className="form-control"
                  placeholderText="Select End Date"
                  minDate={startDate}
                  showMonthDropdown
                  showYearDropdown
                  scrollableYearDropdown
                  yearDropdownItemNumber={15}
                  required
                />
              </Form.Group>
            </Col>

            <Col md={3} className="d-flex align-items-end">
              <Button
                variant="primary"
                onClick={handleGenerateReport}
                disabled={loading}
                className="w-100"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Generating…
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </Col>

            <Col md={3} className="d-flex align-items-end">
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="Search: name / adm / slip / heading / mode"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!hasData}
                />
                {searchQuery ? (
                  <Button variant="outline-secondary" onClick={() => setSearchQuery("")}>
                    Clear
                  </Button>
                ) : (
                  <Button variant="outline-secondary" disabled>
                    Clear
                  </Button>
                )}
              </InputGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      )}

      {hasData && (
        <Row className="g-3 mb-3">
          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Records</div>
                <div className="d-flex align-items-baseline gap-2">
                  <h4 className="mb-0">{filteredData.length}</h4>
                  <Badge bg="secondary">
                    Page {currentPage}/{totalPages}
                  </Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Total Received (incl. Fine)</div>
                <h4 className="mb-0">{formatTotalValue(totalSummary.totalReceived)}</h4>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Fee + Van</div>
                <h4 className="mb-0">
                  {formatTotalValue(
                    (totalSummary.totalFeeReceived || 0) + (totalSummary.totalVanFee || 0)
                  )}
                </h4>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Fine: {formatTotalValue(totalSummary.totalFine)}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Concession</div>
                <h4 className="mb-0">{formatTotalValue(totalSummary.totalConcession)}</h4>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {hasData && Object.keys(paymentModeSummary).length > 0 && (
        <Card className="shadow-sm border-0 mb-3">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="fw-semibold">Payment Mode Summary</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                HDFC is counted under Online
              </div>
            </div>

            <Row className="g-2">
              {Object.keys(paymentModeSummary).map((k) => (
                <Col md={3} key={k}>
                  <Card className="border">
                    <Card.Body className="py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="fw-semibold">{k}</div>
                        <Badge bg="light" text="dark">
                          {paymentModeSummary[k].count}
                        </Badge>
                      </div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Total: {formatTotalValue(paymentModeSummary[k].totalReceived)}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}

      <Row className="mt-2">
        <Col>
          {!hasData && !loading ? (
            <Alert variant="info" className="text-center">
              No data available for the selected date range.
            </Alert>
          ) : (
            <>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="mb-0">Collection Report</h5>
                {hasData && (
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, studentData.length)} of{" "}
                    {studentData.length}
                  </div>
                )}
              </div>

              <div style={{ maxHeight: "460px", overflow: "auto" }} className="border rounded">
                <Table striped hover responsive className="mb-0">
                  <thead>
                    <tr>
                      {[
                        "Sr.",
                        "Slip ID",
                        "Admission No",
                        "Student Name",
                        "Class",
                        "Payment Mode",
                        "Reference / Bank",
                        "Fee Heading",
                        "Transaction Date & Time",
                        "Fee Received",
                        "Concession",
                        "Van Fee",
                        "Fine",
                        "Total Received",
                        "Remarks",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="sticky-top bg-white"
                          style={{ top: 0, zIndex: 2, whiteSpace: "nowrap" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {currentRecords.map((item, idx) => {
                      const fee = Number(item.totalFeeReceived) || 0;
                      const van = Number(item.totalVanFee) || 0;
                      const fineAmt = Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;
                      const total = fee + van + fineAmt;
                      const serial = getTxnSerial(item);
                      const statusLabel = item?.status || "";

                      const pmKey = isOnline(item.PaymentMode)
                        ? "Online"
                        : isCash(item.PaymentMode)
                        ? "Cash"
                        : "Other";

                      return (
                        <tr key={`${item.Slip_ID}-${serial || idx}`}>
                          <td style={{ whiteSpace: "nowrap" }}>{indexOfFirstRecord + idx + 1}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className="fw-semibold">{item.Slip_ID}</span>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{item.Student?.admission_number || "—"}</td>
                          <td style={{ minWidth: 180 }}>{item.Student?.name || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{item.Student?.Class?.class_name || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <Badge bg={pmKey === "Cash" ? "success" : pmKey === "Online" ? "primary" : "secondary"}>
                              {item.modeOfTransaction?.name || item.PaymentMode || "Other"}
                            </Badge>
                          </td>
                          <td style={{ minWidth: 190 }}>
                            <div className="fw-semibold" style={{ fontSize: 12 }}>
                              {item.reference_no || item.Transaction_ID || "—"}
                            </div>
                            <div className="text-muted" style={{ fontSize: 11 }}>
                              {item.bankAccount?.bank_name || item.bank_name || item.BankName || ""}
                              {(item.cheque_no || item.ChequeNumber) ? ` • Chq: ${item.cheque_no || item.ChequeNumber}` : ""}
                            </div>
                          </td>
                          <td style={{ minWidth: 180 }}>{item.feeHeadingName || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {formatToDisplayDateTime(item.DateOfTransaction)}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{formatTotalValue(fee)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{formatTotalValue(item.totalConcession)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{formatTotalValue(van)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {fineAmt > 0 ? formatTotalValue(fineAmt) : "—"}
                          </td>
                          <td style={{ whiteSpace: "nowrap" }} className="fw-semibold">
                            {formatTotalValue(total)}
                          </td>
                          <td style={{ minWidth: 160 }}>
                            {item.Remarks || "—"}
                            {statusLabel ? (
                              <div className="mt-1">
                                <Badge
                                  bg={isCancelled(item) ? "danger" : "light"}
                                  text={isCancelled(item) ? "white" : "dark"}
                                >
                                  {statusLabel}
                                </Badge>
                              </div>
                            ) : null}
                          </td>
                          <td style={{ whiteSpace: "nowrap", minWidth: 320 }}>
                            {!serial && (
                              <div className="text-danger small mb-1">
                                Serial missing in report row
                              </div>
                            )}
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => viewReceipt(item.Slip_ID)}
                              className="me-2 mb-1"
                            >
                              View
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handlePrintReceipt(item.Slip_ID)}
                              className="me-2 mb-1"
                            >
                              Print
                            </Button>

                            {canManage && !isCancelled(item) && (
                              <Button
                                variant="outline-success"
                                size="sm"
                                className="me-2 mb-1"
                                disabled={!serial}
                                title={!serial ? "Serial missing in /reports/day-wise row" : "Edit transaction"}
                                onClick={() => openEditModal(item)}
                              >
                                Edit
                              </Button>
                            )}

                            {canManage && !isCancelled(item) && (
                              <Button
                                variant="outline-warning"
                                size="sm"
                                className="me-2 mb-1"
                                disabled={!serial}
                                title={!serial ? "Serial missing in /reports/day-wise row" : "Cancel transaction"}
                                onClick={() => {
                                  Swal.fire({
                                    title: "Cancel transaction?",
                                    text: "This transaction will be marked as cancelled.",
                                    icon: "warning",
                                    showCancelButton: true,
                                    confirmButtonText: "Yes, cancel it",
                                  }).then((result) => {
                                    if (result.isConfirmed) cancelTransaction(item);
                                  });
                                }}
                              >
                                Cancel
                              </Button>
                            )}

                            {canDelete && isCancelled(item) && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                className="mb-1"
                                disabled={!serial}
                                title={!serial ? "Serial missing in /reports/day-wise row" : "Delete transaction"}
                                onClick={() => {
                                  Swal.fire({
                                    title: "Delete transaction permanently?",
                                    text: "This action cannot be undone.",
                                    icon: "error",
                                    showCancelButton: true,
                                    confirmButtonText: "Yes, delete it",
                                  }).then((result) => {
                                    if (result.isConfirmed) deleteTransaction(item);
                                  });
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Pagination className="mb-0">
                    <Pagination.Prev
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    />
                    {pageItems}
                    <Pagination.Next
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          {feeHeadingSummary.length > 0 && (
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h5 className="mb-0">Fee Heading Summary</h5>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Cash vs Online vs Overall (includes Fine)
                  </div>
                </div>

                <div style={{ overflowX: "auto" }} className="border rounded">
                  <Table striped bordered hover responsive className="mb-0">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Fee Heading
                        </th>

                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Fee Received
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Concession
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Van Fee
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Van Fee Concession
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Fine
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Received
                        </th>
                      </tr>

                      <tr>
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`fee-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`con-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`van-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`vcon-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`fine-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`tot-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {feeHeadingSummary.map((cat, index) => (
                        <tr key={index}>
                          <td style={{ minWidth: 180 }}>{cat.feeHeading}</td>

                          <td>{formatTotalValue(cat.cash.totalFeeReceived)}</td>
                          <td>{formatTotalValue(cat.online.totalFeeReceived)}</td>
                          <td>{formatTotalValue(cat.overall.totalFeeReceived)}</td>

                          <td>{formatTotalValue(cat.cash.totalConcession)}</td>
                          <td>{formatTotalValue(cat.online.totalConcession)}</td>
                          <td>{formatTotalValue(cat.overall.totalConcession)}</td>

                          <td>{formatTotalValue(cat.cash.totalVanFee)}</td>
                          <td>{formatTotalValue(cat.online.totalVanFee)}</td>
                          <td>{formatTotalValue(cat.overall.totalVanFee)}</td>

                          <td>{formatTotalValue(cat.cash.totalVanFeeConcession)}</td>
                          <td>{formatTotalValue(cat.online.totalVanFeeConcession)}</td>
                          <td>{formatTotalValue(cat.overall.totalVanFeeConcession)}</td>

                          <td>{formatTotalValue(cat.cash.totalFine)}</td>
                          <td>{formatTotalValue(cat.online.totalFine)}</td>
                          <td>{formatTotalValue(cat.overall.totalFine)}</td>

                          <td className="fw-semibold">{formatTotalValue(cat.cash.totalReceived)}</td>
                          <td className="fw-semibold">{formatTotalValue(cat.online.totalReceived)}</td>
                          <td className="fw-semibold">{formatTotalValue(cat.overall.totalReceived)}</td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr>
                        <td>
                          <strong>Overall Total</strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFeeReceived.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFeeReceived.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalFeeReceived.cash || 0) +
                                (totalFeeHeadingSummary.totalFeeReceived.online || 0)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalConcession.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalConcession.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalConcession.cash || 0) +
                                (totalFeeHeadingSummary.totalConcession.online || 0)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFee.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFee.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalVanFee.cash || 0) +
                                (totalFeeHeadingSummary.totalVanFee.online || 0)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFeeConcession.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFeeConcession.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalVanFeeConcession.cash || 0) +
                                (totalFeeHeadingSummary.totalVanFeeConcession.online || 0)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFine.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFine.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalFine.cash || 0) +
                                (totalFeeHeadingSummary.totalFine.online || 0)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalReceived.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalReceived.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalReceived.cash || 0) +
                                (totalFeeHeadingSummary.totalReceived.online || 0)
                            )}
                          </strong>
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {showReceiptModal && (
        <ReceiptModal
          show={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          slipId={selectedSlipId}
        />
      )}

      <Modal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        centered
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <div>
            <Modal.Title className="fw-bold">Edit Transaction</Modal.Title>
            <div className="text-muted" style={{ fontSize: 13 }}>
              Slip #{editForm.Slip_ID || "—"} • Update collection and payment details
            </div>
          </div>
        </Modal.Header>

        <Modal.Body>
          <Card
            className="border-0 mb-3"
            style={{ background: "linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%)" }}
          >
            <Card.Body className="py-3">
              <Row className="g-3 align-items-end">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Slip ID</Form.Label>
                    <Form.Control value={editForm.Slip_ID || ""} disabled />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Transaction Date & Time</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={editForm.DateOfTransaction || ""}
                      onChange={(e) => handleEditInput("DateOfTransaction", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={4}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Status</Form.Label>
                    <Form.Control value={editForm.status || "active"} disabled />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0 mb-3">
            <Card.Body>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div>
                  <div className="fw-bold">Payment Details</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Same master-based payment mode flow as Transactions page
                  </div>
                </div>
                {loadingPaymentMasters ? (
                  <Badge bg="light" text="dark">Loading modes…</Badge>
                ) : (
                  <Badge bg="primary">{activeTransactionModes.length} Modes</Badge>
                )}
              </div>

              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Payment Mode</Form.Label>
                    <Form.Select
                      value={editForm.mode_of_transaction_id || editForm.PaymentMode || "Cash"}
                      onChange={(e) => handleEditModeChange(e.target.value)}
                      disabled={loadingPaymentMasters}
                    >
                      {activeTransactionModes.map((mode) => (
                        <option key={`${mode.id}-${mode.name}`} value={mode.id || mode.name}>
                          {mode.name}
                        </option>
                      ))}
                    </Form.Select>
                    {selectedEditModeMeta?.description ? (
                      <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                        {selectedEditModeMeta.description}
                      </div>
                    ) : null}
                  </Form.Group>
                </Col>

                {modeNeedsBank(selectedEditModeMeta) && (
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Receiving Bank Account</Form.Label>
                      <Form.Select
                        value={editForm.bank_account_id || ""}
                        onChange={(e) => handleEditBankChange(e.target.value)}
                      >
                        <option value="">Select receiving bank</option>
                        {bankAccounts.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {formatBankAccountLabel(bank)}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                )}

                {modeNeedsReference(selectedEditModeMeta) && (
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Reference / Transaction ID</Form.Label>
                      <Form.Control
                        value={editForm.reference_no || ""}
                        placeholder="Enter UTR / Txn ID / reference no."
                        onChange={(e) => {
                          handleEditInput("reference_no", e.target.value);
                          handleEditInput("Transaction_ID", e.target.value);
                        }}
                      />
                    </Form.Group>
                  </Col>
                )}

                {modeNeedsChequeNo(selectedEditModeMeta) && (
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Cheque Number</Form.Label>
                      <Form.Control
                        value={editForm.cheque_no || ""}
                        placeholder="Enter cheque number"
                        onChange={(e) => {
                          handleEditInput("cheque_no", e.target.value);
                          handleEditInput("ChequeNumber", e.target.value);
                        }}
                      />
                    </Form.Group>
                  </Col>
                )}

                {modeNeedsChequeDate(selectedEditModeMeta) && (
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Cheque Date</Form.Label>
                      <Form.Control
                        type="date"
                        value={editForm.cheque_date || ""}
                        onChange={(e) => {
                          handleEditInput("cheque_date", e.target.value);
                          handleEditInput("ChequeDate", e.target.value);
                        }}
                      />
                    </Form.Group>
                  </Col>
                )}

                {(modeNeedsBank(selectedEditModeMeta) || modeNeedsChequeFields(selectedEditModeMeta)) && (
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="fw-semibold">Bank Name / Instrument Bank</Form.Label>
                      <Form.Control
                        value={editForm.bank_name || ""}
                        placeholder="Bank name"
                        onChange={(e) => {
                          handleEditInput("bank_name", e.target.value);
                          handleEditInput("BankName", e.target.value);
                        }}
                      />
                      <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                        Receiving bank is selected above; this field is saved for receipt/payment detail text.
                      </div>
                    </Form.Group>
                  </Col>
                )}
              </Row>
            </Card.Body>
          </Card>

          <Card className="shadow-sm border-0">
            <Card.Body>
              <div className="fw-bold mb-3">Amount Details</div>
              <Row className="g-3">
                <Col md={3} sm={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Fee Received</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={editForm.Fee_Recieved}
                      onChange={(e) => handleEditInput("Fee_Recieved", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={3} sm={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Concession</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={editForm.Concession}
                      onChange={(e) => handleEditInput("Concession", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={3} sm={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Van Fee</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={editForm.VanFee}
                      onChange={(e) => handleEditInput("VanFee", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={3} sm={6}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Fine</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      value={editForm.Fine_Amount}
                      onChange={(e) => handleEditInput("Fine_Amount", e.target.value)}
                    />
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Remarks</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={editForm.Remarks || ""}
                      placeholder="Add remarks to show in receipt/report"
                      onChange={(e) => handleEditInput("Remarks", e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Modal.Body>

        <Modal.Footer className="border-0 pt-0">
          <Button variant="light" onClick={() => setShowEditModal(false)} disabled={savingEdit}>
            Close
          </Button>
          <Button variant="primary" onClick={saveEditedTransaction} disabled={savingEdit}>
            {savingEdit ? (
              <>
                <Spinner size="sm" className="me-2" /> Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default DayWiseReport;