import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const normalizeList = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const moveItem = (list, from, to) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const classLabel = (row) => row?.class_name || row?.name || row?.id;

const ReportCardSubjectOrder = () => {
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState("");
  const [targetClassIds, setTargetClassIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    const boot = async () => {
      try {
        const [sessionRes, classRes] = await Promise.all([
          api.get("/sessions"),
          api.get("/classes"),
        ]);
        const sessionList = normalizeList(sessionRes.data, "sessions");
        const classList = normalizeList(classRes.data, "classes");
        setSessions(sessionList);
        setClasses(classList);
        const active = sessionList.find((row) => row?.is_active);
        if (active?.id) setSessionId(String(active.id));
      } catch (error) {
        Swal.fire("Error", error?.response?.data?.message || "Failed to load setup data", "error");
      }
    };
    boot();
  }, []);

  useEffect(() => {
    setSubjects([]);
    setTargetClassIds((prev) => prev.filter((id) => String(id) !== String(classId)));
    if (!sessionId || !classId) return;

    const loadOrder = async () => {
      try {
        setLoading(true);
        const res = await api.get("/report-card-subject-order", {
          params: {
            session_id: Number(sessionId),
            class_id: Number(classId),
          },
        });
        setSubjects(Array.isArray(res.data?.subjects) ? res.data.subjects : []);
      } catch (error) {
        Swal.fire("Error", error?.response?.data?.message || "Failed to load report-card subject order", "error");
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [sessionId, classId]);

  const selectedClass = useMemo(
    () => classes.find((row) => String(row.id) === String(classId)),
    [classes, classId]
  );

  const targetClasses = useMemo(
    () => classes.filter((row) => String(row.id) !== String(classId)),
    [classes, classId]
  );

  const move = (from, to) => setSubjects((prev) => moveItem(prev, from, to));

  const toggleTargetClass = (id) => {
    const value = Number(id);
    setTargetClassIds((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const selectAllTargets = () => {
    setTargetClassIds(targetClasses.map((row) => Number(row.id)).filter((id) => Number.isInteger(id)));
  };

  const save = async ({ applyToSelected = false } = {}) => {
    if (!sessionId || !classId) {
      Swal.fire("Select Details", "Please select session and class first.", "warning");
      return;
    }
    if (!subjects.length) {
      Swal.fire("No Subjects", "No subjects are available to save.", "info");
      return;
    }

    if (applyToSelected && !targetClassIds.length) {
      Swal.fire("Select Classes", "Please select at least one additional class to apply this order.", "warning");
      return;
    }

    try {
      setSaving(true);
      const res = await api.put("/report-card-subject-order", {
        session_id: Number(sessionId),
        class_id: Number(classId),
        subject_ids: subjects.map((row) => Number(row.id)),
        target_class_ids: applyToSelected ? targetClassIds : [],
      });
      await Swal.fire({
        icon: "success",
        title: applyToSelected ? "Order Applied" : "Subject Order Saved",
        text: res.data?.message || "Report-card subject order saved successfully.",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire("Error", error?.response?.data?.message || "Failed to save subject order", "error");
    } finally {
      setSaving(false);
    }
  };

  const sortAlphabetically = () => {
    setSubjects((prev) =>
      [...prev].sort((a, b) => {
        const aType = String(a.type || "Scholastic") === "Co-Scholastic" ? 1 : 0;
        const bType = String(b.type || "Scholastic") === "Co-Scholastic" ? 1 : 0;
        if (aType !== bType) return aType - bType;
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
    );
  };

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h4 className="mb-1">Report Card Subject Order</h4>
          <div className="text-muted small">
            Set the sequence once for a class. It applies to all sections, and you can copy the same sequence to multiple classes.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => save({ applyToSelected: false })}
          disabled={saving || loading || !subjects.length}
        >
          {saving ? "Saving..." : "Save Order"}
        </button>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Session</label>
              <select className="form-select" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">Select Session</option>
                {sessions.map((row) => (
                  <option key={row.id} value={row.id}>{row.name || row.session_name || row.id}</option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label fw-semibold">Source Class</label>
              <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select Class</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>{classLabel(row)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Apply Same Order to Multiple Classes</strong>
            <div className="text-muted small">Optional — select the classes that should follow the source-class sequence.</div>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={selectAllTargets}
              disabled={!classId || !targetClasses.length}
            >
              Select All
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setTargetClassIds([])}
              disabled={!targetClassIds.length}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="card-body">
          {!classId ? (
            <div className="text-muted small">Select the source class first.</div>
          ) : !targetClasses.length ? (
            <div className="text-muted small">No other classes are available.</div>
          ) : (
            <>
              <div className="row g-2" style={{ maxHeight: 220, overflowY: "auto" }}>
                {targetClasses.map((row) => {
                  const id = Number(row.id);
                  const checked = targetClassIds.includes(id);
                  return (
                    <div className="col-sm-6 col-lg-4 col-xl-3" key={row.id}>
                      <label className={`border rounded p-2 d-flex align-items-center gap-2 w-100 ${checked ? "bg-light" : ""}`} style={{ cursor: "pointer" }}>
                        <input
                          className="form-check-input m-0"
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTargetClass(id)}
                        />
                        <span>{classLabel(row)}</span>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
                <div className="text-muted small">
                  {targetClassIds.length
                    ? `${targetClassIds.length} additional class${targetClassIds.length === 1 ? "" : "es"} selected.`
                    : "No additional classes selected."}
                </div>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => save({ applyToSelected: true })}
                  disabled={saving || loading || !subjects.length || !targetClassIds.length}
                >
                  {saving ? "Applying..." : `Save & Apply to Selected${targetClassIds.length ? ` (${targetClassIds.length})` : ""}`}
                </button>
              </div>

              <div className="alert alert-light border mt-3 mb-0 py-2 small">
                Common subjects follow the same sequence. If a selected class has an extra subject, it is kept after the shared subjects instead of being removed.
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <strong>Subject Sequence</strong>
            {selectedClass ? (
              <span className="text-muted ms-2 small">
                {classLabel(selectedClass)} · All Sections
              </span>
            ) : null}
          </div>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={sortAlphabetically} disabled={!subjects.length}>
            Sort A-Z
          </button>
        </div>
        <div className="card-body">
          <div className="alert alert-info py-2 small">
            Drag subjects into the required sequence and save. Every report card for this class will follow this order, regardless of section.
          </div>

          {loading ? (
            <div className="text-center py-5"><div className="spinner-border" role="status" /></div>
          ) : !sessionId || !classId ? (
            <div className="text-muted text-center py-5">Select Session and Class to arrange subjects.</div>
          ) : !subjects.length ? (
            <div className="text-muted text-center py-5">No subjects found for this class.</div>
          ) : (
            <div className="list-group">
              {subjects.map((subject, index) => (
                <div
                  key={subject.id}
                  className="list-group-item d-flex align-items-center gap-3"
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) move(dragIndex, index);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  style={{ cursor: "grab" }}
                >
                  <div className="text-muted fw-bold" style={{ minWidth: 28 }}>{index + 1}</div>
                  <div className="text-secondary" title="Drag to reorder"><i className="bi bi-grip-vertical fs-5" /></div>
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{subject.name}</div>
                    <span className={`badge ${String(subject.type) === "Co-Scholastic" ? "text-bg-success" : "text-bg-primary"}`}>
                      {subject.type || "Scholastic"}
                    </span>
                  </div>
                  <div className="btn-group btn-group-sm">
                    <button type="button" className="btn btn-outline-secondary" onClick={() => move(index, index - 1)} disabled={index === 0} title="Move up">
                      <i className="bi bi-arrow-up" />
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={() => move(index, index + 1)} disabled={index === subjects.length - 1} title="Move down">
                      <i className="bi bi-arrow-down" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportCardSubjectOrder;
