// SchoolFeeSummary.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Table, Container, Spinner, Alert, Button, Modal, Form, InputGroup } from 'react-bootstrap';
import { pdf } from '@react-pdf/renderer';
import PdfSchoolFeeSummary from './PdfSchoolFeeSummary';
import api from '../api';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './SchoolFeeSummary.css';

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN')}`;

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

  // 🔎 search in modal
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
      if (res.data && res.data.length > 0) {
        setSchool(res.data[0]);
      }
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
    setSearch(''); // reset search when opening

    try {
      const res = await api.get('/feedue-status/fee-heading-wise-students', {
        params: { feeHeadingId, status },
      });

      const rawData = Array.isArray(res?.data?.data) ? res.data.data : [];

      // Build all columns from all students' feeDetails
      const allCols = new Set();
      const finalData = rawData.map((student) => {
        const row = {
          id: student.id,
          name: student.name,
          admissionNumber: student.admissionNumber,
          className: student.className,
        };

        (student.feeDetails || []).forEach((fd) => {
          row[`${fd.fee_heading} - Due`] = Number(fd.due || 0);
          row[`${fd.fee_heading} - Paid`] = Number(fd.paid || 0) + Number(fd.concession || 0);
          row[`${fd.fee_heading} - Remaining`] = Number(fd.remaining || 0);
          allCols.add(`${fd.fee_heading} - Remaining`);
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

  // 🔎 filter rows by search (name, admission no, class)
  const filteredDetails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return studentDetails;
    return studentDetails.filter((s) => {
      return (
        (s.name || '').toLowerCase().includes(q) ||
        (s.admissionNumber || '').toString().toLowerCase().includes(q) ||
        (s.className || '').toLowerCase().includes(q)
      );
    });
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
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="text-center flex-grow-1">School Fee Summary</h2>
        {summary.length > 0 && (
          <Button variant="secondary" onClick={generatePDF} className="ms-3">
            Print PDF
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
        </div>
      ) : error ? (
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <Table striped bordered hover responsive className="table-sticky">
            <thead className="sticky-top bg-light">
              <tr>
                <th>#</th>
                <th>Fee Heading</th>
                <th>Total Due</th>
                <th>Total Received</th>
                <th>Concession</th>
                <th>Remaining Due</th>
                <th>Fully Paid Students</th>
                <th>Partially Paid Students</th>
                <th>Unpaid Students</th>
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
                    <td>{item.fee_heading}</td>
                    <td>{formatCurrency(item.totalDue)}</td>
                    <td>{formatCurrency(item.totalReceived)}</td>
                    <td>{formatCurrency(item.totalConcession)}</td>
                    <td>{formatCurrency(item.totalRemainingDue)}</td>

                    <td
                      style={{ color: 'blue', cursor: 'pointer' }}
                      onClick={() => handleCountClick(item.id, 'full', item.fee_heading)}
                      title="View fully paid students"
                    >
                      {item.studentsPaidFull}
                    </td>

                    <td
                      style={{ color: 'blue', cursor: 'pointer' }}
                      onClick={() => handleCountClick(item.id, 'partial', item.fee_heading)}
                      title="View partially paid students"
                    >
                      {item.studentsPaidPartial}
                    </td>

                    <td
                      style={{ color: 'blue', cursor: 'pointer' }}
                      onClick={() => handleCountClick(item.id, 'unpaid', item.fee_heading)}
                      title="View unpaid students"
                    >
                      {item.studentsPending}
                    </td>

                    <td>{totalStudents}</td>

                    <td>{item.vanFeeReceived > 0 ? formatCurrency(item.vanFeeReceived) : '----'}</td>
                    <td>{item.vanStudents > 0 ? item.vanStudents : '----'}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {/* Wider modal via dialogClassName; full-screen on small screens */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="xl"
        dialogClassName="modal-xxl"
        fullscreen="md-down"
      >
        <Modal.Header
          closeButton
          style={{ position: 'sticky', top: 0, zIndex: 1050, backgroundColor: 'white' }}
        >
          <Modal.Title>
            {selectedHeadingName} – {selectedStatus?.toUpperCase()} STUDENTS
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="modal-body-scroll">
          {loadingDetails ? (
            <Spinner animation="border" />
          ) : studentDetails.length === 0 ? (
            <Alert variant="info">No students found for this status.</Alert>
          ) : (
            <>
              {/* Search + Export */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <InputGroup className="search-input">
                  <InputGroup.Text>Search</InputGroup.Text>
                  <Form.Control
                    placeholder="Type name, admission no, or class…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>

                <Button variant="success" onClick={exportToExcel}>
                  Export to Excel
                </Button>
              </div>

              <Table striped bordered hover responsive className="modal-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Admission No</th>
                    <th>Class</th>
                    {columns.map((col, idx) => (
                      <th key={idx}>{col.replace(/ - Remaining$/, '')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.map((stu, idx) => (
                    <tr key={stu.id ?? idx}>
                      <td>{idx + 1}</td>
                      <td>{stu.name}</td>
                      <td>{stu.admissionNumber}</td>
                      <td>{stu.className}</td>
                      {columns.map((key, i) => {
                        const dueKey = key.replace('Remaining', 'Due');
                        const remaining = Number(stu[key] || 0);
                        const due = Number(stu[dueKey] || 0);

                        let bg = '';
                        if (due > 0 && remaining === due) {
                          bg = 'bg-danger text-white';
                        } else if (remaining > 0) {
                          bg = 'bg-warning';
                        }

                        return (
                          <td key={i} className={bg}>
                            {formatCurrency(remaining)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default SchoolFeeSummary;
