import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import { useBranch } from "../branch/BranchContext";
import "./LectureAttendance.css";

const today = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const STATUSES = [
  ["present", "Present"],
  ["absent", "Absent"],
  ["late", "Late"],
  ["leave", "Leave / Excused"],
  ["on_duty", "On Duty"],
];

export default function LectureAttendance() {
  const { isCollege, terms } = useInstitution();
  const { allBranches, activeBranch } = useBranch();
  const [date, setDate] = useState(today());
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [topic, setTopic] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!isCollege || allBranches) {
      setSlots([]);
      setSelected(null);
      setStudents([]);
      return;
    }
    setLoadingSlots(true);
    try {
      const { data } = await api.get("/lecture-attendance/teacher/slots", { params: { date } });
      setSlots(Array.isArray(data?.slots) ? data.slots : []);
      setSelected(null);
      setStudents([]);
      setTopic("");
    } catch (error) {
      Swal.fire("Unable to load lectures", error?.response?.data?.message || error.message, "error");
    } finally {
      setLoadingSlots(false);
    }
  }, [date, isCollege, allBranches]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const loadRoster = async (slot) => {
    setSelected(slot);
    setLoadingRoster(true);
    try {
      const { data } = await api.get("/lecture-attendance/teacher/roster", {
        params: {
          date,
          timetable_slot_id: slot.timetable_slot_id,
          subject_id: slot.subject_id,
          faculty_user_id: slot.faculty_user_id,
        },
      });
      setStudents(Array.isArray(data?.students) ? data.students : []);
      setTopic(data?.session?.topic || slot.topic || "");
    } catch (error) {
      setStudents([]);
      Swal.fire("Unable to load students", error?.response?.data?.message || error.message, "error");
    } finally {
      setLoadingRoster(false);
    }
  };

  // COLLEGE_STUDENT_LEAVE_OD_UI_V1
  const safeStatusForOverride = (row, status) => {
    const override = row?.attendance_override?.status;
    if (!override) return status;
    if (status === "absent") return override;
    if (override === "on_duty" && status === "leave") return "on_duty";
    return status;
  };

  const updateStudent = (id, patch) => {
    setStudents((rows) => rows.map((row) => {
      if (Number(row.id) !== Number(id)) return row;
      const next = { ...patch };
      if (next.status) next.status = safeStatusForOverride(row, next.status);
      return { ...row, ...next };
    }));
  };

  const markAll = (status) => setStudents((rows) => rows.map((row) => ({ ...row, status: safeStatusForOverride(row, status) })));

  const counts = useMemo(() => students.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {}), [students]);

  const save = async () => {
    if (!selected || !students.length) return;
    setSaving(true);
    try {
      await api.post("/lecture-attendance/mark", {
        date,
        timetable_slot_id: selected.timetable_slot_id,
        subject_id: selected.subject_id,
        faculty_user_id: selected.faculty_user_id,
        topic,
        entries: students.map((row) => ({
          student_id: row.id,
          status: row.status || "present",
          remarks: row.remarks || "",
        })),
      });
      await Swal.fire("Saved", "Lecture attendance saved successfully.", "success");
      await fetchSlots();
    } catch (error) {
      Swal.fire("Unable to save", error?.response?.data?.message || error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isCollege) {
    return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">Lecture-level attendance is available when the institution is set to <strong>College</strong>.</div></div>;
  }

  return (
    <div className="container-fluid py-3 lecture-attendance-page">
      <div className="lecture-hero rounded-4 p-3 p-lg-4 mb-3">
        <div className="d-flex flex-wrap align-items-center gap-3">
          <div>
            <div className="text-primary fw-semibold small text-uppercase">College Attendance</div>
            <h2 className="h4 mb-1">Lecture Attendance</h2>
            <div className="text-muted small">Timetable-linked attendance by {terms.subjectLower}, period and faculty.</div>
          </div>
          <div className="ms-lg-auto d-flex align-items-center gap-2">
            <label className="small text-muted mb-0">Lecture Date</label>
            <input className="form-control" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 165 }} />
          </div>
        </div>
      </div>

      {allBranches ? (
        <div className="alert alert-warning rounded-4 shadow-sm">
          <i className="bi bi-diagram-3 me-2" />Select a specific <strong>Branch / Campus</strong> from the top selector before marking attendance.
        </div>
      ) : (
        <div className="alert alert-light border rounded-4 py-2 mb-3">
          <i className="bi bi-geo-alt me-2 text-primary" />Active Campus: <strong>{activeBranch?.name || "Selected Branch"}</strong>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-header bg-white border-0 pt-3 px-3 d-flex justify-content-between align-items-center">
              <div><div className="fw-bold">Today's Timetable Slots</div><div className="small text-muted">Choose the lecture you conducted.</div></div>
              <span className="badge text-bg-primary rounded-pill">{slots.length}</span>
            </div>
            <div className="card-body pt-2">
              {loadingSlots ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div> : slots.length === 0 ? (
                <div className="text-center text-muted py-4"><i className="bi bi-calendar-x fs-2 d-block mb-2" />No lecture slots found for this date.</div>
              ) : (
                <div className="d-grid gap-2">
                  {slots.map((slot) => {
                    const active = selected && Number(selected.timetable_slot_id) === Number(slot.timetable_slot_id) && Number(selected.subject_id) === Number(slot.subject_id) && Number(selected.faculty_user_id) === Number(slot.faculty_user_id);
                    return (
                      <button key={`${slot.timetable_slot_id}-${slot.subject_id}-${slot.faculty_user_id}`} type="button" onClick={() => loadRoster(slot)} className={`slot-card card border text-start p-3 bg-white ${active ? "active" : ""}`}>
                        <div className="d-flex justify-content-between gap-2">
                          <div className="fw-semibold">{slot.subject_name || `${terms.subject} ${slot.subject_id}`}</div>
                          {slot.marked ? <span className="badge text-bg-success">Marked</span> : <span className="badge bg-light text-dark border">Pending</span>}
                        </div>
                        <div className="small text-muted mt-1">{slot.class_name} · {slot.section_name}</div>
                        <div className="small mt-2"><i className="bi bi-clock me-1" />{slot.period?.period_name || "Period"}{slot.period?.start_time ? ` · ${slot.period.start_time}–${slot.period.end_time}` : ""}</div>
                        <div className="small text-muted"><i className="bi bi-person me-1" />{slot.faculty_name || "Faculty"}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-3 p-lg-4">
              {!selected ? (
                <div className="text-center text-muted py-5"><i className="bi bi-check2-square fs-1 d-block mb-2 opacity-50" />Select a lecture slot to mark attendance.</div>
              ) : loadingRoster ? (
                <div className="text-center py-5"><div className="spinner-border" /><div className="mt-2 text-muted">Loading students…</div></div>
              ) : (
                <>
                  <div className="d-flex flex-wrap justify-content-between gap-2 align-items-start mb-3">
                    <div><h5 className="mb-1">{selected.subject_name}</h5><div className="small text-muted">{selected.class_name} · {selected.section_name} · {selected.period?.period_name}</div></div>
                    <div className="d-flex flex-wrap gap-1">
                      <span className="badge text-bg-success">P {counts.present || 0}</span>
                      <span className="badge text-bg-danger">A {counts.absent || 0}</span>
                      <span className="badge text-bg-warning">Late {counts.late || 0}</span>
                      <span className="badge text-bg-info">Leave {counts.leave || 0}</span>
                      <span className="badge text-bg-primary">OD {counts.on_duty || 0}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Lecture Topic <span className="text-muted fw-normal">(optional)</span></label>
                    <input className="form-control" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Normalization – 2NF and 3NF" />
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <button className="btn btn-sm btn-success" onClick={() => markAll("present")}><i className="bi bi-check-all me-1" />Mark All Present</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => markAll("absent")}>Mark All Absent</button>
                  </div>

                  <div className="table-responsive">
                    <table className="table align-middle mb-0">
                      <thead><tr><th style={{ minWidth: 220 }}>Student</th><th>Admission No.</th><th style={{ minWidth: 165 }}>Status</th><th style={{ minWidth: 210 }}>Remarks</th></tr></thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id} className="student-row">
                            <td className="fw-semibold">{student.name}{student.attendance_override && <div className="mt-1"><span className={`badge ${student.attendance_override.status === "on_duty" ? "text-bg-primary" : "text-bg-info"}`}>{student.attendance_override.status === "on_duty" ? "Approved OD" : "Approved Leave"} · {student.attendance_override.request_number}</span></div>}</td>
                            <td className="text-muted">{student.admission_number || "—"}</td>
                            <td><select className="form-select form-select-sm status-select" value={student.status || "present"} onChange={(e) => updateStudent(student.id, { status: e.target.value })}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
                            <td><input className="form-control form-control-sm" value={student.remarks || ""} onChange={(e) => updateStudent(student.id, { remarks: e.target.value })} placeholder="Optional remark" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-end mt-4">
                    <button className="btn btn-primary px-4" disabled={saving || !students.length || allBranches} onClick={save}>{saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : <><i className="bi bi-cloud-check me-2" />Save Lecture Attendance</>}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
