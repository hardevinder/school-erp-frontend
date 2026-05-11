import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import api from "../api";

const VanFeeDetailedReport = () => {
  const [reportPayload, setReportPayload] = useState({
    meta: null,
    data: [],
    headSummary: [],
    noPaymentStudents: [],
  });

  const [school, setSchool] = useState(null);
  const [sessions, setSessions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingSingleExcel, setExportingSingleExcel] = useState(false);
  const [exportingPendingExcel, setExportingPendingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [search, setSearch] = useState("");

  const normalizeSessions = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.sessions)) return payload.sessions;
    return [];
  };

  const normalizeSchool = (payload) => {
    if (Array.isArray(payload) && payload.length > 0) return payload[0];
    if (Array.isArray(payload?.schools) && payload.schools.length > 0) {
      return payload.schools[0];
    }
    if (Array.isArray(payload?.data) && payload.data.length > 0) {
      return payload.data[0];
    }
    return null;
  };

  const getDefaultSessionId = (sessionRows = []) => {
    if (!sessionRows.length) return "";

    const activeSession =
      sessionRows.find(
        (s) =>
          s?.is_active === true ||
          s?.is_active === 1 ||
          s?.isActive === true ||
          s?.status === "active"
      ) || null;

    if (activeSession?.id) return String(activeSession.id);

    const sorted = [...sessionRows].sort(
      (a, b) => Number(b?.id || 0) - Number(a?.id || 0)
    );
    return sorted[0]?.id ? String(sorted[0].id) : "";
  };

  const fetchSessions = async () => {
    const res = await api.get("/sessions");
    return normalizeSessions(res.data);
  };

  const fetchSchool = async () => {
    const res = await api.get("/schools");
    return normalizeSchool(res.data);
  };

  const fetchReport = async (sessionId) => {
    const res = await api.get("/feedue/van-fee-detailed-report", {
      params: { session_id: sessionId },
    });

    if (Array.isArray(res.data)) {
      return {
        meta: null,
        data: res.data,
        headSummary: [],
        noPaymentStudents: [],
      };
    }

    return {
      meta: res.data?.meta || null,
      data: Array.isArray(res.data?.data) ? res.data.data : [],
      headSummary: Array.isArray(res.data?.headSummary)
        ? res.data.headSummary
        : [],
      noPaymentStudents: Array.isArray(res.data?.noPaymentStudents)
        ? res.data.noPaymentStudents
        : [],
    };
  };

  const loadInitialData = async () => {
    setLoading(true);
    setError("");

    try {
      const [sessionRows, schoolData] = await Promise.all([
        fetchSessions(),
        fetchSchool(),
      ]);

      setSessions(sessionRows);
      setSchool(schoolData);

      const defaultSessionId = getDefaultSessionId(sessionRows);
      setSelectedSession(defaultSessionId);
    } catch (err) {
      console.error("Error loading initial van fee report data:", err);
      setError("Failed to load sessions or school data.");
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (sessionId, mode = "load") => {
    if (!sessionId) {
      setReportPayload({
        meta: null,
        data: [],
        headSummary: [],
        noPaymentStudents: [],
      });
      return;
    }

    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const payload = await fetchReport(sessionId);
      setReportPayload(payload);
    } catch (err) {
      console.error("Error loading van fee detailed report:", err);
      setError("Failed to load van fee detailed report.");
      setReportPayload({
        meta: null,
        data: [],
        headSummary: [],
        noPaymentStudents: [],
      });
    } finally {
      if (mode === "refresh") {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadReport(selectedSession);
    }
  }, [selectedSession]);

  const report = reportPayload?.data || [];

  const classOptions = useMemo(() => {
    return report
      .map((item) => ({
        classId: item?.classId ?? "",
        className: item?.className || "Unknown Class",
      }))
      .filter((item) => item.className)
      .sort((a, b) => String(a.className).localeCompare(String(b.className)));
  }, [report]);

  const selectedSessionName = useMemo(() => {
    const row = sessions.find((s) => String(s?.id) === String(selectedSession));
    return row?.name || reportPayload?.meta?.sessionName || "N/A";
  }, [sessions, selectedSession, reportPayload]);

  const formatAmount = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    const num = Number(value);
    if (Number.isNaN(num)) return "—";
    return num.toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const matchesSearch = (student) => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return true;

    const name = String(student?.studentName || "").toLowerCase();
    const admission = String(student?.admissionNumber || "").toLowerCase();
    const route = String(student?.routeName || "").toLowerCase();

    return (
      name.includes(q) || admission.includes(q) || route.includes(q)
    );
  };

  const filteredReport = useMemo(() => {
    let rows =
      selectedClass === "all"
        ? report
        : report.filter(
            (item) => String(item?.classId) === String(selectedClass)
          );

    rows = rows
      .map((cls) => {
        const students = Array.isArray(cls?.students) ? cls.students : [];
        const filteredStudents = students.filter(matchesSearch);

        return {
          ...cls,
          students: filteredStudents,
        };
      })
      .filter((cls) => (cls.students || []).length > 0);

    return rows;
  }, [report, selectedClass, search]);

  const filteredNoPaymentStudents = useMemo(() => {
    const rows = Array.isArray(reportPayload?.noPaymentStudents)
      ? reportPayload.noPaymentStudents
      : [];

    return rows.filter((stu) => {
      const classOk =
        selectedClass === "all"
          ? true
          : String(stu?.classId) === String(selectedClass);

      const q = String(search || "").trim().toLowerCase();
      if (!q) return classOk;

      const name = String(stu?.studentName || "").toLowerCase();
      const admission = String(stu?.admissionNumber || "").toLowerCase();
      const route = String(stu?.routeName || "").toLowerCase();

      return classOk && (name.includes(q) || admission.includes(q) || route.includes(q));
    });
  }, [reportPayload, selectedClass, search]);

  const filteredHeadSummary = useMemo(() => {
    const map = new Map();

    filteredReport.forEach((cls) => {
      const months = Array.isArray(cls?.months) ? cls.months : [];
      const students = Array.isArray(cls?.students) ? cls.students : [];

      months.forEach((month) => {
        if (!map.has(month)) {
          map.set(month, {
            feeHeading: month,
            studentCount: 0,
            noPaymentStudentsCount: 0,
            totalDue: 0,
            totalReceived: 0,
            totalConcession: 0,
            totalPending: 0,
          });
        }
      });

      students.forEach((stu) => {
        months.forEach((month) => {
          const row = map.get(month);
          if (!row) return;

          row.studentCount += 1;
          row.totalDue += Number(stu?.dueByHead?.[month] || 0);
          row.totalReceived += Number(stu?.fees?.[month] || 0);
          row.totalConcession += Number(stu?.concessionByHead?.[month] || 0);
          row.totalPending += Number(stu?.pendingByHead?.[month] || 0);

          if (Number(stu?.fees?.[month] || 0) <= 0) {
            row.noPaymentStudentsCount += 1;
          }
        });
      });
    });

    return Array.from(map.values()).sort((a, b) =>
      String(a.feeHeading).localeCompare(String(b.feeHeading))
    );
  }, [filteredReport]);

  const summary = useMemo(() => {
    let totalStudents = 0;
    let totalEntries = 0;
    let totalDue = 0;
    let totalReceived = 0;
    let totalConcession = 0;
    let totalPending = 0;

    filteredReport.forEach((cls) => {
      const students = Array.isArray(cls?.students) ? cls.students : [];
      totalStudents += students.length;

      students.forEach((stu) => {
        const fees = stu?.fees || {};
        totalEntries += Object.keys(fees).length;
        totalDue += Number(stu?.totalVanFeeDue || 0);
        totalReceived += Number(stu?.totalVanFeePaid || 0);
        totalConcession += Number(stu?.totalVanFeeConcession || 0);
        totalPending += Number(stu?.totalVanFeePending || 0);
      });
    });

    return {
      totalClasses: filteredReport.length,
      totalStudents,
      totalEntries,
      totalDue,
      totalReceived,
      totalConcession,
      totalPending,
      noPaymentStudentsCount: filteredNoPaymentStudents.length,
    };
  }, [filteredReport, filteredNoPaymentStudents]);

  const downloadBlob = (blob, fileName) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const getExportParams = () => {
    const params = { session_id: selectedSession };
    if (selectedClass !== "all") {
      params.class_id = selectedClass;
    }
    return params;
  };

  const handleExcelDownload = async () => {
    if (!selectedSession) {
      setError("Please select a session first.");
      return;
    }

    try {
      setExportingExcel(true);
      setError("");

      const res = await api.get("/feedue/van-fee-detailed-report/excel", {
        params: getExportParams(),
        responseType: "blob",
      });

      const suffix = selectedClass === "all" ? "All_Classes" : "Filtered_Class";
      const fileName = `Van_Fee_Detailed_Report_${selectedSessionName}_${suffix}.xlsx`;
      downloadBlob(res.data, fileName);
    } catch (err) {
      console.error("Excel download error:", err);
      setError("Failed to download Excel report.");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleSingleSheetExcelDownload = async () => {
    if (!selectedSession) {
      setError("Please select a session first.");
      return;
    }

    try {
      setExportingSingleExcel(true);
      setError("");

      const res = await api.get(
        "/feedue/van-fee-detailed-report/excel-single-sheet",
        {
          params: getExportParams(),
          responseType: "blob",
        }
      );

      const suffix = selectedClass === "all" ? "Whole_School" : "Filtered_Class";
      const fileName = `Van_Fee_Detailed_Report_Single_Sheet_${selectedSessionName}_${suffix}.xlsx`;
      downloadBlob(res.data, fileName);
    } catch (err) {
      console.error("Single-sheet Excel download error:", err);
      setError("Failed to download whole school single-sheet Excel.");
    } finally {
      setExportingSingleExcel(false);
    }
  };

  const handlePendingByHeadExcelDownload = async () => {
    if (!selectedSession) {
      setError("Please select a session first.");
      return;
    }

    try {
      setExportingPendingExcel(true);
      setError("");

      const res = await api.get(
        "/feedue/van-fee-detailed-report/pending-by-head/excel",
        {
          params: getExportParams(),
          responseType: "blob",
        }
      );

      const suffix = selectedClass === "all" ? "All_Classes" : "Filtered_Class";
      const fileName = `Van_Fee_Pending_By_Head_${selectedSessionName}_${suffix}.xlsx`;
      downloadBlob(res.data, fileName);
    } catch (err) {
      console.error("Pending-by-head Excel download error:", err);
      setError("Failed to download pending by head Excel.");
    } finally {
      setExportingPendingExcel(false);
    }
  };

  const handlePdfDownload = async () => {
    if (!selectedSession) {
      setError("Please select a session first.");
      return;
    }

    try {
      setExportingPdf(true);
      setError("");

      const res = await api.get("/feedue/van-fee-detailed-report/pdf", {
        params: getExportParams(),
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("PDF download error:", err);
      setError("Failed to generate PDF report.");
    } finally {
      setExportingPdf(false);
    }
  };

  const getStudentStatusBadge = (stu) => {
    const pending = Number(stu?.totalVanFeePending || 0);
    const paid = Number(stu?.totalVanFeePaid || 0);

    if (paid <= 0) {
      return <Badge bg="danger">No Payment</Badge>;
    }
    if (pending <= 0) {
      return <Badge bg="success">Paid</Badge>;
    }
    return <Badge bg="warning" text="dark">Partial</Badge>;
  };

  return (
    <Container fluid className="py-4 px-3 px-md-4">
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <Row className="align-items-center g-3">
            <Col lg={7}>
              <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <h3 className="mb-0 fw-bold text-dark">Van Fee Detailed Report</h3>
                <Badge bg="primary" pill>
                  Session Wise
                </Badge>
              </div>

              <div className="text-muted mb-2">
                Professional transport report with class-wise detail, total due, received,
                concession, pending amount, no-payment students and export options.
              </div>

              <div className="d-flex flex-wrap gap-2">
                {school?.name && (
                  <Badge bg="light" text="dark" pill>
                    School: {school.name}
                  </Badge>
                )}
                <Badge bg="info" text="dark" pill>
                  Session: {selectedSessionName}
                </Badge>
                {selectedClass !== "all" && (
                  <Badge bg="secondary" pill>
                    Filtered Class
                  </Badge>
                )}
              </div>
            </Col>

            <Col lg={5}>
              <div className="d-flex flex-column gap-2">
                <div className="d-flex flex-column flex-md-row gap-2 justify-content-md-end">
                  <Form.Select
                    value={selectedSession}
                    onChange={(e) => {
                      setSelectedSession(e.target.value);
                      setSelectedClass("all");
                      setSearch("");
                    }}
                    style={{ maxWidth: "220px" }}
                  >
                    <option value="">Select Session</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name || `Session ${session.id}`}
                      </option>
                    ))}
                  </Form.Select>

                  <Form.Select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    style={{ maxWidth: "220px" }}
                    disabled={!report.length}
                  >
                    <option value="all">All Classes</option>
                    {classOptions.map((cls) => (
                      <option
                        key={`${cls.classId}-${cls.className}`}
                        value={cls.classId}
                      >
                        {cls.className}
                      </option>
                    ))}
                  </Form.Select>
                </div>

                <div className="d-flex justify-content-md-end">
                  <InputGroup style={{ maxWidth: "444px" }}>
                    <InputGroup.Text>Search</InputGroup.Text>
                    <Form.Control
                      placeholder="Student name / admission no / route"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </InputGroup>
                </div>

                <div className="d-flex flex-wrap gap-2 justify-content-md-end">
                  <Button
                    variant="outline-secondary"
                    onClick={() => loadReport(selectedSession, "refresh")}
                    disabled={refreshing || !selectedSession}
                  >
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </Button>

                  <Button
                    variant="success"
                    onClick={handleExcelDownload}
                    disabled={
                      exportingExcel || !selectedSession || filteredReport.length === 0
                    }
                  >
                    {exportingExcel ? "Downloading..." : "Excel"}
                  </Button>

                  <Button
                    variant="outline-success"
                    onClick={handleSingleSheetExcelDownload}
                    disabled={
                      exportingSingleExcel ||
                      !selectedSession ||
                      filteredReport.length === 0
                    }
                  >
                    {exportingSingleExcel ? "Downloading..." : "Single Sheet Excel"}
                  </Button>

                  <Button
                    variant="outline-primary"
                    onClick={handlePendingByHeadExcelDownload}
                    disabled={
                      exportingPendingExcel ||
                      !selectedSession ||
                      filteredHeadSummary.length === 0
                    }
                  >
                    {exportingPendingExcel ? "Downloading..." : "Pending by Head Excel"}
                  </Button>

                  <Button
                    variant="primary"
                    onClick={handlePdfDownload}
                    disabled={
                      exportingPdf || !selectedSession || filteredReport.length === 0
                    }
                  >
                    {exportingPdf ? "Generating..." : "PDF"}
                  </Button>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="shadow-sm">
          {error}
        </Alert>
      )}

      {!!reportPayload?.meta?.note && (
        <Alert variant="warning" className="shadow-sm">
          {reportPayload.meta.note}
        </Alert>
      )}

      {loading ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <Spinner animation="border" variant="primary" className="mb-3" />
            <div className="fw-semibold">Loading report...</div>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Row className="g-3 mb-4">
            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">Classes</div>
                  <h4 className="mb-0 fw-bold">{summary.totalClasses}</h4>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">Students</div>
                  <h4 className="mb-0 fw-bold">{summary.totalStudents}</h4>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">Van Fee Entries</div>
                  <h4 className="mb-0 fw-bold">{summary.totalEntries}</h4>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">No Payment Students</div>
                  <h4 className="mb-0 fw-bold text-danger">
                    {summary.noPaymentStudentsCount}
                  </h4>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-3 mb-4">
            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">Total Due</div>
                  <h4 className="mb-0 fw-bold text-dark">
                    {formatAmount(summary.totalDue)}
                  </h4>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">Total Received</div>
                  <h4 className="mb-0 fw-bold text-success">
                    {formatAmount(summary.totalReceived)}
                  </h4>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">Total Concession</div>
                  <h4 className="mb-0 fw-bold text-info">
                    {formatAmount(summary.totalConcession)}
                  </h4>
                </Card.Body>
              </Card>
            </Col>

            <Col md={6} xl={3}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <div className="text-muted small mb-1">Total Pending</div>
                  <h4 className="mb-0 fw-bold text-danger">
                    {formatAmount(summary.totalPending)}
                  </h4>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white border-0 pt-4 px-4 pb-2">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <h5 className="mb-1 fw-bold text-primary">Pending by Head</h5>
                  <div className="text-muted small">
                    Head-wise total due, received, concession and pending amount.
                  </div>
                </div>

                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={handlePendingByHeadExcelDownload}
                  disabled={
                    exportingPendingExcel ||
                    !selectedSession ||
                    filteredHeadSummary.length === 0
                  }
                >
                  {exportingPendingExcel ? "Downloading..." : "Export Pending by Head"}
                </Button>
              </div>
            </Card.Header>

            <Card.Body className="px-4 pb-4 pt-2">
              {filteredHeadSummary.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  No pending-by-head data available.
                </div>
              ) : (
                <div className="table-responsive">
                  <Table bordered hover className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ minWidth: "70px" }}>#</th>
                        <th style={{ minWidth: "220px" }}>Fee Head</th>
                        <th style={{ minWidth: "140px" }}>Students</th>
                        <th style={{ minWidth: "170px" }}>No Payment Students</th>
                        <th style={{ minWidth: "150px" }}>Total Due</th>
                        <th style={{ minWidth: "150px" }}>Received</th>
                        <th style={{ minWidth: "150px" }}>Concession</th>
                        <th style={{ minWidth: "150px" }}>Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHeadSummary.map((row, index) => (
                        <tr key={`${row.feeHeading}-${index}`}>
                          <td className="fw-semibold">{index + 1}</td>
                          <td className="fw-semibold text-dark">{row.feeHeading}</td>
                          <td>{row.studentCount}</td>
                          <td>{row.noPaymentStudentsCount}</td>
                          <td className="fw-semibold">{formatAmount(row.totalDue)}</td>
                          <td className="text-success fw-semibold">
                            {formatAmount(row.totalReceived)}
                          </td>
                          <td className="text-info fw-semibold">
                            {formatAmount(row.totalConcession)}
                          </td>
                          <td className="text-danger fw-semibold">
                            {formatAmount(row.totalPending)}
                          </td>
                        </tr>
                      ))}

                      <tr className="table-light">
                        <td colSpan={4} className="fw-bold">
                          TOTAL
                        </td>
                        <td className="fw-bold">{formatAmount(summary.totalDue)}</td>
                        <td className="fw-bold text-success">
                          {formatAmount(summary.totalReceived)}
                        </td>
                        <td className="fw-bold text-info">
                          {formatAmount(summary.totalConcession)}
                        </td>
                        <td className="fw-bold text-danger">
                          {formatAmount(summary.totalPending)}
                        </td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm mb-4">
            <Card.Header className="bg-white border-0 pt-4 px-4 pb-2">
              <div>
                <h5 className="mb-1 fw-bold text-primary">
                  Students Opted Transport but Paid Nothing
                </h5>
                <div className="text-muted small">
                  Students whose transport is active, but received amount is zero.
                </div>
              </div>
            </Card.Header>

            <Card.Body className="px-4 pb-4 pt-2">
              {filteredNoPaymentStudents.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  No no-payment students found for the selected filters.
                </div>
              ) : (
                <div className="table-responsive">
                  <Table bordered hover className="align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ minWidth: "70px" }}>#</th>
                        <th style={{ minWidth: "160px" }}>Class</th>
                        <th style={{ minWidth: "150px" }}>Admission No</th>
                        <th style={{ minWidth: "260px" }}>Student Name</th>
                        <th style={{ minWidth: "180px" }}>Route</th>
                        <th style={{ minWidth: "140px" }}>Due</th>
                        <th style={{ minWidth: "140px" }}>Received</th>
                        <th style={{ minWidth: "140px" }}>Concession</th>
                        <th style={{ minWidth: "140px" }}>Pending</th>
                        <th style={{ minWidth: "130px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNoPaymentStudents.map((stu, index) => (
                        <tr key={`${stu.studentId || stu.admissionNumber}-${index}`}>
                          <td className="fw-semibold">{index + 1}</td>
                          <td>{stu.className || "—"}</td>
                          <td className="fw-semibold">{stu.admissionNumber || "—"}</td>
                          <td className="fw-semibold text-dark">
                            {stu.studentName || "N/A"}
                          </td>
                          <td>{stu.routeName || "—"}</td>
                          <td className="fw-semibold">
                            {formatAmount(stu.totalVanFeeDue)}
                          </td>
                          <td className="text-success fw-semibold">
                            {formatAmount(stu.totalVanFeePaid)}
                          </td>
                          <td className="text-info fw-semibold">
                            {formatAmount(stu.totalVanFeeConcession)}
                          </td>
                          <td className="text-danger fw-semibold">
                            {formatAmount(stu.totalVanFeePending)}
                          </td>
                          <td>
                            <Badge bg="danger">No Payment</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>

          {filteredReport.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <Card.Body className="text-center py-5 text-muted">
                No report data found for the selected session/class/search.
              </Card.Body>
            </Card>
          ) : (
            filteredReport.map((cls, idx) => {
              const months = Array.isArray(cls?.months) ? cls.months : [];
              const students = Array.isArray(cls?.students) ? cls.students : [];

              const classTotals = students.reduce(
                (acc, stu) => {
                  acc.due += Number(stu?.totalVanFeeDue || 0);
                  acc.received += Number(stu?.totalVanFeePaid || 0);
                  acc.concession += Number(stu?.totalVanFeeConcession || 0);
                  acc.pending += Number(stu?.totalVanFeePending || 0);
                  return acc;
                },
                { due: 0, received: 0, concession: 0, pending: 0 }
              );

              return (
                <Card
                  key={`${cls.classId || cls.className}-${idx}`}
                  className="border-0 shadow-sm mb-4"
                >
                  <Card.Header className="bg-white border-0 pt-4 px-4 pb-2">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                      <div>
                        <h5 className="mb-1 fw-bold text-primary">
                          {cls.className || "Unknown Class"}
                        </h5>
                        <div className="text-muted small">
                          Total Students: {students.length}
                        </div>
                      </div>

                      <div className="d-flex flex-wrap gap-2">
                        <Badge bg="light" text="dark" pill>
                          Due: {formatAmount(classTotals.due)}
                        </Badge>
                        <Badge bg="success" pill>
                          Received: {formatAmount(classTotals.received)}
                        </Badge>
                        <Badge bg="info" pill>
                          Concession: {formatAmount(classTotals.concession)}
                        </Badge>
                        <Badge bg="danger" pill>
                          Pending: {formatAmount(classTotals.pending)}
                        </Badge>
                      </div>
                    </div>
                  </Card.Header>

                  <Card.Body className="px-4 pb-4 pt-2">
                    <div className="table-responsive">
                      <Table bordered hover className="align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ minWidth: "70px" }}>#</th>
                            <th style={{ minWidth: "150px" }}>Admission No</th>
                            <th style={{ minWidth: "240px" }}>Student Name</th>
                            <th style={{ minWidth: "180px" }}>Route</th>
                            {months.map((month, i) => (
                              <th key={i} style={{ minWidth: "140px" }}>
                                {month}
                              </th>
                            ))}
                            <th style={{ minWidth: "140px" }}>Total Due</th>
                            <th style={{ minWidth: "140px" }}>Received</th>
                            <th style={{ minWidth: "140px" }}>Concession</th>
                            <th style={{ minWidth: "140px" }}>Pending</th>
                            <th style={{ minWidth: "130px" }}>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {students.length > 0 ? (
                            <>
                              {students.map((stu, i) => (
                                <tr
                                  key={`${
                                    stu.studentId ||
                                    stu.admissionNumber ||
                                    stu.studentName
                                  }-${i}`}
                                >
                                  <td className="fw-semibold">{i + 1}</td>
                                  <td className="fw-semibold text-dark">
                                    {stu.admissionNumber || "—"}
                                  </td>
                                  <td className="fw-semibold text-dark">
                                    {stu.studentName || "N/A"}
                                  </td>
                                  <td>{stu.routeName || "—"}</td>

                                  {months.map((month, j) => (
                                    <td key={j}>
                                      {formatAmount(stu?.fees?.[month])}
                                    </td>
                                  ))}

                                  <td className="fw-semibold">
                                    {formatAmount(stu?.totalVanFeeDue)}
                                  </td>
                                  <td className="text-success fw-bold">
                                    {formatAmount(stu?.totalVanFeePaid)}
                                  </td>
                                  <td className="text-info fw-semibold">
                                    {formatAmount(stu?.totalVanFeeConcession)}
                                  </td>
                                  <td className="text-danger fw-bold">
                                    {formatAmount(stu?.totalVanFeePending)}
                                  </td>
                                  <td>{getStudentStatusBadge(stu)}</td>
                                </tr>
                              ))}

                              <tr className="table-light">
                                <td className="fw-bold" colSpan={4}>
                                  TOTAL
                                </td>

                                {months.map((month, j) => (
                                  <td key={j} className="fw-bold">
                                    {formatAmount(
                                      students.reduce(
                                        (sum, stu) =>
                                          sum + Number(stu?.fees?.[month] || 0),
                                        0
                                      )
                                    )}
                                  </td>
                                ))}

                                <td className="fw-bold">
                                  {formatAmount(classTotals.due)}
                                </td>
                                <td className="fw-bold text-success">
                                  {formatAmount(classTotals.received)}
                                </td>
                                <td className="fw-bold text-info">
                                  {formatAmount(classTotals.concession)}
                                </td>
                                <td className="fw-bold text-danger">
                                  {formatAmount(classTotals.pending)}
                                </td>
                                <td className="fw-bold">—</td>
                              </tr>
                            </>
                          ) : (
                            <tr>
                              <td
                                colSpan={months.length + 9}
                                className="text-center text-muted py-4"
                              >
                                No students found for this class.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  </Card.Body>
                </Card>
              );
            })
          )}
        </>
      )}
    </Container>
  );
};

export default VanFeeDetailedReport;