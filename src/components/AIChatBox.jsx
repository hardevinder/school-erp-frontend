import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./AIChatBox.css";

const AI_CHAT_ENDPOINT = "/api/ai/chat";

const safeId = () => {
  try {
    return crypto?.randomUUID?.() || `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const getAuthHeader = () => {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("jwt") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ----------------------- VOICE HELPERS -----------------------
const getSpeechRecognition = () => {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const speakText = (text, lang = "en-IN") => {
  try {
    if (!("speechSynthesis" in window)) return false;
    const u = new SpeechSynthesisUtterance(String(text || ""));
    u.lang = lang;
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
};

const stopSpeak = () => {
  try {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  } catch {}
};

const AIChatBox = () => {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_chat_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // ✅ Keep context only for UI badge (NOT appended to message)
  const [lastStudentCtx, setLastStudentCtx] = useState(() => {
    try {
      const saved = localStorage.getItem("ai_chat_last_student");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // voice settings
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try {
      return localStorage.getItem("ai_chat_voice_enabled") === "1";
    } catch {
      return false;
    }
  });
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      return localStorage.getItem("ai_chat_auto_speak") === "1";
    } catch {
      return false;
    }
  });
  const [listening, setListening] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const recogRef = useRef(null);

  // persist chat
  useEffect(() => {
    try {
      localStorage.setItem("ai_chat_history", JSON.stringify(messages.slice(-120)));
    } catch {}
  }, [messages]);

  // persist last context
  useEffect(() => {
    try {
      if (lastStudentCtx) localStorage.setItem("ai_chat_last_student", JSON.stringify(lastStudentCtx));
      else localStorage.removeItem("ai_chat_last_student");
    } catch {}
  }, [lastStudentCtx]);

  useEffect(() => {
    try {
      localStorage.setItem("ai_chat_voice_enabled", voiceEnabled ? "1" : "0");
    } catch {}
  }, [voiceEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem("ai_chat_auto_speak", autoSpeak ? "1" : "0");
    } catch {}
  }, [autoSpeak]);

  // auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  // ----------------------- VOICE SETUP -----------------------
  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-IN";

    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }

      const combined = (finalText || interim || "").trim();
      if (combined) setInput(combined);
    };

    rec.onerror = (e) => {
      setListening(false);

      const code = e?.error || "";
      let msg = "Mic not available or permission denied.";
      if (code === "not-allowed") msg = "Mic permission denied. Please allow microphone in browser site settings.";
      if (code === "audio-capture") msg = "No microphone found or it is being used by another app/tab.";
      if (code === "network") msg = "Speech recognition network error (common on Chromium builds).";
      if (code === "service-not-allowed") msg = "Speech recognition service not allowed in this browser.";

      Swal.fire("Voice", msg, "warning");
    };

    rec.onend = () => {
      setListening(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    };

    recogRef.current = rec;

    return () => {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {}
    };
  }, []);

  const startVoice = async () => {
    if (!voiceEnabled) {
      Swal.fire("Voice", "Enable voice first (Voice ON).", "info");
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR || !recogRef.current) {
      Swal.fire(
        "Voice not supported",
        "SpeechRecognition API is not supported in this browser. Use Google Chrome (not Chromium) for mic input.",
        "info"
      );
      return;
    }

    // optional: prompt permission early (helps some setups)
    try {
      if (navigator?.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (e) {
      Swal.fire("Mic Permission", "Please allow microphone permission in browser settings.", "warning");
      return;
    }

    try {
      setListening(true);
      recogRef.current.start();
    } catch {
      setListening(false);
    }
  };

  const stopVoice = () => {
    try {
      recogRef.current?.stop();
    } catch {}
    setListening(false);
  };

  // ----------------------- SEND MESSAGE -----------------------
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { id: safeId(), role: "user", text, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const headers = { "Content-Type": "application/json", ...getAuthHeader() };

      // ✅ IMPORTANT: we do NOT append context into message anymore
      const payload = {
        message: text,
        // optional: you can still send context separately if you want later
        // context: lastStudentCtx ? { admission_number: lastStudentCtx.admission_number } : null,
      };

      const { data } = await api.post(AI_CHAT_ENDPOINT, payload, { headers });

      const replyText = data?.reply || "No reply received.";
      const botMsg = {
        id: safeId(),
        role: "assistant",
        text: replyText,
        meta: data?.data || null,
        ts: Date.now(),
      };

      // ✅ Update context only if backend returns students
      const st = data?.data?.students?.[0];
      if (st && (st.name || st.admission_number)) {
        setLastStudentCtx({
          id: st.id,
          name: st.name,
          admission_number: st.admission_number,
          class_name: st.class_name,
          section_name: st.section_name,
        });
      }

      setMessages((prev) => [...prev, botMsg]);

      if (autoSpeak && voiceEnabled) {
        speakText(replyText);
      }
    } catch (err) {
      console.error("AI chat error:", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to call AI API";

      Swal.fire("AI Error", msg, "error");
      setMessages((prev) => [...prev, { id: safeId(), role: "assistant", text: `❌ ${msg}`, ts: Date.now() }]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ----------------------- CLEAR -----------------------
  const clearChat = async () => {
    const res = await Swal.fire({
      title: "Clear chat?",
      text: "This will remove chat history on this device.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Clear",
      cancelButtonText: "Cancel",
    });
    if (!res.isConfirmed) return;

    setMessages([]);
    setLastStudentCtx(null);
    stopSpeak();
    try {
      localStorage.removeItem("ai_chat_history");
      localStorage.removeItem("ai_chat_last_student");
    } catch {}
  };

  const clearContextOnly = async () => {
    const res = await Swal.fire({
      title: "Clear context?",
      text: "Only the selected student context badge will be removed.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Clear Context",
      cancelButtonText: "Cancel",
    });
    if (!res.isConfirmed) return;
    setLastStudentCtx(null);
  };

  const renderTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="ai-page">
      <div className="ai-shell">
        {/* Header */}
        <div className="ai-header">
          <div className="ai-head-left">
            <div className="ai-title">AI Assistant</div>
            <div className="ai-subtitle">
              Students • Fees • Transport • Results • Attendance
            </div>

            {lastStudentCtx?.admission_number && (
              <div className="ai-chip-row">
                <span className="ai-chip">
                  Context: <b>{lastStudentCtx.name || "Student"}</b> ({lastStudentCtx.admission_number})
                </span>
                <button className="ai-link" type="button" onClick={clearContextOnly}>
                  Clear
                </button>
              </div>
            )}
          </div>

          <div className="ai-head-right">
            <button
              className={`ai-btn ${voiceEnabled ? "on" : ""}`}
              type="button"
              onClick={() => setVoiceEnabled((p) => !p)}
              title="Enable / Disable Voice"
            >
              <i className="bi bi-mic"></i>
              <span>{voiceEnabled ? "Voice ON" : "Voice OFF"}</span>
            </button>

            <button
              className={`ai-btn ${autoSpeak ? "on" : ""}`}
              type="button"
              onClick={() => setAutoSpeak((p) => !p)}
              title="Auto speak AI replies"
              disabled={!voiceEnabled}
            >
              <i className="bi bi-volume-up"></i>
              <span>Auto Speak</span>
            </button>

            <button className="ai-btn danger" type="button" onClick={clearChat} title="Clear Chat">
              <i className="bi bi-trash3"></i>
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="ai-body" ref={listRef}>
          {messages.length === 0 ? (
            <div className="ai-empty">
              <div className="ai-empty-card">
                <div className="ai-empty-title">Start chatting</div>
                <div className="ai-empty-sub">
                  Try:
                  <div className="ai-examples">
                    <span className="ai-example">“count of class 10th”</span>
                    <span className="ai-example">“TPIS-875 mother phone”</span>
                    <span className="ai-example">“fee due of TPIS-200”</span>
                    <span className="ai-example">“result of TPIS-300”</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`ai-row ${m.role === "user" ? "me" : "bot"}`}>
                <div className="ai-avatar">{m.role === "user" ? "You" : "AI"}</div>

                <div className={`ai-bubble ${m.role === "user" ? "me" : "bot"}`}>
                  <div className="ai-text">{m.text}</div>

                  <div className="ai-meta">
                    <span className="ai-time">{renderTime(m.ts)}</span>

                    {m.role === "assistant" && voiceEnabled && (
                      <span className="ai-mini-actions">
                        <button className="ai-mini" type="button" title="Speak" onClick={() => speakText(m.text)}>
                          <i className="bi bi-play-fill"></i>
                        </button>
                        <button className="ai-mini" type="button" title="Stop" onClick={stopSpeak}>
                          <i className="bi bi-stop-fill"></i>
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="ai-row bot">
              <div className="ai-avatar">AI</div>
              <div className="ai-bubble bot">
                <div className="ai-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ai-footer">
          <div className="ai-composer">
            <button
              className={`ai-mic ${listening ? "listening" : ""}`}
              type="button"
              onClick={listening ? stopVoice : startVoice}
              disabled={!voiceEnabled}
              title={listening ? "Stop voice" : "Voice input"}
            >
              <i className={`bi ${listening ? "bi-mic-fill" : "bi-mic"}`}></i>
            </button>

            <textarea
              ref={inputRef}
              className="ai-input"
              placeholder="Type your question... (Enter = send, Shift+Enter = new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
            />

            <button className="ai-send" type="button" onClick={sendMessage} disabled={!canSend} title="Send">
              <i className="bi bi-send-fill"></i>
            </button>
          </div>

          <div className="ai-footer-hint">
            {voiceEnabled ? (
              <span>
                Mic works best in <b>Google Chrome</b>. If you use Chromium and mic fails, that’s expected.
              </span>
            ) : (
              <span>Enable voice if you want mic input / auto speak.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatBox;
