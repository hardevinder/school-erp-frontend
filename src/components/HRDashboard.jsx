// src/components/HRDashboard.jsx — Employee Attendance–focused, with Absent/On‑Leave (Teachers) highlights
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

export default function HRDashboard() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [employees, setEmployees] = useState([]); // active only
  const [records, setRecords] = useState([]);     // attendance records for selected date
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/employees");
        const all = res?.data?.employees || [];
        const active = all.filter((e) => (e?.status || "enabled").toLowerCase() !== "disabled");
        if (mounted) setEmployees(active);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e.message || "Failed to load employees");
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/employee-attendance?date=${date}`);
        if (mounted) setRecords(Array.isArray(res?.data?.records) ? res.data.records : []);
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || e.message || "Failed to load attendance");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [date]);

  const deptList = useMemo(() => {
    return [
      "all",
      ...Array.from(new Set(employees.map((e) => e?.department?.name).filter(Boolean))),
    ];
  }, [employees]);

  const byId = useMemo(() => {
    const map = new Map();
    for (const r of records) map.set(Number(r.employee_id), r);
    return map;
  }, [records]);

  const isTeacher = (emp) => {
    const roleish = `${emp?.designation || emp?.title || emp?.role || ""}`.toLowerCase();
    const dept = `${emp?.department?.name || ""}`.toLowerCase();
    return roleish.includes("teacher") || dept.includes("teaching") || dept.includes("academ");
  };

  const onLeaveSet = new Set([
    "leave",
    "full_day_leave",
    "medical_leave",
    "first_half_day_leave",
    "second_half_day_leave",
    "half_day_without_pay",
    "short_leave",
  ]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (selectedDept !== "all" && (e?.department?.name !== selectedDept)) return false;
      if (!q) return true;
      const blob = `${e?.name || ""} ${e?.code || ""} ${e?.designation || ""} ${e?.department?.name || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [employees, search, selectedDept]);

  // —— Derive KPI counts ——
  const kpis = useMemo(() => {
    const total = employees.length;
    let present = 0, absent = 0, leave = 0, shortLeave = 0;
    for (const emp of employees) {
      const st = byId.get(emp.id)?.status;
      if (!st) continue;
      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "short_leave") { leave++; shortLeave++; }
      else if (onLeaveSet.has(st)) leave++;
    }
    return { total, present, absent, leave, shortLeave };
  }, [employees, byId]);

  // —— Highlight lists (Teachers) ——
  const teacherAbsent = useMemo(() => employees.filter((e) => isTeacher(e) && byId.get(e.id)?.status === "absent"), [employees, byId]);
  const teacherOnLeave = useMemo(() => employees.filter((e) => isTeacher(e) && onLeaveSet.has(byId.get(e.id)?.status || "")), [employees, byId]);

  // —— All absent list (all departments) ——
  const allAbsent = useMemo(() => employees.filter((e) => byId.get(e.id)?.status === "absent"), [employees, byId]);

  const initials = (name) => {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  };

  const shiftDay = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };
  const goToday = () => setDate(new Date().toISOString().split("T")[0]);

  return (
    <div className="container-fluid px-3 py-2">
      {/* Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 rounded-4 p-3 shadow-sm" style={{
        background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
        border: "1px solid #e5e7eb",
      }}>
        <div>
          <h4 className="mb-1 fw-semibold">HR Dashboard</h4>
          <div className="text-muted small">Daily employee attendance overview</div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label mb-1 small text-muted">Date</label>
            <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="d-flex gap-2 pb-1">
            <button className="btn btn-outline-secondary" type="button" onClick={() => shiftDay(-1)}>◀</button>
            <button className="btn btn-outline-primary" type="button" onClick={goToday}>Today</button>
            <button className="btn btn-outline-secondary" type="button" onClick={() => shiftDay(1)}>▶</button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-3">
        <div className="d-flex flex-wrap align-items-end gap-3">
          <div>
            <label className="form-label mb-1">Department</label>
            <select className="form-select" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
              {deptList.map((d) => (
                <option key={d} value={d}>{d === "all" ? "All Departments" : d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label mb-1">Search</label>
            <input className="form-control" placeholder="Name / Code / Designation" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="text-muted small">{records.length} attendance records on {date}</div>
      </div>

      {/* States */}
      {loading && (
        <div className="alert alert-light border mb-3">Loading attendance…</div>
      )}
      {!loading && error && (
        <div className="alert alert-danger mb-3">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* KPI cards */}
          <div className="row g-3 mb-4">
            {[{
              title: "Total Employees",
              value: kpis.total,
              sub: "Active profiles",
              variant: "secondary"
            },{
              title: "Present Today",
              value: kpis.present,
              sub: `${kpis.total ? Math.round((kpis.present / kpis.total) * 100) : 0}% of total`,
              variant: "success"
            },{
              title: "Absent Today",
              value: kpis.absent,
              sub: `${kpis.total ? Math.round((kpis.absent / kpis.total) * 100) : 0}% of total`,
              variant: "danger"
            },{
              title: "On Leave Today",
              value: kpis.leave,
              sub: kpis.shortLeave ? `${kpis.shortLeave} short leave` : "",
              variant: "warning"
            }].map((m, i) => (
              <div className="col-md-6 col-lg-3" key={i}>
                <div
                  className={"card border-0 shadow-sm rounded-4 h-100 " + "bg-" + m.variant + " bg-opacity-10"}
                  style={{ transition: "transform .2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  <div className="card-body">
                    <div className="text-uppercase small text-muted mb-1">{m.title}</div>
                    <div className="display-6 fw-semibold">{m.value}</div>
                    <div className="mt-1 small text-muted">{m.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Teacher Highlights */}
          <div className="row g-3 mb-4">
            <div className="col-lg-6">
              <div className="card shadow-sm rounded-4 h-100">
                <div className="card-header bg-white border-0 fw-semibold">Absent Teachers — {date}</div>
                <div className="card-body p-0">
                  {teacherAbsent.length === 0 ? (
                    <div className="p-3 text-muted">Great! No teachers marked absent.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {teacherAbsent.map((e) => (
                        <li key={e.id} className="list-group-item d-flex align-items-center gap-3">
                          <div className="rounded-circle d-inline-flex justify-content-center align-items-center" style={{width:36,height:36,background:"#fee2e2",color:"#b91c1c",fontWeight:600}}>
                            {initials(e.name)}
                          </div>
                          <div className="flex-fill">
                            <div className="fw-semibold">{e.name}</div>
                            <div className="small text-muted">{e?.designation || "Teacher"} · {e?.department?.name || "Teaching"}</div>
                          </div>
                          <span className="badge bg-danger">ABSENT</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="card shadow-sm rounded-4 h-100">
                <div className="card-header bg-white border-0 fw-semibold">Teachers on Leave — {date}</div>
                <div className="card-body p-0">
                  {teacherOnLeave.length === 0 ? (
                    <div className="p-3 text-muted">No teacher leave entries today.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {teacherOnLeave.map((e) => {
                        const st = byId.get(e.id)?.status;
                        const label = String(st || "leave").replace(/_/g, " ");
                        return (
                          <li key={e.id} className="list-group-item d-flex align-items-center gap-3">
                            <div className="rounded-circle d-inline-flex justify-content-center align-items-center" style={{width:36,height:36,background:"#fef9c3",color:"#a16207",fontWeight:600}}>
                              {initials(e.name)}
                            </div>
                            <div className="flex-fill">
                              <div className="fw-semibold">{e.name}</div>
                              <div className="small text-muted">{e?.designation || "Teacher"} · {e?.department?.name || "Teaching"}</div>
                            </div>
                            <span className="badge bg-warning text-dark text-uppercase">{label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* All Absent — across departments (pretty tiles) */}
          <div className="card shadow-sm rounded-4 mb-4">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>All Absent Employees — {date}</span>
              <span className="badge bg-danger">{allAbsent.length}</span>
            </div>
            <div className="card-body">
              {allAbsent.length === 0 ? (
                <div className="text-muted">No one is absent today. 🎉</div>
              ) : (
                <div className="row g-3">
                  {allAbsent.map((e) => (
                    <div key={e.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                      <div className="border rounded-4 p-3 h-100 d-flex align-items-center gap-3" style={{borderColor: "#fee2e2", background: "#fff7f7"}}>
                        <div className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0" style={{width:44,height:44,background:"#fee2e2",color:"#b91c1c",fontWeight:700}}>
                          {initials(e.name)}
                        </div>
                        <div className="flex-fill">
                          <div className="fw-semibold text-truncate" title={e.name}>{e.name}</div>
                          <div className="small text-muted text-truncate" title={(e?.department?.name || "-") + " · " + (e?.designation || "-")}>{e?.department?.name || "-"} · {e?.designation || "-"}</div>
                        </div>
                        <span className="badge bg-danger">Absent</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Directory table (filtered) */}
          <div className="card shadow-sm rounded-4">
            <div className="card-header bg-white border-0 fw-semibold">Employee Directory — {selectedDept === "all" ? "All Departments" : selectedDept}</div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{width: 56}}>#</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((e, idx) => {
                    const rec = byId.get(e.id) || {};
                    const status = rec.status || "—";
                    const label = typeof status === "string" ? status.replace(/_/g, " ") : status;
                    return (
                      <tr key={e.id}>
                        <td>{idx + 1}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <div className="rounded-circle d-inline-flex justify-content-center align-items-center" style={{width:28,height:28,background:"#eef2ff",color:"#3730a3",fontWeight:700,fontSize:12}}>
                              {initials(e.name)}
                            </div>
                            <span>{e.name}</span>
                          </div>
                        </td>
                        <td>{e?.department?.name || "-"}</td>
                        <td>{e?.designation || "-"}</td>
                        <td>
                          <span className={
                            "badge text-uppercase " +
                            (status === "present" ? "bg-success" :
                             status === "absent" ? "bg-danger" :
                             onLeaveSet.has(status) ? "bg-warning text-dark" :
                             "bg-secondary")
                          }>
                            {label}
                          </span>
                        </td>
                        <td>{rec.in_time || "—"}</td>
                        <td>{rec.out_time || "—"}</td>
                        <td className="text-truncate" style={{maxWidth:240}} title={rec.remarks || ""}>{rec.remarks || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
