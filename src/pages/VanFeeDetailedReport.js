import React, { useEffect, useState } from 'react';
import { Container, Spinner, Alert, Table, Button } from 'react-bootstrap';
import { pdf } from '@react-pdf/renderer';
import api from '../api';
import PdfVanFeeReport from './PdfVanFeeReport'; // ✅ Ensure this exists and is updated accordingly

const VanFeeDetailedReport = () => {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [school, setSchool] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/feedue/van-fee-detailed-report');
      setReport(res.data);
    } catch (err) {
      console.error('Error fetching van fee report:', err);
      setError('Failed to load van fee report.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchool = async () => {
    try {
      const res = await api.get('/schools');
      if (res.data?.length > 0) setSchool(res.data[0]);
    } catch (err) {
      console.error('School load error:', err);
    }
  };

  const generatePDF = async () => {
    const blob = await pdf(<PdfVanFeeReport school={school} report={report} />).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchReport();
    fetchSchool();
  }, []);

  // ✅ Updated: Pivot logic with proper heading ID sorting
  const processData = (classData) => {
    const headingMap = new Map();
    const studentMap = {};

    classData.students.forEach((stu) => {
      if (!headingMap.has(stu.feeHeading)) {
        headingMap.set(stu.feeHeading, stu.feeHeadingId);
      }

      const key = stu.studentName;
      if (!studentMap[key]) studentMap[key] = {};
      studentMap[key][stu.feeHeading] = stu.vanFeePaid;
    });

    const months = Array.from(headingMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([name]) => name);

    const students = Object.entries(studentMap).map(([name, fees]) => ({
      name,
      ...fees,
    }));

    return { months, students };
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="text-center flex-grow-1">Van Fee Detailed Report (Pivot View)</h2>
        {report.length > 0 && (
          <Button variant="secondary" onClick={generatePDF} className="ms-3">
            Print PDF
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center"><Spinner animation="border" variant="primary" /></div>
      ) : error ? (
        <Alert variant="danger" className="text-center">{error}</Alert>
      ) : (
        report.map((cls, idx) => {
          const { months, students } = processData(cls);
          return (
            <div key={idx} className="mb-4">
              <h5 className="text-primary">{cls.className}</h5>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    {months.map((month, i) => (
                      <th key={i}>{month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((stu, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{stu.name}</td>
                      {months.map((month, j) => (
                        <td key={j}>
                          {stu[month] ? Number(stu[month]).toLocaleString('en-IN') : '----'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          );
        })
      )}
    </Container>
  );
};

export default VanFeeDetailedReport;
