import React, { useEffect, useMemo, useState } from "react";
import {
  addStaffLeadershipDuty,
  createStaffLeadershipAppointment,
  createStaffLeadershipPosition,
  endStaffLeadershipAppointment,
  getMyStaffLeadership,
  getStaffLeadershipAppointments,
  getStaffLeadershipBootstrap,
  openStaffLeadershipCertificatePdf,
  openStaffLeadershipPdf,
  searchStaffLeadershipEmployees,
  updateStaffLeadershipDuty,
  updateStaffLeadershipPosition,
} from "../services/staffLeadershipApi";
import "./StudentLeadershipCouncil.css";

const today = () => new Date().toISOString().slice(0, 10);

function employeePhoto(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (process.env.REACT_APP_API_URL || "").replace(/\/api\/?$/, "").replace(/\/$/, "");
  return `${base}/${String(raw).replace(/^\/+/, "")}`;
}

function StaffCard({ appointment, canManage, reload, run }) {
  const emp = appointment.employee || {};
  const linked = appointment.linked_student_leaders || [];
  return (
    <div className="leadership-card">
      <div className="leader-profile">
        {employeePhoto(emp.photo_url) ? (
          <img className="leader-photo" src={employeePhoto(emp.photo_url)} alt="" />
        ) : (
          <div className="leader-photo d-flex align-items-center justify-content-center fw-bold">
            {(emp.name || "T").slice(0, 1)}
          </div>
        )}
        <div>
          <div className="leader-position">{appointment.position?.name}</div>
          <div className="leader-name">{emp.name}</div>
          <div className="leader-meta">
            {[emp.designation, emp.department?.name, appointment.wing?.name, appointment.leadershipHouse?.house_name]
              .filter(Boolean)
              .join(" • ")}
          </div>
          <div className="leader-meta">{appointment.assignment_method} • from {appointment.start_date}</div>
        </div>
      </div>

      {linked.length > 0 && (
        <div className="mt-3">
          <div className="mini-note fw-bold">Linked Student Leaders</div>
          <div className="d-flex flex-wrap gap-2 mt-1">
            {linked.slice(0, 8).map((s) => (
              <span className="status-pill active" key={s.id}>
                {s.student?.name} — {s.position?.name}
              </span>
            ))}
            {linked.length > 8 && <span className="mini-note">+{linked.length - 8} more</span>}
          </div>
        </div>
      )}

      {(appointment.duties || []).slice(0, 4).map((d) => (
        <div key={d.id} className="duty-row mini-note">
          {d.title} • {d.status}
        </div>
      ))}

      {canManage && (
        <div className="mt-2 d-flex gap-2 flex-wrap">
          <button className="btn-lead soft" onClick={() => run(() => openStaffLeadershipCertificatePdf(appointment.id))}>
            Print Appointment
          </button>
          <button
            className="btn-lead warn"
            onClick={() => {
              const reason = window.prompt("Completion note (optional):") || "";
              run(async () => {
                await endStaffLeadershipAppointment(appointment.id, { status: "completed", reason });
                await reload();
              });
            }}
          >
            Complete Tenure
          </button>
        </div>
      )}
    </div>
  );
}

export default function StaffLeadershipResponsibilities() {
  const [meta, setMeta] = useState({ can_manage: false, sessions: [], houses: [], wings: [], positions: [] });
  const [sessionId, setSessionId] = useState("");
  const [appointments, setAppointments] = useState([]);
  const [myData, setMyData] = useState(null);
  const [tab, setTab] = useState("team");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [appointmentForm, setAppointmentForm] = useState({
    position_id: "", wing_id: "", house_id: "", start_date: today(), end_date: "",
    assignment_method: "direct", appointment_note: "",
  });
  const [dutyForm, setDutyForm] = useState({ appointment_id: "", title: "", due_date: "", description: "" });
  const [positionForm, setPositionForm] = useState({
    name: "", code: "", scope_type: "school", max_holders_per_scope: 1,
    description: "", counts_for_performance: true,
  });

  const run = async (fn) => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); } catch (e) { setError(e?.response?.data?.message || e.message || "Something went wrong"); }
    finally { setBusy(false); }
  };

  const loadMeta = async () => {
    const data = await getStaffLeadershipBootstrap();
    setMeta(data);
    const active = data.sessions?.find((s) => s.is_active) || data.sessions?.[0];
    if (!sessionId && active) setSessionId(String(active.id));
    if (!data.can_manage) {
      const mine = await getMyStaffLeadership();
      setMyData(mine);
    }
  };

  const reloadAppointments = async () => {
    if (!meta.can_manage || !sessionId) return;
    const data = await getStaffLeadershipAppointments({ session_id: sessionId });
    setAppointments(data.appointments || []);
  };

  useEffect(() => { run(loadMeta); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (meta.can_manage && sessionId) run(reloadAppointments); }, [meta.can_manage, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!meta.can_manage || query.trim().length < 2) { setEmployees([]); return undefined; }
    const timer = window.setTimeout(() => {
      searchStaffLeadershipEmployees({ q: query.trim(), limit: 50 })
        .then((d) => setEmployees(d.employees || []))
        .catch(() => setEmployees([]));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, meta.can_manage]);

  const activeAppointments = useMemo(() => appointments.filter((a) => a.status === "active"), [appointments]);
  const selectedPosition = meta.positions?.find((p) => Number(p.id) === Number(appointmentForm.position_id));
  const needsWing = ["wing", "house_wing"].includes(selectedPosition?.scope_type);
  const needsHouse = ["house", "house_wing"].includes(selectedPosition?.scope_type);

  const grouped = useMemo(() => {
    const school = activeAppointments.filter((a) => a.position?.scope_type === "school");
    const wing = {}; const house = {};
    activeAppointments.filter((a) => ["wing", "house_wing"].includes(a.position?.scope_type)).forEach((a) => {
      const k = a.wing?.name || "Wing Leadership"; if (!wing[k]) wing[k] = []; wing[k].push(a);
    });
    activeAppointments.filter((a) => ["house", "house_wing"].includes(a.position?.scope_type)).forEach((a) => {
      const k = [a.leadershipHouse?.house_name || "House", a.wing?.name].filter(Boolean).join(" • ");
      if (!house[k]) house[k] = []; house[k].push(a);
    });
    return { school, wing, house };
  }, [activeAppointments]);

  const appoint = () => run(async () => {
    if (!selectedEmployee) throw new Error("Select an employee");
    await createStaffLeadershipAppointment({
      ...appointmentForm,
      employee_id: selectedEmployee.id,
      session_id: Number(sessionId),
      position_id: Number(appointmentForm.position_id),
      wing_id: needsWing ? Number(appointmentForm.wing_id) : null,
      house_id: needsHouse ? Number(appointmentForm.house_id) : null,
    });
    setSelectedEmployee(null); setQuery(""); setEmployees([]);
    setAppointmentForm({ position_id: "", wing_id: "", house_id: "", start_date: today(), end_date: "", assignment_method: "direct", appointment_note: "" });
    await reloadAppointments(); setMessage("Staff leadership responsibility assigned successfully.");
  });

  if (!meta.can_manage) {
    const active = myData?.active || [];
    const history = myData?.history || [];
    return (
      <div className="container-fluid py-3">
        <div className="leadership-hero">
          <h2>🏅 My Leadership & Responsibilities</h2>
          <p>Your school, wing and house responsibilities, linked student leaders and assigned duties.</p>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
        {!busy && active.length === 0 && <div className="leadership-card empty-lead">No active leadership responsibility assigned.</div>}
        <div className="leadership-grid">
          {active.map((a) => (
            <div className="leadership-card" key={a.id}>
              <div className="leader-position">{a.position?.name}</div>
              <div className="leader-meta">{[a.wing?.name, a.leadershipHouse?.house_name, a.session?.name].filter(Boolean).join(" • ")}</div>
              {(a.linked_student_leaders || []).length > 0 && (
                <div className="mt-3">
                  <div className="mini-note fw-bold">Student Leaders with You</div>
                  {(a.linked_student_leaders || []).slice(0, 10).map((s) => (
                    <div className="duty-row mini-note" key={s.id}>{s.student?.name} — {s.position?.name}</div>
                  ))}
                </div>
              )}
              <div className="mt-3">
                {(a.duties || []).map((d) => (
                  <div className="duty-row" key={d.id}>
                    <b>{d.title}</b> <span className={`status-pill ${d.status}`}>{d.status}</span>
                    {d.description && <div className="mini-note">{d.description}</div>}
                    {d.status === "assigned" && (
                      <button className="btn-lead soft mt-1" onClick={() => run(async () => {
                        await updateStaffLeadershipDuty(d.id, { status: "acknowledged" });
                        setMyData(await getMyStaffLeadership());
                      })}>Acknowledge</button>
                    )}
                    {["assigned", "acknowledged"].includes(d.status) && (
                      <button className="btn-lead primary mt-1 ms-2" onClick={() => run(async () => {
                        await updateStaffLeadershipDuty(d.id, { status: "completed" });
                        setMyData(await getMyStaffLeadership());
                      })}>Mark Complete</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {history.length > 0 && <><div className="leadership-section-title mt-4">Previous Responsibilities</div><div className="leadership-grid">{history.map((a) => <StaffCard key={a.id} appointment={a} canManage={false} reload={() => {}} run={run} />)}</div></>}
      </div>
    );
  }

  return (
    <div className="container-fluid py-3">
      <div className="leadership-hero">
        <h2>🏅 Staff Leadership & Activity Responsibilities</h2>
        <p>Overall Activity Incharge, wing and house incharges, vice incharges, duties and linked student leaders.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      <div className="d-flex gap-2 flex-wrap align-items-end mb-3">
        <label className="form-label mb-0">Session
          <select className="form-select" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {(meta.sessions || []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " (Active)" : ""}</option>)}
          </select>
        </label>
        <button className="btn-lead primary" disabled={!sessionId || busy} onClick={() => run(() => openStaffLeadershipPdf(sessionId))}>Print Branded Staff Leadership PDF</button>
      </div>

      <div className="leadership-tabs mb-3">
        {["team", "assign", "duties", "setup"].map((t) => (
          <button key={t} className={`leadership-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t === "team" ? "Leadership Team" : t === "assign" ? "Assign Responsibility" : t === "duties" ? "Duties" : "Setup"}</button>
        ))}
      </div>

      {tab === "team" && (
        <>
          <div className="leadership-section-title">School Level</div>
          <div className="leadership-grid">{grouped.school.map((a) => <StaffCard key={a.id} appointment={a} canManage reload={reloadAppointments} run={run} />)}{!grouped.school.length && <div className="leadership-card empty-lead">No school-level responsibilities yet.</div>}</div>
          {Object.entries(grouped.wing).map(([name, list]) => <React.Fragment key={name}><div className="leadership-section-title mt-4">{name}</div><div className="leadership-grid">{list.map((a) => <StaffCard key={a.id} appointment={a} canManage reload={reloadAppointments} run={run} />)}</div></React.Fragment>)}
          {Object.entries(grouped.house).map(([name, list]) => <React.Fragment key={name}><div className="leadership-section-title mt-4">{name}</div><div className="leadership-grid">{list.map((a) => <StaffCard key={a.id} appointment={a} canManage reload={reloadAppointments} run={run} />)}</div></React.Fragment>)}
        </>
      )}

      {tab === "assign" && (
        <div className="leadership-form">
          <div className="leadership-form-grid">
            <label>Search Employee
              <input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedEmployee(null); }} placeholder="Name, employee ID or designation" />
            </label>
            <label>Position
              <select value={appointmentForm.position_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, position_id: e.target.value, wing_id: "", house_id: "" })}>
                <option value="">Select position</option>
                {(meta.positions || []).filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} — {p.scope_type}</option>)}
              </select>
            </label>
            {needsWing && <label>Wing<select value={appointmentForm.wing_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, wing_id: e.target.value })}><option value="">Select wing</option>{(meta.wings || []).filter((w) => w.active).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
            {needsHouse && <label>House<select value={appointmentForm.house_id} onChange={(e) => setAppointmentForm({ ...appointmentForm, house_id: e.target.value })}><option value="">Select house</option>{(meta.houses || []).map((h) => <option key={h.id} value={h.id}>{h.house_name}</option>)}</select></label>}
            <label>From Date<input type="date" value={appointmentForm.start_date} onChange={(e) => setAppointmentForm({ ...appointmentForm, start_date: e.target.value })} /></label>
            <label>To Date<input type="date" value={appointmentForm.end_date} onChange={(e) => setAppointmentForm({ ...appointmentForm, end_date: e.target.value })} /></label>
            <label>Assignment Method<select value={appointmentForm.assignment_method} onChange={(e) => setAppointmentForm({ ...appointmentForm, assignment_method: e.target.value })}><option value="direct">Direct</option><option value="nomination">Nomination</option><option value="committee">Committee</option><option value="principal_order">Principal Order</option><option value="other">Other</option></select></label>
          </div>

          {employees.length > 0 && !selectedEmployee && (
            <div className="leadership-table-wrap mt-2"><table className="leadership-table"><tbody>{employees.map((e) => <tr key={e.id} onClick={() => { setSelectedEmployee(e); setQuery(e.name); setEmployees([]); }} style={{ cursor: "pointer" }}><td><b>{e.name}</b><div className="mini-note">{e.employee_id} • {e.designation || "Employee"} • {e.department?.name || ""}</div></td><td>Select</td></tr>)}</tbody></table></div>
          )}
          {selectedEmployee && <div className="alert alert-light border mt-2"><b>Selected:</b> {selectedEmployee.name} • {selectedEmployee.designation || "Employee"}</div>}
          <label className="mt-2">Appointment / Responsibility Note<textarea rows="3" value={appointmentForm.appointment_note} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointment_note: e.target.value })} /></label>
          <button className="btn-lead primary mt-3" disabled={busy || !selectedEmployee || !appointmentForm.position_id || (needsWing && !appointmentForm.wing_id) || (needsHouse && !appointmentForm.house_id)} onClick={appoint}>Assign Leadership Responsibility</button>
        </div>
      )}

      {tab === "duties" && (
        <div className="leadership-form">
          <div className="leadership-form-grid">
            <label>Staff Leadership Holder<select value={dutyForm.appointment_id} onChange={(e) => setDutyForm({ ...dutyForm, appointment_id: e.target.value })}><option value="">Select staff / position</option>{activeAppointments.map((a) => <option key={a.id} value={a.id}>{a.employee?.name} — {a.position?.name}</option>)}</select></label>
            <label>Duty / Responsibility<input value={dutyForm.title} onChange={(e) => setDutyForm({ ...dutyForm, title: e.target.value })} /></label>
            <label>Due Date<input type="date" value={dutyForm.due_date} onChange={(e) => setDutyForm({ ...dutyForm, due_date: e.target.value })} /></label>
          </div>
          <label className="mt-2">Description<textarea rows="2" value={dutyForm.description} onChange={(e) => setDutyForm({ ...dutyForm, description: e.target.value })} /></label>
          <button className="btn-lead primary mt-3" disabled={!dutyForm.appointment_id || !dutyForm.title || busy} onClick={() => run(async () => { await addStaffLeadershipDuty(dutyForm.appointment_id, dutyForm); setDutyForm({ appointment_id: "", title: "", due_date: "", description: "" }); await reloadAppointments(); setMessage("Duty assigned."); })}>Assign Duty</button>
          <div className="leadership-table-wrap mt-4"><table className="leadership-table"><thead><tr><th>Staff</th><th>Position</th><th>Duty</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{activeAppointments.flatMap((a) => (a.duties || []).map((d) => <tr key={d.id}><td>{a.employee?.name}</td><td>{a.position?.name}</td><td>{d.title}<div className="mini-note">{d.description}</div></td><td>{d.due_date || "-"}</td><td><span className={`status-pill ${d.status}`}>{d.status}</span></td><td>{!["completed", "cancelled"].includes(d.status) && <button className="btn-lead soft" onClick={() => run(async () => { await updateStaffLeadershipDuty(d.id, { status: "completed" }); await reloadAppointments(); })}>Mark Complete</button>}</td></tr>))}</tbody></table></div>
        </div>
      )}

      {tab === "setup" && (
        <div className="leadership-grid">
          <div className="leadership-form">
            <h5>Staff Position Setup</h5>
            <div className="leadership-form-grid">
              <label>Name<input value={positionForm.name} onChange={(e) => setPositionForm({ ...positionForm, name: e.target.value })} /></label>
              <label>Code<input value={positionForm.code} onChange={(e) => setPositionForm({ ...positionForm, code: e.target.value })} /></label>
              <label>Scope<select value={positionForm.scope_type} onChange={(e) => setPositionForm({ ...positionForm, scope_type: e.target.value })}><option value="school">School</option><option value="wing">Wing</option><option value="house">House</option><option value="house_wing">House + Wing</option></select></label>
              <label>Max holders per scope<input type="number" min="1" value={positionForm.max_holders_per_scope} onChange={(e) => setPositionForm({ ...positionForm, max_holders_per_scope: e.target.value })} /></label>
            </div>
            <label className="mt-2">Description<textarea rows="2" value={positionForm.description} onChange={(e) => setPositionForm({ ...positionForm, description: e.target.value })} /></label>
            <button className="btn-lead primary mt-3" disabled={!positionForm.name || busy} onClick={() => run(async () => { await createStaffLeadershipPosition(positionForm); setPositionForm({ name: "", code: "", scope_type: "school", max_holders_per_scope: 1, description: "", counts_for_performance: true }); await loadMeta(); setMessage("Staff leadership position created."); })}>Add Position</button>
            <div className="mt-3">{(meta.positions || []).map((p) => <div key={p.id} className="duty-row"><b>{p.name}</b> <span className="mini-note">{p.scope_type} • max {p.max_holders_per_scope} • {p.active ? "Active" : "Inactive"}</span><button className="btn btn-sm btn-link" onClick={() => run(async () => { await updateStaffLeadershipPosition(p.id, { active: !p.active }); await loadMeta(); })}>{p.active ? "Deactivate" : "Activate"}</button></div>)}</div>
          </div>
          <div className="leadership-form">
            <h5>Shared Wing Setup</h5>
            <p className="mini-note">Junior / Middle / Senior wings are shared with Student Leadership. Manage wing names and class mapping from <b>Student Leadership & Council → Setup</b>, then use the same wings here for staff responsibilities.</p>
            {(meta.wings || []).map((w) => <div key={w.id} className="duty-row"><b>{w.name}</b> <span className="mini-note">{w.active ? "Active" : "Inactive"}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
