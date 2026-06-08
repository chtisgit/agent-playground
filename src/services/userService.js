import { api } from './api';

export const userService = {
  async getProfile() {
    return api.get('/auth/profile');
  },

  async updateProfile(data) {
    return api.put('/auth/profile', data);
  },

  async getStats() {
    return api.get('/auth/stats');
  },

  async getHistory(limit = 20) {
    return api.get(`/games/history?limit=${limit}`);
  },

  async register(username, email, password) {
    return api.post('/auth/register', { username, email, password });
  },

  async login(username, password) {
    return api.post('/auth/login', { username, password });
  },

  async logout() {
    return api.post('/auth/logout', {});
  },
};
