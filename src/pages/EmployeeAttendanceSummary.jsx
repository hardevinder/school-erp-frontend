import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./EmployeeAttendanceSummary.css";

/**
 * Server returns counts with underscores:
 * present, absent, leave, full_day_leave, first_half_day_leave,
 * second_half_day_leave, half_day_without_pay, short_leave
 */

export default function EmployeeAttendanceSummaryAll() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [employees, setEmployees] = useState([]);            // [{id, name, employee_id, department:{name}}]
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState("all");

  const [summaryRaw, setSummaryRaw] = useState({});          // from /summary/month
  const [holidays, setHolidays] = useState([]);              // [{date, ...}] filtered to month
  const [loading, setLoading] = useState(false);

  // config
  const [excludeSundays, setExcludeSundays] = useState(true);
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [shortLeaveFraction, setShortLeaveFraction] = useState(0.25);

  useEffect(() => {
    fetchAll();
  }, [month]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sumRes, empRes] = await Promise.all([
        api.get(`/employee-attendance/summary/month?month=${month}`),
        api.get(`/employees`),
      ]);
      setSummaryRaw(sumRes.data?.summary || {});
      const emps = empRes.data?.employees || [];
      setEmployees(emps);
      setDepartments([...new Set(emps.map(e => e?.department?.name).filter(Boolean))]);

      // holidays are optional; soft-fail
      try {
        const holRes = await api.get(`/holidays`);
        const mm = month; // "YYYY-MM"
        const hols = Array.isArray(holRes.data) ? holRes.data.filter(h => typeof h?.date === "string" && h.date.startsWith(mm)) : [];
        setHolidays(hols);
      } catch {
        setHolidays([]);
      }
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to load monthly summary", "error");
    } finally {
      setLoading(false);
    }
  };

  // helpers
  const daysInMonth = useMemo(() => {
    const d = new Date(`${month}-01T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }, [month]);

  const sundaysInMonth = useMemo(() => {
    const d = new Date(`${month}-01T00:00:00`);
    const y = d.getFullYear(), m = d.getMonth();
    let s = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (new Date(y, m, day).getDay() === 0) s++;
    }
    return s;
  }, [month, daysInMonth]);

  const holidaysCount = useMemo(() => holidays.length, [holidays]);

  const workingDaysBase = useMemo(() => {
    let wd = daysInMonth;
    if (excludeSundays) wd -= sundaysInMonth;
    if (excludeHolidays) wd -= holidaysCount;
    return Math.max(0, wd);
  }, [daysInMonth, sundaysInMonth, holidaysCount, excludeSundays, excludeHolidays]);

  // Build a per-employee table
  const employeeMap = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  const rows = useMemo(() => {
    const out = [];
    for (const [eidStr, block] of Object.entries(summaryRaw)) {
      const eid = Number(eidStr);
      const e = employeeMap.get(eid);

      // The controller returns { employee: "Name", counts: {...} }
      const counts = block?.counts || block || {};
      const present = counts.present || 0;
      const absent = counts.absent || 0;
      const leaveFull = (counts.leave || 0) + (counts.full_day_leave || 0);
      const firstHalf = counts.first_half_day_leave || 0;
      const secondHalf = counts.second_half_day_leave || 0;
      const halfNoPay = counts.half_day_without_pay || 0;
      const shortLeave = counts.short_leave || 0;

      const halfDays = firstHalf + secondHalf + halfNoPay;

      // days with any status recorded (each count represents one day)
      const markedDays =
        present + absent + leaveFull + firstHalf + secondHalf + halfNoPay + shortLeave;

      const unmarked = Math.max(0, workingDaysBase - markedDays);

      const leaveEquiv = leaveFull + 0.5 * halfDays + shortLeave * Number(shortLeaveFraction || 0);

      out.push({
        id: eid,
        code: e?.employee_id || "",
        name: e?.name || block?.employee || `Emp ${eid}`,
        department: e?.department?.name || "-",
        workingDays: workingDaysBase,
        present,
        absent,
        leaveFull,
        halfDays,
        shortLeave,
        leaveEquiv: Number(leaveEquiv.toFixed(2)),
        unmarked,
      });
    }

    // Optional filter by department
    const filtered = deptFilter === "all" ? out : out.filter(r => r.department === deptFilter);

    // Sort by department then name
    filtered.sort((a, b) => {
      if (a.department === b.department) return a.name.localeCompare(b.name);
      return a.department.localeCompare(b.department);
    });
    return filtered;
  }, [summaryRaw, employeeMap, workingDaysBase, shortLeaveFraction, deptFilter]);

  const totals = useMemo(() => {
    const acc = {
      employees: rows.length,
      workingDays: rows.reduce((s, r) => s + r.workingDays, 0),
      present: rows.reduce((s, r) => s + r.present, 0),
      absent: rows.reduce((s, r) => s + r.absent, 0),
      leaveFull: rows.reduce((s, r) => s + r.leaveFull, 0),
      halfDays: rows.reduce((s, r) => s + r.halfDays, 0),
      shortLeave: rows.reduce((s, r) => s + r.shortLeave, 0),
      leaveEquiv: Number(rows.reduce((s, r) => s + r.leaveEquiv, 0).toFixed(2)),
      unmarked: rows.reduce((s, r) => s + r.unmarked, 0),
    };
    return acc;
  }, [rows]);

  const changeMonth = (delta) => {
    const d = new Date(`${month}-01T00:00:00`);
    d.setMonth(d.getMonth() + delta);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  // Export to PDF (jsPDF + autoTable). Install once:
  // npm i jspdf jspdf-autotable
  const exportPDF = async () => {
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default || autoTableMod;

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const title = `Attendance Summary — ${new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
      doc.setFontSize(14);
      doc.text(title, 40, 40);

      const sub = `Working Days: ${workingDaysBase}  |  Excl. Sundays: ${excludeSundays ? "Yes" : "No"}  |  Excl. Holidays: ${excludeHolidays ? "Yes" : "No"}  |  Short Leave = ${shortLeaveFraction} day`;
      doc.setFontSize(10);
      doc.text(sub, 40, 60);

      const head = [[
        "Emp ID", "Employee", "Department",
        "Working Days", "Present", "Absent", "Leaves (Full)",
        "Half-days", "Short Leave", "Leave Eqv.", "Unmarked",
      ]];

      const body = rows.map(r => [
        r.code, r.name, r.department,
        r.workingDays, r.present, r.absent, r.leaveFull,
        r.halfDays, r.shortLeave, r.leaveEquiv, r.unmarked,
      ]);

      // Totals row
      body.push([
        "", "TOTAL", deptFilter === "all" ? "All" : deptFilter,
        totals.workingDays, totals.present, totals.absent, totals.leaveFull,
        totals.halfDays, totals.shortLeave, totals.leaveEquiv, totals.unmarked,
      ]);

      autoTable(doc, {
        head,
        body,
        startY: 80,
        styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
        headStyles: { fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 170 }, 2: { cellWidth: 120 } },
        willDrawCell: (data) => {
          // Optional emphasis on TOTAL row
          if (data.section === "body" && data.row.index === body.length - 1) {
            doc.setFont(undefined, "bold");
          }
        },
      });

      doc.save(`attendance-summary-${month}.pdf`);
    } catch (e) {
      console.error(e);
      Swal.fire("PDF Error", "Please install packages: jspdf & jspdf-autotable", "error");
    }
  };

  return (
    <div className="container py-3">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <h4 className="mb-0">All Employees — Attendance Summary</h4>

        <div className="d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label mb-1">Month</label>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={() => changeMonth(-1)}>‹</button>
              <input
                type="month"
                className="form-control"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                style={{ minWidth: 140 }}
              />
              <button className="btn btn-outline-secondary" onClick={() => changeMonth(1)}>›</button>
            </div>
          </div>

          <div>
            <label className="form-label mb-1">Department</label>
            <select className="form-select" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="all">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label mb-1">Short Leave =</label>
            <select className="form-select" value={shortLeaveFraction} onChange={(e) => setShortLeaveFraction(Number(e.target.value))}>
              <option value={0}>0 day</option>
              <option value={0.25}>0.25 day</option>
              <option value={0.5}>0.5 day</option>
              <option value={1}>1 day</option>
            </select>
          </div>

          <div className="form-check mt-4">
            <input className="form-check-input" type="checkbox" id="exSun" checked={excludeSundays} onChange={(e) => setExcludeSundays(e.target.checked)} />
            <label className="form-check-label" htmlFor="exSun">Exclude Sundays</label>
          </div>
          <div className="form-check mt-4">
            <input className="form-check-input" type="checkbox" id="exHol" checked={excludeHolidays} onChange={(e) => setExcludeHolidays(e.target.checked)} />
            <label className="form-check-label" htmlFor="exHol">Exclude Holidays</label>
          </div>

          <button className="btn btn-primary mt-1" onClick={exportPDF} disabled={loading || rows.length === 0}>
            Export PDF
          </button>
        </div>
      </div>

      {/* Quick month facts */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="small text-muted">Calendar Days</div>
              <div className="fs-4 fw-semibold">{daysInMonth}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="small text-muted">Sundays</div>
              <div className="fs-4 fw-semibold">{sundaysInMonth}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="small text-muted">Holidays</div>
              <div className="fs-4 fw-semibold">{holidaysCount}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="small text-muted">Working Days</div>
              <div className="fs-4 fw-semibold">{workingDaysBase}</div>
              <div className="small text-muted">
                {excludeSundays ? "– Sun" : ""} {excludeHolidays ? "– Hol" : ""}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="alert alert-info">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="alert alert-warning">No data for this selection.</div>
      ) : (
        <>
          {/* Totals strip */}
          <div className="row g-2 mb-2">
            <div className="col-6 col-md-3"><div className="tot-chip">Employees: <strong>{totals.employees}</strong></div></div>
            <div className="col-6 col-md-3"><div className="tot-chip">Present: <strong>{totals.present}</strong></div></div>
            <div className="col-6 col-md-3"><div className="tot-chip">Absents: <strong>{totals.absent}</strong></div></div>
            <div className="col-6 col-md-3"><div className="tot-chip">Leaves (Full): <strong>{totals.leaveFull}</strong></div></div>
            <div className="col-6 col-md-3"><div className="tot-chip">Half-days: <strong>{totals.halfDays}</strong></div></div>
            <div className="col-6 col-md-3"><div className="tot-chip">Short Leave: <strong>{totals.shortLeave}</strong></div></div>
            <div className="col-6 col-md-3"><div className="tot-chip">Leave Eqv.: <strong>{totals.leaveEquiv}</strong></div></div>
            <div className="col-6 col-md-3"><div className="tot-chip">Unmarked: <strong>{totals.unmarked}</strong></div></div>
          </div>

          {/* Table */}
          <div className="table-scroll">
            <table className="table table-bordered table-sm align-middle table-sticky">
              <thead>
                <tr>
                  <th style={{ minWidth: 90 }}>Emp ID</th>
                  <th style={{ minWidth: 220 }}>Employee</th>
                  <th style={{ minWidth: 160 }}>Department</th>
                  <th style={{ minWidth: 120 }}>Working Days</th>
                  <th style={{ minWidth: 100 }}>Present</th>
                  <th style={{ minWidth: 100 }}>Absent</th>
                  <th style={{ minWidth: 120 }}>Leaves (Full)</th>
                  <th style={{ minWidth: 100 }}>Half-days</th>
                  <th style={{ minWidth: 120 }}>Short Leave</th>
                  <th style={{ minWidth: 120 }}>Leave Eqv.</th>
                  <th style={{ minWidth: 110 }}>Unmarked</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.department}</td>
                    <td>{r.workingDays}</td>
                    <td>{r.present}</td>
                    <td>{r.absent}</td>
                    <td>{r.leaveFull}</td>
                    <td>{r.halfDays}</td>
                    <td>{r.shortLeave}</td>
                    <td>{r.leaveEquiv}</td>
                    <td>{r.unmarked}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="table-light fw-semibold">
                  <td></td>
                  <td>TOTAL</td>
                  <td>{deptFilter === "all" ? "All" : deptFilter}</td>
                  <td>{totals.workingDays}</td>
                  <td>{totals.present}</td>
                  <td>{totals.absent}</td>
                  <td>{totals.leaveFull}</td>
                  <td>{totals.halfDays}</td>
                  <td>{totals.shortLeave}</td>
                  <td>{totals.leaveEquiv}</td>
                  <td>{totals.unmarked}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
