import React, { useEffect, useMemo, useState } from "react";
import teacherPerformanceApi from "../services/teacherPerformanceApi";
import "./TeacherScheduleAttendance.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LABELS = { present: ["Present", "present"], absent: ["Absent", "absent"], first_half_day_leave: ["Half day", "half"], second_half_day_leave: ["Half day", "half"], half_day_without_pay: ["Half day", "half"], short_leave: ["Short leave", "half"], full_day_leave: ["Approved leave", "leave"], leave: ["Leave", "leave"], medical_leave: ["Medical leave", "leave"], holiday: ["Holiday", "off"] };
const dayKey = (v) => { const s = String(v || "").trim().toLowerCase(); return DAYS.find((d) => d.toLowerCase() === s || d.slice(0, 3).toLowerCase() === s.slice(0, 3)) || (s === "sun" || s === "sunday" ? "Sunday" : ""); };
const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const datesForMonth = (month) => { const [year, mm] = String(month).split("-").map(Number); if (!year || mm < 1 || mm > 12) return []; const count = new Date(year, mm, 0).getDate(); return Array.from({ length: count }, (_, i) => new Date(year, mm - 1, i + 1)); };

export default function TeacherScheduleAttendance({ teacherId, month, isManager }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!teacherId || !month) return undefined;
    let active = true;
    setLoading(true); setError(""); setData(null);
    const params = { month };
    if (isManager) params.teacher_user_id = teacherId;
    teacherPerformanceApi.scheduleAttendance(params)
      .then(({ data: body }) => { if (active) setData(body); })
      .catch((e) => { if (active) setError(e?.response?.data?.message || "Timetable and attendance are unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [teacherId, month, isManager]);

  const rows = data?.timetable || [];
  const periods = useMemo(() => [...(data?.periods || [])].sort((a, b) => String(a.start_time || "").localeCompare(String(b.start_time || ""))), [data]);
  const relevant = periods.filter((p) => rows.some((r) => Number(r.period_id) === Number(p.id)));
  const days = datesForMonth(month);
  const attendance = new Map((data?.attendance || []).map((x) => [String(x.date).slice(0, 10), x]));
  const totals = { present: 0, absent: 0, half: 0, leave: 0 };
  for (const record of data?.attendance || []) {
    const tone = (LABELS[record.status] || ["", ""])[1];
    if (Object.prototype.hasOwnProperty.call(totals, tone)) totals[tone] += 1;
  }
  const firstOffset = days.length ? (days[0].getDay() + 6) % 7 : 0;
  return <section className="tsa-section" aria-label="Teacher timetable and attendance">
    <div className="tsa-title-row"><div><div className="tsa-kicker">TEACHING OPERATIONS</div><h4>Weekly timetable & monthly attendance</h4><p>Actual timetable assignments and recorded employee attendance · {month}</p></div>{loading && <span className="tsa-muted">Loading…</span>}</div>
    {error && <div className="alert alert-warning" role="alert">{error}</div>}
    {!data && !error && !loading && <p className="tsa-muted">No teacher selected.</p>}
    {data && <>
      <article className="tsa-panel tsa-schedule"><div className="tsa-panel-header"><div><h5>Weekly teaching timetable</h5><small>Current assignments · Monday to Saturday</small></div><span className="tsa-count">{rows.length} allocations</span></div>
        {rows.length ? <div className="tsa-table-scroll"><table className="tsa-table"><thead><tr><th>Period</th>{DAYS.map((d) => <th key={d}>{d.slice(0, 3)}</th>)}</tr></thead><tbody>{relevant.map((p) => <tr key={p.id}><th><strong>{p.name || `Period ${p.id}`}</strong><small>{p.start_time || ""}{p.end_time ? `–${p.end_time}` : ""}</small></th>{DAYS.map((d) => { const slots = rows.filter((r) => Number(r.period_id) === Number(p.id) && dayKey(r.day) === d); return <td key={d}>{slots.length ? slots.map((slot, i) => <div key={`${slot.class_id}-${slot.section_id}-${slot.subject_id}-${i}`} className="tsa-slot"><b>{slot.class_name}{slot.section_name ? ` · ${slot.section_name}` : ""}</b><span>{slot.subject_name}</span></div>) : <span className="tsa-free">Free</span>}</td>; })}</tr>)}</tbody></table></div> : <p className="tsa-muted tsa-empty">No timetable allocations found for this teacher.</p>}
      </article>
      <article className="tsa-panel tsa-attendance"><div className="tsa-panel-header"><div><h5>Attendance calendar</h5><small>{new Date(`${month}-01T12:00:00`).toLocaleString("en-IN", { month: "long", year: "numeric" })} · Recorded statuses only</small></div><div className="tsa-stat-row"><span><b>{totals.present}</b> Present</span><span><b>{totals.absent}</b> Absent</span><span><b>{totals.half}</b> Partial</span><span><b>{totals.leave}</b> Leave</span></div></div>
        {!data.attendance_linked && <p className="tsa-warning">Employee profile not linked. Attendance records cannot be displayed.</p>}
        <div className="tsa-calendar" role="grid" aria-label={`Attendance for ${month}`}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div className="tsa-weekday" key={d}>{d}</div>)}
          {Array.from({ length: firstOffset }, (_, i) => <div aria-hidden="true" key={`gap-${i}`} className="tsa-blank" />)}
          {days.map((d) => { const key = localYmd(d); const record = attendance.get(key); const isFuture = key > localYmd(new Date()); const [label, tone] = record ? (LABELS[record.status] || [record.status, "unknown"]) : (isFuture ? ["Upcoming", "future"] : ["No record", "unknown"]); return <div key={key} className={`tsa-day tsa-${tone}`} title={`${key}: ${label}${record?.in_time ? `, in ${record.in_time}` : ""}${record?.out_time ? `, out ${record.out_time}` : ""}`} role="gridcell" aria-label={`${key}: ${label}`}><b>{d.getDate()}</b><span>{label}</span></div>; })}
        </div>
        <div className="tsa-legend"><span><i className="tsa-dot present" /> Present</span><span><i className="tsa-dot absent" /> Absent</span><span><i className="tsa-dot half" /> Partial day</span><span><i className="tsa-dot leave" /> Leave</span><span><i className="tsa-dot off" /> Holiday</span><span><i className="tsa-dot unknown" /> Not marked</span></div>
        <p className="tsa-note">Unmarked dates are not treated as absences. Calendar holidays and non-teaching day rules remain part of the existing performance scoring logic.</p>
      </article>
    </>}
  </section>;
}
