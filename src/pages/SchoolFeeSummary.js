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

  const [selectedFeeHeadingId, setSelectedFeeHeadingId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedHeadingName, setSelectedHeadingName] = useState('');

  const [studentDetails, setStudentDetails] = useState([]);
  const [headNames, setHeadNames] = useState([]); // list of fee head names (for grouped header)
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [search, setSearch] = useState('');

  // New: which fee heads are selected for WA/overall total
  const [selectedHeads, setSelectedHeads] = useState(new Set());

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

      const allHeads = new Set();
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

          allHeads.add(headName);
        });

        return row;
      });

      setStudentDetails(finalData);
      setHeadNames(Array.from(allHeads));
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

  // WhatsApp: send only checked heads; include per-head lines and overall total
  const sendWhatsAppTest = async () => {
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
        `This is a kind reminder regarding the pending school fees:`,
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
              <Button variant="success" onClick={sendWhatsAppTest}>WhatsApp</Button>
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
