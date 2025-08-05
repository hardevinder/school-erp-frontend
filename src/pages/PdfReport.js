import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles for the PDF layout with reduced font sizes
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 20,
    paddingBottom: 40, // Increased bottom padding
    fontSize: 9, // reduced base font size
    fontFamily: 'Helvetica',
  },
  headerContainer: {
    textAlign: 'center',
    marginBottom: 10,
  },
  schoolName: {
    fontSize: 13, // slightly reduced
    fontWeight: 'bold',
  },
  schoolDesc: {
    fontSize: 9, // slightly reduced
    marginTop: 2,
  },
  dateRange: {
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11, // slightly reduced
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 6,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#999',
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderColor: '#999',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  tableHeaderCell: {
    textAlign: 'center',
    padding: 4,
    fontSize: 8, // reduced font size for header cells
    borderRightWidth: 1,
    borderColor: '#999',
  },
  tableCell: {
    textAlign: 'center',
    padding: 4,
    fontSize: 8, // reduced font size for table cells
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  boldCell: {
    fontWeight: 'bold',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    right: 20,
    fontSize: 8, // reduced footer font size
    textAlign: 'center',
  },
});

// Helper function to format numbers in Indian numbering system
const formatIndianNumber = (amount) => {
  if (isNaN(amount)) return amount;
  const x = Number(amount).toString();
  const lastThree = x.substring(x.length - 3);
  const otherNumbers = x.substring(0, x.length - 3);
  const formattedOtherNumbers =
    otherNumbers !== ''
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
      : '';
  return formattedOtherNumbers !== ''
    ? formattedOtherNumbers + ',' + lastThree
    : lastThree;
};

// Reusable component for table header with fixed prop to force repetition
const TableHeader = () => (
  <View style={styles.tableHeaderRow} fixed>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Sr. No</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Slip ID</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Admission No.</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Student Name</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Class</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Payment Mode</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Heading</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Created At</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Fee Received</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Concession</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Van Fee</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Total Received</Text>
  </View>
);

// Helper function to paginate data: 24 records per page.
const paginateData = (data) => {
  const pages = [];
  for (let i = 0; i < data.length; i += 20) {
    pages.push(data.slice(i, i + 20));
  }
  return pages;
};

const PdfReport = ({ school, startDate, endDate, aggregatedData = [] }) => {
  // Paginate aggregated data
  const pagesData = paginateData(aggregatedData);

  return (
    <Document>
      {pagesData.map((pageData, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          {pageIndex === 0 && (
            <>
              <View style={styles.headerContainer}>
                <Text style={styles.schoolName}>{school?.name}</Text>
                {/* <Text style={styles.schoolDesc}>{school?.description}</Text> */}
              </View>
              <Text style={styles.dateRange}>
                Date Range: {startDate} to {endDate}
              </Text>
              <Text style={styles.sectionTitle}>Collection Report</Text>
            </>
          )}
          <View style={styles.table}>
            {/* Table header repeated on every page */}
            <TableHeader />
            {pageData.map((item, index) => {
              // Calculate serial number for 24 records per page
              const serialNumber = pageIndex * 20 + index + 1;
              // Horizontal total: Fee Received + Van Fee
              const horizontalTotal =
                Number(item.totalFeeReceived) + Number(item.totalVanFee);
              return (
                <View style={styles.tableRow} key={serialNumber}>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{serialNumber}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{item.Slip_ID}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{item.Student?.admission_number}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{item.Student?.name}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{item.Student?.Class?.class_name}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{item.PaymentMode}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{item.feeHeadingName}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{new Date(item.createdAt).toLocaleString()}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatIndianNumber(item.totalFeeReceived)}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatIndianNumber(item.totalConcession)}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatIndianNumber(item.totalVanFee)}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatIndianNumber(horizontalTotal)}</Text>
                </View>
              );
            })}
          </View>
          <Text
            style={styles.pageFooter}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  );
};

export default PdfReport;
