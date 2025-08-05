import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance with authentication
import Swal from "sweetalert2";
import { Pie, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Tabs, Tab } from "react-bootstrap";
// Register necessary Chart.js components.
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);



const StudentDashboard = () => {

    const roles = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("roles")) || []; }
    catch { const single = localStorage.getItem("userRole"); return single ? [single] : []; }
  }, []);
  const isStudent = roles.includes("student");
  const isAdminish = roles.includes("admin") || roles.includes("superadmin");
  const canView = isStudent || isAdminish;

  // const [userRole, setUserRole] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMainTab, setActiveMainTab] = useState("details"); // Set Fee Details as first tab

  // Define month names and mapping for recognized fee headings.
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthMapping = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12,
  };

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1; // 1-indexed month
  const currentDay = currentDate.getDate();

  // Format functions.
  const formatMoney = (value) => {
    if (isNaN(value)) return value;
    return Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatSummaryMoney = (value) => {
    if (isNaN(value)) return value;
    return "Rs. " + Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatINR = (value) => {
    if (isNaN(value)) return value;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Initial data fetch on mount.
    const username = useMemo(() => localStorage.getItem("username"), []);
      useEffect(() => {
        if (!canView || !username) {
          setError("Access Denied");
          setLoading(false);
          return;
        }
        fetchStudentDetails(username);
        fetchTransactionHistory(username);
      }, [canView, username]);


  // Polling interval to refresh student details and transaction history every 5 seconds.
  useEffect(() => {
    // const username = localStorage.getItem("username");
    if (username && canView) {
      const pollingInterval = setInterval(() => {
        fetchStudentDetails(username);
        fetchTransactionHistory(username);
      }, 5000);
      return () => clearInterval(pollingInterval);
    }
  }, [username, canView]);

  const fetchStudentDetails = async (username) => {
    try {
      const response = await api.get(`/StudentsApp/admission/${username}/fees`);
      setStudentDetails(response.data);
    } catch (err) {
      console.error("Error fetching student details:", err);
      setError("Failed to load student details.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactionHistory = async (username) => {
    try {
      const response = await api.get(`/StudentsApp/feehistory/${username}`);
      if (response.data && response.data.success) {
        setTransactionHistory(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching transaction history:", err);
    }
  };

  const handlePayFee = async (fee) => {
    const dueAmount = parseFloat(fee.finalAmountDue);
    if (isNaN(dueAmount) || dueAmount <= 0) {
      return Swal.fire({
        icon: "error",
        title: "Invalid Fee Amount",
        text: "Cannot initiate payment.",
      });
    }
    const { isConfirmed } = await Swal.fire({
      title: `Proceed to pay Rs. ${formatMoney(dueAmount)}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, pay now!",
      cancelButtonText: "Cancel",
    });
    if (!isConfirmed) return;

    const admissionNumber =
      studentDetails?.admissionNumber ||
      studentDetails?.AdmissionNumber ||
      localStorage.getItem("username");
    if (!admissionNumber) {
      return Swal.fire({
        icon: "error",
        title: "Missing Admission Number",
        text: "Please contact support.",
      });
    }
    const feeHeadId = fee.fee_heading_id;
    if (!feeHeadId) {
      console.error("Fee Head ID is missing from the fee object:", fee);
      return Swal.fire({
        icon: "error",
        title: "Missing Fee Head ID",
        text: "Fee Head ID not found. Please contact support.",
      });
    }
    const payload = {
      admissionNumber,
      amount: dueAmount,
      feeHeadId,
    };
    console.log("Payload to create order:", payload);
    try {
      const orderResponse = await api.post("/student-fee/create-order", payload);
      const orderData = orderResponse.data.order || orderResponse.data;
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Your School Name",
        description: "Fee Payment",
        order_id: orderData.id,
        handler: async function (response) {
          try {
            await api.post("/student-fee/verify-payment", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              admissionNumber,
              amount: dueAmount,
              feeHeadId,
            });
            Swal.fire({
              icon: "success",
              title: "Payment Successful!",
            });
          } catch (error) {
            console.error("Payment verification failed:", error);
            Swal.fire({
              icon: "error",
              title: "Payment Verification Failed",
              text: "Please try again.",
            });
          }
        },
        prefill: {
          name: studentDetails?.name || "",
          email: studentDetails?.email || "",
          contact: studentDetails?.contact || "",
        },
        notes: {
          admissionNumber,
          feeHeadId,
        },
        theme: {
          color: "#3399cc",
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Error initiating payment:", error);
      Swal.fire({
        icon: "error",
        title: "Payment Error",
        text: "Error initiating payment. Please try again later.",
      });
    }
  };

  // Compute totals for summary and chart.
  let totalOriginal = 0;
  let totalEffective = 0;
  let totalDue = 0;
  let totalReceived = 0;
  let totalConcession = 0;
  if (studentDetails && studentDetails.feeDetails && studentDetails.feeDetails.length > 0) {
    studentDetails.feeDetails.forEach((fee) => {
      if (fee.originalFeeDue !== "" && !isNaN(parseFloat(fee.originalFeeDue))) {
        totalOriginal += parseFloat(fee.originalFeeDue);
      }
      if (fee.effectiveFeeDue !== "" && !isNaN(parseFloat(fee.effectiveFeeDue))) {
        totalEffective += parseFloat(fee.effectiveFeeDue);
      }
      if (fee.finalAmountDue !== "" && !isNaN(parseFloat(fee.finalAmountDue))) {
        totalDue += parseFloat(fee.finalAmountDue);
      }
      if (fee.totalFeeReceived !== "" && !isNaN(parseFloat(fee.totalFeeReceived))) {
        totalReceived += parseFloat(fee.totalFeeReceived);
      }
      if (fee.totalConcessionReceived !== "" && !isNaN(parseFloat(fee.totalConcessionReceived))) {
        totalConcession += parseFloat(fee.totalConcessionReceived);
      }
    });
  }

  // Prepare data for the Pie Chart.
  const pieData = {
    labels: ["Total Due", "Total Received", "Total Concession"],
    datasets: [
      {
        data: [totalDue, totalReceived, totalConcession],
        backgroundColor: [
          "rgba(255, 99, 132, 0.8)",
          "rgba(54, 162, 235, 0.8)",
          "rgba(255, 206, 86, 0.8)"
        ],
        borderColor: "#fff",
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { 
        position: "right",
        labels: {
          font: {
            family: "Arial, sans-serif",
            size: 12,
            weight: "bold",
          },
        },
      },
      title: { display: false },
    },
  };

  // Prepare data for the Bar Chart.
  let feeHeadings = [];
  let effectiveFees = [];
  let feeReceivedArr = [];
  let concessionArr = [];
  if (studentDetails && studentDetails.feeDetails) {
    studentDetails.feeDetails.forEach((fee) => {
      feeHeadings.push(fee.fee_heading);
      effectiveFees.push(fee.effectiveFeeDue);
      feeReceivedArr.push(fee.totalFeeReceived);
      concessionArr.push(fee.totalConcessionReceived);
    });
  }

  const barData = {
    labels: feeHeadings,
    datasets: [
      {
        label: "Effective Fee",
        data: effectiveFees,
        backgroundColor: "rgba(75, 192, 192, 0.6)",
      },
      {
        label: "Fee Received",
        data: feeReceivedArr,
        backgroundColor: "rgba(54, 162, 235, 0.6)",
      },
      {
        label: "Concession Received",
        data: concessionArr,
        backgroundColor: "rgba(255, 206, 86, 0.6)",
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      title: { display: true, text: "Fee Comparison" },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };

  // Determine card border based on fee due conditions.
  const getCardClass = (fee) => {
    const dueAmount = parseFloat(fee.finalAmountDue);
    if (!isNaN(dueAmount)) {
      if (dueAmount > 0) {
        if (monthMapping.hasOwnProperty(fee.fee_heading)) {
          const feeMonth = monthMapping[fee.fee_heading];
          if (feeMonth < currentMonth) {
            return "border-danger";
          } else if (feeMonth === currentMonth) {
            return currentDay > 10 ? "border-danger" : "border-warning";
          } else if (feeMonth > currentMonth) {
            return "border-info";
          }
        } else {
          return "border-warning";
        }
      } else if (dueAmount === 0) {
        return "border-success";
      }
    }
    return "";
  };

 if (!canView) return <h2 className="text-center mt-5">Access Denied</h2>;

  return (
    <div className="App">    
      <div className="d-flex">
        <div className="content container" style={{ marginTop: "70px", marginLeft: "60px" }}>
          {loading ? (
            <p className="text-center">Loading student details...</p>
          ) : error ? (
            <p className="text-danger text-center">{error}</p>
          ) : studentDetails ? (
            // Main Tabs wrapping the three sections
            <Tabs
              activeKey={activeMainTab}
              onSelect={(k) => setActiveMainTab(k)}
              className="mb-4"
            >
              {/* Tab 1: Fee Details as Cards with Chart below */}
              <Tab eventKey="details" title="Fee Details">
                {/* Fee Details Cards */}
                <div className="row">
                  {studentDetails.feeDetails && studentDetails.feeDetails.length > 0 ? (
                    studentDetails.feeDetails.map((fee, index) => (
                      <div key={index} className="col-md-4 mb-3">
                        <div className={`card shadow-lg ${getCardClass(fee)}`}>
                          <div className="card-header text-center bg-light">
                            {fee.fee_heading}
                          </div>
                          <div className="card-body">
                            <p><strong>Original:</strong> {formatMoney(parseFloat(fee.originalFeeDue))}</p>
                            <p><strong>Effective:</strong> {formatMoney(parseFloat(fee.effectiveFeeDue))}</p>
                            <p><strong>Received:</strong> {formatMoney(parseFloat(fee.totalFeeReceived))}</p>
                            <p><strong>Van Received:</strong> {formatMoney(parseFloat(fee.totalVanFeeReceived))}</p>
                            <p><strong>Concession:</strong> {formatMoney(parseFloat(fee.totalConcessionReceived))}</p>
                            <p><strong>Due:</strong> {fee.finalAmountDue !== "" ? formatMoney(parseFloat(fee.finalAmountDue)) : "N/A"}</p>
                            <div className="text-center">
                              {parseFloat(fee.finalAmountDue) > 0 ? (
                                <button 
                                  className="btn btn-primary btn-sm" 
                                  onClick={() => handlePayFee(fee)}
                                >
                                  Pay
                                </button>
                              ) : (
                                <span className="text-success">Paid</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-12">
                      <p className="text-center">No fee details available.</p>
                    </div>
                  )}
                </div>
                {/* Fee Comparison Chart */}
                <div className="row mt-4">
                  <div className="col-12">
                    <div className="card shadow-lg p-4 bg-white rounded" style={{ height: "500px" }}>
                      <h4 className="card-header bg-info text-white text-center">
                        Fee Comparison Chart
                      </h4>
                      <div className="card-body" style={{ height: "400px" }}>
                        <Bar data={barData} options={barOptions} />
                      </div>
                    </div>
                  </div>
                </div>
              </Tab>
              
              {/* Tab 2: Fee Summary */}
              <Tab eventKey="summary" title="Fee Summary">
                <div className="row mb-4">
                  <div className="col-md-6">
                    <div className="card shadow-lg p-4 bg-white rounded">
                      <h4 className="card-header bg-info text-white text-center">
                        Fee Summary (Pie Chart)
                      </h4>
                      <div className="card-body" style={{ height: "400px" }}>
                        <Pie data={pieData} options={pieOptions} />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="card shadow-lg p-4 bg-white rounded">
                      <h4 className="card-header bg-secondary text-white text-center">
                        Fee Summary Table
                      </h4>
                      <div className="card-body" style={{ height: "400px", overflowY: "auto" }}>
                        <table className="table table-bordered table-striped">
                          <tbody>
                            <tr className="table-primary">
                              <th>Original Fee</th>
                              <td>{formatSummaryMoney(totalOriginal)}</td>
                            </tr>
                            <tr className="table-success">
                              <th>Effective Fee</th>
                              <td>{formatSummaryMoney(totalEffective)}</td>
                            </tr>
                            <tr className="table-danger">
                              <th>Total Due</th>
                              <td>{formatSummaryMoney(totalDue)}</td>
                            </tr>
                            <tr className="table-info">
                              <th>Total Received</th>
                              <td>{formatSummaryMoney(totalReceived)}</td>
                            </tr>
                            <tr className="table-warning">
                              <th>Total Concession</th>
                              <td>{formatSummaryMoney(totalConcession)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab>
              
              {/* Tab 3: Transaction History */}
              <Tab eventKey="history" title="Transaction History">
                <div className="row">
                  <div className="col-12">
                    <div className="card shadow-lg p-4 bg-white rounded mb-4">
                      <h4 className="card-header bg-dark text-white text-center">
                        Transaction History
                      </h4>
                      <div className="card-body">
                        {transactionHistory && transactionHistory.length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-bordered table-striped">
                              <thead>
                                <tr>
                                  <th>Fee Heading</th>
                                  <th>Serial</th>
                                  <th>Slip ID</th>
                                  <th>Date & Time</th>
                                  <th>Payment Mode</th>
                                  <th>Fee Received</th>
                                  <th>Concession</th>
                                  <th>Van Fee</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transactionHistory.map((txn) => (
                                  <tr key={txn.Serial}>
                                    <td>{txn.FeeHeading ? txn.FeeHeading.fee_heading : "N/A"}</td>
                                    <td>{txn.Serial}</td>
                                    <td>{txn.Slip_ID}</td>
                                    <td>{formatDateTime(txn.createdAt)}</td>
                                    <td>{txn.PaymentMode}</td>
                                    <td>{formatINR(txn.Fee_Recieved)}</td>
                                    <td>{formatINR(txn.Concession)}</td>
                                    <td>{formatINR(txn.VanFee || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p>No transaction history available.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Tab>
            </Tabs>
          ) : (
            <p className="text-center">No student details available.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
