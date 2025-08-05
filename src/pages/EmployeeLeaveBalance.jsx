import React, { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "./EmployeeLeaveBalance.css";

const EmployeeLeaveBalance = () => {
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [groupedBalances, setGroupedBalances] = useState({});
  // editing: { [recordId]: { year, opening_balance, accrued, used, carry_forwarded, current_balance } }
  const [editing, setEditing] = useState({});
  const [newBalance, setNewBalance] = useState({
    employee_id: "",
    leave_type_id: "",
    year: new Date().getFullYear(),
    opening_balance: 0,
    accrued: 0,
    used: 0,
    carry_forwarded: 0,
    current_balance: 0,
  });
  const [searchEmployee, setSearchEmployee] = useState("");
  const [searchLeaveType, setSearchLeaveType] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balRes, typeRes, empRes] = await Promise.all([
        api.get("/employee-leave-balances"),
        api.get("/employee-leave-types"),
        api.get("/employees"),
      ]);
      const bs = balRes.data.data || [];
      setBalances(bs);
      setLeaveTypes(typeRes.data.data || []);
      setEmployees(empRes.data.employees || []);

      // group by employee
      const grouped = {};
      bs.forEach((b) => {
        const id = b.employee_id;
        if (!grouped[id]) grouped[id] = { employee: b.Employee || b.employee || {}, records: [] };
        grouped[id].records.push(b);
      });
      setGroupedBalances(grouped);
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Could not load data", "error");
    }
  };

  // start editing entire record
  const handleEdit = (record) => {
    setEditing((prev) => ({
      ...prev,
      [record.id]: {
        year: record.year,
        opening_balance: record.opening_balance,
        accrued: record.accrued,
        used: record.used,
        carry_forwarded: record.carry_forwarded,
        current_balance: record.current_balance,
      },
    }));
  };

  // update a single field in editing state
  const handleFieldChange = (recordId, field, value) => {
    setEditing((prev) => ({
      ...prev,
      [recordId]: {
        ...prev[recordId],
        [field]: value,
      },
    }));
  };

  // cancel editing
  const handleCancel = (recordId) => {
    setEditing((prev) => {
      const copy = { ...prev };
      delete copy[recordId];
      return copy;
    });
  };

  // save all edited fields
  const handleSave = async (recordId) => {
    try {
      const edited = editing[recordId];
      // optional validation:
      ["year","opening_balance","accrued","used","carry_forwarded","current_balance"].forEach((f) => {
        if (edited[f] === "" || edited[f] == null || isNaN(Number(edited[f]))) {
          throw new Error(`Invalid ${f}`);
        }
      });

      await api.put(`/employee-leave-balances/${recordId}`, {
        ...edited,
      });

      Swal.fire("Success", "Balance updated", "success");

      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[recordId];
        return copy;
      });
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", err.message || "Failed to update", "error");
    }
  };

  const handleNewBalanceChange = (e) => {
    const { name, value } = e.target;
    setNewBalance((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddBalance = async () => {
    try {
      await api.post("/employee-leave-balances", newBalance);
      Swal.fire("Success", "Leave balance added", "success");
      setNewBalance({
        employee_id: "",
        leave_type_id: "",
        year: new Date().getFullYear(),
        opening_balance: 0,
        accrued: 0,
        used: 0,
        carry_forwarded: 0,
        current_balance: 0,
      });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      Swal.fire("Error", "Could not add balance", "error");
    }
  };

  const filtered = Object.entries(groupedBalances).filter(
    ([, { employee, records }]) => {
      const empMatch = !searchEmployee || employee.employee_id === searchEmployee;
      const typeMatch =
        !searchLeaveType ||
        records.some((r) =>
          r.LeaveType?.name
            .toLowerCase()
            .includes(searchLeaveType.toLowerCase())
        );
      return empMatch && typeMatch;
    }
  );

  return (
    <div className="container mt-4">
      <h3>Employee Leave Balances</h3>

      {/* Filters */}
      <div className="row mb-3">
        <div className="col-md-4">
          <select
            className="form-control"
            value={searchEmployee}
            onChange={(e) => setSearchEmployee(e.target.value)}
          >
            <option value="">All Employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.employee_id}>
                {e.employee_id} - {e.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search Leave Type"
            value={searchLeaveType}
            onChange={(e) => setSearchLeaveType(e.target.value)}
          />
        </div>
        <div className="col-md-4">
          <button
            className="btn btn-primary w-100"
            onClick={() => setIsModalOpen(true)}
          >
            Add Leave Balance
          </button>
        </div>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="custom-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Add Leave Balance</h5>
              <button
                className="btn-close"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="row">
                {/** Employee **/}
                <div className="col-md-6 mb-3">
                  <label>Employee</label>
                  <select
                    name="employee_id"
                    className="form-control"
                    value={newBalance.employee_id}
                    onChange={handleNewBalanceChange}
                  >
                    <option value="">Select</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.employee_id}>
                        {e.employee_id} - {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/** Leave Type **/}
                <div className="col-md-6 mb-3">
                  <label>Leave Type</label>
                  <select
                    name="leave_type_id"
                    className="form-control"
                    value={newBalance.leave_type_id}
                    onChange={handleNewBalanceChange}
                  >
                    <option value="">Select</option>
                    {leaveTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/** Year **/}
                <div className="col-md-6 mb-3">
                  <label>Year</label>
                  <input
                    name="year"
                    type="number"
                    className="form-control"
                    value={newBalance.year}
                    onChange={handleNewBalanceChange}
                  />
                </div>
                {/** Opening **/}
                <div className="col-md-6 mb-3">
                  <label>Opening Balance</label>
                  <input
                    name="opening_balance"
                    type="number"
                    className="form-control"
                    value={newBalance.opening_balance}
                    onChange={handleNewBalanceChange}
                  />
                </div>
                {/** Accrued **/}
                <div className="col-md-6 mb-3">
                  <label>Accrued</label>
                  <input
                    name="accrued"
                    type="number"
                    className="form-control"
                    value={newBalance.accrued}
                    onChange={handleNewBalanceChange}
                  />
                </div>
                {/** Used **/}
                <div className="col-md-6 mb-3">
                  <label>Used</label>
                  <input
                    name="used"
                    type="number"
                    className="form-control"
                    value={newBalance.used}
                    onChange={handleNewBalanceChange}
                  />
                </div>
                {/** Carry Fwd **/}
                <div className="col-md-6 mb-3">
                  <label>Carry Forwarded</label>
                  <input
                    name="carry_forwarded"
                    type="number"
                    className="form-control"
                    value={newBalance.carry_forwarded}
                    onChange={handleNewBalanceChange}
                  />
                </div>
                {/** Current **/}
                <div className="col-md-6 mb-3">
                  <label>Current Balance</label>
                  <input
                    name="current_balance"
                    type="number"
                    className="form-control"
                    value={newBalance.current_balance}
                    onChange={handleNewBalanceChange}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
              <button className="btn btn-success" onClick={handleAddBalance}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.map(([empId, { employee, records }]) => (
        <div key={empId} className="card mb-4">
          <div className="card-header">
            <strong>{employee?.name || "Unknown Employee"}</strong> (ID: {employee?.employee_id || "—"})
          </div>
          <div className="card-body p-0">
            <table className="table table-bordered m-0">
              <thead>
                <tr>
                  <th>Leave Type</th>
                  <th>Year</th>
                  <th>Opening</th>
                  <th>Accrued</th>
                  <th>Used</th>
                  <th>Carry Fwd</th>
                  <th>Current</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r?.leaveType?.name || "—"}</td>
                    <td>
                      {editing[r.id] ? (
                        <input
                          type="number"
                          className="form-control"
                          value={editing[r.id].year}
                          onChange={(e) =>
                            handleFieldChange(r.id, "year", e.target.value)
                          }
                        />
                      ) : (
                        r.year
                      )}
                    </td>
                    <td>
                      {editing[r.id] ? (
                        <input
                          type="number"
                          className="form-control"
                          value={editing[r.id].opening_balance}
                          onChange={(e) =>
                            handleFieldChange(
                              r.id,
                              "opening_balance",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        r.opening_balance
                      )}
                    </td>
                    <td>
                      {editing[r.id] ? (
                        <input
                          type="number"
                          className="form-control"
                          value={editing[r.id].accrued}
                          onChange={(e) =>
                            handleFieldChange(r.id, "accrued", e.target.value)
                          }
                        />
                      ) : (
                        r.accrued
                      )}
                    </td>
                    <td>
                      {editing[r.id] ? (
                        <input
                          type="number"
                          className="form-control"
                          value={editing[r.id].used}
                          onChange={(e) =>
                            handleFieldChange(r.id, "used", e.target.value)
                          }
                        />
                      ) : (
                        r.used
                      )}
                    </td>
                    <td>
                      {editing[r.id] ? (
                        <input
                          type="number"
                          className="form-control"
                          value={editing[r.id].carry_forwarded}
                          onChange={(e) =>
                            handleFieldChange(
                              r.id,
                              "carry_forwarded",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        r.carry_forwarded
                      )}
                    </td>
                    <td>
                      {editing[r.id] ? (
                        <input
                          type="number"
                          className="form-control"
                          value={editing[r.id].current_balance}
                          onChange={(e) =>
                            handleFieldChange(
                              r.id,
                              "current_balance",
                              e.target.value
                            )
                          }
                        />
                      ) : (
                        r.current_balance
                      )}
                    </td>
                    <td>
                      {editing[r.id] ? (
                        <>
                          <button
                            className="btn btn-success btn-sm me-1"
                            onClick={() => handleSave(r.id)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCancel(r.id)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleEdit(r)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmployeeLeaveBalance;
