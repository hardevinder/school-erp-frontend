// File: src/components/chat/ChatContainer.jsx
// Polling-based chat container with realtime-feel: pushes new messages into ChatApp without refresh.

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ChatApp from "../ChatApp";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ENV_API = process.env.REACT_APP_API_URL; // CRA style
const BASE_API = ENV_API && ENV_API.trim().length > 0 ? ENV_API : ""; // empty => same origin/proxy

// Polling intervals (ms)
const POLL_MS_VISIBLE = 3500; // when tab is visible
const POLL_MS_HIDDEN = 12000; // when tab is hidden
const CONTACTS_REFRESH_EVERY_N_TICKS = 2; // refresh contacts every N ticks (when visible)

export default function ChatContainer() {
  const [showChat, setShowChat] = useState(false);
  const [chatSize, setChatSize] = useState("min"); // 'min' | 'max'
  const [activeChatName, setActiveChatName] = useState("");
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);

  // contacts = real chat contacts; suggestions = active users (to start new chats)
  const [contacts, setContacts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  // Which thread is open
  const [activeContactId, setActiveContactId] = useState(null);

  // Scroll/UI nudges
  const [scrollKey, setScrollKey] = useState(0);
  const bumpScroll = () => setScrollKey((n) => n + 1);

  // 🔥 Push new messages into ChatApp immediately
  const [incoming, setIncoming] = useState(null); // { contactId, message, ts }

  // Track last seen state for the active thread
  const lastThreadStatsRef = useRef({
    count: 0,
    latestAt: 0,
    idSet: new Set(), // dedupe by message id/tempId across polls
  });

  // For diffing/global notifications
  const prevUnreadRef = useRef(0);
  const prevContactsRef = useRef([]);
  const mountedRef = useRef(false);

  // Keep a pointer to the most recent contact that has unread > 0
  const latestUnreadRef = useRef(null);
  useEffect(() => {
    latestUnreadRef.current = pickLatestUnreadContact(contacts);
  }, [contacts]);

  // ---- Auth header helper (JWT) ----
  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken") ||
    "";

  const authHeaders = () => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  // ---- Safe fetch helpers (timeout + better errors) ----
  const fetchWithTimeout = async (input, init = {}, ms = 12000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(input, { ...init, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  };

  const apiGet = useCallback(async (path) => {
    const res = await fetchWithTimeout(`${BASE_API}${path}`, {
      credentials: "omit",
      mode: "cors",
      headers: { Accept: "application/json", ...authHeaders() },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }, []);

  const apiPost = useCallback(async (path, body) => {
    const res = await fetchWithTimeout(`${BASE_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "omit",
      mode: "cors",
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }, []);

  const userRoles = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("roles")) || [];
    } catch {
      const single = localStorage.getItem("userRole");
      return single ? [single] : [];
    }
  }, []);

  const currentUserId =
    localStorage.getItem("userId") ||
    localStorage.getItem("studentId") ||
    localStorage.getItem("teacherId") ||
    "me";

  // ---- Contacts fetch (NO pagination when fillUsers=1) ----
  const fetchAllContacts = useCallback(
    async ({ limit = 5000 } = {}) => {
      const res = await apiGet(`/chat/contacts?fillUsers=1&limit=${limit}`);
      const arr = Array.isArray(res) ? res : res.items || res.data || res.results || [];
      return arr || [];
    },
    [apiGet]
  );

  // Load contacts initially; if none, show user suggestions
  useEffect(() => {
    if (!userRoles.length) return;
    let mounted = true;

    (async () => {
      try {
        const allContacts = await fetchAllContacts(); // single big request (no offset)
        if (!mounted) return;

        const sorted = sortContacts(allContacts);
        setContacts(sorted);
        prevContactsRef.current = sorted;

        // initialize the floating badge from contacts snapshot (normalized)
        setGlobalUnreadCount(totalUnread(sorted));

        if (sorted.length === 0) {
          try {
            const sug = await apiGet(`/chat/users?limit=5000`);
            if (mounted) setSuggestions(sug || []);
          } catch (err) {
            console.warn(`/chat/users failed`, err);
            if (mounted) setSuggestions([]);
          }
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.warn(`/chat/contacts failed — using demo contacts`, e);
        const seeded = seedContacts();
        setContacts(seeded);
        prevContactsRef.current = seeded;
        setSuggestions([]);

        // initialize badge from fallback data
        setGlobalUnreadCount(totalUnread(seeded));
      }
    })();

    mountedRef.current = true;
    return () => {
      mounted = false;
    };
  }, [fetchAllContacts, apiGet, userRoles]);

  // Search active users list when typing in ChatApp's search box
  const searchUsers = async (q) => {
    try {
      const data = await apiGet(`/chat/users?q=${encodeURIComponent(q || "")}&limit=5000`);
      setSuggestions(data || []);
    } catch (e) {
      console.warn(`/chat/users?q= failed`, e);
    }
  };

  // The list ChatApp should display: contacts (if any) else suggestions
  const listForChatApp = contacts.length ? contacts : suggestions;

  // ---- Polling loop (unread + contacts + active thread) ----
  useEffect(() => {
    let disposed = false;
    let tick = 0;
    let timerId;

    const runOnce = async () => {
      if (disposed) return;

      const visible = document.visibilityState === "visible";
      const interval = visible ? POLL_MS_VISIBLE : POLL_MS_HIDDEN;

      try {
        // 1) Unread count (every tick) — trust ONLY if numeric
        try {
          const unread = await apiGet(`/chat/unread-count`); // may be { total } or { message }, or a number
          if (disposed) return;

          const total = parseUnreadTotal(unread);
          if (total != null && Number.isFinite(total)) {
            setGlobalUnreadCount(total);
            // emit to dashboard if closed
            if (!showChat) {
              const lastContact = latestUnreadRef.current;
              const last = lastContact ? buildLastFromContact(lastContact) : undefined;
              window.dispatchEvent(
                new CustomEvent("chat:unread", {
                  detail: { count: total, last },
                })
              );
            }
          } else {
            // Endpoint didn't return a usable number — keep current value; contacts refresh will correct it.
            console.warn("[chat] unread-count endpoint returned non-numeric payload:", unread);
          }
        } catch (e) {
          if (!disposed) console.warn("poll unread failed", e);
        }

        // 2) Contacts (every N ticks while visible; less often when hidden)
        const shouldRefreshContacts =
          (visible && tick % CONTACTS_REFRESH_EVERY_N_TICKS === 0) || (!visible && tick % 4 === 0);

        if (shouldRefreshContacts) {
          try {
            const allContacts = await fetchAllContacts();
            if (disposed) return;

            const sorted = sortContacts(allContacts);

            // Detect which contact gained unread since last snapshot
            const lastSnapshot = prevContactsRef.current || [];
            const gained = diffContactsForNewUnread(lastSnapshot, sorted);

            // Optimistic global unread update from contacts snapshot (also acts as fallback)
            const prevTotal = totalUnread(lastSnapshot);
            const nextTotal = totalUnread(sorted);
            const delta = nextTotal - prevTotal;

            // Update state
            setContacts(sorted);
            prevContactsRef.current = sorted;

            // Always sync badge to nextTotal (prevents endpoint from forcing 0)
            setGlobalUnreadCount((curr) => {
              // show immediate increase smoothly; otherwise trust computed nextTotal
              if (delta > 0) return Math.max((curr ?? 0) + delta, nextTotal);
              return nextTotal;
            });

            // If chat window is closed and something gained unread, nudge dashboard with up-to-date total
            if (!showChat && gained) {
              const last = buildLastFromContact(gained);
              window.dispatchEvent(
                new CustomEvent("chat:unread", {
                  detail: { count: nextTotal, last },
                })
              );
            }
          } catch (e) {
            if (!disposed) console.warn("poll contacts failed", e);
          }
        }

        // 3) Active thread (if a thread is open): fetch, diff, push new messages into ChatApp
        if (activeContactId != null) {
          try {
            const data = await apiGet(`/chat/threads/${encodeURIComponent(activeContactId)}`);
            if (disposed) return;

            const list = normalizeMessages((data.messages || data.items || data || []).slice());

            // compute new messages since last poll
            const stats = lastThreadStatsRef.current;
            const prevLatestAt = stats.latestAt;
            const idSet = new Set(stats.idSet); // clone

            // find messages that are either new by createdAt or not in idSet
            const newOnes = list.filter((m) => {
              const idKey = m.id || m.tempId;
              const createdAtMs = new Date(m.createdAt).getTime() || 0;
              const unseen = idKey ? !idSet.has(idKey) : createdAtMs > prevLatestAt;
              return unseen;
            });

            if (newOnes.length) {
              // push them in chronological order
              newOnes.forEach((m) => {
                const idKey = m.id || m.tempId || Math.random().toString(36).slice(2);
                idSet.add(idKey);
                setIncoming({
                  contactId: String(activeContactId),
                  message: m,
                  ts: Date.now(),
                  nonce: Math.random(), // ensure unique object identity for React effect
                });
              });
              // bump scroll once at the end of the batch
              setTimeout(bumpScroll, 0);
            }

            // update stats baseline
            const latestAt = list.length ? new Date(list[list.length - 1].createdAt).getTime() : prevLatestAt;
            lastThreadStatsRef.current = {
              count: list.length,
              latestAt,
              idSet: shrinkIdSet(idSet), // keep set from growing forever
            };
          } catch (e) {
            if (!disposed) console.warn("poll thread failed", e);
          }
        }
      } catch (e) {
        if (!disposed) console.warn("poll loop error", e);
      } finally {
        tick++;
        if (!disposed) {
          timerId = setTimeout(runOnce, interval);
        }
      }
    };

    // visibility change should re-schedule the timer with new interval
    const onVisibility = () => {
      if (timerId) clearTimeout(timerId);
      tick = 0; // reset cadence on visibility flip
      if (!disposed) runOnce();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // start
    runOnce();

    return () => {
      disposed = true;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [apiGet, fetchAllContacts, activeContactId, showChat]);

  // ---- Report unread + last snapshot to dashboard ----
  useEffect(() => {
    // If global unread changed, announce it (with best-effort last message)
    if (!mountedRef.current) return;

    const prev = prevUnreadRef.current || 0;
    const curr = globalUnreadCount;

    if (prev !== curr) {
      prevUnreadRef.current = curr;

      const latestUnread = pickLatestUnreadContact(contacts);
      const last = latestUnread ? buildLastFromContact(latestUnread) : undefined;

      window.dispatchEvent(
        new CustomEvent("chat:unread", {
          detail: { count: curr, last },
        })
      );
    }
  }, [globalUnreadCount, contacts]);

  // ---- Open/close event bridge with Dashboard ----
  useEffect(() => {
    // Emit when the window is shown/hidden
    if (showChat) {
      window.dispatchEvent(new Event("chat:opened"));
    } else {
      window.dispatchEvent(new Event("chat:closed"));
    }
  }, [showChat]);

  useEffect(() => {
    // Allow dashboard to open us on demand
    const openReq = () => setShowChat(true);
    window.addEventListener("chat:open-request", openReq);
    return () => window.removeEventListener("chat:open-request", openReq);
  }, []);

  // ---- ChatApp integration (API-backed) ----
  // Fetch direct thread messages by contactId (controller ensures thread exists)
  const fetchThread = async (contactId) => {
    const data = await apiGet(`/chat/threads/${encodeURIComponent(contactId)}`);
    const list = normalizeMessages((data.messages || data.items || data || []).slice());

    // baseline stats when opening
    const idSet = new Set(list.map((m) => m.id || m.tempId).filter(Boolean));
    const latestAt = list.length ? new Date(list[list.length - 1].createdAt).getTime() : 0;
    lastThreadStatsRef.current = { count: list.length, latestAt, idSet };

    // ensure we land at bottom
    setTimeout(bumpScroll, 0);
    return list;
  };

  // Send message: ensure direct thread, then send to threadId
  const sendMessage = async ({ to, text }) => {
    const direct = await apiPost(`/chat/start-direct`, { toUserId: to });
    const threadId = direct.id || direct.threadId || direct.thread?.id;
    const msg = await apiPost(`/chat/send`, {
      threadId,
      content: text,
      message_type: "text",
    });

    // Optional: we won't trust unread endpoint; contacts refresh will sync badge
    setTimeout(bumpScroll, 0);
    return { id: msg.id, createdAt: msg.createdAt };
  };

  const markThreadRead = async (otherId) => {
    try {
      await apiPost(`/chat/threads/${encodeURIComponent(otherId)}/read`);
      // locally zero out this contact's unread, then recompute global from contacts
      setContacts((prev) => {
        const next = prev.map((c) =>
          String(c.id) === String(otherId)
            ? { ...c, unreadCount: 0, unread: 0, unread_count: 0, unread_messages: 0 }
            : c
        );
        // keep snapshot current
        prevContactsRef.current = next;
        // recompute badge from contacts
        setGlobalUnreadCount(totalUnread(next));
        return next;
      });
    } catch (e) {
      console.warn("markThreadRead failed", e);
    }
  };

  // Popup size styles (maximize is bigger, not full-screen)
  const chatStyle = chatSize === "max" ? { width: 820, height: "80vh" } : { width: 420, height: 560 };

  return (
    <>
      {/* Toasts (used if ChatApp itself shows any) */}
      <ToastContainer />

      {/* Floating Chat Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            border: "none",
            borderRadius: "50%",
            width: 60,
            height: 60,
            zIndex: 1310,
            cursor: "pointer",
            background: globalUnreadCount > 0 ? "linear-gradient(135deg,#6a11cb,#2575fc)" : "#0d6efd",
            color: "#fff",
            boxShadow: "0 10px 25px rgba(13,110,253,.35)",
            transition: "transform 0.2s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          aria-label="Open chat"
          title="Open chat"
        >
          {/* chat bubble icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>

          {/* Unread badge */}
          {globalUnreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 22,
                height: 22,
                padding: "0 6px",
                borderRadius: 11,
                background: "#dc3545",
                color: "#fff",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 2px #fff",
              }}
              aria-label={`${globalUnreadCount} unread messages`}
            >
              {globalUnreadCount > 99 ? "99+" : globalUnreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat Popup Window */}
      {showChat && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            ...chatStyle,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            zIndex: 1320,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          role="dialog"
          aria-label={activeChatName ? `Chat with ${activeChatName}` : "Chat window"}
        >
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <ChatApp
              currentUser={{ id: currentUserId, name: "You" }}
              contacts={listForChatApp}
              fetchThread={fetchThread}
              sendMessage={sendMessage}
              onOpenThread={(id) => {
                setActiveContactId(String(id));
                const c = listForChatApp.find((x) => String(x.id) === String(id));
                setActiveChatName(c?.name || "");
                markThreadRead(id);
                setTimeout(bumpScroll, 0);
              }}
              onSearch={searchUsers}
              onClose={() => {
                setShowChat(false);
                setActiveContactId(null);
                lastThreadStatsRef.current = { count: 0, latestAt: 0, idSet: new Set() };
              }}
              onToggleSize={(state) => setChatSize(state)} // 'min' | 'max'
              scrollKey={scrollKey}
              // 👇 push new polled messages directly into the open thread
              incoming={incoming}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- helpers ---------- */

// Normalize a message item for ChatApp
function normalizeMessages(list) {
  return (list || [])
    .map((m) => {
      const id = m.id ?? (m.tempId != null ? String(m.tempId) : Math.random().toString(36).slice(2));
      const created = new Date(m.createdAt || m.created_at || Date.now()).toISOString();
      return {
        id,
        tempId: m.tempId,
        from: m.from ?? m.sender_id,
        to: m.to ?? m.receiver_id,
        text: m.text ?? m.content ?? "",
        createdAt: created,
      };
    })
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// ---- Unread parsing helpers ----
function getUnread(c = {}) {
  const v =
    c.unreadCount ??
    c.unread ??
    c.unread_count ??
    c.unread_messages ??
    c.unreadMessages ??
    0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function totalUnread(contacts = []) {
  return contacts.reduce((sum, c) => sum + getUnread(c), 0);
}

function sortContacts(allContacts) {
  const sorted = [...(allContacts || [])].sort((a, b) => {
    const ua = getUnread(a);
    const ub = getUnread(b);
    if (ub !== ua) return ub - ua;
    const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bt - at; // latest first
  });
  return sorted;
}

// detect a contact whose unread increased
function diffContactsForNewUnread(prev = [], next = []) {
  const prevMap = new Map(prev.map((c) => [String(c.id), getUnread(c)]));
  let candidate = null;
  for (const c of next) {
    const pid = String(c.id);
    const before = prevMap.has(pid) ? prevMap.get(pid) : 0;
    const after = getUnread(c);
    if (after > before) {
      if (
        !candidate ||
        (c.lastMessage?.createdAt &&
          new Date(c.lastMessage.createdAt).getTime() >
            new Date(candidate.lastMessage?.createdAt || 0).getTime())
      ) {
        candidate = c;
      }
    }
  }
  return candidate;
}

// pick the most recent contact that has unread > 0
function pickLatestUnreadContact(contacts = []) {
  const unreadOnes = contacts.filter((c) => getUnread(c) > 0);
  if (unreadOnes.length === 0) return null;
  unreadOnes.sort((a, b) => {
    const at = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bt = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bt - at;
  });
  return unreadOnes[0];
}

function buildLastFromContact(contact) {
  const last = contact?.lastMessage || {};
  return {
    fromName: contact?.name || contact?.title || `User ${contact?.id}`,
    from: contact?.id,
    text: last.text || last.content || "",
    message: last.text || last.content || "",
    createdAt: last.createdAt || new Date().toISOString(),
  };
}

// limit the size of the dedupe set so it doesn't grow indefinitely
function shrinkIdSet(idSet, max = 300) {
  if (idSet.size <= max) return idSet;
  const next = new Set();
  const arr = Array.from(idSet);
  for (let i = Math.max(0, arr.length - max); i < arr.length; i++) {
    next.add(arr[i]);
  }
  return next;
}

// Parse unread-count endpoint; return number or null if unusable
function parseUnreadTotal(payload) {
  if (payload == null) return null;
  if (typeof payload === "number") return Number.isFinite(payload) ? payload : null;
  if (typeof payload === "string") {
    const n = Number(payload);
    return Number.isFinite(n) ? n : null;
  }
  // object
  const candidates = [
    payload.total,
    payload.count,
    payload.unread,
    payload.unreadCount,
    payload.unread_total,
    payload.number,
    payload.value,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function seedContacts() {
  const now = Date.now();
  return [
    {
      id: "2",
      name: "Ritu Sharma",
      subtitle: "Math Teacher",
      unreadCount: 0,
      lastMessage: { text: "Thanks!", createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString() },
    },
    {
      id: "3",
      name: "Accounts Dept.",
      subtitle: "Finance Team",
      unreadCount: 1,
      lastMessage: { text: "Invoice shared", createdAt: new Date(now - 10 * 60 * 1000).toISOString() },
    },
  ];
}
