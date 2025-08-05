import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button, Table, Row, Col } from "react-bootstrap";
import api from "../../api"; // Ensure your API utility is properly configured

// Print-specific styles: When printing, the receipt container uses full width.
const printStyles = `
  @media print {
    .no-print {
      display: none;
    }
    .receipt-container {
      max-width: 100% !important;
      width: 100%;
      margin: 0 !important;
      padding: 0;
      border: none;
    }
    body {
      -webkit-print-color-adjust: exact;
    }
  }
`;

const ReceiptPrint = () => {
  const { slipId } = useParams();
  const [school, setSchool] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const printableRef = useRef();

  useEffect(() => {
    if (!slipId) {
      console.warn("No slipId provided");
      return;
    }
    const fetchData = async () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem("token");
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };

        const schoolResponse = await api.get("/schools", config);
        if (schoolResponse.data.length > 0) {
          setSchool(schoolResponse.data[0]);
        }
        const receiptResponse = await api.get(`/transactions/slip/${slipId}`, config);
        setReceipt(receiptResponse.data.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, [slipId]);

  // When the user clicks Print, call window.print() to trigger the browser print dialog.
  const handlePrint = () => {
    window.print();
  };

  // Helper function to convert numbers to words (supports up to millions)
  const numberToWords = (num) => {
    const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    
    const convertHundred = (n) => {
      let word = "";
      if (n > 99) {
        word += ones[Math.floor(n / 100)] + " Hundred ";
        n %= 100;
      }
      if (n > 9 && n < 20) {
        word += teens[n - 10] + " ";
      } else if (n >= 20) {
        word += tens[Math.floor(n / 10)] + " ";
        if (n % 10) {
          word += ones[n % 10] + " ";
        }
      } else if (n > 0) {
        word += ones[n] + " ";
      }
      return word.trim();
    };

    if (num === 0) return "Zero";
    
    let word = "";
    if (num >= 1000000) {
      word += convertHundred(Math.floor(num / 1000000)) + " Million ";
      num %= 1000000;
    }
    if (num >= 1000) {
      word += convertHundred(Math.floor(num / 1000)) + " Thousand ";
      num %= 1000;
    }
    if (num > 0) {
      word += convertHundred(num);
    }
    return word.trim();
  };

  if (!slipId) {
    return <p className="text-center mt-5">No slip ID provided.</p>;
  }
  if (!receipt || !school) {
    return <p className="text-center mt-5">Loading receipt...</p>;
  }
  const student = receipt.length > 0 ? receipt[0].Student : null;
  if (!student) {
    return <p className="text-center mt-5">No transaction data found.</p>;
  }

  // Calculate totals for Academic Fee and Van Fee
  const totalAcademicReceived = receipt.reduce((sum, trx) => sum + trx.Fee_Recieved, 0);
  const totalAcademicConcession = receipt.reduce((sum, trx) => sum + trx.Concession, 0);
  const totalAcademicBalance = receipt.reduce((sum, trx) => sum + (trx.feeBalance || 0), 0);
  const totalVanFee = receipt.reduce((sum, trx) => sum + (trx.VanFee || 0), 0);

  const overallTotalReceived = totalAcademicReceived + totalVanFee;
  const overallTotalInWords = numberToWords(Math.round(overallTotalReceived));

  return (
    <div className="container position-relative p-2" style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      {/* Inject print-specific styles */}
      <style>{printStyles}</style>

      {/* Fixed Print Button (will be hidden during printing) */}
      <Button
        variant="primary"
        onClick={handlePrint}
        className="position-absolute no-print"
        style={{ top: "10px", right: "10px", zIndex: 999 }}
      >
        Print
      </Button>

      {/* Receipt Container with custom class for print styling */}
      <div
        ref={printableRef}
        className="receipt-container mx-auto bg-white p-3"
        style={{ maxWidth: "800px", margin: "10px auto", border: "1px solid #ddd" }}
      >
        {/* School Header */}
        <div className="mb-3">
          <Table borderless>
            <tbody>
              <tr>
                <td style={{ width: "25%", textAlign: "left" }}>
                  <img
                    src={`${process.env.REACT_APP_API_URL}${school.logo}`}
                    alt="School Logo"
                    style={{ width: "90px", height: "90px", objectFit: "contain" }}
                  />
                </td>
                <td style={{ textAlign: "center" }}>
                  <h2 className="fw-bold text-dark" style={{ letterSpacing: "1px" }}>
                    {school.name}
                  </h2>
                  <p className="text-muted">{school.description}</p>
                  <p className="fw-semibold">
                    📞 {school.phone} | ✉️ {school.email}
                  </p>
                </td>
              </tr>
            </tbody>
          </Table>
        </div>

        <h5 className="text-center fw-bold">Fee Receipt</h5>
        <hr />

        {/* Student Details */}
        <Table bordered className="mb-3">
          <tbody>
            <tr>
              <td>
                <p><strong>Slip ID:</strong> {slipId}</p>
                <p><strong>Student Name:</strong> {student.name}</p>
                <p><strong>Father's Name:</strong> {student.father_name}</p>
                <p><strong>Mother's Name:</strong> {student.mother_name}</p>
                <p>
                  <strong>Concession Applicable:</strong>{" "}
                  {student.Concession ? student.Concession.concession_name : "N/A"}
                </p>
              </td>
              <td>
                <p><strong>Admission No:</strong> {student.admission_number}</p>
                <p><strong>Class:</strong> {receipt[0].Class.class_name}</p>
                <p><strong>Address:</strong> {student.address}</p>
                <p>
                  <strong>Date:</strong>{" "}
                  {new Date(receipt[0].DateOfTransaction).toLocaleString()}
                </p>
              </td>
            </tr>
          </tbody>
        </Table>

        {/* Transaction Details Table */}
        <Table bordered hover className="text-center">
          <thead>
            <tr className="bg-light fw-bold">
              <th>Fee Head</th>
              <th colSpan="3">Academic Fee</th>
              <th>Van Fee</th>
            </tr>
            <tr className="bg-light fw-bold">
              <th></th>
              <th>Received (₹)</th>
              <th>Concession (₹)</th>
              <th>Balance (₹)</th>
              <th>Received (₹)</th>
            </tr>
          </thead>
          <tbody>
            {receipt.map((trx, index) => (
              <tr key={index}>
                <td>{trx.FeeHeading.fee_heading}</td>
                <td>₹{trx.Fee_Recieved.toFixed(2)}</td>
                <td>₹{trx.Concession.toFixed(2)}</td>
                <td>
                  {trx.feeBalance !== undefined ? "₹" + trx.feeBalance.toFixed(2) : "N/A"}
                </td>
                <td>₹{(trx.VanFee || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-bold">
              <td>Total</td>
              <td>₹{totalAcademicReceived.toFixed(2)}</td>
              <td>₹{totalAcademicConcession.toFixed(2)}</td>
              <td>₹{totalAcademicBalance.toFixed(2)}</td>
              <td>₹{totalVanFee.toFixed(2)}</td>
            </tr>
          </tfoot>
        </Table>

        {/* Overall Total */}
        <div className="mt-3 text-end">
          <h5>
            Overall Total Received: ₹{overallTotalReceived.toFixed(2)}
          </h5>
          <p className="fst-italic">
            (In words: {overallTotalInWords} Rupees Only)
          </p>
        </div>

        {/* Note & Signature */}
        <Row className="mt-3">
          <Col>
            <p style={{ fontSize: "0.9rem" }}>
              <em>
                Note: Please keep this receipt for future reference. Fees once paid are non-refundable.
              </em>
            </p>
          </Col>
        </Row>
        <Row className="mt-3">
          <Col className="text-end">
            <p
              style={{
                borderTop: "1px solid #000",
                display: "inline-block",
                paddingTop: "5px",
                marginRight: "20px",
              }}
            >
              Cashier Signature
            </p>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ReceiptPrint;
