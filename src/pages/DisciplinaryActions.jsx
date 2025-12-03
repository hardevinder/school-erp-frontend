// src/pages/DisciplinaryActions.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./TransferCertificates.css"; // reuse same styling (optional)

// ---------- roles helper ----------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  const isAdmin = roles.includes("admin");
  const isSuperadmin = roles.includes("superadmin");
  const isCoordinator = roles.includes("academic_coordinator");
  const isPrincipal = roles.includes("principal");
  return {
    roles,
    isAdmin,
    isSuperadmin,
    isCoordinator,
    isPrincipal,
    canManage: isAdmin || isSuperadmin || isCoordinator || isPrincipal,
  };
};

// ---------- small helpers ----------
const esc = (v = "") => String(v).replace(/"/g, "&quot;");

// YYYY-MM-DD
const asYMD = (v) => {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v).slice(0, 10);
  }
};

const toDateInput = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (!s || s.startsWith("0000-00-00")) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const ymdTime = s.match(
    /^(\d{4}-\d{2}-\d{2})[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z)?$/i
  );
  if (ymdTime) return ymdTime[1];

  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
      2,
      "0"
    )}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
};

const toTimeInput = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  //  HH:mm
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  // HH:mm:ss
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return "";
};

// ---- debounce ----
const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// ---- quick search for students (same as Bonafide) ----
async function searchStudentsQuick(query, limit = 10) {
  if (!query?.trim()) return [];
  try {
    const { data } = await api.get("/students/search", {
      params: { q: query.trim(), limit },
    });
    return Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

// ---------- admission lookup (by number OR id) ----------
async function resolveStudentId({ admission_number, student_id }) {
  if (student_id) return Number(student_id);
  if (!admission_number) return null;

  try {
    const r = await api.get(
      `/students/admission/${encodeURIComponent(admission_number)}`
    );
    const data = Array.isArray(r.data) ? r.data[0] : r.data;
    if (data?.id) return Number(data.id);
  } catch {}

  try {
    const r = await api.get(`/students`, { params: { admission_number } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const hit =
      arr.find(
        (s) =>
          String(s.admission_number || "").trim() ===
          String(admission_number).trim()
      ) || arr[0];
    if (hit?.id) return Number(hit.id);
  } catch {}
  return null;
}

/* ==========================================================
   MAIN COMPONENT
========================================================== */

export default function DisciplinaryActions() {
  const { canManage, isSuperadmin } = useMemo(getRoleFlags, []);

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // fetch list
  const fetchList = async (opts = {}) => {
    const params = new URLSearchParams();
    const search = opts.search ?? q;
    const st = opts.status ?? status;
    const cat = opts.category ?? category;
    const sev = opts.severity ?? severity;
    const fd = opts.fromDate ?? fromDate;
    const td = opts.toDate ?? toDate;
    const p = opts.page ?? page;

    if (search) params.set("search", search);
    if (st) params.set("status", st);
    if (cat) params.set("category", cat);
    if (sev) params.set("severity", sev);
    if (fd) params.set("fromDate", fd);
    if (td) params.set("toDate", td);
    params.set("page", p);
    params.set("pageSize", pageSize);

    setLoading(true);
    try {
      const { data } = await api.get(`/discipline?${params.toString()}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPage(Number(data?.page) || 1);
      setTotalPages(Number(data?.totalPages) || 1);
    } catch (err) {
      console.error("fetchList error:", err);
      Swal.fire("Error", "Failed to fetch disciplinary records.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================== CREATE ================== */
  const handleCreate = async () => {
    let chosen = { student_id: "", admission_number: "" };
    let cache = [];

    await Swal.fire({
      title: "New Disciplinary Record",
      width: "880px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <style>
          .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .form-label{font-weight:600;margin-bottom:4px}
          .form-field{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px}
          .hint{font-size:12px;color:#6b7280}
          textarea.form-field{resize:vertical}
        </style>
        <div class="form-grid">
          <div>
            <label class="form-label">Admission No.</label>
            <input id="dc-admno" class="form-field" list="dc-admno-list" placeholder="Type to search...">
            <datalist id="dc-admno-list"></datalist>
            <div class="hint">Type at least 2 characters</div>
          </div>
          <div>
            <label class="form-label">Student Name</label>
            <input id="dc-stuname" class="form-field" list="dc-stuname-list" placeholder="Type to search...">
            <datalist id="dc-stuname-list"></datalist>
            <div class="hint">Type at least 2 characters</div>
          </div>
          <div>
            <label class="form-label">Incident Date</label>
            <input id="dc-date" type="date" class="form-field">
          </div>
          <div>
            <label class="form-label">Incident Time</label>
            <input id="dc-time" type="time" class="form-field">
          </div>
          <div>
            <label class="form-label">Location</label>
            <input id="dc-location" class="form-field" placeholder="e.g., Classroom, Corridor, Bus">
          </div>
          <div>
            <label class="form-label">Category</label>
            <select id="dc-category" class="form-field">
              <option value="behaviour">Behaviour</option>
              <option value="homework">Homework</option>
              <option value="uniform">Uniform</option>
              <option value="transport">Transport</option>
              <option value="bullying">Bullying</option>
              <option value="attendance">Attendance</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="form-label">Severity</label>
            <select id="dc-severity" class="form-field">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label class="form-label">Parent Notified?</label>
            <select id="dc-parent-notified" class="form-field">
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          <div>
            <label class="form-label">Parent Notification Mode</label>
            <select id="dc-parent-mode" class="form-field">
              <option value="none">None</option>
              <option value="note_in_diary">Note in Diary</option>
              <option value="sms">SMS</option>
              <option value="call">Call</option>
              <option value="meeting">Meeting</option>
              <option value="app_notification">App Notification</option>
              <option value="email">Email</option>
              <option value="multiple">Multiple</option>
            </select>
          </div>
          <div>
            <label class="form-label">Parent Meeting Date</label>
            <input id="dc-meeting-date" type="date" class="form-field">
          </div>
          <div class="full">
            <label class="form-label">Description of Incident</label>
            <textarea id="dc-description" class="form-field" rows="3" placeholder="Describe what happened..."></textarea>
          </div>
          <div class="full">
            <label class="form-label">Remarks (internal)</label>
            <textarea id="dc-remarks" class="form-field" rows="2" placeholder="Optional remarks for internal use"></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Create Record",
      didOpen: () => {
        const popup = Swal.getPopup();
        const $adm = popup.querySelector("#dc-admno");
        const $admList = popup.querySelector("#dc-admno-list");
        const $name = popup.querySelector("#dc-stuname");
        const $nameList = popup.querySelector("#dc-stuname-list");

        const renderList = (elList, results, as = "admission") => {
          cache = results;
          elList.innerHTML = results
            .map((r) => {
              const text =
                as === "admission"
                  ? `${r.admission_number || ""} — ${r.name || ""}`
                  : `${r.name || ""} — ${r.admission_number || ""}`;
              return `<option value="${esc(text)}"></option>`;
            })
            .join("");
        };

        const onPick = (inputEl, as = "admission") => {
          const v = (inputEl.value || "").trim().toLowerCase();
          const hit =
            cache.find((r) => {
              const label =
                as === "admission"
                  ? `${r.admission_number || ""} — ${r.name || ""}`
                  : `${r.name || ""} — ${r.admission_number || ""}`;
              return label.toLowerCase() === v;
            }) || null;

          if (hit?.id) {
            chosen.student_id = String(hit.id);
            chosen.admission_number = hit.admission_number || "";
            if (as === "admission" && $name) {
              $name.value = `${hit.name || ""} — ${hit.admission_number || ""}`;
            }
            if (as === "name" && $adm) {
              $adm.value = `${hit.admission_number || ""} — ${hit.name || ""}`;
            }
          }
        };

        const debSearchAdm = debounce(async (q) => {
          if ((q || "").trim().length < 2) return renderList($admList, []);
          const results = await searchStudentsQuick(q, 12);
          renderList($admList, results, "admission");
        }, 250);

        const debSearchName = debounce(async (q) => {
          if ((q || "").trim().length < 2) return renderList($nameList, []);
          const results = await searchStudentsQuick(q, 12);
          renderList($nameList, results, "name");
        }, 250);

        $adm?.addEventListener("input", (e) => {
          debSearchAdm(e.target.value);
          chosen.student_id = "";
        });
        $name?.addEventListener("input", (e) => {
          debSearchName(e.target.value);
          chosen.student_id = "";
        });

        $adm?.addEventListener("change", () => onPick($adm, "admission"));
        $name?.addEventListener("change", () => onPick($name, "name"));
      },
      preConfirm: async () => {
        const p = Swal.getPopup();
        const admText = (p.querySelector("#dc-admno")?.value || "").trim();
        const nameText = (p.querySelector("#dc-stuname")?.value || "").trim();

        const incident_date = toDateInput(
          p.querySelector("#dc-date")?.value || ""
        );
        const incident_time = toTimeInput(
          p.querySelector("#dc-time")?.value || ""
        );
        const location = (p.querySelector("#dc-location")?.value || "").trim();
        const category =
          p.querySelector("#dc-category")?.value || "behaviour";
        const severity =
          p.querySelector("#dc-severity")?.value || "low";
        const description = (
          p.querySelector("#dc-description")?.value || ""
        ).trim();
        const parent_notified =
          (p.querySelector("#dc-parent-notified")?.value || "no") === "yes";
        const parent_notification_mode =
          p.querySelector("#dc-parent-mode")?.value || "none";
        const parent_meeting_date = toDateInput(
          p.querySelector("#dc-meeting-date")?.value || ""
        );
        const remarks = (p.querySelector("#dc-remarks")?.value || "").trim();

        if (!incident_date) {
          Swal.showValidationMessage("Incident date is required");
          return false;
        }
        if (!description) {
          Swal.showValidationMessage("Description is required");
          return false;
        }

        if (!chosen.student_id) {
          const tryExtractAdm = (s) => {
            if (!s) return "";
            const parts = s.split("—").map((x) => x.trim());
            const cand =
              parts.find(
                (x) => /[A-Za-z]*\d/.test(x) || x.includes("/")
              ) || parts[0];
            return cand || "";
          };
          const fromFieldsAdm =
            tryExtractAdm(admText) || tryExtractAdm(nameText) || "";

          const studentId = await resolveStudentId({
            admission_number: fromFieldsAdm,
            student_id: "",
          });
          if (studentId) chosen.student_id = String(studentId);
        }

        if (!chosen.student_id) {
          Swal.showValidationMessage(
            "Please select a student from suggestions (or enter a valid Admission No.)"
          );
          return false;
        }

        return {
          student_id: Number(chosen.student_id),
          body: {
            incident_date,
            incident_time: incident_time || undefined,
            location: location || undefined,
            category,
            severity,
            description,
            parent_notified,
            parent_notification_mode,
            parent_meeting_date: parent_meeting_date || undefined,
            remarks: remarks || undefined,
          },
        };
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const { student_id, body } = res.value || {};
        await api.post(`/discipline/${student_id}`, body);
        Swal.fire("Created", "Disciplinary record created.", "success");
        fetchList({ page: 1 });
      } catch (err) {
        console.error("create discipline error:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.error ||
            "Failed to create disciplinary record.",
          "error"
        );
      }
    });
  };

  /* ================== EDIT ================== */
  const handleEdit = async (row) => {
    if (["closed", "cancelled"].includes(row.status)) {
      Swal.fire(
        "Locked",
        "Closed / cancelled records cannot be edited.",
        "info"
      );
      return;
    }

    let full = row;
    try {
      const { data } = await api.get(`/discipline/${row.id}`);
      full = data || row;
    } catch {
      // ignore, use row
    }

    const rec = full;
    await Swal.fire({
      title: `Edit Record (ID: ${rec.id})`,
      width: "880px",
      html: `
        <style>
          .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .form-label{font-weight:600;margin-bottom:4px}
          .form-field{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px}
          textarea.form-field{resize:vertical}
        </style>
        <div class="form-grid">
          <div>
            <label class="form-label">Incident Date</label>
            <input id="ed-date" type="date" class="form-field" value="${esc(
              toDateInput(rec.incident_date)
            )}">
          </div>
          <div>
            <label class="form-label">Incident Time</label>
            <input id="ed-time" type="time" class="form-field" value="${esc(
              toTimeInput(rec.incident_time)
            )}">
          </div>
          <div>
            <label class="form-label">Location</label>
            <input id="ed-location" class="form-field" value="${esc(
              rec.location || ""
            )}" placeholder="Location">
          </div>
          <div>
            <label class="form-label">Category</label>
            <select id="ed-category" class="form-field">
              <option value="behaviour"${
                rec.category === "behaviour" ? " selected" : ""
              }>Behaviour</option>
              <option value="homework"${
                rec.category === "homework" ? " selected" : ""
              }>Homework</option>
              <option value="uniform"${
                rec.category === "uniform" ? " selected" : ""
              }>Uniform</option>
              <option value="transport"${
                rec.category === "transport" ? " selected" : ""
              }>Transport</option>
              <option value="bullying"${
                rec.category === "bullying" ? " selected" : ""
              }>Bullying</option>
              <option value="attendance"${
                rec.category === "attendance" ? " selected" : ""
              }>Attendance</option>
              <option value="other"${
                rec.category === "other" ? " selected" : ""
              }>Other</option>
            </select>
          </div>
          <div>
            <label class="form-label">Severity</label>
            <select id="ed-severity" class="form-field">
              <option value="low"${
                rec.severity === "low" ? " selected" : ""
              }>Low</option>
              <option value="medium"${
                rec.severity === "medium" ? " selected" : ""
              }>Medium</option>
              <option value="high"${
                rec.severity === "high" ? " selected" : ""
              }>High</option>
              <option value="critical"${
                rec.severity === "critical" ? " selected" : ""
              }>Critical</option>
            </select>
          </div>
          <div class="full">
            <label class="form-label">Description</label>
            <textarea id="ed-description" class="form-field" rows="3">${esc(
              rec.description || ""
            )}</textarea>
          </div>
          <div class="full">
            <label class="form-label">Remarks</label>
            <textarea id="ed-remarks" class="form-field" rows="2">${esc(
              rec.remarks || ""
            )}</textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: () => {
        const p = Swal.getPopup();
        const incident_date = toDateInput(
          p.querySelector("#ed-date")?.value || ""
        );
        const incident_time = toTimeInput(
          p.querySelector("#ed-time")?.value || ""
        );
        const location = (p.querySelector("#ed-location")?.value || "").trim();
        const category =
          p.querySelector("#ed-category")?.value || "behaviour";
        const severity =
          p.querySelector("#ed-severity")?.value || "low";
        const description = (
          p.querySelector("#ed-description")?.value || ""
        ).trim();
        const remarks = (p.querySelector("#ed-remarks")?.value || "").trim();

        if (!incident_date) {
          Swal.showValidationMessage("Incident date is required");
          return false;
        }
        if (!description) {
          Swal.showValidationMessage("Description is required");
          return false;
        }

        return {
          incident_date,
          incident_time: incident_time || null,
          location: location || null,
          category,
          severity,
          description,
          remarks: remarks || null,
        };
      },
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        await api.patch(`/discipline/${rec.id}`, r.value);
        Swal.fire("Saved", "Record updated successfully.", "success");
        fetchList();
      } catch (err) {
        console.error("update discipline error:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.error ||
            "Failed to update disciplinary record.",
          "error"
        );
      }
    });
  };

  /* ================== STATUS ACTIONS ================== */

  const handleUnderReview = async (row) => {
    const ok = await Swal.fire({
      title: "Move to Under Review?",
      text: `Record ID: ${row.id}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, move",
    });
    if (!ok.isConfirmed) return;
    try {
      await api.post(`/discipline/${row.id}/under-review`);
      Swal.fire("Updated", "Record moved to under review.", "success");
      fetchList();
    } catch (err) {
      console.error("under-review error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error ||
          "Failed to update record status.",
        "error"
      );
    }
  };

  const handleIssueNotice = async (row) => {
    if (["closed", "cancelled"].includes(row.status)) {
      Swal.fire(
        "Locked",
        "Closed / cancelled record cannot be modified.",
        "info"
      );
      return;
    }

    await Swal.fire({
      title: `Issue Notice (ID: ${row.id})`,
      width: "880px",
      html: `
        <style>
          .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .form-label{font-weight:600;margin-bottom:4px}
          .form-field{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px}
          textarea.form-field{resize:vertical}
        </style>
        <div class="form-grid">
          <div>
            <label class="form-label">Action Type</label>
            <select id="is-action-type" class="form-field">
              <option value="none"${
                row.action_type === "none" ? " selected" : ""
              }>None</option>
              <option value="verbal_warning"${
                row.action_type === "verbal_warning" ? " selected" : ""
              }>Verbal Warning</option>
              <option value="written_warning"${
                row.action_type === "written_warning" ? " selected" : ""
              }>Written Warning</option>
              <option value="parent_call"${
                row.action_type === "parent_call" ? " selected" : ""
              }>Parent Call</option>
              <option value="parent_meeting"${
                row.action_type === "parent_meeting" ? " selected" : ""
              }>Parent Meeting</option>
              <option value="suspension"${
                row.action_type === "suspension" ? " selected" : ""
              }>Suspension</option>
              <option value="expulsion"${
                row.action_type === "expulsion" ? " selected" : ""
              }>Expulsion</option>
              <option value="other"${
                row.action_type === "other" ? " selected" : ""
              }>Other</option>
            </select>
          </div>
          <div>
            <label class="form-label">Parent Notified?</label>
            <select id="is-parent-notified" class="form-field">
              <option value="no"${
                !row.parent_notified ? " selected" : ""
              }>No</option>
              <option value="yes"${
                row.parent_notified ? " selected" : ""
              }>Yes</option>
            </select>
          </div>
          <div>
            <label class="form-label">Notification Mode</label>
            <select id="is-parent-mode" class="form-field">
              <option value="none"${
                row.parent_notification_mode === "none" ? " selected" : ""
              }>None</option>
              <option value="note_in_diary"${
                row.parent_notification_mode === "note_in_diary"
                  ? " selected"
                  : ""
              }>Note in Diary</option>
              <option value="sms"${
                row.parent_notification_mode === "sms" ? " selected" : ""
              }>SMS</option>
              <option value="call"${
                row.parent_notification_mode === "call" ? " selected" : ""
              }>Call</option>
              <option value="meeting"${
                row.parent_notification_mode === "meeting" ? " selected" : ""
              }>Meeting</option>
              <option value="app_notification"${
                row.parent_notification_mode === "app_notification"
                  ? " selected"
                  : ""
              }>App Notification</option>
              <option value="email"${
                row.parent_notification_mode === "email" ? " selected" : ""
              }>Email</option>
              <option value="multiple"${
                row.parent_notification_mode === "multiple" ? " selected" : ""
              }>Multiple</option>
            </select>
          </div>
          <div>
            <label class="form-label">Parent Meeting Date</label>
            <input id="is-meeting-date" type="date" class="form-field" value="${esc(
              toDateInput(row.parent_meeting_date)
            )}">
          </div>
          <div class="full">
            <label class="form-label">Action Details (e.g., 3 days suspension)</label>
            <textarea id="is-action-details" class="form-field" rows="2">${esc(
              row.action_details || ""
            )}</textarea>
          </div>
          <div class="full">
            <label class="form-label">Remarks (for record)</label>
            <textarea id="is-remarks" class="form-field" rows="2">${esc(
              row.remarks || ""
            )}</textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Issue Notice",
      preConfirm: () => {
        const p = Swal.getPopup();
        const action_type =
          p.querySelector("#is-action-type")?.value || "none";
        const parent_notified =
          (p.querySelector("#is-parent-notified")?.value || "no") === "yes";
        const parent_notification_mode =
          p.querySelector("#is-parent-mode")?.value || "none";
        const parent_meeting_date = toDateInput(
          p.querySelector("#is-meeting-date")?.value || ""
        );
        const action_details = (
          p.querySelector("#is-action-details")?.value || ""
        ).trim();
        const remarks = (p.querySelector("#is-remarks")?.value || "").trim();

        return {
          action_type,
          parent_notified,
          parent_notification_mode,
          parent_meeting_date: parent_meeting_date || undefined,
          action_details: action_details || undefined,
          remarks: remarks || undefined,
        };
      },
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        await api.post(`/discipline/${row.id}/issue-notice`, r.value);
        Swal.fire(
          "Notice Issued",
          "Disciplinary notice issued successfully.",
          "success"
        );
        fetchList();
      } catch (err) {
        console.error("issue-notice error:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.error ||
            "Failed to issue disciplinary notice.",
          "error"
        );
      }
    });
  };

  const handleClose = async (row) => {
    const ok = await Swal.fire({
      title: "Close Record?",
      text: `This will mark the record as CLOSED (ID: ${row.id}).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Close",
    });
    if (!ok.isConfirmed) return;
    try {
      await api.post(`/discipline/${row.id}/close`);
      Swal.fire("Closed", "Record closed successfully.", "success");
      fetchList();
    } catch (err) {
      console.error("close error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to close record.",
        "error"
      );
    }
  };

  const handleCancel = async (row) => {
    const ok = await Swal.fire({
      title: "Cancel Record?",
      text: `This will mark the record as CANCELLED (ID: ${row.id}).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Cancel",
    });
    if (!ok.isConfirmed) return;
    try {
      await api.post(`/discipline/${row.id}/cancel`);
      Swal.fire("Cancelled", "Record cancelled.", "success");
      fetchList();
    } catch (err) {
      console.error("cancel error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to cancel record.",
        "error"
      );
    }
  };

  /* ================== DELETE & PDF ================== */

  const handleDelete = async (row) => {
    if (!isSuperadmin) {
      Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
      return;
    }
    const ok = await Swal.fire({
      title: "Delete Record?",
      text: `Permanently delete disciplinary record (ID: ${row.id}).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.delete(`/discipline/${row.id}`);
      Swal.fire("Deleted", "Record removed successfully.", "success");
      fetchList({ page: 1 });
    } catch (err) {
      console.error("delete discipline error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error ||
          "Failed to delete disciplinary record.",
        "error"
      );
    }
  };

  const handlePdf = async (row) => {
    try {
      const resp = await api.get(`/discipline/${row.id}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `DISCIPLINE_${row.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("PDF error:", err);
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "PDF not available (check permissions or if notice is issued).";
      Swal.fire("Error", msg, "error");
    }
  };

  const onSearch = () => fetchList({ page: 1 });
  const resetFilters = () => {
    setQ("");
    setStatus("");
    setCategory("");
    setSeverity("");
    setFromDate("");
    setToDate("");
    fetchList({
      search: "",
      status: "",
      category: "",
      severity: "",
      fromDate: "",
      toDate: "",
      page: 1,
    });
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Disciplinary Actions</h1>
        {canManage && (
          <button className="btn btn-success" onClick={handleCreate}>
            New Record From Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 260 }}
            placeholder="Search description / location..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
          <select
            className="form-select"
            style={{ maxWidth: 160 }}
            value={status}
            onChange={(e) => {
              const val = e.target.value;
              setStatus(val);
              fetchList({ status: val, page: 1 });
            }}
          >
            <option value="">All Status</option>
            <option value="reported">Reported</option>
            <option value="under_review">Under Review</option>
            <option value="notice_issued">Notice Issued</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="form-select"
            style={{ maxWidth: 160 }}
            value={category}
            onChange={(e) => {
              const val = e.target.value;
              setCategory(val);
              fetchList({ category: val, page: 1 });
            }}
          >
            <option value="">All Categories</option>
            <option value="behaviour">Behaviour</option>
            <option value="homework">Homework</option>
            <option value="uniform">Uniform</option>
            <option value="transport">Transport</option>
            <option value="bullying">Bullying</option>
            <option value="attendance">Attendance</option>
            <option value="other">Other</option>
          </select>
          <select
            className="form-select"
            style={{ maxWidth: 150 }}
            value={severity}
            onChange={(e) => {
              const val = e.target.value;
              setSeverity(val);
              fetchList({ severity: val, page: 1 });
            }}
          >
            <option value="">All Severity</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <div className="d-flex align-items-center gap-1">
            <span className="small text-muted">From</span>
            <input
              type="date"
              className="form-control"
              style={{ maxWidth: 150 }}
              value={fromDate}
              onChange={(e) => {
                const val = toDateInput(e.target.value);
                setFromDate(val);
                fetchList({ fromDate: val, page: 1 });
              }}
            />
            <span className="small text-muted">To</span>
            <input
              type="date"
              className="form-control"
              style={{ maxWidth: 150 }}
              value={toDate}
              onChange={(e) => {
                const val = toDateInput(e.target.value);
                setToDate(val);
                fetchList({ toDate: val, page: 1 });
              }}
            />
          </div>
          <button className="btn btn-outline-primary" onClick={onSearch}>
            Search
          </button>
          <button className="btn btn-outline-secondary" onClick={resetFilters}>
            Reset
          </button>
          <div className="ms-auto small text-muted">
            Page {page} / {totalPages}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Student</th>
              <th>Admission #</th>
              <th>Class</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Location</th>
              <th>Action Type</th>
              <th>Reporter</th>
              <th>Actioned By</th>
              <th style={{ minWidth: 280 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d, i) => {
              const student = d.student || {};
              const className = `${student.Class?.class_name || ""} ${
                student.Section?.section_name || ""
              }`.trim();
              const details = {
                "Record ID": d.id,
                "Incident Date": asYMD(d.incident_date) || "—",
                "Incident Time": d.incident_time || "—",
                Location: d.location || "—",
                Category: d.category || "—",
                Severity: d.severity || "—",
                Description: d.description || "—",
                "Action Type": d.action_type || "none",
                "Action Details": d.action_details || "—",
                Status: d.status,
                "Parent Notified": d.parent_notified ? "Yes" : "No",
                "Notification Mode": d.parent_notification_mode || "none",
                "Parent Meeting Date": asYMD(d.parent_meeting_date) || "—",
                Remarks: d.remarks || "—",
                "Student Name": student.name || "—",
                "Admission No": student.admission_number || "—",
                Class: className || "—",
                "Reported By": d.reporter?.name || "—",
                "Actioned By": d.actioner?.name || "—",
              };

              return (
                <tr key={d.id}>
                  <td>{(page - 1) * pageSize + i + 1}</td>
                  <td>{asYMD(d.incident_date) || "—"}</td>
                  <td>{student.name || "—"}</td>
                  <td>{student.admission_number || "—"}</td>
                  <td>{className || "—"}</td>
                  <td>{d.category || "—"}</td>
                  <td className="text-capitalize">{d.severity || "—"}</td>
                  <td>
                    {d.status === "reported" && (
                      <span className="badge bg-secondary">Reported</span>
                    )}
                    {d.status === "under_review" && (
                      <span className="badge bg-warning text-dark">
                        Under Review
                      </span>
                    )}
                    {d.status === "notice_issued" && (
                      <span className="badge bg-info text-dark">
                        Notice Issued
                      </span>
                    )}
                    {d.status === "closed" && (
                      <span className="badge bg-success">Closed</span>
                    )}
                    {d.status === "cancelled" && (
                      <span className="badge bg-dark">Cancelled</span>
                    )}
                  </td>
                  <td
                    title={d.location || ""}
                    style={{
                      maxWidth: 140,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {d.location || "—"}
                  </td>
                  <td className="text-capitalize">
                    {(d.action_type || "none").replace(/_/g, " ")}
                  </td>
                  <td>{d.reporter?.name || "—"}</td>
                  <td>{d.actioner?.name || "—"}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          Swal.fire({
                            title: `Record Details (ID: ${d.id})`,
                            html: `
                              <div style="text-align:left; white-space: pre-wrap;">
                                ${Object.entries(details)
                                  .map(
                                    ([k, v]) =>
                                      `<div><b>${esc(k)}:</b> ${esc(v)}</div>`
                                  )
                                  .join("")}
                              </div>
                            `,
                            confirmButtonText: "Close",
                            width: "650px",
                          })
                        }
                      >
                        View
                      </button>

                      {canManage && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleEdit(d)}
                        >
                          Edit
                        </button>
                      )}

                      {canManage && d.status === "reported" && (
                        <button
                          className="btn btn-outline-warning btn-sm"
                          onClick={() => handleUnderReview(d)}
                        >
                          Under Review
                        </button>
                      )}

                      {canManage &&
                        ["reported", "under_review", "notice_issued"].includes(
                          d.status
                        ) && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleIssueNotice(d)}
                          >
                            Issue Notice
                          </button>
                        )}

                      {canManage &&
                        ["notice_issued", "under_review"].includes(
                          d.status
                        ) && (
                          <button
                            className="btn btn-outline-success btn-sm"
                            onClick={() => handleClose(d)}
                          >
                            Close
                          </button>
                        )}

                      {canManage && d.status !== "cancelled" && (
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => handleCancel(d)}
                        >
                          Cancel
                        </button>
                      )}

                      {canManage && (
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => handlePdf(d)}
                        >
                          PDF
                        </button>
                      )}

                      {canManage && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDelete(d)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center">
                  No records found
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={13} className="text-center">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center mt-3">
        <div className="small text-muted">
          Showing page {page} of {totalPages}
        </div>
        <div className="btn-group">
          <button
            className="btn btn-outline-secondary"
            disabled={page <= 1}
            onClick={() => {
              const p = Math.max(1, page - 1);
              setPage(p);
              fetchList({ page: p });
            }}
          >
            Prev
          </button>
          <button
            className="btn btn-outline-secondary"
            disabled={page >= totalPages}
            onClick={() => {
              const p = Math.min(totalPages, page + 1);
              setPage(p);
              fetchList({ page: p });
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
