import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Table,
  Button,
  Alert,
  Pagination,
  Spinner,
  Card,
  Badge,
} from "react-bootstrap";
import api from "../api";
import Swal from "sweetalert2";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import PdfReceiptDocument from "./Transactions/PdfReceiptDocument";
import ReceiptModal from "./Transactions/ReceiptModal";

// Helper formatters
const formatTotalValue = (value) =>
  Number(value) === 0 ? "0" : `₹${Number(value).toLocaleString("en-IN")}`;
const formatToDDMMYYYY = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

const StudentFeeReport = () => {
  const { admissionNumber } = useParams();
  const [student, setStudent] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState(null);

  const recordsPerPage = 100;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchStudentReport = async () => {
      try {
        const res = await api.get(`/reports/student/${admissionNumber}`);
        setStudent(res.data.student || null);
        setReportData(res.data.report || []);
      } catch (err) {
        console.error("Error fetching student report:", err);
        setError("Failed to load student report. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchStudentReport();
  }, [admissionNumber]);

  // totals for the top cards
  const { totalFee, totalVan, totalFine } = useMemo(() => {
    const base = { totalFee: 0, totalVan: 0, totalFine: 0 };
    return reportData.reduce((acc, item) => {
      acc.totalFee += Number(item.totalFeeReceived || 0);
      acc.totalVan += Number(item.totalVanFee || 0);
      acc.totalFine += Number(item.totalFine || 0);
      return acc;
    }, base);
  }, [reportData]);

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

      let receipt = receiptResp.value?.data;
      if (!Array.isArray(receipt)) receipt = [receipt];
      const schoolData = Array.isArray(schoolResp.value?.data)
        ? schoolResp.value.data[0]
        : schoolResp.value?.data;

      const blob = await pdf(
        <PdfReceiptDocument school={schoolData} receipt={receipt} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
      Swal.close();
    } catch (err) {
      Swal.close();
      Swal.fire("Error", "Unable to print receipt", "error");
    }
  };

  const viewReceipt = (slipId) => {
    setSelectedSlipId(slipId);
    setShowReceiptModal(true);
  };

  const indexOfLast = currentPage * recordsPerPage;
  const indexOfFirst = indexOfLast - recordsPerPage;
  const currentRecords = reportData.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(reportData.length / recordsPerPage);

  // 🆕 Export to Excel
  const exportToExcel = () => {
    if (!reportData.length) {
      Swal.fire("No data", "There is no data to export.", "info");
      return;
    }

    const exportRows = reportData.map((item, index) => ({
      "Sr. No": index + 1,
      "Slip ID": item.Slip_ID,
      Date: formatToDDMMYYYY(item.transactionDate),
      "Fee Heading": item.feeHeadingName,
      Category: item.feeCategoryName,
      "Payment Mode": item.PaymentMode,
      "Fee Received": item.totalFeeReceived,
      "Van Fee": item.totalVanFee,
      Fine: item.totalFine,
      "Total Amount":
        Number(item.totalFeeReceived || 0) +
        Number(item.totalVanFee || 0) +
        Number(item.totalFine || 0),
      Remarks: item.Remarks || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Student Fee Report");

    // Add student name in file name
    const studentName = student?.name?.replace(/\s+/g, "_") || "Student";
    const fileName = `${studentName}_Fee_Report_${admissionNumber}.xlsx`;

    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), fileName);
  };

  const renderPaymentBadge = (mode) => {
    if (!mode) return "—";
    const modeUpper = mode.toUpperCase();
    let bg = "secondary";
    if (modeUpper === "CASH") bg = "success";
    else if (modeUpper === "ONLINE" || modeUpper === "UPI") bg = "info";
    else if (modeUpper === "CHEQUE") bg = "warning";
    return (
      <Badge bg={bg} pill>
        {mode}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" />
        <p className="mt-2 text-muted">Loading student report...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger" className="text-center">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(140deg, #f5f0ff 0%, #edf7ff 40%, #fff8ed 80%)",
        minHeight: "100vh",
        paddingBottom: "32px",
      }}
    >
      <Container className="pt-4">
        {/* Header / Hero */}
        <Card
          className="mb-4 border-0 shadow-sm"
          style={{
            borderRadius: "20px",
            background:
              "linear-gradient(135deg, #5b21b6 0%, #6366f1 50%, #ec4899 100%)",
            color: "#fff",
          }}
        >
          <Card.Body>
            <Row className="align-items-center g-3">
              <Col md={8}>
                <h3 className="mb-1 d-flex align-items-center gap-2">
                  <span
                    style={{
                      display: "inline-flex",
                      width: 34,
                      height: 34,
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.18)",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    ₹
                  </span>
                  Student Fee Report
                  <span
                    className="ms-2 px-2 py-1 rounded-pill"
                    style={{ background: "rgba(255,255,255,0.2)", fontSize: 12 }}
                  >
                    #{admissionNumber}
                  </span>
                </h3>
                <p className="mb-0" style={{ opacity: 0.9 }}>
                  {student?.name ? (
                    <>
                      <strong>{student.name}</strong>{" "}
                      {student.Class?.class_name
                        ? `• Class: ${student.Class.class_name}`
                        : ""}
                    </>
                  ) : (
                    "Unknown Student"
                  )}
                </p>
              </Col>
              <Col
                md={4}
                className="d-flex justify-content-md-end justify-content-start"
              >
                <Button
                  variant="light"
                  onClick={exportToExcel}
                  className="fw-semibold"
                  style={{ color: "#4f46e5" }}
                >
                  📊 Export to Excel
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Stats Row */}
        <Row className="g-3 mb-3">
          <Col md={4}>
            <Card
              className="h-100 border-0 shadow-sm"
              style={{
                borderRadius: "16px",
                background: "linear-gradient(160deg,#fff,#e0f2fe)",
              }}
            >
              <Card.Body>
                <p className="text-muted mb-1">Total Records</p>
                <h4 className="mb-0">{reportData.length}</h4>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card
              className="h-100 border-0 shadow-sm"
              style={{
                borderRadius: "16px",
                background: "linear-gradient(160deg,#fff,#fef3c7)",
              }}
            >
              <Card.Body>
                <p className="text-muted mb-1">Total Collected</p>
                <h4 className="mb-0">
                  {formatTotalValue(totalFee + totalVan + totalFine)}
                </h4>
                <small className="text-muted">
                  Fee: {formatTotalValue(totalFee)} • Van:{" "}
                  {formatTotalValue(totalVan)}
                </small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card
              className="h-100 border-0 shadow-sm"
              style={{
                borderRadius: "16px",
                background: "linear-gradient(160deg,#fff,#fee2e2)",
              }}
            >
              <Card.Body>
                <p className="text-muted mb-1">Fine Collected</p>
                <h4 className="mb-0">{formatTotalValue(totalFine)}</h4>
                <small className="text-muted">Across all slips</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        <h5 className="mb-2">Fee Collection Details</h5>

        {reportData.length === 0 ? (
          <Alert variant="info" className="text-center">
            No records found for this student.
          </Alert>
        ) : (
          <>
            <div
              style={{
                maxHeight: "430px",
                overflowY: "auto",
                borderRadius: "14px",
                boxShadow: "0 4px 18px rgba(15, 23, 42, 0.08)",
                border: "1px solid rgba(79,70,229,0.08)",
                background: "#fff",
              }}
            >
              <Table
                striped
                hover
                responsive
                className="mb-0 align-middle"
                style={{ minWidth: "1000px" }}
              >
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background:
                      "linear-gradient(180deg, #eff6ff 0%, #ffffff 100%)",
                  }}
                >
                  <tr>
                    <th style={{ width: "60px" }}>Sr.</th>
                    <th>Slip ID</th>
                    <th>Date</th>
                    <th>Fee Heading</th>
                    <th>Category</th>
                    <th>Payment Mode</th>
                    <th className="text-end">Fee Received</th>
                    <th className="text-end">Van Fee</th>
                    <th className="text-end">Fine</th>
                    <th className="text-end">Total</th>
                    <th>Remarks</th>
                    <th style={{ width: "140px" }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {currentRecords.map((item, idx) => {
                    const total =
                      Number(item.totalFeeReceived || 0) +
                      Number(item.totalVanFee || 0) +
                      Number(item.totalFine || 0);
                    return (
                      <tr key={idx}>
                        <td>{indexOfFirst + idx + 1}</td>
                        <td>
                          <Badge bg="purple" text="light">
                            {item.Slip_ID}
                          </Badge>
                        </td>
                        <td>{formatToDDMMYYYY(item.transactionDate)}</td>
                        <td>{item.feeHeadingName}</td>
                        <td>
                          <Badge bg="light" text="dark">
                            {item.feeCategoryName}
                          </Badge>
                        </td>
                        <td>{renderPaymentBadge(item.PaymentMode)}</td>
                        <td className="text-end">
                          {formatTotalValue(item.totalFeeReceived)}
                        </td>
                        <td className="text-end">
                          {formatTotalValue(item.totalVanFee)}
                        </td>
                        <td className="text-end">
                          {formatTotalValue(item.totalFine)}
                        </td>
                        <td className="text-end">{formatTotalValue(total)}</td>
                        <td>{item.Remarks || "—"}</td>
                        <td>
                          <div className="d-flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => viewReceipt(item.Slip_ID)}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-secondary"
                              onClick={() => handlePrintReceipt(item.Slip_ID)}
                            >
                              Print
                            </Button>
                          </div>
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
                    onClick={() => setCurrentPage(idx + 1)}
                  >
                    {idx + 1}
                  </Pagination.Item>
                ))}
              </Pagination>
            )}
          </>
        )}

        {/* Receipt Modal */}
        {showReceiptModal && (
          <ReceiptModal
            show={showReceiptModal}
            onClose={() => setShowReceiptModal(false)}
            slipId={selectedSlipId}
          />
        )}
      </Container>
    </div>
  );
};

export default StudentFeeReport;
