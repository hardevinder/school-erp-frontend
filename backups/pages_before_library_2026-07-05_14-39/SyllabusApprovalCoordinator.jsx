import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

/** Escape HTML for SweetAlert html mode */
const escapeHtml = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const fmtDateTime = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
};

const badgeClass = (status) => {
  const s = String(status || "").toUpperCase();
  if (s === "SUBMITTED") return "badge bg-warning text-dark";
  if (s === "APPROVED") return "badge bg-success";
  if (s === "RETURNED") return "badge bg-danger";
  if (s === "DRAFT") return "badge bg-secondary";
  return "badge bg-secondary";
};

const normalizeStatus = (status) => String(status || "").toUpperCase();

/** ✅ Try common token keys */
const getToken = () => {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt") ||
      ""
    );
  } catch {
    return "";
  }
};

const SyllabusApprovalCoordinator = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchClass, setSearchClass] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [searchTeacher, setSearchTeacher] = useState("");
  const [searchSession, setSearchSession] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Adjust if your backend is mounted at /api
  // Example: const BASE = "/api/syllabus-breakdowns";
  const BASE = "/syllabus-breakdowns";

  // prevent overlapping polling calls
  const fetchingRef = useRef(false);

  const fetchPending = async () => {
    if (fetchingRef.current) return rows;
    fetchingRef.current = true;

    setLoading(true);
    try {
      const res = await api.get(`${BASE}/pending`);
      // expected: { ok:true, data:[...] }
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setRows(data);
      return data;
    } catch (e) {
      console.error("fetchPending:", e);
      const msg = e?.response?.data?.message || "Failed to fetch pending syllabus breakdowns.";
      Swal.fire("Error", msg, "error");
      return [];
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const fetchById = async (id) => {
    const res = await api.get(`${BASE}/${id}`);
    return res.data?.data || res.data;
  };

  const openPdf = async (id) => {
    try {
      // ✅ IMPORTANT: open PDF from API baseURL (not frontend :3000)
      const base = (api.defaults.baseURL || "").replace(/\/+$/, "");

      const token = getToken();
      if (!token) {
        Swal.fire("Unauthorized", "Login token not found. Please login again.", "error");
        return;
      }

      // ✅ For window.open: send token in query (backend middleware accepts ?token= only for /pdf)
      const url = `${base}${BASE}/${id}/pdf?token=${encodeURIComponent(token)}`;
      window.open(url, "_blank");
    } catch (e) {
      console.error("openPdf:", e);
      Swal.fire("Error", "Failed to open PDF.", "error");
    }
  };

  const handleView = async (row) => {
    try {
      const full = await fetchById(row.id);

      const cls = full?.Class?.class_name || full?.classId || "—";
      const sub = full?.Subject?.subject_name || full?.Subject?.name || full?.subjectId || "—";
      const teacher = full?.Teacher?.name || full?.teacherId || "—";
      const session = full?.academicSession || "—";
      const term = full?.term || "—";
      const status = normalizeStatus(full?.status || "—");
      const objectives = full?.objectives || "";
      const bookRef = full?.bookReference || "";

      const items = Array.isArray(full?.Items) ? full.Items : Array.isArray(full?.items) ? full.items : [];

      const itemRows = items
        .slice(0, 12)
        .map((it, idx) => {
          const seq = it.sequence ?? it.seq_no ?? idx + 1;
          const unit = `${escapeHtml(it.unitNumber ?? it.unit_no ?? "")} ${escapeHtml(
            it.unitTitle ?? it.unit_title ?? ""
          )}`.trim();
          const topics = escapeHtml(it.topics ?? "");
          const subs = escapeHtml(it.subtopics ?? "");
          const p = escapeHtml(it.periods ?? "");
          const m = escapeHtml(it.plannedMonth ?? it.planned_month ?? "");
          return `
            <tr>
              <td style="white-space:nowrap">${seq}</td>
              <td>${unit || "—"}</td>
              <td>
                ${topics || "—"}
                ${subs ? `<br/><small class="text-muted">${subs}</small>` : ""}
              </td>
              <td class="text-center">${p || "—"}</td>
              <td>${m || "—"}</td>
            </tr>
          `;
        })
        .join("");

      await Swal.fire({
        title: "Syllabus Breakdown Preview",
        width: "950px",
        html: `
          <div class="text-start">
            <div class="row g-2">
              <div class="col-md-6"><b>Class:</b> ${escapeHtml(cls)}</div>
              <div class="col-md-6"><b>Subject:</b> ${escapeHtml(sub)}</div>
              <div class="col-md-6"><b>Teacher:</b> ${escapeHtml(teacher)}</div>
              <div class="col-md-6"><b>Status:</b> ${escapeHtml(status)}</div>
              <div class="col-md-6"><b>Session:</b> ${escapeHtml(session)}</div>
              <div class="col-md-6"><b>Term:</b> ${escapeHtml(term)}</div>
            </div>

            ${
              bookRef
                ? `<div class="mt-3 p-2 border rounded"><b>Book/Reference:</b> ${escapeHtml(bookRef)}</div>`
                : ""
            }

            ${
              objectives
                ? `<div class="mt-3 p-2 border rounded">
                     <b>Objectives:</b>
                     <div class="mt-2" style="white-space:pre-wrap">${escapeHtml(objectives)}</div>
                   </div>`
                : ""
            }

            <div class="mt-3 border rounded overflow-hidden">
              <table class="table table-sm table-striped mb-0">
                <thead class="table-light">
                  <tr>
                    <th style="width:60px">#</th>
                    <th style="width:220px">Unit</th>
                    <th>Topics/Subtopics</th>
                    <th style="width:70px" class="text-center">P</th>
                    <th style="width:90px">M</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows || `<tr><td colspan="5" class="text-center">No items</td></tr>`}
                </tbody>
              </table>
            </div>

            ${
              items.length > 12
                ? `<div class="mt-2 text-muted" style="font-size:12px">Showing first 12 items. Open PDF for full view.</div>`
                : ""
            }
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Open PDF",
        cancelButtonText: "Close",
      }).then((r) => {
        if (r.isConfirmed) openPdf(row.id);
      });
    } catch (e) {
      console.error("handleView:", e);
      const msg = e?.response?.data?.message || "Failed to open breakdown.";
      Swal.fire("Error", msg, "error");
    }
  };

  const handleApprove = async (row) => {
    try {
      const st = normalizeStatus(row?.status);
      if (st === "APPROVED") {
        Swal.fire("Info", "Already approved.", "info");
        return;
      }

      const result = await Swal.fire({
        title: "Approve Syllabus?",
        width: "520px",
        html: `
          <div class="text-start">
            <div><b>Class:</b> ${escapeHtml(row?.Class?.class_name || row?.classId || "—")}</div>
            <div><b>Subject:</b> ${escapeHtml(
              row?.Subject?.subject_name || row?.Subject?.name || row?.subjectId || "—"
            )}</div>
            <div><b>Teacher:</b> ${escapeHtml(row?.Teacher?.name || row?.teacherId || "—")}</div>
            <hr/>
            <div class="form-check mt-2">
              <input class="form-check-input" type="checkbox" id="publishToggle" ${row?.publish ? "checked" : ""} />
              <label class="form-check-label" for="publishToggle">
                Publish after approval
              </label>
            </div>
          </div>
        `,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Approve",
        preConfirm: () => {
          const publish = !!document.getElementById("publishToggle")?.checked;
          return { publish };
        },
      });

      if (!result.isConfirmed) return;

      await api.post(`${BASE}/${row.id}/approve`, result.value || {});
      Swal.fire("Approved!", "Syllabus breakdown approved successfully.", "success");
      await fetchPending();
    } catch (e) {
      console.error("handleApprove:", e);
      const msg = e?.response?.data?.message || "Failed to approve.";
      Swal.fire("Error", msg, "error");
    }
  };

  const handleReturn = async (row) => {
    try {
      const st = normalizeStatus(row?.status);
      if (st === "APPROVED") {
        Swal.fire("Info", "Approved breakdown can't be returned. (Change logic if you want)", "info");
        return;
      }

      const result = await Swal.fire({
        title: "Return to Teacher",
        input: "textarea",
        inputLabel: "Reason (required)",
        inputPlaceholder: "Write what needs to be corrected...",
        inputAttributes: { "aria-label": "Return reason" },
        showCancelButton: true,
        confirmButtonText: "Return",
        preConfirm: (reason) => {
          const r = String(reason || "").trim();
          if (!r) {
            Swal.showValidationMessage("Reason is required");
            return false;
          }
          return { reason: r };
        },
      });

      if (!result.isConfirmed) return;

      await api.post(`${BASE}/${row.id}/return`, result.value);
      Swal.fire("Returned!", "Sent back to teacher with reason.", "success");
      await fetchPending();
    } catch (e) {
      console.error("handleReturn:", e);
      const msg = e?.response?.data?.message || "Failed to return.";
      Swal.fire("Error", msg, "error");
    }
  };

  const filtered = useMemo(() => {
    const c = searchClass.trim().toLowerCase();
    const s = searchSubject.trim().toLowerCase();
    const t = searchTeacher.trim().toLowerCase();
    const sess = searchSession.trim().toLowerCase();
    const term = searchTerm.trim().toLowerCase();

    return rows.filter((r) => {
      const cls = (r?.Class?.class_name || "").toLowerCase();
      const sub = (r?.Subject?.subject_name || r?.Subject?.name || "").toLowerCase();
      const teacher = (r?.Teacher?.name || "").toLowerCase();
      const as = (r?.academicSession || "").toLowerCase();
      const trm = (r?.term || "").toLowerCase();

      return cls.includes(c) && sub.includes(s) && teacher.includes(t) && as.includes(sess) && trm.includes(term);
    });
  }, [rows, searchClass, searchSubject, searchTeacher, searchSession, searchTerm]);

  useEffect(() => {
    fetchPending();

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") fetchPending();
    }, 7000);

    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container mt-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
        <div>
          <h1 className="mb-1">Syllabus Approval (Coordinator)</h1>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Pending submissions will appear here. Approve to lock and optionally publish.
          </div>
        </div>

        <button className="btn btn-outline-secondary btn-sm" onClick={fetchPending} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="row g-2 mt-3">
        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search Class"
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search Subject"
            value={searchSubject}
            onChange={(e) => setSearchSubject(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <input
            type="text"
            className="form-control"
            placeholder="Search Teacher"
            value={searchTeacher}
            onChange={(e) => setSearchTeacher(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Session"
              value={searchSession}
              onChange={(e) => setSearchSession(e.target.value)}
            />
            <input
              type="text"
              className="form-control"
              placeholder="Term"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Desktop / Tablet Table */}
      <div className="table-responsive d-none d-md-block mt-3">
        <table className="table table-striped align-middle">
          <thead className="table-light">
            <tr>
              <th style={{ width: 60 }}>#</th>
              <th>Class</th>
              <th style={{ maxWidth: 220 }}>Subject</th>
              <th style={{ maxWidth: 220 }}>Teacher</th>
              <th style={{ width: 120 }}>Session</th>
              <th style={{ width: 120 }}>Term</th>
              <th style={{ width: 160 }}>Submitted</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 300 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length ? (
              filtered.map((r, idx) => {
                const st = normalizeStatus(r?.status);
                const disableApprove = st === "APPROVED";
                const disableReturn = st === "APPROVED";
                return (
                  <tr key={r.id}>
                    <td>{idx + 1}</td>
                    <td>{r?.Class?.class_name || "—"}</td>

                    <td style={{ maxWidth: 220 }}>
                      <span className="d-inline-block text-truncate" style={{ maxWidth: 210 }}>
                        {r?.Subject?.subject_name || r?.Subject?.name || "—"}
                      </span>
                    </td>

                    <td style={{ maxWidth: 220 }}>
                      <span className="d-inline-block text-truncate" style={{ maxWidth: 210 }}>
                        {r?.Teacher?.name || "—"}
                      </span>
                    </td>

                    <td>{r?.academicSession || "—"}</td>
                    <td>{r?.term || "—"}</td>
                    <td>{fmtDateTime(r?.submittedAt || r?.updatedAt)}</td>

                    <td>
                      <span className={badgeClass(st)}>{st || "—"}</span>
                    </td>

                    <td>
                      <div className="d-flex gap-2 flex-wrap">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => handleView(r)}>
                          View
                        </button>

                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleApprove(r)}
                          disabled={disableApprove}
                          title={disableApprove ? "Already approved" : "Approve"}
                        >
                          Approve
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleReturn(r)}
                          disabled={disableReturn}
                          title={disableReturn ? "Already approved" : "Return"}
                        >
                          Return
                        </button>

                        <button className="btn btn-outline-dark btn-sm" onClick={() => openPdf(r.id)}>
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="text-center">
                  {loading ? "Loading..." : "No pending syllabus breakdowns found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="d-md-none mt-3">
        {filtered.length ? (
          filtered.map((r, idx) => {
            const st = normalizeStatus(r?.status);
            const disableApprove = st === "APPROVED";
            const disableReturn = st === "APPROVED";
            return (
              <div key={r.id} className="card mb-3 shadow-sm">
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between">
                    <div className="fw-bold">#{idx + 1}</div>
                    <span className={badgeClass(st)}>{st || "—"}</span>
                  </div>

                  <div className="mt-2">
                    <div className="d-flex">
                      <div className="text-muted" style={{ width: 90 }}>
                        Class:
                      </div>
                      <div className="fw-semibold">{r?.Class?.class_name || "—"}</div>
                    </div>

                    <div className="d-flex">
                      <div className="text-muted" style={{ width: 90 }}>
                        Subject:
                      </div>
                      <div className="fw-semibold">{r?.Subject?.subject_name || r?.Subject?.name || "—"}</div>
                    </div>

                    <div className="d-flex">
                      <div className="text-muted" style={{ width: 90 }}>
                        Teacher:
                      </div>
                      <div className="fw-semibold">{r?.Teacher?.name || "—"}</div>
                    </div>

                    <div className="d-flex">
                      <div className="text-muted" style={{ width: 90 }}>
                        Session:
                      </div>
                      <div>{r?.academicSession || "—"}</div>
                    </div>

                    <div className="d-flex">
                      <div className="text-muted" style={{ width: 90 }}>
                        Term:
                      </div>
                      <div>{r?.term || "—"}</div>
                    </div>

                    <div className="d-flex">
                      <div className="text-muted" style={{ width: 90 }}>
                        Submitted:
                      </div>
                      <div>{fmtDateTime(r?.submittedAt || r?.updatedAt)}</div>
                    </div>
                  </div>

                  <div className="d-flex gap-2 flex-wrap mt-3">
                    <button className="btn btn-outline-primary btn-sm" onClick={() => handleView(r)}>
                      View
                    </button>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleApprove(r)}
                      disabled={disableApprove}
                      title={disableApprove ? "Already approved" : "Approve"}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleReturn(r)}
                      disabled={disableReturn}
                      title={disableReturn ? "Already approved" : "Return"}
                    >
                      Return
                    </button>
                    <button className="btn btn-outline-dark btn-sm" onClick={() => openPdf(r.id)}>
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-muted">{loading ? "Loading..." : "No pending syllabus breakdowns found."}</p>
        )}
      </div>
    </div>
  );
};

export default SyllabusApprovalCoordinator;