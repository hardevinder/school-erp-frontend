import React, { useEffect, useState } from "react";
import api from "../../api";
import { Form, Button, Table, Card, Row, Col, Spinner } from "react-bootstrap";

const ScholasticReportSummary = () => {
  const [loading, setLoading] = useState(false);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [examIds, setExamIds] = useState([]);
  const [subjectComponents, setSubjectComponents] = useState([]);
  const [gradeSchemeId, setGradeSchemeId] = useState("");
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.post("/report-card/scholastic-summary", {
        class_id: parseInt(classId),
        section_id: parseInt(sectionId),
        exam_ids: examIds.map((id) => parseInt(id)),
        grade_scheme_id: parseInt(gradeSchemeId),
        subjectComponents,
      });

      setStudents(res.data.students || []);
      setGroups(res.data.subjectComponentGroups || []);
    } catch (err) {
      console.error("Error fetching report summary", err);
    } finally {
      setLoading(false);
    }
  };

  const renderSubjectHeaders = () => {
    return groups.map((group) => (
      <th key={group.subject_id} colSpan={group.components.length + 1} className="text-center bg-light">
        {group.subject_name}
      </th>
    ));
  };

  const renderComponentHeaders = () => {
    return groups.flatMap((group) =>
      group.components.map((comp) => (
        <th key={`${group.subject_id}-${comp.component_id}`} className="text-center">
          {comp.name}
        </th>
      )).concat(<th key={`total-${group.subject_id}`} className="text-center bg-secondary text-white">Total</th>)
    );
  };

  const renderStudentRows = () => {
    return students.map((student) => (
      <tr key={student.id}>
        <td>{student.roll_number}</td>
        <td>{student.name}</td>
        {groups.flatMap((group) => {
          const comps = group.components.map((comp) => {
            const result = student.components.find(
              (c) =>
                c.subject_id === group.subject_id &&
                c.component_id === comp.component_id
            );
            return (
              <td key={`${student.id}-${comp.component_id}`} className="text-center">
                {result?.marks ?? "-"} ({result?.grade ?? "-"})
              </td>
            );
          });

          const total = student.subject_totals_raw[group.subject_id] ?? "-";
          const grade = student.subject_grades[group.subject_id] ?? "-";
          return comps.concat(
            <td key={`total-${student.id}-${group.subject_id}`} className="text-center fw-bold">
              {total} ({grade})
            </td>
          );
        })}
        <td className="text-center fw-bold">
          {student.total_raw} ({student.total_grade_raw})
        </td>
        <td className="text-center fw-bold">
          {student.total_weighted} ({student.total_grade_weighted})
        </td>
      </tr>
    ));
  };

  return (
    <Card className="p-4">
      <h4>📊 Scholastic Report Summary</h4>

      <Row className="mb-3">
        <Col>
          <Form.Control
            placeholder="Class ID"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
        </Col>
        <Col>
          <Form.Control
            placeholder="Section ID"
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          />
        </Col>
        <Col>
          <Form.Control
            placeholder="Grade Scheme ID"
            value={gradeSchemeId}
            onChange={(e) => setGradeSchemeId(e.target.value)}
          />
        </Col>
      </Row>

      <Row className="mb-3">
        <Col>
          <Form.Control
            placeholder="Exam IDs (comma separated)"
            value={examIds.join(",")}
            onChange={(e) => setExamIds(e.target.value.split(",").map((id) => id.trim()))}
          />
        </Col>
        <Col>
          <Form.Control
            as="textarea"
            placeholder='Subject Components JSON [{ "subject_id": 3, "component_ids": [4] }]'
            value={JSON.stringify(subjectComponents)}
            onChange={(e) => {
              try {
                setSubjectComponents(JSON.parse(e.target.value));
              } catch {
                setSubjectComponents([]);
              }
            }}
          />
        </Col>
        <Col>
          <Button onClick={fetchData} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : "Fetch Report"}
          </Button>
        </Col>
      </Row>

      <div className="table-responsive">
        <Table bordered hover>
          <thead>
            <tr>
              <th rowSpan={2}>Roll No</th>
              <th rowSpan={2}>Name</th>
              {renderSubjectHeaders()}
              <th rowSpan={2} className="bg-primary text-white text-center">Grand Total</th>
              <th rowSpan={2} className="bg-success text-white text-center">Weighted Total</th>
            </tr>
            <tr>{renderComponentHeaders()}</tr>
          </thead>
          <tbody>{renderStudentRows()}</tbody>
        </Table>
      </div>
    </Card>
  );
};

export default ScholasticReportSummary;
