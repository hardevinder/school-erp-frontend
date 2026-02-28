import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Form, Button, Table, Modal, Row, Col, Badge, Card } from "react-bootstrap";

/* ---------------- Helpers ---------------- */

const termOptions = [
  { value: "FULL_YEAR", label: "Full Year" },
  { value: "TERM1", label: "Term 1" },
  { value: "TERM2", label: "Term 2" },
];

const statusBadge = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "DRAFT":
      return "secondary";
    case "SUBMITTED":
      return "warning";
    case "APPROVED":
      return "success";
    case "RETURNED":
      return "danger";
    default:
      return "dark";
  }
};

const safeStr = (v) => (v == null ? "" : String(v));
const safeArr = (v) => (Array.isArray(v) ? v : []);

function pickArrayFromApi(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.assignments)) return data.assignments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}

const toUpperStatus = (s) => String(s || "").trim().toUpperCase();

/* ---------------- Component ---------------- */

const SyllabusBreakdownCRUD = () => {
  /* ---------------- State ---------------- */
  const [assignments, setAssignments] = useState([]);
  const [breakdowns, setBreakdowns] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // filters
  const [searchClassId, setSearchClassId] = useState("");
  const [searchSubjectId, setSearchSubjectId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchStatus, setSearchStatus] = useState("");

  // selection panel
  const [selected, setSelected] = useState(null);

  // modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // form (snake_case for UI)
  const [formData, setFormData] = useState({
    academic_session: "",
    class_id: "",
    subject_id: "",
    term: "FULL_YEAR",
    book_ref: "",
    objectives: "",
    items: [],
  });

  /* ---------------- Normalize assignment shapes ---------------- */
  const normalizedAssignments = useMemo(() => {
    return safeArr(assignments).map((a) => {
      const ClassObj = a.class || a.Class || a.ClassObj || a.cls || a?.classObj || null;
      const SubjectObj = a.subject || a.Subject || a.SubjectObj || a?.subjectObj || null;

      const class_id = a.class_id ?? a.classId ?? ClassObj?.id ?? null;
      const subject_id = a.subject_id ?? a.subjectId ?? SubjectObj?.id ?? null;

      return { ...a, ClassObj, SubjectObj, class_id, subject_id };
    });
  }, [assignments]);

  /* ---------------- Derived: unique classes ---------------- */
  const classes = useMemo(() => {
    const map = new Map();
    normalizedAssignments.forEach((a) => {
      const c = a.ClassObj;
      if (c?.id && !map.has(String(c.id))) map.set(String(c.id), c);
    });
    return Array.from(map.values());
  }, [normalizedAssignments]);

  /* ---------------- Subjects for selected class ---------------- */
  const subjectsForSelectedClass = useMemo(() => {
    if (!formData.class_id) return [];
    const map = new Map();
    normalizedAssignments.forEach((a) => {
      if (String(a.class_id) !== String(formData.class_id)) return;
      const s = a.SubjectObj;
      if (s?.id && !map.has(String(s.id))) map.set(String(s.id), s);
    });
    return Array.from(map.values());
  }, [normalizedAssignments, formData.class_id]);

  /* ---------------- Filter subjects ---------------- */
  const subjectsForFilterClass = useMemo(() => {
    const map = new Map();
    normalizedAssignments.forEach((a) => {
      if (searchClassId && String(a.class_id) !== String(searchClassId)) return;
      const s = a.SubjectObj;
      if (s?.id && !map.has(String(s.id))) map.set(String(s.id), s);
    });
    return Array.from(map.values());
  }, [normalizedAssignments, searchClassId]);

  /* ---------------- Filtered breakdowns ---------------- */
  const filteredBreakdowns = useMemo(() => {
    return safeArr(breakdowns).filter((b) => {
      const classId = b.class_id || b.classId || b.Class?.id;
      const subjectId = b.subject_id || b.subjectId || b.Subject?.id;

      const okClass = searchClassId ? String(classId) === String(searchClassId) : true;
      const okSubject = searchSubjectId ? String(subjectId) === String(searchSubjectId) : true;
      const okTerm = searchTerm ? String(b.term) === String(searchTerm) : true;

      const bStatus = toUpperStatus(b.status);
      const okStatus = searchStatus ? bStatus === toUpperStatus(searchStatus) : true;

      return okClass && okSubject && okTerm && okStatus;
    });
  }, [breakdowns, searchClassId, searchSubjectId, searchTerm, searchStatus]);

  /* ---------------- API Calls ---------------- */

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const res = await api.get("/class-subject-syllabus-teachers/teacher/syllabus-assignments");
      setAssignments(pickArrayFromApi(res.data));
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch assigned class-subjects", "error");
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchMyBreakdowns = async () => {
    setLoading(true);
    try {
      const res = await api.get("/syllabus-breakdowns/my");
      setBreakdowns(pickArrayFromApi(res.data));
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch syllabus breakdowns", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ fetch single breakdown with full fields (includes returnReason)
  const fetchOne = async (id) => {
    const res = await api.get(`/syllabus-breakdowns/${id}`);
    return res.data?.data || res.data;
  };

  // ✅ View = fetch full, then setSelected (so returnReason is available)
  const handleView = async (b) => {
    try {
      if (!b?.id) return;
      const full = await fetchOne(b.id);
      setSelected(full);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to load breakdown details", "error");
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchMyBreakdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Form Helpers ---------------- */

  const resetForm = () => {
    setFormData({
      academic_session: "",
      class_id: "",
      subject_id: "",
      term: "FULL_YEAR",
      book_ref: "",
      objectives: "",
      items: [],
    });
    setEditing(false);
    setEditId(null);
  };

  const addItemRow = () => {
    const nextSeq = (formData.items?.length || 0) + 1;
    setFormData((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          seq_no: nextSeq,
          unit_no: "",
          unit_title: "",
          topics: "",
          subtopics: "",
          periods: "",
          planned_from: "",
          planned_to: "",
          planned_month: "",
          remarks: "",
        },
      ],
    }));
  };

  const removeItemRow = (idx) => {
    const items = [...(formData.items || [])];
    items.splice(idx, 1);
    const resequenced = items.map((it, i) => ({ ...it, seq_no: i + 1 }));
    setFormData((prev) => ({ ...prev, items: resequenced }));
  };

  const updateItem = (idx, key, value) => {
    const items = [...(formData.items || [])];
    items[idx] = { ...items[idx], [key]: value };
    setFormData((prev) => ({ ...prev, items }));
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;

    if (name === "class_id") {
      const nextClassId = value;
      const allowedSubjects = normalizedAssignments
        .filter((a) => String(a.class_id) === String(nextClassId))
        .map((a) => a.SubjectObj)
        .filter((s) => s?.id);

      const unique = new Map();
      allowedSubjects.forEach((s) => unique.set(String(s.id), s));
      const subjectList = Array.from(unique.values());

      setFormData((prev) => ({
        ...prev,
        class_id: nextClassId,
        subject_id: subjectList.length === 1 ? String(subjectList[0].id) : "",
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    resetForm();

    if (selected?.class_id && selected?.subject_id) {
      setFormData((prev) => ({
        ...prev,
        class_id: String(selected.class_id),
        subject_id: String(selected.subject_id),
      }));
    }

    setTimeout(() => {
      setFormData((prev) => {
        if (prev.items?.length) return prev;
        return {
          ...prev,
          items: [
            {
              seq_no: 1,
              unit_no: "",
              unit_title: "",
              topics: "",
              subtopics: "",
              periods: "",
              planned_from: "",
              planned_to: "",
              planned_month: "",
              remarks: "",
            },
          ],
        };
      });
    }, 0);

    setShowModal(true);
  };

  const openEditModal = async (row) => {
    try {
      setEditing(true);
      setEditId(row.id);

      const res = await api.get(`/syllabus-breakdowns/${row.id}`);
      const b = res.data?.data || res.data;

      // ✅ backend may return Items[] with camelCase keys
      const rawItems = b.Items || b.items || b.SyllabusBreakdownItems || b.syllabus_breakdown_items || [];

      const items = safeArr(rawItems).map((it, idx) => ({
        id: it.id,
        seq_no: it.seq_no ?? it.sequence ?? idx + 1,
        unit_no: safeStr(it.unit_no ?? it.unitNumber),
        unit_title: safeStr(it.unit_title ?? it.unitTitle),
        topics: safeStr(it.topics),
        subtopics: safeStr(it.subtopics),
        periods: it.periods ?? "",
        planned_from: it.planned_from
          ? String(it.planned_from).slice(0, 10)
          : it.plannedFrom
          ? String(it.plannedFrom).slice(0, 10)
          : "",
        planned_to: it.planned_to
          ? String(it.planned_to).slice(0, 10)
          : it.plannedTo
          ? String(it.plannedTo).slice(0, 10)
          : "",
        planned_month: safeStr(it.planned_month ?? it.plannedMonth),
        remarks: safeStr(it.remarks),
      }));

      setFormData({
        academic_session: safeStr(b.academic_session ?? b.academicSession),
        class_id: String(b.class_id ?? b.classId ?? ""),
        subject_id: String(b.subject_id ?? b.subjectId ?? ""),
        term: b.term || "FULL_YEAR",
        book_ref: safeStr(b.book_ref ?? b.bookReference),
        objectives: safeStr(b.objectives),
        items: items.length ? items : [],
      });

      if (!items.length) addItemRow();
      setShowModal(true);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to load breakdown details", "error");
    }
  };

  /* ---------------- Submit / Save ---------------- */

  const validateForm = () => {
    if (!formData.class_id) return "Please select Class";
    if (!formData.subject_id) return "Please select Subject";
    if (!formData.term) return "Please select Term";

    const allowed = normalizedAssignments.some(
      (a) => String(a.class_id) === String(formData.class_id) && String(a.subject_id) === String(formData.subject_id)
    );
    if (!allowed) return "This Class/Subject is not assigned to you. Please select only assigned subjects.";

    if (!formData.items || formData.items.length === 0) return "Please add at least 1 unit row";
    const hasEmptyTitle = formData.items.some((it) => !String(it.unit_title || "").trim());
    if (hasEmptyTitle) return "Unit Title is required in all rows";
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errMsg = validateForm();
    if (errMsg) return Swal.fire("Error", errMsg, "error");

    try {
      // ✅ SEND CAMELCASE FOR BACKEND CONTROLLER
      const payload = {
        classId: Number(formData.class_id),
        subjectId: Number(formData.subject_id),
        academicSession: safeStr(formData.academic_session) || null,
        term: formData.term || "FULL_YEAR",
        bookReference: safeStr(formData.book_ref) || null,
        objectives: safeStr(formData.objectives) || null,
        items: (formData.items || []).map((it, idx) => ({
          id: it.id,
          sequence: idx + 1,
          unitNumber: it.unit_no || null,
          unitTitle: it.unit_title,
          topics: it.topics || null,
          subtopics: it.subtopics || null,
          periods: it.periods === "" ? null : Number(it.periods),
          plannedFrom: it.planned_from || null,
          plannedTo: it.planned_to || null,
          plannedMonth: it.planned_month || null,
          remarks: it.remarks || null,
        })),
      };

      await api.post("/syllabus-breakdowns", payload);

      Swal.fire("Success", editing ? "Breakdown updated" : "Breakdown created", "success");
      setShowModal(false);
      resetForm();
      fetchMyBreakdowns();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to save breakdown", "error");
    }
  };

  const handleSubmitForApproval = async (id) => {
    const ok = await Swal.fire({
      title: "Submit for Approval?",
      text: "After submission, you should not edit unless returned.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Submit",
    });
    if (!ok.isConfirmed) return;

    try {
      await api.post(`/syllabus-breakdowns/${id}/submit`);
      Swal.fire("Submitted", "Breakdown submitted successfully", "success");
      fetchMyBreakdowns();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Submit failed", "error");
    }
  };

  const handleDownloadPdf = async (id) => {
    try {
      const res = await api.get(`/syllabus-breakdowns/${id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `syllabus_breakdown_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to download PDF", "error");
    }
  };

  /* ---------------- UI helpers ---------------- */

  const getClassName = (b) => {
    const id = b.class_id ?? b.classId ?? b.Class?.id;
    return b.Class?.class_name || b.class_name || classes.find((c) => String(c.id) === String(id))?.class_name || "—";
  };

  const getSubjectName = (b) => {
    const id = b.subject_id ?? b.subjectId ?? b.Subject?.id;

    const allSubjects = (() => {
      const map = new Map();
      normalizedAssignments.forEach((a) => {
        const s = a.SubjectObj;
        if (s?.id) map.set(String(s.id), s);
      });
      return Array.from(map.values());
    })();

    return (
      b.Subject?.subject_name ||
      b.Subject?.name ||
      b.subject_name ||
      allSubjects.find((s) => String(s.id) === String(id))?.name ||
      "—"
    );
  };

  const isLocked = (status) => {
    const s = toUpperStatus(status);
    return s === "SUBMITTED" || s === "APPROVED";
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="container-fluid py-3">
      <style>{`
        .sb-wrap { max-width: 100%; overflow-x: hidden; }
        .sb-title { word-break: break-word; }
        .sb-card-row .form-label { font-size: .8rem; color: #6c757d; margin-bottom: .25rem; }
        .sb-sticky-actions { position: sticky; bottom: 0; background: #fff; padding-top: .75rem; }
        @media (max-width: 576px) {
          .modal-fullscreen-sm-down .modal-dialog { margin: 0; }
        }
      `}</style>

      <div className="sb-wrap">
        <Row className="align-items-center g-2">
          <Col xs={12} md={8}>
            <h3 className="mb-0 sb-title">📘 Syllabus Breakdown</h3>
            <div className="text-muted small">Create unit-wise syllabus plan and download PDF for hard-copy.</div>

            {loadingAssignments && (
              <div className="small text-muted mt-1">
                <span className="spinner-border spinner-border-sm me-2" />
                Loading assigned subjects…
              </div>
            )}
          </Col>

          <Col xs={12} md={4}>
            <div className="d-grid d-md-flex justify-content-md-end">
              <Button variant="primary" onClick={openCreateModal}>
                + Create Breakdown
              </Button>
            </div>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mt-3 shadow-sm">
          <Card.Body>
            <Row className="g-2">
              <Col xs={12} sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Class</Form.Label>
                <Form.Select
                  value={searchClassId}
                  onChange={(e) => {
                    setSearchClassId(e.target.value);
                    setSearchSubjectId("");
                  }}
                >
                  <option value="">All</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Subject</Form.Label>
                <Form.Select
                  value={searchSubjectId}
                  onChange={(e) => setSearchSubjectId(e.target.value)}
                  disabled={!!searchClassId && subjectsForFilterClass.length === 0}
                >
                  <option value="">All</option>
                  {subjectsForFilterClass.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Term</Form.Label>
                <Form.Select value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}>
                  <option value="">All</option>
                  {termOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Status</Form.Label>
                <Form.Select value={searchStatus} onChange={(e) => setSearchStatus(e.target.value)}>
                  <option value="">All</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="SUBMITTED">SUBMITTED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="RETURNED">RETURNED</option>
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Row className="mt-3 g-3">
          {/* Left: List */}
          <Col xs={12} lg={8}>
            <Card className="shadow-sm">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <div className="fw-semibold">My Breakdowns</div>
                <div className="small text-muted">{loading ? "Loading..." : `${filteredBreakdowns.length} items`}</div>
              </Card.Header>

              {/* Desktop table */}
              <div className="d-none d-lg-block table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>Class</th>
                      <th>Subject</th>
                      <th>Term</th>
                      <th>Status</th>
                      <th style={{ width: 280 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBreakdowns.map((b) => (
                      <tr key={b.id}>
                        <td>{b.id}</td>
                        <td>{getClassName(b)}</td>
                        <td>{getSubjectName(b)}</td>
                        <td>{termOptions.find((t) => t.value === b.term)?.label || b.term}</td>
                        <td>
                          <Badge bg={statusBadge(toUpperStatus(b.status))}>{toUpperStatus(b.status)}</Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline-info" onClick={() => handleView(b)}>
                              View
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openEditModal(b)}
                              disabled={isLocked(b.status)}
                            >
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => handleSubmitForApproval(b.id)}
                              disabled={toUpperStatus(b.status) !== "DRAFT" && toUpperStatus(b.status) !== "RETURNED"}
                            >
                              Submit
                            </Button>

                            <Button size="sm" variant="success" onClick={() => handleDownloadPdf(b.id)}>
                              PDF
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!loading && filteredBreakdowns.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No breakdowns found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="d-lg-none">
                <Card.Body className="d-flex flex-column gap-2">
                  {filteredBreakdowns.map((b) => (
                    <Card
                      key={b.id}
                      className={`shadow-sm ${selected?.id === b.id ? "border-primary" : ""}`}
                      role="button"
                      onClick={() => handleView(b)}
                    >
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">
                              #{b.id} • {getClassName(b)}
                            </div>
                            <div className="text-muted small">{getSubjectName(b)}</div>
                            <div className="small mt-1">
                              <span className="text-muted">Term: </span>
                              {termOptions.find((t) => t.value === b.term)?.label || b.term}
                            </div>
                          </div>
                          <Badge bg={statusBadge(toUpperStatus(b.status))}>{toUpperStatus(b.status)}</Badge>
                        </div>

                        <div className="d-flex gap-2 flex-wrap mt-3">
                          <Button
                            size="sm"
                            variant="outline-info"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(b);
                            }}
                          >
                            View
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(b);
                            }}
                            disabled={isLocked(b.status)}
                          >
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubmitForApproval(b.id);
                            }}
                            disabled={toUpperStatus(b.status) !== "DRAFT" && toUpperStatus(b.status) !== "RETURNED"}
                          >
                            Submit
                          </Button>

                          <Button
                            size="sm"
                            variant="success"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(b.id);
                            }}
                          >
                            PDF
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}

                  {!loading && filteredBreakdowns.length === 0 && (
                    <div className="text-center text-muted py-4">No breakdowns found.</div>
                  )}
                </Card.Body>
              </div>
            </Card>
          </Col>

          {/* Right: Detail Panel */}
          <Col xs={12} lg={4}>
            <Card className="shadow-sm">
              <Card.Header className="fw-semibold">Details</Card.Header>
              <Card.Body>
                {selected ? (
                  <>
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="fw-semibold">Breakdown #{selected.id}</div>
                      <Badge bg={statusBadge(toUpperStatus(selected.status))}>{toUpperStatus(selected.status)}</Badge>
                    </div>

                    <hr />

                    <div className="mb-2">
                      <div className="small text-muted">Class</div>
                      <div className="fw-semibold">{getClassName(selected)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Subject</div>
                      <div className="fw-semibold">{getSubjectName(selected)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Term</div>
                      <div>{termOptions.find((t) => t.value === selected.term)?.label || selected.term}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Academic Session</div>
                      <div>{selected.academic_session || selected.academicSession || "—"}</div>
                    </div>

                    {/* ✅ SHOW RETURN REASON TO TEACHER */}
                    {toUpperStatus(selected.status) === "RETURNED" && (
                      <div className="mt-3 p-2 border rounded bg-light">
                        <div className="small text-muted mb-1">Return Reason (Coordinator)</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {selected.returnReason || selected.return_reason || "—"}
                        </div>
                      </div>
                    )}

                    <div className="d-grid gap-2 mt-3">
                      <Button variant="success" onClick={() => handleDownloadPdf(selected.id)}>
                        Download PDF
                      </Button>

                      <Button
                        variant="warning"
                        onClick={() => handleSubmitForApproval(selected.id)}
                        disabled={
                          toUpperStatus(selected.status) !== "DRAFT" &&
                          toUpperStatus(selected.status) !== "RETURNED"
                        }
                      >
                        Submit for Approval
                      </Button>

                      <Button variant="outline-primary" onClick={() => openEditModal(selected)} disabled={isLocked(selected.status)}>
                        Edit
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-muted">Select an item to view details.</div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Modal: Create/Edit */}
        <Modal
          show={showModal}
          onHide={() => setShowModal(false)}
          size="xl"
          centered
          fullscreen="sm-down"
          dialogClassName="modal-fullscreen-sm-down"
        >
          <Modal.Header closeButton>
            <Modal.Title>{editing ? "Edit Syllabus Breakdown" : "Create Syllabus Breakdown"}</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <Form onSubmit={handleSave}>
              <Row className="g-2">
                <Col xs={12} md={3}>
                  <Form.Label>Academic Session</Form.Label>
                  <Form.Control
                    name="academic_session"
                    value={formData.academic_session}
                    onChange={handleHeaderChange}
                    placeholder="2025-26"
                  />
                </Col>

                <Col xs={12} md={3}>
                  <Form.Label>Class</Form.Label>
                  <Form.Select name="class_id" value={formData.class_id} onChange={handleHeaderChange} required>
                    <option value="">-- Select --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
                  </Form.Select>
                  <div className="small text-muted mt-1">Showing only assigned classes.</div>
                </Col>

                <Col xs={12} md={3}>
                  <Form.Label>Subject</Form.Label>
                  <Form.Select
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleHeaderChange}
                    required
                    disabled={!formData.class_id}
                  >
                    <option value="">{!formData.class_id ? "Select Class first" : "-- Select --"}</option>
                    {subjectsForSelectedClass.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Form.Select>
                  <div className="small text-muted mt-1">Subjects auto-filtered by selected class.</div>
                </Col>

                <Col xs={12} md={3}>
                  <Form.Label>Term</Form.Label>
                  <Form.Select name="term" value={formData.term} onChange={handleHeaderChange}>
                    {termOptions.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              <Row className="g-2 mt-2">
                <Col xs={12} md={6}>
                  <Form.Label>Book Reference</Form.Label>
                  <Form.Control
                    name="book_ref"
                    value={formData.book_ref}
                    onChange={handleHeaderChange}
                    placeholder="Book / Publisher / Edition"
                  />
                </Col>

                <Col xs={12} md={6}>
                  <Form.Label>Objectives</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    name="objectives"
                    value={formData.objectives}
                    onChange={handleHeaderChange}
                    placeholder="Overall objectives for the syllabus..."
                  />
                </Col>
              </Row>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="fw-semibold">Units / Chapters</div>
                <Button variant="outline-primary" onClick={addItemRow} type="button">
                  + Add Row
                </Button>
              </div>

              {/* Desktop table */}
              <div className="d-none d-lg-block table-responsive mt-2">
                <Table bordered hover className="align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 60 }}>#</th>
                      <th style={{ minWidth: 120 }}>Unit No</th>
                      <th style={{ minWidth: 220 }}>Unit Title *</th>
                      <th style={{ minWidth: 240 }}>Topics</th>
                      <th style={{ minWidth: 240 }}>Subtopics</th>
                      <th style={{ width: 120 }}>Periods</th>
                      <th style={{ minWidth: 160 }}>From</th>
                      <th style={{ minWidth: 160 }}>To</th>
                      <th style={{ minWidth: 160 }}>Month</th>
                      <th style={{ minWidth: 180 }}>Remarks</th>
                      <th style={{ width: 90 }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="text-center">{idx + 1}</td>

                        <td>
                          <Form.Control value={it.unit_no} onChange={(e) => updateItem(idx, "unit_no", e.target.value)} placeholder="1 / I" />
                        </td>

                        <td>
                          <Form.Control
                            value={it.unit_title}
                            onChange={(e) => updateItem(idx, "unit_title", e.target.value)}
                            placeholder="Chapter / Unit title"
                            required
                          />
                        </td>

                        <td>
                          <Form.Control as="textarea" rows={2} value={it.topics} onChange={(e) => updateItem(idx, "topics", e.target.value)} placeholder="Topics..." />
                        </td>

                        <td>
                          <Form.Control as="textarea" rows={2} value={it.subtopics} onChange={(e) => updateItem(idx, "subtopics", e.target.value)} placeholder="Subtopics..." />
                        </td>

                        <td>
                          <Form.Control type="number" value={it.periods} onChange={(e) => updateItem(idx, "periods", e.target.value)} placeholder="e.g. 8" />
                        </td>

                        <td>
                          <Form.Control type="date" value={it.planned_from} onChange={(e) => updateItem(idx, "planned_from", e.target.value)} />
                        </td>

                        <td>
                          <Form.Control type="date" value={it.planned_to} onChange={(e) => updateItem(idx, "planned_to", e.target.value)} />
                        </td>

                        <td>
                          <Form.Control value={it.planned_month} onChange={(e) => updateItem(idx, "planned_month", e.target.value)} placeholder="April / Q1" />
                        </td>

                        <td>
                          <Form.Control value={it.remarks} onChange={(e) => updateItem(idx, "remarks", e.target.value)} placeholder="Notes..." />
                        </td>

                        <td className="text-center">
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeItemRow(idx)}
                            disabled={(formData.items || []).length === 1}
                            type="button"
                          >
                            ✕
                          </Button>
                        </td>
                      </tr>
                    ))}

                    {(formData.items || []).length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center text-muted py-3">
                          No rows. Click “Add Row”.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="d-lg-none mt-2 d-flex flex-column gap-2">
                {(formData.items || []).map((it, idx) => (
                  <Card key={idx} className="shadow-sm">
                    <Card.Body className="sb-card-row">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="fw-semibold">Unit #{idx + 1}</div>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeItemRow(idx)}
                          disabled={(formData.items || []).length === 1}
                          type="button"
                        >
                          Remove
                        </Button>
                      </div>

                      <Row className="g-2">
                        <Col xs={12} sm={4}>
                          <Form.Label>Unit No</Form.Label>
                          <Form.Control value={it.unit_no} onChange={(e) => updateItem(idx, "unit_no", e.target.value)} placeholder="1 / I" />
                        </Col>

                        <Col xs={12} sm={8}>
                          <Form.Label>Unit Title *</Form.Label>
                          <Form.Control value={it.unit_title} onChange={(e) => updateItem(idx, "unit_title", e.target.value)} placeholder="Chapter / Unit title" required />
                        </Col>

                        <Col xs={12}>
                          <Form.Label>Topics</Form.Label>
                          <Form.Control as="textarea" rows={2} value={it.topics} onChange={(e) => updateItem(idx, "topics", e.target.value)} placeholder="Topics..." />
                        </Col>

                        <Col xs={12}>
                          <Form.Label>Subtopics</Form.Label>
                          <Form.Control as="textarea" rows={2} value={it.subtopics} onChange={(e) => updateItem(idx, "subtopics", e.target.value)} placeholder="Subtopics..." />
                        </Col>

                        <Col xs={12} sm={4}>
                          <Form.Label>Periods</Form.Label>
                          <Form.Control type="number" value={it.periods} onChange={(e) => updateItem(idx, "periods", e.target.value)} placeholder="e.g. 8" />
                        </Col>

                        <Col xs={12} sm={4}>
                          <Form.Label>From</Form.Label>
                          <Form.Control type="date" value={it.planned_from} onChange={(e) => updateItem(idx, "planned_from", e.target.value)} />
                        </Col>

                        <Col xs={12} sm={4}>
                          <Form.Label>To</Form.Label>
                          <Form.Control type="date" value={it.planned_to} onChange={(e) => updateItem(idx, "planned_to", e.target.value)} />
                        </Col>

                        <Col xs={12} sm={6}>
                          <Form.Label>Month</Form.Label>
                          <Form.Control value={it.planned_month} onChange={(e) => updateItem(idx, "planned_month", e.target.value)} placeholder="April / Q1" />
                        </Col>

                        <Col xs={12} sm={6}>
                          <Form.Label>Remarks</Form.Label>
                          <Form.Control value={it.remarks} onChange={(e) => updateItem(idx, "remarks", e.target.value)} placeholder="Notes..." />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}
              </div>

              <div className="sb-sticky-actions">
                <div className="d-grid d-sm-flex gap-2 justify-content-end mt-3">
                  <Button variant="secondary" onClick={() => setShowModal(false)} type="button">
                    Close
                  </Button>
                  <Button variant="primary" type="submit">
                    {editing ? "Update" : "Save"}
                  </Button>
                </div>
              </div>
            </Form>
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
};

export default SyllabusBreakdownCRUD;