import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./FeeStructure.css";

/** Role helper */
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

const swalBaseOpts = {
  width: "760px",
  allowOutsideClick: false,
  allowEscapeKey: false,
  focusConfirm: false,
  showCancelButton: true,
};

const OpeningBalances = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  // ---------------------- Data stores ----------------------
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [sessions, setSessions] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);

  // ---------------------- Filters --------------------------
  const [selectedSessionId, setSelectedSessionId] = useState(null); // target session
  const [sourceSessionId, setSourceSessionId] = useState("");
  const [type, setType] = useState(""); // fee|van|generic
  const [feeHeadId, setFeeHeadId] = useState("");
  const [q, setQ] = useState(""); // search in note or student name
  const [minAmt, setMinAmt] = useState("");
  const [maxAmt, setMaxAmt] = useState("");

  const fetchSessions = async () => {
    try {
      const { data } = await api.get("/sessions");
      setSessions(data || []);
      if (!selectedSessionId) {
        const active = (data || []).find((s) => s.is_active) || (data && data[0]);
        if (active) setSelectedSessionId(active.id);
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch sessions.", "error");
    }
  };

  const fetchFeeHeadings = async () => {
    try {
      const { data } = await api.get("/fee-headings");
      setFeeHeadings(data || []);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch fee headings.", "error");
    }
  };

  // Build query params
  const buildParams = useCallback(() => {
    const params = { page, limit };
    if (selectedSessionId) params.session_id = selectedSessionId;
    if (sourceSessionId) params.source_session_id = sourceSessionId;
    if (type) params.type = type;
    if (feeHeadId) params.fee_head_id = feeHeadId;
    if (q) params.q = q;
    if (minAmt) params.min_amt = minAmt;
    if (maxAmt) params.max_amt = maxAmt;
    return params;
  }, [page, limit, selectedSessionId, sourceSessionId, type, feeHeadId, q, minAmt, maxAmt]);

  const fetchList = useCallback(async () => {
    try {
      const params = buildParams();
      const { data } = await api.get("/opening-balances", { params });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("fetchList error", err);
      Swal.fire("Error", "Failed to fetch opening balances.", "error");
    }
  }, [buildParams]);

  // ---------------------- Add/Edit modal (with inline autocomplete) ----------------------
  const openAddOrEditModal = async (existing = null) => {
    if (!canEdit)
      return Swal.fire("Forbidden", "You are not allowed to perform this action.", "warning");

    const sessionOptions = (sessions || [])
      .map((s) => `<option value="${s.id}">${s.name}${s.is_active ? " (Active)" : ""}</option>`)
      .join("");

    const feeHeadOptions = (feeHeadings || [])
      .map((fh) => `<option value="${fh.id}">${fh.fee_heading}</option>`)
      .join("");

    // will hold chosen student object in closure
    let selectedStudent = existing?.Student || null;

    const isEdit = Boolean(existing);
    const html = `
      <style>
  .sb-autocomplete { position: relative; }
  .sb-menu {
    position: absolute; top: 100%; left: 0; right: 0;
    max-height: 280px; overflow: auto; z-index: 1056;
    background: #fff; border: 1px solid rgba(0,0,0,.125);
    border-radius: .375rem; margin-top: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,.12);
  }
  .sb-item {
    padding: .5rem .75rem; cursor: pointer;
    display: flex; flex-direction: column;
    align-items: flex-start;          /* ← ensures left alignment */
    text-align: left;                 /* ← ensures left alignment */
    gap: 2px;
  }
  .sb-item:hover, .sb-item.active { background: #f6f7f9; }
  .primary-line {
    width: 100%; font-weight: 600; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .secondary-line {
    width: 100%; font-size: 12px; color: #6c757d; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pill {
    font-weight: 500; font-size: 12px; color: #495057;
    background: #eef1f5; border-radius: 999px; padding: 1px 8px; margin-left: 6px;
  }
</style>


      <div class="two-col-grid">
        <div>
          <label>Target Session</label>
          <select id="sessionId" class="form-field form-select">${sessionOptions}</select>
        </div>
        <div>
          <label>Source Session</label>
          <select id="sourceSessionId" class="form-field form-select">${sessionOptions}</select>
        </div>

        <div class="full-row">
          <label>Student</label>
          <div class="sb-autocomplete">
            <input id="studentSearch" class="form-field form-control" placeholder="Type name or admission no." autocomplete="off" />
            <div id="studentMenu" class="sb-menu" style="display:none"></div>
          </div>
          <div id="studentPicked" class="form-text mt-1"></div>
        </div>

        <div>
          <label>Type</label>
          <select id="type" class="form-field form-select">
            <option value="fee">fee</option>
            <option value="van">van</option>
            <option value="generic">generic</option>
          </select>
        </div>
        <div>
          <label>Fee Heading (for type=fee)</label>
          <select id="feeHeadId" class="form-field form-select">
            <option value="">(none)</option>
            ${feeHeadOptions}
          </select>
        </div>

        <div>
          <label>Amount</label>
          <input id="amount" type="number" class="form-field form-control" placeholder="e.g. 1200" value="${existing?.amount ?? ""}" />
        </div>
        <div>
          <label>Locked</label>
          <select id="locked" class="form-field form-select">
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>

        <div class="full-row">
          <label>Note</label>
          <input id="note" class="form-field form-control" placeholder="Optional note" value="${existing?.note ?? ""}" />
        </div>
      </div>
    `;

    // tiny debounce helper for the autocomplete
    let debounceT = null;
    const debounce = (fn, ms = 250) => {
      clearTimeout(debounceT);
      debounceT = setTimeout(fn, ms);
    };

    // renderer for the dropdown rows (with class fallback)
   const renderMenu = (list) => {
  if (!list.length) return `<div class="sb-item text-muted">No students found</div>`;
  return list
    .map((s, idx) => {
      const className =
        s?.Class?.class_name ||
        s?.class_name ||
        s?.class?.class_name ||
        s?.className ||
        "-";
      const adm = s.admission_number || "-";
      return `
        <div class="sb-item" data-id="${s.id}" data-idx="${idx}">
          <div class="primary-line">
            ${s.name || "-"}
            <span class="pill">${adm}</span>
          </div>
          <div class="secondary-line">Class: ${className}</div>
        </div>
      `;
    })
    .join("");
};

    // state kept across calls inside swal
    let results = [];

    const fetchStudents = async (term) => {
      try {
        const params = { q: term || "", limit: 25 };
        if (selectedSessionId) params.session_id = selectedSessionId;
        const { data } = await api.get("/students/search", { params });

        // normalize shapes
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.rows)
          ? data.rows
          : Array.isArray(data?.data)
          ? data.data
          : [];

        results = list;
        const menu = Swal.getHtmlContainer().querySelector("#studentMenu");
        menu.innerHTML = renderMenu(results);
        menu.style.display = "block";

        // attach click handlers
        menu.querySelectorAll(".sb-item").forEach((el) => {
          el.addEventListener("click", () => {
            const id = Number(el.getAttribute("data-id"));
            selectedStudent = results.find((r) => r.id === id) || null;
            reflectPicked();
            // collapse menu after pick
            menu.style.display = "none";
          });
        });
      } catch (e) {
        console.error("search error", e);
      }
    };

    const reflectPicked = () => {
      const picked = Swal.getHtmlContainer().querySelector("#studentPicked");
      const input = Swal.getHtmlContainer().querySelector("#studentSearch");
      if (selectedStudent) {
        const className =
          selectedStudent?.Class?.class_name ||
          selectedStudent?.class_name ||
          selectedStudent?.class?.class_name ||
          selectedStudent?.className ||
          "-";
        input.value = `${selectedStudent.name} (${selectedStudent.admission_number || "-"})`;
        picked.textContent = `Selected: ${selectedStudent.name} • ${selectedStudent.admission_number || "-"} • Class ${className}`;
      } else {
        picked.textContent = "";
      }
    };

    return Swal.fire({
      ...swalBaseOpts,
      title: isEdit ? "Edit Opening Balance" : "Add Opening Balance",
      html,
      confirmButtonText: isEdit ? "Save" : "Create",
      didOpen: () => {
        // defaults
        const sessEl = document.getElementById("sessionId");
        const srcSessEl = document.getElementById("sourceSessionId");
        const typeEl = document.getElementById("type");
        const fhEl = document.getElementById("feeHeadId");
        const lockedEl = document.getElementById("locked");
        const input = document.getElementById("studentSearch");
        const menu = document.getElementById("studentMenu");

        sessEl.value = existing?.Session?.id ?? selectedSessionId ?? "";
        srcSessEl.value = existing?.SourceSession?.id ?? "";
        typeEl.value = existing?.type ?? "fee";
        fhEl.value = existing?.FeeHeading?.id ?? "";
        lockedEl.value = String(existing?.locked ?? true);

        // preload the selected student if editing
        if (selectedStudent) reflectPicked();

        // typing -> fetch
        input.addEventListener("input", (e) => {
          const val = e.target.value;
          if (!val || val.length < 1) {
            menu.style.display = "none";
            return;
          }
          debounce(() => fetchStudents(val), 300);
        });

        // keyboard navigation in menu
        let activeIdx = -1;
        input.addEventListener("keydown", (e) => {
          const items = Array.from(menu.querySelectorAll(".sb-item"));
          if (!items.length) return;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIdx = (activeIdx + 1) % items.length;
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIdx = (activeIdx - 1 + items.length) % items.length;
          } else if (e.key === "Enter") {
            if (activeIdx >= 0 && activeIdx < items.length) {
              e.preventDefault();
              const id = Number(items[activeIdx].getAttribute("data-id"));
              selectedStudent = results.find((r) => r.id === id) || null;
              reflectPicked();
              menu.style.display = "none";
            }
          } else {
            return;
          }

          items.forEach((it, idx) =>
            it.classList.toggle("active", idx === activeIdx)
          );
        });

        // click outside menu hides it
        document.addEventListener(
          "click",
          (ev) => {
            if (!Swal.getHtmlContainer()) return;
            const root = Swal.getHtmlContainer();
            if (!root.contains(ev.target)) return;
            if (!menu.contains(ev.target) && ev.target !== input) {
              menu.style.display = "none";
            }
          },
          { capture: true }
        );
      },
      preConfirm: () => {
        const payload = {
          session_id: Number(document.getElementById("sessionId").value),
          source_session_id: Number(document.getElementById("sourceSessionId").value),
          student_id: selectedStudent?.id,
          type: document.getElementById("type").value,
          fee_head_id: document.getElementById("feeHeadId").value
            ? Number(document.getElementById("feeHeadId").value)
            : null,
          amount: Number(document.getElementById("amount").value || 0),
          note: document.getElementById("note").value || null,
          locked: document.getElementById("locked").value === "true",
        };

        if (!payload.session_id) {
          Swal.showValidationMessage("Target session is required");
          return false;
        }
        if (!payload.source_session_id) {
          Swal.showValidationMessage("Source session is required");
          return false;
        }
        if (!payload.student_id) {
          Swal.showValidationMessage("Please select a student");
          return false;
        }
        if (payload.type === "fee" && !payload.fee_head_id) {
          Swal.showValidationMessage("Fee heading is required when type=fee");
          return false;
        }
        return payload;
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;
      const payload = res.value;
      try {
        if (isEdit) {
          await api.put(`/opening-balances/${existing.id}`, payload);
          Swal.fire("Saved", "Opening balance updated.", "success");
        } else {
          await api.post(`/opening-balances`, payload);
          Swal.fire("Created", "Opening balance created.", "success");
        }
        setSelectedSessionId(payload.session_id);
        setPage(1);
        await fetchList();
      } catch (err) {
        console.error(err);
        Swal.fire("Error", err?.response?.data?.message || "Request failed.", "error");
      }
    });
  };

  const handleAdd = () => openAddOrEditModal(null);
  const handleEdit = (row) => openAddOrEditModal(row);

  // ---------------------- Delete / Lock / Unlock ----------------------
  const handleDelete = async (row) => {
    if (!isSuperadmin && row.locked) {
      return Swal.fire("Forbidden", "Locked. Only superadmin can delete.", "warning");
    }
    const { isConfirmed } = await Swal.fire({
      title: "Delete opening balance?",
      text: `${row.Student?.name || "Student"} • ₹${row.amount}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    });
    if (!isConfirmed) return;
    try {
      await api.delete(`/opening-balances/${row.id}`);
      Swal.fire("Deleted", "Record removed.", "success");
      fetchList();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Request failed.", "error");
    }
  };

  const handleLock = async (row, lock = true) => {
    if (!canEdit) return;
    if (!isSuperadmin && !isAdmin) return;
    if (!lock && !isSuperadmin) {
      return Swal.fire("Forbidden", "Only superadmin can unlock.", "warning");
    }
    try {
      const url = lock ? `/opening-balances/${row.id}/lock` : `/opening-balances/${row.id}/unlock`;
      await api.post(url);
      Swal.fire("Success", lock ? "Locked." : "Unlocked.", "success");
      fetchList();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Request failed.", "error");
    }
  };

  // ---------------------- Effects ----------------------
  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchFeeHeadings()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // ---------------------- Pagination helpers ----------------------
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  // ---------------------- Render ----------------------
  return (
    <div className="container mt-4">
      <h1>Opening Balances</h1>

      {/* Filters row */}
      <div className="row g-3 mb-3 align-items-end">
        <div className="col-md-3">
          <label className="form-label">Target Session</label>
          <select
            className="form-select"
            value={selectedSessionId ?? ""}
            onChange={(e) => {
              setSelectedSessionId(Number(e.target.value) || null);
              setPage(1);
            }}
          >
            <option value="">(All)</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.is_active ? "(Active)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Source Session</label>
          <select
            className="form-select"
            value={sourceSessionId}
            onChange={(e) => {
              setSourceSessionId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">(All)</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label">Type</label>
          <select
            className="form-select"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">(All)</option>
            <option value="fee">fee</option>
            <option value="van">van</option>
            <option value="generic">generic</option>
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label">Fee Heading</label>
          <select
            className="form-select"
            value={feeHeadId}
            onChange={(e) => {
              setFeeHeadId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">(All)</option>
            {feeHeadings.map((fh) => (
              <option key={fh.id} value={fh.id}>
                {fh.fee_heading}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label">Search</label>
          <input
            className="form-control"
            placeholder="Note / Student name"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="col-md-2">
          <label className="form-label">Min Amt</label>
          <input
            type="number"
            className="form-control"
            value={minAmt}
            onChange={(e) => {
              setMinAmt(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="col-md-2">
          <label className="form-label">Max Amt</label>
          <input
            type="number"
            className="form-control"
            value={maxAmt}
            onChange={(e) => {
              setMaxAmt(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="col-md-2 d-flex align-items-end">
          <button className="btn btn-outline-secondary w-100" onClick={() => fetchList()}>
            Refresh
          </button>
        </div>

        <div className="col-md-4 text-end d-flex align-items-end justify-content-end gap-2">
          {canEdit && (
            <button className="btn btn-success" onClick={handleAdd}>
              Add Opening Balance
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th>Adm No.</th>
              <th>Target Session</th>
              <th>Source Session</th>
              <th>Type</th>
              <th>Fee Heading</th>
              <th className="text-end">Amount</th>
              <th>Locked</th>
              <th>Note</th>
              {canEdit && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r, idx) => (
                <tr key={r.id}>
                  <td>{(page - 1) * limit + idx + 1}</td>
                  <td>{r.Student?.name || "-"}</td>
                  <td>{r.Student?.admission_number || "-"}</td>
                  <td>{r.Session?.name || "-"}</td>
                  <td>{r.SourceSession?.name || "-"}</td>
                  <td>{r.type}</td>
                  <td>{r.FeeHeading?.fee_heading || (r.type === "fee" ? "-" : "(n/a)")}</td>
                  <td className="text-end">₹{Number(r.amount || 0).toFixed(2)}</td>
                  <td>
                    {r.locked ? (
                      <span className="badge bg-secondary">Locked</span>
                    ) : (
                      <span className="badge bg-success">Open</span>
                    )}
                  </td>
                  <td>{r.note || ""}</td>
                  {canEdit && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-primary btn-sm me-2"
                        onClick={() => handleEdit(r)}
                        disabled={r.locked && !isSuperadmin}
                        title={r.locked && !isSuperadmin ? "Locked. Only superadmin can edit." : "Edit"}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm me-2"
                        onClick={() => handleLock(r, true)}
                        disabled={r.locked}
                        title={r.locked ? "Already locked" : "Lock"}
                      >
                        Lock
                      </button>
                      <button
                        className="btn btn-outline-warning btn-sm me-2"
                        onClick={() => handleLock(r, false)}
                        disabled={!isSuperadmin || !r.locked}
                        title={!isSuperadmin ? "Only superadmin can unlock" : r.locked ? "Unlock" : "Already unlocked"}
                      >
                        Unlock
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(r)}
                        disabled={r.locked && !isSuperadmin}
                        title={r.locked && !isSuperadmin ? "Locked. Only superadmin can delete." : "Delete"}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={canEdit ? 11 : 10} className="text-center">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="d-flex justify-content-between align-items-center">
        <div className="text-muted">
          Total: {total} • Page {page} / {totalPages}
        </div>
        <div className="btn-group">
          <button
            className="btn btn-outline-secondary"
            disabled={!canPrev}
            onClick={() => canPrev && setPage((p) => p - 1)}
          >
            ◀ Prev
          </button>
          <select
            className="form-select"
            style={{ width: 100 }}
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value) || 20);
              setPage(1);
            }}
          >
            {[10, 20, 50, 100, 200].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
          <button
            className="btn btn-outline-secondary"
            disabled={!canNext}
            onClick={() => canNext && setPage((p) => p + 1)}
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpeningBalances;
