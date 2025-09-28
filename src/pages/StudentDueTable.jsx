// File: src/components/StudentDueTable.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
import { Tooltip } from "react-tooltip"; // Named export from react-tooltip v5+
import "react-tooltip/dist/react-tooltip.css"; // Tooltip styles
import "bootstrap/dist/css/bootstrap.min.css";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx"; // SheetJS
import PdfStudentDueReport from "./PdfStudentDueReport"; // Your PDF component

// Helper: Indian format; show "-" for 0
const formatINR = (amount) => {
  if (Number(amount) === 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Helper: get admission number safely (supports alias or snake_case; falls back to id)
const getAdmissionNo = (s) =>
  s?.AdmissionNumber ??
  s?.admission_number ??
  s?.admissionNo ??
  s?.admission_no ??
  s?.id ??
  "";

// Helper: student id (various shapes)
const getStudentId = (s) =>
  Number(
    s?.id ??
      s?.student_id ??
      s?.Student_ID ??
      s?.StudentId ??
      s?.Student?.id ??
      0
  );

// Helper: safe id for tooltip (no spaces/specials)
const safeId = (v) => String(v ?? "").replace(/[^\w-]+/g, "_");

const StudentDueTable = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [studentData, setStudentData] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);
  const [school, setSchool] = useState(null);

  // NEW: sessions, selected session (use active by default)
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  // NEW: previous balance map per student_id
  const [prevBalanceMap, setPrevBalanceMap] = useState({}); // { [student_id]: number }
  const [loadingPrev, setLoadingPrev] = useState(false);

  // NEW: search box
  const [search, setSearch] = useState("");

  // Fetch school details on mount.
  useEffect(() => {
    api
      .get("/schools")
      .then((response) => {
        // support array or {data:[...]}
        const payload = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setSchool(payload[0] || null);
      })
      .catch((error) => console.error("Error fetching schools:", error));
  }, []);

  // Fetch sessions on mount (choose active)
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await api.get("/sessions");
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setSessions(list);
        let active = list.find((s) => s.is_active === true);
        if (!active && list.length) active = list[0];
        if (active) setSelectedSession(Number(active.id));
      } catch (e) {
        console.error("Error fetching sessions:", e);
      }
    };
    fetchSessions();
  }, []);

  // Fetch classes on mount.
  useEffect(() => {
    api
      .get("/classes")
      .then((response) => {
        setClasses(Array.isArray(response.data) ? response.data : response.data?.data || []);
      })
      .catch((error) => console.error("Error fetching classes:", error));
  }, []);

  // Fetch fee data when a class is selected.
  useEffect(() => {
    if (!selectedClass) return;
    api
      .get(`/feedue/class/${selectedClass}/fees`)
      .then((response) => {
        const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setStudentData(data);
        if (data.length > 0 && data[0].feeDetails) {
          const heads = data[0].feeDetails.map((detail) => detail.fee_heading);
          setFeeHeadings(heads);
        } else {
          setFeeHeadings([]);
        }
      })
      .catch((error) => console.error("Error fetching fee data:", error));
  }, [selectedClass]);

  // Fetch Previous Balance per student for selected session (after studentData loads)
  useEffect(() => {
    const run = async () => {
      if (!selectedSession || !studentData?.length) {
        setPrevBalanceMap({});
        return;
      }
      setLoadingPrev(true);
      try {
        const entries = await Promise.all(
          studentData.map(async (stu) => {
            const sid = getStudentId(stu);
            if (!sid) return [sid, 0];
            try {
              const resp = await api.get("/opening-balances/outstanding", {
                params: { student_id: sid, session_id: selectedSession },
              });
              const val =
                Number(
                  resp?.data?.data?.outstanding ??
                    resp?.data?.outstanding ??
                    resp?.data?.totalOutstanding
                ) || 0;
              return [sid, val];
            } catch (_) {
              return [sid, 0];
            }
          })
        );
        const map = {};
        entries.forEach(([sid, val]) => {
          if (sid) map[sid] = val;
        });
        setPrevBalanceMap(map);
      } finally {
        setLoadingPrev(false);
      }
    };
    run();
  }, [studentData, selectedSession]);

  // Compute headwise summary for each fee heading.
  const computeHeadwiseSummary = () => {
    const summary = {};
    studentData.forEach((student) => {
      (student.feeDetails || []).forEach((fee) => {
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

  // Filtered rows by search
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return studentData;
    const q = search.trim().toLowerCase();
    return studentData.filter((s) => {
      const name = String(s?.name ?? "").toLowerCase();
      const adm = String(getAdmissionNo(s) ?? "").toLowerCase();
      return name.includes(q) || adm.includes(q);
    });
  }, [studentData, search]);

  // ---------- Export to Excel (Frontend with SheetJS) ----------
  const exportToExcel = () => {
    if (!selectedClass || studentData.length === 0) {
      alert("Please select a class with data first.");
      return;
    }

    // Resolve Class Name
    const className =
      classes.find((c) => Number(c.id) === Number(selectedClass))?.class_name || selectedClass;

    // ---------- Sheet 1: Student Dues ----------
    const studentHeader = ["Admission No.", "Student Name", "Previous Balance", ...feeHeadings];
    const studentRows = studentData.map((stu) => {
      const admNo = getAdmissionNo(stu);
      const sid = getStudentId(stu);
      const prevBal = prevBalanceMap[sid] || 0;

      const map = new Map(
        (stu.feeDetails || []).map((f) => [f.fee_heading, Number(f.finalAmountDue) || 0])
      );
      const perHead = feeHeadings.map((h) => map.get(h) ?? 0);
      return [admNo, stu.name, prevBal, ...perHead];
    });
    const studentSheet = XLSX.utils.aoa_to_sheet([
      [`Class Name: ${className}`],
      selectedSession ? [`Session ID: ${selectedSession}`] : [],
      [],
      studentHeader,
      ...studentRows,
    ]);
    studentSheet["!cols"] = [{ wch: 16 }, { wch: 28 }, { wch: 18 }, ...feeHeadings.map(() => ({ wch: 16 }))];

    // ---------- Sheet 2: Headwise Summary ----------
    const headHeader = [
      "Fee Heading",
      "Original Fee Due",
      "Effective Fee Due",
      "Final Due",
      "Received",
      "Van Fee Received",
      "Concession Given",
    ];
    const headRows = Object.entries(headSummary).map(([heading, s]) => [
      heading,
      s.originalFeeDue || 0,
      s.effectiveFeeDue || 0,
      s.finalAmountDue || 0,
      s.totalFeeReceived || 0,
      s.totalVanFeeReceived || 0,
      s.totalConcessionReceived || 0,
    ]);
    const headSheet = XLSX.utils.aoa_to_sheet([
      [`Class Name: ${className}`],
      selectedSession ? [`Session ID: ${selectedSession}`] : [],
      [],
      headHeader,
      ...headRows,
    ]);
    headSheet["!cols"] = [
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
    ];

    // ---------- Sheet 3: Grand Summary ----------
    const grandRows = [
      ["Metric", "Amount"],
      ["Original Fee Due", grandSummary.originalFeeDue || 0],
      ["Effective Fee Due", grandSummary.effectiveFeeDue || 0],
      ["Final Due", grandSummary.finalAmountDue || 0],
      ["Received", grandSummary.totalFeeReceived || 0],
      ["Van Fee Received", grandSummary.totalVanFeeReceived || 0],
      ["Concession Given", grandSummary.totalConcessionReceived || 0],
    ];
    const grandSheet = XLSX.utils.aoa_to_sheet([
      [`Class Name: ${className}`],
      selectedSession ? [`Session ID: ${selectedSession}`] : [],
      [],
      ...grandRows,
    ]);
    grandSheet["!cols"] = [{ wch: 26 }, { wch: 18 }];

    // ---------- Build workbook & save ----------
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, studentSheet, "Student Dues");
    XLSX.utils.book_append_sheet(wb, headSheet, "Headwise Summary");
    XLSX.utils.book_append_sheet(wb, grandSheet, "Grand Summary");

    XLSX.writeFile(wb, `StudentDue_${className}.xlsx`);
  };

  // Print as PDF (now passes Previous Balance + session label)
  const openPdfInNewTab = async () => {
    if (!selectedClass) {
      alert("Please select a class.");
      return;
    }
    const selectedClassName =
      classes.find((cls) => Number(cls.id) === Number(selectedClass))?.class_name || selectedClass;

    const sessionLabel =
      sessions.find((s) => Number(s.id) === Number(selectedSession))?.name ||
      sessions.find((s) => Number(s.id) === Number(selectedSession))?.label ||
      (selectedSession ? String(selectedSession) : "");

    const doc = (
      <PdfStudentDueReport
        school={school}
        selectedClass={selectedClassName}
        studentData={studentData}
        headSummary={headSummary}
        grandSummary={grandSummary}
        prevBalanceMap={prevBalanceMap}     // ✅ pass Previous Balance
        sessionLabel={sessionLabel}         // ✅ nicer session text in PDF header
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

      {/* Controls Row */}
      <div className="row mb-4 align-items-end g-3">
        {/* Class Select */}
        <div className="col-md-3">
          <label htmlFor="classSelect" className="form-label">Select Class:</label>
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

        {/* Session */}
        <div className="col-md-3">
          <label className="form-label">Academic Session:</label>
          <select
            className="form-control"
            value={selectedSession ?? ""}
            onChange={(e) => setSelectedSession(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">-- Select session --</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name || s.label || s.id}
              </option>
            ))}
          </select>
        </div>

        {/* Search box */}
        <div className="col-md-4">
          <label htmlFor="searchBox" className="form-label">Search (name / admission no.)</label>
          <input
            id="searchBox"
            type="text"
            className="form-control"
            placeholder="Type to filter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Export / Print */}
        <div className="col-md-2 text-md-right d-flex justify-content-md-end gap-2">
          {selectedClass && studentData.length > 0 && (
            <>
              <button className="btn btn-success me-2" onClick={exportToExcel}>
                Export Excel
              </button>
              <button className="btn btn-secondary" onClick={openPdfInNewTab}>
                Print As PDF
              </button>
            </>
          )}
        </div>
      </div>

      {selectedClass && filteredStudents.length > 0 && (
        <>
          {/* Student Data Table */}
          <div style={{ maxHeight: "420px", overflowY: "auto", position: "relative" }}>
            <table className="table table-bordered table-hover">
              <thead className="thead-dark">
                <tr>
                  <th className="sticky-top bg-white" style={{ top: 0 }}>
                    Admission No.
                  </th>
                  <th className="sticky-top bg-white" style={{ top: 0 }}>
                    Student Name
                  </th>
                  {/* NEW: Previous Balance column */}
                  <th className="sticky-top bg-white" style={{ top: 0 }}>
                    Previous Balance {loadingPrev ? "(…)" : ""}
                  </th>
                  {feeHeadings.map((heading, idx) => (
                    <th key={idx} className="sticky-top bg-white" style={{ top: 0 }}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const admNo = getAdmissionNo(student);
                  const sid = getStudentId(student);
                  const rowKey = safeId(admNo);

                  const prevBal = prevBalanceMap[sid] || 0;

                  return (
                    <tr key={rowKey}>
                      <td>{admNo}</td>
                      <td>{student.name}</td>
                      {/* NEW: Previous Balance cell */}
                      <td className={prevBal > 0 ? "fw-semibold text-danger" : ""}>
                        {formatINR(prevBal)}
                      </td>

                      {(student.feeDetails || []).map((fee, idx) => {
                        const tipId = `tooltip-${rowKey}-${idx}`;
                        return (
                          <td key={idx}>
                            <span data-tooltip-id={tipId} className="font-weight-bold">
                              {formatINR(fee.finalAmountDue)}
                            </span>
                            <Tooltip
                              id={tipId}
                              place="top"
                              content={
                                <>
                                  <div>
                                    <strong>Original:</strong> {formatINR(fee.originalFeeDue)}
                                  </div>
                                  <div>
                                    <strong>Effective:</strong> {formatINR(fee.effectiveFeeDue)}
                                  </div>
                                  <div>
                                    <strong>Received:</strong> {formatINR(fee.totalFeeReceived)}
                                  </div>
                                  <div>
                                    <strong>Van Fee:</strong> {formatINR(fee.totalVanFeeReceived)}
                                  </div>
                                  <div>
                                    <strong>Concession:</strong>{" "}
                                    {formatINR(fee.totalConcessionReceived)}
                                  </div>
                                </>
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          <div className="mt-4">
            {/* Headwise Summary */}
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

            {/* Grand Summary */}
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
                <div className="small text-muted mt-2">
                  Note: “Previous Balance” is shown per student in the table (not part of headwise totals).
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedClass && filteredStudents.length === 0 && (
        <p className="text-muted">No student data matches your search.</p>
      )}

      {!selectedClass && (
        <p className="text-muted">Select a class to view due amounts.</p>
      )}
    </div>
  );
};

export default StudentDueTable;
