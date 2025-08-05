import React, { useEffect, useState } from 'react';
import api from '../api';
import Swal from 'sweetalert2';

const LiveResultReportPage = () => {
  const [filters, setFilters] = useState({ class_id: '', section_id: '', exam_id: '' });
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [columns, setColumns] = useState([]);
  const [headerText, setHeaderText] = useState('ABC Public School - Term I Report');
  const [footerText, setFooterText] = useState('_________________ Class Incharge &nbsp;&nbsp;&nbsp;&nbsp; _________________ Principal');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDropdowns();
  }, []);

  const fetchDropdowns = async () => {
    try {
      const [classRes, sectionRes, examRes] = await Promise.all([
        api.get('/classes'),
        api.get('/sections'),
        api.get('/exams')
      ]);
      setClasses(classRes.data);
      setSections(sectionRes.data);
      setExams(examRes.data);
    } catch (err) {
      console.error('Error loading dropdowns:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const loadData = async () => {
    if (!filters.class_id || !filters.section_id || !filters.exam_id) {
      return Swal.fire('Missing Filters', 'Please select Class, Section, and Exam.', 'warning');
    }
    setLoading(true);
    try {
      const res = await api.get('/result-report/preview-data', { params: filters });
      setStudents(res.data.students);
      setColumns(res.data.columns);
    } catch (err) {
      console.error('Error loading data:', err);
      Swal.fire('Error', 'Failed to load result data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!students.length) return;
    setLoading(true);
    try {
      const html = `
        <h2 style="text-align:center">${headerText}</h2>
        <table border="1" width="100%" style="border-collapse:collapse; text-align:center; margin-top:20px">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Name</th>
              <th>Class</th>
              ${columns.map(col => `<th>${col}</th>`).join('')}
              <th>Total</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(stu => `
              <tr>
                <td>${stu.roll_number}</td>
                <td>${stu.name}</td>
                <td>${stu.class}</td>
                ${columns.map(col => `<td>${stu.marks[col] ?? ''}</td>`).join('')}
                <td>${stu.total}</td>
                <td>${stu.grade}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <div style="margin-top:50px; text-align:center">${footerText}</div>
      `;

      const res = await api.post('/result-report/generate-pdf', { html, filters }, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ResultReport.pdf';
      a.click();
    } catch (err) {
      console.error('PDF export failed:', err);
      Swal.fire('Error', 'Failed to generate PDF.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-4">
      <h4 className="mb-3">🎓 Live Result Report Preview</h4>

      <div className="row mb-3">
        <div className="col">
          <input type="text" className="form-control" placeholder="Header" value={headerText} onChange={(e) => setHeaderText(e.target.value)} />
        </div>
        <div className="col">
          <input type="text" className="form-control" placeholder="Footer" value={footerText} onChange={(e) => setFooterText(e.target.value)} />
        </div>
      </div>

      <div className="row mb-3">
        <div className="col">
          <select name="class_id" className="form-select" value={filters.class_id} onChange={handleChange}>
            <option value="">Select Class</option>
            {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.class_name}</option>)}
          </select>
        </div>
        <div className="col">
          <select name="section_id" className="form-select" value={filters.section_id} onChange={handleChange}>
            <option value="">Select Section</option>
            {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.section_name}</option>)}
          </select>
        </div>
        <div className="col">
          <select name="exam_id" className="form-select" value={filters.exam_id} onChange={handleChange}>
            <option value="">Select Exam</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
          </select>
        </div>
        <div className="col">
          <button className="btn btn-primary w-100" onClick={loadData} disabled={loading}>🔍 Preview</button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="table-responsive">
          <table className="table table-bordered text-center">
            <thead className="table-light">
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Class</th>
                {columns.map(col => <th key={col}>{col}</th>)}
                <th>Total</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {students.map((stu, idx) => (
                <tr key={idx}>
                  <td>{stu.roll_number}</td>
                  <td>{stu.name}</td>
                  <td>{stu.class}</td>
                  {columns.map(col => <td key={col}>{stu.marks[col] ?? ''}</td>)}
                  <td>{stu.total}</td>
                  <td>{stu.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="btn btn-success mt-3" onClick={handleExport} disabled={loading}>
            {loading ? 'Generating PDF...' : '📄 Export PDF'}
          </button>
        </div>
      )}
    </div>
  );
};

export default LiveResultReportPage;
