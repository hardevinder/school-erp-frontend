// PdfCasteGenderReport.jsx
import React from "react";
import { Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 10, flexDirection: "column" },
  title: { fontSize: 14, textAlign: "center", marginBottom: 6, fontWeight: "bold" },
  table: { display: "table", width: "auto", borderStyle: "solid", borderWidth: 1 },
  row: { flexDirection: "row" },
  headerCell: {
    flex: 1,
    borderWidth: 1,
    padding: 3,
    fontSize: 8,
    textAlign: "center",
    fontWeight: "bold",
  },
  cell: {
    flex: 1,
    borderWidth: 1,
    padding: 3,
    fontSize: 8,
    textAlign: "center",
  },
});

/**
 * PDF component to render caste & gender report in landscape mode.
 */
const PdfCasteGenderReport = ({ categories, matrix, grandTotal }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>Class-wise Caste & Gender Report</Text>

      <View style={styles.table}>
        {/* Header Row 1 */}
        <View style={styles.row}>
          <Text style={{ ...styles.headerCell, flex: 2 }}>Classes</Text>
          {categories.map((cat) => (
            <Text key={cat} style={{ ...styles.headerCell, flex: 3 }}>
              {cat} Students
            </Text>
          ))}
          <Text style={{ ...styles.headerCell, flex: 3 }}>Total</Text>
        </View>

        {/* Header Row 2 */}
        <View style={styles.row}>
          <Text style={styles.headerCell}></Text>
          {categories.map((cat) => (
            <React.Fragment key={`${cat}-sub`}>
              <Text style={styles.headerCell}>Boys</Text>
              <Text style={styles.headerCell}>Girls</Text>
              <Text style={styles.headerCell}>Total</Text>
            </React.Fragment>
          ))}
          <Text style={styles.headerCell}>Boys</Text>
          <Text style={styles.headerCell}>Girls</Text>
          <Text style={styles.headerCell}>Total</Text>
        </View>

        {/* Body Rows */}
        {matrix.map((r, idx) => (
          <View style={styles.row} key={idx}>
            <Text style={{ ...styles.cell, flex: 2 }}>{r.class_name}</Text>
            {categories.map((cat) => {
              const c = r[cat] || { Boys: 0, Girls: 0, Total: 0 };
              return (
                <React.Fragment key={`${r.class_name}-${cat}`}>
                  <Text style={styles.cell}>{c.Boys}</Text>
                  <Text style={styles.cell}>{c.Girls}</Text>
                  <Text style={styles.cell}>{c.Total}</Text>
                </React.Fragment>
              );
            })}
            <Text style={styles.cell}>{r.Total?.Boys || 0}</Text>
            <Text style={styles.cell}>{r.Total?.Girls || 0}</Text>
            <Text style={styles.cell}>{r.Total?.Total || 0}</Text>
          </View>
        ))}

        {/* Grand Total */}
        {grandTotal && (
          <View style={styles.row}>
            <Text style={{ ...styles.cell, flex: 2, fontWeight: "bold" }}>
              Total (All Classes)
            </Text>
            {categories.map((cat) => {
              const c = grandTotal[cat] || { Boys: 0, Girls: 0, Total: 0 };
              return (
                <React.Fragment key={`grand-${cat}`}>
                  <Text style={styles.cell}>{c.Boys}</Text>
                  <Text style={styles.cell}>{c.Girls}</Text>
                  <Text style={styles.cell}>{c.Total}</Text>
                </React.Fragment>
              );
            })}
            <Text style={styles.cell}>{grandTotal.Total?.Boys || 0}</Text>
            <Text style={styles.cell}>{grandTotal.Total?.Girls || 0}</Text>
            <Text style={styles.cell}>{grandTotal.Total?.Total || 0}</Text>
          </View>
        )}
      </View>
    </Page>
  </Document>
);

export default PdfCasteGenderReport;
