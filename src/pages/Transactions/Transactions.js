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
} from "react-bootstrap";
import ReceiptModal from "./ReceiptModal"; // For the pop-up view
import "bootstrap/dist/css/bootstrap.min.css";

// Updated handlePrintReceipt function to generate a blob URL and open in new tab
const handlePrintReceipt = async (slipId) => {
  try {
    // Fetch school and receipt data
    const schoolResponse = await api.get("/schools");
    const school = schoolResponse.data.length > 0 ? schoolResponse.data[0] : null;
    const receiptResponse = await api.get(`/transactions/slip/${slipId}`);
    const receipt = receiptResponse.data.data;
    if (!school || !receipt || receipt.length === 0) {
      console.error("Insufficient data to generate PDF");
      return;
    }
    // Get student information from the receipt
    const student = receipt[0].Student;
    if (!student) {
      console.error("Student data missing in receipt");
      return;
    }
    // Generate the PDF blob using the shared PDF document component
    const blob = await pdf(
      <PdfReceiptDocument school={school} receipt={receipt} student={student} />
    ).toBlob();
    // Create a blob URL and open it in a new tab
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
  } catch (error) {
    console.error("Error generating PDF blob:", error);
  }
};
// STEP 1: current user's role
const getUserRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user"))?.role || "";
  } catch {
    return "";
  }
};

const Transactions = () => {
  
  const [userRole, setUserRole] = useState(localStorage.getItem("activeRole") || "");

    // keep role in sync if it changes elsewhere
    useEffect(() => {
      const handler = () => setUserRole(localStorage.getItem("activeRole") || "");
      window.addEventListener("role-changed", handler);
      return () => window.removeEventListener("role-changed", handler);
    }, []);

  console.log("ROLE =>", userRole);

  // STEP 2: helpers
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

  // Receipt Modal states (for the view pop-up)
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSlipId, setSelectedSlipId] = useState(null);

  // Transportation States (for any additional use)
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [selectedRouteCost, setSelectedRouteCost] = useState(0);

  // Polling interval in milliseconds
  const POLLING_INTERVAL = 5000;

  // Open Receipt Modal (View Receipt)
  const viewReceipt = (slipId) => {
    console.log("Opening Receipt Modal for Slip ID:", slipId);
    setSelectedSlipId(slipId);
    setShowReceiptModal(true);
  };

  // Calculate totals
  const totalFeeReceived = useMemo(() => {
    return newTransactionDetails.reduce(
      (total, item) => total + (item.Fee_Recieved || 0),
      0
    );
  }, [newTransactionDetails]);

  const totalVanFee = useMemo(() => {
    return newTransactionDetails.reduce(
      (total, item) => total + (item.VanFee || 0),
      0
    );
  }, [newTransactionDetails]);

  const totalConcessions = useMemo(() => {
    return newTransactionDetails.reduce(
      (total, item) =>
        total + ((item.Concession || 0) + (item.Van_Fee_Concession || 0)),
      0
    );
  }, [newTransactionDetails]);

    const totalFine = useMemo(() => {
    return newTransactionDetails.reduce(
      (total, item) => total + (item.Fine_Amount || 0),
      0
    );
  }, [newTransactionDetails]);


  const grandTotal = useMemo(() => {
  return totalFeeReceived + totalVanFee + totalFine;
}, [totalFeeReceived, totalVanFee, totalFine]);


  // Fetch functions
  const fetchTransportRoutes = async () => {
    try {
      const response = await api.get("/transportations");
      setTransportRoutes(response.data);
    } catch (error) {
      console.error("Error fetching transport routes:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await api.get("/transactions");
      setTransactions(response.data.data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const fetchDaySummary = async () => {
    try {
      const response = await api.get("/transactions/summary/day-summary");
      setDaySummary(response.data);
    } catch (error) {
      console.error("Error fetching day summary:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await api.get("/sections");
      setSections(response.data);
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
      setStudents(response.data);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  // Fetch Fee Details and compute due amounts.
  const fetchFeeHeadsForStudent = async (classId, studentId) => {
  try {
    const feeResponse = await api.get(`/students/${studentId}/fee-details`);
    const feeDetailsData = feeResponse.data.feeDetails;

    const [
      receivedFeeResponse,
      receivedVanFeeResponse,
      lastRouteResponse,
      routeDetailsResponse,
    ] = await Promise.all([
      api.get(`/transactions/totals/fee-head/${studentId}`),
      api.get(`/transactions/vanfee/${studentId}`),
      api.get(`/transactions/last-route/${studentId}`),
      api.get(`/transportations`),
    ]);

    // Build lookup maps for academic fee deductions and fine amounts
    const receivedFeeMap = {};
    const receivedConcessionMap = {};
    const receivedFineMap = {}; // 👈 New map for fine amounts
    receivedFeeResponse.data.data.forEach((item) => {
      receivedFeeMap[item.Fee_Head] = parseFloat(item.TotalReceived) || 0;
      receivedConcessionMap[item.Fee_Head] = parseFloat(item.TotalConcession) || 0;
      receivedFineMap[item.Fee_Head] = parseFloat(item.TotalFineAmount) || 0; // 👈 Assume API returns TotalFineAmount
    });

    // Build lookup maps for van fees
    const receivedVanFeeMap = {};
    const vanFeeConcessionMap = {};
    receivedVanFeeResponse.data.data.forEach((item) => {
      receivedVanFeeMap[item.Fee_Head] = parseFloat(item.TotalVanFeeReceived) || 0;
      vanFeeConcessionMap[item.Fee_Head] = parseFloat(item.TotalVanFeeConcession) || 0;
    });
    const lastRouteMap = {};
    lastRouteResponse.data.data.forEach((item) => {
      lastRouteMap[item.Fee_Head] = item.Route_Number || "";
    });

    const transportRoutesData = routeDetailsResponse.data;
    const today = new Date();

    const feeDetails = feeDetailsData.map((detail) => {
      // Calculate academic due
      const baseFeeDue = detail.feeDue || 0;
      const extraConcession = 0;
      const totalReceived = receivedFeeMap[detail.fee_heading_id] || 0;
      // const academicDue = Math.max(0, baseFeeDue - totalReceived - extraConcession);
      const academicDue = Math.max(0, baseFeeDue - extraConcession);

      // Calculate fine due
      const originalFine = detail.fineAmount || 0;
      const totalFineReceived = receivedFineMap[detail.fee_heading_id] || 0;
      const fineDue = Math.max(0, originalFine - totalFineReceived); // 👈 Calculate remaining fine

      // Transportation fee calculations
      const lastRoute = lastRouteMap[detail.fee_heading_id] || "";
      const selectedRouteObj = transportRoutesData.find((r) => r.id == lastRoute);
      const selectedRouteFee = selectedRouteObj ? selectedRouteObj.Cost : 0;
      const receivedVanFee = receivedVanFeeMap[detail.fee_heading_id] || 0;
      const vanFeeConcession = vanFeeConcessionMap[detail.fee_heading_id] || 0;
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
      const finalVanDue = Math.max(0, selectedRouteFee - receivedVanFee - vanFeeConcession + vanFineAmount);

      // Set van fields to display only if transport is applicable
      const transportApplicable = detail.transportApplicable === "Yes";

      return {
        Fee_Head: detail.fee_heading_id,
        Fee_Heading_Name: detail.fee_heading,
        Fee_Due: academicDue,
        Original_Fee_Due: detail.original_fee_due,
        fineAmount: originalFine,
        isFineApplicable: fineDue > 0, // 👈 Set based on remaining fine due
        defaultConcessionAmount: detail.concession_applied ? detail.concession_amount : 0,
        Fee_Recieved: 0,
        Concession: extraConcession,
        VanFee: 0,
        Van_Fee_Concession: 0,
        SelectedRoute: lastRoute,
        ShowVanFeeInput: transportApplicable,
        _receivedVanFee: receivedVanFee,
        _vanFeeConcession: vanFeeConcession,
        Van_Fee_Due: finalVanDue,
        Van_Fine_Amount: vanFineAmount,
        Fine_Amount: 0, // Initialize Fine_Amount
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

  const saveTransaction = async () => {
    try {
      if (editingTransaction) {
        const updatedTransaction = {
          Fee_Recieved: editingTransaction.Fee_Recieved,
          Concession: editingTransaction.Concession,
          VanFee: editingTransaction.VanFee,
          Fine_Amount: editingTransaction.Fine_Amount || 0, // ✅ Add this
          Van_Fee_Concession: editingTransaction.Van_Fee_Concession,
          PaymentMode: editingTransaction.PaymentMode,
          Transaction_ID:
            editingTransaction.PaymentMode === "Online"
              ? editingTransaction.Transaction_ID
              : null,
        };

        const response = await api.put(`/transactions/${editingTransaction.Serial}`, updatedTransaction);

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
        // 🔐 CHECK FOR PAYMENT MODE
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
          Fine_Amount: details.Fine_Amount || 0,

        }));

        const response = await api.post("/transactions/bulk", { transactions: transactionsPayload });

        if (response.data.success) {
          Swal.fire({
            title: "Added!",
            text: `Transactions have been added successfully with Slip ID: ${response.data.slipId}. Would you like to print the receipt?`,
            icon: "success",
            showCancelButton: true,
            confirmButtonText: "Print Receipt",
            cancelButtonText: "Cancel",
            allowOutsideClick: false,
          }).then((result) => {
            if (result.isConfirmed) {
              // Instead of opening the PdfReceiptPrint page,
              // use the updated handlePrintReceipt function to generate the PDF blob.
              handlePrintReceipt(response.data.slipId);
            }
          });
          resetForm();
          fetchTransactions();
          fetchDaySummary();
        }
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
    setPaymentMode(""); // Reset payment mode here
    setTransactionID(""); // Reset transaction ID too
    setNewTransactionDetails((prevDetails) =>
      prevDetails.map((detail) => ({
        ...detail,
        VanFee: 0,
        Van_Fee_Concession: 0,
      }))
    );
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


  // Initial fetch for transport routes, classes, and sections (static data)
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
    }
  }, [showModal]);

  useEffect(() => {
    fetchStudentsByClassAndSection();
  }, [selectedClass, selectedSection]);

  // Polling: fetch transactions and day summary every POLLING_INTERVAL milliseconds
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
      .filter((payment) => payment.PaymentMode === "Cash")
      .reduce((acc, payment) => acc + parseFloat(payment.TotalAmountCollected || 0), 0);
  }, [daySummary.paymentSummary]);

  return (
    <div className="container-fluid mt-4">
      <h2 className="mb-3 text-center">Transactions Management</h2>

      {/* Summary Cards */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold text-primary">Transaction Summary for Today</h4>
        <span className="text-muted fs-5">{new Date().toLocaleDateString()}</span>
      </div>

      {daySummary && daySummary.data ? (
        <Row className="mb-4">
          <Col md={3}>
            <Card className="shadow-lg border-0">
              <Card.Body className="text-center">
                <Card.Title className="fw-semibold text-success">Total Collection</Card.Title>
                <Card.Text className="fs-3 fw-bold text-dark">
                  Rs. {(daySummary.grandTotal || 0).toLocaleString("en-IN")}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>

          <Col md={2}>
            <Card className="shadow-lg border-0">
              <Card.Body className="text-center">
                <Card.Title className="fw-semibold text-primary">Fee Received</Card.Title>
                <Card.Text className="fs-3 fw-bold text-dark">
                  Rs. {(daySummary.data || []).reduce((acc, item) => acc + parseFloat(item.TotalFeeReceived || 0), 0).toLocaleString("en-IN")}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>

          <Col md={2}>
            <Card className="shadow-lg border-0">
              <Card.Body className="text-center">
                <Card.Title className="fw-semibold text-warning">Van Fee Collected</Card.Title>
                <Card.Text className="fs-3 fw-bold text-dark">
                  Rs. {(daySummary.data || []).reduce((acc, item) => acc + parseFloat(item.TotalVanFee || 0), 0).toLocaleString("en-IN")}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>

          <Col md={2}>
            <Card className="shadow-lg border-0">
              <Card.Body className="text-center">
                <Card.Title className="fw-semibold text-danger">Concession</Card.Title>
                <Card.Text className="fs-3 fw-bold text-dark">
                  Rs. {(daySummary.data || []).reduce((acc, item) => acc + parseFloat(item.TotalConcession || 0), 0).toLocaleString("en-IN")}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={2}>
            <Card className="shadow-lg border-0">
              <Card.Body className="text-center">
                <Card.Title className="fw-semibold text-danger">Fine Collected</Card.Title>
                <Card.Text className="fs-3 fw-bold text-dark">
                  Rs. {(daySummary.data || []).reduce((acc, item) => acc + parseFloat(item.TotalFine || 0), 0).toLocaleString("en-IN")}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>

        </Row>
      ) : (
        <p className="text-center text-muted">Loading transaction summary...</p>
      )}

      {/* Payment Mode Wise Collection */}
      <Row className="mb-4">
        {daySummary.paymentSummary?.map((payment) => (
          <Col md={3} key={payment.PaymentMode}>
            <Card className="shadow-lg border-0">
              <Card.Body className="text-center">
                <Card.Title className="fw-semibold text-info">
                  {payment.PaymentMode === "Cash" ? "Cash Collection" : "Online Collection"}
                </Card.Title>
                <Card.Text className="fs-3 fw-bold text-dark">
                  Rs. {parseFloat(payment.TotalAmountCollected || 0).toLocaleString("en-IN")}
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <Button
          variant="success"
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

      <div className="table-responsive">
        <table className="table table-striped table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Slip ID</th>
              <th>Adm. No.</th>
              <th>Class</th>
              <th>Date & Time</th>
              <th>Head</th>
              <th>Concession</th>
              <th>Fee Received</th>
              <th>Van Fee</th>
              <th>Fine</th> {/* ✅ New column */}
              <th>Mode</th>
              <th>Status</th>
              <th>Actions</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const groupedTransactions = new Map();

              // ✅ Skip cancelled transactions before grouping
              transactions
                .filter((t) => t.status !== "cancelled")
                .forEach((transaction) => {
                  if (!groupedTransactions.has(transaction.Slip_ID)) {
                    groupedTransactions.set(transaction.Slip_ID, []);
                  }
                  groupedTransactions.get(transaction.Slip_ID).push(transaction);
                });

              return Array.from(groupedTransactions.entries()).map(([slipID, group]) => {
                return group.map((transaction, index) => {
                  const isMiddleRow = index === Math.floor(group.length / 2);

                  return (
                    <tr key={transaction.Serial}>
                      <td>{transactions.length - transactions.indexOf(transaction)}</td>
                      <td>{transaction.Student?.name || "XXX"}</td>
                      <td>{transaction.Slip_ID}</td>
                      <td>{transaction.AdmissionNumber}</td>
                      <td>{transaction.Class?.class_name || "XXX"}</td>
                      <td>{new Date(transaction.DateOfTransaction).toLocaleString()}</td>
                      <td>{transaction.FeeHeading?.fee_heading || "XXX"}</td>
                      <td>{transaction.Concession}</td>
                      <td>{transaction.Fee_Recieved}</td>
                      <td>{transaction.VanFee}</td>
                      <td className={transaction.Fine_Amount > 0 ? "text-danger fw-bold" : ""}>
                        {transaction.Fine_Amount || 0}
                      </td>
                      <td>{transaction.PaymentMode}</td>

                      <td>
                        <span className="badge bg-success">Active</span>
                      </td>

                      <td>
                        <Button
                          variant="primary"
                          size="sm"
                          className="me-1"
                          onClick={() => {
                            setEditingTransaction({
                              Serial: transaction.Serial,
                              Fee_Recieved: transaction.Fee_Recieved,
                              Concession: transaction.Concession,
                              VanFee: transaction.VanFee,
                              Fine_Amount: transaction.Fine_Amount || 0,
                              PaymentMode: transaction.PaymentMode,
                              Transaction_ID: transaction.Transaction_ID || "",
                              FeeHeadingName: transaction.FeeHeading?.fee_heading || "XXX",
                              StudentName: transaction.Student?.name || "XXX",
                              AdmissionNumber: transaction.AdmissionNumber,
                              ClassName: transaction.Class?.class_name || "XXX",
                              DateOfTransaction: transaction.DateOfTransaction,
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
                                if (r.isConfirmed) cancelTransaction(transaction.Serial);
                              })
                            }
                          >
                            Cancel
                          </Button>
                        )}

                        {canDelete(transaction) && (
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
                                if (r.isConfirmed) deleteTransaction(transaction.Serial);
                              })
                            }
                          >
                            Delete
                          </Button>
                        )}
                      </td>

                      {isMiddleRow && (
                        <td className="align-middle text-center border-start border-0 border-primary">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => viewReceipt(transaction.Slip_ID)}
                            className="me-2"
                          >
                            View
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePrintReceipt(transaction.Slip_ID)}
                          >
                            Print
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                });
              });
            })()}
          </tbody>


        </table>
        {/* Receipt Modal (View as a pop-up) */}
        {showReceiptModal && (
          <ReceiptModal
            show={showReceiptModal}
            onClose={() => setShowReceiptModal(false)}
            slipId={selectedSlipId}
          />
        )}
      </div>

      {/* Modal for Add/Edit Transaction */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="xl">
        <Modal.Header closeButton>
          <Modal.Title>{editingTransaction ? "Edit Transaction" : "Add Transaction"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!editingTransaction ? (
            <>
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
                      <Button variant="primary" className="ms-2" onClick={fetchStudentAndFeeByAdmissionNumber}>
                        Search
                      </Button>
                    </div>
                  </Form.Group>
                  {selectedAdmissionStudent && (
                    <div className="mt-3 p-3 border rounded bg-light">
                      <h6 className="fw-bold">{selectedAdmissionStudent.name}</h6>
                      <p>
                        Class: {selectedAdmissionStudent.Class.class_name} | Section: {selectedAdmissionStudent.Section.section_name}
                      </p>
                      <p>Admission No: {selectedAdmissionStudent.admission_number}</p>
                      <p>
                        Father: {selectedAdmissionStudent.father_name} | Phone: {selectedAdmissionStudent.father_phone}
                      </p>
                    </div>
                  )}
                </Tab>

                <Tab eventKey="searchByName" title="Search by Name">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex">
                      <Form.Group className="me-3">
                        <Form.Label>Class</Form.Label>
                        <Form.Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                          <option value="">Select Class</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              {cls.class_name}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group>
                        <Form.Label>Section</Form.Label>
                        <Form.Select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
                          <option value="">Select Section</option>
                          {sections.map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              {sec.section_name}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </div>
                  </div>
                  <Form.Group className="mb-3">
                    <Form.Label>Student</Form.Label>
                    <Form.Select
                      onChange={(e) => {
                        const student = students.find((s) => s.id === parseInt(e.target.value));
                        setSelectedStudentInfo(student);
                        fetchFeeHeadsForStudent(student?.class_id, student?.id);
                      }}
                      disabled={!students.length}
                    >
                      <option value="">Select Student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} - {student.admission_number}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  {selectedStudentInfo && (
                    <div className="mt-3 p-3 border rounded bg-light">
                      <h6 className="fw-bold">{selectedStudentInfo.name}</h6>
                      <p>Admission No: {selectedStudentInfo.admission_number}</p>
                    </div>
                  )}
                </Tab>
              </Tabs>
              {feeHeads.length > 0 && (
                <div>
                  <h5>Fee Details:</h5>
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th>Fee Head</th>
                        <th>Due Amount</th>
                        <th>Concession</th>
                        <th>Receive</th>
                        <th>Received</th>
                        <th>Van Fee</th>
                        <th>Fine</th> {/* 👈 New Fine column */}
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
                                <Tooltip id={`tooltip-fee-received-${feeDetail.Fee_Head}`}>
                                  <div style={{ textAlign: "left", padding: "8px" }}>
                                    <div>
                                      <strong className="text-primary">Original Fee:</strong>
                                      <span className="ms-1">
                                        Rs. {(feeDetail.Original_Fee_Due || 0).toLocaleString("en-IN")}
                                      </span>
                                    </div>
                                    {feeDetail.defaultConcessionAmount > 0 && selectedStudentInfo?.concession && (
                                      <div>
                                        <strong className="text-success">
                                          {selectedStudentInfo.concession.concession_name}:
                                        </strong>
                                        <span className="ms-1">
                                          Rs. {feeDetail.defaultConcessionAmount.toLocaleString("en-IN")}
                                        </span>
                                      </div>
                                    )}
                                    {feeDetail.Concession > 0 && (
                                      <div>
                                        <strong className="text-success">Extra Concession:</strong>
                                        <span className="ms-1">
                                          Rs. {feeDetail.Concession.toLocaleString("en-IN")}
                                        </span>
                                      </div>
                                    )}
                                    {feeDetail.fineAmount > 0 && (
                                      <div>
                                        <strong className="text-danger">Fine Applied:</strong>
                                        <span className="ms-1">
                                          Rs. {feeDetail.fineAmount.toLocaleString("en-IN")}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </Tooltip>
                              }
                            >
                              <div>
                                <span className="fw-bold text-dark">
                                  Rs. {(() => {
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
                                        {netDue.toLocaleString("en-IN")}
                                        {feeDetail.isFineApplicable && fineDue > 0 && ( // 👈 Show fine if applicable and fineDue > 0
                                          <>
                                            {" + "}
                                            <span className="text-danger">
                                              {fineDue.toLocaleString("en-IN")}(fine)
                                            </span>
                                          </>
                                        )}
                                      </>
                                    );
                                  })()}
                                </span>
                              </div>
                            </OverlayTrigger>
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              value={feeDetail.Concession || ""}
                              onChange={(e) => {
                                const updatedDetails = [...newTransactionDetails];
                                updatedDetails[index].Concession = parseInt(e.target.value, 10) || 0;
                                setNewTransactionDetails(updatedDetails);
                              }}
                              disabled={(feeDetail.Fee_Due || 0) - (feeDetail.Fee_Recieved || 0) <= 0}
                            />
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              value={feeDetail.Fee_Recieved || ""}
                              onChange={(e) => {
                                const updatedDetails = [...newTransactionDetails];
                                updatedDetails[index].Fee_Recieved = parseInt(e.target.value, 10) || 0;
                                setNewTransactionDetails(updatedDetails);
                              }}
                              disabled={(feeDetail.Fee_Due || 0) <= 0}
                            />
                          </td>
                          <td>
                            {feeDetail.ShowVanFeeInput ? (
                              <span className="fw-bold text-dark">
                                Rs. {feeDetail._receivedVanFee.toLocaleString("en-IN")}
                              </span>
                            ) : (
                              "XXX"
                            )}
                          </td>
                          <td>
                            {feeDetail.ShowVanFeeInput ? (
                              <Form.Control
                                type="number"
                                value={feeDetail.VanFee === 0 ? "" : feeDetail.VanFee}
                                onChange={(e) => {
                                  const updatedDetails = [...newTransactionDetails];
                                  updatedDetails[index].VanFee = parseInt(e.target.value, 10) || 0;
                                  setNewTransactionDetails(updatedDetails);
                                }}
                              />
                            ) : (
                              "XXX"
                            )}
                          </td>
                          <td>
                            <Form.Control
                              type="number"
                              value={feeDetail.Fine_Amount || ""}
                              onChange={(e) => {
                                const updatedDetails = [...newTransactionDetails];
                                const value = parseInt(e.target.value, 10);
                                updatedDetails[index].Fine_Amount = isNaN(value) ? 0 : value;
                                setNewTransactionDetails(updatedDetails);
                              }}
                              disabled={!feeDetail.isFineApplicable} // 👈 Use isFineApplicable instead
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="d-flex justify-content-between align-items-start mt-4">
                    <div className="payment-box" style={{ flex: 1, marginRight: "20px" }}>
                      <h5>Payment Details:</h5>
                      <Form.Group>
                        <Form.Label>Payment Mode:</Form.Label>
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
                        <Form.Group className="mt-3">
                          <Form.Label>Transaction ID:</Form.Label>
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
                    <div
                      className="summary-box p-4 shadow-sm rounded d-flex flex-wrap justify-content-center align-items-center"
                      style={{ minWidth: "400px" }}
                    >
                      <div className="me-4 text-center">
                        <h6 className="text-primary mb-1">Academic Fee</h6>
                        <h4 className="fw-bold text-success">
                          Rs. {totalFeeReceived.toLocaleString("en-IN")}
                        </h4>
                      </div>
                      <div className="me-4 text-center">
                        <h6 className="text-primary mb-1">Van Fee</h6>
                        <h4 className="fw-bold text-warning">
                          Rs. {totalVanFee.toLocaleString("en-IN")}
                        </h4>
                      </div>
                      <div className="me-4 text-center">
                        <h6 className="text-primary mb-1">Total</h6>
                        <h4 className="fw-bold text-dark">
                          Rs. {grandTotal.toLocaleString("en-IN")}
                        </h4>
                      </div>
                      <div className="text-center">
                        <h6 className="text-primary mb-1">Concessions</h6>
                        <h4 className="fw-bold text-danger">
                          Rs. {totalConcessions.toLocaleString("en-IN")}
                        </h4>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {editingTransaction ? (
                <>
                  <h5>Edit Transaction</h5>
                  <table className="table table-bordered">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Admission No.</th>
                        <th>Class</th>
                        <th>Date</th>
                        <th>Fee Head</th>
                        <th>Fee Received</th>
                        <th>Concession</th>
                        <th>Van Fee</th>
                        <th>Fine</th> {/* ✅ Fine now comes after Van Fee */}
                        <th>Payment Mode</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{editingTransaction.StudentName}</td>
                        <td>{editingTransaction.AdmissionNumber}</td>
                        <td>{editingTransaction.ClassName}</td>
                        <td>{new Date(editingTransaction.DateOfTransaction).toLocaleDateString()}</td>
                        <td>{editingTransaction.FeeHeadingName}</td>
                        <td>
                          <Form.Control
                            type="number"
                            value={editingTransaction.Fee_Recieved}
                            onChange={(e) => {
                              setEditingTransaction({
                                ...editingTransaction,
                                Fee_Recieved: parseFloat(e.target.value) || 0,
                              });
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            value={editingTransaction.Concession}
                            onChange={(e) => {
                              setEditingTransaction({
                                ...editingTransaction,
                                Concession: parseFloat(e.target.value) || 0,
                              });
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            value={editingTransaction.VanFee}
                            onChange={(e) => {
                              setEditingTransaction({
                                ...editingTransaction,
                                VanFee: parseFloat(e.target.value) || 0,
                              });
                            }}
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            value={editingTransaction.Fine_Amount || ""}
                            onChange={(e) => {
                              setEditingTransaction({
                                ...editingTransaction,
                                Fine_Amount: parseFloat(e.target.value) || 0,
                              });
                            }}
                          />
                        </td>
                        <td>
                          <Form.Select
                            value={editingTransaction.PaymentMode}
                            onChange={(e) => {
                              setEditingTransaction({
                                ...editingTransaction,
                                PaymentMode: e.target.value,
                                Transaction_ID:
                                  e.target.value === "Online"
                                    ? editingTransaction.Transaction_ID
                                    : "",
                              });
                            }}
                          >
                            <option value="Cash">Cash</option>
                            <option value="Online">Online</option>
                          </Form.Select>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {editingTransaction.PaymentMode === "Online" && (
                    <Form.Group className="mt-3">
                      <Form.Label>Transaction ID:</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter Transaction ID"
                        value={editingTransaction.Transaction_ID}
                        onChange={(e) =>
                          setEditingTransaction({
                            ...editingTransaction,
                            Transaction_ID: e.target.value,
                          })
                        }
                      />
                    </Form.Group>
                  )}
                </>
              ) : null}
            </>

          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={saveTransaction}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Transactions;
