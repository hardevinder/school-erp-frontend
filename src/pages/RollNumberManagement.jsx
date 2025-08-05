import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Button, Form, Tabs, Tab } from "react-bootstrap";

// DnD Kit imports
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable Row Component
const SortableStudentRow = ({ student, index, onRollChange, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: student.id.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <td>{index + 1}</td>
      <td>{student.name}</td>
      <td>{student.admission_number}</td>
      <td>{student.Class?.class_name}</td>
      <td>{student.Section?.section_name}</td>
      <td>
        <Form.Control
          type="number"
          value={student.roll_number || ""}
          onChange={(e) => onRollChange(student.id, parseInt(e.target.value))}
          style={{ width: "80px" }}
        />
      </td>
      <td>{student.visible ? "✅" : "❌"}</td>
      <td>
        <Button
          variant={student.visible ? "outline-danger" : "outline-success"}
          size="sm"
          onClick={() => onToggle(student.id)}
        >
          {student.visible ? "Hide" : "Show"}
        </Button>
      </td>
    </tr>
  );
};

const RollNumberManagement = () => {
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState("visible"); // 'visible' or 'hidden'

  const fetchStudents = async () => {
    try {
      const res = await api.get("/student-roll/roll-numbers", {
        params: { showHidden: activeTab === "hidden" },
      });

      const sorted = (res.data.students || []).sort((a, b) => (a.roll_number ?? 9999) - (b.roll_number ?? 9999));
      setStudents(sorted);
    } catch {
      Swal.fire("Error", "Failed to fetch students", "error");
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [activeTab]);

  const handleRollNumberChange = (id, value) => {
    const updated = students.map((s) =>
      s.id === id ? { ...s, roll_number: value } : s
    );
    setStudents(updated);
  };

  const handleToggleVisibility = async (id) => {
    try {
      await api.put(`/student-roll/${id}/toggle-visibility`);
      Swal.fire("Success", "Visibility toggled", "success");
      fetchStudents();
    } catch {
      Swal.fire("Error", "Failed to toggle visibility", "error");
    }
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = students.findIndex((s) => s.id.toString() === active.id);
    const newIndex = students.findIndex((s) => s.id.toString() === over.id);
    const reordered = arrayMove(students, oldIndex, newIndex);

    const updatedWithRolls = reordered.map((s, i) => ({
      ...s,
      roll_number: i + 1,
    }));

    setStudents(updatedWithRolls);
  };

  const handleSave = async () => {
    const updates = students.map(({ id, roll_number }) => ({ id, roll_number }));
    try {
      await api.post("/student-roll/roll-numbers/update", { updates });
      Swal.fire("Saved", "Roll numbers updated", "success");
      fetchStudents();
    } catch {
      Swal.fire("Error", "Failed to save roll numbers", "error");
    }
  };

  return (
    <div className="container mt-4">
      <h2>🧾 Roll Number Management</h2>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        <Tab eventKey="visible" title="✅ Visible Students" />
        <Tab eventKey="hidden" title="❌ Hidden Students" />
      </Tabs>

      <div className="card">
        <div className="card-body">
          {students.length > 0 ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={students.map((s) => s.id.toString())}
                strategy={verticalListSortingStrategy}
              >
                <table className="table table-bordered table-striped">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Admission No</th>
                      <th>Class</th>
                      <th>Section</th>
                      <th>Roll No</th>
                      <th>Visible</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <SortableStudentRow
                        key={s.id}
                        student={s}
                        index={i}
                        onRollChange={handleRollNumberChange}
                        onToggle={handleToggleVisibility}
                      />
                    ))}
                  </tbody>
                </table>
              </SortableContext>
            </DndContext>
          ) : (
            <p>No students found in this tab.</p>
          )}
        </div>
      </div>

      {activeTab === "visible" && (
        <div className="mt-3 d-flex justify-content-end">
          <Button variant="primary" onClick={handleSave}>
            💾 Save Roll Numbers
          </Button>
        </div>
      )}
    </div>
  );
};

export default RollNumberManagement;
