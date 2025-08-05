import React, { useState, useEffect } from "react";
import moment from "moment"; // Ensure moment is imported
import api from "../api"; // Custom Axios instance with auth
import Swal from "sweetalert2";
import "./Attendance.css"; // Custom styles as needed

const statuses = ["present", "absent", "late", "leave"]; // available statuses

const MarkAttendance = () => {
  const [students, setStudents] = useState([]);
  // attendance maps student id to status ("present", "absent", "late", "leave")
  const [attendance, setAttendance] = useState({});
  // recordIds maps student id to an existing attendance record id (if any)
  const [recordIds, setRecordIds] = useState({});
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [mode, setMode] = useState("create"); // "create" if no records exist, otherwise "edit"
  const [loading, setLoading] = useState(false);

  // Teacher's class id (assumed from the first student)
  const [teacherClassId, setTeacherClassId] = useState(null);
  // Holidays fetched from the API
  const [holidays, setHolidays] = useState([]);

  // Fetch students for the incharge
  const fetchStudents = async () => {
    try {
      const { data } = await api.get("/incharges/students");
      const fetchedStudents = data.students;
      setStudents(fetchedStudents);
      // Set teacher's class id from first student (assumes all students are in same class)
      if (fetchedStudents.length > 0) {
        setTeacherClassId(fetchedStudents[0].class_id);
      }
      // Initialize default attendance state with "present" for all students
      const initialAttendance = {};
      fetchedStudents.forEach((student) => {
        initialAttendance[student.id] = "present";
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error("Error fetching students for attendance:", error);
      Swal.fire("Error", "Failed to fetch students.", "error");
    }
  };

  // Fetch holidays from the API
  const fetchHolidays = async () => {
    try {
      const { data } = await api.get("/holidays");
      setHolidays(data);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  // Fetch attendance records for a given date
  const fetchAttendanceForDate = async (date) => {
    try {
      const { data } = await api.get(`/attendance/date/${date}`);
      if (data && data.length > 0) {
        // If records exist, switch to edit mode and pre-fill attendance state
        setMode("edit");
        const attendanceMap = {};
        const recordIdMap = {};
        data.forEach((record) => {
          attendanceMap[record.studentId] = record.status;
          recordIdMap[record.studentId] = record.id;
        });
        setAttendance(attendanceMap);
        setRecordIds(recordIdMap);
      } else {
        // No records: switch to create mode and reset defaults
        setMode("create");
        const initialAttendance = {};
        students.forEach((student) => {
          initialAttendance[student.id] = "present";
        });
        setAttendance(initialAttendance);
        setRecordIds({});
      }
    } catch (error) {
      console.error("Error fetching attendance for date:", error);
      // On error, assume no records exist
      setMode("create");
      const initialAttendance = {};
      students.forEach((student) => {
        initialAttendance[student.id] = "present";
      });
      setAttendance(initialAttendance);
      setRecordIds({});
    }
  };

  // Fetch students and holidays on component mount
  useEffect(() => {
    fetchStudents();
    fetchHolidays();
  }, []);

  // When selectedDate or students change, fetch attendance records for that date
  useEffect(() => {
    if (students.length) {
      fetchAttendanceForDate(selectedDate);
    }
  }, [selectedDate, students]);

  // Handle radio button changes for a student
  const handleAttendanceChange = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  // Handle date picker change
  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  // Mark all students with a given status
  const handleMarkAll = (status) => {
    const updatedAttendance = {};
    students.forEach((student) => {
      updatedAttendance[student.id] = status;
    });
    setAttendance(updatedAttendance);
  };

  // Compute summary counts for each status
  const summaryCounts = statuses.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});
  students.forEach((student) => {
    const status = attendance[student.id];
    if (status && summaryCounts.hasOwnProperty(status)) {
      summaryCounts[status] += 1;
    }
  });
  const totalStudents = students.length;

  // Submit attendance (create or update records)
  const handleSubmit = async () => {
    try {
      setLoading(true);
      if (mode === "create") {
        const records = students.map((student) => ({
          studentId: student.id,
          status: attendance[student.id],
          remarks: "",
          date: selectedDate,
        }));
        await Promise.all(records.map((record) => api.post("/attendance", record)));
        Swal.fire("Success", "Attendance has been marked successfully.", "success");
        setMode("edit");
        await fetchAttendanceForDate(selectedDate);
      } else {
        await Promise.all(
          students.map((student) => {
            const recordId = recordIds[student.id];
            if (recordId) {
              return api.put(`/attendance/${recordId}`, {
                studentId: student.id,
                status: attendance[student.id],
                remarks: "",
                date: selectedDate,
              });
            } else {
              return api.post("/attendance", {
                studentId: student.id,
                status: attendance[student.id],
                remarks: "",
                date: selectedDate,
              });
            }
          })
        );
        Swal.fire("Success", "Attendance has been updated successfully.", "success");
      }
      // Dispatch custom event after successful attendance submission
      window.dispatchEvent(new Event("attendanceUpdated"));
    } catch (error) {
      console.error("Error submitting attendance:", error);
      Swal.fire(
        "Error",
        error.response?.data?.error || "Failed to submit attendance.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  // Determine the CSS class for each row based on attendance status
  const getRowClass = (status) => {
    switch (status) {
      case "absent":
        return "table-danger";
      case "late":
        return "table-warning";
      case "leave":
        return "table-info";
      default:
        return "";
    }
  };

  // Check the selected date using moment
  const selectedMoment = moment(selectedDate, "YYYY-MM-DD");
  const today = moment().startOf("day");

  // Prevent marking attendance for future dates
  if (selectedMoment.isAfter(today)) {
    return (
      <div className="container mt-4">
        <h1>Mark Attendance</h1>
        <div className="alert alert-info">
          Attendance cannot be marked for future dates.
        </div>
        <div className="mb-3">
          <label htmlFor="attendanceDate" className="form-label">
            Select Date:
          </label>
          <input
            type="date"
            id="attendanceDate"
            className="form-control"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>
      </div>
    );
  }

  // If the selected date is Sunday, display a message
  if (selectedMoment.day() === 0) {
    return (
      <div className="container mt-4">
        <h1>Mark Attendance</h1>
        <div className="alert alert-info">
          {selectedMoment.format("LL")} is Sunday. No attendance required.
        </div>
        <div className="mb-3">
          <label htmlFor="attendanceDate" className="form-label">
            Select Date:
          </label>
          <input
            type="date"
            id="attendanceDate"
            className="form-control"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>
      </div>
    );
  }

  // Check if the selected date is a holiday for this class
  const holidayForDate = holidays.find(
    (holiday) =>
      holiday.date === selectedDate &&
      teacherClassId &&
      holiday.class &&
      Number(holiday.class.id) === Number(teacherClassId)
  );
  if (holidayForDate) {
    return (
      <div className="container mt-4">
        <h1>Mark Attendance</h1>
        <div className="alert alert-info">
          {selectedMoment.format("LL")} is a holiday:{" "}
          <strong>{holidayForDate.description}</strong>
        </div>
        <div className="mb-3">
          <label htmlFor="attendanceDate" className="form-label">
            Select Date:
          </label>
          <input
            type="date"
            id="attendanceDate"
            className="form-control"
            value={selectedDate}
            onChange={handleDateChange}
          />
        </div>
      </div>
    );
  }

  // Render the attendance marking form
  return (
    <div className="container mt-4">
      <h1>Mark Attendance</h1>

      {/* Date Picker */}
      <div className="mb-3">
        <label htmlFor="attendanceDate" className="form-label">
          Select Date:
        </label>
        <input
          type="date"
          id="attendanceDate"
          className="form-control"
          value={selectedDate}
          onChange={handleDateChange}
        />
      </div>

      {/* Summary Cards */}
      <div className="row mb-3">
        <div className="col">
          <div className="card text-white bg-primary mb-3">
            <div className="card-body">
              <h5 className="card-title">Total Students</h5>
              <p className="card-text">{totalStudents}</p>
            </div>
          </div>
        </div>
        {statuses.map((status) => (
          <div className="col" key={status}>
            <div
              className={`card text-white bg-${
                status === "absent"
                  ? "danger"
                  : status === "late"
                  ? "warning"
                  : status === "leave"
                  ? "info"
                  : "success"
              } mb-3`}
            >
              <div className="card-body">
                <h5 className="card-title">
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </h5>
                <p className="card-text">{summaryCounts[status]}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mark All Buttons */}
      <div className="mb-3">
        <div className="btn-group" role="group" aria-label="Mark all">
          {statuses.map((status) => (
            <button
              key={status}
              className="btn btn-outline-secondary"
              onClick={() => handleMarkAll(status)}
            >
              Mark All {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Alert if in edit mode */}
      {mode === "edit" && (
        <div className="alert alert-info">
          Attendance for this date is already filled. You can update the records
          below.
        </div>
      )}

      {/* Attendance Table */}
      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Attendance</th>
          </tr>
        </thead>
        <tbody>
          {students.length ? (
            students.map((student, index) => (
              <tr
                key={student.id}
                className={getRowClass(attendance[student.id])}
              >
                <td>{index + 1}</td>
                <td>{student.name}</td>
                <td>
                  <div className="d-flex flex-wrap">
                    {statuses.map((status) => (
                      <label
                        key={status}
                        className="form-check form-check-inline"
                      >
                        <input
                          type="radio"
                          name={`attendance-${student.id}`}
                          value={status}
                          checked={attendance[student.id] === status}
                          onChange={(e) =>
                            handleAttendanceChange(student.id, e.target.value)
                          }
                          className="form-check-input"
                        />
                        <span className="form-check-label text-capitalize">
                          {status}
                        </span>
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3" className="text-center">
                No students found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading
          ? "Submitting..."
          : mode === "create"
          ? "Submit Attendance"
          : "Update Attendance"}
      </button>
    </div>
  );
};

export default MarkAttendance;
