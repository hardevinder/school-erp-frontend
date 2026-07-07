// src/pages/AttendanceEntry.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button } from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";

const TERMS = [
  { id: 1, label: "Term-1" },
  { id: 2, label: "Term-2" },
];

const AttendanceEntry = () => {
  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
  });

  // ✅ NEW: allowed mappings (for incharge filtering)
  const [allowed, setAllowed] = useState({
    isAdmin: false,
    classes: [],
    sections: [],
    incharges: [],
  });

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const [students, setStudents] = useState([]);

  // data[`${studentId}_${termId}`] = { total_days, present_days, max_attendance }
  const [data, setData] = useState({});

  const [loading, setLoading] = useState(false);

  // modal state
  const [showModal, setShowModal] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState(null);

  // modal inputs (local)
  const [modalValues, setModalValues] = useState({
    1: { total_days: "", present_days: "", max_attendance: "" },
    2: { total_days: "", present_days: "", max_attendance: "" },
  });

  // ✅ NEW: term selector for export/import
  const [fileTermId, setFileTermId] = useState(1);

  // import ref
  const fileRef = useRef(null);

  const resetAll = () => {
    setStudents([]);
    setData({});
    setActiveStudentId(null);
    setShowModal(false);
    setModalValues({
      1: { total_days: "", present_days: "", max_attendance: "" },
      2: { total_days: "", present_days: "", max_attendance: "" },
    });
  };

  useEffect(() => {
    loadAllowed(); // ✅ IMPORTANT: only incharge classes/sections
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { class_id, section_id } = filters;
    if (class_id && section_id) fetchAttendanceBothTerms();
    else resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.class_id, filters.section_id]);

  // -----------------------------
  // ✅ Load Allowed Classes/Sections
  // Route: GET /attendance-entry/allowed
  // -----------------------------
  const loadAllowed = async () => {
    try {
      const res = await api.get("/attendance-entry/allowed");
      const payload = res.data || {};
      const nextAllowed = {
        isAdmin: !!payload.isAdmin,
        classes: payload.classes || [],
        sections: payload.sections || [],
        incharges: payload.incharges || [],
      };
      setAllowed(nextAllowed);

      // ✅ If backend already filtered, use it directly
      setClasses(nextAllowed.classes || []);
      setSections(nextAllowed.sections || []);
    } catch (err) {
      // fallback (if route not mounted yet / old server)
      console.warn("attendance-entry/allowed failed, fallback to /classes & /sections", err);
      try {
        const [c, s] = await Promise.all([api.get("/classes"), api.get("/sections")]);
        setAllowed({ isAdmin: true, classes: c.data || [], sections: s.data || [], incharges: [] });
        setClasses(c.data || []);
        setSections(s.data || []);
      } catch {
        Swal.fire("Error", "Failed to load class/section data", "error");
      }
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;

    // if class changes, clear section
    if (name === "class_id") {
      setFilters({ class_id: value, section_id: "" });
      resetAll();
      return;
    }

    setFilters((prev) => ({ ...prev, [name]: value }));
    resetAll();
  };

  const keyOf = (studentId, termId) => `${studentId}_${termId}`;

  // -----------------------------
  // ✅ Fetch attendance for BOTH terms (because UI shows Term-1 + Term-2 together)
  // Backend GET requires term_id
  // Query: ?class_id=&section_id=&term_id=
  // -----------------------------
  const fetchAttendanceBothTerms = async () => {
    const { class_id, section_id } = filters;
    if (!class_id || !section_id) return;

    setLoading(true);
    try {
      const [t1, t2] = await Promise.all([
        api.get("/attendance-entry", { params: { class_id, section_id, term_id: 1 } }),
        api.get("/attendance-entry", { params: { class_id, section_id, term_id: 2 } }),
      ]);

      // Prefer students list from term-1; fallback to term-2
      const list = t1?.data?.students?.length ? t1.data.students : t2?.data?.students || [];
      setStudents(list);

      const next = {};

      const absorbMap = (termId, resData) => {
        const map = resData?.dataMap || resData?.attendanceMap || {};
        // ✅ map keys expected: student_id -> values OR `${studentId}_${termId}` -> values (support both)
        Object.entries(map).forEach(([k, v]) => {
          let sid = null;

          // if key looks like "123_1"
          if (String(k).includes("_")) {
            const [a, b] = String(k).split("_");
            sid = Number(a);
            // ignore if key belongs to other term
            if (Number(b) !== Number(termId)) return;
          } else {
            // key is student id
            sid = Number(k);
          }

          if (!sid) return;

          next[keyOf(sid, termId)] = {
            total_days:
              v?.total_days ?? v?.totalDays ?? v?.total ?? v?.total_days_term ?? "",
            present_days:
              v?.present_days ?? v?.presentDays ?? v?.present ?? v?.present_days_term ?? "",
            max_attendance:
              v?.max_attendance ?? v?.maxAttendance ?? v?.max ?? v?.max_attendance_term ?? "",
          };
        });
      };

      absorbMap(1, t1?.data);
      absorbMap(2, t2?.data);

      setData(next);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load attendance entry data", "error");
    } finally {
      setLoading(false);
    }
  };

  const openStudentModal = (studentId) => {
    setActiveStudentId(studentId);

    const v1 = data[keyOf(studentId, 1)] || {};
    const v2 = data[keyOf(studentId, 2)] || {};

    setModalValues({
      1: {
        total_days: v1.total_days ?? "",
        present_days: v1.present_days ?? "",
        max_attendance: v1.max_attendance ?? "",
      },
      2: {
        total_days: v2.total_days ?? "",
        present_days: v2.present_days ?? "",
        max_attendance: v2.max_attendance ?? "",
      },
    });

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setActiveStudentId(null);
  };

  const setModalField = (termId, field, value) => {
    setModalValues((prev) => ({
      ...prev,
      [termId]: { ...prev[termId], [field]: value },
    }));
  };

  const toNumOrEmpty = (v) => {
    if (v === "" || v == null) return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
  };

  const validateTerm = (termId) => {
    const t = modalValues[termId] || {};
    const total = toNumOrEmpty(t.total_days);
    const present = toNumOrEmpty(t.present_days);
    const max = toNumOrEmpty(t.max_attendance);

    if (total === "" && present === "" && max === "") return { ok: true };

    if (total === "" || total < 0)
      return { ok: false, msg: `Enter valid Total Days for Term-${termId}` };

    if (present !== "" && (present < 0 || present > total))
      return {
        ok: false,
        msg: `Present Days must be between 0 and Total Days for Term-${termId}`,
      };

    if (max !== "" && (max < 0 || max > total))
      return {
        ok: false,
        msg: `Max Attendance must be between 0 and Total Days for Term-${termId}`,
      };

    return { ok: true };
  };

  // -----------------------------
  // ✅ Save BOTH terms (2 API calls)
  // POST /attendance-entry/save
  // Body: { class_id, section_id, term_id, rows:[...] }
  // -----------------------------
  const saveModal = async () => {
    if (!activeStudentId) return;
    const { class_id, section_id } = filters;
    if (!class_id || !section_id) return;

    const v1 = validateTerm(1);
    if (!v1.ok) return Swal.fire("Invalid", v1.msg, "warning");

    const v2 = validateTerm(2);
    if (!v2.ok) return Swal.fire("Invalid", v2.msg, "warning");

    // optimistic local update
    const next = { ...data };
    TERMS.forEach((t) => {
      const termId = t.id;
      const row = modalValues[termId] || {};

      const total = row.total_days === "" ? "" : Number(row.total_days);
      const present = row.present_days === "" ? "" : Number(row.present_days);
      const max = row.max_attendance === "" ? "" : Number(row.max_attendance);

      next[keyOf(activeStudentId, termId)] = {
        total_days: total,
        present_days: present,
        max_attendance: max,
      };
    });
    setData(next);

    try {
      const reqs = TERMS.map((t) => {
        const termId = t.id;
        const row = modalValues[termId] || {};

        return api.post("/attendance-entry/save", {
          class_id: Number(class_id),
          section_id: Number(section_id),
          term_id: termId,
          rows: [
            {
              student_id: activeStudentId,
              total_days: row.total_days === "" ? null : Number(row.total_days),
              present_days: row.present_days === "" ? null : Number(row.present_days),
              max_attendance: row.max_attendance === "" ? null : Number(row.max_attendance),
            },
          ],
        });
      });

      await Promise.all(reqs);

      Swal.fire("Saved", "Attendance saved successfully", "success");
      closeModal();
      fetchAttendanceBothTerms();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to save attendance", "error");
    }
  };

  // -----------------------------
  // ✅ Export Excel (single term)
  // GET /attendance-entry/export-excel?class_id=&section_id=&term_id=
  // -----------------------------
  const handleExportExcel = async () => {
    const { class_id, section_id } = filters;
    if (!class_id || !section_id) return;

    try {
      const response = await api.get("/attendance-entry/export-excel", {
        params: { class_id, section_id, term_id: fileTermId },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `attendance-entry-term-${fileTermId}-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1500);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to export Excel", "error");
    }
  };

  // -----------------------------
  // ✅ Import Excel (single term)
  // POST /attendance-entry/import-excel
  // FormData: file + class_id + section_id + term_id
  // -----------------------------
  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { class_id, section_id } = filters;
    if (!class_id || !section_id) {
      e.target.value = null;
      return Swal.fire("Missing", "Select Class & Section first", "warning");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", class_id);
    formData.append("section_id", section_id);
    formData.append("term_id", String(fileTermId));

    try {
      const res = await api.post("/attendance-entry/import-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Swal.fire(
        "Success",
        `Attendance imported successfully${
          res.data?.rowsProcessed ? ` (rows processed: ${res.data.rowsProcessed})` : ""
        }`,
        "success"
      );
      fetchAttendanceBothTerms();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to import attendance", "error");
    } finally {
      e.target.value = null;
      if (fileRef.current) fileRef.current.value = null;
    }
  };

  // ✅ Filter sections for non-admin based on incharge mappings (UX improvement)
  const filteredSections = useMemo(() => {
    if (!filters.class_id) return sections;

    // if admin, keep all
    if (allowed.isAdmin) return sections;

    const classId = Number(filters.class_id);
    const allowedSectionIds = new Set(
      (allowed.incharges || [])
        .filter((x) => Number(x.classId) === classId)
        .map((x) => Number(x.sectionId))
    );

    // if backend already returned filtered sections only, this still works
    const list = sections.filter((s) => allowedSectionIds.has(Number(s.id)));
    return list.length ? list : sections;
  }, [sections, allowed, filters.class_id]);

  const selectedClass =
    classes.find((c) => Number(c.id) === Number(filters.class_id)) || null;
  const selectedSection =
    sections.find((s) => Number(s.id) === Number(filters.section_id)) || null;

  const stats = useMemo(() => {
    if (!students.length) return null;

    const calcPct = (studentId, termId) => {
      const row = data[keyOf(studentId, termId)] || {};
      const total = Number(row.total_days || 0);
      const present = Number(row.present_days || 0);
      if (!total) return null;
      return (present / total) * 100;
    };

    const termStats = TERMS.map((t) => {
      let sum = 0;
      let cnt = 0;

      students.forEach((s) => {
        const pct = calcPct(s.id, t.id);
        if (pct != null) {
          sum += pct;
          cnt += 1;
        }
      });

      return { termId: t.id, label: t.label, avg: cnt ? sum / cnt : 0, count: cnt };
    });

    return termStats;
  }, [students, data]);

  return (
    <div className="container mt-4">
      <h2>🧾 Attendance Entry</h2>

      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter</h5>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label>Class</label>
              <select
                className="form-control"
                name="class_id"
                value={filters.class_id}
                onChange={handleFilterChange}
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
              {!allowed.isAdmin && (
                <div className="text-muted small mt-1">
                  * Only your assigned classes are shown.
                </div>
              )}
            </div>

            <div className="col-md-4 mb-3">
              <label>Section</label>
              <select
                className="form-control"
                name="section_id"
                value={filters.section_id}
                onChange={handleFilterChange}
                disabled={!filters.class_id}
              >
                <option value="">Select Section</option>
                {filteredSections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.section_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4 mb-3 d-flex align-items-end justify-content-end">
              <div className="d-flex gap-2 flex-wrap align-items-end">
                <div>
                  <label className="small text-muted mb-1 d-block">Excel Term</label>
                  <select
                    className="form-control"
                    value={fileTermId}
                    onChange={(e) => setFileTermId(Number(e.target.value))}
                    style={{ minWidth: 140 }}
                    disabled={!filters.class_id || !filters.section_id}
                  >
                    {TERMS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  className="btn btn-outline-primary"
                  onClick={handleExportExcel}
                  disabled={!filters.class_id || !filters.section_id}
                >
                  ⬇️ Export Excel
                </button>

                <label className="btn btn-outline-secondary mb-0">
                  ⬆️ Import Excel
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportExcel}
                    style={{ display: "none" }}
                    disabled={!filters.class_id || !filters.section_id}
                  />
                </label>
              </div>
            </div>
          </div>

          {selectedClass && selectedSection && (
            <div className="alert alert-info mb-0">
              <strong>Selected:</strong> Class <b>{selectedClass.class_name}</b> &nbsp;|&nbsp; Section{" "}
              <b>{selectedSection.section_name}</b>
              {stats?.length ? (
                <>
                  <br />
                  <span className="small text-muted">
                    Avg Attendance:{" "}
                    {stats.map((t) => (
                      <span key={t.termId} className="me-2">
                        <b>{t.label}</b>: {t.avg.toFixed(1)}%
                      </span>
                    ))}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center my-5">
          <div className="spinner-border" role="status" />
        </div>
      )}

      {!loading && filters.class_id && filters.section_id && (
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
              <h5 className="card-title mb-0">Students</h5>
              <div className="text-muted small">
                Click <b>Edit</b> to enter Term-1 & Term-2 attendance.
              </div>
            </div>

            <div className="table-responsive" style={{ maxHeight: "520px", overflowY: "auto" }}>
              <table className="table table-bordered table-striped">
                <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ width: 90 }}>Roll</th>
                    <th>Name</th>
                    <th style={{ width: 220 }}>Term-1 (P / T)</th>
                    <th style={{ width: 220 }}>Term-2 (P / T)</th>
                    <th style={{ width: 120 }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No students found for this selection.
                      </td>
                    </tr>
                  ) : (
                    students.map((st) => {
                      const t1 = data[keyOf(st.id, 1)] || {};
                      const t2 = data[keyOf(st.id, 2)] || {};

                      const t1Line = t1.total_days ? `${t1.present_days ?? 0} / ${t1.total_days}` : "—";
                      const t2Line = t2.total_days ? `${t2.present_days ?? 0} / ${t2.total_days}` : "—";

                      return (
                        <tr key={st.id}>
                          <td>{st.roll_number ?? "—"}</td>
                          <td>{st.name ?? "—"}</td>
                          <td>{t1Line}</td>
                          <td>{t2Line}</td>
                          <td className="text-center">
                            <button className="btn btn-sm btn-primary" onClick={() => openStudentModal(st.id)}>
                              ✍️ Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal: Term-1 / Term-2 entry */}
      <Modal show={showModal} onHide={closeModal} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>Attendance Entry (Term-1 & Term-2)</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {(() => {
            const st = students.find((s) => s.id === activeStudentId);
            return (
              <div className="mb-3">
                <div className="fw-bold">{st?.name || "—"}</div>
                <div className="text-muted small">
                  Roll: <b>{st?.roll_number ?? "—"}</b>
                </div>
              </div>
            );
          })()}

          <div className="row g-3">
            {TERMS.map((t) => (
              <div key={t.id} className="col-12">
                <div className="border rounded p-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-bold">{t.label}</div>
                    <div className="text-muted small">% = Present / Total</div>
                  </div>

                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label mb-1">Total Days</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        value={modalValues[t.id]?.total_days ?? ""}
                        onChange={(e) => setModalField(t.id, "total_days", e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label mb-1">Present Days</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        value={modalValues[t.id]?.present_days ?? ""}
                        onChange={(e) => setModalField(t.id, "present_days", e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label mb-1">Max Attendance</label>
                      <input
                        type="number"
                        className="form-control"
                        min="0"
                        value={modalValues[t.id]?.max_attendance ?? ""}
                        onChange={(e) => setModalField(t.id, "max_attendance", e.target.value)}
                        onFocus={(e) => e.target.select()}
                      />
                      <div className="text-muted small mt-1">Optional (if you want separate max)</div>
                    </div>
                  </div>

                  {(() => {
                    const row = modalValues[t.id] || {};
                    const total = Number(row.total_days || 0);
                    const present = Number(row.present_days || 0);
                    const pct = total ? (present / total) * 100 : null;
                    return (
                      <div className="mt-2 small">
                        <span className="text-muted">Attendance %: </span>
                        <b>{pct == null ? "—" : `${pct.toFixed(2)}%`}</b>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveModal}>
            💾 Save
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AttendanceEntry;
