// src/pages/ReportCardHealthEntry.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

/* =========================
 * Helpers
 * ========================= */

const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d) return [];

  const keys = [
    "data",
    "rows",
    "results",
    "items",
    "list",
    "records",
    "students",
    "sessions",
  ];

  for (const k of keys) {
    if (Array.isArray(d?.[k])) return d[k];
  }

  return [];
};

const getApiErrorMessage = (err, fallback = "Something went wrong") => {
  const status = err?.response?.status;
  const data = err?.response?.data;

  const serverMsg =
    data?.message ||
    data?.error ||
    data?.details ||
    (typeof data === "string" ? data : "") ||
    err?.message;

  if (status === 401) {
    return serverMsg || "Unauthorized. Please login again and try.";
  }

  if (status === 403) {
    return (
      serverMsg ||
      "Forbidden. You do not have permission for this class/section."
    );
  }

  return serverMsg || fallback;
};

const showApiError = (title, err, fallback) => {
  const status = err?.response?.status;
  const msg = getApiErrorMessage(err, fallback);

  Swal.fire({
    icon: "error",
    title: title || "Error",
    html: `
      <div style="text-align:left">
        <div style="font-weight:600;margin-bottom:6px;">${msg}</div>
        ${
          status
            ? `<div style="opacity:0.8;font-size:12px;">Status: <b>${status}</b></div>`
            : ""
        }
      </div>
    `,
  });
};

const getApiOrigin = () => {
  const base = api?.defaults?.baseURL || window.location.origin;

  try {
    const url = new URL(base, window.location.origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return window.location.origin;
  }
};

const resolvePhotoUrl = (row) => {
  const direct = row?.photo_url || row?.photoUrl || row?.image_url;
  if (direct) {
    if (/^https?:\/\//i.test(direct)) return direct;
    return `${getApiOrigin()}${String(direct).startsWith("/") ? "" : "/"}${direct}`;
  }

  const photo = row?.photo;
  if (!photo) return "";

  if (/^https?:\/\//i.test(photo)) return photo;

  return `${getApiOrigin()}/uploads/photoes/students/${encodeURIComponent(
    photo
  )}`;
};

const initials = (name = "") => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "S";

  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
};

const toInputValue = (v) => {
  if (v === null || v === undefined) return "";
  return String(v);
};

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const dentalCheckupOptions = [
  "",
  "Good",
  "Satisfactory",
  "Needs Care",
  "Needs Dental Check-up",
  "Cavity Suspected",
  "Under Treatment",
];

const visionOptions = [
  "",
  "Normal",
  "Needs Check-up",
  "Wears Glasses",
  "Left Eye Weak",
  "Right Eye Weak",
  "Color Vision Issue",
  "Under Treatment",
];

const bloodGroupOptions = [
  "",
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Not Known",
];

const withCurrentOption = (options, currentValue) => {
  const current = String(currentValue || "").trim();
  if (!current) return options;
  return options.includes(current) ? options : [current, ...options];
};

const normalizeRowsForSave = (rows) =>
  rows.map((row) => ({
    student_id: row.student_id,
    working_days: row.working_days === "" ? null : row.working_days,
    present_days: row.present_days === "" ? null : row.present_days,
    height: row.height || "",
    weight: row.weight || "",
    dental_checkup: row.dental_checkup || "",
    vision: row.vision || "",
    blood_group_snapshot: row.blood_group_snapshot || "",
    assessment_date: row.assessment_date || getTodayDate(),
  }));

const ReportCardHealthEntry = () => {
  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    exam_id: "",
  });

  const [sessions, setSessions] = useState([]);
  const [classExamSubjects, setClassExamSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [sections, setSections] = useState([]);

  const [rows, setRows] = useState([]);
  const [examMeta, setExamMeta] = useState(null);
  const [accessMeta, setAccessMeta] = useState(null);
  const [canEdit, setCanEdit] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSessions();
    loadClassExamSubjects();
    loadSections();
  }, []);

  useEffect(() => {
    const { session_id, class_id, section_id, exam_id } = filters;

    if (session_id && class_id && section_id && exam_id) {
      fetchHealthRows();
    } else {
      resetGrid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.session_id, filters.class_id, filters.section_id, filters.exam_id]);

  const resetGrid = () => {
    setRows([]);
    setExamMeta(null);
    setAccessMeta(null);
    setCanEdit(true);
  };

  const loadSessions = async () => {
    try {
      const res = await api.get("/sessions");
      const list = asArray(res.data);
      setSessions(list);

      if (list.length > 0) {
        const active =
          list.find(
            (s) =>
              s?.is_active === true ||
              s?.is_current === true ||
              s?.isCurrent === true ||
              s?.current === true ||
              String(s?.status || "").toLowerCase() === "active"
          ) || list[0];

        const defaultSessionId = String(
          active?.id ?? active?.session_id ?? active?.Session_ID ?? ""
        );

        if (defaultSessionId) {
          setFilters((prev) => ({
            ...prev,
            session_id: prev.session_id || defaultSessionId,
          }));
        }
      }
    } catch (err) {
      showApiError("Error", err, "Failed to load sessions");
    }
  };

  const loadClassExamSubjects = async () => {
    try {
      const res = await api.get("/exams/class-exam-subjects");
      setClassExamSubjects(asArray(res.data));
    } catch (err) {
      showApiError("Error", err, "Failed to load class-exam data");
    }
  };

  const loadSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(asArray(res.data));
    } catch (err) {
      showApiError("Error", err, "Failed to load sections");
    }
  };

  const handleSessionChange = (e) => {
    const session_id = e.target.value;

    setFilters({
      session_id,
      class_id: "",
      section_id: "",
      exam_id: "",
    });

    setExams([]);
    resetGrid();
  };

  const handleClassChange = (e) => {
    const class_id = e.target.value;

    setFilters((prev) => ({
      ...prev,
      class_id,
      section_id: "",
      exam_id: "",
    }));

    const selectedClass = asArray(classExamSubjects).find(
      (c) => Number(c.class_id) === Number(class_id)
    );

    setExams(asArray(selectedClass?.exams));
    resetGrid();
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));

    resetGrid();
  };

  const fetchHealthRows = async () => {
    const { session_id, class_id, section_id, exam_id } = filters;

    try {
      setLoading(true);

      const res = await api.get("/report-card-health", {
        params: {
          session_id,
          class_id,
          section_id,
          exam_id,
        },
      });

      const fetchedRows = asArray(res.data?.rows || res.data);

      setRows(
        fetchedRows.map((r) => ({
          ...r,
          working_days: toInputValue(r.working_days),
          present_days: toInputValue(r.present_days),
          height: toInputValue(r.height),
          weight: toInputValue(r.weight),
          dental_checkup: toInputValue(r.dental_checkup),
          vision: toInputValue(r.vision),
          blood_group_snapshot: toInputValue(
            r.blood_group_snapshot || r.profile_blood_group
          ),
          assessment_date: toInputValue(r.assessment_date || getTodayDate()),
        }))
      );

      setExamMeta(res.data?.exam || null);
      setAccessMeta(res.data?.access || null);
      setCanEdit(res.data?.can_edit !== false);
    } catch (err) {
      showApiError("Error", err, "Failed to fetch health details");
      resetGrid();
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (studentId, field, value) => {
    setRows((prev) =>
      prev.map((row) =>
        Number(row.student_id) === Number(studentId)
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  };

  const applyAssessmentDateToAll = async () => {
    const { value: date } = await Swal.fire({
      title: "Set Assessment Date",
      input: "date",
      inputValue: getTodayDate(),
      showCancelButton: true,
      confirmButtonText: "Apply",
    });

    if (!date) return;

    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        assessment_date: date,
      }))
    );
  };

  const saveHealthDetails = async () => {
    const { session_id, class_id, section_id, exam_id } = filters;

    if (!session_id || !class_id || !section_id || !exam_id) {
      Swal.fire("Validation", "Please select all filters first.", "warning");
      return;
    }

    if (!rows.length) {
      Swal.fire("Validation", "No students found to save.", "warning");
      return;
    }

    if (!canEdit) {
      Swal.fire("Locked", "This exam is locked. You cannot edit details.", "info");
      return;
    }

    try {
      setSaving(true);

      await api.post("/report-card-health/bulk-save", {
        session_id,
        class_id,
        section_id,
        exam_id,
        rows: normalizeRowsForSave(rows),
      });

      Swal.fire("Saved", "Health details saved successfully.", "success");
      fetchHealthRows();
    } catch (err) {
      showApiError("Error", err, "Failed to save health details");
    } finally {
      setSaving(false);
    }
  };

  const selectedClassName = useMemo(() => {
    const selected = asArray(classExamSubjects).find(
      (c) => Number(c.class_id) === Number(filters.class_id)
    );
    return selected?.class_name || selected?.name || "";
  }, [classExamSubjects, filters.class_id]);

  const selectedSectionName = useMemo(() => {
    const selected = asArray(sections).find(
      (s) => Number(s.id || s.section_id) === Number(filters.section_id)
    );
    return selected?.section_name || selected?.name || "";
  }, [sections, filters.section_id]);

  const renderPhoto = (row) => {
    const url = resolvePhotoUrl(row);

    if (!url) {
      return (
        <div
          className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-secondary"
          style={{ width: 42, height: 42, fontSize: 13 }}
        >
          {initials(row.student_name)}
        </div>
      );
    }

    return (
      <img
        src={url}
        alt={row.student_name || "Student"}
        className="rounded-circle border bg-light"
        style={{
          width: 42,
          height: 42,
          objectFit: "cover",
        }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  };

  return (
    <div className="container-fluid py-3">
      <div className="card shadow-sm border-0">
        <div className="card-header bg-primary text-white d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <h4 className="mb-0">Report Card Health & Extra Details</h4>
            <div className="small opacity-75">
              Attendance, Height, Weight, Dental, Vision, Blood Group
            </div>
          </div>

          {accessMeta?.access_type && (
            <span className="badge bg-light text-primary">
              Access: {accessMeta.access_type}
            </span>
          )}
        </div>

        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label fw-semibold">Session</label>
              <select
                className="form-select"
                value={filters.session_id}
                onChange={handleSessionChange}
              >
                <option value="">Select Session</option>
                {sessions.map((s) => (
                  <option key={s.id || s.session_id} value={s.id || s.session_id}>
                    {s.name ||
                      s.session_name ||
                      s.title ||
                      `Session ${s.id || s.session_id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={handleClassChange}
              >
                <option value="">Select Class</option>
                {classExamSubjects.map((c, idx) => (
                  <option key={idx} value={c.class_id}>
                    {c.class_name || c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Section</label>
              <select
                className="form-select"
                name="section_id"
                value={filters.section_id}
                onChange={handleFilterChange}
                disabled={!filters.class_id}
              >
                <option value="">Select Section</option>
                {sections.map((s, idx) => (
                  <option key={idx} value={s.id || s.section_id}>
                    {s.section_name || s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-semibold">Exam</label>
              <select
                className="form-select"
                name="exam_id"
                value={filters.exam_id}
                onChange={handleFilterChange}
                disabled={!filters.class_id}
              >
                <option value="">Select Exam</option>
                {exams.map((ex, idx) => (
                  <option key={idx} value={ex.exam_id || ex.id}>
                    {ex.exam_name || ex.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3">
            <button
              className="btn btn-success"
              onClick={saveHealthDetails}
              disabled={!rows.length || loading || saving || !canEdit}
            >
              {saving ? "Saving..." : "Save All"}
            </button>

            <button
              className="btn btn-outline-primary"
              onClick={fetchHealthRows}
              disabled={
                !filters.session_id ||
                !filters.class_id ||
                !filters.section_id ||
                !filters.exam_id ||
                loading
              }
            >
              Refresh
            </button>

            <button
              className="btn btn-outline-secondary"
              onClick={applyAssessmentDateToAll}
              disabled={!rows.length || loading || saving || !canEdit}
            >
              Set Assessment Date
            </button>
          </div>

          {examMeta && (
            <div className="alert alert-light border py-2 mb-3">
              <div className="d-flex flex-wrap gap-3 align-items-center">
                <div>
                  <strong>Class:</strong> {selectedClassName || "-"}
                </div>
                <div>
                  <strong>Section:</strong> {selectedSectionName || "-"}
                </div>
                <div>
                  <strong>Exam:</strong> {examMeta.name || "-"}
                </div>
                <div>
                  <strong>Date:</strong> {examMeta.start_date || "-"} to{" "}
                  {examMeta.end_date || "-"}
                </div>
                <div>
                  <strong>Status:</strong>{" "}
                  {examMeta.is_locked ? (
                    <span className="badge bg-danger">Locked</span>
                  ) : (
                    <span className="badge bg-success">Unlocked</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="alert alert-light border text-center mb-0">
              Select Session, Class, Section and Exam to load student health
              details.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 70 }}>Photo</th>
                    <th style={{ minWidth: 80 }}>Roll No</th>
                    <th style={{ minWidth: 230 }}>Student</th>
                    <th style={{ minWidth: 130 }}>Present Days</th>
                    <th style={{ minWidth: 130 }}>Working Days</th>
                    <th style={{ minWidth: 120 }}>Height</th>
                    <th style={{ minWidth: 120 }}>Weight</th>
                    <th style={{ minWidth: 160 }}>Dental Check-up</th>
                    <th style={{ minWidth: 150 }}>Vision</th>
                    <th style={{ minWidth: 140 }}>Blood Group</th>
                    <th style={{ minWidth: 150 }}>Assessment Date</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => (
                    <tr key={row.student_id}>
                      <td>{renderPhoto(row)}</td>

                      <td>{row.roll_number || "-"}</td>

                      <td>
                        <div className="fw-semibold">
                          {row.student_name || "-"}
                        </div>
                        <div className="small text-muted">
                          Adm: {row.admission_number || "-"}
                        </div>
                      </td>

                      <td>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          step="0.5"
                          value={row.present_days}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(
                              row.student_id,
                              "present_days",
                              e.target.value
                            )
                          }
                        />
                        {row.auto_attendance?.present_days !== null &&
                          row.auto_attendance?.present_days !== undefined && (
                            <div className="small text-muted mt-1">
                              Auto: {row.auto_attendance.present_days}
                            </div>
                          )}
                      </td>

                      <td>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          value={row.working_days}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(
                              row.student_id,
                              "working_days",
                              e.target.value
                            )
                          }
                        />
                        {row.auto_attendance?.working_days !== null &&
                          row.auto_attendance?.working_days !== undefined && (
                            <div className="small text-muted mt-1">
                              Auto: {row.auto_attendance.working_days}
                            </div>
                          )}
                      </td>

                      <td>
                        <input
                          className="form-control"
                          placeholder="e.g. 112 cm"
                          value={row.height}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(row.student_id, "height", e.target.value)
                          }
                        />
                      </td>

                      <td>
                        <input
                          className="form-control"
                          placeholder="e.g. 22 kg"
                          value={row.weight}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(row.student_id, "weight", e.target.value)
                          }
                        />
                      </td>

                      <td>
                        <select
                          className="form-select"
                          value={row.dental_checkup}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(
                              row.student_id,
                              "dental_checkup",
                              e.target.value
                            )
                          }
                        >
                          {withCurrentOption(
                            dentalCheckupOptions,
                            row.dental_checkup
                          ).map((option) => (
                            <option key={option || "blank"} value={option}>
                              {option || "Select"}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          className="form-select"
                          value={row.vision}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(row.student_id, "vision", e.target.value)
                          }
                        >
                          {withCurrentOption(visionOptions, row.vision).map(
                            (option) => (
                              <option key={option || "blank"} value={option}>
                                {option || "Select"}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      <td>
                        <select
                          className="form-select"
                          value={row.blood_group_snapshot}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(
                              row.student_id,
                              "blood_group_snapshot",
                              e.target.value
                            )
                          }
                        >
                          {withCurrentOption(
                            bloodGroupOptions,
                            row.blood_group_snapshot
                          ).map((option) => (
                            <option key={option || "blank"} value={option}>
                              {option || "Select"}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          type="date"
                          className="form-control"
                          value={row.assessment_date}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(
                              row.student_id,
                              "assessment_date",
                              e.target.value
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!canEdit && (
            <div className="alert alert-warning mt-3 mb-0">
              This exam is locked, so health details cannot be edited.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportCardHealthEntry;