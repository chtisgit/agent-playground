import { api } from './api';

export const userService = {
  async getProfile() {
    return api.get('/users/profile');
  },

  async updateProfile(data) {
    return api.put('/users/profile', data);
  },

  async getStats() {
    return api.get('/users/stats');
  },

  async getHistory(page = 1, limit = 10) {
    return api.get(`/users/history?page=${page}&limit=${limit}`);
  },

  async register(username, email, password) {
    return api.post('/users/register', { username, email, password });
  },

  async login(username, password) {
    return api.post('/users/login', { username, password });
  },

  async logout() {
    return api.post('/users/logout', {});
  },
};
