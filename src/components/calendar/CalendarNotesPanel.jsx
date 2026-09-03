import React, { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import api from "../../api";

const emptyForm = {
  note_month: "",
  title: "",
  note_text: "",
  start_date: "",
  end_date: "",
  color: "#4f46e5",
};

const monthLabel = (value) => {
  if (!value) return "Month";
  const date = new Date(`${String(value).slice(0, 7)}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-IN", { month: "long", year: "numeric" });
};

export default function CalendarNotesPanel({ calendar, refreshToken = 0 }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const locked = String(calendar?.status || "").toUpperCase() === "PUBLISHED";

  const load = useCallback(async () => {
    if (!calendar?.id) return;
    setLoading(true);
    try {
      const response = await api.get(`/academic-calendars/${calendar.id}/notes`);
      setNotes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("calendar notes load error", error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [calendar?.id]);

  useEffect(() => { load(); }, [load, refreshToken]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, note_month: String(calendar?.start_date || "").slice(0, 7) });
  };

  const openEdit = (note) => {
    setEditing(note);
    setForm({
      note_month: String(note.note_month || "").slice(0, 7),
      title: note.title || "",
      note_text: note.note_text || "",
      start_date: note.start_date || "",
      end_date: note.end_date || "",
      color: note.color || "#4f46e5",
    });
  };

  const closeForm = () => { setEditing(null); setForm(emptyForm); };

  const save = async () => {
    if (!form.note_month || !form.note_text.trim()) {
      return Swal.fire("Required fields", "Display month and note text are required.", "warning");
    }
    const payload = {
      ...form,
      note_month: `${form.note_month}-01`,
      title: form.title.trim() || null,
      note_text: form.note_text.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || form.start_date || null,
    };
    try {
      if (editing) await api.put(`/academic-calendars/notes/${editing.id}`, payload);
      else await api.post(`/academic-calendars/${calendar.id}/notes`, payload);
      closeForm();
      await load();
    } catch (error) {
      Swal.fire("Could not save note", error?.response?.data?.error || "Please try again.", "error");
    }
  };

  const remove = async (note) => {
    const answer = await Swal.fire({
      title: "Delete monthly note?",
      text: note.note_text,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
    });
    if (!answer.isConfirmed) return;
    try {
      await api.delete(`/academic-calendars/notes/${note.id}`);
      await load();
    } catch (error) {
      Swal.fire("Could not delete note", error?.response?.data?.error || "Please try again.", "error");
    }
  };

  return (
    <section className="calendar-notes-panel">
      <div className="calendar-panel-heading">
        <div>
          <span className="calendar-eyebrow">MONTHLY FOOTER CONTENT</span>
          <h5><i className="bi bi-journal-text me-2" />Calendar Notes</h5>
          <p>These notes appear below the matching month in the calendar and downloadable PDF.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} disabled={locked}><i className="bi bi-plus-lg me-1" />Add Note</button>
      </div>

      {editing !== null || form.note_month ? (
        <div className="calendar-note-editor">
          <div className="row g-2">
            <div className="col-md-2"><label>Display month *</label><input type="month" className="form-control" value={form.note_month} onChange={(event) => setForm((old) => ({ ...old, note_month: event.target.value }))} /></div>
            <div className="col-md-2"><label>Title / Theme</label><input className="form-control" placeholder="Faith / Reminder" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></div>
            <div className="col-md-2"><label>From</label><input type="date" className="form-control" value={form.start_date} onChange={(event) => setForm((old) => ({ ...old, start_date: event.target.value }))} /></div>
            <div className="col-md-2"><label>To</label><input type="date" className="form-control" value={form.end_date} onChange={(event) => setForm((old) => ({ ...old, end_date: event.target.value }))} /></div>
            <div className="col-md-1"><label>Colour</label><input type="color" className="form-control form-control-color w-100" value={form.color} onChange={(event) => setForm((old) => ({ ...old, color: event.target.value }))} /></div>
            <div className="col-md-3"><label>Note *</label><textarea rows="1" className="form-control" placeholder="Monthly note shown in calendar" value={form.note_text} onChange={(event) => setForm((old) => ({ ...old, note_text: event.target.value }))} /></div>
          </div>
          <div className="d-flex gap-2 justify-content-end mt-3"><button className="btn btn-light" onClick={closeForm}>Cancel</button><button className="btn btn-primary" onClick={save}>{editing ? "Update note" : "Save note"}</button></div>
        </div>
      ) : null}

      {loading ? <div className="text-center text-muted py-4"><span className="spinner-border spinner-border-sm me-2" />Loading notes...</div> : (
        <div className="calendar-note-grid">
          {notes.map((note) => (
            <article key={note.id} className={`calendar-note-card ${note.needs_review ? "needs-review" : ""}`} style={{ "--note-color": note.color || "#4f46e5" }}>
              <div className="calendar-note-month">{monthLabel(note.note_month)}</div>
              <div className="calendar-note-title">{note.title || "Monthly Note"}</div>
              <div className="calendar-note-copy">{note.note_text}</div>
              {(note.start_date || note.end_date) && <div className="calendar-note-dates"><i className="bi bi-calendar3 me-1" />{note.start_date || ""}{note.end_date && note.end_date !== note.start_date ? ` to ${note.end_date}` : ""}</div>}
              {note.needs_review && <span className="calendar-review-flag"><i className="bi bi-exclamation-triangle me-1" />AI review</span>}
              {!locked && <div className="calendar-note-actions"><button onClick={() => openEdit(note)} title="Edit"><i className="bi bi-pencil" /></button><button onClick={() => remove(note)} title="Delete"><i className="bi bi-trash" /></button></div>}
            </article>
          ))}
          {!notes.length && <div className="calendar-empty-notes"><i className="bi bi-journal-plus" /><b>No monthly notes yet</b><span>Add notes manually or import them from a PDF/handwritten calendar.</span></div>}
        </div>
      )}
    </section>
  );
}
