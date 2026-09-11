import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import api from '../../api';
import { statusCounts, upcomingClasses } from './dashboardModel';
import './DashboardInsights.css';

const colors = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#e11d48', '#64748b'];

export function WorkspaceTabs({ value, onChange }) {
  return <div className="dashboard-workspaces" role="group" aria-label="ERP and LMS workspace">
    {['All', 'ERP', 'LMS'].map((item) => <button type="button" key={item} aria-pressed={value === item}
      onClick={() => onChange(item)} className={value === item ? 'selected' : ''}>{item === 'All' ? 'All modules' : item}</button>)}
  </div>;
}

export function SummaryChart({ title, subtitle, data, loading, error }) {
  const hasData = data.some((row) => row.value > 0);
  return <section className="dashboard-insight-card">
    <h3>{title}</h3><p className="dashboard-insight-caption">{subtitle}</p>
    {loading ? <p role="status">Loading summary…</p> : error ? <p role="status">Summary unavailable. Please retry.</p> : !hasData ? <p className="dashboard-insight-empty">No records to chart yet.</p> : <>
      <div style={{ width: '100%', height: 190 }} aria-hidden="true">
        <ResponsiveContainer><BarChart data={data} margin={{ top: 12, right: 8, left: -24, bottom: 8 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip /><Bar dataKey="value" name="Records" radius={[6, 6, 0, 0]}>{data.map((row, i) => <Cell key={row.name} fill={colors[i % colors.length]} />)}</Bar>
        </BarChart></ResponsiveContainer>
      </div>
      <ul className="dashboard-chart-legend">{data.map((row, i) => <li key={row.name}><span style={{ background: colors[i % colors.length] }} />{row.name}: <strong>{row.value}</strong></li>)}</ul>
    </>}
  </section>;
}

export default function DashboardInsights({ role, admission }) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({});
  const teacher = role === 'teacher';
  useEffect(() => {
    const controller = new AbortController();
    setState({});
    const sources = teacher ? [
      ['messages', '/messages/me', { page: 1, limit: 5 }],
      ['unread', '/messages/me', { page: 1, limit: 1, unreadOnly: true }],
      ['assessments', '/api/assessments', {}],
      ['classes', '/api/online-classes', {}],
    ] : [['messages', '/messages/me', { page: 1, limit: 5, admissionNumber: admission }],
      ['unread', '/messages/me', { page: 1, limit: 1, unreadOnly: true, admissionNumber: admission }]];
    sources.forEach(async ([key, url, params]) => {
      try {
        const { data } = await api.get(url, { params, signal: controller.signal });
        const rows = data?.data ?? data;
        if (!Array.isArray(rows)) throw new Error('Unexpected summary response');
        if (!controller.signal.aborted) setState((previous) => ({ ...previous, [key]: { rows, total: data?.pagination?.total ?? rows.length } }));
      } catch (error) {
        if (!controller.signal.aborted) setState((previous) => ({ ...previous, [key]: { error: true } }));
      }
    });
    return () => controller.abort();
  }, [teacher, admission, refresh]);

  const upcoming = upcomingClasses(state.classes?.rows || []);
  return <div className="dashboard-insights">
    <div className="dashboard-insight-heading"><div><h2>At a glance</h2><p>ERP · Communication {teacher && ' / LMS · Teaching and learning'}</p></div>
      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setRefresh((v) => v + 1)}>Refresh summaries</button>
    </div>
    <div className="dashboard-insight-grid">
      <section className="dashboard-insight-card">
        <h3>ERP · Messages</h3>
        <p className="dashboard-insight-caption">{!state.unread ? 'Loading unread count…' : state.unread.error ? 'Unread count unavailable' : `${state.unread.total} unread conversations`}</p>
        {!state.messages ? <p role="status">Loading messages…</p> : state.messages.error ? <p role="status">Messages unavailable. Refresh to retry.</p> : !state.messages.rows.length ? <p>No messages yet.</p> : <ul className="dashboard-preview-list">{state.messages.rows.slice(0, 3).map((row) => <li key={row.id}>
          <Link to="/messages">{row.thread?.subject || 'Message'}</Link><p>{row.thread?.messages?.[0]?.body || 'Open conversation to read more.'}</p>
        </li>)}</ul>}
        <Link to="/messages">Open messages →</Link>
      </section>
      {teacher && <>
        <SummaryChart title="LMS · Assessment overview" subtitle="Your visible assessments, grouped by status" data={statusCounts(state.assessments?.rows || [])} loading={!state.assessments} error={state.assessments?.error} />
        <section className="dashboard-insight-card"><h3>LMS · Upcoming online classes</h3><p className="dashboard-insight-caption">Scheduled and ongoing sessions</p>
          {!state.classes ? <p role="status">Loading classes…</p> : state.classes.error ? <p role="status">Classes unavailable. Refresh to retry.</p> : !upcoming.length ? <p>No upcoming online classes.</p> : <ul className="dashboard-preview-list">{upcoming.slice(0, 3).map((row) => <li key={row.id}><Link to="/online-classes">{row.title}</Link><p>{new Date(row.start_time).toLocaleString()}</p></li>)}</ul>}
          <Link to="/online-classes">Open online classes →</Link>
        </section>
      </>}
    </div>
  </div>;
}
