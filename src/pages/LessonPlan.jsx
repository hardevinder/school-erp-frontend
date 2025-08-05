import React, { useState, useEffect } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import { Form, Button, Table, Modal, Row, Col, Badge, Card } from "react-bootstrap";

const LessonPlanCRUD = () => {
  const [lessonPlans, setLessonPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedLessonPlan, setSelectedLessonPlan] = useState(null);
  
  const [searchClass, setSearchClass] = useState("");
  const [searchSubject, setSearchSubject] = useState("");

  const [formData, setFormData] = useState({
    classIds: [],
    subjectId: "",
    weekNumber: "",
    startDate: "",
    endDate: "",
    topic: "",
    objectives: "",
    activities: "",
    resources: "",
    homework: "",
    assessmentMethods: "",
    status: "Pending",
    remarks: "",
  });
  
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Helper to format date
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();

  // Determine badge color based on status
  const getStatusBadgeVariant = (status) => {
    switch(status) {
      case "Pending": return "warning";
      case "In Progress": return "primary";
      case "Completed": return "success";
      default: return "secondary";
    }
  };

  // Fetch lesson plans
  const fetchLessonPlans = async () => {
    try {
      const res = await api.get("/lesson-plans");
      setLessonPlans(res.data);
    } catch (error) {
      Swal.fire("Error", "Failed to fetch lesson plans", "error");
    }
  };

  // Fetch assignments to get unique classes and subjects
  const fetchAssignments = async () => {
    try {
      const res = await api.get("/class-subject-teachers/teacher/class-subjects");
      const assignments = res.data.assignments;
      // Deduplicate classes
      const uniqueClasses = Array.from(new Set(assignments.map(item => item.class.id)))
        .map(id => assignments.find(item => item.class.id === id).class);
      // Deduplicate subjects
      const uniqueSubjects = Array.from(new Set(assignments.map(item => item.subject.id)))
        .map(id => assignments.find(item => item.subject.id === id).subject);
      setClasses(uniqueClasses);
      setSubjects(uniqueSubjects);
    } catch (error) {
      Swal.fire("Error", "Failed to fetch class-subject assignments", "error");
    }
  };

  useEffect(() => {
    fetchLessonPlans();
    fetchAssignments();
  }, []);

  // Handle checkbox change for multiple classes
  const handleCheckboxChange = (e) => {
    const value = parseInt(e.target.value);
    let newClassIds = [...formData.classIds];
    if (e.target.checked) {
      newClassIds.push(value);
    } else {
      newClassIds = newClassIds.filter(id => id !== value);
    }
    setFormData({ ...formData, classIds: newClassIds });
    console.log("Updated classIds:", newClassIds);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Form Data before submission:", formData);
    
    // Client-side validation to ensure at least one class is selected
    if (!formData.classIds || formData.classIds.length === 0) {
      Swal.fire("Error", "Please select at least one class.", "error");
      return;
    }

    try {
      if (editing) {
        await api.put(`/lesson-plans/${editId}`, formData);
        Swal.fire("Success", "Lesson plan updated successfully", "success");
      } else {
        await api.post("/lesson-plans", formData);
        Swal.fire("Success", "Lesson plan created successfully", "success");
      }
      // Reset the form after submission
      setFormData({
        classIds: [],
        subjectId: "",
        weekNumber: "",
        startDate: "",
        endDate: "",
        topic: "",
        objectives: "",
        activities: "",
        resources: "",
        homework: "",
        assessmentMethods: "",
        status: "Pending",
        remarks: "",
      });
      setEditing(false);
      setEditId(null);
      setShowModal(false);
      fetchLessonPlans();
    } catch (error) {
      console.error("Error saving lesson plan:", error);
      Swal.fire("Error", "Failed to save lesson plan", "error");
    }
  };

  // Open modal for creating a new lesson plan
  const handleCreateClick = () => {
    setEditing(false);
    setFormData({
      classIds: [],
      subjectId: "",
      weekNumber: "",
      startDate: "",
      endDate: "",
      topic: "",
      objectives: "",
      activities: "",
      resources: "",
      homework: "",
      assessmentMethods: "",
      status: "Pending",
      remarks: "",
    });
    setShowModal(true);
  };

  // Open modal for editing a lesson plan
  const handleEditClick = (plan) => {
    setEditing(true);
    setEditId(plan.id);
    // Ensure we always set an array even if plan.classIds is null
    const selectedClassIds = plan.Classes && plan.Classes.length > 0 
      ? plan.Classes.map(cls => cls.id)
      : (plan.classIds || []);
    setFormData({
      classIds: selectedClassIds,
      subjectId: plan.Subject ? plan.Subject.id : plan.subjectId,
      weekNumber: plan.weekNumber,
      startDate: plan.startDate.slice(0, 10),
      endDate: plan.endDate.slice(0, 10),
      topic: plan.topic,
      objectives: plan.objectives || "",
      activities: plan.activities || "",
      resources: plan.resources || "",
      homework: plan.homework || "",
      assessmentMethods: plan.assessmentMethods || "",
      status: plan.status,
      remarks: plan.remarks || "",
    });
    setShowModal(true);
  };

  // New function to handle publishing/unpublishing a lesson plan
  const handlePublishToggle = async (plan) => {
    try {
      const newPublishStatus = !plan.publish;
      await api.put(`/lesson-plans/${plan.id}`, { publish: newPublishStatus });
      Swal.fire("Success", `Lesson plan ${newPublishStatus ? "published" : "unpublished"} successfully`, "success");
      fetchLessonPlans();
    } catch (error) {
      console.error("Error updating publish status:", error);
      Swal.fire("Error", "Failed to update publish status", "error");
    }
  };

  // Delete a lesson plan
  const handleDelete = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will delete the lesson plan permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/lesson-plans/${id}`);
          Swal.fire("Deleted!", "Lesson plan has been deleted.", "success");
          fetchLessonPlans();
        } catch (error) {
          Swal.fire("Error", "Failed to delete lesson plan", "error");
        }
      }
    });
  };

  // Helper function to get class names from plan
  const getClassNames = (plan) => {
    if (plan.Classes && plan.Classes.length > 0) {
      return plan.Classes.map(cls => cls.class_name).join(", ");
    }
    return (plan.classIds || [])
      .map(id => {
        const cls = classes.find(c => c.id === id);
        return cls ? cls.class_name : id;
      })
      .join(", ");
  };

  // Helper function to get subject name from plan
  const getSubjectName = (plan) => {
    if (plan.Subject && plan.Subject.name) {
      return plan.Subject.name;
    }
    const subject = subjects.find(s => s.id === plan.subjectId);
    return subject ? subject.name : plan.subjectId;
  };

  // Filter lesson plans based on search criteria
  const filteredLessonPlans = lessonPlans.filter(plan => {
    let matchesClass = true;
    let matchesSubject = true;

    if (searchClass) {
      const searchClassId = parseInt(searchClass);
      matchesClass = (plan.classIds && plan.classIds.includes(searchClassId)) ||
        (plan.Classes && plan.Classes.some(cls => cls.id === searchClassId));
    }

    if (searchSubject) {
      const searchSubjectId = parseInt(searchSubject);
      matchesSubject = (plan.subjectId && plan.subjectId === searchSubjectId) ||
        (plan.Subject && plan.Subject.id === searchSubjectId);
    }

    return matchesClass && matchesSubject;
  });

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Lesson Plans</h1>
      
      {/* Search Filters */}
      <Row className="mb-3">
        <Col md={4}>
          <Form.Group controlId="searchClass">
            <Form.Label>Search by Class</Form.Label>
            <Form.Control
              as="select"
              value={searchClass}
              onChange={(e) => setSearchClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="searchSubject">
            <Form.Label>Search by Subject</Form.Label>
            <Form.Control
              as="select"
              value={searchSubject}
              onChange={(e) => setSearchSubject(e.target.value)}
            >
              <option value="">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        </Col>
      </Row>
      
      <Row>
        <Col md={8}>
          <Button variant="primary" onClick={handleCreateClick}>
            Create New Lesson Plan
          </Button>

          {/* Scrollable table container */}
          <div className="table-responsive" style={{ maxHeight: "400px", overflowY: "auto" }}>
            <Table striped bordered hover className="mt-4">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Class</th>
                  <th>Subject</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  {/* <th>Week No.</th> */}
                  <th>Topic</th>
                  <th>Status</th>
                  <th>Actions</th>
                  <th>View</th>
                </tr>
              </thead>
              <tbody>
                {filteredLessonPlans.map(plan => (
                  <tr key={plan.id}>
                    <td>{plan.id}</td>
                    <td>{getClassNames(plan)}</td>
                    <td>{getSubjectName(plan)}</td>
                    <td>{formatDate(plan.startDate)}</td>
                    <td>{formatDate(plan.endDate)}</td>
                    {/* <td>{plan.weekNumber}</td> */}
                    <td>{plan.topic}</td>
                    <td>
                      <Badge variant={getStatusBadgeVariant(plan.status)}>
                        {plan.status}
                      </Badge>
                    </td>
                    <td>
                      {/* Publish button toggles publish state */}
                      <Button 
                        variant={plan.publish ? "success" : "secondary"} 
                        size="sm" 
                        onClick={() => handlePublishToggle(plan)}
                      >
                        {plan.publish ? "Unpublish" : "Publish"}
                      </Button>{" "}
                      <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={() => handleDelete(plan.id)}
                      >
                        Delete
                      </Button>
                    </td>
                    <td>
                      <Button variant="info" size="sm" onClick={() => setSelectedLessonPlan(plan)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Col>
        <Col md={4}>
          {selectedLessonPlan ? (
            <Card className="shadow-sm">
              <Card.Header className="bg-info text-white">
                Lesson Plan Details
              </Card.Header>
              <Card.Body>
                <p><strong>ID:</strong> {selectedLessonPlan.id}</p>
                <p><strong>Topic:</strong> {selectedLessonPlan.topic}</p>
                <p><strong>Class:</strong> {getClassNames(selectedLessonPlan)}</p>
                <p><strong>Subject:</strong> {getSubjectName(selectedLessonPlan)}</p>
                <p><strong>Week Number:</strong> {selectedLessonPlan.weekNumber}</p>
                <p><strong>Start Date:</strong> {formatDate(selectedLessonPlan.startDate)}</p>
                <p><strong>End Date:</strong> {formatDate(selectedLessonPlan.endDate)}</p>
                <p><strong>Objectives:</strong> {selectedLessonPlan.objectives}</p>
                <p><strong>Activities:</strong> {selectedLessonPlan.activities}</p>
                <p><strong>Resources:</strong> {selectedLessonPlan.resources}</p>
                <p><strong>Homework:</strong> {selectedLessonPlan.homework}</p>
                <p><strong>Assessment Methods:</strong> {selectedLessonPlan.assessmentMethods}</p>
                <p><strong>Status:</strong> {selectedLessonPlan.status}</p>
                <p><strong>Remarks:</strong> {selectedLessonPlan.remarks}</p>
              </Card.Body>
            </Card>
          ) : (
            <div className="text-muted">Click "View" to see lesson plan details.</div>
          )}
        </Col>
      </Row>

      {/* Modal for Create/Edit Lesson Plan */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editing ? "Edit Lesson Plan" : "Create Lesson Plan"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={5}>
                <Form.Group>
                  <Form.Label>Select Classes</Form.Label>
                  <div>
                    {classes.map(cls => (
                      <Form.Check
                        inline
                        key={cls.id}
                        type="checkbox"
                        label={cls.class_name}
                        value={cls.id}
                        checked={formData.classIds.includes(cls.id)}
                        onChange={handleCheckboxChange}
                      />
                    ))}
                  </div>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Select Subject</Form.Label>
                  <Form.Control 
                    as="select"
                    name="subjectId"
                    value={formData.subjectId}
                    onChange={handleChange}
                    required
                  >
                    <option value="">-- Select Subject --</option>
                    {subjects.map(subject => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Week Number</Form.Label>
                  <Form.Control 
                    type="number"
                    name="weekNumber"
                    value={formData.weekNumber}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="mt-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control 
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>End Date</Form.Label>
                  <Form.Control 
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mt-3">
              <Form.Label>Topic</Form.Label>
              <Form.Control 
                type="text"
                name="topic"
                value={formData.topic}
                onChange={handleChange}
                required
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Objectives</Form.Label>
              <Form.Control 
                as="textarea"
                name="objectives"
                value={formData.objectives}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Activities</Form.Label>
              <Form.Control 
                as="textarea"
                name="activities"
                value={formData.activities}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Resources</Form.Label>
              <Form.Control 
                as="textarea"
                name="resources"
                value={formData.resources}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Homework</Form.Label>
              <Form.Control 
                as="textarea"
                name="homework"
                value={formData.homework}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Assessment Methods</Form.Label>
              <Form.Control 
                as="textarea"
                name="assessmentMethods"
                value={formData.assessmentMethods}
                onChange={handleChange}
              />
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Status</Form.Label>
              <Form.Control 
                as="select"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </Form.Control>
            </Form.Group>

            <Form.Group className="mt-3">
              <Form.Label>Remarks</Form.Label>
              <Form.Control 
                as="textarea"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
              />
            </Form.Group>

            <Button variant="primary" type="submit" className="mt-3">
              {editing ? "Update Lesson Plan" : "Create Lesson Plan"}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default LessonPlanCRUD;
