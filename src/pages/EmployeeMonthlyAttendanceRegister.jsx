import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./MonthlyAttendanceRegister.css";
import "./MonthlyAttendanceColors.css";
import "./EmployeeMonthlyAttendanceRegister.css";

const now = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const asRows = (value) => Array.isArray(value) ? value : value?.departments || value?.data || [];
const codeClass = (code) => ({ P: "is-present", A: "is-absent", L: "is-leave", ML: "is-leave", FH: "is-halfday", SH: "is-halfday", HD: "is-halfday", SL: "is-late", H: "is-holiday", WO: "is-off", "—": "is-unmarked" }[code] || "");

export default function EmployeeMonthlyAttendanceRegister() {
  const [filters, setFilters] = useState({ department_id: "", month: String(now.getMonth() + 1), year: String(now.getFullYear()) });
  const [departments, setDepartments] = useState([]);
  const [report, setReport] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.get("/departments").then((response) => setDepartments(asRows(response.data))).catch(() => setDepartments([])); }, []);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return report?.employees || [];
    return (report?.employees || []).filter((employee) => [employee.employee_id, employee.name, employee.designation, employee.department?.name].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }, [report, search]);

  const loadReport = async () => {
    setLoading(true); setError("");
    try { setReport((await api.get("/employee-attendance/monthly-register", { params: filters })).data); }
    catch (err) { setReport(null); setError(err.response?.data?.message || "Unable to load monthly employee attendance."); }
    finally { setLoading(false); }
  };
  const exportCsv = () => {
    if (!report) return;
    const headers = ["Employee Code", "Employee Name", "Department", "Designation", ...report.days.map((day) => `${day.day} ${day.weekday}`), "Working Days", "Present", "Absent", "Leave", "Medical Leave", "Half Day", "Short Leave", "Unmarked", "Attendance %"];
    const data = visible.map((employee) => [employee.employee_id, employee.name, employee.department?.name, employee.designation, ...report.days.map((day) => employee.attendance?.[day.date] || "—"), report.working_days, employee.totals.present, employee.totals.absent, employee.totals.leave, employee.totals.medical_leave, employee.totals.half_day, employee.totals.short_leave, employee.totals.unmarked, employee.attendance_percentage]);
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const blob = new Blob([[headers, ...data].map((line) => line.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `employee-attendance-${report.year}-${String(report.month).padStart(2, "0")}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="monthly-register-page employee-monthly-register container-fluid py-3">
    <section className="monthly-register-hero"><div><div className="hero-kicker">HR Operations</div><h2>Employee Monthly Attendance Register</h2><p>Every employee's day-wise attendance and monthly totals in one register.</p></div><div className="hero-icon"><i className="bi bi-person-vcard" /></div></section>
    <section className="card border-0 shadow-sm filter-card"><div className="card-body"><div className="row g-3 align-items-end">
      <div className="col-sm-6 col-xl-3"><label className="form-label">Department</label><select className="form-select" value={filters.department_id} onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
      <div className="col-sm-6 col-xl-3"><label className="form-label">Month</label><select className="form-select" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })}>{months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}</select></div>
      <div className="col-sm-6 col-xl-3"><label className="form-label">Year</label><input className="form-control" type="number" min="2000" max="2200" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} /></div>
      <div className="col-sm-6 col-xl-3"><button className="btn btn-primary w-100" onClick={loadReport} disabled={loading}>{loading ? "Loading…" : <><i className="bi bi-search me-2" />View Register</>}</button></div>
    </div></div></section>
    {error && <div className="alert alert-danger mt-3 mb-0"><i className="bi bi-exclamation-circle me-2" />{error}</div>}
    {report && <><section className="register-summary-grid"><Summary icon="bi-people" label="Employees" value={report.total_employees} tone="blue" /><Summary icon="bi-calendar-check" label="Working Days" value={report.working_days} tone="green" /><Summary icon="bi-building" label="Department" value={filters.department_id ? departments.find((item) => String(item.id) === String(filters.department_id))?.name || "Selected" : "All Departments"} tone="purple" /><Summary icon="bi-calendar3" label="Register Month" value={`${months[report.month - 1]} ${report.year}`} tone="orange" /></section>
      <section className="card border-0 shadow-sm register-card"><div className="register-toolbar"><div><h5>Employee Attendance Register</h5><small>{visible.length} of {report.total_employees} employees</small></div><div className="register-actions"><div className="input-group"><span className="input-group-text"><i className="bi bi-search" /></span><input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, code or department" /></div><button className="btn btn-outline-success" onClick={exportCsv}><i className="bi bi-file-earmark-spreadsheet me-2" />Export Excel</button></div></div>
        <div className="attendance-legend">{Object.entries(report.legend || {}).map(([code, label]) => <span key={code}><b className={codeClass(code)}>{code}</b>{label}</span>)}</div>
        <div className="monthly-register-scroll"><table className="table monthly-register-table"><thead><tr><th className="sticky-col emp-code">Code</th><th className="sticky-col emp-name">Employee Name</th><th className="sticky-col emp-dept">Department</th><th className="sticky-col emp-role">Designation</th>{report.days.map((day) => <th key={day.date} className={`day-column ${!day.is_working_day ? "non-working" : ""}`}><span>{day.day}</span><small>{day.weekday}</small></th>)}<th>WD</th><th>P</th><th>A</th><th>L</th><th>ML</th><th>HD</th><th>SL</th><th>UM</th><th>%</th></tr></thead><tbody>
          {visible.map((employee) => <tr key={employee.id}><td className="sticky-col emp-code">{employee.employee_id || "—"}</td><td className="sticky-col emp-name student-name">{employee.name || "—"}</td><td className="sticky-col emp-dept">{employee.department?.name || "—"}</td><td className="sticky-col emp-role">{employee.designation || "—"}</td>{report.days.map((day) => { const code = employee.attendance?.[day.date] || "—"; return <td key={day.date} className={`attendance-code ${codeClass(code)}`}>{code}</td>; })}<td className="total-cell">{report.working_days}</td><td className="total-cell text-success">{employee.totals.present}</td><td className="total-cell text-danger">{employee.totals.absent}</td><td>{employee.totals.leave}</td><td>{employee.totals.medical_leave}</td><td>{employee.totals.half_day}</td><td>{employee.totals.short_leave}</td><td>{employee.totals.unmarked}</td><td><span className={`percentage-pill ${employee.attendance_percentage >= 75 ? "good" : "low"}`}>{employee.attendance_percentage}%</span></td></tr>)}
          {!visible.length && <tr><td colSpan={(report.days?.length || 0) + 13} className="text-center py-5 text-muted">No matching employees found.</td></tr>}
        </tbody></table></div></section></>}
  </div>;
}
function Summary({ icon, label, value, tone }) { return <div className={`summary-card tone-${tone}`}><div className="summary-icon"><i className={`bi ${icon}`} /></div><div><small>{label}</small><strong>{value}</strong></div></div>; }
