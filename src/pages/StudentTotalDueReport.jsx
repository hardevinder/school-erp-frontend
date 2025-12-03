// src/pages/StudentTotalDueReport.jsx

// ======== PART 1/4: Imports, Helpers, and Basic Setup ========

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
} from "react-bootstrap";
import api from "../api";
import "./SchoolFeeSummary.css"; // reuse styles
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ---------- Helpers ----------
const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

// Concurrency helper for async loops (same as your file)
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

// 🔹 Try to extract a usable due-date string from any fee/transport object
const extractDueDate = (obj) => {
  if (!obj) return null;

  let raw =
    obj.due_date ||
    obj.dueDate ||
    obj.dueDateString ||
    obj.installment_due_date ||
    obj.due_date_formatted ||
    obj.dueDateFormatted ||
    null;

  // If still not found, try from nested installments array (very common pattern)
  if (!raw && Array.isArray(obj.installments) && obj.installments.length) {
    // Prefer installment(s) which still have some pending/remaining
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
      const d = new Date(candidate);
      if (Number.isNaN(d.getTime())) return;

      if (bestTime === null || d.getTime() < bestTime) {
        bestTime = d.getTime();
        bestDateStr = candidate;
      }
    });

    if (bestDateStr) raw = bestDateStr;
  }

  if (!raw) return null;

  const s = String(raw);
  // If full timestamp, trim to YYYY-MM-DD
  return s.length > 10 ? s.slice(0, 10) : s;
};

// Head-level overdue check
const isHeadOverdue = (head) => {
  const remaining = Number(head.remaining || 0) || 0;
  const fine = Number(head.fine || 0) || 0;

  // 🔹 Opening Balance -> treat as overdue if anything pending
  if (head.isOpeningBalance) {
    return remaining > 0;
  }

  if (fine > 0 && remaining > 0) return true;

  const dueStr = head.dueDate;
  if (!dueStr) return false;

  const due = new Date(dueStr);
  if (Number.isNaN(due.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  return remaining > 0 && due <= today;
};

// ================= Component =================
const StudentTotalDueReport = () => {
  const [school, setSchool] = useState(null);

  // Session + Active session
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Fee headings (academic)
  const [feeHeadings, setFeeHeadings] = useState([]);

  // Transport
  const [transportData, setTransportData] = useState([]);
  const [transportMap, setTransportMap] = useState(new Map());

  // Student-wise aggregated data
  const [students, setStudents] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Filters
  const [classFilter, setClassFilter] = useState("all"); // "all" or "Class / Section"
  const [pendingFilter, setPendingFilter] = useState("all"); // "all" | "pending" | "clear"

  // ---------------- Fetchers (same style as your file) ----------------
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

  // -------- Transport pending per head (same as your file) --------
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

  // 🔹 Opening Balance outstanding per student+session (same logic style as Transactions)
  const fetchOpeningBalanceOutstanding = async (studentId, sessionId) => {
    if (!studentId || !sessionId) return 0;

    // 1) Try /opening-balances/outstanding
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
      console.warn("opening-balances/outstanding failed:", e?.message || e);
    }

    // 2) Fallback: /opening-balances and sum
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

      const total = rows.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      );
      return Math.max(0, total);
    } catch (e) {
      console.warn("opening-balances fallback failed:", e?.message || e);
      return 0;
    }
  };

  // ======== PART 2/4: Build Student-Wise Aggregated Report ========

  const buildStudentReport = async () => {
    setLoading(true);
    setError("");

    try {
      const statuses = ["full", "partial", "unpaid"];

      // combinations of (feeHeadingId, status) using SAME API as your modal
      const combos = [];
      (feeHeadings || []).forEach((fh) => {
        statuses.forEach((status) => {
          combos.push({ feeHeadingId: fh.id, status });
        });
      });

      const studentMap = new Map();

      // Worker: call /feedue-status/fee-heading-wise-students (SAME API)
      const worker = async ({ feeHeadingId, status }) => {
        const res = await api.get("/feedue-status/fee-heading-wise-students", {
          params: { feeHeadingId, status, session_id: activeSessionId || undefined },
        });

        const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

        rawData.forEach((student) => {
          // DB primary key (student_id) agar mile
          const pk =
            student.student_id ??
            student.Student_ID ??
            student.id ??
            null;

          const sid = pk ?? student.admissionNumber;
          if (!sid) return;

          if (!studentMap.has(sid)) {
            studentMap.set(sid, {
              id: sid, // UI key
              studentId: pk, // 🔹 real DB id for opening balance
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
              heads: [], // will hold both academic & transport & OB
            });
          } else {
            const aggExisting = studentMap.get(sid);
            if (!aggExisting.studentId && pk) {
              aggExisting.studentId = pk;
            }
          }

          const agg = studentMap.get(sid);

          // Merge academic fee heads
          (student.feeDetails || []).forEach((fd) => {
            const headName = fd.fee_heading;
            if (!headName) return;

            let head = agg.heads.find(
              (h) => h.name === headName && !h.isTransport
            );
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
              };
              agg.heads.push(head);
            }

            const due = Number(fd.due || 0);
            const paid = Number(fd.paid || 0);
            const concession = Number(fd.concession || 0);
            const fine = Number(fd.fineAmount || 0);
            const remaining = Number(
              fd.remaining ?? (due - (paid + concession))
            );

            head.due = due;
            head.paid = paid;
            head.concession = concession;
            head.remaining = remaining;
            head.fine = fine;

            const dueDate = extractDueDate(fd);
            if (dueDate) {
              head.dueDate = dueDate;
            }
          });
        });
      };

      if (combos.length > 0) {
        await withConcurrency(combos, 4, worker);
      }

      // Merge Transport for each student (van heads)
      if (transportMap && typeof transportMap.forEach === "function") {
        transportMap.forEach((val, stuId) => {
          if (!studentMap.has(stuId)) {
            // create minimal row if only in transport
            studentMap.set(stuId, {
              id: stuId,
              studentId: stuId, // assume DB id
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
            if (!aggExisting.studentId) {
              aggExisting.studentId = stuId;
            }
          }

          const agg = studentMap.get(stuId);

          (val.heads || []).forEach((vh) => {
            const baseHeadName = vh.fee_heading_name; // e.g. "APR-JUN"
            const headName = `${baseHeadName} (Transport)`; // display name

            // Check if transport head already exists
            let transportIndex = agg.heads.findIndex(
              (h) => h.name === headName && h.isTransport
            );
            let head;

            if (transportIndex === -1) {
              head = {
                name: headName,
                isTransport: true,
                due: 0,
                paid: 0,
                concession: 0,
                remaining: 0,
                fine: 0,
                dueDate: null,
              };

              // 🔹 Find matching academic head position
              const academicIndex = agg.heads.findIndex(
                (h) => !h.isTransport && h.name === baseHeadName
              );

              if (academicIndex >= 0) {
                // Insert transport head just after its academic head
                agg.heads.splice(academicIndex + 1, 0, head);
              } else {
                // If no matching academic head, push at the end
                agg.heads.push(head);
              }
            } else {
              head = agg.heads[transportIndex];
            }

            // Update transport remaining & fine
            head.remaining = Number(vh.pending || 0);
            head.fine = Number(vh.fine || vh.fineAmount || 0);

            // 1️⃣ Try to get due date directly from transport head (if backend sends it)
            let dueDate = extractDueDate(vh);

            // 2️⃣ If not present, copy from matching academic head
            if (!dueDate) {
              const academicHead = agg.heads.find(
                (h) =>
                  !h.isTransport &&
                  h.name === baseHeadName &&
                  h.dueDate
              );
              if (academicHead) {
                dueDate = academicHead.dueDate;
              }
            }

            if (dueDate) {
              head.dueDate = dueDate;
            }
          });
        });
      }

      // 🔹 After academic + transport merge -> inject Opening Balance as a separate head
      if (activeSessionId) {
        const studentList = Array.from(studentMap.values());

        await withConcurrency(studentList, 8, async (s) => {
          // Prefer explicit studentId; fallback numeric s.id
          const pk =
            s.studentId ??
            (Number(s.id) && !Number.isNaN(Number(s.id))
              ? Number(s.id)
              : null);

          if (!pk) return; // cannot fetch OB without DB id

          const ob = await fetchOpeningBalanceOutstanding(
            pk,
            activeSessionId
          );

          if (ob > 0) {
            if (!Array.isArray(s.heads)) s.heads = [];
            s.heads.push({
              name: "Previous Balance",
              isTransport: false,
              isOpeningBalance: true, // 🔹 mark specially
              due: ob,
              paid: 0,
              concession: 0,
              remaining: ob,
              fine: 0,
              dueDate: null, // handled via isOpeningBalance in isHeadOverdue
            });
          }
        });
      }

      // Convert studentMap -> array and compute totals
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

        return {
          ...s,
          totalDueAllTime,
          totalDueTillDate,
        };
      });

      // Sort by class then name
      studentsArr.sort((a, b) => {
        const aKey = `${a.className || ""} ${a.name || ""}`;
        const bKey = `${b.className || ""} ${b.name || ""}`;
        return aKey.localeCompare(bKey, "en");
      });

      setStudents(studentsArr);
    } catch (err) {
      console.error("Student report build error:", err);
      setError("Failed to load student-wise due report.");
    } finally {
      setLoading(false);
    }
  };

  // ======== PART 3/4: Effects & Filters ========

  // Initial: load sessions + school
  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchSchool()]);
    })();
  }, []);

  // When session changes: load fee headings + transport
  useEffect(() => {
    if (!activeSessionId) return;

    (async () => {
      await fetchFeeHeadings();
      await fetchTransportPending(activeSessionId);
    })();
  }, [activeSessionId]);

  // When headings or transport map ready, build combined student report
  useEffect(() => {
    if (!feeHeadings.length) return;
    buildStudentReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeHeadings, transportMap]);

  // Build class dropdown options
  const classOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const classSection = s.sectionName
        ? `${s.className} / ${s.sectionName}`
        : s.className;
      if (classSection) set.add(classSection);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  // Stats for header badges
  const stats = useMemo(() => {
    let pending = 0;
    let clear = 0;
    students.forEach((s) => {
      const tt = Number(s.totalDueTillDate || 0);
      if (tt > 0) pending++;
      else clear++;
    });
    return {
      total: students.length,
      pending,
      clear,
    };
  }, [students]);

  // Filtered students list (Search + Class Filter + Pending Filter)
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students.filter((s) => {
      const totalTillDate = Number(s.totalDueTillDate || 0);

      // 1) Search by Name / Admission No
      if (q) {
        const matchesName = (s.name || "").toLowerCase().includes(q);
        const matchesAdm = (s.admissionNumber || "")
          .toLowerCase()
          .includes(q);
        if (!matchesName && !matchesAdm) return false;
      }

      // 2) Class filter
      if (classFilter !== "all") {
        const classSection = s.sectionName
          ? `${s.className} / ${s.sectionName}`
          : s.className;
        if (classSection !== classFilter) return false;
      }

      // 3) Pending filter
      if (pendingFilter === "pending" && totalTillDate <= 0) return false;
      if (pendingFilter === "clear" && totalTillDate !== 0) return false;

      return true;
    });
  }, [students, search, classFilter, pendingFilter]);

  // Grand totals
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

  // ---- Excel Export (Summary + Heads detail) ----
  const exportToExcel = () => {
    if (!filteredStudents.length) return;

    // Summary sheet
    const summaryRows = filteredStudents.map((stu, idx) => {
      const classSection = stu.sectionName
        ? `${stu.className} / ${stu.sectionName}`
        : stu.className;

      return {
        "#": idx + 1,
        Name: stu.name,
        "Admission No": stu.admissionNumber,
        "Class / Section": classSection,
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

    // Detailed heads sheet
    const headRows = [];
    filteredStudents.forEach((stu) => {
      const classSection = stu.sectionName
        ? `${stu.className} / ${stu.sectionName}`
        : stu.className;

      (stu.heads || []).forEach((h) => {
        const overdue = isHeadOverdue(h);
        const remaining = Number(h.remaining || 0);
        const fine = Number(h.fine || 0);
        const headDueTillDate = overdue ? remaining + fine : 0;

        headRows.push({
          "Student Name": stu.name,
          "Admission No": stu.admissionNumber,
          "Class / Section": classSection,
          "Fee Head": h.name,
          "Is Transport": h.isTransport ? "Yes" : "No",
          Due: Number(h.due || 0),
          Paid: Number(h.paid || 0),
          Concession: Number(h.concession || 0),
          Remaining: remaining,
          Fine: fine,
          "Due Till Date (Head)": headDueTillDate,
          Status: overdue
            ? "Overdue"
            : remaining > 0
            ? "Upcoming"
            : "Cleared",
          "Due Date": h.dueDate || "",
        });
      });
    });

    if (headRows.length) {
      const wsHeads = XLSX.utils.json_to_sheet(headRows);
      XLSX.utils.book_append_sheet(wb, wsHeads, "Head Details");
    }

    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });

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

  // ======== PART 4/4: Render UI ========

  return (
    <Container className="mt-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div>
          <h2 className="m-0 text-primary">Student Wise Total Due (Till Date)</h2>
          {school?.name && (
            <small className="text-muted">School: {school.name}</small>
          )}
        </div>
      </div>

      {/* Filters + Stats Card */}
      <div className="mb-3 p-3 rounded border bg-white shadow-sm">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          {/* Stats + Legend */}
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
            <div className="small text-muted">
              <span className="me-3">
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    backgroundColor: "#f4fff4",
                    borderRadius: 2,
                    border: "1px solid #28a745",
                    marginRight: 4,
                  }}
                ></span>
                Zero Due Till Date
              </span>
              <span>
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    backgroundColor: "#fff5f5",
                    borderRadius: 2,
                    border: "1px solid #dc3545",
                    marginRight: 4,
                  }}
                ></span>
                Pending Till Date
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            {/* Search Name / Admission No */}
            <InputGroup size="sm" style={{ minWidth: 240 }}>
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Name / Admission No..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>

            {/* Class Filter */}
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

            {/* Pending Filter */}
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
            >
              Refresh
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={exportToExcel}
            >
              Excel
            </Button>
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
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((stu, index) => {
                const isOpen = expandedIds.has(stu.id);
                const classSection = stu.sectionName
                  ? `${stu.className} / ${stu.sectionName}`
                  : stu.className;

                const hasPending = Number(stu.totalDueTillDate || 0) > 0;

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
                      <td>{classSection}</td>
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
                          onClick={() => toggleExpand(stu.id)}
                        >
                          {isOpen ? "Hide" : "View"}
                        </Button>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr className="bg-body-tertiary">
                        <td colSpan={8}>
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
                                  <th className="text-end">
                                    Remaining (All Time)
                                  </th>
                                  <th className="text-end">Fine</th>
                                  <th className="text-end">
                                    Due Till Date (This Head)
                                  </th>
                                  <th style={{ width: "110px" }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stu.heads.map((h, idx) => {
                                  const overdue = isHeadOverdue(h);
                                  const remaining = Number(h.remaining || 0);
                                  const fine = Number(h.fine || 0);
                                  const headDueTillDate = overdue
                                    ? remaining + fine
                                    : 0;

                                  return (
                                    <tr key={idx}>
                                      <td>{h.name}</td>
                                      <td>{h.dueDate || "—"}</td>
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
                  <td colSpan={8} className="text-center text-muted py-3">
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
                <td></td>
              </tr>
            </tfoot>
          </Table>
        </div>
      )}
    </Container>
  );
};

export default StudentTotalDueReport;

// ======== END OF FILE ========
