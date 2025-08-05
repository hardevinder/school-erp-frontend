import React, { useEffect, useState } from "react";
import api from "../api";
import "./EmployeeAttendanceSummary.css";

const statusColors = {
  present: "#28a745",
  absent: "#dc3545",
  leave: "#fd7e14",
  "first-half-leave": "#20c997",
  "second-half-leave": "#20c997",
  "short-leave": "#007bff",
  "half-day-without-pay": "#6f42c1",
  "full-day-leave": "#6c757d",
  unmarked: "#adb5bd",
};

const leaveStatuses = [
  "leave",
  "full-day-leave",
  "first-half-leave",
  "second-half-leave",
  "short-leave",
  "half-day-without-pay",
];

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EmployeeAttendanceSummary = () => {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState({});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employeeId && month) fetchAttendance();
  }, [employeeId, month]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      setEmployees(res.data.employees || []);
    } catch (err) {
      console.error("Error fetching employees", err);
    }
  };

  const fetchAttendance = async () => {
  setLoading(true);
  try {
    const res = await api.get(`/employee-attendance/employee-summary/${employeeId}?month=${month}`);
    setSummary(res.data.summary || {});
    setRecords(res.data.records || []);
  } catch (err) {
    console.error("Error fetching attendance summary", err);
  } finally {
    setLoading(false);
  }
};

  const changeMonth = (offset) => {
    const date = new Date(`${month}-01`);
    date.setMonth(date.getMonth() + offset);
    setMonth(date.toISOString().slice(0, 7));
  };

  const getStatusByDate = (dateStr) => {
    const found = records.find((r) => r.date === dateStr);
    return found ? found.status : "unmarked";
  };

  const renderCalendar = () => {
    const date = new Date(`${month}-01`);
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const firstDayIndex = new Date(year, monthIndex, 1).getDay();
    const totalDays = new Date(year, monthIndex + 1, 0).getDate();

    const cells = [];

    for (let dayName of daysOfWeek) {
      cells.push(
        <div key={`header-${dayName}`} className="calendar-header">
          {dayName}
        </div>
      );
    }

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${month}-${String(day).padStart(2, "0")}`;
      const status = getStatusByDate(dateStr);
      const color = statusColors[status] || "#ccc";

      const dateObj = new Date(dateStr);
      const isSunday = dateObj.getDay() === 0;

      cells.push(
        <div
          key={dateStr}
          className="calendar-cell"
          style={{ borderColor: color }}
        >
          <strong style={{ color: isSunday ? "red" : "#333" }}>{day}</strong>
          <div className="status" style={{ color }}>
            {status.replace(/-/g, " ")}
          </div>
        </div>
      );
    }

    return cells;
  };

  const totalDaysInMonth = new Date(month + "-01");
  const daysInMonth = new Date(totalDaysInMonth.getFullYear(), totalDaysInMonth.getMonth() + 1, 0).getDate();

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const leaveCount = records.filter((r) => leaveStatuses.includes(r.status)).length;
  const markedDates = records.map((r) => r.date);
  const unmarkedCount = daysInMonth - markedDates.length;

  return (
    <div className="attendance-summary-container">
      <h2 className="title">Employee Attendance Summary</h2>

      <div className="filters">
        <div className="filter-item">
          <label>Employee</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">-- Select Employee --</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.employee_id})
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Month</label>
          <div className="month-selector">
            <button onClick={() => changeMonth(-1)}>←</button>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button onClick={() => changeMonth(1)}>→</button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading attendance data...</p>
      ) : employeeId ? (
        <>
          {/* Top Summary Cards */}
          <div className="top-summary-cards">
            <div className="top-card total">
              <h4>Total Days</h4>
              <p>{daysInMonth}</p>
            </div>
            <div className="top-card present">
              <h4>Present</h4>
              <p>{presentCount}</p>
            </div>
            <div className="top-card absent">
              <h4>Absent</h4>
              <p>{absentCount}</p>
            </div>
            <div className="top-card leave">
              <h4>Leaves</h4>
              <p>{leaveCount}</p>
            </div>
            <div className="top-card unmarked">
              <h4>Unmarked</h4>
              <p>{unmarkedCount}</p>
            </div>
          </div>

          {/* Detailed Status Summary */}
          <div className="summary-cards">
            {Object.entries(summary).map(([status, count]) => (
              <div
                key={status}
                className="summary-card"
                style={{ borderLeft: `6px solid ${statusColors[status]}` }}
              >
                <div className="summary-label">{status.replace(/-/g, " ").toUpperCase()}</div>
                <div className="summary-count">{count} day(s)</div>
              </div>
            ))}
          </div>

          <div className="calendar-grid">{renderCalendar()}</div>
        </>
      ) : (
        <p className="placeholder-text">Please select an employee to view attendance.</p>
      )}
    </div>
  );
};

export default EmployeeAttendanceSummary;
