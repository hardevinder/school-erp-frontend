import React, { useState, useEffect } from "react";
import api from "../api"; // Axios instance with auth headers
import Swal from "sweetalert2";

const TeacherLeaveRequests = ({ leaveUpdateTrigger }) => {
  const [leaveRequests, setLeaveRequests] = useState([]); // Store leave requests
  const token = localStorage.getItem("token"); // Get auth token

  // Fetch leave requests assigned to this teacher
  const fetchLeaveRequests = async () => {
    try {
      const response = await api.get("/leave", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeaveRequests(response.data);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
  };

  // Fetch leave requests on mount and whenever leaveUpdateTrigger changes.
  useEffect(() => {
    fetchLeaveRequests();
  }, [leaveUpdateTrigger]);

  // Accept leave request
  const acceptLeave = async (id) => {
    try {
      await api.put(
        `/leave/${id}`,
        { status: "accepted" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Swal.fire("Approved!", "Leave request has been approved.", "success");
      fetchLeaveRequests(); // Refresh list
    } catch (error) {
      console.error("Error accepting leave request:", error);
      Swal.fire("Error", "Failed to approve leave request.", "error");
    }
  };

  // Reject leave request
  const rejectLeave = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You are about to reject this leave request.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, reject it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.put(
            `/leave/${id}`,
            { status: "rejected" },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          Swal.fire("Rejected!", "Leave request has been rejected.", "success");
          fetchLeaveRequests(); // Refresh list
        } catch (error) {
          console.error("Error rejecting leave request:", error);
          Swal.fire("Error", "Failed to reject leave request.", "error");
        }
      }
    });
  };

  return (
    <div className="container mt-4">
      <h2>Pending Leave Requests</h2>
      {leaveRequests.length === 0 ? (
        <p>No pending leave requests.</p>
      ) : (
        <table className="table table-striped">
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              {/* <th>Class</th>
              <th>Section</th> */}
              <th>Date</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaveRequests.map((req, index) => (
              <tr key={req.id}>
                <td>{index + 1}</td>
                <td>{req.Student.name}</td>
                {/* <td>{req.Student.Class?.class_name || "N/A"}</td> */}
                {/* <td>{req.Student.section_id}</td> */}
                <td>{req.date}</td>
                <td>{req.reason}</td>
                <td>
                  <span
                    className={`badge ${
                      req.status === "pending"
                        ? "bg-warning"
                        : req.status === "accepted"
                        ? "bg-success"
                        : "bg-danger"
                    }`}
                  >
                    {req.status}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-success me-2"
                    onClick={() => acceptLeave(req.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => rejectLeave(req.id)}
                  >
                    Reject
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

export default TeacherLeaveRequests;
