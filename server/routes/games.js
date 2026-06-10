import { Router } from 'express';
import { 
  saveGame, 
  loadGame, 
  resumeGame, 
  updateGame, 
  deleteGame, 
  completeGame, 
  getHistory, 
  getLeaderboard,
  generateGame,
  validateMatch,
  getHint,
  startSinglePlayer
} from '../controllers/gameController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import GameModel from '../models/game.js';
import { MahjongService } from '../services/mahjongService.js';

const router = Router();

// Guest user middleware - allows single-player without login
// Assigns a guest user ID for unauthenticated requests
const guestUser = (req, res, next) => {
  if (!req.user) {
    // Generate a guest user ID
    const guestId = 1000000 + Math.floor(Math.random() * 900000);
    req.user = { id: guestId, username: 'guest', isGuest: true };
  }
  next();
};

/**
 * Parse tile type string into suit and value components
 * e.g. 'dot_1' -> { suit: 'dot', value: '1' }
 */
function parseTileType(type) {
  const underscoreIndex = type.indexOf('_');
  if (underscoreIndex === -1) {
    return { suit: type, value: '' };
  }
  return {
    suit: type.substring(0, underscoreIndex),
    value: type.substring(underscoreIndex + 1)
  };
}

/**
 * Convert tiles object (from generateBoard: { tileId: tileType }) 
 * to formatted array for game state storage
 */
function formatTilesFromBoard(tilesObj) {
  return Object.entries(tilesObj).map(([tileId, tileType], index) => {
    const { suit, value } = parseTileType(tileType);
    return {
      id: tileId,
      type: tileType,
      suit,
      value,
      index,
      removed: false,
      selected: false
    };
  });
}

// Single player game endpoint - PUBLIC (no auth required)
router.post('/single-player', guestUser, startSinglePlayer);

// Game state management (flat routes - require auth)
router.post('/save', authenticate, saveGame);
router.get('/load/:stateId', authenticate, loadGame);
router.get('/resume', authenticate, resumeGame);
router.put('/update/:stateId', authenticate, updateGame);
router.delete('/delete/:stateId', authenticate, deleteGame);

// Game completion and stats (require auth)
router.post('/complete', authenticate, completeGame);
router.get('/history', authenticate, getHistory);
router.get('/leaderboard', authenticate, getLeaderboard);

// Game logic - PUBLIC (no auth required for game generation/validation)
router.post('/generate', optionalAuth, generateGame);
router.post('/validate', optionalAuth, validateMatch);
router.post('/hint', optionalAuth, getHint);

// === Game-specific endpoints with gameId parameter - PUBLIC (guest support) ===

/**
 * Get game state by ID
 * GET /api/games/:gameId
 */
router.get('/:gameId', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    const game = GameModel.getGameById(gameId, req.user.id);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json({ game });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
});

/**
 * Make a move (select a tile or match tiles)
 * POST /api/games/:gameId/move
 */
router.post('/:gameId/move', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    const { tileIndex } = req.body;
    
    // Get game from server-side state
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Validate tileIndex
    if (tileIndex === undefined || tileIndex < 0 || tileIndex >= game.tiles.length) {
      return res.status(400).json({ error: 'Invalid tile index' });
    }
    
    const clickedTile = game.tiles[tileIndex];
    if (!clickedTile || clickedTile.removed) {
      return res.status(400).json({ error: 'Invalid or removed tile' });
    }
    
    // Toggle selection using selectedTileIndex tracker
    let matchMade = false;
    if (game.selectedTileIndex === undefined) {
      // First selection
      game.selectedTileIndex = tileIndex;
      game.tiles[tileIndex].selected = true;
    } else if (game.selectedTileIndex === tileIndex) {
      // Deselect same tile
      game.tiles[tileIndex].selected = false;
      game.selectedTileIndex = undefined;
    } else {
      // Second tile - check for match using suit/value (server-side validation)
      const firstTile = game.tiles[game.selectedTileIndex];
      const secondTile = game.tiles[tileIndex];
      const firstIndex = game.selectedTileIndex;
      
      // Reset selection state
      game.tiles[firstIndex].selected = false;
      game.selectedTileIndex = undefined;
      
      // Validate match: same suit AND same value
      if (firstTile.suit === secondTile.suit && firstTile.value === secondTile.value) {
        // Remove matched tiles
        game.tiles[firstIndex].removed = true;
        game.tiles[tileIndex].removed = true;
        
        game.matches = (game.matches || 0) + 1;
        const pointsPerMatch = { easy: 10, medium: 20, hard: 30 };
        game.score = (game.score || 0) + (pointsPerMatch[game.difficulty] || 20);
        matchMade = true;
        
        // Check if game is fully cleared
        const remainingTiles = game.tiles.filter(t => !t.removed).length;
        if (remainingTiles === 0) {
          game.ended = true;
          game.status = 'completed';
        }
      }
      
      game.moves = (game.moves || 0) + 1;
    }
    
    // Save updated game state
    GameModel.updateGame(gameId, game);
    
    res.json({ 
      matched: matchMade,
      game: {
        id: game.id,
        difficulty: game.difficulty,
        score: game.score,
        moves: game.moves,
        matches: game.matches,
        tiles: game.tiles,
        ended: game.ended,
        status: game.status
      }
    });
  } catch (error) {
    console.error('Make move error:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
});

/**
 * Get hint for the current game
 * GET /api/games/:gameId/hint
 */
router.get('/:gameId/hint', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Increment hints used
    game.hintsUsed = (game.hintsUsed || 0) + 1;
    
    // Get hint using server-stored state - use tilePositions consistently
    const hint = MahjongService.getHint(game.tiles, game.tilePositions);
    
    // Save updated game state
    GameModel.updateGame(gameId, game);
    
    res.json({ hint, hintsUsed: game.hintsUsed });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ error: 'Failed to get hint' });
  }
});

/**
 * Shuffle the board
 * POST /api/games/:gameId/shuffle
 */
router.post('/:gameId/shuffle', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Generate new board with same difficulty
    const { tiles: tilesObj, positions: newPositions } = MahjongService.generateBoard(game.difficulty);
    
    // Convert tiles object to formatted array
    const newTilesFormatted = formatTilesFromBoard(tilesObj);
    
    // Map formatted tiles to existing tiles - keep removed status, apply new types/positions
    game.tiles = game.tiles.map((existing, index) => {
      if (existing.removed) {
        return existing; // Keep removed tiles as-is
      }
      // Assign fresh tile data from the new board
      const fresh = newTilesFormatted[index % newTilesFormatted.length] || newTilesFormatted[0];
      return {
        ...fresh,
        index,
        removed: false,
        selected: false
      };
    });
    
    game.tilePositions = newPositions;
    game.selectedTileIndex = undefined;
    game.shufflesUsed = (game.shufflesUsed || 0) + 1;
    
    // Save updated game
    GameModel.updateGame(gameId, game);
    
    res.json({ 
      success: true, 
      game: {
        id: game.id,
        difficulty: game.difficulty,
        score: game.score,
        moves: game.moves,
        matches: game.matches,
        tiles: game.tiles,
        ended: game.ended,
        status: game.status,
        shufflesUsed: game.shufflesUsed
      },
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
router.post('/:gameId/end', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Calculate final score server-side (NOT from client)
    const remainingTiles = game.tiles.filter(t => !t.removed).length;
    const baseScore = game.score || 0;
    const completionBonus = remainingTiles === 0 ? 100 : 0;
    const hintsPenalty = (game.hintsUsed || 0) * 5;
    const shufflesPenalty = (game.shufflesUsed || 0) * 10;
    const finalScore = Math.max(0, baseScore + completionBonus - hintsPenalty - shufflesPenalty);
    
    game.ended = true;
    game.status = 'completed';
    game.score = finalScore;
    game.endedAt = new Date().toISOString();
    
    // Calculate duration
    const startTime = new Date(game.createdAt);
    const endTime = new Date(game.endedAt);
    const duration = Math.floor((endTime - startTime) / 1000);
    
    // Save updated game
    GameModel.updateGame(gameId, game);
    
    // Only record for non-guest users
    if (!req.user.isGuest) {
      GameModel.recordGame({
        userId: req.user.id,
        gameType: game.gameType || 'singlePlayer',
        difficulty: game.difficulty,
        score: finalScore,
        duration: duration,
        result: remainingTiles === 0 ? 'win' : 'abandoned'
      });
      
      // Add to leaderboard
      GameModel.addLeaderboardEntry({
        userId: req.user.id,
        score: finalScore,
        gameType: game.gameType || 'singlePlayer',
        difficulty: game.difficulty
      });
    }
    
    res.json({ 
      success: true, 
      game: {
        id: game.id,
        difficulty: game.difficulty,
        score: game.score,
        moves: game.moves,
        matches: game.matches,
        tiles: game.tiles,
        ended: game.ended,
        status: game.status,
        duration: duration
      },
      message: 'Game ended'
    });
  } catch (error) {
    console.error('End game error:', error);
    res.status(500).json({ error: 'Failed to end game' });
  }
});

export default router;
