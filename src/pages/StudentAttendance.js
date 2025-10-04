// src/pages/StudentDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import socket from "../socket";
import axios from "axios";
import moment from "moment";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

/* ========================================================
   🎨 Lightweight styles (no extra libs)
   ======================================================== */
const Styles = () => (
  <style>{`
    :root {
      --grad-1: linear-gradient(135deg, #7b2ff7 0%, #f107a3 100%);
      --grad-2: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%);
      --grad-3: linear-gradient(135deg, #f7971e 0%, #ffd200 100%);
      --grad-4: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      --card-shadow: 0 10px 20px rgba(0,0,0,0.08);
      --soft: 16px;
    }
    .hero {
      background: var(--grad-1);
      color: #fff;
      border-radius: 24px;
      padding: 24px;
      box-shadow: var(--card-shadow);
    }
    .summary-card {
      border: 0;
      border-radius: var(--soft);
      box-shadow: var(--card-shadow);
      overflow: hidden;
      transform: translateZ(0);
    }
    .summary-card .card-body { padding: 18px; }
    .summary-total { background: var(--grad-2); }
    .summary-present { background: var(--grad-4); }
    .summary-absent { background: linear-gradient(135deg,#ff416c 0%,#ff4b2b 100%); }
    .summary-leave { background: var(--grad-3); }
    .summary-percent { background: linear-gradient(135deg,#8e2de2 0%,#4a00e0 100%); }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
    }
    .calendar-cell {
      min-height: 92px;
      border-radius: 12px;
      box-shadow: var(--card-shadow);
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.06);
      transition: transform .1s ease, box-shadow .2s ease;
      position: relative;
      overflow: hidden;
    }
    .calendar-cell:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0,0,0,0.08); }
    .cell-date { font-weight: 700; font-size: 14px; }
    .cell-sub { font-size: 11px; opacity: .95; }
    .legend-dot { width: 10px; height: 10px; display: inline-block; border-radius: 50%; margin-right: 6px; }

    /* Status backgrounds */
    .cell-present { background: #e8fff1; border-color: #b6f0cd; }
    .cell-absent  { background: #fff0f3; border-color: #ffc2cd; }
    .cell-leave   { background: #fff9e6; border-color: #ffe8a3; }
    .cell-sunday  { background: #eef5ff; border-color: #cfe0ff; }
    .cell-holiday { background: #fff6db; border-color: #ffe29a; }
    .cell-not-marked { background: #fff0f0; border-color: #ffd0d0; }

    .badge-holiday {
      position: absolute;
      top: 6px;
      right: 6px;
      font-size: 10px;
      background: #ffdd57;
      color: #333;
      border-radius: 999px;
      padding: 2px 8px;
      border: 1px solid rgba(0,0,0,.08);
    }

    /* Responsive tweaks */
    @media (max-width: 992px) {
      .calendar-cell { min-height: 80px; }
    }
    @media (max-width: 768px) {
      .calendar-grid { grid-template-columns: repeat(7, minmax(36px, 1fr)); gap: 4px; }
      .calendar-cell { min-height: 64px; border-radius: 10px; }
      .cell-sub { display: none; }
    }

    .chip {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.35);
      backdrop-filter: blur(6px);
      color: #fff;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      display: inline-flex; gap: 8px; align-items: center;
    }
    .btn-round { border-radius: 999px; padding: 8px 14px; }
    .btn-ghost { background: rgba(255,255,255,0.15); color: #fff; border: none; }

    .tab-btn { border-radius: 999px; }
  `}</style>
);

// 🔤 Friendly names for classes used across the UI
const classNames = {
  0: "Pre Nursery",
  1: "Nursery",
  2: "LKG",
  3: "UKG",
  4: "I",
  5: "II",
  6: "III",
  7: "IV",
  8: "V",
  9: "VI",
  10: "VII",
  11: "VIII",
  12: "IX",
  13: "X",
  18: "XI",
  19: "XII",
};

/* ========================================================
   Summary tiles
   ======================================================== */
const SummaryTile = ({ title, value, className }) => (
  <div className="col-6 col-sm-4 col-md-2 mb-3">
    <div className={`card text-white summary-card ${className}`}>
      <div className="card-body text-center">
        <div className="fw-semibold small text-uppercase opacity-75 mb-1">{title}</div>
        <div className="display-6 fw-bold">{value}</div>
      </div>
    </div>
  </div>
);

/* ========================================================
   Attendance Summary Cards
   ======================================================== */
const AttendanceSummaryCards = ({ attendanceRecords, currentMonth, studentName, studentClassName }) => {
  const monthlyRecords = attendanceRecords.filter((r) => moment(r.date).isSame(currentMonth, "month"));
  const presentCount = monthlyRecords.filter((r) => (r.status || "").toLowerCase() === "present").length;
  const absentCount  = monthlyRecords.filter((r) => (r.status || "").toLowerCase() === "absent").length;
  const leaveCount   = monthlyRecords.filter((r) => (r.status || "").toLowerCase() === "leave").length;
  const total = monthlyRecords.length;
  const percentPresence = total > 0 ? Math.round((presentCount / total) * 100) : 0;

  // if (total === 0) {
  //   return (
  //     <div className="alert alert-warning text-center mt-4 shadow-sm">
  //       Attendance not marked for {currentMonth.format("MMMM YYYY")} (Student: {studentName || "-"}, Class: {studentClassName || "-"}).
  //     </div>
  //   );
  // }

  return (
    <div className="row g-3 align-items-stretch mb-2">
      <SummaryTile title="Total" value={total} className="summary-total" />
      <SummaryTile title="Present" value={presentCount} className="summary-present" />
      <SummaryTile title="Absent" value={absentCount} className="summary-absent" />
      <SummaryTile title="Leave" value={leaveCount} className="summary-leave" />
      <div className="col-12 col-md-4 mb-3">
        <div className="card text-white summary-card summary-percent h-100">
          <div className="card-body d-flex flex-column justify-content-center text-center">
            <div className="fw-semibold small text-uppercase opacity-75 mb-1">% Presence</div>
            <div className="display-5 fw-bold">{percentPresence}%</div>
            <div className="small opacity-75">for {currentMonth.format("MMM YYYY")}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================================
   Attendance Pie
   ======================================================== */
const AttendanceSummaryChart = ({ attendanceRecords, currentMonth }) => {
  const monthlyRecords = attendanceRecords.filter((r) => moment(r.date).isSame(currentMonth, "month"));
  const presentCount = monthlyRecords.filter((r) => (r.status || "").toLowerCase() === "present").length;
  const absentCount  = monthlyRecords.filter((r) => (r.status || "").toLowerCase() === "absent").length;
  const leaveCount   = monthlyRecords.filter((r) => (r.status || "").toLowerCase() === "leave").length;

  const data = {
    labels: ["Present", "Absent", "Leave"],
    datasets: [{
      data: [presentCount, absentCount, leaveCount],
      backgroundColor: ["#28a745", "#dc3545", "#ffc107"],
      borderWidth: 0,
    }],
  };

  return (
    <div className="mt-4 p-3 bg-white rounded-4 shadow-sm">
      <Pie data={data} />
    </div>
  );
};

/* ========================================================
   📅 Student Calendar (with holiday fallback)
   ======================================================== */
const StudentCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [holidaysRaw, setHolidaysRaw] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [studentClassId, setStudentClassId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const token = localStorage.getItem("token");
  const API_URL = process.env.REACT_APP_API_URL;

  // Pull attendance + infer student's class & name
  const fetchAttendanceRecords = () => {
    if (!token) return;
    axios
      .get(`${API_URL}/attendance/student/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const records = res.data || [];
        setAttendanceRecords(records);
        if (records.length > 0) {
          setStudentClassId(records[0]?.student?.class_id ?? null);
          setStudentName(records[0]?.student?.name || "");
        }
      })
      .catch((error) => {
        console.error("Error fetching attendance:", error);
        Swal.fire("Error", "Could not fetch attendance records", "error");
      });
  };
  useEffect(() => { fetchAttendanceRecords(); }, [token]);

  // Pull holidays
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/holidays`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => setHolidaysRaw(response.data || []))
      .catch((error) => console.error("Error fetching holidays:", error));
  }, [token]);

  // Normalize / index holidays:
  // - Keyed by date (YYYY-MM-DD)
  // - Map of classId -> holiday object (keeps creator & description)
  // - Also a distinct list of descriptions for the "date"
  const holidays = useMemo(() => {
    const idx = {};
    (Array.isArray(holidaysRaw) ? holidaysRaw : []).forEach((h) => {
      const d = moment(h.date).format("YYYY-MM-DD");
      if (!idx[d]) idx[d] = { byClass: new Map(), descriptions: new Set(), rows: [] };
      const clsId = (h.class?.id ?? h.classId);
      idx[d].byClass.set(clsId, h);
      idx[d].descriptions.add((h.description || "").trim());
      idx[d].rows.push(h);
    });
    return idx;
  }, [holidaysRaw]);

  // First day selected = first day of month
  useEffect(() => {
    setSelectedDate(currentMonth.clone().startOf("month").format("YYYY-MM-DD"));
  }, [currentMonth]);

  // Socket live updates
  useEffect(() => {
    const handleAttendanceChange = () => fetchAttendanceRecords();
    socket.on("attendanceCreated", handleAttendanceChange);
    socket.on("attendanceUpdated", handleAttendanceChange);
    return () => {
      socket.off("attendanceCreated", handleAttendanceChange);
      socket.off("attendanceUpdated", handleAttendanceChange);
    };
  }, []);

  // Calendar grid
  const startOfMonthClone = currentMonth.clone().startOf("month");
  const endOfMonthClone = currentMonth.clone().endOf("month");
  const startDay = startOfMonthClone.day();
  const totalDays = endOfMonthClone.date();

  const calendarCells = [];
  for (let i = 0; i < startDay; i++) calendarCells.push(null);
  for (let day = 1; day <= totalDays; day++) calendarCells.push(moment(currentMonth).date(day));

  const dayHeader = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Helpers (with fallback)
  const getHolidayPayload = (dateStr) => holidays[dateStr] || null;

  /** Prefer exact class match; otherwise fall back to any holiday that day,
   * returning a row with merged descriptions so the day still shows as Holiday. */
  const getHolidayForDisplay = (dateStr, classId) => {
    const h = getHolidayPayload(dateStr);
    if (!h) return null;

    if (classId != null) {
      const direct = h.byClass.get(classId);
      if (direct) return direct;
    }

    // Fallback: use first row but merge descriptions for clarity
    const first = h.rows[0];
    return first
      ? {
          ...first,
          description: Array.from(h.descriptions).join(" • "),
        }
      : null;
  };

  const getCellClass = (cell, attendanceRecord, holidayForDisplay) => {
    if (holidayForDisplay) return "cell-holiday";
    if (!holidayForDisplay && cell.isAfter(moment(), "day")) return "";
    if (cell.day() === 0) return "cell-sunday";
    if (attendanceRecord) {
      switch ((attendanceRecord.status || "").toLowerCase()) {
        case "present": return "cell-present";
        case "absent":  return "cell-absent";
        case "leave":   return "cell-leave";
        default: return "";
      }
    }
    return "cell-not-marked";
  };

  const legend = (
    <div className="d-flex flex-wrap gap-3 small mt-3">
      <span><i className="legend-dot" style={{background:'#28a745'}}></i> Present</span>
      <span><i className="legend-dot" style={{background:'#dc3545'}}></i> Absent</span>
      <span><i className="legend-dot" style={{background:'#ffc107'}}></i> Leave</span>
      <span><i className="legend-dot" style={{background:'#d6e6ff'}}></i> Sunday</span>
      <span><i className="legend-dot" style={{background:'#ffe29a'}}></i> Holiday</span>
      <span><i className="legend-dot" style={{background:'#ffd0d0'}}></i> Not Marked</span>
    </div>
  );

  const monthPicker = (
    <input
      type="month"
      className="form-control form-control-sm w-auto"
      value={currentMonth.format("YYYY-MM")}
      onChange={(e) => setCurrentMonth(moment(e.target.value))}
    />
  );

  // Monthly holiday list (unique by date; allow fallback when no exact class match)
  const monthlyHolidayList = useMemo(() => {
    const start = currentMonth.clone().startOf("month");
    const end   = currentMonth.clone().endOf("month");
    const out = [];

    Object.entries(holidays).forEach(([dateStr, payload]) => {
      const d = moment(dateStr);
      if (d.isSameOrAfter(start, "day") && d.isSameOrBefore(end, "day")) {
        const exact = studentClassId != null ? payload.byClass.get(studentClassId) : null;
        if (exact) {
          out.push({
            date: dateStr,
            descriptions: Array.from(payload.descriptions),
            creators: payload.rows
              .filter(r => (r.class?.id ?? r.classId) === studentClassId)
              .map(r => r.creator?.name || r.creator?.email)
              .filter(Boolean),
          });
        } else if (payload.rows.length > 0) {
          // Fallback: show as date-level holiday with merged description
          out.push({
            date: dateStr,
            descriptions: Array.from(payload.descriptions),
            creators: payload.rows.map(r => r.creator?.name || r.creator?.email).filter(Boolean),
          });
        }
      }
    });

    return out.sort((a,b) => a.date.localeCompare(b.date));
  }, [holidays, currentMonth, studentClassId]);

  // Next upcoming holiday chip: prefer exact class, else any date with holiday rows
  const nextHoliday = useMemo(() => {
    const today = moment().format("YYYY-MM-DD");
    const candidates = Object.entries(holidays)
      .filter(([dateStr]) => dateStr >= today)
      .map(([dateStr, p]) => ({
        dateStr,
        exact: studentClassId != null ? !!p.byClass.get(studentClassId) : false,
        any: p.rows.length > 0,
      }))
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    return candidates.find(c => c.exact) || candidates.find(c => c.any) || null;
  }, [holidays, studentClassId]);

  return (
    <div className="container-fluid p-0">
      <Styles />

      <div className="hero mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="d-flex flex-column">
            <h2 className="mb-1 fw-bold">Attendance Calendar</h2>
            <div className="d-flex gap-2 flex-wrap">
              <span className="chip">Student: <strong>{studentName || "-"}</strong></span>
              <span className="chip">Class: <strong>{classNames[studentClassId] || studentClassId || '-'}</strong></span>
              <span className="chip">Month: <strong>{currentMonth.format("MMMM YYYY")}</strong></span>
              {nextHoliday && (
                <span className="chip">
                  🎉 Next holiday: <strong>{moment(nextHoliday.dateStr).format("DD MMM")}</strong>
                </span>
              )}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-ghost btn-round" onClick={() => setCurrentMonth(currentMonth.clone().subtract(1, "month"))}>◀ Prev</button>
            {monthPicker}
            <button className="btn btn-ghost btn-round" onClick={() => setCurrentMonth(currentMonth.clone().add(1, "month"))}>Next ▶</button>
          </div>
        </div>
      </div>

      <div className="container">
        <AttendanceSummaryCards
          attendanceRecords={attendanceRecords}
          currentMonth={currentMonth}
          studentName={studentName}
          studentClassName={classNames[studentClassId] || studentClassId}
        />

        <div className="row g-4">
          <div className="col-12 col-lg-8">
            <div className="bg-white p-2 p-sm-3 rounded-4 shadow-sm">
              <div className="calendar-grid">
                {dayHeader.map((d) => (
                  <div key={d} className="text-center fw-semibold p-2 bg-light rounded-3 border">{d}</div>
                ))}
                {calendarCells.map((cell, index) => {
                  if (cell === null) return <div key={index} className="rounded-3" />;

                  const dateStr = cell.format("YYYY-MM-DD");
                  const attendanceRecord = attendanceRecords.find((r) => r.date === dateStr);
                  const holidayForDisplay = getHolidayForDisplay(dateStr, studentClassId);

                  let label = "";
                  if (holidayForDisplay) label = holidayForDisplay.description || "Holiday";
                  else if (cell.day() === 0) label = "Sunday";
                  else if (cell.isAfter(moment(), "day")) label = "";
                  else if (attendanceRecord) label = (attendanceRecord.status || '').replace(/^./, c=>c.toUpperCase());
                  else label = "Not Marked";

                  const cls = getCellClass(cell, attendanceRecord, holidayForDisplay);
                  const title = holidayForDisplay
                    ? `${dateStr} – ${label}${holidayForDisplay.creator ? ` (by ${holidayForDisplay.creator.name || holidayForDisplay.creator.email})` : ""}`
                    : `${dateStr}${label ? " – " + label : ""}`;

                  return (
                    <div
                      key={index}
                      className={`calendar-cell p-2 text-center ${cls}`}
                      onClick={() => setSelectedDate(dateStr)}
                      role="button"
                      title={title}
                    >
                      <div className="cell-date">{cell.date()}</div>
                      {holidayForDisplay && <span className="badge-holiday">Holiday</span>}
                      {label && <div className="cell-sub">{label}</div>}
                    </div>
                  );
                })}
              </div>
              {legend}
            </div>
          </div>

          <div className="col-12 col-lg-4">
            {/* Right panel swaps between selected-day info and monthly holiday list */}
            {selectedDate ? (
              (() => {
                const h = getHolidayForDisplay(selectedDate, studentClassId);
                if (h) {
                  return (
                    <div className="alert alert-info mt-0 text-center rounded-4 shadow-sm">
                      <h5 className="mb-1">Holiday</h5>
                      <div className="small fw-semibold">{h.description}</div>
                      {h.creator && (
                        <div className="small mt-1 text-muted">
                          Posted by {h.creator.name || h.creator.email}
                        </div>
                      )}
                    </div>
                  );
                }
                return <AttendanceSummaryChart attendanceRecords={attendanceRecords} currentMonth={currentMonth} />;
              })()
            ) : (
              <div className="alert alert-info mt-0 rounded-4 shadow-sm">Please select a date to view details.</div>
            )}

            {/* Monthly Holidays List */}
            <div className="bg-white p-3 rounded-4 shadow-sm mt-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="m-0">Holidays in {currentMonth.format("MMM YYYY")}</h5>
                <span className="badge text-bg-secondary">{monthlyHolidayList.length}</span>
              </div>
              {monthlyHolidayList.length === 0 ? (
                <div className="text-muted small">No holidays for your class this month.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {monthlyHolidayList.map((h) => (
                    <li key={h.date} className="list-group-item d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-semibold">{moment(h.date).format("ddd, DD MMM")}</div>
                        <div className="small text-muted">{h.descriptions.join(" • ")}</div>
                        {h.creators && h.creators.length > 0 && (
                          <div className="small text-muted">by {Array.from(new Set(h.creators)).join(", ")}</div>
                        )}
                      </div>
                      <span className="badge rounded-pill text-bg-warning text-dark">Holiday</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================================
   📝 Student Leave Management (JS-safe preConfirm)
   ======================================================== */
const StudentLeaveManagement = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [newLeave, setNewLeave] = useState({ date: "", reason: "" });
  const token = localStorage.getItem("token");
  const API_URL = process.env.REACT_APP_API_URL;

  const fetchLeaveRequests = async () => {
    try {
      const response = await axios.get(`${API_URL}/leave/student/me`, { headers: { Authorization: `Bearer ${token}` } });
      setLeaveRequests(response.data || []);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      Swal.fire("Error", "Could not fetch leave requests", "error");
    }
  };
  useEffect(() => { fetchLeaveRequests(); }, [token]);

  const handleCreateLeave = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/leave`, newLeave, { headers: { Authorization: `Bearer ${token}` } });
      Swal.fire("Success", "Leave request submitted", "success");
      setNewLeave({ date: "", reason: "" });
      fetchLeaveRequests();
    } catch (error) {
      console.error("Error creating leave request", error);
      Swal.fire("Error", "Failed to create leave request", "error");
    }
  };

  const handleUpdateLeave = async (id) => {
    const leave = leaveRequests.find((l) => l.id === id);
    if (!leave) return;
    const { value: formValues } = await Swal.fire({
      title: "Update Leave Request",
      html:
        `<input id="swal-input1" class="swal2-input" type="date" value="${leave.date}">` +
        `<textarea id="swal-input2" class="swal2-textarea" placeholder="Reason">${leave.reason}</textarea>`,
      focusConfirm: false,
      preConfirm: () => {
        const dateEl = document.getElementById("swal-input1");
        const reasonEl = document.getElementById("swal-input2");
        const date = dateEl && dateEl.value ? dateEl.value : "";
        const reason = reasonEl && reasonEl.value ? reasonEl.value : "";
        return { date, reason };
      },
    });
    if (formValues) {
      try {
        await axios.put(`${API_URL}/leave/${id}`, formValues, { headers: { Authorization: `Bearer ${token}` } });
        Swal.fire("Success", "Leave request updated", "success");
        fetchLeaveRequests();
      } catch (error) {
        console.error("Error updating leave request", error);
        Swal.fire("Error", "Failed to update leave request", "error");
      }
    }
  };

  const handleDeleteLeave = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete your leave request.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });
    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/leave/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        Swal.fire("Deleted!", "Leave request has been deleted.", "success");
        fetchLeaveRequests();
      } catch (error) {
        console.error("Error deleting leave request", error);
        Swal.fire("Error", "Failed to delete leave request", "error");
      }
    }
  };

  return (
    <div className="container">
      <div className="hero mb-4" style={{background: 'var(--grad-2)'}}>
        <h2 className="m-0">Leave Management</h2>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <form onSubmit={handleCreateLeave} className="bg-white p-3 rounded-4 shadow-sm">
            <h5 className="mb-3">Request Leave</h5>
            <div className="mb-3">
              <label htmlFor="leaveDate" className="form-label">Date</label>
              <input
                type="date"
                id="leaveDate"
                className="form-control"
                value={newLeave.date}
                onChange={(e) => setNewLeave({ ...newLeave, date: e.target.value })}
                min={moment().format("YYYY-MM-DD")}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="leaveReason" className="form-label">Reason</label>
              <textarea
                id="leaveReason"
                className="form-control"
                rows={4}
                value={newLeave.reason}
                onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-round">Submit Leave Request</button>
          </form>
        </div>

        <div className="col-12 col-lg-7">
          <div className="bg-white p-3 rounded-4 shadow-sm">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="m-0">My Leave Requests</h5>
            </div>
            {leaveRequests.length === 0 ? (
              <p className="text-muted m-0">No leave requests found.</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map((req) => (
                      <tr key={req.id}>
                        <td>{moment(req.date).format("YYYY-MM-DD")}</td>
                        <td className="text-break" style={{maxWidth: '280px'}}>{req.reason}</td>
                        <td>
                          <span className={`badge rounded-pill ${req.status === 'accepted' ? 'text-bg-success' : req.status === 'rejected' ? 'text-bg-danger' : 'text-bg-warning text-dark'}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-warning me-2"
                            onClick={() => handleUpdateLeave(req.id)}
                            disabled={req.status === "accepted"}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteLeave(req.id)}
                            disabled={req.status === "accepted"}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================================
   Main StudentDashboard with tabs
   ======================================================== */
const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState("attendance");

  return (
    <div className="container my-4">
      <Styles />
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="fw-bold m-0">Student Dashboard</h1>
        <div className="btn-group" role="group" aria-label="Tabs">
          <button
            className={`btn btn-outline-primary tab-btn ${activeTab === "attendance" ? 'active' : ''}`}
            onClick={() => setActiveTab("attendance")}
          >
            Attendance
          </button>
          <button
            className={`btn btn-outline-primary tab-btn ${activeTab === "leave" ? 'active' : ''}`}
            onClick={() => setActiveTab("leave")}
          >
            Apply for Leave
          </button>
        </div>
      </div>

      <div className="tab-content mt-3">
        {activeTab === "attendance" && <StudentCalendar />}
        {activeTab === "leave" && <StudentLeaveManagement />}
      </div>
    </div>
  );
};

export default StudentDashboard;
