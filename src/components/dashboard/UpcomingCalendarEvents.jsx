import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import "./UpcomingCalendarEvents.css";

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.rows || value.items || value.results || value.data || [];
};

const safeJson = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const getSchoolId = () => {
  const stored =
    localStorage.getItem("schoolId") ||
    localStorage.getItem("school_id") ||
    localStorage.getItem("activeSchoolId") ||
    localStorage.getItem("selectedSchoolId");

  const userLike =
    safeJson(localStorage.getItem("user")) ||
    safeJson(localStorage.getItem("currentUser")) ||
    safeJson(localStorage.getItem("profile")) ||
    {};

  const raw = stored || userLike.schoolId || userLike.school_id || userLike.school?.id;
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const isoToday = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const shiftIso = (iso, days) => {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const prettyDate = (iso) => {
  if (!iso) return "Date not set";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const dateRange = (event) => {
  const start = String(event?.start_date || "").slice(0, 10);
  const end = String(event?.end_date || event?.start_date || "").slice(0, 10);
  if (!start) return "Date not set";
  return start === end ? prettyDate(start) : `${prettyDate(start)} – ${prettyDate(end)}`;
};

const typeMeta = (type) => {
  const key = String(type || "OTHER").toUpperCase();
  const map = {
    HOLIDAY: ["bi-sun", "red"],
    VACATION: ["bi-airplane", "violet"],
    EXAM: ["bi-journal-check", "amber"],
    PTM: ["bi-people", "blue"],
    ACTIVITY: ["bi-stars", "green"],
    EVENT: ["bi-calendar-event", "blue"],
    TRAINING: ["bi-mortarboard", "violet"],
    SYLLABUS_DEADLINE: ["bi-hourglass-split", "amber"],
    RESULT: ["bi-award", "green"],
    OTHER: ["bi-calendar3", "slate"],
  };
  return map[key] || map.OTHER;
};

const statusFor = (event, today) => {
  const start = String(event?.start_date || "").slice(0, 10);
  const end = String(event?.end_date || event?.start_date || "").slice(0, 10);
  if (start <= today && end >= today) return { label: "Today", tone: "today" };
  if (start > today) return { label: "Upcoming", tone: "upcoming" };
  return { label: "Recent", tone: "recent" };
};

const chooseCalendar = (rows, today) => {
  const list = [...rows];
  return (
    list.find((c) => String(c.status || "").toUpperCase() === "PUBLISHED" && c.start_date <= today && c.end_date >= today) ||
    list.find((c) => c.start_date <= today && c.end_date >= today) ||
    list.find((c) => String(c.status || "").toUpperCase() === "PUBLISHED") ||
    list[0] ||
    null
  );
};

export default function UpcomingCalendarEvents({
  refreshKey = 0,
  openPath = "/academic-calendar-view",
  managePath = "",
  maxItems = 6,
  title = "Upcoming Calendar Events",
  subtitle = "What is coming next in the current Academic Calendar.",
}) {
  const navigate = useNavigate();
  const [calendar, setCalendar] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const today = isoToday();
      const schoolId = getSchoolId();
      const params = { limit: 30 };
      if (schoolId) params.school_id = schoolId;

      let calendarRows = [];
      try {
        const publishedRes = await api.get("/academic-calendars", { params: { ...params, status: "PUBLISHED" } });
        calendarRows = asArray(publishedRes.data);
      } catch {
        calendarRows = [];
      }

      if (!calendarRows.length) {
        const allRes = await api.get("/academic-calendars", { params });
        calendarRows = asArray(allRes.data);
      }

      const selected = chooseCalendar(calendarRows, today);
      setCalendar(selected);
      if (!selected?.id) {
        setEvents([]);
        return;
      }

      const from = today;
      const to = shiftIso(today, 90);
      let eventRows = [];
      const scoped = await api.get(`/academic-calendars/${selected.id}/events`, { params: { from, to } });
      eventRows = asArray(scoped.data);

      // If the 90-day window is empty, load the calendar once more and keep only today/future entries.
      if (!eventRows.length) {
        const fallback = await api.get(`/academic-calendars/${selected.id}/events`);
        eventRows = asArray(fallback.data);
      }

      setEvents(eventRows);
    } catch (err) {
      console.error("UpcomingCalendarEvents load error:", err);
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Unable to load calendar events.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const visibleEvents = useMemo(() => {
    const today = isoToday();

    return events
      .filter((event) => {
        if (!event?.start_date) return false;
        const end = String(event?.end_date || event?.start_date || "").slice(0, 10);
        return end >= today;
      })
      .map((event) => ({ ...event, _status: statusFor(event, today) }))
      .sort((a, b) => {
        const aStart = String(a.start_date || "").slice(0, 10);
        const bStart = String(b.start_date || "").slice(0, 10);
        const aToday = a._status?.tone === "today" ? 0 : 1;
        const bToday = b._status?.tone === "today" ? 0 : 1;
        if (aToday !== bToday) return aToday - bToday;
        return aStart.localeCompare(bStart);
      })
      .slice(0, maxItems);
  }, [events, maxItems]);

  return (
    <section className="rce-shell mb-4">
      <div className="rce-head">
        <div>
          <div className="rce-kicker"><span className="rce-live-dot" /> Academic Calendar</div>
          <h5>{title}</h5>
          <p>{subtitle}</p>
        </div>
        <div className="rce-actions">
          {calendar?.academic_session ? <span className="rce-session">{calendar.academic_session}</span> : null}
          <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" onClick={load} disabled={loading}>
            <i className={`bi ${loading ? "bi-arrow-repeat rce-spin" : "bi-arrow-clockwise"} me-1`} /> Refresh
          </button>
          <button type="button" className="btn btn-sm btn-primary rounded-pill" onClick={() => navigate(openPath)}>
            View Calendar
          </button>
          {managePath ? (
            <button type="button" className="btn btn-sm btn-outline-primary rounded-pill" onClick={() => navigate(managePath)}>
              Manage
            </button>
          ) : null}
        </div>
      </div>

      {loading && !visibleEvents.length ? (
        <div className="rce-loading"><div className="spinner-border spinner-border-sm" /><span>Loading upcoming calendar events…</span></div>
      ) : error ? (
        <div className="rce-empty rce-error"><i className="bi bi-exclamation-circle" /><div><strong>Calendar events could not be loaded</strong><span>{error}</span></div></div>
      ) : !calendar ? (
        <div className="rce-empty"><i className="bi bi-calendar-x" /><div><strong>No Academic Calendar found</strong><span>Create or publish a calendar and its events will appear here automatically.</span></div></div>
      ) : visibleEvents.length ? (
        <div className="rce-grid">
          {visibleEvents.map((event) => {
            const [icon, tone] = typeMeta(event.type);
            const state = event._status || statusFor(event, isoToday());
            return (
              <button type="button" className={`rce-event rce-${tone} ${state.tone === "today" ? "rce-event-today" : ""}`} key={event.id} onClick={() => navigate(openPath)}>
                <span className="rce-icon"><i className={`bi ${icon}`} /></span>
                <span className="rce-copy">
                  <span className="rce-topline">
                    <span className={`rce-state rce-state-${state.tone}`}>{state.label}</span>
                    <span className="rce-type">{String(event.type || "Event").replaceAll("_", " ")}</span>
                  </span>
                  <strong>{event.title || "Calendar Event"}</strong>
                  <small><i className="bi bi-calendar3 me-1" />{dateRange(event)}</small>
                  {(event.start_time || event.class_scope) ? (
                    <em>
                      {event.start_time ? <span><i className="bi bi-clock me-1" />{event.start_time}{event.end_time ? `–${event.end_time}` : ""}</span> : null}
                      {event.class_scope ? <span><i className="bi bi-people me-1" />{event.class_scope}</span> : null}
                    </em>
                  ) : null}
                </span>
                <i className="bi bi-chevron-right rce-arrow" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rce-empty"><i className="bi bi-calendar-check" /><div><strong>No upcoming calendar events</strong><span>The current calendar is available, but there are no nearby dated events to show.</span></div></div>
      )}
    </section>
  );
}
