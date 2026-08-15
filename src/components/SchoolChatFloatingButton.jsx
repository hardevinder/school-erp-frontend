import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api";
import socket, { refreshSocketAuth } from "../socket";
import "./SchoolChatFloatingButton.css";

const CHAT_ROLES = new Set([
  "student",
  "teacher",
  "principal",
  "superadmin",
  "super_admin",
  "admin",
  "academic_coordinator",
  "coordinator",
  "hr",
  "accounts",
  "accountant",
]);

function readRoles() {
  const out = new Set();
  const add = (value) => {
    if (value == null) return;
    const v = String(value).trim().toLowerCase();
    if (v) out.add(v);
  };

  ["roles", "userRoles"].forEach((key) => {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) parsed.forEach(add);
      else add(parsed);
    } catch {
      raw.split(",").forEach(add);
    }
  });

  ["activeRole", "role"].forEach((key) => {
    add(localStorage.getItem(key) || sessionStorage.getItem(key));
  });

  return Array.from(out);
}

function hasAuthToken() {
  return Boolean(
    localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      sessionStorage.getItem("authToken")
  );
}

function shortTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return d.toLocaleString("en-IN", sameDay
    ? { hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short" });
}

export default function SchoolChatFloatingButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);

  const eligible = useMemo(() => {
    if (!hasAuthToken()) return false;
    return readRoles().some((role) => CHAT_ROLES.has(role));
  }, [location.pathname]);

  const hidden = !eligible || location.pathname.startsWith("/school-chat");
  const unread = threads.reduce((sum, t) => sum + Number(t?.unreadCount || 0), 0);
  const recent = [...threads]
    .sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0))
    .slice(0, 5);

  const loadThreads = async ({ quiet = false } = {}) => {
    if (!eligible) return;
    if (!quiet) setLoading(true);
    try {
      const response = await api.get("/api/school-chat/threads");
      setThreads(Array.isArray(response.data?.threads) ? response.data.threads : []);
    } catch (err) {
      // Keep the floating shortcut unobtrusive. The full chat page will show API errors.
      console.debug("[school-chat-floating] unable to refresh chats", err?.message || err);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    if (!eligible) return undefined;
    refreshSocketAuth();
    loadThreads();

    const refresh = () => loadThreads({ quiet: true });
    socket.on("schoolchat:message", refresh);
    socket.on("schoolchat:thread-updated", refresh);
    socket.on("schoolchat:seen", refresh);
    socket.on("schoolchat:delivered", refresh);
    socket.on("connect", refresh);

    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.clearInterval(timer);
      socket.off("schoolchat:message", refresh);
      socket.off("schoolchat:thread-updated", refresh);
      socket.off("schoolchat:seen", refresh);
      socket.off("schoolchat:delivered", refresh);
      socket.off("connect", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (hidden) return null;

  const openAll = () => navigate("/school-chat");
  const openThread = (thread) => navigate(`/school-chat?threadId=${encodeURIComponent(thread.id)}`);

  return (
    <div className="school-chat-floating" ref={panelRef}>
      {open && (
        <section className="school-chat-floating-panel" aria-label="Recent school chats">
          <header className="school-chat-floating-head">
            <div>
              <strong>School Chat</strong>
              <small>{unread ? `${unread} unread message${unread === 1 ? "" : "s"}` : "You're all caught up"}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close recent chats">×</button>
          </header>

          <div className="school-chat-floating-list">
            {loading ? (
              <div className="school-chat-floating-empty">Loading chats…</div>
            ) : recent.length ? (
              recent.map((thread) => {
                const other = thread?.otherParticipant || {};
                const count = Number(thread?.unreadCount || 0);
                const preview = thread?.lastMessage?.body || "Open conversation";
                const name = other?.name || "School Chat";
                return (
                  <button
                    type="button"
                    className={`school-chat-floating-row ${count ? "has-unread" : ""}`}
                    key={thread.id}
                    onClick={() => openThread(thread)}
                  >
                    <span className="school-chat-floating-avatar">
                      {name.slice(0, 1).toUpperCase()}
                      {thread?.online && <i aria-label="Online" />}
                    </span>
                    <span className="school-chat-floating-copy">
                      <span className="school-chat-floating-name">{name}</span>
                      <span className="school-chat-floating-preview">{preview}</span>
                    </span>
                    <span className="school-chat-floating-meta">
                      <small>{shortTime(thread?.lastMessageAt)}</small>
                      {count > 0 && <b>{count > 99 ? "99+" : count}</b>}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="school-chat-floating-empty">No conversations yet.</div>
            )}
          </div>

          <button type="button" className="school-chat-floating-open-all" onClick={openAll}>
            Open all chats
          </button>
        </section>
      )}

      <button
        type="button"
        className={`school-chat-floating-fab ${unread ? "has-unread" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={unread ? `School Chat, ${unread} unread` : "Open School Chat"}
        title="School Chat"
      >
        <i className="bi bi-chat-dots-fill" aria-hidden="true" />
        {unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
      </button>
    </div>
  );
}
