import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const moneyFields = [
  { key: "basic_salary", label: "Basic", type: "earning", icon: "bi-cash-stack" },
  { key: "hra", label: "HRA", type: "earning", icon: "bi-house-check" },
  { key: "conveyance_allowance", label: "Conveyance", type: "earning", icon: "bi-bus-front" },
  { key: "medical_allowance", label: "Medical", type: "earning", icon: "bi-heart-pulse" },
  { key: "special_allowance", label: "Special", type: "earning", icon: "bi-stars" },
  { key: "other_allowance", label: "Other Allowance", type: "earning", icon: "bi-plus-circle" },
  { key: "pf_employee", label: "PF", type: "deduction", icon: "bi-shield-minus" },
  { key: "esi_employee", label: "ESI", type: "deduction", icon: "bi-hospital" },
  { key: "professional_tax", label: "Professional Tax", type: "deduction", icon: "bi-receipt" },
  { key: "tds", label: "TDS", type: "deduction", icon: "bi-bank" },
  { key: "other_deduction", label: "Other Deduction", type: "deduction", icon: "bi-dash-circle" },
];

const earningFields = moneyFields.filter((field) => field.type === "earning");
const deductionFields = moneyFields.filter((field) => field.type === "deduction");

const emptyForm = moneyFields.reduce(
  (acc, field) => ({ ...acc, [field.key]: "" }),
  { effective_from: new Date().toISOString().slice(0, 10), notes: "" }
);

const styles = {
  page: {
    background:
      "linear-gradient(180deg, #f5f8ff 0%, #f8fafc 38%, #ffffff 100%)",
    minHeight: "100vh",
  },
  hero: {
    borderRadius: 24,
    background:
      "radial-gradient(circle at top left, rgba(255,255,255,.32), transparent 30%), linear-gradient(135deg, #123524 0%, #0f766e 52%, #1d4ed8 100%)",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.18)",
    overflow: "hidden",
  },
  glassCard: {
    border: "1px solid rgba(255,255,255,.28)",
    background: "rgba(255,255,255,.14)",
    backdropFilter: "blur(8px)",
    borderRadius: 18,
  },
  softCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
  },
  miniCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.06)",
  },
  stickyPanel: {
    position: "sticky",
    top: 12,
  },
  tableHead: {
    background: "#f8fafc",
    color: "#475569",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: ".04em",
  },
};

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const numberValue = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (value) => {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const monthLabel = (month) => {
  const dt = new Date((month || "") + "-01T00:00:00");
  if (Number.isNaN(dt.getTime())) return month || "";
  return dt.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const parseComponents = (components) => {
  if (!components) return {};
  if (typeof components === "object") return components;
  if (typeof components === "string") {
    try {
      return JSON.parse(components);
    } catch (_) {
      return {};
    }
  }
  return {};
};

const getSlipComponents = (slip) => parseComponents(slip?.components);

const pickSlipEmployee = (slip) => slip?.employee || getSlipComponents(slip)?.employee || {};

const statusMeta = (status) => {
  const s = String(status || "draft").toLowerCase();

  if (s === "paid") {
    return {
      label: "Paid",
      badge: "bg-success-subtle text-success border border-success-subtle",
      icon: "bi-check2-circle",
    };
  }

  if (s === "published") {
    return {
      label: "Published",
      badge: "bg-primary-subtle text-primary border border-primary-subtle",
      icon: "bi-send-check",
    };
  }

  if (s === "cancelled") {
    return {
      label: "Cancelled",
      badge: "bg-danger-subtle text-danger border border-danger-subtle",
      icon: "bi-x-circle",
    };
  }

  return {
    label: "Draft",
    badge: "bg-secondary-subtle text-secondary border border-secondary-subtle",
    icon: "bi-file-earmark-text",
  };
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getPayslipFileName = (slip) => {
  const employee = pickSlipEmployee(slip);
  const employeeCode = String(employee.employee_id || "EMP").replace(/[^a-zA-Z0-9_-]/g, "_");
  const month = String(slip?.month || "month").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `Payslip_${employeeCode}_${month}.pdf`;
};

function StatCard({ title, value, icon, tone = "primary", subtitle }) {
  return (
    <div className="h-100 bg-white p-3" style={styles.miniCard}>
      <div className="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div className="text-muted small fw-semibold">{title}</div>
          <div className="fs-4 fw-bold text-dark mt-1">{value}</div>
          {subtitle ? <div className="small text-muted mt-1">{subtitle}</div> : null}
        </div>
        <div className={`rounded-4 p-2 bg-${tone}-subtle text-${tone}`}>
          <i className={`bi ${icon} fs-4`} />
        </div>
      </div>
    </div>
  );
}

function MoneyInput({ field, value, onChange }) {
  const isEarning = field.type === "earning";

  return (
    <div className="col-12 col-md-6" key={field.key}>
      <label className="form-label small fw-semibold text-muted mb-1">{field.label}</label>
      <div className="input-group input-group-sm">
        <span className={`input-group-text ${isEarning ? "text-success" : "text-danger"}`}>
          <i className={`bi ${field.icon}`} />
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          className="form-control"
          name={field.key}
          value={value}
          onChange={onChange}
          placeholder="0.00"
        />
      </div>
    </div>
  );
}

function DetailLine({ label, value, strong = false }) {
  return (
    <div className="d-flex justify-content-between align-items-center gap-3 py-1 border-bottom border-light-subtle">
      <span className="text-muted small">{label}</span>
      <span className={strong ? "fw-bold text-dark" : "fw-semibold text-dark"}>{value}</span>
    </div>
  );
}

export default function PayrollManagement() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [employees, setEmployees] = useState([]);
  const [structures, setStructures] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishNow, setPublishNow] = useState(false);
  const [treatUnmarkedAsAbsent, setTreatUnmarkedAsAbsent] = useState(false);
  const [shortLeaveFraction, setShortLeaveFraction] = useState(0.25);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [slipSearch, setSlipSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [downloadingId, setDownloadingId] = useState(null);

  const structureByEmployee = useMemo(() => {
    const map = new Map();
    for (const item of structures) {
      if (!map.has(Number(item.employee_id))) map.set(Number(item.employee_id), item);
    }
    return map;
  }, [structures]);

  const selectedEmployee = useMemo(
    () => employees.find((item) => Number(item.id) === Number(selectedEmployeeId)) || null,
    [employees, selectedEmployeeId]
  );

  const formTotals = useMemo(() => {
    const earnings = earningFields.reduce((sum, field) => sum + numberValue(form[field.key]), 0);
    const deductions = deductionFields.reduce((sum, field) => sum + numberValue(form[field.key]), 0);
    return {
      earnings,
      deductions,
      net: Math.max(0, earnings - deductions),
    };
  }, [form]);

  const missingStructureCount = useMemo(
    () => employees.filter((item) => !structureByEmployee.has(Number(item.id))).length,
    [employees, structureByEmployee]
  );

  const totals = useMemo(() => {
    return payslips.reduce(
      (acc, slip) => ({
        gross: acc.gross + numberValue(slip.gross_earnings),
        deductions: acc.deductions + numberValue(slip.total_deductions),
        net: acc.net + numberValue(slip.net_salary),
        paid: acc.paid + (String(slip.status).toLowerCase() === "paid" ? 1 : 0),
        published: acc.published + (String(slip.status).toLowerCase() === "published" ? 1 : 0),
        draft: acc.draft + (String(slip.status || "draft").toLowerCase() === "draft" ? 1 : 0),
      }),
      { gross: 0, deductions: 0, net: 0, paid: 0, published: 0, draft: 0 }
    );
  }, [payslips]);

  const filteredPayslips = useMemo(() => {
    const term = String(slipSearch || "").trim().toLowerCase();

    return payslips.filter((slip) => {
      const employee = pickSlipEmployee(slip);
      const status = String(slip.status || "draft").toLowerCase();

      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (!term) return true;

      return [
        employee.name,
        employee.employee_id,
        employee.department?.name,
        employee.designation,
        slip.month,
        slip.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [payslips, slipSearch, statusFilter]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, structureRes, slipRes] = await Promise.all([
        api.get("/employees"),
        api.get("/payroll/salary-structures", { params: { is_active: true } }),
        api.get("/payroll/slips", { params: { month } }),
      ]);

      const activeEmployees = (empRes.data?.employees || []).filter(
        (item) => String(item.status || "enabled").toLowerCase() !== "disabled"
      );

      const nextPayslips = slipRes.data?.payslips || [];

      setEmployees(activeEmployees);
      setStructures(structureRes.data?.structures || []);
      setPayslips(nextPayslips);
      setSelectedSlip((current) => {
        if (!current) return nextPayslips[0] || null;
        return nextPayslips.find((item) => Number(item.id) === Number(current.id)) || nextPayslips[0] || null;
      });
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to load payroll", "error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!selectedEmployeeId && employees.length) {
      setSelectedEmployeeId(String(employees[0].id));
    }
  }, [employees, selectedEmployeeId]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    const current = structureByEmployee.get(Number(selectedEmployeeId));

    if (!current) {
      setForm(emptyForm);
      return;
    }

    const next = {
      effective_from: current.effective_from || new Date().toISOString().slice(0, 10),
      notes: current.notes || "",
    };

    for (const field of moneyFields) next[field.key] = String(current[field.key] || "");
    setForm(next);
  }, [selectedEmployeeId, structureByEmployee]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveStructure = async (event) => {
    event.preventDefault();
    if (!selectedEmployee) {
      Swal.fire("Select Employee", "Please select an employee.", "warning");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        effective_from: form.effective_from || new Date().toISOString().slice(0, 10),
        notes: form.notes || "",
      };
      for (const field of moneyFields) payload[field.key] = numberValue(form[field.key]);

      await api.put("/payroll/salary-structures/" + selectedEmployee.id, payload);
      Swal.fire("Saved", "Salary structure saved successfully.", "success");
      await fetchAll();
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to save salary", "error");
    } finally {
      setSaving(false);
    }
  };

  const generatePayroll = async () => {
    const result = await Swal.fire({
      title: publishNow ? "Generate and publish payroll?" : "Generate payroll draft?",
      html: `
        <div style="text-align:left">
          <div><b>Month:</b> ${monthLabel(month)}</div>
          <div><b>Employees:</b> ${employees.length}</div>
          <div><b>Missing salary structures:</b> ${missingStructureCount}</div>
          <div><b>Unmarked attendance:</b> ${treatUnmarkedAsAbsent ? "Deduct" : "Ignore"}</div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: publishNow ? "Generate & Publish" : "Generate Draft",
    });

    if (!result.isConfirmed) return;

    setGenerating(true);
    try {
      const res = await api.post("/payroll/generate", {
        month,
        publish: publishNow,
        treat_unmarked_as_absent: treatUnmarkedAsAbsent,
        short_leave_fraction: Number(shortLeaveFraction),
      });

      const missing = res.data?.missing_salary_structures || [];
      Swal.fire(
        missing.length ? "Generated with warnings" : "Payroll generated",
        "Generated " + (res.data?.generated_count || 0) + " payslip(s). Missing salary: " + missing.length,
        missing.length ? "warning" : "success"
      );
      await fetchAll();
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to generate payroll", "error");
    } finally {
      setGenerating(false);
    }
  };

  const updateSlipStatus = async (slip, status) => {
    const result = await Swal.fire({
      title: `Mark as ${status}?`,
      text: `${pickSlipEmployee(slip).name || "Employee"} - ${monthLabel(slip.month)}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, update",
    });

    if (!result.isConfirmed) return;

    try {
      await api.patch("/payroll/slips/" + slip.id + "/status", { status });
      await fetchAll();
      Swal.fire("Updated", "Payslip marked as " + status + ".", "success");
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to update payslip", "error");
    }
  };

  const downloadPayslipPdf = async (slip) => {
    if (!slip?.id) return;

    setDownloadingId(slip.id);
    try {
      const res = await api.get(`/payroll/slips/${slip.id}/pdf`, {
        responseType: "blob",
      });
      downloadBlob(res.data, getPayslipFileName(slip));
    } catch (err) {
      Swal.fire(
        "PDF Error",
        err.response?.data?.message || "Failed to download payslip PDF. Please check route/controller.",
        "error"
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const selectedComponents = getSlipComponents(selectedSlip);
  const selectedEmployeeForSlip = pickSlipEmployee(selectedSlip);

  return (
    <div className="container-fluid py-4" style={styles.page}>
      <div className="p-4 p-lg-5 mb-4 text-white" style={styles.hero}>
        <div className="row g-4 align-items-center">
          <div className="col-12 col-xl-6">
            <div className="badge rounded-pill bg-white text-dark mb-3 px-3 py-2 shadow-sm">
              <i className="bi bi-calendar2-week me-1" /> {monthLabel(month)}
            </div>
            <h2 className="fw-bold mb-2">Payroll Management</h2>
            <p className="mb-0 opacity-75">
              Generate salaries, manage employee salary structures, publish payslips, and download professional PDF slips.
            </p>
          </div>

          <div className="col-12 col-xl-6">
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <div className="p-3 h-100" style={styles.glassCard}>
                  <div className="small opacity-75">Payslips</div>
                  <div className="fs-3 fw-bold">{payslips.length}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 h-100" style={styles.glassCard}>
                  <div className="small opacity-75">Paid</div>
                  <div className="fs-3 fw-bold">{totals.paid}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 h-100" style={styles.glassCard}>
                  <div className="small opacity-75">Published</div>
                  <div className="fs-3 fw-bold">{totals.published}</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 h-100" style={styles.glassCard}>
                  <div className="small opacity-75">Missing</div>
                  <div className="fs-3 fw-bold">{missingStructureCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-end gap-2 mt-4">
          <div style={{ minWidth: 190 }}>
            <label className="form-label small mb-1 text-white-50">Payroll Month</label>
            <input
              type="month"
              className="form-control border-0 shadow-sm"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
          <button className="btn btn-light shadow-sm" onClick={fetchAll} disabled={loading}>
            <i className={`bi ${loading ? "bi-arrow-repeat" : "bi-arrow-clockwise"} me-1`} />
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-warning shadow-sm fw-semibold" onClick={generatePayroll} disabled={generating}>
            <i className="bi bi-calculator me-1" />
            {generating ? "Generating..." : publishNow ? "Generate & Publish" : "Generate Draft"}
          </button>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <StatCard title="Total Gross" value={currency(totals.gross)} icon="bi-graph-up-arrow" tone="primary" />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard title="Net Salary" value={currency(totals.net)} icon="bi-wallet2" tone="success" />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard title="Deductions" value={currency(totals.deductions)} icon="bi-receipt-cutoff" tone="danger" />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            title="Salary Structures"
            value={`${employees.length - missingStructureCount}/${employees.length}`}
            icon="bi-person-check"
            tone={missingStructureCount ? "warning" : "success"}
            subtitle={missingStructureCount ? `${missingStructureCount} missing` : "All active employees covered"}
          />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xxl-4">
          <div style={styles.stickyPanel}>
            <form className="card bg-white" style={styles.softCard} onSubmit={saveStructure}>
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <div className="badge bg-success-subtle text-success border border-success-subtle mb-2">
                      Salary Setup
                    </div>
                    <h5 className="mb-1 fw-bold">Salary Structure</h5>
                    <div className="text-muted small">Monthly earnings and deductions</div>
                  </div>
                  <button className="btn btn-success btn-sm rounded-pill px-3" type="submit" disabled={saving}>
                    <i className="bi bi-check2 me-1" />
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-muted">Employee</label>
                  <select
                    className="form-select"
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  >
                    {employees.length === 0 ? (
                      <option value="">No active employees</option>
                    ) : null}
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.employee_id} - {employee.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedEmployee ? (
                  <div className="rounded-4 bg-light p-3 mb-3 border">
                    <div className="d-flex align-items-center gap-3">
                      <div className="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                        <i className="bi bi-person-badge fs-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="fw-bold text-truncate">{selectedEmployee.name}</div>
                        <div className="small text-muted text-truncate">
                          {selectedEmployee.employee_id || "—"} {selectedEmployee.designation ? `• ${selectedEmployee.designation}` : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="row g-2 mb-3">
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-muted mb-1">Effective From</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      name="effective_from"
                      value={form.effective_from}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-success-subtle text-success">Earnings</span>
                  <span className="small text-muted">Monthly earning components</span>
                </div>
                <div className="row g-2 mb-3">
                  {earningFields.map((field) => (
                    <MoneyInput key={field.key} field={field} value={form[field.key]} onChange={handleFormChange} />
                  ))}
                </div>

                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="badge bg-danger-subtle text-danger">Deductions</span>
                  <span className="small text-muted">Fixed deduction components</span>
                </div>
                <div className="row g-2 mb-3">
                  {deductionFields.map((field) => (
                    <MoneyInput key={field.key} field={field} value={form[field.key]} onChange={handleFormChange} />
                  ))}
                </div>

                <div className="rounded-4 p-3 mb-3" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <DetailLine label="Monthly Earnings" value={currency(formTotals.earnings)} />
                  <DetailLine label="Fixed Deductions" value={currency(formTotals.deductions)} />
                  <DetailLine label="Estimated Net" value={currency(formTotals.net)} strong />
                </div>

                <div>
                  <label className="form-label small fw-semibold text-muted">Notes</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    placeholder="Optional remarks for this salary structure"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="col-12 col-xxl-8">
          <div className="card bg-white mb-4" style={styles.softCard}>
            <div className="card-body p-4">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <div className="badge bg-primary-subtle text-primary border border-primary-subtle mb-2">
                    Payroll Processing
                  </div>
                  <h5 className="mb-1 fw-bold">Payslips</h5>
                  <div className="text-muted small">Review, publish, mark paid, and download PDF payslips.</div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2">
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="publishNowSwitch"
                      checked={publishNow}
                      onChange={(event) => setPublishNow(event.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="publishNowSwitch">
                      Publish after generate
                    </label>
                  </div>
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="deductUnmarkedSwitch"
                      checked={treatUnmarkedAsAbsent}
                      onChange={(event) => setTreatUnmarkedAsAbsent(event.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="deductUnmarkedSwitch">
                      Deduct unmarked
                    </label>
                  </div>
                  <select
                    className="form-select form-select-sm"
                    value={shortLeaveFraction}
                    onChange={(event) => setShortLeaveFraction(Number(event.target.value))}
                    style={{ width: 165 }}
                  >
                    <option value={0}>Short leave: 0 day</option>
                    <option value={0.25}>Short leave: 0.25 day</option>
                    <option value={0.5}>Short leave: 0.5 day</option>
                  </select>
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-12 col-lg-7">
                  <div className="input-group">
                    <span className="input-group-text bg-white">
                      <i className="bi bi-search" />
                    </span>
                    <input
                      type="search"
                      className="form-control"
                      value={slipSearch}
                      onChange={(event) => setSlipSearch(event.target.value)}
                      placeholder="Search employee, code, department, status..."
                    />
                  </div>
                </div>
                <div className="col-12 col-lg-3">
                  <select
                    className="form-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="col-12 col-lg-2 d-grid">
                  <button className="btn btn-outline-secondary" type="button" onClick={() => { setSlipSearch(""); setStatusFilter("all"); }}>
                    Clear
                  </button>
                </div>
              </div>

              <div className="table-responsive rounded-4 border">
                <table className="table table-hover align-middle mb-0">
                  <thead style={styles.tableHead}>
                    <tr>
                      <th className="ps-3">Employee</th>
                      <th>Attendance</th>
                      <th>Gross</th>
                      <th>Deductions</th>
                      <th>Net</th>
                      <th>Status</th>
                      <th className="text-end pe-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="text-center text-muted py-5">
                          <div className="spinner-border spinner-border-sm me-2" /> Loading payroll...
                        </td>
                      </tr>
                    ) : filteredPayslips.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-5">
                          <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 58, height: 58 }}>
                            <i className="bi bi-file-earmark-x fs-3 text-muted" />
                          </div>
                          <div className="fw-semibold">No payslips found</div>
                          <div className="text-muted small">Generate payroll or adjust filters for {monthLabel(month)}.</div>
                        </td>
                      </tr>
                    ) : (
                      filteredPayslips.map((slip) => {
                        const employee = pickSlipEmployee(slip);
                        const meta = statusMeta(slip.status);
                        const isSelected = Number(selectedSlip?.id) === Number(slip.id);

                        return (
                          <tr key={slip.id} className={isSelected ? "table-primary" : ""}>
                            <td className="ps-3">
                              <div className="d-flex align-items-center gap-2">
                                <div className="rounded-circle bg-primary-subtle text-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 38, height: 38 }}>
                                  <i className="bi bi-person" />
                                </div>
                                <div>
                                  <div className="fw-bold">{employee.name || "-"}</div>
                                  <div className="text-muted small">
                                    {employee.employee_id || "—"} {employee.department?.name ? `• ${employee.department.name}` : ""}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="small">
                                <span className="fw-semibold">Working:</span> {formatNumber(slip.working_days)}
                              </div>
                              <div className="small text-muted">LOP: {formatNumber(slip.loss_of_pay_days)}</div>
                            </td>
                            <td>{currency(slip.gross_earnings)}</td>
                            <td>{currency(slip.total_deductions)}</td>
                            <td className="fw-bold text-success">{currency(slip.net_salary)}</td>
                            <td>
                              <span className={`badge rounded-pill px-3 py-2 ${meta.badge}`}>
                                <i className={`bi ${meta.icon} me-1`} /> {meta.label}
                              </span>
                            </td>
                            <td className="text-end pe-3">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-primary"
                                  type="button"
                                  onClick={() => setSelectedSlip(slip)}
                                >
                                  <i className="bi bi-eye me-1" /> View
                                </button>
                                <button
                                  className="btn btn-outline-dark"
                                  type="button"
                                  onClick={() => downloadPayslipPdf(slip)}
                                  disabled={downloadingId === slip.id}
                                >
                                  <i className="bi bi-file-earmark-pdf me-1" />
                                  {downloadingId === slip.id ? "PDF..." : "PDF"}
                                </button>
                                <button
                                  className="btn btn-outline-secondary"
                                  type="button"
                                  onClick={() => updateSlipStatus(slip, "published")}
                                  disabled={String(slip.status).toLowerCase() === "published" || String(slip.status).toLowerCase() === "paid"}
                                >
                                  Publish
                                </button>
                                <button
                                  className="btn btn-outline-success"
                                  type="button"
                                  onClick={() => updateSlipStatus(slip, "paid")}
                                  disabled={String(slip.status).toLowerCase() === "paid"}
                                >
                                  Paid
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {selectedSlip && (
            <div className="card bg-white" style={styles.softCard}>
              <div className="card-body p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                  <div>
                    <div className="badge bg-dark-subtle text-dark border border-dark-subtle mb-2">
                      Payslip Preview
                    </div>
                    <h5 className="mb-1 fw-bold">{selectedEmployeeForSlip.name || "Payslip Detail"}</h5>
                    <div className="text-muted small">
                      {selectedEmployeeForSlip.employee_id || "—"} • {monthLabel(selectedSlip.month)}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      className="btn btn-outline-dark btn-sm rounded-pill px-3"
                      type="button"
                      onClick={() => downloadPayslipPdf(selectedSlip)}
                      disabled={downloadingId === selectedSlip.id}
                    >
                      <i className="bi bi-file-earmark-pdf me-1" />
                      {downloadingId === selectedSlip.id ? "Downloading..." : "Download PDF"}
                    </button>
                    <button className="btn btn-outline-secondary btn-sm rounded-pill px-3" type="button" onClick={() => window.print()}>
                      <i className="bi bi-printer me-1" /> Print Page
                    </button>
                  </div>
                </div>

                <div className="row g-3 mb-4">
                  <div className="col-6 col-lg-3">
                    <div className="rounded-4 p-3 bg-success-subtle h-100">
                      <div className="small text-success fw-semibold">Net Salary</div>
                      <div className="fs-5 fw-bold text-success mt-1">{currency(selectedSlip.net_salary)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-lg-3">
                    <div className="rounded-4 p-3 bg-primary-subtle h-100">
                      <div className="small text-primary fw-semibold">Gross Paid</div>
                      <div className="fs-5 fw-bold text-primary mt-1">{currency(selectedSlip.gross_earnings)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-lg-3">
                    <div className="rounded-4 p-3 bg-danger-subtle h-100">
                      <div className="small text-danger fw-semibold">Deductions</div>
                      <div className="fs-5 fw-bold text-danger mt-1">{currency(selectedSlip.total_deductions)}</div>
                    </div>
                  </div>
                  <div className="col-6 col-lg-3">
                    <div className="rounded-4 p-3 bg-warning-subtle h-100">
                      <div className="small text-warning-emphasis fw-semibold">LOP Days</div>
                      <div className="fs-5 fw-bold text-warning-emphasis mt-1">{formatNumber(selectedSlip.loss_of_pay_days)}</div>
                    </div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-12 col-lg-4">
                    <div className="border rounded-4 p-3 h-100 bg-light-subtle">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-calendar-check text-primary" />
                        <div className="fw-bold">Attendance</div>
                      </div>
                      <DetailLine label="Working Days" value={formatNumber(selectedSlip.working_days)} />
                      <DetailLine label="Present" value={formatNumber(selectedSlip.present_days)} />
                      <DetailLine label="Paid Leave" value={formatNumber(selectedSlip.paid_leave_days)} />
                      <DetailLine label="Absent" value={formatNumber(selectedSlip.absent_days)} />
                      <DetailLine label="Loss of Pay" value={formatNumber(selectedSlip.loss_of_pay_days)} strong />
                      <DetailLine label="Unmarked" value={formatNumber(selectedSlip.unmarked_days)} />
                      <DetailLine label="Holidays" value={formatNumber(selectedSlip.holiday_days)} />
                    </div>
                  </div>

                  <div className="col-12 col-lg-4">
                    <div className="border rounded-4 p-3 h-100 bg-light-subtle">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-plus-circle text-success" />
                        <div className="fw-bold">Earnings</div>
                      </div>
                      {earningFields.map((field) => (
                        <DetailLine
                          key={field.key}
                          label={field.label}
                          value={currency(selectedComponents?.monthly_earnings?.[field.key])}
                        />
                      ))}
                      <DetailLine label="Monthly Gross" value={currency(selectedComponents?.monthly_gross)} strong />
                      <DetailLine label="Gross Paid" value={currency(selectedSlip.gross_earnings)} strong />
                    </div>
                  </div>

                  <div className="col-12 col-lg-4">
                    <div className="border rounded-4 p-3 h-100 bg-light-subtle">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-dash-circle text-danger" />
                        <div className="fw-bold">Deductions</div>
                      </div>
                      {deductionFields.map((field) => (
                        <DetailLine
                          key={field.key}
                          label={field.label}
                          value={currency(selectedComponents?.fixed_deductions?.[field.key])}
                        />
                      ))}
                      <DetailLine label="Attendance Deduction" value={currency(selectedComponents?.attendance_deduction)} />
                      <DetailLine label="Net Salary" value={currency(selectedSlip.net_salary)} strong />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}