// src/components/Dashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

// Pages
import Classes from "../pages/Classes";
import Students from "../pages/Students";
import FeeStructure from "../pages/FeeStructure";
import FeeHeadings from "../pages/FeeHeadings";
import FeeCategory from "../pages/FeeCategory";
import Sections from "../pages/Sections";
import Transportation from "../pages/Transportation";
import Schools from "../pages/Schools";
import Transactions from "../pages/Transactions/Transactions";
import Concessions from "../pages/Concessions";
import StudentDueTable from "../pages/StudentDueTable";
import DayWiseReport from "../pages/DayWiseReport";
import DayWiseCategoryReports from "../pages/DayWiseCategoryReports";
import Users from "../pages/UserManagement";
import SchoolFeeSummary from "../pages/SchoolFeeSummary";
import ConcessionReport from "../pages/ConcessionReport";
import VanFeeDetailedReport from "../pages/VanFeeDetailedReport";

// ⬇️ NEW
import CancelledTransactions from "../pages/Transactions/CancelledTransactions"; 

// Charts
import { Doughnut, Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarElement,
} from "chart.js";
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarElement
);

const Dashboard = () => {
  // Sidebar & section state
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Roles array (read once)
  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const old = localStorage.getItem("userRole");
      return old ? [old] : [];
    }
  }, []);

  // Report/chart states
  const [reportData, setReportData] = useState([]);
  const [dayWiseSummary, setDayWiseSummary] = useState([]);
  const [classWiseCount, setClassWiseCount] = useState([]);

  const POLLING_INTERVAL = 5000;

  // Helpers
  const formatCurrency = (amount) =>
    "₹" + Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const cardColors = [
    "bg-primary",
    "bg-success",
    "bg-warning",
    "bg-info",
    "bg-danger",
    "bg-secondary",
  ];

  // Fetchers
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const res = await api.get("/reports/current-month");
        setReportData(Array.isArray(res.data) ? res.data : res.data?.data || []);
      } catch (e) {
        console.error("Error fetching report data:", e);
      }
    };
    fetchReportData();
    const id = setInterval(fetchReportData, POLLING_INTERVAL);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchDayWiseSummary = async () => {
      try {
        const res = await api.get("/reports/day-wise-summary");
        setDayWiseSummary(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Error fetching day-wise summary:", e);
      }
    };
    fetchDayWiseSummary();
    const id = setInterval(fetchDayWiseSummary, POLLING_INTERVAL);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchClassWiseCount = async () => {
      try {
        const res = await api.get("/reports/class-wise-student-count");
        setClassWiseCount(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Error fetching class-wise student count:", e);
      }
    };
    fetchClassWiseCount();
    const id = setInterval(fetchClassWiseCount, POLLING_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // Aggregations
  const summary = useMemo(() => {
    return reportData.reduce((acc, item) => {
      const category = item.feeCategoryName;
      if (!acc[category]) {
        acc[category] = {
          totalFeeReceived: 0,
          totalConcession: 0,
          totalVanFee: 0,
          totalVanFeeConcession: 0,
          totalFine: 0,
        };
      }
      acc[category].totalFeeReceived += Number(item.totalFeeReceived);
      acc[category].totalConcession += Number(item.totalConcession);
      acc[category].totalVanFee += Number(item.totalVanFee);
      acc[category].totalVanFeeConcession += Number(item.totalVanFeeConcession);
      acc[category].totalFine += Number(item.totalFine || 0);
      return acc;
    }, {});
  }, [reportData]);

  const totalFeeReceived = Object.values(summary).reduce(
    (sum, c) => sum + c.totalFeeReceived,
    0
  );
  const totalVanFee = Object.values(summary).reduce(
    (sum, c) => sum + c.totalVanFee,
    0
  );
  const totalFine = Object.values(summary).reduce(
    (sum, c) => sum + (c.totalFine || 0),
    0
  );

  // Enrollments
  const newEnrollments = classWiseCount
    .filter((i) => i.admissionType === "New")
    .reduce((acc, i) => acc + Number(i.studentCount), 0);
  const oldEnrollments = classWiseCount
    .filter((i) => i.admissionType === "Old")
    .reduce((acc, i) => acc + Number(i.studentCount), 0);
  const totalEnrollments = newEnrollments + oldEnrollments;

  const classWiseEnrollments = {};
  classWiseCount.forEach((item) => {
    const cls = item.className;
    if (!classWiseEnrollments[cls]) classWiseEnrollments[cls] = { new: 0, old: 0 };
    if (item.admissionType === "New") classWiseEnrollments[cls].new += Number(item.studentCount);
    if (item.admissionType === "Old") classWiseEnrollments[cls].old += Number(item.studentCount);
  });
  const classColumns = Object.keys(classWiseEnrollments).sort();
  const overallNew = classColumns.reduce((s, c) => s + classWiseEnrollments[c].new, 0);
  const overallOld = classColumns.reduce((s, c) => s + classWiseEnrollments[c].old, 0);
  const overallTotal = overallNew + overallOld;

  // Charts data
  const lightColors = [
    "rgba(205,92,92,0.6)",
    "rgba(100,149,237,0.6)",
    "rgba(144,238,144,0.6)",
    "rgba(255,165,0,0.6)",
    "rgba(123,104,238,0.6)",
    "rgba(176,196,222,0.6)",
  ];
  const lightBorderColors = [
    "rgba(205,92,92,1)",
    "rgba(100,149,237,1)",
    "rgba(144,238,144,1)",
    "rgba(255,165,0,1)",
    "rgba(123,104,238,1)",
    "rgba(176,196,222,1)",
  ];

  const pieData = {
    labels: Object.keys(summary),
    datasets: [
      {
        label: "Total Fee Received",
        data: Object.values(summary).map((t) => t.totalFeeReceived),
        backgroundColor: lightColors,
        borderColor: lightBorderColors,
        borderWidth: 1,
      },
    ],
  };
  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.label || "";
            const value = ctx.parsed || 0;
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = ((value / total) * 100).toFixed(2) + "%";
            return `${label}: ${value} (${pct})`;
          },
        },
      },
    },
    cutout: "50%",
  };

  const uniqueDates = Array.from(new Set(dayWiseSummary.map((r) => r.transactionDate))).sort();
  const uniqueCategories = Array.from(new Set(dayWiseSummary.map((r) => r.feeCategoryName)));

  const lineDatasets = uniqueCategories.map((cat, idx) => ({
    label: cat,
    data: uniqueDates.map((d) => {
      const rec = dayWiseSummary.find(
        (r) => r.transactionDate === d && r.feeCategoryName === cat
      );
      return rec ? Number(rec.totalFeeReceived) : 0;
    }),
    borderColor: lightBorderColors[idx % lightBorderColors.length],
    backgroundColor: lightBorderColors[idx % lightBorderColors.length].replace("1)", "0.2)"),
    fill: false,
  }));
  const lineChartData = { labels: uniqueDates, datasets: lineDatasets };
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: "Date" } },
      y: { title: { display: true, text: "Fee Received" } },
    },
  };

  const uniqueClasses = Array.from(new Set(classWiseCount.map((r) => r.className))).sort();
  const uniqueAdmissionTypes = Array.from(
    new Set(classWiseCount.map((r) => r.admissionType))
  );
  const barDatasets = uniqueAdmissionTypes.map((type, idx) => ({
    label: type,
    data: uniqueClasses.map((cls) => {
      const rec = classWiseCount.find((r) => r.className === cls && r.admissionType === type);
      return rec ? Number(rec.studentCount) : 0;
    }),
    backgroundColor: lightColors[idx % lightColors.length].replace("0.6", "0.4"),
    borderColor: lightBorderColors[idx % lightBorderColors.length],
    borderWidth: 1,
  }));
  const barChartData = { labels: uniqueClasses, datasets: barDatasets };
  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: "Class" } },
      y: { title: { display: true, text: "Student Count" }, beginAtZero: true },
    },
  };

  // Section renderer
  const renderSection = () => {
    switch (activeSection) {
      case "users": return <Users />;
      case "classes": return <Classes />;
      case "students": return <Students />;
      case "feeStructure": return <FeeStructure />;
      case "feeHeadings": return <FeeHeadings />;
      case "feeCategory": return <FeeCategory />;
      case "schoolFeeSummary": return <SchoolFeeSummary />;
      case "concessionReport": return <ConcessionReport />;
      case "vanFeeDetailedReport": return <VanFeeDetailedReport />;
      case "sections": return <Sections />;
      case "transportation": return <Transportation />;
      case "transactions": return <Transactions />;
      // ⬇️ NEW
      case "cancelledTransactions": return <CancelledTransactions />;
      case "schools": return <Schools />;
      case "concessions": return <Concessions />;
      case "studentDue": return <StudentDueTable />;
      case "dayWiseReport": return <DayWiseReport />;
      case "dayWiseCategoryReports": return <DayWiseCategoryReports />;
      case "dashboard":
        return (
          <>
            {/* Cards */}
            <div className="row mb-4">
              {Object.entries(summary).map(([category, totals], index) => (
                <div key={category} className="col-md-3 col-sm-6 mb-3">
                  <div className="card h-100">
                    <div className={`card-header text-white ${cardColors[index % cardColors.length]}`}>
                      {category}
                    </div>
                    <div className="card-body">
                      <p className="mb-1"><strong>Fee Received:</strong> {formatCurrency(totals.totalFeeReceived)}</p>
                      <p className="mb-1"><strong>Concession:</strong> {formatCurrency(totals.totalConcession)}</p>
                      <p className="mb-1"><strong>Van Fee:</strong> {formatCurrency(totals.totalVanFee)}</p>
                      <p className="mb-1"><strong>Van Fee Concession:</strong> {formatCurrency(totals.totalVanFeeConcession)}</p>
                      {category === "Tuition Fee" && (
                        <p className="mb-1"><strong>Fine:</strong> {formatCurrency(totals.totalFine || 0)}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="col-md-3 col-sm-6 mb-3">
                <div className="card h-100">
                  <div className="card-header text-white bg-dark">Total</div>
                  <div className="card-body">
                    <p className="mb-1"><strong>Fee Received:</strong> {formatCurrency(totalFeeReceived)}</p>
                    <p className="mb-1"><strong>Van Fee:</strong> {formatCurrency(totalVanFee)}</p>
                    <p className="mb-1"><strong>Fine:</strong> {formatCurrency(totalFine)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie & Line */}
            <div className="row mb-4">
              <div className="col-md-6 mb-4">
                <div className="card">
                  <div className="card-header bg-primary text-white">
                    <h3 className="card-title mb-0">Fee Received Distribution</h3>
                  </div>
                  <div className="card-body" style={{ height: "250px" }}>
                    <Doughnut data={pieData} options={pieChartOptions} />
                  </div>
                </div>
              </div>
              <div className="col-md-6 mb-4">
                <div className="card">
                  <div className="card-header bg-info text-white">
                    <h3 className="card-title mb-0">Fee Received Trend by Category</h3>
                  </div>
                  <div className="card-body" style={{ height: "300px" }}>
                    <Line data={lineChartData} options={lineChartOptions} />
                  </div>
                </div>
              </div>
            </div>

            {/* Enrollment table */}
            <div className="row mb-4">
              <div className="col-md-12">
                <div className="card">
                  <div className="card-header text-white bg-dark">Enrollments</div>
                  <div className="card-body" style={{ overflowX: "auto" }}>
                    <table className="table table-borderless table-sm mb-0">
                      <thead>
                        <tr>
                          {classColumns.map((cls, i) => (
                            <th key={cls}
                                style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
                              {cls}
                            </th>
                          ))}
                          <th style={{ textAlign: "left" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {classColumns.map((cls, i) => (
                            <td key={cls}
                                style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
                              N {classWiseEnrollments[cls].new}
                            </td>
                          ))}
                          <td style={{ textAlign: "left" }}>N {overallNew}</td>
                        </tr>
                        <tr>
                          {classColumns.map((cls, i) => (
                            <td key={cls}
                                style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
                              O {classWiseEnrollments[cls].old}
                            </td>
                          ))}
                          <td style={{ textAlign: "left" }}>O {overallOld}</td>
                        </tr>
                        <tr>
                          {classColumns.map((cls, i) => {
                            const t = classWiseEnrollments[cls].new + classWiseEnrollments[cls].old;
                            return (
                              <td key={cls}
                                  style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
                                <strong>T {t}</strong>
                              </td>
                            );
                          })}
                          <td style={{ textAlign: "left" }}>
                            <strong>T {overallTotal}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Bar chart */}
            <div className="row mb-4">
              <div className="col-md-12 mb-4">
                <div className="card">
                  <div className="card-header bg-primary text-white">
                    <h3 className="card-title mb-0">Student Count by Class</h3>
                  </div>
                  <div className="card-body" style={{ height: "300px" }}>
                    <Bar data={barChartData} options={barChartOptions} />
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      default:
        return (
          <div>
            <h1>Page Not Found</h1>
            <p>The selected section does not exist.</p>
          </div>
        );
    }
  };

  return (
    <div className="App">
      <Navbar />
      <div className="d-flex">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isExpanded={isSidebarExpanded}
          setIsSidebarExpanded={setIsSidebarExpanded}
          setIsExpanded={setIsSidebarExpanded}
          userRoles={userRoles}
        />
        <div
          className="content container"
          style={{
            marginTop: "70px",
            marginLeft: isSidebarExpanded ? "250px" : "60px",
            transition: "margin-left 0.3s ease",
          }}
        >
          {renderSection()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
