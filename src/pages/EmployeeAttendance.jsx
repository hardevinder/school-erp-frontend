import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./EmployeeAttendance.css";

export default function EmployeeAttendance() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selectedDept, setSelectedDept] = useState("all");

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState({}); // { [empId]: {status, remarks, in_time, out_time} }
  const [attendanceOptions, setAttendanceOptions] = useState([]);

  // Bulk time controls
  const [bulkInTime, setBulkInTime] = useState("");
  const [bulkOutTime, setBulkOutTime] = useState("");

  // Modal calendar state
  const [showCal, setShowCal] = useState(false);
  const [calEmployee, setCalEmployee] = useState(null); // {id, name}
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calRecords, setCalRecords] = useState([]); // [{date,status,remarks,in_time,out_time}]
  const [calSummary, setCalSummary] = useState(null); // { counts, meta, derived, ui }

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchMarkedAttendance(date);
  }, [date]);

  useEffect(() => {
    fetchAttendanceOptions();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      const all = res.data.employees || [];
      setEmployees(all);
      setFiltered(all);
      const uniqueDepts = [...new Set(all.map((e) => e.department?.name).filter(Boolean))];
      setDepartments(uniqueDepts);
    } catch {
      Swal.fire("Error", "Failed to fetch employees", "error");
    }
  };

  const fetchAttendanceOptions = async () => {
    try {
      const res = await api.get("/employee-leave-types");
      const formatted = (res.data.data || []).map((type) => ({
        value: type.name.toLowerCase().replace(/\s+/g, "_"),
        label: type.name,
        abbr: type.abbreviation || type.name.slice(0, 2).toUpperCase(),
        color: "#6c757d",
      }));
      formatted.unshift({ value: "present", label: "Present", abbr: "P", color: "#28a745" });
      formatted.unshift({ value: "absent", label: "Absent", abbr: "A", color: "#dc3545" });
      setAttendanceOptions(formatted);
    } catch {
      Swal.fire("Error", "Failed to fetch attendance types", "error");
    }
  };

  const fetchMarkedAttendance = async (selectedDate) => {
    try {
      const res = await api.get(`/employee-attendance?date=${selectedDate}`);
      const existing = res.data.records || [];
      const mapped = {};
      for (const entry of existing) {
        mapped[entry.employee_id] = {
          status: entry.status,
          remarks: entry.remarks,
          in_time: entry.in_time || "",
          out_time: entry.out_time || "",
        };
      }
      setAttendance(mapped);
    } catch (err) {
      console.error("fetchMarkedAttendance error:", err);
      Swal.fire("Error", "Failed to fetch existing attendance", "error");
    }
  };

  const handleDateChange = (newDate) => {
    const today = new Date().toISOString().split("T")[0];
    const selected = new Date(newDate);
    if (newDate > today) {
      Swal.fire("Warning", "Cannot mark attendance for future dates", "warning");
      return;
    }
    if (selected.getDay() === 0) {
      Swal.fire("Note", "Selected date is Sunday. Please confirm if attendance is required.", "info");
    }
    setDate(newDate);
  };

  const handleChange = (id, field, value) => {
    setAttendance((prev) => ({
      ...prev,
      [id]: {
        status: prev[id]?.status || "",
        remarks: prev[id]?.remarks || "",
        in_time: prev[id]?.in_time || "",
        out_time: prev[id]?.out_time || "",
        [field]: value,
      },
    }));
  };

  const handleDeptFilter = (dept) => {
    setSelectedDept(dept);
    setFiltered(dept === "all" ? employees : employees.filter((e) => e.department?.name === dept));
  };

  const markAllPresent = () => {
    const updated = { ...attendance };
    filtered.forEach((emp) => {
      updated[emp.id] = { ...(updated[emp.id] || {}), status: "present" };
    });
    setAttendance(updated);
  };

  const applyBulkTimes = () => {
    if (!bulkInTime && !bulkOutTime) {
      Swal.fire("Info", "Set at least one of In/Out time to apply.", "info");
      return;
    }
    const updated = { ...attendance };
    filtered.forEach((emp) => {
      updated[emp.id] = {
        status: updated[emp.id]?.status || "",
        remarks: updated[emp.id]?.remarks || "",
        in_time: bulkInTime || updated[emp.id]?.in_time || "",
        out_time: bulkOutTime || updated[emp.id]?.out_time || "",
      };
    });
    setAttendance(updated);
    Swal.fire("Applied", "Bulk times applied to visible employees.", "success");
  };

  const clearBulkTimes = () => {
    const updated = { ...attendance };
    filtered.forEach((emp) => {
      if (updated[emp.id]) {
        updated[emp.id] = { ...updated[emp.id], in_time: "", out_time: "" };
      }
    });
    setAttendance(updated);
    setBulkInTime("");
    setBulkOutTime("");
  };

  const handleSubmit = async () => {
    const payload = {
      date,
      attendances: Object.entries(attendance).map(([employee_id, info]) => ({
        employee_id: parseInt(employee_id, 10),
        status: info.status || null,
        remarks: info.remarks || "",
        in_time: info.in_time || null,
        out_time: info.out_time || null,
      })),
    };
    try {
      const res = await api.post("/employee-attendance/mark", payload);
      Swal.fire("Success", res.data.message, "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to mark attendance", "error");
    }
  };

  const counts = Object.values(attendance).reduce((acc, { status }) => {
    if (!status) return acc;
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  // ── Calendar Modal handlers ─────────────────────────────
  const openCalendar = (emp) => {
    setCalEmployee({ id: emp.id, name: emp.name });
    const d = new Date(date);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setCalMonth(m);
    setShowCal(true);
  };

  useEffect(() => {
    const fetchEmpMonth = async () => {
      if (!showCal || !calEmployee?.id || !calMonth) return;
      try {
        const res = await api.get(`/employee-attendance/summary/${calEmployee.id}?month=${calMonth}`);
        const rows = (res.data.records || []).map((r) => ({
          ...r,
          status: typeof r.status === "string" ? r.status.replace(/_/g, "-") : r.status,
        }));
        setCalRecords(rows);

        // Build a robust summary that works with either shape
        const apiCounts = res.data.counts || res.data.summary || {};
        const apiMeta = res.data.meta || {};
        const apiDerived = res.data.derived || {};
        const [yearStr, monStr] = calMonth.split("-");
        const year = parseInt(yearStr, 10);
        const monIdx = parseInt(monStr, 10) - 1;
        const daysInMonth = new Date(year, monIdx + 1, 0).getDate();

        // Sundays
        let sundays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          if (new Date(year, monIdx, d).getDay() === 0) sundays++;
        }

        const holidays = typeof apiMeta.holidays === "number" ? apiMeta.holidays : 0;
        const workingDays =
          typeof apiMeta.working_days === "number"
            ? apiMeta.working_days
            : daysInMonth - sundays - holidays;

        const uniqueDates = new Set(rows.map((r) => r.date)).size;
        const unmarkedDays = Math.max(0, workingDays - uniqueDates);

        // Breakdown
        const firstHalf = apiCounts.first_half_day_leave || 0;
        const secondHalf = apiCounts.second_half_day_leave || 0;
        const halfNoPay = apiCounts.half_day_without_pay || 0;
        const halfDays = firstHalf + secondHalf + halfNoPay;

        const leavesFull = (apiCounts.leave || 0) + (apiCounts.full_day_leave || 0);
        const present = apiCounts.present || 0;
        const absent = apiCounts.absent || 0;
        const shortLeave = apiCounts.short_leave || 0;

        const leaveDaysEquiv =
          apiDerived.leave_days_equiv ??
          (leavesFull + 0.5 * halfDays + 0.25 * shortLeave);

        setCalSummary({
          counts: apiCounts,
          meta: {
            calendar_days: apiMeta.calendar_days ?? daysInMonth,
            sundays: apiMeta.sundays ?? sundays,
            holidays,
            working_days: workingDays,
          },
          derived: {
            half_days_count: apiDerived.half_days_count ?? halfDays,
            half_day_equiv_days: apiDerived.half_day_equiv_days ?? halfDays * 0.5,
            leave_days_equiv: leaveDaysEquiv,
            absent_days: apiDerived.absent_days ?? absent,
          },
          ui: {
            workingDays,
            present,
            absents: absent,
            leavesFull,
            halfDays,
            shortLeave,
            unmarkedDays,
            leaveDaysEquiv,
          },
        });
      } catch (e) {
        console.error(e);
        Swal.fire("Error", "Failed to load employee calendar", "error");
      }
    };
    fetchEmpMonth();
  }, [showCal, calEmployee, calMonth]);

  return (
    <div className="container py-3">
      {/* Top toolbar */}
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label mb-1">Date</label>
            <input
              type="date"
              className="form-control"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label mb-1">Department</label>
            <select
              className="form-select"
              value={selectedDept}
              onChange={(e) => handleDeptFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label mb-1">Bulk In</label>
            <input
              type="time"
              className="form-control"
              value={bulkInTime}
              onChange={(e) => setBulkInTime(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label mb-1">Bulk Out</label>
            <input
              type="time"
              className="form-control"
              value={bulkOutTime}
              onChange={(e) => setBulkOutTime(e.target.value)}
            />
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={handleSubmit}>
            Submit Attendance
          </button>
          <button className="btn btn-success" onClick={markAllPresent}>
            Mark All Present
          </button>
          <button className="btn btn-outline-primary" onClick={applyBulkTimes}>
            Apply Bulk Times
          </button>
          <button className="btn btn-outline-secondary" onClick={clearBulkTimes}>
            Clear Times
          </button>
        </div>
      </div>

      {/* Status counters */}
      <div className="row mb-3 g-2">
        {attendanceOptions.map((opt) => (
          <div key={opt.value} className="col-6 col-md-3">
            <div className="card text-white shadow-sm" style={{ backgroundColor: opt.color }}>
              <div className="card-body py-2 d-flex justify-content-between align-items-center">
                <span>{opt.label}</span>
                <span className="fw-bold fs-5">{counts[opt.value] || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scroll container with sticky headers */}
      <div className="table-scroll">
        <table className="table table-bordered table-sm align-middle table-sticky">
          <thead>
            <tr>
              <th style={{ width: 56 }}>#</th>
              <th style={{ minWidth: 220 }}>Name</th>
              <th style={{ minWidth: 160 }}>Department</th>
              <th style={{ minWidth: 240 }}>Status</th>
              <th style={{ minWidth: 160 }}>In</th>
              <th style={{ minWidth: 160 }}>Out</th>
              <th style={{ minWidth: 240 }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, idx) => {
              const rec = attendance[emp.id] || {};
              return (
                <tr key={emp.id}>
                  <td>{idx + 1}</td>

                  {/* Clickable name opens modal */}
                  <td>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-decoration-none"
                      onClick={() => openCalendar(emp)}
                      title="View monthly attendance"
                    >
                      {emp.name}
                    </button>
                  </td>

                  <td>{emp.department?.name || "-"}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      {attendanceOptions.map((opt) => (
                        <div className="form-check form-check-inline" key={opt.value}>
                          <input
                            className="form-check-input"
                            type="radio"
                            name={`status-${emp.id}`}
                            value={opt.value}
                            checked={rec.status === opt.value}
                            onChange={() => handleChange(emp.id, "status", opt.value)}
                          />
                          <label className="form-check-label">{opt.abbr}</label>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      value={rec.in_time || ""}
                      onChange={(e) => handleChange(emp.id, "in_time", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="form-control form-control-sm"
                      value={rec.out_time || ""}
                      onChange={(e) => handleChange(emp.id, "out_time", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={rec.remarks || ""}
                      onChange={(e) => handleChange(emp.id, "remarks", e.target.value)}
                      placeholder="Optional remarks"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Optional bottom submit */}
      <div className="d-flex gap-2 mt-3">
        <button className="btn btn-primary" onClick={handleSubmit}>
          Submit Attendance
        </button>
      </div>

      {/* Attendance Calendar Modal */}
      {showCal && (
        <CalendarModal
          onClose={() => setShowCal(false)}
          employee={calEmployee}
          month={calMonth}
          onMonthChange={setCalMonth}
          records={calRecords}
          summary={calSummary}
        />
      )}
    </div>
  );
}

/* ---------- Modal Component (inline for convenience) ---------- */
function CalendarModal({ onClose, employee, month, onMonthChange, records, summary }) {
  // Build a quick date → record map
  const recMap = new Map();
  for (const r of records) if (r?.date) recMap.set(r.date, r);

  const monthDate = new Date(`${month}-01T00:00:00`);
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay()); // Sunday start
  const cells = 42; // 6 weeks

  const colorFor = (status) => {
    const map = {
      present: "#4CAF50",
      absent: "#F44336",
      leave: "#FF9800",
      "half-day-without-pay": "#9C27B0",
      "short-leave": "#2196F3",
      "first-half-day-leave": "#009688",
      "second-half-day-leave": "#00BCD4",
      "full-day-leave": "#9E9E9E",
      unmarked: "#BDBDBD",
    };
    return map[status] || "#BDBDBD";
  };

  const fmtMonthLabel = (mStr) => {
    const d = new Date(`${mStr}-01T00:00:00`);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  };

  const changeMonth = (dir) => {
    const [y, m] = month.split("-").map((v) => parseInt(v, 10));
    const next = new Date(y, m - 1 + dir, 1);
    const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    onMonthChange(nextStr);
  };

  const ui = summary?.ui || {};
  const counts = summary?.counts || {};
  const meta = summary?.meta || {};
  const derived = summary?.derived || {};

  return (
    <>
      <div className="modal-backdrop show" />
      <div className="modal d-block modal-xl" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-xl" role="document">
          <div className="modal-content shadow-lg">
            <div className="modal-header">
              <div className="d-flex align-items-center gap-3">
                <h5 className="modal-title mb-0">{employee?.name}</h5>
                <span className="badge bg-secondary">Attendance Calendar</span>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {/* Month controls */}
              <div className="d-flex flex-wrap align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <button className="btn btn-outline-primary" onClick={() => changeMonth(-1)}>‹</button>
                  <h5 className="mb-0">{fmtMonthLabel(month)}</h5>
                  <button className="btn btn-outline-primary" onClick={() => changeMonth(1)}>›</button>
                </div>
                <input
                  type="month"
                  className="form-control"
                  style={{ maxWidth: 180 }}
                  value={month}
                  onChange={(e) => onMonthChange(e.target.value)}
                />
              </div>

              {/* Roll-up cards */}
              <div className="row g-3 mb-3">
                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-3">
                      <div className="small text-muted">Working Days</div>
                      <div className="fs-4 fw-semibold">{ui.workingDays ?? "-"}</div>
                      <div className="small text-muted">
                        ({meta.calendar_days ?? "-"} days − {meta.sundays ?? 0} Sun − {meta.holidays ?? 0} Hol)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-3">
                      <div className="small text-muted">Present</div>
                      <div className="fs-4 fw-semibold">{ui.present ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-3">
                      <div className="small text-muted">Absents</div>
                      <div className="fs-4 fw-semibold">{ui.absents ?? derived.absent_days ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-3">
                      <div className="small text-muted">Leaves (Eqv.)</div>
                      <div className="fs-4 fw-semibold">{ui.leaveDaysEquiv ?? derived.leave_days_equiv ?? 0}</div>
                      <div className="small text-muted">
                        Half-days: {ui.halfDays ?? derived.half_days_count ?? 0} (= {derived.half_day_equiv_days ?? (ui.halfDays ? ui.halfDays * 0.5 : 0)}d)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="card border-0 shadow-sm">
                    <div className="card-body py-3">
                      <div className="small text-muted">Unmarked</div>
                      <div className="fs-4 fw-semibold">{ui.unmarkedDays ?? 0}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw status chips */}
              <div className="d-flex flex-wrap gap-2 mb-3 small">
                {Object.entries(counts).map(([k, v]) => (
                  <span key={k} className="badge rounded-pill" style={{ background: colorFor(k.replace(/_/g, "-")), color: "#fff" }}>
                    {k.replace(/_/g, " ")}: <strong className="ms-1">{v}</strong>
                  </span>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="mini-cal-grid border rounded">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                  <div key={d} className="mini-cal-head text-center fw-semibold">{d}</div>
                ))}
                {Array.from({ length: cells }).map((_, i) => {
                  const d = new Date(start);
                  d.setDate(start.getDate() + i);
                  const inMonth = d.getMonth() === monthDate.getMonth();
                  const dateStr = d.toISOString().slice(0,10);
                  const rec = recMap.get(dateStr);
                  const status = rec?.status || "unmarked";
                  const color = colorFor(status);
                  return (
                    <div key={i} className={`mini-cal-cell ${inMonth ? "" : "muted"}`} title={`${dateStr} · ${status}`}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="fw-semibold small">{d.getDate()}</div>
                        <span className="status-dot" style={{ background: color }} />
                      </div>
                      {rec?.remarks && <div className="mini-remarks text-truncate" title={rec.remarks}>{rec.remarks}</div>}
                      {(rec?.in_time || rec?.out_time) && (
                        <div className="mini-times small text-muted">
                          {rec.in_time ? `In ${rec.in_time}` : ""}{rec.in_time && rec.out_time ? " · " : ""}{rec.out_time ? `Out ${rec.out_time}` : ""}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
