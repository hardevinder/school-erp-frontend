import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(value || 0));
const today = () => new Date().toISOString().slice(0, 10);
const emptyExpense = () => ({ expense_date: today(), category_id: "", amount: "", session_id: "", payee: "", payment_mode: "", reference_no: "", description: "", bill: null });
const fileUrl = (value) => {
  try { return new URL(value, api.defaults.baseURL || window.location.origin).href; }
  catch { return value; }
};

export default function ExpenseManagement({
  basePath = "/expenses",
  title = "Expense Management",
  subtitle = "Accounts, Admin and Superadmin expense records",
}) {
  const [tab, setTab] = useState("expenses");
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [form, setForm] = useState(emptyExpense);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: "", description: "", is_active: true });
  const [filters, setFilters] = useState({ date_from: "", date_to: "", category_id: "", session_id: "", status: "active", search: "" });

  const loadCategories = useCallback(async () => {
    const { data } = await api.get(`${basePath}/categories`);
    setCategories(data.categories || []);
  }, [basePath]);
  const loadExpenses = useCallback(async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));
    const { data } = await api.get(basePath, { params });
    setExpenses(data.expenses || []); setTotal(Number(data.total || 0)); setCount(Number(data.count || 0));
  }, [basePath, filters]);
  useEffect(() => {
    Promise.all([loadCategories(), api.get("/sessions").then(({ data }) => setSessions(data.sessions || data || []))])
      .catch((error) => Swal.fire("Error", error.response?.data?.message || "Failed to load expense setup", "error"));
  }, [loadCategories]);
  useEffect(() => { loadExpenses().catch(() => Swal.fire("Error", "Failed to load expenses", "error")); }, [loadExpenses]);

  const activeCategories = useMemo(() => categories.filter((item) => item.is_active), [categories]);
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const setFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));

  const newExpense = () => {
    setEditingId(null); setForm(emptyExpense()); setShowForm(true); setTab("expenses");
  };
  const editExpense = (row) => {
    setEditingId(row.id);
    setForm({ expense_date: row.expense_date, category_id: row.category_id, amount: row.amount, session_id: row.session_id || "", payee: row.payee || "", payment_mode: row.payment_mode || "", reference_no: row.reference_no || "", description: row.description || "", bill: null });
    setShowForm(true); setTab("expenses");
  };
  const saveExpense = async (event) => {
    event.preventDefault();
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => { if (key !== "bill") data.append(key, value ?? ""); });
      if (form.bill) data.append("bill", form.bill);
      const config = { headers: { "Content-Type": "multipart/form-data" } };
      if (editingId) await api.put(`${basePath}/${editingId}`, data, config); else await api.post(basePath, data, config);
      setShowForm(false); await loadExpenses(); Swal.fire("Saved", "Expense saved successfully", "success");
    } catch (error) { Swal.fire("Error", error.response?.data?.message || "Failed to save expense", "error"); }
  };
  const cancelExpense = async (row) => {
    const result = await Swal.fire({ title: "Cancel expense?", input: "text", inputLabel: "Reason", inputValidator: (v) => !String(v || "").trim() ? "Reason is required" : undefined, showCancelButton: true, confirmButtonText: "Cancel expense", confirmButtonColor: "#dc3545" });
    if (!result.isConfirmed) return;
    await api.post(`${basePath}/${row.id}/cancel`, { reason: result.value }); await loadExpenses();
  };
  const saveCategory = async (event) => {
    event.preventDefault();
    try {
      if (categoryForm.id) await api.put(`${basePath}/categories/${categoryForm.id}`, categoryForm);
      else await api.post(`${basePath}/categories`, categoryForm);
      setCategoryForm({ id: null, name: "", description: "", is_active: true }); await loadCategories();
      Swal.fire("Saved", "Expense category saved", "success");
    } catch (error) { Swal.fire("Error", error.response?.data?.message || "Failed to save category", "error"); }
  };

  return <div className="container-fluid py-3">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3"><div><h2 className="mb-0">{title}</h2><small className="text-muted">{subtitle}</small></div><button className="btn btn-primary" onClick={newExpense}>+ Add Expense</button></div>
    <ul className="nav nav-tabs mb-3"><li className="nav-item"><button className={`nav-link ${tab === "expenses" ? "active" : ""}`} onClick={() => setTab("expenses")}>Expense Records</button></li><li className="nav-item"><button className={`nav-link ${tab === "categories" ? "active" : ""}`} onClick={() => setTab("categories")}>Expense Categories</button></li></ul>

    {tab === "categories" ? <div className="row g-3">
      <div className="col-lg-4"><div className="card shadow-sm"><div className="card-header fw-semibold">{categoryForm.id ? "Edit Category" : "New Category"}</div><form onSubmit={saveCategory}><div className="card-body"><label className="form-label">Category Name *</label><input required className="form-control mb-3" value={categoryForm.name} onChange={(e) => setCategoryForm((c) => ({ ...c, name: e.target.value }))} /><label className="form-label">Description</label><textarea className="form-control mb-3" value={categoryForm.description} onChange={(e) => setCategoryForm((c) => ({ ...c, description: e.target.value }))} />{categoryForm.id && <div className="form-check"><input type="checkbox" className="form-check-input" checked={categoryForm.is_active} onChange={(e) => setCategoryForm((c) => ({ ...c, is_active: e.target.checked }))} /><label className="form-check-label">Active</label></div>}</div><div className="card-footer"><button className="btn btn-primary">Save Category</button></div></form></div></div>
      <div className="col-lg-8"><div className="card shadow-sm"><div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead><tbody>{categories.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.description || "-"}</td><td><span className={`badge ${item.is_active ? "bg-success" : "bg-secondary"}`}>{item.is_active ? "Active" : "Inactive"}</span></td><td><button className="btn btn-sm btn-outline-primary" onClick={() => setCategoryForm({ id: item.id, name: item.name, description: item.description || "", is_active: item.is_active })}>Edit</button></td></tr>)}</tbody></table></div></div></div>
    </div> : <>
      <div className="row g-2 mb-3"><div className="col-md-3"><div className="card shadow-sm"><div className="card-body"><small>Filtered Total</small><h4>{money(total)}</h4></div></div></div><div className="col-md-3"><div className="card shadow-sm"><div className="card-body"><small>Records</small><h4>{count}</h4></div></div></div></div>
      <div className="card shadow-sm mb-3"><div className="card-body row g-2"><div className="col-md-2"><label className="form-label">From</label><input type="date" className="form-control" value={filters.date_from} onChange={(e) => setFilter("date_from", e.target.value)} /></div><div className="col-md-2"><label className="form-label">To</label><input type="date" className="form-control" value={filters.date_to} onChange={(e) => setFilter("date_to", e.target.value)} /></div><div className="col-md-3"><label className="form-label">Category</label><select className="form-select" value={filters.category_id} onChange={(e) => setFilter("category_id", e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="col-md-2"><label className="form-label">Status</label><select className="form-select" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}><option value="active">Active</option><option value="cancelled">Cancelled</option><option value="">All</option></select></div><div className="col-md-3"><label className="form-label">Search</label><input className="form-control" value={filters.search} onChange={(e) => setFilter("search", e.target.value)} placeholder="Payee, reference, details" /></div></div></div>
      {showForm && <div className="card border-primary shadow-sm mb-3"><div className="card-header fw-semibold">{editingId ? "Edit Expense" : "New Expense"}</div><form onSubmit={saveExpense}><div className="card-body row g-3"><div className="col-md-2"><label className="form-label">Date *</label><input required type="date" className="form-control" value={form.expense_date} onChange={(e) => setField("expense_date", e.target.value)} /></div><div className="col-md-3"><label className="form-label">Category *</label><select required className="form-select" value={form.category_id} onChange={(e) => setField("category_id", e.target.value)}><option value="">Select category</option>{activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="col-md-2"><label className="form-label">Amount *</label><input required type="number" min="0.01" step="0.01" className="form-control" value={form.amount} onChange={(e) => setField("amount", e.target.value)} /></div><div className="col-md-2"><label className="form-label">Session</label><select className="form-select" value={form.session_id} onChange={(e) => setField("session_id", e.target.value)}><option value="">None</option>{sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="col-md-3"><label className="form-label">Payee / Vendor</label><input className="form-control" value={form.payee} onChange={(e) => setField("payee", e.target.value)} /></div><div className="col-md-2"><label className="form-label">Payment Mode</label><input className="form-control" value={form.payment_mode} onChange={(e) => setField("payment_mode", e.target.value)} /></div><div className="col-md-2"><label className="form-label">Reference No.</label><input className="form-control" value={form.reference_no} onChange={(e) => setField("reference_no", e.target.value)} /></div><div className="col-md-4"><label className="form-label">Bill / Receipt</label><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="form-control" onChange={(e) => setField("bill", e.target.files?.[0] || null)} /><small className="text-muted">PDF/JPG/PNG/WebP, max 10 MB</small></div><div className="col-md-4"><label className="form-label">Description</label><textarea className="form-control" rows="2" value={form.description} onChange={(e) => setField("description", e.target.value)} /></div></div><div className="card-footer d-flex justify-content-end gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => setShowForm(false)}>Close</button><button className="btn btn-primary">Save Expense</button></div></form></div>}
      <div className="card shadow-sm"><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Date</th><th>Category</th><th>Payee / Details</th><th>Reference</th><th>Bill</th><th className="text-end">Amount</th><th>Status</th><th></th></tr></thead><tbody>{expenses.length ? expenses.map((row) => <tr key={row.id} className={row.status === "cancelled" ? "table-secondary" : ""}><td>{row.expense_date}</td><td>{row.category?.name || "-"}</td><td><div>{row.payee || "-"}</div><small className="text-muted">{row.description || ""}</small></td><td>{row.reference_no || "-"}</td><td>{row.bill_url ? <a href={fileUrl(row.bill_url)} target="_blank" rel="noreferrer">View bill</a> : "-"}</td><td className="text-end fw-semibold">{money(row.amount)}</td><td><span className={`badge ${row.status === "active" ? "bg-success" : "bg-secondary"}`}>{row.status}</span></td><td>{row.status === "active" && <div className="d-flex gap-1"><button className="btn btn-sm btn-outline-primary" onClick={() => editExpense(row)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => cancelExpense(row)}>Cancel</button></div>}</td></tr>) : <tr><td colSpan="8" className="text-center text-muted py-4">No expenses found.</td></tr>}</tbody></table></div></div>
    </>}
  </div>;
}
