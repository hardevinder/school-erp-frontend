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

const Subjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState({ name: "", description: "" });
  const [editingSubject, setEditingSubject] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
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

  // Filtered list
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q)
    );
  }, [subjects, debouncedSearch]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  const openAddModal = () => {
    setEditingSubject(null);
    setNewSubject({ name: "", description: "" });
    setShowModal(true);
  };

  const openEditModal = (subj) => {
    setEditingSubject(subj);
    setNewSubject({
      name: subj.name || "",
      description: subj.description || "",
    });
    setShowModal(true);
  };

  const onModalClose = () => {
    setShowModal(false);
    setEditingSubject(null);
    setNewSubject({ name: "", description: "" });
  };

  const saveSubject = async (e) => {
    e?.preventDefault();
    try {
      const payload = {
        name: newSubject.name.trim(),
        description: newSubject.description.trim(),
      };
      if (!payload.name) {
        return Swal.fire("Validation", "Subject name is required.", "warning");
      }

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
      Swal.fire("Error", "Failed to save subject. Please try again.", "error");
    }
  };

  const deleteSubject = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will permanently delete the subject!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
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

  return (
    <div className="container py-4" style={{ overflowX: "hidden" }}>
      {/* scoped helpers to eliminate horizontal scroll on small screens */}
      <style>{`
        .min-w-0 { min-width: 0 !important; }
        .controls-wrap { flex-wrap: wrap; }
      `}</style>

      {/* Header Card */}
      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex flex-column flex-md-row gap-3 align-items-md-center justify-content-between min-w-0">
            <div className="min-w-0">
              <h1 className="h4 mb-1 text-truncate">Subjects</h1>
              <p className="text-muted mb-0">
                Manage your subjects. Add, edit, search, and remove.
              </p>
            </div>

            {/* Controls */}
            <div className="d-flex controls-wrap gap-2 w-100 w-md-auto">
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
                  placeholder="Search by name or description"
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
      </div>

      {/* Controls Row */}
      <div className="d-flex controls-wrap align-items-md-center justify-content-between mt-3 gap-2">
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

      {/* Loading / Empty */}
      {loading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border" role="status" aria-label="Loading subjects" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card mt-3 border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <div className="mb-2">
              <i className="bi bi-journal-x display-6 text-muted" aria-hidden="true" />
            </div>
            <h5 className="mb-1">No subjects found</h5>
            <p className="text-muted mb-3">
              Try adjusting your search or add a new subject.
            </p>
            <button className="btn btn-primary" onClick={openAddModal}>
              Add Subject
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* TABLE (md and up) */}
          <div className="card mt-3 border-0 shadow-sm d-none d-md-block">
            <div className="table-responsive" style={{ maxHeight: "60vh" }}>
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th style={{ minWidth: 220 }}>Subject Name</th>
                    <th>Description</th>
                    <th style={{ width: 160 }} className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map((subj, idx) => (
                    <tr key={subj.id}>
                      <td>{(safePage - 1) * pageSize + idx + 1}</td>
                      <td className="fw-medium">{subj.name}</td>
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
          <div className="d-md-none mt-3">
            {pageSlice.map((subj, idx) => (
              <div className="card border-0 shadow-sm mb-2" key={subj.id}>
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="min-w-0">
                      <div className="small text-muted">
                        #{(safePage - 1) * pageSize + idx + 1}
                      </div>
                      <h6 className="mb-1 text-truncate">{subj.name}</h6>
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
              <div className="modal-header">
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
                  Save
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
