import React, { useEffect, useState } from "react";
import api from "../api";
import { format, subMonths, addMonths } from "date-fns";
import "./EmployeeAttendanceCalendar.css";

const statusColors = {
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

const EmployeeAttendanceCalendar = () => {
  const [records, setRecords] = useState([]);
  const [month, setMonth] = useState(() => new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAttendance();
  }, [month]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const monthStr = format(month, "yyyy-MM");
      const res = await api.get(`/attendance/my-calendar?month=${monthStr}`);
      setRecords(res.data.records || []);
    } catch (err) {
      console.error("Error fetching attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusByDate = (dateStr) => {
    const record = records.find((r) => r.date === dateStr);
    return record?.status || "unmarked";
  };

  const getSummaryCounts = () => {
    const counts = {
      present: 0,
      absent: 0,
      leave: 0,
      unmarked: 0,
    };

    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = format(new Date(month.getFullYear(), month.getMonth(), d), "yyyy-MM-dd");
      const status = getStatusByDate(dateStr);
      if (counts[status] !== undefined) counts[status]++;
      else counts.unmarked++;
    }

    return counts;
  };

  const renderCalendarGrid = () => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayIndex = new Date(year, monthIndex, 1).getDay();

    const cells = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
    }

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, monthIndex, day);
      const dateStr = format(date, "yyyy-MM-dd");
      const status = getStatusByDate(dateStr);
      const color = statusColors[status] || "#ccc";

      cells.push(
        <div
          key={dateStr}
          className={`calendar-cell ${date.getDay() === 0 ? "sunday" : ""}`}
          style={{ borderLeft: `4px solid ${color}` }}
        >
          <div className="date-number">{day}</div>
          <div className="status-text" style={{ color }}>
            {status.replace(/-/g, " ")}
          </div>
        </div>
      );
    }

    return cells;
  };

  const { present, absent, leave, unmarked } = getSummaryCounts();

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h3>My Attendance Calendar</h3>
        <div className="month-nav">
          <button onClick={() => setMonth(subMonths(month, 1))}>&lsaquo;</button>
          <span>{format(month, "MMMM yyyy")}</span>
          <button onClick={() => setMonth(addMonths(month, 1))}>&rsaquo;</button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card" style={{ borderColor: statusColors.present }}>
          <strong>Present</strong>
          <span>{present}</span>
        </div>
        <div className="summary-card" style={{ borderColor: statusColors.absent }}>
          <strong>Absent</strong>
          <span>{absent}</span>
        </div>
        <div className="summary-card" style={{ borderColor: statusColors.leave }}>
          <strong>Leave</strong>
          <span>{leave}</span>
        </div>
        <div className="summary-card" style={{ borderColor: statusColors.unmarked }}>
          <strong>Unmarked</strong>
          <span>{unmarked}</span>
        </div>
      </div>

      {loading ? (
        <p>Loading attendance...</p>
      ) : (
        <div className="calendar-grid">
          <div className="day-label">Sun</div>
          <div className="day-label">Mon</div>
          <div className="day-label">Tue</div>
          <div className="day-label">Wed</div>
          <div className="day-label">Thu</div>
          <div className="day-label">Fri</div>
          <div className="day-label">Sat</div>
          {renderCalendarGrid()}
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendanceCalendar;
