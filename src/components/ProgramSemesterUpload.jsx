// src/components/ProgramSemesterUpload.jsx
import React, { useRef, useState } from "react";
import axios from "axios";
import "./ProgramSemesterUpload.css";

const ProgramSemesterUpload = ({ onImported }) => {
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/+$/, "");

  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    "";

  const branchId =
    localStorage.getItem("edubridge:selectedBranchId") ||
    localStorage.getItem("selectedBranchId") ||
    "";

  const sessionId =
    localStorage.getItem("session_id") ||
    localStorage.getItem("selectedSessionId") ||
    localStorage.getItem("currentSessionId") ||
    "";

  const headers = () => ({
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(branchId ? { "X-Branch-Id": branchId } : {}),
    ...(sessionId ? { "X-Session-Id": sessionId } : {}),
  });

  const reset = () => {
    setFile(null);
    setPreview(null);
    setBusy(false);
    setMessage("");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  const chooseFile = (picked) => {
    if (!picked) return;

    const name = String(picked.name || "").toLowerCase();
    const allowed =
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".csv");

    if (!allowed) {
      setMessage("Please select an Excel (.xlsx/.xls) or CSV file.");
      return;
    }

    setFile(picked);
    setPreview(null);
    setMessage("");
  };

  const formData = () => {
    const fd = new FormData();
    fd.append("file", file);

    if (branchId) fd.append("branch_id", branchId);
    if (sessionId) fd.append("session_id", sessionId);

    return fd;
  };

  const previewFile = async () => {
    if (!file) {
      setMessage("Please choose a file first.");
      return;
    }

    try {
      setBusy(true);
      setMessage("");

      const { data } = await axios.post(
        `${API_BASE}/program-semester-import/preview`,
        formData(),
        {
          headers: {
            ...headers(),
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setPreview(data);
    } catch (err) {
      setMessage(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to preview file."
      );
    } finally {
      setBusy(false);
    }
  };

  const importFile = async () => {
    if (!file) return;

    try {
      setBusy(true);
      setMessage("");

      const { data } = await axios.post(
        `${API_BASE}/program-semester-import/import`,
        formData(),
        {
          headers: {
            ...headers(),
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setMessage(
        `Imported ${data.rowsImported || 0} rows. ` +
          `${data.programsCreated || 0} programs created, ` +
          `${data.sectionsCreated || 0} sections created.`
      );

      setTimeout(() => {
        setOpen(false);
        reset();

        if (typeof onImported === "function") {
          onImported(data);
        } else {
          window.location.reload();
        }
      }, 900);
    } catch (err) {
      const api = err?.response?.data;
      const extra =
        Array.isArray(api?.errors) && api.errors.length
          ? ` ${api.errors.join(" ")}`
          : "";

      setMessage(
        (api?.message || err?.message || "Import failed.") + extra
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    window.open(
      `${API_BASE}/program-semester-import/template.csv`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <>
      <button
        type="button"
        className="psu-upload-btn"
        onClick={() => setOpen(true)}
      >
        <i className="bi bi-file-earmark-arrow-up" />
        Upload Excel / CSV
      </button>

      {open && (
        <div
          className="psu-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="psu-modal" role="dialog" aria-modal="true">
            <div className="psu-header">
              <div>
                <h3>Upload Programs / Semesters</h3>
                <p>Import program / semester names and their batches / sections.</p>
              </div>

              <button type="button" className="psu-close" onClick={close}>
                ×
              </button>
            </div>

            <div className="psu-body">
              <div
                className={`psu-dropzone ${dragging ? "dragging" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  chooseFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  hidden
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => chooseFile(e.target.files?.[0])}
                />

                <div className="psu-upload-icon">
                  <i className="bi bi-cloud-arrow-up" />
                </div>

                <strong>
                  {file ? file.name : "Drag & drop Excel / CSV here"}
                </strong>

                <span>
                  {file
                    ? "Click to choose a different file"
                    : "or click to browse"}
                </span>
              </div>

              <div className="psu-template-row">
                <button
                  type="button"
                  className="psu-link-btn"
                  onClick={downloadTemplate}
                >
                  <i className="bi bi-download" />
                  Download Template
                </button>

                <small>
                  Columns: Program / Semester Name, Batches / Sections
                </small>
              </div>

              {message && <div className="psu-message">{message}</div>}

              {preview && (
                <div className="psu-preview">
                  <div className="psu-summary">
                    <span>
                      <strong>{preview.total || 0}</strong>
                      Rows
                    </span>
                    <span className="ok">
                      <strong>{preview.valid || 0}</strong>
                      Valid
                    </span>
                    <span className={preview.invalid ? "bad" : ""}>
                      <strong>{preview.invalid || 0}</strong>
                      Invalid
                    </span>
                  </div>

                  <div className="psu-table-wrap">
                    <table className="psu-table">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Program / Semester</th>
                          <th>Batches / Sections</th>
                          <th>Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(preview.rows || []).map((row) => (
                          <tr key={`${row.rowNumber}-${row.name}`}>
                            <td>{row.rowNumber}</td>
                            <td>{row.name || "—"}</td>
                            <td>{(row.sections || []).join(", ") || "—"}</td>
                            <td>
                              {row.valid ? (
                                <span className="psu-status ok">Ready</span>
                              ) : (
                                <span
                                  className="psu-status bad"
                                  title={(row.errors || []).join(" ")}
                                >
                                  Fix row
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="psu-footer">
              <button
                type="button"
                className="psu-secondary"
                onClick={close}
                disabled={busy}
              >
                Close
              </button>

              {!preview ? (
                <button
                  type="button"
                  className="psu-primary"
                  onClick={previewFile}
                  disabled={!file || busy}
                >
                  {busy ? "Checking..." : "Preview File"}
                </button>
              ) : (
                <button
                  type="button"
                  className="psu-primary"
                  onClick={importFile}
                  disabled={busy || Number(preview.invalid || 0) > 0}
                >
                  {busy ? "Importing..." : "Import Programs"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProgramSemesterUpload;
