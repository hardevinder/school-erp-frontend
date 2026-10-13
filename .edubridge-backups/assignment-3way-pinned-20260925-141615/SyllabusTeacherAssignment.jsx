import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./SyllabusTeacherAssignment.css";

const BASE = "/class-subject-syllabus-teachers";

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

const normalizeTeacher = (t) => {
  // /teachers returns Employee.id as `id` and User.id as `user_id`.
  // Syllabus assignment stores User.id, so always prefer user_id when available.
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

const mappingKey = (classId, subjectId) => `${classId || "x"}:${subjectId || "x"}`;

const SyllabusTeacherAssignment = () => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [assignmentMode, setAssignmentMode] = useState("subject");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [activeSubjectId, setActiveSubjectId] = useState("");
  const [activeTeacherId, setActiveTeacherId] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const [pendingChanges, setPendingChanges] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAssignments = async () => {
    const response = await api.get(BASE);
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

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [classRows] = await Promise.all([
          fetchClasses(),
          fetchSubjects(),
          fetchTeachers(),
          fetchAssignments(),
        ]);

        if (!alive) return;
        if (classRows.length) setSelectedClassId(String(classRows[0].id));
      } catch (error) {
        console.error("Syllabus teacher assignment load failed:", error);
        Swal.fire(
          "Unable to load",
          error?.response?.data?.message || "Syllabus teacher assignment data could not be loaded.",
          "error"
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const teacherById = useMemo(() => {
    const map = new Map();
    teachers.forEach((teacher) => {
      if (teacher.id != null) map.set(String(teacher.id), teacher);
      if (teacher.userId != null) map.set(String(teacher.userId), teacher);
      if (teacher.employeeId != null && !map.has(String(teacher.employeeId))) {
        map.set(String(teacher.employeeId), teacher);
      }
    });
    return map;
  }, [teachers]);

  const assignmentByKey = useMemo(() => {
    const map = new Map();
    assignments.forEach((assignment) => {
      const classId = assignment.Class?.id ?? assignment.class_id;
      const subjectId = assignment.Subject?.id ?? assignment.subject_id;
      if (classId == null || subjectId == null) return;
      map.set(mappingKey(classId, subjectId), assignment);
    });
    return map;
  }, [assignments]);

  const currentClass = useMemo(
    () => classes.find((item) => String(item.id) === String(selectedClassId)) || null,
    [classes, selectedClassId]
  );

  const activeSubject = useMemo(
    () => subjects.find((item) => String(item.id) === String(activeSubjectId)) || null,
    [subjects, activeSubjectId]
  );

  const activeTeacher = useMemo(
    () => teacherById.get(String(activeTeacherId)) || null,
    [teacherById, activeTeacherId]
  );

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter((item) =>
      String(item.class_name || "")
        .toLowerCase()
        .includes(query)
    );
  }, [classes, classSearch]);

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    if (!query) return subjects;
    return subjects.filter((item) =>
      String(item.name || "")
        .toLowerCase()
        .includes(query)
    );
  }, [subjects, subjectSearch]);

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

  const getExistingAssignment = (subjectId) =>
    assignmentByKey.get(mappingKey(selectedClassId, subjectId)) || null;

  const getPendingChange = (subjectId) =>
    pendingChanges[mappingKey(selectedClassId, subjectId)] || null;

  const getEffectiveTeacherId = (subjectId) => {
    const pending = getPendingChange(subjectId);
    if (pending) return pending.teacher_id == null ? null : Number(pending.teacher_id);

    const existing = getExistingAssignment(subjectId);
    const teacherId = existing?.Teacher?.id ?? existing?.teacher_id;
    return teacherId == null ? null : Number(teacherId);
  };

  const getEffectiveTeacher = (subjectId) => {
    const teacherId = getEffectiveTeacherId(subjectId);
    if (teacherId == null) return null;

    return (
      teacherById.get(String(teacherId)) || {
        id: teacherId,
        name: getExistingAssignment(subjectId)?.Teacher?.name || "Assigned teacher",
      }
    );
  };

  const currentPendingCount = useMemo(
    () =>
      Object.values(pendingChanges).filter(
        (change) => String(change.class_id) === String(selectedClassId)
      ).length,
    [pendingChanges, selectedClassId]
  );

  const totalPendingCount = Object.keys(pendingChanges).length;

  const effectiveAssignedCount = useMemo(() => {
    if (!selectedClassId) return 0;
    return subjects.reduce(
      (count, subject) => count + (getEffectiveTeacherId(subject.id) != null ? 1 : 0),
      0
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, assignments, pendingChanges, selectedClassId, teacherById]);

  const teacherSubjectCount = (teacherId) => {
    if (!selectedClassId) return 0;
    return subjects.reduce(
      (count, subject) =>
        count +
        (Number(getEffectiveTeacherId(subject.id)) === Number(teacherId) ? 1 : 0),
      0
    );
  };

  const selectClass = (classId) => {
    setSelectedClassId(String(classId));
    setActiveSubjectId("");
    setActiveTeacherId("");
    setSubjectSearch("");
    setTeacherSearch("");
  };

  const switchMode = (mode) => {
    setAssignmentMode(mode);
    setActiveSubjectId("");
    setActiveTeacherId("");
    setSubjectSearch("");
    setTeacherSearch("");
  };

  const stageTeacherForSubject = (subjectId, teacherId) => {
    if (!selectedClassId || !subjectId || !teacherId) return;

    const key = mappingKey(selectedClassId, subjectId);
    const existing = getExistingAssignment(subjectId);
    const existingTeacherId = existing?.Teacher?.id ?? existing?.teacher_id ?? null;
    const nextTeacherId = Number(teacherId);

    setPendingChanges((previous) => {
      const next = { ...previous };

      // Selecting the original teacher cancels an unsaved change.
      if (existingTeacherId != null && Number(existingTeacherId) === nextTeacherId) {
        delete next[key];
        return next;
      }

      next[key] = {
        key,
        class_id: Number(selectedClassId),
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
    if (!selectedClassId || !subjectId) return;

    const key = mappingKey(selectedClassId, subjectId);
    const existing = getExistingAssignment(subjectId);

    setPendingChanges((previous) => {
      const next = { ...previous };

      // A brand-new pending assignment can simply be cancelled.
      if (!existing) {
        delete next[key];
        return next;
      }

      const existingTeacherId = existing?.Teacher?.id ?? existing?.teacher_id ?? null;
      next[key] = {
        key,
        class_id: Number(selectedClassId),
        subject_id: Number(subjectId),
        teacher_id: null,
        assignment_id: existing.id,
        original_teacher_id:
          existingTeacherId == null ? null : Number(existingTeacherId),
      };
      return next;
    });
  };

  const clearCurrentClassChanges = () => {
    setPendingChanges((previous) => {
      const next = { ...previous };
      Object.entries(next).forEach(([key, change]) => {
        if (String(change.class_id) === String(selectedClassId)) delete next[key];
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
          if (change.teacher_id == null) {
            if (change.assignment_id) {
              await api.delete(`${BASE}/${change.assignment_id}`);
            }
          } else {
            // The upsert endpoint intentionally supports both new assignments and reassignments.
            await api.post(`${BASE}/upsert`, {
              class_id: change.class_id,
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
          title: "Syllabus assignments saved",
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

  const renderSubjectCard = (subject, teacherMode = false) => {
    const existing = getExistingAssignment(subject.id);
    const pending = getPendingChange(subject.id);
    const teacher = getEffectiveTeacher(subject.id);
    const effectiveTeacherId = getEffectiveTeacherId(subject.id);
    const isChanged = Boolean(pending);
    const pendingRemove = Boolean(pending && pending.teacher_id == null);
    const selectedForTeacher =
      teacherMode &&
      activeTeacherId &&
      Number(effectiveTeacherId) === Number(activeTeacherId);
    const activeInSubjectMode =
      !teacherMode && String(subject.id) === String(activeSubjectId);

    const originalTeacherName = existing?.Teacher?.name || "";
    const reassigned =
      isChanged &&
      pending?.teacher_id != null &&
      pending?.original_teacher_id != null &&
      Number(pending.original_teacher_id) !== Number(pending.teacher_id);

    const handleClick = () => {
      if (teacherMode) {
        if (activeTeacherId) stageTeacherForSubject(subject.id, activeTeacherId);
      } else {
        setActiveSubjectId(String(subject.id));
      }
    };

    const disabled = teacherMode && !activeTeacherId;

    return (
      <div
        key={subject.id}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={[
          "sta-subject-card",
          teacher ? "assigned" : "",
          isChanged ? "changed" : "",
          pendingRemove ? "pending-remove" : "",
          selectedForTeacher ? "selected" : "",
          activeInSubjectMode ? "active" : "",
          disabled ? "disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          if (!disabled) handleClick();
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
          }
        }}
      >
        <span className="sta-subject-card-top">
          <span className="sta-subject-icon">
            <i className="bi bi-book" aria-hidden="true" />
          </span>
          {isChanged && <span className="sta-change-badge">Changed</span>}
        </span>

        <strong>{subject.name}</strong>

        {pendingRemove ? (
          <small className="sta-owner sta-owner-remove">Will be unassigned</small>
        ) : teacher ? (
          <small className="sta-owner">
            <i className="bi bi-person-check" aria-hidden="true" /> {teacher.name}
          </small>
        ) : (
          <small className="sta-owner sta-owner-empty">Not assigned</small>
        )}

        {reassigned && originalTeacherName && (
          <small className="sta-was-label">was {originalTeacherName}</small>
        )}

        {(teacher || existing) && !pendingRemove && (
          <span
            role="button"
            tabIndex={0}
            className="sta-unassign-x"
            title={`Unassign ${subject.name}`}
            onClick={(event) => stageUnassign(subject.id, event)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                stageUnassign(subject.id, event);
              }
            }}
          >
            <i className="bi bi-x-lg" aria-hidden="true" />
          </span>
        )}

        {(selectedForTeacher || activeInSubjectMode) && (
          <span className="sta-selected-mark">
            <i
              className={`bi ${selectedForTeacher ? "bi-check2" : "bi-chevron-right"}`}
              aria-hidden="true"
            />
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container-fluid sta-page">
        <div className="sta-loading-card">
          <span className="spinner-border" role="status" aria-hidden="true" />
          <strong>Loading syllabus assignments…</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid sta-page">
      <section className="sta-hero">
        <div>
          <span className="sta-eyebrow">Academic setup</span>
          <h1>Syllabus Teacher Assignment</h1>
          <p>
            Select a class, assign all syllabus subjects from one screen, and save everything together.
          </p>
        </div>
        <div className="sta-hero-stat">
          <strong>{totalPendingCount}</strong>
          <span>pending changes</span>
        </div>
      </section>

      <section className="sta-card sta-mode-card">
        <div className="sta-mode-copy">
          <span>Assignment workflow</span>
          <strong>Choose the easiest way to work</strong>
          <small>Switch anytime — unsaved changes stay safe.</small>
        </div>

        <div className="sta-mode-switch" role="tablist" aria-label="Syllabus assignment workflow">
          <button
            type="button"
            role="tab"
            aria-selected={assignmentMode === "subject"}
            className={assignmentMode === "subject" ? "active" : ""}
            onClick={() => switchMode("subject")}
          >
            <i className="bi bi-journal-bookmark" aria-hidden="true" />
            <span>
              <strong>By Subject</strong>
              <small>Subject → Teacher</small>
            </span>
            <em>Recommended</em>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={assignmentMode === "teacher"}
            className={assignmentMode === "teacher" ? "active" : ""}
            onClick={() => switchMode("teacher")}
          >
            <i className="bi bi-person-badge" aria-hidden="true" />
            <span>
              <strong>By Teacher</strong>
              <small>Teacher → Subjects</small>
            </span>
          </button>
        </div>
      </section>

      <section className="sta-card sta-class-card">
        <div className="sta-section-heading">
          <span className="sta-step">1</span>
          <div>
            <h2>Choose class</h2>
            <p>Classes stay visible, so the coordinator can switch quickly.</p>
          </div>
          <div className="sta-class-summary">
            <strong>{effectiveAssignedCount}/{subjects.length}</strong>
            <span>subjects assigned</span>
            {currentPendingCount > 0 && (
              <em>{currentPendingCount} changed</em>
            )}
          </div>
        </div>

        {classes.length > 10 && (
          <div className="sta-compact-search sta-class-search">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              value={classSearch}
              onChange={(event) => setClassSearch(event.target.value)}
              placeholder="Find class"
              aria-label="Find class"
            />
          </div>
        )}

        <div className="sta-class-buttons">
          {filteredClasses.map((item) => (
            <button
              type="button"
              key={item.id}
              className={String(item.id) === String(selectedClassId) ? "active" : ""}
              onClick={() => selectClass(item.id)}
            >
              <i className="bi bi-mortarboard" aria-hidden="true" />
              {item.class_name}
            </button>
          ))}
        </div>
      </section>

      {assignmentMode === "subject" ? (
        <section className="sta-workspace">
          <aside className="sta-card sta-side-panel">
            <div className="sta-panel-head">
              <div className="sta-section-heading compact">
                <span className="sta-step">2</span>
                <div>
                  <h2>Pick subject</h2>
                  <p>{currentClass?.class_name || "Select a class"}</p>
                </div>
              </div>
              <div className="sta-compact-search">
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

            <div className="sta-subject-list">
              {filteredSubjects.map((subject) => renderSubjectCard(subject, false))}
              {!filteredSubjects.length && (
                <div className="sta-empty">No subject matches your search.</div>
              )}
            </div>
          </aside>

          <main className="sta-card sta-main-panel">
            <div className="sta-panel-head sta-main-head">
              <div className="sta-section-heading compact">
                <span className="sta-step">3</span>
                <div>
                  <h2>Choose teacher</h2>
                  <p>
                    {activeSubject
                      ? `Assign ${activeSubject.name} and then choose the next subject.`
                      : "Select a subject first."}
                  </p>
                </div>
              </div>

              <div className="sta-compact-search">
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

            {activeSubject && (
              <div className="sta-active-banner">
                <span className="sta-active-icon">
                  <i className="bi bi-book" aria-hidden="true" />
                </span>
                <div>
                  <span>Assign teacher for</span>
                  <strong>{activeSubject.name}</strong>
                  <small>
                    Current: {getEffectiveTeacher(activeSubject.id)?.name || "Not assigned"}
                  </small>
                </div>
                {getEffectiveTeacherId(activeSubject.id) != null && (
                  <button
                    type="button"
                    onClick={(event) => stageUnassign(activeSubject.id, event)}
                  >
                    <i className="bi bi-x-circle" aria-hidden="true" /> Unassign
                  </button>
                )}
              </div>
            )}

            <div className={`sta-teacher-grid${!activeSubject ? " disabled" : ""}`}>
              {filteredTeachers.map((teacher) => {
                const selected =
                  activeSubject &&
                  Number(getEffectiveTeacherId(activeSubject.id)) === Number(teacher.id);
                const count = teacherSubjectCount(teacher.id);

                return (
                  <button
                    type="button"
                    key={`${teacher.id}-${teacher.employeeId || ""}`}
                    className={`sta-teacher-card${selected ? " selected" : ""}`}
                    disabled={!activeSubject}
                    onClick={() =>
                      activeSubject && stageTeacherForSubject(activeSubject.id, teacher.id)
                    }
                  >
                    <span className="sta-avatar">{initials(teacher.name)}</span>
                    <span className="sta-teacher-copy">
                      <strong>{teacher.name}</strong>
                      <small>
                        {[teacher.department, teacher.designation].filter(Boolean).join(" · ") ||
                          "Teacher"}
                      </small>
                      <em>
                        {count} syllabus subject{count === 1 ? "" : "s"} in this class
                      </em>
                    </span>
                    {selected ? (
                      <span className="sta-assigned-pill">
                        <i className="bi bi-check2" aria-hidden="true" /> Assigned
                      </span>
                    ) : (
                      <i className="bi bi-chevron-right sta-chevron" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>

            {!filteredTeachers.length && (
              <div className="sta-empty">No teacher matches your search.</div>
            )}
          </main>
        </section>
      ) : (
        <section className="sta-workspace">
          <aside className="sta-card sta-side-panel">
            <div className="sta-panel-head">
              <div className="sta-section-heading compact">
                <span className="sta-step">2</span>
                <div>
                  <h2>Pick teacher</h2>
                  <p>Then tap every syllabus subject they handle.</p>
                </div>
              </div>
              <div className="sta-compact-search">
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

            <div className="sta-teacher-list">
              {filteredTeachers.map((teacher) => {
                const active = String(teacher.id) === String(activeTeacherId);
                const count = teacherSubjectCount(teacher.id);

                return (
                  <button
                    type="button"
                    key={`${teacher.id}-${teacher.employeeId || ""}`}
                    className={active ? "active" : ""}
                    onClick={() => setActiveTeacherId(String(teacher.id))}
                  >
                    <span className="sta-avatar">{initials(teacher.name)}</span>
                    <span className="sta-teacher-copy">
                      <strong>{teacher.name}</strong>
                      <small>
                        {[teacher.department, teacher.designation].filter(Boolean).join(" · ") ||
                          "Teacher"}
                      </small>
                    </span>
                    <span className="sta-count-pill">{count}</span>
                    <i className="bi bi-chevron-right sta-chevron" aria-hidden="true" />
                  </button>
                );
              })}

              {!filteredTeachers.length && (
                <div className="sta-empty">No teacher matches your search.</div>
              )}
            </div>
          </aside>

          <main className="sta-card sta-main-panel">
            <div className="sta-panel-head sta-main-head">
              <div className="sta-section-heading compact">
                <span className="sta-step">3</span>
                <div>
                  <h2>Assign subjects</h2>
                  <p>
                    {activeTeacher
                      ? `Tap all syllabus subjects for ${activeTeacher.name}.`
                      : "Select a teacher first."}
                  </p>
                </div>
              </div>
              <div className="sta-compact-search">
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
              <div className="sta-active-banner sta-active-teacher">
                <span className="sta-avatar large">{initials(activeTeacher.name)}</span>
                <div>
                  <span>Assigning syllabus subjects to</span>
                  <strong>{activeTeacher.name}</strong>
                  <small>{teacherSubjectCount(activeTeacher.id)} currently assigned</small>
                </div>
              </div>
            )}

            <div className={`sta-subject-grid${!activeTeacher ? " disabled" : ""}`}>
              {filteredSubjects.map((subject) => renderSubjectCard(subject, true))}
            </div>

            {!filteredSubjects.length && (
              <div className="sta-empty">No subject matches your search.</div>
            )}
          </main>
        </section>
      )}

      <div className={`sta-save-bar${totalPendingCount ? " visible" : ""}`}>
        <div className="sta-save-summary">
          <span>{totalPendingCount}</span>
          <div>
            <strong>Unsaved syllabus assignment changes</strong>
            <small>Current class: {currentClass?.class_name || "—"}</small>
          </div>
        </div>

        <div className="sta-save-actions">
          {currentPendingCount > 0 && (
            <button
              type="button"
              className="sta-btn-neutral"
              onClick={clearCurrentClassChanges}
              disabled={saving}
            >
              Reset this class
            </button>
          )}
          <button
            type="button"
            className="sta-btn-outline"
            onClick={clearAllChanges}
            disabled={!totalPendingCount || saving}
          >
            Clear all
          </button>
          <button
            type="button"
            className="sta-btn-save"
            onClick={saveChanges}
            disabled={!totalPendingCount || saving}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm" aria-hidden="true" /> Saving…
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

export default SyllabusTeacherAssignment;
