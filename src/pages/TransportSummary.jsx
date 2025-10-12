// src/components/TransportSummary.jsx
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
import api from "../api";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Swal from "sweetalert2";
import "./SchoolFeeSummary.css"; // reuse same styles

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;
const currencyPlain = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

const TransportSummary = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [rawStudents, setRawStudents] = useState([]);
  const [headSummaries, setHeadSummaries] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedHeadingName, setSelectedHeadingName] = useState("");
  const [studentDetails, setStudentDetails] = useState([]);
  const [headNames, setHeadNames] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedHeads, setSelectedHeads] = useState(new Set());
  const [school, setSchool] = useState(null);

  /* -------------------- School Fetch -------------------- */
  const fetchSchool = async () => {
    try {
      const res = await api.get('/schools');
      if (res.data && res.data.schools && res.data.schools.length > 0) {
        setSchool(res.data.schools[0]);
      }
    } catch (error) {
      console.error('Error fetching school:', error);
    }
  };

  /* -------------------- Sessions -------------------- */
  const fetchSessions = async () => {
    try {
      const resp = await api.get("/sessions");
      const sessionsData = Array.isArray(resp.data)
        ? resp.data
        : Array.isArray(resp.data?.data)
        ? resp.data.data
        : [];
      setSessions(sessionsData);
      const active =
        (sessionsData || []).find((s) => s.is_active) || sessionsData[0];
      if (active) setActiveSessionId(active.id);
      return active?.id ?? null;
    } catch (err) {
      console.error("Error fetching sessions:", err);
      setSessions([]);
      return null;
    }
  };

  /* -------------------- Transport Pending -------------------- */
  const fetchTransportRaw = async (sessionId) => {
    setLoading(true);
    setError("");
    try {
      const params = { includeZeroPending: true };
      if (sessionId) params.session_id = sessionId;
      const resp = await api.get("/transport/pending-per-head", { params });
      const payload = resp.data;
      const data = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.rows)
        ? payload.rows
        : [];
      setRawStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching transport data:", err);
      setError("Failed to load transport summary. Try again.");
      setRawStudents([]);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- Aggregate Summary -------------------- */
  useEffect(() => {
    const map = {};
    const nameSet = new Set();

    rawStudents.forEach((stu) => {
      (stu.heads || []).forEach((h) => {
        const hid = h.fee_heading_id;
        const hname = h.fee_heading_name || `Head ${hid}`;
        nameSet.add(hname);
        if (!map[hid]) {
          map[hid] = {
            fee_heading_id: hid,
            fee_heading_name: hname,
            totalDue: 0,
            totalReceived: 0,
            totalPending: 0,
            students: [],
          };
        }
        map[hid].totalDue += Number(h.due || 0);
        map[hid].totalReceived += Number(h.received || 0);
        map[hid].totalPending += Number(h.pending || 0);
        map[hid].students.push({
          ...stu,
          due: Number(h.due || 0),
          received: Number(h.received || 0),
          pending: Number(h.pending || 0),
          phone: stu.phone || stu.fatherPhone || stu.motherPhone || null,
        });
      });
    });

    const arr = Object.values(map).map((m) => {
      const students = m.students || [];
      let fully = 0,
        partial = 0,
        unpaid = 0;
      students.forEach((s) => {
        if (s.due === 0 || s.pending === 0) fully++;
        else if (s.received === 0) unpaid++;
        else partial++;
      });

      return {
        ...m,
        studentsCount: students.length,
        studentsPaidFull: fully,
        studentsPaidPartial: partial,
        studentsPending: unpaid,
        totalDue: Number(m.totalDue?.toFixed?.(2) ?? m.totalDue),
        totalReceived: Number(m.totalReceived?.toFixed?.(2) ?? m.totalReceived),
        totalPending: Number(m.totalPending?.toFixed?.(2) ?? m.totalPending),
      };
    });

    // Sort by fee_heading_id ascending
    arr.sort((a, b) => Number(a.fee_heading_id) - Number(b.fee_heading_id));

    setHeadSummaries(arr);
    setHeadNames(arr.map(h => h.fee_heading_name));
  }, [rawStudents]);

  /* -------------------- Grand Totals for Main Table -------------------- */
  const grandTotals = useMemo(() => {
    return headSummaries.reduce(
      (acc, item) => ({
        totalDue: acc.totalDue + item.totalDue,
        totalReceived: acc.totalReceived + item.totalReceived,
        totalPending: acc.totalPending + item.totalPending,
      }),
      { totalDue: 0, totalReceived: 0, totalPending: 0 }
    );
  }, [headSummaries]);

  /* -------------------- Init -------------------- */
  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchSchool()]);
      const sid = activeSessionId;
      fetchTransportRaw(sid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // when session changed by user: refetch (activeSessionId can be null meaning all)
    fetchTransportRaw(activeSessionId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  /* -------------------- Modal Logic -------------------- */
  const handleCountClick = (feeHeadingId, status, headingName) => {
    setSelectedStatus(status);
    setSelectedHeadingName(headingName);
    setShowModal(true);
    setLoadingDetails(true);
    setSearch("");
    setSelectedHeads(new Set([headingName])); // default: only clicked head selected

    const matchingStudents = rawStudents.filter((stu) => {
      const headData = stu.heads.find(
        (h) => Number(h.fee_heading_id) === Number(feeHeadingId)
      );
      if (!headData) return false;
      const received = Number(headData.received || 0);
      const pending = Number(headData.pending || 0);
      let matches = false;
      if (status === "full") {
        matches = pending === 0;
      } else if (status === "partial") {
        matches = received > 0 && pending > 0;
      } else if (status === "unpaid") {
        matches = received === 0 && pending > 0;
      }
      return matches;
    });

    const allHeadsData = {};
    const finalData = matchingStudents.map((student) => {
      const row = {
        id: student.student_id,
        name: student.name,
        admissionNumber: student.admission_number,
        className: student.class_id ? `Class ${student.class_id}` : "",
        phone: student.phone || student.fatherPhone || student.motherPhone || "",
        routeName: student.routeName || "",
      };

      (student.heads || []).forEach((hd) => {
        const headId = hd.fee_heading_id;
        const headName = hd.fee_heading_name;
        const pending = Number(hd.pending || 0);
        row[`${headName} - Pending`] = pending;
        allHeadsData[headId] = headName;
      });

      return row;
    });

    const sortedHeadNames = Object.entries(allHeadsData)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([, name]) => name);

    setStudentDetails(finalData);
    setHeadNames(sortedHeadNames);
    setLoadingDetails(false);
  };

  const filteredDetails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return studentDetails;
    return studentDetails.filter((s) =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.admissionNumber || "").toString().toLowerCase().includes(q) ||
      (s.className || "").toLowerCase().includes(q) ||
      (s.routeName || "").toLowerCase().includes(q)
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

  // Column totals for footer
  const columnTotals = useMemo(() => {
    const totals = {};
    headNames.forEach((head) => {
      totals[head] = 0;
    });

    filteredDetails.forEach((stu) => {
      headNames.forEach((head) => {
        totals[head] += Number(stu[`${head} - Pending`] || 0);
      });
    });

    return totals;
  }, [filteredDetails, headNames]);

  // Grand total for selected heads
  const grandTotal = useMemo(() => {
    return Array.from(selectedHeads).reduce((sum, head) => {
      return sum + (columnTotals[head] || 0);
    }, 0);
  }, [columnTotals, selectedHeads]);

  /* -------------------- Export Excel -------------------- */
  const exportToExcel = () => {
    // Export ONLY selected heads + an Overall Total
    const baseCols = ["#", "Name", "Admission No", "Class", "Route"];
    const excelRows = filteredDetails.map((stu, idx) => {
      const row = {
        "#": idx + 1,
        Name: stu.name,
        "Admission No": stu.admissionNumber,
        Class: stu.className,
        Route: stu.routeName || "—",
      };
      let overall = 0;
      headNames.forEach((head) => {
        if (!selectedHeads.has(head)) return;
        const amt = Number(stu[`${head} - Pending`] || 0);
        overall += amt;
        row[`${head} Amount`] = amt;
      });
      row["Overall Total"] = overall;
      return row;
    });

    const headerCols = [
      ...baseCols,
      ...headNames.flatMap((h) => (selectedHeads.has(h) ? [`${h} Amount`] : [])),
      "Overall Total",
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
    saveAs(
      blob,
      `${selectedHeadingName}_${selectedStatus}_Students.xlsx`.replace(/\s+/g, "_")
    );
  };

  /* -------------------- WhatsApp Batch -------------------- */
  const sendWhatsAppBatch = async () => {
    if (selectedHeads.size === 0) {
      await Swal.fire({
        icon: "info",
        title: "Select Heads",
        text: "Please select at least one head to include in WhatsApp.",
        confirmButtonText: "OK",
      });
      return;
    }
    setShowModal(false);
    await new Promise((r) => setTimeout(r, 150));

    const count = filteredDetails.length;

    const confirm = await Swal.fire({
      title: "Send WhatsApp Messages?",
      html: `This will send reminders to <b>${count}</b> students for <b>${selectedHeads.size}</b> head(s).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Send Now",
      cancelButtonText: "Cancel",
      allowOutsideClick: () => !Swal.isLoading(),
    });
    if (!confirm.isConfirmed) return;

    try {
      Swal.showLoading();

      const payload = {
        students: filteredDetails
          .map((s) => {
            // Build included heads: only selected AND amount > 0
            const included = [];
            let overall = 0;

            Array.from(selectedHeads).forEach((head) => {
              const amount = Number(s[`${head} - Pending`] || 0);
              if (amount <= 0) return; // skip heads with zero amount

              const total = amount;
              overall += total;

              included.push({ head, amount, total });
            });

            // If no heads qualify, skip this student
            if (included.length === 0) return null;

            // Compose message (professional template)
            const lines = [
              `*Dear Parent/Guardian of ${s.name},*`,
              ``,
              `This is a kind reminder from *${school?.name || 'Your School'}* regarding the pending transport charges:`,
              ``,
              `*Fee Details:*`,
              ...included.map(
                (i) => `• ${i.head} — Amount: ${currencyPlain(i.amount)}`
              ),
              ``,
              `*Total Pending:* *${currencyPlain(overall)}*`,
              ``,
              `Student: ${s.name}`,
              s.className ? `Class: ${s.className}` : null,
              s.admissionNumber ? `Admission No: ${s.admissionNumber}` : null,
              s.routeName ? `Route: ${s.routeName}` : null,
              ``,
              `We kindly request you to clear the pending dues at the earliest.`,
              `If you have already made the payment, please ignore this message.`,
              ``,
              `*Thank you for your prompt attention.*`,
            ].filter(Boolean);

            const message = lines.join("\n");

            return {
              id: s.id ?? s.admissionNumber,
              name: s.name,
              phone: "919417873297", // test number
              admissionNumber: s.admissionNumber,
              className: s.className,
              feeHeads: included.map((i) => i.head),

              // Numeric breakdown for server
              breakdown: included,
              overallTotal: overall,

              // Prebuilt message
              message,
            };
          })
          .filter(Boolean), // remove students with no qualifying heads
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
            ? `Sent: <b>${successCount}</b> &nbsp;|&nbsp; Failed: <b>${failedCount}</b>.<br/>All messages targeted to <b>9417873297</b>.`
            : `All <b>${sent.length}</b> messages sent.`,
          icon: failedCount ? "warning" : "success",
          confirmButtonText: "Done",
          showCancelButton: false,
        });
      } else {
        await Swal.fire({
          title: "Error",
          html: "Message sending failed from the server.",
          icon: "error",
          confirmButtonText: "OK",
          showCancelButton: false,
        });
      }
    } catch (err) {
      console.error("WA test error:", err);
      Swal.hideLoading();
      await Swal.fire({
        title: "Error",
        html: `Unable to send WhatsApp messages.<br/><small>${err?.response?.data?.message ||
          err?.message ||
          "Unknown error"}</small>`,
        icon: "error",
        confirmButtonText: "OK",
        showCancelButton: false,
      });
    }
  };

  /* -------------------- Render -------------------- */
  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
        <h2 className="m-0">Transport (Van) Summary</h2>
        <div className="d-flex gap-2 align-items-center">
          <Form.Select
            value={activeSessionId ?? ""}
            onChange={(e) =>
              setActiveSessionId(e.target.value ? Number(e.target.value) : null)
            }
            style={{ minWidth: 220 }}
            size="sm"
          >
            <option value="">Select Session</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.session_name || s.name}
              </option>
            ))}
          </Form.Select>

          <Button
            variant="outline-secondary"
            onClick={() => fetchTransportRaw(activeSessionId)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      ) : error ? (
        <Alert variant="danger">{error}</Alert>
      ) : headSummaries.length === 0 ? (
        <Alert variant="info">No transport data found.</Alert>
      ) : (
        <div className="overflow-x-auto">
          <Table striped bordered hover className="table-sticky">
            <thead className="sticky-top bg-light">
              <tr>
                <th>#</th>
                <th>Fee Heading</th>
                <th>Total Due</th>
                <th>Total Received</th>
                <th>Pending</th>
                <th>Fully Paid</th>
                <th>Partially Paid</th>
                <th>Unpaid</th>
                <th>Total Students</th>
              </tr>
            </thead>
            <tbody>
              {headSummaries.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td className="fw-semibold">{item.fee_heading_name}</td>
                  <td>{formatCurrency(item.totalDue)}</td>
                  <td>{formatCurrency(item.totalReceived)}</td>
                  <td
                    className={
                      Number(item.totalPending) > 0
                        ? "text-danger-soft"
                        : "text-success-soft"
                    }
                  >
                    {formatCurrency(item.totalPending)}
                  </td>

                  <td className="click-chip-cell">
                    <span
                      role="button"
                      className="count-chip chip-success"
                      title="View fully paid students"
                      onClick={() =>
                        handleCountClick(
                          item.fee_heading_id,
                          "full",
                          item.fee_heading_name
                        )
                      }
                    >
                      {item.studentsPaidFull} Fully Paid
                    </span>
                  </td>

                  <td className="click-chip-cell">
                    <span
                      role="button"
                      className="count-chip chip-warning"
                      title="View partially paid students"
                      onClick={() =>
                        handleCountClick(
                          item.fee_heading_id,
                          "partial",
                          item.fee_heading_name
                        )
                      }
                    >
                      {item.studentsPaidPartial} Partial
                    </span>
                  </td>

                  <td className="click-chip-cell">
                    <span
                      role="button"
                      className="count-chip chip-danger"
                      title="View unpaid students"
                      onClick={() =>
                        handleCountClick(
                          item.fee_heading_id,
                          "unpaid",
                          item.fee_heading_name
                        )
                      }
                    >
                      {item.studentsPending} Unpaid
                    </span>
                  </td>

                  <td>{item.studentsCount}</td>
                </tr>
              ))}
            </tbody>
            {/* Footer for grand totals */}
            <tfoot>
              <tr className="table-total-row fw-bold">
                <td colSpan={2}>Grand Total</td>
                <td className="text-end">{formatCurrency(grandTotals.totalDue)}</td>
                <td className="text-end">{formatCurrency(grandTotals.totalReceived)}</td>
                <td className={`text-end ${grandTotals.totalPending > 0 ? 'text-danger-soft' : 'text-success-soft'}`}>
                  {formatCurrency(grandTotals.totalPending)}
                </td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </Table>
        </div>
      )}

      {/* Modal */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="xl"
        dialogClassName="modal-xxxl"
        fullscreen="md-down"
        centered
      >
        <Modal.Header closeButton className="modal-header-sticky">
          <div className="d-flex flex-column">
            <Modal.Title className="d-flex align-items-center gap-2 flex-wrap">
              <span>Students — {selectedStatus?.toUpperCase()}</span>
              {selectedHeadingName && (
                <Badge bg="info" text="dark">
                  Head: {selectedHeadingName}
                </Badge>
              )}
            </Modal.Title>
            <small className="text-muted">
              Header & first columns are pinned. Tick fee-heads to include in
              WhatsApp & overall total.
            </small>
          </div>
        </Modal.Header>

        <Modal.Body className="modal-body-fixed">
          {/* Controls */}
          <div className="modal-controls">
            <InputGroup className="modal-search">
              <InputGroup.Text>Search</InputGroup.Text>
              <Form.Control
                placeholder="Type name, admission no, or class…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </InputGroup>

            <div className="d-flex align-items-center gap-2">
              <Button variant="outline-primary" size="sm" onClick={selectAllHeads}>
                Select All
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={clearAllHeads}>
                Clear
              </Button>
              <Button variant="success" onClick={exportToExcel}>
                Export to Excel
              </Button>
              <Button
                variant="success"
                onClick={sendWhatsAppBatch}
              >
                WhatsApp
              </Button>
              <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
                Close
              </Button>
            </div>
          </div>

          {loadingDetails ? (
            <div className="py-4 text-center">
              <Spinner animation="border" />
            </div>
          ) : studentDetails.length === 0 ? (
            <Alert variant="info" className="mt-3">
              No students found for this status.
            </Alert>
          ) : (
            <div className="table-container">
              <Table
                striped
                bordered
                hover
                className="modal-table sticky-left-cols"
              >
                <thead>
                  {/* Row 1: grouped heads with checkbox (colSpan=1 for Amount) */}
                  <tr>
                    <th className="slc slc-1 group-top">#</th>
                    <th className="slc slc-2 group-top">Name</th>
                    <th className="slc slc-3 group-top">Admission No</th>
                    <th className="slc slc-4 group-top">Class</th>
                    <th className="slc slc-5 group-top">Route</th>
                    {headNames.map((head) => (
                      <th
                        key={`group-${head}`}
                        colSpan={1}
                        className="feehead-group-header"
                      >
                        <div className="d-flex align-items-center justify-content-between">
                          <span className="fw-semibold">{head}</span>
                          <Form.Check
                            type="checkbox"
                            className="ms-2"
                            checked={selectedHeads.has(head)}
                            onChange={() => toggleHead(head)}
                            title="Include this head in WhatsApp & overall"
                          />
                        </div>
                      </th>
                    ))}
                    <th className="overall-top">Overall Total</th>
                  </tr>

                  {/* Row 2: sub headers */}
                  <tr>
                    <th className="slc slc-1 sub-top">#</th>
                    <th className="slc slc-2 sub-top">Name</th>
                    <th className="slc slc-3 sub-top">Admission No</th>
                    <th className="slc slc-4 sub-top">Class</th>
                    <th className="slc slc-5 sub-top">Route</th>
                    {headNames.map((head) => (
                      <th key={`sub-${head}`}>Amount</th>
                    ))}
                    <th>₹</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDetails.map((stu, idx) => {
                    let rowOverall = 0;
                    headNames.forEach((h) => {
                      if (!selectedHeads.has(h)) return;
                      const a = Number(stu[`${h} - Pending`] || 0);
                      rowOverall += a;
                    });

                    return (
                      <tr key={stu.id ?? `${idx}-${stu.admissionNumber}`}>
                        <td className="slc slc-1">{idx + 1}</td>
                        <td className="slc slc-2 fw-medium">{stu.name}</td>
                        <td className="slc slc-3">{stu.admissionNumber}</td>
                        <td className="slc slc-4">{stu.className}</td>
                        <td className="slc slc-5">{stu.routeName || "—"}</td>

                        {headNames.map((head, i) => {
                          const amt = Number(stu[`${head} - Pending`] || 0);

                          const amtCls =
                            amt === 0
                              ? "due-zero"
                              : "due-partial"; // amount > 0

                          return (
                            <td key={`${stu.id || idx}-${head}-${i}`} className={amtCls}>
                              {formatCurrency(amt)}
                            </td>
                          );
                        })}

                        <td
                          className={
                            rowOverall > 0
                              ? "text-danger fw-bold sticky-overall"
                              : "text-success fw-semibold sticky-overall"
                          }
                        >
                          {formatCurrency(rowOverall)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer for vertical totals */}
                <tfoot>
                  <tr className="table-total-row fw-bold">
                    <th className="slc slc-1">Total</th>
                    <th className="slc slc-2"></th>
                    <th className="slc slc-3"></th>
                    <th className="slc slc-4"></th>
                    <th className="slc slc-5"></th>
                    {headNames.map((head) => (
                      <th key={`total-${head}`} className="text-end">
                        {formatCurrency(columnTotals[head])}
                      </th>
                    ))}
                    <th className="text-end sticky-overall text-danger fw-bold">
                      {formatCurrency(grandTotal)}
                    </th>
                  </tr>
                </tfoot>
              </Table>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="justify-content-between">
          <small className="text-muted">
            Horizontal scroll supported; left columns & overall total stay pinned
            with solid background.
          </small>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default TransportSummary;