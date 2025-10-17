// File: src/components/ParentDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import socket from "../socket";

/**
 * ParentDashboard
 * - Fetches parent's linked students from /users/me/students (re-checks on mount)
 * - Lets parent switch the active child (updates localStorage/sessionStorage: activeStudentId, username, students)
 * - Forces roles to include ["parent","student"] and sets activeRole="parent" to avoid wrong views
 * - Shows a compact overview for the selected child (fees, class/section, quick links)
 * - Uses programmatic navigation to guarantee context is set before opening student pages
 */

const API_URL = process.env.REACT_APP_API_URL || "";
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

const fmtINR = (v) =>
  isNaN(v)
    ? v ?? "-"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(Number(v || 0));

const getAdmissionFromStudent = (s) =>
  s?.admission_number || s?.admissionNumber || s?.username || "";

export default function ParentDashboard() {
  const navigate = useNavigate();

  const [students, setStudents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("students")) || [];
    } catch {
      return [];
    }
  });
  const [activeStudentId, setActiveStudentId] = useState(() => {
    const raw = localStorage.getItem("activeStudentId");
    return raw != null && raw !== "" ? Number(raw) : null;
  });

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Child-specific summaries
  const [feeSummary, setFeeSummary] = useState({
    totalDue: 0,
    totalRecv: 0,
    totalConcession: 0,
    vanDue: 0,
    vanRecv: 0,
  });

  const [profile, setProfile] = useState(null); // from fees payload basic block

  const activeStudent = useMemo(
    () => students.find((s) => String(s.id) === String(activeStudentId)) || students[0] || null,
    [students, activeStudentId]
  );

  const activeAdm = getAdmissionFromStudent(activeStudent);

  // --- Ensure roles include parent & student; default activeRole to parent for this view ---
  useEffect(() => {
    try {
      const roles = (() => {
        try { return JSON.parse(localStorage.getItem("roles")) || []; } catch { return []; }
      })();
      const set = new Set(roles.map((r) => String(r).toLowerCase()));
      let changed = false;
      if (!set.has("parent")) { set.add("parent"); changed = true; }
      if (!set.has("student")) { set.add("student"); changed = true; }
      if (changed) {
        const arr = Array.from(set);
        localStorage.setItem("roles", JSON.stringify(arr));
        sessionStorage.setItem("roles", JSON.stringify(arr));
      }
      if (localStorage.getItem("activeRole") !== "parent") {
        localStorage.setItem("activeRole", "parent");
      }
    } catch {}
  }, []);

  // --- Load/refresh students from API once (in case localStorage was stale) ---
  useEffect(() => {
    let cancelled = false;
    const loadStudents = async () => {
      try {
        if (!API_URL) throw new Error("API not configured");
        const res = await fetch(`${API_URL}/users/me/students`, { headers: authHeader() });
        if (!res.ok) throw new Error(`Failed ${res.status}`);
        const json = await res.json();
        const list = Array.isArray(json?.students) ? json.students : [];
        const actId = json?.activeStudentId ?? (list[0]?.id ?? null);
        if (!cancelled) {
          setStudents(list);
          setActiveStudentId(actId);
          // persist
          localStorage.setItem("students", JSON.stringify(list));
          sessionStorage.setItem("students", JSON.stringify(list));
          if (actId != null) {
            localStorage.setItem("activeStudentId", String(actId));
            sessionStorage.setItem("activeStudentId", String(actId));
          }
          window.dispatchEvent(
            new CustomEvent("students-updated", { detail: { activeStudentId: actId, students: list } })
          );
        }
      } catch (e) {
        if (!cancelled && students.length === 0) setErr(e.message || "Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadStudents();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Apply active student context to storage + sockets ---
  const applyActiveContext = (student) => {
    if (!student) return;
    const adm = getAdmissionFromStudent(student);
    if (adm) {
      localStorage.setItem("username", adm);
      sessionStorage.setItem("username", adm);
    }
    if (student.id != null) {
      localStorage.setItem("activeStudentId", String(student.id));
      sessionStorage.setItem("activeStudentId", String(student.id));
      window.dispatchEvent(new CustomEvent("active-student-changed", { detail: { activeStudentId: student.id } }));
    }
    try { socket.emit("joinRoom", { room: `student-${adm}` }); } catch {}
  };

  useEffect(() => {
    if (activeStudent) applyActiveContext(activeStudent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudentId, activeAdm]);

  // --- Fetch child summaries whenever child switches ---
  useEffect(() => {
    if (!API_URL || !activeAdm) return;

    let cancelled = false;
    const fetchFees = async () => {
      try {
        const res = await fetch(`${API_URL}/StudentsApp/admission/${activeAdm}/fees`, { headers: authHeader() });
        const data = await res.json();
        if (cancelled) return;

        setProfile({
          name: data?.studentName || activeStudent?.name || "-",
          class_name:
            data?.class_name || data?.className || activeStudent?.Class?.class_name || activeStudent?.class_name,
          section_name:
            data?.section_name || data?.sectionName || activeStudent?.Section?.section_name || activeStudent?.section_name,
          admissionNumber: data?.admissionNumber || activeAdm,
        });

        const fees = Array.isArray(data?.feeDetails) ? data.feeDetails : [];
        const totalDue = fees.reduce((s, f) => s + Number(f.finalAmountDue || 0), 0);
        const totalRecv = fees.reduce((s, f) => s + Number(f.totalFeeReceived || 0), 0);
        const totalConcession = fees.reduce((s, f) => s + Number(f.totalConcessionReceived || 0), 0);
        const vanObj = data?.vanFee || {};
        const vanCost = Number(vanObj.perHeadTotalDue || vanObj.transportCost || 0);
        const vanRecv = Number(vanObj.totalVanFeeReceived || 0);
        const vanCon = Number(vanObj.totalVanFeeConcession || 0);
        const vanDue = Math.max(vanCost - (vanRecv + vanCon), 0);
        setFeeSummary({ totalDue, totalRecv, totalConcession, vanDue, vanRecv });
      } catch (e) {
        // non-fatal
      }
    };

    setLoading(true);
    fetchFees().finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [API_URL, activeAdm]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePick = (id) => {
    setActiveStudentId(id);
    const chosen = students.find((s) => String(s.id) === String(id));
    if (chosen) applyActiveContext(chosen);
  };

  // Build a child-aware route with query params (studentId & admission)
  const withChildQuery = (path) => {
    if (!activeStudent) return path;
    const params = new URLSearchParams();
    if (activeStudentId != null) params.set("studentId", String(activeStudentId));
    if (activeAdm) params.set("admission", activeAdm);
    return `${path}?${params.toString()}`;
  };

  // Programmatic nav that guarantees correct context before route change
  const go = (path) => {
    if (activeStudent) applyActiveContext(activeStudent);
    navigate(withChildQuery(path), { replace: false });
  };

  if (!students.length && !loading) {
    return (
      <div className="container py-5 text-center">
        <h4>No linked students found</h4>
        <p className="text-muted small">Please contact school to link your children to your parent account.</p>
      </div>
    );
  }

  return (
    <div className="container-fluid px-2 px-sm-3 pb-5">
      {/* Header / Picker */}
      <div className="card border-0 shadow-lg rounded-4 my-3">
        <div className="card-body p-3 p-sm-4">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <div>
              <h5 className="mb-1">Parent Dashboard</h5>
              <div className="text-muted small">Select a student to view details</div>
            </div>

            <div className="ms-auto" />

            {/* Compact selector (dropdown for small screens) */}
            <div className="d-sm-none w-100">
              <select
                className="form-select form-select-lg"
                value={activeStudentId || ""}
                onChange={(e) => handlePick(Number(e.target.value))}
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({getAdmissionFromStudent(s)})
                  </option>
                ))}
              </select>
            </div>

            {/* Avatar cards selector for md+ */}
            <div className="d-none d-sm-flex flex-wrap gap-2">
              {students.map((s) => {
                const isActive = String(s.id) === String(activeStudentId);
                return (
                  <button
                    key={s.id}
                    className={`btn btn-light d-flex align-items-center gap-2 rounded-pill px-3 py-2 border ${
                      isActive ? "border-primary" : "border-200"
                    }`}
                    onClick={() => handlePick(s.id)}
                    title={getAdmissionFromStudent(s)}
                  >
                    <span
                      className="rounded-circle d-inline-flex align-items-center justify-content-center bg-primary text-white"
                      style={{ width: 36, height: 36, fontWeight: 700 }}
                    >
                      {(s.name || "S").slice(0, 1)}
                    </span>
                    <span className="text-start">
                      <div className="fw-semibold small">{s.name}</div>
                      <div className="text-muted xsmall">
                        {s.Class?.class_name || s.class_name || "-"} {s.Section?.section_name || s.section_name || ""}
                      </div>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Child overview */}
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-lg rounded-4 h-100">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-3">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center bg-primary text-white"
                  style={{ width: 56, height: 56, fontWeight: 800, fontSize: 20 }}
                >
                  {(profile?.name || activeStudent?.name || "S").slice(0, 1)}
                </div>
                <div>
                  <div className="h5 mb-1">{profile?.name || activeStudent?.name || "—"}</div>
                  <div className="text-muted small">
                    Adm: <strong>{profile?.admissionNumber || activeAdm}</strong>
                  </div>
                  <div className="text-muted small">
                    Class: <strong>{profile?.class_name || "—"}</strong> Section: <strong>{profile?.section_name || "—"}</strong>
                  </div>
                </div>
              </div>

              <hr />

              <div className="d-grid gap-2">
                <button onClick={() => go("/student-attendance")} className="btn btn-outline-primary rounded-pill">
                  <i className="bi bi-calendar2-check me-1" /> Attendance
                </button>
                <button onClick={() => go("/my-assignments")} className="btn btn-outline-primary rounded-pill">
                  <i className="bi bi-journal-check me-1" /> Assignments
                </button>
                <button onClick={() => go("/student-fee")} className="btn btn-outline-primary rounded-pill">
                  <i className="bi bi-cash-coin me-1" /> Fees
                </button>
                <button onClick={() => go("/student-diary")} className="btn btn-outline-primary rounded-pill">
                  <i className="bi bi-journal-text me-1" /> Diary
                </button>
                <button onClick={() => go("/student-timetable-display")} className="btn btn-outline-primary rounded-pill">
                  <i className="bi bi-clock-history me-1" /> Timetable
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-lg rounded-4 h-100">
            <div className="card-header bg-gradient-primary text-white rounded-top-4 d-flex align-items-center gap-2">
              <i className="bi bi-cash-coin fs-5"></i>
              Fees Snapshot
            </div>
            <div className="card-body p-4">
              {loading ? (
                <div className="placeholder-glow">
                  <span className="placeholder col-12 mb-2"></span>
                  <span className="placeholder col-8 mb-2"></span>
                  <span className="placeholder col-10"></span>
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                      <div className="card-body text-center p-3">
                        <div className="badge text-bg-danger mb-2">Total Due</div>
                        <div className="h5 mb-0">{fmtINR(feeSummary.totalDue)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                      <div className="card-body text-center p-3">
                        <div className="badge text-bg-success mb-2">Received</div>
                        <div className="h5 mb-0">{fmtINR(feeSummary.totalRecv)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                      <div className="card-body text-center p-3">
                        <div className="badge text-bg-warning mb-2">Concession</div>
                        <div className="h5 mb-0">{fmtINR(feeSummary.totalConcession)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="card border-0 shadow-sm rounded-4 h-100">
                      <div className="card-body text-center p-3">
                        <div className="badge text-bg-info mb-2">Van Due</div>
                        <div className="h5 mb-0">{fmtINR(feeSummary.vanDue)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-end mt-3 pt-2 border-top">
                <button className="btn btn-outline-light border rounded-pill px-4" onClick={() => go("/student-fee") }>
                  <i className="bi bi-arrow-right me-1"></i> Open Fees Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="alert alert-info mt-3 rounded-4" role="alert">
        <div className="d-flex gap-2 align-items-start">
          <i className="bi bi-info-circle mt-1"></i>
          <div>
            You can switch between children at the top. The student pages (Attendance, Fees, Diary, etc.) open in the
            context of the currently selected child.
          </div>
        </div>
      </div>

      <style>{`
        .xsmall{ font-size: .75rem; }
        .bg-gradient-primary{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
      `}</style>
    </div>
  );
}
