// SchoolFeeSummary.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Table, Container, Spinner, Alert, Button, Modal, Form, InputGroup, Badge } from 'react-bootstrap';
import { pdf } from '@react-pdf/renderer';
import PdfSchoolFeeSummary from './PdfSchoolFeeSummary';
import api from '../api';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import './SchoolFeeSummary.css';

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const currencyPlain = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/* ---------------- Helpers ---------------- */

const fetchFineEligibility = async (studentId) => {
  try {
    const res = await api.get(`/transactions/fine-eligibility/${studentId}`);
    return res.data?.data || {};
  } catch (e) {
    console.error('Error fetching fine eligibility:', e);
    return {};
  }
};

const fetchStudentFeeDetails = async (studentId) => {
  try {
    const res = await api.get(`/students/${studentId}/fee-details`);
    return res?.data?.feeDetails || [];
  } catch (e) {
    console.error('Error fetching student fee-details:', e);
    return [];
  }
};

const withConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let idx = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
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
  const [error, setError] = useState('');
  const [school, setSchool] = useState(null);

  // Sessions + active session
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);

  // Fee headings (source of truth for id -> name)
  const [feeHeadings, setFeeHeadings] = useState([]);

  // OB totals/state
  const [obByHeadId, setObByHeadId] = useState({});  // { fee_head_id: total } for type='fee'
  const [obVanTotal, setObVanTotal] = useState(0);   // type='van'
  const [obGenericTotal, setObGenericTotal] = useState(0); // type='generic'
  const [obBreakdown, setObBreakdown] = useState([]); // rows for the mini table

  const [selectedFeeHeadingId, setSelectedFeeHeadingId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedHeadingName, setSelectedHeadingName] = useState('');

  const [studentDetails, setStudentDetails] = useState([]);
  const [headNames, setHeadNames] = useState([]); // list of fee head names (for grouped header)
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedHeads, setSelectedHeads] = useState(new Set());

  const fetchFeeSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/feedue/school-fee-summary');
      const sortedSummary = (res.data || []).sort((a, b) => Number(a.id) - Number(b.id));
      setSummary(sortedSummary);
    } catch (err) {
      console.error('Error fetching summary:', err);
      setError('Failed to load fee summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchool = async () => {
    try {
      const res = await api.get('/schools');
      if (res.data?.schools && res.data.schools.length > 0) setSchool(res.data.schools[0]);
    } catch (error) {
      console.error('Error fetching school:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await api.get('/sessions');
      setSessions(data || []);
      const active = (data || []).find((s) => s.is_active) || (data && data[0]);
      if (active) setActiveSessionId(active.id);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  // Fee headings for mapping id -> name
  const fetchFeeHeadings = async () => {
    try {
      const { data } = await api.get('/fee-headings');
      setFeeHeadings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching fee headings:', err);
      setFeeHeadings([]);
    }
  };

  // Opening Balance aggregation (client-side, paged)
  const fetchOpeningBalanceSummary = async () => {
    try {
      const limit = 500;
      let page = 1;
      let total = 0;

      const byHead = {};
      let vanTotal = 0;
      let genericTotal = 0;

      do {
        const params = {
          page,
          limit,
          session_id: activeSessionId || undefined, // target session
        };
        const { data } = await api.get('/opening-balances', { params });

        const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        total = Number(data?.total || rows.length);

        rows.forEach((r) => {
          const amt = Number(r.amount || 0);
          if (r.type === 'fee' && r.fee_head_id) {
            byHead[r.fee_head_id] = (byHead[r.fee_head_id] || 0) + amt;
          } else if (r.type === 'van') {
            vanTotal += amt;
          } else if (r.type === 'generic') {
            genericTotal += amt;
          }
        });

        page += 1;
      } while ((page - 1) * limit < total);

      setObByHeadId(byHead);
      setObVanTotal(vanTotal);
      setObGenericTotal(genericTotal);
    } catch (err) {
      console.error('Error fetching opening balances:', err);
      setObByHeadId({});
      setObVanTotal(0);
      setObGenericTotal(0);
    }
  };

  const generatePDF = async () => {
    const blob = await pdf(<PdfSchoolFeeSummary school={school} summary={summary} />).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  /* -------------------- Grand Totals for Main Table -------------------- */
  const grandTotals = useMemo(() => {
    return summary.reduce(
      (acc, item) => ({
        totalDue: acc.totalDue + (item.totalDue || 0),
        totalReceived: acc.totalReceived + (item.totalReceived || 0),
        totalConcession: acc.totalConcession + (item.totalConcession || 0),
        totalRemainingDue: acc.totalRemainingDue + (item.totalRemainingDue || 0),
        vanFeeReceived: acc.vanFeeReceived + (item.vanFeeReceived || 0),
      }),
      { totalDue: 0, totalReceived: 0, totalConcession: 0, totalRemainingDue: 0, vanFeeReceived: 0 }
    );
  }, [summary]);

  const handleCountClick = async (feeHeadingId, status, headingName) => {
    setSelectedFeeHeadingId(feeHeadingId);
    setSelectedStatus(status);
    setSelectedHeadingName(headingName);
    setShowModal(true);
    setLoadingDetails(true);
    setSearch('');
    setSelectedHeads(new Set([headingName])); // default: only clicked head selected

    try {
      const res = await api.get('/feedue-status/fee-heading-wise-students', {
        params: { feeHeadingId, status },
      });
      const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

      const uniq = [];
      const seen = new Set();
      rawData.forEach((s) => {
        const sid = s.id ?? s.admissionNumber;
        if (!seen.has(sid)) {
          seen.add(sid);
          uniq.push({ ...s, _sid: sid });
        }
      });

      const eligibilityCache = new Map();
      const feeDetailsCache = new Map();

      await withConcurrency(uniq, 5, async (s) => {
        const [elig, fd] = await Promise.all([
          fetchFineEligibility(s._sid),
          fetchStudentFeeDetails(s._sid),
        ]);
        eligibilityCache.set(s._sid, elig || {});
        feeDetailsCache.set(s._sid, fd || []);
      });

      const allHeadsData = {};
      const finalData = rawData.map((student) => {
        const sid = student.id ?? student.admissionNumber;
        const eligMap = eligibilityCache.get(sid) || {};
        const fullFeeDetails = feeDetailsCache.get(sid) || [];

        const row = {
          id: sid,
          name: student.name,
          admissionNumber: student.admissionNumber,
          className: student.className,
          phone: student.phone || student.parentPhone || student.fatherPhone || '',
        };

        (student.feeDetails || []).forEach((fd) => {
          const headName = fd.fee_heading;
          const headId = fd.fee_heading_id ?? fullFeeDetails.find(d => d.fee_heading === headName)?.fee_heading_id;

          const due = Number(fd.due || 0);
          const paid = Number(fd.paid || 0);
          const concession = Number(fd.concession || 0);
          const remaining = Number(fd.remaining ?? (due - (paid + concession)));

          const match = fullFeeDetails.find(
            (d) =>
              String(d.fee_heading_id) === String(headId) ||
              d.fee_heading === headName
          );
          const originalFine = Number(match?.fineAmount || 0);

          const headKey = String(match?.fee_heading_id ?? headId ?? '');
          let eligible = true;
          if (headKey && Object.prototype.hasOwnProperty.call(eligMap, headKey)) {
            const val = eligMap[headKey];
            eligible = (val === true || val === 'true' || val === 1 || val === '1');
          }
          const fine = eligible ? originalFine : 0;

          row[`${headName} - Remaining`] = remaining;
          row[`${headName} - Fine`] = fine;

          if (headId) allHeadsData[String(headId)] = headName;
        });

        return row;
      });

      const sortedHeadNames = Object.entries(allHeadsData)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([, name]) => name);

      setStudentDetails(finalData);
      setHeadNames(sortedHeadNames);
    } catch (err) {
      console.error('Error fetching student details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredDetails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return studentDetails;
    return studentDetails.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.admissionNumber || '').toString().toLowerCase().includes(q) ||
      (s.className || '').toLowerCase().includes(q)
    );
  }, [search, studentDetails]);

  const toggleHead = (head) => {
    setSelectedHeads(prev => {
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

  // Grand total for selected heads
  const grandTotal = useMemo(() => {
    return Array.from(selectedHeads).reduce((sum, head) => {
      return sum + (columnTotals[head]?.remaining || 0) + (columnTotals[head]?.fine || 0);
    }, 0);
  }, [columnTotals, selectedHeads]);

  const exportToExcel = () => {
    // Export ONLY selected heads + an Overall Total
    const baseCols = ['#', 'Name', 'Admission No', 'Class'];
    const excelRows = filteredDetails.map((stu, idx) => {
      const row = {
        '#': idx + 1,
        'Name': stu.name,
        'Admission No': stu.admissionNumber,
        'Class': stu.className,
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
      row['Overall Total'] = overall;
      return row;
    });

    const headerCols = [
      ...baseCols,
      ...headNames.flatMap(h => selectedHeads.has(h) ? [`${h} Amount`, `${h} Fine`] : []),
      'Overall Total',
    ];

    const worksheet = XLSX.utils.json_to_sheet(excelRows, { header: headerCols });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${selectedHeadingName}_${selectedStatus}_Students.xlsx`.replace(/\s+/g, '_'));
  };

  // INITIAL LOAD
  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchSchool(), fetchFeeHeadings()]);
      await fetchFeeSummary();
    })();
  }, []);

  // When active session is known, fetch OB aggregation
  useEffect(() => {
    if (activeSessionId) {
      fetchOpeningBalanceSummary();
    }
  }, [activeSessionId]);

  // Build display rows for the OB mini table whenever data changes
  useEffect(() => {
    // Prefer mapping from /fee-headings (most reliable)
    const fromFeeHeadings = Object.fromEntries(
      (feeHeadings || []).map((fh) => [String(fh.id), fh.fee_heading])
    );
    // Fallback to names present in summary (in case some heads appear only there)
    const fromSummary = Object.fromEntries(
      (summary || []).map((s) => [String(s.id), s.fee_heading])
    );

    const nameById = new Proxy(fromFeeHeadings, {
      get(target, prop) {
        const key = String(prop);
        return target[key] ?? fromSummary[key];
      }
    });

    const feeRows = Object.entries(obByHeadId || {}).map(([fid, amt]) => ({
      key: `fee-${fid}`,
      label: nameById[String(fid)] || `Unknown Head (#${fid})`,
      amount: Number(amt || 0),
    }));

    // Sort fee rows by label for a nicer look
    feeRows.sort((a, b) => String(a.label).localeCompare(String(b.label)));

    const rows = [...feeRows];
    if (obVanTotal > 0) rows.push({ key: 'van', label: 'Van (Opening Balance)', amount: obVanTotal });
    if (obGenericTotal > 0) rows.push({ key: 'generic', label: 'Generic (Opening Balance)', amount: obGenericTotal });

    setObBreakdown(rows);
  }, [summary, feeHeadings, obByHeadId, obVanTotal, obGenericTotal]);

  // --- UI ---
  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
        <h2 className="m-0">School Fee Summary</h2>
        {summary.length > 0 && (
          <Button variant="outline-secondary" onClick={async () => {
            const blob = await pdf(<PdfSchoolFeeSummary school={school} summary={summary} />).toBlob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
          }}>
            Print PDF
          </Button>
        )}
      </div>

      {/* Opening Balance — shown separately by its own head/type */}
      {(obBreakdown.length > 0) && (
        <div className="mb-4">
          <h5 className="mb-2">Opening Balances (separate)</h5>
          <Table striped bordered hover size="sm">
            <thead>
              <tr>
                <th style={{width: 60}}>#</th>
                <th>Head / Type</th>
                <th className="text-end">Amount</th>
              </tr>
            </thead>
            <tbody>
              {obBreakdown.map((row, i) => {
                const isOverdue = Number(row.amount) > 0;
                return (
                  <tr key={row.key} className={`ob-row ${isOverdue ? 'ob-overdue' : 'ob-ok'}`}>
                    <td>{i + 1}</td>
                    <td>
                      {row.label}{' '}
                      {isOverdue && (
                        <span className="badge bg-danger-subtle text-danger-emphasis ms-1">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="text-end ob-amount">{formatCurrency(row.amount)}</td>
                  </tr>
                );
              })}
              <tr className={obBreakdown.reduce((a, r) => a + Number(r.amount || 0), 0) > 0 ? 'ob-overdue' : ''}>
                <td colSpan={2} className="text-end fw-semibold">Total</td>
                <td className="text-end fw-semibold ob-amount">
                  {formatCurrency(obBreakdown.reduce((a, r) => a + Number(r.amount || 0), 0))}
                </td>
              </tr>
            </tbody>
          </Table>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : error ? (
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      ) : (
        <div className="overflow-x-auto">
          <Table striped bordered hover className="table-sticky">
            <thead className="sticky-top bg-light">
              <tr>
                <th>#</th>
                <th>Fee Heading</th>
                <th>Total Due</th>
                <th>Total Received</th>
                <th>Concession</th>
                <th>Remaining Due</th>
                {/* OB column removed since OB is shown separately */}
                <th>Fully Paid</th>
                <th>Partially Paid</th>
                <th>Unpaid</th>
                <th>Total Students</th>
                <th>Van Fee Received</th>
                <th>Van Students</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item, index) => {
                const totalStudents =
                  (item.studentsPaidFull || 0) +
                  (item.studentsPaidPartial || 0) +
                  (item.studentsPending || 0);

                return (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td className="fw-semibold">{item.fee_heading}</td>
                    <td>{formatCurrency(item.totalDue)}</td>
                    <td>{formatCurrency(item.totalReceived)}</td>
                    <td>{formatCurrency(item.totalConcession)}</td>
                    <td className={Number(item.totalRemainingDue) > 0 ? 'text-danger-soft' : 'text-success-soft'}>
                      {formatCurrency(item.totalRemainingDue)}
                    </td>

                    <td className="click-chip-cell">
                      <span
                        role="button"
                        className="count-chip chip-success"
                        title="View fully paid students"
                        onClick={() => handleCountClick(item.id, 'full', item.fee_heading)}
                      >
                        {item.studentsPaidFull} Fully Paid
                      </span>
                    </td>

                    <td className="click-chip-cell">
                      <span
                        role="button"
                        className="count-chip chip-warning"
                        title="View partially paid students"
                        onClick={() => handleCountClick(item.id, 'partial', item.fee_heading)}
                      >
                        {item.studentsPaidPartial} Partial
                      </span>
                    </td>

                    <td className="click-chip-cell">
                      <span
                        role="button"
                        className="count-chip chip-danger"
                        title="View unpaid students"
                        onClick={() => handleCountClick(item.id, 'unpaid', item.fee_heading)}
                      >
                        {item.studentsPending} Unpaid
                      </span>
                    </td>

                    <td>{totalStudents}</td>
                    <td>{item.vanFeeReceived > 0 ? formatCurrency(item.vanFeeReceived) : '—'}</td>
                    <td>{item.vanStudents > 0 ? item.vanStudents : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer for grand totals */}
            <tfoot>
              <tr className="table-total-row fw-bold">
                <td colSpan={2}>Grand Total</td>
                <td className="text-end">{formatCurrency(grandTotals.totalDue)}</td>
                <td className="text-end">{formatCurrency(grandTotals.totalReceived)}</td>
                <td className="text-end">{formatCurrency(grandTotals.totalConcession)}</td>
                <td className={`text-end ${grandTotals.totalRemainingDue > 0 ? 'text-danger-soft' : 'text-success-soft'}`}>
                  {formatCurrency(grandTotals.totalRemainingDue)}
                </td>
                <td colSpan={4}></td>
                <td className="text-end">{formatCurrency(grandTotals.vanFeeReceived)}</td>
                <td></td>
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
                <Badge bg="info" text="dark">Fee Heading: {selectedHeadingName}</Badge>
              )}
            </Modal.Title>
            <small className="text-muted">
              Header & first columns are pinned. Tick fee-heads to include in WhatsApp & overall total.
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
              <Button variant="outline-primary" size="sm" onClick={selectAllHeads}>Select All</Button>
              <Button variant="outline-secondary" size="sm" onClick={clearAllHeads}>Clear</Button>
              <Button variant="success" onClick={exportToExcel}>Export to Excel</Button>
              <Button variant="success" onClick={async () => {
                if (selectedHeads.size === 0) {
                  await Swal.fire({
                    icon: 'info',
                    title: 'Select Fee Heads',
                    text: 'Please select at least one fee head to include in WhatsApp.',
                    confirmButtonText: 'OK',
                  });
                  return;
                }
                setShowModal(false);
                await new Promise((r) => setTimeout(r, 150));

                const count = filteredDetails.length;

                const confirm = await Swal.fire({
                  title: 'Send WhatsApp Messages?',
                  html: `This will send reminders to <b>${count}</b> students for <b>${selectedHeads.size}</b> fee head(s).`,
                  icon: 'question',
                  showCancelButton: true,
                  confirmButtonText: 'Send Now',
                  cancelButtonText: 'Cancel',
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
                          const amount = Number(s[`${head} - Remaining`] || 0);
                          if (amount <= 0) return; // skip heads with zero amount

                          const fine = Number(s[`${head} - Fine`] || 0);
                          const total = amount + fine;
                          overall += total;

                          included.push({ head, amount, fine, total });
                        });

                        // If no heads qualify, skip this student
                        if (included.length === 0) return null;

                        // Compose message (professional template)
                        const lines = [
                          `*Dear Parent/Guardian of ${s.name},*`,
                          ``,
                          `This is a kind reminder from *${school?.name || 'Your School'}* regarding the pending school fees:`,
                          ``,
                          `*Fee Details:*`,
                          ...included.map(
                            (i) => `• ${i.head} — Amount: ${currencyPlain(i.amount)} | Fine: ${currencyPlain(i.fine)}`
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

                        const message = lines.join('\n');

                        return {
                          id: s.id ?? s.admissionNumber,
                          name: s.name,
                          phone: '919417873297', // test number
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

                  const resp = await api.post('/integrations/whatsapp/send-batch', payload);
                  const data = resp?.data;

                  Swal.hideLoading();

                  if (data?.ok) {
                    const sent = Array.isArray(data.sent) ? data.sent : [];
                    const failedCount = sent.filter((x) => !x.ok).length;
                    const successCount = sent.length - failedCount;

                    await Swal.fire({
                      title: failedCount ? 'Partial Success' : 'Success',
                      html: failedCount
                        ? `Sent: <b>${successCount}</b> &nbsp;|&nbsp; Failed: <b>${failedCount}</b>.<br/>All messages targeted to <b>9417873297</b>.`
                        : `All <b>${sent.length}</b> messages sent.`,
                      icon: failedCount ? 'warning' : 'success',
                      confirmButtonText: 'Done',
                      showCancelButton: false,
                    });
                  } else {
                    await Swal.fire({
                      title: 'Error',
                      html: 'Message sending failed from the server.',
                      icon: 'error',
                      confirmButtonText: 'OK',
                      showCancelButton: false,
                    });
                  }
                } catch (err) {
                  console.error('WA test error:', err);
                  Swal.hideLoading();
                  await Swal.fire({
                    title: 'Error',
                    html: `Unable to send WhatsApp messages.<br/><small>${(err?.response?.data?.message || err?.message || 'Unknown error')}</small>`,
                    icon: 'error',
                    confirmButtonText: 'OK',
                    showCancelButton: false,
                  });
                }
              }}>WhatsApp</Button>
              <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Close</Button>
            </div>
          </div>

          {loadingDetails ? (
            <div className="py-4 text-center">
              <Spinner animation="border" />
            </div>
          ) : studentDetails.length === 0 ? (
            <Alert variant="info" className="mt-3">No students found for this status.</Alert>
          ) : (
            <div className="table-container">
              <Table striped bordered hover className="modal-table sticky-left-cols">
                <thead>
                  {/* Row 1: grouped heads with checkbox (colSpan=2 for Amount & Fine) */}
                  <tr>
                    <th className="slc slc-1 group-top">#</th>
                    <th className="slc slc-2 group-top">Name</th>
                    <th className="slc slc-3 group-top">Admission No</th>
                    <th className="slc slc-4 group-top">Class</th>
                    {headNames.map((head) => (
                      <th key={`group-${head}`} colSpan={2} className="feehead-group-header">
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
                    {headNames.map((head) => (
                      <React.Fragment key={`sub-${head}`}>
                        <th>Amount</th>
                        <th>Fine</th>
                      </React.Fragment>
                    ))}
                    <th>₹</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDetails.map((stu, idx) => {
                    let rowOverall = 0;
                    headNames.forEach((h) => {
                      if (!selectedHeads.has(h)) return;
                      const a = Number(stu[`${h} - Remaining`] || 0);
                      const f = Number(stu[`${h} - Fine`] || 0);
                      rowOverall += (a + f);
                    });

                    return (
                      <tr key={stu.id ?? `${idx}-${stu.admissionNumber}`}>
                        <td className="slc slc-1">{idx + 1}</td>
                        <td className="slc slc-2 fw-medium">{stu.name}</td>
                        <td className="slc slc-3">{stu.admissionNumber}</td>
                        <td className="slc slc-4">{stu.className}</td>

                        {headNames.map((head, i) => {
                          const amt = Number(stu[`${head} - Remaining`] || 0);
                          const fine = Number(stu[`${head} - Fine`] || 0);

                          const amtCls =
                            amt === 0 ? 'due-zero' :
                            'due-partial'; // amount > 0

                          const fineCls =
                            fine > 0 ? 'text-danger fw-semibold' : 'text-secondary';

                          return (
                            <React.Fragment key={`${stu.id || idx}-${head}-${i}`}>
                              <td className={amtCls}>{formatCurrency(amt)}</td>
                              <td className={fineCls}>{formatCurrency(fine)}</td>
                            </React.Fragment>
                          );
                        })}

                        <td className={rowOverall > 0 ? 'text-danger fw-bold sticky-overall' : 'text-success fw-semibold sticky-overall'}>
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
                    {headNames.map((head) => (
                      <React.Fragment key={`total-${head}`}>
                        <th className="text-end">{formatCurrency(columnTotals[head]?.remaining || 0)}</th>
                        <th className="text-end">{formatCurrency(columnTotals[head]?.fine || 0)}</th>
                      </React.Fragment>
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
            Horizontal scroll supported; left columns & overall total stay pinned with solid background.
          </small>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SchoolFeeSummary;