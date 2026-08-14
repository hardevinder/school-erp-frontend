import React, { useCallback, useEffect, useMemo, useState } from "react";
import documentVaultApi from "../../services/documentVaultApi";

const OWNER_LABELS = {
  student: "Students",
  employee: "Teachers & Staff",
  driver: "Drivers",
  conductor: "Conductors",
};

const messageOf = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong.";

const todayIso = () => new Date().toISOString().slice(0, 10);

function OfficialStatusBadge({ status }) {
  const cfg = {
    draft: ["Draft", "secondary", "bi-pencil-square"],
    pending_approval: ["Pending approval", "warning", "bi-hourglass-split"],
    issued: ["New / Issued", "primary", "bi-send-check-fill"],
    viewed: ["Viewed", "info", "bi-eye-fill"],
    acknowledged: ["Acknowledged", "success", "bi-check2-circle"],
    revoked: ["Revoked", "danger", "bi-slash-circle"],
    superseded: ["Superseded", "dark", "bi-arrow-repeat"],
  }[status] || [status || "Unknown", "secondary", "bi-circle"];
  return (
    <span className={`badge rounded-pill text-bg-${cfg[1]}`}>
      <i className={`bi ${cfg[2]} me-1`} />{cfg[0]}
    </span>
  );
}

function OfficialSummary({ summary = {}, manager = false }) {
  const cards = manager
    ? [
        ["Total", summary.total || 0, "bi-files", "primary"],
        ["Drafts", summary.draft || 0, "bi-pencil-square", "secondary"],
        ["Issued / New", summary.issued || 0, "bi-send", "primary"],
        ["Viewed", summary.viewed || 0, "bi-eye", "info"],
        ["Acknowledged", summary.acknowledged || 0, "bi-check2-circle", "success"],
        ["Ack Pending", summary.acknowledgement_pending || 0, "bi-clock-history", "warning"],
      ]
    : [
        ["Total", summary.total || 0, "bi-files", "primary"],
        ["New", summary.new || 0, "bi-envelope-exclamation", "primary"],
        ["Viewed", summary.viewed || 0, "bi-eye", "info"],
        ["Acknowledged", summary.acknowledged || 0, "bi-check2-circle", "success"],
        ["Ack Pending", summary.acknowledgement_pending || 0, "bi-clock-history", "warning"],
        ["Revoked", summary.revoked || 0, "bi-slash-circle", "danger"],
      ];
  return (
    <div className="row g-3 mb-4">
      {cards.map(([label, value, icon, color]) => (
        <div className="col-6 col-md-4 col-xl-2" key={label}>
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body p-3">
              <i className={`bi ${icon} text-${color} fs-4`} />
              <div className="fs-4 fw-bold mt-1">{value}</div>
              <div className="small text-muted">{label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function OfficialDocumentsMine({ selfScope }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!selfScope) return;
    setLoading(true);
    setError("");
    try {
      setData(await documentVaultApi.officialMine(selfScope));
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }, [selfScope]);

  useEffect(() => { load(); }, [load]);

  const open = async (doc) => {
    setBusyId(doc.id);
    setError("");
    try {
      await documentVaultApi.openOfficial(doc, selfScope);
      window.setTimeout(load, 600);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId(null);
    }
  };

  const acknowledge = async (doc) => {
    if (!window.confirm("Confirm that you have received and read this official document?")) return;
    setBusyId(doc.id);
    setError("");
    try {
      await documentVaultApi.acknowledgeOfficial(doc.id);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  if (error && !data) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
        <div>
          <h4 className="mb-1">Documents Issued to Me</h4>
          <div className="text-muted">
            Official school letters, notices, appreciation, counselling, employment and disciplinary documents.
          </div>
        </div>
        <button className="btn btn-outline-primary" onClick={load}><i className="bi bi-arrow-clockwise me-1" />Refresh</button>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <OfficialSummary summary={data?.summary} />

      <div className="row g-3">
        {(data?.documents || []).map((doc) => (
          <div className="col-lg-6" key={doc.id}>
            <div className={`card border-0 shadow-sm h-100 ${doc.confidential ? "border-start border-danger border-4" : ""}`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="small text-uppercase fw-bold text-muted mb-1">{doc.documentType?.category || "Official Document"}</div>
                    <h5 className="mb-1">{doc.title}</h5>
                    <div className="small text-muted">{doc.letter_number || "—"} • {doc.issue_date || "—"}</div>
                  </div>
                  <OfficialStatusBadge status={doc.status} />
                </div>
                {doc.subject && <div className="mt-3"><span className="fw-semibold">Subject:</span> {doc.subject}</div>}
                <div className="d-flex gap-2 flex-wrap mt-3">
                  {doc.confidential && <span className="badge text-bg-danger"><i className="bi bi-lock-fill me-1" />Confidential</span>}
                  {doc.acknowledgement_required && <span className="badge text-bg-warning"><i className="bi bi-check2-square me-1" />Acknowledgement required</span>}
                  {doc.issuer?.name && <span className="badge text-bg-light border text-dark">Issued by {doc.issuer.name}</span>}
                </div>
                {doc.revoked_reason && (
                  <div className="alert alert-danger py-2 mt-3 mb-0"><strong>Revoked:</strong> {doc.revoked_reason}</div>
                )}
                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <button className="btn btn-outline-primary" disabled={busyId === doc.id || doc.status === "revoked"} onClick={() => open(doc)}>
                    {busyId === doc.id ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-eye me-1" />}View Document
                  </button>
                  {doc.can_acknowledge && (
                    <button className="btn btn-success" disabled={busyId === doc.id} onClick={() => acknowledge(doc)}>
                      <i className="bi bi-check2-circle me-1" />Acknowledge / Received
                    </button>
                  )}
                </div>
                {doc.acknowledged_at && <div className="small text-success mt-2">Acknowledged {new Date(doc.acknowledged_at).toLocaleString()}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!(data?.documents || []).length && (
        <div className="card border-0 shadow-sm"><div className="card-body text-center py-5 text-muted">
          <i className="bi bi-envelope-paper display-4 d-block mb-3" />No official documents have been issued to you yet.
        </div></div>
      )}
    </div>
  );
}

function TypeManagementModal({ show, onClose, onSaved, scopes }) {
  const [form, setForm] = useState({
    name: "", code: "", category: "General", recipient_scopes: scopes,
    default_subject: "", default_body: "", default_confidential: false,
    default_acknowledgement_required: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (show) {
      setForm((prev) => ({ ...prev, recipient_scopes: scopes }));
      setError("");
    }
  }, [show, scopes]);

  if (!show) return null;
  const toggleScope = (scope) => setForm((prev) => ({
    ...prev,
    recipient_scopes: prev.recipient_scopes.includes(scope)
      ? prev.recipient_scopes.filter((s) => s !== scope)
      : [...prev.recipient_scopes, scope],
  }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.recipient_scopes.length) return setError("Select at least one recipient type.");
    setBusy(true); setError("");
    try {
      await documentVaultApi.createOfficialType(form);
      onSaved?.();
      onClose();
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal d-block" style={{ background: "rgba(15,23,42,.55)", zIndex: 4500 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <form className="modal-content border-0 shadow" onSubmit={save}>
          <div className="modal-header"><h5 className="modal-title">Add Official Letter / Document Type</h5><button type="button" className="btn-close" onClick={onClose} /></div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2">{error}</div>}
            <div className="row g-3">
              <div className="col-md-7"><label className="form-label">Type name *</label><input className="form-control" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
              <div className="col-md-5"><label className="form-label">Category</label><input className="form-control" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Code</label><input className="form-control" placeholder="Auto from name" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} /></div>
              <div className="col-md-6"><label className="form-label">Default subject</label><input className="form-control" value={form.default_subject} onChange={(e) => setForm((p) => ({ ...p, default_subject: e.target.value }))} /></div>
              <div className="col-12"><label className="form-label">Recipient types</label><div className="d-flex gap-3 flex-wrap">{scopes.map((scope) => <label className="form-check" key={scope}><input className="form-check-input" type="checkbox" checked={form.recipient_scopes.includes(scope)} onChange={() => toggleScope(scope)} /><span className="form-check-label">{OWNER_LABELS[scope]}</span></label>)}</div></div>
              <div className="col-12"><label className="form-label">Default body / template</label><textarea className="form-control" rows="6" value={form.default_body} onChange={(e) => setForm((p) => ({ ...p, default_body: e.target.value }))} placeholder="You can use {{recipient_name}}, {{school_name}}, {{issue_date}}, {{letter_number}}, {{class}}, {{section}}, {{designation}}" /></div>
              <div className="col-md-6"><label className="form-check"><input className="form-check-input" type="checkbox" checked={form.default_confidential} onChange={(e) => setForm((p) => ({ ...p, default_confidential: e.target.checked }))} /><span className="form-check-label">Confidential by default</span></label></div>
              <div className="col-md-6"><label className="form-check"><input className="form-check-input" type="checkbox" checked={form.default_acknowledgement_required} onChange={(e) => setForm((p) => ({ ...p, default_acknowledgement_required: e.target.checked }))} /><span className="form-check-label">Acknowledgement required by default</span></label></div>
            </div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Create Type"}</button></div>
        </form>
      </div>
    </div>
  );
}

export function OfficialDocumentsManager() {
  const [capabilities, setCapabilities] = useState(null);
  const [ownerType, setOwnerType] = useState("");
  const [search, setSearch] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [types, setTypes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [issued, setIssued] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [file, setFile] = useState(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [form, setForm] = useState({
    document_type_id: "", title: "", subject: "", body_text: "",
    issue_date: todayIso(), letter_number: "", confidential: false,
    acknowledgement_required: false, visible_to_parent: true,
  });

  const scopes = useMemo(() => capabilities?.issue_scopes || [], [capabilities]);

  const loadBase = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const caps = await documentVaultApi.officialCapabilities();
      setCapabilities(caps);
      const first = ownerType || caps.issue_scopes?.[0] || "";
      if (!ownerType && first) setOwnerType(first);
      if (first) {
        const [typeData, dash, issuedData] = await Promise.all([
          documentVaultApi.officialTypes(first),
          documentVaultApi.officialDashboard(),
          documentVaultApi.officialIssued({ owner_type: first, limit: 40 }),
        ]);
        setTypes(typeData.document_types || []);
        setDashboard(dash);
        setIssued(issuedData.documents || []);
      }
    } catch (err) { setError(messageOf(err)); }
    finally { setLoading(false); }
  }, [ownerType]);

  useEffect(() => { loadBase(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshForScope = useCallback(async (scope) => {
    if (!scope) return;
    setError("");
    try {
      const [typeData, dash, issuedData] = await Promise.all([
        documentVaultApi.officialTypes(scope),
        documentVaultApi.officialDashboard(),
        documentVaultApi.officialIssued({ owner_type: scope, limit: 40 }),
      ]);
      setTypes(typeData.document_types || []);
      setDashboard(dash);
      setIssued(issuedData.documents || []);
    } catch (err) { setError(messageOf(err)); }
  }, []);

  useEffect(() => {
    if (!ownerType || !capabilities) return;
    setSelected(null); setRecipients([]); setSearch("");
    setForm((p) => ({ ...p, document_type_id: "", title: "", subject: "", body_text: "", visible_to_parent: ownerType === "student" }));
    refreshForScope(ownerType);
  }, [ownerType, capabilities, refreshForScope]);

  const searchRecipients = async () => {
    if (!ownerType) return;
    setSearching(true); setError("");
    try {
      const data = await documentVaultApi.officialRecipients(ownerType, search);
      setRecipients(data.recipients || []);
    } catch (err) { setError(messageOf(err)); }
    finally { setSearching(false); }
  };

  const chooseType = (value) => {
    const type = types.find((row) => String(row.id) === String(value));
    setForm((p) => ({
      ...p,
      document_type_id: value,
      title: type?.name || "",
      subject: type?.default_subject || type?.name || "",
      body_text: type?.default_body || "",
      confidential: Boolean(type?.default_confidential),
      acknowledgement_required: Boolean(type?.default_acknowledgement_required),
    }));
  };

  const submit = async (action) => {
    if (!selected) return setError("Select a recipient first.");
    if (!form.document_type_id) return setError("Select an official document type.");
    if (!file && !form.body_text.trim()) return setError("Enter letter content or upload an existing PDF/image.");
    setBusy(true); setError(""); setSuccess("");
    try {
      const fd = new FormData();
      fd.append("recipient_type", selected.owner_type);
      fd.append("recipient_id", selected.owner_id);
      fd.append("document_type_id", form.document_type_id);
      fd.append("title", form.title);
      fd.append("subject", form.subject);
      fd.append("body_text", form.body_text);
      fd.append("issue_date", form.issue_date);
      fd.append("confidential", form.confidential ? "1" : "0");
      fd.append("acknowledgement_required", form.acknowledgement_required ? "1" : "0");
      fd.append("visible_to_parent", form.visible_to_parent ? "1" : "0");
      fd.append("action", action);
      if (form.letter_number.trim()) fd.append("letter_number", form.letter_number.trim());
      if (file) fd.append("file", file);
      const result = await documentVaultApi.issueOfficial(fd);
      setSuccess(result.message || (action === "draft" ? "Draft saved." : "Official document issued."));
      setFile(null);
      setForm((p) => ({ ...p, letter_number: "" }));
      await refreshForScope(ownerType);
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
  };

  const openDoc = async (doc) => {
    try { await documentVaultApi.openOfficial(doc); }
    catch (err) { setError(messageOf(err)); }
  };

  const issueDraft = async (doc) => {
    if (!window.confirm(`Issue draft ${doc.letter_number || doc.title} now? The recipient will be notified.`)) return;
    try { await documentVaultApi.issueOfficialDraft(doc.id); setSuccess("Draft issued and notification processed."); await refreshForScope(ownerType); }
    catch (err) { setError(messageOf(err)); }
  };

  const revoke = async (doc) => {
    const reason = window.prompt("Reason for revoking this official document:", "Issued in error / superseded.");
    if (!reason?.trim()) return;
    try { await documentVaultApi.revokeOfficial(doc.id, reason.trim()); setSuccess("Official document revoked; audit history retained."); await refreshForScope(ownerType); }
    catch (err) { setError(messageOf(err)); }
  };

  if (loading) return <div className="text-center py-5"><span className="spinner-border text-primary" /></div>;
  if (!scopes.length) return <div className="alert alert-warning">Your role does not have permission to issue official documents.</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-3">
        <div>
          <h4 className="mb-1">Official Documents & Letters</h4>
          <div className="text-muted">Create or upload a school document, issue it securely, notify the recipient, and track view/acknowledgement.</div>
        </div>
        <div className="d-flex gap-2">
          {capabilities?.can_manage_types && <button className="btn btn-outline-secondary" onClick={() => setShowTypeModal(true)}><i className="bi bi-sliders me-1" />Add Letter Type</button>}
          <button className="btn btn-outline-primary" onClick={() => refreshForScope(ownerType)}><i className="bi bi-arrow-clockwise me-1" />Refresh</button>
        </div>
      </div>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      {success && <div className="alert alert-success py-2"><i className="bi bi-check-circle me-2" />{success}</div>}
      <OfficialSummary summary={dashboard?.summary} manager />

      <div className="row g-3 mb-4">
        <div className="col-lg-4 col-xl-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h6 className="fw-bold"><i className="bi bi-person-check me-2" />1. Select Recipient</h6>
              <label className="form-label mt-2">Recipient type</label>
              <select className="form-select mb-3" value={ownerType} onChange={(e) => setOwnerType(e.target.value)}>
                {scopes.map((scope) => <option key={scope} value={scope}>{OWNER_LABELS[scope]}</option>)}
              </select>
              <label className="form-label">Search name / ID</label>
              <div className="input-group mb-3"><input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchRecipients()} placeholder="Type and search" /><button className="btn btn-primary" onClick={searchRecipients} disabled={searching}>{searching ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search" />}</button></div>
              <div style={{ maxHeight: 430, overflowY: "auto" }}>
                {recipients.map((person) => (
                  <button type="button" key={`${person.owner_type}-${person.owner_id}`} className={`list-group-item list-group-item-action border rounded-3 mb-2 w-100 text-start ${selected?.owner_id === person.owner_id ? "active" : ""}`} onClick={() => setSelected(person)}>
                    <div className="fw-semibold">{person.name}</div>
                    <div className={`small ${selected?.owner_id === person.owner_id ? "text-white-50" : "text-muted"}`}>{person.reference}{person.subtitle ? ` • ${person.subtitle}` : ""}</div>
                  </button>
                ))}
              </div>
              {!recipients.length && <div className="small text-muted border rounded-3 p-3">Search and select a recipient. Blank search can load the first profiles.</div>}
            </div>
          </div>
        </div>

        <div className="col-lg-8 col-xl-9">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                <div><h6 className="fw-bold mb-1"><i className="bi bi-file-earmark-text me-2" />2. Prepare & Issue</h6><div className="text-muted small">{selected ? `${selected.name} • ${selected.reference}` : "Select a recipient from the left."}</div></div>
                {selected && <span className="badge text-bg-primary px-3 py-2">{OWNER_LABELS[selected.owner_type]}</span>}
              </div>
              <div className="row g-3">
                <div className="col-md-6"><label className="form-label">Official document type *</label><select className="form-select" value={form.document_type_id} onChange={(e) => chooseType(e.target.value)}><option value="">Select type...</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
                <div className="col-md-3"><label className="form-label">Issue date</label><input type="date" className="form-control" value={form.issue_date} onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value }))} /></div>
                <div className="col-md-3"><label className="form-label">Letter No.</label><input className="form-control" value={form.letter_number} onChange={(e) => setForm((p) => ({ ...p, letter_number: e.target.value }))} placeholder="Auto if blank" /></div>
                <div className="col-md-5"><label className="form-label">Title</label><input className="form-control" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
                <div className="col-md-7"><label className="form-label">Subject</label><input className="form-control" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} /></div>
                <div className="col-12"><label className="form-label">Letter content</label><textarea className="form-control" rows="10" value={form.body_text} onChange={(e) => setForm((p) => ({ ...p, body_text: e.target.value }))} placeholder="Type official letter content here. If no file is uploaded, a PDF is generated automatically." /><div className="form-text">Template variables supported: <code>{"{{recipient_name}}"}</code>, <code>{"{{school_name}}"}</code>, <code>{"{{letter_number}}"}</code>, <code>{"{{issue_date}}"}</code>, <code>{"{{class}}"}</code>, <code>{"{{section}}"}</code>, <code>{"{{designation}}"}</code>.</div></div>
                <div className="col-12"><label className="form-label">Or upload an already prepared PDF/image</label><input type="file" className="form-control" accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(e) => setFile(e.target.files?.[0] || null)} /><div className="form-text">If attached, the uploaded document is issued instead of auto-generating the PDF.</div></div>
                <div className="col-md-4"><label className="form-check"><input className="form-check-input" type="checkbox" checked={form.confidential} onChange={(e) => setForm((p) => ({ ...p, confidential: e.target.checked }))} /><span className="form-check-label"><i className="bi bi-lock me-1" />Confidential</span></label></div>
                <div className="col-md-4"><label className="form-check"><input className="form-check-input" type="checkbox" checked={form.acknowledgement_required} onChange={(e) => setForm((p) => ({ ...p, acknowledgement_required: e.target.checked }))} /><span className="form-check-label">Require acknowledgement</span></label></div>
                {ownerType === "student" && <div className="col-md-4"><label className="form-check"><input className="form-check-input" type="checkbox" checked={form.visible_to_parent} onChange={(e) => setForm((p) => ({ ...p, visible_to_parent: e.target.checked }))} /><span className="form-check-label">Visible to linked parent</span></label></div>}
              </div>
              <div className="d-flex justify-content-end gap-2 mt-4 flex-wrap">
                <button className="btn btn-outline-secondary" disabled={busy || !selected} onClick={() => submit("draft")}><i className="bi bi-save me-1" />Save Draft</button>
                <button className="btn btn-primary px-4" disabled={busy || !selected} onClick={() => submit("issue")}>{busy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-send-check me-1" />}Issue & Notify</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white border-0 pt-3 d-flex justify-content-between align-items-center"><h6 className="fw-bold mb-0">Recent {OWNER_LABELS[ownerType]} Official Documents</h6><span className="small text-muted">{issued.length} shown</span></div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light"><tr><th>Recipient</th><th>Document</th><th>Letter No.</th><th>Status</th><th>Issued</th><th>Acknowledgement</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {issued.map((doc) => (
                <tr key={doc.id}>
                  <td><div className="fw-semibold">{doc.recipient?.name || `${doc.recipient_type} #${doc.recipient_id}`}</div><div className="small text-muted">{doc.recipient?.reference}</div></td>
                  <td><div className="fw-semibold">{doc.title}</div><div className="small text-muted">{doc.documentType?.name}{doc.confidential ? " • Confidential" : ""}</div></td>
                  <td><code>{doc.letter_number || "—"}</code></td>
                  <td><OfficialStatusBadge status={doc.status} /></td>
                  <td>{doc.issue_date || "—"}</td>
                  <td>{doc.acknowledgement_required ? (doc.acknowledged_at ? <span className="text-success">Received</span> : <span className="text-warning">Pending</span>) : <span className="text-muted">Not required</span>}</td>
                  <td className="text-end text-nowrap">
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openDoc(doc)} disabled={doc.status === "revoked"}><i className="bi bi-eye" /></button>
                    {doc.status === "draft" && <button className="btn btn-sm btn-success me-1" onClick={() => issueDraft(doc)} title="Issue draft"><i className="bi bi-send" /></button>}
                    {!['draft','revoked','superseded'].includes(doc.status) && <button className="btn btn-sm btn-outline-danger" onClick={() => revoke(doc)} title="Revoke"><i className="bi bi-slash-circle" /></button>}
                  </td>
                </tr>
              ))}
              {!issued.length && <tr><td colSpan="7" className="text-center text-muted py-5">No official documents issued in this scope yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <TypeManagementModal show={showTypeModal} onClose={() => setShowTypeModal(false)} scopes={scopes} onSaved={() => refreshForScope(ownerType)} />
    </div>
  );
}
