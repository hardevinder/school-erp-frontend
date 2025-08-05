const API_URL = "http://localhost:5000"; // Update with your backend URL

// Standard Login (Email/Username + Password)
export const standardLogin = async (login, password) => {
    const response = await fetch(`${API_URL}/loginUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
    });
    return await response.json();
};

// Google Login (Using google_id)
export const googleLogin = async (google_id) => {
    const response = await fetch(`${API_URL}/loginUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_id }),
    });
    return await response.json();
};
