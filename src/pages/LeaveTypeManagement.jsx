import React, { useState, useEffect } from 'react';
import api from '../api';
import Swal from 'sweetalert2';
import './EmployeeManagement.css';

const LeaveTypeManagement = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentType, setCurrentType] = useState(null);

  const initialForm = {
    name: '',
    abbreviation: '',
    accrual_frequency: 'monthly',
    accrual_amount: 1,
    days_interval: '',
    max_per_year: '',
    carry_forward: false,
    is_active: true,
  };

  const [form, setForm] = useState(initialForm);

  const fetchLeaveTypes = async () => {
    try {
      const res = await api.get('/employee-leave-types');
      setLeaveTypes(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const openModal = (mode, type = null) => {
    setModalMode(mode);
    if (mode === 'edit') {
      setForm({ ...type });
      setCurrentType(type);
    } else {
      setForm(initialForm);
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const cleanForm = {
      ...form,
      max_per_year: form.max_per_year === '' ? null : Number(form.max_per_year),
      days_interval: form.days_interval === '' ? null : Number(form.days_interval),
      accrual_amount: Number(form.accrual_amount),
    };

    try {
      if (modalMode === 'add') {
        await api.post('/employee-leave-types', cleanForm);
        Swal.fire('Success', 'Leave type added', 'success');
      } else {
        await api.put(`/employee-leave-types/${currentType.id}`, cleanForm);
        Swal.fire('Success', 'Leave type updated', 'success');
      }
      setModalOpen(false);
      fetchLeaveTypes();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Something went wrong', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: 'Are you sure?',
      text: 'This action cannot be undone',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it',
    });
    if (confirm.isConfirmed) {
      try {
        await api.delete(`/employee-leave-types/${id}`);
        Swal.fire('Deleted', 'Leave type deleted', 'success');
        fetchLeaveTypes();
      } catch (err) {
        Swal.fire('Error', 'Deletion failed', 'error');
      }
    }
  };

  return (
    <div className="employee-management">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Leave Type Management</h3>
        <button className="btn btn-primary" onClick={() => openModal('add')}>Add Leave Type</button>
      </div>

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>Name</th>
            <th>Abbreviation</th>
            <th>Frequency</th>
            <th>Amount</th>
            <th>Max/Year</th>
            <th>Interval</th>
            <th>Carry Forward</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leaveTypes.map((type) => (
            <tr key={type.id}>
              <td>{type.name}</td>
              <td>{type.abbreviation || '-'}</td>
              <td>{type.accrual_frequency}</td>
              <td>{type.accrual_amount}</td>
              <td>{type.max_per_year || '-'}</td>
              <td>{type.days_interval || '-'}</td>
              <td>{type.carry_forward ? 'Yes' : 'No'}</td>
              <td>{type.is_active ? 'Yes' : 'No'}</td>
              <td>
                <button className="btn btn-sm btn-primary me-2" onClick={() => openModal('edit', type)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(type.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h4>{modalMode === 'add' ? 'Add Leave Type' : 'Edit Leave Type'}</h4>
            <div className="row">
              <div className="col-md-6">
                <label>Name<span className="text-danger">*</span></label>
                <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label>Abbreviation</label>
                <input className="form-control" value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-4">
                <label>Accrual Frequency</label>
                <select className="form-control" value={form.accrual_frequency} onChange={(e) => setForm({ ...form, accrual_frequency: e.target.value })}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="per_days_worked">Per Days Worked</option>
                </select>
              </div>
              <div className="col-md-4">
                <label>Accrual Amount</label>
                <input type="number" className="form-control" value={form.accrual_amount} onChange={(e) => setForm({ ...form, accrual_amount: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label>Max Per Year</label>
                <input type="number" className="form-control" value={form.max_per_year} onChange={(e) => setForm({ ...form, max_per_year: e.target.value })} />
              </div>
            </div>
            <div className="row">
              <div className="col-md-6">
                <label>Days Interval</label>
                <input type="number" className="form-control" value={form.days_interval} onChange={(e) => setForm({ ...form, days_interval: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label>Carry Forward</label>
                <select className="form-control" value={form.carry_forward} onChange={(e) => setForm({ ...form, carry_forward: e.target.value === 'true' })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="col-md-3">
                <label>Status</label>
                <select className="form-control" value={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-4 d-flex gap-2 justify-content-end">
              <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTypeManagement;
