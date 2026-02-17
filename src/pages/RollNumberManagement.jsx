import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import { Button, Form, Tabs, Tab, Badge, InputGroup } from "react-bootstrap";

// DnD Kit imports
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- helpers ---
const onlyDigits = (val) => (val || "").toString().replace(/\D/g, "");

// Allow digits + essential control keys
const isAllowedKey = (e) => {
  const allowed = [
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Tab",
    "Home",
    "End",
    "Enter",
  ];
  if (allowed.includes(e.key)) return true;

  // Allow Ctrl/Cmd shortcuts: copy/paste/select all/cut
  if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase()))
    return true;

  // Digits only
  return /^[0-9]$/.test(e.key);
};

const focusAndSelect = (el) => {
  if (!el) return;
  el.focus();
  requestAnimationFrame(() => {
    try {
      el.select?.();
    } catch {
      // ignore
    }
  });
};

// Sortable Row Component
const SortableStudentRow = ({
  student,
  index,
  onRollChange,
  onToggle,
  registerRollRef,
  focusNextRoll,
  focusPrevRoll,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: student.id.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.75 : 1,
    background: isDragging ? "#f8fafc" : undefined,
  };

  const rollValue =
    student.roll_number === null || student.roll_number === undefined
      ? ""
      : String(student.roll_number);

  return (
    <tr ref={setNodeRef} style={style}>
      <td className="text-muted" style={{ width: 55 }}>
        {index + 1}
      </td>

      {/* Drag handle only */}
      <td style={{ width: 46 }}>
        <span
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          style={{
            cursor: "grab",
            userSelect: "none",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          ☰
        </span>
      </td>

      <td style={{ fontWeight: 600 }}>{student.name}</td>
      <td className="text-muted">{student.admission_number}</td>
      <td>{student.Class?.class_name || "-"}</td>
      <td>{student.Section?.section_name || "-"}</td>

      <td style={{ width: 140 }}>
        <Form.Control
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={rollValue}
          ref={(el) => registerRollRef(student.id, el)}
          onFocus={(e) => {
            focusAndSelect(e.target);
          }}
          onKeyDown={(e) => {
            if (!isAllowedKey(e)) e.preventDefault();

            if (e.key === "Enter" || e.key === "ArrowDown") {
              e.preventDefault();
              focusNextRoll(student.id, true);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              focusPrevRoll(student.id, true);
              return;
            }
          }}
          onChange={(e) => {
            const cleaned = onlyDigits(e.target.value);
            onRollChange(student.id, cleaned === "" ? null : parseInt(cleaned, 10));
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            const cleaned = onlyDigits(text);
            e.preventDefault();
            onRollChange(student.id, cleaned === "" ? null : parseInt(cleaned, 10));
          }}
          style={{
            width: 110,
            fontWeight: 700,
            letterSpacing: 0.4,
          }}
        />
      </td>

      <td style={{ width: 90 }}>
        {student.visible ? (
          <Badge bg="success">Visible</Badge>
        ) : (
          <Badge bg="secondary">Hidden</Badge>
        )}
      </td>

      <td style={{ width: 120 }}>
        <Button
          variant={student.visible ? "outline-danger" : "outline-success"}
          size="sm"
          onClick={() => onToggle(student.id)}
        >
          {student.visible ? "Hide" : "Show"}
        </Button>
      </td>
    </tr>
  );
};

const RollNumberManagement = () => {
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState("visible"); // 'visible' or 'hidden'
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // refs to move focus quickly (ArrowUp/Down, Enter)
  const rollRefs = useRef(new Map());

  const registerRollRef = (id, el) => {
    if (!el) return;
    rollRefs.current.set(id, el);
  };

  const fetchStudents = async () => {
    try {
      const res = await api.get("/student-roll/roll-numbers", {
        params: { showHidden: activeTab === "hidden" },
      });

      const sorted = (res.data.students || []).sort(
        (a, b) => (a.roll_number ?? 9999) - (b.roll_number ?? 9999)
      );
      setStudents(sorted);
    } catch {
      Swal.fire("Error", "Failed to fetch students", "error");
    }
  };

  useEffect(() => {
    setQuery("");
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const adm = (s.admission_number || "").toLowerCase();
      const cls = (s.Class?.class_name || "").toLowerCase();
      const sec = (s.Section?.section_name || "").toLowerCase();
      const roll = (s.roll_number ?? "").toString();
      return (
        name.includes(q) ||
        adm.includes(q) ||
        cls.includes(q) ||
        sec.includes(q) ||
        roll.includes(q)
      );
    });
  }, [students, query]);

  const getIdListForNav = () => filteredStudents.map((s) => s.id);

  const focusNextRoll = (currentId, selectText = false) => {
    const ids = getIdListForNav();
    const idx = ids.indexOf(currentId);
    if (idx === -1) return;
    const nextId = ids[idx + 1];
    if (!nextId) return;
    const nextEl = rollRefs.current.get(nextId);
    if (selectText) focusAndSelect(nextEl);
    else nextEl?.focus();
  };

  const focusPrevRoll = (currentId, selectText = false) => {
    const ids = getIdListForNav();
    const idx = ids.indexOf(currentId);
    if (idx === -1) return;
    const prevId = ids[idx - 1];
    if (!prevId) return;
    const prevEl = rollRefs.current.get(prevId);
    if (selectText) focusAndSelect(prevEl);
    else prevEl?.focus();
  };

  const handleRollNumberChange = (id, value) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, roll_number: value } : s))
    );
  };

  const handleToggleVisibility = async (id) => {
    try {
      await api.put(`/student-roll/${id}/toggle-visibility`);
      Swal.fire("Success", "Visibility toggled", "success");
      fetchStudents();
    } catch {
      Swal.fire("Error", "Failed to toggle visibility", "error");
    }
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const activeId = parseInt(active.id, 10);
    const overId = parseInt(over.id, 10);

    const current = [...students];
    const oldIndex = current.findIndex((s) => s.id === activeId);
    const newIndex = current.findIndex((s) => s.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(current, oldIndex, newIndex);

    // auto-reassign roll numbers sequentially (only in visible tab)
    const updatedWithRolls =
      activeTab === "visible"
        ? reordered.map((s, i) => ({ ...s, roll_number: i + 1 }))
        : reordered;

    setStudents(updatedWithRolls);
  };

  // ✅ NEW: Auto Fill Serial (1..N) for currently visible list
  const handleAutoFillSerial = async () => {
    if (activeTab !== "visible") return;

    const result = await Swal.fire({
      title: "Auto Fill Roll Numbers?",
      text: `This will set roll numbers 1 to ${filteredStudents.length} in the current order.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Fill",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    // apply only to currently filtered list, keep others unchanged
    const orderMap = new Map();
    filteredStudents.forEach((s, idx) => orderMap.set(s.id, idx + 1));

    setStudents((prev) =>
      prev.map((s) =>
        orderMap.has(s.id) ? { ...s, roll_number: orderMap.get(s.id) } : s
      )
    );

    // focus first visible cell and select
    if (filteredStudents[0]) {
      const firstEl = rollRefs.current.get(filteredStudents[0].id);
      focusAndSelect(firstEl);
    }
  };

  const handleSave = async () => {
    const updates = students.map(({ id, roll_number }) => ({ id, roll_number }));
    try {
      setSaving(true);
      await api.post("/student-roll/roll-numbers/update", { updates });
      Swal.fire("Saved", "Roll numbers updated", "success");
      fetchStudents();
    } catch {
      Swal.fire("Error", "Failed to save roll numbers", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mt-4">
      <div
        className="d-flex align-items-start justify-content-between flex-wrap gap-2"
        style={{ marginBottom: 14 }}
      >
        <div>
          <h2 style={{ marginBottom: 4, fontWeight: 800 }}>
            🧾 Roll Number Management
          </h2>
        </div>

        {activeTab === "visible" && (
          <div className="d-flex gap-2 flex-wrap">
            <Button
              variant="outline-secondary"
              onClick={handleAutoFillSerial}
              disabled={saving || filteredStudents.length === 0}
              style={{
                borderRadius: 12,
                padding: "10px 14px",
                fontWeight: 700,
              }}
            >
              🔢 Auto Fill Serial
            </Button>

            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              style={{
                borderRadius: 12,
                padding: "10px 14px",
                fontWeight: 700,
              }}
            >
              {saving ? "Saving..." : "💾 Save Roll Numbers"}
            </Button>
          </div>
        )}
      </div>

      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-3"
      >
        <Tab eventKey="visible" title="✅ Visible Students" />
        <Tab eventKey="hidden" title="❌ Hidden Students" />
      </Tabs>

      <div className="card" style={{ borderRadius: 16 }}>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <InputGroup style={{ maxWidth: 420 }}>
              <InputGroup.Text>🔎</InputGroup.Text>
              <Form.Control
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>

            <div className="text-muted" style={{ fontSize: 13 }}>
              Showing <b>{filteredStudents.length}</b> of <b>{students.length}</b>
            </div>
          </div>

          {filteredStudents.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredStudents.map((s) => s.id.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  <table className="table table-hover align-middle" style={{ marginBottom: 0 }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 5, background: "#fff" }}>
                      <tr className="text-muted" style={{ fontSize: 13 }}>
                        <th style={{ width: 55 }}>#</th>
                        <th style={{ width: 46 }}></th>
                        <th>Name</th>
                        <th>Admission No</th>
                        <th>Class</th>
                        <th>Section</th>
                        <th style={{ width: 140 }}>Roll No</th>
                        <th style={{ width: 90 }}>Status</th>
                        <th style={{ width: 120 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s, i) => (
                        <SortableStudentRow
                          key={s.id}
                          student={s}
                          index={i}
                          onRollChange={handleRollNumberChange}
                          onToggle={handleToggleVisibility}
                          registerRollRef={registerRollRef}
                          focusNextRoll={focusNextRoll}
                          focusPrevRoll={focusPrevRoll}
                        />
                      ))}
                    </tbody>
                  </table>
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className="text-center text-muted py-4">
              No students found in this tab.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RollNumberManagement;
