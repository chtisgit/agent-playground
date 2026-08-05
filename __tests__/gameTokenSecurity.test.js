/**
 * Security tests for #374 guest-token IDOR fix
 *
 * Covers:
 * - guestUser middleware: non-authorizing crypto.randomUUID() guest id (no Math.random)
 * - requireGameToken middleware: 401 (missing), 403 (invalid token), attach on valid,
 *   JWT backward compat, IDOR proof (guest A token can't access guest B)
 * - startSinglePlayer controller: generates crypto.randomUUID() gameToken, returns in 201
 * - Source-level checks: no Math.random() in authorization path
 */

import fs from 'fs';

// Mock GameModel to isolate middleware behavior
jest.mock('../server/models/game.js', () => {
  const mockGameModel = {
    getGameByToken: jest.fn(),
    getGameById: jest.fn(),
    createGame: jest.fn(),
    updateGame: jest.fn(),
    clearGameToken: jest.fn(),
    deleteGame: jest.fn(),
    getGame: jest.fn(),
  };
  return { __esModule: true, default: mockGameModel };
});

// Mock MahjongService to isolate controller logic
jest.mock('../server/services/mahjongService.js', () => ({
  MahjongService: {
    generateBoard: jest.fn(),
    tilesMatch: jest.fn(),
    getHint: jest.fn(),
  },
}));

import { guestUser, requireGameToken } from '../server/routes/games.js';
import { startSinglePlayer } from '../server/controllers/gameController.js';
import GameModel from '../server/models/game.js';
import { MahjongService } from '../server/services/mahjongService.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
    const source = fs.readFileSync('server/routes/games.js', 'utf8');
    const guestSection = source.split('const guestUser')[1].split('const requireGameToken')[0];
    expect(guestSection).not.toMatch(/Math\.random/);
  });

  it('source check: no Math.random() anywhere in the game authorization path', () => {
    const gamesSource = fs.readFileSync('server/routes/games.js', 'utf8');
    const controllerSource = fs.readFileSync('server/controllers/gameController.js', 'utf8');
    // Authorization must rely on crypto.randomUUID, never Math.random
    expect(gamesSource).not.toMatch(/Math\.random/);
    expect(controllerSource).not.toMatch(/Math\.random/);
  });
});

describe('requireGameToken middleware (#374)', () => {
  let req, res, next;
  const fakeGame = { id: 1, userId: 'guest-a', gameToken: 'token-owner' };

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
    GameModel.getGameByToken.mockReturnValue(null);
    requireGameToken(req, res, next);
    expect(GameModel.getGameByToken).toHaveBeenCalledWith('1', 'attacker-token');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired game token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach game and call next when token is valid', () => {
    req.headers['x-game-token'] = 'token-owner';
    GameModel.getGameByToken.mockReturnValue(fakeGame);
    requireGameToken(req, res, next);
    expect(GameModel.getGameByToken).toHaveBeenCalledWith('1', 'token-owner');
    expect(req.game).toBe(fakeGame);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should allow JWT users backward compat via getGameById when no token sent', () => {
    req.user = { id: 5, username: 'alice' };
    GameModel.getGameById.mockReturnValue(fakeGame);
    requireGameToken(req, res, next);
    expect(GameModel.getGameById).toHaveBeenCalledWith('1', 5);
    expect(req.game).toBe(fakeGame);
    expect(next).toHaveBeenCalled();
  });

  it('should return 404 for JWT user when game belongs to another user', () => {
    req.user = { id: 6, username: 'bob' };
    GameModel.getGameById.mockReturnValue(null);
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Game not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('IDOR PROOF: guest A token cannot access guest B game', () => {
    // Guest A's game (id 1) only authorizes with token 'token-A'
    GameModel.getGameByToken.mockImplementation((gameId, token) =>
      token === 'token-A' ? { id: 1, gameToken: 'token-A' } : null
    );
    // Guest B tries game 1 with their own token 'token-B'
    req.headers['x-game-token'] = 'token-B';
    requireGameToken(req, res, next);
    expect(GameModel.getGameByToken).toHaveBeenCalledWith('1', 'token-B');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('guessed gameId without token is rejected (no enumeration via 401/403)', () => {
    // Attacker guesses a gameId but sends NO token
    req.params = { gameId: '99999' };
    requireGameToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(GameModel.getGameByToken).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
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
    MahjongService.generateBoard.mockReturnValue({
      tiles: { tile_0: 'dot_1', tile_1: 'dot_1' },
      positions: { tile_0: { row: 0, col: 0, layer: 0 }, tile_1: { row: 0, col: 1, layer: 0 } },
    });
    GameModel.createGame.mockImplementation((data) => {
      GameModel.__lastCreated = data;
      return 42;
    });
    GameModel.getGameById.mockReturnValue({
      id: 42,
      gameType: 'singlePlayer',
      difficulty: 'medium',
      tiles: [],
      tilePositions: {},
      score: 0,
      moves: 0,
      matches: 0,
      ended: false,
      status: 'active',
      hintsUsed: 0,
      shufflesUsed: 0,
    });
  });

  it('should generate a 128-bit crypto.randomUUID() gameToken and pass to createGame', () => {
    startSinglePlayer(req, res);
    const created = GameModel.__lastCreated;
    expect(created.gameToken).toMatch(UUID_REGEX);
    expect(created.userId).toBe('guest-uuid-123');
  });

  it('should include gameToken in the 201 response', () => {
    startSinglePlayer(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.gameToken).toMatch(UUID_REGEX);
    expect(payload.game.id).toBe(42);
  });

  it('should generate a different token for each game (non-reuse)', () => {
    startSinglePlayer(req, res);
    const firstToken = GameModel.__lastCreated.gameToken;
    startSinglePlayer(req, res);
    const secondToken = GameModel.__lastCreated.gameToken;
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
