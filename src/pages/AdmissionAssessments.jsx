import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import {
  Accordion,
  Badge,
  Button,
  Card,
  Col,
  Form,
  InputGroup,
  Modal,
  ProgressBar,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

/* ---------------- helpers ---------------- */

const safeStr = (v) => (v == null ? "" : String(v));
const asUpper = (v) => safeStr(v).trim().toUpperCase();
const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const safeNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const safeJsonParse = (v, fallback = null) => {
  if (v == null) return fallback;
  if (typeof v !== "string") return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

const clampPercent = (p) => {
  const n = Number(p);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n);
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
    case "DRAFT":
      return "secondary";
    case "PUBLISHED":
      return "success";
    case "ARCHIVED":
      return "dark";
    default:
      return "info";
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
    case "MATCH":
      return "dark";
    case "SHORT":
      return "secondary";
    case "LONG":
      return "secondary";
    case "SUBJECTIVE":
      return "secondary";
    default:
      return "light";
  }
};

const normalizeList = (d) => {
  if (Array.isArray(d)) return d;
  const candidates = [
    d?.assessments,
    d?.data?.assessments,
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

const normalizeClasses = (d) => {
  if (Array.isArray(d)) return d;
  const candidates = [d?.classes, d?.rows, d?.data?.classes, d?.data, d?.items].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

const normalizeSubjects = (d) => {
  if (Array.isArray(d)) return d;
  const candidates = [d?.subjects, d?.rows, d?.data?.subjects, d?.data, d?.items].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

const normalizeSyllabus = (d) => {
  if (Array.isArray(d)) return d;
  const candidates = [d?.syllabus, d?.rows, d?.data?.syllabus, d?.data, d?.items].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

const normalizeAssessmentFromApi = (data) => {
  const a = data?.assessment ?? data?.data?.assessment ?? data;
  if (!a || typeof a !== "object") return null;

  const config = a.config ?? safeJsonParse(a.config_json, null);

  const rawItems = a.Items || a.items || [];
  const items = (Array.isArray(rawItems) ? rawItems : []).map((it) => {
    const options =
      Array.isArray(it.options) ? it.options : safeJsonParse(it.options_json, []);
    const correctIndex =
      it.correctIndex != null
        ? Number(it.correctIndex)
        : it.correct_answer != null && String(it.correct_answer).trim() !== ""
        ? Number(it.correct_answer)
        : it.correctAnswer != null && String(it.correctAnswer).trim() !== ""
        ? Number(it.correctAnswer)
        : null;

    return {
      ...it,
      options: Array.isArray(options) ? options : [],
      correctIndex: Number.isFinite(correctIndex) ? correctIndex : null,
    };
  });

  return {
    ...a,
    config,
    Items: items,
    items,
  };
};

const normalizeAttempts = (d) => {
  if (Array.isArray(d)) return d;
  const candidates = [d?.attempts, d?.data?.attempts, d?.rows, d?.data, d?.items].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
};

const normalizeAiQuestionsToItems = (aiData) => {
  const root = aiData?.data ?? aiData;
  const list =
    root?.questions ||
    root?.items ||
    root?.assessmentItems ||
    root?.data?.questions ||
    root?.data?.items ||
    [];

  if (!Array.isArray(list)) return [];

  return list
    .map((q) => {
      const type = asUpper(q?.type);
      const question = safeStr(q?.question || q?.q).trim();
      if (!type || !question) return null;

      let options = Array.isArray(q?.options)
        ? q.options.map((x) => safeStr(x))
        : [];

      if (type === "MCQ") {
        while (options.length < 4) options.push("");
        options = options.slice(0, 4);
      }

      if (type === "TRUE_FALSE") {
        if (!options.length) options = ["True", "False"];
        options = options.slice(0, 2);
      }

      const correctIndex =
        q?.correctIndex != null
          ? Number(q.correctIndex)
          : q?.correctAnswer != null && String(q.correctAnswer).trim() !== ""
          ? Number(q.correctAnswer)
          : null;

      return {
        tempId: uid(),
        type,
        question,
        marks: Number(q?.marks ?? (["MCQ", "TRUE_FALSE", "FILL_BLANKS"].includes(type) ? 1 : 5)) || 1,
        options,
        correctIndex: Number.isFinite(correctIndex) ? correctIndex : 0,
        answerKey: safeStr(q?.answerKey || q?.answer || "").trim(),
        topic: safeStr(q?.topic || "").trim(),
        subtopic: safeStr(q?.subtopic || "").trim(),
        difficulty: safeStr(q?.difficulty || "MEDIUM").trim() || "MEDIUM",
      };
    })
    .filter(Boolean);
};

const getClassName = (c) =>
  safeStr(c?.class_name || c?.name || c?.title || `Class #${c?.id || ""}`);

const getSubjectName = (s) =>
  safeStr(s?.subject_name || s?.name || s?.title || `Subject #${s?.id || ""}`);

const getSyllabusName = (s) =>
  safeStr(s?.title || s?.name || `Syllabus #${s?.id || ""}`);

/* ---------------- component ---------------- */

const AdmissionAssessments = () => {
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

  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState([]);

  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const [activeAssessmentId, setActiveAssessmentId] = useState(null);
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [activeLoading, setActiveLoading] = useState(false);

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [syllabusList, setSyllabusList] = useState([]);

  const [filters, setFilters] = useState({
    applyingClassId: "",
    subjectId: "",
    admissionSyllabusId: "",
    status: "",
    academicSession: "",
  });

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginSaving, setLoginSaving] = useState(false);

  const [loginForm, setLoginForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    admission_number: "",
  });

  const [form, setForm] = useState({
    schoolId: "",
    admissionSyllabusId: "",
    applyingClassId: "",
    baseClassId: "",
    subjectId: "",
    academicSession: "",
    title: "",
    description: "",
    instructions: "",
    type: "OBJECTIVE",
    durationMinutes: 30,
    totalMarks: 20,
    passingMarks: "",
    allowRetake: false,
    maxAttempts: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    showResultInstantly: true,
  });

  const [items, setItems] = useState([]);

  const [analyticsBusy, setAnalyticsBusy] = useState(false);
  const [analytics, setAnalytics] = useState(null);

  const [attemptsBusy, setAttemptsBusy] = useState(false);
  const [attempts, setAttempts] = useState([]);

  const [openKeys, setOpenKeys] = useState(["0"]);
  const [rightTab, setRightTab] = useState("analytics");

  /* ---------------- AI ---------------- */

  const [aiBusy, setAiBusy] = useState(false);
  const [aiMode, setAiMode] = useState("APPEND"); // APPEND | REPLACE
  const [aiDifficulty, setAiDifficulty] = useState("MEDIUM");
  const [aiLanguage, setAiLanguage] = useState("en");
  const [aiQuestionCount, setAiQuestionCount] = useState(10);

  /* ---------------- derived ---------------- */

  const activeItems = useMemo(() => {
    const arr = activeAssessment?.Items || activeAssessment?.items || [];
    return Array.isArray(arr) ? arr : [];
  }, [activeAssessment]);

  const canEditActive = useMemo(() => {
    return asUpper(activeAssessment?.status || "DRAFT") === "DRAFT";
  }, [activeAssessment]);

  const computedTotalMarks = useMemo(() => {
    return (items || []).reduce((a, b) => a + (Number(b.marks) || 0), 0);
  }, [items]);

  const selectedSyllabus = useMemo(() => {
    return syllabusList.find((s) => Number(s.id) === Number(form.admissionSyllabusId)) || null;
  }, [syllabusList, form.admissionSyllabusId]);

  const aiEnabled = useMemo(() => {
    return !!(
      safeNum(form.admissionSyllabusId) &&
      safeNum(form.applyingClassId) &&
      safeNum(form.subjectId)
    );
  }, [form.admissionSyllabusId, form.applyingClassId, form.subjectId]);

  const analyticsChart = useMemo(() => {
    if (!analytics) {
      return {
        barData: [],
        pieData: [],
      };
    }

    return {
      barData: [
        { name: "Highest", value: Number(analytics?.highestMarks || analytics?.highest || 0) },
        { name: "Average", value: Number(analytics?.averageMarks || analytics?.average || 0) },
        { name: "Lowest", value: Number(analytics?.lowestMarks || analytics?.lowest || 0) },
      ],
      pieData: [
        { name: "Pass", value: Number(analytics?.passCount || 0) },
        { name: "Fail", value: Number(analytics?.failCount || 0) },
      ],
    };
  }, [analytics]);

  const attemptsProgressRows = useMemo(() => {
    return (attempts || []).map((r) => {
      const total =
        Number(
          r?.total_marks ??
            r?.totalMarks ??
            activeAssessment?.total_marks ??
            activeAssessment?.totalMarks ??
            0
        ) || 0;

      const obt =
        Number(r?.obtained_marks ?? r?.obtainedMarks ?? r?.score ?? r?.marksObtained ?? 0) || 0;

      const pct =
        r?.percentage != null
          ? Number(r.percentage)
          : total > 0
          ? Number(((obt / total) * 100).toFixed(2))
          : 0;

      return {
        ...r,
        total,
        obtained: obt,
        percent: clampPercent(pct),
      };
    });
  }, [attempts, activeAssessment]);

  /* ---------------- fetch masters ---------------- */

  const fetchClasses = async () => {
    try {
      const res = await api.get("/classes");
      setClasses(normalizeClasses(res.data));
    } catch {
      setClasses([]);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await api.get("/subjects");
      setSubjects(normalizeSubjects(res.data));
    } catch {
      setSubjects([]);
    }
  };

  const fetchSyllabus = async () => {
    try {
      const res = await api.get("/admission-syllabus");
      setSyllabusList(normalizeSyllabus(res.data));
    } catch {
      setSyllabusList([]);
    }
  };

  /* ---------------- fetch list ---------------- */

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const params = {
        applyingClassId: filters.applyingClassId || undefined,
        subjectId: filters.subjectId || undefined,
        admissionSyllabusId: filters.admissionSyllabusId || undefined,
        status: filters.status || undefined,
        academicSession: safeStr(filters.academicSession).trim() || undefined,
      };

      const res = await api.get("/admission-assessments", { params });
      const list = normalizeList(res.data);
      setAssessments(list);

      if (
        activeAssessmentId &&
        !list.some((x) => Number(x?.id) === Number(activeAssessmentId))
      ) {
        setActiveAssessmentId(null);
        setActiveAssessment(null);
      }
    } catch (e) {
      setAssessments([]);
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || "Failed to fetch admission assessments",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssessmentById = async (id) => {
    if (!id) return;
    setActiveLoading(true);
    setAnalytics(null);
    setAttempts([]);
    try {
      const res = await api.get(`/admission-assessments/${id}`);
      const row = normalizeAssessmentFromApi(res.data);
      setActiveAssessment(row);
    } catch (e) {
      setActiveAssessment(null);
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || "Failed to load assessment details",
      });
    } finally {
      setActiveLoading(false);
    }
  };

  const loadAnalytics = async (id) => {
    if (!id) return;
    setAnalyticsBusy(true);
    try {
      const res = await api.get(`/admission-assessments/${id}/analytics`);
      setAnalytics(res?.data?.analytics || res?.data || null);

      setOpenKeys((prev) => {
        const set = new Set(prev || []);
        set.add("1");
        return Array.from(set);
      });
      setRightTab("analytics");
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || "Failed to load analytics",
      });
    } finally {
      setAnalyticsBusy(false);
    }
  };

  const loadAttempts = async (id) => {
    if (!id) return;
    setAttemptsBusy(true);
    try {
      const res = await api.get(`/admission-assessments/${id}/attempts`);
      setAttempts(normalizeAttempts(res.data));

      setOpenKeys((prev) => {
        const set = new Set(prev || []);
        set.add("2");
        return Array.from(set);
      });
      setRightTab("attempts");
    } catch (e) {
      setAttempts([]);
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || "Failed to load attempts",
      });
    } finally {
      setAttemptsBusy(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchSubjects();
    fetchSyllabus();
  }, []);

  useEffect(() => {
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeAssessmentId) fetchAssessmentById(activeAssessmentId);
    else setActiveAssessment(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAssessmentId]);

  /* ---------------- auto-fill from syllabus ---------------- */

  useEffect(() => {
    if (!selectedSyllabus || editing) return;

    const applyingClassId =
      selectedSyllabus?.applying_class_id ??
      selectedSyllabus?.applyingClassId ??
      selectedSyllabus?.ApplyingClass?.id ??
      "";

    const baseClassId =
      selectedSyllabus?.base_class_id ??
      selectedSyllabus?.baseClassId ??
      selectedSyllabus?.BaseClass?.id ??
      "";

    const subjectId =
      selectedSyllabus?.subject_id ??
      selectedSyllabus?.subjectId ??
      selectedSyllabus?.Subject?.id ??
      "";

    setForm((prev) => ({
      ...prev,
      applyingClassId: prev.applyingClassId || applyingClassId || "",
      baseClassId: prev.baseClassId || baseClassId || "",
      subjectId: prev.subjectId || subjectId || "",
      title:
        prev.title ||
        `${getClassName(selectedSyllabus?.ApplyingClass || {}) || "Admission"} ${
          getSubjectName(selectedSyllabus?.Subject || {}) || "Assessment"
        }`.trim(),
    }));
  }, [selectedSyllabus, editing]);

  /* ---------------- modal helpers ---------------- */

  const resetModal = () => {
    setEditing(false);
    setEditId(null);
    setSaving(false);
    setAiBusy(false);
    setAiMode("APPEND");
    setAiDifficulty("MEDIUM");
    setAiLanguage("en");
    setAiQuestionCount(10);

    setForm({
      schoolId: "",
      admissionSyllabusId: "",
      applyingClassId: "",
      baseClassId: "",
      subjectId: "",
      academicSession: "",
      title: "",
      description: "",
      instructions: "",
      type: "OBJECTIVE",
      durationMinutes: 30,
      totalMarks: 20,
      passingMarks: "",
      allowRetake: false,
      maxAttempts: 1,
      shuffleQuestions: false,
      shuffleOptions: false,
      showResultInstantly: true,
    });

    setItems([
      {
        tempId: uid(),
        type: "MCQ",
        question: "",
        marks: 1,
        options: ["", "", "", ""],
        correctIndex: 0,
        answerKey: "",
        topic: "",
        subtopic: "",
        difficulty: "MEDIUM",
      },
    ]);
  };

  const openCreate = () => {
    resetModal();
    setShowModal(true);
  };

  const closeModal = async () => {
    setShowModal(false);
    setSaving(false);
    setAiBusy(false);
    await sleep(200);
    resetModal();
  };

  const openLoginModal = () => {
    setLoginForm({
      name: "",
      username: "",
      email: "",
      password: "",
      admission_number: "",
    });
    setShowLoginModal(true);
  };

  const closeLoginModal = () => {
    setShowLoginModal(false);
    setLoginSaving(false);
  };

  /* ---------------- form helpers ---------------- */

  const onForm = (name, value) => setForm((p) => ({ ...p, [name]: value }));
  const onLoginForm = (name, value) => setLoginForm((p) => ({ ...p, [name]: value }));

  const addItem = (type) => {
    const t = type || "MCQ";
    setItems((prev) => [
      ...prev,
      {
        tempId: uid(),
        type: t,
        question: "",
        marks: t === "MCQ" || t === "TRUE_FALSE" || t === "FILL_BLANKS" ? 1 : 5,
        options:
          t === "MCQ"
            ? ["", "", "", ""]
            : t === "TRUE_FALSE"
            ? ["True", "False"]
            : [],
        correctIndex: 0,
        answerKey: "",
        topic: "",
        subtopic: "",
        difficulty: "MEDIUM",
      },
    ]);
  };

  const removeItem = (tempId) => {
    setItems((prev) => prev.filter((x) => x.tempId !== tempId));
  };

  const patchItem = (tempId, patch) => {
    setItems((prev) => prev.map((x) => (x.tempId === tempId ? { ...x, ...patch } : x)));
  };

  const patchOption = (tempId, idx, value) => {
    setItems((prev) =>
      prev.map((x) => {
        if (x.tempId !== tempId) return x;
        const opts = Array.isArray(x.options) ? [...x.options] : [];
        while (opts.length <= idx) opts.push("");
        opts[idx] = value;
        return { ...x, options: opts };
      })
    );
  };

  /* ---------------- payload builders ---------------- */

  const buildItemsPayload = () => {
    return (items || [])
      .filter((it) => safeStr(it.question).trim())
      .map((it, idx) => {
        const type = asUpper(it.type);
        const base = {
          sortOrder: idx,
          type,
          question: safeStr(it.question).trim(),
          marks: Number(it.marks) || 0,
          difficulty: safeStr(it.difficulty || "MEDIUM").trim() || "MEDIUM",
          topic: safeStr(it.topic).trim() || null,
          subtopic: safeStr(it.subtopic).trim() || null,
        };

        if (["MCQ", "TRUE_FALSE", "FILL_BLANKS"].includes(type)) {
          return {
            ...base,
            options:
              type === "FILL_BLANKS"
                ? []
                : (it.options || []).map((x) => safeStr(x).trim()).filter(Boolean),
            correctIndex:
              type === "MCQ" || type === "TRUE_FALSE"
                ? Number(it.correctIndex) || 0
                : undefined,
            answerKey: safeStr(it.answerKey).trim() || null,
          };
        }

        return {
          ...base,
          answerKey: safeStr(it.answerKey).trim() || null,
          options: type === "MATCH" ? (it.options || []).filter(Boolean) : [],
        };
      });
  };

  const buildUpsertPayload = () => {
    return {
      schoolId: safeNum(form.schoolId),
      admissionSyllabusId: safeNum(form.admissionSyllabusId),
      applyingClassId: safeNum(form.applyingClassId),
      baseClassId: safeNum(form.baseClassId),
      subjectId: safeNum(form.subjectId),
      academicSession: safeStr(form.academicSession).trim() || null,
      title: safeStr(form.title).trim(),
      description: safeStr(form.description).trim() || null,
      instructions: safeStr(form.instructions).trim() || null,
      type: form.type,
      durationMinutes:
        form.durationMinutes === "" || form.durationMinutes == null
          ? null
          : Number(form.durationMinutes) || null,
      totalMarks: Number(form.totalMarks) || computedTotalMarks || 0,
      passingMarks:
        form.passingMarks === "" || form.passingMarks == null
          ? null
          : Number(form.passingMarks),
      allowRetake: !!form.allowRetake,
      maxAttempts:
        form.maxAttempts === "" || form.maxAttempts == null
          ? null
          : Number(form.maxAttempts),
      shuffleQuestions: !!form.shuffleQuestions,
      shuffleOptions: !!form.shuffleOptions,
      showResultInstantly: !!form.showResultInstantly,
      items: buildItemsPayload(),
    };
  };

  const buildAiQuestionsPayload = () => {
    return {
      admissionSyllabusId: safeNum(form.admissionSyllabusId),
      applyingClassId: safeNum(form.applyingClassId),
      baseClassId: safeNum(form.baseClassId),
      subjectId: safeNum(form.subjectId),
      title: safeStr(form.title).trim() || null,
      language: aiLanguage,
      type: form.type,
      difficulty: aiDifficulty,
      totalMarks: Number(form.totalMarks) || computedTotalMarks || 20,
      questionCount: Number(aiQuestionCount) || 10,
      academicSession: safeStr(form.academicSession).trim() || null,
    };
  };

  const buildAiGeneratePayload = () => {
    return {
      schoolId: safeNum(form.schoolId),
      admissionSyllabusId: safeNum(form.admissionSyllabusId),
      applyingClassId: safeNum(form.applyingClassId),
      baseClassId: safeNum(form.baseClassId),
      subjectId: safeNum(form.subjectId),
      academicSession: safeStr(form.academicSession).trim() || null,
      title: safeStr(form.title).trim() || null,
      description: safeStr(form.description).trim() || null,
      instructions: safeStr(form.instructions).trim() || null,
      type: form.type,
      difficulty: aiDifficulty,
      language: aiLanguage,
      totalMarks: Number(form.totalMarks) || computedTotalMarks || 20,
      durationMinutes:
        form.durationMinutes === "" || form.durationMinutes == null
          ? null
          : Number(form.durationMinutes) || null,
      passingMarks:
        form.passingMarks === "" || form.passingMarks == null
          ? null
          : Number(form.passingMarks),
      allowRetake: !!form.allowRetake,
      maxAttempts:
        form.maxAttempts === "" || form.maxAttempts == null
          ? null
          : Number(form.maxAttempts),
      shuffleQuestions: !!form.shuffleQuestions,
      shuffleOptions: !!form.shuffleOptions,
      showResultInstantly: !!form.showResultInstantly,
      questionCount: Number(aiQuestionCount) || 10,
    };
  };

  /* ---------------- AI helpers ---------------- */

  const generateQuestionsWithAI = async () => {
    if (aiBusy) return;

    if (!aiEnabled) {
      fireTop({
        icon: "warning",
        title: "Missing",
        text: "Admission Syllabus, Applying Class and Subject are required for AI.",
      });
      return;
    }

    setAiBusy(true);
    try {
      const payload = buildAiQuestionsPayload();
      const res = await api.post("/api/ai/admission-assessment/questions", payload);

      const newItems = normalizeAiQuestionsToItems(res?.data);

      if (!newItems.length) {
        fireTop({
          icon: "warning",
          title: "AI",
          text: "AI response received but no valid questions were parsed.",
        });
        return;
      }

      setItems((prev) => {
        if (aiMode === "REPLACE") return newItems;
        return [...(prev || []), ...newItems];
      });

      const merged =
        aiMode === "REPLACE" ? newItems : [...(items || []), ...newItems];

      const mergedMarks = merged.reduce((a, b) => a + (Number(b.marks) || 0), 0);

      if (!Number(form.totalMarks) || Number(form.totalMarks) < mergedMarks) {
        setForm((p) => ({ ...p, totalMarks: mergedMarks || p.totalMarks }));
      }

      fireTop({
        icon: "success",
        title: "✨ AI Questions Ready",
        text:
          aiMode === "REPLACE"
            ? "Existing questions replaced."
            : "AI questions added to the list.",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (e) {
      fireTop({
        icon: "error",
        title: "AI Error",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to generate AI questions",
      });
    } finally {
      setAiBusy(false);
    }
  };

  const generateAndSaveWithAI = async () => {
    if (aiBusy) return;

    if (!aiEnabled) {
      fireTop({
        icon: "warning",
        title: "Missing",
        text: "Admission Syllabus, Applying Class and Subject are required for AI generate & save.",
      });
      return;
    }

    setAiBusy(true);
    try {
      const payload = buildAiGeneratePayload();
      const res = await api.post("/api/ai/admission-assessment/generate", payload);

      const createdId =
        res?.data?.assessment?.id ||
        res?.data?.data?.assessment?.id ||
        res?.data?.id;

      await closeModal();

      fireTop({
        icon: "success",
        title: "AI Assessment Created",
        text: "Assessment generated and saved successfully.",
        timer: 1600,
        showConfirmButton: false,
      });

      await fetchAssessments();
      if (createdId) setActiveAssessmentId(createdId);
    } catch (e) {
      fireTop({
        icon: "error",
        title: "AI Error",
        text:
          e?.response?.data?.message ||
          e?.response?.data?.details ||
          "Failed to generate and save AI assessment",
      });
    } finally {
      setAiBusy(false);
    }
  };

  /* ---------------- pdf helpers ---------------- */

  const downloadAssessmentPdf = async (id, withAnswers = false) => {
    if (!id) return;
    try {
      const qs = withAnswers ? "?answers=1" : "";
      const res = await api.get(`/admission-assessments/${id}/pdf${qs}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      fireTop({
        icon: "error",
        title: "PDF Error",
        text: e?.response?.data?.message || "Failed to open PDF",
      });
    }
  };

  /* ---------------- create / edit ---------------- */

  const createAssessment = async () => {
    if (!safeNum(form.admissionSyllabusId) || !safeNum(form.applyingClassId) || !safeNum(form.subjectId)) {
      fireTop({
        icon: "warning",
        title: "Missing",
        text: "Admission Syllabus, Applying Class and Subject are required.",
      });
      return;
    }

    if (!safeStr(form.title).trim()) {
      fireTop({ icon: "warning", title: "Missing", text: "Please enter title" });
      return;
    }

    if (!buildItemsPayload().length) {
      fireTop({ icon: "warning", title: "Missing", text: "Please add at least 1 valid question" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildUpsertPayload();
      const res = await api.post("/admission-assessments", payload);
      const createdId = res?.data?.assessment?.id || res?.data?.id;

      await closeModal();

      fireTop({
        icon: "success",
        title: "Created",
        text: "Admission assessment created successfully",
        timer: 1400,
        showConfirmButton: false,
      });

      await fetchAssessments();
      if (createdId) setActiveAssessmentId(createdId);
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || e?.response?.data?.details || "Failed to create assessment",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    if (!activeAssessment) return;

    if (asUpper(activeAssessment.status) !== "DRAFT") {
      fireTop({
        icon: "info",
        title: "Locked",
        text: "Only DRAFT assessment can be edited.",
      });
      return;
    }

    setEditing(true);
    setEditId(activeAssessment.id);

    setForm({
      schoolId: activeAssessment.school_id || activeAssessment.schoolId || "",
      admissionSyllabusId:
        activeAssessment.admission_syllabus_id || activeAssessment.admissionSyllabusId || "",
      applyingClassId:
        activeAssessment.applying_class_id || activeAssessment.applyingClassId || "",
      baseClassId: activeAssessment.base_class_id || activeAssessment.baseClassId || "",
      subjectId: activeAssessment.subject_id || activeAssessment.subjectId || "",
      academicSession: safeStr(activeAssessment.academic_session || activeAssessment.academicSession),
      title: safeStr(activeAssessment.title),
      description: safeStr(activeAssessment.description),
      instructions: safeStr(activeAssessment.instructions),
      type: safeStr(activeAssessment.type || "OBJECTIVE"),
      durationMinutes:
        activeAssessment.duration_minutes == null && activeAssessment.durationMinutes == null
          ? 30
          : Number(activeAssessment.duration_minutes ?? activeAssessment.durationMinutes),
      totalMarks: Number(activeAssessment.total_marks ?? activeAssessment.totalMarks ?? 0),
      passingMarks:
        activeAssessment.passing_marks == null && activeAssessment.passingMarks == null
          ? ""
          : Number(activeAssessment.passing_marks ?? activeAssessment.passingMarks),
      allowRetake: !!(activeAssessment.allow_retake ?? activeAssessment.allowRetake),
      maxAttempts:
        activeAssessment.max_attempts == null && activeAssessment.maxAttempts == null
          ? 1
          : Number(activeAssessment.max_attempts ?? activeAssessment.maxAttempts),
      shuffleQuestions: !!(activeAssessment.shuffle_questions ?? activeAssessment.shuffleQuestions),
      shuffleOptions: !!(activeAssessment.shuffle_options ?? activeAssessment.shuffleOptions),
      showResultInstantly: !!(
        activeAssessment.show_result_instantly ?? activeAssessment.showResultInstantly
      ),
    });

    const mapped = (activeItems || []).map((it) => ({
      tempId: uid(),
      type: safeStr(it.type || "MCQ"),
      question: safeStr(it.question),
      marks: Number(it.marks || 0),
      options: Array.isArray(it.options) ? it.options : [],
      correctIndex:
        it.correctIndex != null
          ? Number(it.correctIndex)
          : it.correct_answer != null && String(it.correct_answer).trim() !== ""
          ? Number(it.correct_answer)
          : 0,
      answerKey: safeStr(it.answer_key || it.answerKey || ""),
      difficulty: safeStr(it.difficulty || "MEDIUM"),
      topic: safeStr(it.topic || ""),
      subtopic: safeStr(it.subtopic || ""),
    }));

    setItems(
      mapped.length
        ? mapped
        : [
            {
              tempId: uid(),
              type: "MCQ",
              question: "",
              marks: 1,
              options: ["", "", "", ""],
              correctIndex: 0,
              answerKey: "",
              topic: "",
              subtopic: "",
              difficulty: "MEDIUM",
            },
          ]
    );

    setShowModal(true);
  };

  const updateAssessment = async () => {
    if (!editId) return;

    if (!safeStr(form.title).trim()) {
      fireTop({ icon: "warning", title: "Missing", text: "Please enter title" });
      return;
    }

    if (!buildItemsPayload().length) {
      fireTop({ icon: "warning", title: "Missing", text: "Please add at least 1 valid question" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildUpsertPayload();
      await api.put(`/admission-assessments/${editId}`, payload);

      await closeModal();

      fireTop({
        icon: "success",
        title: "Updated",
        text: "Assessment updated successfully",
        timer: 1400,
        showConfirmButton: false,
      });

      await fetchAssessments();
      await fetchAssessmentById(editId);
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || e?.response?.data?.details || "Failed to update assessment",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- delete / publish ---------------- */

  const deleteAssessment = async (id) => {
    if (!id) return;

    const r = await fireTop({
      title: "Delete assessment?",
      text: "This will permanently delete the assessment and its questions.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    });

    if (!r.isConfirmed) return;

    try {
      await api.delete(`/admission-assessments/${id}`);

      fireTop({
        icon: "success",
        title: "Deleted",
        timer: 1200,
        showConfirmButton: false,
      });

      if (Number(activeAssessmentId) === Number(id)) {
        setActiveAssessmentId(null);
        setActiveAssessment(null);
      }

      await fetchAssessments();
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || "Delete failed",
      });
    }
  };

  const publishAssessment = async (id) => {
    if (!id) return;
    try {
      await api.post(`/admission-assessments/${id}/publish`);

      fireTop({
        icon: "success",
        title: "Published",
        text: "Assessment published successfully",
      });

      await fetchAssessments();
      await fetchAssessmentById(id);
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || "Publish failed",
      });
    }
  };

  /* ---------------- create student login ---------------- */

  const createStudentLogin = async () => {
    if (!safeStr(loginForm.name).trim() || !safeStr(loginForm.username).trim() || !safeStr(loginForm.password).trim()) {
      fireTop({
        icon: "warning",
        title: "Missing",
        text: "Name, username and password are required.",
      });
      return;
    }

    setLoginSaving(true);
    try {
      const payload = {
        name: safeStr(loginForm.name).trim(),
        username: safeStr(loginForm.username).trim(),
        email: safeStr(loginForm.email).trim() || null,
        password: safeStr(loginForm.password),
        admission_number: safeStr(loginForm.admission_number).trim() || null,
      };

      await api.post("/admission-assessments/create-student-login", payload);

      fireTop({
        icon: "success",
        title: "Success",
        text: "Student login created successfully",
      });

      closeLoginModal();
    } catch (e) {
      fireTop({
        icon: "error",
        title: "Error",
        text: e?.response?.data?.message || e?.response?.data?.details || "Failed to create student login",
      });
    } finally {
      setLoginSaving(false);
    }
  };

  return (
    <div className="container-fluid py-3">
      <Row className="g-3 align-items-center mb-2">
        <Col xs={12} md={7}>
          <div>
            <h4 className="mb-0">Admission Assessments</h4>
            <div className="text-muted small">
              Create, manage, publish and analyze admission test papers.
            </div>
          </div>
        </Col>

        <Col xs={12} md={5} className="d-flex justify-content-md-end gap-2 flex-wrap">
          <Button variant="outline-dark" onClick={openLoginModal}>
            + Student Login
          </Button>
          <Button variant="primary" onClick={openCreate}>
            + Create Assessment
          </Button>
          <Button variant="outline-secondary" onClick={fetchAssessments} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </Col>
      </Row>

      <Card className="shadow-sm border-0 mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col xs={12} md={3}>
              <Form.Label className="small mb-1">Applying Class</Form.Label>
              <Form.Select
                value={filters.applyingClassId}
                onChange={(e) => setFilters((p) => ({ ...p, applyingClassId: e.target.value }))}
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {getClassName(c)}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={3}>
              <Form.Label className="small mb-1">Subject</Form.Label>
              <Form.Select
                value={filters.subjectId}
                onChange={(e) => setFilters((p) => ({ ...p, subjectId: e.target.value }))}
              >
                <option value="">All Subjects</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getSubjectName(s)}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={3}>
              <Form.Label className="small mb-1">Syllabus</Form.Label>
              <Form.Select
                value={filters.admissionSyllabusId}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, admissionSyllabusId: e.target.value }))
                }
              >
                <option value="">All Syllabus</option>
                {syllabusList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getSyllabusName(s)}
                  </option>
                ))}
              </Form.Select>
            </Col>

            <Col xs={12} md={2}>
              <Form.Label className="small mb-1">Status</Form.Label>
              <Form.Select
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="">All</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </Form.Select>
            </Col>

            <Col xs={12} md={1} className="d-flex align-items-end">
              <Button
                className="w-100"
                variant="dark"
                onClick={fetchAssessments}
                disabled={loading}
              >
                Go
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-3">
        {!leftCollapsed && (
          <Col xs={12} lg={4}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Assessments</div>
                <div className="d-flex align-items-center gap-2">
                  <div className="text-muted small">
                    {assessments.length} item{assessments.length === 1 ? "" : "s"}
                  </div>
                  <Button size="sm" variant="outline-secondary" onClick={() => setLeftCollapsed(true)}>
                    Hide
                  </Button>
                </div>
              </Card.Header>

              <Card.Body>
                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Loading...
                  </div>
                ) : !assessments.length ? (
                  <div className="text-muted">No admission assessments found.</div>
                ) : (
                  <div className="d-grid gap-2">
                    {assessments.map((ev) => (
                      <Button
                        key={ev.id}
                        variant={
                          Number(activeAssessmentId) === Number(ev.id) ? "dark" : "outline-dark"
                        }
                        className="text-start"
                        onClick={() => setActiveAssessmentId(ev.id)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="fw-semibold">
                            {safeStr(ev.title || `Assessment #${ev.id}`)}
                          </div>
                          <div className="d-flex gap-2">
                            <Badge bg={typeBadge(ev.type)}>{asUpper(ev.type || "-")}</Badge>
                            <Badge bg={statusBadge(ev.status)}>
                              {asUpper(ev.status || "DRAFT")}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-muted small mt-1">
                          Marks: {ev.total_marks ?? ev.totalMarks ?? "-"} • Time:{" "}
                          {ev.duration_minutes ?? ev.durationMinutes ?? "-"} min
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        )}

        <Col xs={12} lg={leftCollapsed ? 12 : 8}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <div className="fw-semibold">Details</div>
                {leftCollapsed && (
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => setLeftCollapsed(false)}
                  >
                    Show Assessments
                  </Button>
                )}
              </div>

              <div className="d-flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  disabled={!activeAssessmentId || activeLoading}
                  onClick={() => fetchAssessmentById(activeAssessmentId)}
                >
                  Reload
                </Button>

                <Button
                  size="sm"
                  variant="outline-primary"
                  disabled={!activeAssessmentId || analyticsBusy}
                  onClick={() => loadAnalytics(activeAssessmentId)}
                >
                  {analyticsBusy ? "Analytics..." : "Analytics"}
                </Button>

                <Button
                  size="sm"
                  variant="outline-info"
                  disabled={!activeAssessmentId || attemptsBusy}
                  onClick={() => loadAttempts(activeAssessmentId)}
                >
                  {attemptsBusy ? "Attempts..." : "Attempts"}
                </Button>

                <Button
                  size="sm"
                  variant="outline-dark"
                  disabled={!activeAssessmentId}
                  onClick={() => downloadAssessmentPdf(activeAssessmentId, false)}
                >
                  📄 PDF
                </Button>

                <Button
                  size="sm"
                  variant="dark"
                  disabled={!activeAssessmentId}
                  onClick={() => downloadAssessmentPdf(activeAssessmentId, true)}
                >
                  📄 Answers
                </Button>

                <Button
                  size="sm"
                  variant="primary"
                  disabled={!activeAssessmentId || !canEditActive}
                  onClick={openEdit}
                >
                  Edit
                </Button>

                <Button
                  size="sm"
                  variant="outline-danger"
                  disabled={!activeAssessmentId}
                  onClick={() => deleteAssessment(activeAssessmentId)}
                >
                  Delete
                </Button>

                <Button
                  size="sm"
                  variant="success"
                  disabled={!activeAssessmentId || asUpper(activeAssessment?.status) === "PUBLISHED"}
                  onClick={() => publishAssessment(activeAssessmentId)}
                >
                  Publish
                </Button>
              </div>
            </Card.Header>

            <Card.Body>
              {!activeAssessmentId ? (
                <div className="text-muted">Select an assessment from the left.</div>
              ) : activeLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" className="me-2" />
                  Loading...
                </div>
              ) : !activeAssessment ? (
                <div className="text-muted">Assessment not found.</div>
              ) : (
                <>
                  <Row className="g-2 mb-3">
                    <Col xs={12} md={7}>
                      <div className="fw-semibold">{safeStr(activeAssessment.title)}</div>
                      <div className="text-muted small">
                        Assessment ID: #{activeAssessment.id}
                      </div>
                    </Col>

                    <Col xs={12} md={5} className="d-flex justify-content-md-end gap-2 flex-wrap">
                      <Badge bg={typeBadge(activeAssessment.type)} className="px-3 py-2">
                        {asUpper(activeAssessment.type)}
                      </Badge>
                      <Badge bg={statusBadge(activeAssessment.status)} className="px-3 py-2">
                        {asUpper(activeAssessment.status || "DRAFT")}
                      </Badge>
                      <Badge bg="light" text="dark" className="px-3 py-2">
                        Marks: {activeAssessment.total_marks ?? activeAssessment.totalMarks ?? "-"}
                      </Badge>
                      <Badge bg="light" text="dark" className="px-3 py-2">
                        Time: {activeAssessment.duration_minutes ?? activeAssessment.durationMinutes ?? "-"} min
                      </Badge>
                    </Col>
                  </Row>

                  <Row className="g-2 mb-3">
                    <Col xs={12} md={4}>
                      <Card className="border-0 bg-light">
                        <Card.Body className="py-2">
                          <div className="text-muted small">Applying Class</div>
                          <div className="fw-semibold">
                            {safeStr(
                              activeAssessment?.applyingClass?.class_name ||
                                activeAssessment?.ApplyingClass?.class_name ||
                                activeAssessment?.applyingClass?.name ||
                                activeAssessment?.ApplyingClass?.name ||
                                "-"
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col xs={12} md={4}>
                      <Card className="border-0 bg-light">
                        <Card.Body className="py-2">
                          <div className="text-muted small">Base Class</div>
                          <div className="fw-semibold">
                            {safeStr(
                              activeAssessment?.baseClass?.class_name ||
                                activeAssessment?.BaseClass?.class_name ||
                                activeAssessment?.baseClass?.name ||
                                activeAssessment?.BaseClass?.name ||
                                "-"
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>

                    <Col xs={12} md={4}>
                      <Card className="border-0 bg-light">
                        <Card.Body className="py-2">
                          <div className="text-muted small">Subject</div>
                          <div className="fw-semibold">
                            {safeStr(
                              activeAssessment?.subject?.subject_name ||
                                activeAssessment?.subject?.name ||
                                activeAssessment?.Subject?.subject_name ||
                                activeAssessment?.Subject?.name ||
                                "-"
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {safeStr(activeAssessment.instructions).trim() ? (
                    <Card className="border-0 bg-light mb-3">
                      <Card.Body className="py-2">
                        <div className="text-muted small mb-1">Instructions</div>
                        <div className="small">{safeStr(activeAssessment.instructions)}</div>
                      </Card.Body>
                    </Card>
                  ) : null}

                  <Accordion activeKey={openKeys} alwaysOpen onSelect={() => {}}>
                    <Accordion.Item eventKey="0">
                      <Accordion.Header
                        onClick={() =>
                          setOpenKeys((prev) =>
                            prev.includes("0")
                              ? prev.filter((k) => k !== "0")
                              : [...prev, "0"]
                          )
                        }
                      >
                        Questions ({activeItems.length})
                      </Accordion.Header>
                      <Accordion.Body>
                        {!activeItems.length ? (
                          <div className="text-muted">No items found for this assessment.</div>
                        ) : (
                          <div className="table-responsive">
                            <Table className="mb-0 align-middle" hover>
                              <thead className="table-light">
                                <tr>
                                  <th style={{ width: 70 }}>#</th>
                                  <th>Question</th>
                                  <th style={{ width: 120 }}>Type</th>
                                  <th style={{ width: 100 }}>Marks</th>
                                  <th style={{ width: 120 }}>Difficulty</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activeItems.map((it, idx) => (
                                  <tr key={it.id || `${idx}`}>
                                    <td className="text-muted">{idx + 1}</td>
                                    <td>
                                      <div className="fw-semibold">{safeStr(it.question || "-")}</div>

                                      <div className="text-muted small mt-1" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                                        {[safeStr(it.topic), safeStr(it.subtopic)]
                                          .filter(Boolean)
                                          .join(" • ")}
                                      </div>

                                      {Array.isArray(it.options) && it.options.length ? (
                                        <div className="text-muted small mt-2" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                                          {it.options.map((o, i) => (
                                            <div key={i}>
                                              {String.fromCharCode(65 + i)}. {safeStr(o)}
                                              {it.correctIndex != null && Number(it.correctIndex) === i ? (
                                                <Badge bg="success" className="ms-2">
                                                  Correct
                                                </Badge>
                                              ) : null}
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}

                                      {safeStr(it.answer_key || it.answerKey).trim() ? (
                                        <div className="text-muted small mt-2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                          <b>Answer Key:</b> {safeStr(it.answer_key || it.answerKey)}
                                        </div>
                                      ) : null}
                                    </td>
                                    <td>
                                      <Badge bg={itemTypeBadge(it.type)}>
                                        {asUpper(it.type || "-")}
                                      </Badge>
                                    </td>
                                    <td className="fw-semibold">{it.marks ?? "-"}</td>
                                    <td>{safeStr(it.difficulty || "-")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        )}

                        {!canEditActive ? (
                          <div className="text-muted small mt-2">
                            Items are locked because this assessment is{" "}
                            <b>{asUpper(activeAssessment.status)}</b>.
                          </div>
                        ) : (
                          <div className="text-muted small mt-2">
                            You can edit because this assessment is DRAFT.
                          </div>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey="1">
                      <Accordion.Header
                        onClick={() =>
                          setOpenKeys((prev) =>
                            prev.includes("1")
                              ? prev.filter((k) => k !== "1")
                              : [...prev, "1"]
                          )
                        }
                      >
                        Analytics
                      </Accordion.Header>
                      <Accordion.Body>
                        {!analytics ? (
                          <div className="text-muted">
                            Click <b>Analytics</b> button on top to load summary.
                          </div>
                        ) : (
                          <Row className="g-3">
                            <Col xs={12} md={3}>
                              <Card className="border-0 bg-light">
                                <Card.Body className="py-3">
                                  <div className="text-muted small">Attempts</div>
                                  <div className="fs-4 fw-bold">{analytics.attempts ?? 0}</div>
                                </Card.Body>
                              </Card>
                            </Col>

                            <Col xs={12} md={3}>
                              <Card className="border-0 bg-light">
                                <Card.Body className="py-3">
                                  <div className="text-muted small">Average %</div>
                                  <div className="fs-4 fw-bold">
                                    {analytics.averagePercent != null
                                      ? `${analytics.averagePercent}%`
                                      : "-"}
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>

                            <Col xs={12} md={3}>
                              <Card className="border-0 bg-light">
                                <Card.Body className="py-3">
                                  <div className="text-muted small">Pass Count</div>
                                  <div className="fs-4 fw-bold">{analytics.passCount ?? 0}</div>
                                </Card.Body>
                              </Card>
                            </Col>

                            <Col xs={12} md={3}>
                              <Card className="border-0 bg-light">
                                <Card.Body className="py-3">
                                  <div className="text-muted small">Fail Count</div>
                                  <div className="fs-4 fw-bold">{analytics.failCount ?? 0}</div>
                                </Card.Body>
                              </Card>
                            </Col>

                            <Col xs={12} md={7}>
                              <Card className="border-0 shadow-sm">
                                <Card.Header className="bg-white fw-semibold">
                                  Marks Summary
                                </Card.Header>
                                <Card.Body style={{ height: 280 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analyticsChart.barData}>
                                      <XAxis dataKey="name" />
                                      <YAxis allowDecimals={false} />
                                      <Tooltip />
                                      <Bar dataKey="value" />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </Card.Body>
                              </Card>
                            </Col>

                            <Col xs={12} md={5}>
                              <Card className="border-0 shadow-sm">
                                <Card.Header className="bg-white fw-semibold">
                                  Pass / Fail
                                </Card.Header>
                                <Card.Body style={{ height: 280 }}>
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie
                                        data={analyticsChart.pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        outerRadius={90}
                                        label
                                      >
                                        {analyticsChart.pieData.map((_, i) => (
                                          <Cell key={i} />
                                        ))}
                                      </Pie>
                                      <Tooltip />
                                      <Legend />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </Card.Body>
                              </Card>
                            </Col>

                            <Col xs={12}>
                              <Card className="border-0 bg-light">
                                <Card.Body className="py-2 d-flex flex-wrap gap-3">
                                  <div className="small text-muted">
                                    Highest: <b>{analytics.highestMarks ?? "-"}</b>
                                  </div>
                                  <div className="small text-muted">
                                    Lowest: <b>{analytics.lowestMarks ?? "-"}</b>
                                  </div>
                                  <div className="small text-muted">
                                    Total Marks: <b>{analytics.totalMarks ?? activeAssessment?.total_marks ?? activeAssessment?.totalMarks ?? "-"}</b>
                                  </div>
                                  <div className="small text-muted">
                                    Passing Marks: <b>{analytics.passingMarks ?? activeAssessment?.passing_marks ?? activeAssessment?.passingMarks ?? "-"}</b>
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                          </Row>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey="2">
                      <Accordion.Header
                        onClick={() =>
                          setOpenKeys((prev) =>
                            prev.includes("2")
                              ? prev.filter((k) => k !== "2")
                              : [...prev, "2"]
                          )
                        }
                      >
                        Attempts / Results
                      </Accordion.Header>
                      <Accordion.Body>
                        {!attempts.length ? (
                          <div className="text-muted">
                            Click <b>Attempts</b> button on top to load candidate results.
                          </div>
                        ) : (
                          <div className="table-responsive">
                            <Table hover className="align-middle">
                              <thead className="table-light">
                                <tr>
                                  <th style={{ width: 70 }}>#</th>
                                  <th>Candidate</th>
                                  <th style={{ width: 160 }}>Admission No</th>
                                  <th style={{ width: 140 }}>Status</th>
                                  <th style={{ width: 170 }}>Marks</th>
                                  <th style={{ minWidth: 220 }}>Progress</th>
                                  <th style={{ width: 120 }}>Result</th>
                                </tr>
                              </thead>
                              <tbody>
                                {attemptsProgressRows.map((r, idx) => {
                                  const passLine =
                                    Number(
                                      activeAssessment?.passing_marks ??
                                        activeAssessment?.passingMarks ??
                                        0
                                    ) || 0;

                                  const isPass = Number(r.obtained || 0) >= passLine;

                                  return (
                                    <tr key={r.id || idx}>
                                      <td className="text-muted">{idx + 1}</td>
                                      <td>
                                        <div className="fw-semibold">
                                          {safeStr(r?.User?.name || r?.user?.name || "-")}
                                        </div>
                                        <div className="text-muted small">
                                          {safeStr(r?.User?.username || r?.user?.username || "-")}
                                        </div>
                                      </td>
                                      <td>
                                        {safeStr(
                                          r?.User?.admission_number ||
                                            r?.user?.admission_number ||
                                            "-"
                                        )}
                                      </td>
                                      <td>
                                        <Badge bg={asUpper(r.status) === "EVALUATED" ? "success" : "secondary"}>
                                          {safeStr(r.status || "-")}
                                        </Badge>
                                      </td>
                                      <td className="fw-semibold">
                                        {r.obtained}/{r.total}
                                      </td>
                                      <td>
                                        <ProgressBar now={r.percent} label={`${r.percent}%`} />
                                      </td>
                                      <td>
                                        <Badge bg={isPass ? "success" : "danger"}>
                                          {isPass ? "PASS" : "FAIL"}
                                        </Badge>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </Table>
                          </div>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  </Accordion>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create/Edit Modal */}
      <Modal
        show={showModal}
        onHide={closeModal}
        size="xl"
        centered
        backdrop="static"
        keyboard={false}
        fullscreen="md-down"
        contentClassName="border-0"
      >
        <Modal.Header closeButton className="bg-white">
          <div className="w-100">
            <Modal.Title className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <span>
                {editing ? "Edit Admission Assessment" : "Create Admission Assessment"}
              </span>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Badge bg={aiEnabled ? "success" : "secondary"} className="px-2 py-1">
                  AI: {aiEnabled ? "Ready" : "Need Syllabus / Class / Subject"}
                </Badge>

                <Form.Select
                  size="sm"
                  value={aiMode}
                  onChange={(e) => setAiMode(e.target.value)}
                  style={{ width: 120 }}
                  disabled={aiBusy}
                  title="AI Mode"
                >
                  <option value="APPEND">Append</option>
                  <option value="REPLACE">Replace</option>
                </Form.Select>

                <Form.Select
                  size="sm"
                  value={aiLanguage}
                  onChange={(e) => setAiLanguage(e.target.value)}
                  style={{ width: 110 }}
                  disabled={aiBusy}
                  title="Language"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="pa">Punjabi</option>
                </Form.Select>

                <Form.Select
                  size="sm"
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(e.target.value)}
                  style={{ width: 120 }}
                  disabled={aiBusy}
                  title="Difficulty"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </Form.Select>

                <InputGroup size="sm" style={{ width: 140 }}>
                  <InputGroup.Text>#</InputGroup.Text>
                  <Form.Control
                    type="number"
                    min={1}
                    max={100}
                    value={aiQuestionCount}
                    onChange={(e) => setAiQuestionCount(e.target.value)}
                    disabled={aiBusy}
                    title="Questions count"
                  />
                </InputGroup>

                <Button
                  size="sm"
                  variant={aiEnabled ? "outline-dark" : "outline-secondary"}
                  disabled={!aiEnabled || aiBusy}
                  onClick={generateQuestionsWithAI}
                  title="Generate AI questions preview"
                >
                  {aiBusy ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      AI...
                    </>
                  ) : (
                    "✨ AI Questions"
                  )}
                </Button>

                {!editing ? (
                  <Button
                    size="sm"
                    variant={aiEnabled ? "dark" : "outline-secondary"}
                    disabled={!aiEnabled || aiBusy}
                    onClick={generateAndSaveWithAI}
                    title="Generate and save full assessment using AI"
                  >
                    {aiBusy ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        AI...
                      </>
                    ) : (
                      "✨ AI Generate & Save"
                    )}
                  </Button>
                ) : null}
              </div>
            </Modal.Title>

            <div className="text-muted small mt-1">
              Tip: You can use <b>AI Questions</b> to fill question list first, or{" "}
              {!editing ? <b>AI Generate & Save</b> : <b>manual update</b>}.
            </div>
          </div>
        </Modal.Header>

        <Modal.Body style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <Row className="g-3">
            <Col xs={12} lg={5}>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <div className="fw-semibold mb-2">Assessment Settings</div>

                  <Row className="g-2">
                    <Col xs={12}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Title *</Form.Label>
                        <Form.Control
                          value={form.title}
                          onChange={(e) => onForm("title", e.target.value)}
                          placeholder="e.g. Class 5 English Admission Test"
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Admission Syllabus *</Form.Label>
                        <Form.Select
                          value={form.admissionSyllabusId}
                          onChange={(e) => onForm("admissionSyllabusId", e.target.value)}
                        >
                          <option value="">Select</option>
                          {syllabusList.map((s) => (
                            <option key={s.id} value={s.id}>
                              {getSyllabusName(s)}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Applying Class *</Form.Label>
                        <Form.Select
                          value={form.applyingClassId}
                          onChange={(e) => onForm("applyingClassId", e.target.value)}
                        >
                          <option value="">Select</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {getClassName(c)}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Base Class</Form.Label>
                        <Form.Select
                          value={form.baseClassId}
                          onChange={(e) => onForm("baseClassId", e.target.value)}
                        >
                          <option value="">Select</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {getClassName(c)}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Subject *</Form.Label>
                        <Form.Select
                          value={form.subjectId}
                          onChange={(e) => onForm("subjectId", e.target.value)}
                        >
                          <option value="">Select</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {getSubjectName(s)}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Type</Form.Label>
                        <Form.Select
                          value={form.type}
                          onChange={(e) => onForm("type", e.target.value)}
                        >
                          <option value="OBJECTIVE">OBJECTIVE</option>
                          <option value="SUBJECTIVE">SUBJECTIVE</option>
                          <option value="MIXED">MIXED</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col xs={6} md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Total Marks</Form.Label>
                        <Form.Control
                          type="number"
                          min={0}
                          value={form.totalMarks}
                          onChange={(e) => onForm("totalMarks", e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={6} md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Time (min)</Form.Label>
                        <Form.Control
                          type="number"
                          min={0}
                          value={form.durationMinutes}
                          onChange={(e) => onForm("durationMinutes", e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={6} md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Passing Marks</Form.Label>
                        <Form.Control
                          type="number"
                          min={0}
                          value={form.passingMarks}
                          onChange={(e) => onForm("passingMarks", e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={6} md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Max Attempts</Form.Label>
                        <Form.Control
                          type="number"
                          min={1}
                          value={form.maxAttempts}
                          onChange={(e) => onForm("maxAttempts", e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={12} md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Academic Session</Form.Label>
                        <Form.Control
                          value={form.academicSession}
                          onChange={(e) => onForm("academicSession", e.target.value)}
                          placeholder="2025-26"
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={12}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Description</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={2}
                          value={form.description}
                          onChange={(e) => onForm("description", e.target.value)}
                        />
                      </Form.Group>
                    </Col>

                    <Col xs={12}>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Instructions</Form.Label>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={form.instructions}
                          onChange={(e) => onForm("instructions", e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-2 mt-1">
                    <Col xs={12} md={6}>
                      <Form.Check
                        type="switch"
                        label="Allow Retake"
                        checked={!!form.allowRetake}
                        onChange={(e) => onForm("allowRetake", e.target.checked)}
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Check
                        type="switch"
                        label="Show Result Instantly"
                        checked={!!form.showResultInstantly}
                        onChange={(e) => onForm("showResultInstantly", e.target.checked)}
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Check
                        type="switch"
                        label="Shuffle Questions"
                        checked={!!form.shuffleQuestions}
                        onChange={(e) => onForm("shuffleQuestions", e.target.checked)}
                      />
                    </Col>

                    <Col xs={12} md={6}>
                      <Form.Check
                        type="switch"
                        label="Shuffle Options"
                        checked={!!form.shuffleOptions}
                        onChange={(e) => onForm("shuffleOptions", e.target.checked)}
                      />
                    </Col>
                  </Row>

                  <Card className="border-0 bg-light mt-3">
                    <Card.Body className="py-2">
                      <div className="text-muted small">Items Total (auto)</div>
                      <div className="fw-semibold">{computedTotalMarks} marks</div>
                    </Card.Body>
                  </Card>

                  <div className="d-flex gap-2 flex-wrap mt-3">
                    <Button size="sm" variant="outline-primary" onClick={() => addItem("MCQ")}>
                      + MCQ
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => addItem("TRUE_FALSE")}>
                      + True/False
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => addItem("FILL_BLANKS")}>
                      + Fill Blanks
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => addItem("SHORT")}>
                      + Short
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => addItem("LONG")}>
                      + Long
                    </Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => addItem("SUBJECTIVE")}>
                      + Subjective
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} lg={7}>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white fw-semibold d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <span>Questions</span>
                  <span className="text-muted small">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </Card.Header>
                <Card.Body>
                  {!items.length ? (
                    <div className="text-muted">No items yet.</div>
                  ) : (
                    <div className="d-grid gap-3">
                      {items.map((it, idx) => (
                        <Card key={it.tempId} className="border">
                          <Card.Body>
                            <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                              <div className="fw-semibold">
                                Q{idx + 1}{" "}
                                <Badge bg={itemTypeBadge(it.type)} className="ms-2">
                                  {asUpper(it.type)}
                                </Badge>
                              </div>

                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <Form.Select
                                  value={it.difficulty || "MEDIUM"}
                                  onChange={(e) =>
                                    patchItem(it.tempId, { difficulty: e.target.value })
                                  }
                                  style={{ width: 120 }}
                                >
                                  <option value="EASY">Easy</option>
                                  <option value="MEDIUM">Medium</option>
                                  <option value="HARD">Hard</option>
                                </Form.Select>

                                <Form.Control
                                  type="number"
                                  min={0}
                                  value={it.marks}
                                  onChange={(e) => patchItem(it.tempId, { marks: e.target.value })}
                                  style={{ width: 110 }}
                                  title="Marks"
                                />

                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => removeItem(it.tempId)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>

                            <Form.Group className="mt-2">
                              <Form.Label className="small">Question</Form.Label>
                              <Form.Control
                                as="textarea"
                                rows={2}
                                value={it.question}
                                onChange={(e) => patchItem(it.tempId, { question: e.target.value })}
                              />
                            </Form.Group>

                            <Row className="g-2 mt-2">
                              <Col xs={12} md={6}>
                                <Form.Group>
                                  <Form.Label className="small">Topic</Form.Label>
                                  <Form.Control
                                    value={it.topic || ""}
                                    onChange={(e) => patchItem(it.tempId, { topic: e.target.value })}
                                  />
                                </Form.Group>
                              </Col>

                              <Col xs={12} md={6}>
                                <Form.Group>
                                  <Form.Label className="small">Subtopic</Form.Label>
                                  <Form.Control
                                    value={it.subtopic || ""}
                                    onChange={(e) =>
                                      patchItem(it.tempId, { subtopic: e.target.value })
                                    }
                                  />
                                </Form.Group>
                              </Col>
                            </Row>

                            {["MCQ", "TRUE_FALSE"].includes(asUpper(it.type)) ? (
                              <>
                                <div className="text-muted small mt-2 mb-1">Options</div>
                                <Row className="g-2">
                                  {(it.options || []).map((op, i) => (
                                    <Col xs={12} md={6} key={i}>
                                      <Form.Control
                                        value={op}
                                        onChange={(e) =>
                                          patchOption(it.tempId, i, e.target.value)
                                        }
                                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                      />
                                    </Col>
                                  ))}
                                </Row>

                                <Row className="g-2 mt-2">
                                  <Col xs={12} md={6}>
                                    <Form.Group>
                                      <Form.Label className="small">Correct Option</Form.Label>
                                      <Form.Select
                                        value={it.correctIndex}
                                        onChange={(e) =>
                                          patchItem(it.tempId, { correctIndex: e.target.value })
                                        }
                                      >
                                        {(it.options || []).map((_, i) => (
                                          <option key={i} value={i}>
                                            {String.fromCharCode(65 + i)}
                                          </option>
                                        ))}
                                      </Form.Select>
                                    </Form.Group>
                                  </Col>
                                </Row>
                              </>
                            ) : (
                              <Form.Group className="mt-2">
                                <Form.Label className="small">Answer Key</Form.Label>
                                <Form.Control
                                  as="textarea"
                                  rows={2}
                                  value={it.answerKey || ""}
                                  onChange={(e) =>
                                    patchItem(it.tempId, { answerKey: e.target.value })
                                  }
                                />
                              </Form.Group>
                            )}
                          </Card.Body>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Modal.Body>

        <Modal.Footer className="bg-white">
          <Button variant="outline-secondary" onClick={closeModal} disabled={saving || aiBusy}>
            Cancel
          </Button>

          {!editing ? (
            <Button
              variant="dark"
              onClick={generateAndSaveWithAI}
              disabled={aiBusy || saving || !aiEnabled}
            >
              {aiBusy ? "AI..." : "✨ AI Generate & Save"}
            </Button>
          ) : null}

          <Button
            variant="primary"
            onClick={editing ? updateAssessment : createAssessment}
            disabled={saving || aiBusy}
          >
            {saving
              ? editing
                ? "Updating..."
                : "Creating..."
              : editing
              ? "Update Assessment"
              : "Create Assessment"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Student Login Modal */}
      <Modal show={showLoginModal} onHide={closeLoginModal} centered contentClassName="border-0">
        <Modal.Header closeButton className="bg-white">
          <Modal.Title>Create Student Login</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label className="small">Name *</Form.Label>
            <Form.Control
              value={loginForm.name}
              onChange={(e) => onLoginForm("name", e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label className="small">Username *</Form.Label>
            <Form.Control
              value={loginForm.username}
              onChange={(e) => onLoginForm("username", e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label className="small">Email</Form.Label>
            <Form.Control
              value={loginForm.email}
              onChange={(e) => onLoginForm("email", e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label className="small">Password *</Form.Label>
            <Form.Control
              type="text"
              value={loginForm.password}
              onChange={(e) => onLoginForm("password", e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label className="small">Admission Number</Form.Label>
            <Form.Control
              value={loginForm.admission_number}
              onChange={(e) => onLoginForm("admission_number", e.target.value)}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer className="bg-white">
          <Button variant="outline-secondary" onClick={closeLoginModal} disabled={loginSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={createStudentLogin} disabled={loginSaving}>
            {loginSaving ? "Creating..." : "Create Login"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdmissionAssessments;