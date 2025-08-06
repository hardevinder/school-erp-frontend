import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Form, Button, Table } from "react-bootstrap";

const AssignReportCardFormat = () => {
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [formats, setFormats] = useState([]);
  const [assignedFormats, setAssignedFormats] = useState([]);

  const [selected, setSelected] = useState({
    class_id: "",
    section_id: "",
    format_id: ""
  });

  const fetchInitial = async () => {
    try {
      const [cls, sec, fmt, assigned] = await Promise.all([
        api.get("/classes"),
        api.get("/sections"),
        api.get("/report-card-formats"),
        api.get("/report-card-formats/assigned"), // Optional: backend returns list of assigned formats
      ]);
      setClasses(cls.data);
      setSections(sec.data);
      setFormats(fmt.data);
      setAssignedFormats(assigned.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const handleAssign = async () => {
    const { class_id, section_id, format_id } = selected;
    if (!class_id || !section_id || !format_id) {
      Swal.fire("Please fill all fields", "", "warning");
      return;
    }

    try {
      await api.post("/report-card-formats/assign", selected);
      Swal.fire("Assigned Successfully", "", "success");
      setSelected({ class_id: "", section_id: "", format_id: "" });
      fetchInitial();
    } catch (err) {
      console.error(err);
      Swal.fire("Failed to assign format", "", "error");
    }
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  return (
    <div className="container mt-4">
      <h4>🎯 Assign Report Card Format</h4>

      <Form className="row g-3 mt-2">
        <Form.Group className="col-md-4">
          <Form.Label>Class</Form.Label>
          <Form.Select
            value={selected.class_id}
            onChange={(e) => setSelected({ ...selected, class_id: e.target.value })}
          >
            <option value="">Select</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.class_name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="col-md-4">
          <Form.Label>Section</Form.Label>
          <Form.Select
            value={selected.section_id}
            onChange={(e) => setSelected({ ...selected, section_id: e.target.value })}
          >
            <option value="">Select</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.section_name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group className="col-md-4">
          <Form.Label>Report Format</Form.Label>
          <Form.Select
            value={selected.format_id}
            onChange={(e) => setSelected({ ...selected, format_id: e.target.value })}
          >
            <option value="">Select</option>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Form.Select>
        </Form.Group>

        <div className="col-12">
          <Button onClick={handleAssign}>Assign Format</Button>
        </div>
      </Form>

      <hr />
      <h5>📋 Current Format Assignments</h5>
      <Table bordered hover>
        <thead>
          <tr>
            <th>Class</th>
            <th>Section</th>
            <th>Format Name</th>
          </tr>
        </thead>
        <tbody>
          {assignedFormats.length === 0 ? (
            <tr>
              <td colSpan="3" className="text-center">
                No assignments found.
              </td>
            </tr>
          ) : (
            assignedFormats.map((a, i) => (
              <tr key={i}>
                <td>{a.class?.class_name}</td>
                <td>{a.section?.section_name}</td>
                <td>{a.format?.name}</td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default AssignReportCardFormat;
