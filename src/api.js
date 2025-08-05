import axios from "axios";

// Create an Axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL, // Uses the URL from your .env file
});

// Request Interceptor to include Authorization header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token"); // Get token from localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; // Add token to headers
  }
  return config;
});

// Response Interceptor for handling errors globally
api.interceptors.response.use(
  (response) => response, // Pass successful responses through
  (error) => {
    if (error.response && error.response.status === 401) {
      alert("Unauthorized. Please log in again.");
      localStorage.removeItem("token"); // Remove invalid token
      window.location.href = "/login"; // Redirect to login
    }
    return Promise.reject(error);
  }
);

export default api;
