import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import api from "../api";

const blankForm = {
  employee_id: "",
  pickup_bus_id: "",
  pickup_route_id: "",
  drop_bus_id: "",
  drop_route_id: "",
  pickup_stop: "",
  drop_stop: "",
  start_date: new Date().toISOString().slice(0, 10),
};

export default function EmployeeTransportAssignments() {
  const [employees, setEmployees] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [assignmentRes, busRes, routeRes] = await Promise.all([
        api.get("/employee-transport-assignments"),
        api.get("/buses"),
        api.get("/bus-operational-routes"),
      ]);
      setEmployees(assignmentRes.data?.employees || []);
      setAssignments(assignmentRes.data?.assignments || []);
      setBuses(Array.isArray(busRes.data) ? busRes.data : []);
      setRoutes(routeRes.data?.routes || []);
    } catch (error) {
      Swal.fire("Error", error.response?.data?.message || "Unable to load employee transport data.", "error");
    }
  };

  useEffect(() => { load(); }, []);

  const activeByEmployee = useMemo(() => {
    const map = new Map();
    assignments.filter((item) => item.status === "active").forEach((item) => {
      if (!map.has(String(item.employee_id))) map.set(String(item.employee_id), item);
    });
    return map;
  }, [assignments]);

  const filtered = employees.filter((employee) =>
    `${employee.name} ${employee.employee_id} ${employee.designation || ""}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const change = (event) =>
    setForm((old) => ({ ...old, [event.target.name]: event.target.value }));

  const selectEmployee = (employee) => {
    const current = activeByEmployee.get(String(employee.id));
    setForm({
      ...blankForm,
      employee_id: String(employee.id),
      pickup_bus_id: current?.pickup_bus_id ? String(current.pickup_bus_id) : "",
      pickup_route_id: current?.pickup_route_id ? String(current.pickup_route_id) : "",
      drop_bus_id: current?.drop_bus_id ? String(current.drop_bus_id) : "",
      drop_route_id: current?.drop_route_id ? String(current.drop_route_id) : "",
      pickup_stop: current?.pickup_stop || "",
      drop_stop: current?.drop_stop || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/employee-transport-assignments/assign", form);
      await load();
      setForm(blankForm);
      Swal.fire("Assigned", "Bus facility has been assigned to the employee.", "success");
    } catch (error) {
      Swal.fire("Unable to assign", error.response?.data?.message || "Please check the selected bus and route.", "error");
    } finally {
      setSaving(false);
    }
  };

  const stop = async (assignment) => {
    const result = await Swal.fire({
      title: "Stop bus facility?",
      text: `This will end the active assignment for ${assignment.employee?.name || "this employee"}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Stop facility",
    });
    if (!result.isConfirmed) return;
    await api.patch(`/employee-transport-assignments/${assignment.id}/stop`);
    await load();
  };

  const field = (name, label, options) => (
    <div className="col-md-3">
      <label className="form-label">{label}</label>
      <select className="form-select" name={name} value={form[name]} onChange={change}>
        <option value="">Not assigned</option>
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
  );

  const busOptions = buses.map((bus) => ({ value: bus.id, label: `${bus.bus_no || `Bus ${bus.id}`}${bus.reg_no ? ` (${bus.reg_no})` : ""}` }));
  const routeOptions = routes.map((route) => ({ value: route.id, label: route.route_name || route.route_code || `Route ${route.id}` }));

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div><h3 className="mb-1">Employee Bus Assignments</h3><div className="text-muted">Assign pickup and drop routes to employees who avail the bus facility.</div></div>
        <a className="btn btn-outline-primary" href="/student-transport-assignments">Student Assignments</a>
      </div>

      <form className="card card-body mb-4" onSubmit={save}>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label">Employee</label>
            <select className="form-select" required name="employee_id" value={form.employee_id} onChange={change}>
              <option value="">Select employee</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} ({employee.employee_id})</option>)}
            </select>
          </div>
          {field("pickup_bus_id", "Pickup bus", busOptions)}
          {field("pickup_route_id", "Pickup route", routeOptions)}
          <div className="col-md-2"><label className="form-label">Pickup stop</label><input className="form-control" name="pickup_stop" value={form.pickup_stop} onChange={change} /></div>
          {field("drop_bus_id", "Drop bus", busOptions)}
          {field("drop_route_id", "Drop route", routeOptions)}
          <div className="col-md-3"><label className="form-label">Drop stop</label><input className="form-control" name="drop_stop" value={form.drop_stop} onChange={change} /></div>
          <div className="col-md-3"><label className="form-label">Start date</label><input type="date" className="form-control" name="start_date" value={form.start_date} onChange={change} /></div>
          <div className="col-12"><button className="btn btn-success" disabled={saving}>{saving ? "Saving…" : "Assign Bus Facility"}</button></div>
        </div>
      </form>

      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center"><strong>Employees</strong><input className="form-control" style={{ maxWidth: 320 }} placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="table-responsive"><table className="table table-hover align-middle mb-0">
          <thead><tr><th>Employee</th><th>Designation</th><th>Pickup</th><th>Drop</th><th>Status</th><th /></tr></thead>
          <tbody>{filtered.map((employee) => {
            const assignment = activeByEmployee.get(String(employee.id));
            return <tr key={employee.id}>
              <td><strong>{employee.name}</strong><div className="small text-muted">{employee.employee_id}</div></td>
              <td>{employee.designation || "—"}</td>
              <td>{assignment ? `${assignment.pickupBus?.bus_no || "—"} / ${assignment.pickupRoute?.route_name || "—"}` : "—"}</td>
              <td>{assignment ? `${assignment.dropBus?.bus_no || "—"} / ${assignment.dropRoute?.route_name || "—"}` : "—"}</td>
              <td><span className={`badge ${assignment ? "bg-success" : "bg-secondary"}`}>{assignment ? "Assigned" : "Not availing"}</span></td>
              <td className="text-end"><button className="btn btn-sm btn-outline-primary me-2" onClick={() => selectEmployee(employee)}>{assignment ? "Change" : "Assign"}</button>{assignment && <button className="btn btn-sm btn-outline-danger" onClick={() => stop(assignment)}>Stop</button>}</td>
            </tr>;
          })}</tbody>
        </table></div>
      </div>
    </div>
  );
}
