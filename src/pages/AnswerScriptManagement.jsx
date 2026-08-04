import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";

const listFrom = (response, key) => response?.data?.[key] || response?.data || [];
const number = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const titleCase = (value) =>
  String(value || "-")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const classSection = (item) => {
  const className = item?.class?.class_name || item?.schedule?.class?.class_name || "Class";
  const section = item?.section?.section_name || item?.schedule?.section?.section_name || "";
  return `${className}${section ? ` ${section}` : ""}`;
};
const subjectName = (item) => item?.subject?.name || item?.schedule?.subject?.name || "-";
const roomName = (collection) => {
  const room = collection?.planRoom?.room;
  if (!room) return "Room";
  return room.name && room.name !== room.room_code
    ? `${room.room_code} - ${room.name}`
    : room.room_code || room.name;
};
const activeAssignment = (bundle) =>
  [...(bundle?.assignments || [])]
    .sort((a, b) => new Date(b.issued_at || b.createdAt) - new Date(a.issued_at || a.createdAt))
    .find((item) => ["assigned", "accepted", "checking", "completed"].includes(item.status));

const dispositionFilename = (value, fallback) => {
  const text = String(value || "");
  const utf8 = text.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].replace(/["']/g, ""));
    } catch (_) {
      return utf8[1].replace(/["']/g, "");
    }
  }
  const normal = text.match(/filename="?([^";]+)"?/i);
  return normal?.[1]?.trim() || fallback;
};

const blobMessage = async (error, fallback) => {
  const payload = error?.response?.data;
  if (!(payload instanceof Blob)) return error?.response?.data?.message || error?.message || fallback;
  try {
    const parsed = JSON.parse(await payload.text());
    return parsed?.message || fallback;
  } catch (_) {
    return fallback;
  }
};

const StatusBadge = ({ value }) => {
  const normalized = String(value || "").toLowerCase();
  const color = ["ready", "received", "reconciled", "sorted", "returned", "finalized", "completed", "checked", "matched"].includes(normalized)
    ? "success"
    : ["count_mismatch", "mismatch", "declined", "overdue", "rejected"].includes(normalized)
      ? "danger"
      : ["issued", "checking", "rechecking", "under_checking", "accepted", "approved"].includes(normalized)
        ? "primary"
        : ["pending", "assigned", "requested", "draft", "collected"].includes(normalized)
          ? "warning"
          : "secondary";
  return <span className={`badge text-bg-${color}`}>{titleCase(value)}</span>;
};

const Modal = ({ title, children, onClose, footer }) => (
  <div className="answer-script-modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className="answer-script-modal card shadow-lg" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">{title}</h5>
        <button className="btn-close" onClick={onClose} aria-label="Close" />
      </div>
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer d-flex justify-content-end gap-2">{footer}</div>}
    </div>
  </div>
);

export default function AnswerScriptManagement() {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [collections, setCollections] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [rechecks, setRechecks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState("collections");
  const [busy, setBusy] = useState(false);
  const [collectionEdit, setCollectionEdit] = useState(null);
  const [bundleEdit, setBundleEdit] = useState(null);
  const [issueForm, setIssueForm] = useState(null);
  const [recheckForm, setRecheckForm] = useState(null);
  const [recheckStudents, setRecheckStudents] = useState([]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => String(plan.id) === String(selectedPlanId)) || null,
    [plans, selectedPlanId]
  );

  const summary = dashboard?.summary || {};
  const completedRooms = collections.filter((item) => ["received", "reconciled", "sorted"].includes(item.status)).length;
  const mismatchedRooms = collections.filter((item) => item.status === "count_mismatch").length;

  const loadBase = async () => {
    try {
      const [planResponse, employeeResponse] = await Promise.all([
        api.get("/answer-scripts/plans"),
        api.get("/exam-seating/employees"),
      ]);
      const loadedPlans = listFrom(planResponse, "plans");
      setPlans(loadedPlans);
      setEmployees(listFrom(employeeResponse, "employees"));
      setSelectedPlanId((current) => current || (loadedPlans[0]?.id ? String(loadedPlans[0].id) : ""));
    } catch (error) {
      console.error(error);
      Swal.fire("Unable to load", error?.response?.data?.message || "Could not load answer-script module", "error");
    }
  };

  const loadPlanData = async (planId, quiet = false) => {
    if (!planId) return;
    if (!quiet) setBusy(true);
    try {
      const [dashboardResponse, collectionResponse, bundleResponse, assignmentResponse, recheckResponse] = await Promise.all([
        api.get(`/answer-scripts/plans/${planId}/dashboard`),
        api.get("/answer-scripts/room-collections", { params: { plan_id: planId } }),
        api.get("/answer-scripts/bundles", { params: { plan_id: planId } }),
        api.get("/answer-scripts/assignments", { params: { plan_id: planId } }),
        api.get("/answer-scripts/recheck-requests", { params: { plan_id: planId } }),
      ]);
      setDashboard(dashboardResponse.data);
      setCollections(listFrom(collectionResponse, "collections"));
      setBundles(listFrom(bundleResponse, "bundles"));
      setAssignments(listFrom(assignmentResponse, "assignments"));
      setRechecks(listFrom(recheckResponse, "requests"));
    } catch (error) {
      console.error(error);
      if (!quiet) Swal.fire("Unable to load", error?.response?.data?.message || "Could not load answer-script records", "error");
    } finally {
      if (!quiet) setBusy(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (selectedPlanId) loadPlanData(selectedPlanId);
  }, [selectedPlanId]);

  const runAction = async ({ title, text, request, success }) => {
    const confirmation = await Swal.fire({
      title,
      text,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Continue",
    });
    if (!confirmation.isConfirmed) return;
    setBusy(true);
    try {
      const response = await request();
      await loadPlanData(selectedPlanId, true);
      Swal.fire("Done", response?.data?.message || success || "Updated successfully", "success");
    } catch (error) {
      Swal.fire("Could not complete", error?.response?.data?.message || error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const generateCollections = () => runAction({
    title: "Generate room collection records?",
    text: "Present and late students will be counted as expected answer scripts for each room.",
    request: () => api.post(`/answer-scripts/plans/${selectedPlanId}/generate-room-collections`),
  });

  const createBundles = () => runAction({
    title: "Create class/section bundles?",
    text: "Received room collections will be sorted into class, section and subject-wise bundles.",
    request: () => api.post(`/answer-scripts/plans/${selectedPlanId}/auto-create-bundles`),
  });

  const downloadPdf = async (url, fallback) => {
    setBusy(true);
    try {
      const response = await api.get(url, { responseType: "blob" });
      const filename = dispositionFilename(response.headers?.["content-disposition"], fallback);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(response.data);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      Swal.fire("PDF download failed", await blobMessage(error, "Could not download PDF"), "error");
    } finally {
      setBusy(false);
    }
  };

  const openCollection = (collection) => {
    setCollectionEdit({
      ...collection,
      collected_count: number(collection.collected_count),
      damaged_count: number(collection.damaged_count),
      extra_sheet_count: number(collection.extra_sheet_count),
      invigilator_remarks: collection.invigilator_remarks || "",
      department_remarks: collection.department_remarks || "",
      groups: (collection.groups || []).map((group) => ({
        ...group,
        collected_count: number(group.collected_count),
        remarks: group.remarks || "",
      })),
    });
  };

  const updateCollectionField = (field, value) => {
    setCollectionEdit((current) => ({ ...current, [field]: value }));
  };
  const updateCollectionGroup = (groupId, field, value) => {
    setCollectionEdit((current) => ({
      ...current,
      groups: current.groups.map((group) => String(group.id) === String(groupId) ? { ...group, [field]: value } : group),
    }));
  };

  const saveCollection = async (mode = "save") => {
    if (!collectionEdit) return;
    setBusy(true);
    try {
      const payload = {
        collected_count: number(collectionEdit.collected_count),
        damaged_count: number(collectionEdit.damaged_count),
        extra_sheet_count: number(collectionEdit.extra_sheet_count),
        invigilator_remarks: collectionEdit.invigilator_remarks,
        department_remarks: collectionEdit.department_remarks,
        groups: collectionEdit.groups.map((group) => ({
          id: group.id,
          collected_count: number(group.collected_count),
          remarks: group.remarks,
        })),
      };
      let response;
      if (mode === "receive") {
        await api.put(`/answer-scripts/room-collections/${collectionEdit.id}`, payload);
        response = await api.post(`/answer-scripts/room-collections/${collectionEdit.id}/receive`, {
          remarks: collectionEdit.department_remarks,
        });
      } else if (mode === "reconcile") {
        response = await api.post(`/answer-scripts/room-collections/${collectionEdit.id}/reconcile`, payload);
      } else {
        response = await api.put(`/answer-scripts/room-collections/${collectionEdit.id}`, payload);
      }
      setCollectionEdit(null);
      await loadPlanData(selectedPlanId, true);
      Swal.fire("Saved", response.data?.message || "Room collection updated", "success");
    } catch (error) {
      Swal.fire("Could not save", error?.response?.data?.message || error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const openBundle = (bundle) => {
    setBundleEdit({
      ...bundle,
      script_count: number(bundle.script_count),
      checked_count: number(bundle.checked_count),
      public_status: bundle.public_status || "hidden",
      evaluator_instructions: bundle.evaluator_instructions || "",
      internal_remarks: bundle.internal_remarks || "",
    });
  };

  const saveBundle = async () => {
    if (!bundleEdit) return;
    setBusy(true);
    try {
      const response = await api.put(`/answer-scripts/bundles/${bundleEdit.id}`, {
        script_count: number(bundleEdit.script_count),
        checked_count: number(bundleEdit.checked_count),
        public_status: bundleEdit.public_status,
        evaluator_instructions: bundleEdit.evaluator_instructions,
        internal_remarks: bundleEdit.internal_remarks,
      });
      setBundleEdit(null);
      await loadPlanData(selectedPlanId, true);
      Swal.fire("Saved", response.data?.message || "Bundle updated", "success");
    } catch (error) {
      Swal.fire("Could not save", error?.response?.data?.message || error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const openIssue = (bundle, assignmentType = "evaluation") => {
    setIssueForm({
      bundle,
      employee_id: "",
      assignment_type: assignmentType,
      due_at: "",
      department_remarks: "",
      public_status: assignmentType === "rechecking" ? "rechecking" : "under_checking",
    });
  };

  const issueBundle = async () => {
    if (!issueForm?.employee_id) {
      Swal.fire("Select evaluator", "Please select an enabled employee.", "info");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post(`/answer-scripts/bundles/${issueForm.bundle.id}/issue`, {
        employee_id: Number(issueForm.employee_id),
        assignment_type: issueForm.assignment_type,
        due_at: issueForm.due_at || null,
        department_remarks: issueForm.department_remarks,
        public_status: issueForm.public_status,
      });
      setIssueForm(null);
      await loadPlanData(selectedPlanId, true);
      Swal.fire("Issued", response.data?.message || "Bundle issued", "success");
    } catch (error) {
      Swal.fire("Could not issue", error?.response?.data?.message || error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const receiveReturned = (assignment) => runAction({
    title: "Receive returned bundle?",
    text: `${assignment.bundle?.bundle_number || "Bundle"} will be acknowledged as received by the Examination Department.`,
    request: () => api.post(`/answer-scripts/assignments/${assignment.id}/receive-return`),
  });

  const finalizeBundle = (bundle) => runAction({
    title: "Finalize this bundle?",
    text: "Ensure checking, return and all rechecking records are complete.",
    request: () => api.post(`/answer-scripts/bundles/${bundle.id}/finalize`),
  });

  const archiveBundle = (bundle) => runAction({
    title: "Archive this bundle?",
    text: "The finalized answer-script record will remain available in history and PDF reports.",
    request: () => api.post(`/answer-scripts/bundles/${bundle.id}/archive`),
  });

  const openRecheck = async (bundle) => {
    setBusy(true);
    try {
      const response = await api.get(`/answer-scripts/bundles/${bundle.id}/students`);
      setRecheckStudents(listFrom(response, "students"));
      setRecheckForm({
        bundle,
        student_id: "",
        reason: "",
        old_marks: "",
        student_visible_remark: "Rechecking request received.",
        internal_remark: "",
      });
    } catch (error) {
      Swal.fire("Unable to load students", error?.response?.data?.message || error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const createRecheck = async () => {
    if (!recheckForm?.student_id) {
      Swal.fire("Select student", "Please select a student for rechecking.", "info");
      return;
    }
    setBusy(true);
    try {
      const response = await api.post(`/answer-scripts/bundles/${recheckForm.bundle.id}/recheck-requests`, {
        student_id: Number(recheckForm.student_id),
        reason: recheckForm.reason,
        old_marks: recheckForm.old_marks || null,
        student_visible_remark: recheckForm.student_visible_remark,
        internal_remark: recheckForm.internal_remark,
      });
      setRecheckForm(null);
      await loadPlanData(selectedPlanId, true);
      Swal.fire("Created", response.data?.message || "Rechecking request created", "success");
    } catch (error) {
      Swal.fire("Could not create", error?.response?.data?.message || error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const recheckAction = async (request, action) => {
    const payload = { action };
    if (action === "complete") {
      const result = await Swal.fire({
        title: "Complete rechecking",
        input: "number",
        inputLabel: "Revised marks (optional)",
        inputAttributes: { step: "0.01", min: "0" },
        showCancelButton: true,
        confirmButtonText: "Complete",
      });
      if (!result.isConfirmed) return;
      payload.revised_marks = result.value || null;
      payload.student_visible_remark = "Rechecking completed and record updated.";
    } else {
      const confirmation = await Swal.fire({
        title: `${titleCase(action)} rechecking request?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: titleCase(action),
      });
      if (!confirmation.isConfirmed) return;
    }
    setBusy(true);
    try {
      const response = await api.post(`/answer-scripts/recheck-requests/${request.id}/action`, payload);
      await loadPlanData(selectedPlanId, true);
      Swal.fire("Updated", response.data?.message || "Rechecking request updated", "success");
    } catch (error) {
      Swal.fire("Could not update", error?.response?.data?.message || error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-fluid py-3 answer-script-page">
      <style>{`
        .answer-script-page .summary-card { min-height: 92px; }
        .answer-script-page .summary-value { font-size: 1.55rem; font-weight: 800; }
        .answer-script-page .table > :not(caption) > * > * { vertical-align: middle; }
        .answer-script-page .sticky-toolbar { position: sticky; top: 0; z-index: 10; background: #f8f9fa; padding: .5rem 0; }
        .answer-script-page .small-actions .btn { margin: 2px; }
        .answer-script-modal-backdrop { position: fixed; inset: 0; z-index: 1060; background: rgba(15,23,42,.55); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .answer-script-modal { width: min(980px, 100%); max-height: 92vh; overflow: hidden; }
        .answer-script-modal .card-body { overflow-y: auto; }
        .answer-script-page .source-room-list { max-height: 90px; overflow-y: auto; }
        @media (max-width: 767px) { .answer-script-page .sticky-toolbar { position: static; } }
      `}</style>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div>
          <h3 className="mb-1">Answer Script & Bundle Management</h3>
          <div className="text-muted">Room collection → reconciliation → class/section bundles → evaluation → rechecking</div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-outline-primary" disabled={!selectedPlanId || busy} onClick={generateCollections}>
            <i className="bi bi-box-arrow-in-down me-1" /> Generate Room Collections
          </button>
          <button className="btn btn-primary" disabled={!selectedPlanId || busy || !collections.length} onClick={createBundles}>
            <i className="bi bi-boxes me-1" /> Create Class/Section Bundles
          </button>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-lg-7">
              <label className="form-label fw-semibold">Examination seating plan</label>
              <select className="form-select" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                <option value="">Select examination plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.exam?.name || plan.name} — {formatDate(plan.exam_date)} — {String(plan.start_time || "").slice(0, 5)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-5">
              <div className="dropdown">
                <button className="btn btn-outline-dark dropdown-toggle w-100" data-bs-toggle="dropdown" disabled={!selectedPlanId || busy}>
                  <i className="bi bi-file-earmark-pdf me-1" /> Download Professional Landscape PDF
                </button>
                <ul className="dropdown-menu w-100">
                  {[
                    ["full-register", "Complete Answer-Script Register"],
                    ["room-collections", "Room Collection Register"],
                    ["bundles", "Bundle Register"],
                    ["evaluator-issues", "Evaluator Issue / Return Register"],
                    ["rechecks", "Rechecking Register"],
                  ].map(([report, label]) => (
                    <li key={report}>
                      <button className="dropdown-item" onClick={() => downloadPdf(`/answer-scripts/reports/pdf?plan_id=${selectedPlanId}&report=${report}`, `${report}.pdf`)}>
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          {selectedPlan && (
            <div className="small text-muted mt-2">
              {selectedPlan.session?.name || "Session"} · {selectedPlan.name} · Seating status: <StatusBadge value={selectedPlan.status} />
            </div>
          )}
        </div>
      </div>

      {selectedPlanId && (
        <>
          <div className="row g-2 mb-3">
            {[
              ["Room Collections", summary.rooms ?? collections.length, `${completedRooms} received`],
              ["Expected Scripts", summary.expected_scripts ?? 0, `${summary.collected_scripts ?? 0} collected`],
              ["Count Mismatches", summary.room_mismatches ?? mismatchedRooms, "Needs reconciliation"],
              ["Bundles", summary.bundles ?? bundles.length, `${summary.ready_bundles ?? 0} ready`],
              ["Issued / Checking", summary.issued_bundles ?? 0, `${summary.overdue_assignments ?? 0} overdue`],
              ["Pending Rechecks", summary.pending_rechecks ?? 0, `${summary.checked_bundles ?? 0} checked bundles`],
            ].map(([label, value, note]) => (
              <div className="col-6 col-lg-2" key={label}>
                <div className="card shadow-sm summary-card">
                  <div className="card-body p-2 text-center">
                    <div className="small text-muted">{label}</div>
                    <div className="summary-value">{value}</div>
                    <div className="small text-muted">{note}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="sticky-toolbar">
            <ul className="nav nav-pills gap-2">
              {[
                ["collections", "Room Collections", collections.length],
                ["bundles", "Class/Section Bundles", bundles.length],
                ["assignments", "Evaluator Issue Register", assignments.length],
                ["rechecks", "Rechecking", rechecks.length],
              ].map(([key, label, count]) => (
                <li className="nav-item" key={key}>
                  <button className={`nav-link ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                    {label} <span className="badge text-bg-light ms-1">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {tab === "collections" && (
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Room-wise Collection & Reconciliation</strong>
                <span className="small text-muted">Expected count is based on Present + Late attendance</span>
              </div>
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Room</th><th className="text-center">Expected</th><th className="text-center">Collected</th>
                      <th className="text-center">Missing</th><th>Handed Over</th><th>Received</th><th>Status</th><th>Class/Section Break-up</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!collections.length && <tr><td colSpan="9" className="text-center py-4 text-muted">Generate room collection records after invigilators complete attendance.</td></tr>}
                    {collections.map((collection) => (
                      <tr key={collection.id}>
                        <td><strong>{roomName(collection)}</strong><div className="small text-muted">Record #{collection.id}</div></td>
                        <td className="text-center">{collection.expected_count}</td>
                        <td className="text-center">{collection.collected_count}</td>
                        <td className={`text-center ${Number(collection.missing_count) ? "text-danger fw-bold" : ""}`}>{collection.missing_count}</td>
                        <td>{collection.handedOverBy?.name || "Pending"}<div className="small text-muted">{formatDateTime(collection.handed_over_at)}</div></td>
                        <td>{collection.receivedBy?.name || "Pending"}<div className="small text-muted">{formatDateTime(collection.received_at)}</div></td>
                        <td><StatusBadge value={collection.status} /></td>
                        <td>
                          {(collection.groups || []).map((group) => (
                            <div className="small" key={group.id}>
                              {classSection(group)} · {subjectName(group)}: <strong>{group.collected_count}/{group.expected_count}</strong>
                            </div>
                          ))}
                        </td>
                        <td className="small-actions text-nowrap">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => openCollection(collection)}>Open</button>
                          <button className="btn btn-sm btn-outline-dark" onClick={() => downloadPdf(`/answer-scripts/room-collections/${collection.id}/pdf`, `room-collection-${collection.id}.pdf`)}>PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "bundles" && (
            <div className="card shadow-sm">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Class / Section / Subject-wise Bundles</strong>
                <span className="small text-muted">One bundle may contain scripts collected from multiple rooms</span>
              </div>
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Bundle</th><th>Class / Section</th><th>Subject</th><th className="text-center">Scripts</th>
                      <th className="text-center">Checked</th><th>Source Rooms</th><th>Current Holder</th><th>Status</th><th>Student App</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!bundles.length && <tr><td colSpan="10" className="text-center py-4 text-muted">Receive and reconcile room collections, then create bundles.</td></tr>}
                    {bundles.map((bundle) => {
                      const assignment = activeAssignment(bundle);
                      return (
                        <tr key={bundle.id}>
                          <td><strong>{bundle.bundle_number}</strong><div className="small text-muted">Record #{bundle.id}</div></td>
                          <td>{classSection(bundle)}</td>
                          <td>{subjectName(bundle)}</td>
                          <td className="text-center">{bundle.script_count}<div className="small text-muted">Expected {bundle.expected_count}</div></td>
                          <td className="text-center">{bundle.checked_count}</td>
                          <td><div className="source-room-list">{(bundle.sources || []).map((source) => <div className="small" key={source.id}>{roomName(source.collectionGroup)} — {source.script_count}</div>)}</div></td>
                          <td>{bundle.currentHolder?.name || "Examination Department"}{assignment?.due_at && <div className="small text-muted">Due {formatDate(assignment.due_at)}</div>}</td>
                          <td><StatusBadge value={bundle.status} /></td>
                          <td><StatusBadge value={bundle.public_status} /></td>
                          <td className="small-actions text-nowrap">
                            <button className="btn btn-sm btn-outline-primary" onClick={() => openBundle(bundle)}>Open</button>
                            {!assignment && ["ready", "returned", "checked", "finalized"].includes(bundle.status) && <button className="btn btn-sm btn-primary" onClick={() => openIssue(bundle)}>Issue</button>}
                            <button className="btn btn-sm btn-outline-dark" onClick={() => downloadPdf(`/answer-scripts/bundles/${bundle.id}/pdf`, `${bundle.bundle_number}.pdf`)}>PDF</button>
                            <button className="btn btn-sm btn-outline-warning" onClick={() => openRecheck(bundle)}>Recheck</button>
                            {["checked", "returned", "rechecking"].includes(bundle.status) && <button className="btn btn-sm btn-success" onClick={() => finalizeBundle(bundle)}>Finalize</button>}
                            {bundle.status === "finalized" && <button className="btn btn-sm btn-secondary" onClick={() => archiveBundle(bundle)}>Archive</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "assignments" && (
            <div className="card shadow-sm">
              <div className="card-header"><strong>Evaluator Issue, Checking Progress & Return Register</strong></div>
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-light">
                    <tr><th>Bundle</th><th>Evaluator</th><th>Type</th><th>Issued</th><th>Due</th><th>Progress</th><th>Status</th><th>Returned</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {!assignments.length && <tr><td colSpan="9" className="text-center py-4 text-muted">No bundles have been issued for evaluation.</td></tr>}
                    {assignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td><strong>{assignment.bundle?.bundle_number}</strong><div className="small text-muted">{classSection(assignment.bundle)} · {subjectName(assignment.bundle)}</div></td>
                        <td>{assignment.evaluator?.name}<div className="small text-muted">{assignment.evaluator?.designation}</div></td>
                        <td>{titleCase(assignment.assignment_type)}</td>
                        <td>{formatDateTime(assignment.issued_at)}</td>
                        <td className={assignment.due_at && new Date(assignment.due_at) < new Date() && !["returned", "cancelled"].includes(assignment.status) ? "text-danger fw-bold" : ""}>{formatDateTime(assignment.due_at)}</td>
                        <td>{assignment.checked_count}/{assignment.bundle?.script_count || 0}</td>
                        <td><StatusBadge value={assignment.status} /></td>
                        <td>{formatDateTime(assignment.returned_at)}{assignment.receivedBy && <div className="small text-muted">Received by {assignment.receivedBy.name || assignment.receivedBy.username}</div>}</td>
                        <td className="small-actions text-nowrap">
                          {assignment.status === "returned" && !assignment.received_by_user_id && <button className="btn btn-sm btn-success" onClick={() => receiveReturned(assignment)}>Receive</button>}
                          <button className="btn btn-sm btn-outline-dark" onClick={() => downloadPdf(`/answer-scripts/assignments/${assignment.id}/pdf`, `evaluator-issue-${assignment.id}.pdf`)}>PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "rechecks" && (
            <div className="card shadow-sm">
              <div className="card-header"><strong>Student-wise Rechecking Register</strong></div>
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead className="table-light"><tr><th>Student</th><th>Bundle / Subject</th><th>Reason</th><th>Marks</th><th>Status</th><th>Student-visible Remark</th><th>Actions</th></tr></thead>
                  <tbody>
                    {!rechecks.length && <tr><td colSpan="7" className="text-center py-4 text-muted">No rechecking requests created.</td></tr>}
                    {rechecks.map((request) => (
                      <tr key={request.id}>
                        <td><strong>{request.student?.name}</strong><div className="small text-muted">{request.student?.admission_number}</div></td>
                        <td>{request.bundle?.bundle_number}<div className="small text-muted">{classSection(request.bundle)} · {subjectName(request.bundle)}</div></td>
                        <td>{request.reason || "-"}</td>
                        <td>{request.old_marks ?? "-"} → {request.revised_marks ?? "-"}</td>
                        <td><StatusBadge value={request.status} /></td>
                        <td>{request.student_visible_remark || "-"}</td>
                        <td className="small-actions text-nowrap">
                          {request.status === "requested" && <button className="btn btn-sm btn-success" onClick={() => recheckAction(request, "approve")}>Approve</button>}
                          {request.status === "requested" && <button className="btn btn-sm btn-outline-danger" onClick={() => recheckAction(request, "reject")}>Reject</button>}
                          {["approved", "issued", "in_progress"].includes(request.status) && <button className="btn btn-sm btn-primary" onClick={() => recheckAction(request, "complete")}>Complete</button>}
                          {request.status === "completed" && <button className="btn btn-sm btn-secondary" onClick={() => recheckAction(request, "close")}>Close</button>}
                          <button className="btn btn-sm btn-outline-dark" onClick={() => downloadPdf(`/answer-scripts/recheck-requests/${request.id}/pdf`, `recheck-${request.id}.pdf`)}>PDF</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {collectionEdit && (
        <Modal
          title={`${roomName(collectionEdit)} — Answer Script Collection`}
          onClose={() => setCollectionEdit(null)}
          footer={<>
            <button className="btn btn-outline-secondary" onClick={() => setCollectionEdit(null)}>Cancel</button>
            <button className="btn btn-outline-primary" disabled={busy} onClick={() => saveCollection("save")}>Save Counts</button>
            {!collectionEdit.received_at && <button className="btn btn-success" disabled={busy} onClick={() => saveCollection("receive")}>Receive Collection</button>}
            {collectionEdit.received_at && <button className="btn btn-primary" disabled={busy} onClick={() => saveCollection("reconcile")}>Reconcile & Confirm</button>}
          </>}
        >
          <div className="row g-3 mb-3">
            <div className="col-md-3"><label className="form-label">Expected</label><input className="form-control" value={collectionEdit.expected_count} disabled /></div>
            <div className="col-md-3"><label className="form-label">Collected</label><input type="number" min="0" className="form-control" value={collectionEdit.collected_count} onChange={(event) => updateCollectionField("collected_count", event.target.value)} /></div>
            <div className="col-md-3"><label className="form-label">Damaged</label><input type="number" min="0" className="form-control" value={collectionEdit.damaged_count} onChange={(event) => updateCollectionField("damaged_count", event.target.value)} /></div>
            <div className="col-md-3"><label className="form-label">Extra Sheets</label><input type="number" min="0" className="form-control" value={collectionEdit.extra_sheet_count} onChange={(event) => updateCollectionField("extra_sheet_count", event.target.value)} /></div>
          </div>
          <h6>Class / Section / Subject Break-up</h6>
          <div className="table-responsive mb-3">
            <table className="table table-sm table-bordered">
              <thead><tr><th>Class / Section</th><th>Subject</th><th>Expected</th><th style={{ width: 130 }}>Collected</th><th>Difference</th><th>Remark</th></tr></thead>
              <tbody>
                {collectionEdit.groups.map((group) => (
                  <tr key={group.id}>
                    <td>{classSection(group)}</td><td>{subjectName(group)}</td><td>{group.expected_count}</td>
                    <td><input type="number" min="0" className="form-control form-control-sm" value={group.collected_count} onChange={(event) => updateCollectionGroup(group.id, "collected_count", event.target.value)} /></td>
                    <td className={number(group.collected_count) !== number(group.expected_count) ? "text-danger fw-bold" : "text-success"}>{number(group.collected_count) - number(group.expected_count)}</td>
                    <td><input className="form-control form-control-sm" value={group.remarks} onChange={(event) => updateCollectionGroup(group.id, "remarks", event.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label">Invigilator Remark</label><textarea className="form-control" rows="3" value={collectionEdit.invigilator_remarks} onChange={(event) => updateCollectionField("invigilator_remarks", event.target.value)} /></div>
            <div className="col-md-6"><label className="form-label">Examination Department Remark</label><textarea className="form-control" rows="3" value={collectionEdit.department_remarks} onChange={(event) => updateCollectionField("department_remarks", event.target.value)} /></div>
          </div>
        </Modal>
      )}

      {bundleEdit && (
        <Modal
          title={`Bundle ${bundleEdit.bundle_number}`}
          onClose={() => setBundleEdit(null)}
          footer={<><button className="btn btn-outline-secondary" onClick={() => setBundleEdit(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={saveBundle}>Save Bundle</button></>}
        >
          <div className="row g-3">
            <div className="col-md-4"><label className="form-label">Class / Section</label><input className="form-control" value={classSection(bundleEdit)} disabled /></div>
            <div className="col-md-4"><label className="form-label">Subject</label><input className="form-control" value={subjectName(bundleEdit)} disabled /></div>
            <div className="col-md-4"><label className="form-label">Status</label><input className="form-control" value={titleCase(bundleEdit.status)} disabled /></div>
            <div className="col-md-3"><label className="form-label">Expected Scripts</label><input className="form-control" value={bundleEdit.expected_count} disabled /></div>
            <div className="col-md-3"><label className="form-label">Scripts in Bundle</label><input type="number" min="0" className="form-control" value={bundleEdit.script_count} onChange={(event) => setBundleEdit((current) => ({ ...current, script_count: event.target.value }))} /></div>
            <div className="col-md-3"><label className="form-label">Checked Scripts</label><input type="number" min="0" className="form-control" value={bundleEdit.checked_count} onChange={(event) => setBundleEdit((current) => ({ ...current, checked_count: event.target.value }))} /></div>
            <div className="col-md-3"><label className="form-label">Student/Parent App Status</label><select className="form-select" value={bundleEdit.public_status} onChange={(event) => setBundleEdit((current) => ({ ...current, public_status: event.target.value }))}>{["hidden", "received", "under_checking", "checked", "rechecking", "completed"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div>
            <div className="col-md-6"><label className="form-label">Evaluator Instructions</label><textarea className="form-control" rows="4" value={bundleEdit.evaluator_instructions} onChange={(event) => setBundleEdit((current) => ({ ...current, evaluator_instructions: event.target.value }))} /></div>
            <div className="col-md-6"><label className="form-label">Internal Remarks</label><textarea className="form-control" rows="4" value={bundleEdit.internal_remarks} onChange={(event) => setBundleEdit((current) => ({ ...current, internal_remarks: event.target.value }))} /></div>
          </div>
        </Modal>
      )}

      {issueForm && (
        <Modal
          title={`Issue ${issueForm.bundle.bundle_number}`}
          onClose={() => setIssueForm(null)}
          footer={<><button className="btn btn-outline-secondary" onClick={() => setIssueForm(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={issueBundle}>Issue Bundle</button></>}
        >
          <div className="alert alert-light border">{classSection(issueForm.bundle)} · {subjectName(issueForm.bundle)} · <strong>{issueForm.bundle.script_count} scripts</strong></div>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label">Evaluator</label><select className="form-select" value={issueForm.employee_id} onChange={(event) => setIssueForm((current) => ({ ...current, employee_id: event.target.value }))}><option value="">Select evaluator</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.designation || employee.employee_id}</option>)}</select></div>
            <div className="col-md-3"><label className="form-label">Assignment Type</label><select className="form-select" value={issueForm.assignment_type} onChange={(event) => setIssueForm((current) => ({ ...current, assignment_type: event.target.value, public_status: event.target.value === "rechecking" ? "rechecking" : "under_checking" }))}><option value="evaluation">Evaluation</option><option value="rechecking">Rechecking</option></select></div>
            <div className="col-md-3"><label className="form-label">Checking Deadline</label><input type="datetime-local" className="form-control" value={issueForm.due_at} onChange={(event) => setIssueForm((current) => ({ ...current, due_at: event.target.value }))} /></div>
            <div className="col-md-4"><label className="form-label">Student/Parent App Status</label><select className="form-select" value={issueForm.public_status} onChange={(event) => setIssueForm((current) => ({ ...current, public_status: event.target.value }))}>{["hidden", "under_checking", "rechecking"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div>
            <div className="col-md-8"><label className="form-label">Issue Instructions / Remarks</label><textarea className="form-control" rows="3" value={issueForm.department_remarks} onChange={(event) => setIssueForm((current) => ({ ...current, department_remarks: event.target.value }))} /></div>
          </div>
        </Modal>
      )}

      {recheckForm && (
        <Modal
          title={`Create Rechecking Record — ${recheckForm.bundle.bundle_number}`}
          onClose={() => setRecheckForm(null)}
          footer={<><button className="btn btn-outline-secondary" onClick={() => setRecheckForm(null)}>Cancel</button><button className="btn btn-warning" disabled={busy} onClick={createRecheck}>Create Rechecking Request</button></>}
        >
          <div className="row g-3">
            <div className="col-md-8"><label className="form-label">Student</label><select className="form-select" value={recheckForm.student_id} onChange={(event) => setRecheckForm((current) => ({ ...current, student_id: event.target.value }))}><option value="">Select student</option>{recheckStudents.map((student) => <option key={student.id} value={student.id}>{student.roll_number ? `Roll ${student.roll_number} · ` : ""}{student.admission_number} · {student.name}</option>)}</select></div>
            <div className="col-md-4"><label className="form-label">Previous Marks</label><input type="number" step="0.01" min="0" className="form-control" value={recheckForm.old_marks} onChange={(event) => setRecheckForm((current) => ({ ...current, old_marks: event.target.value }))} /></div>
            <div className="col-12"><label className="form-label">Reason</label><textarea className="form-control" rows="3" value={recheckForm.reason} onChange={(event) => setRecheckForm((current) => ({ ...current, reason: event.target.value }))} /></div>
            <div className="col-md-6"><label className="form-label">Student/Parent-visible Remark</label><textarea className="form-control" rows="3" value={recheckForm.student_visible_remark} onChange={(event) => setRecheckForm((current) => ({ ...current, student_visible_remark: event.target.value }))} /></div>
            <div className="col-md-6"><label className="form-label">Confidential Internal Remark</label><textarea className="form-control" rows="3" value={recheckForm.internal_remark} onChange={(event) => setRecheckForm((current) => ({ ...current, internal_remark: event.target.value }))} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
