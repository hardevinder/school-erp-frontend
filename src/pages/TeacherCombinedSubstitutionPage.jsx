import React, { useState } from "react";
import TeacherSubstitutionListing from "./TeacherSubstitutionListing";
import TeacherSubstitutedListing from "./TeacherSubstitutedListing";
import "./CombinedSubstitutionPage.css"; // Optional: custom CSS for styling the tabs

const CombinedSubstitutionPage = () => {
  const [activeTab, setActiveTab] = useState("took"); // 'took' or 'substituted'

  return (
    <div className="container mt-4">
      <h1 className="mb-4">My Substitutions</h1>

      {/* Tab Headers */}
      <ul className="nav nav-tabs">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "took" ? "active" : ""}`}
            onClick={() => setActiveTab("took")}
          >
            Took Substitutions
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === "substituted" ? "active" : ""}`}
            onClick={() => setActiveTab("substituted")}
          >
            I Substituted
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      <div className="tab-content mt-3">
        {activeTab === "took" && (
          <div className="tab-pane active">
            <TeacherSubstitutionListing />
          </div>
        )}
        {activeTab === "substituted" && (
          <div className="tab-pane active">
            <TeacherSubstitutedListing />
          </div>
        )}
      </div>
    </div>
  );
};

export default CombinedSubstitutionPage;
