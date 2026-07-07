import React, { useState, useEffect } from "react";
import { Table, Row, Col } from "react-bootstrap";
import normalizeUploadedUrl from "../../utils/normalizeUploadedUrl";
import api from "../../api";

const placeholderDataUrl =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>
      <rect width='100%' height='100%' fill='#f3f4f6'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9ca3af' font-size='12'>No Logo</text>
    </svg>`
  );

const buildAbsoluteFromRelative = (relativePath) => {
  try {
    const base =
      (api && api.defaults && api.defaults.baseURL) ||
      `${window.location.protocol}//${window.location.host}`;
    if (!relativePath) return null;
    const rel = String(relativePath).trim();
    if (rel.startsWith("http://") || rel.startsWith("https://")) return rel;
    const path = rel.startsWith("/") ? rel : `/${rel}`;
    const baseClean = base.endsWith("/") ? base.slice(0, -1) : base;
    return `${baseClean}${path}`;
  } catch (e) {
    return relativePath;
  }
};

const extractLastAbsoluteUrl = (s) => {
  if (!s) return null;
  const str = String(s);
  const httpMatches = str.match(/https?:\/\/[^"'<\s]+/g);
  if (httpMatches && httpMatches.length > 0) {
    return httpMatches[httpMatches.length - 1];
  }
  return null;
};

const SafeLogo = ({ src, alt, style }) => {
  const [imgSrc, setImgSrc] = useState(placeholderDataUrl);

  useEffect(() => {
    if (!src) return setImgSrc(placeholderDataUrl);

    try {
      const lastAbs = extractLastAbsoluteUrl(src);
      if (lastAbs) return setImgSrc(lastAbs);

      const normalized = normalizeUploadedUrl(src);
      if (normalized?.startsWith("/") || normalized?.startsWith("./") || normalized?.startsWith("../")) {
        setImgSrc(buildAbsoluteFromRelative(normalized) || placeholderDataUrl);
        return;
      }
      if (normalized?.startsWith("http://") || normalized?.startsWith("https://")) {
        setImgSrc(normalized);
        return;
      }
      setImgSrc(buildAbsoluteFromRelative(src) || placeholderDataUrl);
    } catch {
      setImgSrc(placeholderDataUrl);
    }
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt || "School Logo"}
      style={style}
      onError={() => setImgSrc(placeholderDataUrl)}
    />
  );
};

const ReceiptContent = ({ school = {}, receipt = [], slipId = "—", student = {} }) => {
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
      if (n > 9 && n < 20) word += teens[n - 10] + " ";
      else if (n >= 20) {
        word += tens[Math.floor(n / 10)] + " ";
        if (n % 10) word += ones[n % 10] + " ";
      } else if (n > 0) word += ones[n] + " ";
      return word.trim();
    };

    if (num === 0) return "Zero";
    if (!num && num !== 0) return "";

    let word = "";
    if (num >= 1000000) {
      word += convertHundred(Math.floor(num / 1000000)) + " Million ";
      num %= 1000000;
    }
    if (num >= 1000) {
      word += convertHundred(Math.floor(num / 1000)) + " Thousand ";
      num %= 1000;
    }
    if (num > 0) word += convertHundred(num);
    return word.trim();
  };

  const items = Array.isArray(receipt) ? receipt : [];

  // Totals
  const totalReceived = items.reduce((s, t) => s + Number(t.Fee_Recieved || 0), 0);
  const totalFine = items.reduce((s, t) => s + Number(t.Fine_Amount || 0), 0);
  const totalConcession = items.reduce((s, t) => s + Number(t.Concession || 0), 0);
  const totalBalance = items.reduce((s, t) => s + Number(t.feeBalance || 0), 0);
  const totalVan = items.reduce((s, t) => s + Number(t.VanFee || 0), 0);

  // ✅ Grand Total = Fee Received + Fine + Van Fee
  const grandTotal = totalReceived + totalFine + totalVan;
  const grandTotalInWords = numberToWords(Math.round(grandTotal));

  const showFineColumn = totalFine > 0;
  const showConcessionColumn = totalConcession > 0;

  return (
    <div style={{ paddingLeft: "20px", paddingRight: "20px" }}>
      {/* Header */}
      <Table borderless className="mb-4">
        <tbody>
          <tr>
            <td style={{ width: "25%", textAlign: "left" }}>
              <SafeLogo
                src={school?.logo}
                alt={school?.name}
                style={{ width: "90px", height: "90px", objectFit: "contain" }}
              />
            </td>
            <td style={{ textAlign: "center" }}>
              <h2 className="fw-bold">{school?.name || ""}</h2>
              <p className="text-muted">{school?.description || ""}</p>
              <p className="fw-semibold">
                📞 {school?.phone || ""} | ✉️ {school?.email || ""}
              </p>
            </td>
          </tr>
        </tbody>
      </Table>

      <h5 className="text-center fw-bold text-dark">
        Session: {items[0]?.session || "—"}
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
              <p><strong>Student Name:</strong> {student?.name || "-"}</p>
              <p><strong>Father's Name:</strong> {student?.father_name || "-"}</p>
              <p><strong>Mother's Name:</strong> {student?.mother_name || "-"}</p>
            </td>
            <td>
              <p><strong>Admission No:</strong> {student?.admission_number || "-"}</p>
              <p><strong>Class:</strong> {items[0]?.Class?.class_name || "-"}</p>
              <p><strong>Address:</strong> {student?.address || "-"}</p>
              <p><strong>Date:</strong> {new Date(items[0]?.DateOfTransaction || Date.now()).toLocaleString()}</p>
            </td>
          </tr>
        </tbody>
      </Table>

      {/* Fee Table */}
      <Table bordered hover className="text-center">
        <thead>
          <tr className="bg-light fw-bold">
            <th>Sr. No.</th>
            <th>Fee Head</th>
            {showConcessionColumn && <th>Concession (₹)</th>}
            {showFineColumn && <th>Fine (₹)</th>}
            <th>Received (₹)</th>
            <th>Balance (₹)</th>
            <th>Van Fee (₹)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((trx, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{trx?.FeeHeading?.fee_heading || trx?.Fee_Heading || "—"}</td>
              {showConcessionColumn && <td>₹{Number(trx.Concession || 0).toFixed(2)}</td>}
              {showFineColumn && <td>₹{Number(trx.Fine_Amount || 0).toFixed(2)}</td>}
              <td><strong>₹{Number(trx.Fee_Recieved || 0).toFixed(2)}</strong></td>
              <td>₹{Number(trx.feeBalance || 0).toFixed(2)}</td>
              <td>₹{Number(trx.VanFee || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="fw-bold">
            <td colSpan="2">Total</td>
            {showConcessionColumn && <td>₹{totalConcession.toFixed(2)}</td>}
            {showFineColumn && <td>₹{totalFine.toFixed(2)}</td>}
            <td><strong>₹{totalReceived.toFixed(2)}</strong></td>
            <td>₹{totalBalance.toFixed(2)}</td>
            <td>₹{totalVan.toFixed(2)}</td>
          </tr>
        </tfoot>
      </Table>

      {/* Overall Totals */}
      <div className="text-end mt-3">
        <h5>
          Overall Total Received: <strong>₹{grandTotal.toFixed(2)}</strong>
        </h5>
        <p style={{ fontSize: "0.9rem", color: "#555" }}>
          (Fee Received ₹{totalReceived.toFixed(2)}
          {showFineColumn ? ` + Fine ₹${totalFine.toFixed(2)}` : ""}
          {totalVan > 0 ? ` + Van Fee ₹${totalVan.toFixed(2)}` : ""}
          = <strong>₹{grandTotal.toFixed(2)}</strong>)
        </p>
        <p className="fst-italic">
          (In words: {grandTotalInWords} Rupees Only)
        </p>
      </div>

      {/* Mode & Notes */}
      <div className="mt-3">
        <p><strong>Mode of Transaction:</strong> {items[0]?.PaymentMode || "—"}</p>
        <p><strong>Transaction ID:</strong> {items[0]?.Transaction_ID || "N/A"}</p>
      </div>

      <Row className="mt-4">
        <Col>
          <p style={{ fontSize: "0.9rem" }}>
            <em>Note: Please keep this receipt for any future reference. Fees once paid are non-refundable.</em>
          </p>
        </Col>
      </Row>

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
