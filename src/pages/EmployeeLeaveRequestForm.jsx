import React, { useState, useEffect } from "react";
import api from "../api";
import Swal from "sweetalert2";

export default function EmployeeLeaveRequests() {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
    is_without_pay: false,
  });

  useEffect(() => {
    fetchLeaveTypes();
    fetchRequests();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const res = await api.get("/employee-leave-types");
      setLeaveTypes(res.data.data || []);
    } catch {
      Swal.fire("Error", "Couldn’t load leave types.", "error");
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await api.get("/employee-leave-requests");
      setRequests(res.data.data || []);
    } catch {
      Swal.fire("Error", "Couldn’t load your requests.", "error");
    }
  };

  const openModal = (req = null) => {
    if (req) {
      setEditingId(req.id);
      setForm({
        leave_type_id: req.leave_type_id,
        start_date: req.start_date,
        end_date: req.end_date,
        reason: req.reason || "",
        is_without_pay: req.is_without_pay || false,
      });
    } else {
      setEditingId(null);
      setForm({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
        is_without_pay: false,
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setForm({
      leave_type_id: "",
      start_date: "",
      end_date: "",
      reason: "",
      is_without_pay: false,
    });
    setEditingId(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? checked : value,
    }));
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
      fetchRequests();
      closeModal();
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Operation failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = requests.reduce(
    (acc, r) => {
      (acc[r.status] ||= []).push(r);
      return acc;
    },
    { pending: [], approved: [], rejected: [] }
  );

  return (
    <div className="container my-4">
      <h3>My Leave Requests</h3>
      <button className="btn btn-success mb-3" onClick={() => openModal()}>
        + New Request
      </button>

      {modalOpen && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleSubmit}>
              <div className="modal-header">
                <h5 className="modal-title">{editingId ? "Edit Request" : "New Request"}</h5>
                <button type="button" className="btn-close" onClick={closeModal} disabled={submitting} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Leave Type *</label>
                  <select
                    className="form-select"
                    name="leave_type_id"
                    value={form.leave_type_id}
                    onChange={handleChange}
                    disabled={submitting}
                    required
                  >
                    <option value="">-- select --</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
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
                  <div className="col-md-6 mb-3">
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
                </div>
                <div className="mb-3">
                  <label className="form-label">Reason</label>
                  <textarea
                    className="form-control"
                    name="reason"
                    rows="2"
                    value={form.reason}
                    onChange={handleChange}
                    disabled={submitting}
                  ></textarea>
                </div>
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="lwp"
                    name="is_without_pay"
                    checked={form.is_without_pay}
                    onChange={handleChange}
                    disabled={submitting}
                  />
                  <label className="form-check-label" htmlFor="lwp">
                    Without Pay
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingId ? "Update" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {['pending', 'approved', 'rejected'].map((status) => (
        <div key={status} className="mb-5">
          <h5 className="text-capitalize">{status} Requests</h5>
          {grouped[status].length === 0 ? (
            <p className="text-muted">No {status} requests.</p>
          ) : (
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Without Pay</th>
                  <th>Status</th>
                  {status === "pending" && <th>Edit</th>}
                </tr>
              </thead>
              <tbody>
                {grouped[status].map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{leaveTypes.find((lt) => lt.id === r.leave_type_id)?.name || "-"}</td>
                    <td>
                      {r.start_date} ↔ {r.end_date}
                    </td>
                    <td>{r.reason || "—"}</td>
                    <td>{r.is_without_pay ? "Yes" : "No"}</td>
                    <td>
                      <span
                        className={`badge ${
                          status === "approved"
                            ? "bg-success"
                            : status === "rejected"
                            ? "bg-danger"
                            : "bg-warning text-dark"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    {status === "pending" && (
                      <td>
                        <button className="btn btn-sm btn-outline-primary" onClick={() => openModal(r)}>
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
