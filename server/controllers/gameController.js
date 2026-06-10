import GameModel from '../models/game.js';
import { MahjongService } from '../services/mahjongService.js';

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
 * Start a new single-player game
 * POST /api/games/single-player
 */
export function startSinglePlayer(req, res) {
  try {
    const { difficulty = 'medium' } = req.body;
    
    // Generate board using MahjongService (returns tiles as object: { tileId: tileType })
    const { tiles: tilesObj, positions } = MahjongService.generateBoard(difficulty);
    
    // Convert tiles object to formatted array with suit/value for server-side match logic
    const formattedTiles = Object.entries(tilesObj).map(([tileId, tileType], index) => {
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
    
    // Create a new active game record (server-side state)
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
        id: game.id,
        gameType: game.gameType,
        difficulty: game.difficulty,
        tiles: game.tiles,
        positions: game.tilePositions,
        score: game.score,
        moves: game.moves,
        matches: game.matches,
        ended: game.ended,
        status: game.status,
        hintsUsed: game.hintsUsed,
        shufflesUsed: game.shufflesUsed
      },
      status: 'active'
    });
  } catch (error) {
    console.error('Start single-player game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
}

/**
 * Save current game state to database
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
 * Load a saved game state from database
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
 * Get latest saved game from database
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
 * Update game state in database
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
 * Delete a saved game from database
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
 * Complete a game and save to database
 * POST /api/game/complete
 * NOTE: Score should be calculated server-side using active game state when possible
 */
export function completeGame(req, res) {
  try {
    const { gameType, difficulty, tiles, score, duration } = req.body;
    
    if (!gameType || !difficulty) {
      return res.status(400).json({ error: 'gameType and difficulty are required' });
    }
    
    const gameId = GameModel.recordGame({
      userId: req.user.id,
      gameType,
      difficulty,
      score: score || 0,
      duration: duration || 0,
      result: 'completed'
    });
    
    // Update leaderboard
    GameModel.addLeaderboardEntry({
      userId: req.user.id,
      score: score || 0,
      gameType,
      difficulty
    });
    
    res.json({
      message: 'Game completed successfully',
      gameId
    });
  } catch (error) {
    console.error('Complete game error:', error);
    res.status(500).json({ error: 'Failed to complete game' });
  }
}

/**
 * Get game history from database
 * GET /api/game/history
 */
export function getHistory(req, res) {
  try {
    const history = GameModel.getGameHistory(req.user.id);
    res.json({ history });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
}

/**
 * Get leaderboard from database
 * GET /api/game/leaderboard
 */
export function getLeaderboard(req, res) {
  try {
    const { gameType, difficulty } = req.query;
    const leaderboard = GameModel.getLeaderboard(gameType, difficulty);
    res.json({ leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}

/**
 * Generate a new game board
 * POST /api/game/generate
 */
export function generateGame(req, res) {
  try {
    const { difficulty = 'medium' } = req.body;
    
    const { tiles, positions } = MahjongService.generateBoard(difficulty);
    
    res.json({
      tiles,
      positions,
      difficulty
    });
  } catch (error) {
    console.error('Generate game error:', error);
    res.status(500).json({ error: 'Failed to generate game' });
  }
}

/**
 * Validate a tile match using server-side logic
 * POST /api/game/validate
 */
export function validateMatch(req, res) {
  try {
    const { tile1, tile2, tiles, tilePositions } = req.body;
    
    if (!tile1 || !tile2 || !tiles || !tilePositions) {
      return res.status(400).json({ error: 'tile1, tile2, tiles, and tilePositions are required' });
    }
    
    // Use suit/value match for inline validation (compatible with game state format)
    const isValid = MahjongService.tilesMatch(tile1.type, tile2.type);
    
    res.json({ valid: isValid });
  } catch (error) {
    console.error('Validate match error:', error);
    res.status(500).json({ error: 'Failed to validate match' });
  }
}

/**
 * Get a hint using server-side logic
 * POST /api/game/hint
 */
export function getHint(req, res) {
  try {
    const { tiles, tilePositions } = req.body;
    
    if (!tiles || !tilePositions) {
      return res.status(400).json({ error: 'tiles and tilePositions are required' });
    }
    
    const hint = MahjongService.getHint(tiles, tilePositions);
    
    res.json({ hint });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ error: 'Failed to get hint' });
  }
}

export default {
  startSinglePlayer,
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
  getHint
};
