// src/pages/AcademicCalendar.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

/* ---------------- Role Helpers ---------------- */
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  const norm = roles.map((r) => String(r || "").toLowerCase());

  return {
    roles: norm,
    isAdmin: norm.includes("admin"),
    isSuperadmin: norm.includes("superadmin"),
    isFrontoffice: norm.includes("frontoffice"),
    isCoordinator:
      norm.includes("coordinator") ||
      norm.includes("academic_coordinator") ||
      norm.includes("academic coordinator"),
  };
};

const EVENT_TYPES = [
  "HOLIDAY",
  "VACATION",
  "EXAM",
  "PTM",
  "ACTIVITY",
  "EVENT",
  "TRAINING",
  "SYLLABUS_DEADLINE",
  "RESULT",
  "OTHER",
];

/* ---------------- Small Helpers ---------------- */
const toInputDate = (d) => {
  if (!d) return "";
  const s = String(d);
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const prettyDate = (d) => {
  if (!d) return "-";
  const dt = new Date(`${toInputDate(d)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const safeJsonParse = (s) => {
  try {
    if (!s || !String(s).trim()) return null;
    return JSON.parse(String(s));
  } catch {
    return "__INVALID__";
  }
};

const AcademicCalendar = () => {
  const { isAdmin, isSuperadmin, isFrontoffice, isCoordinator } = useMemo(getRoleFlags, []);
  const canUse = isAdmin || isSuperadmin || isFrontoffice || isCoordinator;

  /* ---------------- Lists / Masters ---------------- */
  const [schools, setSchools] = useState([]);

  /* ---------------- Calendars ---------------- */
  const [rows, setRows] = useState([]);
  const [loadingRows, setLoadingRows] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [session, setSession] = useState("");
  const [status, setStatus] = useState("");

  /* ---------------- Calendar Modal ---------------- */
  const [showCalModal, setShowCalModal] = useState(false);
  const [editingCal, setEditingCal] = useState(null);

  const emptyCalForm = {
    school_id: "",
    academic_session: "",
    title: "",
    start_date: "",
    end_date: "",
    weekly_off_json: "", // input as JSON string
    total_working_days: "",
    remarks: "",
  };

  const [calForm, setCalForm] = useState(emptyCalForm);

  /* ---------------- Events Drawer/Modal ---------------- */
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [activeCalendar, setActiveCalendar] = useState(null);

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [eventSearch, setEventSearch] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");

  const [showEventFormModal, setShowEventFormModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  const emptyEventForm = {
    type: "OTHER",
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    class_scope: "ALL",
    is_working_day: true,
    is_public_holiday: false,
    exam_name: "",
    meta_json: "",
  };

  const [eventForm, setEventForm] = useState(emptyEventForm);

  /* ---------------- Fetch Masters ---------------- */
  const fetchSchools = async () => {
    try {
      const res = await api.get("/schools", { params: { limit: 5000 } }).catch(() => ({ data: [] }));
      const list = Array.isArray(res.data) ? res.data : res.data?.rows || [];
      setSchools(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("fetchSchools error:", e);
      setSchools([]);
    }
  };

  /* ---------------- Fetch Calendars ---------------- */
  const fetchCalendars = async () => {
    if (!canUse) return;
    setLoadingRows(true);
    try {
      const params = {};
      if (schoolId) params.school_id = Number(schoolId);
      if (session) params.academic_session = String(session).trim();
      if (status) params.status = String(status).trim();
      if (q) params.q = String(q).trim();

      const res = await api.get("/academic-calendars", { params });
      const list = Array.isArray(res.data) ? res.data : res.data?.rows || [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("fetchCalendars error:", e);
      Swal.fire("Error", "Failed to fetch academic calendars.", "error");
    } finally {
      setLoadingRows(false);
    }
  };

  /* ---------------- Fetch Events (by calendar) ---------------- */
  const fetchEvents = async (calendarId) => {
    if (!calendarId) return;
    setLoadingEvents(true);
    try {
      // ✅ assumes routes: GET /academic-calendars/:calendar_id/events
      const params = {};
      if (eventTypeFilter) params.type = eventTypeFilter;
      if (eventSearch) params.q = eventSearch;

      const res = await api.get(`/academic-calendars/${Number(calendarId)}/events`, { params });
      const list = Array.isArray(res.data) ? res.data : res.data?.rows || [];
      setEvents(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("fetchEvents error:", e);
      setEvents([]);
      Swal.fire("Error", "Failed to fetch events.", "error");
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    if (!canUse) return;
    fetchSchools();
    fetchCalendars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Calendar Create / Edit ---------------- */
  const openAddCalendar = () => {
    setEditingCal(null);
    setCalForm(emptyCalForm);
    setShowCalModal(true);
  };

  const openEditCalendar = async (cal) => {
    setEditingCal(cal);
    setCalForm({
      school_id: cal.school_id ? String(cal.school_id) : "",
      academic_session: cal.academic_session || "",
      title: cal.title || "",
      start_date: toInputDate(cal.start_date),
      end_date: toInputDate(cal.end_date),
      weekly_off_json: cal.weekly_off ? JSON.stringify(cal.weekly_off, null, 2) : "",
      total_working_days: cal.total_working_days != null ? String(cal.total_working_days) : "",
      remarks: cal.remarks || "",
    });
    setShowCalModal(true);
  };

  const validateCalendarForm = () => {
    if (!String(calForm.academic_session || "").trim()) return "Academic session is required";
    if (!String(calForm.start_date || "").trim()) return "Start date is required";
    if (!String(calForm.end_date || "").trim()) return "End date is required";
    if (String(calForm.start_date) > String(calForm.end_date)) return "Start date cannot be after end date";

    if (calForm.weekly_off_json) {
      const parsed = safeJsonParse(calForm.weekly_off_json);
      if (parsed === "__INVALID__") return "Weekly off JSON is invalid";
    }
    return null;
  };

  const saveCalendar = async () => {
    try {
      const err = validateCalendarForm();
      if (err) return Swal.fire("Error", err, "error");

      const weeklyOffParsed = calForm.weekly_off_json ? safeJsonParse(calForm.weekly_off_json) : null;

      const payload = {
        school_id: calForm.school_id ? Number(calForm.school_id) : null,
        academic_session: String(calForm.academic_session).trim(),
        title: calForm.title ? String(calForm.title).trim() : null,
        start_date: calForm.start_date,
        end_date: calForm.end_date,
        weekly_off: weeklyOffParsed && weeklyOffParsed !== "__INVALID__" ? weeklyOffParsed : null,
        total_working_days: calForm.total_working_days ? Number(calForm.total_working_days) : null,
        remarks: calForm.remarks ? String(calForm.remarks) : null,
      };

      if (editingCal) {
        await api.put(`/academic-calendars/${editingCal.id}`, payload);
        Swal.fire("Updated!", "Academic calendar updated.", "success");
      } else {
        await api.post("/academic-calendars", payload);
        Swal.fire("Created!", "Academic calendar created.", "success");
      }

      setShowCalModal(false);
      setEditingCal(null);
      setCalForm(emptyCalForm);
      fetchCalendars();
    } catch (e) {
      console.error("saveCalendar error:", e);
      Swal.fire("Error", e?.response?.data?.error || "Failed to save calendar.", "error");
    }
  };

  /* ---------------- Publish / Unpublish / Delete ---------------- */
  const confirmAndDo = async ({ title, text, confirmText = "Yes", apiCall, successMsg }) => {
    const result = await Swal.fire({
      title,
      text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#0d6efd",
      confirmButtonText: confirmText,
      cancelButtonText: "No",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
    if (!result.isConfirmed) return;

    try {
      await apiCall();
      Swal.fire("Done!", successMsg, "success");
      fetchCalendars();
    } catch (e) {
      console.error("Action failed:", e);
      Swal.fire("Error", e?.response?.data?.error || "Action failed.", "error");
    }
  };

  const publishCalendar = (cal) =>
    confirmAndDo({
      title: "Publish calendar?",
      text: "After publish, editing will be blocked (until unpublish).",
      confirmText: "Publish",
      apiCall: () => api.post(`/academic-calendars/${cal.id}/publish`),
      successMsg: "Calendar published.",
    });

  const unpublishCalendar = (cal) =>
    confirmAndDo({
      title: "Unpublish calendar?",
      text: "This will move it back to DRAFT so you can edit again.",
      confirmText: "Unpublish",
      apiCall: () => api.post(`/academic-calendars/${cal.id}/unpublish`),
      successMsg: "Calendar moved to DRAFT.",
    });

  const deleteCalendar = (cal) =>
    confirmAndDo({
      title: "Delete calendar?",
      text: "This will also delete all events inside this calendar.",
      confirmText: "Delete",
      apiCall: () => api.delete(`/academic-calendars/${cal.id}`),
      successMsg: "Calendar deleted.",
    });

  /* ---------------- PDF ---------------- */
  const openCalendarPdf = async (cal) => {
    try {
      const resp = await api.get(`/academic-calendars/${cal.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `AcademicCalendar_${cal.academic_session || cal.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error("Calendar PDF error:", e);
      Swal.fire("Error", e?.response?.data?.error || "Failed to open PDF.", "error");
    }
  };

  /* ---------------- Events UI ---------------- */
  const openEvents = async (cal) => {
    setActiveCalendar(cal);
    setEvents([]);
    setEventSearch("");
    setEventTypeFilter("");
    setShowEventsModal(true);
    await fetchEvents(cal.id);
  };

  useEffect(() => {
    if (!showEventsModal || !activeCalendar?.id) return;
    fetchEvents(activeCalendar.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventTypeFilter]);

  const filteredEvents = useMemo(() => {
    const s = eventSearch.trim().toLowerCase();
    if (!s) return events;
    return events.filter((ev) => {
      const title = String(ev.title || "").toLowerCase();
      const desc = String(ev.description || "").toLowerCase();
      const type = String(ev.type || "").toLowerCase();
      const exam = String(ev.exam_name || "").toLowerCase();
      const scope = String(ev.class_scope || "").toLowerCase();
      return title.includes(s) || desc.includes(s) || type.includes(s) || exam.includes(s) || scope.includes(s);
    });
  }, [events, eventSearch]);

  const openAddEvent = () => {
    setEditingEvent(null);
    setEventForm({
      ...emptyEventForm,
      start_date: activeCalendar?.start_date ? toInputDate(activeCalendar.start_date) : "",
      end_date: activeCalendar?.start_date ? toInputDate(activeCalendar.start_date) : "",
    });
    setShowEventFormModal(true);
  };

  const openEditEvent = (ev) => {
    setEditingEvent(ev);
    setEventForm({
      type: ev.type || "OTHER",
      title: ev.title || "",
      description: ev.description || "",
      start_date: toInputDate(ev.start_date),
      end_date: toInputDate(ev.end_date),
      start_time: ev.start_time || "",
      end_time: ev.end_time || "",
      class_scope: ev.class_scope || "ALL",
      is_working_day: ev.is_working_day !== undefined ? !!ev.is_working_day : true,
      is_public_holiday: ev.is_public_holiday !== undefined ? !!ev.is_public_holiday : false,
      exam_name: ev.exam_name || "",
      meta_json: ev.meta ? JSON.stringify(ev.meta, null, 2) : "",
    });
    setShowEventFormModal(true);
  };

  const validateEventForm = () => {
    if (!activeCalendar?.id) return "No calendar selected";
    if (!String(eventForm.title || "").trim()) return "Event title is required";
    if (!String(eventForm.start_date || "").trim()) return "Start date is required";
    const end = eventForm.end_date || eventForm.start_date;
    if (String(eventForm.start_date) > String(end)) return "Start date cannot be after end date";

    if (eventForm.meta_json) {
      const parsed = safeJsonParse(eventForm.meta_json);
      if (parsed === "__INVALID__") return "Meta JSON is invalid";
    }
    return null;
  };

  const saveEvent = async () => {
    try {
      const err = validateEventForm();
      if (err) return Swal.fire("Error", err, "error");

      const metaParsed = eventForm.meta_json ? safeJsonParse(eventForm.meta_json) : null;

      const payload = {
        type: eventForm.type,
        title: String(eventForm.title).trim(),
        description: eventForm.description ? String(eventForm.description) : null,
        start_date: eventForm.start_date,
        end_date: eventForm.end_date || eventForm.start_date,
        start_time: eventForm.start_time || null,
        end_time: eventForm.end_time || null,
        class_scope: eventForm.class_scope || "ALL",
        is_working_day: !!eventForm.is_working_day,
        is_public_holiday: !!eventForm.is_public_holiday,
        exam_name: eventForm.exam_name || null,
        meta: metaParsed && metaParsed !== "__INVALID__" ? metaParsed : null,
      };

      if (editingEvent) {
        // ✅ assumes route: PUT /academic-calendars/events/:id
        await api.put(`/academic-calendars/events/${editingEvent.id}`, payload);
        Swal.fire("Updated!", "Event updated.", "success");
      } else {
        // ✅ assumes route: POST /academic-calendars/:calendar_id/events
        await api.post(`/academic-calendars/${Number(activeCalendar.id)}/events`, payload);
        Swal.fire("Created!", "Event added.", "success");
      }

      setShowEventFormModal(false);
      setEditingEvent(null);
      setEventForm(emptyEventForm);
      fetchEvents(activeCalendar.id);
    } catch (e) {
      console.error("saveEvent error:", e);
      Swal.fire("Error", e?.response?.data?.error || "Failed to save event.", "error");
    }
  };

  const deleteEvent = (ev) =>
    Swal.fire({
      title: "Delete event?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Delete",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        // ✅ assumes route: DELETE /academic-calendars/events/:id
        await api.delete(`/academic-calendars/events/${ev.id}`);
        Swal.fire("Deleted!", "Event deleted.", "success");
        fetchEvents(activeCalendar.id);
      } catch (e) {
        console.error("deleteEvent error:", e);
        Swal.fire("Error", e?.response?.data?.error || "Failed to delete event.", "error");
      }
    });

  if (!canUse) {
    return (
      <div className="container mt-4">
        <h1>Academic Calendar</h1>
        <div className="alert alert-warning">You don’t have access to Academic Calendar module.</div>
      </div>
    );
  }

  const statusBadge = (st) => {
    const s = String(st || "").toUpperCase();
    if (s === "PUBLISHED") return "badge bg-success";
    if (s === "ARCHIVED") return "badge bg-secondary";
    return "badge bg-primary";
  };

  const schoolNameById = (id) => {
    const s = schools.find((x) => Number(x.id) === Number(id));
    return s?.name || `School #${id}`;
  };

  return (
    <div className="container mt-4">
      <h1>Academic Calendar</h1>

      {/* Top actions */}
      <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
        <button className="btn btn-success" onClick={openAddCalendar}>
          Create Calendar
        </button>

        <button className="btn btn-outline-secondary" onClick={fetchCalendars} disabled={loadingRows}>
          {loadingRows ? "Loading..." : "Refresh"}
        </button>

        <div style={{ flex: 1 }} />

        <select className="form-select" style={{ width: 220 }} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">All Schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || `School ${s.id}`}
            </option>
          ))}
        </select>

        <input
          className="form-control"
          style={{ width: 200 }}
          placeholder="Academic Session (e.g. 2026-27)"
          value={session}
          onChange={(e) => setSession(e.target.value)}
        />

        <select className="form-select" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>

        <input
          className="form-control"
          style={{ width: 320 }}
          placeholder="Search title / session..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <button className="btn btn-outline-primary" onClick={fetchCalendars} disabled={loadingRows}>
          Apply
        </button>
      </div>

      {/* Calendars table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>School</th>
            <th>Session</th>
            <th>Title</th>
            <th>Dates</th>
            <th>Status</th>
            <th style={{ width: 430 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((cal, idx) => {
            const canEdit = String(cal.status || "").toUpperCase() !== "PUBLISHED";
            const canPublish = String(cal.status || "").toUpperCase() !== "PUBLISHED";
            const canUnpublish = String(cal.status || "").toUpperCase() === "PUBLISHED";

            return (
              <tr key={cal.id}>
                <td>{idx + 1}</td>
                <td>{cal.school_id ? schoolNameById(cal.school_id) : "—"}</td>
                <td>{cal.academic_session || "-"}</td>
                <td title={cal.title || ""} style={{ maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {cal.title || "—"}
                </td>
                <td>
                  {prettyDate(cal.start_date)} → {prettyDate(cal.end_date)}
                </td>
                <td>
                  <span className={statusBadge(cal.status)}>{String(cal.status || "DRAFT")}</span>
                </td>
                <td>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn btn-outline-dark btn-sm" onClick={() => openCalendarPdf(cal)}>
                      PDF
                    </button>

                    <button className="btn btn-outline-info btn-sm" onClick={() => openEvents(cal)}>
                      Events
                    </button>

                    <button className="btn btn-primary btn-sm" onClick={() => openEditCalendar(cal)} disabled={!canEdit}>
                      Edit
                    </button>

                    <button className="btn btn-outline-success btn-sm" onClick={() => publishCalendar(cal)} disabled={!canPublish}>
                      Publish
                    </button>

                    <button className="btn btn-outline-warning btn-sm" onClick={() => unpublishCalendar(cal)} disabled={!canUnpublish}>
                      Unpublish
                    </button>

                    <button className="btn btn-outline-danger btn-sm" onClick={() => deleteCalendar(cal)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center">
                {loadingRows ? "Loading…" : "No calendars found"}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ---------------- Calendar Modal ---------------- */}
      {showCalModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingCal ? "Edit Academic Calendar" : "Create Academic Calendar"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowCalModal(false)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-lg-4">
                    <label className="form-label">School</label>
                    <select
                      className="form-select"
                      value={calForm.school_id}
                      onChange={(e) => setCalForm((p) => ({ ...p, school_id: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                    >
                      <option value="">-- (Optional) Select School --</option>
                      {schools.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || `School ${s.id}`}
                        </option>
                      ))}
                    </select>
                    <div className="form-text">If multi-school, select school. Otherwise leave blank.</div>
                  </div>

                  <div className="col-12 col-lg-4">
                    <label className="form-label">Academic Session *</label>
                    <input
                      className="form-control"
                      placeholder="e.g. 2026-2027"
                      value={calForm.academic_session}
                      onChange={(e) => setCalForm((p) => ({ ...p, academic_session: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                    />
                  </div>

                  <div className="col-12 col-lg-4">
                    <label className="form-label">Title</label>
                    <input
                      className="form-control"
                      placeholder="Academic Calendar 2026-27"
                      value={calForm.title}
                      onChange={(e) => setCalForm((p) => ({ ...p, title: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={calForm.start_date}
                      onChange={(e) => setCalForm((p) => ({ ...p, start_date: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={calForm.end_date}
                      onChange={(e) => setCalForm((p) => ({ ...p, end_date: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">Total Working Days</label>
                    <input
                      type="number"
                      className="form-control"
                      value={calForm.total_working_days}
                      onChange={(e) => setCalForm((p) => ({ ...p, total_working_days: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                      min={0}
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">Status</label>
                    <input
                      className="form-control"
                      value={editingCal?.status || "DRAFT"}
                      disabled
                      title="Publish/unpublish using buttons in list."
                    />
                    <div className="form-text">Publish/unpublish from the list actions.</div>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Weekly Off (JSON)</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder='e.g. {"sun": true, "sat": false, "second_sat": true, "fourth_sat": false}'
                      value={calForm.weekly_off_json}
                      onChange={(e) => setCalForm((p) => ({ ...p, weekly_off_json: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                    />
                    <div className="form-text">Optional. Leave empty if not used.</div>
                  </div>

                  <div className="col-12">
                    <label className="form-label">Remarks</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={calForm.remarks}
                      onChange={(e) => setCalForm((p) => ({ ...p, remarks: e.target.value }))}
                      disabled={editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED"}
                    />
                  </div>

                  {editingCal && String(editingCal.status || "").toUpperCase() === "PUBLISHED" && (
                    <div className="col-12">
                      <div className="alert alert-info mb-0">
                        This calendar is <b>PUBLISHED</b>. Unpublish it first to edit.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCalModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveCalendar}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Events Modal ---------------- */}
      {showEventsModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-0">Calendar Events</h5>
                  <div className="text-muted" style={{ fontSize: 13 }}>
                    {activeCalendar?.title || "—"}{" "}
                    {activeCalendar?.academic_session ? `(${activeCalendar.academic_session})` : ""}
                    {activeCalendar?.status ? ` • ${activeCalendar.status}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setShowEventsModal(false);
                    setActiveCalendar(null);
                    setEvents([]);
                  }}
                />
              </div>

              <div className="modal-body">
                {/* Events toolbar */}
                <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
                  <button
                    className="btn btn-success"
                    onClick={openAddEvent}
                    disabled={String(activeCalendar?.status || "").toUpperCase() === "PUBLISHED"}
                    title={String(activeCalendar?.status || "").toUpperCase() === "PUBLISHED" ? "Unpublish to edit events" : ""}
                  >
                    Add Event
                  </button>

                  <button className="btn btn-outline-secondary" onClick={() => fetchEvents(activeCalendar?.id)} disabled={loadingEvents}>
                    {loadingEvents ? "Loading..." : "Refresh"}
                  </button>

                  <div style={{ flex: 1 }} />

                  <select
                    className="form-select"
                    style={{ width: 200 }}
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                  >
                    <option value="">All Types</option>
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  <input
                    className="form-control"
                    style={{ width: 360 }}
                    placeholder="Search title / description / scope / exam..."
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                  />
                </div>

                {/* Events table */}
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Dates</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Scope</th>
                      <th>Working</th>
                      <th style={{ width: 220 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev, idx) => (
                      <tr key={ev.id}>
                        <td>{idx + 1}</td>
                        <td>
                          {prettyDate(ev.start_date)}
                          {ev.end_date && ev.end_date !== ev.start_date ? ` → ${prettyDate(ev.end_date)}` : ""}
                        </td>
                        <td>{ev.type}</td>
                        <td title={ev.description || ""} style={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <b>{ev.title}</b>
                          {ev.exam_name ? <span className="text-muted"> • {ev.exam_name}</span> : null}
                        </td>
                        <td>{ev.class_scope || "ALL"}</td>
                        <td>
                          <span className={ev.is_working_day ? "badge bg-success" : "badge bg-danger"}>
                            {ev.is_working_day ? "YES" : "NO"}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => openEditEvent(ev)}
                              disabled={String(activeCalendar?.status || "").toUpperCase() === "PUBLISHED"}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => deleteEvent(ev)}
                              disabled={String(activeCalendar?.status || "").toUpperCase() === "PUBLISHED"}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredEvents.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center">
                          {loadingEvents ? "Loading…" : "No events found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {String(activeCalendar?.status || "").toUpperCase() === "PUBLISHED" && (
                  <div className="alert alert-info mb-0">
                    This calendar is <b>PUBLISHED</b>. Unpublish it to add/edit/delete events.
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowEventsModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Event Form Modal ---------------- */}
      {showEventFormModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{editingEvent ? "Edit Event" : "Add Event"}</h5>
                <button type="button" className="btn-close" onClick={() => setShowEventFormModal(false)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12 col-lg-3">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={eventForm.type} onChange={(e) => setEventForm((p) => ({ ...p, type: e.target.value }))}>
                      {EVENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-12 col-lg-6">
                    <label className="form-label">Title *</label>
                    <input
                      className="form-control"
                      value={eventForm.title}
                      onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Independence Day Celebration"
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">Scope</label>
                    <input
                      className="form-control"
                      value={eventForm.class_scope}
                      onChange={(e) => setEventForm((p) => ({ ...p, class_scope: e.target.value }))}
                      placeholder="ALL / CLASS_1 / CLASS_1,CLASS_2"
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={eventForm.description}
                      onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Optional details..."
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={eventForm.start_date}
                      onChange={(e) => setEventForm((p) => ({ ...p, start_date: e.target.value, end_date: eventForm.end_date || e.target.value }))}
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={eventForm.end_date}
                      onChange={(e) => setEventForm((p) => ({ ...p, end_date: e.target.value }))}
                    />
                    <div className="form-text">Leave blank for single-day event.</div>
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">Start Time</label>
                    <input
                      className="form-control"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm((p) => ({ ...p, start_time: e.target.value }))}
                      placeholder="HH:mm"
                    />
                  </div>

                  <div className="col-12 col-lg-3">
                    <label className="form-label">End Time</label>
                    <input
                      className="form-control"
                      value={eventForm.end_time}
                      onChange={(e) => setEventForm((p) => ({ ...p, end_time: e.target.value }))}
                      placeholder="HH:mm"
                    />
                  </div>

                  <div className="col-12 col-lg-4">
                    <label className="form-label">Working Day?</label>
                    <select
                      className="form-select"
                      value={eventForm.is_working_day ? "1" : "0"}
                      onChange={(e) => setEventForm((p) => ({ ...p, is_working_day: e.target.value === "1" }))}
                    >
                      <option value="1">YES</option>
                      <option value="0">NO</option>
                    </select>
                  </div>

                  <div className="col-12 col-lg-4">
                    <label className="form-label">Public Holiday?</label>
                    <select
                      className="form-select"
                      value={eventForm.is_public_holiday ? "1" : "0"}
                      onChange={(e) => setEventForm((p) => ({ ...p, is_public_holiday: e.target.value === "1" }))}
                    >
                      <option value="0">NO</option>
                      <option value="1">YES</option>
                    </select>
                  </div>

                  <div className="col-12 col-lg-4">
                    <label className="form-label">Exam Name</label>
                    <input
                      className="form-control"
                      value={eventForm.exam_name}
                      onChange={(e) => setEventForm((p) => ({ ...p, exam_name: e.target.value }))}
                      placeholder="Unit Test / Half Yearly / Annual..."
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">Meta (JSON)</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={eventForm.meta_json}
                      onChange={(e) => setEventForm((p) => ({ ...p, meta_json: e.target.value }))}
                      placeholder='Optional JSON e.g. {"venue":"Auditorium","chief_guest":"..."}'
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowEventFormModal(false)}>
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveEvent}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
