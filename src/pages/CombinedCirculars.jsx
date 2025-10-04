import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const audienceLabels = {
  both: "All",
  teacher: "Teachers",
  student: "Students",
};

const Circulars = () => {
  const [circulars, setCirculars] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingCircular, setEditingCircular] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", audience: "both" });
  const [file, setFile] = useState(null);
  const [removeFile, setRemoveFile] = useState(false);
  const fileInputRef = useRef(null);
  const textRef = useRef(null);

  const fetchCirculars = async () => {
    try {
      const { data } = await api.get("/circulars");
      setCirculars((data?.circulars || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (err) {
      console.error("Error fetching circulars:", err);
      Swal.fire("Error", "Failed to load circulars", "error");
    }
  };
  useEffect(() => { fetchCirculars(); }, []);

  const openAdd = () => {
    setEditingCircular(null);
    setForm({ title: "", content: "", audience: "both" });
    setFile(null);
    setRemoveFile(false);
    setShowModal(true);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const openEdit = (c) => {
    setEditingCircular(c);
    setForm({
      title: c.title || "",
      content: c.description || c.content || "",
      audience: c.audience || "both",
    });
    setFile(null);
    setRemoveFile(false);
    setShowModal(true);
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const onChooseFile = () => fileInputRef.current?.click();
  const onFileChange = (e) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0]);
      setRemoveFile(false);
    }
  };

  const onSave = async () => {
    if (!form.title.trim()) {
      return Swal.fire("Title required", "Please add a title.", "warning");
    }
    setSaving(true);
    const fd = new FormData();
    fd.append("title", form.title.trim());
    // append both for compatibility with differing backends
    fd.append("description", form.content || "");
    fd.append("content", form.content || "");
    fd.append("audience", form.audience);
    if (file) fd.append("file", file);
    if (editingCircular && removeFile) fd.append("removeFile", "true");

    try {
      if (editingCircular) {
        await api.put(`/circulars/${editingCircular.id}`, fd);
        Swal.fire("Updated!", "Circular updated successfully.", "success");
      } else {
        await api.post("/circulars", fd);
        Swal.fire("Added!", "Circular created successfully.", "success");
      }
      setShowModal(false);
      setEditingCircular(null);
      setForm({ title: "", content: "", audience: "both" });
      setFile(null);
      setRemoveFile(false);
      fetchCirculars();
    } catch (err) {
      console.error("Error saving circular:", err);
      Swal.fire("Error", "Failed to save circular", "error");
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
      confirmButtonColor: "#dc2626",
    });
    if (!res.isConfirmed) return;
    try {
      await api.delete(`/circulars/${id}`);
      Swal.fire("Deleted", "Circular removed.", "success");
      fetchCirculars();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Failed to delete circular", "error");
    }
  };

  const viewFile = (url) => window.open(url, "_blank", "noopener,noreferrer");

  // keyboard: Ctrl/Cmd + Enter to save
  useEffect(() => {
    const handler = (e) => {
      if (!showModal) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") onSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showModal, form, editingCircular, file, removeFile]);

  return (
    <div className="container mt-3">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h1 className="h4 m-0">Circular Management</h1>
        <button className="btn btn-success" onClick={openAdd}>
          <i className="bi bi-plus-lg me-1" />
          Add Circular
        </button>
      </div>

      <div className="table-responsive shadow-sm rounded-3">
        <table className="table table-striped align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th style={{width: 56}}>#</th>
              <th>Title</th>
              <th className="w-50">Content</th>
              <th>Audience</th>
              <th>File</th>
              <th style={{width: 160}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {circulars.map((c, i) => (
              <tr key={c.id}>
                <td className="text-muted">{i + 1}</td>
                <td className="fw-semibold">{c.title}</td>
                <td className="text-muted small">
                  <span className="text-truncate-2 d-inline-block" style={{maxWidth: 520, whiteSpace: "pre-wrap"}}>
                    {c.description || c.content || "—"}
                  </span>
                </td>
                <td>
                  <span className="badge rounded-pill text-bg-primary">
                    {audienceLabels[c.audience] || c.audience}
                  </span>
                </td>
                <td>
                  {c.fileUrl ? (
                    <button className="btn btn-outline-info btn-sm" onClick={() => viewFile(c.fileUrl)}>
                      View
                    </button>
                  ) : (
                    <span className="text-muted small">No File</span>
                  )}
                </td>
                <td className="text-nowrap">
                  <button className="btn btn-primary btn-sm me-2" onClick={() => openEdit(c)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {circulars.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center text-muted py-4">No circulars yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Wider Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,.45)" }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-fullscreen-sm-down">
            <div className="modal-content rounded-4">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingCircular ? "Edit Circular" : "Add Circular"}
                </h5>
                <button className="btn-close" onClick={() => setShowModal(false)} />
              </div>

              <div className="modal-body">
                <div className="row g-3">
                  {/* LEFT: form */}
                  <div className="col-12 col-lg-7">
                    <label className="form-label fw-semibold">Title</label>
                    <input
                      className="form-control mb-2"
                      placeholder="e.g., PTM on Friday"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      maxLength={120}
                    />
                    <div className="form-text text-end">{form.title.length}/120</div>

                    <label className="form-label fw-semibold mt-3">Content / Description</label>
                    <textarea
                      ref={textRef}
                      className="form-control"
                      rows={6}
                      placeholder="Write details, timing, instructions…"
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      style={{ resize: "vertical" }}
                    />

                    <label className="form-label fw-semibold mt-3">Audience</label>
                    <div className="d-flex flex-wrap gap-2">
                      {["both", "teacher", "student"].map((a) => (
                        <button
                          key={a}
                          type="button"
                          className={`btn btn-sm ${form.audience === a ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => setForm({ ...form, audience: a })}
                        >
                          {audienceLabels[a]}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3">
                      <label className="form-label fw-semibold">Attachment (optional)</label>
                      <div className="d-flex align-items-center flex-wrap gap-2">
                        <button className="btn btn-outline-secondary btn-sm" onClick={onChooseFile}>
                          {file || (editingCircular?.fileUrl && !removeFile) ? "Replace File" : "Upload File"}
                        </button>
                        {file && <span className="small text-muted">{file.name}</span>}
                        {!file && editingCircular?.fileUrl && !removeFile && (
                          <>
                            <button className="btn btn-outline-info btn-sm" onClick={() => viewFile(editingCircular.fileUrl)}>View current</button>
                            <button className="btn btn-outline-danger btn-sm" onClick={() => setRemoveFile(true)}>Remove</button>
                          </>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" hidden onChange={onFileChange} />
                      </div>
                      {removeFile && <div className="small text-danger mt-1">File will be removed after saving.</div>}
                    </div>
                  </div>

                  {/* RIGHT: live preview */}
                  <div className="col-12 col-lg-5">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-header bg-light fw-semibold">Preview</div>
                      <div className="card-body">
                        <h6 className="mb-1">{form.title || "Untitled"}</h6>
                        <div className="small text-muted mb-2">
                          Audience: {audienceLabels[form.audience] || form.audience}
                        </div>
                        <p className="mb-3" style={{ whiteSpace: "pre-wrap" }}>
                          {form.content || <em className="text-muted">No content</em>}
                        </p>

                        {(file || (editingCircular?.fileUrl && !removeFile)) ? (
                          <>
                            <div className="fw-semibold mb-1">Attachment</div>
                            {file ? (
                              <div className="small text-muted">{file.name}</div>
                            ) : (
                              <>
                                {/* show an inline preview for images/pdf */}
                                {/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|$)/i.test(editingCircular?.fileUrl || "") ? (
                                  <img src={editingCircular.fileUrl} alt="Preview" className="img-fluid rounded" />
                                ) : /\.(pdf)(\?|$)/i.test(editingCircular?.fileUrl || "") ? (
                                  <iframe
                                    title="PDF preview"
                                    src={`${editingCircular.fileUrl}#view=FitH`}
                                    style={{ width: "100%", height: 320, border: 0, borderRadius: 8, background: "#f8fafc" }}
                                  />
                                ) : (
                                  <div className="text-muted small">Preview not available</div>
                                )}
                              </>
                            )}
                          </>
                        ) : (
                          <div className="text-muted small">No attachment</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer d-flex justify-content-between">
                <div className="small text-muted">Tip: Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Enter</kbd> to save</div>
                <div>
                  <button className="btn btn-secondary me-2" onClick={() => setShowModal(false)} disabled={saving}>
                    Close
                  </button>
                  <button className="btn btn-primary" onClick={onSave} disabled={saving || !form.title.trim()}>
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local styles */}
      <style>{`
        .text-truncate-2 {
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        /* widen the xl modal a bit */
        @media (min-width: 1200px){
          .modal-xl { --bs-modal-width: 980px; }
        }
      `}</style>
    </div>
  );
};

export default Circulars;
