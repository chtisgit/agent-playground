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

// Game token management for guest single-player sessions
// Server generates crypto.randomUUID() token - client just stores and forwards it
function getGameToken() {
  return sessionStorage.getItem('gameToken') || null;
}

// Common headers for all requests
const getCommonHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
  };
  // Include game token for guest game access (server-generated, unforgeable)
  const gameToken = getGameToken();
  if (gameToken) {
    headers['x-game-token'] = gameToken;
  }
  return headers;
};

// Helper to get game token header for guest single-player access
// Per Stefan's security decision: X-Game-Token uses crypto.randomUUID()
// which is not spoofable (unlike x-guest-id approach)
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
