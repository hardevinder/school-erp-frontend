// SchoolFeeSummary.jsx
// ✅ Updated for Session-wise reporting + previous-session transport fallback
// ✅ Clicking any fee head now shows ALL partial/unpaid heads for the same students in that session
// ✅ Previous-session transport fallback added using /student-transport/due/:studentId?session_id=...
// ✅ Transport fine included in modal
// ✅ Removed incorrect summary van-due overwrite logic

import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Container,
  Spinner,
  Alert,
  Button,
  Modal,
  Form,
  InputGroup,
  Badge,
} from "react-bootstrap";
import { pdf } from "@react-pdf/renderer";
import PdfSchoolFeeSummary from "./PdfSchoolFeeSummary";
import api from "../api";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Swal from "sweetalert2";
import "./SchoolFeeSummary.css";

// ---------- Helpers ----------
const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;
const currencyPlain = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;
const safeNum = (v) => Number(v || 0);

const pickNum = (...vals) => {
  for (const v of vals) {
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
};

const getStudentPk = (student) => {
  const raw =
    student?.student_id ?? student?.Student_ID ?? student?.id ?? null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
};

const getStudentRowKey = (student) => {
  const pk = getStudentPk(student);
  if (pk !== null) return `id:${pk}`;

  const adm = String(student?.admissionNumber || "").trim();
  if (adm) return `adm:${adm}`;

  return null;
};

const createStudentRow = (student) => {
  const pk = getStudentPk(student);
  return {
    id: pk ?? student?.admissionNumber ?? Math.random().toString(36).slice(2),
    studentPk: pk,
    rowKey: getStudentRowKey(student),
    name: student?.name || "",
    admissionNumber: student?.admissionNumber || "",
    className: student?.className || "",
    fatherPhone: student?.fatherPhone || "",
    motherPhone: student?.motherPhone || "",
    phone:
      student?.phone ||
      student?.parentPhone ||
      student?.fatherPhone ||
      student?.motherPhone ||
      "",
  };
};

const aggregateFeeDetailsByHead = (feeDetails = []) => {
  const map = new Map();

  feeDetails.forEach((fd) => {
    const headName = fd?.fee_heading;
    if (!headName) return;

    const due = safeNum(fd?.due);
    const paid = safeNum(fd?.paid);
    const concession = safeNum(fd?.concession);
    const fine = safeNum(fd?.fineAmount);
    const remaining = safeNum(fd?.remaining ?? due - (paid + concession));

    const prev = map.get(headName) || { remaining: 0, fine: 0 };
    map.set(headName, {
      remaining: prev.remaining + remaining,
      fine: prev.fine + fine,
    });
  });

  return map;
};

const mergeFeeDetailsIntoRow = (row, feeDetails = []) => {
  const agg = aggregateFeeDetailsByHead(feeDetails);

  agg.forEach((vals, headName) => {
    const remKey = `${headName} - Remaining`;
    const fineKey = `${headName} - Fine`;

    row[remKey] = Math.max(safeNum(row[remKey]), safeNum(vals.remaining));
    row[fineKey] = Math.max(safeNum(row[fineKey]), safeNum(vals.fine));
  });
};

const mergeTransportIntoRow = (row, transportHeads = []) => {
  const local = new Map();

  transportHeads.forEach((vh) => {
    const label = `${vh?.fee_heading_name || "Transport"} (Transport)`;
    const pending = safeNum(vh?.pending);
    const fine = safeNum(vh?.fine ?? vh?.fineAmount);

    const prev = local.get(label) || { remaining: 0, fine: 0 };
    local.set(label, {
      remaining: prev.remaining + pending,
      fine: prev.fine + fine,
    });
  });

  local.forEach((vals, label) => {
    const remKey = `${label} - Remaining`;
    const fineKey = `${label} - Fine`;

    row[remKey] = Math.max(safeNum(row[remKey]), safeNum(vals.remaining));
    row[fineKey] = Math.max(safeNum(row[fineKey]), safeNum(vals.fine));
  });
};

const hasMeaningfulTransportHeads = (heads = []) =>
  Array.isArray(heads) &&
  heads.some(
    (h) => safeNum(h?.pending) > 0 || safeNum(h?.fine ?? h?.fineAmount) > 0
  );

const buildTransportHeadsFromDueItems = (items = [], feeHeadings = []) => {
  const feeHeadingNameById = new Map(
    (feeHeadings || []).map((fh) => [String(fh.id), fh.fee_heading])
  );

  const out = [];

  (items || []).forEach((it) => {
    const feeHeadId = Number(
      it?.Fee_Head ??
        it?.fee_head_id ??
        it?.feeHeadingId ??
        it?.fee_head ??
        0
    );

    const baseName =
      it?.fee_heading_name ||
      it?.Fee_Heading_Name ||
      it?.fee_heading ||
      feeHeadingNameById.get(String(feeHeadId)) ||
      `Fee Head ${feeHeadId || ""}`.trim() ||
      "Transport";

    const fine = safeNum(
      it?.vanFine ??
        it?.vanFineAmount ??
        it?.VanFineAmount ??
        it?.fine ??
        it?.fineAmount
    );

    const remainingBeforeFine = pickNum(
      it?.remainingBeforeFine,
      it?.RemainingBeforeFine,
      it?.remaining_before_fine
    );

    const finalDue = pickNum(
      it?.due,
      it?.FinalDue,
      it?.finalDue,
      it?.pending
    );

    const pending =
      remainingBeforeFine > 0 ? remainingBeforeFine : Math.max(0, finalDue - fine);

    if (pending <= 0 && fine <= 0) return;

    out.push({
      fee_heading_id: feeHeadId || 0,
      fee_heading_name: baseName,
      pending,
      fine,
    });
  });

  return out;
};

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

const SchoolFeeSummary = () => {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [school, setSchool] = useState(null);

  // Session + Active session
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Fee headings
  const [feeHeadings, setFeeHeadings] = useState([]);

  // OB totals
  const [obByHeadId, setObByHeadId] = useState({});
  const [obVanTotal, setObVanTotal] = useState(0);
  const [obGenericTotal, setObGenericTotal] = useState(0);
  const [obBreakdown, setObBreakdown] = useState([]);

  // Modal + selection state
  const [selectedFeeHeadingId, setSelectedFeeHeadingId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedHeadingName, setSelectedHeadingName] = useState("");

  const [studentDetails, setStudentDetails] = useState([]);
  const [headNames, setHeadNames] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedHeads, setSelectedHeads] = useState(new Set());

  // transport
  const [transportMap, setTransportMap] = useState(new Map());

  // rows count in modal
  const [modalDisplayCount, setModalDisplayCount] = useState(10);

  const activeSession = useMemo(() => {
    return (
      sessions.find((s) => Number(s.id) === Number(activeSessionId)) || null
    );
  }, [sessions, activeSessionId]);

  const isActiveSession = useMemo(() => {
    if (!activeSession) return false;
    return activeSession?.is_active === true || activeSession?.isActive === true;
  }, [activeSession]);

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
      const sid = active ? Number(active.id) : null;
      if (sid) setActiveSessionId(sid);
      return sid;
    } catch (e) {
      console.error("Session fetch error", e);
      return null;
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

  // -------- Transport pending per head --------
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

      const tmap = new Map();
      rows.forEach((stu) => {
        const studentPk = Number(stu.student_id);
        if (Number.isNaN(studentPk)) return;

        const totalPending = (stu.heads || []).reduce(
          (a, h) => a + safeNum(h.pending),
          0
        );

        tmap.set(studentPk, {
          totalPending,
          heads: stu.heads || [],
        });
      });

      setTransportMap(tmap);
    } catch (err) {
      console.error("Transport pending fetch error:", err);
      setTransportMap(new Map());
    }
  };

  // -------- Fee Summary (SESSION-WISE) --------
  const fetchFeeSummary = async (sid) => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (sid) params.session_id = sid;

      const res = await api.get("/feedue/school-fee-summary", { params });

      const rows = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      const sorted = rows.sort(
        (a, b) => Number(a.id || 0) - Number(b.id || 0)
      );

      setSummary(sorted);
    } catch (err) {
      console.error("Error fetching summary:", err);
      setError("Failed to load fee summary.");
      setSummary([]);
    } finally {
      setLoading(false);
    }
  };

  // -------- Opening Balances (session-aware if backend supports) --------
  const fetchOpeningBalanceSummary = async (sid) => {
    try {
      const limit = 500;
      let page = 1;
      let total = 0;
      const byHead = {};
      let vanTotal = 0;
      let genericTotal = 0;

      do {
        const params = { page, limit };
        if (sid) params.session_id = sid;
        const { data } = await api.get("/opening-balances", { params });

        const rows = Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data)
          ? data
          : [];
        total = Number(data?.total || rows.length);

        rows.forEach((r) => {
          const amt = safeNum(r.amount);
          if (r.type === "fee" && r.fee_head_id) {
            byHead[r.fee_head_id] = (byHead[r.fee_head_id] || 0) + amt;
          } else if (r.type === "van") {
            vanTotal += amt;
          } else if (r.type === "generic") {
            genericTotal += amt;
          }
        });

        page++;
      } while ((page - 1) * limit < total);

      setObByHeadId(byHead);
      setObVanTotal(vanTotal);
      setObGenericTotal(genericTotal);
    } catch (e) {
      console.error("OB fetch error:", e);
      setObByHeadId({});
      setObVanTotal(0);
      setObGenericTotal(0);
    }
  };

  const refreshAll = async () => {
    const sid = activeSessionId;
    await Promise.all([
      fetchFeeSummary(sid),
      fetchTransportPending(sid),
      fetchOpeningBalanceSummary(sid),
      fetchFeeHeadings(),
      fetchSchool(),
    ]);
  };

  const fetchStudentTransportDueHeads = async (studentId, sessionId) => {
    try {
      if (!studentId || !sessionId) return [];
      const res = await api.get(`/student-transport/due/${studentId}`, {
        params: { session_id: sessionId },
      });

      const dueData = res?.data?.data || {};
      const items = Array.isArray(dueData?.items) ? dueData.items : [];

      return buildTransportHeadsFromDueItems(items, feeHeadings);
    } catch (err) {
      console.warn(
        `student-transport/due failed for student ${studentId}:`,
        err?.message || err
      );
      return [];
    }
  };

  // -------- Grand Totals for main table --------
  const grandTotals = useMemo(() => {
    return summary.reduce(
      (acc, item) => ({
        totalDue: acc.totalDue + safeNum(item.totalDue),
        totalReceived: acc.totalReceived + safeNum(item.totalReceived),
        totalConcession: acc.totalConcession + safeNum(item.totalConcession),
        totalRemainingDue:
          acc.totalRemainingDue + safeNum(item.totalRemainingDue),
        vanFeeReceived: acc.vanFeeReceived + safeNum(item.vanFeeReceived),
        vanFeeDue: acc.vanFeeDue + safeNum(item.vanFeeDue),
      }),
      {
        totalDue: 0,
        totalReceived: 0,
        totalConcession: 0,
        totalRemainingDue: 0,
        vanFeeReceived: 0,
        vanFeeDue: 0,
      }
    );
  }, [summary]);

  // -------- Initial Load --------
  useEffect(() => {
    (async () => {
      const sid = await fetchSessions();
      await Promise.all([fetchSchool(), fetchFeeHeadings()]);
      await Promise.all([
        fetchFeeSummary(sid),
        fetchTransportPending(sid),
        fetchOpeningBalanceSummary(sid),
      ]);
    })();
  }, []);

  // -------- On session change --------
  useEffect(() => {
    if (!activeSessionId) return;
    (async () => {
      await Promise.all([
        fetchFeeSummary(activeSessionId),
        fetchTransportPending(activeSessionId),
        fetchOpeningBalanceSummary(activeSessionId),
      ]);
    })();
  }, [activeSessionId]);

  // -------- OB Breakdown Table --------
  useEffect(() => {
    const fromFeeHeadings = Object.fromEntries(
      (feeHeadings || []).map((fh) => [String(fh.id), fh.fee_heading])
    );
    const fromSummary = Object.fromEntries(
      (summary || []).map((s) => [String(s.id), s.fee_heading])
    );

    const nameById = new Proxy(fromFeeHeadings, {
      get(target, prop) {
        const key = String(prop);
        return target[key] ?? fromSummary[key];
      },
    });

    const feeRows = Object.entries(obByHeadId || {}).map(([fid, amt]) => ({
      key: `fee-${fid}`,
      label: nameById[String(fid)] || `Unknown Head (#${fid})`,
      amount: safeNum(amt),
    }));

    feeRows.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    const rows = [...feeRows];
    if (obVanTotal > 0) {
      rows.push({
        key: "van",
        label: "Van (Opening Balance)",
        amount: obVanTotal,
      });
    }
    if (obGenericTotal > 0) {
      rows.push({
        key: "generic",
        label: "Generic (Opening Balance)",
        amount: obGenericTotal,
      });
    }

    setObBreakdown(rows);
  }, [summary, feeHeadings, obByHeadId, obVanTotal, obGenericTotal]);

  // ===== Modal Logic =====
  const handleCountClick = async (feeHeadingId, status, headingName) => {
    setSelectedFeeHeadingId(feeHeadingId);
    setSelectedStatus(status);
    setSelectedHeadingName(headingName);
    setShowModal(true);
    setLoadingDetails(true);
    setSearch("");
    setSelectedHeads(new Set());
    setModalDisplayCount(10);

    try {
      // 1) First get clicked bucket students
      const clickedParams = { feeHeadingId, status };
      if (activeSessionId) clickedParams.session_id = activeSessionId;

      const clickedRes = await api.get(
        "/feedue-status/fee-heading-wise-students",
        { params: clickedParams }
      );

      const clickedStudents = Array.isArray(clickedRes?.data?.data)
        ? clickedRes.data.data
        : [];

      const baseMap = new Map();
      const clickedKeys = new Set();

      clickedStudents.forEach((student) => {
        const rowKey = getStudentRowKey(student);
        if (!rowKey) return;

        clickedKeys.add(rowKey);

        if (!baseMap.has(rowKey)) {
          baseMap.set(rowKey, createStudentRow(student));
        } else {
          const existing = baseMap.get(rowKey);
          if (!existing.name && student?.name) existing.name = student.name;
          if (!existing.admissionNumber && student?.admissionNumber)
            existing.admissionNumber = student.admissionNumber;
          if (!existing.className && student?.className)
            existing.className = student.className;
          if (!existing.fatherPhone && student?.fatherPhone)
            existing.fatherPhone = student.fatherPhone;
          if (!existing.motherPhone && student?.motherPhone)
            existing.motherPhone = student.motherPhone;
          if (!existing.phone) {
            existing.phone =
              student?.phone ||
              student?.parentPhone ||
              student?.fatherPhone ||
              student?.motherPhone ||
              "";
          }
          if (existing.studentPk == null) {
            existing.studentPk = getStudentPk(student);
          }
        }
      });

      // 2) Fetch all PARTIAL + UNPAID heads for those same students
      const statusesToLoad = ["partial", "unpaid"];
      const combos = (feeHeadings || []).flatMap((fh) =>
        statusesToLoad.map((st) => ({
          feeHeadingId: fh.id,
          status: st,
        }))
      );

      await withConcurrency(combos, 4, async ({ feeHeadingId, status }) => {
        const params = { feeHeadingId, status };
        if (activeSessionId) params.session_id = activeSessionId;

        const res = await api.get("/feedue-status/fee-heading-wise-students", {
          params,
        });

        const rows = Array.isArray(res?.data?.data) ? res.data.data : [];

        rows.forEach((student) => {
          const rowKey = getStudentRowKey(student);
          if (!rowKey || !clickedKeys.has(rowKey)) return;

          if (!baseMap.has(rowKey)) {
            baseMap.set(rowKey, createStudentRow(student));
          }

          const row = baseMap.get(rowKey);

          if (row.studentPk == null) {
            row.studentPk = getStudentPk(student);
          }
          if (!row.name && student?.name) row.name = student.name;
          if (!row.admissionNumber && student?.admissionNumber)
            row.admissionNumber = student.admissionNumber;
          if (!row.className && student?.className)
            row.className = student.className;
          if (!row.fatherPhone && student?.fatherPhone)
            row.fatherPhone = student.fatherPhone;
          if (!row.motherPhone && student?.motherPhone)
            row.motherPhone = student.motherPhone;

          mergeFeeDetailsIntoRow(row, student.feeDetails || []);
        });
      });

      // 3) Merge transport for same clicked students
      const baseRows = Array.from(baseMap.values());

      // previous-session fallback if normal transport map is empty/zero
      if (!isActiveSession) {
        const fallbackTargets = baseRows.filter((row) => {
          if (row.studentPk == null) return false;
          const existing = transportMap.get(Number(row.studentPk));
          return !existing || !hasMeaningfulTransportHeads(existing.heads || []);
        });

        await withConcurrency(fallbackTargets, 4, async (row) => {
          const fallbackHeads = await fetchStudentTransportDueHeads(
            row.studentPk,
            activeSessionId
          );

          if (hasMeaningfulTransportHeads(fallbackHeads)) {
            transportMap.set(Number(row.studentPk), {
              totalPending: fallbackHeads.reduce(
                (sum, h) => sum + safeNum(h.pending),
                0
              ),
              heads: fallbackHeads,
            });
          }
        });
      }

      baseMap.forEach((row) => {
        if (row.studentPk == null) return;
        const transport = transportMap.get(Number(row.studentPk));
        if (transport && Array.isArray(transport.heads)) {
          mergeTransportIntoRow(row, transport.heads);
        }
      });

      const finalData = Array.from(baseMap.values());

      // 4) Build ordered heads list
      const allHeadsMap = new Map();

      finalData.forEach((r) => {
        Object.keys(r).forEach((k) => {
          if (k.endsWith(" - Remaining")) {
            const headName = k.replace(" - Remaining", "");
            const isTransport = headName.endsWith("(Transport)");
            if (!allHeadsMap.has(headName)) {
              allHeadsMap.set(headName, isTransport ? "transport" : "academic");
            }
          }
        });
      });

      const academicOrder = (feeHeadings || [])
        .slice()
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((f) => f.fee_heading);

      const transportHeadOrderMap = new Map();
      if (transportMap && typeof transportMap.forEach === "function") {
        transportMap.forEach((val) => {
          (val?.heads || []).forEach((vh) => {
            const name = `${vh.fee_heading_name} (Transport)`;
            const hid = Number(vh.fee_heading_id || 0);
            if (!transportHeadOrderMap.has(name)) {
              transportHeadOrderMap.set(name, hid);
            } else {
              const prev = transportHeadOrderMap.get(name);
              if (hid > 0 && (prev === 0 || hid < prev)) {
                transportHeadOrderMap.set(name, hid);
              }
            }
          });
        });
      }

      const transportOrder = Array.from(transportHeadOrderMap.entries())
        .sort((a, b) => Number(a[1]) - Number(b[1]))
        .map(([name]) => name);

      const sortedHeadNames = [
        ...academicOrder.filter((n) => allHeadsMap.get(n) === "academic"),
        ...transportOrder.filter((n) => allHeadsMap.get(n) === "transport"),
      ];

      if (sortedHeadNames.length !== allHeadsMap.size) {
        const remaining = Array.from(allHeadsMap.keys()).filter(
          (n) => !sortedHeadNames.includes(n)
        );
        remaining.sort((a, b) => a.localeCompare(b));
        sortedHeadNames.push(...remaining);
      }

      setStudentDetails(finalData);
      setHeadNames(sortedHeadNames);
      setSelectedHeads(new Set(sortedHeadNames));
    } catch (err) {
      console.error("Error fetching student details:", err);
      setStudentDetails([]);
      setHeadNames([]);
      setSelectedHeads(new Set());
    } finally {
      setLoadingDetails(false);
    }
  };

  // ---------------- Filters and Totals ----------------
  const filteredAllDetails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return studentDetails;

    return studentDetails.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.admissionNumber || "").toLowerCase().includes(q) ||
        (s.className || "").toLowerCase().includes(q) ||
        (s.fatherPhone || "").toLowerCase().includes(q) ||
        (s.motherPhone || "").toLowerCase().includes(q)
    );
  }, [search, studentDetails]);

  const visibleDetails = useMemo(() => {
    return filteredAllDetails.slice(0, modalDisplayCount);
  }, [filteredAllDetails, modalDisplayCount]);

  const toggleHead = (head) => {
    setSelectedHeads((prev) => {
      const next = new Set(prev);
      if (next.has(head)) next.delete(head);
      else next.add(head);
      return next;
    });
  };

  const selectAllHeads = () => setSelectedHeads(new Set(headNames));
  const clearAllHeads = () => setSelectedHeads(new Set());

  const columnTotals = useMemo(() => {
    const totals = {};
    headNames.forEach((head) => {
      totals[head] = { remaining: 0, fine: 0 };
    });

    filteredAllDetails.forEach((stu) => {
      headNames.forEach((head) => {
        totals[head].remaining += safeNum(stu[`${head} - Remaining`]);
        totals[head].fine += safeNum(stu[`${head} - Fine`]);
      });
    });

    return totals;
  }, [filteredAllDetails, headNames]);

  const grandTotal = useMemo(() => {
    return Array.from(selectedHeads).reduce((sum, head) => {
      return (
        sum +
        safeNum(columnTotals[head]?.remaining) +
        safeNum(columnTotals[head]?.fine)
      );
    }, 0);
  }, [columnTotals, selectedHeads]);

  const handleModalScroll = (e) => {
    const el = e.target;
    const isBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    if (isBottom) {
      setModalDisplayCount((prev) => {
        const next = prev + 10;
        return next > filteredAllDetails.length
          ? filteredAllDetails.length
          : next;
      });
    }
  };

  // ---------------- Export Excel ----------------
  const exportToExcel = () => {
    const baseFixedCols = ["#", "Name", "Admission No", "Class"];
    const phoneCols = ["Father Phone", "Mother Phone"];

    const excelRows = filteredAllDetails.map((stu, idx) => {
      const row = {
        "#": idx + 1,
        Name: stu.name,
        "Admission No": stu.admissionNumber,
        Class: stu.className,
      };

      let overall = 0;
      headNames.forEach((head) => {
        if (!selectedHeads.has(head)) return;
        const amt = safeNum(stu[`${head} - Remaining`]);
        const fine = safeNum(stu[`${head} - Fine`]);
        overall += amt + fine;
        row[`${head} Amount`] = amt;
        row[`${head} Fine`] = fine;
      });

      row["Overall Total"] = overall;
      row["Father Phone"] = stu.fatherPhone || "";
      row["Mother Phone"] = stu.motherPhone || "";
      return row;
    });

    const headerCols = [
      ...baseFixedCols,
      ...headNames.flatMap((h) =>
        selectedHeads.has(h) ? [`${h} Amount`, `${h} Fine`] : []
      ),
      "Overall Total",
      ...phoneCols,
    ];

    const worksheet = XLSX.utils.json_to_sheet(excelRows, {
      header: headerCols,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

    const sessLabel = activeSession?.name ? `_${activeSession.name}` : "";
    saveAs(
      blob,
      `${selectedHeadingName}_${selectedStatus}_Students${sessLabel}.xlsx`.replace(
        /\s+/g,
        "_"
      )
    );
  };

  // ---------------- PDF Export (Main Summary) ----------------
  const exportSummaryPdf = async () => {
    try {
      const sessName = activeSession?.name || "";
      const fileName = `School_Fee_Summary${
        sessName ? "_" + sessName : ""
      }.pdf`.replace(/\s+/g, "_");

      const doc = (
        <PdfSchoolFeeSummary
          school={school}
          session={activeSession}
          summary={summary}
          grandTotals={grandTotals}
          obBreakdown={obBreakdown}
          generatedAt={new Date().toLocaleString("en-IN")}
        />
      );

      const blob = await pdf(doc).toBlob();
      saveAs(blob, fileName);
    } catch (e) {
      console.error("PDF export error:", e);
      Swal.fire({
        icon: "error",
        title: "PDF Error",
        text: "Unable to generate PDF.",
      });
    }
  };

  // ---------------- WhatsApp ----------------
  const sendWhatsAppBatch = async () => {
    if (selectedHeads.size === 0) {
      await Swal.fire({
        icon: "info",
        title: "Select Fee Heads",
        text: "Please select at least one fee head to include in WhatsApp.",
        confirmButtonText: "OK",
      });
      return;
    }

    setShowModal(false);
    await new Promise((r) => setTimeout(r, 200));

    const count = filteredAllDetails.length;

    const confirm = await Swal.fire({
      title: "Send WhatsApp Messages?",
      html: `This will send reminders to <b>${count}</b> students for <b>${selectedHeads.size}</b> fee head(s).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Send Now",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      Swal.showLoading();

      const payload = {
        session_id: activeSessionId || undefined,
        students: filteredAllDetails
          .map((s) => {
            const included = [];
            let overall = 0;

            Array.from(selectedHeads).forEach((head) => {
              const amount = safeNum(s[`${head} - Remaining`]);
              const fine = safeNum(s[`${head} - Fine`]);
              if (amount <= 0 && fine <= 0) return;
              const total = amount + fine;
              overall += total;
              included.push({ head, amount, fine, total });
            });

            if (included.length === 0) return null;

            const lines = [
              `*Dear Parent/Guardian of ${s.name},*`,
              ``,
              `This is a kind reminder from *${
                school?.name || "Your School"
              }* regarding the pending fees${
                activeSession?.name
                  ? ` for *Session ${activeSession.name}*`
                  : ""
              }:`,
              ``,
              `*Fee Details:*`,
              ...included.map(
                (i) =>
                  `• ${i.head} — Amount: ${currencyPlain(i.amount)}${
                    i.fine > 0 ? ` | Fine: ${currencyPlain(i.fine)}` : ""
                  }`
              ),
              ``,
              `*Total Pending:* *${currencyPlain(overall)}*`,
              ``,
              `Student: ${s.name}`,
              s.className ? `Class: ${s.className}` : null,
              s.admissionNumber ? `Admission No: ${s.admissionNumber}` : null,
              ``,
              `We kindly request you to clear the pending dues at the earliest.`,
              `If you have already made the payment, please ignore this message.`,
              ``,
              `*Thank you for your prompt attention.*`,
            ].filter(Boolean);

            return {
              id: s.id ?? s.admissionNumber,
              name: s.name,
              phone: "919417873297", // test number
              admissionNumber: s.admissionNumber,
              className: s.className,
              breakdown: included,
              overallTotal: overall,
              message: lines.join("\n"),
            };
          })
          .filter(Boolean),
      };

      const resp = await api.post("/integrations/whatsapp/send-batch", payload);
      const data = resp?.data;

      Swal.hideLoading();

      if (data?.ok) {
        const sent = Array.isArray(data.sent) ? data.sent : [];
        const failedCount = sent.filter((x) => !x.ok).length;
        const successCount = sent.length - failedCount;

        await Swal.fire({
          title: failedCount ? "Partial Success" : "Success",
          html: failedCount
            ? `Sent: <b>${successCount}</b> | Failed: <b>${failedCount}</b>.<br/>All messages targeted to <b>9417873297</b>.`
            : `All <b>${sent.length}</b> messages sent.`,
          icon: failedCount ? "warning" : "success",
          confirmButtonText: "Done",
        });
      } else {
        await Swal.fire({
          title: "Error",
          text: "Message sending failed from the server.",
          icon: "error",
        });
      }
    } catch (err) {
      console.error("WhatsApp batch error:", err);
      Swal.hideLoading();
      await Swal.fire({
        title: "Error",
        html: `Unable to send WhatsApp messages.<br/><small>${
          err?.response?.data?.message || err?.message || "Unknown error"
        }</small>`,
        icon: "error",
      });
    }
  };

  // ---------------- UI helpers ----------------
  const sessionPill = useMemo(() => {
    if (!activeSession) return null;
    return (
      <Badge
        bg={activeSession.is_active ? "success" : "secondary"}
        className="px-3 py-2 rounded-pill"
      >
        Session: {activeSession.name}
        {activeSession.is_active ? " (Active)" : ""}
      </Badge>
    );
  }, [activeSession]);

  // ---------------- Render ----------------
  return (
    <Container className="mt-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
        <div>
          <h2 className="m-0">School Fee Summary</h2>
          <div className="mt-1 d-flex flex-wrap gap-2 align-items-center">
            {sessionPill}
            {school?.name ? (
              <Badge bg="info" className="px-3 py-2 rounded-pill">
                {school.name}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 align-items-center">
          <div style={{ minWidth: 220 }}>
            <Form.Select
              value={activeSessionId || ""}
              onChange={(e) => setActiveSessionId(Number(e.target.value))}
              disabled={!sessions.length}
              title="Select session"
            >
              {!sessions.length ? (
                <option value="">Loading sessions...</option>
              ) : null}
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_active ? "• Active" : ""}
                </option>
              ))}
            </Form.Select>
          </div>

          <Button
            variant="outline-secondary"
            onClick={refreshAll}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>

          <Button
            variant="outline-primary"
            onClick={exportSummaryPdf}
            disabled={!summary.length}
          >
            PDF
          </Button>
        </div>
      </div>

      {obBreakdown.length > 0 && (
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between">
            <h5 className="fw-bold text-primary mb-3">Opening Balances</h5>
            <Badge
              bg="light"
              text="dark"
              className="px-3 py-2 rounded-pill border"
            >
              Total:{" "}
              <span className="fw-bold">
                {formatCurrency(
                  obBreakdown.reduce((a, r) => a + safeNum(r.amount), 0)
                )}
              </span>
            </Badge>
          </div>

          <div className="rounded border p-2 bg-light">
            <Table striped bordered hover size="sm" className="mb-0">
              <thead className="bg-secondary-subtle">
                <tr>
                  <th style={{ width: "60px", textAlign: "center" }}>#</th>
                  <th>Particular</th>
                  <th className="text-end" style={{ width: "180px" }}>
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {obBreakdown.map((row, i) => (
                  <tr key={row.key}>
                    <td style={{ textAlign: "center" }}>{i + 1}</td>
                    <td className="fw-semibold">{row.label}</td>
                    <td className="text-end">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}

                <tr className="table-total-row">
                  <td colSpan={2} className="text-end fw-bold">
                    Total
                  </td>
                  <td className="text-end fw-bold text-success">
                    {formatCurrency(
                      obBreakdown.reduce((a, r) => a + safeNum(r.amount), 0)
                    )}
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : error ? (
        <Alert variant="danger" className="mb-0">
          {error}
        </Alert>
      ) : (
        <div className="overflow-x-auto">
          <Table striped bordered hover>
            <thead className="bg-light sticky-top">
              <tr>
                <th>#</th>
                <th>Fee Heading</th>
                <th>Total Due</th>
                <th>Total Received</th>
                <th>Concession</th>
                <th>Remaining Due</th>
                <th>Fully Paid</th>
                <th>Partially Paid</th>
                <th>Unpaid</th>
                <th>Total Students</th>
                <th>Van Fee Received</th>
                <th>Van Students</th>
              </tr>
            </thead>

            <tbody>
              {summary.map((item, i) => {
                const totalStudents =
                  safeNum(item.studentsPaidFull) +
                  safeNum(item.studentsPaidPartial) +
                  safeNum(item.studentsPending);

                const isVanRow =
                  String(item.fee_heading || "").toLowerCase() === "van fee";

                return (
                  <tr
                    key={`${item.id || "x"}-${i}`}
                    className={isVanRow ? "table-warning" : ""}
                  >
                    <td>{i + 1}</td>
                    <td className="fw-semibold">{item.fee_heading}</td>
                    <td>{formatCurrency(item.totalDue)}</td>
                    <td>{formatCurrency(item.totalReceived)}</td>
                    <td>{formatCurrency(item.totalConcession)}</td>
                    <td className="text-danger fw-semibold">
                      {formatCurrency(item.totalRemainingDue)}
                    </td>

                    <td>
                      {item.studentsPaidFull == null ? (
                        "—"
                      ) : (
                        <span
                          className="count-chip chip-success"
                          onClick={() =>
                            handleCountClick(item.id, "full", item.fee_heading)
                          }
                          role="button"
                          title="View fully paid students"
                        >
                          {item.studentsPaidFull}
                        </span>
                      )}
                    </td>

                    <td>
                      {item.studentsPaidPartial == null ? (
                        "—"
                      ) : (
                        <span
                          className="count-chip chip-warning"
                          onClick={() =>
                            handleCountClick(
                              item.id,
                              "partial",
                              item.fee_heading
                            )
                          }
                          role="button"
                          title="View partially paid students"
                        >
                          {item.studentsPaidPartial}
                        </span>
                      )}
                    </td>

                    <td>
                      {item.studentsPending == null ? (
                        "—"
                      ) : (
                        <span
                          className="count-chip chip-danger"
                          onClick={() =>
                            handleCountClick(item.id, "unpaid", item.fee_heading)
                          }
                          role="button"
                          title="View unpaid students"
                        >
                          {item.studentsPending}
                        </span>
                      )}
                    </td>

                    <td>
                      {item.studentsPaidFull == null ? "—" : totalStudents}
                    </td>
                    <td>{formatCurrency(item.vanFeeReceived || 0)}</td>
                    <td>{item.vanStudents ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="fw-bold">
                <td colSpan={2}>Grand Total</td>
                <td>{formatCurrency(grandTotals.totalDue)}</td>
                <td>{formatCurrency(grandTotals.totalReceived)}</td>
                <td>{formatCurrency(grandTotals.totalConcession)}</td>
                <td>{formatCurrency(grandTotals.totalRemainingDue)}</td>
                <td colSpan={4}></td>
                <td>{formatCurrency(grandTotals.vanFeeReceived)}</td>
                <td></td>
              </tr>
            </tfoot>
          </Table>
        </div>
      )}

      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="xl"
        fullscreen="md-down"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Students — {selectedStatus?.toUpperCase()} ({selectedHeadingName})
            {activeSession?.name ? (
              <Badge bg="light" text="dark" className="ms-2 border">
                Session {activeSession.name}
              </Badge>
            ) : null}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="modal-body-fixed">
          <div className="modal-controls">
            <InputGroup className="modal-search">
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setModalDisplayCount(10);
                }}
                placeholder="Type name, class, admission no..."
              />
            </InputGroup>

            <div className="d-flex gap-2 flex-wrap">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={selectAllHeads}
              >
                Select All
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={clearAllHeads}
              >
                Clear
              </Button>
              <Button variant="success" size="sm" onClick={exportToExcel}>
                Excel
              </Button>
              <Button variant="success" size="sm" onClick={sendWhatsAppBatch}>
                WhatsApp
              </Button>
            </div>
          </div>

          {loadingDetails ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : (
            <div className="scrollable-table" onScroll={handleModalScroll}>
              <Table striped bordered hover className="modal-table">
                <thead>
                  <tr>
                    <th className="slc slc-1">#</th>
                    <th className="slc slc-2">Name</th>
                    <th className="slc slc-3">Admission No</th>
                    <th className="slc slc-4">Class</th>
                    {headNames.map((head) => (
                      <th key={head} className="feehead-header">
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <span
                            title={head}
                            style={{
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {head}
                          </span>
                          <Form.Check
                            type="checkbox"
                            checked={selectedHeads.has(head)}
                            onChange={() => toggleHead(head)}
                            title="Include in totals/export/WhatsApp"
                          />
                        </div>
                      </th>
                    ))}
                    <th className="sticky-overall">Overall</th>
                    <th className="slc slc-5">Father Phone</th>
                    <th className="slc slc-6">Mother Phone</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleDetails.map((stu, idx) => {
                    let overall = 0;
                    headNames.forEach((h) => {
                      if (!selectedHeads.has(h)) return;
                      const amt = safeNum(stu[`${h} - Remaining`]);
                      const fine = safeNum(stu[`${h} - Fine`]);
                      overall += amt + fine;
                    });

                    return (
                      <tr key={`${stu.id}-${idx}`}>
                        <td className="slc slc-1">{idx + 1}</td>
                        <td className="slc slc-2">{stu.name}</td>
                        <td className="slc slc-3">{stu.admissionNumber}</td>
                        <td className="slc slc-4">{stu.className}</td>
                        {headNames.map((h) => {
                          const amt = safeNum(stu[`${h} - Remaining`]);
                          const fine = safeNum(stu[`${h} - Fine`]);
                          const tot = amt + fine;
                          return (
                            <td
                              key={h}
                              title={
                                tot > 0
                                  ? `Amount: ${formatCurrency(
                                      amt
                                    )} | Fine: ${formatCurrency(fine)}`
                                  : ""
                              }
                            >
                              {formatCurrency(tot)}
                            </td>
                          );
                        })}
                        <td className="sticky-overall text-danger fw-bold">
                          {formatCurrency(overall)}
                        </td>
                        <td className="slc slc-5">{stu.fatherPhone || ""}</td>
                        <td className="slc slc-6">{stu.motherPhone || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="table-total-row sticky-footer">
                    <td className="slc slc-1" colSpan={4}>
                      Total (All Selected)
                    </td>
                    {headNames.map((h) => {
                      const tot =
                        safeNum(columnTotals[h]?.remaining) +
                        safeNum(columnTotals[h]?.fine);
                      return <td key={h}>{formatCurrency(tot)}</td>;
                    })}
                    <td className="sticky-overall fw-bold text-danger">
                      {formatCurrency(grandTotal)}
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <small className="text-muted">
            Showing <b>{visibleDetails.length}</b> of{" "}
            <b>{filteredAllDetails.length}</b> students. Scroll down to load
            more.
          </small>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SchoolFeeSummary;