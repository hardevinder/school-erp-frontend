import React from "react";
import { Row, Col } from "react-bootstrap";
import "./StudentReportCard.css"; // Optional: custom styles if needed

const StudentReportCard = ({ student = {}, subjectComponentGroups = [] }) => {
  const {
    name = "",
    admission_number = "",
    roll_number = "",
    father_name = "",
    mother_name = "",
    subject_totals_raw = {},
    subject_totals_weighted = {},
    subject_grades = {},
    total_raw = "",
    total_weighted = "",
    total_grade_weighted = "",
    components = [],
  } = student;

  return (
    <div className="report-card p-4 page-break">
      {/* 🔰 Header */}
      <div className="text-center mb-3">
        <h4 className="fw-bold">Scholastic Report</h4>
        <div>Session 2024–2025</div>
      </div>

      {/* 👤 Student Info */}
      <table className="table table-bordered small">
        <tbody>
          <tr>
            <td><strong>Name:</strong> {name || "N/A"}</td>
            <td><strong>Admission No:</strong> {admission_number || "N/A"}</td>
            <td><strong>Roll No:</strong> {roll_number || "N/A"}</td>
          </tr>
          <tr>
            <td><strong>Father's Name:</strong> {father_name || "N/A"}</td>
            <td><strong>Mother's Name:</strong> {mother_name || "N/A"}</td>
            <td><strong>House:</strong> N/A</td>
          </tr>
        </tbody>
      </table>

      {/* 📚 Scholastic Table */}
      <h6 className="mt-3">Scholastic Areas</h6>
      <table className="table table-bordered small text-center align-middle">
        <thead>
          <tr>
            <th>Subject</th>
            {subjectComponentGroups[0]?.components.map((c) => (
              <th key={c.component_id}>
                {c.name} ({c.weightage_percent}%)
              </th>
            ))}
            <th>Total Marks</th>
            <th>Weighted Marks</th>
            <th>Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjectComponentGroups.map((subject, idx) => {
            const subject_id = subject.subject_id.toString();

            return (
              <tr key={subject_id}>
                <td className="text-start">{subject.subject_name}</td>

                {/* Component-wise Marks or Attendance */}
                {subject.components.map((comp) => {
                  const c = components.find(
                    (item) =>
                      item.subject_id === subject.subject_id &&
                      item.component_id === comp.component_id
                  );

                  return (
                    <td key={comp.component_id}>
                      {c?.attendance === "P"
                        ? c?.marks ?? "-"
                        : c?.attendance || "-"}
                    </td>
                  );
                })}

                <td>{subject_totals_raw[subject_id] ?? "-"}</td>
                <td>
                  {subject_totals_weighted[subject_id]
                    ? Number(subject_totals_weighted[subject_id]).toFixed(2)
                    : "-"}
                </td>
                <td>{subject_grades[subject_id] ?? "-"}</td>
              </tr>
            );
          })}

          {/* 🔢 Grand Total Row */}
          <tr className="fw-bold">
            <td>Total</td>
            <td colSpan={subjectComponentGroups[0]?.components.length || 1}></td>
            <td>{total_raw || "-"}</td>
            <td>
              {total_weighted ? Number(total_weighted).toFixed(2) : "-"}
            </td>
            <td>{total_grade_weighted || "-"}</td>
          </tr>
        </tbody>
      </table>

      {/* 🗓️ Attendance Summary (Optional) */}
      <div className="mt-3">
        <p><strong>Attendance:</strong> N/A</p>
      </div>

      {/* 💬 Remarks */}
      <div className="mt-2">
        <strong>Remarks:</strong> N/A
      </div>

      {/* ✅ Footer */}
      <div className="text-end mt-4">
        <em>This is a computer-generated document, therefore no signature is required.</em>
      </div>
    </div>
  );
};

export default StudentReportCard;
