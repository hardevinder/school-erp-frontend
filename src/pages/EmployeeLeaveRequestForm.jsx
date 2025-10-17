import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import api from "../api";
import Swal from "sweetalert2";

/**
 * EmployeeLeaveRequests — self‑service leave request UI
 *
 * "Accordingly" aligned with your MarkAttendance patterns:
 * - Uses the shared `api` instance (no per‑call auth args; rely on axios interceptor)
 * - Pretty header with quick stats & CTA
 * - Filter by type + date range + text search
 * - Tabbed view: Pending / Approved / Rejected
 * - Clean modal for create/edit; guards + nice empty states
 * - Loading skeletons + clear error messages (401 shows friendly prompt)
 */
export default function EmployeeLeaveRequests() {
  // ---- data ----
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requests, setRequests] = useState([]);

  // ---- ui state ----
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");

  // ---- filters ----
  const [filters, setFilters] = useState({
    type: "all",
    q: "",
    from: "",
    to: "",
  });

  const [form, setForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    is_without_pay: false,
  });

  // ---- load ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [ltRes, reqRes] = await Promise.all([
          api.get("/employee-leave-types"),
          api.get("/employee-leave-requests"),
        ]);
        if (!mounted) return;
        setLeaveTypes(ltRes.data?.data || []);
        setRequests((reqRes.data?.data || []).sort(sortByDateDesc));
      } catch (err) {
        console.error("init load error", err?.response || err);
        const status = err?.response?.status;
        const msg =
          status === 401
            ? "You are not signed in. Please login again."
            : err?.response?.data?.error || err?.response?.data?.message || "Failed to load";
        Swal.fire("Error", msg, "error");
      } finally {
        setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  // ---- helpers ----
  const sortByDateDesc = (a, b) => new Date(b.createdAt || b.start_date) - new Date(a.createdAt || a.start_date);

  const resetForm = () => {
    setForm({
      leave_type_id: "",
      start_date: "",
      end_date: "",
      reason: "",
      is_without_pay: false,
    });
  };

  const openModal = (req = null) => {
    if (req) {
      setEditingId(req.id);
      setForm({
        leave_type_id: req.leave_type_id,
        start_date: req.start_date,
        end_date: req.end_date,
        reason: req.reason || "",
        is_without_pay: !!req.is_without_pay,
      });
    } else {
      setEditingId(null);
      resetForm();
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    resetForm();
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { leave_type_id, start_date, end_date } = form;
    if (!leave_type_id || !start_date || !end_date) {
      return Swal.fire("Missing fields", "Please complete all required fields.", "warning");
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/employee-leave-requests/${editingId}`, form);
        Swal.fire("Updated", "Your leave request has been updated.", "success");
      } else {
        await api.post("/employee-leave-requests", form);
        Swal.fire("Submitted", "Your leave request has been sent.", "success");
      }
      // Reload
      const res = await api.get("/employee-leave-requests");
      setRequests((res.data?.data || []).sort(sortByDateDesc));
      setActiveTab("pending");
      closeModal();
    } catch (err) {
      console.error("submit error", err?.response || err);
      const status = err?.response?.status;
      const msg =
        status === 401
          ? "Your session has expired. Please login again."
          : err?.response?.data?.error || err?.response?.data?.message || "Operation failed.";
      Swal.fire("Error", msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- derived ----
  const byStatus = useMemo(() => {
    const base = { pending: [], approved: [], rejected: [] };
    for (const r of requests) {
      (base[r.status] ||= []).push(r);
    }
    return base;
  }, [requests]);

  const filtered = useMemo(() => {
    const { type, q, from, to } = filters;
    const qNorm = q.trim().toLowerCase();
    const inRange = (d) => {
      if (!from && !to) return true;
      const x = new Date(d);
      if (from && x < new Date(from)) return false;
      if (to && x > new Date(to)) return false;
      return true;
    };
    const matchType = (ltId) => (type === "all" ? true : String(ltId) === String(type));

    const enrich = (r) => ({
      ...r,
      _type: leaveTypes.find((lt) => lt.id === r.leave_type_id)?.name || "—",
    });

    return {
      pending: (byStatus.pending || []).map(enrich).filter((r) => matchType(r.leave_type_id) && inRange(r.start_date) && (!qNorm || (r._type + " " + (r.reason || "")).toLowerCase().includes(qNorm))),
      approved: (byStatus.approved || []).map(enrich).filter((r) => matchType(r.leave_type_id) && inRange(r.start_date) && (!qNorm || (r._type + " " + (r.reason || "")).toLowerCase().includes(qNorm))),
      rejected: (byStatus.rejected || []).map(enrich).filter((r) => matchType(r.leave_type_id) && inRange(r.start_date) && (!qNorm || (r._type + " " + (r.reason || "")).toLowerCase().includes(qNorm))),
    };
  }, [byStatus, leaveTypes, filters]);

  const counts = useMemo(() => ({
    total: requests.length,
    pending: byStatus.pending.length,
    approved: byStatus.approved.length,
    rejected: byStatus.rejected.length,
  }), [requests, byStatus]);

  // ---- ui parts ----
  const StatusPill = ({ status }) => (
    <span className={`badge rounded-pill ${
      status === "approved" ? "bg-success" : status === "rejected" ? "bg-danger" : "bg-warning text-dark"
    }`}>
      {status}
    </span>
  );

  const TypePill = ({ name }) => (
    <span className="badge bg-light text-dark border" title={name}>
      {name}
    </span>
  );

  const SkeletonRow = () => (
    <tr>
      <td colSpan={7}>
        <div className="placeholder-glow py-2">
          <span className="placeholder col-1 me-2"></span>
          <span className="placeholder col-2 me-2"></span>
          <span className="placeholder col-3 me-2"></span>
          <span className="placeholder col-4"></span>
        </div>
      </td>
    </tr>
  );

  // ---- render ----
  return (
    <div className="container my-4">
      {/* Header card */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
          <div>
            <h3 className="mb-1">My Leave Requests</h3>
            <div className="text-muted">Create, track and edit your leave requests</div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <div className="text-center">
              <div className="fw-bold fs-4">{counts.total}</div>
              <div className="text-muted small">Total</div>
            </div>
            <div className="vr" />
            <div className="text-center">
              <div className="fw-bold fs-5 text-warning">{counts.pending}</div>
              <div className="text-muted small">Pending</div>
            </div>
            <div className="text-center">
              <div className="fw-bold fs-5 text-success">{counts.approved}</div>
              <div className="text-muted small">Approved</div>
            </div>
            <div className="text-center">
              <div className="fw-bold fs-5 text-danger">{counts.rejected}</div>
              <div className="text-muted small">Rejected</div>
            </div>
            <button className="btn btn-primary ms-md-3" onClick={() => openModal()}>
              + New Request
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body row g-3">
          <div className="col-md-3">
            <label className="form-label">Leave Type</label>
            <select
              className="form-select"
              value={filters.type}
              onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="all">All types</option>
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>{lt.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div className="col-md-3">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div className="col-md-3">
            <label className="form-label">Search</label>
            <input
              className="form-control"
              placeholder="Type or reason…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-pills mb-3">
        {(["pending", "approved", "rejected"]).map((s) => (
          <li className="nav-item" key={s}>
            <button
              className={`nav-link ${activeTab === s ? "active" : ""}`}
              onClick={() => setActiveTab(s)}
            >
              <span className="me-2"><StatusPill status={s} /></span>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({filtered[s].length})
            </button>
          </li>
        ))}
      </ul>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Reason</th>
                <th>Without Pay</th>
                <th>Status</th>
                {activeTab === "pending" && <th style={{ width: 90 }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered[activeTab].length === 0 ? (
                <tr>
                  <td colSpan={activeTab === "pending" ? 7 : 6}>
                    <div className="text-center py-4 text-muted">
                      No {activeTab} requests match the current filters.
                    </div>
                  </td>
                </tr>
              ) : (
                filtered[activeTab].map((r, i) => (
                  <tr key={r.id}>
                    <td className="text-muted">{i + 1}</td>
                    <td><TypePill name={r._type} /></td>
                    <td>
                      <div className="fw-semibold">{r.start_date} → {r.end_date}</div>
                      <div className="text-muted small">Submitted {moment(r.createdAt).format("ll")}</div>
                    </td>
                    <td>{r.reason || "—"}</td>
                    <td>{r.is_without_pay ? "Yes" : "No"}</td>
                    <td><StatusPill status={r.status} /></td>
                    {activeTab === "pending" && (
                      <td>
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openModal(r)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <form className="modal-content" onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">{editingId ? "Edit Request" : "New Request"}</h5>
                <button type="button" className="btn-close" onClick={closeModal} disabled={submitting} />
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Leave Type *</label>
                    <select
                      className="form-select"
                      name="leave_type_id"
                      value={form.leave_type_id}
                      onChange={handleChange}
                      disabled={submitting}
                      required
                    >
                      <option value="">— select —</option>
                      {leaveTypes.map((lt) => (
                        <option key={lt.id} value={lt.id}>{lt.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      name="start_date"
                      value={form.start_date}
                      onChange={handleChange}
                      disabled={submitting}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      name="end_date"
                      value={form.end_date}
                      onChange={handleChange}
                      disabled={submitting || !form.start_date}
                      min={form.start_date || ""}
                      required
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Reason</label>
                    <textarea
                      className="form-control"
                      name="reason"
                      rows="3"
                      value={form.reason}
                      onChange={handleChange}
                      disabled={submitting}
                      placeholder="Add a short reason"
                    />
                  </div>
                  <div className="col-12 form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="lwp"
                      name="is_without_pay"
                      checked={form.is_without_pay}
                      onChange={handleChange}
                      disabled={submitting}
                    />
                    <label className="form-check-label" htmlFor="lwp">Without Pay</label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving…" : editingId ? "Update" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
