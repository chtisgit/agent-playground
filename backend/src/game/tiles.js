/**
 * Tile definitions for Mahjong game
 * Standard Mahjong tile set includes 144 tiles
 */

// Tile suits - characters (万)
const CHARACTERS = ['1万', '2万', '3万', '4万', '5万', '6万', '7万', '8万', '9万'];

// Tile suits - bamboo (索)
const BAMBOO = ['1索', '2索', '3索', '4索', '5索', '6索', '7索', '8索', '9索'];

// Tile suits - circles (筒)
const CIRCLES = ['1筒', '2筒', '3筒', '4筒', '5筒', '6筒', '7筒', '8筒', '9筒'];

// Wind tiles
const WINDS = ['东风', '南风', '西风', '北风'];

// Dragon tiles
const DRAGONS = ['中', '發', '白'];

// Flower tiles (bonus)
const FLOWERS = ['梅', '蘭', '菊', '竹'];

// Season tiles (bonus)
const SEASONS = ['春', '夏', '秋', '冬'];

/**
 * Generate the complete set of 144 tiles
 * Each tile appears 4 times except for flowers and seasons (1 each)
 */
function generateTileSet() {
  const tiles = [];
  
  // Characters, Bamboo, Circles - each number appears 4 times
  const suits = [CHARACTERS, BAMBOO, CIRCLES];
  
  suits.forEach(suit => {
    suit.forEach(tile => {
      for (let i = 0; i < 4; i++) {
        tiles.push({ suit: 'numeric', value: tile, id: `${tile}-${i}` });
      }
    });
  });
  
  // Winds - each wind appears 4 times
  WINDS.forEach(tile => {
    for (let i = 0; i < 4; i++) {
      tiles.push({ suit: 'wind', value: tile, id: `${tile}-${i}` });
    }
  });
  
  // Dragons - each dragon appears 4 times
  DRAGONS.forEach(tile => {
    for (let i = 0; i < 4; i++) {
      tiles.push({ suit: 'dragon', value: tile, id: `${tile}-${i}` });
    }
  });
  
  // Flowers - each appears 1 time
  FLOWERS.forEach(tile => {
    tiles.push({ suit: 'flower', value: tile, id: `${tile}`, bonus: true });
  });
  
  // Seasons - each appears 1 time
  SEASONS.forEach(tile => {
    tiles.push({ suit: 'season', value: tile, id: `${tile}`, bonus: true });
  });
  
  return tiles;
}

/**
 * Shuffle the tile set using Fisher-Yates algorithm
 */
function shuffleTiles(tiles) {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Check if two tiles match (for regular tiles - must be exact match)
 */
function tilesMatch(tile1, tile2) {
  if (tile1.bonus || tile2.bonus) {
    // Bonus tiles only match with their same type
    return tile1.value === tile2.value;
  }
  return tile1.value === tile2.value;
}

/**
 * Get the display name for a tile
 */
function getTileDisplayName(tile) {
  return tile.value;
}

module.exports = {
  CHARACTERS,
  BAMBOO,
  CIRCLES,
  WINDS,
  DRAGONS,
  FLOWERS,
  SEASONS,
  generateTileSet,
  shuffleTiles,
  tilesMatch,
  getTileDisplayName
};
