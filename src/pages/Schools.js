import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { publishInstitutionChange } from "../institution/InstitutionContext"; // GLOBAL_INSTITUTION_UI_V2
import "./Schools.css";

// ---------- helpers: roles ----------
const getRoleFlags = () => {
  const singleRole = localStorage.getItem("userRole");
  const multiRoles = JSON.parse(localStorage.getItem("roles") || "[]");
  const roles = multiRoles.length ? multiRoles : [singleRole].filter(Boolean);

  return {
    roles,
    isAdmin: roles.includes("admin"),
    isSuperadmin: roles.includes("superadmin"),
  };
};

// ---------- helpers: API base + absolute URL builder ----------
const apiBase = (() => {
  const fromAxios = api?.defaults?.baseURL || "";
  const fromEnv = process.env.REACT_APP_API_URL || "";
  const b = (fromAxios || fromEnv || "").trim();
  return b.replace(/\/+$/, "");
})();

const toAbs = (p) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/")) return `${apiBase}${p}`;
  return `${apiBase}/${p}`;
};

// safely handle array or { schools: [...] }
const extractSchools = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.schools)) return data.schools;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

// escape helper for inline HTML values
const esc = (v = "") => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const GOOGLE_MAPS_API_KEY = String(
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ""
).trim();
let schoolGoogleMapsPromise = null;

const loadGoogleMaps = () => {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (schoolGoogleMapsPromise) return schoolGoogleMapsPromise;
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(
      new Error("Google Maps API key is missing in the frontend configuration.")
    );
  }

  schoolGoogleMapsPromise = new Promise((resolve, reject) => {
    const finish = () =>
      window.google?.maps
        ? resolve(window.google)
        : reject(new Error("Google Maps could not be initialized."));
    const existing = [...document.scripts].find((script) =>
      String(script.src).includes("maps.googleapis.com/maps/api/js")
    );
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const callback = "__schoolGoogleMapsReady";
    window[callback] = () => {
      finish();
      delete window[callback];
    };
    const params = new URLSearchParams({
      key: GOOGLE_MAPS_API_KEY,
      callback,
      loading: "async",
      libraries: "places",
      region: "IN",
      language: "en",
      v: "weekly",
    });
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.onerror = () => {
      schoolGoogleMapsPromise = null;
      reject(new Error("Google Maps failed to load. Check API restrictions."));
    };
    document.head.appendChild(script);
  });
  return schoolGoogleMapsPromise;
};

const getTransportLabelForInput = (school = {}) => {
  const value = String(school?.transport_display_label || "").trim();
  return value || "Transport";
};

const getPreviewHtml = (src, alt = "Preview") => {
  if (!src) {
    return `<span class="text-muted small">No file selected</span>`;
  }

  return `
    <img
      src="${esc(toAbs(src))}"
      alt="${esc(alt)}"
      class="rounded border"
      style="width:64px;height:64px;object-fit:cover;"
    />
  `;
};

const Schools = () => {
  const { isAdmin, isSuperadmin } = useMemo(getRoleFlags, []);
  const canEdit = isAdmin || isSuperadmin;

  const [schools, setSchools] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ---------------- Fetch ----------------
  const fetchSchools = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await api.get("/schools");
      setSchools(extractSchools(response.data));
    } catch (error) {
      console.error("fetchSchools error:", error);
      setLoadError("Institutions could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Modal HTML Bootstrap Only ----------------
  const getModalHtml = (school = {}) => `
    <div class="institution-editor-intro">Keep your institution details up to date. Fields marked * are required.</div>
    <nav class="institution-editor-nav" aria-label="Jump to form section">
      <button type="button" data-editor-section="institution-basic">01 · Basic details</button>
      <button type="button" data-editor-section="institution-academic">02 · Academic details</button>
      <button type="button" data-editor-section="institution-location">03 · Location</button>
      <button type="button" data-editor-section="institution-branding">04 · Branding</button>
    </nav>
    <div class="institution-scroll-hint"><i class="bi bi-arrow-left-right"></i> Scroll horizontally to see all sections. Your changes stay in this form.</div>
    <div class="text-start school-editor" tabindex="0" role="region" aria-label="Institution form sections, scroll horizontally">
      <div class="card institution-editor-panel" id="institution-basic">
        <div class="card-header py-2 fw-semibold">
          <span>01</span> Basic details
        </div>

        <div class="card-body">
          <div class="row g-3">
            <div class="col-lg-4 col-md-6">
              <label for="swal-institution-type" class="form-label fw-semibold">Institution Type *</label>
              <select id="swal-institution-type" class="form-select form-select-sm">
                <option value="school" ${String(school.institution_type || "school").toLowerCase() === "school" ? "selected" : ""}>School</option>
                <option value="college" ${String(school.institution_type || "school").toLowerCase() === "college" ? "selected" : ""}>College</option>
              </select>
            </div>
            <div class="col-lg-4 col-md-6">
              <label for="swal-name" class="form-label fw-semibold">Institution Name *</label>
              <input
                id="swal-name"
                class="form-control form-control-sm"
                placeholder="Institution Name"
                value="${esc(school.name)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-phone" class="form-label fw-semibold">Phone</label>
              <input
                id="swal-phone"
                class="form-control form-control-sm"
                placeholder="Phone Number"
                value="${esc(school.phone)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-email" class="form-label fw-semibold">Email</label>
              <input
                id="swal-email"
                class="form-control form-control-sm"
                placeholder="Email"
                value="${esc(school.email)}"
              />
            </div>

            <div class="col-12">
              <label for="swal-description" class="form-label fw-semibold">Description</label>
              <input
                id="swal-description"
                class="form-control form-control-sm"
                placeholder="Description"
                value="${esc(school.description)}"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="card institution-editor-panel" id="institution-academic">
        <div class="card-header py-2 fw-semibold">
          <span>02</span> Academic & regulatory
        </div>

        <div class="card-body">
          <div class="row g-3">
            <div class="col-lg-4 col-md-6">
              <label for="swal-affiliation" class="form-label fw-semibold">Affiliation / University Ref.</label>
              <input
                id="swal-affiliation"
                class="form-control form-control-sm"
                placeholder="e.g. 730108"
                value="${esc(school.affiliation_number)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-udise" class="form-label fw-semibold">UDISE / AISHE Number</label>
              <input
                id="swal-udise"
                class="form-control form-control-sm"
                placeholder="e.g. 12345678901"
                value="${esc(school.udise_number)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-school-code" class="form-label fw-semibold">Institution Code</label>
              <input
                id="swal-school-code"
                class="form-control form-control-sm"
                placeholder="e.g. 23603"
                value="${esc(school.school_code)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-telefax" class="form-label fw-semibold">Tele/Fax</label>
              <input
                id="swal-telefax"
                class="form-control form-control-sm"
                placeholder="e.g. 01923-234100"
                value="${esc(school.tele_fax)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-website" class="form-label fw-semibold">Website</label>
              <input
                id="swal-website"
                class="form-control form-control-sm"
                placeholder="https://example.com"
                value="${esc(school.website)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-transport-label" class="form-label fw-semibold">
                Transport Display Label
              </label>
              <input
                id="swal-transport-label"
                class="form-control form-control-sm"
                placeholder="Bus Fee / Conveyance Fee"
                value="${esc(getTransportLabelForInput(school))}"
              />
              <div class="form-text">
                Blank means default Transport.
              </div>
            </div>

          </div>
        </div>
      </div>

      <section class="card institution-editor-panel" id="institution-location" aria-labelledby="institution-location-heading">
        <div class="card-header" id="institution-location-heading"><span>03</span> Location & attendance</div>
        <div class="card-body"><div class="row g-3">
            <div class="col-12">
              <label for="swal-address" class="form-label fw-semibold">Address Line</label>
              <input
                id="swal-address"
                class="form-control form-control-sm"
                placeholder="Address Line"
                value="${esc(school.address_line)}"
              />
            </div>
            <div class="col-12">
              <div class="school-map-heading">
                <div>
                  <label for="swal-map-search" class="form-label fw-semibold mb-1">
                    Pick Institution Address from Google Maps
                  </label>
                  <div class="text-muted small">Search, click the map, or drag the marker.</div>
                </div>
                <button id="swal-current-location" type="button" class="btn btn-sm btn-primary">
                  <i class="bi bi-crosshair me-1"></i> Current location
                </button>
              </div>
              <div class="school-map-search-wrap">
                <i class="bi bi-search"></i>
                <input
                  id="swal-map-search"
                  class="form-control"
                  placeholder="Search institution, street, landmark or address"
                  autocomplete="off"
                />
              </div>
              <div class="school-map-shell">
                <div id="swal-school-map"></div>
                <div id="swal-map-loading" class="school-map-loading">
                  <span class="spinner-border spinner-border-sm me-2"></span>
                  Loading Google Maps…
                </div>
              </div>
              <div class="school-map-footer">
                <span id="swal-map-coordinates" class="text-muted small">
                  ${school.latitude && school.longitude
                    ? `<i class="bi bi-geo-alt-fill text-danger me-1"></i>${esc(school.latitude)}, ${esc(school.longitude)}`
                    : '<i class="bi bi-geo-alt me-1"></i>No location selected'}
                </span>
                <span class="badge text-bg-light border">Google Maps</span>
              </div>
              <input id="swal-latitude" type="hidden" value="${esc(school.latitude)}" />
              <input id="swal-longitude" type="hidden" value="${esc(school.longitude)}" />
            </div>
            <div class="col-lg-4 col-md-6">
              <label for="swal-attendance-radius" class="form-label fw-semibold">
                Attendance Radius (metres)
              </label>
              <input
                id="swal-attendance-radius"
                type="number"
                min="25"
                max="5000"
                class="form-control form-control-sm"
                value="${esc(school.attendance_radius_meters || 150)}"
              />
            </div>
        </div></div>
      </section>

      <div class="card institution-editor-panel" id="institution-branding">
        <div class="card-header py-2 fw-semibold">
          <span>04</span> Institution branding
        </div>

        <div class="card-body">
          <div class="row g-3 align-items-start">
            <div class="col-lg-6 col-md-6">
              <label for="swal-logo" class="form-label fw-semibold">Institution Logo</label>
              <input
                type="file"
                id="swal-logo"
                class="form-control form-control-sm"
                accept="image/*"
              />
              <div id="swal-logo-preview" class="d-flex align-items-center gap-2 mt-2">
                ${
                  school.logo
                    ? getPreviewHtml(school.logo, "Logo Preview")
                    : `<span class="text-muted small">No logo selected</span>`
                }
              </div>
            </div>

            <div class="col-lg-6 col-md-6">
              <label for="swal-board-logo" class="form-label fw-semibold">Board / University Logo</label>
              <input
                type="file"
                id="swal-board-logo"
                class="form-control form-control-sm"
                accept="image/*"
              />
              <div id="swal-board-logo-preview" class="d-flex align-items-center gap-2 mt-2">
                ${
                  school.board_logo
                    ? getPreviewHtml(school.board_logo, "Board / University Logo Preview")
                    : `<span class="text-muted small">No board logo selected</span>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const bindEditorNavigation = () => {
    const popup = Swal.getPopup();
    popup.querySelectorAll("[data-editor-section]").forEach((button) => {
      button.addEventListener("click", () => {
        const panel = popup.querySelector(`#${button.dataset.editorSection}`);
        panel?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
        panel?.querySelector("input:not([type=hidden]), select, button")?.focus({ preventScroll: true });
      });
    });
  };

  const bindLogoPreviewEvents = ({ school = {}, setFileLogo, setFileBoardLogo }) => {
    const popup = Swal.getPopup();
    if (!popup) return;

    const logoInput = popup.querySelector("#swal-logo");
    const logoPreview = popup.querySelector("#swal-logo-preview");

    if (logoInput && logoPreview) {
      logoInput.addEventListener("change", (e) => {
        const selected = e.target.files?.[0] || null;
        setFileLogo(selected);

        if (selected) {
          const previewUrl = URL.createObjectURL(selected);
          logoPreview.innerHTML = `
            <img
              src="${previewUrl}"
              alt="Logo Preview"
              class="rounded border"
              style="width:64px;height:64px;object-fit:cover;"
            />
          `;
        } else {
          logoPreview.innerHTML = school.logo
            ? getPreviewHtml(school.logo, "Logo Preview")
            : `<span class="text-muted small">No logo selected</span>`;
        }
      });
    }

    const boardInput = popup.querySelector("#swal-board-logo");
    const boardPreview = popup.querySelector("#swal-board-logo-preview");

    if (boardInput && boardPreview) {
      boardInput.addEventListener("change", (e) => {
        const selected = e.target.files?.[0] || null;
        setFileBoardLogo(selected);

        if (selected) {
          const previewUrl = URL.createObjectURL(selected);
          boardPreview.innerHTML = `
            <img
              src="${previewUrl}"
              alt="Board / University Logo Preview"
              class="rounded border"
              style="width:64px;height:64px;object-fit:cover;"
            />
          `;
        } else {
          boardPreview.innerHTML = school.board_logo
            ? getPreviewHtml(school.board_logo, "Board / University Logo Preview")
            : `<span class="text-muted small">No board logo selected</span>`;
        }
      });
    }
  };

  const bindSchoolMap = async (school = {}) => {
    const popup = Swal.getPopup();
    const mapElement = popup?.querySelector("#swal-school-map");
    if (!mapElement) return;
    try {
      await loadGoogleMaps();
      let placesLibrary = window.google?.maps?.places;
      if (window.google?.maps?.importLibrary) {
        const libraries = await Promise.all([
          window.google.maps.importLibrary("maps"),
          window.google.maps.importLibrary("places"),
        ]);
        placesLibrary = libraries[1];
      }
      if (!Swal.isVisible()) return;
      const hasCoordinateValues =
        school.latitude !== null &&
        school.latitude !== undefined &&
        String(school.latitude).trim() !== "" &&
        school.longitude !== null &&
        school.longitude !== undefined &&
        String(school.longitude).trim() !== "";
      const savedLat = Number(school.latitude);
      const savedLng = Number(school.longitude);
      const hasSaved =
        hasCoordinateValues &&
        Number.isFinite(savedLat) &&
        savedLat >= -90 &&
        savedLat <= 90 &&
        Number.isFinite(savedLng) &&
        savedLng >= -180 &&
        savedLng <= 180;
      const initialPosition = hasSaved
        ? { lat: savedLat, lng: savedLng }
        : { lat: 22.9734, lng: 78.6569 };
      const map = new window.google.maps.Map(mapElement, {
        center: initialPosition,
        zoom: hasSaved ? 17 : 12,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      const geocoder = new window.google.maps.Geocoder();
      const marker = new window.google.maps.Marker({
        map: hasSaved ? map : null,
        position: initialPosition,
        draggable: true,
        title: "Drag to adjust the school location",
        animation: hasSaved ? null : window.google.maps.Animation.DROP,
      });
      const radiusCircle = new window.google.maps.Circle({
        map: hasSaved ? map : null,
        center: initialPosition,
        radius: Number(school.attendance_radius_meters || 150),
        fillColor: "#2563eb",
        fillOpacity: 0.13,
        strokeColor: "#2563eb",
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
      popup.querySelector("#swal-map-loading")?.remove();

      const setAddress = (address) => {
        const field = popup.querySelector("#swal-address");
        if (field && address) field.value = address;
      };
      const reverseGeocode = (position) => {
        geocoder.geocode({ location: position }, (results, status) => {
          if (status === "OK" && results?.[0]?.formatted_address) {
            setAddress(results[0].formatted_address);
          }
        });
      };
      const setLocation = (lat, lng, options = {}) => {
        const position = { lat: Number(lat), lng: Number(lng) };
        popup.querySelector("#swal-latitude").value = lat.toFixed(7);
        popup.querySelector("#swal-longitude").value = lng.toFixed(7);
        popup.querySelector("#swal-map-coordinates").innerHTML =
          `<i class="bi bi-geo-alt-fill text-danger me-1"></i>${lat.toFixed(7)}, ${lng.toFixed(7)}`;
        marker.setPosition(position);
        marker.setMap(map);
        radiusCircle.setCenter(position);
        radiusCircle.setMap(map);
        if (options.address) setAddress(options.address);
        else if (options.reverse !== false) reverseGeocode(position);
        if (options.zoom !== false) {
          map.setCenter(position);
          map.setZoom(17);
        }
      };
      map.addListener("click", (event) => {
        if (event.latLng) {
          setLocation(event.latLng.lat(), event.latLng.lng(), { zoom: false });
        }
      });
      marker.addListener("dragend", () => {
        const position = marker.getPosition();
        if (position) setLocation(position.lat(), position.lng(), { zoom: false });
      });

      const searchWrap = popup.querySelector(".school-map-search-wrap");
      const searchInput = popup.querySelector("#swal-map-search");
      const PlaceAutocompleteElement =
        placesLibrary?.PlaceAutocompleteElement ||
        window.google.maps.places?.PlaceAutocompleteElement;

      if (searchWrap && PlaceAutocompleteElement) {
        searchWrap.innerHTML = "";
        const autocompleteElement = new PlaceAutocompleteElement({
          includedRegionCodes: ["in"],
          placeholder: "Search school, street, landmark or address",
          requestedRegion: "IN",
        });
        autocompleteElement.id = "swal-map-search";
        autocompleteElement.style.width = "100%";
        autocompleteElement.style.display = "block";
        autocompleteElement.addEventListener("gmp-select", async (event) => {
          try {
            const prediction = event?.placePrediction;
            if (!prediction) return;
            const place = prediction.toPlace();
            await place.fetchFields({
              fields: ["displayName", "formattedAddress", "location"],
            });
            const location = place.location;
            if (!location) return;
            Swal.resetValidationMessage();
            setLocation(location.lat(), location.lng(), {
              address: place.formattedAddress || place.displayName || "",
            });
          } catch (error) {
            console.error("School place selection error:", error);
            Swal.showValidationMessage(
              "The selected address could not be loaded. Please try again."
            );
          }
        });
        autocompleteElement.addEventListener("gmp-error", () => {
          Swal.showValidationMessage(
            "Address suggestions are unavailable. Check that Places API (New) is enabled."
          );
        });
        searchWrap.appendChild(autocompleteElement);
      } else if (searchInput && window.google.maps.places?.Autocomplete) {
        const autocomplete = new window.google.maps.places.Autocomplete(
          searchInput,
          {
            componentRestrictions: { country: "in" },
            fields: ["formatted_address", "geometry", "name"],
          }
        );
        autocomplete.bindTo("bounds", map);
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place?.geometry?.location;
          if (!location) {
            Swal.showValidationMessage("Please choose an address from the suggestions");
            return;
          }
          Swal.resetValidationMessage();
          setLocation(location.lat(), location.lng(), {
            address: place.formatted_address || place.name,
          });
        });
      }

      popup
        .querySelector("#swal-attendance-radius")
        ?.addEventListener("input", (event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value >= 25 && value <= 5000) {
            radiusCircle.setRadius(value);
          }
        });
      popup
        .querySelector("#swal-current-location")
        ?.addEventListener("click", (event) => {
          if (!navigator.geolocation) {
            Swal.showValidationMessage("Location is not supported by this browser");
            return;
          }
          const button = event.currentTarget;
          button.disabled = true;
          button.innerHTML =
            '<span class="spinner-border spinner-border-sm me-1"></span> Locating…';
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation(position.coords.latitude, position.coords.longitude);
              button.disabled = false;
              button.innerHTML =
                '<i class="bi bi-crosshair me-1"></i> Current location';
            },
            () => {
              Swal.showValidationMessage("Unable to get current location");
              button.disabled = false;
              button.innerHTML =
                '<i class="bi bi-crosshair me-1"></i> Current location';
            },
            { enableHighAccuracy: true, timeout: 15000 }
          );
        });
    } catch (error) {
      mapElement.innerHTML = `<div class="school-map-error">
        <i class="bi bi-map fs-2"></i>
        <div>${esc(error?.message || "Google Maps could not be loaded.")}</div>
      </div>`;
      popup?.querySelector("#swal-map-loading")?.remove();
    }
  };

  const readModalValues = () => {
    const p = Swal.getPopup();

    const name = p.querySelector("#swal-name").value.trim();

    if (!name) {
      p.querySelector("#swal-name").focus();
      Swal.showValidationMessage("Institution Name is required");
      return false;
    }

    const latitude = p.querySelector("#swal-latitude").value.trim();
    const longitude = p.querySelector("#swal-longitude").value.trim();
    const attendanceRadius = Number(
      p.querySelector("#swal-attendance-radius").value
    );
    if ((latitude && !longitude) || (!latitude && longitude)) {
      Swal.showValidationMessage("Please select a complete institution location");
      return false;
    }
    if (!Number.isInteger(attendanceRadius) || attendanceRadius < 25 || attendanceRadius > 5000) {
      p.querySelector("#swal-attendance-radius").focus();
      Swal.showValidationMessage("Attendance radius must be between 25 and 5000 metres");
      return false;
    }

    return {
      name,
      institution_type: p.querySelector("#swal-institution-type").value,
      description: p.querySelector("#swal-description").value.trim(),
      phone: p.querySelector("#swal-phone").value.trim(),
      email: p.querySelector("#swal-email").value.trim(),
      affiliation_number: p.querySelector("#swal-affiliation").value.trim(),
      udise_number: p.querySelector("#swal-udise").value.trim(),
      school_code: p.querySelector("#swal-school-code").value.trim(),
      tele_fax: p.querySelector("#swal-telefax").value.trim(),
      website: p.querySelector("#swal-website").value.trim(),
      transport_display_label: p
        .querySelector("#swal-transport-label")
        .value.trim(),
      address_line: p.querySelector("#swal-address").value.trim(),
      latitude,
      longitude,
      attendance_radius_meters: attendanceRadius,
    };
  };

  const appendSchoolFormData = ({ values, fileLogo, fileBoardLogo }) => {
    const formData = new FormData();

    formData.append("name", values.name);
    formData.append("institution_type", values.institution_type || "school");
    formData.append("description", values.description || "");
    formData.append("phone", values.phone || "");
    formData.append("email", values.email || "");
    formData.append("affiliation_number", values.affiliation_number || "");
    formData.append("udise_number", values.udise_number || "");
    formData.append("school_code", values.school_code || "");
    formData.append("website", values.website || "");
    formData.append("tele_fax", values.tele_fax || "");
    formData.append("transport_display_label", values.transport_display_label || "");
    formData.append("address_line", values.address_line || "");
    formData.append("latitude", values.latitude || "");
    formData.append("longitude", values.longitude || "");
    formData.append(
      "attendance_radius_meters",
      String(values.attendance_radius_meters || 150)
    );

    if (fileLogo) formData.append("logo", fileLogo);
    if (fileBoardLogo) formData.append("board_logo", fileBoardLogo);

    return formData;
  };

  // ---------------- Add ----------------
  const handleAdd = async () => {
    let fileLogo = null;
    let fileBoardLogo = null;

    Swal.fire({
      title: "Add New Institution",
      width: "min(1480px, calc(100vw - 32px))",
      heightAuto: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: true,
      html: getModalHtml(),
      showCancelButton: true,
      confirmButtonText: "Create institution",
      customClass: {
        popup: "institution-editor-popup",
        htmlContainer: "institution-editor-content",
        actions: "institution-editor-actions",
        confirmButton: "institution-save-button",
      },
      didOpen: () => {
        bindEditorNavigation();
        bindSchoolMap({});
        bindLogoPreviewEvents({
          school: {},
          setFileLogo: (file) => {
            fileLogo = file;
          },
          setFileBoardLogo: (file) => {
            fileBoardLogo = file;
          },
        });
      },
      preConfirm: readModalValues,
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const formData = appendSchoolFormData({
            values: res.value,
            fileLogo,
            fileBoardLogo,
          });

          await api.post("/schools", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          Swal.fire("Added!", "Institution has been added successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Add school error:", err);
          Swal.fire(
            "Error",
            err?.response?.data?.message || "Failed to add the school.",
            "error"
          );
        }
      }
    });
  };

  // ---------------- Edit ----------------
  const handleEdit = async (school) => {
    let fileLogo = null;
    let fileBoardLogo = null;

    Swal.fire({
      title: "Edit Institution",
      width: "min(1480px, calc(100vw - 32px))",
      heightAuto: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCloseButton: true,
      html: getModalHtml(school),
      showCancelButton: true,
      confirmButtonText: "Save changes",
      customClass: {
        popup: "institution-editor-popup",
        htmlContainer: "institution-editor-content",
        actions: "institution-editor-actions",
        confirmButton: "institution-save-button",
      },
      didOpen: () => {
        bindEditorNavigation();
        bindSchoolMap(school);
        bindLogoPreviewEvents({
          school,
          setFileLogo: (file) => {
            fileLogo = file;
          },
          setFileBoardLogo: (file) => {
            fileBoardLogo = file;
          },
        });
      },
      preConfirm: readModalValues,
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const formData = appendSchoolFormData({
            values: res.value,
            fileLogo,
            fileBoardLogo,
          });

          await api.put(`/schools/${school.id}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });

          // GLOBAL_INSTITUTION_UI_V2: switch the whole protected UI immediately.
          publishInstitutionChange({
            id: school.id,
            institution_type: res.value?.institution_type || school.institution_type || "school",
            name: res.value?.name || school.name,
          });

          Swal.fire("Updated!", "Institution has been updated successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Update school error:", err);
          Swal.fire(
            "Error",
            err?.response?.data?.message || "Failed to update the school.",
            "error"
          );
        }
      }
    });
  };

  // ---------------- Delete (Superadmin only) ----------------
  const handleDelete = async (school) => {
    if (!isSuperadmin) {
      return Swal.fire("Forbidden", "Only Super Admin can delete.", "warning");
    }

    Swal.fire({
      title: "Are you sure?",
      text: `You are about to delete "${school.name}". This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete it!",
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          await api.delete(`/schools/${school.id}`);
          Swal.fire("Deleted!", "School has been deleted successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Delete school error:", err);
          Swal.fire(
            "Error",
            err?.response?.data?.message || "Failed to delete the school.",
            "error"
          );
        }
      }
    });
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const filtered = schools.filter((school) => {
    const query = search.trim().toLowerCase();
    return ["name", "institution_type", "description", "affiliation_number", "udise_number",
      "school_code", "website", "tele_fax", "address_line", "transport_display_label", "phone", "email"]
      .some((key) => String(school[key] || (key === "institution_type" ? "school" : "")).toLowerCase().includes(query));
  });

  const detail = (label, value) => <div className="institution-detail" key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>;


  return (
    <main className="institutions-page">
      <header className="institutions-header">
        <div>
          <span className="institutions-eyebrow"><i className="bi bi-buildings" aria-hidden="true" /> INSTITUTION WORKSPACE</span>
          <h1>Institutions</h1>
          <p>Manage your identity, academic details and campus information in one place.</p>
        </div>
        {canEdit && <button className="btn btn-primary institution-add" onClick={handleAdd}><i className="bi bi-plus-lg" aria-hidden="true" /> Add institution</button>}
      </header>
      <div className="institutions-toolbar">
        <label className="institutions-search"><i className="bi bi-search" aria-hidden="true" /><input type="search" aria-label="Search institutions" placeholder="Search name, type, code or contact…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="institutions-toolbar-actions"><span aria-live="polite">{loading ? "Loading…" : `${filtered.length} of ${schools.length} institutions`}</span><button className="btn btn-light" onClick={fetchSchools} disabled={loading} aria-label="Refresh institutions"><i className="bi bi-arrow-clockwise" aria-hidden="true" /></button></div>
      </div>
      <div className="institution-scroll-hint"><i className="bi bi-arrow-left-right" aria-hidden="true" /> Scroll inside a profile to view every section.</div>
      <div className="institutions-directory" aria-busy={loading}>
        {loadError ? <div className="institutions-empty" role="alert"><i className="bi bi-exclamation-circle" /><h2>Unable to load institutions</h2><p>{loadError}</p><button className="btn btn-primary" onClick={fetchSchools}>Try again</button></div>
          : loading ? <div className="institutions-empty" role="status"><span className="spinner-border text-primary" /><p>Loading institution profiles…</p></div>
          : filtered.length === 0 ? <div className="institutions-empty"><i className="bi bi-buildings" /><h2>{search ? "No matching institutions" : "No institutions yet"}</h2><p>{search ? "Try a different name, type or institution code." : "Add an institution to start building its profile."}</p>{search && <button className="btn btn-outline-primary" onClick={() => setSearch("")}>Clear search</button>}</div>
          : filtered.map((school) => (
            <article className="institution-profile" key={school.id}>
              <header className="institution-profile-header">
                <div className="institution-identity">
                  <div className="institution-avatar">{school.logo ? <img src={toAbs(school.logo)} alt={`${school.name} logo`} /> : <i className="bi bi-building" aria-hidden="true" />}</div>
                  <div><div className="institution-title-line"><h2>{school.name}</h2><span className={`institution-type ${school.institution_type === "college" ? "is-college" : ""}`}>{String(school.institution_type || "school").toLowerCase() === "college" ? "College" : "School"}</span></div><p>{school.description || "Institution profile & settings"}</p></div>
                </div>
                {canEdit && <div className="institution-profile-actions"><button className="btn btn-outline-primary" onClick={() => handleEdit(school)} aria-label={`Edit ${school.name}`}><i className="bi bi-pencil-square" aria-hidden="true" /> Edit profile</button>{isSuperadmin && <button className="btn institution-delete" onClick={() => handleDelete(school)} aria-label={`Delete ${school.name}`}><i className="bi bi-trash3" aria-hidden="true" /></button>}</div>}
              </header>
              <div className="institution-profile-sections" tabIndex={0} role="region" aria-label={`${school.name} details, scroll horizontally`}>
                <section className="institution-info-panel"><h3><i className="bi bi-person-lines-fill" aria-hidden="true" /> Contact details</h3><dl>{detail("Phone", school.phone)}{detail("Email", school.email)}{detail("Website", school.website ? <a href={/^https?:\/\//i.test(school.website) ? school.website : `https://${school.website}`} target="_blank" rel="noreferrer">{school.website}<i className="bi bi-arrow-up-right ms-1" aria-hidden="true" /></a> : null)}{detail("Tele / Fax", school.tele_fax)}</dl></section>
                <section className="institution-info-panel"><h3><i className="bi bi-mortarboard" aria-hidden="true" /> Academic details</h3><dl>{detail("Institution code", school.school_code)}{detail("Affiliation / University ref.", school.affiliation_number)}{detail("UDISE / AISHE number", school.udise_number)}{detail("Transport display label", school.transport_display_label || "Transport")}</dl></section>
                <section className="institution-info-panel"><h3><i className="bi bi-geo-alt" aria-hidden="true" /> Campus location</h3><dl>{detail("Address", school.address_line)}{detail("Coordinates", school.latitude != null && school.longitude != null && school.latitude !== "" && school.longitude !== "" ? `${school.latitude}, ${school.longitude}` : null)}{detail("Attendance radius", `${school.attendance_radius_meters || 150} metres`)}</dl></section>
                <section className="institution-info-panel institution-branding-panel"><h3><i className="bi bi-palette" aria-hidden="true" /> Branding</h3><div className="institution-logos">{[["Institution logo", school.logo], ["Board / University logo", school.board_logo]].map(([label, src]) => <div key={label}><div className="institution-logo-preview">{src ? <img src={toAbs(src)} alt={label} /> : <span>No logo</span>}</div><span>{label}</span></div>)}</div></section>
              </div>
            </article>
          ))}
      </div>
    </main>
  );
};

export default Schools;
