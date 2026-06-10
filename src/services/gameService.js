import { api } from './api';

export const gameService = {
  async startSinglePlayer(difficulty = 'medium') {
    const response = await api.post('/games/single-player', { difficulty });
    // Store gameToken for guest (unauthenticated) single-player access
    // Per Stefan's security decision: crypto.randomUUID() token, not spoofable
    if (response.gameToken) {
      localStorage.setItem('gameToken', response.gameToken);
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
    // Guest games are removed from server Map at endGame — no stale data
    localStorage.removeItem('gameToken');
    return response;
  },
};
