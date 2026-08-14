import React, { useCallback, useEffect, useMemo, useState } from "react";
import documentVaultApi from "../services/documentVaultApi";
import { OfficialDocumentsManager, OfficialDocumentsMine } from "../components/documentVault/OfficialDocumentsPanel";

const OWNER_LABELS = {
  student: "Students",
  employee: "Teachers & Staff",
  driver: "Drivers",
  conductor: "Conductors",
};

const roleNow = () =>
  String(localStorage.getItem("activeRole") || localStorage.getItem("role") || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const managerScopesForRole = (role) => {
  if (["superadmin", "super_admin", "admin", "principal"].includes(role)) {
    return ["student", "employee", "driver", "conductor"];
  }
  if (["hr", "academic_coordinator", "coordinator"].includes(role)) return ["employee"];
  if (["transport", "transport_admin", "transporter"].includes(role)) return ["driver", "conductor"];
  return [];
};

const officialIssueScopesForRole = (role) => {
  if (["superadmin", "super_admin", "admin", "principal"].includes(role)) return ["student", "employee", "driver", "conductor"];
  const scopes = new Set();
  if (role === "hr") { scopes.add("employee"); scopes.add("driver"); scopes.add("conductor"); }
  if (["academic_coordinator", "coordinator"].includes(role)) { scopes.add("student"); scopes.add("employee"); }
  if (["accounts", "account", "accountant"].includes(role)) { scopes.add("student"); scopes.add("employee"); }
  if (["transport", "transport_admin", "transporter"].includes(role)) { scopes.add("driver"); scopes.add("conductor"); }
  if (["examination", "frontoffice", "front_office"].includes(role)) scopes.add("student");
  return [...scopes];
};

const selfScopeForRole = (role) => {
  if (["student", "parent"].includes(role)) return "student";
  if (["driver"].includes(role)) return "driver";
  if (["conductor"].includes(role)) return "conductor";
  if (
    [
      "teacher",
      "department_hod",
      "academic_coordinator",
      "coordinator",
      "hr",
      "accounts",
      "account",
      "accountant",
      "examination",
      "frontoffice",
      "principal",
    ].includes(role)
  )
    return "employee";
  return "";
};

const messageOf = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong.";

function StatusBadge({ doc }) {
  const status = doc?.effective_status || doc?.status || "missing";
  const config = {
    verified: ["Verified", "success", "bi-patch-check-fill"],
    submitted: ["Pending verification", "warning", "bi-hourglass-split"],
    rejected: ["Rejected", "danger", "bi-x-octagon-fill"],
    expired: ["Expired", "dark", "bi-calendar-x-fill"],
    missing: ["Missing", "secondary", "bi-dash-circle"],
  }[status] || [status, "secondary", "bi-circle"];
  return (
    <span className={`badge text-bg-${config[1]} rounded-pill`}>
      <i className={`bi ${config[2]} me-1`} />
      {config[0]}
    </span>
  );
}

function SummaryCards({ summary = {}, manager = false }) {
  const cards = manager
    ? [
        ["Total Documents", summary.total || 0, "bi-files", "primary"],
        ["Pending Review", summary.submitted || 0, "bi-hourglass-split", "warning"],
        ["Verified", summary.verified || 0, "bi-patch-check", "success"],
        ["Rejected", summary.rejected || 0, "bi-x-circle", "danger"],
        ["Expiring Soon", summary.expiring || 0, "bi-calendar2-week", "info"],
        ["Expired", summary.expired || 0, "bi-calendar-x", "dark"],
      ]
    : [
        ["Completion", `${summary.completion_percent ?? 0}%`, "bi-pie-chart", "primary"],
        ["Missing Required", summary.missing_required || 0, "bi-exclamation-circle", "danger"],
        ["Pending Review", summary.submitted || 0, "bi-hourglass-split", "warning"],
        ["Verified", summary.verified || 0, "bi-patch-check", "success"],
        ["Expiring Soon", summary.expiring || 0, "bi-calendar2-week", "info"],
        ["Expired", summary.expired || 0, "bi-calendar-x", "dark"],
      ];
  return (
    <div className="row g-3 mb-4">
      {cards.map(([label, value, icon, color]) => (
        <div className="col-6 col-lg-2" key={label}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3">
              <div className={`text-${color} mb-2`}>
                <i className={`bi ${icon} fs-4`} />
              </div>
              <div className="fs-4 fw-bold">{value}</div>
              <div className="small text-muted">{label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UploadModal({ show, requirement, owner, onClose, onSaved, uploadFn }) {
  const [file, setFile] = useState(null);
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (show) {
      setFile(null);
      setNumber("");
      setIssuedOn("");
      setExpiresOn("");
      setNotes("");
      setError("");
    }
  }, [show, requirement?.id]);

  if (!show || !requirement) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Select a PDF or image first.");
    if (requirement.requires_expiry && !expiresOn) return setError("Expiry date is required for this document.");
    const form = new FormData();
    form.append("file", file);
    form.append("document_type_id", requirement.id);
    form.append("title", requirement.name);
    if (number) form.append("document_number", number);
    if (issuedOn) form.append("issued_on", issuedOn);
    if (expiresOn) form.append("expires_on", expiresOn);
    if (notes) form.append("notes", notes);
    setBusy(true);
    setError("");
    try {
      await uploadFn(form);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: "rgba(15,23,42,.55)", zIndex: 4000 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <form className="modal-content border-0 shadow" onSubmit={submit}>
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1">Upload {requirement.name}</h5>
              <div className="small text-muted">
                {owner?.name ? `${owner.name} • ` : ""}PDF/JPG/PNG/WEBP/HEIC • max 20 MB
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={busy} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <div className="mb-3">
              <label className="form-label fw-semibold">Document file *</label>
              <input
                type="file"
                className="form-control"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                required
              />
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Document / Certificate No.</label>
                <input className="form-control" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Optional" />
              </div>
              <div className="col-md-3">
                <label className="form-label">Issue date</label>
                <input type="date" className="form-control" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
              </div>
              <div className="col-md-3">
                <label className="form-label">
                  Expiry date {requirement.requires_expiry && <span className="text-danger">*</span>}
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                  required={requirement.requires_expiry}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note for school verification" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <><span className="spinner-border spinner-border-sm me-2" />Uploading...</> : <><i className="bi bi-cloud-arrow-up me-2" />Upload Securely</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RequirementsGrid({ vault, manager, onUpload, onOpen, onVerify, onReject, onArchive }) {
  const requirements = vault?.requirements || [];
  if (!requirements.length) {
    return <div className="alert alert-light border">No document types are configured for this profile yet.</div>;
  }
  return (
    <div className="row g-3">
      {requirements.map((req) => {
        const docs = req.documents || [];
        const latest = docs[0];
        return (
          <div className="col-12 col-xl-6" key={req.id}>
            <div className={`card h-100 shadow-sm border-${req.is_required && !req.complete ? "danger" : "light"}`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <h6 className="mb-0 fw-bold">{req.name}</h6>
                      {req.is_required && <span className="badge text-bg-danger">Required</span>}
                      {req.allow_multiple && <span className="badge text-bg-light border text-dark">Multiple allowed</span>}
                    </div>
                    <div className="small text-muted">{req.category || "General"}{req.requires_expiry ? " • Expiry tracked" : ""}</div>
                  </div>
                  <StatusBadge doc={latest || { status: "missing" }} />
                </div>

                {docs.length > 0 ? (
                  <div className="mt-3 d-grid gap-2">
                    {docs.map((doc) => (
                      <div key={doc.id} className="rounded border bg-light p-2">
                        <div className="d-flex justify-content-between gap-2 flex-wrap">
                          <div className="small">
                            <div className="fw-semibold text-break">{doc.original_name}</div>
                            <div className="text-muted">
                              {doc.document_number ? `No. ${doc.document_number} • ` : ""}
                              Uploaded {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ""}
                              {doc.expires_on ? ` • Expires ${new Date(`${doc.expires_on}T00:00:00`).toLocaleDateString()}` : ""}
                            </div>
                            {doc.rejection_reason && <div className="text-danger mt-1"><strong>Reason:</strong> {doc.rejection_reason}</div>}
                          </div>
                          <StatusBadge doc={doc} />
                        </div>
                        <div className="d-flex gap-2 flex-wrap mt-2">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => onOpen(doc)}>
                            <i className="bi bi-eye me-1" />View
                          </button>
                          {manager && doc.status !== "verified" && (
                            <button className="btn btn-sm btn-outline-success" onClick={() => onVerify(doc)}>
                              <i className="bi bi-check2-circle me-1" />Verify
                            </button>
                          )}
                          {manager && doc.status !== "rejected" && (
                            <button className="btn btn-sm btn-outline-danger" onClick={() => onReject(doc)}>
                              <i className="bi bi-x-circle me-1" />Reject
                            </button>
                          )}
                          {(manager || doc.status !== "verified") && (
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => onArchive(doc)}>
                              <i className="bi bi-archive me-1" />Archive
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded bg-light border border-dashed p-3 mt-3 text-muted small">
                    <i className="bi bi-cloud-upload me-2" />No document submitted yet.
                  </div>
                )}

                <button className="btn btn-sm btn-primary mt-3" onClick={() => onUpload(req)}>
                  <i className="bi bi-camera me-1" />{docs.length && !req.allow_multiple ? "Replace / Re-upload" : "Upload Document"}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TypeManager({ scopes }) {
  const [scope, setScope] = useState(scopes[0] || "student");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", category: "General", is_required: false, requires_expiry: false, verification_required: true, allow_multiple: false, active: true, sort_order: 100 });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await documentVaultApi.documentTypes(scope, true);
      setRows(data.document_types || []);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (row, key) => {
    try {
      await documentVaultApi.updateDocumentType(row.id, { [key]: !row[key] });
      await load();
    } catch (err) { setError(messageOf(err)); }
  };

  const saveNew = async (e) => {
    e.preventDefault();
    try {
      await documentVaultApi.createDocumentType({ ...form, owner_scope: scope });
      setShowAdd(false);
      setForm({ name: "", code: "", category: "General", is_required: false, requires_expiry: false, verification_required: true, allow_multiple: false, active: true, sort_order: 100 });
      await load();
    } catch (err) { setError(messageOf(err)); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between gap-3 flex-wrap align-items-center mb-3">
        <div className="d-flex gap-2 align-items-center">
          <select className="form-select" value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopes.map((s) => <option key={s} value={s}>{OWNER_LABELS[s]}</option>)}
          </select>
          <span className="text-muted small text-nowrap">Configure required/optional documents without code changes.</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}><i className="bi bi-plus-lg me-1" />Add Document Type</button>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <div className="card border-0 shadow-sm">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light"><tr><th>Document</th><th>Category</th><th>Required</th><th>Expiry</th><th>Multiple</th><th>Verification</th><th>Active</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="7" className="text-center py-5"><span className="spinner-border" /></td></tr> : rows.map((row) => (
                <tr key={row.id}>
                  <td><div className="fw-semibold">{row.name}</div><code className="small">{row.code}</code></td>
                  <td>{row.category || "—"}</td>
                  {["is_required", "requires_expiry", "allow_multiple", "verification_required", "active"].map((key) => (
                    <td key={key}>
                      <button className={`btn btn-sm ${row[key] ? "btn-success" : "btn-outline-secondary"}`} onClick={() => toggle(row, key)}>
                        {row[key] ? "Yes" : "No"}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal d-block" style={{ background: "rgba(15,23,42,.55)", zIndex: 4000 }}>
          <div className="modal-dialog modal-dialog-centered">
            <form className="modal-content" onSubmit={saveNew}>
              <div className="modal-header"><h5 className="modal-title">Add {OWNER_LABELS[scope]} Document Type</h5><button type="button" className="btn-close" onClick={() => setShowAdd(false)} /></div>
              <div className="modal-body">
                <div className="mb-3"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
                <div className="row g-3">
                  <div className="col-md-6"><label className="form-label">Code</label><input className="form-control" placeholder="Auto from name" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} /></div>
                  <div className="col-md-6"><label className="form-label">Category</label><input className="form-control" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
                </div>
                <div className="row g-2 mt-3">
                  {[["is_required", "Required"], ["requires_expiry", "Track expiry"], ["allow_multiple", "Allow multiple"], ["verification_required", "Needs verification"]].map(([key, label]) => (
                    <div className="col-6" key={key}><div className="form-check"><input className="form-check-input" type="checkbox" checked={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))} /><label className="form-check-label">{label}</label></div></div>
                  ))}
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-light" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" type="submit">Create Type</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentVault() {
  const role = useMemo(() => roleNow(), []);
  const managerScopes = useMemo(() => managerScopesForRole(role), [role]);
  const selfScope = useMemo(() => selfScopeForRole(role), [role]);
  const officialIssueScopes = useMemo(() => officialIssueScopesForRole(role), [role]);
  const isManager = managerScopes.length > 0;
  const isOfficialIssuer = officialIssueScopes.length > 0;
  const [tab, setTab] = useState(isManager ? "overview" : "my");
  const [myVault, setMyVault] = useState(null);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [ownerType, setOwnerType] = useState(managerScopes[0] || "student");
  const [search, setSearch] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [selectedVault, setSelectedVault] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [uploadReq, setUploadReq] = useState(null);
  const [error, setError] = useState("");

  const loadMy = useCallback(async () => {
    if (!selfScope) return;
    setMyLoading(true); setMyError("");
    try { setMyVault(await documentVaultApi.myVault(selfScope)); }
    catch (err) { setMyError(messageOf(err)); }
    finally { setMyLoading(false); }
  }, [selfScope]);

  const loadDashboard = useCallback(async () => {
    if (!isManager) return;
    setDashboardLoading(true); setError("");
    try { setDashboard(await documentVaultApi.dashboard()); }
    catch (err) { setError(messageOf(err)); }
    finally { setDashboardLoading(false); }
  }, [isManager]);

  const loadSubjects = useCallback(async () => {
    if (!isManager || !ownerType) return;
    setSubjectLoading(true); setError("");
    try { const data = await documentVaultApi.subjects(ownerType, search); setSubjects(data.subjects || []); }
    catch (err) { setError(messageOf(err)); }
    finally { setSubjectLoading(false); }
  }, [isManager, ownerType, search]);

  const loadSelected = useCallback(async (subject = selected) => {
    if (!subject) return;
    setSelectedLoading(true); setError("");
    try { setSelectedVault(await documentVaultApi.subjectVault(subject.owner_type, subject.owner_id)); }
    catch (err) { setError(messageOf(err)); }
    finally { setSelectedLoading(false); }
  }, [selected]);

  useEffect(() => { if (tab === "my") loadMy(); }, [tab, loadMy]);
  useEffect(() => { if (tab === "overview") loadDashboard(); }, [tab, loadDashboard]);
  useEffect(() => { if (tab === "people") loadSubjects(); }, [tab, ownerType]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseSubject = async (subject) => { setSelected(subject); setSelectedVault(null); setSelectedLoading(true); try { setSelectedVault(await documentVaultApi.subjectVault(subject.owner_type, subject.owner_id)); } catch (err) { setError(messageOf(err)); } finally { setSelectedLoading(false); } };

  const openDoc = async (doc, scope) => {
    try { await documentVaultApi.openDocument(doc, scope); }
    catch (err) { setError(messageOf(err)); }
  };

  const verify = async (doc) => {
    const note = window.prompt("Optional verification note:", "") ?? null;
    if (note === null) return;
    try { await documentVaultApi.verify(doc.id, note); await loadSelected(); await loadDashboard(); }
    catch (err) { setError(messageOf(err)); }
  };

  const reject = async (doc) => {
    const reason = window.prompt("Reason for rejection / re-upload instruction:", "Document is unclear or incomplete.");
    if (!reason?.trim()) return;
    try { await documentVaultApi.reject(doc.id, reason.trim()); await loadSelected(); await loadDashboard(); }
    catch (err) { setError(messageOf(err)); }
  };

  const archive = async (doc, mine = false) => {
    if (!window.confirm("Archive this document? It will remain in audit history.")) return;
    try {
      await documentVaultApi.archive(doc.id, mine ? selfScope : undefined);
      if (mine) await loadMy(); else await loadSelected();
      if (isManager) await loadDashboard();
    } catch (err) { setError(messageOf(err)); }
  };

  const navTabs = [
    ...(selfScope ? [["my", "My Uploaded Documents", "bi-person-vcard"], ["issued-to-me", "Issued to Me", "bi-envelope-paper"]] : []),
    ...(isManager ? [["overview", "Overview", "bi-speedometer2"], ["people", "People & Verification", "bi-people"], ["types", "Document Types", "bi-sliders"]] : []),
    ...(isOfficialIssuer ? [["official-issue", "Official Letters", "bi-file-earmark-text"]] : []),
  ];

  return (
    <div className="container-fluid py-3 px-3 px-lg-4" style={{ maxWidth: 1500 }}>
      <div className="rounded-4 p-4 mb-4 text-white shadow-sm" style={{ background: "linear-gradient(135deg,#1d4ed8,#4f46e5 55%,#7c3aed)" }}>
        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
          <div>
            <div className="text-uppercase small fw-bold opacity-75 mb-1">Secure Digital Records</div>
            <h2 className="fw-bold mb-2"><i className="bi bi-shield-lock-fill me-2" />Document Vault</h2>
            <div className="opacity-75">Secure uploads plus school-issued official letters, acknowledgement tracking, verification, expiry monitoring and audit history.</div>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <span className="badge rounded-pill bg-white text-primary px-3 py-2"><i className="bi bi-lock-fill me-1" />Private files</span>
            <span className="badge rounded-pill bg-white text-primary px-3 py-2"><i className="bi bi-clock-history me-1" />Audit trail</span>
          </div>
        </div>
      </div>

      <ul className="nav nav-pills gap-2 mb-4 flex-wrap">
        {navTabs.map(([key, label, icon]) => (
          <li className="nav-item" key={key}>
            <button className={`nav-link ${tab === key ? "active" : "bg-white border text-dark"}`} onClick={() => setTab(key)}>
              <i className={`bi ${icon} me-2`} />{label}
            </button>
          </li>
        ))}
      </ul>

      {error && <div className="alert alert-danger"><i className="bi bi-exclamation-triangle me-2" />{error}</div>}

      {tab === "my" && (
        <div>
          {myLoading ? <div className="text-center py-5"><span className="spinner-border text-primary" /></div> : myError ? <div className="alert alert-warning">{myError}</div> : myVault && (
            <>
              <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
                <div><h4 className="mb-1">{myVault.owner?.name || "My Documents"}</h4><div className="text-muted">{myVault.owner?.reference} {myVault.owner?.subtitle ? `• ${myVault.owner.subtitle}` : ""}</div></div>
                <button className="btn btn-outline-primary" onClick={loadMy}><i className="bi bi-arrow-clockwise me-1" />Refresh</button>
              </div>
              <SummaryCards summary={myVault.summary} />
              <RequirementsGrid
                vault={myVault}
                manager={false}
                onUpload={setUploadReq}
                onOpen={(doc) => openDoc(doc, selfScope)}
                onVerify={() => {}}
                onReject={() => {}}
                onArchive={(doc) => archive(doc, true)}
              />
              <UploadModal
                show={Boolean(uploadReq)}
                requirement={uploadReq}
                owner={myVault.owner}
                onClose={() => setUploadReq(null)}
                onSaved={loadMy}
                uploadFn={(form) => { form.append("scope", selfScope); return documentVaultApi.uploadMine(form); }}
              />
            </>
          )}
        </div>
      )}

      {tab === "issued-to-me" && selfScope && <OfficialDocumentsMine selfScope={selfScope} />}

      {tab === "official-issue" && isOfficialIssuer && <OfficialDocumentsManager />}

      {tab === "overview" && isManager && (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3"><h4 className="mb-0">Document Compliance Overview</h4><button className="btn btn-outline-primary" onClick={loadDashboard}><i className="bi bi-arrow-clockwise me-1" />Refresh</button></div>
          {dashboardLoading ? <div className="text-center py-5"><span className="spinner-border text-primary" /></div> : dashboard && (
            <>
              <SummaryCards summary={dashboard.summary} manager />
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-0 pt-3"><h6 className="fw-bold mb-0">Recent Uploads</h6></div>
                <div className="table-responsive">
                  <table className="table align-middle mb-0"><thead className="table-light"><tr><th>Document</th><th>Profile Type</th><th>Status</th><th>Expiry</th><th>Uploaded</th></tr></thead><tbody>
                    {(dashboard.recent_documents || []).map((doc) => <tr key={doc.id}><td><div className="fw-semibold">{doc.documentType?.name || doc.title}</div><div className="small text-muted text-break">{doc.original_name}</div></td><td>{OWNER_LABELS[doc.owner_type] || doc.owner_type}</td><td><StatusBadge doc={doc} /></td><td>{doc.expires_on || "—"}</td><td>{doc.createdAt ? new Date(doc.createdAt).toLocaleString() : "—"}</td></tr>)}
                    {!(dashboard.recent_documents || []).length && <tr><td colSpan="5" className="text-center text-muted py-4">No documents uploaded yet.</td></tr>}
                  </tbody></table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "people" && isManager && (
        <div className="row g-3">
          <div className="col-lg-4 col-xl-3">
            <div className="card border-0 shadow-sm sticky-lg-top" style={{ top: 90 }}>
              <div className="card-body">
                <label className="form-label fw-semibold">Profile type</label>
                <select className="form-select mb-3" value={ownerType} onChange={(e) => { setOwnerType(e.target.value); setSelected(null); setSelectedVault(null); }}>
                  {managerScopes.map((s) => <option key={s} value={s}>{OWNER_LABELS[s]}</option>)}
                </select>
                <label className="form-label fw-semibold">Search</label>
                <div className="input-group mb-3"><input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name / ID / licence" onKeyDown={(e) => e.key === "Enter" && loadSubjects()} /><button className="btn btn-primary" onClick={loadSubjects}><i className="bi bi-search" /></button></div>
                <div className="list-group list-group-flush" style={{ maxHeight: "62vh", overflowY: "auto" }}>
                  {subjectLoading && <div className="text-center py-3"><span className="spinner-border spinner-border-sm" /></div>}
                  {!subjectLoading && subjects.map((subject) => (
                    <button key={`${subject.owner_type}-${subject.owner_id}`} className={`list-group-item list-group-item-action border rounded-3 mb-2 ${selected?.owner_id === subject.owner_id ? "active" : ""}`} onClick={() => chooseSubject(subject)}>
                      <div className="fw-semibold">{subject.name}</div>
                      <div className={`small ${selected?.owner_id === subject.owner_id ? "text-white-50" : "text-muted"}`}>{subject.reference}</div>
                      <div className="d-flex gap-2 mt-1 small"><span>Complete {subject.document_summary?.completion_percent ?? 0}%</span>{subject.document_summary?.missing_required > 0 && <span className={selected?.owner_id === subject.owner_id ? "text-warning" : "text-danger"}>Missing {subject.document_summary.missing_required}</span>}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-8 col-xl-9">
            {!selected ? <div className="card border-0 shadow-sm"><div className="card-body text-center py-5 text-muted"><i className="bi bi-person-vcard display-4 d-block mb-3" />Select a profile to review its complete document file.</div></div> : selectedLoading ? <div className="text-center py-5"><span className="spinner-border text-primary" /></div> : selectedVault && (
              <>
                <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3"><div><h4 className="mb-1">{selectedVault.owner?.name}</h4><div className="text-muted">{selectedVault.owner?.reference} {selectedVault.owner?.subtitle ? `• ${selectedVault.owner.subtitle}` : ""}</div></div><button className="btn btn-outline-primary" onClick={() => loadSelected()}><i className="bi bi-arrow-clockwise me-1" />Refresh</button></div>
                <SummaryCards summary={selectedVault.summary} />
                <RequirementsGrid
                  vault={selectedVault}
                  manager
                  onUpload={setUploadReq}
                  onOpen={(doc) => openDoc(doc)}
                  onVerify={verify}
                  onReject={reject}
                  onArchive={(doc) => archive(doc, false)}
                />
                <UploadModal
                  show={Boolean(uploadReq)}
                  requirement={uploadReq}
                  owner={selectedVault.owner}
                  onClose={() => setUploadReq(null)}
                  onSaved={async () => { await loadSelected(); await loadDashboard(); await loadSubjects(); }}
                  uploadFn={(form) => documentVaultApi.uploadFor(selected.owner_type, selected.owner_id, form)}
                />
              </>
            )}
          </div>
        </div>
      )}

      {tab === "types" && isManager && <TypeManager scopes={managerScopes} />}
    </div>
  );
}
