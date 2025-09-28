// src/components/ReceiptModal.js
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../../api";
import { Modal, Button, Row, Col, Spinner, Alert } from "react-bootstrap";
import ReceiptContent from "./ReceiptContent";
import "bootstrap/dist/css/bootstrap.min.css";

import normalizeUploadedUrl from "../../utils/normalizeUploadedUrl";
/**
 * Helpers to normalize various response shapes
 */
const normalizeSchoolFromResponse = (resp) => {
  if (!resp) return null;
  const d = resp.data;
  if (!d) return null;

  // New controller shape: { success: true, schools: [...] }
  if (d && Array.isArray(d.schools) && d.schools.length > 0) return d.schools[0];

  // older or alternate shapes
  if (Array.isArray(d) && d.length > 0) return d[0];
  if (d && Array.isArray(d.data) && d.data.length > 0) return d.data[0];
  if (d && d.school) return d.school;
  if (typeof d === "object" && Object.keys(d).length > 0) return d;

  return null;
};

const normalizeReceiptFromResponse = (resp) => {
  if (!resp) return null;
  const r = resp.data;
  if (!r) return null;

  // Common shapes:
  // - { data: [...] }
  // - array [...]
  // - single object { ... } -> wrap into array
  if (Array.isArray(r)) return r;
  if (r && Array.isArray(r.data)) return r.data;
  if (r && r.receipt && Array.isArray(r.receipt)) return r.receipt;
  if (r && r.data && typeof r.data === "object") return [r.data];
  if (typeof r === "object") return [r];

  return null;
};

const ReceiptModal = (props) => {
  const { slipId: routeSlipId } = useParams();
  const slipId = props.slipId || routeSlipId;

  const [school, setSchool] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const printableRef = useRef();

  const fetchData = async () => {
    if (!slipId) {
      setError("No slip ID provided.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // fetch both in parallel and tolerate either succeeding/failing
      const [schoolSettled, receiptSettled] = await Promise.allSettled([
        api.get("/schools"),
        api.get(`/transactions/slip/${slipId}`),
      ]);

      console.debug("ReceiptModal: schoolSettled:", schoolSettled);
      console.debug("ReceiptModal: receiptSettled:", receiptSettled);

      // Normalize school
      let fetchedSchool = null;
      if (schoolSettled.status === "fulfilled") {
        fetchedSchool = normalizeSchoolFromResponse(schoolSettled.value);
      }

      // Normalize receipt
      let fetchedReceipt = null;
      if (receiptSettled.status === "fulfilled") {
        fetchedReceipt = normalizeReceiptFromResponse(receiptSettled.value);
      } else {
        // if request rejected, try to extract message
        const err = receiptSettled.reason;
        console.error("Receipt fetch failed:", err);
      }

      // Try to extract school embedded in receipt if school endpoint empty
      if (!fetchedSchool && Array.isArray(fetchedReceipt) && fetchedReceipt.length > 0) {
        const first = fetchedReceipt[0];
        if (first.School || first.school) {
          fetchedSchool = first.School || first.school;
        } else if (first.schoolName || first.institute_name) {
          fetchedSchool = {
            name: first.schoolName || first.institute_name,
            address: first.schoolAddress || first.address || "",
            logo: first.logo || null,
          };
        }
      }

      // final fallback placeholder (so ReceiptContent doesn't crash)
      if (!fetchedSchool) {
        fetchedSchool = {
          id: null,
          name: "Your School",
          address: "",
          phone: "",
          email: "",
          logo: null,
        };
      }

      // Normalize logo URL now (important fix for double-prefix bug)
      if (fetchedSchool && fetchedSchool.logo) {
        fetchedSchool.logo = normalizeUploadedUrl(fetchedSchool.logo);
      }

      // sanity: ensure receipt is an array with at least one item
      if (!Array.isArray(fetchedReceipt) || fetchedReceipt.length === 0) {
        setSchool(fetchedSchool);
        setReceipt(null);
        setError("No receipt data returned from server.");
        setLoading(false);
        return;
      }

      // ensure student exists on first item (attempt common fallbacks)
      if (!fetchedReceipt[0].Student && !fetchedReceipt[0].student) {
        const maybeStudent = Object.values(fetchedReceipt[0]).find(
          (v) => v && typeof v === "object" && (v.name || v.admission_number)
        );
        if (maybeStudent) {
          fetchedReceipt[0].Student = maybeStudent;
        } else {
          fetchedReceipt[0].Student = {
            name: fetchedReceipt[0].student_name || "Unknown Student",
            admission_number:
              fetchedReceipt[0].AdmissionNumber || fetchedReceipt[0].admission || "—",
          };
        }
      } else if (!fetchedReceipt[0].Student && fetchedReceipt[0].student) {
        fetchedReceipt[0].Student = fetchedReceipt[0].student;
      }

      // Also normalize logo if embedded in receipt item (rare, but possible)
      if (Array.isArray(fetchedReceipt) && fetchedReceipt.length > 0) {
        const first = fetchedReceipt[0];
        if (first.School && first.School.logo) {
          first.School.logo = normalizeUploadedUrl(first.School.logo);
        }
        if (first.school && first.school.logo) {
          first.school.logo = normalizeUploadedUrl(first.school.logo);
        }
      }

      // apply state
      setSchool(fetchedSchool);
      setReceipt(fetchedReceipt);
      setLoading(false);
    } catch (err) {
      console.error("ReceiptModal fetchData error:", err);
      setError(err.message || "Error fetching receipt data");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (props.show) {
      fetchData();
    } else {
      // clear data when modal hidden (optional)
      // setSchool(null);
      // setReceipt(null);
      setLoading(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slipId, props.show]);

  const handleOpenNewTab = () => {
    try {
      const content = printableRef.current?.innerHTML ?? "";
      const newWindow = window.open("", "_blank");
      if (!newWindow) {
        setError(
          "Unable to open new tab (popup blocked). Allow popups for this site or use the browser's print option."
        );
        return;
      }

      newWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${slipId}</title>
            <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
            <style>
              @page { margin: 20mm; }
              body { padding: 20px; margin: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
              .print-button {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
              }
            </style>
          </head>
          <body>
            <div class="print-button">
              <button class="btn btn-primary" onclick="window.print();">Print</button>
            </div>
            ${content}
          </body>
        </html>
      `);
      newWindow.document.close();
    } catch (err) {
      console.error("Error opening print window:", err);
      setError("Failed to open print window.");
    }
  };

  // Totals helpers (guard against missing fields)
  const sum = (arr, key) =>
    Array.isArray(arr) ? arr.reduce((acc, it) => acc + (Number(it?.[key] || 0)), 0) : 0;

  const renderBody = () => {
    if (!slipId) {
      return <p className="text-center mt-4">No slip ID provided.</p>;
    }
    if (loading) {
      return (
        <div className="text-center my-5">
          <Spinner animation="border" role="status" />
          <div className="mt-2">Loading receipt...</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-3">
          <Alert variant="danger">
            <strong>Error:</strong> {error}
          </Alert>
          <div className="d-flex gap-2">
            <Button onClick={fetchData}>Retry</Button>
            <Button variant="secondary" onClick={() => props.onClose && props.onClose()}>
              Close
            </Button>
          </div>
        </div>
      );
    }
    if (!receipt || !school) {
      return <p className="text-center mt-4">Loading receipt...</p>;
    }

    const student = receipt.length > 0 ? receipt[0].Student : null;
    if (!student) {
      return (
        <div className="p-3">
          <Alert variant="warning">No transaction / student data found in the receipt.</Alert>
        </div>
      );
    }

    // You had these totals in the previous file — keep them (safe-guarded)
    const totalAcademicReceived = sum(receipt, "Fee_Recieved");
    const totalAcademicConcession = sum(receipt, "Concession");
    const totalAcademicBalance = sum(receipt, "feeBalance");
    const totalTransportFee = sum(receipt, "VanFee");
    const totalTransportBalance = sum(receipt, "vanFeeBalance");
    const grandTotalReceived = totalAcademicReceived + totalTransportFee;

    return (
      <>
        <div id="receipt-content" ref={printableRef}>
          <ReceiptContent
            school={school}
            receipt={receipt}
            slipId={slipId}
            student={student}
            // pass totals if ReceiptContent expects them (it can also compute)
            totalAcademicReceived={totalAcademicReceived}
            totalAcademicConcession={totalAcademicConcession}
            totalAcademicBalance={totalAcademicBalance}
            totalTransportFee={totalTransportFee}
            totalTransportBalance={totalTransportBalance}
            grandTotalReceived={grandTotalReceived}
          />
        </div>
      </>
    );
  };

  return (
    <Modal show={props.show} onHide={props.onClose} size="xl" centered>
      <Modal.Header closeButton>
        <Modal.Title>Receipt — {slipId || "Preview"}</Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ minHeight: 320 }}>{renderBody()}</Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={() => props.onClose && props.onClose()}>
          Close
        </Button>

        {/* Show Print only when we have printable content */}
        {!loading && !error && receipt && (
          <Button variant="primary" onClick={handleOpenNewTab}>
            Print
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ReceiptModal;
