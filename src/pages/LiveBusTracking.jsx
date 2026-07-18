// src/pages/LiveBusTracking.jsx
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
import {
  onBusLocationUpdated,
  onBusTripEnded,
  onBusTripStarted,
  refreshSocketAuth,
} from "../socket";
import "./LiveBusTracking.css";

const GOOGLE_MAPS_API_KEY = String(
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "",
).trim();
const GOOGLE_MAP_ID = String(process.env.REACT_APP_GOOGLE_MAP_ID || "").trim();
const DEFAULT_CENTER = { lat: 30.7333, lng: 76.7794 };
const POLL_INTERVAL_MS = 15000;

let googleMapsPromise = null;

const loadGoogleMaps = () => {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error(
        "Google Maps API key is missing. Add REACT_APP_GOOGLE_MAPS_API_KEY in the frontend .env file.",
      ),
    );
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps loaded but the Maps library is unavailable."));
    };

    const existing = Array.from(document.scripts).find((script) =>
      String(script.src || "").includes("maps.googleapis.com/maps/api/js"),
    );

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps.")),
        { once: true },
      );
      return;
    }

    const callbackName = `__liveBusMapReady_${Date.now()}`;
    window[callbackName] = () => {
      try {
        finish();
      } finally {
        delete window[callbackName];
      }
    };

    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      callback: callbackName,
      loading: "async",
      v: "weekly",
      region: "IN",
      language: "en",
    });

    if (GOOGLE_MAP_ID) params.set("map_ids", GOOGLE_MAP_ID);

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error("Failed to load Google Maps. Check API restrictions."));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
};

const safeText = (value, fallback = "—") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return date.toLocaleString("en-IN");
};

const formatAge = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return "—";
  if (value < 60) return `${Math.max(0, Math.round(value))} sec ago`;
  if (value < 3600) return `${Math.round(value / 60)} min ago`;
  return `${Math.round(value / 3600)} hr ago`;
};

const STATUS_META = {
  live: { label: "Live", tone: "success", color: "#198754" },
  stale: { label: "Location Stale", tone: "warning", color: "#f59e0b" },
  waiting_for_location: {
    label: "Waiting for GPS",
    tone: "primary",
    color: "#0d6efd",
  },
  trip_not_started: {
    label: "Trip Not Started",
    tone: "secondary",
    color: "#6c757d",
  },
};

const getStatusMeta = (status) =>
  STATUS_META[status] || STATUS_META.trip_not_started;

const makeMarkerIcon = (color, selected = false) => {
  const size = selected ? 44 : 38;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.28"/>
      </filter>
      <circle cx="24" cy="22" r="18" fill="${color}" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
      <path d="M15 17h18l3 7v9h-3a4 4 0 0 1-8 0h-2a4 4 0 0 1-8 0h-3v-9l3-7zm3 2-2 5h16l-2-5H18zm0 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" fill="#ffffff"/>
      <path d="M24 47l-7-9h14l-7 9z" fill="${color}"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: window.google
      ? new window.google.maps.Size(size, size)
      : undefined,
    anchor: window.google
      ? new window.google.maps.Point(size / 2, size)
      : undefined,
  };
};

const normalizeLiveRow = (row) => ({
  ...row,
  bus: row?.bus || {},
  driver: row?.driver || null,
  assigned_students: row?.assigned_students || { pickup: 0, drop: 0 },
  tracking_status: row?.tracking_status || "trip_not_started",
  trip: row?.trip || null,
  location: row?.location
    ? {
        ...row.location,
        latitude: toNumber(row.location.latitude),
        longitude: toNumber(row.location.longitude),
      }
    : null,
});

export default function LiveBusTracking() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const trailPolylineRef = useRef(null);
  const hasFittedRef = useRef(false);

  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [trail, setTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trailLoading, setTrailLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLiveBuses = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const response = await api.get("/bus-trips/live");
      const list = Array.isArray(response?.data?.buses)
        ? response.data.buses.map(normalizeLiveRow)
        : [];

      setBuses(list);
      setLastUpdated(new Date(response?.data?.generated_at || Date.now()));
      setError("");

      setSelectedBusId((current) => {
        if (current && list.some((item) => Number(item.bus?.id) === Number(current))) {
          return current;
        }

        const firstLive = list.find((item) => item.tracking_status === "live");
        return firstLive?.bus?.id || list[0]?.bus?.id || null;
      });
    } catch (requestError) {
      console.error("Live bus fetch error:", requestError);
      setError(
        requestError?.response?.data?.error ||
          requestError?.response?.data?.message ||
          "Failed to load live bus locations.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveBuses();
  }, [fetchLiveBuses]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchLiveBuses({ silent: true });
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [autoRefresh, fetchLiveBuses]);

  useEffect(() => {
    refreshSocketAuth();

    const offStarted = onBusTripStarted(() => {
      fetchLiveBuses({ silent: true });
    });

    const offEnded = onBusTripEnded(() => {
      fetchLiveBuses({ silent: true });
    });

    const offLocation = onBusLocationUpdated((payload) => {
      const busId = Number(payload?.busId);
      if (!busId) return;

      setBuses((current) =>
        current.map((item) => {
          if (Number(item.bus?.id) !== busId) return item;

          return normalizeLiveRow({
            ...item,
            tracking_status: "live",
            trip: item.trip || {
              id: payload.tripId,
              trip_type: payload.tripType,
              status: "started",
            },
            location: {
              latitude: payload.latitude,
              longitude: payload.longitude,
              accuracy_meters: payload.accuracyMeters,
              recorded_at: payload.recordedAt,
              age_seconds: 0,
              is_fresh: true,
            },
          });
        }),
      );
      setLastUpdated(new Date());
    });

    return () => {
      offStarted();
      offEnded();
      offLocation();
    };
  }, [fetchLiveBuses]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapContainerRef.current) return;

        const options = {
          center: DEFAULT_CENTER,
          zoom: 12,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          clickableIcons: false,
        };

        if (GOOGLE_MAP_ID) options.mapId = GOOGLE_MAP_ID;

        mapRef.current = new window.google.maps.Map(
          mapContainerRef.current,
          options,
        );
        setMapReady(true);
        setMapError("");
      } catch (initializationError) {
        console.error("Live map initialization error:", initializationError);
        setMapError(initializationError?.message || "Could not load Google Maps.");
      }
    };

    initialize();

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
      trailPolylineRef.current?.setMap(null);
      trailPolylineRef.current = null;
      mapRef.current = null;
    };
  }, []);

  const filteredBuses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return buses.filter((item) => {
      const statusMatches =
        statusFilter === "all" || item.tracking_status === statusFilter;

      if (!statusMatches) return false;
      if (!query) return true;

      const haystack = [
        item.bus?.bus_no,
        item.bus?.reg_no,
        item.driver?.name,
        item.driver?.username,
        item.driver?.phone,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [buses, search, statusFilter]);

  const selectedBus = useMemo(
    () =>
      buses.find((item) => Number(item.bus?.id) === Number(selectedBusId)) ||
      null,
    [buses, selectedBusId],
  );

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;

    const visibleIds = new Set();
    const bounds = new window.google.maps.LatLngBounds();
    let markerCount = 0;

    filteredBuses.forEach((item) => {
      const busId = Number(item.bus?.id);
      const latitude = toNumber(item.location?.latitude);
      const longitude = toNumber(item.location?.longitude);
      if (!busId || latitude === null || longitude === null) return;

      visibleIds.add(busId);
      markerCount += 1;

      const position = { lat: latitude, lng: longitude };
      const meta = getStatusMeta(item.tracking_status);
      const selected = Number(selectedBusId) === busId;
      let marker = markersRef.current.get(busId);

      if (!marker) {
        marker = new window.google.maps.Marker({
          map: mapRef.current,
          position,
          title: `${safeText(item.bus?.bus_no, `Bus ${busId}`)} - ${safeText(item.driver?.name, "Driver")}`,
          icon: makeMarkerIcon(meta.color, selected),
          zIndex: selected ? 1000 : 100,
        });
        marker.addListener("click", () => setSelectedBusId(busId));
        markersRef.current.set(busId, marker);
      } else {
        marker.setMap(mapRef.current);
        marker.setPosition(position);
        marker.setTitle(
          `${safeText(item.bus?.bus_no, `Bus ${busId}`)} - ${safeText(item.driver?.name, "Driver")}`,
        );
        marker.setIcon(makeMarkerIcon(meta.color, selected));
        marker.setZIndex(selected ? 1000 : 100);
      }

      bounds.extend(position);
    });

    markersRef.current.forEach((marker, busId) => {
      if (!visibleIds.has(busId)) marker.setMap(null);
    });

    if (markerCount > 0 && !hasFittedRef.current) {
      mapRef.current.fitBounds(bounds, 70);
      hasFittedRef.current = true;
    }
  }, [filteredBuses, mapReady, selectedBusId]);

  const loadTripTrail = useCallback(async (tripId) => {
    if (!tripId) {
      setTrail([]);
      return;
    }

    setTrailLoading(true);
    try {
      const response = await api.get(`/bus-trips/${tripId}/locations`, {
        params: { limit: 300 },
      });
      setTrail(Array.isArray(response?.data?.locations) ? response.data.locations : []);
    } catch (trailError) {
      console.error("Trip trail error:", trailError);
      setTrail([]);
    } finally {
      setTrailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTripTrail(selectedBus?.trip?.id);
  }, [selectedBus?.trip?.id, loadTripTrail]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps) return;

    trailPolylineRef.current?.setMap(null);
    trailPolylineRef.current = null;

    const path = trail
      .map((point) => ({
        lat: toNumber(point.latitude),
        lng: toNumber(point.longitude),
      }))
      .filter((point) => point.lat !== null && point.lng !== null);

    if (path.length < 2) return;

    trailPolylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#0d6efd",
      strokeOpacity: 0.85,
      strokeWeight: 5,
      map: mapRef.current,
    });
  }, [trail, mapReady]);

  const focusBus = (item) => {
    const busId = Number(item.bus?.id);
    setSelectedBusId(busId || null);

    const latitude = toNumber(item.location?.latitude);
    const longitude = toNumber(item.location?.longitude);
    if (mapRef.current && latitude !== null && longitude !== null) {
      mapRef.current.panTo({ lat: latitude, lng: longitude });
      mapRef.current.setZoom(16);
    }
  };

  const stats = useMemo(() => {
    const result = {
      total: buses.length,
      live: 0,
      stale: 0,
      waiting: 0,
      notStarted: 0,
    };

    buses.forEach((item) => {
      if (item.tracking_status === "live") result.live += 1;
      else if (item.tracking_status === "stale") result.stale += 1;
      else if (item.tracking_status === "waiting_for_location") result.waiting += 1;
      else result.notStarted += 1;
    });

    return result;
  }, [buses]);

  const copyCoordinates = async () => {
    const latitude = selectedBus?.location?.latitude;
    const longitude = selectedBus?.location?.longitude;
    if (latitude == null || longitude == null) return;

    try {
      await navigator.clipboard.writeText(`${latitude}, ${longitude}`);
      Swal.fire({
        icon: "success",
        title: "Copied",
        text: "Bus coordinates copied.",
        timer: 1000,
        showConfirmButton: false,
      });
    } catch {
      Swal.fire("Coordinates", `${latitude}, ${longitude}`, "info");
    }
  };

  return (
    <div className="lbt-page">
      <div className="lbt-header">
        <div>
          <h2>Live Bus Tracking</h2>
          <p>
            View every bus assigned to a driver, its active trip, and the latest
            GPS location.
          </p>
        </div>

        <div className="lbt-header-actions">
          <label className="lbt-auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
            />
            Auto refresh
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fetchLiveBuses()}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1" />
            Refresh
          </button>
        </div>
      </div>

      <div className="lbt-stats">
        <div className="lbt-stat"><span>Total Assigned</span><b>{stats.total}</b></div>
        <div className="lbt-stat live"><span>Live</span><b>{stats.live}</b></div>
        <div className="lbt-stat stale"><span>Stale</span><b>{stats.stale}</b></div>
        <div className="lbt-stat waiting"><span>Waiting GPS</span><b>{stats.waiting}</b></div>
        <div className="lbt-stat idle"><span>Not Started</span><b>{stats.notStarted}</b></div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="lbt-layout">
        <aside className="lbt-sidebar-panel">
          <div className="lbt-filters">
            <input
              type="search"
              className="form-control"
              placeholder="Search bus, driver or phone…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="form-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All tracking statuses</option>
              <option value="live">Live</option>
              <option value="stale">Location stale</option>
              <option value="waiting_for_location">Waiting for GPS</option>
              <option value="trip_not_started">Trip not started</option>
            </select>
          </div>

          <div className="lbt-list-meta">
            <span>{filteredBuses.length} buses</span>
            <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-IN")}` : "—"}</span>
          </div>

          <div className="lbt-bus-list">
            {loading && !buses.length ? (
              <div className="lbt-empty">Loading assigned buses…</div>
            ) : filteredBuses.length ? (
              filteredBuses.map((item) => {
                const busId = Number(item.bus?.id);
                const selected = Number(selectedBusId) === busId;
                const meta = getStatusMeta(item.tracking_status);

                return (
                  <button
                    type="button"
                    key={busId}
                    className={`lbt-bus-card ${selected ? "selected" : ""}`}
                    onClick={() => focusBus(item)}
                  >
                    <div className="lbt-bus-card-top">
                      <div>
                        <strong>{safeText(item.bus?.bus_no, `Bus ${busId}`)}</strong>
                        <small>{safeText(item.bus?.reg_no)}</small>
                      </div>
                      <span className={`badge text-bg-${meta.tone}`}>{meta.label}</span>
                    </div>
                    <div className="lbt-driver-line">
                      <i className="bi bi-person-badge" />
                      <span>{safeText(item.driver?.name, "Driver not available")}</span>
                    </div>
                    <div className="lbt-card-bottom">
                      <span>
                        {item.trip
                          ? `${safeText(item.trip.trip_type).toUpperCase()} trip`
                          : "No active trip"}
                      </span>
                      <span>{formatAge(item.location?.age_seconds)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="lbt-empty">No buses match the selected filters.</div>
            )}
          </div>
        </aside>

        <main className="lbt-map-panel">
          <div className="lbt-map" ref={mapContainerRef} />

          {mapError && (
            <div className="lbt-map-message error">
              <strong>Map unavailable</strong>
              <span>{mapError}</span>
            </div>
          )}

          {!mapReady && !mapError && (
            <div className="lbt-map-message">
              <span className="spinner-border spinner-border-sm" />
              <span>Loading map…</span>
            </div>
          )}

          <div className="lbt-legend">
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <span key={key}>
                <i style={{ background: meta.color }} />
                {meta.label}
              </span>
            ))}
          </div>
        </main>

        <aside className="lbt-detail-panel">
          {selectedBus ? (
            <>
              <div className="lbt-detail-title">
                <div>
                  <span>Selected Bus</span>
                  <h3>{safeText(selectedBus.bus?.bus_no, `Bus ${selectedBus.bus?.id}`)}</h3>
                  <p>{safeText(selectedBus.bus?.reg_no)}</p>
                </div>
                <span className={`badge text-bg-${getStatusMeta(selectedBus.tracking_status).tone}`}>
                  {getStatusMeta(selectedBus.tracking_status).label}
                </span>
              </div>

              <div className="lbt-detail-section">
                <h4>Driver</h4>
                <dl>
                  <div><dt>Name</dt><dd>{safeText(selectedBus.driver?.name)}</dd></div>
                  <div><dt>Phone</dt><dd>{safeText(selectedBus.driver?.phone)}</dd></div>
                  <div><dt>Licence</dt><dd>{safeText(selectedBus.driver?.license_no)}</dd></div>
                </dl>
              </div>

              <div className="lbt-detail-section">
                <h4>Active Trip</h4>
                <dl>
                  <div><dt>Type</dt><dd>{safeText(selectedBus.trip?.trip_type).toUpperCase()}</dd></div>
                  <div><dt>Started</dt><dd>{formatDateTime(selectedBus.trip?.started_at)}</dd></div>
                  <div><dt>Pickup Students</dt><dd>{selectedBus.assigned_students?.pickup || 0}</dd></div>
                  <div><dt>Drop Students</dt><dd>{selectedBus.assigned_students?.drop || 0}</dd></div>
                </dl>
              </div>

              <div className="lbt-detail-section">
                <h4>Latest GPS</h4>
                <dl>
                  <div><dt>Updated</dt><dd>{formatDateTime(selectedBus.location?.recorded_at)}</dd></div>
                  <div><dt>Age</dt><dd>{formatAge(selectedBus.location?.age_seconds)}</dd></div>
                  <div><dt>Accuracy</dt><dd>{selectedBus.location?.accuracy_meters != null ? `${Math.round(selectedBus.location.accuracy_meters)} m` : "—"}</dd></div>
                  <div><dt>Trail Points</dt><dd>{trailLoading ? "Loading…" : trail.length}</dd></div>
                </dl>

                {selectedBus.location ? (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm w-100"
                    onClick={copyCoordinates}
                  >
                    Copy coordinates
                  </button>
                ) : (
                  <div className="lbt-no-location">Driver has not sent a GPS location yet.</div>
                )}
              </div>
            </>
          ) : (
            <div className="lbt-empty">Select a bus to view driver and trip details.</div>
          )}
        </aside>
      </div>
    </div>
  );
}