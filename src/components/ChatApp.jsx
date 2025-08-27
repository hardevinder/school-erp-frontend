import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  ListGroup,
  Form,
  Button,
  InputGroup,
  Badge,
  Spinner,
  Alert,
} from "react-bootstrap";

/**
 * Props
 *  - currentUser: { id, name }
 *  - contacts: [...]              // recent chats
 *  - suggestions?: [...]          // people list (from /chat/users)
 *  - fetchThread(contactId)
 *  - sendMessage({ to, text, tempId })
 *  - onSearch?(q)
 *  - onOpenThread?(contactId)
 *  - onClose?()
 *  - onToggleSize?(state: 'max' | 'min')
 *  - scrollKey? (number)          // bump to stick scroll to bottom
 *  - incoming?: {                 // 🚀 push new msg directly into open thread
 *      contactId: string|number,
 *      message: { id?, tempId?, from, to, text, createdAt? },
 *      ts: number,
 *      nonce?: number
 *    }
 */
export default function ChatApp({
  currentUser = { id: "me", name: "You" },
  contacts: initialContacts = [],
  suggestions: initialSuggestions = [],
  fetchThread,
  sendMessage,
  onSearch,
  onOpenThread,
  onClose,
  onToggleSize,
  scrollKey = 0,
  incoming, // ⬅️ NEW
}) {
  const [contacts, setContacts] = useState(() => seedContacts(initialContacts));
  const [people, setPeople] = useState(() => initialSuggestions || []);
  const [activeId, setActiveId] = useState(() => initialContacts[0]?.id ?? null);
  const [threads, setThreads] = useState({}); // { [contactId]: Message[] }
  const [drafts, setDrafts] = useState({}); // { [contactId]: string }
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [sizeState, setSizeState] = useState("min"); // 'min' | 'max'
  const [tab, setTab] = useState("chats"); // 'chats' | 'people'

  // Panel height so inner areas can scroll
  const PANEL_HEIGHT = sizeState === "max" ? 640 : 420; // px

  // Sync lists from parent
  useEffect(() => {
    setContacts(initialContacts.length ? initialContacts : seedContacts([]));
    setPeople(initialSuggestions || []);
    if (!activeId && initialContacts.length) setActiveId(initialContacts[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContacts, initialSuggestions]);

  // Load thread (cached per contact)
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      if (threads[activeId]) return;
      setLoadingThread(true);
      setError("");
      try {
        const data = fetchThread ? await fetchThread(activeId) : seedMessages(currentUser.id, activeId);
        const normalized = normalizeMessages(data);
        if (!cancelled) {
          setThreads((p) => ({ ...p, [activeId]: normalized }));
          setContacts((p) => p.map((c) => (String(c.id) === String(activeId) ? { ...c, unreadCount: 0 } : c)));
        }
      } catch (e) {
        console.error("fetchThread failed", e);
        if (!cancelled) {
          setError("Could not load messages from server. Showing demo data.");
          const fallback = normalizeMessages(seedMessages(currentUser.id, activeId));
          setThreads((p) => ({ ...p, [activeId]: fallback }));
        }
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // 👉 Realtime: append incoming message (if it belongs to the open thread)
  useEffect(() => {
    if (!incoming || !activeId) return;
    const { contactId, message } = incoming;
    if (String(contactId) !== String(activeId)) return;

    // Normalize to our internal shape
    const normalized = {
      id:
        message.id ??
        (message.tempId != null ? String(message.tempId) : Math.random().toString(36).slice(2)),
      tempId: message.tempId,
      from: message.from ?? message.sender_id,
      to: message.to ?? message.receiver_id,
      text: message.text ?? message.content ?? "",
      createdAt: new Date(message.createdAt ?? message.created_at ?? Date.now()).toISOString(),
    };

    // De-dupe by id or tempId, then append and keep order
    setThreads((prev) => {
      const list = prev[activeId] || [];
      const exists = list.some(
        (m) => m.id === normalized.id || (m.tempId && normalized.tempId && m.tempId === normalized.tempId)
      );
      if (exists) return prev;
      const next = [...list, normalized].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      return { ...prev, [activeId]: next };
    });
  }, [incoming, activeId]);

  const activeThread = threads[activeId] || [];
  const draft = drafts[activeId] || "";

  // Debounced search (for People tab)
  const searchDebounceRef = useRef();
  const onSearchChange = (val) => {
    setSearch(val);
    if (!onSearch) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => onSearch(val), 300);
  };

  // Filtered lists (client-side filter on top of server data)
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts || [];
    return q ? list.filter((c) => `${c.name} ${c.subtitle ?? ""}`.toLowerCase().includes(q)) : list;
  }, [contacts, search]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = people || [];
    return q ? list.filter((c) => `${c.name} ${c.subtitle ?? ""}`.toLowerCase().includes(q)) : list;
  }, [people, search]);

  // Toggle size
  const toggleSize = (next) => {
    setSizeState(next);
    onToggleSize?.(next);
  };

  // Send
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !activeId) return;

    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      tempId,
      from: String(currentUser.id),
      to: String(activeId),
      text,
      createdAt: new Date().toISOString(),
    };

    setThreads((prev) => ({ ...prev, [activeId]: [...(prev[activeId] || []), optimistic] }));
    setDrafts((prev) => ({ ...prev, [activeId]: "" }));

    try {
      if (sendMessage) {
        const res = await sendMessage({ to: activeId, text, tempId });
        setThreads((prev) => ({
          ...prev,
          [activeId]: (prev[activeId] || []).map((m) =>
            m.tempId === tempId ? { ...m, id: res?.id ?? m.id, createdAt: res?.createdAt ?? m.createdAt } : m
          ),
        }));
      }
      setContacts((prev) =>
        prev.map((c) =>
          String(c.id) === String(activeId)
            ? { ...c, lastMessage: { text, createdAt: new Date().toISOString(), from: currentUser.id } }
            : c
        )
      );
    } catch (e) {
      console.error("sendMessage failed", e);
      setThreads((prev) => ({ ...prev, [activeId]: (prev[activeId] || []).filter((m) => m.tempId !== tempId) }));
      alert("Failed to send. Please try again.");
    }
  }, [draft, activeId, currentUser.id, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onSelectContact = (id) => {
    setActiveId(id);
    onOpenThread?.(id);
    setContacts((prev) => prev.map((c) => (String(c.id) === String(id) ? { ...c, unreadCount: 0 } : c)));
  };

  return (
    <div className="d-flex flex-column" style={{ height: PANEL_HEIGHT, minHeight: 0 }}>
      {/* Header */}
      <div className="border-bottom d-flex align-items-center gap-2 px-2" style={{ height: 44, flex: "0 0 auto" }}>
        <strong className="text-truncate" style={{ maxWidth: "60%" }}>
          {activeId ? contacts.find((c) => String(c.id) === String(activeId))?.name || "Chat" : "Chat"}
        </strong>

        <div className="ms-auto d-flex align-items-center gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => toggleSize("min")} title="Minimize" aria-label="Minimize">
            —
          </Button>
          <Button variant="outline-secondary" size="sm" onClick={() => toggleSize("max")} title="Maximize" aria-label="Maximize">
            ⛶
          </Button>
          {onClose && (
            <Button variant="outline-secondary" size="sm" onClick={() => onClose()} title="Close" aria-label="Close">
              ×
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      {/* IMPORTANT: give Container & Row real height so children can flex/scroll */}
      <Container fluid className="flex-grow-1" style={{ minHeight: 0, height: "100%" }}>
        <Row className="h-100" style={{ height: "100%" }}>
          {/* Contact List */}
          <Col
            md={4}
            className="border-end p-0 d-flex flex-column"
            style={{ minHeight: 0, height: "100%" }}
          >
            {/* Tabs + Search */}
            <div className="p-2 border-bottom" style={{ flex: "0 0 auto" }}>
              <div className="d-flex align-items-center mb-2">
                <div className="btn-group btn-group-sm" role="group" aria-label="Contact tabs">
                  <button
                    className={`btn ${tab === "chats" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setTab("chats")}
                  >
                    Chats <Badge bg="light" text="dark">{contacts.length}</Badge>
                  </button>
                  <button
                    className={`btn ${tab === "people" ? "btn-primary" : "btn-outline-primary"}`}
                    onClick={() => setTab("people")}
                  >
                    People <Badge bg="light" text="dark">{people.length}</Badge>
                  </button>
                </div>
              </div>

              <Form.Control
                type="text"
                placeholder={tab === "people" ? "Search people" : "Filter chats"}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>

            {/* Scrollable list */}
            <div
              style={{
                minHeight: 0,
                flex: "1 1 auto",
                overflowY: "auto",
                overflowX: "hidden",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <ListGroup variant="flush">
                {(tab === "chats" ? filteredContacts : filteredPeople).map((c) => (
                  <ListGroup.Item
                    action
                    key={c.id}
                    active={String(activeId) === String(c.id)}
                    onClick={() => onSelectContact(c.id)}
                    className="d-flex align-items-center gap-2"
                  >
                    <Avatar name={c.name} src={c.avatar} />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center">
                        <div className="fw-semibold text-truncate" style={{ maxWidth: 200 }}>
                          {c.name}
                        </div>
                        {c.unreadCount > 0 && <Badge className="ms-2" bg="primary">{c.unreadCount}</Badge>}
                      </div>
                      <small className="text-muted text-truncate d-block" style={{ maxWidth: 240 }}>
                        {c.lastMessage?.text ?? c.subtitle ?? ""}
                      </small>
                    </div>
                  </ListGroup.Item>
                ))}
                {(tab === "chats" ? filteredContacts : filteredPeople).length === 0 && (
                  <div className="text-muted small p-3">
                    {search ? "No matches." : tab === "chats" ? "No chats yet." : "No people found."}
                  </div>
                )}
              </ListGroup>
            </div>
          </Col>

          {/* Chat Window (VERTICAL messages, newest at bottom) */}
          <Col
            md={8}
            className="d-flex flex-column p-0"
            style={{ minHeight: 0, height: "100%" }}
          >
            {!activeId ? (
              <div className="m-auto text-muted">Select a contact to start chatting</div>
            ) : (
              <>
                {error && (
                  <Alert variant="warning" className="m-2 py-1 px-2 small" style={{ flex: "0 0 auto" }}>
                    {error}
                  </Alert>
                )}

                <MessageListVertical
                  key={`${activeId}::${activeThread.length ? String(activeThread[activeThread.length - 1].id || activeThread[activeThread.length - 1].createdAt) : 'init'}`}
                  activeKey={activeId}
                  externalScrollKey={scrollKey}
                  messages={activeThread}
                  currentUserId={String(currentUser.id)}
                  loading={loadingThread}
                />

                {/* Sticky composer */}
                <div
                  className="border-top p-2"
                  style={{
                    position: "sticky",
                    bottom: 0,
                    background: "#fff",
                    flex: "0 0 auto",
                  }}
                >
                  <InputGroup>
                    <AutoTextarea
                      value={draft}
                      onChange={(v) => setDrafts((prev) => ({ ...prev, [activeId]: v }))}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message"
                      maxHeight={120}
                    />
                    <Button variant="primary" onClick={handleSend} disabled={!draft.trim()}>
                      Send
                    </Button>
                  </InputGroup>
                </div>
              </>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function Avatar({ name = "", src }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return src ? (
    <img
      src={src}
      alt={name}
      style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }}
    />
  ) : (
    <div
      aria-label={name}
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "#e9ecef",
        color: "#495057",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: 14,
      }}
    >
      {initial || "?"}
    </div>
  );
}

/**
 * Vertical message list (classic chat):
 * - Oldest at the TOP, newest at the BOTTOM
 * - Auto-sticks to bottom when near bottom, after sending/receiving, and on chat switch
 * - Shows a "Jump to latest" button when the user scrolls up
 */
function MessageListVertical({ activeKey, externalScrollKey = 0, messages = [], currentUserId, loading }) {
  const boxRef = useRef(null);
  const [showJump, setShowJump] = useState(false);

  const ordered = useMemo(() => {
    const copy = [...messages];
    copy.sort((a, b) => new Date(a.createdAt ?? a.created_at) - new Date(b.createdAt ?? b.created_at)); // oldest -> newest
    return copy;
  }, [messages]);

  const scrollToBottom = (behavior = "auto") => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  // On thread switch, scroll after paint
  useEffect(() => {
    const id = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(id);
  }, [activeKey]);

  // On external bumps (send/receive/socket), double-RAF to ensure layout is ready
  useEffect(() => {
    if (!externalScrollKey) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom("smooth"));
    });
    return () => cancelAnimationFrame(id);
  }, [externalScrollKey]);

  // Auto-scroll to bottom on new messages (if near bottom or small list)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom || ordered.length <= 20) {
      scrollToBottom("auto");
      setShowJump(false);
    } else {
      setShowJump(true);
    }
  }, [ordered.length, loading]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowJump(!nearBottom);
  };

  const jumpToLatest = () => {
    scrollToBottom("smooth");
    setShowJump(false);
  };

  return (
    <div className="position-relative d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
      <div
        ref={boxRef}
        onScroll={onScroll}
        className="p-3"
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          overflowX: "hidden",
          background: "#f8f9fa",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {loading && ordered.length === 0 ? (
          <div className="d-flex justify-content-center py-3">
            <Spinner animation="border" size="sm" />
          </div>
        ) : (
          ordered.map((m) => {
            const text = m.text ?? m.content ?? "";
            const mine = String(m.from ?? m.sender_id) === String(currentUserId);
            const dt = new Date(m.createdAt ?? m.created_at ?? Date.now());
            return (
              <div
                key={m.id}
                className={`d-flex ${mine ? "justify-content-end" : "justify-content-start"}`}
              >
                <div
                  className={`p-2 rounded ${mine ? "bg-primary text-white" : "bg-white border"}`}
                  style={{ maxWidth: "78%" }}
                >
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</div>
                  <div className="text-end small text-muted mt-1">{timeShort(dt)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Jump to latest */}
      {showJump && (
        <button
          onClick={jumpToLatest}
          className="btn btn-light border shadow-sm"
          style={{
            position: "absolute",
            right: 12,
            bottom: 72, // above composer
            padding: "6px 10px",
            borderRadius: 16,
            fontSize: 12,
          }}
          aria-label="Jump to latest messages"
          title="Jump to latest"
        >
          ↓ New messages
        </button>
      )}
    </div>
  );
}

function AutoTextarea({ value, onChange, onKeyDown, placeholder, maxHeight = 140 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = next + "px";
    el.style.overflowY = el.scrollHeight > next ? "auto" : "hidden";
  }, [value, maxHeight]);

  return (
    <Form.Control
      as="textarea"
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      style={{ resize: "none" }}
    />
  );
}

/* ---------- Utils ---------- */
function timeShort(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // oldest -> newest
}

function seedContacts(initial) {
  if (initial?.length) return initial;
  const now = Date.now();
  return [
    { id: "2", name: "Ritu Sharma", subtitle: "Math Teacher", lastMessage: { text: "Thanks!", createdAt: now - 26 * 60 * 60 * 1000 } },
    { id: "3", name: "Accounts Dept.", subtitle: "Finance Team", unreadCount: 1, lastMessage: { text: "Invoice shared", createdAt: now - 10 * 60 * 1000 } },
  ];
}

function seedMessages(me, other) {
  const now = Date.now();
  return [
    { id: "m1", from: other, to: me, text: "Hello! This is a demo chat.", createdAt: now - 36 * 60 * 60 * 1000 },
    { id: "m2", from: me, to: other, text: "Looks great. Thanks.", createdAt: now - 35 * 60 * 60 * 1000 },
    { id: "m3", from: other, to: me, text: "Shall we finalize by tomorrow?", createdAt: now - 2 * 60 * 60 * 1000 },
    { id: "m4", from: me, to: other, text: "Yes, confirmed.", createdAt: now - 90 * 60 * 1000 },
  ];
}
