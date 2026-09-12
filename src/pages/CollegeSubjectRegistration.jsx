import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import { useBranch } from "../branch/BranchContext";
import "./CollegeSubjectRegistration.css";

const getRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const single = localStorage.getItem("userRole");
    return (many.length ? many : [single]).filter(Boolean).map((r) => String(r).toLowerCase());
  } catch (_) {
    return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean);
  }
};

const STAFF = new Set(["department_hod", "principal", "academic_coordinator", "coordinator", "admin", "superadmin", "super_admin"]);
const n = (v) => Number(v || 0);
const fmtCredits = (v) => Number(v || 0).toFixed(Number(v || 0) % 1 ? 1 : 0);

function StudentRegistrationView() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: response } = await api.get("/college-subject-registration/my");
      setData(response);
      setSelected(new Set((response?.offerings || []).filter((o) => o.selected && o.subject_type !== "core").map((o) => n(o.subject_id))));
    } catch (error) {
      Swal.fire("Unable to load", error?.response?.data?.message || error.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (subjectId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(n(subjectId))) next.delete(n(subjectId));
      else next.add(n(subjectId));
      return next;
    });
  };

  const groupStats = useMemo(() => {
    const map = new Map();
    (data?.groups || []).forEach((group) => {
      const rows = (data?.offerings || []).filter((o) => n(o.elective_group_id) === n(group.id));
      const chosen = rows.filter((o) => selected.has(n(o.subject_id)));
      map.set(n(group.id), {
        count: chosen.length,
        credits: chosen.reduce((sum, row) => sum + n(row.credits), 0),
      });
    });
    return map;
  }, [data, selected]);

  const totalCredits = useMemo(() => {
    return (data?.offerings || []).reduce((sum, row) => {
      if (row.subject_type === "core" || selected.has(n(row.subject_id))) return sum + n(row.credits);
      return sum;
    }, 0);
  }, [data, selected]);

  const save = async () => {
    setSaving(true);
    try {
      const { data: response } = await api.post("/college-subject-registration/my", { subject_ids: [...selected] });
      await Swal.fire("Saved", response?.message || "Subject choices saved.", "success");
      await load();
    } catch (error) {
      Swal.fire("Unable to save", error?.response?.data?.message || error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="csr-loading"><div className="spinner-border text-primary" /> Loading subject registration…</div>;
  if (!data?.offerings?.length) return <div className="alert alert-info rounded-4">Your program / semester subjects have not been configured yet.</div>;

  const cores = data.offerings.filter((o) => o.subject_type === "core");
  const ungrouped = data.offerings.filter((o) => o.subject_type !== "core" && !o.elective_group_id);

  const renderSubject = (row, locked = false) => {
    const checked = locked || selected.has(n(row.subject_id));
    const status = row.registration_status;
    return (
      <label className={`csr-subject-option ${checked ? "selected" : ""} ${locked ? "locked" : ""}`} key={row.id}>
        <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(row.subject_id)} />
        <span className="csr-subject-main">
          <strong>{row.subject?.name || `Subject ${row.subject_id}`}</strong>
          <small>{row.subject_type === "core" ? "Core / Compulsory" : row.subject_type === "elective" ? "Elective" : "Optional"}</small>
        </span>
        <span className="csr-credit">{fmtCredits(row.credits)} cr</span>
        {!locked && status === "pending" && <span className="badge text-bg-warning">Pending approval</span>}
        {!locked && status === "rejected" && <span className="badge text-bg-danger">Not approved</span>}
      </label>
    );
  };

  return (
    <div className="csr-student-view">
      <div className="csr-summary-grid mb-4">
        <div className="csr-summary-card"><span>Total Credits</span><strong>{fmtCredits(totalCredits)}</strong></div>
        <div className="csr-summary-card"><span>Core Papers</span><strong>{cores.length}</strong></div>
        <div className="csr-summary-card"><span>Selected Electives</span><strong>{selected.size}</strong></div>
      </div>

      {!!cores.length && <section className="csr-section-card mb-3">
        <div className="csr-section-head"><div><h2>Core / Compulsory Papers</h2><p>Automatically assigned to your program / semester.</p></div><span className="badge text-bg-success">Locked</span></div>
        <div className="csr-subject-list">{cores.map((row) => renderSubject(row, true))}</div>
      </section>}

      {(data.groups || []).map((group) => {
        const rows = data.offerings.filter((o) => n(o.elective_group_id) === n(group.id));
        const stat = groupStats.get(n(group.id)) || { count: 0, credits: 0 };
        return <section className="csr-section-card mb-3" key={group.id}>
          <div className="csr-section-head">
            <div><h2>{group.name}</h2><p>{group.description || `Choose ${group.min_choices}-${group.max_choices} paper(s) from this group.`}</p></div>
            <div className="text-end small"><strong>{stat.count}/{group.max_choices}</strong> selected<br/><span className="text-muted">{fmtCredits(stat.credits)} credits</span></div>
          </div>
          {!group.registration_open && <div className="alert alert-warning py-2">Registration window is currently closed.</div>}
          <div className="csr-rule-line">
            Choose {group.min_choices === group.max_choices ? group.min_choices : `${group.min_choices}–${group.max_choices}`} paper(s)
            {group.min_credits != null ? ` · Min ${fmtCredits(group.min_credits)} credits` : ""}
            {group.max_credits != null ? ` · Max ${fmtCredits(group.max_credits)} credits` : ""}
            {group.approval_required ? " · Approval required" : ""}
          </div>
          <div className="csr-subject-list">{rows.map((row) => renderSubject(row, false))}</div>
        </section>;
      })}

      {!!ungrouped.length && <section className="csr-section-card mb-3">
        <div className="csr-section-head"><div><h2>Optional / Add-on Papers</h2><p>Select any additional papers offered to your semester.</p></div></div>
        <div className="csr-subject-list">{ungrouped.map((row) => renderSubject(row, false))}</div>
      </section>}

      <div className="csr-save-bar">
        <div><strong>{fmtCredits(totalCredits)} credits</strong><small>Core + selected papers</small></div>
        <button className="btn btn-primary px-4" disabled={saving} onClick={save}>{saving ? "Saving…" : "Submit Subject Choices"}</button>
      </div>
    </div>
  );
}

function StaffRegistrationView() {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [groups, setGroups] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groupForm, setGroupForm] = useState({ id: null, name: "", min_choices: 1, max_choices: 1, min_credits: "", max_credits: "", approval_required: false, registration_open_at: "", registration_close_at: "" });
  const [offeringForm, setOfferingForm] = useState({ subject_id: "", subject_type: "core", credits: "0", elective_group_id: "", seat_limit: "" });

  useEffect(() => {
    Promise.all([api.get("/sessions"), api.get("/classes?withSections=true"), api.get("/subjects")])
      .then(([s, c, sub]) => {
        const sessionRows = s.data?.sessions || s.data || [];
        setSessions(sessionRows);
        setClasses(Array.isArray(c.data) ? c.data : c.data?.classes || []);
        setSubjects(sub.data?.subjects || sub.data || []);
        const active = sessionRows.find((row) => row.is_active);
        if (active) setSessionId(String(active.id));
      })
      .catch((error) => Swal.fire("Unable to load academic masters", error?.response?.data?.message || error.message, "error"));
  }, []);

  const loadSetup = useCallback(async () => {
    if (!sessionId || !classId) { setGroups([]); setOfferings([]); setRegistrations([]); return; }
    setLoading(true);
    try {
      const [setup, regs] = await Promise.all([
        api.get("/college-subject-registration/setup", { params: { session_id: sessionId, class_id: classId } }),
        api.get("/college-subject-registration/staff/registrations", { params: { session_id: sessionId, class_id: classId } }),
      ]);
      setGroups(setup.data?.groups || []);
      setOfferings(setup.data?.offerings || []);
      setRegistrations(regs.data?.students || []);
    } catch (error) {
      Swal.fire("Unable to load", error?.response?.data?.message || error.message, "error");
    } finally { setLoading(false); }
  }, [sessionId, classId]);

  useEffect(() => { loadSetup(); }, [loadSetup]);

  const saveGroup = async () => {
    if (!sessionId || !classId || !groupForm.name.trim()) return Swal.fire("Required", "Select session/program and enter group name.", "warning");
    try {
      await api.post("/college-subject-registration/groups", { ...groupForm, session_id: n(sessionId), class_id: n(classId) });
      setGroupForm({ id: null, name: "", min_choices: 1, max_choices: 1, min_credits: "", max_credits: "", approval_required: false, registration_open_at: "", registration_close_at: "" });
      await loadSetup();
    } catch (error) { Swal.fire("Unable to save group", error?.response?.data?.message || error.message, "error"); }
  };

  const editGroup = (group) => setGroupForm({
    id: group.id,
    name: group.name || "",
    min_choices: group.min_choices ?? 1,
    max_choices: group.max_choices ?? 1,
    min_credits: group.min_credits ?? "",
    max_credits: group.max_credits ?? "",
    approval_required: Boolean(group.approval_required),
    registration_open_at: group.registration_open_at ? String(group.registration_open_at).slice(0, 16) : "",
    registration_close_at: group.registration_close_at ? String(group.registration_close_at).slice(0, 16) : "",
  });

  const deleteGroup = async (id) => {
    const ok = await Swal.fire({ title: "Remove elective group?", icon: "warning", showCancelButton: true, confirmButtonText: "Remove" });
    if (!ok.isConfirmed) return;
    try { await api.delete(`/college-subject-registration/groups/${id}`); await loadSetup(); }
    catch (error) { Swal.fire("Unable to remove", error?.response?.data?.message || error.message, "error"); }
  };

  const saveOffering = async () => {
    if (!sessionId || !classId || !offeringForm.subject_id) return Swal.fire("Required", "Select session, program/semester and subject.", "warning");
    if (offeringForm.subject_type === "elective" && !offeringForm.elective_group_id) return Swal.fire("Elective group required", "Choose an elective group for this paper.", "warning");
    try {
      await api.post("/college-subject-registration/offerings/bulk", {
        session_id: n(sessionId), class_id: n(classId), offerings: [{ ...offeringForm, subject_id: n(offeringForm.subject_id), elective_group_id: offeringForm.elective_group_id ? n(offeringForm.elective_group_id) : null }],
      });
      setOfferingForm({ subject_id: "", subject_type: "core", credits: "0", elective_group_id: "", seat_limit: "" });
      await loadSetup();
    } catch (error) { Swal.fire("Unable to save subject", error?.response?.data?.message || error.message, "error"); }
  };

  const deleteOffering = async (id) => {
    const ok = await Swal.fire({ title: "Remove this paper from the semester?", icon: "warning", showCancelButton: true, confirmButtonText: "Remove" });
    if (!ok.isConfirmed) return;
    try { await api.delete(`/college-subject-registration/offerings/${id}`); await loadSetup(); }
    catch (error) { Swal.fire("Unable to remove", error?.response?.data?.message || error.message, "error"); }
  };

  const decision = async (studentId, decisionValue) => {
    try {
      const { data } = await api.patch(`/college-subject-registration/staff/registrations/${studentId}/decision`, { decision: decisionValue });
      await Swal.fire("Updated", data?.message || "Registration updated.", "success");
      await loadSetup();
    } catch (error) { Swal.fire("Unable to update", error?.response?.data?.message || error.message, "error"); }
  };

  const mappedIds = new Set(offerings.map((o) => n(o.subject_id)));
  const pendingStudents = registrations.filter((student) => (student.selections || []).some((r) => r.registration_status === "pending"));

  return <div>
    <div className="csr-filter-card mb-3">
      <div><label>Academic Year</label><select value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="">Select</option>{sessions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
      <div><label>Program / Semester</label><select value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Select</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.class_name}</option>)}</select></div>
      <div className="align-self-end"><button className="btn btn-outline-primary" onClick={loadSetup} disabled={!sessionId || !classId || loading}><i className="bi bi-arrow-clockwise me-2" />Refresh</button></div>
    </div>

    {sessionId && classId && <>
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-5">
          <section className="csr-admin-card h-100">
            <div className="csr-admin-head"><div><h2>Elective Groups</h2><p>Create “choose any 1 of 3” style rules.</p></div></div>
            <div className="row g-2">
              <div className="col-12"><input className="form-control" placeholder="Group name, e.g. Elective Group A" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Min choices</label><input type="number" min="0" className="form-control" value={groupForm.min_choices} onChange={(e) => setGroupForm({ ...groupForm, min_choices: e.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Max choices</label><input type="number" min="0" className="form-control" value={groupForm.max_choices} onChange={(e) => setGroupForm({ ...groupForm, max_choices: e.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Min credits</label><input type="number" step="0.5" className="form-control" value={groupForm.min_credits} onChange={(e) => setGroupForm({ ...groupForm, min_credits: e.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Max credits</label><input type="number" step="0.5" className="form-control" value={groupForm.max_credits} onChange={(e) => setGroupForm({ ...groupForm, max_credits: e.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Opens</label><input type="datetime-local" className="form-control" value={groupForm.registration_open_at} onChange={(e) => setGroupForm({ ...groupForm, registration_open_at: e.target.value })} /></div>
              <div className="col-6"><label className="form-label small">Closes</label><input type="datetime-local" className="form-control" value={groupForm.registration_close_at} onChange={(e) => setGroupForm({ ...groupForm, registration_close_at: e.target.value })} /></div>
              <div className="col-12 form-check ms-2"><input className="form-check-input" type="checkbox" id="approvalRequired" checked={groupForm.approval_required} onChange={(e) => setGroupForm({ ...groupForm, approval_required: e.target.checked })} /><label className="form-check-label" htmlFor="approvalRequired">HOD / Academic approval required</label></div>
              <div className="col-12 d-flex gap-2"><button className="btn btn-primary" onClick={saveGroup}>{groupForm.id ? "Update Group" : "Add Group"}</button>{groupForm.id && <button className="btn btn-light" onClick={() => setGroupForm({ id: null, name: "", min_choices: 1, max_choices: 1, min_credits: "", max_credits: "", approval_required: false, registration_open_at: "", registration_close_at: "" })}>Cancel</button>}</div>
            </div>
            <div className="csr-mini-list mt-3">{groups.map((group) => <div key={group.id}><div><strong>{group.name}</strong><small>Choose {group.min_choices}-{group.max_choices}{group.approval_required ? " · approval" : ""}</small></div><div><button onClick={() => editGroup(group)} className="btn btn-sm btn-light"><i className="bi bi-pencil" /></button><button onClick={() => deleteGroup(group.id)} className="btn btn-sm btn-light text-danger"><i className="bi bi-trash" /></button></div></div>)}</div>
          </section>
        </div>

        <div className="col-12 col-xl-7">
          <section className="csr-admin-card h-100">
            <div className="csr-admin-head"><div><h2>Program / Semester Papers</h2><p>Map core, elective and optional papers with credits.</p></div></div>
            <div className="row g-2 align-items-end">
              <div className="col-md-5"><label className="form-label small">Paper / Subject</label><select className="form-select" value={offeringForm.subject_id} onChange={(e) => setOfferingForm({ ...offeringForm, subject_id: e.target.value })}><option value="">Select subject</option>{subjects.filter((row) => !mappedIds.has(n(row.id)) || n(row.id) === n(offeringForm.subject_id)).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
              <div className="col-md-3"><label className="form-label small">Type</label><select className="form-select" value={offeringForm.subject_type} onChange={(e) => setOfferingForm({ ...offeringForm, subject_type: e.target.value, elective_group_id: e.target.value === "core" ? "" : offeringForm.elective_group_id })}><option value="core">Core / Compulsory</option><option value="elective">Elective</option><option value="optional">Optional / Add-on</option></select></div>
              <div className="col-md-2"><label className="form-label small">Credits</label><input type="number" step="0.5" min="0" className="form-control" value={offeringForm.credits} onChange={(e) => setOfferingForm({ ...offeringForm, credits: e.target.value })} /></div>
              <div className="col-md-2"><button className="btn btn-primary w-100" onClick={saveOffering}>Add</button></div>
              {offeringForm.subject_type !== "core" && <><div className="col-md-6"><label className="form-label small">Elective group {offeringForm.subject_type === "elective" ? "*" : ""}</label><select className="form-select" value={offeringForm.elective_group_id} onChange={(e) => setOfferingForm({ ...offeringForm, elective_group_id: e.target.value })}><option value="">No group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div><div className="col-md-3"><label className="form-label small">Seat limit</label><input type="number" min="1" className="form-control" value={offeringForm.seat_limit} onChange={(e) => setOfferingForm({ ...offeringForm, seat_limit: e.target.value })} /></div></>}
            </div>
            <div className="table-responsive mt-3"><table className="table align-middle csr-table"><thead><tr><th>Paper</th><th>Type</th><th>Group</th><th>Credits</th><th>Seats</th><th /></tr></thead><tbody>{offerings.map((row) => <tr key={row.id}><td><strong>{row.subject?.name || row.subject_id}</strong></td><td><span className={`badge ${row.subject_type === "core" ? "text-bg-success" : row.subject_type === "elective" ? "text-bg-primary" : "text-bg-secondary"}`}>{row.subject_type}</span></td><td>{row.electiveGroup?.name || "—"}</td><td>{fmtCredits(row.credits)}</td><td>{row.seat_limit || "—"}</td><td className="text-end"><button className="btn btn-sm btn-outline-danger" onClick={() => deleteOffering(row.id)}><i className="bi bi-trash" /></button></td></tr>)}</tbody></table>{!offerings.length && <div className="text-muted text-center py-4">No papers mapped yet.</div>}</div>
          </section>
        </div>
      </div>

      <section className="csr-admin-card">
        <div className="csr-admin-head"><div><h2>Student Subject Registrations</h2><p>Review choices and approve groups that require academic approval.</p></div><span className="badge rounded-pill text-bg-warning">{pendingStudents.length} pending</span></div>
        <div className="table-responsive"><table className="table align-middle csr-table"><thead><tr><th>Student</th><th>Selected Papers</th><th>Status</th><th /></tr></thead><tbody>{registrations.filter((student) => (student.selections || []).length).map((student) => {
          const pending = (student.selections || []).filter((r) => r.registration_status === "pending");
          return <tr key={student.id}><td><strong>{student.name}</strong><small className="d-block text-muted">{student.admission_number}</small></td><td>{(student.selections || []).map((row) => <span className="badge text-bg-light border me-1 mb-1" key={row.id}>{row.subject?.name || row.subject_id}</span>)}</td><td>{pending.length ? <span className="badge text-bg-warning">{pending.length} pending</span> : <span className="badge text-bg-success">Approved</span>}</td><td className="text-end">{!!pending.length && <div className="btn-group btn-group-sm"><button className="btn btn-outline-success" onClick={() => decision(student.id, "approved")}>Approve</button><button className="btn btn-outline-danger" onClick={() => decision(student.id, "rejected")}>Reject</button></div>}</td></tr>;
        })}</tbody></table>{!registrations.some((student) => (student.selections || []).length) && <div className="text-muted text-center py-4">Student choices will appear here after registration.</div>}</div>
      </section>
    </>}
  </div>;
}

export default function CollegeSubjectRegistration() {
  const { isCollege } = useInstitution();
  const { allBranches } = useBranch();
  const roles = useMemo(getRoles, []);
  const isStudent = roles.includes("student");
  const staff = roles.some((r) => STAFF.has(r));

  if (!isCollege) return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">Subject Registration is available in <strong>College mode</strong>.</div></div>;
  if (!isStudent && !staff) return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4">Your role does not have access to College Subject Registration.</div></div>;
  if (allBranches && staff) return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4"><strong>Select a Branch / Campus</strong> before configuring program subjects or registrations.</div></div>;

  return <main className="csr-page container-fluid py-4 px-3 px-md-4">
    <div className="csr-hero mb-4">
      <div><div className="csr-kicker">College Academics</div><h1>Subject Registration</h1><p>{isStudent ? "Review compulsory papers and choose your electives / optional subjects." : "Configure semester papers, elective groups, credits and student choices."}</p></div>
      <div className="csr-hero-icon"><i className="bi bi-ui-checks-grid" /></div>
    </div>
    {isStudent ? <StudentRegistrationView /> : <StaffRegistrationView />}
  </main>;
}
