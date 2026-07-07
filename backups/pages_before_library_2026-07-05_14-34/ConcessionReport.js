import React, { useEffect, useState } from 'react';
import { Container, Spinner, Alert, Table, Button } from 'react-bootstrap';
import { pdf } from '@react-pdf/renderer';
import PdfConcessionReport from './PdfConcessionReport';
import api from '../api';

const ConcessionReport = () => {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [school, setSchool] = useState(null);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/feedue/concession-report');
      setReport(res.data);
    } catch (err) {
      console.error('Error fetching report:', err);
      setError('Failed to load concession report.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchool = async () => {
    try {
      const res = await api.get('/schools');
      if (res.data?.length) {
        setSchool(res.data[0]);
      }
    } catch (error) {
      console.error('Error fetching school:', error);
    }
  };

  const generatePDF = async () => {
    const blob = await pdf(<PdfConcessionReport school={school} report={report} />).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchReport();
    fetchSchool();
  }, []);

  // 🔁 Pivot logic
  const processData = (classData) => {
    const headingsSet = new Set();
    const studentMap = {};

    classData.students.forEach((stu) => {
      headingsSet.add(stu.feeHeading);
      const key = stu.studentName;
      if (!studentMap[key]) studentMap[key] = {};
      studentMap[key][stu.feeHeading] = stu.concessionAmount;
    });

    const feeHeadings = Array.from(headingsSet).sort();
    const students = Object.entries(studentMap).map(([name, fees]) => ({
      name,
      ...fees,
    }));

    return { feeHeadings, students };
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="text-center flex-grow-1">Concession Report (Pivot View)</h2>
        {report.length > 0 && (
          <Button variant="secondary" onClick={generatePDF} className="ms-3">
            Print PDF
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : error ? (
        <Alert variant="danger" className="text-center">{error}</Alert>
      ) : (
        report.map((cls, index) => {
          const { feeHeadings, students } = processData(cls);

          return (
            <div key={index} className="mb-4">
              <h5 className="text-primary">{cls.className}</h5>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student Name</th>
                    {feeHeadings.map((head, idx) => (
                      <th key={idx}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((stu, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{stu.name}</td>
                      {feeHeadings.map((head, idx) => (
                        <td key={idx}>
                          {stu[head] ? `₹${Number(stu[head]).toLocaleString('en-IN')}` : '----'}
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

export default ConcessionReport;
