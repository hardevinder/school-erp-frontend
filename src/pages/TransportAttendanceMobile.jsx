// src/pages/TransportAttendanceMobile.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api"; // ✅ adjust if your axios instance path differs
import Swal from "sweetalert2";
import "./TransportAttendanceMobile.css";

const todayYYYYMMDD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const TripPill = ({ value, active, onClick }) => (
  <button
    type="button"
    className={`ta-pill ${active ? "active" : ""}`}
    onClick={() => onClick(value)}
  >
    {value === "pickup" ? "Pickup" : "Drop"}
  </button>
);

const StatusSeg = ({ value, active, onClick }) => (
  <button
    type="button"
    className={`ta-seg ${active ? "active" : ""}`}
    onClick={onClick}
  >
    {value === "present" ? "P" : value === "absent" ? "A" : "L"}
  </button>
);

const StatCard = ({ label, value, tone }) => (
  <div className={`ta-stat ${tone || ""}`}>
    <div className="ta-statVal">{value}</div>
    <div className="ta-statLbl">{label}</div>
  </div>
);

export default function TransportAttendanceMobile() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [buses, setBuses] = useState([]);
  const [busId, setBusId] = useState(null);

  const [tripType, setTripType] = useState("pickup");
  const [date, setDate] = useState(todayYYYYMMDD());

  // list returned from /my-list (already includes attendance if exists)
  const [rows, setRows] = useState([]);

  // local edits map: student_id -> {status, notes}
  const [draft, setDraft] = useState({});

  const [q, setQ] = useState("");

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    const base = rows.filter((r) => {
      if (!busId) return true;
      return Number(r.bus_id) === Number(busId);
    });

    if (!term) return base;

    return base.filter((r) => {
      const s = r.student || {};
      const name = String(s.name || "").toLowerCase();
      const adm = String(s.admission_number || "").toLowerCase();
      const cls = String(s.Class?.class_name || s.class?.class_name || "").toLowerCase();
      const sec = String(s.Section?.section_name || s.section?.section_name || "").toLowerCase();
      const stop = String(r.stop || "").toLowerCase();
      return name.includes(term) || adm.includes(term) || cls.includes(term) || sec.includes(term) || stop.includes(term);
    });
  }, [rows, q, busId]);

  const changedCount = useMemo(() => Object.keys(draft).length, [draft]);

  const getEffectiveStatus = useCallback(
    (r) => {
      const d = draft[r.student_id];
      if (d?.status) return d.status;
      if (r.attendance?.status) return r.attendance.status;
      return "present"; // default
    },
    [draft]
  );

  const getEffectiveNotes = useCallback(
    (r) => {
      const d = draft[r.student_id];
      if (d?.notes !== undefined) return d.notes;
      return r.attendance?.notes || "";
    },
    [draft]
  );

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let total = filteredRows.length;

    for (const r of filteredRows) {
      const st = getEffectiveStatus(r);
      if (st === "present") present += 1;
      else if (st === "absent") absent += 1;
      else if (st === "leave") leave += 1;
    }

    const other = Math.max(0, total - (present + absent + leave));
    return { total, present, absent, leave, other };
  }, [filteredRows, getEffectiveStatus]);

  const loadBuses = async () => {
    try {
      const res = await api.get("/transport-attendance/my-buses");
      const list = res?.data?.data || [];
      setBuses(list);

      // auto-select if one bus
      if (list.length === 1) setBusId(list[0].id);
      if (list.length === 0) setBusId(null);
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to load buses", "error");
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await api.get("/transport-attendance/my-list", {
        params: { trip_type: tripType, date },
      });

      const list = res?.data?.students || [];
      setRows(list);

      // If multiple buses and none selected, pick first bus from list
      const busIds = [...new Set(list.map((x) => x.bus_id).filter(Boolean))];
      if (!busId && busIds.length) setBusId(busIds[0]);

      setDraft({}); // reset local edits on reload
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e?.response?.data?.message || "Failed to load list", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuses();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    loadList();
    // eslint-disable-next-line
  }, [tripType, date]);

  const setStatus = (studentId, status) => {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), status },
    }));
  };

  const setNotes = (studentId, notes) => {
    setDraft((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || {}), notes },
    }));
  };

  const openNotes = async (r) => {
    const s = r.student || {};
    const current = getEffectiveNotes(r) || "";
    const { value, isConfirmed } = await Swal.fire({
      title: "Notes",
      html: `<div style="font-size:12px; opacity:.85; margin-bottom:8px;">
              <b>${(s.name || "Student").replace(/</g, "&lt;")}</b>
              <span style="opacity:.7;"> • ${String(s.admission_number || "-").replace(/</g, "&lt;")}</span>
            </div>`,
      input: "textarea",
      inputValue: current,
      inputPlaceholder: "Write note (optional)…",
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
      inputAttributes: { autocapitalize: "sentences" },
    });
    if (!isConfirmed) return;
    setNotes(r.student_id, value || "");
  };

  const applyBulk = async (status) => {
    if (!filteredRows.length) return;

    const confirm = await Swal.fire({
      title: "Apply to all?",
      text: `Set ${filteredRows.length} students to ${status.toUpperCase()}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;

    setDraft((prev) => {
      const next = { ...prev };
      for (const r of filteredRows) {
        const sid = r.student_id;
        next[sid] = { ...(next[sid] || {}), status };
      }
      return next;
    });
  };

  const clearLocalChanges = async () => {
    if (!Object.keys(draft).length) return;
    const confirm = await Swal.fire({
      title: "Clear changes?",
      text: "This will remove unsaved changes on this screen.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Clear",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;
    setDraft({});
  };

  const buildPayload = () => {
    // send only filtered rows for selected bus (recommended)
    const toSend = filteredRows.map((r) => ({
      student_id: r.student_id,
      status: getEffectiveStatus(r),
      notes: (getEffectiveNotes(r) || "").trim() || "",
    }));

    return {
      date,
      trip_type: tripType,
      records: toSend,
    };
  };

  const save = async () => {
    if (!rows.length) return;

    const confirm = await Swal.fire({
      title: "Save Attendance?",
      text: `Trip: ${tripType.toUpperCase()} | Date: ${date} | Students: ${filteredRows.length}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;

    setSaving(true);
    try {
      const payload = buildPayload();
      const res = await api.post("/transport-attendance/mark-bulk", payload);

      const rejected = res?.data?.rejected || [];
      const marked = res?.data?.marked ?? 0;

      if (rejected.length) {
        Swal.fire("Saved (some rejected)", `Saved: ${marked}\nRejected: ${rejected.length}`, "warning");
        console.warn("Rejected records:", rejected);
      } else {
        Swal.fire("Saved", `Attendance saved successfully (${marked})`, "success");
      }

      await loadList();
    } catch (e) {
      console.error(e);
      Swal.fire("Error", e?.response?.data?.message || "Failed to save attendance", "error");
    } finally {
      setSaving(false);
    }
  };

  const busOptions = useMemo(() => {
    if (buses.length) return buses;

    const map = new Map();
    rows.forEach((r) => {
      if (r.bus_id && !map.has(r.bus_id)) {
        map.set(r.bus_id, { id: r.bus_id, bus_name: `Bus #${r.bus_id}` });
      }
    });
    return Array.from(map.values());
  }, [buses, rows]);

  return (
    <div className="ta-page compact">
      {/* Sticky compact header */}
      <div className="ta-header sticky">
        <div className="ta-headRow">
          <div className="ta-title">Transport Attendance</div>
          <button
            type="button"
            className="ta-iconBtn"
            onClick={loadList}
            disabled={loading || saving}
            title="Reload"
          >
            ↻
          </button>
        </div>

        <div className="ta-controls compact">
          <div className="ta-trip">
            <TripPill value="pickup" active={tripType === "pickup"} onClick={setTripType} />
            <TripPill value="drop" active={tripType === "drop"} onClick={setTripType} />
          </div>

          <div className="ta-grid2">
            <label className="ta-label">
              Date
              <input type="date" className="ta-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label className="ta-label">
              Bus
              <select
                className="ta-input"
                value={busId ?? ""}
                onChange={(e) => setBusId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">All</option>
                {busOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bus_name || b.name || `Bus #${b.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ta-row tight">
            <input
              className="ta-search"
              placeholder="Search name / adm / class / stop…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Stats row (small cards) */}
          <div className="ta-statsRow">
            <StatCard label="Total" value={counts.total} />
            <StatCard label="Present" value={counts.present} tone="present" />
            <StatCard label="Absent" value={counts.absent} tone="absent" />
            <StatCard label="Leave" value={counts.leave} tone="leave" />
          </div>

          {/* Bulk actions */}
          <div className="ta-bulkRow">
            <button type="button" className="ta-miniBtn" onClick={() => applyBulk("present")} disabled={!counts.total || loading || saving}>
              P all
            </button>
            <button type="button" className="ta-miniBtn" onClick={() => applyBulk("absent")} disabled={!counts.total || loading || saving}>
              A all
            </button>
            <button type="button" className="ta-miniBtn" onClick={() => applyBulk("leave")} disabled={!counts.total || loading || saving}>
              L all
            </button>
            <button type="button" className="ta-miniBtn ghost" onClick={clearLocalChanges} disabled={!changedCount || loading || saving}>
              Clear
            </button>

            <div className="ta-changesPill" title="Unsaved changes">
              Changes: <b>{changedCount}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="ta-body compact">
        {loading ? (
          <div className="ta-empty">Loading…</div>
        ) : !rows.length ? (
          <div className="ta-empty">
            No students found.
            <div className="ta-hint">Check assignments + active dates (pickup_bus_id / drop_bus_id).</div>
          </div>
        ) : (
          <div className="ta-list compact">
            {filteredRows.map((r) => {
              const s = r.student || {};
              const status = getEffectiveStatus(r);
              const notes = getEffectiveNotes(r);

              const cls = s.Class?.class_name || s.class?.class_name || "";
              const sec = s.Section?.section_name || s.section?.section_name || "";
              const line2Left = `${s.admission_number || "-"} • ${cls}${sec ? `-${sec}` : ""}`;
              const line2Right = `${r.stop ? r.stop : ""}`.trim();

              return (
                <div key={r.student_id} className={`ta-rowItem ${status}`}>
                  <div className="ta-rowMain">
                    <div className="ta-left">
                      <div className="ta-rowName" title={s.name || ""}>
                        {s.name || "Student"}
                      </div>
                      <div className="ta-rowMeta">
                        <span className="ta-muted">{line2Left}</span>
                        {line2Right ? <span className="ta-dot">•</span> : null}
                        {line2Right ? <span className="ta-stop" title={r.stop || ""}>{line2Right}</span> : null}
                      </div>
                    </div>

                    <div className="ta-right">
                      <div className="ta-segWrap" aria-label="Status">
                        <StatusSeg value="present" active={status === "present"} onClick={() => setStatus(r.student_id, "present")} />
                        <StatusSeg value="absent" active={status === "absent"} onClick={() => setStatus(r.student_id, "absent")} />
                        <StatusSeg value="leave" active={status === "leave"} onClick={() => setStatus(r.student_id, "leave")} />
                      </div>

                      <button
                        type="button"
                        className={`ta-noteBtn ${notes ? "has" : ""}`}
                        onClick={() => openNotes(r)}
                        title={notes ? "Edit notes" : "Add notes"}
                      >
                        ✎
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="ta-footer sticky">
        <div className="ta-footerInfo">
          <div className="ta-footerLine">
            <b>{tripType.toUpperCase()}</b> • {date} {busId ? `• Bus #${busId}` : ""}
          </div>
          <div className="ta-footerLine">
            {counts.total ? (
              <>
                P:<b>{counts.present}</b> A:<b>{counts.absent}</b> L:<b>{counts.leave}</b>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        <button type="button" className="ta-save" onClick={save} disabled={saving || loading || !rows.length}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
