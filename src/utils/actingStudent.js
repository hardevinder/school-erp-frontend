// Single source of truth for "acting" student (selected child or self)
const KEY = "activeStudentAdmission";

export const getActingAdmission = () =>
  localStorage.getItem(KEY) ||
  localStorage.getItem("username") || // fallback to own username
  "";

export const setActingAdmission = (admissionNumber) => {
  if (!admissionNumber) return;
  localStorage.setItem(KEY, admissionNumber);
  // Let the app know the acting student changed
  window.dispatchEvent(new CustomEvent("student-switched", {
    detail: { admissionNumber }
  }));
};

// Optional: clear when needed (e.g., on logout)
export const clearActingAdmission = () => localStorage.removeItem(KEY);
