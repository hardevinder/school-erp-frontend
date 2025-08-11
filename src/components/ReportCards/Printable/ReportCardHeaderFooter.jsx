// src/components/ReportCards/Printable/ReportCardHeaderFooter.jsx

import React from "react";
import "./ReportCardHeaderFooter.css"; // Optional for styling

const ReportCardHeaderFooter = ({ format }) => {
  if (!format) return null;

  const {
    header_html,
    footer_html,
    school_logo_url,
    board_logo_url,
  } = format;

  return (
    <>
      {/* ✅ Header */}
      <div className="report-card-header d-flex justify-content-between align-items-center mb-3">
        {school_logo_url && (
          <img src={school_logo_url} alt="School Logo" style={{ height: "80px" }} />
        )}
        <div
          className="text-center flex-grow-1 px-3"
          dangerouslySetInnerHTML={{ __html: header_html }}
        />
        {board_logo_url && (
          <img src={board_logo_url} alt="Board Logo" style={{ height: "80px" }} />
        )}
      </div>

    
    </>
  );
};

export default ReportCardHeaderFooter;
