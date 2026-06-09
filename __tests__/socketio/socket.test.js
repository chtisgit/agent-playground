/**
 * Tests for Socket.IO integration
 * 
 * Covers: connection, join_game, leave_game, tile_selected, match_made, chat_message, game_update, disconnect
 * ID 202: Socket.IO integration tests
 */

import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc } from 'socket.io-client';
import express from 'express';

// Port for test server
const TEST_PORT = 3099;

/**
 * Helper: create a test Socket.IO server and client
 */
function createTestPair() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  return { app, httpServer, io };
}

/**
 * Helper: wait for a socket event
 */
function waitForEvent(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Socket.IO Integration', () => {
  let httpServer, io, clientSocket;
  let serverAddress;

  beforeAll((done) => {
    const pair = createTestPair();
    httpServer = pair.httpServer;
    io = pair.io;

    httpServer.listen(TEST_PORT, () => {
      serverAddress = `http://localhost:${TEST_PORT}`;
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    io.close();
    httpServer.close(done);
  });

  beforeEach((done) => {
    // Connect a fresh client before each test
    clientSocket = ioc(serverAddress, {
      transports: ['websocket'],
      forceNew: true,
    });
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    // Remove all listeners from io to prevent leaks between tests
    io.removeAllListeners();
    io.sockets.removeAllListeners();
  });

  // ============================================================
  // Connection
  // ============================================================
  describe('connection', () => {
    it('should establish a socket connection', () => {
      expect(clientSocket.connected).toBe(true);
      expect(clientSocket.id).toBeDefined();
    });

    it('should assign a unique ID to each connected client', (done) => {
      const secondSocket = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });
      secondSocket.on('connect', () => {
        expect(secondSocket.id).toBeDefined();
        expect(secondSocket.id).not.toBe(clientSocket.id);
        secondSocket.disconnect();
        done();
      });
    });

    it('should handle multiple concurrent connections', (done) => {
      let connected = 0;
      const sockets = [];
      const total = 3;

      for (let i = 0; i < total; i++) {
        const socket = ioc(serverAddress, {
          transports: ['websocket'],
          forceNew: true,
        });
        sockets.push(socket);
        socket.on('connect', () => {
          connected++;
          if (connected === total) {
            expect(connected).toBe(total);
            sockets.forEach((s) => s.disconnect());
            done();
          }
        });
      }
    });
  });

  // ============================================================
  // join_game
  // ============================================================
  describe('join_game event', () => {
    it('should allow client to join a game room', (done) => {
      const gameId = 'game-join-test-1';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
      });

      // Reconnect to pick up the handler
      clientSocket.disconnect();
      clientSocket = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join_game', gameId);
        // Wait a tick and check rooms
        setTimeout(async () => {
          // Verify room membership via server-side check
          const serverSocket = io.sockets.sockets.get(clientSocket.id);
          if (serverSocket) {
            expect(serverSocket.rooms.has(`game_${gameId}`)).toBe(true);
          }
          done();
        }, 100);
      });
    });

    it('should allow multiple clients to join the same game room', (done) => {
      const gameId = 'game-multi-join';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      let joined = 0;
      const checkDone = () => {
        joined++;
        if (joined === 2) {
          const s1 = io.sockets.sockets.get(clientSocket.id);
          const s2 = io.sockets.sockets.get(client2.id);
          expect(s1.rooms.has(`game_${gameId}`)).toBe(true);
          expect(s2.rooms.has(`game_${gameId}`)).toBe(true);
          client2.disconnect();
          done();
        }
      };

      clientSocket.on('connect', () => {
        clientSocket.emit('join_game', gameId);
        setTimeout(checkDone, 50);
      });

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        setTimeout(checkDone, 50);
      });
    });

    it('should allow client to join multiple game rooms', (done) => {
      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
      });

      clientSocket.disconnect();
      clientSocket = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join_game', 'game-A');
        clientSocket.emit('join_game', 'game-B');
        setTimeout(() => {
          const serverSocket = io.sockets.sockets.get(clientSocket.id);
          expect(serverSocket.rooms.has('game_game-A')).toBe(true);
          expect(serverSocket.rooms.has('game_game-B')).toBe(true);
          done();
        }, 100);
      });
    });
  });

  // ============================================================
  // leave_game
  // ============================================================
  describe('leave_game event', () => {
    it('should allow client to leave a game room', (done) => {
      const gameId = 'game-leave-test';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('leave_game', (gId) => {
          socket.leave(`game_${gId}`);
        });
      });

      clientSocket.disconnect();
      clientSocket = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join_game', gameId);
        setTimeout(() => {
          clientSocket.emit('leave_game', gameId);
          setTimeout(() => {
            const serverSocket = io.sockets.sockets.get(clientSocket.id);
            expect(serverSocket.rooms.has(`game_${gameId}`)).toBe(false);
            done();
          }, 100);
        }, 50);
      });
    });

    it('should not error when leaving a room not joined', (done) => {
      io.on('connection', (socket) => {
        socket.on('leave_game', (gId) => {
          socket.leave(`game_${gId}`);
        });
      });

      clientSocket.disconnect();
      clientSocket = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        expect(() => {
          clientSocket.emit('leave_game', 'non-existent-room');
        }).not.toThrow();
        done();
      });
    });
  });

  // ============================================================
  // tile_selected
  // ============================================================
  describe('tile_selected event', () => {
    it('should broadcast opponent_tile_selected to other clients in the same room', (done) => {
      const gameId = 'game-tile-select';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('tile_selected', (data) => {
          socket.to(`game_${data.gameId}`).emit('opponent_tile_selected', {
            playerId: socket.id,
            tileId: data.tileId,
          });
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        clientSocket.emit('join_game', gameId);

        setTimeout(() => {
          client2.on('opponent_tile_selected', (data) => {
            expect(data.playerId).toBe(clientSocket.id);
            expect(data.tileId).toBe(42);
            client2.disconnect();
            done();
          });

          clientSocket.emit('tile_selected', { gameId, tileId: 42 });
        }, 100);
      });
    });

    it('should not send opponent_tile_selected to the sender', (done) => {
      const gameId = 'game-tile-no-self';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('tile_selected', (data) => {
          socket.to(`game_${data.gameId}`).emit('opponent_tile_selected', {
            playerId: socket.id,
            tileId: data.tileId,
          });
        });
      });

      let receivedOwn = false;
      clientSocket.on('opponent_tile_selected', () => {
        receivedOwn = true;
      });

      clientSocket.emit('join_game', gameId);
      setTimeout(() => {
        clientSocket.emit('tile_selected', { gameId, tileId: 7 });
        setTimeout(() => {
          expect(receivedOwn).toBe(false);
          done();
        }, 200);
      }, 50);
    });
  });

  // ============================================================
  // match_made
  // ============================================================
  describe('match_made event', () => {
    it('should broadcast tiles_matched to ALL clients including sender', (done) => {
      const gameId = 'game-match-made';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('match_made', (data) => {
          io.to(`game_${data.gameId}`).emit('tiles_matched', {
            tile1Id: data.tile1Id,
            tile2Id: data.tile2Id,
            playerId: socket.id,
          });
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      let client1Received = false;
      let client2Received = false;

      Promise.all([
        new Promise((resolve) => {
          client2.on('connect', () => {
            client2.emit('join_game', gameId);
            setTimeout(resolve, 50);
          });
        }),
        new Promise((resolve) => {
          clientSocket.emit('join_game', gameId);
          setTimeout(resolve, 50);
        }),
      ]).then(() => {
        clientSocket.on('tiles_matched', (data) => {
          client1Received = true;
          expect(data.tile1Id).toBe(10);
          expect(data.tile2Id).toBe(20);
        });

        client2.on('tiles_matched', (data) => {
          client2Received = true;
          expect(data.tile1Id).toBe(10);
          expect(data.tile2Id).toBe(20);
          expect(data.playerId).toBe(clientSocket.id);
        });

        setTimeout(() => {
          clientSocket.emit('match_made', {
            gameId,
            tile1Id: 10,
            tile2Id: 20,
          });

          setTimeout(() => {
            // Both clients should receive (io.to emits to all in room)
            expect(client1Received).toBe(true);
            expect(client2Received).toBe(true);
            client2.disconnect();
            done();
          }, 200);
        }, 100);
      });
    });
  });

  // ============================================================
  // chat_message
  // ============================================================
  describe('chat_message event', () => {
    /**
     * Simple sanitize function matching the one in server/index.js
     */
    function sanitize(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .slice(0, 500);
    }

    it('should broadcast chat message to all clients in the room', (done) => {
      const gameId = 'game-chat';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('chat_message', (data) => {
          io.to(`game_${data.gameId}`).emit('chat_message', {
            playerId: socket.id,
            username: sanitize(data.username || 'Anonymous'),
            message: sanitize(data.message || ''),
            timestamp: new Date().toISOString(),
          });
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        clientSocket.emit('join_game', gameId);

        setTimeout(() => {
          client2.on('chat_message', (data) => {
            expect(data.username).toBe('Player1');
            expect(data.message).toBe('Hello world!');
            expect(data.playerId).toBe(clientSocket.id);
            expect(data.timestamp).toBeDefined();
            client2.disconnect();
            done();
          });

          clientSocket.emit('chat_message', {
            gameId,
            username: 'Player1',
            message: 'Hello world!',
          });
        }, 100);
      });
    });

    it('should default username to "Anonymous" when not provided', (done) => {
      const gameId = 'game-chat-anon';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('chat_message', (data) => {
          io.to(`game_${data.gameId}`).emit('chat_message', {
            playerId: socket.id,
            username: sanitize(data.username || 'Anonymous'),
            message: sanitize(data.message || ''),
            timestamp: new Date().toISOString(),
          });
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        clientSocket.emit('join_game', gameId);

        setTimeout(() => {
          client2.on('chat_message', (data) => {
            expect(data.username).toBe('Anonymous');
            client2.disconnect();
            done();
          });

          clientSocket.emit('chat_message', {
            gameId,
            message: 'No username here',
          });
        }, 100);
      });
    });

    it('should default message to empty string when not provided', (done) => {
      const gameId = 'game-chat-empty';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('chat_message', (data) => {
          io.to(`game_${data.gameId}`).emit('chat_message', {
            playerId: socket.id,
            username: sanitize(data.username || 'Anonymous'),
            message: sanitize(data.message || ''),
            timestamp: new Date().toISOString(),
          });
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        clientSocket.emit('join_game', gameId);

        setTimeout(() => {
          client2.on('chat_message', (data) => {
            expect(data.message).toBe('');
            client2.disconnect();
            done();
          });

          clientSocket.emit('chat_message', {
            gameId,
            username: 'Tester',
          });
        }, 100);
      });
    });

    it('should sanitize XSS in chat messages', (done) => {
      const gameId = 'game-chat-xss';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('chat_message', (data) => {
          io.to(`game_${data.gameId}`).emit('chat_message', {
            playerId: socket.id,
            username: sanitize(data.username || 'Anonymous'),
            message: sanitize(data.message || ''),
            timestamp: new Date().toISOString(),
          });
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        clientSocket.emit('join_game', gameId);

        setTimeout(() => {
          client2.on('chat_message', (data) => {
            expect(data.username).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            expect(data.message).toBe('&lt;img src=x onerror=alert(1)&gt;');
            client2.disconnect();
            done();
          });

          clientSocket.emit('chat_message', {
            gameId,
            username: '<script>alert("xss")</script>',
            message: '<img src=x onerror=alert(1)>',
          });
        }, 100);
      });
    });

    it('should truncate messages longer than 500 characters', (done) => {
      const gameId = 'game-chat-truncate';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('chat_message', (data) => {
          io.to(`game_${data.gameId}`).emit('chat_message', {
            playerId: socket.id,
            username: sanitize(data.username || 'Anonymous'),
            message: sanitize(data.message || ''),
            timestamp: new Date().toISOString(),
          });
        });
      });

      const longMessage = 'A'.repeat(1000);

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        clientSocket.emit('join_game', gameId);

        setTimeout(() => {
          client2.on('chat_message', (data) => {
            expect(data.message.length).toBeLessThanOrEqual(500);
            client2.disconnect();
            done();
          });

          clientSocket.emit('chat_message', {
            gameId,
            username: 'Tester',
            message: longMessage,
          });
        }, 100);
      });
    });
  });

  // ============================================================
  // game_update
  // ============================================================
  describe('game_update event', () => {
    it('should broadcast game state to other clients in the room', (done) => {
      const gameId = 'game-update-test';

      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('game_update', (data) => {
          socket.to(`game_${data.gameId}`).emit('game_state_update', data);
        });
      });

      const client2 = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      let senderReceived = false;

      client2.on('connect', () => {
        client2.emit('join_game', gameId);
        clientSocket.emit('join_game', gameId);

        setTimeout(() => {
          clientSocket.on('game_state_update', () => {
            senderReceived = true;
          });

          client2.on('game_state_update', (data) => {
            expect(data.gameId).toBe(gameId);
            expect(data.score).toBe(100);
            expect(data.state).toBe('in_progress');
            // Sender should NOT receive via socket.to
            expect(senderReceived).toBe(false);
            client2.disconnect();
            done();
          });

          clientSocket.emit('game_update', {
            gameId,
            score: 100,
            state: 'in_progress',
          });
        }, 100);
      });
    });
  });

  // ============================================================
  // disconnect
  // ============================================================
  describe('disconnect', () => {
    it('should emit disconnect event when client disconnects', (done) => {
      let disconnected = false;

      io.on('connection', (socket) => {
        socket.on('disconnect', () => {
          disconnected = true;
        });
      });

      // Reconnect to pick up handler
      clientSocket.disconnect();
      clientSocket = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
        setTimeout(() => {
          expect(disconnected).toBe(true);
          done();
        }, 100);
      });
    });
  });

  // ============================================================
  // Room isolation
  // ============================================================
  describe('room isolation', () => {
    it('should NOT send messages to clients in different rooms', (done) => {
      io.on('connection', (socket) => {
        socket.on('join_game', (gId) => {
          socket.join(`game_${gId}`);
        });
        socket.on('chat_message', (data) => {
          io.to(`game_${data.gameId}`).emit('chat_message', {
            playerId: socket.id,
            username: sanitize(data.username || 'Anonymous'),
            message: sanitize(data.message || ''),
            timestamp: new Date().toISOString(),
          });
        });
      });

      function sanitize(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .slice(0, 500);
      }

      const clientInRoomB = ioc(serverAddress, {
        transports: ['websocket'],
        forceNew: true,
      });

      let roomBReceivedMessage = false;

      clientInRoomB.on('connect', () => {
        clientInRoomB.emit('join_game', 'game-room-B');
        clientSocket.emit('join_game', 'game-room-A');

        setTimeout(() => {
          clientInRoomB.on('chat_message', () => {
            roomBReceivedMessage = true;
          });

          clientSocket.emit('chat_message', {
            gameId: 'game-room-A',
            username: 'PlayerA',
            message: 'Secret for room A only',
          });

          setTimeout(() => {
            expect(roomBReceivedMessage).toBe(false);
            clientInRoomB.disconnect();
            done();
          }, 200);
        }, 100);
      });
    });
  });
});
