const db = require('../config/database');

class Game {
  static async create({ playerCount = 1 }) {
    const result = await db.query(
      `INSERT INTO games (player_count, status, created_at)
       VALUES ($1, 'waiting', NOW())
       RETURNING *`,
      [playerCount]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await db.query(
      'SELECT * FROM games WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async updateStatus(gameId, status) {
    const result = await db.query(
      `UPDATE games SET status = $2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [gameId, status]
    );
    return result.rows[0];
  }

  static async joinGame(gameId, userId) {
    const result = await db.query(
      `INSERT INTO game_players (game_id, user_id, joined_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [gameId, userId]
    );
    return result.rows[0];
  }

  static async findWaitingGames() {
    const result = await db.query(
      `SELECT g.*, COUNT(gp.user_id) as player_count
       FROM games g
       LEFT JOIN game_players gp ON g.id = gp.game_id
       WHERE g.status = 'waiting'
       GROUP BY g.id
       HAVING COUNT(gp.user_id) < g.player_count
       ORDER BY g.created_at ASC`
    );
    return result.rows;
  }
}

module.exports = Game;
