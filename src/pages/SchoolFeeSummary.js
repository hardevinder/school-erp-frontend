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
// NEW: plain currency line helper for composing WA text
const currencyPlain = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/* ---------------- Helpers (mirror Transactions.js behavior) ---------------- */

// Per-student fine eligibility map (keyed by fee_head id as STRING)
const fetchFineEligibility = async (studentId) => {
  try {
    const res = await api.get(`/transactions/fine-eligibility/${studentId}`);
    return res.data?.data || {}; // e.g. { "12": true, "13": false }
  } catch (e) {
    console.error('Error fetching fine eligibility:', e);
    return {};
  }
};

// Per-student full fee details (to read fineAmount like Transactions.js)
const fetchStudentFeeDetails = async (studentId) => {
  try {
    const res = await api.get(`/students/${studentId}/fee-details`);
    // Expect: { feeDetails: [ { fee_heading_id, fee_heading, fineAmount, feeDue, ... } ] }
    return res?.data?.feeDetails || [];
  } catch (e) {
    console.error('Error fetching student fee-details:', e);
    return [];
  }
};

// Simple concurrency limiter to avoid flooding the API
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

  const [selectedFeeHeadingId, setSelectedFeeHeadingId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedHeadingName, setSelectedHeadingName] = useState('');

  const [studentDetails, setStudentDetails] = useState([]);
  const [columns, setColumns] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [search, setSearch] = useState('');

  const fetchFeeSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/feedue/school-fee-summary');
      setSummary(res.data || []);
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
      if (res.data && res.data.length > 0) setSchool(res.data[0]);
    } catch (error) {
      console.error('Error fetching school:', error);
    }
  };

  const generatePDF = async () => {
    const blob = await pdf(<PdfSchoolFeeSummary school={school} summary={summary} />).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleCountClick = async (feeHeadingId, status, headingName) => {
    setSelectedFeeHeadingId(feeHeadingId);
    setSelectedStatus(status);
    setSelectedHeadingName(headingName);
    setShowModal(true);
    setLoadingDetails(true);
    setSearch('');

    try {
      // 1) Base list of students (heading + status)
      const res = await api.get('/feedue-status/fee-heading-wise-students', {
        params: { feeHeadingId, status },
      });
      const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

      // 2) Unique students for additional lookups
      const uniq = [];
      const seen = new Set();
      rawData.forEach((s) => {
        const sid = s.id ?? s.admissionNumber;
        if (!seen.has(sid)) {
          seen.add(sid);
          uniq.push({ ...s, _sid: sid });
        }
      });

      // 3) Fetch eligibility + fee-details per student (limit concurrency)
      const eligibilityCache = new Map();  // sid -> { [fee_head_id]: bool }
      const feeDetailsCache = new Map();   // sid -> full feeDetails[]

      await withConcurrency(uniq, 5, async (s) => {
        const [elig, fd] = await Promise.all([
          fetchFineEligibility(s._sid),
          fetchStudentFeeDetails(s._sid),
        ]);
        eligibilityCache.set(s._sid, elig || {});
        feeDetailsCache.set(s._sid, fd || []);
      });

      // 4) Build rows; compute Remaining + Fine + Total (like Transactions.js)
      const allCols = new Set();
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
          if (fd.fee_heading === headingName) {
            // Keep your Remaining coloring behavior from this endpoint:
            const due = Number(fd.due || 0);
            const paid = Number(fd.paid || 0);
            const concession = Number(fd.concession || 0);
            const remaining = Number(fd.remaining ?? (due - (paid + concession)));

            // Find head in full fee-details to get original fineAmount (like Transactions)
            const match = fullFeeDetails.find(
              (d) =>
                String(d.fee_heading_id) === String(feeHeadingId) ||
                d.fee_heading === headingName
            );
            const originalFine = Number(match?.fineAmount || 0);

            // Eligibility gate (default eligible when missing, like Transactions)
            const headKey = String(match?.fee_heading_id ?? fd.fee_heading_id ?? feeHeadingId ?? '');
            let eligible = true;
            if (headKey && Object.prototype.hasOwnProperty.call(eligMap, headKey)) {
              const val = eligMap[headKey];
              eligible = (val === true || val === 'true' || val === 1 || val === '1');
            }
            const fine = eligible ? originalFine : 0;

            const total = remaining + fine;

            row[`${fd.fee_heading} - Due`] = due;
            row[`${fd.fee_heading} - Paid`] = paid + concession; // your definition of "paid"
            row[`${fd.fee_heading} - Remaining`] = remaining;
            row[`${fd.fee_heading} - Fine`] = fine;
            row[`${fd.fee_heading} - Total`] = total;

            allCols.add(`${fd.fee_heading} - Remaining`);
            allCols.add(`${fd.fee_heading} - Fine`);
            allCols.add(`${fd.fee_heading} - Total`);
          }
        });

        return row;
      });

      setStudentDetails(finalData);
      setColumns(Array.from(allCols));
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

  const exportToExcel = () => {
    const baseCols = ['#', 'Name', 'Admission No', 'Class'];
    const excelRows = filteredDetails.map((stu, idx) => {
      const row = {
        '#': idx + 1,
        'Name': stu.name,
        'Admission No': stu.admissionNumber,
        'Class': stu.className,
      };
      columns.forEach((key) => {
        if (key.endsWith(' - Remaining')) {
          const label = key.replace(/ - Remaining$/, '');
          row[label] = Number(stu[key] || 0);
        } else if (key.endsWith(' - Fine')) {
          row[key] = Number(stu[key] || 0);
        } else if (key.endsWith(' - Total')) {
          row[key] = Number(stu[key] || 0);
        }
      });
      return row;
    });

    const headerCols = [
      ...baseCols,
      ...columns.map((c) => {
        if (c.endsWith(' - Remaining')) return c.replace(/ - Remaining$/, '');
        return c; // keep " - Fine" and " - Total" visible
      }),
    ];

    const worksheet = XLSX.utils.json_to_sheet(excelRows, {
      header: headerCols,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${selectedHeadingName}_${selectedStatus}_Students.xlsx`.replace(/\s+/g, '_'));
  };

  // WhatsApp sender — includes Remaining + Fine + Total (as totalDue), and a ready message
 // WhatsApp sender — keeps your logic; adds nicer WA formatting
const sendWhatsAppTest = async () => {
  setShowModal(false);
  await new Promise((r) => setTimeout(r, 200));

  const count = filteredDetails.length;
  const remainingKey = `${selectedHeadingName} - Remaining`;
  const fineKey = `${selectedHeadingName} - Fine`;
  const totalKey = `${selectedHeadingName} - Total`;

  const confirm = await Swal.fire({
    title: 'Send WhatsApp Messages?',
    html: `This will send reminders to <b>${count}</b> students.`,
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
      students: filteredDetails.map((s) => {
        const remaining = Number(s[remainingKey] || 0);
        const fine = Number(s[fineKey] || 0);
        const totalDue = Number(s[totalKey] ?? (remaining + fine));

        // ✨ WhatsApp-friendly formatting
        const lines = [
          `*Dear ${s.name},*`,
          `This is a gentle reminder for *${selectedHeadingName}*.`,
          '',
          `*Pending Amount:* ${currencyPlain(remaining)}`,
          `*Fine:* ${currencyPlain(fine)}`,
          `*Total Due:* *${currencyPlain(totalDue)}*`,
          '',
          s.className ? `Class: ${s.className}` : null,
          s.admissionNumber ? `Adm No: ${s.admissionNumber}` : null,
          '',
          `_If you have already paid, please ignore this message._`,
          `_Thank you._`,
        ].filter(Boolean);

        const message = lines.join('\n');

        return {
          id: s.id ?? s.admissionNumber,
          name: s.name,
          phone: '919417873297', // test number (+91 without '+')
          admissionNumber: s.admissionNumber,
          className: s.className,
          feeHeading: selectedHeadingName,

          // numeric fields (server can use if it composes text)
          remaining,
          fine,
          totalDue,
          dueAmount: remaining,
          fineAmount: fine,
          totalAmount: totalDue,

          // formatted text (optional for server)
          dueAmountText: currencyPlain(remaining),
          fineAmountText: currencyPlain(fine),
          totalAmountText: currencyPlain(totalDue),

          // prebuilt message (server should send this as-is)
          message,
        };
      }),
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
};


  useEffect(() => {
    fetchFeeSummary();
    fetchSchool();
  }, []);

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
        <h2 className="m-0">School Fee Summary</h2>
        {summary.length > 0 && (
          <Button variant="outline-secondary" onClick={generatePDF}>
            Print PDF
          </Button>
        )}
      </div>

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
            <small className="text-muted">Header is sticky; table header & first columns are sticky while scrolling.</small>
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
              <Button variant="success" onClick={exportToExcel}>Export to Excel</Button>

              {/* closes modal then confirm+send in one popup */}
              <Button variant="success" onClick={sendWhatsAppTest}>
                WhatsApp
              </Button>

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
                  <tr>
                    <th className="slc slc-1">#</th>
                    <th className="slc slc-2">Name</th>
                    <th className="slc slc-3">Admission No</th>
                    <th className="slc slc-4">Class</th>
                    {columns.map((col, idx) => (
                      <th key={idx}>
                        {
                          col.endsWith(' - Remaining') ? col.replace(/ - Remaining$/, '')
                          : col.endsWith(' - Fine') ? 'Fine'
                          : col.endsWith(' - Total') ? 'Total'
                          : col
                        }
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.map((stu, idx) => (
                    <tr key={stu.id ?? `${idx}-${stu.admissionNumber}`}>
                      <td className="slc slc-1">{idx + 1}</td>
                      <td className="slc slc-2 fw-medium">{stu.name}</td>
                      <td className="slc slc-3">{stu.admissionNumber}</td>
                      <td className="slc slc-4">{stu.className}</td>
                      {columns.map((key, i) => {
                        const baseLabel = key.replace(/ - (Remaining|Fine|Total)$/, '');
                        const dueKey = `${baseLabel} - Due`;
                        const remaining = Number(stu[`${baseLabel} - Remaining`] || 0);
                        const due = Number(stu[dueKey] || 0);
                        const fine = Number(stu[`${baseLabel} - Fine`] || 0);
                        const total = Number(stu[`${baseLabel} - Total`] ?? (remaining + fine));

                        let cellValue = Number(stu[key] || 0);
                        let cls = '';

                        if (key.endsWith(' - Remaining')) {
                          // Keep your existing remaining color logic
                          if (due > 0 && remaining === due) cls = 'due-full';      // full pending (red-ish)
                          else if (remaining > 0) cls = 'due-partial';             // partial pending (amber)
                          else cls = 'due-zero';                                    // none pending (green)
                          cellValue = remaining;
                        } else if (key.endsWith(' - Fine')) {
                          // Fine should be red if >0, muted if 0
                          cls = fine > 0 ? 'text-danger fw-semibold' : 'text-secondary';
                          cellValue = fine;
                        } else if (key.endsWith(' - Total')) {
                          // Total should be red if >0, green if 0
                          cls = total > 0 ? 'text-danger fw-bold' : 'text-success fw-semibold';
                          cellValue = total;
                        }

                        return (
                          <td key={i} className={cls}>
                            {formatCurrency(cellValue)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="justify-content-between">
          <small className="text-muted">Scroll horizontally for more headings; left columns stay pinned.</small>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SchoolFeeSummary;
