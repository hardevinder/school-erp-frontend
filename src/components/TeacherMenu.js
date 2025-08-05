import React from "react";
import { Button } from "react-bootstrap";

// Define the teacher-specific menu items (keys, labels, and icons).
const teacherMenus = [
  { key: "dashboard", label: "Dashboard", icon: "bi-speedometer2" },
  { key: "mark-attendance", label: "Mark Attendance", icon: "bi-check2-square" },
  { key: "attendance-calendar", label: "Attendance Calendar", icon: "bi-calendar2-check" },
  { key: "assignments", label: "Assignments", icon: "bi-clipboard" },
  { key: "assignment-marking", label: "Assignment Marking", icon: "bi-pencil-square" },
  { key: "time-table", label: "Time Table", icon: "bi-table" },
  { key: "substitutions", label: "My Substitutions", icon: "bi-arrow-repeat" },
  { key: "lesson-plan", label: "Lesson Plan", icon: "bi-journal-text" },
  { key: "leave-request", label: "Leave Requests", icon: "bi-envelope" },
  { key: "classes", label: "Classes", icon: "bi-list-task" },
  { key: "subjects", label: "Subjects", icon: "bi-book" },
  { key: "students", label: "Students", icon: "bi-people" },
];

const TeacherMenu = ({ activeSection, setActiveSection }) => {
  return (
    <div className="d-flex flex-wrap justify-content-center my-4">
      {teacherMenus.map((menu) => (
        <Button
          key={menu.key}
          variant={activeSection === menu.key ? "primary" : "outline-primary"}
          className="m-2 d-flex align-items-center"
          onClick={() => setActiveSection(menu.key)}
        >
          <i className={`bi ${menu.icon} me-2`}></i>
          {menu.label}
        </Button>
      ))}
    </div>
  );
};

export default TeacherMenu;
