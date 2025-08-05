// ReceiptContent.js
import React from "react";
import { Table, Row, Col } from "react-bootstrap";


const ReceiptContent = ({ school, receipt, slipId, student }) => {
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

  // Calculate totals
  const totalAcademicReceived = receipt.reduce((sum, trx) => sum + trx.Fee_Recieved, 0);
  const totalAcademicConcession = receipt.reduce((sum, trx) => sum + trx.Concession, 0);
  const totalAcademicBalance = receipt.reduce((sum, trx) => sum + (trx.feeBalance || 0), 0);

  const totalTransportFee = receipt.reduce((sum, trx) => sum + (trx.VanFee || 0), 0);
  // We no longer need the transport balance since it's removed
  // const totalTransportBalance = receipt.reduce(
  //   (sum, trx) => sum + (trx.vanFeeBalance || 0),
  //   0
  // );
  // ✅ Add here
  const totalFine = receipt.reduce((sum, trx) => sum + (trx.Fine_Amount || 0), 0);

  const grandTotalReceived = totalAcademicReceived + totalTransportFee + totalFine;
  const grandTotalInWords = numberToWords(Math.round(grandTotalReceived));
  
  const showFineColumn = totalFine > 0;

  return (
    <div style={{ paddingLeft: "20px", paddingRight: "20px" }}>
      {/* Top: School Header */}
      <Table borderless className="mb-4">
        <tbody>
          <tr>
            <td style={{ width: "25%", textAlign: "left" }}>
              <img
                src={`https://erp.sirhindpublicschool.com:3000${school.logo}`}
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

      {/* Title */}
      <h5 className="text-center fw-bold text-dark">
        Session: 2025-26
        <br />
        Fee Receipt
      </h5>
      <hr />

      {/* Student Info */}
      <Table bordered className="mb-3">
        <tbody>
          <tr>
            <td>
              <p><strong>Slip ID:</strong> {slipId}</p>
              <p><strong>Student Name:</strong> {student.name}</p>
              <p><strong>Father's Name:</strong> {student.father_name}</p>
              <p><strong>Mother's Name:</strong> {student.mother_name}</p>
              {/* Removed "Concession Applicable" line */}
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

     <Table bordered hover className="text-center">
      <thead>
        <tr className="bg-light fw-bold">
          <th>Sr. No.</th>
          <th>Particular</th>
          <th>Received (₹)</th>
          {showFineColumn && <th>Fine (₹)</th>}
          <th>Concession (₹)</th>
          <th>Balance (₹)</th>
          <th>Van Fee (₹)</th>
        </tr>
      </thead>
      <tbody>
        {receipt.map((trx, index) => (
          <tr key={index}>
            <td>{index + 1}</td>
            <td>{trx.FeeHeading.fee_heading}</td>
            <td>₹{trx.Fee_Recieved.toFixed(2)}</td>
            {showFineColumn && (
              <td>₹{(trx.Fine_Amount || 0).toFixed(2)}</td>
            )}
            <td>₹{trx.Concession.toFixed(2)}</td>
            <td>
              {trx.feeBalance !== undefined
                ? "₹" + trx.feeBalance.toFixed(2)
                : "N/A"}
            </td>
            <td>₹{(trx.VanFee || 0).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="fw-bold">
          <td colSpan="2">Total</td>
          <td>₹{totalAcademicReceived.toFixed(2)}</td>
          {showFineColumn && <td>₹{totalFine.toFixed(2)}</td>}
          <td>₹{totalAcademicConcession.toFixed(2)}</td>
          <td>₹{totalAcademicBalance.toFixed(2)}</td>
          <td>₹{totalTransportFee.toFixed(2)}</td>
        </tr>
      </tfoot>
    </Table>


      {/* Overall Total and In Words */}
      <div className="text-end mt-3">
        <h5>Overall Total Received: ₹{grandTotalReceived.toFixed(2)}</h5>
        <p className="fst-italic">
          (In words: {grandTotalInWords} Rupees Only)
        </p>
      </div>

      {/* Mode of Transaction / Transaction ID */}
      <div className="mt-3">
        <p><strong>Mode of Transaction:</strong> Cash</p>
        <p><strong>Transaction ID:</strong> N/A</p>
      </div>

      {/* Note */}
      <Row className="mt-4">
        <Col>
          <p style={{ fontSize: "0.9rem" }}>
            <em>
              Note: Please keep this receipt for any future reference. Fees once paid are non-refundable.
            </em>
          </p>
        </Col>
      </Row>

      {/* Signature */}
      <Row className="mt-4">
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
  );
};

export default ReceiptContent;
