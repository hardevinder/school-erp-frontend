// src/components/ReceiptModal.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import ReceiptContent from "./ReceiptContent";
import "bootstrap/dist/css/bootstrap.min.css";

import normalizeUploadedUrl from "../../utils/normalizeUploadedUrl";

/**
 * Helpers to normalize various response shapes.
 */
const normalizeSchoolFromResponse = (resp) => {
  if (!resp) return null;

  const d = resp.data;
  if (!d) return null;

  // New controller shape: { success: true, schools: [...] }
  if (Array.isArray(d.schools) && d.schools.length > 0) {
    return d.schools[0];
  }

  // Older or alternate shapes.
  if (Array.isArray(d) && d.length > 0) return d[0];
  if (Array.isArray(d.data) && d.data.length > 0) return d.data[0];
  if (d.school) return d.school;
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
  // - { receipt: [...] }
  // - single object { ... } -> wrap into array
  if (Array.isArray(r)) return r;
  if (Array.isArray(r.data)) return r.data;
  if (Array.isArray(r.receipt)) return r.receipt;
  if (r.data && typeof r.data === "object") return [r.data];
  if (typeof r === "object") return [r];

  return null;
};

const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const isValidDateParts = (year, month, day) => {
  const yyyy = Number(year);
  const mm = Number(month);
  const dd = Number(day);

  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || !Number.isInteger(dd)) {
    return false;
  }

  if (yyyy < 1000 || yyyy > 9999 || mm < 1 || mm > 12 || dd < 1) {
    return false;
  }

  return dd <= new Date(yyyy, mm, 0).getDate();
};

/**
 * Convert supported API/user date values to YYYY-MM-DD without timezone shifting.
 *
 * Supported examples:
 * - 2026-07-07
 * - 2026-07-07T12:00:00.000Z
 * - 7/7/2026
 * - 07/07/2026
 * - 7 Jul, 2026
 */
const normalizeDateValue = (value) => {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";

    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }

  const raw = String(value).trim();
  if (!raw) return "";

  // Database/API format. Read date parts directly to avoid UTC/local timezone shifts.
  const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);

    if (!isValidDateParts(year, month, day)) return "";

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  // Indian/user format: D/M/YYYY or DD/MM/YYYY.
  const dmy = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);

    if (!isValidDateParts(year, month, day)) return "";

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  // Already formatted display value: 7 Jul, 2026.
  const readable = raw.match(/^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})$/);
  if (readable) {
    const day = Number(readable[1]);
    const month = MONTH_SHORT_NAMES.findIndex(
      (name) => name.toLowerCase() === readable[2].toLowerCase()
    ) + 1;
    const year = Number(readable[3]);

    if (!isValidDateParts(year, month, day)) return "";

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  // Numeric timestamp support. Avoid new Date(raw) for ambiguous slash dates.
  if (/^\d{10,13}$/.test(raw)) {
    const numericValue = Number(raw);
    const timestamp = raw.length === 10 ? numericValue * 1000 : numericValue;
    const parsed = new Date(timestamp);

    if (!Number.isNaN(parsed.getTime())) {
      return [
        parsed.getFullYear(),
        String(parsed.getMonth() + 1).padStart(2, "0"),
        String(parsed.getDate()).padStart(2, "0"),
      ].join("-");
    }
  }

  return "";
};

/**
 * Public display format used everywhere in the receipt modal:
 * 7 Jul, 2026
 */
const formatDateForDisplay = (value) => {
  const normalized = normalizeDateValue(value);
  if (!normalized) return value ? String(value).trim() : "—";

  const [year, month, day] = normalized.split("-");
  return `${Number(day)} ${MONTH_SHORT_NAMES[Number(month) - 1]}, ${year}`;
};

/**
 * Decide which object properties represent dates.
 * ReceiptContent may use different API field names, so normalize common variants.
 */
const isDateFieldName = (key) => {
  const field = String(key || "");

  return (
    /date/i.test(field) ||
    /^(createdAt|updatedAt|deletedAt)$/i.test(field) ||
    /^(dob|doa|dow)$/i.test(field) ||
    /_(dob|doa|dow)$/i.test(field)
  );
};

/**
 * Create a display-only copy of receipt data.
 * Raw receipt state remains unchanged for totals and any future API operations.
 */
const createDisplayReceiptValue = (value, key = "") => {
  if (Array.isArray(value)) {
    return value.map((item) => createDisplayReceiptValue(item));
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        createDisplayReceiptValue(childValue, childKey),
      ])
    );
  }

  if (isDateFieldName(key) && value !== null && value !== undefined && value !== "") {
    return formatDateForDisplay(value);
  }

  return value;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const ReceiptModal = (props) => {
  const { slipId: routeSlipId } = useParams();
  const slipId = props.slipId || routeSlipId;

  const [school, setSchool] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const printableRef = useRef();

  const fetchData = useCallback(async () => {
    if (!slipId) {
      setSchool(null);
      setReceipt(null);
      setError("No slip ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch both in parallel and tolerate either succeeding/failing.
      const [schoolSettled, receiptSettled] = await Promise.allSettled([
        api.get("/schools"),
        api.get(`/transactions/slip/${slipId}`),
      ]);

      // Normalize school.
      let fetchedSchool = null;
      if (schoolSettled.status === "fulfilled") {
        fetchedSchool = normalizeSchoolFromResponse(schoolSettled.value);
      } else {
        console.warn("School fetch failed:", schoolSettled.reason);
      }

      // Normalize receipt.
      let fetchedReceipt = null;
      if (receiptSettled.status === "fulfilled") {
        fetchedReceipt = normalizeReceiptFromResponse(receiptSettled.value);
      } else {
        console.error("Receipt fetch failed:", receiptSettled.reason);
      }

      // Try to extract school embedded in receipt if school endpoint is empty.
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

      // Final fallback placeholder so ReceiptContent does not crash.
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

      // Clone before modifying, so API response objects are not mutated unexpectedly.
      fetchedSchool = { ...fetchedSchool };

      // Normalize logo URL now; this avoids a double-prefix URL issue.
      if (fetchedSchool.logo) {
        fetchedSchool.logo = normalizeUploadedUrl(fetchedSchool.logo);
      }

      // Ensure receipt is an array with at least one item.
      if (!Array.isArray(fetchedReceipt) || fetchedReceipt.length === 0) {
        setSchool(fetchedSchool);
        setReceipt(null);
        setError("No receipt data returned from server.");
        return;
      }

      // Clone rows before normalizing nested values.
      fetchedReceipt = fetchedReceipt.map((item) => ({ ...item }));

      // Ensure Student exists on the first item using common fallbacks.
      if (!fetchedReceipt[0].Student && !fetchedReceipt[0].student) {
        const maybeStudent = Object.values(fetchedReceipt[0]).find(
          (value) =>
            value &&
            typeof value === "object" &&
            (value.name || value.admission_number)
        );

        if (maybeStudent) {
          fetchedReceipt[0].Student = maybeStudent;
        } else {
          fetchedReceipt[0].Student = {
            name: fetchedReceipt[0].student_name || "Unknown Student",
            admission_number:
              fetchedReceipt[0].AdmissionNumber ||
              fetchedReceipt[0].admission ||
              "—",
          };
        }
      } else if (!fetchedReceipt[0].Student && fetchedReceipt[0].student) {
        fetchedReceipt[0].Student = fetchedReceipt[0].student;
      }

      // Normalize logos embedded inside receipt objects as well.
      const first = fetchedReceipt[0];

      if (first.School?.logo) {
        first.School = {
          ...first.School,
          logo: normalizeUploadedUrl(first.School.logo),
        };
      }

      if (first.school?.logo) {
        first.school = {
          ...first.school,
          logo: normalizeUploadedUrl(first.school.logo),
        };
      }

      setSchool(fetchedSchool);
      setReceipt(fetchedReceipt);
    } catch (err) {
      console.error("ReceiptModal fetchData error:", err);
      setSchool(null);
      setReceipt(null);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Error fetching receipt data."
      );
    } finally {
      setLoading(false);
    }
  }, [slipId]);

  useEffect(() => {
    if (props.show) {
      fetchData();
      return;
    }

    setLoading(false);
    setError(null);
  }, [fetchData, props.show]);

  /**
   * ReceiptContent receives a display-only copy where all recognized date fields
   * use the same unambiguous format: 7 Jul, 2026.
   */
  const displayReceipt = useMemo(
    () => (Array.isArray(receipt) ? createDisplayReceiptValue(receipt) : receipt),
    [receipt]
  );

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

      try {
        newWindow.opener = null;
      } catch {
        // Some browsers do not allow changing opener; printing still works.
      }

      const safeSlipId = escapeHtml(slipId || "Preview");

      newWindow.document.write(`
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Receipt - ${safeSlipId}</title>
            <link
              rel="stylesheet"
              href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
            />
            <style>
              @page { margin: 20mm; }
              body {
                padding: 20px;
                margin: 0;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                  "Helvetica Neue", Arial, sans-serif;
              }
              .print-button {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 1000;
              }
              @media print {
                .print-button { display: none !important; }
                body { padding: 0; }
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
      newWindow.focus();
    } catch (err) {
      console.error("Error opening print window:", err);
      setError("Failed to open print window.");
    }
  };

  // Totals helper guarded against missing/non-numeric fields.
  const sum = (arr, key) =>
    Array.isArray(arr)
      ? arr.reduce((acc, item) => acc + Number(item?.[key] || 0), 0)
      : 0;

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
            <Button
              variant="secondary"
              onClick={() => props.onClose && props.onClose()}
            >
              Close
            </Button>
          </div>
        </div>
      );
    }

    if (!receipt || !displayReceipt || !school) {
      return <p className="text-center mt-4">Loading receipt...</p>;
    }

    const student =
      displayReceipt.length > 0
        ? displayReceipt[0].Student || displayReceipt[0].student
        : null;

    if (!student) {
      return (
        <div className="p-3">
          <Alert variant="warning">
            No transaction / student data found in the receipt.
          </Alert>
        </div>
      );
    }

    // Keep totals calculated from the untouched raw receipt values.
    const totalAcademicReceived = sum(receipt, "Fee_Recieved");
    const totalAcademicConcession = sum(receipt, "Concession");
    const totalAcademicBalance = sum(receipt, "feeBalance");
    const totalTransportFee = sum(receipt, "VanFee");
    const totalTransportBalance = sum(receipt, "vanFeeBalance");
    const grandTotalReceived = totalAcademicReceived + totalTransportFee;

    // Amount including concession.
    const totalAcademicGross =
      totalAcademicBalance +
      totalAcademicReceived +
      totalAcademicConcession;

    return (
      <div id="receipt-content" ref={printableRef}>
        <ReceiptContent
          school={school}
          receipt={displayReceipt}
          slipId={slipId}
          student={student}
          formatDate={formatDateForDisplay}
          totalAcademicGross={totalAcademicGross}
          totalAcademicReceived={totalAcademicReceived}
          totalAcademicConcession={totalAcademicConcession}
          totalAcademicBalance={totalAcademicBalance}
          totalTransportFee={totalTransportFee}
          totalTransportBalance={totalTransportBalance}
          grandTotalReceived={grandTotalReceived}
        />
      </div>
    );
  };

  return (
    <Modal
      show={props.show}
      onHide={props.onClose}
      size="xl"
      centered
      scrollable
    >
      <Modal.Header closeButton>
        <Modal.Title>Receipt — {slipId || "Preview"}</Modal.Title>
      </Modal.Header>

      <Modal.Body style={{ minHeight: 320 }}>{renderBody()}</Modal.Body>

      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={() => props.onClose && props.onClose()}
        >
          Close
        </Button>

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