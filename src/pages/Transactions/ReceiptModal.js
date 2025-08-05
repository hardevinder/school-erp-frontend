// ReceiptModal.js
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../../api"; 
import { Modal, Button, Row, Col } from "react-bootstrap";
import ReceiptContent from "./ReceiptContent";
import "bootstrap/dist/css/bootstrap.min.css";

const ReceiptModal = (props) => {
  const { slipId: routeSlipId } = useParams();
  const slipId = props.slipId || routeSlipId;

  const [school, setSchool] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const printableRef = useRef();

  useEffect(() => {
    if (!slipId) {
      console.warn("No slipId provided to ReceiptModal");
      return;
    }
    const fetchSchool = async () => {
      try {
        const response = await api.get("/schools");
        if (response.data.length > 0) {
          setSchool(response.data[0]);
        }
      } catch (error) {
        console.error("Error fetching school data:", error);
      }
    };

    const fetchReceipt = async () => {
      try {
        const response = await api.get(`/transactions/slip/${slipId}`);
        setReceipt(response.data.data);
      } catch (error) {
        console.error("Error fetching receipt data:", error);
      }
    };

    fetchSchool();
    fetchReceipt();
  }, [slipId]);

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

  const totalAcademicReceived = receipt.reduce(
    (sum, trx) => sum + trx.Fee_Recieved,
    0
  );
  const totalAcademicConcession = receipt.reduce(
    (sum, trx) => sum + trx.Concession,
    0
  );
  const totalAcademicBalance = receipt.reduce(
    (sum, trx) => sum + (trx.feeBalance || 0),
    0
  );

  const totalTransportFee = receipt.reduce(
    (sum, trx) => sum + (trx.VanFee || 0),
    0
  );
  const totalTransportBalance = receipt.reduce(
    (sum, trx) => sum + (trx.vanFeeBalance || 0),
    0
  );

  const grandTotalReceived = totalAcademicReceived + totalTransportFee;

  const handleOpenNewTab = () => {
    const content = printableRef.current.innerHTML;
    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
          <style>
            @page { margin: 20mm; }
            body { padding: 20px; margin: 0 10; width: 80%; box-sizing: border-box; }
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
            <button class="btn btn-primary" onclick="window.print()">Print</button>
          </div>
          ${content}
        </body>
      </html>
    `);
    newWindow.document.close();
  };

  return (
    <>
      <Modal show={props.show} onHide={props.onClose} size="xl" centered>
        <Modal.Header closeButton />
        <div id="receipt-content" ref={printableRef}>
          <ReceiptContent
            school={school}
            receipt={receipt}
            slipId={slipId}
            student={student}
          />
        </div>
        <Modal.Footer>
          <Button onClick={handleOpenNewTab}>Print</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ReceiptModal;
