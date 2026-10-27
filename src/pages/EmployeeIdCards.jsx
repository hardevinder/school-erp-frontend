import React, { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import { getEmployeePhotoUrl } from "../components/EmployeeAvatar";

const CARD_FIELDS = [
  ["photo", "Employee photo"],
  ["school_logo", "School logo"],
  ["name", "Employee name"],
  ["designation", "Designation"],
  ["employee_id", "Employee ID"],
  ["department", "Department"],
  ["blood_group", "Blood group"],
  ["phone", "Phone number"],
  ["email", "Email address"],
  ["joining_date", "Joining date"],
];

const CARD_THEMES = {
  "Navy & Teal": ["#082d55", "#1eafad"],
  "Royal Blue & Gold": ["#173b72", "#d5a536"],
  "Forest Green & Mint": ["#155744", "#55b89a"],
  "Maroon & Gold": ["#6a1826", "#d4a53c"],
};

const EmployeeIdCards = () => {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState("");
  const [authorityName, setAuthorityName] = useState("Authorised Signatory");
  const [authorityDesignation, setAuthorityDesignation] = useState("Principal");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [selectedFields, setSelectedFields] = useState(["photo", "school_logo", "name", "designation", "employee_id", "department", "blood_group", "phone"]);
  const [themeName, setThemeName] = useState("Navy & Teal");
  const [primaryColor, setPrimaryColor] = useState(CARD_THEMES["Navy & Teal"][0]);
  const [accentColor, setAccentColor] = useState(CARD_THEMES["Navy & Teal"][1]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewHeight, setPreviewHeight] = useState(440);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedEmployee = useMemo(
    () => employees.find((employee) => String(employee.id) === String(employeeId)) || null,
    [employees, employeeId]
  );

  useEffect(() => {
    let active = true;
    api.get("/employees")
      .then(({ data }) => {
        if (!active) return;
        const rows = Array.isArray(data?.employees) ? data.employees : [];
        setEmployees(rows);
        if (rows.length) setEmployeeId(String(rows[0].id));
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.message || "Could not load employees. Please sign in with an HR or administrator account.");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const requestBody = useMemo(() => ({
    employeeId,
    authorityName,
    authorityDesignation,
    includeSignature,
    signatureDataUrl: includeSignature ? signatureDataUrl : "",
    selectedFields,
    primaryColor,
    accentColor,
  }), [employeeId, authorityName, authorityDesignation, includeSignature, signatureDataUrl, selectedFields, primaryColor, accentColor]);

  const toggleField = (field) => {
    setSelectedFields((current) => current.includes(field)
      ? current.filter((item) => item !== field)
      : [...current, field]);
  };

  const selectTheme = (name) => {
    setThemeName(name);
    const colors = CARD_THEMES[name];
    if (colors) {
      setPrimaryColor(colors[0]);
      setAccentColor(colors[1]);
    }
  };

  const loadPreview = useCallback(async () => {
    if (!employeeId) {
      setPreviewHtml("");
      setPreviewHeight(440);
      return;
    }
    setPreviewLoading(true);
    try {
      const { data } = await api.post("/api/employee-id-cards/preview-html", requestBody);
      setPreviewHtml(data?.html || "");
      setPreviewHeight(Math.max(300, Number(data?.height) || 440));
      setError("");
    } catch (err) {
      setPreviewHtml("");
      setError(err?.response?.data?.message || "Could not create the ID card preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, [employeeId, requestBody]);

  useEffect(() => {
    const timer = window.setTimeout(loadPreview, 250);
    return () => window.clearTimeout(timer);
  }, [loadPreview]);

  const handleSignatureFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      setError("Please choose a PNG, JPG, or WebP signature image.");
      event.target.value = "";
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("The signature image must be 1 MB or smaller.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSignatureDataUrl(String(reader.result || ""));
      setError("");
    };
    reader.onerror = () => setError("Could not read the signature image.");
    reader.readAsDataURL(file);
  };

  const generatePdf = async () => {
    if (!employeeId) return;
    setPdfLoading(true);
    try {
      const { data } = await api.post("/api/employee-id-cards/generate-pdf", requestBody);
      const fallback = `${api.defaults.baseURL?.replace(/\/$/, "") || window.location.origin}${data.fileUrl || ""}`;
      const url = /^https?:\/\//i.test(data.fileUrl || "") ? data.fileUrl : fallback;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err?.response?.data?.message || "Could not generate the PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1 fw-bold">Employee ID Cards</h2>
          <div className="text-muted">Preview and download a staff card with an optional authorised-signatory signature.</div>
        </div>
        <button type="button" className="btn btn-primary rounded-pill px-4" onClick={generatePdf} disabled={!employeeId || pdfLoading}>
          <i className="bi bi-download me-2" />{pdfLoading ? "Generating PDF…" : "Download ID Card PDF"}
        </button>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {loading ? <div className="text-muted py-5 text-center">Loading employees…</div> : (
        <div className="row g-4">
          <div className="col-12 col-xl-4">
            <section className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4">
                <h5 className="fw-bold mb-3">Card details</h5>
                <label className="form-label fw-semibold" htmlFor="employee-id-select">Employee</label>
                <select id="employee-id-select" className="form-select mb-3" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                  <option value="">Select employee</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.employee_id || employee.id}</option>)}
                </select>
                {selectedEmployee && (
                  <div className="d-flex align-items-center gap-3 rounded-3 bg-light p-3 mb-4">
                    <img src={getEmployeePhotoUrl(selectedEmployee) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72'%3E%3Crect width='100%25' height='100%25' fill='%23e8eef5'/%3E%3C/svg%3E"} alt="Employee" style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover" }} />
                    <div><div className="fw-bold">{selectedEmployee.name}</div><div className="small text-muted">{selectedEmployee.designation || "Staff Member"}{selectedEmployee.department?.name ? ` · ${selectedEmployee.department.name}` : ""}</div></div>
                  </div>
                )}

                <hr />
                <div className="fw-semibold mb-2">Fields to show on the card</div>
                <div className="row g-2 mb-3">
                  {CARD_FIELDS.map(([field, label]) => <div className="col-6" key={field}>
                    <label className="form-check small">
                      <input className="form-check-input" type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} />
                      <span className="form-check-label">{label}</span>
                    </label>
                  </div>)}
                </div>

                <label className="form-label fw-semibold" htmlFor="card-theme">Card colour combination</label>
                <select id="card-theme" className="form-select mb-3" value={themeName} onChange={(event) => selectTheme(event.target.value)}>
                  {Object.keys(CARD_THEMES).map((name) => <option key={name} value={name}>{name}</option>)}
                  <option value="Custom">Custom colours</option>
                </select>
                <div className="row g-2 mb-3">
                  <div className="col-6"><label className="form-label small" htmlFor="card-primary">Main colour</label><input id="card-primary" className="form-control form-control-color w-100" type="color" value={primaryColor} onChange={(event) => { setThemeName("Custom"); setPrimaryColor(event.target.value); }} /></div>
                  <div className="col-6"><label className="form-label small" htmlFor="card-accent">Accent colour</label><input id="card-accent" className="form-control form-control-color w-100" type="color" value={accentColor} onChange={(event) => { setThemeName("Custom"); setAccentColor(event.target.value); }} /></div>
                </div>

                <hr />
                <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
                  <div><div className="fw-semibold">Authorised signature</div><div className="small text-muted">Include the authority’s signature on the card</div></div>
                  <div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" role="switch" checked={includeSignature} onChange={(event) => setIncludeSignature(event.target.checked)} aria-label="Include authorised signature" /></div>
                </div>
                {includeSignature && <>
                  <label className="form-label" htmlFor="authority-name">Authorised person</label>
                  <input id="authority-name" className="form-control mb-3" value={authorityName} onChange={(event) => setAuthorityName(event.target.value)} placeholder="e.g. Dr. Anil Sharma" />
                  <label className="form-label" htmlFor="authority-designation">Designation</label>
                  <input id="authority-designation" className="form-control mb-3" value={authorityDesignation} onChange={(event) => setAuthorityDesignation(event.target.value)} placeholder="e.g. Principal" />
                  <label className="form-label" htmlFor="authority-signature">Signature image <span className="text-muted fw-normal">(optional)</span></label>
                  <input id="authority-signature" className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSignatureFile} />
                  <div className="form-text">Upload a transparent PNG or a JPG/WebP signature, up to 1 MB. It is used for this card only.</div>
                  {signatureDataUrl && <button type="button" className="btn btn-sm btn-link px-0 mt-2" onClick={() => setSignatureDataUrl("")}>Remove uploaded signature</button>}
                </>}
                {!employees.length && <div className="alert alert-warning mt-3 mb-0">No employees are available in this school.</div>}
              </div>
            </section>
          </div>

          <div className="col-12 col-xl-8">
            <section className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div><h5 className="fw-bold mb-1">Live preview</h5><div className="small text-muted">The card uses the selected employee’s saved profile photo.</div></div>
                  {previewLoading && <span className="small text-muted">Updating…</span>}
                </div>
                {previewHtml ? <iframe title="Employee ID card preview" srcDoc={previewHtml} style={{ display: "block", width: "100%", height: previewHeight + 2, border: "1px solid #e3e8ee", borderRadius: 16, background: "#f5f7fa" }} /> : <div className="d-flex align-items-center justify-content-center text-muted rounded-4 border" style={{ height: 440 }}>Select an employee to preview the card.</div>}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeIdCards;
