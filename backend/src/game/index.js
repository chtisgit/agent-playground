/**
 * Mahjong Game Logic
 * Main game state management and game rules
 */

const { createBoard, getAccessibleTiles, removeTiles, isBoardCleared, countRemainingTiles } = require('./board');
const { tilesMatch } = require('./tiles');
const { calculateMatchPoints, calculateFinalScore, calculateRank, COMBO_MULTIPLIER } = require('./scoring');

/**
 * Game states
 */
const GAME_STATES = {
  WAITING: 'waiting',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned'
};

/**
 * Create a new game session
 */
function createGameSession(gameId, playerId, options = {}) {
  return {
    gameId,
    playerId,
    board: createBoard(),
    state: GAME_STATES.IN_PROGRESS,
    matchHistory: [],
    startTime: Date.now(),
    lastMatchTime: null,
    comboCount: 0,
    totalScore: 0,
    hintCount: 0,
    shuffleCount: 0
  };
}

/**
 * Process a tile selection
 * @param {Object} gameSession - Current game session
 * @param {Object} selectedTile - The tile the player selected
 * @returns {Object} Result of the selection
 */
function processTileSelection(gameSession, selectedTile) {
  const { board, matchHistory } = gameSession;
  
  // Check if tile exists on board
  if (!board[selectedTile.row] || !board[selectedTile.row][selectedTile.col]) {
    return {
      success: false,
      error: 'TILE_NOT_FOUND',
      message: 'Selected tile does not exist on the board'
    };
  }
  
  // Check if tile is accessible
  const accessibleTiles = getAccessibleTiles(board);
  const isAccessible = accessibleTiles.some(
    t => t.row === selectedTile.row && t.col === selectedTile.col
  );
  
  if (!isAccessible) {
    return {
      success: false,
      error: 'TILE_NOT_ACCESSIBLE',
      message: 'Selected tile is blocked and cannot be matched'
    };
  }
  
  // Find existing selected tile (for matching)
  if (gameSession.selectedTile) {
    const existingTile = gameSession.selectedTile;
    
    // Check if same tile selected twice
    if (existingTile.row === selectedTile.row && existingTile.col === selectedTile.col) {
      return {
        success: false,
        error: 'SAME_TILE',
        message: 'Cannot match a tile with itself'
      };
    }
    
    // Check if tiles match
    if (tilesMatch(board[existingTile.row][existingTile.col], board[selectedTile.row][selectedTile.col])) {
      // Calculate points
      const timeSinceLastMatch = gameSession.lastMatchTime 
        ? (Date.now() - gameSession.lastMatchTime) / 1000 
        : 0;
      
      const points = calculateMatchPoints(
        board[existingTile.row][existingTile.col],
        board[selectedTile.row][selectedTile.col],
        gameSession.comboCount,
        timeSinceLastMatch
      );
      
      // Update board
      const newBoard = removeTiles(board, board[existingTile.row][existingTile.col], board[selectedTile.row][selectedTile.col]);
      
      // Record match
      matchHistory.push({
        tile1: { ...board[existingTile.row][existingTile.col] },
        tile2: { ...board[selectedTile.row][selectedTile.col] },
        points,
        timestamp: Date.now()
      });
      
      gameSession.board = newBoard;
      gameSession.totalScore += points;
      gameSession.comboCount++;
      gameSession.lastMatchTime = Date.now();
      gameSession.selectedTile = null;
      
      // Check if board is cleared
      const isCleared = isBoardCleared(newBoard);
      
      return {
        success: true,
        match: true,
        points,
        comboCount: gameSession.comboCount,
        boardCleared: isCleared,
        board: newBoard,
        remainingTiles: countRemainingTiles(newBoard)
      };
    } else {
      // Tiles don't match
      gameSession.comboCount = 0;
      gameSession.selectedTile = selectedTile;
      
      return {
        success: true,
        match: false,
        points: 0,
        comboCount: 0,
        message: 'Tiles do not match. Try again.'
      };
    }
  } else {
    // First tile selected
    gameSession.selectedTile = selectedTile;
    
    return {
      success: true,
      match: null,
      message: 'Tile selected. Select another tile to match.'
    };
  }
}

/**
 * Get available hints (pairs of matching accessible tiles)
 */
function getHint(gameSession) {
  const { board } = gameSession;
  const accessibleTiles = getAccessibleTiles(board);
  
  // Find matching pairs
  const matchingPairs = [];
  for (let i = 0; i < accessibleTiles.length; i++) {
    for (let j = i + 1; j < accessibleTiles.length; j++) {
      if (tilesMatch(accessibleTiles[i], accessibleTiles[j])) {
        matchingPairs.push([accessibleTiles[i], accessibleTiles[j]]);
      }
    }
  }
  
  if (matchingPairs.length === 0) {
    return null;
  }
  
  // Return a random matching pair as hint
  return matchingPairs[Math.floor(Math.random() * matchingPairs.length)];
}

/**
 * Get current game state for client
 */
function getGameState(gameSession) {
  const timeElapsed = Math.floor((Date.now() - gameSession.startTime) / 1000);
  
  return {
    gameId: gameSession.gameId,
    state: gameSession.state,
    board: gameSession.board,
    score: gameSession.totalScore,
    comboCount: gameSession.comboCount,
    remainingTiles: countRemainingTiles(gameSession.board),
    timeElapsed,
    matchCount: gameSession.matchHistory.length,
    hintCount: gameSession.hintCount,
    shuffleCount: gameSession.shuffleCount
  };
}

/**
 * Calculate final results
 */
function getFinalResults(gameSession) {
  const timeElapsed = Math.floor((Date.now() - gameSession.startTime) / 1000);
  const finalScore = calculateFinalScore(gameSession.matchHistory, timeElapsed);
  
  return {
    gameId: gameSession.gameId,
    score: finalScore,
    totalMatches: gameSession.matchHistory.length,
    timeElapsed,
    hintsUsed: gameSession.hintCount,
    shufflesUsed: gameSession.shuffleCount,
    boardCleared: isBoardCleared(gameSession.board),
    perfectGame: gameSession.matchHistory.length === 72 // 144 tiles / 2
  };
}

module.exports = {
  GAME_STATES,
  createGameSession,
  processTileSelection,
  getHint,
  getGameState,
  getFinalResults
};
