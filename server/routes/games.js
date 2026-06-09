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
    
    // For guest users, generate a unique game token (server-side, unforgeable)
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
    
    // Include gameToken for guest users (client stores in sessionStorage)
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
 * 
 * Validates that:
 * 1. The tile exists and is not removed
 * 2. When matching two tiles, both are unblocked and actually match (uses MahjongService)
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
    
    // Validate tileIndex
    if (tileIndex === undefined || tileIndex < 0 || tileIndex >= game.tiles.length) {
      return res.status(400).json({ error: 'Invalid tile index' });
    }
    
    const clickedTile = game.tiles[tileIndex];
    if (clickedTile.removed) {
      return res.status(400).json({ error: 'Tile already removed' });
    }
    
    // Check which tiles are currently selected (not removed, but selected)
    const currentlySelected = game.tiles
      .map((t, i) => ({ tile: t, index: i }))
      .filter(t => t.tile.selected && !t.tile.removed);
    
    let matched = false;
    
    if (currentlySelected.length === 0) {
      // First tile selection - just select it
      clickedTile.selected = true;
    } else if (currentlySelected.length === 1) {
      // Second tile selection - attempt match
      const firstTile = currentlySelected[0];
      
      if (firstTile.index === tileIndex) {
        // Clicking same tile - deselect
        clickedTile.selected = false;
      } else {
        // Two different tiles selected - validate match
        // Build tiles and positions maps for MahjongService
        const tilesMap = {};
        const positionsMap = {};
        game.tiles.forEach((t, i) => {
          if (!t.removed) {
            const tileId = t.id || `tile_${i}`;
            tilesMap[tileId] = t.suit ? `${t.suit}_${t.value}` : t.type || tileId;
            if (game.tilePositions && game.tilePositions[tileId]) {
              positionsMap[tileId] = game.tilePositions[tileId];
            }
          }
        });
        
        const firstTileId = firstTile.tile.id || `tile_${firstTile.index}`;
        const secondTileId = clickedTile.id || `tile_${tileIndex}`;
        
        // Use MahjongService to validate the match (checks blocking + matching rules)
        const isValid = MahjongService.validateMatch(tilesMap, positionsMap, firstTileId, secondTileId);
        
        if (isValid) {
          // Valid match - remove both tiles
          firstTile.tile.removed = true;
          firstTile.tile.selected = false;
          clickedTile.removed = true;
          clickedTile.selected = false;
          game.matches = (game.matches || 0) + 1;
          matched = true;
          
          // Calculate score based on difficulty
          const baseScores = { easy: 10, medium: 20, hard: 30 };
          const base = baseScores[game.difficulty] || 20;
          game.score = (game.score || 0) + base;
          
          // Check for win condition - all tiles removed
          const remainingTiles = game.tiles.filter(t => !t.removed).length;
          if (remainingTiles === 0) {
            game.ended = true;
            game.status = 'completed';
            game.endedAt = new Date();
          }
        } else {
          // Invalid match - deselect both tiles
          firstTile.tile.selected = false;
          clickedTile.selected = false;
        }
      }
    } else {
      // Should not happen, but reset all selections
      game.tiles.forEach(t => { if (t.selected) t.selected = false; });
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
    const formattedTiles = Object.entries(tiles).map(([tileId, tileType], index) => ({
      id: tileId,
      type: tileType,
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
    if (access && access.type === 'user') {
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
