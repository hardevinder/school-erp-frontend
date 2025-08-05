import React, { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function HRDashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="App">
      <Navbar />
      <div className="d-flex" style={{ marginTop: "60px" }}>
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />
        <main
          className="container-fluid px-0"
          style={{
            marginLeft: isExpanded ? "250px" : "60px",  // sidebar width
            transition: "margin-left 0.3s ease",
            padding: "20px",
            minHeight: "calc(100vh - 60px)",            // full viewport height minus navbar
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
