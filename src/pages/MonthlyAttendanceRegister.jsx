import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import "./MonthlyAttendanceRegister.css";
import "./MonthlyAttendanceColors.css";

const list = (value) => (Array.isArray(value) ? value : value?.data || value?.classes || value?.sections || value?.sessions || []);
const current = new Date();
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const codeClass = (code) => ({ P: "is-present", A: "is-absent", L: "is-leave", LT: "is-late", HD: "is-halfday", H: "is-holiday", WO: "is-off", "—": "is-unmarked" }[code] || "");
const sectionClassId = (section) => section?.class_id ?? section?.classId ?? section?.ClassId ?? section?.class?.id ?? section?.Class?.id;
const rowId = (item, alternate) => item?.id ?? item?.[alternate];
const hasSelection = (value) => value !== "" && value !== null && value !== undefined;

export default function MonthlyAttendanceRegister() {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [filters, setFilters] = useState({ session_id: "", class_id: "", section_id: "", month: String(current.getMonth() + 1), year: String(current.getFullYear()) });
  const [report, setReport] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/sessions"),
      api.get("/classes"),
      api.get("/sections").catch(() => ({ data: [] })),
    ])
      .then(([sessionRes, classRes, sectionRes]) => {
        const sessionRows = list(sessionRes.data);
        setSessions(sessionRows);
        setClasses(list(classRes.data));
        setSections(list(sectionRes.data));
        const active = sessionRows.find((item) => item.is_active || item.is_current || item.status === "active") || sessionRows[0];
        if (active) setFilters((previous) => ({ ...previous, session_id: String(active.id || active.session_id) }));
      })
      .catch((err) => setError(err.response?.data?.message || "Unable to load filters."));
  }, []);

  const availableSections = useMemo(
    () => sections.filter((section) => {
      if (!hasSelection(filters.class_id)) return true;
      const linkedClassId = sectionClassId(section);
      // This installation uses shared sections (A/B/C) without a class link.
      return linkedClassId === null || linkedClassId === undefined || linkedClassId === "" || Number(linkedClassId) === Number(filters.class_id);
    }),
    [sections, filters.class_id]
  );

  const handleClassChange = async (classId) => {
    setFilters((previous) => ({ ...previous, class_id: classId, section_id: "" }));
    if (!hasSelection(classId)) return;
    try {
      const response = await api.get("/sections", { params: { class_id: classId } });
      const fetched = list(response.data);
      const compatible = Array.isArray(fetched)
        ? fetched.filter((section) => {
            const linkedClassId = sectionClassId(section);
            return linkedClassId === null || linkedClassId === undefined || linkedClassId === "" || Number(linkedClassId) === Number(classId);
          })
        : [];
      if (compatible.length) {
        setSections((previous) => {
          const byId = new Map(previous.map((section) => [String(rowId(section, "section_id")), section]));
          compatible.forEach((section) => byId.set(String(rowId(section, "section_id")), section));
          return [...byId.values()];
        });
        return;
      }
    } catch (_) {
      // Hosted installations with the legacy global Sections table can return
      // an error here. The student-derived fallback below handles that schema.
    }

    try {
      const studentResponse = await api.get("/students");
      const studentRows = list(studentResponse.data);
      const derived = new Map();
      studentRows
        .filter(
          (student) =>
            Number(student.class_id ?? student.classId) === Number(classId) &&
            (!filters.session_id || Number(student.session_id ?? student.sessionId) === Number(filters.session_id))
        )
        .forEach((student) => {
          const id = student.section_id ?? student.sectionId ?? student.Section?.id;
          const name = student.section_name ?? student.Section?.section_name ?? student.section?.section_name;
          if (id !== null && id !== undefined && name) derived.set(String(id), { id, section_id: id, section_name: name, class_id: null });
        });
      if (derived.size) {
        const derivedSections = [...derived.values()];
        setSections(derivedSections);
        if (derivedSections.length === 1) {
          setFilters((previous) => ({ ...previous, section_id: String(derivedSections[0].id) }));
        }
      } else {
        setSections([]);
        setError("No sections or enabled students are configured for the selected class and session.");
      }
    } catch (studentError) {
      setSections([]);
      setError(studentError.response?.data?.message || "Unable to load sections for the selected class.");
    }
  };

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const students = report?.students || [];
    if (!query) return students;
    return students.filter((student) => [student.roll_number, student.admission_number, student.name, student.father_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }, [report, search]);

  const loadReport = async () => {
    if (!hasSelection(filters.class_id) || !hasSelection(filters.section_id) || !filters.month || !filters.year) {
      setError("Please select class, section, month and year.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/attendance/monthly-register", { params: filters });
      setReport(response.data);
    } catch (err) {
      setReport(null);
      setError(err.response?.data?.message || "Unable to load monthly attendance.");
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const headers = ["Roll Number", "Admission Number", "Student Name", "Father Name", ...report.days.map((day) => `${day.day} ${day.weekday}`), "Working Days", "Present", "Absent", "Leave", "Late", "Half Day", "Unmarked", "Attendance %"];
    const csvRows = visibleStudents.map((student) => [student.roll_number, student.admission_number, student.name, student.father_name, ...report.days.map((day) => student.attendance?.[day.date] || "—"), report.working_days, student.totals.present, student.totals.absent, student.totals.leave, student.totals.late, student.totals.halfday, student.totals.unmarked, student.attendance_percentage]);
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const blob = new Blob([[headers, ...csvRows].map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `attendance-${report.class?.class_name}-${report.section?.section_name}-${report.year}-${String(report.month).padStart(2, "0")}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="monthly-register-page container-fluid py-3">
      <section className="monthly-register-hero">
        <div><div className="hero-kicker">Academic Operations</div><h2>Monthly Attendance Register</h2><p>Complete student attendance, daily status and monthly totals in one register.</p></div>
        <div className="hero-icon"><i className="bi bi-calendar2-check" /></div>
      </section>

      <section className="card border-0 shadow-sm filter-card">
        <div className="card-body"><div className="row g-3 align-items-end">
          <div className="col-sm-6 col-xl-2"><label className="form-label">Session</label><select className="form-select" value={filters.session_id} onChange={(event) => setFilters({ ...filters, session_id: event.target.value })}><option value="">All sessions</option>{sessions.map((item) => <option key={rowId(item, "session_id")} value={rowId(item, "session_id")}>{item.name || item.session_name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Class</label><select className="form-select" value={filters.class_id} onChange={(event) => handleClassChange(event.target.value)}><option value="">Select class</option>{classes.map((item) => <option key={rowId(item, "class_id")} value={rowId(item, "class_id")}>{item.class_name || item.name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Section</label><select className="form-select" value={filters.section_id} onChange={(event) => setFilters({ ...filters, section_id: event.target.value })}><option value="">Select section</option>{availableSections.map((item) => <option key={rowId(item, "section_id")} value={rowId(item, "section_id")}>{item.section_name || item.name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Month</label><select className="form-select" value={filters.month} onChange={(event) => setFilters({ ...filters, month: event.target.value })}>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></div>
          <div className="col-sm-6 col-xl-2"><label className="form-label">Year</label><input className="form-control" type="number" min="2000" max="2200" value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })} /></div>
          <div className="col-sm-6 col-xl-2"><button className="btn btn-primary w-100" onClick={loadReport} disabled={loading}>{loading ? <><span className="spinner-border spinner-border-sm me-2" />Loading</> : <><i className="bi bi-search me-2" />View Register</>}</button></div>
        </div></div>
      </section>

      {error && <div className="alert alert-danger mt-3 mb-0"><i className="bi bi-exclamation-circle me-2" />{error}</div>}

      {report && <>
        <section className="register-summary-grid">
          <Summary icon="bi-people" label="Students" value={report.total_students} tone="blue" />
          <Summary icon="bi-calendar-check" label="Working Days" value={report.working_days} tone="green" />
          <Summary icon="bi-building" label="Class & Section" value={`${report.class?.class_name || "—"} - ${report.section?.section_name || "—"}`} tone="purple" />
          <Summary icon="bi-calendar3" label="Register Month" value={`${monthNames[report.month - 1]} ${report.year}`} tone="orange" />
        </section>

        <section className="card border-0 shadow-sm register-card">
          <div className="register-toolbar"><div><h5>Student Attendance Register</h5><small>{visibleStudents.length} of {report.total_students} students</small></div><div className="register-actions"><div className="input-group"><span className="input-group-text"><i className="bi bi-search" /></span><input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, roll or admission no." /></div><button className="btn btn-outline-success" onClick={exportCsv}><i className="bi bi-file-earmark-spreadsheet me-2" />Export Excel</button></div></div>
          <div className="attendance-legend">{Object.entries(report.legend || {}).map(([code, label]) => <span key={code}><b className={codeClass(code)}>{code}</b>{label}</span>)}</div>
          <div className="monthly-register-scroll"><table className="table monthly-register-table"><thead><tr><th className="sticky-col col-roll">Roll No.</th><th className="sticky-col col-admission">Admission No.</th><th className="sticky-col col-student">Student Name</th><th className="sticky-col col-father">Father Name</th>{report.days.map((day) => <th key={day.date} className={`day-column ${!day.is_working_day ? "non-working" : ""}`} title={day.description || day.weekday}><span>{day.day}</span><small>{day.weekday}</small></th>)}<th>WD</th><th>P</th><th>A</th><th>L</th><th>LT</th><th>HD</th><th>UM</th><th>%</th></tr></thead><tbody>{visibleStudents.map((student) => <tr key={student.id}><td className="sticky-col col-roll">{student.roll_number || "—"}</td><td className="sticky-col col-admission">{student.admission_number || "—"}</td><td className="sticky-col col-student student-name">{student.name || "—"}</td><td className="sticky-col col-father">{student.father_name || "—"}</td>{report.days.map((day) => { const code = student.attendance?.[day.date] || "—"; return <td key={day.date} className={`attendance-code ${codeClass(code)}`}>{code}</td>; })}<td className="total-cell">{report.working_days}</td><td className="total-cell text-success">{student.totals.present}</td><td className="total-cell text-danger">{student.totals.absent}</td><td className="total-cell text-warning">{student.totals.leave}</td><td>{student.totals.late}</td><td>{student.totals.halfday}</td><td>{student.totals.unmarked}</td><td><span className={`percentage-pill ${student.attendance_percentage >= 75 ? "good" : "low"}`}>{student.attendance_percentage}%</span></td></tr>)}{!visibleStudents.length && <tr><td colSpan={(report.days?.length || 0) + 12} className="text-center py-5 text-muted">No matching students found.</td></tr>}</tbody></table></div>
        </section>
      </>}
    </div>
  );
}

function Summary({ icon, label, value, tone }) { return <div className={`summary-card tone-${tone}`}><div className="summary-icon"><i className={`bi ${icon}`} /></div><div><small>{label}</small><strong>{value}</strong></div></div>; }
