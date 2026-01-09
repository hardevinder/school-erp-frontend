// src/hooks/useRoles.js
import { useState, useEffect, useCallback } from "react";
import { ROLE_PERMS } from "../constants/rolePerms";

const norm = (v) => String(v || "").trim().toLowerCase();

// pick best default when activeRole is missing
const pickDefaultRole = (roles = []) => {
  const r = roles.map(norm).filter(Boolean);

  // ✅ prefer these if present
  const priority = ["frontoffice", "librarian", "accounts", "hr", "academic_coordinator", "teacher", "student", "admin", "superadmin"];
  for (const p of priority) if (r.includes(p)) return p;

  return r[0] || "";
};

export const useRoles = () => {
  const [roles, setRoles] = useState([]);
  const [activeRole, setActiveRole] = useState("");
  const [perms, setPerms] = useState([]);

  const loadFromStorage = useCallback(() => {
    const raw = JSON.parse(localStorage.getItem("roles") || "[]");
    const r = Array.isArray(raw) ? raw.map(norm).filter(Boolean) : [];

    // ✅ read activeRole from either activeRole OR userRole
    let a = norm(localStorage.getItem("activeRole") || localStorage.getItem("userRole") || "");

    // ✅ if missing or invalid, choose a better default
    if (!a || (r.length && !r.includes(a))) {
      a = pickDefaultRole(r);
      if (a) {
        localStorage.setItem("activeRole", a);
        localStorage.setItem("userRole", a); // ✅ keep legacy single-role in sync
      }
    }

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
    window.addEventListener("role-changed", handler);
    return () => window.removeEventListener("role-changed", handler);
  }, [loadFromStorage]);

  // derive perms from activeRole
  useEffect(() => {
    const key = norm(activeRole);
    const p = Array.from(new Set(ROLE_PERMS[key] || []));
    setPerms(p);
  }, [activeRole]);

  const changeRole = (role) => {
    const r = norm(role);
    localStorage.setItem("activeRole", r);
    localStorage.setItem("userRole", r); // ✅ keep in sync
    setActiveRole(r);
    window.dispatchEvent(new Event("role-changed"));
  };

  return { roles, activeRole, perms, changeRole };
};
