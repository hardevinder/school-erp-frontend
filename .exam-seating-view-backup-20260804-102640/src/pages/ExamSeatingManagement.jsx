import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";

const emptyRoom = {
  room_code: "",
  name: "",
  building: "",
  floor: "",
  rows_count: 5,
  seats_per_row: 6,
  capacity: 30,
};

const emptyPlan = {
  exam_id: "",
  session_id: "",
  name: "",
  exam_date: "",
  start_time: "",
  end_time: "",
  allocation_mode: "roll_number",
  mix_classes: true,
};

const listFrom = (response, key) => response?.data?.[key] || response?.data || [];

const normalizeTime = (value) => String(value || "").slice(0, 5);

const slotKey = (slot) =>
  slot?.key ||
  `${slot?.exam_date || ""}|${normalizeTime(slot?.start_time)}|${normalizeTime(slot?.end_time)}`;

const formatDate = (value) => {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const shiftName = (startTime) => {
  const hour = Number.parseInt(normalizeTime(startTime).split(":")[0], 10);
  if (!Number.isFinite(hour)) return "Exam Shift";
  if (hour < 12) return "Morning Shift";
  if (hour < 17) return "Afternoon Shift";
  return "Evening Shift";
};

const slotLabel = (slot) =>
  `${formatDate(slot?.exam_date)} · ${normalizeTime(slot?.start_time)}–${normalizeTime(slot?.end_time)} · ${slot?.class_count || 0} class/section group${Number(slot?.class_count || 0) === 1 ? "" : "s"}`;

export default function ExamSeatingManagement() {
  const [tab, setTab] = useState("planner");
  const [rooms, setRooms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [exams, setExams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [createScheduleSlots, setCreateScheduleSlots] = useState([]);
  const [activeScheduleSlots, setActiveScheduleSlots] = useState([]);
  const [selectedCreateSlotKey, setSelectedCreateSlotKey] = useState("");
  const [scheduleMismatch, setScheduleMismatch] = useState(null);
  const [loadingScheduleSlots, setLoadingScheduleSlots] = useState(false);
  const [planNameTouched, setPlanNameTouched] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [activePlanId, setActivePlanId] = useState("");
  const [activePlan, setActivePlan] = useState(null);
  const [seats, setSeats] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [selectedScheduleIds, setSelectedScheduleIds] = useState([]);
  const [invigilators, setInvigilators] = useState({});
  const [busy, setBusy] = useState(false);

  const activeRooms = useMemo(() => rooms.filter((room) => room.is_active !== false), [rooms]);
  const matchingSlot = useMemo(() => {
    if (!activePlan) return null;
    return (activeScheduleSlots || []).find(
      (slot) =>
        String(slot.exam_date) === String(activePlan.exam_date) &&
        normalizeTime(slot.start_time) === normalizeTime(activePlan.start_time) &&
        normalizeTime(slot.end_time) === normalizeTime(activePlan.end_time)
    ) || null;
  }, [activeScheduleSlots, activePlan]);

  const matchingSchedules = matchingSlot?.schedules || [];

  const loadBase = async () => {
    try {
      const [roomRes, planRes, examRes, sessionRes, employeeRes] =
        await Promise.all([
          api.get("/exam-seating/rooms"),
          api.get("/exam-seating/plans"),
          api.get("/exams"),
          api.get("/sessions"),
          api.get("/exam-seating/employees"),
        ]);
      const loadedSessions = listFrom(sessionRes, "sessions");
      setRooms(listFrom(roomRes, "rooms"));
      setPlans(listFrom(planRes, "plans"));
      setExams(listFrom(examRes, "exams"));
      setSessions(loadedSessions);
      setEmployees(listFrom(employeeRes, "employees"));
      setPlanForm((current) => {
        if (current.session_id) return current;
        const preferredSession =
          loadedSessions.find((item) => item.is_active) || loadedSessions[0];
        return preferredSession
          ? { ...current, session_id: String(preferredSession.id) }
          : current;
      });
    } catch (error) {
      console.error(error);
      Swal.fire("Unable to load", error?.response?.data?.message || "Could not load seating-plan data", "error");
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  const fetchScheduleSlots = async (examId, sessionId) => {
    if (!examId || !sessionId) return [];
    const response = await api.get("/exam-seating/schedule-options", {
      params: { exam_id: examId, session_id: sessionId },
    });
    return listFrom(response, "slots");
  };

  const applyCreateSlot = (slot, options = {}) => {
    if (!slot) return;
    const selectedExamId = options.examId || planForm.exam_id;
    const exam = exams.find((item) => String(item.id) === String(selectedExamId));
    const generatedName = `${exam?.name || "Examination"} – ${formatDate(slot.exam_date)} – ${shiftName(slot.start_time)}`;

    setSelectedCreateSlotKey(slotKey(slot));
    setPlanForm((current) => ({
      ...current,
      exam_id: selectedExamId,
      exam_date: slot.exam_date,
      start_time: normalizeTime(slot.start_time),
      end_time: normalizeTime(slot.end_time),
      name: !planNameTouched || options.forceName ? generatedName : current.name,
    }));
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!planForm.exam_id || !planForm.session_id) {
        setCreateScheduleSlots([]);
        setSelectedCreateSlotKey("");
        return;
      }

      setLoadingScheduleSlots(true);
      try {
        const slots = await fetchScheduleSlots(
          planForm.exam_id,
          planForm.session_id
        );
        if (cancelled) return;
        setCreateScheduleSlots(slots);

        const selected =
          slots.find((slot) => slotKey(slot) === selectedCreateSlotKey) ||
          slots[0] ||
          null;

        if (selected) {
          applyCreateSlot(selected, { examId: planForm.exam_id });
        } else {
          setSelectedCreateSlotKey("");
          setPlanForm((current) => ({
            ...current,
            exam_date: "",
          }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setCreateScheduleSlots([]);
          setSelectedCreateSlotKey("");
        }
      } finally {
        if (!cancelled) setLoadingScheduleSlots(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // selectedCreateSlotKey is intentionally excluded: changing a slot must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planForm.exam_id, planForm.session_id, exams]);

  const openPlan = async (planId) => {
    if (!planId) {
      setActivePlanId("");
      setActivePlan(null);
      setActiveScheduleSlots([]);
      setScheduleMismatch(null);
      setSeats([]);
      setDashboard(null);
      return;
    }
    setBusy(true);
    try {
      const [planRes, dashRes] = await Promise.all([
        api.get(`/exam-seating/plans/${planId}`),
        api.get(`/exam-seating/plans/${planId}/dashboard`),
      ]);
      const plan = planRes.data?.plan;
      const loadedSeats = planRes.data?.seats || [];
      const slots = await fetchScheduleSlots(plan.exam_id, plan.session_id);
      const exactSlot = slots.find(
        (slot) =>
          String(slot.exam_date) === String(plan.exam_date) &&
          normalizeTime(slot.start_time) === normalizeTime(plan.start_time) &&
          normalizeTime(slot.end_time) === normalizeTime(plan.end_time)
      );

      setActivePlanId(String(planId));
      setActivePlan(plan);
      setActiveScheduleSlots(slots);
      setSeats(loadedSeats);
      setDashboard(dashRes.data);
      setSelectedRoomIds((plan?.rooms || []).map((item) => String(item.exam_room_id)));
      setSelectedScheduleIds(
        exactSlot
          ? (exactSlot.schedule_ids || []).map(String)
          : [...new Set(loadedSeats.map((item) => String(item.exam_schedule_id)))]
      );
      setScheduleMismatch(exactSlot ? null : slots[0] || null);

      const dutyMap = {};
      (plan?.rooms || []).forEach((planRoom) => {
        const mainDuty =
          (planRoom.invigilators || []).find(
            (duty) => duty.duty_role === "main"
          ) || planRoom.invigilators?.[0];
        dutyMap[String(planRoom.id)] = mainDuty
          ? String(mainDuty.employee_id)
          : "";
      });
      setInvigilators(dutyMap);
    } catch (error) {
      Swal.fire(
        "Unable to open",
        error?.response?.data?.message || "Failed to load plan",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const useRecommendedSchedule = async () => {
    if (!activePlan || !scheduleMismatch) return;

    if (seats.length) {
      return Swal.fire(
        "Seats already allocated",
        "This plan already contains seat assignments. Create a new plan or clear/reallocate seats before changing its examination shift.",
        "warning"
      );
    }

    const confirmation = await Swal.fire({
      title: "Use scheduled examination slot?",
      html: `Change this draft plan to <strong>${slotLabel(scheduleMismatch)}</strong>?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Use this schedule",
    });
    if (!confirmation.isConfirmed) return;

    setBusy(true);
    try {
      await api.put(`/exam-seating/plans/${activePlan.id}`, {
        exam_date: scheduleMismatch.exam_date,
        start_time: normalizeTime(scheduleMismatch.start_time),
        end_time: normalizeTime(scheduleMismatch.end_time),
      });
      await loadBase();
      await openPlan(activePlan.id);
      Swal.fire(
        "Schedule selected",
        "Date, shift and class schedules have been loaded automatically.",
        "success"
      );
    } catch (error) {
      Swal.fire(
        "Could not update plan",
        error?.response?.data?.message || "Failed to use scheduled slot",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/exam-seating/rooms", {
        ...roomForm,
        rows_count: Number(roomForm.rows_count),
        seats_per_row: Number(roomForm.seats_per_row),
        capacity: Number(roomForm.capacity),
      });
      setRoomForm(emptyRoom);
      await loadBase();
      Swal.fire("Room created", "The room is now available for seating plans.", "success");
    } catch (error) {
      Swal.fire("Not saved", error?.response?.data?.message || "Failed to create room", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleRoomStatus = async (room) => {
    try {
      await api.put(`/exam-seating/rooms/${room.id}`, { is_active: !room.is_active });
      await loadBase();
    } catch (error) {
      Swal.fire("Not updated", error?.response?.data?.message || "Failed to update room", "error");
    }
  };

  const createPlan = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.post("/exam-seating/plans", planForm);
      const created = response.data?.plan;
      setPlanForm((current) => ({
        ...emptyPlan,
        session_id: current.session_id,
      }));
      setPlanNameTouched(false);
      setSelectedCreateSlotKey("");
      setCreateScheduleSlots([]);
      await loadBase();
      await openPlan(created.id);
      Swal.fire(
        "Plan created",
        "Scheduled classes were selected automatically. Add rooms and allocate students.",
        "success"
      );
    } catch (error) {
      Swal.fire("Not saved", error?.response?.data?.message || "Failed to create plan", "error");
    } finally {
      setBusy(false);
    }
  };

  const savePlanRooms = async () => {
    if (!activePlan || !selectedRoomIds.length) {
      return Swal.fire("Select rooms", "Choose at least one active room.", "warning");
    }
    let clearAssignments = false;
    if (seats.length) {
      const confirm = await Swal.fire({
        title: "Replace rooms?",
        text: "Existing seat assignments will be cleared and must be generated again.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Replace rooms",
      });
      if (!confirm.isConfirmed) return;
      clearAssignments = true;
    }
    setBusy(true);
    try {
      await api.put(`/exam-seating/plans/${activePlan.id}/rooms`, {
        rooms: selectedRoomIds.map((id, index) => ({ exam_room_id: Number(id), display_order: index })),
        clear_assignments: clearAssignments,
      });
      await openPlan(activePlan.id);
      Swal.fire("Rooms saved", "The plan rooms have been updated.", "success");
    } catch (error) {
      Swal.fire("Not saved", error?.response?.data?.message || "Failed to update rooms", "error");
    } finally {
      setBusy(false);
    }
  };

  const autoAllocate = async () => {
    if (!activePlan || !selectedScheduleIds.length) {
      return Swal.fire("Select schedules", "Choose the class/section schedules for this shift.", "warning");
    }
    setBusy(true);
    try {
      const response = await api.post(`/exam-seating/plans/${activePlan.id}/auto-allocate`, {
        exam_schedule_ids: selectedScheduleIds.map(Number),
        allocation_mode: activePlan.allocation_mode || "roll_number",
        mix_classes: activePlan.mix_classes !== false,
        clear_existing: true,
      });
      await openPlan(activePlan.id);
      Swal.fire("Seats allocated", `${response.data?.student_count || 0} students assigned automatically.`, "success");
    } catch (error) {
      Swal.fire("Allocation stopped", error?.response?.data?.message || "Failed to allocate students", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveInvigilators = async () => {
    if (!activePlan) return;
    const assignments = Object.entries(invigilators)
      .filter(([, employeeId]) => employeeId)
      .map(([planRoomId, employeeId]) => ({
        plan_room_id: Number(planRoomId),
        employee_id: Number(employeeId),
        duty_role: "main",
      }));
    if (!assignments.length) return Swal.fire("Assign teachers", "Select at least one invigilator.", "warning");
    setBusy(true);
    try {
      await api.put(`/exam-seating/plans/${activePlan.id}/invigilators`, {
        assignments,
        replace_existing: true,
      });
      await openPlan(activePlan.id);
      Swal.fire("Duties assigned", "Teachers can now see their invigilation duties.", "success");
    } catch (error) {
      Swal.fire("Not assigned", error?.response?.data?.message || "Failed to assign invigilators", "error");
    } finally {
      setBusy(false);
    }
  };

  const publishPlan = async () => {
    if (!activePlan) return;
    const action = activePlan.status === "published" ? "unpublish" : "publish";
    const confirm = await Swal.fire({
      title: action === "publish" ? "Publish seating plan?" : "Move plan back to draft?",
      text: action === "publish" ? "Students will receive their room and seat details." : "The plan will stop showing as an active published plan.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: action === "publish" ? "Publish" : "Unpublish",
    });
    if (!confirm.isConfirmed) return;
    setBusy(true);
    try {
      await api.post(`/exam-seating/plans/${activePlan.id}/${action}`, {});
      await loadBase();
      await openPlan(activePlan.id);
      Swal.fire(action === "publish" ? "Published" : "Draft restored", action === "publish" ? "Seat notifications have been processed." : "You can edit the plan again.", "success");
    } catch (error) {
      Swal.fire("Action failed", error?.response?.data?.message || `Failed to ${action} plan`, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelection = (value, selected, setter) => {
    setter((current) =>
      selected ? [...new Set([...current, String(value)])] : current.filter((item) => String(item) !== String(value))
    );
  };

  return (
    <div className="container-fluid py-3 exam-seating-page">
      <style>{`
        @media print {
          .no-print, .sidebar, nav { display: none !important; }
          .exam-seating-page { padding: 0 !important; }
          .print-card { break-inside: avoid; }
        }
      `}</style>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 no-print">
        <div>
          <h2 className="mb-1">Examination Seating Planner</h2>
          <div className="text-muted">Rooms → students → invigilators → publish → attendance</div>
        </div>
        <div className="btn-group">
          <button className={`btn ${tab === "planner" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("planner")}>Planner</button>
          <button className={`btn ${tab === "rooms" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setTab("rooms")}>Room Master</button>
        </div>
      </div>

      {tab === "rooms" && (
        <div className="row g-3">
          <div className="col-lg-4">
            <form className="card shadow-sm" onSubmit={createRoom}>
              <div className="card-header fw-semibold">Create examination room</div>
              <div className="card-body row g-3">
                <div className="col-5"><label className="form-label">Room code</label><input required className="form-control" value={roomForm.room_code} onChange={(e) => setRoomForm({ ...roomForm, room_code: e.target.value })} /></div>
                <div className="col-7"><label className="form-label">Room name</label><input required className="form-control" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} /></div>
                <div className="col-6"><label className="form-label">Building</label><input className="form-control" value={roomForm.building} onChange={(e) => setRoomForm({ ...roomForm, building: e.target.value })} /></div>
                <div className="col-6"><label className="form-label">Floor</label><input className="form-control" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} /></div>
                <div className="col-4"><label className="form-label">Rows</label><input type="number" min="1" className="form-control" value={roomForm.rows_count} onChange={(e) => setRoomForm({ ...roomForm, rows_count: e.target.value, capacity: Number(e.target.value) * Number(roomForm.seats_per_row) })} /></div>
                <div className="col-4"><label className="form-label">Per row</label><input type="number" min="1" className="form-control" value={roomForm.seats_per_row} onChange={(e) => setRoomForm({ ...roomForm, seats_per_row: e.target.value, capacity: Number(roomForm.rows_count) * Number(e.target.value) })} /></div>
                <div className="col-4"><label className="form-label">Capacity</label><input type="number" min="1" className="form-control" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} /></div>
              </div>
              <div className="card-footer"><button disabled={busy} className="btn btn-primary w-100">Create room</button></div>
            </form>
          </div>
          <div className="col-lg-8">
            <div className="card shadow-sm">
              <div className="card-header fw-semibold">Reusable rooms</div>
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead><tr><th>Code</th><th>Name</th><th>Layout</th><th>Capacity</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {rooms.map((room) => (
                      <tr key={room.id}>
                        <td className="fw-semibold">{room.room_code}</td><td>{room.name}<div className="small text-muted">{[room.building, room.floor].filter(Boolean).join(" · ")}</div></td>
                        <td>{room.rows_count} × {room.seats_per_row}</td><td>{room.capacity}</td>
                        <td><span className={`badge ${room.is_active ? "text-bg-success" : "text-bg-secondary"}`}>{room.is_active ? "Active" : "Archived"}</span></td>
                        <td><button className="btn btn-sm btn-outline-secondary" onClick={() => toggleRoomStatus(room)}>{room.is_active ? "Archive" : "Restore"}</button></td>
                      </tr>
                    ))}
                    {!rooms.length && <tr><td colSpan="6" className="text-center text-muted py-4">No rooms created yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "planner" && (
        <>
          <div className="row g-3 no-print">
            <div className="col-xl-4">
              <form className="card shadow-sm h-100" onSubmit={createPlan}>
                <div className="card-header fw-semibold">1. Create plan/shift</div>
                <div className="card-body row g-3">
                  <div className="col-12">
                    <label className="form-label">Plan name</label>
                    <input
                      required
                      className="form-control"
                      placeholder="Generated automatically from exam schedule"
                      value={planForm.name}
                      onChange={(e) => {
                        setPlanNameTouched(true);
                        setPlanForm({ ...planForm, name: e.target.value });
                      }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Session</label>
                    <select
                      required
                      className="form-select"
                      value={planForm.session_id}
                      onChange={(e) => {
                        setPlanNameTouched(false);
                        setSelectedCreateSlotKey("");
                        setPlanForm({
                          ...planForm,
                          session_id: e.target.value,
                          exam_id: "",
                          name: "",
                          exam_date: "",
                        });
                      }}
                    >
                      <option value="">Select</option>
                      {sessions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}{item.is_active ? " (Current)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Exam</label>
                    <select
                      required
                      className="form-select"
                      value={planForm.exam_id}
                      onChange={(e) => {
                        setPlanNameTouched(false);
                        setSelectedCreateSlotKey("");
                        setPlanForm({
                          ...planForm,
                          exam_id: e.target.value,
                          name: "",
                          exam_date: "",
                        });
                      }}
                    >
                      <option value="">Select</option>
                      {exams.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Scheduled date and shift</label>
                    <select
                      required
                      className="form-select"
                      disabled={loadingScheduleSlots || !planForm.exam_id}
                      value={selectedCreateSlotKey}
                      onChange={(e) => {
                        const selected = createScheduleSlots.find(
                          (slot) => slotKey(slot) === e.target.value
                        );
                        applyCreateSlot(selected);
                      }}
                    >
                      <option value="">
                        {loadingScheduleSlots
                          ? "Loading scheduled dates..."
                          : createScheduleSlots.length
                            ? "Select scheduled date and shift"
                            : "No examination schedule available"}
                      </option>
                      {createScheduleSlots.map((slot) => (
                        <option key={slotKey(slot)} value={slotKey(slot)}>
                          {slotLabel(slot)}
                        </option>
                      ))}
                    </select>
                    {planForm.exam_id && !loadingScheduleSlots && !createScheduleSlots.length && (
                      <div className="small text-danger mt-1">
                        Create the Exam Schedule first. A seating plan can only use scheduled examination dates.
                      </div>
                    )}
                  </div>
                  <div className="col-6">
                    <label className="form-label">Date</label>
                    <input readOnly className="form-control" value={planForm.exam_date ? formatDate(planForm.exam_date) : "Auto-selected"} />
                  </div>
                  <div className="col-3">
                    <label className="form-label">Start</label>
                    <input readOnly className="form-control" value={planForm.start_time || ""} />
                  </div>
                  <div className="col-3">
                    <label className="form-label">End</label>
                    <input readOnly className="form-control" value={planForm.end_time || ""} />
                  </div>
                </div>
                <div className="card-footer"><button disabled={busy || !selectedCreateSlotKey} className="btn btn-primary w-100">Create seating plan</button></div>
              </form>
            </div>
            <div className="col-xl-8">
              <div className="card shadow-sm h-100">
                <div className="card-header fw-semibold">Open existing plan</div>
                <div className="card-body">
                  <select className="form-select mb-3" value={activePlanId} onChange={(e) => openPlan(e.target.value)}>
                    <option value="">Select a seating plan</option>
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.exam_date} · {plan.name} · {plan.status}</option>)}
                  </select>
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead><tr><th>Date</th><th>Plan</th><th>Time</th><th>Status</th><th /></tr></thead>
                      <tbody>{plans.slice(0, 8).map((plan) => <tr key={plan.id}><td>{plan.exam_date}</td><td>{plan.name}</td><td>{plan.start_time}–{plan.end_time}</td><td><span className={`badge ${plan.status === "published" ? "text-bg-success" : "text-bg-secondary"}`}>{plan.status}</span></td><td><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openPlan(plan.id)}>Open</button></td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {activePlan && (
            <div className="mt-3">
              <div className="card shadow-sm mb-3 print-card">
                <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div><h4 className="mb-1">{activePlan.name}</h4><div className="text-muted">{activePlan.exam?.name} · {activePlan.exam_date} · {activePlan.start_time}–{activePlan.end_time}</div></div>
                  <div className="d-flex gap-2 no-print"><button className="btn btn-outline-secondary" onClick={() => window.print()}>Print preview</button><button disabled={busy} className={`btn ${activePlan.status === "published" ? "btn-outline-warning" : "btn-success"}`} onClick={publishPlan}>{activePlan.status === "published" ? "Unpublish" : "Publish to apps"}</button></div>
                </div>
              </div>

              {dashboard?.summary && (
                <div className="row g-2 mb-3">
                  {[['Rooms', dashboard.summary.rooms], ['Students', dashboard.summary.total_students], ['Present', dashboard.summary.present], ['Absent', dashboard.summary.absent], ['Late', dashboard.summary.late], ['Pending', dashboard.summary.pending]].map(([label, value]) => <div className="col-6 col-md-2" key={label}><div className="card text-center shadow-sm print-card"><div className="card-body py-2"><div className="small text-muted">{label}</div><div className="fs-4 fw-bold">{value}</div></div></div></div>)}
                </div>
              )}

              <div className="row g-3 no-print">
                <div className="col-xl-4">
                  <div className="card shadow-sm h-100">
                    <div className="card-header fw-semibold">2. Select rooms</div>
                    <div className="card-body" style={{ maxHeight: 330, overflow: "auto" }}>
                      {activeRooms.map((room) => <label key={room.id} className="d-flex align-items-center gap-2 border rounded p-2 mb-2"><input type="checkbox" checked={selectedRoomIds.includes(String(room.id))} onChange={(e) => toggleSelection(room.id, e.target.checked, setSelectedRoomIds)} /><span><strong>{room.room_code}</strong> — {room.name}<span className="d-block small text-muted">Capacity {room.capacity} ({room.rows_count} × {room.seats_per_row})</span></span></label>)}
                    </div>
                    <div className="card-footer"><button disabled={busy || activePlan.status !== "draft"} className="btn btn-primary w-100" onClick={savePlanRooms}>Save selected rooms</button></div>
                  </div>
                </div>

                <div className="col-xl-4">
                  <div className="card shadow-sm h-100">
                    <div className="card-header d-flex justify-content-between align-items-center"><span className="fw-semibold">3. Scheduled classes</span>{matchingSchedules.length > 0 && <span className="badge text-bg-success">Auto-selected</span>}</div>
                    <div className="card-body" style={{ maxHeight: 330, overflow: "auto" }}>
                      {matchingSchedules.map((schedule) => <label key={schedule.id} className="d-flex align-items-start gap-2 border rounded p-2 mb-2"><input className="mt-1" type="checkbox" checked={selectedScheduleIds.includes(String(schedule.id))} onChange={(e) => toggleSelection(schedule.id, e.target.checked, setSelectedScheduleIds)} /><span><strong>{schedule.class?.class_name} {schedule.section?.section_name}</strong><span className="d-block small text-muted">{schedule.subject?.name} · {schedule.start_time}–{schedule.end_time}</span></span></label>)}
                      {!matchingSchedules.length && (
                        <div className="alert alert-warning mb-0">
                          <div className="fw-semibold">This plan does not match a scheduled date/shift.</div>
                          {scheduleMismatch ? (
                            <>
                              <div className="small mt-1">Recommended: {slotLabel(scheduleMismatch)}</div>
                              <button
                                type="button"
                                className="btn btn-sm btn-warning mt-2"
                                disabled={busy || activePlan.status !== "draft"}
                                onClick={useRecommendedSchedule}
                              >
                                Use scheduled date automatically
                              </button>
                            </>
                          ) : (
                            <div className="small mt-1">No Exam Schedule exists for this exam and session.</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="card-footer"><button disabled={busy || activePlan.status !== "draft" || !(activePlan.rooms || []).length} className="btn btn-primary w-100" onClick={autoAllocate}>Auto-allocate students</button></div>
                  </div>
                </div>

                <div className="col-xl-4">
                  <div className="card shadow-sm h-100">
                    <div className="card-header fw-semibold">4. Assign main invigilators</div>
                    <div className="card-body" style={{ maxHeight: 330, overflow: "auto" }}>
                      {(activePlan.rooms || []).map((planRoom) => <div className="mb-3" key={planRoom.id}><label className="form-label mb-1">{planRoom.room?.room_code} — {planRoom.room?.name}</label><select className="form-select" value={invigilators[String(planRoom.id)] || ""} onChange={(e) => setInvigilators({ ...invigilators, [String(planRoom.id)]: e.target.value })}><option value="">Select teacher</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.designation ? ` — ${employee.designation}` : ""}</option>)}</select></div>)}
                      {!(activePlan.rooms || []).length && <div className="text-muted">Save plan rooms first.</div>}
                    </div>
                    <div className="card-footer"><button disabled={busy || !(activePlan.rooms || []).length} className="btn btn-primary w-100" onClick={saveInvigilators}>Save duty assignments</button></div>
                  </div>
                </div>
              </div>

              <div className="card shadow-sm mt-3 print-card">
                <div className="card-header d-flex justify-content-between"><span className="fw-semibold">Room-wise seating list</span><span>{seats.length} students</span></div>
                <div className="table-responsive">
                  <table className="table table-bordered table-sm align-middle mb-0">
                    <thead><tr><th>Room</th><th>Seat</th><th>Student</th><th>Admission</th><th>Class</th><th>Subject</th><th>Attendance</th><th>Remark</th></tr></thead>
                    <tbody>
                      {seats.map((seat) => <tr key={seat.id}><td>{(activePlan.rooms || []).find((room) => Number(room.id) === Number(seat.plan_room_id))?.room?.room_code || seat.plan_room_id}</td><td className="fw-bold">{seat.seat_number}</td><td>{seat.student?.name}</td><td>{seat.student?.admission_number}</td><td>{seat.student?.Class?.class_name} {seat.student?.Section?.section_name}</td><td>{seat.schedule?.subject?.name}</td><td>{seat.attendance_status}</td><td>{seat.attendance_remark || ""}</td></tr>)}
                      {!seats.length && <tr><td colSpan="8" className="text-center text-muted py-4">No seats allocated yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
