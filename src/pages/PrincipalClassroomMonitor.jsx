import React, { useCallback, useEffect, useState } from "react";
import api from "../api";
import "./PrincipalClassroomMonitor.css";

const fmt = (n) => new Intl.NumberFormat("en-IN").format(Number(n || 0));

export default function PrincipalClassroomMonitor({ date, navigate }) {
  const [overview, setOverview] = useState(null);
  const [periodId, setPeriodId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (controller) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/command-center/live-classrooms", {
        params: { ...(date ? { date } : {}), ...(periodId ? { period_id: periodId } : {}) },
        signal: controller.signal,
      });
      setOverview(data);
    } catch (err) {
      if (err?.code !== "ERR_CANCELED" && err?.name !== "CanceledError") {
        setError(err?.response?.data?.message || "Unable to load classroom monitor");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [date, periodId]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller);
    const timer = window.setInterval(() => load(controller), 60000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [load]);

  const rows = overview?.rows || [];
  const mapped = rows.reduce((acc, row) => ({
    classes: acc.classes + 1,
    students: acc.students + Number(row.strength || 0),
    marked: acc.marked + Number(row.attendance_marked || 0),
    present: acc.present + Number(row.present || 0),
    absent: acc.absent + Number(row.absent || 0),
    pending: acc.pending + Number(row.attendance_pending || 0),
    substitutes: acc.substitutes + (row.status === "Substituted" ? 1 : 0),
  }), { classes: 0, students: 0, marked: 0, present: 0, absent: 0, pending: 0, substitutes: 0 });

  return <section className="pcm" aria-labelledby="pcm-heading">
    <header className="pcm-head">
      <div className="pcm-head-title"><span className="pcm-head-icon"><i className="bi bi-calendar2-week" /></span><div>
        <span className="pcm-eyebrow">SCHOOL OPERATIONS · TODAY'S TIMETABLE</span>
        <h2 id="pcm-heading">Live Classroom Monitor</h2>
        <p>Teacher assignments, class strength, attendance and published substitutions in one view.</p>
      </div></div>
      <div className="pcm-tools">
        {overview?.periods?.length > 0 && <label>Period <select value={periodId || String(overview.period_id || "")} onChange={(e) => setPeriodId(e.target.value)}>
          {overview.periods.map((period) => <option key={period.id} value={period.id}>{period.name} ({period.start_time}–{period.end_time})</option>)}
        </select></label>}
        <button className="pcm-refresh" type="button" onClick={() => load(new AbortController())} disabled={loading}><i className="bi bi-arrow-clockwise" /> Refresh</button>
      </div>
    </header>
    <div className="pcm-current">
      <span className="pcm-live-dot" aria-hidden="true" />
      <strong>{overview?.period_state || "Timetable"}</strong>
      <span>{overview?.period_label || "—"}</span>
      <span className="pcm-period-time">{overview?.period_time || ""}</span>
      {overview?.session && <span className="pcm-session">Session {overview.session}</span>}
    </div>
    {error && <p className="pcm-notice" role="alert">{error}</p>}
    {!error && overview?.available === false && <p className="pcm-notice">{overview.reason || "Classroom timetable unavailable"}</p>}
    {overview?.available !== false && <>
      <div className="pcm-stats" aria-label="Classroom summary">
        <div><span className="pcm-stat-icon blue"><i className="bi bi-grid-3x3-gap" /></span><strong>{fmt(mapped.classes)}</strong><small>Classes scheduled</small></div>
        <div><span className="pcm-stat-icon purple"><i className="bi bi-people" /></span><strong>{fmt(mapped.students)}</strong><small>Class strength</small></div>
        <div><span className="pcm-stat-icon green"><i className="bi bi-person-check" /></span><strong>{fmt(mapped.present)}</strong><small>Present recorded</small></div>
        <div><span className="pcm-stat-icon red"><i className="bi bi-person-dash" /></span><strong>{fmt(mapped.absent)}</strong><small>Absent recorded</small></div>
        <div><span className="pcm-stat-icon amber"><i className="bi bi-hourglass-split" /></span><strong>{fmt(mapped.pending)}</strong><small>Attendance pending</small></div>
        <div><span className="pcm-stat-icon violet"><i className="bi bi-arrow-left-right" /></span><strong>{fmt(mapped.substitutes)}</strong><small>Period substitutions</small></div>
      </div>
      <div className="pcm-table-wrap"><table className="pcm-table"><thead><tr>
        <th>Class / Section</th><th>Students & attendance</th><th>Subject</th><th>Scheduled teacher</th><th>Substitution status</th>
      </tr></thead><tbody>
        {rows.map((row) => {
          const attendancePercent = row.strength ? Math.min(100, Math.round((row.present / row.strength) * 100)) : 0;
          return <tr key={`${row.class_id}-${row.section_id}`}>
            <td><strong className="pcm-class">{row.class_label}</strong><small>Strength: {fmt(row.strength)}</small></td>
            <td><div className="pcm-attend"><span className="pcm-attend-present">{fmt(row.present)} present</span><span className="pcm-attend-absent">{fmt(row.absent)} absent</span>{row.attendance_pending > 0 && <span className="pcm-attend-pending">{fmt(row.attendance_pending)} pending</span>}</div>
              <div className="pcm-bar"><span style={{ width: `${attendancePercent}%` }} /></div></td>
            <td>{row.subject}</td><td>{row.teacher}</td>
            <td>{row.substitute ? <div><span className="pcm-badge substituted">Substituted</span><small className="pcm-substitute">By {row.substitute}</small></div> : <span className={`pcm-badge ${row.status === "Scheduled" ? "scheduled" : "unassigned"}`}>{row.status}</span>}</td>
          </tr>;
        })}
      </tbody></table>{!rows.length && <div className="pcm-empty"><i className="bi bi-calendar-x" /><strong>No published timetable for this period</strong><span>Choose another period or check published class timetables.</span></div>}</div>
    </>}
    <footer className="pcm-footer"><span><i className="bi bi-info-circle" /> Scheduled does not confirm classroom presence; unmarked attendance is not absence.</span>
      <button type="button" onClick={() => navigate("/substitutions")}>Open substitutions <i className="bi bi-arrow-up-right" /></button>
    </footer>
  </section>;
}
