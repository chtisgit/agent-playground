import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeDatabase } from './models/database.js';
import gameRoutes from './routes/game.js';
import authRoutes from './routes/auth.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Initialize database
initializeDatabase();

// Middleware
app.use(express.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
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
app.use('/api/auth', authRoutes);

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
  
  // Handle chat message
  socket.on('chat_message', (data) => {
    io.to(`game_${data.gameId}`).emit('chat_message', {
      playerId: socket.id,
      username: data.username,
      message: data.message,
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
