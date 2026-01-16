// File: DayWiseReport.jsx
import React, { useState, useEffect, useMemo } from "react";
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
  Card,
  Badge,
  Spinner,
} from "react-bootstrap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import api from "../api";
import Swal from "sweetalert2";

import { pdf } from "@react-pdf/renderer";
import PdfReports from "./PdfReport";
import PdfReceiptDocument from "./Transactions/PdfReceiptDocument";
import ReceiptModal from "./Transactions/ReceiptModal";

/* ======================================================
   Helpers
====================================================== */

// Backend/API: yyyy-MM-dd
const formatDate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// UI: dd/MM/yyyy
const formatToDDMMYYYY = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// ₹ formatter
const formatTotalValue = (value) => {
  const n = Number(value) || 0;
  return n === 0 ? "0" : `₹${n.toLocaleString("en-IN")}`;
};

// Normalize payment mode (✅ HDFC treated as Online)
const normMode = (m) => String(m ?? "").trim().toLowerCase();
const isCash = (m) => normMode(m) === "cash";
const isOnline = (m) => ["online", "hdfc"].includes(normMode(m));

// Group report data by fee heading.
const groupByFeeHeading = (data) => {
  return data.reduce((groups, item) => {
    const feeHeading = item.feeHeadingName || "—";
    if (!groups[feeHeading]) groups[feeHeading] = [];
    groups[feeHeading].push(item);
    return groups;
  }, {});
};

// Calculate fee heading summary with payment mode breakdown (✅ HDFC counted as Online)
const calculateFeeHeadingSummary = (data) => {
  const groups = groupByFeeHeading(data);

  return Object.keys(groups).map((feeHeading) => {
    const items = groups[feeHeading];

    const cashTotals = items.reduce(
      (acc, item) => {
        if (isCash(item.PaymentMode)) {
          acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
          acc.totalConcession += Number(item.totalConcession) || 0;
          acc.totalVanFee += Number(item.totalVanFee) || 0;
          acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
          acc.totalFine += Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;
        }
        return acc;
      },
      {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalFine: 0,
      }
    );

    cashTotals.totalReceived =
      cashTotals.totalFeeReceived + cashTotals.totalVanFee + cashTotals.totalFine;

    const onlineTotals = items.reduce(
      (acc, item) => {
        if (isOnline(item.PaymentMode)) {
          acc.totalFeeReceived += Number(item.totalFeeReceived) || 0;
          acc.totalConcession += Number(item.totalConcession) || 0;
          acc.totalVanFee += Number(item.totalVanFee) || 0;
          acc.totalVanFeeConcession += Number(item.totalVanFeeConcession) || 0;
          acc.totalFine += Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;
        }
        return acc;
      },
      {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalFine: 0,
      }
    );

    onlineTotals.totalReceived =
      onlineTotals.totalFeeReceived + onlineTotals.totalVanFee + onlineTotals.totalFine;

    const overall = {
      totalFeeReceived: cashTotals.totalFeeReceived + onlineTotals.totalFeeReceived,
      totalConcession: cashTotals.totalConcession + onlineTotals.totalConcession,
      totalVanFee: cashTotals.totalVanFee + onlineTotals.totalVanFee,
      totalVanFeeConcession:
        cashTotals.totalVanFeeConcession + onlineTotals.totalVanFeeConcession,
      totalFine: cashTotals.totalFine + onlineTotals.totalFine,
      totalReceived: cashTotals.totalReceived + onlineTotals.totalReceived,
    };

    return { feeHeading, cash: cashTotals, online: onlineTotals, overall };
  });
};

/* ======================================================
   Component
====================================================== */

const DayWiseReport = () => {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [reportData, setReportData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [school, setSchool] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 500;

  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState(null);

  const fetchSchoolDetails = async () => {
    try {
      const response = await api.get("/schools");
      const data = response.data;

      if (Array.isArray(data) && data.length > 0) setSchool(data[0]);
      else if (data && Array.isArray(data.schools) && data.schools.length) setSchool(data.schools[0]);
      else if (data && data.school) setSchool(data.school);
      else if (data && typeof data === "object" && Object.keys(data).length) setSchool(data);
      else setSchool(null);
    } catch (err) {
      console.error("Error fetching school details:", err);
      setSchool(null);
    }
  };

  useEffect(() => {
    fetchSchoolDetails();
  }, []);

  // Search filtering
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setFilteredData(reportData);
      setCurrentPage(1);
      return;
    }

    const filtered = reportData.filter((item) => {
      const studentName = (item.Student?.name || "").toLowerCase();
      const adm = (item.Student?.admission_number || "").toLowerCase();
      const slip = (item.Slip_ID?.toString() || "").toLowerCase();
      const feeHeading = (item.feeHeadingName || "").toLowerCase();
      const pm = (item.PaymentMode || "").toLowerCase();
      return (
        studentName.includes(q) ||
        adm.includes(q) ||
        slip.includes(q) ||
        feeHeading.includes(q) ||
        pm.includes(q)
      );
    });

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [searchQuery, reportData]);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      Swal.fire("Missing dates", "Please select both start and end dates.", "warning");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const start = formatDate(startDate);
      const end = formatDate(endDate);
      const response = await api.get(`/reports/day-wise?startDate=${start}&endDate=${end}`);

      const rows = response.data || [];
      setReportData(rows);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      if (err?.response?.status === 401) {
        Swal.fire({
          title: "Session Expired",
          text: "Your session has expired. Please log in again.",
          icon: "warning",
          confirmButtonText: "OK",
        });
      } else {
        setError("Error fetching report data. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Robust receipt print (kept as you had)
  const handlePrintReceipt = async (slipId) => {
    try {
      Swal.fire({
        title: "Preparing receipt PDF…",
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false,
        showConfirmButton: false,
      });

      const [schoolResp, receiptResp] = await Promise.allSettled([
        api.get("/schools"),
        api.get(`/transactions/slip/${slipId}`),
      ]);

      // Normalize receipt
      let receipt = null;
      if (receiptResp.status === "fulfilled") {
        const r = receiptResp.value?.data;
        if (r && Array.isArray(r.data)) receipt = r.data;
        else if (Array.isArray(r)) receipt = r;
        else if (r && typeof r === "object") {
          if (r.data && Array.isArray(r.data)) receipt = r.data;
          else if (r.data && typeof r.data === "object") receipt = [r.data];
          else if (r.receipt && Array.isArray(r.receipt)) receipt = r.receipt;
          else receipt = [r];
        } else {
          receipt = receiptResp.value?.data ?? null;
          if (receipt && !Array.isArray(receipt)) receipt = [receipt];
        }
      }

      if (!receipt || receipt.length === 0) {
        Swal.close();
        Swal.fire("No receipt", "Server returned no receipt data.", "error");
        return;
      }

      // Normalize school
      let schoolData = null;
      if (schoolResp.status === "fulfilled") {
        const d = schoolResp.value?.data;
        if (d && Array.isArray(d.schools) && d.schools.length) schoolData = d.schools[0];
        else if (Array.isArray(d)) schoolData = d[0];
        else if (d && Array.isArray(d.data) && d.data.length) schoolData = d.data[0];
        else if (d && d.school) schoolData = d.school;
        else if (d && typeof d === "object" && Object.keys(d).length) schoolData = d;
      }

      if (!schoolData && receipt[0]) {
        const item = receipt[0];
        if (item.School || item.school) schoolData = item.School || item.school;
        else if (item.schoolName || item.institute_name) {
          schoolData = {
            name: item.schoolName || item.institute_name,
            address: item.schoolAddress || item.address || "",
            logo: item.logo || null,
          };
        }
      }

      if (!schoolData) {
        schoolData = { name: "Your School", address: "", logo: null, phone: "", email: "" };
      }

      // Prefer server-side PDF generation if you have an endpoint
      try {
        const payload = { receipt, school: schoolData, fileName: `Receipt-${slipId}` };
        const res = await api.post("/receipt-pdf/receipt/generate-pdf", payload, {
          responseType: "blob",
        });
        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => window.URL.revokeObjectURL(url), 60 * 1000);
        Swal.close();
        return;
      } catch (err) {
        console.warn("Server-side PDF generation failed, falling back to client-side PDF.", err?.message || err);
      }

      // Fallback: client-side @react-pdf/renderer
      try {
        const student = receipt[0].Student || receipt[0].student || null;
        const blob = await pdf(
          <PdfReceiptDocument school={schoolData} receipt={receipt} student={student} />
        ).toBlob();

        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000);
        Swal.close();
      } catch (err) {
        Swal.close();
        console.error("Error generating PDF blob:", err);
        Swal.fire("Error", "Failed to generate receipt PDF.", "error");
      }
    } catch (err) {
      Swal.close();
      console.error("Unexpected error preparing receipt:", err);
      Swal.fire("Error", err?.message || "Failed to prepare receipt PDF", "error");
    }
  };

  // Pagination
  const studentData = filteredData;

  const totalPages = Math.max(1, Math.ceil(studentData.length / recordsPerPage));
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = studentData.slice(indexOfFirstRecord, indexOfLastRecord);

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  // ✅ Better pagination display (avoid rendering 1000 buttons)
  const pageItems = useMemo(() => {
    const items = [];
    if (totalPages <= 1) return items;

    const maxButtons = 7;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }

    if (start > 1) {
      items.push(
        <Pagination.Item key={1} active={currentPage === 1} onClick={() => handlePageChange(1)}>
          1
        </Pagination.Item>
      );
      if (start > 2) items.push(<Pagination.Ellipsis key="s-ell" disabled />);
    }

    for (let p = start; p <= end; p++) {
      items.push(
        <Pagination.Item key={p} active={p === currentPage} onClick={() => handlePageChange(p)}>
          {p}
        </Pagination.Item>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) items.push(<Pagination.Ellipsis key="e-ell" disabled />);
      items.push(
        <Pagination.Item
          key={totalPages}
          active={currentPage === totalPages}
          onClick={() => handlePageChange(totalPages)}
        >
          {totalPages}
        </Pagination.Item>
      );
    }

    return items;
  }, [currentPage, totalPages]);

  // Totals
  const totalSummary = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => {
        const fee = Number(item.totalFeeReceived) || 0;
        const con = Number(item.totalConcession) || 0;
        const van = Number(item.totalVanFee) || 0;
        const vanCon = Number(item.totalVanFeeConcession) || 0;
        const fine = Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;

        acc.totalFeeReceived += fee;
        acc.totalConcession += con;
        acc.totalVanFee += van;
        acc.totalVanFeeConcession += vanCon;
        acc.totalFine += fine;
        acc.totalReceived += fee + van + fine;
        return acc;
      },
      {
        totalFeeReceived: 0,
        totalConcession: 0,
        totalVanFee: 0,
        totalVanFeeConcession: 0,
        totalFine: 0,
        totalReceived: 0,
      }
    );
  }, [filteredData]);

  // Payment mode summary (Cash/Online)
  const paymentModeSummary = useMemo(() => {
    return filteredData.reduce((acc, item) => {
      const key = isOnline(item.PaymentMode) ? "Online" : isCash(item.PaymentMode) ? "Cash" : (item.PaymentMode || "Other");

      if (!acc[key]) {
        acc[key] = {
          totalFeeReceived: 0,
          totalConcession: 0,
          totalVanFee: 0,
          totalVanFeeConcession: 0,
          totalFine: 0,
          totalReceived: 0,
          count: 0,
        };
      }

      const fee = Number(item.totalFeeReceived) || 0;
      const con = Number(item.totalConcession) || 0;
      const van = Number(item.totalVanFee) || 0;
      const vanCon = Number(item.totalVanFeeConcession) || 0;
      const fine = Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;

      acc[key].totalFeeReceived += fee;
      acc[key].totalConcession += con;
      acc[key].totalVanFee += van;
      acc[key].totalVanFeeConcession += vanCon;
      acc[key].totalFine += fine;
      acc[key].totalReceived += fee + van + fine;
      acc[key].count += 1;

      return acc;
    }, {});
  }, [filteredData]);

  const feeHeadingSummary = useMemo(() => {
    return filteredData.length ? calculateFeeHeadingSummary(filteredData) : [];
  }, [filteredData]);

  const totalFeeHeadingSummary = useMemo(() => {
    return feeHeadingSummary.reduce(
      (acc, cat) => {
        acc.totalFeeReceived.cash += cat.cash.totalFeeReceived;
        acc.totalFeeReceived.online += cat.online.totalFeeReceived;

        acc.totalConcession.cash += cat.cash.totalConcession;
        acc.totalConcession.online += cat.online.totalConcession;

        acc.totalVanFee.cash += cat.cash.totalVanFee;
        acc.totalVanFee.online += cat.online.totalVanFee;

        acc.totalVanFeeConcession.cash += cat.cash.totalVanFeeConcession;
        acc.totalVanFeeConcession.online += cat.online.totalVanFeeConcession;

        acc.totalFine.cash += cat.cash.totalFine || 0;
        acc.totalFine.online += cat.online.totalFine || 0;

        acc.totalReceived.cash += cat.cash.totalReceived;
        acc.totalReceived.online += cat.online.totalReceived;

        return acc;
      },
      {
        totalFeeReceived: { cash: 0, online: 0 },
        totalConcession: { cash: 0, online: 0 },
        totalVanFee: { cash: 0, online: 0 },
        totalVanFeeConcession: { cash: 0, online: 0 },
        totalFine: { cash: 0, online: 0 },
        totalReceived: { cash: 0, online: 0 },
      }
    );
  }, [feeHeadingSummary]);

  const viewReceipt = (slipId) => {
    setSelectedSlipId(slipId);
    setShowReceiptModal(true);
  };

  const openPdfInNewTab = async () => {
    if (!school) {
      Swal.fire("School missing", "School details not available.", "warning");
      return;
    }
    if (!startDate || !endDate) {
      Swal.fire("Missing dates", "Please select both start and end dates.", "warning");
      return;
    }

    const doc = (
      <PdfReports
        school={school}
        startDate={formatDate(startDate)}
        endDate={formatDate(endDate)}
        aggregatedData={filteredData}
        feeCategories={[]}
        categorySummary={calculateFeeHeadingSummary(filteredData)}
        totalSummary={{
          totalFeeReceived: totalSummary.totalFeeReceived,
          totalConcession: totalSummary.totalConcession,
          totalVanFee: totalSummary.totalVanFee,
          totalVanFeeConcession: totalSummary.totalVanFeeConcession,
          totalFine: totalSummary.totalFine,
          totalReceived: totalSummary.totalReceived,
        }}
      />
    );

    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
  };

  const hasData = reportData.length > 0;

  return (
    <Container className="mt-4">
      {/* Header */}
      <Row className="align-items-center mb-3">
        <Col>
          <h2 className="mb-0">Day Wise Report</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Select date range → generate report → search, view receipts, print PDFs
          </div>
        </Col>
        <Col className="d-flex justify-content-end gap-2">
          {hasData && school ? (
            <Button variant="outline-secondary" onClick={openPdfInNewTab}>
              Print Report PDF
            </Button>
          ) : (
            <Button variant="outline-secondary" disabled>
              Print Report PDF
            </Button>
          )}
        </Col>
      </Row>

      {/* Filters Card */}
      <Card className="shadow-sm border-0 mb-3">
        <Card.Body>
          <Row className="g-3">
            <Col md={3}>
              <Form.Group controlId="startDate">
                <Form.Label className="fw-semibold">Start Date</Form.Label>
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
                />
              </Form.Group>
            </Col>

            <Col md={3}>
              <Form.Group controlId="endDate">
                <Form.Label className="fw-semibold">End Date</Form.Label>
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
                {loading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Generating…
                  </>
                ) : (
                  "Generate Report"
                )}
              </Button>
            </Col>

            <Col md={3} className="d-flex align-items-end">
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="Search: name / adm / slip / heading / mode"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!hasData}
                />
                {searchQuery ? (
                  <Button variant="outline-secondary" onClick={() => setSearchQuery("")}>
                    Clear
                  </Button>
                ) : (
                  <Button variant="outline-secondary" disabled>
                    Clear
                  </Button>
                )}
              </InputGroup>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {hasData && (
        <Row className="g-3 mb-3">
          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Records</div>
                <div className="d-flex align-items-baseline gap-2">
                  <h4 className="mb-0">{filteredData.length}</h4>
                  <Badge bg="secondary">
                    Page {currentPage}/{totalPages}
                  </Badge>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Total Received (incl. Fine)</div>
                <h4 className="mb-0">{formatTotalValue(totalSummary.totalReceived)}</h4>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Fee + Van</div>
                <h4 className="mb-0">
                  {formatTotalValue((totalSummary.totalFeeReceived || 0) + (totalSummary.totalVanFee || 0))}
                </h4>
                <div className="text-muted" style={{ fontSize: 12 }}>
                  Fine: {formatTotalValue(totalSummary.totalFine)}
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col md={3}>
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="text-muted">Concession</div>
                <h4 className="mb-0">{formatTotalValue(totalSummary.totalConcession)}</h4>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Payment Mode Mini Summary */}
      {hasData && Object.keys(paymentModeSummary).length > 0 && (
        <Card className="shadow-sm border-0 mb-3">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <div className="fw-semibold">Payment Mode Summary</div>
              <div className="text-muted" style={{ fontSize: 12 }}>
                HDFC is counted under Online
              </div>
            </div>

            <Row className="g-2">
              {Object.keys(paymentModeSummary).map((k) => (
                <Col md={3} key={k}>
                  <Card className="border">
                    <Card.Body className="py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div className="fw-semibold">{k}</div>
                        <Badge bg="light" text="dark">
                          {paymentModeSummary[k].count}
                        </Badge>
                      </div>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        Total: {formatTotalValue(paymentModeSummary[k].totalReceived)}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Collection Report */}
      <Row className="mt-2">
        <Col>
          {!hasData && !loading ? (
            <Alert variant="info" className="text-center">
              No data available for the selected date range.
            </Alert>
          ) : (
            <>
              <div className="d-flex align-items-center justify-content-between mb-2">
                <h5 className="mb-0">Collection Report</h5>
                {hasData && (
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, studentData.length)} of{" "}
                    {studentData.length}
                  </div>
                )}
              </div>

              <div style={{ maxHeight: "460px", overflow: "auto" }} className="border rounded">
                <Table striped hover responsive className="mb-0">
                  <thead>
                    <tr>
                      {[
                        "Sr.",
                        "Slip ID",
                        "Admission No",
                        "Student Name",
                        "Class",
                        "Payment Mode",
                        "Fee Heading",
                        "Created At",
                        "Fee Received",
                        "Concession",
                        "Van Fee",
                        "Fine",
                        "Total Received",
                        "Remarks",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="sticky-top bg-white"
                          style={{ top: 0, zIndex: 2, whiteSpace: "nowrap" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {currentRecords.map((item, idx) => {
                      const fee = Number(item.totalFeeReceived) || 0;
                      const van = Number(item.totalVanFee) || 0;
                      const fineAmt = Number(item.totalFine ?? item.Fine_Amount ?? 0) || 0;
                      const total = fee + van + fineAmt;

                      const pmKey = isOnline(item.PaymentMode) ? "Online" : isCash(item.PaymentMode) ? "Cash" : "Other";

                      return (
                        <tr key={`${item.Slip_ID}-${idx}`}>
                          <td style={{ whiteSpace: "nowrap" }}>{indexOfFirstRecord + idx + 1}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <span className="fw-semibold">{item.Slip_ID}</span>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{item.Student?.admission_number || "—"}</td>
                          <td style={{ minWidth: 180 }}>{item.Student?.name || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{item.Student?.Class?.class_name || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <Badge bg={pmKey === "Cash" ? "success" : pmKey === "Online" ? "primary" : "secondary"}>
                              {isOnline(item.PaymentMode) ? "Online" : item.PaymentMode || "Other"}
                            </Badge>
                          </td>
                          <td style={{ minWidth: 180 }}>{item.feeHeadingName || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{formatToDDMMYYYY(item.createdAt)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{formatTotalValue(fee)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{formatTotalValue(item.totalConcession)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{formatTotalValue(van)}</td>

                          {/* ✅ FIXED: Fine rendering */}
                          <td style={{ whiteSpace: "nowrap" }}>
                            {fineAmt > 0 ? formatTotalValue(fineAmt) : "—"}
                          </td>

                          <td style={{ whiteSpace: "nowrap" }} className="fw-semibold">
                            {formatTotalValue(total)}
                          </td>
                          <td style={{ minWidth: 160 }}>{item.Remarks || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => viewReceipt(item.Slip_ID)}
                              className="me-2"
                            >
                              View
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handlePrintReceipt(item.Slip_ID)}
                            >
                              Print
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Pagination className="mb-0">
                    <Pagination.Prev
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    />
                    {pageItems}
                    <Pagination.Next
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    />
                  </Pagination>
                </div>
              )}
            </>
          )}
        </Col>
      </Row>

      {/* Fee Heading Summary */}
      <Row className="mt-4">
        <Col>
          {feeHeadingSummary.length > 0 && (
            <Card className="shadow-sm border-0">
              <Card.Body>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h5 className="mb-0">Fee Heading Summary</h5>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Cash vs Online vs Overall (includes Fine)
                  </div>
                </div>

                <div style={{ overflowX: "auto" }} className="border rounded">
                  <Table striped bordered hover responsive className="mb-0">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Fee Heading
                        </th>

                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Fee Received
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Concession
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Van Fee
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Van Fee Concession
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Fine
                        </th>
                        <th colSpan="3" className="sticky-top bg-white" style={{ top: 0, zIndex: 2 }}>
                          Total Received
                        </th>
                      </tr>

                      <tr>
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`fee-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`con-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`van-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`vcon-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`fine-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                        {["Cash", "Online", "Overall"].map((h) => (
                          <th key={`tot-${h}`} className="sticky-top bg-white" style={{ top: 42, zIndex: 2 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {feeHeadingSummary.map((cat, index) => (
                        <tr key={index}>
                          <td style={{ minWidth: 180 }}>{cat.feeHeading}</td>

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

                          <td>{formatTotalValue(cat.cash.totalFine)}</td>
                          <td>{formatTotalValue(cat.online.totalFine)}</td>
                          <td>{formatTotalValue(cat.overall.totalFine)}</td>

                          <td className="fw-semibold">{formatTotalValue(cat.cash.totalReceived)}</td>
                          <td className="fw-semibold">{formatTotalValue(cat.online.totalReceived)}</td>
                          <td className="fw-semibold">{formatTotalValue(cat.overall.totalReceived)}</td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr>
                        <td>
                          <strong>Overall Total</strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFeeReceived.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFeeReceived.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalFeeReceived.cash || 0) +
                                (totalFeeHeadingSummary.totalFeeReceived.online || 0)
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
                              (totalFeeHeadingSummary.totalConcession.cash || 0) +
                                (totalFeeHeadingSummary.totalConcession.online || 0)
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
                              (totalFeeHeadingSummary.totalVanFee.cash || 0) +
                                (totalFeeHeadingSummary.totalVanFee.online || 0)
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
                              (totalFeeHeadingSummary.totalVanFeeConcession.cash || 0) +
                                (totalFeeHeadingSummary.totalVanFeeConcession.online || 0)
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFine.cash)}</strong>
                        </td>
                        <td>
                          <strong>{formatTotalValue(totalFeeHeadingSummary.totalFine.online)}</strong>
                        </td>
                        <td>
                          <strong>
                            {formatTotalValue(
                              (totalFeeHeadingSummary.totalFine.cash || 0) +
                                (totalFeeHeadingSummary.totalFine.online || 0)
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
                              (totalFeeHeadingSummary.totalReceived.cash || 0) +
                                (totalFeeHeadingSummary.totalReceived.online || 0)
                            )}
                          </strong>
                        </td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Receipt Modal */}
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
