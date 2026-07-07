import React, { useState, useRef } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "bootstrap/dist/css/bootstrap.min.css";

const SmartReportCard = () => {
  const reportRef = useRef(null);

  const [remarks, setRemarks] = useState("<p>Student has shown great improvement.</p>");
  const [marksData] = useState([
    { subject: "Math", pt1: 30, max: 40, weightage: 10 },
    { subject: "Science", pt1: 25, max: 40, weightage: 10 },
    { subject: "English", pt1: 36, max: 40, weightage: 10 },
  ]);

  const exportToPDF = () => {
    const input = reportRef.current;
    html2canvas(input, { scale: 2 }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("student-report.pdf");
    });
  };

  return (
    <div className="container my-4">
      <h2 className="text-center mb-4">📝 Smart Report Card Generator</h2>

      <div ref={reportRef} className="p-4" style={{ background: "#fff", color: "#000" }}>
        <h4 className="text-center mb-3">Term Report</h4>
        <table className="table table-bordered">
          <thead>
            <tr>
              <th>Subject</th>
              <th>PT-1 Marks</th>
              <th>Max Marks</th>
              <th>Weightage (%)</th>
              <th>Weighted Marks</th>
            </tr>
          </thead>
          <tbody>
            {marksData.map((item, index) => {
              const weighted = ((item.pt1 / item.max) * item.weightage).toFixed(2);
              return (
                <tr key={index}>
                  <td>{item.subject}</td>
                  <td>{item.pt1}</td>
                  <td>{item.max}</td>
                  <td>{item.weightage}%</td>
                  <td>{weighted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4" dangerouslySetInnerHTML={{ __html: remarks }} />
      </div>

      <div className="mt-5">
        <h5>Remarks</h5>
        <CKEditor
          editor={ClassicEditor}
          data={remarks}
          onChange={(event, editor) => {
            setRemarks(editor.getData());
          }}
        />
      </div>

      <div className="text-center mt-4">
        <button className="btn btn-success" onClick={exportToPDF}>
          📤 Export Report to PDF
        </button>
      </div>
    </div>
  );
};

export default SmartReportCard;
