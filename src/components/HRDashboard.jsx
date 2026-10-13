// HR workspace with attendance, leave approvals and quick navigation.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./HRDashboard.css";
import { useNavigate } from "react-router-dom";

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const quickActions = [
  ["Employees", "Staff profiles & contact details", "person-badge", "/employees", "blue"],
  ["Mark attendance", "Manage daily staff attendance", "person-check", "/employee-attendance", "teal"],
  ["Review leaves", "Approve or review requests", "clipboard-check", "/hr-leave-requests", "amber"],
  ["Payroll", "Manage salaries & payroll", "cash-coin", "/payroll", "violet"],
  ["Monthly register", "Day-wise attendance records", "calendar2-check", "/employee-monthly-attendance-register", "teal"],
  ["Leave balances", "Check staff leave entitlement", "calendar-range", "/employee-leave-balances", "blue"],
  ["Departments", "Explore your teams", "diagram-3", "/departments", "violet"],
  ["Staff documents", "Open the staff document vault", "shield-check", "/document-vault", "amber"],
  ["Actions & approvals", "Open your action inbox", "inboxes", "/action-inbox", "blue"],
  ["Messages", "Conversations & reminders", "chat-dots", "/messages", "teal"],
  ["Academic calendar", "Teaching days & events", "calendar-week", "/academic-calendar", "amber"],
  ["Staff performance", "Review professional growth", "graph-up-arrow", "/teacher-performance", "violet"],
];

  /* =========================
     Helpers
  ========================= */
  const initials = (name) => {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return String(d);
    return dd.toISOString().split("T")[0];
  };

  const fmtAppliedAtIST = (leave) => {
    const value = leave?.createdAt || leave?.created_at;
    if (!value) return "Time unavailable";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Time unavailable";
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(parsed) + " IST";
  };

  const prettyStatus = (st) => String(st || "—").replace(/_/g, " ");
  const normalizeStatus = (st) => String(st || "").trim().toLowerCase();

  const getDeptName = (emp) => {
    const dept = emp?.department;

    if (typeof dept === "string") return dept;
    if (dept && typeof dept === "object") return dept.name || "—";
    if (typeof emp?.department_name === "string") return emp.department_name;

    return "—";
  };

  const getDesignation = (emp) => {
    const val = emp?.designation || emp?.title || emp?.role;

    if (typeof val === "string") return val;
    if (val && typeof val === "object") return val.name || "—";

    return "—";
  };

  const isTeacher = (emp) => {
    const designation = `${getDesignation(emp)}`.toLowerCase();
    const dept = `${getDeptName(emp)}`.toLowerCase();
    const blob = `${designation} ${dept}`;

    return (
      blob.includes("teacher") ||
      blob.includes("faculty") ||
      blob.includes("lecturer") ||
      blob.includes("professor") ||
      blob.includes("mentor") ||
      blob.includes("teaching") ||
      blob.includes("academic") ||
      blob.includes("academics")
    );
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

  const getStatusMeta = (rawStatus) => {
    const st = normalizeStatus(rawStatus);

    if (st === "present") {
      return {
        label: "Present",
        badgeClass: "bg-success",
        rowStyle: { background: "#f0fdf4" },
      };
    }

    if (st === "absent") {
      return {
        label: "Absent",
        badgeClass: "bg-danger",
        rowStyle: { background: "#fff5f5" },
      };
    }

    if (onLeaveSet.has(st)) {
      return {
        label: prettyStatus(st),
        badgeClass: "bg-warning text-dark",
        rowStyle: { background: "#fffdf0" },
      };
    }

    if (!st) {
      return {
        label: "—",
        badgeClass: "bg-secondary",
        rowStyle: undefined,
      };
    }

    return {
      label: prettyStatus(st),
      badgeClass: "bg-secondary",
      rowStyle: undefined,
    };
  };


export default function HRDashboard() {
  const navigate = useNavigate();

  const [date, setDate] = useState(localDate);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leaveError, setLeaveError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const requestVersion = useRef(0);

  const loadDashboard = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLeaveLoading(true);
    const results = await Promise.allSettled([
      api.get("/employees"),
      api.get(`/employee-attendance?date=${date}`),
      api.get("/employee-leave-requests/all", { params: { status: "pending" } }),
    ]);
    if (version !== requestVersion.current) return;
    const [staff, attendance, leaves] = results;
    const failures = [];
    if (staff.status === "fulfilled") {
      setEmployees((staff.value?.data?.employees || []).filter(
        (employee) => (employee?.status || "enabled").toLowerCase() !== "disabled"
      ));
    } else failures.push("Employee data could not be loaded.");
    if (attendance.status === "fulfilled") {
      setRecords(Array.isArray(attendance.value?.data?.records) ? attendance.value.data.records : []);
    } else failures.push("Attendance could not be loaded.");
    setError(failures.length ? failures.join(" ") : null);
    if (leaves.status === "fulfilled") {
      const rows = Array.isArray(leaves.value?.data?.data) ? leaves.value.data.data : [];
      setPendingLeaves([...rows].sort((a, b) =>
        (new Date(b.createdAt || b.created_at).getTime() || 0) -
        (new Date(a.createdAt || a.created_at).getTime() || 0) || Number(b.id) - Number(a.id)
      ));
      setLeaveError(null);
    } else setLeaveError("Leave requests could not be loaded. Refresh to try again.");
    if (results.every((result) => result.status === "fulfilled")) setUpdatedAt(new Date());
    setLoading(false);
    setLeaveLoading(false);
  }, [date]);

  useEffect(() => {
    loadDashboard();
    const timer = setInterval(() => {
      if (!document.hidden) loadDashboard();
    }, 60000);
    return () => {
      clearInterval(timer);
      requestVersion.current += 1;
    };
  }, [loadDashboard]);

  const handleLeaveAction = async (id, action) => {
    const { value: remarks } = await Swal.fire({
      title: `${action === "approved" ? "Approve" : "Reject"} Leave?`,
      input: "textarea",
      inputLabel: "Remarks (optional)",
      showCancelButton: true,
      confirmButtonText: action === "approved" ? "Approve" : "Reject",
      confirmButtonColor: action === "approved" ? "#16a34a" : "#dc2626",
    });

    if (remarks === undefined) return;

    try {
      await api.patch(`/employee-leave-requests/${id}/status`, {
        status: action,
        remarks,
      });
      Swal.fire("Success", `Leave request ${action}`, "success");
      loadDashboard();
    } catch (err) {
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Operation failed",
        "error"
      );
    }
  };

  /* =========================
     Derived lists
  ========================= */
  const deptList = useMemo(() => {
    return [
      "all",
      ...Array.from(new Set(employees.map((e) => getDeptName(e)).filter((v) => v && v !== "—"))),
    ];
  }, [employees]);

  const byId = useMemo(() => {
    const map = new Map();
    for (const r of records) map.set(Number(r.employee_id), r);
    return map;
  }, [records]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();

    return employees.filter((e) => {
      const deptName = getDeptName(e);
      if (selectedDept !== "all" && deptName !== selectedDept) return false;

      if (!q) return true;

      const blob =
        `${e?.name || ""} ${e?.code || ""} ${e?.employee_id || ""} ${getDesignation(e)} ${deptName}`.toLowerCase();

      return blob.includes(q);
    });
  }, [employees, search, selectedDept]);

  const kpis = useMemo(() => {
    const total = employees.length;
    let present = 0;
    let absent = 0;
    let leave = 0;
    let shortLeave = 0;
    let unmarked = 0;

    for (const emp of employees) {
      const st = normalizeStatus(byId.get(Number(emp.id))?.status);

      if (!st) {
        unmarked++;
        continue;
      }

      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "short_leave") {
        leave++;
        shortLeave++;
      } else if (onLeaveSet.has(st)) {
        leave++;
      }
    }

    return { total, present, absent, leave, shortLeave, unmarked };
  }, [employees, byId]);

  const teacherAbsent = useMemo(
    () =>
      employees.filter((e) => {
        const st = normalizeStatus(byId.get(Number(e.id))?.status);
        return isTeacher(e) && st === "absent";
      }),
    [employees, byId]
  );

  const teacherOnLeave = useMemo(
    () =>
      employees.filter((e) => {
        const st = normalizeStatus(byId.get(Number(e.id))?.status);
        return isTeacher(e) && onLeaveSet.has(st);
      }),
    [employees, byId]
  );

  const allAbsent = useMemo(
    () =>
      employees.filter((e) => normalizeStatus(byId.get(Number(e.id))?.status) === "absent"),
    [employees, byId]
  );

  const allOnLeave = useMemo(
    () =>
      employees.filter((e) => onLeaveSet.has(normalizeStatus(byId.get(Number(e.id))?.status))),
    [employees, byId]
  );

  const attendanceMarkedCount = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const st = normalizeStatus(byId.get(Number(emp.id))?.status);
      return st ? acc + 1 : acc;
    }, 0);
  }, [employees, byId]);

  const shiftDay = (delta) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const goToday = () => setDate(localDate());

  const latestLeave = pendingLeaves[0] || null;
  const latestEmpName = latestLeave?.employee?.name || "—";
  const latestDeptName = getDeptName(latestLeave?.employee || {});
  const latestLeaveType =
    latestLeave?.leaveType?.name || latestLeave?.leave_type?.name || "—";

  return (
    <div className="container-fluid px-3 py-3 dashboard-surface hr-dashboard">
      <header className="hr-hero">
        <div>
          <span className="hr-eyebrow"><i className="bi bi-people" aria-hidden="true" /> PEOPLE & OPERATIONS</span>
          <h1>HR Dashboard</h1>
          <p>A clear view of your people. A head start on your day.</p>
          <div className="hr-sync" role="status">
            <span className={`hr-status-dot ${error || leaveError ? "hr-status-warning" : ""}`} />
            {loading ? "Refreshing dashboard…" : error || leaveError ? "Some data is unavailable" : updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for data"}
            <span>· Refreshes every minute</span>
          </div>
        </div>
        <div className="hr-date-tools">
          <label htmlFor="hr-dashboard-date">Attendance date</label>
          <div className="d-flex gap-2">
            <button className="btn btn-light" aria-label="Previous day" onClick={() => shiftDay(-1)}><i className="bi bi-chevron-left" /></button>
            <input id="hr-dashboard-date" type="date" className="form-control" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }} />
            <button className="btn btn-light" aria-label="Next day" onClick={() => shiftDay(1)}><i className="bi bi-chevron-right" /></button>
          </div>
          <div className="d-flex gap-2 mt-2">
            <button className="btn btn-sm btn-outline-light" onClick={goToday}>Today</button>
            <button className="btn btn-sm btn-outline-light" disabled={loading} onClick={loadDashboard}><i className="bi bi-arrow-clockwise me-2" />Refresh now</button>
          </div>
        </div>
      </header>

      <section className="hr-stat-grid" aria-label="HR overview">
        {[
          ["Active employees", kpis.total, "Your current workforce", "people", "blue", "/employees"],
          ["Present", kpis.present, `Attendance on ${date}`, "person-check", "teal", "/employee-attendance"],
          ["Absent / on leave", `${loading || error ? "—" : kpis.absent} / ${loading || error ? "—" : kpis.leave}`, `Attendance on ${date}`, "calendar-minus", "amber", "/employee-attendance"],
          ["Pending approvals", pendingLeaves.length, "All pending leave requests", "clipboard-check", "violet", "/hr-leave-requests"],
        ].map(([label, value, detail, icon, tone, path], index) => (
          <button key={label} className={`hr-stat hr-tone-${tone}`} onClick={() => navigate(path)}>
            <span className="hr-icon"><i className={`bi bi-${icon}`} aria-hidden="true" /></span>
            <span className="hr-stat-label">{label}</span>
            <strong>{loading || (index === 3 ? leaveError : error) ? "—" : value}</strong>
            <small>{detail}</small>
          </button>
        ))}
      </section>

      <section className="hr-shortcuts" aria-labelledby="hr-shortcuts-heading">
        <div className="hr-section-heading"><div><h2 id="hr-shortcuts-heading">Your HR workspace</h2><p>Everyday tasks, just one click away.</p></div><span className="hr-section-tag">Quick access</span></div>
        <div className="hr-shortcut-grid">
          {quickActions.map(([label, description, icon, path, tone]) => (
            <button key={path} className={`hr-shortcut hr-tone-${tone}`} onClick={() => navigate(path)}>
              <span className="hr-icon"><i className={`bi bi-${icon}`} aria-hidden="true" /></span>
              <span className="hr-shortcut-copy"><strong>{label}</strong><small>{description}</small></span>
              <i className="bi bi-arrow-up-right hr-shortcut-arrow" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
      {leaveError && <div className="alert alert-warning" role="alert">{leaveError}</div>}

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card shadow-sm rounded-4 h-100 border-0">
            <div className="card-body">
              <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                <div>
                  <div className="text-uppercase small text-muted mb-1">
                    Latest Leave Request
                  </div>

                  {leaveLoading ? (
                    <div className="text-muted">Loading leave requests…</div>
                  ) : leaveError ? (<div className="text-muted">Leave requests unavailable.</div>) : !latestLeave ? (
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-success">All Clear</span>
                      <span className="text-muted">No pending leave requests.</span>
                    </div>
                  ) : (
                    <>
                      <div className="d-flex align-items-center gap-2">
                        <div
                          className="rounded-circle d-inline-flex justify-content-center align-items-center"
                          style={{
                            width: 48,
                            height: 48,
                            background: "var(--edb-surface)",
                            color: "var(--edb-primary-text)",
                            fontWeight: 800,
                          }}
                        >
                          {initials(latestEmpName)}
                        </div>
                        <div>
                          <div className="fw-semibold" style={{ fontSize: 18 }}>
                            {latestEmpName}
                          </div>
                          <div className="text-muted small">
                            {latestDeptName} ·{" "}
                            {latestLeave?.employee?.employee_id
                              ? `Code: ${latestLeave.employee.employee_id}`
                              : "—"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 d-flex flex-wrap gap-2">
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary-subtle">
                          {latestLeaveType}
                        </span>
                        <span className="badge bg-warning text-dark">
                          {fmtDate(latestLeave.start_date)} ↔ {fmtDate(latestLeave.end_date)}
                        </span>
                        {latestLeave.is_without_pay ? (
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger-subtle">
                            Without Pay
                          </span>
                        ) : (
                          <span className="badge bg-success bg-opacity-10 text-success border border-success-subtle">
                            Paid Leave
                          </span>
                        )}
                        <span className="badge bg-warning text-dark">PENDING</span>
                      </div>

                      <div className="mt-2 small text-muted">
                        <span className="fw-semibold">Reason:</span>{" "}
                        {latestLeave.reason || "—"}
                      </div>
                      <div className="mt-2 small text-primary fw-semibold">
                        <i className="bi bi-clock-history me-1" />
                        Applied: {fmtAppliedAtIST(latestLeave)}
                      </div>
                    </>
                  )}
                </div>

                {latestLeave && !leaveError && !leaveLoading && (
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      className="btn btn-success rounded-4"
                      onClick={() => handleLeaveAction(latestLeave.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger rounded-4"
                      onClick={() => handleLeaveAction(latestLeave.id, "rejected")}
                    >
                      Reject
                    </button>
                    <button
                      className="btn btn-outline-secondary rounded-4"
                      onClick={loadDashboard}
                      title="Refresh leave requests"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>

              <hr className="my-3" />

              <div className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Recent Pending Requests</div>
                <span className="badge bg-secondary">{leaveError ? "—" : pendingLeaves.length}</span>
              </div>

              {leaveLoading ? (
                <div className="text-muted mt-2">Loading…</div>
              ) : leaveError ? (<div className="text-muted mt-2">Refresh to load pending requests.</div>) : pendingLeaves.length === 0 ? (
                <div className="text-muted mt-2">No pending leave requests.</div>
              ) : (
                <div className="list-group list-group-flush mt-2">
                  {pendingLeaves.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      className="list-group-item px-0 d-flex align-items-center gap-3"
                    >
                      <div
                        className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                        style={{
                          width: 36,
                          height: 36,
                          background: "var(--edb-primary-soft)",
                          color: "var(--edb-accent-text)",
                          fontWeight: 800,
                        }}
                      >
                        {initials(r?.employee?.name)}
                      </div>
                      <div className="flex-fill">
                        <div className="fw-semibold">
                          {r?.employee?.name || "—"}{" "}
                          <span className="text-muted fw-normal">
                            · {getDeptName(r?.employee || {})}
                          </span>
                        </div>
                        <div className="small text-muted">
                          {r?.leaveType?.name || "Leave"} · {fmtDate(r.start_date)} →{" "}
                          {fmtDate(r.end_date)}
                          {r.is_without_pay ? " · WOP" : ""}
                        </div>
                        <div className="small text-primary">
                          <i className="bi bi-clock me-1" />Applied: {fmtAppliedAtIST(r)}
                        </div>
                      </div>
                      <span className="badge bg-warning text-dark">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div
            className="card shadow-sm rounded-4 border-0 h-100"
            style={{ background: "linear-gradient(135deg, var(--edb-surface), var(--edb-surface))" }}
          >
            <div className="card-body">
              <div className="text-uppercase small text-muted mb-2">Attendance on {date}</div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-2 bg-white">
                <div>
                  <div className="fw-semibold">Present</div>
                  <div className="text-muted small">Marked present on selected date</div>
                </div>
                <div className="display-6 fw-semibold mb-0 text-success">{loading || error ? "—" : kpis.present}</div>
              </div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-2 bg-white">
                <div>
                  <div className="fw-semibold">Absent</div>
                  <div className="text-muted small">Marked absent on selected date</div>
                </div>
                <div className="display-6 fw-semibold mb-0 text-danger">{loading || error ? "—" : kpis.absent}</div>
              </div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-2 bg-white">
                <div>
                  <div className="fw-semibold">On Leave</div>
                  <div className="text-muted small">
                    {kpis.shortLeave ? `${kpis.shortLeave} short leave` : "Leave entries on selected date"}
                  </div>
                </div>
                <div className="display-6 fw-semibold mb-0" style={{ color: "var(--edb-accent-text)" }}>
                  {loading || error ? "—" : kpis.leave}
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 bg-white">
                <div>
                  <div className="fw-semibold">Unmarked</div>
                  <div className="text-muted small">Attendance not marked</div>
                </div>
                <div className="display-6 fw-semibold mb-0 text-secondary">
                  {loading || error ? "—" : kpis.unmarked}
                </div>
              </div>

              <div className="mt-3 small text-muted">
                Active employees: <span className="fw-semibold">{loading || error ? "—" : kpis.total}</span>
                <br />
                Attendance marked:{" "}
                <span className="fw-semibold">{loading || error ? "—" : attendanceMarkedCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm rounded-4 border-0 mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
            <div className="d-flex flex-wrap align-items-end gap-3">
              <div>
                <label className="form-label mb-1">Department</label>
                <select
                  className="form-select"
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  {deptList.map((d) => (
                    <option key={String(d)} value={String(d)}>
                      {d === "all" ? "All Departments" : String(d)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label mb-1">Search</label>
                <input
                  className="form-control"
                  placeholder="Name / Code / Designation"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="text-muted small">
              <span className="fw-semibold">{filteredEmployees.length}</span> visible employees ·{" "}
              <span className="fw-semibold">{records.length}</span> attendance records on {date}
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="alert alert-light border mb-3">Loading attendance…</div>}
      {!loading && error && <div className="alert alert-danger mb-3">{error}</div>}

      {!loading && !error && (
        <>
          <div className="row g-3 mb-4">
            <div className="col-lg-6">
              <div className="card shadow-sm rounded-4 h-100 border-0">
                <div className="card-header bg-white border-0 fw-semibold">
                  Absent Teachers — {date}
                </div>
                <div className="card-body p-0">
                  {teacherAbsent.length === 0 ? (
                    <div className="p-3 text-muted">Great! No teachers marked absent.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {teacherAbsent.map((e) => (
                        <li
                          key={e.id}
                          className="list-group-item d-flex align-items-center gap-3"
                          style={{ background: "var(--edb-surface)" }}
                        >
                          <div
                            className="rounded-circle d-inline-flex justify-content-center align-items-center"
                            style={{
                              width: 36,
                              height: 36,
                              background: "var(--edb-primary-soft)",
                              color: "#b91c1c",
                              fontWeight: 700,
                            }}
                          >
                            {initials(e.name)}
                          </div>
                          <div className="flex-fill">
                            <div className="fw-semibold">{e.name}</div>
                            <div className="small text-muted">
                              {getDesignation(e)} · {getDeptName(e)}
                            </div>
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
              <div className="card shadow-sm rounded-4 h-100 border-0">
                <div className="card-header bg-white border-0 fw-semibold">
                  Teachers on Leave — {date}
                </div>
                <div className="card-body p-0">
                  {teacherOnLeave.length === 0 ? (
                    <div className="p-3 text-muted">No teacher leave entries on the selected date.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {teacherOnLeave.map((e) => {
                        const st = normalizeStatus(byId.get(Number(e.id))?.status);
                        const label = prettyStatus(st || "leave");

                        return (
                          <li
                            key={e.id}
                            className="list-group-item d-flex align-items-center gap-3"
                            style={{ background: "var(--edb-surface)" }}
                          >
                            <div
                              className="rounded-circle d-inline-flex justify-content-center align-items-center"
                              style={{
                                width: 36,
                                height: 36,
                                background: "var(--edb-primary-soft)",
                                color: "var(--edb-accent-text)",
                                fontWeight: 700,
                              }}
                            >
                              {initials(e.name)}
                            </div>
                            <div className="flex-fill">
                              <div className="fw-semibold">{e.name}</div>
                              <div className="small text-muted">
                                {getDesignation(e)} · {getDeptName(e)}
                              </div>
                            </div>
                            <span className="badge bg-warning text-dark text-uppercase">
                              {label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm rounded-4 mb-4 border-0">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>All Absent Employees — {date}</span>
              <span className="badge bg-danger">{allAbsent.length}</span>
            </div>
            <div className="card-body">
              {allAbsent.length === 0 ? (
                <div className="text-muted">No employees marked absent on the selected date.</div>
              ) : (
                <div className="row g-3">
                  {allAbsent.map((e) => (
                    <div key={e.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                      <div
                        className="border rounded-4 p-3 h-100 d-flex align-items-center gap-3 shadow-sm"
                        style={{
                          borderColor: "var(--edb-border)",
                          background: "var(--edb-surface)",
                        }}
                      >
                        <div
                          className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                          style={{
                            width: 44,
                            height: 44,
                            background: "var(--edb-primary-soft)",
                            color: "#b91c1c",
                            fontWeight: 700,
                          }}
                        >
                          {initials(e.name)}
                        </div>
                        <div className="flex-fill">
                          <div className="fw-semibold text-truncate" title={e.name}>
                            {e.name}
                          </div>
                          <div
                            className="small text-muted text-truncate"
                            title={`${getDeptName(e)} · ${getDesignation(e)}`}
                          >
                            {getDeptName(e)} · {getDesignation(e)}
                          </div>
                        </div>
                        <span className="badge bg-danger">Absent</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card shadow-sm rounded-4 mb-4 border-0">
            <div className="card-header bg-white border-0 fw-semibold d-flex justify-content-between align-items-center">
              <span>All Employees On Leave — {date}</span>
              <span className="badge bg-warning text-dark">{allOnLeave.length}</span>
            </div>
            <div className="card-body">
              {allOnLeave.length === 0 ? (
                <div className="text-muted">No leave entries on the selected date.</div>
              ) : (
                <div className="row g-3">
                  {allOnLeave.map((e) => {
                    const st = normalizeStatus(byId.get(Number(e.id))?.status);
                    const label = prettyStatus(st || "leave");

                    return (
                      <div key={e.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                        <div
                          className="border rounded-4 p-3 h-100 d-flex align-items-center gap-3 shadow-sm"
                          style={{
                            borderColor: "var(--edb-border)",
                            background: "var(--edb-surface)",
                          }}
                        >
                          <div
                            className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                            style={{
                              width: 44,
                              height: 44,
                              background: "var(--edb-primary-soft)",
                              color: "var(--edb-accent-text)",
                              fontWeight: 700,
                            }}
                          >
                            {initials(e.name)}
                          </div>
                          <div className="flex-fill">
                            <div className="fw-semibold text-truncate" title={e.name}>
                              {e.name}
                            </div>
                            <div
                              className="small text-muted text-truncate"
                              title={`${getDeptName(e)} · ${getDesignation(e)}`}
                            >
                              {getDeptName(e)} · {getDesignation(e)}
                            </div>
                          </div>
                          <span className="badge bg-warning text-dark text-uppercase">
                            {label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card shadow-sm rounded-4 border-0">
            <div className="card-header bg-white border-0 fw-semibold">
              Employee Directory — {selectedDept === "all" ? "All Departments" : selectedDept}
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 56 }}>#</th>
                    <th>Name</th>
                    <th>Employee ID</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Status</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center text-muted py-4">
                        No employees found for current filter/search.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((e, idx) => {
                      const rec = byId.get(Number(e.id)) || {};
                      const meta = getStatusMeta(rec.status);

                      return (
                        <tr key={e.id} style={meta.rowStyle}>
                          <td>{idx + 1}</td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div
                                className="rounded-circle d-inline-flex justify-content-center align-items-center"
                                style={{
                                  width: 30,
                                  height: 30,
                                  background: "var(--edb-surface)",
                                  color: "var(--edb-primary-text)",
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                {initials(e.name)}
                              </div>
                              <span className="fw-medium">{e.name}</span>
                            </div>
                          </td>
                          <td>{e?.employee_id || e?.code || "—"}</td>
                          <td>{getDeptName(e)}</td>
                          <td>{getDesignation(e)}</td>
                          <td>
                            <span className={`badge text-uppercase ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td>{rec.in_time || "—"}</td>
                          <td>{rec.out_time || "—"}</td>
                          <td
                            className="text-truncate"
                            style={{ maxWidth: 240 }}
                            title={rec.remarks || ""}
                          >
                            {rec.remarks || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
