"use client";

/**
 * ✅ Student Total Due Report (Session-wise, Fast, Professional UI)
 *
 * Improvements included:
 * ✅ Session selector (session-wise everywhere)
 * ✅ FAST mode: uses status="any" (auto fallback to full/partial/unpaid if backend doesn't support)
 * ✅ Till Date selector (can be future e.g. cover up to March)
 * ✅ Totals, Overdue/Upcoming status, Excel/PDF export and WhatsApp all follow selected Till Date
 * ✅ Excel/PDF now export from backend:
 *    - GET /reports/student-total-due/excel
 *    - GET /reports/student-total-due/pdf
 * ✅ WhatsApp sends:
 *    - tillDate = selected Till Date
 *    - dueDate  = MAX PREVIOUS DUE DATE relative to selected Till Date (latest dueDate <= tillDate)
 * ✅ Personalized Fee Message support added:
 *    - POST /api/messages/fee-reminder
 *    - POST /api/messages/fee-reminder/bulk
 * ✅ Custom app fee message modal added:
 *    - user can edit title/body before sending
 *    - supports placeholders like {name}, {amount}, {tillDate}, {dueDate}
 * ✅ More professional actions area and action column
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Table,
  Container,
  Spinner,
  Alert,
  Button,
  Form,
  InputGroup,
  Badge,
  Toast,
  ToastContainer,
  OverlayTrigger,
  Tooltip,
  Modal,
} from "react-bootstrap";
import api from "../api";
import "./SchoolFeeSummary.css";

/* ---------- Helpers ---------- */

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

// Concurrency helper for async loops
const withConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let idx = 0;

  const runners = new Array(Math.min(limit, items.length))
    .fill(0)
    .map(async () => {
      while (idx < items.length) {
        const cur = idx++;
        results[cur] = await worker(items[cur], cur);
      }
    });

  await Promise.all(runners);
  return results;
};

const safeStr = (v) => (v === null || v === undefined ? "" : String(v));
const digitsOnly = (s) => safeStr(s).replace(/\D/g, "");

// ISO date (YYYY-MM-DD)
const toISODate = (d) => {
  try {
    const x = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(x.getTime()))
      return new Date().toISOString().slice(0, 10);
    return x.toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

// date-only parse (avoids timezone surprises)
const parseDateOnly = (input) => {
  if (!input) return null;

  const s = String(input).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate(),
    0,
    0,
    0,
    0
  );
};

const toStartOfDay = (dt) => {
  if (!dt) return null;
  return new Date(
    dt.getFullYear(),
    dt.getMonth(),
    dt.getDate(),
    0,
    0,
    0,
    0
  );
};

const isValidISODate = (s) => !!parseDateOnly(s);

const hasStudentIdentity = (student) =>
  !!(
    safeStr(student?.name).trim() ||
    safeStr(student?.admissionNumber).trim() ||
    safeStr(student?.className).trim() ||
    safeStr(student?.sectionName || student?.section).trim()
  );

const isInactiveStudentLike = (student) => {
  const normalizedStatus = safeStr(
    student?.studentStatus ?? student?.status ?? student?.student_status
  )
    .trim()
    .toLowerCase();

  if (normalizedStatus) {
    return ["inactive", "disabled", "disable", "left", "suspended"].includes(
      normalizedStatus
    );
  }

  if (student?.is_active === false) return true;
  if (student?.enabled === false) return true;

  return false;
};

// ✅ Extract ONLY installment due date (do NOT mix fine keys here)
const extractInstallmentDueDate = (obj) => {
  if (!obj) return null;

  let raw =
    obj.due_date ||
    obj.dueDate ||
    obj.dueDateString ||
    obj.installment_due_date ||
    obj.due_date_formatted ||
    obj.dueDateFormatted ||
    null;

  // From installments array (common)
  if (!raw && Array.isArray(obj.installments) && obj.installments.length) {
    const pendingInst = obj.installments.filter((inst) => {
      const rem =
        Number(
          inst.remaining ??
            inst.pending ??
            inst.balance ??
            inst.amount_due ??
            0
        ) || 0;
      return rem > 0;
    });

    const list = pendingInst.length ? pendingInst : obj.installments;

    let bestDateStr = null;
    let bestTime = null;

    list.forEach((inst) => {
      const candidate =
        inst.due_date ||
        inst.dueDate ||
        inst.due_date_formatted ||
        inst.dueDateFormatted ||
        inst.month ||
        inst.month_year;

      if (!candidate) return;
      const d = parseDateOnly(candidate);
      if (!d) return;

      if (bestTime === null || d.getTime() < bestTime) {
        bestTime = d.getTime();
        bestDateStr = candidate;
      }
    });

    if (bestDateStr) raw = bestDateStr;
  }

  if (!raw) return null;
  const s = String(raw);
  return s.length > 10 ? s.slice(0, 10) : s;
};

// ✅ Extract ONLY fine / next fine date keys
const extractFineDate = (obj) => {
  if (!obj) return null;

  const raw =
    obj.nextFineDate ||
    obj.next_fine_date ||
    obj.fineStartDate ||
    obj.fine_start_date ||
    obj.fine_start ||
    obj.fineApplicableDate ||
    obj.fine_applicable_date ||
    null;

  if (!raw) return null;

  const s = String(raw);
  return s.length > 10 ? s.slice(0, 10) : s;
};

// ✅ Head-level due check (based on selected tillDate)
const isHeadDueTillDate = (head, tillDateISO) => {
  const remaining = Number(head.remaining || 0) || 0;
  if (remaining <= 0) return false;

  // Opening Balance -> always due if pending
  if (head.isOpeningBalance) return true;

  // Safety fallback for transport-only pending heads with missing due date
  if (head.isTransport && !head.dueDate) return true;

  const dueStr = head.dueDate; // installment due date only
  if (!dueStr) return false;

  const due = parseDateOnly(dueStr);
  if (!due) return false;

  const ref =
    toStartOfDay(parseDateOnly(tillDateISO)) || toStartOfDay(new Date());
  return due.getTime() <= ref.getTime();
};

// ✅ MAX PREVIOUS installment due date (latest <= tillDate) among pending heads
const computeMaxPreviousDueDate = (heads, tillDateISO) => {
  const ref =
    toStartOfDay(parseDateOnly(tillDateISO)) || toStartOfDay(new Date());

  let best = "";
  let bestTime = null;

  (heads || []).forEach((h) => {
    const remaining = Number(h.remaining || 0) || 0;
    if (remaining <= 0) return;
    if (h.isOpeningBalance) return;

    const ds = h.dueDate; // installment due date only
    if (!ds) return;

    const d = toStartOfDay(parseDateOnly(ds));
    if (!d) return;

    if (d.getTime() > ref.getTime()) return;

    if (bestTime === null || d.getTime() > bestTime) {
      bestTime = d.getTime();
      best = ds;
    }
  });

  return best;
};

const getFilenameFromDisposition = (disposition, fallbackName) => {
  const value = safeStr(disposition);

  const utfMatch = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/["']/g, ""));
    } catch {
      return utfMatch[1].replace(/["']/g, "");
    }
  }

  const normalMatch = value.match(/filename\s*=\s*"([^"]+)"/i);
  if (normalMatch?.[1]) return normalMatch[1];

  const plainMatch = value.match(/filename\s*=\s*([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].replace(/["']/g, "").trim();

  return fallbackName;
};

const triggerBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename || "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

// ✅ Session helpers: backend may send is_active as true/1/"true"/"1"
const isTruthyFlag = (value) =>
  value === true ||
  value === 1 ||
  String(value || "").trim().toLowerCase() === "true" ||
  String(value || "").trim() === "1";

const isSessionMarkedActive = (session) =>
  isTruthyFlag(session?.is_active ?? session?.isActive ?? session?.active);

const hasBasicCurrentStudentInfo = (student) =>
  !!(
    safeStr(student?.admissionNumber || student?.admission_number).trim() ||
    safeStr(student?.className || student?.class_name).trim()
  );

const DEFAULT_CUSTOM_FEE_MESSAGE_TEMPLATE = `Dear {name},
Your pending fee is {amount} till {tillDate}. Kindly clear it at the earliest.

Regards,
School Office`;

const FEE_MESSAGE_PLACEHOLDER_HELP =
  "Use placeholders: {name}, {amount}, {tillDate}, {dueDate}, {grade}, {admissionNumber}";

// ================= Component =================
const StudentTotalDueReport = () => {
  const [school, setSchool] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [systemActiveSessionId, setSystemActiveSessionId] = useState(null);

  const [feeHeadings, setFeeHeadings] = useState([]);

  const [transportData, setTransportData] = useState([]);
  const [transportMap, setTransportMap] = useState(new Map());

  const [students, setStudents] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());

  const [classFilter, setClassFilter] = useState("all");
  const [pendingFilter, setPendingFilter] = useState("all");

  // ✅ Till Date selector (can be future)
  const [tillDate, setTillDate] = useState(() => toISODate(new Date()));

  const [excelDownloading, setExcelDownloading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const [waSending, setWaSending] = useState(() => new Set());
  const [waAllSending, setWaAllSending] = useState(false);
  const [waAllProgress, setWaAllProgress] = useState({
    done: 0,
    total: 0,
    skipped: 0,
  });

  const [pushSending, setPushSending] = useState(() => new Set());
  const [pushAllSending, setPushAllSending] = useState(false);
  const [pushAllProgress, setPushAllProgress] = useState({
    done: 0,
    total: 0,
    failed: 0,
  });

  // ✅ Custom App Fee Message modal
  // mode: "single" | "bulk"
  const [feeMessageModal, setFeeMessageModal] = useState({
    show: false,
    mode: "single",
    student: null,
  });
  const [feeMessageTitle, setFeeMessageTitle] = useState("Fee Reminder");
  const [feeMessageBody, setFeeMessageBody] = useState(
    DEFAULT_CUSTOM_FEE_MESSAGE_TEMPLATE
  );

  // ✅ per-student recipient selection for individual WhatsApp
  // values: "father" | "mother" | "both"
  const [waRecipientByStudent, setWaRecipientByStudent] = useState({});

  const [toast, setToast] = useState({
    show: false,
    title: "",
    msg: "",
    bg: "success",
  });
  const showToast = (bg, title, msg) =>
    setToast({ show: true, bg, title, msg });

  // prevent setState after unmount
  const aliveRef = useRef(true);

  // session-load race protection
  const loadSeqRef = useRef(0);

  // report-build race protection
  const buildSeqRef = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // sanitize tillDate (never invalid)
  useEffect(() => {
    if (!isValidISODate(tillDate)) setTillDate(toISODate(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tillDate]);

  const isAnyBulkSending =
    waAllSending || pushAllSending || excelDownloading || pdfDownloading;

  const isSelectedSessionActive = (sessionIdToCheck) => {
    const selectedSessionMeta = sessions.find(
      (s) => Number(s.id) === Number(sessionIdToCheck)
    );

    return (
      isSessionMarkedActive(selectedSessionMeta) ||
      (!!systemActiveSessionId &&
        Number(sessionIdToCheck) === Number(systemActiveSessionId))
    );
  };

  // ✅ Send active-only hints to backend only for current active session.
  // Older backend will ignore these safely; updated backend can use them.
  const buildStudentStatusApiParams = (sessionIdToCheck) =>
    isSelectedSessionActive(sessionIdToCheck)
      ? {
          studentStatus: "active",
          studentStatusFilter: "active",
          includeDisabled: false,
        }
      : {};

  // ---------------- Fetchers ----------------
  const fetchSchool = async () => {
    try {
      const res = await api.get("/schools");
      if (res.data?.schools?.length) setSchool(res.data.schools[0]);
    } catch (e) {
      console.error("School fetch error", e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      setSessions(data);

      const actualActive = data.find((s) => isSessionMarkedActive(s));
      if (actualActive?.id) setSystemActiveSessionId(Number(actualActive.id));

      const active = actualActive || data[0];
      if (active) setActiveSessionId(Number(active.id));
    } catch (e) {
      console.error("Session fetch error", e);
    }
  };

  const fetchOpeningBalanceOutstanding = async (studentId, sessionId) => {
    if (!studentId || !sessionId) return 0;

    try {
      const res = await api.get("/opening-balances/outstanding", {
        params: { student_id: studentId, session_id: sessionId },
      });

      const val = Number(
        res?.data?.outstanding ??
          res?.data?.data?.outstanding ??
          res?.data?.totalOutstanding
      );
      if (!Number.isNaN(val) && val > 0) return val;
    } catch (e) {
      // ignore and fallback
    }

    try {
      const res = await api.get("/opening-balances", {
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
      return 0;
    }
  };

  // ======== Build Student-Wise Aggregated Report (FAST) ========
  const buildStudentReport = async ({
    sessionId = activeSessionId,
    feeHeadingsInput = feeHeadings,
    transportMapInput = transportMap,
  } = {}) => {
    if (!sessionId) return;

    if (!Array.isArray(feeHeadingsInput) || feeHeadingsInput.length === 0) {
      setStudents([]);
      return;
    }

    const buildId = ++buildSeqRef.current;

    setLoading(true);
    setError("");
    setExpandedIds(new Set());

    try {
      const selectedIsActiveSession = isSelectedSessionActive(sessionId);

      const combosFast = (feeHeadingsInput || []).map((fh) => ({
        feeHeadingId: fh.id,
        status: "any",
      }));

      const statusesFallback = ["full", "partial", "unpaid"];
      const combosFallback = [];
      (feeHeadingsInput || []).forEach((fh) =>
        statusesFallback.forEach((status) =>
          combosFallback.push({ feeHeadingId: fh.id, status })
        )
      );

      const studentMap = new Map();

      const upsertStudent = (student) => {
        const pk = student.student_id ?? student.Student_ID ?? student.id ?? null;
        const sid = pk ?? student.admissionNumber;
        if (!sid) return null;

        if (!studentMap.has(sid)) {
          studentMap.set(sid, {
            id: sid,
            studentId: pk,
            name: student.name || "",
            admissionNumber: student.admissionNumber || "",
            className: student.className || "",
            sectionName: student.sectionName || student.section || "",
            fatherPhone: student.fatherPhone || "",
            motherPhone: student.motherPhone || "",
            phone:
              student.phone ||
              student.parentPhone ||
              student.fatherPhone ||
              student.motherPhone ||
              "",
            studentStatus:
              student.studentStatus || student.status || student.student_status || "",
            status: student.status || "",
            student_status: student.student_status || "",
            is_active: student.is_active,
            enabled: student.enabled,
            heads: [],
          });
        } else {
          const aggExisting = studentMap.get(sid);
          if (!aggExisting.studentId && pk) aggExisting.studentId = pk;

          if (!aggExisting.name && student.name) aggExisting.name = student.name;
          if (!aggExisting.admissionNumber && student.admissionNumber)
            aggExisting.admissionNumber = student.admissionNumber;
          if (student.className) {
            aggExisting.className = student.className;
          }
          if (student.sectionName || student.section) {
            aggExisting.sectionName = student.sectionName || student.section;
          }
          if (!aggExisting.fatherPhone && student.fatherPhone)
            aggExisting.fatherPhone = student.fatherPhone;
          if (!aggExisting.motherPhone && student.motherPhone)
            aggExisting.motherPhone = student.motherPhone;
          if (!aggExisting.phone && (student.phone || student.parentPhone))
            aggExisting.phone = student.phone || student.parentPhone;

          const incomingStatus =
            student.studentStatus || student.status || student.student_status || "";
          if (!aggExisting.studentStatus && incomingStatus)
            aggExisting.studentStatus = incomingStatus;
          if (!aggExisting.status && student.status)
            aggExisting.status = student.status;
          if (!aggExisting.student_status && student.student_status)
            aggExisting.student_status = student.student_status;
          if (aggExisting.is_active === undefined && student.is_active !== undefined)
            aggExisting.is_active = student.is_active;
          if (aggExisting.enabled === undefined && student.enabled !== undefined)
            aggExisting.enabled = student.enabled;
        }

        return studentMap.get(sid);
      };

      const mergeFeeDetails = (agg, feeDetails) => {
        (feeDetails || []).forEach((fd) => {
          const headName = fd.fee_heading;
          if (!headName) return;

          let head = agg.heads.find((h) => h.name === headName && !h.isTransport);
          if (!head) {
            head = {
              name: headName,
              isTransport: false,
              due: 0,
              paid: 0,
              concession: 0,
              remaining: 0,
              fine: 0,
              dueDate: null,
              nextFineDate: null,
            };
            agg.heads.push(head);
          }

          const due = Number(fd.due || 0);
          const paid = Number(fd.paid || 0);
          const concession = Number(fd.concession || 0);
          const fine = Number(fd.fineAmount || 0);
          const remaining = Number(fd.remaining ?? due - (paid + concession));

          head.due = due;
          head.paid = paid;
          head.concession = concession;
          head.remaining = remaining;
          head.fine = fine;

          const dueDate = extractInstallmentDueDate(fd);
          if (dueDate) head.dueDate = dueDate;

          const fineDate = extractFineDate(fd);
          if (fineDate) head.nextFineDate = fineDate;
        });
      };

      let usedFast = false;

      const worker = async ({ feeHeadingId, status }) => {
        const res = await api.get("/feedue-status/fee-heading-wise-students", {
          params: {
            feeHeadingId,
            status,
            session_id: sessionId,
            ...buildStudentStatusApiParams(sessionId),
          },
        });

        const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

        rawData.forEach((student) => {
          if (selectedIsActiveSession && isInactiveStudentLike(student)) return;

          const agg = upsertStudent(student);
          if (!agg) return;
          mergeFeeDetails(agg, student.feeDetails || []);
        });
      };

      try {
        if (combosFast.length > 0) {
          usedFast = true;
          await withConcurrency(combosFast, 4, worker);
        }
      } catch (e) {
        usedFast = false;
      }

      if (!usedFast) {
        const workerFallback = async ({ feeHeadingId, status }) => {
          const res = await api.get("/feedue-status/fee-heading-wise-students", {
            params: {
            feeHeadingId,
            status,
            session_id: sessionId,
            ...buildStudentStatusApiParams(sessionId),
          },
          });

          const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

          rawData.forEach((student) => {
            // ✅ Important: fallback mode must also hide disabled students
            // from current active session.
            if (selectedIsActiveSession && isInactiveStudentLike(student)) return;

            const agg = upsertStudent(student);
            if (!agg) return;
            mergeFeeDetails(agg, student.feeDetails || []);
          });
        };

        if (combosFallback.length > 0) {
          await withConcurrency(combosFallback, 4, workerFallback);
        }
      }

      // ✅ Merge Transport heads from the transportMap passed to this exact build
      if (transportMapInput && typeof transportMapInput.forEach === "function") {
        transportMapInput.forEach((val, stuId) => {
          const normalizedStudentId =
            Number(stuId) && !Number.isNaN(Number(stuId))
              ? Number(stuId)
              : stuId;

          if (selectedIsActiveSession && isInactiveStudentLike(val)) return;
          if (!studentMap.has(normalizedStudentId) && !hasStudentIdentity(val))
            return;

          if (!studentMap.has(normalizedStudentId)) {
            studentMap.set(normalizedStudentId, {
              id: normalizedStudentId,
              studentId: val?.studentId ?? val?.student_id ?? normalizedStudentId,
              name: val?.name || "",
              admissionNumber: val?.admissionNumber || "",
              className: val?.className || "",
              sectionName: val?.sectionName || val?.section || "",
              fatherPhone: val?.fatherPhone || "",
              motherPhone: val?.motherPhone || "",
              phone:
                val?.phone ||
                val?.parentPhone ||
                val?.fatherPhone ||
                val?.motherPhone ||
                "",
              studentStatus:
                val?.studentStatus || val?.status || val?.student_status || "",
              status: val?.status || "",
              student_status: val?.student_status || "",
              is_active: val?.is_active,
              enabled: val?.enabled,
              heads: [],
            });
          } else {
            const aggExisting = studentMap.get(stuId);
            if (!aggExisting.studentId) aggExisting.studentId = stuId;

            if (val?.className) aggExisting.className = val.className;
            if (val?.sectionName || val?.section) {
              aggExisting.sectionName = val.sectionName || val.section;
            }
            if (!aggExisting.name && val?.name) aggExisting.name = val.name;
            if (!aggExisting.admissionNumber && val?.admissionNumber) {
              aggExisting.admissionNumber = val.admissionNumber;
            }
            if (!aggExisting.fatherPhone && val?.fatherPhone) {
              aggExisting.fatherPhone = val.fatherPhone;
            }
            if (!aggExisting.motherPhone && val?.motherPhone) {
              aggExisting.motherPhone = val.motherPhone;
            }
            if (!aggExisting.phone && (val?.phone || val?.parentPhone)) {
              aggExisting.phone = val.phone || val.parentPhone;
            }

            const incomingStatus =
              val?.studentStatus || val?.status || val?.student_status || "";
            if (!aggExisting.studentStatus && incomingStatus) {
              aggExisting.studentStatus = incomingStatus;
            }
            if (!aggExisting.status && val?.status) {
              aggExisting.status = val.status;
            }
            if (!aggExisting.student_status && val?.student_status) {
              aggExisting.student_status = val.student_status;
            }
            if (aggExisting.is_active === undefined && val?.is_active !== undefined) {
              aggExisting.is_active = val.is_active;
            }
            if (aggExisting.enabled === undefined && val?.enabled !== undefined) {
              aggExisting.enabled = val.enabled;
            }
          }

          const agg = studentMap.get(normalizedStudentId);

          (val.heads || []).forEach((vh) => {
            const baseHeadName = vh.fee_heading_name;
            const headName = `${baseHeadName} (Transport)`;

            let idx = agg.heads.findIndex(
              (h) => h.name === headName && h.isTransport
            );
            let head;

            if (idx === -1) {
              head = {
                name: headName,
                isTransport: true,
                due: 0,
                paid: 0,
                concession: 0,
                remaining: 0,
                fine: 0,
                dueDate: null,
                nextFineDate: null,
              };

              const academicIndex = agg.heads.findIndex(
                (h) => !h.isTransport && h.name === baseHeadName
              );
              if (academicIndex >= 0)
                agg.heads.splice(academicIndex + 1, 0, head);
              else agg.heads.push(head);
            } else {
              head = agg.heads[idx];
            }

            head.remaining = Number(vh.pending || 0);
            head.fine = Number(vh.fine || vh.fineAmount || 0);

            let tDue = extractInstallmentDueDate(vh);
            if (!tDue) {
              const academicHead = agg.heads.find(
                (h) => !h.isTransport && h.name === baseHeadName && h.dueDate
              );
              if (academicHead?.dueDate) tDue = academicHead.dueDate;
            }
            if (tDue) head.dueDate = tDue;

            let tFine = extractFineDate(vh);
            if (!tFine) {
              const academicHead = agg.heads.find(
                (h) =>
                  !h.isTransport && h.name === baseHeadName && h.nextFineDate
              );
              if (academicHead?.nextFineDate) tFine = academicHead.nextFineDate;
            }
            if (tFine) head.nextFineDate = tFine;
          });
        });
      }

      if (sessionId) {
        const studentList = Array.from(studentMap.values());
        await withConcurrency(studentList, 8, async (s) => {
          const pk =
            s.studentId ??
            (Number(s.id) && !Number.isNaN(Number(s.id)) ? Number(s.id) : null);
          if (!pk) return;

          const ob = await fetchOpeningBalanceOutstanding(pk, sessionId);
          if (ob > 0) {
            s.heads.push({
              name: "Previous Balance",
              isTransport: false,
              isOpeningBalance: true,
              due: ob,
              paid: 0,
              concession: 0,
              remaining: ob,
              fine: 0,
              dueDate: null,
              nextFineDate: null,
            });
          }
        });
      }

      const studentsArr = Array.from(studentMap.values()).map((s) => {
        const totalDueAllTime = (s.heads || []).reduce((sum, h) => {
          const remaining = Number(h.remaining || 0);
          const fine = Number(h.fine || 0);
          return sum + remaining + fine;
        }, 0);

        const totalDueTillDate = (s.heads || []).reduce((sum, h) => {
          if (!isHeadDueTillDate(h, tillDate)) return sum;
          const remaining = Number(h.remaining || 0);
          const fine = Number(h.fine || 0);
          return sum + remaining + fine;
        }, 0);

        return { ...s, totalDueAllTime, totalDueTillDate };
      });

      studentsArr.sort((a, b) => {
        const aKey = `${a.className || ""} ${a.sectionName || ""} ${a.name || ""}`.trim();
        const bKey = `${b.className || ""} ${b.sectionName || ""} ${b.name || ""}`.trim();
        return aKey.localeCompare(bKey, "en");
      });

      // ✅ Final safety guard:
      // In the current active session, never show disabled/inactive rows.
      // Also hide ghost/disabled-like rows which have no admission no and no class.
      const finalStudentsArr = selectedIsActiveSession
        ? studentsArr.filter(
            (s) => !isInactiveStudentLike(s) && hasBasicCurrentStudentInfo(s)
          )
        : studentsArr;

      if (!aliveRef.current || buildId !== buildSeqRef.current) return;

      setStudents(finalStudentsArr);

      setWaRecipientByStudent((prev) => {
        const next = { ...(prev || {}) };
        finalStudentsArr.forEach((s) => {
          const key = s?.id;
          if (key && !next[key]) next[key] = "father";
        });
        return next;
      });

      showToast(
        "success",
        "Report Ready",
        usedFast ? "Loaded using FAST mode ✅" : "Loaded using fallback mode ⚠️"
      );
    } catch (err) {
      if (!aliveRef.current || buildId !== buildSeqRef.current) return;
      console.error("Student report build error:", err);
      setError("Failed to load student-wise due report.");
      showToast(
        "danger",
        "Error",
        safeStr(err?.message || "Failed to load report")
      );
    } finally {
      if (aliveRef.current && buildId === buildSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const loadSessionDataAndBuild = async (sessionId) => {
    if (!sessionId) return;

    const loadId = ++loadSeqRef.current;

    setLoading(true);
    setError("");
    setExpandedIds(new Set());
    setStudents([]);
    setTransportData([]);
    setTransportMap(new Map());
    setFeeHeadings([]);

    try {
      const [feeHeadingsRes, transportRes] = await Promise.all([
        api.get("/fee-headings"),
        api.get("/transport/pending-per-head", {
          params: {
            session_id: sessionId,
            includeZeroPending: false,
            ...buildStudentStatusApiParams(sessionId),
          },
        }),
      ]);

      if (!aliveRef.current || loadId !== loadSeqRef.current) return;

      const feeHeadingsRows = Array.isArray(feeHeadingsRes.data)
        ? feeHeadingsRes.data
        : [];

      const transportRows = Array.isArray(transportRes.data?.data)
        ? transportRes.data.data
        : Array.isArray(transportRes.data)
        ? transportRes.data
        : [];

      const tmap = new Map();
      transportRows.forEach((stu) => {
        const key =
          Number(stu.student_id) && !Number.isNaN(Number(stu.student_id))
            ? Number(stu.student_id)
            : stu.student_id;

        const totalPending = (stu.heads || []).reduce(
          (a, h) =>
            a + Number(h.pending || 0) + Number(h.fine || h.fineAmount || 0),
          0
        );

        tmap.set(key, {
          totalPending,
          heads: stu.heads || [],
          studentId: stu.studentId ?? stu.student_id ?? key,
          student_id: stu.student_id ?? key,
          name: stu.name || "",
          admissionNumber: stu.admissionNumber || "",
          className: stu.className || "",
          sectionName: stu.sectionName || stu.section || "",
          fatherPhone: stu.fatherPhone || "",
          motherPhone: stu.motherPhone || "",
          phone:
            stu.phone ||
            stu.parentPhone ||
            stu.fatherPhone ||
            stu.motherPhone ||
            "",
          studentStatus:
            stu.studentStatus || stu.status || stu.student_status || "",
          status: stu.status || "",
          student_status: stu.student_status || "",
          is_active: stu.is_active,
          enabled: stu.enabled,
        });
      });

      setFeeHeadings(feeHeadingsRows);
      setTransportData(transportRows);
      setTransportMap(tmap);

      await buildStudentReport({
        sessionId,
        feeHeadingsInput: feeHeadingsRows,
        transportMapInput: tmap,
      });
    } catch (err) {
      if (!aliveRef.current || loadId !== loadSeqRef.current) return;
      console.error("Session change load error:", err);
      setError("Failed to load student-wise due report.");
      showToast(
        "danger",
        "Error",
        safeStr(err?.message || "Failed to load report")
      );
      setLoading(false);
    }
  };

  const buildExportParams = () => ({
    session_id: activeSessionId,
    tillDate,
    search: search.trim() || undefined,
    classFilter: classFilter !== "all" ? classFilter : undefined,
    pendingFilter: pendingFilter !== "all" ? pendingFilter : undefined,
  });

  const handleExportExcel = async () => {
    if (!activeSessionId) {
      showToast("warning", "Session missing", "Please select a session first.");
      return;
    }

    setExcelDownloading(true);
    try {
      const response = await api.get("/reports/student-total-due/excel", {
        params: buildExportParams(),
        responseType: "blob",
      });

      const fallbackName = `Student_Total_Due_${activeSession?.name || activeSessionId}_Till_${tillDate}.xlsx`;
      const filename = getFilenameFromDisposition(
        response.headers?.["content-disposition"],
        fallbackName
      );

      triggerBlobDownload(response.data, filename);
      showToast("success", "Excel Exported", "Excel downloaded successfully.");
    } catch (err) {
      console.error("Excel export error:", err);
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to export Excel";
      showToast("danger", "Excel Export Failed", safeStr(apiMsg));
    } finally {
      setExcelDownloading(false);
    }
  };

  const handleExportPdf = async () => {
    if (!activeSessionId) {
      showToast("warning", "Session missing", "Please select a session first.");
      return;
    }

    setPdfDownloading(true);
    try {
      const response = await api.get("/reports/student-total-due/pdf", {
        params: buildExportParams(),
        responseType: "blob",
      });

      const fallbackName = `Student_Total_Due_${activeSession?.name || activeSessionId}_Till_${tillDate}.pdf`;
      const filename = getFilenameFromDisposition(
        response.headers?.["content-disposition"],
        fallbackName
      );

      triggerBlobDownload(response.data, filename);
      showToast("success", "PDF Exported", "PDF downloaded successfully.");
    } catch (err) {
      console.error("PDF export error:", err);
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to export PDF";
      showToast("danger", "PDF Export Failed", safeStr(apiMsg));
    } finally {
      setPdfDownloading(false);
    }
  };

  // ======== WhatsApp ========

  const computeFineTotalTillDate = (heads) =>
    (heads || []).reduce(
      (sum, h) =>
        isHeadDueTillDate(h, tillDate) ? sum + Number(h.fine || 0) : sum,
      0
    );

  const computeWhatsAppDueDate = (heads) => {
    const prev = computeMaxPreviousDueDate(heads || [], tillDate);
    return prev || "";
  };

  const getWhatsAppTargets = (stu, recipientMode) => {
    const father = digitsOnly(stu?.fatherPhone);
    const mother = digitsOnly(stu?.motherPhone);

    if (recipientMode === "mother")
      return mother ? [{ label: "Mother", to: mother }] : [];
    if (recipientMode === "both") {
      const list = [];
      if (father) list.push({ label: "Father", to: father });
      if (mother) list.push({ label: "Mother", to: mother });
      const seen = new Set();
      return list.filter((x) => {
        if (seen.has(x.to)) return false;
        seen.add(x.to);
        return true;
      });
    }
    return father ? [{ label: "Father", to: father }] : [];
  };

  const sendWhatsAppReminder = async (stu, recipientMode = "father") => {
    const rowKey = stu?.id;
    if (!rowKey) return;

    const targets = getWhatsAppTargets(stu, recipientMode);

    if (!targets.length) {
      const msg =
        recipientMode === "mother"
          ? "This student has no Mother phone number."
          : recipientMode === "both"
          ? "This student has no Father/Mother phone number."
          : "This student has no Father phone number.";
      showToast("warning", "Phone number missing", msg);
      return;
    }

    setWaSending((prev) => new Set(prev).add(rowKey));

    try {
      const classSection = stu.sectionName
        ? `${stu.className} / ${stu.sectionName}`
        : stu.className || "";
      const fineTill = computeFineTotalTillDate(stu.heads || []);
      const dueDateToSend = computeWhatsAppDueDate(stu.heads || []);
      const receiptNo = stu.admissionNumber || "-";

      for (const t of targets) {
        await api.post("/whatsapp/fee-reminder", {
          to: t.to,
          name: stu.name || "",
          tillDate: tillDate,
          receiptNo,
          amount: String(Math.round(Number(stu.totalDueTillDate || 0))),
          fine: String(Math.round(Number(fineTill || 0))),
          dueDate: dueDateToSend || "",
          grade: classSection || "-",
          session_id: activeSessionId,
        });
      }

      const sentToText =
        recipientMode === "both"
          ? targets.map((x) => `${x.label} (${x.to})`).join(" & ")
          : `${targets[0].label} (${targets[0].to})`;

      showToast("success", "WhatsApp Sent", `Reminder sent to ${sentToText}.`);
    } catch (err) {
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send";

      console.error("WA send error:", err?.response?.data || err);
      showToast("danger", "WhatsApp Failed", safeStr(apiMsg));
    } finally {
      setWaSending((prev) => {
        const next = new Set(prev);
        next.delete(rowKey);
        return next;
      });
    }
  };

  const sendWhatsAppToAllPending = async () => {
    if (waAllSending) return;

    const pendingList = (filteredStudents || []).filter(
      (s) => Number(s.totalDueTillDate || 0) > 0
    );

    if (!pendingList.length) {
      showToast(
        "warning",
        "No pending students",
        "No students have pending till date in current filtered list."
      );
      return;
    }

    const targets = pendingList.filter((s) => digitsOnly(s.fatherPhone));
    const skipped = pendingList.length - targets.length;

    if (!targets.length) {
      showToast(
        "warning",
        "No valid Father numbers",
        "Pending students found, but Father numbers are missing."
      );
      return;
    }

    setWaAllSending(true);
    setWaAllProgress({ done: 0, total: targets.length, skipped });

    try {
      await withConcurrency(targets, 3, async (stu, idx) => {
        await sendWhatsAppReminder(stu, "father");
        setWaAllProgress((p) => ({ ...p, done: idx + 1 }));
      });

      showToast(
        "success",
        "Bulk WhatsApp Done",
        `Sent ${targets.length} message(s). Skipped (no Father No): ${skipped}.`
      );
    } catch (e) {
      console.error("sendWhatsAppToAllPending error", e);
      showToast(
        "danger",
        "Send all failed",
        "Some messages failed. Please check logs."
      );
    } finally {
      setWaAllSending(false);
    }
  };

  // ======== Personalized Fee Messages ========

  const getPendingStudentsForFeeMessage = () =>
    (filteredStudents || []).filter((s) => Number(s.totalDueTillDate || 0) > 0);

  const getFeeMessageOptionsFromModal = () => ({
    customTitle: safeStr(feeMessageTitle).trim() || "Fee Reminder",
    customMessage: safeStr(feeMessageBody).trim(),
  });

  const openSingleFeeMessageModal = (stu) => {
    const amount = Number(stu?.totalDueTillDate || 0);
    if (!stu || amount <= 0) {
      showToast(
        "warning",
        "No pending due",
        "This student has no due till date."
      );
      return;
    }

    setFeeMessageTitle("Fee Reminder");
    setFeeMessageBody(DEFAULT_CUSTOM_FEE_MESSAGE_TEMPLATE);
    setFeeMessageModal({ show: true, mode: "single", student: stu });
  };

  const openBulkFeeMessageModal = () => {
    const pendingList = getPendingStudentsForFeeMessage();
    if (!pendingList.length) {
      showToast(
        "warning",
        "No pending students",
        "No students have pending till date in current filtered list."
      );
      return;
    }

    setFeeMessageTitle("Fee Reminder");
    setFeeMessageBody(DEFAULT_CUSTOM_FEE_MESSAGE_TEMPLATE);
    setFeeMessageModal({ show: true, mode: "bulk", student: null });
  };

  const closeFeeMessageModal = () => {
    const singleStudentId = feeMessageModal?.student?.id;
    const singleSending = singleStudentId ? pushSending.has(singleStudentId) : false;
    if (singleSending || pushAllSending) return;

    setFeeMessageModal({ show: false, mode: "single", student: null });
  };

  // Builds per-student personalized/custom fee message payload.
  // Backend saves it in Messages module and sends app push notification.
  const buildFeeNotificationPayload = (stu, messageOptions = {}) => {
    const classSection = stu.sectionName
      ? `${stu.className} / ${stu.sectionName}`
      : stu.className || "";

    const dueDateToSend = computeWhatsAppDueDate(stu.heads || []);
    const customTitle = safeStr(messageOptions.customTitle).trim();
    const customMessage = safeStr(messageOptions.customMessage).trim();

    const payload = {
      studentId: stu.studentId || stu.id,
      admissionNumber: stu.admissionNumber || "",
      session_id: activeSessionId,
      amount: String(Math.round(Number(stu.totalDueTillDate || 0))),
      tillDate,
      dueDate: dueDateToSend || "",
      grade: classSection || "-",
    };

    if (customTitle) payload.customTitle = customTitle;
    if (customMessage) payload.customMessage = customMessage;

    return payload;
  };

  const sendAppFeeReminder = async (stu, messageOptions = {}) => {
    const rowKey = stu?.id;
    if (!rowKey) return false;

    const amount = Number(stu.totalDueTillDate || 0);
    if (amount <= 0) {
      showToast(
        "warning",
        "No pending due",
        "This student has no due till date."
      );
      return false;
    }

    setPushSending((prev) => new Set(prev).add(rowKey));

    try {
      const payload = buildFeeNotificationPayload(stu, messageOptions);
      await api.post("/api/messages/fee-reminder", payload);

      showToast(
        "success",
        "Fee Message Sent",
        `Message sent to ${stu.name || stu.admissionNumber || "student"}.`
      );
      return true;
    } catch (err) {
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send fee message";

      console.error("Fee message error:", err?.response?.data || err);
      showToast("danger", "Fee Message Failed", safeStr(apiMsg));
      return false;
    } finally {
      setPushSending((prev) => {
        const next = new Set(prev);
        next.delete(rowKey);
        return next;
      });
    }
  };

  const sendAppFeeReminderToAllPending = async (messageOptions = {}) => {
    if (pushAllSending) return false;

    const pendingList = getPendingStudentsForFeeMessage();

    if (!pendingList.length) {
      showToast(
        "warning",
        "No pending students",
        "No students have pending till date in current filtered list."
      );
      return false;
    }

    const studentsPayload = pendingList.map((stu) =>
      buildFeeNotificationPayload(stu, messageOptions)
    );

    const customTitle = safeStr(messageOptions.customTitle).trim();
    const customMessage = safeStr(messageOptions.customMessage).trim();

    setPushAllSending(true);
    setPushAllProgress({
      done: 0,
      total: studentsPayload.length,
      failed: 0,
    });

    try {
      const res = await api.post("/api/messages/fee-reminder/bulk", {
        session_id: activeSessionId,
        customTitle: customTitle || undefined,
        customMessage: customMessage || undefined,
        students: studentsPayload,
      });

      const summary = res?.data?.summary || {};
      const sent = Number(summary.created || summary.sent || 0);
      const failed = Number(summary.failed || 0);
      const total = Number(summary.total || studentsPayload.length);

      setPushAllProgress({
        done: sent,
        total,
        failed,
      });

      showToast(
        "success",
        "Bulk Fee Messages Done",
        `Created/Sent: ${sent}, Failed: ${failed}`
      );
      return true;
    } catch (err) {
      const apiMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send bulk fee messages";

      console.error("Bulk fee message error:", err?.response?.data || err);
      showToast("danger", "Bulk Fee Messages Failed", safeStr(apiMsg));
      return false;
    } finally {
      setPushAllSending(false);
    }
  };

  const submitFeeMessageModal = async () => {
    const options = getFeeMessageOptionsFromModal();

    let ok = false;
    if (feeMessageModal.mode === "bulk") {
      ok = await sendAppFeeReminderToAllPending(options);
    } else {
      ok = await sendAppFeeReminder(feeMessageModal.student, options);
    }

    if (ok) {
      setFeeMessageModal({ show: false, mode: "single", student: null });
    }
  };

  // ======== Effects ========

  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchSchool()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load fresh session-specific data when session changes
  useEffect(() => {
    if (!activeSessionId) return;
    loadSessionDataAndBuild(activeSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  // Rebuild totals when only tillDate changes, using current loaded data
  useEffect(() => {
    if (!activeSessionId) return;
    if (!feeHeadings.length) return;

    buildStudentReport({
      sessionId: activeSessionId,
      feeHeadingsInput: feeHeadings,
      transportMapInput: transportMap,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tillDate]);

  // Dropdown options
  const classOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const cs = s.sectionName
        ? `${s.className} / ${s.sectionName}`
        : s.className;
      if (cs) set.add(cs);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const stats = useMemo(() => {
    let pending = 0;
    let clear = 0;
    students.forEach((s) =>
      Number(s.totalDueTillDate || 0) > 0 ? pending++ : clear++
    );
    return { total: students.length, pending, clear };
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((s) => {
      const totalTillDate = Number(s.totalDueTillDate || 0);

      if (q) {
        const matchesName = (s.name || "").toLowerCase().includes(q);
        const matchesAdm = (s.admissionNumber || "").toLowerCase().includes(q);
        if (!matchesName && !matchesAdm) return false;
      }

      if (classFilter !== "all") {
        const cs = s.sectionName
          ? `${s.className} / ${s.sectionName}`
          : s.className;
        if (cs !== classFilter) return false;
      }

      if (pendingFilter === "pending" && totalTillDate <= 0) return false;
      if (pendingFilter === "clear" && totalTillDate !== 0) return false;

      return true;
    });
  }, [students, search, classFilter, pendingFilter]);

  const grandTotals = useMemo(() => {
    return filteredStudents.reduce(
      (acc, s) => {
        acc.dueTillDate += Number(s.totalDueTillDate || 0);
        acc.dueAllTime += Number(s.totalDueAllTime || 0);
        return acc;
      },
      { dueTillDate: 0, dueAllTime: 0 }
    );
  }, [filteredStudents]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () =>
    setExpandedIds(new Set(filteredStudents.map((s) => s.id)));
  const collapseAll = () => setExpandedIds(new Set());

  const handleClearFilters = () => {
    setSearch("");
    setClassFilter("all");
    setPendingFilter("all");
  };

  // ======== Render ========

  return (
    <Container className="mt-4">
      <ToastContainer
        position="top-end"
        className="p-3"
        style={{ zIndex: 9999 }}
      >
        <Toast
          bg={toast.bg}
          show={toast.show}
          onClose={() => setToast((t) => ({ ...t, show: false }))}
          delay={3500}
          autohide
        >
          <Toast.Header closeButton>
            <strong className="me-auto">{toast.title || "Info"}</strong>
          </Toast.Header>
          <Toast.Body className={toast.bg === "danger" ? "text-white" : ""}>
            {toast.msg}
          </Toast.Body>
        </Toast>
      </ToastContainer>

      <Modal
        show={feeMessageModal.show}
        onHide={closeFeeMessageModal}
        centered
        backdrop="static"
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {feeMessageModal.mode === "bulk"
              ? "Send Custom Fee Message to Pending Students"
              : "Send Custom Fee Message"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {feeMessageModal.mode === "bulk" ? (
            <Alert variant="info" className="py-2">
              This will send an app message to all students currently visible in
              filters with pending due till date. Count: <strong>{getPendingStudentsForFeeMessage().length}</strong>
            </Alert>
          ) : feeMessageModal.student ? (
            <Alert variant="light" className="border py-2">
              <div className="fw-semibold">
                {feeMessageModal.student.name || "Student"}
              </div>
              <div className="small text-muted">
                Admission No: {feeMessageModal.student.admissionNumber || "—"} | Due: {formatCurrency(feeMessageModal.student.totalDueTillDate)}
              </div>
            </Alert>
          ) : null}

          <Form.Group className="mb-3">
            <Form.Label className="fw-semibold">Notification Title</Form.Label>
            <Form.Control
              value={feeMessageTitle}
              onChange={(e) => setFeeMessageTitle(e.target.value)}
              placeholder="Fee Reminder"
              disabled={pushAllSending}
            />
          </Form.Group>

          <Form.Group>
            <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-1">
              <Form.Label className="fw-semibold mb-0">Message</Form.Label>
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                onClick={() => setFeeMessageBody(DEFAULT_CUSTOM_FEE_MESSAGE_TEMPLATE)}
                disabled={pushAllSending}
              >
                Reset Template
              </Button>
            </div>
            <Form.Control
              as="textarea"
              rows={7}
              value={feeMessageBody}
              onChange={(e) => setFeeMessageBody(e.target.value)}
              placeholder="Leave blank to send the default fee reminder."
              disabled={pushAllSending}
            />
            <Form.Text className="text-muted">
              {FEE_MESSAGE_PLACEHOLDER_HELP}. Leave message blank to use the old default fee reminder.
            </Form.Text>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer className="d-flex justify-content-between flex-wrap gap-2">
          <Button
            variant="outline-secondary"
            onClick={closeFeeMessageModal}
            disabled={pushAllSending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submitFeeMessageModal}
            disabled={
              pushAllSending ||
              (feeMessageModal.mode === "single" &&
                feeMessageModal.student?.id &&
                pushSending.has(feeMessageModal.student.id))
            }
          >
            {pushAllSending ||
            (feeMessageModal.mode === "single" &&
              feeMessageModal.student?.id &&
              pushSending.has(feeMessageModal.student.id)) ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Sending
              </>
            ) : feeMessageModal.mode === "bulk" ? (
              "Send to Pending Students"
            ) : (
              "Send Message"
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div>
          <h2 className="m-0 text-primary">Student Wise Total Due (Till Date)</h2>
          <div className="d-flex flex-wrap gap-2 align-items-center mt-1">
            {school?.name && (
              <small className="text-muted">School: {school.name}</small>
            )}
            {activeSession && (
              <Badge bg="info" text="dark" pill>
                Session: {activeSession?.name || activeSessionId}
              </Badge>
            )}
            <Badge bg="secondary" pill>
              Till Date: {tillDate}
            </Badge>
          </div>
        </div>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          <Form.Select
            size="sm"
            value={activeSessionId || ""}
            onChange={(e) => setActiveSessionId(Number(e.target.value))}
            style={{ minWidth: 220 }}
            disabled={!sessions.length || isAnyBulkSending}
          >
            {sessions.length === 0 ? (
              <option value="">Loading sessions...</option>
            ) : (
              sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || `Session ${s.id}`} {s.is_active ? "(Active)" : ""}
                </option>
              ))
            )}
          </Form.Select>

          <InputGroup size="sm" style={{ minWidth: 220 }}>
            <InputGroup.Text>Till Date</InputGroup.Text>
            <Form.Control
              type="date"
              value={tillDate}
              onChange={(e) => setTillDate(toISODate(e.target.value))}
              disabled={isAnyBulkSending}
            />
          </InputGroup>

          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => loadSessionDataAndBuild(activeSessionId)}
            disabled={loading || isAnyBulkSending || !activeSessionId}
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Refreshing
              </>
            ) : (
              "Refresh"
            )}
          </Button>
        </div>
      </div>

      <div className="mb-3 p-3 rounded border bg-white shadow-sm">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div className="d-flex flex-column gap-2">
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Badge bg="primary" pill>
                Total Students: {stats.total}
              </Badge>
              <Badge bg="danger" pill>
                Pending Till Date: {stats.pending}
              </Badge>
              <Badge bg="success" pill>
                Zero Till Date: {stats.clear}
              </Badge>
            </div>

            <div className="d-flex flex-wrap gap-2 align-items-center">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={expandAll}
                disabled={!filteredStudents.length || isAnyBulkSending}
              >
                Expand All
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={collapseAll}
                disabled={!expandedIds.size || isAnyBulkSending}
              >
                Collapse All
              </Button>
            </div>
          </div>

          <div className="d-flex gap-2 flex-wrap justify-content-end align-items-start">
            <InputGroup size="sm" style={{ minWidth: 240 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Name / Admission No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isAnyBulkSending}
              />
            </InputGroup>

            <Form.Select
              size="sm"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{ minWidth: 170 }}
              disabled={isAnyBulkSending}
            >
              <option value="all">All Classes</option>
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </Form.Select>

            <Form.Select
              size="sm"
              value={pendingFilter}
              onChange={(e) => setPendingFilter(e.target.value)}
              style={{ minWidth: 200 }}
              disabled={isAnyBulkSending}
            >
              <option value="all">All (Pending + Clear)</option>
              <option value="pending">Only Pending Till Date</option>
              <option value="clear">Only Zero Till Date</option>
            </Form.Select>

            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleClearFilters}
              disabled={isAnyBulkSending}
            >
              Clear Filters
            </Button>

            <Button
              variant="success"
              size="sm"
              onClick={handleExportExcel}
              disabled={isAnyBulkSending || !activeSessionId}
            >
              {excelDownloading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Exporting
                </>
              ) : (
                "Excel"
              )}
            </Button>

            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleExportPdf}
              disabled={isAnyBulkSending || !activeSessionId}
            >
              {pdfDownloading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Exporting
                </>
              ) : (
                "PDF"
              )}
            </Button>

            <div className="d-flex flex-column align-items-end">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={openBulkFeeMessageModal}
                disabled={pushAllSending || !filteredStudents.length}
              >
                {pushAllSending ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      className="me-2"
                    />
                    Sending {pushAllProgress.done}/{pushAllProgress.total}
                  </>
                ) : (
                  "Fee Message All (Pending)"
                )}
              </Button>
              {pushAllSending && (
                <div className="small text-muted mt-1">
                  Failed: {pushAllProgress.failed}
                </div>
              )}
            </div>

            <div className="d-flex flex-column align-items-end">
              <Button
                variant="primary"
                size="sm"
                onClick={sendWhatsAppToAllPending}
                disabled={waAllSending || !filteredStudents.length}
              >
                {waAllSending ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Sending {waAllProgress.done}/{waAllProgress.total}
                  </>
                ) : (
                  "WhatsApp All (Pending)"
                )}
              </Button>
              {waAllSending && (
                <div className="small text-muted mt-1">
                  Skipped (no Father No): {waAllProgress.skipped}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 mt-3 small text-muted">
          <span>
            • “Due Till Date” means installment due date ≤ selected Till Date.
          </span>
          <span>• Upcoming means pending but due date is after Till Date.</span>
          <span>
            • WhatsApp uses selected Till Date + max previous due date (≤ Till
            Date).
          </span>
          <span>• Fee Message opens a custom in-app message modal with push notification.</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : (
        <div className="overflow-x-auto">
          <Table striped bordered hover responsive>
            <thead className="bg-light sticky-top">
              <tr>
                <th style={{ width: "50px" }}>#</th>
                <th>Student Name</th>
                <th>Admission No</th>
                <th>Class / Section</th>
                <th>Phone</th>
                <th className="text-end">Total Due Till Date</th>
                <th className="text-end">Total Due (All Heads)</th>
                <th style={{ width: "95px" }}>Details</th>
                <th style={{ width: "250px" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((stu, index) => {
                const isOpen = expandedIds.has(stu.id);
                const cs = stu.sectionName
                  ? `${stu.className} / ${stu.sectionName}`
                  : stu.className;

                const hasPending = Number(stu.totalDueTillDate || 0) > 0;
                const isSending = waSending.has(stu.id);
                const isPushSending = pushSending.has(stu.id);

                const recipient = waRecipientByStudent?.[stu.id] || "father";
                const fatherOk = !!digitsOnly(stu.fatherPhone);
                const motherOk = !!digitsOnly(stu.motherPhone);

                const canSend =
                  recipient === "father"
                    ? fatherOk
                    : recipient === "mother"
                    ? motherOk
                    : fatherOk || motherOk;

                const tooltipText =
                  recipient === "father"
                    ? "Sends template to Father number"
                    : recipient === "mother"
                    ? "Sends template to Mother number"
                    : "Sends template to Father and Mother numbers";

                return (
                  <React.Fragment key={stu.id || index}>
                    <tr
                      className={isOpen ? "table-active" : ""}
                      style={{
                        cursor: "pointer",
                        backgroundColor: hasPending ? "#fff5f5" : "#f4fff4",
                        borderLeft: hasPending
                          ? "4px solid #dc3545"
                          : "4px solid #28a745",
                      }}
                      onDoubleClick={() => toggleExpand(stu.id)}
                      title="Double click row to expand/collapse"
                    >
                      <td>{index + 1}</td>

                      <td>
                        <div className="d-flex flex-column">
                          <span className="fw-semibold">{stu.name}</span>
                          {(stu.fatherPhone || stu.motherPhone) && (
                            <small className="text-muted">
                              Father: {stu.fatherPhone || "—"} | Mother:{" "}
                              {stu.motherPhone || "—"}
                            </small>
                          )}
                        </div>
                      </td>

                      <td>{stu.admissionNumber}</td>
                      <td>{cs}</td>
                      <td>{stu.phone || "—"}</td>

                      <td
                        className={`text-end fw-bold ${
                          hasPending ? "text-danger" : "text-success"
                        }`}
                      >
                        {formatCurrency(stu.totalDueTillDate)}
                      </td>

                      <td className="text-end">
                        {formatCurrency(stu.totalDueAllTime)}
                      </td>

                      <td className="text-center">
                        <Button
                          size="sm"
                          variant={isOpen ? "outline-primary" : "primary"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(stu.id);
                          }}
                        >
                          {isOpen ? "Hide" : "View"}
                        </Button>
                      </td>

                      <td className="text-center">
                        <div className="d-flex flex-column align-items-center gap-1">
                          <OverlayTrigger
                            placement="top"
                            overlay={
                              <Tooltip>
                                {hasPending
                                  ? "Open custom app fee message with push notification"
                                  : "No due till date for this student"}
                              </Tooltip>
                            }
                          >
                            <span className="d-inline-block">
                              <Button
                                size="sm"
                                variant="outline-primary"
                                disabled={
                                  !hasPending || isPushSending || pushAllSending
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSingleFeeMessageModal(stu);
                                }}
                                style={{ minWidth: 110 }}
                              >
                                {isPushSending ? (
                                  <>
                                    <Spinner
                                      animation="border"
                                      size="sm"
                                      className="me-2"
                                    />
                                    Sending
                                  </>
                                ) : (
                                  "Fee Message"
                                )}
                              </Button>
                            </span>
                          </OverlayTrigger>

                          <div
                            className="d-flex gap-1"
                            onClick={(e) => e.stopPropagation()}
                            style={{ flexWrap: "nowrap" }}
                          >
                            <Button
                              size="sm"
                              variant={
                                recipient === "father"
                                  ? "primary"
                                  : "outline-primary"
                              }
                              disabled={isSending || waAllSending}
                              onClick={() =>
                                setWaRecipientByStudent((prev) => ({
                                  ...(prev || {}),
                                  [stu.id]: "father",
                                }))
                              }
                              style={{ padding: "2px 8px", lineHeight: 1.1 }}
                            >
                              F
                            </Button>

                            <Button
                              size="sm"
                              variant={
                                recipient === "mother"
                                  ? "primary"
                                  : "outline-primary"
                              }
                              disabled={isSending || waAllSending}
                              onClick={() =>
                                setWaRecipientByStudent((prev) => ({
                                  ...(prev || {}),
                                  [stu.id]: "mother",
                                }))
                              }
                              style={{ padding: "2px 8px", lineHeight: 1.1 }}
                            >
                              M
                            </Button>

                            <Button
                              size="sm"
                              variant={
                                recipient === "both"
                                  ? "primary"
                                  : "outline-primary"
                              }
                              disabled={isSending || waAllSending}
                              onClick={() =>
                                setWaRecipientByStudent((prev) => ({
                                  ...(prev || {}),
                                  [stu.id]: "both",
                                }))
                              }
                              style={{ padding: "2px 8px", lineHeight: 1.1 }}
                            >
                              Both
                            </Button>
                          </div>

                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>{tooltipText}</Tooltip>}
                          >
                            <span className="d-inline-block">
                              <Button
                                size="sm"
                                variant="success"
                                disabled={!canSend || isSending || waAllSending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendWhatsAppReminder(stu, recipient);
                                }}
                                style={{ minWidth: 110 }}
                              >
                                {isSending ? (
                                  <>
                                    <Spinner
                                      animation="border"
                                      size="sm"
                                      className="me-2"
                                    />
                                    Sending
                                  </>
                                ) : (
                                  "WhatsApp"
                                )}
                              </Button>
                            </span>
                          </OverlayTrigger>

                          {!canSend && (
                            <div className="small text-muted">
                              {recipient === "mother"
                                ? "No Mother No"
                                : recipient === "both"
                                ? "No Father/Mother No"
                                : "No Father No"}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-body-tertiary">
                        <td colSpan={9}>
                          {Array.isArray(stu.heads) && stu.heads.length > 0 ? (
                            <Table
                              size="sm"
                              bordered
                              hover
                              className="mb-0 inner-details-table"
                            >
                              <thead className="table-light">
                                <tr>
                                  <th>Fee Head</th>
                                  <th style={{ width: "140px" }}>Due Date</th>
                                  <th style={{ width: "160px" }}>
                                    Next Fine Date
                                  </th>
                                  <th className="text-end">Remaining</th>
                                  <th className="text-end">Fine</th>
                                  <th className="text-end">
                                    Due Till Date (Head)
                                  </th>
                                  <th style={{ width: "130px" }}>Status</th>
                                </tr>
                              </thead>

                              <tbody>
                                {stu.heads.map((h, idx) => {
                                  const isDueTill = isHeadDueTillDate(
                                    h,
                                    tillDate
                                  );
                                  const remaining = Number(h.remaining || 0);
                                  const fine = Number(h.fine || 0);
                                  const headDueTillDate = isDueTill
                                    ? remaining + fine
                                    : 0;

                                  return (
                                    <tr key={idx}>
                                      <td>{h.name}</td>
                                      <td>{h.dueDate || "—"}</td>
                                      <td>{h.nextFineDate || "—"}</td>
                                      <td className="text-end">
                                        {formatCurrency(remaining)}
                                      </td>
                                      <td className="text-end">
                                        {formatCurrency(fine)}
                                      </td>
                                      <td className="text-end fw-semibold">
                                        {formatCurrency(headDueTillDate)}
                                      </td>
                                      <td>
                                        {isDueTill ? (
                                          <Badge bg="danger">
                                            Due Till Date
                                          </Badge>
                                        ) : remaining > 0 ? (
                                          <Badge bg="warning" text="dark">
                                            Upcoming
                                          </Badge>
                                        ) : (
                                          <Badge bg="success">Cleared</Badge>
                                        )}
                                        <div className="small text-muted mt-1">
                                          {h.isOpeningBalance ? "Opening" : ""}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          ) : (
                            <div className="text-muted small">
                              No fee head details found for this student.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-3">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr className="fw-bold">
                <td colSpan={5} className="text-end">
                  Grand Total
                </td>
                <td className="text-end text-danger">
                  {formatCurrency(grandTotals.dueTillDate)}
                </td>
                <td className="text-end">
                  {formatCurrency(grandTotals.dueAllTime)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </Table>
        </div>
      )}
    </Container>
  );
};

export default StudentTotalDueReport;