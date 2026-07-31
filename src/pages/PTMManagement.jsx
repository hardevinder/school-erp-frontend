import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./PTMManagement.css";

const MANAGER_ROLES = new Set([
  "superadmin",
  "super_admin",
  "admin",
  "academic_coordinator",
  "coordinator",
  "principal",
]);

function storedRoles() {
  const values = [];
  for (const storage of [localStorage, sessionStorage]) {
    for (const key of ["roles", "role", "activeRole", "selectedRole", "userRole"]) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) values.push(...parsed);
        else values.push(parsed);
      } catch {
        values.push(raw);
      }
    }
  }
  return [
    ...new Set(
      values
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/-+/g, "_")
            .replace(/_+/g, "_")
        )
        .filter(Boolean)
    ),
  ];
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN");
}

function errorMessage(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
}

function statusBadge(status) {
  const value = String(status || "PENDING").toUpperCase();
  const classes = {
    PRESENT: "success",
    PRESENT_SUGGESTED: "warning",
    ABSENT: "danger",
    EXCUSED: "info",
    PENDING: "secondary",
  };
  return <span className={`badge text-bg-${classes[value] || "secondary"}`}>{value.replaceAll("_", " ")}</span>;
}

const emptyCreate = {
  title: "Parent Teacher Meeting",
  session_id: "",
  meeting_date: "",
  start_time: "",
  end_time: "",
  venue: "",
  agenda: "",
  instructions: "",
  targets: [],
};

export default function PTMManagement() {
  const roles = useMemo(storedRoles, []);
  const isManager = roles.some((role) => MANAGER_ROLES.has(role));
  const [meetings, setMeetings] = useState([]);
  const [meta, setMeta] = useState({ sessions: [], classes: [] });
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [selectedMeetingIds, setSelectedMeetingIds] = useState([]);
  const [showMeetingManager, setShowMeetingManager] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [targetData, setTargetData] = useState(null);
  const [editingFormId, setEditingFormId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const notify = (text, type = "success") => {
    setMessage({ text, type });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const loadMeetings = async (preferredId = null, resetSelection = false) => {
    const { data } = await api.get("/ptm/meetings");
    const rows = data?.meetings || [];
    setMeetings(rows);
    setSelectedMeetingIds((prev) =>
      prev.filter((id) => rows.some((meeting) => Number(meeting.id) === Number(id)))
    );

    const currentId = resetSelection ? null : selectedMeetingId;
    const next =
      (preferredId && rows.some((meeting) => Number(meeting.id) === Number(preferredId))
        ? Number(preferredId)
        : null) ||
      (currentId && rows.some((meeting) => Number(meeting.id) === Number(currentId))
        ? Number(currentId)
        : null) ||
      rows[0]?.id ||
      null;

    setSelectedMeetingId(next);
    return next;
  };

  const loadMeta = async (sessionId = null) => {
    if (!isManager) return;
    const { data } = await api.get("/ptm/meta", {
      params: sessionId ? { session_id: sessionId } : {},
    });
    const next = data || { sessions: [], classes: [] };
    setMeta(next);
    setCreateForm((prev) => ({
      ...prev,
      session_id:
        String(sessionId || prev.session_id || next.selected_session_id || next.sessions?.find((s) => s.is_active)?.id || next.sessions?.[0]?.id || ""),
    }));
  };

  const loadDashboard = async (meetingId) => {
    if (!meetingId) {
      setDashboard(null);
      return;
    }
    const { data } = await api.get(`/ptm/meetings/${meetingId}/dashboard`);
    setDashboard(data);
    const currentStillExists = data?.summaries?.some((row) => Number(row.id) === Number(selectedTargetId));
    if (!currentStillExists) {
      setSelectedTargetId(null);
      setTargetData(null);
    }
  };

  const loadTarget = async (targetId) => {
    if (!targetId) return;
    setSelectedTargetId(targetId);
    const { data } = await api.get(`/ptm/meeting-classes/${targetId}/students`);
    setTargetData(data);
    const nextDrafts = {};
    for (const form of data?.forms || []) {
      nextDrafts[form.id] = {
        parent_name: form.feedback?.parent_name || "",
        relation: form.feedback?.relation || "",
        academic_rating: form.feedback?.academic_rating || "",
        behaviour_rating: form.feedback?.behaviour_rating || "",
        communication_rating: form.feedback?.communication_rating || "",
        parent_remarks: form.feedback?.parent_remarks || "",
        teacher_remarks: form.feedback?.teacher_remarks || "",
        action_points: form.feedback?.action_points || "",
        signature_detected: Boolean(form.feedback?.signature_detected || form.attendance?.signature_detected),
        attendance_status:
          form.attendance?.status === "PRESENT_SUGGESTED" ? "PRESENT" : form.attendance?.status || "PENDING",
        attendance_reason: form.attendance?.reason || "",
      };
    }
    setDrafts(nextDrafts);
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadMeetings(), loadMeta()]);
      } catch (error) {
        notify(errorMessage(error, "Could not load PTM module."), "danger");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedMeetingId) return;
    loadDashboard(selectedMeetingId).catch((error) => notify(errorMessage(error, "Could not load PTM dashboard."), "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeetingId]);

  const selectedTargets = new Set(createForm.targets.map((t) => `${t.class_id}:${t.section_id}`));

  const toggleSection = (classId, sectionId) => {
    const key = `${classId}:${sectionId}`;
    setCreateForm((prev) => {
      const exists = prev.targets.some((row) => `${row.class_id}:${row.section_id}` === key);
      return {
        ...prev,
        targets: exists
          ? prev.targets.filter((row) => `${row.class_id}:${row.section_id}` !== key)
          : [...prev.targets, { class_id: classId, section_id: sectionId }],
      };
    });
  };

  const toggleClass = (cls) => {
    const sectionKeys = (cls.sections || []).map((sec) => `${cls.id}:${sec.id}`);
    const allSelected = sectionKeys.length > 0 && sectionKeys.every((key) => selectedTargets.has(key));
    setCreateForm((prev) => {
      const withoutClass = prev.targets.filter((row) => Number(row.class_id) !== Number(cls.id));
      return {
        ...prev,
        targets: allSelected
          ? withoutClass
          : [...withoutClass, ...(cls.sections || []).map((sec) => ({ class_id: cls.id, section_id: sec.id }))],
      };
    });
  };

  const createMeeting = async (event) => {
    event.preventDefault();
    if (!createForm.targets.length) return notify("Please select at least one class-section.", "warning");
    try {
      setSaving(true);
      const { data } = await api.post("/ptm/meetings", createForm);
      notify(data?.message || "PTM scheduled successfully.");
      setCreateForm((prev) => ({ ...emptyCreate, session_id: prev.session_id }));
      const nextId = await loadMeetings(data?.meeting_id);
      await loadDashboard(nextId);
    } catch (error) {
      notify(errorMessage(error, "Could not schedule PTM."), "danger");
    } finally {
      setSaving(false);
    }
  };


  const refreshAfterMeetingDelete = async () => {
    setTargetData(null);
    setSelectedTargetId(null);
    setEditingFormId(null);
    const nextId = await loadMeetings(null, true);
    if (nextId) await loadDashboard(nextId);
    else setDashboard(null);
    return nextId;
  };

  const deleteMeeting = async (meetingId) => {
    const meeting = meetings.find((row) => Number(row.id) === Number(meetingId));
    const label = meeting ? `${formatDate(meeting.meeting_date)} — ${meeting.title}` : `PTM #${meetingId}`;
    if (!window.confirm(`Delete ${label}? All class assignments, student forms, attendance, feedback and scans for this PTM will also be deleted.`)) return;

    try {
      setSaving(true);
      const { data } = await api.delete(`/ptm/meetings/${meetingId}`);
      notify(data?.message || "PTM meeting deleted successfully.");
      setSelectedMeetingIds((prev) => prev.filter((id) => Number(id) !== Number(meetingId)));
      await refreshAfterMeetingDelete();
      if ((meetings?.length || 0) <= 1) setShowMeetingManager(false);
    } catch (error) {
      notify(errorMessage(error, "Could not delete PTM meeting."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedMeetings = async () => {
    const ids = [...new Set(selectedMeetingIds.map(Number).filter(Boolean))];
    if (!ids.length) return notify("Please select at least one PTM meeting.", "warning");
    if (!window.confirm(`Delete ${ids.length} selected PTM meeting${ids.length === 1 ? "" : "s"}? All related forms, attendance, feedback and scans will also be deleted.`)) return;

    try {
      setSaving(true);
      const { data } = await api.delete("/ptm/meetings", {
        data: { meeting_ids: ids },
      });
      notify(data?.message || "Selected PTM meetings deleted successfully.");
      setSelectedMeetingIds([]);
      await refreshAfterMeetingDelete();
      setShowMeetingManager(false);
    } catch (error) {
      notify(errorMessage(error, "Could not delete selected PTM meetings."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const toggleMeetingSelection = (meetingId) => {
    setSelectedMeetingIds((prev) =>
      prev.some((id) => Number(id) === Number(meetingId))
        ? prev.filter((id) => Number(id) !== Number(meetingId))
        : [...prev, Number(meetingId)]
    );
  };

  const toggleAllMeetings = () => {
    const allIds = meetings.map((meeting) => Number(meeting.id));
    const allSelected = allIds.length > 0 && allIds.every((id) => selectedMeetingIds.includes(id));
    setSelectedMeetingIds(allSelected ? [] : allIds);
  };

  const downloadForms = async (targetId) => {
    try {
      const response = await api.get(`/ptm/meeting-classes/${targetId}/forms.pdf`, { responseType: "blob" });
      const disposition = response.headers["content-disposition"] || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || "PTM_Feedback_Forms.pdf";
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify(errorMessage(error, "Could not download PTM forms."), "danger");
    }
  };

  const uploadScan = async (formId, file) => {
    if (!file) return;
    try {
      setSaving(true);
      const body = new FormData();
      body.append("scan", file);
      body.append("process_ai", "true");
      const { data } = await api.post(`/ptm/forms/${formId}/scan`, body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      notify(data?.message || "Scanned PTM form saved.", data?.needs_review ? "warning" : "success");
      await loadTarget(selectedTargetId);
      await loadDashboard(selectedMeetingId);
    } catch (error) {
      notify(errorMessage(error, "Could not upload PTM scan."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const saveForm = async (formId) => {
    try {
      setSaving(true);
      const { data } = await api.put(`/ptm/forms/${formId}`, drafts[formId]);
      notify(data?.message || "PTM feedback saved.");
      setEditingFormId(null);
      await loadTarget(selectedTargetId);
      await loadDashboard(selectedMeetingId);
    } catch (error) {
      notify(errorMessage(error, "Could not save PTM feedback."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const viewScan = async (scanId, mimeType = "application/octet-stream") => {
    try {
      const response = await api.get(`/ptm/scans/${scanId}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      notify(errorMessage(error, "Could not open scanned form."), "danger");
    }
  };

  const setDraft = (formId, key, value) => {
    setDrafts((prev) => ({ ...prev, [formId]: { ...(prev[formId] || {}), [key]: value } }));
  };

  if (loading) return <div className="container py-5 text-center"><div className="spinner-border" /></div>;

  return (
    <div className="container-fluid py-3 ptm-page">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="mb-1">Parent Teacher Meetings</h2>
          <div className="text-muted">Schedule multiple classes, print forms, save scans and verify PTM attendance.</div>
        </div>
        <button className="btn btn-outline-primary" onClick={() => loadMeetings().then(loadDashboard)}>
          <i className="bi bi-arrow-clockwise me-1" /> Refresh
        </button>
      </div>

      {message && <div className={`alert alert-${message.type} py-2`}>{message.text}</div>}

      {isManager && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-white"><strong>Schedule New PTM</strong></div>
          <div className="card-body">
            <form onSubmit={createMeeting}>
              <div className="row g-3">
                <div className="col-lg-4"><label className="form-label">Title</label><input className="form-control" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} required /></div>
                <div className="col-lg-2"><label className="form-label">Session</label><select className="form-select" value={createForm.session_id} onChange={(e) => { const sessionId = e.target.value; setCreateForm((prev) => ({ ...prev, session_id: sessionId, targets: [] })); loadMeta(sessionId).catch((error) => notify(errorMessage(error, "Could not load class-sections."), "danger")); }} required><option value="">Select</option>{(meta.sessions || []).map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_active ? " (Active)" : ""}</option>)}</select></div>
                <div className="col-lg-2"><label className="form-label">Date</label><input type="date" className="form-control" value={createForm.meeting_date} onChange={(e) => setCreateForm({ ...createForm, meeting_date: e.target.value })} required /></div>
                <div className="col-lg-2"><label className="form-label">Start</label><input type="time" className="form-control" value={createForm.start_time} onChange={(e) => setCreateForm({ ...createForm, start_time: e.target.value })} /></div>
                <div className="col-lg-2"><label className="form-label">End</label><input type="time" className="form-control" value={createForm.end_time} onChange={(e) => setCreateForm({ ...createForm, end_time: e.target.value })} /></div>
                <div className="col-lg-4"><label className="form-label">Venue</label><input className="form-control" value={createForm.venue} onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })} /></div>
                <div className="col-lg-4"><label className="form-label">Agenda</label><textarea rows="2" className="form-control" value={createForm.agenda} onChange={(e) => setCreateForm({ ...createForm, agenda: e.target.value })} /></div>
                <div className="col-lg-4"><label className="form-label">Instructions</label><textarea rows="2" className="form-control" value={createForm.instructions} onChange={(e) => setCreateForm({ ...createForm, instructions: e.target.value })} /></div>
              </div>

              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <strong>Select Classes / Sections</strong>
                  <span className="badge text-bg-primary">{createForm.targets.length} selected</span>
                </div>
                <div className="ptm-class-grid">
                  {(meta.classes || []).map((cls) => {
                    const keys = (cls.sections || []).map((sec) => `${cls.id}:${sec.id}`);
                    const allSelected = keys.length > 0 && keys.every((key) => selectedTargets.has(key));
                    return (
                      <div className="ptm-class-card" key={cls.id}>
                        <label className="fw-bold d-flex gap-2 align-items-center mb-2">
                          <input type="checkbox" checked={allSelected} onChange={() => toggleClass(cls)} /> {cls.class_name}
                        </label>
                        <div className="d-flex flex-wrap gap-2">
                          {(cls.sections || []).map((sec) => {
                            const selected = selectedTargets.has(`${cls.id}:${sec.id}`);
                            return (
                              <label key={sec.id} className={`ptm-section-pill ${selected ? "selected" : ""}`}>
                                <input type="checkbox" checked={selected} onChange={() => toggleSection(cls.id, sec.id)} />
                                {sec.section_name}
                                <small>{sec.incharge?.name || "No incharge"}</small>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 text-end"><button className="btn btn-primary" disabled={saving}>{saving ? "Scheduling..." : "Schedule PTM"}</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="card shadow-sm mb-4">
        <div className="card-header bg-white d-flex flex-wrap gap-2 align-items-center">
          <strong className="me-2">Meetings</strong>
          <select className="form-select ptm-meeting-select" value={selectedMeetingId || ""} onChange={(e) => setSelectedMeetingId(Number(e.target.value) || null)}>
            <option value="">Select PTM</option>
            {meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{formatDate(meeting.meeting_date)} — {meeting.title}</option>)}
          </select>
          {isManager && (
            <button
              type="button"
              className="btn btn-outline-danger ms-auto"
              onClick={() => setShowMeetingManager(true)}
            >
              <i className="bi bi-trash3 me-1" /> Manage / Delete
            </button>
          )}
        </div>
        {dashboard?.meeting ? (
          <div className="card-body">
            {(dashboard.meeting.agenda || dashboard.meeting.instructions) && (
              <div className="alert alert-light border mb-3">
                {dashboard.meeting.agenda && <div><strong>Agenda:</strong> {dashboard.meeting.agenda}</div>}
                {dashboard.meeting.instructions && <div><strong>Instructions:</strong> {dashboard.meeting.instructions}</div>}
              </div>
            )}
            <div className="row g-3 mb-3">
              {[
                ["Strength", dashboard.total?.strength, "people"],
                ["Scanned", dashboard.total?.scanned, "file-earmark-check"],
                ["Present", dashboard.total?.present, "person-check"],
                ["AI Suggested", dashboard.total?.suggested_present, "stars"],
                ["Absent", dashboard.total?.absent, "person-x"],
                ["Pending", dashboard.total?.pending, "hourglass-split"],
              ].map(([label, value, icon]) => (
                <div className="col-6 col-md" key={label}><div className="ptm-stat"><i className={`bi bi-${icon}`} /><div><small>{label}</small><strong>{value || 0}</strong></div></div></div>
              ))}
            </div>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead><tr><th>Class</th><th>Incharge</th><th>Strength</th><th>Scanned</th><th>Present</th><th>Absent</th><th>Pending</th><th>Progress</th><th /></tr></thead>
                <tbody>
                  {(dashboard.summaries || []).map((row) => (
                    <tr key={row.id} className={Number(selectedTargetId) === Number(row.id) ? "table-primary" : ""}>
                      <td><strong>{row.class?.class_name}-{row.section?.section_name}</strong></td>
                      <td>{row.inchargeTeacher?.name || "Not assigned"}</td>
                      <td>{row.strength}</td><td>{row.scanned}</td><td>{row.present}<div className="small text-muted">Verified {row.verified_present} · AI {row.suggested_present}</div></td><td>{row.absent}</td><td>{row.pending}</td>
                      <td><div className="progress" style={{ minWidth: 100 }}><div className="progress-bar" style={{ width: `${row.completion_percent}%` }}>{row.completion_percent}%</div></div></td>
                      <td className="text-nowrap"><button className="btn btn-sm btn-outline-secondary me-2" onClick={() => downloadForms(row.id)}><i className="bi bi-file-pdf" /> Forms</button><button className="btn btn-sm btn-primary" onClick={() => loadTarget(row.id)}>Open</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <div className="card-body text-muted">No PTM selected.</div>}
      </div>


      {showMeetingManager && isManager && (
        <div
          className="ptm-modal-backdrop"
          role="presentation"
          onMouseDown={() => !saving && setShowMeetingManager(false)}
        >
          <div
            className="card shadow-lg ptm-meeting-manager-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Manage PTM meetings"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="card-header bg-white d-flex align-items-center justify-content-between gap-2">
              <div>
                <strong>Manage PTM Meetings</strong>
                <div className="small text-muted">Select one, multiple, or all meetings to delete.</div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={saving}
                onClick={() => setShowMeetingManager(false)}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="card-body p-0 ptm-manager-list">
              {meetings.length > 0 ? (
                <>
                  <label className="ptm-manager-row ptm-manager-select-all">
                    <input
                      type="checkbox"
                      checked={meetings.length > 0 && meetings.every((meeting) => selectedMeetingIds.includes(Number(meeting.id)))}
                      onChange={toggleAllMeetings}
                    />
                    <strong>Select All Meetings</strong>
                    <span className="badge text-bg-primary ms-auto">{selectedMeetingIds.length} selected</span>
                  </label>
                  {meetings.map((meeting) => (
                    <div className="ptm-manager-row" key={meeting.id}>
                      <input
                        type="checkbox"
                        checked={selectedMeetingIds.includes(Number(meeting.id))}
                        onChange={() => toggleMeetingSelection(meeting.id)}
                      />
                      <button
                        type="button"
                        className="btn btn-link text-start text-decoration-none flex-grow-1 p-0"
                        onClick={() => {
                          setSelectedMeetingId(Number(meeting.id));
                          setShowMeetingManager(false);
                        }}
                      >
                        <strong>{meeting.title}</strong>
                        <span className="d-block small text-muted">
                          {formatDate(meeting.meeting_date)} · {meeting.session?.name || "Session"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        disabled={saving}
                        onClick={() => deleteMeeting(meeting.id)}
                        title="Delete this PTM"
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="p-4 text-center text-muted">No PTM meetings available.</div>
              )}
            </div>
            <div className="card-footer bg-white d-flex justify-content-between gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={saving}
                onClick={() => setShowMeetingManager(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving || selectedMeetingIds.length === 0}
                onClick={deleteSelectedMeetings}
              >
                <i className="bi bi-trash3 me-1" />
                {saving ? "Deleting..." : `Delete Selected (${selectedMeetingIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {targetData && (
        <div
          className="ptm-modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!saving) {
              setTargetData(null);
              setEditingFormId(null);
            }
          }}
        >
          <div
            className="card shadow-lg ptm-student-modal"
            role="dialog"
            aria-modal="true"
            aria-label="PTM student forms"
            onMouseDown={(event) => event.stopPropagation()}
          >
          <div className="card-header bg-white d-flex justify-content-between align-items-center">
            <strong>{targetData.meetingClass?.class?.class_name}-{targetData.meetingClass?.section?.section_name} Student Forms</strong>
            <div className="d-flex align-items-center gap-2">
              <span className="badge text-bg-secondary">{targetData.forms?.length || 0} students</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={saving}
                onClick={() => downloadForms(selectedTargetId)}
              >
                <i className="bi bi-file-pdf me-1" />
                {saving ? "Preparing..." : "Download All Forms"}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={saving}
                onClick={() => {
                  setTargetData(null);
                  setEditingFormId(null);
                }}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead><tr><th>Roll</th><th>Student</th><th>Form</th><th>AI / Signature</th><th>Attendance</th><th>Scan</th><th /></tr></thead>
                <tbody>
                  {(targetData.forms || []).map((form) => {
                    const draft = drafts[form.id] || {};
                    const latestScan = form.scans?.[0];
                    return (
                      <React.Fragment key={form.id}>
                        <tr>
                          <td>{form.student?.roll_number ?? "—"}</td>
                          <td><strong>{form.student?.name}</strong><div className="small text-muted">{form.student?.admission_number}</div></td>
                          <td><code>{form.form_code}</code><div className="small text-muted">{form.status}</div></td>
                          <td>{form.feedback?.signature_detected ? <span className="text-success">Signature detected</span> : <span className="text-muted">Not confirmed</span>}<div className="small">AI: {form.feedback?.ai_confidence ? `${Math.round(Number(form.feedback.ai_confidence) * 100)}%` : "—"}</div></td>
                          <td>{statusBadge(form.attendance?.status)}</td>
                          <td className="text-nowrap">
                            <label className="btn btn-sm btn-outline-primary mb-0"><i className="bi bi-camera" /> Scan<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden disabled={saving} onChange={(e) => { uploadScan(form.id, e.target.files?.[0]); e.target.value = ""; }} /></label>
                            {latestScan && <button className="btn btn-sm btn-outline-secondary ms-1" onClick={() => viewScan(latestScan.id, latestScan.mime_type)}>View</button>}
                          </td>
                          <td><button className="btn btn-sm btn-dark" onClick={() => setEditingFormId(editingFormId === form.id ? null : form.id)}>{editingFormId === form.id ? "Close" : "Verify"}</button></td>
                        </tr>
                        {editingFormId === form.id && (
                          <tr><td colSpan="7" className="bg-light">
                            <div className="row g-3 p-2">
                              <div className="col-md-3"><label className="form-label">Parent Name</label><input className="form-control" value={draft.parent_name || ""} onChange={(e) => setDraft(form.id, "parent_name", e.target.value)} /></div>
                              <div className="col-md-2"><label className="form-label">Relation</label><input className="form-control" value={draft.relation || ""} onChange={(e) => setDraft(form.id, "relation", e.target.value)} /></div>
                              {["academic_rating", "behaviour_rating", "communication_rating"].map((key) => <div className="col-md" key={key}><label className="form-label">{key.replace("_rating", "").replace("communication", "Communication")}</label><select className="form-select" value={draft[key] || ""} onChange={(e) => setDraft(form.id, key, e.target.value)}><option value="">—</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>)}
                              <div className="col-md-3"><label className="form-label">Attendance</label><select className="form-select" value={draft.attendance_status || "PENDING"} onChange={(e) => setDraft(form.id, "attendance_status", e.target.value)}><option value="PENDING">Pending</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option><option value="EXCUSED">Excused</option></select></div>
                              <div className="col-12 col-md-4"><label className="form-label">Parent Remarks</label><textarea className="form-control" rows="3" value={draft.parent_remarks || ""} onChange={(e) => setDraft(form.id, "parent_remarks", e.target.value)} /></div>
                              <div className="col-12 col-md-4"><label className="form-label">Teacher Remarks</label><textarea className="form-control" rows="3" value={draft.teacher_remarks || ""} onChange={(e) => setDraft(form.id, "teacher_remarks", e.target.value)} /></div>
                              <div className="col-12 col-md-4"><label className="form-label">Action Points</label><textarea className="form-control" rows="3" value={draft.action_points || ""} onChange={(e) => setDraft(form.id, "action_points", e.target.value)} /></div>
                              <div className="col-md-4"><label className="form-check"><input className="form-check-input" type="checkbox" checked={Boolean(draft.signature_detected)} onChange={(e) => setDraft(form.id, "signature_detected", e.target.checked)} /><span className="form-check-label">Signature visible</span></label></div>
                              <div className="col-md-8"><input className="form-control" placeholder="Attendance note / reason" value={draft.attendance_reason || ""} onChange={(e) => setDraft(form.id, "attendance_reason", e.target.value)} /></div>
                              <div className="col-12 text-end"><button className="btn btn-success" disabled={saving} onClick={() => saveForm(form.id)}>Save & Verify</button></div>
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
