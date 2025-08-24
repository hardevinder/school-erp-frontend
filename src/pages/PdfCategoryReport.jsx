import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define styles for the PDF layout
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 20,
    fontSize: 10,
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  headerContainer: {
    textAlign: 'center',
    marginBottom: 10,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  schoolDesc: {
    fontSize: 10,
    marginTop: 2,
  },
  dateRange: {
    fontSize: 10,
    marginTop: 5,
    textAlign: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
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
    padding: 3,
    fontSize: 9,
    borderRightWidth: 1,
    borderColor: '#999',
  },
  tableCell: {
    textAlign: 'center',
    padding: 3,
    fontSize: 9,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
  pageFooter: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    right: 20,
    fontSize: 9,
    textAlign: 'center',
  },
});

// --------- Helpers ---------

// Indian number format without currency symbol
const formatValue = (val) => {
  return Number(val) === 0 ? "0" : Number(val).toLocaleString('en-IN');
};

// dd/MM/yyyy for ISO "yyyy-MM-dd" strings (date range header)
const formatDisplayDate = (isoYmd) => {
  if (!isoYmd) return '';
  const [y, m, d] = String(isoYmd).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
};

// dd/MM/yyyy for Date/ISO timestamps (Created At column)
const formatToDDMMYYYY = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

// Chunk an array into smaller arrays of a given size.
const chunkArray = (array, chunkSize) => {
  const results = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    results.push(array.slice(i, i + chunkSize));
  }
  return results;
};

// Pivot the aggregated data by Slip_ID using feeCategoryName as dynamic columns.
// Separate van fee for "Tuition Fee": tuition fee stays in feeCategories, van fee goes to vanFeeTotal.
const pivotReportData = (data) => {
  const grouped = data.reduce((acc, curr) => {
    const slipId = curr.Slip_ID;
    if (!acc[slipId]) {
      acc[slipId] = {
        Slip_ID: curr.Slip_ID,
        Transaction_ID: curr.Transaction_ID, // ✅ keep Txn ID
        createdAt: curr.createdAt,
        Student: curr.Student,
        PaymentMode: curr.PaymentMode,
        feeCategories: {},
        vanFeeTotal: 0,
        fineAmount: 0,
      };
    }
    const category = curr.feeCategoryName;
    if (!acc[slipId].feeCategories[category]) {
      acc[slipId].feeCategories[category] = { totalReceived: 0 };
    }

    if (category === "Tuition Fee") {
      acc[slipId].feeCategories[category].totalReceived += Number(curr.totalFeeReceived) || 0;
      acc[slipId].vanFeeTotal += Number(curr.totalVanFee) || 0;
    } else {
      acc[slipId].feeCategories[category].totalReceived +=
        (Number(curr.totalFeeReceived) || 0) + (Number(curr.totalVanFee) || 0);
    }

    // ✅ Accumulate fine
    acc[slipId].fineAmount += Number(curr.totalFine || curr.Fine_Amount || 0);

    return acc;
  }, {});
  return Object.values(grouped);
};

// Get unique fee categories across all pivoted rows.
const getUniqueCategories = (pivotedData) => {
  const categories = new Set();
  pivotedData.forEach((row) => {
    Object.keys(row.feeCategories).forEach((cat) => categories.add(cat));
  });
  return Array.from(categories);
};

// Reusable component for the Collection Report table header (with Van Fee, Fine, Overall Total).
const CollectionTableHeader = ({ feeCategories }) => (
  <View style={styles.tableHeaderRow}>
    <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Sr. No</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Slip ID</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Txn ID</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Admission No.</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Student Name</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Class</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Payment Mode</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Created At</Text>
    {feeCategories.map((cat, idx) => (
      <Text key={idx} style={[styles.tableHeaderCell, { flex: 1 }]}>{cat}</Text>
    ))}
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Van Fee</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Fine</Text>
    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Overall Total</Text>
  </View>
);

// Reusable component for the Category Summary table header
const SummaryTableHeader = () => (
  <View style={styles.tableHeaderRow}>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Category</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Received (Cash)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Received (Online)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Received (Overall)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Concession (Cash)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Concession (Online)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Concession (Overall)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Van Fee (Cash)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Van Fee (Online)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Van Fee (Overall)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Concession (Cash)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Concession (Online)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Fee Concession (Overall)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Received (Cash)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Received (Online)</Text>
    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Received (Overall)</Text>
  </View>
);

const PdfCategoryReport = ({ school, startDate, endDate, aggregatedData = [] }) => {
  // Pivot the data by Slip_ID.
  const pivotedData = pivotReportData(aggregatedData);
  // Get unique fee categories.
  const feeCategories = getUniqueCategories(pivotedData);

  // Compute overall totals per fee category (for the collection report footer).
  const overallTotals = feeCategories.reduce((totals, category) => {
    totals[category] = pivotedData.reduce((sum, row) => {
      const feeData = row.feeCategories[category];
      return sum + (feeData ? feeData.totalReceived : 0);
    }, 0);
    return totals;
  }, {});
  const grandTotal = Object.values(overallTotals).reduce((sum, val) => sum + val, 0);

  // Compute overall van fee and fine totals across all slips.
  const overallVanFeeTotal = pivotedData.reduce((sum, row) => sum + (row.vanFeeTotal || 0), 0);
  const overallFineTotal = pivotedData.reduce((sum, row) => sum + (row.fineAmount || 0), 0);

  // For the summary report, group aggregatedData by category.
  const categoryGroups = aggregatedData.reduce((acc, curr) => {
    const cat = curr.feeCategoryName;
    if (!acc[cat]) {
      acc[cat] = {
        cash: { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0, totalReceived: 0 },
        online: { totalFeeReceived: 0, totalConcession: 0, totalVanFee: 0, totalVanFeeConcession: 0, totalReceived: 0 },
      };
    }
    if (curr.PaymentMode === 'Cash') {
      const fine = Number(curr.totalFine || curr.Fine_Amount || 0);
      acc[cat].cash.totalFeeReceived += Number(curr.totalFeeReceived) || 0;
      acc[cat].cash.totalConcession += Number(curr.totalConcession) || 0;
      acc[cat].cash.totalVanFee += Number(curr.totalVanFee) || 0;
      acc[cat].cash.totalVanFeeConcession += Number(curr.totalVanFeeConcession) || 0;
      acc[cat].cash.totalReceived +=
        (Number(curr.totalFeeReceived) || 0) + (Number(curr.totalVanFee) || 0) + fine;
    } else if (curr.PaymentMode === 'Online') {
      const fine = Number(curr.totalFine || curr.Fine_Amount || 0);
      acc[cat].online.totalFeeReceived += Number(curr.totalFeeReceived) || 0;
      acc[cat].online.totalConcession += Number(curr.totalConcession) || 0;
      acc[cat].online.totalVanFee += Number(curr.totalVanFee) || 0;
      acc[cat].online.totalVanFeeConcession += Number(curr.totalVanFeeConcession) || 0;
      acc[cat].online.totalReceived +=
        (Number(curr.totalFeeReceived) || 0) + (Number(curr.totalVanFee) || 0) + fine;
    }
    return acc;
  }, {});
  const categorySummary = Object.keys(categoryGroups).map((category) => {
    const cash = categoryGroups[category].cash;
    const online = categoryGroups[category].online;
    return {
      category,
      cash,
      online,
      overall: {
        totalFeeReceived: cash.totalFeeReceived + online.totalFeeReceived,
        totalConcession: cash.totalConcession + online.totalConcession,
        totalVanFee: cash.totalVanFee + online.totalVanFee,
        totalVanFeeConcession: cash.totalVanFeeConcession + online.totalVanFeeConcession,
        totalReceived: cash.totalReceived + online.totalReceived,
      },
    };
  });

  // ---- Pagination ----
  // Collection: 15 records per page (as requested)
  const recordsPerPage = 18;
  const paginatedCollection = chunkArray(pivotedData, recordsPerPage);

  // Summary: keep same page sizing for simplicity (also 15 for consistency)
  const paginatedSummary = chunkArray(categorySummary, recordsPerPage);

  return (
    <Document>
      {/* Collection Report Pages */}
      {paginatedCollection.map((chunk, chunkIndex) => (
        <Page
          key={`collection-page-${chunkIndex}`}
          size="A4"
          orientation="landscape"
          style={styles.page}
        >
          {chunkIndex === 0 && (
            <>
              <View style={styles.headerContainer}>
                <Text style={styles.schoolName}>{school?.name || school?.school_name || 'School Name'}</Text>
                <Text style={styles.schoolDesc}>{school?.description || school?.address || ''}</Text>
              </View>
              <Text style={styles.dateRange}>
                Date Range: {formatDisplayDate(startDate)} to {formatDisplayDate(endDate)}
              </Text>
              <Text style={styles.sectionTitle}>Collection Report</Text>
            </>
          )}

          <View style={styles.table}>
            <CollectionTableHeader feeCategories={feeCategories} />

            {chunk.map((row, idx) => {
              // Sum the fee category totals, then add van fee and fine for overall
              const categoryTotal = Object.values(row.feeCategories).reduce(
                (sum, fee) => sum + (fee?.totalReceived || 0), 0
              );
              const overallRowTotal = categoryTotal + (row.vanFeeTotal || 0) + (row.fineAmount || 0);

              return (
                <View style={styles.tableRow} key={row.Slip_ID}>
                  <Text style={[styles.tableCell, { flex: 0.8 }]}>
                    {chunkIndex * recordsPerPage + idx + 1}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.Slip_ID}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.Transaction_ID || '-'}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.Student?.admission_number}</Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{row.Student?.name}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.Student?.Class?.class_name}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.PaymentMode}</Text>

                  {/* Created At in dd/MM/yyyy */}
                  <Text style={[styles.tableCell, { flex: 2 }]}>
                    {formatToDDMMYYYY(row.createdAt)}
                  </Text>

                  {feeCategories.map((cat, i) => {
                    const feeData = row.feeCategories[cat];
                    return (
                      <Text key={i} style={[styles.tableCell, { flex: 1 }]}>
                        {feeData ? formatValue(feeData.totalReceived) : formatValue(0)}
                      </Text>
                    );
                  })}

                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatValue(row.vanFeeTotal)}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatValue(row.fineAmount || 0)}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{formatValue(overallRowTotal)}</Text>
                </View>
              );
            })}

            {/* Only on the last collection page, render overall totals */}
            {chunkIndex === paginatedCollection.length - 1 && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 10, fontWeight: 'bold' }]}>Overall Totals</Text>
                {feeCategories.map((cat, i) => (
                  <Text key={i} style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>
                    {formatValue(overallTotals[cat])}
                  </Text>
                ))}
                <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>
                  {formatValue(overallVanFeeTotal)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>
                  {formatValue(overallFineTotal)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>
                  {formatValue(grandTotal + overallVanFeeTotal + overallFineTotal)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
      ))}

      {/* Category Summary Report Pages */}
      {paginatedSummary.map((chunk, chunkIndex) => (
        <Page
          key={`summary-page-${chunkIndex}`}
          size="A4"
          orientation="landscape"
          style={styles.page}
        >
          {chunkIndex === 0 && (
            <Text style={styles.sectionTitle}>Category Summary Report</Text>
          )}

          <View style={styles.table}>
            <SummaryTableHeader />
            {chunk.map((item, index) => (
              <View style={styles.tableRow} key={index}>
                <Text style={[styles.tableCell, { flex: 2 }]}>{item.category}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalFeeReceived)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.online.totalFeeReceived)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalFeeReceived + item.online.totalFeeReceived)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalConcession)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.online.totalConcession)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalConcession + item.online.totalConcession)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalVanFee)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.online.totalVanFee)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalVanFee + item.online.totalVanFee)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalVanFeeConcession)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.online.totalVanFeeConcession)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalVanFeeConcession + item.online.totalVanFeeConcession)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalReceived)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.online.totalReceived)}</Text>
                <Text style={[styles.tableCell, { flex: 2 }]}>{formatValue(item.cash.totalReceived + item.online.totalReceived)}</Text>
              </View>
            ))}

            {/* Only on the last summary page, render overall totals */}
            {chunkIndex === paginatedSummary.length - 1 && (
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>Overall Totals</Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalFeeReceived, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.online.totalFeeReceived, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalFeeReceived + s.online.totalFeeReceived, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalConcession, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.online.totalConcession, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalConcession + s.online.totalConcession, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalVanFee, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.online.totalVanFee, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalVanFee + s.online.totalVanFee, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalVanFeeConcession, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.online.totalVanFeeConcession, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalVanFeeConcession + s.online.totalVanFeeConcession, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalReceived, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.online.totalReceived, 0))}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: 'bold' }]}>
                  {formatValue(categorySummary.reduce((sum, s) => sum + s.cash.totalReceived + s.online.totalReceived, 0))}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.pageFooter} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
      ))}
    </Document>
  );
};

export default PdfCategoryReport;
