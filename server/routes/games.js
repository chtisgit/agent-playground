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
import { authenticate } from '../middleware/auth.js';
import GameModel from '../models/game.js';
import { MahjongService } from '../services/mahjongService.js';

const router = Router();

// Guest user middleware - allows single-player without login
// Assigns a guest user ID for unauthenticated requests
const guestUser = (req, res, next) => {
  if (!req.user) {
    // Generate a guest user ID based on session or IP
    const guestId = 1000000 + Math.floor(Math.random() * 900000);
    req.user = { id: guestId, username: 'guest', isGuest: true };
  }
  next();
};

// Single player game endpoint - PUBLIC (no auth required)
// Allows users to start a game immediately without login
router.post('/single-player', guestUser, startSinglePlayer);

// Game state management (flat routes - require auth)
router.post('/save', authenticate, saveGame);
router.get('/load/:stateId', authenticate, loadGame);
router.get('/resume', authenticate, resumeGame);
router.delete('/delete/:stateId', authenticate, deleteGame);

// Game completion and stats (require auth)
router.post('/complete', authenticate, completeGame);
router.get('/history', authenticate, getHistory);
router.get('/leaderboard', authenticate, getLeaderboard);

// Game logic - PUBLIC (no auth required for game generation/validation)
router.post('/generate', generateGame);
router.post('/validate', validateMatch);

// === Game-specific endpoints with gameId parameter - PUBLIC ===
// These endpoints use guestUser middleware to allow testing without login

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
router.post('/:gameId/move', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    const { tileIndex } = req.body;
    
    // Get game from server-side state
    const game = GameModel.getGameById(gameId, req.user.id);
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
    let matchMade = false;
    if (selectedTiles.length === 2) {
      const [tile1, tile2] = selectedTiles;
      if (tile1.suit === tile2.suit && tile1.value === tile2.value) {
        tile1.removed = true;
        tile2.removed = true;
        tile1.selected = false;
        tile2.selected = false;
        game.matches = (game.matches || 0) + 1;
        matchMade = true;
        
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
      matchMade,
      message: matchMade ? 'Match made!' : 'Move recorded'
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
router.get('/:gameId/hint', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const hint = MahjongService.getHint(game.tiles, game.tilePositions || []);
    
    res.json({ hint });
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
    
    const { tiles, positions } = MahjongService.generateBoard(game.difficulty);
    game.tiles = tiles;
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
router.post('/:gameId/end', guestUser, (req, res) => {
  try {
    const { gameId } = req.params;
    
    const game = GameModel.getGameById(gameId, req.user.id);
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
    
    // Only record for non-guest users
    if (!req.user.isGuest) {
      GameModel.recordGame({
        userId: req.user.id,
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
