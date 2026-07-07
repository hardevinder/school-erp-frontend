// src/pages/WhatsAppApiSettings.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import {
  exchangeEmbeddedSignupCode,
  getWhatsAppStatus,
  listWhatsAppTemplates,
  syncWhatsAppStatus,
} from "../services/whatsappApi";
import "./WhatsAppApiSettings.css";

const DEFAULT_GRAPH_VERSION = "v23.0";

const safeJsonParse = (value, fallback = null) => {
  try {
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getEnv = (key, fallback = "") => {
  const value = process.env[key];
  return value === undefined || value === null ? fallback : String(value).trim();
};

const getInitialSchoolId = () => {
  const query = new URLSearchParams(window.location.search);
  const fromQuery = query.get("schoolId") || query.get("school_id");
  const fromStorage =
    localStorage.getItem("schoolId") ||
    localStorage.getItem("school_id") ||
    localStorage.getItem("activeSchoolId") ||
    localStorage.getItem("selectedSchoolId");

  const userLike =
    safeJsonParse(localStorage.getItem("user")) ||
    safeJsonParse(localStorage.getItem("currentUser")) ||
    safeJsonParse(localStorage.getItem("profile")) ||
    {};

  const fromUser = userLike.schoolId || userLike.school_id || userLike.school?.id;
  const raw = fromQuery || fromStorage || fromUser || 1;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? String(id) : "1";
};

const normalizeStatus = (raw) => {
  const data = raw?.data || raw?.setting || raw?.whatsapp || raw || null;
  if (!data || typeof data !== "object") return null;
  return data;
};

const normalizeList = (raw) => {
  const value = raw?.data || raw?.templates || raw?.items || raw;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const getBrowserRedirectUri = () => {
  const { origin, pathname } = window.location;
  const cleanPath = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return `${origin}${cleanPath}`;
};

const loadFacebookSdk = ({ appId, graphVersion }) => {
  return new Promise((resolve, reject) => {
    if (!appId) return reject(new Error("REACT_APP_META_APP_ID is missing."));

    const init = () => {
      if (!window.FB) return reject(new Error("Facebook SDK could not be loaded."));

      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: graphVersion || DEFAULT_GRAPH_VERSION,
      });

      resolve(window.FB);
    };

    if (window.FB) return init();

    window.fbAsyncInit = init;

    const existing = document.getElementById("facebook-jssdk");

    if (existing) {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts += 1;

        if (window.FB) {
          window.clearInterval(timer);
          init();
        }

        if (attempts >= 50) {
          window.clearInterval(timer);
          reject(new Error("Facebook SDK loading timed out."));
        }
      }, 100);

      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onerror = () => reject(new Error("Failed to load Facebook SDK."));
    document.body.appendChild(script);
  });
};

const buildSignupExtras = () => {
  const extrasFromEnv = safeJsonParse(getEnv("REACT_APP_META_EXTRAS_JSON"), null);
  if (extrasFromEnv && typeof extrasFromEnv === "object") return extrasFromEnv;

  const featureType = getEnv("REACT_APP_META_FEATURE_TYPE", "");
  const extras = {
    setup: {},
    sessionInfoVersion: "3",
  };

  if (featureType) extras.featureType = featureType;
  return extras;
};

const fieldValue = (obj, keys = []) => {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && String(obj[key]).trim() !== "") {
      return obj[key];
    }
  }

  return "—";
};

const StatusBadge = ({ status }) => {
  const value = String(status || "not_connected").toLowerCase();
  const connected = ["connected", "active", "verified", "approved"].includes(value);
  const pending = ["pending", "in_progress", "review"].includes(value);

  return (
    <span
      className={`wa-status-badge ${
        connected ? "wa-status-connected" : pending ? "wa-status-pending" : "wa-status-off"
      }`}
    >
      {connected ? "Connected" : pending ? "Pending" : "Not Connected"}
    </span>
  );
};

export default function WhatsAppApiSettings() {
  const [schoolId, setSchoolId] = useState(getInitialSchoolId);
  const [status, setStatus] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSessionInfo, setLastSessionInfo] = useState(null);

  const sessionInfoRef = useRef(null);

  const appId = useMemo(() => getEnv("REACT_APP_META_APP_ID"), []);
  const configId = useMemo(() => getEnv("REACT_APP_META_CONFIG_ID"), []);
  const graphVersion = useMemo(
    () => getEnv("REACT_APP_META_GRAPH_VERSION", DEFAULT_GRAPH_VERSION),
    []
  );

  const sid = useMemo(() => {
    const n = Number(schoolId || 1);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [schoolId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [statusRes, templateRes] = await Promise.allSettled([
        getWhatsAppStatus(sid),
        listWhatsAppTemplates(sid),
      ]);

      if (statusRes.status === "fulfilled") {
        setStatus(normalizeStatus(statusRes.value));
      } else {
        setStatus(null);
      }

      if (templateRes.status === "fulfilled") {
        setTemplates(normalizeList(templateRes.value));
      } else {
        setTemplates([]);
      }
    } catch (err) {
      console.error("WhatsApp settings load error:", err);

      Swal.fire({
        icon: "error",
        title: "Failed to load WhatsApp settings",
        text: err?.response?.data?.message || err?.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [sid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handler = (event) => {
      if (!String(event.origin || "").includes("facebook.com")) return;

      const payload = typeof event.data === "string" ? safeJsonParse(event.data, null) : event.data;
      if (!payload || payload.type !== "WA_EMBEDDED_SIGNUP") return;

      sessionInfoRef.current = payload;
      setLastSessionInfo(payload);

      if (payload.event === "FINISH") {
        console.log("WhatsApp Embedded Signup finished:", payload);
      } else if (payload.event === "CANCEL") {
        console.warn("WhatsApp Embedded Signup cancelled:", payload);
      } else if (payload.event === "ERROR") {
        console.error("WhatsApp Embedded Signup error:", payload);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const validateMetaConfig = () => {
    if (!appId) return "REACT_APP_META_APP_ID is missing in frontend .env.";
    if (!configId) return "REACT_APP_META_CONFIG_ID is missing in frontend .env.";
    if (!sid) return "School ID is required.";
    return null;
  };

  const handleEmbeddedSignupResponse = async (response) => {
    try {
      const code = response?.authResponse?.code;

      if (!code) {
        const message =
          response?.status === "not_authorized"
            ? "Facebook login was not authorized."
            : response?.status === "unknown"
            ? "Meta signup was cancelled or popup was closed."
            : "No authorization code received from Meta.";

        throw new Error(message);
      }

      const sessionInfo = sessionInfoRef.current || lastSessionInfo || null;
      const finishData = sessionInfo?.data || {};
      const browserRedirectUri = getBrowserRedirectUri();
      const currentHref = window.location.href.split("#")[0];

      console.info("WhatsApp Embedded Signup code exchange", {
        sendRedirectUri: false,
        browserRedirectUri,
        currentHref,
      });

      const payload = {
        code,
        schoolId: sid,
        configId,
        graphVersion,

        // IMPORTANT:
        // Do not send redirect_uri for Meta WhatsApp Embedded Signup JS SDK popup flow.
        // Backend exchange should also exchange code without redirect_uri.
        redirectUri: "",
        redirect_uri: "",

        browserRedirectUri,
        browser_redirect_uri: browserRedirectUri,
        currentHref,
        current_href: currentHref,
        sessionInfo,
        businessId: finishData.business_id || finishData.businessId || null,
        wabaId:
          finishData.waba_id ||
          finishData.wabaId ||
          finishData.whatsapp_business_account_id ||
          null,
        phoneNumberId: finishData.phone_number_id || finishData.phoneNumberId || null,
      };

      const result = await exchangeEmbeddedSignupCode(payload);

      Swal.fire({
        icon: "success",
        title: "WhatsApp Connected",
        text: result?.message || "WhatsApp Business connection saved successfully.",
        timer: 1800,
        showConfirmButton: false,
      });

      await loadData();
    } catch (err) {
      console.error("Embedded Signup exchange error:", err);

      Swal.fire({
        icon: "error",
        title: "Connection failed",
        text: err?.response?.data?.message || err?.message || "Please try again.",
      });
    } finally {
      setConnecting(false);
    }
  };

  const startEmbeddedSignup = async () => {
    const configError = validateMetaConfig();

    if (configError) {
      return Swal.fire({
        icon: "warning",
        title: "Meta config missing",
        text: configError,
      });
    }

    try {
      setConnecting(true);
      sessionInfoRef.current = null;
      setLastSessionInfo(null);

      const FB = await loadFacebookSdk({ appId, graphVersion });
      const extras = buildSignupExtras();

      console.info("Starting WhatsApp Embedded Signup", {
        appId,
        configId,
        graphVersion,
        sendRedirectUri: false,
      });

      FB.login(
        function (response) {
          handleEmbeddedSignupResponse(response).catch((err) => {
            console.error("Embedded Signup handler error:", err);

            setConnecting(false);

            Swal.fire({
              icon: "error",
              title: "Connection failed",
              text: err?.response?.data?.message || err?.message || "Please try again.",
            });
          });
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras,
        }
      );
    } catch (err) {
      console.error("Embedded Signup start error:", err);

      setConnecting(false);

      Swal.fire({
        icon: "error",
        title: "Unable to start Meta signup",
        text: err?.message || "Please check Meta App ID and browser popup settings.",
      });
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);

      const res = await syncWhatsAppStatus(sid);

      Swal.fire({
        icon: "success",
        title: "Synced",
        text: res?.message || "WhatsApp status synced successfully.",
        timer: 1400,
        showConfirmButton: false,
      });

      await loadData();
    } catch (err) {
      console.error("WhatsApp sync error:", err);

      Swal.fire({
        icon: "error",
        title: "Sync failed",
        text: err?.response?.data?.message || err?.message || "Please try again.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const connected =
    !!status &&
    ["connected", "active", "verified", "approved"].includes(
      String(status.status || status.connectionStatus || "").toLowerCase()
    );

  return (
    <div className="container-fluid wa-settings-page" style={{ marginTop: 72 }}>
      <div className="wa-hero-card mb-4">
        <div className="d-flex flex-column flex-lg-row gap-3 align-items-start align-items-lg-center">
          <div className="wa-hero-icon">
            <i className="bi bi-whatsapp" />
          </div>

          <div className="flex-grow-1">
            <div className="wa-kicker">Meta WhatsApp Cloud API</div>
            <h3 className="mb-1">WhatsApp API Settings</h3>
            <p className="mb-0 text-muted">
              Connect a school WhatsApp Business number with ERP for circulars, fee reminders,
              attendance alerts, diary updates and approved template messages.
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-light" onClick={loadData} disabled={loading || connecting}>
              {loading ? "Loading..." : "Refresh"}
            </button>

            <button
              className="btn btn-outline-light"
              onClick={handleSync}
              disabled={syncing || connecting}
            >
              {syncing ? "Syncing..." : "Sync Meta"}
            </button>

            <button
              className="btn btn-success wa-connect-btn"
              onClick={startEmbeddedSignup}
              disabled={connecting || !appId || !configId}
            >
              <i className="bi bi-whatsapp me-2" />
              {connecting
                ? "Connecting..."
                : connected
                ? "Reconnect WhatsApp"
                : "Connect WhatsApp Business"}
            </button>
          </div>
        </div>
      </div>

      {(!appId || !configId) && (
        <div className="alert alert-warning shadow-sm">
          <strong>Frontend Meta config missing.</strong> Add these in frontend .env:
          <div className="mt-2 small">
            <code>REACT_APP_META_APP_ID</code>, <code>REACT_APP_META_CONFIG_ID</code>,{" "}
            <code>REACT_APP_META_GRAPH_VERSION</code>
          </div>
        </div>
      )}

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <div className="card wa-card h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <strong>Connection</strong>
              <StatusBadge status={status?.status || status?.connectionStatus} />
            </div>

            <div className="card-body">
              <label className="form-label">School ID</label>

              <div className="input-group mb-3">
                <input
                  className="form-control"
                  type="number"
                  min="1"
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                />

                <button className="btn btn-outline-secondary" onClick={loadData} disabled={loading}>
                  Load
                </button>
              </div>

              <div className="wa-info-grid">
                <div className="wa-info-item">
                  <span>Verified Name</span>
                  <strong>{fieldValue(status, ["verifiedName", "verified_name", "name"])}</strong>
                </div>

                <div className="wa-info-item">
                  <span>Display Phone</span>
                  <strong>
                    {fieldValue(status, ["displayPhoneNumber", "display_phone_number", "phone"])}
                  </strong>
                </div>

                <div className="wa-info-item">
                  <span>WABA ID</span>
                  <strong>
                    {fieldValue(status, ["wabaId", "waba_id", "whatsappBusinessAccountId"])}
                  </strong>
                </div>

                <div className="wa-info-item">
                  <span>Phone Number ID</span>
                  <strong>{fieldValue(status, ["phoneNumberId", "phone_number_id"])}</strong>
                </div>

                <div className="wa-info-item">
                  <span>Business ID</span>
                  <strong>{fieldValue(status, ["businessId", "business_id"])}</strong>
                </div>

                <div className="wa-info-item">
                  <span>Token Expiry</span>
                  <strong>{fieldValue(status, ["tokenExpiresAt", "token_expires_at"])}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="card wa-card h-100">
            <div className="card-header bg-white d-flex flex-wrap gap-2 justify-content-between align-items-center">
              <strong>Setup Checklist</strong>
              <span className="text-muted small">Use this before sending production messages</span>
            </div>

            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="wa-check-item">
                    <i className="bi bi-1-circle" />
                    <div>
                      <strong>Client connects number</strong>
                      <p>
                        Owner logs in through Meta popup and selects the school WhatsApp Business
                        number.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="wa-check-item">
                    <i className="bi bi-2-circle" />
                    <div>
                      <strong>Backend saves credentials</strong>
                      <p>
                        ERP stores WABA ID, Phone Number ID and school-wise access credentials
                        securely.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="wa-check-item">
                    <i className="bi bi-3-circle" />
                    <div>
                      <strong>Templates submitted</strong>
                      <p>
                        Create fee, circular, attendance and diary templates from the connected
                        WABA.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="wa-check-item">
                    <i className="bi bi-4-circle" />
                    <div>
                      <strong>Webhook configured</strong>
                      <p>
                        Delivery/read status and incoming replies will be received through the
                        backend webhook.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {lastSessionInfo && (
                <div className="wa-session-box mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <strong>Last Embedded Signup Event</strong>
                    <span className="badge text-bg-light">{lastSessionInfo.event || "EVENT"}</span>
                  </div>

                  <pre>{JSON.stringify(lastSessionInfo, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card wa-card mt-3">
        <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>WhatsApp Templates</strong>
            <div className="small text-muted">Templates available under this school/WABA.</div>
          </div>

          <span className="badge text-bg-success">{templates.length} found</span>
        </div>

        <div className="card-body p-0">
          {templates.length === 0 ? (
            <div className="p-4 text-center text-muted">
              No templates found yet. After connection, create templates from backend/admin flow.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Language</th>
                    <th>Status</th>
                    <th>ID</th>
                  </tr>
                </thead>

                <tbody>
                  {templates.map((tpl, idx) => (
                    <tr key={tpl.id || tpl.name || idx}>
                      <td className="fw-semibold">{tpl.name || "—"}</td>
                      <td>{tpl.category || "—"}</td>
                      <td>{tpl.language || "—"}</td>
                      <td>
                        <span className="badge text-bg-light border">
                          {tpl.status || tpl.quality_score?.score || "—"}
                        </span>
                      </td>
                      <td className="text-muted small">{tpl.id || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}