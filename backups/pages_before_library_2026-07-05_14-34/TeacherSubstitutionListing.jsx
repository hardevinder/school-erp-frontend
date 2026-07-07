import React, { useState, useEffect } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import Select from "react-select";
import "./SubstitutionListing.css"; // Customize your CSS as needed
import socket from "../socket";

const TeacherSubstitutionListing = () => {
  const [substitutions, setSubstitutions] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [filterRegularTeacher, setFilterRegularTeacher] = useState(null);
  const [filterClass, setFilterClass] = useState(null);
  const [filterPeriod, setFilterPeriod] = useState(null);
  const [filterSubject, setFilterSubject] = useState(null);

  // Fetch substitutions for the logged-in teacher
  const fetchSubstitutions = async () => {
    try {
      const response = await api.get("/substitutions/teacher");
      setSubstitutions(response.data);
    } catch (error) {
      console.error("Error fetching substitutions:", error);
      Swal.fire("Error", "Failed to fetch substitutions.", "error");
    }
  };

  useEffect(() => {
    fetchSubstitutions();
  }, []);

  // Subscribe to substitution events for realtime updates
  useEffect(() => {
    const handleSubstitutionChange = () => {
      fetchSubstitutions();
    };

    socket.on("newSubstitution", handleSubstitutionChange);
    socket.on("substitutionUpdated", handleSubstitutionChange);
    socket.on("substitutionDeleted", handleSubstitutionChange);

    return () => {
      socket.off("newSubstitution", handleSubstitutionChange);
      socket.off("substitutionUpdated", handleSubstitutionChange);
      socket.off("substitutionDeleted", handleSubstitutionChange);
    };
  }, []);

  // Build unique dropdown options from fetched data
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
    const matchRegular = filterRegularTeacher
      ? s.OriginalTeacher?.name === filterRegularTeacher.value
      : true;
    const matchClass = filterClass
      ? s.Class
        ? s.Class.class_name === filterClass.value
        : s.classId.toString() === filterClass.value
      : true;
    const matchPeriod = filterPeriod ? s.Period?.period_name === filterPeriod.value : true;
    const matchSubject = filterSubject ? s.Subject?.name === filterSubject.value : true;
    return matchDate && matchRegular && matchClass && matchPeriod && matchSubject;
  });

  return (
    <div className="container mt-4">
      <h1 className="mb-4">My Covered Substitutions</h1>

      {/* Filter Section */}
      <div className="card p-3 mb-4 shadow-sm filter-card">
        <div className="row">
          <div className="col-md-3 mb-3">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-control"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          <div className="col-md-3 mb-3">
            <label className="form-label">Covered To</label>
            <Select
              options={regularTeacherOptions}
              value={filterRegularTeacher}
              onChange={setFilterRegularTeacher}
              placeholder="Select Covered To"
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

      {/* Data Table */}
      <div className="table-responsive">
        <table className="table table-hover table-bordered">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Covered To</th>
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
                  <td>{s.OriginalTeacher?.name}</td>
                  <td>{s.Class ? s.Class.class_name : s.classId}</td>
                  <td>{s.Period ? s.Period.period_name : s.periodId}</td>
                  <td>{s.Subject?.name}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
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

export default TeacherSubstitutionListing;
