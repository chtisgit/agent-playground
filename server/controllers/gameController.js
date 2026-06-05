import GameModel from '../models/game.js';
import { MahjongService } from '../services/mahjongService.js';

/**
 * Start a single-player game
 * POST /api/games/single-player
 */
export function startSinglePlayer(req, res) {
  try {
    const { difficulty = 'medium' } = req.body;
    
    // Generate board using MahjongService
    const { tiles, positions } = MahjongService.generateBoard(difficulty);
    
    // Format tiles with game state properties
    const formattedTiles = tiles.map((tile, index) => ({
      ...tile,
      index,
      removed: false,
      selected: false
    }));
    
    // Create active game for real-time play (server-side state)
    const gameId = GameModel.createGame({
      userId: req.user.id,
      gameType: 'singlePlayer',
      difficulty,
      tiles: formattedTiles,
      tilePositions: positions
    });
    
    // Get the created game
    const game = GameModel.getGameById(gameId, req.user.id);
    
    res.status(201).json({
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
    });
  } catch (error) {
    console.error('Start single-player game error:', error);
    res.status(500).json({ error: 'Failed to start single-player game' });
  }
}

// === Existing flat routes (for backward compatibility) ===

/**
 * Save current game state
 * POST /api/game/save
 */
export function saveGame(req, res) {
  try {
    const { gameType, difficulty, tiles, tilePositions, score, moves, hintsUsed } = req.body;
    
    if (!gameType || !tiles || !tilePositions) {
      return res.status(400).json({ error: 'gameType, tiles, and tilePositions are required' });
    }
    
    const stateId = GameModel.saveGameState({
      userId: req.user.id,
      gameType,
      difficulty,
      tiles,
      tilePositions,
      score,
      moves,
      hintsUsed
    });
    
    res.status(201).json({
      message: 'Game saved successfully',
      stateId
    });
  } catch (error) {
    console.error('Save game error:', error);
    res.status(500).json({ error: 'Failed to save game' });
  }
}

/**
 * Load a saved game state
 * GET /api/game/load/:stateId
 */
export function loadGame(req, res) {
  try {
    const { stateId } = req.params;
    const gameState = GameModel.getGameState(parseInt(stateId), req.user.id);
    
    if (!gameState) {
      return res.status(404).json({ error: 'Game state not found' });
    }
    
    res.json({ gameState });
  } catch (error) {
    console.error('Load game error:', error);
    res.status(500).json({ error: 'Failed to load game' });
  }
}

/**
 * Get latest saved game
 * GET /api/game/resume
 */
export function resumeGame(req, res) {
  try {
    const gameState = GameModel.getLatestGameState(req.user.id);
    
    if (!gameState) {
      return res.status(404).json({ error: 'No saved game found' });
    }
    
    res.json({ gameState });
  } catch (error) {
    console.error('Resume game error:', error);
    res.status(500).json({ error: 'Failed to load game' });
  }
}

/**
 * Update game state
 * PUT /api/game/update/:stateId
 */
export function updateGame(req, res) {
  try {
    const { stateId } = req.params;
    const { tiles, tilePositions, score, moves, hintsUsed } = req.body;
    
    const success = GameModel.updateGameState(parseInt(stateId), {
      tiles,
      tilePositions,
      score,
      moves,
      hintsUsed
    });
    
    if (!success) {
      return res.status(404).json({ error: 'Game state not found' });
    }
    
    res.json({ message: 'Game updated successfully' });
  } catch (error) {
    console.error('Update game error:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
}

/**
 * Delete a saved game
 * DELETE /api/game/delete/:stateId
 */
export function deleteGame(req, res) {
  try {
    const { stateId } = req.params;
    const success = GameModel.deleteGameState(parseInt(stateId), req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Game state not found' });
    }
    
    res.json({ message: 'Game deleted successfully' });
  } catch (error) {
    console.error('Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
}

/**
 * Complete and record a game
 * POST /api/game/complete
 */
export function completeGame(req, res) {
  try {
    const { gameType, difficulty, score, duration, result } = req.body;
    
    if (!gameType || score === undefined || !result) {
      return res.status(400).json({ error: 'gameType, score, and result are required' });
    }
    
    const gameId = GameModel.recordGame({
      userId: req.user.id,
      gameType,
      difficulty,
      score,
      duration,
      result
    });
    
    // Add to leaderboard
    GameModel.addLeaderboardEntry({
      userId: req.user.id,
      score,
      gameType,
      difficulty
    });
    
    res.status(201).json({
      message: 'Game recorded successfully',
      gameId
    });
  } catch (error) {
    console.error('Complete game error:', error);
    res.status(500).json({ error: 'Failed to record game' });
  }
}

/**
 * Get game history
 * GET /api/game/history
 */
export function getHistory(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const games = GameModel.getGameHistory(req.user.id, limit);
    res.json({ games });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
}

/**
 * Get leaderboard
 * GET /api/game/leaderboard
 */
export function getLeaderboard(req, res) {
  try {
    const { gameType, difficulty, limit } = req.query;
    const entries = GameModel.getLeaderboard(gameType, difficulty, parseInt(limit) || 10);
    res.json({ entries });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}

/**
 * Generate new game tiles
 * POST /api/game/generate
 */
export function generateGame(req, res) {
  try {
    const { difficulty } = req.body;
    const { tiles, positions } = MahjongService.generateBoard(difficulty);
    
    res.json({ tiles, positions });
  } catch (error) {
    console.error('Generate game error:', error);
    res.status(500).json({ error: 'Failed to generate game' });
  }
}

/**
 * Validate tile match
 * POST /api/game/validate
 */
export function validateMatch(req, res) {
  try {
    const { tiles, positions, tile1Id, tile2Id } = req.body;
    
    if (!tiles || !positions || !tile1Id || !tile2Id) {
      return res.status(400).json({ error: 'tiles, positions, tile1Id, and tile2Id are required' });
    }
    
    const isValid = MahjongService.validateMatch(tiles, positions, tile1Id, tile2Id);
    
    res.json({ 
      isValid,
      hint: MahjongService.getHint(tiles, positions)
    });
  } catch (error) {
    console.error('Validate match error:', error);
    res.status(500).json({ error: 'Failed to validate match' });
  }
}

/**
 * Get a hint for available moves
 * POST /api/game/hint
 */
export function getHint(req, res) {
  try {
    const { tiles, positions } = req.body;
    
    if (!tiles || !positions) {
      return res.status(400).json({ error: 'tiles and positions are required' });
    }
    
    const hint = MahjongService.getHint(tiles, positions);
    
    res.json({ hint });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ error: 'Failed to get hint' });
  }
}
