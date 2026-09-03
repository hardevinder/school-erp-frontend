import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

/**
 * AcademicCalendarView.jsx (READ ONLY)
 * ✅ Anyone can view (student/teacher/hr/admin etc.)
 * ✅ Fetches latest PUBLISHED calendar (or by school/session filter)
 * ✅ Shows month summary
 * ✅ Shows events table + search + type filter
 * ✅ NEW: Month "Wall Calendar" view (date boxes with titles; click -> details modal)
 * ✅ PDF button (blob -> open/download)
 */

const safeArr = (d) => (Array.isArray(d) ? d : d?.rows || d?.data || []);

const toDDMMYYYY = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const toISODate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const monthLabel = (d) =>
  d
    ? d.toLocaleString("en-IN", { month: "long", year: "numeric" })
    : "";

export default function AcademicCalendarView() {
  // filters
  const [schoolId, setSchoolId] = useState("");
  const [session, setSession] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");

  // data
  const [calendars, setCalendars] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [calendar, setCalendar] = useState(null);
  const [summary, setSummary] = useState([]);

  // masters
  const [schools, setSchools] = useState([]);

  // loading
  const [loadingList, setLoadingList] = useState(false);
  const [loadingCal, setLoadingCal] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // view mode
  const [viewMode, setViewMode] = useState("MONTH"); // MONTH | LIST

  // month grid state
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });

  // modal for day details
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState(""); // YYYY-MM-DD
  const [dayModalEvents, setDayModalEvents] = useState([]);

  // ---------------- Load Schools (optional but nice) ----------------
  const fetchSchools = async () => {
    try {
      const res = await api.get("/schools").catch(() => ({ data: [] }));
      const rows = safeArr(res.data);
      setSchools(rows);
    } catch {
      setSchools([]);
    }
  };

  // ---------------- Load calendars list (prefer PUBLISHED) ----------------
  const fetchCalendars = async () => {
    setLoadingList(true);
    try {
      const params = {};
      if (schoolId) params.school_id = schoolId;
      if (session) params.academic_session = session;

      const res = await api.get("/academic-calendars", { params });
      const rows = safeArr(res.data);

      const sorted = [...rows].sort((a, b) => {
        const aPub = String(a.status || "").toUpperCase() === "PUBLISHED" ? 1 : 0;
        const bPub = String(b.status || "").toUpperCase() === "PUBLISHED" ? 1 : 0;
        if (aPub !== bPub) return bPub - aPub;

        const ad = String(a.start_date || "");
        const bd = String(b.start_date || "");
        if (ad !== bd) return bd.localeCompare(ad);

        return Number(b.id || 0) - Number(a.id || 0);
      });

      setCalendars(sorted);

      if (!selectedId && sorted.length) {
        setSelectedId(String(sorted[0].id));
      }
    } catch (err) {
      console.error("fetchCalendars error:", err);
      Swal.fire("Error", "Failed to load academic calendars", "error");
      setCalendars([]);
    } finally {
      setLoadingList(false);
    }
  };

  // ---------------- Load selected calendar (with events) ----------------
  const fetchCalendarById = async (id) => {
    if (!id) return;
    setLoadingCal(true);
    try {
      const res = await api.get(`/academic-calendars/${id}`);
      setCalendar(res.data || null);
    } catch (err) {
      console.error("fetchCalendarById error:", err);
      Swal.fire("Error", "Failed to load calendar details", "error");
      setCalendar(null);
    } finally {
      setLoadingCal(false);
    }
  };

  // ---------------- Load month summary ----------------
  const fetchSummaryByMonth = async (id) => {
    if (!id) return;
    setLoadingSummary(true);
    try {
      const res = await api.get("/academic-calendars/summary-by-month", {
        params: { calendar_id: id },
      });
      setSummary(Array.isArray(res.data?.summary) ? res.data.summary : []);
    } catch (err) {
      console.error("fetchSummaryByMonth error:", err);
      setSummary([]);
    } finally {
      setLoadingSummary(false);
    }
  };

  // ---------------- PDF (blob open/download) ----------------
  const openPdf = async () => {
    if (!calendar?.id) return;
    try {
      const resp = await api.get(`/academic-calendars/${calendar.id}/pdf`, {
        responseType: "blob",
        params: { inline: 1 },
      });

      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `AcademicCalendar_${calendar.academic_session || calendar.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("calendar pdf error:", err);
      Swal.fire("Error", err?.response?.data?.error || "PDF not available", "error");
    }
  };

  // ---------------- Effects ----------------
  useEffect(() => {
    fetchSchools();
    fetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, session]);

  useEffect(() => {
    if (!selectedId) return;
    fetchCalendarById(selectedId);
    fetchSummaryByMonth(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // When calendar loads, align month cursor to calendar start_date (or first event date)
  useEffect(() => {
    if (!calendar) return;

    const evs = Array.isArray(calendar?.events) ? calendar.events : [];
    const firstEv = evs
      .map((e) => e?.start_date)
      .filter(Boolean)
      .sort()[0];

    const base = firstEv || calendar.start_date || new Date();
    const d = new Date(base);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      setMonthCursor(d);
    }
  }, [calendar]);

  // ---------------- Filter events locally ----------------
  const events = useMemo(() => {
    const list = Array.isArray(calendar?.events) ? calendar.events : [];
    const t = String(type || "").toUpperCase().trim();
    const s = String(q || "").trim().toLowerCase();

    return list.filter((ev) => {
      const okType = !t || String(ev.type || "").toUpperCase() === t;
      if (!okType) return false;
      if (!s) return true;

      const hay = [
        ev.title,
        ev.description,
        ev.exam_name,
        ev.class_scope,
        ev.type,
        ev.start_date,
        ev.end_date,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" | ");

      return hay.includes(s);
    });
  }, [calendar, type, q]);

  // ---------------- Month Grid Computation ----------------
  const monthGrid = useMemo(() => {
    // Build a 6-week grid starting from Sunday (or Monday? we'll keep Sunday like common wall calendars)
    const first = new Date(monthCursor);
    first.setDate(1);
    first.setHours(0, 0, 0, 0);

    const firstDow = first.getDay(); // 0=Sun
    const gridStart = addDays(first, -firstDow);

    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      days.push({
        dateObj: d,
        iso: toISODate(d),
        inMonth: d.getMonth() === first.getMonth(),
        isToday: toISODate(d) === toISODate(new Date()),
      });
    }
    return days;
  }, [monthCursor]);

  // Map ISO date -> events happening that day (supports multi-day)
  const eventsByDay = useMemo(() => {
    const map = new Map();

    const put = (iso, ev) => {
      if (!iso) return;
      if (!map.has(iso)) map.set(iso, []);
      map.get(iso).push(ev);
    };

    for (const ev of events) {
      const s = ev?.start_date ? startOfDay(new Date(ev.start_date)) : null;
      const e = ev?.end_date ? startOfDay(new Date(ev.end_date)) : s;
      if (!s || Number.isNaN(s.getTime())) continue;
      const end = e && !Number.isNaN(e.getTime()) ? e : s;

      const maxSpan = 400; // safety
      const spanDays = clamp(
        Math.round((end.getTime() - s.getTime()) / (24 * 3600 * 1000)),
        0,
        maxSpan
      );

      for (let i = 0; i <= spanDays; i++) {
        const day = addDays(s, i);
        put(toISODate(day), ev);
      }
    }

    // sort events per day (holidays first maybe, then title)
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => {
        const ad = String(a?.start_date || "");
        const bd = String(b?.start_date || "");
        if (ad !== bd) return ad.localeCompare(bd);
        return String(a?.title || "").localeCompare(String(b?.title || ""));
      });
      map.set(k, list);
    }

    return map;
  }, [events]);

  const openDayModal = (iso) => {
    const list = eventsByDay.get(iso) || [];
    setDayModalDate(iso);
    setDayModalEvents(list);
    setDayModalOpen(true);
  };

  const closeDayModal = () => {
    setDayModalOpen(false);
    setDayModalDate("");
    setDayModalEvents([]);
  };

  const selectedSchoolName = useMemo(() => {
    const sid = Number(calendar?.school_id || 0);
    const found = schools.find((s) => Number(s.id) === sid);
    return found?.name || (calendar?.school_id ? `School #${calendar.school_id}` : "All Schools");
  }, [calendar, schools]);

  const badge = (st) => {
    const s = String(st || "").toUpperCase();
    if (s === "PUBLISHED") return "badge bg-success";
    if (s === "ARCHIVED") return "badge bg-secondary";
    return "badge bg-warning text-dark";
  };

  const typeBadgeClass = (t) => {
    const x = String(t || "").toUpperCase();
    if (x === "HOLIDAY") return "badge bg-danger";
    if (x === "VACATION") return "badge bg-warning text-dark";
    if (x === "EXAM") return "badge bg-primary";
    if (x === "PTM") return "badge bg-info text-dark";
    if (x === "EVENT") return "badge bg-success";
    if (x === "ACTIVITY") return "badge bg-success";
    return "badge bg-secondary";
  };

  return (
    <div className="container mt-4">
      {/* Top Header */}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <h2 className="mb-0">Academic Calendar</h2>
        <div style={{ flex: 1 }} />

        <button
          className="btn btn-outline-secondary"
          onClick={fetchCalendars}
          disabled={loadingList}
        >
          {loadingList ? "Loading..." : "Refresh"}
        </button>

        <button
          className="btn btn-outline-dark"
          onClick={openPdf}
          disabled={!calendar?.id}
          title="Open PDF"
        >
          PDF
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label">School (optional)</label>
              <select
                className="form-select"
                value={schoolId}
                onChange={(e) => {
                  setSelectedId("");
                  setCalendar(null);
                  setSummary([]);
                  setSchoolId(e.target.value);
                }}
              >
                <option value="">All / Default</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || `School ${s.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">Academic Session (optional)</label>
              <input
                className="form-control"
                placeholder="e.g. 2025-2026"
                value={session}
                onChange={(e) => {
                  setSelectedId("");
                  setCalendar(null);
                  setSummary([]);
                  setSession(e.target.value);
                }}
              />
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label">Select Calendar</label>
              <select
                className="form-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loadingList || calendars.length === 0}
              >
                {calendars.length === 0 && <option value="">No calendars</option>}
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.academic_session} — {c.title || "Academic Calendar"} ({c.status})
                  </option>
                ))}
              </select>
              <div className="form-text">
                We automatically show <b>PUBLISHED</b> first (if exists), otherwise latest.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar header */}
      <div className="card mb-3">
        <div className="card-body">
          {loadingCal && <div>Loading calendar...</div>}
          {!loadingCal && !calendar && (
            <div className="alert alert-info mb-0">No calendar selected / available.</div>
          )}

          {!loadingCal && calendar && (
            <div className="d-flex flex-wrap gap-2 align-items-start">
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h4 className="mb-0">
                    {calendar.title || "Academic Calendar"}{" "}
                    <span className={badge(calendar.status)}>{calendar.status}</span>
                  </h4>
                </div>
                <div className="text-muted mt-1">
                  <strong>School:</strong> {selectedSchoolName} &nbsp; | &nbsp;
                  <strong>Session:</strong> {calendar.academic_session} &nbsp; | &nbsp;
                  <strong>Dates:</strong> {toDDMMYYYY(calendar.start_date)} – {toDDMMYYYY(calendar.end_date)}
                </div>

                {calendar.weekly_off && (
                  <div className="mt-2 small">
                    <strong>Weekly Off:</strong>{" "}
                    <code>
                      {typeof calendar.weekly_off === "string"
                        ? calendar.weekly_off
                        : JSON.stringify(calendar.weekly_off)}
                    </code>
                  </div>
                )}

                {calendar.remarks && (
                  <div className="mt-2">
                    <strong>Remarks:</strong> {calendar.remarks}
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }} />

              <div className="text-end">
                <div className="small text-muted">Created By</div>
                <div className="fw-semibold">
                  {calendar.createdBy?.name || calendar.createdBy?.username || "-"}
                </div>
                {calendar.status === "PUBLISHED" && (
                  <>
                    <div className="small text-muted mt-2">Published By</div>
                    <div className="fw-semibold">
                      {calendar.publishedBy?.name || calendar.publishedBy?.username || "-"}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Month summary */}
      <div className="card mb-3">
        <div className="card-header bg-white fw-semibold d-flex align-items-center justify-content-between">
          <span>Month Summary</span>
          <span className="text-muted small">
            {loadingSummary ? "Loading..." : `${summary.length} months`}
          </span>
        </div>
        <div className="card-body">
          {summary.length === 0 ? (
            <div className="text-muted">No summary available.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total</th>
                    <th>Working</th>
                    <th>Holidays</th>
                    <th>Vacations</th>
                    <th>Exams</th>
                    <th>PTM</th>
                    <th>Activities</th>
                    <th>Events</th>
                    <th>Others</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((m) => (
                    <tr key={m.month}>
                      <td className="fw-semibold">{m.label}</td>
                      <td>{m.total || 0}</td>
                      <td>{m.working_days || 0}</td>
                      <td>{m.holidays || 0}</td>
                      <td>{m.vacations || 0}</td>
                      <td>{m.exams || 0}</td>
                      <td>{m.ptm || 0}</td>
                      <td>{m.activities || 0}</td>
                      <td>{m.events || 0}</td>
                      <td>{m.others || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Events */}
      <div className="card mb-5">
        <div className="card-header bg-white fw-semibold d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <span>Events</span>
          <div className="d-flex gap-2 align-items-center">
            <span className="text-muted small">{events.length} items</span>
            <div className="btn-group btn-group-sm" role="group" aria-label="View mode">
              <button
                className={`btn ${viewMode === "MONTH" ? "btn-dark" : "btn-outline-dark"}`}
                onClick={() => setViewMode("MONTH")}
                type="button"
              >
                Month View
              </button>
              <button
                className={`btn ${viewMode === "LIST" ? "btn-dark" : "btn-outline-dark"}`}
                onClick={() => setViewMode("LIST")}
                type="button"
              >
                List View
              </button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {/* Filters */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-3">
              <label className="form-label">Type</label>
              <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All</option>
                <option value="HOLIDAY">HOLIDAY</option>
                <option value="VACATION">VACATION</option>
                <option value="EXAM">EXAM</option>
                <option value="PTM">PTM</option>
                <option value="ACTIVITY">ACTIVITY</option>
                <option value="EVENT">EVENT</option>
                <option value="TRAINING">TRAINING</option>
                <option value="SYLLABUS_DEADLINE">SYLLABUS_DEADLINE</option>
                <option value="RESULT">RESULT</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div className="col-12 col-md-9">
              <label className="form-label">Search</label>
              <input
                className="form-control"
                placeholder="Search title / description / exam / scope..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          {/* MONTH VIEW */}
          {viewMode === "MONTH" && (
            <div className="mb-3">
              <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-2">
                <div className="fw-semibold" style={{ fontSize: 16 }}>
                  {monthLabel(monthCursor)}
                </div>

                <div className="d-flex gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => {
                      const d = new Date(monthCursor);
                      d.setMonth(d.getMonth() - 1);
                      d.setDate(1);
                      d.setHours(0, 0, 0, 0);
                      setMonthCursor(d);
                    }}
                  >
                    ← Prev
                  </button>
                  <button
                    className="btn btn-outline-dark btn-sm"
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(1);
                      d.setHours(0, 0, 0, 0);
                      setMonthCursor(d);
                    }}
                  >
                    Today
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    type="button"
                    onClick={() => {
                      const d = new Date(monthCursor);
                      d.setMonth(d.getMonth() + 1);
                      d.setDate(1);
                      d.setHours(0, 0, 0, 0);
                      setMonthCursor(d);
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>

              {/* Weekday headers */}
              <div
                className="d-grid"
                style={{
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="text-muted small fw-semibold"
                    style={{ paddingLeft: 6 }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div
                className="d-grid"
                style={{
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 8,
                }}
              >
                {monthGrid.map((cell) => {
                  const list = eventsByDay.get(cell.iso) || [];
                  return (
                    <div
                      key={cell.iso}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDayModal(cell.iso)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openDayModal(cell.iso);
                      }}
                      className={`border rounded-3 ${cell.inMonth ? "bg-white" : "bg-light"}`}
                      style={{
                        minHeight: 110,
                        padding: 8,
                        cursor: "pointer",
                        boxShadow: cell.isToday ? "0 0 0 2px rgba(33,37,41,0.15)" : "none",
                        overflow: "hidden",
                      }}
                      title="Click to view details"
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <div className={`fw-semibold ${cell.inMonth ? "" : "text-muted"}`}>
                          {new Date(cell.dateObj).getDate()}
                        </div>
                        {list.length > 0 && (
                          <span className="badge bg-dark" style={{ fontSize: 11 }}>
                            {list.length}
                          </span>
                        )}
                      </div>

                      {list.length === 0 ? (
                        <div className="text-muted small">—</div>
                      ) : (
                        <div style={{ maxHeight: 80, overflow: "auto" }}>
                          {list.slice(0, 6).map((ev) => (
                            <div
                              key={`${cell.iso}-${ev.id}`}
                              className="small"
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                padding: "2px 0",
                              }}
                              title={ev.title}
                            >
                              <span className="me-1">•</span>
                              {ev.title}
                            </div>
                          ))}
                          {list.length > 6 && (
                            <div className="text-muted small">+{list.length - 6} more…</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-muted small mt-2">
                Click any date box to see event details. (Multi-day events appear on each day.)
              </div>
            </div>
          )}

          {/* LIST VIEW */}
          {viewMode === "LIST" && (
            <>
              {events.length === 0 ? (
                <div className="text-muted">No events found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: 160 }}>Date</th>
                        <th style={{ width: 140 }}>Type</th>
                        <th>Title / Description</th>
                        <th style={{ width: 140 }}>Scope</th>
                        <th style={{ width: 90, textAlign: "center" }}>Work</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => {
                        const dateText =
                          ev.start_date === ev.end_date
                            ? toDDMMYYYY(ev.start_date)
                            : `${toDDMMYYYY(ev.start_date)} - ${toDDMMYYYY(ev.end_date)}`;

                        return (
                          <tr key={ev.id}>
                            <td>{dateText}</td>
                            <td>
                              <span className="badge bg-light text-dark border">
                                {ev.type}
                              </span>
                            </td>
                            <td>
                              <div className="fw-semibold">{ev.title}</div>
                              {ev.description && (
                                <div className="text-muted small">{ev.description}</div>
                              )}
                              {ev.exam_name && (
                                <div className="small">
                                  <strong>Exam:</strong> {ev.exam_name}
                                </div>
                              )}
                            </td>
                            <td>{ev.class_scope || "ALL"}</td>
                            <td style={{ textAlign: "center" }}>
                              <span
                                className={
                                  ev.is_working_day
                                    ? "badge bg-success"
                                    : "badge bg-danger"
                                }
                              >
                                {ev.is_working_day ? "YES" : "NO"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="text-muted small mt-2">
            Tip: If you want students to see only <b>PUBLISHED</b> calendars, ensure you publish calendar first.
          </div>
        </div>
      </div>

      {/* Day Details Modal (Bootstrap - no react-bootstrap needed) */}
      {dayModalOpen && (
        <>
          <div
            className="modal fade show"
            style={{ display: "block" }}
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <div className="modal-title fw-semibold">
                      Events on {toDDMMYYYY(dayModalDate)}
                    </div>
                    <div className="text-muted small">
                      {dayModalEvents.length} item(s)
                    </div>
                  </div>
                  <button type="button" className="btn-close" onClick={closeDayModal} />
                </div>

                <div className="modal-body">
                  {dayModalEvents.length === 0 ? (
                    <div className="text-muted">No events on this date.</div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {dayModalEvents.map((ev) => {
                        const dateText =
                          ev.start_date === ev.end_date
                            ? toDDMMYYYY(ev.start_date)
                            : `${toDDMMYYYY(ev.start_date)} - ${toDDMMYYYY(ev.end_date)}`;

                        return (
                          <div key={ev.id} className="border rounded-3 p-3">
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                              <div className="fw-semibold" style={{ fontSize: 16 }}>
                                {ev.title}
                              </div>
                              <span className={typeBadgeClass(ev.type)}>{ev.type}</span>
                              <div className="ms-auto text-muted small">{dateText}</div>
                            </div>

                            {ev.description && (
                              <div className="mt-2">{ev.description}</div>
                            )}

                            <div className="mt-2 d-flex flex-wrap gap-3 small">
                              <div>
                                <span className="text-muted">Scope:</span>{" "}
                                <span className="fw-semibold">{ev.class_scope || "ALL"}</span>
                              </div>

                              <div>
                                <span className="text-muted">Working Day:</span>{" "}
                                <span
                                  className={
                                    ev.is_working_day ? "badge bg-success" : "badge bg-danger"
                                  }
                                >
                                  {ev.is_working_day ? "YES" : "NO"}
                                </span>
                              </div>

                              {ev.exam_name && (
                                <div>
                                  <span className="text-muted">Exam:</span>{" "}
                                  <span className="fw-semibold">{ev.exam_name}</span>
                                </div>
                              )}

                              {(ev.start_time || ev.end_time) && (
                                <div>
                                  <span className="text-muted">Time:</span>{" "}
                                  <span className="fw-semibold">
                                    {ev.start_time || "-"} {ev.end_time ? `- ${ev.end_time}` : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeDayModal}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Backdrop */}
          <div
            className="modal-backdrop fade show"
            onClick={closeDayModal}
            role="button"
            tabIndex={-1}
          />
        </>
      )}
    </div>
  );
}
