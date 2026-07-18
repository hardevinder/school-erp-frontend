// src/pages/TransportAttendanceMobile.jsx
"use strict";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./TransportAttendanceMobile.css";

const LOCATION_SEND_INTERVAL_MS = 10000;

const todayYYYYMMDD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getStoredRoles = () => {
  try {
    const multiple = JSON.parse(localStorage.getItem("roles") || "[]");
    const single = localStorage.getItem("userRole");
    return (multiple.length ? multiple : [single].filter(Boolean)).map((role) =>
      String(role || "").trim().toLowerCase(),
    );
  } catch {
    return [localStorage.getItem("userRole")]
      .filter(Boolean)
      .map((role) => String(role).trim().toLowerCase());
  }
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const safeLocationText = (value) => String(value ?? "").trim();

const toFiniteCoordinate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const buildGoogleMapsUrl = ({ address, latitude, longitude }) => {
  const lat = toFiniteCoordinate(latitude);
  const lng = toFiniteCoordinate(longitude);

  const query =
    lat !== null && lng !== null
      ? `${lat},${lng}`
      : safeLocationText(address);

  if (!query) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query,
  )}`;
};

const getStudentLocation = (row, type) => {
  const structured = row?.[`${type}_location`] || {};

  const stop = safeLocationText(
    structured.stop ?? row?.[`${type}_stop`],
  );
  const address = safeLocationText(
    structured.address ?? row?.[`${type}_address`],
  );
  const latitude = toFiniteCoordinate(
    structured.latitude ?? row?.[`${type}_latitude`],
  );
  const longitude = toFiniteCoordinate(
    structured.longitude ?? row?.[`${type}_longitude`],
  );

  const backendMapsUrl = safeLocationText(
    structured.maps_url ?? row?.[`${type}_maps_url`],
  );

  const mapsUrl =
    backendMapsUrl ||
    buildGoogleMapsUrl({ address, latitude, longitude });

  return {
    type,
    stop,
    address,
    latitude,
    longitude,
    mapsUrl,
    hasCoordinates: latitude !== null && longitude !== null,
    hasData:
      Boolean(stop) ||
      Boolean(address) ||
      (latitude !== null && longitude !== null),
  };
};

const StudentLocationCard = ({ type, location, active }) => {
  const isPickup = type === "pickup";
  const label = isPickup ? "Pickup" : "Drop";

  return (
    <div
      className={`ta-locationCard ${type} ${active ? "active" : ""}`}
    >
      <div className="ta-locationHead">
        <span className="ta-locationType">
          {isPickup ? "↑" : "↓"} {label}
        </span>
        {active && <span className="ta-currentTripTag">Current Trip</span>}
      </div>

      <div className="ta-locationStop">
        {location.stop || `${label} stop not added`}
      </div>

      <div className="ta-locationAddress">
        {location.address || `${label} address not added`}
      </div>

      {location.hasCoordinates && (
        <div className="ta-locationCoords">
          {location.latitude.toFixed(7)}, {location.longitude.toFixed(7)}
        </div>
      )}

      {location.mapsUrl && (
        <a
          className="ta-mapBtn"
          href={location.mapsUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          Open in Maps
        </a>
      )}
    </div>
  );
};

const TripPill = ({ value, active, onClick, disabled = false }) => (
  <button
    type="button"
    className={`ta-pill ${active ? "active" : ""}`}
    onClick={() => onClick(value)}
    disabled={disabled}
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
  const roles = useMemo(getStoredRoles, []);
  const isDriver = roles.includes("driver");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tripActionLoading, setTripActionLoading] = useState(false);

  const [buses, setBuses] = useState([]);
  const [busId, setBusId] = useState(null);
  const [tripType, setTripType] = useState("pickup");
  const [date, setDate] = useState(todayYYYYMMDD());

  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({});
  const [q, setQ] = useState("");

  const [activeTrip, setActiveTrip] = useState(null);
  const [gpsState, setGpsState] = useState({
    status: "idle",
    message: "Trip not started",
    lastSentAt: null,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
  });
  const [tripStats, setTripStats] = useState({
    checked: 0,
    notificationsSent: 0,
    noToken: 0,
    failed: 0,
  });

  const locationWatchRef = useRef(null);
  const lastLocationSentAtRef = useRef(0);
  const locationSendingRef = useRef(false);
  const activeTripIdRef = useRef(null);

  const filteredRows = useMemo(() => {
    const term = q.trim().toLowerCase();

    const base = rows.filter((row) => {
      if (!busId) return true;
      return Number(row.bus_id) === Number(busId);
    });

    if (!term) return base;

    return base.filter((row) => {
      const student = row.student || {};
      const name = String(student.name || "").toLowerCase();
      const admission = String(student.admission_number || "").toLowerCase();
      const className = String(
        student.Class?.class_name || student.class?.class_name || "",
      ).toLowerCase();
      const sectionName = String(
        student.Section?.section_name || student.section?.section_name || "",
      ).toLowerCase();
      const stop = String(row.stop || "").toLowerCase();
      const pickupStop = String(row.pickup_stop || "").toLowerCase();
      const pickupAddress = String(row.pickup_address || "").toLowerCase();
      const dropStop = String(row.drop_stop || "").toLowerCase();
      const dropAddress = String(row.drop_address || "").toLowerCase();

      return (
        name.includes(term) ||
        admission.includes(term) ||
        className.includes(term) ||
        sectionName.includes(term) ||
        stop.includes(term) ||
        pickupStop.includes(term) ||
        pickupAddress.includes(term) ||
        dropStop.includes(term) ||
        dropAddress.includes(term)
      );
    });
  }, [rows, q, busId]);

  const changedCount = useMemo(() => Object.keys(draft).length, [draft]);

  const getEffectiveStatus = useCallback(
    (row) => {
      const local = draft[row.student_id];
      if (local?.status) return local.status;
      if (row.attendance?.status) return row.attendance.status;
      return "present";
    },
    [draft],
  );

  const getEffectiveNotes = useCallback(
    (row) => {
      const local = draft[row.student_id];
      if (local?.notes !== undefined) return local.notes;
      return row.attendance?.notes || "";
    },
    [draft],
  );

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;

    filteredRows.forEach((row) => {
      const status = getEffectiveStatus(row);
      if (status === "present") present += 1;
      else if (status === "absent") absent += 1;
      else if (status === "leave") leave += 1;
    });

    return {
      total: filteredRows.length,
      present,
      absent,
      leave,
    };
  }, [filteredRows, getEffectiveStatus]);

  const busOptions = useMemo(() => {
    if (buses.length) return buses;

    const byId = new Map();
    rows.forEach((row) => {
      if (row.bus_id && !byId.has(row.bus_id)) {
        byId.set(row.bus_id, {
          id: row.bus_id,
          bus_name: `Bus #${row.bus_id}`,
        });
      }
    });
    return Array.from(byId.values());
  }, [buses, rows]);

  const getBusLabel = useCallback(
    (id) => {
      const bus = busOptions.find((item) => Number(item.id) === Number(id));
      if (!bus) return id ? `Bus #${id}` : "—";
      return (
        bus.bus_name ||
        bus.bus_no ||
        bus.name ||
        `Bus #${bus.id}`
      );
    },
    [busOptions],
  );

  const loadBuses = useCallback(async () => {
    try {
      const response = await api.get("/transport-attendance/my-buses");
      const list = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];
      setBuses(list);

      setBusId((current) => {
        if (current) return current;
        if (list.length === 1) return Number(list[0].id);
        return current;
      });
    } catch (error) {
      console.error("Load buses error:", error);
      Swal.fire("Error", "Failed to load assigned buses", "error");
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get("/transport-attendance/my-list", {
        params: { trip_type: tripType, date },
      });

      const list = Array.isArray(response?.data?.students)
        ? response.data.students
        : [];
      setRows(list);

      const busIds = [...new Set(list.map((item) => item.bus_id).filter(Boolean))];
      setBusId((current) => current || busIds[0] || null);
      setDraft({});
    } catch (error) {
      console.error("Load attendance list error:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to load student list",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [tripType, date]);

  const loadActiveTrip = useCallback(async () => {
    if (!isDriver) return;

    try {
      const response = await api.get("/bus-trips/my-active");
      const trip = response?.data?.trip || null;
      setActiveTrip(trip);
      activeTripIdRef.current = trip?.id || null;

      if (trip) {
        setBusId(Number(trip.bus_id));
        setTripType(trip.trip_type || "pickup");
        setGpsState((current) => ({
          ...current,
          status: trip.latest_location_at ? "active" : "starting",
          message: trip.latest_location_at
            ? "Trip restored. GPS tracking is active."
            : "Trip restored. Waiting for GPS location…",
          lastSentAt: trip.latest_location_at || current.lastSentAt,
          latitude: trip.latest_latitude ?? current.latitude,
          longitude: trip.latest_longitude ?? current.longitude,
          accuracyMeters:
            trip.latest_accuracy_meters ?? current.accuracyMeters,
        }));
      }
    } catch (error) {
      console.error("Load active trip error:", error);
    }
  }, [isDriver]);

  const clearLocationWatch = useCallback(() => {
    if (
      locationWatchRef.current !== null &&
      navigator.geolocation?.clearWatch
    ) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
    }
    locationWatchRef.current = null;
    locationSendingRef.current = false;
  }, []);

  const sendLocation = useCallback(async (tripId, position) => {
    if (!tripId || !position?.coords || locationSendingRef.current) return;

    const now = Date.now();
    if (
      lastLocationSentAtRef.current &&
      now - lastLocationSentAtRef.current < LOCATION_SEND_INTERVAL_MS
    ) {
      return;
    }

    const latitude = Number(position.coords.latitude);
    const longitude = Number(position.coords.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    locationSendingRef.current = true;
    setGpsState((current) => ({
      ...current,
      status: "sending",
      message: "Uploading live location…",
    }));

    try {
      const response = await api.post(`/bus-trips/${tripId}/location`, {
        latitude,
        longitude,
        accuracy_meters: Number.isFinite(position.coords.accuracy)
          ? Number(position.coords.accuracy)
          : null,
        speed_kmh: Number.isFinite(position.coords.speed)
          ? Number(position.coords.speed) * 3.6
          : null,
        heading: Number.isFinite(position.coords.heading)
          ? Number(position.coords.heading)
          : null,
        recorded_at: new Date(position.timestamp || Date.now()).toISOString(),
      });

      lastLocationSentAtRef.current = now;
      const geofence = response?.data?.geofence || {};

      setGpsState({
        status: "active",
        message: "Live location sent successfully",
        lastSentAt: new Date().toISOString(),
        latitude,
        longitude,
        accuracyMeters: Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null,
      });

      setTripStats((current) => ({
        checked: current.checked + Number(geofence.checked || 0),
        notificationsSent:
          current.notificationsSent + Number(geofence.notifications_sent || 0),
        noToken: current.noToken + Number(geofence.no_token || 0),
        failed: current.failed + Number(geofence.failed || 0),
      }));
    } catch (error) {
      console.error("Send location error:", error);
      const status = error?.response?.status;

      if (status === 404) {
        clearLocationWatch();
        setActiveTrip(null);
        activeTripIdRef.current = null;
        setGpsState({
          status: "error",
          message: "Active trip was not found. Please start the trip again.",
          lastSentAt: null,
          latitude: null,
          longitude: null,
          accuracyMeters: null,
        });
      } else {
        setGpsState((current) => ({
          ...current,
          status: "error",
          message:
            error?.response?.data?.error ||
            "Location upload failed. The app will retry automatically.",
        }));
      }
    } finally {
      locationSendingRef.current = false;
    }
  }, [clearLocationWatch]);

  const startLocationWatch = useCallback(
    (trip) => {
      clearLocationWatch();

      if (!trip?.id) return;
      if (!navigator.geolocation) {
        setGpsState({
          status: "error",
          message: "This device/browser does not support GPS location.",
          lastSentAt: null,
          latitude: null,
          longitude: null,
          accuracyMeters: null,
        });
        return;
      }

      setGpsState((current) => ({
        ...current,
        status: "starting",
        message: "Requesting GPS permission…",
      }));

      locationWatchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (Number(activeTripIdRef.current) !== Number(trip.id)) return;
          sendLocation(trip.id, position);
        },
        (error) => {
          const messages = {
            1: "Location permission denied. Allow location access to track the bus.",
            2: "GPS location is currently unavailable.",
            3: "GPS request timed out. Trying again…",
          };

          setGpsState((current) => ({
            ...current,
            status: "error",
            message: messages[error.code] || error.message || "GPS error",
          }));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        },
      );
    },
    [clearLocationWatch, sendLocation],
  );

  useEffect(() => {
    loadBuses();
    loadActiveTrip();
  }, [loadBuses, loadActiveTrip]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    activeTripIdRef.current = activeTrip?.id || null;

    if (isDriver && activeTrip?.id) {
      startLocationWatch(activeTrip);
    } else {
      clearLocationWatch();
    }

    return clearLocationWatch;
  }, [activeTrip?.id, isDriver, startLocationWatch, clearLocationWatch]);

  useEffect(() => {
    if (!isDriver || !activeTrip?.id) return undefined;

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && locationWatchRef.current === null) {
        startLocationWatch(activeTrip);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [activeTrip, isDriver, startLocationWatch]);

  const startTrip = async () => {
    if (!isDriver) return;
    if (!busId) {
      Swal.fire("Select Bus", "Please select your assigned bus first.", "warning");
      return;
    }

    const confirmation = await Swal.fire({
      title: `Start ${tripType === "pickup" ? "Pickup" : "Drop"} Trip?`,
      text: `${getBusLabel(busId)} will start sharing live GPS location.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Start Trip",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;

    setTripActionLoading(true);
    try {
      const response = await api.post("/bus-trips/start", {
        bus_id: Number(busId),
        trip_type: tripType,
      });

      const trip = response?.data?.trip || null;
      setActiveTrip(trip);
      activeTripIdRef.current = trip?.id || null;
      lastLocationSentAtRef.current = 0;
      setTripStats({ checked: 0, notificationsSent: 0, noToken: 0, failed: 0 });
      setGpsState({
        status: "starting",
        message: "Trip started. Waiting for the first GPS location…",
        lastSentAt: null,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
      });

      Swal.fire({
        icon: "success",
        title: "Trip Started",
        text: "Keep this page open and location permission enabled.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Start trip error:", error);
      Swal.fire(
        "Unable to Start",
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          "Failed to start the trip.",
        "error",
      );
    } finally {
      setTripActionLoading(false);
    }
  };

  const endTrip = async () => {
    if (!activeTrip?.id) return;

    const confirmation = await Swal.fire({
      title: "End Active Trip?",
      text: "Live GPS sharing will stop after the trip is ended.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "End Trip",
      confirmButtonColor: "#dc3545",
      cancelButtonText: "Keep Running",
    });
    if (!confirmation.isConfirmed) return;

    setTripActionLoading(true);
    try {
      await api.post(`/bus-trips/${activeTrip.id}/end`);
      clearLocationWatch();
      setActiveTrip(null);
      activeTripIdRef.current = null;
      setGpsState({
        status: "idle",
        message: "Trip ended. GPS sharing stopped.",
        lastSentAt: null,
        latitude: null,
        longitude: null,
        accuracyMeters: null,
      });

      Swal.fire({
        icon: "success",
        title: "Trip Ended",
        timer: 1300,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("End trip error:", error);
      Swal.fire(
        "Unable to End",
        error?.response?.data?.error || "Failed to end the trip.",
        "error",
      );
    } finally {
      setTripActionLoading(false);
    }
  };

  const setStatus = (studentId, status) => {
    setDraft((previous) => ({
      ...previous,
      [studentId]: { ...(previous[studentId] || {}), status },
    }));
  };

  const setNotes = (studentId, notes) => {
    setDraft((previous) => ({
      ...previous,
      [studentId]: { ...(previous[studentId] || {}), notes },
    }));
  };

  const openNotes = async (row) => {
    const student = row.student || {};
    const current = getEffectiveNotes(row) || "";
    const { value, isConfirmed } = await Swal.fire({
      title: "Notes",
      html: `<div style="font-size:12px; opacity:.85; margin-bottom:8px;">
              <b>${(student.name || "Student").replace(/</g, "&lt;")}</b>
              <span style="opacity:.7;"> • ${String(student.admission_number || "-").replace(/</g, "&lt;")}</span>
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
    setNotes(row.student_id, value || "");
  };

  const applyBulk = async (status) => {
    if (!filteredRows.length) return;

    const confirmation = await Swal.fire({
      title: "Apply to all?",
      text: `Set ${filteredRows.length} students to ${status.toUpperCase()}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;

    setDraft((previous) => {
      const next = { ...previous };
      filteredRows.forEach((row) => {
        next[row.student_id] = {
          ...(next[row.student_id] || {}),
          status,
        };
      });
      return next;
    });
  };

  const clearLocalChanges = async () => {
    if (!Object.keys(draft).length) return;

    const confirmation = await Swal.fire({
      title: "Clear changes?",
      text: "This will remove unsaved changes on this screen.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Clear",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;
    setDraft({});
  };

  const save = async () => {
    if (!rows.length) return;

    const confirmation = await Swal.fire({
      title: "Save Attendance?",
      text: `Trip: ${tripType.toUpperCase()} | Date: ${date} | Students: ${filteredRows.length}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
    });
    if (!confirmation.isConfirmed) return;

    setSaving(true);
    try {
      const response = await api.post("/transport-attendance/mark-bulk", {
        date,
        trip_type: tripType,
        records: filteredRows.map((row) => ({
          student_id: row.student_id,
          status: getEffectiveStatus(row),
          notes: (getEffectiveNotes(row) || "").trim(),
        })),
      });

      const rejected = response?.data?.rejected || [];
      const marked = response?.data?.marked ?? 0;

      if (rejected.length) {
        Swal.fire(
          "Saved (some rejected)",
          `Saved: ${marked}\nRejected: ${rejected.length}`,
          "warning",
        );
      } else {
        Swal.fire("Saved", `Attendance saved successfully (${marked})`, "success");
      }

      await loadList();
    } catch (error) {
      console.error("Save attendance error:", error);
      Swal.fire(
        "Error",
        error?.response?.data?.message || "Failed to save attendance",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const reloadPageData = () => {
    loadList();
    if (isDriver) loadActiveTrip();
  };

  return (
    <div className="ta-page compact">
      <div className="ta-header sticky">
        <div className="ta-headRow">
          <div className="ta-title">Transport Attendance</div>
          <button
            type="button"
            className="ta-iconBtn"
            onClick={reloadPageData}
            disabled={loading || saving || tripActionLoading}
            title="Reload"
          >
            ↻
          </button>
        </div>

        {isDriver && (
          <div className={`ta-tripTracker ${activeTrip ? "active" : "idle"}`}>
            <div className="ta-tripTrackerTop">
              <div>
                <div className="ta-tripTrackerLabel">Driver Live Tracking</div>
                <div className="ta-tripTrackerTitle">
                  {activeTrip
                    ? `${getBusLabel(activeTrip.bus_id)} · ${String(activeTrip.trip_type || "").toUpperCase()}`
                    : "Start the trip before moving the bus"}
                </div>
              </div>
              <span className={`ta-gpsBadge ${gpsState.status}`}>
                {activeTrip ? "TRIP ACTIVE" : "NOT STARTED"}
              </span>
            </div>

            <div className="ta-gpsMessage">
              <span className={`ta-gpsDot ${gpsState.status}`} />
              <span>{gpsState.message}</span>
            </div>

            {activeTrip && (
              <div className="ta-gpsGrid">
                <div>
                  <span>Last GPS</span>
                  <b>{formatTime(gpsState.lastSentAt)}</b>
                </div>
                <div>
                  <span>Accuracy</span>
                  <b>{gpsState.accuracyMeters != null ? `${gpsState.accuracyMeters} m` : "—"}</b>
                </div>
                <div>
                  <span>Stops Checked</span>
                  <b>{tripStats.checked}</b>
                </div>
                <div>
                  <span>Notifications</span>
                  <b>{tripStats.notificationsSent}</b>
                </div>
              </div>
            )}

            <div className="ta-tripActions">
              {!activeTrip ? (
                <button
                  type="button"
                  className="ta-startTrip"
                  onClick={startTrip}
                  disabled={tripActionLoading || !busId}
                >
                  {tripActionLoading ? "Starting…" : "Start Trip & GPS"}
                </button>
              ) : (
                <button
                  type="button"
                  className="ta-endTrip"
                  onClick={endTrip}
                  disabled={tripActionLoading}
                >
                  {tripActionLoading ? "Ending…" : "End Trip"}
                </button>
              )}
            </div>

            <div className="ta-trackingHint">
              Keep this page open and allow precise location. Browser tracking may
              pause when the screen is locked.
            </div>
          </div>
        )}

        <div className="ta-controls compact">
          <div className="ta-trip">
            <TripPill
              value="pickup"
              active={tripType === "pickup"}
              onClick={setTripType}
              disabled={Boolean(activeTrip)}
            />
            <TripPill
              value="drop"
              active={tripType === "drop"}
              onClick={setTripType}
              disabled={Boolean(activeTrip)}
            />
          </div>

          <div className="ta-grid2">
            <label className="ta-label">
              Date
              <input
                type="date"
                className="ta-input"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

            <label className="ta-label">
              Bus
              <select
                className="ta-input"
                value={busId ?? ""}
                disabled={Boolean(activeTrip)}
                onChange={(event) =>
                  setBusId(event.target.value ? Number(event.target.value) : null)
                }
              >
                <option value="">Select Bus</option>
                {busOptions.map((bus) => (
                  <option key={bus.id} value={bus.id}>
                    {bus.bus_name || bus.bus_no || bus.name || `Bus #${bus.id}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ta-row tight">
            <input
              className="ta-search"
              placeholder="Search name / adm / stop / address…"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>

          <div className="ta-statsRow">
            <StatCard label="Total" value={counts.total} />
            <StatCard label="Present" value={counts.present} tone="present" />
            <StatCard label="Absent" value={counts.absent} tone="absent" />
            <StatCard label="Leave" value={counts.leave} tone="leave" />
          </div>

          <div className="ta-bulkRow">
            <button
              type="button"
              className="ta-miniBtn"
              onClick={() => applyBulk("present")}
              disabled={!counts.total || loading || saving}
            >
              P all
            </button>
            <button
              type="button"
              className="ta-miniBtn"
              onClick={() => applyBulk("absent")}
              disabled={!counts.total || loading || saving}
            >
              A all
            </button>
            <button
              type="button"
              className="ta-miniBtn"
              onClick={() => applyBulk("leave")}
              disabled={!counts.total || loading || saving}
            >
              L all
            </button>
            <button
              type="button"
              className="ta-miniBtn ghost"
              onClick={clearLocalChanges}
              disabled={!changedCount || loading || saving}
            >
              Clear
            </button>

            <div className="ta-changesPill" title="Unsaved changes">
              Changes: <b>{changedCount}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="ta-body compact">
        {loading ? (
          <div className="ta-empty">Loading…</div>
        ) : !rows.length ? (
          <div className="ta-empty">
            No students found.
            <div className="ta-hint">
              Check assignments and active dates for pickup/drop buses.
            </div>
          </div>
        ) : (
          <div className="ta-list compact">
            {filteredRows.map((row) => {
              const student = row.student || {};
              const status = getEffectiveStatus(row);
              const notes = getEffectiveNotes(row);
              const className =
                student.Class?.class_name || student.class?.class_name || "";
              const sectionName =
                student.Section?.section_name ||
                student.section?.section_name ||
                "";
              const line2Left = `${student.admission_number || "-"} • ${className}${sectionName ? `-${sectionName}` : ""}`;
              const line2Right = String(row.stop || "").trim();
              const pickupLocation = getStudentLocation(row, "pickup");
              const dropLocation = getStudentLocation(row, "drop");

              return (
                <div key={row.student_id} className={`ta-rowItem ${status}`}>
                  <div className="ta-rowMain">
                    <div className="ta-left">
                      <div className="ta-rowName" title={student.name || ""}>
                        {student.name || "Student"}
                      </div>
                      <div className="ta-rowMeta">
                        <span className="ta-muted">{line2Left}</span>
                        {line2Right ? <span className="ta-dot">•</span> : null}
                        {line2Right ? (
                          <span className="ta-stop" title={row.stop || ""}>
                            {line2Right}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="ta-right">
                      <div className="ta-segWrap" aria-label="Status">
                        <StatusSeg
                          value="present"
                          active={status === "present"}
                          onClick={() => setStatus(row.student_id, "present")}
                        />
                        <StatusSeg
                          value="absent"
                          active={status === "absent"}
                          onClick={() => setStatus(row.student_id, "absent")}
                        />
                        <StatusSeg
                          value="leave"
                          active={status === "leave"}
                          onClick={() => setStatus(row.student_id, "leave")}
                        />
                      </div>

                      <button
                        type="button"
                        className={`ta-noteBtn ${notes ? "has" : ""}`}
                        onClick={() => openNotes(row)}
                        title={notes ? "Edit notes" : "Add notes"}
                      >
                        ✎
                      </button>
                    </div>
                  </div>

                  <div className="ta-locationGrid">
                    <StudentLocationCard
                      type="pickup"
                      location={pickupLocation}
                      active={tripType === "pickup"}
                    />
                    <StudentLocationCard
                      type="drop"
                      location={dropLocation}
                      active={tripType === "drop"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="ta-footer sticky">
        <div className="ta-footerInfo">
          <div className="ta-footerLine">
            <b>{tripType.toUpperCase()}</b> • {date}{" "}
            {busId ? `• ${getBusLabel(busId)}` : ""}
          </div>
          <div className="ta-footerLine">
            {counts.total ? (
              <>
                P:<b>{counts.present}</b> A:<b>{counts.absent}</b> L:
                <b>{counts.leave}</b>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>

        <button
          type="button"
          className="ta-save"
          onClick={save}
          disabled={saving || loading || !rows.length}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}