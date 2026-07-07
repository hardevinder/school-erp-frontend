import React, { useState } from "react";
import MarkAttendance from "./MarkAttendance"; // your mark attendance component
import Calendar from "./Calendar"; // your calendar/summary component

const AttendanceTabs = () => {
  const [activeTab, setActiveTab] = useState("mark");

  return (
    <div className="container mt-4">
      <div className="btn-group mb-3">
        <button
          className={`btn ${activeTab === "mark" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setActiveTab("mark")}
        >
          Mark Attendance
        </button>
        <button
          className={`btn ${activeTab === "view" ? "btn-primary" : "btn-outline-primary"}`}
          onClick={() => setActiveTab("view")}
        >
          Attendance Summary
        </button>
      </div>

      <div>
        {activeTab === "mark" && <MarkAttendance />}
        {activeTab === "view" && <Calendar />}
      </div>
    </div>
  );
};

export default AttendanceTabs;
