import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";

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
  Filler,
  TimeScale,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarElement,
  Filler,
  TimeScale
);

// ----- SMALL UTILITIES -----
const formatCurrency = (amount) =>
  "₹" + Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const compactNumber = (n) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(n || 0)
  );

const cardBg = [
  "linear-gradient(135deg, #4f46e5, #3b82f6)",
  "linear-gradient(135deg, #16a34a, #22c55e)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #0891b2, #06b6d4)",
  "linear-gradient(135deg, #ef4444, #f43f5e)",
  "linear-gradient(135deg, #6b7280, #94a3b8)",
];

// ----- COMPONENT -----
const Dashboard = () => {
  // Data states
  const [reportData, setReportData] = useState([]); // current month fee summary by category
  const [dayWiseSummary, setDayWiseSummary] = useState([]); // daily fee trend by category
  const [classWiseCount, setClassWiseCount] = useState([]); // class-wise new/old counts

  // UX states
  const [loading, setLoading] = useState({ report: false, day: false, class: false });
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timersRef = useRef({});

  // Settings
  const POLLING_INTERVAL = 15000; // 15s feels calmer than 5s

  // Fetchers
  const fetchReportData = async () => {
    setLoading((s) => ({ ...s, report: true }));
    try {
      const res = await api.get("/reports/current-month");
      setReportData(Array.isArray(res.data) ? res.data : res.data?.data || []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error fetching report data:", e);
      setError("Failed to fetch report data.");
    } finally {
      setLoading((s) => ({ ...s, report: false }));
    }
  };

  const fetchDayWiseSummary = async () => {
    setLoading((s) => ({ ...s, day: true }));
    try {
      const res = await api.get("/reports/day-wise-summary");
      setDayWiseSummary(Array.isArray(res.data) ? res.data : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error fetching day-wise summary:", e);
      setError("Failed to fetch day-wise summary.");
    } finally {
      setLoading((s) => ({ ...s, day: false }));
    }
  };

  const fetchClassWiseCount = async () => {
    setLoading((s) => ({ ...s, class: true }));
    try {
      const res = await api.get("/reports/class-wise-student-count");
      setClassWiseCount(Array.isArray(res.data) ? res.data : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error fetching class-wise student count:", e);
      setError("Failed to fetch class-wise student count.");
    } finally {
      setLoading((s) => ({ ...s, class: false }));
    }
  };

  const refreshAll = () => {
    fetchReportData();
    fetchDayWiseSummary();
    fetchClassWiseCount();
  };

  useEffect(() => {
    // initial fetch
    refreshAll();
  }, []);

  // Auto-refresh
  useEffect(() => {
    // clear any existing
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};

    if (!autoRefresh) return;

    timersRef.current.report = setInterval(fetchReportData, POLLING_INTERVAL);
    timersRef.current.day = setInterval(fetchDayWiseSummary, POLLING_INTERVAL);
    timersRef.current.class = setInterval(fetchClassWiseCount, POLLING_INTERVAL);

    return () => {
      Object.values(timersRef.current || {}).forEach(clearInterval);
    };
  }, [autoRefresh]);

  // ---- DERIVED AGGREGATIONS ----
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
      acc[category].totalFeeReceived += Number(item.totalFeeReceived || 0);
      acc[category].totalConcession += Number(item.totalConcession || 0);
      acc[category].totalVanFee += Number(item.totalVanFee || 0);
      acc[category].totalVanFeeConcession += Number(item.totalVanFeeConcession || 0);
      acc[category].totalFine += Number(item.totalFine || 0);
      return acc;
    }, {});
  }, [reportData]);

  const totalFeeReceived = Object.values(summary).reduce(
    (sum, c) => sum + c.totalFeeReceived,
    0
  );
  const totalVanFee = Object.values(summary).reduce((sum, c) => sum + c.totalVanFee, 0);
  const totalFine = Object.values(summary).reduce((sum, c) => sum + (c.totalFine || 0), 0);

  // Enrollments
  const newEnrollments = classWiseCount
    .filter((i) => i.admissionType === "New")
    .reduce((acc, i) => acc + Number(i.studentCount || 0), 0);
  const oldEnrollments = classWiseCount
    .filter((i) => i.admissionType === "Old")
    .reduce((acc, i) => acc + Number(i.studentCount || 0), 0);
  const totalEnrollments = newEnrollments + oldEnrollments;

  const classWiseEnrollments = {};
  classWiseCount.forEach((item) => {
    const cls = item.className;
    if (!classWiseEnrollments[cls]) classWiseEnrollments[cls] = { new: 0, old: 0 };
    if (item.admissionType === "New") classWiseEnrollments[cls].new += Number(item.studentCount || 0);
    if (item.admissionType === "Old") classWiseEnrollments[cls].old += Number(item.studentCount || 0);
  });
  const classColumns = Object.keys(classWiseEnrollments).sort();
  const overallNew = classColumns.reduce((s, c) => s + classWiseEnrollments[c].new, 0);
  const overallOld = classColumns.reduce((s, c) => s + classWiseEnrollments[c].old, 0);
  const overallTotal = overallNew + overallOld;

  // ---- CHART DATA ----
  const palette = [
    "#ef4444",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#ec4899",
  ];

  // Pie
  const pieData = {
    labels: Object.keys(summary),
    datasets: [
      {
        label: "Total Fee Received",
        data: Object.values(summary).map((t) => t.totalFeeReceived),
        backgroundColor: Object.keys(summary).map((_, i) => `${palette[i % palette.length]}33`),
        borderColor: Object.keys(summary).map((_, i) => palette[i % palette.length]),
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
            const pct = total ? ((value / total) * 100).toFixed(2) + "%" : "0%";
            return `${label}: ${formatCurrency(value)} (${pct})`;
          },
        },
      },
    },
    cutout: "55%",
  };

  // Line
  const uniqueDates = Array.from(new Set(dayWiseSummary.map((r) => r.transactionDate))).sort();
  const uniqueCategories = Array.from(new Set(dayWiseSummary.map((r) => r.feeCategoryName)));
  const lineDatasets = uniqueCategories.map((cat, idx) => ({
    label: cat,
    data: uniqueDates.map((d) => {
      const rec = dayWiseSummary.find((r) => r.transactionDate === d && r.feeCategoryName === cat);
      return rec ? Number(rec.totalFeeReceived || 0) : 0;
    }),
    borderColor: palette[idx % palette.length],
    backgroundColor: `${palette[idx % palette.length]}22`,
    tension: 0.35,
    fill: true,
    pointRadius: 2,
  }));
  const lineChartData = { labels: uniqueDates, datasets: lineDatasets };
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { title: { display: true, text: "Date" }, grid: { display: false } },
      y: { title: { display: true, text: "Fee Received" }, beginAtZero: true },
    },
    interaction: { intersect: false, mode: "index" },
  };

  // Bar (enrollments)
  const uniqueClasses = Array.from(new Set(classWiseCount.map((r) => r.className))).sort();
  const uniqueAdmissionTypes = Array.from(new Set(classWiseCount.map((r) => r.admissionType)));
  const barDatasets = uniqueAdmissionTypes.map((type, idx) => ({
    label: type,
    data: uniqueClasses.map((cls) => {
      const rec = classWiseCount.find((r) => r.className === cls && r.admissionType === type);
      return rec ? Number(rec.studentCount || 0) : 0;
    }),
    backgroundColor: `${palette[idx % palette.length]}33`,
    borderColor: palette[idx % palette.length],
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

  // ----- RENDER -----
  return (
    <div className="container-fluid px-3">
      {/* Header actions */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 my-3">
        <div>
          <h2 className="mb-0 fw-bold">Dashboard</h2>
          <small className="text-muted">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : ""}
          </small>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => setAutoRefresh((v) => !v)}>
            {autoRefresh ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
          </button>
          <button className="btn btn-primary" onClick={refreshAll}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">{error}</div>
      ) : null}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        {[
          { label: "Fee Received (MTD)", value: totalFeeReceived },
          { label: "Van Fee (MTD)", value: totalVanFee },
          { label: "Fine (MTD)", value: totalFine },
          { label: "Enrollments (Total)", value: totalEnrollments },
          { label: "New", value: newEnrollments },
          { label: "Old", value: oldEnrollments },
        ].map((kpi, i) => (
          <div key={kpi.label} className="col-12 col-sm-6 col-md-4 col-xl-2">
            <div
              className="card text-white shadow-sm border-0 h-100"
              style={{ background: cardBg[i % cardBg.length] }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="small text-white-50">{kpi.label}</div>
                    <div className="h4 mb-0">{formatCurrency(kpi.value)}</div>
                  </div>
                  <span className="badge bg-dark bg-opacity-25 border">{compactNumber(kpi.value)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category cards */}
      <div className="row g-3 mb-4">
        {Object.entries(summary).map(([category, totals], index) => (
          <div key={category} className="col-12 col-md-6 col-xl-4">
            <div className="card h-100 shadow-sm">
              <div className="card-header text-white" style={{ background: cardBg[index % cardBg.length] }}>
                <div className="d-flex justify-content-between align-items-center">
                  <strong>{category}</strong>
                  {(loading.report || loading.day) && (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  )}
                </div>
              </div>
              <div className="card-body">
                <div className="row small g-2">
                  <div className="col-6"><strong>Fee Received:</strong><br />{formatCurrency(totals.totalFeeReceived)}</div>
                  <div className="col-6"><strong>Concession:</strong><br />{formatCurrency(totals.totalConcession)}</div>
                  <div className="col-6"><strong>Van Fee:</strong><br />{formatCurrency(totals.totalVanFee)}</div>
                  <div className="col-6"><strong>Van Fee Concession:</strong><br />{formatCurrency(totals.totalVanFeeConcession)}</div>
                  {category === "Tuition Fee" && (
                    <div className="col-12"><strong>Fine:</strong> {formatCurrency(totals.totalFine || 0)}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-6">
          <div className="card h-100 shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">Fee Received Distribution</h5>
            </div>
            <div className="card-body" style={{ height: 320 }}>
              {loading.report ? (
                <div className="d-flex h-100 align-items-center justify-content-center">
                  <div className="spinner-border" role="status"></div>
                </div>
              ) : (
                <Doughnut data={pieData} options={pieChartOptions} />
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card h-100 shadow-sm">
            <div className="card-header bg-info text-white">
              <h5 className="card-title mb-0">Fee Received Trend by Category</h5>
            </div>
            <div className="card-body" style={{ height: 360 }}>
              {loading.day ? (
                <div className="d-flex h-100 align-items-center justify-content-center">
                  <div className="spinner-border" role="status"></div>
                </div>
              ) : (
                <Line data={lineChartData} options={lineChartOptions} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enrollment table */}
      <div className="row g-3 mb-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between">
              <h5 className="mb-0">Enrollments</h5>
              {loading.class && <div className="spinner-border spinner-border-sm" role="status"></div>}
            </div>
            <div className="card-body" style={{ overflowX: "auto" }}>
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    {classColumns.map((cls, i) => (
                      <th key={cls} className="text-nowrap" style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
                        {cls}
                      </th>
                    ))}
                    <th className="text-nowrap" style={{ textAlign: "left" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {classColumns.map((cls, i) => (
                      <td key={`new-${cls}`} style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
                        <span className="badge text-bg-success">N {classWiseEnrollments[cls].new}</span>
                      </td>
                    ))}
                    <td style={{ textAlign: "left" }}>
                      <span className="badge text-bg-success">N {overallNew}</span>
                    </td>
                  </tr>
                  <tr>
                    {classColumns.map((cls, i) => (
                      <td key={`old-${cls}`} style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
                        <span className="badge text-bg-secondary">O {classWiseEnrollments[cls].old}</span>
                      </td>
                    ))}
                    <td style={{ textAlign: "left" }}>
                      <span className="badge text-bg-secondary">O {overallOld}</span>
                    </td>
                  </tr>
                  <tr>
                    {classColumns.map((cls, i) => {
                      const t = classWiseEnrollments[cls].new + classWiseEnrollments[cls].old;
                      return (
                        <td key={`tot-${cls}`} style={{ textAlign: "left", borderRight: i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none" }}>
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
      <div className="row g-3 mb-5">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="card-title mb-0">Student Count by Class</h5>
            </div>
            <div className="card-body" style={{ height: 360 }}>
              {loading.class ? (
                <div className="d-flex h-100 align-items-center justify-content-center">
                  <div className="spinner-border" role="status"></div>
                </div>
              ) : (
                <Bar data={barChartData} options={barChartOptions} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subtle styles */}
      <style>{`
        .card { border-radius: 1rem; }
        .card-header { border-top-left-radius: 1rem !important; border-top-right-radius: 1rem !important; }
      `}</style>
    </div>
  );
};

export default Dashboard;
