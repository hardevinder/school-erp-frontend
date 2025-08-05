import React, { useState, useEffect } from 'react';
import axios from 'axios';
import socket from '../socket'; // Adjust the path as needed

const API_URL = process.env.REACT_APP_API_URL; // Dynamic API URL from .env

const StudentAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState('');

  // Retrieve the token from localStorage
  const token = localStorage.getItem("token");

  const fetchAssignments = async () => {
    try {
      const response = await axios.get(`${API_URL}/student-assignments/student`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssignments(response.data.assignments || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Error fetching assignments');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [token]);

  useEffect(() => {
    // Listen for real-time assignment events and refresh the assignment list when received
    socket.on('assignmentAssigned', () => {
      console.log("assignmentAssigned event received");
      fetchAssignments();
    });
    socket.on('assignmentUpdated', () => {
      console.log("assignmentUpdated event received");
      fetchAssignments();
    });
    socket.on('assignmentDeleted', () => {
      console.log("assignmentDeleted event received");
      fetchAssignments();
    });

    // Cleanup socket listeners on unmount
    return () => {
      socket.off('assignmentAssigned');
      socket.off('assignmentUpdated');
      socket.off('assignmentDeleted');
    };
  }, []);

  // Filter assignments based on search text (title or content)
  const filteredAssignments = assignments.filter((assignment) => {
    const searchLower = searchText.toLowerCase();
    return (
      assignment.title.toLowerCase().includes(searchLower) ||
      assignment.content.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border" role="status" aria-hidden="true"></div>
        <span className="ms-2">Loading assignments...</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger text-center mt-5">{error}</div>;
  }

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">Your Assignments</h1>

      {/* Search Input */}
      <div className="mb-4">
        <input 
          type="text" 
          className="form-control" 
          placeholder="Search assignments..." 
          value={searchText} 
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {filteredAssignments.length === 0 ? (
        <p className="text-center">No assignments found.</p>
      ) : (
        <div className="row">
          {filteredAssignments.map((assignment) => {
            // Assuming each assignment includes a StudentAssignments array.
            const studentAssignment = assignment.StudentAssignments && assignment.StudentAssignments[0];
            return (
              <div key={assignment.id} className="col-md-6 mb-4">
                <div className="card shadow-sm h-100">
                  <div className="card-body d-flex flex-column">
                    <h2 className="card-title">{assignment.title}</h2>
                    <p className="card-text">{assignment.content}</p>
                    {assignment.youtubeUrl && (
                      <a
                        href={assignment.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary mb-2"
                      >
                        Watch Video Explanation
                      </a>
                    )}
                    <p className="text-muted">
                      Created: {new Date(assignment.createdAt).toLocaleDateString()} | Updated: {new Date(assignment.updatedAt).toLocaleDateString()}
                    </p>
                    {studentAssignment && (
                      <>
                        <p className="text-danger">
                          Due Date:{" "}
                          {studentAssignment.dueDate
                            ? new Date(studentAssignment.dueDate).toLocaleDateString()
                            : 'N/A'}
                        </p>
                        <p className="text-warning">
                          Status: {studentAssignment.status ? studentAssignment.status : 'Unknown'}
                        </p>
                        <p className="text-info">
                          Grade: {studentAssignment.grade !== null ? studentAssignment.grade : 'Not graded yet'}
                        </p>
                        <p className="text-info">
                          Remarks: {studentAssignment.remarks ? studentAssignment.remarks : 'No remarks available yet'}
                        </p>
                      </>
                    )}
                    {assignment.AssignmentFiles && assignment.AssignmentFiles.length > 0 && (
                      <div>
                        <h5>Attached Files:</h5>
                        <ul className="list-unstyled">
                          {assignment.AssignmentFiles.map((file) => (
                            <li key={file.id}>
                              <a 
                                href={file.filePath} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="btn btn-link"
                              >
                                {file.fileName}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentAssignments;
