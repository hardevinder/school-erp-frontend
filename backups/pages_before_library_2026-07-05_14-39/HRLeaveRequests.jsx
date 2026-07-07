import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

export default function HRLeaveRequests() {
  const [requests, setRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLeaveRequests();
    fetchLeaveTypes();
  }, [statusFilter]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/employee-leave-requests/all", {
        params: { status: statusFilter },
      });
      setRequests(res.data.data || []);
    } catch {
      Swal.fire("Error", "Could not load leave requests", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveTypes = async () => {
    try {
      const res = await api.get("/employee-leave-types");
      setLeaveTypes(res.data.data || []);
    } catch {
      Swal.fire("Error", "Could not load leave types", "error");
    }
  };

  const handleAction = async (id, action) => {
    const { value: remarks } = await Swal.fire({
      title: `${action === "approved" ? "Approve" : "Reject"} Leave?`,
      input: "textarea",
      inputLabel: "Remarks (optional)",
      showCancelButton: true,
      confirmButtonText: action === "approved" ? "Approve" : "Reject",
    });

    if (remarks === undefined) return;

    try {
      await api.patch(`/employee-leave-requests/${id}/status`, {
        status: action,
        remarks,
      });
      Swal.fire("Success", `Leave request ${action}`, "success");
      fetchLeaveRequests();
    } catch (err) {
      Swal.fire("Error", err.response?.data?.error || "Operation failed", "error");
    }
  };

  const getTypeName = (id) => {
    return leaveTypes.find((lt) => lt.id === id)?.name || "-";
  };

  const getEmployeeInfo = (request) => {
    const emp = request.employee;
    return emp ? `${emp.name} (${emp.department?.name || "No Dept"})` : "—";
  };

  return (
    <div className="container my-4">
      <h3>Employee Leave Requests (HR)</h3>

      <div className="mb-3 d-flex gap-3">
        <label>Status Filter:</label>
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-outline-secondary"}`}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : requests.length === 0 ? (
        <p>No {statusFilter} leave requests found.</p>
      ) : (
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>#</th>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>Date Range</th>
              <th>Reason</th>
              <th>Without Pay</th>
              <th>Status</th>
              {statusFilter === "pending" && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {requests.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{getEmployeeInfo(r)}</td>
                <td>{getTypeName(r.leave_type_id)}</td>
                <td>{r.start_date} ↔ {r.end_date}</td>
                <td>{r.reason || "—"}</td>
                <td>{r.is_without_pay ? "Yes" : "No"}</td>
                <td>
                  <span
                    className={`badge ${
                      r.status === "approved"
                        ? "bg-success"
                        : r.status === "rejected"
                        ? "bg-danger"
                        : "bg-warning text-dark"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                {statusFilter === "pending" && (
                  <td>
                    <button className="btn btn-sm btn-success me-1" onClick={() => handleAction(r.id, "approved")}>
                      Approve
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleAction(r.id, "rejected")}>
                      Reject
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
