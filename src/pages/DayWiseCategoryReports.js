import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Table, Alert, Pagination, Spinner } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../api'; // Custom Axios instance (with token interceptor)
import Swal from 'sweetalert2';
import { pdf } from '@react-pdf/renderer';
import PdfReports from './PdfCategoryReport'; // Update path if your PDF component filename is different

// Excel libs
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

// Keep this as is for API calls (backend expects yyyy-MM-dd)
const formatDate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// UI-only formatter → dd/MM/yyyy
const formatToDDMMYYYY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Helper function for totals: if the value is nonzero, format it with commas and prefix with the Rupee symbol; otherwise, return "0"
const formatTotalValue = (value) => {
  return Number(value) === 0 ? "0" : `₹${Number(value).toLocaleString('en-IN')}`;
};

// ✅ Normalize /schools API into a single school object
const normalizeSchool = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw?.schools) && raw.schools.length) return raw.schools[0];
  if (Array.isArray(raw) && raw.length) return raw[0];
  if (Array.isArray(raw?.data) && raw.data.length) return raw.data[0];
  if (raw?.school && typeof raw.school === 'object') return raw.school;
  if (typeof raw === 'object' && Object.keys(raw).length) return raw;
  return null;
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
        fineAmount: 0,
         Remarks: curr.Remarks || null, // ✅ NEW
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
// Calculate Category Summary (grouped by feeCategoryName with breakdown by PaymentMode)
// ✅ Now counts HDFC as Online
const calculateCategorySummary = (data) => {
  const norm = (v) => String(v ?? "").trim().toLowerCase();
  const isCash = (m) => norm(m) === "cash";
  const isOnline = (m) => ["online", "hdfc"].includes(norm(m));

  const groups = data.reduce((acc, curr) => {
    const category = curr.feeCategoryName || "Unknown";
    if (!acc[category]) {
      acc[category] = {
        cash: {
          totalFeeReceived: 0,
          totalConcession: 0,
          totalVanFee: 0,
          totalVanFeeConcession: 0,
          totalReceived: 0,
        },
        online: {
          totalFeeReceived: 0,
          totalConcession: 0,
          totalVanFee: 0,
          totalVanFeeConcession: 0,
          totalReceived: 0,
        },
      };
    }

    const fine = Number(curr.totalFine || curr.Fine_Amount || 0);
    const fee = Number(curr.totalFeeReceived) || 0;
    const conc = Number(curr.totalConcession) || 0;
    const van = Number(curr.totalVanFee) || 0;
    const vanConc = Number(curr.totalVanFeeConcession) || 0;

    if (isCash(curr.PaymentMode)) {
      acc[category].cash.totalFeeReceived += fee;
      acc[category].cash.totalConcession += conc;
      acc[category].cash.totalVanFee += van;
      acc[category].cash.totalVanFeeConcession += vanConc;
      acc[category].cash.totalReceived += fee + van + fine;
    } else if (isOnline(curr.PaymentMode)) {
      // ✅ Online includes HDFC now
      acc[category].online.totalFeeReceived += fee;
      acc[category].online.totalConcession += conc;
      acc[category].online.totalVanFee += van;
      acc[category].online.totalVanFeeConcession += vanConc;
      acc[category].online.totalReceived += fee + van + fine;
    }

    return acc;
  }, {});

  return Object.keys(groups).map((category) => {
    const cash = groups[category].cash;
    const online = groups[category].online;
    const overall = {
      totalFeeReceived: cash.totalFeeReceived + online.totalFeeReceived,
      totalConcession: cash.totalConcession + online.totalConcession,
      totalVanFee: cash.totalVanFee + online.totalVanFee,
      totalVanFeeConcession: cash.totalVanFeeConcession + online.totalVanFeeConcession,
      totalReceived: cash.totalReceived + online.totalReceived,
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
  const [pdfLoading, setPdfLoading] = useState(false); // NEW: PDF loader state
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 500;

  // ✅ Fetch school details from API (normalized)
  const fetchSchoolDetails = async () => {
    try {
      const response = await api.get('/schools');
      const schoolObj = normalizeSchool(response.data);
      setSchool(schoolObj || null);
      if (!schoolObj) {
        console.warn('No valid school object found in /schools response');
      }
    } catch (err) {
      console.error('Error fetching school details:', err);
      setSchool(null);
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
      const start = formatDate(startDate);  // yyyy-MM-dd for backend
      const end = formatDate(endDate);      // yyyy-MM-dd for backend
      const response = await api.get(`/reports/day-wise?startDate=${start}&endDate=${end}`);
      setReportData(response.data || []);
      console.log('REPORT DATA LENGTH', (response.data || []).length);
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

  // NEW: openPdfInNewTab now fetches school details on-demand if missing,
  // and uses pivotedData/categorySummary/uniqueCategories to generate the same report PDF.
  const openPdfInNewTab = async () => {
    if (!reportData || reportData.length === 0) {
      alert('No report data to print. Please generate the report first.');
      return;
    }

    setPdfLoading(true);
    let schoolData = school;
    try {
      if (!schoolData) {
        // Fetch school details if not already loaded (normalized)
        const resp = await api.get('/schools');
        schoolData = normalizeSchool(resp.data);
        setSchool(schoolData);
        if (!schoolData) {
          console.warn('No school data returned from /schools');
          Swal.fire({
            title: 'Warning',
            text: 'Could not fetch school details. PDF will use a default header.',
            icon: 'warning',
            confirmButtonText: 'OK'
          });
          schoolData = { name: 'Your School', address: '', phone: '', email: '' };
        }
      }

      // Build document props consistent with the pivoted view
      const docProps = {
        school: schoolData,
        startDate: startDate ? formatDate(startDate) : null,
        endDate: endDate ? formatDate(endDate) : null,
        aggregatedData: reportData, // raw data (PdfReports component can decide how to use it)
        pivotedData,                // the pivoted rows — handy if your PDF component supports it
        feeCategories: uniqueCategories,
        categorySummary,
        totals: {
          grandTotal,
          overallVanFeeTotal,
          overallFineTotal,
        },
        transactionIds: reportData.map(item => item.Transaction_ID || item.Slip_ID)
      };

      const doc = <PdfReports {...docProps} />;
      const asPdf = pdf(doc);
      const blob = await asPdf.toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF. Check console for details.');
    } finally {
      setPdfLoading(false);
    }
  };

  /* ======================================================
     Excel export helpers
     - Builds 2 sheets: Collection (pivoted) + Category Summary
     - Uses XLSX to create workbook and file-saver to download
     ====================================================== */

  const buildCollectionSheetRows = (pivoted, categories) => {
    // Build header order
    const header = [
      'Sr No',
      'Slip_ID',
      'Admission Number',
      'Student Name',
      'Class',
      'PaymentMode',
      'Created At',
      ...categories,
      'Van Fee',
      'Fine',
      'Remarks',
      'Overall Total'
    ];

    // Build rows
    const rows = pivoted.map((row, idx) => {
      // Sum category totals
      const categoryTotal = Object.values(row.feeCategories).reduce(
        (sum, feeData) => sum + (feeData.totalReceived || 0), 0
      );
      const overallTotal = categoryTotal + (row.vanFeeTotal || 0) + (row.fineAmount || 0);

      // Flatten categories into values following header order
      const categoryValues = categories.map(cat => {
        const fd = row.feeCategories[cat];
        return fd ? fd.totalReceived : 0;
      });

      return {
        'Sr No': idx + 1,
        Slip_ID: row.Slip_ID,
        'Admission Number': row.Student?.admission_number || '',
        'Student Name': row.Student?.name || '',
        Class: row.Student?.Class?.class_name || '',
        PaymentMode: row.PaymentMode || '',
        'Created At': formatToDDMMYYYY(row.createdAt),
        ...categories.reduce((acc, cat, i) => { acc[cat] = categoryValues[i]; return acc; }, {}),
        'Van Fee': row.vanFeeTotal || 0,
        'Fine': row.fineAmount || 0,
        'Remarks': row.Remarks || '',  // ✅ new
        'Overall Total': overallTotal
      };
    });

    return { header, rows };
  };

  const buildCategorySummaryRows = (categorySummaryList) => {
    const rows = categorySummaryList.map((item) => ({
      Category: item.category,
      'Cash - FeeReceived': item.cash.totalFeeReceived || 0,
      'Online - FeeReceived': item.online.totalFeeReceived || 0,
      'Overall - FeeReceived': (item.cash.totalFeeReceived || 0) + (item.online.totalFeeReceived || 0),
      'Cash - Concession': item.cash.totalConcession || 0,
      'Online - Concession': item.online.totalConcession || 0,
      'Overall - Concession': (item.cash.totalConcession || 0) + (item.online.totalConcession || 0),
      'Cash - VanFee': item.cash.totalVanFee || 0,
      'Online - VanFee': item.online.totalVanFee || 0,
      'Overall - VanFee': (item.cash.totalVanFee || 0) + (item.online.totalVanFee || 0),
      'Cash - TotalReceived': item.cash.totalReceived || 0,
      'Online - TotalReceived': item.online.totalReceived || 0,
      'Overall - TotalReceived': (item.cash.totalReceived || 0) + (item.online.totalReceived || 0),
    }));

    return rows;
  };

  const exportToExcel = () => {
    if (!reportData || reportData.length === 0) {
      alert('No data to export.');
      return;
    }

    // Build Collection sheet
    const { header, rows } = buildCollectionSheetRows(pivotedData, uniqueCategories);
    const wsCollection = XLSX.utils.json_to_sheet(rows, { header: header });
    // Auto width (basic)
    const colWidths = header.map(h => ({ wch: Math.max(10, String(h).length + 2) }));
    wsCollection['!cols'] = colWidths;

    // Build Category Summary sheet
    const catRows = buildCategorySummaryRows(categorySummary);
    const wsCategory = XLSX.utils.json_to_sheet(catRows);
    wsCategory['!cols'] = Object.keys(catRows[0] || {}).map(k => ({ wch: Math.max(12, k.length + 2) }));

    // Create workbook and append sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsCollection, 'Collection');
    XLSX.utils.book_append_sheet(wb, wsCategory, 'Category Summary');

    // Add a totals sheet optionally
    const totalsSheetData = [
      { Metric: 'Grand Total (Categories)', Value: grandTotal },
      { Metric: 'Overall Van Fee Total', Value: overallVanFeeTotal },
      { Metric: 'Overall Fine Total', Value: overallFineTotal },
      { Metric: 'Grand Combined Total', Value: grandTotal + overallVanFeeTotal + overallFineTotal }
    ];
    const wsTotals = XLSX.utils.json_to_sheet(totalsSheetData);
    XLSX.utils.book_append_sheet(wb, wsTotals, 'Totals');

    // Generate binary and save
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    const fileName = `DayWiseReport_${formatDate(startDate)}_to_${formatDate(endDate)}.xlsx`;
    saveAs(blob, fileName);
  };

  return (
    <Container className="mt-4">
      <h1 className="text-center">Day Wise Report</h1>
      
      {/* -------------------------
         Date pickers and action buttons
         ------------------------- */}
      <Row className="justify-content-center mt-4">
        <Col md={3}>
          <Form.Group controlId="startDate">
            <Form.Label>Start Date</Form.Label>
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              dateFormat="dd/MM/yyyy"        // 👈 UI in dd/MM/yyyy
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
              dateFormat="dd/MM/yyyy"        // 👈 UI in dd/MM/yyyy
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
        <Col md={4} className="d-flex align-items-end">
          <div className="w-100 d-flex">
            <Button
              variant="primary"
              onClick={handleGenerateReport}
              disabled={loading || pdfLoading}
              className="me-2 flex-fill"
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Generating...
                </>
              ) : 'Generate Report'}
            </Button>

            {/* Print as PDF - enabled when reportData exists; fetches school if needed */}
            <Button
              variant="secondary"
              onClick={openPdfInNewTab}
              disabled={!reportData || reportData.length === 0 || pdfLoading}
              className="me-2 flex-fill"
              title={(!reportData || reportData.length === 0) ? 'No report data' : 'Print as PDF'}
            >
              {pdfLoading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Generating PDF...
                </>
              ) : (
                'Print As PDF'
              )}
            </Button>

            {/* Export to Excel - always visible, disabled if no data or pdf is generating */}
            <Button
              variant="success"
              onClick={exportToExcel}
              disabled={!reportData || reportData.length === 0 || pdfLoading}
              className="flex-fill"
              title={(!reportData || reportData.length === 0) ? 'No data to export' : 'Export as Excel'}
            >
              Export As Excel
            </Button>
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
                      <th className="sticky-top bg-white">Remarks</th>
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
                          {/* Force dd/MM/yyyy on UI */}
                          <td>{formatToDDMMYYYY(row.createdAt)}</td>
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
                          <td>{row.Remarks || "—"}</td> {/* ✅ new column */}
                          <td>{formatTotalValue(overallTotal + (row.fineAmount || 0))}</td>

                        </tr>
                      );
                    })}
                  </tbody>
                  {pivotedData.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={7}><strong>Overall Totals</strong></td>
                        {uniqueCategories.map((cat, i) => (
                          <td key={i}><strong>{formatTotalValue(overallTotals[cat])}</strong></td>
                        ))}
                        <td><strong>{formatTotalValue(overallVanFeeTotal)}</strong></td>
                        <td><strong>{formatTotalValue(overallFineTotal)}</strong></td>
                        <td><strong>—</strong></td>
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
