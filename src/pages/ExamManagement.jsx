import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Button, Modal, Form, Table, Badge } from "react-bootstrap";

const ExamManagement = () => {
  const [exams, setExams] = useState([]);
  const [terms, setTerms] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    term_id: "",
    start_date: "",
    end_date: "",
    exam_type: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const examRes = await api.get("/exams");
      const termRes = await api.get("/terms");
      setExams(examRes.data || []);
      setTerms(termRes.data || []);
    } catch (err) {
      console.error("Error loading exams/terms", err);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const { id, ...data } = formData;

    if (!data.name || !data.term_id || !data.start_date || !data.end_date || !data.exam_type) {
      return Swal.fire("Validation", "All fields are required", "warning");
    }

    try {
      if (id) {
        await api.put(`/exams/${id}`, data);
        Swal.fire("Updated", "Exam updated successfully", "success");
      } else {
        await api.post("/exams", data);
        Swal.fire("Added", "Exam added successfully", "success");
      }

      setShowModal(false);
      setFormData({ id: null, name: "", term_id: "", start_date: "", end_date: "", exam_type: "" });
      fetchData();
    } catch (err) {
      console.error("Error saving exam", err);
      Swal.fire("Error", err?.response?.data?.error || "Could not save exam", "error");
    }
  };

  const handleEdit = (exam) => {
    setFormData({
      id: exam.id,
      name: exam.name,
      term_id: exam.term_id,
      start_date: exam.start_date,
      end_date: exam.end_date,
      exam_type: exam.exam_type,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Delete Exam?",
      text: "This action cannot be undone.",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (confirm.isConfirmed) {
      try {
        await api.delete(`/exams/${id}`);
        fetchData();
      } catch (err) {
        Swal.fire("Error", err?.response?.data?.error || "Failed to delete", "error");
      }
    }
  };

  const toggleLock = async (exam) => {
    const confirm = await Swal.fire({
      title: exam.is_locked ? "Unlock Exam?" : "Lock Exam?",
      text: exam.is_locked
        ? "You can make changes after unlocking."
        : "This will prevent any changes to this exam.",
      showCancelButton: true,
      confirmButtonText: exam.is_locked ? "Unlock" : "Lock",
    });

    if (confirm.isConfirmed) {
      try {
        await api.post("/exams/lock", {
          exam_id: exam.id,
          lock: !exam.is_locked,
        });
        fetchData();
      } catch (err) {
        Swal.fire("Error", err?.response?.data?.error || "Failed to toggle lock", "error");
      }
    }
  };

  return (
    <div className="container mt-4">
      <h4>📝 Exam Management</h4>
      <Button className="mb-3" onClick={() => setShowModal(true)}>
        ➕ Add Exam
      </Button>

      <Table bordered hover>
        <thead>
          <tr>
            <th>Name</th>
            <th>Term</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Type</th>
            <th>Locked?</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <tr key={exam.id}>
              <td>{exam.name}</td>
              <td>{exam.term?.name}</td>
              <td>{exam.start_date}</td>
              <td>{exam.end_date}</td>
              <td>{exam.exam_type}</td>
              <td>
                {exam.is_locked ? (
                  <Badge bg="danger">Locked</Badge>
                ) : (
                  <Badge bg="success">Unlocked</Badge>
                )}
              </td>
              <td>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleLock(exam)}
                  className="me-1"
                >
                  {exam.is_locked ? "Unlock" : "Lock"}
                </Button>
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => handleEdit(exam)}
                  disabled={exam.is_locked}
                  className="me-1"
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(exam.id)}
                  disabled={exam.is_locked}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{formData.id ? "Edit Exam" : "Add Exam"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>Exam Name</Form.Label>
            <Form.Control
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              placeholder="e.g., PT-1, Half-Yearly"
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Term</Form.Label>
            <Form.Select name="term_id" value={formData.term_id} onChange={handleFormChange}>
              <option value="">Select Term</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Start Date</Form.Label>
            <Form.Control
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleFormChange}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>End Date</Form.Label>
            <Form.Control
              type="date"
              name="end_date"
              value={formData.end_date}
              onChange={handleFormChange}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Exam Type</Form.Label>
            <Form.Control
              name="exam_type"
              value={formData.exam_type}
              onChange={handleFormChange}
              placeholder="e.g., Written, Practical"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{formData.id ? "Update" : "Save"}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamManagement;
