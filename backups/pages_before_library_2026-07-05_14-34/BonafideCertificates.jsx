// src/pages/BonafideCertificates.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./TransferCertificates.css"; // reuse same styling (optional)

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

// Normalize record for modal
const normalizeBfForModal = (bf = {}) => {
  const normDob = toDateInput(bf.dob);
  return {
    ...bf,
    dob: normDob,
    dob_words: bf.dob_words || "",
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

// ---------- Bonafide modal HTML ----------
const modalHtml = (bf = {}) => {
  const s = bf || {};
  return `
    <style>
      .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .full { grid-column: 1 / -1; }
      .form-label { font-weight: 600; margin-bottom: 4px; }
      .form-field { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; }
      .hint { font-size: 12px; color: #6b7280; }
      textarea.form-field { resize: vertical; }
    </style>

    <div class="form-grid">
      <div>
        <label class="form-label">Bonafide No.</label>
        <input id="swal-bonafide-no" class="form-field" value="${esc(s.bonafide_no || "")}" placeholder="e.g., 0005">
      </div>
      <div>
        <label class="form-label">Admission No.</label>
        <input id="swal-adm" class="form-field" value="${esc(s.admission_no || "")}" placeholder="Admission No.">
      </div>

      <div>
        <label class="form-label">Student Name</label>
        <input id="swal-student" class="form-field" value="${esc(s.student_name || "")}" placeholder="Student Name">
      </div>
      <div>
        <label class="form-label">Father's Name</label>
        <input id="swal-fname" class="form-field" value="${esc(s.father_name || "")}" placeholder="Father Name">
      </div>

      <div>
        <label class="form-label">Mother's Name</label>
        <input id="swal-mname" class="form-field" value="${esc(s.mother_name || "")}" placeholder="Mother Name">
      </div>
      <div>
        <label class="form-label">Class</label>
        <input id="swal-class" class="form-field" value="${esc(s.class_name || "")}" placeholder="e.g., VIII A">
      </div>

      <div>
        <label class="form-label">Session</label>
        <input id="swal-session" class="form-field" value="${esc(s.session_text || "")}" placeholder="e.g., 2024-25">
      </div>
      <div>
        <label class="form-label">Date of Birth</label>
        <input id="swal-dob" type="date" class="form-field" value="${esc(toDateInput(s.dob))}">
      </div>

      <div class="full">
        <label class="form-label">DOB (in words)</label>
        <textarea id="swal-dob-words" class="form-field" rows="2" placeholder="Twenty Fifth January Two Thousand Ten">${esc(s.dob_words || "")}</textarea>
      </div>

      <div class="full">
        <label class="form-label">Purpose</label>
        <textarea id="swal-purpose" class="form-field" rows="2" placeholder="For passport / scholarship / bank account">${esc(s.purpose || "")}</textarea>
      </div>

      <div class="full">
        <label class="form-label">Remarks</label>
        <textarea id="swal-remarks" class="form-field" rows="2" placeholder="Optional">${esc(s.remarks || "")}</textarea>
      </div>
    </div>
  `;
};

export default function BonafideCertificates() {
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
      const { data } = await api.get(`/bonafide?${params.toString()}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPage(Number(data?.page) || 1);
      setTotalPages(Number(data?.totalPages) || 1);
    } catch (err) {
      console.error("fetchList error:", err);
      Swal.fire("Error", "Failed to fetch bonafide certificates.", "error");
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
      title: "Create Bonafide Certificate",
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
            <input id="bf-admno" class="form-field" list="admno-list" placeholder="Type to search...">
            <datalist id="admno-list"></datalist>
            <div class="hint">Type at least 2 characters</div>
          </div>
          <div>
            <label class="form-label">Student Name</label>
            <input id="bf-stuname" class="form-field" list="stuname-list" placeholder="Type to search...">
            <datalist id="stuname-list"></datalist>
            <div class="hint">Type at least 2 characters</div>
          </div>
          <div>
            <label class="form-label">School ID</label>
            <input id="bf-schoolid" type="number" class="form-field" placeholder="optional if single school">
          </div>
          <div>
            <label class="form-label">Session</label>
            <input id="bf-session" class="form-field" placeholder="e.g., 2024-25">
          </div>
          <div class="full">
            <label class="form-label">Purpose</label>
            <input id="bf-purpose" class="form-field" placeholder="For scholarship / passport / address proof">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Create Draft",
      didOpen: () => {
        const popup = Swal.getPopup();
        const $adm = popup.querySelector("#bf-admno");
        const $admList = popup.querySelector("#admno-list");
        const $name = popup.querySelector("#bf-stuname");
        const $nameList = popup.querySelector("#stuname-list");
        const $sid = popup.querySelector("#bf-schoolid");

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
        const admText = (p.querySelector("#bf-admno")?.value || "").trim();
        const nameText = (p.querySelector("#bf-stuname")?.value || "").trim();
        const schoolId = (p.querySelector("#bf-schoolid")?.value || "").trim();
        const sessionText = (p.querySelector("#bf-session")?.value || "").trim();
        const purpose = (p.querySelector("#bf-purpose")?.value || "").trim();

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
          session_text: sessionText || undefined,
          purpose: purpose || undefined,
        };
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const { student_id, school_id, session_text, purpose } = res.value || {};
        const { data } = await api.post(`/bonafide/${student_id}`, {
          school_id,
          session_text,
          purpose,
        });
        Swal.fire(
          "Draft Created",
          `Bonafide #${data?.bonafide_no || data?.id} created.`,
          "success"
        );
        await fetchList({ page: 1 });
        if (data?.id) {
          handleEdit({ id: data.id, bonafide_no: data?.bonafide_no });
        }
      } catch (err) {
        console.error("create Bonafide error:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.error || "Failed to create bonafide certificate.",
          "error"
        );
      }
    });
  };

  // ----------- Edit (draft only) -----------
  const handleEdit = async (row) => {
    if (row.status !== "draft") {
      Swal.fire("Locked", "Only DRAFT certificates can be edited.", "info");
      return;
    }

    // Get the freshest single row
    let full = row;
    try {
      const { data } = await api.get(`/bonafide/${row.id}`);
      full = data || row;
    } catch {
      // fall back to the list row
    }

    const bf = normalizeBfForModal(full);

    await Swal.fire({
      title: `Edit Bonafide (No: ${bf.bonafide_no || bf.id})`,
      width: "900px",
      html: modalHtml(bf),
      showCancelButton: true,
      confirmButtonText: "Save",
      preConfirm: () => {
        const p = Swal.getPopup();
        const payload = {
          bonafide_no: p.querySelector("#swal-bonafide-no").value.trim() || null,
          admission_no: p.querySelector("#swal-adm").value.trim() || null,
          student_name: p.querySelector("#swal-student").value.trim(),
          father_name: p.querySelector("#swal-fname").value.trim(),
          mother_name: p.querySelector("#swal-mname").value.trim() || null,
          class_name: p.querySelector("#swal-class").value.trim() || null,
          session_text: p.querySelector("#swal-session").value.trim() || null,
          dob: toDateInput(p.querySelector("#swal-dob").value) || null,
          dob_words: p.querySelector("#swal-dob-words").value.trim() || null,
          purpose: p.querySelector("#swal-purpose").value.trim() || null,
          remarks: p.querySelector("#swal-remarks").value.trim() || null,
        };
        if (!payload.student_name) {
          Swal.showValidationMessage("Student Name is required");
          return false;
        }
        if (!payload.admission_no) {
          Swal.showValidationMessage("Admission No. is required");
          return false;
        }
        return payload;
      },
    }).then(async (r) => {
      if (!r.isConfirmed) return;
      try {
        await api.patch(`/bonafide/${row.id}`, r.value);
        Swal.fire("Saved", "Draft updated successfully.", "success");
        fetchList();
      } catch (err) {
        console.error("update Bonafide error:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.error || "Failed to update bonafide certificate.",
          "error"
        );
      }
    });
  };

  // ----------- Issue -----------
  const handleIssue = async (bf) => {
    if (bf.status === "issued") {
      Swal.fire("Already Issued", "This certificate is already issued.", "info");
      return;
    }
    const ok = await Swal.fire({
      title: "Issue Certificate?",
      text: `This will lock the bonafide (No: ${bf.bonafide_no || bf.id}).`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Issue",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.post(`/bonafide/${bf.id}/issue`);
      Swal.fire("Issued", "Bonafide certificate issued successfully.", "success");
      fetchList();
    } catch (err) {
      console.error("issue Bonafide error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to issue certificate.",
        "error"
      );
    }
  };

  // ----------- Cancel -----------
  const handleCancel = async (bf) => {
    const ok = await Swal.fire({
      title: "Cancel Certificate?",
      text: `This will mark bonafide (No: ${bf.bonafide_no || bf.id}) as cancelled.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Cancel",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.post(`/bonafide/${bf.id}/cancel`);
      Swal.fire("Cancelled", "Certificate cancelled.", "success");
      fetchList();
    } catch (err) {
      console.error("cancel Bonafide error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to cancel certificate.",
        "error"
      );
    }
  };

  // ----------- Delete -----------
  const handleDelete = async (bf) => {
    if (!isSuperadmin) {
      Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
      return;
    }
    const ok = await Swal.fire({
      title: "Delete Certificate?",
      text: `Permanently delete bonafide (No: ${bf.bonafide_no || bf.id}).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.delete(`/bonafide/${bf.id}`);
      Swal.fire("Deleted", "Certificate removed successfully.", "success");
      fetchList({ page: 1 });
    } catch (err) {
      console.error("delete Bonafide error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to delete certificate.",
        "error"
      );
    }
  };

  // ----------- PDF -----------
  const handlePdf = async (bf) => {
    try {
      const resp = await api.get(`/bonafide/${bf.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([resp.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `BONAFIDE_${bf.bonafide_no || bf.id}.pdf`;
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

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h3 mb-0">Bonafide Certificates</h1>
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
            placeholder="Search bonafide no, admission no, student name..."
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
              <th>Bonafide No</th>
              <th>Admission #</th>
              <th>Student</th>
              <th>Father</th>
              <th>Class</th>
              <th>Session</th>
              <th>Status</th>
              <th>Issue Date</th>
              <th>Purpose</th>
              <th>School</th>
              <th style={{ minWidth: 230 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((bf, i) => {
              const details = {
                "Bonafide No": bf.bonafide_no || "—",
                "Student": bf.student_name || "—",
                "Father": bf.father_name || "—",
                "Mother": bf.mother_name || "—",
                "Admission No": bf.admission_no || "—",
                "Class": bf.class_name || "—",
                "Session": bf.session_text || "—",
                "DOB": asYMD(bf.dob) || "—",
                "DOB (words)": bf.dob_words || "—",
                "Purpose": bf.purpose || "—",
                "Remarks": bf.remarks || "—",
                "Issue Date": asYMD(bf.issue_date) || "—",
                "Status": bf.status,
              };
              return (
                <tr key={bf.id}>
                  <td>{(page - 1) * pageSize + i + 1}</td>
                  <td className="fw-semibold">{bf.bonafide_no || "—"}</td>
                  <td>{bf.admission_no}</td>
                  <td>{bf.student_name}</td>
                  <td>{bf.father_name}</td>
                  <td>{bf.class_name || "—"}</td>
                  <td>{bf.session_text || "—"}</td>
                  <td>
                    {bf.status === "draft" && (
                      <span className="badge bg-warning text-dark">Draft</span>
                    )}
                    {bf.status === "issued" && (
                      <span className="badge bg-success">Issued</span>
                    )}
                    {bf.status === "cancelled" && (
                      <span className="badge bg-secondary">Cancelled</span>
                    )}
                  </td>
                  <td>{asYMD(bf.issue_date) || "—"}</td>
                  <td
                    title={bf.purpose || ""}
                    style={{
                      maxWidth: 180,
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                    }}
                  >
                    {bf.purpose || "—"}
                  </td>
                  <td>{bf.school?.name || "—"}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          Swal.fire({
                            title: `Bonafide Details (No: ${bf.bonafide_no || bf.id})`,
                            html: `
                              <div style="text-align:left; white-space: pre-wrap;">
                                ${Object.entries(details)
                                  .map(([k, v]) => `<div><b>${k}:</b> ${esc(v)}</div>`)
                                  .join("")}
                              </div>
                            `,
                            confirmButtonText: "Close",
                            width: "600px",
                          })
                        }
                      >
                        View
                      </button>

                      {canManage && bf.status === "draft" && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleEdit(bf)}
                        >
                          Edit
                        </button>
                      )}

                      {canManage && bf.status !== "issued" && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleIssue(bf)}
                        >
                          Issue
                        </button>
                      )}

                      {canManage && bf.status !== "cancelled" && (
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => handleCancel(bf)}
                        >
                          Cancel
                        </button>
                      )}

                      {canManage && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDelete(bf)}
                        >
                          Delete
                        </button>
                      )}

                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => handlePdf(bf)}
                      >
                        PDF
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
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
