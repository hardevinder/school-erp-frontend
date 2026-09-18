import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "bootstrap/dist/css/bootstrap.min.css";

const defaultFormData = {
  id: null,
  name: "",
  abbreviation: "",
  max_marks: "",
  component_type: "MARKS",
  is_internal: false,
  scholastic_type: "Scholastic",
  is_practical: false,
  is_active: true,
};

const AssessmentComponentManagement = () => {
  const [components, setComponents] = useState([]);
  const [formData, setFormData] = useState(defaultFormData);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [natureFilter, setNatureFilter] = useState("ALL");
  const [academicFilter, setAcademicFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredComponents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return components.filter((component) => {
      const matchesSearch =
        !query ||
        String(component.name || "").toLowerCase().includes(query) ||
        String(component.abbreviation || "").toLowerCase().includes(query);
      const matchesType =
        typeFilter === "ALL" || component.component_type === typeFilter;
      const matchesNature =
        natureFilter === "ALL" ||
        (natureFilter === "INTERNAL" && Boolean(component.is_internal)) ||
        (natureFilter === "EXTERNAL" && !component.is_internal);
      const matchesAcademic =
        academicFilter === "ALL" ||
        (component.scholastic_type || "Scholastic") === academicFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && Boolean(component.is_active)) ||
        (statusFilter === "INACTIVE" && !component.is_active);

      return (
        matchesSearch &&
        matchesType &&
        matchesNature &&
        matchesAcademic &&
        matchesStatus
      );
    });
  }, [components, search, typeFilter, natureFilter, academicFilter, statusFilter]);

  useEffect(() => {
    fetchComponents();
  }, []);

  const fetchComponents = async () => {
    try {
      const res = await api.get("/assessment-components");
      setComponents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch components:", err);
      Swal.fire("Error", "Failed to fetch components", "error");
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    let val = type === "checkbox" ? checked : value;

    if (name === "is_internal" && type !== "checkbox") {
      val = value === "INTERNAL";
    }

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: val,
      };

      // Grade based components do not need max marks
      if (name === "component_type" && value === "GRADE") {
        updated.max_marks = 0;
      }

      return updated;
    });
  };

  const handleEdit = (comp) => {
    setFormData({
      id: comp.id,
      name: comp.name || "",
      abbreviation: comp.abbreviation || "",
      max_marks:
        comp.component_type === "GRADE"
          ? 0
          : comp.max_marks !== null && comp.max_marks !== undefined
          ? comp.max_marks
          : "",
      component_type: comp.component_type || "MARKS",
      is_internal: Boolean(comp.is_internal),
      scholastic_type: comp.scholastic_type || "Scholastic",
      is_practical: Boolean(comp.is_practical),
      is_active:
        comp.is_active === undefined || comp.is_active === null
          ? true
          : Boolean(comp.is_active),
    });

    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReset = () => {
    setFormData(defaultFormData);
    setIsEditing(false);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      Swal.fire("Warning", "Component name is required", "warning");
      return false;
    }

    if (!formData.abbreviation.trim()) {
      Swal.fire("Warning", "Abbreviation is required", "warning");
      return false;
    }

    if (!["MARKS", "GRADE"].includes(formData.component_type)) {
      Swal.fire("Warning", "Please select a valid component type", "warning");
      return false;
    }

    if (!["Scholastic", "Co-Scholastic"].includes(formData.scholastic_type)) {
      Swal.fire("Warning", "Please select Scholastic or Co-Scholastic", "warning");
      return false;
    }

    if (formData.component_type === "MARKS") {
      if (
        formData.max_marks === "" ||
        formData.max_marks === null ||
        formData.max_marks === undefined
      ) {
        Swal.fire("Warning", "Max marks are required for marks-based component", "warning");
        return false;
      }

      const maxMarks = Number(formData.max_marks);

      if (Number.isNaN(maxMarks) || maxMarks < 0) {
        Swal.fire("Warning", "Max marks must be a valid number", "warning");
        return false;
      }
    }

    return true;
  };

  const buildPayload = () => {
    const isGrade = formData.component_type === "GRADE";

    return {
      name: formData.name.trim(),
      abbreviation: formData.abbreviation.trim(),
      component_type: formData.component_type,
      max_marks: isGrade ? 0 : Number(formData.max_marks || 0),
      is_internal: Boolean(formData.is_internal),
      scholastic_type: formData.scholastic_type,
      is_practical: Boolean(formData.is_practical),
      is_active: Boolean(formData.is_active),
    };
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const payload = buildPayload();

      if (isEditing) {
        await api.put(`/assessment-components/${formData.id}`, payload);
        Swal.fire("Success", "Component updated successfully", "success");
      } else {
        await api.post("/assessment-components", payload);
        Swal.fire("Success", "Component created successfully", "success");
      }

      handleReset();
      fetchComponents();
    } catch (err) {
      console.error("Failed to save component:", err);
      Swal.fire(
        "Error",
        err?.response?.data?.message || "Failed to save component",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: "Deactivate this component?",
      text: "This will hide the component from active list.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, deactivate it",
      cancelButtonText: "Cancel",
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/assessment-components/${id}`);
        Swal.fire("Done", "Component deactivated successfully", "success");
        fetchComponents();
      } catch (err) {
        console.error("Failed to deactivate component:", err);
        Swal.fire(
          "Error",
          err?.response?.data?.message || "Failed to deactivate component",
          "error"
        );
      }
    }
  };

  return (
    <div className="container mt-4">
      <h2>🧮 Assessment Components</h2>

      <div className="card mt-4 mb-4">
        <div className="card-body">
          <h5 className="card-title">
            {isEditing ? "✏️ Edit Component" : "➕ Add Component"}
          </h5>

          <div className="row">
            <div className="col-md-3 mb-3">
              <label className="form-label">Name *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Periodic Test / Listening Skills"
                className="form-control"
              />
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">Abbreviation *</label>
              <input
                name="abbreviation"
                value={formData.abbreviation}
                onChange={handleChange}
                placeholder="e.g. PT / LS"
                className="form-control"
              />
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">Type *</label>
              <select
                name="component_type"
                value={formData.component_type}
                onChange={handleChange}
                className="form-select"
              >
                <option value="MARKS">Marks</option>
                <option value="GRADE">Grade</option>
              </select>
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">
                Max Marks {formData.component_type === "MARKS" ? "*" : ""}
              </label>
              <input
                type="number"
                name="max_marks"
                value={formData.max_marks}
                onChange={handleChange}
                placeholder="e.g. 20"
                className="form-control"
                disabled={formData.component_type === "GRADE"}
                min="0"
              />
              {formData.component_type === "GRADE" && (
                <small className="text-muted">Not required for grade-based skills</small>
              )}
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">Assessment Nature *</label>
              <select
                name="is_internal"
                value={formData.is_internal ? "INTERNAL" : "EXTERNAL"}
                onChange={handleChange}
                className="form-select"
              >
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">External</option>
              </select>
            </div>

            <div className="col-md-2 mb-3">
              <label className="form-label">Academic Category *</label>
              <select
                name="scholastic_type"
                value={formData.scholastic_type}
                onChange={handleChange}
                className="form-select"
              >
                <option value="Scholastic">Scholastic</option>
                <option value="Co-Scholastic">Co-Scholastic</option>
              </select>
            </div>

            <div className="col-md-1 mb-3 form-check mt-4">
              <input
                type="checkbox"
                name="is_practical"
                checked={formData.is_practical}
                onChange={handleChange}
                className="form-check-input"
                id="practicalCheck"
              />
              <label htmlFor="practicalCheck" className="form-check-label">
                Practical
              </label>
            </div>

            <div className="col-md-1 mb-3 form-check mt-4">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                className="form-check-input"
                id="activeCheck"
              />
              <label htmlFor="activeCheck" className="form-check-label">
                Active
              </label>
            </div>

            <div className="col-md-12 d-flex gap-2 mt-2">
              <button
                className="btn btn-success"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Saving..." : isEditing ? "Update" : "Create"}
              </button>

              {isEditing && (
                <button
                  className="btn btn-secondary"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 className="card-title mb-0">
              Component List ({filteredComponents.length}/{components.length})
            </h5>

            <div className="d-flex flex-wrap gap-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="form-control"
                style={{ minWidth: 240 }}
                placeholder="Search name or abbreviation..."
                aria-label="Search assessment components"
              />

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="form-select"
                aria-label="Filter by component type"
              >
                <option value="ALL">All Types</option>
                <option value="MARKS">Marks</option>
                <option value="GRADE">Grade</option>
              </select>

              <select
                value={natureFilter}
                onChange={(event) => setNatureFilter(event.target.value)}
                className="form-select"
                aria-label="Filter by assessment nature"
              >
                <option value="ALL">Internal + External</option>
                <option value="INTERNAL">Internal</option>
                <option value="EXTERNAL">External</option>
              </select>

              <select
                value={academicFilter}
                onChange={(event) => setAcademicFilter(event.target.value)}
                className="form-select"
                aria-label="Filter by academic category"
              >
                <option value="ALL">Scholastic + Co-Scholastic</option>
                <option value="Scholastic">Scholastic</option>
                <option value="Co-Scholastic">Co-Scholastic</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="form-select"
                aria-label="Filter by component status"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>

              {(search ||
                typeFilter !== "ALL" ||
                natureFilter !== "ALL" ||
                academicFilter !== "ALL" ||
                statusFilter !== "ALL") && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setSearch("");
                    setTypeFilter("ALL");
                    setNatureFilter("ALL");
                    setAcademicFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {filteredComponents.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-striped table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Abbr.</th>
                    <th>Type</th>
                    <th>Max Marks</th>
                    <th>Assessment Nature</th>
                    <th>Academic Category</th>
                    <th>Practical</th>
                    <th>Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredComponents.map((comp, index) => (
                    <tr key={comp.id}>
                      <td>{index + 1}</td>
                      <td>{comp.name}</td>
                      <td>{comp.abbreviation}</td>
                      <td>
                        <span
                          className={`badge ${
                            comp.component_type === "GRADE"
                              ? "bg-info text-dark"
                              : "bg-primary"
                          }`}
                        >
                          {comp.component_type === "GRADE" ? "Grade" : "Marks"}
                        </span>
                      </td>
                      <td>
                        {comp.component_type === "GRADE"
                          ? "-"
                          : comp.max_marks ?? 0}
                      </td>
                      <td>
                        <span className={`badge ${comp.is_internal ? "bg-success" : "bg-secondary"}`}>
                          {comp.is_internal ? "Internal" : "External"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            (comp.scholastic_type || "Scholastic") === "Co-Scholastic"
                              ? "bg-warning text-dark"
                              : "bg-dark"
                          }`}
                        >
                          {comp.scholastic_type || "Scholastic"}
                        </span>
                      </td>
                      <td>{comp.is_practical ? "Yes" : "No"}</td>
                      <td>{comp.is_active ? "Yes" : "No"}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-warning me-2"
                          onClick={() => handleEdit(comp)}
                        >
                          Edit
                        </button>

                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(comp.id)}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted mb-0">
              {components.length
                ? "No components match the selected filters."
                : "No components found."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssessmentComponentManagement;
