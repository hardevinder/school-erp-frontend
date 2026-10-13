import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./Transportation.css";

const CATEGORIES = [
  ["fuel", "Fuel"],
  ["repair", "Repair"],
  ["service", "Service"],
  ["salary", "Driver / Conductor Salary"],
  ["insurance", "Insurance"],
  ["permit_tax", "Permit / Tax"],
  ["tyres_spares", "Tyres / Spare Parts"],
  ["toll_parking", "Toll / Parking"],
  ["other", "Other"],
];

const categoryName = (value) =>
  CATEGORIES.find(([key]) => key === value)?.[1] || value || "-";
const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const today = () => new Date().toISOString().slice(0, 10);
const billUrl = (value) => {
  if (!value) return "";
  try {
    return new URL(value, api.defaults.baseURL || window.location.origin).href;
  } catch {
    return value;
  }
};
const emptyForm = () => ({
  expense_date: today(),
  category: "fuel",
  amount: "",
  bus_id: "",
  transportation_id: "",
  session_id: "",
  vendor: "",
  payment_mode: "",
  reference_no: "",
  odometer_reading: "",
  fuel_quantity: "",
  fuel_rate: "",
  tank_status: "full",
  odometer_scan: null,
  description: "",
  bill: null,
});

export default function TransportExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    category: "",
    bus_id: "",
    transportation_id: "",
    session_id: "",
    status: "active",
    search: "",
  });

  const loadMasters = useCallback(async () => {
    const [busRes, routeRes, sessionRes] = await Promise.all([
      api.get("/buses"),
      api.get("/transportations"),
      api.get("/sessions"),
    ]);
    setBuses(busRes.data?.buses || busRes.data || []);
    setRoutes(routeRes.data?.transportations || routeRes.data || []);
    setSessions(sessionRes.data?.sessions || sessionRes.data || []);
  }, []);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== "")
      );
      const { data } = await api.get("/transport-expenses", { params });
      setExpenses(data.expenses || []);
      setTotal(Number(data.total || 0));
      setCount(Number(data.count || 0));
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to load expenses", "error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadMasters().catch(() => Swal.fire("Error", "Failed to load transport masters", "error"));
  }, [loadMasters]);
  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const activeSessionId = useMemo(
    () => sessions.find((session) => session.is_active)?.id || "",
    [sessions]
  );

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), session_id: activeSessionId });
    setShowForm(true);
  };

  const openEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date || today(),
      category: expense.category || "other",
      amount: expense.amount || "",
      bus_id: expense.bus_id || "",
      transportation_id: expense.transportation_id || "",
      session_id: expense.session_id || "",
      vendor: expense.vendor || "",
      payment_mode: expense.payment_mode || "",
      reference_no: expense.reference_no || "",
      odometer_reading: expense.odometer_reading || "",
      fuel_quantity: expense.fuel_quantity || "",
      fuel_rate: expense.fuel_rate || "",
      tank_status: expense.tank_status || "full",
      odometer_scan: null,
      description: expense.description || "",
      bill: null,
    });
    setShowForm(true);
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.bus_id || !form.transportation_id) {
      return Swal.fire("Required", "Please select both vehicle and route.", "warning");
    }
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        bus_id: form.bus_id || null,
        transportation_id: form.transportation_id || null,
        session_id: form.session_id || null,
        odometer_reading: form.odometer_reading || null,
        fuel_quantity: form.fuel_quantity || null,
        fuel_rate: form.fuel_rate || null,
        tank_status: form.category === "fuel" ? form.tank_status : null,
      };
      const data = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        if (key === "bill" || key === "odometer_scan") return;
        data.append(key, value === null || value === undefined ? "" : value);
      });
      if (form.bill) data.append("bill", form.bill);
      if (form.odometer_scan) data.append("odometer_scan", form.odometer_scan);
      const config = { headers: { "Content-Type": "multipart/form-data" } };
      if (editingId) await api.put(`/transport-expenses/${editingId}`, data, config);
      else await api.post("/transport-expenses", data, config);
      setShowForm(false);
      await loadExpenses();
      Swal.fire("Saved", "Transport expense saved successfully.", "success");
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to save expense", "error");
    }
  };

  const cancelExpense = async (expense) => {
    const result = await Swal.fire({
      title: "Cancel expense?",
      input: "text",
      inputLabel: "Cancellation reason",
      inputValidator: (value) => (!String(value || "").trim() ? "Reason is required" : undefined),
      showCancelButton: true,
      confirmButtonText: "Cancel expense",
      confirmButtonColor: "#dc3545",
    });
    if (!result.isConfirmed) return;
    try {
      await api.post(`/transport-expenses/${expense.id}/cancel`, { reason: result.value });
      await loadExpenses();
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to cancel expense", "error");
    }
  };

  const reviewFuel = async (expense, action) => {
    let reason = "";
    if (action === "reject") {
      const result = await Swal.fire({
        title: "Reject fuel entry?",
        input: "text",
        inputLabel: "Reason",
        inputValidator: (value) => (!String(value || "").trim() ? "Reason is required" : undefined),
        showCancelButton: true,
        confirmButtonText: "Reject",
        confirmButtonColor: "#dc3545",
      });
      if (!result.isConfirmed) return;
      reason = result.value;
    }
    try {
      await api.post(`/transport-expenses/${expense.id}/fuel-review`, { action, reason });
      await loadExpenses();
      Swal.fire("Updated", `Fuel entry ${action === "approve" ? "approved" : "rejected"}.`, "success");
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Failed to review fuel entry", "error");
    }
  };

  const field = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const filter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h2 className="mb-0">Transport Expenses</h2>
          <small className="text-muted">Track expenses by vehicle, route, or both</small>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Expense</button>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-md-3"><div className="card shadow-sm"><div className="card-body"><small>Filtered Total</small><h4>{money(total)}</h4></div></div></div>
        <div className="col-md-3"><div className="card shadow-sm"><div className="card-body"><small>Records</small><h4>{count}</h4></div></div></div>
      </div>

      <div className="card shadow-sm mb-3"><div className="card-body row g-2">
        <div className="col-md-2"><label className="form-label">From</label><input type="date" className="form-control" value={filters.date_from} onChange={(e) => filter("date_from", e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">To</label><input type="date" className="form-control" value={filters.date_to} onChange={(e) => filter("date_to", e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">Category</label><select className="form-select" value={filters.category} onChange={(e) => filter("category", e.target.value)}><option value="">All</option>{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Vehicle</label><select className="form-select" value={filters.bus_id} onChange={(e) => filter("bus_id", e.target.value)}><option value="">All</option>{buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.bus_no}{bus.reg_no ? ` (${bus.reg_no})` : ""}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Route</label><select className="form-select" value={filters.transportation_id} onChange={(e) => filter("transportation_id", e.target.value)}><option value="">All</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.RouteName}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Status</label><select className="form-select" value={filters.status} onChange={(e) => filter("status", e.target.value)}><option value="active">Active</option><option value="cancelled">Cancelled</option><option value="">All</option></select></div>
      </div></div>

      {showForm && <div className="card shadow-sm border-primary mb-3"><div className="card-header fw-semibold">{editingId ? "Edit Expense" : "New Expense"}</div><form onSubmit={save}><div className="card-body row g-3">
        <div className="col-md-2"><label className="form-label">Date *</label><input required type="date" className="form-control" value={form.expense_date} onChange={(e) => field("expense_date", e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">Category *</label><select required className="form-select" value={form.category} onChange={(e) => field("category", e.target.value)}>{CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Amount *</label><input required min="0.01" step="0.01" type="number" className="form-control" value={form.amount} onChange={(e) => field("amount", e.target.value)} /></div>
        <div className="col-md-3"><label className="form-label">Vehicle *</label><select required className="form-select" value={form.bus_id} onChange={(e) => field("bus_id", e.target.value)}><option value="">Select vehicle</option>{buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.bus_no}{bus.reg_no ? ` (${bus.reg_no})` : ""}</option>)}</select></div>
        <div className="col-md-3"><label className="form-label">Route *</label><select required className="form-select" value={form.transportation_id} onChange={(e) => field("transportation_id", e.target.value)}><option value="">Select route</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.RouteName}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Session</label><select className="form-select" value={form.session_id} onChange={(e) => field("session_id", e.target.value)}><option value="">None</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label">Vendor</label><input className="form-control" value={form.vendor} onChange={(e) => field("vendor", e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">Payment Mode</label><input className="form-control" value={form.payment_mode} onChange={(e) => field("payment_mode", e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">Reference No.</label><input className="form-control" value={form.reference_no} onChange={(e) => field("reference_no", e.target.value)} /></div>
        <div className="col-md-2"><label className="form-label">Odometer</label><input min="0" step="0.01" type="number" className="form-control" value={form.odometer_reading} onChange={(e) => field("odometer_reading", e.target.value)} /></div>
                <div className="col-md-2"><label className="form-label">Fuel Qty (L)</label><input min="0" step="0.01" type="number" className="form-control" value={form.fuel_quantity} onChange={(e) => field("fuel_quantity", e.target.value)} /></div>
        {form.category === "fuel" && <><div className="col-md-2"><label className="form-label">Rate / Litre</label><input min="0" step="0.01" type="number" className="form-control" value={form.fuel_rate} onChange={(e) => field("fuel_rate", e.target.value)} /></div><div className="col-md-2"><label className="form-label">Tank Status</label><select className="form-select" value={form.tank_status} onChange={(e) => field("tank_status", e.target.value)}><option value="full">Full Tank</option><option value="partial">Partial Refill</option></select></div><div className="col-md-4"><label className="form-label">Odometer Scan</label><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="form-control" onChange={(e) => field("odometer_scan", e.target.files?.[0] || null)} /></div></>}
        <div className="col-md-4"><label className="form-label">Bill / Receipt</label><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="form-control" onChange={(e) => field("bill", e.target.files?.[0] || null)} /><small className="text-muted">PDF/JPG/PNG/WebP, maximum 10 MB{editingId ? ". Leave blank to keep the existing bill." : "."}</small></div>
        <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" rows="2" value={form.description} onChange={(e) => field("description", e.target.value)} /></div>
      </div><div className="card-footer d-flex justify-content-end gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => setShowForm(false)}>Close</button><button className="btn btn-primary">Save Expense</button></div></form></div>}

      <div className="card shadow-sm"><div className="table-responsive"><table className="table table-hover align-middle mb-0"><thead><tr><th>Date</th><th>Category</th><th>Vehicle</th><th>Vendor / Details</th><th>Fuel Check</th><th>Scans</th><th className="text-end">Amount</th><th>Approval</th><th>Actions</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="9" className="text-center py-4">Loading…</td></tr> : expenses.length === 0 ? <tr><td colSpan="9" className="text-center text-muted py-4">No expenses found.</td></tr> : expenses.map((expense) => {
          const variance = Number(expense.amount_variance || 0);
          const mismatch = expense.category === "fuel" && Math.abs(variance) > 1;
          return <tr key={expense.id} className={expense.status === "cancelled" ? "table-secondary" : ""}>
            <td>{expense.expense_date}<div><small className="text-muted">{expense.recorded_at ? new Date(expense.recorded_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : ""}</small></div></td>
            <td>{categoryName(expense.category)}{expense.tank_status && <div><small className="text-muted">{expense.tank_status === "full" ? "Full tank" : "Partial refill"}</small></div>}</td>
            <td>{expense.bus?.bus_no || "-"}<div><small className="text-muted">{expense.bus?.reg_no || ""}</small></div></td>
            <td><div>{expense.vendor || "-"}</div><small className="text-muted">{expense.description || ""}</small><div><small>{expense.reference_no || ""}</small></div></td>
            <td>{expense.category === "fuel" ? <><div>{expense.fuel_quantity || "-"} L × {expense.fuel_rate ? money(expense.fuel_rate).replace("₹", "₹") : "-"}</div><small className={mismatch ? "text-danger fw-semibold" : "text-success"}>{mismatch ? `Mismatch ${money(Math.abs(variance))}` : "Amount matched"}</small><div><small className="text-muted">Odo: {expense.odometer_reading || "-"} km</small></div></> : "-"}</td>
            <td><div className="d-flex flex-column gap-1">{expense.odometer_scan_url && <a href={billUrl(expense.odometer_scan_url)} target="_blank" rel="noreferrer">Odometer</a>}{expense.bill_url && <a href={billUrl(expense.bill_url)} target="_blank" rel="noreferrer">Fuel slip / bill</a>}{!expense.odometer_scan_url && !expense.bill_url && "-"}</div></td>
            <td className="text-end fw-semibold">{money(expense.amount)}{expense.calculated_amount && <div><small className="text-muted">Expected {money(expense.calculated_amount)}</small></div>}</td>
            <td>{expense.category === "fuel" ? <span className={`badge ${expense.approval_status === "approved" ? "bg-success" : expense.approval_status === "rejected" ? "bg-danger" : "bg-warning text-dark"}`}>{expense.approval_status || "pending"}</span> : <span className={`badge ${expense.status === "active" ? "bg-success" : "bg-secondary"}`}>{expense.status}</span>}</td>
            <td>{expense.status === "active" && <div className="d-flex flex-wrap gap-1">{expense.category === "fuel" && expense.approval_status === "pending" && <><button className="btn btn-sm btn-success" onClick={() => reviewFuel(expense, "approve")}>Approve</button><button className="btn btn-sm btn-outline-danger" onClick={() => reviewFuel(expense, "reject")}>Reject</button></>}<button className="btn btn-sm btn-outline-primary" onClick={() => openEdit(expense)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => cancelExpense(expense)}>Cancel</button></div>}</td>
          </tr>;
        })}
      </tbody></table></div></div>
    </div>
  );
}
