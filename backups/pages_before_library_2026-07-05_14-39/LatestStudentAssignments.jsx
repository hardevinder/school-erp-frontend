import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL; // Ensure this variable is set in your .env

const LatestStudentAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState(null);

  // Retrieve token from localStorage
  const token = localStorage.getItem("token");

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const response = await axios.get(`${API_URL}/student-assignments/student`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log("API Response for student assignments:", response.data);
        // Sort the assignments by createdAt and take the latest three
        const sorted = (response.data.assignments || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3);
        setAssignments(sorted);
      } catch (err) {
        console.error("Error fetching assignments:", err);
        setError("Error fetching assignments");
      }
    };

    fetchAssignments();
  }, [token]);

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  return (
    <div className="mb-5">
      <h3>Latest Assignments</h3>
      {assignments.length === 0 ? (
        <p>No assignments available.</p>
      ) : (
        <div className="row">
          {assignments.map((a) => (
            <div key={a.id} className="col-md-4 mb-3">
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">{a.title}</h5>
                  <p className="card-text">{a.content}</p>
                </div>
                <div className="card-footer">
                  <small className="text-muted">
                    {new Date(a.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LatestStudentAssignments;
