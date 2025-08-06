import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const CoScholasticEntry = () => {
  const [filters, setFilters] = useState({ class_id: "", section_id: "", term_id: "" });
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [areas, setAreas] = useState([]);
  const [evaluations, setEvaluations] = useState({});
  const [grades, setGrades] = useState([]);
  const inputRefs = useRef({});

  useEffect(() => {
    loadAssignedClasses();
    loadSections();
    loadTerms();
    loadGrades();
  }, []);

  useEffect(() => {
    const { class_id, section_id, term_id } = filters;
    if (class_id && section_id && term_id) fetchEvaluationData();
  }, [filters]);

  const loadAssignedClasses = async () => {
    const res = await api.get("/coscholastic-evaluations/assigned-classes");
    setAssignedClasses(res.data || []);
  };

  const loadSections = async () => {
    const res = await api.get("/sections");
    setSections(res.data || []);
  };

  const loadTerms = async () => {
    try {
      const res = await api.get("/terms");
      setTerms(res.data || []);
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
      const res = await api.get("/coscholastic-evaluations", { params: { class_id, section_id, term_id } });
      setStudents(res.data.students || []);
      setAreas(res.data.areas || []);

      const map = {};
      (res.data.existingEvaluations || []).forEach(ev => {
        map[`${ev.student_id}_${ev.co_scholastic_area_id}`] = {
          grade_id: ev.grade_id || "",
          locked: ev.locked || false,
        };
      });

      setEvaluations(map);
      console.log("🟡 Mapped evaluations:", map);

     
      if (Object.values(map).some(e => e.locked)) {
        Swal.fire("Notice", "Evaluations for this class-section-term are locked.", "info");
      }
    } catch (err) {
      console.error("Failed to fetch evaluation data", err);
      Swal.fire("Error", "Failed to fetch evaluation data", "error");
    }
  };

  const handleChange = (student_id, area_id, field, value) => {
    const key = `${student_id}_${area_id}`;
    setEvaluations(prev => ({
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
      if (nextStudentIndex >= 0 && nextStudentIndex < students.length && nextAreaIndex >= 0 && nextAreaIndex < areas.length) {
        const key = `${students[nextStudentIndex].id}_${areas[nextAreaIndex].id}`;
        const input = inputRefs.current[key];
        if (input) {
          input.focus();
          input.click(); // Open dropdown
        }
      }
    };

    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        nextInput(studentIndex + 1, areaIndex);
        break;
      case 'ArrowUp':
        nextInput(studentIndex - 1, areaIndex);
        break;
      case 'ArrowRight':
        nextInput(studentIndex, areaIndex + 1);
        break;
      case 'ArrowLeft':
        nextInput(studentIndex, areaIndex - 1);
        break;
      default:
        if (e.key.length === 1) {
          const grade = grades.find(g => g.grade.toLowerCase() === e.key.toLowerCase());
          if (grade) {
            handleChange(students[studentIndex].id, areas[areaIndex].id, "grade_id", grade.id);
          }
        }
        break;
    }
  };

  const handleSave = async () => {
    const { class_id, section_id, term_id } = filters;
    const payload = [];

    students.forEach(student => {
      areas.forEach(area => {
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
      link.setAttribute("download", `co-scholastic-${Date.now()}.xlsx`);
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
      Swal.fire("Error", "Please select a file and all filters (class, section, term)", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("class_id", class_id);
    formData.append("section_id", section_id);
    formData.append("term_id", term_id);

    try {
      // Reset states to ensure fresh data fetch
      setStudents([]);
      setAreas([]);
      setEvaluations({});

      await api.post("/coscholastic-evaluations/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      Swal.fire("Success", "Imported successfully", "success");
      await fetchEvaluationData(); // Ensure fetch happens after import completes
    } catch (err) {
      console.error("Failed to import", err);
      Swal.fire("Error", "Failed to import: " + (err.response?.data?.message || err.message), "error");
      // Re-fetch data even on error to restore previous state
      await fetchEvaluationData();
    }
  };

  const handleLock = async () => {
    const { class_id, section_id, term_id } = filters;
    const confirm = await Swal.fire({
      title: "Lock Evaluation?",
      text: "After locking, entries cannot be edited unless unlocked by Exam Head.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Lock it!",
    });

    if (!confirm.isConfirmed) return;

    try {
      await api.patch("/coscholastic-evaluations/lock", { class_id, section_id, term_id });
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
                {[...new Map(assignedClasses.map(c => [c.class_id, c])).values()].map((item) => (
                  <option key={item.class_id} value={item.class_id}>
                    {item.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4 mb-3">
              <label className="form-label">Select Section</label>
              <select
                className="form-select"
                value={filters.section_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, section_id: e.target.value }))
                }
              >
                <option value="">Select Section</option>
                {assignedClasses
                  .filter((c) => c.class_id == filters.class_id)
                  .map((item) => (
                    <option key={item.section_id} value={item.section_id}>
                      {item.section_name}
                    </option>
                  ))}
              </select>
            </div>

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

            {Object.values(evaluations).some(e => e.locked) && (
              <div className="text-end mb-2">
                <span className="badge bg-danger">Locked</span>
              </div>
            )}

            <div className="mb-3 d-flex gap-2">
              <button className="btn btn-success" onClick={handleSave}>💾 Save</button>
              <button className="btn btn-outline-primary" onClick={handleExport}>⬇️ Export Excel</button>
              <label className="btn btn-outline-secondary mb-0">
                ⬆️ Import Excel
                <input type="file" accept=".xlsx" onChange={handleImport} style={{ display: "none" }} />
              </label>
              <button className="btn btn-outline-danger ms-auto" onClick={handleLock}>🔒 Lock</button>
            </div>

            <div className="table-responsive" style={{ maxHeight: 500 }}>
              <table className="table table-bordered table-striped">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    {areas.map(a => (
                      <th key={a.id} className="text-center">{a.name}</th>
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
                              ref={el => inputRefs.current[key] = el}
                              className="form-select"
                              value={String(evalData.grade_id || "")}
                              onChange={(e) => handleChange(s.id, area.id, "grade_id", e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, studentIndex, areaIndex)}
                              disabled={locked}
                            >
                              <option value="">-</option>
                              {grades.map(g => (
                                <option key={g.id} value={String(g.id)}>{g.grade}</option>
                              ))}
                              {console.log("🟢 Grades available:", grades)}

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
    </div>
  );
};

export default CoScholasticEntry;