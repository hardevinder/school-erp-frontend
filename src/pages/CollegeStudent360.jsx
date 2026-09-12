import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./CollegeStudent360.css";

const STAFF = new Set([
  "department_hod", "principal", "academic_coordinator", "coordinator", "examination",
  "placement_officer", "admission", "admissions", "frontoffice", "front_office",
  "admin", "superadmin", "super_admin",
]);

function roles() {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const single = localStorage.getItem("userRole");
    return (Array.isArray(many) && many.length ? many : [single])
      .filter(Boolean)
      .map((r) => String(r).toLowerCase());
  } catch (_) {
    return [String(localStorage.getItem("userRole") || "").toLowerCase()].filter(Boolean);
  }
}

const fmt = (v, digits = 2) => Number(v || 0).toFixed(digits);
const human = (v) => String(v || "—").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
const dateOnly = (v) => v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString() : "—";
const statusTone = (value) => {
  const v = String(value || "").toLowerCase();
  if (["pass", "passed", "cleared", "verified", "approved", "joined", "selected", "offered", "eligible", "present"].includes(v)) return "success";
  if (["failed", "reappear", "pending", "needs_review", "shortlisted", "in_process", "late"].includes(v)) return "warning";
  if (["absent", "rejected", "not_eligible", "still_backlog"].includes(v)) return "danger";
  return "secondary";
};

function Status({ value, children }) {
  return <span className={`badge rounded-pill text-bg-${statusTone(value)}`}>{children || human(value)}</span>;
}

function Empty({ text = "No records available yet." }) {
  return <div className="c360-empty"><i className="bi bi-inbox" /><span>{text}</span></div>;
}

function Metric({ icon, label, value, hint, tone = "primary" }) {
  return <div className="c360-metric card border-0 shadow-sm h-100">
    <div className="card-body">
      <div className={`c360-metric-icon text-bg-${tone}`}><i className={`bi ${icon}`} /></div>
      <div className="c360-metric-label">{label}</div>
      <div className="c360-metric-value">{value}</div>
      {hint && <div className="c360-metric-hint">{hint}</div>}
    </div>
  </div>;
}

function StudentHero({ profile }) {
  const s = profile?.student || {};
  const i = profile?.university_identity || {};
  const initials = String(s.name || "S").split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
  return <div className="c360-hero card border-0 shadow-sm mb-4">
    <div className="card-body p-4 p-lg-5">
      <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-4">
        <div className="c360-avatar">{initials}</div>
        <div className="flex-grow-1">
          <div className="d-flex flex-wrap gap-2 mb-2">
            <span className="badge rounded-pill text-bg-primary">360° Academic Profile</span>
            {i.verification_status && <Status value={i.verification_status} />}
          </div>
          <h1 className="h3 mb-1">{s.name || "Student"}</h1>
          <div className="text-muted d-flex flex-wrap gap-x-3 gap-2">
            <span><i className="bi bi-person-badge me-1" />{s.admission_number || "No admission no."}</span>
            <span><i className="bi bi-mortarboard me-1" />{s.program_semester || "Program / Semester not assigned"}</span>
            <span><i className="bi bi-collection me-1" />{s.batch_section || "Batch not assigned"}</span>
            {s.branch?.branch_name && <span><i className="bi bi-building me-1" />{s.branch.branch_name}</span>}
          </div>
        </div>
        <div className="c360-idbox">
          <small>University Enrollment</small>
          <strong>{i.enrollment_number || i.university_registration_number || "Not added"}</strong>
          <span>{i.university_roll_number ? `Roll No. ${i.university_roll_number}` : (s.academic_year || "")}</span>
        </div>
      </div>
    </div>
  </div>;
}

function OverviewTab({ profile }) {
  const s = profile?.student || {};
  const u = profile?.university_identity || {};
  const a = profile?.academics || {};
  const att = profile?.attendance || {};
  const placement = profile?.placement || {};
  const links = profile?.links || {};
  const currentSubjects = profile?.subjects || [];
  const recentResources = profile?.learning_resources?.recent || [];

  return <div className="row g-4">
    <div className="col-12 col-xl-7">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-body p-4">
          <h2 className="h5 mb-3">Academic Snapshot</h2>
          <div className="row g-3">
            <div className="col-md-6"><Info label="Program / Semester" value={s.program_semester} /></div>
            <div className="col-md-6"><Info label="Batch / Section" value={s.batch_section} /></div>
            <div className="col-md-6"><Info label="Academic Year" value={s.academic_year} /></div>
            <div className="col-md-6"><Info label="University Roll No." value={u.university_roll_number} /></div>
            <div className="col-md-6"><Info label="Registration No." value={u.university_registration_number} /></div>
            <div className="col-md-6"><Info label="ABC / APAAR" value={u.abc_id || u.apaar_id} /></div>
          </div>
          <hr />
          <h3 className="h6 mb-3">Current Papers</h3>
          <div className="d-flex flex-wrap gap-2">
            {currentSubjects.length ? currentSubjects.map((x) => <span className="c360-subject-pill" key={x.offering_id || x.subject_id}>
              {x.subject_name}<small>{x.credits ? `${fmt(x.credits, 0)} cr` : human(x.subject_type)}</small>
            </span>) : <span className="text-muted small">No registered papers found.</span>}
          </div>
        </div>
      </div>
    </div>
    <div className="col-12 col-xl-5">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-body p-4">
          <h2 className="h5 mb-3">Quick Actions</h2>
          <div className="c360-actions">
            <Action to={links.grade_cards} icon="bi-file-earmark-bar-graph" label="Grade Card · Transcript" />
            <Action to={links.lecture_attendance} icon="bi-person-check" label="Lecture Attendance" />
            <Action to={links.subject_registration} icon="bi-ui-checks-grid" label="Subject Registration" />
            <Action to={links.backlogs} icon="bi-arrow-counterclockwise" label="Backlog / Reappear" />
            <Action to={links.placement} icon="bi-briefcase" label="Placement & Career" />
            <Action to={links.internships || "/college-internships"} icon="bi-building-check" label="Internship Management" />
            <Action to={links.student_requests || "/college-student-requests"} icon="bi-file-earmark-check" label="Certificates & Requests" />
            <Action to={links.documents} icon="bi-folder2-open" label="Document Vault" />
          </div>
          <hr />
          <div className="d-flex align-items-center justify-content-between mb-2"><h3 className="h6 mb-0">Recent Learning Resources</h3><Link to={links.resources || "/learning-resources"} className="small">View all</Link></div>
          {recentResources.length ? recentResources.map((r) => <div className="c360-resource" key={r.id}><i className="bi bi-file-earmark-text" /><div><strong>{r.title}</strong><small>{r.subject_name || r.material_type || "Study Material"}</small></div></div>) : <div className="text-muted small">No published study material for the current program yet.</div>}
        </div>
      </div>
    </div>
    <div className="col-12">
      <div className="card border-0 shadow-sm">
        <div className="card-body p-4">
          <h2 className="h5 mb-3">Current Academic Position</h2>
          <div className="row g-3 small">
            <div className="col-md-3"><Info label="Current SGPA" value={fmt(a.current_semester?.sgpa)} /></div>
            <div className="col-md-3"><Info label="Overall CGPA" value={fmt(a.cgpa)} /></div>
            <div className="col-md-3"><Info label="Lecture Attendance" value={`${fmt(att.overall?.percentage, 1)}%`} /></div>
            <div className="col-md-3"><Info label="Placement Status" value={human(placement.status)} /></div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function AcademicsTab({ profile }) {
  const rows = profile?.academics?.semesters || [];
  if (!rows.length) return <Empty text="Published semester grades will appear here." />;
  return <div className="d-grid gap-4">{rows.map((sem) => <div className="card border-0 shadow-sm" key={`${sem.session_id}-${sem.class_id}`}>
    <div className="card-body p-4">
      <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
        <div><h2 className="h5 mb-1">{sem.program_semester}</h2><div className="text-muted small">{sem.academic_year}</div></div>
        <div className="d-flex gap-2"><span className="c360-score">SGPA <b>{fmt(sem.sgpa)}</b></span><Status value={sem.result_status} /></div>
      </div>
      <div className="table-responsive"><table className="table align-middle mb-0 c360-table"><thead><tr><th>Paper / Subject</th><th>Credits</th><th>%</th><th>Grade</th><th>GP</th><th>Credit Points</th><th>Status</th></tr></thead><tbody>
        {(sem.subjects || []).map((row) => <tr key={row.id}><td><strong>{row.subject_name}</strong></td><td>{fmt(row.credits, 0)}</td><td>{row.percentage == null ? "—" : fmt(row.percentage, 1)}</td><td>{row.letter_grade || "—"}</td><td>{fmt(row.grade_point, 1)}</td><td>{fmt(row.credit_points, 1)}</td><td><Status value={row.result_status} /></td></tr>)}
      </tbody></table></div>
      <div className="c360-sem-summary"><span>Attempted <b>{fmt(sem.attempted_credits, 0)}</b></span><span>Earned <b>{fmt(sem.earned_credits, 0)}</b></span></div>
    </div>
  </div>)}</div>;
}

function AttendanceTab({ profile }) {
  const a = profile?.attendance || {};
  const subjects = a.subjects || [];
  const recent = a.recent || [];
  return <div className="row g-4">
    <div className="col-12 col-lg-5"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5 mb-3">Subject-wise Attendance</h2>{subjects.length ? subjects.map((s) => <div className="c360-att-row" key={s.subject_id}><div><strong>{s.subject_name}</strong><small>{s.attended}/{s.total} attended</small></div><div className={Number(s.percentage) < 75 ? "text-danger" : "text-success"}><b>{fmt(s.percentage, 1)}%</b></div></div>) : <Empty text="No lecture attendance recorded yet." />}</div></div></div>
    <div className="col-12 col-lg-7"><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><h2 className="h5 mb-3">Recent Lectures</h2>{recent.length ? <div className="table-responsive"><table className="table align-middle mb-0 c360-table"><thead><tr><th>Date</th><th>Paper</th><th>Topic</th><th>Status</th></tr></thead><tbody>{recent.map((r) => <tr key={r.id}><td>{dateOnly(r.date)}</td><td>{r.subject_name}</td><td>{r.topic || "—"}</td><td><Status value={r.status} /></td></tr>)}</tbody></table></div> : <Empty text="No lecture history available." />}</div></div></div>
  </div>;
}

function BacklogTab({ profile }) {
  const rows = profile?.backlogs || [];
  if (!rows.length) return <Empty text="No backlog / reappear records. Great!" />;
  return <div className="row g-3">{rows.map((row) => <div className="col-12 col-lg-6" key={row.id}><div className="card border-0 shadow-sm h-100"><div className="card-body p-4"><div className="d-flex justify-content-between gap-3"><div><h2 className="h6 mb-1">{row.subject?.name || `Subject ${row.subject_id}`}</h2><div className="text-muted small">{row.programSemester?.class_name || "Program / Semester"} · {row.session?.name || ""}</div></div><Status value={row.status} /></div><div className="row g-2 mt-3 small"><div className="col-6"><Info label="Original Result" value={human(row.original_result_status)} /></div><div className="col-6"><Info label="Attempts" value={row.attempts_count || 0} /></div></div>{(row.attempts || []).length > 0 && <div className="mt-3"><small className="text-muted">Latest attempt</small><div>{human(row.attempts[row.attempts.length - 1]?.status)}</div></div>}</div></div></div>)}</div>;
}

function EnrollmentTab({ profile }) {
  const u = profile?.university_identity;
  if (!u) return <Empty text="University registration / enrollment details are not added yet." />;
  const items = [
    ["University", u.university_name], ["Affiliated University", u.affiliated_university],
    ["Registration Number", u.university_registration_number], ["University Roll Number", u.university_roll_number],
    ["Enrollment Number", u.enrollment_number], ["Admission Year", u.admission_year],
    ["Admission Batch", u.admission_batch], ["Registration Date", dateOnly(u.registration_date)],
    ["ABC ID", u.abc_id], ["APAAR ID", u.apaar_id], ["Category / Quota", u.category_quota],
    ["Migration Certificate", u.migration_certificate_number], ["Previous Qualification", u.previous_qualification],
    ["Previous Institution", u.previous_institution],
  ];
  return <div className="card border-0 shadow-sm"><div className="card-body p-4"><div className="d-flex justify-content-between mb-3"><h2 className="h5 mb-0">University Academic Identity</h2><Status value={u.verification_status} /></div><div className="row g-3">{items.map(([label, value]) => <div className="col-md-6 col-xl-4" key={label}><Info label={label} value={value} /></div>)}</div></div></div>;
}

function PlacementTab({ profile }) {
  const p = profile?.placement || {};
  const rows = p.applications || [];
  return <div className="card border-0 shadow-sm"><div className="card-body p-4"><div className="d-flex align-items-center justify-content-between gap-3 mb-3"><h2 className="h5 mb-0">Placement Journey</h2><Status value={p.status} /></div>{rows.length ? <div className="table-responsive"><table className="table align-middle c360-table mb-0"><thead><tr><th>Company / Drive</th><th>Role</th><th>Applied</th><th>Eligibility</th><th>Status</th><th>Offer</th></tr></thead><tbody>{rows.map((a) => <tr key={a.id}><td><strong>{a.drive?.company?.name || "Company"}</strong><small className="d-block text-muted">{a.drive?.title}</small></td><td>{a.drive?.job_role || "—"}</td><td>{dateOnly(a.applied_at)}</td><td><Status value={a.eligibility_status} /></td><td><Status value={a.status} /></td><td>{a.offer ? <Status value={a.offer.status} /> : "—"}</td></tr>)}</tbody></table></div> : <Empty text="No placement applications yet." />}</div></div>;
}

// COLLEGE_INTERNSHIP_360_TAB_V1
function InternshipTab({ profile }) {
  const data = profile?.internships || {};
  const rows = data.rows || [];
  return <div className="card border-0 shadow-sm"><div className="card-body p-4"><div className="d-flex justify-content-between align-items-center gap-3 mb-3"><div><h2 className="h5 mb-1">Internship Journey</h2><div className="text-muted small">{data.completed || 0} completed · {data.active || 0} active</div></div><Status value={data.status} /></div>{rows.length ? <div className="table-responsive"><table className="table align-middle c360-table mb-0"><thead><tr><th>Company</th><th>Internship</th><th>Duration</th><th>Mentor</th><th>Progress</th><th>Status</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><strong>{x.company_name}</strong><small className="d-block text-muted">{human(x.work_mode)}</small></td><td>{x.title}</td><td>{dateOnly(x.start_date)} → {dateOnly(x.end_date)}</td><td>{x.internalMentor?.name || "—"}</td><td>{Math.round(Number(x.progress_percentage || 0))}%</td><td><Status value={x.status} /></td></tr>)}</tbody></table></div> : <Empty text="No internship records yet." />}<div className="mt-3"><Link to="/college-internships" className="btn btn-outline-primary btn-sm">Open Internship Management</Link></div></div></div>;
}

// COLLEGE_STUDENT_REQUESTS_360_TAB_V1
function RequestsTab({ profile }) {
  const data = profile?.student_requests || {};
  const rows = data.rows || [];
  return <div className="card border-0 shadow-sm"><div className="card-body p-4"><div className="d-flex justify-content-between align-items-center mb-3"><div><h2 className="h5 mb-1">Certificates & Student Requests</h2><div className="text-muted small">{data.pending || 0} pending · {data.issued || 0} issued</div></div><Link to="/college-student-requests" className="btn btn-outline-primary btn-sm">Open Requests</Link></div>{rows.length ? <div className="table-responsive"><table className="table align-middle c360-table mb-0"><thead><tr><th>Request</th><th>Request No.</th><th>Submitted</th><th>Status</th><th>Certificate</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><strong>{human(r.request_type)}</strong></td><td>{r.request_number || "—"}</td><td>{dateOnly(r.createdAt)}</td><td><Status value={r.status} /></td><td>{r.certificate_number || "—"}</td></tr>)}</tbody></table></div> : <Empty text="No certificate / student requests yet." />}</div></div>;
}

function DocumentsTab({ profile }) {
  const docs = profile?.documents?.rows || [];
  return <div className="card border-0 shadow-sm"><div className="card-body p-4"><div className="d-flex justify-content-between align-items-center mb-3"><div><h2 className="h5 mb-1">Student Documents</h2><div className="text-muted small">{profile?.documents?.verified || 0} verified of {profile?.documents?.count || 0}</div></div><Link to="/document-vault" className="btn btn-outline-primary btn-sm">Open Document Vault</Link></div>{docs.length ? <div className="table-responsive"><table className="table align-middle c360-table mb-0"><thead><tr><th>Document</th><th>Number</th><th>Issued</th><th>Status</th><th>Version</th></tr></thead><tbody>{docs.map((d) => <tr key={d.id}><td><strong>{d.documentType?.name || d.title || "Document"}</strong></td><td>{d.document_number || "—"}</td><td>{dateOnly(d.issued_on)}</td><td><Status value={d.status} /></td><td>v{d.version_no || 1}</td></tr>)}</tbody></table></div> : <Empty text="No student documents uploaded yet." />}</div></div>;
}

function Info({ label, value }) {
  return <div className="c360-info"><small>{label}</small><strong>{value === null || value === undefined || value === "" ? "—" : value}</strong></div>;
}
function Action({ to, icon, label }) {
  return <Link className="c360-action" to={to || "#"}><i className={`bi ${icon}`} /><span>{label}</span><i className="bi bi-chevron-right ms-auto" /></Link>;
}

const TABS = [
  ["overview", "Overview", "bi-grid"], ["academics", "Academics", "bi-award"], ["attendance", "Attendance", "bi-person-check"],
  ["backlogs", "Backlogs", "bi-arrow-counterclockwise"], ["enrollment", "Enrollment", "bi-person-vcard"],
  ["placement", "Placement", "bi-briefcase"], ["internships", "Internship", "bi-building-check"], ["requests", "Requests", "bi-file-earmark-check"], ["documents", "Documents", "bi-folder2-open"],
];

function ProfileBody({ profile }) {
  const [tab, setTab] = useState("overview");
  const s = profile?.summary || {};
  return <>
    <StudentHero profile={profile} />
    <div className="row g-3 mb-4">
      <div className="col-6 col-lg-3 col-xxl-2"><Metric icon="bi-graph-up-arrow" label="CGPA" value={fmt(s.cgpa)} hint={`Current SGPA ${fmt(s.current_sgpa)}`} tone="primary" /></div>
      <div className="col-6 col-lg-3 col-xxl-2"><Metric icon="bi-person-check" label="Attendance" value={`${fmt(s.attendance_percentage, 1)}%`} hint={`${s.attendance_total_lectures || 0} lectures`} tone={Number(s.attendance_percentage) < 75 ? "danger" : "success"} /></div>
      <div className="col-6 col-lg-3 col-xxl-2"><Metric icon="bi-award" label="Credits" value={`${fmt(s.earned_credits, 0)}/${fmt(s.attempted_credits, 0)}`} hint="Earned / attempted" tone="info" /></div>
      <div className="col-6 col-lg-3 col-xxl-2"><Metric icon="bi-arrow-counterclockwise" label="Backlogs" value={s.pending_backlogs || 0} hint="Pending" tone={s.pending_backlogs ? "warning" : "success"} /></div>
      <div className="col-6 col-lg-3 col-xxl-2"><Metric icon="bi-ui-checks-grid" label="Papers" value={s.subject_count || 0} hint="Registered" tone="secondary" /></div>
      <div className="col-6 col-lg-3 col-xxl-2"><Metric icon="bi-briefcase" label="Placement" value={human(s.placement_status)} hint="Career status" tone="dark" /></div>
    </div>
    <div className="c360-tabs mb-4">{TABS.map(([key, label, icon]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><i className={`bi ${icon}`} />{label}</button>)}</div>
    {tab === "overview" && <OverviewTab profile={profile} />}
    {tab === "academics" && <AcademicsTab profile={profile} />}
    {tab === "attendance" && <AttendanceTab profile={profile} />}
    {tab === "backlogs" && <BacklogTab profile={profile} />}
    {tab === "enrollment" && <EnrollmentTab profile={profile} />}
    {tab === "placement" && <PlacementTab profile={profile} />}
    {tab === "internships" && <InternshipTab profile={profile} />}
    {tab === "requests" && <RequestsTab profile={profile} />}
    {tab === "documents" && <DocumentsTab profile={profile} />}
  </>;
}

function StaffSelector({ onProfile }) {
  const [setup, setSetup] = useState({ sessions: [], classes: [], sections: [], students: [] });
  const [filters, setFilters] = useState({ session_id: "", class_id: "", section_id: "", search: "" });
  const [studentId, setStudentId] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSetup = useCallback(async (next = filters) => {
    setLoading(true);
    try {
      const { data } = await api.get("/college-student-360/setup", { params: {
        session_id: next.session_id || undefined,
        class_id: next.class_id || undefined,
        section_id: next.section_id || undefined,
        search: next.search || undefined,
      }});
      setSetup(data || {});
      if (!next.session_id) {
        const active = (data?.sessions || []).find((x) => x.is_active);
        if (active) setFilters((f) => ({ ...f, session_id: String(active.id) }));
      }
    } catch (error) {
      Swal.fire("Unable to load", error?.response?.data?.message || error.message, "error");
    } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadSetup(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => (setup.sections || []).filter((x) => !filters.class_id || Number(x.class_id) === Number(filters.class_id)), [setup.sections, filters.class_id]);
  const refresh = async () => { setStudentId(""); onProfile(null); await loadSetup(filters); };
  const open = async () => {
    if (!studentId) return Swal.fire("Select student", "Choose a student to open the 360° profile.", "info");
    setLoading(true);
    try {
      const { data } = await api.get(`/college-student-360/student/${studentId}`);
      onProfile(data);
    } catch (error) { Swal.fire("Unable to load profile", error?.response?.data?.message || error.message, "error"); }
    finally { setLoading(false); }
  };

  return <div className="card border-0 shadow-sm mb-4 c360-selector"><div className="card-body p-4"><div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 className="h5 mb-1">Find Student</h2><div className="text-muted small">Filter by academic year, program/semester and batch.</div></div><button className="btn btn-outline-secondary btn-sm" onClick={refresh} disabled={loading}><i className="bi bi-arrow-clockwise me-1" />Refresh</button></div><div className="row g-3">
    <div className="col-md-3"><label className="form-label">Academic Year</label><select className="form-select" value={filters.session_id} onChange={(e) => setFilters((f) => ({ ...f, session_id: e.target.value }))}><option value="">All</option>{(setup.sessions || []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
    <div className="col-md-3"><label className="form-label">Program / Semester</label><select className="form-select" value={filters.class_id} onChange={(e) => setFilters((f) => ({ ...f, class_id: e.target.value, section_id: "" }))}><option value="">All</option>{(setup.classes || []).map((x) => <option key={x.id} value={x.id}>{x.class_name}</option>)}</select></div>
    <div className="col-md-2"><label className="form-label">Batch / Section</label><select className="form-select" value={filters.section_id} onChange={(e) => setFilters((f) => ({ ...f, section_id: e.target.value }))}><option value="">All</option>{sections.map((x) => <option key={x.id} value={x.id}>{x.section_name}</option>)}</select></div>
    <div className="col-md-4"><label className="form-label">Name / Admission No.</label><div className="input-group"><input className="form-control" placeholder="Search student" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && refresh()} /><button className="btn btn-outline-primary" onClick={refresh}><i className="bi bi-search" /></button></div></div>
    <div className="col-12"><label className="form-label">Student</label><div className="d-flex gap-2"><select className="form-select" value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Select student</option>{(setup.students || []).map((x) => <option key={x.id} value={x.id}>{x.name} · {x.admission_number}{x.roll_number ? ` · Roll ${x.roll_number}` : ""}</option>)}</select><button className="btn btn-primary px-4" onClick={open} disabled={loading || !studentId}>{loading ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-person-lines-fill me-1" />Open 360°</>}</button></div></div>
  </div></div></div>;
}

export default function CollegeStudent360() {
  const { isCollege } = useInstitution();
  const roleList = useMemo(roles, []);
  const student = roleList.includes("student");
  const staff = roleList.some((r) => STAFF.has(r));
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(student);

  useEffect(() => {
    if (!student || !isCollege) return;
    let active = true;
    setLoading(true);
    api.get("/college-student-360/my")
      .then(({ data }) => active && setProfile(data))
      .catch((error) => active && Swal.fire("Unable to load profile", error?.response?.data?.message || error.message, "error"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [student, isCollege]);

  if (!isCollege) return <div className="container-fluid py-4"><div className="alert alert-info rounded-4">360° Student Academic Profile is available in College mode.</div></div>;
  if (!student && !staff) return <div className="container-fluid py-4"><div className="alert alert-warning rounded-4">Your role does not have access to the College 360° Student Profile.</div></div>;

  return <main className="container-fluid py-4 px-3 px-md-4 c360-page">
    <div className="c360-page-title mb-4"><div><span>College Academics</span><h1>360° Student Academic Profile</h1><p>One view of enrollment, registered papers, attendance, results, credits, backlogs, documents and placement journey.</p></div><i className="bi bi-person-bounding-box" /></div>
    {staff && <StaffSelector onProfile={setProfile} />}
    {loading && <div className="text-center py-5"><span className="spinner-border spinner-border-sm me-2" />Building student academic profile…</div>}
    {!loading && profile && <ProfileBody profile={profile} />}
    {!loading && staff && !profile && <div className="c360-welcome"><i className="bi bi-person-lines-fill" /><h2>Select a student</h2><p>Open a student to see their complete college academic journey in one place.</p></div>}
  </main>;
}
