// src/components/Dashboard.jsx
import React, { useState, useEffect } from "react";
import api from "../api";

// Charts
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Fetch attendance summary
  useEffect(() => {
    let mounted = true;
    async function fetchAttendanceSummary() {
      setLoading(true);
      try {
        const res = await api.get(`/attendance/summary/${selectedDate}`);
        if (mounted) setAttendanceSummary(res.data);
      } catch (err) {
        console.error("Error fetching attendance summary:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchAttendanceSummary();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  // Compute pie data
  let total = 0,
    absent = 0,
    leaves = 0,
    present = 0;

  if (attendanceSummary?.summary) {
    total = attendanceSummary.summary.reduce((a, c) => a + c.total, 0);
    absent = attendanceSummary.summary.reduce((a, c) => a + c.absent, 0);
    leaves = attendanceSummary.summary.reduce((a, c) => a + c.leave, 0);
    present = total - absent - leaves;
  }

  const pieData = {
    labels: ["Present", "Absent", "Leaves"],
    datasets: [
      {
        data: [present, absent, leaves],
        backgroundColor: ["#36A2EB", "#FF6384", "#FFCE56"],
      },
    ],
  };

  return (
    <div className="container-fluid px-3">
      {/* Page header (NOT a .navbar) */}
      <div className="dashboard-header bg-light px-3 py-2 mb-3 rounded">
        <h5 className="mb-0">Dashboard</h5>
      </div>

      {/* Date filter */}
      <div className="mb-4">
        <label htmlFor="summaryDate" className="form-label">
          Select Date:
        </label>
        <input
          id="summaryDate"
          type="date"
          className="form-control"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Loading attendance summary...</p>
      ) : attendanceSummary ? (
        <>
          <h6 className="mb-3">Overall Attendance — {attendanceSummary.date}</h6>

          <div className="row mb-4">
            <div className="col-md-8">
              {/* KPI Cards */}
              <div className="row">
                {[
                  { title: "Total", value: total, bg: "bg-secondary" },
                  { title: "Present", value: present, bg: "bg-success" },
                  { title: "Absent", value: absent, bg: "bg-danger" },
                  { title: "Leaves", value: leaves, bg: "bg-warning" },
                ].map((m, i) => (
                  <div className="col-md-6 mb-3" key={i}>
                    <div className={`card text-white ${m.bg}`}>
                      <div className="card-body text-center">
                        <h6>{m.title}</h6>
                        <p className="display-6">{m.value}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-md-4 d-flex align-items-center">
              <div className="card w-100">
                <div className="card-body d-flex justify-content-center">
                  <div style={{ width: 300, height: 300 }}>
                    <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Class & Section Breakdown */}
          <h6 className="mb-3">Class & Section Breakdown</h6>
          <div className="row">
            {attendanceSummary.summary.map((item) => {
              const pres = item.total - (item.absent + item.leave);
              return (
                <div
                  className="col-md-4 mb-3"
                  key={`${item.class_id}-${item.section_id}`}
                >
                  <div className="card border-primary h-100">
                    <div className="card-header bg-primary text-white">
                      Class {item.class_name} — Section {item.section_name}
                    </div>
                    <div className="card-body">
                      <p className="mb-1">Total: {item.total}</p>
                      <p className="mb-1">Present: {pres}</p>
                      <p className="mb-1">Absent: {item.absent}</p>
                      <p className="mb-0">Leaves: {item.leave}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p>No summary available for this date.</p>
      )}
    </div>
  );
}
