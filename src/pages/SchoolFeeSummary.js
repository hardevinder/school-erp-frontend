// SchoolFeeSummary.jsx
import React, { useEffect, useState } from 'react';
import { Table, Container, Spinner, Alert, Button, Modal } from 'react-bootstrap';
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
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchFeeSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/feedue/school-fee-summary');
      setSummary(res.data);
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
    const blob = await pdf(
      <PdfSchoolFeeSummary school={school} summary={summary} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleCountClick = async (feeHeadingId, status, headingName) => {
    setSelectedFeeHeadingId(feeHeadingId);
    setSelectedStatus(status);
    setSelectedHeadingName(headingName);
    setShowModal(true);
    setLoadingDetails(true);

    try {
      const res = await api.get(
        '/feedue-status/fee-heading-wise-students',
        { params: { feeHeadingId, status } }
      );

      const rawData = res.data.data;
      const finalData = rawData.map((student) => {
        const row = {
          id: student.id,
          name: student.name,
          admissionNumber: student.admissionNumber,  // ← add this line
          className: student.className,   // ← use the backend’s className
        };
        student.feeDetails.forEach((fd) => {
          row[`${fd.fee_heading} - Due`] = fd.due;
          row[`${fd.fee_heading} - Paid`] =
            fd.paid + fd.concession;
          row[`${fd.fee_heading} - Remaining`] = fd.remaining;
        });
        return row;
      });
      setStudentDetails(finalData);
    } catch (err) {
      console.error('Error fetching student details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(studentDetails);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob = new Blob([excelBuffer], {
      type: 'application/octet-stream',
    });
    saveAs(
      blob,
      `${selectedHeadingName}_${selectedStatus}_Students.xlsx`
    );
  };

  useEffect(() => {
    fetchFeeSummary();
    fetchSchool();
  }, []);

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="text-center flex-grow-1">
          School Fee Summary
        </h2>
        {summary.length > 0 && (
          <Button
            variant="secondary"
            onClick={generatePDF}
            className="ms-3"
          >
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
          <Table
            striped
            bordered
            hover
            responsive
            className="table-sticky"
          >
            <thead className="sticky-top bg-light">
              <tr>
                <th>#</th>
                <th>Fee Heading</th>
                <th>Total Due</th>                  {/* 🆕 */}
                <th>Total Received</th>             {/* 🆕 */}
                <th>Concession</th>                 {/* 🆕 */}
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

                    <td>
                      {formatCurrency(item.totalRemainingDue)}
                    </td>
                    <td
                      style={{
                        color: 'blue',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        handleCountClick(
                          item.id,
                          'full',
                          item.fee_heading
                        )
                      }
                    >
                      {item.studentsPaidFull}
                    </td>
                    <td
                      style={{
                        color: 'blue',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        handleCountClick(
                          item.id,
                          'partial',
                          item.fee_heading
                        )
                      }
                    >
                      {item.studentsPaidPartial}
                    </td>
                    <td
                      style={{
                        color: 'blue',
                        cursor: 'pointer',
                      }}
                      onClick={() =>
                        handleCountClick(
                          item.id,
                          'unpaid',
                          item.fee_heading
                        )
                      }
                    >
                      {item.studentsPending}
                    </td>
                    <td>{totalStudents}</td>
                    <td>
                      {item.vanFeeReceived > 0
                        ? formatCurrency(item.vanFeeReceived)
                        : '----'}
                    </td>
                    <td>
                      {item.vanStudents > 0
                        ? item.vanStudents
                        : '----'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        size="xl"
      >
        <Modal.Header
          closeButton
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 1050,
            backgroundColor: 'white',
          }}
        >
          <Modal.Title>
            {selectedHeadingName} –{' '}
            {selectedStatus?.toUpperCase()} PAID STUDENTS
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="modal-body-scroll">
          {loadingDetails ? (
            <Spinner animation="border" />
          ) : studentDetails.length === 0 ? (
            <Alert variant="info">
              No students found for this status.
            </Alert>
          ) : (
            <>
              <div className="export-container">
                <Button variant="success" onClick={exportToExcel}>
                  Export to Excel
                </Button>
              </div>

              <Table
                striped
                bordered
                hover
                responsive
                className="modal-table"
              >
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Admission No</th>
                    <th>Class</th>
                    {studentDetails.length > 0 &&
                      Object.keys(studentDetails[0])
                        .filter(k => k.endsWith('Remaining'))
                        .map((col, idx) => {
                          // drop the " - Remaining" suffix
                          const label = col.replace(/ - Remaining$/, '');
                          return <th key={idx}>{label}</th>;
                        })}

                  </tr>
                </thead>
                <tbody>
                  {studentDetails.map((stu, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{stu.name}</td>
                      <td>{stu.admissionNumber}</td>
                      <td>{stu.className}</td>
                      {Object.keys(stu)
                        .filter((k) =>
                          k.endsWith('Remaining')
                        )
                        .map((key, i) => {
                          const dueKey = key.replace(
                            'Remaining',
                            'Due'
                          );
                          const remaining = stu[key] || 0;
                          let bg = '';
                            const due = stu[dueKey] || 0;
                            // only show red when there actually was something due
                            if (due > 0 && remaining === due) {
                              bg = 'bg-danger text-white';
                            } else if (remaining > 0) {
                              bg = 'bg-warning';
                            }

                          return (
                            <td key={i} className={bg}>
                              ₹{remaining}
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
