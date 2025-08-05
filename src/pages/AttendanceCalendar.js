import React, { useState, useEffect } from "react";
import axios from "axios";
import moment from "moment";
import "bootstrap/dist/css/bootstrap.min.css";

// Use the API base URL from the .env file.
const API_URL = process.env.REACT_APP_API_URL;

// Mapping of class id to actual class names.
const classNames = {
  8: "V",
  9: "VI",
  // Add more mappings as needed.
};

// Detailed summary component (shown in the side panel when a cell is clicked)
const AttendanceSummary = ({ date, token, teacherClassId }) => {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (date && teacherClassId) {
      axios
        .get(`${API_URL}/attendance/date/${date}/${teacherClassId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          const records = response.data;
          const newSummary = {
            presentCount: records.filter((r) => r.status === "present").length,
            absentCount: records.filter((r) => r.status === "absent").length,
            leaveCount: records.filter((r) => r.status === "leave").length,
            total: records.length,
          };
          setSummary(newSummary);
        })
        .catch((err) => console.error("Error fetching summary:", err));
    }
  }, [date, token, teacherClassId]);

  if (!summary) {
    return <div>Loading summary...</div>;
  }

  if (summary.total === 0) {
    return (
      <div className="alert alert-warning text-center mt-4">
        Attendance not marked for {moment(date).format("LL")}.
      </div>
    );
  }

  return (
    <div className="mt-4">
      <h4 className="text-center">
        Attendance Summary for {moment(date).format("LL")}
      </h4>
      <table className="table table-bordered table-hover mt-3">
        <thead className="thead-dark">
          <tr>
            <th>Status</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-success font-weight-bold">Present</td>
            <td>{summary.presentCount}</td>
          </tr>
          <tr>
            <td className="text-danger font-weight-bold">Absent</td>
            <td>{summary.absentCount}</td>
          </tr>
          <tr>
            <td className="text-warning font-weight-bold">Leave</td>
            <td>{summary.leaveCount}</td>
          </tr>
          <tr>
            <td className="font-weight-bold">Total</td>
            <td>{summary.total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

const Calendar = () => {
  // Set current month to the current date.
  const [currentMonth, setCurrentMonth] = useState(moment());
  const [attendanceData, setAttendanceData] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  const token = localStorage.getItem("token");

  // State to hold teacher's class details.
  const [teacherClassId, setTeacherClassId] = useState(null);
  const [teacherClassName, setTeacherClassName] = useState("");

  // Fetch teacher's incharge students to extract the class id.
  useEffect(() => {
    axios
      .get(`${API_URL}/incharges/students`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        const studentList = response.data.students;
        if (studentList && studentList.length > 0) {
          const clsId = Number(studentList[0].class_id);
          setTeacherClassId(clsId);
          setTeacherClassName(classNames[clsId] || `Class ${clsId}`);
        }
      })
      .catch((error) =>
        console.error("Error fetching incharge students:", error)
      );
  }, [token]);

  // When currentMonth changes, reset selectedDate to the first day of that month.
  useEffect(() => {
    setSelectedDate(currentMonth.clone().startOf("month").format("YYYY-MM-DD"));
  }, [currentMonth]);

  // Fetch monthly attendance for the teacher's class.
  useEffect(() => {
    const startOfMonth = currentMonth.clone().startOf("month");
    const endOfMonth = currentMonth.clone().endOf("month");
    const days = [];
    for (
      let m = startOfMonth.clone();
      m.isBefore(endOfMonth, "day") || m.isSame(endOfMonth, "day");
      m.add(1, "days")
    ) {
      days.push(m.clone());
    }

    const fetchAttendance = async () => {
      const attendancePromises = days.map((day) => {
        const dateStr = day.format("YYYY-MM-DD");
        const apiUrl = `${API_URL}/attendance/date/${dateStr}/${teacherClassId}`;
        return axios
          .get(apiUrl, { headers: { Authorization: `Bearer ${token}` } })
          .then((response) => {
            const records = response.data;
            const presentCount = records.filter((r) => r.status === "present").length;
            const absentCount = records.filter((r) => r.status === "absent").length;
            const leaveCount = records.filter((r) => r.status === "leave").length;
            return { dateStr, presentCount, absentCount, leaveCount };
          })
          .catch((error) => {
            console.error(`Error fetching attendance for ${dateStr}:`, error);
            return null;
          });
      });

      const responses = await Promise.all(attendancePromises);
      const newData = {};
      responses.forEach((item) => {
        if (item) {
          newData[item.dateStr] = {
            presentCount: item.presentCount,
            absentCount: item.absentCount,
            leaveCount: item.leaveCount,
          };
        }
      });
      setAttendanceData(newData);
    };

    if (teacherClassId) {
      fetchAttendance();
    }
  }, [currentMonth, token, teacherClassId]);

  // Fetch holiday data.
  useEffect(() => {
    axios
      .get(`${API_URL}/holidays`)
      .then((response) => setHolidays(response.data))
      .catch((error) => console.error("Error fetching holidays:", error));
  }, []);

  // Prepare the calendar grid.
  const startOfMonthClone = currentMonth.clone().startOf("month");
  const endOfMonthClone = currentMonth.clone().endOf("month");
  const startDay = startOfMonthClone.day();
  const totalDays = endOfMonthClone.date();
  const calendarCells = [];

  // Fill empty cells before the start of the month.
  for (let i = 0; i < startDay; i++) {
    calendarCells.push(null);
  }
  // Fill the cells for each day.
  for (let day = 1; day <= totalDays; day++) {
    calendarCells.push(moment(currentMonth).date(day));
  }

  // Helper to set cell background style.
  const getCellStyle = (cell, summary, holidayMatch) => {
    if (!holidayMatch && cell.isAfter(moment(), "day")) {
      return {};
    }
    if (holidayMatch) {
      return { backgroundColor: "#ffeeba" };
    }
    if (cell.day() === 0) {
      return { backgroundColor: "#cce5ff" };
    }
    if (summary) {
      const total = summary.presentCount + summary.absentCount + summary.leaveCount;
      return total > 0 ? { backgroundColor: "#d4edda" } : { backgroundColor: "#f8d7da" };
    }
    return { backgroundColor: "#e9ecef" };
  };

  return (
    <div className="container my-4">
      {/* Month Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button
          className="btn btn-outline-primary"
          onClick={() => setCurrentMonth(currentMonth.clone().subtract(1, "month"))}
        >
          Prev
        </button>
        <h3>{currentMonth.format("MMMM YYYY")}</h3>
        <button
          className="btn btn-outline-primary"
          onClick={() => setCurrentMonth(currentMonth.clone().add(1, "month"))}
        >
          Next
        </button>
      </div>

      <div className="row">
        {/* Calendar Grid */}
        <div className="col-md-8">
          <div
            className="d-grid border"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "2px",
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (dayName) => (
                <div
                  key={dayName}
                  className="text-center font-weight-bold p-2 border bg-light"
                >
                  {dayName}
                </div>
              )
            )}
            {calendarCells.map((cell, index) => {
              if (cell === null) {
                return (
                  <div
                    key={index}
                    className="border"
                    style={{ minHeight: "80px" }}
                  />
                );
              }
              const dateStr = cell.format("YYYY-MM-DD");
              const dayAttendance = attendanceData[dateStr];
              const holidayMatch = holidays.find(
                (holiday) =>
                  holiday.date === dateStr &&
                  holiday.class &&
                  holiday.class.id === teacherClassId
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
                if (dayAttendance) {
                  const total =
                    dayAttendance.presentCount +
                    dayAttendance.absentCount +
                    dayAttendance.leaveCount;
                  if (total > 0) {
                    cellContent = (
                      <div className="text-center">
                        <div>
                          <strong>{cell.date()}</strong>
                        </div>
                        <div
                          style={{ fontSize: "10px" }}
                          className="text-success"
                        >
                          P: {dayAttendance.presentCount}
                        </div>
                        <div
                          style={{ fontSize: "10px" }}
                          className="text-danger"
                        >
                          A: {dayAttendance.absentCount}
                        </div>
                        <div
                          style={{ fontSize: "10px" }}
                          className="text-warning"
                        >
                          L: {dayAttendance.leaveCount}
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
                } else {
                  cellContent = (
                    <div className="text-center text-danger">
                      <div>{cell.date()}</div>
                      <div style={{ fontSize: "10px" }}>Not Marked</div>
                    </div>
                  );
                }
              }

              const cellStyle = getCellStyle(cell, dayAttendance, holidayMatch);
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
        {/* Side Panel: Detailed Summary */}
        <div className="col-md-4">
          {selectedDate ? (
            holidays.find(
              (holiday) =>
                holiday.date === selectedDate &&
                holiday.class &&
                holiday.class.id === teacherClassId
            ) ? (
              <div className="alert alert-info mt-4 text-center">
                <h4>Holiday</h4>
                <p>
                  {
                    holidays.find(
                      (holiday) =>
                        holiday.date === selectedDate &&
                        holiday.class &&
                        holiday.class.id === teacherClassId
                    ).description
                  }
                </p>
              </div>
            ) : (
              <AttendanceSummary
                date={selectedDate}
                token={token}
                teacherClassId={teacherClassId}
              />
            )
          ) : (
            <div className="alert alert-info mt-4">
              Please select a date to view the summary.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
