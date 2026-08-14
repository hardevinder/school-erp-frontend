import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import "./BusRouteMapModal.css";

const API_KEY = String(process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "").trim();
let mapsPromise;

const loadMaps = () => {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;
  if (!API_KEY) return Promise.reject(new Error("REACT_APP_GOOGLE_MAPS_API_KEY is not configured."));
  mapsPromise = new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((item) => String(item.src).includes("maps.googleapis.com/maps/api/js"));
    const done = () => window.google?.maps ? resolve(window.google) : reject(new Error("Google Maps could not be loaded."));
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps could not be loaded.")), { once: true });
      return;
    }
    const callback = `__busRouteMap_${Date.now()}`;
    window[callback] = () => { delete window[callback]; done(); };
    const query = new URLSearchParams({ key: API_KEY, callback, loading: "async", v: "weekly", region: "IN" });
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${query}`;
    script.onerror = () => reject(new Error("Google Maps could not be loaded. Check the API key restrictions."));
    document.head.appendChild(script);
  });
  return mapsPromise;
};

const today = () => new Date().toLocaleDateString("en-CA");
const point = (item) => ({ lat: Number(item.latitude), lng: Number(item.longitude) });
const distance = (a, b) => {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const uniqueStops = (stops) => {
  const grouped = new Map();
  stops.forEach((stop) => {
    const key = `${Number(stop.latitude).toFixed(6)},${Number(stop.longitude).toFixed(6)}`;
    if (!grouped.has(key)) grouped.set(key, { ...stop, passengers: 0, passengerTypes: new Set(), personIds: [] });
    const item = grouped.get(key);
    item.passengers += 1;
    item.passengerTypes.add(stop.person_type);
    item.personIds.push(stop.person_id);
  });
  return [...grouped.values()].map((stop) => ({
    ...stop,
    passengerTypes: [...stop.passengerTypes],
  }));
};

const mapOptions = (google, center) => ({
  center,
  zoom: 12,
  streetViewControl: false,
  fullscreenControl: true,
  mapTypeControl: true,
  mapTypeControlOptions: {
    style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
    position: google.maps.ControlPosition.TOP_LEFT,
    mapTypeIds: [google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.SATELLITE],
  },
});

const stopInfoContent = (stop, index) => {
  const root = document.createElement("div");
  root.className = "bus-stop-info";
  const heading = document.createElement("strong");
  heading.textContent = `${index + 1}. ${stop.stop || "Assigned stop"}`;
  root.appendChild(heading);
  const rows = [
    ["Address", stop.address || "Not provided"],
    ["Route", stop.route?.route_name || "Not assigned"],
    ["Passengers", `${stop.passengers} (${stop.passengerTypes.join(" / ")})`],
    ["Coordinates", `${Number(stop.latitude).toFixed(7)}, ${Number(stop.longitude).toFixed(7)}`],
  ];
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const labelNode = document.createElement("span");
    labelNode.textContent = `${label}: `;
    const valueNode = document.createElement("span");
    valueNode.textContent = value;
    row.append(labelNode, valueNode);
    root.appendChild(row);
  });
  return root;
};

const addStopMarkers = (google, map, ordered, overlayList) => {
  const infoWindow = new google.maps.InfoWindow();
  ordered.forEach((stop, index) => {
    const marker = new google.maps.Marker({
      map,
      position: point(stop),
      label: String(index + 1),
      title: `${stop.stop || stop.address || "Assigned stop"} (${stop.passengers} passenger${stop.passengers === 1 ? "" : "s"})`,
    });
    marker.addListener("click", () => {
      infoWindow.setContent(stopInfoContent(stop, index));
      infoWindow.open({ map, anchor: marker });
    });
    overlayList.push(marker);
  });
  overlayList.push({ setMap: (value) => { if (!value) infoWindow.close(); } });
};

const addSchoolMarker = (google, map, school, overlayList) => {
  const marker = new google.maps.Marker({
    map,
    position: point(school),
    title: school.name || "School",
    label: "S",
  });
  const infoWindow = new google.maps.InfoWindow();
  marker.addListener("click", () => {
    const root = document.createElement("div");
    root.className = "bus-stop-info";
    const heading = document.createElement("strong");
    heading.textContent = school.name || "School";
    const address = document.createElement("div");
    address.textContent = school.address_line || "School route origin/destination";
    const coordinates = document.createElement("div");
    coordinates.textContent = `${Number(school.latitude).toFixed(7)}, ${Number(school.longitude).toFixed(7)}`;
    root.append(heading, address, coordinates);
    infoWindow.setContent(root);
    infoWindow.open({ map, anchor: marker });
  });
  overlayList.push(marker, { setMap: (value) => { if (!value) infoWindow.close(); } });
};

// Build a stable, sensible sequence even though assignments do not currently
// store stop order: nearest-neighbour from school, reversed for pickup.
const orderStops = (stops, school, tripType) => {
  const remaining = [...uniqueStops(stops)];
  const ordered = [];
  let cursor = point(school);
  while (remaining.length) {
    let best = 0;
    for (let i = 1; i < remaining.length; i += 1) {
      if (distance(cursor, point(remaining[i])) < distance(cursor, point(remaining[best]))) best = i;
    }
    const [next] = remaining.splice(best, 1);
    ordered.push(next);
    cursor = point(next);
  }
  return tripType === "pickup" ? ordered.reverse() : ordered;
};

export default function BusRouteMapModal({ bus, onClose }) {
  const mapNode = useRef(null);
  const overlays = useRef([]);
  const [date, setDate] = useState(today());
  const [tripType, setTripType] = useState("pickup");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState("");
  const [kilometres, setKilometres] = useState(null);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/buses/${bus.id}/route-plan`, { params: { date } });
      setPlan(response.data);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to load assigned stops.");
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [bus.id, date]);

  useEffect(() => { loadPlan(); }, [loadPlan]);
  useEffect(() => () => overlays.current.forEach((item) => item.setMap?.(null)), []);

  const stops = useMemo(() => plan?.[tripType]?.stops || [], [plan, tripType]);

  useEffect(() => {
    if (!plan || loading || !mapNode.current) return;
    let cancelled = false;
    const draw = async () => {
      setMapLoading(true);
      setError("");
      setKilometres(null);
      overlays.current.forEach((item) => item.setMap?.(null));
      overlays.current = [];
      try {
        const google = await loadMaps();
        if (cancelled) return;
        if (!plan.school) throw new Error("Add the school's latitude and longitude in School Settings first.");
        if (!stops.length) throw new Error(`No ${tripType} assignments with map coordinates exist for this bus.`);

        const schoolPoint = point(plan.school);
        const ordered = orderStops(stops, plan.school, tripType);
        const locations = tripType === "pickup"
          ? [...ordered.map(point), schoolPoint]
          : [schoolPoint, ...ordered.map(point)];
        const map = new google.maps.Map(mapNode.current, mapOptions(google, schoolPoint));
        const { Route } = await google.maps.importLibrary("routes");
        const bounds = new google.maps.LatLngBounds();
        locations.forEach((location) => bounds.extend(location));
        map.fitBounds(bounds, 48);

        let metres = 0;
        // Google Directions accepts a limited number of waypoints. Contiguous
        // chunks keep every assigned stop and produce one continuous road route.
        for (let start = 0; start < locations.length - 1; start += 24) {
          const segment = locations.slice(start, Math.min(start + 25, locations.length));
          if (segment.length < 2) break;
          const result = await Route.computeRoutes({
            origin: segment[0],
            destination: segment[segment.length - 1],
            intermediates: segment.slice(1, -1).map((location) => ({ location })),
            travelMode: "DRIVING",
            fields: ["path", "distanceMeters"],
          });
          if (cancelled) return;
          const route = result.routes?.[0];
          if (!route) throw new Error("Google Routes returned no road route for these stops.");
          metres += Number(route.distanceMeters || 0);
          const polylines = route.createPolylines();
          polylines.forEach((polyline) => {
            polyline.setOptions({
              strokeColor: tripType === "pickup" ? "#0d6efd" : "#dc3545",
              strokeOpacity: 0.9,
              strokeWeight: 6,
            });
            polyline.setMap(map);
            overlays.current.push(polyline);
          });
        }

        addSchoolMarker(google, map, plan.school, overlays.current);
        addStopMarkers(google, map, ordered, overlays.current);
        setKilometres(metres / 1000);
      } catch (drawError) {
        if (!cancelled) {
          const message = String(drawError?.message || drawError || "");
          const denied = /denied|permission|api key|forbidden|403/i.test(message);
          setError(denied
            ? "Road routing is not enabled for this Google key. Enable ‘Routes API’ in the same Google Cloud project and confirm billing plus localhost:3000 referrer access."
            : message || "Unable to draw route.");

          // The base map remains useful while cloud routing is being enabled:
          // show every assignment and an explicitly-labelled straight-line estimate.
          try {
            const google = window.google;
            if (google?.maps && plan.school && stops.length && mapNode.current) {
              const schoolPoint = point(plan.school);
              const ordered = orderStops(stops, plan.school, tripType);
              const path = tripType === "pickup"
                ? [...ordered.map(point), schoolPoint]
                : [schoolPoint, ...ordered.map(point)];
              const fallbackMap = new google.maps.Map(mapNode.current, mapOptions(google, schoolPoint));
              const fallbackBounds = new google.maps.LatLngBounds();
              path.forEach((location) => fallbackBounds.extend(location));
              fallbackMap.fitBounds(fallbackBounds, 48);
              const line = new google.maps.Polyline({
                map: fallbackMap, path,
                strokeColor: tripType === "pickup" ? "#0d6efd" : "#dc3545",
                strokeOpacity: .65, strokeWeight: 4,
                icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }],
              });
              overlays.current.push(line);
              const estimate = path.slice(1).reduce((total, location, index) => total + distance(path[index], location), 0);
              setKilometres(estimate);
              addSchoolMarker(google, fallbackMap, plan.school, overlays.current);
              addStopMarkers(google, fallbackMap, ordered, overlays.current);
            }
          } catch (_) {
            // Preserve the original, actionable routing error.
          }
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    };
    draw();
    return () => { cancelled = true; };
  }, [loading, plan, stops, tripType]);

  return (
    <div className="bus-route-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="bus-route-dialog" role="dialog" aria-modal="true" aria-label={`Route map for ${bus.bus_no}`}>
        <header>
          <div><h4>Route Map · {bus.bus_no}</h4><span>{bus.reg_no || "No registration number"}</span></div>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </header>
        <div className="bus-route-toolbar">
          <div className="btn-group" role="group">
            <button className={`btn btn-sm ${tripType === "pickup" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTripType("pickup")}>Pickup</button>
            <button className={`btn btn-sm ${tripType === "drop" ? "btn-danger" : "btn-outline-danger"}`} onClick={() => setTripType("drop")}>Drop</button>
          </div>
          <input type="date" className="form-control form-control-sm" value={date} onChange={(event) => setDate(event.target.value)} />
          <span className="bus-route-stat"><b>{uniqueStops(stops).length}</b> stops · <b>{stops.length}</b> passengers</span>
          <span className="bus-route-distance">{kilometres == null ? "—" : `${kilometres.toFixed(1)} km${error ? " est." : ""}`}</span>
        </div>
        {error && <div className="alert alert-warning m-3 mb-0">{error}</div>}
        <div className="bus-route-map" ref={mapNode} />
        {(loading || mapLoading) && <div className="bus-route-loading"><span className="spinner-border spinner-border-sm" /> Calculating road route…</div>}
        <footer><span>Blue = pickup · Red = drop · S = school</span><button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button></footer>
      </section>
    </div>
  );
}
