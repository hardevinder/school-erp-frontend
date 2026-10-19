import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../api";
import "./ProgramSyllabusDocuments.css";

const rows = (data, key) => Array.isArray(data) ? data : Array.isArray(data?.[key]) ? data[key] : Array.isArray(data?.data) ? data.data : [];
const getName = (row) => row?.class_name || row?.section_name || row?.name || row?.subject_name || row?.title || `#${row?.id}`;
const readable = (size) => size ? `${(size / 1048576).toFixed(1)} MB` : "";
const initial = { class_id: "", section_id: "", subject_id: "", coverage: "PROGRAM", title: "", university: "", batch_label: "", description: "" };
const types = [
  { value: "PROGRAM", title: "Entire Program", note: "All semesters · All students" },
  { value: "SEMESTER", title: "Specific Semester", note: "Only one selected semester" },
  { value: "SUBJECT", title: "Subject & Semester", note: "Subject-specific syllabus" },
];

export default function ProgramSyllabusDocuments({ student = false }) {
  const [list, setList] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(initial);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editor, setEditor] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterClass, setFilterClass] = useState("");
  const input = useRef(null);
  const fileRef = useRef(null);
  const chosenClass = useMemo(() => classes.find(c => String(c.id) === String(form.class_id)), [classes, form.class_id]);
  const availableSections = useMemo(() => {
    const embedded = chosenClass?.Sections || chosenClass?.sections || [];
    return embedded.length ? embedded : sections.filter(s => String(s.class_id) === String(form.class_id));
  }, [chosenClass, sections, form.class_id]);
  const availableSubjects = useMemo(() => subjects.filter(s => {
    if (!form.class_id) return false;
    if (s.class_id && String(s.class_id) !== String(form.class_id)) return false;
    return true;
  }), [subjects, form.class_id]);
  const classLabel = useCallback((id) => {
    const found = classes.find(c => String(c.id) === String(id));
    return found ? getName(found) : (id ? `Program #${id}` : "Unassigned program");
  }, [classes]);
  const filteredDocs = useMemo(() => filterClass ? list.filter(d => String(d.class_id) === String(filterClass)) : list, [list, filterClass]);
  const programCounts = useMemo(() => {
    const counts = {};
    list.forEach(d => { const key = String(d.class_id ?? ""); counts[key] = (counts[key] || 0) + 1; });
    return counts;
  }, [list]);
  const startEdit = (doc) => {
    setEditingId(doc.id);
    setForm({ class_id: String(doc.class_id ?? ""), section_id: String(doc.section_id ?? ""), subject_id: String(doc.subject_id ?? ""), coverage: doc.coverage || "PROGRAM", title: doc.title || "", university: doc.university || "", batch_label: doc.batch_label || "", description: doc.description || "" });
    setFile(null); setEditor(true); setError(""); setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const closeEditor = () => { setEditor(false); setEditingId(null); setForm(initial); setFile(null); if (input.current) input.current.value = ""; };
  const update = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const refresh = useCallback(async () => {
    try {
      const response = await api.get(student ? "/syllabus-breakdowns/documents/my" : "/syllabus-breakdowns/documents");
      setList(rows(response.data, "documents"));
    } catch (e) { setError(e?.response?.data?.error || "Unable to load syllabi."); }
    finally { setBusy(false); }
  }, [student]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (student) return;
    Promise.all([api.get("/classes?withSections=true"), api.get("/sections"), api.get("/subjects")]).then(([c, s, sub]) => {
      setClasses(rows(c.data, "classes"));
      setSections(rows(s.data, "sections"));
      setSubjects(rows(sub.data, "subjects"));
    }).catch(() => setError("Program list could not be loaded. Refresh and try again."));
  }, [student]);
  const choose = (items) => {
    const f = items?.[0];
    if (!f) return;
    if (!/\.(pdf|doc|docx)$/i.test(f.name)) return setError("Please use a PDF, DOC or DOCX syllabus.");
    if (f.size > 50 * 1024 * 1024) return setError("Maximum syllabus size is 50 MB.");
    setFile(f); setError("");
  };
  const submit = async (status) => {
    if (!form.class_id || !form.title.trim() || (!editingId && !file) || (form.coverage !== "PROGRAM" && !form.section_id) || (form.coverage === "SUBJECT" && !form.subject_id)) {
      setError("Please select program, required semester/subject, title and syllabus file."); return;
    }
    const fd = new FormData();
    if (!editingId) {
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("status", status);
      fd.append("file", file);
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      if (editingId) {
        await api.put(`/syllabus-breakdowns/documents/${editingId}`, form);
      } else {
        await api.post("/syllabus-breakdowns/documents", fd);
      }
      closeEditor();
      if (input.current) input.current.value = "";
      setSuccess(editingId ? "Syllabus details updated successfully." : status === "published" ? "Syllabus published to eligible students." : "Syllabus saved as draft.");
      await refresh();
    } catch (e) { setError(e?.response?.data?.error || "Upload failed. Please try again."); }
    finally { setSaving(false); }
  };
  const publish = async (id) => {
    if (!window.confirm("Publish this syllabus to students?")) return;
    try { await api.post(`/syllabus-breakdowns/documents/${id}/publish`); setSuccess("Syllabus published."); await refresh(); }
    catch (e) { setError(e?.response?.data?.error || "Cannot publish."); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this syllabus file permanently?")) return;
    try { await api.delete(`/syllabus-breakdowns/documents/${id}`); await refresh(); }
    catch (e) { setError(e?.response?.data?.error || "Cannot delete."); }
  };
  const open = async (doc, download = false) => {
    setError("");
    try {
      const response = await api.get(`/syllabus-breakdowns/documents/${doc.id}/file${download ? "?download=1" : ""}`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: doc.mime_type || (doc.original_name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream") });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.rel = "noopener noreferrer";
      if (download || !doc.original_name?.toLowerCase().endsWith(".pdf")) anchor.download = doc.original_name;
      else anchor.target = "_blank";
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (student) setList(current => current.map(d => d.id === doc.id ? { ...d, is_new: false } : d));
    } catch (e) { setError(e?.response?.data?.error || "Unable to open the syllabus."); }
  };
  return (
    <section className="psd-root" aria-label={student ? "My Syllabus" : "Original University Syllabus"}>
      <div className="psd-head"><div><div className="psd-eyebrow">EDUBRIDGE · UNIVERSITY SYLLABUS</div><h3>{student ? "My Syllabus" : "Original University Syllabus"}</h3>
        <p>{student ? "Official program and semester documents shared by your institution." : "Share university syllabus files directly. No AI processing required; existing AI breakdown stays available."}</p></div>
        {!student && <button type="button" className="psd-primary" onClick={() => editor ? closeEditor() : setEditor(true)}>{editor ? "Close Editor" : "+ Upload Syllabus"}</button>}
      </div>
      {!!error && <div role="alert" className="psd-error">{error}</div>}{!!success && <div role="status" className="psd-success">{success}</div>}
      {!student && editor && <div className="psd-editor">
        <h4>{editingId ? "Edit syllabus · Program and visibility" : "1 · Choose who can see the syllabus"}</h4>
        <div className="psd-field-label">Program *</div><div className="psd-pills">{classes.map(c => <button key={c.id} type="button" className={String(form.class_id) === String(c.id) ? "active" : ""} onClick={() => setForm(f => ({ ...f, class_id: String(c.id), section_id: "", subject_id: "" }))}>{getName(c)}</button>)}</div>
        <div className="psd-field-label">Coverage *</div><div className="psd-types">{types.map(t => <button key={t.value} type="button" className={form.coverage === t.value ? "active" : ""} onClick={() => setForm(f => ({ ...f, coverage: t.value, section_id: t.value === "PROGRAM" ? "" : f.section_id, subject_id: t.value !== "SUBJECT" ? "" : f.subject_id }))}><strong>{t.title}</strong><small>{t.note}</small></button>)}</div>
        {form.coverage !== "PROGRAM" && <><div className="psd-field-label">Semester / Section *</div><div className="psd-pills">{availableSections.map(s => <button key={s.id} type="button" className={String(form.section_id) === String(s.id) ? "active" : ""} onClick={() => update("section_id", String(s.id))}>{getName(s)}</button>)}</div></>}
        {form.coverage === "SUBJECT" && <><div className="psd-field-label">Subject *</div><div className="psd-pills">{availableSubjects.map(s => <button key={s.id} type="button" className={String(form.subject_id) === String(s.id) ? "active" : ""} onClick={() => update("subject_id", String(s.id))}>{getName(s)}</button>)}</div></>}
        <h4>2 · Syllabus details</h4><div className="psd-fields">
          <label>Title *<input value={form.title} onChange={e => update("title", e.target.value)} placeholder="B.Sc. Nutrition & Dietetics — Full Program Syllabus" maxLength={255} /></label>
          <label>University<input value={form.university} onChange={e => update("university", e.target.value)} placeholder="I.K. Gujral Punjab Technical University" /></label>
          <label>Applicable batch / version<input value={form.batch_label} onChange={e => update("batch_label", e.target.value)} placeholder="2025 onwards" /></label>
          <label className="psd-wide">Description (optional)<textarea value={form.description} onChange={e => update("description", e.target.value)} rows="2" /></label>
        </div>
        {!editingId && <><h4>3 · Drag & drop original syllabus</h4>
        <div className={`psd-drop ${drag ? "dragging" : ""}`} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }} onDragEnter={e => { e.preventDefault(); setDrag(true); }} onDragOver={e => e.preventDefault()} onDragLeave={e => { e.preventDefault(); setDrag(false); }} onDrop={e => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files); }} onClick={() => input.current?.click()}>
          <span className="psd-cloud">☁</span><strong>{file ? file.name : "Drop your university syllabus here"}</strong><span>{file ? readable(file.size) : "or click to browse · PDF, DOC, DOCX · max 50 MB"}</span>
          <input ref={input} type="file" accept=".pdf,.doc,.docx" onChange={e => choose(e.target.files)} style={{ display: "none" }} />
        </div>
        </>}
        <div className="psd-review">{form.coverage === "PROGRAM" ? "✓ All semesters of the selected program will have access." : "Only eligible students for the selected semester/subject will see this file."}</div>
        <div className="psd-actions">{editingId ? <><button type="button" onClick={closeEditor} disabled={saving}>Cancel</button><button type="button" className="psd-primary" disabled={saving} onClick={() => submit("published")}>{saving ? "Saving…" : "Save Changes"}</button></> : <><button type="button" disabled={saving} onClick={() => submit("draft")}>Save Draft</button><button type="button" className="psd-primary" disabled={saving} onClick={() => submit("published")}>{saving ? "Uploading…" : "Publish to Students →"}</button></>}</div>
      </div>}
      {!student && <div className="psd-filter-wrap" aria-label="Filter syllabi by program"><div className="psd-filter-title">Filter by Class / Program</div><div className="psd-filter-buttons"><button type="button" className={!filterClass ? "active" : ""} onClick={() => setFilterClass("")}>All Programs <span>{list.length}</span></button>{classes.filter(c => programCounts[String(c.id)]).map(c => <button type="button" key={c.id} className={String(filterClass) === String(c.id) ? "active" : ""} onClick={() => setFilterClass(String(c.id))}>{getName(c)} <span>{programCounts[String(c.id)]}</span></button>)}{Object.entries(programCounts).filter(([id]) => !classes.some(c => String(c.id) === id)).map(([id, count]) => <button type="button" key={id} className={filterClass === id ? "active" : ""} onClick={() => setFilterClass(id)}>{classLabel(id)} <span>{count}</span></button>)}</div></div>}
      <div className="psd-list-head"><strong>{student ? "Available documents" : "Uploaded syllabus documents"}</strong><span>{filteredDocs.length} of {list.length} documents</span></div>
      {busy && <p>Loading syllabus files…</p>}
      {!busy && !list.length && <div className="psd-empty">{student ? "No published syllabus is available for your program yet." : "No syllabus uploaded yet. Choose Upload Syllabus to get started."}</div>}
      {!busy && !!list.length && !filteredDocs.length && <div className="psd-empty">No syllabus files for this program.</div>}
      <div className="psd-grid">{filteredDocs.map(doc => <article key={doc.id} className={`psd-card ${doc.is_new ? "unread" : ""}`}>
        <div className="psd-card-top"><span className="psd-file-icon">PDF</span><div>{doc.is_new && <b className="psd-new">NEW</b>}{!student && <b className={`psd-status ${doc.status}`}>{doc.status}</b>}</div></div>
        <h5>{doc.title}</h5><p>{doc.university || "University Syllabus"}{doc.batch_label ? ` · ${doc.batch_label}` : ""}</p>
        <div className="psd-program-name">{classLabel(doc.class_id)}</div>
        <div className="psd-tag">{doc.coverage === "PROGRAM" ? "Entire Program · All Semesters" : doc.coverage === "SEMESTER" ? "Semester Syllabus" : "Subject Syllabus"}</div>
        <small>{doc.original_name} · {readable(doc.file_size)}</small>
        <div className="psd-card-actions"><button onClick={() => open(doc)}>View</button><button onClick={() => open(doc, true)}>Download</button>{!student && doc.status === "draft" && <button onClick={() => publish(doc.id)}>Publish</button>}{!student && <button onClick={() => startEdit(doc)}>Edit</button>}{!student && <button className="psd-delete" onClick={() => remove(doc.id)}>Delete</button>}</div>
      </article>)}</div>
    </section>
  );
}
