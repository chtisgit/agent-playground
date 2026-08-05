/**
 * Security tests for #374 guest-token IDOR fix
 *
 * Covers:
 * - guestUser middleware: non-authorizing crypto.randomUUID() guest id (no Math.random)
 * - requireGameToken middleware: 401 (missing), 403 (invalid token), attach on valid,
 *   JWT backward compat, IDOR proof (guest A token can't access guest B)
 * - startSinglePlayer controller: generates crypto.randomUUID() gameToken, returns in 201
 * - Source-level checks: no Math.random() in authorization path
 *
 * NOTE (ESM/jest): this repo runs jest with --experimental-vm-modules and has no babel
 * transform (jest.config.js `transform: {}`). jest.mock() is not hoisted in ESM, so
 * these tests exercise the REAL in-memory GameModel (createGame / getGameByToken /
 * getGameById) instead of module mocks - same isolation for the middleware under test,
 * and consistent with __tests__/gameModel.test.js.
 */

import fs from 'fs';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { guestUser, requireGameToken } from '../server/routes/games.js';
import { startSinglePlayer } from '../server/controllers/gameController.js';
import GameModel from '../server/models/game.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Strip comments before source checks: the codebase legitimately documents the OLD
// Math.random() approach in comments (e.g. "replaces the old Math.random() guest id").
// The criterion is that Math.random must not be USED in the auth path - so we check
// the code after removing comments.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .trim();


describe('guestUser middleware (#374)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should assign a crypto.randomUUID()-based guest id (128-bit, non-numeric)', () => {
    guestUser(req, res, next);
    expect(req.user.isGuest).toBe(true);
    expect(req.user.username).toBe('guest');
    // 128-bit UUID format: 8-4-4-4-12 hex groups
    expect(req.user.id).toMatch(UUID_REGEX);
    // Must NOT be a guessable numeric id (old Math.random() 900k space)
    expect(Number.isInteger(req.user.id)).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it('should NOT override an existing authenticated user', () => {
    req.user = { id: 5, username: 'alice' };
    guestUser(req, res, next);
    expect(req.user.id).toBe(5);
    expect(req.user.isGuest).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('source check: guestUser middleware must not use Math.random()', () => {
    const source = stripComments(fs.readFileSync('server/routes/games.js', 'utf8'));
    const guestSection = source.split('const guestUser')[1].split('const requireGameToken')[0];
    expect(guestSection).not.toMatch(/Math\.random/);
  });

  it('source check: no Math.random() anywhere in the game authorization path', () => {
    const gamesSource = stripComments(fs.readFileSync('server/routes/games.js', 'utf8'));
    const controllerSource = stripComments(fs.readFileSync('server/controllers/gameController.js', 'utf8'));
    // Authorization must rely on crypto.randomUUID, never Math.random
    expect(gamesSource).not.toMatch(/Math\.random/);
    expect(controllerSource).not.toMatch(/Math\.random/);
  });
});

describe('requireGameToken middleware (#374)', () => {
  let req, res, next;

  // Uses the REAL in-memory GameModel (same singleton the middleware references).
  const createGame = (token, userId = 'guest-a') =>
    GameModel.createGame({
      userId,
      gameType: 'singlePlayer',
      difficulty: 'medium',
      tiles: [],
      tilePositions: {},
      gameToken: token,
    });

  beforeEach(() => {
    req = { params: { gameId: '1' }, headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 when no token and no JWT user', () => {
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Game token required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when token is present but invalid', () => {
    req.headers['x-game-token'] = 'attacker-token';
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired game token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach game and call next when token is valid', () => {
    const gameId = createGame('token-owner');
    req.params = { gameId: String(gameId) };
    req.headers['x-game-token'] = 'token-owner';
    requireGameToken(req, res, next);
    expect(req.game).not.toBeUndefined();
    expect(req.game.id).toBe(gameId);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    GameModel.deleteGame(gameId);
  });

  it('should allow JWT users backward compat via getGameById when no token sent', () => {
    const gameId = createGame('token-1', 5);
    req.params = { gameId: String(gameId) };
    req.user = { id: 5, username: 'alice' };
    requireGameToken(req, res, next);
    expect(req.game).not.toBeUndefined();
    expect(req.game.id).toBe(gameId);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    GameModel.deleteGame(gameId);
  });

  it('should return 404 for JWT user when game belongs to another user', () => {
    const gameId = createGame('token-2', 6);
    req.params = { gameId: String(gameId) };
    req.user = { id: 5, username: 'alice' };
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Game not found' });
    expect(next).not.toHaveBeenCalled();
    GameModel.deleteGame(gameId);
  });

  it('IDOR PROOF: guest A token cannot access guest B game', () => {
    const gameA = createGame('token-A', 'guest-A');
    const gameB = createGame('token-B', 'guest-B');

    // Guest B tries game A with their own token 'token-B'
    req.params = { gameId: String(gameA) };
    req.headers['x-game-token'] = 'token-B';
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    // Guest A's own token still works on game A
    req.headers['x-game-token'] = 'token-A';
    requireGameToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.game.id).toBe(gameA);

    GameModel.deleteGame(gameA);
    GameModel.deleteGame(gameB);
  });

  it('guessed gameId without token is rejected (no enumeration via 401/403)', () => {
    // Attacker guesses a gameId but sends NO token
    req.params = { gameId: '99999' };
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('STALE-TOKEN FIX (#374 follow-up): authenticated non-guest with a stale X-Game-Token reaches their own game via JWT path (no 403)', () => {
    const gameId = createGame('token-owner', 5);
    req.params = { gameId: String(gameId) };
    req.user = { id: 5, username: 'alice' };
    // Stale token left over from another session/game - NOT this game's token
    req.headers['x-game-token'] = 'stale-token-from-another-game';
    requireGameToken(req, res, next);
    // Must NOT 403 on token mismatch: JWT ownership takes precedence
    expect(res.status).not.toHaveBeenCalled();
    expect(req.game).not.toBeUndefined();
    expect(req.game.id).toBe(gameId);
    expect(next).toHaveBeenCalled();
    GameModel.deleteGame(gameId);
  });

  it('FALL-THROUGH (#374 follow-up, Boris Option 1): authenticated user with a VALID X-Game-Token for a guest-owned game is authorized via the token path', () => {
    // Game is guest-owned (guest UUID userId); user 5 is logged in (JWT) and holds the game's token
    const gameId = createGame('token-owner', 'guest-uuid-123');
    req.params = { gameId: String(gameId) };
    req.user = { id: 5, username: 'alice' };
    req.headers['x-game-token'] = 'token-owner';
    requireGameToken(req, res, next);
    // JWT path finds no owned game -> falls through to token path; valid token grants access
    expect(res.status).not.toHaveBeenCalled();
    expect(req.game).not.toBeUndefined();
    expect(req.game.id).toBe(gameId);
    expect(next).toHaveBeenCalled();
    GameModel.deleteGame(gameId);
  });

  it('FALL-THROUGH (#374 follow-up, Boris Option 1): authenticated user with an INVALID token for a guest-owned game gets 403', () => {
    const gameId = createGame('token-owner', 'guest-uuid-123');
    req.params = { gameId: String(gameId) };
    req.user = { id: 5, username: 'alice' };
    req.headers['x-game-token'] = 'wrong-token';
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired game token' });
    expect(next).not.toHaveBeenCalled();
    GameModel.deleteGame(gameId);
  });

  it('FALL-THROUGH (#374 follow-up, Boris Option 1): authenticated user with no owned game and no token gets 404', () => {
    const gameId = createGame('token-owner', 'guest-uuid-123');
    req.params = { gameId: String(gameId) };
    req.user = { id: 5, username: 'alice' };
    // no X-Game-Token header
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Game not found' });
    expect(next).not.toHaveBeenCalled();
    GameModel.deleteGame(gameId);
  });
});

describe('startSinglePlayer controller (#374)', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: { difficulty: 'medium' },
      user: { id: 'guest-uuid-123', isGuest: true },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    jest.clearAllMocks();
  });

  it('should generate a 128-bit crypto.randomUUID() gameToken and store it on the game', () => {
    startSinglePlayer(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.gameToken).toMatch(UUID_REGEX);
    // Token must be persisted server-side so getGameByToken can authorize it later
    const game = GameModel.getGameById(payload.game.id, 'guest-uuid-123');
    expect(game).not.toBeNull();
    expect(game.gameToken).toBe(payload.gameToken);
    GameModel.deleteGame(payload.game.id);
  });

  it('should include gameToken in the 201 response', () => {
    startSinglePlayer(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.gameToken).toMatch(UUID_REGEX);
    expect(payload.game.id).toBeGreaterThan(0);
    expect(payload.status).toBe('active');
    GameModel.deleteGame(payload.game.id);
  });

  it('should generate a different token for each game (non-reuse)', () => {
    startSinglePlayer(req, res);
    const firstToken = res.json.mock.calls[0][0].gameToken;
    startSinglePlayer(req, res);
    const secondToken = res.json.mock.calls[1][0].gameToken;
    expect(firstToken).not.toBe(secondToken);
    expect(firstToken).toMatch(UUID_REGEX);
    expect(secondToken).toMatch(UUID_REGEX);
  });
});

describe('end route guard (#374)', () => {
  it('end route guards req.user before isGuest (token-only guests have no req.user)', () => {
    const source = fs.readFileSync('server/routes/games.js', 'utf8');
    // The end handler must not crash on token-only guests: guard req.user first
    expect(source).toMatch(/if \(req\.user && !req\.user\.isGuest\)/);
  });
});

describe('move handler completion hardening (#374 follow-up)', () => {
  it('source check: move handler clears the game token when the board is fully cleared', () => {
    const source = fs.readFileSync('server/routes/games.js', 'utf8');
    // Isolate the move handler (from '/:gameId/move' up to '/:gameId/hint')
    const moveSection = source.split("router.post('/:gameId/move'")[1].split("router.get('/:gameId/hint'")[0];
    expect(moveSection).toMatch(/remainingTiles === 0/);
    // clearGameToken must be invoked in the completion branch of the MOVE handler,
    // not only in /end (the /end clearGameToken sits outside this section)
    expect(moveSection).toMatch(/GameModel\.clearGameToken\(gameId\)/);
  });
});
