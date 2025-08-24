import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Table,
  Alert,
  Pagination,
  InputGroup,
} from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../api'; // Custom Axios instance (with token interceptor)
import Swal from 'sweetalert2';

// Import PDF generation functionalities and components.
import { pdf } from '@react-pdf/renderer';
import PdfReports from './PdfReport'; // Component for printing entire report PDF
import PdfReceiptDocument from './Transactions/PdfReceiptDocument'; // Component for printing individual receipt PDF

// Import the ReceiptModal component from the Transactions folder.
import ReceiptModal from './Transactions/ReceiptModal';

// Helper function to format a Date object to 'yyyy-MM-dd' for BACKEND/API usage
const formatDate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// UI-only formatter: dd/MM/yyyy
const formatToDDMMYYYY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper function for totals: formats the value with commas and the Rupee symbol or returns "0" if zero.
const formatTotalValue = (value) => {
  return Number(value) === 0 ? "0" : `₹${Number(value).toLocaleString('en-IN')}`;
};

// Group report data by fee heading.
const groupByFeeHeading = (data) => {
  return data.reduce((groups, item) => {
    const feeHeading = item.feeHeadingName;
    if (!groups[feeHeading]) groups[feeHeading] = [];
    groups[feeHeading].push(item);
    return groups;
  }, {});
};

// Calculate fee heading summary with payment mode breakdown.
const calculateFeeHeadingSummary = (data) => {
  const groups = groupByFeeHeading(data);
  return Object.keys(groups).map((feeHeading) => {
    const items = groups[feeHeading];
    // Breakdown for Cash.
    const cashTotals = items.reduce(
      (acc, item) => {
        if (item.PaymentMode === 'Cash') {
          acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
          acc.totalConcession += Number(item.totalConcession) || 0;
          acc.totalVanFee += Number(item.totalVanFee) || 0;
          acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
        }
        return acc;
      },
      { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0 }
    );
    cashTotals.totalReceived = cashTotals.totalFeeReceived + cashTotals.totalVanFee;
    // Breakdown for Online.
    const onlineTotals = items.reduce(
      (acc, item) => {
        if (item.PaymentMode === 'Online') {
          acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
          acc.totalConcession += Number(item.totalConcession) || 0;
          acc.totalVanFee += Number(item.totalVanFee) || 0;
          acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
        }
        return acc;
      },
      { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0 }
    );
    onlineTotals.totalReceived = onlineTotals.totalFeeReceived + onlineTotals.totalVanFee;
    // Overall totals.
    const overall = {
      totalFeeReceived: cashTotals.totalFeeReceived + onlineTotals.totalFeeReceived,
      totalConcession: cashTotals.totalConcession + onlineTotals.totalConcession,
      totalVanFee: cashTotals.totalVanFee + onlineTotals.totalVanFee,
      totalVanFeeConcession: cashTotals.totalVanFeeConcession + onlineTotals.totalVanFeeConcession,
      totalReceived: cashTotals.totalReceived + onlineTotals.totalReceived,
    };
    return { feeHeading, cash: cashTotals, online: onlineTotals, overall };
  });
};

const DayWiseReport = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 500;

  // State for managing the Receipt Modal.
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState(null);

  // Fetch school details.
  const fetchSchoolDetails = async () => {
    try {
      const response = await api.get('/schools');
      if (response.data && response.data.length > 0) {
        setSchool(response.data[0]);
      }
    } catch (err) {
      console.error('Error fetching school details:', err);
    }
  };

  useEffect(() => {
    fetchSchoolDetails();
  }, []);

  // Handle search filtering
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredData(reportData);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = reportData.filter((item) =>
        (item.Student?.name?.toLowerCase() || '').includes(lowerQuery) ||
        (item.Student?.admission_number?.toLowerCase() || '').includes(lowerQuery) ||
        (item.Slip_ID?.toString() || '').includes(lowerQuery) ||
        (item.feeHeadingName?.toLowerCase() || '').includes(lowerQuery)
      );
      setFilteredData(filtered);
    }
    setCurrentPage(1); // Reset to first page on search
  }, [searchQuery, reportData]);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Backend expects yyyy-MM-dd
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      const response = await api.get(`/reports/day-wise?startDate=${start}&endDate=${end}`);
      setReportData(response.data);
      setCurrentPage(1);
    } catch (err) {
      if (err.response && err.response.status === 401) {
        Swal.fire({
          title: "Session Expired",
          text: "Your session has expired. Please log in again.",
          icon: "warning",
          confirmButtonText: "OK"
        });
      } else {
        setError('Error fetching report data. Please try again later.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Function to open the entire report as a PDF.
  const openPdfInNewTab = async () => {
    if (!school) {
      alert('School details not available.');
      return;
    }
    const doc = (
      <PdfReports
        school={school}
        // Keep API-friendly format for PDF props if your PDF expects yyyy-MM-dd
        startDate={formatDate(startDate)}
        endDate={formatDate(endDate)}
        aggregatedData={filteredData} // Use filtered data for PDF
        feeCategories={[]} // Adjust or populate if needed.
        categorySummary={calculateFeeHeadingSummary(filteredData)}
        totalSummary={filteredData.reduce((acc, item) => {
          acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
          acc.totalConcession += Number(item.totalConcession) || 0;
          acc.totalVanFee += Number(item.totalVanFee) || 0;
          acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
          acc.totalReceived += (Number(item.totalFeeReceived) || 0) + (Number(item.totalVanFee) || 0);
          return acc;
        }, { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0, totalReceived: 0 })}
      />
    );
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // For the Collection Report table (detailed student rows).
  const studentData = filteredData; // Use filtered data

  // Calculate pagination.
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = studentData.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(studentData.length / recordsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Compute overall totals for Collection Report.
  const totalSummary = filteredData.reduce((acc, item) => {
    acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
    acc.totalConcession += Number(item.totalConcession) || 0;
    acc.totalVanFee += Number(item.totalVanFee) || 0;
    acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
    acc.totalReceived += (Number(item.totalFeeReceived) || 0) + (Number(item.totalVanFee) || 0);
    return acc;
  }, {
    totalFeeReceived: 0,
    totalConcession: 0,
    totalVanFee: 0,
    totalVanFeeConcession: 0,
    totalReceived: 0,
  });

  // Compute payment mode summary for Collection Report.
  const paymentModeSummary = filteredData.reduce((acc, item) => {
    const mode = item.PaymentMode;
    if (!acc[mode]) {
      acc[mode] = {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalReceived: 0,
      };
    }
    acc[mode].totalFeeReceived += Number(item.totalFeeReceived) || 0;
    acc[mode].totalConcession += Number(item.totalConcession) || 0;
    acc[mode].totalVanFee += Number(item.totalVanFee) || 0;
    acc[mode].totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
    acc[mode].totalReceived += (Number(item.totalFeeReceived) || 0) + (Number(item.totalVanFee) || 0);
    return acc;
  }, {});

  // Compute Fee Heading Summary with payment breakdown.
  const feeHeadingSummary = filteredData.length ? calculateFeeHeadingSummary(filteredData) : [];

  // Compute overall totals for Fee Heading Summary.
  const totalFeeHeadingSummary = feeHeadingSummary.reduce((acc, cat) => {
    acc.totalFeeReceived.cash += cat.cash.totalFeeReceived;
    acc.totalFeeReceived.online += cat.online.totalFeeReceived;
    acc.totalConcession.cash += cat.cash.totalConcession;
    acc.totalConcession.online += cat.online.totalConcession;
    acc.totalVanFee.cash += cat.cash.totalVanFee;
    acc.totalVanFee.online += cat.online.totalVanFee;
    acc.totalVanFeeConcession.cash += cat.cash.totalVanFeeConcession;
    acc.totalVanFeeConcession.online += cat.online.totalVanFeeConcession;
    acc.totalReceived.cash += cat.cash.totalReceived;
    acc.totalReceived.online += cat.online.totalReceived;
    return acc;
  }, {
    totalFeeReceived: { cash: 0, online: 0 },
    totalConcession: { cash: 0, online: 0 },
    totalVanFee: { cash: 0, online: 0 },
    totalVanFeeConcession: { cash: 0, online: 0 },
    totalReceived: { cash: 0, online: 0 },
  });

  // Function to open the Receipt Modal for a given slipId.
  const viewReceipt = (slipId) => {
    setSelectedSlipId(slipId);
    setShowReceiptModal(true);
  };

  // Function to generate and print PDF for an individual receipt.
  const handlePrintReceipt = async (slipId) => {
    try {
      const schoolResponse = await api.get("/schools");
      const schoolData = schoolResponse.data.length > 0 ? schoolResponse.data[0] : null;
      const receiptResponse = await api.get(`/transactions/slip/${slipId}`);
      const receiptData = receiptResponse.data.data;
      if (!schoolData || !receiptData || receiptData.length === 0) {
        console.error("Insufficient data to generate PDF");
        return;
      }
      const student = receiptData[0].Student;
      if (!student) {
        console.error("Student data missing in receipt");
        return;
      }
      const blob = await pdf(
        <PdfReceiptDocument school={schoolData} receipt={receiptData} student={student} />
      ).toBlob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (error) {
      console.error("Error generating PDF blob:", error);
    }
  };

  return (
    <Container className="mt-4">
      <h1 className="text-center">Day Wise Report</h1>
      
      {/* Row: Date pickers and Buttons */}
      <Row className="justify-content-center mt-4">
        <Col md={3}>
          <Form.Group controlId="startDate">
            <Form.Label>Start Date</Form.Label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              dateFormat="dd/MM/yyyy"   
              className="form-control"
              placeholderText="Select Start Date"
              showMonthDropdown
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={15}
              required
              popperClassName="datepicker-popper"
            />
          </Form.Group>
        </Col>
        <Col md={3}>
          <Form.Group controlId="endDate">
            <Form.Label>End Date</Form.Label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              dateFormat="dd/MM/yyyy"   
              className="form-control"
              placeholderText="Select End Date"
              minDate={startDate}
              showMonthDropdown
              showYearDropdown
              scrollableYearDropdown
              yearDropdownItemNumber={15}
              required
              popperClassName="datepicker-popper"
            />
          </Form.Group>
        </Col>
        <Col md={3} className="d-flex align-items-end">
          <Button
            variant="primary"
            onClick={handleGenerateReport}
            disabled={loading}
            className="w-100"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </Button>
        </Col>
        <Col md={3} className="d-flex align-items-end">
          {reportData.length > 0 && school ? (
            <Button variant="secondary" onClick={openPdfInNewTab} className="w-100">
              Print as PDF
            </Button>
          ) : (
            <Button variant="secondary" disabled className="w-100">
              Print as PDF
            </Button>
          )}
        </Col>
      </Row>

      {/* Search Input Row */}
      {reportData.length > 0 && (
        <Row className="mt-3">
          <Col xs={12} className="d-flex align-items-center justify-content-start">
            <Form.Label className="me-2 mb-0" style={{ minWidth: '60px' }}>Search:</Form.Label>
            <InputGroup style={{ maxWidth: '300px' }}>
              <Form.Control
                type="text"
                placeholder="Search by name, admission no., slip ID, or fee heading"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button
                  variant="outline-secondary"
                  onClick={() => setSearchQuery('')}
                >
                  Clear
                </Button>
              )}
            </InputGroup>
          </Col>
        </Row>
      )}

      {error && (
        <Row className="mt-3">
          <Col>
            <Alert variant="danger" className="text-center">{error}</Alert>
          </Col>
        </Row>
      )}

      {/* Collection Report Section */}
      <Row className="mt-5">
        <Col>
          {studentData.length === 0 && !loading ? (
            <Alert variant="info" className="text-center">
              No data available for the selected date range or search criteria.
            </Alert>
          ) : (
            <>
              <h2>Collection Report</h2>
              <div style={{ maxHeight: '400px', overflowY: 'auto', position: 'relative' }}>
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Sr. No</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Slip ID</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Admission Number</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Student Name</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Class</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Payment Mode</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Fee Heading</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Created At</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Fee Received</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Concession</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Van Fee</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Total Received</th>
                      <th className="sticky-top bg-white" style={{ top: 0 }}>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.map((item, idx) => {
                      const horizontalTotal =
                        Number(item.totalFeeReceived) + Number(item.totalVanFee);
                      return (
                        <tr key={idx}>
                          <td>{indexOfFirstRecord + idx + 1}</td>
                          <td>{item.Slip_ID}</td>
                          <td>{item.Student?.admission_number}</td>
                          <td>{item.Student?.name}</td>
                          <td>{item.Student?.Class?.class_name}</td>
                          <td>{item.PaymentMode}</td>
                          <td>{item.feeHeadingName}</td>
                          {/* Created At → dd/MM/yyyy */}
                          <td>{formatToDDMMYYYY(item.createdAt)}</td>
                          <td>{formatTotalValue(item.totalFeeReceived)}</td>
                          <td>{formatTotalValue(item.totalConcession)}</td>
                          <td>{formatTotalValue(item.totalVanFee)}</td>
                          <td>{formatTotalValue(horizontalTotal)}</td>
                          <td>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => viewReceipt(item.Slip_ID)}
                              className="me-1"
                            >
                              View Receipt
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePrintReceipt(item.Slip_ID)}
                            >
                              Print Receipt
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
              {totalPages > 1 && (
                <Pagination className="justify-content-center mt-3">
                  {[...Array(totalPages)].map((_, idx) => (
                    <Pagination.Item
                      key={idx + 1}
                      active={idx + 1 === currentPage}
                      onClick={() => handlePageChange(idx + 1)}
                    >
                      {idx + 1}
                    </Pagination.Item>
                  ))}
                </Pagination>
              )}
            </>
          )}
        </Col>
      </Row>

      {/* Fee Heading Summary Section */}
      <Row className="mt-5">
        <Col>
          {feeHeadingSummary.length > 0 && (
            <>
              <h2>Fee Heading Summary</h2>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th rowSpan="2" className="sticky-top bg-white">Fee Heading</th>
                    <th colSpan="3" className="sticky-top bg-white">Total Fee Received</th>
                    <th colSpan="3" className="sticky-top bg-white">Total Concession</th>
                    <th colSpan="3" className="sticky-top bg-white">Total Van Fee</th>
                    <th colSpan="3" className="sticky-top bg-white">Total Van Fee Concession</th>
                    <th colSpan="3" className="sticky-top bg-white">Total Received</th>
                  </tr>
                  <tr>
                    <th className="sticky-top bg-white">Cash</th>
                    <th className="sticky-top bg-white">Online</th>
                    <th className="sticky-top bg-white">Overall</th>
                    <th className="sticky-top bg-white">Cash</th>
                    <th className="sticky-top bg-white">Online</th>
                    <th className="sticky-top bg-white">Overall</th>
                    <th className="sticky-top bg-white">Cash</th>
                    <th className="sticky-top bg-white">Online</th>
                    <th className="sticky-top bg-white">Overall</th>
                    <th className="sticky-top bg-white">Cash</th>
                    <th className="sticky-top bg-white">Online</th>
                    <th className="sticky-top bg-white">Overall</th>
                    <th className="sticky-top bg-white">Cash</th>
                    <th className="sticky-top bg-white">Online</th>
                    <th className="sticky-top bg-white">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {feeHeadingSummary.map((cat, index) => (
                    <tr key={index}>
                      <td>{cat.feeHeading}</td>
                      <td>{formatTotalValue(cat.cash.totalFeeReceived)}</td>
                      <td>{formatTotalValue(cat.online.totalFeeReceived)}</td>
                      <td>{formatTotalValue(cat.overall.totalFeeReceived)}</td>
                      <td>{formatTotalValue(cat.cash.totalConcession)}</td>
                      <td>{formatTotalValue(cat.online.totalConcession)}</td>
                      <td>{formatTotalValue(cat.overall.totalConcession)}</td>
                      <td>{formatTotalValue(cat.cash.totalVanFee)}</td>
                      <td>{formatTotalValue(cat.online.totalVanFee)}</td>
                      <td>{formatTotalValue(cat.overall.totalVanFee)}</td>
                      <td>{formatTotalValue(cat.cash.totalVanFeeConcession)}</td>
                      <td>{formatTotalValue(cat.online.totalVanFeeConcession)}</td>
                      <td>{formatTotalValue(cat.overall.totalVanFeeConcession)}</td>
                      <td>{formatTotalValue(cat.cash.totalReceived)}</td>
                      <td>{formatTotalValue(cat.online.totalReceived)}</td>
                      <td>{formatTotalValue(cat.overall.totalReceived)}</td>
                    </tr>
                  ))}
                </tbody>
                {Object.keys(totalFeeHeadingSummary).length > 0 && (
                  <tfoot>
                    <tr>
                      <td><strong>Overall Total</strong></td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalFeeReceived.cash)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalFeeReceived.online)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(
                            totalFeeHeadingSummary.totalFeeReceived.cash +
                              totalFeeHeadingSummary.totalFeeReceived.online
                          )}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalConcession.cash)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalConcession.online)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(
                            totalFeeHeadingSummary.totalConcession.cash +
                              totalFeeHeadingSummary.totalConcession.online
                          )}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFee.cash)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFee.online)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(
                            totalFeeHeadingSummary.totalVanFee.cash +
                              totalFeeHeadingSummary.totalVanFee.online
                          )}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFeeConcession.cash)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalVanFeeConcession.online)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(
                            totalFeeHeadingSummary.totalVanFeeConcession.cash +
                              totalFeeHeadingSummary.totalVanFeeConcession.online
                          )}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalReceived.cash)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(totalFeeHeadingSummary.totalReceived.online)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(
                            totalFeeHeadingSummary.totalReceived.cash +
                              totalFeeHeadingSummary.totalReceived.online
                          )}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </>
          )}
        </Col>
      </Row>

      {/* Render the Receipt Modal */}
      {showReceiptModal && (
        <ReceiptModal
          show={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          slipId={selectedSlipId}
        />
      )}
    </Container>
  );
};

export default DayWiseReport;
