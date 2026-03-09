import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  ProgressBar,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";

/* ---------------- helpers ---------------- */

const safeStr = (v) => (v == null ? "" : String(v));
const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const asUpper = (v) => safeStr(v).trim().toUpperCase();

const formatSeconds = (secs) => {
  const s = Math.max(0, Number(secs) || 0);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const typeBadge = (t) => {
  switch (asUpper(t)) {
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

const statusBadge = (s) => {
  switch (asUpper(s)) {
    case "PUBLISHED":
      return "success";
    case "DRAFT":
      return "secondary";
    case "ARCHIVED":
      return "dark";
    default:
      return "info";
  }
};

const attemptStateBadge = (s) => {
  switch (asUpper(s)) {
    case "NOT_STARTED":
      return "secondary";
    case "IN_PROGRESS":
      return "warning";
    case "COMPLETED":
      return "success";
    case "RETAKE_AVAILABLE":
      return "info";
    default:
      return "secondary";
  }
};

const itemTypeBadge = (t) => {
  switch (asUpper(t)) {
    case "MCQ":
      return "primary";
    case "TRUE_FALSE":
      return "info";
    case "FILL_BLANKS":
      return "warning";
    case "SHORT":
    case "LONG":
    case "SUBJECTIVE":
      return "secondary";
    default:
      return "light";
  }
};

const normalizeList = (d, key) => {
  if (Array.isArray(d)) return d;
  const candidates = [
    d?.[key],
    d?.data?.[key],
    d?.rows,
    d?.data?.rows,
    d?.items,
    d?.data,
    d?.result,
  ].filter(Boolean);

  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

const normalizeAssessment = (data) => {
  const a = data?.assessment ?? data?.data?.assessment ?? data;
  if (!a || typeof a !== "object") return null;

  const rawItems = Array.isArray(a?.Items)
    ? a.Items
    : Array.isArray(a?.items)
    ? a.items
    : [];

  const items = rawItems.map((it) => ({
    ...it,
    options: Array.isArray(it.options) ? it.options : [],
    correctIndex:
      it.correctIndex != null && Number.isFinite(Number(it.correctIndex))
        ? Number(it.correctIndex)
        : null,
  }));

  return {
    ...a,
    Items: items,
    items,
  };
};

const normalizeAttempt = (d) => d?.attempt ?? d?.data?.attempt ?? d ?? null;

/* ---------------- component ---------------- */

const EntranceExamPortal = () => {
  const fireTop = (opts) =>
    Swal.fire({
      target: document.body,
      ...opts,
      didOpen: (el) => {
        try {
          el.style.zIndex = "3000";
          const container = Swal.getContainer();
          if (container) container.style.zIndex = "3000";
        } catch {}
        if (typeof opts?.didOpen === "function") opts.didOpen(el);
      },
    });

  const [pageLoading, setPageLoading] = useState(true);

  const [availableLoading, setAvailableLoading] = useState(false);
  const [attemptsLoading, setAttemptsLoading] = useState(false);

  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [myAttempts, setMyAttempts] = useState([]);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  const [activeAttempt, setActiveAttempt] = useState(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [savingItemId, setSavingItemId] = useState(null);

  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [viewMode, setViewMode] = useState("HOME"); // HOME | TEST | RESULT

  const timerRef = useRef(null);

  const selectedAssessmentCard = useMemo(() => {
    return (
      availableAssessments.find((x) => Number(x.id) === Number(selectedAssessmentId)) || null
    );
  }, [availableAssessments, selectedAssessmentId]);

  const questions = useMemo(() => {
    const arr = selectedAssessment?.Items || selectedAssessment?.items || [];
    return Array.isArray(arr) ? arr : [];
  }, [selectedAssessment]);

  const currentQuestion = useMemo(() => {
    return questions[questionIndex] || null;
  }, [questions, questionIndex]);

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((a) => {
      if (!a) return false;
      return safeStr(a.selected_option).trim() || safeStr(a.answer_text).trim();
    }).length;
  }, [answers]);

  const progressPct = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const resetTestState = () => {
    setSelectedAssessment(null);
    setActiveAttempt(null);
    setQuestionIndex(0);
    setAnswers({});
    setRemainingSeconds(null);
    setResultData(null);
    setViewMode("HOME");
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startTimer = (initialSeconds) => {
    stopTimer();

    if (initialSeconds == null) {
      setRemainingSeconds(null);
      return;
    }

    setRemainingSeconds(Math.max(0, Number(initialSeconds) || 0));

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = Math.max(0, (Number(prev) || 0) - 1);
        if (next <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return next;
      });
    }, 1000);
  };

  const fetchAvailableAssessments = async () => {
    setAvailableLoading(true);
    try {
      const res = await api.get("/admission-assessments/my-available");
      setAvailableAssessments(normalizeList(res.data, "assessments"));
    } catch (e) {
      setAvailableAssessments([]);
      fireTop({
        icon: "error",
        title: "Error",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to load available entrance tests",
      });
    } finally {
      setAvailableLoading(false);
    }
  };

  const fetchMyAttempts = async () => {
    setAttemptsLoading(true);
    try {
      const res = await api.get("/admission-assessments/my-attempts");
      setMyAttempts(normalizeList(res.data, "attempts"));
    } catch (e) {
      setMyAttempts([]);
      fireTop({
        icon: "error",
        title: "Error",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to load my attempts",
      });
    } finally {
      setAttemptsLoading(false);
    }
  };

  const initialLoad = async () => {
    setPageLoading(true);
    await Promise.all([fetchAvailableAssessments(), fetchMyAttempts()]);
    setPageLoading(false);
  };

  useEffect(() => {
    initialLoad();
    return () => stopTimer();
  }, []);

  const fetchAssessmentById = async (assessmentId) => {
    const res = await api.get(`/admission-assessments/${assessmentId}`);
    const assessment = normalizeAssessment(res.data);
    setSelectedAssessment(assessment);
    return assessment;
  };

  const fetchMyAttemptForAssessment = async (assessmentId) => {
    const res = await api.get(`/admission-assessments/${assessmentId}/my-attempt`);
    return normalizeAttempt(res.data);
  };

  const loadAssessmentForPreview = async (assessmentId) => {
    try {
      setSelectedAssessmentId(assessmentId);
      await fetchAssessmentById(assessmentId);

      const myAttempt = await fetchMyAttemptForAssessment(assessmentId);
      if (myAttempt && asUpper(myAttempt.status) === "IN_PROGRESS") {
        setActiveAttempt(myAttempt);
        startTimer(myAttempt.remainingSeconds);
      } else {
        setActiveAttempt(null);
        stopTimer();
        setRemainingSeconds(null);
      }

      setViewMode("HOME");
      setResultData(null);
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Error",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to load test details",
      });
    }
  };

  const loadAttemptAnswersIntoState = async (attemptObj) => {
    const result = attemptObj?.result || null;
    const map = {};

    if (Array.isArray(result?.items)) {
      for (const r of result.items) {
        map[r.itemId] = {
          selected_option: r.selectedOption || "",
          answer_text: r.answerText || "",
        };
      }
    }

    setAnswers(map);
  };

  const startOrResumeTest = async (assessmentId) => {
    setStarting(true);
    try {
      const res = await api.post(`/admission-assessments/${assessmentId}/start`);
      const attempt = res?.data?.attempt || null;
      const assessment = normalizeAssessment(res?.data?.assessment);
      const secs = res?.data?.remainingSeconds ?? null;

      setSelectedAssessmentId(assessmentId);
      setSelectedAssessment(assessment);
      setActiveAttempt(attempt);
      setResultData(null);
      setQuestionIndex(0);
      setAnswers({});
      setViewMode("TEST");
      startTimer(secs);

      await fetchAvailableAssessments();
      await fetchMyAttempts();
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Could not start test",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to start entrance test",
      });
    } finally {
      setStarting(false);
    }
  };

  const patchAnswerState = (itemId, patch) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        ...patch,
      },
    }));
  };

  const saveAnswer = async (itemId) => {
    if (!activeAttempt?.id || !selectedAssessment?.id || !itemId) return;

    const payload = {
      itemId,
      selectedOption: safeStr(answers[itemId]?.selected_option).trim() || null,
      answerText: safeStr(answers[itemId]?.answer_text).trim() || null,
    };

    setSavingItemId(itemId);
    try {
      const res = await api.post(
        `/admission-assessments/${selectedAssessment.id}/attempts/${activeAttempt.id}/answer`,
        payload
      );

      if (res?.data?.remainingSeconds != null) {
        setRemainingSeconds(res.data.remainingSeconds);
      }
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Save failed",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to save answer",
      });

      if (safeStr(e?.response?.data?.message).toLowerCase().includes("time is over")) {
        await fetchAvailableAssessments();
        await fetchMyAttempts();
      }
    } finally {
      setSavingItemId(null);
    }
  };

  const submitTest = async () => {
    if (!activeAttempt?.id || !selectedAssessment?.id) return;

    const r = await fireTop({
      title: "Submit entrance test?",
      text: "You will not be able to change answers after submission.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Submit Test",
    });

    if (!r.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await api.post(
        `/admission-assessments/${selectedAssessment.id}/attempts/${activeAttempt.id}/submit`
      );

      stopTimer();

      const result = res?.data?.result || null;
      setResultData(result);
      setViewMode("RESULT");

      await fetchAvailableAssessments();
      await fetchMyAttempts();
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Submit failed",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to submit test",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const viewFullResult = async (attemptId) => {
    try {
      const res = await api.get(`/admission-assessments/attempts/${attemptId}/result`);
      const attempt = normalizeAttempt(res.data);

      if (attempt?.result_hidden) {
        fireTop({
          icon: "info",
          title: "Result Hidden",
          text: attempt?.result_message || "Result will be announced later",
        });
        return;
      }

      setResultData({
        attemptId: attempt?.id,
        totalMarks: attempt?.total_marks,
        obtainedMarks: attempt?.obtained_marks,
        percentage: attempt?.percentage,
        correctCount: attempt?.correct_count,
        wrongCount: attempt?.wrong_count,
        skippedCount: attempt?.skipped_count,
        topicStats: attempt?.result?.topicStats || {},
        showResultInstantly: true,
      });

      setViewMode("RESULT");
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Result Error",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to fetch result",
      });
    }
  };

  useEffect(() => {
    if (remainingSeconds === 0 && viewMode === "TEST" && activeAttempt?.id) {
      fireTop({
        icon: "warning",
        title: "Time is over",
        text: "Submitting your entrance test now.",
        timer: 1200,
        showConfirmButton: false,
      }).then(() => {
        submitTest();
      });
    }
  }, [remainingSeconds, viewMode, activeAttempt]);

  if (pageLoading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center py-5">
          <Spinner animation="border" className="me-2" />
          Loading entrance exam portal...
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-3">
      <Row className="g-3 align-items-center mb-3">
        <Col xs={12} md={8}>
          <h4 className="mb-0">Entrance Exam Portal</h4>
          <div className="text-muted small">
            Start, resume, complete and review your entrance examination tests.
          </div>
        </Col>

        <Col xs={12} md={4} className="d-flex justify-content-md-end gap-2 flex-wrap">
          <Button variant="outline-secondary" onClick={initialLoad}>
            Refresh
          </Button>
          {viewMode !== "HOME" && (
            <Button
              variant="dark"
              onClick={() => {
                stopTimer();
                resetTestState();
              }}
            >
              Back to Home
            </Button>
          )}
        </Col>
      </Row>

      {viewMode === "HOME" && (
        <Row className="g-3">
          <Col xs={12} lg={7}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Available Entrance Tests</div>
                {availableLoading ? <Spinner animation="border" size="sm" /> : null}
              </Card.Header>
              <Card.Body>
                {!availableAssessments.length ? (
                  <div className="text-muted">No entrance tests available right now.</div>
                ) : (
                  <div className="d-grid gap-3">
                    {availableAssessments.map((a) => (
                      <Card key={a.id} className="border">
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                            <div>
                              <div className="fw-semibold">
                                {safeStr(a.title || `Assessment #${a.id}`)}
                              </div>
                              <div className="text-muted small mt-1">
                                Subject:{" "}
                                {safeStr(
                                  a?.subject?.subject_name ||
                                    a?.subject?.name ||
                                    a?.Subject?.subject_name ||
                                    a?.Subject?.name ||
                                    "-"
                                )}{" "}
                                • Class:{" "}
                                {safeStr(
                                  a?.applyingClass?.class_name ||
                                    a?.ApplyingClass?.class_name ||
                                    "-"
                                )}
                              </div>
                            </div>

                            <div className="d-flex gap-2 flex-wrap">
                              <Badge bg={typeBadge(a.type)}>{asUpper(a.type)}</Badge>
                              <Badge bg={statusBadge(a.status)}>{asUpper(a.status)}</Badge>
                              <Badge bg={attemptStateBadge(a.attemptState)}>
                                {safeStr(a.attemptState || "NOT_STARTED")}
                              </Badge>
                            </div>
                          </div>

                          <Row className="g-2 mt-2">
                            <Col xs={6} md={3}>
                              <Card className="bg-light border-0">
                                <Card.Body className="py-2">
                                  <div className="small text-muted">Marks</div>
                                  <div className="fw-semibold">
                                    {a.total_marks ?? a.totalMarks ?? "-"}
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                            <Col xs={6} md={3}>
                              <Card className="bg-light border-0">
                                <Card.Body className="py-2">
                                  <div className="small text-muted">Time</div>
                                  <div className="fw-semibold">
                                    {a.duration_minutes ?? a.durationMinutes ?? "-"} min
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                            <Col xs={6} md={3}>
                              <Card className="bg-light border-0">
                                <Card.Body className="py-2">
                                  <div className="small text-muted">Attempts</div>
                                  <div className="fw-semibold">
                                    {a.attemptsUsed ?? 0}/
                                    {a.max_attempts == null ? 1 : a.max_attempts}
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                            <Col xs={6} md={3}>
                              <Card className="bg-light border-0">
                                <Card.Body className="py-2">
                                  <div className="small text-muted">Passing</div>
                                  <div className="fw-semibold">
                                    {a.passing_marks ?? a.passingMarks ?? "-"}
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                          </Row>

                          {safeStr(a.instructions).trim() ? (
                            <div className="mt-3">
                              <div className="small text-muted mb-1">Instructions</div>
                              <div className="small">{safeStr(a.instructions)}</div>
                            </div>
                          ) : null}

                          <div className="d-flex gap-2 flex-wrap mt-3">
                            <Button
                              variant="outline-dark"
                              onClick={() => loadAssessmentForPreview(a.id)}
                            >
                              View Details
                            </Button>

                            <Button
                              variant={
                                asUpper(a.attemptState) === "IN_PROGRESS"
                                  ? "warning"
                                  : "primary"
                              }
                              onClick={() => startOrResumeTest(a.id)}
                              disabled={starting}
                            >
                              {starting
                                ? "Please wait..."
                                : asUpper(a.attemptState) === "IN_PROGRESS"
                                ? "Resume Test"
                                : asUpper(a.attemptState) === "RETAKE_AVAILABLE"
                                ? "Retake Test"
                                : asUpper(a.attemptState) === "COMPLETED"
                                ? "Completed"
                                : "Start Test"}
                            </Button>

                            {a?.latestAttempt?.id &&
                            ["EVALUATED", "AUTO_SUBMITTED", "SUBMITTED"].includes(
                              asUpper(a?.latestAttempt?.status)
                            ) ? (
                              <Button
                                variant="outline-success"
                                onClick={() => viewFullResult(a.latestAttempt.id)}
                              >
                                View Result
                              </Button>
                            ) : null}
                          </div>
                        </Card.Body>
                      </Card>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={5}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <div className="fw-semibold">My Attempt History</div>
                {attemptsLoading ? <Spinner animation="border" size="sm" /> : null}
              </Card.Header>
              <Card.Body>
                {!myAttempts.length ? (
                  <div className="text-muted">No attempts found yet.</div>
                ) : (
                  <div className="table-responsive">
                    <Table hover className="align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Test</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {myAttempts.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <div className="fw-semibold">
                                {safeStr(a?.Assessment?.title || `Attempt #${a.id}`)}
                              </div>
                              <div className="text-muted small">
                                {safeStr(
                                  a?.Assessment?.subject?.subject_name ||
                                    a?.Assessment?.subject?.name ||
                                    "-"
                                )}
                              </div>
                            </td>
                            <td>
                              <Badge
                                bg={
                                  asUpper(a.status) === "IN_PROGRESS"
                                    ? "warning"
                                    : asUpper(a.status) === "EVALUATED" ||
                                      asUpper(a.status) === "AUTO_SUBMITTED"
                                    ? "success"
                                    : "secondary"
                                }
                              >
                                {safeStr(a.status || "-")}
                              </Badge>
                            </td>
                            <td>
                              {a?.obtained_marks ?? 0}/{a?.total_marks ?? 0}
                              <div className="text-muted small">
                                {a?.percentage != null ? `${a.percentage}%` : "-"}
                              </div>
                            </td>
                            <td>
                              {asUpper(a.status) === "IN_PROGRESS" ? (
                                <Button
                                  size="sm"
                                  variant="warning"
                                  onClick={() =>
                                    startOrResumeTest(a?.admission_assessment_id)
                                  }
                                >
                                  Resume
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline-success"
                                  onClick={() => viewFullResult(a.id)}
                                >
                                  Result
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>

            {selectedAssessmentCard ? (
              <Card className="shadow-sm border-0 mt-3">
                <Card.Header className="bg-white fw-semibold">Selected Test</Card.Header>
                <Card.Body>
                  <div className="fw-semibold">{safeStr(selectedAssessmentCard.title)}</div>
                  <div className="text-muted small mt-1">
                    {safeStr(
                      selectedAssessmentCard?.subject?.subject_name ||
                        selectedAssessmentCard?.subject?.name ||
                        "-"
                    )}
                  </div>

                  <div className="d-flex gap-2 flex-wrap mt-3">
                    <Badge bg={typeBadge(selectedAssessmentCard.type)}>
                      {asUpper(selectedAssessmentCard.type)}
                    </Badge>
                    <Badge bg={attemptStateBadge(selectedAssessmentCard.attemptState)}>
                      {safeStr(selectedAssessmentCard.attemptState || "-")}
                    </Badge>
                  </div>

                  <div className="mt-3 small">
                    <div>
                      <b>Total Marks:</b>{" "}
                      {selectedAssessmentCard.total_marks ??
                        selectedAssessmentCard.totalMarks ??
                        "-"}
                    </div>
                    <div>
                      <b>Duration:</b>{" "}
                      {selectedAssessmentCard.duration_minutes ??
                        selectedAssessmentCard.durationMinutes ??
                        "-"}{" "}
                      min
                    </div>
                    <div>
                      <b>Passing Marks:</b>{" "}
                      {selectedAssessmentCard.passing_marks ??
                        selectedAssessmentCard.passingMarks ??
                        "-"}
                    </div>
                  </div>

                  {safeStr(selectedAssessment?.instructions).trim() ? (
                    <div className="mt-3">
                      <div className="small text-muted mb-1">Instructions</div>
                      <div className="small">{safeStr(selectedAssessment.instructions)}</div>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <Button
                      variant={
                        asUpper(selectedAssessmentCard.attemptState) === "IN_PROGRESS"
                          ? "warning"
                          : "primary"
                      }
                      onClick={() => startOrResumeTest(selectedAssessmentCard.id)}
                    >
                      {asUpper(selectedAssessmentCard.attemptState) === "IN_PROGRESS"
                        ? "Resume Test"
                        : "Start Test"}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            ) : null}
          </Col>
        </Row>
      )}

      {viewMode === "TEST" && selectedAssessment && activeAttempt && (
        <Row className="g-3">
          <Col xs={12} lg={8}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <div className="fw-semibold">{safeStr(selectedAssessment.title)}</div>
                  <div className="text-muted small">
                    Question {questionIndex + 1} of {questions.length}
                  </div>
                </div>

                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <Badge bg="dark">Answered: {answeredCount}</Badge>
                  <Badge bg={remainingSeconds != null && remainingSeconds <= 300 ? "danger" : "primary"}>
                    Time Left:{" "}
                    {remainingSeconds == null ? "-" : formatSeconds(remainingSeconds)}
                  </Badge>
                </div>
              </Card.Header>

              <Card.Body>
                <div className="mb-3">
                  <ProgressBar now={progressPct} label={`${progressPct}%`} />
                </div>

                {!currentQuestion ? (
                  <div className="text-muted">No question found.</div>
                ) : (
                  <>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                      <Badge bg={itemTypeBadge(currentQuestion.type)}>
                        {asUpper(currentQuestion.type)}
                      </Badge>
                      <Badge bg="light" text="dark">
                        Marks: {currentQuestion.marks ?? 0}
                      </Badge>
                      <Badge bg="light" text="dark">
                        {safeStr(currentQuestion.difficulty || "-")}
                      </Badge>
                    </div>

                    <div className="fs-5 fw-semibold mb-3" style={{ whiteSpace: "pre-wrap" }}>
                      {safeStr(currentQuestion.question)}
                    </div>

                    {["MCQ", "TRUE_FALSE"].includes(asUpper(currentQuestion.type)) ? (
                      <div className="d-grid gap-2">
                        {(currentQuestion.options || []).map((opt, idx) => {
                          const checked =
                            safeStr(answers[currentQuestion.id]?.selected_option) === String(idx);

                          return (
                            <Card
                              key={idx}
                              className={`border ${checked ? "border-primary" : ""}`}
                              style={{ cursor: "pointer" }}
                              onClick={() => {
                                patchAnswerState(currentQuestion.id, {
                                  selected_option: String(idx),
                                  answer_text: "",
                                });
                              }}
                            >
                              <Card.Body className="py-2">
                                <Form.Check
                                  type="radio"
                                  name={`q_${currentQuestion.id}`}
                                  checked={checked}
                                  onChange={() => {
                                    patchAnswerState(currentQuestion.id, {
                                      selected_option: String(idx),
                                      answer_text: "",
                                    });
                                  }}
                                  label={`${String.fromCharCode(65 + idx)}. ${safeStr(opt)}`}
                                />
                              </Card.Body>
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <Form.Group>
                        <Form.Label className="small text-muted">Your Answer</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={6}
                          value={safeStr(answers[currentQuestion.id]?.answer_text)}
                          onChange={(e) =>
                            patchAnswerState(currentQuestion.id, {
                              answer_text: e.target.value,
                              selected_option: "",
                            })
                          }
                          placeholder="Write your answer here..."
                        />
                      </Form.Group>
                    )}

                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-4">
                      <div className="d-flex gap-2 flex-wrap">
                        <Button
                          variant="outline-secondary"
                          disabled={questionIndex <= 0}
                          onClick={() => setQuestionIndex((p) => Math.max(0, p - 1))}
                        >
                          Previous
                        </Button>

                        <Button
                          variant="outline-primary"
                          disabled={savingItemId === currentQuestion.id}
                          onClick={() => saveAnswer(currentQuestion.id)}
                        >
                          {savingItemId === currentQuestion.id ? "Saving..." : "Save Answer"}
                        </Button>

                        <Button
                          variant="outline-secondary"
                          disabled={questionIndex >= questions.length - 1}
                          onClick={() =>
                            setQuestionIndex((p) => Math.min(questions.length - 1, p + 1))
                          }
                        >
                          Next
                        </Button>
                      </div>

                      <Button
                        variant="success"
                        onClick={submitTest}
                        disabled={submitting}
                      >
                        {submitting ? "Submitting..." : "Submit Test"}
                      </Button>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={4}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white fw-semibold">Question Palette</Card.Header>
              <Card.Body>
                <div className="d-flex flex-wrap gap-2">
                  {questions.map((q, idx) => {
                    const isAnswered =
                      safeStr(answers[q.id]?.selected_option).trim() ||
                      safeStr(answers[q.id]?.answer_text).trim();

                    return (
                      <Button
                        key={q.id || idx}
                        size="sm"
                        variant={
                          idx === questionIndex
                            ? "dark"
                            : isAnswered
                            ? "success"
                            : "outline-secondary"
                        }
                        onClick={() => setQuestionIndex(idx)}
                        style={{ minWidth: 48 }}
                      >
                        {idx + 1}
                      </Button>
                    );
                  })}
                </div>

                <hr />

                <div className="small">
                  <div className="mb-2">
                    <Badge bg="dark" className="me-2">
                      Current
                    </Badge>
                    Current question
                  </div>
                  <div className="mb-2">
                    <Badge bg="success" className="me-2">
                      Answered
                    </Badge>
                    Answer saved/selected
                  </div>
                  <div>
                    <Badge bg="secondary" className="me-2">
                      Pending
                    </Badge>
                    Not answered yet
                  </div>
                </div>

                <hr />

                <div className="small">
                  <div>
                    <b>Total Questions:</b> {questions.length}
                  </div>
                  <div>
                    <b>Answered:</b> {answeredCount}
                  </div>
                  <div>
                    <b>Pending:</b> {Math.max(0, questions.length - answeredCount)}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {viewMode === "RESULT" && resultData && (
        <Row className="g-3">
          <Col xs={12} lg={8}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white fw-semibold">Entrance Test Result</Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col xs={12} md={3}>
                    <Card className="bg-light border-0">
                      <Card.Body className="py-3">
                        <div className="small text-muted">Obtained Marks</div>
                        <div className="fs-4 fw-bold">
                          {resultData.obtainedMarks ?? 0}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col xs={12} md={3}>
                    <Card className="bg-light border-0">
                      <Card.Body className="py-3">
                        <div className="small text-muted">Total Marks</div>
                        <div className="fs-4 fw-bold">
                          {resultData.totalMarks ?? 0}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col xs={12} md={3}>
                    <Card className="bg-light border-0">
                      <Card.Body className="py-3">
                        <div className="small text-muted">Percentage</div>
                        <div className="fs-4 fw-bold">
                          {resultData.percentage ?? 0}%
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col xs={12} md={3}>
                    <Card className="bg-light border-0">
                      <Card.Body className="py-3">
                        <div className="small text-muted">Result</div>
                        <div className="fs-5 fw-bold">
                          <Badge
                            bg={
                              Number(resultData.obtainedMarks || 0) >=
                              Number(selectedAssessmentCard?.passing_marks || 0)
                                ? "success"
                                : "danger"
                            }
                          >
                            {Number(resultData.obtainedMarks || 0) >=
                            Number(selectedAssessmentCard?.passing_marks || 0)
                              ? "PASS"
                              : "FAIL"}
                          </Badge>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <Row className="g-3 mt-1">
                  <Col xs={12} md={4}>
                    <Card className="bg-light border-0">
                      <Card.Body className="py-2">
                        <div className="small text-muted">Correct</div>
                        <div className="fw-semibold">{resultData.correctCount ?? 0}</div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col xs={12} md={4}>
                    <Card className="bg-light border-0">
                      <Card.Body className="py-2">
                        <div className="small text-muted">Wrong</div>
                        <div className="fw-semibold">{resultData.wrongCount ?? 0}</div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col xs={12} md={4}>
                    <Card className="bg-light border-0">
                      <Card.Body className="py-2">
                        <div className="small text-muted">Skipped</div>
                        <div className="fw-semibold">{resultData.skippedCount ?? 0}</div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <div className="mt-4">
                  <div className="fw-semibold mb-2">Topic-wise Summary</div>
                  {!resultData.topicStats ||
                  !Object.keys(resultData.topicStats).length ? (
                    <div className="text-muted small">No topic summary available.</div>
                  ) : (
                    <div className="table-responsive">
                      <Table className="align-middle">
                        <thead className="table-light">
                          <tr>
                            <th>Topic</th>
                            <th>Total</th>
                            <th>Obtained</th>
                            <th>Correct</th>
                            <th>Wrong</th>
                            <th>Skipped</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(resultData.topicStats).map(([topic, st]) => (
                            <tr key={topic}>
                              <td className="fw-semibold">{safeStr(topic)}</td>
                              <td>{st?.total ?? 0}</td>
                              <td>{st?.obtained ?? 0}</td>
                              <td>{st?.correct ?? 0}</td>
                              <td>{st?.wrong ?? 0}</td>
                              <td>{st?.skipped ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </div>

                <div className="d-flex gap-2 flex-wrap mt-3">
                  <Button
                    variant="dark"
                    onClick={() => {
                      setViewMode("HOME");
                      setResultData(null);
                      fetchAvailableAssessments();
                      fetchMyAttempts();
                    }}
                  >
                    Back to Home
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default EntranceExamPortal;