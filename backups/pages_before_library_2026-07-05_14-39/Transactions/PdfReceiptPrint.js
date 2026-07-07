// ReceiptPDF.js
import React, { useEffect, useState } from "react";
import { Page, Text, View, Document, StyleSheet, PDFDownloadLink } from "@react-pdf/renderer";
import { useParams } from "react-router-dom";
import api from "../../api";

// Define styles for the PDF document
const styles = StyleSheet.create({
  page: {
    padding: 30,
  },
  header: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: "center",
  },
  section: {
    marginBottom: 10,
    fontSize: 12,
  },
});

// This component formats the receipt content into a PDF document
const ReceiptPDFDocument = ({ school, receipt, student }) => {
  // Calculations (similar to your modal)
  const totalAcademicReceived = receipt.reduce((sum, trx) => sum + trx.Fee_Recieved, 0);
  const totalAcademicConcession = receipt.reduce((sum, trx) => sum + trx.Concession, 0);
  const totalAcademicBalance = receipt.reduce((sum, trx) => sum + (trx.feeBalance || 0), 0);
  const totalTransportFee = receipt.reduce((sum, trx) => sum + (trx.VanFee || 0), 0);
  const totalTransportBalance = receipt.reduce((sum, trx) => sum + (trx.vanFeeBalance || 0), 0);
  const grandTotalReceived = totalAcademicReceived + totalTransportFee;

  return (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.header}>{school.name} Receipt</Text>
        <View style={styles.section}>
          <Text>Student: {student.name}</Text>
        </View>
        <View style={styles.section}>
          <Text>Total Academic Received: {totalAcademicReceived}</Text>
          <Text>Total Academic Concession: {totalAcademicConcession}</Text>
          <Text>Total Academic Balance: {totalAcademicBalance}</Text>
        </View>
        <View style={styles.section}>
          <Text>Total Transport Fee: {totalTransportFee}</Text>
          <Text>Total Transport Balance: {totalTransportBalance}</Text>
        </View>
        <View style={styles.section}>
          <Text>Grand Total Received: {grandTotalReceived}</Text>
        </View>
        {/* Add more sections or details as needed */}
      </Page>
    </Document>
  );
};

const ReceiptPDF = (props) => {
  // Using useParams to extract slipId from the route, similar to your modal component
  const { slipId: routeSlipId } = useParams();
  const slipId = props.slipId || routeSlipId;

  const [school, setSchool] = useState(null);
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!slipId) {
      console.warn("No slipId provided to ReceiptPDF");
      return;
    }
    const fetchData = async () => {
      try {
        const schoolResponse = await api.get("/schools");
        if (schoolResponse.data.length > 0) {
          setSchool(schoolResponse.data[0]);
        }
        const receiptResponse = await api.get(`/transactions/slip/${slipId}`);
        setReceipt(receiptResponse.data.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [slipId]);

  if (!slipId) {
    return <p className="text-center mt-5">No slip ID provided.</p>;
  }
  if (!school || !receipt) {
    return <p className="text-center mt-5">Loading data...</p>;
  }

  const student = receipt.length > 0 ? receipt[0].Student : null;
  if (!student) {
    return <p className="text-center mt-5">No transaction data found.</p>;
  }

  return (
    <div className="container mt-5">
      <h2 className="text-center">Download Receipt as PDF</h2>
      <PDFDownloadLink
        document={<ReceiptPDFDocument school={school} receipt={receipt} student={student} />}
        fileName={`receipt-${slipId}.pdf`}
        style={{
          textDecoration: "none",
          padding: "10px 20px",
          color: "#fff",
          backgroundColor: "#007bff",
          borderRadius: "4px",
          display: "inline-block",
          marginTop: "20px",
        }}
      >
        {({ blob, url, loading, error }) =>
          loading ? "Generating PDF..." : "Download PDF"
        }
      </PDFDownloadLink>
    </div>
  );
};

export default ReceiptPDF;
