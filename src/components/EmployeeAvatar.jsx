import React, { useState } from "react";

const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:3000").replace(/\/$/, "");

export const getEmployeePhotoUrl = (person) => {
  const raw =
    person?.photo_url ||
    person?.photoUrl ||
    person?.profilePhoto ||
    person?.employee?.photo_url ||
    person?.Employee?.photo_url ||
    "";
  if (!raw) return "";
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return `${API_BASE}/${String(raw).replace(/^\/+/, "")}`;
};

const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const EmployeeAvatar = ({ person, name, size = 36, className = "" }) => {
  const [failed, setFailed] = useState(false);
  const label = name || person?.name || person?.employee?.name || "Employee";
  const src = getEmployeePhotoUrl(person);
  const style = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: "50%",
    objectFit: "cover",
  };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${label} profile`}
        className={className}
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`d-inline-flex align-items-center justify-content-center bg-primary-subtle text-primary fw-bold ${className}`}
      style={{ ...style, fontSize: Math.max(10, Math.round(size * 0.34)) }}
      aria-label={label}
    >
      {initials(label)}
    </span>
  );
};

export default EmployeeAvatar;
