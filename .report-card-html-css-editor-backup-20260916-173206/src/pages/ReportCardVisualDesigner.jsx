import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Form, Modal, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import api from "../api";
import "../styles/ReportCardVisualDesigner.css";

const BLOCKS = [
  { group: "Basics", items: [
    { label: "School Logo", icon: "bi-image", type: "image", data_path: "school.logo_url", w_pct: 13, h_pct: 10 },
    { label: "School Name", icon: "bi-building", type: "text", data_path: "school.name", w_pct: 46, h_pct: 5, font_size: 17, bold: true, align: "center" },
    { label: "Report Card Title", icon: "bi-type-h1", type: "text", static_text: "REPORT CARD", w_pct: 34, h_pct: 4.5, font_size: 15, bold: true, align: "center" },
    { label: "Custom Text", icon: "bi-fonts", type: "text", static_text: "Custom text", w_pct: 24, h_pct: 4 },
    { label: "Box", icon: "bi-square", type: "box", w_pct: 34, h_pct: 12 },
    { label: "Divider", icon: "bi-dash-lg", type: "line", w_pct: 34, h_pct: 1.2 },
  ]},
  { group: "Student", items: [
    { label: "Student Name", icon: "bi-person", type: "text", data_path: "student.name", w_pct: 30, h_pct: 4 },
    { label: "Admission No.", icon: "bi-hash", type: "text", data_path: "student.admission_number", prefix: "Adm. No.: ", w_pct: 25, h_pct: 4 },
    { label: "Roll No.", icon: "bi-list-ol", type: "text", data_path: "student.roll_number", prefix: "Roll No.: ", w_pct: 20, h_pct: 4 },
    { label: "Class / Section", icon: "bi-mortarboard", type: "text", data_path: "student.class_section", prefix: "Class: ", w_pct: 26, h_pct: 4 },
    { label: "Father Name", icon: "bi-person-badge", type: "text", data_path: "student.father_name", prefix: "Father: ", w_pct: 32, h_pct: 4 },
    { label: "Mother Name", icon: "bi-person-badge", type: "text", data_path: "student.mother_name", prefix: "Mother: ", w_pct: 32, h_pct: 4 },
    { label: "Student Photo", icon: "bi-person-square", type: "image", data_path: "student.photo_data_url", w_pct: 13, h_pct: 14 },
  ]},
  { group: "Smart Blocks", items: [
    { label: "Smart Marks Table", icon: "bi-table", type: "table", w_pct: 90, h_pct: 43 },
    { label: "Subject Growth Chart", icon: "bi-bar-chart", type: "chart", w_pct: 46, h_pct: 24 },
    { label: "Percentage", icon: "bi-percent", type: "text", data_path: "result.percentage_text", prefix: "Percentage: ", w_pct: 24, h_pct: 4, bold: true },
    { label: "Overall Grade", icon: "bi-award", type: "text", data_path: "result.grade", prefix: "Grade: ", w_pct: 20, h_pct: 4, bold: true },
    { label: "Rank", icon: "bi-trophy", type: "text", data_path: "result.rank", prefix: "Rank: ", w_pct: 18, h_pct: 4 },
    { label: "Attendance", icon: "bi-calendar-check", type: "text", data_path: "attendance.term2.display", prefix: "Attendance: ", w_pct: 28, h_pct: 4 },
    { label: "Final Remarks", icon: "bi-chat-left-text", type: "text", data_path: "remarks.final", prefix: "Remarks: ", w_pct: 70, h_pct: 7, multiline: true },
  ]},
];

const defaultColumns = () => [
  { id: "subject", label: "Subject", source: "name", width: 28 },
  { id: "pt1", label: "PT-I", source: "cells.term1.pt_1.display", width: 10 },
  { id: "nb", label: "NB", source: "cells.term1.notebook.display", width: 9 },
  { id: "se", label: "SE", source: "cells.term1.subject_enrichment.display", width: 9 },
  { id: "hy", label: "Half Yearly", source: "cells.term1.half_yearly.display", width: 14 },
  { id: "annual", label: "Annual", source: "cells.term2.annual.display", width: 14 },
  { id: "grade", label: "Grade", source: "grade", width: 10 },
];

const uid = (prefix = "el") => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));

const makeElement = (block = {}, x = 8, y = 8) => ({
  id: uid(block.type || "el"),
  label: block.label || "Element",
  type: block.type || "text",
  page: 1,
  x_pct: x,
  y_pct: y,
  w_pct: block.w_pct || 24,
  h_pct: block.h_pct || 4,
  data_path: block.data_path || "",
  static_text: block.static_text || "",
  prefix: block.prefix || "",
  suffix: block.suffix || "",
  fallback: block.fallback ?? "-",
  font_size: block.font_size || 10,
  bold: Boolean(block.bold),
  multiline: Boolean(block.multiline),
  align: block.align || "left",
  color: "#172033",
  background: "#ffffff",
  background_opacity: 0,
  border_color: "#cbd5e1",
  border_width: block.type === "box" || block.type === "table" ? 1 : 0,
  opacity: 1,
  line_color: "#475569",
  line_width: 1,
  columns: block.type === "table" ? defaultColumns() : undefined,
  table_source: block.type === "table" ? "smart_table.rows" : undefined,
  header_bg: "#f1f5f9",
  header_color: "#172033",
  table_border_color: "#94a3b8",
  row_font_size: 8.5,
  na_mode: "logo-watermark",
  na_text: "N/A",
  na_bg: "#f8fafc",
  na_color: "#94a3b8",
  na_logo_path: "school.logo_url",
  na_logo_opacity: 0.07,
  chart_type: block.type === "chart" ? "bar" : undefined,
  chart_source: block.type === "chart" ? "smart_table.rows" : undefined,
  category_source: block.type === "chart" ? "name" : undefined,
  value_source: block.type === "chart" ? "percentage" : undefined,
  chart_title: block.type === "chart" ? "SUBJECT WISE GROWTH" : undefined,
  min_value: block.type === "chart" ? 0 : undefined,
  max_value: block.type === "chart" ? 100 : undefined,
  show_values: block.type === "chart" ? true : undefined,
  show_grid: block.type === "chart" ? true : undefined,
  show_axis: block.type === "chart" ? true : undefined,
  chart_orientation: block.type === "chart" ? "vertical" : undefined,
  chart_palette: block.type === "chart" ? ["#64748b", "#166534", "#2563eb", "#f59e0b", "#737373", "#15803d", "#0f4c81"] : undefined,
  title_color: block.type === "chart" ? "#164e63" : undefined,
  grid_color: block.type === "chart" ? "#e2e8f0" : undefined,
  axis_color: block.type === "chart" ? "#64748b" : undefined,
});

const starterLayout = () => {
  const add = (block, x, y, extras = {}) => ({ ...makeElement(block, x, y), ...extras });
  return [
    add({ label: "School Logo", type: "image", data_path: "school.logo_url", w_pct: 12, h_pct: 9 }, 6, 4),
    add({ label: "School Name", type: "text", data_path: "school.name", w_pct: 64, h_pct: 5, font_size: 18, bold: true, align: "center" }, 18, 4),
    add({ label: "Report Card", type: "text", static_text: "ACADEMIC REPORT CARD", w_pct: 52, h_pct: 4, font_size: 14, bold: true, align: "center" }, 24, 9),
    add({ label: "Student Name", type: "text", data_path: "student.name", prefix: "Student: ", w_pct: 42, h_pct: 4 }, 6, 16),
    add({ label: "Admission No.", type: "text", data_path: "student.admission_number", prefix: "Adm. No.: ", w_pct: 25, h_pct: 4 }, 51, 16),
    add({ label: "Roll No.", type: "text", data_path: "student.roll_number", prefix: "Roll No.: ", w_pct: 18, h_pct: 4 }, 77, 16),
    add({ label: "Class / Section", type: "text", data_path: "student.class_section", prefix: "Class: ", w_pct: 30, h_pct: 4 }, 6, 21),
    add({ label: "Session", type: "text", data_path: "session.name", prefix: "Session: ", w_pct: 27, h_pct: 4 }, 38, 21),
    add({ label: "DOB", type: "text", data_path: "student.dob", prefix: "DOB: ", w_pct: 29, h_pct: 4 }, 66, 21),
    add({ label: "Smart Marks Table", type: "table", w_pct: 90, h_pct: 43 }, 5, 28),
    add({ label: "Percentage", type: "text", data_path: "result.percentage_text", prefix: "Percentage: ", w_pct: 26, h_pct: 4, bold: true }, 6, 73),
    add({ label: "Overall Grade", type: "text", data_path: "result.grade", prefix: "Grade: ", w_pct: 20, h_pct: 4, bold: true }, 38, 73),
    add({ label: "Attendance", type: "text", data_path: "attendance.term2.display", prefix: "Attendance: ", w_pct: 31, h_pct: 4 }, 63, 73),
    add({ label: "Remarks", type: "text", data_path: "remarks.final", prefix: "Remarks: ", w_pct: 88, h_pct: 7, multiline: true }, 6, 79),
    add({ label: "Class Teacher", type: "text", static_text: "Class Teacher", w_pct: 23, h_pct: 4, align: "center" }, 7, 91),
    add({ label: "Parent", type: "text", static_text: "Parent / Guardian", w_pct: 23, h_pct: 4, align: "center" }, 39, 91),
    add({ label: "Principal", type: "text", static_text: "Principal", w_pct: 23, h_pct: 4, align: "center" }, 70, 91),
  ];
};

const normalizeClasses = (payload) => {
  const rows = Array.isArray(payload) ? payload : payload?.classes || [];
  return rows.map((r) => ({ id: Number(r.id ?? r.class_id), name: r.class_name || r.name || `Class ${r.id}` })).filter((r) => Number.isFinite(r.id));
};
const normalizeTemplates = (payload) => Array.isArray(payload) ? payload : payload?.templates || [];

const sampleValue = (el) => {
  if (el.static_text) return el.static_text;
  const map = {
    "school.name": "YOUR SCHOOL NAME",
    "student.name": "Aarav Sharma",
    "student.admission_number": "10231",
    "student.roll_number": "18",
    "student.class_section": "X - A",
    "student.father_name": "Raj Sharma",
    "student.mother_name": "Neha Sharma",
    "student.dob": "14-08-2010",
    "session.name": "2026-27",
    "result.percentage_text": "91.40%",
    "result.grade": "A1",
    "result.rank": "2",
    "attendance.term2.display": "198 / 210",
    "remarks.final": "Excellent progress. Keep learning with confidence.",
  };
  return map[el.data_path] || `{{${el.data_path || el.label}}}`;
};

function TablePreview({ element }) {
  const cols = Array.isArray(element.columns) && element.columns.length ? element.columns : defaultColumns();
  const rows = [
    { name: "English", values: ["18", "5", "5", "74", "92", "A1"] },
    { name: "Mathematics", values: ["19", null, null, "77", "96", "A1"] },
    { name: "Science", values: ["17", "5", "4", "70", "89", "A2"] },
  ];
  return (
    <div className="rcvb-table-preview">
      <div className="rcvb-table-row header" style={{ background: element.header_bg, color: element.header_color }}>
        {cols.map((c) => <div key={c.id} style={{ flex: Math.max(1, Number(c.width || 10)) }}>{c.label}</div>)}
      </div>
      {rows.map((row, rIndex) => (
        <div className="rcvb-table-row" key={row.name}>
          {cols.map((c, cIndex) => {
            let value = cIndex === 0 ? row.name : row.values[cIndex - 1] ?? null;
            const na = value == null;
            return (
              <div key={c.id} className={na ? `na ${element.na_mode || "shade"}` : ""} style={{ flex: Math.max(1, Number(c.width || 10)), background: na ? element.na_bg : undefined }}>
                {na && element.na_mode === "logo-watermark" ? <span className="rcvb-na-logo">◎</span> : null}
                <span>{na ? element.na_text || "N/A" : value}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ChartPreview({ element }) {
  const rows = [
    { name: "English", percentage: 54 },
    { name: "Hindi", percentage: 59 },
    { name: "Mathematics", percentage: 34 },
    { name: "Science", percentage: 92 },
    { name: "Social Sci.", percentage: 47 },
    { name: "Computer", percentage: 51 },
    { name: "Third Lang.", percentage: 81 },
  ];
  const min = Number(element.min_value ?? 0);
  const max = Math.max(min + 1, Number(element.max_value ?? 100));
  const palette = Array.isArray(element.chart_palette) && element.chart_palette.length
    ? element.chart_palette
    : ["#64748b", "#166534", "#2563eb", "#f59e0b", "#737373", "#15803d", "#0f4c81"];
  const horizontal = String(element.chart_orientation || "vertical") === "horizontal";
  return (
    <div className={`rcvb-chart-preview ${horizontal ? "horizontal" : "vertical"}`}>
      <div className="rcvb-chart-title" style={{ color: element.title_color || "#164e63" }}>{element.chart_title || "SUBJECT WISE GROWTH"}</div>
      <div className="rcvb-chart-area">
        {element.show_grid !== false ? <div className="rcvb-chart-grid"><span /><span /><span /><span /><span /></div> : null}
        <div className="rcvb-chart-bars">
          {rows.map((row, index) => {
            const pct = Math.max(0, Math.min(100, ((row.percentage - min) / (max - min)) * 100));
            return <div className="rcvb-chart-slot" key={row.name} title={`${row.name}: ${row.percentage}%`}>
              <div className="rcvb-chart-value">{element.show_values === false ? "" : row.percentage}</div>
              <div className="rcvb-chart-bar" style={horizontal ? { width: `${pct}%`, background: palette[index % palette.length] } : { height: `${pct}%`, background: palette[index % palette.length] }} />
              <div className="rcvb-chart-label">{row.name}</div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}


export default function ReportCardVisualDesigner() {
  const [templates, setTemplates] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draft, setDraft] = useState(null);
  const [selectedElementId, setSelectedElementId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoom, setZoom] = useState(80);
  const [showGrid, setShowGrid] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAiImport, setShowAiImport] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiFile, setAiFile] = useState(null);
  const [aiOptions, setAiOptions] = useState({ preserve_style: true, detect_dynamic_fields: true, detect_tables: true, detect_charts: true });
  const [activePage, setActivePage] = useState(1);
  const [createForm, setCreateForm] = useState({ name: "", category: "custom", orientation: "portrait", session_id: "", class_ids: [] });
  const canvasRef = useRef(null);
  const interactionRef = useRef(null);
  const backgroundInputRef = useRef(null);

  const selectedElement = useMemo(() => (draft?.layout_json || []).find((el) => String(el.id) === String(selectedElementId)) || null, [draft, selectedElementId]);
  const pageCount = useMemo(() => Math.max(1, Number(draft?.ai_analysis_json?.page_count || 1), ...(draft?.layout_json || []).map((el) => Number(el.page || 1))), [draft]);

  const hydrate = (template) => {
    if (!template) { setDraft(null); setSelectedElementId(""); return; }
    const list = Array.isArray(template.layout_json) ? template.layout_json : template.layout_json?.elements || [];
    setDraft({
      ...template,
      class_ids: Array.isArray(template.class_ids) ? template.class_ids.map(Number) : (template.classes || []).map((x) => Number(x.id)),
      layout_json: list.map((el) => ({ ...makeElement(el), ...el, id: el.id || uid("legacy") })),
    });
    setSelectedElementId("");
    setActivePage(1);
  };

  const loadAll = async (preferredId = "") => {
    setLoading(true);
    try {
      const [tRes, cRes, sRes] = await Promise.all([
        api.get("/report-card/templates", { params: { active: false } }),
        api.get("/classes"),
        api.get("/sessions"),
      ]);
      const list = normalizeTemplates(tRes.data);
      setTemplates(list);
      setClasses(normalizeClasses(cRes.data));
      setSessions(Array.isArray(sRes.data) ? sRes.data : sRes.data?.sessions || []);
      const chosen = list.find((t) => String(t.id) === String(preferredId || selectedTemplateId)) || list[0] || null;
      setSelectedTemplateId(chosen ? String(chosen.id) : "");
      hydrate(chosen);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to load report-card designer", "error");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    const t = templates.find((x) => String(x.id) === String(selectedTemplateId));
    if (t) hydrate(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  useEffect(() => {
    const move = (e) => {
      const st = interactionRef.current;
      const canvas = canvasRef.current;
      if (!st || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((e.clientX - st.startX) / rect.width) * 100;
      const dy = ((e.clientY - st.startY) / rect.height) * 100;
      setDraft((prev) => ({ ...prev, layout_json: (prev?.layout_json || []).map((el) => {
        if (String(el.id) !== String(st.id)) return el;
        if (st.mode === "resize") {
          return { ...el, w_pct: clamp(st.w + dx, 3, 100 - st.x), h_pct: clamp(st.h + dy, 1.5, 100 - st.y) };
        }
        return { ...el, x_pct: clamp(st.x + dx, 0, 100 - el.w_pct), y_pct: clamp(st.y + dy, 0, 100 - el.h_pct) };
      }) }));
    };
    const up = () => { interactionRef.current = null; document.body.classList.remove("rcvb-interacting"); };
    window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const patchElement = (patch) => setDraft((prev) => ({ ...prev, layout_json: (prev?.layout_json || []).map((el) => String(el.id) === String(selectedElementId) ? { ...el, ...patch } : el) }));
  const addElement = (block, x = 8, y = 8) => {
    const el = { ...makeElement(block, x, y), page: activePage };
    setDraft((prev) => ({ ...prev, layout_json: [...(prev?.layout_json || []), el] }));
    setSelectedElementId(el.id);
  };
  const duplicateElement = () => {
    if (!selectedElement) return;
    const copy = { ...selectedElement, id: uid("copy"), x_pct: clamp(selectedElement.x_pct + 2, 0, 96), y_pct: clamp(selectedElement.y_pct + 2, 0, 96) };
    setDraft((prev) => ({ ...prev, layout_json: [...prev.layout_json, copy] })); setSelectedElementId(copy.id);
  };
  const removeElement = () => { if (!selectedElementId) return; setDraft((prev) => ({ ...prev, layout_json: prev.layout_json.filter((el) => String(el.id) !== String(selectedElementId)) })); setSelectedElementId(""); };

  const save = async () => {
    if (!draft?.id) return;
    try {
      setSaving(true);
      const res = await api.put(`/report-card/templates/${draft.id}`, {
        name: draft.name, category: draft.category || "custom", orientation: draft.orientation || "portrait",
        session_id: draft.session_id || null, class_ids: draft.class_ids || [], is_default: Boolean(draft.is_default),
        is_active: draft.is_active !== false, notes: draft.notes || null, layout_json: draft.layout_json || [],
      });
      const item = res.data?.template || res.data;
      if (item?.id) {
        setTemplates((prev) => prev.map((x) => String(x.id) === String(item.id) ? item : x));
        hydrate(item);
      }
      Swal.fire({ icon: "success", title: "Design saved", text: "Report card layout is ready for generation.", timer: 1300, showConfirmButton: false });
    } catch (error) { Swal.fire("Save failed", error.response?.data?.message || "Could not save design", "error"); }
    finally { setSaving(false); }
  };

  const createTemplate = async () => {
    if (!createForm.name.trim()) return Swal.fire("Name required", "Please enter a template name.", "warning");
    try {
      setSaving(true);
      const res = await api.post("/report-card/templates", { ...createForm, session_id: createForm.session_id || null, layout_json: starterLayout() });
      const item = res.data?.template;
      setShowCreate(false);
      setCreateForm({ name: "", category: "custom", orientation: "portrait", session_id: "", class_ids: [] });
      await loadAll(item?.id);
      Swal.fire({ icon: "success", title: "Designer ready", text: "Starter layout added. Drag, resize and style it freely.", timer: 1500, showConfirmButton: false });
    } catch (error) { Swal.fire("Error", error.response?.data?.message || "Failed to create template", "error"); }
    finally { setSaving(false); }
  };

  const applyStarter = async () => {
    const ok = await Swal.fire({ title: "Use starter layout?", text: "This replaces the current canvas elements. Your uploaded background stays safe.", icon: "question", showCancelButton: true, confirmButtonText: "Use starter" });
    if (ok.isConfirmed) { setDraft((prev) => ({ ...prev, layout_json: starterLayout() })); setSelectedElementId(""); }
  };

  const uploadBackground = async (file) => {
    if (!file || !draft?.id) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      setUploading(true);
      const res = await api.post(`/report-card/templates/${draft.id}/background`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      const item = res.data?.template;
      if (item) { setTemplates((prev) => prev.map((x) => String(x.id) === String(item.id) ? item : x)); hydrate(item); }
      Swal.fire({ icon: "success", title: "Background added", timer: 1000, showConfirmButton: false });
    } catch (error) { Swal.fire("Upload failed", error.response?.data?.message || "Could not upload background", "error"); }
    finally { setUploading(false); }
  };


  const generateWithAI = async () => {
    if (!draft?.id) return;
    if (!aiFile) return Swal.fire("Choose a reference", "Upload the client's PDF, Word file or photo first.", "warning");
    const confirmation = await Swal.fire({
      title: "Generate editable design with AI?",
      text: "AI will replace the current canvas elements with an editable layout. You can adjust everything afterwards.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Generate with AI",
    });
    if (!confirmation.isConfirmed) return;
    const fd = new FormData();
    fd.append("file", aiFile);
    Object.entries(aiOptions).forEach(([key, value]) => fd.append(key, value ? "true" : "false"));
    try {
      setAiGenerating(true);
      const res = await api.post(`/report-card/templates/${draft.id}/ai-generate-layout`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 180000 });
      const item = res.data?.template;
      if (item) {
        setTemplates((prev) => prev.map((x) => String(x.id) === String(item.id) ? item : x));
        hydrate(item);
      }
      setShowAiImport(false);
      setAiFile(null);
      const analysis = res.data?.analysis || {};
      const details = [
        `${analysis.elements?.length || item?.layout_json?.length || 0} editable elements`,
        `${analysis.detected_tables || 0} smart table(s)`,
        `${analysis.detected_charts || 0} dynamic chart(s)`,
      ].join(" • ");
      Swal.fire({ icon: "success", title: "AI design generated", text: details, confirmButtonText: "Adjust Design" });
    } catch (error) {
      Swal.fire("AI generation failed", error.response?.data?.message || error.message || "Could not generate the report-card design", "error");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleBlockDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) { uploadBackground(e.dataTransfer.files[0]); return; }
    const raw = e.dataTransfer.getData("application/x-rcvb-block");
    if (!raw || !canvasRef.current) return;
    try {
      const block = JSON.parse(raw); const rect = canvasRef.current.getBoundingClientRect();
      addElement(block, clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 90), clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 94));
    } catch (_) {}
  };

  const renderElement = (el) => {
    if (el.type === "table") return <TablePreview element={el} />;
    if (el.type === "chart") return <ChartPreview element={el} />;
    if (el.type === "box") return <div className="rcvb-box-preview" style={{ background: el.background, opacity: Math.max(.12, Number(el.background_opacity || .12)), borderColor: el.border_color, borderWidth: el.border_width }} />;
    if (el.type === "line") return <div className="rcvb-line-preview" style={{ background: el.line_color, height: Math.max(1, Number(el.line_width || 1)) }} />;
    if (el.type === "image") return <div className="rcvb-image-preview"><i className="bi bi-image" /><span>{el.label}</span></div>;
    return <div className="rcvb-text-preview" style={{ fontSize: `${Math.max(7, Number(el.font_size || 10)) * .82}px`, fontWeight: el.bold ? 700 : 400, textAlign: el.align, color: el.color, background: Number(el.background_opacity || 0) > 0 ? el.background : "transparent" }}>{el.prefix}{sampleValue(el)}{el.suffix}</div>;
  };

  const updateColumn = (index, patch) => patchElement({ columns: (selectedElement.columns || defaultColumns()).map((c, i) => i === index ? { ...c, ...patch } : c) });
  const addColumn = () => patchElement({ columns: [...(selectedElement.columns || defaultColumns()), { id: uid("col"), label: "Column", source: "", width: 10 }] });
  const removeColumn = (index) => patchElement({ columns: (selectedElement.columns || defaultColumns()).filter((_, i) => i !== index) });

  if (loading) return <div className="rcvb-loading"><Spinner animation="border" /><span>Opening Report Card Designer…</span></div>;

  return (
    <div className="rcvb-page">
      <div className="rcvb-topbar">
        <div className="rcvb-brand"><span className="rcvb-logo"><i className="bi bi-brush" /></span><div><strong>Report Card Designer</strong><small>Visual builder • drag • resize • print-ready A4</small></div></div>
        <div className="rcvb-template-select">
          <Form.Select size="sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
            <option value="">Select template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Form.Select>
          <Button size="sm" variant="outline-primary" onClick={() => setShowCreate(true)}><i className="bi bi-plus-lg me-1" />New</Button>
        </div>
        <div className="rcvb-actions">
          <Button size="sm" variant="outline-secondary" onClick={applyStarter} disabled={!draft}><i className="bi bi-stars me-1" />Starter Layout</Button>
          <Button size="sm" className="rcvb-ai-button" onClick={() => setShowAiImport(true)} disabled={!draft || aiGenerating}><i className="bi bi-magic me-1" />{aiGenerating ? "AI Generating…" : "Generate with AI"}</Button>
          <input ref={backgroundInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={(e) => { uploadBackground(e.target.files?.[0]); e.target.value = ""; }} />
          <Button size="sm" variant="outline-secondary" onClick={() => backgroundInputRef.current?.click()} disabled={!draft || uploading}><i className="bi bi-image me-1" />{uploading ? "Uploading…" : "Background"}</Button>
          <Button size="sm" onClick={save} disabled={!draft || saving}><i className="bi bi-floppy me-1" />{saving ? "Saving…" : "Save Design"}</Button>
        </div>
      </div>

      {!draft ? <div className="rcvb-empty"><i className="bi bi-layout-text-window-reverse" /><h4>Create your first visual report card</h4><p>Use a blank A4 canvas or add the school's existing PDF/image as a background.</p><Button onClick={() => setShowCreate(true)}>Create Template</Button></div> : (
        <div className="rcvb-workspace">
          <aside className="rcvb-library">
            <div className="rcvb-panel-title"><strong>Widgets</strong><span>Drag to canvas</span></div>
            {BLOCKS.map((group) => <div key={group.group} className="rcvb-block-group"><div className="rcvb-group-title">{group.group}</div><div className="rcvb-block-grid">{group.items.map((block) => <button key={`${group.group}-${block.label}`} className="rcvb-block" type="button" draggable onDragStart={(e) => e.dataTransfer.setData("application/x-rcvb-block", JSON.stringify(block))} onClick={() => addElement(block)}><i className={`bi ${block.icon}`} /><span>{block.label}</span></button>)}</div></div>)}
            <div className="rcvb-help"><i className="bi bi-lightbulb" /><span><strong>Tip:</strong> Smart Marks Table handles non-applicable assessments as <b>N/A</b>. Subject Growth Chart is live ERP data, not a screenshot. Use <b>Generate with AI</b> to convert a client PDF, Word file or photo into editable blocks.</span></div>
          </aside>

          <main className="rcvb-stage">
            <div className="rcvb-canvas-toolbar">
              <div className="d-flex align-items-center gap-2"><strong>{draft.name}</strong><span className="badge text-bg-light">A4 {draft.orientation}</span></div>
              <div className="d-flex align-items-center gap-2">
                {pageCount > 1 ? <div className="rcvb-page-switcher"><Button size="sm" variant="outline-secondary" disabled={activePage <= 1} onClick={() => { setActivePage((p) => Math.max(1,p-1)); setSelectedElementId(""); }}>‹</Button><span>Page {activePage}/{pageCount}</span><Button size="sm" variant="outline-secondary" disabled={activePage >= pageCount} onClick={() => { setActivePage((p) => Math.min(pageCount,p+1)); setSelectedElementId(""); }}>›</Button></div> : null}
                <Form.Check type="switch" id="rcvb-grid" label="Grid" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                <Button size="sm" variant="outline-secondary" onClick={() => setZoom((z) => Math.max(50, z - 10))}>−</Button><span className="rcvb-zoom">{zoom}%</span><Button size="sm" variant="outline-secondary" onClick={() => setZoom((z) => Math.min(120, z + 10))}>+</Button>
              </div>
            </div>
            <div className="rcvb-canvas-scroll">
              <div className="rcvb-canvas-shell" style={{ width: `${zoom}%` }}>
                <div ref={canvasRef} className={`rcvb-canvas ${draft.orientation === "landscape" ? "landscape" : "portrait"} ${showGrid ? "grid" : ""}`} onDragOver={(e) => e.preventDefault()} onDrop={handleBlockDrop} onMouseDown={() => setSelectedElementId("")}>
                  {draft.background_file_url ? (String(draft.background_mime || "").includes("pdf") || /\.pdf(?:$|\?)/i.test(draft.background_file_url) ? <iframe title="Report card background" src={`${draft.background_file_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} className="rcvb-background" /> : <img src={draft.background_file_url} alt="Report card background" className="rcvb-background" />) : null}
                  <div className="rcvb-page-label">A4 • Page {activePage}</div>
                  {(draft.layout_json || []).filter((el) => Number(el.page || 1) === Number(activePage)).map((el) => <div key={el.id} className={`rcvb-element type-${el.type} ${String(el.id) === String(selectedElementId) ? "selected" : ""}`} style={{ left: `${el.x_pct}%`, top: `${el.y_pct}%`, width: `${el.w_pct}%`, height: `${el.h_pct}%`, zIndex: String(el.id) === String(selectedElementId) ? 40 : 10 }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedElementId(el.id); interactionRef.current = { id: el.id, mode: "move", startX: e.clientX, startY: e.clientY, x: Number(el.x_pct || 0), y: Number(el.y_pct || 0), w: Number(el.w_pct || 10), h: Number(el.h_pct || 4) }; document.body.classList.add("rcvb-interacting"); }}>
                    <div className="rcvb-element-label">{el.label}</div>{renderElement(el)}
                    {String(el.id) === String(selectedElementId) ? <button type="button" className="rcvb-resize-handle" title="Drag to resize" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); interactionRef.current = { id: el.id, mode: "resize", startX: e.clientX, startY: e.clientY, x: Number(el.x_pct || 0), y: Number(el.y_pct || 0), w: Number(el.w_pct || 10), h: Number(el.h_pct || 4) }; document.body.classList.add("rcvb-interacting"); }}><i className="bi bi-arrows-angle-expand" /></button> : null}
                  </div>)}
                </div>
              </div>
            </div>
          </main>

          <aside className="rcvb-inspector">
            <div className="rcvb-panel-title"><strong>{selectedElement ? "Element Settings" : "Page Settings"}</strong><span>{selectedElement?.label || "Template"}</span></div>
            {!selectedElement ? <>
              <Form.Group className="mb-3"><Form.Label>Orientation</Form.Label><Form.Select size="sm" value={draft.orientation || "portrait"} onChange={(e) => setDraft((p) => ({ ...p, orientation: e.target.value }))}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></Form.Select></Form.Group>
              <Form.Group className="mb-3"><Form.Label>Session</Form.Label><Form.Select size="sm" value={draft.session_id || ""} onChange={(e) => setDraft((p) => ({ ...p, session_id: e.target.value }))}><option value="">Reusable across sessions</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Form.Select></Form.Group>
              <Form.Label>Applicable Classes</Form.Label><div className="rcvb-class-list">{classes.map((c) => <Form.Check key={c.id} id={`rcvb-class-${c.id}`} label={c.name} checked={(draft.class_ids || []).includes(c.id)} onChange={(e) => setDraft((p) => ({ ...p, class_ids: e.target.checked ? [...new Set([...(p.class_ids || []), c.id])] : (p.class_ids || []).filter((id) => Number(id) !== c.id) }))} />)}</div>
              <div className="rcvb-help mt-3"><i className="bi bi-mouse" /><span>Click an element to edit it. Drag anywhere inside the selected element to move it; use the bottom-right handle to resize.</span></div>
            </> : <>
              <div className="rcvb-inspector-actions"><Button size="sm" variant="outline-secondary" onClick={duplicateElement}><i className="bi bi-copy" /></Button><Button size="sm" variant="outline-danger" onClick={removeElement}><i className="bi bi-trash" /></Button></div>
              <Form.Group className="mb-2"><Form.Label>Label</Form.Label><Form.Control size="sm" value={selectedElement.label || ""} onChange={(e) => patchElement({ label: e.target.value })} /></Form.Group>
              <div className="row g-2 mb-2">{[["X","x_pct"],["Y","y_pct"],["W","w_pct"],["H","h_pct"]].map(([label,key]) => <div className="col-6" key={key}><Form.Label>{label} %</Form.Label><Form.Control size="sm" type="number" value={Number(selectedElement[key] || 0).toFixed(1)} onChange={(e) => patchElement({ [key]: clamp(e.target.value, 0, 100) })} /></div>)}</div>

              {["text","image"].includes(selectedElement.type) ? <>
                {selectedElement.type === "text" ? <Form.Group className="mb-2"><Form.Label>Static Text (optional)</Form.Label><Form.Control size="sm" value={selectedElement.static_text || ""} onChange={(e) => patchElement({ static_text: e.target.value })} placeholder="Leave blank for ERP data" /></Form.Group> : null}
                <Form.Group className="mb-2"><Form.Label>ERP Data Path</Form.Label><Form.Control size="sm" value={selectedElement.data_path || ""} onChange={(e) => patchElement({ data_path: e.target.value })} placeholder="student.name" /></Form.Group>
                {selectedElement.type === "text" ? <><div className="row g-2 mb-2"><div className="col-6"><Form.Label>Font Size</Form.Label><Form.Control size="sm" type="number" min="5" max="40" value={selectedElement.font_size || 10} onChange={(e) => patchElement({ font_size: clamp(e.target.value,5,40) })} /></div><div className="col-6"><Form.Label>Align</Form.Label><Form.Select size="sm" value={selectedElement.align || "left"} onChange={(e) => patchElement({ align: e.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></Form.Select></div></div><Form.Check className="mb-2" type="switch" label="Bold" checked={Boolean(selectedElement.bold)} onChange={(e) => patchElement({ bold: e.target.checked })} /><div className="row g-2"><div className="col-6"><Form.Label>Text Color</Form.Label><Form.Control size="sm" type="color" value={selectedElement.color || "#172033"} onChange={(e) => patchElement({ color: e.target.value })} /></div><div className="col-6"><Form.Label>Background</Form.Label><Form.Control size="sm" type="color" value={selectedElement.background || "#ffffff"} onChange={(e) => patchElement({ background: e.target.value, background_opacity: 1 })} /></div></div></> : <Form.Group><Form.Label>Opacity</Form.Label><Form.Range min="10" max="100" value={Math.round((selectedElement.opacity || 1) * 100)} onChange={(e) => patchElement({ opacity: Number(e.target.value)/100 })} /></Form.Group>}
              </> : null}

              {selectedElement.type === "box" ? <><Form.Label>Fill</Form.Label><Form.Control size="sm" type="color" value={selectedElement.background || "#ffffff"} onChange={(e) => patchElement({ background: e.target.value, background_opacity: 1 })} /><Form.Label className="mt-2">Border</Form.Label><Form.Control size="sm" type="color" value={selectedElement.border_color || "#cbd5e1"} onChange={(e) => patchElement({ border_color: e.target.value })} /></> : null}
              {selectedElement.type === "line" ? <><Form.Label>Line Color</Form.Label><Form.Control size="sm" type="color" value={selectedElement.line_color || "#475569"} onChange={(e) => patchElement({ line_color: e.target.value })} /><Form.Label className="mt-2">Thickness</Form.Label><Form.Range min="1" max="8" value={selectedElement.line_width || 1} onChange={(e) => patchElement({ line_width: Number(e.target.value) })} /></> : null}

              {selectedElement.type === "chart" ? <div className="rcvb-chart-settings">
                <div className="rcvb-section-heading">Dynamic Subject Growth Chart</div>
                <Form.Group className="mb-2"><Form.Label>Chart Title</Form.Label><Form.Control size="sm" value={selectedElement.chart_title || "SUBJECT WISE GROWTH"} onChange={(e) => patchElement({ chart_title: e.target.value })} /></Form.Group>
                <Form.Group className="mb-2"><Form.Label>Rows Data</Form.Label><Form.Control size="sm" value={selectedElement.chart_source || "smart_table.rows"} onChange={(e) => patchElement({ chart_source: e.target.value })} /></Form.Group>
                <div className="row g-2 mb-2"><div className="col-6"><Form.Label>Subject Field</Form.Label><Form.Control size="sm" value={selectedElement.category_source || "name"} onChange={(e) => patchElement({ category_source:e.target.value })} /></div><div className="col-6"><Form.Label>Value Field</Form.Label><Form.Control size="sm" value={selectedElement.value_source || "percentage"} onChange={(e) => patchElement({ value_source:e.target.value })} /></div></div>
                <div className="row g-2 mb-2"><div className="col-4"><Form.Label>Min</Form.Label><Form.Control size="sm" type="number" value={selectedElement.min_value ?? 0} onChange={(e) => patchElement({ min_value:Number(e.target.value) })} /></div><div className="col-4"><Form.Label>Max</Form.Label><Form.Control size="sm" type="number" value={selectedElement.max_value ?? 100} onChange={(e) => patchElement({ max_value:Number(e.target.value) })} /></div><div className="col-4"><Form.Label>Direction</Form.Label><Form.Select size="sm" value={selectedElement.chart_orientation || "vertical"} onChange={(e) => patchElement({ chart_orientation:e.target.value })}><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option></Form.Select></div></div>
                <Form.Check className="mb-1" type="switch" label="Show values" checked={selectedElement.show_values !== false} onChange={(e) => patchElement({ show_values:e.target.checked })} />
                <Form.Check className="mb-2" type="switch" label="Show grid" checked={selectedElement.show_grid !== false} onChange={(e) => patchElement({ show_grid:e.target.checked })} />
                <div className="row g-2"><div className="col-4"><Form.Label>Title</Form.Label><Form.Control size="sm" type="color" value={selectedElement.title_color || "#164e63"} onChange={(e) => patchElement({title_color:e.target.value})} /></div><div className="col-4"><Form.Label>Grid</Form.Label><Form.Control size="sm" type="color" value={selectedElement.grid_color || "#e2e8f0"} onChange={(e) => patchElement({grid_color:e.target.value})} /></div><div className="col-4"><Form.Label>Axis</Form.Label><Form.Control size="sm" type="color" value={selectedElement.axis_color || "#64748b"} onChange={(e) => patchElement({axis_color:e.target.value})} /></div></div>
                <div className="rcvb-help mt-3"><i className="bi bi-database" /><span>Default value field is <b>percentage</b>, so subjects with different maximum marks are compared fairly on a 0–100 scale.</span></div>
              </div> : null}

              {selectedElement.type === "table" ? <div className="rcvb-table-settings">
                <div className="rcvb-section-heading">Smart Marks Table</div>
                <Form.Group className="mb-2"><Form.Label>Rows Data</Form.Label><Form.Control size="sm" value={selectedElement.table_source || "smart_table.rows"} onChange={(e) => patchElement({ table_source: e.target.value })} /></Form.Group>
                <div className="d-flex justify-content-between align-items-center mt-3 mb-2"><strong className="small">Columns</strong><Button size="sm" variant="outline-primary" onClick={addColumn}>+ Column</Button></div>
                <div className="rcvb-column-list">{(selectedElement.columns || defaultColumns()).map((col, i) => <div className="rcvb-column-card" key={col.id || i}><div className="d-flex gap-1"><Form.Control size="sm" value={col.label || ""} onChange={(e) => updateColumn(i,{label:e.target.value})} placeholder="Heading" /><Button size="sm" variant="outline-danger" onClick={() => removeColumn(i)}>×</Button></div><Form.Control className="mt-1" size="sm" value={col.source || ""} onChange={(e) => updateColumn(i,{source:e.target.value})} placeholder="cells.term1.pt_1.display" /><div className="d-flex align-items-center gap-2 mt-1"><small>Width</small><Form.Range min="5" max="50" value={col.width || 10} onChange={(e) => updateColumn(i,{width:Number(e.target.value)})} /></div></div>)}</div>
                <div className="rcvb-section-heading mt-3">When assessment is not applicable</div>
                <Form.Select size="sm" value={selectedElement.na_mode || "shade"} onChange={(e) => patchElement({ na_mode: e.target.value })}><option value="shade">Soft shaded cell</option><option value="text-watermark">N/A text watermark</option><option value="logo-watermark">School logo watermark</option><option value="dash">Simple dash (-)</option></Form.Select>
                <div className="row g-2 mt-1"><div className="col-6"><Form.Label>N/A Background</Form.Label><Form.Control size="sm" type="color" value={selectedElement.na_bg || "#f8fafc"} onChange={(e) => patchElement({ na_bg:e.target.value })} /></div><div className="col-6"><Form.Label>N/A Text</Form.Label><Form.Control size="sm" value={selectedElement.na_text || "N/A"} onChange={(e) => patchElement({ na_text:e.target.value })} /></div></div>
                <div className="row g-2 mt-2"><div className="col-6"><Form.Label>Header</Form.Label><Form.Control size="sm" type="color" value={selectedElement.header_bg || "#f1f5f9"} onChange={(e) => patchElement({header_bg:e.target.value})} /></div><div className="col-6"><Form.Label>Borders</Form.Label><Form.Control size="sm" type="color" value={selectedElement.table_border_color || "#94a3b8"} onChange={(e) => patchElement({table_border_color:e.target.value})} /></div></div>
              </div> : null}
            </>}
          </aside>
        </div>
      )}

      <Modal show={showAiImport} onHide={() => !aiGenerating && setShowAiImport(false)} centered size="lg">
        <Modal.Header closeButton={!aiGenerating}><Modal.Title><i className="bi bi-magic me-2" />AI Report Card Import</Modal.Title></Modal.Header>
        <Modal.Body>
          <div className="rcvb-ai-hero"><div className="rcvb-ai-hero-icon"><i className="bi bi-stars" /></div><div><strong>Drop in the client's existing report card</strong><p>PDF, Word (DOC/DOCX), JPG or PNG. AI will rebuild it as editable blocks, detect the marks table and convert subject-wise bar graphs into live ERP charts.</p></div></div>
          <Form.Group className="mb-3"><Form.Label>Reference File</Form.Label><Form.Control type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" disabled={aiGenerating} onChange={(e) => setAiFile(e.target.files?.[0] || null)} /><Form.Text>{aiFile ? `${aiFile.name} • ${(aiFile.size/1024/1024).toFixed(2)} MB` : "Maximum 25 MB."}</Form.Text></Form.Group>
          <div className="row g-2"><div className="col-md-6"><Form.Check type="switch" label="Preserve visual style" checked={aiOptions.preserve_style} onChange={(e)=>setAiOptions((p)=>({...p,preserve_style:e.target.checked}))} /></div><div className="col-md-6"><Form.Check type="switch" label="Detect dynamic student fields" checked={aiOptions.detect_dynamic_fields} onChange={(e)=>setAiOptions((p)=>({...p,detect_dynamic_fields:e.target.checked}))} /></div><div className="col-md-6"><Form.Check type="switch" label="Detect marks tables" checked={aiOptions.detect_tables} onChange={(e)=>setAiOptions((p)=>({...p,detect_tables:e.target.checked}))} /></div><div className="col-md-6"><Form.Check type="switch" label="Detect charts / bar graphs" checked={aiOptions.detect_charts} onChange={(e)=>setAiOptions((p)=>({...p,detect_charts:e.target.checked}))} /></div></div>
          <div className="rcvb-ai-note mt-3"><i className="bi bi-info-circle" /><span>The generated layout is an editable starting point. Review field mapping, table columns and positions before publishing.</span></div>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={()=>setShowAiImport(false)} disabled={aiGenerating}>Cancel</Button><Button className="rcvb-ai-button" onClick={generateWithAI} disabled={!aiFile || aiGenerating}>{aiGenerating ? <><Spinner animation="border" size="sm" className="me-2" />Analyzing & generating…</> : <><i className="bi bi-magic me-1" />Generate Editable Design</>}</Button></Modal.Footer>
      </Modal>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered size="lg">
        <Modal.Header closeButton><Modal.Title>Create Visual Report Card</Modal.Title></Modal.Header>
        <Modal.Body><div className="row g-3"><div className="col-md-6"><Form.Label>Template Name</Form.Label><Form.Control value={createForm.name} onChange={(e) => setCreateForm((p)=>({...p,name:e.target.value}))} placeholder="e.g. Class IX-X Report Card" /></div><div className="col-md-3"><Form.Label>Group</Form.Label><Form.Select value={createForm.category} onChange={(e)=>setCreateForm((p)=>({...p,category:e.target.value}))}><option value="primary">Primary</option><option value="middle">Middle</option><option value="senior">Senior</option><option value="custom">Custom</option></Form.Select></div><div className="col-md-3"><Form.Label>Orientation</Form.Label><Form.Select value={createForm.orientation} onChange={(e)=>setCreateForm((p)=>({...p,orientation:e.target.value}))}><option value="portrait">Portrait</option><option value="landscape">Landscape</option></Form.Select></div><div className="col-md-6"><Form.Label>Session</Form.Label><Form.Select value={createForm.session_id} onChange={(e)=>setCreateForm((p)=>({...p,session_id:e.target.value}))}><option value="">Reusable across sessions</option>{sessions.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</Form.Select></div><div className="col-12"><Form.Label>Classes / combinations</Form.Label><div className="rcvb-create-classes">{classes.map((c)=><Form.Check key={c.id} id={`create-v-${c.id}`} label={c.name} checked={createForm.class_ids.includes(c.id)} onChange={(e)=>setCreateForm((p)=>({...p,class_ids:e.target.checked?[...new Set([...p.class_ids,c.id])]:p.class_ids.filter((id)=>id!==c.id)}))} />)}</div></div></div></Modal.Body>
        <Modal.Footer><Button variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</Button><Button onClick={createTemplate} disabled={saving}>{saving?"Creating…":"Create & Design"}</Button></Modal.Footer>
      </Modal>
    </div>
  );
}
