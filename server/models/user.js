import db from './database.js';

export const UserModel = {
  /**
   * Create a new user
   * @param {string} username 
   * @param {string} email 
   * @param {string} passwordHash 
   * @returns {object} Created user or null
   */
  create(username, email, passwordHash) {
    try {
      const stmt = db.prepare(`
        INSERT INTO users (username, email, password_hash)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(username, email, passwordHash);
      return { id: result.lastInsertRowid, username, email };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        if (error.message.includes('username')) {
          throw new Error('Username already exists');
        }
        throw new Error('Email already exists');
      }
      throw error;
    }
  },

  /**
   * Find user by ID
   * @param {number} id 
   * @returns {object|null} User object or null
   */
  findById(id) {
    const stmt = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
    return stmt.get(id) || null;
  },

  /**
   * Find user by username (includes password_hash for auth verification)
   * @param {string} username 
   * @returns {object|null} User object or null
   */
  findByUsername(username) {
    const stmt = db.prepare('SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?');
    return stmt.get(username) || null;
  },

  /**
   * Find user by email (includes password_hash for auth verification)
   * NOTE: Currently not used by any route handler — available for future features 
   * such as "forgot password" or email-based login.
   * @param {string} email 
   * @returns {object|null} User object or null
   */
  findByEmail(email) {
    const stmt = db.prepare('SELECT id, username, email, password_hash, created_at FROM users WHERE email = ?');
    return stmt.get(email) || null;
  },

  /**
   * Update user password
   * @param {number} userId 
   * @param {string} newPasswordHash 
   * @returns {boolean} Success status
   */
  updatePassword(userId, newPasswordHash) {
    const stmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const result = stmt.run(newPasswordHash, userId);
    return result.changes > 0;
  },

  /**
   * Get user statistics
   * @param {number} userId 
   * @returns {object} Statistics object
   */
  getStats(userId) {
    const gamesStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        AVG(score) as avg_score,
        MAX(score) as high_score
      FROM games
      WHERE user_id = ?
    `);
    
    const stats = gamesStmt.get(userId);
    const totalGames = stats.total_games || 0;
    const wins = stats.wins || 0;
    
    return {
      total_games: totalGames,
      totalGames: totalGames,
      wins: wins,
      losses: stats.losses || 0,
      avg_score: Math.round(stats.avg_score || 0),
      high_score: stats.high_score || 0,
      winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0
    };
  }
};

export default UserModel;
