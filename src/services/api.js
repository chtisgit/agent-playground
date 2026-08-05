export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Helper function to get authentication headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// Game token header for guest single-player access
// SECURITY (Stefan #374): X-Game-Token is a server-generated crypto.randomUUID()
// (128-bit, non-spoofable). ONE storage (localStorage) + ONE header (X-Game-Token).
// The old getCommonHeaders/sessionStorage path was dead code and removed.
const getGameTokenHeader = () => {
  const gameToken = localStorage.getItem('gameToken');
  return gameToken ? { 'X-Game-Token': gameToken } : {};
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...getAuthHeaders(),
  ...getGameTokenHeader()
});

export const api = {
  async get(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },

  async post(endpoint, data) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },

  async put(endpoint, data) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },

  async delete(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return response.json();
  },
};
