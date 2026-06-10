import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { MahjongService } from '../services/mahjongService.js';
import GameModel from '../models/game.js';
import db from '../models/database.js';
import crypto from 'crypto';

const router = Router();

// In-memory store for guest (unauthenticated) single-player games
// Keyed by crypto.randomUUID() token — per Stefan's security decision
const guestGames = new Map();

// Helper: Generate unique game ID
function generateGameId() {
  return `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Create tiles structure from MahjongService output
function createTiles(tilesData, positionsData) {
  const tiles = {};
  const tileArray = [];
  
  for (const [tileId, tileType] of Object.entries(tilesData)) {
    const pos = positionsData[tileId];
    if (pos) {
      tileArray.push({
        id: tileId,
        type: tileType,
        position: pos,
        removed: false,
        selected: false
      });
      tiles[tileId] = {
        id: tileId,
        type: tileType,
        position: pos,
        removed: false,
        selected: false
      };
    }
  }
  return { tiles, tileArray };
}

// Helper: Calculate score server-side
function calculateScore(matches, moves, difficulty, startTime) {
  const baseScores = { easy: 100, medium: 200, hard: 300 };
  const base = baseScores[difficulty] || 200;
  const matchBonus = matches * base;
  const timeBonus = Math.max(0, 300 - Math.floor((Date.now() - startTime) / 1000));
  const efficiencyBonus = Math.max(0, matches * 10 - moves);
  return matchBonus + timeBonus + efficiencyBonus;
}

/**
 * Look up a game by its source.
 * - Authenticated users: DB-backed, keyed by user ID
 * - Guest users: in-memory Map, keyed by X-Game-Token header
 * 
 * Returns { game, source: 'guest'|'user', record } or null
 */
function findGame(req) {
  // Authenticated user: look up in DB
  if (req.user) {
    const stmt = db.prepare(`
      SELECT * FROM game_states 
      WHERE game_type = 'active-game' AND user_id = ?
      ORDER BY updated_at DESC LIMIT 1
    `);
    const gameRecord = stmt.get(req.user.id);
    if (!gameRecord) return null;
    
    const game = JSON.parse(gameRecord.tiles);
    return { game, source: 'user', record: gameRecord };
  }
  
  // Guest: look up by X-Game-Token in in-memory Map
  const gameToken = req.headers['x-game-token'];
  if (!gameToken) return null;
  
  const game = guestGames.get(gameToken);
  if (!game) return null;
  
  return { game, source: 'guest', token: gameToken };
}

/**
 * Persist game state after modification
 */
function persistGame(source, game, record, token) {
  if (source === 'user') {
    const updateStmt = db.prepare(`
      UPDATE game_states SET tiles = ?, score = ?, moves = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    updateStmt.run(JSON.stringify(game), game.score, game.moves, record.id);
  }
  // Guest games are already in the in-memory Map (mutated in place)
}

// POST /api/games/single-player - Start new game
router.post('/single-player', optionalAuth, (req, res) => {
  try {
    const { difficulty = 'medium' } = req.body;
    const gameId = generateGameId();
    
    // Use MahjongService to generate board
    const { tiles: tilesData, positions: positionsData } = MahjongService.generateBoard(difficulty);
    const { tiles, tileArray } = createTiles(tilesData, positionsData);
    
    const activeGame = {
      gameId,
      difficulty,
      matches: 0,
      moves: 0,
      score: 0,
      tiles,
      tilePositions: positionsData,
      startTime: new Date().toISOString(),
      hintsRemaining: 3,
      shufflesRemaining: 3,
      selectedTile: null,
      ended: false
    };
    
    let gameToken = null;
    
    if (req.user) {
      // AUTHENTICATED USER: DB-backed storage
      activeGame.userId = req.user.id;
      
      const activeStmt = db.prepare(`
        INSERT INTO game_states (user_id, game_type, difficulty, tiles, tile_positions, score, moves, hints_used)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      activeStmt.run(
        req.user.id,
        'active-game',
        difficulty,
        JSON.stringify(activeGame),
        JSON.stringify(positionsData),
        0,
        0,
        0
      );
    } else {
      // GUEST: crypto.randomUUID() token + in-memory Map
      // Per Stefan's security decision: no guest accounts, no DB storage, no spoofable IDs
      gameToken = crypto.randomUUID();
      activeGame.userId = null;
      activeGame.gameToken = gameToken;
      guestGames.set(gameToken, activeGame);
    }
    
    const responseBody = {
      game: {
        id: gameId,
        difficulty,
        score: 0,
        matches: 0,
        totalMatches: 72,
        tiles: tileArray,
        ended: false,
        hintsRemaining: 3,
        shufflesRemaining: 3
      }
    };
    
    // Return gameToken to guest clients so they can access their game
    if (gameToken) {
      responseBody.gameToken = gameToken;
    }
    
    res.status(201).json(responseBody);
  } catch (error) {
    console.error('Start single-player error:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

// GET /api/games/:gameId - Get game state
router.get('/:gameId', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const lookup = findGame(req);
    
    if (!lookup) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const { game, source } = lookup;
    
    // Verify gameId matches
    if (game.gameId !== gameId) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Recalculate score server-side - never trust client
    const serverScore = calculateScore(
      game.matches,
      game.moves,
      game.difficulty,
      new Date(game.startTime).getTime()
    );
    
    res.json({
      game: {
        id: gameId,
        difficulty: game.difficulty,
        score: serverScore,
        matches: game.matches,
        totalMatches: 72,
        tiles: Object.values(game.tiles).filter(t => !t.removed),
        ended: game.ended,
        hintsRemaining: game.hintsRemaining,
        shufflesRemaining: game.shufflesRemaining
      }
    });
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// POST /api/games/:gameId/move - Make a move
router.post('/:gameId/move', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const { tileIndex } = req.body;
    const lookup = findGame(req);
    
    if (!lookup) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const { game, source, record, token } = lookup;
    
    if (game.gameId !== gameId || game.ended) {
      return res.status(400).json({ error: game.ended ? 'Game has ended' : 'Game not found' });
    }
    
    // Get tile from server state (NOT from client) - prevent manipulation
    const tileIds = Object.keys(game.tiles);
    if (tileIndex < 0 || tileIndex >= tileIds.length) {
      return res.status(400).json({ error: 'Invalid tile index' });
    }
    
    const clickedTileId = tileIds[tileIndex];
    const clickedTile = game.tiles[clickedTileId];
    
    if (!clickedTile || clickedTile.removed) {
      return res.status(400).json({ error: 'Invalid tile' });
    }
    
    // First selection
    if (game.selectedTile === null) {
      game.selectedTile = clickedTileId;
      game.tiles[clickedTileId].selected = true;
      
      persistGame(source, game, record, token);
      
      return res.json({
        matched: false,
        game: {
          id: gameId,
          difficulty: game.difficulty,
          score: game.score,
          matches: game.matches,
          totalMatches: 72,
          tiles: Object.values(game.tiles),
          ended: game.ended
        }
      });
    }
    
    // Same tile - deselect
    if (game.selectedTile === clickedTileId) {
      game.tiles[game.selectedTile].selected = false;
      game.selectedTile = null;
      
      persistGame(source, game, record, token);
      
      return res.json({
        matched: false,
        game: {
          id: gameId,
          difficulty: game.difficulty,
          score: game.score,
          matches: game.matches,
          totalMatches: 72,
          tiles: Object.values(game.tiles),
          ended: game.ended
        }
      });
    }
    
    // Validate match using MahjongService - server-side validation
    const firstTileId = game.selectedTile;
    
    // Extract just the tile types for matching logic
    const tileTypes = {};
    for (const [id, tile] of Object.entries(game.tiles)) {
      if (!tile.removed) {
        tileTypes[id] = tile.type;
      }
    }
    
    const isValid = MahjongService.validateMatch(
      tileTypes,
      game.tilePositions,
      firstTileId,
      clickedTileId
    );
    
    let matched = false;
    
    if (isValid) {
      // Remove matched tiles - state change on server
      game.tiles[firstTileId].removed = true;
      game.tiles[clickedTileId].removed = true;
      game.matches++;
      
      // Calculate score server-side - never trust client score
      game.score = calculateScore(
        game.matches,
        game.moves,
        game.difficulty,
        new Date(game.startTime).getTime()
      );
      
      matched = true;
      
      // Check if game is complete
      if (game.matches >= 72) {
        game.ended = true;
      }
    }
    
    game.tiles[firstTileId].selected = false;
    game.selectedTile = null;
    game.moves++;
    
    // Persist updated state
    persistGame(source, game, record, token);
    
    res.json({
      matched,
      game: {
        id: gameId,
        difficulty: game.difficulty,
        score: game.score,
        matches: game.matches,
        totalMatches: 72,
        tiles: Object.values(game.tiles),
        ended: game.ended
      }
    });
  } catch (error) {
    console.error('Make move error:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
});

// GET /api/games/:gameId/hint - Get hint
router.get('/:gameId/hint', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const lookup = findGame(req);
    
    if (!lookup) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const { game, source, record, token } = lookup;
    
    if (game.gameId !== gameId) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.hintsRemaining <= 0) {
      return res.status(400).json({ error: 'No hints remaining' });
    }
    
    // Use MahjongService for proper hint - server-side only
    const tileTypes = {};
    for (const [id, tile] of Object.entries(game.tiles)) {
      if (!tile.removed) {
        tileTypes[id] = tile.type;
      }
    }
    
    const hint = MahjongService.getHint(tileTypes, game.tilePositions);
    
    if (!hint) {
      return res.json({ tileIndex: null, message: 'No valid moves available' });
    }
    
    // Convert tileId to index for frontend
    const tileIds = Object.keys(game.tiles);
    const tileIndex = tileIds.indexOf(hint.tile1Id);
    
    game.hintsRemaining--;
    
    persistGame(source, game, record, token);
    
    res.json({ tileIndex });
  } catch (error) {
    console.error('Get hint error:', error);
    res.status(500).json({ error: 'Failed to get hint' });
  }
});

// POST /api/games/:gameId/shuffle - Shuffle board
router.post('/:gameId/shuffle', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const lookup = findGame(req);
    
    if (!lookup) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const { game, source, record, token } = lookup;
    
    if (game.gameId !== gameId) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (game.shufflesRemaining <= 0) {
      return res.status(400).json({ error: 'No shuffles remaining' });
    }
    
    // Get remaining tiles - server-side only, client cannot manipulate
    const remainingTileIds = Object.keys(game.tiles).filter(id => !game.tiles[id].removed);
    const remainingTypes = remainingTileIds.map(id => game.tiles[id].type);
    
    // Shuffle types using Fisher-Yates
    for (let i = remainingTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingTypes[i], remainingTypes[j]] = [remainingTypes[j], remainingTypes[i]];
    }
    
    // Reassign types
    remainingTileIds.forEach((id, i) => {
      game.tiles[id].type = remainingTypes[i];
    });
    
    game.shufflesRemaining--;
    
    persistGame(source, game, record, token);
    
    res.json({
      game: {
        id: gameId,
        difficulty: game.difficulty,
        score: game.score,
        matches: game.matches,
        totalMatches: 72,
        tiles: Object.values(game.tiles),
        ended: game.ended,
        hintsRemaining: game.hintsRemaining,
        shufflesRemaining: game.shufflesRemaining
      }
    });
  } catch (error) {
    console.error('Shuffle error:', error);
    res.status(500).json({ error: 'Failed to shuffle board' });
  }
});

// POST /api/games/:gameId/end - End game
router.post('/:gameId/end', optionalAuth, (req, res) => {
  try {
    const { gameId } = req.params;
    const lookup = findGame(req);
    
    if (!lookup) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const { game, source, record, token } = lookup;
    
    if (game.gameId !== gameId) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Calculate final score server-side - CLIENT SCORE IS IGNORED
    const finalScore = calculateScore(
      game.matches,
      game.moves,
      game.difficulty,
      new Date(game.startTime).getTime()
    );
    
    if (source === 'user') {
      // Authenticated user: record game and add to leaderboard
      GameModel.recordGame({
        userId: req.user.id,
        gameType: 'single-player',
        difficulty: game.difficulty,
        score: finalScore,
        duration: Math.floor((Date.now() - new Date(game.startTime).getTime()) / 1000),
        result: game.ended || game.matches >= 72 ? 'completed' : 'forfeited'
      });
      
      GameModel.addLeaderboardEntry({
        userId: req.user.id,
        score: finalScore,
        gameType: 'single-player',
        difficulty: game.difficulty
      });
      
      // Delete active game record from DB
      const deleteStmt = db.prepare(`DELETE FROM game_states WHERE id = ?`);
      deleteStmt.run(record.id);
    } else {
      // Guest: just remove from in-memory Map — no DB records, no leaderboard
      // Per Stefan: no guest persistence, no stale data accumulation
      guestGames.delete(token);
    }
    
    res.json({ 
      message: 'Game ended successfully',
      score: finalScore
    });
  } catch (error) {
    console.error('End game error:', error);
    res.status(500).json({ error: 'Failed to end game' });
  }
});

export default router;
