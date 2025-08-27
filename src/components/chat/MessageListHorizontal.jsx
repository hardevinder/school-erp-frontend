import React, { useEffect, useMemo, useRef } from "react";

/**
 * messages: [{ id, text, authorId, createdAt }]
 * currentUserId: string
 * Assumes messages are either unsorted or ascending by createdAt.
 * We will sort ascending and place the newest at the RIGHT end.
 */
export default function MessageListHorizontal({ messages = [], currentUserId }) {
  const containerRef = useRef(null);

  // Ensure strict ascending order (oldest -> newest)
  const ordered = useMemo(() => {
    const copy = [...messages];
    copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return copy;
  }, [messages]);

  // Always scroll to the rightmost (newest) message when messages change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // let the DOM paint first
    requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth; // jump to newest on the right
    });
  }, [ordered.length]);

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-end",
        overflowX: "auto",
        overflowY: "hidden",
        whiteSpace: "nowrap",        // prevent wrapping
        padding: "10px 12px",
        borderTop: "1px solid #eee",
        minHeight: 120,              // visible height of the strip
        maxHeight: 160,
        // optional: smooth track
        scrollbarWidth: "thin",
      }}
      aria-label="Conversation (scroll left for older messages)"
    >
      {ordered.map((m) => {
        const mine = String(m.authorId) === String(currentUserId);
        return (
          <div
            key={m.id}
            style={{
              display: "inline-flex",
              flexDirection: "column",
              maxWidth: 280,
              minWidth: 120,
              whiteSpace: "normal", // allow text wrap inside the bubble
              wordBreak: "break-word",
            }}
          >
            <div
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                padding: "8px 10px",
                borderRadius: 12,
                background: mine ? "#e6f0ff" : "#f5f5f5",
                boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
              }}
            >
              {m.text}
            </div>
            <div
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                fontSize: 11,
                opacity: 0.6,
                marginTop: 4,
              }}
              title={new Date(m.createdAt).toLocaleString()}
            >
              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
