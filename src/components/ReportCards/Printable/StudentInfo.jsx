import React from "react";

const StudentInfo = ({ student }) => {
  if (!student) return null;

  const {
    name,
    admission_number,
    roll_number,
    father_name,
    mother_name,
    father_phone,
    mother_phone,
    aadhaar_number,
    Class,
    Section,
    createdAt,
  } = student;

  return (
    <table
      style={{
        width: "100%",
        fontSize: "14px",
        marginBottom: "15px",
      }}
      border="1"
      cellPadding="6"
      cellSpacing="0"
    >
      <tbody>
        <tr>
          <td><strong>Name</strong></td>
          <td>{name || "-"}</td>
          <td><strong>Class-Section</strong></td>
          <td>{Class?.class_name || "-"} - {Section?.section_name || "-"}</td>
        </tr>
        <tr>
          <td><strong>Admission Number</strong></td>
          <td>{admission_number || "-"}</td>
          <td><strong>Roll Number</strong></td>
          <td>{roll_number || "-"}</td>
        </tr>
        <tr>
          <td><strong>Father's Name</strong></td>
          <td>{father_name || "-"}</td>
          <td><strong>Mother's Name</strong></td>
          <td>{mother_name || "-"}</td>
        </tr>
        <tr>
          <td><strong>Father's Phone</strong></td>
          <td>{father_phone || "-"}</td>
          <td><strong>Mother's Phone</strong></td>
          <td>{mother_phone || "-"}</td>
        </tr>
        <tr>
          <td><strong>Aadhaar Number</strong></td>
          <td>{aadhaar_number || "-"}</td>
          <td><strong>Admission Date</strong></td>
          <td>{createdAt ? new Date(createdAt).toLocaleDateString() : "-"}</td>
        </tr>
      </tbody>
    </table>
  );
};

export default StudentInfo;
