/**
 * MahjongService - Core game logic for Mahjong tile matching
 * Handles tile generation, validation, and hint logic
 */

// Tile types with 4 copies each
const NUMBERED_TILES = [
  'dot_1', 'dot_2', 'dot_3', 'dot_4', 'dot_5', 'dot_6', 'dot_7', 'dot_8', 'dot_9',
  'bam_1', 'bam_2', 'bam_3', 'bam_4', 'bam_5', 'bam_6', 'bam_7', 'bam_8', 'bam_9',
  'char_1', 'char_2', 'char_3', 'char_4', 'char_5', 'char_6', 'char_7', 'char_8', 'char_9',
  'wind_east', 'wind_south', 'wind_west', 'wind_north',
  'dragon_red', 'dragon_green', 'dragon_white'
];

const FLOWER_TILES = ['flower_1', 'flower_2', 'flower_3', 'flower_4'];
const SEASON_TILES = ['season_1', 'season_2', 'season_3', 'season_4'];

/**
 * Check if two tiles match
 */
export function tilesMatch(tile1Id, tile2Id) {
  if (tile1Id === tile2Id) return true;
  if (tile1Id.startsWith('flower_') && tile2Id.startsWith('flower_')) return true;
  if (tile1Id.startsWith('season_') && tile2Id.startsWith('season_')) return true;
  return false;
}

/**
 * Check if a tile is blocked
 */
export function isTileBlocked(tileId, positions) {
  const tile = positions[tileId];
  if (!tile) return true;
  
  const { row, col, layer } = tile;
  
  // Check if any tile is on top
  for (const [otherId, pos] of Object.entries(positions)) {
    if (otherId !== tileId && pos.row === row && pos.col === col && pos.layer > layer) {
      return true;
    }
  }
  
  // Check left/right blocking
  const leftBlocked = Object.values(positions).some(
    pos => pos.row === row && pos.col === col - 1 && pos.layer === layer
  );
  const rightBlocked = Object.values(positions).some(
    pos => pos.row === row && pos.col === col + 1 && pos.layer === layer
  );
  
  return leftBlocked || rightBlocked;
}

/**
 * Get selectable (unblocked) tiles
 */
export function getSelectableTiles(tiles, positions) {
  return tiles.filter(tileId => !isTileBlocked(tileId, positions));
}

/**
 * Shuffle array using Fisher-Yates
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate standard Mahjong layout (turtle pattern)
 */
function generateLayout() {
  const positions = {};
  let index = 0;
  
  // Layer 0: Base 12x6
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 12; col++) {
      positions[`tile_${index++}`] = { row, col, layer: 0 };
    }
  }
  
  // Layer 1: 10x4 with gaps
  for (let row = 1; row < 5; row++) {
    for (let col = 1; col < 11; col++) {
      positions[`tile_${index++}`] = { row, col, layer: 1 };
    }
  }
  
  // Layer 2: 8x2
  for (let row = 2; row < 4; row++) {
    for (let col = 2; col < 10; col++) {
      positions[`tile_${index++}`] = { row, col, layer: 2 };
    }
  }
  
  // Layer 3: Top tiles (2 tiles)
  positions[`tile_${index++}`] = { row: 2.5, col: 4, layer: 3 };
  positions[`tile_${index++}`] = { row: 2.5, col: 7, layer: 3 };
  
  return positions;
}

/**
 * Generate a new game board with shuffled tiles
 */
export function generateBoard(difficulty = 'medium') {
  // Build tile set: 4 copies of each numbered tile (108), 1 each flower/season (8) = 116 -> pad to 144
  const tileSet = [];
  [...NUMBERED_TILES, ...FLOWER_TILES, ...SEASON_TILES].forEach((tile, i) => {
    if (tile.startsWith('flower_') || tile.startsWith('season_')) {
      tileSet.push(tile); // 1 copy each
    } else {
      for (let j = 0; j < 4; j++) tileSet.push(tile); // 4 copies each
    }
  });
  
  // Pad to 144 tiles
  while (tileSet.length < 144) {
    tileSet.push('dot_1');
  }
  
  const shuffledTiles = shuffleArray(tileSet).slice(0, 144);
  const positions = generateLayout();
  
  const tiles = {};
  const tileIds = Object.keys(positions);
  tileIds.forEach((id, i) => {
    tiles[id] = shuffledTiles[i];
  });
  
  return { tiles, positions };
}

/**
 * Validate a match between two tiles
 */
export function validateMatch(tiles, positions, tile1Id, tile2Id) {
  // Check if both tiles exist and are unblocked
  const selectableTiles = getSelectableTiles(Object.keys(tiles), positions);
  
  if (!selectableTiles.includes(tile1Id) || !selectableTiles.includes(tile2Id)) {
    return false;
  }
  
  // Check if tiles match
  return tilesMatch(tiles[tile1Id], tiles[tile2Id]);
}

/**
 * Get a hint (find first valid pair)
 */
export function getHint(tiles, positions) {
  const selectableTiles = getSelectableTiles(Object.keys(tiles), positions);
  
  for (let i = 0; i < selectableTiles.length; i++) {
    for (let j = i + 1; j < selectableTiles.length; j++) {
      const t1 = selectableTiles[i];
      const t2 = selectableTiles[j];
      if (tilesMatch(tiles[t1], tiles[t2])) {
        return { tile1Id: t1, tile2Id: t2 };
      }
    }
  }
  
  return null; // No valid moves
}

/**
 * Check if there are any valid moves remaining
 */
export function hasValidMoves(tiles, positions) {
  return getHint(tiles, positions) !== null;
}

/**
 * Remove matched tiles and return updated state
 */
export function removeTiles(tiles, positions, tile1Id, tile2Id) {
  const newTiles = { ...tiles };
  const newPositions = { ...positions };
  
  delete newTiles[tile1Id];
  delete newTiles[tile2Id];
  delete newPositions[tile1Id];
  delete newPositions[tile2Id];
  
  return { tiles: newTiles, positions: newPositions };
}

/**
 * Calculate score based on difficulty and speed
 */
export function calculateScore(difficulty, moves, timeRemaining) {
  const baseScores = { easy: 10, medium: 20, hard: 30 };
  const base = baseScores[difficulty] || 20;
  const moveBonus = Math.max(0, (100 - moves) * 0.5);
  const timeBonus = timeRemaining * 0.1;
  return Math.round((base + moveBonus + timeBonus) * 100);
}

export const MahjongService = {
  generateBoard,
  validateMatch,
  getHint,
  hasValidMoves,
  removeTiles,
  calculateScore,
  tilesMatch,
  isTileBlocked,
  getSelectableTiles
};

export default MahjongService;
