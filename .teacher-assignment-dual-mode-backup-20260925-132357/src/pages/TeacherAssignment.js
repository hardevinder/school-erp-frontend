import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./TeacherAssignment.css";

const normalizeTeacher = (t) => {
  const userId =
    t?.user_id ??
    t?.user?.id ??
    t?.User?.id ??
    (typeof t?.id === "number" && t?.roles ? t.id : null);
  const employeeId =
    t?.employee_id ?? t?.employee?.id ?? t?.Employee?.id ?? t?.emp_id ?? null;
  const id = userId ?? employeeId ?? t?.id;
  const name =
    t?.name ??
    t?.employee?.name ??
    t?.Employee?.name ??
    t?.user?.name ??
    t?.User?.name ??
    "Unnamed teacher";
  const department =
    t?.department?.name ??
    t?.employee?.department?.name ??
    t?.Employee?.department?.name ??
    "";
  const designation =
    t?.designation ?? t?.employee?.designation ?? t?.Employee?.designation ?? "";

  return {
    id: id != null ? Number(id) : null,
    userId: userId != null ? Number(userId) : null,
    employeeId: employeeId != null ? Number(employeeId) : null,
    name,
    department,
    designation,
  };
};

const naturalCompare = (a = "", b = "") =>
  String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const initials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "T";

const scopeKey = (classId, sectionId) => `${classId || "x"}:${sectionId || "x"}`;
const mappingKey = (classId, sectionId, subjectId) =>
  `${classId || "x"}:${sectionId || "x"}:${subjectId || "x"}`;

const TeacherAssignment = () => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [activeTeacherId, setActiveTeacherId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [pendingChanges, setPendingChanges] = useState({});
  const [loadingSections, setLoadingSections] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAssignments = async () => {
    const response = await api.get("/class-subject-teachers");
    const rows = Array.isArray(response.data) ? response.data : [];
    setAssignments(rows);
    return rows;
  };

  const fetchClasses = async () => {
    const response = await api.get("/classes");
    const rows = Array.isArray(response.data) ? response.data : [];
    const sorted = [...rows].sort((a, b) => naturalCompare(a.class_name, b.class_name));
    setClasses(sorted);
    return sorted;
  };

  const fetchSubjects = async () => {
    const response = await api.get("/subjects");
    const rows = Array.isArray(response.data)
      ? response.data
      : response.data?.subjects || [];
    const sorted = [...rows].sort((a, b) => naturalCompare(a.name, b.name));
    setSubjects(sorted);
    return sorted;
  };

  const fetchTeachers = async () => {
    const response = await api.get("/teachers");
    const raw = Array.isArray(response.data)
      ? response.data
      : response.data?.teachers || [];
    const rows = raw
      .map(normalizeTeacher)
      .filter((teacher) => teacher.id != null)
      .sort((a, b) => naturalCompare(a.name, b.name));
    setTeachers(rows);
    return rows;
  };

  const fetchSectionsForClass = async (classId) => {
    if (!classId) {
      setSections([]);
      setSelectedSectionId("");
      return [];
    }

    setLoadingSections(true);
    try {
      const response = await api.get(`/sections?class_id=${classId}`);
      const rows = Array.isArray(response.data) ? response.data : [];
      const sorted = [...rows].sort((a, b) => naturalCompare(a.section_name, b.section_name));
      setSections(sorted);

      setSelectedSectionId((current) => {
        if (sorted.some((section) => String(section.id) === String(current))) {
          return current;
        }
        return sorted[0]?.id != null ? String(sorted[0].id) : "";
      });
      return sorted;
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [classRows] = await Promise.all([
          fetchClasses(),
          fetchSubjects(),
          fetchTeachers(),
          fetchAssignments(),
        ]);

        if (!alive) return;
        if (classRows.length) {
          setSelectedClassId(String(classRows[0].id));
        }
      } catch (error) {
        console.error("Teacher assignment setup load failed:", error);
        Swal.fire("Unable to load", "Teacher assignment setup could not be loaded.", "error");
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    fetchSectionsForClass(selectedClassId).catch((error) => {
      console.error("Section load failed:", error);
      Swal.fire("Unable to load sections", "Please try selecting the class again.", "error");
    });
  }, [selectedClassId]);

  const teacherById = useMemo(() => {
    const map = new Map();
    teachers.forEach((teacher) => {
      map.set(String(teacher.id), teacher);
      if (teacher.userId != null) map.set(String(teacher.userId), teacher);
      if (teacher.employeeId != null && !map.has(String(teacher.employeeId))) {
        map.set(String(teacher.employeeId), teacher);
      }
    });
    return map;
  }, [teachers]);

  const assignmentByMappingKey = useMemo(() => {
    const map = new Map();
    assignments.forEach((assignment) => {
      const classId = assignment.Class?.id ?? assignment.class_id;
      const sectionId = assignment.Section?.id ?? assignment.section_id;
      const subjectId = assignment.Subject?.id ?? assignment.subject_id;
      if (classId == null || sectionId == null || subjectId == null) return;
      map.set(mappingKey(classId, sectionId, subjectId), assignment);
    });
    return map;
  }, [assignments]);

  const currentClass = useMemo(
    () => classes.find((item) => String(item.id) === String(selectedClassId)),
    [classes, selectedClassId]
  );

  const currentSection = useMemo(
    () => sections.find((item) => String(item.id) === String(selectedSectionId)),
    [sections, selectedSectionId]
  );

  const activeTeacher = useMemo(
    () => teacherById.get(String(activeTeacherId)) || null,
    [teacherById, activeTeacherId]
  );

  const currentScope = scopeKey(selectedClassId, selectedSectionId);

  const currentPendingCount = useMemo(
    () =>
      Object.values(pendingChanges).filter(
        (change) => scopeKey(change.class_id, change.section_id) === currentScope
      ).length,
    [pendingChanges, currentScope]
  );

  const totalPendingCount = Object.keys(pendingChanges).length;

  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter((teacher) =>
      [teacher.name, teacher.department, teacher.designation]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [teachers, teacherSearch]);

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) return subjects;
    return subjects.filter((subject) =>
      String(subject.name || "")
        .toLowerCase()
        .includes(query)
    );
  }, [subjects, subjectSearch]);

  const getExistingAssignment = (subjectId) =>
    assignmentByMappingKey.get(
      mappingKey(selectedClassId, selectedSectionId, subjectId)
    ) || null;

  const getPendingChange = (subjectId) =>
    pendingChanges[mappingKey(selectedClassId, selectedSectionId, subjectId)] || null;

  const getEffectiveTeacherId = (subjectId) => {
    const pending = getPendingChange(subjectId);
    if (pending) return pending.teacher_id == null ? null : Number(pending.teacher_id);

    const existing = getExistingAssignment(subjectId);
    const existingTeacherId = existing?.Teacher?.id ?? existing?.teacher_id;
    return existingTeacherId == null ? null : Number(existingTeacherId);
  };

  const getEffectiveTeacher = (subjectId) => {
    const teacherId = getEffectiveTeacherId(subjectId);
    if (teacherId == null) return null;
    return teacherById.get(String(teacherId)) || {
      id: teacherId,
      name: getExistingAssignment(subjectId)?.Teacher?.name || "Assigned teacher",
    };
  };

  const stageAssignment = (subjectId) => {
    if (!selectedClassId || !selectedSectionId || !activeTeacherId) return;

    const key = mappingKey(selectedClassId, selectedSectionId, subjectId);
    const existing = getExistingAssignment(subjectId);
    const existingTeacherId = existing?.Teacher?.id ?? existing?.teacher_id ?? null;
    const nextTeacherId = Number(activeTeacherId);

    setPendingChanges((previous) => {
      const next = { ...previous };

      if (
        existingTeacherId != null &&
        Number(existingTeacherId) === nextTeacherId
      ) {
        delete next[key];
        return next;
      }

      next[key] = {
        key,
        class_id: Number(selectedClassId),
        section_id: Number(selectedSectionId),
        subject_id: Number(subjectId),
        teacher_id: nextTeacherId,
        assignment_id: existing?.id ?? null,
        original_teacher_id:
          existingTeacherId == null ? null : Number(existingTeacherId),
      };
      return next;
    });
  };

  const stageUnassign = (subjectId, event) => {
    event?.stopPropagation?.();
    if (!selectedClassId || !selectedSectionId) return;

    const key = mappingKey(selectedClassId, selectedSectionId, subjectId);
    const existing = getExistingAssignment(subjectId);

    setPendingChanges((previous) => {
      const next = { ...previous };

      if (!existing) {
        delete next[key];
        return next;
      }

      const existingTeacherId = existing?.Teacher?.id ?? existing?.teacher_id ?? null;
      next[key] = {
        key,
        class_id: Number(selectedClassId),
        section_id: Number(selectedSectionId),
        subject_id: Number(subjectId),
        teacher_id: null,
        assignment_id: existing.id,
        original_teacher_id:
          existingTeacherId == null ? null : Number(existingTeacherId),
      };
      return next;
    });
  };

  const clearCurrentScopeChanges = () => {
    setPendingChanges((previous) => {
      const next = { ...previous };
      Object.entries(next).forEach(([key, change]) => {
        if (scopeKey(change.class_id, change.section_id) === currentScope) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const clearAllChanges = () => setPendingChanges({});

  const saveChanges = async () => {
    const changes = Object.values(pendingChanges);
    if (!changes.length || saving) return;

    setSaving(true);
    const succeeded = [];
    const failed = [];

    try {
      for (const change of changes) {
        try {
          if (change.assignment_id && change.teacher_id == null) {
            await api.delete(`/class-subject-teachers/${change.assignment_id}`);
          } else if (change.assignment_id) {
            await api.put(`/class-subject-teachers/${change.assignment_id}`, {
              class_id: change.class_id,
              section_id: change.section_id,
              subject_id: change.subject_id,
              teacher_id: change.teacher_id,
            });
          } else if (change.teacher_id != null) {
            await api.post("/class-subject-teachers", {
              class_id: change.class_id,
              section_id: change.section_id,
              subject_id: change.subject_id,
              teacher_id: change.teacher_id,
            });
          }
          succeeded.push(change.key);
        } catch (error) {
          failed.push({ change, error });
        }
      }

      await fetchAssignments();

      setPendingChanges((previous) => {
        const next = { ...previous };
        succeeded.forEach((key) => delete next[key]);
        return next;
      });

      if (!failed.length) {
        Swal.fire({
          icon: "success",
          title: "Assignments saved",
          text: `${succeeded.length} change${succeeded.length === 1 ? "" : "s"} saved successfully.`,
          timer: 1500,
          showConfirmButton: false,
        });
      } else {
        const firstMessage =
          failed[0]?.error?.response?.data?.message ||
          failed[0]?.error?.message ||
          "Some assignments could not be saved.";
        Swal.fire(
          "Partially saved",
          `${succeeded.length} saved, ${failed.length} failed. ${firstMessage}`,
          "warning"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const effectiveAssignedCount = useMemo(() => {
    if (!selectedClassId || !selectedSectionId) return 0;
    return subjects.reduce(
      (count, subject) => count + (getEffectiveTeacherId(subject.id) != null ? 1 : 0),
      0
    );
  }, [
    subjects,
    assignments,
    pendingChanges,
    selectedClassId,
    selectedSectionId,
  ]);

  const teacherSubjectCount = (teacherId) => {
    if (!selectedClassId || !selectedSectionId) return 0;
    return subjects.reduce(
      (count, subject) =>
        count +
        (Number(getEffectiveTeacherId(subject.id)) === Number(teacherId) ? 1 : 0),
      0
    );
  };

  return (
    <div className="container-fluid teacher-assignment-page">
      <section className="assignment-hero assignment-hero-compact">
        <div>
          <span className="assignment-eyebrow">Academic setup</span>
          <h1>Teacher & Subject Assignment</h1>
          <p>Select a class, pick a teacher, tap subjects, and save everything together.</p>
        </div>
        <div className="assignment-hero-status">
          <span className="hero-status-number">{totalPendingCount}</span>
          <span>pending changes</span>
        </div>
      </section>

      <section className="assignment-step-card class-picker-card">
        <div className="step-heading">
          <div className="step-number">1</div>
          <div>
            <h2>Choose class</h2>
            <p>Classes stay visible at the top so switching is instant.</p>
          </div>
        </div>
        <div className="class-button-grid" role="list" aria-label="Classes">
          {classes.map((item) => {
            const active = String(item.id) === String(selectedClassId);
            return (
              <button
                type="button"
                key={item.id}
                className={`class-select-button${active ? " active" : ""}`}
                onClick={() => {
                  setSelectedClassId(String(item.id));
                  setActiveTeacherId("");
                }}
              >
                <i className="bi bi-mortarboard" aria-hidden="true" />
                <span>{item.class_name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="assignment-step-card section-picker-card">
        <div className="step-heading section-step-heading">
          <div className="step-number">2</div>
          <div>
            <h2>Choose section</h2>
            <p>
              {currentClass?.class_name
                ? `Sections mapped with ${currentClass.class_name}`
                : "Select a class first"}
            </p>
          </div>
          <div className="scope-stats">
            <span>{effectiveAssignedCount}/{subjects.length} subjects assigned</span>
            {currentPendingCount > 0 && (
              <span className="pending-scope-pill">{currentPendingCount} changed</span>
            )}
          </div>
        </div>

        <div className="section-chip-row">
          {loadingSections ? (
            <span className="section-loading">
              <span className="spinner-border spinner-border-sm" /> Loading sections…
            </span>
          ) : sections.length ? (
            sections.map((section) => (
              <button
                type="button"
                key={section.id}
                className={`section-chip${
                  String(section.id) === String(selectedSectionId) ? " active" : ""
                }`}
                onClick={() => {
                  setSelectedSectionId(String(section.id));
                  setActiveTeacherId("");
                }}
              >
                {section.section_name}
              </button>
            ))
          ) : (
            <span className="empty-inline">No section is available for this class.</span>
          )}
        </div>
      </section>

      <section className="assignment-workspace">
        <aside className="teacher-panel assignment-step-card">
          <div className="panel-sticky-heading">
            <div className="step-heading">
              <div className="step-number">3</div>
              <div>
                <h2>Pick teacher</h2>
                <p>Choose one teacher, then tap all subjects they teach.</p>
              </div>
            </div>
            <div className="assignment-search-box">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={teacherSearch}
                onChange={(event) => setTeacherSearch(event.target.value)}
                placeholder="Search teacher"
                aria-label="Search teacher"
              />
            </div>
          </div>

          <div className="teacher-list">
            {filteredTeachers.map((teacher) => {
              const active = String(teacher.id) === String(activeTeacherId);
              const count = teacherSubjectCount(teacher.id);
              return (
                <button
                  type="button"
                  key={`${teacher.id}-${teacher.employeeId || ""}`}
                  className={`teacher-card-button${active ? " active" : ""}`}
                  onClick={() => setActiveTeacherId(String(teacher.id))}
                >
                  <span className="teacher-avatar">{initials(teacher.name)}</span>
                  <span className="teacher-card-copy">
                    <strong>{teacher.name}</strong>
                    <small>
                      {[teacher.department, teacher.designation].filter(Boolean).join(" · ") ||
                        "Teacher"}
                    </small>
                  </span>
                  <span className={`teacher-count${count ? " has-items" : ""}`}>{count}</span>
                  <i className="bi bi-chevron-right teacher-chevron" aria-hidden="true" />
                </button>
              );
            })}
            {!filteredTeachers.length && (
              <div className="assignment-empty-small">No teacher matches your search.</div>
            )}
          </div>
        </aside>

        <main className="subject-panel assignment-step-card">
          <div className="subject-panel-header">
            <div className="step-heading">
              <div className="step-number">4</div>
              <div>
                <h2>Assign subjects</h2>
                <p>
                  {activeTeacher
                    ? `Tap subjects for ${activeTeacher.name}. You can then pick another teacher without saving.`
                    : "Select a teacher from the left to start assigning subjects."}
                </p>
              </div>
            </div>
            <div className="assignment-search-box subject-search-box">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                value={subjectSearch}
                onChange={(event) => setSubjectSearch(event.target.value)}
                placeholder="Search subject"
                aria-label="Search subject"
              />
            </div>
          </div>

          {activeTeacher && (
            <div className="active-teacher-banner">
              <span className="teacher-avatar large">{initials(activeTeacher.name)}</span>
              <div>
                <span>Assigning subjects to</span>
                <strong>{activeTeacher.name}</strong>
              </div>
              <span className="active-teacher-count">
                {teacherSubjectCount(activeTeacher.id)} subject
                {teacherSubjectCount(activeTeacher.id) === 1 ? "" : "s"}
              </span>
            </div>
          )}

          <div className={`subject-grid${!activeTeacher ? " disabled-grid" : ""}`}>
            {filteredSubjects.map((subject) => {
              const existing = getExistingAssignment(subject.id);
              const pending = getPendingChange(subject.id);
              const teacher = getEffectiveTeacher(subject.id);
              const effectiveTeacherId = getEffectiveTeacherId(subject.id);
              const selectedForActive =
                activeTeacherId && Number(effectiveTeacherId) === Number(activeTeacherId);
              const isChanged = Boolean(pending);
              const isUnassignedPending = Boolean(pending && pending.teacher_id == null);
              const originalTeacherName = existing?.Teacher?.name || "";
              const reassigned =
                isChanged &&
                pending.teacher_id != null &&
                pending.original_teacher_id != null &&
                Number(pending.original_teacher_id) !== Number(pending.teacher_id);

              return (
                <div
                  key={subject.id}
                  className={`subject-tile${selectedForActive ? " selected" : ""}${
                    isChanged ? " changed" : ""
                  }${teacher ? " assigned" : ""}${
                    isUnassignedPending ? " pending-remove" : ""
                  }`}
                  role="button"
                  tabIndex={activeTeacher ? 0 : -1}
                  aria-disabled={!activeTeacher}
                  onClick={() => activeTeacher && stageAssignment(subject.id)}
                  onKeyDown={(event) => {
                    if (!activeTeacher) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      stageAssignment(subject.id);
                    }
                  }}
                >
                  <div className="subject-tile-topline">
                    <span className="subject-icon">
                      <i className="bi bi-book" aria-hidden="true" />
                    </span>
                    {isChanged && <span className="changed-dot">Changed</span>}
                  </div>
                  <strong className="subject-name">{subject.name}</strong>

                  {isUnassignedPending ? (
                    <span className="subject-owner pending-owner">Will be unassigned</span>
                  ) : teacher ? (
                    <span className="subject-owner">
                      <i className="bi bi-person-check" aria-hidden="true" />
                      {teacher.name}
                    </span>
                  ) : (
                    <span className="subject-owner unassigned-owner">Not assigned</span>
                  )}

                  {reassigned && originalTeacherName && (
                    <span className="reassign-note">was {originalTeacherName}</span>
                  )}

                  {(teacher || existing) && !isUnassignedPending && (
                    <button
                      type="button"
                      className="subject-unassign-button"
                      title={`Unassign ${subject.name}`}
                      aria-label={`Unassign ${subject.name}`}
                      onClick={(event) => stageUnassign(subject.id, event)}
                    >
                      <i className="bi bi-x-lg" aria-hidden="true" />
                    </button>
                  )}

                  {selectedForActive && (
                    <span className="subject-selected-check">
                      <i className="bi bi-check2" aria-hidden="true" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {!filteredSubjects.length && (
            <div className="assignment-empty-small subject-empty">
              No subject matches your search.
            </div>
          )}
        </main>
      </section>

      <div className={`assignment-save-bar${totalPendingCount ? " visible" : ""}`}>
        <div className="save-summary">
          <span className="save-count">{totalPendingCount}</span>
          <div>
            <strong>Unsaved assignment changes</strong>
            <span>
              Current: {currentClass?.class_name || "—"} / {currentSection?.section_name || "—"}
            </span>
          </div>
        </div>
        <div className="save-actions">
          {currentPendingCount > 0 && (
            <button
              type="button"
              className="btn btn-light"
              onClick={clearCurrentScopeChanges}
              disabled={saving}
            >
              Reset this section
            </button>
          )}
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={clearAllChanges}
            disabled={!totalPendingCount || saving}
          >
            Clear all
          </button>
          <button
            type="button"
            className="btn btn-primary assignment-save-button"
            onClick={saveChanges}
            disabled={!totalPendingCount || saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm" /> Saving…
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle" aria-hidden="true" /> Save all changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherAssignment;
