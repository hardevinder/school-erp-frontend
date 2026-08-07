import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./DepartmentManagement.css";

const emptyTask = { title: "", description: "", assigned_to_user_id: "", priority: "NORMAL", due_date: "" };
const emptyEvent = {
  title: "",
  event_type: "EVENT",
  academic_session: "",
  start_date: "",
  end_date: "",
  start_time: "",
  end_time: "",
  venue: "",
  class_scope: "ALL",
  description: "",
  teacher_incharge_user_id: "",
  status: "DRAFT",
  duty_user_id: "",
  duty_name: "",
};
const emptyDuty = { event_id: "", user_id: "", duty_name: "", instructions: "", reporting_time: "" };
const emptyParticipant = {
  event_id: "",
  student_id: "",
  participant_role: "PARTICIPANT",
  participation_status: "SELECTED",
  position: "",
  result: "",
};
const emptyAchievement = {
  title: "",
  achievement_date: "",
  academic_session: "",
  level: "SCHOOL",
  position: "",
  student_id: "",
  team_name: "",
  teacher_incharge_user_id: "",
  description: "",
  status: "DRAFT",
};
const emptyInventoryItem = {
  name: "",
  code: "",
  category_id: "",
  new_category_name: "",
  unit: "pcs",
  min_stock: "0",
  description: "",
  opening_quantity: "",
  unit_price: "",
  location_id: "",
  new_location_name: "",
  purchase_date: "",
  vendor_name: "",
  bill_no: "",
};
const emptyStockReceipt = {
  item_id: "",
  quantity: "",
  unit_price: "",
  location_id: "",
  new_location_name: "",
  vendor_name: "",
  bill_no: "",
  transaction_date: "",
  remarks: "",
};
const emptyInventoryIssue = {
  item_id: "",
  from_location_id: "",
  issued_to_user_id: "",
  issued_to_department_id: "",
  quantity: "",
  issue_due_date: "",
  purpose: "",
};
const emptyInventoryLocation = { name: "", code: "", type: "department", description: "" };

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "—");
const fmtDateTime = (value) => (value ? new Date(value).toLocaleString("en-IN") : "—");
const fmtNumber = (value) => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const userName = (user) => user?.name || user?.username || (user?.id ? `User #${user.id}` : "—");
const roleBadge = (designation) => {
  const map = { HOD: "danger", COORDINATOR: "primary", INVENTORY_INCHARGE: "warning", MEMBER: "secondary" };
  return map[designation] || "secondary";
};
const statusBadge = (status) => {
  const value = String(status || "").toUpperCase();
  if (["APPROVED", "COMPLETED", "VERIFIED", "PUBLISHED", "RETURNED"].includes(value)) return "success";
  if (["REJECTED", "CANCELLED", "ABSENT", "OVERDUE"].includes(value)) return "danger";
  if (["SUBMITTED", "ACKNOWLEDGED", "IN_PROGRESS", "RETURN_REQUESTED"].includes(value)) return "primary";
  if (["CHANGES_REQUIRED", "URGENT"].includes(value)) return "warning";
  return "secondary";
};

function MetricCard({ icon, label, value, tone = "primary" }) {
  return (
    <div className="col-6 col-lg-3">
      <div className={`department-metric border-${tone}`}>
        <div className={`department-metric-icon text-${tone}`}><i className={`bi ${icon}`} /></div>
        <div><div className="department-metric-value">{value ?? 0}</div><div className="department-metric-label">{label}</div></div>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="department-empty"><i className="bi bi-inbox" /><div>{text}</div></div>;
}

export default function DepartmentManagement() {
  const [loading, setLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState({ departments: [], my_assignments: [], users: [], subjects: [], students: [], capabilities: {} });
  const [myWork, setMyWork] = useState({ summary: {}, tasks: [], duties: [], issued_items: [], events: [], assignments: [] });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [departmentData, setDepartmentData] = useState(null);
  const [academicData, setAcademicData] = useState(null);
  const [activeTab, setActiveTab] = useState("my-work");
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [eventForm, setEventForm] = useState(emptyEvent);
  const [dutyForm, setDutyForm] = useState(emptyDuty);
  const [participantForm, setParticipantForm] = useState(emptyParticipant);
  const [achievementForm, setAchievementForm] = useState(emptyAchievement);
  const [inventoryItemForm, setInventoryItemForm] = useState(emptyInventoryItem);
  const [stockReceiptForm, setStockReceiptForm] = useState(emptyStockReceipt);
  const [inventoryIssueForm, setInventoryIssueForm] = useState(emptyInventoryIssue);
  const [inventoryLocationForm, setInventoryLocationForm] = useState(emptyInventoryLocation);
  const [assignmentForm, setAssignmentForm] = useState({ user_id: "", designation: "MEMBER", is_primary: false, remarks: "" });
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [annualSession, setAnnualSession] = useState("");
  const [annualReport, setAnnualReport] = useState(null);
  const [saving, setSaving] = useState(false);

  const selectedDepartment = useMemo(
    () => bootstrap.departments.find((d) => String(d.id) === String(selectedDepartmentId)),
    [bootstrap.departments, selectedDepartmentId]
  );
  const canConfigure = Boolean(bootstrap.capabilities?.canConfigure);
  const canApprove = Boolean(bootstrap.capabilities?.canApprove);
  const canManage = Boolean(departmentData?.can_manage);

  const showError = (error, fallback) => Swal.fire("Error", error?.response?.data?.message || error?.message || fallback, "error");

  const loadDepartment = useCallback(async (departmentId) => {
    if (!departmentId) {
      setDepartmentData(null);
      setAcademicData(null);
      return;
    }
    try {
      const [departmentRes, academicsRes] = await Promise.all([
        api.get(`/department-management/departments/${departmentId}/dashboard`),
        api.get(`/department-management/departments/${departmentId}/academics`),
      ]);
      setDepartmentData(departmentRes.data);
      setAcademicData(academicsRes.data);
      setSelectedSubjects((departmentRes.data.subjects || []).map((row) => Number(row.subject_id)));
    } catch (error) {
      setDepartmentData(null);
      setAcademicData(null);
      showError(error, "Failed to load department dashboard");
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bootstrapRes, myRes] = await Promise.all([
        api.get("/department-management/bootstrap"),
        api.get("/department-management/my-dashboard"),
      ]);
      const nextBootstrap = bootstrapRes.data || {};
      setBootstrap(nextBootstrap);
      setMyWork(myRes.data || {});
      const currentStillExists = (nextBootstrap.departments || []).some((d) => String(d.id) === String(selectedDepartmentId));
      const nextId = currentStillExists ? selectedDepartmentId : nextBootstrap.departments?.[0]?.id || "";
      setSelectedDepartmentId(nextId ? String(nextId) : "");
      if (nextId) await loadDepartment(nextId);
    } catch (error) {
      showError(error, "Failed to load Department Management");
    } finally {
      setLoading(false);
    }
  }, [loadDepartment, selectedDepartmentId]);

  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshDepartment = async () => {
    const [bootstrapRes, myRes] = await Promise.all([
      api.get("/department-management/bootstrap"),
      api.get("/department-management/my-dashboard"),
    ]);
    setBootstrap(bootstrapRes.data || {});
    setMyWork(myRes.data || {});
    if (selectedDepartmentId) await loadDepartment(selectedDepartmentId);
  };

  const changeDepartment = async (event) => {
    const id = event.target.value;
    setSelectedDepartmentId(id);
    setAnnualReport(null);
    if (id) await loadDepartment(id);
  };

  const withSaving = async (work, successMessage) => {
    setSaving(true);
    try {
      await work();
      if (successMessage) await Swal.fire("Success", successMessage, "success");
      await refreshDepartment();
    } catch (error) {
      showError(error, "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const saveAssignment = () => withSaving(async () => {
    await api.post(`/department-management/departments/${selectedDepartmentId}/assignments`, {
      ...assignmentForm,
      user_id: Number(assignmentForm.user_id),
    });
    setAssignmentForm({ user_id: "", designation: "MEMBER", is_primary: false, remarks: "" });
  }, "Department assignment saved. Newly assigned HOD should login again.");

  const removeAssignment = async (assignment) => {
    const result = await Swal.fire({ title: "Remove department assignment?", text: `${userName(assignment.user)} will lose this department access.`, icon: "warning", showCancelButton: true, confirmButtonText: "Remove" });
    if (!result.isConfirmed) return;
    await withSaving(() => api.delete(`/department-management/assignments/${assignment.id}`), "Assignment removed");
  };

  const saveSubjects = () => withSaving(
    () => api.put(`/department-management/departments/${selectedDepartmentId}/subjects`, { subject_ids: selectedSubjects }),
    "Department subjects updated"
  );

  const createTask = () => withSaving(async () => {
    await api.post(`/department-management/departments/${selectedDepartmentId}/tasks`, {
      ...taskForm,
      assigned_to_user_id: Number(taskForm.assigned_to_user_id),
      due_date: taskForm.due_date || null,
    });
    setTaskForm(emptyTask);
  }, "Task assigned");

  const updateTaskStatus = (task, status) => withSaving(
    () => api.patch(`/department-management/tasks/${task.id}`, { status }),
    status === "COMPLETED" ? "Task completed" : "Task status updated"
  );

  const createEvent = (statusOverride) => withSaving(async () => {
    const duties = eventForm.duty_user_id && eventForm.duty_name
      ? [{ user_id: Number(eventForm.duty_user_id), duty_name: eventForm.duty_name }]
      : [];
    await api.post(`/department-management/departments/${selectedDepartmentId}/events`, {
      ...eventForm,
      status: statusOverride || eventForm.status,
      teacher_incharge_user_id: eventForm.teacher_incharge_user_id ? Number(eventForm.teacher_incharge_user_id) : null,
      end_date: eventForm.end_date || eventForm.start_date,
      duties,
      duty_user_id: undefined,
      duty_name: undefined,
    });
    setEventForm(emptyEvent);
  }, "Event saved");

  const addEventDuty = () => withSaving(async () => {
    await api.post(`/department-management/events/${dutyForm.event_id}/duties`, {
      ...dutyForm,
      user_id: Number(dutyForm.user_id),
      event_id: undefined,
      reporting_time: dutyForm.reporting_time || null,
    });
    setDutyForm(emptyDuty);
  }, "Teacher duty added");

  const addEventParticipant = () => withSaving(async () => {
    await api.post(`/department-management/events/${participantForm.event_id}/participants`, {
      ...participantForm,
      student_id: Number(participantForm.student_id),
      event_id: undefined,
    });
    setParticipantForm(emptyParticipant);
  }, "Student participant/result saved");

  const reviewEvent = async (event, action) => {
    const { value: remarks } = await Swal.fire({ title: `${action.replace("_", " ")} event`, input: "textarea", inputLabel: "Coordinator remarks (optional)", showCancelButton: true, confirmButtonText: "Save" });
    if (remarks === undefined) return;
    await withSaving(() => api.post(`/department-management/events/${event.id}/review`, { action, remarks }), action === "APPROVE" ? "Event approved and added to Academic Calendar" : "Event review saved");
  };

  const acknowledgeDuty = (duty, status) => withSaving(
    () => api.patch(`/department-management/duties/${duty.id}`, { status }),
    status === "COMPLETED" ? "Duty completed" : "Duty acknowledged"
  );

  const requestReturn = async (tx) => {
    const { value: remarks } = await Swal.fire({ title: "Request item return", input: "textarea", inputLabel: "Return note (optional)", showCancelButton: true, confirmButtonText: "Request Return" });
    if (remarks === undefined) return;
    await withSaving(() => api.post(`/department-management/inventory-issues/${tx.id}/request-return`, { remarks }), "Return request sent");
  };

  const confirmReturn = async (tx) => {
    const result = await Swal.fire({
      title: "Confirm physical return?",
      text: `${tx.item?.name || "Item"} will be restored to ${tx.fromLocation?.name || "the source location"}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Confirm Return",
    });
    if (!result.isConfirmed) return;
    await withSaving(
      () => api.post(`/department-management/inventory-issues/${tx.id}/confirm-return`, {}),
      "Item returned and stock restored"
    );
  };

  const createInventoryLocation = () => withSaving(async () => {
    await api.post(`/department-management/departments/${selectedDepartmentId}/inventory/locations`, inventoryLocationForm);
    setInventoryLocationForm(emptyInventoryLocation);
  }, "Department inventory location added");

  const createInventoryItem = () => withSaving(async () => {
    await api.post(`/department-management/departments/${selectedDepartmentId}/inventory/items`, {
      ...inventoryItemForm,
      category_id: inventoryItemForm.category_id ? Number(inventoryItemForm.category_id) : null,
      location_id: inventoryItemForm.location_id ? Number(inventoryItemForm.location_id) : null,
      opening_quantity: inventoryItemForm.opening_quantity || 0,
      unit_price: inventoryItemForm.unit_price || 0,
      min_stock: inventoryItemForm.min_stock || 0,
    });
    setInventoryItemForm(emptyInventoryItem);
  }, "Department item added");

  const receiveInventoryStock = () => withSaving(async () => {
    await api.post(
      `/department-management/departments/${selectedDepartmentId}/inventory/items/${stockReceiptForm.item_id}/receive`,
      {
        ...stockReceiptForm,
        location_id: stockReceiptForm.location_id ? Number(stockReceiptForm.location_id) : null,
      }
    );
    setStockReceiptForm(emptyStockReceipt);
  }, "Stock received");

  const issueInventoryStock = () => withSaving(async () => {
    await api.post(
      `/department-management/departments/${selectedDepartmentId}/inventory/items/${inventoryIssueForm.item_id}/issue`,
      {
        ...inventoryIssueForm,
        from_location_id: Number(inventoryIssueForm.from_location_id),
        issued_to_user_id: inventoryIssueForm.issued_to_user_id ? Number(inventoryIssueForm.issued_to_user_id) : null,
        issued_to_department_id: inventoryIssueForm.issued_to_department_id ? Number(inventoryIssueForm.issued_to_department_id) : null,
      }
    );
    setInventoryIssueForm(emptyInventoryIssue);
  }, "Item issued");

  const prepareReceive = (item) => {
    const preferred = item.location_balances?.find((row) => Number(row.quantity) > 0)?.location_id
      || departmentData?.inventory_locations?.[0]?.id
      || "";
    setStockReceiptForm({ ...emptyStockReceipt, item_id: String(item.id), location_id: preferred ? String(preferred) : "" });
  };

  const prepareIssue = (item) => {
    const preferred = item.location_balances?.find((row) => Number(row.quantity) > 0)?.location_id || "";
    setInventoryIssueForm({ ...emptyInventoryIssue, item_id: String(item.id), from_location_id: preferred ? String(preferred) : "" });
  };

  const createAchievement = (statusOverride) => withSaving(async () => {
    await api.post(`/department-management/departments/${selectedDepartmentId}/achievements`, {
      ...achievementForm,
      status: statusOverride || achievementForm.status,
      student_id: achievementForm.student_id ? Number(achievementForm.student_id) : null,
      teacher_incharge_user_id: achievementForm.teacher_incharge_user_id ? Number(achievementForm.teacher_incharge_user_id) : null,
    });
    setAchievementForm(emptyAchievement);
  }, "Achievement saved");

  const reviewAchievement = (achievement, status) => withSaving(
    () => api.post(`/department-management/achievements/${achievement.id}/review`, { status, publish_on_website: status === "PUBLISHED" }),
    `Achievement marked ${status.toLowerCase()}`
  );

  const generateAnnualReport = async () => {
    try {
      const params = { department_id: selectedDepartmentId };
      if (annualSession.trim()) params.academic_session = annualSession.trim();
      const { data } = await api.get("/department-management/annual-report", { params });
      setAnnualReport(data);
      setActiveTab("annual-report");
    } catch (error) {
      showError(error, "Failed to generate annual report");
    }
  };

  const printAnnualReport = () => window.print();

  if (loading) return <div className="department-loader"><div className="spinner-border text-primary" /><div>Loading Department Management…</div></div>;

  const tabs = [
    ["my-work", "My Department Work", "bi-person-workspace", true],
    ["overview", "Overview", "bi-speedometer2", Boolean(selectedDepartmentId)],
    ["team", "Team & Subjects", "bi-people", Boolean(selectedDepartmentId)],
    ["tasks", "Tasks", "bi-list-check", Boolean(selectedDepartmentId)],
    ["inventory", "Inventory", "bi-box-seam", Boolean(selectedDepartmentId)],
    ["events", "Events & Duties", "bi-calendar-event", Boolean(selectedDepartmentId)],
    ["achievements", "Achievements", "bi-trophy", Boolean(selectedDepartmentId)],
    ["academics", "Academic Monitoring", "bi-journal-check", Boolean(selectedDepartmentId)],
    ["annual-report", "Annual Report", "bi-file-earmark-richtext", Boolean(selectedDepartmentId)],
  ].filter((tab) => tab[3]);
  const inventoryItems = departmentData?.inventory_items || [];
  const inventoryCategories = departmentData?.inventory_categories || [];
  const inventoryLocations = departmentData?.inventory_locations || [];

  return (
    <div className="container-fluid department-page py-3">
      <div className="department-hero no-print">
        <div>
          <div className="department-eyebrow">School ERP</div>
          <h2 className="mb-1">Department Management</h2>
          <p className="mb-0">HOD dashboard, tasks, inventory responsibility, events, achievements and academic monitoring.</p>
        </div>
        <div className="department-selector">
          <label>Working Department</label>
          <select className="form-select" value={selectedDepartmentId} onChange={changeDepartment}>
            <option value="">My Work only</option>
            {(bootstrap.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </div>
      </div>

      <div className="department-tabs no-print">
        {tabs.map(([key, label, icon]) => (
          <button key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>
            <i className={`bi ${icon}`} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "my-work" && (
        <section>
          <div className="row g-3 mb-3">
            <MetricCard icon="bi-list-check" label="Pending Tasks" value={myWork.summary?.pending_tasks} tone="primary" />
            <MetricCard icon="bi-person-badge" label="Active Duties" value={myWork.summary?.active_duties} tone="info" />
            <MetricCard icon="bi-box-seam" label="Items Issued" value={myWork.summary?.issued_items} tone="warning" />
            <MetricCard icon="bi-calendar2-week" label="Upcoming Events" value={myWork.summary?.upcoming_events} tone="success" />
          </div>

          {(myWork.assignments || []).length > 0 && (
            <div className="department-card mb-3"><div className="department-card-header"><h5>My Department Roles</h5></div><div className="d-flex flex-wrap gap-2">
              {myWork.assignments.map((a) => <span key={a.id} className={`badge text-bg-${roleBadge(a.designation)} p-2`}>{a.department?.name}: {a.designation.replaceAll("_", " ")}</span>)}
            </div></div>
          )}

          <div className="row g-3">
            <div className="col-xl-6"><div className="department-card h-100"><div className="department-card-header"><h5>My Tasks</h5></div>
              {(myWork.tasks || []).length === 0 ? <EmptyState text="No department task assigned" /> : (myWork.tasks || []).map((task) => (
                <div className="department-list-row" key={task.id}>
                  <div className="flex-grow-1"><div className="fw-bold">{task.title}</div><div className="small text-muted">{task.department?.name} · Due {fmtDateTime(task.due_date)} · Assigned by {userName(task.assignedBy)}</div><div className="small mt-1">{task.description}</div></div>
                  <div className="text-end"><span className={`badge text-bg-${statusBadge(task.status)}`}>{task.status}</span><div className="mt-2 d-flex gap-1 justify-content-end">
                    {task.status === "PENDING" && <button className="btn btn-sm btn-outline-primary" onClick={() => updateTaskStatus(task, "ACKNOWLEDGED")}>Acknowledge</button>}
                    {!["COMPLETED", "CANCELLED"].includes(task.status) && <button className="btn btn-sm btn-success" onClick={() => updateTaskStatus(task, "COMPLETED")}>Complete</button>}
                  </div></div>
                </div>
              ))}
            </div></div>

            <div className="col-xl-6"><div className="department-card h-100"><div className="department-card-header"><h5>My Event Duties</h5></div>
              {(myWork.duties || []).length === 0 ? <EmptyState text="No event duty assigned" /> : (myWork.duties || []).map((duty) => (
                <div className="department-list-row" key={duty.id}>
                  <div className="flex-grow-1"><div className="fw-bold">{duty.duty_name}</div><div className="small text-muted">{duty.event?.title} · {duty.event?.department?.name}</div><div className="small">{fmtDate(duty.event?.start_date)} · {duty.event?.venue || "Venue not set"}</div></div>
                  <div className="text-end"><span className={`badge text-bg-${statusBadge(duty.status)}`}>{duty.status}</span><div className="mt-2 d-flex gap-1">
                    {duty.status === "ASSIGNED" && <button className="btn btn-sm btn-outline-primary" onClick={() => acknowledgeDuty(duty, "ACKNOWLEDGED")}>Acknowledge</button>}
                    {!["COMPLETED", "CANCELLED"].includes(duty.status) && <button className="btn btn-sm btn-success" onClick={() => acknowledgeDuty(duty, "COMPLETED")}>Complete</button>}
                  </div></div>
                </div>
              ))}
            </div></div>

            <div className="col-12"><div className="department-card"><div className="department-card-header"><h5>Items Issued to Me</h5></div>
              {(myWork.issued_items || []).length === 0 ? <EmptyState text="No returnable department item is issued to you" /> : <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Item</th><th>Owner Department</th><th>Quantity</th><th>Issued</th><th>Return Due</th><th>Status</th><th /></tr></thead><tbody>
                {myWork.issued_items.map((tx) => <tr key={tx.id}><td className="fw-semibold">{tx.item?.name}<div className="small text-muted">{tx.item?.code || ""}</div></td><td>{tx.item?.department?.name || tx.issuedToDepartment?.name || "—"}</td><td>{tx.quantity} {tx.item?.unit}</td><td>{fmtDate(tx.transaction_date)}</td><td>{fmtDate(tx.issue_due_date)}</td><td><span className={`badge text-bg-${statusBadge(tx.return_status)}`}>{tx.return_status}</span></td><td>{["ISSUED", "OVERDUE"].includes(tx.return_status) && <button className="btn btn-sm btn-outline-primary" onClick={() => requestReturn(tx)}>Request Return</button>}</td></tr>)}
              </tbody></table></div>}
            </div></div>
          </div>
        </section>
      )}

      {activeTab === "overview" && departmentData && (
        <section>
          <div className="department-title-row"><div><h3>{selectedDepartment?.name}</h3><p>{selectedDepartment?.description || "Department dashboard"}</p></div><span className={`badge text-bg-${canManage ? "success" : "secondary"}`}>{canManage ? "Management Access" : "View Access"}</span></div>
          <div className="row g-3 mb-3">
            <MetricCard icon="bi-people" label="Members" value={departmentData.summary?.members} />
            <MetricCard icon="bi-book" label="Mapped Subjects" value={departmentData.summary?.subjects} tone="info" />
            <MetricCard icon="bi-list-check" label="Pending Tasks" value={departmentData.summary?.pending_tasks} tone="warning" />
            <MetricCard icon="bi-calendar-event" label="Upcoming Events" value={departmentData.summary?.upcoming_events} tone="success" />
            <MetricCard icon="bi-trophy" label="Verified Achievements" value={departmentData.summary?.achievements} tone="success" />
            <MetricCard icon="bi-box-seam" label="Inventory Items" value={departmentData.summary?.inventory_items} tone="primary" />
            <MetricCard icon="bi-box-arrow-up-right" label="Items Issued" value={departmentData.summary?.inventory_issued} tone="warning" />
            <MetricCard icon="bi-exclamation-triangle" label="Overdue Tasks" value={departmentData.summary?.overdue_tasks} tone="danger" />
          </div>
          <div className="row g-3">
            <div className="col-lg-6"><div className="department-card h-100"><div className="department-card-header"><h5>Upcoming / Recent Events</h5></div>{(departmentData.events || []).slice(0, 6).map((event) => <div className="department-list-row" key={event.id}><div><strong>{event.title}</strong><div className="small text-muted">{fmtDate(event.start_date)} · {event.venue || "Venue not set"}</div></div><span className={`badge text-bg-${statusBadge(event.status)}`}>{event.status}</span></div>)}</div></div>
            <div className="col-lg-6"><div className="department-card h-100"><div className="department-card-header"><h5>Recent Achievements</h5></div>{(departmentData.achievements || []).slice(0, 6).map((achievement) => <div className="department-list-row" key={achievement.id}><div><strong>{achievement.title}</strong><div className="small text-muted">{achievement.level} · {achievement.position || "Result recorded"}</div></div><span className={`badge text-bg-${statusBadge(achievement.status)}`}>{achievement.status}</span></div>)}</div></div>
          </div>
        </section>
      )}

      {activeTab === "team" && departmentData && (
        <section className="row g-3">
          <div className="col-xl-7"><div className="department-card"><div className="department-card-header"><h5>Department Team</h5></div>
            {(departmentData.assignments || []).length === 0 ? <EmptyState text="No HOD or department member assigned" /> : <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Staff</th><th>Designation</th><th>Since</th>{canConfigure && <th />}</tr></thead><tbody>
              {departmentData.assignments.map((assignment) => <tr key={assignment.id}><td><strong>{userName(assignment.user)}</strong><div className="small text-muted">{assignment.user?.employee?.employee_id || assignment.user?.username}</div></td><td><span className={`badge text-bg-${roleBadge(assignment.designation)}`}>{assignment.designation.replaceAll("_", " ")}</span></td><td>{fmtDate(assignment.start_date)}</td>{canConfigure && <td className="text-end"><button className="btn btn-sm btn-outline-danger" onClick={() => removeAssignment(assignment)}>Remove</button></td>}</tr>)}
            </tbody></table></div>}
          </div></div>
          <div className="col-xl-5">
            {canConfigure && <div className="department-card mb-3"><div className="department-card-header"><h5>Assign HOD / Member</h5></div><div className="row g-2">
              <div className="col-12"><select className="form-select" value={assignmentForm.user_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, user_id: e.target.value })}><option value="">Select staff user</option>{bootstrap.users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}</select></div>
              <div className={assignmentForm.designation === "HOD" ? "col-7" : "col-12"}><select className="form-select" value={assignmentForm.designation} onChange={(e) => setAssignmentForm({ ...assignmentForm, designation: e.target.value, is_primary: e.target.value === "HOD" })}><option value="HOD">HOD</option><option value="MEMBER">Member</option><option value="COORDINATOR">Coordinator</option><option value="INVENTORY_INCHARGE">Inventory Incharge</option></select></div>
              {assignmentForm.designation === "HOD" && <div className="col-5 d-flex align-items-center"><div className="form-check"><input className="form-check-input" type="checkbox" checked={assignmentForm.is_primary} onChange={(e) => setAssignmentForm({ ...assignmentForm, is_primary: e.target.checked })} /><label className="form-check-label">Primary HOD</label></div></div>}
              <div className="col-12"><input className="form-control" placeholder="Remarks (optional)" value={assignmentForm.remarks} onChange={(e) => setAssignmentForm({ ...assignmentForm, remarks: e.target.value })} /></div>
              <div className="col-12"><button className="btn btn-primary w-100" disabled={saving || !assignmentForm.user_id} onClick={saveAssignment}>Save Assignment</button></div>
            </div></div>}
            <div className="department-card"><div className="department-card-header"><h5>Department Subjects</h5></div><div className="department-subject-grid">
              {bootstrap.subjects.map((subject) => <label key={subject.id} className={selectedSubjects.includes(Number(subject.id)) ? "selected" : ""}><input type="checkbox" checked={selectedSubjects.includes(Number(subject.id))} disabled={!canManage} onChange={(e) => setSelectedSubjects((current) => e.target.checked ? [...current, Number(subject.id)] : current.filter((id) => id !== Number(subject.id)))} /> <span>{subject.name}</span></label>)}
            </div>{canManage && <button className="btn btn-outline-primary w-100 mt-3" disabled={saving} onClick={saveSubjects}>Save Subject Mapping</button>}</div>
          </div>
        </section>
      )}

      {activeTab === "tasks" && departmentData && (
        <section className="row g-3">
          {canManage && <div className="col-xl-4"><div className="department-card sticky-lg-top department-sticky"><div className="department-card-header"><h5>Assign New Task</h5></div><div className="row g-2">
            <div className="col-12"><input className="form-control" placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
            <div className="col-12"><textarea className="form-control" rows="3" placeholder="Description" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></div>
            <div className="col-12"><select className="form-select" value={taskForm.assigned_to_user_id} onChange={(e) => setTaskForm({ ...taskForm, assigned_to_user_id: e.target.value })}><option value="">Assign to staff</option>{bootstrap.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div className="col-6"><select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></div>
            <div className="col-6"><input type="datetime-local" className="form-control" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} /></div>
            <div className="col-12"><button className="btn btn-primary w-100" disabled={saving || !taskForm.title || !taskForm.assigned_to_user_id} onClick={createTask}>Assign Task</button></div>
          </div></div></div>}
          <div className={canManage ? "col-xl-8" : "col-12"}><div className="department-card"><div className="department-card-header"><h5>Department Tasks</h5></div>
            {(departmentData.tasks || []).length === 0 ? <EmptyState text="No department tasks" /> : (departmentData.tasks || []).map((task) => <div className="department-list-row" key={task.id}><div className="flex-grow-1"><div className="d-flex align-items-center gap-2"><strong>{task.title}</strong><span className={`badge text-bg-${statusBadge(task.priority)}`}>{task.priority}</span></div><div className="small text-muted">Assigned to {userName(task.assignedTo)} by {userName(task.assignedBy)} · Due {fmtDateTime(task.due_date)}</div><div className="small mt-1">{task.description}</div></div><div className="text-end"><span className={`badge text-bg-${statusBadge(task.status)}`}>{task.status}</span>{!["COMPLETED", "CANCELLED"].includes(task.status) && <div className="mt-2"><button className="btn btn-sm btn-success" onClick={() => updateTaskStatus(task, "COMPLETED")}>Complete</button></div>}</div></div>)}
          </div></div>
        </section>
      )}

      {activeTab === "inventory" && departmentData && (
        <section>
          <div className="row g-3 mb-3">
            <MetricCard icon="bi-box-seam" label="Department Items" value={departmentData.summary?.inventory_items} tone="primary" />
            <MetricCard icon="bi-boxes" label="Items In Stock" value={departmentData.summary?.inventory_in_stock} tone="success" />
            <MetricCard icon="bi-exclamation-triangle" label="Low Stock Items" value={departmentData.summary?.inventory_low_stock} tone="danger" />
            <MetricCard icon="bi-box-arrow-up-right" label="Currently Issued" value={departmentData.summary?.inventory_issued} tone="warning" />
          </div>

          <div className="row g-3 mb-3">
            {canManage && <div className="col-xl-4"><div className="department-card h-100"><div className="department-card-header"><h5>Add Department Item</h5><span className="badge text-bg-primary">{selectedDepartment?.name}</span></div><div className="row g-2">
              <div className="col-8"><input className="form-control" placeholder="Item name *" value={inventoryItemForm.name} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, name: e.target.value })} /></div>
              <div className="col-4"><input className="form-control" placeholder="Item code" value={inventoryItemForm.code} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, code: e.target.value })} /></div>
              <div className="col-6"><select className="form-select" value={inventoryItemForm.category_id} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, category_id: e.target.value, new_category_name: e.target.value ? "" : inventoryItemForm.new_category_name })}><option value="">Select / create category</option>{inventoryCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
              <div className="col-6"><input className="form-control" placeholder="New category" disabled={Boolean(inventoryItemForm.category_id)} value={inventoryItemForm.new_category_name} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, new_category_name: e.target.value })} /></div>
              <div className="col-4"><input className="form-control" placeholder="Unit" value={inventoryItemForm.unit} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, unit: e.target.value })} /></div>
              <div className="col-4"><input type="number" min="0" step="0.01" className="form-control" placeholder="Opening qty" value={inventoryItemForm.opening_quantity} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, opening_quantity: e.target.value })} /></div>
              <div className="col-4"><input type="number" min="0" step="0.01" className="form-control" placeholder="Min stock" value={inventoryItemForm.min_stock} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, min_stock: e.target.value })} /></div>
              <div className="col-6"><select className="form-select" value={inventoryItemForm.location_id} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, location_id: e.target.value, new_location_name: e.target.value ? "" : inventoryItemForm.new_location_name })}><option value="">Default / new location</option>{inventoryLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
              <div className="col-6"><input className="form-control" placeholder="New store/lab location" disabled={Boolean(inventoryItemForm.location_id)} value={inventoryItemForm.new_location_name} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, new_location_name: e.target.value })} /></div>
              <div className="col-4"><input type="number" min="0" step="0.01" className="form-control" placeholder="Unit price" value={inventoryItemForm.unit_price} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, unit_price: e.target.value })} /></div>
              <div className="col-8"><input type="date" className="form-control" title="Purchase/opening date" value={inventoryItemForm.purchase_date} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, purchase_date: e.target.value })} /></div>
              <div className="col-6"><input className="form-control" placeholder="Vendor (optional)" value={inventoryItemForm.vendor_name} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, vendor_name: e.target.value })} /></div>
              <div className="col-6"><input className="form-control" placeholder="Bill no. (optional)" value={inventoryItemForm.bill_no} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, bill_no: e.target.value })} /></div>
              <div className="col-12"><textarea className="form-control" rows="2" placeholder="Description / condition / remarks" value={inventoryItemForm.description} onChange={(e) => setInventoryItemForm({ ...inventoryItemForm, description: e.target.value })} /></div>
              <div className="col-12"><button className="btn btn-primary w-100" disabled={saving || !inventoryItemForm.name.trim()} onClick={createInventoryItem}><i className="bi bi-plus-circle" /> Add Item{Number(inventoryItemForm.opening_quantity || 0) > 0 ? " with Opening Stock" : ""}</button></div>
            </div></div></div>}

            <div className={canManage ? "col-xl-8" : "col-12"}><div className="department-card h-100"><div className="department-card-header"><h5>Department Items & Stock</h5><span className="small text-muted">Ownership is locked to {selectedDepartment?.name}</span></div>
              {inventoryItems.length === 0 ? <EmptyState text="No inventory item added for this department" /> : <div className="table-responsive"><table className="table align-middle department-inventory-table"><thead><tr><th>Item</th><th>Category</th><th>Total Stock</th><th>Location Balance</th><th>Minimum</th>{canManage && <th />}</tr></thead><tbody>
                {inventoryItems.map((item) => <tr key={item.id}>
                  <td><strong>{item.name}</strong><div className="small text-muted">{item.code || "No code"} · {item.unit}</div>{item.description && <div className="small mt-1">{item.description}</div>}</td>
                  <td>{item.category?.name || "General"}</td>
                  <td><span className={`department-stock-pill ${item.low_stock ? "low" : "ok"}`}>{fmtNumber(item.total_stock)} {item.unit}</span></td>
                  <td>{(item.location_balances || []).length === 0 ? <span className="text-muted">No stock</span> : <div className="d-flex flex-wrap gap-1">{item.location_balances.map((balance) => <span key={balance.location_id} className="badge text-bg-light border">{balance.location?.name || `Location #${balance.location_id}`}: {fmtNumber(balance.quantity)}</span>)}</div>}</td>
                  <td>{fmtNumber(item.min_stock)} {item.unit}</td>
                  {canManage && <td className="text-end"><div className="btn-group btn-group-sm"><button className="btn btn-outline-success" onClick={() => prepareReceive(item)}>Receive</button><button className="btn btn-outline-primary" disabled={Number(item.total_stock) <= 0} onClick={() => prepareIssue(item)}>Issue</button></div></td>}
                </tr>)}
              </tbody></table></div>}
            </div></div>
          </div>

          {canManage && <div className="row g-3 mb-3">
            <div className="col-lg-4"><div className="department-card h-100"><div className="department-card-header"><h5>Receive / Add Stock</h5></div><div className="row g-2">
              <div className="col-12"><select className="form-select" value={stockReceiptForm.item_id} onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, item_id: e.target.value })}><option value="">Select department item</option>{inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name} · Stock {fmtNumber(item.total_stock)}</option>)}</select></div>
              <div className="col-6"><input type="number" min="0.01" step="0.01" className="form-control" placeholder="Quantity *" value={stockReceiptForm.quantity} onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, quantity: e.target.value })} /></div>
              <div className="col-6"><input type="number" min="0" step="0.01" className="form-control" placeholder="Unit price" value={stockReceiptForm.unit_price} onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, unit_price: e.target.value })} /></div>
              <div className="col-12"><select className="form-select" value={stockReceiptForm.location_id} onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, location_id: e.target.value, new_location_name: e.target.value ? "" : stockReceiptForm.new_location_name })}><option value="">Default / create location</option>{inventoryLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
              {!stockReceiptForm.location_id && <div className="col-12"><input className="form-control" placeholder="New location name (optional)" value={stockReceiptForm.new_location_name} onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, new_location_name: e.target.value })} /></div>}
              <div className="col-6"><input className="form-control" placeholder="Vendor" value={stockReceiptForm.vendor_name} onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, vendor_name: e.target.value })} /></div>
              <div className="col-6"><input className="form-control" placeholder="Bill no." value={stockReceiptForm.bill_no} onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, bill_no: e.target.value })} /></div>
              <div className="col-12"><button className="btn btn-success w-100" disabled={saving || !stockReceiptForm.item_id || Number(stockReceiptForm.quantity) <= 0} onClick={receiveInventoryStock}>Receive Stock</button></div>
            </div></div></div>

            <div className="col-lg-5"><div className="department-card h-100"><div className="department-card-header"><h5>Issue Department Item</h5><span className="small text-muted">Can issue outside department</span></div><div className="row g-2">
              <div className="col-12"><select className="form-select" value={inventoryIssueForm.item_id} onChange={(e) => { const item = inventoryItems.find((row) => String(row.id) === e.target.value); setInventoryIssueForm({ ...inventoryIssueForm, item_id: e.target.value, from_location_id: item?.location_balances?.find((row) => Number(row.quantity) > 0)?.location_id?.toString() || "" }); }}><option value="">Select item</option>{inventoryItems.filter((item) => Number(item.total_stock) > 0).map((item) => <option key={item.id} value={item.id}>{item.name} · {fmtNumber(item.total_stock)} {item.unit}</option>)}</select></div>
              <div className="col-6"><select className="form-select" value={inventoryIssueForm.from_location_id} onChange={(e) => setInventoryIssueForm({ ...inventoryIssueForm, from_location_id: e.target.value })}><option value="">Source location *</option>{(inventoryItems.find((item) => String(item.id) === String(inventoryIssueForm.item_id))?.location_balances || []).filter((row) => Number(row.quantity) > 0).map((balance) => <option key={balance.location_id} value={balance.location_id}>{balance.location?.name || `Location #${balance.location_id}`} · {fmtNumber(balance.quantity)}</option>)}</select></div>
              <div className="col-6"><input type="number" min="0.01" step="0.01" className="form-control" placeholder="Quantity *" value={inventoryIssueForm.quantity} onChange={(e) => setInventoryIssueForm({ ...inventoryIssueForm, quantity: e.target.value })} /></div>
              <div className="col-6"><select className="form-select" value={inventoryIssueForm.issued_to_user_id} onChange={(e) => setInventoryIssueForm({ ...inventoryIssueForm, issued_to_user_id: e.target.value })}><option value="">Issue to staff/user</option>{(bootstrap.users || []).map((user) => <option key={user.id} value={user.id}>{user.name} ({user.username})</option>)}</select></div>
              <div className="col-6"><select className="form-select" value={inventoryIssueForm.issued_to_department_id} onChange={(e) => setInventoryIssueForm({ ...inventoryIssueForm, issued_to_department_id: e.target.value })}><option value="">Receiver department</option>{((bootstrap.receiver_departments || bootstrap.departments) || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
              <div className="col-6"><input type="date" className="form-control" title="Return due date" value={inventoryIssueForm.issue_due_date} onChange={(e) => setInventoryIssueForm({ ...inventoryIssueForm, issue_due_date: e.target.value })} /></div>
              <div className="col-6"><input className="form-control" placeholder="Purpose / event" value={inventoryIssueForm.purpose} onChange={(e) => setInventoryIssueForm({ ...inventoryIssueForm, purpose: e.target.value })} /></div>
              <div className="col-12"><button className="btn btn-primary w-100" disabled={saving || !inventoryIssueForm.item_id || !inventoryIssueForm.from_location_id || Number(inventoryIssueForm.quantity) <= 0 || (!inventoryIssueForm.issued_to_user_id && !inventoryIssueForm.issued_to_department_id)} onClick={issueInventoryStock}>Issue Item</button></div>
            </div></div></div>

            <div className="col-lg-3"><div className="department-card h-100"><div className="department-card-header"><h5>Stores / Locations</h5></div><div className="d-flex flex-wrap gap-1 mb-3">{inventoryLocations.length === 0 ? <span className="small text-muted">A default store is created with first stock entry.</span> : inventoryLocations.map((location) => <span key={location.id} className="badge text-bg-light border p-2">{location.name}</span>)}</div><div className="row g-2">
              <div className="col-12"><input className="form-control" placeholder="New store/lab name" value={inventoryLocationForm.name} onChange={(e) => setInventoryLocationForm({ ...inventoryLocationForm, name: e.target.value })} /></div>
              <div className="col-5"><input className="form-control" placeholder="Code" value={inventoryLocationForm.code} onChange={(e) => setInventoryLocationForm({ ...inventoryLocationForm, code: e.target.value })} /></div>
              <div className="col-7"><select className="form-select" value={inventoryLocationForm.type} onChange={(e) => setInventoryLocationForm({ ...inventoryLocationForm, type: e.target.value })}>{["department", "store", "lab", "office", "classroom", "other"].map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></div>
              <div className="col-12"><button className="btn btn-outline-primary w-100" disabled={saving || !inventoryLocationForm.name.trim()} onClick={createInventoryLocation}>Add Location</button></div>
            </div></div></div>
          </div>}

          <div className="department-card">
            <div className="department-card-header"><h5>Items Issued from this Department</h5><span className={`badge text-bg-${departmentData.summary?.inventory_return_requests ? "info" : "secondary"}`}>{departmentData.summary?.inventory_return_requests || 0} return requests</span></div>
            {(departmentData.inventory_issues || []).length === 0 ? <EmptyState text="No department item is currently issued" /> : (
              <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Item</th><th>Issued To</th><th>Department</th><th>Quantity</th><th>Purpose</th><th>Return Due</th><th>Status</th><th /></tr></thead><tbody>
                {(departmentData.inventory_issues || []).map((tx) => <tr key={tx.id}>
                  <td><strong>{tx.item?.name}</strong><div className="small text-muted">{tx.item?.code || ""} · From {tx.fromLocation?.name || "—"}</div></td>
                  <td>{userName(tx.issuedToUser)}</td>
                  <td>{tx.issuedToDepartment?.name || "—"}</td>
                  <td>{tx.quantity} {tx.item?.unit}</td>
                  <td>{tx.purpose || "—"}</td>
                  <td>{fmtDate(tx.issue_due_date)}</td>
                  <td><span className={`badge text-bg-${statusBadge(tx.return_status)}`}>{tx.return_status}</span></td>
                  <td>{canManage && tx.return_status === "RETURN_REQUESTED" && <button className="btn btn-sm btn-success" onClick={() => confirmReturn(tx)}>Confirm Return</button>}</td>
                </tr>)}
              </tbody></table></div>
            )}
          </div>
        </section>
      )}

      {activeTab === "events" && departmentData && (
        <section className="row g-3">
          {canManage && <div className="col-xl-4"><div className="department-card department-sticky sticky-lg-top"><div className="department-card-header"><h5>Schedule Event / Competition</h5></div><div className="row g-2">
            <div className="col-12"><input className="form-control" placeholder="Event title" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} /></div>
            <div className="col-6"><select className="form-select" value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}>{["EVENT", "COMPETITION", "ACTIVITY", "WORKSHOP", "TRIP", "EXHIBITION", "MEETING", "TRAINING", "OTHER"].map((v) => <option key={v}>{v}</option>)}</select></div>
            <div className="col-6"><input className="form-control" placeholder="Session e.g. 2026-27" value={eventForm.academic_session} onChange={(e) => setEventForm({ ...eventForm, academic_session: e.target.value })} /></div>
            <div className="col-6"><label className="form-label small">Start</label><input type="date" className="form-control" value={eventForm.start_date} onChange={(e) => setEventForm({ ...eventForm, start_date: e.target.value })} /></div>
            <div className="col-6"><label className="form-label small">End</label><input type="date" className="form-control" value={eventForm.end_date} onChange={(e) => setEventForm({ ...eventForm, end_date: e.target.value })} /></div>
            <div className="col-6"><input type="time" className="form-control" value={eventForm.start_time} onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })} /></div>
            <div className="col-6"><input type="time" className="form-control" value={eventForm.end_time} onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })} /></div>
            <div className="col-12"><input className="form-control" placeholder="Venue" value={eventForm.venue} onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })} /></div>
            <div className="col-12"><input className="form-control" placeholder="Class scope: ALL or class ids/codes" value={eventForm.class_scope} onChange={(e) => setEventForm({ ...eventForm, class_scope: e.target.value })} /></div>
            <div className="col-12"><select className="form-select" value={eventForm.teacher_incharge_user_id} onChange={(e) => setEventForm({ ...eventForm, teacher_incharge_user_id: e.target.value })}><option value="">Teacher in-charge</option>{bootstrap.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div className="col-7"><select className="form-select" value={eventForm.duty_user_id} onChange={(e) => setEventForm({ ...eventForm, duty_user_id: e.target.value })}><option value="">Optional duty teacher</option>{bootstrap.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div className="col-5"><input className="form-control" placeholder="Duty name" value={eventForm.duty_name} onChange={(e) => setEventForm({ ...eventForm, duty_name: e.target.value })} /></div>
            <div className="col-12"><textarea className="form-control" rows="3" placeholder="Description / instructions" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></div>
            <div className="col-6"><button className="btn btn-outline-primary w-100" disabled={saving || !eventForm.title || !eventForm.start_date} onClick={() => createEvent("DRAFT")}>Save Draft</button></div>
            <div className="col-6"><button className="btn btn-primary w-100" disabled={saving || !eventForm.title || !eventForm.start_date || !eventForm.academic_session} onClick={() => withSaving(async () => { const form = { ...eventForm, status: "SUBMITTED" }; const duties = form.duty_user_id && form.duty_name ? [{ user_id: Number(form.duty_user_id), duty_name: form.duty_name }] : []; await api.post(`/department-management/departments/${selectedDepartmentId}/events`, { ...form, teacher_incharge_user_id: form.teacher_incharge_user_id ? Number(form.teacher_incharge_user_id) : null, end_date: form.end_date || form.start_date, duties }); setEventForm(emptyEvent); }, "Event submitted for coordinator approval")}>Submit</button></div>
          </div></div></div>}
          <div className={canManage ? "col-xl-8" : "col-12"}>
            {canManage && <div className="row g-3 mb-3">
              <div className="col-lg-6"><div className="department-card h-100"><div className="department-card-header"><h5>Add Teacher Duty</h5></div><div className="row g-2">
                <div className="col-12"><select className="form-select" value={dutyForm.event_id} onChange={(e) => setDutyForm({ ...dutyForm, event_id: e.target.value })}><option value="">Select event</option>{(departmentData.events || []).map((event) => <option key={event.id} value={event.id}>{event.title} · {fmtDate(event.start_date)}</option>)}</select></div>
                <div className="col-12"><select className="form-select" value={dutyForm.user_id} onChange={(e) => setDutyForm({ ...dutyForm, user_id: e.target.value })}><option value="">Select teacher/staff</option>{(bootstrap.users || []).map((user) => <option key={user.id} value={user.id}>{user.name} ({user.username})</option>)}</select></div>
                <div className="col-7"><input className="form-control" placeholder="Duty name" value={dutyForm.duty_name} onChange={(e) => setDutyForm({ ...dutyForm, duty_name: e.target.value })} /></div>
                <div className="col-5"><input type="datetime-local" className="form-control" value={dutyForm.reporting_time} onChange={(e) => setDutyForm({ ...dutyForm, reporting_time: e.target.value })} /></div>
                <div className="col-12"><input className="form-control" placeholder="Instructions (optional)" value={dutyForm.instructions} onChange={(e) => setDutyForm({ ...dutyForm, instructions: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-outline-primary w-100" disabled={saving || !dutyForm.event_id || !dutyForm.user_id || !dutyForm.duty_name} onClick={addEventDuty}>Add Duty</button></div>
              </div></div></div>
              <div className="col-lg-6"><div className="department-card h-100"><div className="department-card-header"><h5>Add Student / Result</h5></div><div className="row g-2">
                <div className="col-12"><select className="form-select" value={participantForm.event_id} onChange={(e) => setParticipantForm({ ...participantForm, event_id: e.target.value })}><option value="">Select event</option>{(departmentData.events || []).map((event) => <option key={event.id} value={event.id}>{event.title} · {fmtDate(event.start_date)}</option>)}</select></div>
                <div className="col-12"><select className="form-select" value={participantForm.student_id} onChange={(e) => setParticipantForm({ ...participantForm, student_id: e.target.value })}><option value="">Select student</option>{(bootstrap.students || []).map((student) => <option key={student.id} value={student.id}>{student.name} · {student.admission_number || "No admission no."} · {student.Class?.name || "Class"}-{student.Section?.name || ""}</option>)}</select></div>
                <div className="col-6"><select className="form-select" value={participantForm.participant_role} onChange={(e) => setParticipantForm({ ...participantForm, participant_role: e.target.value })}>{["PARTICIPANT", "TEAM_MEMBER", "CAPTAIN", "SUBSTITUTE", "VOLUNTEER"].map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="col-6"><select className="form-select" value={participantForm.participation_status} onChange={(e) => setParticipantForm({ ...participantForm, participation_status: e.target.value })}>{["SELECTED", "CONFIRMED", "PARTICIPATED", "ABSENT", "WITHDRAWN"].map((value) => <option key={value}>{value}</option>)}</select></div>
                <div className="col-6"><input className="form-control" placeholder="Position" value={participantForm.position} onChange={(e) => setParticipantForm({ ...participantForm, position: e.target.value })} /></div>
                <div className="col-6"><input className="form-control" placeholder="Result / score" value={participantForm.result} onChange={(e) => setParticipantForm({ ...participantForm, result: e.target.value })} /></div>
                <div className="col-12"><button className="btn btn-outline-success w-100" disabled={saving || !participantForm.event_id || !participantForm.student_id} onClick={addEventParticipant}>Save Participant / Result</button></div>
              </div></div></div>
            </div>}
            <div className="department-card"><div className="department-card-header"><h5>Events, Competitions & Teacher Duties</h5></div>
            {(departmentData.events || []).length === 0 ? <EmptyState text="No department event scheduled" /> : (departmentData.events || []).map((event) => <div className="department-event" key={event.id}><div className="d-flex justify-content-between gap-3"><div><div className="department-event-type">{event.event_type}</div><h5>{event.title}</h5><div className="small text-muted"><i className="bi bi-calendar3" /> {fmtDate(event.start_date)}–{fmtDate(event.end_date)} · <i className="bi bi-geo-alt" /> {event.venue || "Venue not set"}</div><p className="mb-2 mt-2">{event.description}</p></div><div className="text-end"><span className={`badge text-bg-${statusBadge(event.status)}`}>{event.status}</span>{event.academic_calendar_event_id && <div className="small text-success mt-1"><i className="bi bi-calendar-check" /> Calendar synced</div>}</div></div>
              {(event.duties || []).length > 0 && <div className="department-duty-strip"><strong>Teacher Duties:</strong> {event.duties.map((duty) => <span key={duty.id}>{userName(duty.user)} — {duty.duty_name} <em>({duty.status})</em></span>)}</div>}
              {(event.participants || []).length > 0 && <div className="department-duty-strip"><strong>Students / Results:</strong> {event.participants.map((participant) => <span key={participant.id}>{participant.student?.name || `Student #${participant.student_id}`} — {participant.participant_role} {participant.position || participant.result ? <em>({participant.position || participant.result})</em> : null}</span>)}</div>}
              {canApprove && event.status === "SUBMITTED" && <div className="d-flex gap-2 mt-3"><button className="btn btn-sm btn-success" onClick={() => reviewEvent(event, "APPROVE")}>Approve & Add to Calendar</button><button className="btn btn-sm btn-outline-warning" onClick={() => reviewEvent(event, "CHANGES_REQUIRED")}>Changes Required</button><button className="btn btn-sm btn-outline-danger" onClick={() => reviewEvent(event, "REJECT")}>Reject</button></div>}
            </div>)}
          </div></div>
        </section>
      )}

      {activeTab === "achievements" && departmentData && (
        <section className="row g-3">
          {canManage && <div className="col-xl-4"><div className="department-card department-sticky sticky-lg-top"><div className="department-card-header"><h5>Add Achievement / Result</h5></div><div className="row g-2">
            <div className="col-12"><input className="form-control" placeholder="Achievement title" value={achievementForm.title} onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })} /></div>
            <div className="col-6"><input type="date" className="form-control" value={achievementForm.achievement_date} onChange={(e) => setAchievementForm({ ...achievementForm, achievement_date: e.target.value })} /></div>
            <div className="col-6"><input className="form-control" placeholder="Session" value={achievementForm.academic_session} onChange={(e) => setAchievementForm({ ...achievementForm, academic_session: e.target.value })} /></div>
            <div className="col-6"><select className="form-select" value={achievementForm.level} onChange={(e) => setAchievementForm({ ...achievementForm, level: e.target.value })}>{["SCHOOL", "CLUSTER", "ZONAL", "DISTRICT", "STATE", "NATIONAL", "INTERNATIONAL", "OTHER"].map((v) => <option key={v}>{v}</option>)}</select></div>
            <div className="col-6"><input className="form-control" placeholder="Position / award" value={achievementForm.position} onChange={(e) => setAchievementForm({ ...achievementForm, position: e.target.value })} /></div>
            <div className="col-12"><select className="form-select" value={achievementForm.student_id} onChange={(e) => setAchievementForm({ ...achievementForm, student_id: e.target.value })}><option value="">Student (optional for team/department achievement)</option>{(bootstrap.students || []).map((student) => <option key={student.id} value={student.id}>{student.name} · {student.admission_number || "No admission no."} · {student.Class?.name || "Class"}-{student.Section?.name || ""}</option>)}</select></div>
            <div className="col-6"><input className="form-control" placeholder="Team name" value={achievementForm.team_name} onChange={(e) => setAchievementForm({ ...achievementForm, team_name: e.target.value })} /></div>
            <div className="col-12"><select className="form-select" value={achievementForm.teacher_incharge_user_id} onChange={(e) => setAchievementForm({ ...achievementForm, teacher_incharge_user_id: e.target.value })}><option value="">Teacher in-charge</option>{bootstrap.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            <div className="col-12"><textarea className="form-control" rows="3" placeholder="Achievement details" value={achievementForm.description} onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })} /></div>
            <div className="col-12"><button className="btn btn-primary w-100" disabled={saving || !achievementForm.title || !achievementForm.achievement_date} onClick={() => createAchievement("SUBMITTED")}>Submit Achievement</button></div>
          </div></div></div>}
          <div className={canManage ? "col-xl-8" : "col-12"}><div className="department-card"><div className="department-card-header"><h5>Department Achievements</h5></div>
            {(departmentData.achievements || []).length === 0 ? <EmptyState text="No achievement recorded" /> : (departmentData.achievements || []).map((achievement) => <div className="department-achievement" key={achievement.id}><div className="department-trophy"><i className="bi bi-trophy-fill" /></div><div className="flex-grow-1"><div className="d-flex justify-content-between"><div><h5 className="mb-1">{achievement.title}</h5><div className="small text-muted">{achievement.level} · {achievement.position || "Achievement"} · {fmtDate(achievement.achievement_date)}</div></div><span className={`badge text-bg-${statusBadge(achievement.status)}`}>{achievement.status}</span></div><p className="mb-1 mt-2">{achievement.description}</p><div className="small">{achievement.student ? `Student: ${achievement.student.name}` : achievement.team_name ? `Team: ${achievement.team_name}` : "Department achievement"}</div>{canApprove && achievement.status === "SUBMITTED" && <div className="d-flex gap-2 mt-2"><button className="btn btn-sm btn-success" onClick={() => reviewAchievement(achievement, "VERIFIED")}>Verify</button><button className="btn btn-sm btn-outline-primary" onClick={() => reviewAchievement(achievement, "PUBLISHED")}>Publish to Student/Website</button></div>}</div></div>)}
          </div></div>
        </section>
      )}

      {activeTab === "academics" && academicData && (
        <section>
          <div className="row g-3 mb-3">
            <MetricCard icon="bi-people" label="Department Teachers" value={academicData.summary?.teachers} />
            <MetricCard icon="bi-journal-text" label="Lesson Plans" value={academicData.summary?.lesson_plans} tone="primary" />
            <MetricCard icon="bi-check2-circle" label="Completed Plans" value={academicData.summary?.completed_lesson_plans} tone="success" />
            <MetricCard icon="bi-diagram-3" label="Syllabus Breakups" value={academicData.summary?.syllabus_breakups} tone="info" />
            <MetricCard icon="bi-patch-check" label="Approved Breakups" value={academicData.summary?.approved_syllabus_breakups} tone="success" />
            <MetricCard icon="bi-journal-bookmark" label="Diary Entries" value={academicData.summary?.diaries} tone="warning" />
          </div>
          <div className="department-card mb-3"><div className="department-card-header"><h5>Teacher-wise Academic Overview</h5></div>{(academicData.teachers || []).length === 0 ? <EmptyState text="Map subjects to department and assign syllabus teachers first" /> : <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Teacher</th><th>Assigned Class / Subjects</th><th>Lesson Plans</th><th>Completed</th><th>Syllabus Breakups</th><th>Diaries</th></tr></thead><tbody>{academicData.teachers.map((teacher) => <tr key={teacher.id}><td><strong>{teacher.name}</strong><div className="small text-muted">{teacher.username}</div></td><td>{teacher.assignments.map((a, index) => <span className="badge text-bg-light border me-1 mb-1" key={`${teacher.id}-${index}`}>{a.class?.name} · {a.subject?.name}</span>)}</td><td>{teacher.lesson_plans}</td><td>{teacher.completed_lesson_plans}</td><td>{teacher.syllabus_breakups}</td><td>{teacher.diaries}</td></tr>)}</tbody></table></div>}</div>
          <div className="row g-3">
            <div className="col-xl-6"><div className="department-card h-100"><div className="department-card-header"><h5>Recent Lesson Plans</h5></div>{(academicData.lesson_plans || []).slice(0, 12).map((plan) => <div className="department-list-row" key={plan.id}><div><strong>{plan.topic}</strong><div className="small text-muted">{plan.Teacher?.name} · {plan.Class?.name} · {plan.Subject?.name}</div><div className="small">{fmtDate(plan.startDate)}–{fmtDate(plan.endDate)}</div></div><span className={`badge text-bg-${statusBadge(plan.completionStatus || plan.status)}`}>{plan.completionStatus || plan.status}</span></div>)}</div></div>
            <div className="col-xl-6"><div className="department-card h-100"><div className="department-card-header"><h5>Recent Diary Entries</h5></div>{(academicData.diaries || []).slice(0, 12).map((diary) => <div className="department-list-row" key={diary.id}><div><strong>{diary.title}</strong><div className="small text-muted">{diary.createdBy?.name} · {diary.class?.name}-{diary.section?.name} · {diary.subject?.name || "General"}</div></div><span className="small text-nowrap">{fmtDate(diary.date)}</span></div>)}</div></div>
          </div>
        </section>
      )}

      {activeTab === "annual-report" && (
        <section className="annual-report-wrap">
          <div className="department-card no-print mb-3"><div className="department-card-header"><h5>One-Minute Annual Report</h5></div><div className="row g-2 align-items-end"><div className="col-md-5"><label className="form-label">Academic Session</label><input className="form-control" placeholder="e.g. 2026-27 (blank = all)" value={annualSession} onChange={(e) => setAnnualSession(e.target.value)} /></div><div className="col-md-4"><label className="form-label">Department</label><input className="form-control" value={selectedDepartment?.name || ""} disabled /></div><div className="col-md-3 d-grid"><button className="btn btn-primary" onClick={generateAnnualReport}><i className="bi bi-magic" /> Generate Report</button></div></div></div>
          {!annualReport ? <EmptyState text="Select session and generate the report" /> : <div id="department-annual-report" className="annual-report-paper">
            <div className="annual-report-cover"><div className="annual-report-school">SCHOOL ANNUAL REPORT</div><h1>{selectedDepartment?.name}</h1><h3>{annualReport.academic_session || "All Sessions"}</h3><div>Generated on {fmtDateTime(annualReport.generated_at)}</div><button className="btn btn-dark mt-4 no-print" onClick={printAnnualReport}><i className="bi bi-printer" /> Print / Save PDF</button></div>
            {(annualReport.departments || []).map((entry) => <article key={entry.department.id} className="annual-report-section"><h2>{entry.department.name}</h2><p>{entry.department.description}</p><div className="annual-report-stats"><span>Events <strong>{entry.summary.events}</strong></span><span>Achievements <strong>{entry.summary.achievements}</strong></span><span>Student Participations <strong>{entry.summary.student_participations}</strong></span><span>Teacher Duties <strong>{entry.summary.teacher_duties}</strong></span><span>Inventory Items <strong>{entry.summary.inventory_items}</strong></span></div>
              <h4>Activities, Events & Competitions</h4>{entry.events.length === 0 ? <p>No approved event recorded.</p> : entry.events.map((event) => <div className="annual-report-entry" key={event.id}><h5>{event.title}</h5><div>{fmtDate(event.start_date)} · {event.venue || "School Campus"}</div><p>{event.description || event.public_description}</p>{event.result_summary && <p><strong>Result:</strong> {event.result_summary}</p>}</div>)}
              <h4>Achievements</h4>{entry.achievements.length === 0 ? <p>No verified achievement recorded.</p> : entry.achievements.map((achievement) => <div className="annual-report-entry" key={achievement.id}><h5>{achievement.title}</h5><div>{achievement.level} · {achievement.position || "Achievement"} · {fmtDate(achievement.achievement_date)}</div><p>{achievement.description}</p>{achievement.student && <p><strong>Student:</strong> {achievement.student.name} ({achievement.student.admission_number})</p>}</div>)}
            </article>)}
          </div>}
        </section>
      )}
    </div>
  );
}
