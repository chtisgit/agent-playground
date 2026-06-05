import { api } from './api';

export const gameService = {
  async startSinglePlayer(difficulty = 'medium') {
    return api.post('/games/single-player', { difficulty });
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
    return api.post(`/games/${gameId}/end`, { score });
  },
};
