import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import Select from "react-select";
import "./SubstitutionListing.css";

const SubstitutionListing = () => {
  const [substitutions, setSubstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [school, setSchool] = useState(null); // ⬅ school info for header

  const [filterDate, setFilterDate] = useState("");
  const [filterCoveringTeacher, setFilterCoveringTeacher] = useState(null);
  const [filterRegularTeacher, setFilterRegularTeacher] = useState(null);
  const [filterClass, setFilterClass] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState(null);
  const [filterSubject, setFilterSubject] = useState(null);

  // Fetch substitutions from the protected API
  const fetchSubstitutions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/substitutions");
      setSubstitutions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching substitutions:", error);
      Swal.fire("Error", "Failed to fetch substitutions.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch school name/logo (first record)
  const fetchSchool = async () => {
    try {
      const { data } = await api.get("/schools");
      if (Array.isArray(data) && data.length) setSchool(data[0]);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    fetchSubstitutions();
    fetchSchool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** -------------------------------
   * Normalizers (robust fallbacks)
   * ------------------------------- */

  // Covering teacher (who covers the period)
  const getCoveringTeacherName = (s) =>
    s?.Teacher?.name ||
    s?.CoveringTeacher?.name ||
    s?.CoveringEmployee?.name ||
    s?.teacherName ||
    s?.teacher?.name ||
    s?.teacher?.userAccount?.name ||
    null;

  // Regular/original teacher (who was supposed to take the period)
  const getRegularTeacherName = (s) =>
    s?.OriginalTeacher?.name ||
    s?.RegularTeacher?.name ||
    s?.OriginalEmployee?.name ||
    s?.regularTeacherName ||
    s?.originalTeacherName ||
    s?.originalTeacher?.name ||
    s?.originalTeacher?.userAccount?.name ||
    null;

  const getClassLabel = (s) =>
    s?.Class?.class_name ?? s?.className ?? s?.class_id ?? s?.classId ?? "";

  const getPeriodName = (s) =>
    s?.Period?.period_name ?? s?.periodName ?? s?.period_id ?? s?.periodId ?? "";

  const getSubjectName = (s) =>
    s?.Subject?.name ?? s?.subjectName ?? s?.subject?.name ?? "";

  const parseISO = (d) => {
    const t = Date.parse(d);
    return Number.isNaN(t) ? -Infinity : t;
  };

  // Derived rows for easy rendering, sorted DESC by date, with today flag
  const derivedRows = useMemo(() => {
    const todayISO = new Date().toISOString().split("T")[0];

    return substitutions
      .map((s) => ({
        ...s,
        _coveringTeacherName: getCoveringTeacherName(s),
        _regularTeacherName: getRegularTeacherName(s),
        _classLabel: String(getClassLabel(s)),
        _periodName: String(getPeriodName(s)),
        _subjectName: getSubjectName(s),
        _date: s?.date ?? "",
        _isToday: (s?.date ?? "") === todayISO,
      }))
      .sort((a, b) => parseISO(b._date) - parseISO(a._date)); // newest first
  }, [substitutions]);

  /** -------------------------------
   * Filter options (unique, sorted)
   * ------------------------------- */
  const coveringTeacherOptions = useMemo(() => {
    const set = new Set(
      derivedRows.map((r) => r._coveringTeacherName).filter(Boolean)
    );
    return [...set].sort().map((name) => ({ label: name, value: name }));
  }, [derivedRows]);

  const regularTeacherOptions = useMemo(() => {
    const set = new Set(
      derivedRows.map((r) => r._regularTeacherName).filter(Boolean)
    );
    return [...set].sort().map((name) => ({ label: name, value: name }));
  }, [derivedRows]);

  const classOptions = useMemo(() => {
    const set = new Set(derivedRows.map((r) => r._classLabel).filter(Boolean));
    return [...set].sort().map((cls) => ({ label: cls, value: cls }));
  }, [derivedRows]);

  const periodOptions = useMemo(() => {
    const set = new Set(derivedRows.map((r) => r._periodName).filter(Boolean));
    return [...set].sort().map((p) => ({ label: p, value: p }));
  }, [derivedRows]);

  const subjectOptions = useMemo(() => {
    const set = new Set(derivedRows.map((r) => r._subjectName).filter(Boolean));
    return [...set].sort().map((s) => ({ label: s, value: s }));
  }, [derivedRows]);

  /** -------------------------------
   * Apply filters
   * ------------------------------- */
  const filteredRows = useMemo(() => {
    return derivedRows.filter((r) => {
      const matchDate = filterDate ? r._date === filterDate : true;
      const matchCover = filterCoveringTeacher
        ? r._coveringTeacherName === filterCoveringTeacher.value
        : true;
      const matchRegular = filterRegularTeacher
        ? r._regularTeacherName === filterRegularTeacher.value
        : true;
      const matchClass = filterClass ? r._classLabel === filterClass.value : true;
      const matchPeriod = filterPeriod ? r._periodName === filterPeriod.value : true;
      const matchSubject = filterSubject ? r._subjectName === filterSubject.value : true;
      return (
        matchDate &&
        matchCover &&
        matchRegular &&
        matchClass &&
        matchPeriod &&
        matchSubject
      );
    });
  }, [
    derivedRows,
    filterDate,
    filterCoveringTeacher,
    filterRegularTeacher,
    filterClass,
    filterPeriod,
    filterSubject,
  ]);

  const clearFilters = () => {
    setFilterDate("");
    setFilterCoveringTeacher(null);
    setFilterRegularTeacher(null);
    setFilterClass(null);
    setFilterPeriod(null);
    setFilterSubject(null);
  };

  const columns = [
    { key: "_date", label: "Date" },
    { key: "_coveringTeacherName", label: "Covering Teacher" },
    { key: "_regularTeacherName", label: "Regular Teacher" },
    { key: "_classLabel", label: "Class" },
    { key: "_periodName", label: "Period" },
    { key: "_subjectName", label: "Subject" },
  ];

  // Build printable filter summary
  const filterSummary = useMemo(() => {
    const parts = [];
    if (filterDate) parts.push(`Date: ${filterDate}`);
    if (filterCoveringTeacher?.value) parts.push(`Covering: ${filterCoveringTeacher.value}`);
    if (filterRegularTeacher?.value) parts.push(`Regular: ${filterRegularTeacher.value}`);
    if (filterClass?.value) parts.push(`Class: ${filterClass.value}`);
    if (filterPeriod?.value) parts.push(`Period: ${filterPeriod.value}`);
    if (filterSubject?.value) parts.push(`Subject: ${filterSubject.value}`);
    return parts.join(" | ") || "All records";
  }, [
    filterDate,
    filterCoveringTeacher,
    filterRegularTeacher,
    filterClass,
    filterPeriod,
    filterSubject,
  ]);

  const handlePrint = () => {
    window.print();
  };

  const schoolLogoSrc = school?.logo ? (api.defaults?.baseURL ? `${api.defaults.baseURL}${school.logo}` : school.logo) : null;

  return (
    <div className="container mt-4">
      {/* ====== PRINT HEADER (visible in print; subtle on screen) ====== */}
      <div className="print-header card shadow-sm mb-3">
        <div className="card-body d-flex align-items-center gap-3">
          {schoolLogoSrc ? (
            <img
              src={schoolLogoSrc}
              alt={school?.name || "School"}
              className="print-school-logo"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="print-school-logo placeholder">🏫</div>
          )}
          <div className="w-100">
            <h2 className="m-0">{school?.name || "School ERP"}</h2>
            <div className="small text-muted">
              Substitution Listing • Printed on {new Date().toLocaleString()}
            </div>
            <div className="small text-muted">Filters: {filterSummary}</div>
          </div>
        </div>
      </div>

      {/* ====== PAGE TITLE + ACTIONS ====== */}
      <div className="d-flex align-items-center justify-content-between mb-3 no-print">
        <h1 className="page-title m-0">Substitution Listing</h1>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={clearFilters}
            disabled={
              !filterDate &&
              !filterCoveringTeacher &&
              !filterRegularTeacher &&
              !filterClass &&
              !filterPeriod &&
              !filterSubject
            }
            title="Clear filters"
          >
            Clear
          </button>
          <button
            className="btn btn-outline-dark btn-sm"
            onClick={handlePrint}
            title="Print PDF"
          >
            Print PDF
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={fetchSubstitutions}
            disabled={loading}
            title="Reload"
          >
            {loading ? "Loading..." : "Reload"}
          </button>
        </div>
      </div>

      {/* ====== FILTERS ====== */}
      <div className="card p-3 mb-4 shadow-sm filter-card no-print">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label">Covering Teacher</label>
            <Select
              classNamePrefix="react-select"
              options={coveringTeacherOptions}
              value={filterCoveringTeacher}
              onChange={setFilterCoveringTeacher}
              placeholder="Select..."
              isClearable
            />
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label">Regular Teacher</label>
            <Select
              classNamePrefix="react-select"
              options={regularTeacherOptions}
              value={filterRegularTeacher}
              onChange={setFilterRegularTeacher}
              placeholder="Select..."
              isClearable
            />
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label">Class</label>
            <Select
              classNamePrefix="react-select"
              options={classOptions}
              value={filterClass}
              onChange={setFilterClass}
              placeholder="Select..."
              isClearable
            />
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label">Period</label>
            <Select
              classNamePrefix="react-select"
              options={periodOptions}
              value={filterPeriod}
              onChange={setFilterPeriod}
              placeholder="Select..."
              isClearable
            />
          </div>
          <div className="col-12 col-sm-6 col-md-3">
            <label className="form-label">Subject</label>
            <Select
              classNamePrefix="react-select"
              options={subjectOptions}
              value={filterSubject}
              onChange={setFilterSubject}
              placeholder="Select..."
              isClearable
            />
          </div>
        </div>
      </div>

      {/* ====== TABLE / RESPONSIVE CARDS ====== */}
      <div className="table-wrapper card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover table-bordered mb-0 print-table">
            <thead className="table-dark sticky-thead">
              <tr>
                <th style={{ width: 56 }}>#</th>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="skeleton-row">
                    <td colSpan={columns.length + 1}>
                      <div className="skeleton-line" />
                    </td>
                  </tr>
                ))
              ) : filteredRows.length > 0 ? (
                filteredRows.map((r, index) => (
                  <tr
                    key={r.id ?? `${r._date}-${index}`}
                    className={r._isToday ? "highlight-today" : ""}
                  >
                    <td data-label="#" className="row-index">
                      {index + 1}
                    </td>

                    <td data-label="Date">
                      <span className="date-text">{r._date || "-"}</span>
                      {r._isToday && <span className="today-badge ms-2">Today</span>}
                    </td>
                    <td data-label="Covering Teacher">
                      {r._coveringTeacherName || "-"}
                    </td>
                    <td data-label="Regular Teacher">
                      {r._regularTeacherName || "-"}
                    </td>
                    <td data-label="Class">{r._classLabel || "-"}</td>
                    <td data-label="Period">{r._periodName || "-"}</td>
                    <td data-label="Subject">{r._subjectName || "-"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-4">
                    No Substitutions Found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Print footer (page break control) */}
        <div className="print-footer small text-muted px-3 py-2">
          Generated by EduBridge ERP • {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default SubstitutionListing;
