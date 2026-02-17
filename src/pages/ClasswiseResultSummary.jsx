import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";

const ClasswiseResultSummary = () => {
  const [classExamSubjects, setClassExamSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
    exam_id: "",
    subjectComponents: [{ subject_id: "", component_ids: [], availableComponents: [] }],
    sum: false,
    includeGrades: false,
  });

  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [reportData, setReportData] = useState(null);

  const [displayMode, setDisplayMode] = useState("actual"); // "actual" | "weighted" | "both"
  const [numberFormat, setNumberFormat] = useState({
    decimalPoints: 2,
    rounding: "none", // "none" | "floor" | "ceiling"
  });

  const [pdfOrientation, setPdfOrientation] = useState("portrait");
  const [headerHTML, setHeaderHTML] = useState("");
  const [footerHTML, setFooterHTML] = useState("");

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [studentsPerPage, setStudentsPerPage] = useState(20);

  const reportRef = useRef();

  useEffect(() => {
    loadClassExamSubjects();
    loadSections();
  }, []);

  const loadClassExamSubjects = async () => {
    try {
      const res = await api.get("/exams/class-exam-subjects");
      setClassExamSubjects(res.data || []);
    } catch (err) {
      Swal.fire("Error", "Failed to load class-exam-subjects", "error");
    }
  };

  const loadSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(res.data || []);
    } catch (err) {
      Swal.fire("Error", "Failed to load sections", "error");
    }
  };

  // ✅ helper: build all subjects + preselect all components
  const buildPreselectedSubjectComponents = async ({ class_id, exam_id, subjectsList }) => {
    const results = await Promise.all(
      (subjectsList || []).map(async (s) => {
        try {
          const res = await api.get("/exam-schemes/components", {
            params: { class_id, subject_id: s.id, exam_id },
          });

          const comps = res.data || [];
          return {
            subject_id: String(s.id),
            availableComponents: comps,
            component_ids: comps.map((c) => c.component_id), // ✅ preselect all
          };
        } catch (e) {
          return { subject_id: String(s.id), availableComponents: [], component_ids: [] };
        }
      })
    );

    // optional: keep only subjects that actually have components
    // return results.filter(r => r.availableComponents.length > 0);
    return results;
  };

  const handleClassChange = (e) => {
    const class_id = e.target.value;
    const selectedClass = classExamSubjects.find((c) => c.class_id === parseInt(class_id));

    setExams(selectedClass?.exams || []);
    setSubjects([]);
    setReportData(null);

    setFilters({
      class_id,
      section_id: "",
      exam_id: "",
      subjectComponents: [{ subject_id: "", component_ids: [], availableComponents: [] }],
      sum: false,
      includeGrades: false,
    });
  };

  // ✅ UPDATED: auto add all subjects + preselect all components
  const handleExamChange = async (e) => {
    const exam_id = e.target.value;

    const selectedClass = classExamSubjects.find(
      (c) => c.class_id === parseInt(filters.class_id)
    );
    const selectedExam = selectedClass?.exams.find(
      (ex) => ex.exam_id === parseInt(exam_id)
    );

    const subjectsList = selectedExam?.subjects || [];
    setSubjects(subjectsList);
    setReportData(null);

    // reset immediately
    setFilters((prev) => ({
      ...prev,
      exam_id,
      subjectComponents: [],
      sum: false,
      includeGrades: false,
    }));

    // preselect all
    try {
      const preselected = await buildPreselectedSubjectComponents({
        class_id: filters.class_id,
        exam_id,
        subjectsList,
      });

      setFilters((prev) => ({
        ...prev,
        subjectComponents: preselected.length
          ? preselected
          : [{ subject_id: "", component_ids: [], availableComponents: [] }],
      }));
    } catch (err) {
      Swal.fire("Error", "Failed to auto-load subject components", "error");
      setFilters((prev) => ({
        ...prev,
        subjectComponents: [{ subject_id: "", component_ids: [], availableComponents: [] }],
      }));
    }
  };

  // keep manual subject change option (if you add manually)
  const handleSubjectChange = async (e, index) => {
    const subject_id = e.target.value;
    try {
      const res = await api.get("/exam-schemes/components", {
        params: {
          class_id: filters.class_id,
          subject_id,
          exam_id: filters.exam_id,
        },
      });

      const comps = res.data || [];
      setFilters((prev) => {
        const updated = [...prev.subjectComponents];
        updated[index] = {
          subject_id,
          availableComponents: comps,
          component_ids: comps.map((c) => c.component_id), // ✅ preselect all even here
        };
        return { ...prev, subjectComponents: updated };
      });
    } catch {
      Swal.fire("Error", "Failed to load components", "error");
    }
  };

  const handleComponentToggle = (e, index) => {
    const compId = parseInt(e.target.value);
    const checked = e.target.checked;

    setFilters((prev) => {
      const updated = [...prev.subjectComponents];
      const current = { ...updated[index] };

      current.component_ids = checked
        ? Array.from(new Set([...(current.component_ids || []), compId]))
        : (current.component_ids || []).filter((id) => id !== compId);

      updated[index] = current;
      return { ...prev, subjectComponents: updated };
    });
  };

  const addSubject = () => {
    setFilters((prev) => ({
      ...prev,
      subjectComponents: [
        ...prev.subjectComponents,
        { subject_id: "", component_ids: [], availableComponents: [] },
      ],
    }));
  };

  // ✅ allow removing any subject, but keep at least 1
  const removeSubject = (index) => {
    setFilters((prev) => {
      const updated = [...prev.subjectComponents];
      updated.splice(index, 1);
      return {
        ...prev,
        subjectComponents: updated.length
          ? updated
          : [{ subject_id: "", component_ids: [], availableComponents: [] }],
      };
    });
  };

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleNumberFormatChange = (e) => {
    const { name, value } = e.target;
    setNumberFormat((prev) => ({ ...prev, [name]: value }));
  };

  const formatNumber = (value) => {
    if (value == null || isNaN(value)) return value;

    let formatted = parseFloat(value);
    const dp = parseInt(numberFormat.decimalPoints);

    if (numberFormat.rounding === "floor") {
      formatted = Math.floor(formatted * Math.pow(10, dp)) / Math.pow(10, dp);
    } else if (numberFormat.rounding === "ceiling") {
      formatted = Math.ceil(formatted * Math.pow(10, dp)) / Math.pow(10, dp);
    }

    return formatted.toFixed(dp);
  };

  const fetchReport = async () => {
    const { class_id, section_id, exam_id, subjectComponents, sum, includeGrades } = filters;

    // ✅ only keep valid selected subjects (after user removals/unchecks)
    const validSC = (subjectComponents || []).filter(
      (sc) => sc.subject_id && sc.component_ids && sc.component_ids.length > 0
    );

    if (!class_id || !section_id || !exam_id || validSC.length === 0) {
      return Swal.fire(
        "Missing Fields",
        "Please select all filters and keep at least one subject with one component.",
        "warning"
      );
    }

    try {
      const payload = {
        class_id,
        section_id,
        exam_id,
        subjectComponents: validSC.map((sc) => ({
          subject_id: parseInt(sc.subject_id),
          component_ids: sc.component_ids,
        })),
        sum,
        showSubjectTotals: true,
        includeGrades,
      };

      const res = await api.post("/marks-entry/report-summary", payload);
      setReportData(
        res.data || {
          students: [],
          subjectComponentGroups: [],
          summary: { components: {}, total: {} },
        }
      );
    } catch (err) {
      Swal.fire("Error", "Failed to fetch report", "error");
    }
  };

  // ✅ FIXED: open + download with .pdf extension correctly
 const handleExportPDF = async () => {
  if (!reportRef.current) return Swal.fire("Error", "Report not found.", "error");

  try {
    const headerHTMLWithBreaks = headerHTML.replace(/\n/g, "<br/>");
    const footerHTMLWithBreaks = footerHTML.replace(/\n/g, "<br/>");

    const htmlContent = `
      <h3 style="text-align:center;">${headerHTMLWithBreaks}</h3>
      ${reportRef.current.innerHTML}
      <div class="footer" style="margin-top:20px; text-align:right; font-size:12px;">
        ${footerHTMLWithBreaks}
      </div>
    `;

    const res = await api.post(
      "/student-result-report/generate-pdf",
      {
        html: htmlContent,
        filters,
        fileName: "ClasswiseResultSummary",
        orientation: pdfOrientation,
      },
      { responseType: "blob" }
    );

    const blob = new Blob([res.data], {
      type: res.headers?.["content-type"] || "application/pdf",
    });

    const url = window.URL.createObjectURL(blob);

    // ✅ like Students.js: open first
    const win = window.open(url, "_blank");

    // ✅ if popup blocked, then download with proper .pdf filename
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `ClasswiseResultSummary_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // cleanup
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    console.error(err);
    Swal.fire("Error", "Failed to generate PDF", "error");
  }
};


  return (
    <div className="container mt-4">
      <h2>📊 Classwise Result Summary</h2>

      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">Filters</h5>

          <div className="row g-3">
            <div className="col-md-3">
              <label>Class</label>
              <select className="form-select" value={filters.class_id} onChange={handleClassChange}>
                <option value="">Select Class</option>
                {classExamSubjects.map((c) => (
                  <option key={c.class_id} value={c.class_id}>
                    {c.class_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label>Section</label>
              <select
                className="form-select"
                name="section_id"
                value={filters.section_id}
                onChange={handleFilterChange}
              >
                <option value="">Select Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label>Exam</label>
              <select className="form-select" value={filters.exam_id} onChange={handleExamChange}>
                <option value="">Select Exam</option>
                {exams.map((e) => (
                  <option key={e.exam_id} value={e.exam_id}>
                    {e.exam_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check me-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="sum"
                  checked={filters.sum}
                  onChange={handleFilterChange}
                />
                <label className="form-check-label">Include Total</label>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  name="includeGrades"
                  checked={filters.includeGrades}
                  onChange={handleFilterChange}
                />
                <label className="form-check-label">Include Grades</label>
              </div>
            </div>

            <div className="col-md-6 mt-2">
              <label className="fw-bold">Display Mode:</label>
              <div className="d-flex gap-3 align-items-center ms-2">
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="displayMode"
                    id="actual"
                    value="actual"
                    checked={displayMode === "actual"}
                    onChange={(e) => setDisplayMode(e.target.value)}
                  />
                  <label className="form-check-label" htmlFor="actual">
                    Actual
                  </label>
                </div>

                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="displayMode"
                    id="weighted"
                    value="weighted"
                    checked={displayMode === "weighted"}
                    onChange={(e) => setDisplayMode(e.target.value)}
                  />
                  <label className="form-check-label" htmlFor="weighted">
                    Weighted %
                  </label>
                </div>

                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="displayMode"
                    id="both"
                    value="both"
                    checked={displayMode === "both"}
                    onChange={(e) => setDisplayMode(e.target.value)}
                  />
                  <label className="form-check-label" htmlFor="both">
                    Both
                  </label>
                </div>
              </div>
            </div>

            <div className="col-md-6 mt-2">
              <label className="fw-bold">Number Format:</label>
              <div className="d-flex gap-4 align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <label className="fw-normal mb-0">Decimal Points:</label>
                  <select
                    className="form-select form-select-sm"
                    name="decimalPoints"
                    value={numberFormat.decimalPoints}
                    onChange={handleNumberFormatChange}
                    style={{ width: "80px" }}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <label className="fw-normal mb-0">Rounding:</label>
                  <select
                    className="form-select form-select-sm"
                    name="rounding"
                    value={numberFormat.rounding}
                    onChange={handleNumberFormatChange}
                    style={{ width: "120px" }}
                  >
                    <option value="none">None</option>
                    <option value="floor">Floor</option>
                    <option value="ceiling">Ceiling</option>
                  </select>
                </div>

                <div className="col-md-2 mt-2">
                  <label className="fw-bold small mb-1">PDF Orientation:</label>
                  <select
                    className="form-select form-select-sm"
                    value={pdfOrientation}
                    onChange={(e) => setPdfOrientation(e.target.value)}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div className="col-md-2 mt-2">
                  <label className="fw-bold small mb-1">Students per page:</label>
                  <select
                    className="form-select form-select-sm"
                    value={studentsPerPage}
                    onChange={(e) => setStudentsPerPage(parseInt(e.target.value))}
                  >
                    {[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(
                      (n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <hr />
          <h6>Subjects & Components</h6>

          <div className="d-flex flex-wrap gap-3 mt-3">
            {filters.subjectComponents.map((sc, index) => (
              <div className="border p-3 rounded" key={index} style={{ minWidth: "280px" }}>
                <label className="fw-bold">Subject</label>
                <select
                  className="form-select mb-2"
                  value={sc.subject_id}
                  onChange={(e) => handleSubjectChange(e, index)}
                >
                  <option value="">Select Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <label className="fw-bold">Components</label>
                <div className="d-flex flex-wrap gap-2">
                  {sc.availableComponents?.map((c) => (
                    <div key={c.component_id} className="form-check me-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        value={c.component_id}
                        checked={(sc.component_ids || []).includes(c.component_id)}
                        onChange={(e) => handleComponentToggle(e, index)}
                        id={`comp-${index}-${c.component_id}`}
                      />
                      <label className="form-check-label" htmlFor={`comp-${index}-${c.component_id}`}>
                        {c.abbreviation || c.name}
                      </label>
                    </div>
                  ))}
                </div>

                {filters.subjectComponents.length > 1 && (
                  <div className="mt-2">
                    <button className="btn btn-sm btn-danger" onClick={() => removeSubject(index)}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3">
            <button className="btn btn-success me-2" onClick={addSubject}>
              ➕ Add Subject
            </button>
            <button className="btn btn-primary" onClick={fetchReport}>
              🔍 Generate Report
            </button>
          </div>
        </div>
      </div>

      {reportData && reportData.students?.length > 0 && (
        <>
          <div className="text-end mb-3">
            <button className="btn btn-danger" onClick={() => setShowPdfModal(true)}>
              🖨️ Export PDF
            </button>
          </div>

          <div ref={reportRef} className="card">
            <div className="card-body">
              <h5 className="card-title">Report Data</h5>
              <div className="table-responsive">
                <table className="table table-bordered text-center align-middle">
                  <thead>
                    <tr>
                      <th rowSpan="2">Roll No</th>
                      <th rowSpan="2" className="text-start">
                        Name
                      </th>

                      {reportData.subjectComponentGroups.map((group, idx) => {
                        const totalW = group.components.reduce(
                          (sum, c) => sum + (c.weightage_percent || 0),
                          0
                        );
                        return (
                          <th
                            key={idx}
                            colSpan={
                              group.components.length +
                              (filters.sum ? 1 : 0) +
                              (filters.includeGrades ? 1 : 0)
                            }
                          >
                            {group.subject_name}
                            <br />
                            <small>({totalW})</small>
                          </th>
                        );
                      })}

                      {(filters.sum || filters.includeGrades) && (
                        <th colSpan={(filters.sum ? 1 : 0) + (filters.includeGrades ? 1 : 0) + 1}>
                          Grand Total
                          <br />
                        </th>
                      )}
                    </tr>

                    <tr>
                      {reportData.subjectComponentGroups.flatMap((group) => {
                        const compHeaders = group.components.map((comp) => {
                          const w = Math.round(comp.weightage_percent || 0);
                          return (
                            <th key={`${group.subject_id}_${comp.component_id}`}>
                              {comp.name}
                              <br />
                              <small>{w}</small>
                            </th>
                          );
                        });

                        const totalHeader = filters.sum ? (
                          <th key={`sub-total-${group.subject_id}`}>
                            Total
                            <br />
                            <small>
                              {group.components.reduce((s, c) => s + (c.weightage_percent || 0), 0)}
                            </small>
                          </th>
                        ) : null;

                        const gradeHeader = filters.includeGrades ? (
                          <th key={`sub-grade-${group.subject_id}`}>Grade</th>
                        ) : null;

                        return [...compHeaders, totalHeader, gradeHeader];
                      })}

                      {filters.sum && <th>Marks</th>}
                      {filters.includeGrades && <th>%age</th>}
                      {filters.includeGrades && <th>Grade</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {reportData.students.map((stu, index) => (
                      <React.Fragment key={stu.id}>
                        <tr>
                          <td>{stu.roll_number}</td>
                          <td className="text-start">{stu.name}</td>

                          {reportData.subjectComponentGroups.flatMap((group) => {
                            const compMarks = group.components.map((comp) => {
                              const c = stu.components.find(
                                (x) =>
                                  x.component_id === comp.component_id &&
                                  x.subject_id === group.subject_id
                              );

                              return (
                                <td key={`${stu.id}_${comp.component_id}`}>
                                  {c?.attendance !== "P"
                                    ? c?.attendance
                                    : displayMode === "actual"
                                    ? formatNumber(c?.marks)
                                    : displayMode === "weighted"
                                    ? formatNumber(c?.weighted_marks)
                                    : `${formatNumber(c?.marks)} (${formatNumber(
                                        c?.weighted_marks
                                      )})`}
                                </td>
                              );
                            });

                            const subjectTotal =
                              displayMode === "actual"
                                ? stu.subject_totals_raw?.[group.subject_id]
                                : displayMode === "weighted"
                                ? stu.subject_totals_weighted?.[group.subject_id]
                                : `${formatNumber(stu.subject_totals_raw?.[group.subject_id])} (${formatNumber(
                                    stu.subject_totals_weighted?.[group.subject_id]
                                  )})`;

                            const totalCell = filters.sum ? (
                              <td key={`sub-total-${stu.id}-${group.subject_id}`}>
                                {formatNumber(subjectTotal)}
                              </td>
                            ) : null;

                            const gradeCell = filters.includeGrades ? (
                              <td key={`sub-grade-${stu.id}-${group.subject_id}`}>
                                {stu.subject_grades?.[group.subject_id] || "-"}
                              </td>
                            ) : null;

                            return [...compMarks, totalCell, gradeCell];
                          })}

                          {filters.sum && (
                            <td>
                              {displayMode === "actual"
                                ? formatNumber(stu.total_raw)
                                : displayMode === "weighted"
                                ? formatNumber(stu.total_weighted)
                                : `${formatNumber(stu.total_raw)} / ${formatNumber(stu.total_weighted)}`}
                            </td>
                          )}

                          {filters.includeGrades && (
                            <td>
                              {displayMode === "actual"
                                ? formatNumber(stu.grand_percent_raw)
                                : displayMode === "weighted"
                                ? formatNumber(stu.grand_percent_weighted)
                                : `${formatNumber(stu.grand_percent_raw)} / ${formatNumber(
                                    stu.grand_percent_weighted
                                  )}`}
                            </td>
                          )}

                          {filters.includeGrades && (
                            <td>
                              {displayMode === "actual"
                                ? stu.total_grade_raw || "-"
                                : displayMode === "weighted"
                                ? stu.total_grade_weighted || "-"
                                : `${stu.total_grade_raw || "-"} / ${stu.total_grade_weighted || "-"}`}
                            </td>
                          )}
                        </tr>

                        {(index + 1) % studentsPerPage === 0 && (
                          <tr className="page-break">
                        <td
                              colSpan={
                                2 +
                                reportData.subjectComponentGroups.reduce(
                                  (sum, g) =>
                                    sum +
                                    g.components.length +
                                    (filters.sum ? 1 : 0) +
                                    (filters.includeGrades ? 1 : 0), // subject grade = 1 column (OK)
                                  0
                                ) +
                                (filters.sum ? 1 : 0) +            // grand total marks = 1 column (only if sum)
                                (filters.includeGrades ? 2 : 0)    // ✅ grand total %age + grade = 2 columns
                              }
                            />

                          </tr>
                        )}
                      </React.Fragment>
                    ))}

                    {(filters.sum || filters.includeGrades) && (
                      <tr className="fw-bold bg-light">
                        <td colSpan="2" className="text-end">
                          Subject Totals:
                        </td>

                        {reportData.subjectComponentGroups.flatMap((group) => {
                          const blankCompCells = group.components.map((comp) => (
                            <td key={`blank_${group.subject_id}_${comp.component_id}`}></td>
                          ));

                          const grandSubjectTotal =
                            displayMode === "actual"
                              ? reportData.summary?.subject_totals_raw?.[group.subject_id]
                              : displayMode === "weighted"
                              ? reportData.summary?.subject_totals_weighted?.[group.subject_id]
                              : `${formatNumber(reportData.summary?.subject_totals_raw?.[group.subject_id])} (${formatNumber(
                                  reportData.summary?.subject_totals_weighted?.[group.subject_id]
                                )})`;

                          const totalCell = filters.sum ? (
                            <td key={`grand-sub-total-${group.subject_id}`}>
                              {formatNumber(grandSubjectTotal)}
                            </td>
                          ) : null;

                          const gradeCell = filters.includeGrades ? (
                            <td key={`grand-sub-grade-${group.subject_id}`}>
                              {reportData.students[0]?.subject_grades?.[group.subject_id] || "-"}
                            </td>
                          ) : null;

                          return [...blankCompCells, totalCell, gradeCell];
                        })}

                        {filters.sum && (
                          <td>
                            {displayMode === "actual"
                              ? formatNumber(reportData.summary?.grand_total)
                              : displayMode === "weighted"
                              ? formatNumber(reportData.summary?.grand_total_weighted)
                              : `${formatNumber(reportData.summary?.grand_total)} / ${formatNumber(
                                  reportData.summary?.grand_total_weighted
                                )}`}
                          </td>
                        )}

                        {filters.includeGrades && (
                          <td>
                            {displayMode === "actual"
                              ? formatNumber(reportData.summary?.grand_percent_raw)
                              : displayMode === "weighted"
                              ? formatNumber(reportData.summary?.grand_percent_weighted)
                              : `${formatNumber(reportData.summary?.grand_percent_raw)} / ${formatNumber(
                                  reportData.summary?.grand_percent_weighted
                                )}`}
                          </td>
                        )}

                        {filters.includeGrades && (
                          <td>
                            {displayMode === "actual"
                              ? reportData.summary?.grand_total_grade || "-"
                              : displayMode === "weighted"
                              ? reportData.summary?.grand_total_weighted_grade || "-"
                              : `${reportData.summary?.grand_total_grade || "-"} / ${reportData.summary?.grand_total_weighted_grade || "-"}`}
                          </td>
                        )}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <Modal show={showPdfModal} onHide={() => setShowPdfModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Customize PDF Header & Footer</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <label className="fw-bold">Header</label>
              <textarea
                className="form-control"
                rows={5}
                style={{ direction: "ltr", whiteSpace: "pre-wrap" }}
                value={headerHTML}
                onChange={(e) => setHeaderHTML(e.target.value)}
              />

              <label className="fw-bold mt-3">Footer</label>
              <textarea
                className="form-control"
                rows={5}
                style={{ direction: "ltr", whiteSpace: "pre-wrap" }}
                value={footerHTML}
                onChange={(e) => setFooterHTML(e.target.value)}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowPdfModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowPdfModal(false);
                  handleExportPDF();
                }}
              >
                Generate PDF
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
    </div>
  );
};

export default ClasswiseResultSummary;
