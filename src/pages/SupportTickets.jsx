import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import socket from '../socket';
import './SupportTickets.css';

const CATEGORIES = [
  ['app_technical', 'ERP / App Technical Problem'],
  ['login', 'Login / Account'],
  ['fee_payment', 'Fee / Payment Technical Problem'],
  ['examination', 'Examination / Marks'],
  ['attendance', 'Attendance'],
  ['academic', 'Homework / Academic'],
  ['transport', 'Transport'],
  ['reports', 'Reports'],
  ['other', 'Other'],
];
const pretty = (v) => String(v || '').replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const statusClass = (v) => `support-pill support-status-${v || 'open'}`;
const priorityClass = (v) => `support-pill support-priority-${v || 'medium'}`;

function activeRole() {
  return String(localStorage.getItem('activeRole') || localStorage.getItem('userRole') || localStorage.getItem('role') || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
}

export default function SupportTickets() {
  const role = activeRole();
  const canChoosePriority = !['student', 'parent'].includes(role);
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(
    () => new URLSearchParams(window.location.search).get('new') === '1'
  );
  const [filters, setFilters] = useState({ status: '', q: '' });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const [form, setForm] = useState({ subject: '', category: 'app_technical', module: '', priority: 'medium', description: '', attachments: [] });
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = Object.fromEntries(Object.entries(filtersRef.current).filter(([, v]) => v));
      const { data } = await api.get('/api/support/tickets', { params });
      setTickets(data.tickets || []);
    } catch (e) { setError(e?.response?.data?.message || 'Unable to load support tickets.'); }
    finally { setLoading(false); }
  }, []);

  const openTicket = useCallback(async (ticketNo) => {
    setError('');
    try { setSelected((await api.get(`/api/support/tickets/${ticketNo}`)).data.ticket); }
    catch (e) { setError(e?.response?.data?.message || 'Unable to load ticket.'); }
  }, []);

  useEffect(() => { load(); }, [filters.status, load]);
  useEffect(() => {
    const ticketNo = new URLSearchParams(window.location.search).get('ticket');
    if (ticketNo) openTicket(ticketNo);
  }, [openTicket]);
  useEffect(() => {
    const refresh = (event) => {
      load();
      if (selected?.ticket_no && (!event?.ticketNo || event.ticketNo === selected.ticket_no)) openTicket(selected.ticket_no);
    };
    socket.on('support:updated', refresh);
    return () => socket.off('support:updated', refresh);
  }, [load, openTicket, selected?.ticket_no]);

  const submitNew = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('subject', form.subject.trim()); fd.append('category', form.category); fd.append('module', form.module.trim());
      fd.append('description', form.description.trim()); fd.append('appType', 'web'); fd.append('pageUrl', window.location.href);
      if (canChoosePriority) fd.append('priority', form.priority);
      Array.from(form.attachments || []).forEach((f) => fd.append('attachments', f));
      const { data } = await api.post('/api/support/tickets', fd);
      setForm({ subject: '', category: 'app_technical', module: '', priority: 'medium', description: '', attachments: [] });
      setShowNew(false); await load(); setSelected(data.ticket || null);
    } catch (e) { setError(e?.response?.data?.message || 'Unable to create ticket.'); }
    finally { setBusy(false); }
  };

  const sendReply = async (e) => {
    e.preventDefault(); if (!selected || (!reply.trim() && !replyFiles.length)) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData(); fd.append('message', reply.trim());
      Array.from(replyFiles).forEach((f) => fd.append('attachments', f));
      const { data } = await api.post(`/api/support/tickets/${selected.ticket_no}/messages`, fd);
      setSelected(data.ticket); setReply(''); setReplyFiles([]); await load();
    } catch (e) { setError(e?.response?.data?.message || 'Unable to send reply.'); }
    finally { setBusy(false); }
  };

  const reopen = async () => {
    if (!selected) return; setBusy(true); setError('');
    try { setSelected((await api.post(`/api/support/tickets/${selected.ticket_no}/reopen`, { reason: 'Issue still requires attention.' })).data.ticket); await load(); }
    catch (e) { setError(e?.response?.data?.message || 'Unable to reopen ticket.'); }
    finally { setBusy(false); }
  };

  const messages = useMemo(() => selected?.messages || [], [selected]);

  return (
    <div className="support-page container-fluid py-3">
      <div className="support-head">
        <div><h2>Help & Support</h2><p>Raise an ERP issue and track Edubridge resolution status here.</p></div>
        <button className="btn btn-primary" onClick={() => setShowNew((v) => !v)}><i className="bi bi-plus-circle me-2" />Raise Ticket</button>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      {showNew && <form className="support-card support-new" onSubmit={submitNew}>
        <div className="support-card-title"><div><strong>New Support Ticket</strong><span>Describe the issue clearly. Screenshots help us resolve it faster.</span></div><button type="button" className="btn-close" onClick={() => setShowNew(false)} /></div>
        <div className="row g-3">
          <div className="col-md-8"><label className="form-label">Subject</label><input className="form-control" maxLength="240" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Example: Marks entry not saving for Class 8-A" required /></div>
          <div className="col-md-4"><label className="form-label">Category</label><select className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map(([v,l]) => <option value={v} key={v}>{l}</option>)}</select></div>
          <div className="col-md-6"><label className="form-label">Module</label><input className="form-control" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} placeholder="Examination, Fees, Attendance…" /></div>
          {canChoosePriority && <div className="col-md-6"><label className="form-label">Priority</label><select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>}
          <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What were you doing, what happened, and what did you expect?" required /></div>
          <div className="col-12"><label className="form-label">Screenshots / Files <span className="text-muted">(up to 5, 10 MB each)</span></label><input className="form-control" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,.docx" onChange={(e) => setForm({ ...form, attachments: e.target.files })} /></div>
        </div>
        <div className="mt-3 d-flex justify-content-end"><button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit Ticket'}</button></div>
      </form>}

      <div className="support-grid">
        <section className="support-card support-list">
          <div className="support-toolbar"><input className="form-control" placeholder="Search ticket or subject" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} /><select className="form-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All Statuses</option>{['open','assigned','in_progress','waiting_for_user','resolved','closed','reopened'].map((s) => <option value={s} key={s}>{pretty(s)}</option>)}</select><button className="btn btn-outline-secondary" onClick={load}>Refresh</button></div>
          <div className="support-ticket-list">
            {tickets.map((t) => <button className={`support-ticket-row ${selected?.ticket_no === t.ticket_no ? 'active' : ''}`} key={t.id} onClick={() => openTicket(t.ticket_no)}>
              <div className="support-ticket-top"><strong>{t.ticket_no}</strong><span className={priorityClass(t.priority)}>{pretty(t.priority)}</span></div>
              <div className="support-ticket-subject">{t.subject}</div>
              <div className="support-ticket-meta"><span className={statusClass(t.status)}>{pretty(t.status)}</span><span>{t.assignee?.name ? `Assigned: ${t.assignee.name}` : 'Awaiting assignment'}</span><time>{new Date(t.last_activity_at || t.updated_at).toLocaleString()}</time></div>
            </button>)}
            {!loading && tickets.length === 0 && <div className="support-empty">No tickets found.</div>}
            {loading && <div className="support-empty">Loading tickets…</div>}
          </div>
        </section>

        <section className="support-card support-detail">
          {!selected ? <div className="support-empty support-select-empty"><i className="bi bi-ticket-perforated" /><strong>Select a ticket</strong><span>Open a ticket from the list to view replies and status history.</span></div> : <>
            <div className="support-detail-head"><div><div className="support-detail-no">{selected.ticket_no}</div><h3>{selected.subject}</h3><div className="d-flex gap-2 flex-wrap"><span className={priorityClass(selected.priority)}>{pretty(selected.priority)}</span><span className={statusClass(selected.status)}>{pretty(selected.status)}</span><span className="support-pill">{pretty(selected.category)}</span></div></div>{['resolved','closed'].includes(selected.status) && <button className="btn btn-outline-primary btn-sm" onClick={reopen} disabled={busy}>Reopen</button>}</div>
            <div className="support-message-list">
              {messages.map((m) => <div className={`support-message ${m.sender_type === 'support_user' ? 'from-support' : 'from-school'}`} key={m.id}><div className="support-message-head"><strong>{m.sender_name || pretty(m.sender_type)}</strong><time>{new Date(m.created_at).toLocaleString()}</time></div><p>{m.message}</p>{m.attachments?.length > 0 && <div className="support-attachments">{m.attachments.map((a, i) => <a href={a.url} target="_blank" rel="noreferrer" key={i}><i className="bi bi-paperclip" />{a.name}</a>)}</div>}</div>)}
            </div>
            <form className="support-reply" onSubmit={sendReply}><textarea className="form-control" rows="3" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to Edubridge Support…" /><div className="support-reply-actions"><input className="form-control" type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,.docx" onChange={(e) => setReplyFiles(Array.from(e.target.files || []))} /><button className="btn btn-primary" disabled={busy || (!reply.trim() && !replyFiles.length)}>Send</button></div></form>
          </>}
        </section>
      </div>
    </div>
  );
}
