import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./SyllabusTeacherAssignment.css";

const BASE = "/class-subject-syllabus-teachers";

const naturalCompare = (a = "", b = "") =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });

const initials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "T";

const normalizeTeacher = (t) => {
  const userId =
    t?.user_id ??
    t?.user?.id ??
    t?.User?.id ??
    (typeof t?.id === "number" && t?.roles ? t.id : null);
  const employeeId =
    t?.employee_id ?? t?.employee?.id ?? t?.Employee?.id ?? t?.emp_id ?? null;
  const id = userId ?? employeeId ?? t?.id;

  return {
    id: id != null ? Number(id) : null,
    userId: userId != null ? Number(userId) : null,
    employeeId: employeeId != null ? Number(employeeId) : null,
    name:
      t?.name ??
      t?.employee?.name ??
      t?.Employee?.name ??
      t?.user?.name ??
      t?.User?.name ??
      "Unnamed teacher",
    department:
      t?.department?.name ??
      t?.employee?.department?.name ??
      t?.Employee?.department?.name ??
      "",
    designation:
      t?.designation ?? t?.employee?.designation ?? t?.Employee?.designation ?? "",
  };
};

const mappingKey = (classId, subjectId) => `${classId || "x"}:${subjectId || "x"}`;

const SyllabusTeacherAssignment = () => {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);

  const [mode, setMode] = useState("teacher");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [classSearch, setClassSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
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
    const rows = Array.isArray(response.data) ? response.data : response.data?.subjects || [];
    const sorted = [...rows].sort((a, b) => naturalCompare(a.name, b.name));
    setSubjects(sorted);
    return sorted;
  };

  const fetchTeachers = async () => {
    const response = await api.get("/teachers");
    const raw = Array.isArray(response.data) ? response.data : response.data?.teachers || [];
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
  const currentTeacher = useMemo(
    () => teacherById.get(String(selectedTeacherId)) || null,
    [teacherById, selectedTeacherId]
  );
  const currentSubject = useMemo(
    () => subjects.find((item) => String(item.id) === String(selectedSubjectId)) || null,
    [subjects, selectedSubjectId]
  );

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    if (!query) return classes;
    return classes.filter((item) =>
      String(item.class_name || "").toLowerCase().includes(query)
    );
  }, [classes, classSearch]);

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
      String(subject.name || "").toLowerCase().includes(query)
    );
  }, [subjects, subjectSearch]);

  const getExistingAssignment = (subjectId, classId = selectedClassId) =>
    assignmentByKey.get(mappingKey(classId, subjectId)) || null;

  const getPendingChange = (subjectId, classId = selectedClassId) =>
    pendingChanges[mappingKey(classId, subjectId)] || null;

  const getEffectiveTeacherId = (subjectId, classId = selectedClassId) => {
    const pending = getPendingChange(subjectId, classId);
    if (pending) return pending.teacher_id == null ? null : Number(pending.teacher_id);
    const existing = getExistingAssignment(subjectId, classId);
    const teacherId = existing?.Teacher?.id ?? existing?.teacher_id;
    return teacherId == null ? null : Number(teacherId);
  };

  const getEffectiveTeacher = (subjectId) => {
    const teacherId = getEffectiveTeacherId(subjectId);
    if (teacherId == null) return null;
    const existing = getExistingAssignment(subjectId);
    return teacherById.get(String(teacherId)) || {
      id: teacherId,
      name: existing?.Teacher?.name || "Assigned teacher",
    };
  };

  const stageTeacherForSubject = (subjectId, teacherId) => {
    if (!selectedClassId || !subjectId || !teacherId) return;
    const key = mappingKey(selectedClassId, subjectId);
    const existing = getExistingAssignment(subjectId);
    const existingTeacherId = existing?.Teacher?.id ?? existing?.teacher_id ?? null;
    const nextTeacherId = Number(teacherId);

    setPendingChanges((previous) => {
      const next = { ...previous };
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
        original_teacher_id: existingTeacherId == null ? null : Number(existingTeacherId),
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
        original_teacher_id: existingTeacherId == null ? null : Number(existingTeacherId),
      };
      return next;
    });
  };

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
            if (change.assignment_id) await api.delete(`${BASE}/${change.assignment_id}`);
          } else {
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
        const message =
          failed[0]?.error?.response?.data?.message ||
          failed[0]?.error?.message ||
          "Some syllabus assignments could not be saved.";
        Swal.fire(
          "Partially saved",
          `${succeeded.length} saved, ${failed.length} failed. ${message}`,
          "warning"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const currentPendingCount = useMemo(
    () =>
      Object.values(pendingChanges).filter(
        (change) => String(change.class_id) === String(selectedClassId)
      ).length,
    [pendingChanges, selectedClassId]
  );

  const teacherSubjectCount = (teacherId) => {
    if (!selectedClassId) return 0;
    return subjects.reduce(
      (count, subject) =>
        count + (Number(getEffectiveTeacherId(subject.id)) === Number(teacherId) ? 1 : 0),
      0
    );
  };

  const totalPendingCount = Object.keys(pendingChanges).length;

  const clearCurrentClass = () => {
    setPendingChanges((previous) => {
      const next = { ...previous };
      Object.entries(next).forEach(([key, change]) => {
        if (String(change.class_id) === String(selectedClassId)) delete next[key];
      });
      return next;
    });
  };

  const renderPinned = () => (
    <section className="sta3-pinned">
      <div className="sta3-pin-label"><i className="bi bi-pin-angle-fill" /> Pinned selections</div>
      <div className="sta3-pin-list">
        {currentTeacher && (
          <span className={`sta3-pin ${mode === "teacher" ? "primary" : ""}`}>
            <i className="bi bi-person-fill" /> Teacher: <strong>{currentTeacher.name}</strong>
          </span>
        )}
        {currentClass && (
          <span className={`sta3-pin ${mode === "class" ? "primary" : ""}`}>
            <i className="bi bi-mortarboard-fill" /> Class: <strong>{currentClass.class_name}</strong>
          </span>
        )}
        {currentSubject && (
          <span className={`sta3-pin ${mode === "subject" ? "primary" : ""}`}>
            <i className="bi bi-book-fill" /> Subject: <strong>{currentSubject.name}</strong>
          </span>
        )}
        {!currentTeacher && !currentClass && !currentSubject && (
          <span className="sta3-pin-empty">Choose an item below. Search never clears a selection.</span>
        )}
      </div>
    </section>
  );

  const renderClassPicker = (step) => (
    <section className="sta3-card">
      <div className="sta3-card-head">
        <div className="sta3-step">{step}</div>
        <div>
          <h2>Choose class</h2>
          <p>Your teacher or subject stays selected when you move to another class.</p>
        </div>
        <div className="sta3-search">
          <i className="bi bi-search" />
          <input
            type="search"
            value={classSearch}
            onChange={(e) => setClassSearch(e.target.value)}
            placeholder="Filter classes"
          />
        </div>
      </div>
      <div className="sta3-class-grid">
        {filteredClasses.map((item) => (
          <button
            type="button"
            key={item.id}
            className={String(item.id) === String(selectedClassId) ? "active" : ""}
            onClick={() => setSelectedClassId(String(item.id))}
          >
            {item.class_name}
          </button>
        ))}
        {!filteredClasses.length && <div className="sta3-empty">No class matches this filter.</div>}
      </div>
    </section>
  );

  const renderTeacherPicker = (step, assignSelectedSubject = false) => {
    const effectiveSubjectTeacherId = selectedSubjectId
      ? getEffectiveTeacherId(selectedSubjectId)
      : null;

    return (
      <section className="sta3-card">
        <div className="sta3-card-head">
          <div className="sta3-step">{step}</div>
          <div>
            <h2>{assignSelectedSubject ? "Choose teacher" : "Select teacher"}</h2>
            <p>
              {assignSelectedSubject
                ? currentSubject
                  ? `Click a teacher to assign ${currentSubject.name}.`
                  : "Choose a subject first."
                : "Teacher remains pinned while you change class or filter the list."}
            </p>
          </div>
          <div className="sta3-search">
            <i className="bi bi-search" />
            <input
              type="search"
              value={teacherSearch}
              onChange={(e) => setTeacherSearch(e.target.value)}
              placeholder="Filter teachers"
            />
          </div>
        </div>

        {assignSelectedSubject && currentSubject && effectiveSubjectTeacherId != null && (
          <div className="sta3-current-owner">
            <span>Currently assigned to</span>
            <strong>
              {teacherById.get(String(effectiveSubjectTeacherId))?.name ||
                getExistingAssignment(currentSubject.id)?.Teacher?.name ||
                "Assigned teacher"}
            </strong>
            <button type="button" onClick={(e) => stageUnassign(currentSubject.id, e)}>Unassign</button>
          </div>
        )}

        <div className="sta3-teacher-grid">
          {filteredTeachers.map((teacher) => {
            const active = String(teacher.id) === String(selectedTeacherId);
            const isOwner =
              assignSelectedSubject &&
              effectiveSubjectTeacherId != null &&
              Number(effectiveSubjectTeacherId) === Number(teacher.id);
            return (
              <button
                type="button"
                key={`${teacher.id}-${teacher.employeeId || ""}`}
                className={`${active ? "active" : ""}${isOwner ? " owner" : ""}`}
                onClick={() => {
                  setSelectedTeacherId(String(teacher.id));
                  if (assignSelectedSubject && selectedSubjectId) {
                    stageTeacherForSubject(selectedSubjectId, teacher.id);
                  }
                }}
              >
                <span className="sta3-avatar">{initials(teacher.name)}</span>
                <span className="sta3-teacher-copy">
                  <strong>{teacher.name}</strong>
                  <small>{[teacher.department, teacher.designation].filter(Boolean).join(" · ") || "Teacher"}</small>
                </span>
                {!assignSelectedSubject && <span className="sta3-count">{teacherSubjectCount(teacher.id)}</span>}
                {isOwner && <span className="sta3-owner-badge">Assigned</span>}
              </button>
            );
          })}
          {!filteredTeachers.length && <div className="sta3-empty">No teacher matches this filter.</div>}
        </div>
      </section>
    );
  };

  const renderSubjectPicker = (step, chooseOnly = false) => (
    <section className="sta3-card">
      <div className="sta3-card-head">
        <div className="sta3-step">{step}</div>
        <div>
          <h2>{chooseOnly ? "Choose subject" : "Assign subjects"}</h2>
          <p>
            {chooseOnly
              ? "Subject remains pinned while you change class or filter the list."
              : currentTeacher
              ? `Tap subjects to assign them to ${currentTeacher.name}.`
              : "Select a teacher first, then tap one or more subjects."}
          </p>
        </div>
        <div className="sta3-search">
          <i className="bi bi-search" />
          <input
            type="search"
            value={subjectSearch}
            onChange={(e) => setSubjectSearch(e.target.value)}
            placeholder="Filter subjects"
          />
        </div>
      </div>

      <div className="sta3-subject-grid">
        {filteredSubjects.map((subject) => {
          const pending = getPendingChange(subject.id);
          const existing = getExistingAssignment(subject.id);
          const teacher = getEffectiveTeacher(subject.id);
          const selected = String(subject.id) === String(selectedSubjectId);
          const forPinnedTeacher =
            currentTeacher && Number(getEffectiveTeacherId(subject.id)) === Number(currentTeacher.id);
          const removed = Boolean(pending && pending.teacher_id == null);
          const reassigned =
            pending?.teacher_id != null &&
            pending?.original_teacher_id != null &&
            Number(pending.teacher_id) !== Number(pending.original_teacher_id);

          return (
            <div
              key={subject.id}
              role="button"
              tabIndex={0}
              className={[
                "sta3-subject",
                selected ? "active" : "",
                forPinnedTeacher ? "for-pinned" : "",
                pending ? "changed" : "",
                removed ? "removed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setSelectedSubjectId(String(subject.id));
                if (!chooseOnly && selectedTeacherId) {
                  stageTeacherForSubject(subject.id, selectedTeacherId);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedSubjectId(String(subject.id));
                  if (!chooseOnly && selectedTeacherId) {
                    stageTeacherForSubject(subject.id, selectedTeacherId);
                  }
                }
              }}
            >
              <span className="sta3-subject-icon"><i className="bi bi-book" /></span>
              <strong>{subject.name}</strong>
              {removed ? (
                <small className="danger">Will be unassigned</small>
              ) : teacher ? (
                <small><i className="bi bi-person-check" /> {teacher.name}</small>
              ) : (
                <small className="muted">Not assigned</small>
              )}
              {reassigned && existing?.Teacher?.name && <em>was {existing.Teacher.name}</em>}
              {pending && <span className="sta3-change">Changed</span>}
              {!chooseOnly && (teacher || existing) && !removed && (
                <button
                  type="button"
                  className="sta3-unassign"
                  title={`Unassign ${subject.name}`}
                  onClick={(e) => stageUnassign(subject.id, e)}
                >
                  <i className="bi bi-x-lg" />
                </button>
              )}
            </div>
          );
        })}
        {!filteredSubjects.length && <div className="sta3-empty">No subject matches this filter.</div>}
      </div>
    </section>
  );

  if (loading) {
    return (
      <div className="sta3-page">
        <div className="sta3-loading"><span className="spinner-border spinner-border-sm" /> Loading syllabus assignments…</div>
      </div>
    );
  }

  return (
    <div className="sta3-page">
      <section className="sta3-hero">
        <div>
          <span>Academic setup</span>
          <h1>Syllabus Teacher Assignment</h1>
          <p>Start with Teacher, Class, or Subject. Search only filters the list; it never clears your selection.</p>
        </div>
        <div className="sta3-hero-count">
          <strong>{totalPendingCount}</strong>
          <small>pending changes</small>
        </div>
      </section>

      <section className="sta3-mode-card">
        <div>
          <strong>How do you want to start?</strong>
          <small>Switch mode anytime. Your selected teacher, class, and subject stay pinned.</small>
        </div>
        <div className="sta3-modes">
          <button type="button" className={mode === "teacher" ? "active" : ""} onClick={() => setMode("teacher")}>
            <i className="bi bi-person-fill" /> By Teacher
          </button>
          <button type="button" className={mode === "class" ? "active" : ""} onClick={() => setMode("class")}>
            <i className="bi bi-mortarboard-fill" /> By Class
          </button>
          <button type="button" className={mode === "subject" ? "active" : ""} onClick={() => setMode("subject")}>
            <i className="bi bi-book-fill" /> By Subject
          </button>
        </div>
      </section>

      {renderPinned()}

      <div className="sta3-flow">
        {mode === "teacher" && (
          <>
            {renderTeacherPicker(1, false)}
            {renderClassPicker(2)}
            {renderSubjectPicker(3, false)}
          </>
        )}
        {mode === "class" && (
          <>
            {renderClassPicker(1)}
            {renderTeacherPicker(2, false)}
            {renderSubjectPicker(3, false)}
          </>
        )}
        {mode === "subject" && (
          <>
            {renderSubjectPicker(1, true)}
            {renderClassPicker(2)}
            {renderTeacherPicker(3, true)}
          </>
        )}
      </div>

      <div className={`sta3-savebar${totalPendingCount ? " visible" : ""}`}>
        <div>
          <strong>{totalPendingCount} unsaved change{totalPendingCount === 1 ? "" : "s"}</strong>
          <small>
            {currentPendingCount} in {currentClass?.class_name || "current class"}. Keep assigning other classes before saving if you want.
          </small>
        </div>
        <div className="sta3-save-actions">
          <button type="button" className="secondary" disabled={!currentPendingCount || saving} onClick={clearCurrentClass}>
            Reset current class
          </button>
          <button type="button" className="secondary" disabled={!totalPendingCount || saving} onClick={() => setPendingChanges({})}>
            Clear all
          </button>
          <button type="button" className="primary" disabled={!totalPendingCount || saving} onClick={saveChanges}>
            {saving ? <><span className="spinner-border spinner-border-sm" /> Saving…</> : <><i className="bi bi-check2-circle" /> Save all changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyllabusTeacherAssignment;
