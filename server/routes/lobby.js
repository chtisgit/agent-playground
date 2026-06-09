import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

// In-memory lobby storage
const rooms = new Map();
let roomIdCounter = 1;

// Stale room cleanup - remove rooms older than 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.createdAt.getTime() > 30 * 60 * 1000) {
      rooms.delete(id);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

/**
 * Sanitize a string for display - prevent XSS
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  // Strip HTML tags
  let cleaned = str.replace(/<[^>]*>/g, '');
  // Entity encode
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  // Limit length
  return cleaned.slice(0, 30);
}

// Helper to create a room object
function createRoom(hostId, hostName, roomName) {
  const id = roomIdCounter++;
  return {
    id,
    name: sanitizeInput(roomName) || `Room ${id}`,
    hostId,
    host: sanitizeInput(hostName),
    players: [{ id: hostId, name: sanitizeInput(hostName) }],
    createdAt: new Date(),
  };
}

// All lobby routes use optionalAuth
router.use(optionalAuth);

/**
 * List all available rooms
 * GET /api/lobby/rooms
 */
router.get('/rooms', (req, res) => {
  try {
    const roomList = Array.from(rooms.values()).map(r => ({
      id: r.id,
      name: r.name,
      host: r.host,
      playerCount: r.players.length,
    }));
    res.json({ rooms: roomList });
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

/**
 * Create a new room
 * POST /api/lobby/rooms
 */
router.post('/rooms', (req, res) => {
  try {
    const { playerName } = req.body;
    if (!playerName || !playerName.trim()) {
      return res.status(400).json({ error: 'playerName is required' });
    }
    
    const hostId = req.user ? req.user.id : null;
    if (!hostId) {
      return res.status(401).json({ error: 'Authentication required to create a room' });
    }
    
    const room = createRoom(hostId, playerName.trim(), req.body.roomName);
    rooms.set(room.id, room);
    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * Get room state
 * GET /api/lobby/rooms/:roomId
 */
router.get('/rooms/:roomId', (req, res) => {
  try {
    const room = rooms.get(parseInt(req.params.roomId));
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

/**
 * Join a room
 * POST /api/lobby/rooms/:roomId/join
 */
router.post('/rooms/:roomId/join', (req, res) => {
  try {
    const room = rooms.get(parseInt(req.params.roomId));
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const { playerName } = req.body;
    if (!playerName || !playerName.trim()) {
      return res.status(400).json({ error: 'playerName is required' });
    }
    
    const sanitizedName = sanitizeInput(playerName.trim());
    
    // Check if player already in room
    const existingPlayer = room.players.find(p => p.name === sanitizedName);
    if (existingPlayer) {
      return res.json(room);
    }
    
    if (room.players.length >= 4) {
      return res.status(403).json({ error: 'Room is full' });
    }
    
    const playerId = req.user ? req.user.id : null;
    room.players.push({ id: playerId, name: sanitizedName });
    rooms.set(room.id, room);
    res.json(room);
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

/**
 * Leave a room
 * POST /api/lobby/rooms/:roomId/leave
 */
router.post('/rooms/:roomId/leave', (req, res) => {
  try {
    const room = rooms.get(parseInt(req.params.roomId));
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const { playerName } = req.body;
    if (playerName) {
      const sanitizedName = sanitizeInput(playerName.trim());
      room.players = room.players.filter(p => p.name !== sanitizedName);
      
      if (room.players.length === 0) {
        rooms.delete(room.id);
        return res.json({ message: 'Room deleted', roomId: req.params.roomId });
      }
      
      // Reassign host if host left
      if (room.host === sanitizedName && room.players.length > 0) {
        room.host = room.players[0].name;
        room.hostId = room.players[0].id;
      }
      
      rooms.set(room.id, room);
    }
    res.json(room);
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

export default router;
