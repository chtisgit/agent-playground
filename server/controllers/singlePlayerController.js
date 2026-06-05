import { MahjongService } from '../services/mahjongService.js';
import GameModel from '../models/game.js';

// In-memory store for active single-player games
const activeGames = new Map();

/**
 * Generate a unique game ID
 */
function generateGameId() {
  return `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create initial game tiles structure
 */
function createTiles(tilesData, positionsData) {
  const tiles = {};
  Object.entries(tilesData).forEach(([tileId, type], index) => {
    tiles[index] = {
      id: tileId,
      type,
      position: positionsData[tileId],
      removed: false,
      selected: false
    };
  });
  return tiles;
}

/**
 * Start a new single-player game
 * POST /api/games/single-player
 */
export function startSinglePlayerGame(req, res) {
  try {
    const { difficulty = 'medium' } = req.body;
    
    // Generate game board using MahjongService
    const { tiles: tilesData, positions: positionsData } = MahjongService.generateBoard(difficulty);
    
    // Create game ID and structure
    const gameId = generateGameId();
    const tiles = createTiles(tilesData, positionsData);
    
    const game = {
      id: gameId,
      userId: req.user.id,
      difficulty,
      tiles,
      tileData: tilesData,
      positions: positionsData,
      score: 0,
      matches: 0,
      moves: 0,
      ended: false,
      createdAt: new Date().toISOString(),
      hintsRemaining: 3,
      shufflesRemaining: 3
    };
    
    // Store in active games
    activeGames.set(gameId, game);
    
    // Calculate total matches needed (144 tiles / 2 = 72 matches)
    const totalTiles = Object.keys(tilesData).length;
    const totalMatches = Math.floor(totalTiles / 2);
    
    res.status(201).json({
      game: {
        id: gameId,
        difficulty,
        score: 0,
        matches: 0,
        totalMatches,
        tiles: Object.values(tiles),
        ended: false,
        hintsRemaining: game.hintsRemaining,
        shufflesRemaining: game.shufflesRemaining
      }
    });
  } catch (error) {
    console.error('Start single-player game error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
}

/**
 * Get game state
 * GET /api/games/:gameId
 */
export function getGameState(req, res) {
  try {
    const { gameId } = req.params;
    const game = activeGames.get(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Verify ownership
    if (game.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to access this game' });
    }
    
    const totalTiles = Object.keys(game.tileData).length;
    const totalMatches = Math.floor(totalTiles / 2);
    
    res.json({
      game: {
        id: game.id,
        difficulty: game.difficulty,
        score: game.score,
        matches: game.matches,
        totalMatches,
        tiles: Object.values(game.tiles),
        ended: game.ended,
        hintsRemaining: game.hintsRemaining,
        shufflesRemaining: game.shufflesRemaining
      }
    });
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
}

/**
 * Make a move (select/match tiles)
 * POST /api/games/:gameId/move
 */
export function makeMove(req, res) {
  try {
    const { gameId } = req.params;
    const { tileIndex } = req.body;
    const game = activeGames.get(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Get the clicked tile
    const clickedTile = game.tiles[tileIndex];
    if (!clickedTile || clickedTile.removed) {
      return res.status(400).json({ error: 'Invalid tile' });
    }
    
    // Handle first selection
    if (game.selectedTile === undefined) {
      game.selectedTile = tileIndex;
      game.tiles[tileIndex].selected = true;
      
      const totalTiles = Object.keys(game.tileData).length;
      const totalMatches = Math.floor(totalTiles / 2);
      
      return res.json({
        matched: false,
        game: {
          id: game.id,
          difficulty: game.difficulty,
          score: game.score,
          matches: game.matches,
          totalMatches,
          tiles: Object.values(game.tiles),
          ended: game.ended,
          hintsRemaining: game.hintsRemaining,
          shufflesRemaining: game.shufflesRemaining
        }
      });
    }
    
    // Same tile clicked - deselect
    if (game.selectedTile === tileIndex) {
      game.tiles[game.selectedTile].selected = false;
      game.selectedTile = undefined;
      
      const totalTiles = Object.keys(game.tileData).length;
      const totalMatches = Math.floor(totalTiles / 2);
      
      return res.json({
        matched: false,
        game: {
          id: game.id,
          difficulty: game.difficulty,
          score: game.score,
          matches: game.matches,
          totalMatches,
          tiles: Object.values(game.tiles),
          ended: game.ended,
          hintsRemaining: game.hintsRemaining,
          shufflesRemaining: game.shufflesRemaining
        }
      });
    }
    
    // Check for match (simplified - matching by type)
    const firstTile = game.tiles[game.selectedTile];
    const secondTile = game.tiles[tileIndex];
    
    // Basic match logic - same type, both unblocked
    const isMatch = firstTile.type === secondTile.type && 
                   !firstTile.removed && !secondTile.removed;
    
    // Mark both tiles as not selected
    game.tiles[game.selectedTile].selected = false;
    game.selectedTile = undefined;
    
    let matched = false;
    
    if (isMatch) {
      // Remove matched tiles
      game.tiles[game.selectedTile].removed = true;
      game.tiles[tileIndex].removed = true;
      
      // Update tile data (for compatibility with MahjongService)
      delete game.tileData[firstTile.id];
      delete game.tileData[secondTile.id];
      delete game.positions[firstTile.id];
      delete game.positions[secondTile.id];
      
      // Update score and matches
      game.matches++;
      const pointsPerMatch = { easy: 10, medium: 20, hard: 30 };
      game.score += pointsPerMatch[game.difficulty] || 20;
      matched = true;
      
      // Check if game is complete
      if (game.matches >= 72) {
        game.ended = true;
      }
    }
    
    game.moves++;
    
    const totalTiles = Object.keys(game.tileData).length;
    const totalMatches = Math.floor(totalTiles / 2);
    
    res.json({
      matched,
      game: {
        id: game.id,
        difficulty: game.difficulty,
        score: game.score,
        matches: game.matches,
        totalMatches,
        tiles: Object.values(game.tiles),
        ended: game.ended,
        hintsRemaining: game.hintsRemaining,
        shufflesRemaining: game.shufflesRemaining
      }
    });
  } catch (error) {
    console.error('Make move error:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
}

/**
 * Get a hint
 * GET /api/games/:gameId/hint
 */
export function getHint(req, res) {
  try {
    const { gameId } = req.params;
    const game = activeGames.get(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    if (game.hintsRemaining <= 0) {
      return res.status(400).json({ error: 'No hints remaining' });
    }
    
    // Find first available match
    const availableTiles = Object.values(game.tiles).filter(t => !t.removed);
    let tileIndex = -1;
    
    for (let i = 0; i < availableTiles.length; i++) {
      const tile1 = availableTiles[i];
      for (let j = i + 1; j < availableTiles.length; j++) {
        const tile2 = availableTiles[j];
        if (tile1.type === tile2.type) {
          tileIndex = tile1.position.id ? 
            Object.keys(game.tiles).find(key => game.tiles[key].id === tile1.id) : 
            parseInt(Object.keys(game.tiles).find(key => game.tiles[key].id === tile1.id));
          break;
        }
      }
      if (tileIndex !== -1) break;
    }
    
    // Deduct hint
    game.hintsRemaining--;
    
    res.json({ tileIndex: tileIndex !== -1 ? parseInt(tileIndex) : null });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ error: 'Failed to get hint' });
  }
}

/**
 * Shuffle the board
 * POST /api/games/:gameId/shuffle
 */
export function shuffleBoard(req, res) {
  try {
    const { gameId } = req.params;
    const game = activeGames.get(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    if (game.shufflesRemaining <= 0) {
      return res.status(400).json({ error: 'No shuffles remaining' });
    }
    
    // Get remaining tile types
    const remainingTiles = Object.entries(game.tileData)
      .filter(([_, tileId]) => tileId);
    
    // Shuffle the tile types
    const types = remainingTiles.map(([_, type]) => type);
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    
    // Reassign types to tiles
    remainingTiles.forEach(([tileId, _], index) => {
      game.tileData[tileId] = types[index];
    });
    
    // Update the tiles structure
    Object.entries(game.tiles).forEach(([index, tile]) => {
      if (!tile.removed && game.tileData[tile.id]) {
        tile.type = game.tileData[tile.id];
      }
    });
    
    // Deduct shuffle
    game.shufflesRemaining--;
    
    const totalTiles = Object.keys(game.tileData).length;
    const totalMatches = Math.floor(totalTiles / 2);
    
    res.json({
      game: {
        id: game.id,
        difficulty: game.difficulty,
        score: game.score,
        matches: game.matches,
        totalMatches,
        tiles: Object.values(game.tiles),
        ended: game.ended,
        hintsRemaining: game.hintsRemaining,
        shufflesRemaining: game.shufflesRemaining
      }
    });
  } catch (error) {
    console.error('Shuffle board error:', error);
    res.status(500).json({ error: 'Failed to shuffle board' });
  }
}

/**
 * End a game
 * POST /api/games/:gameId/end
 */
export function endGame(req, res) {
  try {
    const { gameId } = req.params;
    const { score } = req.body;
    const game = activeGames.get(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Record the completed game
    GameModel.recordGame({
      userId: req.user.id,
      gameType: 'single-player',
      difficulty: game.difficulty,
      score: score || game.score,
      duration: Math.floor((Date.now() - new Date(game.createdAt).getTime()) / 1000),
      result: game.ended || game.matches >= 72 ? 'completed' : 'forfeited'
    });
    
    // Add to leaderboard
    GameModel.addLeaderboardEntry({
      userId: req.user.id,
      score: score || game.score,
      gameType: 'single-player',
      difficulty: game.difficulty
    });
    
    // Remove from active games
    activeGames.delete(gameId);
    
    res.json({ message: 'Game ended successfully' });
  } catch (error) {
    console.error('End game error:', error);
    res.status(500).json({ error: 'Failed to end game' });
  }
}

export const SinglePlayerController = {
  startSinglePlayerGame,
  getGameState,
  makeMove,
  getHint,
  shuffleBoard,
  endGame
};

export default SinglePlayerController;
