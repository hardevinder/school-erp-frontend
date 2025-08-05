import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const StudentRemarksEntry = () => {
  const [filters, setFilters] = useState({ class_id: "", section_id: "", term_id: "" });
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [terms, setTerms] = useState([]);
  const [students, setStudents] = useState([]);
  const [remarksMap, setRemarksMap] = useState({});

  useEffect(() => {
    loadAssignedClasses();
    loadTerms();
  }, []);

  useEffect(() => {
    const { class_id, section_id, term_id } = filters;
    if (class_id && section_id && term_id) fetchRemarks();
  }, [filters]);

  const loadAssignedClasses = async () => {
    const res = await api.get("/coscholastic-evaluations/assigned-classes");
    setAssignedClasses(res.data || []);
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

  const fetchRemarks = async () => {
    const { class_id, section_id, term_id } = filters;
    try {
      const res = await api.get("/student-remarks", {
        params: { class_id, section_id, term_id },
      });

      const map = {};
      (res.data.existingRemarks || []).forEach((r) => {
        map[r.student_id] = r.remark || "";
      });

      setStudents(res.data.students || []);
      setRemarksMap(map);
    } catch (err) {
      console.error("Failed to fetch remarks", err);
      Swal.fire("Error", "Failed to fetch remarks", "error");
    }
  };

  const handleChange = (student_id, value) => {
    setRemarksMap((prev) => ({ ...prev, [student_id]: value }));
  };

  const handleSave = async () => {
    const { class_id, section_id, term_id } = filters;
    const payload = students.map((student) => ({
      student_id: student.id,
      class_id,
      section_id,
      term_id,
      remark: remarksMap[student.id] || "",
    }));

    try {
      await api.post("/student-remarks", { remarks: payload });
      Swal.fire("Success", "Remarks saved successfully", "success");
      fetchRemarks();
    } catch (err) {
      console.error("Failed to save remarks", err);
      Swal.fire("Error", "Failed to save remarks", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h3>📝 Student Remarks Entry</h3>

      <div className="card mt-3 mb-4">
        <div className="card-body">
          <div className="row">
            <div className="col-md-4 mb-3">
              <label className="form-label">Select Class</label>
              <select
                className="form-select"
                value={filters.class_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, class_id: e.target.value, section_id: "" }))
                }
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

      {students.length > 0 && (
        <div className="card">
          <div className="card-body">
            <h5>📋 Remarks Table</h5>

            <div className="mb-3 text-end">
              <button className="btn btn-success" onClick={handleSave}>
                💾 Save Remarks
              </button>
            </div>

            <div className="table-responsive" style={{ maxHeight: 500 }}>
              <table className="table table-bordered table-striped">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.roll_number}</td>
                      <td>{s.name}</td>
                      <td>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={remarksMap[s.id] || ""}
                          onChange={(e) => handleChange(s.id, e.target.value)}
                        />
                      </td>
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

export default StudentRemarksEntry;
