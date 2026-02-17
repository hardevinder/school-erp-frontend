import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Row,
  Col,
  Table,
  Button,
  Form,
  Alert,
  Spinner,
  InputGroup,
} from "react-bootstrap";
import api from "../api";
import { pdf, Page, Text, View, Document, StyleSheet } from "@react-pdf/renderer";

// ✅ Charts (Recharts)
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";

const toINR = (n) => (Number(n || 0)).toLocaleString("en-IN");

/* ------------------ CSV DOWNLOAD ------------------ */
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

        {/* Body rows */}
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

/* ------------------ CHART HELPERS ------------------ */
const makeColor = (i) => {
  const hue = (i * 53) % 360;
  return `hsl(${hue} 70% 45%)`;
};

// label on each bar (only if >0)
const ValueLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      textAnchor="middle"
      fontSize={11}
      fill="#111"
    >
      {value}
    </text>
  );
};

// tooltip formatting
const tooltipFormatter = (value) => [toINR(value), "Count"];

const CasteGenderReport = () => {
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
  const [categories, setCategories] = useState(["SC", "ST", "OBC", "General"]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  // ✅ toggle view
  const [viewMode, setViewMode] = useState("table"); // "table" | "chart"

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/student-caste-report/caste-gender-report");
      const data = res.data || {};
      setMatrix(Array.isArray(data.matrix) ? data.matrix : []);
      setGrandTotal(data.grandTotal || null);
      setCategories(
        Array.isArray(data.categories) && data.categories.length
          ? data.categories
          : ["SC", "ST", "OBC", "General"]
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

  // ✅ class-wise totals for chart (grouped Boys vs Girls)
  const chartDataTotal = useMemo(() => {
    return filtered.map((r) => ({
      class_name: r.class_name || "",
      Boys: Number(r.Total?.Boys || 0),
      Girls: Number(r.Total?.Girls || 0),
      Total: Number(r.Total?.Total || 0),
    }));
  }, [filtered]);

  // ✅ category-wise totals across filtered classes (grouped Boys vs Girls)
  const chartDataByCategory = useMemo(() => {
    return categories.map((cat) => ({
      category: cat,
      Boys: filtered.reduce((sum, r) => sum + Number(r?.[cat]?.Boys || 0), 0),
      Girls: filtered.reduce((sum, r) => sum + Number(r?.[cat]?.Girls || 0), 0),
      Total: filtered.reduce((sum, r) => sum + Number(r?.[cat]?.Total || 0), 0),
    }));
  }, [filtered, categories]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    const header = ["Class"];
    categories.forEach((cat) => header.push(`${cat} Boys`, `${cat} Girls`, `${cat} Total`));
    header.push("Total Boys", "Total Girls", "Overall Total");

    const rows = [header];
    filtered.forEach((r) => {
      const row = [r.class_name];
      categories.forEach((cat) => {
        const cell = r[cat] || { Boys: 0, Girls: 0, Total: 0 };
        row.push(cell.Boys || 0, cell.Girls || 0, cell.Total || 0);
      });
      row.push(r.Total?.Boys || 0, r.Total?.Girls || 0, r.Total?.Total || 0);
      rows.push(row);
    });

    if (grandTotal) {
      const gt = ["Total (All Classes)"];
      categories.forEach((cat) => {
        const cell = grandTotal[cat] || { Boys: 0, Girls: 0, Total: 0 };
        gt.push(cell.Boys || 0, cell.Girls || 0, cell.Total || 0);
      });
      gt.push(grandTotal.Total?.Boys || 0, grandTotal.Total?.Girls || 0, grandTotal.Total?.Total || 0);
      rows.push([]);
      rows.push(gt);
    }

    downloadCSV("caste-gender-report.csv", rows);
  };

  const handleExportPDF = async () => {
    const doc = (
      <PdfCasteGenderReport
        categories={categories}
        matrix={filtered}
        grandTotal={grandTotal}
      />
    );
    const blob = await pdf(doc).toBlob();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <Container className="mt-4">
      <Row className="align-items-center">
        <Col>
          <h2 className="mb-0">Class-wise Caste & Gender Report</h2>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {filtered.length} classes shown
          </div>
        </Col>

        <Col md="5" className="mt-2 mt-md-0">
          <InputGroup>
            <Form.Control
              placeholder="Search class (e.g., 1st, Nursery)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button variant="outline-secondary" onClick={() => setSearch("")}>
                Clear
              </Button>
            )}
          </InputGroup>
        </Col>

        <Col className="text-end mt-2 mt-md-0">
          {/* ✅ Graphic view toggle */}
          <Button
            variant={viewMode === "chart" ? "primary" : "outline-primary"}
            className="me-2"
            onClick={() => setViewMode((v) => (v === "table" ? "chart" : "table"))}
          >
            {viewMode === "table" ? "Graphic View" : "Table View"}
          </Button>

          <Button variant="secondary" className="me-2" onClick={handlePrint}>
            Print
          </Button>
          <Button variant="success" className="me-2" onClick={handleExportCSV}>
            Export CSV
          </Button>
          <Button variant="danger" onClick={handleExportPDF}>
            Export PDF
          </Button>
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
        <Row className="mt-3">
          <Col>
            <Alert variant="danger">{error}</Alert>
          </Col>
        </Row>
      )}

      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <Row className="mt-3">
              <Col>
                <Alert variant="info">No classes match your search.</Alert>
              </Col>
            </Row>
          ) : viewMode === "table" ? (
            // ===================== TABLE VIEW =====================
            <Row className="mt-3">
              <Col>
                <div style={{ overflowX: "auto" }}>
                  <Table striped bordered hover responsive>
                    <thead>
                      <tr>
                        <th rowSpan={2} className="align-middle text-center">
                          Class
                        </th>
                        {categories.map((cat) => (
                          <th key={cat} colSpan={3} className="text-center">
                            {cat}
                          </th>
                        ))}
                        <th colSpan={3} className="text-center">
                          Total
                        </th>
                      </tr>
                      <tr>
                        {categories.map((cat) => (
                          <React.Fragment key={`${cat}-sub`}>
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
                          <td>
                            <strong>{r.class_name}</strong>
                          </td>
                          {categories.map((cat) => {
                            const cell = r[cat] || { Boys: 0, Girls: 0, Total: 0 };
                            return (
                              <React.Fragment key={`${r.class_name}-${cat}`}>
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
                          <td>
                            <strong>Total (All Classes)</strong>
                          </td>
                          {categories.map((cat) => {
                            const cell = grandTotal[cat] || { Boys: 0, Girls: 0, Total: 0 };
                            return (
                              <React.Fragment key={`grand-${cat}`}>
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
              </Col>
            </Row>
          ) : (
            // ===================== CHART VIEW =====================
            <Row className="mt-3 g-3">
              {/* Class-wise Boys vs Girls */}
              <Col md={12}>
                <div className="p-3 border rounded bg-white">
                  <div className="fw-bold">Class-wise Boys vs Girls</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Side-by-side bars for comparison (counts on bars)
                  </div>

                  <div style={{ width: "100%", height: 380 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={chartDataTotal}
                        margin={{ top: 24, right: 20, left: 10, bottom: 60 }}
                        barCategoryGap={18}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="class_name"
                          angle={-30}
                          textAnchor="end"
                          interval={0}
                          height={70}
                        />
                        <YAxis />
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend />

                        <Bar dataKey="Boys" name="Boys" fill={makeColor(1)}>
                          <LabelList content={<ValueLabel />} />
                        </Bar>

                        <Bar dataKey="Girls" name="Girls" fill={makeColor(7)}>
                          <LabelList content={<ValueLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Col>

              {/* Category-wise Boys vs Girls (Totals across filtered classes) */}
              <Col md={12}>
                <div className="p-3 border rounded bg-white">
                  <div className="fw-bold">Category-wise Boys vs Girls</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    Totals across filtered classes (counts on bars)
                  </div>

                  <div style={{ width: "100%", height: 340 }}>
                    <ResponsiveContainer>
                      <BarChart
                        data={chartDataByCategory}
                        margin={{ top: 24, right: 20, left: 10, bottom: 20 }}
                        barCategoryGap={26}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend />

                        <Bar dataKey="Boys" name="Boys" fill={makeColor(2)}>
                          <LabelList content={<ValueLabel />} />
                        </Bar>

                        <Bar dataKey="Girls" name="Girls" fill={makeColor(8)}>
                          <LabelList content={<ValueLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {grandTotal && (
                    <div className="mt-2 text-muted" style={{ fontSize: 12 }}>
                      Grand Total (All Classes): Boys <b>{toINR(grandTotal.Total?.Boys || 0)}</b>, Girls{" "}
                      <b>{toINR(grandTotal.Total?.Girls || 0)}</b>, Overall{" "}
                      <b>{toINR(grandTotal.Total?.Total || 0)}</b>
                    </div>
                  )}
                </div>
              </Col>
            </Row>
          )}
        </>
      )}
    </Container>
  );
};

export default CasteGenderReport;
