// src/pages/FeeCertificates.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./TransferCertificates.css"; // same styling reuse (optional)

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

  // Fallback: Date parse -> ISO -> first 10
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return "";
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

// ---------- create modal HTML ----------
const createModalHtml = () => `
  <style>
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full { grid-column: 1 / -1; }
    .form-label { font-weight: 600; margin-bottom: 4px; }
    .form-field { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px; }
    .hint { font-size: 12px; color: #6b7280; }
  </style>

  <div class="form-grid">
    <div>
      <label class="form-label">Admission No.</label>
      <input id="fc-admno" class="form-field" list="fc-admno-list" placeholder="Type to search...">
      <datalist id="fc-admno-list"></datalist>
      <div class="hint">Type at least 2 characters</div>
    </div>
    <div>
      <label class="form-label">Student Name</label>
      <input id="fc-stuname" class="form-field" list="fc-stuname-list" placeholder="Type to search...">
      <datalist id="fc-stuname-list"></datalist>
      <div class="hint">Type at least 2 characters</div>
    </div>
    <div>
      <label class="form-label">School ID</label>
      <input id="fc-schoolid" type="number" class="form-field" placeholder="optional if single school">
    </div>
    <div>
      <label class="form-label">Session ID</label>
      <input id="fc-sessionid" type="number" class="form-field" placeholder="e.g., 5 (2024-25)">
    </div>
    <div class="full">
      <label class="form-label">Certificate No. (optional)</label>
      <input id="fc-certno" class="form-field" placeholder="e.g., FC-0007">
    </div>
    <div class="full">
      <label class="form-label">Remarks</label>
      <input id="fc-remarks" class="form-field" placeholder="e.g., No dues pending / Pending ₹1200">
    </div>
  </div>
`;

export default function FeeCertificates() {
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
      const { data } = await api.get(`/fee-certificates?${params.toString()}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPage(Number(data?.page) || 1);
      setTotalPages(Number(data?.totalPages) || 1);
    } catch (err) {
      console.error("fetchList error:", err);
      Swal.fire("Error", "Failed to fetch fee certificates.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------- Create (from student) -----------
  const handleCreate = async () => {
    let chosen = { student_id: "", admission_number: "", school_id: "" };
    let cache = [];

    await Swal.fire({
      title: "Create Fee Certificate",
      width: "820px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: createModalHtml(),
      showCancelButton: true,
      confirmButtonText: "Generate",
      didOpen: () => {
        const popup = Swal.getPopup();
        const $adm = popup.querySelector("#fc-admno");
        const $admList = popup.querySelector("#fc-admno-list");
        const $name = popup.querySelector("#fc-stuname");
        const $nameList = popup.querySelector("#fc-stuname-list");
        const $sid = popup.querySelector("#fc-schoolid");

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
        const admText = (p.querySelector("#fc-admno")?.value || "").trim();
        const nameText = (p.querySelector("#fc-stuname")?.value || "").trim();
        const schoolId = (p.querySelector("#fc-schoolid")?.value || "").trim();
        const sessionId = (p.querySelector("#fc-sessionid")?.value || "").trim();
        const remarks = (p.querySelector("#fc-remarks")?.value || "").trim();
        const certificateNo = (p.querySelector("#fc-certno")?.value || "").trim();

        if (!chosen.student_id) {
          // Try to extract admission number from free text
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
          session_id: sessionId ? Number(sessionId) : undefined,
          remarks: remarks || undefined,
          certificate_no: certificateNo || undefined,
        };
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      try {
        const { student_id, school_id, session_id, remarks, certificate_no } = res.value || {};
        const { data } = await api.post(`/fee-certificates/${student_id}`, {
          school_id,
          session_id,
          remarks,
          certificate_no,
        });
        Swal.fire(
          "Generated",
          `Fee Certificate #${data?.certificate_no || data?.id} created.`,
          "success"
        );
        await fetchList({ page: 1 });
      } catch (err) {
        console.error("create FeeCertificate error:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.error || "Failed to create fee certificate.",
          "error"
        );
      }
    });
  };

  // ----------- Cancel -----------
  const handleCancel = async (fc) => {
    if (fc.status === "cancelled") {
      Swal.fire("Already Cancelled", "This certificate is already cancelled.", "info");
      return;
    }
    const ok = await Swal.fire({
      title: "Cancel Certificate?",
      text: `This will mark fee certificate (No: ${fc.certificate_no || fc.id}) as cancelled.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Cancel",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.post(`/fee-certificates/${fc.id}/cancel`);
      Swal.fire("Cancelled", "Certificate cancelled.", "success");
      fetchList();
    } catch (err) {
      console.error("cancel FeeCertificate error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to cancel certificate.",
        "error"
      );
    }
  };

  // ----------- Delete -----------
  const handleDelete = async (fc) => {
    if (!isSuperadmin) {
      Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
      return;
    }
    const ok = await Swal.fire({
      title: "Delete Certificate?",
      text: `Permanently delete fee certificate (No: ${fc.certificate_no || fc.id}).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.delete(`/fee-certificates/${fc.id}`);
      Swal.fire("Deleted", "Certificate removed successfully.", "success");
      fetchList({ page: 1 });
    } catch (err) {
      console.error("delete FeeCertificate error:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.error || "Failed to delete certificate.",
        "error"
      );
    }
  };

  // ----------- PDF open -----------
  const handlePdf = async (fc) => {
    try {
      const res = await api.get(`/fee-certificates/${fc.id}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // optional cleanup
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("fee certificate PDF error:", err);
      Swal.fire("Error", "Failed to open PDF for this certificate.", "error");
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
        <h1 className="h3 mb-0">Fee Certificates</h1>
        {canManage && (
          <button className="btn btn-success" onClick={handleCreate}>
            Generate From Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 align-items-center">
          <input
            className="form-control"
            style={{ maxWidth: 300 }}
            placeholder="Search certificate no, admission no, student name..."
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
              <th>Certificate No</th>
              <th>Admission #</th>
              <th>Student</th>
              <th>Class</th>
              <th>Session</th>
              <th>Issue Date</th>
              <th>Total Due</th>
              <th>Fine</th>
              <th>Transport Due</th>
              <th>Grand Total</th>
              <th>Status</th>
              <th>School</th>
              <th style={{ minWidth: 260 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((fc, i) => {
              const details = {
                "Certificate No": fc.certificate_no || "—",
                "Admission No": fc.admission_no || "—",
                Student: fc.Student?.name || fc.student_name || "—",
                Class:
                  fc.Student?.Class?.class_name ||
                  fc.class_name ||
                  "—",
                Session: fc.session_id || fc.session_text || "—",
                "Issue Date": asYMD(fc.issue_date) || "—",
                "Total Due":
                  fc.total_due != null
                    ? `₹${Number(fc.total_due).toFixed(2)}`
                    : "₹0.00",
                "Total Fine":
                  fc.total_fine != null
                    ? `₹${Number(fc.total_fine).toFixed(2)}`
                    : "₹0.00",
                "Transport Due":
                  fc.total_transport_due != null
                    ? `₹${Number(fc.total_transport_due).toFixed(2)}`
                    : "₹0.00",
                "Grand Total":
                  fc.grand_total_due != null
                    ? `₹${Number(fc.grand_total_due).toFixed(2)}`
                    : "₹0.00",
                Remarks: fc.remarks || "—",
                Status: fc.status,
              };
              return (
                <tr key={fc.id}>
                  <td>{(page - 1) * pageSize + i + 1}</td>
                  <td className="fw-semibold">{fc.certificate_no || "—"}</td>
                  <td>{fc.admission_no || "—"}</td>
                  <td>{fc.Student?.name || fc.student_name || "—"}</td>
                  <td>
                    {fc.Student?.Class?.class_name ||
                      fc.class_name ||
                      "—"}
                  </td>
                  <td>{fc.session_id || fc.session_text || "—"}</td>
                  <td>{asYMD(fc.issue_date) || "—"}</td>
                  <td>
                    {fc.total_due != null
                      ? `₹${Number(fc.total_due).toFixed(2)}`
                      : "₹0.00"}
                  </td>
                  <td>
                    {fc.total_fine != null
                      ? `₹${Number(fc.total_fine).toFixed(2)}`
                      : "₹0.00"}
                  </td>
                  <td>
                    {fc.total_transport_due != null
                      ? `₹${Number(fc.total_transport_due).toFixed(2)}`
                      : "₹0.00"}
                  </td>
                  <td>
                    {fc.grand_total_due != null
                      ? `₹${Number(fc.grand_total_due).toFixed(2)}`
                      : "₹0.00"}
                  </td>
                  <td>
                    {fc.status === "issued" && (
                      <span className="badge bg-success">Issued</span>
                    )}
                    {fc.status === "cancelled" && (
                      <span className="badge bg-secondary">Cancelled</span>
                    )}
                    {!fc.status && <span className="badge bg-light text-dark">—</span>}
                  </td>
                  <td>{fc.School?.name || fc.school?.name || "—"}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          Swal.fire({
                            title: `Fee Certificate (No: ${fc.certificate_no || fc.id})`,
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

                      {/* PDF button */}
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => handlePdf(fc)}
                      >
                        PDF
                      </button>

                      {canManage && fc.status !== "cancelled" && (
                        <button
                          className="btn btn-warning btn-sm"
                          onClick={() => handleCancel(fc)}
                        >
                          Cancel
                        </button>
                      )}

                      {canManage && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleDelete(fc)}
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
                <td colSpan={14} className="text-center">
                  No records found
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={14} className="text-center">
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
