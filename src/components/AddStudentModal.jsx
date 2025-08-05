// src/components/AddStudentModal.jsx
import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Tabs, Tab } from "react-bootstrap";
import api from "../api";
import Swal from "sweetalert2";

export default function AddStudentModal({
  show,
  onHide,
  classes,
  sections,
  existingUsernames,
  onSave,
}) {
  const [activeTab, setActiveTab] = useState("className");

  // States for Class & Name tab
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  // States for Admission Number tab
  const [admissionInput, setAdmissionInput] = useState("");
  const [fetchedStudent, setFetchedStudent] = useState(null);

  // Password state (shared)
  const [password, setPassword] = useState("");

  // Fetch & filter students when Class/Section change
  useEffect(() => {
    if (activeTab === "className" && selectedClass && selectedSection) {
      api
        .get("/students", {
          params: { class_id: selectedClass, section_id: selectedSection },
        })
        .then(({ data }) => {
          const filtered = data.filter(
            (s) => !existingUsernames.includes(String(s.admission_number))
          );
          filtered.sort((a, b) => a.name.localeCompare(b.name));
          setStudents(filtered);
          setSelectedStudentId("");
        })
        .catch((err) => {
          console.error(err);
          Swal.fire("Error", "Failed to load students.", "error");
        });
    } else if (activeTab === "className") {
      setStudents([]);
      setSelectedStudentId("");
    }
  }, [activeTab, selectedClass, selectedSection, existingUsernames]);

  // Search by Admission Number
  const handleAdmissionSearch = async () => {
    const admission = admissionInput.trim();
    if (!admission) return;
    try {
      const { data } = await api.get(`/students/admission/${admission}`);
      if (existingUsernames.includes(String(data.admission_number))) {
        return Swal.fire(
          "Info",
          "This student already has an account.",
          "info"
        );
      }
      setFetchedStudent(data);
      setSelectedStudentId(String(data.id));
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Student not found.", "error");
      setFetchedStudent(null);
      setSelectedStudentId("");
    }
  };

  // Determine selected student object
  const student =
    activeTab === "admission"
      ? fetchedStudent
      : students.find((s) => String(s.id) === selectedStudentId);

  // Submit handler
  const handleSubmit = () => {
    if (!student || !password.trim()) return;
    onSave({
      name: student.name,
      username: student.admission_number,
      email: student.email,
      password,
      roles: ["student"],
      class_id: activeTab === "admission" ? student.class_id : Number(selectedClass),
      section_id: activeTab === "admission" ? student.section_id : Number(selectedSection),
    });
  };

  // Reset tab-specific states on tab change
  const handleTabSelect = (key) => {
    setActiveTab(key);
    setPassword("");
    setFetchedStudent(null);
    setAdmissionInput("");
    setSelectedClass("");
    setSelectedSection("");
    setStudents([]);
    setSelectedStudentId("");
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>New Student Account</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs activeKey={activeTab} onSelect={handleTabSelect} className="mb-3">
          <Tab eventKey="className" title="By Class & Name">
            <Form.Group className="mb-3">
              <Form.Label>Class</Form.Label>
              <Form.Select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Section</Form.Label>
              <Form.Select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedClass}
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            {students.length > 0 && (
              <Form.Group className="mb-3">
                <Form.Label>Student</Form.Label>
                <Form.Select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">Select Student</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.admission_number})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            )}
          </Tab>

          <Tab eventKey="admission" title="By Admission No.">
            <Form.Group className="mb-3">
              <Form.Label>Admission Number</Form.Label>
              <div className="d-flex">
                <Form.Control
                  type="text"
                  placeholder="Enter admission number"
                  value={admissionInput}
                  onChange={(e) => setAdmissionInput(e.target.value)}
                />
                <Button variant="primary" onClick={handleAdmissionSearch} className="ms-2">
                  Search
                </Button>
              </div>
            </Form.Group>
          </Tab>
        </Tabs>

        {student && (
          <>
            <Form.Group className="mb-2">
              <Form.Control value={student.name} disabled />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Control value={student.admission_number} disabled />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Form.Group>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={handleSubmit}
          disabled={!student || !password.trim()}
        >
          Create Account
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
