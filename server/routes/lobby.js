import { Router } from 'express';

const router = Router();

// In-memory lobby storage
const rooms = new Map();
let roomIdCounter = 1;

// Helper to create a room object
function createRoom(hostName, roomName) {
  const id = roomIdCounter++;
  return {
    id,
    name: roomName || `Room ${id}`,
    host: hostName,
    players: [hostName],
    createdAt: new Date(),
  };
}

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
      players: r.players,
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
    const room = createRoom(playerName.trim(), req.body.roomName);
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
    if (room.players.includes(playerName.trim())) {
      // Already in room, just return room
      return res.json(room);
    }
    if (room.players.length >= 4) {
      return res.status(403).json({ error: 'Room is full' });
    }
    room.players.push(playerName.trim());
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
      room.players = room.players.filter(p => p !== playerName.trim());
      if (room.players.length === 0) {
        rooms.delete(room.id);
        return res.json({ message: 'Room deleted', roomId: req.params.roomId });
      }
      // Reassign host if host left
      if (room.host === playerName.trim() && room.players.length > 0) {
        room.host = room.players[0];
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
