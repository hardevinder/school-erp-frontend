import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaBell } from 'react-icons/fa';
import { useRoles } from '../hooks/useRoles';

const Navbar = ({ notificationsCount = 0, onBellClick = () => {} }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('https://via.placeholder.com/40');
  const [userName, setUserName] = useState('');

  const { roles, activeRole, changeRole } = useRoles();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const { data } = await axios.get(`${process.env.REACT_APP_API_URL}/users/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const user = data.user;
        if (user.profilePhoto) {
          const full = user.profilePhoto.startsWith('http')
            ? user.profilePhoto
            : `${process.env.REACT_APP_API_URL}${user.profilePhoto}`;
          setProfilePhoto(full);
        }
        if (user.name) setUserName(user.name);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('roles');
    localStorage.removeItem('activeRole');
    navigate('/');
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRoleChange = (newRole) => {
    changeRole(newRole);
    navigate(`/dashboard/${newRole}`); // Optional: navigate to role-specific page
  };

  return (
    <nav className="navbar fixed-top navbar-expand-lg navbar-dark bg-dark py-1">
      <div className="container-fluid">
        <Link to="/dashboard" className="navbar-brand">Dashboard</Link>

        {roles.length > 1 && (
          <div className="ms-3">
            <select
              className="form-select form-select-sm bg-dark text-white border-secondary"
              style={{ width: 180 }}
              value={activeRole}
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              {roles.map(r => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="d-flex align-items-center ms-auto" ref={dropdownRef}>
          <div className="dropdown">
            <button
              className="btn btn-secondary dropdown-toggle d-flex align-items-center"
              type="button"
              id="combinedDropdown"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <FaBell size={18} className="me-2" />
              {notificationsCount > 0 && (
                <span className="badge bg-danger me-2">{notificationsCount}</span>
              )}
              <img
                src={profilePhoto}
                alt="Profile"
                className="rounded-circle"
                style={{ width: '30px', height: '30px', marginRight: '5px' }}
              />
              <span>{userName || 'User'}</span>
            </button>
            <ul className={`dropdown-menu dropdown-menu-end ${dropdownOpen ? 'show' : ''}`} aria-labelledby="combinedDropdown">
              <li>
                <button className="dropdown-item" onClick={onBellClick}>
                  Notifications {notificationsCount > 0 && `(${notificationsCount})`}
                </button>
              </li>
              <li><Link className="dropdown-item" to="/dashboard">Dashboard</Link></li>
              <li><Link className="dropdown-item" to="/edit-profile">Edit Profile</Link></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item" onClick={handleLogout}>Logout</button></li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
