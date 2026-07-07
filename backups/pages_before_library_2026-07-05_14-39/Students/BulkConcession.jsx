import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import api from "../../api";

const BulkConcession = () => {
  const navigate = useNavigate();

  const [loadingMasters, setLoadingMasters] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [applying, setApplying] = useState(false);

  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [concessions, setConcessions] = useState([]);

  const [allStudents, setAllStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const [filters, setFilters] = useState({
    session_id: "",
    class_id: "",
    section_id: "",
    current_concession_id: "",
    apply_concession_id: "",
    search: "",
  });

  useEffect(() => {
    fetchMasters();
  }, []);

  useEffect(() => {
    setSelectedStudentIds((prev) =>
      prev.filter((id) => previewRows.some((stu) => String(stu.id) === String(id)))
    );
  }, [allStudents, filters.class_id, filters.section_id, filters.session_id, filters.current_concession_id, filters.search]); // eslint-disable-line

  const fetchMasters = async () => {
    try {
      setLoadingMasters(true);

      const [classesRes, sectionsRes, sessionsRes, concessionsRes] = await Promise.all([
        api.get("/classes"),
        api.get("/sections"),
        api.get("/sessions"),
        api.get("/concessions"),
      ]);

      const classesData = Array.isArray(classesRes?.data) ? classesRes.data : [];
      const sectionsData = Array.isArray(sectionsRes?.data) ? sectionsRes.data : [];
      const sessionsData = Array.isArray(sessionsRes?.data) ? sessionsRes.data : [];
      const concessionsData = Array.isArray(concessionsRes?.data) ? concessionsRes.data : [];

      setClasses(classesData);
      setSections(sectionsData);
      setSessions(sessionsData);
      setConcessions(concessionsData);

      const activeSession =
        sessionsData.find((s) => s.is_active || s.isActive || s.active) || null;

      if (activeSession?.id) {
        setFilters((prev) => ({
          ...prev,
          session_id: String(activeSession.id),
        }));
      }
    } catch (error) {
      console.error("Failed to load masters:", error);
      Swal.fire("Error", "Failed to load classes, sections, sessions or concessions.", "error");
    } finally {
      setLoadingMasters(false);
    }
  };

  const getClassName = (id) => {
    const found = classes.find((c) => String(c.id) === String(id));
    return found?.class_name || found?.name || "-";
  };

  const getSectionName = (id) => {
    const found = sections.find((s) => String(s.id) === String(id));
    return found?.section_name || found?.name || "-";
  };

  const getSessionName = (id) => {
    const found = sessions.find((s) => String(s.id) === String(id));
    return found?.name || found?.session_name || "-";
  };

  const getConcessionName = (id) => {
    const found = concessions.find((c) => String(c.id) === String(id));
    if (!found) return "-";
    const pct =
      found.concession_percentage !== null &&
      found.concession_percentage !== undefined &&
      String(found.concession_percentage).trim() !== ""
        ? ` (${found.concession_percentage}%)`
        : "";
    return `${found.concession_name || found.name || "Concession"}${pct}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateLoad = () => {
    if (!filters.class_id) return "Please select class.";
    return null;
  };

  const handleLoadStudents = async () => {
    const validationError = validateLoad();
    if (validationError) {
      Swal.fire("Validation", validationError, "warning");
      return;
    }

    try {
      setLoadingStudents(true);
      setSelectedStudentIds([]);

      const res = await api.get("/students");
      const rows = Array.isArray(res?.data) ? res.data : [];

      setAllStudents(rows);

      const filtered = filterStudents(rows, filters);
      const visibleIds = filtered
        .map((stu) => stu.id)
        .filter((id) => id !== undefined && id !== null);

      setSelectedStudentIds(visibleIds);

      if (!filtered.length) {
        Swal.fire("No Students Found", "No students matched the selected filters.", "info");
        return;
      }

      Swal.fire(
        "Students Loaded",
        `${filtered.length} student(s) found. All are selected by default.`,
        "success"
      );
    } catch (error) {
      console.error("Failed to load students:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to load students.",
        "error"
      );
    } finally {
      setLoadingStudents(false);
    }
  };

  const filterStudents = (students, activeFilters) => {
    return (Array.isArray(students) ? students : []).filter((stu) => {
      const matchesSession =
        !activeFilters.session_id ||
        String(stu.session_id || "") === String(activeFilters.session_id);

      const matchesClass =
        !activeFilters.class_id ||
        String(stu.class_id || "") === String(activeFilters.class_id);

      const matchesSection =
        !activeFilters.section_id ||
        String(stu.section_id || "") === String(activeFilters.section_id);

      let matchesCurrentConcession = true;
      if (activeFilters.current_concession_id === "__NO_CONCESSION__") {
        matchesCurrentConcession = !stu.concession_id;
      } else if (activeFilters.current_concession_id) {
        matchesCurrentConcession =
          String(stu.concession_id || "") === String(activeFilters.current_concession_id);
      }

      const q = String(activeFilters.search || "").trim().toLowerCase();
      const matchesSearch =
        !q ||
        String(stu.name || "").toLowerCase().includes(q) ||
        String(stu.admission_number || "").toLowerCase().includes(q) ||
        String(stu.father_name || "").toLowerCase().includes(q);

      return (
        matchesSession &&
        matchesClass &&
        matchesSection &&
        matchesCurrentConcession &&
        matchesSearch
      );
    });
  };

  const previewRows = useMemo(() => {
    return filterStudents(allStudents, filters);
  }, [allStudents, filters]);

  const allSelectableIds = previewRows
    .map((stu) => stu.id)
    .filter((id) => id !== undefined && id !== null);

  const selectedCount = selectedStudentIds.length;

  const isAllSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedStudentIds.includes(id));

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      }
      return [...prev, studentId];
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(allSelectableIds);
    }
  };

  const handleApplyConcession = async () => {
    if (!filters.apply_concession_id) {
      Swal.fire("Validation", "Please select concession to apply.", "warning");
      return;
    }

    if (!previewRows.length) {
      Swal.fire("No Students", "Please load students first.", "warning");
      return;
    }

    if (!selectedStudentIds.length) {
      Swal.fire("No Students Selected", "Please select at least one student.", "warning");
      return;
    }

    const confirm = await Swal.fire({
      title: "Confirm Bulk Concession Update",
      html: `
        <div style="text-align:left">
          <p><strong>Session:</strong> ${getSessionName(filters.session_id)}</p>
          <p><strong>Class:</strong> ${getClassName(filters.class_id)}</p>
          <p><strong>Section:</strong> ${
            filters.section_id ? getSectionName(filters.section_id) : "All Sections"
          }</p>
          <p><strong>Filter By Current Concession:</strong> ${
            filters.current_concession_id
              ? filters.current_concession_id === "__NO_CONCESSION__"
                ? "No Concession"
                : getConcessionName(filters.current_concession_id)
              : "All"
          }</p>
          <p><strong>Apply Concession:</strong> ${getConcessionName(filters.apply_concession_id)}</p>
          <p><strong>Total Visible Students:</strong> ${previewRows.length}</p>
          <p><strong>Selected Students:</strong> ${selectedStudentIds.length}</p>
          <p style="color:#b91c1c;font-weight:600;margin-top:10px;">
            Selected students will be updated with the chosen concession.
          </p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Apply",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#198754",
    });

    if (!confirm.isConfirmed) return;

    try {
      setApplying(true);

      const payload = {
        student_ids: selectedStudentIds,
        concession_id: Number(filters.apply_concession_id),
      };

      const res = await api.put("/students/bulk/concession", payload);

      Swal.fire(
        "Success",
        res?.data?.message ||
          `${selectedStudentIds.length} student(s) updated successfully.`,
        "success"
      );

      await handleLoadStudents();
    } catch (error) {
      console.error("Bulk concession update failed:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          "Failed to apply concession.",
        "error"
      );
    } finally {
      setApplying(false);
    }
  };

  const handleResetFilters = () => {
    const activeSession =
      sessions.find((s) => s.is_active || s.isActive || s.active) || null;

    setFilters({
      session_id: activeSession?.id ? String(activeSession.id) : "",
      class_id: "",
      section_id: "",
      current_concession_id: "",
      apply_concession_id: "",
      search: "",
    });
    setAllStudents([]);
    setSelectedStudentIds([]);
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h3 className="mb-1">Bulk Student Concession Update</h3>
          <div className="text-muted" style={{ fontSize: "14px" }}>
            Filter students, select concession, then apply it to selected students.
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Back
          </button>

          <button
            type="button"
            className="btn btn-outline-dark"
            onClick={handleResetFilters}
            disabled={loadingStudents || applying || loadingMasters}
          >
            Reset
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLoadStudents}
            disabled={loadingStudents || applying || loadingMasters}
          >
            {loadingStudents ? "Loading..." : "Load Students"}
          </button>

          <button
            type="button"
            className="btn btn-success"
            onClick={handleApplyConcession}
            disabled={
              applying ||
              loadingStudents ||
              loadingMasters ||
              previewRows.length === 0 ||
              selectedStudentIds.length === 0 ||
              !filters.apply_concession_id
            }
          >
            {applying ? "Applying..." : "Apply Concession"}
          </button>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          {loadingMasters ? (
            <div className="text-center py-4">Loading...</div>
          ) : (
            <div className="row g-3">
              <div className="col-md-2">
                <label className="form-label">Session</label>
                <select
                  name="session_id"
                  className="form-select"
                  value={filters.session_id}
                  onChange={handleChange}
                >
                  <option value="">All Sessions</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name || session.session_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">Class</label>
                <select
                  name="class_id"
                  className="form-select"
                  value={filters.class_id}
                  onChange={handleChange}
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name || cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <label className="form-label">Section</label>
                <select
                  name="section_id"
                  className="form-select"
                  value={filters.section_id}
                  onChange={handleChange}
                >
                  <option value="">All Sections</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.section_name || sec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Filter by Current Concession</label>
                <select
                  name="current_concession_id"
                  className="form-select"
                  value={filters.current_concession_id}
                  onChange={handleChange}
                >
                  <option value="">All</option>
                  <option value="__NO_CONCESSION__">No Concession</option>
                  {concessions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.concession_name || item.name}
                      {item.concession_percentage !== undefined &&
                      item.concession_percentage !== null
                        ? ` (${item.concession_percentage}%)`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">Concession to Apply</label>
                <select
                  name="apply_concession_id"
                  className="form-select"
                  value={filters.apply_concession_id}
                  onChange={handleChange}
                >
                  <option value="">Select Concession</option>
                  {concessions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.concession_name || item.name}
                      {item.concession_percentage !== undefined &&
                      item.concession_percentage !== null
                        ? ` (${item.concession_percentage}%)`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label">Search Student</label>
                <input
                  type="text"
                  name="search"
                  className="form-control"
                  placeholder="Search by name / admission no / father name"
                  value={filters.search}
                  onChange={handleChange}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div>
              <h5 className="mb-1">Student List</h5>
              <div className="text-muted" style={{ fontSize: "13px" }}>
                Choose students from the filtered list and apply the selected concession.
              </div>
            </div>

            {previewRows.length > 0 && (
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-primary" style={{ fontSize: "13px" }}>
                  Total: {previewRows.length}
                </span>
                <span className="badge bg-success" style={{ fontSize: "13px" }}>
                  Selected: {selectedCount}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleSelectAll}
                >
                  {isAllSelected ? "Unselect All" : "Select All"}
                </button>
              </div>
            )}
          </div>

          {previewRows.length > 0 && (
            <div className="alert alert-light border mb-3">
              <div>
                <strong>Session:</strong> {filters.session_id ? getSessionName(filters.session_id) : "All"}
              </div>
              <div>
                <strong>Class:</strong> {filters.class_id ? getClassName(filters.class_id) : "All"}
              </div>
              <div>
                <strong>Section:</strong> {filters.section_id ? getSectionName(filters.section_id) : "All"}
              </div>
              <div>
                <strong>Current Concession Filter:</strong>{" "}
                {filters.current_concession_id
                  ? filters.current_concession_id === "__NO_CONCESSION__"
                    ? "No Concession"
                    : getConcessionName(filters.current_concession_id)
                  : "All"}
              </div>
            </div>
          )}

          {!previewRows.length ? (
            <div className="text-center text-muted py-4">
              No student data yet. Choose filters and click <strong>Load Students</strong>.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: "60px" }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th style={{ width: "70px" }}>#</th>
                    <th>Admission No.</th>
                    <th>Name</th>
                    <th>Father Name</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Current Concession</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((stu, idx) => {
                    const studentId = stu.id;
                    const isChecked = selectedStudentIds.includes(studentId);

                    return (
                      <tr key={studentId || idx}>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleStudentSelection(studentId)}
                            disabled={studentId === undefined || studentId === null}
                          />
                        </td>
                        <td>{idx + 1}</td>
                        <td>{stu.admission_number || "-"}</td>
                        <td>{stu.name || "-"}</td>
                        <td>{stu.father_name || "-"}</td>
                        <td>{stu.class_name || getClassName(stu.class_id)}</td>
                        <td>{stu.section_name || getSectionName(stu.section_id)}</td>
                        <td>
                          {stu.concession_id
                            ? stu.concession_name ||
                              stu.Concession?.concession_name ||
                              getConcessionName(stu.concession_id)
                            : "No Concession"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkConcession;