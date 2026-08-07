import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import "./MarksAccessManagement.css";

const rows = (value) => (Array.isArray(value) ? value : []);

export default function MarksAccessManagement() {
  const [teachers, setTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [access, setAccess] = useState([]);
  const [audits, setAudits] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessSearch, setAccessSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const assignmentCardRef = useRef(null);

  const selected = useMemo(
    () => schedules.find((item) => Number(item.exam_schedule_id) === Number(scheduleId)),
    [schedules, scheduleId]
  );

  const filteredAccess = useMemo(() => {
    const query = accessSearch.trim().toLowerCase();
    if (!query) return access;
    return access.filter((item) =>
      [
        item.teacher?.name,
        item.teacher?.email,
        item.source,
        item.session?.name || "All",
        item.class?.class_name,
        item.section?.section_name,
        item.subject?.name,
        item.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [access, accessSearch]);

  const filteredAudits = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return audits;
    return audits.filter((item) =>
      [
        item.user?.name,
        item.user?.email,
        item.schedule?.class?.class_name,
        item.schedule?.section?.section_name,
        item.schedule?.subject?.name,
        item.schedule?.exam?.name,
        item.source,
        item.action,
        item.entries_count,
        item.createdAt ? new Date(item.createdAt).toLocaleString() : "",
      ]
        .filter((value) => value !== null && value !== undefined)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [audits, auditSearch]);

  const load = async () => {
    const [teacherRes, scopeRes, accessRes, auditRes] = await Promise.all([
      api.get("/teachers", { params: { minimal: 1 } }),
      api.get("/marks-access/my-scope"),
      api.get("/marks-access"),
      api.get("/marks-access/audit/history"),
    ]);
    setTeachers(rows(teacherRes.data?.teachers || teacherRes.data));
    setSchedules(rows(scopeRes.data?.schedules));
    setAccess([
      ...rows(accessRes.data?.access).map((item) => ({ ...item, source: "MANUAL" })),
      ...rows(accessRes.data?.subject_teacher_access),
    ]);
    setAudits(rows(auditRes.data?.audits));
  };

  useEffect(() => {
    load().catch((error) => window.alert(error.response?.data?.message || error.message));
  }, []);

  const assign = async () => {
    if (!teacherId || !selected) return window.alert("Select teacher and marks scope.");
    setBusy(true);
    try {
      await api.post("/marks-access", {
        teacher_id: teacherId,
        session_id: selected.session_id,
        class_id: selected.class_id,
        section_id: selected.section_id,
        subject_id: selected.subject_id,
      });
      await load();
    } catch (error) {
      window.alert(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this teacher's marks access?")) return;
    await api.delete(`/marks-access/${id}`);
    await load();
  };

  const changeAccess = (item) => {
    const matchingSchedule = schedules.find(
      (schedule) =>
        Number(schedule.class_id) === Number(item.class?.id) &&
        Number(schedule.section_id) === Number(item.section?.id) &&
        Number(schedule.subject_id) === Number(item.subject?.id) &&
        (!item.session?.id || Number(schedule.session_id) === Number(item.session.id))
    );
    setTeacherId(String(item.teacher?.id || ""));
    setScheduleId(matchingSchedule ? String(matchingSchedule.exam_schedule_id) : "");
    assignmentCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleAccess = async (item) => {
    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const verb = nextStatus === "ACTIVE" ? "activate" : "deactivate";
    if (!window.confirm(`Do you want to ${verb} this marks access?`)) return;
    setBusy(true);
    try {
      if (item.source === "MANUAL") {
        await api.put(`/marks-access/${item.id}`, { status: nextStatus });
      } else {
        await api.post("/marks-access/assignment-status", {
          teacher_id: item.teacher?.id,
          class_id: item.class?.id,
          section_id: item.section?.id,
          subject_id: item.subject?.id,
          status: nextStatus,
        });
      }
      await load();
    } catch (error) {
      window.alert(error.response?.data?.message || error.message);
    } finally {
      setBusy(false);
    }
  };

  const scopeLabel = (item) =>
    `${item.class_name || "Class"} - ${item.section_name || "Section"} | ${item.subject_name || "Subject"} | ${item.exam_name || "Exam"}`;

  return (
    <div className="container-fluid py-3 marks-access-page">
      <h3 className="mb-3">Marks Access & Upload Tracking</h3>

      <div ref={assignmentCardRef} className="card shadow-sm marks-access-card">
        <div className="card-header fw-semibold">Assign subject marks access</div>
        <div className="card-body row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Teacher</label>
            <select className="form-select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher.user_id || teacher.id} value={teacher.user_id || teacher.id}>
                  {teacher.name || teacher.employee_name || teacher.email}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label">Class, section, subject and exam</label>
            <select className="form-select" value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
              <option value="">Select scope</option>
              {schedules.map((item) => (
                <option key={item.exam_schedule_id} value={item.exam_schedule_id}>{scopeLabel(item)}</option>
              ))}
            </select>
            <div className="form-text">Access applies to this session/class/section/subject across its exams.</div>
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary w-100" disabled={busy} onClick={assign}>Add / Enable</button>
          </div>
        </div>
      </div>

      <div className="card shadow-sm marks-access-card">
        <div className="card-header fw-semibold">Teacher access list</div>
        <div className="marks-table-toolbar">
          <div>
            <label className="form-label mb-1" htmlFor="marks-access-search">Search teacher access</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                id="marks-access-search"
                className="form-control"
                value={accessSearch}
                onChange={(event) => setAccessSearch(event.target.value)}
                placeholder="Teacher, class, section, subject, source or status"
              />
              {accessSearch && <button className="btn btn-outline-secondary" onClick={() => setAccessSearch("")}>Clear</button>}
            </div>
          </div>
          <span className="badge text-bg-light marks-record-count">{filteredAccess.length} of {access.length} records</span>
        </div>
        <div className="marks-table-vertical marks-access-list-wrap">
          <div className="marks-table-horizontal">
          <table className="table table-striped mb-0 marks-access-table">
            <thead><tr><th>Teacher</th><th>Source</th><th>Session</th><th>Class</th><th>Section</th><th>Subject</th><th>Status</th><th /></tr></thead>
            <tbody>
              {filteredAccess.map((item) => (
                <tr key={item.id}>
                  <td>{item.teacher?.name || item.teacher?.email}</td><td>{item.source}</td><td>{item.session?.name || "All"}</td>
                  <td>{item.class?.class_name}</td><td>{item.section?.section_name}</td>
                  <td>{item.subject?.name}</td><td>{item.status}</td>
                  <td className="marks-access-actions">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => changeAccess(item)}>Change</button>
                    <button
                      className={`btn btn-sm ${item.status === "ACTIVE" ? "btn-outline-warning" : "btn-outline-success"}`}
                      disabled={busy}
                      onClick={() => toggleAccess(item)}
                    >
                      {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                    {item.source === "MANUAL" && (
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(item.id)}>Remove</button>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredAccess.length && <tr><td colSpan="8" className="text-center text-muted py-3">{access.length ? "No matching access records." : "No marks access assigned."}</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <div className="card shadow-sm marks-access-card">
        <div className="card-header fw-semibold">Marks upload history</div>
        <div className="marks-table-toolbar">
          <div>
            <label className="form-label mb-1" htmlFor="marks-audit-search">Search upload history</label>
            <div className="input-group">
              <span className="input-group-text"><i className="bi bi-search" /></span>
              <input
                id="marks-audit-search"
                className="form-control"
                value={auditSearch}
                onChange={(event) => setAuditSearch(event.target.value)}
                placeholder="Uploader, class, section, subject, exam or method"
              />
              {auditSearch && <button className="btn btn-outline-secondary" onClick={() => setAuditSearch("")}>Clear</button>}
            </div>
          </div>
          <span className="badge text-bg-light marks-record-count">{filteredAudits.length} of {audits.length} records</span>
        </div>
        <div className="marks-table-vertical marks-audit-list-wrap">
          <div className="marks-table-horizontal">
          <table className="table table-hover mb-0 marks-audit-table">
            <thead><tr><th>Date & time</th><th>Uploaded by</th><th>Class / Section</th><th>Subject</th><th>Exam</th><th>Method</th><th>Entries</th></tr></thead>
            <tbody>
              {filteredAudits.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.user?.name || item.user?.email || "Unknown"}</td>
                  <td>{item.schedule?.class?.class_name} / {item.schedule?.section?.section_name}</td>
                  <td>{item.schedule?.subject?.name}</td><td>{item.schedule?.exam?.name}</td>
                  <td>{item.source}</td><td>{item.entries_count}</td>
                </tr>
              ))}
              {!filteredAudits.length && <tr><td colSpan="7" className="text-center text-muted py-3">{audits.length ? "No matching upload records." : "No uploads recorded yet."}</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
