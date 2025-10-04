// src/pages/StudentDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Tabs, Tab } from "react-bootstrap";

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

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const StudentDashboard = () => {
  // -------- Role + access gates ----------
  const roles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);
  const isStudent = roles.includes("student");
  const isAdminish = roles.includes("admin") || roles.includes("superadmin");
  const canView = isStudent || isAdminish;

  // -------- State ----------
  const [studentDetails, setStudentDetails] = useState(null);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [vanByHead, setVanByHead] = useState({}); // per-head van data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMainTab, setActiveMainTab] = useState("details");

  // -------- Helpers ----------
  const monthMapping = useMemo(
    () => ({
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
    }),
    []
  );
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();

  const formatMoney = (v) =>
    isNaN(v)
      ? v
      : Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatSummaryMoney = (v) =>
    isNaN(v)
      ? v
      : "₹ " + Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatINR = (v) =>
    isNaN(v)
      ? v
      : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
          .format(Number(v || 0));

  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // -------- Data fetch ----------
  const username = useMemo(() => localStorage.getItem("username"), []);
  useEffect(() => {
    if (!canView || !username) {
      setError("Access Denied");
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStudentDetails(username), fetchTransactionHistory(username)]);
      await fetchVanFeeByHead(); // per-head van fetch
      setLoading(false);
    };
    load();
  }, [canView, username]);

  // Optional: light polling
  useEffect(() => {
    if (username && canView) {
      const id = setInterval(() => {
        fetchStudentDetails(username);
        fetchTransactionHistory(username);
        fetchVanFeeByHead();
      }, 15000);
      return () => clearInterval(id);
    }
  }, [username, canView]);

  const fetchStudentDetails = async (admissionNumber) => {
    try {
      const res = await api.get(`/StudentsApp/admission/${admissionNumber}/fees`);
      setStudentDetails(res.data || null);
      setError(null);
    } catch (err) {
      console.error("Error fetching student details:", err);
      setError("Failed to load student details.");
    }
  };

  const fetchTransactionHistory = async (admissionNumber) => {
    try {
      const res = await api.get(`/StudentsApp/feehistory/${admissionNumber}`);
      if (res.data && res.data.success) {
        setTransactionHistory(res.data.data || []);
      } else {
        setTransactionHistory([]);
      }
    } catch (err) {
      console.error("Error fetching transaction history:", err);
    }
  };

  // per-head van fee data (for the logged-in student)
  const fetchVanFeeByHead = async () => {
    try {
      // add ?session_id=... if needed
      const res = await api.get(`/transactions/vanfee/me`);
      const rows = res.data && res.data.data ? res.data.data : Array.isArray(res.data) ? res.data : [];
      const map = {};
      rows.forEach((r) => {
        const id = Number(r.Fee_Head);
        map[id] = {
          transportCost: Number(r.TransportCost || 0),
          totalVanFeeReceived: Number(r.TotalVanFeeReceived || 0),
          totalVanFeeConcession: Number(r.TotalVanFeeConcession || 0),
        };
      });
      setVanByHead(map);
    } catch (e) {
      console.warn("Failed to fetch per-head van fee:", e?.message || e);
      setVanByHead({});
    }
  };

  // -------- Pay handlers ----------
  const handlePayFee = async (fee) => {
    const dueAmount = parseFloat(fee.finalAmountDue);
    if (isNaN(dueAmount) || dueAmount <= 0) {
      return Swal.fire({ icon: "error", title: "Invalid Fee Amount", text: "Cannot initiate payment." });
    }
    const { isConfirmed } = await Swal.fire({
      title: `Proceed to pay ₹ ${formatMoney(dueAmount)}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#4f46e5",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "Yes, pay now!",
      cancelButtonText: "Cancel",
      background: "#0f172a",
      color: "#e2e8f0",
    });
    if (!isConfirmed) return;

    const admissionNumber =
      studentDetails?.admissionNumber || studentDetails?.AdmissionNumber || localStorage.getItem("username");
    const feeHeadId = fee.fee_heading_id;

    if (!admissionNumber || !feeHeadId) {
      return Swal.fire({
        icon: "error",
        title: "Missing information",
        text: "Required fee information not available. Please contact support.",
      });
    }

    try {
      if (!window.Razorpay) {
        return Swal.fire({
          icon: "error",
          title: "Payment SDK not loaded",
          text: "Please refresh the page and try again.",
        });
      }
      const orderRes = await api.post("/student-fee/create-order", {
        admissionNumber,
        amount: dueAmount,
        feeHeadId,
      });
      const order = orderRes.data.order || orderRes.data;

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Pathseekers International School",
        description: `Fee Payment - ${fee.fee_heading}`,
        order_id: order.id,
        handler: async (resp) => {
          try {
            await api.post("/student-fee/verify-payment", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              admissionNumber,
              amount: dueAmount,
              feeHeadId,
            });
            Swal.fire({ icon: "success", title: "Payment Successful!", background: "#052e16", color: "#dcfce7" });
            fetchStudentDetails(admissionNumber);
            fetchTransactionHistory(admissionNumber);
            fetchVanFeeByHead();
          } catch (e) {
            console.error("Verification failed:", e);
            Swal.fire({ icon: "error", title: "Payment Verification Failed", text: "Please try again." });
          }
        },
        prefill: { name: studentDetails?.name || "" },
        notes: { admissionNumber, feeHeadId },
        theme: { color: "#22c55e" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error("Error initiating payment:", e);
      Swal.fire({ icon: "error", title: "Payment Error", text: "Please try again later." });
    }
  };

  const handlePayVanFee = async () => {
    const van = studentDetails?.vanFee;
    if (!van) return;
    const vanCost = Number(van.perHeadTotalDue || van.transportCost || 0);
    const vanReceived = Number(van.totalVanFeeReceived || 0);
    const vanConcession = Number(van.totalVanFeeConcession || 0);
    const vanDue = Math.max(vanCost - (vanReceived + vanConcession), 0);

    if (vanDue <= 0) {
      return Swal.fire({ icon: "info", title: "No Van Fee Due", text: "You're all clear on Van Fee." });
    }

    const { isConfirmed } = await Swal.fire({
      title: `Pay Van Fee ₹ ${formatMoney(vanDue)}?`,
      text: `Route${studentDetails?.transport?.villages ? `: ${studentDetails.transport.villages}` : ""}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Pay Now",
      confirmButtonColor: "#16a34a",
      background: "#0f172a",
      color: "#e2e8f0",
    });
    if (!isConfirmed) return;

    const admissionNumber =
      studentDetails?.admissionNumber || studentDetails?.AdmissionNumber || localStorage.getItem("username");

    try {
      if (!window.Razorpay) {
        return Swal.fire({
          icon: "error",
          title: "Payment SDK not loaded",
          text: "Please refresh the page and try again.",
        });
      }

      const orderRes = await api.post("/student-fee/create-order", {
        admissionNumber,
        amount: vanDue,
        feeHeadId: "VAN_FEE",
      });
      const order = orderRes.data.order || orderRes.data;

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Pathseekers International School",
        description: "Van Fee Payment",
        order_id: order.id,
        handler: async (resp) => {
          try {
            await api.post("/student-fee/verify-payment", {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              admissionNumber,
              amount: vanDue,
              feeHeadId: "VAN_FEE",
            });
            Swal.fire({ icon: "success", title: "Van Fee Paid!", background: "#052e16", color: "#dcfce7" });
            fetchStudentDetails(admissionNumber);
            fetchTransactionHistory(admissionNumber);
            fetchVanFeeByHead();
          } catch (e) {
            console.error("Verification failed:", e);
            Swal.fire({ icon: "error", title: "Verification Failed", text: "Please try again." });
          }
        },
        notes: { admissionNumber, feeHeadId: "VAN_FEE" },
        theme: { color: "#16a34a" },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) {
      console.error("Error initiating van fee payment:", e);
      Swal.fire({ icon: "error", title: "Payment Error", text: "Please try again later." });
    }
  };

  // -------- Totals (fee heads only; van handled separately) ----------
  let totalOriginal = 0,
    totalEffective = 0,
    totalDue = 0,
    totalReceived = 0,
    totalConcession = 0;

  const fees = studentDetails?.feeDetails || [];
  fees.forEach((f) => {
    totalOriginal += Number(f.originalFeeDue || 0);
    totalEffective += Number(f.effectiveFeeDue || 0);
    totalDue += Number(f.finalAmountDue || 0);
    totalReceived += Number(f.totalFeeReceived || 0);
    totalConcession += Number(f.totalConcessionReceived || 0);
  });

  // -------- Van metrics (overall) ----------
  const van = studentDetails?.vanFee || {
    transportCost: 0,
    totalVanFeeReceived: 0,
    totalVanFeeConcession: 0,
    vanFeeBalance: 0,
    perHeadTotalDue: 0,
  };
  const vanCost = Number(van.perHeadTotalDue || van.transportCost || 0); // prefer per-head sum if present
  const vanReceived = Number(van.totalVanFeeReceived || 0);
  const vanConcession = Number(van.totalVanFeeConcession || 0);
  const vanDue = Math.max(vanCost - (vanReceived + vanConcession), 0);

  // -------- Charts ----------
  const barData = {
    labels: fees.map((f) => f.fee_heading),
    datasets: [
      {
        label: "Effective Fee",
        data: fees.map((f) => f.effectiveFeeDue),
        backgroundColor: "rgba(34,197,94,0.8)", // emerald
      },
      {
        label: "Fee Received",
        data: fees.map((f) => f.totalFeeReceived),
        backgroundColor: "rgba(59,130,246,0.8)", // blue
      },
      {
        label: "Concession",
        data: fees.map((f) => f.totalConcessionReceived),
        backgroundColor: "rgba(245,158,11,0.85)", // amber
      },
    ],
  };
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, labels: { color: "#0f172a" } },
      title: { display: true, text: "Fee Comparison (Per Head)", color: "#0f172a", font: { weight: "bold" } },
      tooltip: {
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatINR(ctx.parsed.y)}` },
      },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(15,23,42,0.06)" }, ticks: { color: "#334155" } },
      x: { grid: { display: false }, ticks: { color: "#334155" } },
    },
  };

  const pieData = {
    labels: ["Total Due", "Total Received", "Total Concession", "Van Due", "Van Received"],
    datasets: [
      {
        data: [totalDue, totalReceived, totalConcession, vanDue, vanReceived],
        backgroundColor: ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#6366f1"],
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 10,
      },
    ],
  };
  const pieOptions = {
    responsive: true,
    plugins: {
      legend: { position: "right", labels: { color: "#0f172a" } },
      title: { display: true, text: "Overall Summary", color: "#0f172a", font: { weight: "bold" } },
      tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${formatINR(ctx.parsed)}` } },
    },
  };

  // -------- UI helpers ----------
  const getVanForHeadFromMap = (feeHeadId) => {
    const v = vanByHead[Number(feeHeadId)];
    if (!v) return null;
    const received = Number(v.totalVanFeeReceived || 0);
    const concession = Number(v.totalVanFeeConcession || 0);
    const cost = Number(v.transportCost || 0);
    const pending = Math.max(cost - (received + concession), 0);
    return {
      cost,
      received,
      concession,
      pending,
      due: cost, // legacy naming
    };
  };

  // NEW: prefer API's per-head transport object, fallback to /vanfee/me map
  const getTransportBreakdown = (fee) => {
    if (fee?.transportApplicable && fee?.transport) {
      const t = fee.transport;
      return {
        cost: Number(t.transportDue || 0) + Number(t.transportReceived || 0) + Number(t.transportConcession || 0), // inferred
        due: Number(t.transportDue || 0),
        received: Number(t.transportReceived || 0),
        concession: Number(t.transportConcession || 0),
        pending: Number(t.transportPending || 0),
        source: "api",
      };
    }
    const fallback = getVanForHeadFromMap(fee?.fee_heading_id);
    return fallback ? { ...fallback, source: "map" } : null;
  };

  const getCardClass = (fee) => {
    const academicDue = Number(fee.finalAmountDue || 0);
    const t = getTransportBreakdown(fee);
    const vanDueHead = Number(t?.pending || 0);
    const totalDueHead = academicDue + vanDueHead;

    if (totalDueHead > 0) {
      if (monthMapping[fee.fee_heading]) {
        const m = monthMapping[fee.fee_heading];
        if (m < currentMonth) return "border-danger glow-danger";
        if (m === currentMonth) return currentDay > 10 ? "border-danger glow-danger" : "border-warning glow-warn";
        return "border-info glow-info";
      }
      return "border-warning glow-warn";
    }
    if (totalDueHead === 0) return "border-success glow-success";
    return "";
  };

  if (!canView) return <h2 className="text-center mt-5">Access Denied</h2>;

  return (
    <div className="container-fluid px-2 px-md-3" style={{ marginTop: 72 }}>
      {/* Gradient Header */}
      {studentDetails && (
        <div className="rounded-4 p-3 p-md-4 mb-3 shadow-sm hero">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <div className="h4 mb-0 me-2 text-white">
              Welcome, <span className="fw-semibold">{studentDetails?.name || "Student"}</span>
            </div>
            <span className="badge badge-soft badge-soft-primary">
              Adm No: <strong className="ms-1">{studentDetails?.admissionNumber || username}</strong>
            </span>
            {studentDetails?.class_name && (
              <span className="badge badge-soft badge-soft-info">
                Class: <strong className="ms-1">{studentDetails.class_name}</strong>
              </span>
            )}
            {studentDetails?.section_name && (
              <span className="badge badge-soft badge-soft-secondary">
                Section: <strong className="ms-1">{studentDetails.section_name}</strong>
              </span>
            )}
            {studentDetails?.concession?.name && (
              <span className="badge badge-soft badge-soft-warning">
                Concession: <strong className="ms-1">{studentDetails.concession.name}</strong>
              </span>
            )}

            <div className="ms-auto d-flex gap-2">
              <button
                className="btn btn-light btn-sm rounded-pill px-3 action-chip"
                onClick={() => setActiveMainTab("details")}
              >
                <i className="bi bi-grid me-1" /> Fee Details
              </button>
              <button
                className="btn btn-outline-light btn-sm rounded-pill px-3 action-chip"
                onClick={() => setActiveMainTab("summary")}
              >
                <i className="bi bi-pie-chart me-1" /> Summary
              </button>
            </div>
          </div>

          {/* Transport chip row (more colorful) */}
          <div className="d-flex gap-2 mt-3 overflow-auto pb-1 fancy-chip-row">
            <div className="chip chip-purple">
              <i className="bi bi-geo-alt-fill me-1" />
              Route: <strong className="ms-1">{studentDetails?.transport?.villages || "—"}</strong>
            </div>
            <div className="chip chip-amber">
              <i className="bi bi-truck me-1" />
              Transport Due: <strong className="ms-1">{formatINR(vanCost)}</strong>
            </div>
            <div className="chip chip-blue">
              <i className="bi bi-wallet2 me-1" />
              Van Received: <strong className="ms-1">{formatINR(vanReceived)}</strong>
            </div>
            <div className="chip chip-orange">
              <i className="bi bi-ticket-perforated me-1" />
              Van Concession: <strong className="ms-1">{formatINR(vanConcession)}</strong>
            </div>
            <div className={`chip ${vanDue > 0 ? "chip-red" : "chip-green"}`}>
              <i className="bi bi-cash-coin me-1" />
              Van Due:
              <strong className="ms-1">{formatINR(vanDue)}</strong>
            </div>
            <button className="btn btn-success btn-sm ms-auto shrink-0" disabled={vanDue <= 0} onClick={handlePayVanFee}>
              <i className="bi bi-credit-card-2-front me-1" /> Pay Van Fee
            </button>
          </div>

          {/* KPI strip */}
          <div className="row g-2 g-md-3 mt-3">
            <div className="col-6 col-md-3">
              <div className="kpi kpi-green">
                <div className="kpi-label">Total Effective</div>
                <div className="kpi-value">{formatINR(totalEffective)}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="kpi kpi-blue">
                <div className="kpi-label">Received</div>
                <div className="kpi-value">{formatINR(totalReceived)}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="kpi kpi-amber">
                <div className="kpi-label">Concession</div>
                <div className="kpi-value">{formatINR(totalConcession)}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="kpi kpi-red">
                <div className="kpi-label">Total Due</div>
                <div className="kpi-value">{formatINR(totalDue)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="card shadow-sm rounded-4 glass">
        <div className="card-body p-3 p-md-4">
          {loading ? (
            <div className="loader shimmer mt-3">
              <div className="line w-75" />
              <div className="line w-50" />
              <div className="line w-100" />
            </div>
          ) : error ? (
            <p className="text-danger text-center">{error}</p>
          ) : studentDetails ? (
            <Tabs activeKey={activeMainTab} onSelect={(k) => setActiveMainTab(k)} className="mb-3 colorful-tabs">
              {/* ===== Fee Details ===== */}
              <Tab eventKey="details" title="Fee Details">
                <div className="row g-3">
                  {fees.length ? (
                    fees.map((fee, idx) => {
                      const t = getTransportBreakdown(fee); // transport per head (API first)
                      const academicDue = Number(fee.finalAmountDue || 0);
                      const totalInclVan = academicDue + Number(t?.pending || 0);

                      const paidPct =
                        ((Number(fee.totalFeeReceived || 0) + Number(fee.totalConcessionReceived || 0)) /
                          (Number(fee.effectiveFeeDue || 0) || 1)) *
                        100;

                      const vanPaidPct =
                        t && t.cost > 0
                          ? ((Number(t.received || 0) + Number(t.concession || 0)) / (Number(t.cost || 0) || 1)) * 100
                          : 0;

                      return (
                        <div key={idx} className="col-12 col-sm-6 col-lg-4">
                          <div className={`card h-100 border-2 ${getCardClass(fee)} fancy-card`}>
                            <div className="card-header gradient-soft fw-semibold d-flex justify-content-between align-items-center">
                              <span className="text-center w-100">
                                <i className="bi bi-receipt-cutoff me-1" /> {fee.fee_heading}
                              </span>

                              {/* Transport badge – shows pending/ok */}
                              {t ? (
                                t.pending > 0 ? (
                                  <span className="badge rounded-pill text-bg-warning ms-2">
                                    TR Pending: {formatINR(t.pending)}
                                  </span>
                                ) : (
                                  <span className="badge rounded-pill text-bg-success ms-2">TR Clear</span>
                                )
                              ) : (
                                <span className="badge rounded-pill text-bg-secondary ms-2">No Transport</span>
                              )}
                            </div>

                            <div className="card-body">
                              {/* Academic block */}
                              <div className="d-flex justify-content-between small mb-1">
                                <span>Original</span>
                                <span className="fw-semibold">{formatINR(fee.originalFeeDue)}</span>
                              </div>
                              <div className="d-flex justify-content-between small mb-1">
                                <span>Effective</span>
                                <span className="fw-semibold">{formatINR(fee.effectiveFeeDue)}</span>
                              </div>
                              <div className="d-flex justify-content-between small mb-1">
                                <span>Received</span>
                                <span className="fw-semibold">{formatINR(fee.totalFeeReceived)}</span>
                              </div>
                              <div className="d-flex justify-content-between small mb-2">
                                <span>Concession</span>
                                <span className="fw-semibold">{formatINR(fee.totalConcessionReceived)}</span>
                              </div>

                              <div className="mb-2">
                                <div className="progress progress-thin">
                                  <div
                                    className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                                    role="progressbar"
                                    style={{ width: `${Math.min(100, Math.max(0, paidPct)).toFixed(1)}%` }}
                                    aria-valuenow={paidPct}
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                  />
                                </div>
                                <div className="small text-muted mt-1">Academic Paid {paidPct.toFixed(1)}%</div>
                              </div>

                              {/* Transport block (head-wise) */}
                              {t && (
                                <div className="transport-panel mt-2">
                                  <div className="d-flex align-items-center justify-content-between mb-1">
                                    <div className="badge rounded-pill transport-badge">
                                      <i className="bi bi-truck me-1" />
                                      Transport ({fee.fee_heading})
                                    </div>
                                    <div className="small text-muted">
                                      {t.source === "api" ? "from API" : "from Summary"}
                                    </div>
                                  </div>

                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Due (Head)</span>
                                    <span className="value">{formatINR(t.due)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Received (Head)</span>
                                    <span className="value">{formatINR(t.received)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Concession (Head)</span>
                                    <span className="value">{formatINR(t.concession)}</span>
                                  </div>
                                  <div className="d-flex justify-content-between tiny-row">
                                    <span className="label">Pending (Head)</span>
                                    <span className={`value fw-bold ${t.pending > 0 ? "text-danger" : "text-success"}`}>
                                      {formatINR(t.pending)}
                                    </span>
                                  </div>

                                  {t.cost > 0 && (
                                    <>
                                      <div className="progress progress-thin mt-1">
                                        <div
                                          className="progress-bar bg-info progress-bar-striped progress-bar-animated"
                                          role="progressbar"
                                          style={{ width: `${Math.min(100, Math.max(0, vanPaidPct)).toFixed(1)}%` }}
                                          aria-valuenow={vanPaidPct}
                                          aria-valuemin="0"
                                          aria-valuemax="100"
                                        />
                                      </div>
                                      <div className="small text-muted mt-1">Transport Paid {vanPaidPct.toFixed(1)}%</div>
                                    </>
                                  )}
                                </div>
                              )}

                              <hr className="my-2" />
                              <div className="d-flex justify-content-between">
                                <span className="fw-semibold">Academic Due</span>
                                <span className={`fw-bold ${academicDue > 0 ? "text-danger" : "text-success"}`}>
                                  {formatINR(academicDue)}
                                </span>
                              </div>

                              {t ? (
                                <>
                                  <div className="d-flex justify-content-between mt-1">
                                    <span className="fw-semibold">Transport Pending (Head)</span>
                                    <span className={`fw-bold ${t.pending > 0 ? "text-danger" : "text-success"}`}>
                                      {formatINR(t.pending)}
                                    </span>
                                  </div>
                                  <div className="d-flex justify-content-between mt-1">
                                    <span className="fw-semibold">Total Due (incl. Transport)</span>
                                    <span className={`fw-bold ${totalInclVan > 0 ? "text-danger" : "text-success"}`}>
                                      {formatINR(totalInclVan)}
                                    </span>
                                  </div>
                                </>
                              ) : null}
                            </div>

                            <div className="card-footer bg-transparent">
                              {Number(fee.finalAmountDue) > 0 ? (
                                <button className="btn btn-primary w-100 soft-shadow" onClick={() => handlePayFee(fee)}>
                                  <i className="bi bi-currency-rupee me-1" /> Pay
                                </button>
                              ) : t && t.pending > 0 ? (
                                <div className="text-warning text-center fw-semibold">
                                  Academic Paid • Transport Pending
                                </div>
                              ) : (
                                <div className="text-success text-center fw-semibold">Paid</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-12">
                      <div className="alert alert-info">No fee details available.</div>
                    </div>
                  )}
                </div>

                {/* Comparison chart */}
                <div className="mt-4">
                  <div className="card shadow-sm rounded-4">
                    <div className="card-header bg-info text-white fw-semibold text-center">Fee Comparison</div>
                    <div className="card-body" style={{ height: 380 }}>
                      <Bar data={barData} options={barOptions} />
                    </div>
                  </div>
                </div>
              </Tab>

              {/* ===== Summary ===== */}
              <Tab eventKey="summary" title="Summary">
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="card h-100 shadow-sm rounded-4">
                      <div className="card-header bg-primary text-white text-center fw-semibold">Overall Summary</div>
                      <div className="card-body" style={{ height: 420 }}>
                        <Pie data={pieData} options={pieOptions} />
                      </div>
                    </div>
                  </div>

                  <div className="col-12 col-lg-6">
                    <div className="card h-100 shadow-sm rounded-4">
                      <div className="card-header bg-secondary text-white text-center fw-semibold">Breakdown</div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm align-middle">
                            <tbody>
                              <tr className="table-light">
                                <th>Original Fee</th>
                                <td className="text-end">{formatSummaryMoney(totalOriginal)}</td>
                              </tr>
                              <tr className="table-light">
                                <th>Effective Fee</th>
                                <td className="text-end">{formatSummaryMoney(totalEffective)}</td>
                              </tr>
                              <tr className="table-light">
                                <th>Total Received</th>
                                <td className="text-end">{formatSummaryMoney(totalReceived)}</td>
                              </tr>
                              <tr className="table-light">
                                <th>Total Concession</th>
                                <td className="text-end">{formatSummaryMoney(totalConcession)}</td>
                              </tr>
                              <tr className="table-warning">
                                <th>Total Due</th>
                                <td className="text-end fw-semibold">{formatSummaryMoney(totalDue)}</td>
                              </tr>
                              <tr className="table-success">
                                <th>Van Received</th>
                                <td className="text-end">{formatSummaryMoney(vanReceived)}</td>
                              </tr>
                              <tr className="table-warning">
                                <th>Van Due</th>
                                <td className="text-end fw-semibold">{formatSummaryMoney(vanDue)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <hr />

                        <div className="row g-2">
                          <div className="col-12">
                            <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center mb-2">
                              <div className="me-3">
                                <div className="small text-muted">Transport Due</div>
                                <div className="fs-6 fw-semibold">{formatINR(vanCost)}</div>
                              </div>
                              <div className="me-3">
                                <div className="small text-muted">Van Received</div>
                                <div className="fs-6 fw-semibold">{formatINR(vanReceived)}</div>
                              </div>
                              <div className="me-3">
                                <div className="small text-muted">Van Concession</div>
                                <div className="fs-6 fw-semibold">{formatINR(vanConcession)}</div>
                              </div>
                              <div className="me-3">
                                <div className="small text-muted">Van Due</div>
                                <div className={`fs-6 fw-bold ${vanDue > 0 ? "text-danger" : "text-success"}`}>
                                  {formatINR(vanDue)}
                                </div>
                              </div>
                              <div className="ms-auto">
                                <button className="btn btn-success btn-sm" onClick={handlePayVanFee} disabled={vanDue <= 0}>
                                  Pay Van Fee
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="small text-muted">
                          Route: <strong>{studentDetails?.transport?.villages || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Tab>

              {/* ===== History ===== */}
              <Tab eventKey="history" title="History">
                <div className="card shadow-sm rounded-4">
                  <div className="card-header bg-dark text-white text-center fw-semibold">Transaction History</div>
                  <div className="card-body">
                    {transactionHistory?.length ? (
                      <div className="table-responsive">
                        <table className="table table-striped table-bordered align-middle">
                          <thead className="table-light">
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
                                <td>
                                  <span className={`badge ${txn.PaymentMode === "ONLINE" ? "text-bg-primary" : "text-bg-secondary"}`}>
                                    {txn.PaymentMode}
                                  </span>
                                </td>
                                <td>{formatINR(txn.Fee_Recieved)}</td>
                                <td>{formatINR(txn.Concession)}</td>
                                <td>{formatINR(txn.VanFee || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="alert alert-info mb-0">No transaction history available.</div>
                    )}
                  </div>
                </div>
              </Tab>
            </Tabs>
          ) : (
            <p className="text-center">No student details available.</p>
          )}
        </div>
      </div>

      {/* Local styles */}
      <style>{`
        :root{
          --soft-bg: linear-gradient(135deg,#4f46e5, #06b6d4);
          --hero-bg: linear-gradient(135deg,#4f46e5 0%, #06b6d4 45%, #10b981 100%);
          --glass-bg: rgba(255,255,255,0.6);
          --glass-brd: rgba(148,163,184,0.25);
        }
        .hero{ background: var(--hero-bg); color:#e2e8f0; border:1px solid rgba(255,255,255,.25); }
        .badge-soft{ border:1px solid rgba(255,255,255,.45); color:#fff; backdrop-filter: blur(4px); }
        .badge-soft-primary{ background: rgba(59,130,246,.25); }
        .badge-soft-info{ background: rgba(6,182,212,.25); }
        .badge-soft-secondary{ background: rgba(148,163,184,.25); }
        .badge-soft-warning{ background: rgba(245,158,11,.25); }
        .action-chip{ backdrop-filter: blur(6px); }
        .glass{ background: var(--glass-bg); border:1px solid var(--glass-brd); }
        .gradient-soft{ background: linear-gradient(90deg, rgba(99,102,241,.15), rgba(6,182,212,.15)); }
        .fancy-card{ border-radius: 1rem; overflow: hidden; }
        .soft-shadow{ box-shadow: 0 8px 20px rgba(2,8,23,.12); }

        .fancy-chip-row { scrollbar-width: thin; }
        .fancy-chip-row::-webkit-scrollbar { height: 8px; }
        .fancy-chip-row::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 8px; }

        /* colorful chips */
        .chip { border-radius: 999px; padding: 8px 12px; font-size: .9rem; white-space: nowrap; color:#0b1220; border:1px solid rgba(0,0,0,.06); }
        .chip-purple{ background: linear-gradient(135deg,#ede9fe,#ddd6fe); }
        .chip-amber{ background: linear-gradient(135deg,#fef3c7,#fde68a); }
        .chip-blue{ background: linear-gradient(135deg,#dbeafe,#bfdbfe); }
        .chip-green{ background: linear-gradient(135deg,#dcfce7,#bbf7d0); }
        .chip-red{ background: linear-gradient(135deg,#fee2e2,#fecaca); }
        .chip-orange{ background: linear-gradient(135deg,#ffedd5,#fed7aa); }
        .shrink-0 { flex-shrink: 0; }

        .kpi{ border-radius: 1rem; padding: .85rem 1rem; color:#0b1220; background: #fff; border:1px solid #e5e7eb; }
        .kpi .kpi-label{ font-size: .8rem; opacity:.8; }
        .kpi .kpi-value{ font-size: 1.05rem; font-weight: 700; }
        .kpi-green{ background: linear-gradient(135deg,#dcfce7,#bbf7d0); }
        .kpi-blue{ background: linear-gradient(135deg,#dbeafe,#bfdbfe); }
        .kpi-amber{ background: linear-gradient(135deg,#fef3c7,#fde68a); }
        .kpi-red{ background: linear-gradient(135deg,#fee2e2,#fecaca); }

        .progress-thin{ height: .45rem; border-radius: 999px; }

        /* subtle glow borders per status */
        .glow-danger{ box-shadow: 0 0 0 3px rgba(239,68,68,.12) inset; }
        .glow-warn{ box-shadow: 0 0 0 3px rgba(245,158,11,.12) inset; }
        .glow-info{ box-shadow: 0 0 0 3px rgba(59,130,246,.12) inset; }
        .glow-success{ box-shadow: 0 0 0 3px rgba(16,185,129,.12) inset; }

        /* Tabs accent */
        .colorful-tabs .nav-link.active{ background: linear-gradient(90deg,#3b82f6,#10b981); color:#fff; border:0; }
        .colorful-tabs .nav-link{ border-radius: 999px !important; }

        /* Loader */
        .shimmer .line{ height: 14px; background: linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 37%,#e5e7eb 63%); background-size: 400% 100%; animation: shimmer 1.4s infinite; border-radius: 8px; margin-bottom: 10px; }
        @keyframes shimmer{ 0%{background-position: 100% 0;} 100%{background-position: -100% 0;} }

        /* Transport panel styling */
        .transport-panel{
          background: linear-gradient(135deg, rgba(59,130,246,.10), rgba(16,185,129,.10));
          border: 1px dashed rgba(15,23,42,.15);
          border-radius: 12px;
          padding: .6rem .7rem;
        }
        .transport-badge{
          background: rgba(99,102,241,.15);
          color: #111827;
        }
        .tiny-row .label{ font-size: .86rem; opacity: .85; }
        .tiny-row .value{ font-size: .95rem; }
      `}</style>
    </div>
  );
};

export default StudentDashboard;
