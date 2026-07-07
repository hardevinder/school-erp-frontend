import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 10,
    fontFamily: 'Helvetica',
    flexDirection: 'column',
  },
  header: {
    textAlign: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  table: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableCol: {
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    padding: 3,
    textAlign: 'center',
  },
  colWidths: [1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2], // 11 columns
  bold: {
    fontWeight: 'bold',
  },
});

const format = (val) => {
  if (val === null || val === undefined) return '----';
  return Number(val).toLocaleString('en-IN');
};

const PdfSchoolFeeSummary = ({ school, summary }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{school?.name || 'School Name'}</Text>
        <Text>School Fee Summary Report</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableRow}>
          {[
            '#',
            'Fee Heading',
            'Total Due (INR)',
            'Received (INR)',
            'Concession (INR)',
            'Remaining Due (INR)',
            'Full Paid',
            'Partial Paid',
            'Pending',
            'Van Fee Received',
            'Van Students',
          ].map((label, i) => (
            <Text
              key={i}
              style={[styles.tableCol, { flex: styles.colWidths[i] }, styles.bold]}
            >
              {label}
            </Text>
          ))}
        </View>

        {summary.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCol, { flex: styles.colWidths[0] }]}>{index + 1}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[1] }]}>{item.fee_heading}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[2] }]}>{format(item.totalDue)}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[3] }]}>{format(item.totalReceived)}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[4] }]}>{format(item.totalConcession)}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[5] }]}>{format(item.totalRemainingDue)}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[6] }]}>{item.studentsPaidFull ?? '----'}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[7] }]}>{item.studentsPaidPartial ?? '----'}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[8] }]}>{item.studentsPending ?? '----'}</Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[9] }]}>
              {item.vanFeeReceived === null || item.vanFeeReceived === undefined ? '----' : format(item.vanFeeReceived)}
            </Text>
            <Text style={[styles.tableCol, { flex: styles.colWidths[10] }]}>
              {item.vanStudents === null || item.vanStudents === undefined ? '----' : item.vanStudents}
            </Text>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

export default PdfSchoolFeeSummary;
