import db from './database.js';

// In-memory store for active games (server-side state management)
const activeGames = new Map();
let gameIdCounter = 1;

export const GameModel = {
  // === In-memory active game methods (for real-time game management) ===
  
  /**
   * Create a new active game
   * @param {object} gameData 
   * @returns {number} Game ID
   */
  createGame(gameData) {
    const gameId = gameIdCounter++;
    const game = {
      id: gameId,
      userId: gameData.userId,
      gameType: gameData.gameType,
      difficulty: gameData.difficulty,
      tiles: gameData.tiles,
      tilePositions: gameData.tilePositions,
      score: 0,
      moves: 0,
      matches: 0,
      status: 'active',
      createdAt: new Date(),
      gameToken: gameData.gameToken || null
    };
    activeGames.set(gameId, game);
    
    // Register game token for guest access
    if (gameData.gameToken) {
      gameTokens.set(gameData.gameToken, gameId);
    }
    
    return gameId;
  },

  /**
   * Get an active game by ID with user verification
   * @param {number} gameId 
   * @param {number} userId 
   * @returns {object|null} Game object or null
   */
  getGameById(gameId, userId) {
    const game = activeGames.get(parseInt(gameId));
    if (game && game.userId === userId) {
      return game;
    }
    return null;
  },

  /**
   * Get an active game by game token (for guest access)
   * @param {number} gameId 
   * @param {string} token - crypto.randomUUID() game token
   * @returns {object|null} Game object or null
   */
  getGameByToken(gameId, token) {
    const id = parseInt(gameId);
    const game = activeGames.get(id);
    if (game && game.gameToken === token) {
      return game;
    }
    return null;
  },

  /**
   * Update an active game
   * @param {number} gameId 
   * @param {object} gameData 
   * @returns {boolean} Success status
   */
  updateGame(gameId, gameData) {
    const id = parseInt(gameId);
    if (activeGames.has(id)) {
      const existing = activeGames.get(id);
      activeGames.set(id, { ...existing, ...gameData });
      return true;
    }
    return false;
  },

  /**
   * Delete an active game
   * @param {number} gameId 
   * @returns {boolean} Success status
   */
  deleteGame(gameId) {
    const game = activeGames.get(parseInt(gameId));
    if (game && game.gameToken) {
      gameTokens.delete(game.gameToken);
    }
    return activeGames.delete(parseInt(gameId));
  },

  // === Persistent game state methods (for save/resume) ===
  
  /**
   * Create a new game
   * @param {object} gameData 
   * @returns {number} Game ID
   */
  createGame(gameData) {
    const gameId = gameIdCounter++;
    const game = {
      id: gameId,
      userId: gameData.userId,
      gameType: gameData.gameType,
      difficulty: gameData.difficulty,
      tiles: gameData.tiles,
      tilePositions: gameData.tilePositions,
      score: 0,
      moves: 0,
      status: 'active',
      createdAt: new Date()
    };
    activeGames.set(gameId, game);
    return gameId;
  },

  /**
   * Get an active game
   * @param {number} gameId 
   * @returns {object|null} Game object or null
   */
  getGame(gameId) {
    return activeGames.get(gameId) || null;
  },

  /**
   * Create a new active game
   * @param {object} gameData 
   * @returns {number} Game ID
   */
  createGame(gameData) {
    const gameId = gameIdCounter++;
    const game = {
      id: gameId,
      userId: gameData.userId,
      gameType: gameData.gameType || 'singlePlayer',
      difficulty: gameData.difficulty || 'medium',
      tiles: gameData.tiles || [],
      tilePositions: gameData.tilePositions || {},
      score: 0,
      moves: 0,
      matches: 0,
      hintsUsed: 0,
      shufflesUsed: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
      ended: false
    };
    activeGames.set(gameId, game);
    return gameId;
  },

  /**
   * Get an active game by ID with user verification
   * @param {number} gameId 
   * @param {number} userId 
   * @returns {object|null} Game object or null
   */
  getGameById(gameId, userId) {
    const game = activeGames.get(parseInt(gameId));
    if (game && game.userId === userId) {
      return game;
    }
    return null;
  },

  /**
   * Update an active game
   * @param {number} gameId 
   * @param {object} gameData 
   * @returns {boolean} Success status
   */
  updateGame(gameId, gameData) {
    const id = parseInt(gameId);
    const existingGame = activeGames.get(id);
    if (existingGame) {
      activeGames.set(id, { ...existingGame, ...gameData });
      return true;
    }
    return false;
  },

  /**
   * Delete an active game
   * @param {number} gameId 
   * @returns {boolean} Success status
   */
  deleteGame(gameId) {
    return activeGames.delete(parseInt(gameId));
  },

  /**
   * Save a game state for later resume (to database)
   * @param {object} gameData 
   * @returns {number} Saved state ID
   */
  saveGameState(gameData) {
    const stmt = db.prepare(`
      INSERT INTO game_states 
      (user_id, game_type, difficulty, tiles, tile_positions, score, moves, hints_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      gameData.userId,
      gameData.gameType,
      gameData.difficulty,
      JSON.stringify(gameData.tiles),
      JSON.stringify(gameData.tilePositions),
      gameData.score || 0,
      gameData.moves || 0,
      gameData.hintsUsed || 0
    );
    return result.lastInsertRowid;
  },

  /**
   * Get a saved game state
   * @param {number} stateId 
   * @param {number} userId 
   * @returns {object|null} Game state or null
   */
  getGameState(stateId, userId) {
    const stmt = db.prepare(`
      SELECT * FROM game_states 
      WHERE id = ? AND user_id = ?
    `);
    const state = stmt.get(stateId, userId);
    if (state) {
      return {
        ...state,
        tiles: JSON.parse(state.tiles),
        tilePositions: JSON.parse(state.tilePositions)
      };
    }
    return null;
  },

  /**
   * Get latest saved game state for a user
   * @param {number} userId 
   * @returns {object|null} Latest game state or null
   */
  getLatestGameState(userId) {
    const stmt = db.prepare(`
      SELECT * FROM game_states 
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const state = stmt.get(userId);
    if (state) {
      return {
        ...state,
        tiles: JSON.parse(state.tiles),
        tilePositions: JSON.parse(state.tilePositions)
      };
    }
    return null;
  },

  /**
   * Update an existing game state
   * @param {number} stateId 
   * @param {object} gameData 
   * @returns {boolean} Success status
   */
  updateGameState(stateId, gameData) {
    const stmt = db.prepare(`
      UPDATE game_states 
      SET tiles = ?, tile_positions = ?, score = ?, moves = ?, hints_used = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(
      JSON.stringify(gameData.tiles),
      JSON.stringify(gameData.tilePositions),
      gameData.score || 0,
      gameData.moves || 0,
      gameData.hintsUsed || 0,
      stateId
    );
    return result.changes > 0;
  },

  /**
   * Delete a saved game state
   * @param {number} stateId 
   * @param {number} userId 
   * @returns {boolean} Success status
   */
  deleteGameState(stateId, userId) {
    const stmt = db.prepare(`
      DELETE FROM game_states 
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(stateId, userId);
    return result.changes > 0;
  },

  /**
   * Record a completed game
   * @param {object} gameData 
   * @returns {number} Game ID
   */
  recordGame(gameData) {
    const stmt = db.prepare(`
      INSERT INTO games (user_id, game_type, difficulty, score, duration, result)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      gameData.userId,
      gameData.gameType,
      gameData.difficulty,
      gameData.score,
      gameData.duration,
      gameData.result
    );
    return result.lastInsertRowid;
  },

  /**
   * Get user's game history
   * @param {number} userId 
   * @param {number} limit 
   * @returns {array} List of games
   */
  getGameHistory(userId, limit = 20) {
    const stmt = db.prepare(`
      SELECT g.*, u.username
      FROM games g
      JOIN users u ON g.user_id = u.id
      WHERE g.user_id = ?
      ORDER BY g.created_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit);
  },

  /**
   * Get leaderboard
   * @param {string} gameType 
   * @param {string} difficulty 
   * @param {number} limit 
   * @returns {array} Leaderboard entries
   */
  getLeaderboard(gameType = null, difficulty = null, limit = 10) {
    let query = `
      SELECT l.*, u.username
      FROM leaderboard l
      JOIN users u ON l.user_id = u.id
    `;
    const params = [];
    
    if (gameType || difficulty) {
      query += ' WHERE ';
      if (gameType) {
        query += ' l.game_type = ?';
        params.push(gameType);
      }
      if (difficulty) {
        query += params.length ? ' AND ' : '';
        query += ' l.difficulty = ?';
        params.push(difficulty);
      }
    }
    
    query += ' ORDER BY l.score DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(query);
    return stmt.all(...params);
  },

  /**
   * Add a leaderboard entry
   * @param {object} entryData 
   * @returns {number} Entry ID
   */
  addLeaderboardEntry(entryData) {
    const stmt = db.prepare(`
      INSERT INTO leaderboard (user_id, score, game_type, difficulty)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      entryData.userId,
      entryData.score,
      entryData.gameType,
      entryData.difficulty
    );
    return result.lastInsertRowid;
  }
};

export default GameModel;
