import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

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

const monthLabel = (month) => {
  const dt = new Date((month || "") + "-01T00:00:00");
  if (Number.isNaN(dt.getTime())) return month || "";
  return dt.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const formatDate = (value) => {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value).slice(0, 10) || "-";
  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const labelize = (key) =>
  String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const parseComponents = (components) => {
  if (!components) return {};
  if (typeof components === "object") return components;
  try {
    return JSON.parse(components);
  } catch (_) {
    return {};
  }
};

const statusClass = (status) => {
  const s = String(status || "draft").toLowerCase();
  if (s === "paid") return "bg-success";
  if (s === "published") return "bg-primary";
  if (s === "cancelled") return "bg-danger";
  return "bg-secondary";
};

const statusSoftClass = (status) => {
  const s = String(status || "draft").toLowerCase();
  if (s === "paid") return "border-success text-success bg-success bg-opacity-10";
  if (s === "published") return "border-primary text-primary bg-primary bg-opacity-10";
  if (s === "cancelled") return "border-danger text-danger bg-danger bg-opacity-10";
  return "border-secondary text-secondary bg-secondary bg-opacity-10";
};

const getSlipEmployee = (slip, fallbackEmployee) => {
  const components = parseComponents(slip?.components);
  return slip?.employee || components.employee || fallbackEmployee || {};
};

const componentEntries = (obj = {}) =>
  Object.entries(obj || {}).filter(([, value]) => Number(value || 0) !== 0);

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

function SummaryCard({ icon, label, value, hint, className = "" }) {
  return (
    <div className="col-6 col-xl-3">
      <div className={`card border-0 shadow-sm h-100 overflow-hidden ${className}`}>
        <div className="card-body position-relative">
          <div
            className="position-absolute top-0 end-0 rounded-circle bg-white bg-opacity-25"
            style={{ width: 86, height: 86, transform: "translate(28px, -34px)" }}
          />
          <div className="d-flex align-items-center gap-2 mb-2">
            <div
              className="rounded-3 d-inline-flex align-items-center justify-content-center bg-white bg-opacity-25"
              style={{ width: 38, height: 38 }}
            >
              <i className={`bi ${icon}`} />
            </div>
            <div className="small opacity-75">{label}</div>
          </div>
          <div className="fs-5 fw-bold lh-sm">{value}</div>
          {hint ? <div className="small opacity-75 mt-1">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}

function TinyMetric({ label, value, icon }) {
  return (
    <div className="col-6 col-md-3">
      <div className="border rounded-4 p-3 h-100 bg-light bg-opacity-50">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <div className="small text-muted">{label}</div>
          {icon ? <i className={`bi ${icon} text-muted`} /> : null}
        </div>
        <div className="fs-5 fw-bold text-dark">{value}</div>
      </div>
    </div>
  );
}

function MoneyRow({ label, value, strong = false }) {
  return (
    <div className="d-flex justify-content-between align-items-center gap-3 py-1">
      <span className={strong ? "fw-semibold" : "text-muted"}>{label}</span>
      <span className={strong ? "fw-bold" : "fw-semibold"}>{currency(value)}</span>
    </div>
  );
}

export default function MyPayslips() {
  const [month, setMonth] = useState("");
  const [employee, setEmployee] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [selectedSlip, setSelectedSlip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/payroll/my-slips", {
        params: month ? { month } : {},
      });

      const rows = res.data?.payslips || [];
      setEmployee(res.data?.employee || null);
      setPayslips(rows);
      setSelectedSlip((current) => {
        if (!current) return rows[0] || null;
        return rows.find((item) => Number(item.id) === Number(current.id)) || rows[0] || null;
      });
    } catch (err) {
      setPayslips([]);
      setSelectedSlip(null);
      Swal.fire("Error", err.response?.data?.message || "Failed to load payslips", "error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  const selectedComponents = useMemo(
    () => parseComponents(selectedSlip?.components),
    [selectedSlip]
  );

  const selectedEmployee = useMemo(
    () => getSlipEmployee(selectedSlip, employee),
    [selectedSlip, employee]
  );

  const totals = useMemo(() => {
    return payslips.reduce(
      (acc, slip) => {
        acc.gross += numberValue(slip.gross_earnings);
        acc.deductions += numberValue(slip.total_deductions);
        acc.net += numberValue(slip.net_salary);
        if (String(slip.status || "").toLowerCase() === "paid") acc.paidCount += 1;
        return acc;
      },
      { gross: 0, deductions: 0, net: 0, paidCount: 0 }
    );
  }, [payslips]);

  const latestSlip = payslips[0] || null;

  const downloadPayslipPdf = async (slip) => {
    if (!slip?.id) return;

    setDownloadingId(slip.id);
    try {
      const res = await api.get(`/payroll/my-slips/${slip.id}/pdf`, {
        responseType: "blob",
      });

      const emp = getSlipEmployee(slip, employee);
      const filename = `Payslip_${emp.employee_id || "Employee"}_${slip.month || "Month"}.pdf`.replace(
        /[^\w.-]+/g,
        "_"
      );

      downloadBlob(new Blob([res.data], { type: "application/pdf" }), filename);
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Failed to download payslip PDF", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const clearMonth = () => {
    setMonth("");
  };

  return (
    <div className="container-fluid py-3">
      <div
        className="rounded-4 p-3 p-lg-4 mb-3 text-white shadow-sm position-relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #123524 0%, #1f6f4a 55%, #0f172a 100%)" }}
      >
        <div
          className="position-absolute rounded-circle bg-white bg-opacity-10"
          style={{ width: 220, height: 220, right: -70, top: -90 }}
        />
        <div
          className="position-absolute rounded-circle bg-warning bg-opacity-25"
          style={{ width: 150, height: 150, right: 90, bottom: -90 }}
        />

        <div className="position-relative d-flex flex-wrap justify-content-between align-items-end gap-3">
          <div>
            <div className="badge bg-white text-success rounded-pill px-3 py-2 mb-2">
              Employee Self Service
            </div>
            <h3 className="fw-bold mb-1">My Payslips</h3>
            <div className="text-white-50">
              {employee?.name || "Employee"}
              {employee?.employee_id ? ` • ${employee.employee_id}` : ""}
              {employee?.designation ? ` • ${employee.designation}` : ""}
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label mb-1 text-white-50">Month</label>
              <input
                type="month"
                className="form-control border-0 shadow-sm"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>
            <button className="btn btn-light" type="button" onClick={clearMonth} disabled={!month || loading}>
              Clear
            </button>
            <button className="btn btn-warning" type="button" onClick={fetchPayslips} disabled={loading}>
              <i className={`bi ${loading ? "bi-hourglass-split" : "bi-arrow-clockwise"} me-1`} />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <SummaryCard
          icon="bi-file-earmark-text"
          label="Published Slips"
          value={payslips.length}
          hint={month ? monthLabel(month) : "All available months"}
          className="bg-primary text-white"
        />
        <SummaryCard
          icon="bi-cash-stack"
          label="Total Net Salary"
          value={currency(totals.net)}
          hint="For listed payslips"
          className="bg-success text-white"
        />
        <SummaryCard
          icon="bi-receipt"
          label="Total Deductions"
          value={currency(totals.deductions)}
          hint="For listed payslips"
          className="bg-danger text-white"
        />
        <SummaryCard
          icon="bi-check2-circle"
          label="Paid Slips"
          value={totals.paidCount}
          hint={latestSlip ? `Latest: ${monthLabel(latestSlip.month)}` : "No latest slip"}
          className="bg-dark text-white"
        />
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-5 col-xl-4">
          <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
            <div className="card-header bg-white border-0 p-3">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <h5 className="mb-1 fw-bold">Payslip History</h5>
                  <div className="text-muted small">Select a month to view details</div>
                </div>
                <span className="badge rounded-pill bg-light text-dark border">{payslips.length}</span>
              </div>
            </div>

            <div className="card-body pt-0">
              {payslips.length === 0 ? (
                <div className="text-center py-5">
                  <div
                    className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3"
                    style={{ width: 70, height: 70 }}
                  >
                    <i className="bi bi-file-earmark-x fs-3 text-muted" />
                  </div>
                  <div className="fw-semibold">{loading ? "Loading payslips..." : "No payslips published yet"}</div>
                  <div className="small text-muted mt-1">
                    Published or paid payslips will appear here.
                  </div>
                </div>
              ) : (
                <div className="d-grid gap-2">
                  {payslips.map((slip) => {
                    const active = Number(selectedSlip?.id) === Number(slip.id);
                    return (
                      <button
                        type="button"
                        key={slip.id}
                        className={`btn text-start rounded-4 border p-3 ${
                          active ? "btn-primary border-primary shadow-sm" : "btn-light bg-white"
                        }`}
                        onClick={() => setSelectedSlip(slip)}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div>
                            <div className="fw-bold">{monthLabel(slip.month)}</div>
                            <div className={active ? "small text-white-50" : "small text-muted"}>
                              Net Salary
                            </div>
                            <div className="fs-5 fw-bold mt-1">{currency(slip.net_salary)}</div>
                          </div>
                          <span className={`badge ${active ? "bg-white text-primary" : statusClass(slip.status)}`}>
                            {slip.status || "draft"}
                          </span>
                        </div>
                        <div className={`small mt-2 ${active ? "text-white-50" : "text-muted"}`}>
                          Working {Number(slip.working_days || 0)} • LOP {Number(slip.loss_of_pay_days || 0)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7 col-xl-8">
          {!selectedSlip ? (
            <div className="card border-0 shadow-sm rounded-4 h-100">
              <div className="card-body d-flex align-items-center justify-content-center text-muted py-5">
                <div className="text-center">
                  <i className="bi bi-receipt fs-1 d-block mb-2" />
                  Select a payslip to view details.
                </div>
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
              <div className="card-body p-0">
                <div
                  className="p-3 p-lg-4 text-white"
                  style={{ background: "linear-gradient(135deg, #0f172a 0%, #123524 100%)" }}
                >
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                      <div className="small text-white-50 mb-1">Payslip Detail</div>
                      <h4 className="fw-bold mb-1">{monthLabel(selectedSlip.month)}</h4>
                      <div className="text-white-50">
                        {selectedEmployee?.name || employee?.name || "Employee"}
                        {selectedEmployee?.designation ? ` • ${selectedEmployee.designation}` : ""}
                      </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <span className={`badge rounded-pill px-3 py-2 ${statusClass(selectedSlip.status)}`}>
                        {selectedSlip.status || "draft"}
                      </span>
                      <button
                        className="btn btn-warning btn-sm"
                        type="button"
                        onClick={() => downloadPayslipPdf(selectedSlip)}
                        disabled={downloadingId === selectedSlip.id}
                      >
                        <i className={`bi ${downloadingId === selectedSlip.id ? "bi-hourglass-split" : "bi-download"} me-1`} />
                        {downloadingId === selectedSlip.id ? "Downloading..." : "PDF"}
                      </button>
                    </div>
                  </div>

                  <div className="row g-3 mt-2">
                    <div className="col-12 col-md-4">
                      <div className="bg-white bg-opacity-10 rounded-4 p-3 h-100">
                        <div className="small text-white-50">Net Salary</div>
                        <div className="fs-3 fw-bold">{currency(selectedSlip.net_salary)}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4">
                      <div className="bg-white bg-opacity-10 rounded-4 p-3 h-100">
                        <div className="small text-white-50">Gross Paid</div>
                        <div className="fs-5 fw-bold">{currency(selectedSlip.gross_earnings)}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4">
                      <div className="bg-white bg-opacity-10 rounded-4 p-3 h-100">
                        <div className="small text-white-50">Deductions</div>
                        <div className="fs-5 fw-bold">{currency(selectedSlip.total_deductions)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 p-lg-4">
                  <div className="row g-3 mb-3">
                    <TinyMetric label="Working" value={Number(selectedSlip.working_days || 0)} icon="bi-calendar-week" />
                    <TinyMetric label="Present" value={Number(selectedSlip.present_days || 0)} icon="bi-person-check" />
                    <TinyMetric label="Paid Leave" value={Number(selectedSlip.paid_leave_days || 0)} icon="bi-sun" />
                    <TinyMetric label="LOP" value={Number(selectedSlip.loss_of_pay_days || 0)} icon="bi-calendar-x" />
                    <TinyMetric label="Absent" value={Number(selectedSlip.absent_days || 0)} icon="bi-person-x" />
                    <TinyMetric label="Short Leave" value={Number(selectedSlip.short_leave_days || 0)} icon="bi-clock-history" />
                    <TinyMetric label="Holidays" value={Number(selectedSlip.holiday_days || 0)} icon="bi-calendar-heart" />
                    <TinyMetric label="Unmarked" value={Number(selectedSlip.unmarked_days || 0)} icon="bi-question-circle" />
                  </div>

                  <div className="row g-3">
                    <div className="col-12 col-xl-6">
                      <div className="border rounded-4 p-3 h-100 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="mb-0 fw-bold text-success">
                            <i className="bi bi-plus-circle me-1" /> Earnings
                          </h6>
                          <span className="badge bg-success bg-opacity-10 text-success border border-success">
                            Credit
                          </span>
                        </div>

                        {componentEntries(selectedComponents.monthly_earnings).length === 0 ? (
                          <div className="text-muted small py-2">No earning components found.</div>
                        ) : (
                          componentEntries(selectedComponents.monthly_earnings).map(([key, value]) => (
                            <MoneyRow key={key} label={labelize(key)} value={value} />
                          ))
                        )}

                        <hr />
                        <MoneyRow label="Gross Paid" value={selectedSlip.gross_earnings} strong />
                      </div>
                    </div>

                    <div className="col-12 col-xl-6">
                      <div className="border rounded-4 p-3 h-100 bg-white">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="mb-0 fw-bold text-danger">
                            <i className="bi bi-dash-circle me-1" /> Deductions
                          </h6>
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">
                            Debit
                          </span>
                        </div>

                        {componentEntries(selectedComponents.fixed_deductions).length === 0 ? (
                          <div className="text-muted small py-2">No fixed deductions found.</div>
                        ) : (
                          componentEntries(selectedComponents.fixed_deductions).map(([key, value]) => (
                            <MoneyRow key={key} label={labelize(key)} value={value} />
                          ))
                        )}

                        {numberValue(selectedComponents.attendance_deduction) > 0 ? (
                          <MoneyRow label="Attendance Deduction" value={selectedComponents.attendance_deduction} />
                        ) : null}

                        <hr />
                        <MoneyRow label="Net Salary" value={selectedSlip.net_salary} strong />
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 mt-1">
                    <div className="col-12 col-lg-7">
                      <div className="border rounded-4 p-3 bg-light bg-opacity-50 h-100">
                        <h6 className="fw-bold mb-3">Employee & Bank Info</h6>
                        <div className="row g-2 small">
                          <div className="col-6">
                            <div className="text-muted">Employee ID</div>
                            <div className="fw-semibold">{selectedEmployee?.employee_id || "-"}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted">Department</div>
                            <div className="fw-semibold">{selectedEmployee?.department?.name || "-"}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted">Bank Name</div>
                            <div className="fw-semibold">{selectedEmployee?.bank_name || "-"}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted">IFSC</div>
                            <div className="fw-semibold">{selectedEmployee?.ifsc_code || "-"}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted">Published</div>
                            <div className="fw-semibold">{formatDate(selectedSlip.published_at)}</div>
                          </div>
                          <div className="col-6">
                            <div className="text-muted">Paid</div>
                            <div className="fw-semibold">{formatDate(selectedSlip.paid_at)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-12 col-lg-5">
                      <div className={`border rounded-4 p-3 h-100 ${statusSoftClass(selectedSlip.status)}`}>
                        <h6 className="fw-bold mb-2">Status</h6>
                        <div className="fs-5 fw-bold text-capitalize">{selectedSlip.status || "draft"}</div>
                        <div className="small mt-2">
                          Download the official PDF payslip for record keeping.
                        </div>
                        <button
                          className="btn btn-sm btn-dark mt-3 w-100"
                          type="button"
                          onClick={() => downloadPayslipPdf(selectedSlip)}
                          disabled={downloadingId === selectedSlip.id}
                        >
                          <i className="bi bi-file-earmark-pdf me-1" />
                          {downloadingId === selectedSlip.id ? "Preparing PDF..." : "Download Official PDF"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedSlip.remarks ? (
                    <div className="alert alert-light border rounded-4 mt-3 mb-0">
                      <div className="fw-semibold mb-1">Remarks</div>
                      {selectedSlip.remarks}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}