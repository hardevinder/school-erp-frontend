import React, { useState, useEffect } from "react";
import api from "../api"; // Your custom Axios instance
import { Pie } from "react-chartjs-2";

const AttendanceSummaryByDate = () => {
  // Get today's date string in YYYY-MM-DD format
  const todayStr = new Date().toISOString().split("T")[0];
  
  // Set initial selected date to today
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [attendanceData, setAttendanceData] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch holiday data once on mount
  useEffect(() => {
    async function fetchHolidays() {
      try {
        const res = await api.get("/holidays");
        setHolidays(res.data);
      } catch (error) {
        console.error("Error fetching holidays:", error);
      }
    }
    fetchHolidays();
  }, []);

  // Determine if the selected date is in the future, is Sunday, or is a holiday
  const isFutureDate = selectedDate > todayStr;
  const isSunday = new Date(selectedDate).getDay() === 0;
  const holidayRecord = holidays.find((holiday) => holiday.date === selectedDate);

  // Fetch attendance summary if applicable
  useEffect(() => {
    async function fetchAttendance() {
      // Do not fetch attendance for future dates, holidays, or Sundays
      if (isFutureDate || holidayRecord || isSunday) {
        setAttendanceData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await api.get(`/attendance/summary/${selectedDate}`);
        setAttendanceData(res.data);
      } catch (error) {
        console.error("Error fetching attendance summary:", error);
        setAttendanceData(null);
      }
      setLoading(false);
    }
    if (selectedDate) {
      fetchAttendance();
    }
  }, [selectedDate, isFutureDate, holidayRecord, isSunday]);

  // Compute overall attendance totals if data exists
  let overallTotal = 0,
    overallAbsent = 0,
    overallLeaves = 0,
    overallPresent = 0;
  if (attendanceData && attendanceData.summary && attendanceData.summary.length > 0) {
    overallTotal = attendanceData.summary.reduce((acc, curr) => acc + curr.total, 0);
    overallAbsent = attendanceData.summary.reduce((acc, curr) => acc + curr.absent, 0);
    overallLeaves = attendanceData.summary.reduce((acc, curr) => acc + curr.leave, 0);
    overallPresent = overallTotal - overallAbsent - overallLeaves;
  }

  // Setup Pie chart data (only used when summary is available)
  const pieData = {
    labels: ["Present", "Absent", "Leaves"],
    datasets: [
      {
        data: [overallPresent, overallAbsent, overallLeaves],
        backgroundColor: ["#36A2EB", "#FF6384", "#FFCE56"],
      },
    ],
  };

  // Decide what to render based on the date conditions
  let content;
  if (loading) {
    content = <p>Loading summary...</p>;
  } else if (isFutureDate) {
    content = (
      <div>
        <h4>Future Date Selected: {selectedDate}</h4>
        <p>Attendance not available for future dates.</p>
      </div>
    );
  } else if (holidayRecord) {
    content = (
      <div>
        <h4>{selectedDate} - Holiday</h4>
        <p>
          Holiday for Class {holidayRecord.class.class_name}: {holidayRecord.description}
        </p>
      </div>
    );
  } else if (isSunday) {
    content = (
      <div>
        <h4>{selectedDate} - Sunday</h4>
        <p>Sunday: No attendance required.</p>
      </div>
    );
  } else if (attendanceData && attendanceData.summary && attendanceData.summary.length > 0) {
    content = (
      <div>
        <h4>Attendance Summary - Date: {attendanceData.date}</h4>
        <div className="row mb-4">
          <div className="col-md-8">
            <div className="row">
              <div className="col-md-6 mb-3">
                <div className="card text-white bg-secondary">
                  <div className="card-body text-center">
                    <h6 className="card-title">Total</h6>
                    <p className="card-text" style={{ fontSize: "1.5rem" }}>
                      {overallTotal}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-6 mb-3">
                <div className="card text-white bg-success">
                  <div className="card-body text-center">
                    <h6 className="card-title">Present</h6>
                    <p className="card-text" style={{ fontSize: "1.5rem" }}>
                      {overallPresent}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-md-6 mb-3">
                <div className="card text-white bg-danger">
                  <div className="card-body text-center">
                    <h6 className="card-title">Absent</h6>
                    <p className="card-text" style={{ fontSize: "1.5rem" }}>
                      {overallAbsent}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-6 mb-3">
                <div className="card text-white bg-warning">
                  <div className="card-body text-center">
                    <h6 className="card-title">Leaves</h6>
                    <p className="card-text" style={{ fontSize: "1.5rem" }}>
                      {overallLeaves}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 d-flex align-items-center">
            <div className="card w-100">
              <div className="card-body d-flex justify-content-center align-items-center">
                <div style={{ width: "300px", height: "300px" }}>
                  <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    content = <h4>Attendance not marked for {selectedDate}</h4>;
  }

  return (
    <div className="container mt-4">
      <h2>Attendance Summary by Date</h2>
      <div className="form-group mb-3">
        <label htmlFor="summaryDate">Select Date:</label>
        <input
          type="date"
          id="summaryDate"
          className="form-control"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={todayStr} // Disable future dates
        />
      </div>
      {content}
    </div>
  );
};

export default AttendanceSummaryByDate;
