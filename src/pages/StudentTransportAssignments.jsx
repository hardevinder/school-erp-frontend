// src/pages/StudentTransportAssignments.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Transportation.css";

// ---- role helpers ---------------------------------------------------------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
    isAccounts: roles.includes("accounts"),
    isTransport: roles.includes("transport"),
  };
};

const safeStr = (v) => String(v ?? "").trim();

const fmtYYYYMMDD = (d = new Date()) => {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const GOOGLE_MAPS_API_KEY = safeStr(
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "",
);

const RAW_GOOGLE_MAP_ID = safeStr(
  process.env.REACT_APP_GOOGLE_MAP_ID || "",
);

// Ignore common placeholder values so the map can safely fall back to
// Google's demo map ID during local setup.
const GOOGLE_MAP_ID = [
  "your_map_id",
  "your-google-map-id",
  "your_actual_google_map_id",
].includes(RAW_GOOGLE_MAP_ID.toLowerCase())
  ? ""
  : RAW_GOOGLE_MAP_ID;

const GOOGLE_MAP_SCRIPT_ID = "student-transport-google-maps-script";
const DEFAULT_MAP_CENTER = { lat: 30.7333, lng: 76.7794 };

const DEFAULT_NOTIFICATION_RADIUS_METERS = 1500;
const MIN_NOTIFICATION_RADIUS_METERS = 100;
const MAX_NOTIFICATION_RADIUS_METERS = 10000;

let googleMapsLoaderPromise = null;

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isValidLatitude = (value) => {
  const number = toNullableNumber(value);
  return number !== null && number >= -90 && number <= 90;
};

const isValidLongitude = (value) => {
  const number = toNullableNumber(value);
  return number !== null && number >= -180 && number <= 180;
};

const hasValidCoordinates = (location) =>
  isValidLatitude(location?.latitude) && isValidLongitude(location?.longitude);

const normalizeLocation = (value = {}) => ({
  address: safeStr(value?.address),
  latitude: toNullableNumber(value?.latitude ?? value?.lat),
  longitude: toNullableNumber(value?.longitude ?? value?.lng),
});

const sameCoordinates = (first, second) => {
  const a = normalizeLocation(first);
  const b = normalizeLocation(second);

  if (!hasValidCoordinates(a) || !hasValidCoordinates(b)) return false;

  return (
    Math.abs(a.latitude - b.latitude) < 0.0000001 &&
    Math.abs(a.longitude - b.longitude) < 0.0000001
  );
};

const getLatLngLiteral = (position) => {
  if (!position) return null;

  const lat =
    typeof position.lat === "function" ? position.lat() : Number(position.lat);
  const lng =
    typeof position.lng === "function" ? position.lng() : Number(position.lng);

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
};

const loadGoogleMapsApi = () => {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google);
  }

  if (googleMapsLoaderPromise) return googleMapsLoaderPromise;

  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error(
        "Google Maps API key is missing. Add REACT_APP_GOOGLE_MAPS_API_KEY to the frontend .env file.",
      ),
    );
  }

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    const callbackName = "__studentTransportGoogleMapsReady";
    const finish = () => {
      if (window.google?.maps?.importLibrary) {
        resolve(window.google);
      } else {
        reject(
          new Error("Google Maps loaded, but the Maps library is unavailable."),
        );
      }
    };

    window[callbackName] = () => {
      try {
        finish();
      } finally {
        delete window[callbackName];
      }
    };

    const existingScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID);
    if (existingScript) {
      if (window.google?.maps?.importLibrary) {
        finish();
        return;
      }

      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Maps.")),
        { once: true },
      );
      return;
    }

    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      loading: "async",
      callback: callbackName,
      v: "weekly",
      libraries: "maps,marker,places",
      region: "IN",
      language: "en",
    });

    if (GOOGLE_MAP_ID) {
      params.set("map_ids", GOOGLE_MAP_ID);
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.onerror = () => {
      googleMapsLoaderPromise = null;
      reject(
        new Error(
          "Failed to load Google Maps. Check the API key and domain restrictions.",
        ),
      );
    };

    document.head.appendChild(script);
  });

  return googleMapsLoaderPromise;
};

const LocationPickerModal = ({
  open,
  title,
  initialLocation,
  onClose,
  onConfirm,
}) => {
  const mapContainerRef = useRef(null);
  const searchContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);
  const reverseRequestRef = useRef(0);

  const normalizedInitial = useMemo(
    () => normalizeLocation(initialLocation),
    [
      initialLocation?.address,
      initialLocation?.latitude,
      initialLocation?.longitude,
    ],
  );

  const [draft, setDraft] = useState(normalizedInitial);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(normalizedInitial);
    setMapError("");
  }, [open, normalizedInitial]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !mapContainerRef.current) return undefined;

    let cancelled = false;
    let mapClickListener = null;
    let markerDragListener = null;
    let autocompleteElement = null;

    const reverseGeocode = async (position) => {
      if (!geocoderRef.current) return;

      const requestId = ++reverseRequestRef.current;

      try {
        const response = await geocoderRef.current.geocode({
          location: position,
        });
        if (cancelled || requestId !== reverseRequestRef.current) return;

        const formattedAddress = safeStr(
          response?.results?.[0]?.formatted_address || "",
        );

        setDraft((previous) => ({
          ...previous,
          address: formattedAddress || previous.address,
          latitude: position.lat,
          longitude: position.lng,
        }));
      } catch (error) {
        console.warn("Reverse geocoding failed:", error);
      }
    };

    const placeMarker = (position, shouldReverseGeocode = true) => {
      if (!markerRef.current || !mapRef.current) return;

      markerRef.current.position = position;
      markerRef.current.map = mapRef.current;
      mapRef.current.panTo(position);

      setDraft((previous) => ({
        ...previous,
        latitude: position.lat,
        longitude: position.lng,
        address: shouldReverseGeocode ? "" : previous.address,
      }));

      if (shouldReverseGeocode) {
        reverseGeocode(position);
      }
    };

    const initializeMap = async () => {
      setMapLoading(true);
      setMapError("");

      try {
        await loadGoogleMapsApi();

        const [{ Map }, { AdvancedMarkerElement }, placesLibrary] =
          await Promise.all([
            window.google.maps.importLibrary("maps"),
            window.google.maps.importLibrary("marker"),
            window.google.maps.importLibrary("places"),
          ]);

        if (cancelled || !mapContainerRef.current) return;

        const hasInitialCoordinates = hasValidCoordinates(normalizedInitial);
        const initialPosition = hasInitialCoordinates
          ? {
              lat: normalizedInitial.latitude,
              lng: normalizedInitial.longitude,
            }
          : DEFAULT_MAP_CENTER;

        const map = new Map(mapContainerRef.current, {
          center: initialPosition,
          zoom: hasInitialCoordinates ? 17 : 12,
          mapId: GOOGLE_MAP_ID || "DEMO_MAP_ID",
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          clickableIcons: false,
        });

        mapRef.current = map;
        geocoderRef.current = new window.google.maps.Geocoder();

        const marker = new AdvancedMarkerElement({
          map: hasInitialCoordinates ? map : null,
          position: initialPosition,
          gmpDraggable: true,
          title: "Drag this marker to the student's location",
        });

        markerRef.current = marker;

        mapClickListener = map.addListener("click", (event) => {
          const position = getLatLngLiteral(event?.latLng);
          if (position) placeMarker(position, true);
        });

        markerDragListener = marker.addListener("dragend", () => {
          const position = getLatLngLiteral(marker.position);
          if (position) placeMarker(position, true);
        });

        const PlaceAutocompleteElement =
          placesLibrary?.PlaceAutocompleteElement ||
          window.google.maps.places?.PlaceAutocompleteElement;

        if (PlaceAutocompleteElement && searchContainerRef.current) {
          searchContainerRef.current.innerHTML = "";

          autocompleteElement = new PlaceAutocompleteElement({
            includedRegionCodes: ["in"],
            placeholder: "Search village, street, landmark or address",
            requestedRegion: "IN",
          });

          autocompleteElement.style.width = "100%";
          autocompleteElement.style.display = "block";
          autocompleteElement.style.fontSize = "14px";

          autocompleteElement.addEventListener("gmp-select", async (event) => {
            try {
              const prediction = event?.placePrediction;
              if (!prediction) return;

              const place = prediction.toPlace();
              await place.fetchFields({
                fields: [
                  "displayName",
                  "formattedAddress",
                  "location",
                  "viewport",
                ],
              });

              const position = getLatLngLiteral(place.location);
              if (!position) return;

              const address = safeStr(
                place.formattedAddress || place.displayName || "",
              );

              setDraft({
                address,
                latitude: position.lat,
                longitude: position.lng,
              });

              marker.position = position;
              marker.map = map;

              if (place.viewport) {
                map.fitBounds(place.viewport);
              } else {
                map.setCenter(position);
                map.setZoom(17);
              }
            } catch (error) {
              console.error("Place selection error:", error);
              setMapError(
                "The selected place could not be loaded. Please try again.",
              );
            }
          });

          autocompleteElement.addEventListener("gmp-error", () => {
            setMapError(
              "Place search is unavailable. Check that Places API (New) is enabled.",
            );
          });

          searchContainerRef.current.appendChild(autocompleteElement);
        } else {
          setMapError(
            "Place search could not be initialized. You can still click the map or enter coordinates manually.",
          );
        }
      } catch (error) {
        console.error("Google Map initialization error:", error);
        if (!cancelled) {
          setMapError(error?.message || "Google Maps could not be loaded.");
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      reverseRequestRef.current += 1;

      if (mapClickListener) mapClickListener.remove();
      if (markerDragListener) markerDragListener.remove();

      if (markerRef.current) {
        markerRef.current.map = null;
      }

      if (autocompleteElement?.remove) {
        autocompleteElement.remove();
      }

      if (searchContainerRef.current) {
        searchContainerRef.current.innerHTML = "";
      }

      mapRef.current = null;
      markerRef.current = null;
      geocoderRef.current = null;
    };
  }, [open, normalizedInitial]);

  if (!open) return null;

  const confirmLocation = () => {
    const location = normalizeLocation(draft);

    if (!hasValidCoordinates(location)) {
      Swal.fire(
        "Select Location",
        "Please select a point on the map or enter valid latitude and longitude.",
        "warning",
      );
      return;
    }

    onConfirm(location);
  };

  return (
    <div className="sta-map-overlay" role="dialog" aria-modal="true">
      <style>{`
        .sta-map-overlay{
          position:fixed; inset:0; z-index:1080;
          display:flex; align-items:center; justify-content:center;
          padding:18px; background:rgba(15,28,45,0.66);
          backdrop-filter:blur(5px);
        }
        .sta-map-modal{
          width:min(980px, 100%); max-height:94vh; overflow:auto;
          background:#fff; border-radius:18px;
          box-shadow:0 24px 70px rgba(0,0,0,0.28);
          border:1px solid rgba(255,255,255,0.35);
        }
        .sta-map-header{
          position:sticky; top:0; z-index:2; background:#fff;
          display:flex; align-items:flex-start; justify-content:space-between;
          gap:16px; padding:16px 18px;
          border-bottom:1px solid rgba(0,0,0,0.08);
        }
        .sta-map-title{font-weight:900; color:#183153; font-size:18px;}
        .sta-map-sub{font-size:12px; color:#697789; margin-top:4px;}
        .sta-map-body{padding:16px 18px;}
        .sta-map-search gmp-place-autocomplete{
          width:100%; min-height:44px; border-radius:12px;
        }
        .sta-map-canvas{
          height:430px; width:100%; border-radius:14px;
          border:1px solid rgba(0,0,0,0.12); overflow:hidden;
          background:#edf1f5;
        }
        .sta-map-grid{
          display:grid; grid-template-columns:1.6fr 1fr 1fr;
          gap:10px; margin-top:12px;
        }
        .sta-map-field label{
          display:block; font-size:12px; font-weight:800;
          color:#344255; margin-bottom:5px;
        }
        .sta-map-field input{
          width:100%; height:42px; border-radius:10px;
          border:1px solid rgba(0,0,0,0.14); padding:8px 10px;
        }
        .sta-map-error{
          margin:10px 0; padding:10px 12px; border-radius:10px;
          background:#fff4e5; border:1px solid #ffd89a;
          color:#8a4b00; font-size:12px;
        }
        .sta-map-help{
          margin-top:10px; padding:9px 11px; border-radius:10px;
          background:#eef7ff; color:#285a8d; font-size:12px;
        }
        .sta-map-footer{
          position:sticky; bottom:0; z-index:2; background:#fff;
          display:flex; justify-content:flex-end; gap:10px;
          padding:14px 18px; border-top:1px solid rgba(0,0,0,0.08);
        }
        @media(max-width:700px){
          .sta-map-overlay{padding:0; align-items:stretch;}
          .sta-map-modal{max-height:100vh; border-radius:0;}
          .sta-map-canvas{height:360px;}
          .sta-map-grid{grid-template-columns:1fr;}
        }
      `}</style>

      <div className="sta-map-modal">
        <div className="sta-map-header">
          <div>
            <div className="sta-map-title">{title}</div>
            <div className="sta-map-sub">
              Search an address, click the map, or drag the marker.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="sta-map-body">
          <div className="sta-map-search" ref={searchContainerRef} />

          {mapError && <div className="sta-map-error">{mapError}</div>}

          <div className="position-relative mt-2">
            <div className="sta-map-canvas" ref={mapContainerRef} />
            {mapLoading && (
              <div
                className="position-absolute top-50 start-50 translate-middle bg-white px-3 py-2 rounded shadow-sm"
                style={{ fontWeight: 800, color: "#28486d" }}
              >
                Loading map…
              </div>
            )}
          </div>

          <div className="sta-map-grid">
            <div className="sta-map-field">
              <label>Selected Address</label>
              <input
                type="text"
                value={draft.address || ""}
                placeholder="Selected address"
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    address: event.target.value,
                  }))
                }
              />
            </div>

            <div className="sta-map-field">
              <label>Latitude</label>
              <input
                type="number"
                step="0.0000001"
                value={draft.latitude ?? ""}
                placeholder="30.0000000"
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    latitude: event.target.value,
                  }))
                }
              />
            </div>

            <div className="sta-map-field">
              <label>Longitude</label>
              <input
                type="number"
                step="0.0000001"
                value={draft.longitude ?? ""}
                placeholder="76.0000000"
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    longitude: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="sta-map-help">
            Coordinates are saved with seven decimal places. The marker can also
            be moved after selecting a search result.
          </div>
        </div>

        <div className="sta-map-footer">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={confirmLocation}
          >
            Use This Location
          </button>
        </div>
      </div>
    </div>
  );
};

const AssignmentModal = ({
  open,
  studentLabel,
  buses,
  current,
  saving,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState({
    pickupBusId: "",
    dropBusId: "",
    pickupStop: "",
    dropStop: "",
    startDate: fmtYYYYMMDD(),
    pickupAddress: "",
    pickupLatitude: null,
    pickupLongitude: null,
    dropAddress: "",
    dropLatitude: null,
    dropLongitude: null,
    notificationRadiusMeters: DEFAULT_NOTIFICATION_RADIUS_METERS,
  });
  const [sameAsPickup, setSameAsPickup] = useState(false);
  const [pickerType, setPickerType] = useState(null);

  useEffect(() => {
    if (!open) return;

    const pickupLocation = normalizeLocation({
      address: current?.pickup_address,
      latitude: current?.pickup_latitude,
      longitude: current?.pickup_longitude,
    });
    const dropLocation = normalizeLocation({
      address: current?.drop_address,
      latitude: current?.drop_latitude,
      longitude: current?.drop_longitude,
    });

    const locationsMatch =
      sameCoordinates(pickupLocation, dropLocation) &&
      safeStr(pickupLocation.address) === safeStr(dropLocation.address);

    setSameAsPickup(locationsMatch);
    setPickerType(null);
    setForm({
      pickupBusId: current?.pickup_bus_id ? String(current.pickup_bus_id) : "",
      dropBusId: current?.drop_bus_id ? String(current.drop_bus_id) : "",
      pickupStop: safeStr(current?.pickup_stop),
      dropStop: safeStr(current?.drop_stop),
      startDate: fmtYYYYMMDD(current?.start_date || new Date()),
      pickupAddress: pickupLocation.address,
      pickupLatitude: pickupLocation.latitude,
      pickupLongitude: pickupLocation.longitude,
      dropAddress: dropLocation.address,
      dropLatitude: dropLocation.latitude,
      dropLongitude: dropLocation.longitude,
      notificationRadiusMeters:
        Number(current?.notification_radius_meters) ||
        DEFAULT_NOTIFICATION_RADIUS_METERS,
    });
  }, [open, current]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const activeBuses = buses.filter(
    (bus) => bus.active !== false && Number(bus.active ?? 1) !== 0,
  );

  const setField = (field, value) => {
    setForm((previous) => {
      const next = { ...previous, [field]: value };

      if (
        sameAsPickup &&
        ["pickupAddress", "pickupLatitude", "pickupLongitude"].includes(field)
      ) {
        if (field === "pickupAddress") next.dropAddress = value;
        if (field === "pickupLatitude") next.dropLatitude = value;
        if (field === "pickupLongitude") next.dropLongitude = value;
      }

      return next;
    });
  };

  const pickupLocation = normalizeLocation({
    address: form.pickupAddress,
    latitude: form.pickupLatitude,
    longitude: form.pickupLongitude,
  });

  const dropLocation = normalizeLocation({
    address: form.dropAddress,
    latitude: form.dropLatitude,
    longitude: form.dropLongitude,
  });

  const applyPickedLocation = (location) => {
    const normalized = normalizeLocation(location);

    if (pickerType === "pickup") {
      setForm((previous) => ({
        ...previous,
        pickupAddress: normalized.address,
        pickupLatitude: normalized.latitude,
        pickupLongitude: normalized.longitude,
        ...(sameAsPickup
          ? {
              dropAddress: normalized.address,
              dropLatitude: normalized.latitude,
              dropLongitude: normalized.longitude,
            }
          : {}),
      }));
    } else if (pickerType === "drop") {
      setForm((previous) => ({
        ...previous,
        dropAddress: normalized.address,
        dropLatitude: normalized.latitude,
        dropLongitude: normalized.longitude,
      }));
    }

    setPickerType(null);
  };

  const toggleSameAsPickup = (checked) => {
    setSameAsPickup(checked);

    if (checked) {
      setForm((previous) => ({
        ...previous,
        dropAddress: previous.pickupAddress,
        dropLatitude: previous.pickupLatitude,
        dropLongitude: previous.pickupLongitude,
      }));
    }
  };

  const copyPickupLocationToDrop = () => {
    const hasPickupAddress = Boolean(safeStr(pickupLocation.address));
    const hasPickupCoordinates = hasValidCoordinates(pickupLocation);

    if (!hasPickupAddress && !hasPickupCoordinates) {
      Swal.fire(
        "Pickup Location Missing",
        "Please select or enter the pickup location first.",
        "warning",
      );
      return;
    }

    setSameAsPickup(true);

    setForm((previous) => ({
      ...previous,
      dropAddress: previous.pickupAddress,
      dropLatitude: previous.pickupLatitude,
      dropLongitude: previous.pickupLongitude,
    }));

    Swal.fire({
      icon: "success",
      title: "Location Copied",
      text: "Pickup location has been copied to drop location.",
      timer: 1100,
      showConfirmButton: false,
    });
  };

  const validateCoordinatePair = (latitude, longitude, label) => {
    const hasLatitude =
      latitude !== null && latitude !== undefined && latitude !== "";
    const hasLongitude =
      longitude !== null && longitude !== undefined && longitude !== "";

    if (!hasLatitude && !hasLongitude) return true;

    if (!hasLatitude || !hasLongitude) {
      Swal.fire(
        "Incomplete Location",
        `${label} must contain both latitude and longitude.`,
        "warning",
      );
      return false;
    }

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      Swal.fire(
        "Invalid Location",
        `${label} latitude or longitude is outside the valid range.`,
        "warning",
      );
      return false;
    }

    return true;
  };

  const saveAssignment = async () => {
    if (!form.startDate) {
      Swal.fire(
        "Validation",
        "Please select the effective start date.",
        "warning",
      );
      return;
    }

    if (!form.pickupBusId && !form.dropBusId) {
      Swal.fire(
        "Validation",
        "Please select at least a pickup bus or drop bus.",
        "warning",
      );
      return;
    }

    const notificationRadius = Number(form.notificationRadiusMeters);

    if (
      !Number.isInteger(notificationRadius) ||
      notificationRadius < MIN_NOTIFICATION_RADIUS_METERS ||
      notificationRadius > MAX_NOTIFICATION_RADIUS_METERS
    ) {
      Swal.fire(
        "Invalid Notification Radius",
        `Notification radius must be a whole number between ${MIN_NOTIFICATION_RADIUS_METERS} and ${MAX_NOTIFICATION_RADIUS_METERS} metres.`,
        "warning",
      );
      return;
    }

    const effectiveDrop = sameAsPickup ? pickupLocation : dropLocation;

    if (
      !validateCoordinatePair(
        pickupLocation.latitude,
        pickupLocation.longitude,
        "Pickup location",
      ) ||
      !validateCoordinatePair(
        effectiveDrop.latitude,
        effectiveDrop.longitude,
        "Drop location",
      )
    ) {
      return;
    }

    await onSubmit({
      pickup_bus_id: form.pickupBusId ? Number(form.pickupBusId) : null,
      drop_bus_id: form.dropBusId ? Number(form.dropBusId) : null,
      pickup_stop: safeStr(form.pickupStop) || null,
      drop_stop: safeStr(form.dropStop) || null,
      start_date: form.startDate,
      pickup_address: safeStr(pickupLocation.address) || null,
      pickup_latitude: hasValidCoordinates(pickupLocation)
        ? pickupLocation.latitude
        : null,
      pickup_longitude: hasValidCoordinates(pickupLocation)
        ? pickupLocation.longitude
        : null,
      drop_address: safeStr(effectiveDrop.address) || null,
      drop_latitude: hasValidCoordinates(effectiveDrop)
        ? effectiveDrop.latitude
        : null,
      drop_longitude: hasValidCoordinates(effectiveDrop)
        ? effectiveDrop.longitude
        : null,
      notification_radius_meters: notificationRadius,
    });
  };

  return (
    <>
      <div className="sta-assignment-overlay" role="dialog" aria-modal="true">
        <style>{`
          .sta-assignment-overlay{
            position:fixed; inset:0; z-index:1060;
            display:flex; align-items:center; justify-content:center;
            padding:18px; background:rgba(16,30,48,0.58);
            backdrop-filter:blur(4px);
          }
          .sta-assignment-modal{
            width:min(980px,100%); max-height:94vh; overflow:auto;
            background:#fff; border-radius:18px;
            box-shadow:0 24px 70px rgba(0,0,0,0.28);
          }
          .sta-assignment-header{
            position:sticky; top:0; z-index:2; background:#fff;
            padding:16px 18px; border-bottom:1px solid rgba(0,0,0,0.08);
            display:flex; justify-content:space-between; gap:14px;
          }
          .sta-assignment-title{font-size:20px; font-weight:900; color:#173250;}
          .sta-assignment-student{font-size:13px; color:#58697d; margin-top:3px;}
          .sta-assignment-body{padding:16px 18px;}
          .sta-assignment-current{
            padding:11px 13px; border-radius:12px; margin-bottom:14px;
            background:linear-gradient(180deg,#f3f8ff,#fbfdff);
            border:1px solid rgba(13,110,253,0.14); font-size:12px;
          }
          .sta-assignment-grid{
            display:grid; grid-template-columns:1fr 1fr; gap:14px;
          }
          .sta-assignment-section{
            border:1px solid rgba(0,0,0,0.09); border-radius:14px;
            padding:14px; background:#fff;
          }
          .sta-assignment-section-title{
            display:flex; justify-content:space-between; align-items:center;
            gap:8px; font-size:14px; font-weight:900; color:#233a55;
            margin-bottom:12px;
          }
          .sta-assignment-field{margin-bottom:11px;}
          .sta-assignment-field:last-child{margin-bottom:0;}
          .sta-assignment-field label{
            display:block; font-size:12px; font-weight:800;
            color:#3e4c5e; margin-bottom:5px;
          }
          .sta-assignment-field input,
          .sta-assignment-field select{
            width:100%; height:42px; border-radius:10px;
            border:1px solid rgba(0,0,0,0.14); padding:8px 10px;
            background:#fff;
          }
          .sta-coordinate-grid{
            display:grid; grid-template-columns:1fr 1fr; gap:8px;
          }
          .sta-location-summary{
            padding:10px; border-radius:10px; margin-top:8px;
            border:1px dashed rgba(13,110,253,0.28);
            background:#f7fbff; font-size:12px; color:#3f5369;
            min-height:58px;
          }
          .sta-location-address{font-weight:800; color:#273e58; margin-bottom:3px;}
          .sta-assignment-footer{
            position:sticky; bottom:0; z-index:2; background:#fff;
            display:flex; justify-content:flex-end; gap:10px;
            padding:14px 18px; border-top:1px solid rgba(0,0,0,0.08);
          }
          .sta-map-config-warning{
            padding:9px 11px; border-radius:10px; margin-bottom:12px;
            background:#fff7e8; border:1px solid #ffdda4;
            color:#875000; font-size:12px;
          }
          @media(max-width:760px){
            .sta-assignment-overlay{padding:0; align-items:stretch;}
            .sta-assignment-modal{max-height:100vh; border-radius:0;}
            .sta-assignment-grid{grid-template-columns:1fr;}
          }
        `}</style>

        <div className="sta-assignment-modal">
          <div className="sta-assignment-header">
            <div>
              <div className="sta-assignment-title">
                Assign Pickup / Drop Bus
              </div>
              <div className="sta-assignment-student">{studentLabel}</div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </button>
          </div>

          <div className="sta-assignment-body">
            <div className="sta-assignment-current">
              Current assignment: Pickup bus{" "}
              <b>{current?.pickupBusLabel || "—"}</b>, Drop bus{" "}
              <b>{current?.dropBusLabel || "—"}</b>, Start date{" "}
              <b>{safeStr(current?.start_date) || "—"}</b>, Notification
              radius{" "}
              <b>
                {Number(current?.notification_radius_meters) ||
                  DEFAULT_NOTIFICATION_RADIUS_METERS}{" "}
                m
              </b>
              , Status <b>{safeStr(current?.status) || "—"}</b>.
            </div>

            {!GOOGLE_MAPS_API_KEY && (
              <div className="sta-map-config-warning">
                Add <b>REACT_APP_GOOGLE_MAPS_API_KEY</b> in the frontend .env file to
                enable map selection. Manual address and coordinates can still
                be entered below.
              </div>
            )}

            <div className="sta-assignment-grid">
              <div className="sta-assignment-section">
                <div className="sta-assignment-section-title">
                  <span>Pickup Details</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => setPickerType("pickup")}
                    disabled={!GOOGLE_MAPS_API_KEY}
                  >
                    Select on Map
                  </button>
                </div>

                <div className="sta-assignment-field">
                  <label>Pickup Bus</label>
                  <select
                    value={form.pickupBusId}
                    onChange={(event) =>
                      setField("pickupBusId", event.target.value)
                    }
                  >
                    <option value="">-- Select Pickup Bus --</option>
                    {activeBuses.map((bus) => (
                      <option key={bus.id} value={bus.id}>
                        {safeStr(bus.bus_no) || `Bus ${bus.id}`}
                        {bus.reg_no ? ` (${safeStr(bus.reg_no)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sta-assignment-field">
                  <label>Pickup Stop</label>
                  <input
                    type="text"
                    value={form.pickupStop}
                    placeholder="e.g. Main Gate"
                    onChange={(event) =>
                      setField("pickupStop", event.target.value)
                    }
                  />
                </div>

                <div className="sta-assignment-field">
                  <label>Pickup Address</label>
                  <input
                    type="text"
                    value={form.pickupAddress}
                    placeholder="Select on map or enter address"
                    onChange={(event) =>
                      setField("pickupAddress", event.target.value)
                    }
                  />
                </div>

                <div className="sta-coordinate-grid">
                  <div className="sta-assignment-field">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={form.pickupLatitude ?? ""}
                      onChange={(event) =>
                        setField("pickupLatitude", event.target.value)
                      }
                    />
                  </div>
                  <div className="sta-assignment-field">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={form.pickupLongitude ?? ""}
                      onChange={(event) =>
                        setField("pickupLongitude", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="sta-location-summary">
                  <div className="sta-location-address">
                    {pickupLocation.address || "No pickup location selected"}
                  </div>
                  {hasValidCoordinates(pickupLocation) && (
                    <div>
                      {pickupLocation.latitude.toFixed(7)},{" "}
                      {pickupLocation.longitude.toFixed(7)}
                    </div>
                  )}
                </div>
              </div>

              <div className="sta-assignment-section">
                <div className="sta-assignment-section-title">
                  <span>Drop Details</span>

                  <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={copyPickupLocationToDrop}
                      disabled={
                        !safeStr(form.pickupAddress) &&
                        !hasValidCoordinates(pickupLocation)
                      }
                      title="Copy pickup address and coordinates to drop location"
                    >
                      Pickup → Drop
                    </button>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => setPickerType("drop")}
                      disabled={!GOOGLE_MAPS_API_KEY || sameAsPickup}
                    >
                      Select on Map
                    </button>
                  </div>
                </div>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="sameAsPickupLocation"
                    checked={sameAsPickup}
                    onChange={(event) =>
                      toggleSameAsPickup(event.target.checked)
                    }
                  />
                  <label
                    className="form-check-label"
                    htmlFor="sameAsPickupLocation"
                    style={{ fontSize: 12, fontWeight: 800 }}
                  >
                    Drop location is same as pickup location
                  </label>
                </div>

                <div className="sta-assignment-field">
                  <label>Drop Bus</label>
                  <select
                    value={form.dropBusId}
                    onChange={(event) =>
                      setField("dropBusId", event.target.value)
                    }
                  >
                    <option value="">-- Select Drop Bus --</option>
                    {activeBuses.map((bus) => (
                      <option key={bus.id} value={bus.id}>
                        {safeStr(bus.bus_no) || `Bus ${bus.id}`}
                        {bus.reg_no ? ` (${safeStr(bus.reg_no)})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sta-assignment-field">
                  <label>Drop Stop</label>
                  <input
                    type="text"
                    value={form.dropStop}
                    placeholder="e.g. Bus Stand"
                    onChange={(event) =>
                      setField("dropStop", event.target.value)
                    }
                  />
                </div>

                <div className="sta-assignment-field">
                  <label>Drop Address</label>
                  <input
                    type="text"
                    value={sameAsPickup ? form.pickupAddress : form.dropAddress}
                    placeholder="Select on map or enter address"
                    disabled={sameAsPickup}
                    onChange={(event) =>
                      setField("dropAddress", event.target.value)
                    }
                  />
                </div>

                <div className="sta-coordinate-grid">
                  <div className="sta-assignment-field">
                    <label>Latitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={
                        sameAsPickup
                          ? (form.pickupLatitude ?? "")
                          : (form.dropLatitude ?? "")
                      }
                      disabled={sameAsPickup}
                      onChange={(event) =>
                        setField("dropLatitude", event.target.value)
                      }
                    />
                  </div>
                  <div className="sta-assignment-field">
                    <label>Longitude</label>
                    <input
                      type="number"
                      step="0.0000001"
                      value={
                        sameAsPickup
                          ? (form.pickupLongitude ?? "")
                          : (form.dropLongitude ?? "")
                      }
                      disabled={sameAsPickup}
                      onChange={(event) =>
                        setField("dropLongitude", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="sta-location-summary">
                  <div className="sta-location-address">
                    {(sameAsPickup
                      ? pickupLocation.address
                      : dropLocation.address) || "No drop location selected"}
                  </div>
                  {hasValidCoordinates(
                    sameAsPickup ? pickupLocation : dropLocation,
                  ) && (
                    <div>
                      {(sameAsPickup
                        ? pickupLocation.latitude
                        : dropLocation.latitude
                      ).toFixed(7)}
                      ,{" "}
                      {(sameAsPickup
                        ? pickupLocation.longitude
                        : dropLocation.longitude
                      ).toFixed(7)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="sta-assignment-section mt-3">
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="sta-assignment-field mb-0">
                    <label>Effective From</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(event) =>
                        setField("startDate", event.target.value)
                      }
                    />
                    <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                      Saving a new entry closes the previous active assignment
                      based on your backend assignment logic.
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="sta-assignment-field mb-0">
                    <label>Notification Radius (metres)</label>
                    <input
                      type="number"
                      min={MIN_NOTIFICATION_RADIUS_METERS}
                      max={MAX_NOTIFICATION_RADIUS_METERS}
                      step="100"
                      value={form.notificationRadiusMeters}
                      placeholder="1500"
                      onChange={(event) =>
                        setField(
                          "notificationRadiusMeters",
                          event.target.value,
                        )
                      }
                    />
                    <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                      The student app will receive the approaching-bus
                      notification when the bus enters this radius. Default is{" "}
                      <b>{DEFAULT_NOTIFICATION_RADIUS_METERS} metres</b>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sta-assignment-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={saveAssignment}
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : current?.id
                  ? "Update Assignment"
                  : "Save Assignment"}
            </button>
          </div>
        </div>
      </div>

      <LocationPickerModal
        open={pickerType === "pickup"}
        title="Select Pickup Location"
        initialLocation={pickupLocation}
        onClose={() => setPickerType(null)}
        onConfirm={applyPickedLocation}
      />

      <LocationPickerModal
        open={pickerType === "drop"}
        title="Select Drop Location"
        initialLocation={dropLocation}
        onClose={() => setPickerType(null)}
        onConfirm={applyPickedLocation}
      />
    </>
  );
};

const StudentTransportAssignments = () => {
  useMemo(getRoleFlags, []); // keep existing pattern

  const [students, setStudents] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedRouteFilterId, setSelectedRouteFilterId] = useState("");
  const [transportStatusFilter, setTransportStatusFilter] = useState("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);

  const [assignmentDialog, setAssignmentDialog] = useState({
    open: false,
    studentId: null,
    current: null,
  });
  const [assignmentSaving, setAssignmentSaving] = useState(false);

  // Active bus assignments shown directly in the student listing.
  // undefined = not loaded yet, null = API loaded but no active assignment.
  const [activeAssignmentsByStudent, setActiveAssignmentsByStudent] = useState({});
  const [assignmentListLoading, setAssignmentListLoading] = useState(false);
  const loadedAssignmentStudentIdsRef = useRef(new Set());

  // -------------------- Load dropdown data --------------------
  const fetchStudents = async () => {
    const res = await api.get("/students");
    const list = Array.isArray(res.data)
      ? res.data
      : Array.isArray(res.data?.students)
        ? res.data.students
        : [];
    setStudents(list);
  };

  const fetchBuses = async () => {
    const res = await api.get("/buses");
    setBuses(Array.isArray(res.data) ? res.data : []);
  };

  const fetchRoutes = async () => {
    const res = await api.get("/transportations");
    setRoutes(Array.isArray(res.data) ? res.data : []);
  };

  const refreshAll = async (showToast = true) => {
    setLoading(true);
    try {
      loadedAssignmentStudentIdsRef.current.clear();
      setActiveAssignmentsByStudent({});
      await Promise.all([fetchStudents(), fetchBuses(), fetchRoutes()]);
      if (showToast) {
        Swal.fire({
          icon: "success",
          title: "Refreshed",
          text: "Latest transport data loaded successfully.",
          timer: 1400,
          showConfirmButton: false,
        });
      }
    } catch (e) {
      console.error("Refresh error:", e);
      Swal.fire("Error", "Failed to refresh data.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------- Active assignment fetch --------------------
  const fetchActiveAssignment = async (studentId, dateStr) => {
    if (!studentId) return null;
    try {
      const res = await api.get(
        `/student-transport-assignments/student/${studentId}/active`,
        { params: { date: dateStr } },
      );
      return res.data || null;
    } catch {
      return null;
    }
  };

  // -------------------- helpers: names/labels --------------------
  const findBusNo = (id) => {
    const b = buses.find((x) => String(x.id) === String(id));
    if (!b) return id ? `Bus ID ${id}` : "—";
    const label = `${safeStr(b.bus_no) || `Bus ${b.id}`}${
      b.reg_no ? ` (${safeStr(b.reg_no)})` : ""
    }`;
    return label || "—";
  };

  const getListingAssignment = (studentId) =>
    activeAssignmentsByStudent[String(studentId)];

  const hasActiveBusAssignment = (studentId) => {
    const assignment = getListingAssignment(studentId);
    return Boolean(assignment?.pickup_bus_id || assignment?.drop_bus_id);
  };

  const getStudentLabel = (studentId) => {
    const s = students.find((x) => String(x.id) === String(studentId));
    if (!s) return `ID: ${safeStr(studentId) || "—"}`;
    const nm = safeStr(s?.name) || "—";
    const adm = safeStr(s?.admission_number);
    return `${nm}${adm ? ` (${adm})` : ""}`;
  };

  const getClassName = (s) =>
    safeStr(s?.class_name || s?.Class?.class_name || s?.ClassName || "") || "—";

  const getSectionName = (s) =>
    safeStr(
      s?.section_name || s?.Section?.section_name || s?.SectionName || "",
    ) || "—";

  const getStudentStatus = (s) => {
    const status = safeStr(s?.status).toLowerCase();
    if (status === "enabled") return "enabled";
    if (status === "disabled") return "disabled";
    return "unknown";
  };

  const getRouteObjectByStudent = (s) => {
    return (
      routes.find((r) => String(r.id) === String(s?.route_id || "")) || null
    );
  };

  const getStudentPlaceName = (s) => {
    const routeObj = getRouteObjectByStudent(s);

    const placeName = safeStr(
      routeObj?.Villages ||
        routeObj?.villages ||
        routeObj?.City ||
        routeObj?.city ||
        s?.village ||
        s?.city ||
        s?.route_name ||
        "",
    );

    return placeName || "—";
  };

  const getStudentRouteDisplay = (s) => {
    const routeObj = getRouteObjectByStudent(s);
    const placeName = getStudentPlaceName(s);
    const cost = routeObj?.Cost ?? routeObj?.cost ?? s?.route_cost;

    if (placeName && placeName !== "—") {
      return `${placeName}${
        cost != null && String(cost).trim() !== "" ? ` — ₹${cost}` : ""
      }`;
    }

    return "—";
  };

  const hasTransportAssigned = (s) => {
    const routeObj = getRouteObjectByStudent(s);

    return Boolean(
      s?.route_id ||
      safeStr(s?.route_name) ||
      safeStr(routeObj?.RouteName) ||
      safeStr(routeObj?.Villages) ||
      safeStr(routeObj?.villages) ||
      safeStr(routeObj?.City) ||
      safeStr(routeObj?.city),
    );
  };

  // -------------------- export helpers --------------------
  const getExportRows = (rows) =>
    rows.map((s, idx) => {
      const assignment = getListingAssignment(s.id);

      return {
        "S. No.": idx + 1,
        Name: safeStr(s?.name) || "—",
        "Admission No": safeStr(s?.admission_number) || "—",
        Status: getStudentStatus(s),
        Class: getClassName(s),
        Section: getSectionName(s),
        "Pickup Bus": assignment === undefined
          ? "Not Loaded"
          : findBusNo(assignment?.pickup_bus_id),
        "Drop Bus": assignment === undefined
          ? "Not Loaded"
          : findBusNo(assignment?.drop_bus_id),
        "Bus Assignment": hasActiveBusAssignment(s.id) ? "Assigned" : "Not Assigned",
        "Effective From": safeStr(assignment?.start_date) || "—",
        "Village / City": getStudentPlaceName(s),
        Route: getStudentRouteDisplay(s),
        "Route Cost": s?.route_cost ?? getRouteObjectByStudent(s)?.Cost ?? "—",
      };
    });

  const downloadAssignmentsExcel = async () => {
    try {
      const exportRows = getExportRows(filteredStudents);

      if (!exportRows.length) {
        return Swal.fire(
          "No Data",
          "No filtered student data available for Excel export.",
          "info",
        );
      }

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TransportAssignments");
      XLSX.writeFile(wb, `StudentTransportAssignments_${fmtYYYYMMDD()}.xlsx`);

      Swal.fire({
        icon: "success",
        title: "Downloaded",
        text: "Excel file downloaded successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("Excel download error:", e);
      Swal.fire("Error", "Failed to download Excel file.", "error");
    }
  };

  const downloadAssignmentsPdf = async () => {
    try {
      const exportRows = getExportRows(filteredStudents);

      if (!exportRows.length) {
        return Swal.fire(
          "No Data",
          "No filtered student data available for PDF export.",
          "info",
        );
      }

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });
      doc.setFontSize(16);
      doc.text("Student Transport Assignments", 40, 36);
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, 54);

      autoTable(doc, {
        startY: 70,
        head: [
          [
            "S. No.",
            "Name",
            "Admission No",
            "Status",
            "Class",
            "Section",
            "Pickup Bus",
            "Drop Bus",
            "Bus Assignment",
            "Effective From",
            "Village / City",
            "Route",
            "Route Cost",
          ],
        ],
        body: exportRows.map((r) => [
          r["S. No."],
          r.Name,
          r["Admission No"],
          r.Status,
          r.Class,
          r.Section,
          r["Pickup Bus"],
          r["Drop Bus"],
          r["Bus Assignment"],
          r["Effective From"],
          r["Village / City"],
          r.Route,
          r["Route Cost"],
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [36, 68, 120] },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        margin: { left: 24, right: 24 },
      });

      doc.save(`StudentTransportAssignments_${fmtYYYYMMDD()}.pdf`);

      Swal.fire({
        icon: "success",
        title: "Downloaded",
        text: "PDF file downloaded successfully.",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("PDF download error:", e);
      Swal.fire("Error", "Failed to download PDF file.", "error");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedRouteFilterId("");
    setTransportStatusFilter("all");
    setStudentStatusFilter("all");
    setVisibleCount(40);
  };

  // -------------------- Assignment modal --------------------
  const openAssignDialog = async (studentId) => {
    if (!studentId) {
      Swal.fire("Validation", "Please select a student.", "warning");
      return;
    }

    const defaultDate = fmtYYYYMMDD(new Date());
    setLoading(true);

    try {
      const response = await fetchActiveAssignment(studentId, defaultDate);
      const current =
        response?.assignment || response?.data || response || null;

      setAssignmentDialog({
        open: true,
        studentId: String(studentId),
        current: current
          ? {
              ...current,
              pickupBusLabel: findBusNo(current?.pickup_bus_id),
              dropBusLabel: findBusNo(current?.drop_bus_id),
            }
          : {
              pickupBusLabel: "—",
              dropBusLabel: "—",
              start_date: defaultDate,
              status: "—",
            },
      });
    } catch (error) {
      console.error("Open assignment error:", error);
      Swal.fire("Error", "Failed to load the current assignment.", "error");
    } finally {
      setLoading(false);
    }
  };

  const closeAssignmentDialog = () => {
    if (assignmentSaving) return;
    setAssignmentDialog({ open: false, studentId: null, current: null });
  };

  const saveTransportAssignment = async (values) => {
    const studentId = assignmentDialog.studentId;
    if (!studentId) return;

    const payload = {
      student_id: Number(studentId),
      ...values,
    };

    setAssignmentSaving(true);

    try {
      const res = await api.post(
        "/student-transport-assignments/assign",
        payload,
      );

      // Refresh today's active assignment so the listing updates immediately.
      const todayAssignment = await fetchActiveAssignment(
        studentId,
        fmtYYYYMMDD(new Date()),
      );
      const normalizedTodayAssignment =
        todayAssignment?.assignment ||
        todayAssignment?.data ||
        todayAssignment ||
        null;

      loadedAssignmentStudentIdsRef.current.add(String(studentId));
      setActiveAssignmentsByStudent((previous) => ({
        ...previous,
        [String(studentId)]: normalizedTodayAssignment,
      }));

      setAssignmentDialog({ open: false, studentId: null, current: null });

      await Swal.fire({
        icon: "success",
        title: "Saved",
        text: res?.data?.message || "Bus assignment saved successfully.",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Assign error:", error);
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.details ||
        "Failed to save transport assignment.";

      Swal.fire("Error", message, "error");
    } finally {
      setAssignmentSaving(false);
    }
  };

  // -------------------- Search helpers --------------------
  const placeOptions = useMemo(() => {
    const unique = new Map();

    students.forEach((s) => {
      const place = getStudentPlaceName(s);
      if (place && place !== "—" && !unique.has(place)) {
        unique.set(place, place);
      }
    });

    return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
  }, [students, routes]);

  const filteredStudents = useMemo(() => {
    const q = safeStr(search).toLowerCase();
    const selectedPlace = safeStr(selectedRouteFilterId).toLowerCase();

    return students.filter((s) => {
      const name = safeStr(s?.name).toLowerCase();
      const adm = safeStr(s?.admission_number).toLowerCase();
      const place = getStudentPlaceName(s).toLowerCase();
      const hasTransport = hasTransportAssigned(s);
      const studentStatus = getStudentStatus(s);

      const textOk = !q || name.includes(q) || adm.includes(q);
      const placeOk = !selectedPlace || place === selectedPlace;
      const transportOk =
        transportStatusFilter === "all" ||
        (transportStatusFilter === "with_transport" && hasTransport) ||
        (transportStatusFilter === "without_transport" && !hasTransport);

      const statusOk =
        studentStatusFilter === "all" ||
        (studentStatusFilter === "enabled" && studentStatus === "enabled") ||
        (studentStatusFilter === "disabled" && studentStatus === "disabled");

      return textOk && placeOk && transportOk && statusOk;
    });
  }, [
    students,
    search,
    selectedRouteFilterId,
    transportStatusFilter,
    studentStatusFilter,
    routes,
  ]);

  const visibleStudents = filteredStudents.slice(0, visibleCount);
  const visibleStudentIdsKey = visibleStudents
    .map((student) => String(student.id))
    .join(",");

  // Load active pickup/drop assignments for the rows currently visible.
  // This avoids making one API request for every student in the database.
  useEffect(() => {
    const studentIds = visibleStudents
      .map((student) => String(student.id))
      .filter(Boolean)
      .filter(
        (studentId) =>
          !loadedAssignmentStudentIdsRef.current.has(studentId),
      );

    if (!studentIds.length) return undefined;

    let cancelled = false;
    const listingDate = fmtYYYYMMDD(new Date());

    const loadAssignments = async () => {
      setAssignmentListLoading(true);

      try {
        const results = [];
        const requestBatchSize = 8;

        for (let index = 0; index < studentIds.length; index += requestBatchSize) {
          if (cancelled) return;

          const batchIds = studentIds.slice(index, index + requestBatchSize);
          const batchResults = await Promise.all(
            batchIds.map(async (studentId) => {
              const response = await fetchActiveAssignment(
                studentId,
                listingDate,
              );
              const assignment =
                response?.assignment || response?.data || response || null;
              return [studentId, assignment];
            }),
          );

          results.push(...batchResults);
        }

        if (cancelled) return;

        studentIds.forEach((studentId) =>
          loadedAssignmentStudentIdsRef.current.add(studentId),
        );

        setActiveAssignmentsByStudent((previous) => ({
          ...previous,
          ...Object.fromEntries(results),
        }));
      } finally {
        if (!cancelled) setAssignmentListLoading(false);
      }
    };

    loadAssignments();

    return () => {
      cancelled = true;
    };
    // visibleStudentIdsKey intentionally controls loading when rows change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleStudentIdsKey]);

  const stats = useMemo(() => {
    const enabledStudents = students.filter(
      (s) => getStudentStatus(s) === "enabled",
    ).length;

    const disabledStudents = students.filter(
      (s) => getStudentStatus(s) === "disabled",
    ).length;

    const withTransport = students.filter((s) =>
      hasTransportAssigned(s),
    ).length;

    return {
      totalStudents: students.length,
      enabledStudents,
      disabledStudents,
      filteredStudents: filteredStudents.length,
      totalPlaces: placeOptions.length,
      withTransport,
      visibleBusAssignments: visibleStudents.filter((student) =>
        hasActiveBusAssignment(student.id),
      ).length,
    };
  }, [
    students,
    filteredStudents,
    placeOptions,
    routes,
    visibleStudents,
    activeAssignmentsByStudent,
  ]);

  // -------------------- UI --------------------
  return (
    <div className="container-fluid mt-3">
      <style>{`
        .sta-shell{ padding-bottom: 16px; }
        .sta-hero{
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 18px;
          padding: 16px;
          background: linear-gradient(180deg, #ffffff, #f8fbff);
          box-shadow: 0 8px 24px rgba(0,0,0,0.05);
          margin-bottom: 14px;
        }
        .sta-toolbar{ position: sticky; top: 0; z-index: 5; }
        .sta-title{ font-weight: 800; letter-spacing: 0.2px; color: #13233a; }
        .sta-subtitle{ font-size: 13px; color: #5c6b7a; margin-top: 4px; }
        .sta-top-actions{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
        .sta-card{
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
          background: #fff;
        }
        .sta-stat{
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          background: #fff;
          padding: 12px 14px;
          min-height: 86px;
        }
        .sta-stat-label{ font-size: 12px; font-weight: 700; color: #6b7785; margin-bottom: 4px; }
        .sta-stat-value{ font-size: 24px; font-weight: 800; color: #0f2744; line-height: 1.1; }

        .sta-stat-enabled{
          background: linear-gradient(180deg, #f3fff7, #ffffff);
          border: 1px solid rgba(25,135,84,0.18);
        }
        .sta-stat-enabled .sta-stat-value{ color: #198754; }

        .sta-stat-disabled{
          background: linear-gradient(180deg, #fff5f5, #ffffff);
          border: 1px solid rgba(220,53,69,0.18);
        }
        .sta-stat-disabled .sta-stat-value{ color: #dc3545; }

        .sta-filter label{ font-size: 12px; font-weight: 800; margin-bottom: 6px; color: #364253; }
        .sta-filter .form-select,
        .sta-filter .form-control{
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.12);
        }
        .sta-filter .form-select:focus,
        .sta-filter .form-control:focus{
          border-color: rgba(13,110,253,0.45);
          box-shadow: 0 0 0 0.14rem rgba(13,110,253,0.1);
        }
        .sta-table-wrap{
          border-radius: 14px;
          overflow: auto;
          border: 1px solid rgba(0,0,0,0.06);
        }
        .sta-table{
          margin: 0;
          min-width: 1540px;
          border-collapse: separate;
          border-spacing: 0;
        }
        .sta-sticky-col{
          position: sticky;
          background: #fff;
          z-index: 2;
        }
        .sta-table thead .sta-sticky-col{
          background: #f4f7fb;
          z-index: 4;
        }
        .sta-col-name{ left: 0; width: 220px; min-width: 220px; }
        .sta-col-admission{
          left: 220px;
          width: 150px;
          min-width: 150px;
          box-shadow: 8px 0 12px -12px rgba(0,0,0,0.55);
        }
        .sta-row:hover .sta-sticky-col{
          background: #f7faff;
        }
        .sta-bus-cell{ min-width: 175px; }
        .sta-bus-label{
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 5px 9px;
          border-radius: 9px;
          background: #eef6ff;
          border: 1px solid rgba(13,110,253,0.16);
          color: #164f8f;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .sta-bus-label-empty{
          background: #f7f7f8;
          border-color: rgba(108,117,125,0.16);
          color: #6c757d;
        }
        .sta-table thead th{
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          background: #f4f7fb;
          color: #253344;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          padding-top: 12px;
          padding-bottom: 12px;
        }
        .sta-table tbody td{ font-size: 13px; padding-top: 10px; padding-bottom: 10px; vertical-align: middle; }
        .sta-row:hover{ background: rgba(13,110,253,0.035); }

        .sta-pill{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(13,110,253,0.15);
          background: rgba(13,110,253,0.06);
          font-size: 12px;
          white-space: nowrap;
          color: #1f4f91;
          font-weight: 700;
        }

        .sta-status-badge{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          border: 1px solid transparent;
          text-transform: capitalize;
        }
        .sta-status-enabled{
          color: #146c43;
          background: rgba(25,135,84,0.10);
          border-color: rgba(25,135,84,0.18);
        }
        .sta-status-disabled{
          color: #b02a37;
          background: rgba(220,53,69,0.10);
          border-color: rgba(220,53,69,0.18);
        }
        .sta-status-unknown{
          color: #6c757d;
          background: rgba(108,117,125,0.10);
          border-color: rgba(108,117,125,0.18);
        }

        .sta-route-chip{
          display:inline-flex;
          align-items:center;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(25,135,84,0.08);
          color: #146c43;
          border: 1px solid rgba(25,135,84,0.14);
          font-size: 12px;
          font-weight: 700;
        }
        .sta-btn{ border-radius: 10px; padding: 8px 12px; font-weight: 700; font-size: 12px; }
        .sta-btn-primary{ border-radius: 10px; padding: 7px 12px; font-weight: 700; font-size: 12px; min-width: 92px; }
        .sta-loading{
          position: fixed;
          inset: 0;
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(3px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }
        .sta-loading .box{
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.10);
          font-weight: 800;
          color: #183153;
        }
        .sta-empty{ padding: 28px 16px; text-align: center; color: #6c7785; }
        .sta-empty-title{ font-size: 15px; font-weight: 800; color: #3a4758; margin-bottom: 4px; }
        .sta-empty-sub{ font-size: 13px; }

        @media (max-width: 768px){
          .sta-title{ font-size: 22px !important; }
          .sta-top-actions{ justify-content:flex-start; }
        }
      `}</style>

      {loading && (
        <div className="sta-loading">
          <div className="box">Please wait…</div>
        </div>
      )}

      <div className="sta-shell">
        <div className="sta-toolbar">
          <div className="sta-hero">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
              <div>
                <div className="sta-title h4 m-0">
                  Student Transport Assignments
                </div>
                <div className="sta-subtitle">
                  View each student's active pickup and drop bus directly in
                  the listing, manage assignments, filter student records, and
                  export the current transport details.
                </div>
              </div>

              <div className="sta-top-actions">
                <button
                  className="btn btn-outline-success sta-btn"
                  onClick={downloadAssignmentsExcel}
                  disabled={loading}
                >
                  Download Excel
                </button>
                <button
                  className="btn btn-outline-danger sta-btn"
                  onClick={downloadAssignmentsPdf}
                  disabled={loading}
                >
                  Download PDF
                </button>
                <button
                  className="btn btn-outline-secondary sta-btn"
                  onClick={refreshAll}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="row g-3 mt-1">
              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">Total Students</div>
                  <div className="sta-stat-value">{stats.totalStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat sta-stat-enabled">
                  <div className="sta-stat-label">Enabled</div>
                  <div className="sta-stat-value">{stats.enabledStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat sta-stat-disabled">
                  <div className="sta-stat-label">Disabled</div>
                  <div className="sta-stat-value">{stats.disabledStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">Filtered Result</div>
                  <div className="sta-stat-value">{stats.filteredStudents}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">Villages / Cities</div>
                  <div className="sta-stat-value">{stats.totalPlaces}</div>
                </div>
              </div>

              <div className="col-6 col-md-2">
                <div className="sta-stat">
                  <div className="sta-stat-label">Visible Bus Assigned</div>
                  <div className="sta-stat-value">
                    {assignmentListLoading ? "…" : stats.visibleBusAssignments}
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3 mt-1 sta-filter">
              <div className="col-md-3">
                <label className="form-label">Student Status</label>
                <select
                  className="form-select"
                  value={studentStatusFilter}
                  onChange={(e) => {
                    setStudentStatusFilter(e.target.value);
                    setVisibleCount(40);
                  }}
                >
                  <option value="all">All Students</option>
                  <option value="enabled">Enabled Only</option>
                  <option value="disabled">Disabled Only</option>
                </select>
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Filter by student enabled/disabled status.
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label">Filter by Village / City</label>
                <select
                  className="form-select"
                  value={selectedRouteFilterId}
                  onChange={(e) => {
                    setSelectedRouteFilterId(e.target.value);
                    setVisibleCount(40);
                  }}
                >
                  <option value="">All Villages / Cities</option>
                  {placeOptions.map((place) => (
                    <option key={place} value={place}>
                      {place}
                    </option>
                  ))}
                </select>
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Filter is based on the same village/city text shown in the
                  table.
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label">Search Student</label>
                <input
                  className="form-control"
                  placeholder="Search by student name or admission number..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setVisibleCount(40);
                  }}
                />
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Search works on name and admission number.
                </div>
              </div>

              <div className="col-md-2">
                <label className="form-label">Transport Status</label>
                <select
                  className="form-select"
                  value={transportStatusFilter}
                  onChange={(e) => {
                    setTransportStatusFilter(e.target.value);
                    setVisibleCount(40);
                  }}
                >
                  <option value="all">All</option>
                  <option value="with_transport">With Transport</option>
                  <option value="without_transport">Without Transport</option>
                </select>
                <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                  Filter by assigned transport.
                </div>
              </div>

              <div className="col-md-1 d-flex align-items-end">
                <button
                  className="btn btn-outline-dark sta-btn w-100"
                  onClick={clearFilters}
                  disabled={loading}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sta-card p-2 p-md-3">
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div
                className="h6 m-0"
                style={{ fontWeight: 800, color: "#213247" }}
              >
                Student List
              </div>
              <span className="sta-pill">
                Showing <b>{visibleStudents.length}</b> /{" "}
                {filteredStudents.length}
                <span style={{ opacity: 0.7 }}> / {students.length}</span>
              </span>
            </div>

            {filteredStudents.length > visibleCount && (
              <button
                className="btn btn-outline-primary sta-btn"
                onClick={() => setVisibleCount((v) => v + 40)}
                disabled={loading}
              >
                Show More
              </button>
            )}
          </div>

          <div className="table-responsive sta-table-wrap">
            <table className="table table-hover sta-table">
              <thead>
                <tr>
                  <th style={{ width: 60, minWidth: 60 }}>#</th>
                  <th className="sta-sticky-col sta-col-name">Student Name</th>
                  <th className="sta-sticky-col sta-col-admission">Admission No.</th>
                  <th style={{ width: 120 }}>Student Status</th>
                  <th style={{ width: 120 }}>Class</th>
                  <th style={{ width: 90 }}>Sec</th>
                  <th className="sta-bus-cell">Pickup Bus</th>
                  <th className="sta-bus-cell">Drop Bus</th>
                  <th style={{ width: 150 }}>Bus Assignment</th>
                  <th style={{ width: 125 }}>Effective From</th>
                  <th>Village / City</th>
                  <th style={{ width: 130 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleStudents.map((s, idx) => {
                  const studentStatus = getStudentStatus(s);
                  const activeAssignment = getListingAssignment(s.id);
                  const assignmentLoaded = activeAssignment !== undefined;
                  const busAssigned = hasActiveBusAssignment(s.id);

                  return (
                    <tr key={s.id} className="sta-row">
                      <td>{idx + 1}</td>
                      <td className="sta-sticky-col sta-col-name">
                        <div style={{ fontWeight: 800, color: "#1f2f45" }}>
                          {safeStr(s?.name) || "—"}
                        </div>
                      </td>
                      <td className="sta-sticky-col sta-col-admission">
                        {safeStr(s?.admission_number) || "—"}
                      </td>
                      <td>
                        <span
                          className={`sta-status-badge ${
                            studentStatus === "enabled"
                              ? "sta-status-enabled"
                              : studentStatus === "disabled"
                                ? "sta-status-disabled"
                                : "sta-status-unknown"
                          }`}
                        >
                          {studentStatus}
                        </span>
                      </td>
                      <td>{getClassName(s)}</td>
                      <td>{getSectionName(s)}</td>
                      <td className="sta-bus-cell">
                        <span
                          className={`sta-bus-label ${
                            !activeAssignment?.pickup_bus_id
                              ? "sta-bus-label-empty"
                              : ""
                          }`}
                        >
                          {!assignmentLoaded
                            ? "Loading…"
                            : findBusNo(activeAssignment?.pickup_bus_id)}
                        </span>
                      </td>
                      <td className="sta-bus-cell">
                        <span
                          className={`sta-bus-label ${
                            !activeAssignment?.drop_bus_id
                              ? "sta-bus-label-empty"
                              : ""
                          }`}
                        >
                          {!assignmentLoaded
                            ? "Loading…"
                            : findBusNo(activeAssignment?.drop_bus_id)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`sta-pill ${
                            busAssigned ? "" : "text-secondary"
                          }`}
                        >
                          {!assignmentLoaded
                            ? "Loading…"
                            : busAssigned
                              ? "Assigned"
                              : "Not Assigned"}
                        </span>
                      </td>
                      <td>{safeStr(activeAssignment?.start_date) || "—"}</td>
                      <td style={{ minWidth: 220 }}>
                        <span className="sta-route-chip">
                          {getStudentRouteDisplay(s)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-primary sta-btn-primary"
                          disabled={loading}
                          onClick={() => openAssignDialog(String(s.id))}
                        >
                          {busAssigned ? "Update Bus" : "Assign Bus"}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="12">
                      <div className="sta-empty">
                        <div className="sta-empty-title">No students found</div>
                        <div className="sta-empty-sub">
                          Try clearing filters or changing the student status,
                          village/city, or transport-status selection.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredStudents.length > visibleCount && (
            <div className="text-muted mt-2" style={{ fontSize: 12 }}>
              Showing first {visibleCount} records. Use <b>Show More</b> to load
              the next batch.
            </div>
          )}
        </div>
      </div>

      <AssignmentModal
        open={assignmentDialog.open}
        studentLabel={getStudentLabel(assignmentDialog.studentId)}
        buses={buses}
        current={assignmentDialog.current}
        saving={assignmentSaving}
        onClose={closeAssignmentDialog}
        onSubmit={saveTransportAssignment}
      />
    </div>
  );
};

export default StudentTransportAssignments;