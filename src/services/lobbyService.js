import { api } from './api';

export const lobbyService = {
  async createRoom(playerName) {
    return api.post('/lobby/rooms', { playerName });
  },

  async joinRoom(roomId, playerName) {
    return api.post(`/lobby/rooms/${roomId}/join`, { playerName });
  },

  async leaveRoom(roomId) {
    return api.post(`/lobby/rooms/${roomId}/leave`, {});
  },

  async getRooms() {
    return api.get('/lobby/rooms');
  },

  async getRoomState(roomId) {
    return api.get(`/lobby/rooms/${roomId}`);
  },
};

export const gameSocket = {
  socket: null,

  connect(roomId, callbacks) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.VITE_SOCKET_PORT || '3000';
    this.socket = new WebSocket(`${protocol}//${host}:${port}?room=${roomId}`);

    this.socket.onopen = callbacks.onConnect;
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callbacks.onMessage(data);
    };
    this.socket.onclose = callbacks.onDisconnect;
    this.socket.onerror = callbacks.onError;

    return this;
  },

  send(message) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  },

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  },
};
