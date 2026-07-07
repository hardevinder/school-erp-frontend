// src/pages/StudentLessonPlanEvaluationResultSheet.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

/**
 * StudentLessonPlanEvaluationResultSheet
 *
 * Purpose:
 * Teacher/Admin marks-entry page for STUDENT evaluation result sheet.
 *
 * Suggested routes:
 * /lesson-plans/:lessonPlanId/student-evaluations/:evaluationId/results
 * /lesson-plans/:lessonPlanId/student-results
 *
 * Backend APIs used:
 * GET  /lesson-plans/:lessonPlanId
 * GET  /lesson-plans/:lessonPlanId/students
 * GET  /lesson-plans/:lessonPlanId/evaluations?includeDraft=1
 * GET  /lesson-plans/evaluations/:evaluationId/results
 * POST /lesson-plans/evaluations/:evaluationId/results
 * GET  /lesson-plans/evaluations/:evaluationId/analytics
 * GET  /lesson-plans/evaluations/:evaluationId/result-sheet/pdf?absent=1
 */

const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL ||
  import.meta.env?.VITE_API_URL ||
  ""
).replace(/\/+$/, "");

const C = {
  primary: "#4F46E5",
  primary2: "#06B6D4",
  bg: "#F6F8FF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  cardBorder: "#E8ECF5",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  slate: "#64748B",
};

function buildUrl(path) {
  const p = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
}

function readToken() {
  const directKeys = [
    "token",
    "authToken",
    "accessToken",
    "jwt",
    "erp_token",
    "pits_token",
  ];

  for (const key of directKeys) {
    const value = localStorage.getItem(key);
    if (value && value.trim()) return value.trim();
  }

  const userKeys = ["user", "authUser", "erp_user", "vt_user"];

  for (const key of userKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const token =
        parsed?.token ||
        parsed?.authToken ||
        parsed?.accessToken ||
        parsed?.jwt;

      if (token) return String(token).trim();
    } catch (_) {}
  }

  return "";
}

function authHeaders(extra = {}) {
  const token = readToken();

  return {
    Accept: "application/json",
    ...(token
      ? {
          Authorization: token.startsWith("Bearer ")
            ? token
            : `Bearer ${token}`,
        }
      : {}),
    ...extra,
  };
}

async function apiJson(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...authHeaders(),
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      if (contentType.includes("application/json")) {
        const data = await response.json();
        message =
          data?.message ||
          data?.error ||
          data?.details ||
          data?.sqlMessage ||
          message;
      } else {
        const text = await response.text();
        if (text && text.length < 250) message = text;
      }
    } catch (_) {}

    throw new Error(message);
  }

  if (contentType.includes("application/json")) return response.json();

  return response;
}

async function apiBlob(path) {
  const response = await fetch(buildUrl(path), {
    headers: authHeaders({ Accept: "application/pdf" }),
  });

  if (!response.ok) {
    throw new Error(`PDF download failed with status ${response.status}`);
  }

  return response.blob();
}

function asMap(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function asArray(payload, preferredKeys = []) {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  for (const key of preferredKeys) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  for (const key of [
    "students",
    "evaluations",
    "results",
    "lessonPlans",
    "data",
    "rows",
    "items",
    "records",
  ]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  if (payload.data && typeof payload.data === "object") {
    return asArray(payload.data, preferredKeys);
  }

  return [];
}

function safeStr(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNum(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pick(row, keys, fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function nestedName(row, upperKey, lowerKey, keys) {
  const upper = asMap(row?.[upperKey]);
  const lower = asMap(row?.[lowerKey]);

  for (const obj of [upper, lower, row]) {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== null && value !== undefined && String(value).trim()) {
        return String(value).trim();
      }
    }
  }

  return "-";
}

function studentIdOf(student) {
  return toId(
    student?.id ||
      student?.studentId ||
      student?.student_id ||
      student?.StudentId
  );
}

function studentNameOf(student) {
  const first = safeStr(
    pick(student, ["firstName", "first_name", "fname", "student_first_name"])
  );
  const last = safeStr(
    pick(student, ["lastName", "last_name", "lname", "student_last_name"])
  );

  const full = safeStr(
    pick(student, [
      "name",
      "studentName",
      "student_name",
      "fullName",
      "full_name",
    ])
  );

  if (full) return full;
  if (first || last) return `${first} ${last}`.trim();

  return "Unnamed Student";
}

function admissionOf(student) {
  return safeStr(
    pick(student, [
      "admission_number",
      "admissionNo",
      "admission_no",
      "admissionNumber",
      "username",
      "userName",
      "studentRef",
    ])
  );
}

function rollOf(student) {
  return safeStr(
    pick(student, ["roll_number", "rollNo", "roll_no", "rollNumber"])
  );
}

function classNameOfPlan(plan) {
  return nestedName(plan, "Class", "class", [
    "class_name",
    "name",
    "className",
  ]);
}

function subjectNameOfPlan(plan) {
  return nestedName(plan, "Subject", "subject", [
    "name",
    "subject_name",
    "subjectName",
  ]);
}

function evaluationTitle(ev) {
  return safeStr(ev?.title || ev?.name || "Evaluation");
}

function evaluationTotalMarks(ev) {
  return toNum(
    ev?.totalMarks || ev?.total_marks || ev?.marks || ev?.maxMarks,
    0
  );
}

function pct(marks, total) {
  const m = toNum(marks, NaN);
  const t = toNum(total, 0);

  if (!Number.isFinite(m) || !t) return null;

  return Math.max(0, Math.min(100, (m / t) * 100));
}

function pctColor(value) {
  if (value === null || value === undefined) return C.muted;
  if (value < 40) return C.danger;
  if (value < 60) return C.warning;
  return C.success;
}

function showToast(message, type = "info") {
  window.dispatchEvent(
    new CustomEvent("app-toast", {
      detail: { message, type },
    })
  );

  // Fallback for projects without global toast listener.
  console.log(`[${type}] ${message}`);
}

export default function StudentLessonPlanEvaluationResultSheet() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const lessonPlanId = toId(
    params.lessonPlanId || searchParams.get("lessonPlanId")
  );

  const routeEvaluationId = toId(
    params.evaluationId || searchParams.get("evaluationId")
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [lessonPlan, setLessonPlan] = useState(null);
  const [students, setStudents] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [selectedEvaluationId, setSelectedEvaluationId] =
    useState(routeEvaluationId);

  const [resultsByStudent, setResultsByStudent] = useState({});
  const [analytics, setAnalytics] = useState(null);

  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [includeAbsentInPdf, setIncludeAbsentInPdf] = useState(true);

  const selectedEvaluation = useMemo(() => {
    return (
      evaluations.find((row) => toId(row.id) === toId(selectedEvaluationId)) ||
      null
    );
  }, [evaluations, selectedEvaluationId]);

  const totalMarks = evaluationTotalMarks(selectedEvaluation);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return students
      .map((student) => {
        const studentId = studentIdOf(student);
        const saved = studentId ? resultsByStudent[studentId] : null;

        const marksObtained =
          saved?.marksObtained ??
          saved?.marks_obtained ??
          saved?.marks ??
          "";

        const remark = saved?.remark ?? saved?.remarks ?? "";

        return {
          student,
          studentId,
          name: studentNameOf(student),
          admission: admissionOf(student),
          roll: rollOf(student),
          marksObtained,
          remark,
          saved,
        };
      })
      .filter((row) => {
        if (onlyPending && row.saved) return false;

        if (!q) return true;

        return [
          row.name,
          row.admission,
          row.roll,
          row.remark,
          row.studentId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const ar = Number(a.roll);
        const br = Number(b.roll);

        if (Number.isFinite(ar) && Number.isFinite(br)) return ar - br;

        return a.name.localeCompare(b.name);
      });
  }, [students, resultsByStudent, search, onlyPending]);

  const summary = useMemo(() => {
    const totalStudents = students.length;
    const evaluated = Object.keys(resultsByStudent).length;
    const pending = Math.max(0, totalStudents - evaluated);

    let sum = 0;
    let count = 0;

    Object.values(resultsByStudent).forEach((row) => {
      const marks = toNum(row?.marksObtained ?? row?.marks_obtained, NaN);
      if (Number.isFinite(marks)) {
        sum += marks;
        count += 1;
      }
    });

    const averageMarks = count ? sum / count : 0;
    const averagePercent = totalMarks ? (averageMarks / totalMarks) * 100 : 0;

    return {
      totalStudents,
      evaluated,
      pending,
      averageMarks,
      averagePercent,
    };
  }, [students, resultsByStudent, totalMarks]);

  const loadBase = useCallback(async () => {
    if (!lessonPlanId) return;

    setLoading(true);

    try {
      const [planResult, studentsResult, evalResult] = await Promise.allSettled([
        apiJson(`/lesson-plans/${lessonPlanId}`),
        apiJson(`/lesson-plans/${lessonPlanId}/students`),
        apiJson(`/lesson-plans/${lessonPlanId}/evaluations?includeDraft=1`),
      ]);

      if (planResult.status === "fulfilled") {
        const payload = planResult.value;
        setLessonPlan(
          payload?.lessonPlan || payload?.plan || payload?.data || payload
        );
      }

      if (studentsResult.status === "fulfilled") {
        setStudents(
          asArray(studentsResult.value, ["students", "data", "rows"])
        );
      } else {
        throw studentsResult.reason;
      }

      if (evalResult.status === "fulfilled") {
        const list = asArray(evalResult.value, [
          "evaluations",
          "data",
          "rows",
        ]);

        setEvaluations(list);

        if (!selectedEvaluationId && list.length) {
          const published =
            list.find(
              (x) => String(x.status || "").toUpperCase() === "PUBLISHED"
            ) || list[0];

          setSelectedEvaluationId(toId(published.id));
        }
      } else {
        throw evalResult.reason;
      }
    } catch (err) {
      showToast(err.message || "Failed to load student result sheet", "danger");
    } finally {
      setLoading(false);
    }
  }, [lessonPlanId, selectedEvaluationId]);

  const loadResults = useCallback(async () => {
    if (!selectedEvaluationId) return;

    try {
      const payload = await apiJson(
        `/lesson-plans/evaluations/${selectedEvaluationId}/results`
      );

      const resultRows = asArray(payload, ["results", "data", "rows"]);
      const map = {};

      resultRows.forEach((row) => {
        const studentId = toId(
          row.studentId || row.student_id || row.StudentId
        );
        if (studentId) map[studentId] = row;
      });

      setResultsByStudent(map);
    } catch (err) {
      showToast(err.message || "Failed to load saved marks", "danger");
    }
  }, [selectedEvaluationId]);

  const loadAnalytics = useCallback(async () => {
    if (!selectedEvaluationId) return;

    try {
      const payload = await apiJson(
        `/lesson-plans/evaluations/${selectedEvaluationId}/analytics`
      );

      setAnalytics(payload?.analytics || payload?.data || payload);
    } catch (_) {
      setAnalytics(null);
    }
  }, [selectedEvaluationId]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (!selectedEvaluationId) return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("evaluationId", String(selectedEvaluationId));
      return next;
    });

    loadResults();
    loadAnalytics();
  }, [selectedEvaluationId, loadResults, loadAnalytics, setSearchParams]);

  function updateResult(studentId, patch) {
    if (!studentId) return;

    setResultsByStudent((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          studentId,
          marksObtained: "",
          remark: "",
        }),
        ...patch,
        studentId,
      },
    }));
  }

  function markAbsent(studentId) {
    updateResult(studentId, {
      marksObtained: 0,
      remark: "ABSENT",
    });
  }

  function clearStudentResult(studentId) {
    if (!studentId) return;

    setResultsByStudent((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  }

  async function saveMarks() {
    if (!selectedEvaluationId) {
      showToast("Please select evaluation first.", "warning");
      return;
    }

    const resultRows = Object.values(resultsByStudent)
      .map((row) => {
        const studentId = toId(row.studentId);
        if (!studentId) return null;

        const rawMarks = row.marksObtained ?? row.marks_obtained;

        if (rawMarks === "" || rawMarks === null || rawMarks === undefined) {
          return null;
        }

        const marksObtained = toNum(rawMarks, NaN);
        if (!Number.isFinite(marksObtained)) return null;

        return {
          studentId,
          marksObtained: Math.max(
            0,
            Math.min(totalMarks || 9999, marksObtained)
          ),
          remark: safeStr(row.remark || row.remarks) || null,
        };
      })
      .filter(Boolean);

    if (!resultRows.length) {
      showToast("Please enter marks for at least one student.", "warning");
      return;
    }

    setSaving(true);

    try {
      await apiJson(`/lesson-plans/evaluations/${selectedEvaluationId}/results`, {
        method: "POST",
        body: JSON.stringify({ results: resultRows }),
      });

      showToast("Student marks saved successfully.", "success");
      await loadResults();
      await loadAnalytics();
    } catch (err) {
      showToast(err.message || "Failed to save marks", "danger");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!selectedEvaluationId) {
      showToast("Please select evaluation first.", "warning");
      return;
    }

    try {
      const blob = await apiBlob(
        `/lesson-plans/evaluations/${selectedEvaluationId}/result-sheet/pdf?absent=${
          includeAbsentInPdf ? "1" : "0"
        }`
      );

      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");

      setTimeout(() => window.URL.revokeObjectURL(url), 30000);
    } catch (err) {
      showToast(err.message || "Failed to download student result sheet PDF", "danger");
    }
  }

  if (!lessonPlanId) {
    return (
      <div className="student-eval-page">
        <StudentEvalStyles />
        <div className="student-eval-empty">
          <h3>Lesson Plan ID Missing</h3>
          <p>Please open this page from a lesson plan evaluation.</p>
          <button className="student-eval-btn primary" onClick={() => navigate(-1)}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="student-eval-page">
      <StudentEvalStyles />

      <section className="student-eval-hero">
        <div>
          <button className="student-eval-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1>Student Evaluation Result Sheet</h1>
          <p>
            Enter student marks, remarks, view analytics and download student result sheet.
          </p>
        </div>

        <div className="student-eval-hero-actions">
          <button
            className="student-eval-btn light"
            onClick={() => {
              loadBase();
              loadResults();
              loadAnalytics();
            }}
          >
            Refresh
          </button>
          <button
            className="student-eval-btn success"
            disabled={saving || !selectedEvaluationId}
            onClick={saveMarks}
          >
            {saving ? "Saving..." : "Save Student Marks"}
          </button>
        </div>
      </section>

      <section className="student-eval-metrics">
        <MetricCard
          label="Total Students"
          value={summary.totalStudents}
          helper="Class/section students"
        />
        <MetricCard
          label="Marks Entered"
          value={summary.evaluated}
          helper="Students evaluated"
          color={C.success}
        />
        <MetricCard
          label="Pending Students"
          value={summary.pending}
          helper="Marks not entered"
          color={C.warning}
        />
        <MetricCard
          label="Average"
          value={
            totalMarks
              ? `${summary.averageMarks.toFixed(1)} / ${totalMarks}`
              : summary.averageMarks.toFixed(1)
          }
          helper={`${summary.averagePercent.toFixed(1)}%`}
          color={pctColor(summary.averagePercent)}
        />
      </section>

      <section className="student-eval-card student-eval-toolbar">
        <div className="student-eval-field">
          <label>Student Evaluation</label>
          <select
            value={selectedEvaluationId || ""}
            onChange={(e) => setSelectedEvaluationId(toId(e.target.value))}
          >
            <option value="">Select Evaluation</option>
            {evaluations.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {evaluationTitle(ev)}
                {ev.status ? ` (${String(ev.status).toUpperCase()})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="student-eval-field">
          <label>Search Student</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, admission no, roll no..."
          />
        </div>

        <div className="student-eval-checks">
          <label>
            <input
              type="checkbox"
              checked={onlyPending}
              onChange={(e) => setOnlyPending(e.target.checked)}
            />
            Show pending only
          </label>

          <label>
            <input
              type="checkbox"
              checked={includeAbsentInPdf}
              onChange={(e) => setIncludeAbsentInPdf(e.target.checked)}
            />
            Include absent students in PDF
          </label>
        </div>

        <button
          className="student-eval-btn outline"
          disabled={!selectedEvaluationId}
          onClick={downloadPdf}
        >
          Download Student Result PDF
        </button>
      </section>

      <section className="student-eval-card student-eval-info">
        <InfoItem
          label="Lesson Plan"
          value={safeStr(lessonPlan?.topic || "Lesson Plan")}
          helper={safeStr(lessonPlan?.subtopic)}
        />
        <InfoItem label="Class" value={classNameOfPlan(lessonPlan)} />
        <InfoItem label="Subject" value={subjectNameOfPlan(lessonPlan)} />
        <InfoItem label="Total Marks" value={totalMarks || "—"} />
        <InfoItem
          label="Backend Analytics"
          value={
            analytics?.averagePercent != null
              ? `${Number(analytics.averagePercent).toFixed(1)}%`
              : analytics?.successColor || "—"
          }
        />
      </section>

      <section className="student-eval-card student-eval-table-card">
        {loading ? (
          <div className="student-eval-loading">Loading student result sheet...</div>
        ) : !selectedEvaluationId ? (
          <div className="student-eval-empty">
            <h3>Select Student Evaluation</h3>
            <p>Please select an evaluation to enter student marks.</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="student-eval-empty">
            <h3>No Students Found</h3>
            <p>No students found for this lesson plan class/sections.</p>
          </div>
        ) : (
          <div className="student-eval-table-wrap">
            <table className="student-eval-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th style={{ width: 90 }}>Roll</th>
                  <th style={{ width: 150 }}>Admission No.</th>
                  <th>Student Name</th>
                  <th style={{ width: 150 }}>Marks</th>
                  <th style={{ width: 100 }}>%</th>
                  <th style={{ width: 260 }}>Remarks</th>
                  <th style={{ width: 165 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => {
                  const percentage = pct(row.marksObtained, totalMarks);
                  const hasMarks =
                    row.marksObtained !== "" &&
                    row.marksObtained !== null &&
                    row.marksObtained !== undefined;

                  return (
                    <tr key={row.studentId || index}>
                      <td>{index + 1}</td>
                      <td>{row.roll || "—"}</td>
                      <td>{row.admission || "—"}</td>
                      <td>
                        <div className="student-eval-name">
                          <strong>{row.name}</strong>
                          <small>Student ID: {row.studentId || "—"}</small>
                        </div>
                      </td>
                      <td>
                        <div className="student-eval-marks">
                          <input
                            type="number"
                            min="0"
                            max={totalMarks || 9999}
                            value={row.marksObtained}
                            onChange={(e) =>
                              updateResult(row.studentId, {
                                marksObtained: e.target.value,
                              })
                            }
                            placeholder="0"
                          />
                          <span>/ {totalMarks || "—"}</span>
                        </div>
                      </td>
                      <td>
                        {hasMarks && percentage !== null ? (
                          <strong style={{ color: pctColor(percentage) }}>
                            {percentage.toFixed(1)}%
                          </strong>
                        ) : (
                          <span className="student-eval-muted">—</span>
                        )}
                      </td>
                      <td>
                        <input
                          value={row.remark || ""}
                          onChange={(e) =>
                            updateResult(row.studentId, {
                              remark: e.target.value,
                            })
                          }
                          placeholder="Remark"
                        />
                      </td>
                      <td>
                        <div className="student-eval-row-actions">
                          <button
                            className="student-eval-mini"
                            onClick={() => markAbsent(row.studentId)}
                          >
                            Absent
                          </button>
                          <button
                            className="student-eval-mini danger"
                            onClick={() => clearStudentResult(row.studentId)}
                          >
                            Clear
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="student-eval-sticky">
        <div>
          <strong>{summary.evaluated}</strong> entered •{" "}
          <strong>{summary.pending}</strong> pending
        </div>

        <button
          className="student-eval-btn success"
          disabled={saving || !selectedEvaluationId}
          onClick={saveMarks}
        >
          {saving ? "Saving..." : "Save Student Marks"}
        </button>
      </section>
    </div>
  );
}

function MetricCard({ label, value, helper, color = C.primary }) {
  return (
    <div className="student-eval-metric">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function InfoItem({ label, value, helper }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function StudentEvalStyles() {
  return (
    <style>{`
      .student-eval-page {
        min-height: 100vh;
        padding: 22px;
        background: ${C.bg};
        color: ${C.text};
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .student-eval-hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 22px;
        margin-bottom: 16px;
        color: white;
        background: linear-gradient(135deg, ${C.primary}, ${C.primary2});
        border-radius: 24px;
        box-shadow: 0 18px 40px rgba(79, 70, 229, 0.22);
      }

      .student-eval-hero h1 {
        margin: 7px 0 6px;
        font-size: 29px;
        line-height: 1.1;
        font-weight: 950;
      }

      .student-eval-hero p {
        margin: 0;
        max-width: 720px;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 650;
      }

      .student-eval-back {
        border: 0;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.16);
        color: white;
        font-weight: 900;
        cursor: pointer;
      }

      .student-eval-hero-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .student-eval-metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin-bottom: 14px;
      }

      .student-eval-card,
      .student-eval-metric {
        background: white;
        border: 1px solid ${C.cardBorder};
        border-radius: 20px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
      }

      .student-eval-metric {
        padding: 16px;
      }

      .student-eval-metric span,
      .student-eval-info span,
      .student-eval-field label {
        display: block;
        margin-bottom: 5px;
        color: ${C.muted};
        font-size: 12px;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .student-eval-metric strong {
        display: block;
        font-size: 27px;
        line-height: 1.1;
        font-weight: 950;
      }

      .student-eval-metric small,
      .student-eval-info small {
        display: block;
        margin-top: 4px;
        color: ${C.muted};
        font-weight: 700;
      }

      .student-eval-card {
        padding: 16px;
        margin-bottom: 14px;
      }

      .student-eval-toolbar {
        display: grid;
        grid-template-columns: 1.2fr 1.2fr 1.25fr auto;
        gap: 12px;
        align-items: end;
      }

      .student-eval-field input,
      .student-eval-field select,
      .student-eval-table input {
        width: 100%;
        border: 1px solid ${C.border};
        border-radius: 13px;
        padding: 10px 12px;
        outline: none;
        background: #F8FAFF;
        color: ${C.text};
        font-weight: 750;
      }

      .student-eval-field input:focus,
      .student-eval-field select:focus,
      .student-eval-table input:focus {
        background: white;
        border-color: ${C.primary};
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
      }

      .student-eval-checks {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .student-eval-checks label {
        display: flex;
        align-items: center;
        gap: 8px;
        color: ${C.text};
        font-size: 13px;
        font-weight: 850;
      }

      .student-eval-checks input {
        width: auto;
      }

      .student-eval-info {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
        gap: 14px;
      }

      .student-eval-info strong {
        display: block;
        font-size: 15px;
        font-weight: 950;
      }

      .student-eval-table-card {
        padding: 0;
        overflow: hidden;
      }

      .student-eval-table-wrap {
        overflow: auto;
        max-height: calc(100vh - 245px);
      }

      .student-eval-table {
        width: 100%;
        min-width: 1080px;
        border-collapse: separate;
        border-spacing: 0;
      }

      .student-eval-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        padding: 13px 12px;
        background: #F8FAFF;
        color: ${C.muted};
        border-bottom: 1px solid ${C.border};
        text-align: left;
        font-size: 12px;
        font-weight: 950;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .student-eval-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #EEF2F7;
        vertical-align: middle;
        font-weight: 750;
      }

      .student-eval-table tbody tr:hover {
        background: #FBFDFF;
      }

      .student-eval-name strong {
        display: block;
        font-size: 14px;
      }

      .student-eval-name small,
      .student-eval-muted {
        color: ${C.muted};
        font-weight: 750;
      }

      .student-eval-marks {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .student-eval-marks input {
        width: 82px;
      }

      .student-eval-marks span {
        color: ${C.muted};
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
      }

      .student-eval-row-actions {
        display: flex;
        gap: 6px;
      }

      .student-eval-btn,
      .student-eval-mini {
        border: 0;
        cursor: pointer;
        font-weight: 950;
        border-radius: 13px;
        transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease;
      }

      .student-eval-btn {
        padding: 11px 15px;
      }

      .student-eval-btn:hover,
      .student-eval-mini:hover {
        transform: translateY(-1px);
      }

      .student-eval-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
        transform: none;
      }

      .student-eval-btn.primary {
        background: ${C.primary};
        color: white;
      }

      .student-eval-btn.success {
        background: ${C.success};
        color: white;
      }

      .student-eval-btn.light {
        color: white;
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.24);
      }

      .student-eval-btn.outline {
        color: ${C.primary};
        background: white;
        border: 1px solid rgba(79, 70, 229, 0.22);
      }

      .student-eval-mini {
        padding: 8px 10px;
        color: ${C.primary};
        background: #EEF2FF;
      }

      .student-eval-mini.danger {
        color: ${C.danger};
        background: #FEF2F2;
      }

      .student-eval-loading,
      .student-eval-empty {
        padding: 42px 20px;
        text-align: center;
      }

      .student-eval-empty h3 {
        margin: 0 0 8px;
        font-weight: 950;
      }

      .student-eval-empty p {
        color: ${C.muted};
        font-weight: 700;
      }

      .student-eval-sticky {
        position: sticky;
        bottom: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        max-width: 760px;
        margin: 0 auto;
        padding: 12px;
        border: 1px solid ${C.cardBorder};
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.94);
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
        backdrop-filter: blur(14px);
        color: ${C.muted};
        font-weight: 850;
      }

      .student-eval-sticky strong {
        color: ${C.text};
      }

      @media (max-width: 1120px) {
        .student-eval-metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .student-eval-toolbar {
          grid-template-columns: 1fr 1fr;
        }

        .student-eval-info {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 720px) {
        .student-eval-page {
          padding: 14px;
        }

        .student-eval-hero {
          align-items: stretch;
          flex-direction: column;
        }

        .student-eval-metrics,
        .student-eval-toolbar,
        .student-eval-info {
          grid-template-columns: 1fr;
        }

        .student-eval-sticky {
          align-items: stretch;
          flex-direction: column;
        }
      }
    `}</style>
  );
}