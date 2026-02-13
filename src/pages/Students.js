// src/pages/Students.js
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Students.css";

// role helpers
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
  };
};

// --- helpers: photo URL + fallback SVG ---
const apiBase = (() => {
  const b = api?.defaults?.baseURL;
  return b ? b.replace(/\/+$/, "") : window.location.origin;
})();

const buildPhotoURL = (fileName) =>
  fileName
    ? `${apiBase}/uploads/photoes/students/${encodeURIComponent(fileName)}`
    : "";

// Small neutral "no photo" SVG placeholder
const NO_PHOTO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
       <rect width="100%" height="100%" fill="#f8f9fa"/>
       <circle cx="32" cy="24" r="14" fill="#e9ecef"/>
       <rect x="10" y="42" width="44" height="14" rx="7" fill="#e9ecef"/>
     </svg>`
  );

// fetch next admission-number suggestion from backend
const fetchNextAdmissionNumber = async (prefix) => {
  try {
    const url = prefix
      ? `/students/next-admission-number?prefix=${encodeURIComponent(prefix)}`
      : `/students/next-admission-number`;
    const { data } = await api.get(url);
    return data?.suggestion || "";
  } catch (e) {
    console.warn("fetchNextAdmissionNumber failed:", e);
    return "";
  }
};

// small lookups for dropdowns
const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu & Kashmir (J&K)",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Puducherry",
  "Other",
];

const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS", "Other"];

const RELIGIONS = [
  "Hindu",
  "Muslim",
  "Sikh",
  "Christian",
  "Buddhist",
  "Jain",
  "Other",
];

// ✅ gender options
const GENDERS = ["Male", "Female", "Other"];

// blood groups list
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// colors for sibling badges
const SIBLING_COLORS = [
  { bg: "#6366f1", text: "#fff" },
  { bg: "#0ea5e9", text: "#fff" },
  { bg: "#22c55e", text: "#fff" },
  { bg: "#f97316", text: "#fff" },
];

const Students = () => {
  const { isAdmin, isSuperadmin } = getRoleFlags();
  const isAdminOrSuperAdmin = isAdmin || isSuperadmin;

  // data lists
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [concessions, setConcessions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [transportations, setTransportations] = useState([]);
  const [houses, setHouses] = useState([]);

  // transport helpers
  const transportById = useMemo(() => {
    const m = new Map();
    transportations.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [transportations]);

  const formatTransport = (t) => {
    if (!t) return "-";
    const vill = t.Villages || t.village || t.villages || "";
    const cost = t.Cost ?? t.cost;
    return vill ? `${vill}${cost ? ` — ₹${cost}` : ""}` : cost ? `₹${cost}` : "-";
  };

  const formatTransportById = (id) => {
    if (!id && id !== 0) return "-";
    const t = transportById.get(String(id));
    return formatTransport(t);
  };

  const fetchHouses = async () => {
    try {
      const { data } = await api.get("/houses");
      setHouses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchHouses:", err);
      setHouses([]);
    }
  };

  // UI state
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSessionFilter, setSelectedSessionFilter] = useState("");
  const [hasSiblingFilter, setHasSiblingFilter] = useState("");
  const [importing, setImporting] = useState(false);

  // ✅ Columns mode toggle (Compact / Full) with persistence
  const [showAllColumns, setShowAllColumns] = useState(() => {
    try {
      return localStorage.getItem("students_showAllColumns") === "1";
    } catch {
      return false;
    }
  });
  const toggleColumnsMode = () => {
    setShowAllColumns((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("students_showAllColumns", next ? "1" : "0");
      } catch {}
      return next;
    });
  };
  const isCompact = !showAllColumns;

  // fetch lists
  const fetchStudents = async () => {
    try {
      const { data } = await api.get("/students");
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchStudents:", err);
      Swal.fire("Error", "Failed to fetch students", "error");
    }
  };

  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchClasses:", err);
    }
  };

  const fetchSections = async () => {
    try {
      const { data } = await api.get("/sections");
      setSections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchSections:", err);
    }
  };

  const fetchConcessions = async () => {
    try {
      const { data } = await api.get("/concessions");
      setConcessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchConcessions:", err);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await api.get("/sessions");
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchSessions:", err);
    }
  };

const fetchTransportations = async () => {
  try {
    // ✅ fetch all routes (all sessions)
    const { data } = await api.get("/transportations");
    setTransportations(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("fetchTransportations:", err);
    setTransportations([]);
  }
};


  useEffect(() => {
    fetchStudents();
    fetchClasses();
    fetchSections();
    fetchSessions();
    fetchTransportations();
    fetchHouses();
    if (isAdminOrSuperAdmin) fetchConcessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrSuperAdmin]);

  // toggle status
  const toggleStudentStatus = async (student) => {
    if (!isAdminOrSuperAdmin) return;
    const newStatus = student.status === "enabled" ? "disabled" : "enabled";

    const result = await Swal.fire({
      title: `Confirm Status Change`,
      text: `Set ${student.name}'s status to ${newStatus.toUpperCase()}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Update",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    try {
      await api.put(`/students/toggle/${student.id}`, { status: newStatus });
      Swal.fire("Updated", `Status changed to ${newStatus.toUpperCase()}`, "success");
      fetchStudents();
    } catch (err) {
      console.error("toggleStudentStatus:", err);
      Swal.fire("Error", err.response?.data?.error || "Failed to update status", "error");
    }
  };

  // delete
  const handleDelete = async (id, name) => {
    if (!isSuperadmin) return;
    const result = await Swal.fire({
      title: "Confirm Deletion",
      text: `Permanently delete ${name}? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/students/delete/${id}`);
      Swal.fire("Deleted", "Student record removed successfully.", "success");
      fetchStudents();
    } catch (err) {
      console.error("handleDelete:", err);
      Swal.fire("Error", "Failed to delete student", "error");
    }
  };

  // PHOTO: choose file + upload
  const promptAndUploadPhoto = (student) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const fd = new FormData();
      fd.append("photo", file);
      if (student.admission_number) fd.append("admission_number", student.admission_number);

      try {
        Swal.showLoading();
        const { data } = await api.post(`/students/${student.id}/photo`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        Swal.close();
        await Swal.fire("Success", data?.message || "Photo uploaded successfully", "success");
        fetchStudents();
      } catch (err) {
        console.error("upload photo error:", err);
        Swal.close();
        Swal.fire("Error", err.response?.data?.message || "Failed to upload photo", "error");
      }
    };
    input.click();
  };

  // Print Admission Form
  const handlePrintAdmissionForm = async (student) => {
    if (!student?.id) return;

    try {
      const resp = await api.get(`/students/${student.id}/admission-form`, {
        responseType: "blob",
      });

      const blob = new Blob([resp.data], {
        type: resp.headers["content-type"] || "application/pdf",
      });
      const url = URL.createObjectURL(blob);

      const win = window.open(url, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `Admission_Form_${student.admission_number || student.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("handlePrintAdmissionForm:", err);
      Swal.fire(
        "Error",
        err.response?.data?.message || "Failed to generate admission form. Please try again.",
        "error"
      );
    }
  };

  // ---------------- ADD / EDIT FORM ----------------
  const showStudentForm = async (mode = "add", student = null) => {
    await fetchClasses();
    await fetchSections();
    await fetchSessions();
    await fetchTransportations();
    if (isAdminOrSuperAdmin) await fetchConcessions();

    const isEdit = mode === "edit";
    const s = student || {};

    // helper: pick first non-empty field from multiple possible keys
    const pickField = (obj, keys, fallback = "") => {
      for (const k of keys) {
        if (obj && obj[k] != null && String(obj[k]).trim() !== "") {
          return String(obj[k]).trim();
        }
      }
      return fallback;
    };

    // normalize from backend: support different key names / casing
    const existingBG = pickField(s, [
      "b_group",
      "B_group",
      "B_GROUP",
      "blood_group",
      "Blood_Group",
    ]);
    const existingState = pickField(s, ["state", "State", "STATE"]);

    // ✅ gender normalizers
    const existingGender = pickField(s, ["gender", "Gender", "GENDER"]);
    const existingBusGender = pickField(s, ["bus_gender", "busGender", "BusGender", "BUS_GENDER"]);

    let nextSuggestion = "";
    if (!isEdit) {
      nextSuggestion = await fetchNextAdmissionNumber();
    }

    const classOptions = `<option value="">Select Class</option>${classes
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === s.class_id ? "selected" : ""}>${c.class_name}</option>`
      )
      .join("")}`;

    const sectionOptionsAll = sections.map((sec) => ({
      id: sec.id,
      name: sec.section_name,
      class_id: sec.class_id,
    }));

    const concessionOptions = `<option value="">Select Concession</option>${concessions
      .map(
        (c) =>
          `<option value="${c.id}" ${c.id === s.concession_id ? "selected" : ""}>${c.concession_name}</option>`
      )
      .join("")}`;

    const sessionOptions = `<option value="">Select Session</option>${sessions
      .map(
        (ss) =>
          `<option value="${ss.id}" ${ss.id === s.session_id ? "selected" : ""}>${ss.name}</option>`
      )
      .join("")}`;

    const transportOptions = `<option value="">No Transport</option>${transportations
      .map((t) => {
        const label = (t?.Villages || "").replace(/"/g, "&quot;");
        const cost = t?.Cost ?? "";
        return `<option value="${t.id}" ${t.id === s.route_id ? "selected" : ""}>${label}${
          cost ? ` — ₹${cost}` : ""
        }</option>`;
      })
      .join("")}`;

    // ----- Blood group options (case-insensitive, allow custom value) -----
    const currentBG = existingBG;
    let bgOptionsHtml = BLOOD_GROUPS.map((bg) => {
      const isSelected = currentBG && bg.toLowerCase() === currentBG.toLowerCase();
      return `<option value="${bg}" ${isSelected ? "selected" : ""}>${bg}</option>`;
    }).join("");

    if (currentBG && !BLOOD_GROUPS.some((bg) => bg.toLowerCase() === currentBG.toLowerCase())) {
      bgOptionsHtml += `<option value="${currentBG}" selected>${currentBG}</option>`;
    }

    // ----- State options (case-insensitive, allow custom value) -----
    const currentState = existingState;
    let stateOptionsHtml = STATES.map((st) => {
      const isSelected = currentState && st.toLowerCase() === currentState.toLowerCase();
      return `<option value="${st}" ${isSelected ? "selected" : ""}>${st}</option>`;
    }).join("");

    if (currentState && !STATES.some((st) => st.toLowerCase() === currentState.toLowerCase())) {
      stateOptionsHtml += `<option value="${currentState}" selected>${currentState}</option>`;
    }

    // ✅ gender options
    const genderOptionsHtml = [
      `<option value="">Select Gender</option>`,
      ...GENDERS.map((g) => {
        const sel = existingGender && g.toLowerCase() === existingGender.toLowerCase();
        return `<option value="${g}" ${sel ? "selected" : ""}>${g}</option>`;
      }),
    ].join("");

    const busGenderOptionsHtml = [
      `<option value="">Same as Gender</option>`,
      ...GENDERS.map((g) => {
        const sel = existingBusGender && g.toLowerCase() === existingBusGender.toLowerCase();
        return `<option value="${g}" ${sel ? "selected" : ""}>${g}</option>`;
      }),
    ].join("");

    // ✅ Compact title bar
    const headerTitle = isEdit ? "Edit Student" : "Add Student";

    // ---------- HTML (compact + sticky mini header) ----------
    const html = `
      <style>
        .swal2-popup.student-swal {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 1040px !important;
          width: 100% !important;
          padding: 0 !important;
          border-radius: 14px !important;
          overflow: hidden;
        }
        .student-topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          background: linear-gradient(90deg, #eef2ff 0%, #ffffff 65%);
          border-bottom: 1px solid #e5e7eb;
        }
        .student-topbar .title {
          font-weight: 800;
          font-size: 14px;
          color: #111827;
          margin: 0;
        }
        .student-topbar .xbtn {
          border: 1px solid #e5e7eb;
          background: #fff;
          border-radius: 10px;
          padding: 6px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .student-topbar .xbtn:hover { background: #f9fafb; }

        .student-form-wrapper {
          max-height: 64vh;
          overflow-y: auto;
          padding: 10px 12px 0;
        }
        .tabbar {
          display: flex;
          gap: 6px;
          margin: 0 0 10px;
          border-bottom: 1px solid #e5e7eb;
          padding: 0 2px 8px;
          overflow-x: auto;
        }
        .tabbtn {
          padding: 6px 10px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          font-weight: 600;
          color: #6b7280;
          border-radius: 10px;
          transition: all 0.15s ease;
          white-space: nowrap;
          font-size: 12px;
        }
        .tabbtn:hover { color: #111827; background-color: #f9fafb; }
        .tabbtn.active {
          color: #111827;
          border-color: #6366f1;
          background: #eef2ff;
        }
        .tabpane { display: none; }
        .tabpane.active { display: block; }

        .form-container {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px 12px;
          background: #ffffff;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #eef2f7;
        }
        .full-row { grid-column: 1 / -1; }

        .form-field {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          font-size: 13px;
          background: #fff;
        }
        .form-field:focus {
          border-color: #6366f1;
          outline: 0;
          box-shadow: 0 0 0 0.12rem rgba(99,102,241,.20);
        }
        .form-label {
          font-weight: 700;
          color: #374151;
          margin-bottom: 4px;
          display: block;
          font-size: 12px;
        }
        .required { color: #dc2626; }
        .hint {
          color: #6b7280;
          font-size: 11px;
          margin-top: 4px;
          font-style: italic;
        }
        .sibling-block {
          border: 1px dashed #e5e7eb;
          padding: 10px;
          border-radius: 12px;
          margin-bottom: 8px;
          background: #fafafa;
        }
        .sibling-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: end;
        }

        .swal2-actions {
          margin: 10px 0 14px !important;
          padding: 0 12px;
        }

        @media (max-width: 768px) {
          .form-container { grid-template-columns: 1fr; }
        }
      </style>

      <div class="student-topbar">
        <div class="title">${headerTitle}</div>
        <button type="button" class="xbtn" id="studentSwalCloseBtn">✕</button>
      </div>

      <div class="student-form-wrapper">
        <div class="tabbar">
          <button class="tabbtn active" data-tab="mandatory">Basic</button>
          <button class="tabbtn" data-tab="personal">Personal</button>
          <button class="tabbtn" data-tab="contact">Contact</button>
          <button class="tabbtn" data-tab="transport">Transport</button>
          <button class="tabbtn" data-tab="siblings">Siblings</button>
          <button class="tabbtn" data-tab="prevschool">Previous</button>
        </div>

        <!-- Basic Info -->
        <div class="tabpane active" id="pane-mandatory">
          <div class="form-container">
            <div>
              <label class="form-label">Full Name <span class="required">*</span></label>
              <input id="f_name" class="form-field" value="${(s.name || "").replace(/"/g, "&quot;")}" required />
            </div>

            <div>
              <label class="form-label">Admission Number</label>
              <input id="f_admission_number" class="form-field"
                value="${isEdit ? s.admission_number || "" : s.admission_number || nextSuggestion || ""}" />
              <div class="hint">Leave empty for auto-generation</div>
            </div>

            <div>
              <label class="form-label">Class <span class="required">*</span></label>
              <select id="f_class_id" class="form-field" required>${classOptions}</select>
            </div>

            <div>
              <label class="form-label">Section <span class="required">*</span></label>
              <select id="f_section_id" class="form-field" required>
                <option value="">Select Section</option>
                ${sections
                  .map(
                    (sec) =>
                      `<option value="${sec.id}" data-class="${sec.class_id}" ${
                        sec.id === s.section_id ? "selected" : ""
                      }>${sec.section_name}</option>`
                  )
                  .join("")}
              </select>
            </div>

            <div>
              <label class="form-label">Session</label>
              <select id="f_session_id" class="form-field">${sessionOptions}</select>
            </div>

            <div>
              <label class="form-label">House</label>
              <select id="f_house_id" class="form-field">
                <option value="">Select House</option>
                ${houses
                  .map(
                    (h) =>
                      `<option value="${h.id}" ${
                        h.id === s.house_id ? "selected" : ""
                      }>${h.house_name}${h.color ? ` (${h.color})` : ""}</option>`
                  )
                  .join("")}
              </select>
            </div>

            ${
              isAdminOrSuperAdmin
                ? `<div class="full-row">
                    <label class="form-label">Concession Type</label>
                    <select id="f_concession_id" class="form-field">
                      ${concessionOptions}
                    </select>
                  </div>`
                : ""
            }

            <div>
              <label class="form-label">Admission Type</label>
              <select id="f_admission_type" class="form-field">
                <option value="New" ${s.admission_type === "New" ? "selected" : ""}>New Admission</option>
                <option value="Old" ${s.admission_type === "Old" ? "selected" : ""}>Transfer/Old</option>
              </select>
            </div>

            <div>
              <label class="form-label">Roll Number</label>
              <input id="f_roll_number" class="form-field" value="${s.roll_number || ""}" type="number" min="1" />
            </div>
          </div>
        </div>

        <!-- Personal -->
        <div class="tabpane" id="pane-personal">
          <div class="form-container">
            <div>
              <label class="form-label">Father's Name</label>
              <input id="f_father_name" class="form-field" value="${(s.father_name || "").replace(/"/g, "&quot;")}" />
            </div>

            <div>
              <label class="form-label">Mother's Name</label>
              <input id="f_mother_name" class="form-field" value="${(s.mother_name || "").replace(/"/g, "&quot;")}" />
            </div>

            <div>
              <label class="form-label">Gender</label>
              <select id="f_gender" class="form-field">
                ${genderOptionsHtml}
              </select>
            </div>

            <div>
              <label class="form-label">Date of Birth</label>
              <input id="f_DOB" class="form-field" value="${s.Date_Of_Birth || ""}" type="date" />
            </div>

            <div>
              <label class="form-label">Blood Group</label>
              <select id="f_b_group" class="form-field">
                <option value="">Select Blood Group</option>
                ${bgOptionsHtml}
              </select>
            </div>

            <div>
              <label class="form-label">Date of Admission</label>
              <input id="f_date_of_admission" class="form-field" value="${s.date_of_admission || ""}" type="date" />
            </div>

            <div>
              <label class="form-label">Date of Withdrawal</label>
              <input id="f_date_of_withdraw" class="form-field" value="${s.date_of_withdraw || ""}" type="date" />
            </div>

            <div>
              <label class="form-label">PEN Number</label>
              <input id="f_pen_number" class="form-field" value="${s.pen_number || ""}" />
            </div>

            <div>
              <label class="form-label">State</label>
              <select id="f_state" class="form-field">
                <option value="">Select State</option>
                ${stateOptionsHtml}
              </select>
            </div>

            <div>
              <label class="form-label">Category</label>
              <select id="f_category" class="form-field">
                <option value="">Select Category</option>
                ${CATEGORIES.map(
                  (c) =>
                    `<option value="${c}" ${c === (s.category || "") ? "selected" : ""}>${c}</option>`
                ).join("")}
              </select>
            </div>

            <div>
              <label class="form-label">Religion</label>
              <select id="f_religion" class="form-field">
                <option value="">Select Religion</option>
                ${RELIGIONS.map(
                  (r) =>
                    `<option value="${r}" ${r === (s.religion || "") ? "selected" : ""}>${r}</option>`
                ).join("")}
              </select>
            </div>

            <div class="full-row">
              <label class="form-label">Residential Address</label>
              <textarea id="f_address" class="form-field" rows="3">${(s.address || "").replace(/</g, "&lt;")}</textarea>
            </div>
          </div>
        </div>

        <!-- Contact -->
        <div class="tabpane" id="pane-contact">
          <div class="form-container">
            <div>
              <label class="form-label">Father's Phone</label>
              <input id="f_father_phone" class="form-field" value="${s.father_phone || ""}" type="tel" maxlength="15" />
            </div>
            <div>
              <label class="form-label">Mother's Phone</label>
              <input id="f_mother_phone" class="form-field" value="${s.mother_phone || ""}" type="tel" maxlength="15" />
            </div>
            <div>
              <label class="form-label">Aadhaar Number</label>
              <input id="f_aadhaar" class="form-field" value="${s.aadhaar_number || ""}" type="text" maxlength="12" />
            </div>
            <div>
              <label class="form-label">Public Visibility</label>
              <select id="f_visible" class="form-field">
                <option value="1" ${s.visible ? "selected" : ""}>Yes</option>
                <option value="0" ${!s.visible ? "selected" : ""}>No</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Transport -->
        <div class="tabpane" id="pane-transport">
          <div class="form-container">
            <div>
              <label class="form-label">Bus Service Fee (₹)</label>
              <input id="f_bus_service" class="form-field" value="${s.bus_service || ""}" type="number" min="0" />
            </div>

            <div>
              <label class="form-label">Transport Route</label>
              <select id="f_route_id" class="form-field">
                ${transportOptions}
              </select>
              <div class="hint">Optional: Select a transport route</div>
            </div>

            <div>
              <label class="form-label">Bus Gender</label>
              <select id="f_bus_gender" class="form-field">
                ${busGenderOptionsHtml}
              </select>
              <div class="hint">Optional: if bus seating uses gender rule</div>
            </div>

            <div>
              <label class="form-label">—</label>
              <div class="hint">Tip: keep empty to follow normal class seating.</div>
            </div>
          </div>
        </div>

        <!-- Siblings -->
        <div class="tabpane" id="pane-siblings">
          <div class="form-container">
            ${[1, 2, 3, 4]
              .map(
                (slot) => `
              <div class="full-row sibling-block" data-slot="${slot}">
                <label class="form-label">Sibling ${slot}</label>
                <div class="sibling-row">
                  <select id="sib_class_${slot}" class="form-field">
                    <option value="">Select Class</option>
                    ${classes
                      .map(
                        (c) =>
                          `<option value="${c.id}" ${
                            c.id === (s["sibling_class_" + slot] || "")
                              ? "selected"
                              : ""
                          }>${c.class_name}</option>`
                      )
                      .join("")}
                  </select>

                  <select id="sib_section_${slot}" class="form-field">
                    <option value="">All Sections</option>
                    ${sections
                      .map(
                        (sec) =>
                          `<option value="${sec.id}" data-class="${
                            sec.class_id
                          }" ${
                            sec.id === (s["sibling_section_" + slot] || "")
                              ? "selected"
                              : ""
                          }>${sec.section_name}</option>`
                      )
                      .join("")}
                  </select>

                  <select id="sib_student_${slot}" class="form-field">
                    <option value="">Select Student</option>
                    ${
                      s["sibling_id_" + slot]
                        ? `<option value="${
                            s["sibling_id_" + slot]
                          }" selected>${
                            (s["sibling_name_" + slot] || "Selected").replace(
                              /"/g,
                              "&quot;"
                            )
                          }${
                            s["sibling_id_" + slot]
                              ? ` (ID:${s["sibling_id_" + slot]})`
                              : ""
                          }</option>`
                        : ""
                    }
                  </select>
                  <input id="f_sibling_id_${slot}" type="hidden" value="${
                  s["sibling_id_" + slot] || ""
                }" />
                  <input id="f_sibling_name_${slot}" type="hidden" value="${(
                    s["sibling_name_" + slot] || ""
                  ).replace(/"/g, "&quot;")}" />
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>

        <!-- Previous School -->
        <div class="tabpane" id="pane-prevschool">
          <div class="form-container">
            <div class="full-row">
              <label class="form-label">Previous School Name</label>
              <input id="f_prev_school_name" class="form-field" value="${(s.prev_school_name || "").replace(
                /"/g,
                "&quot;"
              )}" />
            </div>
            <div class="full-row">
              <label class="form-label">Previous School Address</label>
              <textarea id="f_prev_school_address" class="form-field" rows="3">${(s.prev_school_address || "").replace(
                /</g,
                "&lt;"
              )}</textarea>
            </div>
            <div>
              <label class="form-label">Previous Class</label>
              <input id="f_prev_class" class="form-field" value="${(s.prev_class || "").replace(/"/g, "&quot;")}" />
            </div>
            <div>
              <label class="form-label">Previous Admission No.</label>
              <input id="f_prev_admission_no" class="form-field" value="${(s.prev_admission_no || "").replace(
                /"/g,
                "&quot;"
              )}" />
            </div>
          </div>
        </div>
      </div>
    `;

  const popup = await Swal.fire({
  title: "",
  icon: undefined,
  width: "1040px",
  html,
  showCancelButton: true,
  confirmButtonText: isEdit ? "Update" : "Add",
  cancelButtonText: "Cancel",
  focusConfirm: false,
  showLoaderOnConfirm: true,
  customClass: { popup: "student-swal" },
  preConfirm: () => {
    const rawRouteVal = document.getElementById("f_route_id")?.value;
    const routeVal = rawRouteVal === "" ? null : Number(rawRouteVal);

    const payload = {
      // Mandatory
      name: document.getElementById("f_name").value.trim(),
      admission_number: document.getElementById("f_admission_number").value.trim() || null,
      class_id: document.getElementById("f_class_id").value || null,
      section_id: document.getElementById("f_section_id").value || null,
      session_id: document.getElementById("f_session_id").value || null,
      house_id: document.getElementById("f_house_id")?.value || null,
      concession_id: document.getElementById("f_concession_id")?.value || null,
      admission_type: document.getElementById("f_admission_type").value,
      roll_number: document.getElementById("f_roll_number").value
        ? parseInt(document.getElementById("f_roll_number").value, 10)
        : null,

      // Personal
      father_name: document.getElementById("f_father_name").value.trim(),
      mother_name: document.getElementById("f_mother_name").value.trim(),

      // ✅ Gender
      gender: document.getElementById("f_gender")?.value || null,

      Date_Of_Birth: document.getElementById("f_DOB").value || null,
      date_of_admission: document.getElementById("f_date_of_admission").value || null,
      date_of_withdraw: document.getElementById("f_date_of_withdraw").value || null,
      pen_number: document.getElementById("f_pen_number").value || null,
      b_group: document.getElementById("f_b_group").value || null,
      state: document.getElementById("f_state").value || null,
      category: document.getElementById("f_category").value || null,
      religion: document.getElementById("f_religion").value || null,
      address: document.getElementById("f_address").value || null,

      // Contact
      father_phone: document.getElementById("f_father_phone").value || null,
      mother_phone: document.getElementById("f_mother_phone").value || null,
      aadhaar_number: document.getElementById("f_aadhaar").value || null,
      visible: document.getElementById("f_visible")?.value === "1",

      // Transport
      bus_service: document.getElementById("f_bus_service").value || "0",
      route_id: routeVal,

      // ✅ Bus gender
      bus_gender: document.getElementById("f_bus_gender")?.value || null,

      // Previous School
      prev_school_name: document.getElementById("f_prev_school_name")?.value || null,
      prev_school_address: document.getElementById("f_prev_school_address")?.value || null,
      prev_class: document.getElementById("f_prev_class")?.value || null,
      prev_admission_no: document.getElementById("f_prev_admission_no")?.value || null,
    };

    if (!payload.bus_gender) payload.bus_gender = null;

    // Siblings
    [1, 2, 3, 4].forEach((slot) => {
      const rawId = document.getElementById(`f_sibling_id_${slot}`)?.value ?? "";
      const rawName = document.getElementById(`f_sibling_name_${slot}`)?.value ?? "";

      const cleanedId = rawId ? String(rawId).replace(/^ID:\s*/i, "").trim() : null;
      const cleanedName = rawName ? String(rawName).trim() : null;

      payload[`sibling_id_${slot}`] = cleanedId || null;
      payload[`sibling_name_${slot}`] = cleanedName || null;
    });

    if (!payload.name) Swal.showValidationMessage("Full name is required");
    if (!payload.class_id) Swal.showValidationMessage("Class selection is required");
    if (!payload.section_id) Swal.showValidationMessage("Section selection is required");

    return payload;
  },
  didOpen: () => {
    const closeBtn = document.getElementById("studentSwalCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", () => Swal.close());

    /* ============================================================
     * ✅ NEW: Session-wise Transport Route reload
     * ============================================================ */
    const sessionSel = document.getElementById("f_session_id");
    const routeSel = document.getElementById("f_route_id");

    const buildRouteOptionsHtml = (list, selectedId) => {
      const safe = Array.isArray(list) ? list : [];
      const opts = [`<option value="">No Transport</option>`];

      safe.forEach((t) => {
        const label = String(t?.Villages || "").replace(/"/g, "&quot;");
        const cost = t?.Cost ?? "";
        const id = t?.id;

        opts.push(
          `<option value="${id}" ${String(id) === String(selectedId) ? "selected" : ""}>
            ${label}${cost ? ` — ₹${cost}` : ""}
          </option>`
        );
      });

      return opts.join("");
    };

    const fetchTransportForSessionId = async (sessionId) => {
      if (!routeSel) return;

      // keep selected value if still exists
      const prevSelected = routeSel.value || "";

      try {
        routeSel.innerHTML = `<option value="">Loading...</option>`;

        // session dropdown stores session_id (numeric) -> convert to session name (e.g. "2025-26")
        const ssObj = sessions.find((x) => String(x.id) === String(sessionId));
        const sessionName = ssObj?.name ? String(ssObj.name) : "";

        if (sessionName) {
          const resp = await api.get(`/transportations?session=${encodeURIComponent(sessionName)}`);
          const list = Array.isArray(resp.data) ? resp.data : [];
          routeSel.innerHTML = buildRouteOptionsHtml(list, prevSelected);
        } else {
          const resp = await api.get(`/transportations/active`);
          const list = Array.isArray(resp?.data?.data) ? resp.data.data : [];
          routeSel.innerHTML = buildRouteOptionsHtml(list, prevSelected);
        }
      } catch (e) {
        console.error("fetchTransportForSessionId:", e);
        routeSel.innerHTML = `<option value="">No Transport</option>`;
      }
    };

    // ✅ Session change -> reload routes
    if (sessionSel) {
      sessionSel.addEventListener("change", () => {
        fetchTransportForSessionId(sessionSel.value || "");
      });
    }

    // ✅ initial load
    fetchTransportForSessionId(sessionSel?.value || "");

    /* ============================================================
     * Tabs wire-up
     * ============================================================ */
    const btns = document.querySelectorAll(".tabbtn");
    const panes = {
      mandatory: document.getElementById("pane-mandatory"),
      personal: document.getElementById("pane-personal"),
      contact: document.getElementById("pane-contact"),
      transport: document.getElementById("pane-transport"),
      siblings: document.getElementById("pane-siblings"),
      prevschool: document.getElementById("pane-prevschool"),
    };
    btns.forEach((b) =>
      b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        Object.values(panes).forEach((p) => p.classList.remove("active"));
        const t = b.getAttribute("data-tab");
        if (panes[t]) panes[t].classList.add("active");
      })
    );

    /* ============================================================
     * Sibling pickers
     * ============================================================ */
    [1, 2, 3, 4].forEach((slot) => {
      const clsSel = document.getElementById(`sib_class_${slot}`);
      const secSel = document.getElementById(`sib_section_${slot}`);
      const stuSel = document.getElementById(`sib_student_${slot}`);
      const hiddenId = document.getElementById(`f_sibling_id_${slot}`);
      const hiddenName = document.getElementById(`f_sibling_name_${slot}`);

      if (!clsSel || !secSel || !stuSel) return;

      const populateSectionsForClass = (classId) => {
        const options = [`<option value="">All Sections</option>`];
        sectionOptionsAll.forEach((sec) => {
          if (!classId || String(sec.class_id) === String(classId)) {
            options.push(`<option value="${sec.id}">${sec.name}</option>`);
          }
        });
        secSel.innerHTML = options.join("");
      };

      const fetchAndPopulateStudents = async (classId, sectionId) => {
        stuSel.innerHTML = `<option value="">Loading...</option>`;
        if (!classId) {
          stuSel.innerHTML = `<option value="">Select class first</option>`;
          return;
        }
        try {
          const url = `/students/sibling-list?class_id=${classId}${
            sectionId ? `&section_id=${sectionId}` : ""
          }`;
          const { data } = await api.get(url);
          if (!Array.isArray(data) || data.length === 0) {
            stuSel.innerHTML = `<option value="">No students found</option>`;
            hiddenId.value = "";
            hiddenName.value = "";
            return;
          }
          const opts = [`<option value="">Select Student</option>`].concat(
            data.map((st) => {
              const token = st.admission_number || String(st.id);
              return `<option value="${token}"
                        data-name="${(st.name || "").replace(/"/g, "&quot;")}"
                        data-pk="${st.id}"
                        data-an="${st.admission_number || ""}">
                        ${st.name}${st.admission_number ? ` (AN:${st.admission_number})` : ""}
                      </option>`;
            })
          );

          stuSel.innerHTML = opts.join("");
        } catch (err) {
          console.error("fetchAndPopulateStudents:", err);
          stuSel.innerHTML = `<option value="">Error loading</option>`;
        }
      };

      clsSel.onchange = async () => {
        const classId = clsSel.value;
        populateSectionsForClass(classId);
        hiddenId.value = "";
        hiddenName.value = "";
        await fetchAndPopulateStudents(classId, secSel.value || "");
      };

      secSel.onchange = async () => {
        const classId = clsSel.value;
        const sectionId = secSel.value;
        hiddenId.value = "";
        hiddenName.value = "";
        await fetchAndPopulateStudents(classId, sectionId || "");
      };

      stuSel.onchange = () => {
        const opt = stuSel.selectedOptions[0];
        if (opt && opt.value) {
          hiddenId.value = opt.value;
          hiddenName.value = opt.dataset.name || opt.textContent || "";
        } else {
          hiddenId.value = "";
          hiddenName.value = "";
        }
      };

      const preClass = clsSel.value;
      const preSection = secSel.value;
      const preStudentId = hiddenId.value;

      (async () => {
        if (preClass) {
          populateSectionsForClass(preClass);
          await fetchAndPopulateStudents(preClass, preSection || "");
        } else {
          populateSectionsForClass("");
          stuSel.innerHTML = `<option value="">Select class first</option>`;
        }

        if (preClass && preStudentId) {
          const opt =
            Array.from(stuSel.options).find((o) => String(o.value) === String(preStudentId)) ||
            Array.from(stuSel.options).find((o) => String(o.dataset.pk) === String(preStudentId));
          if (opt) {
            opt.selected = true;
            hiddenName.value = opt.dataset.name || opt.textContent || "";
            hiddenId.value = opt.value;
          }
        }
      })();
    });
  },
});


    if (!popup.isConfirmed) return;
    const payload = popup.value;

    try {
      if (isEdit) {
        await api.put(`/students/edit/${s.id}`, payload);
        Swal.fire("Success", "Student record updated successfully", "success");
      } else {
        await api.post("/students/add", payload);
        Swal.fire("Success", "New student added successfully", "success");
      }
      fetchStudents();
    } catch (err) {
      console.error("showStudentForm submit:", err);
      Swal.fire("Error", err.response?.data?.error || "Failed to save student record", "error");
    }
  };

  const handleAdd = () => showStudentForm("add", null);
  const handleEdit = (student) => showStudentForm("edit", student);

  const handleExport = async () => {
    try {
      const resp = await api.get("/students/export-students", { responseType: "blob" });
      const blob = new Blob([resp.data], {
        type: resp.headers["content-type"] || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Students_Export_${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Swal.fire("Exported", "Student data downloaded successfully", "success");
    } catch (err) {
      console.error("handleExport:", err);
      Swal.fire("Error", "Failed to export student data", "error");
    }
  };

  const handleImport = async (file) => {
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await api.post("/students/import-students", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire("Imported", res.data?.message || "Import completed successfully", "success");
      if (res.data?.duplicates && res.data.duplicates.length) {
        Swal.fire("Note", `${res.data.duplicates.length} duplicate rows were skipped`, "info");
      }
      fetchStudents();
    } catch (err) {
      console.error("handleImport:", err);
      Swal.fire("Error", err.response?.data?.message || "Failed to import data", "error");
    } finally {
      setImporting(false);
    }
  };

  const openImportDialog = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e) => {
      const f = e.target.files?.[0];
      if (f) handleImport(f);
    };
    input.click();
  };

  const studentHasSibling = (stu) => {
    return (
      !!(stu.sibling_id_1 || stu.sibling_id_2 || stu.sibling_id_3 || stu.sibling_id_4) ||
      !!(stu.sibling_name_1 || stu.sibling_name_2 || stu.sibling_name_3 || stu.sibling_name_4)
    );
  };

  const filteredStudents = useMemo(
    () =>
      students.filter((stu) => {
        const q = search.trim().toLowerCase();
        const textMatch =
          !q ||
          [stu.name, stu.father_name, stu.aadhaar_number, stu.admission_number].some((v) =>
            (v || "").toString().toLowerCase().includes(q)
          );
        const classMatch = !selectedClass || String(stu.class_id) === String(selectedClass);
        const statusMatch = !selectedStatus || stu.status === selectedStatus;
        const sessionMatch = !selectedSessionFilter || String(stu.session_id) === String(selectedSessionFilter);
        const hasSibling = studentHasSibling(stu);
        let siblingMatch = true;
        if (hasSiblingFilter === "has") siblingMatch = hasSibling;
        if (hasSiblingFilter === "no") siblingMatch = !hasSibling;

        return textMatch && classMatch && statusMatch && sessionMatch && siblingMatch;
      }),
    [students, search, selectedClass, selectedStatus, selectedSessionFilter, hasSiblingFilter]
  );

  const totalCount = filteredStudents.length;
  const enabledCount = filteredStudents.filter((s) => s.status === "enabled").length;
  const disabledCount = filteredStudents.filter((s) => s.status === "disabled").length;

  const handleSiblingClick = async (token) => {
    if (!token) return;

    let raw = String(token).trim().replace(/^ID:\s*/i, "").trim();

    const tryExactAN = async () => {
      try {
        const resp = await api.get(`/students/admission/${encodeURIComponent(raw)}`);
        return Array.isArray(resp.data) ? resp.data[0] || null : resp.data || null;
      } catch {
        return null;
      }
    };

    const tryListANExact = async () => {
      try {
        const resp = await api.get(`/students?admission_number=${encodeURIComponent(raw)}`);
        const arr = Array.isArray(resp.data) ? resp.data : [];
        return arr.find((s) => String(s.admission_number || "").trim() === raw) || null;
      } catch {
        return null;
      }
    };

    const tryById = async () => {
      if (!/^\d+$/.test(raw)) return null;
      try {
        const resp = await api.get(`/students/${parseInt(raw, 10)}`);
        return Array.isArray(resp.data) ? resp.data[0] || null : resp.data || null;
      } catch {
        return null;
      }
    };

    let respData = await tryExactAN();
    if (!respData) respData = await tryListANExact();
    if (!respData) respData = await tryById();

    if (!respData) {
      Swal.fire("Not Found", "Sibling record not available.", "warning");
      return;
    }
    handleView(respData);
  };

  const PhotoCell = ({ student }) => {
    const src = buildPhotoURL(student.photo);
    const hasPhoto = !!student.photo;

    return (
      <div className="d-flex align-items-center gap-2">
        <div className="position-relative">
          <img
            src={hasPhoto ? src : NO_PHOTO_SVG}
            alt={`${student.name || "Student"} photo`}
            className="rounded-circle"
            style={{
              width: 42, // ✅ slightly smaller
              height: 42,
              objectFit: "cover",
              border: "2px solid #dee2e6",
            }}
            onError={(e) => {
              e.currentTarget.src = NO_PHOTO_SVG;
            }}
          />
        </div>
        {isAdminOrSuperAdmin && (
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={(ev) => {
              ev.stopPropagation();
              promptAndUploadPhoto(student);
            }}
            title={hasPhoto ? "Replace photo" : "Upload photo"}
          >
            <i className="bi bi-camera" style={{ fontSize: "0.875rem" }}></i>
          </button>
        )}
      </div>
    );
  };

  // VIEW POPUP
  function handleView(student) {
    const siblingRows = [];
    for (let i = 1; i <= 4; i++) {
      const id = student[`sibling_id_${i}`];
      const name = student[`sibling_name_${i}`];
      if (id || name) {
        siblingRows.push({
          label: `Sibling ${i}`,
          value: name ? name : `ID:${id}`,
          id,
        });
      }
    }

    const statusBadge =
      student.status === "enabled"
        ? '<span class="badge bg-success">ENABLED</span>'
        : '<span class="badge bg-secondary">DISABLED</span>';

    const viewBloodGroup =
      student.b_group ||
      student.B_group ||
      student.B_GROUP ||
      student.blood_group ||
      student.Blood_Group ||
      "-";

    const viewState = student.state || student.State || student.STATE || "-";

    const viewGender = student.gender || student.Gender || student.GENDER || "-";
    const viewBusGender =
      student.bus_gender ||
      student.busGender ||
      student.BusGender ||
      student.BUS_GENDER ||
      "-";

    const fields = [
      { label: "Admission Number", value: student.admission_number || "-" },
      { label: "Full Name", value: student.name || "-" },
      { label: "Gender", value: viewGender },
      { label: "Bus Gender", value: viewBusGender },
      { label: "Father's Name", value: student.father_name || "-" },
      { label: "Mother's Name", value: student.mother_name || "-" },
      { label: "Class", value: student.class_name || "-" },
      { label: "Section", value: student.section_name || "-" },
      { label: "House", value: student.house_name || "-" },
      { label: "Session", value: student.session_name || "-" },
      { label: "Roll Number", value: student.roll_number || "-" },
      { label: "Date of Birth", value: student.Date_Of_Birth || "-" },
      { label: "Admission Date", value: student.date_of_admission || "-" },
      { label: "Withdrawal Date", value: student.date_of_withdraw || "-" },
      { label: "PEN Number", value: student.pen_number || "-" },
      { label: "Blood Group", value: viewBloodGroup },
      { label: "State", value: viewState },
      { label: "Category", value: student.category || "-" },
      { label: "Religion", value: student.religion || "-" },
      { label: "Bus Service Fee", value: `₹${student.bus_service || 0}` },
      { label: "Public Visibility", value: student.visible ? "Yes" : "No" },
      { label: "Father's Phone", value: student.father_phone || "-" },
      { label: "Mother's Phone", value: student.mother_phone || "-" },
      {
        label: "Aadhaar Number",
        value: student.aadhaar_number
          ? student.aadhaar_number.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3")
          : "-",
      },
      { label: "Admission Type", value: student.admission_type || "-" },
    ];

    if (isAdminOrSuperAdmin) {
      fields.push({
        label: "Concession",
        value: student.concession_name || "-",
      });
    }

    fields.push({
      label: "Transport Route",
      value: formatTransportById(student.route_id),
    });
    fields.push({ label: "Status", value: statusBadge });
    fields.push({
      label: "Residential Address",
      value: student.address || "-",
      full: true,
    });
    fields.push({
      label: "Previous School",
      value: student.prev_school_name || "-",
    });
    fields.push({
      label: "Previous Class",
      value: student.prev_class || "-",
    });
    fields.push({
      label: "Previous Adm. #",
      value: student.prev_admission_no || "-",
    });
    if (student.prev_school_address) {
      fields.push({
        label: "Previous School Address",
        value: student.prev_school_address,
        full: true,
      });
    }

    const photoUrl = buildPhotoURL(student.photo);
    const hasPhoto = !!student.photo;

    const fieldHtml = fields
      .map(
        (f) => `
      <div class="detail-item ${f.full ? "full-row" : ""}">
        <div class="detail-label">${f.label}</div>
        <div class="detail-value">${f.value}</div>
      </div>
    `
      )
      .join("");

    const siblingHtml = siblingRows.length
      ? siblingRows
          .map(
            (s) => `
      <div class="detail-item sibling-item" data-sibling-id="${s.id || ""}">
        <div class="detail-label">${s.label}</div>
        <div class="detail-value" style="cursor: ${
          s.id ? "pointer" : "default"
        }; color: ${s.id ? "#0d6efd" : "#6b7280"}; font-weight: 500;" ${
              s.id ? `data-sibling-id="${s.id}"` : ""
            }>${s.value}</div>
      </div>
    `
          )
          .join("")
      : `
      <div class="detail-item">
        <div class="detail-label">Siblings</div>
        <div class="detail-value">None recorded</div>
      </div>
    `;

    const photoHtml = `
      <div class="d-flex align-items-center justify-content-center gap-3 mb-3 p-3 bg-light rounded">
        <img src="${hasPhoto ? photoUrl : NO_PHOTO_SVG}" alt="Student Photo"
          class="rounded-circle border shadow-sm"
          style="width: 90px; height: 90px; object-fit: cover;" />
        ${
          isAdminOrSuperAdmin
            ? `<button id="btnChangePhoto" class="btn btn-outline-primary btn-sm">${
                hasPhoto ? "Change Photo" : "Upload Photo"
              }</button>`
            : ""
        }
      </div>
    `;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
          <div>
            <h3 class="mb-0 fw-bold text-primary" style="font-size: 1.05rem;">${student.name || "Student"} — Profile</h3>
            <div class="text-muted" style="font-size: 0.8rem;">Admission # ${student.admission_number || "-"}</div>
          </div>
        </div>
        ${photoHtml}
        <div class="row g-3">
          <div class="col-md-6">
            ${fieldHtml
              .split("</div>")
              .slice(0, Math.ceil(fields.length / 2))
              .join("</div>")}
          </div>
          <div class="col-md-6">
            ${siblingHtml}
          </div>
        </div>
      </div>
      <style>
        .detail-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #f1f5f9;
        }
        .detail-item:last-child { border-bottom: none; }
        .detail-label {
          font-weight: 700;
          color: #6c757d;
          flex: 0 0 140px;
          font-size: 0.85rem;
        }
        .detail-value {
          color: #212529;
          flex: 1;
          word-break: break-word;
          font-size: 0.9rem;
        }
        .sibling-item .detail-value:hover { text-decoration: underline; }
        @media (max-width: 768px) {
          .detail-item { flex-direction: column; gap: 4px; }
          .detail-label { flex: 0 0 auto; }
        }
      </style>
    `;

    Swal.fire({
      title: "",
      html,
      width: 900,
      showCloseButton: true,
      showConfirmButton: false,
      customClass: {
        popup: "border-0 shadow-lg",
        content: "p-0",
      },
      didOpen: () => {
        const popup = Swal.getPopup();
        if (popup) {
          const siblingEls = popup.querySelectorAll("[data-sibling-id]");
          siblingEls.forEach((el) => {
            const id = el.getAttribute("data-sibling-id");
            if (id) {
              el.addEventListener("click", (e) => {
                e.stopPropagation();
                Swal.close();
                setTimeout(() => handleSiblingClick(id), 100);
              });
            }
          });
        }
        const btn = document.getElementById("btnChangePhoto");
        if (btn && isAdminOrSuperAdmin) {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            Swal.close();
            promptAndUploadPhoto(student);
          });
        }
      },
    });
  }

  // ✅ PART-1 ends here (PART-2 will contain the return(...) UI + export default)
  return (
    <div
      className="container-fluid mt-2 students-page"
      style={{
        background: "linear-gradient(180deg, #f9fafb 0%, #ffffff 180px, #ffffff 100%)",
        minHeight: "100vh",
      }}
    >
      {/* ✅ Compact top header (less height) */}
      <div className="students-topbar d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
        <div>
          <h2 className="h6 mb-0 fw-bold text-dark">Student Management</h2>
          <p className="mb-0 text-muted" style={{ fontSize: "0.78rem" }}>
            Manage student records, admissions, transport and concessions.
          </p>
        </div>

        <div className="d-flex gap-2 flex-wrap align-items-center">
          {/* ✅ Columns Toggle (Compact / Full) */}
          <button
            type="button"
            className={`btn btn-sm ${showAllColumns ? "btn-outline-primary" : "btn-primary"}`}
            onClick={toggleColumnsMode}
            title="Toggle Compact / Full columns"
          >
            <i className="bi bi-layout-text-sidebar-reverse me-1"></i>
            {showAllColumns ? "Full" : "Compact"}
          </button>

          {isAdminOrSuperAdmin && (
            <>
              <button className="btn btn-sm btn-primary" onClick={handleAdd}>
                <i className="bi bi-plus-circle me-1"></i>
                Add
              </button>

              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={openImportDialog}
                disabled={importing}
              >
                <i className="bi bi-upload me-1"></i>
                {importing ? "Importing..." : "Import"}
              </button>
            </>
          )}

          <button className="btn btn-sm btn-outline-primary" onClick={handleExport}>
            <i className="bi bi-download me-1"></i>
            Export
          </button>
        </div>
      </div>

      {/* ✅ Mini stats strip (very less vertical space) */}
      <div className="students-stats-strip mb-2">
        <div className="students-stat mini green">
          <div className="num">{enabledCount}</div>
          <div className="lbl">Active</div>
        </div>
        <div className="students-stat mini red">
          <div className="num">{disabledCount}</div>
          <div className="lbl">Inactive</div>
        </div>
        <div className="students-stat mini blue">
          <div className="num">{totalCount}</div>
          <div className="lbl">Total</div>
        </div>
      </div>

      {/* Filters + table */}
      <div className="card border-0 shadow-sm">
        {/* ✅ compact filter bar + hides extra filters in compact mode */}
        <div className="card-header bg-white border-0 py-2">
          <div className="d-flex flex-wrap gap-2 align-items-center students-filters-row">
            <div className="flex-grow-1">
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ maxWidth: 320, minWidth: 180 }}
                placeholder="Search name / admission / Aadhaar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 180 }}
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_name}
                </option>
              ))}
            </select>

            {!isCompact && (
              <>
                <select
                  className="form-select form-select-sm d-none d-md-block"
                  style={{ maxWidth: 190 }}
                  value={selectedSessionFilter}
                  onChange={(e) => setSelectedSessionFilter(e.target.value)}
                >
                  <option value="">All Sessions</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  className="form-select form-select-sm d-none d-md-block"
                  style={{ maxWidth: 150 }}
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="enabled">Active</option>
                  <option value="disabled">Inactive</option>
                </select>

                <select
                  className="form-select form-select-sm d-none d-lg-block"
                  style={{ maxWidth: 160 }}
                  value={hasSiblingFilter}
                  onChange={(e) => setHasSiblingFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="has">With Siblings</option>
                  <option value="no">Without Siblings</option>
                </select>
              </>
            )}

            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setSearch("");
                setSelectedClass("");
                setSelectedStatus("");
                setSelectedSessionFilter("");
                setHasSiblingFilter("");
              }}
              title="Reset filters"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle students-table">
              <thead
                className="sticky-top"
                style={{ background: "linear-gradient(90deg,#eef2ff 0%,#ffffff 100%)" }}
              >
                <tr>
                  <th className="border-0 py-2 d-none d-md-table-cell">#</th>
                  <th className="border-0 py-2">Photo</th>
                  <th className="border-0 py-2">Adm. #</th>

                  {/* ✅ Compact: single Info column */}
                  {isCompact ? (
                    <th className="border-0 py-2">Info</th>
                  ) : (
                    <>
                      <th className="border-0 py-2">Student Name</th>
                      <th className="border-0 py-2 d-none d-lg-table-cell">Father</th>
                      <th className="border-0 py-2">Class</th>
                      <th className="border-0 py-2 d-none d-md-table-cell">Section</th>
                      <th className="border-0 py-2 d-none d-xl-table-cell">House</th>
                      <th className="border-0 py-2 d-none d-lg-table-cell">Session</th>
                      <th className="border-0 py-2 d-none d-xl-table-cell">Aadhaar</th>
                      <th className="border-0 py-2 d-none d-lg-table-cell">Type</th>
                      {isAdminOrSuperAdmin && (
                        <th className="border-0 py-2 d-none d-xl-table-cell">Concession</th>
                      )}
                      <th className="border-0 py-2 d-none d-xl-table-cell">Transport</th>
                    </>
                  )}

                  <th className="border-0 py-2">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.length ? (
                  filteredStudents
                    .slice()
                    .reverse()
                    .map((stu, idx) => {
                      const combinedSiblings = [];
                      for (let i = 1; i <= 4; i++) {
                        const sid = stu[`sibling_id_${i}`];
                        const sname = stu[`sibling_name_${i}`];
                        if (sid || sname) {
                          combinedSiblings.push({
                            id: sid ?? null,
                            name: sname ? String(sname) : sid ? `ID:${sid}` : "Sibling",
                          });
                        }
                      }

                      // ✅ Compact “Info” pack (more data in less width)
                      const compactLine2 = [
                        stu.class_name ? `Class: ${stu.class_name}` : null,
                        stu.section_name ? `Sec: ${stu.section_name}` : null,
                        stu.father_name ? `F: ${stu.father_name}` : null,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      const compactBadges = (
                        <div className="d-flex flex-wrap gap-1 mt-1">
                          {stu.session_name && (
                            <span className="badge bg-light text-dark border students-badge">
                              {stu.session_name}
                            </span>
                          )}
                          {stu.admission_type && (
                            <span
                              className={`badge students-badge ${
                                stu.admission_type === "New" ? "bg-success" : "bg-warning text-dark"
                              }`}
                            >
                              {stu.admission_type}
                            </span>
                          )}
                          {!!stu.house_name && (
                            <span
                              className="badge students-badge"
                              style={{
                                backgroundColor: stu.house_color || "#6c757d",
                                color: "#fff",
                              }}
                            >
                              {stu.house_name}
                            </span>
                          )}
                          {!!stu.route_id && (
                            <span className="badge bg-info text-dark students-badge">
                              {String(formatTransportById(stu.route_id)).slice(0, 18)}
                              {String(formatTransportById(stu.route_id)).length > 18 ? "…" : ""}
                            </span>
                          )}
                        </div>
                      );

                      return (
                        <tr key={stu.id} className="table-hover-row">
                          <td className="py-2 d-none d-md-table-cell">{idx + 1}</td>

                          <td
                            className="py-1"
                            onClick={() => handleView(stu)}
                            style={{ cursor: "pointer" }}
                          >
                            <PhotoCell student={stu} />
                          </td>

                          <td
                            className="py-2 fw-medium"
                            onClick={() => handleView(stu)}
                            style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                          >
                            {stu.admission_number || "-"}
                          </td>

                          {/* ✅ Compact vs Full cells */}
                          {isCompact ? (
                            <td
                              className="py-2"
                              onClick={() => handleView(stu)}
                              style={{ cursor: "pointer", minWidth: 260 }}
                            >
                              <div className="fw-semibold students-name-compact">
                                {stu.name || "-"}
                              </div>

                              {combinedSiblings.length > 0 && (
                                <div className="mt-1">
                                  {combinedSiblings.slice(0, 3).map((sibling, i) => (
                                    <span
                                      key={i}
                                      className="badge rounded-pill me-1 mb-1"
                                      style={{
                                        backgroundColor: SIBLING_COLORS[i % SIBLING_COLORS.length].bg,
                                        color: SIBLING_COLORS[i % SIBLING_COLORS.length].text,
                                        fontSize: "0.7rem",
                                        cursor: sibling.id ? "pointer" : "default",
                                        border: "none",
                                      }}
                                      title={sibling.name}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (sibling.id) handleSiblingClick(sibling.id);
                                      }}
                                    >
                                      {sibling.name.length > 14
                                        ? `${sibling.name.substring(0, 11)}...`
                                        : sibling.name}
                                    </span>
                                  ))}
                                  {combinedSiblings.length > 3 && (
                                    <span className="badge bg-secondary rounded-pill mb-1" style={{ fontSize: "0.7rem" }}>
                                      +{combinedSiblings.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}

                              {compactLine2 && (
                                <div className="text-muted students-compact-sub">
                                  {compactLine2}
                                </div>
                              )}

                              {compactBadges}
                            </td>
                          ) : (
                            <>
                              <td
                                className="py-2"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                <div className="fw-semibold">{stu.name}</div>

                                {combinedSiblings.length > 0 && (
                                  <div className="mt-1">
                                    {combinedSiblings.map((sibling, i) => (
                                      <span
                                        key={i}
                                        className="badge rounded-pill me-1 mb-1"
                                        style={{
                                          backgroundColor: SIBLING_COLORS[i % SIBLING_COLORS.length].bg,
                                          color: SIBLING_COLORS[i % SIBLING_COLORS.length].text,
                                          fontSize: "0.7rem",
                                          cursor: sibling.id ? "pointer" : "default",
                                          border: "none",
                                        }}
                                        title={sibling.name}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (sibling.id) handleSiblingClick(sibling.id);
                                        }}
                                      >
                                        {sibling.name.length > 15
                                          ? `${sibling.name.substring(0, 12)}...`
                                          : sibling.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>

                              <td
                                className="py-2 text-muted d-none d-lg-table-cell"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                {stu.father_name || "-"}
                              </td>

                              <td
                                className="py-2"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                <span className="badge bg-light text-dark border students-badge">
                                  {stu.class_name || "-"}
                                </span>
                              </td>

                              <td
                                className="py-2 d-none d-md-table-cell"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                <span className="badge bg-secondary students-badge">
                                  {stu.section_name || "-"}
                                </span>
                              </td>

                              <td
                                className="py-2 d-none d-xl-table-cell"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                {stu.house_name ? (
                                  <span
                                    className="badge students-badge"
                                    style={{
                                      backgroundColor: stu.house_color || "#6c757d",
                                      color: "#fff",
                                    }}
                                  >
                                    {stu.house_name}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </td>

                              <td
                                className="py-2 d-none d-lg-table-cell"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                {stu.session_name || (stu.session_id ? "Assigned" : "-")}
                              </td>

                              <td
                                className="py-2 small d-none d-xl-table-cell"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                {stu.aadhaar_number
                                  ? stu.aadhaar_number.replace(/(\d{4})(\d{4})(\d{4})/, "$1-$2-$3")
                                  : "-"}
                              </td>

                              <td
                                className="py-2 d-none d-lg-table-cell"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                <span
                                  className={`badge students-badge ${
                                    stu.admission_type === "New" ? "bg-success" : "bg-warning text-dark"
                                  }`}
                                >
                                  {stu.admission_type}
                                </span>
                              </td>

                              {isAdminOrSuperAdmin && (
                                <td
                                  className="py-2 d-none d-xl-table-cell"
                                  onClick={() => handleView(stu)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <span className="badge bg-info text-dark students-badge">
                                    {stu.concession_name || "-"}
                                  </span>
                                </td>
                              )}

                              <td
                                className="py-2 small d-none d-xl-table-cell"
                                onClick={() => handleView(stu)}
                                style={{ cursor: "pointer" }}
                              >
                                {formatTransportById(stu.route_id)}
                              </td>
                            </>
                          )}

                          <td className="py-1">
                            <div className="d-flex gap-1 align-items-center flex-wrap">
                              {isAdminOrSuperAdmin && (
                                <>
                                  <div className="form-check form-switch form-switch-sm m-0">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`status-${stu.id}`}
                                      checked={stu.status === "enabled"}
                                      onChange={() => toggleStudentStatus(stu)}
                                    />
                                  </div>

                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => handleEdit(stu)}
                                    title="Edit"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>

                                  <button
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => promptAndUploadPhoto(stu)}
                                    title={stu.photo ? "Replace Photo" : "Upload Photo"}
                                  >
                                    <i className="bi bi-camera"></i>
                                  </button>
                                </>
                              )}

                              <button
                                className="btn btn-outline-success btn-sm"
                                onClick={() => handlePrintAdmissionForm(stu)}
                                title="Print Admission Form"
                              >
                                <i className="bi bi-printer"></i>
                              </button>

                              {isSuperadmin && (
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleDelete(stu.id, stu.name)}
                                  title="Delete"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td
                      colSpan={
                        // ✅ correct colspan for compact/full + admin
                        isCompact
                          ? 5 // #, Photo, Adm#, Info, Actions (and # hidden on mobile but still counts)
                          : isAdminOrSuperAdmin
                          ? 13
                          : 12
                      }
                      className="text-center py-4"
                    >
                      <div className="text-muted">
                        <i className="bi bi-inbox display-6 mb-2"></i>
                        <p className="mb-0">No students match the current filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Students;
