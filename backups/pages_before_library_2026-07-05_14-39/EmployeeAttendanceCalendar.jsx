import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import {
  format,
  subMonths,
  addMonths,
  startOfMonth,
  endOfMonth,
  differenceInCalendarDays,
  startOfWeek,
  addDays,
  isSameMonth,
  isSunday,
  isAfter,
  parseISO,
} from "date-fns";
import "bootstrap/dist/css/bootstrap.min.css";
import "./EmployeeAttendanceCalendar.css"; // keep your file

const STATUS_COLORS = {
  present: "#4CAF50",
  absent: "#F44336",
  leave: "#FF9800",
  "half-day-without-pay": "#9C27B0",
  "short-leave": "#2196F3",
  "first-half-leave": "#009688",
  "second-half-leave": "#00BCD4",
  "full-day-leave": "#9E9E9E",
  unmarked: "#BDBDBD",
};

const STATUS_LABELS = Object.keys(STATUS_COLORS);

// Small util: debounce
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const EmployeeAttendanceCalendar = () => {
  const [month, setMonth] = useState(() => new Date());
  const [records, setRecords] = useState([]); // [{ date: 'YYYY-MM-DD', status, remarks, in_time, out_time, ... }]
  const [loading, setLoading] = useState(false);

  // Optional holidays (safe to ignore if not available)
  const [holidays, setHolidays] = useState([]); // [{ date: 'YYYY-MM-DD', title/description }]
  const [holidaysLoaded, setHolidaysLoaded] = useState(false);

  // UI state
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [pendingSearchText, setPendingSearchText] = useState(""); // for debounced input
  const [statusFilter, setStatusFilter] = useState([]); // [] = all
  const [jumpDate, setJumpDate] = useState("");

  // Fetch attendance for the month
  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const monthStr = format(month, "yyyy-MM");
        const res = await api.get(`/employee-attendance/my-calendar?month=${monthStr}`);
        setRecords(Array.isArray(res.data.records) ? res.data.records : []);
      } catch (err) {
        console.error("Error fetching attendance:", err);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [month]);

  // Optional: fetch holidays once (or per month if you want)
  useEffect(() => {
    const tryHolidays = async () => {
      try {
        const r = await api.get("/holidays");
        // Accept arrays of { date, description/title } and filter to current month
        const mm = format(month, "yyyy-MM");
        const filtered =
          Array.isArray(r.data)
            ? r.data.filter((h) => typeof h.date === "string" && h.date.startsWith(mm))
            : [];
        setHolidays(filtered);
      } catch {
        // ignore silently
      } finally {
        setHolidaysLoaded(true);
      }
    };
    tryHolidays();
  }, [month]);

  // Build a quick date → record map
  const recordByDate = useMemo(() => {
    const map = new Map();
    for (const rec of records) {
      if (rec?.date) map.set(rec.date, rec);
    }
    return map;
  }, [records]);

  // Summary counts (present/absent/leave/unmarked) for the visible month
  const summary = useMemo(() => {
    const year = month.getFullYear();
    const m = month.getMonth();
    const totalDays = new Date(year, m + 1, 0).getDate();
    const counts = { present: 0, absent: 0, leave: 0, unmarked: 0 };

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = format(new Date(year, m, d), "yyyy-MM-dd");
      const rec = recordByDate.get(dateStr);
      const s = rec?.status || "unmarked";
      if (counts[s] !== undefined) counts[s]++;
      else counts.unmarked++;
    }
    return counts;
  }, [month, recordByDate]);

  // Debounce search text
  useEffect(() => {
    const apply = debounce((val) => setSearchText(val), 300);
    apply(pendingSearchText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSearchText]);

  // Filtered helper for day cell (by status and text)
  const matchesFilters = (rec) => {
    if (!rec) return statusFilter.length === 0 && searchText.trim() === "";
    if (statusFilter.length && !statusFilter.includes(rec.status)) return false;

    const q = searchText.trim().toLowerCase();
    if (!q) return true;

    // search in status + remarks + any string fields
    const hay = [
      rec.status,
      rec.remarks,
      rec.note,
      rec.in_time,
      rec.out_time,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return hay.includes(q);
  };

  // Build the grid (Sun→Sat, 6 rows max)
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfMonth(month);
  const daysCount = differenceInCalendarDays(addDays(start, 41), start) + 1; // 6 weeks * 7

  const dayCells = Array.from({ length: daysCount }).map((_, idx) => {
    const date = addDays(start, idx);
    const dateStr = format(date, "yyyy-MM-dd");
    const rec = recordByDate.get(dateStr);

    const inCurrentMonth = isSameMonth(date, month);
    const isFuture = isAfter(date, new Date());
    const sunday = isSunday(date);

    const holiday = holidays.find((h) => h?.date === dateStr);
    const status = rec?.status || "unmarked";
    const color = STATUS_COLORS[status] || "#BDBDBD";

    const filteredOut = !matchesFilters(rec);

    return {
      date,
      dateStr,
      rec,
      holiday,
      inCurrentMonth,
      isFuture,
      sunday,
      color,
      filteredOut,
    };
  });

  // Status multi-select handler
  const toggleStatus = (s) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  // Jump to a specific date (if inside current month or change month accordingly)
  const handleJump = () => {
    if (!jumpDate) return;
    const d = parseISO(jumpDate);
    if (isNaN(d)) return;
    // change month to the chosen date's month and select
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const selectedRecord = selectedDate ? recordByDate.get(selectedDate) : null;
  const selectedHoliday =
    selectedDate && holidays.find((h) => h?.date === selectedDate);

  return (
    <div className="container-fluid py-3">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-primary"
            onClick={() => setMonth(subMonths(month, 1))}
          >
            ‹
          </button>
          <h4 className="mb-0">{format(month, "MMMM yyyy")}</h4>
          <button
            className="btn btn-outline-primary"
            onClick={() => setMonth(addMonths(month, 1))}
          >
            ›
          </button>
        </div>

        {/* Jump-to-month native input (yyyy-MM) */}
        <div className="d-flex align-items-center gap-2">
          <input
            type="month"
            className="form-control"
            value={format(month, "yyyy-MM")}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-");
              if (y && m) setMonth(new Date(Number(y), Number(m) - 1, 1));
            }}
            style={{ maxWidth: 180 }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3">
          <div className="summary-card border rounded p-3 h-100" style={{ borderLeft: `6px solid ${STATUS_COLORS.present}` }}>
            <div className="fw-bold">Present</div>
            <div className="fs-4">{summary.present}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="summary-card border rounded p-3 h-100" style={{ borderLeft: `6px solid ${STATUS_COLORS.absent}` }}>
            <div className="fw-bold">Absent</div>
            <div className="fs-4">{summary.absent}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="summary-card border rounded p-3 h-100" style={{ borderLeft: `6px solid ${STATUS_COLORS.leave}` }}>
            <div className="fw-bold">Leave</div>
            <div className="fs-4">{summary.leave}</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="summary-card border rounded p-3 h-100" style={{ borderLeft: `6px solid ${STATUS_COLORS.unmarked}` }}>
            <div className="fw-bold">Unmarked</div>
            <div className="fs-4">{summary.unmarked}</div>
          </div>
        </div>
      </div>

      {/* Filters / Search */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-5">
              <label className="form-label">Search (status/remarks)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. present, sick, WFH..."
                onChange={(e) => setPendingSearchText(e.target.value)}
              />
            </div>

            <div className="col-12 col-md-5">
              <label className="form-label d-block">Filter by status</label>
              <div className="d-flex flex-wrap gap-2">
                {STATUS_LABELS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={`btn btn-sm ${
                      statusFilter.includes(s)
                        ? "btn-primary"
                        : "btn-outline-secondary"
                    }`}
                    onClick={() => toggleStatus(s)}
                    title={s.replace(/-/g, " ")}
                  >
                    {s.replace(/-/g, " ")}
                  </button>
                ))}
                {statusFilter.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-dark"
                    onClick={() => setStatusFilter([])}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="col-12 col-md-2">
              <label className="form-label">Jump to date</label>
              <div className="d-flex gap-2">
                <input
                  type="date"
                  className="form-control"
                  value={jumpDate}
                  onChange={(e) => setJumpDate(e.target.value)}
                />
                <button className="btn btn-outline-secondary" onClick={handleJump}>
                  Go
                </button>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="d-flex flex-wrap gap-3 mt-3">
            {STATUS_LABELS.map((s) => (
              <div key={s} className="d-flex align-items-center gap-2 small">
                <span
                  className="legend-dot"
                  style={{ background: STATUS_COLORS[s] }}
                />
                <span>{s.replace(/-/g, " ")}</span>
              </div>
            ))}
            <div className="d-flex align-items-center gap-2 small">
              <span className="legend-swatch sunday" />
              <span>Sunday</span>
            </div>
            {holidaysLoaded && holidays.length > 0 && (
              <div className="d-flex align-items-center gap-2 small">
                <span className="legend-swatch holiday" />
                <span>Holiday</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid + Side panel */}
      <div className="row g-3">
        <div className="col-12 col-lg-8">
          <div
            className="calendar-grid border rounded overflow-hidden"
            style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div
                key={d}
                className="text-center fw-semibold p-2 border-bottom bg-light"
              >
                {d}
              </div>
            ))}

            {loading ? (
              <div className="p-4 text-center col-span-7">Loading attendance…</div>
            ) : (
              dayCells.map(
                (
                  {
                    date,
                    dateStr,
                    rec,
                    holiday,
                    inCurrentMonth,
                    isFuture,
                    sunday,
                    color,
                    filteredOut,
                  },
                  idx
                ) => {
                  const isSelected = selectedDate === dateStr;

                  const baseClasses = [
                    "calendar-cell",
                    "p-2",
                    "border",
                    inCurrentMonth ? "" : "muted-month",
                    sunday ? "sunday-bg" : "",
                    holiday ? "holiday-bg" : "",
                    filteredOut ? "filtered-out" : "",
                    isSelected ? "selected" : "",
                  ].join(" ");

                  return (
                    <div
                      key={idx}
                      className={baseClasses}
                      style={{ borderLeft: `6px solid ${color}`, minHeight: 88, cursor: "pointer" }}
                      onClick={() => setSelectedDate(dateStr)}
                      title={
                        holiday
                          ? `${holiday.description || holiday.title || "Holiday"}`
                          : rec?.remarks || rec?.status || dateStr
                      }
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="fw-bold">{format(date, "d")}</div>
                        {!inCurrentMonth && <span className="badge bg-secondary">•</span>}
                      </div>

                      {holiday ? (
                        <div className="small mt-1">
                          <div className="fw-semibold">Holiday</div>
                          <div className="text-truncate">
                            {holiday.description || holiday.title}
                          </div>
                        </div>
                      ) : rec ? (
                        <div className="small mt-1">
                          <div className="text-capitalize" style={{ color }}>
                            {rec.status?.replace(/-/g, " ")}
                          </div>
                          {rec.remarks && (
                            <div className="text-muted text-truncate">{rec.remarks}</div>
                          )}
                          {(rec.in_time || rec.out_time) && (
                            <div className="text-muted">
                              {rec.in_time ? `In: ${rec.in_time}` : ""}
                              {rec.out_time ? ` · Out: ${rec.out_time}` : ""}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="small mt-1 text-muted">
                          {isFuture ? "" : "Not marked"}
                        </div>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>

        {/* Side panel */}
        <div className="col-12 col-lg-4">
          <div className="card h-100">
            <div className="card-body">
              {!selectedDate ? (
                <div className="alert alert-info mb-0">
                  Select a day to view details.
                </div>
              ) : selectedHoliday ? (
                <>
                  <h5 className="mb-1">Holiday</h5>
                  <div className="text-muted">{format(parseISO(selectedDate), "PPP")}</div>
                  <hr />
                  <div>{selectedHoliday.description || selectedHoliday.title}</div>
                </>
              ) : selectedRecord ? (
                <>
                  <h5 className="mb-1">Attendance Details</h5>
                  <div className="text-muted">
                    {format(parseISO(selectedDate), "PPP")}
                  </div>
                  <hr />
                  <div className="mb-2">
                    <span
                      className="legend-dot me-2"
                      style={{ background: STATUS_COLORS[selectedRecord.status] || "#BDBDBD" }}
                    />
                    <span className="text-capitalize">
                      {selectedRecord.status?.replace(/-/g, " ")}
                    </span>
                  </div>
                  {selectedRecord.in_time || selectedRecord.out_time ? (
                    <div className="mb-2 small text-muted">
                      {selectedRecord.in_time ? `In: ${selectedRecord.in_time}` : ""}
                      {selectedRecord.out_time ? ` · Out: ${selectedRecord.out_time}` : ""}
                    </div>
                  ) : null}
                  {selectedRecord.remarks && (
                    <div className="mb-2">
                      <div className="fw-semibold small">Remarks</div>
                      <div className="text-muted">{selectedRecord.remarks}</div>
                    </div>
                  )}
                  {/* Add more fields here if your API returns them */}
                </>
              ) : (
                <>
                  <h5 className="mb-1">No attendance</h5>
                  <div className="text-muted">
                    {format(parseISO(selectedDate), "PPP")}
                  </div>
                  <hr />
                  <div className="text-muted">Not marked.</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeAttendanceCalendar;
