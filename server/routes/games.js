import { randomUUID } from 'crypto';
import { Router } from 'express';
import { 
  saveGame, 
  loadGame, 
  resumeGame, 
  deleteGame, 
  completeGame, 
  getHistory, 
  getLeaderboard,
  generateGame,
  validateMatch,
  startSinglePlayer
} from '../controllers/gameController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import GameModel from '../models/game.js';
import { MahjongService } from '../services/mahjongService.js';

const router = Router();

/**
 * Helper: Extract game access token from request
 * For authenticated users: use userId
 * For guest users: use gameToken from x-game-token header
 */
function getGameAccess(req) {
  if (req.user && !req.user.isGuest) {
    return { type: 'user', id: req.user.id };
  }
  const gameToken = req.headers['x-game-token'];
  if (gameToken) {
    return { type: 'token', token: gameToken };
  }
  return null;
}

/**
 * Helper: Verify game access using either userId or gameToken
 */
function verifyGameAccess(gameId, access) {
  if (!access) return null;
  if (access.type === 'user') {
    return GameModel.getGameById(gameId, access.id);
  }
  if (access.type === 'token') {
    return GameModel.getGameByToken(gameId, access.token);
  }
  return null;
}

// Single player game endpoint - PUBLIC
// Uses optionalAuth: if user has a valid JWT, req.user is set
// If no JWT, proceeds as guest with gameToken from response
router.post('/single-player', optionalAuth, (req, res) => {
  try {
    const { difficulty = 'medium' } = req.body;
    
    // For guest users, generate a unique game token
    const isGuest = !req.user;
    const gameToken = isGuest ? randomUUID() : null;
    
    // Generate board using MahjongService
    const { tiles, positions } = MahjongService.generateBoard(difficulty);
    
    // Format tiles with game state properties
    const formattedTiles = tiles.map((tile, index) => ({
      ...tile,
      index,
      removed: false,
      selected: false
    }));
    
    // Create active game for real-time play
    const userId = req.user ? req.user.id : 0;
    const gameId = GameModel.createGame({
      userId,
      gameType: 'singlePlayer',
      difficulty,
      tiles: formattedTiles,
      tilePositions: positions,
      gameToken
    });
    
    // Get the created game
    const game = GameModel.getGameById(gameId, userId);
    
    const response = {
      game: {
        id: gameId,
        gameType: 'singlePlayer',
        difficulty,
        tiles: game.tiles,
        positions: game.tilePositions,
        score: 0,
        moves: 0,
        matches: 0,
        ended: false,
        status: 'active'
      },
      status: 'active'
    };
    
    // Include gameToken for guest users
    if (gameToken) {
      response.gameToken = gameToken;
    }
    
    res.status(201).json(response);
  } catch (error) {
    console.error('Start single-player game error:', error);
    res.status(500).json({ error: 'Failed to start single-player game' });
  }
});

// Game state management (flat routes - require auth)
router.post('/save', authenticate, saveGame);
router.get('/load/:stateId', authenticate, loadGame);
router.get('/resume', authenticate, resumeGame);
router.delete('/delete/:stateId', authenticate, deleteGame);

// Game completion and stats (require auth)
router.post('/complete', authenticate, completeGame);
router.get('/history', authenticate, getHistory);
router.get('/leaderboard', authenticate, getLeaderboard);

// Game logic - PUBLIC
router.post('/generate', generateGame);
router.post('/validate', validateMatch);

// === Game-specific endpoints with gameId parameter ===
// Use optionalAuth + gameToken for access control

/**
 * Get game state by ID
 * GET /api/games/:gameId
 */
router.get('/:gameId', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const access = getGameAccess(req);
    const game = verifyGameAccess(gameId, access);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
});

/**
 * Make a move (select a tile or match tiles)
 * POST /api/games/:gameId/move
 */
router.post('/:gameId/move', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const { tileIndex } = req.body;
    const access = getGameAccess(req);
    const game = verifyGameAccess(gameId, access);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Update game state server-side
    if (tileIndex !== undefined && tileIndex >= 0 && tileIndex < game.tiles.length) {
      const tile = game.tiles[tileIndex];
      if (!tile.removed) {
        tile.selected = !tile.selected;
      }
    }
    
    // Check for match if two tiles are selected
    const selectedTiles = game.tiles.filter(t => t.selected && !t.removed);
    let matched = false;
    if (selectedTiles.length === 2) {
      const [tile1, tile2] = selectedTiles;
      if (tile1.suit === tile2.suit && tile1.value === tile2.value) {
        tile1.removed = true;
        tile2.removed = true;
        tile1.selected = false;
        tile2.selected = false;
        game.matches = (game.matches || 0) + 1;
        matched = true;
        
        // Calculate score server-side
        game.score = (game.score || 0) + 10;
      } else {
        tile1.selected = false;
        tile2.selected = false;
      }
    }
    
    game.moves = (game.moves || 0) + 1;
    
    // Update server-side game state
    GameModel.updateGame(gameId, game);
    
    res.json({ 
      success: true, 
      game,
      matched,
      message: matched ? 'Match made!' : 'Move recorded'
    });
  } catch (error) {
    console.error('Make move error:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
});

/**
 * Get a hint for the current game
 * GET /api/games/:gameId/hint
 */
router.get('/:gameId/hint', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const access = getGameAccess(req);
    const game = verifyGameAccess(gameId, access);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const hintResult = MahjongService.getHint(game.tiles, game.tilePositions || []);
    
    // Convert tile IDs to indices for frontend
    let tileIndex = null;
    if (hintResult && hintResult.tile1Id && game.tiles) {
      tileIndex = game.tiles.findIndex(t => t.id === hintResult.tile1Id || t.tileId === hintResult.tile1Id);
    }
    
    res.json({ hint: hintResult, tileIndex });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ error: 'Failed to get hint' });
  }
});

/**
 * Shuffle the board
 * POST /api/games/:gameId/shuffle
 */
router.post('/:gameId/shuffle', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const access = getGameAccess(req);
    const game = verifyGameAccess(gameId, access);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const { tiles, positions } = MahjongService.generateBoard(game.difficulty);
    
    // Re-format tiles with game state properties
    const formattedTiles = tiles.map((tile, index) => ({
      ...tile,
      id: tile.id || `tile_${index}`,
      index,
      removed: false,
      selected: false
    }));
    
    game.tiles = formattedTiles;
    game.tilePositions = positions;
    game.shuffles = (game.shuffles || 0) + 1;
    
    GameModel.updateGame(gameId, game);
    
    res.json({ 
      success: true, 
      game,
      message: 'Board shuffled'
    });
  } catch (error) {
    console.error('Shuffle error:', error);
    res.status(500).json({ error: 'Failed to shuffle' });
  }
});

/**
 * End the game
 * POST /api/games/:gameId/end
 */
router.post('/:gameId/end', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const access = getGameAccess(req);
    const game = verifyGameAccess(gameId, access);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    game.ended = true;
    game.status = 'completed';
    game.endedAt = new Date();
    
    const baseScore = (game.matches || 0) * 10;
    const remainingTiles = game.tiles.filter(t => !t.removed).length;
    const completionBonus = remainingTiles === 0 ? 100 : 0;
    const shufflePenalty = (game.shuffles || 0) * 5;
    
    game.score = Math.max(0, baseScore + completionBonus - shufflePenalty);
    
    // Only record for authenticated (non-guest) users
    if (access.type === 'user') {
      GameModel.recordGame({
        userId: access.id,
        gameType: game.gameType || 'singlePlayer',
        difficulty: game.difficulty,
        score: game.score,
        duration: game.duration || 0,
        result: remainingTiles === 0 ? 'win' : 'abandoned'
      });
    }
    
    GameModel.updateGame(gameId, game);
    
    res.json({ 
      success: true, 
      game: {
        id: game.id,
        score: game.score,
        matches: game.matches,
        moves: game.moves,
        ended: true,
        status: 'completed'
      },
      message: 'Game ended'
    });
  } catch (error) {
    console.error('End game error:', error);
    res.status(500).json({ error: 'Failed to end game' });
  }
});

export default router;
