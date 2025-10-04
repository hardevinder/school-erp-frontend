// src/pages/StudentAssignments.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import socket from "../socket"; // adjust path as needed

const API_URL = process.env.REACT_APP_API_URL || "";

const STATUS_VARIANTS = {
  pending: "warning",
  submitted: "primary",
  graded: "success",
  overdue: "danger",
  unknown: "secondary",
};

// Try to derive a YouTube embed URL from a pasted link
const getYouTubeEmbed = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Handles youtu.be/<id> and youtube.com/watch?v=<id>
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.replace("/", "")}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
    }
  } catch {
    // ignore parse errors
  }
  return null;
};

const formatDate = (d) => {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return "N/A";
  }
};

const isOverdue = (due) => {
  if (!due) return false;
  const dueTime = new Date(due).setHours(23, 59, 59, 999);
  const now = Date.now();
  return now > dueTime;
};

const getStatusBadge = (statusRaw, dueDate) => {
  const status = (statusRaw || "").toLowerCase();
  let variant = STATUS_VARIANTS[status] || STATUS_VARIANTS.unknown;
  let label = statusRaw || "Unknown";

  // If not submitted/graded and due is past, mark overdue
  if (!["submitted", "graded"].includes(status) && isOverdue(dueDate)) {
    variant = STATUS_VARIANTS.overdue;
    label = "Overdue";
  }

  return (
    <span className={`badge bg-${variant}`} style={{ fontSize: "0.8rem" }}>
      {label}
    </span>
  );
};

const SkeletonCard = () => (
  <div className="col-md-6 col-lg-4 mb-4">
    <div className="card shadow-sm h-100">
      <div className="card-body">
        <div className="placeholder-glow">
          <span className="placeholder col-8 mb-2"></span>
          <span className="placeholder col-12 mb-3"></span>
          <span className="placeholder col-10 mb-2"></span>
          <span className="placeholder col-6"></span>
        </div>
      </div>
    </div>
  </div>
);

const StudentAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated"); // 'updated' | 'due'
  const [sortDir, setSortDir] = useState("desc"); // 'asc' | 'desc'

  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const token = localStorage.getItem("token");
  const abortRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAssignments = async () => {
    if (!API_URL) {
      setError("API URL is not configured. Please set REACT_APP_API_URL.");
      setLoading(false);
      return;
    }
    if (!token) {
      setError("You are not logged in. Please log in to view assignments.");
      setLoading(false);
      return;
    }

    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    try {
      if (!loading) setIsRefreshing(true);
      const res = await axios.get(`${API_URL}/student-assignments/student`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortRef.current.signal,
      });
      const list = res?.data?.assignments || [];
      setAssignments(Array.isArray(list) ? list : []);
      setError(null);
      setLastSyncedAt(new Date());
    } catch (err) {
      if (axios.isCancel(err) || err.name === "CanceledError") return;
      console.error(err);
      setError(err?.response?.data?.message || "Error fetching assignments");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    // Cleanup on unmount: cancel request
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    // Real-time updates
    const onAssigned = () => {
      console.log("assignmentAssigned event received");
      fetchAssignments();
    };
    const onUpdated = () => {
      console.log("assignmentUpdated event received");
      fetchAssignments();
    };
    const onDeleted = () => {
      console.log("assignmentDeleted event received");
      fetchAssignments();
    };

    socket.on("assignmentAssigned", onAssigned);
    socket.on("assignmentUpdated", onUpdated);
    socket.on("assignmentDeleted", onDeleted);

    return () => {
      socket.off("assignmentAssigned", onAssigned);
      socket.off("assignmentUpdated", onUpdated);
      socket.off("assignmentDeleted", onDeleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(searchText);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => clearTimeout(t);
  }, [searchText]);

  const filteredSorted = useMemo(() => {
    const s = (debouncedSearch || "").toLowerCase();

    const bySearch = (a) => {
      const title = (a?.title || "").toLowerCase();
      const content = (a?.content || "").toLowerCase();
      return title.includes(s) || content.includes(s);
    };

    const byStatus = (a) => {
      if (statusFilter === "all") return true;
      const sa = a?.StudentAssignments?.[0];
      const status = (sa?.status || "").toLowerCase();
      if (statusFilter === "overdue") return isOverdue(sa?.dueDate) && !["submitted", "graded"].includes(status);
      return status === statusFilter;
    };

    const list = (assignments || []).filter((a) => bySearch(a) && byStatus(a));

    const compare = (a, b) => {
      const sa = a?.StudentAssignments?.[0] || {};
      const sb = b?.StudentAssignments?.[0] || {};

      let av, bv;
      if (sortBy === "due") {
        av = sa?.dueDate ? new Date(sa.dueDate).getTime() : 0;
        bv = sb?.dueDate ? new Date(sb.dueDate).getTime() : 0;
      } else {
        // updated
        av = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        bv = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      }

      const diff = av - bv;
      return sortDir === "asc" ? diff : -diff;
    };

    return list.sort(compare);
  }, [assignments, debouncedSearch, statusFilter, sortBy, sortDir]);

  const stats = useMemo(() => {
    let total = assignments.length;
    let submitted = 0;
    let graded = 0;
    let overdue = 0;

    assignments.forEach((a) => {
      const sa = a?.StudentAssignments?.[0];
      const status = (sa?.status || "").toLowerCase();
      if (status === "submitted") submitted += 1;
      if (status === "graded") graded += 1;
      if (!["submitted", "graded"].includes(status) && isOverdue(sa?.dueDate)) overdue += 1;
    });

    return { total, submitted, graded, overdue };
  }, [assignments]);

  return (
    <div className="container py-4">
      {/* Bluish header bar */}
      <div
        className="rounded-3 p-4 mb-4 text-white"
        style={{
          background:
            "linear-gradient(135deg, rgba(22,82,240,1) 0%, rgba(12,119,214,1) 50%, rgba(6,95,212,1) 100%)",
        }}
      >
        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
          <div>
            <h1 className="h3 mb-1">Your Assignments</h1>
            <div className="opacity-75">
              {lastSyncedAt ? `Last synced: ${lastSyncedAt.toLocaleTimeString()}` : "Syncing…"}
            </div>
          </div>

          <div className="d-flex gap-2 flex-wrap">
            <span className="badge bg-light text-dark">Total: {stats.total}</span>
            <span className="badge bg-primary">Submitted: {stats.submitted}</span>
            <span className="badge bg-success">Graded: {stats.graded}</span>
            <span className="badge bg-danger">Overdue: {stats.overdue}</span>

            <button
              className="btn btn-light btn-sm"
              onClick={fetchAssignments}
              disabled={isRefreshing}
              title="Refresh"
            >
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by title or content…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="col-6 col-md-3">
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="col-6 col-md-3 d-flex gap-2">
          <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="updated">Sort: Updated</option>
            <option value="due">Sort: Due Date</option>
          </select>
          <button
            className="btn btn-outline-secondary"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="row">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="alert alert-danger text-center" role="alert">
          {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredSorted.length === 0 && (
        <div className="text-center py-5">
          <h5 className="mb-2">No assignments found</h5>
          <p className="text-muted mb-3">Try adjusting your search or filters.</p>
          <button className="btn btn-primary" onClick={fetchAssignments}>
            Reload
          </button>
        </div>
      )}

      {/* List */}
      <div className="row">
        {filteredSorted.map((assignment) => {
          const {
            id,
            title,
            content,
            createdAt,
            updatedAt,
            youtubeUrl,
            AssignmentFiles = [],
          } = assignment || {};

          const sa = assignment?.StudentAssignments?.[0] || {};
          const due = sa?.dueDate;
          const embed = getYouTubeEmbed(youtubeUrl);

          return (
            <div key={id} className="col-md-6 col-lg-4 mb-4">
              <div className="card shadow-sm h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <h2 className="h5 mb-0">{title || "Untitled"}</h2>
                    {getStatusBadge(sa?.status, due)}
                  </div>

                  <p className="text-muted mb-2">
                    Created: {formatDate(createdAt)} · Updated: {formatDate(updatedAt)}
                  </p>

                  {embed ? (
                    <div className="ratio ratio-16x9 mb-3">
                      <iframe
                        src={embed}
                        title="YouTube video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : youtubeUrl ? (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline-primary btn-sm mb-3"
                    >
                      Watch Video Explanation
                    </a>
                  ) : null}

                  <div className="mb-3" style={{ whiteSpace: "pre-wrap" }}>
                    {content || "No description provided."}
                  </div>

                  <div className="mt-auto">
                    <div className="d-flex flex-column gap-1 mb-2">
                      <div className={isOverdue(due) && !["submitted", "graded"].includes((sa?.status || "").toLowerCase())
                        ? "text-danger"
                        : "text-body"
                      }>
                        <strong>Due:</strong> {due ? formatDate(due) : "N/A"}
                      </div>
                      <div>
                        <strong>Status:</strong> {sa?.status || "Unknown"}
                      </div>
                      <div>
                        <strong>Grade:</strong>{" "}
                        {sa?.grade !== null && sa?.grade !== undefined ? sa.grade : "Not graded yet"}
                      </div>
                      <div>
                        <strong>Remarks:</strong> {sa?.remarks || "No remarks available yet"}
                      </div>
                    </div>

                    {Array.isArray(AssignmentFiles) && AssignmentFiles.length > 0 && (
                      <div className="mt-2">
                        <h6 className="mb-2">Attached Files</h6>
                        <ul className="list-unstyled mb-0">
                          {AssignmentFiles.map((file) => (
                            <li key={file?.id} className="mb-1">
                              <a
                                href={file?.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="link-primary"
                              >
                                {file?.fileName || "Download"}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentAssignments;
