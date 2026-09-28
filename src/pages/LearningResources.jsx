import React, { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { Modal } from "react-bootstrap";
import api from "../api";
import { useInstitution } from "../institution/InstitutionContext";
import "./LearningResources.css";

const studyMaterialExtensions = [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".md", ".markdown", ".html", ".htm", ".csv", ".jpg", ".jpeg", ".png", ".webp", ".mdb", ".accdb", ".mde", ".accde", ".accdt", ".db", ".sqlite", ".sqlite3", ".sql", ".c", ".h", ".cpp", ".hpp", ".cc", ".cs", ".java", ".py", ".ipynb", ".js", ".jsx", ".ts", ".tsx", ".css", ".scss", ".php", ".json", ".xml", ".yaml", ".yml", ".r", ".rmd", ".m", ".sh", ".ps1", ".bat", ".zip", ".rar", ".7z", ".tar", ".gz", ".odt", ".ods", ".odp", ".rtf", ".tsv", ".svg", ".drawio"];

const readRoles = () => {
  try {
    const many = JSON.parse(localStorage.getItem("roles") || "[]");
    const fallback = localStorage.getItem("userRole") || localStorage.getItem("role");
    return [...new Set([...(Array.isArray(many) ? many : []), fallback].filter(Boolean).map((r) => String(r).toLowerCase()))];
  } catch (_) {
    return [localStorage.getItem("userRole") || localStorage.getItem("role")].filter(Boolean).map((r) => String(r).toLowerCase());
  }
};

const rowsFrom = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const emptyForm = () => ({
  title: "",
  description: "",
  materialType: "Notes",
  chapterUnit: "",
  subjectId: "",
  notifyStudents: true,
});

const prettyBytes = (value) => {
  const n = Number(value || 0);
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n > 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const isYoutube = (url = "") => /youtu\.be|youtube\.com/i.test(url);

export default function LearningResources() {
  const roles = useMemo(readRoles, []);
  const isStudent = roles.includes("student");
  const canManage = !isStudent && roles.some((r) => ["teacher", "department_hod", "principal", "academic_coordinator", "coordinator", "admin", "superadmin", "super_admin"].includes(r));
  const { isCollege, terms } = useInstitution();

  const [preview, setPreview] = useState(null);
  const previewRequest = useRef(0);
  const closePreview = () => { previewRequest.current += 1; setPreview(null); };
  const openPreview = async (file) => {
    const request = ++previewRequest.current;
    setPreview({ file, loading: true });
    try {
      if (Number(file.file_size) > 5 * 1024 * 1024) throw new Error("Preview supports files up to 5 MB. Download this file to read it.");
      const response = await fetch(file.file_url);
      if (!response.ok) throw new Error("Unable to load this file. Please try again or download it.");
      const content = await response.text();
      if (content.length > 5 * 1024 * 1024) throw new Error("This file is too large to preview. Please download it.");
      if (request === previewRequest.current) setPreview({ file, content });
    } catch (error) {
      if (request === previewRequest.current) setPreview({ file, error: error.message });
    }
  };
  const [resources, setResources] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([{ title: "", url: "" }]);
  const [audiences, setAudiences] = useState([]);
  const [targetClass, setTargetClass] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef(null);

  const materialTypes = isCollege
    ? ["Notes", "Reference Material", "Question Bank", "Presentation", "Revision Material", "Video Resource", "Other"]
    : ["Notes", "Worksheet", "Revision Material", "Sample Paper", "Question Bank", "Presentation", "Video Resource", "Other"];

  const loadResources = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(isStudent ? "/learning-resources/my" : "/learning-resources");
      setResources(rowsFrom(data, "resources"));
    } catch (error) {
      console.error(error);
      Swal.fire("Unable to load", error?.response?.data?.error || "Study material could not be loaded.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMeta = async () => {
    if (!canManage) return;
    try {
      const [c, s, sub] = await Promise.all([
        api.get("/classes?withSections=true"),
        api.get("/sections"),
        api.get("/subjects"),
      ]);
      const classRows = rowsFrom(c.data, "classes");
      const sectionRows = rowsFrom(s.data, "sections");
      setClasses(classRows);
      setSections(sectionRows.length ? sectionRows : classRows.flatMap((row) => row.Sections || row.sections || []));
      setSubjects(rowsFrom(sub.data, "subjects"));
    } catch (error) {
      console.warn("Learning Resources metadata load failed", error);
    }
  };

  useEffect(() => {
    loadResources();
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSections = useMemo(() => sections.filter((s) => Number(s.class_id) === Number(targetClass)), [sections, targetClass]);
  const className = (id) => classes.find((c) => Number(c.id) === Number(id))?.class_name || `${terms.class} ${id}`;
  const sectionName = (id) => sections.find((s) => Number(s.id) === Number(id))?.section_name || (id ? `${terms.section} ${id}` : "All");

  const addAudience = () => {
    const classId = Number(targetClass);
    const sectionId = Number(targetSection) || null;
    if (!classId) return Swal.fire("Select target", `Please select a ${terms.classLower}.`, "warning");
    const key = `${classId}:${sectionId || "all"}`;
    if (audiences.some((a) => `${a.class_id}:${a.section_id || "all"}` === key)) return;
    setAudiences((prev) => [...prev, { class_id: classId, section_id: sectionId }]);
    setTargetSection("");
  };

  const addFiles = (incoming) => {
    const list = Array.from(incoming || []);
    const invalid = list.find((file) => !studyMaterialExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)) && file.type !== "application/pdf");
    if (invalid) {
      Swal.fire("Unsupported file", `"${invalid.name}" is not supported. Allowed extensions: ${studyMaterialExtensions.join(", ")}.`, "warning");
      return;
    }
    const oversized = list.find((file) => file.size > 50 * 1024 * 1024);
    if (oversized) {
      Swal.fire("File too large", `"${oversized.name}" exceeds 50 MB.`, "warning");
      return;
    }
    const additions = list.filter((file, index) =>
      !files.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified) &&
      list.findIndex((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified) === index);
    if (files.length + additions.length > 50) {
      Swal.fire("Too many files", "Upload at most 50 files at a time.", "warning");
      return;
    }
    setFiles((prev) => {
      const next = [...prev];
      for (const file of list) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!next.some((f) => `${f.name}:${f.size}:${f.lastModified}` === key)) next.push(file);
      }
      return next.slice(0, 50);
    });
  };

  const resetModal = () => {
    setForm(emptyForm());
    setFiles([]);
    setLinks([{ title: "", url: "" }]);
    setAudiences([]);
    setTargetClass("");
    setTargetSection("");
    setUploadProgress(0);
  };

  const openCreate = () => {
    resetModal();
    setShowModal(true);
  };

  const validLinks = links.map((l) => ({ title: l.title.trim(), url: l.url.trim() })).filter((l) => l.url);

  const save = async (status) => {
    if (!form.title.trim()) return Swal.fire("Title required", "Please enter a title for the study material.", "warning");
    if (!audiences.length) return Swal.fire("Target required", `Select at least one ${terms.classLower}${isCollege ? "/batch" : "/section"} target.`, "warning");
    if (!files.length && !validLinks.length) return Swal.fire("Add material", "Drop files or add a YouTube/external resource link.", "warning");
    const badLink = validLinks.find((l) => !/^https?:\/\//i.test(l.url));
    if (badLink) return Swal.fire("Invalid link", "External links must start with http:// or https://", "warning");

    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("description", form.description.trim());
    payload.append("material_type", form.materialType);
    payload.append("chapter_unit", form.chapterUnit.trim());
    if (form.subjectId) payload.append("subject_id", form.subjectId);
    payload.append("status", status);
    payload.append("notify_students", form.notifyStudents ? "true" : "false");
    payload.append("audiences", JSON.stringify(audiences));
    payload.append("links", JSON.stringify(validLinks));
    files.forEach((file) => payload.append("files", file));

    try {
      setSaving(true);
      setUploadProgress(1);
      const { data } = await api.post("/learning-resources", payload, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (event.total) setUploadProgress(Math.max(1, Math.min(100, Math.round((event.loaded * 100) / event.total))));
        },
      });
      setShowModal(false);
      resetModal();
      await loadResources();
      const sent = data?.notification?.sent;
      const notifyText = status === "published" && form.notifyStudents
        ? sent > 0 ? ` ${sent} student device notification${sent === 1 ? "" : "s"} sent.` : " Student notifications were queued where registered devices are available."
        : "";
      Swal.fire("Done", `${data?.message || "Study material saved."}${notifyText}`, "success");
    } catch (error) {
      console.error(error);
      Swal.fire("Upload failed", error?.response?.data?.error || error?.message || "Study material could not be uploaded.", "error");
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const publish = async (resource) => {
    const result = await Swal.fire({
      title: "Publish study material?",
      text: resource.notify_students ? "Students with registered devices will also receive a notification." : "This will make it visible to selected students.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Publish",
    });
    if (!result.isConfirmed) return;
    try {
      const { data } = await api.post(`/learning-resources/${resource.id}/publish`);
      await loadResources();
      Swal.fire("Published", data?.message || "Study material is now visible to students.", "success");
    } catch (error) {
      Swal.fire("Error", error?.response?.data?.error || "Unable to publish.", "error");
    }
  };

  const remove = async (resource) => {
    const result = await Swal.fire({
      title: "Delete study material?",
      text: "Uploaded files and links in this batch will be removed.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc3545",
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/learning-resources/${resource.id}`);
      setResources((prev) => prev.filter((r) => r.id !== resource.id));
      Swal.fire("Deleted", "Study material removed.", "success");
    } catch (error) {
      Swal.fire("Error", error?.response?.data?.error || "Unable to delete.", "error");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter((r) => `${r.title || ""} ${r.description || ""} ${r.material_type || ""} ${r.chapter_unit || ""} ${r.subject?.name || ""}`.toLowerCase().includes(q));
  }, [resources, search]);

  return (
    <div className="learning-resources-page container-fluid py-4">
      <div className="lr-hero d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <div className="lr-eyebrow">LMS · Learning Resources</div>
          <h2 className="mb-1">Study Material</h2>
          <p className="mb-0 text-muted">
            {isStudent
              ? "Your published notes, PDFs, presentations and video/resource links in one place."
              : `Bulk-share files and links with selected ${terms.classesLower}${isCollege ? "/batches" : "/sections"}, with optional student notification.`}
          </p>
        </div>
        {canManage && <button className="btn btn-primary btn-lg lr-create-btn" onClick={openCreate}><i className="bi bi-cloud-arrow-up me-2" />Share Study Material</button>}
      </div>

      <div className="card border-0 shadow-sm mb-4 lr-filter-card">
        <div className="card-body">
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0"><i className="bi bi-search" /></span>
            <input className="form-control border-start-0" placeholder="Search title, subject, chapter/unit or material type..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /><div className="text-muted mt-2">Loading study material…</div></div>
      ) : !filtered.length ? (
        <div className="lr-empty card border-0 shadow-sm text-center py-5">
          <div className="display-5 mb-2">📚</div>
          <h5>{isStudent ? "No study material published yet" : "No study material yet"}</h5>
          <p className="text-muted mb-0">{isStudent ? "New resources shared with your class will appear here." : "Share multiple PDFs/files and video/resource links as one batch."}</p>
        </div>
      ) : (
        <div className="row g-4">
          {filtered.map((resource) => (
            <div className="col-12 col-xl-6" key={resource.id}>
              <div className="card h-100 border-0 shadow-sm lr-resource-card">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-start gap-3">
                    <div className="min-w-0">
                      <div className="d-flex flex-wrap gap-2 mb-2">
                        <span className="badge text-bg-primary-subtle text-primary-emphasis">{resource.material_type || "Study Material"}</span>
                        {resource.status && !isStudent && <span className={`badge ${resource.status === "published" ? "text-bg-success" : "text-bg-warning"}`}>{resource.status}</span>}
                      </div>
                      <h4 className="lr-title mb-1">{resource.title}</h4>
                      <div className="small text-muted">
                        {resource.subject?.name || "General"}
                        {resource.chapter_unit ? ` · ${resource.chapter_unit}` : ""}
                      </div>
                    </div>
                    {!isStudent && <div className="dropdown">
                      <button className="btn btn-light btn-sm" data-bs-toggle="dropdown" aria-label="Actions"><i className="bi bi-three-dots-vertical" /></button>
                      <ul className="dropdown-menu dropdown-menu-end">
                        {resource.status !== "published" && <li><button className="dropdown-item" onClick={() => publish(resource)}><i className="bi bi-send-check me-2" />Publish</button></li>}
                        <li><button className="dropdown-item text-danger" onClick={() => remove(resource)}><i className="bi bi-trash me-2" />Delete</button></li>
                      </ul>
                    </div>}
                  </div>

                  {resource.description && <p className="lr-description mt-3 mb-3">{resource.description}</p>}

                  {!!resource.audiences?.length && (
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {resource.audiences.map((a) => (
                        <span className="lr-target-pill" key={`${resource.id}-${a.id || `${a.class_id}-${a.section_id}`}`}>
                          <i className="bi bi-people me-1" />
                          {a.class?.class_name || className(a.class_id)}{a.section_id ? ` · ${a.section?.section_name || sectionName(a.section_id)}` : " · All"}
                        </span>
                      ))}
                    </div>
                  )}

                  {!!resource.files?.length && <div className="mb-3">
                    <div className="lr-section-label"><i className="bi bi-files me-2" />Files ({resource.files.length})</div>
                    <div className="lr-item-list">
                      {resource.files.map((file) => (
                        <a className="lr-file-item" key={file.id} href={file.file_url} target="_blank" rel="noreferrer"
                          onClick={(event) => {
                            if (/\.(txt|md|markdown|html|htm|csv|sql|json|xml|yaml|yml|py|java|c|cpp|h|css|js|ts)$/i.test(file.file_name || "")) {
                              event.preventDefault(); openPreview(file);
                            }
                          }}>
                          <i className={`bi ${String(file.mime_type || "").includes("pdf") ? "bi-file-earmark-pdf" : "bi-file-earmark-text"}`} />
                          <span className="flex-grow-1 text-truncate">{file.file_name}</span>
                          <small>{prettyBytes(file.file_size)}</small>
                          <i className="bi bi-box-arrow-up-right" />
                        </a>
                      ))}
                    </div>
                  </div>}

                  {!!resource.links?.length && <div>
                    <div className="lr-section-label"><i className="bi bi-link-45deg me-2" />Video & Resource Links ({resource.links.length})</div>
                    <div className="lr-item-list">
                      {resource.links.map((link) => (
                        <a className="lr-link-item" key={link.id} href={link.url} target="_blank" rel="noreferrer">
                          <i className={`bi ${isYoutube(link.url) ? "bi-youtube" : "bi-play-btn"}`} />
                          <span className="flex-grow-1 text-truncate">{link.title || (isYoutube(link.url) ? "YouTube video" : "External resource")}</span>
                          <span className="badge rounded-pill text-bg-light">{isYoutube(link.url) ? "YouTube" : "Open"}</span>
                        </a>
                      ))}
                    </div>
                  </div>}
                </div>
                <div className="card-footer bg-transparent border-0 px-4 pb-4 pt-0 text-muted small">
                  {resource.published_at ? `Published ${new Date(resource.published_at).toLocaleString()}` : `Created ${new Date(resource.createdAt).toLocaleString()}`}
                  {resource.creator?.name && !isStudent ? ` · ${resource.creator.name}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal fade show d-block lr-modal-backdrop" tabIndex="-1" role="dialog" aria-modal="true">
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header">
                <div><h4 className="modal-title mb-0">Share Study Material</h4><small className="text-muted">Upload many files together and optionally add multiple YouTube/external links.</small></div>
                <button type="button" className="btn-close" onClick={() => !saving && setShowModal(false)} disabled={saving} />
              </div>
              <div className="modal-body p-4">
                <div className="row g-4">
                  <div className="col-lg-7">
                    <div className="row g-3">
                      <div className="col-12"><label className="form-label fw-semibold">Title *</label><input className="form-control" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. DBMS Unit 3 Notes / Class 10 Revision Pack" /></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">Material Type</label><select className="form-select" value={form.materialType} onChange={(e) => setForm((f) => ({ ...f, materialType: e.target.value }))}>{materialTypes.map((v) => <option key={v}>{v}</option>)}</select></div>
                      <div className="col-md-6"><label className="form-label fw-semibold">{terms.subject}</label><select className="form-select" value={form.subjectId} onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}><option value="">General / Not specific</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                      <div className="col-12"><label className="form-label fw-semibold">{isCollege ? "Unit / Topic" : "Chapter / Unit"}</label><input className="form-control" value={form.chapterUnit} onChange={(e) => setForm((f) => ({ ...f, chapterUnit: e.target.value }))} placeholder={isCollege ? "e.g. Unit 3 - Normalization" : "e.g. Chapter 5 - Life Processes"} /></div>
                      <div className="col-12"><label className="form-label fw-semibold">Description</label><textarea className="form-control" rows="3" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional instructions or summary for students" /></div>
                    </div>

                    <div className="lr-form-section mt-4">
                      <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">Target Students *</h6><small className="text-muted">Add one or more targets</small></div>
                      <div className="row g-2 align-items-end">
                        <div className="col-md-5"><label className="form-label small">{terms.class}</label><select className="form-select" value={targetClass} onChange={(e) => { setTargetClass(e.target.value); setTargetSection(""); }}><option value="">Select {terms.classLower}</option>{classes.map((c) => <option value={c.id} key={c.id}>{c.class_name}</option>)}</select></div>
                        <div className="col-md-5"><label className="form-label small">{terms.section} (optional)</label><select className="form-select" value={targetSection} onChange={(e) => setTargetSection(e.target.value)} disabled={!targetClass}><option value="">All {terms.sectionsLower}</option>{filteredSections.map((s) => <option value={s.id} key={s.id}>{s.section_name}</option>)}</select></div>
                        <div className="col-md-2 d-grid"><button type="button" className="btn btn-outline-primary" onClick={addAudience}><i className="bi bi-plus-lg" /> Add</button></div>
                      </div>
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        {audiences.map((a, index) => <span className="lr-audience-chip" key={`${a.class_id}-${a.section_id || "all"}`}><span>{className(a.class_id)} · {a.section_id ? sectionName(a.section_id) : `All ${terms.sections}`}</span><button type="button" onClick={() => setAudiences((prev) => prev.filter((_, i) => i !== index))}><i className="bi bi-x" /></button></span>)}
                        {!audiences.length && <small className="text-muted">No target selected yet.</small>}
                      </div>
                    </div>

                    <div className="lr-form-section mt-4">
                      <div className="d-flex justify-content-between align-items-center mb-2"><h6 className="mb-0">YouTube / External Video & Resource Links</h6><button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setLinks((prev) => [...prev, { title: "", url: "" }])}><i className="bi bi-plus-lg me-1" />Add link</button></div>
                      {links.map((link, index) => <div className="row g-2 mb-2" key={index}>
                        <div className="col-md-4"><input className="form-control" placeholder="Link title (optional)" value={link.title} onChange={(e) => setLinks((prev) => prev.map((l, i) => i === index ? { ...l, title: e.target.value } : l))} /></div>
                        <div className="col-md-7"><input className="form-control" placeholder="https://youtube.com/... or any resource URL" value={link.url} onChange={(e) => setLinks((prev) => prev.map((l, i) => i === index ? { ...l, url: e.target.value } : l))} /></div>
                        <div className="col-md-1 d-grid"><button type="button" className="btn btn-outline-danger" onClick={() => setLinks((prev) => prev.length === 1 ? [{ title: "", url: "" }] : prev.filter((_, i) => i !== index))}><i className="bi bi-trash" /></button></div>
                      </div>)}
                    </div>
                  </div>

                  <div className="col-lg-5">
                    <div className="lr-form-section h-100">
                      <h6>Bulk File Upload</h6>
                      <p className="small text-muted">Select or drop up to 50 documents, Access databases, SQL files, source code, notebooks, diagrams or archives together. Each file can be up to 50 MB.</p>
                      <div
                        className={`lr-dropzone ${dragging ? "is-dragging" : ""}`}
                        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDragLeave={(e) => { e.preventDefault(); if (e.currentTarget === e.target) setDragging(false); }}
                        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex="0"
                      >
                        <input ref={fileInputRef} type="file" multiple className="d-none" accept={studyMaterialExtensions.join(",")} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                        <i className="bi bi-cloud-arrow-up display-5 text-primary" />
                        <div className="fw-semibold mt-2">Drop all files here</div>
                        <small className="text-muted">or click to select multiple files</small>
                      </div>
                      <div className="lr-selected-files mt-3">
                        {files.map((file, index) => <div className="lr-selected-file" key={`${file.name}-${file.size}-${index}`}><i className="bi bi-file-earmark-pdf" /><div className="flex-grow-1 min-w-0"><div className="text-truncate small fw-semibold">{file.name}</div><div className="text-muted" style={{ fontSize: 11 }}>{prettyBytes(file.size)}</div></div><button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}><i className="bi bi-x-lg" /></button></div>)}
                        {!files.length && <div className="text-center text-muted small py-3">No files selected.</div>}
                      </div>
                      {!!files.length && <div className="small text-muted mt-2">{files.length} file{files.length === 1 ? "" : "s"} selected · {prettyBytes(files.reduce((sum, f) => sum + f.size, 0))} total</div>}
                    </div>
                  </div>
                </div>

                <div className="form-check form-switch mt-4">
                  <input className="form-check-input" type="checkbox" id="notifyStudents" checked={form.notifyStudents} onChange={(e) => setForm((f) => ({ ...f, notifyStudents: e.target.checked }))} />
                  <label className="form-check-label fw-semibold" htmlFor="notifyStudents">Notify students when published</label>
                  <div className="small text-muted">Students with registered mobile devices receive a push notification. Material remains visible in their Learning Resources either way.</div>
                </div>

                {saving && <div className="mt-4"><div className="d-flex justify-content-between small mb-1"><span>Uploading…</span><span>{uploadProgress}%</span></div><div className="progress" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${uploadProgress}%` }} /></div></div>}
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                <button className="btn btn-outline-primary" onClick={() => save("draft")} disabled={saving}><i className="bi bi-save me-2" />Save Draft</button>
                <button className="btn btn-primary" onClick={() => save("published")} disabled={saving}><i className="bi bi-send-check me-2" />Publish to Students</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Modal show={!!preview} onHide={closePreview} size="xl" centered>
        <Modal.Header closeButton><Modal.Title className="text-break">{preview?.file.file_name}</Modal.Title></Modal.Header>
        <Modal.Body>
          {preview?.loading ? <p role="status">Loading preview…</p> : preview?.error ? <div className="alert alert-warning">{preview.error}</div> :
            /\.html?$/i.test(preview?.file.file_name || "") ?
              <iframe title="Study material preview" sandbox="" referrerPolicy="no-referrer"
                srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:;">` + (preview?.content || "")}
                style={{ width: "100%", height: "65vh", border: "1px solid var(--edb-border)", background: "var(--edb-surface)" }} /> :
              <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: "65vh", overflow: "auto", padding: "1rem", background: "var(--edb-surface)" }}>{preview?.content}</pre>}
        </Modal.Body>
        <Modal.Footer>
          <a className="btn btn-primary" href={preview?.file.file_url} target="_blank" rel="noreferrer">Download original</a>
          <button className="btn btn-secondary" onClick={closePreview}>Close</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
