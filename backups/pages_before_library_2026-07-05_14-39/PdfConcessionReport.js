import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
  totalBlock: { marginTop: 20, marginLeft: 20 },
  totalRow: { flexDirection: 'row', marginBottom: 4 },
  totalLabel: { width: 150, fontWeight: 'bold' },
  totalValue: { width: 100 },
});

const format = (val) => val === '----' ? '----' : Number(val).toLocaleString('en-IN');

const pivotReportData = (report) => {
  const headingMap = new Map(); // key = heading name, value = id
  const studentRows = [];
  const totalsMap = {};

  report.forEach(cls => {
    cls.students.forEach(stu => {
      headingMap.set(stu.feeHeading, stu.feeHeadingId); // collect heading ID
    });
  });

  const feeHeadings = Array.from(headingMap.entries())
    .sort((a, b) => a[1] - b[1]) // sort by ID
    .map(([name]) => name);

  report.forEach(cls => {
    cls.students.forEach(stu => {
      const existing = studentRows.find(s => s.name === stu.studentName && s.className === cls.className);
      if (existing) {
        existing[stu.feeHeading] = stu.concessionAmount;
      } else {
        const row = {
          name: stu.studentName,
          className: cls.className,
          [stu.feeHeading]: stu.concessionAmount,
        };
        studentRows.push(row);
      }

      totalsMap[stu.feeHeading] = (totalsMap[stu.feeHeading] || 0) + Number(stu.concessionAmount || 0);
    });
  });

  return { feeHeadings, studentRows, totalsMap };
};


const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

const PdfConcessionReport = ({ school, report }) => {
  const { feeHeadings, studentRows, totalsMap } = pivotReportData(report);
  const pages = chunk(studentRows, 25);

  return (
    <Document>
      {pages.map((pageRows, pageIndex) => (
        <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{school?.name || 'School Name'}</Text>
            <Text>Concession Report (All Amounts in INR)</Text>
          </View>

          {/* Table Header */}
          <View style={[styles.tableHeader]}>
            <Text style={[styles.cell, styles.cellIndex]}>#</Text>
            <Text style={[styles.cell, styles.cellName]}>Student Name</Text>
            <Text style={[styles.cell, styles.cellClass]}>Class</Text>
            {feeHeadings.map((head, i) => (
              <Text key={i} style={[styles.cell, styles.cellHeading(feeHeadings.length)]}>{head}</Text>
            ))}
          </View>

          {/* Student Rows */}
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

          {/* Only show totals on the last page */}
          {pageIndex === pages.length - 1 && (
            <View style={styles.totalBlock}>
              <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>Summary</Text>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Students:</Text>
                <Text style={styles.totalValue}>{studentRows.length}</Text>
              </View>
              {feeHeadings.map((head, k) => (
                <View key={k} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Concession - {head}:</Text>
                  <Text style={styles.totalValue}>{format(totalsMap[head] || 0)}</Text>
                </View>
              ))}
            </View>
          )}
        </Page>
      ))}
    </Document>
  );
};

export default PdfConcessionReport;
