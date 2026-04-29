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

const getApiErrorMessage = (err, fallback = "Something went wrong.") => {
  return (
    err?.response?.data?.details ||
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    fallback
  );
};

const normalizeBoolToSelectValue = (value) => {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "True" ||
    value === "Yes" ||
    value === "YES" ||
    value === "yes"
  ) {
    return "true";
  }
  return "false";
};

const FeeStructure = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [feeStructures, setFeeStructures] = useState([]);
  const [classes, setClasses] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedFeeHeadings, setSelectedFeeHeadings] = useState([]);

  const [searchText, setSearchText] = useState("");

  const [compactMode, setCompactMode] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [showAdvancedCols, setShowAdvancedCols] = useState(false);

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
        Swal.fire(
          "Error",
          getApiErrorMessage(err, "Failed to fetch fee structures."),
          "error"
        );
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
      Swal.fire(
        "Error",
        getApiErrorMessage(err, "Failed to fetch classes."),
        "error"
      );
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
      Swal.fire(
        "Error",
        getApiErrorMessage(err, "Failed to fetch fee headings."),
        "error"
      );
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
      Swal.fire(
        "Error",
        getApiErrorMessage(err, "Failed to fetch sessions."),
        "error"
      );
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
      Swal.fire(
        "Error",
        getApiErrorMessage(error, "Failed to delete the fee structure."),
        "error"
      );
    }
  };

  const openAddOrEditModal = async (existing = null) => {
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
      .map(
        (s) =>
          `<option value="${s.id}">${s.name}${s.is_active ? " (Active)" : ""}</option>`
      )
      .join("");

    const isEdit = Boolean(existing);

    const dueDateFormatted =
      existing && existing.fineStartDate
        ? new Date(existing.fineStartDate).toISOString().split("T")[0]
        : "";

    const originalFineType = existing?.fineType || "percentage";

    const swalBaseOpts = {
      width: "640px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      focusConfirm: false,
      showCancelButton: true,
      customClass: {
        popup: "fs-swal-popup",
        title: "fs-swal-title",
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
          <input
            type="number"
            id="feeDue"
            class="fs-inp"
            placeholder="e.g. 1500"
            value="${existing?.feeDue ?? ""}"
          >
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
              <input
                type="number"
                id="finePercentage"
                class="fs-inp"
                placeholder="%"
                value="${existing?.finePercentage ?? ""}"
              >
            </div>
          </div>
        </div>

        <div id="fineSlabWrap" class="fs-span-2" style="display:${
          originalFineType === "slab" ? "grid" : "none"
        };">
          <div class="fs-row-compact">
            <div>
              <label class="fs-lbl">Amt/Slab</label>
              <input
                type="number"
                id="fineAmountPerSlab"
                class="fs-inp"
                placeholder="₹"
                value="${existing?.fineAmountPerSlab ?? ""}"
              >
            </div>
            <div>
              <label class="fs-lbl">Slab Days</label>
              <input
                type="number"
                id="fineSlabDuration"
                class="fs-inp"
                placeholder="days"
                value="${existing?.fineSlabDuration ?? ""}"
              >
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
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>

        <div>
          <label class="fs-lbl">Transport</label>
          <select id="transportApplicable" class="fs-inp">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </div>
      </div>
    `;

    const modalTitle = isEdit ? "Edit Fee" : "Add Fee";

    return Swal.fire({
      ...swalBaseOpts,
      title: modalTitle,
      html,
      didOpen: () => {
        if (existing) {
          document.getElementById("sessionId").value =
            existing.Session?.id ?? existing.session_id ?? selectedSessionId ?? "";
          document.getElementById("classId").value =
            existing.Class?.id ?? existing.class_id ?? "";
          document.getElementById("feeHeadingId").value =
            existing.FeeHeading?.id ?? existing.fee_heading_id ?? "";
          document.getElementById("admissionType").value =
            existing.admissionType ?? "All";
          document.getElementById("concessionApplicable").value =
            normalizeBoolToSelectValue(existing?.concessionApplicable);
          document.getElementById("transportApplicable").value =
            normalizeBoolToSelectValue(existing?.transportApplicable);
          document.getElementById("fineType").value =
            existing.fineType ?? "percentage";
        } else {
          if (selectedSessionId) {
            document.getElementById("sessionId").value = selectedSessionId;
          }
          document.getElementById("admissionType").value = "All";
          document.getElementById("concessionApplicable").value = "false";
          document.getElementById("transportApplicable").value = "false";
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
        const classId = document.getElementById("classId").value;
        const feeHeadingId = document.getElementById("feeHeadingId").value;
        const feeDue = document.getElementById("feeDue").value;
        const admissionType = document.getElementById("admissionType").value;
        const fineType = document.getElementById("fineType").value;

        if (!sessionId) {
          Swal.showValidationMessage("Session is required");
          return false;
        }
        if (!classId) {
          Swal.showValidationMessage("Class is required");
          return false;
        }
        if (!feeHeadingId) {
          Swal.showValidationMessage("Category is required");
          return false;
        }
        if (feeDue === "") {
          Swal.showValidationMessage("Fee Due is required");
          return false;
        }
        if (!admissionType) {
          Swal.showValidationMessage("Admission Type is required");
          return false;
        }

        return {
          session_id: Number(sessionId),
          class_id: Number(classId),
          fee_heading_id: Number(feeHeadingId),
          feeDue: Number(feeDue),

          fineType,
          finePercentage:
            fineType === "percentage"
              ? Number(document.getElementById("finePercentage")?.value || 0)
              : null,
          fineAmountPerSlab:
            fineType === "slab"
              ? Number(document.getElementById("fineAmountPerSlab")?.value || 0)
              : null,
          fineSlabDuration:
            fineType === "slab"
              ? Number(document.getElementById("fineSlabDuration")?.value || 0)
              : null,

          fineStartDate: safeDateOrNull(
            document.getElementById("fineStartDate").value
          ),

          admissionType,
          concessionApplicable:
            document.getElementById("concessionApplicable").value === "true",
          transportApplicable:
            document.getElementById("transportApplicable").value === "true",
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
        Swal.fire(
          "Error",
          getApiErrorMessage(
            e,
            `Failed to ${isEdit ? "update" : "add"} the fee structure.`
          ),
          "error"
        );
      }
    });
  };

  const openCopyClassStructureModal = async () => {
    const classesData = classes.length ? classes : await fetchClasses();
    const sessionData = sessions.length ? sessions : await fetchSessions();

    if (!classesData.length) {
      return Swal.fire("No Classes", "No classes are available.", "info");
    }

    if (!sessionData.length) {
      return Swal.fire("No Sessions", "No sessions are available.", "info");
    }

    const classOptionsHtml = classesData
      .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
      .join("");

    const sessionOptionsHtml = sessionData
      .map(
        (s) =>
          `<option value="${s.id}">${s.name}${s.is_active ? " (Active)" : ""}</option>`
      )
      .join("");

    const html = `
      <div style="text-align:left;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="fs-lbl" for="copyFromSessionId">Source Session</label>
            <select id="copyFromSessionId" class="fs-inp">${sessionOptionsHtml}</select>
          </div>

          <div>
            <label class="fs-lbl" for="copyToSessionId">Target Session</label>
            <select id="copyToSessionId" class="fs-inp">${sessionOptionsHtml}</select>
          </div>

          <div>
            <label class="fs-lbl" for="copyFromClassId">Source Class</label>
            <select id="copyFromClassId" class="fs-inp">${classOptionsHtml}</select>
          </div>

          <div>
            <label class="fs-lbl" for="copyOverwriteExisting">If target already exists</label>
            <select id="copyOverwriteExisting" class="fs-inp">
              <option value="false">Skip existing target rows</option>
              <option value="true">Overwrite existing target rows</option>
            </select>
          </div>
        </div>

        <div style="margin-top:14px;">
          <label class="fs-lbl" for="copyTargetClassIds">Target Classes</label>
          <select
            id="copyTargetClassIds"
            class="fs-inp"
            multiple
            size="10"
            style="min-height:220px;"
          >
            ${classOptionsHtml}
          </select>
          <div style="font-size:12px;color:#666;margin-top:6px;">
            Hold Ctrl / Cmd to select multiple target classes.
          </div>
        </div>
      </div>
    `;

    const res = await Swal.fire({
      title: "Copy Full Class Structure",
      html,
      width: "780px",
      showCancelButton: true,
      confirmButtonText: "Copy Now",
      allowOutsideClick: false,
      allowEscapeKey: false,
      focusConfirm: false,
      customClass: {
        popup: "fs-swal-popup",
        title: "fs-swal-title",
        confirmButton: "fs-swal-btn",
        cancelButton: "fs-swal-btn fs-swal-btn-cancel",
      },
      didOpen: () => {
        const fromSessionEl = document.getElementById("copyFromSessionId");
        const toSessionEl = document.getElementById("copyToSessionId");

        if (selectedSessionId) {
          fromSessionEl.value = String(selectedSessionId);
          toSessionEl.value = String(selectedSessionId);
        }
      },
      preConfirm: () => {
        const fromClassValue = document.getElementById("copyFromClassId")?.value;
        const fromSessionValue = document.getElementById("copyFromSessionId")?.value;
        const toSessionValue = document.getElementById("copyToSessionId")?.value;

        const fromClassId =
          fromClassValue === "" ||
          fromClassValue === undefined ||
          fromClassValue === null
            ? null
            : Number(fromClassValue);

        const fromSessionId =
          fromSessionValue === "" ||
          fromSessionValue === undefined ||
          fromSessionValue === null
            ? null
            : Number(fromSessionValue);

        const toSessionId =
          toSessionValue === "" ||
          toSessionValue === undefined ||
          toSessionValue === null
            ? null
            : Number(toSessionValue);

        const selectedOptions = Array.from(
          document.getElementById("copyTargetClassIds")?.selectedOptions || []
        );

        const targetClassIds = [
          ...new Set(
            selectedOptions
              .map((opt) => opt.value)
              .filter((v) => v !== "" && v !== undefined && v !== null)
              .map((v) => Number(v))
              .filter((v) => Number.isInteger(v) && v !== fromClassId)
          ),
        ];

        if (fromSessionId === null) {
          Swal.showValidationMessage("Source session is required");
          return false;
        }

        if (toSessionId === null) {
          Swal.showValidationMessage("Target session is required");
          return false;
        }

        if (fromClassId === null) {
          Swal.showValidationMessage("Source class is required");
          return false;
        }

        if (!targetClassIds.length) {
          Swal.showValidationMessage(
            "Please select at least one target class other than source class"
          );
          return false;
        }

        return {
          from_class_id: fromClassId,
          from_session_id: fromSessionId,
          to_session_id: toSessionId,
          to_class_ids: targetClassIds,
          overwrite:
            document.getElementById("copyOverwriteExisting")?.value === "true",
        };
      },
    });

    if (!res.isConfirmed) return;

    try {
      const { data } = await api.post("/fee-structures/copy-class", res.value);

      const created = Number(data?.created || 0);
      const updated = Number(data?.updated || 0);
      const perTarget = data?.per_target || {};

      const classNameMap = new Map(
        classesData.map((cls) => [String(cls.id), cls.class_name])
      );

      const perTargetHtml = Object.entries(perTarget)
        .map(([classId, stats]) => {
          const className = classNameMap.get(String(classId)) || `Class ${classId}`;
          return `
            <tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;">${className}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${Number(
                stats?.created || 0
              )}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${Number(
                stats?.updated || 0
              )}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${Number(
                stats?.skipped || 0
              )}</td>
            </tr>
          `;
        })
        .join("");

      await Swal.fire({
        title: "Class Copy Complete",
        icon: "success",
        width: "760px",
        html: `
          <div style="text-align:left;">
            <div style="margin-bottom:10px;"><b>Created:</b> ${created}</div>
            <div style="margin-bottom:10px;"><b>Updated:</b> ${updated}</div>
            <div style="margin-top:14px;margin-bottom:8px;"><b>Per Target Summary</b></div>
            <div style="max-height:280px;overflow:auto;border:1px solid #eee;border-radius:8px;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead style="background:#fafafa;position:sticky;top:0;">
                  <tr>
                    <th style="padding:8px;text-align:left;border-bottom:1px solid #eee;">Class</th>
                    <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">Created</th>
                    <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">Updated</th>
                    <th style="padding:8px;text-align:right;border-bottom:1px solid #eee;">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  ${perTargetHtml || '<tr><td colspan="4" style="padding:10px;text-align:center;">No summary available</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        `,
      });

      if (res.value?.to_session_id) {
        setSelectedSessionId(Number(res.value.to_session_id));
        fetchFeeStructures({ sessionId: Number(res.value.to_session_id) });
      } else {
        fetchFeeStructures({ sessionId: selectedSessionId });
      }
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        getApiErrorMessage(error, "Failed to copy full fee structure to target class(es)."),
        "error"
      );
    }
  };

  const openCopySessionStructureModal = async () => {
    const classesData = classes.length ? classes : await fetchClasses();
    const sessionData = sessions.length ? sessions : await fetchSessions();

    if (!sessionData.length) {
      return Swal.fire("No Sessions", "No sessions are available.", "info");
    }

    const sessionOptionsHtml = sessionData
      .map(
        (s) =>
          `<option value="${s.id}">${s.name}${s.is_active ? " (Active)" : ""}</option>`
      )
      .join("");

    const classOptionsHtml = classesData.length
      ? `
        <option value="">All Classes</option>
        ${classesData
          .map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`)
          .join("")}
      `
      : `<option value="">All Classes</option>`;

    const res = await Swal.fire({
      title: "Copy Session Structure",
      width: "700px",
      showCancelButton: true,
      confirmButtonText: "Copy Now",
      allowOutsideClick: false,
      allowEscapeKey: false,
      focusConfirm: false,
      customClass: {
        popup: "fs-swal-popup",
        title: "fs-swal-title",
        confirmButton: "fs-swal-btn",
        cancelButton: "fs-swal-btn fs-swal-btn-cancel",
      },
      html: `
        <div style="text-align:left;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="fs-lbl" for="copySessionFromId">Source Session</label>
            <select id="copySessionFromId" class="fs-inp">${sessionOptionsHtml}</select>
          </div>

          <div>
            <label class="fs-lbl" for="copySessionToId">Target Session</label>
            <select id="copySessionToId" class="fs-inp">${sessionOptionsHtml}</select>
          </div>

          <div>
            <label class="fs-lbl" for="copySessionClassId">Class Filter</label>
            <select id="copySessionClassId" class="fs-inp">${classOptionsHtml}</select>
            <div style="font-size:12px;color:#666;margin-top:6px;">
              Leave as All Classes to copy the whole session.
            </div>
          </div>

          <div>
            <label class="fs-lbl" for="copySessionOverwriteExisting">If target already exists</label>
            <select id="copySessionOverwriteExisting" class="fs-inp">
              <option value="false">Skip existing target rows</option>
              <option value="true">Overwrite existing target rows</option>
            </select>
          </div>
        </div>
      `,
      didOpen: () => {
        const fromSessionEl = document.getElementById("copySessionFromId");
        const toSessionEl = document.getElementById("copySessionToId");

        if (selectedSessionId) {
          fromSessionEl.value = String(selectedSessionId);
        }

        const currentIndex = sessionData.findIndex(
          (s) => Number(s.id) === Number(selectedSessionId)
        );
        const fallbackTarget =
          currentIndex >= 0 && sessionData[currentIndex + 1]
            ? sessionData[currentIndex + 1].id
            : sessionData[0]?.id;

        if (fallbackTarget) {
          toSessionEl.value = String(fallbackTarget);
        }
      },
      preConfirm: () => {
        const fromSessionValue = document.getElementById("copySessionFromId")?.value;
        const toSessionValue = document.getElementById("copySessionToId")?.value;
        const classValue = document.getElementById("copySessionClassId")?.value;

        const fromSessionId = fromSessionValue ? Number(fromSessionValue) : null;
        const toSessionId = toSessionValue ? Number(toSessionValue) : null;
        const classId = classValue ? Number(classValue) : null;

        if (fromSessionId === null) {
          Swal.showValidationMessage("Source session is required");
          return false;
        }

        if (toSessionId === null) {
          Swal.showValidationMessage("Target session is required");
          return false;
        }

        if (fromSessionId === toSessionId) {
          Swal.showValidationMessage("Source and target session cannot be same");
          return false;
        }

        return {
          from_session_id: fromSessionId,
          to_session_id: toSessionId,
          class_id: classId,
          overwrite:
            document.getElementById("copySessionOverwriteExisting")?.value === "true",
        };
      },
    });

    if (!res.isConfirmed) return;

    try {
      const { data } = await api.post("/fee-structures/copy-session", res.value);

      const created = Number(data?.created || 0);
      const updated = Number(data?.updated || 0);
      const skipped = Number(data?.skipped || 0);

      await Swal.fire({
        title: "Session Copy Complete",
        icon: "success",
        html: `
          <div style="text-align:left;">
            <div><b>Created:</b> ${created}</div>
            <div><b>Updated:</b> ${updated}</div>
            <div><b>Skipped:</b> ${skipped}</div>
            <div style="margin-top:10px;"><b>Copied To Session:</b> ${data?.source?.to_session_id ?? res.value?.to_session_id}</div>
            <div style="margin-top:6px;"><b>Class Filter:</b> ${res.value?.class_id ? `Class ID ${res.value.class_id}` : "All Classes"}</div>
          </div>
        `,
      });

      setSelectedSessionId(Number(res.value.to_session_id));
      fetchFeeStructures({ sessionId: Number(res.value.to_session_id) });
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        getApiErrorMessage(error, "Failed to copy session fee structure."),
        "error"
      );
    }
  };

  const openCopyMultipleFeeHeadsModal = async (fee) => {
    const feeHeadingsData = feeHeadings.length ? feeHeadings : await fetchFeeHeadings();

    const sourceFeeHeadingId = Number(fee?.FeeHeading?.id ?? fee?.fee_heading_id ?? 0);

    const availableTargets = feeHeadingsData.filter(
      (fh) => Number(fh.id) !== sourceFeeHeadingId
    );

    if (!availableTargets.length) {
      return Swal.fire(
        "No Targets",
        "No other fee heads are available to copy into.",
        "info"
      );
    }

    const feeHeadingOptionsHtml = availableTargets
      .map((fh) => `<option value="${fh.id}">${fh.fee_heading}</option>`)
      .join("");

    const sourceClassName = fee.Class?.class_name || "Unknown";
    const sourceSessionName = fee.Session?.name || "Unknown";
    const sourceFeeHeadingName = fee.FeeHeading?.fee_heading || "Unknown";

    const html = `
      <div style="text-align:left;">
        <div style="margin-bottom:12px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
          <div><b>Source Class:</b> ${sourceClassName}</div>
          <div><b>Source Session:</b> ${sourceSessionName}</div>
          <div><b>Source Fee Head:</b> ${sourceFeeHeadingName}</div>
          <div><b>Admission Type:</b> ${fee.admissionType || "-"}</div>
        </div>

        <label class="fs-lbl" for="targetFeeHeadingIds">Target Fee Heads</label>
        <select
          id="targetFeeHeadingIds"
          class="fs-inp"
          multiple
          size="10"
          style="min-height:220px;"
        >
          ${feeHeadingOptionsHtml}
        </select>

        <div style="font-size:12px;color:#666;margin-top:6px;">
          Hold Ctrl / Cmd to select multiple fee heads.
        </div>

        <div style="margin-top:14px;">
          <label class="fs-lbl" for="overwriteExisting">If target already exists</label>
          <select id="overwriteExisting" class="fs-inp">
            <option value="false">Skip existing target rows</option>
            <option value="true">Overwrite existing target rows</option>
          </select>
        </div>
      </div>
    `;

    const res = await Swal.fire({
      title: "Copy to Multiple Fee Heads",
      html,
      width: "700px",
      showCancelButton: true,
      confirmButtonText: "Copy Now",
      allowOutsideClick: false,
      allowEscapeKey: false,
      focusConfirm: false,
      customClass: {
        popup: "fs-swal-popup",
        title: "fs-swal-title",
        confirmButton: "fs-swal-btn",
        cancelButton: "fs-swal-btn fs-swal-btn-cancel",
      },
      preConfirm: () => {
        const selectedOptions = Array.from(
          document.getElementById("targetFeeHeadingIds")?.selectedOptions || []
        );

        const targetFeeHeadingIds = selectedOptions
          .map((opt) => Number(opt.value))
          .filter((v) => Number.isFinite(v) && v > 0);

        if (!targetFeeHeadingIds.length) {
          Swal.showValidationMessage("Please select at least one target fee head");
          return false;
        }

        return {
          source_fee_structure_id: Number(fee.id),
          target_fee_heading_ids: targetFeeHeadingIds,
          overwrite: document.getElementById("overwriteExisting")?.value === "true",
        };
      },
    });

    if (!res.isConfirmed) return;

    try {
      const { data } = await api.post("/fee-structures/copy-fee-heads", res.value);

      const created = Number(data?.created || 0);
      const updated = Number(data?.updated || 0);
      const skipped = Number(data?.skipped || 0);

      await Swal.fire({
        title: "Copy Complete",
        icon: "success",
        html: `
          <div style="text-align:left;">
            <div><b>Created:</b> ${created}</div>
            <div><b>Updated:</b> ${updated}</div>
            <div><b>Skipped:</b> ${skipped}</div>
          </div>
        `,
      });

      fetchFeeStructures({ sessionId: selectedSessionId });
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        getApiErrorMessage(error, "Failed to copy fee structure to multiple fee heads."),
        "error"
      );
    }
  };

  const handleAdd = () => openAddOrEditModal(null);
  const handleEdit = (fee) => openAddOrEditModal(fee);
  const handleCopyFeeHeads = (fee) => openCopyMultipleFeeHeadsModal(fee);
  const handleCopyClassStructure = () => openCopyClassStructureModal();
  const handleCopySessionStructure = () => openCopySessionStructureModal();

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
        [
          fee.Session?.name,
          fee.Class?.class_name,
          fee.FeeHeading?.fee_heading,
          String(fee.feeDue ?? ""),
        ]
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
      if (fineAmountPerSlab !== "") {
        payload.fineAmountPerSlab = Number(fineAmountPerSlab);
      }
      if (fineSlabDuration !== "") {
        payload.fineSlabDuration = Number(fineSlabDuration);
      }
      payload.finePercentage = null;
    }

    if (fineStartDate !== "") payload.fineStartDate = safeDateOrNull(fineStartDate);
    if (admissionType !== "") payload.admissionType = admissionType;

    if (concessionApplicable !== "") {
      payload.concessionApplicable = concessionApplicable === "true";
    }

    if (transportApplicable !== "") {
      payload.transportApplicable = transportApplicable === "true";
    }

    return payload;
  };

  const handleBulkApply = async () => {
    if (!canEdit) {
      return Swal.fire(
        "Forbidden",
        "Only Admin/Super Admin can perform bulk update.",
        "warning"
      );
    }

    if (filteredFeeStructures.length === 0) {
      return Swal.fire(
        "No Records",
        "There are no filtered fee structures to update.",
        "info"
      );
    }

    const payload = buildBulkPayload();

    if (Object.keys(payload).length === 0) {
      return Swal.fire(
        "Nothing to Update",
        "Please enter at least one field to apply.",
        "info"
      );
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
        filteredFeeStructures.map((fee) =>
          api.put(`/fee-structures/${fee.id}`, payload)
        )
      );

      const success = results.filter((r) => r.status === "fulfilled").length;
      const failedResults = results.filter((r) => r.status === "rejected");
      const failed = failedResults.length;

      let message = `Updated: ${success}\nFailed: ${failed}`;

      if (failedResults.length > 0) {
        const firstError = getApiErrorMessage(
          failedResults[0]?.reason,
          "Some records failed."
        );
        message += `\n\nFirst Error: ${firstError}`;
      }

      Swal.fire(
        "Bulk Update Complete",
        message,
        failed ? "warning" : "success"
      );

      fetchFeeStructures({ sessionId: selectedSessionId });
    } catch (e) {
      console.error(e);
      Swal.fire(
        "Error",
        getApiErrorMessage(e, "Bulk update failed due to an unexpected error."),
        "error"
      );
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

  useEffect(() => {
    fetchFeeStructures({ sessionId: selectedSessionId });
  }, [selectedSessionId, fetchFeeStructures]);

  useEffect(() => {
    const polling = setInterval(
      () => fetchFeeStructures({ sessionId: selectedSessionId }),
      5000
    );
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
                <button
                  className="btn btn-outline-dark btn-sm"
                  onClick={handleCopyClassStructure}
                >
                  Copy Class Structure
                </button>
              )}

              {canEdit && (
                <button
                  className="btn btn-outline-info btn-sm"
                  onClick={handleCopySessionStructure}
                >
                  Copy Session Structure
                </button>
              )}

              {canEdit && (
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setShowBulk((s) => !s)}
                >
                  {showBulk ? "Hide Bulk" : "Bulk Fill"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
                  onChange={(e) =>
                    setBulkValues((s) => ({ ...s, feeDue: e.target.value }))
                  }
                  placeholder="e.g. 1500"
                />
              </div>

              <div>
                <label className="form-label fs-lbl2">Fine Type</label>
                <select
                  className="form-select fs-inp2"
                  value={bulkValues.fineType}
                  onChange={(e) =>
                    setBulkValues((s) => ({ ...s, fineType: e.target.value }))
                  }
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
                    onChange={(e) =>
                      setBulkValues((s) => ({ ...s, finePercentage: e.target.value }))
                    }
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
                      onChange={(e) =>
                        setBulkValues((s) => ({
                          ...s,
                          fineAmountPerSlab: e.target.value,
                        }))
                      }
                      placeholder="₹"
                    />
                  </div>
                  <div>
                    <label className="form-label fs-lbl2">Slab Days</label>
                    <input
                      type="number"
                      className="form-control fs-inp2"
                      value={bulkValues.fineSlabDuration}
                      onChange={(e) =>
                        setBulkValues((s) => ({
                          ...s,
                          fineSlabDuration: e.target.value,
                        }))
                      }
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
                  onChange={(e) =>
                    setBulkValues((s) => ({ ...s, fineStartDate: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="form-label fs-lbl2">Admission</label>
                <select
                  className="form-select fs-inp2"
                  value={bulkValues.admissionType}
                  onChange={(e) =>
                    setBulkValues((s) => ({ ...s, admissionType: e.target.value }))
                  }
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
                  onChange={(e) =>
                    setBulkValues((s) => ({
                      ...s,
                      concessionApplicable: e.target.value,
                    }))
                  }
                >
                  <option value="">(No change)</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="form-label fs-lbl2">Transport</label>
                <select
                  className="form-select fs-inp2"
                  value={bulkValues.transportApplicable}
                  onChange={(e) =>
                    setBulkValues((s) => ({
                      ...s,
                      transportApplicable: e.target.value,
                    }))
                  }
                >
                  <option value="">(No change)</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>

            <div className="fs-hint mt-2">
              Tip: keep Bulk collapsed when not needed (biggest height saver).
            </div>
          </div>
        </div>
      )}

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

              {canEdit && <th style={{ width: 230 }}>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {filteredFeeStructures.length > 0 ? (
              filteredFeeStructures.map((fee, index) => {
                const flags = [
                  fee.concessionApplicable === true ||
                  fee.concessionApplicable === "Yes" ||
                  fee.concessionApplicable === 1
                    ? "Concession"
                    : null,
                  fee.transportApplicable === true ||
                  fee.transportApplicable === "Yes" ||
                  fee.transportApplicable === 1
                    ? "Transport"
                    : null,
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
                            : `₹${fee.fineAmountPerSlab ?? 0} / ${
                                fee.fineSlabDuration ?? 0
                              } days`}
                        </td>
                      </>
                    )}

                    {canEdit && (
                      <td className="text-nowrap">
                        <button
                          className="btn btn-primary btn-sm me-1"
                          onClick={() => handleEdit(fee)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn btn-outline-secondary btn-sm me-1"
                          onClick={() => handleCopyFeeHeads(fee)}
                          title="Copy this row to multiple fee heads"
                        >
                          Copy Head
                        </button>

                        {isSuperadmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(fee)}
                          >
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