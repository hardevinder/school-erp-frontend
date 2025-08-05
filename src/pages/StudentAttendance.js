import React, { useState, useEffect } from "react";
import socket from "../socket";
import axios from "axios";
import moment from "moment";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
ChartJS.register(ArcElement, Tooltip, Legend);

// Mapping of class id to friendly names.
const classNames = {
  8: "V",
  9: "VI",
  // Add more mappings as needed.
};

/* ========================================================
   AttendanceSummaryCards Component
   ======================================================== */
const AttendanceSummaryCards = ({
  attendanceRecords,
  currentMonth,
  studentName,
  studentClassName,
}) => {
  const monthlyRecords = attendanceRecords.filter((record) =>
    moment(record.date).isSame(currentMonth, "month")
  );
  const presentCount = monthlyRecords.filter(
    (r) => r.status.toLowerCase() === "present"
  ).length;
  const absentCount = monthlyRecords.filter(
    (r) => r.status.toLowerCase() === "absent"
  ).length;
  const leaveCount = monthlyRecords.filter(
    (r) => r.status.toLowerCase() === "leave"
  ).length;
  const total = monthlyRecords.length;
  const percentPresence = total > 0 ? ((presentCount / total) * 100).toFixed(2) : 0;

  if (total === 0) {
    return (
      <div className="alert alert-warning text-center mt-4">
        Attendance not marked for {currentMonth.format("MMMM YYYY")} (Student: {studentName}, Class: {studentClassName}).
      </div>
    );
  }

  return (
    <div className="row mb-4">
      <div className="col-md-2 mb-2">
        <div className="card bg-info text-white">
          <div className="card-body text-center">
            <h5>Total Marked</h5>
            <p className="card-text">{total}</p>
          </div>
        </div>
      </div>
      <div className="col-md-2 mb-2">
        <div className="card bg-success text-white">
          <div className="card-body text-center">
            <h5>Present</h5>
            <p className="card-text">{presentCount}</p>
          </div>
        </div>
      </div>
      <div className="col-md-2 mb-2">
        <div className="card bg-danger text-white">
          <div className="card-body text-center">
            <h5>Absent</h5>
            <p className="card-text">{absentCount}</p>
          </div>
        </div>
      </div>
      <div className="col-md-2 mb-2">
        <div className="card bg-warning text-dark">
          <div className="card-body text-center">
            <h5>Leave</h5>
            <p className="card-text">{leaveCount}</p>
          </div>
        </div>
      </div>
      <div className="col-md-4 mb-2">
        <div className="card bg-primary text-white">
          <div className="card-body text-center">
            <h5>% Presence</h5>
            <p className="card-text">{percentPresence}%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ========================================================
   AttendanceSummaryChart Component
   ======================================================== */
const AttendanceSummaryChart = ({ attendanceRecords, currentMonth }) => {
  const monthlyRecords = attendanceRecords.filter((record) =>
    moment(record.date).isSame(currentMonth, "month")
  );
  const presentCount = monthlyRecords.filter(
    (r) => r.status.toLowerCase() === "present"
  ).length;
  const absentCount = monthlyRecords.filter(
    (r) => r.status.toLowerCase() === "absent"
  ).length;
  const leaveCount = monthlyRecords.filter(
    (r) => r.status.toLowerCase() === "leave"
  ).length;

  const data = {
    labels: ["Present", "Absent", "Leave"],
    datasets: [
      {
        data: [presentCount, absentCount, leaveCount],
        backgroundColor: ["#28a745", "#dc3545", "#ffc107"],
      },
    ],
  };

  return (
    <div className="mt-4">
      <Pie data={data} />
    </div>
  );
};

/* ========================================================
   StudentCalendar Component (Attendance View)
   ======================================================== */
const StudentCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [studentClassId, setStudentClassId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const token = localStorage.getItem("token");
  const API_URL = process.env.REACT_APP_API_URL;

  // Function to fetch attendance records.
  const fetchAttendanceRecords = () => {
    if (!token) return;
    axios
      .get(`${API_URL}/attendance/student/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        const records = response.data;
        setAttendanceRecords(records);
        if (records.length > 0) {
          setStudentClassId(records[0].student.class_id);
          setStudentName(records[0].student.name);
        }
      })
      .catch((error) => console.error("Error fetching attendance:", error));
  };

  // Initial fetch.
  useEffect(() => {
    fetchAttendanceRecords();
  }, [token]);

  // Fetch holidays.
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/holidays`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => setHolidays(response.data))
      .catch((error) => console.error("Error fetching holidays:", error));
  }, [token]);

  useEffect(() => {
    setSelectedDate(currentMonth.clone().startOf("month").format("YYYY-MM-DD"));
  }, [currentMonth]);

  // Socket listener for attendance changes (both created and updated).
  useEffect(() => {
    const handleAttendanceChange = (data) => {
      console.log("Attendance changed:", data);
      fetchAttendanceRecords();
    };

    socket.on("attendanceCreated", handleAttendanceChange);
    socket.on("attendanceUpdated", handleAttendanceChange);

    return () => {
      socket.off("attendanceCreated", handleAttendanceChange);
      socket.off("attendanceUpdated", handleAttendanceChange);
    };
  }, []);

  const startOfMonthClone = currentMonth.clone().startOf("month");
  const endOfMonthClone = currentMonth.clone().endOf("month");
  const startDay = startOfMonthClone.day();
  const totalDays = endOfMonthClone.date();
  const calendarCells = [];
  for (let i = 0; i < startDay; i++) calendarCells.push(null);
  for (let day = 1; day <= totalDays; day++) {
    calendarCells.push(moment(currentMonth).date(day));
  }

  const getCellStyle = (cell, attendanceRecord, holidayMatch) => {
    if (!holidayMatch && cell.isAfter(moment(), "day")) return {};
    if (holidayMatch) return { backgroundColor: "#ffeeba" };
    if (cell.day() === 0) return { backgroundColor: "#cce5ff" };
    if (attendanceRecord) {
      switch (attendanceRecord.status.toLowerCase()) {
        case "present":
          return { backgroundColor: "#d4edda" };
        case "absent":
          return { backgroundColor: "#f8d7da" };
        case "leave":
          return { backgroundColor: "#fff3cd" };
        default:
          return { backgroundColor: "#e2e3e5" };
      }
    }
    return { backgroundColor: "#f8d7da" };
  };

  return (
    <div className="container my-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button
          className="btn btn-outline-primary"
          onClick={() => setCurrentMonth(currentMonth.clone().subtract(1, "month"))}
        >
          Prev
        </button>
        <h3>
          {currentMonth.format("MMMM YYYY")} (Student: {studentName} - Class:{" "}
          {classNames[studentClassId] || studentClassId})
        </h3>
        <button
          className="btn btn-outline-primary"
          onClick={() => setCurrentMonth(currentMonth.clone().add(1, "month"))}
        >
          Next
        </button>
      </div>
      <AttendanceSummaryCards
        attendanceRecords={attendanceRecords}
        currentMonth={currentMonth}
        studentName={studentName}
        studentClassName={classNames[studentClassId] || studentClassId}
      />
      <div className="row">
        <div className="col-md-8">
          <div
            className="d-grid border"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "2px",
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
              <div
                key={dayName}
                className="text-center font-weight-bold p-2 border bg-light"
              >
                {dayName}
              </div>
            ))}
            {calendarCells.map((cell, index) => {
              if (cell === null)
                return (
                  <div
                    key={index}
                    className="border"
                    style={{ minHeight: "80px" }}
                  />
                );
              const dateStr = cell.format("YYYY-MM-DD");
              const attendanceRecord = attendanceRecords.find(
                (record) => record.date === dateStr
              );
              const holidayMatch = holidays.find(
                (holiday) =>
                  holiday.date === dateStr &&
                  holiday.class &&
                  holiday.class.id === studentClassId
              );
              let cellContent = null;
              if (holidayMatch) {
                cellContent = (
                  <div className="text-center text-dark">
                    <div>{cell.date()}</div>
                    <div style={{ fontSize: "10px" }}>
                      {holidayMatch.description}
                    </div>
                  </div>
                );
              } else if (cell.day() === 0) {
                cellContent = (
                  <div className="text-center text-primary">
                    <div>{cell.date()}</div>
                    <div style={{ fontSize: "10px" }}>Sunday</div>
                  </div>
                );
              } else if (cell.isAfter(moment(), "day")) {
                cellContent = (
                  <div className="text-center">
                    <div>{cell.date()}</div>
                  </div>
                );
              } else {
                if (attendanceRecord) {
                  cellContent = (
                    <div className="text-center">
                      <div>
                        <strong>{cell.date()}</strong>
                      </div>
                      <div style={{ fontSize: "10px" }}>
                        {attendanceRecord.status.charAt(0).toUpperCase() +
                          attendanceRecord.status.slice(1)}
                      </div>
                    </div>
                  );
                } else {
                  cellContent = (
                    <div className="text-center text-danger">
                      <div>{cell.date()}</div>
                      <div style={{ fontSize: "10px" }}>Not Marked</div>
                    </div>
                  );
                }
              }
              const cellStyle = getCellStyle(cell, attendanceRecord, holidayMatch);
              return (
                <div
                  key={index}
                  className="border p-2"
                  style={{ minHeight: "80px", cursor: "pointer", ...cellStyle }}
                  onClick={() => setSelectedDate(dateStr)}
                >
                  {cellContent}
                </div>
              );
            })}
          </div>
        </div>
        <div className="col-md-4">
          {selectedDate ? (
            holidays.find(
              (holiday) =>
                holiday.date === selectedDate &&
                holiday.class &&
                holiday.class.id === studentClassId
            ) ? (
              <div className="alert alert-info mt-4 text-center">
                <h4>Holiday</h4>
                <p>
                  {
                    holidays.find(
                      (holiday) =>
                        holiday.date === selectedDate &&
                        holiday.class &&
                        holiday.class.id === studentClassId
                    ).description
                  }
                </p>
              </div>
            ) : (
              <AttendanceSummaryChart
                attendanceRecords={attendanceRecords}
                currentMonth={currentMonth}
              />
            )
          ) : (
            <div className="alert alert-info mt-4">
              Please select a date to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ========================================================
   StudentLeaveManagement Component (CRUD with SweetAlert)
   ======================================================== */
const StudentLeaveManagement = () => {
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [newLeave, setNewLeave] = useState({ date: "", reason: "" });
  const token = localStorage.getItem("token");
  const API_URL = process.env.REACT_APP_API_URL;

  // Fetch the student's own leave requests.
  const fetchLeaveRequests = async () => {
    try {
      const response = await axios.get(`${API_URL}/leave/student/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaveRequests(response.data);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      Swal.fire("Error", "Could not fetch leave requests", "error");
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, [token]);

  // Create a new leave request.
  const handleCreateLeave = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/leave`, newLeave, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Swal.fire("Success", "Leave request submitted", "success");
      setNewLeave({ date: "", reason: "" });
      fetchLeaveRequests();
    } catch (error) {
      console.error("Error creating leave request", error);
      Swal.fire("Error", "Failed to create leave request", "error");
    }
  };

  // Update a leave request.
  const handleUpdateLeave = async (id) => {
    const leave = leaveRequests.find((l) => l.id === id);
    if (!leave) return;
    const { value: formValues } = await Swal.fire({
      title: "Update Leave Request",
      html:
        `<input id="swal-input1" class="swal2-input" type="date" value="${leave.date}">` +
        `<textarea id="swal-input2" class="swal2-textarea" placeholder="Reason">${leave.reason}</textarea>`,
      focusConfirm: false,
      preConfirm: () => {
        return {
          date: document.getElementById("swal-input1").value,
          reason: document.getElementById("swal-input2").value,
        };
      },
    });
    if (formValues) {
      try {
        await axios.put(`${API_URL}/leave/${id}`, formValues, {
          headers: { Authorization: `Bearer ${token}` },
        });
        Swal.fire("Success", "Leave request updated", "success");
        fetchLeaveRequests();
      } catch (error) {
        console.error("Error updating leave request", error);
        Swal.fire("Error", "Failed to update leave request", "error");
      }
    }
  };

  const handleDeleteLeave = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This will delete your leave request.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });
    if (result.isConfirmed) {
      try {
        await axios.delete(`${API_URL}/leave/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        Swal.fire("Deleted!", "Leave request has been deleted.", "success");
        fetchLeaveRequests();
      } catch (error) {
        console.error("Error deleting leave request", error);
        Swal.fire("Error", "Failed to delete leave request", "error");
      }
    }
  };

  return (
    <div className="container my-4">
      <h3>My Leave Requests</h3>
      <form onSubmit={handleCreateLeave} className="mb-4">
        <div className="mb-3">
          <label htmlFor="leaveDate" className="form-label">
            Date
          </label>
          <input
            type="date"
            id="leaveDate"
            className="form-control"
            value={newLeave.date}
            onChange={(e) =>
              setNewLeave({ ...newLeave, date: e.target.value })
            }
            min={moment().format("YYYY-MM-DD")}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="leaveReason" className="form-label">
            Reason
          </label>
          <textarea
            id="leaveReason"
            className="form-control"
            value={newLeave.reason}
            onChange={(e) =>
              setNewLeave({ ...newLeave, reason: e.target.value })
            }
            required
          ></textarea>
        </div>
        <button type="submit" className="btn btn-primary">
          Submit Leave Request
        </button>
      </form>
      {leaveRequests.length === 0 ? (
        <p>No leave requests found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.map((req) => (
              <tr key={req.id}>
                <td>{moment(req.date).format("YYYY-MM-DD")}</td>
                <td>{req.reason}</td>
                <td>{req.status}</td>
                <td>
                  <button
                    className="btn btn-sm btn-warning me-2"
                    onClick={() => handleUpdateLeave(req.id)}
                    disabled={req.status === "accepted"}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteLeave(req.id)}
                    disabled={req.status === "accepted"}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

/* ========================================================
   Main StudentDashboard Component with Two Tabs
   ======================================================== */
const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState("attendance");

  return (
    <div className="container my-4">
      <h1>Student Dashboard</h1>
      <ul className="nav nav-tabs">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "attendance" ? "active" : ""}`}
            onClick={() => setActiveTab("attendance")}
          >
            Attendance
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "leave" ? "active" : ""}`}
            onClick={() => setActiveTab("leave")}
          >
            Apply for Leave
          </button>
        </li>
      </ul>
      <div className="tab-content mt-4">
        {activeTab === "attendance" && <StudentCalendar />}
        {activeTab === "leave" && <StudentLeaveManagement />}
      </div>
    </div>
  );
};

export default StudentDashboard;
