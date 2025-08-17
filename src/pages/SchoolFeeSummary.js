// SchoolFeeSummary.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Table, Container, Spinner, Alert, Button, Modal, Form, InputGroup, Badge } from 'react-bootstrap';
import { pdf } from '@react-pdf/renderer';
import PdfSchoolFeeSummary from './PdfSchoolFeeSummary';
import api from '../api';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './SchoolFeeSummary.css';

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

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
      const res = await api.get('/feedue-status/fee-heading-wise-students', {
        params: { feeHeadingId, status },
      });

      const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

      const allCols = new Set();
      const finalData = rawData.map((student) => {
        const row = {
          id: student.id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          className: student.className,
        };

        (student.feeDetails || []).forEach((fd) => {
          if (fd.fee_heading === headingName) {
            row[`${fd.fee_heading} - Due`] = Number(fd.due || 0);
            row[`${fd.fee_heading} - Paid`] =
              Number(fd.paid || 0) + Number(fd.concession || 0);
            row[`${fd.fee_heading} - Remaining`] = Number(fd.remaining || 0);
            allCols.add(`${fd.fee_heading} - Remaining`);
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
        const label = key.replace(/ - Remaining$/, '');
        row[label] = Number(stu[key] || 0);
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows, {
      header: [...baseCols, ...columns.map((c) => c.replace(/ - Remaining$/, ''))],
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `${selectedHeadingName}_${selectedStatus}_Students.xlsx`);
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
                      <th key={idx}>{col.replace(/ - Remaining$/, '')}</th>
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
                        const dueKey = key.replace('Remaining', 'Due');
                        const remaining = Number(stu[key] || 0);
                        const due = Number(stu[dueKey] || 0);
                        let cls = 'due-zero';
                        if (due > 0 && remaining === due) cls = 'due-full';
                        else if (remaining > 0) cls = 'due-partial';
                        return (
                          <td key={i} className={cls}>
                            {formatCurrency(remaining)}
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
