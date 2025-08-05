import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "../../styles/CollectFeePopup.css";
import api from "../../api"; // Axios instance for API calls
import Swal from "sweetalert2";

const CollectFeePopup = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState("admissionNumber");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [classList, setClassList] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [studentDetails, setStudentDetails] = useState(null);
  const [feeDetails, setFeeDetails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch classes on component mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await api.get("/classes");
        setClassList(response.data);
      } catch (error) {
        Swal.fire("Error", "Failed to fetch classes.", "error");
      }
    };
    fetchClasses();
  }, []);

  // Fetch students by selected class
  useEffect(() => {
    if (!selectedClass) return;

    const fetchStudents = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/students/class/${selectedClass}`);
        setStudents(response.data);
      } catch (error) {
        Swal.fire("Error", "Failed to fetch students.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudents();
  }, [selectedClass]);

  // Fetch student details and fee details
  const fetchFeeDetails = async (admissionNumber) => {
    setIsLoading(true);
    try {
      const studentResponse = await api.get(`/students/admission/${admissionNumber}`);
      const feeResponse = await api.get(`/fees/details/${admissionNumber}`);
      setStudentDetails(studentResponse.data);
      setFeeDetails(feeResponse.data); // Assuming backend provides fee details
    } catch (error) {
      Swal.fire("Error", "Failed to fetch student or fee details.", "error");
      setStudentDetails(null);
      setFeeDetails([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle student selection
  const handleStudentSelect = (studentId) => {
    const selected = students.find((student) => student.id === parseInt(studentId));
    setSelectedStudent(studentId);
    if (selected) {
      fetchFeeDetails(selected.admission_number);
    }
  };

  // Render fee details dynamically
  const renderFeeDetails = () => {
    if (!feeDetails || feeDetails.length === 0) return <p>No fee details available.</p>;

    return (
      <table className="table table-bordered mt-3">
        <thead>
          <tr>
            <th>Month</th>
            <th>Balance</th>
            <th>Concession</th>
            <th>Amount Received</th>
            <th>Van Fee</th>
          </tr>
        </thead>
        <tbody>
          {feeDetails.map((fee, index) => (
            <tr key={index}>
              <td>{fee.month}</td>
              <td>₹ {fee.balance}</td>
              <td>
                <input
                  type="number"
                  className="form-control"
                  name={`concession_${fee.month}`}
                  defaultValue={0}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="form-control"
                  name={`received_${fee.month}`}
                  defaultValue={0}
                />
              </td>
              <td>
                <input
                  type="number"
                  className="form-control"
                  name={`van_${fee.month}`}
                  defaultValue={0}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return ReactDOM.createPortal(
    <div className="popup-overlay">
      <div className="popup-container">
        <h3>Fee Collection</h3>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={activeTab === "admissionNumber" ? "active" : ""}
            onClick={() => setActiveTab("admissionNumber")}
          >
            Search by Admission Number
          </button>
          <button
            className={activeTab === "classAndName" ? "active" : ""}
            onClick={() => setActiveTab("classAndName")}
          >
            Search by Class and Name
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "admissionNumber" && (
          <div className="tab-content">
            <label>Enter Admission Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="Admission Number"
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
            />
            <button className="btn btn-primary mt-2" onClick={() => fetchFeeDetails(admissionNumber)}>
              Search
            </button>
            {isLoading && <p>Loading...</p>}
          </div>
        )}

        {activeTab === "classAndName" && (
          <div className="tab-content">
            <label>Select Class</label>
            <select
              className="form-control"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedStudent("");
                setStudentDetails(null);
              }}
            >
              <option value="">Select Class</option>
              {classList.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </select>

            {students.length > 0 && (
              <>
                <label className="mt-3">Select Student</label>
                <select
                  className="form-control"
                  value={selectedStudent}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                >
                  <option value="">Select Student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.admission_number})
                    </option>
                  ))}
                </select>
              </>
            )}
            {isLoading && <p>Loading...</p>}
          </div>
        )}

        {/* Fee Details */}
        {studentDetails && (
          <div className="fee-details mt-3">
            <h4>Student Details</h4>
            <p>Name: {studentDetails.name}</p>
            <p>Class: {studentDetails.class_name}</p>
            <p>Contact: {studentDetails.contact_number}</p>

            <h4>Fee Details</h4>
            {renderFeeDetails()}
          </div>
        )}

        <button className="btn btn-secondary mt-3" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.getElementById("portal-root")
  );
};

export default CollectFeePopup;
