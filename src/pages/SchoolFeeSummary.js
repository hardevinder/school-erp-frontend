// ======== PART 1/4: Imports, Helpers, and Basic Setup ========

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

// ================= Component =================
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

  // Transport pending cache
  const [transportData, setTransportData] = useState([]);
  const [transportMap, setTransportMap] = useState(new Map());

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
      setTransportData(rows);
      // Build quick map: student_id -> heads[]
      const tmap = new Map();
      rows.forEach((stu) => {
        const totalPending = (stu.heads || []).reduce(
          (a, h) => a + Number(h.pending || 0),
          0
        );
        tmap.set(stu.student_id, {
          totalPending,
          heads: stu.heads || [],
        });
      });
      setTransportMap(tmap);
    } catch (err) {
      console.error("Transport pending fetch error:", err);
      setTransportData([]);
      setTransportMap(new Map());
    }
  };

// ======== END OF PART 1/4 ========
// ======== PART 2/4: Fetch Summary, OB Data & Grand Totals ========

  // -------- Fee Summary --------
  const fetchFeeSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/feedue/school-fee-summary");
      const sorted = (res.data || []).sort((a, b) => Number(a.id) - Number(b.id));
      // Merge vanFeeDue placeholder (will compute below)
      const merged = sorted.map((r) => ({ ...r, vanFeeDue: 0 }));
      setSummary(merged);
    } catch (err) {
      console.error("Error fetching summary:", err);
      setError("Failed to load fee summary.");
    } finally {
      setLoading(false);
    }
  };

  // -------- Opening Balances --------
  const fetchOpeningBalanceSummary = async () => {
    try {
      const limit = 500;
      let page = 1;
      let total = 0;
      const byHead = {};
      let vanTotal = 0;
      let genericTotal = 0;

      do {
        const params = { page, limit, session_id: activeSessionId || undefined };
        const { data } = await api.get("/opening-balances", { params });
        const rows = Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data)
          ? data
          : [];
        total = Number(data?.total || rows.length);
        rows.forEach((r) => {
          const amt = Number(r.amount || 0);
          if (r.type === "fee" && r.fee_head_id) {
            byHead[r.fee_head_id] = (byHead[r.fee_head_id] || 0) + amt;
          } else if (r.type === "van") vanTotal += amt;
          else if (r.type === "generic") genericTotal += amt;
        });
        page++;
      } while ((page - 1) * limit < total);

      setObByHeadId(byHead);
      setObVanTotal(vanTotal);
      setObGenericTotal(genericTotal);
    } catch (e) {
      console.error("OB fetch error:", e);
    }
  };

  // -------- Combine summary + van dues after both fetched --------
  useEffect(() => {
    if (summary.length > 0 && transportData.length > 0) {
      const allStudents = transportData.map((t) => ({
        id: t.student_id,
        pending: (t.heads || []).reduce((a, h) => a + Number(h.pending || 0), 0),
      }));
      const totalVanDue = allStudents.reduce((a, s) => a + s.pending, 0);

      // Add same total van due to all heads for display consistency
      const merged = summary.map((head) => ({
        ...head,
        vanFeeDue: totalVanDue,
      }));
      setSummary(merged);
    }
  }, [summary.length, transportData.length]);

  // -------- Grand Totals for main table --------
  const grandTotals = useMemo(() => {
    return summary.reduce(
      (acc, item) => ({
        totalDue: acc.totalDue + (item.totalDue || 0),
        totalReceived: acc.totalReceived + (item.totalReceived || 0),
        totalConcession: acc.totalConcession + (item.totalConcession || 0),
        totalRemainingDue: acc.totalRemainingDue + (item.totalRemainingDue || 0),
        vanFeeReceived: acc.vanFeeReceived + (item.vanFeeReceived || 0),
        vanFeeDue: acc.vanFeeDue + (item.vanFeeDue || 0),
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
      await Promise.all([
        fetchSessions(),
        fetchSchool(),
        fetchFeeHeadings(),
      ]);
      await fetchFeeSummary();
      await fetchTransportPending(activeSessionId);
    })();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchOpeningBalanceSummary();
      fetchTransportPending(activeSessionId);
    }
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
      amount: Number(amt || 0),
    }));

    feeRows.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    const rows = [...feeRows];
    if (obVanTotal > 0)
      rows.push({ key: "van", label: "Van (Opening Balance)", amount: obVanTotal });
    if (obGenericTotal > 0)
      rows.push({
        key: "generic",
        label: "Generic (Opening Balance)",
        amount: obGenericTotal,
      });

    setObBreakdown(rows);
  }, [summary, feeHeadings, obByHeadId, obVanTotal, obGenericTotal]);

// ======== END OF PART 2/4 ========
/// ======== PART 3/4: Modal Logic, Van Merge, and WhatsApp Data ========

  // ---------------- Modal Logic ----------------
  const handleCountClick = async (feeHeadingId, status, headingName) => {
    setSelectedFeeHeadingId(feeHeadingId);
    setSelectedStatus(status);
    setSelectedHeadingName(headingName);
    setShowModal(true);
    setLoadingDetails(true);
    setSearch("");
    setSelectedHeads(new Set([headingName]));

    try {
      const res = await api.get("/feedue-status/fee-heading-wise-students", {
        params: { feeHeadingId, status },
      });
      const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

      // unique by student id
      const uniq = [];
      const seen = new Set();
      rawData.forEach((s) => {
        const sid = s.id ?? s.admissionNumber;
        if (!seen.has(sid)) {
          seen.add(sid);
          uniq.push({ ...s, _sid: sid });
        }
      });

      // Build per-student row: academic heads (+fine) + transport heads per head
      const finalData = uniq.map((student) => {
        const sid = student.id ?? student.admissionNumber;
        const row = {
          id: sid,
          name: student.name,
          admissionNumber: student.admissionNumber,
          className: student.className,
          phone:
            student.phone ||
            student.parentPhone ||
            student.fatherPhone ||
            student.motherPhone ||
            "",
        };

        // Academic heads + fine
        (student.feeDetails || []).forEach((fd) => {
          const headName = fd.fee_heading;
          const due = Number(fd.due || 0);
          const paid = Number(fd.paid || 0);
          const concession = Number(fd.concession || 0);
          const fine = Number(fd.fineAmount || 0);
          const remaining = Number(
            fd.remaining ?? (due - (paid + concession))
          );

          row[`${headName} - Remaining`] = remaining;
          row[`${headName} - Fine`] = fine;
        });

        // Transport heads from map: per head
        const transport = transportMap?.get(Number(student.id));
        if (transport && Array.isArray(transport.heads)) {
          transport.heads.forEach((vh) => {
            const label = `${vh.fee_heading_name} (Transport)`;
            const pending = Number(vh.pending || 0);
            // Transport usually has no "fine", keep 0 (if backend adds later, handle similarly)
            row[`${label} - Remaining`] = pending;
            row[`${label} - Fine`] = 0;
          });
        }

        return row;
      });

      // ---- Column Order Fix ----
      // 1) Collect all head names appearing in rows (academic + transport)
      const allHeadsMap = new Map(); // headName -> "academic" | "transport"
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

      // 2) Academic order from /fee-headings (id asc) => names
      const academicOrder = (feeHeadings || [])
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((f) => f.fee_heading);

      // 3) Transport order from transportMap (by fee_heading_id asc across any student)
      //    We build a unique map: head_name -> min(head_id) to maintain stable ordering.
      const transportHeadOrderMap = new Map(); // name(Transport) -> min id
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
      // turn into ordered array by head_id asc
      const transportOrder = Array.from(transportHeadOrderMap.entries())
        .sort((a, b) => Number(a[1]) - Number(b[1]))
        .map(([name]) => name);

      // 4) Merge in desired order but only keep heads that actually appear in this modal
      const sortedHeadNames = [
        ...academicOrder.filter((n) => allHeadsMap.get(n) === "academic"),
        ...transportOrder.filter((n) => allHeadsMap.get(n) === "transport"),
      ];

      // Fallback in case a head exists in data but not in feeHeadings/transport maps (rare)
      if (sortedHeadNames.length !== allHeadsMap.size) {
        const remaining = Array.from(allHeadsMap.keys()).filter(
          (n) => !sortedHeadNames.includes(n)
        );
        // append remaining by alpha to keep them visible
        remaining.sort((a, b) => a.localeCompare(b));
        sortedHeadNames.push(...remaining);
      }

      setStudentDetails(finalData);
      setHeadNames(sortedHeadNames);
    } catch (err) {
      console.error("Error fetching student details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // ---------------- Filters and Totals ----------------
  const filteredDetails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return studentDetails;
    return studentDetails.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.admissionNumber || "").toLowerCase().includes(q) ||
        (s.className || "").toLowerCase().includes(q)
    );
  }, [search, studentDetails]);

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
    filteredDetails.forEach((stu) => {
      headNames.forEach((head) => {
        totals[head].remaining += Number(stu[`${head} - Remaining`] || 0);
        totals[head].fine += Number(stu[`${head} - Fine`] || 0);
      });
    });
    return totals;
  }, [filteredDetails, headNames]);

  const grandTotal = useMemo(() => {
    return Array.from(selectedHeads).reduce((sum, head) => {
      return (
        sum +
        (columnTotals[head]?.remaining || 0) +
        (columnTotals[head]?.fine || 0)
      );
    }, 0);
  }, [columnTotals, selectedHeads]);

  // ---------------- Export Excel ----------------
  const exportToExcel = () => {
    const baseCols = ["#", "Name", "Admission No", "Class"];
    const excelRows = filteredDetails.map((stu, idx) => {
      const row = {
        "#": idx + 1,
        Name: stu.name,
        "Admission No": stu.admissionNumber,
        Class: stu.className,
      };
      let overall = 0;
      headNames.forEach((head) => {
        if (!selectedHeads.has(head)) return;
        const amt = Number(stu[`${head} - Remaining`] || 0);
        const fine = Number(stu[`${head} - Fine`] || 0);
        overall += amt + fine;
        row[`${head} Amount`] = amt;
        row[`${head} Fine`] = fine;
      });
      row["Overall Total"] = overall;
      return row;
    });

    const headerCols = [
      ...baseCols,
      ...headNames.flatMap((h) =>
        selectedHeads.has(h) ? [`${h} Amount`, `${h} Fine`] : []
      ),
      "Overall Total",
    ];

    const worksheet = XLSX.utils.json_to_sheet(excelRows, { header: headerCols });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(
      blob,
      `${selectedHeadingName}_${selectedStatus}_Students.xlsx`.replace(/\s+/g, "_")
    );
  };

// ======== END OF PART 3/4 ========

// ======== PART 4/4: Main Table, Modal UI, and WhatsApp ========

  // ---------------- WhatsApp Sender ----------------
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

    const count = filteredDetails.length;

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
        students: filteredDetails
          .map((s) => {
            const included = [];
            let overall = 0;

            Array.from(selectedHeads).forEach((head) => {
              const amount = Number(s[`${head} - Remaining`] || 0);
              const fine = Number(s[`${head} - Fine`] || 0);
              if (amount <= 0 && fine <= 0) return;
              const total = amount + fine;
              overall += total;
              included.push({ head, amount, fine, total });
            });

            if (included.length === 0) return null;

            const lines = [
              `*Dear Parent/Guardian of ${s.name},*`,
              ``,
              `This is a kind reminder from *${school?.name || "Your School"}* regarding the pending fees:`,
              ``,
              `*Fee Details:*`,
              ...included.map(
                (i) =>
                  `• ${i.head} — Amount: ${currencyPlain(
                    i.amount
                  )}${i.fine > 0 ? ` | Fine: ${currencyPlain(i.fine)}` : ""}`
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

  // ---------------- Render ----------------
  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="m-0">School Fee Summary</h2>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={() => fetchFeeSummary()}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Opening Balances */}
      {obBreakdown.length > 0 && (
  <div className="mb-4">
    <h5 className="fw-bold text-primary mb-3">Opening Balances</h5>
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
                obBreakdown.reduce((a, r) => a + Number(r.amount || 0), 0)
              )}
            </td>
          </tr>
        </tbody>
      </Table>
    </div>
  </div>
)}


      {/* Summary Table */}
      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
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
                <th>Van Fee Due</th>
                <th>Van Students</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item, i) => {
                const totalStudents =
                  (item.studentsPaidFull || 0) +
                  (item.studentsPaidPartial || 0) +
                  (item.studentsPending || 0);
                return (
                  <tr key={item.id}>
                    <td>{i + 1}</td>
                    <td>{item.fee_heading}</td>
                    <td>{formatCurrency(item.totalDue)}</td>
                    <td>{formatCurrency(item.totalReceived)}</td>
                    <td>{formatCurrency(item.totalConcession)}</td>
                    <td className="text-danger">
                      {formatCurrency(item.totalRemainingDue)}
                    </td>
                    <td>
                      <span
                        className="count-chip chip-success"
                        onClick={() =>
                          handleCountClick(item.id, "full", item.fee_heading)
                        }
                      >
                        {item.studentsPaidFull}
                      </span>
                    </td>
                    <td>
                      <span
                        className="count-chip chip-warning"
                        onClick={() =>
                          handleCountClick(item.id, "partial", item.fee_heading)
                        }
                      >
                        {item.studentsPaidPartial}
                      </span>
                    </td>
                    <td>
                      <span
                        className="count-chip chip-danger"
                        onClick={() =>
                          handleCountClick(item.id, "unpaid", item.fee_heading)
                        }
                      >
                        {item.studentsPending}
                      </span>
                    </td>
                    <td>{totalStudents}</td>
                    <td>{formatCurrency(item.vanFeeReceived || 0)}</td>
                    <td className="text-danger">
                      {formatCurrency(item.vanFeeDue || 0)}
                    </td>
                    <td>{item.vanStudents || "—"}</td>
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
                <td colSpan={2}></td>
                <td></td>
                <td></td>
                <td>{formatCurrency(grandTotals.vanFeeReceived)}</td>
                <td>{formatCurrency(grandTotals.vanFeeDue)}</td>
                <td></td>
              </tr>
            </tfoot>
          </Table>
        </div>
      )}

          {/* Modal for Students */}
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
              </Modal.Title>
            </Modal.Header>
        <Modal.Body className="modal-body-fixed">

  {/* ───────────── Controls (always visible) ───────────── */}
  <div className="modal-controls">
    <InputGroup className="modal-search">
      <InputGroup.Text>Search</InputGroup.Text>
      <Form.Control
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type name or class..."
      />
    </InputGroup>

    <div className="d-flex gap-2">
      <Button variant="outline-primary" size="sm" onClick={selectAllHeads}>
        Select All
      </Button>
      <Button variant="outline-secondary" size="sm" onClick={clearAllHeads}>
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

  {/* ───────────── Scrollable table (15 rows view) ───────────── */}
  <div className="scrollable-table">
    <Table striped bordered hover className="modal-table">
      <thead>
        <tr>
          <th className="slc slc-1">#</th>
          <th className="slc slc-2">Name</th>
          <th className="slc slc-3">Admission No</th>
          <th className="slc slc-4">Class</th>
          {headNames.map((head) => (
            <th key={head} className="feehead-header">
              <div className="d-flex align-items-center justify-content-between">
                <span>{head}</span>
                <Form.Check
                  type="checkbox"
                  checked={selectedHeads.has(head)}
                  onChange={() => toggleHead(head)}
                />
              </div>
            </th>
          ))}
          <th className="sticky-overall">Overall</th>
        </tr>
      </thead>

      <tbody>
        {filteredDetails.map((stu, idx) => {
          let overall = 0;
          headNames.forEach((h) => {
            if (!selectedHeads.has(h)) return;
            const amt = Number(stu[`${h} - Remaining`] || 0);
            const fine = Number(stu[`${h} - Fine`] || 0);
            overall += amt + fine;
          });
          return (
            <tr key={idx}>
              <td className="slc slc-1">{idx + 1}</td>
              <td className="slc slc-2">{stu.name}</td>
              <td className="slc slc-3">{stu.admissionNumber}</td>
              <td className="slc slc-4">{stu.className}</td>
              {headNames.map((h) => {
                const amt = Number(stu[`${h} - Remaining`] || 0);
                const fine = Number(stu[`${h} - Fine`] || 0);
                return <td key={h}>{formatCurrency(amt + fine)}</td>;
              })}
              <td className="sticky-overall text-danger fw-bold">
                {formatCurrency(overall)}
              </td>
            </tr>
          );
        })}
      </tbody>

      {/* Sticky total row */}
      <tfoot>
        <tr className="table-total-row sticky-footer">
          <td className="slc slc-1" colSpan={4}>
            Total (All Selected)
          </td>
          {headNames.map((h) => {
            const tot =
              (columnTotals[h]?.remaining || 0) +
              (columnTotals[h]?.fine || 0);
            return <td key={h}>{formatCurrency(tot)}</td>;
          })}
          <td className="sticky-overall fw-bold text-danger">
            {formatCurrency(grandTotal)}
          </td>
        </tr>
      </tfoot>
    </Table>
  </div>
</Modal.Body>


        <Modal.Footer>
          <small className="text-muted">
            Scroll horizontally to view all fee heads.
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

// ======== END OF PART 4/4 ========
