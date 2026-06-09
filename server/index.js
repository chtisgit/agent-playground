import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeDatabase } from './models/database.js';
import gameRoutes from './routes/game.js';
import gamesRoutes from './routes/games.js';
import authRoutes from './routes/auth.js';
import lobbyRoutes from './routes/lobby.js';

// CORS allowed origins - restrict based on environment
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production: Only allow specific domains
    const allowed = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowed.length === 0) {
      console.warn('WARNING: No ALLOWED_ORIGINS configured for production!');
    }
    return allowed;
  }
  // Development: Allow localhost dev servers
  return ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];
};

const allowedOrigins = getAllowedOrigins();

/**
 * Sanitize user input to prevent XSS attacks
 * Uses a whitelist approach: strip all HTML tags, then entity-encode special chars
 * @param {string} str - Input string to sanitize
 * @returns {string} Sanitized string
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  // First, strip all HTML tags completely
  let cleaned = str.replace(/<[^>]*>/g, '');
  // Then entity-encode remaining special characters
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  // Limit length to prevent abuse
  return cleaned.slice(0, 500);
}

/**
 * Simple rate limiter using in-memory store
 * Limits each IP to maxRequests per windowMs
 */
function createRateLimiter(maxRequests = 100, windowMs = 60000) {
  const store = new Map();

  // Clean up expired entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.resetTime > windowMs) {
        store.delete(key);
      }
    }
  }, 60000);

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    
    if (!store.has(ip)) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const entry = store.get(ip);
    if (now > entry.resetTime) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.' 
      });
    }
    
    next();
  };
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Initialize database
initializeDatabase();

// Middleware
app.use(express.json());

// Rate limiting - 100 requests per minute per IP
app.use(createRateLimiter(100, 60000));

// CORS configuration - only set headers for allowed origins
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    // Only respond 200 if origin is allowed, otherwise 403
    if (origin && allowedOrigins.includes(origin)) {
      return res.sendStatus(200);
    }
    return res.sendStatus(403);
  }
  next();
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Web-based Mahjong API', version: '1.0.0' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/game', gameRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/lobby', lobbyRoutes);

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.IO for real-time multiplayer
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join game room
  socket.on('join_game', (gameId) => {
    socket.join(`game_${gameId}`);
    console.log(`User ${socket.id} joined game ${gameId}`);
  });
  
  // Leave game room
  socket.on('leave_game', (gameId) => {
    socket.leave(`game_${gameId}`);
    console.log(`User ${socket.id} left game ${gameId}`);
  });
  
  // Handle tile selection
  socket.on('tile_selected', (data) => {
    socket.to(`game_${data.gameId}`).emit('opponent_tile_selected', {
      playerId: socket.id,
      tileId: data.tileId
    });
  });
  
  // Handle match made
  socket.on('match_made', (data) => {
    io.to(`game_${data.gameId}`).emit('tiles_matched', {
      tile1Id: data.tile1Id,
      tile2Id: data.tile2Id,
      playerId: socket.id
    });
  });
  
  // Handle chat message - with XSS sanitization
  socket.on('chat_message', (data) => {
    io.to(`game_${data.gameId}`).emit('chat_message', {
      playerId: socket.id,
      username: sanitize(data.username || 'Anonymous'),
      message: sanitize(data.message || ''),
      timestamp: new Date().toISOString()
    });
  });
  
  // Handle game state update
  socket.on('game_update', (data) => {
    socket.to(`game_${data.gameId}`).emit('game_state_update', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Mahjong server running on port ${PORT}`);
});

export { app, io };
