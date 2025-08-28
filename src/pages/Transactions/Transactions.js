// Transactions.js
import React, { useState, useEffect, useMemo } from "react";
import { pdf } from "@react-pdf/renderer";
import PdfReceiptDocument from "./PdfReceiptDocument"; // Use the shared PDF document component
import api from "../../api";
import Swal from "sweetalert2";
import {
  Modal,
  Button,
  Tabs,
  Tab,
  Form,
  Row,
  Col,
  Card,
  OverlayTrigger,
  Tooltip,
  Badge,
} from "react-bootstrap";
import ReceiptModal from "./ReceiptModal"; // For the pop-up view
import "bootstrap/dist/css/bootstrap.min.css";

/* ---------------- Helpers ---------------- */
const formatINR = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/* ----- Print Receipt (opens new tab with blob) ----- */
const handlePrintReceipt = async (slipId) => {
  try {
    const schoolResponse = await api.get("/schools");
    const school = schoolResponse.data.length > 0 ? schoolResponse.data[0] : null;
    const receiptResponse = await api.get(`/transactions/slip/${slipId}`);
    const receipt = receiptResponse.data.data;

    if (!school || !receipt || receipt.length === 0) {
      console.error("Insufficient data to generate PDF");
      return;
    }
    const student = receipt[0].Student;
    if (!student) {
      console.error("Student data missing in receipt");
      return;
    }

    const blob = await pdf(
      <PdfReceiptDocument school={school} receipt={receipt} student={student} />
    ).toBlob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  } catch (error) {
    console.error("Error generating PDF blob:", error);
  }
};

const Transactions = () => {
  const [userRole, setUserRole] = useState(localStorage.getItem("activeRole") || "");

  useEffect(() => {
    const handler = () => setUserRole(localStorage.getItem("activeRole") || "");
    window.addEventListener("role-changed", handler);
    return () => window.removeEventListener("role-changed", handler);
  }, []);

  const isCancelled = (txn) => txn.status === "cancelled";
  const canCancel = () => userRole === "admin" || userRole === "superadmin";
  const canDelete = (txn) => userRole === "superadmin" && isCancelled(txn);

  const [transactions, setTransactions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null);
  const [newTransactionDetails, setNewTransactionDetails] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("admissionNumber");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [transactionID, setTransactionID] = useState("");
  const [daySummary, setDaySummary] = useState({ data: [], grandTotal: 0 });
  const [searchAdmissionNumber, setSearchAdmissionNumber] = useState("");
  const [selectedAdmissionStudent, setSelectedAdmissionStudent] = useState(null);

  // Receipt Modal states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState(null);

  // Transportation
  const [transportRoutes, setTransportRoutes] = useState([]);

  // Quick global allocator input (shown above table now)
  const [quickAmount, setQuickAmount] = useState("");

  const POLLING_INTERVAL = 5000;

  const viewReceipt = (slipId) => {
    setSelectedSlipId(slipId);
    setShowReceiptModal(true);
  };

  /* ---------------- Totals ---------------- */
  const totalFeeReceived = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.Fee_Recieved || 0), 0),
    [newTransactionDetails]
  );
  const totalVanFee = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.VanFee || 0), 0),
    [newTransactionDetails]
  );
  const totalConcessions = useMemo(
    () =>
      newTransactionDetails.reduce(
        (t, i) => t + ((i.Concession || 0) + (i.Van_Fee_Concession || 0)),
        0
      ),
    [newTransactionDetails]
  );
  const totalFine = useMemo(
    () => newTransactionDetails.reduce((t, i) => t + (i.Fine_Amount || 0), 0),
    [newTransactionDetails]
  );
  const grandTotal = useMemo(
    () => totalFeeReceived + totalVanFee + totalFine,
    [totalFeeReceived, totalVanFee, totalFine]
  );

  /* ---------------- Fetchers ---------------- */
  // Fine eligibility per fee-head for the student
  const fetchFineEligibility = async (studentId) => {
    try {
      const res = await api.get(`/transactions/fine-eligibility/${studentId}`);
      return res.data?.data || {};
    } catch (e) {
      console.error("Error fetching fine eligibility:", e);
      return {};
    }
  };

  const fetchTransportRoutes = async () => {
    try {
      const response = await api.get("/transportations");
      setTransportRoutes(response.data || []);
    } catch (error) {
      console.error("Error fetching transport routes:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await api.get("/transactions");
      setTransactions(response.data.data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const fetchDaySummary = async () => {
    try {
      const response = await api.get("/transactions/summary/day-summary");
      setDaySummary(response.data || { data: [], grandTotal: 0 });
    } catch (error) {
      console.error("Error fetching day summary:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      setClasses(response.data || []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await api.get("/sections");
      setSections(response.data || []);
    } catch (error) {
      console.error("Error fetching sections:", error);
    }
  };

  const fetchStudentsByClassAndSection = async () => {
    if (!selectedClass || !selectedSection) return;
    try {
      const response = await api.get(
        `/students/searchByClassAndSection?class_id=${selectedClass}&section_id=${selectedSection}`
      );
      setStudents(response.data || []);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  // Fee details + dues
  const fetchFeeHeadsForStudent = async (_classId, studentId) => {
    try {
      // 1) Base fee details for the student
      const feeResponse = await api.get(`/students/${studentId}/fee-details`);
      const feeDetailsData = feeResponse.data.feeDetails || [];

      // 2) Other totals used
      const [receivedVanFeeResponse, lastRouteResponse, routeDetailsResponse, fineEligibilityMap] =
        await Promise.all([
          api.get(`/transactions/vanfee/${studentId}`),
          api.get(`/transactions/last-route/${studentId}`),
          api.get(`/transportations`),
          fetchFineEligibility(studentId),
        ]);

      // Van fee aggregates
      const receivedVanFeeMap = {};
      const vanFeeConcessionMap = {};
      (receivedVanFeeResponse.data.data || []).forEach((item) => {
        receivedVanFeeMap[item.Fee_Head] = parseFloat(item.TotalVanFeeReceived) || 0;
        vanFeeConcessionMap[item.Fee_Head] = parseFloat(item.TotalVanFeeConcession) || 0;
      });

      // Last selected route per head
      const lastRouteMap = {};
      (lastRouteResponse.data.data || []).forEach((item) => {
        lastRouteMap[item.Fee_Head] = item.Route_Number || "";
      });

      const transportRoutesData = routeDetailsResponse.data || [];
      const today = new Date();

      const feeDetails = feeDetailsData.map((detail) => {
        const headId = detail.fee_heading_id;
        const transportApplicable = detail.transportApplicable === "Yes";

        // academic due
        const baseFeeDue = detail.feeDue || 0;
        const extraConcession = 0; // manual concession entered now (starts 0)
        const academicDue = Math.max(0, baseFeeDue - extraConcession);

        // ---- FINE ELIGIBILITY (one-time per head) ----
        const key = String(headId);
        let eligible;
        if (fineEligibilityMap && Object.prototype.hasOwnProperty.call(fineEligibilityMap, key)) {
          const val = fineEligibilityMap[key];
          eligible = (val === true || val === "true" || val === 1 || val === "1");
        } else {
          eligible = true;
        }

        const originalFine = eligible ? (detail.fineAmount || 0) : 0;

        // transport/vans
        const lastRoute = lastRouteMap[headId] || "";
        const selectedRouteObj = transportRoutesData.find((r) => r.id == lastRoute);
        const selectedRouteFee = selectedRouteObj ? selectedRouteObj.Cost : 0;

        const receivedVanFee = receivedVanFeeMap[headId] || 0;
        const vanFeeConcession = vanFeeConcessionMap[headId] || 0;

        let vanOverdueDays = 0;
        if (selectedRouteObj && selectedRouteObj.fineStartDate) {
          const vanFineStartDate = new Date(selectedRouteObj.fineStartDate);
          if (today > vanFineStartDate) {
            vanOverdueDays = Math.floor((today - vanFineStartDate) / (1000 * 60 * 60 * 24));
          }
        }
        const vanFinePercentage = selectedRouteObj ? selectedRouteObj.finePercentage || 0 : 0;
        const vanFineAmount =
          vanOverdueDays > 0 && selectedRouteFee > receivedVanFee
            ? Math.ceil(((selectedRouteFee - receivedVanFee) * vanFinePercentage * vanOverdueDays) / 100)
            : 0;

        const finalVanDue = Math.max(
          0,
          selectedRouteFee - receivedVanFee - vanFeeConcession + vanFineAmount
        );

        return {
          // ids/names
          Fee_Head: headId,
          Fee_Heading_Name: detail.fee_heading,

          // academic fee numbers
          Fee_Due: academicDue,
          Original_Fee_Due: detail.original_fee_due,

          // fine fields (front-end view only; charge only if eligible)
          fineAmount: originalFine,
          isFineApplicable: eligible && (originalFine > 0),
          Fine_Amount: 0, // input value to collect now (will remain 0 if not eligible)

          // concessions/receive
          defaultConcessionAmount: detail.concession_applied ? detail.concession_amount : 0,
          Fee_Recieved: 0,
          Concession: extraConcession,

          // transport
          VanFee: 0,
          Van_Fee_Concession: 0,
          SelectedRoute: lastRoute,
          ShowVanFeeInput: transportApplicable,
          _receivedVanFee: receivedVanFee,
          _vanFeeConcession: vanFeeConcession,
          Van_Fee_Due: finalVanDue,
          Van_Fine_Amount: vanFineAmount,
        };
      });

      setFeeHeads(feeDetails);
      setNewTransactionDetails(feeDetails);
      if (feeResponse.data.student) {
        setSelectedStudentInfo(feeResponse.data.student);
      }
    } catch (error) {
      console.error("Error fetching fee details:", error);
      setFeeHeads([]);
      setNewTransactionDetails([]);
    }
  };

  const fetchStudentAndFeeByAdmissionNumber = async () => {
    if (!searchAdmissionNumber) return;
    try {
      const response = await api.get(`/students/admission/${searchAdmissionNumber}`);
      if (response.data) {
        if (!selectedAdmissionStudent || selectedAdmissionStudent.id !== response.data.id) {
          setSelectedAdmissionStudent(response.data);
          setSelectedStudentInfo(response.data);
          fetchFeeHeadsForStudent(response.data.class_id, response.data.id);
        }
      } else {
        Swal.fire("Not Found!", "No student found with this admission number.", "error");
        setSelectedAdmissionStudent(null);
        setSelectedStudentInfo(null);
        setFeeHeads([]);
      }
    } catch (error) {
      console.error("Error fetching student:", error);
      Swal.fire("Error!", "An error occurred while searching for the student.", "error");
    }
  };

  /* ---------------- Quick Allocate Logic ---------------- */
  const getAcademicRemaining = (row) =>
    Math.max(0, (row.Fee_Due || 0) - (row.Fee_Recieved || 0) - (row.Concession || 0));

  const getFineRemaining = (row) =>
    row.isFineApplicable ? Math.max(0, (row.fineAmount || 0) - (row.Fine_Amount || 0)) : 0;

  const sortTuitionFirst = (rows) => {
    // Tuition-fee rows first (case-insensitive substring match), maintain relative order otherwise
    const withIdx = rows.map((r, i) => ({ r, i }));
    withIdx.sort((a, b) => {
      const at = /tuition/i.test(a.r.Fee_Heading_Name) ? 1 : 0;
      const bt = /tuition/i.test(b.r.Fee_Heading_Name) ? 1 : 0;
      if (bt !== at) return bt - at; // tuition first
      return a.i - b.i;
    });
    return withIdx.map((x) => x.i);
  };

  // ALWAYS allocates: per head -> dues first, then its fine, then next head
  const autoAllocateQuickAmount = () => {
    const amt = parseInt(quickAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      Swal.fire("Enter amount", "Please enter a positive amount to auto-fill.", "info");
      return;
    }
    if (!newTransactionDetails.length) {
      Swal.fire("Select Student", "Pick a student and load fee details first.", "warning");
      return;
    }

    let remaining = amt;
    const updated = newTransactionDetails.map((d) => ({ ...d }));
    const order = sortTuitionFirst(updated);

    for (const idx of order) {
      if (remaining <= 0) break;
      const row = updated[idx];

      // 1) Academic due for this head
      const acadNeed = getAcademicRemaining(row);
      if (acadNeed > 0 && remaining > 0) {
        const take = Math.min(remaining, acadNeed);
        row.Fee_Recieved = (row.Fee_Recieved || 0) + take;
        remaining -= take;
      }

      // 2) Fine for this head (if applicable)
      const fineNeed = getFineRemaining(row);
      if (fineNeed > 0 && remaining > 0) {
        const takeFine = Math.min(remaining, fineNeed);
        row.Fine_Amount = (row.Fine_Amount || 0) + takeFine;
        remaining -= takeFine;
      }
    }

    setNewTransactionDetails(updated);

    if (remaining > 0) {
      Swal.fire(
        "Amount left",
        `₹${remaining.toLocaleString("en-IN")} could not be allocated (no remaining dues/fines).`,
        "info"
      );
    }
  };

  const clearQuickAllocations = () => {
    if (!newTransactionDetails.length) return;
    const cleared = newTransactionDetails.map((d) => ({
      ...d,
      Fee_Recieved: 0,
      Fine_Amount: 0,
      // leave Concession, VanFee, etc. untouched
    }));
    setNewTransactionDetails(cleared);
  };

  /* ---------------- Mutations ---------------- */
  const saveTransaction = async () => {
    try {
      if (editingTransaction) {
        const updatedTransaction = {
          Fee_Recieved: editingTransaction.Fee_Recieved,
          Concession: editingTransaction.Concession,
          VanFee: editingTransaction.VanFee,
          Fine_Amount: editingTransaction.Fine_Amount || 0,
          Van_Fee_Concession: editingTransaction.Van_Fee_Concession,
          PaymentMode: editingTransaction.PaymentMode,
          Transaction_ID:
            editingTransaction.PaymentMode === "Online"
              ? editingTransaction.Transaction_ID
              : null,
        };

        const response = await api.put(
          `/transactions/${editingTransaction.Serial}`,
          updatedTransaction
        );

        if (response.data.success) {
          Swal.fire("Updated!", "Transaction has been updated successfully.", "success");
          fetchTransactions();
          fetchDaySummary();
          setShowModal(false);
          setEditingTransaction(null);
        }
      } else {
        if (!selectedStudentInfo || newTransactionDetails.length === 0) {
          Swal.fire("Error!", "Please select a student and fill in the fee details.", "error");
          return;
        }
        if (!paymentMode) {
          Swal.fire("Required!", "Please select a payment mode.", "warning");
          return;
        }

        const transactionsPayload = newTransactionDetails.map((details) => ({
          AdmissionNumber: selectedStudentInfo.admission_number,
          Student_ID: selectedStudentInfo.id,
          Class_ID: selectedStudentInfo.class_id,
          Section_ID: selectedStudentInfo.section_id,
          DateOfTransaction: new Date().toISOString(),
          Fee_Head: details.Fee_Head,
          Fee_Recieved: details.Fee_Recieved,
          Concession: details.Concession,
          VanFee: details.ShowVanFeeInput ? details.VanFee || 0 : null,
          Van_Fee_Concession: details.ShowVanFeeInput ? details.Van_Fee_Concession || 0 : null,
          Route_ID: details.ShowVanFeeInput ? details.SelectedRoute : null,
          PaymentMode: paymentMode,
          Transaction_ID: paymentMode === "Online" ? transactionID : null,
          Fine_Amount: details.isFineApplicable ? (details.Fine_Amount || 0) : 0,
        }));

        const response = await api.post("/transactions/bulk", { transactions: transactionsPayload });

        if (response.data.success) {
          Swal.fire({
            title: "Added!",
            text: `Transactions added with Slip ID: ${response.data.slipId}. Print receipt?`,
            icon: "success",
            showCancelButton: true,
            confirmButtonText: "Print Receipt",
            cancelButtonText: "Close",
            allowOutsideClick: false,
          }).then((result) => {
            if (result.isConfirmed) handlePrintReceipt(response.data.slipId);
          });
          resetForm();
          fetchTransactions();
          fetchDaySummary();
        }
        await fetchFeeHeadsForStudent(selectedStudentInfo.class_id, selectedStudentInfo.id);
      }
    } catch (error) {
      console.error("Error saving transactions:", error);
      Swal.fire("Error!", "An error occurred while saving the transaction.", "error");
    }
  };

  const resetForm = () => {
    setFeeHeads([]);
    setNewTransactionDetails([]);
    setSelectedStudentInfo(null);
    setSelectedClass("");
    setSelectedSection("");
    setStudents([]);
    setShowModal(false);
    setPaymentMode("Cash");
    setTransactionID("");
    setQuickAmount("");
  };

  const cancelTransaction = async (id) => {
    try {
      await api.post(`/transactions/${id}/cancel`);
      Swal.fire("Cancelled!", "Transaction has been cancelled.", "success");
      fetchTransactions();
      fetchDaySummary();
    } catch (error) {
      console.error("Error cancelling transaction:", error);
      Swal.fire("Error!", error.response?.data?.message || "Unable to cancel.", "error");
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      Swal.fire("Deleted!", "Transaction permanently deleted.", "success");
      fetchTransactions();
      fetchDaySummary();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      Swal.fire("Error!", error.response?.data?.message || "Unable to delete.", "error");
    }
  };

  /* ---------------- Effects ---------------- */
  useEffect(() => {
    fetchTransportRoutes();
    fetchClasses();
    fetchSections();
  }, []);

  useEffect(() => {
    if (showModal) {
      setSearchAdmissionNumber("");
      setSelectedAdmissionStudent(null);
      setSelectedStudentInfo(null);
      setFeeHeads([]);
      setNewTransactionDetails([]);
      setPaymentMode("Cash");
      setTransactionID("");
      setQuickAmount("");
    }
  }, [showModal]);

  useEffect(() => {
    fetchStudentsByClassAndSection();
  }, [selectedClass, selectedSection]);

  useEffect(() => {
    fetchTransactions();
    fetchDaySummary();
    const intervalId = setInterval(() => {
      fetchTransactions();
      fetchDaySummary();
    }, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, []);

  const cashCollection = useMemo(() => {
    return (daySummary.paymentSummary || [])
      .filter((p) => p.PaymentMode === "Cash")
      .reduce((acc, p) => acc + parseFloat(p.TotalAmountCollected || 0), 0);
  }, [daySummary.paymentSummary]);

  /* ---------------- UI ---------------- */
  return (
    <div className="container-fluid mt-4">
      <h2 className="mb-3 text-center">Transactions Management</h2>

      {/* Summary Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold text-primary">Transaction Summary for Today</h4>
        <span className="text-muted fs-6">{new Date().toLocaleDateString()}</span>
      </div>

      {/* KPI Cards */}
      {daySummary && daySummary.data ? (
        <Row className="mb-4 g-3">
          <Col md={3}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">Total Collection</div>
                <div className="fs-3 fw-bold">{formatINR(daySummary.grandTotal || 0)}</div>
                <Badge bg="success" className="mt-2">Cash: {formatINR(cashCollection)}</Badge>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">Fee Received</div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalFeeReceived || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">Van Fee</div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalVanFee || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">Concession</div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalConcession || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">Fine</div>
                <div className="fs-4 fw-bold">
                  {formatINR(
                    (daySummary.data || []).reduce(
                      (acc, it) => acc + parseFloat(it.TotalFine || 0),
                      0
                    )
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : (
        <p className="text-center text-muted">Loading transaction summary...</p>
      )}

      {/* Payment Mode Wise */}
      <Row className="mb-4 g-3">
        {(daySummary.paymentSummary || []).map((p) => (
          <Col md={3} key={p.PaymentMode}>
            <Card className="shadow-sm border-0 h-100">
              <Card.Body className="text-center">
                <div className="small text-uppercase text-muted mb-1">
                  {p.PaymentMode === "Cash" ? "Cash Collection" : "Online Collection"}
                </div>
                <div className="fs-4 fw-bold">
                  {formatINR(parseFloat(p.TotalAmountCollected || 0))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Actions */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Button
          variant="success"
          className="btn-collect"
          onClick={() => {
            setEditingTransaction(null);
            resetForm();
            fetchClasses();
            fetchSections();
            fetchStudentsByClassAndSection();
            setShowModal(true);
          }}
        >
          + Collect Fee
        </Button>
      </div>

      {/* Transactions Table */}
      <div className="table-responsive">
        <table className="table table-striped table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Slip ID</th>
              <th>Adm. No.</th>
              <th>Class</th>
              <th>Date & Time</th>
              <th>Head</th>
              <th>Concession</th>
              <th>Fee Received</th>
              <th>Van Fee</th>
              <th>Fine</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Actions</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const grouped = new Map();
              transactions
                .filter((t) => t.status !== "cancelled")
                .forEach((t) => {
                  if (!grouped.has(t.Slip_ID)) grouped.set(t.Slip_ID, []);
                  grouped.get(t.Slip_ID).push(t);
                });

              return Array.from(grouped.entries()).flatMap(([slipID, group]) =>
                group.map((t, index) => {
                  const isMiddleRow = index === Math.floor(group.length / 2);
                  return (
                    <tr key={t.Serial}>
                      <td>{transactions.length - transactions.indexOf(t)}</td>
                      <td>{t.Student?.name || "—"}</td>
                      <td>{t.Slip_ID}</td>
                      <td>{t.AdmissionNumber}</td>
                      <td>{t.Class?.class_name || "—"}</td>
                      <td>{new Date(t.DateOfTransaction).toLocaleString()}</td>
                      <td>{t.FeeHeading?.fee_heading || "—"}</td>
                      <td>{formatINR(t.Concession)}</td>
                      <td>{formatINR(t.Fee_Recieved)}</td>
                      <td>{formatINR(t.VanFee)}</td>
                      <td className={t.Fine_Amount > 0 ? "text-danger fw-bold" : ""}>
                        {formatINR(t.Fine_Amount || 0)}
                      </td>
                      <td>{t.PaymentMode}</td>
                      <td>
                        <Badge bg="success">Active</Badge>
                      </td>
                      <td className="text-nowrap">
                        <Button
                          variant="primary"
                          size="sm"
                          className="me-1"
                          onClick={() => {
                            setEditingTransaction({
                              Serial: t.Serial,
                              Fee_Recieved: t.Fee_Recieved,
                              Concession: t.Concession,
                              VanFee: t.VanFee,
                              Fine_Amount: t.Fine_Amount || 0,
                              PaymentMode: t.PaymentMode,
                              Transaction_ID: t.Transaction_ID || "",
                              FeeHeadingName: t.FeeHeading?.fee_heading || "—",
                              StudentName: t.Student?.name || "—",
                              AdmissionNumber: t.AdmissionNumber,
                              ClassName: t.Class?.class_name || "—",
                              DateOfTransaction: t.DateOfTransaction,
                            });
                            setShowModal(true);
                          }}
                        >
                          Edit
                        </Button>

                        {canCancel() && (
                          <Button
                            variant="warning"
                            size="sm"
                            className="me-1"
                            onClick={() =>
                              Swal.fire({
                                title: "Cancel this transaction?",
                                text: "Status will become cancelled.",
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: "Yes, cancel",
                              }).then((r) => {
                                if (r.isConfirmed) cancelTransaction(t.Serial);
                              })
                            }
                          >
                            Cancel
                          </Button>
                        )}

                        {canDelete(t) && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() =>
                              Swal.fire({
                                title: "Delete permanently?",
                                text: "This cannot be undone.",
                                icon: "error",
                                showCancelButton: true,
                                confirmButtonText: "Yes, delete",
                              }).then((r) => {
                                if (r.isConfirmed) deleteTransaction(t.Serial);
                              })
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </td>

                      {isMiddleRow && (
                        <td className="align-middle text-center border-start border-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => viewReceipt(t.Slip_ID)}
                            className="me-2"
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePrintReceipt(t.Slip_ID)}
                          >
                            Print
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              );
            })()}
          </tbody>
        </table>

        {/* Receipt Modal */}
        {showReceiptModal && (
          <ReceiptModal
            show={showReceiptModal}
            onClose={() => setShowReceiptModal(false)}
            slipId={selectedSlipId}
          />
        )}
      </div>

      {/* Collect / Edit Modal */}
      <Modal
        show={showModal}
        onHide={() => setShowModal(false)}
        centered
        size="xl"
        dialogClassName="collection-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>{editingTransaction ? "Edit Transaction" : "Add Transaction"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {!editingTransaction ? (
            <>
              {/* Student Pick Tabs */}
              <Tabs
                activeKey={activeTab}
                onSelect={(tab) => {
                  setActiveTab(tab);
                  if (tab === "admissionNumber") {
                    setSearchAdmissionNumber("");
                    setSelectedAdmissionStudent(null);
                    setFeeHeads([]);
                    setNewTransactionDetails([]);
                  } else if (tab === "searchByName") {
                    setSelectedStudentInfo(null);
                    setSelectedAdmissionStudent(null);
                    setFeeHeads([]);
                    setNewTransactionDetails([]);
                  }
                }}
                className="mb-3"
              >
                <Tab eventKey="admissionNumber" title="Search by Admission Number">
                  <Form.Group className="mb-3">
                    <Form.Label>Admission Number</Form.Label>
                    <div className="d-flex">
                      <Form.Control
                        type="text"
                        value={searchAdmissionNumber}
                        onChange={(e) => setSearchAdmissionNumber(e.target.value)}
                        placeholder="Enter Admission Number"
                      />
                      <Button
                        variant="primary"
                        className="ms-2"
                        onClick={fetchStudentAndFeeByAdmissionNumber}
                      >
                        Search
                      </Button>
                    </div>
                  </Form.Group>

                  {selectedAdmissionStudent && (
                    <div className="mt-3 p-3 bg-light rounded border student-brief">
                      <h6 className="fw-bold mb-1">{selectedAdmissionStudent.name}</h6>
                      <div className="small text-muted">
                        Class: {selectedAdmissionStudent.Class.class_name} | Section:{" "}
                        {selectedAdmissionStudent.Section.section_name}
                      </div>
                      <div className="small">Admission No: {selectedAdmissionStudent.admission_number}</div>
                      <div className="small">
                        Father: {selectedAdmissionStudent.father_name} | Phone:{" "}
                        {selectedAdmissionStudent.father_phone}
                      </div>
                    </div>
                  )}
                </Tab>

                <Tab eventKey="searchByName" title="Search by Name">
                  <div className="d-flex flex-wrap gap-3 mb-3">
                    <Form.Group style={{ minWidth: 200 }}>
                      <Form.Label>Class</Form.Label>
                      <Form.Select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                      >
                        <option value="">Select Class</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.class_name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>

                    <Form.Group style={{ minWidth: 200 }}>
                      <Form.Label>Section</Form.Label>
                      <Form.Select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                      >
                        <option value="">Select Section</option>
                        {sections.map((sec) => (
                          <option key={sec.id} value={sec.id}>
                            {sec.section_name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </div>

                  <Form.Group className="mb-3">
                    <Form.Label>Student</Form.Label>
                    <Form.Select
                      onChange={(e) => {
                        const student = students.find((s) => s.id === parseInt(e.target.value, 10));
                        setSelectedStudentInfo(student);
                        if (student) fetchFeeHeadsForStudent(student.class_id, student.id);
                      }}
                      disabled={!students.length}
                    >
                      <option value="">Select Student</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} - {s.admission_number}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  {selectedStudentInfo && (
                    <div className="mt-3 p-3 bg-light rounded border student-brief">
                      <h6 className="fw-bold mb-1">{selectedStudentInfo.name}</h6>
                      <div className="small">Admission No: {selectedStudentInfo.admission_number}</div>
                    </div>
                  )}
                </Tab>
              </Tabs>

              {/* ====== AUTOFILL TOOLBAR (TOP) ====== */}
              {feeHeads.length > 0 && (
                <Card className="mb-3 shadow-sm">
                  <Card.Body className="d-flex flex-wrap align-items-end gap-2">
                    <Form.Group style={{ minWidth: 220 }}>
                      <Form.Label className="mb-1">Quick Amount</Form.Label>
                      <Form.Control
                        type="number"
                        placeholder="Enter amount (e.g. 2500)"
                        value={quickAmount}
                        onChange={(e) => setQuickAmount(e.target.value)}
                      />
                      <div className="form-text">
                        Allocates per head: <strong>Due first, then its Fine</strong> (Tuition heads prioritized).
                      </div>
                    </Form.Group>
                    <div className="d-flex align-items-end gap-2">
                      <Button variant="success" onClick={autoAllocateQuickAmount}>
                        Auto-fill
                      </Button>
                      <Button variant="outline-secondary" onClick={clearQuickAllocations}>
                        Clear
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              )}

              {/* Fee Details Table (only this area scrolls; header sticky) */}
              {feeHeads.length > 0 && (
                <>
                  <h5 className="mb-2">Fee Details</h5>
                  <div className="collection-table-wrap">
                    <table className="table table-bordered mb-0">
                      <thead className="table-light sticky-top">
                        <tr>
                          <th style={{ minWidth: 200 }}>Fee Head</th>
                          <th style={{ minWidth: 180 }}>Due Amount</th>
                          <th style={{ minWidth: 140 }}>Concession</th>
                          <th style={{ minWidth: 140 }}>Receive</th>
                          <th style={{ minWidth: 160 }}>Received</th>
                          <th style={{ minWidth: 140 }}>Van Fee</th>
                          <th style={{ minWidth: 140 }}>Fine</th>
                        </tr>
                      </thead>
                      <tbody>
                        {newTransactionDetails.map((feeDetail, index) => (
                          <tr key={`${feeDetail.Fee_Head}-${index}`}>
                            <td>{feeDetail.Fee_Heading_Name}</td>
                            <td>
                              <OverlayTrigger
                                placement="top"
                                overlay={
                                  <Tooltip id={`tooltip-fee-${feeDetail.Fee_Head}`}>
                                    <div style={{ textAlign: "left", padding: 8 }}>
                                      <div>
                                        <strong className="text-primary">Original Fee:</strong>
                                        <span className="ms-1">
                                          {formatINR(feeDetail.Original_Fee_Due || 0)}
                                        </span>
                                      </div>
                                      {feeDetail.defaultConcessionAmount > 0 &&
                                        selectedStudentInfo?.concession && (
                                          <div>
                                            <strong className="text-success">
                                              {selectedStudentInfo.concession.concession_name}:
                                            </strong>
                                            <span className="ms-1">
                                              {formatINR(feeDetail.defaultConcessionAmount)}
                                            </span>
                                          </div>
                                        )}
                                      {feeDetail.Concession > 0 && (
                                        <div>
                                          <strong className="text-success">Extra Concession:</strong>
                                          <span className="ms-1">{formatINR(feeDetail.Concession)}</span>
                                        </div>
                                      )}
                                      {feeDetail.fineAmount > 0 && (
                                        <div>
                                          <strong className="text-danger">Fine Applied:</strong>
                                          <span className="ms-1">{formatINR(feeDetail.fineAmount)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </Tooltip>
                                }
                              >
                                <div className="fw-bold text-dark">
                                  {(() => {
                                    const netDue = Math.max(
                                      0,
                                      (feeDetail.Fee_Due || 0) -
                                        (feeDetail.Fee_Recieved || 0) -
                                        (feeDetail.Concession || 0)
                                    );
                                    const originalFine = feeDetail.fineAmount || 0;
                                    const fineReceived = feeDetail.Fine_Amount || 0;
                                    const fineDue = Math.max(0, originalFine - fineReceived);

                                    return (
                                      <>
                                        {formatINR(netDue)}
                                        {feeDetail.isFineApplicable && fineDue > 0 && (
                                          <>
                                            {" + "}
                                            <span className="text-danger">
                                              {formatINR(fineDue)} (fine)
                                            </span>
                                          </>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </OverlayTrigger>
                            </td>

                            <td>
                              <Form.Control
                                type="number"
                                value={feeDetail.Concession || ""}
                                onChange={(e) => {
                                  const updated = [...newTransactionDetails];
                                  updated[index].Concession = parseInt(e.target.value, 10) || 0;
                                  setNewTransactionDetails(updated);
                                }}
                                disabled={(feeDetail.Fee_Due || 0) - (feeDetail.Fee_Recieved || 0) <= 0}
                              />
                            </td>

                            <td>
                              <Form.Control
                                type="number"
                                value={feeDetail.Fee_Recieved || ""}
                                onChange={(e) => {
                                  const updated = [...newTransactionDetails];
                                  const val = parseInt(e.target.value, 10) || 0;
                                  const maxAllowed = Math.max(
                                    0,
                                    (feeDetail.Fee_Due || 0) - (feeDetail.Concession || 0)
                                  );
                                  updated[index].Fee_Recieved = Math.min(val, maxAllowed);
                                  setNewTransactionDetails(updated);
                                }}
                                disabled={(feeDetail.Fee_Due || 0) <= 0}
                              />
                            </td>

                            <td>
                              {feeDetail.ShowVanFeeInput ? (
                                <span className="fw-semibold">
                                  {formatINR(feeDetail._receivedVanFee)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td>
                              {feeDetail.ShowVanFeeInput ? (
                                <Form.Control
                                  type="number"
                                  value={feeDetail.VanFee === 0 ? "" : feeDetail.VanFee}
                                  onChange={(e) => {
                                    const updated = [...newTransactionDetails];
                                    updated[index].VanFee = parseInt(e.target.value, 10) || 0;
                                    setNewTransactionDetails(updated);
                                  }}
                                />
                              ) : (
                                "—"
                              )}
                            </td>

                            <td>
                              <Form.Control
                                type="number"
                                value={feeDetail.Fine_Amount || ""}
                                onChange={(e) => {
                                  const updated = [...newTransactionDetails];
                                  const value = parseInt(e.target.value, 10) || 0;
                                  // clamp to remaining fine (not total)
                                  const remainingFine = feeDetail.isFineApplicable
                                    ? Math.max(0, (feeDetail.fineAmount || 0) - (feeDetail.Fine_Amount || 0))
                                    : 0;
                                  const next = Math.min(value, (feeDetail.fineAmount || 0));
                                  // ensure we don't exceed original fine
                                  updated[index].Fine_Amount = Math.min(next, feeDetail.fineAmount || 0);
                                  // also prevent negative
                                  if (updated[index].Fine_Amount < 0) updated[index].Fine_Amount = 0;
                                  setNewTransactionDetails(updated);
                                }}
                                disabled={!feeDetail.isFineApplicable}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Edit Mode */
            <>
              <h5 className="mb-3">Edit Transaction</h5>
              <table className="table table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Student</th>
                    <th>Admission No.</th>
                    <th>Class</th>
                    <th>Date</th>
                    <th>Fee Head</th>
                    <th>Fee Received</th>
                    <th>Concession</th>
                    <th>Van Fee</th>
                    <th>Fine</th>
                    <th>Payment Mode</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{editingTransaction?.StudentName}</td>
                    <td>{editingTransaction?.AdmissionNumber}</td>
                    <td>{editingTransaction?.ClassName}</td>
                    <td>
                      {editingTransaction?.DateOfTransaction
                        ? new Date(editingTransaction.DateOfTransaction).toLocaleDateString()
                        : "—"}
                    </td>
                    <td>{editingTransaction?.FeeHeadingName}</td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.Fee_Recieved ?? 0}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Fee_Recieved: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.Concession ?? 0}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Concession: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.VanFee ?? 0}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            VanFee: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 140 }}>
                      <Form.Control
                        type="number"
                        value={editingTransaction?.Fine_Amount || ""}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            Fine_Amount: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      <Form.Select
                        value={editingTransaction?.PaymentMode || "Cash"}
                        onChange={(e) =>
                          setEditingTransaction((prev) => ({
                            ...prev,
                            PaymentMode: e.target.value,
                            Transaction_ID: e.target.value === "Online" ? prev.Transaction_ID : "",
                          }))
                        }
                      >
                        <option value="Cash">Cash</option>
                        <option value="Online">Online</option>
                      </Form.Select>
                    </td>
                  </tr>
                </tbody>
              </table>

              {editingTransaction?.PaymentMode === "Online" && (
                <Form.Group className="mt-3" style={{ maxWidth: 360 }}>
                  <Form.Label>Transaction ID</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter Transaction ID"
                    value={editingTransaction?.Transaction_ID || ""}
                    onChange={(e) =>
                      setEditingTransaction((prev) => ({
                        ...prev,
                        Transaction_ID: e.target.value,
                      }))
                    }
                  />
                </Form.Group>
              )}
            </>
          )}
        </Modal.Body>

        {/* FOOTER: Payment box + Totals + Buttons */}
        <Modal.Footer className="flex-column align-items-stretch">
          <div className="d-flex w-100 flex-wrap align-items-start justify-content-between gap-3">
            {/* Payment Details (left) */}
            {!editingTransaction ? (
              <div className="p-3 rounded border bg-light" style={{ flex: 1, minWidth: 320 }}>
                <h6 className="mb-2">Payment Details</h6>
                <Form.Group>
                  <Form.Label className="mb-1">Payment Mode</Form.Label>
                  <div>
                    <Form.Check
                      inline
                      type="radio"
                      label="Cash"
                      name="paymentMode"
                      value="Cash"
                      checked={paymentMode === "Cash"}
                      onChange={(e) => setPaymentMode(e.target.value)}
                    />
                    <Form.Check
                      inline
                      type="radio"
                      label="Online"
                      name="paymentMode"
                      value="Online"
                      checked={paymentMode === "Online"}
                      onChange={(e) => setPaymentMode(e.target.value)}
                    />
                  </div>
                </Form.Group>

                {paymentMode === "Online" && (
                  <Form.Group className="mt-2">
                    <Form.Label>Transaction ID</Form.Label>
                    <Form.Control
                      type="text"
                      name="Transaction_ID"
                      placeholder="Enter Transaction ID"
                      value={transactionID}
                      onChange={(e) => setTransactionID(e.target.value)}
                    />
                  </Form.Group>
                )}
              </div>
            ) : (
              <div className="p-3 rounded border bg-light" style={{ flex: 1, minWidth: 320 }}>
                <h6 className="mb-2">Payment Details</h6>
                <div className="small text-muted mb-2">
                  Mode:&nbsp;<strong>{editingTransaction.PaymentMode}</strong>
                </div>
                {editingTransaction.PaymentMode === "Online" && (
                  <Form.Group>
                    <Form.Label>Transaction ID</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter Transaction ID"
                      value={editingTransaction.Transaction_ID || ""}
                      onChange={(e) =>
                        setEditingTransaction((prev) => ({
                          ...prev,
                          Transaction_ID: e.target.value,
                        }))
                      }
                    />
                  </Form.Group>
                )}
              </div>
            )}

            {/* Totals (right) */}
            <div
              className="p-3 rounded border bg-white shadow-sm d-flex flex-wrap align-items-center justify-content-between"
              style={{ minWidth: 520, flex: 1 }}
            >
              <div className="text-center me-3 mb-2">
                <div className="small text-muted">Academic Fee</div>
                <div className="fs-5 fw-bold text-success">{formatINR(totalFeeReceived)}</div>
              </div>

              <div className="text-center me-3 mb-2">
                <div className="small text-muted">Van Fee</div>
                <div className="fs-5 fw-bold text-warning">{formatINR(totalVanFee)}</div>
              </div>

              <div className="text-center me-3 mb-2">
                <div className="small text-muted">Fine</div>
                <div className="fs-5 fw-bold text-danger">{formatINR(totalFine)}</div>
              </div>

              <div className="text-center me-3 mb-2">
                <div className="small text-muted">Concessions</div>
                <div className="fs-5 fw-bold text-secondary">{formatINR(totalConcessions)}</div>
              </div>

              <div className="text-center mb-2">
                <div className="small text-muted">Grand Total</div>
                <div className="fs-5 fw-bold">{formatINR(grandTotal)}</div>
                {/* grandTotal = totalFeeReceived + totalVanFee + totalFine */}
              </div>
            </div>

            {/* Buttons (far right) */}
            <div className="d-flex align-items-center justify-content-end" style={{ minWidth: 220 }}>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                Close
              </Button>
              <Button variant="primary" className="ms-2" onClick={saveTransaction}>
                Save
              </Button>
            </div>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Transactions;
