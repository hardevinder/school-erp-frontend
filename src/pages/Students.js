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
  fileName ? `${apiBase}/uploads/photoes/students/${encodeURIComponent(fileName)}` : "";

// Small neutral "no photo" SVG placeholder
const NO_PHOTO_SVG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
       <rect width="100%" height="100%" fill="#f0f0f0"/>
       <circle cx="32" cy="24" r="14" fill="#d9d9d9"/>
       <rect x="10" y="42" width="44" height="14" rx="7" fill="#d9d9d9"/>
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
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Puducherry","Other"
];
const CATEGORIES = ["General","OBC","SC","ST","EWS","Other"];
const RELIGIONS = ["Hindu","Muslim","Sikh","Christian","Buddhist","Jain","Other"];

// colors for sibling badges
const SIBLING_COLORS = [
  { bg: "#e6f3ff", border: "#91caff" },
  { bg: "#e6ffe6", border: "#99e699" },
  { bg: "#fff2e6", border: "#ffcc99" },
  { bg: "#ffe6e6", border: "#ff9999" },
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

  // ---- transport helpers (Village — Cost) ----
  const transportById = useMemo(() => {
    const m = new Map();
    transportations.forEach((t) => m.set(String(t.id), t));
    return m;
  }, [transportations]);

  const formatTransport = (t) => {
    if (!t) return "-";
    const vill = t.Villages || t.village || t.villages || "";
    const cost = t.Cost ?? t.cost;
    return vill ? `${vill}${cost ? ` — ₹${cost}` : ""}` : (cost ? `₹${cost}` : "-");
  };

  const formatTransportById = (id) => {
    if (!id && id !== 0) return "-";
    const t = transportById.get(String(id));
    return formatTransport(t);
  };

  // UI state
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedSessionFilter, setSelectedSessionFilter] = useState("");
  const [hasSiblingFilter, setHasSiblingFilter] = useState("");
  const [importing, setImporting] = useState(false);

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
    if (isAdminOrSuperAdmin) fetchConcessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOrSuperAdmin]);

  // toggle status
  const toggleStudentStatus = async (student) => {
    if (!isAdminOrSuperAdmin) return;
    const newStatus = student.status === "enabled" ? "disabled" : "enabled";

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `Set ${student.name} to ${newStatus}?`,
      icon: "question",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;

    try {
      await api.put(`/students/toggle/${student.id}`, { status: newStatus });
      Swal.fire("Updated", `Student status set to ${newStatus}`, "success");
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
      title: `Delete ${name}?`,
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/students/delete/${id}`);
      Swal.fire("Deleted", "Student deleted.", "success");
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
        await Swal.fire("Uploaded", data?.message || "Photo uploaded", "success");
        fetchStudents();
      } catch (err) {
        console.error("upload photo error:", err);
        Swal.close();
        Swal.fire("Error", err.response?.data?.message || "Failed to upload photo", "error");
      }
    };
    input.click();
  };

  // ---------------- ADD / EDIT with fixed sibling block ----------------
  const showStudentForm = async (mode = "add", student = null) => {
    await fetchClasses();
    await fetchSections();
    await fetchSessions();
    await fetchTransportations();
    if (isAdminOrSuperAdmin) await fetchConcessions();

    const isEdit = mode === "edit";
    const s = student || {};

    // pre-fill +1 for ADD mode
    let nextSuggestion = "";
    if (!isEdit) {
      nextSuggestion = await fetchNextAdmissionNumber();
    }

    const classOptions = `<option value="">Select Class</option>${classes
      .map((c) => `<option value="${c.id}" ${c.id === s.class_id ? "selected" : ""}>${c.class_name}</option>`)
      .join("")}`;
    const sectionOptionsAll = sections.map((sec) => ({
      id: sec.id,
      name: sec.section_name,
      class_id: sec.class_id,
    }));
    const concessionOptions = `<option value="">Select Concession</option>${concessions
      .map((c) => `<option value="${c.id}" ${c.id === s.concession_id ? "selected" : ""}>${c.concession_name}</option>`)
      .join("")}`;
    const sessionOptions = `<option value="">Select Session</option>${sessions
      .map((ss) => `<option value="${ss.id}" ${ss.id === s.session_id ? "selected" : ""}>${ss.name}</option>`)
      .join("")}`;

    // ✨ Transport dropdown now shows "Villages — ₹Cost"
    const transportOptions = `<option value="">No Transport</option>${transportations
      .map((t) => {
        const label = (t?.Villages || "").replace(/"/g, "&quot;");
        const cost = t?.Cost ?? "";
        return `<option value="${t.id}" ${t.id === s.route_id ? "selected" : ""}>${label}${cost ? ` — ₹${cost}` : ""}</option>`;
      })
      .join("")}`;

    const html = `
      <div class="two-col-grid form-container" style="gap:10px;max-height:60vh;overflow:auto;padding-right:8px">
        <div>
          <label>Name <span style="color:#d00">*</span></label>
          <input id="f_name" class="form-field form-control" value="${(s.name || "").replace(/"/g, "&quot;")}" aria-required="true" />
        </div>

        <div>
          <label>Admission Number (optional)</label>
          <input id="f_admission_number" class="form-field form-control"
                value="${isEdit ? (s.admission_number || "") : (s.admission_number || nextSuggestion || "")}" />
        </div>

        <div>
          <label>Father's Name</label>
          <input id="f_father_name" class="form-field form-control" value="${(s.father_name || "").replace(/"/g, "&quot;")}" />
        </div>

        <div>
          <label>Mother's Name</label>
          <input id="f_mother_name" class="form-field form-control" value="${(s.mother_name || "").replace(/"/g, "&quot;")}" />
        </div>

        <div>
          <label>Class <span style="color:#d00">*</span></label>
          <select id="f_class_id" class="form-field form-select" aria-required="true">${classOptions}</select>
        </div>

        <div>
          <label>Section <span style="color:#d00">*</span></label>
          <select id="f_section_id" class="form-field form-select" aria-required="true">
            <option value="">Select Section</option>
            ${sections.map((sec) => `<option value="${sec.id}" data-class="${sec.class_id}" ${sec.id === s.section_id ? "selected" : ""}>${sec.section_name}</option>`).join("")}
          </select>
        </div>

        <div>
          <label>Session</label>
          <select id="f_session_id" class="form-field form-select">${sessionOptions}</select>
        </div>

        <div>
          <label>Admission Type</label>
          <select id="f_admission_type" class="form-field form-select">
            <option value="New" ${s.admission_type === "New" ? "selected" : ""}>New</option>
            <option value="Old" ${s.admission_type === "Old" ? "selected" : ""}>Old</option>
          </select>
        </div>

        <div>
          <label>Roll Number</label>
          <input id="f_roll_number" class="form-field form-control" value="${s.roll_number || ""}" type="number" />
        </div>

        <div>
          <label>Date of Birth</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="f_DOB" class="form-field form-control" value="${s.Date_Of_Birth || ""}" placeholder="YYYY-MM-DD" type="date" inputmode="numeric" />
            <small style="color:#666">(You can pick from calendar or type manually)</small>
          </div>
        </div>

        <div>
          <label>Date of Admission</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="f_date_of_admission" class="form-field form-control" value="${s.date_of_admission || ""}" placeholder="YYYY-MM-DD" type="date" inputmode="numeric" />
            <small style="color:#666">(Calendar + manual)</small>
          </div>
        </div>

        <div>
          <label>Date of Withdraw</label>
          <div style="display:flex;gap:6px;align-items:center">
            <input id="f_date_of_withdraw" class="form-field form-control" value="${s.date_of_withdraw || ""}" placeholder="YYYY-MM-DD" type="date" inputmode="numeric" />
            <small style="color:#666">(Calendar + manual)</small>
          </div>
        </div>

        <div>
          <label>PEN Number</label>
          <input id="f_pen_number" class="form-field form-control" value="${s.pen_number || ""}" />
        </div>

        <div>
          <label>Blood Group</label>
          <input id="f_b_group" class="form-field form-control" value="${s.b_group || ""}" />
        </div>

        <div>
          <label>State</label>
          <select id="f_state" class="form-field form-select">
            <option value="">Select State</option>
            ${STATES.map((st) => `<option value="${st}" ${st === (s.state || "") ? "selected" : ""}>${st}</option>`).join("")}
          </select>
        </div>

        <div>
          <label>Category</label>
          <select id="f_category" class="form-field form-select">
            <option value="">Select Category</option>
            ${CATEGORIES.map((c) => `<option value="${c}" ${c === (s.category || "") ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>

        <div>
          <label>Religion</label>
          <select id="f_religion" class="form-field form-select">
            <option value="">Select Religion</option>
            ${RELIGIONS.map((r) => `<option value="${r}" ${r === (s.religion || "") ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>

        <div>
          <label>Bus Service</label>
          <input id="f_bus_service" class="form-field form-control" value="${s.bus_service || "0"}" />
        </div>

        <div>
          <label>Transport (Village — Cost)</label>
          <select id="f_route_id" class="form-field form-select">
            ${transportOptions}
          </select>
          <small style="color:#666">Select village/stop (optional). The selected transport's id will be saved.</small>
        </div>

        <div>
          <label>Visible</label>
          <select id="f_visible" class="form-field form-select">
            <option value="1" ${s.visible ? "selected" : "selected"}>Yes</option>
            <option value="0" ${!s.visible ? "selected" : ""}>No</option>
          </select>
        </div>

        <div>
          <label>Father Phone</label>
          <input id="f_father_phone" class="form-field form-control" value="${s.father_phone || ""}" maxlength="15" />
        </div>

        <div>
          <label>Mother Phone</label>
          <input id="f_mother_phone" class="form-field form-control" value="${s.mother_phone || ""}" maxlength="15" />
        </div>

        <div>
          <label>Aadhaar</label>
          <input id="f_aadhaar" class="form-field form-control" value="${s.aadhaar_number || ""}" maxlength="15" />
        </div>

        <div class="full-row">
          <label>Address</label>
          <input id="f_address" class="form-field form-control" value="${(s.address || "").replace(/"/g, "&quot;")}" />
        </div>

        <div class="full-row">
          <label>Concession</label>
          <select id="f_concession_id" class="form-field form-select">${concessionOptions}</select>
        </div>

        ${[1,2,3,4].map((slot) => `
          <div class="full-row sibling-block" data-slot="${slot}" style="border:1px solid #eee;padding:8px;border-radius:6px;margin-bottom:8px">
            <label>SIBLING ${slot}</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <select id="sib_class_${slot}" class="form-field form-select" style="min-width:160px">
                <option value="">Select Class</option>
                ${classes.map((c) => `
                  <option value="${c.id}" ${c.id === (s['sibling_class_' + slot] || "") ? "selected" : ""}>
                    ${c.class_name}
                  </option>`).join("")}
              </select>

              <select id="sib_section_${slot}" class="form-field form-select" style="min-width:160px">
                <option value="">All Sections</option>
                ${sections.map((sec) => `
                  <option value="${sec.id}" data-class="${sec.class_id}" ${sec.id === (s['sibling_section_' + slot] || "") ? "selected" : ""}>
                    ${sec.section_name}
                  </option>`).join("")}
              </select>

              <select id="sib_student_${slot}" class="form-field form-select" style="min-width:260px">
                <option value="">Select Student</option>
                ${
                  s['sibling_id_' + slot]
                    ? `<option value="${s['sibling_id_' + slot]}" selected>
                        ${(s['sibling_name_' + slot] || "Selected").replace(/"/g, "&quot;")}
                        ${s['sibling_id_' + slot] ? ` (ID:${s['sibling_id_' + slot]})` : ""}
                      </option>`
                    : ""
                }
              </select>

              <input id="f_sibling_id_${slot}" type="hidden" value="${s['sibling_id_' + slot] || ""}" />
              <input id="f_sibling_name_${slot}" type="hidden" value="${(s['sibling_name_' + slot] || "").replace(/"/g, "&quot;")}" />
            </div>
            <div style="font-size:12px;color:#666;margin-top:6px">Choose class → section (optional) → student. Selected student's admission number & name will be saved.</div>
          </div>
        `).join("")}
      </div>
    `;

    const popup = await Swal.fire({
      title: isEdit ? "Edit Student" : "Add Student",
      width: "1000px",
      html,
      showCancelButton: true,
      focusConfirm: false,
      showLoaderOnConfirm: true,
      preConfirm: () => {
        const rawRouteVal = document.getElementById("f_route_id")?.value;
        const routeVal = rawRouteVal === "" ? null : Number(rawRouteVal);

        const payload = {
          name: document.getElementById("f_name").value.trim(),
          admission_number: document.getElementById("f_admission_number").value.trim() || null,
          father_name: document.getElementById("f_father_name").value.trim(),
          mother_name: document.getElementById("f_mother_name").value.trim(),
          class_id: document.getElementById("f_class_id").value || null,
          section_id: document.getElementById("f_section_id").value || null,
          session_id: document.getElementById("f_session_id").value || null,
          admission_type: document.getElementById("f_admission_type").value,
          roll_number: document.getElementById("f_roll_number").value ? parseInt(document.getElementById("f_roll_number").value, 10) : null,
          Date_Of_Birth: document.getElementById("f_DOB").value || null,
          date_of_admission: document.getElementById("f_date_of_admission").value || null,
          date_of_withdraw: document.getElementById("f_date_of_withdraw").value || null,
          pen_number: document.getElementById("f_pen_number").value || null,
          b_group: document.getElementById("f_b_group").value || null,
          state: document.getElementById("f_state").value || null,
          category: document.getElementById("f_category").value || null,
          religion: document.getElementById("f_religion").value || null,
          bus_service: document.getElementById("f_bus_service").value || "0",
          address: document.getElementById("f_address").value || null,
          father_phone: document.getElementById("f_father_phone").value || null,
          mother_phone: document.getElementById("f_mother_phone").value || null,
          aadhaar_number: document.getElementById("f_aadhaar").value || null,
          concession_id: document.getElementById("f_concession_id")?.value || null,
          visible: document.getElementById("f_visible")?.value === "1",
          route_id: routeVal,
        };

        [1,2,3,4].forEach((slot) => {
          const idVal = document.getElementById(`f_sibling_id_${slot}`)?.value || null;
          const nameVal = document.getElementById(`f_sibling_name_${slot}`)?.value || null;
          payload[`sibling_id_${slot}`] = idVal;
          payload[`sibling_name_${slot}`] = nameVal;
        });

        if (!payload.name) Swal.showValidationMessage("Name is required");
        if (!payload.class_id) Swal.showValidationMessage("Class is required");
        if (!payload.section_id) Swal.showValidationMessage("Section is required");

        return payload;
      },
      didOpen: () => {
        [1,2,3,4].forEach((slot) => {
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
                options.push(`<option value="${sec.id}" ${sec.id === (s.section_id || "") ? "selected" : ""}>${sec.name}</option>`);
              }
            });
            secSel.innerHTML = options.join("");
          };

          const fetchAndPopulateStudents = async (classId, sectionId) => {
            stuSel.innerHTML = `<option value="">Loading students...</option>`;
            if (!classId) {
              stuSel.innerHTML = `<option value="">Select class first</option>`;
              return;
            }
            try {
              const url = `/students/sibling-list?class_id=${classId}${sectionId ? `&section_id=${sectionId}` : ""}`;
              const { data } = await api.get(url);
              if (!Array.isArray(data) || data.length === 0) {
                stuSel.innerHTML = `<option value="">No students found</option>`;
                hiddenId.value = "";
                hiddenName.value = "";
                return;
              }
              const opts = [`<option value="">Select Student</option>`].concat(
                data.map((st) => `<option value="${st.id}" data-name="${(st.name || "").replace(/"/g, "&quot;")}" ${String(st.id) === String(hiddenId.value) ? "selected" : ""}>${st.name}${st.admission_number ? ` (AN:${st.admission_number})` : ""}</option>`)
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
            if (!preClass && preStudentId) {
              const studentObj = students.find((st) => String(st.id) === String(preStudentId));
              if (studentObj) {
                clsSel.value = studentObj.class_id || "";
                populateSectionsForClass(clsSel.value);
                secSel.value = studentObj.section_id || "";
                await fetchAndPopulateStudents(clsSel.value, secSel.value || "");
                const opt = Array.from(stuSel.options).find((o) => o.value === preStudentId);
                if (opt) {
                  opt.selected = true;
                  hiddenName.value = opt.dataset.name || opt.textContent || "";
                }
                return;
              }
            }

            if (preClass) {
              populateSectionsForClass(preClass);
              await fetchAndPopulateStudents(preClass, preSection || "");
              if (preStudentId) {
                const opt = Array.from(stuSel.options).find((o) => o.value === preStudentId);
                if (opt) {
                  opt.selected = true;
                  hiddenName.value = opt.dataset.name || opt.textContent || "";
                }
              }
            } else {
              populateSectionsForClass("");
              stuSel.innerHTML = `<option value="">Select class first</option>`;
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
        Swal.fire("Saved", "Student updated", "success");
      } else {
        await api.post("/students/add", payload);
        Swal.fire("Added", "Student created", "success");
      }
      fetchStudents();
    } catch (err) {
      console.error("showStudentForm submit:", err);
      Swal.fire("Error", err.response?.data?.error || "Failed to save student", "error");
    }
  };

  const handleAdd = () => showStudentForm("add", null);
  const handleEdit = (student) => showStudentForm("edit", student);

  const handleExport = async () => {
    try {
      const resp = await api.get("/students/export-students", { responseType: "blob" });
    const blob = new Blob([resp.data], { type: resp.headers["content-type"] || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Students_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("handleExport:", err);
      Swal.fire("Error", "Failed to export students", "error");
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
      Swal.fire("Imported", res.data?.message || "Import completed", "success");
      if (res.data?.duplicates && res.data.duplicates.length) {
        console.warn("Duplicates:", res.data.duplicates);
        Swal.fire("Imported with duplicates", `${res.data.duplicates.length} rows skipped`, "info");
      }
      fetchStudents();
    } catch (err) {
      console.error("handleImport:", err);
      Swal.fire("Error", err.response?.data?.message || "Failed to import", "error");
    } finally {
      setImporting(false);
    }
  };

  const openImportDialog = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e) => {
      const f = e.target.files[0];
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

  const filteredStudents = students.filter((stu) => {
    const q = search.trim().toLowerCase();
    const textMatch =
      !q ||
      [stu.name, stu.father_name, stu.aadhaar_number, stu.admission_number]
        .some((v) => (v || "").toString().toLowerCase().includes(q));
    const classMatch = !selectedClass || String(stu.class_id) === String(selectedClass);
    const statusMatch = !selectedStatus || stu.status === selectedStatus;
    const sessionMatch = !selectedSessionFilter || String(stu.session_id) === String(selectedSessionFilter);
    const hasSibling = studentHasSibling(stu);
    let siblingMatch = true;
    if (hasSiblingFilter === "has") siblingMatch = hasSibling;
    if (hasSiblingFilter === "no") siblingMatch = !hasSibling;

    return textMatch && classMatch && statusMatch && sessionMatch && siblingMatch;
  });

  const totalCount = filteredStudents.length;
  const enabledCount = filteredStudents.filter((s) => s.status === "enabled").length;
  const disabledCount = filteredStudents.filter((s) => s.status === "disabled").length;

  const handleSiblingClick = async (siblingIdOrAdmission) => {
    if (!siblingIdOrAdmission) return;

    const tryUrls = [
      `/students/${siblingIdOrAdmission}`,
      `/students/admission/${encodeURIComponent(siblingIdOrAdmission)}`,
      `/students?admission_number=${encodeURIComponent(siblingIdOrAdmission)}`,
    ];

    let respData = null;
    let lastError = null;

    for (const url of tryUrls) {
      try {
        const resp = await api.get(url);
        respData = Array.isArray(resp.data) ? (resp.data[0] || null) : resp.data;
        if (respData) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!respData) {
      console.error("handleSiblingClick: none of the endpoints returned a student", lastError);
      Swal.fire("Not found", "Sibling details not found on server (tried multiple endpoints).", "error");
      return;
    }

    handleView(respData);
  };

  const PhotoCell = ({ student }) => {
    const src = buildPhotoURL(student.photo);
    const hasPhoto = !!student.photo;

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <img
          src={hasPhoto ? src : NO_PHOTO_SVG}
          alt={student.name || "Student"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => { e.currentTarget.src = NO_PHOTO_SVG; }}
          style={{
            width: 44,
            height: 44,
            objectFit: "cover",
            borderRadius: 8,
            border: "1px solid #eee",
            background: "#fff",
          }}
        />
        {isAdminOrSuperAdmin && (
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={(ev) => {
              ev.stopPropagation();
              promptAndUploadPhoto(student);
            }}
            title={hasPhoto ? "Replace photo" : "Upload photo"}
          >
            {hasPhoto ? "Change" : "Upload"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Students Management</h1>
        <div className="d-flex gap-2">
          {isAdminOrSuperAdmin && (
            <>
              <button className="btn btn-success" onClick={handleAdd}>
                Add Student
              </button>
              <button className="btn btn-secondary" onClick={openImportDialog} disabled={importing}>
                {importing ? "Importing..." : "Import XLSX"}
              </button>
            </>
          )}
          <button className="btn btn-outline-primary" onClick={handleExport}>
            Export XLSX
          </button>
        </div>
      </div>

      <div className="row mb-3">
        <div className="col-md-4">
          <div className="card text-white bg-success mb-3">
            <div className="card-body">
              <h5 className="card-title">Enabled</h5>
              <p className="card-text">{enabledCount}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-danger mb-3">
            <div className="card-body">
              <h5 className="card-title">Disabled</h5>
              <p className="card-text">{disabledCount}</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card text-white bg-info mb-3">
            <div className="card-body">
              <h5 className="card-title">Total</h5>
              <p className="card-text">{totalCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="d-flex mb-3 align-items-center gap-2 flex-wrap">
        <input
          type="text"
          className="form-control"
          style={{ maxWidth: 300 }}
          placeholder="Search by name/admission/aadhaar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-select" style={{ maxWidth: 220 }} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.class_name}
            </option>
          ))}
        </select>

        <select className="form-select" style={{ maxWidth: 220 }} value={selectedSessionFilter} onChange={(e) => setSelectedSessionFilter(e.target.value)}>
          <option value="">All Sessions</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select className="form-select" style={{ maxWidth: 220 }} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>

        <select
          className="form-select"
          style={{ maxWidth: 220 }}
          value={hasSiblingFilter}
          onChange={(e) => setHasSiblingFilter(e.target.value)}
        >
          <option value="">All Students</option>
          <option value="has">Has Siblings</option>
          <option value="no">No Siblings</option>
        </select>

        <button
          className="btn btn-outline-secondary"
          onClick={() => {
            setSearch("");
            setSelectedClass("");
            setSelectedStatus("");
            setSelectedSessionFilter("");
            setHasSiblingFilter("");
          }}
        >
          Reset
        </button>
      </div>

      <table className="table table-striped table-hover">
        <thead>
          <tr>
            <th>#</th>
            <th>Photo</th>
            <th>Admission #</th>
            <th>Name</th>
            <th>Father</th>
            <th>Class</th>
            <th>Section</th>
            <th>Session</th>
            <th>Aadhaar</th>
            <th>Type</th>
            {isAdminOrSuperAdmin && <th>Concession</th>}
            <th>Transport (Village — Cost)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredStudents.length ? (
            filteredStudents
              .slice()
              .reverse()
              .map((stu, idx) => {
                const siblingNames = [
                  stu.sibling_name_1,
                  stu.sibling_name_2,
                  stu.sibling_name_3,
                  stu.sibling_name_4,
                ].filter(Boolean);
                const siblingIds = [
                  stu.sibling_id_1,
                  stu.sibling_id_2,
                  stu.sibling_id_3,
                  stu.sibling_id_4,
                ].filter(Boolean);
                const combinedSiblings = siblingNames.length
                  ? siblingNames.map((name, i) => ({ name, id: siblingIds[i] || null }))
                  : siblingIds.map((id) => ({ name: `ID:${id}`, id }));

                return (
                  <tr key={stu.id} style={{ cursor: "pointer" }}>
                    <td>{idx + 1}</td>
                    <td onClick={() => handleView(stu)}><PhotoCell student={stu} /></td>
                    <td onClick={() => handleView(stu)}>{stu.admission_number || "-"}</td>
                    <td onClick={() => handleView(stu)} style={{ verticalAlign: "middle" }}>
                      <div>{stu.name}</div>
                      {combinedSiblings.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          {combinedSiblings.map((sibling, i) => (
                            <span
                              key={i}
                              title={sibling.name}
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                marginRight: 6,
                                marginTop: 6,
                                fontSize: 12,
                                background: SIBLING_COLORS[i % SIBLING_COLORS.length].bg,
                                border: `1px solid ${SIBLING_COLORS[i % SIBLING_COLORS.length].border}`,
                                borderRadius: 12,
                                cursor: sibling.id ? "pointer" : "default",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (sibling.id) handleSiblingClick(sibling.id);
                              }}
                            >
                              {sibling.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td onClick={() => handleView(stu)}>{stu.father_name}</td>
                    <td onClick={() => handleView(stu)}>{stu.class_name || "-"}</td>
                    <td onClick={() => handleView(stu)}>{stu.section_name || "-"}</td>
                    <td onClick={() => handleView(stu)}>{stu.session_name || (stu.session_id ? "Assigned" : "-")}</td>
                    <td onClick={() => handleView(stu)}>{stu.aadhaar_number || "-"}</td>
                    <td onClick={() => handleView(stu)}>{stu.admission_type}</td>
                    {isAdminOrSuperAdmin && <td onClick={() => handleView(stu)}>{stu.concession_name || "-"}</td>}
                    <td onClick={() => handleView(stu)}>
                      {formatTransportById(stu.route_id)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {isAdminOrSuperAdmin && (
                        <>
                          <div className="form-check form-switch d-inline-block me-2 align-middle">
                            <input className="form-check-input" type="checkbox" checked={stu.status === "enabled"} onChange={() => toggleStudentStatus(stu)} />
                          </div>
                          <button className="btn btn-primary btn-sm me-2" onClick={() => handleEdit(stu)}>
                            Edit
                          </button>
                          <button
                            className="btn btn-outline-secondary btn-sm me-2"
                            onClick={() => promptAndUploadPhoto(stu)}
                            title={stu.photo ? "Replace Photo" : "Upload Photo"}
                          >
                            {stu.photo ? "Change Photo" : "Upload Photo"}
                          </button>
                        </>
                      )}
                      {isSuperadmin && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(stu.id, stu.name)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
          ) : (
            <tr>
              <td colSpan={isAdminOrSuperAdmin ? 13 : 12} className="text-center">
                No students found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

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

    const fields = [
      { label: 'Admission #', value: student.admission_number || '-' },
      { label: 'Name', value: student.name || '-' },
      { label: "Father's Name", value: student.father_name || '-' },
      { label: "Mother's Name", value: student.mother_name || '-' },
      { label: 'Class', value: student.class_name || '-' },
      { label: 'Section', value: student.section_name || '-' },
      { label: 'Session', value: student.session_name || '-' },
      { label: 'Roll Number', value: student.roll_number || '-' },
      { label: 'DOB', value: student.Date_Of_Birth || '-' },
      { label: 'Date of Admission', value: student.date_of_admission || '-' },
      { label: 'Date of Withdraw', value: student.date_of_withdraw || '-' },
      { label: 'Pen', value: student.pen_number || '-' },
      { label: 'Blood Group', value: student.b_group || '-' },
      { label: 'State', value: student.state || '-' },
      { label: 'Category', value: student.category || '-' },
      { label: 'Religion', value: student.religion || '-' },
      { label: 'Bus Service', value: student.bus_service || '-' },
      { label: 'Visible', value: student.visible ? 'Yes' : 'No' },
      { label: 'P. Phone', value: student.father_phone || '-' },
      { label: 'M. Phone', value: student.mother_phone || '-' },
      { label: 'Aadhaar', value: student.aadhaar_number || '-' },
      { label: 'Admission Type', value: student.admission_type || '-' },
    ];

    if (isAdminOrSuperAdmin) {
      fields.push({ label: 'Concession', value: student.concession_name || '-' });
    }

    // ✨ Details popup: show Village — Cost
    fields.push({ label: 'Transport', value: formatTransportById(student.route_id) });
    fields.push({ label: 'Status', value: student.status || '-' });
    fields.push({ label: 'Address', value: student.address || '-' });

    const photoUrl = buildPhotoURL(student.photo);
    const hasPhoto = !!student.photo;

    const fieldHtml = fields.map(f => `
      <div class="detail-item">
        <div class="detail-label">${f.label}</div>
        <div class="detail-value">${f.value}</div>
      </div>
    `).join('');

    const siblingHtml = siblingRows.length ? siblingRows.map((s, i) => `
      <div class="detail-item sibling-item" data-sibling-id="${s.id || ''}">
        <div class="detail-label">${s.label}</div>
        <div class="detail-value" style="cursor: ${s.id ? 'pointer' : 'default'}; color: ${s.id ? '#007bff' : 'inherit'}" ${s.id ? `data-sibling-id="${s.id}"` : ''}>${s.value}</div>
      </div>
    `).join('') : `
      <div class="detail-item">
        <div class="detail-label">Siblings</div>
        <div class="detail-value">-</div>
      </div>
    `;

    const photoHtml = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px">
        <img src="${hasPhoto ? photoUrl : NO_PHOTO_SVG}" alt="photo" style="width:96px;height:96px;object-fit:cover;border-radius:12px;border:1px solid #eee;background:#fff" />
        ${isAdminOrSuperAdmin ? `<button id="btnChangePhoto" class="swal2-confirm swal2-styled" style="background:#6c757d"> ${hasPhoto ? "Change Photo" : "Upload Photo"} </button>` : ""}
      </div>
    `;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#fff; padding:18px; border-radius:10px;">
        <h2 style="margin:0 0 12px; text-align:center; font-size:22px">${student.name || 'Student'} Details</h2>
        ${photoHtml}
        <div class="details-grid">
          ${fieldHtml}
          ${siblingHtml}
        </div>
      </div>
      <style>
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px 20px;
          max-height: 60vh;
          overflow: auto;
          padding-right: 6px;
        }
        .detail-item {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          border-bottom: 1px solid #f0f0f0;
          padding: 8px 0;
        }
        .detail-label {
          font-weight: 600;
          color: #444;
          flex: 0 0 140px;
        }
        .detail-value {
          color: #222;
          flex: 1 1 auto;
          word-break: break-word;
        }
        .sibling-item .detail-value:hover { text-decoration: underline; }
        .detail-item[data-full="true"] { grid-column: 1 / -1; }
      </style>
    `;

    Swal.fire({
      title: "",
      html,
      width: 1000,
      showCloseButton: true,
      showConfirmButton: false,
      customClass: { popup: "modern-swal-popup" },
      didOpen: () => {
        const popup = document.querySelector('.modern-swal-popup');
        if (popup) {
          const siblingEls = popup.querySelectorAll('[data-sibling-id]');
          siblingEls.forEach(el => {
            const id = el.getAttribute('data-sibling-id');
            if (id) {
              el.addEventListener('click', (e) => {
                e.stopPropagation();
                Swal.close();
                setTimeout(() => handleSiblingClick(id), 50);
              });
            }
          });
        }
        const btn = document.getElementById("btnChangePhoto");
        if (btn && isAdminOrSuperAdmin) {
          btn.addEventListener("click", () => {
            promptAndUploadPhoto(student);
          });
        }
      },
    });
  }
};

export default Students;
