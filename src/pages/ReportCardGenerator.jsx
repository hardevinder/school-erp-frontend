import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button } from "react-bootstrap";

const FinalResultSummary = () => {
  const [classList, setClassList] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [exams, setExams] = useState([]);
  const [showTotals, setShowTotals] = useState(true);
  const [studentInfoMap, setStudentInfoMap] = useState({});
  const [coScholasticData, setCoScholasticData] = useState([]);
  const [remarksData, setRemarksData] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [gradeSchema, setGradeSchema] = useState([]);
  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
    exam_ids: [],
    subjectComponents: [
      { subject_id: "", selected_components: {}, availableComponents: [] }
    ]
  });
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reportFormat, setReportFormat] = useState(null);
  const [numberFormat, setNumberFormat] = useState({
    decimalPoints: 2,
    rounding: "none"
  });

  const downloadPDF = async () => {
  if (!reportData.length) {
    return Swal.fire("No Data", "Please generate the report first", "info");
  }

  try {
    const payload = {
      students: reportData,
      reportFormat,
      numberFormat,
    };

    const res = await api.post("/report-card/generate-pdf/report-card", payload, {
      responseType: "blob",
    });

    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "report-cards.pdf");
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error(error);
    Swal.fire("Error", "Failed to generate PDF", "error");
  }
};


  useEffect(() => {
    loadClasses();
    loadSections();
    loadExams();
    loadGradeSchema();
  }, []);

  const loadClasses = async () => {
    try {
      const res = await api.get("/classes");
      setClassList(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to load classes", "error");
    }
  };

  const loadSections = async () => {
    try {
      const res = await api.get("/sections");
      setSections(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to load sections", "error");
    }
  };

  const loadExams = async () => {
    try {
      const res = await api.get("/exams");
      setExams(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to load exams", "error");
    }
  };

  const loadGradeSchema = async () => {
    try {
      const res = await api.get("/grade-schemes");
      setGradeSchema(res.data.data || []);
    } catch {
      Swal.fire("Error", "Failed to load grade schema", "error");
    }
  };

  const handleExamChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
    setFilters(prev => ({ ...prev, exam_ids: selectedOptions }));
  };

  const loadSubjects = async (class_id) => {
    try {
      const res = await api.get("/subjects", { params: { class_id } });
      setSubjects(Array.isArray(res.data.subjects) ? res.data.subjects : []);
    } catch {
      Swal.fire("Error", "Failed to load subjects", "error");
      setSubjects([]);
    }
  };

  const handleClassChange = async (e) => {
    const class_id = e.target.value;

    setFilters({
      class_id,
      section_id: "",
      exam_ids: [],
      subjectComponents: [
        { subject_id: "", selected_components: {}, availableComponents: [] }
      ]
    });

    setSubjects([]);

    if (class_id) {
      loadSubjects(class_id);
      try {
        const res = await api.get("/report-card/format-by-class", { params: { class_id } });
        setReportFormat(res.data?.format || null);
      } catch {
        setReportFormat(null);
        Swal.fire("Error", "Failed to load report card format", "error");
      }
    } else {
      setReportFormat(null);
    }
  };

  const handleSubjectChange = async (e, index) => {
    const subject_id = e.target.value;
    try {
      const res = await api.get("/exam-schemes/components/term-wise", {
        params: { class_id: filters.class_id, subject_id }
      });
      const availableComponents = res.data || [];
      setFilters(prev => {
        const updated = [...prev.subjectComponents];
        updated[index] = { subject_id, availableComponents, selected_components: {} };
        return { ...prev, subjectComponents: updated };
      });
    } catch {
      Swal.fire("Error", "Failed to load components", "error");
    }
  };

  const handleComponentToggle = (term_id, compId, index, checked) => {
    setFilters(prev => {
      const updated = [...prev.subjectComponents];
      const selected = { ...(updated[index].selected_components || {}) };
      if (!selected[term_id]) selected[term_id] = [];
      if (checked) selected[term_id] = [...selected[term_id], compId];
      else selected[term_id] = selected[term_id].filter(id => id !== compId);
      updated[index].selected_components = selected;
      return { ...prev, subjectComponents: updated };
    });
  };

  const addSubject = () => setFilters(prev => ({
    ...prev,
    subjectComponents: [...prev.subjectComponents, { subject_id: "", selected_components: {}, availableComponents: [] }]
  }));

  const removeSubject = (index) => setFilters(prev => ({
    ...prev,
    subjectComponents: prev.subjectComponents.filter((_, i) => i !== index)
  }));

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchReport = async () => {
    const { class_id, section_id, exam_ids } = filters;
    if (!class_id || !section_id || !exam_ids.length) {
      return Swal.fire("Missing Field", "Select class, section & exam(s)", "warning");
    }

    setLoading(true);
    const payload = {
      class_id: +class_id,
      section_id: +section_id,
      exam_ids,
      subjectComponents: filters.subjectComponents.map(sc => ({
        subject_id: +sc.subject_id,
        component_ids: Object.values(sc.selected_components).flat()
      })),
      sum: true,
      showSubjectTotals: true,
      includeGrades: true
    };

    try {
      const res = await api.post("/report-card/detailed-summary", payload);
      const reportStudents = res.data.students || [];
      if (!reportStudents.length) {
        Swal.fire("No Data", "No students found for the selected filters", "info");
        setReportData([]);
        setStudentInfoMap({});
        setCoScholasticData([]);
        setRemarksData({});
        setAttendanceData({});
        setLoading(false);
        return;
      }
      setReportData(reportStudents);

      const studentIds = reportStudents.map(s => s.id);
      const infoRes = await api.get("/report-card/students", { params: { student_ids: studentIds } });
      const studentMap = {};
      for (const s of infoRes.data.students || []) {
        studentMap[s.id] = s;
      }
      setStudentInfoMap(studentMap);

      const coScholasticRes = await api.get("/report-card/coscholastic-summary", {
        params: { class_id, section_id, term_id: "1" }
      });
      setCoScholasticData(coScholasticRes.data || []);

      const remarksRes = await api.get("/report-card/remarks-summary", {
        params: { class_id, section_id, term_id: "1" }
      });
      const remarksMap = {};
      for (const r of remarksRes.data.remarks || []) {
        remarksMap[r.student_id] = r.remark;
      }
      setRemarksData(remarksMap);

      const attendanceRes = await api.get("/report-card/attendance-summary", {
        params: { class_id, section_id, term_id: "1" }
      });
      const attendanceMap = {};
      for (const a of attendanceRes.data.attendance || []) {
        attendanceMap[a.student_id] = a;
      }
      setAttendanceData(attendanceMap);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch report data", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = value => {
    if (value == null || isNaN(value)) return "-";
    let num = +value;
    const pow = 10 ** numberFormat.decimalPoints;
    if (numberFormat.rounding === 'floor') num = Math.floor(num * pow) / pow;
    if (numberFormat.rounding === 'ceiling') num = Math.ceil(num * pow) / pow;
    return num.toFixed(numberFormat.decimalPoints);
  };

  const getUniqueComponentsByExam = (examId) => {
    const termId = exams.find(e => e.id === examId)?.term_id;
    const compMap = new Map();

    filters.subjectComponents.forEach(sc => {
      const comps = sc.availableComponents.filter(c =>
        (filters.exam_ids.includes(examId)) &&
        (sc.selected_components[termId] || []).includes(c.component_id)
      );

      comps.forEach(c => {
        if (!compMap.has(c.component_id)) {
          compMap.set(c.component_id, {
            component_id: c.component_id,
            label: c.abbreviation || c.name
          });
        }
      });
    });

    return Array.from(compMap.values());
  };

  const getUniqueCoScholasticAreas = () => {
    const areas = new Set();
    coScholasticData.forEach(student => {
      student.grades.forEach(grade => areas.add(grade.area_name));
    });
    return Array.from(areas);
  };

  return (
    <div className="container mt-4">
      <h2>📘 Final Result Summary</h2>

      <div className="row g-3 mt-3">
        <div className="col-md-4">
          <label>Class</label>
          <select className="form-select" value={filters.class_id} onChange={handleClassChange}>
            <option value="">Select Class</option>
            {classList.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label>Section</label>
          <select name="section_id" className="form-select" value={filters.section_id} onChange={handleFilterChange}>
            <option value="">Select Section</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label>Exam(s)</label>
          <select multiple className="form-select" value={filters.exam_ids} onChange={handleExamChange}>
            {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <h5>Subjects & Components</h5>
        <div className="d-flex flex-wrap gap-3">
          {filters.subjectComponents.map((sc, i) => (
            <div key={i} className="border p-3 rounded" style={{ minWidth: 200 }}>
              <select className="form-select mb-2" value={sc.subject_id} onChange={e => handleSubjectChange(e, i)}>
                <option value="">Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {Object.entries(sc.availableComponents.reduce((a,c)=>{(a[c.term_id]||(a[c.term_id]=[])).push(c);return a;},{})).map(
                ([term, comps])=> (
                  <div key={term}>
                    <small className="fw-bold">Term {term}</small>
                    <div className="d-flex flex-wrap">
                      {comps.map(c=> (
                        <div key={c.component_id} className="form-check me-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`c-${term}-${i}-${c.component_id}`}
                            checked={(sc.selected_components[term]||[]).includes(c.component_id)}
                            onChange={e=>handleComponentToggle(+term,c.component_id,i,e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor={`c-${term}-${i}-${c.component_id}`}>{c.abbreviation||c.name}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
              {i>0 && <button className="btn btn-sm btn-danger mt-2" onClick={()=>removeSubject(i)}>Remove</button>}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button className="btn btn-success me-2" onClick={addSubject}>Add Subject</button>
          <button className="btn btn-primary" onClick={fetchReport} disabled={loading}>{loading? 'Loading…':'Generate Report'}</button>
        </div>
      </div>
      <div className="form-check form-switch my-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="toggleTotals"
          checked={showTotals}
          onChange={() => setShowTotals(prev => !prev)}
        />
        <label className="form-check-label" htmlFor="toggleTotals">
          Show Total and Grade Columns
        </label>
      </div>

      {loading && (
        <div className="text-center my-5">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}
      {!loading && reportData.length === 0 && (
        <div className="text-center my-5">
          No report data available. Please select filters and generate the report.
        </div>
      )}

      {!loading && reportData.length > 0 && (
        <div className="mt-5">
          <div className="d-flex justify-content-end">
  <button className="btn btn-outline-dark mb-3" onClick={downloadPDF}>
    📄 Download Report Cards as PDF
  </button>
</div>

          {reportData.map(student => {
            if (!studentInfoMap[student.id]) {
              console.warn(`Student ID ${student.id} not found in studentInfoMap`);
              return (
                <div key={student.id} className="mb-5">
                  <p className="text-danger">Student data not found for ID: {student.id}</p>
                </div>
              );
            }
            const coScholastic = coScholasticData.find(s => s.id === student.id) || { grades: [] };
            const remark = remarksData[student.id] || "-";
            const attendance = attendanceData[student.id] || {
              total_days: 0,
              present_days: 0,
              absent_days: 0,
              leave_days: 0,
              holiday_days: 0,
              late_days: 0,
              attendance_percentage: null
            };
            return (
              <div key={student.id} className="mb-5">
                {reportFormat?.header_html && (
                  <div className="report-header mb-3">
                    <div className="d-flex align-items-center justify-content-between">
                      {reportFormat.school_logo_url ? (
                        <img
                          src={reportFormat.school_logo_url}
                          alt="School Logo"
                          style={{ height: "80px", marginRight: "10px" }}
                        />
                      ) : (
                        <div style={{ width: "80px" }} />
                      )}
                      <div
                        className="flex-grow-1 text-center"
                        dangerouslySetInnerHTML={{ __html: reportFormat.header_html }}
                      />
                      {reportFormat.board_logo_url ? (
                        <img
                          src={reportFormat.board_logo_url}
                          alt="Board Logo"
                          style={{ height: "80px", marginLeft: "10px" }}
                        />
                      ) : (
                        <div style={{ width: "80px" }} />
                      )}
                    </div>
                  </div>
                )}

                <div className="row g-3 small border p-3 mb-3">
                  <div className="col-md-6">
                    <strong>Name:</strong> {studentInfoMap[student.id]?.name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Admission No.:</strong> {studentInfoMap[student.id]?.admission_number || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Roll No.:</strong> {studentInfoMap[student.id]?.roll_number || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Class & Section:</strong>{" "}
                    {studentInfoMap[student.id]?.Class?.class_name || "-"} -{" "}
                    {studentInfoMap[student.id]?.Section?.section_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Father's Name:</strong> {studentInfoMap[student.id]?.father_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Mother's Name:</strong> {studentInfoMap[student.id]?.mother_name || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Phone:</strong>{" "}
                    {studentInfoMap[student.id]?.father_phone || studentInfoMap[student.id]?.mother_phone || "-"}
                  </div>
                  <div className="col-md-6">
                    <strong>Aadhaar No.:</strong> {studentInfoMap[student.id]?.aadhaar_number || "-"}
                  </div>
                </div>

                <h4 className="fw-bold">
                  {studentInfoMap[student.id]?.name} (Roll: {studentInfoMap[student.id]?.roll_number})
                </h4>

                <h5>Scholastic Areas</h5>
                <table className="table table-bordered text-center small">
                  <thead>
                    <tr>
                      <th
                        rowSpan={2}
                        style={{
                          backgroundColor: '#dff0ff',
                          color: '#003366',
                          textAlign: 'left'
                        }}
                      >
                        Subject
                      </th>
                      {filters.exam_ids.map(exId => {
                        const uniqueComps = getUniqueComponentsByExam(exId);
                        return (
                          <th
                            key={exId}
                            colSpan={uniqueComps.length + (showTotals ? 2 : 0)}
                            style={{ backgroundColor: '#dff0ff', color: '#003366' }}
                          >
                            {exams.find(e => e.id === exId)?.name}
                          </th>
                        );
                      })}
                      {showTotals && (
                        <th colSpan="2" style={{ backgroundColor: '#dff0ff', color: '#003366' }}>
                          Total
                        </th>
                      )}
                    </tr>
                    <tr>
                      {filters.exam_ids.map(exId => (
                        <React.Fragment key={exId}>
                          {getUniqueComponentsByExam(exId).map(comp => (
                            <th
                              key={`c-${exId}-${comp.component_id}`}
                              style={{ backgroundColor: '#e6f4ff' }}
                            >
                              {comp.label}
                            </th>
                          ))}
                          {showTotals && (
                            <>
                              <th style={{ backgroundColor: '#e6f4ff', fontWeight: 'bold' }}>Marks</th>
                              <th style={{ backgroundColor: '#e6f4ff', fontWeight: 'bold' }}>Grade</th>
                            </>
                          )}
                        </React.Fragment>
                      ))}
                      {showTotals && (
                        <>
                          <th style={{ backgroundColor: '#e6f4ff', fontWeight: 'bold' }}>Marks</th>
                          <th style={{ backgroundColor: '#e6f4ff', fontWeight: 'bold' }}>Grade</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set(student.components.map(c => c.subject_name))].map((sub, si) => {
                      const subjComps = student.components.filter(c => c.subject_name === sub);
                      return (
                        <tr key={si}>
                          <td
                            style={{
                              backgroundColor: '#dff0ff',
                              fontWeight: 'bold',
                              textAlign: 'left'
                            }}
                          >
                            {sub}
                          </td>
                          {filters.exam_ids.map(exId => {
                            const ecs = subjComps.filter(c => c.exam_id === exId);
                            return (
                              <React.Fragment key={exId}>
                                {getUniqueComponentsByExam(exId).map(comp => {
                                  const cc = subjComps.find(c =>
                                    c.exam_id === exId &&
                                    c.component_id === comp.component_id
                                  );
                                  return (
                                    <td key={`m-${exId}-${comp.component_id}`}>
                                      {cc?.marks ?? '-'}
                                    </td>
                                  );
                                })}
                                {showTotals && (
                                  <>
                                    <td style={{ fontWeight: 'bold' }}>
                                      {ecs.reduce((a, x) => a + (x.marks || 0), 0)}
                                    </td>
                                    <td style={{ fontWeight: 'bold' }}>
                                      {ecs[0]?.grade || '-'}
                                    </td>
                                  </>
                                )}
                              </React.Fragment>
                            );
                          })}
                          {showTotals && (
                            <>
                              <td style={{ fontWeight: 'bold' }}>
                                {subjComps.reduce((a, x) => a + (x.marks || 0), 0)}
                              </td>
                              <td style={{ fontWeight: 'bold' }}>
                                {student.subject_grades?.[subjComps[0]?.subject_id] || '-'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <h5 className="mt-4">Co-Scholastic Areas</h5>
                <table className="table table-bordered text-center small">
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366', textAlign: 'left' }}>Area</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Grade</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coScholastic.grades.map((grade, index) => (
                      <tr key={index}>
                        <td style={{ textAlign: 'left', fontWeight: 'bold' }}>{grade.area_name}</td>
                        <td>{grade.grade || '-'}</td>
                        <td>{grade.remarks || '-'}</td>
                      </tr>
                    ))}
                    {coScholastic.grades.length === 0 && (
                      <tr>
                        <td colSpan="3" className="text-center">No co-scholastic data available</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <h5 className="mt-4">Attendance Summary</h5>
                <table className="table table-bordered text-center small">
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Total Days</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Present Days</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Absent Days</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Leave Days</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Holiday Days</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Late Days</th>
                      <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{attendance.total_days || '-'}</td>
                      <td>{attendance.present_days || '-'}</td>
                      <td>{attendance.absent_days || '-'}</td>
                      <td>{attendance.leave_days || '-'}</td>
                      <td>{attendance.holiday_days || '-'}</td>
                      <td>{attendance.late_days || '-'}</td>
                      <td>
                        {attendance.attendance_percentage != null
                          ? attendance.attendance_percentage.toFixed(2) + '%'
                          : '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <h5 className="mt-4">Remarks</h5>
                <div className="border p-3 small">
                  <p>{remark || "No remarks provided"}</p>
                </div>

                {reportFormat?.footer_html && (
                  <div
                    className="report-footer mt-3 text-center small"
                    dangerouslySetInnerHTML={{ __html: reportFormat.footer_html }}
                  />
                )}

                {gradeSchema.length > 0 && (
                  <div className="mt-4">
                    <h5>Grade Schema</h5>
                    <table className="table table-bordered text-center small">
                      <thead>
                        <tr>
                          <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Range</th>
                          <th style={{ backgroundColor: '#dff0ff', color: '#003366' }}>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeSchema.map((grade, index) => (
                          <tr key={index}>
                            <td>{`${grade.min_percent}-${grade.max_percent}`}</td>
                            <td>{grade.grade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FinalResultSummary;