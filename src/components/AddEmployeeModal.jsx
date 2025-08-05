import React, { useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";

const AddEmployeeModal = ({
  show,
  onHide,
  employees = [],
  existingUsernames = [],
  onSave,
  editingUser = null,
}) => {
  const isEditMode = !!editingUser;

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    username: "",
    email: "",
    password: "",
    roles: [],
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEditMode && editingUser) {
      setFormData({
        id: editingUser.id,
        name: editingUser.name || "",
        username: editingUser.username || "",
        email: editingUser.email || "",
        password: "",
        roles: editingUser.roles || [],
      });
    } else {
      setSelectedEmployeeId("");
      setFormData({
        id: "",
        name: "",
        username: "",
        email: "",
        password: "",
        roles: [],
      });
    }
  }, [editingUser, isEditMode, show]);

  useEffect(() => {
    if (!isEditMode) {
      const selected = employees.find((emp) => String(emp.id) === selectedEmployeeId);
      if (selected) {
        setFormData({
          id: "",
          name: selected.name,
          username: selected.employee_id,
          email: selected.email,
          password: "",
          roles: [],
        });
      } else {
        setFormData({
          id: "",
          name: "",
          username: "",
          email: "",
          password: "",
          roles: [],
        });
      }
    }
  }, [selectedEmployeeId, isEditMode, employees]);

  const validate = () => {
    const newErrors = {};

    if (!isEditMode && !selectedEmployeeId)
      newErrors.employee = "Employee is required";

    if (!formData.username)
      newErrors.username = "Username is required";
    else if (!isEditMode && existingUsernames.includes(formData.username))
      newErrors.username = "Username already exists";

    if (!isEditMode && !formData.password)
      newErrors.password = "Password is required";

    if (!formData.roles || formData.roles.length === 0)
      newErrors.roles = "At least one role must be selected";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      ...formData,
      roles: formData.roles,
    };

    if (!isEditMode) {
      const selected = employees.find((emp) => String(emp.id) === selectedEmployeeId);
      if (!selected) return;
      payload.employee_internal_id = selected.id;
      payload.department_id = selected.department_id;
    }

    onSave(payload);
  };

  const handleRoleToggle = (role) => {
    setFormData((prev) => {
      const roles = prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role];
      return { ...prev, roles };
    });
  };

  const AVAILABLE_ROLES = ["teacher", "hr", "admin", "academic_coordinator"];

  return (
    <Modal show={show} onHide={onHide} centered size="md">
      <Modal.Header closeButton>
        <Modal.Title>{isEditMode ? "Edit Employee User" : "Register Employee User"}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          {!isEditMode && (
            <Form.Group controlId="employeeSelect" className="mb-3">
              <Form.Label>Select Employee</Form.Label>
              <Form.Select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                isInvalid={!!errors.employee}
              >
                <option value="">-- Select --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employee_id})
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {errors.employee}
              </Form.Control.Feedback>
            </Form.Group>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control type="text" value={formData.name} disabled />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Username (Employee ID)</Form.Label>
            <Form.Control
              type="text"
              value={formData.username}
              disabled
              isInvalid={!!errors.username}
            />
            <Form.Control.Feedback type="invalid">
              {errors.username}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email</Form.Label>
            <Form.Control type="email" value={formData.email || ""} disabled />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>{isEditMode ? "Change Password (Optional)" : "Password"}</Form.Label>
            <Form.Control
              type="password"
              placeholder={isEditMode ? "Leave blank to keep unchanged" : ""}
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              isInvalid={!!errors.password}
            />
            <Form.Control.Feedback type="invalid">
              {errors.password}
            </Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Assign Roles</Form.Label>
            <div className="d-flex flex-wrap gap-2">
              {AVAILABLE_ROLES.map((role) => (
                <Form.Check
                  key={role}
                  inline
                  label={role.replace(/_/g, " ").toUpperCase()}
                  type="checkbox"
                  id={`role-${role}`}
                  checked={formData.roles.includes(role)}
                  onChange={() => handleRoleToggle(role)}
                />
              ))}
            </div>
            {errors.roles && (
              <div className="text-danger mt-1">{errors.roles}</div>
            )}
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          {isEditMode ? "Update" : "Register"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default AddEmployeeModal;
