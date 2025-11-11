// File: src/components/Dashboard.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import api from "../api";

// Charts
import { Doughnut, Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
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
  ChartTooltip,
  Legend,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  BarElement,
  Filler,
  TimeScale
);

/* ------------------- INLINE VALUE LABEL PLUGIN ------------------- */
const ValueLabelPlugin = {
  id: "valueLabel",
  afterDatasetsDraw(chart, args, opts) {
    const {
      enabled = false,
      formatter,
      showZero = true,
      align = "center",
      offsetY = -8,
    } = opts || {};
    if (!enabled) return;

    const { ctx } = chart;
    ctx.save();

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      meta.data.forEach((element, index) => {
        const raw = dataset.data[index];
        const value = Number(raw || 0);
        if (!showZero && !value) return;

        let pos = element.tooltipPosition
          ? element.tooltipPosition()
          : element.getCenterPoint?.() || { x: 0, y: 0 };
        let x = pos.x;
        let y = pos.y;

        if (meta.type === "bar") y = y + (offsetY || -8);

        const text =
          typeof formatter === "function"
            ? formatter(value, { chart, dataset, datasetIndex, index })
            : String(value);

        ctx.font = "bold 13px 'Inter', sans-serif";
        ctx.fillStyle = "#1f2937";
        ctx.textAlign = align;
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        if (x < 0 || x > chart.width || y < 0 || y > chart.height) return;

        ctx.fillText(text, x, y);
      });
    });

    ctx.restore();
  },
};
ChartJS.register(ValueLabelPlugin);

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

const intIN = (n) => Number(n || 0).toLocaleString("en-IN");

// Enhanced colorful palette
const palette = [
  "#ff3b30",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#14b8a6",
  "#84cc16",
  "#ec4899",
  "#10b981",
  "#f97316",
  "#8b5cf6",
  "#06b6d4",
];

// Enhanced gradient palette
const cardGradients = [
  "linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)",
  "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
  "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
  "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
  "linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%)",
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
  // Sessions
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSessionName, setSelectedSessionName] = useState("");

  // Data states
  const [reportData, setReportData] = useState([]); // session day-wise
  const [dayWiseSummary, setDayWiseSummary] = useState([]);
  const [classWiseCount, setClassWiseCount] = useState([]);
  const [casteCategories, setCasteCategories] = useState([
    "SC",
    "ST",
    "OBC",
    "General",
  ]);
  const [religionCategories, setReligionCategories] = useState([
    "Hindu",
    "Sikh",
    "Muslim",
    "Christian",
    "Other",
  ]);
  const [genderKeys, setGenderKeys] = useState(["Male", "Female"]);
  const [grandTotal, setGrandTotal] = useState(null);
  const [religionGrandTotal, setReligionGrandTotal] = useState(null);

  // ✅ NEW: recent enquiries
  const [recentEnquiries, setRecentEnquiries] = useState([]);

  // UX states
  const [loading, setLoading] = useState({
    session: false,
    report: false,
    day: false,
    class: false,
    cr: false,
  });
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const timersRef = useRef({});

  // Chart refs
  const pieRef = useRef(null);
  const lineRef = useRef(null);
  const barRef = useRef(null);
  const genderPieRef = useRef(null);
  const casteBarRef = useRef(null);
  const religionBarRef = useRef(null);

  // Legend toggle per chart
  const [showLegends, setShowLegends] = useState({
    pie: true,
    line: true,
    bar: true,
    genderPie: true,
    casteBar: true,
    religionBar: true,
  });

  // Settings
  const POLLING_INTERVAL = 15000; // 15s

  /* -------------------------- Load sessions -------------------------- */
  const fetchSessions = useCallback(async () => {
    setLoading((s) => ({ ...s, session: true }));
    try {
      const res = await api.get("/sessions");
      const list = Array.isArray(res.data) ? res.data : [];
      setSessions(list);
      const active = list.find((s) => s.is_active);
      const fallback = list[0];
      const chosen = active || fallback || null;
      if (chosen) {
        setSelectedSessionId(chosen.id);
        setSelectedSessionName(chosen.name || "");
      }
      setError("");
    } catch (e) {
      console.error("Error fetching sessions:", e);
      setError("Failed to load sessions.");
    } finally {
      setLoading((s) => ({ ...s, session: false }));
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  /* ------------------- Session-based data fetchers ------------------- */
  const fetchSessionDayWise = useCallback(async () => {
    if (!selectedSessionId) return;
    setLoading((s) => ({ ...s, report: true, day: true }));
    try {
      const params = { sessionId: selectedSessionId };
      const res = await api.get("/reports/session/day-wise", { params });
      const rows = Array.isArray(res.data) ? res.data : [];
      setReportData(rows);
      setDayWiseSummary(rows);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error fetching session day-wise:", e);
      setError("Failed to fetch session day-wise report.");
    } finally {
      setLoading((s) => ({ ...s, report: false, day: false }));
    }
  }, [selectedSessionId]);

  const fetchClassWiseCount = useCallback(async () => {
    setLoading((s) => ({ ...s, class: true }));
    try {
      const res = await api.get("/reports/class-wise-student-count", {
        params: { sessionId: selectedSessionId || undefined },
      });
      setClassWiseCount(Array.isArray(res.data) ? res.data : []);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error fetching class-wise student count:", e);
      setError("Failed to fetch class-wise student count.");
    } finally {
      setLoading((s) => ({ ...s, class: false }));
    }
  }, [selectedSessionId]);

  const fetchCasteReligion = useCallback(async () => {
    setLoading((s) => ({ ...s, cr: true }));
    try {
      const res = await api.get("/student-caste-report/caste-gender-report", {
        params: { sessionId: selectedSessionId || undefined },
      });
      const data = res?.data || {};
      if (Array.isArray(data?.categories)) setCasteCategories(data.categories);
      if (Array.isArray(data?.religions)) setReligionCategories(data.religions);
      if (Array.isArray(data?.genders)) setGenderKeys(data.genders);
      if (data?.grandTotal) setGrandTotal(data.grandTotal);
      if (data?.religionGrandTotal)
        setReligionGrandTotal(data.religionGrandTotal);
      if (data?.session?.name) setSelectedSessionName(data.session.name);
      setError("");
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Error fetching caste/religion summary:", e);
      setError("Failed to fetch caste/religion summary.");
    } finally {
      setLoading((s) => ({ ...s, cr: false }));
    }
  }, [selectedSessionId]);

  // ✅ fetch recent enquiries
  const fetchRecentEnquiries = useCallback(async () => {
    try {
      const res = await api.get("/enquiries");
      const list = Array.isArray(res.data) ? res.data.slice(0, 5) : [];
      setRecentEnquiries(list);
    } catch (e) {
      console.error("Error fetching recent enquiries:", e);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchSessionDayWise();
    fetchClassWiseCount();
    fetchCasteReligion();
    fetchRecentEnquiries();
  }, [
    fetchSessionDayWise,
    fetchClassWiseCount,
    fetchCasteReligion,
    fetchRecentEnquiries,
  ]);

  // Load data when a session is chosen
  useEffect(() => {
    if (selectedSessionId) refreshAll();
  }, [selectedSessionId, refreshAll]);

  // Auto-refresh (session-aware)
  useEffect(() => {
    Object.values(timersRef.current || {}).forEach(clearInterval);
    timersRef.current = {};

    if (!autoRefresh || !selectedSessionId) return;

    timersRef.current.report = setInterval(
      fetchSessionDayWise,
      POLLING_INTERVAL
    );
    timersRef.current.class = setInterval(
      fetchClassWiseCount,
      POLLING_INTERVAL
    );
    timersRef.current.cr = setInterval(fetchCasteReligion, POLLING_INTERVAL);
    timersRef.current.enq = setInterval(
      fetchRecentEnquiries,
      POLLING_INTERVAL * 2
    );

    return () => {
      Object.values(timersRef.current || {}).forEach(clearInterval);
    };
  }, [
    autoRefresh,
    fetchSessionDayWise,
    fetchClassWiseCount,
    fetchCasteReligion,
    fetchRecentEnquiries,
    selectedSessionId,
  ]);

  /* ----------------------- DERIVED AGGREGATIONS ---------------------- */
  const summary = useMemo(() => {
    return (reportData || []).reduce((acc, item) => {
      const category = item.feeCategoryName;
      if (!category) return acc;
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
      acc[category].totalVanFeeConcession += Number(
        item.totalVanFeeConcession || 0
      );
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

  // Enrollments (class-wise count)
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
    if (!cls) return;
    if (!classWiseEnrollments[cls])
      classWiseEnrollments[cls] = { new: 0, old: 0 };
    if (item.admissionType === "New")
      classWiseEnrollments[cls].new += Number(item.studentCount || 0);
    if (item.admissionType === "Old")
      classWiseEnrollments[cls].old += Number(item.studentCount || 0);
  });
  const classColumns = Object.keys(classWiseEnrollments).sort();
  const overallNew = classColumns.reduce(
    (s, c) => s + classWiseEnrollments[c].new,
    0
  );
  const overallOld = classColumns.reduce(
    (s, c) => s + classWiseEnrollments[c].old,
    0
  );
  const overallTotal = overallNew + overallOld;

  // Gender/Caste/Religion derived
  const genderTotals = useMemo(() => {
    const boys = Number(grandTotal?.Total?.Boys ?? 0);
    const girls = Number(grandTotal?.Total?.Girls ?? 0);
    return { boys, girls };
  }, [grandTotal]);

  const casteBoysGirls = useMemo(() => {
    const labels = casteCategories;
    const boys = labels.map((c) => Number(grandTotal?.[c]?.Boys || 0));
    const girls = labels.map((c) => Number(grandTotal?.[c]?.Girls || 0));
    return { labels, boys, girls };
  }, [casteCategories, grandTotal]);

  const religionBoysGirls = useMemo(() => {
    const labels = religionCategories;
    const boys = labels.map((r) => Number(religionGrandTotal?.[r]?.Boys || 0));
    const girls = labels.map((r) => Number(religionGrandTotal?.[r]?.Girls || 0));
    return { labels, boys, girls };
  }, [religionCategories, religionGrandTotal]);

  /* ----------------------------- CHART DATA ----------------------------- */
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
          backgroundColor: labels.map(
            (_, i) => palette[i % palette.length] + "66"
          ),
          borderColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 2,
          hoverOffset: 24,
        },
      ],
    };
  }, [summary]);

  const pieChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: showLegends.pie,
          position: "right",
          labels: {
            font: { family: "'Inter', sans-serif", size: 13 },
          },
        },
        tooltip: {
          backgroundColor: "rgba(31, 41, 55, 0.9)",
          titleFont: { family: "'Inter', sans-serif", size: 14 },
          bodyFont: { family: "'Inter', sans-serif", size: 12 },
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const value = ctx.parsed || 0;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total
                ? ((value / total) * 100).toFixed(2) + "%"
                : "0%";
              return `${label}: ${formatCurrency(value)} (${pct})`;
            },
          },
        },
      },
      cutout: "60%",
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1200,
        easing: "easeOutBack",
      },
    }),
    [showLegends.pie]
  );

  // Line
  const uniqueDates = useMemo(
    () =>
      Array.from(
        new Set((dayWiseSummary || []).map((r) => r.transactionDate))
      ).sort(),
    [dayWiseSummary]
  );
  const uniqueCategories = useMemo(
    () =>
      Array.from(
        new Set((dayWiseSummary || []).map((r) => r.feeCategoryName))
      ),
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
        backgroundColor: `${palette[idx % palette.length]}33`,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 8,
        pointBackgroundColor: "#ffffff",
        pointBorderWidth: 2,
        pointBorderColor: palette[idx % palette.length],
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
        x: {
          title: {
            display: true,
            text: "Date",
            font: { family: "'Inter', sans-serif", size: 12 },
          },
          grid: { display: false },
        },
        y: {
          title: {
            display: true,
            text: "Fee Received",
            font: { family: "'Inter', sans-serif", size: 12 },
          },
          beginAtZero: true,
          ticks: {
            callback: (val) => compactNumber(val),
            font: { family: "'Inter', sans-serif", size: 12 },
          },
          grid: { color: "rgba(0, 0, 0, 0.05)" },
        },
      },
      plugins: {
        legend: {
          display: showLegends.line,
          labels: { font: { family: "'Inter', sans-serif", size: 13 } },
        },
      },
      interaction: { intersect: false, mode: "index" },
      animation: { duration: 1200, easing: "easeOutQuart" },
    }),
    [showLegends.line]
  );

  // Bar (enrollments)
  const uniqueClasses = useMemo(
    () =>
      Array.from(new Set((classWiseCount || []).map((r) => r.className))).sort(),
    [classWiseCount]
  );
  const uniqueAdmissionTypes = useMemo(
    () =>
      Array.from(
        new Set((classWiseCount || []).map((r) => r.admissionType))
      ),
    [classWiseCount]
  );
  const barDatasets = useMemo(
    () =>
      uniqueAdmissionTypes.map((type, idx) => ({
        label: type,
        data: uniqueClasses.map((cls) => {
          const rec = classWiseCount.find(
            (r) => r.className === cls && r.admissionType === type
          );
          return rec ? Number(rec.studentCount || 0) : 0;
        }),
        backgroundColor: `${palette[idx % palette.length]}66`,
        borderColor: palette[idx % palette.length],
        borderWidth: 2,
        borderRadius: 8,
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
        x: {
          title: {
            display: true,
            text: "Class",
            font: { family: "'Inter', sans-serif", size: 12 },
          },
          grid: { display: false },
        },
        y: {
          title: {
            display: true,
            text: "Student Count",
            font: { family: "'Inter', sans-serif", size: 12 },
          },
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: { family: "'Inter', sans-serif", size: 12 },
          },
          grid: { color: "rgba(0, 0, 0, 0.05)" },
        },
      },
      plugins: {
        legend: {
          display: showLegends.bar,
          labels: { font: { family: "'Inter', sans-serif", size: 13 } },
        },
        valueLabel: {
          enabled: true,
          showZero: false,
          formatter: (value) => intIN(value),
          offsetY: -8,
        },
      },
      animation: { duration: 1200, easing: "easeOutQuart" },
    }),
    [showLegends.bar]
  );

  /* ------------------------------- UI DATA ------------------------------ */
  const kpis = [
    {
      label: "Fee Received (Session)",
      value: totalFeeReceived,
      icon: "bi-cash-coin",
    },
    { label: "Van Fee (Session)", value: totalVanFee, icon: "bi-truck" },
    {
      label: "Fine (Session)",
      value: totalFine,
      icon: "bi-exclamation-triangle",
    },
    {
      label: "Enrollments (Total)",
      value: totalEnrollments,
      icon: "bi-people",
    },
    { label: "New", value: newEnrollments, icon: "bi-person-plus" },
    { label: "Old", value: oldEnrollments, icon: "bi-person-check" },
  ];

  const totalForShare = Object.values(summary).reduce(
    (a, c) => a + (c?.totalFeeReceived || 0),
    0
  );

  const quickLinks = [
    {
      label: "Collect Fee",
      icon: "bi-cash-stack",
      href: "/transactions",
      gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    },
    {
      label: "Fee Due Report",
      icon: "bi-receipt",
      href: "/student-due",
      gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    },
    {
      label: "Pending Due",
      icon: "bi-list-check",
      href: "/reports/school-fee-summary",
      gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    },
    {
      label: "Day Summary",
      icon: "bi-calendar2-check",
      href: "/reports/day-wise",
      gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    },
    {
      label: "Transport",
      icon: "bi-truck",
      href: "/reports/van-fee",
      gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    },
    {
      label: "Students",
      icon: "bi-people",
      href: "/students",
      gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
    },
    {
      label: "Caste/Gender & Religion",
      icon: "bi-people-fill",
      href: "/reports/caste-gender",
      gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    },
  ];

  const LinkCard = ({ href, icon, label, gradient }) => (
    <a
      href={href}
      className="link-card-ex btn shadow-sm"
      title={label}
      style={{ backgroundImage: gradient }}
      aria-label={`Navigate to ${label}`}
    >
      <span className="icon-wrap">
        <i className={`bi ${icon}`} />
      </span>
      <span className="text-wrap">
        <span className="label">{label}</span>
        <span className="arrow">
          <i className="bi bi-arrow-right" />
        </span>
      </span>
    </a>
  );

  /* -------------------------------- RENDER ------------------------------- */
  return (
    <div
      className="dashboard-bg"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(34, 197, 94, 0.15), rgba(245, 158, 11, 0.15)), url(/images/SchooBackground.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
      }}
    >
      <div className="dashboard-overlay" />

      <div
        className="container-fluid px-4"
        style={{ position: "relative", zIndex: 2 }}
      >
        {/* Header */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 my-4">
          <div className="d-flex flex-column">
            <div className="d-flex align-items-center gap-3">
              <h2
                className="mb-0 fw-bold d-flex align-items-center gap-2"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Dashboard
                {autoRefresh && (
                  <span
                    className="badge bg-success-subtle text-success border d-inline-flex align-items-center gap-1"
                    title="Auto-refresh is ON"
                    aria-label="Live auto-refresh indicator"
                  >
                    <span className="pulse-dot" /> Live
                  </span>
                )}
              </h2>

              {/* Session selector */}
              <div className="d-inline-flex align-items-center gap-2">
                <label
                  htmlFor="sessionSelect"
                  className="small text-muted mb-0"
                >
                  Session:
                </label>
                <select
                  id="sessionSelect"
                  className="form-select form-select-sm"
                  style={{ minWidth: 160 }}
                  value={selectedSessionId || ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const s = sessions.find((x) => x.id === id);
                    setSelectedSessionId(id || null);
                    setSelectedSessionName(s?.name || "");
                  }}
                  disabled={loading.session}
                >
                  <option value="" disabled>
                    Choose session
                  </option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_active ? " (Active)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <small
              className="text-muted mt-1"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              {selectedSessionName
                ? `Showing session: ${selectedSessionName}`
                : "Select a session"}
              {" · "}
              {lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleString()}`
                : loading.session
                ? "Loading sessions…"
                : "Fetching…"}
            </small>
          </div>

          <div className="d-flex gap-2">
            <button
              className={`btn btn-outline-${
                autoRefresh ? "secondary" : "success"
              } shadow-sm`}
              onClick={() => setAutoRefresh((v) => !v)}
              aria-label={
                autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"
              }
            >
              {autoRefresh ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
            </button>
            <button
              className="btn btn-primary shadow-sm"
              onClick={refreshAll}
              aria-label="Refresh dashboard data"
              disabled={!selectedSessionId}
            >
              <i className="bi bi-arrow-clockwise me-1" /> Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div
            className="alert alert-danger d-flex align-items-start gap-2 shadow-sm"
            role="alert"
          >
            <i className="bi bi-exclamation-octagon-fill fs-5"></i>
            <div className="flex-grow-1">
              <div className="fw-semibold">Something went wrong</div>
              <div className="small">{error}</div>
            </div>
            <button
              className="btn btn-sm btn-light border shadow-sm"
              onClick={refreshAll}
              aria-label="Try again"
            >
              Try again
            </button>
          </div>
        ) : null}

        {/* Quick Links (sticky) */}
        <div className="quick-links sticky-top mb-4">
          <div className="quick-links-inner px-4 py-3 rounded shadow-lg bg-white bg-opacity-95">
            <div className="d-flex flex-wrap gap-3">
              {quickLinks.map((q) => (
                <LinkCard key={q.label} {...q} />
              ))}
            </div>
          </div>
        </div>

        {/* NEW: Recent Enquiries + KPI */}
        <div className="row g-4 mb-4">
          {/* Recent Enquiries */}
          <div className="col-12 col-lg-4">
            <div className="card shadow-lg h-100 hover-lift">
              <div
                className="card-header d-flex justify-content-between align-items-center text-white"
                style={{
                  background: "linear-gradient(135deg,#0ea5e9,#0369a1)",
                }}
              >
                <h5
                  className="mb-0"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  Recent Enquiries
                </h5>
                <a
                  href="/enquiries"
                  className="btn btn-sm btn-light text-primary"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  View all
                </a>
              </div>
              <div className="card-body p-0">
                {recentEnquiries.length === 0 ? (
                  <p
                    className="text-muted p-3 mb-0"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No enquiries yet.
                  </p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {recentEnquiries.map((enq) => (
                      <li
                        key={enq.id}
                        className="list-group-item d-flex justify-content-between align-items-start"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        <div>
                          <div className="fw-semibold">
                            {enq.student_name || "—"}
                          </div>
                          <div className="small text-muted">
                            Class: {enq.class_interested || "—"}
                          </div>
                          {enq.phone ? (
                            <div className="small text-muted">
                              📞 {enq.phone}
                            </div>
                          ) : null}
                        </div>
                        <div className="text-end">
                          <span className="badge text-bg-light">
                            {enq.enquiry_date
                              ? new Date(
                                  enq.enquiry_date
                                ).toLocaleDateString("en-IN")
                              : ""}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="col-12 col-lg-8">
            <div className="row g-4">
              {kpis.map((kpi, i) => (
                <div key={kpi.label} className="col-12 col-sm-6 col-xl-4">
                  <div
                    className="card text-white shadow-lg border-0 h-100 kpi-card hover-lift"
                    style={{
                      background: cardGradients[i % cardGradients.length],
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <div
                            className="small text-white-75"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                          >
                            {kpi.label}
                          </div>
                          <div
                            className="h4 mb-1"
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontWeight: 600,
                            }}
                          >
                            {formatCurrency(kpi.value)}
                          </div>
                          <span
                            className="small text-white-75"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                          >
                            {loading.report ||
                            loading.day ||
                            loading.class ||
                            loading.cr
                              ? "Updating…"
                              : "Up to date"}
                          </span>
                        </div>
                        <div className="text-end d-flex flex-column align-items-end">
                          <i className={`bi ${kpi.icon} fs-3 opacity-75`}></i>
                          <span
                            className="badge bg-dark bg-opacity-25 border mt-2"
                            style={{ fontFamily: "'Inter', sans-serif" }}
                          >
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
          </div>
        </div>

        {/* Category cards */}
        <div className="row g-4 mb-4">
          {Object.entries(summary).map(([category, totals], index) => {
            const share =
              totalForShare > 0
                ? (totals.totalFeeReceived / totalForShare) * 100
                : 0;
            return (
              <div key={category} className="col-12 col-md-6 col-xl-4">
                <div
                  className="card h-100 shadow-lg hover-lift"
                  style={{ background: "rgba(255, 255, 255, 0.95)" }}
                >
                  <div
                    className="card-header text-white d-flex justify-content-between align-items-center"
                    style={{
                      background: cardGradients[index % cardGradients.length],
                    }}
                  >
                    <strong
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 600,
                      }}
                    >
                      {category}
                    </strong>
                    {(loading.report || loading.day) && (
                      <span
                        className="spinner-border spinner-border-sm"
                        role="status"
                        aria-hidden="true"
                      ></span>
                    )}
                  </div>
                  <div className="card-body">
                    <div
                      className="row small g-3 mb-3"
                      style={{ fontFamily: "'Inter', sans-serif" }}
                    >
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
                          <strong>Fine:</strong>{" "}
                          {formatCurrency(totals.totalFine || 0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div
                        className="d-flex justify-content-between small text-muted mb-1"
                        style={{ fontFamily: "'Inter', sans-serif" }}
                      >
                        <span>Share of total</span>
                        <span>{share.toFixed(1)}%</span>
                      </div>
                      <div
                        className="progress"
                        role="progressbar"
                        aria-label={`Share of total for ${category}`}
                      >
                        <div
                          className="progress-bar"
                          style={{
                            width: `${share}%`,
                            backgroundColor: palette[index % palette.length],
                            transition: "width 0.6s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="row g-4 mb-4">
          {/* PIE (fees) */}
          <div className="col-12 col-xl-6">
            <div className="card h-100 shadow-lg hover-lift">
              <div
                className="card-header text-white d-flex align-items-center justify-content-between"
                style={{ background: cardGradients[0] }}
              >
                <h5
                  className="card-title mb-0"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                >
                  Fee Received Distribution (Session)
                </h5>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      setShowLegends((s) => ({ ...s, pie: !s.pie }))
                    }
                    title="Toggle legend"
                    aria-label="Toggle legend for fee distribution chart"
                  >
                    <i className="bi bi-list-task" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() => downloadChart(pieRef, "fee-distribution.png")}
                    title="Download PNG"
                    aria-label="Download fee distribution chart as PNG"
                  >
                    <i className="bi bi-download" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={fetchSessionDayWise}
                    title="Refresh"
                    aria-label="Refresh fee distribution chart"
                    disabled={!selectedSessionId}
                  >
                    <i className="bi bi-arrow-clockwise" />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ height: 360 }}>
                {loading.report ? (
                  <div className="skeleton-chart" />
                ) : pieData.labels.length ? (
                  <Doughnut
                    ref={pieRef}
                    data={pieData}
                    options={pieChartOptions}
                  />
                ) : (
                  <div
                    className="text-center text-muted"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* LINE (fees trend) */}
          <div className="col-12 col-xl-6">
            <div className="card h-100 shadow-lg hover-lift">
              <div
                className="card-header text-white d-flex align-items-center justify-content-between"
                style={{ background: cardGradients[1] }}
              >
                <h5
                  className="card-title mb-0"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                >
                  Fee Trend by Category (Session)
                </h5>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      setShowLegends((s) => ({ ...s, line: !s.line }))
                    }
                    title="Toggle legend"
                    aria-label="Toggle legend for fee trend chart"
                  >
                    <i className="bi bi-list-task" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() => downloadChart(lineRef, "fee-trend.png")}
                    title="Download PNG"
                    aria-label="Download fee trend chart as PNG"
                  >
                    <i className="bi bi-download" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={fetchSessionDayWise}
                    title="Refresh"
                    aria-label="Refresh fee trend chart"
                    disabled={!selectedSessionId}
                  >
                    <i className="bi bi-arrow-clockwise" />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ height: 400 }}>
                {loading.day ? (
                  <div className="skeleton-chart" />
                ) : uniqueDates.length ? (
                  <Line
                    ref={lineRef}
                    data={lineChartData}
                    options={lineChartOptions}
                  />
                ) : (
                  <div
                    className="text-center text-muted"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Gender/Caste/Religion row */}
        <div className="row g-4 mb-4">
          {/* Gender Pie */}
          <div className="col-12 col-xl-4">
            <div className="card h-100 shadow-lg hover-lift">
              <div
                className="card-header text-white d-flex align-items-center justify-content-between"
                style={{ background: cardGradients[2] }}
              >
                <h5
                  className="card-title mb-0"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                >
                  Students by Gender
                </h5>
                <div className="d-flex gap-2">
                  <a
                    href="/reports/caste-gender"
                    className="btn btn-sm btn-light shadow-sm"
                    title="Open Caste/Gender Report"
                    aria-label="Open Caste/Gender Report"
                  >
                    <i className="bi bi-box-arrow-up-right" />
                  </a>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      setShowLegends((s) => ({ ...s, genderPie: !s.genderPie }))
                    }
                    title="Toggle legend"
                    aria-label="Toggle legend for gender chart"
                  >
                    <i className="bi bi-list-task" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      downloadChart(genderPieRef, "students-by-gender.png")
                    }
                    title="Download PNG"
                    aria-label="Download gender chart as PNG"
                  >
                    <i className="bi bi-download" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={fetchCasteReligion}
                    title="Refresh"
                    aria-label="Refresh gender chart"
                  >
                    <i className="bi bi-arrow-clockwise" />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ height: 340 }}>
                {loading.cr ? (
                  <div className="skeleton-chart" />
                ) : genderTotals.boys + genderTotals.girls > 0 ? (
                  <Doughnut
                    ref={genderPieRef}
                    data={genderPieDataFactory(genderTotals, palette)}
                    options={genderPieOptionsFactory(showLegends)}
                  />
                ) : (
                  <div
                    className="text-center text-muted"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Caste Bar */}
          <div className="col-12 col-xl-4">
            <div className="card h-100 shadow-lg hover-lift">
              <div
                className="card-header text-white d-flex align-items-center justify-content-between"
                style={{ background: cardGradients[3] }}
              >
                <h5
                  className="card-title mb-0"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                >
                  Caste Distribution
                </h5>
                <div className="d-flex gap-2">
                  <a
                    href="/reports/caste-gender"
                    className="btn btn-sm btn-light shadow-sm"
                    title="Open Caste/Gender Report"
                    aria-label="Open Caste/Gender Report"
                  >
                    <i className="bi bi-box-arrow-up-right" />
                  </a>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      setShowLegends((s) => ({ ...s, casteBar: !s.casteBar }))
                    }
                    title="Toggle legend"
                    aria-label="Toggle legend for caste chart"
                  >
                    <i className="bi bi-list-task" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      downloadChart(casteBarRef, "caste-distribution.png")
                    }
                    title="Download PNG"
                    aria-label="Download caste chart as PNG"
                  >
                    <i className="bi bi-download" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={fetchCasteReligion}
                    title="Refresh"
                    aria-label="Refresh caste chart"
                  >
                    <i className="bi bi-arrow-clockwise" />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ height: 340 }}>
                {loading.cr ? (
                  <div className="skeleton-chart" />
                ) : casteBoysGirls.labels.length ? (
                  <Bar
                    ref={casteBarRef}
                    data={casteBarDataFactory(casteBoysGirls, palette)}
                    options={casteBarOptionsFactory(showLegends)}
                  />
                ) : (
                  <div
                    className="text-center text-muted"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Religion Bar */}
          <div className="col-12 col-xl-4">
            <div className="card h-100 shadow-lg hover-lift">
              <div
                className="card-header text-white d-flex align-items-center justify-content-between"
                style={{ background: cardGradients[4] }}
              >
                <h5
                  className="card-title mb-0"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                >
                  Religion Distribution
                </h5>
                <div className="d-flex gap-2">
                  <a
                    href="/reports/caste-gender"
                    className="btn btn-sm btn-light shadow-sm"
                    title="Open Caste/Gender Report"
                    aria-label="Open Caste/Gender Report"
                  >
                    <i className="bi bi-box-arrow-up-right" />
                  </a>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      setShowLegends((s) => ({
                        ...s,
                        religionBar: !s.religionBar,
                      }))
                    }
                    title="Toggle legend"
                    aria-label="Toggle legend for religion chart"
                  >
                    <i className="bi bi-list-task" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      downloadChart(
                        religionBarRef,
                        "religion-distribution.png"
                      )
                    }
                    title="Download PNG"
                    aria-label="Download religion chart as PNG"
                  >
                    <i className="bi bi-download" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={fetchCasteReligion}
                    title="Refresh"
                    aria-label="Refresh religion chart"
                  >
                    <i className="bi bi-arrow-clockwise" />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ height: 340 }}>
                {loading.cr ? (
                  <div className="skeleton-chart" />
                ) : religionBoysGirls.labels.length ? (
                  <Bar
                    ref={religionBarRef}
                    data={religionBarDataFactory(religionBoysGirls, palette)}
                    options={religionBarOptionsFactory(showLegends)}
                  />
                ) : (
                  <div
                    className="text-center text-muted"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enrollment table */}
        <div className="row g-4 mb-4">
          <div className="col-12">
            <div className="card shadow-lg hover-lift">
              <div
                className="card-header text-white d-flex align-items-center justify-content-between"
                style={{ background: cardGradients[5] }}
              >
                <h5
                  className="mb-0"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                >
                  Enrollments
                </h5>
                {loading.class && (
                  <div
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></div>
                )}
              </div>
              <div className="card-body" style={{ overflowX: "auto" }}>
                {classColumns.length === 0 ? (
                  <div
                    className="text-center text-muted py-3"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No enrollment data
                  </div>
                ) : (
                  <table className="table table-sm align-middle mb-0">
                    <thead
                      className="table-light"
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        background:
                          "linear-gradient(135deg, #f8fafc, #e2e8f0)",
                      }}
                    >
                      <tr>
                        {classColumns.map((cls, i) => (
                          <th
                            key={cls}
                            className="text-nowrap"
                            style={{
                              textAlign: "left",
                              borderRight:
                                i !== classColumns.length - 1
                                  ? "1px solid #dee2e6"
                                  : "none",
                              fontFamily: "'Inter', sans-serif",
                            }}
                          >
                            {cls}
                          </th>
                        ))}
                        <th
                          className="text-nowrap"
                          style={{
                            textAlign: "left",
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
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
                                i !== classColumns.length - 1
                                  ? "1px solid #dee2e6"
                                  : "none",
                            }}
                          >
                            <span className="badge text-bg-success">
                              {`N ${classWiseEnrollments[cls].new}`}
                            </span>
                          </td>
                        ))}
                        <td style={{ textAlign: "left" }}>
                          <span className="badge text-bg-success">
                            {`N ${overallNew}`}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        {classColumns.map((cls, i) => (
                          <td
                            key={`old-${cls}`}
                            style={{
                              textAlign: "left",
                              borderRight:
                                i !== classColumns.length - 1
                                  ? "1px solid #dee2e6"
                                  : "none",
                            }}
                          >
                            <span className="badge text-bg-secondary">
                              {`O ${classWiseEnrollments[cls].old}`}
                            </span>
                          </td>
                        ))}
                        <td style={{ textAlign: "left" }}>
                          <span className="badge text-bg-secondary">
                            {`O ${overallOld}`}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        {classColumns.map((cls, i) => {
                          const t =
                            classWiseEnrollments[cls].new +
                            classWiseEnrollments[cls].old;
                          return (
                            <td
                              key={`tot-${cls}`}
                              style={{
                                textAlign: "left",
                                borderRight:
                                  i !== classColumns.length - 1
                                    ? "1px solid #dee2e6"
                                    : "none",
                              }}
                            >
                              <strong
                                style={{
                                  fontFamily: "'Inter', sans-serif",
                                  color: "#3b82f6",
                                }}
                              >{`T ${t}`}</strong>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "left" }}>
                          <strong
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              color: "#3b82f6",
                            }}
                          >{`T ${overallTotal}`}</strong>
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
        <div className="row g-4 mb-5">
          <div className="col-12">
            <div className="card shadow-lg hover-lift">
              <div
                className="card-header text-white d-flex align-items-center justify-content-between"
                style={{ background: cardGradients[6] }}
              >
                <h5
                  className="card-title mb-0"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
                >
                  Student Count by Class
                </h5>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() =>
                      setShowLegends((s) => ({ ...s, bar: !s.bar }))
                    }
                    title="Toggle legend"
                    aria-label="Toggle legend for student count chart"
                  >
                    <i className="bi bi-list-task" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={() => downloadChart(barRef, "student-count.png")}
                    title="Download PNG"
                    aria-label="Download student count chart as PNG"
                  >
                    <i className="bi bi-download" />
                  </button>
                  <button
                    className="btn btn-sm btn-light shadow-sm"
                    onClick={fetchClassWiseCount}
                    title="Refresh"
                    aria-label="Refresh student count chart"
                  >
                    <i className="bi bi-arrow-clockwise" />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ height: 400 }}>
                {loading.class ? (
                  <div className="skeleton-chart" />
                ) : uniqueClasses.length ? (
                  <Bar
                    ref={barRef}
                    data={barChartData}
                    options={barChartOptions}
                  />
                ) : (
                  <div
                    className="text-center text-muted"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    No data
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Styles */}
        <style>{`
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .dashboard-bg { position: relative; background-attachment: fixed; }
          .dashboard-overlay {
            position: absolute; inset: 0;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.6));
            z-index: 1; pointer-events: none;
          }
          .quick-links { top: 5rem; z-index: 3; }
          .quick-links-inner {
            backdrop-filter: blur(12px) saturate(1.2);
            border-radius: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          }
          .link-card-ex {
            display: inline-flex; align-items: center; gap: 1rem;
            padding: 1rem 1.2rem; border-radius: 1.2rem; color: #fff; text-decoration: none;
            border: 1px solid rgba(255, 255, 255, 0.2);
            position: relative; overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease, background-position 0.3s ease;
            background-size: 200% 100%; background-position: 0% 50%;
          }
          .link-card-ex:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); background-position: 100% 50%; }
          .link-card-ex:active { transform: translateY(0); }
          .link-card-ex .icon-wrap {
            display: inline-grid; place-items: center; width: 2.8rem; height: 2.8rem; border-radius: 50%;
            background: rgba(255,255,255,0.2); box-shadow: inset 0 0 0 2px rgba(255,255,255,0.3);
            transition: transform 0.3s ease;
          }
          .link-card-ex:hover .icon-wrap { transform: scale(1.1); }
          .link-card-ex .label { font-size: 1rem; font-weight: 600; letter-spacing: .3px; }
          .card { border-radius: 1.2rem; background-clip: padding-box; border: 1px solid rgba(255,255,255,0.2); transition: transform .3s ease, box-shadow .3s ease; }
          .card:not([style*="linear-gradient"]) { background-color: rgba(255,255,255,0.95) !important; backdrop-filter: blur(8px); }
          .card-header { border-top-left-radius: 1.2rem !important; border-top-right-radius: 1.2rem !important; padding: 1rem 1.5rem; }
          .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,.15); }
          .kpi-card { position: relative; overflow: hidden; backdrop-filter: blur(10px) saturate(1.3); border-radius: 1.2rem; }
          .kpi-shimmer { position: absolute; inset: 0; background: linear-gradient(110deg,#fff1,#fff3,#fff1); background-size: 200% 100%; animation: shimmer 1.5s infinite linear; pointer-events:none;}
          @keyframes shimmer { to { background-position-x: -200%; } }
          .skeleton-chart { height: 100%; width: 100%; border-radius: 1rem;
            background: linear-gradient(110deg, #f3f4f6 8%, #e5e7eb 18%, #f3f4f6 33%);
            background-size: 200% 100%; animation: shimmer 1.5s infinite linear; }
          .pulse-dot { width: .6rem; height: .6rem; border-radius: 50%; background: #22c55e; display: inline-block; position: relative; }
          .pulse-dot::after { content: ""; position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 0 rgba(34,197,94,0.7); animation: pulse 1.8s infinite; }
          @keyframes pulse { 70% { box-shadow: 0 0 0 .5rem rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
          button.btn, a.btn { border-radius: .75rem; transition: transform .2s ease, box-shadow .2s ease; }
          button.btn:hover, a.btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
          button:focus-visible, a:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
          .table { border-radius: .75rem; overflow: hidden; }
          .table th, .table td { padding: .75rem; font-family: 'Inter', sans-serif; }
          .badge { border-radius: .5rem; padding: .5em .75em; font-weight: 600; }
          @media (max-width: 768px) {
            .quick-links { top: 4rem; }
            .quick-links-inner { padding: 1rem; }
            .link-card-ex { padding: .8rem 1rem; gap: .8rem; }
            .link-card-ex .icon-wrap { width: 2.4rem; height: 2.4rem; }
            .link-card-ex .label { font-size: .9rem; }
            .card-body { padding: 1rem; }
            .row.g-4 { gap: 1rem; }
          }
          [role="alert"] { border-radius: .75rem; box-shadow: 0 4px 12px rgba(0,0,0,.1); }
          .card { animation: fadeInUp 0.6s ease-out; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {/* Bootstrap Icons */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css"
        />
        {/* Inter Font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </div>
    </div>
  );
};

/* -------------- Pure helpers (no `this`) -------------- */
function genderPieDataFactory(genderTotals, palette) {
  const labels = ["Boys", "Girls"];
  const data = [genderTotals.boys, genderTotals.girls];
  return {
    labels,
    datasets: [
      {
        label: "Students",
        data,
        backgroundColor: labels.map(
          (_, i) => palette[i % palette.length] + "66"
        ),
        borderColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        hoverOffset: 24,
      },
    ],
  };
}
function genderPieOptionsFactory(showLegends) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegends.genderPie,
        position: "right",
        labels: { font: { family: "'Inter', sans-serif", size: 13 } },
      },
      valueLabel: {
        enabled: true,
        showZero: false,
        formatter: (value, { chart, datasetIndex }) => {
          const ds = chart.data.datasets[datasetIndex];
          const total = ds.data.reduce((a, b) => a + Number(b || 0), 0);
          const pct = total ? Math.round((value / total) * 100) : 0;
          return `${intIN(value)} (${pct}%)`;
        },
      },
      tooltip: {
        backgroundColor: "rgba(31, 41, 55, 0.9)",
        titleFont: { family: "'Inter', sans-serif", size: 14 },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
      },
    },
    cutout: "60%",
    animation: {
      animateScale: true,
      animateRotate: true,
      duration: 1200,
      easing: "easeOutBack",
    },
  };
}

function casteBarDataFactory(casteBoysGirls, palette) {
  return {
    labels: casteBoysGirls.labels,
    datasets: [
      {
        label: "Boys",
        data: casteBoysGirls.boys,
        backgroundColor: `${palette[1 % palette.length]}66`,
        borderColor: palette[1 % palette.length],
        borderWidth: 2,
        borderRadius: 8,
      },
      {
        label: "Girls",
        data: casteBoysGirls.girls,
        backgroundColor: `${palette[2 % palette.length]}66`,
        borderColor: palette[2 % palette.length],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
}
function casteBarOptionsFactory(showLegends) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: "Caste",
          font: { family: "'Inter', sans-serif", size: 12 },
        },
        grid: { display: false },
      },
      y: {
        title: {
          display: true,
          text: "Students",
          font: { family: "'Inter', sans-serif", size: 12 },
        },
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: { family: "'Inter', sans-serif", size: 12 },
        },
        grid: { color: "rgba(0, 0, 0, 0.05)" },
      },
    },
    plugins: {
      legend: {
        display: showLegends.casteBar,
        labels: { font: { family: "'Inter', sans-serif", size: 13 } },
      },
      valueLabel: {
        enabled: true,
        showZero: false,
        formatter: (value) => intIN(value),
        offsetY: -8,
      },
      tooltip: {
        backgroundColor: "rgba(31, 41, 55, 0.9)",
        titleFont: { family: "'Inter', sans-serif", size: 14 },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
      },
    },
    animation: { duration: 1200, easing: "easeOutQuart" },
  };
}

function religionBarDataFactory(religionBoysGirls, palette) {
  return {
    labels: religionBoysGirls.labels,
    datasets: [
      {
        label: "Boys",
        data: religionBoysGirls.boys,
        backgroundColor: `${palette[3 % palette.length]}66`,
        borderColor: palette[3 % palette.length],
        borderWidth: 2,
        borderRadius: 8,
      },
      {
        label: "Girls",
        data: religionBoysGirls.girls,
        backgroundColor: `${palette[4 % palette.length]}66`,
        borderColor: palette[4 % palette.length],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };
}
function religionBarOptionsFactory(showLegends) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: "Religion",
          font: { family: "'Inter', sans-serif", size: 12 },
        },
        grid: { display: false },
      },
      y: {
        title: {
          display: true,
          text: "Students",
          font: { family: "'Inter', sans-serif", size: 12 },
        },
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: { family: "'Inter', sans-serif", size: 12 },
        },
        grid: { color: "rgba(0, 0, 0, 0.05)" },
      },
    },
    plugins: {
      legend: {
        display: showLegends.religionBar,
        labels: { font: { family: "'Inter', sans-serif", size: 13 } },
      },
      valueLabel: {
        enabled: true,
        showZero: false,
        formatter: (value) => intIN(value),
        offsetY: -8,
      },
      tooltip: {
        backgroundColor: "rgba(31, 41, 55, 0.9)",
        titleFont: { family: "'Inter', sans-serif", size: 14 },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
      },
    },
    animation: { duration: 1200, easing: "easeOutQuart" },
  };
}

export default Dashboard;
