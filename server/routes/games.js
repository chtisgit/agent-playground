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

// All routes require authentication
router.use(authenticate);

// Single player game endpoint (matches frontend expectation)
router.post('/single-player', startSinglePlayer);

// Game state management (existing flat routes)
router.post('/save', saveGame);
router.get('/load/:stateId', loadGame);
router.get('/resume', resumeGame);
router.delete('/delete/:stateId', deleteGame);

// Game completion and stats (existing flat routes)
router.post('/complete', completeGame);
router.get('/history', getHistory);
router.get('/leaderboard', getLeaderboard);

// Game logic (existing flat routes)
router.post('/generate', generateGame);
router.post('/validate', validateMatch);

// === NEW: Game-specific endpoints with gameId parameter ===
// These match the frontend's expected REST API pattern

/**
 * Get game state by ID
 * GET /api/games/:gameId
 */
router.get('/:gameId', (req, res) => {
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
router.post('/:gameId/move', (req, res) => {
  try {
    const { gameId } = req.params;
    const { tileIndex, selectedTileIndex } = req.body;
    
    // Get game from server-side state (NOT from client)
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
 * Uses server-side game state, not client input
 */
router.get('/:gameId/hint', (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get game from server-side state (NOT from client)
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Use server-stored tiles and positions
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
router.post('/:gameId/shuffle', (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get game from server-side state
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Generate new board server-side
    const { tiles, positions } = MahjongService.generateBoard(game.difficulty);
    game.tiles = tiles;
    game.tilePositions = positions;
    game.shuffles = (game.shuffles || 0) + 1;
    
    // Update server-side game state
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
 * Server-side score calculation
 */
router.post('/:gameId/end', (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get game from server-side state
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Mark game as ended
    game.ended = true;
    game.status = 'completed';
    game.endedAt = new Date();
    
    // Calculate final score server-side (NOT using client-submitted score)
    // Base score from matches
    const baseScore = (game.matches || 0) * 10;
    // Bonus for remaining tiles
    const remainingTiles = game.tiles.filter(t => !t.removed).length;
    const completionBonus = remainingTiles === 0 ? 100 : 0;
    // Penalty for shuffles used
    const shufflePenalty = (game.shuffles || 0) * 5;
    // Time bonus could be calculated here if we track start time
    
    game.score = Math.max(0, baseScore + completionBonus - shufflePenalty);
    
    // Record completed game
    GameModel.recordGame({
      userId: req.user.id,
      gameType: game.gameType || 'singlePlayer',
      difficulty: game.difficulty,
      score: game.score,
      duration: game.duration || 0,
      result: remainingTiles === 0 ? 'win' : 'abandoned'
    });
    
    // Update server-side game state
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
