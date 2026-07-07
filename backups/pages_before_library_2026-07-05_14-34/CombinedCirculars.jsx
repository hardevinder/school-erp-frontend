import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const audienceLabels = {
  both: "All",
  teacher: "Teachers",
  student: "Students",
};

const audienceHelp = {
  both: "Visible to students and teachers",
  teacher: "Visible only to teachers",
  student: "Visible only to students",
};

const targetModeLabels = {
  ALL: "All Classes",
  CLASSES: "Selected Classes",
};

const initialForm = {
  title: "",
  content: "",
  audience: "both",
  targetMode: "ALL",
  classIds: [],
};

const parseIdArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((x) => Number(x))
          .filter((n) => Number.isInteger(n) && n > 0)
      )
    );
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? [value] : [];
  }

  const text = String(value).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return parseIdArray(parsed);
  } catch (_) {
    return Array.from(
      new Set(
        text
          .split(",")
          .map((x) => Number(String(x).trim()))
          .filter((n) => Number.isInteger(n) && n > 0)
      )
    );
  }
};

const normalizeClassRow = (row) => {
  const id = Number(row?.id ?? row?.class_id ?? row?.classId ?? row?.Class_ID);
  if (!Number.isInteger(id) || id <= 0) return null;

  const name =
    row?.name ||
    row?.class_name ||
    row?.className ||
    row?.ClassName ||
    row?.Class_Name ||
    `Class ${id}`;

  return {
    id,
    name: String(name),
  };
};

const normalizeClassesResponse = (data) => {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.classes)
    ? data.classes
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.rows)
    ? data.rows
    : Array.isArray(data?.results)
    ? data.results
    : [];

  const mapped = rows.map(normalizeClassRow).filter(Boolean);
  const byId = new Map();
  mapped.forEach((item) => byId.set(item.id, item));

  return Array.from(byId.values()).sort((a, b) => {
    const an = Number(String(a.name).match(/\d+/)?.[0]);
    const bn = Number(String(b.name).match(/\d+/)?.[0]);
    if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
    return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
  });
};

const normalizeCircular = (c) => {
  const classIds = parseIdArray(c?.classIds ?? c?.class_ids ?? c?.targetClassIds);
  const rawTargetMode = String(c?.targetMode || c?.target_mode || "").toUpperCase();

  return {
    ...c,
    targetMode: rawTargetMode === "CLASSES" || classIds.length ? "CLASSES" : "ALL",
    classIds,
  };
};

const shortText = (text, fallback = "—") => {
  const value = String(text || "").trim();
  return value || fallback;
};

const getErrorMessage = (err, fallback = "Something went wrong.") =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  fallback;

const Circulars = () => {
  const [circulars, setCirculars] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editingCircular, setEditingCircular] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);

  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all");

  const fileInputRef = useRef(null);
  const textRef = useRef(null);

  const classNameMap = useMemo(() => {
    const map = new Map();
    classes.forEach((c) => map.set(Number(c.id), c.name));
    return map;
  }, [classes]);

  const stats = useMemo(() => {
    const total = circulars.length;
    const selectedClassCirculars = circulars.filter((c) => c.targetMode === "CLASSES").length;
    const withFiles = circulars.filter((c) => !!c.fileUrl).length;

    return { total, selectedClassCirculars, withFiles };
  }, [circulars]);

  const filteredCirculars = useMemo(() => {
    const q = search.trim().toLowerCase();

    return circulars.filter((c) => {
      const audienceOk = audienceFilter === "all" || c.audience === audienceFilter;
      if (!audienceOk) return false;

      if (!q) return true;

      const haystack = [
        c.title,
        c.description,
        c.content,
        c.audience,
        c.targetMode,
        ...(c.classIds || []).map((id) => classNameMap.get(Number(id)) || id),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [audienceFilter, circulars, classNameMap, search]);

  const selectedClassNames = useMemo(() => {
    return (form.classIds || []).map((id) => classNameMap.get(Number(id)) || `Class ${id}`);
  }, [classNameMap, form.classIds]);

  const fetchCirculars = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/circulars");
      const rows = (data?.circulars || [])
        .map(normalizeCircular)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setCirculars(rows);
    } catch (err) {
      console.error("Error fetching circulars:", err);
      Swal.fire("Error", getErrorMessage(err, "Failed to load circulars."), "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    setClassesLoading(true);

    const endpoints = ["/classes", "/classes/all", "/classes/list", "/class"];

    for (const endpoint of endpoints) {
      try {
        const { data } = await api.get(endpoint);
        const normalized = normalizeClassesResponse(data);
        if (normalized.length) {
          setClasses(normalized);
          setClassesLoading(false);
          return;
        }
      } catch (_) {
        // Try next common endpoint.
      }
    }

    setClasses([]);
    setClassesLoading(false);
  };

  useEffect(() => {
    fetchCirculars();
    fetchClasses();
  }, []);

  const resetModalState = () => {
    setFile(null);
    setRemoveFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openAdd = () => {
    setEditingCircular(null);
    setForm(initialForm);
    resetModalState();
    setShowModal(true);
    setTimeout(() => textRef.current?.focus(), 80);
  };

  const openEdit = (c) => {
    const normalized = normalizeCircular(c);

    setEditingCircular(normalized);
    setForm({
      title: normalized.title || "",
      content: normalized.description || normalized.content || "",
      audience: normalized.audience || "both",
      targetMode: normalized.targetMode || "ALL",
      classIds: normalized.classIds || [],
    });
    resetModalState();
    setShowModal(true);
    setTimeout(() => textRef.current?.focus(), 80);
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowModal(false);
    setEditingCircular(null);
    setForm(initialForm);
    resetModalState();
  };

  const onChooseFile = () => fileInputRef.current?.click();

  const onFileChange = (e) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
      setRemoveFile(false);
    }
  };

  const setAudience = (audience) => {
    setForm((prev) => ({
      ...prev,
      audience,
      // Classes are meaningful only when students are part of audience.
      targetMode: audience === "teacher" ? "ALL" : prev.targetMode,
      classIds: audience === "teacher" ? [] : prev.classIds,
    }));
  };

  const setTargetMode = (targetMode) => {
    setForm((prev) => ({
      ...prev,
      targetMode,
      classIds: targetMode === "ALL" ? [] : prev.classIds,
    }));
  };

  const toggleClass = (classId) => {
    const id = Number(classId);
    if (!Number.isInteger(id) || id <= 0) return;

    setForm((prev) => {
      const current = new Set(prev.classIds || []);
      if (current.has(id)) current.delete(id);
      else current.add(id);

      return {
        ...prev,
        classIds: Array.from(current).sort((a, b) => a - b),
      };
    });
  };

  const selectAllClasses = () => {
    setForm((prev) => ({
      ...prev,
      classIds: classes.map((c) => Number(c.id)).filter(Boolean),
    }));
  };

  const clearClasses = () => {
    setForm((prev) => ({ ...prev, classIds: [] }));
  };

  const validateForm = () => {
    if (!form.title.trim()) {
      Swal.fire("Title required", "Please add a circular title.", "warning");
      return false;
    }

    if (!form.content.trim()) {
      Swal.fire("Content required", "Please add circular details.", "warning");
      return false;
    }

    if (!form.audience) {
      Swal.fire("Audience required", "Please select an audience.", "warning");
      return false;
    }

    if (form.audience !== "teacher" && form.targetMode === "CLASSES" && !form.classIds.length) {
      Swal.fire(
        "Select classes",
        "Please select at least one class or choose All Classes.",
        "warning"
      );
      return false;
    }

    return true;
  };

  const onSave = async () => {
    if (saving) return;
    if (!validateForm()) return;

    setSaving(true);

    const finalTargetMode = form.audience === "teacher" ? "ALL" : form.targetMode;
    const finalClassIds = finalTargetMode === "CLASSES" ? parseIdArray(form.classIds) : [];

    const fd = new FormData();
    fd.append("title", form.title.trim());
    // append both for compatibility with differing backends
    fd.append("description", form.content.trim());
    fd.append("content", form.content.trim());
    fd.append("audience", form.audience);
    fd.append("targetMode", finalTargetMode);
    fd.append("classIds", JSON.stringify(finalClassIds));

    if (file) fd.append("file", file);
    if (editingCircular && removeFile) fd.append("removeFile", "true");

    try {
      if (editingCircular) {
        await api.put(`/circulars/${editingCircular.id}`, fd);
        closeModal(true);
        fetchCirculars();
        await Swal.fire("Updated!", "Circular updated successfully.", "success");
      } else {
        await api.post("/circulars", fd);
        closeModal(true);
        fetchCirculars();
        await Swal.fire("Created!", "Circular created successfully.", "success");
      }
    } catch (err) {
      console.error("Error saving circular:", err);
      Swal.fire("Error", getErrorMessage(err, "Failed to save circular."), "error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    const res = await Swal.fire({
      title: "Delete circular?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
    });

    if (!res.isConfirmed) return;

    try {
      await api.delete(`/circulars/${id}`);
      Swal.fire("Deleted", "Circular removed successfully.", "success");
      fetchCirculars();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", getErrorMessage(err, "Failed to delete circular."), "error");
    }
  };

  const viewFile = (url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getClassSummary = (classIds = []) => {
    const ids = parseIdArray(classIds);
    if (!ids.length) return "All classes";

    const names = ids.map((id) => classNameMap.get(Number(id)) || `Class ${id}`);
    if (names.length <= 3) return names.join(", ");
    return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
  };

  // keyboard: Ctrl/Cmd + Enter to save
  useEffect(() => {
    const handler = (e) => {
      if (!showModal) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSave();
      if (e.key === "Escape") closeModal();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showModal, form, editingCircular, file, removeFile, saving]);

  return (
    <div className="circular-page container-fluid px-3 px-lg-4 py-3">
      <div className="circular-hero mb-4">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
          <div>
            <div className="eyebrow mb-1">School Communication</div>
            <h1 className="h3 fw-black mb-1">Circular Management</h1>
            <p className="mb-0 text-white-75">
              Create circulars for teachers, students, all users, or selected student classes.
            </p>
          </div>

          <button className="btn btn-light btn-lg fw-semibold shadow-sm" onClick={openAdd}>
            <i className="bi bi-plus-lg me-2" />
            Add Circular
          </button>
        </div>

        <div className="row g-3 mt-3">
          <div className="col-12 col-md-4">
            <div className="hero-stat-card">
              <span className="hero-stat-icon bg-primary-subtle text-primary">
                <i className="bi bi-megaphone-fill" />
              </span>
              <div>
                <div className="hero-stat-value">{stats.total}</div>
                <div className="hero-stat-label">Total Circulars</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="hero-stat-card">
              <span className="hero-stat-icon bg-success-subtle text-success">
                <i className="bi bi-diagram-3-fill" />
              </span>
              <div>
                <div className="hero-stat-value">{stats.selectedClassCirculars}</div>
                <div className="hero-stat-label">Class Targeted</div>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="hero-stat-card">
              <span className="hero-stat-icon bg-warning-subtle text-warning">
                <i className="bi bi-paperclip" />
              </span>
              <div>
                <div className="hero-stat-value">{stats.withFiles}</div>
                <div className="hero-stat-label">With Attachment</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 p-lg-4">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div className="search-box flex-grow-1">
              <i className="bi bi-search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, content, audience or class…"
              />
            </div>

            <div className="d-flex flex-wrap gap-2">
              {["all", "both", "student", "teacher"].map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`btn btn-sm rounded-pill ${
                    audienceFilter === a ? "btn-primary" : "btn-outline-primary"
                  }`}
                  onClick={() => setAudienceFilter(a)}
                >
                  {a === "all" ? "All" : audienceLabels[a] || a}
                </button>
              ))}

              <button type="button" className="btn btn-sm btn-outline-secondary rounded-pill" onClick={fetchCirculars}>
                <i className="bi bi-arrow-clockwise me-1" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive circular-table-wrap">
          <table className="table table-hover align-middle mb-0 circular-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>#</th>
                <th>Title</th>
                <th className="content-col">Content</th>
                <th>Audience</th>
                <th>Target</th>
                <th>File</th>
                <th className="text-end" style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm me-2" />
                    Loading circulars…
                  </td>
                </tr>
              ) : filteredCirculars.length ? (
                filteredCirculars.map((c, i) => {
                  const isClassTargeted = c.targetMode === "CLASSES";

                  return (
                    <tr key={c.id}>
                      <td className="text-muted fw-semibold">{i + 1}</td>
                      <td>
                        <div className="fw-bold text-dark">{c.title}</div>
                        <div className="small text-muted">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN") : "—"}
                        </div>
                      </td>
                      <td className="text-muted small">
                        <span className="text-truncate-2 d-inline-block">
                          {shortText(c.description || c.content)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill audience-badge audience-${c.audience || "both"}`}>
                          {audienceLabels[c.audience] || c.audience || "All"}
                        </span>
                      </td>
                      <td>
                        <div className="target-summary">
                          <span className={`badge rounded-pill ${isClassTargeted ? "text-bg-success" : "text-bg-light"}`}>
                            {targetModeLabels[c.targetMode] || "All Classes"}
                          </span>
                          <div className="small text-muted mt-1">
                            {isClassTargeted ? getClassSummary(c.classIds) : "Everyone in audience"}
                          </div>
                        </div>
                      </td>
                      <td>
                        {c.fileUrl ? (
                          <button className="btn btn-outline-info btn-sm rounded-pill" onClick={() => viewFile(c.fileUrl)}>
                            <i className="bi bi-eye me-1" />
                            View
                          </button>
                        ) : (
                          <span className="text-muted small">No File</span>
                        )}
                      </td>
                      <td className="text-end text-nowrap">
                        <button className="btn btn-primary btn-sm rounded-pill me-2" onClick={() => openEdit(c)}>
                          <i className="bi bi-pencil-square me-1" />
                          Edit
                        </button>
                        <button className="btn btn-outline-danger btn-sm rounded-pill" onClick={() => onDelete(c.id)}>
                          <i className="bi bi-trash me-1" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="empty-state mx-auto">
                      <i className="bi bi-inbox" />
                      <h6 className="fw-bold mt-3 mb-1">No circulars found</h6>
                      <p className="text-muted small mb-3">Create your first circular or change the filters.</p>
                      <button className="btn btn-primary rounded-pill" onClick={openAdd}>
                        <i className="bi bi-plus-lg me-1" />
                        Add Circular
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal show d-block circular-modal" style={{ backgroundColor: "rgba(15, 23, 42, .58)" }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable modal-fullscreen-sm-down">
            <div className="modal-content circular-modal-content rounded-4 border-0 shadow-lg overflow-hidden">
              <div className="modal-header modal-header-gradient text-white">
                <div>
                  <div className="small opacity-75">{editingCircular ? "Update existing notice" : "Create new notice"}</div>
                  <h5 className="modal-title fw-black mb-0">
                    {editingCircular ? "Edit Circular" : "Add Circular"}
                  </h5>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={closeModal} disabled={saving} />
              </div>

              <div className="modal-body circular-modal-body p-3 p-lg-4">
                <div className="row g-4">
                  <div className="col-12 col-lg-7">
                    <div className="section-card mb-3">
                      <div className="section-title">
                        <i className="bi bi-pencil-square" />
                        Circular Details
                      </div>

                      <label className="form-label fw-semibold">Title <span className="text-danger">*</span></label>
                      <input
                        className="form-control form-control-lg rounded-3"
                        placeholder="e.g., Parent Teacher Meeting on Friday"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        maxLength={120}
                      />
                      <div className="form-text text-end">{form.title.length}/120</div>

                      <label className="form-label fw-semibold mt-3">Content / Description <span className="text-danger">*</span></label>
                      <textarea
                        ref={textRef}
                        className="form-control rounded-3"
                        rows={6}
                        placeholder="Write details, date, time and instructions…"
                        value={form.content}
                        onChange={(e) => setForm({ ...form, content: e.target.value })}
                        style={{ resize: "vertical" }}
                      />
                    </div>

                    <div className="section-card mb-3">
                      <div className="section-title">
                        <i className="bi bi-people-fill" />
                        Audience
                      </div>

                      <div className="row g-2">
                        {["both", "student", "teacher"].map((a) => (
                          <div className="col-12 col-md-4" key={a}>
                            <button
                              type="button"
                              className={`audience-card ${form.audience === a ? "active" : ""}`}
                              onClick={() => setAudience(a)}
                            >
                              <span className="audience-icon">
                                <i
                                  className={
                                    a === "teacher"
                                      ? "bi bi-person-workspace"
                                      : a === "student"
                                      ? "bi bi-mortarboard-fill"
                                      : "bi bi-broadcast"
                                  }
                                />
                              </span>
                              <span>
                                <strong>{audienceLabels[a]}</strong>
                                <small>{audienceHelp[a]}</small>
                              </span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {form.audience !== "teacher" && (
                      <div className="section-card mb-3">
                        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
                          <div>
                            <div className="section-title mb-1">
                              <i className="bi bi-diagram-3-fill" />
                              Student Class Target
                            </div>
                            <div className="small text-muted">
                              Choose all student classes or send this circular only to selected classes.
                            </div>
                          </div>

                          <div className="btn-group btn-group-sm target-toggle" role="group">
                            <button
                              type="button"
                              className={`btn ${form.targetMode === "ALL" ? "btn-primary" : "btn-outline-primary"}`}
                              onClick={() => setTargetMode("ALL")}
                            >
                              All Classes
                            </button>
                            <button
                              type="button"
                              className={`btn ${form.targetMode === "CLASSES" ? "btn-primary" : "btn-outline-primary"}`}
                              onClick={() => setTargetMode("CLASSES")}
                            >
                              Selected Classes
                            </button>
                          </div>
                        </div>

                        {form.targetMode === "CLASSES" && (
                          <>
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                              <div className="small fw-semibold text-dark">
                                Selected: {form.classIds.length} class{form.classIds.length === 1 ? "" : "es"}
                              </div>
                              <div className="d-flex gap-2">
                                <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill" onClick={selectAllClasses} disabled={!classes.length}>
                                  Select All
                                </button>
                                <button type="button" className="btn btn-outline-danger btn-sm rounded-pill" onClick={clearClasses} disabled={!form.classIds.length}>
                                  Clear
                                </button>
                              </div>
                            </div>

                            {classesLoading ? (
                              <div className="text-muted small py-2">
                                <span className="spinner-border spinner-border-sm me-2" />
                                Loading classes…
                              </div>
                            ) : classes.length ? (
                              <div className="class-grid">
                                {classes.map((cls) => {
                                  const selected = form.classIds.includes(Number(cls.id));
                                  return (
                                    <button
                                      key={cls.id}
                                      type="button"
                                      className={`class-chip ${selected ? "active" : ""}`}
                                      onClick={() => toggleClass(cls.id)}
                                    >
                                      <i className={selected ? "bi bi-check-circle-fill" : "bi bi-circle"} />
                                      {cls.name}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="alert alert-warning small mb-0">
                                Class list could not be loaded. Please check your class API endpoint.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div className="section-card">
                      <div className="section-title">
                        <i className="bi bi-paperclip" />
                        Attachment
                      </div>

                      <div className="upload-box">
                        <div>
                          <div className="fw-semibold">
                            {file
                              ? file.name
                              : editingCircular?.fileUrl && !removeFile
                              ? "Current attachment available"
                              : "No file selected"}
                          </div>
                          <div className="small text-muted">PDF or image file supported</div>
                        </div>

                        <div className="d-flex align-items-center flex-wrap gap-2">
                          <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill" onClick={onChooseFile}>
                            <i className="bi bi-upload me-1" />
                            {file || (editingCircular?.fileUrl && !removeFile) ? "Replace" : "Upload"}
                          </button>

                          {file && (
                            <button type="button" className="btn btn-outline-danger btn-sm rounded-pill" onClick={() => setFile(null)}>
                              Remove
                            </button>
                          )}

                          {!file && editingCircular?.fileUrl && !removeFile && (
                            <>
                              <button type="button" className="btn btn-outline-info btn-sm rounded-pill" onClick={() => viewFile(editingCircular.fileUrl)}>
                                View current
                              </button>
                              <button type="button" className="btn btn-outline-danger btn-sm rounded-pill" onClick={() => setRemoveFile(true)}>
                                Remove
                              </button>
                            </>
                          )}

                          {removeFile && (
                            <button type="button" className="btn btn-outline-secondary btn-sm rounded-pill" onClick={() => setRemoveFile(false)}>
                              Undo remove
                            </button>
                          )}
                        </div>

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          hidden
                          onChange={onFileChange}
                        />
                      </div>

                      {removeFile && <div className="small text-danger mt-2">Current file will be removed after saving.</div>}
                    </div>
                  </div>

                  <div className="col-12 col-lg-5">
                    <div className="preview-card sticky-lg-top">
                      <div className="preview-header">
                        <div>
                          <div className="small opacity-75">Live Preview</div>
                          <div className="fw-bold">Circular Card</div>
                        </div>
                        <span className="badge rounded-pill text-bg-light">
                          {audienceLabels[form.audience] || form.audience}
                        </span>
                      </div>

                      <div className="preview-body">
                        <h5 className="fw-black mb-2">{form.title || "Untitled Circular"}</h5>
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          <span className="badge rounded-pill text-bg-primary">
                            {audienceLabels[form.audience] || form.audience}
                          </span>
                          <span className="badge rounded-pill text-bg-success">
                            {form.audience === "teacher"
                              ? "Teachers only"
                              : form.targetMode === "CLASSES"
                              ? `${form.classIds.length} class${form.classIds.length === 1 ? "" : "es"}`
                              : "All Classes"}
                          </span>
                        </div>

                        {form.targetMode === "CLASSES" && form.audience !== "teacher" && selectedClassNames.length > 0 && (
                          <div className="selected-class-preview mb-3">
                            {selectedClassNames.slice(0, 8).map((name) => (
                              <span key={name}>{name}</span>
                            ))}
                            {selectedClassNames.length > 8 && <span>+{selectedClassNames.length - 8} more</span>}
                          </div>
                        )}

                        <p className="preview-text">
                          {form.content || <em className="text-muted">Circular content will appear here…</em>}
                        </p>

                        <div className="preview-attachment mt-4">
                          {(file || (editingCircular?.fileUrl && !removeFile)) ? (
                            <>
                              <div className="fw-semibold mb-2">Attachment</div>
                              {file ? (
                                <div className="attachment-mini">
                                  <i className="bi bi-file-earmark-arrow-up" />
                                  <span>{file.name}</span>
                                </div>
                              ) : (
                                <>
                                  {/(png|jpg|jpeg|gif|webp|bmp|svg)(\?|$)/i.test(editingCircular?.fileUrl || "") ? (
                                    <img src={editingCircular.fileUrl} alt="Preview" className="img-fluid rounded-3 border" />
                                  ) : /\.pdf(\?|$)/i.test(editingCircular?.fileUrl || "") ? (
                                    <iframe
                                      title="PDF preview"
                                      src={`${editingCircular.fileUrl}#view=FitH`}
                                      style={{ width: "100%", height: 320, border: 0, borderRadius: 12, background: "#f8fafc" }}
                                    />
                                  ) : (
                                    <div className="attachment-mini">
                                      <i className="bi bi-file-earmark" />
                                      <span>Attachment available</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <div className="text-muted small">No attachment selected</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer circular-modal-footer d-flex justify-content-between flex-wrap gap-2">
                <div className="small text-muted">
                  Tip: Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to save
                </div>
                <div>
                  <button className="btn btn-light border rounded-pill me-2" onClick={closeModal} disabled={saving}>
                    Close
                  </button>
                  <button className="btn btn-primary rounded-pill px-4" onClick={onSave} disabled={saving}>
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check2-circle me-1" />
                        Save Circular
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .circular-page {
          background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
          min-height: calc(100vh - 56px);
        }

        .fw-black { font-weight: 900; }
        .text-white-75 { color: rgba(255,255,255,.78); }

        .circular-hero {
          border-radius: 26px;
          padding: 24px;
          color: #fff;
          background:
            radial-gradient(circle at top right, rgba(255,255,255,.22), transparent 30%),
            linear-gradient(135deg, #1f7ae0 0%, #4f46e5 48%, #7c3aed 100%);
          box-shadow: 0 16px 40px rgba(37, 99, 235, .18);
        }

        .eyebrow {
          text-transform: uppercase;
          letter-spacing: .13em;
          font-size: 11px;
          font-weight: 800;
          color: rgba(255,255,255,.78);
        }

        .hero-stat-card {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.14);
          backdrop-filter: blur(10px);
          padding: 14px;
          border-radius: 18px;
        }

        .hero-stat-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: #fff !important;
        }

        .hero-stat-value {
          font-size: 22px;
          line-height: 1;
          font-weight: 900;
        }

        .hero-stat-label {
          font-size: 12px;
          color: rgba(255,255,255,.78);
          font-weight: 700;
        }

        .search-box {
          min-width: 260px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 10px 14px;
          background: #f8fafc;
        }

        .search-box i { color: #64748b; }
        .search-box input {
          border: 0;
          outline: 0;
          width: 100%;
          background: transparent;
          color: #0f172a;
          font-weight: 600;
        }

        .circular-table thead th {
          background: #f8fafc;
          color: #475569;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
          padding: 14px 16px;
        }

        .circular-table td {
          padding: 15px 16px;
          vertical-align: middle;
        }

        .content-col { min-width: 280px; }

        .text-truncate-2 {
          max-width: 520px;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          white-space: pre-wrap;
        }

        .audience-badge {
          padding: 7px 10px;
          font-weight: 800;
        }

        .audience-both { background: #eef2ff; color: #4338ca; }
        .audience-student { background: #ecfdf5; color: #047857; }
        .audience-teacher { background: #fff7ed; color: #c2410c; }

        .target-summary { min-width: 150px; }

        .empty-state {
          max-width: 320px;
          color: #64748b;
        }
        .empty-state i {
          font-size: 42px;
          color: #94a3b8;
        }

        .modal-header-gradient {
          border: 0;
          background: linear-gradient(135deg, #1f7ae0 0%, #4f46e5 55%, #7c3aed 100%);
        }

        .section-card {
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 20px;
          padding: 16px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, .05);
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 14px;
        }
        .section-title i { color: #2563eb; }

        .audience-card {
          width: 100%;
          text-align: left;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #0f172a;
          border-radius: 16px;
          padding: 13px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          transition: all .18s ease;
        }

        .audience-card:hover {
          border-color: #93c5fd;
          transform: translateY(-1px);
        }

        .audience-card.active {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 10px 22px rgba(37, 99, 235, .12);
        }

        .audience-card strong {
          display: block;
          font-size: 14px;
        }

        .audience-card small {
          display: block;
          color: #64748b;
          line-height: 1.3;
          margin-top: 2px;
        }

        .audience-icon {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          color: #2563eb;
          background: #dbeafe;
          flex: 0 0 auto;
        }

        .target-toggle .btn { font-weight: 800; }

        .class-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 8px;
          max-height: 220px;
          overflow-y: auto;
          padding: 2px;
        }

        .class-chip {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #334155;
          border-radius: 999px;
          padding: 8px 10px;
          font-weight: 800;
          font-size: 12.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .class-chip.active {
          background: #ecfdf5;
          color: #047857;
          border-color: #34d399;
        }

        .upload-box {
          border: 1px dashed #cbd5e1;
          border-radius: 18px;
          background: #f8fafc;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .preview-card {
          top: 16px;
          border-radius: 24px;
          overflow: hidden;
          background: #fff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 16px 36px rgba(15, 23, 42, .08);
        }

        .preview-header {
          color: #fff;
          background: linear-gradient(135deg, #0f172a, #334155);
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .preview-body { padding: 18px; }

        .preview-text {
          color: #334155;
          white-space: pre-wrap;
          line-height: 1.55;
          min-height: 120px;
        }

        .selected-class-preview {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .selected-class-preview span {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
          border-radius: 999px;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: 800;
        }

        .attachment-mini {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 14px;
          padding: 10px 12px;
          color: #334155;
          font-weight: 700;
        }

        .attachment-mini i { color: #2563eb; }

        .circular-modal {
          overflow-y: auto;
          padding: 10px;
        }

        .circular-modal .modal-dialog {
          margin-top: 10px;
          margin-bottom: 10px;
        }

        .circular-modal-content {
          max-height: calc(100dvh - 20px);
          display: flex;
          flex-direction: column;
        }

        .circular-modal-body {
          overflow-y: auto;
          min-height: 0;
          -webkit-overflow-scrolling: touch;
        }

        .circular-modal-footer {
          background: rgba(255,255,255,.96);
          border-top: 1px solid #e2e8f0;
          flex: 0 0 auto;
        }

        .modal-header-gradient {
          flex: 0 0 auto;
        }

        .preview-card {
          max-height: calc(100dvh - 120px);
          display: flex;
          flex-direction: column;
        }

        .preview-body {
          overflow-y: auto;
          min-height: 0;
        }

        .preview-attachment iframe {
          max-height: 280px;
        }

        .circular-table-wrap {
          max-height: calc(100dvh - 320px);
          overflow: auto;
        }

        .circular-table thead th {
          position: sticky;
          top: 0;
          z-index: 2;
        }

        @media (max-width: 991.98px) {
          .circular-page {
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .circular-hero {
            padding: 18px;
            border-radius: 20px;
            margin-bottom: 14px !important;
          }

          .circular-hero .btn-lg {
            width: 100%;
            padding-top: 10px;
            padding-bottom: 10px;
          }

          .hero-stat-card {
            padding: 12px;
            border-radius: 16px;
          }

          .search-box {
            min-width: 100%;
            border-radius: 18px;
          }

          .circular-table-wrap {
            max-height: none;
          }

          .content-col {
            min-width: 220px;
          }

          .circular-modal {
            padding: 0;
          }

          .circular-modal .modal-dialog {
            margin: 0;
          }

          .circular-modal-content {
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0 !important;
          }

          .circular-modal-body {
            padding: 12px !important;
          }

          .section-card {
            padding: 13px;
            border-radius: 16px;
            margin-bottom: 12px !important;
          }

          .modal-header-gradient {
            padding: 12px 14px;
          }

          .modal-header-gradient .modal-title {
            font-size: 18px;
          }

          .audience-card {
            padding: 11px;
          }

          .class-grid {
            grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
            max-height: 170px;
          }

          .upload-box {
            align-items: stretch;
          }

          .upload-box > div {
            width: 100%;
          }

          .upload-box .d-flex {
            justify-content: flex-start;
          }

          .preview-card {
            position: static !important;
            max-height: none;
            border-radius: 18px;
          }

          .preview-body {
            max-height: 360px;
            overflow-y: auto;
          }

          .preview-text {
            min-height: 80px;
          }

          .preview-attachment iframe {
            height: 220px !important;
          }

          .circular-modal-footer {
            position: sticky;
            bottom: 0;
            z-index: 5;
            padding: 10px 12px;
          }

          .circular-modal-footer > div:last-child {
            display: flex;
            width: 100%;
            gap: 8px;
          }

          .circular-modal-footer .btn {
            flex: 1;
            margin-right: 0 !important;
          }
        }

        @media (max-width: 575.98px) {
          .circular-hero h1 {
            font-size: 22px;
          }

          .circular-hero p {
            font-size: 13px;
          }

          .hero-stat-value {
            font-size: 19px;
          }

          .card-body {
            padding: 12px !important;
          }

          .target-toggle {
            width: 100%;
          }

          .target-toggle .btn {
            flex: 1;
            padding-left: 8px;
            padding-right: 8px;
          }

          .class-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .section-title {
            margin-bottom: 10px;
          }

          .form-control-lg {
            font-size: 15px;
            padding: 10px 12px;
          }

          textarea.form-control {
            min-height: 118px;
          }

          .preview-header {
            padding: 13px;
          }

          .preview-body {
            padding: 14px;
            max-height: 300px;
          }

          .selected-class-preview span {
            font-size: 11px;
          }

          .circular-modal-footer .small {
            display: none;
          }
        }

        @media (min-width: 1200px) {
          .modal-xl { --bs-modal-width: 1120px; }
        }
      `}</style>
    </div>
  );
};

export default Circulars;