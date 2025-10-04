// src/pages/DiaryDetail.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "";

const TYPE_BADGE = {
  HOMEWORK: "primary",
  REMARK: "warning",
  ANNOUNCEMENT: "info",
};

const formatDate = (d) => {
  if (!d) return "N/A";
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "N/A";
  }
};

const formatDateTime = (d) => {
  if (!d) return "N/A";
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
  } catch {
    return "N/A";
  }
};

export default function DiaryDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [diary, setDiary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ackMessage, setAckMessage] = useState("");

  const token = localStorage.getItem("token");
  const abortRef = useRef(null);

  const fetchDiary = async () => {
    if (!API_URL) {
      setError("API URL is not configured. Please set REACT_APP_API_URL.");
      setLoading(false);
      return;
    }
    if (!token) {
      setError("You are not logged in. Please log in to view diary details.");
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/diaries/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal,
      });
      setDiary(res?.data?.diary || null);
      setError(null);
    } catch (e) {
      const code = e?.response?.status;
      if (code === 403) {
        alert("This diary is not targeted to you.");
        nav(-1);
        return;
      }
      setError(e?.response?.data?.error || "Failed to load diary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiary();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const onAcknowledge = async () => {
    if (!API_URL || !token) return;
    try {
      setAckLoading(true);
      const res = await axios.post(`${API_URL}/diaries/${id}/ack`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAckMessage(res?.data?.message || "Acknowledged.");
      // light refresh to update counts / button state
      await fetchDiary();
    } catch (e) {
      setAckMessage(e?.response?.data?.error || "Failed to acknowledge.");
    } finally {
      setAckLoading(false);
    }
  };

  const isAcknowledgedByMe = (() => {
    // On /student/feed we get acknowledgements filtered to the current student (0/1).
    // On /diaries/:id we may get all acks. We can’t reliably know which is “me”
    // without studentId, so we consider “already acknowledged” after a success.
    // As a heuristic, if ackMessage says "Already acknowledged.", disable the button.
    return ackMessage.toLowerCase().includes("already");
  })();

  const attachments = diary?.attachments || [];
  const views = diary?.views || []; // may be all-time views
  const acks = diary?.acknowledgements || [];

  const badgeVariant = TYPE_BADGE[diary?.type] || "secondary";
  const isTargeted = Array.isArray(diary?.recipients) && diary.recipients.length > 0;

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-2 align-items-center">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => nav(-1)}>
            ← Back
          </button>
          <Link to="/student-diary" className="btn btn-outline-secondary btn-sm">
            Diary Feed
          </Link>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm" onClick={() => window.print()}>
            Print
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                alert("Link copied!");
              } catch {
                alert("Copy failed. You can copy from the address bar.");
              }
            }}
          >
            Share Link
          </button>
        </div>
      </div>

      {loading && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="placeholder-glow">
              <div className="placeholder col-6 mb-2"></div>
              <div className="placeholder col-12 mb-3"></div>
              <div className="placeholder col-4"></div>
            </div>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && diary && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div>
                <h1 className="h4 mb-2">{diary.title || "Untitled"}</h1>
                <div className="text-muted">
                  Date: {formatDate(diary.date)} · Created: {formatDateTime(diary.createdAt)} ·
                  Updated: {formatDateTime(diary.updatedAt)}
                </div>
              </div>
              <div className="text-end">
                <span className={`badge bg-${badgeVariant} me-2`}>{diary.type || "NOTE"}</span>
                {isTargeted && <span className="badge bg-dark">Targeted</span>}
              </div>
            </div>

            {/* Chips */}
            <div className="d-flex flex-wrap gap-2 mt-3">
              {diary.class?.class_name && (
                <span className="badge bg-light text-dark">Class {diary.class.class_name}</span>
              )}
              {diary.section?.section_name && (
                <span className="badge bg-light text-dark">Sec {diary.section.section_name}</span>
              )}
              {diary.subject?.name && (
                <span className="badge bg-light text-dark">{diary.subject.name}</span>
              )}
              <span className="badge bg-success">
                Acks: {Array.isArray(acks) ? acks.length : 0}
              </span>
              <span className="badge bg-secondary">
                Seen: {Array.isArray(views) ? views.length : 0}
              </span>
              {diary.isActive === false && <span className="badge bg-danger">Archived</span>}
            </div>

            {/* Content */}
            <div className="mt-4" style={{ whiteSpace: "pre-wrap" }}>
              {diary.content || "No content provided."}
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="mt-4">
                <h5 className="h6">Attachments</h5>
                <ul className="list-unstyled mb-0">
                  {attachments.map((a) => (
                    <li key={a?.id || a?.url} className="mb-1">
                      <a
                        href={a?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-primary"
                      >
                        {a?.name || a?.url || "Download"}
                      </a>{" "}
                      {a?.kind && <span className="text-muted">({a.kind})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Acknowledge */}
            <div className="d-flex align-items-center gap-3 mt-4">
              <button
                className={`btn btn-${isAcknowledgedByMe ? "secondary" : "success"}`}
                onClick={onAcknowledge}
                disabled={ackLoading || isAcknowledgedByMe}
                title={isAcknowledgedByMe ? "Already acknowledged" : "Mark as read/acknowledged"}
              >
                {ackLoading ? "Acknowledging…" : isAcknowledgedByMe ? "Acknowledged" : "Acknowledge"}
              </button>
              {ackMessage && <span className="text-muted">{ackMessage}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
