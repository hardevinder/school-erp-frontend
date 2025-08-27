// File: src/components/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

// ---------- SMALL UTILITIES ----------
const formatCurrency = (amount) =>
  "₹" +
  Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

const compactNumber = (n) =>
  new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(n || 0));

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

const cardGradients = [
  "linear-gradient(135deg, #4f46e5, #3b82f6)",
  "linear-gradient(135deg, #16a34a, #22c55e)",
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #0891b2, #06b6d4)",
  "linear-gradient(135deg, #ef4444, #f43f5e)",
  "linear-gradient(135deg, #6b7280, #94a3b8)",
];

// Download helper (PNG)
const downloadChart = (chartRef, filename = "chart.png") => {
  if (!chartRef?.current) return;
  const link = document.createElement("a");
  link.download = filename;
  link.href = chartRef.current.toBase64Image();
  link.click();
};

// ---------- COMPONENT ----------
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

  // Chart refs
  const pieRef = useRef(null);
  const lineRef = useRef(null);
  const barRef = useRef(null);

  // Legend toggle per chart
  const [showLegends, setShowLegends] = useState({
    pie: true,
    line: true,
    bar: true,
  });

  // Settings
  const POLLING_INTERVAL = 15000; // 15s calmer than 5s

  // Fetchers
  const fetchReportData = useCallback(async () => {
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
  }, []);

  const fetchDayWiseSummary = useCallback(async () => {
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
  }, []);

  const fetchClassWiseCount = useCallback(async () => {
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
  }, []);

  const refreshAll = useCallback(() => {
    fetchReportData();
    fetchDayWiseSummary();
    fetchClassWiseCount();
  }, [fetchReportData, fetchDayWiseSummary, fetchClassWiseCount]);

  useEffect(() => {
    // initial fetch
    refreshAll();
  }, [refreshAll]);

  // Auto-refresh
  useEffect(() => {
    // clear existing
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};

    if (!autoRefresh) return;

    timersRef.current.report = setInterval(fetchReportData, POLLING_INTERVAL);
    timersRef.current.day = setInterval(fetchDayWiseSummary, POLLING_INTERVAL);
    timersRef.current.class = setInterval(fetchClassWiseCount, POLLING_INTERVAL);

    return () => {
      Object.values(timersRef.current || {}).forEach(clearInterval);
    };
  }, [autoRefresh, fetchReportData, fetchDayWiseSummary, fetchClassWiseCount]);

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
    if (item.admissionType === "New")
      classWiseEnrollments[cls].new += Number(item.studentCount || 0);
    if (item.admissionType === "Old")
      classWiseEnrollments[cls].old += Number(item.studentCount || 0);
  });
  const classColumns = Object.keys(classWiseEnrollments).sort();
  const overallNew = classColumns.reduce((s, c) => s + classWiseEnrollments[c].new, 0);
  const overallOld = classColumns.reduce((s, c) => s + classWiseEnrollments[c].old, 0);
  const overallTotal = overallNew + overallOld;

  // ---- CHART DATA ----
  // Pie
  const pieData = useMemo(() => {
    const labels = Object.keys(summary);
    const data = Object.values(summary).map((t) => t.totalFeeReceived);
    return {
      labels,
      datasets: [
        {
          label: "Total Fee Received",
          data,
          backgroundColor: labels.map((_, i) => `${palette[i % palette.length]}33`),
          borderColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 1.5,
        },
      ],
    };
  }, [summary]);

  const pieChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: showLegends.pie, position: "right" },
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
      cutout: "58%",
    }),
    [showLegends.pie]
  );

  // Line
  const uniqueDates = useMemo(
    () => Array.from(new Set(dayWiseSummary.map((r) => r.transactionDate))).sort(),
    [dayWiseSummary]
  );
  const uniqueCategories = useMemo(
    () => Array.from(new Set(dayWiseSummary.map((r) => r.feeCategoryName))),
    [dayWiseSummary]
  );

  const lineDatasets = useMemo(
    () =>
      uniqueCategories.map((cat, idx) => ({
        label: cat,
        data: uniqueDates.map((d) => {
          const rec = dayWiseSummary.find(
            (r) => r.transactionDate === d && r.feeCategoryName === cat
          );
          return rec ? Number(rec.totalFeeReceived || 0) : 0;
        }),
        borderColor: palette[idx % palette.length],
        backgroundColor: `${palette[idx % palette.length]}22`,
        tension: 0.35,
        fill: true,
        pointRadius: 2,
      })),
    [uniqueCategories, uniqueDates, dayWiseSummary]
  );

  const lineChartData = useMemo(
    () => ({ labels: uniqueDates, datasets: lineDatasets }),
    [uniqueDates, lineDatasets]
  );

  const lineChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Date" }, grid: { display: false } },
        y: {
          title: { display: true, text: "Fee Received" },
          beginAtZero: true,
          ticks: {
            callback: (val) => compactNumber(val),
          },
        },
      },
      plugins: { legend: { display: showLegends.line } },
      interaction: { intersect: false, mode: "index" },
    }),
    [showLegends.line]
  );

  // Bar (enrollments)
  const uniqueClasses = useMemo(
    () => Array.from(new Set(classWiseCount.map((r) => r.className))).sort(),
    [classWiseCount]
  );
  const uniqueAdmissionTypes = useMemo(
    () => Array.from(new Set(classWiseCount.map((r) => r.admissionType))),
    [classWiseCount]
  );
  const barDatasets = useMemo(
    () =>
      uniqueAdmissionTypes.map((type, idx) => ({
        label: type,
        data: uniqueClasses.map((cls) => {
          const rec = classWiseCount.find((r) => r.className === cls && r.admissionType === type);
          return rec ? Number(rec.studentCount || 0) : 0;
        }),
        backgroundColor: `${palette[idx % palette.length]}33`,
        borderColor: palette[idx % palette.length],
        borderWidth: 1,
      })),
    [uniqueAdmissionTypes, uniqueClasses, classWiseCount]
  );
  const barChartData = useMemo(
    () => ({ labels: uniqueClasses, datasets: barDatasets }),
    [uniqueClasses, barDatasets]
  );
  const barChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Class" } },
        y: {
          title: { display: true, text: "Student Count" },
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
      plugins: { legend: { display: showLegends.bar } },
    }),
    [showLegends.bar]
  );

  // ---------- RENDER ----------
  const kpis = [
    { label: "Fee Received (MTD)", value: totalFeeReceived, icon: "bi-cash-coin" },
    { label: "Van Fee (MTD)", value: totalVanFee, icon: "bi-truck" },
    { label: "Fine (MTD)", value: totalFine, icon: "bi-exclamation-triangle" },
    { label: "Enrollments (Total)", value: totalEnrollments, icon: "bi-people" },
    { label: "New", value: newEnrollments, icon: "bi-person-plus" },
    { label: "Old", value: oldEnrollments, icon: "bi-person-check" },
  ];

  const totalForShare = Object.values(summary).reduce(
    (a, c) => a + (c?.totalFeeReceived || 0),
    0
  );

  return (
    <div className="container-fluid px-3">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 my-3">
        <div>
          <h2 className="mb-0 fw-bold d-flex align-items-center gap-2">
            Dashboard
            {autoRefresh && (
              <span
                className="badge bg-success-subtle text-success border d-inline-flex align-items-center gap-1"
                title="Auto-refresh is ON"
              >
                <span className="pulse-dot" /> Live
              </span>
            )}
          </h2>
          <small className="text-muted">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : "Fetching…"}
          </small>
        </div>
        <div className="d-flex gap-2">
          <button
            className={`btn ${autoRefresh ? "btn-outline-secondary" : "btn-outline-success"}`}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
          </button>
          <button className="btn btn-primary" onClick={refreshAll}>
            <i className="bi bi-arrow-clockwise me-1" /> Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <i className="bi bi-exclamation-octagon-fill fs-5"></i>
          <div className="flex-grow-1">
            <div className="fw-semibold">Something went wrong</div>
            <div className="small">{error}</div>
          </div>
          <button className="btn btn-sm btn-light border" onClick={refreshAll}>
            Try again
          </button>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        {kpis.map((kpi, i) => (
          <div key={kpi.label} className="col-12 col-sm-6 col-md-4 col-xl-2">
            <div
              className="card text-white shadow-sm border-0 h-100 kpi-card hover-lift"
              style={{ background: cardGradients[i % cardGradients.length] }}
            >
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="small text-white-50">{kpi.label}</div>
                    <div className="h4 mb-1">{formatCurrency(kpi.value)}</div>
                    <span className="small text-white-50">
                      {loading.report || loading.day || loading.class ? "Updating…" : "Up to date"}
                    </span>
                  </div>
                  <div className="text-end d-flex flex-column align-items-end">
                    <i className={`bi ${kpi.icon} fs-3 opacity-75`}></i>
                    <span className="badge bg-dark bg-opacity-25 border mt-2">
                      {compactNumber(kpi.value)}
                    </span>
                  </div>
                </div>
              </div>
              {loading.report && i < 3 ? <div className="kpi-shimmer" /> : null}
            </div>
          </div>
        ))}
      </div>

      {/* Category cards */}
      <div className="row g-3 mb-4">
        {Object.entries(summary).map(([category, totals], index) => {
          const share =
            totalForShare > 0 ? (totals.totalFeeReceived / totalForShare) * 100 : 0;
        return (
          <div key={category} className="col-12 col-md-6 col-xl-4">
            <div className="card h-100 shadow-sm hover-lift">
              <div
                className="card-header text-white"
                style={{ background: cardGradients[index % cardGradients.length] }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <strong>{category}</strong>
                  {(loading.report || loading.day) && (
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  )}
                </div>
              </div>
              <div className="card-body">
                <div className="row small g-2 mb-3">
                  <div className="col-6">
                    <strong>Fee Received:</strong>
                    <br />
                    {formatCurrency(totals.totalFeeReceived)}
                  </div>
                  <div className="col-6">
                    <strong>Concession:</strong>
                    <br />
                    {formatCurrency(totals.totalConcession)}
                  </div>
                  <div className="col-6">
                    <strong>Van Fee:</strong>
                    <br />
                    {formatCurrency(totals.totalVanFee)}
                  </div>
                  <div className="col-6">
                    <strong>Van Fee Concession:</strong>
                    <br />
                    {formatCurrency(totals.totalVanFeeConcession)}
                  </div>
                  {category === "Tuition Fee" && (
                    <div className="col-12">
                      <strong>Fine:</strong> {formatCurrency(totals.totalFine || 0)}
                    </div>
                  )}
                </div>
                {/* Share bar */}
                <div>
                  <div className="d-flex justify-content-between small text-muted mb-1">
                    <span>Share of total</span>
                    <span>{share.toFixed(1)}%</span>
                  </div>
                  <div className="progress" role="progressbar" aria-label="Share of total">
                    <div
                      className="progress-bar"
                      style={{
                        width: `${share}%`,
                        backgroundColor: palette[index % palette.length],
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )})}
      </div>

      {/* Charts Row */}
      <div className="row g-3 mb-4">
        {/* PIE */}
        <div className="col-12 col-xl-6">
          <div className="card h-100 shadow-sm">
            <div className="card-header bg-primary text-white d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">Fee Received Distribution</h5>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowLegends((s) => ({ ...s, pie: !s.pie }))}
                  title="Toggle legend"
                >
                  <i className="bi bi-list-task" />
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => downloadChart(pieRef, "fee-distribution.png")}
                  title="Download PNG"
                >
                  <i className="bi bi-download" />
                </button>
                <button className="btn btn-sm btn-light" onClick={fetchReportData} title="Refresh">
                  <i className="bi bi-arrow-clockwise" />
                </button>
              </div>
            </div>
            <div className="card-body" style={{ height: 340 }}>
              {loading.report ? (
                <div className="skeleton-chart" />
              ) : pieData.labels.length ? (
                <Doughnut ref={pieRef} data={pieData} options={pieChartOptions} />
              ) : (
                <div className="text-center text-muted">No data</div>
              )}
            </div>
          </div>
        </div>

        {/* LINE */}
        <div className="col-12 col-xl-6">
          <div className="card h-100 shadow-sm">
            <div className="card-header bg-info text-white d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">Fee Received Trend by Category</h5>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowLegends((s) => ({ ...s, line: !s.line }))}
                  title="Toggle legend"
                >
                  <i className="bi bi-list-task" />
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => downloadChart(lineRef, "fee-trend.png")}
                  title="Download PNG"
                >
                  <i className="bi bi-download" />
                </button>
                <button className="btn btn-sm btn-light" onClick={fetchDayWiseSummary} title="Refresh">
                  <i className="bi bi-arrow-clockwise" />
                </button>
              </div>
            </div>
            <div className="card-body" style={{ height: 380 }}>
              {loading.day ? (
                <div className="skeleton-chart" />
              ) : uniqueDates.length ? (
                <Line ref={lineRef} data={lineChartData} options={lineChartOptions} />
              ) : (
                <div className="text-center text-muted">No data</div>
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
              {loading.class && (
                <div className="spinner-border spinner-border-sm" role="status"></div>
              )}
            </div>
            <div className="card-body" style={{ overflowX: "auto" }}>
              {classColumns.length === 0 ? (
                <div className="text-center text-muted py-3">No enrollment data</div>
              ) : (
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                    <tr>
                      {classColumns.map((cls, i) => (
                        <th
                          key={cls}
                          className="text-nowrap"
                          style={{
                            textAlign: "left",
                            borderRight:
                              i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none",
                          }}
                        >
                          {cls}
                        </th>
                      ))}
                      <th className="text-nowrap" style={{ textAlign: "left" }}>
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {classColumns.map((cls, i) => (
                        <td
                          key={`new-${cls}`}
                          style={{
                            textAlign: "left",
                            borderRight:
                              i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none",
                          }}
                        >
                          <span className="badge text-bg-success">N {classWiseEnrollments[cls].new}</span>
                        </td>
                      ))}
                      <td style={{ textAlign: "left" }}>
                        <span className="badge text-bg-success">N {overallNew}</span>
                      </td>
                    </tr>
                    <tr>
                      {classColumns.map((cls, i) => (
                        <td
                          key={`old-${cls}`}
                          style={{
                            textAlign: "left",
                            borderRight:
                              i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none",
                          }}
                        >
                          <span className="badge text-bg-secondary">
                            O {classWiseEnrollments[cls].old}
                          </span>
                        </td>
                      ))}
                      <td style={{ textAlign: "left" }}>
                        <span className="badge text-bg-secondary">O {overallOld}</span>
                      </td>
                    </tr>
                    <tr>
                      {classColumns.map((cls, i) => {
                        const t =
                          classWiseEnrollments[cls].new + classWiseEnrollments[cls].old;
                        return (
                          <td
                            key={`tot-${cls}`}
                            style={{
                              textAlign: "left",
                              borderRight:
                                i !== classColumns.length - 1 ? "1px solid #dee2e6" : "none",
                            }}
                          >
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="row g-3 mb-5">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">Student Count by Class</h5>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowLegends((s) => ({ ...s, bar: !s.bar }))}
                  title="Toggle legend"
                >
                  <i className="bi bi-list-task" />
                </button>
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => downloadChart(barRef, "student-count.png")}
                  title="Download PNG"
                >
                  <i className="bi bi-download" />
                </button>
                <button className="btn btn-sm btn-light" onClick={fetchClassWiseCount} title="Refresh">
                  <i className="bi bi-arrow-clockwise" />
                </button>
              </div>
            </div>
            <div className="card-body" style={{ height: 380 }}>
              {loading.class ? (
                <div className="skeleton-chart" />
              ) : uniqueClasses.length ? (
                <Bar ref={barRef} data={barChartData} options={barChartOptions} />
              ) : (
                <div className="text-center text-muted">No data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .card { border-radius: 1rem; }
        .card-header { border-top-left-radius: 1rem !important; border-top-right-radius: 1rem !important; }
        .hover-lift { transition: transform .2s ease, box-shadow .2s ease; }
        .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 0.75rem 1.25rem rgba(0,0,0,.08); }

        .kpi-card { position: relative; overflow: hidden; backdrop-filter: saturate(1.2) blur(2px); }
        .kpi-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(110deg, rgba(255,255,255,.08), rgba(255,255,255,.18), rgba(255,255,255,.08));
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
          pointer-events: none;
        }
        @keyframes shimmer { to { background-position-x: -200%; } }

        .skeleton-chart {
          height: 100%; width: 100%; border-radius: .75rem;
          background: linear-gradient(110deg, #f3f4f6 8%, #e5e7eb 18%, #f3f4f6 33%);
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
        }

        .pulse-dot {
          width: .5rem; height: .5rem; border-radius: 50%;
          background: #22c55e; display: inline-block; position: relative;
        }
        .pulse-dot::after {
          content: ""; position: absolute; inset: 0; border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(34,197,94,.6); animation: pulse 1.5s infinite;
        }
        @keyframes pulse { 70% { box-shadow: 0 0 0 .45rem rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }

        /* Better focus outline for a11y */
        button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
      `}</style>

      {/* Bootstrap Icons (optional if not already globally included) */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
      />
    </div>
  );
};

export default Dashboard;
