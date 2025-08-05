import React, { useState, useEffect } from 'react';
import api from '../api';
import Swal from 'sweetalert2';
import './EmployeeManagement.css';

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  // filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDesignation, setSelectedDesignation] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dobFrom, setDobFrom] = useState('');
  const [dobTo, setDobTo] = useState('');
  const [joiningFrom, setJoiningFrom] = useState('');
  const [joiningTo, setJoiningTo] = useState('');

  // modal & file states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [file, setFile] = useState(null);

  const initialForm = {
    name: '',
    gender: '',
    dob: '',
    phone: '',
    email: '',
    aadhaar_number: '',
    pan_number: '',
    educational_qualification: '',
    professional_qualification: '',
    experience_years: '',
    blood_group: '',
    emergency_contact: '',
    marital_status: '',
    bank_account_number: '',
    ifsc_code: '',
    bank_name: '',
    account_holder_name: '',
    department_id: '',
    designation: '',
    joining_date: '',
    address: '',
    status: 'enabled',
  };
  const [form, setForm] = useState(initialForm);

  const getBackendError = err =>
  err.response?.data?.error ||
  err.response?.data?.message ||
  err.message ||
  'Operation failed';

  useEffect(() => {
    fetchEmployees();
    fetchDepartments();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get('/employees');
      setEmployees(data.employees);
    } catch {
      Swal.fire('Error', 'Failed to load employees', 'error');
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get('/departments');
      setDepartments(data.departments || []);
    } catch {
      Swal.fire('Error', 'Failed to load departments', 'error');
    }
  };

  const openModal = (mode, emp = null) => {
    setModalMode(mode);
    if (mode === 'edit' && emp) {
      setForm({
        ...initialForm,
        ...emp,
        department_id: emp.department_id || '',
      });
      setCurrentEmployee(emp);
    } else {
      setForm(initialForm);
      setCurrentEmployee(null);
    }
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    // basic validation
    for (const field of ['name', 'phone', 'email']) {
        if (!form[field]) {
          return Swal.fire(
            'Validation',
            `Field "${field.replace(/_/g, ' ')}" is required`,
            'warning'
          );
        }
      }

    try {
      // Convert empty strings to null for optional fields
      const cleanedForm = {};
      for (const [key, value] of Object.entries(form)) {
        cleanedForm[key] = value === '' ? null : value;
      }

      if (modalMode === 'add') {
        await api.post('/employees', cleanedForm);
      } else {
        await api.put(`/employees/${currentEmployee.id}`, cleanedForm);
      }

      Swal.fire(
        'Success',
        `Employee ${modalMode === 'add' ? 'added' : 'updated'}`,
        'success'
      );
      closeModal();
      fetchEmployees();
    } catch (err) {
      const msg = getBackendError(err);
      Swal.fire('Error', msg, 'error');
    }
  };

  const toggleStatus = async (emp) => {
    const action = emp.status === 'enabled' ? 'Disable' : 'Enable';
    const res = await Swal.fire({
      title: `${action} Employee?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: action,
    });
    if (res.isConfirmed) {
      await api.put(`/employees/${emp.id}`, {
        status: emp.status === 'enabled' ? 'disabled' : 'enabled',
      });
      Swal.fire('Success', `Employee ${action.toLowerCase()}d`, 'success');
      fetchEmployees();
    }
  };

  const handleExportTemplate = async () => {
    try {
      const response = await api.get('/employees/export-template', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'employee_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      Swal.fire('Success', 'Template downloaded successfully', 'success');
    } catch {
      Swal.fire('Error', 'Failed to download template', 'error');
    }
  };


    // ─── EXPORT FULL DATA ─────────────────────────────────
  const handleExportData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm)         params.append('search',        searchTerm);
      if (selectedDept)       params.append('department_id', selectedDept);
      if (statusFilter!=='all') params.append('status',       statusFilter);
      if (dobFrom)            params.append('dob',           dobFrom);
      if (dobTo)              params.append('dobTo',         dobTo);
      if (joiningFrom)        params.append('joining_date',  joiningFrom);
      if (joiningTo)          params.append('joiningDateTo', joiningTo);

      const qs = params.toString();
      const url = `/employees/export${qs ? `?${qs}` : ''}`;

      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'employees_export.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();

      Swal.fire('Success', 'All employees exported', 'success');
    } catch {
      Swal.fire('Error', 'Failed to export data', 'error');
    }
  };



  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleImport = async () => {
    if (!file) {
      return Swal.fire('Error', 'Please select a file to import', 'warning');
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/employees/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Swal.fire({
        title: 'Import Complete',
        html: `
          <p>Inserted: ${data.insertedCount} employees</p>
          <p>Duplicates: ${data.duplicateCount}</p>
          ${
            data.duplicateCount > 0
              ? `<p>Duplicate Aadhaar Numbers: ${data.duplicates.join(', ')}</p>`
              : ''
          }
        `,
        icon: 'success',
      });
      setFile(null);
      fetchEmployees();
    } catch (err) {
      const msg = getBackendError(err);
      Swal.fire('Error', msg, 'error');
    }
  };

  const designations = [
    ...new Set(employees.map((emp) => emp.designation).filter(Boolean)),
  ];

  const displayed = employees.filter((emp) => {
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
    if (
      searchTerm &&
      !emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
      return false;
    if (selectedDept && String(emp.department_id) !== selectedDept)
      return false;
    if (selectedDesignation && emp.designation !== selectedDesignation)
      return false;
    if (dobFrom && emp.dob < dobFrom) return false;
    if (dobTo && emp.dob > dobTo) return false;
    if (joiningFrom && emp.joining_date < joiningFrom) return false;
    if (joiningTo && emp.joining_date > joiningTo) return false;
    return true;
  });

  return (
    <div className="employee-management container-fluid px-0">
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center my-4 flex-wrap">
        <h3>Employees</h3>
        <div className="d-flex gap-2 flex-wrap">
          {/* EXPORT CONTROLS */}
            <div className="btn-group me-3" role="group" aria-label="Export Options">
              <button
                type="button"
                onClick={handleExportTemplate}
                className="btn btn-outline-secondary"
              >
                Export Template
              </button>
              <button
                type="button"
                onClick={handleExportData}
                className="btn btn-secondary"
              >
                Export All Employees
              </button>
            </div>


          <div className="input-group" style={{ maxWidth: 240 }}>
            <input
              type="file"
              className="form-control"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
            />
            <button
              onClick={handleImport}
              className="btn btn-primary"
              disabled={!file}
            >
              Import
            </button>
          </div>
          <button onClick={() => openModal('add')} className="btn btn-primary">
            Add Employee
          </button>
        </div>
      </div>

      {/* FILTER ROW 1 */}
      <div className="d-flex gap-3 mb-2 flex-wrap">
        <input
          type="text"
          className="form-control w-auto"
          style={{ minWidth: 200 }}
          placeholder="Search by name"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="form-select w-auto"
          style={{ minWidth: 200 }}
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name}
            </option>
          ))}
        </select>
        <select
          className="form-select w-auto"
          style={{ minWidth: 200 }}
          value={selectedDesignation}
          onChange={(e) => setSelectedDesignation(e.target.value)}
        >
          <option value="">All Designations</option>
          {designations.map((d, i) => (
            <option key={i} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="form-select w-auto"
          style={{ minWidth: 200 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="enabled">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* FILTER ROW 2 (DATES) */}
      <div className="d-flex gap-4 mb-4 flex-wrap">
        <div className="d-flex align-items-center gap-2">
          <label className="mb-0">Date of Birth:</label>
          <input
            type="date"
            className="form-control form-control-sm w-auto"
            value={dobFrom}
            onChange={(e) => setDobFrom(e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            className="form-control form-control-sm w-auto"
            value={dobTo}
            onChange={(e) => setDobTo(e.target.value)}
          />
        </div>
        <div className="d-flex align-items-center gap-2">
          <label className="mb-0">Joining Date:</label>
          <input
            type="date"
            className="form-control form-control-sm w-auto"
            value={joiningFrom}
            onChange={(e) => setJoiningFrom(e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            className="form-control form-control-sm w-auto"
            value={joiningTo}
            onChange={(e) => setJoiningTo(e.target.value)}
          />
        </div>
      </div>

      {/* EMPLOYEE TABLE */}
      <div className="table-responsive">
        <table className="table table-striped mb-0">
          <thead className="bg-light">
            <tr>
              <th>Emp ID</th>
              <th>Name</th>
              <th>Gender</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Dept</th>
              <th>Designation</th>
              <th>Joining Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length > 0 ? (
              displayed.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.employee_id}</td>
                  <td>{emp.name}</td>
                  <td>{emp.gender}</td>
                  <td>{emp.phone}</td>
                  <td>{emp.email}</td>
                  <td>{emp.Department?.name || '-'}</td>
                  <td>{emp.designation || '-'}</td>
                  <td>{emp.joining_date || '-'}</td>
                  <td>
                    <button
                      onClick={() => openModal('edit', emp)}
                      className="btn btn-sm btn-info me-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleStatus(emp)}
                      className="btn btn-sm btn-warning"
                    >
                      {emp.status === 'enabled' ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center py-3">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL (ADD / EDIT) */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog modal-fullscreen-md-down modal-xl">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">
                  {modalMode === 'add' ? 'Add Employee' : 'Edit Employee'}
                </h4>
                <button className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <form onSubmit={submitForm} className="row g-3">
                  {Object.entries(initialForm)
                    .filter(([k]) => k !== 'status')
                    .map(([key]) => (
                      <div
                        key={key}
                        className={`col-md-${key === 'address' ? 12 : 3}`}
                      >
                        <label className="form-label text-capitalize">
                          {key.replace(/_/g, ' ')}
                          {[
                            'name',
                            'gender',
                            'dob',
                            'aadhaar_number',
                            'department_id',
                            'designation',
                            'joining_date',
                          ].includes(key) && (
                            <span className="text-danger"> *</span>
                          )}
                        </label>

                        {key === 'address' ? (
                          <textarea
                            name="address"
                            value={form.address}
                            onChange={handleFormChange}
                            rows={3}
                            className="form-control"
                          />
                        ) : ['gender', 'marital_status', 'blood_group'].includes(
                            key
                          ) ? (
                          <select
                            name={key}
                            value={form[key]}
                            onChange={handleFormChange}
                            className="form-select"
                          >
                            <option value="">Select</option>
                            {(key === 'gender'
                              ? ['Male', 'Female', 'Other']
                              : key === 'marital_status'
                              ? ['Single', 'Married', 'Other']
                              : ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
                            ).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : key === 'department_id' ? (
                          <select
                            name="department_id"
                            value={form.department_id}
                            onChange={handleFormChange}
                            className="form-select"
                          >
                            <option value="">Select Department</option>
                            {departments.map((dep) => (
                              <option key={dep.id} value={dep.id}>
                                {dep.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={
                              key === 'dob' || key === 'joining_date'
                                ? 'date'
                                : key === 'experience_years'
                                ? 'number'
                                : 'text'
                            }
                            name={key}
                            value={form[key]}
                            onChange={handleFormChange}
                            className="form-control"
                          />
                        )}
                      </div>
                    ))}

                  <div className="col-12 text-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn btn-secondary me-2"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {modalMode === 'add' ? 'Add' : 'Update'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
