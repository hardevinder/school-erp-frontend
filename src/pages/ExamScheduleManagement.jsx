import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button, Form } from "react-bootstrap";

const ExamScheduleManagement = () => {
  const [schedules, setSchedules] = useState([]);
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({ exam_id: "", class_id: "", section_id: "" });

  const [formData, setFormData] = useState({
    id: null,
    exam_id: "",
    class_id: "",
    section_id: "",
    subject_id: "",
    exam_date: "",
    start_time: "",
    end_time: "",
  });

  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [filters]);

  const fetchDropdowns = async () => {
    try {
      const [examRes, classRes, sectionRes, subjectRes] = await Promise.all([
        api.get("/exams"),
        api.get("/classes"),
        api.get("/sections"),
        api.get("/subjects"),
      ]);
      setExams(examRes.data || []);
      setClasses(classRes.data || []);
      setSections(sectionRes.data || []);
      setSubjects(subjectRes.data.subjects || subjectRes.data || []);
    } catch (err) {
      Swal.fire("Error", "Failed to load dropdowns", "error");
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await api.get("/exam-schedules", { params: filters });
      setSchedules(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to fetch schedules", "error");
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const {
      exam_id, class_id, section_id, subject_id, exam_date, start_time, end_time, id,
    } = formData;

    if (!exam_id || !class_id || !section_id || !subject_id || !exam_date || !start_time || !end_time) {
      return Swal.fire("Validation Error", "Please fill all required fields", "warning");
    }

    try {
      if (id) {
        await api.put(`/exam-schedules/${id}`, formData);
        Swal.fire("Updated", "Schedule updated successfully", "success");
      } else {
        await api.post("/exam-schedules", formData);
        Swal.fire("Success", "Schedule created successfully", "success");
      }
      setShowModal(false);
      fetchSchedules();
    } catch (err) {
      Swal.fire("Error", "Failed to save schedule", "error");
    }
  };

  const handleEdit = (schedule) => {
    setFormData(schedule);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the schedule.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/exam-schedules/${id}`);
        Swal.fire("Deleted", "Schedule deleted.", "success");
        fetchSchedules();
      } catch {
        Swal.fire("Error", "Failed to delete schedule", "error");
      }
    }
  };

  const handleExport = async () => {
  try {
    const response = await api.get("/exam-schedules/export", {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "ExamSchedules.xlsx"); // File name
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error("Export failed:", error);
    Swal.fire("Error", "Failed to export Excel", "error");
  }
};


  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const form = new FormData();
    form.append("file", file);

    try {
      await api.post("/exam-schedules/import", form);
      Swal.fire("Success", "Import completed", "success");
      fetchSchedules();
    } catch {
      Swal.fire("Error", "Failed to import file", "error");
    }
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="container mt-4">
      <h2>📘 Exam Schedule Management</h2>

      {/* Filter Card */}
      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">Filter</h5>
          <div className="row">
            <div className="col-md-4">
              <label>Exam</label>
              <Form.Select name="exam_id" value={filters.exam_id} onChange={handleFilterChange}>
                <option value="">All Exams</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-4">
              <label>Class</label>
              <Form.Select name="class_id" value={filters.class_id} onChange={handleFilterChange}>
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.class_name}</option>
                ))}
              </Form.Select>
            </div>
            <div className="col-md-4">
              <label>Section</label>
              <Form.Select name="section_id" value={filters.section_id} onChange={handleFilterChange}>
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.section_name}</option>
                ))}
              </Form.Select>
            </div>
          </div>
        </div>
      </div>

      {/* Import Export Actions */}
      <div className="d-flex justify-content-between mb-3">
        <Button variant="primary" onClick={() => setShowModal(true)}>➕ Add Schedule</Button>
        <div>
          <Button variant="outline-success" className="me-2" onClick={handleExport}>⬇️ Export Excel</Button>
          <Button variant="outline-primary" onClick={handleImportClick}>⬆️ Import Excel</Button>
          <Form.Control
            type="file"
            accept=".xlsx"
            ref={fileInputRef}
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body">
          <h5 className="card-title">Scheduled Exams</h5>
          {schedules.length > 0 ? (
            <table className="table table-bordered table-striped">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Exam</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>{s.exam?.name}</td>
                    <td>{s.class?.class_name}</td>
                    <td>{s.section?.section_name}</td>
                    <td>{s.subject?.name}</td>
                    <td>{s.exam_date}</td>
                    <td>{s.start_time}</td>
                    <td>{s.end_time}</td>
                    <td>
                      <Button variant="warning" size="sm" className="me-2" onClick={() => handleEdit(s)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(s.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p>No schedules found.</p>}
        </div>
      </div>

      {/* Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{formData.id ? "✏️ Edit Schedule" : "➕ Add Schedule"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>Exam</Form.Label>
            <Form.Select name="exam_id" value={formData.exam_id} onChange={handleFormChange}>
              <option value="">Select Exam</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Class</Form.Label>
            <Form.Select name="class_id" value={formData.class_id} onChange={handleFormChange}>
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.class_name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Section</Form.Label>
            <Form.Select name="section_id" value={formData.section_id} onChange={handleFormChange}>
              <option value="">Select Section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.section_name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Subject</Form.Label>
            <Form.Select name="subject_id" value={formData.subject_id} onChange={handleFormChange}>
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Exam Date</Form.Label>
            <Form.Control type="date" name="exam_date" value={formData.exam_date} onChange={handleFormChange} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Start Time</Form.Label>
            <Form.Control type="time" name="start_time" value={formData.start_time} onChange={handleFormChange} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>End Time</Form.Label>
            <Form.Control type="time" name="end_time" value={formData.end_time} onChange={handleFormChange} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>
            {formData.id ? "Update" : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ExamScheduleManagement;
