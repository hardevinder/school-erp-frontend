import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Table, Alert, Pagination } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../api'; // Custom Axios instance (with token interceptor)
import Swal from 'sweetalert2';
import { pdf } from '@react-pdf/renderer';
import PdfReports from './PdfCategoryReport'; // Your PDF component saved in the same folder

// Helper function to format a Date object to 'yyyy-MM-dd'
const formatDate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// Helper function for totals: if the value is nonzero, format it with commas and prefix with the Rupee symbol; otherwise, return "0"
const formatTotalValue = (value) => {
  return Number(value) === 0 ? "0" : `₹${Number(value).toLocaleString('en-IN')}`;
};

// Function to pivot the data by Slip_ID so that each slip becomes one row.
// Modified to separate Van Fee for Tuition Fee records.
const pivotReportData = (data) => {
  const grouped = data.reduce((acc, curr) => {
    const slipId = curr.Slip_ID;
    if (!acc[slipId]) {
      // Initialize row with basic fields, an empty feeCategories object, and a new vanFeeTotal field.
      acc[slipId] = {
        Slip_ID: curr.Slip_ID,
        createdAt: curr.createdAt,
        Student_ID: curr.Student_ID,
        PaymentMode: curr.PaymentMode,
        Student: curr.Student,
        feeCategories: {},
        vanFeeTotal: 0,
        // fineAmount: Number(curr.totalFine || 0),
        fineAmount: 0, // initialize at 0


      };

    }
    const category = curr.feeCategoryName;
    if (!acc[slipId].feeCategories[category]) {
      acc[slipId].feeCategories[category] = {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalReceived: 0,
      };
    }
    if (category === "Tuition Fee") {
      // For Tuition Fee, add only the tuition fee amount to totalReceived (exclude Van Fee)
      acc[slipId].feeCategories[category].totalFeeReceived += Number(curr.totalFeeReceived) || 0;
      acc[slipId].feeCategories[category].totalConcession += Number(curr.totalConcession) || 0;
      acc[slipId].feeCategories[category].totalVanFee += Number(curr.totalVanFee) || 0;
      acc[slipId].feeCategories[category].totalVanFeeConcession += Number(curr.totalVanFeeConcession) || 0;
      acc[slipId].feeCategories[category].totalReceived += Number(curr.totalFeeReceived) || 0; // exclude van fee here
      // Accumulate Van Fee separately on the slip level
      acc[slipId].vanFeeTotal += Number(curr.totalVanFee) || 0;
      acc[slipId].fineAmount += Number(curr.totalFine || curr.Fine_Amount || 0);

    } else {
      // For other fee categories, process as before.
      acc[slipId].feeCategories[category].totalFeeReceived += Number(curr.totalFeeReceived) || 0;
      acc[slipId].feeCategories[category].totalConcession += Number(curr.totalConcession) || 0;
      acc[slipId].feeCategories[category].totalVanFee += Number(curr.totalVanFee) || 0;
      acc[slipId].feeCategories[category].totalVanFeeConcession += Number(curr.totalVanFeeConcession) || 0;
      acc[slipId].feeCategories[category].totalReceived += (Number(curr.totalFeeReceived) || 0) + (Number(curr.totalVanFee) || 0);
    }
    return acc;
  }, {});
  return Object.values(grouped);
};

// Get unique fee categories across all pivoted rows to generate table headers
const getUniqueCategories = (pivotedData) => {
  const categories = new Set();
  pivotedData.forEach((row) => {
    Object.keys(row.feeCategories).forEach((cat) => categories.add(cat));
  });
  return Array.from(categories);
};

// Calculate Category Summary (grouped by feeCategoryName with breakdown by PaymentMode)
const calculateCategorySummary = (data) => {
  const groups = data.reduce((acc, curr) => {
    const category = curr.feeCategoryName;
    if (!acc[category]) {
      acc[category] = {
        cash: { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0, totalReceived: 0 },
        online: { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0, totalReceived: 0 }
      };
    }
    if (curr.PaymentMode === 'Cash') {
      const fine = Number(curr.totalFine || curr.Fine_Amount || 0);
      acc[category].cash.totalFeeReceived += Number(curr.totalFeeReceived) || 0;
      acc[category].cash.totalConcession += Number(curr.totalConcession) || 0;
      acc[category].cash.totalVanFee += Number(curr.totalVanFee) || 0;
      acc[category].cash.totalVanFeeConcession += Number(curr.totalVanFeeConcession) || 0;
      acc[category].cash.totalReceived += 
        (Number(curr.totalFeeReceived) || 0) +
        (Number(curr.totalVanFee) || 0) +
        fine;
    } else if (curr.PaymentMode === 'Online') {
      const fine = Number(curr.totalFine || curr.Fine_Amount || 0);
      acc[category].online.totalFeeReceived += Number(curr.totalFeeReceived) || 0;
      acc[category].online.totalConcession += Number(curr.totalConcession) || 0;
      acc[category].online.totalVanFee += Number(curr.totalVanFee) || 0;
      acc[category].online.totalVanFeeConcession += Number(curr.totalVanFeeConcession) || 0;
      acc[category].online.totalReceived += 
        (Number(curr.totalFeeReceived) || 0) +
        (Number(curr.totalVanFee) || 0) +
        fine;
    }

    return acc;
  }, {});
  return Object.keys(groups).map(category => {
    const cash = groups[category].cash;
    const online = groups[category].online;
    const overall = {
      totalFeeReceived: cash.totalFeeReceived + online.totalFeeReceived,
      totalConcession: cash.totalConcession + online.totalConcession,
      totalVanFee: cash.totalVanFee + online.totalVanFee,
      totalVanFeeConcession: cash.totalVanFeeConcession + online.totalVanFeeConcession,
      totalReceived: cash.totalReceived + online.totalReceived
    };
    return { category, cash, online, overall };
  });
};

const DayWiseReport = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 500;

  // Fetch school details from API
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

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      const response = await api.get(`/reports/day-wise?startDate=${start}&endDate=${end}`);
      setReportData(response.data);
      setCurrentPage(1); // Reset pagination to first page
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

  // Pivot the report data for the table with unique Slip_ID rows
  const pivotedData = pivotReportData(reportData);
  // Unique fee categories for dynamic columns
  const uniqueCategories = getUniqueCategories(pivotedData);
  // Calculate Category Summary (from original data)
  const categorySummary = calculateCategorySummary(reportData);

  // Compute overall category totals (for the summary table footer)
  const overallCategoryTotals = categorySummary.reduce((acc, item) => {
    acc.cash.totalFeeReceived += item.cash.totalFeeReceived;
    acc.online.totalFeeReceived += item.online.totalFeeReceived;
    acc.cash.totalConcession += item.cash.totalConcession;
    acc.online.totalConcession += item.online.totalConcession;
    acc.cash.totalVanFee += item.cash.totalVanFee;
    acc.online.totalVanFee += item.online.totalVanFee;
    acc.cash.totalVanFeeConcession += item.cash.totalVanFeeConcession;
    acc.online.totalVanFeeConcession += item.online.totalVanFeeConcession;
    acc.cash.totalReceived += item.cash.totalReceived;
    acc.online.totalReceived += item.online.totalReceived;
    return acc;
  }, { 
    cash: { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0, totalReceived: 0 },
    online: { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0, totalReceived: 0 }
  });

  // Calculate paginated data (based on pivoted data now)
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = pivotedData.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(pivotedData.length / recordsPerPage);

  // Pagination change handler
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Compute overall totals across all slips (for the pivoted table footer)
  const overallTotals = uniqueCategories.reduce((totals, category) => {
    totals[category] = pivotedData.reduce((sum, row) => {
      const feeData = row.feeCategories[category];
      return sum + (feeData ? feeData.totalReceived : 0);
    }, 0);
    return totals;
  }, {});
  const grandTotal = Object.values(overallTotals).reduce((sum, val) => sum + val, 0);

  // Compute overall Van Fee total across all slips
  const overallVanFeeTotal = pivotedData.reduce((sum, row) => sum + (row.vanFeeTotal || 0), 0);

  const overallFineTotal = pivotedData.reduce((sum, row) => sum + (row.fineAmount || 0), 0);

  // Function to generate PDF blob and open in a new tab
  const openPdfInNewTab = async () => {
    if (!school) {
      alert('School details not available.');
      return;
    }
    const doc = (
      <PdfReports
        school={school}
        startDate={formatDate(startDate)}
        endDate={formatDate(endDate)}
        aggregatedData={reportData}
        feeCategories={uniqueCategories}
        categorySummary={categorySummary}
        transactionIds={reportData.map(item => item.Transaction_ID)} // ✅ ADD THIS
      />
    );
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <Container className="mt-4">
      <h1 className="text-center">Day Wise Report</h1>
      
      <Row className="justify-content-center mt-4">
        <Col md={3}>
          <Form.Group controlId="startDate">
            <Form.Label>Start Date</Form.Label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              dateFormat="yyyy-MM-dd"
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
              dateFormat="yyyy-MM-dd"
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
          <div className="w-100 d-flex">
            <Button
              variant="primary"
              onClick={handleGenerateReport}
              disabled={loading}
              className="me-2 flex-fill"
            >
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
            {reportData.length > 0 && school && (
              <Button variant="secondary" onClick={openPdfInNewTab} className="flex-fill">
                Print As PDF
              </Button>
            )}
          </div>
        </Col>
      </Row>
      {error && (
        <Row className="mt-3">
          <Col>
            <Alert variant="danger" className="text-center">{error}</Alert>
          </Col>
        </Row>
      )}

      {/* Pivoted Collection Report Section */}
      <Row className="mt-5">
        <Col>
          {pivotedData.length === 0 && !loading ? (
            <Alert variant="info" className="text-center">
              No data available for the selected date range.
            </Alert>
          ) : (
            <>
              <h2>Collection Report</h2>
              <div style={{ maxHeight: '400px', overflowY: 'auto', position: 'relative' }}>
                <Table striped bordered hover>
                  <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 2 }}>
                    <tr>
                      <th className="sticky-top bg-white">Sr. No</th>
                      <th className="sticky-top bg-white">Slip ID</th>
                      <th className="sticky-top bg-white">Admission Number</th>
                      <th className="sticky-top bg-white">Student Name</th>
                      <th className="sticky-top bg-white">Class</th>
                      <th className="sticky-top bg-white">Payment Mode</th>
                      <th className="sticky-top bg-white">Created At</th>
                      {uniqueCategories.map((cat, idx) => (
                        <th key={idx} className="sticky-top bg-white">{cat}</th>
                      ))}
                      <th className="sticky-top bg-white">Van Fee</th>
                      <th className="sticky-top bg-white">Fine</th>
                      <th className="sticky-top bg-white">Overall Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecords.map((row, idx) => {
                      // Sum the fee category totals
                      const categoryTotal = Object.values(row.feeCategories).reduce(
                        (sum, feeData) => sum + feeData.totalReceived, 0
                      );
                      // Now add the separate van fee total for Tuition Fee
                      const overallTotal = categoryTotal + (row.vanFeeTotal || 0);
                      return (
                        <tr key={row.Slip_ID}>
                          <td>{indexOfFirstRecord + idx + 1}</td>
                          <td>{row.Slip_ID}</td>
                          <td>{row.Student?.admission_number}</td>
                          <td>{row.Student?.name}</td>
                          <td>{row.Student?.Class?.class_name}</td>
                          <td>{row.PaymentMode}</td>
                          <td>{new Date(row.createdAt).toLocaleString()}</td>
                          {uniqueCategories.map((cat, i) => {
                            const feeData = row.feeCategories[cat];
                            return (
                              <td key={i}>
                                {feeData ? formatTotalValue(feeData.totalReceived) : formatTotalValue(0)}
                              </td>
                            );
                          })}
                         <td>{formatTotalValue(row.vanFeeTotal)}</td>
                        <td>
                          {row.fineAmount > 0 ? formatTotalValue(row.fineAmount) : "-"}
                        </td>
                        <td>{formatTotalValue(overallTotal + (row.fineAmount || 0))}</td>

                        </tr>
                      );
                    })}
                  </tbody>
                  {pivotedData.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={7}><strong>Overall Totals</strong></td> {/* If you added Fine column */}
                        {uniqueCategories.map((cat, i) => (
                          <td key={i}><strong>{formatTotalValue(overallTotals[cat])}</strong></td>
                        ))}
                        <td><strong>{formatTotalValue(overallVanFeeTotal)}</strong></td>
                        <td><strong>{formatTotalValue(overallFineTotal)}</strong></td>
                        <td><strong>{formatTotalValue(grandTotal + overallVanFeeTotal + overallFineTotal)}</strong></td>

                      </tr>
                    </tfoot>
                  )}
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

      {/* Category Summary Section */}
      <Row className="mt-5">
        <Col>
          {categorySummary.length > 0 && (
            <>
              <h2>Category Summary</h2>
              <div style={{ maxHeight: '400px', overflowY: 'auto', position: 'relative' }}>
                <Table striped bordered hover responsive>
                  <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff", zIndex: 2 }}>
                    <tr>
                      <th rowSpan="2" className="sticky-top bg-white">Category</th>
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
                    {categorySummary.map((item, index) => (
                      <tr key={index}>
                        <td>{item.category}</td>
                        <td>{formatTotalValue(item.cash.totalFeeReceived)}</td>
                        <td>{formatTotalValue(item.online.totalFeeReceived)}</td>
                        <td>{formatTotalValue(item.cash.totalFeeReceived + item.online.totalFeeReceived)}</td>
                        <td>{formatTotalValue(item.cash.totalConcession)}</td>
                        <td>{formatTotalValue(item.online.totalConcession)}</td>
                        <td>{formatTotalValue(item.cash.totalConcession + item.online.totalConcession)}</td>
                        <td>{formatTotalValue(item.cash.totalVanFee)}</td>
                        <td>{formatTotalValue(item.online.totalVanFee)}</td>
                        <td>{formatTotalValue(item.cash.totalVanFee + item.online.totalVanFee)}</td>
                        <td>{formatTotalValue(item.cash.totalVanFeeConcession)}</td>
                        <td>{formatTotalValue(item.online.totalVanFeeConcession)}</td>
                        <td>{formatTotalValue(item.cash.totalVanFeeConcession + item.online.totalVanFeeConcession)}</td>
                        <td>{formatTotalValue(item.cash.totalReceived)}</td>
                        <td>{formatTotalValue(item.online.totalReceived)}</td>
                        <td>{formatTotalValue(item.cash.totalReceived + item.online.totalReceived)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><strong>Overall Totals</strong></td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.cash.totalFeeReceived)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.online.totalFeeReceived)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(overallCategoryTotals.cash.totalFeeReceived + overallCategoryTotals.online.totalFeeReceived)}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.cash.totalConcession)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.online.totalConcession)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(overallCategoryTotals.cash.totalConcession + overallCategoryTotals.online.totalConcession)}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.cash.totalVanFee)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.online.totalVanFee)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(overallCategoryTotals.cash.totalVanFee + overallCategoryTotals.online.totalVanFee)}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.cash.totalVanFeeConcession)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.online.totalVanFeeConcession)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(overallCategoryTotals.cash.totalVanFeeConcession + overallCategoryTotals.online.totalVanFeeConcession)}
                        </strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.cash.totalReceived)}</strong>
                      </td>
                      <td>
                        <strong>{formatTotalValue(overallCategoryTotals.online.totalReceived)}</strong>
                      </td>
                      <td>
                        <strong>
                          {formatTotalValue(overallCategoryTotals.cash.totalReceived + overallCategoryTotals.online.totalReceived)}
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            </>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default DayWiseReport;
