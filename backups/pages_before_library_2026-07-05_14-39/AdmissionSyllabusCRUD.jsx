import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Form, Button, Table, Modal, Row, Col, Badge, Card } from "react-bootstrap";

/* ---------------- Helpers ---------------- */

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
    case "ARCHIVED":
      return "dark";
    default:
      return "dark";
  }
};

const difficultyOptions = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

const safeStr = (v) => (v == null ? "" : String(v));
const safeArr = (v) => (Array.isArray(v) ? v : []);

function pickArrayFromApi(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.assignments)) return data.assignments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.subjects)) return data.subjects; // ✅ fixed
  if (Array.isArray(data?.classes)) return data.classes;   // ✅ useful
  return [];
}

const toUpperStatus = (s) => String(s || "").trim().toUpperCase();

/* ---------------- Component ---------------- */

const AdmissionSyllabusCRUD = () => {
  /* ---------------- State ---------------- */
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [syllabuses, setSyllabuses] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // filters
  const [searchClassId, setSearchClassId] = useState("");
  const [searchSubjectId, setSearchSubjectId] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [searchAcademicSession, setSearchAcademicSession] = useState("");

  // selection panel
  const [selected, setSelected] = useState(null);

  // modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // form
  const [formData, setFormData] = useState({
    school_id: "",
    academic_session: "",
    applying_class_id: "",
    base_class_id: "",
    subject_id: "",
    title: "",
    description: "",
    items: [],
  });

  /* ---------------- Derived ---------------- */

  const filteredSyllabuses = useMemo(() => {
    return safeArr(syllabuses).filter((s) => {
      const classId = s.applyingClassId || s.applying_class_id || s.ApplyingClass?.id;
      const subjectId = s.subjectId || s.subject_id || s.Subject?.id;

      const okClass = searchClassId ? String(classId) === String(searchClassId) : true;
      const okSubject = searchSubjectId ? String(subjectId) === String(searchSubjectId) : true;
      const okStatus = searchStatus ? toUpperStatus(s.status) === toUpperStatus(searchStatus) : true;
      const okSession = searchAcademicSession
        ? safeStr(s.academicSession || s.academic_session) === safeStr(searchAcademicSession)
        : true;

      return okClass && okSubject && okStatus && okSession;
    });
  }, [syllabuses, searchClassId, searchSubjectId, searchStatus, searchAcademicSession]);

  const subjectsForSelectedClass = useMemo(() => {
    return subjects;
  }, [subjects]);

  /* ---------------- API Calls ---------------- */

  const fetchClasses = async () => {
    try {
      const res = await api.get("/classes");
      setClasses(pickArrayFromApi(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await api.get("/subjects");
      setSubjects(pickArrayFromApi(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMasters = async () => {
    setLoadingMasters(true);
    try {
      await Promise.all([fetchClasses(), fetchSubjects()]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMasters(false);
    }
  };

  const fetchMySyllabuses = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchAcademicSession) params.academicSession = searchAcademicSession;
      if (searchClassId) params.applyingClassId = searchClassId;
      if (searchSubjectId) params.subjectId = searchSubjectId;
      if (searchStatus) params.status = searchStatus;

      const res = await api.get("/admission-syllabus", { params });
      setSyllabuses(pickArrayFromApi(res.data));
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to fetch admission syllabuses", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchOne = async (id) => {
    const res = await api.get(`/admission-syllabus/${id}`);
    return res.data?.data || res.data;
  };

  const handleView = async (row) => {
    try {
      if (!row?.id) return;
      const full = await fetchOne(row.id);
      setSelected(full);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to load details", "error");
    }
  };

  useEffect(() => {
    fetchMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchMySyllabuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchAcademicSession, searchClassId, searchSubjectId, searchStatus]);

  /* ---------------- Form Helpers ---------------- */

  const resetForm = () => {
    setFormData({
      school_id: "",
      academic_session: "",
      applying_class_id: "",
      base_class_id: "",
      subject_id: "",
      title: "",
      description: "",
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
          topic: "",
          subtopic: "",
          difficulty: "MEDIUM",
          weightage: "",
          remarks: "",
          is_active: true,
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
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    resetForm();

    if (selected?.applyingClassId || selected?.applying_class_id) {
      setFormData((prev) => ({
        ...prev,
        applying_class_id: String(selected?.applyingClassId || selected?.applying_class_id || ""),
        subject_id: String(selected?.subjectId || selected?.subject_id || ""),
        academic_session: safeStr(selected?.academicSession || selected?.academic_session),
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
              topic: "",
              subtopic: "",
              difficulty: "MEDIUM",
              weightage: "",
              remarks: "",
              is_active: true,
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

      const full = await fetchOne(row.id);
      const rawItems = full.Items || full.items || [];

      const items = safeArr(rawItems).map((it, idx) => ({
        id: it.id,
        seq_no: it.seq_no ?? it.sequence ?? idx + 1,
        topic: safeStr(it.topic),
        subtopic: safeStr(it.subtopic),
        difficulty: safeStr(it.difficulty || "MEDIUM").toUpperCase(),
        weightage: it.weightage ?? "",
        remarks: safeStr(it.remarks),
        is_active: typeof it.is_active !== "undefined" ? !!it.is_active : !!it.isActive,
      }));

      setFormData({
        school_id: String(full.schoolId ?? full.school_id ?? ""),
        academic_session: safeStr(full.academicSession ?? full.academic_session),
        applying_class_id: String(full.applyingClassId ?? full.applying_class_id ?? ""),
        base_class_id: String(full.baseClassId ?? full.base_class_id ?? ""),
        subject_id: String(full.subjectId ?? full.subject_id ?? ""),
        title: safeStr(full.title),
        description: safeStr(full.description),
        items: items.length ? items : [],
      });

      if (!items.length) addItemRow();
      setShowModal(true);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to load syllabus details", "error");
    }
  };

  /* ---------------- Submit / Save ---------------- */

  const validateForm = () => {
    if (!formData.applying_class_id) return "Please select Applying Class";
    if (!formData.subject_id) return "Please select Subject";
    if (!formData.items || formData.items.length === 0) return "Please add at least 1 topic row";

    const hasEmptyTopic = formData.items.some((it) => !safeStr(it.topic));
    if (hasEmptyTopic) return "Topic is required in all rows";

    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const errMsg = validateForm();
    if (errMsg) return Swal.fire("Error", errMsg, "error");

    try {
      const payload = {
        schoolId: formData.school_id ? Number(formData.school_id) : null,
        academicSession: safeStr(formData.academic_session) || null,
        applyingClassId: Number(formData.applying_class_id),
        baseClassId: formData.base_class_id ? Number(formData.base_class_id) : null,
        subjectId: Number(formData.subject_id),
        title: safeStr(formData.title) || null,
        description: safeStr(formData.description) || null,
        items: (formData.items || []).map((it, idx) => ({
          id: it.id,
          sequence: idx + 1,
          topic: safeStr(it.topic),
          subtopic: safeStr(it.subtopic) || null,
          difficulty: safeStr(it.difficulty || "MEDIUM").toUpperCase(),
          weightage: it.weightage === "" ? null : Number(it.weightage),
          remarks: safeStr(it.remarks) || null,
          isActive: !!it.is_active,
        })),
      };

      await api.post("/admission-syllabus", payload);

      Swal.fire("Success", editing ? "Admission syllabus updated" : "Admission syllabus created", "success");
      setShowModal(false);
      resetForm();
      fetchMySyllabuses();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Failed to save admission syllabus", "error");
    }
  };

  const handleSubmitForApproval = async (id) => {
    const ok = await Swal.fire({
      title: "Submit for Approval?",
      text: "After submission, editing will be restricted unless returned.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, Submit",
    });

    if (!ok.isConfirmed) return;

    try {
      await api.post(`/admission-syllabus/${id}/submit`);
      Swal.fire("Submitted", "Admission syllabus submitted successfully", "success");
      fetchMySyllabuses();

      if (selected?.id === id) {
        const full = await fetchOne(id);
        setSelected(full);
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Submit failed", "error");
    }
  };

  /* ---------------- UI helpers ---------------- */

  const getClassName = (row) => {
    const id = row.applyingClassId || row.applying_class_id || row.ApplyingClass?.id;
    return (
      row.ApplyingClass?.class_name ||
      row.class_name ||
      classes.find((c) => String(c.id) === String(id))?.class_name ||
      "—"
    );
  };

  const getBaseClassName = (row) => {
    const id = row.baseClassId || row.base_class_id || row.BaseClass?.id;
    return (
      row.BaseClass?.class_name ||
      classes.find((c) => String(c.id) === String(id))?.class_name ||
      "—"
    );
  };

  const getSubjectName = (row) => {
    const id = row.subjectId || row.subject_id || row.Subject?.id;
    return (
      row.Subject?.subject_name ||
      row.Subject?.name ||
      row.subject_name ||
      subjects.find((s) => String(s.id) === String(id))?.name ||
      subjects.find((s) => String(s.id) === String(id))?.subject_name ||
      "—"
    );
  };

  const isLocked = (status) => {
    const s = toUpperStatus(status);
    return s === "SUBMITTED" || s === "APPROVED" || s === "ARCHIVED";
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="container-fluid py-3">
      <style>{`
        .as-wrap { max-width: 100%; overflow-x: hidden; }
        .as-title { word-break: break-word; }
        .as-card-row .form-label { font-size: .8rem; color: #6c757d; margin-bottom: .25rem; }
        .as-sticky-actions { position: sticky; bottom: 0; background: #fff; padding-top: .75rem; z-index: 2; }
        @media (max-width: 576px) {
          .modal-fullscreen-sm-down .modal-dialog { margin: 0; }
        }
      `}</style>

      <div className="as-wrap">
        <Row className="align-items-center g-2">
          <Col xs={12} md={8}>
            <h3 className="mb-0 as-title">📝 Admission Syllabus</h3>
            <div className="text-muted small">
              Create topic-wise admission syllabus for entrance / admission test preparation.
            </div>

            {loadingMasters && (
              <div className="small text-muted mt-1">
                <span className="spinner-border spinner-border-sm me-2" />
                Loading classes and subjects…
              </div>
            )}
          </Col>

          <Col xs={12} md={4}>
            <div className="d-grid d-md-flex justify-content-md-end">
              <Button variant="primary" onClick={openCreateModal}>
                + Create Admission Syllabus
              </Button>
            </div>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mt-3 shadow-sm">
          <Card.Body>
            <Row className="g-2">
              <Col xs={12} sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Academic Session</Form.Label>
                <Form.Control
                  value={searchAcademicSession}
                  onChange={(e) => setSearchAcademicSession(e.target.value)}
                  placeholder="2025-26"
                />
              </Col>

              <Col xs={12} sm={6} lg={3}>
                <Form.Label className="small text-muted mb-1">Applying Class</Form.Label>
                <Form.Select value={searchClassId} onChange={(e) => setSearchClassId(e.target.value)}>
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
                <Form.Select value={searchSubjectId} onChange={(e) => setSearchSubjectId(e.target.value)}>
                  <option value="">All</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.subject_name}
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
                  <option value="ARCHIVED">ARCHIVED</option>
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
                <div className="fw-semibold">My Admission Syllabuses</div>
                <div className="small text-muted">
                  {loading ? "Loading..." : `${filteredSyllabuses.length} items`}
                </div>
              </Card.Header>

              {/* Desktop table */}
              <div className="d-none d-lg-block table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>Applying Class</th>
                      <th>Subject</th>
                      <th>Academic Session</th>
                      <th>Status</th>
                      <th style={{ width: 280 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSyllabuses.map((s) => (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>{getClassName(s)}</td>
                        <td>{getSubjectName(s)}</td>
                        <td>{s.academicSession || s.academic_session || "—"}</td>
                        <td>
                          <Badge bg={statusBadge(toUpperStatus(s.status))}>{toUpperStatus(s.status)}</Badge>
                        </td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            <Button size="sm" variant="outline-info" onClick={() => handleView(s)}>
                              View
                            </Button>

                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => openEditModal(s)}
                              disabled={isLocked(s.status)}
                            >
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => handleSubmitForApproval(s.id)}
                              disabled={
                                toUpperStatus(s.status) !== "DRAFT" &&
                                toUpperStatus(s.status) !== "RETURNED"
                              }
                            >
                              Submit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {!loading && filteredSyllabuses.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No admission syllabus found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="d-lg-none">
                <Card.Body className="d-flex flex-column gap-2">
                  {filteredSyllabuses.map((s) => (
                    <Card
                      key={s.id}
                      className={`shadow-sm ${selected?.id === s.id ? "border-primary" : ""}`}
                      role="button"
                      onClick={() => handleView(s)}
                    >
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">
                              #{s.id} • {getClassName(s)}
                            </div>
                            <div className="text-muted small">{getSubjectName(s)}</div>
                            <div className="small mt-1">
                              <span className="text-muted">Session: </span>
                              {s.academicSession || s.academic_session || "—"}
                            </div>
                          </div>
                          <Badge bg={statusBadge(toUpperStatus(s.status))}>{toUpperStatus(s.status)}</Badge>
                        </div>

                        <div className="d-flex gap-2 flex-wrap mt-3">
                          <Button
                            size="sm"
                            variant="outline-info"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleView(s);
                            }}
                          >
                            View
                          </Button>

                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(s);
                            }}
                            disabled={isLocked(s.status)}
                          >
                            Edit
                          </Button>

                          <Button
                            size="sm"
                            variant="warning"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSubmitForApproval(s.id);
                            }}
                            disabled={
                              toUpperStatus(s.status) !== "DRAFT" &&
                              toUpperStatus(s.status) !== "RETURNED"
                            }
                          >
                            Submit
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  ))}

                  {!loading && filteredSyllabuses.length === 0 && (
                    <div className="text-center text-muted py-4">No admission syllabus found.</div>
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
                      <div className="fw-semibold">Syllabus #{selected.id}</div>
                      <Badge bg={statusBadge(toUpperStatus(selected.status))}>
                        {toUpperStatus(selected.status)}
                      </Badge>
                    </div>

                    <hr />

                    <div className="mb-2">
                      <div className="small text-muted">Applying Class</div>
                      <div className="fw-semibold">{getClassName(selected)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Base Class</div>
                      <div>{getBaseClassName(selected)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Subject</div>
                      <div className="fw-semibold">{getSubjectName(selected)}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Academic Session</div>
                      <div>{selected.academicSession || selected.academic_session || "—"}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Title</div>
                      <div>{selected.title || "—"}</div>
                    </div>

                    <div className="mb-2">
                      <div className="small text-muted">Description</div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{selected.description || "—"}</div>
                    </div>

                    {toUpperStatus(selected.status) === "RETURNED" && (
                      <div className="mt-3 p-2 border rounded bg-light">
                        <div className="small text-muted mb-1">Return Reason (Coordinator/Admin)</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {selected.returnReason || selected.return_reason || "—"}
                        </div>
                      </div>
                    )}

                    <div className="mt-3">
                      <div className="fw-semibold mb-2">Items</div>
                      {safeArr(selected.items || selected.Items).length > 0 ? (
                        <div className="border rounded">
                          <div className="list-group list-group-flush">
                            {safeArr(selected.items || selected.Items).map((it, idx) => (
                              <div key={it.id || idx} className="list-group-item">
                                <div className="fw-semibold">
                                  #{it.seq_no || it.sequence || idx + 1} • {it.topic || "—"}
                                </div>
                                {!!safeStr(it.subtopic) && (
                                  <div className="small text-muted mt-1">{it.subtopic}</div>
                                )}
                                <div className="small mt-1">
                                  <strong>Difficulty:</strong> {it.difficulty || "MEDIUM"}
                                  {" • "}
                                  <strong>Weightage:</strong>{" "}
                                  {it.weightage == null || it.weightage === "" ? "—" : it.weightage}
                                </div>
                                {!!safeStr(it.remarks) && (
                                  <div className="small mt-1">
                                    <strong>Remarks:</strong> {it.remarks}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted">No items found.</div>
                      )}
                    </div>

                    <div className="d-grid gap-2 mt-3">
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

                      <Button
                        variant="outline-primary"
                        onClick={() => openEditModal(selected)}
                        disabled={isLocked(selected.status)}
                      >
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
            <Modal.Title>{editing ? "Edit Admission Syllabus" : "Create Admission Syllabus"}</Modal.Title>
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
                  <Form.Label>Applying Class</Form.Label>
                  <Form.Select
                    name="applying_class_id"
                    value={formData.applying_class_id}
                    onChange={handleHeaderChange}
                    required
                  >
                    <option value="">-- Select --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>

                <Col xs={12} md={3}>
                  <Form.Label>Base Class</Form.Label>
                  <Form.Select
                    name="base_class_id"
                    value={formData.base_class_id}
                    onChange={handleHeaderChange}
                  >
                    <option value="">-- Optional --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>

                <Col xs={12} md={3}>
                  <Form.Label>Subject</Form.Label>
                  <Form.Select
                    name="subject_id"
                    value={formData.subject_id}
                    onChange={handleHeaderChange}
                    required
                  >
                    <option value="">-- Select --</option>
                    {subjectsForSelectedClass.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name || s.subject_name}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              <Row className="g-2 mt-2">
                <Col xs={12} md={6}>
                  <Form.Label>Title</Form.Label>
                  <Form.Control
                    name="title"
                    value={formData.title}
                    onChange={handleHeaderChange}
                    placeholder="Admission Test Syllabus"
                  />
                </Col>

                <Col xs={12} md={6}>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    name="description"
                    value={formData.description}
                    onChange={handleHeaderChange}
                    placeholder="Short description..."
                  />
                </Col>
              </Row>

              <div className="d-flex justify-content-between align-items-center mt-3">
                <div className="fw-semibold">Topics / Items</div>
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
                      <th style={{ minWidth: 220 }}>Topic *</th>
                      <th style={{ minWidth: 240 }}>Subtopic</th>
                      <th style={{ width: 160 }}>Difficulty</th>
                      <th style={{ width: 140 }}>Weightage</th>
                      <th style={{ minWidth: 220 }}>Remarks</th>
                      <th style={{ width: 120 }}>Active</th>
                      <th style={{ width: 90 }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(formData.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td className="text-center">{idx + 1}</td>

                        <td>
                          <Form.Control
                            value={it.topic}
                            onChange={(e) => updateItem(idx, "topic", e.target.value)}
                            placeholder="Topic / Chapter"
                            required
                          />
                        </td>

                        <td>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            value={it.subtopic}
                            onChange={(e) => updateItem(idx, "subtopic", e.target.value)}
                            placeholder="Subtopics..."
                          />
                        </td>

                        <td>
                          <Form.Select
                            value={it.difficulty}
                            onChange={(e) => updateItem(idx, "difficulty", e.target.value)}
                          >
                            {difficultyOptions.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </Form.Select>
                        </td>

                        <td>
                          <Form.Control
                            type="number"
                            value={it.weightage}
                            onChange={(e) => updateItem(idx, "weightage", e.target.value)}
                            placeholder="e.g. 10"
                          />
                        </td>

                        <td>
                          <Form.Control
                            value={it.remarks}
                            onChange={(e) => updateItem(idx, "remarks", e.target.value)}
                            placeholder="Notes..."
                          />
                        </td>

                        <td className="text-center">
                          <Form.Check
                            type="switch"
                            checked={!!it.is_active}
                            onChange={(e) => updateItem(idx, "is_active", e.target.checked)}
                          />
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
                        <td colSpan={8} className="text-center text-muted py-3">
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
                    <Card.Body className="as-card-row">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="fw-semibold">Topic #{idx + 1}</div>
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
                        <Col xs={12}>
                          <Form.Label>Topic *</Form.Label>
                          <Form.Control
                            value={it.topic}
                            onChange={(e) => updateItem(idx, "topic", e.target.value)}
                            placeholder="Topic / Chapter"
                            required
                          />
                        </Col>

                        <Col xs={12}>
                          <Form.Label>Subtopic</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={2}
                            value={it.subtopic}
                            onChange={(e) => updateItem(idx, "subtopic", e.target.value)}
                            placeholder="Subtopics..."
                          />
                        </Col>

                        <Col xs={12} sm={4}>
                          <Form.Label>Difficulty</Form.Label>
                          <Form.Select
                            value={it.difficulty}
                            onChange={(e) => updateItem(idx, "difficulty", e.target.value)}
                          >
                            {difficultyOptions.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>

                        <Col xs={12} sm={4}>
                          <Form.Label>Weightage</Form.Label>
                          <Form.Control
                            type="number"
                            value={it.weightage}
                            onChange={(e) => updateItem(idx, "weightage", e.target.value)}
                            placeholder="e.g. 10"
                          />
                        </Col>

                        <Col xs={12} sm={4}>
                          <Form.Label>Active</Form.Label>
                          <div className="pt-2">
                            <Form.Check
                              type="switch"
                              checked={!!it.is_active}
                              onChange={(e) => updateItem(idx, "is_active", e.target.checked)}
                            />
                          </div>
                        </Col>

                        <Col xs={12}>
                          <Form.Label>Remarks</Form.Label>
                          <Form.Control
                            value={it.remarks}
                            onChange={(e) => updateItem(idx, "remarks", e.target.value)}
                            placeholder="Notes..."
                          />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}
              </div>

              <div className="as-sticky-actions">
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

export default AdmissionSyllabusCRUD;