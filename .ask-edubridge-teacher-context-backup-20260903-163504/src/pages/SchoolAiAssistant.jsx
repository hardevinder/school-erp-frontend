import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import schoolAiApi from "../services/schoolAiApi";
import "./SchoolAiAssistant.css";

const STARTERS = [
  "How many students are present in Class VII today?",
  "Which teachers are unavailable today?",
  "Show upcoming calendar events for the next 7 days",
  "What is the current session pending fee position?",
  "Show pending lesson plans",
  "Show exam schedules for the next 7 days",
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


function labelForMetric(key) {
  return String(key || "").replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function AggregateStrip({ aggregate }) {
  const entries = Object.entries(aggregate || {})
    .filter(([, value]) => ["string", "number"].includes(typeof value) && value !== "" && value !== null)
    .slice(0, 8);
  if (!entries.length) return null;
  return (
    <div className="sai-aggregate">
      {entries.map(([key, value]) => (
        <div key={key}><span>{labelForMetric(key)}</span><strong>{typeof value === "number" ? new Intl.NumberFormat("en-IN").format(value) : String(value)}</strong></div>
      ))}
    </div>
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
        <AggregateStrip aggregate={result.aggregate} />
        <div className="sai-guardrails">
          <span><i className="bi bi-eye" /> Read-only</span>
          <span><i className="bi bi-database-check" /> Live ERP evidence</span>
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
  const [conversationContext, setConversationContext] = useState(null);
  const inputRef = useRef(null);
  const initialPromptRef = useRef(new URLSearchParams(window.location.search).get("q") || "");

  const history = useMemo(() => messages.slice(-8).map((m) => ({ role: m.role, content: m.content })), [messages]);

  const ask = async (prompt) => {
    const text = String(prompt ?? question).trim();
    if (!text || loading) return;
    const userMessage = { role: "user", content: text };
    setMessages((m) => [...m, userMessage]);
    setQuestion(""); setError(""); setLoading(true);
    try {
      const response = await schoolAiApi.ask(text, history, conversationContext);
      const payload = response.data || {};
      if (payload.context?.student?.id) setConversationContext(payload.context);
      setMessages((m) => [...m, { role: "assistant", content: payload.answer || "I could not build a summary from the available ERP data.", payload }]);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Ask EduBridge is unavailable right now.");
    } finally { setLoading(false); setTimeout(() => inputRef.current?.focus(), 50); }
  };

  useEffect(() => {
    if (!initialPromptRef.current) return;
    const first = initialPromptRef.current;
    initialPromptRef.current = "";
    ask(first);
    // The prompt is consumed once from the Command Center command bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sai-page">
      <section className="sai-hero">
        <div>
          <div className="sai-kicker"><i className="bi bi-stars" /> ASK EDUBRIDGE · PRINCIPAL ONLY</div>
          <h1>Ask your live ERP in plain language.</h1>
          <p>Ask EduBridge resolves your question to a read-only ERP data tool first, then answers from the live result. It never substitutes an unrelated class/report when the requested data is missing.</p>
        </div>
        <button className="btn btn-light" type="button" onClick={() => navigate("/command-center")}><i className="bi bi-command me-2" />Command Center</button>
      </section>

      <div className="sai-layout">
        <main className="sai-chat-card">
          {!messages.length && (
            <div className="sai-welcome">
              <span className="sai-orb"><i className="bi bi-stars" /></span>
              <h3>What would you like to know?</h3>
              <p>Ask about attendance, students, staff, calendar, fees, lesson plans, syllabus, exams, transport, admissions, inventory, library or discipline.</p>
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
          {conversationContext?.student?.id && (
            <div className="sai-student-context">
              <span className="sai-student-context-icon"><i className="bi bi-person-check" /></span>
              <div>
                <small>Current student</small>
                <strong>{conversationContext.student.name}</strong>
                <span>{[conversationContext.student.class_name, conversationContext.student.section_name, conversationContext.student.admission_number].filter(Boolean).join(" • ")}</span>
              </div>
              <button type="button" title="Clear current student" onClick={() => setConversationContext(null)}><i className="bi bi-x-lg" /></button>
            </div>
          )}
          <form className="sai-composer" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <textarea ref={inputRef} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={conversationContext?.student?.id ? `Ask about ${conversationContext.student.name}: e.g. Give me her/his attendance record` : "Ask: How many students are present in Class VII today?"} rows={2} maxLength={1500} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
            <button type="submit" disabled={loading || !question.trim()}><i className="bi bi-arrow-up" /></button>
          </form>
        </main>

        <aside className="sai-side">
          <div className="sai-side-card">
            <span className="sai-side-icon"><i className="bi bi-shield-lock" /></span>
            <h4>Principal live-data guardrails</h4>
            <ul>
              <li>Principal role is required before any AI data tool can run.</li>
              <li>AI selects only whitelisted read-only ERP tools; no unrestricted SQL is generated.</li>
              <li>Named result rows stay in ERP rendering; the AI summary receives aggregate facts.</li>
              <li>Health details are not exposed in AI summaries.</li>
              <li>Every answer is rendered with the exact live module evidence used.</li>
            </ul>
          </div>
          <div className="sai-side-card compact">
            <h5><i className="bi bi-lightbulb me-2" />Good questions</h5>
            <button onClick={() => ask("What needs my attention today?")}>What needs my attention today?</button>
            <button onClick={() => ask("How many students are absent in Class VII today?")}>Class VII attendance</button>
            <button onClick={() => ask("What is the current session pending fee position?")}>Current fee position</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
