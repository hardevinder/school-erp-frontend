import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

const AUTH_KEYS = [
  "token",
  "roles",
  "activeRole",
  "permissions",
  "family",
  "activeStudentAdmission",
  "username",
  "userId",
  "user_id",
  "name",
  "email",
];

function clearBrowserSession() {
  for (const key of AUTH_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  delete axios.defaults.headers.common.Authorization;
}

function PasswordField({ label, value, onChange, autoComplete, disabled }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-3">
      <label className="form-label fw-semibold">{label}</label>
      <div className="input-group">
        <span className="input-group-text bg-white">
          <i className="bi bi-lock" />
        </span>
        <input
          className="form-control"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          required
        />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
        >
          <i className={`bi ${visible ? "bi-eye-slash" : "bi-eye"}`} />
        </button>
      </div>
    </div>
  );
}

export default function ChangePassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validationMessage = useMemo(() => {
    if (!newPassword && !confirmNewPassword) return "";
    if (newPassword.length < 6) return "Use at least 6 characters.";
    if (currentPassword && newPassword === currentPassword)
      return "New password must be different from the current password.";
    if (confirmNewPassword && newPassword !== confirmNewPassword)
      return "Passwords do not match.";
    return "";
  }, [currentPassword, newPassword, confirmNewPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Please fill all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      setError("Your login session is missing. Please sign in again.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.put(
        `${API_BASE}/users/change-password`,
        { currentPassword, newPassword, confirmNewPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(
        data?.message || "Password changed successfully. Please sign in again."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      window.setTimeout(() => {
        clearBrowserSession();
        navigate("/login", { replace: true });
      }, 1200);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to change password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6 col-xl-5">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-body p-4 p-md-5">
              <div className="d-flex align-items-center gap-3 mb-4">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 52, height: 52, background: "#eef2ff" }}
                >
                  <i className="bi bi-shield-lock fs-4 text-primary" />
                </div>
                <div>
                  <h3 className="mb-1">Change Password</h3>
                  <div className="text-muted small">
                    For security, changing your password signs you out from all devices.
                  </div>
                </div>
              </div>

              {error && <div className="alert alert-danger py-2">{error}</div>}
              {success && (
                <div className="alert alert-success py-2">{success}</div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <PasswordField
                  label="Current Password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                  disabled={loading || !!success}
                />
                <PasswordField
                  label="New Password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  disabled={loading || !!success}
                />
                <PasswordField
                  label="Confirm New Password"
                  value={confirmNewPassword}
                  onChange={setConfirmNewPassword}
                  autoComplete="new-password"
                  disabled={loading || !!success}
                />

                {validationMessage && !error && (
                  <div className="small text-muted mb-3">{validationMessage}</div>
                )}

                <div className="d-flex gap-2 justify-content-end mt-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={loading || !!success}
                    onClick={() => navigate(-1)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary px-4"
                    disabled={loading || !!success}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-key me-2" />
                        Change Password
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
