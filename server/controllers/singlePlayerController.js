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
 * Helper: Build the consistent game state response object
 */
function buildGameResponse(game) {
  const totalTiles = Object.keys(game.tileData).length;
  const totalMatches = Math.floor(totalTiles / 2);

  return {
    id: game.id,
    difficulty: game.difficulty,
    score: game.score,
    matches: game.matches,
    totalMatches,
    tiles: Object.values(game.tiles),
    ended: game.ended,
    hintsRemaining: game.hintsRemaining,
    shufflesRemaining: game.shufflesRemaining
  };
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
      userId: req.user ? req.user.id : null,  // Allow guest users
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
    
    res.status(201).json({
      game: buildGameResponse(game)
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
    
    // Verify ownership (skip for guest games with null userId)
    if (game.userId !== null && game.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to access this game' });
    }
    
    res.json({
      game: buildGameResponse(game)
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
    
    if (game.userId !== null && game.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    // Get the clicked tile
    const clickedTile = game.tiles[tileIndex];
    if (!clickedTile || clickedTile.removed) {
      return res.status(400).json({ error: 'Invalid tile or tile already removed' });
    }

    // Validate that the tile is not blocked
    if (MahjongService.isTileBlocked(clickedTile.id, game.positions)) {
      return res.status(400).json({ error: 'Tile is blocked and cannot be selected' });
    }
    
    // Handle first selection
    if (game.selectedTile === undefined) {
      game.selectedTile = tileIndex;
      game.tiles[tileIndex].selected = true;
      
      return res.json({
        matched: false,
        game: buildGameResponse(game)
      });
    }
    
    // Same tile clicked - deselect
    if (game.selectedTile === tileIndex) {
      game.tiles[game.selectedTile].selected = false;
      game.selectedTile = undefined;
      
      return res.json({
        matched: false,
        game: buildGameResponse(game)
      });
    }
    
    // CRITICAL FIX: Save selectedTile index BEFORE clearing it
    // Previously, game.selectedTile was set to undefined before being used
    // to mark the first tile as removed, causing only the second tile to be removed.
    const savedSelectedIndex = game.selectedTile;
    const firstTile = game.tiles[savedSelectedIndex];
    const secondTile = game.tiles[tileIndex];

    // Validate the second tile is not blocked either
    if (MahjongService.isTileBlocked(secondTile.id, game.positions)) {
      // Deselect the first tile and return error
      game.tiles[savedSelectedIndex].selected = false;
      game.selectedTile = undefined;
      return res.status(400).json({ error: 'Second tile is blocked and cannot be selected' });
    }
    
    // Use MahjongService.validateMatch for proper match validation
    // This handles flower/season matching rules and tile existence checks
    const isMatch = MahjongService.validateMatch(
      game.tileData,
      game.positions,
      firstTile.id,
      secondTile.id
    );
    
    // Mark both tiles as not selected (always, regardless of match)
    game.tiles[savedSelectedIndex].selected = false;
    game.selectedTile = undefined;
    
    let matched = false;
    
    if (isMatch) {
      // Use savedSelectedIndex (not game.selectedTile which is now undefined)
      game.tiles[savedSelectedIndex].removed = true;
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
      
      // Check if game is complete (no tiles remaining)
      if (Object.keys(game.tileData).length === 0) {
        game.ended = true;
      }
    }
    
    game.moves++;
    
    res.json({
      matched,
      game: buildGameResponse(game)
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
    
    if (game.userId !== null && game.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    if (game.ended) {
      return res.status(400).json({ error: 'Game has already ended' });
    }
    
    if (game.hintsRemaining <= 0) {
      return res.status(400).json({ error: 'No hints remaining' });
    }
    
    // Use MahjongService.getHint for proper hint logic
    // This correctly handles flower/season matching and tile blocking
    const hint = MahjongService.getHint(game.tileData, game.positions);
    
    // Deduct hint
    game.hintsRemaining--;
    
    if (!hint) {
      return res.json({ tileIndex: null, message: 'No valid moves available' });
    }
    
    // Find the index of the hinted tile in the game.tiles structure
    const tileIndex = Object.keys(game.tiles).find(
      key => game.tiles[key].id === hint.tile1Id
    );
    
    res.json({ tileIndex: tileIndex !== undefined ? parseInt(tileIndex) : null });
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
    
    if (game.userId !== null && game.userId !== req.user?.id) {
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
    
    // Shuffle the tile types using Fisher-Yates
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
    
    res.json({
      game: buildGameResponse(game)
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
    const game = activeGames.get(gameId);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (game.userId !== null && game.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // SECURITY FIX: Always use server-side game.score, never trust client-submitted score
    // This prevents score injection attacks where a client could submit a bogus score
    const finalScore = game.score;
    
    // Only record in persistent storage if authenticated user
    if (req.user) {
      // Record the completed game
      GameModel.recordGame({
        userId: req.user.id,
        gameType: 'single-player',
        difficulty: game.difficulty,
        score: finalScore,
        duration: Math.floor((Date.now() - new Date(game.createdAt).getTime()) / 1000),
        result: game.ended || game.matches >= 72 ? 'completed' : 'forfeited'
      });
      
      // Add to leaderboard
      GameModel.addLeaderboardEntry({
        userId: req.user.id,
        score: finalScore,
        gameType: 'single-player',
        difficulty: game.difficulty
      });
    }
    
    // Remove from active games
    activeGames.delete(gameId);
    
    res.json({ message: 'Game ended successfully', score: finalScore });
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
