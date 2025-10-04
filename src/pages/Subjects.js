// File: src/pages/Subjects.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";

/** Debounce utility (no extra libs) */
const useDebouncedValue = (value, delay = 300) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};

const PAGE_SIZES = [5, 10, 20, 50];
const TYPE_OPTIONS = ["Scholastic", "Co-Scholastic"];

/** Tiny helpers */
const cx = (...a) => a.filter(Boolean).join(" ");
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const Badge = ({ type }) => {
  const isCo = type === "Co-Scholastic";
  const cls = `badge rounded-pill ${
    isCo ? "text-bg-secondary" : "text-bg-success"
  }`;
  return (
    <span className={cls} style={{ fontWeight: 500 }}>
      {type}
    </span>
  );
};

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState({
    name: "",
    description: "",
    type: "Scholastic",
  });
  const [editingSubject, setEditingSubject] = useState(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);

  // Filters & sorting
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name"); // name | type
  const [sortDir, setSortDir] = useState("asc"); // asc | desc

  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // pagination
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Fetch subjects
  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.get("/subjects");
      setSubjects(res.data.subjects || res.data || []);
    } catch (err) {
      console.error("Error fetching subjects:", err);
      Swal.fire("Error", "Failed to fetch subjects. Try again later.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let out = subjects;
    if (typeFilter !== "All") {
      out = out.filter((s) => (s.type || "Scholastic") === typeFilter);
    }
    if (q) {
      out = out.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q) ||
          (s.type || "").toLowerCase().includes(q)
      );
    }

    // sort
    out = [...out].sort((a, b) => {
      const av = (a[sortBy] || "").toString().toLowerCase();
      const bv = (b[sortBy] || "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return out;
  }, [subjects, debouncedSearch, typeFilter, sortBy, sortDir]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize, typeFilter]);

  const openAddModal = () => {
    setEditingSubject(null);
    setNewSubject({ name: "", description: "", type: "Scholastic" });
    setShowModal(true);
  };

  const openEditModal = (subj) => {
    setEditingSubject(subj);
    setNewSubject({
      name: subj.name || "",
      description: subj.description || "",
      type: subj.type || "Scholastic",
    });
    setShowModal(true);
  };

  const onModalClose = () => {
    setShowModal(false);
    setEditingSubject(null);
    setNewSubject({ name: "", description: "", type: "Scholastic" });
  };

  const saveSubject = async (e) => {
    e?.preventDefault();

    const payload = {
      name: newSubject.name.trim(),
      description: newSubject.description.trim(),
      type: newSubject.type,
    };

    if (!payload.name) {
      return Swal.fire("Validation", "Subject name is required.", "warning");
    }
    if (!TYPE_OPTIONS.includes(payload.type)) {
      return Swal.fire(
        "Validation",
        "Type must be either 'Scholastic' or 'Co-Scholastic'.",
        "warning"
      );
    }

    try {
      if (editingSubject?.id) {
        await api.put(`/subjects/${editingSubject.id}`, payload);
        Swal.fire("Updated", "Subject has been updated.", "success");
      } else {
        await api.post("/subjects", payload);
        Swal.fire("Added", "Subject has been added.", "success");
      }
      onModalClose();
      fetchSubjects();
    } catch (err) {
      console.error("Error saving subject:", err);
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "Failed to save subject. Please try again.";
      Swal.fire("Error", msg, "error");
    }
  };

  const deleteSubject = async (id) => {
    Swal.fire({
      title: "Delete subject?",
      text: "This will permanently delete the subject.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/subjects/${id}`);
          Swal.fire("Deleted!", "Subject has been removed.", "success");
          fetchSubjects();
        } catch (err) {
          console.error("Error deleting subject:", err);
          Swal.fire("Error", "Failed to delete subject.", "error");
        }
      }
    });
  };

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <i className="bi bi-arrow-down-up ms-1" />;
    return sortDir === "asc" ? (
      <i className="bi bi-sort-alpha-down ms-1" />
    ) : (
      <i className="bi bi-sort-alpha-up ms-1" />
    );
  };

  return (
    <div className="container py-4" style={{ overflowX: "hidden" }}>
      {/* Scoped styles for a cleaner, modern look */}
      <style>{`
        .min-w-0 { min-width: 0 !important; }
        .controls-wrap { flex-wrap: wrap; }
        .shadow-soft { box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
        .card-borderless { border: 0 !important; }
        .glass {
          backdrop-filter: saturate(180%) blur(8px);
        }
        .sticky-toolbar {
          position: sticky;
          top: 0;
          z-index: 5;
        }
        .toolbar-bg {
          background: linear-gradient(135deg, #f6f9ff 0%, #ffffff 100%);
        }
        .chip { 
          border: 1px solid rgba(0,0,0,0.08);
          transition: all .15s ease;
        }
        .chip.active, .chip:hover { 
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.08);
        }
        .table-hover tbody tr:hover {
          background: #f9fbff;
        }
        .skeleton {
          position: relative; overflow: hidden; background: #eef1f6; border-radius: .5rem;
        }
        .skeleton::after {
          content: ""; position: absolute; inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
          animation: shimmer 1.2s infinite;
        }
        @keyframes shimmer { 100% { transform: translateX(100%);} }
      `}</style>

      {/* Header / Toolbar */}
      <div className="sticky-toolbar mb-3">
        <div className="card shadow-soft card-borderless glass toolbar-bg">
          <div className="card-body">
            <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between min-w-0">
              <div className="min-w-0">
                <h1 className="h4 mb-1 text-truncate">
                  <i className="bi bi-journal-text me-2" aria-hidden="true" />
                  Subjects
                </h1>
                <p className="text-muted mb-0">
                  Create, categorize, search, and manage subject records.
                </p>
              </div>

              {/* Controls */}
              <div className="d-flex controls-wrap gap-2 w-100 w-md-auto">
                {/* Type Filter Pills (md+) */}
                <div className="d-none d-lg-flex align-items-center gap-2">
                  <span className="small text-muted">Type:</span>
                  {["All", ...TYPE_OPTIONS].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={cx(
                        "btn btn-sm chip",
                        "rounded-pill px-3",
                        typeFilter === t ? "btn-light active" : "btn-white bg-white"
                      )}
                      onClick={() => setTypeFilter(t)}
                      aria-pressed={typeFilter === t}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {/* Type Filter Select (sm) */}
                <div className="input-group d-lg-none" style={{ maxWidth: 220 }}>
                  <span className="input-group-text">
                    <i className="bi bi-tags" aria-hidden="true" />
                  </span>
                  <select
                    aria-label="Filter by type"
                    className="form-select"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    {["All", ...TYPE_OPTIONS].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div
                  className="input-group flex-grow-1 min-w-0"
                  role="search"
                  aria-label="Search subjects"
                >
                  <span className="input-group-text">
                    <i className="bi bi-search" aria-hidden="true" />
                  </span>
                  <input
                    className="form-control w-100"
                    placeholder="Search by name, description, or type"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      className="btn btn-outline-secondary"
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  )}
                </div>

                <button className="btn btn-primary flex-shrink-0" onClick={openAddModal}>
                  <i className="bi bi-plus-lg me-1" />
                  <span className="d-none d-sm-inline">Add Subject</span>
                  <span className="d-sm-none">Add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Secondary controls row */}
          <div className="card-footer bg-transparent">
            <div className="d-flex controls-wrap align-items-center justify-content-between gap-2">
              <div className="text-muted small">
                Showing{" "}
                <strong>
                  {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-
                  {Math.min(safePage * pageSize, filtered.length)}
                </strong>{" "}
                of <strong>{filtered.length}</strong>
              </div>

              <div className="d-flex align-items-center gap-2">
                <label className="small text-muted mb-0">Rows</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 90 }}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>

                <nav aria-label="Subjects pagination">
                  <ul className="pagination pagination-sm mb-0 flex-wrap">
                    <li className={`page-item ${safePage <= 1 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(1)}
                        aria-label="First page"
                      >
                        «
                      </button>
                    </li>
                    <li className={`page-item ${safePage <= 1 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-label="Previous page"
                      >
                        ‹
                      </button>
                    </li>
                    <li className="page-item disabled d-none d-sm-block">
                      <span className="page-link">
                        Page {safePage} / {totalPages}
                      </span>
                    </li>
                    <li className={`page-item ${safePage >= totalPages ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-label="Next page"
                      >
                        ›
                      </button>
                    </li>
                    <li className={`page-item ${safePage >= totalPages ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage(totalPages)}
                        aria-label="Last page"
                      >
                        »
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading / Empty / Table */}
      {loading ? (
        <div className="card card-borderless shadow-soft">
          <div className="card-body">
            {/* Skeleton table */}
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    {["#", "Subject Name", "Type", "Description", "Actions"].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.min(pageSize, 6) }).map((_, i) => (
                    <tr key={i}>
                      <td style={{ width: 60 }}>
                        <div className="skeleton" style={{ height: 14, width: 24 }} />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: 14, width: "50%" }} />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: 20, width: 110 }} />
                      </td>
                      <td>
                        <div className="skeleton" style={{ height: 14, width: "80%" }} />
                      </td>
                      <td style={{ width: 200 }}>
                        <div className="skeleton" style={{ height: 30, width: 140 }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card mt-2 card-borderless shadow-soft">
          <div className="card-body text-center py-5">
            <div className="mb-2">
              <i className="bi bi-journal-x display-6 text-muted" aria-hidden="true" />
            </div>
            <h5 className="mb-1">No subjects found</h5>
            <p className="text-muted mb-3">
              Try adjusting filters or add a new subject.
            </p>
            <button className="btn btn-primary" onClick={openAddModal}>
              Add Subject
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TABLE (md and up) */}
          <div className="card mt-2 card-borderless shadow-soft d-none d-md-block">
            <div className="table-responsive" style={{ maxHeight: "60vh" }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th
                      style={{ minWidth: 220, cursor: "pointer" }}
                      onClick={() => toggleSort("name")}
                    >
                      Subject Name <SortIcon col="name" />
                    </th>
                    <th
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleSort("type")}
                    >
                      Type <SortIcon col="type" />
                    </th>
                    <th>Description</th>
                    <th style={{ width: 200 }} className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map((subj, idx) => (
                    <tr key={subj.id}>
                      <td>{(safePage - 1) * pageSize + idx + 1}</td>
                      <td className="fw-medium">{subj.name}</td>
                      <td>
                        <Badge type={subj.type || "Scholastic"} />
                      </td>
                      <td className="text-muted text-break">
                        {subj.description || "—"}
                      </td>
                      <td className="text-end">
                        <div className="btn-group">
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => openEditModal(subj)}
                          >
                            <i className="bi bi-pencil-square me-1" />
                            Edit
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => deleteSubject(subj.id)}
                          >
                            <i className="bi bi-trash me-1" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CARD LIST (mobile) */}
          <div className="d-md-none mt-2">
            {pageSlice.map((subj, idx) => (
              <div className="card card-borderless shadow-soft mb-2" key={subj.id}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="min-w-0">
                      <div className="small text-muted">
                        #{(safePage - 1) * pageSize + idx + 1}
                      </div>
                      <h6 className="mb-1 text-truncate">{subj.name}</h6>
                      <div className="mb-2">
                        <Badge type={subj.type || "Scholastic"} />
                      </div>
                      <p className="mb-2 text-muted text-break">
                        {subj.description || "—"}
                      </p>
                    </div>
                    <div className="btn-group flex-shrink-0">
                      <button
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => openEditModal(subj)}
                        aria-label={`Edit ${subj.name}`}
                      >
                        <i className="bi bi-pencil-square" />
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => deleteSubject(subj.id)}
                        aria-label={`Delete ${subj.name}`}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="modal-dialog modal-dialog-centered modal-fullscreen-sm-down">
            <form className="modal-content" onSubmit={saveSubject}>
              <div
                className="modal-header"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(13,110,253,.1), rgba(25,135,84,.1))",
                }}
              >
                <h5 className="modal-title">
                  {editingSubject ? "Edit Subject" : "Add Subject"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={onModalClose}
                  aria-label="Close"
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">
                    Subject Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Mathematics"
                    value={newSubject.name}
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, name: e.target.value })
                    }
                    autoFocus
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={newSubject.type}
                    onChange={(e) =>
                      setNewSubject({ ...newSubject, type: e.target.value })
                    }
                    required
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <div className="form-text">
                    Choose whether the subject is Scholastic or Co-Scholastic.
                  </div>
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Optional description"
                    rows={3}
                    value={newSubject.description}
                    onChange={(e) =>
                      setNewSubject({
                        ...newSubject,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onModalClose}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSubject ? "Save Changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subjects;
  