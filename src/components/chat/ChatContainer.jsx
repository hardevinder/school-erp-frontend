import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import ChatApp from "../ChatApp";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Polling intervals (ms)
const POLL_MS_VISIBLE = 3500;
const POLL_MS_HIDDEN = 12000;
const CONTACTS_REFRESH_EVERY_N_TICKS = 2;

export default function ChatContainer() {
  const [showChat, setShowChat] = useState(false);
  const [chatSize, setChatSize] = useState("min"); // 'min' | 'max'
  const [activeChatName, setActiveChatName] = useState("");
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);

  const [contacts, setContacts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeContactId, setActiveContactId] = useState(null);

  const [scrollKey, setScrollKey] = useState(0);
  const bumpScroll = () => setScrollKey((n) => n + 1);

  const [incoming, setIncoming] = useState(null);

  const lastThreadStatsRef = useRef({ count: 0, latestAt: 0, idSet: new Set() });
  const prevUnreadRef = useRef(0);
  const prevContactsRef = useRef([]);
  const mountedRef = useRef(false);

  const latestUnreadRef = useRef(null);

  useEffect(() => {
    latestUnreadRef.current = pickLatestUnreadContact(contacts);
  }, [contacts]);

  const getToken = () =>
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("accessToken") ||
    "";

  const authHeaders = () => {
    const t = getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

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

  const BASE_API = process.env.REACT_APP_API_URL || "http://localhost:4000";

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

  // ---- Contacts fetch ----
  const fetchAllContacts = useCallback(
    async ({ limit = 5000 } = {}) => {
      const res = await apiGet(`/chat/contacts?fillUsers=1&limit=${limit}`);
      const arr = Array.isArray(res) ? res : res.items || res.data || res.results || [];
      return arr || [];
    },
    [apiGet]
  );

  useEffect(() => {
    if (!userRoles.length) return;
    let mounted = true;

    (async () => {
      try {
        const allContacts = await fetchAllContacts();
        if (!mounted) return;

        const sorted = sortContacts(allContacts);
        setContacts(sorted);
        prevContactsRef.current = sorted;
        setGlobalUnreadCount(totalUnread(sorted));

        if (sorted.length === 0) {
          try {
            const sug = await apiGet(`/chat/users?limit=5000`);
            if (mounted) setSuggestions(sug || []);
          } catch {
            if (mounted) setSuggestions([]);
          }
        } else {
          setSuggestions([]);
        }
      } catch {
        const seeded = seedContacts();
        setContacts(seeded);
        prevContactsRef.current = seeded;
        setSuggestions([]);
        setGlobalUnreadCount(totalUnread(seeded));
      }
    })();

    mountedRef.current = true;
    return () => {
      mounted = false;
    };
  }, [fetchAllContacts, apiGet, userRoles]);

  const searchUsers = async (q) => {
    try {
      const data = await apiGet(`/chat/users?q=${encodeURIComponent(q || "")}&limit=5000`);
      setSuggestions(data || []);
    } catch {}
  };

  const listForChatApp = contacts.length ? contacts : suggestions;

  const groupedForChatApp = useMemo(() => {
    return groupContactsByClassSection(listForChatApp);
  }, [listForChatApp]);

  // ---- Polling loop ----
  useEffect(() => {
    let disposed = false;
    let tick = 0;
    let timerId;

    const runOnce = async () => {
      if (disposed) return;
      const visible = document.visibilityState === "visible";
      const interval = visible ? POLL_MS_VISIBLE : POLL_MS_HIDDEN;

      try {
        try {
          const unread = await apiGet(`/chat/unread-count`);
          if (disposed) return;
          const total = parseUnreadTotal(unread);
          if (total != null && Number.isFinite(total)) {
            setGlobalUnreadCount(total);
          }
        } catch {}

        const shouldRefreshContacts =
          (visible && tick % CONTACTS_REFRESH_EVERY_N_TICKS === 0) || (!visible && tick % 4 === 0);

        if (shouldRefreshContacts) {
          try {
            const allContacts = await fetchAllContacts();
            if (disposed) return;

            const sorted = sortContacts(allContacts);
            const lastSnapshot = prevContactsRef.current || [];
            const gained = diffContactsForNewUnread(lastSnapshot, sorted);
            const nextTotal = totalUnread(sorted);

            setContacts(sorted);
            prevContactsRef.current = sorted;
            setGlobalUnreadCount(nextTotal);

            if (!showChat && gained) {
              const last = buildLastFromContact(gained);
              window.dispatchEvent(
                new CustomEvent("chat:unread", {
                  detail: { count: nextTotal, last },
                })
              );

              // ✅ Toast notification for new unread
              toast.info(`${last.fromName}: ${last.text}`, { autoClose: 3000 });
            }
          } catch {}
        }

        if (activeContactId != null) {
          try {
            const data = await apiGet(`/chat/threads/${encodeURIComponent(activeContactId)}`);
            if (disposed) return;

            const list = normalizeMessages((data.messages || data.items || data || []).slice());
            const stats = lastThreadStatsRef.current;
            const prevLatestAt = stats.latestAt;
            const idSet = new Set(stats.idSet);

            const newOnes = list.filter((m) => {
              const idKey = m.id || m.tempId;
              const createdAtMs = new Date(m.createdAt).getTime() || 0;
              const unseen = idKey ? !idSet.has(idKey) : createdAtMs > prevLatestAt;
              return unseen;
            });

            if (newOnes.length) {
              newOnes.forEach((m) => {
                const idKey = m.id || m.tempId || Math.random().toString(36).slice(2);
                idSet.add(idKey);
                setIncoming({
                  contactId: String(activeContactId),
                  message: m,
                  ts: Date.now(),
                  nonce: Math.random(),
                });
              });
              setTimeout(bumpScroll, 0);
            }

            const latestAt = list.length ? new Date(list[list.length - 1].createdAt).getTime() : prevLatestAt;
            lastThreadStatsRef.current = { count: list.length, latestAt, idSet: shrinkIdSet(idSet) };
          } catch {}
        }
      } finally {
        tick++;
        if (!disposed) timerId = setTimeout(runOnce, interval);
      }
    };

    const onVisibility = () => {
      if (timerId) clearTimeout(timerId);
      tick = 0;
      if (!disposed) runOnce();
    };
    document.addEventListener("visibilitychange", onVisibility);
    runOnce();

    return () => {
      disposed = true;
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [apiGet, fetchAllContacts, activeContactId, showChat]);

  useEffect(() => {
    if (!mountedRef.current) return;
    const prev = prevUnreadRef.current || 0;
    const curr = globalUnreadCount;
    if (prev !== curr) {
      prevUnreadRef.current = curr;
      const latestUnread = pickLatestUnreadContact(contacts);
      const last = latestUnread ? buildLastFromContact(latestUnread) : undefined;
      window.dispatchEvent(new CustomEvent("chat:unread", { detail: { count: curr, last } }));
    }
  }, [globalUnreadCount, contacts]);

  useEffect(() => {
    if (showChat) {
      window.dispatchEvent(new Event("chat:opened"));
    } else {
      window.dispatchEvent(new Event("chat:closed"));
    }
  }, [showChat]);

  useEffect(() => {
    const openReq = () => setShowChat(true);
    window.addEventListener("chat:open-request", openReq);
    return () => window.removeEventListener("chat:open-request", openReq);
  }, []);

  const fetchThread = async (contactId) => {
    const data = await apiGet(`/chat/threads/${encodeURIComponent(contactId)}`);
    const list = normalizeMessages((data.messages || data.items || data || []).slice());
    const idSet = new Set(list.map((m) => m.id || m.tempId).filter(Boolean));
    const latestAt = list.length ? new Date(list[list.length - 1].createdAt).getTime() : 0;
    lastThreadStatsRef.current = { count: list.length, latestAt, idSet };
    setTimeout(bumpScroll, 0);
    return list;
  };

  const sendMessage = async ({ to, text }) => {
    const direct = await apiPost(`/chat/start-direct`, { toUserId: to });
    const threadId = direct.id || direct.threadId || direct.thread?.id;
    const msg = await apiPost(`/chat/send`, { threadId, content: text, message_type: "text" });
    setTimeout(bumpScroll, 0);
    return { id: msg.id, createdAt: msg.createdAt };
  };

  const markThreadRead = async (otherId) => {
    try {
      await apiPost(`/chat/threads/${encodeURIComponent(otherId)}/read`);
      setContacts((prev) => {
        const next = prev.map((c) =>
          String(c.id) === String(otherId) ? { ...c, unreadCount: 0 } : c
        );
        prevContactsRef.current = next;
        setGlobalUnreadCount(totalUnread(next));
        return next;
      });
    } catch {}
  };

  const chatStyle =
    chatSize === "max" ? { width: 820, height: "80vh" } : { width: 420, height: 560 };

  return (
    <>
      <ToastContainer />

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
            background:
              globalUnreadCount > 0
                ? "linear-gradient(135deg,#6a11cb,#2575fc)"
                : "#0d6efd",
            color: "#fff",
            boxShadow: "0 10px 25px rgba(13,110,253,.35)",
            transition: "transform 0.2s",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            stroke="currentColor"
            fill="none"
          >
            <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
          </svg>
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
            >
              {globalUnreadCount > 99 ? "99+" : globalUnreadCount}
            </span>
          )}
        </button>
      )}

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
            minHeight: 0,
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <ChatApp
              currentUser={{ id: currentUserId, name: "You" }}
              contacts={groupedForChatApp}
              fetchThread={fetchThread}
              sendMessage={sendMessage}
              onOpenThread={(id) => {
                setActiveContactId(String(id));
                const c = listForChatApp.find((x) => String(x.id) === String(id));
                setActiveChatName(c?.name || "");
                markThreadRead(id); // ✅ reset unread
                setTimeout(bumpScroll, 0);
              }}
              onSearch={searchUsers}
              onClose={() => {
                setShowChat(false);
                setActiveContactId(null);
                lastThreadStatsRef.current = {
                  count: 0,
                  latestAt: 0,
                  idSet: new Set(),
                };
              }}
              onToggleSize={(state) => setChatSize(state)}
              scrollKey={scrollKey}
              incoming={incoming}
            />
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- helpers ---------- */
function groupContactsByClassSection(contacts = []) {
  const grouped = {};
  contacts.forEach((c) => {
    if (c.student?.class && c.student?.section) {
      const heading = `${c.student.class.name} - ${c.student.section.name}`;
      if (!grouped[heading]) grouped[heading] = [];
      grouped[heading].push(c);
    } else {
      if (!grouped["Others"]) grouped["Others"] = [];
      grouped["Others"].push(c);
    }
  });

  return Object.keys(grouped)
    .sort((a, b) => a.localeCompare(b))
    .map((heading) => ({
      heading,
      items: grouped[heading].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

function normalizeMessages(list) {
  return (list || [])
    .map((m) => {
      const id =
        m.id ??
        (m.tempId != null ? String(m.tempId) : Math.random().toString(36).slice(2));
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
  return [...(allContacts || [])].sort((a, b) => {
    const ua = getUnread(a);
    const ub = getUnread(b);
    if (ub !== ua) return ub - ua;
    const at = a.lastMessage?.createdAt
      ? new Date(a.lastMessage.createdAt).getTime()
      : 0;
    const bt = b.lastMessage?.createdAt
      ? new Date(b.lastMessage.createdAt).getTime()
      : 0;
    return bt - at;
  });
}
function diffContactsForNewUnread(prev = [], next = []) {
  const prevMap = new Map(prev.map((c) => [String(c.id), getUnread(c)]));
  let candidate = null;
  for (const c of next) {
    const before = prevMap.get(String(c.id)) || 0;
    const after = getUnread(c);
    if (after > before) {
      if (
        !candidate ||
        new Date(c.lastMessage?.createdAt || 0) >
          new Date(candidate.lastMessage?.createdAt || 0)
      ) {
        candidate = c;
      }
    }
  }
  return candidate;
}
function pickLatestUnreadContact(contacts = []) {
  const unreadOnes = contacts.filter((c) => getUnread(c) > 0);
  if (!unreadOnes.length) return null;
  unreadOnes.sort(
    (a, b) =>
      new Date(b.lastMessage?.createdAt || 0) -
      new Date(a.lastMessage?.createdAt || 0)
  );
  return unreadOnes[0];
}
function buildLastFromContact(contact) {
  const last = contact?.lastMessage || {};
  return {
    fromName: contact?.name || contact?.title || `User ${contact?.id}`,
    from: contact?.id,
    text: last.text || "",
    createdAt: last.createdAt || new Date().toISOString(),
  };
}
function shrinkIdSet(idSet, max = 300) {
  if (idSet.size <= max) return idSet;
  return new Set(Array.from(idSet).slice(-max));
}
function parseUnreadTotal(payload) {
  if (payload == null) return null;
  if (typeof payload === "number") return payload;
  if (typeof payload === "string") return Number(payload) || null;
  const candidates = [payload.total, payload.count, payload.unread, payload.unreadCount];
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
      lastMessage: {
        text: "Thanks!",
        createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      },
    },
    {
      id: "3",
      name: "Accounts Dept.",
      subtitle: "Finance Team",
      unreadCount: 1,
      lastMessage: {
        text: "Invoice shared",
        createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
      },
    },
  ];
}
