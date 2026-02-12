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
const esc = (v = "") => String(v ?? "").replace(/"/g, "&quot;");
const toCSV = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");
const toLines = (arr) =>
  Array.isArray(arr)
    ? arr.join("\n")
    : String(arr || "")
        .split(",")
        .map((s) => s.trim())
        .join("\n");
const fromLines = (str) =>
  String(str || "")
    .split("\n")
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
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}/${d.getFullYear()}`;
};

/** ================== DATE NORMALIZER ==================
 * Returns a YYYY-MM-DD string suitable for storage / date input.
 * Accepts: YYYY-MM-DD, YYYY-MM-DDTHH:mm, DD-MM-YYYY, DD/MM/YYYY, etc.
 */
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
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
};

// Ensure the record we pass to the modal has normalized dates
const normalizeTcForModal = (tc = {}) => {
  const rawDob =
    tc?.dob ?? tc?.date_of_birth ?? tc?.DOB ?? tc?.birthdate ?? tc?.birth_date ?? "";
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

// ---------- resolve student strictly by Admission No ----------
async function resolveStudentIdByAdmission(admission_number) {
  if (!admission_number) return null;
  const adm = String(admission_number).trim();

  // 1) Try /students/admission/:adm
  try {
    const r = await api.get(`/students/admission/${encodeURIComponent(adm)}`);
    const data = Array.isArray(r.data) ? r.data[0] : r.data;
    if (data?.id && String(data.admission_number || "").trim() === adm) {
      return Number(data.id);
    }
  } catch (e) {
    console.error("resolve by /students/admission failed", e);
  }

  // 2) Try /students?admission_number=ADM
  try {
    const r = await api.get("/students", { params: { admission_number: adm } });
    const arr = Array.isArray(r.data) ? r.data : [];
    const hit = arr.find((s) => String(s.admission_number || "").trim() === adm);
    if (hit?.id) return Number(hit.id);
  } catch (e) {
    console.error("resolve by /students?admission_number failed", e);
  }

  return null;
}

// ---------- student search (name OR admission) ----------
async function searchStudentsSmart(term) {
  const qRaw = String(term || "").trim();
  if (!qRaw) return [];

  const q = qRaw.toLowerCase();

const tries = [
  // ✅ NEW correct route
  () => api.get("/students/search", { params: { q: qRaw, limit: 50 } }),

  // (optional fallback) exact admission lookup if you want
  // () => api.get(`/students/admission/${encodeURIComponent(qRaw)}`),
];


  let arr = [];
  for (const fn of tries) {
    try {
      const r = await fn();
      const data = r?.data;

   const raw = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
    ? data.rows
    : [];

      arr = raw.map((s) => ({
        id: s.id,
        name: (s.name || s.student_name || "").trim(),
        admission_number: String(s.admission_number || s.admission_no || "").trim(),
        father_name: (s.father_name || s.father || "").trim(),
        class_name: s.class?.name || s.class_name || "",
        section_name: s.section?.name || s.section_name || "",
      }));

      break; // stop after first successful response
    } catch (e) {
      console.error("student search failed:", e?.response?.status, e?.response?.data || e.message);
    }
  }

  // ✅ client-side filtering (name OR admission)
  const filtered = arr.filter((s) => {
    const name = (s.name || "").toLowerCase();
    const adm = (s.admission_number || "").toLowerCase();
    return name.includes(q) || adm.includes(q);
  });

  // ✅ relevance sorting (best matches first)
  const score = (s) => {
    const name = (s.name || "").toLowerCase();
    const adm = (s.admission_number || "").toLowerCase();

    // exact admission match highest
    if (adm === q) return 1000;

    // startsWith beats contains
    let sc = 0;
    if (adm.startsWith(q)) sc += 400;
    if (name.startsWith(q)) sc += 300;
    if (adm.includes(q)) sc += 200;
    if (name.includes(q)) sc += 150;

    // prefer shorter matches (more specific)
    sc += Math.max(0, 50 - adm.length);
    sc += Math.max(0, 50 - name.length);

    return sc;
  };

  filtered.sort((a, b) => score(b) - score(a));

  return filtered.slice(0, 15);
}

function buildStudentLabel(s) {
  const adm = s.admission_number ? `(${s.admission_number})` : "";
  const cls = [s.class_name, s.section_name].filter(Boolean).join("-");
  const tail = [s.father_name ? `F: ${s.father_name}` : "", cls ? `• ${cls}` : ""]
    .filter(Boolean)
    .join(" ");
  return `${s.name || "—"} ${adm}${tail ? " — " + tail : ""}`.trim();
}

// ---------- TC modal HTML (TABBED + COMPACT/EXPAND) ----------
const modalHtmlTabbed = (tc = {}) => {
  const s = tc || {};
  const scYes = s.is_sc_st_obc === "Yes";
  const failedYes = s.is_failed === "Yes";
  const qualYes = s.is_qualified_promotion === "Yes";
  const feeYes = s.fee_concession_yesno === "Yes";
  const nccYes = s.ncc_yesno === "Yes";

  return `
  <style>
    /* keep header small */
    .swal2-title { margin: 6px 0 8px !important; font-size: 16px !important; }
    .swal2-html-container { margin: 0 !important; padding: 0 !important; }

    .tc-topbar{
      display:flex; align-items:center; justify-content:space-between;
      gap:10px; padding:10px 10px 0 10px;
    }
    .tc-topbar .meta{
      font-size:12px; color:#6b7280; text-align:left;
      line-height:1.2;
    }
    .tc-topbar .btn-mini{
      border:1px solid #d1d5db; background:#fff; border-radius:8px;
      padding:6px 10px; font-size:12px; cursor:pointer;
    }
    .tc-topbar .btn-mini:hover{ background:#f9fafb; }

    .tc-tabs{
      display:flex; gap:8px; flex-wrap:wrap;
      padding:10px; padding-bottom:0;
    }
    .tc-tab{
      border:1px solid #e5e7eb; background:#fff; border-radius:999px;
      padding:6px 10px; font-size:12px; cursor:pointer;
      user-select:none;
    }
    .tc-tab.active{
      background:#111827; color:#fff; border-color:#111827;
    }

    .tc-panel{
      padding:10px;
      max-height: 62vh;
      overflow:auto;
    }

    /* form grid (default: 2 columns) */
    .tc-form-grid{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
      align-items:start;
    }
    /* compact mode reduces gaps + keeps 2 col */
    .tc-form-grid.compact{
      gap:8px;
    }
    /* expanded = single column for ultra-small screens */
    .tc-form-grid.expanded{
      grid-template-columns: 1fr;
    }

    .full{ grid-column: 1 / -1; }
    .tc-label{ font-weight:600; margin-bottom:4px; font-size:12px; }
    .tc-field{
      width:100%;
      padding:8px 10px;
      border:1px solid #d1d5db;
      border-radius:10px;
      font-size:13px;
      outline:none;
    }
    select.tc-field{ padding:7px 10px; }
    textarea.tc-field{ resize: vertical; }
    .tc-hint{ font-size:11px; color:#6b7280; margin-top:4px; }
    .tc-divider{
      height:1px; background:#eef2f7; margin:8px 0;
      grid-column: 1 / -1;
    }
  </style>

  <div class="tc-topbar">
    <div class="meta">
      <div><b>Serial:</b> ${esc(s.serial_no || "")}</div>
      <div><b>Admission:</b> ${esc(s.admission_no || "")}</div>
    </div>
    <div style="display:flex; gap:8px;">
      <button type="button" id="tc-layout-toggle" class="btn-mini" title="Toggle 2-col / 1-col">
        Expand / Compact
      </button>
    </div>
  </div>

  <div class="tc-tabs" id="tc-tabs">
    <div class="tc-tab active" data-tab="basic">Basic</div>
    <div class="tc-tab" data-tab="academic">Academic</div>
    <div class="tc-tab" data-tab="attendance">Attendance & Fees</div>
    <div class="tc-tab" data-tab="activities">Activities</div>
    <div class="tc-tab" data-tab="dates">Dates & Remarks</div>
  </div>

  <div class="tc-panel">
    <!-- BASIC -->
    <div class="tc-tabpanel" data-tabpanel="basic">
      <div class="tc-form-grid compact" id="tc-grid">
        <div>
          <label class="tc-label">Serial No.</label>
          <input id="swal-serial" class="tc-field" value="${esc(s.serial_no)}" placeholder="e.g., 0052">
        </div>
        <div>
          <label class="tc-label">PEN Number</label>
          <input id="swal-pen" class="tc-field" value="${esc(s.pen_number || "")}" placeholder="Student PEN">
        </div>

        <div>
          <label class="tc-label">Admission No.</label>
          <input id="swal-adm" class="tc-field" value="${esc(s.admission_no)}" placeholder="e.g., TPIS-287">
        </div>
        <div>
          <label class="tc-label">Session Text</label>
          <input id="swal-session" class="tc-field" value="${esc(
            s.session_text || "Apr 2024-Mar 2025"
          )}" placeholder="e.g., Apr 2024-Mar 2025">
        </div>

        <div>
          <label class="tc-label">Student Name</label>
          <input id="swal-student" class="tc-field" value="${esc(s.student_name)}" placeholder="Student Name">
        </div>
        <div>
          <label class="tc-label">Father's Name</label>
          <input id="swal-fname" class="tc-field" value="${esc(s.father_name)}" placeholder="Father Name">
        </div>

        <div class="full">
          <label class="tc-label">Mother's Name</label>
          <input id="swal-mname" class="tc-field" value="${esc(s.mother_name)}" placeholder="Mother Name">
        </div>

        <div class="full tc-divider"></div>

        <div class="full">
          <label class="tc-label">DOB (Figures: DD/MM/YYYY)</label>
          <input id="swal-dob-fig" class="tc-field" value="${esc(s.dob_figures)}" placeholder="25/01/2010">
        </div>
        <div class="full">
          <label class="tc-label">DOB (Words)</label>
          <textarea id="swal-dob-words" class="tc-field" rows="2" placeholder="Twenty fifth of January Two Thousand And Ten">${esc(
            s.dob_words
          )}</textarea>
        </div>

        <div>
          <label class="tc-label">Proof for DOB</label>
          <input id="swal-proof-dob" class="tc-field" value="${esc(
            s.proof_dob || "Birth Certificate"
          )}" placeholder="Birth Certificate">
        </div>
        <div>
          <label class="tc-label">SC/ST/OBC</label>
          <select id="swal-scst" class="tc-field">
            <option value="Yes" ${scYes ? "selected" : ""}>Yes</option>
            <option value="No" ${!scYes ? "selected" : ""}>No</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ACADEMIC -->
    <div class="tc-tabpanel" data-tabpanel="academic" style="display:none">
      <div class="tc-form-grid compact" id="tc-grid-academic">
        <div>
          <label class="tc-label">First Admission Date</label>
          <input id="swal-first-adm-date" type="date" class="tc-field" value="${esc(
            asYMD(s.first_admission_date)
          )}">
        </div>
        <div>
          <label class="tc-label">First Admission Class</label>
          <input id="swal-first-class" class="tc-field" value="${esc(s.first_class || "")}">
        </div>

        <div>
          <label class="tc-label">Last Class (Figure)</label>
          <input id="swal-last-fig" class="tc-field" value="${esc(
            s.last_class_figure || ""
          )}" placeholder="e.g., 10TH">
        </div>
        <div>
          <label class="tc-label">Last Class (Words)</label>
          <input id="swal-last-words" class="tc-field" value="${esc(
            s.last_class_words || ""
          )}" placeholder="e.g., TENTH">
        </div>

        <div class="full">
          <label class="tc-label">Last Exam Result</label>
          <input id="swal-last-res" class="tc-field" value="${esc(
            s.last_exam_result || "Passed AISSE(X)"
          )}" placeholder="e.g., Passed AISSE(X)">
        </div>

        <div>
          <label class="tc-label">Failed in Class?</label>
          <select id="swal-failed" class="tc-field">
            <option value="No" ${!failedYes ? "selected" : ""}>No</option>
            <option value="Yes" ${failedYes ? "selected" : ""}>Yes</option>
          </select>
        </div>

        <div>
          <label class="tc-label">Qualified for Promotion?</label>
          <select id="swal-qualified" class="tc-field">
            <option value="Yes" ${qualYes ? "selected" : ""}>Yes</option>
            <option value="No" ${!qualYes ? "selected" : ""}>No</option>
          </select>
        </div>

        <div class="full">
          <label class="tc-label">Subjects Studied (one per line)</label>
          <textarea id="swal-subjects" class="tc-field" rows="6" placeholder="English&#10;Hindi&#10;Mathematics&#10;...">${esc(
            toLines(s.subjects || [])
          )}</textarea>
        </div>
      </div>
    </div>

    <!-- ATTENDANCE & FEES -->
    <div class="tc-tabpanel" data-tabpanel="attendance" style="display:none">
      <div class="tc-form-grid compact" id="tc-grid-att">
        <div>
          <label class="tc-label">Working Days</label>
          <input id="swal-wd" type="number" min="0" class="tc-field" value="${esc(
            s.working_days || ""
          )}">
        </div>
        <div>
          <label class="tc-label">Presence Days</label>
          <input id="swal-pd" type="number" min="0" class="tc-field" value="${esc(
            s.presence_days || ""
          )}">
        </div>

        <div>
          <label class="tc-label">Fees Paid Upto</label>
          <input id="swal-feeupto" class="tc-field" value="${esc(
            s.fees_paid_upto || ""
          )}" placeholder="e.g., March 2025">
        </div>
        <div>
          <label class="tc-label">Fee Concession?</label>
          <select id="swal-fee-yesno" class="tc-field">
            <option value="No" ${!feeYes ? "selected" : ""}>No</option>
            <option value="Yes" ${feeYes ? "selected" : ""}>Yes</option>
          </select>
        </div>

        <div class="full">
          <label class="tc-label">Fee Concession Nature</label>
          <input id="swal-fee-nature" class="tc-field" value="${esc(
            s.fee_concession || ""
          )}" placeholder="If yes, e.g., Sibling 25%">
        </div>
      </div>
    </div>

    <!-- ACTIVITIES -->
    <div class="tc-tabpanel" data-tabpanel="activities" style="display:none">
      <div class="tc-form-grid compact" id="tc-grid-act">
        <div>
          <label class="tc-label">NCC Cadet/Scout/Guide?</label>
          <select id="swal-ncc-yesno" class="tc-field">
            <option value="No" ${!nccYes ? "selected" : ""}>No</option>
            <option value="Yes" ${nccYes ? "selected" : ""}>Yes</option>
          </select>
        </div>
        <div>
          <label class="tc-label">NCC/Scout/Guide Details</label>
          <input id="swal-ncc-details" class="tc-field" value="${esc(
            s.ncc_details || ""
          )}" placeholder="If yes, details">
        </div>

        <div class="full">
          <label class="tc-label">Games/Extra Curricular</label>
          <input id="swal-games" class="tc-field" value="${esc(
            s.games_eca || "NA"
          )}" placeholder="NA or details">
        </div>
      </div>
    </div>

    <!-- DATES & REMARKS -->
    <div class="tc-tabpanel" data-tabpanel="dates" style="display:none">
      <div class="tc-form-grid compact" id="tc-grid-dates">
        <div>
          <label class="tc-label">Date of Application</label>
          <input id="swal-date-app" type="date" class="tc-field" value="${esc(
            asYMD(s.date_application)
          )}">
        </div>
        <div>
          <label class="tc-label">Date Struck Off Rolls</label>
          <input id="swal-date-struck" type="date" class="tc-field" value="${esc(
            asYMD(s.date_struck_off)
          )}">
        </div>
        <div>
          <label class="tc-label">Date of Issue</label>
          <input id="swal-date-issue" type="date" class="tc-field" value="${esc(
            asYMD(s.date_issue)
          )}">
        </div>

        <div class="full">
          <label className="tc-label">Remarks</label>
          <textarea id="swal-remarks" class="tc-field" rows="4">${esc(
            s.remarks || ""
          )}</textarea>
        </div>
      </div>
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

  // table compact toggle (hide less important columns)
  const [compactTable, setCompactTable] = useState(true);

  // fetch list
  const fetchList = async (opts = {}) => {
    const params = new URLSearchParams();

    // ✅ normalize search + status (trim)
    const search = String(opts.search ?? q ?? "").trim();
    const st = String(opts.status ?? status ?? "").trim();
    const p = Number(opts.page ?? page ?? 1) || 1;

    if (search) params.set("search", search);
    if (st) params.set("status", st);
    params.set("page", String(p));
    params.set("pageSize", String(pageSize));

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

  // ----------- Create (SEARCHABLE DROPDOWN) -----------
  const handleCreate = async () => {
    let selectedStudent = null;

    await Swal.fire({
      title: "Create Transfer Certificate",
      width: "760px",
      allowOutsideClick: false,
      allowEscapeKey: true,
      html: `
        <style>
          .tc-create-wrap{ padding:10px; text-align:left; }
          .tc-row{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
          .tc-row.one{ grid-template-columns: 1fr; }
          .tc-lbl{ font-weight:600; font-size:12px; margin:0 0 4px; }
          .tc-inp{
            width:100%;
            padding:10px 12px;
            border:1px solid #d1d5db;
            border-radius:12px;
            font-size:13px;
            outline:none;
          }
          .tc-h{ font-size:11px; color:#6b7280; margin-top:5px; }
          .tc-dd{
            position:relative;
          }
          .tc-dd-list{
            position:absolute;
            z-index:9999;
            top: calc(100% + 6px);
            left:0; right:0;
            border:1px solid #e5e7eb;
            background:#fff;
            border-radius:12px;
            box-shadow: 0 12px 30px rgba(0,0,0,.10);
            max-height: 240px;
            overflow:auto;
            display:none;
          }
          .tc-dd-item{
            padding:10px 12px;
            border-bottom:1px solid #f1f5f9;
            cursor:pointer;
            font-size:13px;
            line-height:1.25;
          }
          .tc-dd-item:hover{ background:#f9fafb; }
          .tc-dd-item:last-child{ border-bottom:none; }
          .tc-pill{
            display:inline-block; font-size:11px; padding:2px 8px;
            border:1px solid #e5e7eb; border-radius:999px;
            color:#374151; margin-left:6px;
          }
          .tc-selected{
            margin-top:8px; padding:10px 12px; border:1px dashed #d1d5db; border-radius:12px;
            font-size:12px; color:#111827;
          }
        </style>

        <div class="tc-create-wrap">
          <div class="tc-row one">
            <div class="tc-dd">
              <div class="tc-lbl">Search Student (Name / Admission No.)</div>
              <input id="tc-student-search" class="tc-inp" placeholder="Type name or admission number..." />
              <div class="tc-h">Start typing… select from the list (fast + avoids wrong admission number).</div>
              <div id="tc-dd-list" class="tc-dd-list"></div>
              <input id="tc-selected-student-id" type="hidden" />
              <input id="tc-selected-adm" type="hidden" />
            </div>
          </div>

          <div id="tc-selected-box" class="tc-selected" style="display:none"></div>

          <div style="height:10px"></div>

          <div class="tc-row">
            <div>
              <div class="tc-lbl">Or Enter Admission No. (exact)</div>
              <input id="tc-admno" class="tc-inp" placeholder="e.g., TPIS-848" />
              <div class="tc-h">If you selected from dropdown above, you can leave this empty.</div>
            </div>
            <div>
              <div class="tc-lbl">School ID (optional)</div>
              <input id="tc-schoolid" type="number" class="tc-inp" placeholder="optional if single school" />
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Create Draft",
      didOpen: () => {
        const popup = Swal.getPopup();
        const input = popup.querySelector("#tc-student-search");
        const list = popup.querySelector("#tc-dd-list");
        const hiddenId = popup.querySelector("#tc-selected-student-id");
        const hiddenAdm = popup.querySelector("#tc-selected-adm");
        const selectedBox = popup.querySelector("#tc-selected-box");

        let t = null;
        let lastReq = 0;

        const setSelected = (s) => {
          selectedStudent = s;
          hiddenId.value = s?.id ? String(s.id) : "";
          hiddenAdm.value = s?.admission_number ? String(s.admission_number) : "";
          selectedBox.style.display = "block";
          selectedBox.innerHTML = `
            <div><b>Selected:</b> ${esc(buildStudentLabel(s))}</div>
            <div style="margin-top:6px; color:#6b7280;">You can still edit TC fields after draft creation.</div>
          `;
          list.style.display = "none";
        };

        const renderList = (arr) => {
          if (!arr.length) {
            list.innerHTML = `<div class="tc-dd-item" style="color:#6b7280; cursor:default;">No matches</div>`;
            list.style.display = "block";
            return;
          }
          list.innerHTML = arr
            .map((s) => {
              return `
                <div class="tc-dd-item" data-id="${esc(s.id)}">
                  <div><b>${esc(s.name || "—")}</b>${
                    s.admission_number
                      ? `<span class="tc-pill">${esc(s.admission_number)}</span>`
                      : ""
                  }</div>
                  <div style="color:#6b7280; font-size:12px; margin-top:3px;">${esc(
                    [
                      s.father_name ? `F: ${s.father_name}` : "",
                      s.class_name || s.section_name
                        ? `${s.class_name || ""}${s.section_name ? "-" + s.section_name : ""}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" • ")
                  )}</div>
                </div>
              `;
            })
            .join("");
          list.style.display = "block";

          Array.from(list.querySelectorAll(".tc-dd-item")).forEach((el) => {
            const id = Number(el.getAttribute("data-id"));
            el.addEventListener("click", () => {
              const s = arr.find((x) => Number(x.id) === id);
              if (s) setSelected(s);
            });
          });
        };

        const closeList = () => {
          list.style.display = "none";
        };

        input.addEventListener("input", () => {
          const term = String(input.value || "").trim();

          // if user types again, clear selection
          selectedStudent = null;
          hiddenId.value = "";
          hiddenAdm.value = "";
          selectedBox.style.display = "none";

          if (t) clearTimeout(t);
          if (term.length < 2) {
            closeList();
            return;
          }

          const reqId = ++lastReq;
          t = setTimeout(async () => {
            try {
              const results = await searchStudentsSmart(term);
              if (reqId !== lastReq) return;
              renderList(results);
            } catch {
              if (reqId !== lastReq) return;
              renderList([]);
            }
          }, 250);
        });

        // close list if click outside
        popup.addEventListener("click", (e) => {
          const target = e.target;
          const inDd = target.closest(".tc-dd");
          if (!inDd) closeList();
        });
      },
      preConfirm: async () => {
        const p = Swal.getPopup();
        const schoolId = (p.querySelector("#tc-schoolid")?.value || "").trim();

        const selectedStudentId = (p.querySelector("#tc-selected-student-id")?.value || "").trim();
        const typedAdm = (p.querySelector("#tc-admno")?.value || "").trim();
        const selectedAdm = (p.querySelector("#tc-selected-adm")?.value || "").trim();

        let studentId = null;

        if (selectedStudentId) {
          studentId = Number(selectedStudentId);
        } else {
          const admRaw = typedAdm || selectedAdm;
          if (!admRaw) {
            Swal.showValidationMessage("Please select a student OR enter Admission No.");
            return false;
          }
          studentId = await resolveStudentIdByAdmission(admRaw);
          if (!studentId) {
            Swal.showValidationMessage(`No student found with Admission No. "${admRaw}".`);
            return false;
          }
        }

        return {
          student_id: studentId,
          school_id: schoolId ? Number(schoolId) : undefined,
        };
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const { student_id, school_id } = res.value || {};
        const { data } = await api.post(`/tc/${student_id}`, { school_id });

        Swal.fire(
          "Draft Created",
          `TC #${data?.serial_no || data?.id} created for ${data?.student_name || ""} (${data?.admission_no || ""}).`,
          "success"
        );

        // ✅ also sync page state before fetch
        setPage(1);
        await fetchList({ page: 1 });

        if (data?.id) {
          handleEdit({ id: data.id, status: data.status || "draft", serial_no: data.serial_no });
        }
      } catch (err) {
        console.error("create TC error:", err);
        Swal.fire("Error", err?.response?.data?.error || "Failed to create TC.", "error");
      }
    });
  };

  // ----------- Edit (draft only) -----------
  const handleEdit = async (row) => {
    // always fetch fresh row first
    let full = row;
    try {
      const { data } = await api.get(`/tc/${row.id}`);
      full = data || row;
    } catch (e) {
      console.error("fetch single TC for edit error:", e);
    }

    if (full.status !== "draft") {
      Swal.fire("Locked", "Only DRAFT TCs can be edited.", "info");
      return;
    }

    const tc = normalizeTcForModal(full);

    await Swal.fire({
      title: `Edit TC`,
      width: "980px",
      html: modalHtmlTabbed(tc),
      showCancelButton: true,
      confirmButtonText: "Save",
      didOpen: () => {
        const popup = Swal.getPopup();

        // tabs
        const tabs = Array.from(popup.querySelectorAll(".tc-tab"));
        const panels = Array.from(popup.querySelectorAll(".tc-tabpanel"));

        const showTab = (key) => {
          tabs.forEach((t) => t.classList.toggle("active", t.getAttribute("data-tab") === key));
          panels.forEach((p) => (p.style.display = p.getAttribute("data-tabpanel") === key ? "" : "none"));
        };

        tabs.forEach((t) => {
          t.addEventListener("click", () => showTab(t.getAttribute("data-tab")));
        });

        // layout toggle (2-col compact vs 1-col expanded)
        const btn = popup.querySelector("#tc-layout-toggle");
        const grids = [
          popup.querySelector("#tc-grid"),
          popup.querySelector("#tc-grid-academic"),
          popup.querySelector("#tc-grid-att"),
          popup.querySelector("#tc-grid-act"),
          popup.querySelector("#tc-grid-dates"),
        ].filter(Boolean);

        let expanded = false;
        const apply = () => {
          grids.forEach((g) => {
            g.classList.toggle("expanded", expanded);
            g.classList.toggle("compact", !expanded);
          });
          if (btn) btn.textContent = expanded ? "Compact / 2-Column" : "Expand / 1-Column";
        };
        apply();

        if (btn) {
          btn.addEventListener("click", () => {
            expanded = !expanded;
            apply();
          });
        }
      },
      preConfirm: () => {
        const p = Swal.getPopup();
        const payload = {
          serial_no: p.querySelector("#swal-serial")?.value.trim() || null,
          pen_number: p.querySelector("#swal-pen")?.value.trim() || null,
          admission_no: p.querySelector("#swal-adm")?.value.trim() || null,
          student_name: p.querySelector("#swal-student")?.value.trim(),
          father_name: p.querySelector("#swal-fname")?.value.trim(),
          mother_name: p.querySelector("#swal-mname")?.value.trim() || null,

          dob_figures: p.querySelector("#swal-dob-fig")?.value.trim() || null,
          dob_words: p.querySelector("#swal-dob-words")?.value.trim() || null,
          proof_dob: p.querySelector("#swal-proof-dob")?.value.trim() || null,
          is_sc_st_obc: p.querySelector("#swal-scst")?.value,

          first_admission_date: toDateInput(p.querySelector("#swal-first-adm-date")?.value) || null,
          first_class: p.querySelector("#swal-first-class")?.value.trim() || null,
          last_class_figure: p.querySelector("#swal-last-fig")?.value.trim() || null,
          last_class_words: p.querySelector("#swal-last-words")?.value.trim() || null,
          last_exam_result: p.querySelector("#swal-last-res")?.value.trim() || null,
          is_failed: p.querySelector("#swal-failed")?.value,

          subjects: fromLines(p.querySelector("#swal-subjects")?.value),
          is_qualified_promotion: p.querySelector("#swal-qualified")?.value,

          working_days: Number(p.querySelector("#swal-wd")?.value) || null,
          presence_days: Number(p.querySelector("#swal-pd")?.value) || null,

          fees_paid_upto: p.querySelector("#swal-feeupto")?.value.trim() || null,
          fee_concession_yesno: p.querySelector("#swal-fee-yesno")?.value,
          fee_concession: p.querySelector("#swal-fee-nature")?.value.trim() || null,

          ncc_yesno: p.querySelector("#swal-ncc-yesno")?.value,
          ncc_details: p.querySelector("#swal-ncc-details")?.value.trim() || null,
          games_eca: p.querySelector("#swal-games")?.value.trim() || null,

          date_application: toDateInput(p.querySelector("#swal-date-app")?.value) || null,
          date_struck_off: toDateInput(p.querySelector("#swal-date-struck")?.value) || null,
          date_issue: toDateInput(p.querySelector("#swal-date-issue")?.value) || null,

          remarks: p.querySelector("#swal-remarks")?.value.trim() || null,
          session_text: p.querySelector("#swal-session")?.value.trim() || null,
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

      // ✅ after delete go to first page to avoid empty last-page states
      setPage(1);
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

  // ✅ Search resets page state (prevents “Page 5 / 1” issues)
  const onSearch = () => {
    setPage(1);
    fetchList({ page: 1 });
  };

  const resetFilters = () => {
    setQ("");
    setStatus("");
    setPage(1);
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
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary"
            onClick={() => setCompactTable((v) => !v)}
            title="Toggle fewer / more columns"
          >
            {compactTable ? "Expand Columns" : "Compact Columns"}
          </button>

          {canManage && (
            <button className="btn btn-success" onClick={handleCreate}>
              Create From Student
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 360 }}
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
              const v = e.target.value;
              setStatus(v);

              // ✅ also reset page state
              setPage(1);
              fetchList({ status: v, page: 1 });
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

              {!compactTable && <th>Subjects</th>}
              {!compactTable && <th>Working/Presence</th>}
              {!compactTable && <th>Fees Upto</th>}
              {!compactTable && <th>School</th>}

              <th style={{ minWidth: 230 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tc, i) => {
              const details = {
                Student: tc.student_name,
                Father: tc_father(tc),
                Mother: tc.mother_name,
                DOB: `${tc.dob_figures || asDDMMYYYY(tc.dob)} (${tc.dob_words || ""})`,
                "Proof DOB": tc.proof_dob || "—",
                "SC/ST/OBC": tc.is_sc_st_obc || "No",
                "First Admission": `${asDDMMYYYY(tc.first_admission_date)} Class ${tc.first_class || ""}`,
                "Last Class": `${tc.last_class_figure || ""} (${tc.last_class_words || ""})`,
                "Last Exam": tc.last_exam_result || "—",
                Failed: tc.is_failed || "No",
                Subjects: toCSV(tc.subjects),
                Qualified: tc.is_qualified_promotion || "No",
                "Working Days": tc.working_days || 0,
                Presence: tc.presence_days || 0,
                "Attendance %":
                  tc.presence_days && tc.working_days
                    ? Math.round((tc.presence_days / tc.working_days) * 100) + "%"
                    : "—",
                "Fees Upto": tc.fees_paid_upto || "—",
                "Fee Concession": `${tc.fee_concession_yesno || "No"} ${tc.fee_concession || ""}`.trim(),
                NCC: `${tc.ncc_yesno || "No"}: ${tc.ncc_details || ""}`,
                "Games/ECA": tc.games_eca || "NA",
                "Struck Off": asDDMMYYYY(tc.date_struck_off) || "—",
                "Issue Date": asDDMMYYYY(tc.date_issue || tc.issue_date) || "—",
                Remarks: tc.remarks || "—",
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

                  {!compactTable && (
                    <td
                      title={toCSV(tc.subjects)}
                      style={{
                        maxWidth: 180,
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        overflow: "hidden",
                      }}
                    >
                      {toCSV(tc.subjects)}
                    </td>
                  )}

                  {!compactTable && (
                    <td>
                      {(tc.working_days ?? 0)}/{(tc.presence_days ?? 0)}
                    </td>
                  )}

                  {!compactTable && <td>{tc.fees_paid_upto || "—"}</td>}
                  {!compactTable && <td>{tc.school?.name || "—"}</td>}

                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          Swal.fire({
                            title: `TC Details (Serial: ${tc.serial_no})`,
                            html: `
                              <div style="text-align:left; white-space: pre-wrap;">
                                ${Object.entries(details)
                                  .map(([k, v]) => `<div style="margin:4px 0;"><b>${k}:</b> ${esc(v)}</div>`)
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
              );
            })}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={compactTable ? 8 : 12} className="text-center">
                  No records found
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={compactTable ? 8 : 12} className="text-center">
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
