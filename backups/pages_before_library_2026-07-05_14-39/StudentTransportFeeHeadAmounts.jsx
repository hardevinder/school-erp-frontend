import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";

const safeStr = (v) => String(v ?? "").trim();

const formatCurrency = (v) => {
  const n = Number(v || 0);
  return `₹${Number.isFinite(n) ? n.toFixed(2) : "0.00"}`;
};

const getSessionLabel = (s) => {
  if (!s) return "—";
  return safeStr(s.name || s.session || s.label || "—");
};

const getFeeHeadLabel = (h) => {
  if (!h) return "—";
  return safeStr(h.fee_heading || h.name || "—");
};

const getTransportLabel = (t) => {
  if (!t) return "—";
  const place = safeStr(t.Villages || t.villages || t.RouteName || t.route_name || "");
  const cost = t.Cost ?? t.cost;
  if (place && cost !== undefined && cost !== null && String(cost).trim() !== "") {
    return `${place} — ₹${Number(cost)}`;
  }
  return place || "—";
};

const normalizeStudentRow = (s) => {
  const id = Number(s?.id ?? s?.student_id ?? s?.Student_ID ?? 0);
  return {
    ...s,
    id,
    name: safeStr(s?.name || s?.student_name || s?.Student_Name || s?.full_name || "—"),
    admission_number: safeStr(
      s?.admission_number || s?.AdmissionNumber || s?.adm_no || s?.admissionNo || ""
    ),
    father_name: safeStr(s?.father_name || s?.Father_Name || s?.fatherName || ""),
    class_name: safeStr(
      s?.Class?.class_name ||
        s?.class_name ||
        s?.Class_Name ||
        s?.className ||
        s?.class?.class_name ||
        ""
    ),
    section_name: safeStr(
      s?.Section?.section_name ||
        s?.section_name ||
        s?.Section_Name ||
        s?.sectionName ||
        s?.section?.section_name ||
        ""
    ),
  };
};

const asStudentArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.students)) return data.students;
  if (Array.isArray(data?.data?.students)) return data.data.students;
  return [];
};

const StudentTransportFeeHeadAmounts = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);

  const [sessions, setSessions] = useState([]);
  const [feeHeads, setFeeHeads] = useState([]);
  const [transportations, setTransportations] = useState([]);

  const [filters, setFilters] = useState({
    q: "",
    session_id: "",
    fee_head_id: "",
  });

  const [form, setForm] = useState({
    id: null,
    student_id: "",
    session_id: "",
    fee_head_id: "",
    transportation_id: "",
    amount: "",
    remarks: "",
  });

  const [selectedStudentMeta, setSelectedStudentMeta] = useState(null);
  const [sbQuery, setSbQuery] = useState("");
  const [sbResults, setSbResults] = useState([]);
  const [sbOpen, setSbOpen] = useState(false);
  const [sbActive, setSbActive] = useState(-1);

  const sbWrapRef = useRef(null);
  const debounceRef = useRef(null);

  const activeSession = useMemo(
    () => sessions.find((s) => Boolean(s?.is_active || s?.isActive)) || null,
    [sessions]
  );

  const selectedSession = useMemo(
    () => sessions.find((s) => String(s.id) === String(form.session_id)) || null,
    [sessions, form.session_id]
  );

  const selectedFeeHead = useMemo(
    () => feeHeads.find((f) => String(f.id) === String(form.fee_head_id)) || null,
    [feeHeads, form.fee_head_id]
  );

  const selectedTransportation = useMemo(
    () =>
      transportations.find((t) => String(t.id) === String(form.transportation_id)) || null,
    [transportations, form.transportation_id]
  );

  const stats = useMemo(() => {
    const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const uniqueStudents = new Set(rows.map((r) => String(r.student_id))).size;
    return {
      totalRows: rows.length,
      uniqueStudents,
      totalAmount,
      activeSession: activeSession ? getSessionLabel(activeSession) : "—",
    };
  }, [rows, activeSession]);

  const debounce = (fn, ms = 300) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fn, ms);
  };

  const resetForm = () => {
    setForm({
      id: null,
      student_id: "",
      session_id: activeSession?.id ? String(activeSession.id) : "",
      fee_head_id: "",
      transportation_id: "",
      amount: "",
      remarks: "",
    });
    setSelectedStudentMeta(null);
    setSbQuery("");
    setSbResults([]);
    setSbOpen(false);
    setSbActive(-1);
  };

  const fetchMasters = async () => {
    const [sessionsRes, feeHeadsRes, transportRes] = await Promise.all([
      api.get("/sessions"),
      api.get("/fee-headings"),
      api.get("/transportations"),
    ]);

    setSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : sessionsRes.data?.data || []);
    setFeeHeads(Array.isArray(feeHeadsRes.data) ? feeHeadsRes.data : feeHeadsRes.data?.data || []);
    setTransportations(
      Array.isArray(transportRes.data) ? transportRes.data : transportRes.data?.data || []
    );
  };

  const fetchRows = async () => {
    const params = {};
    if (safeStr(filters.q)) params.q = safeStr(filters.q);
    if (safeStr(filters.session_id)) params.session_id = filters.session_id;
    if (safeStr(filters.fee_head_id)) params.fee_head_id = filters.fee_head_id;

    const res = await api.get("/student-transport-fee-head-amounts", { params });
    setRows(Array.isArray(res.data) ? res.data : res.data?.data || []);
  };

  const refreshAll = async (showToast = false) => {
    setLoading(true);
    try {
      await Promise.all([fetchMasters(), fetchRows()]);
      if (showToast) {
        Swal.fire({
          icon: "success",
          title: "Refreshed",
          text: "Latest override data loaded successfully.",
          timer: 1400,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error("refreshAll error:", error);
      Swal.fire("Error", "Failed to load transport fee head data.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsInline = async (term) => {
    const raw = safeStr(term);
    if (!raw) {
      setSbResults([]);
      setSbOpen(false);
      setSbActive(-1);
      return;
    }

    try {
      const params = { q: raw, limit: 25 };
      if (form.session_id) params.session_id = form.session_id;
      const { data } = await api.get("/students/search", { params });
      const list = asStudentArray(data).map(normalizeStudentRow).filter((s) => s.id);
      setSbResults(list);
      setSbOpen(true);
      setSbActive(list.length ? 0 : -1);
    } catch (error) {
      console.error("students search failed", error);
      setSbResults([]);
      setSbOpen(false);
      setSbActive(-1);
    }
  };

  const handlePickStudent = (student) => {
    if (!student) return;
    const normalized = normalizeStudentRow(student);
    setSelectedStudentMeta(normalized);
    setForm((prev) => ({ ...prev, student_id: String(normalized.id) }));
    setSbQuery(
      `${safeStr(normalized.name)}${normalized.admission_number ? ` (${safeStr(normalized.admission_number)})` : ""}`
    );
    setSbResults([]);
    setSbOpen(false);
    setSbActive(-1);
  };

  useEffect(() => {
    refreshAll(false);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!form.session_id && activeSession?.id) {
      setForm((prev) => ({ ...prev, session_id: String(activeSession.id) }));
    }
  }, [activeSession, form.session_id]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!sbWrapRef.current) return;
      if (!sbWrapRef.current.contains(e.target)) setSbOpen(false);
    };
    document.addEventListener("click", onDocClick, { capture: true });
    return () => document.removeEventListener("click", onDocClick, { capture: true });
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = async () => {
    setLoading(true);
    try {
      await fetchRows();
    } catch (error) {
      console.error("applyFilters error:", error);
      Swal.fire("Error", "Failed to filter override records.", "error");
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = async () => {
    setFilters({ q: "", session_id: "", fee_head_id: "" });
    setLoading(true);
    try {
      const res = await api.get("/student-transport-fee-head-amounts");
      setRows(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (error) {
      console.error("clearFilters error:", error);
      Swal.fire("Error", "Failed to clear filters.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = (row) => {
    setForm({
      id: row.id,
      student_id: row.student_id ? String(row.student_id) : "",
      session_id: row.session_id ? String(row.session_id) : activeSession?.id ? String(activeSession.id) : "",
      fee_head_id: row.fee_head_id ? String(row.fee_head_id) : "",
      transportation_id: row.transportation_id ? String(row.transportation_id) : "",
      amount: row.amount ?? "",
      remarks: row.remarks || "",
    });

    const normalizedStudent = row?.Student ? normalizeStudentRow(row.Student) : null;
    setSelectedStudentMeta(normalizedStudent);
    setSbQuery(
      normalizedStudent
        ? `${safeStr(normalizedStudent.name)}${normalizedStudent.admission_number ? ` (${safeStr(normalizedStudent.admission_number)})` : ""}`
        : ""
    );
    setSbResults([]);
    setSbOpen(false);
    setSbActive(-1);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "Delete override?",
      text: "This will remove the fixed transport amount override for this fee head.",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#d33",
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      await api.delete(`/student-transport-fee-head-amounts/${row.id}`);
      await fetchRows();
      Swal.fire({
        icon: "success",
        title: "Deleted",
        text: "Override deleted successfully.",
        timer: 1300,
        showConfirmButton: false,
      });

      if (String(form.id) === String(row.id)) {
        resetForm();
      }
    } catch (error) {
      console.error("handleDelete error:", error);
      Swal.fire("Error", "Failed to delete override.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.student_id) {
      return Swal.fire("Validation", "Please select a student.", "warning");
    }
    if (!form.session_id) {
      return Swal.fire("Validation", "Please select a session.", "warning");
    }
    if (!form.fee_head_id) {
      return Swal.fire("Validation", "Please select a fee head.", "warning");
    }
    if (form.amount === "" || form.amount === null || form.amount === undefined) {
      return Swal.fire("Validation", "Please enter amount.", "warning");
    }

    setSaving(true);
    try {
      const payload = {
        student_id: Number(form.student_id),
        session_id: Number(form.session_id),
        fee_head_id: Number(form.fee_head_id),
        amount: Number(form.amount),
        remarks: safeStr(form.remarks) || null,
      };

      if (
        form.transportation_id !== "" &&
        form.transportation_id !== null &&
        form.transportation_id !== undefined
      ) {
        payload.transportation_id = Number(form.transportation_id);
      }

      const res = await api.post("/student-transport-fee-head-amounts/upsert", payload);
      await fetchRows();

      Swal.fire({
        icon: "success",
        title: form.id ? "Updated" : "Saved",
        text:
          res?.data?.message ||
          (form.id
            ? "Transport fee head override updated successfully."
            : "Transport fee head override created successfully."),
        timer: 1500,
        showConfirmButton: false,
      });

      resetForm();
    } catch (error) {
      console.error("handleSubmit error:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.details ||
        "Failed to save transport fee head override.";
      Swal.fire("Error", msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid mt-3">
      <style>{`
        .stfha-shell { padding-bottom: 18px; }
        .stfha-hero {
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 18px;
          padding: 16px;
          background: linear-gradient(180deg, #ffffff, #f7fbff);
          box-shadow: 0 8px 24px rgba(0,0,0,0.05);
          margin-bottom: 14px;
        }
        .stfha-title { font-weight: 800; color: #12263f; }
        .stfha-subtitle { font-size: 13px; color: #5d6c7b; margin-top: 4px; }
        .stfha-card {
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
        }
        .stfha-stat {
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          background: #fff;
          padding: 12px 14px;
          min-height: 84px;
        }
        .stfha-stat-label { font-size: 12px; font-weight: 700; color: #6c7885; }
        .stfha-stat-value { font-size: 24px; font-weight: 800; color: #132c49; margin-top: 4px; }
        .stfha-label { font-size: 12px; font-weight: 800; color: #394655; margin-bottom: 6px; }
        .stfha-input, .stfha-select, .stfha-textarea {
          border-radius: 12px !important;
          border: 1px solid rgba(0,0,0,0.12) !important;
        }
        .stfha-input, .stfha-select { height: 42px; }
        .stfha-textarea { min-height: 92px; resize: vertical; }
        .stfha-input:focus, .stfha-select:focus, .stfha-textarea:focus {
          border-color: rgba(13,110,253,0.45) !important;
          box-shadow: 0 0 0 0.14rem rgba(13,110,253,0.10) !important;
        }
        .stfha-pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(13,110,253,0.07);
          color: #20508f;
          border: 1px solid rgba(13,110,253,0.12);
          font-size: 12px;
          font-weight: 700;
        }
        .stfha-chip-green {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(25,135,84,0.08);
          color: #166d43;
          border: 1px solid rgba(25,135,84,0.14);
          font-size: 12px;
          font-weight: 700;
        }
        .stfha-toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .stfha-btn { border-radius: 10px; padding: 8px 12px; font-weight: 700; font-size: 12px; }
        .stfha-table thead th {
          background: #f4f7fb;
          color: #283646;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          padding-top: 12px;
          padding-bottom: 12px;
        }
        .stfha-table tbody td { font-size: 13px; vertical-align: middle; padding-top: 10px; padding-bottom: 10px; }
        .stfha-row:hover { background: rgba(13,110,253,0.035); }
        .stfha-loading {
          position: fixed;
          inset: 0;
          background: rgba(255,255,255,0.56);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .stfha-loading-box {
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.10);
          font-weight: 800;
          color: #183153;
        }
        .stfha-form-meta {
          border: 1px dashed rgba(0,0,0,0.12);
          border-radius: 14px;
          background: #fafcff;
          padding: 10px 12px;
          font-size: 12px;
          color: #4f5c6b;
        }
        .sb-autocomplete { position: relative; }
        .sb-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          max-height: 280px;
          overflow: auto;
          z-index: 1200;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: .75rem;
          margin-top: 4px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .sb-item {
          padding: .6rem .8rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sb-item:hover, .sb-item.active { background: #f6f7f9; }
        .sb-primary-line {
          font-weight: 700;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: #1f2f45;
        }
        .sb-secondary-line {
          font-size: 12px;
          color: #6c757d;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sb-pill {
          font-weight: 600;
          font-size: 12px;
          color: #495057;
          background: #eef1f5;
          border-radius: 999px;
          padding: 1px 8px;
          margin-left: 6px;
        }
        .student-brief-inline {
          border: 1px solid rgba(13,110,253,0.12);
          background: #f8fbff;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 12px;
          color: #334155;
        }
      `}</style>

      {loading && (
        <div className="stfha-loading">
          <div className="stfha-loading-box">Please wait…</div>
        </div>
      )}

      <div className="stfha-shell">
        <div className="stfha-hero">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <div className="stfha-title h4 m-0">Transport Fee Head Overrides</div>
              <div className="stfha-subtitle">
                Keep your old transport logic as fallback and define fixed transport amounts only
                for students, sessions, and fee heads where route changed or transport was left.
              </div>
            </div>

            <div className="stfha-toolbar">
              <button className="btn btn-outline-secondary stfha-btn" onClick={() => refreshAll(true)}>
                Refresh
              </button>
              <button
                className="btn btn-outline-dark stfha-btn"
                onClick={resetForm}
                disabled={saving}
              >
                New Entry
              </button>
            </div>
          </div>

          <div className="row g-3 mt-1">
            <div className="col-6 col-md-3">
              <div className="stfha-stat">
                <div className="stfha-stat-label">Override Rows</div>
                <div className="stfha-stat-value">{stats.totalRows}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stfha-stat">
                <div className="stfha-stat-label">Students Covered</div>
                <div className="stfha-stat-value">{stats.uniqueStudents}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stfha-stat">
                <div className="stfha-stat-label">Override Total</div>
                <div className="stfha-stat-value">{formatCurrency(stats.totalAmount)}</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="stfha-stat">
                <div className="stfha-stat-label">Active Session</div>
                <div className="stfha-stat-value" style={{ fontSize: 18 }}>{stats.activeSession}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-4">
            <div className="stfha-card p-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="h6 m-0" style={{ fontWeight: 800, color: "#203247" }}>
                  {form.id ? "Edit Override" : "Create Override"}
                </div>
                {form.id ? <span className="stfha-pill">Editing ID: {form.id}</span> : null}
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label stfha-label">Session</label>
                  <select
                    className="form-select stfha-select"
                    value={form.session_id}
                    onChange={(e) => handleFormChange("session_id", e.target.value)}
                  >
                    <option value="">-- Select Session --</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {getSessionLabel(session)}{session.is_active || session.isActive ? " (Active)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label stfha-label">Search Student</label>
                  <div className="sb-autocomplete" ref={sbWrapRef}>
                    <input
                      className="form-control stfha-input"
                      placeholder="Type name or admission no."
                      value={sbQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSbQuery(value);
                        if (
                          selectedStudentMeta &&
                          value !==
                            `${safeStr(selectedStudentMeta.name)}${selectedStudentMeta.admission_number ? ` (${safeStr(selectedStudentMeta.admission_number)})` : ""}`
                        ) {
                          setSelectedStudentMeta(null);
                          setForm((prev) => ({ ...prev, student_id: "" }));
                        }
                        debounce(() => fetchStudentsInline(value), 300);
                      }}
                      onFocus={() => {
                        if (sbResults.length) setSbOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (!sbOpen || !sbResults.length) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setSbActive((idx) => (idx + 1) % sbResults.length);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setSbActive((idx) => (idx - 1 + sbResults.length) % sbResults.length);
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const student = sbResults[sbActive] || sbResults[0];
                          if (student) handlePickStudent(student);
                        } else if (e.key === "Escape") {
                          setSbOpen(false);
                        }
                      }}
                      autoComplete="off"
                    />

                    {sbOpen && (
                      <div className="sb-menu">
                        {sbResults.length === 0 ? (
                          <div className="sb-item">
                            <div className="sb-secondary-line">No student found.</div>
                          </div>
                        ) : (
                          sbResults.map((student, idx) => (
                            <div
                              key={student.id}
                              className={`sb-item ${idx === sbActive ? "active" : ""}`}
                              onMouseEnter={() => setSbActive(idx)}
                              onClick={() => handlePickStudent(student)}
                            >
                              <div className="sb-primary-line">
                                {safeStr(student.name)}
                                {student.admission_number ? (
                                  <span className="sb-pill">{safeStr(student.admission_number)}</span>
                                ) : null}
                              </div>
                              <div className="sb-secondary-line">
                                Class: {safeStr(student.class_name) || "—"}
                                {safeStr(student.section_name) ? ` • Section: ${safeStr(student.section_name)}` : ""}
                                {safeStr(student.father_name) ? ` • Father: ${safeStr(student.father_name)}` : ""}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="form-text mt-1">
                    Uses selected session for better matches
                    {selectedSession ? ` (${getSessionLabel(selectedSession)})` : ""}.
                  </div>
                </div>

                {selectedStudentMeta ? (
                  <div className="student-brief-inline mb-3 d-flex flex-wrap gap-2">
                    <span><strong>Name:</strong> {selectedStudentMeta.name || "—"}</span>
                    <span>| <strong>Adm No:</strong> {selectedStudentMeta.admission_number || "—"}</span>
                    <span>| <strong>Class:</strong> {selectedStudentMeta.class_name || "—"}</span>
                    <span>| <strong>Section:</strong> {selectedStudentMeta.section_name || "—"}</span>
                    <span>| <strong>Father:</strong> {selectedStudentMeta.father_name || "—"}</span>
                  </div>
                ) : null}

                <div className="mb-3">
                  <label className="form-label stfha-label">Fee Head</label>
                  <select
                    className="form-select stfha-select"
                    value={form.fee_head_id}
                    onChange={(e) => handleFormChange("fee_head_id", e.target.value)}
                  >
                    <option value="">-- Select Fee Head --</option>
                    {feeHeads.map((feeHead) => (
                      <option key={feeHead.id} value={feeHead.id}>
                        {getFeeHeadLabel(feeHead)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label stfha-label">Transportation (optional)</label>
                  <select
                    className="form-select stfha-select"
                    value={form.transportation_id}
                    onChange={(e) => handleFormChange("transportation_id", e.target.value)}
                  >
                    <option value="">-- Select Transportation --</option>
                    {transportations.map((transport) => (
                      <option key={transport.id} value={transport.id}>
                        {getTransportLabel(transport)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label stfha-label">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control stfha-input"
                    placeholder="Enter fixed amount"
                    value={form.amount}
                    onChange={(e) => handleFormChange("amount", e.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label stfha-label">Remarks</label>
                  <textarea
                    className="form-control stfha-textarea"
                    placeholder="Optional note, e.g. route changed from July or transport left from September"
                    value={form.remarks}
                    onChange={(e) => handleFormChange("remarks", e.target.value)}
                  />
                </div>

                <div className="stfha-form-meta mb-3">
                  <div><b>Student:</b> {selectedStudentMeta ? `${safeStr(selectedStudentMeta.name)}${selectedStudentMeta.admission_number ? ` (${safeStr(selectedStudentMeta.admission_number)})` : ""}` : "—"}</div>
                  <div><b>Session:</b> {selectedSession ? getSessionLabel(selectedSession) : "—"}</div>
                  <div><b>Fee Head:</b> {selectedFeeHead ? getFeeHeadLabel(selectedFeeHead) : "—"}</div>
                  <div><b>Transport:</b> {selectedTransportation ? getTransportLabel(selectedTransportation) : "—"}</div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button className="btn btn-primary stfha-btn" type="submit" disabled={saving}>
                    {saving ? "Saving..." : form.id ? "Update Override" : "Save Override"}
                  </button>
                  <button
                    className="btn btn-outline-secondary stfha-btn"
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Reset
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="stfha-card p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="h6 m-0" style={{ fontWeight: 800, color: "#203247" }}>
                  Search / Filter Overrides
                </div>
                <span className="stfha-pill">Live override records</span>
              </div>

              <div className="row g-3">
                <div className="col-md-5">
                  <label className="form-label stfha-label">Search</label>
                  <input
                    className="form-control stfha-input"
                    placeholder="Search student, admission no, fee head, village, remarks..."
                    value={filters.q}
                    onChange={(e) => handleFilterChange("q", e.target.value)}
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label stfha-label">Session</label>
                  <select
                    className="form-select stfha-select"
                    value={filters.session_id}
                    onChange={(e) => handleFilterChange("session_id", e.target.value)}
                  >
                    <option value="">All Sessions</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {getSessionLabel(session)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-2">
                  <label className="form-label stfha-label">Fee Head</label>
                  <select
                    className="form-select stfha-select"
                    value={filters.fee_head_id}
                    onChange={(e) => handleFilterChange("fee_head_id", e.target.value)}
                  >
                    <option value="">All Fee Heads</option>
                    {feeHeads.map((feeHead) => (
                      <option key={feeHead.id} value={feeHead.id}>
                        {getFeeHeadLabel(feeHead)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-2 d-flex align-items-end gap-2">
                  <button className="btn btn-outline-primary stfha-btn w-100" onClick={applyFilters}>
                    Apply
                  </button>
                </div>
              </div>

              <div className="mt-3 d-flex gap-2 flex-wrap">
                <button className="btn btn-outline-dark stfha-btn" onClick={clearFilters}>
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="stfha-card p-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="h6 m-0" style={{ fontWeight: 800, color: "#203247" }}>
                  Override List
                </div>
                <span className="stfha-chip-green">Rows: {rows.length}</span>
              </div>

              <div className="table-responsive">
                <table className="table table-hover stfha-table m-0">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>Student</th>
                      <th>Session</th>
                      <th>Fee Head</th>
                      <th>Transport</th>
                      <th style={{ width: 120 }}>Amount</th>
                      <th>Remarks</th>
                      <th style={{ width: 150 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="stfha-row">
                        <td>{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 800, color: "#1f2f45" }}>
                            {safeStr(row?.Student?.name) || `Student ID: ${row.student_id}`}
                          </div>
                          <div className="text-muted" style={{ fontSize: 12 }}>
                            {safeStr(row?.Student?.admission_number) || "—"}
                          </div>
                        </td>
                        <td>{getSessionLabel(row?.Session)}</td>
                        <td>{getFeeHeadLabel(row?.FeeHeading)}</td>
                        <td>
                          <span className="stfha-chip-green">
                            {getTransportLabel(row?.Transportation)}
                          </span>
                        </td>
                        <td style={{ fontWeight: 800 }}>{formatCurrency(row.amount)}</td>
                        <td>{safeStr(row.remarks) || "—"}</td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <button
                              className="btn btn-outline-primary stfha-btn"
                              onClick={() => handleEdit(row)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-outline-danger stfha-btn"
                              onClick={() => handleDelete(row)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {rows.length === 0 && (
                      <tr>
                        <td colSpan="8" className="text-center text-muted" style={{ padding: 24 }}>
                          No override rows found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentTransportFeeHeadAmounts;