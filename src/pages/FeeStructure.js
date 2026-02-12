// src/pages/FeeStructure.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./FeeStructure.css";
import { MultiSelect } from "react-multi-select-component";

// -------------------------------------------------------------
// Role helper: reads roles from localStorage (single or multiple)
// -------------------------------------------------------------
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

const safeDateOrNull = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toString() === "Invalid Date" ? null : dateStr;
};

const formatFineCell = (fee) => {
  if (!fee) return "-";
  if (fee.fineType === "percentage") {
    const pct = fee.finePercentage ?? 0;
    return `${pct}%`;
  }
  const amt = fee.fineAmountPerSlab ?? 0;
  const days = fee.fineSlabDuration ?? 0;
  return `₹${amt} / ${days}d`;
};

const FeeStructure = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [feeStructures, setFeeStructures] = useState([]);
  const [classes, setClasses] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Selected session
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Multi-select filters
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedFeeHeadings, setSelectedFeeHeadings] = useState([]);

  // Quick search
  const [searchText, setSearchText] = useState("");

  // Compact UI toggles
  const [compactMode, setCompactMode] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [showAdvancedCols, setShowAdvancedCols] = useState(false);

  // Bulk fill
  const [bulkValues, setBulkValues] = useState({
    feeDue: "",
    fineType: "percentage",
    finePercentage: "",
    fineAmountPerSlab: "",
    fineSlabDuration: "",
    fineStartDate: "",
    admissionType: "",
    concessionApplicable: "",
    transportApplicable: "",
  });
  const [isBulkApplying, setIsBulkApplying] = useState(false);

  // unified fetch
  const fetchFeeStructures = useCallback(
    async ({ sessionId = selectedSessionId } = {}) => {
      try {
        const params = {};
        if (sessionId) params.session_id = sessionId;
        const query = new URLSearchParams(params).toString();
        const url = query ? `/fee-structures?${query}` : "/fee-structures";
        const { data } = await api.get(url);
        setFeeStructures(data.fees || []);
      } catch (err) {
        console.error("fetchFeeStructures error", err);
        Swal.fire("Error", "Failed to fetch fee structures.", "error");
      }
    },
    [selectedSessionId]
  );

  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(data);
      return data;
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch classes.", "error");
      return [];
    }
  };

  const fetchFeeHeadings = async () => {
    try {
      const { data } = await api.get("/fee-headings");
      setFeeHeadings(data);
      return data;
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch fee headings.", "error");
      return [];
    }
  };

  const fetchSessions = async () => {
    try {
      const { data } = await api.get("/sessions");
      setSessions(data || []);

      if (!selectedSessionId) {
        const active = (data || []).find((s) => s.is_active) || (data && data[0]);
        if (active) setSelectedSessionId(active.id);
      }

      return data;
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch sessions.", "error");
      return [];
    }
  };

  // ---------------------------- CRUD ----------------------------
  const handleDelete = async (fee) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    const result = await Swal.fire({
      title: "Delete fee structure?",
      text: `Class: ${fee.Class?.class_name || "Unknown"} • Category: ${
        fee.FeeHeading?.fee_heading || "Unknown"
      }`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/fee-structures/${fee.id}`);
      Swal.fire("Deleted!", "Fee structure deleted.", "success");
      fetchFeeStructures({ sessionId: selectedSessionId });
    } catch (error) {
      Swal.fire("Error", "Failed to delete the fee structure.", "error");
    }
  };

  const openAddOrEditModal = async (existing = null) => {
    // ensure dropdown data is loaded
    const classesData = classes.length ? classes : await fetchClasses();
    const feeHeadingsData = feeHeadings.length ? feeHeadings : await fetchFeeHeadings();
    const sessionData = sessions.length ? sessions : await fetchSessions();

    const classOptionsHtml = classesData
      .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
      .join("");
    const feeHeadingOptionsHtml = feeHeadingsData
      .map((fh) => `<option value="${fh.id}">${fh.fee_heading}</option>`)
      .join("");
    const sessionOptionsHtml = (sessionData || [])
      .map((s) => `<option value="${s.id}">${s.name}${s.is_active ? " (Active)" : ""}</option>`)
      .join("");

    const isEdit = Boolean(existing);
    const dueDateFormatted =
      existing && existing.fineStartDate
        ? new Date(existing.fineStartDate).toISOString().split("T")[0]
        : "";
    const originalFineType = existing?.fineType || "percentage";

    // ✅ compact sweetalert (smaller title bar + less spacing)
    const swalBaseOpts = {
      width: "640px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      focusConfirm: false,
      showCancelButton: true,
      customClass: {
        popup: "fs-swal-popup",
        title: "fs-swal-title", // smaller title
        confirmButton: "fs-swal-btn",
        cancelButton: "fs-swal-btn fs-swal-btn-cancel",
      },
    };

    const html = `
      <div class="fs-modal-grid">
        <div>
          <label class="fs-lbl">Session</label>
          <select id="sessionId" class="fs-inp">${sessionOptionsHtml}</select>
        </div>

        <div>
          <label class="fs-lbl">Class</label>
          <select id="classId" class="fs-inp">${classOptionsHtml}</select>
        </div>

        <div class="fs-span-2">
          <label class="fs-lbl">Category</label>
          <select id="feeHeadingId" class="fs-inp">${feeHeadingOptionsHtml}</select>
        </div>

        <div>
          <label class="fs-lbl">Fee Due</label>
          <input type="number" id="feeDue" class="fs-inp" placeholder="e.g. 1500" value="${
            existing?.feeDue ?? ""
          }">
        </div>

        <div>
          <label class="fs-lbl">Fine Type</label>
          <select id="fineType" class="fs-inp">
            <option value="percentage">Percentage</option>
            <option value="slab">Slab</option>
          </select>
        </div>

        <div id="finePctWrap" class="fs-span-2" style="display:${
          originalFineType === "percentage" ? "grid" : "none"
        };">
          <div class="fs-row-compact">
            <div>
              <label class="fs-lbl">Fine %</label>
              <input type="number" id="finePercentage" class="fs-inp" placeholder="%" value="${
                existing?.finePercentage ?? ""
              }">
            </div>
          </div>
        </div>

        <div id="fineSlabWrap" class="fs-span-2" style="display:${
          originalFineType === "slab" ? "grid" : "none"
        };">
          <div class="fs-row-compact">
            <div>
              <label class="fs-lbl">Amt/Slab</label>
              <input type="number" id="fineAmountPerSlab" class="fs-inp" placeholder="₹" value="${
                existing?.fineAmountPerSlab ?? ""
              }">
            </div>
            <div>
              <label class="fs-lbl">Slab Days</label>
              <input type="number" id="fineSlabDuration" class="fs-inp" placeholder="days" value="${
                existing?.fineSlabDuration ?? ""
              }">
            </div>
          </div>
        </div>

        <div>
          <label class="fs-lbl">Due Date</label>
          <input type="date" id="fineStartDate" class="fs-inp" value="${dueDateFormatted}">
        </div>

        <div>
          <label class="fs-lbl">Admission</label>
          <select id="admissionType" class="fs-inp">
            <option value="New">New</option>
            <option value="Old">Old</option>
            <option value="All">All</option>
          </select>
        </div>

        <div>
          <label class="fs-lbl">Concession</label>
          <select id="concessionApplicable" class="fs-inp">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div>
          <label class="fs-lbl">Transport</label>
          <select id="transportApplicable" class="fs-inp">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>
      </div>
    `;

    // ✅ short title (small height)
    const modalTitle = isEdit ? "Edit Fee" : "Add Fee";

    return Swal.fire({
      ...swalBaseOpts,
      title: modalTitle,
      html,
      didOpen: () => {
        // set current values if edit
        if (existing) {
          document.getElementById("sessionId").value =
            existing.Session?.id ?? selectedSessionId ?? "";
          document.getElementById("classId").value = existing.Class?.id ?? "";
          document.getElementById("feeHeadingId").value = existing.FeeHeading?.id ?? "";
          document.getElementById("admissionType").value = existing.admissionType ?? "All";
          document.getElementById("concessionApplicable").value =
            existing.concessionApplicable ?? "No";
          document.getElementById("transportApplicable").value =
            existing.transportApplicable ?? "No";
          document.getElementById("fineType").value = existing.fineType ?? "percentage";
        } else {
          if (selectedSessionId) document.getElementById("sessionId").value = selectedSessionId;
          document.getElementById("admissionType").value = "All";
          document.getElementById("concessionApplicable").value = "No";
          document.getElementById("transportApplicable").value = "No";
          document.getElementById("fineType").value = "percentage";
        }

        const fineTypeSelect = document.getElementById("fineType");
        const pctWrap = document.getElementById("finePctWrap");
        const slabWrap = document.getElementById("fineSlabWrap");

        const applyFineMode = () => {
          const isPct = fineTypeSelect.value === "percentage";
          pctWrap.style.display = isPct ? "grid" : "none";
          slabWrap.style.display = isPct ? "none" : "grid";
          if (isPct) {
            const a = document.getElementById("fineAmountPerSlab");
            const d = document.getElementById("fineSlabDuration");
            if (a) a.value = "";
            if (d) d.value = "";
          } else {
            const p = document.getElementById("finePercentage");
            if (p) p.value = "";
          }
        };

        fineTypeSelect.addEventListener("change", applyFineMode);
        applyFineMode();
      },
      preConfirm: () => {
        const sessionId = document.getElementById("sessionId").value;
        const admissionType = document.getElementById("admissionType").value;
        const fineType = document.getElementById("fineType").value;

        if (!sessionId) {
          Swal.showValidationMessage("Session is required");
          return false;
        }
        if (!admissionType) {
          Swal.showValidationMessage("Admission Type is required");
          return false;
        }

        return {
          session_id: sessionId,
          class_id: document.getElementById("classId").value,
          fee_heading_id: document.getElementById("feeHeadingId").value,
          feeDue: document.getElementById("feeDue").value,

          fineType,
          finePercentage:
            fineType === "percentage"
              ? document.getElementById("finePercentage")?.value ?? ""
              : null,
          fineAmountPerSlab:
            fineType === "slab"
              ? document.getElementById("fineAmountPerSlab")?.value ?? ""
              : null,
          fineSlabDuration:
            fineType === "slab"
              ? document.getElementById("fineSlabDuration")?.value ?? ""
              : null,

          // ✅ still saving in same field, only label changed to Due Date
          fineStartDate: safeDateOrNull(document.getElementById("fineStartDate").value),

          admissionType,
          concessionApplicable: document.getElementById("concessionApplicable").value,
          transportApplicable: document.getElementById("transportApplicable").value,
        };
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;

      try {
        if (isEdit) {
          await api.put(`/fee-structures/${existing.id}`, res.value);
          Swal.fire("Updated!", "Fee structure updated.", "success");
        } else {
          await api.post(`/fee-structures`, res.value);
          Swal.fire("Added!", "Fee structure added.", "success");
        }

        setSelectedSessionId(Number(res.value.session_id));
        fetchFeeStructures({ sessionId: Number(res.value.session_id) });
      } catch (e) {
        console.error(e);
        Swal.fire("Error", `Failed to ${isEdit ? "update" : "add"} the fee structure.`, "error");
      }
    });
  };

  const handleAdd = () => openAddOrEditModal(null);
  const handleEdit = (fee) => openAddOrEditModal(fee);

  // ---------------------- Options & Filters ----------------------
  const classOptions = useMemo(
    () => classes.map((c) => ({ label: c.class_name, value: String(c.id) })),
    [classes]
  );
  const headingOptions = useMemo(
    () => feeHeadings.map((fh) => ({ label: fh.fee_heading, value: String(fh.id) })),
    [feeHeadings]
  );

  const filteredFeeStructures = useMemo(() => {
    const classSet = new Set(selectedClasses.map((s) => s.value));
    const headSet = new Set(selectedFeeHeadings.map((s) => s.value));
    const text = searchText.trim().toLowerCase();

    return feeStructures.filter((fee) => {
      const classId = String(fee.Class?.id ?? "");
      const headId = String(fee.FeeHeading?.id ?? "");
      const classMatch = classSet.size ? classSet.has(classId) : true;
      const headMatch = headSet.size ? headSet.has(headId) : true;

      const textMatch =
        !text ||
        [fee.Session?.name, fee.Class?.class_name, fee.FeeHeading?.fee_heading, String(fee.feeDue ?? "")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(text);

      return classMatch && headMatch && textMatch;
    });
  }, [feeStructures, selectedClasses, selectedFeeHeadings, searchText]);

  // ------------------------ Bulk Apply ---------------------------
  const buildBulkPayload = () => {
    const {
      feeDue,
      fineType,
      finePercentage,
      fineAmountPerSlab,
      fineSlabDuration,
      fineStartDate,
      admissionType,
      concessionApplicable,
      transportApplicable,
    } = bulkValues;

    const payload = {};
    if (feeDue !== "") payload.feeDue = Number(feeDue);
    if (fineType) payload.fineType = fineType;

    if (fineType === "percentage") {
      if (finePercentage !== "") payload.finePercentage = Number(finePercentage);
      payload.fineAmountPerSlab = null;
      payload.fineSlabDuration = null;
    } else if (fineType === "slab") {
      if (fineAmountPerSlab !== "") payload.fineAmountPerSlab = Number(fineAmountPerSlab);
      if (fineSlabDuration !== "") payload.fineSlabDuration = Number(fineSlabDuration);
      payload.finePercentage = null;
    }

    if (fineStartDate !== "") payload.fineStartDate = safeDateOrNull(fineStartDate);

    if (admissionType !== "") payload.admissionType = admissionType;
    if (concessionApplicable !== "") payload.concessionApplicable = concessionApplicable;
    if (transportApplicable !== "") payload.transportApplicable = transportApplicable;

    return payload;
  };

  const handleBulkApply = async () => {
    if (!canEdit) {
      return Swal.fire("Forbidden", "Only Admin/Super Admin can perform bulk update.", "warning");
    }
    if (filteredFeeStructures.length === 0) {
      return Swal.fire("No Records", "There are no filtered fee structures to update.", "info");
    }

    const payload = buildBulkPayload();
    if (Object.keys(payload).length === 0) {
      return Swal.fire("Nothing to Update", "Please enter at least one field to apply.", "info");
    }

    const { value: confirmed } = await Swal.fire({
      title: "Apply to filtered?",
      html: `
        <div style="text-align:left">
          Updating <b>${filteredFeeStructures.length}</b> record(s).<br/><br/>
          <b>Fields to set:</b>
          <pre style="white-space:pre-wrap;border:1px solid #eee;padding:8px;border-radius:6px;background:#fafafa;max-height:200px;overflow:auto;">${JSON.stringify(
            payload,
            null,
            2
          )}</pre>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, update all",
      cancelButtonText: "Cancel",
      allowOutsideClick: false,
      allowEscapeKey: false,
      width: 640,
    });

    if (!confirmed) return;

    setIsBulkApplying(true);
    try {
      const results = await Promise.allSettled(
        filteredFeeStructures.map((fee) => api.put(`/fee-structures/${fee.id}`, payload))
      );

      const success = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - success;

      Swal.fire("Bulk Update Complete", `Updated: ${success}\nFailed: ${failed}`, failed ? "warning" : "success");
      fetchFeeStructures({ sessionId: selectedSessionId });
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Bulk update failed due to an unexpected error.", "error");
    } finally {
      setIsBulkApplying(false);
    }
  };

  // ---------------------------- Mount ----------------------------
  useEffect(() => {
    (async () => {
      await Promise.all([fetchSessions(), fetchClasses(), fetchFeeHeadings()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when selectedSessionId changes, fetch fees for that session
  useEffect(() => {
    fetchFeeStructures({ sessionId: selectedSessionId });
  }, [selectedSessionId, fetchFeeStructures]);

  // optional polling - 5s
  useEffect(() => {
    const polling = setInterval(() => fetchFeeStructures({ sessionId: selectedSessionId }), 5000);
    return () => clearInterval(polling);
  }, [selectedSessionId, fetchFeeStructures]);

  // ---------------------------- Render ---------------------------
  return (
    <div className={`container mt-3 fee-structure-page ${compactMode ? "fs-compact" : ""}`}>
      <div className="fs-header">
        <div className="fs-titleWrap">
          <h1 className="fs-title">Fee Structure</h1>
          <div className="fs-sub">Fast filters • compact layout • less scrolling</div>
        </div>

        <div className="fs-toggles">
          <label className="form-check form-switch m-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={compactMode}
              onChange={(e) => setCompactMode(e.target.checked)}
            />
            <span className="form-check-label">Compact</span>
          </label>

          <label className="form-check form-switch m-0">
            <input
              className="form-check-input"
              type="checkbox"
              checked={showAdvancedCols}
              onChange={(e) => setShowAdvancedCols(e.target.checked)}
            />
            <span className="form-check-label">More Columns</span>
          </label>
        </div>
      </div>

      {/* Top bar */}
      <div className="fs-topbar card shadow-sm mb-2">
        <div className="card-body fs-topbar-body">
          <div className="fs-grid-2">
            <div>
              <label className="form-label fs-lbl2">Session</label>
              <select
                className="form-select fs-inp2"
                value={selectedSessionId ?? ""}
                onChange={(e) => setSelectedSessionId(Number(e.target.value) || null)}
              >
                <option value="">(All sessions)</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_active ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label fs-lbl2">Quick Search</label>
              <input
                className="form-control fs-inp2"
                placeholder="class / category / fee"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="fs-actionsRow">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => fetchFeeStructures({ sessionId: selectedSessionId })}
              >
                Refresh
              </button>

              {canEdit && (
                <button className="btn btn-success btn-sm" onClick={handleAdd}>
                  + Add
                </button>
              )}

              {canEdit && (
                <button className="btn btn-outline-primary btn-sm" onClick={() => setShowBulk((s) => !s)}>
                  {showBulk ? "Hide Bulk" : "Bulk Fill"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-2">
        <div className="card-body fs-filter-body">
          <div className="fs-grid-2">
            <div>
              <label className="form-label fs-lbl2">Class</label>
              <MultiSelect
                options={classOptions}
                value={selectedClasses}
                onChange={setSelectedClasses}
                labelledBy="Select Classes"
                hasSelectAll={true}
                disableSearch={false}
                ClearSelectedIcon={null}
              />
              <div className="fs-hint">None selected = all classes</div>
            </div>

            <div>
              <label className="form-label fs-lbl2">Category</label>
              <MultiSelect
                options={headingOptions}
                value={selectedFeeHeadings}
                onChange={setSelectedFeeHeadings}
                labelledBy="Select Categories"
                hasSelectAll={true}
                disableSearch={false}
                ClearSelectedIcon={null}
              />
              <div className="fs-hint">None selected = all categories</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Fill (collapsible) */}
      {canEdit && showBulk && (
        <div className="card shadow-sm mb-2">
          <div className="card-body">
            <div className="fs-bulk-head">
              <div>
                <div className="fs-bulk-title">Bulk Fill (Filtered)</div>
                <div className="fs-hint">
                  Only filled fields are updated • Records: <b>{filteredFeeStructures.length}</b>
                </div>
              </div>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleBulkApply}
                disabled={isBulkApplying}
                title={
                  filteredFeeStructures.length
                    ? `Apply to ${filteredFeeStructures.length} filtered item(s)`
                    : "No filtered items"
                }
              >
                {isBulkApplying ? "Applying..." : `Apply (${filteredFeeStructures.length})`}
              </button>
            </div>

            <div className="fs-bulk-grid">
              <div>
                <label className="form-label fs-lbl2">Fee Due</label>
                <input
                  type="number"
                  className="form-control fs-inp2"
                  value={bulkValues.feeDue}
                  onChange={(e) => setBulkValues((s) => ({ ...s, feeDue: e.target.value }))}
                  placeholder="e.g. 1500"
                />
              </div>

              <div>
                <label className="form-label fs-lbl2">Fine Type</label>
                <select
                  className="form-select fs-inp2"
                  value={bulkValues.fineType}
                  onChange={(e) => setBulkValues((s) => ({ ...s, fineType: e.target.value }))}
                >
                  <option value="percentage">Percentage</option>
                  <option value="slab">Slab</option>
                </select>
              </div>

              {bulkValues.fineType === "percentage" ? (
                <div>
                  <label className="form-label fs-lbl2">Fine %</label>
                  <input
                    type="number"
                    className="form-control fs-inp2"
                    value={bulkValues.finePercentage}
                    onChange={(e) => setBulkValues((s) => ({ ...s, finePercentage: e.target.value }))}
                    placeholder="%"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="form-label fs-lbl2">Amt/Slab</label>
                    <input
                      type="number"
                      className="form-control fs-inp2"
                      value={bulkValues.fineAmountPerSlab}
                      onChange={(e) => setBulkValues((s) => ({ ...s, fineAmountPerSlab: e.target.value }))}
                      placeholder="₹"
                    />
                  </div>
                  <div>
                    <label className="form-label fs-lbl2">Slab Days</label>
                    <input
                      type="number"
                      className="form-control fs-inp2"
                      value={bulkValues.fineSlabDuration}
                      onChange={(e) => setBulkValues((s) => ({ ...s, fineSlabDuration: e.target.value }))}
                      placeholder="days"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="form-label fs-lbl2">Due Date</label>
                <input
                  type="date"
                  className="form-control fs-inp2"
                  value={bulkValues.fineStartDate}
                  onChange={(e) => setBulkValues((s) => ({ ...s, fineStartDate: e.target.value }))}
                />
              </div>

              <div>
                <label className="form-label fs-lbl2">Admission</label>
                <select
                  className="form-select fs-inp2"
                  value={bulkValues.admissionType}
                  onChange={(e) => setBulkValues((s) => ({ ...s, admissionType: e.target.value }))}
                >
                  <option value="">(No change)</option>
                  <option value="New">New</option>
                  <option value="Old">Old</option>
                  <option value="All">All</option>
                </select>
              </div>

              <div>
                <label className="form-label fs-lbl2">Concession</label>
                <select
                  className="form-select fs-inp2"
                  value={bulkValues.concessionApplicable}
                  onChange={(e) => setBulkValues((s) => ({ ...s, concessionApplicable: e.target.value }))}
                >
                  <option value="">(No change)</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label className="form-label fs-lbl2">Transport</label>
                <select
                  className="form-select fs-inp2"
                  value={bulkValues.transportApplicable}
                  onChange={(e) => setBulkValues((s) => ({ ...s, transportApplicable: e.target.value }))}
                >
                  <option value="">(No change)</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div className="fs-hint mt-2">Tip: keep Bulk collapsed when not needed (biggest height saver).</div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-responsive fs-tableWrap">
        <table className="table table-striped fs-table">
          <thead className="fs-thead">
            <tr>
              <th style={{ width: 42 }}>#</th>
              <th>Session</th>
              <th>Class</th>
              <th>Category</th>
              <th style={{ width: 90 }}>Fee</th>
              <th style={{ width: 90 }}>Fine</th>
              <th style={{ width: 110 }}>Due Date</th>
              <th style={{ width: 90 }}>Admission</th>
              <th style={{ width: 110 }}>Flags</th>

              {showAdvancedCols && (
                <>
                  <th style={{ width: 90 }}>Fine Type</th>
                  <th style={{ width: 120 }}>Raw Fine</th>
                </>
              )}

              {canEdit && <th style={{ width: 130 }}>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {filteredFeeStructures.length > 0 ? (
              filteredFeeStructures.map((fee, index) => {
                const flags = [
                  fee.concessionApplicable === "Yes" ? "Concession" : null,
                  fee.transportApplicable === "Yes" ? "Transport" : null,
                ].filter(Boolean);

                return (
                  <tr key={fee.id}>
                    <td>{index + 1}</td>
                    <td className="fs-wrap">{fee.Session?.name || "-"}</td>
                    <td className="fs-wrap">{fee.Class?.class_name || "Unknown"}</td>
                    <td className="fs-wrap">{fee.FeeHeading?.fee_heading || "Unknown"}</td>

                    <td className="text-nowrap">{fee.feeDue ?? "-"}</td>
                    <td className="text-nowrap">{formatFineCell(fee)}</td>
                    <td className="text-nowrap">{fee.fineStartDate || "-"}</td>
                    <td className="text-nowrap">{fee.admissionType || "-"}</td>

                    <td className="fs-wrap">
                      {flags.length ? flags.join(", ") : <span className="text-muted">None</span>}
                    </td>

                    {showAdvancedCols && (
                      <>
                        <td className="text-nowrap">{fee.fineType || "-"}</td>
                        <td className="fs-wrap">
                          {fee.fineType === "percentage"
                            ? `${fee.finePercentage ?? 0}%`
                            : `₹${fee.fineAmountPerSlab ?? 0} / ${fee.fineSlabDuration ?? 0} days`}
                        </td>
                      </>
                    )}

                    {canEdit && (
                      <td className="text-nowrap">
                        <button className="btn btn-primary btn-sm me-1" onClick={() => handleEdit(fee)}>
                          Edit
                        </button>
                        {isSuperadmin && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(fee)}>
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={canEdit ? (showAdvancedCols ? 12 : 10) : showAdvancedCols ? 11 : 9}
                  className="text-center"
                >
                  No Fee Structures Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeeStructure;
