export const isStudent360Path = () => window.location.pathname.startsWith("/student-360/");

export const getAuthToken = () =>
  (isStudent360Path() && sessionStorage.getItem("student360Token")) ||
  localStorage.getItem("token") || localStorage.getItem("authToken") || "";

export const clearStudent360Session = () => {
  sessionStorage.removeItem("student360Token");
  sessionStorage.removeItem("student360Student");
};
