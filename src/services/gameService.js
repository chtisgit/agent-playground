import { api } from './api';

export const gameService = {
  async startSinglePlayer(difficulty = 'medium') {
    const response = await api.post('/games/single-player', { difficulty });
    // Store game token for guest session persistence (server-generated, unforgeable)
    if (response.gameToken) {
      sessionStorage.setItem('gameToken', response.gameToken);
    }
    return response;
  },

  async getGameState(gameId) {
    return api.get(`/games/${gameId}`);
  },

  async makeMove(gameId, tileIndex) {
    return api.post(`/games/${gameId}/move`, { tileIndex });
  },

  async hint(gameId) {
    return api.get(`/games/${gameId}/hint`);
  },

  async shuffle(gameId) {
    return api.post(`/games/${gameId}/shuffle`);
  },

  async endGame(gameId, score) {
    const response = await api.post(`/games/${gameId}/end`, { score });
    // Clear game token when game ends
    sessionStorage.removeItem('gameToken');
    return response;
  },

  // Game state persistence - save current game progress
  async saveGame(gameData) {
    return api.post('/games/save', gameData);
  },

  // Resume the latest saved game
  async resumeGame() {
    return api.get('/games/resume');
  },

  // Load a specific saved game by ID
  async loadGame(stateId) {
    return api.get(`/games/load/${stateId}`);
  },

  // Delete a saved game
  async deleteSavedGame(stateId) {
    return api.delete(`/games/delete/${stateId}`);
  },
};
