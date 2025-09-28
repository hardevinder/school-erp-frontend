// src/pages/Transactions/ReceiptContent.js
import React, { useState, useEffect } from "react";
import { Table, Row, Col } from "react-bootstrap";
import normalizeUploadedUrl from "../../utils/normalizeUploadedUrl";
import api from "../../api";

/**
 * ReceiptContent - robustified to handle malformed logo URLs
 *
 * Props:
 *  - school: object (name, description/address, phone, email, logo)
 *  - receipt: array of transaction lines
 *  - slipId: string|number
 *  - student: object
 */
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

// try to extract the last absolute url substring in a string that may contain multiple http(s) occurrences
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
    if (!src) {
      setImgSrc(placeholderDataUrl);
      return;
    }

    try {
      // 1) If the string contains multiple http(s) urls, pick the last one
      const lastAbs = extractLastAbsoluteUrl(src);
      if (lastAbs) {
        // debug
        // console.debug("SafeLogo: raw src (multiple):", src, " -> using lastAbs:", lastAbs);
        setImgSrc(lastAbs);
        return;
      }

      // 2) normalize using shared util
      const normalized = normalizeUploadedUrl(src);

      // 3) If normalized is relative (starts with '/'), build absolute using API base
      if (normalized && (normalized.startsWith("/") || normalized.startsWith("./") || normalized.startsWith("../"))) {
        const abs = buildAbsoluteFromRelative(normalized);
        // console.debug("SafeLogo: raw src:", src, " normalized:", normalized, " -> abs:", abs);
        setImgSrc(abs || placeholderDataUrl);
        return;
      }

      // 4) If normalized looks absolute already
      if (normalized && (normalized.startsWith("http://") || normalized.startsWith("https://"))) {
        // console.debug("SafeLogo: raw src:", src, " normalized absolute:", normalized);
        setImgSrc(normalized);
        return;
      }

      // 5) fallback: build from original
      const fallback = buildAbsoluteFromRelative(src);
      // console.debug("SafeLogo fallback: raw src:", src, " -> fallback:", fallback);
      setImgSrc(fallback || placeholderDataUrl);
    } catch (e) {
      // console.error("SafeLogo normalization error:", e);
      setImgSrc(placeholderDataUrl);
    }
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt || "School Logo"}
      style={style}
      onError={() => {
        if (imgSrc !== placeholderDataUrl) setImgSrc(placeholderDataUrl);
      }}
    />
  );
};

const ReceiptContent = ({ school = {}, receipt = [], slipId = "—", student = {} }) => {
  // numberToWords (slightly updated)
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

    if (!num && num !== 0) return "";
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

  // safety: ensure receipt is array
  const items = Array.isArray(receipt) ? receipt : [];

  const totalAcademicReceived = items.reduce((sum, trx) => sum + (Number(trx.Fee_Recieved || 0)), 0);
  const totalAcademicConcession = items.reduce((sum, trx) => sum + (Number(trx.Concession || 0)), 0);
  const totalAcademicBalance = items.reduce((sum, trx) => sum + (Number(trx.feeBalance || 0)), 0);
  const totalTransportFee = items.reduce((sum, trx) => sum + (Number(trx.VanFee || 0)), 0);
  const totalFine = items.reduce((sum, trx) => sum + (Number(trx.Fine_Amount || 0)), 0);

  const grandTotalReceived = totalAcademicReceived + totalTransportFee + totalFine;
  const grandTotalInWords = numberToWords(Math.round(grandTotalReceived));

  const showFineColumn = totalFine > 0;

  // debug raw logo
  // console.debug("ReceiptContent raw school.logo:", school?.logo);

  return (
    <div style={{ paddingLeft: "20px", paddingRight: "20px" }}>
      {/* Top: School Header */}
      <Table borderless className="mb-4">
        <tbody>
          <tr>
            <td style={{ width: "25%", textAlign: "left" }}>
              <SafeLogo
                src={school?.logo}
                alt={school?.name || "School Logo"}
                style={{ width: "90px", height: "90px", objectFit: "contain" }}
              />
            </td>
            <td style={{ textAlign: "center" }}>
              <h2 className="fw-bold text-dark" style={{ letterSpacing: "1px" }}>
                {school?.name || ""}
              </h2>
              <p className="text-muted">{school?.description || ""}</p>
              <p className="fw-semibold">
                📞 {school?.phone || ""} | ✉️ {school?.email || ""}
              </p>
            </td>
          </tr>
        </tbody>
      </Table>

      {/* Title */}
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
          {items.map((trx, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{trx?.FeeHeading?.fee_heading || trx?.Fee_Heading || trx?.Particular || "—"}</td>
              <td>₹{Number(trx?.Fee_Recieved || 0).toFixed(2)}</td>
              {showFineColumn && <td>₹{Number(trx?.Fine_Amount || 0).toFixed(2)}</td>}
              <td>₹{Number(trx?.Concession || 0).toFixed(2)}</td>
              <td>{trx?.feeBalance !== undefined ? `₹${Number(trx.feeBalance).toFixed(2)}` : "N/A"}</td>
              <td>₹{Number(trx?.VanFee || 0).toFixed(2)}</td>
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
        <p><strong>Mode of Transaction:</strong> {items[0]?.PaymentMode || "—"}</p>
        <p><strong>Transaction ID:</strong> {items[0]?.Transaction_ID || "N/A"}</p>
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
