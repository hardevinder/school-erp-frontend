// File: src/components/StudentDueTable.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api"; // Custom Axios instance
import { Tooltip } from "react-tooltip";
import "react-tooltip/dist/react-tooltip.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { pdf } from "@react-pdf/renderer";
import * as XLSX from "xlsx";
import PdfStudentDueReport from "./PdfStudentDueReport";

/* ---------------- Helpers ---------------- */

// Indian format; show "-" for 0 / blank
const formatINR = (amount) => {
  if (amount === "" || amount === null || amount === undefined) return "-";
  if (Number(amount) === 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
};

// admission number safely
const getAdmissionNo = (s) =>
  s?.AdmissionNumber ??
  s?.admission_number ??
  s?.admissionNo ??
  s?.admission_no ??
  s?.admission_number ??
  s?.id ??
  "";

// student id safely
const getStudentId = (s) =>
  Number(s?.id ?? s?.student_id ?? s?.Student_ID ?? s?.StudentId ?? s?.Student?.id ?? 0);

// tooltip safe id
const safeId = (v) => String(v ?? "").replace(/[^\w-]+/g, "_");

// sum helper (skip blanks)
const sumNum = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v) || 0);

/* ---------------- Component ---------------- */

const StudentDueTable = () => {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  const [studentData, setStudentData] = useState([]);
  const [feeHeadings, setFeeHeadings] = useState([]);

  const [school, setSchool] = useState(null);

  // sessions
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);

  // previous balances
  const [prevBalanceMap, setPrevBalanceMap] = useState({});
  const [loadingPrev, setLoadingPrev] = useState(false);

  // UI: loading + error
  const [loadingMain, setLoadingMain] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // search
  const [search, setSearch] = useState("");

  /* ---------------- Loaders ---------------- */

  // School
  useEffect(() => {
    let alive = true;
    api
      .get("/schools")
      .then((response) => {
        if (!alive) return;
        const payload = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setSchool(payload[0] || null);
      })
      .catch((error) => console.error("Error fetching schools:", error));
    return () => {
      alive = false;
    };
  }, []);

  // Sessions (pick active)
  useEffect(() => {
    let alive = true;
    const fetchSessions = async () => {
      try {
        const res = await api.get("/sessions");
        if (!alive) return;

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
    return () => {
      alive = false;
    };
  }, []);

  // Classes
  useEffect(() => {
    let alive = true;
    api
      .get("/classes")
      .then((response) => {
        if (!alive) return;
        setClasses(Array.isArray(response.data) ? response.data : response.data?.data || []);
      })
      .catch((error) => console.error("Error fetching classes:", error));
    return () => {
      alive = false;
    };
  }, []);

  // ✅ Fee data (Session-wise!)
  useEffect(() => {
    let alive = true;

    const fetchFeeData = async () => {
      setErrorMsg("");
      setStudentData([]);
      setFeeHeadings([]);

      if (!selectedClass) return;
      if (!selectedSession) {
        setErrorMsg("Please select an academic session.");
        return;
      }

      setLoadingMain(true);
      try {
        const res = await api.get(`/feedue/class/${selectedClass}/fees`, {
          params: { session_id: selectedSession }, // ✅ IMPORTANT
        });

        if (!alive) return;

        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];

        setStudentData(data);

        // Build headings from union of all students' feeDetails (more robust than only [0])
        const headSet = new Set();
        data.forEach((stu) => {
          (stu.feeDetails || []).forEach((d) => {
            if (d?.fee_heading) headSet.add(d.fee_heading);
          });
        });
        setFeeHeadings(Array.from(headSet));
      } catch (error) {
        console.error("Error fetching fee data:", error);
        if (!alive) return;
        setErrorMsg(
          error?.response?.data?.message ||
            "Could not fetch fee data. Please check backend logs / auth."
        );
      } finally {
        if (alive) setLoadingMain(false);
      }
    };

    fetchFeeData();
    return () => {
      alive = false;
    };
  }, [selectedClass, selectedSession]);

  // Previous Balance per student for selected session (after studentData loads)
  useEffect(() => {
    let alive = true;

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

        if (!alive) return;

        const map = {};
        entries.forEach(([sid, val]) => {
          if (sid) map[sid] = val;
        });
        setPrevBalanceMap(map);
      } finally {
        if (alive) setLoadingPrev(false);
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [studentData, selectedSession]);

  /* ---------------- Summary Computations ---------------- */

  const computeHeadwiseSummary = () => {
    const summary = {};
    studentData.forEach((student) => {
      (student.feeDetails || []).forEach((fee) => {
        const heading = fee.fee_heading;
        if (!heading) return;

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

        summary[heading].originalFeeDue += sumNum(fee.originalFeeDue);
        summary[heading].effectiveFeeDue += sumNum(fee.effectiveFeeDue);
        summary[heading].finalAmountDue += sumNum(fee.finalAmountDue);
        summary[heading].totalFeeReceived += sumNum(fee.totalFeeReceived);
        summary[heading].totalVanFeeReceived += sumNum(fee.totalVanFeeReceived);
        summary[heading].totalConcessionReceived += sumNum(fee.totalConcessionReceived);
      });
    });
    return summary;
  };

  const computeGrandSummary = (headSummary) => {
    const grand = {
      originalFeeDue: 0,
      effectiveFeeDue: 0,
      finalAmountDue: 0,
      totalFeeReceived: 0,
      totalVanFeeReceived: 0,
      totalConcessionReceived: 0,
    };

    Object.values(headSummary).forEach((s) => {
      grand.originalFeeDue += sumNum(s.originalFeeDue);
      grand.effectiveFeeDue += sumNum(s.effectiveFeeDue);
      grand.finalAmountDue += sumNum(s.finalAmountDue);
      grand.totalFeeReceived += sumNum(s.totalFeeReceived);
      grand.totalVanFeeReceived += sumNum(s.totalVanFeeReceived);
      grand.totalConcessionReceived += sumNum(s.totalConcessionReceived);
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

  // Resolve names
  const selectedClassName =
    classes.find((cls) => Number(cls.id) === Number(selectedClass))?.class_name || selectedClass;

  const sessionLabel =
    sessions.find((s) => Number(s.id) === Number(selectedSession))?.name ||
    sessions.find((s) => Number(s.id) === Number(selectedSession))?.label ||
    (selectedSession ? String(selectedSession) : "");

  /* ---------------- Export to Excel ---------------- */

  const exportToExcel = () => {
    if (!selectedClass || studentData.length === 0) {
      alert("Please select a class with data first.");
      return;
    }
    if (!selectedSession) {
      alert("Please select a session first.");
      return;
    }

    // Sheet 1: Student Dues
    const studentHeader = ["Admission No.", "Student Name", "Previous Balance", ...feeHeadings];

    const studentRows = studentData.map((stu) => {
      const admNo = getAdmissionNo(stu);
      const sid = getStudentId(stu);
      const prevBal = prevBalanceMap[sid] || 0;

      const map = new Map((stu.feeDetails || []).map((f) => [f.fee_heading, f.finalAmountDue]));
      const perHead = feeHeadings.map((h) => sumNum(map.get(h)));
      return [admNo, stu.name, prevBal, ...perHead];
    });

    const studentSheet = XLSX.utils.aoa_to_sheet([
      [`Class Name: ${selectedClassName}`],
      [`Session: ${sessionLabel}`],
      [],
      studentHeader,
      ...studentRows,
    ]);

    studentSheet["!cols"] = [
      { wch: 16 },
      { wch: 28 },
      { wch: 18 },
      ...feeHeadings.map(() => ({ wch: 16 })),
    ];

    // Sheet 2: Headwise Summary
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
      sumNum(s.originalFeeDue),
      sumNum(s.effectiveFeeDue),
      sumNum(s.finalAmountDue),
      sumNum(s.totalFeeReceived),
      sumNum(s.totalVanFeeReceived),
      sumNum(s.totalConcessionReceived),
    ]);

    const headSheet = XLSX.utils.aoa_to_sheet([
      [`Class Name: ${selectedClassName}`],
      [`Session: ${sessionLabel}`],
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

    // Sheet 3: Grand Summary
    const grandRows = [
      ["Metric", "Amount"],
      ["Original Fee Due", sumNum(grandSummary.originalFeeDue)],
      ["Effective Fee Due", sumNum(grandSummary.effectiveFeeDue)],
      ["Final Due", sumNum(grandSummary.finalAmountDue)],
      ["Received", sumNum(grandSummary.totalFeeReceived)],
      ["Van Fee Received", sumNum(grandSummary.totalVanFeeReceived)],
      ["Concession Given", sumNum(grandSummary.totalConcessionReceived)],
    ];

    const grandSheet = XLSX.utils.aoa_to_sheet([
      [`Class Name: ${selectedClassName}`],
      [`Session: ${sessionLabel}`],
      [],
      ...grandRows,
    ]);

    grandSheet["!cols"] = [{ wch: 26 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, studentSheet, "Student Dues");
    XLSX.utils.book_append_sheet(wb, headSheet, "Headwise Summary");
    XLSX.utils.book_append_sheet(wb, grandSheet, "Grand Summary");

    XLSX.writeFile(
      wb,
      `StudentDue_${selectedClassName}_${String(sessionLabel).replace(/[^\w-]+/g, "_")}.xlsx`
    );
  };

  /* ---------------- PDF ---------------- */

  const openPdfInNewTab = async () => {
    if (!selectedClass) {
      alert("Please select a class.");
      return;
    }
    if (!selectedSession) {
      alert("Please select a session.");
      return;
    }

    const doc = (
      <PdfStudentDueReport
        school={school}
        selectedClass={selectedClassName}
        studentData={studentData}
        headSummary={headSummary}
        grandSummary={grandSummary}
        prevBalanceMap={prevBalanceMap}
        sessionLabel={sessionLabel}
      />
    );

    const asPdf = pdf(doc);
    const blob = await asPdf.toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  /* ---------------- UI ---------------- */

  const showActions = selectedClass && selectedSession && studentData.length > 0 && !loadingMain;

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h2 className="mb-1">Student Due Amounts</h2>
          <div className="text-muted small">
            {school ? (
              <>
                <strong>School:</strong> {school.name}
              </>
            ) : (
              "School loading…"
            )}
          </div>
        </div>

        {/* Quick status badge */}
        <div>
          {loadingMain ? (
            <span className="badge bg-warning text-dark">Loading data…</span>
          ) : selectedClass && selectedSession ? (
            <span className="badge bg-success">Ready</span>
          ) : (
            <span className="badge bg-secondary">Select Class + Session</span>
          )}
        </div>
      </div>

      {/* Controls Row */}
      <div className="row mb-4 align-items-end g-3">
        {/* Class Select */}
        <div className="col-md-3">
          <label htmlFor="classSelect" className="form-label">
            Select Class:
          </label>
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

        {/* Session Select */}
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
          <label htmlFor="searchBox" className="form-label">
            Search (name / admission no.)
          </label>
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
        <div className="col-md-2 d-flex justify-content-md-end gap-2">
          <button
            className="btn btn-success"
            onClick={exportToExcel}
            disabled={!showActions}
            title={!showActions ? "Select class + session and wait for data" : "Export Excel"}
          >
            Export Excel
          </button>
          <button
            className="btn btn-secondary"
            onClick={openPdfInNewTab}
            disabled={!showActions}
            title={!showActions ? "Select class + session and wait for data" : "Print PDF"}
          >
            Print PDF
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMsg ? (
        <div className="alert alert-danger py-2">{errorMsg}</div>
      ) : null}

      {/* Helpful hint */}
      {!selectedSession && selectedClass ? (
        <div className="alert alert-warning py-2">
          Please select a <strong>Session</strong> to view session-wise dues.
        </div>
      ) : null}

      {/* Loading */}
      {loadingMain ? (
        <div className="alert alert-info py-2">Fetching fee data…</div>
      ) : null}

      {/* Data */}
      {selectedClass && selectedSession && filteredStudents.length > 0 && !loadingMain && (
        <>
          {/* Student Data Table */}
          <div style={{ maxHeight: "420px", overflowY: "auto", position: "relative" }}>
            <table className="table table-bordered table-hover">
              <thead>
                <tr>
                  <th className="sticky-top bg-white" style={{ top: 0 }}>
                    Admission No.
                  </th>
                  <th className="sticky-top bg-white" style={{ top: 0 }}>
                    Student Name
                  </th>
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
                  const rowKey = safeId(admNo || sid);

                  const prevBal = prevBalanceMap[sid] || 0;

                  // Build a map so we always show columns in feeHeadings order
                  const map = new Map((student.feeDetails || []).map((f) => [f.fee_heading, f]));

                  return (
                    <tr key={rowKey}>
                      <td>{admNo}</td>
                      <td>{student.name}</td>

                      <td className={prevBal > 0 ? "fw-semibold text-danger" : ""}>
                        {formatINR(prevBal)}
                      </td>

                      {feeHeadings.map((h, idx) => {
                        const fee = map.get(h);
                        const tipId = `tooltip-${rowKey}-${idx}`;

                        const finalDue = fee?.finalAmountDue ?? "";
                        const original = fee?.originalFeeDue ?? 0;
                        const effective = fee?.effectiveFeeDue ?? 0;
                        const received = fee?.totalFeeReceived ?? 0;
                        const van = fee?.totalVanFeeReceived ?? 0;
                        const conc = fee?.totalConcessionReceived ?? 0;

                        return (
                          <td key={idx}>
                            <span data-tooltip-id={tipId} className="fw-semibold">
                              {formatINR(finalDue)}
                            </span>

                            <Tooltip
                              id={tipId}
                              place="top"
                              content={
                                <>
                                  <div>
                                    <strong>Original:</strong> {formatINR(original)}
                                  </div>
                                  <div>
                                    <strong>Effective:</strong> {formatINR(effective)}
                                  </div>
                                  <div>
                                    <strong>Received:</strong> {formatINR(received)}
                                  </div>
                                  <div>
                                    <strong>Van Fee:</strong> {formatINR(van)}
                                  </div>
                                  <div>
                                    <strong>Concession:</strong> {formatINR(conc)}
                                  </div>
                                  {fee?.admissionType ? (
                                    <div className="mt-1 small text-muted">
                                      admissionType: {String(fee.admissionType)}
                                    </div>
                                  ) : null}
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

      {/* Empty states */}
      {selectedClass && selectedSession && !loadingMain && filteredStudents.length === 0 && (
        <p className="text-muted">No student data matches your search (or no data for this session).</p>
      )}

      {!selectedClass && <p className="text-muted">Select a class to view due amounts.</p>}
    </div>
  );
};

export default StudentDueTable;
