import React, { useEffect, useState, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";
import { Modal, Button } from "react-bootstrap";

const FinalResultSummary = () => {
  // --- Core state ---
  const [classList, setClassList] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({
    class_id: "",
    section_id: "",
    subjectComponents: [
        { subject_id: "", selected_components: {}, availableComponents: [] }
    ]

  });
  const [reportData, setReportData] = useState([]);
  const headerMax = reportData[0]?.subjects || [];

  // --- PDF and pagination ---
  const [pdfOrientation, setPdfOrientation] = useState("portrait");
  const [studentsPerPage, setStudentsPerPage] = useState(20);

  // --- Number formatting ---
  const [numberFormat, setNumberFormat] = useState({
    decimalPoints: 2,
    rounding: "none" // "none" | "floor" | "ceiling"
  });

  const [headerHTML, setHeaderHTML] = useState("");
  const [footerHTML, setFooterHTML] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const reportRef = useRef();

  useEffect(() => {
    loadClasses();
    loadSections();
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

  const loadSubjects = async (class_id) => {
    try {
      const res = await api.get("/subjects", { params: { class_id } });
      setSubjects(Array.isArray(res.data.subjects) ? res.data.subjects : []);
    } catch {
      Swal.fire("Error", "Failed to load subjects", "error");
      setSubjects([]);
    }
  };

  const handleClassChange = (e) => {
    const class_id = e.target.value;
    setFilters({
      ...filters,
      class_id,
      section_id: "",
      subjectComponents: [
        { subject_id: "", term1_component_ids: [], term2_component_ids: [], availableComponents: [] }
      ]
    });
    setSubjects([]);
    loadSubjects(class_id);
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
        updated[index] = {
            ...updated[index],
            subject_id,
            availableComponents,
            selected_components: {}  // reset for new subject
        };
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

        if (checked) {
        selected[term_id] = [...selected[term_id], compId];
        } else {
        selected[term_id] = selected[term_id].filter(id => id !== compId);
        }

        updated[index].selected_components = selected;
        return { ...prev, subjectComponents: updated };
    });
    };


  const addSubject = () => {
    setFilters(prev => ({
      ...prev,
      subjectComponents: [
        ...prev.subjectComponents,
        { subject_id: "", term1_component_ids: [], term2_component_ids: [], availableComponents: [] }
      ]
    }));
  };

  const removeSubject = (index) => {
    setFilters(prev => {
      const updated = [...prev.subjectComponents];
      updated.splice(index, 1);
      return { ...prev, subjectComponents: updated };
    });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchReport = async () => {
    const { class_id, section_id, subjectComponents } = filters;
    if (!class_id || !section_id || subjectComponents.some(sc => !sc.subject_id)) {
      return Swal.fire("Missing Fields", "Please complete all fields.", "warning");
    }
    try {
        const payload = {
            class_id,
            section_id,
            includeGrades: true, // ✅ Add this line
            subject_components: subjectComponents.map(sc => ({
                subject_id: parseInt(sc.subject_id),
                term_component_map: sc.selected_components
            }))
        };

      const res = await api.post("/final-report/final-summary", payload);
      setReportData(res.data || []);
    } catch {
      Swal.fire("Error", "Failed to fetch report", "error");
    }
  };

  // --- Number formatting helper ---
  const formatNumber = (value) => {
    if (value == null || isNaN(value)) return value;
    let num = parseFloat(value);
    const pow = Math.pow(10, numberFormat.decimalPoints);
    if (numberFormat.rounding === "floor") num = Math.floor(num * pow) / pow;
    if (numberFormat.rounding === "ceiling") num = Math.ceil(num * pow) / pow;
    return num.toFixed(parseInt(numberFormat.decimalPoints));
  };

  const handleExportPDF = async () => {
  if (!reportRef.current) return;

  const header = headerHTML.replace(/\n/g, "<br/>");
  const footer = footerHTML.replace(/\n/g, "<br/>");

 const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        font-size: 12px;
        padding: 20px;
      }
      h3 {
        margin: 0;
        padding: 10px;
        text-align: center;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      th, td {
        border: 1px solid #000;
        padding: 5px;
        text-align: center;
        font-size: 11px;
      }
      th {
        background-color: #f0f0f0;
      }
      .footer {
        margin-top: 20px;
        text-align: right;
        font-size: 11px;
      }
      .page-break {
        page-break-after: always;
      }
    </style>
  </head>
  <body>
    <h3>${header}</h3>
    ${reportRef.current.innerHTML}
    <div class="footer">${footer}</div>
  </body>
</html>
`;


  const payload = {
    html,
    filters: {
      class_id: filters.class_id,
      section_id: filters.section_id,
      includeGrades: true,
      subject_components: filters.subjectComponents.map(sc => ({
        subject_id: parseInt(sc.subject_id),
        term_component_map: sc.selected_components
      }))
    },
    fileName: "FinalResultSummary",
    orientation: pdfOrientation
  };

  try {
    const res = await api.post(
      "/final-report/final-summary-pdf",
      payload,
      { responseType: "blob" }
    );

    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
  } catch (err) {
    Swal.fire("Error", "Failed to generate PDF", "error");
  }
};


  return (
    <div className="container mt-4">
      <h2>📘 Final Result Summary</h2>

      {/* Filters: Class, Section */}
      <div className="row mt-3">
        <div className="col-md-4">
          <label>Class</label>
          <select className="form-select" value={filters.class_id} onChange={handleClassChange}>
            <option value="">Select Class</option>
            {classList.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label>Section</label>
          <select className="form-select" name="section_id" value={filters.section_id} onChange={handleFilterChange}>
            <option value="">Select Section</option>
            {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
          </select>
        </div>
      </div>

      {/* Subject selection */}
      <div className="mt-4">
        <h5>Subjects & Components</h5>
        <div className="d-flex flex-wrap gap-3 mt-3">
          {filters.subjectComponents.map((sc, idx) => (
            <div key={idx} className="border rounded p-3" style={{ minWidth: '200px' }}>
              <label className="fw-bold">Subject</label>
              <select className="form-select mb-2" value={sc.subject_id} onChange={e => handleSubjectChange(e, idx)}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {Object.entries(
                    sc.availableComponents.reduce((acc, c) => {
                        if (!acc[c.term_id]) acc[c.term_id] = [];
                        acc[c.term_id].push(c);
                        return acc;
                    }, {})
                    ).map(([term_id, comps]) => (
                    <div key={term_id} className="mt-2">
                        <strong>Term {term_id} Components:</strong>
                        <div className="d-flex flex-wrap gap-2 mt-1">
                        {comps.map(c => (
                            <div key={c.component_id} className="form-check me-2">
                            <input
                                type="checkbox"
                                className="form-check-input"
                                id={`t${term_id}-${idx}-${c.component_id}`}
                                checked={(sc.selected_components?.[term_id] || []).includes(c.component_id)}
                                onChange={e =>
                                handleComponentToggle(parseInt(term_id), c.component_id, idx, e.target.checked)
                                }
                            />
                            <label className="form-check-label" htmlFor={`t${term_id}-${idx}-${c.component_id}`}>
                                {c.abbreviation || c.name}
                            </label>
                            </div>
                        ))}
                        </div>
                    </div>
                    ))}

              {idx>0 && <button className="btn btn-sm btn-danger mt-2" onClick={()=>removeSubject(idx)}>Remove</button>}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <button className="btn btn-success me-2" onClick={addSubject}>➕ Add Subject</button>
          <button className="btn btn-primary me-2" onClick={fetchReport}>🔍 Generate Report</button>
        </div>

        {/* PDF Options */}
        <div className="row mt-3">
          <div className="col-md-3">
            <label className="fw-bold small mb-1">PDF Orientation</label>
            <select className="form-select form-select-sm" value={pdfOrientation} onChange={e=>setPdfOrientation(e.target.value)}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="fw-bold small mb-1">Students/Page</label>
            <select
                className="form-select form-select-sm"
                value={studentsPerPage}
                onChange={e => setStudentsPerPage(parseInt(e.target.value))}
                >
                {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}</option>
                ))}
                </select>

          </div>
          <div className="col-md-6 d-flex gap-3 align-items-center">
            <div className="d-flex align-items-center gap-2">
              <label className="mb-0">Decimal Points</label>
              <select className="form-select form-select-sm" value={numberFormat.decimalPoints} onChange={e=>setNumberFormat({...numberFormat,decimalPoints:parseInt(e.target.value)})} style={{width:'80px'}}>
                {[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="d-flex align-items-center gap-2">
              <label className="mb-0">Rounding</label>
              <select className="form-select form-select-sm" value={numberFormat.rounding} onChange={e=>setNumberFormat({...numberFormat,rounding:e.target.value})} style={{width:'120px'}}>
                <option value="none">None</option>
                <option value="floor">Floor</option>
                <option value="ceiling">Ceiling</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Report Table */}
      {reportData.length>0 && (
        <>
          <div className="text-end my-3">
            <button className="btn btn-danger" onClick={()=>setShowPdfModal(true)}>🖨️ Export PDF</button>
          </div>
          <div ref={reportRef} className="table-responsive">
            <table className="table table-bordered text-center">
              <thead>
                    <tr>
                        <th rowSpan="2">Roll No</th>  {/* ✅ Add this */}
                        <th rowSpan="2">Name</th>
                        {filters.subjectComponents.map((sc, idx) => {
                        const name = subjects.find(s => s.id === +sc.subject_id)?.name || "–";
                        const totalMax = headerMax[idx]?.total_max_weightage ?? "0.00";
                        const totalMaxInt = Math.round(parseFloat(totalMax));
                        return (
                            <th key={idx} colSpan={4} style={{ minWidth: "160px" }}>
                            {name} (Max {totalMaxInt})
                            </th>
                        );
                        })}

                        {/* ✅ NEW grouped heading for final result */}
                        <th colSpan="3">Grand Total</th>
                    </tr>

                    <tr>
                        {filters.subjectComponents.flatMap((sc, idx) => {
                        const t1 = headerMax[idx]?.term1_max_weightage ?? "0.00";
                        const t2 = headerMax[idx]?.term2_max_weightage ?? "0.00";
                        const tm = headerMax[idx]?.total_max_weightage ?? "0.00";
                        const t1Int = Math.round(parseFloat(t1));
                        const t2Int = Math.round(parseFloat(t2));
                        const tmInt = Math.round(parseFloat(tm));
                        return [
                            <th key={`t1-${idx}`}>T1<br />{t1Int}</th>,
                            <th key={`t2-${idx}`}>T2<br />{t2Int}</th>,
                            <th key={`c-${idx}`}>Comb<br />{tmInt}</th>,
                            <th key={`g-${idx}`}>Grade</th>
                        ];
                        })}

                        {/* ✅ Sub-columns under Grand Total */}
                        <th>Marks</th>
                        <th>%age</th>
                        <th>Grade</th>
                    </tr>
                    </thead>




              <tbody>
                {reportData.map((stu, i) => (
                    <React.Fragment key={stu.student_id}>
                    <tr>
                        <td>{stu.roll_number || "-"}</td>
                        <td className="text-start">{stu.name}</td>
                        {filters.subjectComponents.map((sc, index) => {
                        const subj = stu.subjects.find(x => x.subject_id === parseInt(sc.subject_id)) || {};
                        return (
                            <React.Fragment key={index}>
                            <td>{formatNumber(subj.term1_weighted)}</td>
                            <td>{formatNumber(subj.term2_weighted)}</td>
                            <td>{formatNumber(subj.final_total)}</td>
                            <td>{subj.grade || "-"}</td>

                            </React.Fragment>
                        );
                        })}
                        {/* ✅ Grand Total and Grade columns */}
                        <td>{formatNumber(stu.grand_total)}</td>
                        <td>{formatNumber(stu.percentage)}</td>
                        <td>{stu.grand_grade || "-"}</td>

                    </tr>

                    {(i + 1) % studentsPerPage === 0 && (
                        <tr className="page-break">
                        <td colSpan={1 + filters.subjectComponents.length * 4 + 3}></td>

                        </tr>
                    )}
                    </React.Fragment>
                ))}
                </tbody>

            </table>
          </div>
        </>
      )}

      {/* PDF Modal */}
      <Modal show={showPdfModal} onHide={()=>setShowPdfModal(false)}>
        <Modal.Header closeButton><Modal.Title>Customize PDF</Modal.Title></Modal.Header>
        <Modal.Body>
          <label>Header HTML</label>
          <textarea className="form-control mb-2" rows={3} value={headerHTML} onChange={e=>setHeaderHTML(e.target.value)}/>
          <label>Footer HTML</label>
          <textarea className="form-control" rows={3} value={footerHTML} onChange={e=>setFooterHTML(e.target.value)}/>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={()=>setShowPdfModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={()=>{setShowPdfModal(false);handleExportPDF();}}>Generate PDF</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FinalResultSummary;
