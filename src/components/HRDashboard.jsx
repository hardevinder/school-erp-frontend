// src/components/HRDashboard.jsx
import React from "react";

export default function HRDashboard() {
  return (
    <div className="container-fluid px-3">
      {/* Optional page header (NOT a .navbar) */}
      <div className="dashboard-header bg-light px-3 py-2 mb-3 rounded">
        <h5 className="mb-0">HR Dashboard</h5>
      </div>

      {/* ✅ Put your HR dashboard widgets/cards here */}
      <div className="row g-3">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header bg-primary text-white">Employees</div>
            <div className="card-body">
              <p className="mb-1">Total Employees: —</p>
              <p className="mb-1">Active: —</p>
              <p className="mb-0">On Leave Today: —</p>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header bg-info text-white">Leave Requests</div>
            <div className="card-body">
              <p className="mb-1">Pending: —</p>
              <p className="mb-1">Approved (7 days): —</p>
              <p className="mb-0">Rejected (7 days): —</p>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header bg-success text-white">Attendance</div>
            <div className="card-body">
              <p className="mb-1">Present Today: —</p>
              <p className="mb-1">Absent Today: —</p>
              <p className="mb-0">Late/Short Leave: —</p>
            </div>
          </div>
        </div>
      </div>

      {/* More sections/charts/tables if needed */}
    </div>
  );
}
