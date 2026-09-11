import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import Swal from "sweetalert2";
import api from "../api";
import "../styles/ReportCardTemplateStudio.css";

const CATEGORY_OPTIONS = [
  { value: "primary", label: "Primary" },
  { value: "middle", label: "Middle" },
  { value: "senior", label: "Senior" },
  { value: "custom", label: "Custom" },
];

const FIELD_GROUPS = [
  {
    label: "Student",
    fields: [
      ["Student Name", "student.name"],
      ["Admission No.", "student.admission_number"],
      ["Roll No.", "student.roll_number"],
      ["Class", "student.class_name"],
      ["Section", "student.section_name"],
      ["Class / Section", "student.class_section"],
      ["Father's Name", "student.father_name"],
      ["Mother's Name", "student.mother_name"],
      ["Date of Birth", "student.dob"],
      ["Blood Group", "student.blood_group"],
      ["Student Photo", "student.photo_data_url", "image"],
    ],
  },
  {
    label: "Result",
    fields: [
      ["Session", "session.name"],
      ["Total Marks", "result.total_raw"],
      ["Weighted Total", "result.total_weighted"],
      ["Percentage", "result.percentage"],
      ["Overall Grade", "result.grade"],
      ["Rank", "result.rank"],
    ],
  },
  {
    label: "Attendance / Remarks",
    fields: [
      ["Term 1 Attendance", "attendance.term1.display"],
      ["Term 1 Attendance %", "attendance.term1.percentage"],
      ["Term 2 Attendance", "attendance.term2.display"],
      ["Term 2 Attendance %", "attendance.term2.percentage"],
      ["Term 1 Remarks", "remarks.term1", "multiline"],
      ["Term 2 Remarks", "remarks.term2", "multiline"],
      ["Final Remarks", "remarks.final", "multiline"],
    ],
  },
  {
    label: "Health",
    fields: [
      ["Height", "health.height"],
      ["Weight", "health.weight"],
      ["Dental", "health.dental"],
      ["Vision", "health.vision"],
      ["Health Blood Group", "health.blood_group"],
      ["Assessment Date", "health.assessment_date"],
    ],
  },
];

const blankCreate = {
  name: "",
  category: "custom",
  orientation: "portrait",
  session_id: "",
  class_ids: [],
  is_default: false,
  notes: "",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

const newElement = ({ label = "New Field", dataPath = "custom.field", type = "text", x = 8, y = 8, page = 1 } = {}) => ({
  id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type,
  label,
  data_path: dataPath,
  page: Math.max(1, Number(page) || 1),
  x_pct: x,
  y_pct: y,
  w_pct: type === "image" ? 14 : 24,
  h_pct: type === "image" ? 16 : type === "multiline" ? 8 : 3.5,
  font_size: 10,
  align: type === "image" ? "center" : "left",
  bold: false,
  color: "#111111",
  prefix: "",
  suffix: "",
  fallback: "-",
  clear_before: false,
  clear_color: "#ffffff",
});

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.templates)) return payload.templates;
  return [];
};

const normalizeClasses = (payload) => {
  const rows = Array.isArray(payload) ? payload : payload?.classes || [];
  return rows.map((row) => ({
    id: Number(row.id ?? row.class_id),
    name: row.class_name || row.name || row.label || `Class ${row.id ?? row.class_id}`,
  })).filter((row) => Number.isFinite(row.id));
};

const ReportCardTemplateStudio = () => {
  const [templates, setTemplates] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(blankCreate);
  const [filterCategory, setFilterCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => String(item.id) === String(selectedId)) || null,
    [templates, selectedId]
  );

  const selectedField = useMemo(
    () => (draft?.layout_json || []).find((item) => String(item.id) === String(selectedFieldId)) || null,
    [draft, selectedFieldId]
  );

  const visibleTemplates = useMemo(() => {
    if (filterCategory === "all") return templates;
    return templates.filter((item) => String(item.category || "custom") === filterCategory);
  }, [templates, filterCategory]);

  const pageCount = useMemo(() => {
    const aiPages = Number(draft?.ai_analysis_json?.page_count || 0);
    const layoutPages = Math.max(1, ...(draft?.layout_json || []).map((item) => Number(item.page || 1)));
    return Math.max(1, aiPages || 0, layoutPages || 1);
  }, [draft]);

  const hydrateDraft = (template) => {
    if (!template) {
      setDraft(null);
      setSelectedFieldId("");
      return;
    }
    const layout = Array.isArray(template.layout_json)
      ? template.layout_json
      : Array.isArray(template.layout_json?.elements)
      ? template.layout_json.elements
      : [];
    setDraft({
      ...template,
      class_ids: Array.isArray(template.class_ids)
        ? template.class_ids.map(Number)
        : Array.isArray(template.classes)
        ? template.classes.map((item) => Number(item.id))
        : [],
      layout_json: layout.map((item, index) => ({
        ...newElement(),
        ...item,
        id: item.id || `field_${index}_${Date.now()}`,
      })),
    });
    setSelectedFieldId(layout[0]?.id || "");
    setCurrentPage(1);
  };

  const loadAll = async ({ keepSelected = true } = {}) => {
    setLoading(true);
    try {
      const [templateRes, classRes, sessionRes] = await Promise.all([
        api.get("/report-card/templates", { params: { active: false } }),
        api.get("/classes"),
        api.get("/sessions"),
      ]);
      const nextTemplates = normalizeList(templateRes.data);
      setTemplates(nextTemplates);
      setClasses(normalizeClasses(classRes.data));
      setSessions(Array.isArray(sessionRes.data) ? sessionRes.data : sessionRes.data?.sessions || []);

      const wantedId = keepSelected ? selectedId : "";
      const chosen = nextTemplates.find((item) => String(item.id) === String(wantedId)) || nextTemplates[0] || null;
      setSelectedId(chosen ? String(chosen.id) : "");
      hydrateDraft(chosen);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", error.response?.data?.message || "Failed to load report-card templates", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll({ keepSelected: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTemplate) hydrateDraft(selectedTemplate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const onMove = (event) => {
      const state = dragRef.current;
      const canvas = canvasRef.current;
      if (!state || !canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = ((event.clientX - state.startX) / rect.width) * 100;
      const dy = ((event.clientY - state.startY) / rect.height) * 100;
      setDraft((prev) => ({
        ...prev,
        layout_json: (prev?.layout_json || []).map((item) =>
          String(item.id) === String(state.id)
            ? {
                ...item,
                x_pct: clamp(state.x + dx, 0, 100 - Number(item.w_pct || 0)),
                y_pct: clamp(state.y + dy, 0, 100 - Number(item.h_pct || 0)),
              }
            : item
        ),
      }));
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.classList.remove("rc-template-dragging");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const refreshTemplate = async (id) => {
    const res = await api.get(`/report-card/templates/${id}`);
    const item = res.data?.template || res.data;
    setTemplates((prev) => {
      const exists = prev.some((x) => String(x.id) === String(item.id));
      return exists
        ? prev.map((x) => (String(x.id) === String(item.id) ? item : x))
        : [item, ...prev];
    });
    setSelectedId(String(item.id));
    hydrateDraft(item);
    return item;
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      Swal.fire("Template name required", "Give this reusable design a clear name.", "warning");
      return;
    }
    if (!createForm.class_ids.length) {
      const result = await Swal.fire({
        title: "No classes selected",
        text: "This will create a global template available to all classes. Continue?",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Create global template",
      });
      if (!result.isConfirmed) return;
    }

    try {
      setSaving(true);
      const res = await api.post("/report-card/templates", {
        ...createForm,
        session_id: createForm.session_id || null,
      });
      const item = res.data?.template;
      setShowCreate(false);
      setCreateForm(blankCreate);
      await loadAll({ keepSelected: false });
      if (item?.id) {
        setSelectedId(String(item.id));
        await refreshTemplate(item.id);
      }
      Swal.fire("Created", "Template saved. Now upload the school's PDF/image design.", "success");
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to create template", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!draft?.id) return;
    try {
      setSaving(true);
      const res = await api.put(`/report-card/templates/${draft.id}`, {
        name: draft.name,
        category: draft.category,
        orientation: draft.orientation,
        session_id: draft.session_id || null,
        class_ids: draft.class_ids || [],
        is_default: Boolean(draft.is_default),
        is_active: Boolean(draft.is_active),
        notes: draft.notes || null,
        layout_json: draft.layout_json || [],
      });
      const item = res.data?.template;
      if (item) {
        setTemplates((prev) => prev.map((x) => (String(x.id) === String(item.id) ? item : x)));
        hydrateDraft(item);
      }
      Swal.fire({ title: "Saved", text: "Reusable report-card template updated.", icon: "success", timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to save template", "error");
    } finally {
      setSaving(false);
    }
  };

  const uploadBackground = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !draft?.id) return;
    const data = new FormData();
    data.append("file", file);
    try {
      setUploading(true);
      const res = await api.post(`/report-card/templates/${draft.id}/background`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const item = res.data?.template;
      if (item) {
        setTemplates((prev) => prev.map((x) => (String(x.id) === String(item.id) ? item : x)));
        hydrateDraft(item);
      }
      Swal.fire("Uploaded", "Design saved. You can run AI Auto Detect now.", "success");
    } catch (error) {
      Swal.fire("Upload failed", error.response?.data?.message || "Could not upload report-card design", "error");
    } finally {
      setUploading(false);
    }
  };

  const analyzeWithAI = async () => {
    if (!draft?.background_file_url) {
      Swal.fire("Upload design first", "Upload the school's PDF/JPG/PNG report card before AI analysis.", "info");
      return;
    }
    const confirm = await Swal.fire({
      title: "AI Auto Detect fields?",
      text: "AI will replace the current overlay field positions. You can edit them afterwards.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Analyse design",
    });
    if (!confirm.isConfirmed) return;

    try {
      setAnalyzing(true);
      const res = await api.post(`/report-card/templates/${draft.id}/ai-analyze`);
      const item = res.data?.template;
      if (item) {
        setTemplates((prev) => prev.map((x) => (String(x.id) === String(item.id) ? item : x)));
        hydrateDraft(item);
      }
      const warnings = res.data?.analysis?.warnings || [];
      await Swal.fire(
        "AI analysis complete",
        `${res.data?.analysis?.elements?.length || 0} fields detected.${warnings.length ? ` ${warnings.length} item(s) need review.` : ""}`,
        "success"
      );
    } catch (error) {
      Swal.fire("AI analysis failed", error.response?.data?.message || "Could not analyse this design", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const addField = (field) => {
    const [label, dataPath, type = "text"] = field;
    const element = newElement({ label, dataPath, type, x: 10, y: 10, page: currentPage });
    setDraft((prev) => ({ ...prev, layout_json: [...(prev?.layout_json || []), element] }));
    setSelectedFieldId(element.id);
  };

  const addCustomField = () => {
    const element = newElement({ page: currentPage });
    setDraft((prev) => ({ ...prev, layout_json: [...(prev?.layout_json || []), element] }));
    setSelectedFieldId(element.id);
  };

  const updateSelectedField = (patch) => {
    if (!selectedFieldId) return;
    setDraft((prev) => ({
      ...prev,
      layout_json: (prev?.layout_json || []).map((item) =>
        String(item.id) === String(selectedFieldId) ? { ...item, ...patch } : item
      ),
    }));
  };

  const removeSelectedField = () => {
    if (!selectedFieldId) return;
    setDraft((prev) => ({
      ...prev,
      layout_json: (prev?.layout_json || []).filter((item) => String(item.id) !== String(selectedFieldId)),
    }));
    setSelectedFieldId("");
  };

  const cloneTemplate = async () => {
    if (!draft?.id) return;
    const { value: name } = await Swal.fire({
      title: "Clone template",
      input: "text",
      inputValue: `${draft.name} - Copy`,
      showCancelButton: true,
      confirmButtonText: "Clone",
      inputValidator: (value) => (!value?.trim() ? "Name is required" : undefined),
    });
    if (!name) return;
    try {
      const res = await api.post(`/report-card/templates/${draft.id}/clone`, { name });
      const item = res.data?.template;
      await loadAll({ keepSelected: false });
      if (item?.id) await refreshTemplate(item.id);
      Swal.fire("Cloned", "A reusable copy has been created.", "success");
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to clone template", "error");
    }
  };

  const setDefault = async () => {
    if (!draft?.id) return;
    try {
      const res = await api.patch(`/report-card/templates/${draft.id}/default`);
      const item = res.data?.template;
      await loadAll({ keepSelected: false });
      if (item?.id) await refreshTemplate(item.id);
      Swal.fire({ title: "Default updated", text: "This template will be preferred for its assigned classes.", icon: "success", timer: 1300, showConfirmButton: false });
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to set default", "error");
    }
  };

  const archiveTemplate = async () => {
    if (!draft?.id) return;
    const confirm = await Swal.fire({
      title: "Archive this template?",
      text: "It will no longer be auto-selected, but the saved design is retained.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Archive",
    });
    if (!confirm.isConfirmed) return;
    try {
      await api.delete(`/report-card/templates/${draft.id}`);
      await loadAll({ keepSelected: false });
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to archive template", "error");
    }
  };

  const activateTemplate = async () => {
    if (!draft?.id) return;
    try {
      const res = await api.patch(`/report-card/templates/${draft.id}/status`, { is_active: true });
      const item = res.data?.template;
      await loadAll({ keepSelected: false });
      if (item?.id) await refreshTemplate(item.id);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to activate template", "error");
    }
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/x-report-card-field");
    if (!raw || !canvasRef.current) return;
    try {
      const field = JSON.parse(raw);
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      const element = newElement({ label: field[0], dataPath: field[1], type: field[2] || "text", x, y, page: currentPage });
      setDraft((prev) => ({ ...prev, layout_json: [...(prev?.layout_json || []), element] }));
      setSelectedFieldId(element.id);
    } catch (_) {}
  };

  const categoryLabel = (value) => CATEGORY_OPTIONS.find((item) => item.value === value)?.label || "Custom";

  if (loading) {
    return (
      <div className="rc-studio-loading">
        <Spinner animation="border" />
        <div>Loading report-card templates…</div>
      </div>
    );
  }

  return (
    <div className="rc-studio-page">
      <div className="rc-studio-hero">
        <div>
          <div className="rc-studio-kicker">Examination • Smart Report Cards</div>
          <h2>Reusable Report Card Template Studio</h2>
          <p>
            Upload each school's existing PDF/image design, auto-detect dynamic fields with AI,
            map it to Primary/Middle/Senior classes, and reuse the same approved design every term.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="light" onClick={() => setShowCreate(true)}>
            <i className="bi bi-plus-lg me-1" /> New Template
          </Button>
          <Button variant="outline-light" onClick={() => loadAll()}>
            <i className="bi bi-arrow-clockwise me-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="rc-studio-layout">
        <aside className="rc-studio-sidebar">
          <div className="rc-studio-side-title">
            <strong>Saved Templates</strong>
            <span>{templates.length}</span>
          </div>
          <Form.Select
            size="sm"
            className="mb-3"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All groups</option>
            {CATEGORY_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Form.Select>

          <div className="rc-template-list">
            {visibleTemplates.length === 0 ? (
              <div className="text-muted small p-3 text-center">No templates yet.</div>
            ) : visibleTemplates.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rc-template-list-item ${String(item.id) === String(selectedId) ? "active" : ""}`}
                onClick={() => setSelectedId(String(item.id))}
              >
                <div className="d-flex justify-content-between gap-2 align-items-start">
                  <strong>{item.name}</strong>
                  {item.is_default && <Badge bg="success">Default</Badge>}
                </div>
                <div className="small mt-1 text-capitalize">{categoryLabel(item.category)}</div>
                <div className="small text-muted mt-1">
                  {(item.classes || []).map((c) => c.class_name).join(", ") || "All classes"}
                </div>
                <div className="mt-2 d-flex gap-1 flex-wrap">
                  {item.background_file_url ? <Badge bg="primary">Design uploaded</Badge> : <Badge bg="secondary">No design</Badge>}
                  {item.layout_json?.length ? <Badge bg="info">{item.layout_json.length} fields</Badge> : null}
                  {!item.is_active ? <Badge bg="dark">Archived</Badge> : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="rc-studio-main">
          {!draft ? (
            <div className="rc-empty-state">
              <i className="bi bi-file-earmark-richtext" />
              <h4>Create your first reusable report-card design</h4>
              <p>Primary, Middle and Senior sections can each have a different template.</p>
              <Button onClick={() => setShowCreate(true)}>Create Template</Button>
            </div>
          ) : (
            <>
              <div className="rc-toolbar-card">
                <div className="rc-template-title-row">
                  <div>
                    <div className="d-flex gap-2 align-items-center flex-wrap">
                      <h4 className="mb-0">{draft.name}</h4>
                      <Badge bg={draft.is_active ? "success" : "secondary"}>{draft.is_active ? "Active" : "Archived"}</Badge>
                      <Badge bg="light" text="dark" className="border">{categoryLabel(draft.category)}</Badge>
                    </div>
                    <div className="text-muted small mt-1">
                      Version {draft.template_version || 1} • {draft.orientation || "portrait"} • {draft.source_file_name || "No source design uploaded"}
                    </div>
                  </div>
                  <div className="d-flex gap-2 flex-wrap justify-content-end">
                    <label className={`btn btn-outline-primary btn-sm mb-0 ${uploading ? "disabled" : ""}`}>
                      {uploading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="bi bi-upload me-1" />}
                      Upload PDF / Image
                      <input type="file" hidden accept="application/pdf,image/png,image/jpeg" onChange={uploadBackground} disabled={uploading} />
                    </label>
                    <Button size="sm" variant="outline-dark" onClick={analyzeWithAI} disabled={analyzing || !draft.background_file_url}>
                      {analyzing ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="bi bi-stars me-1" />}
                      AI Auto Detect
                    </Button>
                    <Button size="sm" onClick={saveDraft} disabled={saving}>
                      {saving ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="bi bi-floppy me-1" />}
                      Save Template
                    </Button>
                  </div>
                </div>

                <div className="row g-2 mt-2">
                  <div className="col-lg-3 col-md-6">
                    <Form.Label className="small fw-semibold">Template Name</Form.Label>
                    <Form.Control size="sm" value={draft.name || ""} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="col-lg-2 col-md-3">
                    <Form.Label className="small fw-semibold">Group</Form.Label>
                    <Form.Select size="sm" value={draft.category || "custom"} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}>
                      {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Form.Select>
                  </div>
                  <div className="col-lg-2 col-md-3">
                    <Form.Label className="small fw-semibold">Orientation</Form.Label>
                    <Form.Select size="sm" value={draft.orientation || "portrait"} onChange={(e) => setDraft((p) => ({ ...p, orientation: e.target.value }))}>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </Form.Select>
                  </div>
                  <div className="col-lg-2 col-md-4">
                    <Form.Label className="small fw-semibold">Session (optional)</Form.Label>
                    <Form.Select size="sm" value={draft.session_id || ""} onChange={(e) => setDraft((p) => ({ ...p, session_id: e.target.value }))}>
                      <option value="">Reusable across sessions</option>
                      {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </Form.Select>
                  </div>
                  <div className="col-lg-3 col-md-8">
                    <Form.Label className="small fw-semibold">Assigned Classes</Form.Label>
                    <div className="rc-class-picker">
                      {classes.map((item) => (
                        <Form.Check
                          key={item.id}
                          inline
                          type="checkbox"
                          id={`rc-class-${item.id}`}
                          label={item.name}
                          checked={(draft.class_ids || []).includes(item.id)}
                          onChange={(e) => setDraft((prev) => ({
                            ...prev,
                            class_ids: e.target.checked
                              ? [...new Set([...(prev.class_ids || []), item.id])]
                              : (prev.class_ids || []).filter((id) => Number(id) !== Number(item.id)),
                          }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rc-editor-grid">
                <section className="rc-field-palette">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>Dynamic Fields</strong>
                    <Button size="sm" variant="outline-secondary" onClick={addCustomField}>+ Custom</Button>
                  </div>
                  <div className="text-muted small mb-3">Drag a field onto the design, or click to add it.</div>
                  {FIELD_GROUPS.map((group) => (
                    <div key={group.label} className="mb-3">
                      <div className="rc-field-group-label">{group.label}</div>
                      <div className="d-flex flex-wrap gap-1">
                        {group.fields.map((field) => (
                          <button
                            type="button"
                            key={`${group.label}-${field[1]}`}
                            className="rc-field-chip"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("application/x-report-card-field", JSON.stringify(field))}
                            onClick={() => addField(field)}
                            title={field[1]}
                          >
                            {field[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="rc-field-help">
                    <strong>Marks mapping</strong>
                    <div className="small mt-1">
                      AI uses paths such as <code>marks.english.term1.pt1.display</code>. Select any detected field to edit its path.
                    </div>
                  </div>
                </section>

                <section className="rc-design-area">
                  <div className="rc-design-head">
                    <div>
                      <strong>Design Canvas</strong>
                      <div className="small text-muted">Blue boxes are dynamic ERP values. The uploaded design remains untouched.</div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        ‹
                      </Button>
                      <span className="small text-muted">Page {currentPage} / {pageCount}</span>
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        disabled={currentPage >= pageCount}
                        onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                      >
                        ›
                      </Button>
                    </div>
                  </div>

                  <div
                    ref={canvasRef}
                    className={`rc-design-canvas ${draft.orientation === "landscape" ? "landscape" : "portrait"}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleCanvasDrop}
                  >
                    {draft.background_file_url ? (
                      String(draft.background_mime || "").includes("pdf") || /\.pdf(?:$|\?)/i.test(draft.background_file_url) ? (
                        <iframe
                          title="Report card design"
                          src={`${draft.background_file_url}#toolbar=0&navpanes=0&scrollbar=0&page=${currentPage}&view=FitH`}
                          className="rc-design-background rc-pdf-background"
                        />
                      ) : (
                        <img src={draft.background_file_url} alt="Report card design" className="rc-design-background" />
                      )
                    ) : (
                      <div className="rc-no-background">
                        <i className="bi bi-file-earmark-arrow-up" />
                        <strong>Upload the school's existing report card</strong>
                        <span>PDF, PNG or JPG</span>
                      </div>
                    )}

                    <div className="rc-overlay-layer">
                      {(draft.layout_json || [])
                        .filter((item) => Number(item.page || 1) === Number(currentPage))
                        .map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className={`rc-overlay-field ${item.type === "image" ? "image" : ""} ${String(item.id) === String(selectedFieldId) ? "selected" : ""}`}
                            style={{
                              left: `${item.x_pct}%`,
                              top: `${item.y_pct}%`,
                              width: `${item.w_pct}%`,
                              height: `${item.h_pct}%`,
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              setSelectedFieldId(item.id);
                              dragRef.current = {
                                id: item.id,
                                startX: event.clientX,
                                startY: event.clientY,
                                x: Number(item.x_pct || 0),
                                y: Number(item.y_pct || 0),
                              };
                              document.body.classList.add("rc-template-dragging");
                            }}
                            onClick={(event) => {
                              event.preventDefault();
                              setSelectedFieldId(item.id);
                            }}
                          >
                            <span>{item.type === "image" ? "📷 " : ""}{item.label || item.data_path}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </section>

                <aside className="rc-property-panel">
                  <strong>Field Properties</strong>
                  {!selectedField ? (
                    <div className="text-muted small mt-3">Select a blue field on the canvas.</div>
                  ) : (
                    <div className="mt-3">
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Label</Form.Label>
                        <Form.Control size="sm" value={selectedField.label || ""} onChange={(e) => updateSelectedField({ label: e.target.value })} />
                      </Form.Group>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">ERP Data Path</Form.Label>
                        <Form.Control size="sm" value={selectedField.data_path || ""} onChange={(e) => updateSelectedField({ data_path: e.target.value })} />
                      </Form.Group>
                      <Form.Group className="mb-2">
                        <Form.Label className="small">Page</Form.Label>
                        <Form.Control
                          size="sm"
                          type="number"
                          min="1"
                          max={pageCount}
                          value={selectedField.page || 1}
                          onChange={(e) => {
                            const nextPage = Math.max(1, Math.min(pageCount, Number(e.target.value) || 1));
                            updateSelectedField({ page: nextPage });
                            setCurrentPage(nextPage);
                          }}
                        />
                      </Form.Group>
                      <div className="row g-2">
                        {["x_pct", "y_pct", "w_pct", "h_pct"].map((key) => (
                          <div className="col-6" key={key}>
                            <Form.Label className="small text-uppercase">{key.replace("_pct", " %")}</Form.Label>
                            <Form.Control
                              size="sm"
                              type="number"
                              step="0.1"
                              value={selectedField[key] ?? 0}
                              onChange={(e) => updateSelectedField({ [key]: clamp(e.target.value, 0, 100) })}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="row g-2 mt-1">
                        <div className="col-6">
                          <Form.Label className="small">Font Size</Form.Label>
                          <Form.Control size="sm" type="number" min="5" max="40" value={selectedField.font_size || 10} onChange={(e) => updateSelectedField({ font_size: clamp(e.target.value, 5, 40) })} />
                        </div>
                        <div className="col-6">
                          <Form.Label className="small">Align</Form.Label>
                          <Form.Select size="sm" value={selectedField.align || "left"} onChange={(e) => updateSelectedField({ align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </Form.Select>
                        </div>
                      </div>
                      <div className="row g-2 mt-1">
                        <div className="col-6">
                          <Form.Label className="small">Type</Form.Label>
                          <Form.Select size="sm" value={selectedField.type || "text"} onChange={(e) => updateSelectedField({ type: e.target.value })}>
                            <option value="text">Text</option>
                            <option value="multiline">Multiline</option>
                            <option value="image">Image</option>
                          </Form.Select>
                        </div>
                        <div className="col-6">
                          <Form.Label className="small">Colour</Form.Label>
                          <Form.Control size="sm" type="color" value={selectedField.color || "#111111"} onChange={(e) => updateSelectedField({ color: e.target.value })} />
                        </div>
                      </div>
                      <Form.Check className="mt-3" type="switch" label="Bold" checked={Boolean(selectedField.bold)} onChange={(e) => updateSelectedField({ bold: e.target.checked })} />
                      <Form.Check
                        className="mt-2"
                        type="switch"
                        label="Clear sample value before printing"
                        checked={Boolean(selectedField.clear_before)}
                        onChange={(e) => updateSelectedField({ clear_before: e.target.checked })}
                      />
                      {selectedField.clear_before && (
                        <Form.Group className="mt-2">
                          <Form.Label className="small">Clear Colour</Form.Label>
                          <Form.Control
                            size="sm"
                            type="color"
                            value={selectedField.clear_color || "#ffffff"}
                            onChange={(e) => updateSelectedField({ clear_color: e.target.value })}
                          />
                        </Form.Group>
                      )}
                      <div className="row g-2 mt-1">
                        <div className="col-6">
                          <Form.Label className="small">Prefix</Form.Label>
                          <Form.Control size="sm" value={selectedField.prefix || ""} onChange={(e) => updateSelectedField({ prefix: e.target.value })} />
                        </div>
                        <div className="col-6">
                          <Form.Label className="small">Suffix</Form.Label>
                          <Form.Control size="sm" value={selectedField.suffix || ""} onChange={(e) => updateSelectedField({ suffix: e.target.value })} />
                        </div>
                      </div>
                      <Form.Group className="mt-2">
                        <Form.Label className="small">Fallback</Form.Label>
                        <Form.Control size="sm" value={selectedField.fallback ?? "-"} onChange={(e) => updateSelectedField({ fallback: e.target.value })} />
                      </Form.Group>
                      <Button variant="outline-danger" size="sm" className="w-100 mt-3" onClick={removeSelectedField}>
                        <i className="bi bi-trash me-1" /> Remove Field
                      </Button>
                    </div>
                  )}

                  <hr />
                  <div className="d-grid gap-2">
                    <Button variant="outline-success" size="sm" onClick={setDefault} disabled={draft.is_default || !draft.is_active}>
                      <i className="bi bi-check2-circle me-1" /> Set Default for Classes
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={cloneTemplate}>
                      <i className="bi bi-copy me-1" /> Clone / Reuse
                    </Button>
                    {draft.is_active ? (
                      <Button variant="outline-danger" size="sm" onClick={archiveTemplate}>
                        <i className="bi bi-archive me-1" /> Archive
                      </Button>
                    ) : (
                      <Button variant="outline-dark" size="sm" onClick={activateTemplate}>
                        <i className="bi bi-arrow-counterclockwise me-1" /> Activate
                      </Button>
                    )}
                  </div>
                </aside>
              </div>

              <div className="rc-studio-tip mt-3">
                <i className="bi bi-lightbulb-fill" />
                <div>
                  <strong>Recommended workflow:</strong> Create Primary / Middle / Senior templates → upload each approved school design → run AI Auto Detect → visually adjust blue fields once → save. The same template is reused automatically for every student in the assigned classes.
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Reusable Report Card Template</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row g-3">
            <div className="col-md-6">
              <Form.Label>Template Name</Form.Label>
              <Form.Control placeholder="e.g. Primary Report Card 2026" value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <Form.Label>Group</Form.Label>
              <Form.Select value={createForm.category} onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Orientation</Form.Label>
              <Form.Select value={createForm.orientation} onChange={(e) => setCreateForm((p) => ({ ...p, orientation: e.target.value }))}>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </Form.Select>
            </div>
            <div className="col-md-6">
              <Form.Label>Session</Form.Label>
              <Form.Select value={createForm.session_id} onChange={(e) => setCreateForm((p) => ({ ...p, session_id: e.target.value }))}>
                <option value="">Reusable across sessions</option>
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-6 d-flex align-items-end">
              <Form.Check type="switch" label="Set as default for selected classes" checked={createForm.is_default} onChange={(e) => setCreateForm((p) => ({ ...p, is_default: e.target.checked }))} />
            </div>
            <div className="col-12">
              <Form.Label>Assign Classes</Form.Label>
              <div className="rc-create-class-grid">
                {classes.map((item) => (
                  <Form.Check
                    key={item.id}
                    type="checkbox"
                    id={`create-rc-class-${item.id}`}
                    label={item.name}
                    checked={createForm.class_ids.includes(item.id)}
                    onChange={(e) => setCreateForm((prev) => ({
                      ...prev,
                      class_ids: e.target.checked
                        ? [...new Set([...prev.class_ids, item.id])]
                        : prev.class_ids.filter((id) => Number(id) !== Number(item.id)),
                    }))}
                  />
                ))}
              </div>
              <div className="form-text">Example: Primary = Nursery–V, Middle = VI–VIII, Senior = IX–XII. You can assign any combination.</div>
            </div>
            <div className="col-12">
              <Form.Label>Notes (optional)</Form.Label>
              <Form.Control as="textarea" rows={2} placeholder="e.g. Annual report card supplied by school" value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>{saving ? "Creating…" : "Create Template"}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ReportCardTemplateStudio;
