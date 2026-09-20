// src/pages/ClassCoScholasticMapping.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Modal, Button } from "react-bootstrap";
import * as XLSX from "xlsx";

/** 👇 Backend ke hisaab se list endpoint (NO /list) */
const LIST_ENDPOINT = "/class-co-scholastic-areas";
const IMPORT_ENDPOINT = "/class-co-scholastic-areas/import";
const BULK_COPY_ENDPOINT = "/class-co-scholastic-areas/bulk-copy";

/* =========================
 * Helpers
 * ========================= */
const strId = (v) => (v === null || v === undefined ? "" : String(v));

const pickId = (
  obj,
  keys = ["id", "class_id", "area_id", "term_id", "ClassId", "AreaId", "TermId"]
) => {
  if (!obj) return "";
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
  }
  return "";
};

// ✅ existing helper used for IMPORT (keeps >0 only) — leave as-is
const toIntOrNull = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// ✅ NEW: allow 0 (Pre-Nursery) as VALID id
const toIntAllowZeroOrNull = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "") return null; // empty is invalid
  const n = Number(s);
  return Number.isFinite(n) ? n : null; // 0 allowed
};

// normalize dropdown arrays to always have .id (stringable) + label fields
const normalizeClasses = (arr) =>
  (Array.isArray(arr) ? arr : []).map((c) => ({
    ...c,
    id: c?.id ?? c?.class_id ?? c?.ClassId, // ✅ important
    class_name: c?.class_name ?? c?.name ?? c?.class ?? c?.title ?? c?.className ?? "",
  }));

const normalizeAreas = (arr) =>
  (Array.isArray(arr) ? arr : []).map((a) => ({
    ...a,
    id: a?.id ?? a?.area_id ?? a?.AreaId,
    name: a?.name ?? a?.title ?? a?.area_name ?? "",
  }));

const normalizeTerms = (arr) =>
  (Array.isArray(arr) ? arr : []).map((t) => ({
    ...t,
    id: t?.id ?? t?.term_id ?? t?.TermId,
    name: t?.name ?? t?.title ?? t?.term_name ?? "",
  }));

/* =========================
 * Component
 * ========================= */
const ClassCoScholasticMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [areas, setAreas] = useState([]);
  const [terms, setTerms] = useState([]);

  const [formData, setFormData] = useState({
    id: null,
    class_id: "",
    area_id: "",
    term_id: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Import
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  // ✅ Bulk Copy (Class -> Class)
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyData, setCopyData] = useState({
    from_class_id: "",
    to_class_ids: [],
    term_id: "", // optional filter; "" => all terms
    overwrite: false,
  });

  // helper maps for names
  const classById = useMemo(() => {
    const map = new Map();
    (classes || []).forEach((c) => map.set(String(c.id), c));
    return map;
  }, [classes]);

  const termById = useMemo(() => {
    const map = new Map();
    (terms || []).forEach((t) => map.set(String(t.id), t));
    return map;
  }, [terms]);

  useEffect(() => {
    loadDropdowns();
    fetchMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔽 Load dropdown values (with normalization)
  async function loadDropdowns() {
    try {
      const [cRes, aRes, tRes] = await Promise.all([
        api.get("/classes"),
        api.get("/co-scholastic-areas"),
        api.get("/terms"),
      ]);

      setClasses(normalizeClasses(cRes.data));
      setAreas(normalizeAreas(aRes.data));
      setTerms(normalizeTerms(tRes.data));
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to load dropdowns.", "error");
    }
  }

  // 📋 Fetch existing mappings
  async function fetchMappings() {
    try {
      const res = await api.get(LIST_ENDPOINT);
      setMappings(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || "";
      Swal.fire("Error", msg || "Failed to fetch mappings.", "error");
      setMappings([]);
    }
  }

  // ✅ Edit/Add modal
  function openModal(mapping = null) {
    if (mapping) {
      setFormData({
        id: mapping.id ?? null,
        class_id: strId(
          mapping.class_id ||
            pickId(mapping.class, ["id", "class_id", "ClassId"]) ||
            pickId(mapping.Class, ["id", "class_id", "ClassId"])
        ),
        area_id: strId(
          mapping.area_id ||
            pickId(mapping.area, ["id", "area_id", "AreaId"]) ||
            pickId(mapping.Area, ["id", "area_id", "AreaId"])
        ),
        term_id: strId(
          mapping.term_id ||
            pickId(mapping.term, ["id", "term_id", "TermId"]) ||
            pickId(mapping.Term, ["id", "term_id", "TermId"])
        ),
      });
      setIsEditing(true);
    } else {
      setFormData({ id: null, class_id: "", area_id: "", term_id: "" });
      setIsEditing(false);
    }
    setShowModal(true);
  }

  // ✅ Duplicate modal
  function openDuplicateModal(mapping) {
    setFormData({
      id: null,
      class_id: strId(
        mapping.class_id ||
          pickId(mapping.class, ["id", "class_id", "ClassId"]) ||
          pickId(mapping.Class, ["id", "class_id", "ClassId"])
      ),
      area_id: strId(
        mapping.area_id ||
          pickId(mapping.area, ["id", "area_id", "AreaId"]) ||
          pickId(mapping.Area, ["id", "area_id", "AreaId"])
      ),
      term_id: strId(
        mapping.term_id ||
          pickId(mapping.term, ["id", "term_id", "TermId"]) ||
          pickId(mapping.Term, ["id", "term_id", "TermId"])
      ),
    });
    setIsEditing(false);
    setShowModal(true);
  }

  const closeModal = () => setShowModal(false);

  function handleChange(e) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  // 💾 Create / Update mapping
  async function handleSubmit() {
    const payload = {
      ...formData,
      class_id: strId(formData.class_id),
      area_id: strId(formData.area_id),
      term_id: strId(formData.term_id),
    };

    const { class_id, area_id, term_id } = payload;

    if (!class_id || !area_id || !term_id) {
      return Swal.fire("Warning", "Please select Class, Area, and Term.", "warning");
    }

    try {
      if (isEditing && payload.id != null) {
        await api.put(`/class-co-scholastic-areas/${payload.id}`, payload);
      } else {
        await api.post("/class-co-scholastic-areas", payload);
      }
      Swal.fire("Success", "Saved successfully.", "success");
      closeModal();
      fetchMappings();
    } catch (e) {
      Swal.fire("Error", e?.response?.data?.message || "Failed to save.", "error");
    }
  }

  // ❌ Delete mapping
  async function handleDelete(id) {
    const result = await Swal.fire({
      title: "Confirm Delete",
      text: "This will remove the mapping.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/class-co-scholastic-areas/${id}`);
      Swal.fire("Deleted", "Mapping removed.", "success");
      fetchMappings();
    } catch (e) {
      Swal.fire("Error", e?.response?.data?.message || "Failed to delete.", "error");
    }
  }

  /* ============================================================
   * ✅ Bulk Copy: Class -> Class(es)
   * (ID=0 safe)
   * ============================================================ */
  const openCopyModal = () => {
    setCopyData({
      from_class_id: "",
      to_class_ids: [],
      term_id: "",
      overwrite: false,
    });
    setShowCopyModal(true);
  };

  const closeCopyModal = () => setShowCopyModal(false);

  const handleCopySubmit = async () => {
    const { from_class_id, to_class_ids, term_id, overwrite } = copyData;

    const fromId = toIntAllowZeroOrNull(from_class_id); // ✅ 0 ok
    const targetIds = (to_class_ids || [])
      .map(toIntAllowZeroOrNull)
      .filter((v) => v !== null && v !== undefined); // ✅ keep 0

    if (fromId === null || fromId === undefined) {
      return Swal.fire("Warning", "Please select From Class.", "warning");
    }
    if (!targetIds.length) {
      return Swal.fire("Warning", "Please select at least one To Class.", "warning");
    }

    // remove same id from targets
    const cleanedTargets = targetIds.filter((id) => id !== fromId);

    if (!cleanedTargets.length) {
      return Swal.fire("Warning", "To Class(es) cannot include From Class.", "warning");
    }

    const fromName = classById.get(String(fromId))?.class_name ?? String(fromId);
    const toNames = cleanedTargets
      .map((id) => classById.get(String(id))?.class_name ?? String(id))
      .join(", ");

    const termId = toIntAllowZeroOrNull(term_id); // optional
    const termName = termId !== null && termId !== undefined
      ? (termById.get(String(termId))?.name ?? String(termId))
      : "All Terms";

    // ✅ close modal first to avoid overlap
    setShowCopyModal(false);
    await new Promise((r) => setTimeout(r, 150));

    const confirm = await Swal.fire({
      title: "Confirm Copy",
      html: `
        <div style="text-align:left">
          <div><b>From Class:</b> ${fromName}</div>
          <div><b>To Class(es):</b> ${toNames}</div>
          <div><b>Term:</b> ${termName}</div>
          <div><b>Overwrite:</b> ${overwrite ? "Yes (delete target first)" : "No (skip duplicates)"}</div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Copy",
    });

    if (!confirm.isConfirmed) {
      setShowCopyModal(true);
      return;
    }

    try {
      Swal.fire({
        title: "Copying...",
        text: "Please wait",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await api.post(BULK_COPY_ENDPOINT, {
        from_class_id: fromId,            // ✅ 0 allowed
        to_class_ids: cleanedTargets,     // ✅ 0 allowed
        term_id: termId ?? null,
        overwrite: !!overwrite,
      });

      const created = res?.data?.created ?? 0;
      const per = res?.data?.per_target_created || {};

      const perLines = Object.entries(per)
        .map(([cid, cnt]) => {
          const nm = classById.get(String(cid))?.class_name || cid;
          return `${nm}: ${cnt}`;
        })
        .join("<br/>");

      await Swal.fire(
        "Success ✅",
        `
          Copy completed ✅<br/>
          <b>Total created:</b> ${created}<br/>
          ${perLines ? `<hr/><div style="text-align:left">${perLines}</div>` : ""}
        `,
        "success"
      );

      fetchMappings();
    } catch (e) {
      const msg = e?.response?.data?.message || "Bulk copy failed.";
      Swal.fire("Error", msg, "error");
      setShowCopyModal(true);
    }
  };

  /* ============================================================
   * ✅ Import handler (2nd sheet priority)
   * Sheet2 preferred -> if missing/empty -> import all sheets
   * Supported headers:
   * - class_id/area_id/term_id
   * - classId/areaId/termId
   * - Class/Area/Term (numeric IDs)
   * ============================================================ */
  const onPickImportFile = () => fileRef.current?.click();

  const parseRowsFromSheet = (json) => {
    const rows = [];
    for (const r of json) {
      const class_id =
        toIntOrNull(r.class_id) ??
        toIntOrNull(r.classId) ??
        toIntOrNull(r.Class) ??
        toIntOrNull(r.CLASS);

      const area_id =
        toIntOrNull(r.area_id) ??
        toIntOrNull(r.areaId) ??
        toIntOrNull(r.Area) ??
        toIntOrNull(r.AREA);

      const term_id =
        toIntOrNull(r.term_id) ??
        toIntOrNull(r.termId) ??
        toIntOrNull(r.Term) ??
        toIntOrNull(r.TERM);

      rows.push({ class_id, area_id, term_id });
    }
    return rows;
  };

  const sheetToJson = (wb, sheetName) => {
    if (!sheetName) return [];
    const ws = wb.Sheets?.[sheetName];
    if (!ws) return [];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
  };

  const collectRowsFromAllSheets = (wb) => {
    let all = [];
    for (const name of wb.SheetNames || []) {
      const json = sheetToJson(wb, name);
      if (!json.length) continue;
      all = all.concat(parseRowsFromSheet(json));
    }
    return all;
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow same file re-select
    if (!file) return;

    try {
      setImporting(true);

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      // ✅ prefer 2nd sheet
      const sheet2Name = wb.SheetNames?.[1];
      const sheet1Name = wb.SheetNames?.[0];

      let json = sheetToJson(wb, sheet2Name);
      let sourceLabel = sheet2Name ? `Sheet 2: "${sheet2Name}"` : "Sheet 2 (missing)";

      // fallback: if sheet2 empty/missing -> try all sheets
      if (!json.length) {
        const allRows = collectRowsFromAllSheets(wb);
        if (!allRows.length) {
          return Swal.fire("Warning", "No rows found in any sheet.", "warning");
        }

        const confirmAll = await Swal.fire({
          title: "Import mappings?",
          html:
            `Sheet2 is empty/missing. Importing from <b>ALL sheets</b>.<br/>` +
            `Sheets: <b>${(wb.SheetNames || []).join(", ") || "-"}</b><br/>` +
            `Total rows found: <b>${allRows.length}</b>`,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Import",
        });

        if (!confirmAll.isConfirmed) return;

        const res = await api.post(IMPORT_ENDPOINT, { rows: allRows });
        const summary = res?.data?.summary || {};
        const created = summary.created ?? 0;
        const skipped = summary.skipped_duplicates ?? 0;
        const invalid = summary.invalid ?? 0;

        await Swal.fire({
          icon: created > 0 ? "success" : "info",
          title: "Import completed",
          html:
            `<div style="text-align:left">` +
            `<div>✅ Created: <b>${created}</b></div>` +
            `<div>⏭️ Skipped (duplicates): <b>${skipped}</b></div>` +
            `<div>⚠️ Invalid: <b>${invalid}</b></div>` +
            `</div>`,
        });

        fetchMappings();
        return;
      }

      // normal path: sheet2 rows
      const rows = parseRowsFromSheet(json);

      const confirm = await Swal.fire({
        title: "Import mappings?",
        html:
          `Source: <b>${sourceLabel}</b><br/>` +
          `Rows found: <b>${rows.length}</b><br/>` +
          (sheet1Name ? `Sheet1: "${sheet1Name}" (ignored)` : ""),
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Import",
      });

      if (!confirm.isConfirmed) return;

      const res = await api.post(IMPORT_ENDPOINT, { rows });

      const summary = res?.data?.summary || {};
      const created = summary.created ?? 0;
      const skipped = summary.skipped_duplicates ?? 0;
      const invalid = summary.invalid ?? 0;

      await Swal.fire({
        icon: created > 0 ? "success" : "info",
        title: "Import completed",
        html:
          `<div style="text-align:left">` +
          `<div>✅ Created: <b>${created}</b></div>` +
          `<div>⏭️ Skipped (duplicates): <b>${skipped}</b></div>` +
          `<div>⚠️ Invalid: <b>${invalid}</b></div>` +
          `</div>`,
      });

      fetchMappings();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err?.response?.data?.message || "Import failed.", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h2 className="m-0">🎯 Class Co-Scholastic Area Mapping</h2>

        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-secondary" onClick={fetchMappings}>
            Refresh
          </Button>

          {/* ✅ Copy Class Mappings */}
          <Button variant="outline-info" onClick={openCopyModal}>
            📚 Copy Class Mapping
          </Button>

          {/* ✅ Import button */}
          <Button variant="outline-primary" onClick={onPickImportFile} disabled={importing}>
            {importing ? "Importing..." : "⬆️ Import (Sheet2)"}
          </Button>

          <Button variant="success" onClick={() => openModal()}>
            ➕ Add Mapping
          </Button>

          {/* hidden input */}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={handleImportFileChange}
          />
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-bordered table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 60, textAlign: "center" }}>#</th>
                  <th>Class</th>
                  <th>Co-Scholastic Area</th>
                  <th>Term</th>
                  <th style={{ width: 200 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      No mappings found.
                    </td>
                  </tr>
                ) : (
                  mappings.map((m, idx) => (
                    <tr key={m.id}>
                      <td style={{ textAlign: "center" }}>{idx + 1}</td>
                      <td>{m.class?.class_name || m.Class?.class_name || "-"}</td>
                      <td>{m.area?.name || m.Area?.name || "-"}</td>
                      <td>{m.term?.name || m.Term?.name || "-"}</td>

                      <td className="text-nowrap">
                        <button
                          className="btn btn-sm btn-outline-info me-2"
                          onClick={() => openDuplicateModal(m)}
                          title="Duplicate Mapping"
                        >
                          📄
                        </button>

                        <button
                          className="btn btn-sm btn-warning me-2"
                          onClick={() => openModal(m)}
                          title="Edit Mapping"
                        >
                          Edit
                        </button>

                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(m.id)}
                          title="Delete Mapping"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit/Duplicate Modal */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? "✏️ Edit Mapping" : "➕ Add / Duplicate Mapping"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Class</label>
              <select
                name="class_id"
                value={formData.class_id}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={strId(c.id)} value={strId(c.id)}>
                    {c.class_name || "-"}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Co-Scholastic Area</label>
              <select
                name="area_id"
                value={formData.area_id}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select Area</option>
                {areas.map((a) => (
                  <option key={strId(a.id)} value={strId(a.id)}>
                    {a.name || "-"}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label">Term</label>
              <select
                name="term_id"
                value={formData.term_id}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select Term</option>
                {terms.map((t) => (
                  <option key={strId(t.id)} value={strId(t.id)}>
                    {t.name || "-"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="d-flex justify-content-between">
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {isEditing ? "Update" : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ Bulk Copy Modal */}
      <Modal show={showCopyModal} onHide={closeCopyModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>📚 Copy Class Mapping (Bulk)</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label>From Class</label>
              <select
                className="form-control"
                value={copyData.from_class_id}
                onChange={(e) => setCopyData({ ...copyData, from_class_id: e.target.value })}
              >
                <option value="">Select</option>
                {classes.map((c) => (
                  <option key={strId(c.id)} value={strId(c.id)}>
                    {c.class_name}
                  </option>
                ))}
              </select>
              <small className="text-muted">Is class ki co-scholastic mappings copy hongi.</small>
            </div>

            <div className="col-12 col-md-6">
              <label>Term (optional)</label>
              <select
                className="form-control"
                value={copyData.term_id}
                onChange={(e) => setCopyData({ ...copyData, term_id: e.target.value })}
              >
                <option value="">All Terms</option>
                {terms.map((t) => (
                  <option key={strId(t.id)} value={strId(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>
              <small className="text-muted">Blank = all terms. Select = only that term.</small>
            </div>

            <div className="col-12">
              <label>To Class(es)</label>
              <select
                multiple
                className="form-control"
                value={copyData.to_class_ids}
                onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
                  setCopyData({ ...copyData, to_class_ids: vals });
                }}
                style={{ minHeight: 160 }}
              >
                {classes.map((c) => (
                  <option key={strId(c.id)} value={strId(c.id)}>
                    {c.class_name}
                  </option>
                ))}
              </select>
              <small className="text-muted">Ctrl/Command hold karke multiple select karo.</small>
            </div>

            <div className="col-12">
              <div className="form-check mt-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={copyData.overwrite}
                  onChange={(e) => setCopyData({ ...copyData, overwrite: e.target.checked })}
                  id="overwriteClassMapChk"
                />
                <label className="form-check-label" htmlFor="overwriteClassMapChk">
                  Overwrite target mappings (delete first)
                </label>
              </div>
              <small className="text-muted">Unchecked = duplicates safely skip ho jayenge.</small>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={closeCopyModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCopySubmit}>
            Copy Now
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ClassCoScholasticMapping;
