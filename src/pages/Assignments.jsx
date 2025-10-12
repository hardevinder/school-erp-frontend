// src/pages/CombinedAssignments.jsx
import React, { useState, useEffect, useRef } from "react";
import api from "../api"; // Custom Axios instance
import Swal from "sweetalert2";
import { getDoc, doc } from "firebase/firestore";
import { firestore } from "../firebase/firebaseConfig";

//
// ---------- Assignment Management Component (Create, Edit, Delete) ----------
//
const Assignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    content: "",
    youtubeUrl: "",
    subjectId: ""
  });
  const [subjects, setSubjects] = useState([]);
  const [files, setFiles] = useState([]); // For new file uploads
  const [existingFiles, setExistingFiles] = useState([]); // For files already attached (edit mode)
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Reference to hidden file input for adding more files
  const hiddenFileInput = useRef(null);

  // Fetch assignments from API
  const fetchAssignments = async () => {
    try {
      const response = await api.get("/assignments");
      setAssignments(response.data.assignments || []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    }
  };

  // Fetch subjects from API
  const fetchSubjects = async () => {
    try {
      const response = await api.get("/class-subject-teachers/teacher/class-subjects");
      const subjectsFromAssignments = (response.data.assignments || []).map(item => item.subject).filter(Boolean);
      const uniqueSubjects = Array.from(
        new Map(subjectsFromAssignments.map(subj => [subj.id, subj])).values()
      );
      setSubjects(uniqueSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      setSubjects([]);
    }
  };

  useEffect(() => {
    fetchAssignments();
    fetchSubjects();
  }, []);

  // Trigger hidden file input when plus button is clicked
  const handleAddMoreFiles = () => {
    if (hiddenFileInput.current) {
      hiddenFileInput.current.click();
    }
  };

  // Append additional new files from hidden input
  const handleAdditionalFiles = (e) => {
    setFiles((prevFiles) => [...prevFiles, ...Array.from(e.target.files)]);
    e.target.value = "";
  };

  // Remove a new file by index (small "×" button)
  const removeFile = (indexToRemove) => {
    setFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  // Remove an existing file by index (in edit mode)
  const removeExistingFile = (indexToRemove) => {
    setExistingFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  // Save assignment (create or update)
  const saveAssignment = async () => {
    try {
      const formData = new FormData();
      formData.append("title", newAssignment.title);
      formData.append("content", newAssignment.content);
      formData.append("youtubeUrl", newAssignment.youtubeUrl);
      formData.append("subjectId", newAssignment.subjectId);
      // Append new files if any
      files.forEach((file) => formData.append("files", file));
      // If editing, send the list of existing file IDs to keep
      if (editingAssignment) {
        const existingFileIds = existingFiles.map((file) => file.id);
        formData.append("existingFiles", JSON.stringify(existingFileIds));
      }

      if (editingAssignment) {
        await api.put(`/assignments/${editingAssignment.id}`, formData);
        Swal.fire("Updated!", "Assignment updated successfully.", "success");
      } else {
        await api.post("/assignments", formData);
        Swal.fire("Added!", "Assignment added successfully.", "success");
      }

      setEditingAssignment(null);
      setNewAssignment({ title: "", content: "", youtubeUrl: "", subjectId: "" });
      setFiles([]);
      setExistingFiles([]);
      setShowModal(false);
      fetchAssignments();
      window.dispatchEvent(new Event("assignmentsUpdated"));
    } catch (error) {
      console.error("Error saving assignment:", error);
      Swal.fire("Error", "Failed to save assignment", "error");
    }
  };

  // Delete an assignment
  const deleteAssignment = async (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/assignments/${id}`);
          Swal.fire("Deleted!", "Assignment deleted successfully.", "success");
          fetchAssignments();
          window.dispatchEvent(new Event("assignmentsUpdated"));
        } catch (error) {
          console.error("Error deleting assignment:", error);
          Swal.fire("Error", "Failed to delete assignment", "error");
        }
      }
    });
  };

  // Filter assignments based on search text
  const handleSearch = () => {
    if (search) {
      return assignments.filter((assignment) =>
        (assignment.title || "").toLowerCase().includes(search.toLowerCase())
      );
    }
    return assignments;
  };

  return (
    <div className="mb-5">
      <button
        className="btn btn-success mb-3"
        onClick={() => {
          setEditingAssignment(null);
          setNewAssignment({ title: "", content: "", youtubeUrl: "", subjectId: "" });
          setFiles([]);
          setExistingFiles([]);
          setShowModal(true);
        }}
      >
        Add Assignment
      </button>

      <div className="mb-3">
        <input
          type="text"
          className="form-control w-50 d-inline"
          placeholder="Search Assignments"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Subject</th>
            <th>YouTube Video</th>
            <th>Files</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {handleSearch().map((assignment, index) => (
            <tr key={assignment.id}>
              <td>{index + 1}</td>
              <td>{assignment.title}</td>
              <td>
                {assignment.Subject
                  ? assignment.Subject.name
                  : assignment.subject
                  ? assignment.subject.name
                  : "N/A"}
              </td>
              <td>
                {assignment.youtubeUrl ? (
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() =>
                      window.open(assignment.youtubeUrl, "_blank", "noopener noreferrer")
                    }
                  >
                    Watch Video
                  </button>
                ) : (
                  "N/A"
                )}
              </td>
              <td>
                {assignment.AssignmentFiles && assignment.AssignmentFiles.length > 0 ? (
                  <ul style={{ paddingLeft: "1rem" }}>
                    {assignment.AssignmentFiles.map((file, i) => (
                      <li key={i}>
                        <a
                          href={file.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {file.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  "No Files"
                )}
              </td>
              <td>
                <button
                  className="btn btn-primary btn-sm me-2"
                  onClick={() => {
                    setEditingAssignment(assignment);
                    setNewAssignment({
                      title: assignment.title,
                      content: assignment.content,
                      youtubeUrl: assignment.youtubeUrl,
                      subjectId:
                        assignment.Subject
                          ? assignment.Subject.id
                          : assignment.subject
                          ? assignment.subject.id
                          : ""
                    });
                    // Load existing attachments into state for edit mode
                    setExistingFiles(assignment.AssignmentFiles || []);
                    setFiles([]); // Reset new files
                    setShowModal(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteAssignment(assignment.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for Adding/Editing Assignment */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingAssignment ? "Edit Assignment" : "Add Assignment"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="Title"
                  value={newAssignment.title}
                  onChange={(e) =>
                    setNewAssignment({ ...newAssignment, title: e.target.value })
                  }
                />
                <textarea
                  className="form-control mb-3"
                  placeholder="Content"
                  value={newAssignment.content}
                  onChange={(e) =>
                    setNewAssignment({ ...newAssignment, content: e.target.value })
                  }
                ></textarea>
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="YouTube URL"
                  value={newAssignment.youtubeUrl}
                  onChange={(e) =>
                    setNewAssignment({
                      ...newAssignment,
                      youtubeUrl: e.target.value
                    })
                  }
                />
                <div className="mb-3">
                  <label>Select Subject:</label>
                  <select
                    className="form-select"
                    value={newAssignment.subjectId}
                    onChange={(e) =>
                      setNewAssignment({ ...newAssignment, subjectId: e.target.value })
                    }
                  >
                    <option value="">-- Select a Subject --</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Display existing attachments in Edit Mode */}
                {editingAssignment && existingFiles.length > 0 && (
                  <div className="mb-3">
                    <strong>Existing Files:</strong>
                    <ul className="list-unstyled">
                      {existingFiles.map((file, index) => (
                        <li key={file.id} className="d-flex align-items-center">
                          <span className="me-2">{file.fileName}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger p-0"
                            style={{
                              width: "20px",
                              height: "20px",
                              lineHeight: "20px"
                            }}
                            onClick={() => removeExistingFile(index)}
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Display new files selected */}
                {files.length > 0 && (
                  <div className="mb-3">
                    <strong>New Files:</strong>
                    <ul className="list-unstyled">
                      {files.map((file, index) => (
                        <li key={index} className="d-flex align-items-center">
                          <span className="me-2">{file.name}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger p-0"
                            style={{
                              width: "20px",
                              height: "20px",
                              lineHeight: "20px"
                            }}
                            onClick={() => removeFile(index)}
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <input
                  type="file"
                  style={{ display: "none" }}
                  multiple
                  ref={hiddenFileInput}
                  onChange={handleAdditionalFiles}
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleAddMoreFiles}
                >
                  + Add More Files
                </button>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
                <button className="btn btn-primary" onClick={saveAssignment}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

//
// ---------- Assignment Distribution Component (Assign assignment to students) ----------
//
const GiveAssignmentToStudents = () => {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [students, setStudents] = useState([]); // full teacher-students list (fallback)
  const [studentsForPicker, setStudentsForPicker] = useState([]); // students shown in modal (server-side or filtered)
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const [classIdFilter, setClassIdFilter] = useState("");
  const [sectionIdFilter, setSectionIdFilter] = useState("");

  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [markAll, setMarkAll] = useState(false);
  const [assignedList, setAssignedList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loadingStudentsForPicker, setLoadingStudentsForPicker] = useState(false);

  // ----------------- helpers (robust parsing / derive) -----------------
  const parseList = (res) => {
    if (!res) return [];
    const payload = res.data ?? res;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.classes)) return payload.classes;
    if (Array.isArray(payload.sections)) return payload.sections;
    if (Array.isArray(payload.rows)) return payload.rows;
    if (Array.isArray(payload.result)) return payload.result;
    for (const k of Object.keys(payload || {})) {
      if (Array.isArray(payload[k])) return payload[k];
    }
    return [];
  };

  // Normalized derive: always returns { id: string|null, name: string, classId?: string|null }
  const deriveClassesAndSectionsFromStudents = (studentsArr = []) => {
    const clsMap = new Map();
    const secMap = new Map();

    studentsArr.forEach((s) => {
      // --- class ---
      const cls = s.Class || s.class || (s.class_name ? { id: null, class_name: s.class_name } : null);
      if (cls) {
        const rawId = cls.id ?? cls.class_id ?? cls.classId ?? null;
        const rawName = cls.class_name ?? cls.name ?? rawId ?? "";
        const id = rawId !== null && rawId !== undefined ? String(rawId) : null;
        const name = String(rawName || "").trim();
        const key = id || name;
        if (key) clsMap.set(key, { id, name });
      }

      // --- section ---
      const sec =
        s.section ||
        s.Section ||
        (s.Class && (s.Class.section_name || s.Class.section)) ||
        (s.section_name ? { id: null, section_name: s.section_name } : null);

      if (sec) {
        const rawId = sec.id ?? sec.section_id ?? sec.sectionId ?? null;
        const rawName = sec.section_name ?? sec.name ?? rawId ?? "";
        const id = rawId !== null && rawId !== undefined ? String(rawId) : null;
        const name = String(rawName || "").trim();
        const classIdRaw = sec.classId ?? sec.class_id ?? sec.class ?? (s.Class && s.Class.id) ?? null;
        const classId = classIdRaw !== null && classIdRaw !== undefined ? String(classIdRaw) : null;
        const key = id || (classId ? `${classId}::${name}` : name);
        if (key) secMap.set(key, { id, name, classId });
      }
    });

    return {
      classes: Array.from(clsMap.values()), // [{id, name}, ...]
      sections: Array.from(secMap.values()), // [{id, name, classId}, ...]
    };
  };

  // ----------------- fetchers -----------------
  const fetchAssignments = async () => {
    try {
      const res = await api.get("/assignments");
      setAssignments(res.data.assignments || []);
    } catch (err) {
      console.error("Error fetching assignments:", err);
    }
  };

  const fetchAssignedList = async () => {
    try {
      const res = await api.get("/student-assignments", { params: { t: Date.now() } });
      const data = res.data.assignments || [];
      const processedAssignments = data.map((assignment) => {
        if (assignment.StudentAssignments && assignment.StudentAssignments.length > 0) {
          const seen = new Set();
          const unique = assignment.StudentAssignments.filter((sa) => {
            if (!seen.has(sa.createdAt)) {
              seen.add(sa.createdAt);
              return true;
            }
            return false;
          });
          return { ...assignment, StudentAssignments: unique };
        }
        return assignment;
      });
      setAssignedList(processedAssignments);
    } catch (err) {
      console.error("Error fetching assigned list:", err);
      Swal.fire("Error", "Failed to fetch assigned assignments", "error");
    }
  };

  // Load classes & sections, fallback to deriving from teacher-students
  const loadClassesAndSections = async () => {
    try {
      const [clsRes, secRes] = await Promise.allSettled([api.get("/classes"), api.get("/sections")]);

      let clsDataRaw = [];
      let secDataRaw = [];

      if (clsRes.status === "fulfilled") {
        clsDataRaw = parseList(clsRes.value);
      } else {
        console.warn("Failed /classes:", clsRes.reason);
      }

      if (secRes.status === "fulfilled") {
        secDataRaw = parseList(secRes.value);
      } else {
        console.warn("Failed /sections:", secRes.reason);
      }

      // If either is empty try to derive from teacher-students
      if ((!clsDataRaw || clsDataRaw.length === 0) || (!secDataRaw || secDataRaw.length === 0)) {
        try {
          const studentsResp = await api.get("/teacher-students/students");
          const studentsArr = parseList(studentsResp);
          if (studentsArr && studentsArr.length) {
            const derived = deriveClassesAndSectionsFromStudents(studentsArr);
            if ((!clsDataRaw || clsDataRaw.length === 0) && derived.classes.length) {
              clsDataRaw = derived.classes.map((c) => ({ id: c.id, name: c.name }));
            }
            if ((!secDataRaw || secDataRaw.length === 0) && derived.sections.length) {
              secDataRaw = derived.sections.map((s) => ({ id: s.id, name: s.name, classId: s.classId }));
            }
          }
        } catch (e) {
          console.warn("Failed derive classes/sections from students:", e);
        }
      }

      // Normalize server responses (ensure we convert any shape to {id, name, classId?})
      const normalizeClass = (c) => {
        const rawId = c?.id ?? c?.class_id ?? c?.classId ?? null;
        const rawName = c?.class_name ?? c?.name ?? c?.className ?? rawId ?? "";
        return { id: rawId !== null && rawId !== undefined ? String(rawId) : null, name: String(rawName || "").trim() };
      };
      const normalizeSection = (s) => {
        const rawId = s?.id ?? s?.section_id ?? s?.sectionId ?? null;
        const rawName = s?.section_name ?? s?.name ?? s?.sectionName ?? rawId ?? "";
        const rawClassId = s?.classId ?? s?.class_id ?? s?.class ?? null;
        return {
          id: rawId !== null && rawId !== undefined ? String(rawId) : null,
          name: String(rawName || "").trim(),
          classId: rawClassId !== null && rawClassId !== undefined ? String(rawClassId) : null,
        };
      };

      const clsNormalized = Array.isArray(clsDataRaw) ? clsDataRaw.map(normalizeClass) : [];
      const secNormalized = Array.isArray(secDataRaw) ? secDataRaw.map(normalizeSection) : [];

      setClasses(clsNormalized);
      setSections(secNormalized);
      console.log("GiveAssignmentToStudents: classes", clsNormalized.length, "sections", secNormalized.length);
    } catch (e) {
      console.error("Error loading classes/sections:", e);
      setClasses([]);
      setSections([]);
    }
  };

  // Load teacher-students (fallback dataset & used for client filtering if needed)
  const fetchTeacherStudents = async () => {
    try {
      const res = await api.get("/teacher-students/students");
      const arr = res.data?.students ?? parseList(res);
      setStudents(Array.isArray(arr) ? arr : []);
      console.log("teacher-students count:", (arr || []).length);
    } catch (err) {
      console.error("Error fetching teacher-students:", err);
      setStudents([]);
    }
  };

  // Load students for picker: prefer strict server-side endpoint when classId+sectionId present
  const loadStudentsForPicker = async (cId, sId, q) => {
    setLoadingStudentsForPicker(true);
    try {
      if (cId && sId) {
        // call strict endpoint like DigitalDiary uses
        try {
          const params = { class_id: cId, section_id: sId, pageSize: 500 };
          if (q && q.trim().length >= 2) params.q = q.trim();
          const { data } = await api.get("/students/searchByClassAndSection", { params });
          const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : parseList(data);
          setStudentsForPicker(Array.isArray(list) ? list : []);
          setSelectedStudentIds((prev) => prev.filter((id) => list.some((s) => s.id === id)));
          setLoadingStudentsForPicker(false);
          return;
        } catch (err) {
          console.warn("searchByClassAndSection failed - falling back to local filter", err);
        }
      }

      // fallback: filter teacher-students list locally by classId/sectionId
      const filtered = students.filter((st) => {
        const stClassId = String(st?.Class?.id ?? st?.classId ?? st?.class_id ?? st?.class ?? "").trim();
        const stSectionId =
          String(st?.section ?? st?.Section?.id ?? st?.section_id ?? st?.sectionId ?? st?.section ?? "").trim();
        if (cId && String(cId) !== stClassId) return false;
        if (sId && String(sId) !== stSectionId) return false;
        return true;
      });
      setStudentsForPicker(filtered);
      setSelectedStudentIds((prev) => prev.filter((id) => filtered.some((s) => s.id === id)));
    } catch (err) {
      console.error("Error loading students for picker:", err);
      setStudentsForPicker([]);
    } finally {
      setLoadingStudentsForPicker(false);
    }
  };

  // ----------------- initial load -----------------
  useEffect(() => {
    fetchAssignments();
    fetchAssignedList();
    loadClassesAndSections();
    fetchTeacherStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When modal opens or class/section filters change, refresh students shown for picker
  useEffect(() => {
    if (!showModal) return;
    loadStudentsForPicker(classIdFilter, sectionIdFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, classIdFilter, sectionIdFilter]);

  // ----------------- UI helpers -----------------
  const visibleStudents = studentsForPicker; // those displayed in modal table

  const handleMarkAll = (e) => {
    const checked = e.target.checked;
    setMarkAll(checked);
    if (checked) {
      setSelectedStudentIds(visibleStudents.map((s) => s.id));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleStudentCheckbox = (studentId, isChecked) => {
    if (isChecked) {
      setSelectedStudentIds((prev) => (prev.includes(studentId) ? prev : [...prev, studentId]));
    } else {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
    }
  };

  const handleAssignmentChange = (e) => {
    setSelectedAssignmentId(e.target.value);
  };

  // assign
  const assignAssignment = async () => {
    if (!selectedAssignmentId) {
      Swal.fire("Error", "Please select an assignment", "error");
      return;
    }
    if (selectedStudentIds.length === 0) {
      Swal.fire("Error", "Please select at least one student", "error");
      return;
    }
    try {
      await api.post(`/student-assignments/${selectedAssignmentId}/assign`, {
        studentIds: selectedStudentIds,
      });

      // notifications (best-effort)
      try {
        const assignment = assignments.find((a) => a.id === selectedAssignmentId);
        const title = assignment?.title || "New Assignment";
        for (const studentId of selectedStudentIds) {
          try {
            const userDoc = await getDoc(doc(firestore, "users", String(studentId)));
            const fcmToken = userDoc.exists() ? userDoc.data().fcmToken : null;
            if (fcmToken) {
              await fetch(`${process.env.REACT_APP_API_URL}/fcm/send-notification`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fcmToken,
                  title: "📘 Assignment Assigned",
                  body: `You've received: ${title}`,
                }),
              });
            }
          } catch (uErr) {
            console.warn("Failed pushing notification for", studentId, uErr);
          }
        }
      } catch (notifErr) {
        console.warn("Notification sending failed:", notifErr);
      }

      // refresh assigned list after small delay
      setTimeout(() => fetchAssignedList(), 500);
      Swal.fire("Success", "Assignment assigned successfully", "success");
      setShowModal(false);
      setSelectedAssignmentId("");
      setSelectedStudentIds([]);
      setMarkAll(false);
    } catch (err) {
      console.error("Error assigning assignment:", err);
      Swal.fire("Error", "Failed to assign assignment", "error");
    }
  };

  const deleteAssignedRecord = async (saCreatedAt) => {
    const datetime = encodeURIComponent(new Date(saCreatedAt).toISOString());
    Swal.fire({
      title: "Are you sure?",
      text: "This will delete the assigned record for the exact date and time.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/student-assignments/by-date/${datetime}`);
          Swal.fire("Deleted!", "Assigned record deleted successfully.", "success");
          fetchAssignedList();
        } catch (err) {
          console.error("Error deleting assigned record by datetime:", err);
          Swal.fire("Error", "Failed to delete assigned record", "error");
        }
      }
    });
  };

  const renderAssignedRows = () => {
    return assignedList.flatMap((assignment) => {
      if (assignment.StudentAssignments && assignment.StudentAssignments.length > 0) {
        return assignment.StudentAssignments.map((sa) => (
          <tr key={`${assignment.id}-${sa.createdAt}`}>
            <td>{assignment.title}</td>
            <td>
              {assignment.Subject
                ? assignment.Subject.name
                : assignment.subject
                ? assignment.subject.name
                : "N/A"}
            </td>
            <td>{new Date(sa.createdAt).toLocaleString()}</td>
            <td>{sa.Student && sa.Student.Class ? sa.Student.Class.class_name : "N/A"}</td>
            <td>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => deleteAssignedRecord(sa.createdAt)}
              >
                Delete
              </button>
            </td>
          </tr>
        ));
      }
      return [];
    });
  };

  // ----------------- Render -----------------
  return (
    <div className="mb-5">
      <button className="btn btn-primary mb-3" onClick={() => setShowModal(true)}>
        Give Assignment to Students
      </button>

      <h2>Assigned Assignments Summary</h2>
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Assignment Name</th>
            <th>Subject</th>
            <th>Assigned Date & Time</th>
            <th>Student Class</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>{renderAssignedRows()}</tbody>
      </table>

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Assign Assignment to Students</h5>
                <button className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label>Select Assignment:</label>
                  <select className="form-select" value={selectedAssignmentId} onChange={handleAssignmentChange}>
                    <option value="">-- Select an Assignment --</option>
                    {assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.id}>
                        {assignment.title}{" "}
                        {assignment.Subject ? `(${assignment.Subject.name})` : assignment.subject ? `(${assignment.subject.name})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-md-6">
                    <label>Filter by Class:</label>
                    <select className="form-select" value={classIdFilter} onChange={(e) => setClassIdFilter(e.target.value)}>
                      <option value="">-- All Classes --</option>
                      {classes.map((c) => (
                        <option key={c.id ?? c.name} value={c.id ?? c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label>Filter by Section:</label>
                    <select className="form-select" value={sectionIdFilter} onChange={(e) => setSectionIdFilter(e.target.value)}>
                      <option value="">-- All Sections --</option>
                      {sections.map((s) => (
                        <option key={s.id ?? s.name} value={s.id ?? s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mb-2">
                  <input type="checkbox" checked={markAll} onChange={handleMarkAll} /> Mark All (visible)
                </div>

                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {loadingStudentsForPicker ? (
                    <div className="text-center py-3">
                      <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
                    </div>
                  ) : (
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Select</th>
                          <th>Student Name</th>
                          <th>Class</th>
                          <th>Section</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleStudents.map((student) => {
                          // safe string extraction for section
                          const sec = (() => {
                            const raw =
                              student?.section ||
                              student?.Section ||
                              (student?.Class && (student.Class.section_name || student.Class.section)) ||
                              student.section_name ||
                              student.section ||
                              student.sectionName ||
                              null;
                            if (!raw) return "N/A";
                            if (typeof raw === "string" || typeof raw === "number") return String(raw);
                            return String(raw.section_name ?? raw.name ?? raw.sectionName ?? raw.id ?? "N/A");
                          })();

                          const className = student?.Class ? (student.Class.class_name || student.Class.name || "N/A") : (student.class_name || "N/A");

                          return (
                            <tr key={student.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedStudentIds.includes(student.id)}
                                  onChange={(e) => handleStudentCheckbox(student.id, e.target.checked)}
                                />
                              </td>
                              <td>{student.name}</td>
                              <td>{className}</td>
                              <td>{sec}</td>
                            </tr>
                          );
                        })}

                        {visibleStudents.length === 0 && (
                          <tr>
                            <td colSpan={4} className="text-center">
                              No students found for the selected Class/Section.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                <button className="btn btn-primary" onClick={assignAssignment}>Assign</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

//
// ---------- Parent component that renders both sections ----------
//
const CombinedAssignments = () => {
  return (
    <div className="container mt-4">
      <h1>Assignment Management</h1>
      <Assignments />
      <hr />
      <h1>Assignment Distribution</h1>
      <GiveAssignmentToStudents />
    </div>
  );
};

export default CombinedAssignments;
