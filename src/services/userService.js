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

  async getHistory(page = 1, limit = 10) {
    return api.get(`/game/history?page=${page}&limit=${limit}`);
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
