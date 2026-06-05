const db = require('../config/database');

class User {
  static async create({ username, email, passwordHash }) {
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await db.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async updateStats(userId, { score, time, matchedPairs }) {
    const result = await db.query(
      `INSERT INTO game_stats (user_id, score, time_seconds, matched_pairs, played_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [userId, score, time, matchedPairs]
    );
    return result.rows[0];
  }

  static async getLeaderboard(limit = 10) {
    const result = await db.query(
      `SELECT u.username, MAX(gs.score) as high_score, 
              MIN(gs.time_seconds) as best_time, 
              COUNT(*) as games_played
       FROM users u
       JOIN game_stats gs ON u.id = gs.user_id
       GROUP BY u.id, u.username
       ORDER BY high_score DESC, best_time ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }
}

module.exports = User;
