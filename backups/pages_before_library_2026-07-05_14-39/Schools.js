import React, { useState, useEffect, useMemo } from "react";
import api from "../api";
import Swal from "sweetalert2";
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
const esc = (v = "") => String(v ?? "").replace(/"/g, "&quot;");

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

  // ---------------- Fetch ----------------
  const fetchSchools = async () => {
    try {
      const response = await api.get("/schools");
      setSchools(extractSchools(response.data));
    } catch (error) {
      console.error("fetchSchools error:", error);
      Swal.fire("Error", "Failed to fetch schools.", "error");
    }
  };

  // ---------------- Modal HTML Bootstrap Only ----------------
  const getModalHtml = (school = {}) => `
    <div
      class="text-start"
      style="max-height:calc(100vh - 190px);overflow-y:auto;overflow-x:hidden;padding:2px 6px;"
    >
      <div class="card mb-3">
        <div class="card-header py-2 fw-semibold">
          Basic Details
        </div>

        <div class="card-body">
          <div class="row g-3">
            <div class="col-lg-4 col-md-6">
              <label for="swal-name" class="form-label fw-semibold">School Name *</label>
              <input
                id="swal-name"
                class="form-control form-control-sm"
                placeholder="School Name"
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

      <div class="card mb-3">
        <div class="card-header py-2 fw-semibold">
          School Meta
        </div>

        <div class="card-body">
          <div class="row g-3">
            <div class="col-lg-4 col-md-6">
              <label for="swal-affiliation" class="form-label fw-semibold">Affiliation Number</label>
              <input
                id="swal-affiliation"
                class="form-control form-control-sm"
                placeholder="e.g. 730108"
                value="${esc(school.affiliation_number)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-udise" class="form-label fw-semibold">UDISE Number</label>
              <input
                id="swal-udise"
                class="form-control form-control-sm"
                placeholder="e.g. 12345678901"
                value="${esc(school.udise_number)}"
              />
            </div>

            <div class="col-lg-4 col-md-6">
              <label for="swal-school-code" class="form-label fw-semibold">School Code</label>
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

            <div class="col-12">
              <label for="swal-address" class="form-label fw-semibold">Address Line</label>
              <input
                id="swal-address"
                class="form-control form-control-sm"
                placeholder="Address Line"
                value="${esc(school.address_line)}"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="card mb-1">
        <div class="card-header py-2 fw-semibold">
          Logos
        </div>

        <div class="card-body">
          <div class="row g-3 align-items-start">
            <div class="col-lg-6 col-md-6">
              <label for="swal-logo" class="form-label fw-semibold">School Logo</label>
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
              <label for="swal-board-logo" class="form-label fw-semibold">Board Logo</label>
              <input
                type="file"
                id="swal-board-logo"
                class="form-control form-control-sm"
                accept="image/*"
              />
              <div id="swal-board-logo-preview" class="d-flex align-items-center gap-2 mt-2">
                ${
                  school.board_logo
                    ? getPreviewHtml(school.board_logo, "Board Logo Preview")
                    : `<span class="text-muted small">No board logo selected</span>`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

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
              alt="Board Logo Preview"
              class="rounded border"
              style="width:64px;height:64px;object-fit:cover;"
            />
          `;
        } else {
          boardPreview.innerHTML = school.board_logo
            ? getPreviewHtml(school.board_logo, "Board Logo Preview")
            : `<span class="text-muted small">No board logo selected</span>`;
        }
      });
    }
  };

  const readModalValues = () => {
    const p = Swal.getPopup();

    const name = p.querySelector("#swal-name").value.trim();

    if (!name) {
      Swal.showValidationMessage("School Name is required");
      return false;
    }

    return {
      name,
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
    };
  };

  const appendSchoolFormData = ({ values, fileLogo, fileBoardLogo }) => {
    const formData = new FormData();

    formData.append("name", values.name);
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

    if (fileLogo) formData.append("logo", fileLogo);
    if (fileBoardLogo) formData.append("board_logo", fileBoardLogo);

    return formData;
  };

  // ---------------- Add ----------------
  const handleAdd = async () => {
    let fileLogo = null;
    let fileBoardLogo = null;

    Swal.fire({
      title: "Add New School",
      width: "1050px",
      heightAuto: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: getModalHtml(),
      showCancelButton: true,
      confirmButtonText: "Add",
      customClass: {
        popup: "p-3",
        htmlContainer: "m-0",
      },
      didOpen: () => {
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

          Swal.fire("Added!", "School has been added successfully.", "success");
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
      title: "Edit School",
      width: "1050px",
      heightAuto: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: getModalHtml(school),
      showCancelButton: true,
      confirmButtonText: "Update",
      customClass: {
        popup: "p-3",
        htmlContainer: "m-0",
      },
      didOpen: () => {
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

          Swal.fire("Updated!", "School has been updated successfully.", "success");
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

  const filtered = schools.filter((s) => {
    const q = search.toLowerCase();

    return (
      (s.name || "").toLowerCase().includes(q) ||
      (s.affiliation_number || "").toLowerCase().includes(q) ||
      (s.udise_number || "").toLowerCase().includes(q) ||
      (s.school_code || "").toLowerCase().includes(q) ||
      (s.website || "").toLowerCase().includes(q) ||
      (s.tele_fax || "").toLowerCase().includes(q) ||
      (s.address_line || "").toLowerCase().includes(q) ||
      (s.transport_display_label || "").toLowerCase().includes(q) ||
      (s.phone || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1>Schools Management</h1>

        {canEdit && (
          <button className="btn btn-success" onClick={handleAdd}>
            Add School
          </button>
        )}
      </div>

      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50"
          placeholder="Search by name, affiliation no, UDISE, school code, transport label, website, phone, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="table-responsive">
        <table className="table table-striped table-bordered align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Logo</th>
              <th>Board Logo</th>
              <th>Name & Description</th>
              <th>Affiliation Number</th>
              <th>UDISE Number</th>
              <th>School Code</th>
              <th>Transport Label</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Website</th>
              <th>Tele/Fax</th>
              <th>Address</th>
              {canEdit && <th style={{ minWidth: 150 }}>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {filtered.map((school, index) => (
              <tr key={school.id}>
                <td>{index + 1}</td>

                <td>
                  {school.logo ? (
                    <img
                      src={toAbs(school.logo)}
                      alt="School Logo"
                      className="rounded border"
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    "—"
                  )}
                </td>

                <td>
                  {school.board_logo ? (
                    <img
                      src={toAbs(school.board_logo)}
                      alt="Board Logo"
                      className="rounded border"
                      style={{
                        width: "50px",
                        height: "50px",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    "—"
                  )}
                </td>

                <td>
                  <div className="fw-semibold">{school.name}</div>
                  <div className="text-muted small">
                    {school.description || "—"}
                  </div>
                </td>

                <td>{school.affiliation_number || "—"}</td>
                <td>{school.udise_number || "—"}</td>
                <td>{school.school_code || "—"}</td>
                <td>{school.transport_display_label || "Transport"}</td>
                <td>{school.phone || "—"}</td>
                <td>{school.email || "—"}</td>

                <td>
                  {school.website ? (
                    <a
                      href={
                        school.website.startsWith("http")
                          ? school.website
                          : `https://${school.website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {school.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>

                <td>{school.tele_fax || "—"}</td>

                <td
                  style={{
                    maxWidth: 240,
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                  }}
                  title={school.address_line || ""}
                >
                  {school.address_line || "—"}
                </td>

                {canEdit && (
                  <td>
                    <button
                      className="btn btn-primary btn-sm me-2"
                      onClick={() => handleEdit(school)}
                    >
                      Edit
                    </button>

                    {isSuperadmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(school)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 14 : 13} className="text-center">
                  No schools found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Schools;