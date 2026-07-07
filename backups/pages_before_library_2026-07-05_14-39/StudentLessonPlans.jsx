// src/pages/StudentLessonPlans.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  Row,
  Spinner,
} from "react-bootstrap";

/**
 * StudentLessonPlans
 * Student-safe page: only shows useful information for students.
 * Hidden: teaching method, remedial/enrichment plan, internal remarks,
 * assessment planning and other teacher-only/admin fields.
 */

const safeStr = (v) => (v == null ? "" : String(v));
const trimStr = (v) => safeStr(v).trim();
const asUpper = (v) => trimStr(v).toUpperCase();

const fireTop = (opts) =>
  Swal.fire({
    target: document.body,
    ...opts,
    didOpen: (el) => {
      try {
        el.style.zIndex = "3000";
        const c = Swal.getContainer();
        if (c) c.style.zIndex = "3000";
      } catch {}
      if (typeof opts?.didOpen === "function") opts.didOpen(el);
    },
  });

const safeJsonParse = (value, fallback = null) => {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.rows,
    payload?.data?.rows,
    payload?.data?.lessonPlans,
    payload?.data?.plans,
    payload?.data?.items,
    payload?.data?.evaluations,
    payload?.data?.results,
    payload?.data,
    payload?.lessonPlans,
    payload?.plans,
    payload?.items,
    payload?.evaluations,
    payload?.results,
    payload?.result,
  ].filter(Boolean);

  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
};

const normalizeObject = (payload, keys = []) => {
  if (!payload || typeof payload !== "object") return null;
  for (const key of keys) if (payload[key] && typeof payload[key] === "object") return payload[key];

  const common = ["data", "lessonPlan", "plan", "evaluation", "record", "result", "item"];
  for (const key of common) if (payload[key] && typeof payload[key] === "object") return payload[key];

  return payload;
};

const isMissingEndpoint = (err) => {
  const status = Number(err?.response?.status);
  return status === 404 || status === 405 || status === 501;
};

const typeBadge = (type) => {
  switch (asUpper(type)) {
    case "OBJECTIVE":
      return "primary";
    case "SUBJECTIVE":
      return "secondary";
    case "MIXED":
      return "dark";
    default:
      return "info";
  }
};

const questionTypeBadge = (type) => {
  switch (asUpper(type)) {
    case "MCQ":
      return "primary";
    case "TRUE_FALSE":
      return "info";
    case "SUBJECTIVE":
    case "SHORT":
    case "LONG":
      return "secondary";
    case "FILL_BLANKS":
    case "MATCH":
      return "info";
    default:
      return "dark";
  }
};

const parseOptions = (item) => {
  if (Array.isArray(item?.options)) return item.options;
  const parsed = safeJsonParse(item?.optionsJson, []);
  return Array.isArray(parsed) ? parsed : [];
};

const getCorrectIndex = (item) => {
  const raw = item?.correctIndex != null ? item.correctIndex : item?.correctAnswer;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const getConfig = (obj) =>
  obj?.config || safeJsonParse(obj?.configJson, null) || safeJsonParse(obj?.configurationJson, null) || {};

const answersVisibleToStudents = (evaluation) => {
  const cfg = getConfig(evaluation);
  return Boolean(
    evaluation?.answersVisibleToStudents === true ||
      evaluation?.answerKeyVisibleToStudents === true ||
      evaluation?.showAnswersToStudents === true ||
      evaluation?.answersPublishedAt ||
      cfg?.answersVisibleToStudents === true ||
      cfg?.answerKeyVisibleToStudents === true ||
      cfg?.showAnswersToStudents === true ||
      cfg?.answersPublishedAt
  );
};

const normalizeEvaluation = (payload) => {
  const ev = normalizeObject(payload, ["evaluation"]);
  if (!ev) return null;

  const rawItems = ev.items || ev.Items || ev.EvaluationItems || ev.LessonPlanEvaluationItems || [];
  const items = (Array.isArray(rawItems) ? rawItems : []).map((item, index) => ({
    ...item,
    sortOrder: item?.sortOrder ?? item?.sort_order ?? index,
    options: parseOptions(item),
    correctIndex: getCorrectIndex(item),
  }));

  return { ...ev, config: getConfig(ev), items, Items: items };
};

const toDate = (value) => {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return trimStr(value).slice(0, 10);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return trimStr(value).slice(0, 10);
  }
};

const shortDate = (value) => {
  const s = trimStr(value);
  if (!s) return "—";
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return toDate(value) || "—";
};

const classNameOf = (plan) => {
  const cls = plan?.Class || plan?.class || {};
  return trimStr(cls.class_name) || trimStr(cls.name) || trimStr(plan?.className) || trimStr(plan?.class_name) || "—";
};

const subjectNameOf = (plan) => {
  const sub = plan?.Subject || plan?.subject || {};
  return trimStr(sub.name) || trimStr(sub.subject_name) || trimStr(plan?.subjectName) || trimStr(plan?.subject_name) || "—";
};

const classIdOf = (plan) => plan?.classId || plan?.class_id || plan?.Class?.id || plan?.class?.id || null;

const subjectIdOf = (plan) => plan?.subjectId || plan?.subject_id || plan?.Subject?.id || plan?.subject?.id || null;

const academicSessionOf = (plan) => plan?.academicSession || plan?.academic_session || plan?.session || plan?.sessionName || "";

const sectionsTextOf = (plan) => {
  const sections = plan?.Sections || plan?.sections || [];
  if (Array.isArray(sections) && sections.length) {
    return sections.map((s) => trimStr(s.section_name || s.name || s.id)).filter(Boolean).join(", ");
  }
  return trimStr(plan?.sectionName || plan?.section_name || "");
};

const publishedLike = (item) =>
  item?.publish === true ||
  item?.published === true ||
  item?.isPublished === true ||
  item?.visibleToStudents === true ||
  asUpper(item?.status) === "PUBLISHED" ||
  String(item?.publish) === "1" ||
  String(item?.publish).toLowerCase() === "true";

const termText = (term) => {
  const t = asUpper(term);
  if (t === "TERM1") return "Term 1";
  if (t === "TERM2") return "Term 2";
  if (t === "FULL_YEAR") return "Full Year";
  return trimStr(term) || "";
};

const firstPresent = (...values) =>
  values.find((value) => value !== null && value !== undefined && String(value).trim() !== "");

const getStudentResult = (evaluation) =>
  evaluation?.result ||
  evaluation?.studentResult ||
  evaluation?.myResult ||
  evaluation?.evaluationResult ||
  evaluation?.Result ||
  null;

const getResultMarks = (result) => {
  const raw = firstPresent(
    result?.marksObtained,
    result?.marks_obtained,
    result?.obtainedMarks,
    result?.score,
    result?.marks
  );
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const getEvaluationTotalMarks = (evaluation, result = getStudentResult(evaluation)) => {
  const raw = firstPresent(evaluation?.totalMarks, evaluation?.total_marks, evaluation?.maxMarks, result?.totalMarks);
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const getResultPercentage = (result, marks, total) => {
  const direct = Number(firstPresent(result?.percentage, result?.percent));
  if (Number.isFinite(direct)) return Math.max(0, Math.min(100, direct));
  if (marks !== null && total > 0) return Math.max(0, Math.min(100, (marks / total) * 100));
  return null;
};

const formatNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const normalizeSyllabusItems = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => ({
      ...item,
      id: item?.id ?? item?.itemId ?? item?.breakdownItemId ?? null,
      sequence: item?.sequence ?? item?.seq_no ?? item?.seqNo ?? index + 1,
      unitNumber: item?.unitNumber ?? item?.unit_no ?? item?.unitNo ?? "",
      unitTitle: item?.unitTitle ?? item?.unit_title ?? "",
      topics: item?.topics ?? item?.topic ?? "",
      subtopics: item?.subtopics ?? item?.subtopic ?? "",
      periods: item?.periods ?? item?.plannedPeriods ?? item?.planned_periods ?? null,
      plannedFrom: item?.plannedFrom ?? item?.planned_from ?? "",
      plannedTo: item?.plannedTo ?? item?.planned_to ?? "",
      plannedMonth: item?.plannedMonth ?? item?.planned_month ?? "",
      remarks: item?.remarks ?? item?.remark ?? "",
    }))
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));

const embeddedSyllabusItemsOf = (plan) => {
  const fullBreakdownItems =
    plan?.SyllabusBreakdown?.Items ||
    plan?.syllabusBreakdown?.items ||
    plan?.breakdown?.items ||
    plan?.breakdownItems ||
    plan?.SyllabusBreakdownItems ||
    [];
  const singleItem =
    plan?.SyllabusBreakdownItem ||
    plan?.syllabusBreakdownItem ||
    plan?.breakdownItem ||
    null;

  return normalizeSyllabusItems(singleItem ? [singleItem] : fullBreakdownItems);
};

async function getWithFallback(paths, config = {}) {
  let lastErr = null;
  for (const path of paths) {
    try {
      return await api.get(path, config);
    } catch (err) {
      lastErr = err;
      if (!isMissingEndpoint(err)) throw err;
    }
  }
  throw lastErr || new Error("No endpoint available");
}

async function getBlobWithFallback(paths) {
  let lastErr = null;
  for (const path of paths) {
    try {
      return await api.get(path, { responseType: "blob" });
    } catch (err) {
      lastErr = err;
      if (!isMissingEndpoint(err)) throw err;
    }
  }
  throw lastErr || new Error("PDF endpoint not available");
}

export default function StudentLessonPlans() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [evaluations, setEvaluations] = useState([]);
  const [syllabusLoading, setSyllabusLoading] = useState(false);
  const [syllabusItems, setSyllabusItems] = useState([]);
  const [syllabusBreakdown, setSyllabusBreakdown] = useState(null);

  const [search, setSearch] = useState("");
  const [termFilter, setTermFilter] = useState("ALL");

  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [activeEvaluation, setActiveEvaluation] = useState(null);

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (plans || [])
      .filter((plan) => {
        if (termFilter !== "ALL" && asUpper(plan?.term) !== termFilter) return false;
        if (!q) return true;

        const blob = [
          plan?.topic,
          plan?.subtopic,
          classNameOf(plan),
          subjectNameOf(plan),
          sectionsTextOf(plan),
          plan?.homework,
          plan?.activities,
          plan?.resources,
          plan?.term,
        ]
          .map((x) => trimStr(x).toLowerCase())
          .join(" ");

        return blob.includes(q);
      })
      .sort((a, b) => {
        const ad = new Date(a?.weekStart || a?.startDate || a?.createdAt || 0);
        const bd = new Date(b?.weekStart || b?.startDate || b?.createdAt || 0);
        return bd.getTime() - ad.getTime();
      });
  }, [plans, search, termFilter]);

  const selectedPlanEvaluations = useMemo(() => (evaluations || []).filter((ev) => publishedLike(ev)), [evaluations]);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWithFallback([
        "/lesson-plans/student/list",
        "/lesson-plans/student/my",
        "/lesson-plans/student",
        "/lesson-plans?student=1",
      ]);

      const list = normalizeList(res.data);
      const cleaned = list.filter((plan) => {
        if (plan?.publish == null && plan?.status == null && plan?.isPublished == null) return true;
        return publishedLike(plan);
      });

      setPlans(cleaned);
      if (!selectedPlanId && cleaned.length) setSelectedPlanId(cleaned[0].id);
    } catch (err) {
      setPlans([]);
      fireTop({
        icon: "error",
        title: "Lesson Plans",
        text: err?.response?.data?.message || err?.response?.data?.error || "Failed to load lesson plans.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId]);

  const loadPlanDetails = useCallback(
    async (planId) => {
      if (!planId) return;
      setDetailLoading(true);
      try {
        const res = await getWithFallback([
          `/lesson-plans/student/${planId}`,
          `/lesson-plans/student/detail/${planId}`,
          `/lesson-plans/${planId}?student=1`,
        ]);
        const plan = normalizeObject(res.data, ["lessonPlan", "plan"]);
        setSelectedPlan(plan || null);
      } catch {
        const fallback = plans.find((p) => Number(p?.id) === Number(planId));
        setSelectedPlan(fallback || null);
      } finally {
        setDetailLoading(false);
      }
    },
    [plans]
  );

  const loadEvaluations = useCallback(async (planId) => {
    if (!planId) return;
    setEvaluationsLoading(true);
    try {
      const res = await getWithFallback([
        `/lesson-plans/student/${planId}/evaluations`,
        `/lesson-plans/student/evaluations?lessonPlanId=${encodeURIComponent(planId)}`,
        `/lesson-plans/${planId}/evaluations?student=1`,
      ]);
      setEvaluations(normalizeList(res.data).filter((ev) => publishedLike(ev)));
    } catch {
      setEvaluations([]);
    } finally {
      setEvaluationsLoading(false);
    }
  }, []);

  const loadSyllabusBreakdown = useCallback(async (plan) => {
    if (!plan) {
      setSyllabusItems([]);
      setSyllabusBreakdown(null);
      return;
    }

    const embeddedItems = embeddedSyllabusItemsOf(plan);
    if (embeddedItems.length) {
      setSyllabusItems(embeddedItems);
      setSyllabusBreakdown(
        plan?.SyllabusBreakdown ||
          plan?.syllabusBreakdown ||
          plan?.breakdown ||
          (plan?.breakdownId ? { id: plan.breakdownId } : null)
      );
      return;
    }

    const classId = classIdOf(plan);
    const subjectId = subjectIdOf(plan);
    if (!classId || !subjectId) {
      setSyllabusItems([]);
      setSyllabusBreakdown(null);
      return;
    }

    setSyllabusLoading(true);
    try {
      const res = await api.get("/syllabus-breakdowns/items-for-plan", {
        params: {
          classId,
          subjectId,
          term: plan?.term || "FULL_YEAR",
          academicSession: academicSessionOf(plan) || undefined,
        },
      });
      const data = res.data || {};
      setSyllabusItems(normalizeSyllabusItems(data.items || data?.data?.items));
      setSyllabusBreakdown(
        data.breakdown ||
          data?.data?.breakdown ||
          (data.breakdownId ? { id: data.breakdownId, status: data.status } : null)
      );
    } catch {
      setSyllabusItems([]);
      setSyllabusBreakdown(null);
    } finally {
      setSyllabusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!selectedPlanId) {
      setSelectedPlan(null);
      setEvaluations([]);
      return;
    }
    loadPlanDetails(selectedPlanId);
    loadEvaluations(selectedPlanId);
  }, [selectedPlanId, loadPlanDetails, loadEvaluations]);

  const openEvaluation = async (evaluation) => {
    if (!evaluation?.id) return;
    setShowEvalModal(true);
    setEvalLoading(true);
    setActiveEvaluation(null);

    try {
      const res = await getWithFallback([
        `/lesson-plans/student/evaluations/${evaluation.id}`,
        `/lesson-plan-evaluations/${evaluation.id}/student`,
        `/lesson-plans/evaluations/${evaluation.id}?student=1`,
        `/lesson-plan-evaluations/${evaluation.id}`,
      ]);
      setActiveEvaluation(normalizeEvaluation(res.data) || normalizeEvaluation(evaluation));
    } catch {
      setActiveEvaluation(normalizeEvaluation(evaluation));
    } finally {
      setEvalLoading(false);
    }
  };

  const downloadEvaluationPdf = async (evaluation) => {
    if (!evaluation?.id) return;
    try {
      const res = await getBlobWithFallback([
        `/lesson-plans/student/evaluations/${evaluation.id}/pdf`,
        `/lesson-plan-evaluations/${evaluation.id}/student/pdf`,
        `/lesson-plans/evaluations/${evaluation.id}/pdf?student=1`,
        `/lesson-plan-evaluations/${evaluation.id}/pdf?student=1`,
      ]);

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      fireTop({
        icon: "error",
        title: "PDF",
        text: err?.response?.data?.message || err?.response?.data?.error || "Unable to open evaluation PDF.",
      });
    }
  };

  const closeEvalModal = () => {
    setShowEvalModal(false);
    setActiveEvaluation(null);
    setEvalLoading(false);
  };

  const currentPlan = selectedPlan || plans.find((p) => Number(p?.id) === Number(selectedPlanId));

  useEffect(() => {
    if (!currentPlan || detailLoading) {
      setSyllabusItems([]);
      setSyllabusBreakdown(null);
      setSyllabusLoading(false);
      return;
    }
    loadSyllabusBreakdown(currentPlan);
  }, [currentPlan, detailLoading, loadSyllabusBreakdown]);

  const objectiveText = trimStr(currentPlan?.studentObjectives || currentPlan?.specificObjectives || currentPlan?.objectives);
  const homeworkText = trimStr(currentPlan?.homework);
  const activityText = trimStr(currentPlan?.studentActivities || currentPlan?.activities);
  const resourcesText = trimStr(currentPlan?.studentResources || currentPlan?.resources);

  return (
    <div className="student-lesson-page">
      <style>{pageCss}</style>

      <div className="slp-hero">
        <div>
          <h3 className="mb-1">Lesson Plans</h3>
          <div className="slp-hero-sub">Study topics, homework and published tests.</div>
        </div>
        <Button variant="light" size="sm" onClick={loadPlans} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      <Row className="g-3">
        <Col xs={12} lg={4}>
          <Card className="slp-card border-0 shadow-sm">
            <Card.Body>
              <InputGroup className="mb-2">
                <InputGroup.Text>
                  <i className="bi bi-search" />
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search topic, subject or homework..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </InputGroup>

              <div className="d-flex gap-2 flex-wrap mb-3">
                {[
                  ["ALL", "All"],
                  ["FULL_YEAR", "Full Year"],
                  ["TERM1", "Term 1"],
                  ["TERM2", "Term 2"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={termFilter === value ? "primary" : "outline-primary"}
                    onClick={() => setTermFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="d-flex align-items-center justify-content-between mb-2">
                <div className="fw-bold">Available Lessons</div>
                <Badge bg="primary">{filteredPlans.length}</Badge>
              </div>

              {loading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" size="sm" className="me-2" />
                  Loading lessons...
                </div>
              ) : !filteredPlans.length ? (
                <Alert variant="light" className="border mb-0">No lesson plans available yet.</Alert>
              ) : (
                <div className="slp-plan-list">
                  {filteredPlans.map((plan) => {
                    const active = Number(selectedPlanId) === Number(plan.id);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={`slp-plan-item ${active ? "active" : ""}`}
                        onClick={() => setSelectedPlanId(plan.id)}
                      >
                        <div className="fw-bold text-start">{trimStr(plan.topic) || "Untitled Lesson"}</div>
                        {trimStr(plan.subtopic) ? <div className="small text-start mt-1 opacity-90">{trimStr(plan.subtopic)}</div> : null}
                        <div className="small text-start mt-2 opacity-90">{subjectNameOf(plan)} • {classNameOf(plan)}</div>
                        <div className="small text-start mt-1 opacity-75">
                          {shortDate(plan.weekStart || plan.startDate)} - {shortDate(plan.weekEnd || plan.endDate)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} lg={8}>
          <Card className="slp-card border-0 shadow-sm">
            <Card.Body>
              {!currentPlan ? (
                <div className="text-muted text-center py-5">Select a lesson to view details.</div>
              ) : detailLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" className="me-2" />
                  Loading lesson...
                </div>
              ) : (
                <>
                  <div className="slp-lesson-head">
                    <div>
                      <div className="d-flex gap-2 flex-wrap align-items-center mb-2">
                        <Badge bg="primary">{subjectNameOf(currentPlan)}</Badge>
                        <Badge bg="info">{classNameOf(currentPlan)}</Badge>
                        {sectionsTextOf(currentPlan) ? <Badge bg="secondary">Sec: {sectionsTextOf(currentPlan)}</Badge> : null}
                        {termText(currentPlan.term) ? <Badge bg="success">{termText(currentPlan.term)}</Badge> : null}
                      </div>

                      <h4 className="mb-1">{trimStr(currentPlan.topic) || "Lesson"}</h4>
                      {trimStr(currentPlan.subtopic) ? <div className="text-muted fw-semibold">{trimStr(currentPlan.subtopic)}</div> : null}
                    </div>

                    <div className="slp-date-pill">
                      <i className="bi bi-calendar3 me-1" />
                      {shortDate(currentPlan.weekStart || currentPlan.startDate)} - {shortDate(currentPlan.weekEnd || currentPlan.endDate)}
                    </div>
                  </div>

                  <Row className="g-3 mt-1">
                    <StudentInfoBox title="What to learn" icon="bi-bullseye" value={objectiveText} />
                    <StudentInfoBox
                      title="Homework"
                      icon="bi-house-check"
                      value={homeworkText}
                      highlight
                      emptyText="No homework added for this lesson."
                    />
                    <StudentInfoBox title="Class activity / practice" icon="bi-pencil-square" value={activityText} />
                    <StudentInfoBox title="Resources" icon="bi-book" value={resourcesText} />
                  </Row>

                  <SyllabusBreakdownPanel
                    loading={syllabusLoading}
                    items={syllabusItems}
                    breakdown={syllabusBreakdown}
                    activeItemId={currentPlan?.breakdownItemId || currentPlan?.breakdown_item_id}
                  />

                  <div className="mt-4">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                      <div>
                        <h5 className="mb-0">Tests / Evaluations</h5>
                        <div className="text-muted small">Published tests connected with this lesson.</div>
                      </div>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => loadEvaluations(currentPlan.id)}
                        disabled={evaluationsLoading}
                      >
                        {evaluationsLoading ? "Loading..." : "Reload"}
                      </Button>
                    </div>

                    {evaluationsLoading ? (
                      <div className="text-center py-4">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Loading tests...
                      </div>
                    ) : !selectedPlanEvaluations.length ? (
                      <Alert variant="light" className="border mb-0">No test published for this lesson yet.</Alert>
                    ) : (
                      <Row className="g-3">
                        {selectedPlanEvaluations.map((ev) => (
                          <Col xs={12} md={6} key={ev.id}>
                            <Card className="slp-eval-card h-100">
                              <Card.Body>
                                <div className="fw-bold mb-2">{trimStr(ev.title) || `Evaluation #${ev.id}`}</div>
                                <div className="d-flex gap-2 flex-wrap mb-2">
                                  <Badge bg={typeBadge(ev.type)}>{asUpper(ev.type || "TEST")}</Badge>
                                  <Badge bg="light" text="dark">Marks: {ev.totalMarks ?? "—"}</Badge>
                                  <StudentMarksBadge evaluation={ev} />
                                  {ev.timeMinutes != null ? <Badge bg="light" text="dark">Time: {ev.timeMinutes} min</Badge> : null}
                                </div>
                                <StudentResultRemark evaluation={ev} compact />
                                <div className="text-muted small mb-3">
                                  {answersVisibleToStudents(ev)
                                    ? "Answer key is available."
                                    : "Question paper is available. Answer key is hidden."}
                                </div>
                                <div className="d-flex gap-2 flex-wrap">
                                  <Button size="sm" variant="primary" onClick={() => openEvaluation(ev)}>View Questions</Button>
                                  <Button size="sm" variant="outline-dark" onClick={() => downloadEvaluationPdf(ev)}>PDF</Button>
                                </div>
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showEvalModal} onHide={closeEvalModal} centered size="xl" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>{activeEvaluation ? trimStr(activeEvaluation.title) || "Question Paper" : "Question Paper"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {evalLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" className="me-2" />
              Loading questions...
            </div>
          ) : !activeEvaluation ? (
            <Alert variant="light" className="border mb-0">Question paper not available.</Alert>
          ) : (
            <>
              <div className="d-flex justify-content-between gap-2 flex-wrap mb-3">
                <div className="d-flex gap-2 flex-wrap">
                  <Badge bg={typeBadge(activeEvaluation.type)} className="px-3 py-2">{asUpper(activeEvaluation.type || "TEST")}</Badge>
                  <Badge bg="light" text="dark" className="px-3 py-2">Marks: {activeEvaluation.totalMarks ?? "—"}</Badge>
                  <StudentMarksBadge evaluation={activeEvaluation} className="px-3 py-2" />
                  {activeEvaluation.timeMinutes != null ? (
                    <Badge bg="light" text="dark" className="px-3 py-2">Time: {activeEvaluation.timeMinutes} min</Badge>
                  ) : null}
                  <Badge
                    bg={answersVisibleToStudents(activeEvaluation) ? "warning" : "secondary"}
                    text={answersVisibleToStudents(activeEvaluation) ? "dark" : undefined}
                    className="px-3 py-2"
                  >
                    Answers: {answersVisibleToStudents(activeEvaluation) ? "Available" : "Hidden"}
                  </Badge>
                </div>
                <Button size="sm" variant="outline-dark" onClick={() => downloadEvaluationPdf(activeEvaluation)}>Open PDF</Button>
              </div>

              {trimStr(activeEvaluation?.config?.instructions || activeEvaluation?.instructions) ? (
                <Alert variant="info">
                  <div className="fw-bold mb-1">Instructions</div>
                  {trimStr(activeEvaluation?.config?.instructions || activeEvaluation?.instructions)}
                </Alert>
              ) : null}

              <StudentResultRemark evaluation={activeEvaluation} />

              <div className="d-grid gap-3">
                {(activeEvaluation.items || activeEvaluation.Items || []).length ? (
                  (activeEvaluation.items || activeEvaluation.Items || []).map((item, index) => (
                    <QuestionCard
                      key={item.id || item.tempId || index}
                      item={item}
                      index={index}
                      showAnswers={answersVisibleToStudents(activeEvaluation)}
                    />
                  ))
                ) : (
                  <Alert variant="light" className="border mb-0">No questions found.</Alert>
                )}
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={closeEvalModal}>Close</Button>
          {activeEvaluation ? <Button variant="dark" onClick={() => downloadEvaluationPdf(activeEvaluation)}>Open PDF</Button> : null}
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function StudentMarksBadge({ evaluation, className = "" }) {
  const result = getStudentResult(evaluation);
  const marks = getResultMarks(result);
  if (!result || marks === null) return null;

  const total = getEvaluationTotalMarks(evaluation, result);
  const percentage = getResultPercentage(result, marks, total);
  const percentText = percentage !== null ? ` (${formatNumber(percentage)}%)` : "";
  const totalText = total !== null ? ` / ${formatNumber(total)}` : "";

  return (
    <Badge bg="success" className={className} title="Marks obtained by you">
      Your Marks: {formatNumber(marks)}
      {totalText}
      {percentText}
    </Badge>
  );
}

function StudentResultRemark({ evaluation, compact = false }) {
  const result = getStudentResult(evaluation);
  const remark = trimStr(result?.remark || result?.remarks || result?.teacherRemark || "");
  if (!remark) return null;

  if (compact) {
    return <div className="slp-result-remark small mb-3">Remark: {remark}</div>;
  }

  return (
    <Alert variant="success" className="mb-3">
      <div className="fw-bold mb-1">Teacher Remark</div>
      <div className="slp-preline">{remark}</div>
    </Alert>
  );
}

function SyllabusBreakdownPanel({ loading, items, breakdown, activeItemId }) {
  if (!loading && !items?.length) return null;

  return (
    <section className="slp-syllabus mt-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h5 className="mb-0">Syllabus Breakdown</h5>
          <div className="text-muted small">Units and topics planned for this subject.</div>
        </div>
        {breakdown?.id ? (
          <Badge bg="light" text="dark">
            Breakdown #{breakdown.id}
            {breakdown.status ? ` • ${breakdown.status}` : ""}
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" className="me-2" />
          Loading syllabus...
        </div>
      ) : (
        <div className="slp-syllabus-list">
          {items.map((item, index) => {
            const active = activeItemId && Number(item.id) === Number(activeItemId);
            return <SyllabusBreakdownItem key={item.id || index} item={item} active={active} />;
          })}
        </div>
      )}
    </section>
  );
}

function SyllabusBreakdownItem({ item, active }) {
  const title = trimStr(item.unitTitle) || trimStr(item.topics) || `Unit ${item.sequence || ""}`.trim();
  const unitLabel = trimStr(item.unitNumber) || trimStr(item.sequence);
  const dateText = [shortDate(item.plannedFrom), shortDate(item.plannedTo)]
    .filter((x) => x && x !== "—")
    .join(" - ");

  return (
    <div className={`slp-syllabus-item ${active ? "active" : ""}`}>
      <div className="slp-syllabus-top">
        <div>
          <div className="d-flex gap-2 align-items-center flex-wrap mb-1">
            {unitLabel ? <Badge bg={active ? "primary" : "secondary"}>Unit {unitLabel}</Badge> : null}
            {active ? <Badge bg="success">Current Lesson</Badge> : null}
            {item.periods != null && trimStr(item.periods) ? (
              <Badge bg="light" text="dark">{item.periods} Period{Number(item.periods) === 1 ? "" : "s"}</Badge>
            ) : null}
          </div>
          <div className="slp-syllabus-title">{title}</div>
        </div>
        {dateText || trimStr(item.plannedMonth) ? (
          <div className="slp-syllabus-date">{dateText || trimStr(item.plannedMonth)}</div>
        ) : null}
      </div>

      {trimStr(item.topics) && trimStr(item.topics) !== title ? (
        <div className="slp-syllabus-text">
          <strong>Topics:</strong> {trimStr(item.topics)}
        </div>
      ) : null}
      {trimStr(item.subtopics) ? (
        <div className="slp-syllabus-text">
          <strong>Subtopics:</strong> {trimStr(item.subtopics)}
        </div>
      ) : null}
      {trimStr(item.remarks) ? (
        <div className="slp-syllabus-text text-muted">
          <strong>Notes:</strong> {trimStr(item.remarks)}
        </div>
      ) : null}
    </div>
  );
}

function StudentInfoBox({ title, value, icon, highlight = false, emptyText = "" }) {
  const text = trimStr(value);
  if (!text && !emptyText) return null;

  return (
    <Col xs={12} md={6}>
      <div className={`slp-info-box ${highlight ? "highlight" : ""}`}>
        <div className="d-flex gap-2 align-items-center mb-2">
          <span className="slp-info-icon"><i className={`bi ${icon || "bi-info-circle"}`} /></span>
          <div className="fw-bold">{title}</div>
        </div>
        <div className={`slp-preline ${!text ? "text-muted" : ""}`}>{text || emptyText}</div>
      </div>
    </Col>
  );
}

function QuestionCard({ item, index, showAnswers }) {
  const type = asUpper(item.type || "QUESTION");
  const options = parseOptions(item);
  const correctIndex = getCorrectIndex(item);
  const answerKey = trimStr(item.answerKey || item.modelAnswer || item.correctAnswerText || "");

  return (
    <Card className="border shadow-sm">
      <Card.Body>
        <div className="d-flex justify-content-between gap-2 flex-wrap mb-2">
          <div className="fw-bold">Q{index + 1}. {trimStr(item.question) || "Question"}</div>
          <div className="d-flex gap-2 flex-wrap">
            <Badge bg={questionTypeBadge(type)}>{type}</Badge>
            <Badge bg="light" text="dark">{item.marks ?? "—"} Mark{Number(item.marks) === 1 ? "" : "s"}</Badge>
          </div>
        </div>

        {type === "MCQ" && options.length ? (
          <div className="slp-options">
            {options.slice(0, 4).map((option, optIndex) => {
              const isCorrect = showAnswers && correctIndex === optIndex;
              return (
                <div key={optIndex} className={`slp-option ${isCorrect ? "correct" : ""}`}>
                  <span className="slp-option-letter">{String.fromCharCode(65 + optIndex)}</span>
                  <span>{trimStr(option) || "—"}</span>
                  {isCorrect ? <Badge bg="success" className="ms-auto">Correct</Badge> : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {type !== "MCQ" && showAnswers && answerKey ? (
          <Alert variant="success" className="mb-0 mt-2">
            <div className="fw-bold mb-1">Answer Key</div>
            <div className="slp-preline">{answerKey}</div>
          </Alert>
        ) : null}

        {!showAnswers ? <div className="text-muted small mt-2">Answer key will appear only when teacher allows it.</div> : null}
      </Card.Body>
    </Card>
  );
}

const pageCss = `
.student-lesson-page {
  padding: 18px;
  background: #f6f8ff;
  min-height: 100vh;
}

.slp-hero {
  border-radius: 22px;
  padding: 20px;
  margin-bottom: 16px;
  color: white;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  box-shadow: 0 18px 36px rgba(79, 70, 229, 0.22);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.slp-hero h3 { font-weight: 900; }
.slp-hero-sub { color: rgba(255, 255, 255, 0.88); font-weight: 650; }
.slp-card { border-radius: 20px; }

.slp-plan-list {
  display: grid;
  gap: 10px;
  max-height: calc(100vh - 260px);
  overflow: auto;
  padding-right: 2px;
}

.slp-plan-item {
  border: 1px solid #e8ecf5;
  background: #fff;
  color: #111827;
  border-radius: 16px;
  padding: 13px;
  width: 100%;
  transition: box-shadow 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.slp-plan-item:hover {
  border-color: rgba(79, 70, 229, 0.35);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.07);
}

.slp-plan-item.active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, #4f46e5, #06b6d4);
  box-shadow: 0 14px 24px rgba(79, 70, 229, 0.22);
}

.slp-lesson-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  border-bottom: 1px solid #e8ecf5;
}

.slp-date-pill {
  background: #eef2ff;
  color: #3730a3;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 0.85rem;
  font-weight: 800;
  white-space: nowrap;
}

.slp-info-box {
  background: #ffffff;
  border: 1px solid #e8ecf5;
  border-radius: 18px;
  padding: 14px;
  height: 100%;
}

.slp-info-box.highlight { background: #fffbeb; border-color: #fde68a; }

.slp-info-icon {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #4f46e5;
  background: rgba(79, 70, 229, 0.1);
}

.slp-preline {
  white-space: pre-line;
  color: #374151;
  line-height: 1.5;
  font-weight: 500;
}

.slp-eval-card {
  border: 1px solid #e8ecf5;
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.slp-result-remark {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  padding: 8px 10px;
  font-weight: 650;
}

.slp-syllabus {
  border: 1px solid #e8ecf5;
  background: #ffffff;
  border-radius: 18px;
  padding: 14px;
}

.slp-syllabus-list {
  display: grid;
  gap: 10px;
}

.slp-syllabus-item {
  border: 1px solid #e5e7eb;
  background: #f8faff;
  border-radius: 14px;
  padding: 12px;
}

.slp-syllabus-item.active {
  border-color: #86efac;
  background: #f0fdf4;
  box-shadow: 0 10px 22px rgba(22, 163, 74, 0.08);
}

.slp-syllabus-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.slp-syllabus-title {
  color: #111827;
  font-weight: 900;
  line-height: 1.35;
}

.slp-syllabus-date {
  color: #3730a3;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.slp-syllabus-text {
  margin-top: 8px;
  color: #374151;
  line-height: 1.45;
  white-space: pre-line;
}

.slp-options { display: grid; gap: 8px; margin-top: 12px; }

.slp-option {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #e5e7eb;
  background: #f8faff;
  border-radius: 13px;
  padding: 10px;
}

.slp-option.correct { border-color: #86efac; background: #f0fdf4; }

.slp-option-letter {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #e0e7ff;
  color: #4f46e5;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  flex: 0 0 28px;
}

@media (max-width: 768px) {
  .student-lesson-page { padding: 12px; }
  .slp-plan-list { max-height: 420px; }
  .slp-date-pill { width: 100%; text-align: center; }
}
`;
