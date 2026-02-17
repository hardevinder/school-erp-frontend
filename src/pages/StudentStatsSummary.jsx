// src/pages/StudentStatsSummary.jsx
import React, { useEffect, useMemo, useCallback, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./FeeStructure.css";

// -------------------------------------------------------------
// Role helper: reads roles from localStorage (single or multiple)
// -------------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  const has = (r) => roles.includes(r);

  return {
    roles,
    isAdmin: has("admin"),
    isSuperadmin: has("superadmin"),
    isAccounts: has("accounts"),
    isAcademicCoordinator: has("academic_coordinator"),
    isTeacher: has("teacher"),
  };
};

const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// small helper to make text readable on colored chips
const textColorForBg = (hex) => {
  if (!hex || typeof hex !== "string") return "#111827";
  const c = hex.replace("#", "").trim();
  if (c.length !== 6) return "#111827";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // perceived brightness
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#111827" : "#ffffff";
};

const StudentStatsSummary = () => {
  const role = useMemo(getRoleFlags, []);
  const canView =
    role.isAdmin ||
    role.isSuperadmin ||
    role.isAccounts ||
    role.isAcademicCoordinator ||
    role.isTeacher;

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // UI
  const [activeTab, setActiveTab] = useState("graphics"); // "graphics" | "matrix"
  const [classSearch, setClassSearch] = useState("");

  const [payload, setPayload] = useState({
    totals: null,
    classHouse: [],
    houseWise: [],
    classWise: [],
  });

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await api.get("/sessions");
      const list = Array.isArray(data) ? data : [];
      setSessions(list);

      if (!selectedSessionId) {
        const active = list.find((s) => s.is_active) || list[0];
        if (active?.id) setSelectedSessionId(active.id);
      }
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to fetch sessions.", "error");
    }
  }, [selectedSessionId]);

  const normalize = useCallback((res) => {
    const root = res?.data && typeof res.data === "object" ? res.data : res || {};
    return {
      totals: root.totals || null,
      classHouse: Array.isArray(root.classHouse) ? root.classHouse : [],
      houseWise: Array.isArray(root.houseWise) ? root.houseWise : [],
      classWise: Array.isArray(root.classWise) ? root.classWise : [],
    };
  }, []);

  const fetchStats = useCallback(async () => {
    if (!canView) {
      Swal.fire("Forbidden", "You don’t have access to view this report.", "warning");
      return;
    }
    if (!selectedSessionId) return;

    setLoading(true);
    try {
      const url = `/students/stats/summary?session_id=${encodeURIComponent(
        selectedSessionId
      )}&include_class_house=1&include_class_gender=0&include_house_gender=0&include_class_section=0`;
      const { data } = await api.get(url);
      setPayload(normalize(data));
    } catch (e) {
      console.error(e);
      Swal.fire("Error", "Failed to fetch class-house stats.", "error");
    } finally {
      setLoading(false);
    }
  }, [canView, selectedSessionId, normalize]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSessionId) fetchStats();
  }, [selectedSessionId, fetchStats]);

  const sessionName = useMemo(() => {
    return sessions.find((s) => String(s.id) === String(selectedSessionId))?.name || "-";
  }, [sessions, selectedSessionId]);

  const totalStudents = useMemo(() => {
    const t = payload.totals;
    if (!t) return 0;
    return toNum(t.students ?? t.total ?? t.count ?? 0);
  }, [payload.totals]);

  // -------------------------------------------------------------
  // Build Matrix + per-class distribution
  // -------------------------------------------------------------
  const matrix = useMemo(() => {
    const rows = Array.isArray(payload.classHouse) ? payload.classHouse : [];

    // unique houses (columns)
    const houseMap = new Map();
    for (const r of rows) {
      const hid = r.house_id ?? null;
      const key = String(hid);
      if (!houseMap.has(key)) {
        houseMap.set(key, {
          house_id: hid,
          house_name: r.house_name || (hid ? "—" : "No House"),
          house_code: r.house_code || null,
          color: r.color || null,
        });
      }
    }

    const houses = Array.from(houseMap.values()).sort((a, b) => {
      // keep "No House" last
      if (a.house_id == null && b.house_id != null) return 1;
      if (a.house_id != null && b.house_id == null) return -1;
      return String(a.house_name || "").localeCompare(String(b.house_name || ""));
    });

    // unique classes (rows)
    const classMap = new Map();
    for (const r of rows) {
      const cid = r.class_id ?? null;
      const cname = r.class_name || (cid ? "—" : "No Class");
      const key = String(cid) + "__" + String(cname);
      if (!classMap.has(key)) {
        classMap.set(key, { class_id: cid, class_name: cname });
      }
    }

    let classes = Array.from(classMap.values()).sort((a, b) => {
      const ai = a.class_id == null ? 1e9 : Number(a.class_id);
      const bi = b.class_id == null ? 1e9 : Number(b.class_id);
      if (Number.isFinite(ai) && Number.isFinite(bi) && ai !== bi) return ai - bi;
      return String(a.class_name || "").localeCompare(String(b.class_name || ""));
    });

    // search filter (small, optional)
    const q = classSearch.trim().toLowerCase();
    if (q) {
      classes = classes.filter((c) => String(c.class_name || "").toLowerCase().includes(q));
    }

    // value map: classKey + houseKey -> count
    const val = new Map();
    for (const r of rows) {
      const cid = r.class_id ?? null;
      const cname = r.class_name || (cid ? "—" : "No Class");
      const classKey = String(cid) + "__" + String(cname);

      const hid = r.house_id ?? null;
      const houseKey = String(hid);

      const k = classKey + "||" + houseKey;
      val.set(k, toNum(r.count ?? 0));
    }

    // totals
    const colTotals = new Map();
    houses.forEach((h) => colTotals.set(String(h.house_id ?? null), 0));

    const rowTotals = new Map();
    const perClassSegments = []; // {class_key, class_name, total, segments:[{house_id, house_name, color, count, pct}]}

    for (const c of classes) {
      const classKey = String(c.class_id ?? null) + "__" + String(c.class_name || "Unknown");

      let sum = 0;
      const segs = houses.map((h) => {
        const hk = String(h.house_id ?? null);
        const k = classKey + "||" + hk;
        const count = toNum(val.get(k) ?? 0);
        sum += count;
        colTotals.set(hk, toNum(colTotals.get(hk)) + count);
        return { ...h, count };
      });

      rowTotals.set(classKey, sum);

      perClassSegments.push({
        class_key: classKey,
        class_id: c.class_id ?? null,
        class_name: c.class_name,
        total: sum,
        segments: segs,
      });
    }

    const grandTotal = Array.from(colTotals.values()).reduce((a, b) => a + toNum(b), 0);

    return { houses, classes, val, rowTotals, colTotals, grandTotal, perClassSegments };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.classHouse, classSearch]);

  // Top house summary (from classHouse totals so it stays consistent)
  const houseSummary = useMemo(() => {
    const houses = matrix.houses || [];
    const out = houses.map((h) => {
      const hk = String(h.house_id ?? null);
      const count = toNum(matrix.colTotals.get(hk) ?? 0);
      const pct = matrix.grandTotal ? (count / matrix.grandTotal) * 100 : 0;
      return { ...h, count, pct };
    });
    // high to low
    out.sort((a, b) => (b.count || 0) - (a.count || 0));
    return out;
  }, [matrix]);

  if (!canView) {
    return (
      <div className="container mt-3">
        <div className="alert alert-warning">
          Forbidden: You don’t have access to view Student Stats Summary.
        </div>
      </div>
    );
  }

  const hasData = (payload.classHouse || []).length > 0;

  return (
    <div className="container-fluid mt-2">
      {/* Inline page polish */}
      <style>{`
        .ss-card {
          border: 0;
          border-radius: 14px;
          overflow: hidden;
        }
        .ss-topbar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 14px;
          padding: 10px 12px;
        }
        .ss-title {
          font-weight: 900;
          font-size: 16px;
          margin: 0;
          letter-spacing: 0.2px;
        }
        .ss-sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }
        .ss-tabbtn {
          border: 1px solid rgba(0,0,0,0.10);
          background: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .ss-tabbtn.active {
          background: #eef2ff;
          border-color: rgba(99,102,241,0.55);
        }
        .ss-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 8px;
          font-size: 11px;
          font-weight: 800;
          border: 1px solid rgba(0,0,0,0.08);
          white-space: nowrap;
        }
        .ss-dot {
          width: 10px; height: 10px; border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.12);
        }
        .ss-kpi {
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.06);
          background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
          padding: 10px;
        }
        .ss-kpi .num { font-size: 18px; font-weight: 900; }
        .ss-kpi .lbl { font-size: 12px; color: #6b7280; margin-top: -2px; }
        .ss-stacked {
          height: 16px;
          border-radius: 999px;
          background: #f3f4f6;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.06);
        }
        .ss-seg { height: 100%; display: inline-block; }
        .ss-row {
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 14px;
          padding: 10px;
          background: #fff;
        }
        .ss-matrixWrap {
          max-height: 70vh;
          border-radius: 14px;
          overflow: auto;
          border: 1px solid rgba(0,0,0,0.06);
        }
      `}</style>

      {/* Sticky compact top header */}
      <div className="ss-topbar mb-2 shadow-sm">
        <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
          <div>
            <div className="ss-title">Class-wise House Distribution</div>
            <div className="ss-sub">
              Session: <b>{sessionName}</b> • Total Students: <b>{totalStudents}</b>
              {hasData ? (
                <>
                  {" "}• Houses: <b>{matrix.houses.length}</b> • Classes: <b>{matrix.classes.length}</b>
                </>
              ) : null}
            </div>
          </div>

          <div className="d-flex gap-2 flex-wrap align-items-center">
            {/* Tabs */}
            <button
              className={`ss-tabbtn ${activeTab === "graphics" ? "active" : ""}`}
              onClick={() => setActiveTab("graphics")}
              type="button"
            >
              📊 Graphics
            </button>
            <button
              className={`ss-tabbtn ${activeTab === "matrix" ? "active" : ""}`}
              onClick={() => setActiveTab("matrix")}
              type="button"
            >
              🧾 Matrix
            </button>

            {/* Only session selector */}
            <select
              className="form-select form-select-sm"
              style={{ minWidth: 190 }}
              value={selectedSessionId ?? ""}
              onChange={(e) => setSelectedSessionId(Number(e.target.value) || null)}
            >
              <option value="">(Select session)</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.is_active ? "(Active)" : ""}
                </option>
              ))}
            </select>

            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={fetchStats}
              disabled={!selectedSessionId || loading}
              type="button"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="card ss-card shadow-sm">
        <div className="card-body p-2">
          {loading ? (
            <div className="text-muted px-2 py-2">Loading…</div>
          ) : !hasData ? (
            <div className="text-muted px-2 py-2">
              No data found. (API must return <b>classHouse</b> array)
            </div>
          ) : (
            <>
              {/* House legend */}
              <div className="d-flex flex-wrap gap-1 px-1 pb-2">
                {matrix.houses.map((h) => (
                  <span
                    key={`legend-${String(h.house_id ?? "null")}`}
                    className="ss-chip"
                    style={{
                      background: h.color || "#e5e7eb",
                      color: textColorForBg(h.color),
                    }}
                    title={h.house_name}
                  >
                    <span className="ss-dot" style={{ background: h.color || "#9ca3af" }} />
                    {h.house_code || h.house_name}
                  </span>
                ))}
              </div>

              {/* Small KPI strip + optional search (VERY small) */}
              <div className="d-flex flex-wrap gap-2 px-1 pb-2 align-items-center">
                <div className="ss-kpi">
                  <div className="num">{matrix.grandTotal}</div>
                  <div className="lbl">Grand Total</div>
                </div>

                <div className="ss-kpi">
                  <div className="num">{matrix.classes.length}</div>
                  <div className="lbl">Classes</div>
                </div>

                <div className="ss-kpi">
                  <div className="num">{matrix.houses.length}</div>
                  <div className="lbl">Houses</div>
                </div>

                <div className="ms-auto" style={{ minWidth: 220 }}>
                  <input
                    className="form-control form-control-sm"
                    placeholder="Search class (optional)"
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                  />
                </div>
              </div>

              {activeTab === "graphics" ? (
                <>
                  {/* Top Houses summary */}
                  <div className="px-1 pb-2">
                    <div className="text-muted" style={{ fontSize: 12, fontWeight: 800 }}>
                      House Share (overall)
                    </div>

                    <div className="d-flex flex-wrap gap-2 mt-1">
                      {houseSummary.map((h) => (
                        <div
                          key={`hs-${String(h.house_id ?? "null")}`}
                          className="ss-row"
                          style={{ minWidth: 220, flex: "1 1 260px" }}
                        >
                          <div className="d-flex align-items-center justify-content-between gap-2">
                            <div style={{ fontWeight: 900, fontSize: 13 }}>
                              <span
                                className="ss-dot me-2"
                                style={{ background: h.color || "#9ca3af", display: "inline-block" }}
                              />
                              {h.house_name}
                            </div>
                            <div style={{ fontWeight: 900 }}>{h.count}</div>
                          </div>

                          <div className="ss-stacked mt-2" title={`${h.house_name}: ${h.count}`}>
                            <span
                              className="ss-seg"
                              style={{
                                width: `${Math.max(0, Math.min(100, h.pct))}%`,
                                background: h.color || "#9ca3af",
                              }}
                            />
                          </div>

                          <div className="text-muted mt-1" style={{ fontSize: 11 }}>
                            Share: <b>{h.pct.toFixed(1)}%</b>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-class stacked bars */}
                  <div className="px-1 pb-1">
                    <div className="text-muted" style={{ fontSize: 12, fontWeight: 800 }}>
                      Class-wise Stacked Bars (House distribution inside each class)
                    </div>

                    <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
                      {matrix.perClassSegments.map((c) => {
                        const total = toNum(c.total);
                        const safeTotal = total || 1;

                        return (
                          <div key={`bar-${c.class_key}`} className="ss-row">
                            <div className="d-flex align-items-center justify-content-between gap-2">
                              <div style={{ fontWeight: 900, fontSize: 13 }}>{c.class_name}</div>
                              <div style={{ fontWeight: 900 }}>{total}</div>
                            </div>

                            {/* stacked bar */}
                            <div className="ss-stacked mt-2" title={`${c.class_name} total ${total}`}>
                              {c.segments.map((s) => {
                                const count = toNum(s.count);
                                if (!count) return null;
                                const pct = (count / safeTotal) * 100;

                                return (
                                  <span
                                    key={`seg-${c.class_key}-${String(s.house_id ?? "null")}`}
                                    className="ss-seg"
                                    style={{
                                      width: `${pct}%`,
                                      background: s.color || "#9ca3af",
                                    }}
                                    title={`${s.house_name}: ${count}`}
                                  />
                                );
                              })}
                            </div>

                            {/* mini breakdown line */}
                            <div
                              className="text-muted mt-2"
                              style={{ fontSize: 11, display: "flex", flexWrap: "wrap", gap: 10 }}
                            >
                              {c.segments
                                .filter((s) => toNum(s.count) > 0)
                                .sort((a, b) => toNum(b.count) - toNum(a.count))
                                .slice(0, 6)
                                .map((s) => (
                                  <span key={`mini-${c.class_key}-${String(s.house_id ?? "null")}`}>
                                    <span
                                      className="ss-dot me-1"
                                      style={{
                                        background: s.color || "#9ca3af",
                                        display: "inline-block",
                                        verticalAlign: "middle",
                                      }}
                                    />
                                    {s.house_code || s.house_name}: <b>{toNum(s.count)}</b>
                                  </span>
                                ))}
                              {c.segments.filter((s) => toNum(s.count) > 0).length > 6 ? (
                                <span>…</span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Matrix */}
                  <div className="px-1">
                    <div className="text-muted" style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
                      Matrix (Class × House)
                    </div>

                    <div className="ss-matrixWrap">
                      <table className="table table-sm table-bordered mb-0" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th
                              className="sticky-top"
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 5,
                                background: "linear-gradient(90deg,#eef2ff 0%,#ffffff 100%)",
                                minWidth: 130,
                                fontWeight: 900,
                              }}
                            >
                              Class
                            </th>

                            {matrix.houses.map((h) => {
                              const hk = String(h.house_id ?? null);
                              return (
                                <th
                                  key={`h-${hk}`}
                                  className="sticky-top text-center"
                                  style={{
                                    background: "linear-gradient(90deg,#eef2ff 0%,#ffffff 100%)",
                                    minWidth: 90,
                                    fontWeight: 900,
                                  }}
                                  title={h.house_name}
                                >
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                    <span className="ss-dot" style={{ background: h.color || "#9ca3af" }} />
                                    <span style={{ whiteSpace: "nowrap" }}>{h.house_code || h.house_name}</span>
                                  </div>
                                </th>
                              );
                            })}

                            <th
                              className="sticky-top text-center"
                              style={{
                                background: "linear-gradient(90deg,#eef2ff 0%,#ffffff 100%)",
                                minWidth: 90,
                                fontWeight: 900,
                              }}
                            >
                              Total
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {matrix.classes.map((c) => {
                            const classKey = String(c.class_id ?? null) + "__" + String(c.class_name || "Unknown");
                            const rowTotal = toNum(matrix.rowTotals.get(classKey) ?? 0);

                            return (
                              <tr key={`c-${classKey}`}>
                                <td
                                  style={{
                                    position: "sticky",
                                    left: 0,
                                    zIndex: 4,
                                    background: "#fff",
                                    fontWeight: 900,
                                    minWidth: 130,
                                  }}
                                >
                                  {c.class_name || "-"}
                                </td>

                                {matrix.houses.map((h) => {
                                  const hk = String(h.house_id ?? null);
                                  const k = classKey + "||" + hk;
                                  const count = toNum(matrix.val.get(k) ?? 0);
                                  const isZero = count === 0;

                                  return (
                                    <td
                                      key={`cell-${classKey}-${hk}`}
                                      className="text-center"
                                      style={{
                                        background: isZero ? "#fafafa" : "#ffffff",
                                        fontWeight: count ? 900 : 500,
                                      }}
                                      title={`${c.class_name} → ${h.house_name}: ${count}`}
                                    >
                                      {count || ""}
                                    </td>
                                  );
                                })}

                                <td className="text-center" style={{ fontWeight: 900, background: "#f9fafb" }}>
                                  {rowTotal}
                                </td>
                              </tr>
                            );
                          })}

                          {/* totals row */}
                          <tr>
                            <td
                              style={{
                                position: "sticky",
                                left: 0,
                                zIndex: 4,
                                background: "#f3f4f6",
                                fontWeight: 900,
                              }}
                            >
                              Total
                            </td>

                            {matrix.houses.map((h) => {
                              const hk = String(h.house_id ?? null);
                              const colTotal = toNum(matrix.colTotals.get(hk) ?? 0);
                              return (
                                <td
                                  key={`coltot-${hk}`}
                                  className="text-center"
                                  style={{ fontWeight: 900, background: "#f3f4f6" }}
                                >
                                  {colTotal}
                                </td>
                              );
                            })}

                            <td className="text-center" style={{ fontWeight: 900, background: "#f3f4f6" }}>
                              {matrix.grandTotal}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="text-muted px-1 pt-2" style={{ fontSize: 11 }}>
                      Sticky header + sticky class column ✅
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentStatsSummary;
