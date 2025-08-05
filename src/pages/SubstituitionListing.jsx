import React, { useState, useEffect } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import Select from "react-select";
import "./SubstitutionListing.css"; // Customize your CSS as needed

const SubstitutionListing = () => {
  const [substitutions, setSubstitutions] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [filterCoveringTeacher, setFilterCoveringTeacher] = useState(null);
  const [filterRegularTeacher, setFilterRegularTeacher] = useState(null);
  const [filterClass, setFilterClass] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState(null);
  const [filterSubject, setFilterSubject] = useState(null);

  // Fetch substitutions from the protected API
  const fetchSubstitutions = async () => {
    try {
      const response = await api.get("/substitutions");
      setSubstitutions(response.data);
    } catch (error) {
      console.error("Error fetching substitutions:", error);
      Swal.fire("Error", "Failed to fetch substitutions.", "error");
    }
  };

  useEffect(() => {
    fetchSubstitutions();
  }, []);

  // Build unique dropdown options from fetched data
  const coveringTeacherOptions = Array.from(
    new Set(substitutions.map(s => s.Teacher?.name).filter(Boolean))
  )
    .sort()
    .map(teacher => ({ label: teacher, value: teacher }));

  const regularTeacherOptions = Array.from(
    new Set(substitutions.map(s => s.OriginalTeacher?.name).filter(Boolean))
  )
    .sort()
    .map(teacher => ({ label: teacher, value: teacher }));

  const classOptions = Array.from(
    new Set(substitutions.map(s => (s.Class ? s.Class.class_name : s.classId)))
  )
    .sort()
    .map(cls => ({ label: cls, value: cls }));

  // Build period options from the associated Period model using period_name
  const periodOptions = Array.from(
    new Set(substitutions.map(s => s.Period?.period_name).filter(Boolean))
  )
    .sort()
    .map(periodName => ({ label: periodName, value: periodName }));

  const subjectOptions = Array.from(
    new Set(substitutions.map(s => s.Subject?.name).filter(Boolean))
  )
    .sort()
    .map(subject => ({ label: subject, value: subject }));

  // Filtering logic: each record must match all selected filter criteria
  const filteredSubstitutions = substitutions.filter(s => {
    const matchDate = filterDate ? s.date === filterDate : true;
    const matchCovering = filterCoveringTeacher
      ? s.Teacher?.name === filterCoveringTeacher.value
      : true;
    const matchRegular = filterRegularTeacher
      ? s.OriginalTeacher?.name === filterRegularTeacher.value
      : true;
    const matchClass = filterClass
      ? s.Class
        ? s.Class.class_name === filterClass.value
        : s.classId.toString() === filterClass.value
      : true;
    // Use Period.period_name for filtering instead of periodId
    const matchPeriod = filterPeriod ? s.Period?.period_name === filterPeriod.value : true;
    const matchSubject = filterSubject ? s.Subject?.name === filterSubject.value : true;
    return matchDate && matchCovering && matchRegular && matchClass && matchPeriod && matchSubject;
  });

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Substitution Listing</h1>

      {/* Attractive Filter Section */}
      <div className="card p-3 mb-4 shadow-sm filter-card">
        <div className="row">
          <div className="col-md-2 mb-3">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          <div className="col-md-2 mb-3">
            <label className="form-label">Covering Teacher</label>
            <Select
              options={coveringTeacherOptions}
              value={filterCoveringTeacher}
              onChange={setFilterCoveringTeacher}
              placeholder="Select Covering Teacher"
              isClearable
            />
          </div>
          <div className="col-md-2 mb-3">
            <label className="form-label">Regular Teacher</label>
            <Select
              options={regularTeacherOptions}
              value={filterRegularTeacher}
              onChange={setFilterRegularTeacher}
              placeholder="Select Regular Teacher"
              isClearable
            />
          </div>
          <div className="col-md-2 mb-3">
            <label className="form-label">Class</label>
            <Select
              options={classOptions}
              value={filterClass}
              onChange={setFilterClass}
              placeholder="Select Class"
              isClearable
            />
          </div>
          <div className="col-md-2 mb-3">
            <label className="form-label">Period</label>
            <Select
              options={periodOptions}
              value={filterPeriod}
              onChange={setFilterPeriod}
              placeholder="Select Period"
              isClearable
            />
          </div>
          <div className="col-md-2 mb-3">
            <label className="form-label">Subject</label>
            <Select
              options={subjectOptions}
              value={filterSubject}
              onChange={setFilterSubject}
              placeholder="Select Subject"
              isClearable
            />
          </div>
        </div>
      </div>

      {/* Attractive Data Table */}
      <div className="table-responsive">
        <table className="table table-hover table-bordered">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Covering Teacher</th>
              <th>Regular Teacher</th>
              <th>Class</th>
              <th>Period</th>
              <th>Subject</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubstitutions.length > 0 ? (
              filteredSubstitutions.map((s, index) => (
                <tr key={s.id}>
                  <td>{index + 1}</td>
                  <td>{s.date}</td>
                  <td>{s.Teacher?.name}</td>
                  <td>{s.OriginalTeacher?.name}</td>
                  <td>{s.Class ? s.Class.class_name : s.classId}</td>
                  <td>{s.Period ? s.Period.period_name : s.periodId}</td>
                  <td>{s.Subject?.name}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No Substitutions Found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubstitutionListing;
