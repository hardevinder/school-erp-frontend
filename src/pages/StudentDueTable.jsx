import React, { useState, useEffect } from "react";
import api from "../api"; // Custom Axios instance
import { Tooltip } from "react-tooltip"; // Named export from react-tooltip v5+
import "react-tooltip/dist/react-tooltip.css"; // Tooltip styles
import "bootstrap/dist/css/bootstrap.min.css";
import { pdf } from "@react-pdf/renderer";
import PdfStudentDueReport from "./PdfStudentDueReport"; // Your PDF component

// Helper function to format numbers using the Indian numbering system.
// If the number is 0, return '-' instead.
const formatINR = (amount) => {
  if (Number(amount) === 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const StudentDueTable = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [studentData, setStudentData] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);
  const [school, setSchool] = useState(null);

  // Fetch school details on mount.
  useEffect(() => {
    api.get("/schools")
      .then((response) => {
        // Assuming we want the first school.
        setSchool(response.data[0]);
      })
      .catch((error) => console.error("Error fetching schools:", error));
  }, []);

  // Fetch classes on mount.
  useEffect(() => {
    api.get("/classes")
      .then((response) => {
        setClasses(response.data);
      })
      .catch((error) => console.error("Error fetching classes:", error));
  }, []);

  // Fetch fee data when a class is selected.
  useEffect(() => {
    if (selectedClass) {
      api.get(`/feedue/class/${selectedClass}/fees`)
        .then((response) => {
          const data = response.data;
          setStudentData(data);
          if (data.length > 0 && data[0].feeDetails) {
            const heads = data[0].feeDetails.map((detail) => detail.fee_heading);
            setFeeHeadings(heads);
          } else {
            setFeeHeadings([]);
          }
        })
        .catch((error) => console.error("Error fetching fee data:", error));
    }
  }, [selectedClass]);

  // Compute headwise summary for each fee heading.
  const computeHeadwiseSummary = () => {
    const summary = {};
    studentData.forEach((student) => {
      student.feeDetails.forEach((fee) => {
        const heading = fee.fee_heading;
        if (!summary[heading]) {
          summary[heading] = {
            originalFeeDue: 0,
            effectiveFeeDue: 0,
            finalAmountDue: 0,
            totalFeeReceived: 0,
            totalVanFeeReceived: 0,
            totalConcessionReceived: 0,
          };
        }
        summary[heading].originalFeeDue += Number(fee.originalFeeDue) || 0;
        summary[heading].effectiveFeeDue += Number(fee.effectiveFeeDue) || 0;
        summary[heading].finalAmountDue += Number(fee.finalAmountDue) || 0;
        summary[heading].totalFeeReceived += Number(fee.totalFeeReceived) || 0;
        summary[heading].totalVanFeeReceived += Number(fee.totalVanFeeReceived) || 0;
        summary[heading].totalConcessionReceived += Number(fee.totalConcessionReceived) || 0;
      });
    });
    return summary;
  };

  // Compute the grand summary by summing across all fee headings.
  const computeGrandSummary = (headSummary) => {
    const grand = {
      originalFeeDue: 0,
      effectiveFeeDue: 0,
      finalAmountDue: 0,
      totalFeeReceived: 0,
      totalVanFeeReceived: 0,
      totalConcessionReceived: 0,
    };
    Object.values(headSummary).forEach((summary) => {
      grand.originalFeeDue += summary.originalFeeDue;
      grand.effectiveFeeDue += summary.effectiveFeeDue;
      grand.finalAmountDue += summary.finalAmountDue;
      grand.totalFeeReceived += summary.totalFeeReceived;
      grand.totalVanFeeReceived += summary.totalVanFeeReceived;
      grand.totalConcessionReceived += summary.totalConcessionReceived;
    });
    return grand;
  };

  const headSummary = computeHeadwiseSummary();
  const grandSummary = computeGrandSummary(headSummary);

  // Function to generate PDF blob and open it in a new tab.
  const openPdfInNewTab = async () => {
    if (!selectedClass) {
      alert("Please select a class.");
      return;
    }
    // Convert selected class id to the corresponding class name.
    const selectedClassName =
      classes.find((cls) => Number(cls.id) === Number(selectedClass))?.class_name ||
      selectedClass;
    // Create the PDF document using the PdfStudentDueReport component.
    const doc = (
      <PdfStudentDueReport
        school={school}
        selectedClass={selectedClassName}
        studentData={studentData}
        headSummary={headSummary}
        grandSummary={grandSummary}
      />
    );
    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Student Due Amounts</h2>
      {school && (
        <div className="mb-3">
          <strong>School:</strong> {school.name}
        </div>
      )}

      {/* Combined Select and Print Button in the same row */}
      <div className="row mb-4 align-items-end">
        <div className="col-md-6">
          <label htmlFor="classSelect">Select Class:</label>
          <select
            id="classSelect"
            className="form-control"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">-- Select a class --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.class_name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-6 text-md-right mt-3 mt-md-0">
          {selectedClass && studentData.length > 0 && (
            <button className="btn btn-secondary" onClick={openPdfInNewTab}>
              Print As PDF
            </button>
          )}
        </div>
      </div>

      {selectedClass && studentData.length > 0 && (
        <>
          {/* Student Data Table */}
          <div style={{ maxHeight: "400px", overflowY: "auto", position: "relative" }}>
            <table className="table table-bordered table-hover">
              <thead className="thead-dark">
                <tr>
                  <th className="sticky-top bg-white" style={{ top: 0 }}>Student ID</th>
                  <th className="sticky-top bg-white" style={{ top: 0 }}>Student Name</th>
                  {feeHeadings.map((heading, idx) => (
                    <th key={idx} className="sticky-top bg-white" style={{ top: 0 }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentData.map((student) => (
                  <tr key={student.id}>
                    <td>{student.id}</td>
                    <td>{student.name}</td>
                    {student.feeDetails.map((fee, idx) => (
                      <td key={idx}>
                        <span data-tooltip-id={`tooltip-${student.id}-${idx}`} className="font-weight-bold">
                          {formatINR(fee.finalAmountDue)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Section at the Bottom */}
          <div className="mt-4">
            {/* Headwise Summary Card */}
            <div className="card mb-4">
              <div className="card-header bg-secondary text-white">Headwise Summary</div>
              <div className="card-body table-responsive">
                <table className="table table-bordered mb-0">
                  <thead>
                    <tr>
                      <th>Fee Heading</th>
                      <th>Original Fee Due</th>
                      <th>Effective Fee Due</th>
                      <th>Final Due</th>
                      <th>Received</th>
                      <th>Van Fee Received</th>
                      <th>Concession Given</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(headSummary).map(([heading, summary]) => (
                      <tr key={heading}>
                        <td>{heading}</td>
                        <td>{formatINR(summary.originalFeeDue)}</td>
                        <td>{formatINR(summary.effectiveFeeDue)}</td>
                        <td>{formatINR(summary.finalAmountDue)}</td>
                        <td>{formatINR(summary.totalFeeReceived)}</td>
                        <td>{formatINR(summary.totalVanFeeReceived)}</td>
                        <td>{formatINR(summary.totalConcessionReceived)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Grand Summary Card */}
            <div className="card">
              <div className="card-header bg-dark text-white">Grand Summary</div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-2">
                    <strong>Original Fee Due</strong>
                    <p>{formatINR(grandSummary.originalFeeDue)}</p>
                  </div>
                  <div className="col-md-2">
                    <strong>Effective Fee Due</strong>
                    <p>{formatINR(grandSummary.effectiveFeeDue)}</p>
                  </div>
                  <div className="col-md-2">
                    <strong>Final Due</strong>
                    <p>{formatINR(grandSummary.finalAmountDue)}</p>
                  </div>
                  <div className="col-md-2">
                    <strong>Received</strong>
                    <p>{formatINR(grandSummary.totalFeeReceived)}</p>
                  </div>
                  <div className="col-md-2">
                    <strong>Van Fee Received</strong>
                    <p>{formatINR(grandSummary.totalVanFeeReceived)}</p>
                  </div>
                  <div className="col-md-2">
                    <strong>Concession Given</strong>
                    <p>{formatINR(grandSummary.totalConcessionReceived)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedClass && studentData.length === 0 && (
        <p className="text-muted">No student data available for the selected class.</p>
      )}
    </div>
  );
};

export default StudentDueTable;
