  // src/pages/LessonPlanEvaluations.jsx
  import React, { useEffect, useMemo, useState } from "react";
  import { useNavigate, useParams } from "react-router-dom";
  import api from "../api";
  import Swal from "sweetalert2";
  import {
    Badge,
    Button,
    Card,
    Col,
    Form,
    Modal,
    Row,
    Spinner,
    Table,
    Accordion,
    InputGroup,
    ProgressBar,
    Tabs,
    Tab,
  } from "react-bootstrap";

  // ✅ Charts
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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

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
      case "SUBJECTIVE":
        return "secondary";
      case "SHORT":
        return "dark";
      case "LONG":
        return "dark";
      case "FILL_BLANKS":
        return "info";
      case "MATCH":
        return "info";
      default:
        return "secondary";
    }
  };

  // ✅ normalize list response
  const normalizeList = (d) => {
    if (Array.isArray(d)) return d;
    const candidates = [
      d?.rows,
      d?.data?.rows,
      d?.data,
      d?.evaluations,
      d?.items,
      d?.result,
      d?.results,
      d?.data?.results,
      d?.evaluation ? [d.evaluation] : null,
    ].filter(Boolean);
    for (const c of candidates) if (Array.isArray(c)) return c;
    return [];
  };

  const safeJsonParse = (v, fallback) => {
    if (v == null) return fallback;
    if (Array.isArray(v)) return v;
    if (typeof v !== "string") return fallback;
    try {
      return JSON.parse(v);
    } catch {
      return fallback;
    }
  };

  const normalizeEvalFromApi = (data) => {
    // backend returns { ok:true, evaluation }
    const ev = data?.evaluation ?? data?.data?.evaluation ?? data;
    if (!ev || typeof ev !== "object") return null;

    // config
    const config = ev.config ?? safeJsonParse(ev.configJson, null);

    // items
    const rawItems =
      ev.items ||
      ev.Items ||
      ev.EvaluationItems ||
      ev?.evaluation?.items ||
      ev?.evaluation?.Items ||
      [];

    const items = (Array.isArray(rawItems) ? rawItems : []).map((it) => {
      const options = Array.isArray(it.options) ? it.options : safeJsonParse(it.optionsJson, []);

      const correctIndex =
        it.correctIndex != null
          ? Number(it.correctIndex)
          : it.correctAnswer != null && String(it.correctAnswer).trim() !== ""
          ? Number(it.correctAnswer)
          : null;

      return {
        ...it,
        options,
        correctIndex: Number.isFinite(correctIndex) ? correctIndex : 0,
      };
    });

    return { ...ev, config, items, Items: items };
  };

  // ✅ students list normalizer
  const normalizeStudents = (d) => {
    if (Array.isArray(d)) return d;
    const candidates = [
      d?.rows,
      d?.data?.rows,
      d?.data?.students,
      d?.students,
      d?.data,
      d?.result,
      d?.items,
    ].filter(Boolean);
    for (const c of candidates) if (Array.isArray(c)) return c;
    return [];
  };

  const pickStudentRef = (s) => {
    const adm = safeStr(
      s?.admissionNo ||
        s?.admission_no ||
        s?.admission_number ||
        s?.admissionNumber ||
        s?.username ||
        s?.userName ||
        ""
    ).trim();

    if (adm) return adm;

    const id = s?.id != null ? String(s.id).trim() : "";
    return id || "";
  };

  const pickStudentName = (s) => {
    const name = safeStr(s?.name || s?.student_name || "").trim();
    if (name) return name;
    return pickStudentRef(s) ? `Student ${pickStudentRef(s)}` : "Student";
  };

  const pickStudentPhoto = (s) => {
    // try most useful keys first
    const raw =
      s?.studentPhotoUrl ||
      s?.photoUrl ||
      s?.photo_url ||
      s?.photo ||
      s?.profilePhoto ||
      s?.profile_photo ||
      s?.image ||
      s?.imageUrl ||
      s?.image_url ||
      s?.StudentPhoto ||
      "";

    const v = safeStr(raw).trim();
    if (!v) return "";

    // already absolute
    if (/^https?:\/\//i.test(v)) return v;

    // baseURL fallback
    const base =
      safeStr(api?.defaults?.baseURL || "").replace(/\/$/, "") ||
      window.location.origin.replace(/\/$/, "");

    // if already a path
    if (v.startsWith("/")) return `${base}${v}`;

    // ✅ filename -> uploads folder
    if (!v.includes("/")) return `${base}/uploads/photoes/students/${encodeURIComponent(v)}`;

    // otherwise treat as relative path
    return `${base}/${v}`;
  };

  const safeNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // ✅ helper: clamp percent safely
  const clampPercent = (p) => {
    const n = Number(p);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return Math.round(n);
  };

  /* ---------------- component ---------------- */

  const LessonPlanEvaluations = () => {
    const { lessonPlanId } = useParams();
    const navigate = useNavigate();

    // ✅ SweetAlert always on top
    const fireTop = (opts) => {
      return Swal.fire({
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
    };

    const [loading, setLoading] = useState(false);
    const [evals, setEvals] = useState([]);

    const [activeEvalId, setActiveEvalId] = useState(null);
    const [activeEval, setActiveEval] = useState(null);
    const [activeLoading, setActiveLoading] = useState(false);

    // ✅ LessonPlan meta
    const [planLoading, setPlanLoading] = useState(false);
    const [lessonPlan, setLessonPlan] = useState(null);

    // ✅ Create / Edit modal
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const [form, setForm] = useState({
      title: "",
      type: "OBJECTIVE",
      totalMarks: 20,
      timeMinutes: 30,
      instructions: "",
    });

    // items (questions)
    const [items, setItems] = useState([]);

    // analytics
    const [analyticsBusy, setAnalyticsBusy] = useState(false);
    const [analytics, setAnalytics] = useState(null);

    // ✅ Analytics UI control
    const [openKeys, setOpenKeys] = useState(["0"]); // which accordion items open
    const [analyticsTab, setAnalyticsTab] = useState("dashboard"); // dashboard | students | raw

    // ✅ AI (Questions generator)
    const [aiBusy, setAiBusy] = useState(false);
    const [aiMode, setAiMode] = useState("APPEND"); // APPEND | REPLACE
    const [aiCount, setAiCount] = useState(10);
    const [aiDifficulty, setAiDifficulty] = useState("MEDIUM"); // EASY | MEDIUM | HARD
    const [aiPreferMcqOnly, setAiPreferMcqOnly] = useState(true);

    // ✅ Students + Marks UI (AUTO LIST)
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [students, setStudents] = useState([]);
    const [studentSearch, setStudentSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState(""); // sectionId or ""
    const [marksMap, setMarksMap] = useState({}); // { [studentRef]: "12" }
    const [resultsSaving, setResultsSaving] = useState(false);
    const [resultsLoaded, setResultsLoaded] = useState(false);

    // ✅ NEW: AI Remarks
    const [remarksBusy, setRemarksBusy] = useState(false);
    const [remarksMap, setRemarksMap] = useState({}); // { [studentRef]: "remark..." }
    const [photoMap, setPhotoMap] = useState({});
    const [remarksLanguage, setRemarksLanguage] = useState("en"); // en | hi | pa

    // ✅ NEW: Student detail modal (full remarks + graphs)
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [selectedStudentRow, setSelectedStudentRow] = useState(null);
    // ✅ photo fallback handling (avoid permanent hide on error)
    const [photoBroken, setPhotoBroken] = useState(false);

    useEffect(() => {
      // reset broken state whenever modal opens or photoUrl changes
      setPhotoBroken(false);
    }, [showStudentModal, selectedStudentRow?.photoUrl]);

    const REMARK_PREVIEW = 80;
    const truncateText = (txt, max = REMARK_PREVIEW) => {
      const s = safeStr(txt).trim();
      if (!s) return "";
      if (s.length <= max) return s;
      return s.slice(0, max).trim() + "…";
    };

    const openStudentDetail = (row) => {
      setSelectedStudentRow(row || null);
      setShowStudentModal(true);
    };

    const closeStudentDetail = () => {
      setShowStudentModal(false);
      setSelectedStudentRow(null);
    };

    /* ---------------- derived ---------------- */

    const activeItems = useMemo(() => {
      const arr = activeEval?.items || activeEval?.Items || activeEval?.EvaluationItems || [];
      return Array.isArray(arr) ? arr : [];
    }, [activeEval]);

    const canEditActive = useMemo(() => {
      return asUpper(activeEval?.status || "DRAFT") === "DRAFT";
    }, [activeEval]);

    const computedTotalMarks = useMemo(() => {
      return (items || []).reduce((a, b) => a + (Number(b.marks) || 0), 0);
    }, [items]);

    const aiEnabled = useMemo(() => {
      const classId = Number(lessonPlan?.classId || 0);
      const subjectId = Number(lessonPlan?.subjectId || 0);
      const topic = safeStr(lessonPlan?.topic || "").trim();
      return !!classId && !!subjectId && !!topic;
    }, [lessonPlan]);

    const planSectionIds = useMemo(() => {
      const secs = lessonPlan?.Sections || lessonPlan?.sections || [];
      if (!Array.isArray(secs)) return [];
      return secs.map((s) => Number(s.id)).filter((n) => Number.isFinite(n) && n > 0);
    }, [lessonPlan]);

    const planSections = useMemo(() => {
      const secs = lessonPlan?.Sections || lessonPlan?.sections || [];
      return Array.isArray(secs) ? secs : [];
    }, [lessonPlan]);

    const filteredStudents = useMemo(() => {
      const q = safeStr(studentSearch).trim().toLowerCase();
      const secId = sectionFilter ? Number(sectionFilter) : null;

      return (students || []).filter((s) => {
        if (secId && Number(s?.section_id) !== secId && Number(s?.sectionId) !== secId) return false;
        if (!q) return true;

        const ref = pickStudentRef(s).toLowerCase();
        const name = pickStudentName(s).toLowerCase();
        const roll = safeStr(s?.roll_number || s?.rollNumber || "").toLowerCase();
        const sectionName = safeStr(
          s?.Section?.section_name || s?.Section?.name || s?.section_name || ""
        ).toLowerCase();

        return ref.includes(q) || name.includes(q) || roll.includes(q) || sectionName.includes(q);
      });
    }, [students, studentSearch, sectionFilter]);

    const marksStats = useMemo(() => {
      const total = filteredStudents.length;
      const filled = filteredStudents.reduce((acc, s) => {
        const ref = pickStudentRef(s);
        const v = marksMap?.[ref];
        const n = v === "" || v == null ? null : Number(v);
        return acc + (Number.isFinite(n) ? 1 : 0);
      }, 0);
      return { total, filled };
    }, [filteredStudents, marksMap]);

    // ✅ PASS MARKS (optional): use config.passMarks if exists, else 0
    const passMarks = useMemo(() => {
      const pm = activeEval?.config?.passMarks;
      const n = Number(pm);
      return Number.isFinite(n) ? n : 0;
    }, [activeEval]);

    // ✅ Students progress rows (based on current marksMap)
    const studentProgressRows = useMemo(() => {
      const total = Number(activeEval?.totalMarks || 0) || 0;

      const rows = (filteredStudents || []).map((s) => {
        const ref = pickStudentRef(s);
        const name = pickStudentName(s);

        const secName =
          safeStr(s?.Section?.section_name || s?.Section?.name || s?.section_name || "") ||
          (() => {
            const secId = s?.section_id || s?.sectionId || "";
            return secId ? `#${secId}` : "-";
          })();

        const raw = marksMap?.[ref];
        const marks = raw === "" || raw == null ? null : Number(raw);
        const valid = Number.isFinite(marks);
        const percent = valid && total > 0 ? clampPercent((marks / total) * 100) : null;

        const status = !valid ? "NA" : marks >= passMarks ? "PASS" : "FAIL";

        return {
          ref,
          name,
          section: secName,
          marks: valid ? marks : null,
          percent,
          status,
          remark: safeStr(remarksMap?.[ref] || "").trim() || null,
        };
      });

      rows.sort((a, b) => {
        const am = a.marks == null ? -9999 : a.marks;
        const bm = b.marks == null ? -9999 : b.marks;
        return bm - am;
      });

      return rows;
    }, [filteredStudents, marksMap, activeEval, passMarks, remarksMap]);

    // ✅ Charts data from marksMap (overall)
    const marksChartData = useMemo(() => {
      const total = Number(activeEval?.totalMarks || 0) || 0;
      if (!total) return { buckets: [], passFail: [], maxMarks: null, minMarks: null };

      const nums = studentProgressRows.map((r) => r.marks).filter((n) => Number.isFinite(n));

      const maxMarks = nums.length ? Math.max(...nums) : null;
      const minMarks = nums.length ? Math.min(...nums) : null;

      const bucketSize = Math.max(1, Math.round(total * 0.1));
      const bucketCount = Math.max(1, Math.ceil(total / bucketSize));

      const buckets = Array.from({ length: bucketCount }, (_, i) => {
        const from = i * bucketSize;
        const to = Math.min(total, (i + 1) * bucketSize);
        return { name: `${from}-${to}`, count: 0 };
      });

      nums.forEach((m) => {
        const idx = Math.min(bucketCount - 1, Math.floor(m / bucketSize));
        buckets[idx].count += 1;
      });

      const pass = nums.filter((m) => m >= passMarks).length;
      const fail = nums.length - pass;

      return {
        buckets,
        passFail: [
          { name: "Pass", value: pass },
          { name: "Fail", value: fail },
        ],
        maxMarks,
        minMarks,
      };
    }, [studentProgressRows, activeEval, passMarks]);

    const canGenerateRemarks = useMemo(() => {
      if (!activeEvalId) return false;
      const total = Number(activeEval?.totalMarks || 0) || 0;
      if (total <= 0) return false;
      // need at least 1 marks filled
      const any = Object.values(marksMap || {}).some(
        (v) => v != null && v !== "" && Number.isFinite(Number(v))
      );
      return any;
    }, [activeEvalId, activeEval, marksMap]);

    /* ---------------- data fetch ---------------- */

    const fetchLessonPlanMeta = async () => {
      if (!lessonPlanId) return;
      setPlanLoading(true);
      try {
        const res = await api.get(`/lesson-plans/${lessonPlanId}`);
        const lp = res?.data?.lessonPlan ?? res?.data;
        setLessonPlan(lp || null);
      } catch {
        setLessonPlan(null);
      } finally {
        setPlanLoading(false);
      }
    };

    const fetchEvaluations = async () => {
      if (!lessonPlanId) return;
      setLoading(true);
      try {
        const res = await api.get(`/lesson-plans/${lessonPlanId}/evaluations`, {
          params: { includeDraft: 1 },
        });
        const list = normalizeList(res.data);
        setEvals(list);

        if (activeEvalId && !list.some((x) => Number(x?.id) === Number(activeEvalId))) {
          setActiveEvalId(null);
        }
      } catch {
        fireTop({ icon: "error", title: "Error", text: "Failed to fetch evaluations" });
        setEvals([]);
      } finally {
        setLoading(false);
      }
    };

    const fetchEvaluationById = async (id) => {
      if (!id) return;
      setActiveLoading(true);
      setAnalytics(null);
      try {
        const res = await api.get(`/lesson-plan-evaluations/${id}`);
        const ev = normalizeEvalFromApi(res.data);
        setActiveEval(ev);
      } catch {
        fireTop({ icon: "error", title: "Error", text: "Failed to load evaluation details" });
        setActiveEval(null);
      } finally {
        setActiveLoading(false);
      }
    };

    // ✅ Students for marks entry
    const fetchStudentsForEvaluation = async () => {
      if (!lessonPlanId) return;
      if (!lessonPlan?.classId) return;

      setStudentsLoading(true);
      try {
        const res = await api.get(`/lesson-plans/${lessonPlanId}/students`, {
          params: {
            classId: lessonPlan?.classId || undefined,
            sectionIds: planSectionIds.length ? planSectionIds.join(",") : undefined,
            includeDisabled: 0,
          },
        });

        const list = normalizeStudents(res.data);

        const cleaned = (list || []).filter((s) => {
          const st = safeStr(s?.status || "enabled").toLowerCase();
          const visible = s?.visible;
          if (st && st !== "enabled") return false;
          if (visible === false) return false;
          return !!pickStudentRef(s);
        });

        cleaned.sort((a, b) => {
          const sa = Number(a?.section_id || a?.sectionId || 0);
          const sb = Number(b?.section_id || b?.sectionId || 0);
          if (sa !== sb) return sa - sb;

          const ra = Number(a?.roll_number || a?.rollNumber || 0);
          const rb = Number(b?.roll_number || b?.rollNumber || 0);
          if (ra !== rb) return ra - rb;

          return pickStudentName(a).localeCompare(pickStudentName(b));
        });

        setStudents(cleaned);

        // keep marks only for current students
        setMarksMap((prev) => {
          const next = { ...(prev || {}) };
          const set = new Set(cleaned.map((s) => pickStudentRef(s)));
          for (const k of Object.keys(next)) if (!set.has(k)) delete next[k];
          return next;
        });

        // keep remarks only for current students
        setRemarksMap((prev) => {
          const next = { ...(prev || {}) };
          const set = new Set(cleaned.map((s) => pickStudentRef(s)));
          for (const k of Object.keys(next)) if (!set.has(k)) delete next[k];
          return next;
        });
      } catch (e) {
        setStudents([]);
        fireTop({
          icon: "error",
          title: "Students",
          text:
            e?.response?.data?.message ||
            e?.response?.data?.error ||
            "Failed to load students list (backend endpoint missing?)",
        });
      } finally {
        setStudentsLoading(false);
      }
    };

    const loadExistingResults = async (evalId) => {
      if (!evalId) return;

      try {
        // try plural first, fallback to singular
        let res;
        try {
          res = await api.get(`/lesson-plan-evaluations/${evalId}/results`);
        } catch (e1) {
          const st = Number(e1?.response?.status);
          if (st === 404 || st === 405) {
            res = await api.get(`/lesson-plan-evaluations/${evalId}/result`);
          } else {
            throw e1;
          }
        }

        const list =
          res?.data?.results ||
          res?.data?.data?.results ||
          res?.data?.result ||
          res?.data?.data?.result ||
          normalizeList(res?.data);

        if (!Array.isArray(list) || !list.length) {
          setResultsLoaded(true);
          return;
        }

        const marksPatch = {};
        const remarksPatch = {};
        const photoPatch = {};

        for (const r of list) {
          const ref = safeStr(
            r?.studentRef ||
              r?.Student?.admission_number ||
              r?.Student?.admission_no ||
              r?.Student?.admissionNumber ||
              ""
          ).trim();

          if (!ref) continue;

          // ✅ marks
          const mk = r?.marksObtained;
          const n = Number(mk);
          if (Number.isFinite(n)) marksPatch[ref] = String(n);

          // ✅ remark
          const remark = safeStr(r?.remark || "").trim();
          // ✅ photo (from results api)
              const rawPhoto =
                r?.studentPhotoUrl ||
                r?.studentPhoto ||
                r?.Student?.photo ||
                "";

              const photoUrl = pickStudentPhoto({
                studentPhotoUrl: rawPhoto,
                photo: rawPhoto,
              });

    if (photoUrl) photoPatch[ref] = photoUrl;
              if (remark) remarksPatch[ref] = remark;

            }

            if (Object.keys(marksPatch).length) {
              setMarksMap((prev) => ({ ...(prev || {}), ...marksPatch }));
            }
            if (Object.keys(remarksPatch).length) {
              setRemarksMap((prev) => ({ ...(prev || {}), ...remarksPatch }));
            }
            if (Object.keys(photoPatch).length) {
                setPhotoMap((prev) => ({ ...(prev || {}), ...photoPatch }));
              }

            setResultsLoaded(true);
          } catch {
            setResultsLoaded(true);
          }
        };

        useEffect(() => {
          fetchLessonPlanMeta();
          fetchEvaluations();
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [lessonPlanId]);

        useEffect(() => {
          if (activeEvalId) fetchEvaluationById(activeEvalId);
          else setActiveEval(null);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [activeEvalId]);

        useEffect(() => {
          if (!lessonPlan?.id || !activeEvalId) return;
          fetchStudentsForEvaluation();
          setResultsLoaded(false);
          loadExistingResults(activeEvalId);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [lessonPlan?.id, activeEvalId]);

        /* ---------------- modal helpers ---------------- */

        const resetModal = () => {
          setEditing(false);
          setEditId(null);
          setSaving(false);
          setAiBusy(false);

          setForm({
            title: "",
            type: "OBJECTIVE",
            totalMarks: 20,
            timeMinutes: 30,
            instructions: "",
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
            },
          ]);

          setAiMode("APPEND");
          setAiCount(10);
          setAiDifficulty("MEDIUM");
          setAiPreferMcqOnly(true);
        };

        const openCreate = () => {
          resetModal();
          setShowModal(true);
        };

        const closeModal = async () => {
          setShowModal(false);
          setSaving(false);
          setAiBusy(false);
          await sleep(320);
          resetModal();
        };

    const onForm = (name, value) => setForm((p) => ({ ...p, [name]: value }));

    /* ---------------- ✅ PDF helpers ---------------- */

    const downloadEvaluationPdf = async (id, withAnswers = false) => {
      if (!id) return;
      try {
        const qs = withAnswers ? "?answers=1" : "";
        const endpoint = `/lesson-plan-evaluations/${id}/pdf${qs}`;

        const res = await api.get(endpoint, { responseType: "blob" });

        const blob = new Blob([res.data], { type: "application/pdf" });
        const blobUrl = window.URL.createObjectURL(blob);

        window.open(blobUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
      } catch (e) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || "Failed to open PDF";
        fireTop({ icon: "error", title: "PDF Error", text: msg });
      }
    };

    // ✅ Result PDF (All students OR single student via studentRef)
    const downloadResultPdf = async ({ evalId, studentRef = null } = {}) => {
      if (!evalId) return;
      try {
        const qs = studentRef ? `?studentRef=${encodeURIComponent(studentRef)}` : "";
        const endpoint = `/lesson-plan-evaluations/${evalId}/results/pdf${qs}`;

        const res = await api.get(endpoint, { responseType: "blob" });

        const blob = new Blob([res.data], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = studentRef ? `Result_${evalId}_${studentRef}.pdf` : `Result_${evalId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        const msg =
          e?.response?.data?.message || e?.response?.data?.error || "Failed to download Result PDF";
        fireTop({ icon: "error", title: "Result PDF Error", text: msg });
      }
    };

    /* ---------------- items editing ---------------- */

    const addItem = (type) => {
      const t = type || (form.type === "SUBJECTIVE" ? "SUBJECTIVE" : "MCQ");
      const base = {
        tempId: uid(),
        type: t,
        question: "",
        marks: t === "MCQ" ? 1 : 5,
        options: t === "MCQ" ? ["", "", "", ""] : [],
        correctIndex: 0,
        answerKey: "",
      };
      setItems((prev) => [...prev, base]);
    };

    const removeItem = (tempId) => setItems((prev) => prev.filter((x) => x.tempId !== tempId));
    const patchItem = (tempId, patch) =>
      setItems((prev) => prev.map((x) => (x.tempId === tempId ? { ...x, ...patch } : x)));

    const patchOption = (tempId, idx, value) => {
      setItems((prev) =>
        prev.map((x) => {
          if (x.tempId !== tempId) return x;
          const opts = Array.isArray(x.options) ? [...x.options] : [];
          while (opts.length < 4) opts.push("");
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
          const t = asUpper(it.type);
          const marks = Number(it.marks) || 0;

          if (t === "MCQ") {
            const options = (it.options || [])
              .map((x) => safeStr(x).trim())
              .filter((x) => x.length > 0);

            return {
              sortOrder: idx,
              type: "MCQ",
              question: safeStr(it.question).trim(),
              marks,
              options,
              correctIndex: Number(it.correctIndex) || 0,
            };
          }

          return {
            sortOrder: idx,
            type: "SUBJECTIVE",
            question: safeStr(it.question).trim(),
            marks,
            answerKey: safeStr(it.answerKey).trim() || null,
          };
        });
    };

    const buildUpsertPayload = () => {
      return {
        title: safeStr(form.title).trim() || "Evaluation",
        type: form.type,
        totalMarks: Number(form.totalMarks) || computedTotalMarks || 0,
        timeMinutes:
          form.timeMinutes === "" || form.timeMinutes == null
            ? null
            : Number(form.timeMinutes) || null,
        config: { instructions: safeStr(form.instructions).trim() || null },
        items: buildItemsPayload(),
      };
    };

    /* ---------------- ✅ AI: generate questions ---------------- */

    const normalizeAiQuestionsToItems = (aiData) => {
      const root = aiData?.data ?? aiData;
      const list =
        root?.questions ||
        root?.items ||
        root?.evaluationItems ||
        root?.result?.questions ||
        root?.data?.questions ||
        [];

      if (!Array.isArray(list)) return [];

      return list
        .map((q) => {
          const type = asUpper(q.type || q.questionType || "");
          const question = safeStr(q.question || q.q || "").trim();
          if (!question) return null;

          // MCQ
          if (type === "MCQ" || Array.isArray(q.options)) {
            const opts = (q.options || [])
              .map((x) => safeStr(x).trim())
              .filter(Boolean)
              .slice(0, 4);

            while (opts.length < 4) opts.push("");

            const ci =
              q.correctIndex != null
                ? Number(q.correctIndex)
                : q.correctAnswer != null
                ? Number(q.correctAnswer)
                : 0;

            return {
              tempId: uid(),
              type: "MCQ",
              question,
              marks: Number(q.marks ?? 1) || 1,
              options: opts,
              correctIndex: Number.isFinite(ci) ? ci : 0,
              answerKey: "",
            };
          }

          // subjective
          return {
            tempId: uid(),
            type: "SUBJECTIVE",
            question,
            marks: Number(q.marks ?? 5) || 5,
            options: [],
            correctIndex: 0,
            answerKey: safeStr(q.answerKey || q.modelAnswer || "").trim(),
          };
        })
        .filter(Boolean);
    };

    const buildAiQuestionsPayload = () => {
      const classId = Number(lessonPlan?.classId);
      const subjectId = Number(lessonPlan?.subjectId);
      const topic = safeStr(lessonPlan?.topic).trim();

      return {
        classId,
        subjectId,
        topic,
        subtopic: safeStr(lessonPlan?.subtopic).trim() || null,
        evaluationType: form.type,
        preferMcqOnly: !!aiPreferMcqOnly,
        count: Number(aiCount) || 10,
        difficulty: aiDifficulty,
        totalMarks: Number(form.totalMarks) || computedTotalMarks || null,
        language: "en",
      };
    };

    const generateQuestionsWithAI = async () => {
      if (aiBusy) return;

      if (!aiEnabled) {
        fireTop({
          icon: "warning",
          title: "Missing",
          text: "Lesson Plan topic/class not found. Open lesson plan and set Topic first.",
        });
        return;
      }

      setAiBusy(true);
      try {
        const payload = buildAiQuestionsPayload();
        const res = await api.post("/api/ai/lesson-plan/questions", payload);

        const newItems = normalizeAiQuestionsToItems(res?.data);

        if (!newItems.length) {
          fireTop({
            icon: "warning",
            title: "AI",
            text: "AI response received but no questions were parsed. Check backend keys.",
          });
          return;
        }

        // ✅ use prev to avoid stale closure issues
        setItems((prev) => {
          if (aiMode === "REPLACE") return newItems;
          return [...(prev || []), ...newItems];
        });

        // ✅ compute merged marks safely
        const mergedMarks = (aiMode === "REPLACE" ? newItems : [...(items || []), ...newItems]).reduce(
          (a, b) => a + (Number(b.marks) || 0),
          0
        );

        if (!Number(form.totalMarks) || Number(form.totalMarks) < mergedMarks) {
          setForm((p) => ({ ...p, totalMarks: mergedMarks || p.totalMarks }));
        }

        fireTop({
          icon: "success",
          title: "✨ AI generated questions",
          text: aiMode === "REPLACE" ? "Replaced existing questions." : "Added questions to your list.",
          timer: 1600,
          showConfirmButton: false,
        });
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          "AI questions generation failed.";
        if (Number(e?.response?.status) === 501) {
          fireTop({
            icon: "info",
            title: "AI Questions",
            text: "Backend endpoint is not implemented yet (501).",
          });
        } else {
          fireTop({ icon: "error", title: "AI Error", text: msg });
        }
      } finally {
        setAiBusy(false);
      }
    };

    /* ---------------- create / update ---------------- */

    const createEvaluation = async () => {
      if (!lessonPlanId) return;

      if (!safeStr(form.title).trim()) {
        fireTop({ icon: "warning", title: "Missing", text: "Please enter Evaluation title" });
        return;
      }
      if (!buildItemsPayload().length) {
        fireTop({ icon: "warning", title: "Missing", text: "Please add at least 1 question" });
        return;
      }

      setSaving(true);
      try {
        const payload = buildUpsertPayload();
        const res = await api.post(`/lesson-plans/${lessonPlanId}/evaluations`, payload);

        const createdId = res?.data?.evaluation?.id || res?.data?.id || res?.data?.data?.id;

        await closeModal();
        fireTop({
          icon: "success",
          title: "Evaluation created",
          timer: 1400,
          showConfirmButton: false,
        });

        await fetchEvaluations();
        await sleep(250);
        await fetchEvaluations();

        if (createdId) setActiveEvalId(createdId);
      } catch (e) {
        const msg =
          e?.response?.data?.message || e?.response?.data?.error || "Failed to create evaluation";
        fireTop({ icon: "error", title: "Error", text: msg });
      } finally {
        setSaving(false);
      }
    };

    const openEdit = () => {
      if (!activeEval) return;

      if (asUpper(activeEval.status) !== "DRAFT") {
        fireTop({ icon: "info", title: "Locked", text: "Only DRAFT evaluation can be edited." });
        return;
      }

      setEditing(true);
      setEditId(activeEval.id);

      setForm({
        title: safeStr(activeEval.title),
        type: safeStr(activeEval.type || "OBJECTIVE"),
        totalMarks: Number(activeEval.totalMarks ?? 0) || 0,
        timeMinutes: activeEval.timeMinutes == null ? 30 : Number(activeEval.timeMinutes) || 0,
        instructions: safeStr(activeEval?.config?.instructions || ""),
      });

      const its = activeItems.length
        ? activeItems
        : [
            {
              tempId: uid(),
              type: "MCQ",
              question: "",
              marks: 1,
              options: ["", "", "", ""],
              correctIndex: 0,
              answerKey: "",
            },
          ];

      const mapped = its.map((it) => {
        const t = asUpper(it.type || "MCQ");
        const opts =
          t === "MCQ"
            ? Array.isArray(it.options)
              ? [...it.options]
              : safeJsonParse(it.optionsJson, ["", "", "", ""])
            : [];

        while (opts.length < 4 && t === "MCQ") opts.push("");

        const ci =
          it.correctIndex != null
            ? Number(it.correctIndex)
            : it.correctAnswer != null && String(it.correctAnswer).trim() !== ""
            ? Number(it.correctAnswer)
            : 0;

        return {
          tempId: uid(),
          type: t === "MCQ" ? "MCQ" : "SUBJECTIVE",
          question: safeStr(it.question),
          marks: Number(it.marks ?? (t === "MCQ" ? 1 : 5)) || 0,
          options: t === "MCQ" ? opts.slice(0, 4) : [],
          correctIndex: Number.isFinite(ci) ? ci : 0,
          answerKey: safeStr(it.answerKey || ""),
        };
      });

      setItems(mapped);
      setShowModal(true);
    };

    const updateEvaluation = async () => {
      if (!editId) return;

      if (!safeStr(form.title).trim()) {
        fireTop({ icon: "warning", title: "Missing", text: "Please enter Evaluation title" });
        return;
      }
      if (!buildItemsPayload().length) {
        fireTop({ icon: "warning", title: "Missing", text: "Please add at least 1 question" });
        return;
      }

      setSaving(true);
      try {
        const payload = buildUpsertPayload();
        await api.put(`/lesson-plan-evaluations/${editId}`, payload);

        await closeModal();
        fireTop({
          icon: "success",
          title: "Evaluation updated",
          timer: 1400,
          showConfirmButton: false,
        });

        await fetchEvaluations();
        await fetchEvaluationById(editId);
      } catch (e) {
        const msg =
          e?.response?.data?.message || e?.response?.data?.error || "Failed to update evaluation";
        fireTop({ icon: "error", title: "Error", text: msg });
      } finally {
        setSaving(false);
      }
    };

    /* ---------------- delete ---------------- */

    const deleteEvaluation = async (id) => {
      if (!id) return;

      const r = await fireTop({
        title: "Delete evaluation?",
        text: "This will permanently delete evaluation and its questions.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete",
      });

      if (!r.isConfirmed) return;

      try {
        await api.delete(`/lesson-plan-evaluations/${id}`);

        fireTop({ icon: "success", title: "Deleted", timer: 1200, showConfirmButton: false });

        if (Number(activeEvalId) === Number(id)) {
          setActiveEvalId(null);
          setActiveEval(null);
        }

        await fetchEvaluations();
      } catch (e) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || "Delete failed";
        fireTop({ icon: "error", title: "Error", text: msg });
      }
    };

    /* ---------------- publish / analytics ---------------- */

    const publishEvaluation = async (id) => {
      if (!id) return;
      try {
        const res = await api.post(`/lesson-plan-evaluations/${id}/publish`);
        fireTop({ icon: "success", title: "Success", text: "Evaluation published" });
        await fetchEvaluations();

        const ev = normalizeEvalFromApi(res.data);
        if (ev) setActiveEval(ev);

        await fetchEvaluationById(id);
      } catch (e) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || "Publish failed";
        fireTop({ icon: "error", title: "Error", text: msg });
      }
    };

    const loadAnalytics = async (id) => {
      if (!id) return;
      setAnalyticsBusy(true);
      try {
        const res = await api.get(`/lesson-plan-evaluations/${id}/analytics`);
        setAnalytics(res.data || null);

        // ✅ auto-open analytics section + show dashboard tab
        setOpenKeys((prev) => {
          const set = new Set(prev || []);
          set.add("2");
          return Array.from(set);
        });
        setAnalyticsTab("dashboard");
      } catch (e) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || "Analytics fetch failed";
        fireTop({ icon: "error", title: "Error", text: msg });
      } finally {
        setAnalyticsBusy(false);
      }
    };

    /* ---------------- ✅ Marks entry helpers ---------------- */

    const patchMark = (studentRef, value) => {
      setMarksMap((prev) => ({ ...(prev || {}), [studentRef]: value }));
    };

    const clearAllMarks = async () => {
      const r = await fireTop({
        icon: "warning",
        title: "Clear all marks?",
        text: "This will clear inputs on screen (not saved).",
        showCancelButton: true,
        confirmButtonText: "Clear",
      });
      if (!r.isConfirmed) return;
      setMarksMap({});
    };

    const fillEmptyWithZero = () => {
      setMarksMap((prev) => {
        const next = { ...(prev || {}) };
        for (const s of filteredStudents) {
          const ref = pickStudentRef(s);
          if (!ref) continue;
          if (next[ref] == null || next[ref] === "") next[ref] = "0";
        }
        return next;
      });
    };

    const clampToTotal = (value, total) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return "";
      const t = Number(total);
      if (!Number.isFinite(t) || t <= 0) return String(n);
      if (n < 0) return "0";
      if (n > t) return String(t);
      return String(n);
    };

    const saveResults = async () => {
      const id = activeEvalId;
      if (!id) {
        fireTop({
          icon: "warning",
          title: "Select Evaluation",
          text: "Please select an evaluation first",
        });
        return;
      }

      const totalMarks = safeNum(activeEval?.totalMarks);

      const cleaned = (students || [])
        .map((s) => {
          const ref = pickStudentRef(s);
          const raw = marksMap?.[ref];
          if (!ref) return null;
          if (raw == null || raw === "") return null;

          const n = Number(raw);
          if (!Number.isFinite(n)) return null;

          const final = totalMarks != null ? Number(clampToTotal(n, totalMarks)) : n;

          // ✅ add remark
          const remark = safeStr(remarksMap?.[ref] || "").trim() || null;

          return {
            studentId: s?.id,
            studentRef: ref,
            marksObtained: final,
            remark,
          };
        })
        .filter(Boolean);

      if (!cleaned.length) {
        fireTop({
          icon: "warning",
          title: "Missing",
          text: "Please enter at least one valid mark (number).",
        });
        return;
      }

      setResultsSaving(true);
      try {
        await api.post(`/lesson-plan-evaluations/${id}/results`, { results: cleaned });

        fireTop({
          icon: "success",
          title: "Saved",
          text: `Saved ${cleaned.length} result(s) successfully`,
        });

        await loadAnalytics(id);
        setAnalyticsTab("students");
      } catch (e) {
        const msg = e?.response?.data?.message || e?.response?.data?.error || "Failed to save results";
        fireTop({ icon: "error", title: "Error", text: msg });
      } finally {
        setResultsSaving(false);
      }
    };

    /* ---------------- ✅ NEW: AI Remarks Generator ---------------- */

    const buildAiRemarksPayload = () => {
      const totalMarks = Number(activeEval?.totalMarks || 0) || 0;

      const topic = safeStr(lessonPlan?.topic).trim() || null;
      const subtopic = safeStr(lessonPlan?.subtopic).trim() || null;

      const className =
        safeStr(
          lessonPlan?.Class?.class_name ||
            lessonPlan?.class_name ||
            lessonPlan?.className ||
            ""
        ).trim() || null;

      const subjectName =
        safeStr(
          lessonPlan?.Subject?.name ||
            lessonPlan?.subject_name ||
            lessonPlan?.subjectName ||
            ""
        ).trim() || null;

      // Only include students with valid marks
      const list = (students || [])
        .map((s) => {
          const ref = pickStudentRef(s);
          const raw = marksMap?.[ref];
          if (!ref) return null;
          if (raw == null || raw === "") return null;
          const n = Number(raw);
          if (!Number.isFinite(n)) return null;

          return {
            studentId: Number(s?.id) || 0,
            studentRef: ref,
            name: pickStudentName(s),
            marksObtained: n,
          };
        })
        .filter((x) => x && x.studentId > 0);

      return {
        evaluationId: Number(activeEvalId) || null,
        className,
        subjectName,
        topic,
        subtopic,
        totalMarks,
        language: remarksLanguage, // en|hi|pa
        students: list,
      };
    };

    const generateAiRemarks = async () => {
      if (remarksBusy) return;

      if (!canGenerateRemarks) {
        fireTop({
          icon: "warning",
          title: "Remarks",
          text: "Marks not found. Please fill at least one student mark first.",
        });
        return;
      }

      const payload = buildAiRemarksPayload();
      if (!payload.students?.length) {
        fireTop({ icon: "warning", title: "Remarks", text: "No valid marks found to generate remarks." });
        return;
      }

      setRemarksBusy(true);
      try {
        // ✅ Endpoint expected in ai.routes.js (handle 501 gracefully)
        const res = await api.post("/api/ai/lesson-plan-evaluation/remarks", payload);

        const list =
          res?.data?.remarks ||
          res?.data?.data?.remarks ||
          res?.data?.result?.remarks ||
          res?.data?.data?.result?.remarks ||
          [];

        if (!Array.isArray(list) || !list.length) {
          fireTop({ icon: "warning", title: "AI Remarks", text: "No remarks returned from AI." });
          return;
        }

        // map to studentRef
        const byId = new Map();
        for (const s of students || []) {
          if (s?.id != null) byId.set(Number(s.id), pickStudentRef(s));
        }

        const patch = {};
        for (const r of list) {
          const sid = Number(r?.studentId);
          const remark = safeStr(r?.remark).trim();
          if (!Number.isFinite(sid) || sid <= 0 || !remark) continue;
          const ref = byId.get(sid);
          if (!ref) continue;
          patch[ref] = remark;
        }

        if (!Object.keys(patch).length) {
          fireTop({
            icon: "warning",
            title: "AI Remarks",
            text: "Remarks came, but mapping failed (studentId mismatch).",
          });
          return;
        }

        setRemarksMap((prev) => ({ ...(prev || {}), ...patch }));

        // Open analytics section and students tab
        setOpenKeys((prev) => {
          const set = new Set(prev || []);
          set.add("2");
          return Array.from(set);
        });
        setAnalyticsTab("students");

        fireTop({
          icon: "success",
          title: "AI Remarks Ready",
          text: `Generated remarks for ${Object.keys(patch).length} student(s).`,
          timer: 1600,
          showConfirmButton: false,
        });
      } catch (e) {
        const status = Number(e?.response?.status);
        const msg =
          e?.response?.data?.message || e?.response?.data?.error || "AI remarks generation failed.";

        if (status === 501 || status === 404) {
          fireTop({
            icon: "info",
            title: "AI Remarks endpoint not ready",
            text:
              "Backend route missing. Add: POST /api/ai/lesson-plan-evaluation/remarks (and call generateEvaluationRemarksJSON).",
          });
        } else {
          fireTop({ icon: "error", title: "AI Remarks Error", text: msg });
        }
      } finally {
        setRemarksBusy(false);
      }
    };

    const clearRemarks = async () => {
      const r = await fireTop({
        icon: "warning",
        title: "Clear remarks?",
        text: "This will clear AI remarks on screen (not saved).",
        showCancelButton: true,
        confirmButtonText: "Clear",
      });
      if (!r.isConfirmed) return;
      setRemarksMap({});
    };

    /* ---------------- UI ---------------- */

    const selectedStudentCharts = useMemo(() => {
      const total = Number(activeEval?.totalMarks || 0) || 0;
      const marks = selectedStudentRow?.marks == null ? null : Number(selectedStudentRow.marks);
      const valid = Number.isFinite(marks);
      const obtained = valid ? Math.max(0, Math.min(total, marks)) : 0;
      const remaining = total > obtained ? total - obtained : 0;

      const barData = total ? [{ name: "Marks", Obtained: obtained, Remaining: remaining }] : [];

      const passFail = valid
        ? [
            { name: "Pass", value: obtained >= passMarks ? 1 : 0 },
            { name: "Fail", value: obtained >= passMarks ? 0 : 1 },
          ]
        : [
            { name: "Pass", value: 0 },
            { name: "Fail", value: 0 },
          ];

      const pct = valid && total > 0 ? clampPercent((obtained / total) * 100) : 0;

      return { total, obtained, remaining, barData, passFail, pct, valid };
    }, [selectedStudentRow, activeEval, passMarks]);

    return (
      <div className="container-fluid py-3">
        <Row className="g-3 align-items-center mb-2">
          <Col xs={12} md={7}>
            <div className="d-flex align-items-center gap-2">
              <Button variant="outline-secondary" size="sm" onClick={() => navigate("/lesson-plans")}>
                ← Back
              </Button>
              <div>
                <h4 className="mb-0">Lesson Plan Evaluations</h4>
                <div className="text-muted small">
                  Create professional tests (Objective / Subjective / Mixed), publish and record results.
                </div>
                <div className="text-muted small">
                  {planLoading ? (
                    <span>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Loading lesson plan...
                    </span>
                  ) : lessonPlan ? (
                    <span>
                      Lesson Topic: <b>{safeStr(lessonPlan.topic || "-")}</b>
                      {lessonPlan.subtopic ? ` • ${lessonPlan.subtopic}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted">Lesson plan meta not loaded (AI may be disabled).</span>
                  )}
                </div>
              </div>
            </div>
          </Col>

          <Col xs={12} md={5} className="d-flex justify-content-md-end gap-2 flex-wrap">
            <Button variant="primary" onClick={openCreate} className="w-100 w-md-auto">
              + Create Evaluation
            </Button>
            <Button
              variant="outline-secondary"
              onClick={fetchEvaluations}
              disabled={loading}
              className="w-100 w-md-auto"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </Col>
        </Row>

        <Row className="g-3">
          {/* LEFT: list */}
          <Col xs={12} lg={5}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center">
                <div className="fw-semibold">Evaluations</div>
                <div className="text-muted small">
                  {evals.length} item{evals.length === 1 ? "" : "s"}
                </div>
              </Card.Header>

              <Card.Body>
                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" size="sm" className="me-2" />
                    Loading...
                  </div>
                ) : !evals.length ? (
                  <div className="text-muted">No evaluations yet. Click “Create Evaluation”.</div>
                ) : (
                  <div className="d-grid gap-2">
                    {evals.map((ev) => (
                      <Button
                        key={ev.id}
                        variant={Number(activeEvalId) === Number(ev.id) ? "dark" : "outline-dark"}
                        className="text-start"
                        onClick={() => setActiveEvalId(ev.id)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="fw-semibold">{safeStr(ev.title || `Evaluation #${ev.id}`)}</div>
                          <div className="d-flex gap-2">
                            <Badge bg={typeBadge(ev.type)}>{asUpper(ev.type || "-")}</Badge>
                            <Badge bg={statusBadge(ev.status)}>{asUpper(ev.status || "DRAFT")}</Badge>
                          </div>
                        </div>
                        <div className="text-muted small mt-1">
                          Marks: {ev.totalMarks ?? "-"} • Time: {ev.timeMinutes ?? "-"} min
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* RIGHT: detail */}
          <Col xs={12} lg={7}>
            <Card className="shadow-sm border-0">
              <Card.Header className="bg-white d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div className="fw-semibold">Details</div>

                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={!activeEvalId || activeLoading}
                    onClick={() => fetchEvaluationById(activeEvalId)}
                  >
                    Reload
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-primary"
                    disabled={!activeEvalId || analyticsBusy}
                    onClick={() => loadAnalytics(activeEvalId)}
                  >
                    {analyticsBusy ? "Analytics..." : "Analytics"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-success"
                    disabled={!activeEvalId}
                    onClick={() => downloadResultPdf({ evalId: activeEvalId })}
                    title="Download Result PDF (All Students)"
                  >
                    🧾 Result PDF
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-dark"
                    disabled={!activeEvalId}
                    onClick={() => downloadEvaluationPdf(activeEvalId, false)}
                    title="Open Question Paper PDF"
                  >
                    📄 PDF
                  </Button>

                  <Button
                    size="sm"
                    variant="dark"
                    disabled={!activeEvalId}
                    onClick={() => downloadEvaluationPdf(activeEvalId, true)}
                    title="Open PDF with answers"
                  >
                    📄 Answers
                  </Button>

                  <Button size="sm" variant="primary" disabled={!activeEvalId || !canEditActive} onClick={openEdit}>
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-danger"
                    disabled={!activeEvalId}
                    onClick={() => deleteEvaluation(activeEvalId)}
                  >
                    Delete
                  </Button>

                  <Button
                    size="sm"
                    variant="success"
                    disabled={!activeEvalId || asUpper(activeEval?.status) === "PUBLISHED"}
                    onClick={() => publishEvaluation(activeEvalId)}
                  >
                    Publish
                  </Button>
                </div>
              </Card.Header>

              <Card.Body>
                {!activeEvalId ? (
                  <div className="text-muted">Select an evaluation from the left.</div>
                ) : activeLoading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" className="me-2" />
                    Loading...
                  </div>
                ) : !activeEval ? (
                  <div className="text-muted">Evaluation not found.</div>
                ) : (
                  <>
                    {/* Top meta */}
                    <Row className="g-2 mb-3">
                      <Col xs={12} md={7}>
                        <div className="fw-semibold">{safeStr(activeEval.title)}</div>
                        <div className="text-muted small">
                          Evaluation ID: #{activeEval.id} • LessonPlan: #{lessonPlanId}
                        </div>
                      </Col>
                      <Col xs={12} md={5} className="d-flex justify-content-md-end gap-2 flex-wrap">
                        <Badge bg={typeBadge(activeEval.type)} className="px-3 py-2">
                          {asUpper(activeEval.type)}
                        </Badge>
                        <Badge bg={statusBadge(activeEval.status)} className="px-3 py-2">
                          {asUpper(activeEval.status || "DRAFT")}
                        </Badge>
                        <Badge bg="light" text="dark" className="px-3 py-2">
                          Marks: {activeEval.totalMarks ?? "-"}
                        </Badge>
                        <Badge bg="light" text="dark" className="px-3 py-2">
                          Time: {activeEval.timeMinutes ?? "-"} min
                        </Badge>
                      </Col>
                    </Row>

                    {/* Instructions */}
                    {safeStr(activeEval?.config?.instructions || activeEval?.instructions).trim() ? (
                      <Card className="border-0 bg-light mb-3">
                        <Card.Body className="py-2">
                          <div className="text-muted small mb-1">Instructions</div>
                          <div className="small">
                            {safeStr(activeEval?.config?.instructions || activeEval?.instructions)}
                          </div>
                        </Card.Body>
                      </Card>
                    ) : null}

                    <Accordion activeKey={openKeys} alwaysOpen onSelect={() => {}}>
                      {/* Questions */}
                      <Accordion.Item eventKey="0">
                        <Accordion.Header
                          onClick={() =>
                            setOpenKeys((prev) =>
                              prev.includes("0") ? prev.filter((k) => k !== "0") : [...prev, "0"]
                            )
                          }
                        >
                          Questions ({activeItems.length})
                        </Accordion.Header>
                        <Accordion.Body>
                          {!activeItems.length ? (
                            <div className="text-muted">No items found for this evaluation.</div>
                          ) : (
                            <div className="table-responsive">
                              <Table className="mb-0 align-middle" hover>
                                <thead className="table-light">
                                  <tr>
                                    <th style={{ width: 70 }}>#</th>
                                    <th>Question</th>
                                    <th style={{ width: 120 }}>Type</th>
                                    <th style={{ width: 110 }}>Marks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeItems.map((it, idx) => (
                                    <tr key={it.id || `${idx}`}>
                                      <td className="text-muted">{idx + 1}</td>
                                      <td>
                                        <div className="fw-semibold">{safeStr(it.question || "-")}</div>

                                        {asUpper(it.type) === "MCQ" &&
                                        Array.isArray(it.options) &&
                                        it.options.length ? (
                                          <div className="text-muted small mt-1">
                                            {(it.options || []).slice(0, 4).map((o, i) => (
                                              <div key={i}>
                                                {String.fromCharCode(65 + i)}. {safeStr(o)}
                                                {Number(it.correctIndex) === i ? (
                                                  <Badge bg="success" className="ms-2">
                                                    Correct
                                                  </Badge>
                                                ) : null}
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}

                                        {asUpper(it.type) === "SUBJECTIVE" && safeStr(it.answerKey).trim() ? (
                                          <div className="text-muted small mt-1">
                                            <span className="fw-semibold">Answer Key:</span>{" "}
                                            {safeStr(it.answerKey)}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td>
                                        <Badge bg={itemTypeBadge(it.type)}>{asUpper(it.type || "-")}</Badge>
                                      </td>
                                      <td className="fw-semibold">{it.marks ?? "-"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          )}

                          {!canEditActive ? (
                            <div className="text-muted small mt-2">
                              Items are locked because this evaluation is <b>{asUpper(activeEval.status)}</b>.
                            </div>
                          ) : (
                            <div className="text-muted small mt-2">You can edit because this evaluation is DRAFT.</div>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>

                      {/* Marks Entry */}
                      <Accordion.Item eventKey="1">
                        <Accordion.Header
                          onClick={() =>
                            setOpenKeys((prev) =>
                              prev.includes("1") ? prev.filter((k) => k !== "1") : [...prev, "1"]
                            )
                          }
                        >
                          Marks Entry (Students Auto List)
                        </Accordion.Header>
                        <Accordion.Body>
                          {!lessonPlan?.classId ? (
                            <div className="text-muted">Lesson plan class not found. Cannot load students.</div>
                          ) : studentsLoading ? (
                            <div className="text-center py-4">
                              <Spinner animation="border" size="sm" className="me-2" />
                              Loading students...
                            </div>
                          ) : !students.length ? (
                            <div className="text-muted">
                              No students found for this lesson plan/class.
                              <div className="mt-2">
                                <Button size="sm" variant="outline-secondary" onClick={fetchStudentsForEvaluation}>
                                  Reload Students
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Row className="g-2 align-items-end mb-2">
                                <Col xs={12} md={5}>
                                  <Form.Label className="small mb-1">
                                    Search student (name / admission / roll / section)
                                  </Form.Label>
                                  <Form.Control
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                    placeholder="Type to search..."
                                  />
                                </Col>

                                <Col xs={12} md={3}>
                                  <Form.Label className="small mb-1">Filter Section</Form.Label>
                                  <Form.Select
                                    value={sectionFilter}
                                    onChange={(e) => setSectionFilter(e.target.value)}
                                    disabled={!planSections.length}
                                    title={planSections.length ? "Filter by section" : "No sections in plan"}
                                  >
                                    <option value="">{planSections.length ? "All Sections" : "No sections"}</option>
                                    {planSections.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {safeStr(s.section_name || s.name || `#${s.id}`)}
                                      </option>
                                    ))}
                                  </Form.Select>
                                </Col>

                                <Col xs={12} md={4} className="d-flex gap-2 flex-wrap">
                                  <Button size="sm" variant="outline-secondary" onClick={fetchStudentsForEvaluation}>
                                    Reload
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline-dark"
                                    onClick={fillEmptyWithZero}
                                    title="Fill empty inputs with 0 (not saved until you Save)"
                                  >
                                    Fill 0
                                  </Button>

                                  <Button size="sm" variant="outline-danger" onClick={clearAllMarks}>
                                    Clear
                                  </Button>
                                </Col>
                              </Row>

                              {/* ✅ AI Remarks toolbar */}
                              <Card className="border-0 bg-light mb-2">
                                <Card.Body className="py-2">
                                  <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                                    <div className="text-muted small">
                                      Showing <b>{marksStats.total}</b> students • Filled <b>{marksStats.filled}</b>
                                      {activeEval?.totalMarks != null ? (
                                        <>
                                          {" "}
                                          • Out of <b>{activeEval.totalMarks}</b>
                                        </>
                                      ) : null}
                                      {resultsLoaded ? (
                                        <span className="ms-2 badge bg-white text-dark">
                                          Loaded existing (if available)
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="d-flex gap-2 flex-wrap align-items-center">
                                      <Form.Select
                                        size="sm"
                                        value={remarksLanguage}
                                        onChange={(e) => setRemarksLanguage(e.target.value)}
                                        style={{ width: 140 }}
                                        disabled={remarksBusy}
                                        title="Remarks Language"
                                      >
                                        <option value="en">English</option>
                                        <option value="hi">Hindi</option>
                                        <option value="pa">Punjabi</option>
                                      </Form.Select>

                                      <Button
                                        size="sm"
                                        variant={canGenerateRemarks ? "dark" : "outline-dark"}
                                        disabled={!canGenerateRemarks || remarksBusy}
                                        onClick={generateAiRemarks}
                                        title={
                                          canGenerateRemarks
                                            ? "Generate remarks from marks + topic"
                                            : "Fill at least one student mark first"
                                        }
                                      >
                                        {remarksBusy ? (
                                          <>
                                            <Spinner size="sm" animation="border" className="me-2" />
                                            AI...
                                          </>
                                        ) : (
                                          "✨ AI Remarks"
                                        )}
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline-secondary"
                                        onClick={clearRemarks}
                                        disabled={remarksBusy}
                                      >
                                        Clear Remarks
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline-success"
                                        disabled={!activeEvalId}
                                        onClick={() => downloadResultPdf({ evalId: activeEvalId })}
                                        title="Download Result PDF (All Students)"
                                      >
                                        🧾 Result PDF
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="primary"
                                        disabled={resultsSaving || !activeEvalId}
                                        onClick={saveResults}
                                      >
                                        {resultsSaving ? "Saving..." : "Save Marks"}
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="text-muted small mt-1">
                                    Tip: Remarks show short in table. Click student name to open full details + graphs.
                                  </div>
                                </Card.Body>
                              </Card>

                              <div className="table-responsive">
                                <Table className="mb-0 align-middle" hover size="sm">
                                  <thead className="table-light">
                                    <tr>
                                      <th style={{ width: 60 }}>#</th>
                                      <th style={{ minWidth: 220 }}>Student</th>
                                      <th style={{ width: 170 }}>Admission No</th>
                                      <th style={{ width: 90 }}>Roll</th>
                                      <th style={{ width: 140 }}>Section</th>
                                      <th style={{ width: 160 }}>Marks</th>
                                      <th style={{ minWidth: 260 }}>AI Remark</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredStudents.map((s, i) => {
                                      const ref = pickStudentRef(s);
                                      const name = pickStudentName(s);
                                      const roll = safeStr(s?.roll_number || s?.rollNumber || "");
                                      const secName =
                                        safeStr(
                                          s?.Section?.section_name ||
                                            s?.Section?.name ||
                                            s?.section_name ||
                                            ""
                                        ) ||
                                        (() => {
                                          const secId = s?.section_id || s?.sectionId || "";
                                          return secId ? `#${secId}` : "-";
                                        })();

                                      const raw = marksMap?.[ref] ?? "";
                                      const total = safeNum(activeEval?.totalMarks);
                                      const bad =
                                        raw !== "" &&
                                        (!Number.isFinite(Number(raw)) ||
                                          (total != null && Number(raw) > total) ||
                                          Number(raw) < 0);

                                      const remark = safeStr(remarksMap?.[ref] || "").trim();

                                      const marksNum = raw === "" || raw == null ? null : Number(raw);
                                      const validMarks = Number.isFinite(marksNum);
                                      const percent =
                                        validMarks && Number(total || 0) > 0
                                          ? clampPercent((marksNum / Number(total)) * 100)
                                          : null;
                                      const status =
                                        !validMarks ? "NA" : marksNum >= passMarks ? "PASS" : "FAIL";

                                      return (
                                        <tr key={ref || `${i}`}>
                                          <td className="text-muted">{i + 1}</td>
                                          <td>
                                            <Button
                                              variant="link"
                                              className="p-0 text-decoration-none text-start"
                                              onClick={() =>
                                                openStudentDetail({
                                                  ref,
                                                  name,
                                                  section: secName,
                                                  marks: validMarks ? marksNum : null,
                                                  percent,
                                                  status,
                                                  remark: remark || null,
                                                  photoUrl: photoMap?.[ref] || pickStudentPhoto(s),
                                                })
                                              }
                                              title="Open student details"
                                            >
                                              <div className="fw-semibold">{name}</div>
                                              <div className="text-muted small">
                                                Father: {safeStr(s?.father_name || "-")}
                                              </div>
                                            </Button>
                                          </td>
                                          <td className="fw-semibold">{ref || "-"}</td>
                                          <td>{roll || "-"}</td>
                                          <td>{secName}</td>
                                          <td>
                                            <InputGroup size="sm">
                                              <Form.Control
                                                type="number"
                                                min={0}
                                                value={raw}
                                                onChange={(e) => patchMark(ref, e.target.value)}
                                                onBlur={(e) => {
                                                  const v = e.target.value;
                                                  if (v === "" || v == null) return;
                                                  const next =
                                                    total != null
                                                      ? clampToTotal(v, total)
                                                      : String(Number(v));
                                                  patchMark(ref, next);
                                                }}
                                                placeholder="—"
                                                isInvalid={!!bad}
                                              />
                                              {raw !== "" ? (
                                                <Button
                                                  variant="outline-secondary"
                                                  onClick={() => patchMark(ref, "")}
                                                  title="Clear"
                                                >
                                                  ×
                                                </Button>
                                              ) : null}
                                            </InputGroup>
                                            {bad ? (
                                              <div className="text-danger small mt-1">
                                                {Number.isFinite(total) ? `Enter 0 to ${total}` : "Enter valid number"}
                                              </div>
                                            ) : null}
                                          </td>
                                          <td>
                                            {remark ? (
                                              <div className="small">
                                                <span className="me-2">📝</span>
                                                {truncateText(remark)}
                                                {remark.length > REMARK_PREVIEW ? (
                                                  <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="p-0 ms-2 align-baseline"
                                                    onClick={() =>
                                                      openStudentDetail({
                                                        ref,
                                                        name,
                                                        section: secName,
                                                        marks: validMarks ? marksNum : null,
                                                        percent,
                                                        status,
                                                        remark: remark || null,
                                                        photoUrl: pickStudentPhoto(s), // ✅ ADD
                                                      })
                                                    }
                                                  >
                                                    View
                                                  </Button>
                                                ) : null}
                                              </div>
                                            ) : (
                                              <span className="text-muted small">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </Table>
                              </div>

                              <div className="d-flex justify-content-end gap-2 flex-wrap mt-2">
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => {
                                    setStudentSearch("");
                                    setSectionFilter("");
                                  }}
                                >
                                  Reset Filters
                                </Button>

                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={resultsSaving || !activeEvalId}
                                  onClick={saveResults}
                                >
                                  {resultsSaving ? "Saving..." : "Save Marks"}
                                </Button>
                              </div>

                              <div className="text-muted small mt-2">
                                Note: Only filled marks are sent to server. Blank students are skipped.
                              </div>
                            </>
                          )}
                        </Accordion.Body>
                      </Accordion.Item>

                      {/* Analytics */}
                      <Accordion.Item eventKey="2">
                        <Accordion.Header
                          onClick={() =>
                            setOpenKeys((prev) =>
                              prev.includes("2") ? prev.filter((k) => k !== "2") : [...prev, "2"]
                            )
                          }
                        >
                          Analytics
                        </Accordion.Header>
                        <Accordion.Body>
                          {!analytics ? (
                            <div className="text-muted">Click <b>Analytics</b> button on top to load summary.</div>
                          ) : (
                            <Tabs
                              activeKey={analyticsTab}
                              onSelect={(k) => setAnalyticsTab(k || "dashboard")}
                              className="mb-3"
                            >
                              <Tab eventKey="dashboard" title="Dashboard">
                                <Row className="g-3">
                                  <Col xs={12} md={4}>
                                    <Card className="border-0 bg-light">
                                      <Card.Body className="py-3">
                                        <div className="text-muted small">Students Evaluated</div>
                                        <div className="fs-4 fw-bold">
                                          {analytics.studentsEvaluated ?? analytics.attempted ?? 0}
                                        </div>
                                      </Card.Body>
                                    </Card>
                                  </Col>

                                  <Col xs={12} md={4}>
                                    <Card className="border-0 bg-light">
                                      <Card.Body className="py-3">
                                        <div className="text-muted small">Average %</div>
                                        <div className="fs-4 fw-bold">
                                          {analytics.averagePercent != null ? `${analytics.averagePercent}%` : "-"}
                                        </div>
                                      </Card.Body>
                                    </Card>
                                  </Col>

                                  <Col xs={12} md={4}>
                                    <Card className="border-0 bg-light">
                                      <Card.Body className="py-3">
                                        <div className="text-muted small">Pass Marks</div>
                                        <div className="fs-4 fw-bold">{passMarks}</div>
                                      </Card.Body>
                                    </Card>
                                  </Col>

                                  <Col xs={12} md={7}>
                                    <Card className="border-0 shadow-sm">
                                      <Card.Header className="bg-white fw-semibold">Marks Distribution</Card.Header>
                                      <Card.Body style={{ height: 280 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={marksChartData.buckets}>
                                            <XAxis dataKey="name" />
                                            <YAxis allowDecimals={false} />
                                            <Tooltip />
                                            <Bar dataKey="count" />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </Card.Body>
                                    </Card>
                                  </Col>

                                  <Col xs={12} md={5}>
                                    <Card className="border-0 shadow-sm">
                                      <Card.Header className="bg-white fw-semibold">Pass / Fail</Card.Header>
                                      <Card.Body style={{ height: 280 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                            <Pie
                                              data={marksChartData.passFail}
                                              dataKey="value"
                                              nameKey="name"
                                              outerRadius={90}
                                              label
                                            >
                                              {marksChartData.passFail.map((_, i) => (
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
                                          Highest: <b>{marksChartData.maxMarks != null ? marksChartData.maxMarks : "-"}</b>
                                        </div>
                                        <div className="small text-muted">
                                          Lowest: <b>{marksChartData.minMarks != null ? marksChartData.minMarks : "-"}</b>
                                        </div>
                                        <div className="small text-muted">
                                          Total Marks: <b>{activeEval?.totalMarks ?? "-"}</b>
                                        </div>
                                      </Card.Body>
                                    </Card>
                                  </Col>
                                </Row>
                              </Tab>

                              <Tab eventKey="students" title="Students Progress">
                                <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2">
                                  <div className="text-muted small">
                                    Showing <b>{studentProgressRows.length}</b> row(s) • Remarks:{" "}
                                    <b>{Object.keys(remarksMap || {}).length}</b>
                                  </div>
                                  <div className="d-flex gap-2 flex-wrap">
                                    <Button
                                      size="sm"
                                      variant={canGenerateRemarks ? "dark" : "outline-dark"}
                                      disabled={!canGenerateRemarks || remarksBusy}
                                      onClick={generateAiRemarks}
                                    >
                                      {remarksBusy ? (
                                        <>
                                          <Spinner size="sm" animation="border" className="me-2" />
                                          AI...
                                        </>
                                      ) : (
                                        "✨ AI Remarks"
                                      )}
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline-secondary"
                                      onClick={clearRemarks}
                                      disabled={remarksBusy}
                                    >
                                      Clear Remarks
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline-success"
                                      disabled={!activeEvalId}
                                      onClick={() => downloadResultPdf({ evalId: activeEvalId })}
                                    >
                                      🧾 Result PDF
                                    </Button>
                                  </div>
                                </div>

                                <div className="table-responsive">
                                  <Table hover size="sm" className="align-middle">
                                    <thead className="table-light">
                                      <tr>
                                        <th style={{ width: 60 }}>#</th>
                                        <th style={{ minWidth: 220 }}>Student</th>
                                        <th style={{ width: 140 }}>Section</th>
                                        <th style={{ width: 120 }}>Marks</th>
                                        <th style={{ minWidth: 240 }}>Progress</th>
                                        <th style={{ width: 120 }}>Status</th>
                                        <th style={{ minWidth: 320 }}>AI Remark</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {studentProgressRows.map((r, idx) => {
                                        const total = Number(activeEval?.totalMarks || 0) || 0;
                                        const pct = r.percent ?? 0;
                                        const status = r.status;

                                        return (
                                          <tr key={r.ref || idx}>
                                            <td className="text-muted">{idx + 1}</td>
                                            <td>
                                              <Button
                                                variant="link"
                                                className="p-0 text-decoration-none text-start"
                                                onClick={() => {
                                                  const st = (students || []).find((x) => pickStudentRef(x) === r.ref);
                                                  openStudentDetail({
                                                    ...r,
                                                    photoUrl: photoMap?.[r.ref] || (st ? pickStudentPhoto(st) : ""),
                                                  });
                                                }}
                                                title="Open student details"
                                              >
                                                <div className="fw-semibold">{r.name}</div>
                                                <div className="text-muted small">{r.ref}</div>
                                              </Button>
                                            </td>
                                            <td>{r.section}</td>
                                            <td className="fw-semibold">
                                              {r.marks == null ? "-" : `${r.marks}/${total}`}
                                            </td>
                                            <td>
                                              <ProgressBar
                                                now={r.marks == null ? 0 : pct}
                                                label={r.marks == null ? "" : `${pct}%`}
                                              />
                                            </td>
                                            <td>
                                              <Badge
                                                bg={
                                                  status === "PASS"
                                                    ? "success"
                                                    : status === "FAIL"
                                                    ? "danger"
                                                    : "secondary"
                                                }
                                              >
                                                {status}
                                              </Badge>
                                            </td>
                                            <td>
                                              {r.remark ? (
                                                <span className="small">
                                                  📝 {truncateText(r.remark)}
                                                  {r.remark.length > REMARK_PREVIEW ? (
                                                    <Button
                                                      variant="link"
                                                      size="sm"
                                                      className="p-0 ms-2 align-baseline"
                                                      onClick={() => openStudentDetail(r)}
                                                    >
                                                      View
                                                    </Button>
                                                  ) : null}
                                                </span>
                                              ) : (
                                                <span className="text-muted small">—</span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </Table>
                                </div>

                                <div className="text-muted small mt-2">
                                  Tip: After saving marks, this tab opens automatically.
                                </div>
                              </Tab>

                              <Tab eventKey="raw" title="Raw JSON">
                                <pre
                                  className="mb-0 p-3 rounded bg-light small"
                                  style={{ maxHeight: 320, overflow: "auto" }}
                                >
                                  {JSON.stringify(analytics, null, 2)}
                                </pre>
                              </Tab>
                            </Tabs>
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

        {/* ✅ Student Detail Modal */}
        <Modal
          show={showStudentModal}
          onHide={closeStudentDetail}
          size="lg"
          centered
          contentClassName="border-0"
        >
          <Modal.Header closeButton className="bg-white">
            <div className="w-100">
              <Modal.Title className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                <span>Student Result Detail</span>
                <div className="d-flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline-success"
                    disabled={!activeEvalId}
                    onClick={() =>
                      downloadResultPdf({
                        evalId: activeEvalId,
                        studentRef: selectedStudentRow?.ref || null,
                      })
                    }
                    title="Download this student's Result PDF"
                  >
                    🧾 Student PDF
                  </Button>

                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={!activeEvalId}
                    onClick={() => downloadResultPdf({ evalId: activeEvalId })}
                    title="Download all students Result PDF"
                  >
                    🧾 All PDF
                  </Button>
                </div>
              </Modal.Title>

              <div className="text-muted small mt-1">
                Test Name: <b>{safeStr(activeEval?.title || "—")}</b>
                {activeEval?.totalMarks != null ? (
                  <>
                    {" "}
                    • Total: <b>{activeEval.totalMarks}</b>
                  </>
                ) : null}
                {passMarks ? (
                  <>
                    {" "}
                    • Pass: <b>{passMarks}</b>
                  </>
                ) : null}
              </div>
            </div>
          </Modal.Header>

          <Modal.Body>
            {!selectedStudentRow ? (
              <div className="text-muted">Student not selected.</div>
            ) : (
              <Row className="g-3">
                <Col xs={12} md={6}>
                  <Card className="border-0 bg-light">
                    <Card.Body className="py-3">
                      {/* Photo + Name */}
                      <div className="d-flex align-items-center gap-3">
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 14,
                            overflow: "hidden",
                            background: "rgba(0,0,0,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                          title={safeStr(selectedStudentRow?.ref || "")}
                        >
                      {safeStr(selectedStudentRow?.photoUrl).trim() && !photoBroken ? (
                        <img
                          src={safeStr(selectedStudentRow.photoUrl)}
                          alt={safeStr(selectedStudentRow.name || "Student")}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          onError={() => setPhotoBroken(true)}
                        />
                      ) : (
                        <div className="fw-bold text-muted" style={{ fontSize: 22 }}>
                          {safeStr(selectedStudentRow?.name || "S").trim().slice(0, 1).toUpperCase()}
                        </div>
                      )}
                        </div>

                        <div className="flex-grow-1">
                          <div className="fw-semibold">{safeStr(selectedStudentRow?.name)}</div>
                          <div className="text-muted small">
                            Admission: <b>{safeStr(selectedStudentRow?.ref || "-")}</b> • Section:{" "}
                            <b>{safeStr(selectedStudentRow?.section || "-")}</b>
                          </div>
                        </div>
                      </div>

                      {/* Marks progress */}
                      <div className="mt-3">
                        <div className="d-flex justify-content-between text-muted small mb-1">
                          <span>Marks</span>
                          <span>
                            {selectedStudentCharts.valid
                              ? `${selectedStudentCharts.obtained}/${selectedStudentCharts.total}`
                              : "—"}
                          </span>
                        </div>
                        <ProgressBar
                          now={selectedStudentCharts.valid ? selectedStudentCharts.pct : 0}
                          label={selectedStudentCharts.valid ? `${selectedStudentCharts.pct}%` : ""}
                        />
                      </div>

                      {/* Status */}
                      <div className="mt-3 d-flex align-items-center gap-2 flex-wrap">
                        <Badge
                          bg={
                            selectedStudentRow?.status === "PASS"
                              ? "success"
                              : selectedStudentRow?.status === "FAIL"
                              ? "danger"
                              : "secondary"
                          }
                          className="px-3 py-2"
                        >
                          {safeStr(selectedStudentRow?.status || "NA")}
                        </Badge>

                        <span className="text-muted small">
                          {selectedStudentCharts.valid
                            ? selectedStudentRow?.status === "PASS"
                              ? "Meets pass criteria."
                              : "Below pass criteria."
                            : "Marks not entered yet."}
                        </span>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>

                <Col xs={12} md={6}>
                  <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-white fw-semibold">Marks Graph</Card.Header>
                    <Card.Body style={{ height: 220 }}>
                      {selectedStudentCharts.total ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={selectedStudentCharts.barData}>
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="Obtained" />
                            <Bar dataKey="Remaining" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-muted small">Total marks not available.</div>
                      )}
                    </Card.Body>
                  </Card>

                  <Card className="border-0 shadow-sm mt-3">
                    <Card.Header className="bg-white fw-semibold">Pass / Fail</Card.Header>
                    <Card.Body style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={selectedStudentCharts.passFail}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={80}
                            label
                          >
                            {selectedStudentCharts.passFail.map((_, i) => (
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
                    <Card.Body>
                      <div className="text-muted small mb-1">Remarks (Full)</div>
                      {safeStr(selectedStudentRow.remark).trim() ? (
                        <div style={{ whiteSpace: "pre-wrap" }} className="small">
                          {safeStr(selectedStudentRow.remark)}
                        </div>
                      ) : (
                        <div className="text-muted small">No remarks available.</div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            )}
          </Modal.Body>

          <Modal.Footer className="bg-white">
            <Button variant="outline-secondary" onClick={closeStudentDetail}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* ✅ Create/Edit Evaluation Modal */}
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
                <span>{editing ? "Edit Evaluation" : "Create Evaluation"}</span>

                {/* ✅ AI Quick Panel */}
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <Badge bg={aiEnabled ? "success" : "secondary"} className="px-2 py-1">
                    AI: {aiEnabled ? "Ready" : "Need Topic/Class"}
                  </Badge>

                  <Form.Select
                    size="sm"
                    value={aiMode}
                    onChange={(e) => setAiMode(e.target.value)}
                    style={{ width: 120 }}
                    title="AI Mode"
                    disabled={aiBusy}
                  >
                    <option value="APPEND">Append</option>
                    <option value="REPLACE">Replace</option>
                  </Form.Select>

                  <Form.Select
                    size="sm"
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    style={{ width: 120 }}
                    title="Difficulty"
                    disabled={aiBusy}
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
                      max={50}
                      value={aiCount}
                      onChange={(e) => setAiCount(e.target.value)}
                      disabled={aiBusy}
                      title="Questions count"
                    />
                  </InputGroup>

                  <Form.Check
                    type="switch"
                    id="aiMcqOnly"
                    label="MCQ only"
                    checked={aiPreferMcqOnly}
                    onChange={(e) => setAiPreferMcqOnly(e.target.checked)}
                    disabled={aiBusy}
                  />

                  <Button
                    size="sm"
                    variant={aiEnabled ? "dark" : "outline-dark"}
                    disabled={!aiEnabled || aiBusy}
                    onClick={generateQuestionsWithAI}
                    title={aiEnabled ? "Generate questions using Class + Topic" : "Set lesson plan Topic first"}
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
                </div>
              </Modal.Title>

              <div className="text-muted small mt-1">
                Using Lesson Plan: ClassId <b>{lessonPlan?.classId ?? "-"}</b> • SubjectId{" "}
                <b>{lessonPlan?.subjectId ?? "-"}</b> • Topic <b>{safeStr(lessonPlan?.topic || "-")}</b>
              </div>
            </div>
          </Modal.Header>

          <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <Row className="g-3">
              <Col xs={12} lg={5}>
                <Card className="border-0 shadow-sm">
                  <Card.Body>
                    <div className="fw-semibold mb-2">Paper Settings</div>

                    <Form.Group className="mb-2">
                      <Form.Label className="small">Title *</Form.Label>
                      <Form.Control
                        value={form.title}
                        onChange={(e) => onForm("title", e.target.value)}
                        placeholder="e.g. Weekly Test – Fractions"
                      />
                    </Form.Group>

                    <Row className="g-2">
                      <Col xs={12} md={6}>
                        <Form.Group className="mb-2">
                          <Form.Label className="small">Type</Form.Label>
                          <Form.Select value={form.type} onChange={(e) => onForm("type", e.target.value)}>
                            <option value="OBJECTIVE">Objective</option>
                            <option value="SUBJECTIVE">Subjective</option>
                            <option value="MIXED">Mixed</option>
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
                            value={form.timeMinutes}
                            onChange={(e) => onForm("timeMinutes", e.target.value)}
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="mb-2">
                      <Form.Label className="small">Instructions (optional)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={form.instructions}
                        onChange={(e) => onForm("instructions", e.target.value)}
                      />
                    </Form.Group>

                    <Card className="border-0 bg-light">
                      <Card.Body className="py-2">
                        <div className="text-muted small">Items Total (auto)</div>
                        <div className="fw-semibold">{computedTotalMarks} marks</div>
                      </Card.Body>
                    </Card>

                    <div className="d-flex gap-2 flex-wrap mt-3">
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => addItem(form.type === "SUBJECTIVE" ? "SUBJECTIVE" : "MCQ")}
                      >
                        + Add Question
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => addItem("SUBJECTIVE")}>
                        + Add Subjective
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => addItem("MCQ")}>
                        + Add MCQ
                      </Button>
                    </div>

                    <div className="text-muted small mt-3">
                      Tip: Use <b>✨ AI Questions</b> to auto-fill question list from Lesson Plan Topic.
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
                                  <Form.Control
                                    type="number"
                                    min={0}
                                    value={it.marks}
                                    onChange={(e) => patchItem(it.tempId, { marks: e.target.value })}
                                    style={{ width: 110 }}
                                    title="Marks"
                                  />
                                  <Button size="sm" variant="outline-danger" onClick={() => removeItem(it.tempId)}>
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

                              {asUpper(it.type) === "MCQ" ? (
                                <>
                                  <div className="text-muted small mt-2 mb-1">Options</div>
                                  <Row className="g-2">
                                    {[0, 1, 2, 3].map((i) => (
                                      <Col xs={12} md={6} key={i}>
                                        <Form.Control
                                          value={it.options?.[i] ?? ""}
                                          onChange={(e) => patchOption(it.tempId, i, e.target.value)}
                                          placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                        />
                                      </Col>
                                    ))}
                                  </Row>

                                  <Row className="g-2 mt-2 align-items-end">
                                    <Col xs={12} md={6}>
                                      <Form.Group>
                                        <Form.Label className="small">Correct Option</Form.Label>
                                        <Form.Select
                                          value={it.correctIndex}
                                          onChange={(e) => patchItem(it.tempId, { correctIndex: e.target.value })}
                                        >
                                          <option value={0}>A</option>
                                          <option value={1}>B</option>
                                          <option value={2}>C</option>
                                          <option value={3}>D</option>
                                        </Form.Select>
                                      </Form.Group>
                                    </Col>
                                  </Row>
                                </>
                              ) : (
                                <Form.Group className="mt-2">
                                  <Form.Label className="small">Answer Key (optional)</Form.Label>
                                  <Form.Control
                                    as="textarea"
                                    rows={2}
                                    value={it.answerKey}
                                    onChange={(e) => patchItem(it.tempId, { answerKey: e.target.value })}
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

          <Modal.Footer className="bg-white" style={{ position: "sticky", bottom: 0, zIndex: 2 }}>
            <Button variant="outline-secondary" onClick={closeModal} disabled={saving || aiBusy}>
              Cancel
            </Button>

            <Button variant="primary" onClick={editing ? updateEvaluation : createEvaluation} disabled={saving || aiBusy}>
              {saving ? (editing ? "Updating..." : "Creating...") : editing ? "Update Evaluation" : "Create Evaluation"}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  };

  export default LessonPlanEvaluations;