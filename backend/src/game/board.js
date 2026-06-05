/**
 * Mahjong Board Logic
 * Handles board creation, tile arrangement, and board state management
 */

const { generateTileSet, shuffleTiles } = require('./tiles');

// Board layout configurations
const BOARD_LAYOUT = {
  // Classic 144-tile layout (18 wide x 8 deep with variations)
  width: 18,
  height: 5,
  layers: 1
};

/**
 * Create a new Mahjong board with shuffled tiles
 * Removes tiles in pairs to ensure solvability possibility
 */
function createBoard() {
  const tiles = generateTileSet();
  const shuffledTiles = shuffleTiles(tiles);
  
  // For classic layout, we arrange tiles in a grid
  // Board size should be even to allow matching
  const boardSize = BOARD_LAYOUT.width * BOARD_LAYOUT.height;
  
  // Ensure we don't have odd number of tiles
  if (shuffledTiles.length % 2 !== 0) {
    shuffledTiles.pop();
  }
  
  const board = [];
  let tileIndex = 0;
  
  for (let row = 0; row < BOARD_LAYOUT.height; row++) {
    board[row] = [];
    for (let col = 0; col < BOARD_LAYOUT.width; col++) {
      if (tileIndex < shuffledTiles.length) {
        board[row][col] = {
          ...shuffledTiles[tileIndex],
          row,
          col,
          visible: true
        };
        tileIndex++;
      } else {
        board[row][col] = null;
      }
    }
  }
  
  return board;
}

/**
 * Check if a tile is accessible (not blocked from left and right)
 */
function isTileAccessible(board, row, col) {
  // Check left side
  const leftBlocked = col > 0 && board[row][col - 1] !== null;
  
  // Check right side
  const rightBlocked = col < board[0].length - 1 && board[row][col + 1] !== null;
  
  return !leftBlocked && !rightBlocked;
}

/**
 * Get all accessible tiles from the board
 */
function getAccessibleTiles(board) {
  const accessible = [];
  
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== null && isTileAccessible(board, row, col)) {
        accessible.push(board[row][col]);
      }
    }
  }
  
  return accessible;
}

/**
 * Remove a tile pair from the board
 */
function removeTiles(board, tile1, tile2) {
  const newBoard = board.map(row => [...row]);
  
  newBoard[tile1.row][tile1.col] = null;
  newBoard[tile2.row][tile2.col] = null;
  
  return newBoard;
}

/**
 * Check if the board is cleared (no tiles remaining)
 */
function isBoardCleared(board) {
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== null) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Count remaining tiles on the board
 */
function countRemainingTiles(board) {
  let count = 0;
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== null) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Serialize board for storage/transmission
 */
function serializeBoard(board) {
  return JSON.stringify(board);
}

/**
 * Deserialize board from storage/transmission
 */
function deserializeBoard(serialized) {
  try {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
      throw new Error('Invalid board structure');
    }
    return parsed;
  } catch (e) {
    throw new Error('Invalid board data');
  }
}

module.exports = {
  BOARD_LAYOUT,
  createBoard,
  isTileAccessible,
  getAccessibleTiles,
  removeTiles,
  isBoardCleared,
  countRemainingTiles,
  serializeBoard,
  deserializeBoard
};
