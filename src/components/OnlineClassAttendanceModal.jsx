import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";

const unwrap = (response) => response?.data?.data ?? response?.data ?? {};

const durationText = (seconds) => {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${String(secs).padStart(2, "0")}s`;
};

const dateTime = (value) => value ? new Date(value).toLocaleString() : "—";

const statusClass = (status) => ({
  present: "success",
  partial: "warning",
  absent: "danger",
  excused: "info",
  pending: "secondary",
}[status] || "secondary");

export default function OnlineClassAttendanceModal({ onlineClass, canManage, onClose, onNotice }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [matches, setMatches] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/online-classes/${onlineClass.id}/attendance`);
      setData(unwrap(response));
    } catch (error) {
      onNotice("danger", error.response?.data?.message || "Could not load online class attendance.");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onlineClass.id, onClose, onNotice]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.rows || [];
  const unmatched = data?.unmatched_sessions || [];
  const summary = data?.summary || {};
  const students = useMemo(() => rows.map((item) => item.student).filter(Boolean), [rows]);

  const saveStatus = async (studentId, value) => {
    const key = `status-${studentId}`;
    setBusyKey(key);
    try {
      const payload = value === "auto" ? { reset_auto: true } : { status: value };
      await api.patch(`/api/online-classes/${onlineClass.id}/attendance/${studentId}`, payload);
      onNotice("success", value === "auto" ? "Automatic attendance restored." : "Attendance updated.");
      await load();
    } catch (error) {
      onNotice("danger", error.response?.data?.message || "Could not update attendance.");
    } finally {
      setBusyKey("");
    }
  };

  const matchSession = async (sessionId) => {
    const studentId = Number(matches[sessionId]);
    if (!studentId) return onNotice("warning", "Select a student first.");
    const key = `match-${sessionId}`;
    setBusyKey(key);
    try {
      await api.post(`/api/online-classes/${onlineClass.id}/attendance/sessions/${sessionId}/match`, {
        student_id: studentId,
        remember_identity: true,
      });
      onNotice("success", "Zoom participant matched with the student.");
      await load();
    } catch (error) {
      onNotice("danger", error.response?.data?.message || "Could not match participant.");
    } finally {
      setBusyKey("");
    }
  };

  const recalculate = async () => {
    setBusyKey("recalculate");
    try {
      const response = await api.post(`/api/online-classes/${onlineClass.id}/attendance/recalculate`);
      setData(unwrap(response));
      onNotice("success", "Attendance recalculated.");
    } catch (error) {
      onNotice("danger", error.response?.data?.message || "Could not recalculate attendance.");
    } finally {
      setBusyKey("");
    }
  };

  return <div className="online-modal-backdrop attendance-backdrop" role="presentation">
    <div className="online-modal attendance-modal card shadow-lg" role="dialog" aria-modal="true">
      <div className="card-header d-flex justify-content-between align-items-start gap-3">
        <div>
          <h5 className="mb-1">Online Class Attendance</h5>
          <div className="text-muted small">{onlineClass.title} · {dateTime(onlineClass.start_time)}</div>
        </div>
        <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
      </div>

      <div className="card-body">
        {loading ? <div className="text-center py-5">Loading attendance…</div> : <>
          <div className="row g-2 mb-4">
            {[
              ["Students", summary.total || 0, "primary"],
              ["Present", summary.present || 0, "success"],
              ["Partial", summary.partial || 0, "warning"],
              ["Absent", summary.absent || 0, "danger"],
              ["Needs review", summary.needs_review || 0, "secondary"],
            ].map(([label, value, tone]) => <div className="col-6 col-md" key={label}>
              <div className={`attendance-summary border border-${tone}-subtle rounded-3 p-3 h-100`}>
                <div className="text-muted small">{label}</div><div className="fs-4 fw-semibold">{value}</div>
              </div>
            </div>)}
          </div>

          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
            <h6 className="mb-0">Student attendance</h6>
            {canManage && <button className="btn btn-sm btn-outline-secondary" disabled={busyKey === "recalculate"} onClick={recalculate}>
              <i className="bi bi-arrow-repeat me-1" />{busyKey === "recalculate" ? "Recalculating…" : "Recalculate"}
            </button>}
          </div>
          <div className="table-responsive attendance-table-wrap">
            <table className="table table-sm align-middle">
              <thead><tr><th>Student</th><th>Joined</th><th>Duration</th><th>Attendance</th><th>Match</th>{canManage && <th>Override</th>}</tr></thead>
              <tbody>{rows.length === 0 ? <tr><td colSpan={canManage ? 6 : 5} className="text-center text-muted py-4">No students found.</td></tr> : rows.map((item) => <tr key={item.student?.id || item.id}>
                <td><div className="fw-semibold">{item.student?.name || "—"}</div><small className="text-muted">{item.student?.admission_number || ""}</small></td>
                <td>{dateTime(item.first_joined_at)}{item.is_late && <span className="badge text-bg-warning ms-2">Late</span>}</td>
                <td>{durationText(item.total_duration_seconds)}<small className="d-block text-muted">{Number(item.attendance_percentage || 0).toFixed(1)}%</small></td>
                <td><span className={`badge text-bg-${statusClass(item.status)}`}>{item.status}</span>{item.manual_override && <small className="d-block text-muted">Manual</small>}</td>
                <td><span className={`badge ${item.matching_status === "confirmed" || item.matching_status === "manual" ? "text-bg-success" : item.matching_status === "likely" ? "text-bg-warning" : "text-bg-secondary"}`}>{item.matching_status}</span><small className="d-block text-muted">{item.match_confidence || 0}%</small></td>
                {canManage && <td><select className="form-select form-select-sm" value={item.manual_override ? item.status : "auto"} disabled={busyKey === `status-${item.student.id}`} onChange={(e) => saveStatus(item.student.id, e.target.value)}>
                  <option value="auto">Automatic</option><option value="present">Present</option><option value="partial">Partial</option><option value="absent">Absent</option><option value="excused">Excused</option>
                </select></td>}
              </tr>)}</tbody>
            </table>
          </div>

          {canManage && unmatched.length > 0 && <section className="mt-4">
            <h6>Unmatched Zoom participants</h6>
            <p className="text-muted small">These participants could not be linked confidently. Select the correct student once; stable Zoom identity details will be remembered.</p>
            <div className="table-responsive"><table className="table table-sm align-middle">
              <thead><tr><th>Zoom participant</th><th>Joined</th><th>Duration</th><th>Match with student</th></tr></thead>
              <tbody>{unmatched.map((session) => <tr key={session.id}>
                <td><div className="fw-semibold">{session.participant_name || "Unknown participant"}</div><small className="text-muted">{session.zoom_email || "Email unavailable"}</small></td>
                <td>{dateTime(session.joined_at)}</td><td>{durationText(session.duration_seconds)}</td>
                <td><div className="d-flex gap-2"><select className="form-select form-select-sm" value={matches[session.id] || ""} onChange={(e) => setMatches((old) => ({ ...old, [session.id]: e.target.value }))}>
                  <option value="">Select student</option>{students.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.admission_number || student.id})</option>)}
                </select><button className="btn btn-sm btn-primary" disabled={busyKey === `match-${session.id}`} onClick={() => matchSession(session.id)}>{busyKey === `match-${session.id}` ? "Matching…" : "Match"}</button></div></td>
              </tr>)}</tbody>
            </table></div>
          </section>}

          <div className="alert alert-light border mt-3 mb-0 small">
            Automatic rule: present at {data?.rules?.presentPercent ?? 75}% or more, partial from {data?.rules?.partialPercent ?? 25}%, and late after {data?.rules?.lateMinutes ?? 10} minutes. Basic Zoom accounts can leave some guest identities for teacher review.
          </div>
        </>}
      </div>
      <div className="card-footer text-end"><button className="btn btn-light" onClick={onClose}>Close</button></div>
    </div>
  </div>;
}
