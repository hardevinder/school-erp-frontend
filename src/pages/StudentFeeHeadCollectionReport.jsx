// File: src/components/StudentFeeHeadCollectionReport.jsx

import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "bootstrap/dist/css/bootstrap.min.css";

/* ---------------- Helpers ---------------- */

const formatINR = (amount) => {
  if (amount === "" || amount === null || amount === undefined) return "-";
  const n = Number(amount || 0);
  if (n === 0) return "-";

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

const safeText = (value) => String(value ?? "").trim();

const getFilenameFromHeader = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback;

  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] || fallback;
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(url);
};

const buildQueryParams = ({
  selectedSession,
  selectedClass,
  selectedSection,
  fromDate,
  toDate,
}) => {
  const params = {};

  if (selectedSession) params.session_id = selectedSession;
  if (selectedClass) params.class_id = selectedClass;
  if (selectedSection) params.section_id = selectedSection;
  if (fromDate) params.from_date = fromDate;
  if (toDate) params.to_date = toDate;

  return params;
};

/* ---------------- Component ---------------- */

const StudentFeeHeadCollectionReport = () => {
  const [school, setSchool] = useState(null);

  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const [selectedSession, setSelectedSession] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [search, setSearch] = useState("");

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  /* ---------------- Initial Load ---------------- */

  useEffect(() => {
    let alive = true;

    const loadInitial = async () => {
      try {
        const [schoolRes, sessionsRes, classesRes, sectionsRes] =
          await Promise.allSettled([
            api.get("/schools"),
            api.get("/sessions"),
            api.get("/classes"),
            api.get("/sections"),
          ]);

        if (!alive) return;

        if (schoolRes.status === "fulfilled") {
          const payload = Array.isArray(schoolRes.value.data)
            ? schoolRes.value.data
            : schoolRes.value.data?.data || [];

          setSchool(payload[0] || null);
        }

        if (sessionsRes.status === "fulfilled") {
          const list = Array.isArray(sessionsRes.value.data)
            ? sessionsRes.value.data
            : sessionsRes.value.data?.data || [];

          setSessions(list);

          const active =
            list.find((s) => s.is_active === true) ||
            list.find((s) => s.is_active === 1) ||
            list[0];

          if (active?.id) {
            setSelectedSession(String(active.id));
          }
        }

        if (classesRes.status === "fulfilled") {
          const list = Array.isArray(classesRes.value.data)
            ? classesRes.value.data
            : classesRes.value.data?.data || [];

          setClasses(list);
        }

        if (sectionsRes.status === "fulfilled") {
          const list = Array.isArray(sectionsRes.value.data)
            ? sectionsRes.value.data
            : sectionsRes.value.data?.data || [];

          setSections(list);
        }
      } catch (error) {
        console.error("Initial load error:", error);
      }
    };

    loadInitial();

    return () => {
      alive = false;
    };
  }, []);

  /* ---------------- Fetch Report ---------------- */

  const fetchReport = async () => {
    if (!selectedSession) {
      setErrorMsg("Please select academic session.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const params = buildQueryParams({
        selectedSession,
        selectedClass,
        selectedSection,
        fromDate,
        toDate,
      });

      const res = await api.get("/student-fee-head-collection", {
        params,
      });

      const payload = res.data?.success ? res.data : res.data;

      setReport(payload);
    } catch (error) {
      console.error("Report fetch error:", error);

      setReport(null);
      setErrorMsg(
        error?.response?.data?.message ||
          "Could not fetch report. Please check backend route and token."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedSession) return;
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession, selectedClass, selectedSection, fromDate, toDate]);

  /* ---------------- Derived Data ---------------- */

  const feeHeads = report?.feeHeads || [];
  const rows = report?.rows || [];
  const showVanColumns = Boolean(report?.showVanColumns);
  const showFine = report?.showFine !== false;
  const reportTotals = report?.reportTotals || {};

  const selectedClassName = useMemo(() => {
    if (!selectedClass) return "All Classes";
    return (
      classes.find((cls) => Number(cls.id) === Number(selectedClass))
        ?.class_name || selectedClass
    );
  }, [classes, selectedClass]);

  const selectedSessionName = useMemo(() => {
    return (
      sessions.find((s) => Number(s.id) === Number(selectedSession))?.name ||
      sessions.find((s) => Number(s.id) === Number(selectedSession))?.label ||
      selectedSession ||
      ""
    );
  }, [sessions, selectedSession]);

  const visibleSections = useMemo(() => {
    if (!selectedClass) return sections;

    return sections.filter((sec) => {
      const secClassId =
        sec.class_id ?? sec.classId ?? sec.Class_ID ?? sec.class?.id;
      if (!secClassId) return true;
      return Number(secClassId) === Number(selectedClass);
    });
  }, [sections, selectedClass]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      return [
        row.studentName,
        row.admissionNumber,
        row.className,
        row.sectionName,
      ]
        .map((v) => safeText(v).toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [rows, search]);

  const totalColumns = useMemo(() => {
    let count = 5;

    count += feeHeads.length * (showFine ? 3 : 2);

    if (showVanColumns) {
      count += showFine ? 3 : 2;
    }

    count += 3;

    return count;
  }, [feeHeads, showFine, showVanColumns]);

  const hasData = rows.length > 0;

  /* ---------------- Downloads ---------------- */

  const handleDownload = async (type) => {
    if (!selectedSession) {
      alert("Please select session first.");
      return;
    }

    const endpoint =
      type === "excel"
        ? "/student-fee-head-collection/excel"
        : "/student-fee-head-collection/pdf";

    const fallback =
      type === "excel"
        ? "student_fee_head_collection.xlsx"
        : "student_fee_head_collection.pdf";

    setDownloading(type);

    try {
      const params = buildQueryParams({
        selectedSession,
        selectedClass,
        selectedSection,
        fromDate,
        toDate,
      });

      const res = await api.get(endpoint, {
        params,
        responseType: "blob",
      });

      const filename = getFilenameFromHeader(
        res.headers?.["content-disposition"],
        fallback
      );

      downloadBlob(res.data, filename);
    } catch (error) {
      console.error(`${type} download error:`, error);
      alert(
        error?.response?.data?.message ||
          `Could not download ${type.toUpperCase()} report.`
      );
    } finally {
      setDownloading("");
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="sfhc-page">
      <style>{styles}</style>

      <div className="sfhc-shell">
        {/* Header */}
        <div className="sfhc-hero">
          <div>
            <div className="sfhc-kicker">Accounts Report</div>
            <h2 className="sfhc-title">Student Fee Head Collection</h2>
            <p className="sfhc-subtitle">
              Fee head wise paid amount, concession, fine and van fee summary.
            </p>

            {school?.name ? (
              <div className="sfhc-school">{school.name}</div>
            ) : null}
          </div>

          <div className="sfhc-status-card">
            <span className={`sfhc-dot ${loading ? "loading" : "ready"}`} />
            <div>
              <div className="sfhc-status-title">
                {loading ? "Loading Report" : hasData ? "Report Ready" : "No Data"}
              </div>
              <div className="sfhc-status-sub">
                {selectedSessionName || "Select session"}
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="sfhc-card sfhc-filter-card">
          <div className="row g-3 align-items-end">
            <div className="col-lg-2 col-md-4">
              <label className="sfhc-label">Session</label>
              <select
                className="form-select sfhc-input"
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
              >
                <option value="">Select Session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name || session.label || session.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-2 col-md-4">
              <label className="sfhc-label">Class</label>
              <select
                className="form-select sfhc-input"
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSection("");
                }}
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.class_name || cls.className || cls.name || cls.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-2 col-md-4">
              <label className="sfhc-label">Section</label>
              <select
                className="form-select sfhc-input"
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
              >
                <option value="">All Sections</option>
                {visibleSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.section_name ||
                      section.sectionName ||
                      section.name ||
                      section.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-2 col-md-4">
              <label className="sfhc-label">From Date</label>
              <input
                type="date"
                className="form-control sfhc-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="col-lg-2 col-md-4">
              <label className="sfhc-label">To Date</label>
              <input
                type="date"
                className="form-control sfhc-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="col-lg-2 col-md-4">
              <button
                className="btn sfhc-primary-btn w-100"
                onClick={fetchReport}
                disabled={loading || !selectedSession}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="sfhc-summary-grid">
          <div className="sfhc-metric-card">
            <span>Total Students</span>
            <strong>{rows.length}</strong>
          </div>

          <div className="sfhc-metric-card">
            <span>Total Received</span>
            <strong>{formatINR(reportTotals.totalReceived)}</strong>
          </div>

          <div className="sfhc-metric-card">
            <span>Total Concession</span>
            <strong>{formatINR(reportTotals.totalConcession)}</strong>
          </div>

          <div className="sfhc-metric-card highlight">
            <span>Grand Total</span>
            <strong>{formatINR(reportTotals.grandTotal)}</strong>
          </div>
        </div>

        {/* Search + Actions */}
        <div className="sfhc-card sfhc-action-card">
          <div className="row g-3 align-items-center">
            <div className="col-lg-6">
              <label className="sfhc-label">Search Student</label>
              <input
                type="text"
                className="form-control sfhc-input"
                placeholder="Search by name, admission no, class or section..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="col-lg-3">
              <div className="sfhc-small-info">
                <span>Class</span>
                <strong>{selectedClassName}</strong>
              </div>
            </div>

            <div className="col-lg-3">
              <div className="d-flex gap-2 justify-content-lg-end">
                <button
                  className="btn sfhc-excel-btn"
                  disabled={!hasData || downloading === "excel"}
                  onClick={() => handleDownload("excel")}
                >
                  {downloading === "excel" ? "Downloading..." : "Excel"}
                </button>

                <button
                  className="btn sfhc-pdf-btn"
                  disabled={!hasData || downloading === "pdf"}
                  onClick={() => handleDownload("pdf")}
                >
                  {downloading === "pdf" ? "Downloading..." : "PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {errorMsg ? <div className="alert alert-danger">{errorMsg}</div> : null}

        {/* Loading */}
        {loading ? (
          <div className="sfhc-card sfhc-loader">
            <div className="spinner-border spinner-border-sm me-2" />
            Fetching student fee head collection report...
          </div>
        ) : null}

        {/* Table */}
        {!loading && hasData ? (
          <div className="sfhc-card sfhc-table-card">
            <div className="sfhc-table-meta">
              <div>
                Showing <strong>{filteredRows.length}</strong> of{" "}
                <strong>{rows.length}</strong> students
              </div>
              <div>
                Fee Heads: <strong>{feeHeads.length}</strong>
              </div>
            </div>

            <div className="sfhc-table-wrap">
              <table className="table table-bordered sfhc-table">
                <thead>
                  <tr>
                    <th rowSpan="2" className="sticky-base sticky-c1">
                      Sr
                    </th>
                    <th rowSpan="2" className="sticky-base sticky-c2">
                      Class
                    </th>
                    <th rowSpan="2" className="sticky-base">
                      Section
                    </th>
                    <th rowSpan="2" className="sticky-base">
                      Admission No.
                    </th>
                    <th rowSpan="2" className="sticky-base sticky-name">
                      Student Name
                    </th>

                    {feeHeads.map((head) => (
                      <th
                        key={head.id}
                        colSpan={showFine ? 3 : 2}
                        className="group-head"
                      >
                        {head.name}
                      </th>
                    ))}

                    {showVanColumns ? (
                      <th
                        colSpan={showFine ? 3 : 2}
                        className="group-head van-head"
                      >
                        Van Fee
                      </th>
                    ) : null}

                    <th rowSpan="2" className="total-head">
                      Total Received
                    </th>
                    <th rowSpan="2" className="total-head">
                      Total Concession
                    </th>
                    <th rowSpan="2" className="total-head">
                      Grand Total
                    </th>
                  </tr>

                  <tr>
                    {feeHeads.map((head) => (
                      <React.Fragment key={`sub-${head.id}`}>
                        <th className="sub-head">Paid</th>
                        <th className="sub-head">Concession</th>
                        {showFine ? <th className="sub-head">Fine</th> : null}
                      </React.Fragment>
                    ))}

                    {showVanColumns ? (
                      <>
                        <th className="sub-head van-sub">Received</th>
                        <th className="sub-head van-sub">Concession</th>
                        {showFine ? (
                          <th className="sub-head van-sub">Fine</th>
                        ) : null}
                      </>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map((row, index) => (
                    <tr key={row.key || row.studentId || index}>
                      <td className="sticky-body sticky-c1 text-center">
                        {index + 1}
                      </td>
                      <td className="sticky-body sticky-c2">
                        {row.className || "-"}
                      </td>
                      <td>{row.sectionName || "-"}</td>
                      <td className="fw-semibold">
                        {row.admissionNumber || "-"}
                      </td>
                      <td className="sticky-body sticky-name fw-semibold">
                        {row.studentName || "-"}
                      </td>

                      {feeHeads.map((head) => {
                        const value = row.feeHeads?.[head.id] || {};

                        return (
                          <React.Fragment key={`${row.key}-${head.id}`}>
                            <td className="amount-cell">
                              {formatINR(value.paid)}
                            </td>
                            <td className="amount-cell concession-cell">
                              {formatINR(value.concession)}
                            </td>
                            {showFine ? (
                              <td className="amount-cell fine-cell">
                                {formatINR(value.fine)}
                              </td>
                            ) : null}
                          </React.Fragment>
                        );
                      })}

                      {showVanColumns ? (
                        <>
                          <td className="amount-cell van-cell">
                            {formatINR(row.van?.received)}
                          </td>
                          <td className="amount-cell concession-cell">
                            {formatINR(row.van?.concession)}
                          </td>
                          {showFine ? (
                            <td className="amount-cell fine-cell">
                              {formatINR(row.van?.fine)}
                            </td>
                          ) : null}
                        </>
                      ) : null}

                      <td className="amount-cell total-cell">
                        {formatINR(row.totals?.totalReceived)}
                      </td>
                      <td className="amount-cell concession-cell total-cell">
                        {formatINR(row.totals?.totalConcession)}
                      </td>
                      <td className="amount-cell grand-cell">
                        {formatINR(row.totals?.grandTotal)}
                      </td>
                    </tr>
                  ))}

                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={totalColumns} className="text-center py-4">
                        No student matches your search.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Empty */}
        {!loading && !hasData ? (
          <div className="sfhc-empty">
            <div className="sfhc-empty-icon">₹</div>
            <h5>No report data found</h5>
            <p>
              Select session and filters to view student fee head wise
              collection.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const styles = `
.sfhc-page {
  background: #f5f7fb;
  min-height: 100vh;
  padding: 24px;
}

.sfhc-shell {
  max-width: 100%;
  margin: 0 auto;
}

.sfhc-hero {
  background: linear-gradient(135deg, #101828 0%, #1d2939 55%, #344054 100%);
  color: #fff;
  border-radius: 22px;
  padding: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  box-shadow: 0 18px 45px rgba(16, 24, 40, 0.18);
  margin-bottom: 18px;
}

.sfhc-kicker {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d0d5dd;
  font-weight: 700;
}

.sfhc-title {
  font-size: 30px;
  line-height: 1.2;
  font-weight: 800;
  margin: 6px 0 4px;
}

.sfhc-subtitle {
  margin: 0;
  color: #e4e7ec;
}

.sfhc-school {
  margin-top: 10px;
  display: inline-flex;
  background: rgba(255, 255, 255, 0.1);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 13px;
}

.sfhc-status-card {
  min-width: 210px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  padding: 14px 16px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(8px);
}

.sfhc-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  display: inline-block;
}

.sfhc-dot.ready {
  background: #12b76a;
  box-shadow: 0 0 0 6px rgba(18, 183, 106, 0.15);
}

.sfhc-dot.loading {
  background: #fdb022;
  box-shadow: 0 0 0 6px rgba(253, 176, 34, 0.16);
}

.sfhc-status-title {
  font-weight: 800;
  font-size: 14px;
}

.sfhc-status-sub {
  color: #d0d5dd;
  font-size: 12px;
}

.sfhc-card {
  background: #fff;
  border: 1px solid #eaecf0;
  border-radius: 18px;
  box-shadow: 0 10px 30px rgba(16, 24, 40, 0.06);
}

.sfhc-filter-card,
.sfhc-action-card {
  padding: 18px;
  margin-bottom: 16px;
}

.sfhc-label {
  color: #344054;
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 7px;
}

.sfhc-input {
  border-radius: 12px;
  min-height: 42px;
  border-color: #d0d5dd;
}

.sfhc-input:focus {
  border-color: #667085;
  box-shadow: 0 0 0 0.18rem rgba(102, 112, 133, 0.16);
}

.sfhc-primary-btn {
  min-height: 42px;
  border-radius: 12px;
  background: #101828;
  color: #fff;
  font-weight: 800;
}

.sfhc-primary-btn:hover {
  background: #344054;
  color: #fff;
}

.sfhc-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(170px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}

.sfhc-metric-card {
  background: #fff;
  border: 1px solid #eaecf0;
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 10px 30px rgba(16, 24, 40, 0.05);
}

.sfhc-metric-card span {
  color: #667085;
  font-size: 13px;
  font-weight: 700;
}

.sfhc-metric-card strong {
  display: block;
  margin-top: 8px;
  font-size: 23px;
  color: #101828;
  line-height: 1.1;
}

.sfhc-metric-card.highlight {
  background: #101828;
  border-color: #101828;
}

.sfhc-metric-card.highlight span,
.sfhc-metric-card.highlight strong {
  color: #fff;
}

.sfhc-small-info {
  background: #f9fafb;
  border: 1px solid #eaecf0;
  border-radius: 14px;
  padding: 10px 12px;
}

.sfhc-small-info span {
  display: block;
  color: #667085;
  font-size: 12px;
  font-weight: 700;
}

.sfhc-small-info strong {
  color: #101828;
}

.sfhc-excel-btn,
.sfhc-pdf-btn {
  border-radius: 12px;
  min-width: 92px;
  font-weight: 800;
}

.sfhc-excel-btn {
  background: #067647;
  color: #fff;
}

.sfhc-excel-btn:hover {
  background: #085d3a;
  color: #fff;
}

.sfhc-pdf-btn {
  background: #b42318;
  color: #fff;
}

.sfhc-pdf-btn:hover {
  background: #912018;
  color: #fff;
}

.sfhc-loader {
  padding: 16px;
  color: #344054;
  display: flex;
  align-items: center;
  font-weight: 700;
}

.sfhc-table-card {
  overflow: hidden;
}

.sfhc-table-meta {
  padding: 14px 16px;
  border-bottom: 1px solid #eaecf0;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #475467;
  font-size: 13px;
}

.sfhc-table-wrap {
  max-height: 68vh;
  overflow: auto;
  position: relative;
}

.sfhc-table {
  margin: 0;
  min-width: 1250px;
  font-size: 12px;
  border-collapse: separate;
  border-spacing: 0;
}

.sfhc-table th {
  white-space: nowrap;
  vertical-align: middle;
  text-align: center;
  border-color: #d0d5dd !important;
}

.sfhc-table td {
  vertical-align: middle;
  border-color: #eaecf0 !important;
  background: #fff;
}

.sfhc-table thead tr:first-child th {
  position: sticky;
  top: 0;
  z-index: 12;
}

.sfhc-table thead tr:nth-child(2) th {
  position: sticky;
  top: 42px;
  z-index: 11;
}

.sticky-base {
  background: #f2f4f7 !important;
  color: #101828;
  font-weight: 900;
}

.group-head {
  background: #e7f0ff !important;
  color: #173b7a;
  font-weight: 900;
}

.sub-head {
  background: #f8fbff !important;
  color: #344054;
  font-weight: 800;
}

.van-head {
  background: #fff4e5 !important;
  color: #7a4b00;
}

.van-sub {
  background: #fffbf2 !important;
}

.total-head {
  background: #ecfdf3 !important;
  color: #05603a;
  font-weight: 900;
}

.amount-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.concession-cell {
  color: #6941c6;
  font-weight: 700;
}

.fine-cell {
  color: #b42318;
  font-weight: 700;
}

.van-cell {
  color: #b54708;
  font-weight: 700;
}

.total-cell {
  background: #f9fafb !important;
  font-weight: 800;
}

.grand-cell {
  background: #ecfdf3 !important;
  color: #027a48;
  font-weight: 900;
  text-align: right;
}

.sticky-c1 {
  position: sticky !important;
  left: 0;
  z-index: 15 !important;
  min-width: 54px;
}

.sticky-c2 {
  position: sticky !important;
  left: 54px;
  z-index: 15 !important;
  min-width: 90px;
}

.sticky-name {
  position: sticky !important;
  left: 144px;
  z-index: 15 !important;
  min-width: 190px;
}

.sticky-body {
  background: #fff !important;
}

.sfhc-table thead .sticky-c1,
.sfhc-table thead .sticky-c2,
.sfhc-table thead .sticky-name {
  z-index: 20 !important;
}

.sfhc-empty {
  background: #fff;
  border: 1px dashed #d0d5dd;
  border-radius: 20px;
  padding: 42px 20px;
  text-align: center;
  color: #667085;
}

.sfhc-empty-icon {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: #f2f4f7;
  color: #101828;
  font-size: 28px;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

@media (max-width: 992px) {
  .sfhc-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .sfhc-status-card {
    width: 100%;
  }

  .sfhc-summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 576px) {
  .sfhc-page {
    padding: 12px;
  }

  .sfhc-summary-grid {
    grid-template-columns: 1fr;
  }

  .sfhc-title {
    font-size: 24px;
  }
}
`;

export default StudentFeeHeadCollectionReport;