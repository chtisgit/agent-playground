import './Tile.css';

// Comprehensive tile symbol mapping for all tile types
const TILE_SYMBOLS = {
  // Dots (筒子) - represented with ● symbols
  dot_1: { symbol: '●', label: '1 Dot', suit: 'dots' },
  dot_2: { symbol: '●●', label: '2 Dots', suit: 'dots' },
  dot_3: { symbol: '●●●', label: '3 Dots', suit: 'dots' },
  dot_4: { symbol: '●●●●', label: '4 Dots', suit: 'dots' },
  dot_5: { symbol: '●●●●●', label: '5 Dots', suit: 'dots' },
  dot_6: { symbol: '●●●●●●', label: '6 Dots', suit: 'dots' },
  dot_7: { symbol: '●●●●●●●', label: '7 Dots', suit: 'dots' },
  dot_8: { symbol: '●●●●●●●●', label: '8 Dots', suit: 'dots' },
  dot_9: { symbol: '●●●●●●●●●', label: '9 Dots', suit: 'dots' },

  // Bamboo (条子) - represented with Chinese numbers + 竹
  bam_1: { symbol: '一', label: '1 Bamboo', suit: 'bamboo' },
  bam_2: { symbol: '二', label: '2 Bamboo', suit: 'bamboo' },
  bam_3: { symbol: '三', label: '3 Bamboo', suit: 'bamboo' },
  bam_4: { symbol: '四', label: '4 Bamboo', suit: 'bamboo' },
  bam_5: { symbol: '五', label: '5 Bamboo', suit: 'bamboo' },
  bam_6: { symbol: '六', label: '6 Bamboo', suit: 'bamboo' },
  bam_7: { symbol: '七', label: '7 Bamboo', suit: 'bamboo' },
  bam_8: { symbol: '八', label: '8 Bamboo', suit: 'bamboo' },
  bam_9: { symbol: '九', label: '9 Bamboo', suit: 'bamboo' },

  // Characters (萬子) - represented with Chinese numbers + 萬
  char_1: { symbol: '一萬', label: '1 Character', suit: 'character' },
  char_2: { symbol: '二萬', label: '2 Character', suit: 'character' },
  char_3: { symbol: '三萬', label: '3 Character', suit: 'character' },
  char_4: { symbol: '四萬', label: '4 Character', suit: 'character' },
  char_5: { symbol: '五萬', label: '5 Character', suit: 'character' },
  char_6: { symbol: '六萬', label: '6 Character', suit: 'character' },
  char_7: { symbol: '七萬', label: '7 Character', suit: 'character' },
  char_8: { symbol: '八萬', label: '8 Character', suit: 'character' },
  char_9: { symbol: '九萬', label: '9 Character', suit: 'character' },

  // Winds
  wind_east: { symbol: '東', label: 'East Wind', suit: 'wind' },
  wind_south: { symbol: '南', label: 'South Wind', suit: 'wind' },
  wind_west: { symbol: '西', label: 'West Wind', suit: 'wind' },
  wind_north: { symbol: '北', label: 'North Wind', suit: 'wind' },

  // Dragons
  dragon_red: { symbol: '中', label: 'Red Dragon', suit: 'dragon' },
  dragon_green: { symbol: '發', label: 'Green Dragon', suit: 'dragon' },
  dragon_white: { symbol: '白', label: 'White Dragon', suit: 'dragon' },

  // Flowers
  flower_1: { symbol: '🌸', label: 'Flower 1', suit: 'flower' },
  flower_2: { symbol: '🌺', label: 'Flower 2', suit: 'flower' },
  flower_3: { symbol: '🌻', label: 'Flower 3', suit: 'flower' },
  flower_4: { symbol: '🌹', label: 'Flower 4', suit: 'flower' },

  // Seasons
  season_1: { symbol: '春', label: 'Spring', suit: 'season' },
  season_2: { symbol: '夏', label: 'Summer', suit: 'season' },
  season_3: { symbol: '秋', label: 'Autumn', suit: 'season' },
  season_4: { symbol: '冬', label: 'Winter', suit: 'season' },
};

/**
 * Parse a tile type string into its display components
 * Handles formats like 'dot_1', 'bam_5', 'char_9', 'wind_east', etc.
 * Falls back gracefully for unknown types
 */
function getTileDisplay(tile) {
  const tileType = tile.type || tile.suit || '';
  
  // Check direct mapping first
  if (TILE_SYMBOLS[tileType]) {
    const info = TILE_SYMBOLS[tileType];
    return {
      symbol: info.symbol,
      label: info.label,
      suit: info.suit,
      isChinese: ['bamboo', 'character', 'wind', 'dragon'].includes(info.suit),
    };
  }
  
  // Try to parse compound type (e.g., "dot_1" format)
  const parts = tileType.split('_');
  if (parts.length === 2) {
    const [suit, value] = parts;
    
    // Numbered tiles
    const chineseNums = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九' };
    
    if (suit === 'dot' && chineseNums[value]) {
      return {
        symbol: '●'.repeat(parseInt(value)),
        label: `${value} Dot`,
        suit: 'dots',
        isChinese: false,
      };
    }
    if (suit === 'bam' && chineseNums[value]) {
      return {
        symbol: chineseNums[value],
        label: `${value} Bamboo`,
        suit: 'bamboo',
        isChinese: true,
      };
    }
    if (suit === 'char' && chineseNums[value]) {
      return {
        symbol: chineseNums[value] + '萬',
        label: `${value} Character`,
        suit: 'character',
        isChinese: true,
      };
    }
    if (suit === 'wind') {
      const windSymbols = { east: '東', south: '南', west: '西', north: '北' };
      if (windSymbols[value]) {
        return {
          symbol: windSymbols[value],
          label: `${value.charAt(0).toUpperCase() + value.slice(1)} Wind`,
          suit: 'wind',
          isChinese: true,
        };
      }
    }
    if (suit === 'dragon') {
      const dragonSymbols = { red: '中', green: '發', white: '白' };
      if (dragonSymbols[value]) {
        return {
          symbol: dragonSymbols[value],
          label: `${value.charAt(0).toUpperCase() + value.slice(1)} Dragon`,
          suit: 'dragon',
          isChinese: true,
        };
      }
    }
    if (suit === 'flower') {
      const flowerSymbols = { 1: '🌸', 2: '🌺', 3: '🌻', 4: '🌹' };
      return {
        symbol: flowerSymbols[value] || '🌼',
        label: `Flower ${value}`,
        suit: 'flower',
        isChinese: false,
      };
    }
    if (suit === 'season') {
      const seasonSymbols = { 1: '春', 2: '夏', 3: '秋', 4: '冬' };
      return {
        symbol: seasonSymbols[value] || '🍂',
        label: `Season ${value}`,
        suit: 'season',
        isChinese: true,
      };
    }
  }
  
  // Legacy support: check tile.symbol directly
  if (tile.symbol) {
    return {
      symbol: typeof tile.symbol === 'object' ? (tile.symbol.char || '?') : String(tile.symbol),
      label: tile.label || tileType || 'Tile',
      suit: tile.suit || 'unknown',
      isChinese: false,
    };
  }
  
  // Fallback for unknown tile types
  return {
    symbol: tileType || '?',
    label: tileType || 'Unknown Tile',
    suit: 'unknown',
    isChinese: false,
  };
}

function Tile({ tile, index, isHint, isSelected, disabled, onClick }) {
  if (tile.removed) {
    return <div className="tile tile-empty" role="button" />;
  }

  const display = getTileDisplay(tile);
  const suitClass = display.suit || 'unknown';
  const tileClass = `tile tile-${suitClass} ${isHint ? 'tile-hint' : ''} ${isSelected ? 'tile-selected' : ''} ${disabled ? 'tile-disabled' : ''}`;

  return (
    <div 
      className={tileClass}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Tile ${index + 1}: ${display.label}`}
      data-type={suitClass}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!disabled) onClick();
        }
      }}
    >
      <div className="tile-content">
        <span className={`tile-symbol ${display.isChinese ? 'tile-symbol-chinese' : 'tile-symbol-emoji'}`}>
          {display.symbol}
        </span>
        <span className="tile-type">{display.label}</span>
      </div>
      <div className="tile-highlight" />
    </div>
  );
}

export default Tile;
