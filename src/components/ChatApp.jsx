import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  ListGroup,
  Form,
  Button,
  InputGroup,
  Badge,
  Spinner,
  Alert,
} from "react-bootstrap";

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
  incoming,
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [people, setPeople] = useState(initialSuggestions || []);
  const [activeId, setActiveId] = useState(null);
  const [threads, setThreads] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState("chats");
  const [expanded, setExpanded] = useState({});
  const [unreads, setUnreads] = useState({});
  const [file, setFile] = useState(null); // ✅ selected file

  // Sync contacts + unread seed
  useEffect(() => {
    setContacts(initialContacts);
    setPeople(initialSuggestions || []);

    const initialUnreads = {};
    (isGrouped(initialContacts)
      ? initialContacts.flatMap((g) => g.items)
      : initialContacts
    ).forEach((c) => {
      if (c.unreadCount && c.unreadCount > 0) {
        initialUnreads[c.id] = c.unreadCount;
      }
    });
    setUnreads(initialUnreads);
  }, [initialContacts, initialSuggestions]);

  // Handle incoming socket message
  useEffect(() => {
    if (!incoming) return;
    const contactId = String(incoming.contactId);
    const msg = normalizeMessage(incoming.message);

    setThreads((prev) => {
      const list = prev[contactId] || [];
      if (list.some((m) => m.id === msg.id)) return prev;
      return { ...prev, [contactId]: [...list, msg] };
    });

    if (contactId !== String(activeId)) {
      setUnreads((prev) => ({
        ...prev,
        [contactId]: (prev[contactId] || 0) + 1,
      }));
    }
  }, [incoming, activeId]);

  const toggleExpand = (heading) =>
    setExpanded((prev) => ({ ...prev, [heading]: !prev[heading] }));

  // ✅ send text or file
  const handleSend = useCallback(async () => {
    if (!activeId) return;

    let text = (drafts[activeId] || "").trim();
    let fileToSend = file;

    if (!text && !fileToSend) return;

    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      from: currentUser.id,
      to: activeId,
      text: text || (fileToSend ? fileToSend.name : ""),
      createdAt: new Date().toISOString(),
      message_type: fileToSend ? "file" : "text",
    };

    setThreads((p) => ({
      ...p,
      [activeId]: [...(p[activeId] || []), optimistic],
    }));
    setDrafts((p) => ({ ...p, [activeId]: "" }));
    setFile(null);

    try {
      if (fileToSend) {
        // Step 1: upload file
        const formData = new FormData();
        formData.append("file", fileToSend);

        const uploadRes = await fetch(
          `${process.env.REACT_APP_API_URL}/chat/upload`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: formData,
          }
        ).then((r) => r.json());

        if (!uploadRes.url) throw new Error("Upload failed");

        // Step 2: send message with file info
        const payload = {
          threadId: activeId,
          content: uploadRes.url,
          message_type: uploadRes.type.startsWith("image/") ? "image" : "file",
          meta: {
            original: uploadRes.original,
            size: uploadRes.size,
            mime: uploadRes.type,
          },
        };

        const sendRes = await fetch(
          `${process.env.REACT_APP_API_URL}/chat/send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify(payload),
          }
        ).then((r) => r.json());

        setThreads((p) => ({
          ...p,
          [activeId]: (p[activeId] || []).map((m) =>
            m.id === tempId ? { ...m, ...sendRes } : m
          ),
        }));
      } else {
        // text only
        const res = await sendMessage({ to: activeId, text, tempId });
        setThreads((p) => ({
          ...p,
          [activeId]: (p[activeId] || []).map((m) =>
            m.id === tempId ? { ...m, ...res } : m
          ),
        }));
      }
    } catch (err) {
      console.error("send error:", err);
      setError("Error sending message");
      setThreads((p) => ({
        ...p,
        [activeId]: (p[activeId] || []).filter((m) => m.id !== tempId),
      }));
    }
  }, [drafts, activeId, currentUser.id, sendMessage, file]);

  const onSelectContact = async (id) => {
    setActiveId(id);
    setUnreads((prev) => ({ ...prev, [id]: 0 }));
    onOpenThread?.(id);

    try {
      await fetch(`${process.env.REACT_APP_API_URL}/chat/threads/${id}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
    } catch (err) {
      console.error("Failed to mark thread read", err);
    }
  };

  // Search filters
  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!isGrouped(contacts)) return contacts;
    return contacts
      .map((grp) => ({
        ...grp,
        items: grp.items.filter((c) =>
          `${c.name} ${c.subtitle ?? ""}`.toLowerCase().includes(q)
        ),
      }))
      .filter((grp) => grp.items.length > 0);
  }, [contacts, search]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((c) =>
      `${c.name} ${c.subtitle ?? ""}`.toLowerCase().includes(q)
    );
  }, [people, search]);

  // sorting by last message time
  const getLatestTime = (id) => {
    const msgs = threads[id] || [];
    if (msgs.length > 0) {
      return new Date(msgs[msgs.length - 1].createdAt).getTime();
    }
    const contact = (isGrouped(contacts)
      ? contacts.flatMap((g) => g.items)
      : contacts
    ).find((c) => String(c.id) === String(id));
    return contact?.lastMessage?.createdAt
      ? new Date(contact.lastMessage.createdAt).getTime()
      : 0;
  };

  const sortedContacts = useMemo(() => {
    if (!isGrouped(contacts)) return contacts;
    return contacts
      .map((grp) => ({
        ...grp,
        items: grp.items.sort((a, b) => getLatestTime(b.id) - getLatestTime(a.id)),
      }))
      .sort(
        (a, b) => getLatestTime(b.items[0]?.id) - getLatestTime(a.items[0]?.id)
      );
  }, [contacts, threads]);

  return (
    <div className="d-flex flex-column" style={{ flex: 1, minHeight: 0, height: "100%" }}>
      {/* Header */}
      <div className="border-bottom d-flex align-items-center px-2" style={{ height: 44, flex: "0 0 auto" }}>
        <strong className="text-truncate">
          {activeId ? findNameById(contacts, activeId) : "Chat"}
        </strong>
        <div className="ms-auto d-flex gap-2">
          <Button size="sm" variant="outline-secondary" onClick={() => onToggleSize?.("min")}>—</Button>
          <Button size="sm" variant="outline-secondary" onClick={() => onToggleSize?.("max")}>⛶</Button>
          {onClose && <Button size="sm" variant="outline-secondary" onClick={onClose}>×</Button>}
        </div>
      </div>

      {/* Main */}
      <div className="flex-grow-1 d-flex" style={{ minHeight: 0 }}>
        {/* Contacts */}
        <div style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", borderRight: "1px solid #dee2e6", minHeight: 0 }}>
          <div className="p-2 border-bottom" style={{ flex: "0 0 auto" }}>
            <div className="btn-group btn-group-sm mb-2">
              <button className={`btn ${tab === "chats" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("chats")}>Chats</button>
              <button className={`btn ${tab === "people" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("people")}>People</button>
            </div>
            <Form.Control value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
          </div>

          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
            <ListGroup variant="flush">
              {tab === "chats" ? (
                sortedContacts.map((grp) => {
                  const groupUnread = grp.items.reduce((s, c) => s + (unreads[c.id] || 0), 0);
                  return (
                    <React.Fragment key={grp.heading}>
                      <ListGroup.Item
                        action
                        onClick={() => toggleExpand(grp.heading)}
                        className={`fw-bold d-flex justify-content-between align-items-center ${
                          expanded[grp.heading] ? "bg-primary text-white" : "bg-light"
                        }`}
                      >
                        <span>{grp.heading}</span>
                        <span>
                          {groupUnread > 0 && <Badge bg="danger" className="me-2">{groupUnread}</Badge>}
                          <span className="small">{expanded[grp.heading] ? "▼" : "▶"}</span>
                        </span>
                      </ListGroup.Item>
                      {expanded[grp.heading] &&
                        grp.items.map((c) => {
                          const count = unreads[c.id] || 0;
                          return (
                            <ListGroup.Item
                              key={c.id}
                              action
                              active={String(activeId) === String(c.id)}
                              onClick={() => onSelectContact(c.id)}
                              className="d-flex justify-content-between align-items-center"
                            >
                              {c.name}
                              {count > 0 && <Badge bg="danger">{count}</Badge>}
                            </ListGroup.Item>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              ) : (
                filteredPeople.map((c) => (
                  <ListGroup.Item key={c.id} action onClick={() => onSelectContact(c.id)}>
                    {c.name}
                  </ListGroup.Item>
                ))
              )}
            </ListGroup>
          </div>
        </div>

        {/* Messages */}
        <div className="d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
          {!activeId ? (
            <div className="m-auto text-muted">Select a contact</div>
          ) : (
            <>
              {error && <Alert variant="warning">{error}</Alert>}
              <MessageListVertical
                messages={threads[activeId] || []}
                currentUserId={currentUser.id}
                scrollKey={scrollKey}
                loading={loadingThread}
              />
              <div className="border-top p-2 d-flex align-items-center gap-2" style={{ flex: "0 0 auto" }}>
                <Form.Control type="file" size="sm" style={{ maxWidth: 180 }} onChange={(e) => setFile(e.target.files[0] || null)} />
                <InputGroup>
                  <AutoTextarea
                    value={drafts[activeId] || ""}
                    onChange={(v) => setDrafts((p) => ({ ...p, [activeId]: v }))}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder="Type a message"
                  />
                  <Button onClick={handleSend}>Send</Button>
                </InputGroup>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */
function MessageListVertical({ messages = [], currentUserId, scrollKey, loading }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [scrollKey, messages.length]);

  return (
    <div ref={boxRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", background: "#f8f9fa" }}>
      {loading && !messages.length && <Spinner animation="border" size="sm" />}
      {messages.map((m) => {
        const mine = String(m.from) === String(currentUserId);
        const url = m.text || m.content;
        const isFile = m.message_type === "file" || /\.(pdf|doc|xls|zip)$/i.test(url || "");
        const isImage = m.message_type === "image" || /\.(jpg|jpeg|png|gif)$/i.test(url || "");

        return (
          <div key={m.id} className={`d-flex mb-2 ${mine ? "justify-content-end" : "justify-content-start"}`}>
            <div className={`p-2 rounded ${mine ? "bg-primary text-white" : "bg-white border"}`} style={{ maxWidth: "75%" }}>
              {isImage ? (
                <img src={url} alt="attachment" style={{ maxWidth: "100%", borderRadius: 8 }} />
              ) : isFile ? (
                <a href={url} target="_blank" rel="noreferrer" className={mine ? "text-white" : "text-primary"}>
                  {m.meta?.original || url}
                </a>
              ) : (
                <div>{url}</div>
              )}
              <div className="small text-muted text-end">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AutoTextarea({ value, onChange, onKeyDown, placeholder }) {
  const ref = useRef();
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [value]);
  return (
    <Form.Control
      as="textarea"
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      style={{ resize: "none", overflow: "hidden" }}
    />
  );
}

/* ---------- Utils ---------- */
function normalizeMessage(m) {
  const id = m.id ?? (m.tempId != null ? String(m.tempId) : Math.random().toString(36).slice(2));
  const created = new Date(m.createdAt || m.created_at || Date.now()).toISOString();
  return {
    id,
    tempId: m.tempId,
    from: m.from ?? m.sender_id,
    to: m.to ?? m.receiver_id,
    text: m.text ?? m.content ?? "",
    content: m.content,
    createdAt: created,
    message_type: m.message_type,
    meta: m.meta,
  };
}
function isGrouped(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr[0].heading && Array.isArray(arr[0].items);
}
function findNameById(arr, id) {
  const flat = isGrouped(arr) ? arr.flatMap((g) => g.items) : arr;
  return flat.find((c) => String(c.id) === String(id))?.name || "Chat";
}
