import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Styles
const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 9, fontFamily: 'Helvetica' },
  header: { textAlign: 'center', marginBottom: 10 },
  title: { fontSize: 13, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', borderBottom: 1, fontWeight: 'bold', backgroundColor: '#eee' },
  row: { flexDirection: 'row', borderBottom: 1 },
  cell: { padding: 3, borderRight: 1, textAlign: 'center' },
  cellIndex: { width: '5%' },
  cellName: { width: '25%', textAlign: 'left', paddingLeft: 4 },
  cellClass: { width: '12%' },
  cellHeading: (count) => ({ width: `${(58 / count).toFixed(2)}%` }),
  summaryTitle: { marginTop: 10, fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', marginTop: 4 },
  summaryCellLabel: { width: '32%', textAlign: 'right', paddingRight: 5 },
  summaryCellValue: { fontWeight: 'bold' },
});

const format = (val) => val === '----' ? '----' : Number(val).toLocaleString('en-IN');

const pivotReportData = (report) => {
  const headingMap = new Map();
  const studentRows = [];

  report.forEach(cls => {
    cls.students.forEach(stu => {
      headingMap.set(stu.feeHeading, stu.feeHeadingId);
    });
  });

  const feeHeadings = Array.from(headingMap.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  report.forEach(cls => {
    cls.students.forEach(stu => {
      const existing = studentRows.find(s => s.name === stu.studentName && s.className === cls.className);
      if (existing) {
        existing[stu.feeHeading] = stu.vanFeePaid;
      } else {
        const row = {
          name: stu.studentName,
          className: cls.className,
          [stu.feeHeading]: stu.vanFeePaid,
        };
        studentRows.push(row);
      }
    });
  });

  return { feeHeadings, studentRows };
};

const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

const PdfVanFeeReport = ({ school, report }) => {
  const { feeHeadings, studentRows } = pivotReportData(report);
  const pages = chunk(studentRows, 25);

  // ✅ Calculate Summary Totals
  const summaryTotals = {};
  feeHeadings.forEach(head => {
    summaryTotals[head] = studentRows.reduce((sum, row) => sum + (parseFloat(row[head]) || 0), 0);
  });

  return (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{school?.name || 'School Name'}</Text>
            <Text>Van Fee Detailed Report (Pivoted by Month)</Text>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.cellIndex]}>#</Text>
            <Text style={[styles.cell, styles.cellName]}>Student Name</Text>
            <Text style={[styles.cell, styles.cellClass]}>Class</Text>
            {feeHeadings.map((head, i) => (
              <Text key={i} style={[styles.cell, styles.cellHeading(feeHeadings.length)]}>{head}</Text>
            ))}
          </View>

          {/* Table Rows */}
          {pageRows.map((stu, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, styles.cellIndex]}>{i + 1 + pageIndex * 25}</Text>
              <Text style={[styles.cell, styles.cellName]}>{stu.name}</Text>
              <Text style={[styles.cell, styles.cellClass]}>{stu.className}</Text>
              {feeHeadings.map((head, j) => (
                <Text key={j} style={[styles.cell, styles.cellHeading(feeHeadings.length)]}>
                  {stu[head] ? format(stu[head]) : '----'}
                </Text>
              ))}
            </View>
          ))}

          {/* ✅ Summary only on the last page */}
          {pageIndex === pages.length - 1 && (
            <View>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryCellLabel}>Total Students:</Text>
                <Text style={styles.summaryCellValue}>{studentRows.length}</Text>
              </View>
              {feeHeadings.map((head, i) => (
                <View key={i} style={styles.summaryRow}>
                  <Text style={styles.summaryCellLabel}>Total {head}:</Text>
                  <Text style={styles.summaryCellValue}>{format(summaryTotals[head])}</Text>
                </View>
              ))}
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
};

export default PdfVanFeeReport;
