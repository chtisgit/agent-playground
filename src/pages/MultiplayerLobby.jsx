import { useState, useEffect, useCallback } from 'react';
import { lobbyService, gameSocket } from '../services/lobbyService';
import './MultiplayerLobby.css';

function MultiplayerLobby() {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const roomList = await lobbyService.getRooms();
      setRooms(roomList.rooms || []);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  useEffect(() => {
    if (currentRoom) {
      gameSocket.connect(currentRoom.id, {
        onConnect: () => {
          gameSocket.send({ type: 'join', playerName });
        },
        onMessage: (data) => {
          if (data.type === 'room_update') {
            setCurrentRoom(data.room);
          }
        },
        onDisconnect: () => {
          console.log('Disconnected from room');
        },
        onError: (err) => {
          console.error('Socket error:', err);
        },
      });
    }

    return () => {
      gameSocket.disconnect();
    };
  }, [currentRoom?.id]);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setLoading(true);
    setError(null);
    setIsCreating(true);
    
    try {
      const room = await lobbyService.createRoom(playerName);
      setCurrentRoom(room);
      gameSocket.connect(room.id, {
        onConnect: () => {
          gameSocket.send({ type: 'create', playerName });
        },
        onMessage: () => {},
        onDisconnect: () => {},
        onError: () => {},
      });
    } catch (err) {
      setError('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (roomId) => {
    if (!playerName.trim()) {
      setError('Please enter your name first');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const room = await lobbyService.joinRoom(roomId, playerName);
      setCurrentRoom(room);
    } catch (err) {
      setError('Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (currentRoom) {
      await lobbyService.leaveRoom(currentRoom.id);
      gameSocket.disconnect();
      setCurrentRoom(null);
      fetchRooms();
    }
  };

  if (currentRoom) {
    return (
      <div className="lobby-container">
        <div className="current-room">
          <h2>Room: {currentRoom.name}</h2>
          <div className="room-info">
            <p>Host: {currentRoom.host}</p>
            <p>Players: {currentRoom.players?.length || 1}/4</p>
          </div>
          <div className="player-list">
            <h3>Players</h3>
            <ul>
              {currentRoom.players?.map((player, index) => (
                <li key={index}>{player}</li>
              ))}
            </ul>
          </div>
          {currentRoom.players?.length < 2 && (
            <p className="waiting-message">Waiting for more players...</p>
          )}
          <button className="btn btn-outline" onClick={handleLeaveRoom}>
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <div className="player-setup">
        <h2>Multiplayer Lobby</h2>
        <label>
          Your Name:
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
          />
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="lobby-actions">
        <div className="create-room">
          <h3>Create New Room</h3>
          <div className="room-create-form">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Room name (optional)"
            />
            <button
              className="btn btn-primary"
              onClick={handleCreateRoom}
              disabled={loading}
            >
              Create
            </button>
          </div>
        </div>
      </div>

      <div className="room-list">
        <h3>Available Rooms</h3>
        {rooms.length === 0 ? (
          <p className="no-rooms">No rooms available. Create one!</p>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <div key={room.id} className="room-card">
                <h4>{room.name}</h4>
                <p>Host: {room.host}</p>
                <p>Players: {room.players?.length || 1}/4</p>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={loading || (room.players?.length || 1) >= 4}
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MultiplayerLobby;
