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
    isAccounts: roles.includes("accounts"),
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

const StudentFeeStructure = () => {
  const { isAdmin, isSuperadmin, isAccounts } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin || isAccounts;

  const [studentFeeStructures, setStudentFeeStructures] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedFeeHeadings, setSelectedFeeHeadings] = useState([]);

  const [searchText, setSearchText] = useState("");

  const [compactMode, setCompactMode] = useState(true);
  const [showAdvancedCols, setShowAdvancedCols] = useState(false);

  // ---------------------------- Fetchers ----------------------------
  const fetchStudentFeeStructures = useCallback(
    async ({ sessionId = selectedSessionId } = {}) => {
      try {
        const params = {};
        if (sessionId) params.session_id = sessionId;

        const query = new URLSearchParams(params).toString();
        const url = query
          ? `/student-fee-structures?${query}`
          : "/student-fee-structures";

        const { data } = await api.get(url);
        setStudentFeeStructures(data.fees || []);
      } catch (err) {
        console.error("fetchStudentFeeStructures error", err);
        Swal.fire("Error", "Failed to fetch student fee structures.", "error");
      }
    },
    [selectedSessionId]
  );

  const fetchStudents = async () => {
    try {
      const { data } = await api.get("/students");
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.students)
        ? data.students
        : Array.isArray(data?.data)
        ? data.data
        : [];
      setStudents(rows);
      return rows;
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch students.", "error");
      return [];
    }
  };

  const fetchClasses = async () => {
    try {
      const { data } = await api.get("/classes");
      setClasses(data || []);
      return data || [];
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch classes.", "error");
      return [];
    }
  };

  const fetchFeeHeadings = async () => {
    try {
      const { data } = await api.get("/fee-headings");
      setFeeHeadings(data || []);
      return data || [];
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

      return data || [];
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
      title: "Delete student fee structure?",
      text: `${fee.Student?.name || "Unknown Student"} • ${fee.FeeHeading?.fee_heading || "Unknown Category"}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/student-fee-structures/${fee.id}`);
      Swal.fire("Deleted!", "Student fee structure deleted.", "success");
      fetchStudentFeeStructures({ sessionId: selectedSessionId });
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to delete the student fee structure.", "error");
    }
  };

  const openAddOrEditModal = async (existing = null) => {
    const studentsData = students.length ? students : await fetchStudents();
    const classesData = classes.length ? classes : await fetchClasses();
    const feeHeadingsData = feeHeadings.length ? feeHeadings : await fetchFeeHeadings();
    const sessionData = sessions.length ? sessions : await fetchSessions();

    const getStudentsByClass = (classId) => {
      if (!classId) return [];

      return studentsData.filter((s) => {
        const sid =
          s.class_id ??
          s.ClassId ??
          s.classId ??
          s.classID ??
          s.Class?.id ??
          s.class?.id;

        return String(sid) === String(classId);
      });
    };

    const buildStudentOptionsHtml = (classId, selectedStudentId = "") => {
      const filteredStudents = getStudentsByClass(classId);

      if (!filteredStudents.length) {
        return `<option value="">No students found for selected class</option>`;
      }

      return [
        `<option value="">Select Student</option>`,
        ...filteredStudents.map(
          (s) =>
            `<option value="${s.id}" ${
              String(s.id) === String(selectedStudentId) ? "selected" : ""
            }>${s.name || "Unnamed"}${
              s.admission_number ? ` (${s.admission_number})` : ""
            }</option>`
        ),
      ].join("");
    };

    const classOptionsHtml = [
      `<option value="">Select Class</option>`,
      ...classesData.map((cls) => `<option value="${cls.id}">${cls.class_name}</option>`),
    ].join("");

    const feeHeadingOptionsHtml = feeHeadingsData
      .map((fh) => `<option value="${fh.id}">${fh.fee_heading}</option>`)
      .join("");

    const sessionOptionsHtml = (sessionData || [])
      .map(
        (s) =>
          `<option value="${s.id}">${s.name}${s.is_active ? " (Active)" : ""}</option>`
      )
      .join("");

    const isCopy = Boolean(existing?.__isCopy);
    const isEdit = Boolean(existing) && !isCopy;

    const existingClassId = existing?.Class?.id ?? existing?.class_id ?? "";
    const existingStudentId = existing?.Student?.id ?? existing?.student_id ?? "";

    const dueDateFormatted =
      existing && existing.fineStartDate
        ? new Date(existing.fineStartDate).toISOString().split("T")[0]
        : "";

    const originalFineType = existing?.fineType || "percentage";

    const swalBaseOpts = {
      width: "760px",
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
      <div class="row g-2 text-start mt-1">
        <div class="col-md-6">
          <label class="form-label small mb-1">Class</label>
          <select id="classId" class="form-select form-select-sm">
            ${classOptionsHtml}
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Student</label>
          <select id="studentId" class="form-select form-select-sm">
            ${
              existingClassId
                ? buildStudentOptionsHtml(existingClassId, existingStudentId)
                : `<option value="">Select class first</option>`
            }
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Session</label>
          <select id="sessionId" class="form-select form-select-sm">${sessionOptionsHtml}</select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Category</label>
          <select id="feeHeadingId" class="form-select form-select-sm">${feeHeadingOptionsHtml}</select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Fee Due</label>
          <input
            type="number"
            id="feeDue"
            class="form-control form-control-sm"
            placeholder="e.g. 1500"
            value="${existing?.feeDue ?? ""}"
          >
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Admission</label>
          <select id="admissionType" class="form-select form-select-sm">
            <option value="New">New</option>
            <option value="Old">Old</option>
            <option value="All">All</option>
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Fine Type</label>
          <select id="fineType" class="form-select form-select-sm">
            <option value="percentage">Percentage</option>
            <option value="slab">Slab</option>
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Source Type</label>
          <select id="sourceType" class="form-select form-select-sm">
            <option value="custom">Custom</option>
            <option value="override">Override</option>
          </select>
        </div>

        <div id="finePctWrap" class="col-12" style="display:${
          originalFineType === "percentage" ? "block" : "none"
        };">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label small mb-1">Fine %</label>
              <input
                type="number"
                id="finePercentage"
                class="form-control form-control-sm"
                placeholder="%"
                value="${existing?.finePercentage ?? ""}"
              >
            </div>
          </div>
        </div>

        <div id="fineSlabWrap" class="col-12" style="display:${
          originalFineType === "slab" ? "block" : "none"
        };">
          <div class="row g-2">
            <div class="col-md-6">
              <label class="form-label small mb-1">Amt/Slab</label>
              <input
                type="number"
                id="fineAmountPerSlab"
                class="form-control form-control-sm"
                placeholder="₹"
                value="${existing?.fineAmountPerSlab ?? ""}"
              >
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1">Slab Days</label>
              <input
                type="number"
                id="fineSlabDuration"
                class="form-control form-control-sm"
                placeholder="days"
                value="${existing?.fineSlabDuration ?? ""}"
              >
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Due Date</label>
          <input
            type="date"
            id="fineStartDate"
            class="form-control form-control-sm"
            value="${dueDateFormatted}"
          >
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Concession</label>
          <select id="concessionApplicable" class="form-select form-select-sm">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Transport</label>
          <select id="transportApplicable" class="form-select form-select-sm">
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </div>

        <div class="col-md-6">
          <label class="form-label small mb-1">Active</label>
          <select id="isActive" class="form-select form-select-sm">
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div class="col-12">
          <label class="form-label small mb-1">Remarks</label>
          <input
            type="text"
            id="remarks"
            class="form-control form-control-sm"
            placeholder="Optional remarks"
            value="${existing?.remarks ?? ""}"
          >
        </div>
      </div>
    `;

    const modalTitle = isEdit
      ? "Edit Student Fee"
      : isCopy
      ? "Copy Student Fee"
      : "Add Student Fee";

    return Swal.fire({
      ...swalBaseOpts,
      title: modalTitle,
      html,
      didOpen: () => {
        const classEl = document.getElementById("classId");
        const studentEl = document.getElementById("studentId");

        if (existing) {
          classEl.value = existingClassId ?? "";
          document.getElementById("sessionId").value =
            existing.Session?.id ?? selectedSessionId ?? "";
          document.getElementById("feeHeadingId").value = existing.FeeHeading?.id ?? "";
          document.getElementById("admissionType").value = existing.admissionType ?? "All";
          document.getElementById("concessionApplicable").value =
            existing.concessionApplicable ?? "No";
          document.getElementById("transportApplicable").value =
            existing.transportApplicable ?? "No";
          document.getElementById("fineType").value = existing.fineType ?? "percentage";
          document.getElementById("sourceType").value = existing.sourceType ?? "custom";
          document.getElementById("isActive").value = String(existing?.isActive ?? true);
        } else {
          if (selectedSessionId) {
            document.getElementById("sessionId").value = selectedSessionId;
          }
          document.getElementById("admissionType").value = "All";
          document.getElementById("concessionApplicable").value = "No";
          document.getElementById("transportApplicable").value = "No";
          document.getElementById("fineType").value = "percentage";
          document.getElementById("sourceType").value = "custom";
          document.getElementById("isActive").value = "true";
        }

        const refreshStudentsDropdown = (selectedStudentId = "") => {
          const clsId = classEl.value;
          studentEl.innerHTML = clsId
            ? buildStudentOptionsHtml(clsId, selectedStudentId)
            : `<option value="">Select class first</option>`;
        };

        classEl.addEventListener("change", () => {
          refreshStudentsDropdown("");
        });

        if (existingClassId) {
          refreshStudentsDropdown(existingStudentId);
        }

        const fineTypeSelect = document.getElementById("fineType");
        const pctWrap = document.getElementById("finePctWrap");
        const slabWrap = document.getElementById("fineSlabWrap");

        const applyFineMode = () => {
          const isPct = fineTypeSelect.value === "percentage";
          pctWrap.style.display = isPct ? "block" : "none";
          slabWrap.style.display = isPct ? "none" : "block";

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
        const student_id = document.getElementById("studentId").value;
        const session_id = document.getElementById("sessionId").value;
        const class_id = document.getElementById("classId").value;
        const fee_heading_id = document.getElementById("feeHeadingId").value;
        const feeDue = document.getElementById("feeDue").value;
        const admissionType = document.getElementById("admissionType").value;
        const fineType = document.getElementById("fineType").value;

        if (!class_id) {
          Swal.showValidationMessage("Class is required");
          return false;
        }
        if (!student_id) {
          Swal.showValidationMessage("Student is required");
          return false;
        }
        if (!session_id) {
          Swal.showValidationMessage("Session is required");
          return false;
        }
        if (!fee_heading_id) {
          Swal.showValidationMessage("Category is required");
          return false;
        }
        if (!feeDue) {
          Swal.showValidationMessage("Fee Due is required");
          return false;
        }
        if (!admissionType) {
          Swal.showValidationMessage("Admission Type is required");
          return false;
        }

        return {
          student_id,
          session_id,
          class_id,
          fee_heading_id,
          feeDue,
          admissionType,
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
          fineStartDate: safeDateOrNull(document.getElementById("fineStartDate").value),
          concessionApplicable: document.getElementById("concessionApplicable").value,
          transportApplicable: document.getElementById("transportApplicable").value,
          sourceType: document.getElementById("sourceType").value,
          isActive: document.getElementById("isActive").value === "true",
          remarks: document.getElementById("remarks").value.trim() || null,
        };
      },
    }).then(async (res) => {
      if (!res.isConfirmed) return;

      try {
        if (isEdit) {
          await api.put(`/student-fee-structures/${existing.id}`, res.value);
          Swal.fire("Updated!", "Student fee structure updated.", "success");
        } else {
          await api.post(`/student-fee-structures`, res.value);
          Swal.fire(
            isCopy ? "Copied!" : "Added!",
            isCopy ? "Student fee structure copied." : "Student fee structure added.",
            "success"
          );
        }

        setSelectedSessionId(Number(res.value.session_id));
        fetchStudentFeeStructures({ sessionId: Number(res.value.session_id) });
      } catch (e) {
        console.error(e);
        Swal.fire(
          "Error",
          `Failed to ${isEdit ? "update" : "add"} the student fee structure.`,
          "error"
        );
      }
    });
  };

  const handleAdd = () => openAddOrEditModal(null);
  const handleEdit = (fee) => openAddOrEditModal(fee);
  const handleCopy = (fee) => {
    openAddOrEditModal({ ...fee, __isCopy: true, id: null });
  };

  // ---------------------- Options & Filters ----------------------
  const classOptions = useMemo(
    () => classes.map((c) => ({ label: c.class_name, value: String(c.id) })),
    [classes]
  );

  const studentOptions = useMemo(
    () =>
      students.map((s) => ({
        label: `${s.name || "Unnamed"}${s.admission_number ? ` (${s.admission_number})` : ""}`,
        value: String(s.id),
      })),
    [students]
  );

  const headingOptions = useMemo(
    () => feeHeadings.map((fh) => ({ label: fh.fee_heading, value: String(fh.id) })),
    [feeHeadings]
  );

  const filteredStudentFeeStructures = useMemo(() => {
    const classSet = new Set(selectedClasses.map((s) => s.value));
    const studentSet = new Set(selectedStudents.map((s) => s.value));
    const headSet = new Set(selectedFeeHeadings.map((s) => s.value));
    const text = searchText.trim().toLowerCase();

    return studentFeeStructures.filter((fee) => {
      const classId = String(fee.Class?.id ?? "");
      const studentId = String(fee.Student?.id ?? "");
      const headId = String(fee.FeeHeading?.id ?? "");

      const classMatch = classSet.size ? classSet.has(classId) : true;
      const studentMatch = studentSet.size ? studentSet.has(studentId) : true;
      const headMatch = headSet.size ? headSet.has(headId) : true;

      const textMatch =
        !text ||
        [
          fee.Session?.name,
          fee.Class?.class_name,
          fee.Student?.name,
          fee.Student?.admission_number,
          fee.FeeHeading?.fee_heading,
          String(fee.feeDue ?? ""),
          fee.remarks,
          fee.sourceType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(text);

      return classMatch && studentMatch && headMatch && textMatch;
    });
  }, [studentFeeStructures, selectedClasses, selectedStudents, selectedFeeHeadings, searchText]);

  // ---------------------------- Mount ----------------------------
  useEffect(() => {
    (async () => {
      await Promise.all([
        fetchSessions(),
        fetchClasses(),
        fetchFeeHeadings(),
        fetchStudents(),
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchStudentFeeStructures({ sessionId: selectedSessionId });
  }, [selectedSessionId, fetchStudentFeeStructures]);

  useEffect(() => {
    const polling = setInterval(
      () => fetchStudentFeeStructures({ sessionId: selectedSessionId }),
      5000
    );
    return () => clearInterval(polling);
  }, [selectedSessionId, fetchStudentFeeStructures]);

  // ---------------------------- Render ---------------------------
  return (
    <div className={`container mt-3 fee-structure-page ${compactMode ? "fs-compact" : ""}`}>
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-2 mb-2">
        <div>
          <h1 className="h5 mb-0">Student Fee Structure</h1>
          <div className="text-muted small">
            Student-specific fee heads • separate from class fee structure
          </div>
        </div>

        <div className="d-flex flex-wrap gap-3 align-items-center">
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
      <div className="card shadow-sm mb-2 position-relative" style={{ zIndex: 20 }}>
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <label className="form-label small mb-1">Session</label>
              <select
                className="form-select form-select-sm"
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

            <div className="col-md-5">
              <label className="form-label small mb-1">Quick Search</label>
              <input
                className="form-control form-control-sm"
                placeholder="student / admission no / class / category / remarks"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <div className="d-flex flex-wrap gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => fetchStudentFeeStructures({ sessionId: selectedSessionId })}
                >
                  Refresh
                </button>

                {canEdit && (
                  <button className="btn btn-success btn-sm" onClick={handleAdd}>
                    + Add
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-2 position-relative" style={{ zIndex: 30 }}>
        <div className="card-body py-2">
          <div className="row g-2">
            <div className="col-md-6 position-relative" style={{ zIndex: 50 }}>
              <label className="form-label small mb-1">Class</label>
              <div className="position-relative">
                <MultiSelect
                  options={classOptions}
                  value={selectedClasses}
                  onChange={setSelectedClasses}
                  labelledBy="Select Classes"
                  hasSelectAll={true}
                  disableSearch={false}
                  ClearSelectedIcon={null}
                />
              </div>
              <div className="form-text mt-1">None selected = all classes</div>
            </div>

            <div className="col-md-6 position-relative" style={{ zIndex: 50 }}>
              <label className="form-label small mb-1">Student</label>
              <div className="position-relative">
                <MultiSelect
                  options={studentOptions}
                  value={selectedStudents}
                  onChange={setSelectedStudents}
                  labelledBy="Select Students"
                  hasSelectAll={true}
                  disableSearch={false}
                  ClearSelectedIcon={null}
                />
              </div>
              <div className="form-text mt-1">None selected = all students</div>
            </div>

            <div className="col-12 position-relative" style={{ zIndex: 40 }}>
              <label className="form-label small mb-1">Category</label>
              <div className="position-relative">
                <MultiSelect
                  options={headingOptions}
                  value={selectedFeeHeadings}
                  onChange={setSelectedFeeHeadings}
                  labelledBy="Select Categories"
                  hasSelectAll={true}
                  disableSearch={false}
                  ClearSelectedIcon={null}
                />
              </div>
              <div className="form-text mt-1">None selected = all categories</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="table-responsive rounded bg-white position-relative"
        style={{ zIndex: 1, overflowY: "visible" }}
      >
        <table className={`table table-striped table-hover mb-0 ${compactMode ? "table-sm" : ""}`}>
          <thead className="bg-white">
            <tr>
              <th style={{ width: 42 }}>#</th>
              <th>Session</th>
              <th>Student</th>
              <th>Adm. No.</th>
              <th>Class</th>
              <th>Category</th>
              <th style={{ width: 90 }}>Fee</th>
              <th style={{ width: 90 }}>Fine</th>
              <th style={{ width: 110 }}>Due Date</th>
              <th style={{ width: 90 }}>Source</th>
              <th style={{ width: 80 }}>Active</th>

              {showAdvancedCols && (
                <>
                  <th style={{ width: 90 }}>Admission</th>
                  <th style={{ width: 110 }}>Flags</th>
                  <th>Remarks</th>
                  <th style={{ width: 90 }}>Fine Type</th>
                </>
              )}

              {canEdit && <th style={{ width: 190 }}>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {filteredStudentFeeStructures.length > 0 ? (
              filteredStudentFeeStructures.map((fee, index) => {
                const flags = [
                  fee.concessionApplicable === "Yes" ? "Concession" : null,
                  fee.transportApplicable === "Yes" ? "Transport" : null,
                ].filter(Boolean);

                return (
                  <tr key={fee.id}>
                    <td>{index + 1}</td>
                    <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                      {fee.Session?.name || "-"}
                    </td>
                    <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                      {fee.Student?.name || "Unknown"}
                    </td>
                    <td className="text-nowrap">{fee.Student?.admission_number || "-"}</td>
                    <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                      {fee.Class?.class_name || "Unknown"}
                    </td>
                    <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                      {fee.FeeHeading?.fee_heading || "Unknown"}
                    </td>
                    <td className="text-nowrap">{fee.feeDue ?? "-"}</td>
                    <td className="text-nowrap">{formatFineCell(fee)}</td>
                    <td className="text-nowrap">{fee.fineStartDate || "-"}</td>
                    <td className="text-nowrap">{fee.sourceType || "-"}</td>
                    <td className="text-nowrap">{fee.isActive ? "Yes" : "No"}</td>

                    {showAdvancedCols && (
                      <>
                        <td className="text-nowrap">{fee.admissionType || "-"}</td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                          {flags.length ? flags.join(", ") : <span className="text-muted">None</span>}
                        </td>
                        <td style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                          {fee.remarks || "-"}
                        </td>
                        <td className="text-nowrap">{fee.fineType || "-"}</td>
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
                          onClick={() => handleCopy(fee)}
                        >
                          Copy
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
                  colSpan={canEdit ? (showAdvancedCols ? 16 : 12) : showAdvancedCols ? 15 : 11}
                  className="text-center"
                >
                  No Student Fee Structures Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentFeeStructure;