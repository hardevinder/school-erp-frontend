// src/pages/LessonPlanCRUD.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Swal from "sweetalert2";
import {
  Accordion,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import "./LessonPlan.css";

/* ---------------- helpers ---------------- */

const safeStr = (v) => (v == null ? "" : String(v));

const fmtDate = (d) => {
  if (!d) return "";
  const s = String(d);
  if (s.length >= 10) return s.slice(0, 10);
  return s;
};

const toPrettyDate = (d) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return String(d);
  }
};

const statusVariant = (status) => {
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

const completionVariant = (v) => {
  switch (String(v || "").toUpperCase()) {
    case "PLANNED":
      return "secondary";
    case "COMPLETED":
      return "success";
    case "PARTIAL":
      return "warning";
    default:
      return "dark";
  }
};

const termOptions = [
  { value: "FULL_YEAR", label: "Full Year" },
  { value: "TERM1", label: "Term 1" },
  { value: "TERM2", label: "Term 2" },
];

const splitList = (text) => {
  const s = safeStr(text).trim();
  if (!s) return [];
  return s
    .split(/\r?\n|,|;/g)
    .map((x) => x.trim())
    .filter(Boolean);
};

const asUpper = (v) => safeStr(v).toUpperCase();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const growNotebookTextarea = (event) => {
  const el = event.currentTarget;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

const ChoiceButtons = ({
  label,
  options = [],
  value,
  onChange,
  disabled = false,
  emptyText = "No options available",
  dense = false,
  scroll = false,
}) => {
  const normalized = (options || [])
    .map((option) => {
      if (option && typeof option === "object" && Object.prototype.hasOwnProperty.call(option, "value")) {
        return { value: option.value, label: option.label ?? option.value };
      }
      return { value: option, label: option };
    })
    .filter((option) => option.value !== undefined && option.value !== null && safeStr(option.label).trim());

  const current = safeStr(value);
  const hasCurrent = normalized.some((option) => safeStr(option.value) === current);
  const shown = current && !hasCurrent
    ? [{ value, label: current, retained: true }, ...normalized]
    : normalized;

  return (
    <div className={`lp-choice-group ${dense ? "dense" : ""}`}>
      {label ? <div className="lp-choice-label">{label}</div> : null}
      <div className={`lp-choice-list ${scroll ? "scroll" : ""}`}>
        {shown.length ? (
          shown.map((option, index) => {
            const selected = safeStr(option.value) === current;
            return (
              <button
                key={`${safeStr(option.value)}_${index}`}
                type="button"
                className={`lp-choice-btn ${selected ? "active" : ""} ${option.retained ? "retained" : ""}`}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onChange?.(option.value)}
                title={safeStr(option.label)}
              >
                {safeStr(option.label)}
              </button>
            );
          })
        ) : (
          <span className="lp-empty-note">{emptyText}</span>
        )}
      </div>
    </div>
  );
};

/* ---------------- component ---------------- */

const LessonPlanCRUD = () => {
  const navigate = useNavigate();

  const [lessonPlans, setLessonPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);

  // ✅ Create/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editId, setEditId] = useState(null);

  // ✅ View modal (replaces sidebar)
  const [showView, setShowView] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewPlan, setViewPlan] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState(null);

  // ✅ AI states
  const [aiBusy, setAiBusy] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);
  const [aiImportBusy, setAiImportBusy] = useState(false);
  const [aiImportInfo, setAiImportInfo] = useState(null);
  const lessonPlanImportInputRef = useRef(null);

  const [searchClass, setSearchClass] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [breakdown, setBreakdown] = useState(null);
  const [breakdownItems, setBreakdownItems] = useState([]);
  const [topicOptions, setTopicOptions] = useState([]);
  const [subtopicOptions, setSubtopicOptions] = useState([]);

  const [formData, setFormData] = useState({
    classId: "",
    subjectId: "",
    academicSession: "",
    term: "FULL_YEAR",
    weekStart: "",
    weekEnd: "",

    breakdownId: "",
    breakdownItemId: "",

    topic: "",
    subtopic: "",

    specificObjectives: "",
    teachingMethod: "",
    teachingAids: "",
    activities: "",
    resources: "",
    evaluationMethod: "",
    assessmentPlan: "",
    homework: "",
    remedialPlan: "",
    enrichmentPlan: "",
    plannedPeriods: "",

    status: "Draft",
    completionStatus: "Planned",
    remarks: "",
    publish: false,

    sections: [],
  });

  /* ---------------- SweetAlert (force on top) ---------------- */

  const fireTop = (opts) => {
    const incomingClass = opts?.customClass || {};

    return Swal.fire({
      target: document.body,
      ...opts,
      customClass: {
        ...incomingClass,
        container: `lesson-plan-swal-container ${incomingClass.container || ""}`.trim(),
      },
      didOpen: (el) => {
        try {
          const container = Swal.getContainer();
          el.style.setProperty("z-index", "20001", "important");
          if (container) container.style.setProperty("z-index", "20000", "important");
        } catch {}
        if (typeof opts?.didOpen === "function") opts.didOpen(el);
      },
    });
  };

  /* ---------------- modal safe switch helpers ---------------- */

  const closeView = async () => {
    setShowView(false);
    await sleep(320);
    setViewPlan(null);
    setViewLoading(false);
  };

  const closeCreateEdit = async () => {
    setShowModal(false);
    setAiBusy(false);
    setAiImportBusy(false);
    setAiImportInfo(null);
    if (lessonPlanImportInputRef.current) lessonPlanImportInputRef.current.value = "";
    await sleep(320);
    setEditing(false);
    setEditId(null);
    resetForm();
  };

  const safeSwitchToEdit = async (plan) => {
    if (showView) await closeView();
    await openEdit(plan);
  };

  const safeSwitchToView = async (plan) => {
    if (showModal) await closeCreateEdit();
    await openView(plan);
  };

  const openEvaluations = async (planId) => {
    if (!planId) return;
    if (showView) await closeView();
    if (showModal) await closeCreateEdit();
    navigate(`/lesson-plans/${planId}/evaluations`);
  };

  /* ---------------- data fetchers ---------------- */

  const fetchLessonPlans = async () => {
    setLoading(true);
    try {
      const res = await api.get("/lesson-plans");
      setLessonPlans(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      fireTop({ icon: "error", title: "Error", text: "Failed to fetch lesson plans" });
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const res = await api.get("/class-subject-teachers/teacher/class-subjects");
      const assignments = res.data?.assignments || [];

      const uniqById = (arr, getId) => {
        const seen = new Set();
        return arr.filter((x) => {
          const id = getId(x);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      };

      const cls = uniqById(assignments.map((a) => a.class).filter(Boolean), (c) => c.id);
      const sub = uniqById(assignments.map((a) => a.subject).filter(Boolean), (s) => s.id);

      setClasses(cls);
      setSubjects(sub);
    } catch (e) {
      fireTop({ icon: "error", title: "Error", text: "Failed to fetch class-subject assignments" });
    }
  };

  // ✅ UPDATED: supports param classId + class_id & response shapes
  const fetchSectionsForClass = async (classId) => {
    if (!classId) {
      setSections([]);
      return [];
    }
    try {
      const res = await api.get("/sections", {
        params: { classId, class_id: classId },
      });

      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.data || res.data?.sections || [];

      const arr = Array.isArray(list) ? list : [];
      setSections(arr);
      return arr;
    } catch (e) {
      setSections([]);
      return [];
    }
  };

  /**
   * ✅ Fetch syllabus breakdown items usable for lesson plan
   */
  const fetchBreakdownForPlan = async (params) => {
    const { classId, subjectId, term, academicSession } = params || {};
    if (!classId || !subjectId) {
      setBreakdown(null);
      setBreakdownItems([]);
      return [];
    }
    try {
      const res = await api.get("/syllabus-breakdowns/items-for-plan", {
        params: {
          classId,
          subjectId,
          term: term || "FULL_YEAR",
          academicSession: academicSession || undefined,
        },
      });

      const data = res.data || {};
      const bd =
        data.breakdown ||
        (data.breakdownId ? { id: data.breakdownId, status: data.status } : null);
      const items = Array.isArray(data.items) ? data.items : [];

      setBreakdown(bd);
      setBreakdownItems(items);

      return items;
    } catch (e) {
      setBreakdown(null);
      setBreakdownItems([]);
      return [];
    }
  };

  /* ---------------- PDF helpers ---------------- */

  const openBlobInNewTab = (blob, filename = "document.pdf") => {
    const url = window.URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => window.URL.revokeObjectURL(url), 30000);
  };

  const downloadLessonPlanPdf = async (planId, fileHint) => {
    if (!planId) return;
    setPdfBusyId(planId);
    try {
      const res = await api.get(`/lesson-plans/${planId}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const fname = fileHint ? `${fileHint}.pdf` : `LessonPlan_${planId}.pdf`;
      openBlobInNewTab(blob, fname);
    } catch (e) {
      console.error("PDF download error:", e);
      fireTop({ icon: "error", title: "Error", text: "Failed to generate/download PDF" });
    } finally {
      setPdfBusyId(null);
    }
  };

  useEffect(() => {
    fetchLessonPlans();
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- derived ---------------- */

  const classMap = useMemo(() => {
    const m = new Map();
    classes.forEach((c) => m.set(Number(c.id), c));
    return m;
  }, [classes]);

  const subjectMap = useMemo(() => {
    const m = new Map();
    subjects.forEach((s) => m.set(Number(s.id), s));
    return m;
  }, [subjects]);

  const filteredPlans = useMemo(() => {
    return (lessonPlans || []).filter((p) => {
      const byClass = !searchClass || Number(p.classId) === Number(searchClass);
      const bySubject = !searchSubject || Number(p.subjectId) === Number(searchSubject);
      const byTerm = !searchTerm || String(p.term || "") === String(searchTerm);
      return byClass && bySubject && byTerm;
    });
  }, [lessonPlans, searchClass, searchSubject, searchTerm]);

  // ✅ NEW: correct “Select All” state
  const allSelected = useMemo(() => {
    if (!sections.length) return false;
    const selected = Array.isArray(formData.sections) ? formData.sections : [];
    return sections.every((s) => selected.includes(Number(s.id)));
  }, [sections, formData.sections]);

  /* ---------------- form handlers ---------------- */

  const resetForm = () => {
    setFormData({
      classId: "",
      subjectId: "",
      academicSession: "",
      term: "FULL_YEAR",
      weekStart: "",
      weekEnd: "",

      breakdownId: "",
      breakdownItemId: "",

      topic: "",
      subtopic: "",

      specificObjectives: "",
      teachingMethod: "",
      teachingAids: "",
      activities: "",
      resources: "",
      evaluationMethod: "",
      assessmentPlan: "",
      homework: "",
      remedialPlan: "",
      enrichmentPlan: "",
      plannedPeriods: "",

      status: "Draft",
      completionStatus: "Planned",
      remarks: "",
      publish: false,

      sections: [],
    });

    setBreakdown(null);
    setBreakdownItems([]);
    setTopicOptions([]);
    setSubtopicOptions([]);
    setSections([]);

    setAiFilled(false);
    setAiBusy(false);
    setAiImportBusy(false);
    setAiImportInfo(null);
    if (lessonPlanImportInputRef.current) lessonPlanImportInputRef.current.value = "";
  };

  const openCreate = async () => {
    if (showView) await closeView();
    setEditing(false);
    setEditId(null);
    resetForm();
    setShowModal(true);
  };

  const openEdit = async (plan) => {
    setEditing(true);
    setEditId(plan.id);
    setAiFilled(false);
    setAiImportInfo(null);

    let full = plan;
    try {
      const res = await api.get(`/lesson-plans/${plan.id}`);
      full = res.data || plan;
    } catch {}

    const secIds =
      Array.isArray(full.Sections) && full.Sections.length
        ? full.Sections.map((s) => Number(s.id))
        : [];

    const next = {
      classId: full.classId || "",
      subjectId: full.subjectId || "",
      academicSession: full.academicSession || "",
      term: full.term || "FULL_YEAR",
      weekStart: fmtDate(full.weekStart),
      weekEnd: fmtDate(full.weekEnd),

      breakdownId: full.breakdownId || "",
      breakdownItemId: full.breakdownItemId || "",

      topic: full.topic || "",
      subtopic: full.subtopic || "",

      specificObjectives: full.specificObjectives || "",
      teachingMethod: full.teachingMethod || "",
      teachingAids: full.teachingAids || "",
      activities: full.activities || "",
      resources: full.resources || "",
      evaluationMethod: full.evaluationMethod || "",
      assessmentPlan: full.assessmentPlan || "",
      homework: full.homework || "",
      remedialPlan: full.remedialPlan || "",
      enrichmentPlan: full.enrichmentPlan || "",
      plannedPeriods: full.plannedPeriods ?? "",

      status: full.status || "Draft",
      completionStatus: full.completionStatus || "Planned",
      remarks: full.remarks || "",
      publish: !!full.publish,

      sections: secIds,
    };

    setFormData(next);

    await fetchSectionsForClass(next.classId);

    const items = await fetchBreakdownForPlan({
      classId: next.classId,
      subjectId: next.subjectId,
      term: next.term,
      academicSession: next.academicSession,
    });

    const selectedItem = (items || []).find(
      (it) => Number(it.id) === Number(next.breakdownItemId)
    );

    if (selectedItem) {
      setTopicOptions(splitList(selectedItem.topics));
      setSubtopicOptions(splitList(selectedItem.subtopics));
    } else {
      setTopicOptions([]);
      setSubtopicOptions([]);
    }

    setShowModal(true);
  };

  const openView = async (plan) => {
    setShowView(true);
    setViewLoading(true);
    setViewPlan(plan);

    try {
      const res = await api.get(`/lesson-plans/${plan.id}`);
      setViewPlan(res.data || plan);
    } catch {
      // keep whatever we had
    } finally {
      setViewLoading(false);
    }
  };

  const onField = async (name, value) => {
    const next = { ...formData, [name]: value };

    if (name === "classId") {
      next.sections = [];
      next.breakdownId = "";
      next.breakdownItemId = "";
      next.topic = "";
      next.subtopic = "";
      setTopicOptions([]);
      setSubtopicOptions([]);
      setBreakdown(null);
      setBreakdownItems([]);
      setAiFilled(false);

      setFormData(next);
      await fetchSectionsForClass(value);

      if (next.subjectId) {
        await fetchBreakdownForPlan({
          classId: value,
          subjectId: next.subjectId,
          term: next.term,
          academicSession: next.academicSession,
        });
      }
      return;
    }

    if (name === "subjectId") {
      next.breakdownId = "";
      next.breakdownItemId = "";
      next.topic = "";
      next.subtopic = "";
      setTopicOptions([]);
      setSubtopicOptions([]);
      setBreakdown(null);
      setBreakdownItems([]);
      setAiFilled(false);

      setFormData(next);

      if (next.classId) {
        await fetchBreakdownForPlan({
          classId: next.classId,
          subjectId: value,
          term: next.term,
          academicSession: next.academicSession,
        });
      }
      return;
    }

    if (name === "term") {
      next.breakdownId = "";
      next.breakdownItemId = "";
      next.topic = "";
      next.subtopic = "";
      setTopicOptions([]);
      setSubtopicOptions([]);
      setBreakdown(null);
      setBreakdownItems([]);
      setAiFilled(false);

      setFormData(next);

      if (next.classId && next.subjectId) {
        await fetchBreakdownForPlan({
          classId: next.classId,
          subjectId: next.subjectId,
          term: value,
          academicSession: next.academicSession,
        });
      }
      return;
    }

    if (name === "breakdownItemId") {
      const item = (breakdownItems || []).find((it) => Number(it.id) === Number(value));
      const tops = item ? splitList(item.topics) : [];
      const subs = item ? splitList(item.subtopics) : [];
      setTopicOptions(tops);
      setSubtopicOptions(subs);

      next.topic = "";
      next.subtopic = "";
      next.breakdownId = breakdown?.id || next.breakdownId || "";
      setAiFilled(false);
      setFormData(next);
      return;
    }

    if (name === "topic") {
      setAiFilled(false);
      setFormData(next);
      return;
    }

    setFormData(next);
  };

  const toggleSection = (sectionId, checked) => {
    const id = Number(sectionId);
    let next = Array.isArray(formData.sections) ? [...formData.sections] : [];
    if (checked) {
      if (!next.includes(id)) next.push(id);
    } else {
      next = next.filter((x) => Number(x) !== id);
    }
    setAiFilled(false);
    setFormData({ ...formData, sections: next });
  };

  const toggleAllSections = (checked) => {
    if (!checked) {
      setAiFilled(false);
      setFormData({ ...formData, sections: [] });
      return;
    }
    const ids = (sections || []).map((s) => Number(s.id)).filter(Boolean);
    setAiFilled(false);
    setFormData({ ...formData, sections: ids });
  };

  /* ---------------- ✅ AI: Generate with AI ---------------- */

  const buildAiPayload = () => {
    return {
      lessonPlanId: editing && editId ? Number(editId) : undefined,

      classId: Number(formData.classId),
      subjectId: Number(formData.subjectId),
      academicSession: safeStr(formData.academicSession).trim() || null,
      term: formData.term,
      weekStart: formData.weekStart,
      weekEnd: formData.weekEnd,

      breakdownId: formData.breakdownId ? Number(formData.breakdownId) : null,
      breakdownItemId: formData.breakdownItemId ? Number(formData.breakdownItemId) : null,

      topic: safeStr(formData.topic).trim() || null,
      subtopic: safeStr(formData.subtopic).trim() || null,

      sectionIds: Array.isArray(formData.sections)
        ? formData.sections.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
        : [],

      language: "en",
      status: formData.status,
      completionStatus: formData.completionStatus,
      publish: !!formData.publish,
    };
  };

  const applyAiToForm = (aiObj) => {
    const ai = aiObj?.ai || aiObj?.data?.ai || aiObj?.data || aiObj;
    if (!ai || typeof ai !== "object") return false;

    const patch = { ...formData };

    if (ai.specificObjectives != null) patch.specificObjectives = safeStr(ai.specificObjectives);
    if (ai.teachingMethod != null) patch.teachingMethod = safeStr(ai.teachingMethod);
    if (ai.teachingAids != null) patch.teachingAids = safeStr(ai.teachingAids);
    if (ai.activities != null) patch.activities = safeStr(ai.activities);
    if (ai.resources != null) patch.resources = safeStr(ai.resources);

    if (ai.evaluationMethod != null) patch.evaluationMethod = safeStr(ai.evaluationMethod);
    if (ai.assessmentPlan != null) patch.assessmentPlan = safeStr(ai.assessmentPlan);

    if (ai.homework != null) patch.homework = safeStr(ai.homework);
    if (ai.remedialPlan != null) patch.remedialPlan = safeStr(ai.remedialPlan);
    if (ai.enrichmentPlan != null) patch.enrichmentPlan = safeStr(ai.enrichmentPlan);

    if (ai.plannedPeriods != null && !Number.isNaN(Number(ai.plannedPeriods))) {
      patch.plannedPeriods = String(Number(ai.plannedPeriods));
    }

    if (ai.remarks != null) patch.remarks = safeStr(ai.remarks);

    setFormData(patch);
    setAiFilled(true);
    return true;
  };

  const aiEnabled = useMemo(() => {
    return !!formData.classId && !!safeStr(formData.topic).trim();
  }, [formData.classId, formData.topic]);

  const generateWithAI = async () => {
    if (aiBusy) return;

    if (!formData.classId || !safeStr(formData.topic).trim()) {
      fireTop({
        icon: "warning",
        title: "Missing",
        text: "Please select Class and Topic first to use AI ✨",
      });
      return;
    }

    if (!formData.subjectId || !formData.weekStart || !formData.weekEnd) {
      fireTop({
        icon: "warning",
        title: "Missing",
        text: "Please select Subject, Week Start and Week End also.",
      });
      return;
    }

    setAiBusy(true);
    try {
      const payload = buildAiPayload();
      const res = await api.post("/api/ai/lesson-plan/generate", payload);

      const ok = applyAiToForm(res?.data);
      if (!ok) {
        fireTop({
          icon: "warning",
          title: "AI",
          text: "AI response received but could not map fields. Check AI JSON keys.",
        });
        return;
      }

      if (res?.data?.data?.lessonPlanId) {
        setEditing(true);
        setEditId(res.data.data.lessonPlanId);
      }

      fireTop({
        icon: "success",
        title: "✨ AI filled your lesson plan",
        text: "Review & Save.",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("AI generate error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "AI generation failed. Please try again.";
      fireTop({ icon: "error", title: "AI Error", text: msg });
    } finally {
      setAiBusy(false);
    }
  };

  /* ---------------- ✅ AI: Import PDF / handwriting ---------------- */

  const lessonPlanImportEnabled = useMemo(() => {
    return !!formData.classId && !!formData.subjectId;
  }, [formData.classId, formData.subjectId]);

  const openLessonPlanImportPicker = () => {
    if (aiBusy || aiImportBusy || saving) return;
    if (!lessonPlanImportEnabled) {
      fireTop({
        icon: "warning",
        title: "Select Class & Subject",
        text: "Please select Class and Subject first. Then upload the handwritten lesson plan, image or PDF.",
      });
      return;
    }
    lessonPlanImportInputRef.current?.click();
  };

  const applyImportedLessonPlan = (responseData) => {
    const draft = responseData?.plan || responseData?.data?.plan || null;
    if (!draft || typeof draft !== "object") return false;

    const next = { ...formData };
    const setText = (target, source) => {
      if (source != null && safeStr(source).trim()) next[target] = safeStr(source).trim();
    };

    setText("academicSession", draft.academic_session);
    if (["FULL_YEAR", "TERM1", "TERM2"].includes(safeStr(draft.term).toUpperCase())) {
      next.term = safeStr(draft.term).toUpperCase();
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(safeStr(draft.week_start))) next.weekStart = draft.week_start;
    if (/^\d{4}-\d{2}-\d{2}$/.test(safeStr(draft.week_end))) next.weekEnd = draft.week_end;

    setText("topic", draft.topic);
    setText("subtopic", draft.subtopic);
    setText("specificObjectives", draft.specific_objectives);
    setText("teachingMethod", draft.teaching_method);
    setText("teachingAids", draft.teaching_aids);
    setText("activities", draft.activities);
    setText("resources", draft.resources);
    setText("evaluationMethod", draft.evaluation_method);
    setText("assessmentPlan", draft.assessment_plan);
    setText("homework", draft.homework);
    setText("remedialPlan", draft.remedial_plan);
    setText("enrichmentPlan", draft.enrichment_plan);
    setText("remarks", draft.remarks);

    if (draft.planned_periods != null && Number.isFinite(Number(draft.planned_periods))) {
      next.plannedPeriods = String(Math.max(1, Math.round(Number(draft.planned_periods))));
    }

    const importedTopic = safeStr(draft.topic).trim();
    const importedSubtopic = safeStr(draft.subtopic).trim();
    if (importedTopic) {
      setTopicOptions((prev) =>
        prev.includes(importedTopic) ? prev : [importedTopic, ...prev]
      );
    }
    if (importedSubtopic) {
      setSubtopicOptions((prev) =>
        prev.includes(importedSubtopic) ? prev : [importedSubtopic, ...prev]
      );
    }

    const doc = responseData?.document || {};
    const combinedWarnings = [
      ...(Array.isArray(responseData?.warnings) ? responseData.warnings : []),
      ...(Array.isArray(draft?.warnings) ? draft.warnings : []),
    ].filter(Boolean);
    const confidence = Number(draft?.confidence || doc?.confidence || 0);

    setFormData(next);
    setAiFilled(true);
    setAiImportInfo({
      fileName: responseData?._fileName || "Uploaded lesson plan",
      language: safeStr(doc?.detected_language).trim(),
      confidence: Number.isFinite(confidence) ? confidence : 0,
      warnings: Array.from(new Set(combinedWarnings)),
    });
    return true;
  };

  const handleLessonPlanImportFile = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    try {
      if (!lessonPlanImportEnabled) {
        fireTop({
          icon: "warning",
          title: "Select Class & Subject",
          text: "Please select Class and Subject first.",
        });
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        fireTop({
          icon: "warning",
          title: "File too large",
          text: "Please choose a PDF or image up to 25 MB.",
        });
        return;
      }

      setAiImportBusy(true);
      setAiImportInfo(null);

      const body = new FormData();
      body.append("lesson_plan_document", file);
      body.append("classId", String(formData.classId));
      body.append("subjectId", String(formData.subjectId));
      body.append("academicSession", safeStr(formData.academicSession).trim());
      body.append("term", safeStr(formData.term || "FULL_YEAR"));

      const res = await api.post("/api/ai/lesson-plan/analyze-document", body);
      const data = { ...(res?.data || {}), _fileName: file.name };
      const draft = data?.plan;
      if (!draft || typeof draft !== "object") {
        throw new Error("AI response did not contain a lesson plan draft.");
      }

      const doc = data?.document || {};
      const confidence = Number(draft?.confidence || doc?.confidence || 0);
      const pct = confidence > 0 ? `${Math.round(confidence * 100)}%` : "not available";
      const warnings = [
        ...(Array.isArray(data?.warnings) ? data.warnings : []),
        ...(Array.isArray(draft?.warnings) ? draft.warnings : []),
      ].filter(Boolean);
      const summary = [
        `Topic: ${safeStr(draft.topic).trim() || "Needs review"}`,
        doc?.detected_language ? `Language: ${doc.detected_language}` : null,
        `AI confidence: ${pct}`,
        warnings.length ? `${warnings.length} item(s) need review.` : "No special warnings detected.",
        "Nothing will be saved until you review the form and click Create/Update Lesson Plan.",
      ]
        .filter(Boolean)
        .join("\n");

      const confirm = await fireTop({
        icon: warnings.length ? "warning" : "info",
        title: "AI lesson plan draft ready",
        text: summary,
        showCancelButton: true,
        confirmButtonText: "Use Draft",
        cancelButtonText: "Cancel",
        reverseButtons: true,
      });

      if (confirm.isConfirmed) {
        const applied = applyImportedLessonPlan(data);
        if (!applied) throw new Error("Could not map the AI lesson plan fields to the form.");
        fireTop({
          icon: "success",
          title: "Draft added to the form",
          text: "Please review the imported fields before saving.",
          timer: 1700,
          showConfirmButton: false,
        });
      }
    } catch (e) {
      console.error("AI lesson plan import error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Could not read this lesson plan. Try a clearer PDF or scan.";
      fireTop({ icon: "error", title: "AI Import Error", text: msg });
    } finally {
      setAiImportBusy(false);
      if (event?.target) event.target.value = "";
    }
  };

  /* ---------------- submit/delete/publish ---------------- */

  const showAfterModal = (swalOptions) => {
    setTimeout(() => {
      fireTop(swalOptions);
    }, 320);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.classId || !formData.subjectId || !formData.weekStart || !formData.weekEnd) {
      fireTop({
        icon: "error",
        title: "Error",
        text: "Class, Subject, Week Start and Week End are required.",
      });
      return;
    }

    if (!formData.sections || formData.sections.length === 0) {
      const r = await fireTop({
        title: "No sections selected",
        text: "Do you want to continue without selecting sections?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Continue",
      });
      if (!r.isConfirmed) return;
    }

    const payload = {
      classId: Number(formData.classId),
      subjectId: Number(formData.subjectId),
      academicSession: safeStr(formData.academicSession).trim() || null,
      term: formData.term,
      weekStart: formData.weekStart,
      weekEnd: formData.weekEnd,
      breakdownId: formData.breakdownId ? Number(formData.breakdownId) : null,
      breakdownItemId: formData.breakdownItemId ? Number(formData.breakdownItemId) : null,
      topic: safeStr(formData.topic).trim() || null,
      subtopic: safeStr(formData.subtopic).trim() || null,
      specificObjectives: formData.specificObjectives || null,
      teachingMethod: formData.teachingMethod || null,
      teachingAids: formData.teachingAids || null,
      activities: formData.activities || null,
      resources: formData.resources || null,
      evaluationMethod: formData.evaluationMethod || null,
      assessmentPlan: formData.assessmentPlan || null,
      homework: formData.homework || null,
      remedialPlan: formData.remedialPlan || null,
      enrichmentPlan: formData.enrichmentPlan || null,
      plannedPeriods: formData.plannedPeriods ? Number(formData.plannedPeriods) : null,
      status: formData.status,
      completionStatus: formData.completionStatus,
      remarks: formData.remarks || null,
      publish: !!formData.publish,
      sections: Array.isArray(formData.sections)
        ? formData.sections.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
        : [],
    };

    setSaving(true);
    try {
      const wasEditing = !!editing;

      if (editing) {
        await api.put(`/lesson-plans/${editId}`, payload);
      } else {
        await api.post("/lesson-plans", payload);
      }

      await closeCreateEdit();
      showAfterModal({
        icon: "success",
        title: wasEditing ? "Lesson plan updated successfully" : "Lesson plan created successfully",
        timer: 1500,
        showConfirmButton: false,
      });

      fetchLessonPlans();
    } catch (error) {
      console.error("Error saving lesson plan:", error);
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        "Failed to save lesson plan";
      fireTop({ icon: "error", title: "Error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await fireTop({
      title: "Are you sure?",
      text: "This will delete the lesson plan permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete(`/lesson-plans/${id}`);
      fireTop({ icon: "success", title: "Deleted!", text: "Lesson plan has been deleted." });
      if (showView) await closeView();
      fetchLessonPlans();
    } catch (error) {
      fireTop({ icon: "error", title: "Error", text: "Failed to delete lesson plan" });
    }
  };

  const togglePublish = async (plan) => {
    try {
      const newPublish = !plan.publish;
      await api.put(`/lesson-plans/${plan.id}`, { publish: newPublish });
      fireTop({
        icon: "success",
        title: "Success",
        text: `Lesson plan ${newPublish ? "published" : "unpublished"} successfully`,
      });
      fetchLessonPlans();
    } catch (e) {
      fireTop({ icon: "error", title: "Error", text: "Failed to update publish status" });
    }
  };

  const titleLine = (p) => {
    const cls = classMap.get(Number(p.classId));
    const sub = subjectMap.get(Number(p.subjectId));
    return `${safeStr(cls?.class_name || p.classId)} • ${safeStr(sub?.name || p.subjectId)}`;
  };

  const makePdfFileHint = (p) => {
    const base = `${titleLine(p)}_${fmtDate(p.weekStart)}_${fmtDate(p.weekEnd)}`;
    return base.replace(/[^\w\-]+/g, "_").replace(/\_+/g, "_");
  };

  const modalBodyStyle = {
    maxHeight: "calc(100vh - 210px)",
    overflowY: "auto",
    paddingBottom: 16,
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="container-fluid py-3">
      <Row className="g-3 align-items-center mb-2">
        <Col xs={12} md={6}>
          <h4 className="mb-0">Lesson Plans</h4>
          <div className="text-muted small">
            Weekly plans linked to Syllabus Breakdown + applicable to multiple sections.
          </div>
        </Col>

        <Col xs={12} md={6} className="d-flex flex-column flex-md-row justify-content-md-end gap-2">
          <Button variant="primary" onClick={openCreate} className="w-100 w-md-auto">
            + Create Lesson Plan
          </Button>
          <Button
            variant="outline-secondary"
            onClick={fetchLessonPlans}
            disabled={loading}
            className="w-100 w-md-auto"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <Row className="g-2">
            <Col xs={12} md={4}>
              <Form.Group>
                <Form.Label className="small mb-1">Filter by Class</Form.Label>
                <Form.Select value={searchClass} onChange={(e) => setSearchClass(e.target.value)}>
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} md={4}>
              <Form.Group>
                <Form.Label className="small mb-1">Filter by Subject</Form.Label>
                <Form.Select value={searchSubject} onChange={(e) => setSearchSubject(e.target.value)}>
                  <option value="">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>

            <Col xs={12} md={4}>
              <Form.Group>
                <Form.Label className="small mb-1">Filter by Term</Form.Label>
                <Form.Select value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}>
                  <option value="">All Terms</option>
                  {termOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Row className="g-3">
        {/* List */}
        <Col xs={12}>
          <Card className="shadow-sm border-0">
            <Card.Header className="d-flex align-items-center justify-content-between bg-white">
              <div className="fw-semibold">My Lesson Plans</div>
              <div className="text-muted small">
                {filteredPlans.length} plan{filteredPlans.length === 1 ? "" : "s"}
              </div>
            </Card.Header>

            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 70 }}>#</th>
                      <th>Class • Subject</th>
                      <th style={{ minWidth: 160 }}>Week</th>
                      <th style={{ minWidth: 140 }}>Status</th>
                      <th style={{ width: 360 }}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-5">
                          <Spinner animation="border" size="sm" className="me-2" />
                          Loading...
                        </td>
                      </tr>
                    ) : filteredPlans.length ? (
                      filteredPlans.map((p) => {
                        const st = asUpper(p.status || "DRAFT");
                        const cs = asUpper(p.completionStatus || "PLANNED");
                        return (
                          <tr key={p.id}>
                            <td className="text-muted">{p.id}</td>

                            <td>
                              <div className="fw-semibold">{titleLine(p)}</div>
                              <div className="text-muted small">
                                {safeStr(p.topic || "")}
                                {p.subtopic ? ` • ${p.subtopic}` : ""}
                                {p.breakdownItemId ? ` • Unit#${p.breakdownItemId}` : ""}
                              </div>
                            </td>

                            <td>
                              <div className="small">
                                <span className="fw-semibold">{toPrettyDate(p.weekStart)}</span>{" "}
                                <span className="text-muted">to</span>{" "}
                                <span className="fw-semibold">{toPrettyDate(p.weekEnd)}</span>
                              </div>
                              <div className="text-muted small">
                                Term: {safeStr(p.term || "-")}{" "}
                                {p.academicSession ? `• Session: ${p.academicSession}` : ""}
                              </div>
                            </td>

                            <td>
                              <div className="d-flex flex-wrap gap-2">
                                <Badge bg={statusVariant(st)}>{st}</Badge>
                                <Badge bg={completionVariant(cs)}>{cs}</Badge>
                                {p.publish ? (
                                  <Badge bg="success">Published</Badge>
                                ) : (
                                  <Badge bg="secondary">Hidden</Badge>
                                )}
                              </div>
                            </td>

                            <td>
                              <div className="d-flex flex-wrap gap-2">
                                <Button size="sm" variant="outline-primary" onClick={() => safeSwitchToView(p)}>
                                  View
                                </Button>

                                <Button size="sm" variant="primary" onClick={() => safeSwitchToEdit(p)}>
                                  Edit
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  onClick={() => openEvaluations(p.id)}
                                  title="Create / Publish / Results / Analytics"
                                >
                                  Evaluations
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline-dark"
                                  disabled={pdfBusyId === p.id}
                                  onClick={() => downloadLessonPlanPdf(p.id, makePdfFileHint(p))}
                                >
                                  {pdfBusyId === p.id ? "PDF..." : "PDF"}
                                </Button>

                                <Button
                                  size="sm"
                                  variant={p.publish ? "success" : "outline-success"}
                                  onClick={() => togglePublish(p)}
                                >
                                  {p.publish ? "Unpublish" : "Publish"}
                                </Button>

                                <Button size="sm" variant="outline-danger" onClick={() => handleDelete(p.id)}>
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-5 text-muted">
                          No lesson plans yet. Click <b>Create Lesson Plan</b>.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ✅ View Modal */}
      <Modal
        show={showView}
        onHide={() => closeView()}
        size="lg"
        centered
        backdrop="static"
        keyboard={true}
        contentClassName="border-0"
      >
        <Modal.Header closeButton className="bg-white">
          <Modal.Title className="d-flex align-items-center justify-content-between w-100">
            <span>Lesson Plan Details</span>

            <span className="d-flex gap-2">
              {viewPlan?.id ? (
                <Button size="sm" variant="outline-secondary" onClick={() => openEvaluations(viewPlan.id)}>
                  Evaluations
                </Button>
              ) : null}

              {viewPlan?.id ? (
                <Button
                  size="sm"
                  variant="outline-dark"
                  disabled={pdfBusyId === viewPlan.id}
                  onClick={() => downloadLessonPlanPdf(viewPlan.id, makePdfFileHint(viewPlan))}
                >
                  {pdfBusyId === viewPlan.id ? "PDF..." : "Download PDF"}
                </Button>
              ) : null}
            </span>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {viewLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" className="me-2" />
              Loading...
            </div>
          ) : !viewPlan ? (
            <div className="text-muted">No plan selected.</div>
          ) : (
            <>
              <div className="mb-2">
                <div className="fw-semibold">{titleLine(viewPlan)}</div>
                <div className="text-muted small">
                  {toPrettyDate(viewPlan.weekStart)} → {toPrettyDate(viewPlan.weekEnd)}
                </div>
              </div>

              <Row className="g-2 mb-3">
                <Col xs="auto">
                  <Badge bg={statusVariant(asUpper(viewPlan.status))}>{asUpper(viewPlan.status)}</Badge>
                </Col>
                <Col xs="auto">
                  <Badge bg={completionVariant(asUpper(viewPlan.completionStatus))}>
                    {asUpper(viewPlan.completionStatus)}
                  </Badge>
                </Col>
                <Col xs="auto">
                  {viewPlan.publish ? <Badge bg="success">Published</Badge> : <Badge bg="secondary">Hidden</Badge>}
                </Col>
              </Row>

              <Card className="border-0 shadow-sm mb-3">
                <Card.Body>
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div className="text-muted small">Topic</div>
                      <div className="fw-semibold">
                        {safeStr(viewPlan.topic || "-")}
                        {viewPlan.subtopic ? ` • ${viewPlan.subtopic}` : ""}
                      </div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div className="text-muted small">Term</div>
                      <div className="fw-semibold">{safeStr(viewPlan.term || "-")}</div>
                    </Col>
                    <Col xs={6} md={3}>
                      <div className="text-muted small">Session</div>
                      <div className="fw-semibold">{safeStr(viewPlan.academicSession || "-")}</div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Accordion alwaysOpen defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                  <Accordion.Header>Objectives & Teaching</Accordion.Header>
                  <Accordion.Body>
                    <div className="mb-2">
                      <div className="text-muted small">Specific Objectives</div>
                      <div className="fw-semibold">{safeStr(viewPlan.specificObjectives || "-")}</div>
                    </div>

                    <Row className="g-3">
                      <Col xs={12} md={6}>
                        <div className="text-muted small">Teaching Method</div>
                        <div className="fw-semibold">{safeStr(viewPlan.teachingMethod || "-")}</div>
                      </Col>
                      <Col xs={12} md={6}>
                        <div className="text-muted small">Teaching Aids</div>
                        <div className="fw-semibold">{safeStr(viewPlan.teachingAids || "-")}</div>
                      </Col>
                    </Row>

                    <hr />

                    <div className="mb-2">
                      <div className="text-muted small">Activities</div>
                      <div className="fw-semibold">{safeStr(viewPlan.activities || "-")}</div>
                    </div>

                    <div>
                      <div className="text-muted small">Resources</div>
                      <div className="fw-semibold">{safeStr(viewPlan.resources || "-")}</div>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>

                <Accordion.Item eventKey="1">
                  <Accordion.Header>Evaluation, Homework & Notes</Accordion.Header>
                  <Accordion.Body>
                    <Row className="g-3">
                      <Col xs={12} md={6}>
                        <div className="text-muted small">Evaluation Method</div>
                        <div className="fw-semibold">{safeStr(viewPlan.evaluationMethod || "-")}</div>
                      </Col>
                      <Col xs={12} md={6}>
                        <div className="text-muted small">Assessment Plan</div>
                        <div className="fw-semibold">{safeStr(viewPlan.assessmentPlan || "-")}</div>
                      </Col>
                    </Row>

                    <hr />

                    <div className="mb-2">
                      <div className="text-muted small">Homework</div>
                      <div className="fw-semibold">{safeStr(viewPlan.homework || "-")}</div>
                    </div>

                    <Row className="g-3">
                      <Col xs={12} md={6}>
                        <div className="text-muted small">Remedial Plan</div>
                        <div className="fw-semibold">{safeStr(viewPlan.remedialPlan || "-")}</div>
                      </Col>
                      <Col xs={12} md={6}>
                        <div className="text-muted small">Enrichment Plan</div>
                        <div className="fw-semibold">{safeStr(viewPlan.enrichmentPlan || "-")}</div>
                      </Col>
                    </Row>

                    <hr />

                    <div>
                      <div className="text-muted small">Remarks</div>
                      <div className="fw-semibold">{safeStr(viewPlan.remarks || "-")}</div>
                    </div>
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            </>
          )}
        </Modal.Body>

        <Modal.Footer className="bg-white">
          <Button variant="outline-secondary" onClick={() => closeView()}>
            Close
          </Button>
          {viewPlan?.id ? (
            <Button variant="primary" onClick={() => safeSwitchToEdit(viewPlan)}>
              Edit this Plan
            </Button>
          ) : null}
        </Modal.Footer>
      </Modal>

      {/* ✅ Create/Edit Modal */}
      <Modal
        show={showModal}
        onHide={() => closeCreateEdit()}
        size="xl"
        centered
        backdrop="static"
        keyboard={false}
        fullscreen="md-down"
        dialogClassName="lesson-plan-modal-dialog lesson-plan-notebook-dialog"
        contentClassName="border-0 lesson-plan-modal-content lesson-plan-notebook-content"
      >
        <Modal.Header closeButton className="lesson-plan-notebook-header">
          <div className="w-100">
            <div className="lp-notebook-kicker">TEACHER LESSON NOTEBOOK</div>
            <Modal.Title className="d-flex align-items-center justify-content-between gap-2">
              <span className="d-flex align-items-center gap-2">
                <span>{editing ? "Edit Lesson Plan" : "Create Lesson Plan"}</span>
                {aiFilled ? <Badge bg="info">AI Suggested</Badge> : null}
              </span>

              <span className="d-flex align-items-center gap-2 flex-wrap">
                <span className="d-none d-md-inline">
                  <Badge bg={statusVariant(asUpper(formData.status))} className="me-2">
                    {asUpper(formData.status)}
                  </Badge>
                  <Badge bg={completionVariant(asUpper(formData.completionStatus))}>
                    {asUpper(formData.completionStatus)}
                  </Badge>
                </span>

                {editing && editId ? (
                  <Button size="sm" variant="outline-secondary" onClick={() => openEvaluations(editId)}>
                    Evaluations
                  </Button>
                ) : null}

                <input
                  ref={lessonPlanImportInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="d-none"
                  onChange={handleLessonPlanImportFile}
                />

                <Button
                  size="sm"
                  variant={lessonPlanImportEnabled ? "outline-primary" : "outline-secondary"}
                  onClick={openLessonPlanImportPicker}
                  disabled={aiImportBusy || aiBusy || saving}
                  title={
                    lessonPlanImportEnabled
                      ? "Import a PDF, screenshot, scan or handwritten lesson plan with AI"
                      : "Select Class and Subject first"
                  }
                >
                  {aiImportBusy ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" /> Reading...
                    </>
                  ) : (
                    "📄 AI Import PDF / Handwriting"
                  )}
                </Button>

                <Button
                  size="sm"
                  variant={aiEnabled ? "dark" : "outline-dark"}
                  onClick={generateWithAI}
                  disabled={!aiEnabled || aiBusy || saving}
                  title={aiEnabled ? "Generate lesson plan content with AI" : "Select Class and Topic first"}
                >
                  {aiBusy ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" /> Generating...
                    </>
                  ) : (
                    "✨ Generate with AI"
                  )}
                </Button>

                {editing && editId ? (
                  <Button
                    size="sm"
                    variant="outline-dark"
                    disabled={pdfBusyId === editId}
                    onClick={() =>
                      downloadLessonPlanPdf(
                        editId,
                        `LessonPlan_${editId}_${fmtDate(formData.weekStart)}_${fmtDate(formData.weekEnd)}`
                      )
                    }
                  >
                    {pdfBusyId === editId ? "PDF..." : "Preview PDF"}
                  </Button>
                ) : null}
              </span>
            </Modal.Title>
          </div>
        </Modal.Header>

        <Form onSubmit={handleSubmit}>
          <Modal.Body style={modalBodyStyle} className="lesson-plan-notebook-body">
            {aiImportInfo ? (
              <div
                className={`alert mb-3 ${
                  aiImportInfo.warnings?.length ? "alert-warning" : "alert-info"
                }`}
                role="alert"
              >
                <div className="fw-semibold">📄 AI imported draft — review before saving</div>
                <div className="small mt-1">
                  {aiImportInfo.fileName}
                  {aiImportInfo.language ? ` • ${aiImportInfo.language}` : ""}
                  {aiImportInfo.confidence > 0
                    ? ` • ${Math.round(aiImportInfo.confidence * 100)}% confidence`
                    : ""}
                </div>
                {aiImportInfo.warnings?.length ? (
                  <div className="small mt-1">
                    {aiImportInfo.warnings.slice(0, 3).join(" • ")}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="lesson-plan-notebook-shell">
              <section className="lp-context-card">
                <div className="lp-context-heading">
                  <div>
                    <div className="lp-section-eyebrow">SET THE CONTEXT</div>
                    <h5 className="mb-1">Lesson Context</h5>
                    <div className="text-muted small">Keep the essentials compact; spend the space on actual teaching notes.</div>
                  </div>
                  <div className="lp-status-pills d-md-none">
                    <Badge bg={statusVariant(asUpper(formData.status))}>{asUpper(formData.status)}</Badge>
                    <Badge bg={completionVariant(asUpper(formData.completionStatus))}>{asUpper(formData.completionStatus)}</Badge>
                  </div>
                </div>

                <div className="lp-primary-choice-stack mt-3">
                  <ChoiceButtons
                    label="Class *"
                    options={classes.map((c) => ({ value: c.id, label: c.class_name }))}
                    value={formData.classId}
                    onChange={(value) => onField("classId", value)}
                    emptyText="No assigned classes found"
                    scroll
                  />

                  <ChoiceButtons
                    label="Subject *"
                    options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
                    value={formData.subjectId}
                    onChange={(value) => onField("subjectId", value)}
                    emptyText="No assigned subjects found"
                    scroll
                  />

                  <ChoiceButtons
                    label="Term"
                    options={termOptions}
                    value={formData.term}
                    onChange={(value) => onField("term", value)}
                    dense
                  />
                </div>

                <Row className="g-3 mt-1 lp-context-fields">
                  <Col xs={12} md={4}>
                    <Form.Group>
                      <Form.Label className="lp-compact-label">Week Start *</Form.Label>
                      <Form.Control
                        className="lp-compact-control"
                        type="date"
                        value={formData.weekStart}
                        onChange={(e) => onField("weekStart", e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col xs={12} md={4}>
                    <Form.Group>
                      <Form.Label className="lp-compact-label">Week End *</Form.Label>
                      <Form.Control
                        className="lp-compact-control"
                        type="date"
                        value={formData.weekEnd}
                        onChange={(e) => onField("weekEnd", e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>

                  <Col xs={12} md={4}>
                    <Form.Group>
                      <Form.Label className="lp-compact-label">Academic Session</Form.Label>
                      <Form.Control
                        className="lp-compact-control"
                        placeholder="2026-27"
                        value={formData.academicSession}
                        onChange={(e) => onField("academicSession", e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <div className="lp-sections-row">
                  <div className="lp-sections-label">
                    <span>Applicable Sections</span>
                    <Form.Check
                      type="switch"
                      id="toggleAllSections"
                      label="All"
                      checked={allSelected}
                      disabled={!formData.classId || sections.length === 0}
                      onChange={(e) => toggleAllSections(e.target.checked)}
                    />
                  </div>
                  <div className="lp-section-chips">
                    {!formData.classId ? (
                      <span className="lp-empty-note">Choose a class to load sections.</span>
                    ) : sections.length === 0 ? (
                      <span className="lp-empty-note">No sections found for this class.</span>
                    ) : (
                      sections.map((section) => {
                        const checked = formData.sections?.includes(Number(section.id));
                        return (
                          <label key={section.id} className={`lp-section-chip ${checked ? "active" : ""}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleSection(section.id, e.target.checked)}
                            />
                            <span>{section.section_name || section.name || `#${section.id}`}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>

              <section className="lp-notebook-paper">
                <div className="lp-paper-title-row">
                  <div>
                    <div className="lp-section-eyebrow">WRITE THE LESSON</div>
                    <h5 className="mb-1">Teaching Notebook</h5>
                    <div className="text-muted small">Write naturally. Notes grow as you type, so nothing gets hidden inside a small field.</div>
                  </div>
                  <span className="lp-auto-grow-badge">Auto-expanding notes</span>
                </div>

                <div className="lp-notebook-section lp-syllabus-focus">
                  <div className="lp-notebook-section-title">
                    <span className="lp-section-number">01</span>
                    <div>
                      <strong>Syllabus Focus</strong>
                      <small>Pick the unit/topic already planned in Syllabus Breakdown.</small>
                    </div>
                  </div>

                  <div className="lp-syllabus-choice-stack mt-1">
                    <ChoiceButtons
                      label="Unit / Breakdown Item"
                      options={breakdownItems.map((item) => ({
                        value: item.id,
                        label: `${item.unitNumber ? `${item.unitNumber} - ` : ""}${item.unitTitle || `Unit #${item.id}`}`,
                      }))}
                      value={formData.breakdownItemId}
                      onChange={(value) => onField("breakdownItemId", value)}
                      disabled={!formData.classId || !formData.subjectId}
                      emptyText={
                        formData.classId && formData.subjectId
                          ? "No breakdown items found"
                          : "Select Class & Subject first"
                      }
                      scroll
                    />
                    {breakdown ? (
                      <div className="lp-inline-hint">Breakdown #{breakdown.id}{breakdown.status ? ` • ${breakdown.status}` : ""}</div>
                    ) : null}

                    <ChoiceButtons
                      label="Topic"
                      options={topicOptions.map((topic) => ({ value: topic, label: topic }))}
                      value={formData.topic}
                      onChange={(value) => onField("topic", value)}
                      disabled={!topicOptions.length}
                      emptyText="Select a unit to load topics"
                      scroll
                    />

                    <ChoiceButtons
                      label="Subtopic"
                      options={subtopicOptions.map((subtopic) => ({ value: subtopic, label: subtopic }))}
                      value={formData.subtopic}
                      onChange={(value) => onField("subtopic", value)}
                      disabled={!subtopicOptions.length}
                      emptyText="Select a unit to load subtopics"
                      scroll
                    />
                  </div>
                </div>

                <div className="lp-notebook-section">
                  <div className="lp-notebook-section-title">
                    <span className="lp-section-number">02</span>
                    <div>
                      <strong>Learning Intention</strong>
                      <small>What should students understand or be able to do?</small>
                    </div>
                  </div>
                  <div className="lp-writing-block">
                    <label>Specific Objectives</label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      className="lp-writing-area"
                      placeholder="Write the learning objectives here..."
                      value={formData.specificObjectives}
                      onChange={(e) => onField("specificObjectives", e.target.value)}
                      onInput={growNotebookTextarea}
                    />
                  </div>
                </div>

                <div className="lp-notebook-section">
                  <div className="lp-notebook-section-title">
                    <span className="lp-section-number">03</span>
                    <div>
                      <strong>Teaching Notes</strong>
                      <small>How you plan to explain, demonstrate and engage the class.</small>
                    </div>
                  </div>

                  <div className="lp-writing-grid">
                    <div className="lp-writing-block">
                      <label>Teaching Method</label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        className="lp-writing-area lp-writing-area-compact"
                        placeholder="Lecture, demonstration, discussion, group work..."
                        value={formData.teachingMethod}
                        onChange={(e) => onField("teachingMethod", e.target.value)}
                        onInput={growNotebookTextarea}
                      />
                    </div>
                    <div className="lp-writing-block">
                      <label>Teaching Aids</label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        className="lp-writing-area lp-writing-area-compact"
                        placeholder="Smartboard, charts, lab material, models..."
                        value={formData.teachingAids}
                        onChange={(e) => onField("teachingAids", e.target.value)}
                        onInput={growNotebookTextarea}
                      />
                    </div>
                  </div>

                  <div className="lp-writing-block">
                    <label>Classroom Activities</label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      className="lp-writing-area"
                      placeholder="Write the activity sequence, examples, discussion prompts or student tasks..."
                      value={formData.activities}
                      onChange={(e) => onField("activities", e.target.value)}
                      onInput={growNotebookTextarea}
                    />
                  </div>

                  <div className="lp-writing-block">
                    <label>Resources / Material</label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      className="lp-writing-area"
                      placeholder="Books, links, worksheets, videos, reference material..."
                      value={formData.resources}
                      onChange={(e) => onField("resources", e.target.value)}
                      onInput={growNotebookTextarea}
                    />
                  </div>
                </div>

                <div className="lp-notebook-section">
                  <div className="lp-notebook-section-title">
                    <span className="lp-section-number">04</span>
                    <div>
                      <strong>Check Learning & Homework</strong>
                      <small>How learning will be checked and what students will continue at home.</small>
                    </div>
                  </div>

                  <div className="lp-writing-grid">
                    <div className="lp-writing-block">
                      <label>Evaluation Method</label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        className="lp-writing-area lp-writing-area-compact"
                        placeholder="Oral questions, quiz, practical, worksheet..."
                        value={formData.evaluationMethod}
                        onChange={(e) => onField("evaluationMethod", e.target.value)}
                        onInput={growNotebookTextarea}
                      />
                    </div>
                    <div className="lp-writing-block">
                      <label>Assessment Plan</label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        className="lp-writing-area lp-writing-area-compact"
                        placeholder="Criteria, rubric, short test or evidence of learning..."
                        value={formData.assessmentPlan}
                        onChange={(e) => onField("assessmentPlan", e.target.value)}
                        onInput={growNotebookTextarea}
                      />
                    </div>
                  </div>

                  <div className="lp-writing-block">
                    <label>Homework / Practice</label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      className="lp-writing-area"
                      placeholder="Write homework, practice questions or follow-up work..."
                      value={formData.homework}
                      onChange={(e) => onField("homework", e.target.value)}
                      onInput={growNotebookTextarea}
                    />
                  </div>
                </div>

                <div className="lp-notebook-section">
                  <div className="lp-notebook-section-title">
                    <span className="lp-section-number">05</span>
                    <div>
                      <strong>Support & Extension</strong>
                      <small>Plan support for students who need help and extension for those ready to go further.</small>
                    </div>
                  </div>

                  <div className="lp-writing-grid">
                    <div className="lp-writing-block">
                      <label>Remedial Plan</label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        className="lp-writing-area"
                        placeholder="Extra explanation, practice or support..."
                        value={formData.remedialPlan}
                        onChange={(e) => onField("remedialPlan", e.target.value)}
                        onInput={growNotebookTextarea}
                      />
                    </div>
                    <div className="lp-writing-block">
                      <label>Enrichment Plan</label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        className="lp-writing-area"
                        placeholder="Challenge task, extension activity or deeper exploration..."
                        value={formData.enrichmentPlan}
                        onChange={(e) => onField("enrichmentPlan", e.target.value)}
                        onInput={growNotebookTextarea}
                      />
                    </div>
                  </div>

                  <div className="lp-writing-block">
                    <label>Teacher Remarks</label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      className="lp-writing-area"
                      placeholder="Any note you want to keep with this lesson plan..."
                      value={formData.remarks}
                      onChange={(e) => onField("remarks", e.target.value)}
                      onInput={growNotebookTextarea}
                    />
                  </div>
                </div>
              </section>

              <section className="lp-planning-strip">
                <div className="lp-planning-title">
                  <strong>Plan & Workflow</strong>
                  <span>Compact controls only — your writing stays above.</span>
                </div>
                <div className="lp-planning-controls lp-planning-controls-buttons">
                  <ChoiceButtons
                    label="Status"
                    options={[
                      { value: "Draft", label: "Draft" },
                      { value: "Submitted", label: "Submitted" },
                      { value: "Approved", label: "Approved" },
                      { value: "Returned", label: "Returned" },
                    ]}
                    value={formData.status}
                    onChange={(value) => onField("status", value)}
                    dense
                  />

                  <ChoiceButtons
                    label="Completion"
                    options={[
                      { value: "Planned", label: "Planned" },
                      { value: "Completed", label: "Completed" },
                      { value: "Partial", label: "Partial" },
                    ]}
                    value={formData.completionStatus}
                    onChange={(value) => onField("completionStatus", value)}
                    dense
                  />

                  <div className="lp-planning-inline">
                    <div>
                      <label>Planned Periods</label>
                      <Form.Control
                        className="lp-compact-control"
                        type="number"
                        min={0}
                        value={formData.plannedPeriods}
                        onChange={(e) => onField("plannedPeriods", e.target.value)}
                      />
                    </div>
                    <div className="lp-publish-toggle">
                      <Form.Check
                        type="switch"
                        id="publishSwitch"
                        label="Publish"
                        checked={!!formData.publish}
                        onChange={(e) => onField("publish", e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </Modal.Body>

          <Modal.Footer className="bg-white lesson-plan-modal-footer">
            <div className="text-muted small me-auto d-none d-md-block">
              Tip: Import a PDF/handwritten plan, or select Unit → Topic and use ✨ Generate with AI.
            </div>

            <div className="d-flex gap-2 w-100 w-md-auto justify-content-end">
              <Button
                variant="outline-secondary"
                onClick={() => closeCreateEdit()}
                disabled={saving || aiBusy}
                className="w-50 w-md-auto"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={saving || aiBusy}
                className="w-50 w-md-auto"
              >
                {saving ? "Saving..." : editing ? "Update Lesson Plan" : "Create Lesson Plan"}
              </Button>
            </div>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default LessonPlanCRUD;
