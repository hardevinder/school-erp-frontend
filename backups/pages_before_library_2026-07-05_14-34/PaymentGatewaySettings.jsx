import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";

const DEFAULT_FORM = {
  id: null,
  schoolId: 1,
  provider: "hdfc",
  mode: "production",

  merchantId: "",
  apiKey: "",
  saltOrSecret: "",
  clientId: "",

  baseUrl: "",
  paymentPageBase: "",
  gatewayUrl: "",
  createOrderUrl: "",

  successUrl: "",
  failureUrl: "",

  configJson: "",
  isActive: true,

  apiKeyMasked: "",
  saltOrSecretMasked: "",
  hasApiKey: false,
  hasSaltOrSecret: false,
};

function getProviderDefaults(provider, apiBase = "") {
  const p = String(provider || "").toLowerCase();

  if (p === "payu") {
    return {
      baseUrl: "https://secure.payu.in/_payment",
      successUrl: `${apiBase}/student-fee/payu-callback`,
      failureUrl: `${apiBase}/student-fee/payu-callback`,
      clientId: "",
      paymentPageBase: "",
      gatewayUrl: "",
      createOrderUrl: "",
    };
  }

  return {
    baseUrl: "https://smartgateway.hdfc.bank.in",
    paymentPageBase: "https://smartgateway.hdfc.bank.in/payment-page/order",
    gatewayUrl: "https://smartgateway.hdfc.bank.in/pgui/jsp/paymentrequest",
    createOrderUrl: "",
    successUrl: "",
    failureUrl: "",
    clientId: "hdfcmaster",
  };
}

const PaymentGatewaySettings = () => {
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const apiOrigin = useMemo(() => {
    try {
      const base =
        api?.defaults?.baseURL ||
        process.env.REACT_APP_API_URL ||
        process.env.REACT_APP_API_BASE_URL ||
        "";
      if (!base) return "";
      return String(base).replace(/\/api\/?$/, "").replace(/\/$/, "");
    } catch {
      return "";
    }
  }, []);

  const activeSetting = settings.find((s) => s.isActive);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/payment-gateway-settings", {
        params: { schoolId: 1 },
      });

      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setSettings(list);

      const active = list.find((x) => x.isActive) || list[0] || null;
      if (active) {
        setForm({
          ...DEFAULT_FORM,
          ...active,
          apiKey: "",
          saltOrSecret: "",
        });
      }
    } catch (err) {
      console.error("loadSettings error:", err);
      Swal.fire({
        icon: "error",
        title: "Failed to load settings",
        text: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProviderChange = (provider) => {
    const defaults = getProviderDefaults(provider, apiOrigin);
    setForm((prev) => ({
      ...prev,
      provider,
      ...defaults,
      apiKey: "",
      saltOrSecret: "",
      apiKeyMasked: "",
      saltOrSecretMasked: "",
      hasApiKey: false,
      hasSaltOrSecret: false,
    }));
  };

  const handleEdit = (row) => {
    setForm({
      ...DEFAULT_FORM,
      ...row,
      apiKey: "",
      saltOrSecret: "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNew = (provider = "hdfc") => {
    const defaults = getProviderDefaults(provider, apiOrigin);
    setForm({
      ...DEFAULT_FORM,
      provider,
      ...defaults,
      apiKey: "",
      saltOrSecret: "",
    });
  };

  const validate = () => {
    if (!form.provider) return "Provider is required.";
    if (!form.mode) return "Mode is required.";

    if (form.provider === "hdfc") {
      if (!form.merchantId) return "HDFC Merchant ID is required.";
      if (!form.clientId) return "HDFC Client ID is required.";
      if (!form.baseUrl) return "HDFC Base URL is required.";
    }

    if (form.provider === "payu") {
      if (!form.merchantId && !form.apiKey) return "PayU Key is required.";
      if (!form.baseUrl) return "PayU Base URL is required.";
      if (!form.successUrl) return "PayU Success URL is required.";
      if (!form.failureUrl) return "PayU Failure URL is required.";
      if (!form.hasSaltOrSecret && !form.saltOrSecret) {
        return "PayU Salt is required.";
      }
    }

    if (form.configJson) {
      try {
        JSON.parse(form.configJson);
      } catch {
        return "Config JSON is invalid.";
      }
    }

    return null;
  };

  const buildPayload = () => {
    const payload = {
      schoolId: Number(form.schoolId || 1),
      provider: form.provider,
      mode: form.mode,

      merchantId: form.merchantId || "",
      clientId: form.clientId || "",

      baseUrl: form.baseUrl || "",
      paymentPageBase: form.paymentPageBase || "",
      gatewayUrl: form.gatewayUrl || "",
      createOrderUrl: form.createOrderUrl || "",

      successUrl: form.successUrl || "",
      failureUrl: form.failureUrl || "",

      configJson: form.configJson || "",
      makeActive: form.isActive !== false,
    };

    // Important: only send secrets when admin typed new values.
    // Blank secrets preserve existing backend values.
    if (form.apiKey && String(form.apiKey).trim()) {
      payload.apiKey = String(form.apiKey).trim();
    }

    if (form.saltOrSecret && String(form.saltOrSecret).trim()) {
      payload.saltOrSecret = String(form.saltOrSecret).trim();
    }

    return payload;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      return Swal.fire({
        icon: "warning",
        title: "Check details",
        text: error,
      });
    }

    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "Save payment gateway?",
      text:
        form.isActive !== false
          ? "This provider will become active for this school."
          : "This setting will be saved but may not be active.",
      showCancelButton: true,
      confirmButtonText: "Yes, save",
    });

    if (!isConfirmed) return;

    try {
      setSaving(true);

      const payload = buildPayload();

      const res = await api.post("/payment-gateway-settings/save", payload);

      Swal.fire({
        icon: "success",
        title: "Saved",
        text: res.data?.message || "Payment gateway setting saved.",
        timer: 1600,
        showConfirmButton: false,
      });

      await loadSettings();
    } catch (err) {
      console.error("save settings error:", err);
      Swal.fire({
        icon: "error",
        title: "Save failed",
        text: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const activateSetting = async (row) => {
    try {
      const { isConfirmed } = await Swal.fire({
        icon: "question",
        title: `Activate ${String(row.provider).toUpperCase()}?`,
        text: "Other active gateway settings for this school will be disabled.",
        showCancelButton: true,
        confirmButtonText: "Activate",
      });

      if (!isConfirmed) return;

      await api.post(`/payment-gateway-settings/${row.id}/activate`);
      await loadSettings();

      Swal.fire({
        icon: "success",
        title: "Activated",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Activation failed",
        text: err?.response?.data?.message || "Please try again.",
      });
    }
  };

  const deactivateSetting = async (row) => {
    try {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: `Deactivate ${String(row.provider).toUpperCase()}?`,
        text: "Online payment may stop if no other active gateway exists.",
        showCancelButton: true,
        confirmButtonText: "Deactivate",
      });

      if (!isConfirmed) return;

      await api.post(`/payment-gateway-settings/${row.id}/deactivate`);
      await loadSettings();

      Swal.fire({
        icon: "success",
        title: "Deactivated",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Deactivation failed",
        text: err?.response?.data?.message || "Please try again.",
      });
    }
  };

  return (
    <div className="container-fluid" style={{ marginTop: 72 }}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div>
          <h3 className="mb-1">Payment Gateway Settings</h3>
          <div className="text-muted">
            Manage school-wise HDFC / PayU online payment configuration.
          </div>
        </div>

        <div className="ms-auto d-flex gap-2">
          <button
            className="btn btn-outline-primary"
            onClick={() => handleNew("hdfc")}
          >
            New HDFC
          </button>
          <button
            className="btn btn-outline-success"
            onClick={() => handleNew("payu")}
          >
            New PayU
          </button>
          <button className="btn btn-light" onClick={loadSettings}>
            Refresh
          </button>
        </div>
      </div>

      {activeSetting && (
        <div className="alert alert-info d-flex flex-wrap gap-2 align-items-center">
          <strong>Active Gateway:</strong>
          <span className="badge text-bg-primary">
            {String(activeSetting.provider).toUpperCase()}
          </span>
          <span>Mode: {activeSetting.mode}</span>
          <span>Merchant/Key: {activeSetting.merchantId || "—"}</span>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">
              {form.id ? "Edit Gateway Setting" : "Create Gateway Setting"}
            </div>

            <div className="card-body">
              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">School ID</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.schoolId}
                    onChange={(e) => updateForm("schoolId", e.target.value)}
                  />
                </div>

                <div className="col-6">
                  <label className="form-label">Provider</label>
                  <select
                    className="form-select"
                    value={form.provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                  >
                    <option value="hdfc">HDFC SmartGateway</option>
                    <option value="payu">PayU</option>
                  </select>
                </div>

                <div className="col-6">
                  <label className="form-label">Mode</label>
                  <select
                    className="form-select"
                    value={form.mode}
                    onChange={(e) => updateForm("mode", e.target.value)}
                  >
                    <option value="production">Production</option>
                    <option value="uat">UAT / Test</option>
                  </select>
                </div>

                <div className="col-6">
                  <label className="form-label">Active</label>
                  <select
                    className="form-select"
                    value={form.isActive ? "1" : "0"}
                    onChange={(e) => updateForm("isActive", e.target.value === "1")}
                  >
                    <option value="1">Yes, make active</option>
                    <option value="0">No</option>
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">
                    {form.provider === "payu" ? "PayU Key" : "Merchant ID"}
                  </label>
                  <input
                    className="form-control"
                    value={form.merchantId || ""}
                    onChange={(e) => updateForm("merchantId", e.target.value)}
                    placeholder={form.provider === "payu" ? "PayU Key" : "HDFC Merchant ID"}
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">
                    API Key
                    {form.hasApiKey && (
                      <span className="text-muted ms-2">
                        saved: {form.apiKeyMasked}
                      </span>
                    )}
                  </label>
                  <input
                    className="form-control"
                    value={form.apiKey || ""}
                    onChange={(e) => updateForm("apiKey", e.target.value)}
                    placeholder={
                      form.hasApiKey
                        ? "Leave blank to keep existing"
                        : form.provider === "payu"
                        ? "PayU Key"
                        : "HDFC API Key"
                    }
                  />
                </div>

                <div className="col-12">
                  <label className="form-label">
                    Salt / Secret
                    {form.hasSaltOrSecret && (
                      <span className="text-muted ms-2">
                        saved: {form.saltOrSecretMasked}
                      </span>
                    )}
                  </label>
                  <input
                    className="form-control"
                    value={form.saltOrSecret || ""}
                    onChange={(e) => updateForm("saltOrSecret", e.target.value)}
                    placeholder={
                      form.hasSaltOrSecret
                        ? "Leave blank to keep existing"
                        : form.provider === "payu"
                        ? "PayU Salt"
                        : "HDFC Response Key"
                    }
                  />
                </div>

                {form.provider === "hdfc" && (
                  <>
                    <div className="col-12">
                      <label className="form-label">Client ID</label>
                      <input
                        className="form-control"
                        value={form.clientId || ""}
                        onChange={(e) => updateForm("clientId", e.target.value)}
                        placeholder="hdfcmaster"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Payment Page Base</label>
                      <input
                        className="form-control"
                        value={form.paymentPageBase || ""}
                        onChange={(e) =>
                          updateForm("paymentPageBase", e.target.value)
                        }
                        placeholder="https://smartgateway.hdfc.bank.in/payment-page/order"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Gateway URL</label>
                      <input
                        className="form-control"
                        value={form.gatewayUrl || ""}
                        onChange={(e) => updateForm("gatewayUrl", e.target.value)}
                        placeholder="https://smartgateway.hdfc.bank.in/pgui/jsp/paymentrequest"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Create Order URL</label>
                      <input
                        className="form-control"
                        value={form.createOrderUrl || ""}
                        onChange={(e) =>
                          updateForm("createOrderUrl", e.target.value)
                        }
                        placeholder="Optional"
                      />
                    </div>
                  </>
                )}

                <div className="col-12">
                  <label className="form-label">Base URL</label>
                  <input
                    className="form-control"
                    value={form.baseUrl || ""}
                    onChange={(e) => updateForm("baseUrl", e.target.value)}
                    placeholder={
                      form.provider === "payu"
                        ? "https://secure.payu.in/_payment"
                        : "https://smartgateway.hdfc.bank.in"
                    }
                  />
                </div>

                {form.provider === "payu" && (
                  <>
                    <div className="col-12">
                      <label className="form-label">Success URL</label>
                      <input
                        className="form-control"
                        value={form.successUrl || ""}
                        onChange={(e) => updateForm("successUrl", e.target.value)}
                        placeholder="https://api-domain/student-fee/payu-callback"
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Failure URL</label>
                      <input
                        className="form-control"
                        value={form.failureUrl || ""}
                        onChange={(e) => updateForm("failureUrl", e.target.value)}
                        placeholder="https://api-domain/student-fee/payu-callback"
                      />
                    </div>
                  </>
                )}

                <div className="col-12">
                  <label className="form-label">Extra Config JSON</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={form.configJson || ""}
                    onChange={(e) => updateForm("configJson", e.target.value)}
                    placeholder='{"enableLogging":false}'
                  />
                </div>
              </div>
            </div>

            <div className="card-footer d-flex gap-2">
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? "Saving..." : "Save Setting"}
              </button>

              <button
                className="btn btn-outline-secondary"
                onClick={() => handleNew(form.provider)}
                disabled={saving}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">Saved Settings</div>

            <div className="card-body">
              {loading ? (
                <div className="text-muted">Loading...</div>
              ) : settings.length === 0 ? (
                <div className="alert alert-warning mb-0">
                  No payment gateway settings found.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-bordered align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>ID</th>
                        <th>Provider</th>
                        <th>Mode</th>
                        <th>Merchant/Key</th>
                        <th>Secrets</th>
                        <th>Active</th>
                        <th style={{ width: 190 }}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {settings.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>
                            <span
                              className={`badge ${
                                row.provider === "payu"
                                  ? "text-bg-success"
                                  : "text-bg-primary"
                              }`}
                            >
                              {String(row.provider).toUpperCase()}
                            </span>
                          </td>
                          <td>{row.mode}</td>
                          <td>{row.merchantId || "—"}</td>
                          <td>
                            <div className="small">
                              API: {row.hasApiKey ? row.apiKeyMasked : "Not set"}
                            </div>
                            <div className="small">
                              Secret:{" "}
                              {row.hasSaltOrSecret
                                ? row.saltOrSecretMasked
                                : "Not set"}
                            </div>
                          </td>
                          <td>
                            {row.isActive ? (
                              <span className="badge text-bg-success">Active</span>
                            ) : (
                              <span className="badge text-bg-secondary">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1">
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEdit(row)}
                              >
                                Edit
                              </button>

                              {!row.isActive ? (
                                <button
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => activateSetting(row)}
                                >
                                  Activate
                                </button>
                              ) : (
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => deactivateSetting(row)}
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="alert alert-secondary mt-3 small">
            <strong>Note:</strong> For security, saved API key and salt/secret are
            masked. Leave secret fields blank while editing to keep existing values.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentGatewaySettings;