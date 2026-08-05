/**
 * Tests for GameModel token-gated guest access (#374 guest-token IDOR fix)
 *
 * Covers:
 * - gameTokens Map declared (no ReferenceError at module load / createGame)
 * - createGame stores gameToken, getGameByToken retrieves
 * - IDOR isolation: guest A token cannot access guest B game
 * - getGameById still enforces userId ownership
 * - clearGameToken removes token (end-of-game hardening)
 * - deleteGame clears token mapping
 *
 * NOTE: only in-memory methods are exercised (no DB writes needed).
 */

import GameModel from '../server/models/game.js';

describe('GameModel game token security (#374)', () => {
  const createTestGame = (token, userId = 'guest-a') =>
    GameModel.createGame({
      userId,
      gameType: 'singlePlayer',
      difficulty: 'medium',
      tiles: [],
      tilePositions: {},
      gameToken: token,
    });

  it('module loads without ReferenceError (gameTokens Map is declared)', () => {
    // If `gameTokens` were undeclared, createGame with a token would throw ReferenceError
    const gameId = createTestGame('token-declared');
    expect(GameModel.getGameByToken(gameId, 'token-declared')).not.toBeNull();
    GameModel.deleteGame(gameId);
  });

  it('should store gameToken on createGame and retrieve via getGameByToken', () => {
    const gameId = createTestGame('token-abc-123');
    const game = GameModel.getGameByToken(gameId, 'token-abc-123');
    expect(game).not.toBeNull();
    expect(game.id).toBe(gameId);
    expect(game.gameToken).toBe('token-abc-123');
    GameModel.deleteGame(gameId);
  });

  it('should return null for getGameByToken with wrong token (guessed gameId rejected)', () => {
    const gameId = createTestGame('token-owner');
    // Attacker guesses the gameId but presents a different token
    expect(GameModel.getGameByToken(gameId, 'attacker-token')).toBeNull();
    // And the real owner still works
    expect(GameModel.getGameByToken(gameId, 'token-owner')).not.toBeNull();
    GameModel.deleteGame(gameId);
  });

  it('IDOR PROOF: guest A token cannot access guest B game', () => {
    const gameA = createTestGame('token-A', 'guest-A');
    const gameB = createTestGame('token-B', 'guest-B');

    // Guest B (token-B) tries to access guest A's game (gameA)
    expect(GameModel.getGameByToken(gameA, 'token-B')).toBeNull();
    // Guest A's own token works on game A
    expect(GameModel.getGameByToken(gameA, 'token-A')).not.toBeNull();
    // Guest B's own token works on game B
    expect(GameModel.getGameByToken(gameB, 'token-B')).not.toBeNull();
    // Guest A (token-A) cannot access guest B's game
    expect(GameModel.getGameByToken(gameB, 'token-A')).toBeNull();

    GameModel.deleteGame(gameA);
    GameModel.deleteGame(gameB);
  });

  it('getGameById still enforces userId ownership (backward compat path)', () => {
    const gameId = createTestGame('token-1', 'guest-A');
    expect(GameModel.getGameById(gameId, 'guest-B')).toBeNull();
    expect(GameModel.getGameById(gameId, 'guest-A')).not.toBeNull();
    GameModel.deleteGame(gameId);
  });

  it('clearGameToken removes the token so it can no longer authorize', () => {
    const gameId = createTestGame('token-end');
    expect(GameModel.getGameByToken(gameId, 'token-end')).not.toBeNull();

    const cleared = GameModel.clearGameToken(gameId);
    expect(cleared).toBe(true);
    expect(GameModel.getGameByToken(gameId, 'token-end')).toBeNull();
    GameModel.deleteGame(gameId);
  });

  it('deleteGame clears the token mapping', () => {
    const gameId = createTestGame('token-del');
    expect(GameModel.getGameByToken(gameId, 'token-del')).not.toBeNull();
    GameModel.deleteGame(gameId);
    expect(GameModel.getGameByToken(gameId, 'token-del')).toBeNull();
  });

  it('token must be unique per game (no cross-game token reuse)', () => {
    const gameId1 = createTestGame('token-unique-1', 'guest-a');
    const gameId2 = createTestGame('token-unique-2', 'guest-b');
    // token for game 1 must not authorize game 2
    expect(GameModel.getGameByToken(gameId2, 'token-unique-1')).toBeNull();
    expect(GameModel.getGameByToken(gameId1, 'token-unique-2')).toBeNull();
    GameModel.deleteGame(gameId1);
    GameModel.deleteGame(gameId2);
  });
});
