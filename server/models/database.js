import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../../data/mahjong.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Games table (for completed games)
  // game_type: 'singlePlayer' | 'multiPlayer' (matching code usage)
  // result: 'win' | 'loss' | 'draw' | 'abandoned' (matching code usage)
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_type TEXT NOT NULL CHECK (game_type IN ('singlePlayer', 'multiPlayer')),
      difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
      score INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw', 'abandoned')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Game states table (for saved/resumed games)
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game_type TEXT NOT NULL,
      difficulty TEXT,
      tiles TEXT NOT NULL,
      tile_positions TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      moves INTEGER DEFAULT 0,
      hints_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Leaderboard entries
  db.exec(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      game_type TEXT NOT NULL,
      difficulty TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_user ON games(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_states_user ON game_states(user_id);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
  `);

  console.log('Database initialized successfully');
}

export default db;
