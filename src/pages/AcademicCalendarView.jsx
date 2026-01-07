import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

/**
 * AcademicCalendarView.jsx (READ ONLY)
 * ✅ Anyone can view (student/teacher/hr/admin etc.)
 * ✅ Fetches latest PUBLISHED calendar (or by school/session filter)
 * ✅ Shows month summary
 * ✅ Shows events table + search + type filter
 * ✅ PDF button (blob -> open/download)
 *
 * API used:
 * - GET /academic-calendars   (expects list; we pick published/latest)
 * - GET /academic-calendars/:id (events included)
 * - GET /academic-calendars/summary-by-month?calendar_id=ID
 * - GET /academic-calendars/:id/pdf (blob)
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

      // If your backend supports status filter:
      // params.status = "PUBLISHED";

      const res = await api.get("/academic-calendars", { params });
      const rows = safeArr(res.data);

      // Prefer PUBLISHED first, then latest by start_date/id (your controller already orders by start_date DESC)
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

      // auto-select
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
    // re-fetch list when filters change
    fetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, session]);

  useEffect(() => {
    if (!selectedId) return;
    fetchCalendarById(selectedId);
    fetchSummaryByMonth(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

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

  return (
    <div className="container mt-4">
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
                We automatically show **PUBLISHED** first (if exists), otherwise latest.
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
                    <code>{typeof calendar.weekly_off === "string" ? calendar.weekly_off : JSON.stringify(calendar.weekly_off)}</code>
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
                <div className="fw-semibold">{calendar.createdBy?.name || calendar.createdBy?.username || "-"}</div>
                {calendar.status === "PUBLISHED" && (
                  <>
                    <div className="small text-muted mt-2">Published By</div>
                    <div className="fw-semibold">{calendar.publishedBy?.name || calendar.publishedBy?.username || "-"}</div>
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
          <span className="text-muted small">{events.length} items</span>
        </div>

        <div className="card-body">
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
                          <span className="badge bg-light text-dark border">{ev.type}</span>
                        </td>
                        <td>
                          <div className="fw-semibold">{ev.title}</div>
                          {ev.description && <div className="text-muted small">{ev.description}</div>}
                          {ev.exam_name && (
                            <div className="small">
                              <strong>Exam:</strong> {ev.exam_name}
                            </div>
                          )}
                        </td>
                        <td>{ev.class_scope || "ALL"}</td>
                        <td style={{ textAlign: "center" }}>
                          <span className={ev.is_working_day ? "badge bg-success" : "badge bg-danger"}>
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

          <div className="text-muted small mt-2">
            Tip: If you want students to see only **PUBLISHED** calendars, ensure you publish calendar first.
          </div>
        </div>
      </div>
    </div>
  );
}
