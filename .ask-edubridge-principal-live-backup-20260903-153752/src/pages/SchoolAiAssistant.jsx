import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import schoolAiApi from "../services/schoolAiApi";
import "./SchoolAiAssistant.css";

const STARTERS = [
  "Give me today’s school brief",
  "Which Class VIII students need academic or attendance follow-up this month?",
  "Which teachers have pending lesson plans?",
  "Show documents expiring in next 30 days",
  "Which parent consents are still pending?",
  "Which teachers improved most this month?",
];

function ResultRow({ item, navigate }) {
  return (
    <button type="button" className="sai-result-row" onClick={() => item.route && navigate(item.route)} disabled={!item.route}>
      <span className={`sai-dot sai-${item.tone || "neutral"}`} />
      <span className="sai-result-copy">
        <strong>{item.title}</strong>
        {item.subtitle && <small>{item.subtitle}</small>}
        {item.meta && <span>{item.meta}</span>}
      </span>
      {item.route && <i className="bi bi-arrow-up-right" />}
    </button>
  );
}

function AssistantMessage({ message, navigate, onPrompt }) {
  const payload = message.payload || {};
  const result = payload.result || {};
  return (
    <div className="sai-message assistant">
      <div className="sai-avatar"><i className="bi bi-stars" /></div>
      <div className="sai-bubble">
        <div className="sai-answer">{message.content}</div>
        <div className="sai-guardrails">
          <span><i className="bi bi-eye" /> Read-only</span>
          <span><i className="bi bi-database-check" /> ERP evidence</span>
          <span><i className="bi bi-shield-check" /> Human decision</span>
        </div>
        {(result.rows || []).length > 0 && (
          <div className="sai-results">
            <div className="sai-results-head"><strong>{result.title || "Results"}</strong><span>{result.rows.length} shown</span></div>
            {(result.rows || []).map((item, index) => <ResultRow key={`${item.title}-${index}`} item={item} navigate={navigate} />)}
          </div>
        )}
        {(result.evidence || []).length > 0 && (
          <div className="sai-evidence">
            <span className="sai-evidence-label">Based on</span>
            {(result.evidence || []).map((e, index) => (
              <button type="button" key={`${e.label}-${index}`} onClick={() => e.route && navigate(e.route)}>
                {e.label}{Number.isFinite(Number(e.count)) ? ` · ${e.count}` : ""}
              </button>
            ))}
          </div>
        )}
        {(payload.suggested_prompts || []).length > 0 && (
          <div className="sai-followups">
            {(payload.suggested_prompts || []).slice(0, 3).map((p) => <button type="button" key={p} onClick={() => onPrompt(p)}>{p}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SchoolAiAssistant() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const history = useMemo(() => messages.slice(-8).map((m) => ({ role: m.role, content: m.content })), [messages]);

  const ask = async (prompt) => {
    const text = String(prompt ?? question).trim();
    if (!text || loading) return;
    const userMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMessage]);
    setQuestion(""); setError(""); setLoading(true);
    try {
      const response = await schoolAiApi.ask(text, history);
      const payload = response.data || {};
      setMessages((m) => [...m, { role: "assistant", content: payload.answer || "I could not build a summary from the available ERP data.", payload }]);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Ask School AI is unavailable right now.");
    } finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 50); }
  };

  return (
    <div className="sai-page">
      <section className="sai-hero">
        <div>
          <div className="sai-kicker"><i className="bi bi-stars" /> ASK SCHOOL AI</div>
          <h1>Ask your ERP in plain language.</h1>
          <p>School data is fetched only through approved, role-aware ERP queries. AI can summarize and explain — it cannot change marks, attendance, teacher scores or disciplinary records.</p>
        </div>
        <button className="btn btn-light" type="button" onClick={() => navigate("/command-center")}><i className="bi bi-command me-2" />Command Center</button>
      </section>

      <div className="sai-layout">
        <main className="sai-chat-card">
          {!messages.length && (
            <div className="sai-welcome">
              <span className="sai-orb"><i className="bi bi-stars" /></span>
              <h3>What would you like to know?</h3>
              <p>Try one of these live ERP questions.</p>
              <div className="sai-starters">{STARTERS.map((p) => <button type="button" key={p} onClick={() => ask(p)}>{p}<i className="bi bi-arrow-up-right" /></button>)}</div>
            </div>
          )}

          <div className="sai-thread">
            {messages.map((m, i) => m.role === "assistant"
              ? <AssistantMessage key={i} message={m} navigate={navigate} onPrompt={ask} />
              : <div className="sai-message user" key={i}><div className="sai-bubble">{m.content}</div></div>)}
            {loading && <div className="sai-message assistant"><div className="sai-avatar"><i className="bi bi-stars" /></div><div className="sai-bubble sai-thinking"><span /><span /><span /> Reading permitted ERP data…</div></div>}
          </div>

          {error && <div className="alert alert-warning m-3 py-2">{error}</div>}
          <form className="sai-composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <textarea ref={inputRef} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask: Which teachers have pending lesson plans?" rows={2} maxLength={1500} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
            <button type="submit" disabled={loading || !question.trim()}><i className="bi bi-arrow-up" /></button>
          </form>
        </main>

        <aside className="sai-side">
          <div className="sai-side-card">
            <span className="sai-side-icon"><i className="bi bi-shield-lock" /></span>
            <h4>Built with guardrails</h4>
            <ul>
              <li>Role permissions apply before data is fetched.</li>
              <li>No unrestricted SQL is generated by AI.</li>
              <li>Named result rows stay in ERP rendering; the AI summary receives aggregate facts.</li>
              <li>Health details are not exposed in AI summaries.</li>
              <li>Every answer links back to source modules.</li>
            </ul>
          </div>
          <div className="sai-side-card compact">
            <h5><i className="bi bi-lightbulb me-2" />Good questions</h5>
            <button onClick={() => ask("What needs my attention today?")}>What needs my attention today?</button>
            <button onClick={() => ask("Show pending assessment reviews")}>Pending assessment reviews</button>
            <button onClick={() => ask("Show Class VIII readiness concerns this month")}>Class VIII readiness concerns</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
