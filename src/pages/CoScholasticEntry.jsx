import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const CoScholasticEntry = () => {
  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
    term_id: "",
  });
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [grades, setGrades] = useState([]);
  const inputRefs = useRef({});

  // Initial loads
  useEffect(() => {
    loadAssignedClasses();
    loadTerms();
    loadGrades();
  }, []);

  // Fetch evaluation data when all filters selected
  useEffect(() => {
    const { class_id, section_id, term_id } = filters;
    if (class_id && section_id && term_id) {
      fetchEvaluationData();
    } else {
      // Reset table if filters incomplete
      setStudents([]);
      setAreas([]);
      setEvaluations({});
    }
  }, [filters]);

  const loadAssignedClasses = async () => {
    try {
      const res = await api.get("/coscholastic-evaluations/assigned-classes");
      const list = Array.isArray(res.data) ? res.data : [];
      console.log("📌 Assigned classes from API:", list);
      setAssignedClasses(list);

      // Auto-select first class & section IF nothing selected yet
      if (list.length > 0 && !filters.class_id && !filters.section_id) {
        const first = list[0];
        setFilters((prev) => ({
          ...prev,
          class_id: String(first.class_id),
          section_id: String(first.section_id),
        }));
      }
    } catch (err) {
      console.error("Failed to load assigned classes", err);
      Swal.fire("Error", "Failed to load assigned classes", "error");
    }
  };

  const loadTerms = async () => {
    try {
      const res = await api.get("/terms");
      setTerms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load terms", err);
      Swal.fire("Error", "Failed to load terms", "error");
    }
  };

  const loadGrades = async () => {
    try {
      const res = await api.get("/co-scholastic-grades");
      setGrades(Array.isArray(res.data) ? res.data : []);
      console.log("✅ Grades loaded:", res.data);
    } catch (err) {
      console.error("Failed to load grades", err);
      Swal.fire("Error", "Failed to load grades", "error");
      setGrades([]);
    }
  };

  const fetchEvaluationData = async () => {
    const { class_id, section_id, term_id } = filters;
    try {
      const res = await api.get("/coscholastic-evaluations", {
        params: { class_id, section_id, term_id },
      });

      const studentsData = Array.isArray(res.data.students)
        ? res.data.students
        : [];
      const areasData = Array.isArray(res.data.areas) ? res.data.areas : [];
      const existing = Array.isArray(res.data.existingEvaluations)
        ? res.data.existingEvaluations
        : [];

      setStudents(studentsData);
      setAreas(areasData);

      console.log("👨‍🎓 Students count:", studentsData.length);
      console.log("📚 Areas count:", areasData.length);
      console.log("📝 Existing evaluations count:", existing.length);

      const map = {};
      existing.forEach((ev) => {
        map[`${ev.student_id}_${ev.co_scholastic_area_id}`] = {
          grade_id: ev.grade_id || "",
          locked: ev.locked || false,
        };
      });

      setEvaluations(map);
      console.log("🟡 Mapped evaluations:", map);

      if (areasData.length === 0) {
        Swal.fire(
          "Info",
          "No co-scholastic areas mapped for this class.",
          "info"
        );
      }

      if (Object.values(map).some((e) => e.locked)) {
        Swal.fire(
          "Notice",
          "Evaluations for this class-section-term are locked.",
          "info"
        );
      }
    } catch (err) {
      console.error("Failed to fetch evaluation data", err);
      Swal.fire("Error", "Failed to fetch evaluation data", "error");
      setStudents([]);
      setAreas([]);
      setEvaluations({});
    }
  };

  const handleChange = (student_id, area_id, field, value) => {
    const key = `${student_id}_${area_id}`;
    setEvaluations((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleKeyDown = (e, studentIndex, areaIndex) => {
    e.preventDefault();

    const nextInput = (nextStudentIndex, nextAreaIndex) => {
      if (
        nextStudentIndex >= 0 &&
        nextStudentIndex < students.length &&
        nextAreaIndex >= 0 &&
        nextAreaIndex < areas.length
      ) {
        const key = `${students[nextStudentIndex].id}_${areas[nextAreaIndex].id}`;
        const input = inputRefs.current[key];
        if (input) {
          input.focus();
          input.click(); // open dropdown
        }
      }
    };

    switch (e.key) {
      case "Enter":
      case "ArrowDown":
        nextInput(studentIndex + 1, areaIndex);
        break;
      case "ArrowUp":
        nextInput(studentIndex - 1, areaIndex);
        break;
      case "ArrowRight":
        nextInput(studentIndex, areaIndex + 1);
        break;
      case "ArrowLeft":
        nextInput(studentIndex, areaIndex - 1);
        break;
      default:
        if (e.key.length === 1) {
          const grade = grades.find(
            (g) => g.grade?.toLowerCase() === e.key.toLowerCase()
          );
          if (grade) {
            handleChange(
              students[studentIndex].id,
              areas[areaIndex].id,
              "grade_id",
              grade.id
            );
          }
        }
        break;
    }
  };

  const handleSave = async () => {
    const { class_id, section_id, term_id } = filters;
    const payload = [];

    students.forEach((student) => {
      areas.forEach((area) => {
        const key = `${student.id}_${area.id}`;
        const data = evaluations[key] || {};

        if (data.grade_id) {
          payload.push({
            student_id: student.id,
            co_scholastic_area_id: area.id,
            grade_id: data.grade_id,
            class_id,
            section_id,
            term_id,
          });
        }
      });
    });

    if (payload.length === 0) {
      Swal.fire("Info", "No grades to save.", "info");
      return;
    }

    try {
      await api.post("/coscholastic-evaluations/save", { evaluations: payload });
      Swal.fire("Success", "Evaluations saved", "success");
      fetchEvaluationData();
    } catch (err) {
      console.error("Failed to save evaluations", err);
      Swal.fire("Error", "Failed to save evaluations", "error");
    }
  };

  const handleExport = async () => {
    const { class_id, section_id, term_id } = filters;
    try {
      const res = await api.get("/coscholastic-evaluations/export", {
        params: { class_id, section_id, term_id },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `co-scholastic-${class_id}-${section_id}-${term_id}-${Date.now()}.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Failed to export", err);
      Swal.fire("Error", "Failed to export", "error");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    const { class_id, section_id, term_id } = filters;
    if (!file || !class_id || !section_id || !term_id) {
      Swal.fire(
        "Error",
        "Please select a file and all filters (class, section, term)",
        "error"
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", class_id);
    formData.append("section_id", section_id);
    formData.append("term_id", term_id);

    try {
      setStudents([]);
      setAreas([]);
      setEvaluations({});

      await api.post("/coscholastic-evaluations/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire("Success", "Imported successfully", "success");
      await fetchEvaluationData();
    } catch (err) {
      console.error("Failed to import", err);
      Swal.fire(
        "Error",
        "Failed to import: " +
          (err.response?.data?.message || err.message || "Unknown error"),
        "error"
      );
      await fetchEvaluationData();
    } finally {
      // Reset file input
      e.target.value = "";
    }
  };

  const handleLock = async () => {
    const { class_id, section_id, term_id } = filters;
    if (!class_id || !section_id || !term_id) {
      Swal.fire(
        "Error",
        "Please select class, section and term before locking.",
        "error"
      );
      return;
    }

    const confirm = await Swal.fire({
      title: "Lock Evaluation?",
      text: "After locking, entries cannot be edited unless unlocked by Exam Head.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Lock it!",
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.patch("/coscholastic-evaluations/lock", {
        class_id,
        section_id,
        term_id,
      });
      Swal.fire("Locked", "Evaluations locked successfully", "success");
      fetchEvaluationData();
    } catch (err) {
      console.error("Failed to lock", err);
      Swal.fire("Error", "Failed to lock", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h3>🎯 Co-Scholastic Evaluation Entry</h3>

      <div className="card mt-3 mb-4">
        <div className="card-body">
          <div className="row">
            {/* Class */}
            <div className="col-md-4 mb-3">
              <label className="form-label">Select Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={(e) => {
                  const class_id = e.target.value;
                  setFilters((prev) => ({
                    ...prev,
                    class_id,
                    section_id: "",
                  }));
                }}
              >
                <option value="">Select Class</option>
                {[
                  ...new Map(
                    assignedClasses.map((c) => [c.class_id, c])
                  ).values(),
                ].map((item) => (
                  <option key={item.class_id} value={item.class_id}>
                    {item.class_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Section */}
            <div className="col-md-4 mb-3">
              <label className="form-label">Select Section</label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    section_id: e.target.value,
                  }))
                }
              >
                <option value="">Select Section</option>
                {assignedClasses
                  .filter((c) => String(c.class_id) === String(filters.class_id))
                  .map((item) => (
                    <option key={item.section_id} value={item.section_id}>
                      {item.section_name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Term */}
            <div className="col-md-4 mb-3">
              <label className="form-label">Select Term</label>
              <select
                className="form-select"
                value={filters.term_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, term_id: e.target.value }))
                }
              >
                <option value="">Select Term</option>
                {terms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {students.length > 0 && areas.length > 0 && (
        <div className="card">
          <div className="card-body">
            <h5>🧾 Evaluation Table</h5>

            {Object.values(evaluations).some((e) => e.locked) && (
              <div className="text-end mb-2">
                <span className="badge bg-danger">Locked</span>
              </div>
            )}

            <div className="mb-3 d-flex gap-2">
              <button className="btn btn-success" onClick={handleSave}>
                💾 Save
              </button>
              <button className="btn btn-outline-primary" onClick={handleExport}>
                ⬇️ Export Excel
              </button>
              <label className="btn btn-outline-secondary mb-0">
                ⬆️ Import Excel
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleImport}
                  style={{ display: "none" }}
                />
              </label>
              <button
                className="btn btn-outline-danger ms-auto"
                onClick={handleLock}
              >
                🔒 Lock
              </button>
            </div>

            <div className="table-responsive" style={{ maxHeight: 500 }}>
              <table className="table table-bordered table-striped">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    {areas.map((a) => (
                      <th key={a.id} className="text-center">
                        {a.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, studentIndex) => (
                    <tr key={s.id}>
                      <td>{s.roll_number}</td>
                      <td>{s.name}</td>
                      {areas.map((area, areaIndex) => {
                        const key = `${s.id}_${area.id}`;
                        const evalData = evaluations[key] || {};
                        const locked = evalData.locked;

                        return (
                          <td key={key}>
                            <select
                              ref={(el) => (inputRefs.current[key] = el)}
                              className="form-select"
                              value={String(evalData.grade_id || "")}
                              onChange={(e) =>
                                handleChange(
                                  s.id,
                                  area.id,
                                  "grade_id",
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, studentIndex, areaIndex)
                              }
                              disabled={locked}
                            >
                              <option value="">-</option>
                              {grades.map((g) => (
                                <option key={g.id} value={String(g.id)}>
                                  {g.grade}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {students.length === 0 &&
        areas.length === 0 &&
        filters.class_id &&
        filters.section_id &&
        filters.term_id && (
          <div className="alert alert-info">
            No students or co-scholastic areas found for this selection.
          </div>
        )}
    </div>
  );
};

export default CoScholasticEntry;
