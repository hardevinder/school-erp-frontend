// components/AcademicCoordinatorSidebar.js
import React from "react";
import { Link } from "react-router-dom";

const AcademicCoordinatorSidebar = ({
  activeSection,
  setActiveSection,
  isExpanded,
  setIsExpanded,
  userRole,
}) => {
  // Define menu items for academic coordinator
  const menuItems = [
    { name: "Dashboard", section: "dashboard" },
    { name: "Subjects", section: "subjects" },
    { name: "Classes", section: "classes" },
    { name: "Students", section: "students" },
    // Add more academic coordinator–specific menu items here
  ];

  return (
    <div className={`sidebar ${isExpanded ? "expanded" : "collapsed"}`}>
      <button onClick={() => setIsExpanded(!isExpanded)} className="btn btn-light my-2">
        {isExpanded ? "Collapse" : "Expand"}
      </button>
      <ul className="list-group">
        {menuItems.map((item) => (
          <li
            key={item.section}
            className={`list-group-item ${activeSection === item.section ? "active" : ""}`}
            onClick={() => setActiveSection(item.section)}
            style={{ cursor: "pointer" }}
          >
            {item.name}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AcademicCoordinatorSidebar;
