import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    flexDirection: "column",
    padding: 20,
    fontSize: 10,
    fontFamily: "Helvetica",
    position: "relative",
  },
  // Full header only on the first page
  headerContainer: {
    flexDirection: "column",
    alignItems: "center",
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: "column",
    alignItems: "center",
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  schoolInfo: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: "center",
  },
  schoolBold: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  headerRight: {
    fontSize: 10,
    textAlign: "center",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#999",
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottomWidth: 1,
    borderColor: "#999",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ccc",
  },
  tableHeaderCell: {
    textAlign: "center",
    padding: 3,
    fontSize: 9,
    borderRightWidth: 1,
    borderColor: "#999",
  },
  tableCell: {
    textAlign: "center",
    padding: 3,
    fontSize: 9,
    borderRightWidth: 1,
    borderColor: "#ccc",
  },
  signatureContainer: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  signatureText: {
    fontSize: 10,
    marginRight: 40,
  },
  pageFooter: {
    position: "absolute",
    bottom: 10,
    left: 20,
    right: 20,
    fontSize: 9,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 6,
    textAlign: "center",
  },
});

// Helper function to format numbers using the Indian numbering system (without currency symbol)
const formatValue = (val) => {
  return Number(val) === 0 ? "-" : Number(val).toLocaleString("en-IN");
};

// Get a sorted array of unique fee headings across all student data
const getUniqueFeeHeadings = (studentData) => {
  const headings = new Set();
  studentData.forEach((student) => {
    if (student.feeDetails) {
      student.feeDetails.forEach((fee) => {
        headings.add(fee.fee_heading);
      });
    }
  });
  return Array.from(headings);
};

// For each student, create a map of fee details keyed by fee heading.
const mapStudentFeeDetails = (student) => {
  const feeMap = {};
  if (student.feeDetails) {
    student.feeDetails.forEach((fee) => {
      feeMap[fee.fee_heading] = fee.finalAmountDue;
    });
  }
  return feeMap;
};

// Component for the table header (displayed on every page)
const TableHeader = ({ feeHeadings }) => (
  <View style={styles.tableHeaderRow}>
    <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Sr. No</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Student ID</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Student Name</Text>
    {feeHeadings.map((heading, idx) => (
      <Text key={idx} style={[styles.tableHeaderCell, { flex: 1.2 }]}>
        {heading}
      </Text>
    ))}
  </View>
);

const PdfStudentDueReport = ({ school, selectedClass, studentData, headSummary, grandSummary }) => {
  // Get unique fee headings from student data.
  const feeHeadings = getUniqueFeeHeadings(studentData);

  // Today's date string
  const today = new Date().toLocaleDateString("en-IN");

  // Use the passed class name directly.
  const className = selectedClass;

  // Uniformly paginate studentData with 20 records per page.
  const recordsPerPage = 20;
  const totalPages = Math.ceil(studentData.length / recordsPerPage);
  const studentPages = [];

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    const pageData = studentData.slice(pageIndex * recordsPerPage, (pageIndex + 1) * recordsPerPage);
    studentPages.push(
      <Page size="A4" orientation="landscape" style={styles.page} key={`student-page-${pageIndex}`}>
        {/* Only on the first page, render the full header */}
        {pageIndex === 0 && (
          <View style={styles.headerContainer}>
            <View style={styles.headerLeft}>
              <Text style={styles.reportTitle}>{school?.name}</Text>
              <Text style={styles.schoolBold}>{school?.description}</Text>
              <Text style={styles.schoolBold}>Student Fee Due Report</Text>
              <Text style={styles.schoolInfo}>Session: 2025-26</Text>
              <Text style={styles.schoolInfo}>Class: {className}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text>As on: {today}</Text>
            </View>
          </View>
        )}
        {/* On all pages, repeat the table header */}
        <View style={styles.table}>
          <TableHeader feeHeadings={feeHeadings} />
          {pageData.map((student, index) => {
            const feeMap = mapStudentFeeDetails(student);
            return (
              <View style={styles.tableRow} key={student.id}>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>{pageIndex * recordsPerPage + index + 1}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{student.id}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{student.name}</Text>
                {feeHeadings.map((heading, idx) => (
                  <Text key={idx} style={[styles.tableCell, { flex: 1.2 }]}>
                    {feeMap[heading] ? formatValue(feeMap[heading]) : "-"}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
        {/* Signature (this remains on every page; adjust if needed) */}
        <View style={styles.signatureContainer}>
          <Text style={styles.signatureText}>Signature: ___________________</Text>
        </View>
        <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    );
  }

  // Summary page for headwise and grand summary.
  const summaryPage = (
    <Page size="A4" orientation="landscape" style={styles.page} key="summary-page">
      <View style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionTitle}>Headwise Summary</Text>
        </View>
        <View style={styles.headerRight}>
          <Text>As on: {today}</Text>
        </View>
      </View>
      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Heading</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Original Due</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Effective Due</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Final Due</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Received</Text>
        </View>
        {Object.entries(headSummary).map(([heading, summary]) => (
          <View style={styles.tableRow} key={heading}>
            <Text style={[styles.tableCell, { flex: 2 }]}>{heading}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(summary.originalFeeDue)}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(summary.effectiveFeeDue)}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(summary.finalAmountDue)}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(summary.totalFeeReceived)}</Text>
          </View>
        ))}
        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, { flex: 2, fontWeight: "bold" }]}>Grand Total</Text>
          <Text style={[styles.tableCell, { flex: 2, fontWeight: "bold" }]}>{formatValue(grandSummary.originalFeeDue)}</Text>
          <Text style={[styles.tableCell, { flex: 2, fontWeight: "bold" }]}>{formatValue(grandSummary.effectiveFeeDue)}</Text>
          <Text style={[styles.tableCell, { flex: 2, fontWeight: "bold" }]}>{formatValue(grandSummary.finalAmountDue)}</Text>
          <Text style={[styles.tableCell, { flex: 2, fontWeight: "bold" }]}>{formatValue(grandSummary.totalFeeReceived)}</Text>
        </View>
      </View>
      <View style={styles.signatureContainer}>
        <Text style={styles.signatureText}>Signature: ___________________</Text>
      </View>
      <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
    </Page>
  );

  return (
    <Document>
      {studentPages}
      {summaryPage}
    </Document>
  );
};

export default PdfStudentDueReport;
