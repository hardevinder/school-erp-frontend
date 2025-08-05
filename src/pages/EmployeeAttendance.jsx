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
  const [attendance, setAttendance] = useState({});
  const [attendanceOptions, setAttendanceOptions] = useState([]);

  useEffect(() => {
    fetchEmployees();
    fetchMarkedAttendance(date); // ✅ load existing attendance when date changes
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
      const uniqueDepts = [...new Set(all.map((e) => e.Department?.name).filter(Boolean))];
      setDepartments(uniqueDepts);
    } catch (err) {
      Swal.fire("Error", "Failed to fetch employees", "error");
    }
  };

  const fetchAttendanceOptions = async () => {
    try {
      const res = await api.get("/employee-leave-types");
      const formatted = res.data.data.map((type) => ({
        value: type.name.toLowerCase().replace(/\s+/g, "_"),
        label: type.name,
        abbr: type.abbreviation || type.name.slice(0, 2).toUpperCase(),
        color: "#6c757d",
      }));
      formatted.unshift({ value: "present", label: "Present", abbr: "P", color: "#28a745" });
      formatted.unshift({ value: "absent", label: "Absent", abbr: "A", color: "#dc3545" });
      setAttendanceOptions(formatted);
    } catch (err) {
      Swal.fire("Error", "Failed to fetch attendance types", "error");
    }
  };

  const fetchMarkedAttendance = async (selectedDate) => {
    try {
      const res = await api.get(`/employee-attendance?date=${selectedDate}`);
      const existing = res.data.records || []; // ✅ FIXED

      const mapped = {};
      for (const entry of existing) {
        mapped[entry.employee_id] = {
          status: entry.status,
          remarks: entry.remarks,
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
        ...prev[id],
        [field]: value,
      },
    }));
  };

  const handleDeptFilter = (dept) => {
    setSelectedDept(dept);
    setFiltered(dept === "all" ? employees : employees.filter((e) => e.Department?.name === dept));
  };

  const markAllPresent = () => {
    const updated = {};
    filtered.forEach((emp) => {
      updated[emp.id] = { ...attendance[emp.id], status: "present" };
    });
    setAttendance(updated);
  };

  const handleSubmit = async () => {
    const payload = {
      date,
      attendances: Object.entries(attendance).map(([employee_id, info]) => ({
        employee_id: parseInt(employee_id),
        status: info.status,
        remarks: info.remarks || "",
      })),
    };

    try {
      const res = await api.post("/employee-attendance/mark", payload);
      Swal.fire("Success", res.data.message, "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to mark attendance", "error");
    }
  };

  const getStatusCounts = () => {
    const counts = {};
    for (const { status } of Object.values(attendance)) {
      if (!status) continue;
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  };

  const counts = getStatusCounts();

  return (
    <div className="container py-3">
      <h4>Mark Employee Attendance</h4>

      <div className="row g-3 mb-3 align-items-center">
        <div className="col-md-3">
          <label>Date:</label>
          <input
            type="date"
            className="form-control"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>
        <div className="col-md-3">
          <label>Filter by Department:</label>
          <select className="form-select" value={selectedDept} onChange={(e) => handleDeptFilter(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div className="col-md-3 mt-4">
          <button className="btn btn-success mt-2" onClick={markAllPresent}>Mark All Present</button>
        </div>
      </div>

      <div className="row mb-4">
        {attendanceOptions.map((opt) => (
          <div key={opt.value} className="col-md-3 mb-2">
            <div className="card text-white" style={{ backgroundColor: opt.color }}>
              <div className="card-body py-2 d-flex justify-content-between align-items-center">
                <span>{opt.label}</span>
                <span className="fw-bold fs-5">{counts[opt.value] || 0}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-sm">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Department</th>
              <th>Status</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, idx) => (
              <tr key={emp.id}>
                <td>{idx + 1}</td>
                <td>{emp.name}</td>
                <td>{emp.Department?.name || "-"}</td>
                <td>
                  {attendanceOptions.map((opt) => (
                    <div className="form-check form-check-inline" key={opt.value}>
                      <input
                        className="form-check-input"
                        type="radio"
                        name={`status-${emp.id}`}
                        value={opt.value}
                        checked={attendance[emp.id]?.status === opt.value}
                        onChange={() => handleChange(emp.id, "status", opt.value)}
                      />
                      <label className="form-check-label">{opt.abbr}</label>
                    </div>
                  ))}
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={attendance[emp.id]?.remarks || ""}
                    onChange={(e) => handleChange(emp.id, "remarks", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="btn btn-primary" onClick={handleSubmit}>Submit Attendance</button>

      <div className="mt-4">
        <h6>Abbreviations:</h6>
        <ul className="small">
          {attendanceOptions.map((opt) => (
            <li key={opt.value}>
              <strong>{opt.abbr}</strong> - {opt.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
