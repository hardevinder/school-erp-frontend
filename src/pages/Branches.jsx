import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useBranch } from "../branch/BranchContext";

const emptyForm = {
  name: "",
  code: "",
  medium: "",
  phone: "",
  email: "",
  address: "",
  is_default: false,
  is_active: true,
};

export default function Branches() {
  const { branches, refreshBranches } = useBranch();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    refreshBranches();
  }, [refreshBranches]);

  const title = useMemo(() => (editingId ? "Edit Branch / Campus" : "Add Branch / Campus"), [editingId]);

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const edit = (branch) => {
    setEditingId(branch.id);
    setForm({
      name: branch.name || "",
      code: branch.code || "",
      medium: branch.medium || "",
      phone: branch.phone || "",
      email: branch.email || "",
      address: branch.address || "",
      is_default: Boolean(branch.is_default),
      is_active: branch.is_active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      if (editingId) await api.put(`/branches/${editingId}`, form);
      else await api.post("/branches", form);
      await refreshBranches();
      window.dispatchEvent(new Event("edubridge:branches-refresh"));
      setMessage({ type: "success", text: editingId ? "Branch updated." : "Branch created." });
      reset();
    } catch (error) {
      setMessage({ type: "danger", text: error?.response?.data?.message || "Unable to save branch." });
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (id) => {
    try {
      await api.post(`/branches/${id}/make-default`);
      await refreshBranches();
      window.dispatchEvent(new Event("edubridge:branches-refresh"));
    } catch (error) {
      setMessage({ type: "danger", text: error?.response?.data?.message || "Unable to set default branch." });
    }
  };

  const remove = async (branch) => {
    if (!window.confirm(`Delete ${branch.name}?`)) return;
    try {
      await api.delete(`/branches/${branch.id}`);
      await refreshBranches();
      window.dispatchEvent(new Event("edubridge:branches-refresh"));
    } catch (error) {
      setMessage({ type: "warning", text: error?.response?.data?.message || "Unable to delete branch." });
    }
  };

  return (
    <div className="container-fluid py-3 px-3 px-lg-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <div className="text-uppercase small fw-semibold text-primary">Institution Setup</div>
          <h3 className="mb-1">Branches / Campuses</h3>
          <p className="text-muted mb-0">Manage English/Hindi medium branches, campuses, or locations in the same ERP database.</p>
        </div>
        <span className="badge rounded-pill text-bg-light border px-3 py-2">
          <i className="bi bi-diagram-3 me-2" />{branches.length} Branch{branches.length === 1 ? "" : "es"}
        </span>
      </div>

      {message && <div className={`alert alert-${message.type} py-2`}>{message.text}</div>}

      <div className="row g-3">
        <div className="col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-4">
              <h5 className="mb-3">{title}</h5>
              <form onSubmit={submit}>
                <div className="mb-3">
                  <label className="form-label">Branch / Campus Name *</label>
                  <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. English Medium" required />
                </div>
                <div className="row g-2">
                  <div className="col-sm-6">
                    <label className="form-label">Code</label>
                    <input className="form-control" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ENG" />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Medium</label>
                    <input className="form-control" value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })} placeholder="English / Hindi" />
                  </div>
                </div>
                <div className="row g-2 mt-1">
                  <div className="col-sm-6">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="form-label">Address</label>
                  <textarea className="form-control" rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="d-flex flex-wrap gap-3 mt-3">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} id="branchActive" />
                    <label className="form-check-label" htmlFor="branchActive">Active</label>
                  </div>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} id="branchDefault" />
                    <label className="form-check-label" htmlFor="branchDefault">Default</label>
                  </div>
                </div>
                <div className="d-flex gap-2 mt-4">
                  <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : editingId ? "Update Branch" : "Add Branch"}</button>
                  {editingId && <button type="button" className="btn btn-outline-secondary" onClick={reset}>Cancel</button>}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-xl-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead className="table-light">
                    <tr><th className="ps-4">Branch / Campus</th><th>Medium</th><th>Status</th><th>Default</th><th className="text-end pe-4">Actions</th></tr>
                  </thead>
                  <tbody>
                    {branches.map((branch) => (
                      <tr key={branch.id}>
                        <td className="ps-4">
                          <div className="fw-semibold">{branch.name}</div>
                          <div className="small text-muted">{branch.code || "No code"}{branch.address ? ` · ${branch.address}` : ""}</div>
                        </td>
                        <td>{branch.medium || "—"}</td>
                        <td><span className={`badge ${branch.is_active !== false ? "text-bg-success" : "text-bg-secondary"}`}>{branch.is_active !== false ? "Active" : "Inactive"}</span></td>
                        <td>{branch.is_default ? <span className="badge text-bg-primary">Default</span> : <button className="btn btn-sm btn-link text-decoration-none" onClick={() => makeDefault(branch.id)}>Make default</button>}</td>
                        <td className="text-end pe-4">
                          <button className="btn btn-sm btn-outline-primary me-2" onClick={() => edit(branch)}><i className="bi bi-pencil" /></button>
                          {!branch.is_default && <button className="btn btn-sm btn-outline-danger" onClick={() => remove(branch)}><i className="bi bi-trash" /></button>}
                        </td>
                      </tr>
                    ))}
                    {!branches.length && <tr><td colSpan="5" className="text-center text-muted py-5">No branches configured.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
