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
import { authenticate } from '../middleware/auth.js';
import GameModel from '../models/game.js';
import { MahjongService } from '../services/mahjongService.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Single player game endpoint (matches frontend expectation)
router.post('/single-player', startSinglePlayer);

// Game state management
router.post('/save', saveGame);
router.get('/load/:stateId', loadGame);
router.get('/resume', resumeGame);
router.put('/update/:stateId', updateGame);
router.delete('/delete/:stateId', deleteGame);

// Game completion and stats
router.post('/complete', completeGame);
router.get('/history', getHistory);
router.get('/leaderboard', getLeaderboard);

// Game logic
router.post('/generate', generateGame);
router.post('/validate', validateMatch);
router.post('/hint', getHint);

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
    
    res.json({ game });
  } catch (error) {
    console.error('Get game error:', error);
    res.status(500).json({ error: 'Failed to get game' });
  }
});

/**
 * Make a move (select a tile or match)
 * POST /api/games/:gameId/move
 */
router.post('/:gameId/move', (req, res) => {
  try {
    const { gameId } = req.params;
    const { tileIndex } = req.body;
    
    // Get game from server-side state (NOT client)
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
    
    // Handle selection/deselection
    let matched = false;
    if (game.selectedTileIndex === undefined) {
      // First selection
      game.selectedTileIndex = tileIndex;
      game.tiles[tileIndex].selected = true;
    } else if (game.selectedTileIndex === tileIndex) {
      // Deselect same tile
      game.tiles[tileIndex].selected = false;
      game.selectedTileIndex = undefined;
    } else {
      // Second tile - check for match
      const firstTile = game.tiles[game.selectedTileIndex];
      const secondTile = game.tiles[tileIndex];
      
      // Validate match using MahjongService
      const isValidMatch = MahjongService.validateMatch(
        firstTile, 
        secondTile, 
        game.tiles,
        game.tilePositions
      );
      
      // Deselect first tile
      game.tiles[game.selectedTileIndex].selected = false;
      const firstSelectedIndex = game.selectedTileIndex;
      game.selectedTileIndex = undefined;
      
      if (isValidMatch) {
        // Remove matched tiles
        game.tiles[firstSelectedIndex].removed = true;
        game.tiles[tileIndex].removed = true;
        
        // Update score and matches
        game.matches++;
        const pointsPerMatch = { easy: 10, medium: 20, hard: 30 };
        game.score += pointsPerMatch[game.difficulty] || 20;
        matched = true;
        
        // Check if game is complete (all tiles removed)
        const remainingTiles = game.tiles.filter(t => !t.removed).length;
        if (remainingTiles === 0) {
          game.ended = true;
          game.status = 'completed';
        }
      }
      
      game.moves++;
    }
    
    // Save updated game state
    GameModel.updateGame(gameId, game);
    
    res.json({ 
      matched,
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
router.get('/:gameId/hint', (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get game from server-side state (NOT client)
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Increment hints used
    game.hintsUsed = (game.hintsUsed || 0) + 1;
    
    // Get hint using server-stored state
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
router.post('/:gameId/shuffle', (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get game from server-side state (NOT client)
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Increment shuffles used
    game.shufflesUsed = (game.shufflesUsed || 0) + 1;
    
    // Get remaining tiles (not removed)
    const remainingTiles = game.tiles.filter(t => !t.removed);
    
    // Generate new board with same difficulty
    const { tiles: newTiles, positions: newPositions } = MahjongService.generateBoard(game.difficulty);
    
    // Update game with shuffled board (only for remaining tiles)
    game.tiles = game.tiles.map((tile, index) => {
      if (tile.removed) {
        return tile; // Keep removed tiles as is
      }
      // Assign new position from generated board
      const newTile = newTiles.find((t, i) => !game.tiles.some(existing => !existing.removed && existing.id === t.id));
      return newTile ? { ...newTile, selected: false, removed: false } : tile;
    });
    
    game.tilePositions = newPositions;
    game.selectedTileIndex = undefined;
    
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
router.post('/:gameId/end', (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get game from server-side state (NOT client)
    const game = GameModel.getGameById(gameId, req.user.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Calculate final score server-side (NOT from client)
    const baseScore = game.score || 0;
    const timeBonus = 0; // Could calculate from game.createdAt
    const hintsPenalty = (game.hintsUsed || 0) * 5;
    const shufflesPenalty = (game.shufflesUsed || 0) * 10;
    const finalScore = Math.max(0, baseScore - hintsPenalty - shufflesPenalty);
    
    game.ended = true;
    game.status = 'completed';
    game.score = finalScore;
    game.endedAt = new Date().toISOString();
    
    // Calculate duration
    const startTime = new Date(game.createdAt);
    const endTime = new Date(game.endedAt);
    const duration = Math.floor((endTime - startTime) / 1000); // in seconds
    
    // Save updated game
    GameModel.updateGame(gameId, game);
    
    // Record the completed game to database
    GameModel.recordGame({
      userId: req.user.id,
      gameType: game.gameType || 'single',
      difficulty: game.difficulty,
      score: finalScore,
      duration: duration,
      result: 'completed'
    });
    
    // Add to leaderboard if score is good
    GameModel.addLeaderboardEntry({
      userId: req.user.id,
      score: finalScore,
      gameType: game.gameType || 'single',
      difficulty: game.difficulty
    });
    
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
