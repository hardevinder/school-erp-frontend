import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";

const AISettings = () => {
  const [status, setStatus] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/ai-settings");
      setStatus(res.data?.data || null);
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Failed to load AI settings",
        text: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    const value = String(apiKey || "").trim();

    if (!value) {
      Swal.fire({
        icon: "warning",
        title: "API key required",
        text: "Paste the new AI API key first.",
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: "question",
      title: "Update AI API key?",
      text: "The new key will be used for future AI requests immediately.",
      showCancelButton: true,
      confirmButtonText: "Update Key",
    });

    if (!confirm.isConfirmed) return;

    try {
      setSaving(true);
      const res = await api.put("/ai-settings", { apiKey: value });
      setStatus(res.data?.data || null);
      setApiKey("");
      Swal.fire({
        icon: "success",
        title: "AI key updated",
        text: res.data?.message || "AI API key updated successfully.",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Failed to update key",
        text: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid" style={{ marginTop: 72 }}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <div>
          <h3 className="mb-1">AI Settings</h3>
          <div className="text-muted">Manage the OpenAI API key used by lesson plans, evaluations, and AI chat.</div>
        </div>

        <button className="btn btn-light ms-auto" onClick={loadSettings} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">OpenAI API Key</div>

            <div className="card-body">
              <div className="alert alert-info">
                <div className="fw-semibold mb-1">
                  Current Status:{" "}
                  {status?.hasApiKey ? (
                    <span className="badge text-bg-success">Configured</span>
                  ) : (
                    <span className="badge text-bg-warning">Not Set</span>
                  )}
                </div>
                <div className="small">
                  Saved key: {status?.hasApiKey ? status.apiKeyMasked : "No key configured"}
                </div>
              </div>

              <label className="form-label">New API Key</label>
              <div className="input-group">
                <input
                  className="form-control"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={status?.hasApiKey ? "Leave blank unless replacing key" : "Paste OpenAI API key"}
                  autoComplete="off"
                />
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>

              <div className="form-text">
                The full key is never shown after saving. Updating it changes runtime AI calls immediately.
              </div>
            </div>

            <div className="card-footer d-flex gap-2">
              <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save AI Key"}
              </button>
              <button className="btn btn-outline-secondary" onClick={() => setApiKey("")} disabled={saving}>
                Clear
              </button>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-7">
          <div className="card shadow-sm">
            <div className="card-header fw-semibold">Where This Key Is Used</div>
            <div className="card-body">
              <div className="row g-2">
                {["AI Chat", "Lesson Plan AI", "Lesson Plan Evaluations", "Admission Assessment AI", "AI Remarks"].map(
                  (label) => (
                    <div className="col-12 col-md-6" key={label}>
                      <div className="border rounded p-3 h-100">
                        <div className="fw-semibold">{label}</div>
                        <div className="small text-muted">Uses the backend OpenAI configuration.</div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="alert alert-secondary mt-3 small">
            <strong>Security note:</strong> Only admin and superadmin roles can open this page. Do not share API keys
            in screenshots or chat messages.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISettings;
