// src/pages/StudentTotalDueReport.jsx
"use client";

/**
 * FULL UPDATED FILE
 * ✅ WhatsApp per-row + WhatsApp All (ONLY pending till date > 0) + toast + progress
 * ✅ FIX: WhatsApp "Due date" sends NEXT FINE APPLY DATE (nextFineDate / fineStartDate) if future,
 *        otherwise fallback to next upcoming installment due date.
 * ✅ NEW: Per-row WhatsApp can send to Father / Mother / Both (client requirement)
 * ✅ UI IMPROVEMENT: Small buttons (F / M / Both) instead of drop-down
 *
 * IMPORTANT:
 * - Backend should send `nextFineDate` (preferred) OR `fineStartDate` in feeDetails rows.
 */

import React, { useEffect, useMemo, useState } from "react";
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
} from "react-bootstrap";
import api from "../api";
import "./SchoolFeeSummary.css";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* ---------- Helpers ---------- */

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

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
    if (Number.isNaN(x.getTime())) return new Date().toISOString().slice(0, 10);
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
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
};

const isFutureDate = (input) => {
  const d = parseDateOnly(input);
  if (!d) return false;
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  return d.getTime() > t.getTime();
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
        Number(inst.remaining ?? inst.pending ?? inst.balance ?? inst.amount_due ?? 0) || 0;
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

// Head-level overdue check
const isHeadOverdue = (head) => {
  const remaining = Number(head.remaining || 0) || 0;
  const fine = Number(head.fine || 0) || 0;

  // Opening Balance -> overdue if pending
  if (head.isOpeningBalance) return remaining > 0;

  // If fine already applied and remaining pending -> overdue
  if (fine > 0 && remaining > 0) return true;

  const dueStr = head.dueDate; // installment due date only
  if (!dueStr) return false;

  const due = parseDateOnly(dueStr);
  if (!due) return false;

  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

  return remaining > 0 && due.getTime() <= t.getTime();
};

// Next upcoming installment due date (future only)
const computeNextFutureDueDate = (heads) => {
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

  let best = null;
  let bestTime = null;

  (heads || []).forEach((h) => {
    const remaining = Number(h.remaining || 0) || 0;
    if (remaining <= 0) return;
    if (h.isOpeningBalance) return;

    const ds = h.dueDate;
    if (!ds) return;

    const d = parseDateOnly(ds);
    if (!d) return;

    if (d.getTime() <= t.getTime()) return; // future only

    if (bestTime === null || d.getTime() < bestTime) {
      bestTime = d.getTime();
      best = ds;
    }
  });

  return best;
};

// Next upcoming fine apply date (future only)
const computeNextFutureFineDate = (heads) => {
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

  let best = null;
  let bestTime = null;

  (heads || []).forEach((h) => {
    const remaining = Number(h.remaining || 0) || 0;
    if (remaining <= 0) return;
    if (h.isOpeningBalance) return;

    const ds = h.nextFineDate;
    if (!ds) return;

    const d = parseDateOnly(ds);
    if (!d) return;

    if (d.getTime() <= t.getTime()) return; // future only

    if (bestTime === null || d.getTime() < bestTime) {
      bestTime = d.getTime();
      best = ds;
    }
  });

  return best;
};

// ================= Component =================
const StudentTotalDueReport = () => {
  const [school, setSchool] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

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

  const [waSending, setWaSending] = useState(() => new Set());
  const [waAllSending, setWaAllSending] = useState(false);
  const [waAllProgress, setWaAllProgress] = useState({ done: 0, total: 0, skipped: 0 });

  // ✅ per-student recipient selection for individual WhatsApp
  // values: "father" | "mother" | "both"
  const [waRecipientByStudent, setWaRecipientByStudent] = useState({});

  const [toast, setToast] = useState({
    show: false,
    title: "",
    msg: "",
    bg: "success",
  });
  const showToast = (bg, title, msg) => setToast({ show: true, bg, title, msg });

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
      const active = data.find((s) => s.is_active) || data[0];
      if (active) setActiveSessionId(active.id);
    } catch (e) {
      console.error("Session fetch error", e);
    }
  };

  const fetchFeeHeadings = async () => {
    try {
      const { data } = await api.get("/fee-headings");
      setFeeHeadings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Fee headings fetch error", e);
      setFeeHeadings([]);
    }
  };

  const fetchTransportPending = async (sid) => {
    try {
      const params = { includeZeroPending: true };
      if (sid) params.session_id = sid;

      const res = await api.get("/transport/pending-per-head", { params });
      const rows = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
        ? res.data
        : [];

      setTransportData(rows);

      const tmap = new Map();
      rows.forEach((stu) => {
        const totalPending = (stu.heads || []).reduce((a, h) => a + Number(h.pending || 0), 0);
        tmap.set(stu.student_id, { totalPending, heads: stu.heads || [] });
      });
      setTransportMap(tmap);
    } catch (err) {
      console.error("Transport pending fetch error:", err);
      setTransportData([]);
      setTransportMap(new Map());
    }
  };

  const fetchOpeningBalanceOutstanding = async (studentId, sessionId) => {
    if (!studentId || !sessionId) return 0;

    try {
      const res = await api.get("/opening-balances/outstanding", {
        params: { student_id: studentId, session_id: sessionId },
      });

      const val = Number(
        res?.data?.outstanding ?? res?.data?.data?.outstanding ?? res?.data?.totalOutstanding
      );

      if (!Number.isNaN(val) && val > 0) return val;
    } catch (e) {
      console.warn("opening-balances/outstanding failed:", e?.message || e);
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
        res.data?.outstanding || res.data?.totalOutstanding || res.data?.totals?.outstanding
      );
      if (!Number.isNaN(providedTotal)) return Math.max(0, providedTotal);

      const total = rows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
      return Math.max(0, total);
    } catch (e) {
      console.warn("opening-balances fallback failed:", e?.message || e);
      return 0;
    }
  };

  // ======== Build Student-Wise Aggregated Report ========
  const buildStudentReport = async () => {
    setLoading(true);
    setError("");

    try {
      const statuses = ["full", "partial", "unpaid"];
      const combos = [];
      (feeHeadings || []).forEach((fh) => {
        statuses.forEach((status) => combos.push({ feeHeadingId: fh.id, status }));
      });

      const studentMap = new Map();

      const worker = async ({ feeHeadingId, status }) => {
        const res = await api.get("/feedue-status/fee-heading-wise-students", {
          params: { feeHeadingId, status, session_id: activeSessionId || undefined },
        });

        const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

        rawData.forEach((student) => {
          const pk = student.student_id ?? student.Student_ID ?? student.id ?? null;
          const sid = pk ?? student.admissionNumber;
          if (!sid) return;

          if (!studentMap.has(sid)) {
            studentMap.set(sid, {
              id: sid,
              studentId: pk,
              name: student.name,
              admissionNumber: student.admissionNumber,
              className: student.className,
              sectionName: student.sectionName || student.section || "",
              fatherPhone: student.fatherPhone || "",
              motherPhone: student.motherPhone || "",
              phone:
                student.phone ||
                student.parentPhone ||
                student.fatherPhone ||
                student.motherPhone ||
                "",
              heads: [],
            });
          } else {
            const aggExisting = studentMap.get(sid);
            if (!aggExisting.studentId && pk) aggExisting.studentId = pk;
          }

          const agg = studentMap.get(sid);

          (student.feeDetails || []).forEach((fd) => {
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
                dueDate: null, // installment due date
                nextFineDate: null, // fine apply date
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

            // ✅ dueDate ONLY from due keys
            const dueDate = extractInstallmentDueDate(fd);
            if (dueDate) head.dueDate = dueDate;

            // ✅ fine date ONLY from fine keys
            const fineDate = extractFineDate(fd);
            if (fineDate) head.nextFineDate = fineDate;
          });
        });
      };

      if (combos.length > 0) await withConcurrency(combos, 4, worker);

      // ✅ Merge Transport heads
      if (transportMap && typeof transportMap.forEach === "function") {
        transportMap.forEach((val, stuId) => {
          if (!studentMap.has(stuId)) {
            studentMap.set(stuId, {
              id: stuId,
              studentId: stuId,
              name: "",
              admissionNumber: "",
              className: "",
              sectionName: "",
              fatherPhone: "",
              motherPhone: "",
              phone: "",
              heads: [],
            });
          } else {
            const aggExisting = studentMap.get(stuId);
            if (!aggExisting.studentId) aggExisting.studentId = stuId;
          }

          const agg = studentMap.get(stuId);

          (val.heads || []).forEach((vh) => {
            const baseHeadName = vh.fee_heading_name;
            const headName = `${baseHeadName} (Transport)`;

            let idx = agg.heads.findIndex((h) => h.name === headName && h.isTransport);
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
              if (academicIndex >= 0) agg.heads.splice(academicIndex + 1, 0, head);
              else agg.heads.push(head);
            } else {
              head = agg.heads[idx];
            }

            head.remaining = Number(vh.pending || 0);
            head.fine = Number(vh.fine || vh.fineAmount || 0);

            // ✅ Transport due date: try transport keys, else fallback to academic head dueDate
            let tDue = extractInstallmentDueDate(vh);
            if (!tDue) {
              const academicHead = agg.heads.find(
                (h) => !h.isTransport && h.name === baseHeadName && h.dueDate
              );
              if (academicHead?.dueDate) tDue = academicHead.dueDate;
            }
            if (tDue) head.dueDate = tDue;

            // ✅ Transport fine date: try transport keys, else fallback to academic head nextFineDate
            let tFine = extractFineDate(vh);
            if (!tFine) {
              const academicHead = agg.heads.find(
                (h) => !h.isTransport && h.name === baseHeadName && h.nextFineDate
              );
              if (academicHead?.nextFineDate) tFine = academicHead.nextFineDate;
            }
            if (tFine) head.nextFineDate = tFine;
          });
        });
      }

      // Opening Balance
      if (activeSessionId) {
        const studentList = Array.from(studentMap.values());
        await withConcurrency(studentList, 8, async (s) => {
          const pk =
            s.studentId ?? (Number(s.id) && !Number.isNaN(Number(s.id)) ? Number(s.id) : null);
          if (!pk) return;

          const ob = await fetchOpeningBalanceOutstanding(pk, activeSessionId);
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

      // Totals
      const studentsArr = Array.from(studentMap.values()).map((s) => {
        const totalDueAllTime = (s.heads || []).reduce((sum, h) => {
          const remaining = Number(h.remaining || 0);
          const fine = Number(h.fine || 0);
          return sum + remaining + fine;
        }, 0);

        const totalDueTillDate = (s.heads || []).reduce((sum, h) => {
          if (!isHeadOverdue(h)) return sum;
          const remaining = Number(h.remaining || 0);
          const fine = Number(h.fine || 0);
          return sum + remaining + fine;
        }, 0);

        return { ...s, totalDueAllTime, totalDueTillDate };
      });

      studentsArr.sort((a, b) => {
        const aKey = `${a.className || ""} ${a.name || ""}`;
        const bKey = `${b.className || ""} ${b.name || ""}`;
        return aKey.localeCompare(bKey, "en");
      });

      setStudents(studentsArr);

      // ✅ init recipient default "father" for newly loaded students
      setWaRecipientByStudent((prev) => {
        const next = { ...(prev || {}) };
        studentsArr.forEach((s) => {
          const key = s?.id;
          if (key && !next[key]) next[key] = "father";
        });
        return next;
      });
    } catch (err) {
      console.error("Student report build error:", err);
      setError("Failed to load student-wise due report.");
    } finally {
      setLoading(false);
    }
  };

  // ======== WhatsApp ========

  const computeOverdueFineTotal = (heads) =>
    (heads || []).reduce((sum, h) => (isHeadOverdue(h) ? sum + Number(h.fine || 0) : sum), 0);

  // ✅ WhatsApp date: next future fine date (preferred), else next future due date
  const computeWhatsAppDueDate = (heads) => {
    const fineDate = computeNextFutureFineDate(heads || []);
    if (fineDate && isFutureDate(fineDate)) return fineDate;

    const dueDate = computeNextFutureDueDate(heads || []);
    if (dueDate && isFutureDate(dueDate)) return dueDate;

    return "";
  };

  // ✅ resolve targets for individual sending (father/mother/both)
  const getWhatsAppTargets = (stu, recipientMode) => {
    const father = digitsOnly(stu?.fatherPhone);
    const mother = digitsOnly(stu?.motherPhone);

    if (recipientMode === "mother") return mother ? [{ label: "Mother", to: mother }] : [];
    if (recipientMode === "both") {
      const list = [];
      if (father) list.push({ label: "Father", to: father });
      if (mother) list.push({ label: "Mother", to: mother });
      // avoid duplicate if both same
      const seen = new Set();
      return list.filter((x) => {
        if (seen.has(x.to)) return false;
        seen.add(x.to);
        return true;
      });
    }
    // default father
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
      const fineOverdue = computeOverdueFineTotal(stu.heads || []);
      const dueDateToSend = computeWhatsAppDueDate(stu.heads || []);
      const receiptNo = stu.admissionNumber || "-";

      // send to each selected target
      for (const t of targets) {
        await api.post("/whatsapp/fee-reminder", {
          to: t.to,
          name: stu.name || "",
          tillDate: toISODate(new Date()),
          receiptNo,
          amount: String(Math.round(Number(stu.totalDueTillDate || 0))),
          fine: String(Math.round(Number(fineOverdue || 0))),
          dueDate: dueDateToSend || "",
          grade: classSection || "-",
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

  // Bulk WhatsApp (Father only)
  const sendWhatsAppToAllPending = async () => {
    if (waAllSending) return;

    const pendingList = (filteredStudents || []).filter((s) => Number(s.totalDueTillDate || 0) > 0);

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
      showToast("danger", "Send all failed", "Some messages failed. Please check logs.");
    } finally {
      setWaAllSending(false);
    }
  };

  // ======== Effects ========

  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchSchool()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    (async () => {
      await fetchFeeHeadings();
      await fetchTransportPending(activeSessionId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  useEffect(() => {
    if (!feeHeadings.length) return;
    buildStudentReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeHeadings, transportMap]);

  // Dropdown options
  const classOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const cs = s.sectionName ? `${s.className} / ${s.sectionName}` : s.className;
      if (cs) set.add(cs);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const stats = useMemo(() => {
    let pending = 0;
    let clear = 0;
    students.forEach((s) => (Number(s.totalDueTillDate || 0) > 0 ? pending++ : clear++));
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
        const cs = s.sectionName ? `${s.className} / ${s.sectionName}` : s.className;
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

  // Excel export
  const exportToExcel = () => {
    if (!filteredStudents.length) return;

    const summaryRows = filteredStudents.map((stu, idx) => {
      const cs = stu.sectionName ? `${stu.className} / ${stu.sectionName}` : stu.className;
      return {
        "#": idx + 1,
        Name: stu.name,
        "Admission No": stu.admissionNumber,
        "Class / Section": cs,
        Phone: stu.phone || "",
        "Father Phone": stu.fatherPhone || "",
        "Mother Phone": stu.motherPhone || "",
        "Total Due Till Date": Number(stu.totalDueTillDate || 0),
        "Total Due (All Heads)": Number(stu.totalDueAllTime || 0),
        Status: Number(stu.totalDueTillDate || 0) > 0 ? "Pending" : "Clear",
      };
    });

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const headRows = [];
    filteredStudents.forEach((stu) => {
      const cs = stu.sectionName ? `${stu.className} / ${stu.sectionName}` : stu.className;

      (stu.heads || []).forEach((h) => {
        const overdue = isHeadOverdue(h);
        const remaining = Number(h.remaining || 0);
        const fine = Number(h.fine || 0);
        const headDueTillDate = overdue ? remaining + fine : 0;

        headRows.push({
          "Student Name": stu.name,
          "Admission No": stu.admissionNumber,
          "Class / Section": cs,
          "Fee Head": h.name,
          "Is Transport": h.isTransport ? "Yes" : "No",
          Remaining: remaining,
          Fine: fine,
          "Due Till Date (Head)": headDueTillDate,
          Status: overdue ? "Overdue" : remaining > 0 ? "Upcoming" : "Cleared",
          "Due Date": h.dueDate || "",
          "Next Fine Date": h.nextFineDate || "",
        });
      });
    });

    if (headRows.length) {
      const wsHeads = XLSX.utils.json_to_sheet(headRows);
      XLSX.utils.book_append_sheet(wb, wsHeads, "Head Details");
    }

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

    const todayStr = new Date().toISOString().slice(0, 10);
    saveAs(blob, `Student_Total_Due_${todayStr}.xlsx`);
  };

  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearch("");
    setClassFilter("all");
    setPendingFilter("all");
  };

  // ======== Render ========

  return (
    <Container className="mt-4">
      {/* Toast */}
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 9999 }}>
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

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div>
          <h2 className="m-0 text-primary">Student Wise Total Due (Till Date)</h2>
          {school?.name && <small className="text-muted">School: {school.name}</small>}
        </div>
      </div>

      {/* Filters + Stats */}
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
          </div>

          <div className="d-flex gap-2 flex-wrap justify-content-end align-items-start">
            <InputGroup size="sm" style={{ minWidth: 240 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Name / Admission No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>

            <Form.Select
              size="sm"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{ minWidth: 160 }}
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
              style={{ minWidth: 180 }}
            >
              <option value="all">All (Pending + Clear)</option>
              <option value="pending">Only Pending Till Date</option>
              <option value="clear">Only Zero Till Date</option>
            </Form.Select>

            <Button
              variant="outline-secondary"
              size="sm"
              onClick={buildStudentReport}
              disabled={waAllSending}
            >
              Refresh
            </Button>

            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleClearFilters}
              disabled={waAllSending}
            >
              Clear Filters
            </Button>

            <Button variant="success" size="sm" onClick={exportToExcel} disabled={waAllSending}>
              Excel
            </Button>

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
                <th style={{ width: "90px" }}>Details</th>
                <th style={{ width: "200px" }}>WhatsApp</th>
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
                        borderLeft: hasPending ? "4px solid #dc3545" : "4px solid #28a745",
                      }}
                      onDoubleClick={() => toggleExpand(stu.id)}
                    >
                      <td>{index + 1}</td>

                      <td>
                        <div className="d-flex flex-column">
                          <span className="fw-semibold">{stu.name}</span>
                          {(stu.fatherPhone || stu.motherPhone) && (
                            <small className="text-muted">
                              Father: {stu.fatherPhone || "—"} | Mother: {stu.motherPhone || "—"}
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

                      <td className="text-end">{formatCurrency(stu.totalDueAllTime)}</td>

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

                      {/* ✅ UPDATED: small buttons instead of dropdown */}
                      <td className="text-center">
                        <div className="d-flex flex-column align-items-center gap-1">
                          <div
                            className="d-flex gap-1"
                            onClick={(e) => e.stopPropagation()}
                            style={{ flexWrap: "nowrap" }}
                          >
                            <Button
                              size="sm"
                              variant={recipient === "father" ? "primary" : "outline-primary"}
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
                              variant={recipient === "mother" ? "primary" : "outline-primary"}
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
                              variant={recipient === "both" ? "primary" : "outline-primary"}
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

                          <OverlayTrigger placement="top" overlay={<Tooltip>{tooltipText}</Tooltip>}>
                            <span className="d-inline-block">
                              <Button
                                size="sm"
                                variant="success"
                                disabled={!canSend || isSending || waAllSending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendWhatsAppReminder(stu, recipient);
                                }}
                                style={{ minWidth: 92 }}
                              >
                                {isSending ? (
                                  <>
                                    <Spinner animation="border" size="sm" className="me-2" />
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
                            <Table size="sm" bordered hover className="mb-0 inner-details-table">
                              <thead className="table-light">
                                <tr>
                                  <th>Fee Head</th>
                                  <th style={{ width: "140px" }}>Due Date</th>
                                  <th style={{ width: "160px" }}>Next Fine Date</th>
                                  <th className="text-end">Remaining</th>
                                  <th className="text-end">Fine</th>
                                  <th className="text-end">Due Till Date (Head)</th>
                                  <th style={{ width: "110px" }}>Status</th>
                                </tr>
                              </thead>

                              <tbody>
                                {stu.heads.map((h, idx) => {
                                  const overdue = isHeadOverdue(h);
                                  const remaining = Number(h.remaining || 0);
                                  const fine = Number(h.fine || 0);
                                  const headDueTillDate = overdue ? remaining + fine : 0;

                                  return (
                                    <tr key={idx}>
                                      <td>{h.name}</td>
                                      <td>{h.dueDate || "—"}</td>
                                      <td>{h.nextFineDate || "—"}</td>
                                      <td className="text-end">{formatCurrency(remaining)}</td>
                                      <td className="text-end">{formatCurrency(fine)}</td>
                                      <td className="text-end fw-semibold">
                                        {formatCurrency(headDueTillDate)}
                                      </td>
                                      <td>
                                        {overdue ? (
                                          <Badge bg="danger">Overdue</Badge>
                                        ) : remaining > 0 ? (
                                          <Badge bg="warning" text="dark">
                                            Upcoming
                                          </Badge>
                                        ) : (
                                          <Badge bg="success">Cleared</Badge>
                                        )}
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
                <td className="text-end text-danger">{formatCurrency(grandTotals.dueTillDate)}</td>
                <td className="text-end">{formatCurrency(grandTotals.dueAllTime)}</td>
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
