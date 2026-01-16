import React, { useEffect, useMemo, useState } from "react";
import { Container, Row, Col, Table, Button, Form, Alert, Spinner, InputGroup } from "react-bootstrap";
import api from "../api";
import { pdf, Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";

const toINR = (n) => (Number(n || 0)).toLocaleString("en-IN");

const downloadCSV = (filename, rows) => {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/* ------------------------- PDF STYLES ------------------------- */
const styles = StyleSheet.create({
  page: { padding: 10, flexDirection: "column" },
  title: { fontSize: 14, textAlign: "center", marginBottom: 6, fontWeight: "bold" },
  table: { display: "table", width: "auto", borderStyle: "solid", borderWidth: 1 },
  row: { flexDirection: "row" },
  headerCell: { flex: 1, borderWidth: 1, padding: 2, fontSize: 8, textAlign: "center", fontWeight: "bold" },
  cell: { flex: 1, borderWidth: 1, padding: 2, fontSize: 8, textAlign: "center" },
});

/* --------------------- PDF COMPONENT --------------------- */
const PdfReligionGenderReport = ({ religions, matrix, grandTotal }) => (
  <Document>
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>Class-wise Religion & Gender Report</Text>

      <View style={styles.table}>
        {/* Header Row 1 */}
        <View style={styles.row}>
          <Text style={{ ...styles.headerCell, flex: 2 }}>Classes</Text>
          {religions.map((rel) => (
            <Text key={rel} style={{ ...styles.headerCell, flex: 3 }}>{rel} Students</Text>
          ))}
          <Text style={{ ...styles.headerCell, flex: 3 }}>Total</Text>
        </View>

        {/* Header Row 2 */}
        <View style={styles.row}>
          {religions.map((rel) => (
            <React.Fragment key={`${rel}-sub`}>
              <Text style={styles.headerCell}>Boys</Text>
              <Text style={styles.headerCell}>Girls</Text>
              <Text style={styles.headerCell}>Total</Text>
            </React.Fragment>
          ))}
          <Text style={styles.headerCell}>Boys</Text>
          <Text style={styles.headerCell}>Girls</Text>
          <Text style={styles.headerCell}>Total</Text>
        </View>

        {/* Body rows */}
        {matrix.map((r, idx) => (
          <View style={styles.row} key={idx}>
            <Text style={{ ...styles.cell, flex: 2 }}>{r.class_name}</Text>
            {religions.map((rel) => {
              const c = r[rel] || { Boys: 0, Girls: 0, Total: 0 };
              return (
                <React.Fragment key={`${r.class_name}-${rel}`}>
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
            <Text style={{ ...styles.cell, flex: 2, fontWeight: "bold" }}>Total (All Classes)</Text>
            {religions.map((rel) => {
              const c = grandTotal[rel] || { Boys: 0, Girls: 0, Total: 0 };
              return (
                <React.Fragment key={`grand-${rel}`}>
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

const ReligionGenderReport = () => {
  const [loading, setLoading] = useState(false);

  // ✅ religion report state
  const [matrix, setMatrix] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
  const [religions, setReligions] = useState(["Hindu", "Sikh", "Muslim", "Christian", "Other"]);

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      // same API (because backend returns both)
      const res = await api.get("/student-caste-report/caste-gender-report");
      const data = res.data || {};

      // ✅ pick religion keys from payload
      setMatrix(Array.isArray(data.religionMatrix) ? data.religionMatrix : []);
      setGrandTotal(data.religionGrandTotal || null);
      setReligions(
        Array.isArray(data.religions) && data.religions.length
          ? data.religions
          : ["Hindu", "Sikh", "Muslim", "Christian", "Other"]
      );
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || "Failed to fetch report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matrix;
    return matrix.filter((r) => (r.class_name || "").toLowerCase().includes(q));
  }, [matrix, search]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const header = ["Class"];
    religions.forEach((rel) => header.push(`${rel} Boys`, `${rel} Girls`, `${rel} Total`));
    header.push("Total Boys", "Total Girls", "Overall Total");

    const rows = [header];

    filtered.forEach((r) => {
      const row = [r.class_name];
      religions.forEach((rel) => {
        const cell = r[rel] || { Boys: 0, Girls: 0, Total: 0 };
        row.push(cell.Boys || 0, cell.Girls || 0, cell.Total || 0);
      });
      row.push(r.Total?.Boys || 0, r.Total?.Girls || 0, r.Total?.Total || 0);
      rows.push(row);
    });

    if (grandTotal) {
      const gt = ["Total (All Classes)"];
      religions.forEach((rel) => {
        const cell = grandTotal[rel] || { Boys: 0, Girls: 0, Total: 0 };
        gt.push(cell.Boys || 0, cell.Girls || 0, cell.Total || 0);
      });
      gt.push(grandTotal.Total?.Boys || 0, grandTotal.Total?.Girls || 0, grandTotal.Total?.Total || 0);
      rows.push([]);
      rows.push(gt);
    }

    downloadCSV("religion-gender-report.csv", rows);
  };

  const handleExportPDF = async () => {
    const doc = <PdfReligionGenderReport religions={religions} matrix={filtered} grandTotal={grandTotal} />;
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <Container className="mt-4">
      <Row className="align-items-center">
        <Col><h2>Class-wise Religion & Gender Report</h2></Col>

        <Col md="6">
          <InputGroup>
            <Form.Control
              placeholder="Search class (e.g., 1st, Nursery)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button variant="outline-secondary" onClick={() => setSearch("")}>Clear</Button>
            )}
          </InputGroup>
        </Col>

        <Col className="text-end">
          <Button variant="secondary" className="me-2" onClick={handlePrint}>Print</Button>
          <Button variant="success" className="me-2" onClick={handleExportCSV}>Export CSV</Button>
          <Button variant="danger" onClick={handleExportPDF}>Export PDF</Button>
        </Col>
      </Row>

      {loading && (
        <Row className="mt-4">
          <Col className="text-center">
            <Spinner animation="border" role="status" />
            <div className="mt-2">Loading report…</div>
          </Col>
        </Row>
      )}

      {error && !loading && (
        <Row className="mt-3"><Col><Alert variant="danger">{error}</Alert></Col></Row>
      )}

      {!loading && !error && (
        <Row className="mt-3">
          <Col>
            {filtered.length === 0 ? (
              <Alert variant="info">No classes match your search.</Alert>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th rowSpan={2} className="align-middle text-center">Class</th>
                      {religions.map((rel) => (
                        <th key={rel} colSpan={3} className="text-center">{rel}</th>
                      ))}
                      <th colSpan={3} className="text-center">Total</th>
                    </tr>
                    <tr>
                      {religions.map((rel) => (
                        <React.Fragment key={`${rel}-sub`}>
                          <th className="text-center">Boys</th>
                          <th className="text-center">Girls</th>
                          <th className="text-center">Total</th>
                        </React.Fragment>
                      ))}
                      <th className="text-center">Boys</th>
                      <th className="text-center">Girls</th>
                      <th className="text-center">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((r, idx) => (
                      <tr key={`${r.class_name}-${idx}`}>
                        <td><strong>{r.class_name}</strong></td>

                        {religions.map((rel) => {
                          const cell = r[rel] || { Boys: 0, Girls: 0, Total: 0 };
                          return (
                            <React.Fragment key={`${r.class_name}-${rel}`}>
                              <td className="text-end">{toINR(cell.Boys)}</td>
                              <td className="text-end">{toINR(cell.Girls)}</td>
                              <td className="text-end">{toINR(cell.Total)}</td>
                            </React.Fragment>
                          );
                        })}

                        <td className="text-end fw-bold">{toINR(r.Total?.Boys || 0)}</td>
                        <td className="text-end fw-bold">{toINR(r.Total?.Girls || 0)}</td>
                        <td className="text-end fw-bold">{toINR(r.Total?.Total || 0)}</td>
                      </tr>
                    ))}
                  </tbody>

                  {grandTotal && (
                    <tfoot>
                      <tr>
                        <td><strong>Total (All Classes)</strong></td>
                        {religions.map((rel) => {
                          const cell = grandTotal[rel] || { Boys: 0, Girls: 0, Total: 0 };
                          return (
                            <React.Fragment key={`grand-${rel}`}>
                              <td className="text-end fw-bold">{toINR(cell.Boys)}</td>
                              <td className="text-end fw-bold">{toINR(cell.Girls)}</td>
                              <td className="text-end fw-bold">{toINR(cell.Total)}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className="text-end fw-bold">{toINR(grandTotal.Total?.Boys || 0)}</td>
                        <td className="text-end fw-bold">{toINR(grandTotal.Total?.Girls || 0)}</td>
                        <td className="text-end fw-bold">{toINR(grandTotal.Total?.Total || 0)}</td>
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </div>
            )}
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default ReligionGenderReport;
