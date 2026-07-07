import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { getDoc, doc } from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";

// ===============================================================
// 📘 ASSESSMENT MANAGEMENT COMPONENT (CREATE / EDIT / DELETE)
// ===============================================================
const Assessments = () => {
  const [assessments, setAssessments] = useState([]);
  const [newAssessment, setNewAssessment] = useState({
    title: "",
    content: "",
    youtubeUrl: "",
    subjectId: "",
  });
  const [subjects, setSubjects] = useState([]);
  const [files, setFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const hiddenFileInput = useRef(null);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const res = await api.get("/assignments");
      setAssessments(res.data.assignments || []);
    } catch (err) {
      console.error("Error fetching assessments:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await api.get("/class-subject-teachers/teacher/class-subjects");
      const subjList = (res.data.assignments || [])
        .map((item) => item.subject)
        .filter(Boolean);
      const unique = Array.from(new Map(subjList.map((s) => [s.id, s])).values());
      setSubjects(unique);
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  };

  useEffect(() => {
    fetchAssessments();
    fetchSubjects();
  }, []);

  // File handlers
  const handleAddMoreFiles = () => hiddenFileInput.current?.click();
  const handleAdditionalFiles = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = "";
  };
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));
  const removeExistingFile = (i) =>
    setExistingFiles((prev) => prev.filter((_, idx) => idx !== i));

  const saveAssessment = async () => {
    if (!newAssessment.title.trim()) {
      return Swal.fire("Error", "Title is required", "error");
    }
    if (!newAssessment.subjectId) {
      return Swal.fire("Error", "Subject is required", "error");
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("title", newAssessment.title);
      formData.append("content", newAssessment.content);
      formData.append("youtubeUrl", newAssessment.youtubeUrl);
      formData.append("subjectId", newAssessment.subjectId);
      files.forEach((f) => formData.append("files", f));

      if (editingAssessment) {
        formData.append(
          "existingFiles",
          JSON.stringify(existingFiles.map((f) => f.id))
        );
      }

      const res = editingAssessment
        ? await api.put(`/assignments/${editingAssessment.id}`, formData)
        : await api.post("/assignments", formData);

      const updated = res.data.assignment;
      if (editingAssessment) {
        setAssessments((prev) =>
          prev.map((a) => (a.id === editingAssessment.id ? updated : a))
        );
      } else {
        setAssessments((prev) => [updated, ...prev]);
      }

      Swal.fire(
        "Success!",
        editingAssessment ? "Assessment updated." : "Assessment added.",
        "success"
      );

      setEditingAssessment(null);
      setNewAssessment({ title: "", content: "", youtubeUrl: "", subjectId: "" });
      setFiles([]);
      setExistingFiles([]);
      setShowModal(false);
    } catch (err) {
      console.error("Error saving assessment:", err);
      Swal.fire("Error", "Failed to save assessment", "error");
    } finally {
      setLoading(false);
    }
  };

  const deleteAssessment = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will delete permanently.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
    }).then(async (r) => {
      if (r.isConfirmed) {
        try {
          await api.delete(`/assignments/${id}`);
          setAssessments((prev) => prev.filter((a) => a.id !== id));
          Swal.fire("Deleted!", "Assessment deleted.", "success");
        } catch (err) {
          Swal.fire("Error", "Failed to delete assessment", "error");
        }
      }
    });
  };

  const filtered = search
    ? assessments.filter((a) =>
        (a.title || "").toLowerCase().includes(search.toLowerCase())
      )
    : assessments;

  return (
    <div className="mb-5">
      <input
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.jpg,.png"
        style={{ display: "none" }}
        ref={hiddenFileInput}
        onChange={handleAdditionalFiles}
      />

      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="fw-bold mb-0 text-primary">📘 Assignments & Class Tests</h2>
          <p className="text-muted mb-0">Manage your class assessments efficiently (Assignments or Class Tests)</p>
        </div>
        <button
          className="btn btn-primary btn-lg shadow-sm px-4"
          onClick={() => {
            setEditingAssessment(null);
            setNewAssessment({
              title: "",
              content: "",
              youtubeUrl: "",
              subjectId: "",
            });
            setFiles([]);
            setExistingFiles([]);
            setShowModal(true);
          }}
        >
          <i className="bi bi-plus-circle me-2"></i>Add New Assessment
        </button>
      </div>

      <div className="mb-4">
        <div className="input-group">
          <span className="input-group-text">
            <i className="bi bi-search text-muted"></i>
          </span>
          <input
            type="text"
            className="form-control border-end-0"
            placeholder="Search assessments by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="btn btn-outline-secondary border-start-0"
              onClick={() => setSearch("")}
            >
              <i className="bi bi-x"></i>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="card shadow-sm border-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light sticky-top">
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Title</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Video</th>
                  <th scope="col">Files</th>
                  <th scope="col" className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id} className="align-middle">
                    <td className="fw-medium">{i + 1}</td>
                    <td>
                      <div>
                        <h6 className="mb-0 fw-semibold">{a.title}</h6>
                        <small className="text-muted">{a.content?.substring(0, 50)}...</small>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-info text-dark">
                        {a.Subject?.name || a.subject?.name || "—"}
                      </span>
                    </td>
                    <td className="text-center">
                      {a.youtubeUrl ? (
                        <a
                          href={a.youtubeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-info"
                          title="Watch Video"
                        >
                          <i className="bi bi-play-circle"></i>
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {a.AssignmentFiles?.length ? (
                        <div className="d-flex flex-column gap-1">
                          {a.AssignmentFiles.slice(0, 3).map((f, idx) => (
                            <a
                              key={idx}
                              href={f.filePath}
                              target="_blank"
                              rel="noreferrer"
                              className="text-decoration-none text-primary small"
                              title={f.fileName}
                            >
                              <i className="bi bi-file-earmark-text me-1"></i>
                              {f.fileName.length > 20 ? `${f.fileName.substring(0, 20)}...` : f.fileName}
                            </a>
                          ))}
                          {a.AssignmentFiles.length > 3 && (
                            <small className="text-muted">+{a.AssignmentFiles.length - 3} more</small>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="btn-group btn-group-sm" role="group">
                        <button
                          className="btn btn-outline-primary"
                          onClick={() => {
                            setEditingAssessment(a);
                            setNewAssessment({
                              title: a.title,
                              content: a.content,
                              youtubeUrl: a.youtubeUrl,
                              subjectId: a.Subject?.id || a.subject?.id || "",
                            });
                            setExistingFiles(a.AssignmentFiles || []);
                            setFiles([]);
                            setShowModal(true);
                          }}
                          title="Edit"
                        >
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => deleteAssessment(a.id)}
                          title="Delete"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      <i className="bi bi-inbox display-4 mb-3"></i>
                      <p className="mb-0">No assessments found.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="modal show fade d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">
                  <i className="bi bi-journal-plus me-2"></i>
                  {editingAssessment ? "Edit Assessment" : "Add New Assessment"}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <form>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Title <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Enter assessment title (e.g., Math Assignment or Science Class Test)"
                      value={newAssessment.title}
                      onChange={(e) =>
                        setNewAssessment({ ...newAssessment, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Enter assessment description..."
                      value={newAssessment.content}
                      onChange={(e) =>
                        setNewAssessment({ ...newAssessment, content: e.target.value })
                      }
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">YouTube URL (Optional for Tutorials)</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-youtube"></i>
                      </span>
                      <input
                        type="url"
                        className="form-control"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={newAssessment.youtubeUrl}
                        onChange={(e) =>
                          setNewAssessment({
                            ...newAssessment,
                            youtubeUrl: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Subject <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      value={newAssessment.subjectId}
                      onChange={(e) =>
                        setNewAssessment({
                          ...newAssessment,
                          subjectId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">-- Select Subject --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(existingFiles.length > 0 || files.length > 0) && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Attached Files</label>
                      <div className="list-group list-group-flush">
                        {existingFiles.map((f, i) => (
                          <div key={f.id} className="list-group-item px-0 border-end-0 border-start-0">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center">
                                <i className="bi bi-file-earmark-text text-primary me-2"></i>
                                <a
                                  href={f.filePath}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-decoration-none text-dark"
                                >
                                  {f.fileName}
                                </a>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => removeExistingFile(i)}
                              >
                                <i className="bi bi-x"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                        {files.map((f, i) => (
                          <div key={i} className="list-group-item px-0 border-end-0 border-start-0">
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center">
                                <i className="bi bi-file-earmark-plus text-success me-2"></i>
                                <span>{f.name}</span>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => removeFile(i)}
                              >
                                <i className="bi bi-x"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Attach Files (Optional for Class Tests)</label>
                    <button
                      type="button"
                      className="btn btn-outline-secondary w-100"
                      onClick={handleAddMoreFiles}
                    >
                      <i className="bi bi-paperclip me-2"></i>Choose Files (PDF, DOC, Images)
                    </button>
                    <small className="text-muted d-block mt-1">Multiple files allowed</small>
                  </div>
                </form>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  <i className="bi bi-x-circle me-2"></i>Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={saveAssessment}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>Save Assessment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===============================================================
// 🎯 ASSESSMENT DISTRIBUTION COMPONENT (ASSIGN TO STUDENTS)
// ===============================================================
const GiveAssessmentToStudents = () => {
  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [aRes, sRes] = await Promise.all([
          api.get("/assignments"),
          api.get("/teacher-students/students")
        ]);
        setAssessments(aRes.data.assignments || []);
        setStudents(sRes.data.students || []);
        const cls = new Map(), sec = new Map();
        (sRes.data.students || []).forEach(st => {
          const c = st.Class?.name || st.class_name;
          const cid = st.Class?.id || st.classId;
          if (c) cls.set(cid, { id: cid, name: c });
          const secn = st.Section?.name || st.section_name;
          const sid = st.Section?.id || st.sectionId;
          if (secn) sec.set(sid, { id: sid, name: secn });
        });
        setClasses([...cls.values()]);
        setSections([...sec.values()]);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const assign = async () => {
    if (!selectedAssessmentId)
      return Swal.fire("Error", "Please select an assessment", "error");
    if (!selectedStudentIds.length)
      return Swal.fire("Error", "Please select at least one student", "error");

    try {
      setLoading(true);
      await api.post(`/student-assignments/${selectedAssessmentId}/assign`, {
        studentIds: selectedStudentIds,
      });

      Swal.fire({
        icon: "success",
        title: "Success!",
        text: "Assessment assigned successfully (Assignment or Class Test)",
        confirmButtonText: "Done"
      });
      setShowModal(false);
      setSelectedStudentIds([]);
      setSelectedAssessmentId("");
      setClassId("");
      setSectionId("");
      setSelectAll(false);
    } catch (err) {
      console.error("Error assigning assessment:", err);
      Swal.fire("Error", "Failed to assign assessment", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    const matchC = classId ? String(s.Class?.id || s.classId) === String(classId) : true;
    const matchS = sectionId
      ? String(s.Section?.id || s.sectionId) === String(sectionId)
      : true;
    return matchC && matchS;
  });

  const toggleStudent = (id) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectAll(false);
  };

  const handleSelectAll = (e) => {
    const checked = e.target.checked;
    setSelectAll(checked);
    setSelectedStudentIds(checked ? filteredStudents.map((s) => s.id) : []);
  };

  return (
    <div className="card shadow-sm border-0 p-4 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h3 className="fw-bold mb-0 text-success">🎯 Assign to Students</h3>
          <p className="text-muted mb-0">Distribute assessments to specific classes or sections (Assignments or Class Tests)</p>
        </div>
        <button 
          className="btn btn-success shadow-sm px-4" 
          onClick={() => setShowModal(true)}
          disabled={loading}
        >
          <i className="bi bi-share me-2"></i>Assign Now
        </button>
      </div>

      {showModal && (
        <div className="modal show fade d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-success text-white sticky-top">
                <h5 className="modal-title">
                  <i className="bi bi-people me-2"></i>Select Assessment & Students
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white" 
                  onClick={() => setShowModal(false)}
                ></button>
              </div>

              <div className="modal-body" style={{ maxHeight: "500px", overflowY: "auto" }}>
                <div className="mb-4">
                  <label className="form-label fw-semibold">Select Assessment</label>
                  <select
                    className="form-select"
                    value={selectedAssessmentId}
                    onChange={(e) => setSelectedAssessmentId(e.target.value)}
                  >
                    <option value="">-- Choose an Assessment (Assignment or Class Test) --</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row mb-4 g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Filter by Class</label>
                    <select 
                      className="form-select" 
                      value={classId} 
                      onChange={(e) => setClassId(e.target.value)}
                    >
                      <option value="">-- All Classes --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Filter by Section</label>
                    <select 
                      className="form-select" 
                      value={sectionId} 
                      onChange={(e) => setSectionId(e.target.value)}
                    >
                      <option value="">-- All Sections --</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="card border">
                  <div className="card-body p-0">
                    <div className="table-responsive" style={{ maxHeight: "300px", overflowY: "auto" }}>
                      <table className="table table-hover table-sm mb-0 align-middle">
                        <thead className="table-light sticky-top">
                          <tr>
                            <th style={{ width: "50px" }}>
                              <input 
                                type="checkbox" 
                                checked={selectAll} 
                                onChange={handleSelectAll}
                                className="form-check-input"
                              />
                            </th>
                            <th>Name</th>
                            <th>Class</th>
                            <th>Section</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selectedStudentIds.includes(s.id)}
                                  onChange={() => toggleStudent(s.id)}
                                />
                              </td>
                              <td className="fw-medium">{s.name}</td>
                              <td>
                                <span className="badge bg-secondary">
                                  {s.Class?.name || s.class_name || "—"}
                                </span>
                              </td>
                              <td>
                                <span className="badge bg-light text-dark">
                                  {s.Section?.name || s.section_name || "—"}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {!filteredStudents.length && (
                            <tr>
                              <td colSpan="4" className="text-center text-muted py-4">
                                <i className="bi bi-people display-6 mb-2 d-block"></i>
                                No students found matching the filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="card-footer bg-light text-center text-muted small">
                    {filteredStudents.length} students available | {selectedStudentIds.length} selected
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowModal(false)}
                >
                  <i className="bi bi-x-circle me-2"></i>Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={assign}
                  disabled={loading || !selectedAssessmentId || !selectedStudentIds.length}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>Assign to Selected ({selectedStudentIds.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===============================================================
// 📋 ASSIGNED ASSESSMENTS LIST (Teacher View)
// ===============================================================
const AssignedAssessmentsList = () => {
  const [assignedList, setAssignedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  const fetchAssigned = async () => {
    try {
      setLoading(true);
      const res = await api.get("/student-assignments");
      setAssignedList(res.data.assignments || []);
    } catch (err) {
      console.error("Error fetching assigned assessments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssigned();
  }, []);

  // 🔹 Group by Assessment ID
  const groupedAssessments = Object.values(
    assignedList.reduce((acc, sa) => {
      const id = sa.Assignment?.id;
      if (!id) return acc;

      if (!acc[id]) {
        acc[id] = {
          id,
          title: sa.Assignment?.title,
          subject: sa.Assignment?.subject?.name,
          students: [],
          status: sa.status,
          dueDate: sa.dueDate,
        };
      }

      if (sa.Student) {
        acc[id].students.push({
          name: sa.Student.name,
          className: sa.Student.Class?.class_name,
          sectionName: sa.Student.Section?.section_name,
        });
      }

      return acc;
    }, {})
  );

  const openStudentsModal = (assessment) => {
    setSelectedAssessment(assessment);
    setShowStudentsModal(true);
  };

  return (
    <div className="card shadow-sm border-0 p-4 mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h3 className="fw-bold mb-0 text-info">📋 Assigned Assessments</h3>
          <p className="text-muted mb-0">View and monitor assigned tasks (Assignments or Class Tests)</p>
        </div>
        <button 
          className="btn btn-outline-info" 
          onClick={fetchAssigned}
          disabled={loading}
        >
          <i className="bi bi-arrow-clockwise me-2"></i>Refresh
        </button>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-info" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : groupedAssessments.length > 0 ? (
        <div className="table-responsive">
          <table className="table table-striped table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th scope="col">#</th>
                <th scope="col">Title</th>
                <th scope="col">Subject</th>
                <th scope="col">Assigned To</th>
                <th scope="col">Status</th>
                <th scope="col">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {groupedAssessments.map((a, i) => (
                <tr key={a.id}>
                  <td className="fw-medium">{i + 1}</td>
                  <td>
                    <div>
                      <h6 className="mb-0 fw-semibold text-truncate" style={{ maxWidth: "200px" }} title={a.title}>
                        {a.title}
                      </h6>
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-warning text-dark">
                      {a.subject || "—"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-info"
                      onClick={() => openStudentsModal(a)}
                      title="View Students"
                    >
                      <i className="bi bi-people me-1"></i>
                      {a.students.length}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${a.status === 'completed' ? 'bg-success' : a.status === 'overdue' ? 'bg-danger' : 'bg-secondary'}`}>
                      {a.status || "Pending"}
                    </span>
                  </td>
                  <td>
                    {a.dueDate ? (
                      <span className="fw-medium">
                        {new Date(a.dueDate).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-clipboard-check display-4 mb-3 opacity-50"></i>
          <h5 className="mb-2">No Assigned Assessments</h5>
          <p className="mb-0">Start by assigning some to your students.</p>
        </div>
      )}

      {/* Students Modal */}
      {showStudentsModal && selectedAssessment && (
        <div
          className="modal show fade d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <i className="bi bi-people me-2"></i>
                  Students for "{selectedAssessment.title}" (Assignment or Class Test)
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowStudentsModal(false);
                    setSelectedAssessment(null);
                  }}
                ></button>
              </div>
              <div className="modal-body" style={{ maxHeight: "400px", overflowY: "auto" }}>
                <div className="table-responsive">
                  <table className="table table-hover table-sm">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Class</th>
                        <th>Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAssessment.students.map((s, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td className="fw-medium">{s.name || "—"}</td>
                          <td>{s.className || "—"}</td>
                          <td>{s.sectionName || "—"}</td>
                        </tr>
                      ))}
                      {selectedAssessment.students.length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-center text-muted py-3">
                            No students assigned yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowStudentsModal(false);
                    setSelectedAssessment(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===============================================================
// 🔗 COMBINED COMPONENT EXPORT
// ===============================================================
const CombinedAssessments = () => (
  <div className="container-fluid px-4 mt-3">
    <Assessments />
    <GiveAssessmentToStudents />
    <AssignedAssessmentsList />
  </div>
);

export default CombinedAssessments;