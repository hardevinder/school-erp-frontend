// src/pages/TransferCertificates.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./TransferCertificates.css"; // optional

// ---------- roles helper ----------
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

// ---------- small helpers ----------
const esc = (v = "") => String(v).replace(/"/g, "&quot;");
const toCSV = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");
const toLines = (arr) => (Array.isArray(arr) ? arr.join("\n") : String(arr || "").split(",").map((s) => s.trim()).join("\n"));
const fromLines = (str) => String(str || "").split("\n").map((s) => s.trim()).filter(Boolean);
const fromCSV = (str) =>
  String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// human-ish date
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

const asDDMMYYYY = (v) => {
  if (!v) return "";
  let s = String(v).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// ---- debounce ----
const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

/** ================== DATE NORMALIZER ==================
 * Returns a YYYY-MM-DD string suitable for storage / date input.
 * Accepts: YYYY-MM-DD, YYYY-MM-DDTHH:mm, DD-MM-YYYY, DD/MM/YYYY, etc.
 */
const toDateInput = (v) => {
  if (!v) return "";
  const s = String(v).trim();
  if (!s || s.startsWith("0000-00-00")) return "";

  // Already perfect: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // ISO or SQL with time: take first 10
  const ymdTime = s.match(
    /^(\d{4}-\d{2}-\d{2})[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(Z)?$/i
  );
  if (ymdTime) return ymdTime[1];

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  // Fallback: Date parse -> ISO -> first 10
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
};

// Ensure the record we pass to the modal has normalized dates
const normalizeTcForModal = (tc = {}) => {
  const rawDob =
    tc?.dob ??
    tc?.date_of_birth ??
    tc?.DOB ??
    tc?.birthdate ??
    tc?.birth_date ??
    ""; // legacy keys if any
  const normDob = toDateInput(rawDob);
  return {
    ...tc,
    dob: normDob, // legacy
    dob_figures: tc.dob_figures || asDDMMYYYY(normDob),
    dob_words: tc.dob_words || "",
    first_admission_date: toDateInput(tc.first_admission_date),
    date_application: toDateInput(tc.date_application),
    date_struck_off: toDateInput(tc.date_struck_off),
    date_issue: toDateInput(tc.date_issue),
  };
};

// ---- quick search for students (uses your /students/search) ----
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
    const r = await api.get(`/students/admission/${encodeURIComponent(admission_number)}`);
    const data = Array.isArray(r.data) ? r.data[0] : r.data;
    if (data?.id) return Number(data.id);
  } catch {}

  try {
    const r = await api.get(`/students`, { params: { admission_number } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const hit =
      arr.find(
        (s) => String(s.admission_number || "").trim() === String(admission_number).trim()
      ) || arr[0];
    if (hit?.id) return Number(hit.id);
  } catch {}
  return null;
}

// ---------- TC modal HTML ----------
const modalHtml = (tc = {}) => {
  const s = tc || {};
  const scYes = s.is_sc_st_obc === "Yes";
  const failedYes = s.is_failed === "Yes";
  const qualYes = s.is_qualified_promotion === "Yes";
  const feeYes = s.fee_concession_yesno === "Yes";
  const nccYes = s.ncc_yesno === "Yes";
  return `
    <style>
      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .full { grid-column: 1 / -1; }
      .form-label { font-weight: 600; margin-bottom: 4px; }
      .form-field { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; }
      .hint { font-size: 12px; color: #6b7280; }
      select.form-field { padding: 6px 10px; }
      textarea.form-field { resize: vertical; }
    </style>

    <div class="form-grid">
      <div>
        <label class="form-label">Serial No.</label>
        <input id="swal-serial" class="form-field" value="${esc(s.serial_no)}" placeholder="e.g., 0052">
      </div>
      <div>
        <label class="form-label">PEN Number</label>
        <input id="swal-pen" class="form-field" value="${esc(s.pen_number || "")}" placeholder="Student PEN">
      </div>
      <div>
        <label class="form-label">Admission No.</label>
        <input id="swal-adm" class="form-field" value="${esc(s.admission_no)}" placeholder="e.g., TPIS-287">
      </div>
      <div class="full">
        <label class="form-label">Session Text</label>
        <input id="swal-session" class="form-field" value="${esc(s.session_text || "Apr 2024-Mar 2025")}" placeholder="e.g., Apr 2024-Mar 2025">
      </div>

      <div>
        <label class="form-label">Student Name</label>
        <input id="swal-student" class="form-field" value="${esc(s.student_name)}" placeholder="e.g., YUVRAJ PHONSA">
      </div>
      <div>
        <label class="form-label">Father's Name</label>
        <input id="swal-fname" class="form-field" value="${esc(s.father_name)}" placeholder="e.g., VIJAY KUMAR">
      </div>
      <div>
        <label class="form-label">Mother's Name</label>
        <input id="swal-mname" class="form-field" value="${esc(s.mother_name)}" placeholder="e.g., SUREKHA DEVI">
      </div>

      <div class="full">
        <label class="form-label">DOB (Figures: DD/MM/YYYY)</label>
        <input id="swal-dob-fig" class="form-field" value="${esc(s.dob_figures)}" placeholder="25/01/2010">
      </div>
      <div class="full">
        <label class="form-label">DOB (Words)</label>
        <textarea id="swal-dob-words" class="form-field" rows="2" placeholder="Twenty fifth of January Two Thousand And Ten">${esc(s.dob_words)}</textarea>
      </div>
      <div>
        <label class="form-label">Proof for DOB</label>
        <input id="swal-proof-dob" class="form-field" value="${esc(s.proof_dob || "Birth Certificate")}" placeholder="Birth Certificate">
      </div>
      <div>
        <label class="form-label">SC/ST/OBC</label>
        <select id="swal-scst" class="form-field">
          <option value="Yes" ${scYes ? "selected" : ""}>Yes</option>
          <option value="No" ${!scYes ? "selected" : ""}>No</option>
        </select>
      </div>

      <div>
        <label class="form-label">First Admission Date</label>
        <input id="swal-first-adm-date" type="date" class="form-field" value="${esc(asYMD(s.first_admission_date))}">
      </div>
      <div>
        <label class="form-label">First Admission Class</label>
        <input id="swal-first-class" class="form-field" value="${esc(s.first_class || "")}">
      </div>

      <div>
        <label class="form-label">Last Class (Figure)</label>
        <input id="swal-last-fig" class="form-field" value="${esc(s.last_class_figure || "")}" placeholder="e.g., 10TH">
      </div>
      <div>
        <label class="form-label">Last Class (Words)</label>
        <input id="swal-last-words" class="form-field" value="${esc(s.last_class_words || "")}" placeholder="e.g., TENTH">
      </div>
      <div class="full">
        <label class="form-label">Last Exam Result</label>
        <input id="swal-last-res" class="form-field" value="${esc(s.last_exam_result || "Passed AISSE(X)")}" placeholder="e.g., Passed AISSE(X)">
      </div>
      <div>
        <label class="form-label">Failed in Class?</label>
        <select id="swal-failed" class="form-field">
          <option value="No" ${!failedYes ? "selected" : ""}>No</option>
          <option value="Yes" ${failedYes ? "selected" : ""}>Yes</option>
        </select>
      </div>

      <div class="full">
        <label class="form-label">Subjects Studied (one per line)</label>
        <textarea id="swal-subjects" class="form-field" rows="4" placeholder="English&#10;Hindi&#10;Mathematics&#10;...">${esc(toLines(s.subjects || []))}</textarea>
      </div>

      <div>
        <label class="form-label">Qualified for Promotion?</label>
        <select id="swal-qualified" class="form-field">
          <option value="Yes" ${qualYes ? "selected" : ""}>Yes</option>
          <option value="No" ${!qualYes ? "selected" : ""}>No</option>
        </select>
      </div>
      <div>
        <label class="form-label">Working Days</label>
        <input id="swal-wd" type="number" min="0" class="form-field" value="${esc(s.working_days || "")}">
      </div>
      <div>
        <label class="form-label">Presence Days</label>
        <input id="swal-pd" type="number" min="0" class="form-field" value="${esc(s.presence_days || "")}">
      </div>

      <div>
        <label class="form-label">Fees Paid Upto</label>
        <input id="swal-feeupto" class="form-field" value="${esc(s.fees_paid_upto || "")}" placeholder="e.g., March 2025">
      </div>
      <div>
        <label class="form-label">Fee Concession?</label>
        <select id="swal-fee-yesno" class="form-field">
          <option value="No" ${!feeYes ? "selected" : ""}>No</option>
          <option value="Yes" ${feeYes ? "selected" : ""}>Yes</option>
        </select>
      </div>
      <div>
        <label class="form-label">Fee Concession Nature</label>
        <input id="swal-fee-nature" class="form-field" value="${esc(s.fee_concession || "")}" placeholder="If yes, e.g., Sibling 25%">
      </div>

      <div>
        <label class="form-label">NCC Cadet/Scout/Guide?</label>
        <select id="swal-ncc-yesno" class="form-field">
          <option value="No" ${!nccYes ? "selected" : ""}>No</option>
          <option value="Yes" ${nccYes ? "selected" : ""}>Yes</option>
        </select>
      </div>
      <div>
        <label class="form-label">NCC/Scout/Guide Details</label>
        <input id="swal-ncc-details" class="form-field" value="${esc(s.ncc_details || "")}" placeholder="If yes, details">
      </div>

      <div class="full">
        <label class="form-label">Games/Extra Curricular</label>
        <input id="swal-games" class="form-field" value="${esc(s.games_eca || "NA")}" placeholder="NA or details">
      </div>

      <div>
        <label class="form-label">Date of Application</label>
        <input id="swal-date-app" type="date" class="form-field" value="${esc(asYMD(s.date_application))}">
      </div>
      <div>
        <label class="form-label">Date Struck Off Rolls</label>
        <input id="swal-date-struck" type="date" class="form-field" value="${esc(asYMD(s.date_struck_off))}">
      </div>
      <div>
        <label class="form-label">Date of Issue</label>
        <input id="swal-date-issue" type="date" class="form-field" value="${esc(asYMD(s.date_issue))}">
      </div>

      <div class="full">
        <label class="form-label">Remarks</label>
        <textarea id="swal-remarks" class="form-field" rows="3">${esc(s.remarks || "")}</textarea>
      </div>
    </div>
  `;
};

export default function TransferCertificates() {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canManage = isAdmin || isSuperadmin;

  // list state
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // fetch list
  const fetchList = async (opts = {}) => {
    const params = new URLSearchParams();
    const search = opts.search ?? q;
    const st = opts.status ?? status;
    const p = opts.page ?? page;

    if (search) params.set("search", search);
    if (st) params.set("status", st);
    params.set("page", p);
    params.set("pageSize", pageSize);

    setLoading(true);
    try {
      const { data } = await api.get(`/tc?${params.toString()}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPage(Number(data?.page) || 1);
      setTotalPages(Number(data?.totalPages) || 1);
    } catch (err) {
      console.error("fetchList error:", err);
      Swal.fire("Error", "Failed to fetch transfer certificates.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------- Create (prefill) with AUTOCOMPLETE -----------
  const handleCreate = async () => {
    let chosen = { student_id: "", admission_number: "", school_id: "" };
    let cache = [];

    await Swal.fire({
      title: "Create Transfer Certificate",
      width: "820px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: `
        <style>
          .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .form-label{font-weight:600;margin-bottom:4px}
          .form-field{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px}
          .hint{font-size:12px;color:#6b7280}
        </style>
        <div class="form-grid">
          <div>
            <label class="form-label">Admission No.</label>
            <input id="tc-admno" class="form-field" list="admno-list" placeholder="Type to search...">
            <datalist id="admno-list"></datalist>
            <div class="hint">Type at least 2 characters</div>
          </div>
          <div>
            <label class="form-label">Student Name</label>
            <input id="tc-stuname" class="form-field" list="stuname-list" placeholder="Type to search...">
            <datalist id="stuname-list"></datalist>
            <div class="hint">Type at least 2 characters</div>
          </div>
          <div>
            <label class="form-label">School ID</label>
            <input id="tc-schoolid" type="number" class="form-field" placeholder="optional if single school">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Create Draft",
      didOpen: () => {
        const popup = Swal.getPopup();
        const $adm = popup.querySelector("#tc-admno");
        const $admList = popup.querySelector("#admno-list");
        const $name = popup.querySelector("#tc-stuname");
        const $nameList = popup.querySelector("#stuname-list");
        const $sid = popup.querySelector("#tc-schoolid");

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

        $sid?.addEventListener("input", (e) => {
          chosen.school_id = (e.target.value || "").trim();
        });
      },
      preConfirm: async () => {
        const p = Swal.getPopup();
        const admText = (p.querySelector("#tc-admno")?.value || "").trim();
        const nameText = (p.querySelector("#tc-stuname")?.value || "").trim();
        const schoolId = (p.querySelector("#tc-schoolid")?.value || "").trim();

        if (!chosen.student_id) {
          const tryExtractAdm = (s) => {
            if (!s) return "";
            const parts = s.split("—").map((x) => x.trim());
            const cand = parts.find((x) => /[A-Za-z]*\d/.test(x) || x.includes("/")) || parts[0];
            return cand || "";
          };
          const fromFieldsAdm = tryExtractAdm(admText) || tryExtractAdm(nameText) || "";

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
          school_id: schoolId ? Number(schoolId) : undefined,
        };
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const { student_id, school_id } = res.value || {};
        const { data } = await api.post(`/tc/${student_id}`, { school_id });
        Swal.fire("Draft Created", `TC #${data?.serial_no || data?.id} created.`, "success");
        await fetchList({ page: 1 });
        if (data?.id) {
          handleEdit({ id: data.id, serial_no: data?.serial_no });
        }
      } catch (err) {
        console.error("create TC error:", err);
        Swal.fire("Error", err?.response?.data?.error || "Failed to create TC.", "error");
      }
    });
  };

  // ----------- Edit (draft only) -----------
  const handleEdit = async (row) => {
    if (row.status !== "draft") {
      Swal.fire("Locked", "Only DRAFT TCs can be edited.", "info");
      return;
    }

    // Get the freshest single row
    let full = row;
    try {
      const { data } = await api.get(`/tc/${row.id}`);
      full = data || row;
    } catch {
      // fall back to the list row
    }

    // Normalize for modal
    const tc = normalizeTcForModal(full);

    await Swal.fire({
      title: `Edit TC (Serial: ${tc.serial_no})`,
      width: "900px",
      html: modalHtml(tc),
      showCancelButton: true,
      confirmButtonText: "Save",

      preConfirm: () => {
        const p = Swal.getPopup();
        const payload = {
          serial_no: p.querySelector("#swal-serial").value.trim() || null,
          pen_number: p.querySelector("#swal-pen").value.trim() || null,
          admission_no: p.querySelector("#swal-adm").value.trim() || null,
          student_name: p.querySelector("#swal-student").value.trim(),
          father_name: p.querySelector("#swal-fname").value.trim(),
          mother_name: p.querySelector("#swal-mname").value.trim(),
          dob_figures: p.querySelector("#swal-dob-fig").value.trim() || null,
          dob_words: p.querySelector("#swal-dob-words").value.trim() || null,
          proof_dob: p.querySelector("#swal-proof-dob").value.trim() || null,
          is_sc_st_obc: p.querySelector("#swal-scst").value,
          first_admission_date: toDateInput(p.querySelector("#swal-first-adm-date").value) || null,
          first_class: p.querySelector("#swal-first-class").value.trim() || null,
          last_class_figure: p.querySelector("#swal-last-fig").value.trim() || null,
          last_class_words: p.querySelector("#swal-last-words").value.trim() || null,
          last_exam_result: p.querySelector("#swal-last-res").value.trim() || null,
          is_failed: p.querySelector("#swal-failed").value,
          subjects: fromLines(p.querySelector("#swal-subjects").value),
          is_qualified_promotion: p.querySelector("#swal-qualified").value,
          working_days: Number(p.querySelector("#swal-wd").value) || null,
          presence_days: Number(p.querySelector("#swal-pd").value) || null,
          fees_paid_upto: p.querySelector("#swal-feeupto").value.trim() || null,
          fee_concession_yesno: p.querySelector("#swal-fee-yesno").value,
          fee_concession: p.querySelector("#swal-fee-nature").value.trim() || null,
          ncc_yesno: p.querySelector("#swal-ncc-yesno").value,
          ncc_details: p.querySelector("#swal-ncc-details").value.trim() || null,
          games_eca: p.querySelector("#swal-games").value.trim() || null,
          date_application: toDateInput(p.querySelector("#swal-date-app").value) || null,
          date_struck_off: toDateInput(p.querySelector("#swal-date-struck").value) || null,
          date_issue: toDateInput(p.querySelector("#swal-date-issue").value) || null,
          remarks: p.querySelector("#swal-remarks").value.trim() || null,
          session_text: p.querySelector("#swal-session").value.trim() || null,
        };
        if (!payload.student_name) {
          Swal.showValidationMessage("Student Name is required");
          return false;
        }
        return payload;
      },
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        await api.patch(`/tc/${row.id}`, r.value);
        Swal.fire("Saved", "Draft updated successfully.", "success");
        fetchList();
      } catch (err) {
        console.error("update TC error:", err);
        Swal.fire("Error", err?.response?.data?.error || "Failed to update TC.", "error");
      }
    });
  };

  // ----------- Issue -----------
  const handleIssue = async (tc) => {
    if (tc.status === "issued") {
      Swal.fire("Already Issued", "This TC is already issued.", "info");
      return;
    }
    const ok = await Swal.fire({
      title: "Issue Certificate?",
      text: `This will lock the TC (Serial: ${tc.serial_no}).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Issue",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.post(`/tc/${tc.id}/issue`);
      Swal.fire("Issued", "TC issued successfully.", "success");
      fetchList();
    } catch (err) {
      console.error("issue TC error:", err);
      Swal.fire("Error", err?.response?.data?.error || "Failed to issue TC.", "error");
    }
  };

  // ----------- Cancel -----------
  const handleCancel = async (tc) => {
    const ok = await Swal.fire({
      title: "Cancel Certificate?",
      text: `This will mark TC (Serial: ${tc.serial_no}) as cancelled.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Cancel",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.post(`/tc/${tc.id}/cancel`);
      Swal.fire("Cancelled", "TC cancelled.", "success");
      fetchList();
    } catch (err) {
      console.error("cancel TC error:", err);
      Swal.fire("Error", err?.response?.data?.error || "Failed to cancel TC.", "error");
    }
  };

  // ----------- Delete -----------
  const handleDelete = async (tc) => {
    if (!isSuperadmin) {
      Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
      return;
    }
    const ok = await Swal.fire({
      title: "Delete TC?",
      text: `Permanently delete TC (Serial: ${tc.serial_no}).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.delete(`/tc/${tc.id}`);
      Swal.fire("Deleted", "TC removed successfully.", "success");
      fetchList({ page: 1 });
    } catch (err) {
      console.error("delete TC error:", err);
      Swal.fire("Error", err?.response?.data?.error || "Failed to delete TC.", "error");
    }
  };

  // ----------- PDF (fetch as blob so auth is included) -----------
  const handlePdf = async (tc) => {
    try {
      const resp = await api.get(`/tc/${tc.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      // Try opening in a new tab; if blocked, show download dialog:
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `TC_${tc.serial_no || tc.id}.pdf`;
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
        "PDF not available (check if issued/authenticated).";
      Swal.fire("Error", msg, "error");
    }
  };

  const onSearch = () => fetchList({ page: 1 });
  const resetFilters = () => {
    setQ("");
    setStatus("");
    fetchList({ search: "", status: "", page: 1 });
  };

  // tiny helper used only in the "View" popup
  function tc_father(tc) {
    return tc.father_name || tc.father || "";
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Transfer Certificates</h1>
        {canManage && (
          <button className="btn btn-success" onClick={handleCreate}>
            Create From Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 300 }}
            placeholder="Search serial, admission no, student/father name..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
          />
          <select
            className="form-select"
            style={{ maxWidth: 180 }}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              fetchList({ status: e.target.value, page: 1 });
            }}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="cancelled">Cancelled</option>
          </select>
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
              <th>Serial</th>
              <th>Admission #</th>
              <th>Student</th>
              <th>Father</th>
              <th>Status</th>
              <th>Issue Date</th>
              <th>Subjects</th>
              <th>Working/Presence</th>
              <th>Fees Upto</th>
              <th>School</th>
              <th style={{ minWidth: 230 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tc, i) => {
              const details = {
                "Student": tc.student_name,
                "Father": tc_father(tc),
                "Mother": tc.mother_name,
                "DOB": `${tc.dob_figures || asDDMMYYYY(tc.dob)} (${tc.dob_words || ''})`,
                "Proof DOB": tc.proof_dob || "—",
                "SC/ST/OBC": tc.is_sc_st_obc || "No",
                "First Admission": `${asDDMMYYYY(tc.first_admission_date)} Class ${tc.first_class || ''}`,
                "Last Class": `${tc.last_class_figure || ''} (${tc.last_class_words || ''})`,
                "Last Exam": tc.last_exam_result || "—",
                "Failed": tc.is_failed || "No",
                "Subjects": toCSV(tc.subjects),
                "Qualified": tc.is_qualified_promotion || "No",
                "Working Days": tc.working_days || 0,
                "Presence": tc.presence_days || 0,
                "Attendance %": tc.presence_days && tc.working_days ? Math.round((tc.presence_days / tc.working_days) * 100) + '%' : "—",
                "Fees Upto": tc.fees_paid_upto || "—",
                "Fee Concession": `${tc.fee_concession_yesno || "No"} ${tc.fee_concession || ""}`.trim(),
                "NCC": `${tc.ncc_yesno || "No"}: ${tc.ncc_details || ""}`,
                "Games/ECA": tc.games_eca || "NA",
                "Struck Off": asDDMMYYYY(tc.date_struck_off) || "—",
                "Issue Date": asDDMMYYYY(tc.date_issue || tc.issue_date) || "—",
                "Remarks": tc.remarks || "—",
              };
              return (
              <tr key={tc.id}>
                <td>{(page - 1) * pageSize + i + 1}</td>
                <td className="fw-semibold">{tc.serial_no}</td>
                <td>{tc.admission_no}</td>
                <td>{tc.student_name}</td>
                <td>{tc_father(tc)}</td>
                <td>
                  {tc.status === "draft" && <span className="badge bg-warning text-dark">Draft</span>}
                  {tc.status === "issued" && <span className="badge bg-success">Issued</span>}
                  {tc.status === "cancelled" && <span className="badge bg-secondary">Cancelled</span>}
                </td>
                <td>{asYMD(tc.issue_date) || "—"}</td>
                <td
                  title={toCSV(tc.subjects)}
                  style={{ maxWidth: 180, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
                >
                  {toCSV(tc.subjects)}
                </td>
                <td>
                  {(tc.working_days ?? 0)}/{(tc.presence_days ?? 0)}
                </td>
                <td>{tc.fees_paid_upto || "—"}</td>
                <td>{tc.school?.name || "—"}</td>
                <td>
                  <div className="d-flex flex-wrap gap-1">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() =>
                        Swal.fire({
                          title: `TC Details (Serial: ${tc.serial_no})`,
                          html: `
                            <div style="text-align:left; white-space: pre-wrap;">
                              ${Object.entries(details).map(([k, v]) => `<div><b>${k}:</b> ${esc(v)}</div>`).join("")}
                            </div>
                          `,
                          confirmButtonText: "Close",
                          width: "600px",
                        })
                      }
                    >
                      View
                    </button>

                    {canManage && tc.status === "draft" && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleEdit(tc)}>
                        Edit
                      </button>
                    )}

                    {canManage && tc.status !== "issued" && (
                      <button className="btn btn-success btn-sm" onClick={() => handleIssue(tc)}>
                        Issue
                      </button>
                    )}

                    {canManage && tc.status !== "cancelled" && (
                      <button className="btn btn-warning btn-sm" onClick={() => handleCancel(tc)}>
                        Cancel
                      </button>
                    )}

                    {canManage && (
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(tc)}>
                        Delete
                      </button>
                    )}

                    <button className="btn btn-outline-primary btn-sm" onClick={() => handlePdf(tc)}>
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            )})}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center">
                  No records found
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={12} className="text-center">
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