// src/pages/Schools.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../api"; // Custom Axios instance
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
const esc = (v = "") => String(v).replace(/"/g, "&quot;");

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

  // ---------------- Modal HTML ----------------
  const getModalHtml = (school = {}) => `
    <style>
      .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .form-grid .full{grid-column:1 / -1}
      .form-label{font-weight:600;margin-bottom:4px}
      .form-field{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px}
      .preview-wrap{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}
      .preview-wrap img{width:100px;height:100px;object-fit:cover;border-radius:5px;border:1px solid #e5e7eb}
      .hint{font-size:12px;color:#6b7280}
    </style>

    <div class="form-grid">
      <div class="full">
        <label for="swal-name" class="form-label">School Name *</label>
        <input id="swal-name" class="form-field" placeholder="School Name" value="${esc(school.name)}">
      </div>

      <div class="full">
        <label for="swal-description" class="form-label">Description</label>
        <input id="swal-description" class="form-field" placeholder="Description" value="${esc(school.description)}">
      </div>

      <div>
        <label for="swal-phone" class="form-label">Phone</label>
        <input id="swal-phone" class="form-field" placeholder="Phone Number" value="${esc(school.phone)}">
      </div>

      <div>
        <label for="swal-email" class="form-label">Email</label>
        <input id="swal-email" class="form-field" placeholder="Email" value="${esc(school.email)}">
      </div>

      <div>
        <label for="swal-affiliation" class="form-label">Affiliation Code</label>
        <input id="swal-affiliation" class="form-field" placeholder="e.g. 730108" value="${esc(school.affiliation_code)}">
      </div>

      <div>
        <label for="swal-school-code" class="form-label">School Code</label>
        <input id="swal-school-code" class="form-field" placeholder="e.g. 23603" value="${esc(school.school_code)}">
      </div>

      <div>
        <label for="swal-telefax" class="form-label">Tele/Fax</label>
        <input id="swal-telefax" class="form-field" placeholder="e.g. 01923-234100" value="${esc(school.tele_fax)}">
      </div>

      <div>
        <label for="swal-website" class="form-label">Website</label>
        <input id="swal-website" class="form-field" placeholder="https://example.com" value="${esc(school.website)}">
      </div>

      <div class="full">
        <label for="swal-address" class="form-label">Address Line</label>
        <input id="swal-address" class="form-field" placeholder="Address Line" value="${esc(school.address_line)}">
      </div>

      <div>
        <label for="swal-logo" class="form-label">School Logo</label>
        <input type="file" id="swal-logo" class="form-field" accept="image/*">
        <div id="swal-logo-preview" class="preview-wrap">
          ${
            school.logo
              ? `<img src="${esc(toAbs(school.logo))}" alt="Logo Preview">`
              : `<span class="hint">No logo selected</span>`
          }
        </div>
      </div>

      <div>
        <label for="swal-board-logo" class="form-label">Board Logo (e.g., CBSE)</label>
        <input type="file" id="swal-board-logo" class="form-field" accept="image/*">
        <div id="swal-board-logo-preview" class="preview-wrap">
          ${
            school.board_logo
              ? `<img src="${esc(toAbs(school.board_logo))}" alt="Board Logo Preview">`
              : `<span class="hint">No board logo selected</span>`
          }
        </div>
      </div>
    </div>
  `;

  // ---------------- Add ----------------
  const handleAdd = async () => {
    let fileLogo = null;
    let fileBoardLogo = null;

    Swal.fire({
      title: "Add New School",
      width: "900px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: getModalHtml(),
      showCancelButton: true,
      confirmButtonText: "Add",
      didOpen: () => {
        const popup = Swal.getPopup();

        const logoInput = popup.querySelector("#swal-logo");
        const logoPreview = popup.querySelector("#swal-logo-preview");
        logoInput.addEventListener("change", (e) => {
          fileLogo = e.target.files[0];
          if (fileLogo) {
            const previewUrl = URL.createObjectURL(fileLogo);
            logoPreview.innerHTML = `<img src="${previewUrl}" alt="Logo Preview">`;
          } else {
            logoPreview.innerHTML = `<span class="hint">No logo selected</span>`;
          }
        });

        const boardInput = popup.querySelector("#swal-board-logo");
        const boardPreview = popup.querySelector("#swal-board-logo-preview");
        boardInput.addEventListener("change", (e) => {
          fileBoardLogo = e.target.files[0];
          if (fileBoardLogo) {
            const previewUrl = URL.createObjectURL(fileBoardLogo);
            boardPreview.innerHTML = `<img src="${previewUrl}" alt="Board Logo Preview">`;
          } else {
            boardPreview.innerHTML = `<span class="hint">No board logo selected</span>`;
          }
        });
      },
      preConfirm: () => {
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
          affiliation_code: p.querySelector("#swal-affiliation").value.trim(),
          school_code: p.querySelector("#swal-school-code").value.trim(),
          tele_fax: p.querySelector("#swal-telefax").value.trim(),
          website: p.querySelector("#swal-website").value.trim(),
          address_line: p.querySelector("#swal-address").value.trim(),
        };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const v = res.value;
          const formData = new FormData();
          formData.append("name", v.name);
          formData.append("description", v.description || "");
          formData.append("phone", v.phone || "");
          formData.append("email", v.email || "");
          formData.append("affiliation_code", v.affiliation_code || "");
          formData.append("school_code", v.school_code || "");
          formData.append("website", v.website || "");
          formData.append("tele_fax", v.tele_fax || "");
          formData.append("address_line", v.address_line || "");
          if (fileLogo) formData.append("logo", fileLogo);
          if (fileBoardLogo) formData.append("board_logo", fileBoardLogo);

          await api.post("/schools", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          Swal.fire("Added!", "School has been added successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Add school error:", err);
          Swal.fire("Error", err?.response?.data?.message || "Failed to add the school.", "error");
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
      width: "900px",
      allowOutsideClick: false,
      allowEscapeKey: false,
      html: getModalHtml(school),
      showCancelButton: true,
      confirmButtonText: "Update",
      didOpen: () => {
        const popup = Swal.getPopup();

        const logoInput = popup.querySelector("#swal-logo");
        const logoPreview = popup.querySelector("#swal-logo-preview");
        logoInput.addEventListener("change", (e) => {
          fileLogo = e.target.files[0];
          if (fileLogo) {
            const previewUrl = URL.createObjectURL(fileLogo);
            logoPreview.innerHTML = `<img src="${previewUrl}" alt="Logo Preview">`;
          } else {
            logoPreview.innerHTML = school.logo
              ? `<img src="${esc(toAbs(school.logo))}" alt="Logo Preview">`
              : `<span class="hint">No logo selected</span>`;
          }
        });

        const boardInput = popup.querySelector("#swal-board-logo");
        const boardPreview = popup.querySelector("#swal-board-logo-preview");
        boardInput.addEventListener("change", (e) => {
          fileBoardLogo = e.target.files[0];
          if (fileBoardLogo) {
            const previewUrl = URL.createObjectURL(fileBoardLogo);
            boardPreview.innerHTML = `<img src="${previewUrl}" alt="Board Logo Preview">`;
          } else {
            boardPreview.innerHTML = school.board_logo
              ? `<img src="${esc(toAbs(school.board_logo))}" alt="Board Logo Preview">`
              : `<span class="hint">No board logo selected</span>`;
          }
        });
      },
      preConfirm: () => {
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
          affiliation_code: p.querySelector("#swal-affiliation").value.trim(),
          school_code: p.querySelector("#swal-school-code").value.trim(),
          tele_fax: p.querySelector("#swal-telefax").value.trim(),
          website: p.querySelector("#swal-website").value.trim(),
          address_line: p.querySelector("#swal-address").value.trim(),
        };
      },
    }).then(async (res) => {
      if (res.isConfirmed) {
        try {
          const v = res.value;
          const formData = new FormData();
          formData.append("name", v.name);
          formData.append("description", v.description || "");
          formData.append("phone", v.phone || "");
          formData.append("email", v.email || "");
          formData.append("affiliation_code", v.affiliation_code || "");
          formData.append("school_code", v.school_code || "");
          formData.append("website", v.website || "");
          formData.append("tele_fax", v.tele_fax || "");
          formData.append("address_line", v.address_line || "");

          // only if a new file was selected
          if (fileLogo) formData.append("logo", fileLogo);
          if (fileBoardLogo) formData.append("board_logo", fileBoardLogo);

          await api.put(`/schools/${school.id}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          Swal.fire("Updated!", "School has been updated successfully.", "success");
          fetchSchools();
        } catch (err) {
          console.error("Update school error:", err);
          Swal.fire("Error", err?.response?.data?.message || "Failed to update the school.", "error");
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
          Swal.fire("Error", err?.response?.data?.message || "Failed to delete the school.", "error");
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
      (s.affiliation_code || "").toLowerCase().includes(q) ||
      (s.school_code || "").toLowerCase().includes(q) ||
      (s.website || "").toLowerCase().includes(q) ||
      (s.tele_fax || "").toLowerCase().includes(q) ||
      (s.address_line || "").toLowerCase().includes(q) ||
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
          placeholder="Search by name, code, website, phone, address..."
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
              <th>Affiliation</th>
              <th>School Code</th>
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
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "5px",
                        objectFit: "cover",
                        border: "1px solid #e5e7eb",
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
                      style={{
                        width: "50px",
                        height: "50px",
                        borderRadius: "5px",
                        objectFit: "cover",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  ) : (
                    "—"
                  )}
                </td>

                <td>
                  <div className="fw-semibold">{school.name}</div>
                  <div className="text-muted small">{school.description || "—"}</div>
                </td>
                <td>{school.affiliation_code || "—"}</td>
                <td>{school.school_code || "—"}</td>
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
                <td colSpan={canEdit ? 12 : 11} className="text-center">
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
