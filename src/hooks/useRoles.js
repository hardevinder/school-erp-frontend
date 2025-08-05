// src/hooks/useRoles.js
import { useState, useEffect, useCallback } from 'react';
import { ROLE_PERMS } from '../constants/rolePerms';

export const useRoles = () => {
  const [roles, setRoles] = useState([]);
  const [activeRole, setActiveRole] = useState('');
  const [perms, setPerms] = useState([]);

  const loadFromStorage = useCallback(() => {
    const r = JSON.parse(localStorage.getItem('roles') || '[]');
    const a = localStorage.getItem('activeRole') || r[0] || '';
    setRoles(r);
    setActiveRole(a);
  }, []);

  // initial load
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // listen for external role changes (Navbar/Login fire 'role-changed')
  useEffect(() => {
    const handler = () => loadFromStorage();
    window.addEventListener('role-changed', handler);
    return () => window.removeEventListener('role-changed', handler);
  }, [loadFromStorage]);

  // derive perms from activeRole
  useEffect(() => {
    const p = Array.from(new Set(ROLE_PERMS[activeRole] || []));
    setPerms(p);
  }, [activeRole]);

  const changeRole = (role) => {
    localStorage.setItem('activeRole', role);
    setActiveRole(role);
    // notify anyone listening
    window.dispatchEvent(new Event('role-changed'));
  };

  return { roles, activeRole, perms, changeRole };
};
