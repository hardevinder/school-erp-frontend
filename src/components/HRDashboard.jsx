// src/components/HRDashboard.jsx — Attendance + Latest Leave Request Spotlight
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

export default function HRDashboard() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [employees, setEmployees] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [pendingLeaves, setPendingLeaves] = useState([]);

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

  /* =========================
     Load employees
  ========================= */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await api.get("/employees");
        const all = res?.data?.employees || [];
        const active = all.filter(
          (e) => (e?.status || "enabled").toLowerCase() !== "disabled"
        );
        if (mounted) setEmployees(active);
      } catch (e) {
        if (mounted) {
          setError(
            e?.response?.data?.message || e.message || "Failed to load employees"
          );
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     Load attendance for date
  ========================= */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/employee-attendance?date=${date}`);
        if (mounted) {
          setRecords(Array.isArray(res?.data?.records) ? res.data.records : []);
        }
      } catch (e) {
        if (mounted) {
          setError(
            e?.response?.data?.message || e.message || "Failed to load attendance"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [date]);

  /* =========================
     Load latest pending leaves
  ========================= */
  const fetchPendingLeaves = async () => {
    setLeaveLoading(true);
    try {
      const res = await api.get("/employee-leave-requests/all", {
        params: { status: "pending" },
      });

      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];

      const sorted = [...rows].sort((a, b) => {
        const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return (Number(b?.id) || 0) - (Number(a?.id) || 0);
      });

      setPendingLeaves(sorted.slice(0, 5));
    } catch {
      setPendingLeaves([]);
    } finally {
      setLeaveLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingLeaves();
  }, []);

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
      fetchPendingLeaves();
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
      const st = normalizeStatus(byId.get(emp.id)?.status);

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
        const st = normalizeStatus(byId.get(e.id)?.status);
        return isTeacher(e) && st === "absent";
      }),
    [employees, byId]
  );

  const teacherOnLeave = useMemo(
    () =>
      employees.filter((e) => {
        const st = normalizeStatus(byId.get(e.id)?.status);
        return isTeacher(e) && onLeaveSet.has(st);
      }),
    [employees, byId]
  );

  const allAbsent = useMemo(
    () =>
      employees.filter((e) => normalizeStatus(byId.get(e.id)?.status) === "absent"),
    [employees, byId]
  );

  const allOnLeave = useMemo(
    () =>
      employees.filter((e) => onLeaveSet.has(normalizeStatus(byId.get(e.id)?.status))),
    [employees, byId]
  );

  const attendanceMarkedCount = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const st = normalizeStatus(byId.get(emp.id)?.status);
      return st ? acc + 1 : acc;
    }, 0);
  }, [employees, byId]);

  const shiftDay = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const goToday = () => setDate(new Date().toISOString().split("T")[0]);

  const latestLeave = pendingLeaves[0] || null;
  const latestEmpName = latestLeave?.employee?.name || "—";
  const latestDeptName = getDeptName(latestLeave?.employee || {});
  const latestLeaveType =
    latestLeave?.leaveType?.name || latestLeave?.leave_type?.name || "—";

  return (
    <div className="container-fluid px-3 py-3">
      <div
        className="d-flex flex-wrap align-items-center justify-content-between mb-3 rounded-4 p-3 shadow-sm"
        style={{
          background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <div>
          <h4 className="mb-1 fw-bold">HR Dashboard</h4>
          <div className="opacity-75 small">
            Attendance, absentees, leave tracking and recent leave approvals
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label className="form-label mb-1 small opacity-75">Date</label>
            <input
              type="date"
              className="form-control"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ borderRadius: 12, minWidth: 170 }}
            />
          </div>
          <div className="d-flex gap-2 pb-1">
            <button className="btn btn-light" type="button" onClick={() => shiftDay(-1)}>
              ◀
            </button>
            <button className="btn btn-outline-light" type="button" onClick={goToday}>
              Today
            </button>
            <button className="btn btn-light" type="button" onClick={() => shiftDay(1)}>
              ▶
            </button>
          </div>
        </div>
      </div>

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
                  ) : !latestLeave ? (
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
                            background: "#eef2ff",
                            color: "#3730a3",
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
                    </>
                  )}
                </div>

                {latestLeave && (
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
                      onClick={fetchPendingLeaves}
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
                <span className="badge bg-secondary">{pendingLeaves.length}</span>
              </div>

              {leaveLoading ? (
                <div className="text-muted mt-2">Loading…</div>
              ) : pendingLeaves.length === 0 ? (
                <div className="text-muted mt-2">No pending leave requests.</div>
              ) : (
                <div className="list-group list-group-flush mt-2">
                  {pendingLeaves.map((r) => (
                    <div
                      key={r.id}
                      className="list-group-item px-0 d-flex align-items-center gap-3"
                    >
                      <div
                        className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                        style={{
                          width: 36,
                          height: 36,
                          background: "#fef9c3",
                          color: "#a16207",
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
            style={{ background: "linear-gradient(135deg, #f8fafc, #eef2ff)" }}
          >
            <div className="card-body">
              <div className="text-uppercase small text-muted mb-2">Today at a glance</div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-2 bg-white">
                <div>
                  <div className="fw-semibold">Present</div>
                  <div className="text-muted small">Marked present today</div>
                </div>
                <div className="display-6 fw-semibold mb-0 text-success">{kpis.present}</div>
              </div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-2 bg-white">
                <div>
                  <div className="fw-semibold">Absent</div>
                  <div className="text-muted small">Marked absent today</div>
                </div>
                <div className="display-6 fw-semibold mb-0 text-danger">{kpis.absent}</div>
              </div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-2 bg-white">
                <div>
                  <div className="fw-semibold">On Leave</div>
                  <div className="text-muted small">
                    {kpis.shortLeave ? `${kpis.shortLeave} short leave` : "Leave entries today"}
                  </div>
                </div>
                <div className="display-6 fw-semibold mb-0" style={{ color: "#a16207" }}>
                  {kpis.leave}
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 bg-white">
                <div>
                  <div className="fw-semibold">Unmarked</div>
                  <div className="text-muted small">Attendance not marked</div>
                </div>
                <div className="display-6 fw-semibold mb-0 text-secondary">
                  {kpis.unmarked}
                </div>
              </div>

              <div className="mt-3 small text-muted">
                Active employees: <span className="fw-semibold">{kpis.total}</span>
                <br />
                Attendance marked:{" "}
                <span className="fw-semibold">{attendanceMarkedCount}</span>
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
                          style={{ background: "#fff7f7" }}
                        >
                          <div
                            className="rounded-circle d-inline-flex justify-content-center align-items-center"
                            style={{
                              width: 36,
                              height: 36,
                              background: "#fee2e2",
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
                    <div className="p-3 text-muted">No teacher leave entries today.</div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {teacherOnLeave.map((e) => {
                        const st = normalizeStatus(byId.get(e.id)?.status);
                        const label = prettyStatus(st || "leave");

                        return (
                          <li
                            key={e.id}
                            className="list-group-item d-flex align-items-center gap-3"
                            style={{ background: "#fffdf0" }}
                          >
                            <div
                              className="rounded-circle d-inline-flex justify-content-center align-items-center"
                              style={{
                                width: 36,
                                height: 36,
                                background: "#fef3c7",
                                color: "#a16207",
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
                <div className="text-muted">No one is absent today. 🎉</div>
              ) : (
                <div className="row g-3">
                  {allAbsent.map((e) => (
                    <div key={e.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                      <div
                        className="border rounded-4 p-3 h-100 d-flex align-items-center gap-3 shadow-sm"
                        style={{
                          borderColor: "#fee2e2",
                          background: "#fff7f7",
                        }}
                      >
                        <div
                          className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                          style={{
                            width: 44,
                            height: 44,
                            background: "#fee2e2",
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
                <div className="text-muted">No leave entries today.</div>
              ) : (
                <div className="row g-3">
                  {allOnLeave.map((e) => {
                    const st = normalizeStatus(byId.get(e.id)?.status);
                    const label = prettyStatus(st || "leave");

                    return (
                      <div key={e.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                        <div
                          className="border rounded-4 p-3 h-100 d-flex align-items-center gap-3 shadow-sm"
                          style={{
                            borderColor: "#fde68a",
                            background: "#fffdf0",
                          }}
                        >
                          <div
                            className="rounded-circle d-inline-flex justify-content-center align-items-center flex-shrink-0"
                            style={{
                              width: 44,
                              height: 44,
                              background: "#fef3c7",
                              color: "#a16207",
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
                      const rec = byId.get(e.id) || {};
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
                                  background: "#eef2ff",
                                  color: "#3730a3",
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